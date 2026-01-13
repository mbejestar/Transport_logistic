import {
  Lucid,
  Blockfrost,
  Constr,
  Data,
} from "https://unpkg.com/lucid-cardano@0.10.11/web/mod.js";

/* =====================================================
   DATUM SCHEMA (MUST MATCH YOUR HASKELL DATUM ORDER)
   TransportDatum =
     { tdCompany, tdDriver, tdFleetManager, tdManager, tdFinance
     , tdVendor, tdBudget, tdMilestone }
===================================================== */

const TransportDatum = Data.Object({
  company: Data.Bytes(),
  driver: Data.Bytes(),
  fleetManager: Data.Bytes(),
  manager: Data.Bytes(),
  finance: Data.Bytes(),
  vendor: Data.Bytes(),
  budget: Data.Integer(),     // lovelace
  milestone: Data.Integer(),  // integer
});

/* =====================================================
   CONFIG
===================================================== */

const BLOCKFROST_URL = "https://cardano-preprod.blockfrost.io/api/v0";
const BLOCKFROST_KEY = "PUT_YOUR_BLOCKFROST_KEY";
const NETWORK = "Preprod";

/* =====================================================
   PLUTUS SCRIPT (CBOR HEX) - paste your compiled script here
===================================================== */

const SCRIPT_CBOR = "PASTE_TRANSPORT_ESCROW_CBOR_HEX_HERE";

const script = {
  type: "PlutusV2",
  script: SCRIPT_CBOR,
};

/* =====================================================
   GLOBAL STATE
===================================================== */

let lucid;
let walletAddress;
let walletPkh;
let scriptAddress;

/* =====================================================
   INIT (connect wallet + compute script address)
===================================================== */

export async function init() {
  lucid = await Lucid.new(
    new Blockfrost(BLOCKFROST_URL, BLOCKFROST_KEY),
    NETWORK
  );

  const api = await window.cardano.lace.enable();
  lucid.selectWallet(api);

  walletAddress = await lucid.wallet.address();
  walletPkh = lucid.utils.getAddressDetails(walletAddress).paymentCredential.hash;

  scriptAddress = lucid.utils.validatorToAddress(script);

  log("Wallet connected");
  log("Wallet: " + walletAddress);
  log("Script: " + scriptAddress);

  return { walletAddress, walletPkh, scriptAddress };
}

/* =====================================================
   DATUM / REDEEMER HELPERS
===================================================== */

function pkhFromAddress(addrBech32) {
  return lucid.utils.getAddressDetails(addrBech32).paymentCredential.hash;
}

function mkTransportDatum({
  companyPkh,
  driverPkh,
  fleetManagerPkh,
  managerPkh,
  financePkh,
  vendorPkh,
  budgetLovelace,
  milestone,
}) {
  return Data.to(
    {
      company: companyPkh,
      driver: driverPkh,
      fleetManager: fleetManagerPkh,
      manager: managerPkh,
      finance: financePkh,
      vendor: vendorPkh,
      budget: BigInt(budgetLovelace),
      milestone: BigInt(milestone),
    },
    TransportDatum
  );
}

// Redeemers must match your Haskell:
// ReleaseToVendor Integer Integer  -> Constr(0, [payAmt, nextMs])
// CloseTrip                      -> Constr(1, [])
function releaseRedeemer(payAmtLovelace, nextMs) {
  return Data.to(new Constr(0, [BigInt(payAmtLovelace), BigInt(nextMs)]));
}
const closeRedeemer = Data.to(new Constr(1, []));

/* =====================================================
   FIND THE ESCROW UTXO (match by company+vendor, optional milestone)
===================================================== */

async function findEscrowUtxo({ companyPkh, vendorPkh, milestone = null }) {
  const utxos = await lucid.utxosAt(scriptAddress);

  const match = utxos.find((u) => {
    if (!u.datum) return false;

    const d = Data.from(u.datum, TransportDatum);

    const okCompany = d.company === companyPkh;
    const okVendor = d.vendor === vendorPkh;
    const okMilestone = milestone === null ? true : BigInt(d.milestone) === BigInt(milestone);

    return okCompany && okVendor && okMilestone;
  });

  return match || null;
}

