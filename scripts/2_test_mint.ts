import {
  createSolanaClient,
  createTransaction,
  getExplorerLink,
  getSignatureFromTransaction,
  signTransactionMessageWithSigners,
  generateKeyPairSigner,
  address,
} from "gill";
import { loadKeypairSignerFromFile } from "gill/node";
import * as dotenv from "dotenv";
import path from "path";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  PublicKey,
} from "@solana/web3.js";
import {
  getMintNftInstruction,
  getMintNftInstructionAsync,
} from "../clients/ts/state_pass/instructions/mintNft.js";
import { STATE_PASS_PROGRAM_ADDRESS } from "../clients/ts/state_pass/programs/statePass.js";

dotenv.config();

// 1️⃣ 环境配置
const homeDir = process.env.HOME;
console.log("homeDir", homeDir);

if (!homeDir) {
  throw new Error("HOME environment variable is not set.");
}

console.log(process.env.CLUSTER_NAME);
console.log(process.env.DEVNET_RPC_URL);
console.log(process.env.ANCHOR_WALLET);

const CONFIG = {
  cluster: process.env.CLUSTER_NAME || "devnet",
  rpcUrl: process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com",
  walletPath:
    process.env.ANCHOR_WALLET || path.join(homeDir, ".config/solana/id.json"),
};

// 2️⃣ 创建 Solana 客户端
const { rpc, rpcSubscriptions, sendAndConfirmTransaction } = createSolanaClient(
  {
    urlOrMoniker: CONFIG.rpcUrl,
  },
);

// 3️⃣ 主逻辑
const main = async () => {
  console.log("Using cluster:", CONFIG.cluster);
  console.log("RPC URL:", CONFIG.rpcUrl);
  console.log("Wallet path:", CONFIG.walletPath);

  // get slot
  const slot = await rpc.getSlot().send();
  console.log("slot: ", slot);

  // 获取最新区块哈希
  // get the latest blockhash
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  console.log("latestBlockhash: ", latestBlockhash);

  // 加载签名者
  const signer = await loadKeypairSignerFromFile(CONFIG.walletPath);
  console.log("payer loaded:", signer.address);

  const mintSigner = await generateKeyPairSigner();
  console.log("mintSigner (new NFT address):", mintSigner.address);

  const mintPubkey = new PublicKey(mintSigner.address);
  const ownerPubkey = new PublicKey(signer.address);

  const tokenAccount = await getAssociatedTokenAddress(
    mintPubkey, // mint
    ownerPubkey, // owner
    false, // allowOwnerOffCurve
    TOKEN_2022_PROGRAM_ID, // 使用标准 token program 即可
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  console.log("✅ ATA 地址:", tokenAccount.toBase58());

  const metadata = {
    name: "StatePass",
    symbol: "SP",
    uri: "https://gist.githubusercontent.com/qiaopengjun5162/fd21cf39950b885371279ee3ea591cf9/raw/meta.json",
  };

  // 手动推导 metadata / master edition PDA
  const [metadataAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_2022_PROGRAM_ID.toBuffer(),
      mintPubkey.toBuffer(),
    ],
    TOKEN_2022_PROGRAM_ID,
  );

  const [masterEditionAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_2022_PROGRAM_ID.toBuffer(),
      mintPubkey.toBuffer(),
      Buffer.from("edition"),
    ],
    TOKEN_2022_PROGRAM_ID,
  );
  const [nftAuthorityAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("nft_authority")],
    new PublicKey(STATE_PASS_PROGRAM_ADDRESS),
  );
  console.log(`🔑 NFT Authority PDA: ${nftAuthorityAddress.toBase58()}`);

  // ⚙️ 创建 instruction
  console.log("Creating instruction...");
  const mintIx = await getMintNftInstructionAsync(
    {
      signer,
      mint: mintSigner,
      tokenAccount: tokenAccount.toBase58(),

      // 显式传入 PDA (关键修复)
      nftAuthority: nftAuthorityAddress.toBase58(),

      // 显式传入 Program Accounts 和 Sysvars
      systemProgram: SystemProgram.programId.toBase58(),
      tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
      rent: SYSVAR_RENT_PUBKEY.toBase58(),

      // Args
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
    },
    { programAddress: STATE_PASS_PROGRAM_ADDRESS },
  );

  // 🧱 创建交易
  const txMessage = createTransaction({
    feePayer: signer,
    latestBlockhash: latestBlockhash,
    instructions: [mintIx],
    version: "legacy",
  });

  // 使用消息化签名 API 签名（会从 txMessage 的 account metas 中取 signer）
  const signedTransaction = await signTransactionMessageWithSigners(txMessage); // FullySignedTransaction 类型

  const signature = getSignatureFromTransaction(signedTransaction);
  console.log("signature:", Buffer.from(signature).toString("hex"));
  console.log(
    "Explorer:",
    getExplorerLink({
      cluster: "devnet",
      transaction: getSignatureFromTransaction(signedTransaction),
    }),
  );
  try {
    await sendAndConfirmTransaction(signedTransaction);
    console.log("Transaction confirmed");
    console.log("✅ Transaction successfully confirmed!");
    console.log(
      `🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=${CONFIG.cluster}`,
    );
  } catch (err) {
    console.error("❌ sendAndConfirmTransaction failed:", err);
  }
};

main().catch((err) => {
  console.error("Unhandled error:", err);
});

/**
 *
state-pass on  main [!?] via 🦀 1.90.0 took 3.1s
➜ bun run scripts/2_test_mint.ts

bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild
homeDir /Users/qiaopengjun
devnet
https://devnet.helius-rpc.com/?api-key=5f3eaea5-07fc-461f-b5f3-caaa53f34e8c
/Users/qiaopengjun/.config/solana/id.json
Using cluster: devnet
RPC URL: https://devnet.helius-rpc.com/?api-key=5f3eaea5-07fc-461f-b5f3-caaa53f34e8c
Wallet path: /Users/qiaopengjun/.config/solana/id.json
slot:  416485078n
latestBlockhash:  {
  blockhash: "CMsix5EEEYe8ZQJ2DMLaW1c6dCGGSXjVLGggfpkVj583",
  lastValidBlockHeight: 404420143n,
}
payer loaded: 6MZDRo5v8K2NfdohdD76QNpSgk3GH3Aup53BeMaRAEpd
mintSigner (new NFT address): 8ECebrEHQSeyNXtpz6EcNECE2HFKp6DH66sLu4mfhPfB
✅ ATA 地址: 44QrDgu2pJjaRyFnKvXrgto6zQo9zCtMdo3U9rUpw395
🔑 NFT Authority PDA: A6qYWubSGTWqXz68rtwL2fWcAJPfLAiTdWKosUBUac4B
Creating instruction...
signature: 34556938396f7354676868657068373536325045696d55684556595977736b67696e4d714a6a5a5162623457453737676f4c6852516f526548784a4358453677374872454d6351753645327a7966524c4d5a446a74584d76
Explorer: https://explorer.solana.com/tx/4Ui89osTghheph7562PEimUhEVYYwskginMqJjZQbb4WE77goLhRQoReHxJCXE6w7HrEMcQu6E2zyfRLMZDjtXMv?cluster=devnet
Transaction confirmed
✅ Transaction successfully confirmed!
🔗 Explorer: https://explorer.solana.com/tx/4Ui89osTghheph7562PEimUhEVYYwskginMqJjZQbb4WE77goLhRQoReHxJCXE6w7HrEMcQu6E2zyfRLMZDjtXMv?cluster=devnet
 */
