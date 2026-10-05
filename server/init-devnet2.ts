#!/usr/bin/env node
import { spawn } from "child_process";
import { readFileSync } from "fs";

// Minimal devnet initializer - avoids fetch issues by using solana CLI
const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = "21xpRqRTFk7N7ybdPA2RyTmRqQB9FH4Xerty9jeTU1Dx";
const SIGNER = process.env.HOME + "/.config/solana/id.json";

const kp = JSON.parse(readFileSync(SIGNER, "utf-8"));
const wallet = require("@solana/web3.js").Keypair.fromSecretKey(
  Uint8Array.from(kp)
);
const pubkey = wallet.publicKey.toBase58();

console.log("Wallet:", pubkey);

// Compute PDAs
const { PublicKey } = require("@solana/web3.js");
const pid = new PublicKey(PROGRAM_ID);
const nftAuth = PublicKey.findProgramAddressSync(
  [Buffer.from("nft_authority")],
  pid
)[0];
const rcPda = PublicKey.findProgramAddressSync(
  [Buffer.from("rate_config")],
  pid
)[0];

console.log("NFT Auth PDA:", nftAuth.toBase58());
console.log("RateConfig PDA:", rcPda.toBase58());

// Build transaction via solana CLI
const { execSync } = require("child_process");

// Step 1: initialize_rate_config data
// discriminator: [226,214,218,141,79,210,61,30]
// args: level1(100), level2(250), level3(300), max_level(3)
const data = Buffer.concat([
  Buffer.from([226, 214, 218, 141, 79, 210, 61, 30]),
  (() => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(100n);
    return b;
  })(),
  (() => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(250n);
    return b;
  })(),
  (() => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(300n);
    return b;
  })(),
  Buffer.from([3]),
]);
const dataHex = data.toString("hex");

console.log("\nData hex:", dataHex, `(${data.length} bytes)`);

// Use solana CLI to craft and send
const cmd = `solana --url ${RPC} transfer --allow-unfunded-recipient --with-compute-unit-price 100000 --signer ${SIGNER} --fee-payer ${pubkey} ${wallet.publicKey.toBase58()} 0 --program-id ${PROGRAM_ID} 2>&1`;

console.log("\nTrying to use solana CLI ...");
try {
  const out = execSync(cmd, {
    encoding: "utf-8",
    timeout: 60000,
    env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "" },
  });
  console.log("Result:", out);
} catch (e) {
  console.log("Stderr:", e.stderr?.toString() || e.message);
  console.log("Stdout:", e.stdout?.toString() || "");
}
