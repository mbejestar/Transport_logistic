{-# LANGUAGE DataKinds #-}
{-# LANGUAGE NoImplicitPrelude #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE ScopedTypeVariables #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TypeApplications #-}

module Main where

import Prelude (IO, String, FilePath, putStrLn, (<>), take)
import qualified Prelude as P
import qualified Data.Text as T

import Plutus.V2.Ledger.Api
import Plutus.V2.Ledger.Contexts
import qualified Plutus.V2.Ledger.Api as PlutusV2
import Plutus.V1.Ledger.Value (valueOf, adaSymbol, adaToken)
import PlutusTx
import PlutusTx.Prelude hiding (Semigroup(..), unless)
import qualified PlutusTx.Builtins as Builtins

import qualified Codec.Serialise as Serialise
import qualified Data.ByteString.Lazy  as LBS
import qualified Data.ByteString.Short as SBS
import qualified Data.ByteString       as BS
import qualified Data.ByteString.Base16 as B16

import qualified Cardano.Api as C
import qualified Cardano.Api.Shelley as CS

------------------------------------------------------------------------
-- Transport Escrow Datum & Redeemer (Cardano logistics use-case)
------------------------------------------------------------------------

data TransportDatum = TransportDatum
  { tdCompany       :: PubKeyHash   -- company treasury wallet
  , tdDriver        :: PubKeyHash   -- driver wallet
  , tdFleetManager  :: PubKeyHash   -- fleet manager wallet
  , tdManager       :: PubKeyHash   -- operations manager wallet
  , tdFinance       :: PubKeyHash   -- finance wallet
  , tdVendor        :: PubKeyHash   -- approved vendor (fuel station, toll operator, etc.)
  , tdBudget        :: Integer      -- remaining lovelace in escrow
  , tdMilestone     :: Integer      -- current milestone index
  }
PlutusTx.unstableMakeIsData ''TransportDatum

data TransportAction
  = ReleaseToVendor Integer Integer  -- payAmount(lovelace) nextMilestone
  | CloseTrip                      -- return remaining budget to company (manager+finance)
PlutusTx.unstableMakeIsData ''TransportAction

------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------

{-# INLINABLE signedBy #-}
signedBy :: PubKeyHash -> ScriptContext -> Bool
signedBy pkh ctx =
  txSignedBy (scriptContextTxInfo ctx) pkh

{-# INLINABLE multisigApproved #-}
-- Require (driver + fleet manager) OR (manager + finance)
multisigApproved :: TransportDatum -> ScriptContext -> Bool
multisigApproved dat ctx =
  ( signedBy (tdDriver dat) ctx && signedBy (tdFleetManager dat) ctx )
  ||
  ( signedBy (tdManager dat) ctx && signedBy (tdFinance dat) ctx )

{-# INLINABLE getTransportDatumFromTxOut #-}
getTransportDatumFromTxOut :: TxInfo -> TxOut -> Maybe TransportDatum
getTransportDatumFromTxOut info o =
  case txOutDatum o of
    NoOutputDatum -> Nothing
    OutputDatum (Datum d) -> Just (unsafeFromBuiltinData d)
    OutputDatumHash dh ->
      case findDatum dh info of
        Nothing        -> Nothing
        Just (Datum d) -> Just (unsafeFromBuiltinData d)

{-# INLINABLE datumMatches #-}
datumMatches :: TransportDatum -> TransportDatum -> Integer -> Integer -> Bool
datumMatches old new remainingBudget nextMs =
     tdCompany old      == tdCompany new
  && tdDriver old       == tdDriver new
  && tdFleetManager old == tdFleetManager new
  && tdManager old      == tdManager new
  && tdFinance old      == tdFinance new
  && tdVendor old       == tdVendor new
  && tdBudget new       == remainingBudget
  && tdMilestone new    == nextMs

------------------------------------------------------------------------
-- Validator Logic
------------------------------------------------------------------------

{-# INLINABLE mkTransportValidator #-}
mkTransportValidator :: TransportDatum -> TransportAction -> ScriptContext -> Bool
mkTransportValidator dat action ctx =
  case action of

    --------------------------------------------------------------------
    -- Release a partial payout to tdVendor (e.g., petrol/toll) and keep
    -- remaining budget locked in the script with updated datum.
    --------------------------------------------------------------------
    ReleaseToVendor payAmt nextMs ->
         traceIfFalse "multisig not approved" (multisigApproved dat ctx)
      && traceIfFalse "amount must be positive" (payAmt > 0)
      && traceIfFalse "insufficient budget" (payAmt <= tdBudget dat)
      && traceIfFalse "vendor not paid" vendorPaid
      && traceIfFalse "bad continuing output" continuingOutputOk

      where
        info :: TxInfo
        info = scriptContextTxInfo ctx

        vendorPaid :: Bool
        vendorPaid =
          let paid =
                valueOf
                  (valuePaidTo info (tdVendor dat))
                  adaSymbol
                  adaToken
          in paid >= payAmt

        continuingOutputOk :: Bool
        continuingOutputOk =
          let remaining = tdBudget dat - payAmt
              outs      = getContinuingOutputs ctx
          in case outs of
               [o] ->
                 let outAda =
                       valueOf (txOutValue o) adaSymbol adaToken
                 in  traceIfFalse "remaining budget mismatch" (outAda == remaining)
                     &&
                     case getTransportDatumFromTxOut info o of
                       Nothing -> traceError "missing/invalid continuing datum"
                       Just nd -> datumMatches dat nd remaining nextMs
               _ -> False

    --------------------------------------------------------------------
    -- Close trip: manager + finance return ALL remaining escrow to company
    -- and the script UTxO should be fully consumed (no continuing output).
    --------------------------------------------------------------------
    CloseTrip ->
         traceIfFalse "manager+finance required"
           (signedBy (tdManager dat) ctx && signedBy (tdFinance dat) ctx)
      && traceIfFalse "company not paid" companyPaid
      && traceIfFalse "should not continue" noContinuing

      where
        info :: TxInfo
        info = scriptContextTxInfo ctx

        companyPaid :: Bool
        companyPaid =
          let paid =
                valueOf
                  (valuePaidTo info (tdCompany dat))
                  adaSymbol
                  adaToken
          in paid >= tdBudget dat

        noContinuing :: Bool
        noContinuing =
          case getContinuingOutputs ctx of
            [] -> True
            _  -> False

------------------------------------------------------------------------
-- Untyped Wrapper
------------------------------------------------------------------------

{-# INLINABLE mkValidatorUntyped #-}
mkValidatorUntyped :: BuiltinData -> BuiltinData -> BuiltinData -> ()
mkValidatorUntyped d r c =
  if mkTransportValidator
      (unsafeFromBuiltinData d)
      (unsafeFromBuiltinData r)
      (unsafeFromBuiltinData c)
  then ()
  else error ()

validator :: Validator
validator =
  mkValidatorScript $$(PlutusTx.compile [|| mkValidatorUntyped ||])

------------------------------------------------------------------------
-- Validator Hash & Script Address
------------------------------------------------------------------------

plutusValidatorHash :: PlutusV2.Validator -> PlutusV2.ValidatorHash
plutusValidatorHash val =
  let bytes = Serialise.serialise val
      short = SBS.toShort (LBS.toStrict bytes)
  in PlutusV2.ValidatorHash (toBuiltin (SBS.fromShort short))

plutusScriptAddress :: Address
plutusScriptAddress =
  Address
    (ScriptCredential (plutusValidatorHash validator))
    Nothing

------------------------------------------------------------------------
-- Bech32 Script Address (Off-chain)
------------------------------------------------------------------------

toBech32ScriptAddress :: C.NetworkId -> Validator -> String
toBech32ScriptAddress network val =
  let serialised = SBS.toShort . LBS.toStrict $ Serialise.serialise val
      plutusScript :: C.PlutusScript C.PlutusScriptV2
      plutusScript = CS.PlutusScriptSerialised serialised
      scriptHash   = C.hashScript (C.PlutusScript C.PlutusScriptV2 plutusScript)
      shelleyAddr :: C.AddressInEra C.BabbageEra
      shelleyAddr =
        C.makeShelleyAddressInEra
          network
          (C.PaymentCredentialByScript scriptHash)
          C.NoStakeAddress
  in T.unpack (C.serialiseAddress shelleyAddr)

-----------------------------------------------------------------------------------
-- CBOR HEX
-----------------------------------------------------------------------------------

validatorToCBORHex :: Validator -> String
validatorToCBORHex val =
  let bytes = LBS.toStrict $ Serialise.serialise val
  in BS.foldr (\b acc -> byteToHex b <> acc) "" bytes
 where
  hexChars = "0123456789abcdef"
  byteToHex b =
    let hi = P.fromIntegral b `P.div` 16
        lo = P.fromIntegral b `P.mod` 16
    in [ hexChars P.!! hi, hexChars P.!! lo ]

------------------------------------------------------------------------
-- File Writer
------------------------------------------------------------------------

writeValidator :: FilePath -> Validator -> IO ()
writeValidator path val = do
  LBS.writeFile path (Serialise.serialise val)
  putStrLn $ "Validator written to: " <> path

writeCBOR :: FilePath -> Validator -> IO ()
writeCBOR path val = do
  let bytes = LBS.toStrict (Serialise.serialise val)
      hex   = B16.encode bytes
  BS.writeFile path hex
  putStrLn $ "CBOR hex written to: " <> path

------------------------------------------------------------------------
-- Main
------------------------------------------------------------------------

main :: IO ()
main = do
  let network = C.Testnet (C.NetworkMagic 1)

  writeValidator "transport_escrow.plutus" validator
  writeCBOR      "transport_escrow.cbor"   validator

  let vh      = plutusValidatorHash validator
      addr    = plutusScriptAddress
      bech32  = toBech32ScriptAddress network validator
      cborHex = validatorToCBORHex validator

  putStrLn "\n--- Transport Escrow (Multisig Payouts) ---"
  putStrLn $ "Validator Hash: " <> P.show vh
  putStrLn $ "Script Address: " <> P.show addr
  putStrLn $ "Bech32 Address: " <> bech32
  putStrLn $ "CBOR Hex (first 120 chars): " <> P.take 120 cborHex <> "..."
  putStrLn "------------------------------------------"
