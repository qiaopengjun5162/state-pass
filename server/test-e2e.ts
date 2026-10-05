// StatePass × x402 client — full E2E test on local validator
// Uses local USDC mint, real StatePass dNFT from test suite
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { readFileSync } from "fs";
import { resolve } from "path";

const RPC_URL = "http://localhost:8899";
const SERVER_URL = "http://localhost:3001";
const connection = new Connection(RPC_URL, "confirmed");

const keypairPath = resolve(process.env.HOME || "/Users/qiaopengjun", ".config/solana/id.json");
const keypairData = JSON.parse(readFileSync(keypairPath, "utf-8"));
const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

async function run() {
  console.log("🧪 StatePass × x402 E2E Test\n");
  console.log(`Payer: ${payer.publicKey.toBase58()}`);

  // Get server status to learn which USDC mint it expects
  const statusRes = await fetch(`${SERVER_URL}/status`);
  const status = await statusRes.json();
  console.log(`\n📋 Server status:`);
  console.log(`   USDC Mint: ${status.usdcMint}`);
  console.log(`   Recipient Token Account: ${status.recipientTokenAccount}`);
  console.log(`   RateConfig: level1=${status.rateConfig?.level1Rate}, level2=${status.rateConfig?.level2Rate}`);

  const usdcMint = new PublicKey(status.usdcMint);
  const recipientTokenAccount = new PublicKey(status.recipientTokenAccount);

  // Get payer's USDC ATA (create if needed)
  const payerTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    usdcMint,
    payer.publicKey,
  );
  console.log(`\n💰 Payer USDC ATA: ${payerTokenAccount.address.toBase58()}`);
  const payerBal = await connection.getTokenAccountBalance(payerTokenAccount.address);
  console.log(`   Balance: ${payerBal.value.uiAmount} USDC`);

  if (Number(payerBal.value.amount) < 1000) {
    console.log("   ⚠ Low USDC balance — tests may fail");
  }

  // Check existing StatePass NFT
  const testMintStr = "F6C1s2EQat2r8XXKZG1VuSjiciWt496kN18oTe9C3UdE";
  const testMint = new PublicKey(testMintStr);

  console.log(`\n🎯 StatePass dNFT: ${testMintStr}`);

  // Step 1: Get 402 quote
  console.log("\n📋 Step 1: Getting x402 payment quote...");
  const quoteUrl = `${SERVER_URL}/premium?mint=${testMintStr}`;
  const quoteRes = await fetch(quoteUrl);
  const quote = await quoteRes.json();
  console.log(`   Status: ${quoteRes.status}`);
  console.log(`   Level: ${quote.payment?.level}`);
  console.log(`   Price: ${quote.payment?.amount} smallest units (${quote.payment?.amountUSDC} USDC)`);

  if (quoteRes.status !== 402 || !quote.payment) {
    throw new Error(`Expected 402 with payment details, got: ${JSON.stringify(quote)}`);
  }

  const price = quote.payment.amount;

  // Step 2: Create and sign USDC transfer
  console.log("\n📋 Step 2: Creating signed USDC transfer...");
  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new Transaction({
    feePayer: payer.publicKey,
    blockhash,
    lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
  });

  const transferIx = createTransferInstruction(
    payerTokenAccount.address,
    recipientTokenAccount,
    payer.publicKey,
    price,
  );
  tx.add(transferIx);
  tx.sign(payer);

  const serializedTx = tx.serialize().toString("base64");

  // Step 3: Submit payment proof
  console.log("📋 Step 3: Submitting payment proof...");
  const paymentProof = {
    x402Version: 1,
    scheme: "exact",
    network: "solana-devnet",
    payload: { serializedTransaction: serializedTx },
  };
  const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString("base64");

  const paidRes = await fetch(quoteUrl, {
    headers: { "X-Payment": xPaymentHeader },
  });
  const result = await paidRes.json();
  console.log(`   Status: ${paidRes.status}`);

  if (paidRes.status === 200 && result.data) {
    console.log(`\n✅ SUCCESS! Premium content unlocked!`);
    console.log(`   ${result.data}`);
    if (result.paymentDetails) {
      console.log(`\n🔗 Explorer: ${result.paymentDetails.explorerUrl}`);
    }
  } else {
    console.log(`\n❌ Payment failed:`);
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log("\n🎉 Full StatePass × x402 E2E flow completed successfully!");
}

run().catch(console.error);

