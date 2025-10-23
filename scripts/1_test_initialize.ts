import {
  createSolanaClient,
  createTransaction,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  getExplorerLink,
} from "gill";
import { loadKeypairSignerFromFile } from "gill/node";
import * as dotenv from "dotenv";
import path from "path";
import { getInitializeInstruction } from "../clients/ts/state_pass/instructions/initialize.js";
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
  console.log("Signer loaded:", signer.address);

  // ⚙️ 创建 instruction
  console.log("Creating instruction...");
  const initializeInstruction =
    getInitializeInstruction<typeof STATE_PASS_PROGRAM_ADDRESS>();

  // 🧱 创建交易
  const txMessage = createTransaction({
    feePayer: signer,
    latestBlockhash: latestBlockhash,
    instructions: [initializeInstruction],
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
 * state-pass on  main [!?] via 🦀 1.90.0 took 3.3s
➜ source .env

state-pass on  main [!?] via 🦀 1.90.0
➜ bun scripts/1_test_initialize.ts
[dotenv@17.2.3] injecting env (0) from .env -- tip: ⚙️  override existing env vars with { override: true }
homeDir /Users/qiaopengjun
devnet
https://devnet.helius-rpc.com/?api-key=5f3eaea5-07fc-461f-b5f3-caaa53f34e8c
/Users/qiaopengjun/.config/solana/id.json
Using cluster: devnet
RPC URL: https://devnet.helius-rpc.com/?api-key=5f3eaea5-07fc-461f-b5f3-caaa53f34e8c
Wallet path: /Users/qiaopengjun/.config/solana/id.json
slot:  416268787n
latestBlockhash:  {
  blockhash: "DDSytVQKET3Seer7EDjDiz2QhHE8uVULKKDqjKt94KYN",
  lastValidBlockHeight: 404203970n,
}
Signer loaded: 6MZDRo5v8K2NfdohdD76QNpSgk3GH3Aup53BeMaRAEpd
Creating instruction...
signature: 32396933544739374d4873485a73353232344663733570634d6b6b383834676a4b514d5876556d526e484b7670546937716169334b42486151446954794a424e6e7a747a36334c336f5777794b47624b3769654d756a6e6a
Explorer: https://explorer.solana.com/tx/29i3TG97MHsHZs5224Fcs5pcMkk884gjKQMXvUmRnHKvpTi7qai3KBHaQDiTyJBNnztz63L3oWwyKGbK7ieMujnj?cluster=devnet
Transaction confirmed

https://solscan.io/tx/29i3TG97MHsHZs5224Fcs5pcMkk884gjKQMXvUmRnHKvpTi7qai3KBHaQDiTyJBNnztz63L3oWwyKGbK7ieMujnj?cluster=devnet


state-pass on  main [!?] via 🦀 1.90.0 took 4.9s
➜ bun scripts/1_test_initialize.ts
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🔑 add access controls to secrets: https://dotenvx.com/ops
homeDir /Users/qiaopengjun
devnet
https://devnet.helius-rpc.com/?api-key=5f3eaea5-07fc-461f-b5f3-caaa53f34e8c
/Users/qiaopengjun/.config/solana/id.json
Using cluster: devnet
RPC URL: https://devnet.helius-rpc.com/?api-key=5f3eaea5-07fc-461f-b5f3-caaa53f34e8c
Wallet path: /Users/qiaopengjun/.config/solana/id.json
slot:  416269779n
latestBlockhash:  {
  blockhash: "5LnnFSDth42qut1o31F3dTaN47wn6KztbYPskXcHdPvy",
  lastValidBlockHeight: 404204961n,
}
Signer loaded: 6MZDRo5v8K2NfdohdD76QNpSgk3GH3Aup53BeMaRAEpd
Creating instruction...
signature: 347637424b6f7248734c4254715374335339546636746758434a5a76424c75417a4d4868667a505039673243517338346e5175514e38654e6e696739356748533236674845694a38793246394c41434a315869715470686f
Explorer: https://explorer.solana.com/tx/4v7BKorHsLBTqSt3S9Tf6tgXCJZvBLuAzMHhfzPP9g2CQs84nQuQN8eNnig95gHS26gHEiJ8y2F9LACJ1XiqTpho?cluster=devnet
Transaction confirmed
✅ Transaction successfully confirmed!
🔗 Explorer: https://explorer.solana.com/tx/4v7BKorHsLBTqSt3S9Tf6tgXCJZvBLuAzMHhfzPP9g2CQs84nQuQN8eNnig95gHS26gHEiJ8y2F9LACJ1XiqTpho?cluster=devnet
 */
