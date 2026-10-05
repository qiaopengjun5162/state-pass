import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StatePass } from "../target/types/state_pass";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  getTokenMetadata,
  getMint,
} from "@solana/spl-token";

import { expect } from "chai";

// Program ID from lib.rs
const PROGRAM_ID = new anchor.web3.PublicKey(
  "21xpRqRTFk7N7ybdPA2RyTmRqQB9FH4Xerty9jeTU1Dx",
);

// 辅助函数：引入延迟
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("state-pass", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.statePass as Program<StatePass>;
  const connection = provider.connection;
  const signer = provider.wallet.publicKey; // The NFT receiver (Payer for the transaction)

  // Accounts required for the NFT
  const mint = anchor.web3.Keypair.generate();

  // nftAuthorityPDA 的地址派生
  const [nftAuthorityPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("nft_authority")],
    PROGRAM_ID,
  );

  // RateConfig PDA address
  const [rateConfigPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("rate_config")],
    PROGRAM_ID,
  );

  // 接收者关联代币账户 (ATA) 的地址派生
  const tokenAccount: anchor.web3.PublicKey = getAssociatedTokenAddressSync(
    mint.publicKey,
    signer,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  const initialName = "StatePass MVP";
  const initialSymbol = "SPASS";
  const initialUri = "https://example.com/metadata/level1.json";

  // 辅助函数：确保测试钱包有足够的 SOL
  const ensureAirdrop = async () => {
    const minBalance = 100_000_000; // 0.1 SOL
    const airdropAmount = 1_000_000_000; // 1 SOL

    const balance = await connection.getBalance(signer);
    if (balance < minBalance) {
      console.log("Not enough SOL balance. Requesting airdrop...");
      const airdropSignature = await connection.requestAirdrop(
        signer,
        airdropAmount,
      );
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature: airdropSignature,
      });
      console.log("Airdrop successful.");
    }
  };

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });

  it("1. Initializes the Program PDA (Initialize)", async () => {
    // 确保钱包有 SOL 支付 PDA 初始化费用
    await ensureAirdrop();

    try {
      const tx = await program.methods.initialize().accounts({}).rpc();
      console.log("Initialization TX:", tx);
    } catch (e) {
      // 这里的 initialize 是一个空的占位函数，即使出错也允许继续。
      // 我们主要依赖 MintNft 中的 init_if_needed 来创建 PDA。
    }
  });

  it("2. Mints the initial StatePass NFT (Level 1) and sets up authority", async () => {
    // 再次确保有足够的 SOL
    await ensureAirdrop();

    console.log("Mint Public Key:", mint.publicKey.toBase58());
    console.log("Token Account (ATA):", tokenAccount.toBase58());
    console.log("NFT Authority PDA:", nftAuthorityPDA.toBase58());

    const tx = await program.methods
      .mintNft(initialName, initialSymbol, initialUri)
      .accounts({
        signer: signer,
        mint: mint.publicKey,
        tokenAccount: tokenAccount,
        nftAuthority: nftAuthorityPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mint])
      .rpc();

    console.log("Mint NFT TX:", tx);

    // --- Assertions ---
    await sleep(500); // 暂停 500 毫秒

    // 1. Check Token Account (ATA) balance
    const ataAccount = await getAccount(
      connection,
      tokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );
    expect(ataAccount.amount.toString()).to.equal("1");
    expect(ataAccount.isInitialized).to.be.true;

    const tokenMint = await getMint(
      connection,
      mint.publicKey,
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );

    expect(tokenMint.decimals).to.equal(0, "NFTs must have 0 decimals.");

    const tokenMetadata = await getTokenMetadata(
      connection,
      mint.publicKey,
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );
    expect(tokenMetadata.name).to.equal(initialName);
    expect(tokenMetadata.uri).to.equal(initialUri);

    // Check custom field 'level'
    const levelEntry = tokenMetadata.additionalMetadata.find(
      ([key, _]) => key === "level",
    );
    expect(levelEntry).to.not.be.undefined;
    expect(levelEntry[1]).to.equal("1", "Initial level should be 1");

    console.log("✅ Minting test passed!");
  });

  it("3. Backend (via PDA) updates the StatePass to Level 2", async () => {
    await ensureAirdrop();

    const newLevel = 2;
    const newUri = "https://example.com/metadata/level2.json";

    const tx = await program.methods
      .updatePassLevel(newLevel, newUri)
      .accounts({
        mint: mint.publicKey,
        nftAuthority: nftAuthorityPDA,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc(); // PDA is a signer handled internally by Anchor/program

    console.log("Upgrade NFT TX:", tx);

    // --- Assertions ---

    // 1. Check Updated Metadata
    const updatedMetadata = await getTokenMetadata(connection, mint.publicKey); // 使用修正后的函数

    // Check custom field 'level' update
    const levelEntry = updatedMetadata.additionalMetadata.find(
      ([key, _]) => key === "level",
    );
    expect(levelEntry).to.not.be.undefined;
    expect(levelEntry[1], "NFT level should be updated to 2").to.equal(
      newLevel.toString(),
    );

    // Check URI update (visual change)
    expect(
      updatedMetadata.uri,
      "NFT URI should be updated to level2.json",
    ).to.equal(newUri);

    console.log("✅ Upgrade test passed! NFT is now Level 2.");

    // 引入重试机制以应对本地验证器同步延迟
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 1000;
    let logs = null;

    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        // 2. Check Events (optional but good practice)
        logs = await connection.getTransaction(tx, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0, // 确保兼容旧版本交易
        });

        console.log("Checking for expected events...");
        console.log("Logs:", logs);

        if (logs) {
          break; // 成功获取到日志，跳出循环
        }
      } catch (e) {
        // 忽略获取错误，继续重试
      }

      if (i < MAX_RETRIES - 1) {
        console.log(
          `Logs not yet available, retrying in ${RETRY_DELAY_MS}ms... (Attempt ${i + 1}/${MAX_RETRIES})`,
        );
        await sleep(RETRY_DELAY_MS);
      }
    }

    // 断言日志不为空，如果重试后仍为空则抛出清晰错误
    expect(
      logs,
      "Failed to fetch transaction logs after multiple retries. The transaction might not have been indexed by the validator in time.",
    ).to.not.be.null;

    // --- 使用 Anchor 事件解码器 ---

    // 1. 查找包含原始事件数据的 Program data log
    const eventDataLog = logs?.meta?.logMessages?.find((log) =>
      log.startsWith("Program data: "),
    );

    expect(
      eventDataLog,
      "Program data log (containing raw event) not found. This means the program did not emit the event correctly.",
    ).to.not.be.undefined;

    // 2. 提取 base64 编码的事件数据并解码
    const encodedData = eventDataLog.substring("Program data: ".length);
    const event = program.coder.events.decode(encodedData);

    // 3. 断言解码后的事件名称和数据
    expect(event.name, "Decoded event name is incorrect.").to.equal(
      "nftMetadataUpdated",
    );
    expect(event.data.field, "Decoded event field is incorrect.").to.equal(
      "level",
    );
    expect(
      event.data.value.toString(),
      "Decoded event value is incorrect.",
    ).to.equal(newLevel.toString());

    console.log(
      `✅ Event check passed! Decoded event: ${event.name}, Field: ${event.data.field}, Value: ${event.data.value}`,
    );
  });

  it("4. Initializes the global RateConfig", async () => {
    await ensureAirdrop();

    console.log("RateConfig PDA:", rateConfigPDA.toBase58());

    const level1Rate = new anchor.BN(100);
    const level2Rate = new anchor.BN(200);
    const level3Rate = new anchor.BN(300);
    const maxLevel = 3;

    const tx = await program.methods
      .initializeRateConfig(level1Rate, level2Rate, level3Rate, maxLevel)
      .accounts({
        signer: signer,
        rateConfig: rateConfigPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("initializeRateConfig TX:", tx);

    // Read back from chain
    await sleep(500);
    const configAccount = await program.account.rateConfig.fetch(rateConfigPDA);
    expect(configAccount.authority.toBase58()).to.equal(signer.toBase58());
    expect(configAccount.level1Rate.toString()).to.equal("100");
    expect(configAccount.level2Rate.toString()).to.equal("200");
    expect(configAccount.level3Rate.toString()).to.equal("300");
    expect(configAccount.maxLevel).to.equal(3);

    console.log("✅ RateConfig initialized!");
  });

  it("5. Updates a rate via setRate (authority only)", async () => {
    const newLevel2Rate = new anchor.BN(250);

    const tx = await program.methods
      .setRate(2, newLevel2Rate)
      .accounts({
        signer: signer,
        rateConfig: rateConfigPDA,
      })
      .rpc();

    console.log("setRate TX:", tx);

    await sleep(500);
    const configAccount = await program.account.rateConfig.fetch(rateConfigPDA);
    expect(configAccount.level2Rate.toString()).to.equal("250");

    console.log("✅ setRate test passed! Level 2 rate updated to 250.");
  });
});