/* =====================================================
   1) CREATE / FUND ESCROW (company locks trip budget)
   - This creates the first UTxO at the script with inline datum.
===================================================== */

export async function createEscrow({
  companyAddr,        // bech32 of company wallet (can be same as connected wallet)
  driverAddr,
  fleetManagerAddr,
  managerAddr,
  financeAddr,
  vendorAddr,
  budgetAda,          // number/string in ADA
  milestone = 0,
}) {
  const companyPkh = pkhFromAddress(companyAddr);
  const driverPkh = pkhFromAddress(driverAddr);
  const fleetManagerPkh = pkhFromAddress(fleetManagerAddr);
  const managerPkh = pkhFromAddress(managerAddr);
  const financePkh = pkhFromAddress(financeAddr);
  const vendorPkh = pkhFromAddress(vendorAddr);

  const budgetLovelace = BigInt(budgetAda) * 1_000_000n;

  const datum = mkTransportDatum({
    companyPkh,
    driverPkh,
    fleetManagerPkh,
    managerPkh,
    financePkh,
    vendorPkh,
    budgetLovelace,
    milestone,
  });

  const tx = await lucid
    .newTx()
    .payToContract(
      scriptAddress,
      { inline: datum },
      { lovelace: budgetLovelace }
    )
    // Company signs the escrow creation (recommended)
    .addSignerKey(companyPkh)
    .complete();

  // NOTE: the connected wallet must be the one that can sign for companyPkh
  const signed = await tx.sign().complete();
  const txHash = await signed.submit();

  log("Escrow created: " + txHash);
  return txHash;
}

/* =====================================================
   2) RELEASE TO VENDOR (fuel/toll/etc payout)
   - Enforces multisig ON-CHAIN:
       (driver + fleetManager) OR (manager + finance)
   - Off-chain you choose which approval pair is used and include both signers.
   - Keeps remaining funds locked with updated datum.
===================================================== */

export async function releaseToVendor({
  companyAddr,
  vendorAddr,
  payAda,            // amount to vendor (ADA)
  nextMilestone,     // integer
  approvalMode,      // "driverFleet" OR "managerFinance"
  // If you want stricter matching you can pass currentMilestone:
  currentMilestone = null,
}) {
  const companyPkh = pkhFromAddress(companyAddr);
  const vendorPkh = pkhFromAddress(vendorAddr);

  const escrowUtxo = await findEscrowUtxo({
    companyPkh,
    vendorPkh,
    milestone: currentMilestone,
  });

  if (!escrowUtxo) {
    log("No matching escrow UTxO found at script.");
    return null;
  }

  const d = Data.from(escrowUtxo.datum, TransportDatum);

  const payLovelace = BigInt(payAda) * 1_000_000n;
  const remaining = BigInt(d.budget) - payLovelace;

  if (payLovelace <= 0n) {
    log("Pay amount must be > 0");
    return null;
  }
  if (remaining < 0n) {
    log("Insufficient budget in escrow");
    return null;
  }

  // Build updated datum for the continuing output
  const newDatum = mkTransportDatum({
    companyPkh: d.company,
    driverPkh: d.driver,
    fleetManagerPkh: d.fleetManager,
    managerPkh: d.manager,
    financePkh: d.finance,
    vendorPkh: d.vendor,
    budgetLovelace: remaining,
    milestone: nextMilestone,
  });

  // Vendor gets paid to their address (not just PKH)
  const vendorPayAddress = vendorAddr;

  // Determine required signer pair for this payout
  const requiredSigners =
    approvalMode === "driverFleet"
      ? [d.driver, d.fleetManager]
      : [d.manager, d.finance];

  let txBuilder = lucid
    .newTx()
    .collectFrom([escrowUtxo], releaseRedeemer(payLovelace, nextMilestone))
    .attachSpendingValidator(script)
    .payToAddress(vendorPayAddress, { lovelace: payLovelace });

  // If remaining budget > 0, keep it locked with continuing output + inline datum
  // If remaining == 0, you MAY prefer to close instead of continue. Here we continue only if > 0.
  if (remaining > 0n) {
    txBuilder = txBuilder.payToContract(
      scriptAddress,
      { inline: newDatum },
      { lovelace: remaining }
    );
  }

  // Add both required signer keys so the transaction requires both signatures
  for (const s of requiredSigners) {
    txBuilder = txBuilder.addSignerKey(s);
  }

  const tx = await txBuilder.complete();

  /*
    MULTI-SIG NOTE (IMPORTANT):
    - In a browser, only the connected wallet can sign.
    - If the connected wallet controls ONLY ONE of the required signers,
      you must co-sign with the other wallet.
    - Use the helper functions below to export/import CBOR for co-signing.
  */

  const txCborHex = tx.toString();
  log("Release TX built (CBOR). Ready to sign/cosign.");
  return { txCborHex, requiredSigners };
}

