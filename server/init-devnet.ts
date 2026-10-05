import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { readFileSync } from "fs";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("21xpRqRTFk7N7ybdPA2RyTmRqQB9FH4Xerty9jeTU1Dx");
const connection = new Connection(RPC, "confirmed");

const keypairData = JSON.parse(readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8"));
const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));

// PDA derivation
const [nftAuthorityPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("nft_authority")],
  PROGRAM_ID,
);
const [rateConfigPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("rate_config")],
  PROGRAM_ID,
);

// initialize_rate_config discriminator: [226,214,218,141,79,210,61,30]
const IX_DISCRIMINATOR = Buffer.from([226, 214, 218, 141, 79, 210, 61, 30]);

async function main() {
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Program: ${PROGRAM_ID.toBase58()}`);
  console.log(`NFT Authority PDA: ${nftAuthorityPDA.toBase58()}`);
  console.log(`RateConfig PDA: ${rateConfigPDA.toBase58()}`);

  // Build instruction data: discriminator(8) + level1_rate(8) + level2_rate(8) + level3_rate(8) + max_level(1)
  const data = Buffer.concat([
    IX_DISCRIMINATOR,
    // level1: 100 (0.0001 USDC)
    (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(100n); return b; })(),
    // level2: 250 (0.00025 USDC)
    (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(250n); return b; })(),
    // level3: 300 (0.0003 USDC)
    (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(300n); return b; })(),
    // max_level: 3
    Buffer.from([3]),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: rateConfigPDA, isSigner: false, isWritable: true },
      { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // system_program
    ],
    data,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: wallet.publicKey, blockhash, lastValidBlockHeight });
  tx.add(ix);

  const sig = await connection.sendTransaction(tx, [wallet]);
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  console.log(`\n✅ RateConfig initialized on devnet!`);
  console.log(`   TX: ${sig}`);
  console.log(`   https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  console.log(`   RateConfig PDA: ${rateConfigPDA.toBase58()}`);
}

main().catch(console.error);
