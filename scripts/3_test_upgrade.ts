import {
  createSolanaClient,
  createTransaction,
  getExplorerLink,
  getSignatureFromTransaction,
  signTransactionMessageWithSigners,
  address,
} from "gill";
import { loadKeypairSignerFromFile } from "gill/node";

import * as dotenv from "dotenv";
import path from "path";
import { PublicKey } from "@solana/web3.js";
import { STATE_PASS_PROGRAM_ADDRESS } from "../clients/ts/state_pass/programs/statePass.js";
import { getUpdatePassLevelInstruction } from "../clients/ts/state_pass/instructions/updatePassLevel.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

dotenv.config();

// 1️⃣ 环境配置
const homeDir = process.env.HOME;
if (!homeDir) {
  throw new Error("HOME environment variable is not set.");
}

const CONFIG = {
  cluster: process.env.CLUSTER_NAME || "devnet",
  rpcUrl: process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com",
  walletPath:
    process.env.ANCHOR_WALLET || path.join(homeDir, ".config/solana/id.json"),
};

// 🚨🚨🚨 将您刚才铸造的 NFT Mint 地址粘贴到这里 🚨🚨🚨
// 运行 'bun run scripts/2_test_mint.ts' 成功后，控制台输出的 'mintSigner (new NFT address)' 就是它。
const NFT_MINT_ADDRESS = "8ECebrEHQSeyNXtpz6EcNECE2HFKp6DH66sLu4mfhPfB";
// 👆👆👆 替换成您自己的 Mint 地址 👆👆👆

// 2️⃣ 创建 Solana 客户端
const { rpc, sendAndConfirmTransaction } = createSolanaClient({
  urlOrMoniker: CONFIG.rpcUrl,
});

// 3️⃣ 主逻辑
const main = async () => {
  console.log("Starting NFT upgrade process...");

  // 获取最新区块哈希
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  console.log("latestBlockhash:", latestBlockhash.blockhash);

  // 加载签名者 (Payer)
  const signer = await loadKeypairSignerFromFile(CONFIG.walletPath);
  console.log("Payer loaded:", signer.address);

  // -----------------------------------------------------------------
  // 🛠️ 关键步骤 1: 推导 NFT Authority PDA
  // -----------------------------------------------------------------
  const [nftAuthorityAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("nft_authority")],
    new PublicKey(STATE_PASS_PROGRAM_ADDRESS),
  );
  console.log(`🔑 NFT Authority PDA: ${nftAuthorityAddress.toBase58()}`);

  // -----------------------------------------------------------------
  // 🛠️ 关键步骤 2: 定义新的等级和 URI
  // -----------------------------------------------------------------
  // 👇👇👇 从 Level 2 升级到 Level 3 👇👇👇
  const newLevel = 4;
  const newUri =
    "https://gist.githubusercontent.com/qiaopengjun5162/738dbcc2ef355770fcd3891eb556dca7/raw/b0057d1ef210bb23891791813465c8b245efd262/gistfile1.txt";
  // 👆👆👆 新 URI 指向 Level 3 的元数据 👆👆👆

  // -----------------------------------------------------------------
  // ⚙️ 关键步骤 3: 创建 update_pass_level instruction
  // -----------------------------------------------------------------
  console.log(
    `Creating instruction to upgrade Mint: ${NFT_MINT_ADDRESS} to Level ${newLevel}...`,
  );

  // 注意：nftAuthority 账户在指令中不需要作为 Signer<T> 传入，
  // 因为 Anchor 会在 Rust 程序中用 PDA seeds 来签名。
  const upgradeIx = getUpdatePassLevelInstruction(
    {
      mint: NFT_MINT_ADDRESS,
      nftAuthority: nftAuthorityAddress.toBase58(),
      tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
      newLevel: newLevel,
      newUri: newUri,
    },
    { programAddress: STATE_PASS_PROGRAM_ADDRESS },
  );

  // 🧱 创建交易
  const txMessage = createTransaction({
    feePayer: signer, // 费用由 Payer 支付
    latestBlockhash: latestBlockhash,
    instructions: [upgradeIx],
    version: "legacy",
  });

  // 签署交易 (只需要 Payer 签名)
  const signedTransaction = await signTransactionMessageWithSigners(txMessage, [
    signer,
  ]);

  const signature = getSignatureFromTransaction(signedTransaction);
  console.log("signature:", Buffer.from(signature).toString("hex"));

  try {
    await sendAndConfirmTransaction(signedTransaction);
    console.log("Transaction confirmed");
    console.log(`✅ NFT successfully upgraded to Level ${newLevel}!`);
    console.log(
      `🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=${CONFIG.cluster}`,
    );
    console.log(
      `🔎 检查 NFT: https://explorer.solana.com/address/${NFT_MINT_ADDRESS}/token-metadata?cluster=${CONFIG.cluster}`,
    );
  } catch (err) {
    console.error("❌ sendAndConfirmTransaction failed:", err);
    console.log(
      "\n请确保 NFT_MINT_ADDRESS 填写正确，且目标等级高于当前等级。 再次执行",
    );
  }
};

main().catch((err) => {
  console.error("Unhandled error:", err);
});