/* =====================================================
   3) CLOSE TRIP (manager + finance return remaining to company)
   - Consumes the script UTxO and pays tdBudget to company address
===================================================== */

export async function closeTrip({
  companyAddr,
  vendorAddr,
  approvalMode = "managerFinance",
  currentMilestone = null,
}) {
  const companyPkh = pkhFromAddress(companyAddr);
  const vendorPkh = pkhFromAddress(vendorAddr);

  const escrowUtxo = await findEscrowUtxo({
    companyPkh,
    vendorPkh,
    milestone: currentMilestone,
  });

  if (!escrowUtxo) {
    log("No matching escrow UTxO found to close.");
    return null;
  }

  const d = Data.from(escrowUtxo.datum, TransportDatum);
  const companyPayAddress = companyAddr;

  // CloseTrip requires manager + finance per on-chain logic
  const requiredSigners = [d.manager, d.finance];

  let txBuilder = lucid
    .newTx()
    .collectFrom([escrowUtxo], closeRedeemer)
    .attachSpendingValidator(script)
    .payToAddress(companyPayAddress, { lovelace: BigInt(d.budget) });

  for (const s of requiredSigners) {
    txBuilder = txBuilder.addSignerKey(s);
  }

  const tx = await txBuilder.complete();
  const txCborHex = tx.toString();

  log("Close TX built (CBOR). Ready to sign/cosign.");
  return { txCborHex, requiredSigners };
}

/* =====================================================
   CO-SIGNING HELPERS (no DeFi — just multi-sig workflow)

   Flow:
   1) One party calls releaseToVendor() or closeTrip()
      -> gets { txCborHex, requiredSigners }
   2) Share txCborHex with the other signer (copy/paste)
   3) Each signer connects their wallet and runs:
      signTx(txCborHex) -> returns partially/fully signed CBOR
   4) Final signer runs submitTx(signedCborHex)
===================================================== */

export async function signTx(txCborHex) {
  const tx = lucid.fromTx(txCborHex);
  const signed = await tx.sign().complete();
  const signedCborHex = signed.toString();
  log("Transaction signed by current wallet.");
  return signedCborHex;
}

export async function submitTx(signedTxCborHex) {
  const tx = lucid.fromTx(signedTxCborHex);
  const txHash = await tx.submit();
  log("Submitted: " + txHash);
  return txHash;
}

/* =====================================================
   UI LOG
===================================================== */

function log(msg) {
  const el = document.getElementById("log");
  if (el) el.innerText = msg;
  console.log(msg);
}

/* =====================================================
   EXAMPLE HOOKS (optional)
===================================================== */
// document.getElementById("connect").onclick = init;
// document.getElementById("createEscrow").onclick = async () => { ... };
// document.getElementById("buildRelease").onclick = async () => { ... };
// document.getElementById("sign").onclick = async () => { ... };
// document.getElementById("submit").onclick = async () => { ... };
