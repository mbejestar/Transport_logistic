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
const BLOCKFROST_KEY = "preprodYjRkHfcazNkL0xxG9C2RdUbUoTrG7wip";
const NETWORK = "Preprod";

/* =====================================================
   PLUTUS SCRIPT (CBOR HEX) - paste your compiled script here
===================================================== */

const SCRIPT_CBOR = "59100d0100003232323232332232323232323232323322323233223232323232323232323322323232323232323232322232323223232533532323232533500315335533553353300e3500222002350042222222200513300e35002220023500422222222004103010311335738921186d616e616765722b66696e616e636520726571756972656400030153355335333573466e20ccc034ccd54c058480054051408ccc03cd401088888888020d40088800804c04cd4010888888880080c00c440c44cd5ce24910636f6d70616e79206e6f74207061696400030153355335301100210312210321031133573892011373686f756c64206e6f7420636f6e74696e7565000301030103023221533553355335533533011350052200235007222222220071330113500522002350072222222200610331034153353301135005220023500722222222005133011350052200235007222222220041033103413357389201156d756c7469736967206e6f7420617070726f76656400033153355335333573466e2400d200003303410341335738920117616d6f756e74206d75737420626520706f73697469766500033153355335333573466e2400cd401c888888880080d00cc40d04cd5ce24913696e73756666696369656e742062756467657400033153355335333573466e20ccc040ccd54c06448005405d4098cc048d401c8888888800d401005805800c0cc0d040d04cd5ce24810f76656e646f72206e6f74207061696400033153355335301400510332215335001153355335333573466e1cccc048d4008888800c06006140100d80d440d84cd5ce24811972656d61696e696e6720627564676574206d69736d61746368000351533532533353500322220021502c213502e30170012321533535003222222222222300d002213503030190011502e3200135503d2253350011502f22135002225335333573466e3c00801c0f80f44d40d00044c01800d401884c94cd4ccd5cd19b8f3500b22222222008350022222222200803803715335333573466e3cd402c8888888801cd40088888888801c0e00dc54cd4ccd5cd19b8f3500b22222222006350022222222200603803715335333573466e3cd402c88888888014d4008888888880140e00dc54cd4ccd5cd19b8f3500b22222222004350022222222200403803715335333573466e3cd402c8888888800cd40088888888800c0e00dc54cd4ccd5cd19b8735002222222220020010380371333573466e1cd4008888888880040140e00dc40dc40dc40dc40dc40dc40dc40dd40144c98c80e0cd5ce2481206d697373696e672f696e76616c696420636f6e74696e75696e6720646174756d0003910352210371034133573892011562616420636f6e74696e75696e67206f75747075740003310331033103310331337026a00a4444444400400226a002440046666ae68cdc39aab9d5004480008cc8848cc00400c008c8c8c8c8c8c8c8c8c8c8c8c8c8cccd5cd19b8735573aa018900011999999999999111111111110919999999999980080680600580500480400380300280200180119a8150159aba1500c33502a02b35742a01666a0540586ae854028ccd540b9d728169aba150093335502e75ca05a6ae854020cd40a80e0d5d0a803999aa81701cbad35742a00c6464646666ae68cdc39aab9d5002480008cc8848cc00400c008c8c8c8cccd5cd19b8735573aa004900011991091980080180119a821bad35742a00460886ae84d5d1280111931902419ab9c048049046135573ca00226ea8004d5d0a8011919191999ab9a3370e6aae754009200023322123300100300233504375a6ae854008c110d5d09aba2500223263204833573809009208c26aae7940044dd50009aba135744a004464c6408866ae701101141084d55cf280089baa00135742a00a66a054eb8d5d0a802199aa81701a90009aba150033335502e75c40026ae854008c0dcd5d09aba2500223263204033573808008207c26ae8940044d5d1280089aba25001135744a00226ae8940044d5d1280089aba25001135744a00226ae8940044d5d1280089aab9e5001137540026ae854010c09cd5d09aba250042326320323357380640660606666ae68cdc3a802a4004424400446666ae68cdc3a8032400046644244660020080066eb4d5d0a8041bad357426ae8940208c98c80c8cd5ce019019818017980600408180b09aab9e50011375400226aae7540084d55cf280089baa001222323230010053200135502d223350014800088d4008894cd4ccd5cd19b8f00200902e02d13007001130060033200135502c223350014800088d4008894cd4ccd5cd19b8f00200702d02c1001130060032235002222222222222533533355301a12001501225335333573466e3c0380040c80c44d40a00045409c010840c840c088d4004888888888888ccd54c0544800488d40088888d401088cd400894cd4ccd5cd19b8f017001039038133502a00600810082008502200a232323232323232323333573466e1cd55cea8042400046666666644444444246666666600201201000e00c00a0080060046eb8d5d0a8041bae35742a00e6eb8d5d0a8031bae35742a00a6eb8d5d0a8021bae35742a0066eb4d5d0a8011bad357426ae8940088c98c80b4cd5ce01681701589aba25001135744a00226ae8940044d5d1280089aba25001135744a00226aae7940044dd50009299a9a800911a8011111111111111999a8069281292812928129199aa980c89000a80891a80091299aa99a999ab9a3371e6a004440046a008440040660642666ae68cdc39a801110009a80211000819819081909a8148018a814006909a800911a80091111a804111a801111111111111199aa980d89000911a8011111299a9a80c111a803111919a802919a8021299a999ab9a3371e0040020860842a00620844084466a00840844a66a666ae68cdc78010008218210a80188210a99a80190a99a8011099a801119a801119a801119a8011198188010009022919a801102291981880100091102291119a8021022911299a999ab9a3370e00c00609008e2a66a666ae68cdc38028010240238999ab9a3370e00800209008e208e208e20802a66a002420802080266a05a00c00a200aa050014264c6404666ae71241024c66000241335009225335002210031001501448810012233553007120012350012233550150023355300a12001235001223355018002333500123302a4800000488cc0ac0080048cc0a800520000013355300712001235001223355015002333500123355300b1200123500122335501900235500d0010012233355500800f00200123355300b1200123500122335501900235500c00100133355500300a002001111222333553004120015010335530071200123500122335501500235500900133355300412001223500222533533355300c120013233500e223335003220020020013500122001123300122533500210261001023235001223300a002005006100313350140040035011001335530071200123500122323355016003300100532001355027225335001135500a003221350022253353300c002008112223300200a0041300600300232001355020221122253350011002221330050023335530071200100500400111212223003004112122230010043200135501d22112253350011500e22133500f300400233553006120010040013200135501c2211222533500113500322001221333500522002300400233355300712001005004001122123300100300222333573466e3c00800405c05848c88c008dd6000990009aa80d111999aab9f0012500a233500930043574200460066ae880080688c8c8cccd5cd19b8735573aa004900011991091980080180118079aba150023005357426ae8940088c98c8064cd5ce00c80d00b89aab9e5001137540024646464646666ae68cdc39aab9d5004480008cccc888848cccc00401401000c008c8c8c8cccd5cd19b8735573aa0049000119910919800801801180c1aba15002335010017357426ae8940088c98c8078cd5ce00f00f80e09aab9e5001137540026ae854010ccd54021d728039aba150033232323333573466e1d4005200423212223002004357426aae79400c8cccd5cd19b875002480088c84888c004010dd71aba135573ca00846666ae68cdc3a801a400042444006464c6404066ae700800840780740704d55cea80089baa00135742a00466a018eb8d5d09aba2500223263201a33573803403603026ae8940044d5d1280089aab9e500113754002266aa002eb9d6889119118011bab00132001355017223233335573e0044a010466a00e66aa012600c6aae754008c014d55cf280118021aba20030181357420022244004244244660020080062244246600200600424464646666ae68cdc3a800a400046a00e600a6ae84d55cf280191999ab9a3370ea00490011280391931900a19ab9c014015012011135573aa00226ea800448488c00800c44880048c8c8cccd5cd19b875001480188c848888c010014c01cd5d09aab9e500323333573466e1d400920042321222230020053009357426aae7940108cccd5cd19b875003480088c848888c004014c01cd5d09aab9e500523333573466e1d40112000232122223003005375c6ae84d55cf280311931900919ab9c01201301000f00e00d135573aa00226ea80048c8c8cccd5cd19b8735573aa004900011991091980080180118029aba15002375a6ae84d5d1280111931900719ab9c00e00f00c135573ca00226ea80048c8cccd5cd19b8735573aa002900011bae357426aae7940088c98c8030cd5ce00600680509baa001232323232323333573466e1d4005200c21222222200323333573466e1d4009200a21222222200423333573466e1d400d2008233221222222233001009008375c6ae854014dd69aba135744a00a46666ae68cdc3a8022400c4664424444444660040120106eb8d5d0a8039bae357426ae89401c8cccd5cd19b875005480108cc8848888888cc018024020c030d5d0a8049bae357426ae8940248cccd5cd19b875006480088c848888888c01c020c034d5d09aab9e500b23333573466e1d401d2000232122222223005008300e357426aae7940308c98c8054cd5ce00a80b00980900880800780700689aab9d5004135573ca00626aae7940084d55cf280089baa0012323232323333573466e1d400520022333222122333001005004003375a6ae854010dd69aba15003375a6ae84d5d1280191999ab9a3370ea0049000119091180100198041aba135573ca00c464c6401c66ae7003803c03002c4d55cea80189aba25001135573ca00226ea80048c8c8cccd5cd19b875001480088c8488c00400cdd71aba135573ca00646666ae68cdc3a8012400046424460040066eb8d5d09aab9e500423263200b33573801601801201026aae7540044dd500089119191999ab9a3370ea00290021091100091999ab9a3370ea00490011190911180180218031aba135573ca00846666ae68cdc3a801a400042444004464c6401866ae700300340280240204d55cea80089baa0012323333573466e1d40052002200523333573466e1d40092000200523263200833573801001200c00a26aae74dd5000891001091000a4c92010350543100120012233700004002224646002002446600660040040021";

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
