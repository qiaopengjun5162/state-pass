#!/usr/bin/env node
// StatePass × x402 CLI Demo
// Usage: npx tsx cli-demo.ts <mint-address>
// Shows dNFT info, quotes, pays, and displays result.
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  getTokenMetadata,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from "@solana/spl-token";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Config ──
const RPC_URL = process.env.RPC_URL || "http://localhost:8899";
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";
const KEYPAIR_PATH = resolve(
  process.env.HOME || "/Users/qiaopengjun",
  ".config/solana/id.json",
);

const MINT_ARG = process.argv[2];
if (!MINT_ARG) {
  console.error("Usage: npx tsx cli-demo.ts <statepass-mint-address>");
  console.error("\nTip: Check test output for 'Mint Public Key:'");
  process.exit(1);
}

// ── Bootstrap ──
const connection = new Connection(RPC_URL, "confirmed");
const keypairData = JSON.parse(readFileSync(KEYPAIR_PATH, "utf-8"));
const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
const mint = new PublicKey(MINT_ARG);

const DIVIDER = "─".repeat(56);

async function getServerStatus() {
  const res = await fetch(`${SERVER_URL}/status`);
  return res.json();
}

async function main() {
  console.log(`\n  ${DIVIDER}`);
  console.log("  🪪  StatePass × x402  —  CLI Demo");
  console.log(`  ${DIVIDER}\n`);

  // ── 1. Wallet Info ──
  console.log("  ┌─ 👤 Wallet");
  console.log(`  │  Address: ${wallet.publicKey.toBase58()}`);
  const solBal = await connection.getBalance(wallet.publicKey);
  console.log(`  │  SOL:     ${(solBal / 1e9).toFixed(4)}`);
  console.log(`  └${"─".repeat(40)}\n`);

  // ── 2. StatePass dNFT Info ──
  console.log("  ┌─ 🎫 StatePass dNFT");
  console.log(`  │  Mint:  ${mint.toBase58()}`);
  try {
    const metadata = await getTokenMetadata(connection, mint);
    const meta = metadata as any;
    const levelEntry = meta?.additionalMetadata?.find(
      ([k]: string[]) => k === "level",
    );
    const level = levelEntry ? parseInt(levelEntry[1], 10) : 1;
    console.log(`  │  Name:  ${meta?.name || "N/A"}`);
    console.log(`  │  Symbol: ${meta?.symbol || "N/A"}`);
    console.log(`  │  Level: ${level}`);
    console.log(`  │  URI:   ${meta?.uri || "N/A"}`);
  } catch {
    console.log("  │  ⚠ Could not read metadata");
  }
  console.log(`  └${"─".repeat(40)}\n`);

  // ── 3. Server Status ──
  console.log("  ┌─ ⚙️  Server");
  const status = await getServerStatus();
  const rc = status.rateConfig;
  console.log(`  │  USDC Mint:  ${status.usdcMint}`);
  console.log(`  │  Recipient:  ${status.recipientTokenAccount}`);
  if (typeof rc === "object" && rc) {
    console.log(`  │  RateConfig:`);
    console.log(`  │    Level 1:  ${rc.level1Rate} （${(rc.level1Rate / 1e6).toFixed(6)} USDC）`);
    console.log(`  │    Level 2:  ${rc.level2Rate} （${(rc.level2Rate / 1e6).toFixed(6)} USDC）`);
    console.log(`  │    Level 3:  ${rc.level3Rate} （${(rc.level3Rate / 1e6).toFixed(6)} USDC）`);
  } else {
    console.log(`  │  RateConfig: ${rc}`);
  }
  console.log(`  └${"─".repeat(40)}\n`);

  // ── 4. Get Quote ──
  console.log("  ┌─ 📋 Getting Payment Quote...");
  const quoteRes = await fetch(`${SERVER_URL}/premium?mint=${MINT_ARG}`);
  const quote = await quoteRes.json();
  if (quoteRes.status !== 402 || !quote.payment) {
    console.error("  │  ❌ Failed to get quote:", JSON.stringify(quote));
    process.exit(1);
  }
  console.log(`  │  Level:     ${quote.payment.level}`);
  console.log(`  │  Price:     ${quote.payment.amountUSDC} USDC`);
  console.log(`  │  Message:   ${quote.payment.message}`);
  console.log(`  └${"─".repeat(40)}\n`);

  // ── 5. Execute Payment ──
  console.log("  ┌─ 💸 Executing Payment...");
  const usdcMint = new PublicKey(status.usdcMint);
  const recipientTokenAccount = new PublicKey(status.recipientTokenAccount);
  const price = quote.payment.amount;

  // Get payer's USDC ATA and check balance
  const payerTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    usdcMint,
    wallet.publicKey,
  );
  const payerBal = await connection.getTokenAccountBalance(
    payerTokenAccount.address,
  );
  console.log(`  │  My USDC ATA: ${payerTokenAccount.address.toBase58()}`);
  console.log(`  │  Balance:     ${payerBal.value.uiAmount} USDC`);

  if (Number(payerBal.value.amount) < price) {
    console.error(
      `  │  ❌ Insufficient balance (need ${price / 1e6} USDC)`,
    );
    process.exit(1);
  }

  // Build & sign
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  const tx = new Transaction({
    feePayer: wallet.publicKey,
    blockhash,
    lastValidBlockHeight,
  });
  tx.add(
    createTransferInstruction(
      payerTokenAccount.address,
      recipientTokenAccount,
      wallet.publicKey,
      price,
    ),
  );
  tx.sign(wallet);
  const serializedTx = tx.serialize().toString("base64");

  const paymentProof = {
    x402Version: 1,
    scheme: "exact",
    network: "solana-devnet",
    payload: { serializedTransaction: serializedTx },
  };
  const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString(
    "base64",
  );

  console.log(`  │  ✅ Transaction signed (not submitted yet)`);
  console.log(`  │  Sending payment proof to server...`);

  const paidRes = await fetch(`${SERVER_URL}/premium?mint=${MINT_ARG}`, {
    headers: { "X-Payment": xPaymentHeader },
  });
  const result = await paidRes.json();
  console.log(`  └${"─".repeat(40)}\n`);

  // ── 6. Result ──
  if (paidRes.status === 200 && result.data) {
    console.log("  ┌─ ✅ PAYMENT VERIFIED — PREMIUM CONTENT UNLOCKED");
    console.log(`  │  ${result.data}`);
    if (result.paymentDetails) {
      console.log(`  │  TX:    ${result.paymentDetails.signature}`);
      console.log(
        `  │  Amount: ${result.paymentDetails.amountUSDC} USDC`,
      );
      console.log(
        `  │  🔗 ${result.paymentDetails.explorerUrl}`,
      );
    }
    console.log(`  └${"─".repeat(40)}\n`);
  } else {
    console.log("  ┌─ ❌ PAYMENT FAILED");
    console.log(`  │  ${JSON.stringify(result, null, 4)}`);
    console.log(`  └${"─".repeat(40)}\n`);
    process.exit(1);
  }

  console.log(`  ${DIVIDER}`);
  console.log("  🎉  StatePass × x402 Demo completed successfully!");
  console.log(`  ${DIVIDER}\n`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
