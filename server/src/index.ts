// StatePass × x402 server — reads dNFT level → applies RateConfig pricing → x402 payment
import express from "express";
import path from "path";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getTokenMetadata,
} from "@solana/spl-token";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ──
const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const USDC_MINT = new PublicKey(
  process.env.USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);
const RECIPIENT_WALLET = new PublicKey(
  process.env.RECIPIENT_WALLET || "seFkxFkXEY9JGEpCyPfCWTuPZG9WK6ucf95zvKCfsRX",
);
const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID || "21xpRqRTFk7N7ybdPA2RyTmRqQB9FH4Xerty9jeTU1Dx",
);
const PORT = parseInt(process.env.PORT || "3001", 10);

const connection = new Connection(RPC_URL, "confirmed");

// ── PDA seeds ──
const RATE_CONFIG_SEED = Buffer.from("rate_config");
const NFT_AUTHORITY_SEED = Buffer.from("nft_authority");

function findPda(seeds: Buffer[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
}

const rateConfigPDA = findPda([RATE_CONFIG_SEED]);
const nftAuthorityPDA = findPda([NFT_AUTHORITY_SEED]);

// ── Deserialize RateConfig account ──
// Anchor account layout: 8-byte discriminator + fields
// RateConfig { authority: Pubkey(32), level1_rate: u64(8), level2_rate: u64(8), level3_rate: u64(8), max_level: u8(1) }
const RATE_CONFIG_DISCRIMINATOR = Buffer.from("65c237a1afd41243", "hex"); // anchor discriminator for "rate_config"
const RATE_CONFIG_ACCOUNT_SIZE = 8 + 32 + 8 + 8 + 8 + 1; // 65

interface RateConfigData {
  authority: PublicKey;
  level1Rate: number;
  level2Rate: number;
  level3Rate: number;
  maxLevel: number;
}

function deserializeRateConfig(data: Buffer): RateConfigData {
  if (data.length < RATE_CONFIG_ACCOUNT_SIZE) {
    throw new Error(`Invalid RateConfig data length: ${data.length}`);
  }
  let offset = 8; // skip discriminator
  const authority = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const level1Rate = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const level2Rate = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const level3Rate = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const maxLevel = data.readUint8(offset);
  return { authority, level1Rate, level2Rate, level3Rate, maxLevel };
}

// ── Price lookup ──
async function getLevelFromMint(mint: PublicKey): Promise<number> {
  try {
    const metadata = await getTokenMetadata(connection, mint);
    if (!metadata) return 1;
    const meta = metadata as any;
    const levelEntry = meta.additionalMetadata?.find(
      ([key]: string[]) => key === "level",
    );
    return levelEntry ? parseInt(levelEntry[1], 10) : 1;
  } catch {
    return 1;
  }
}

async function getRateForLevel(level: number): Promise<number> {
  try {
    const accountInfo = await connection.getAccountInfo(rateConfigPDA);
    if (accountInfo && accountInfo.data.length >= RATE_CONFIG_ACCOUNT_SIZE) {
      const config = deserializeRateConfig(accountInfo.data);
      if (level > config.maxLevel) level = config.maxLevel;
      switch (level) {
        case 1: return config.level1Rate;
        case 2: return config.level2Rate;
        case 3: return config.level3Rate;
        default: return config.level3Rate;
      }
    }
  } catch {
    // fall through to defaults
  }
  // Fallback hardcoded rates (should match RateConfig values)
  switch (level) {
    case 1: return 100;
    case 2: return 250;
    case 3: return 300;
    default: return 100;
  }
}

// ── x402 helpers ──
const RECIPIENT_TOKEN_ACCOUNT = await getAssociatedTokenAddress(
  USDC_MINT,
  RECIPIENT_WALLET,
);

async function verifyNftOwnership(mint: PublicKey, feePayer: PublicKey): Promise<boolean> {
  try {
    // Get all token accounts for this mint owned by feePayer
    const tokenAccounts = await connection.getTokenAccountsByOwner(feePayer, {
      mint,
    });
    for (const { account } of tokenAccounts.value) {
      if (account.data.length >= 165) {
        const amount = Number(account.data.readBigUInt64LE(64));
        if (amount > 0) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

// ── Express app ──
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.resolve(__dirname, "../public")));

app.get("/premium", async (req: any, res: any) => {
  const mintStr = req.query.mint as string;
  if (!mintStr) {
    return res.status(400).json({ error: "Missing 'mint' query param (StatePass dNFT address)" });
  }

  let mint: PublicKey;
  try {
    mint = new PublicKey(mintStr);
  } catch {
    return res.status(400).json({ error: "Invalid mint public key" });
  }

  const level = await getLevelFromMint(mint);
  const price = await getRateForLevel(level);

  const xPaymentHeader = req.header("X-Payment");

  if (xPaymentHeader) {
    try {
      const paymentData = JSON.parse(
        Buffer.from(xPaymentHeader, "base64").toString("utf-8"),
      ) as {
        x402Version: number;
        scheme: string;
        network: string;
        payload: { serializedTransaction: string };
      };

      const txBuffer = Buffer.from(
        paymentData.payload.serializedTransaction,
        "base64",
      );
      const tx = Transaction.from(txBuffer);

      // Verify the fee payer owns this dNFT
      if (!tx.feePayer) {
        return res.status(402).json({ error: "Transaction must have a fee payer" });
      }
      const isOwner = await verifyNftOwnership(mint, tx.feePayer);
      if (!isOwner) {
        return res.status(402).json({
          error: "You must own this StatePass dNFT to pay with it",
          details: `feePayer ${tx.feePayer.toBase58()} does not own ${mintStr}`,
        });
      }

      // Verify USDC transfer to recipient
      let validTransfer = false;
      let transferAmount = 0;
      for (const ix of tx.instructions) {
        if (ix.programId.equals(TOKEN_PROGRAM_ID)) {
          if (ix.data.length >= 9 && ix.data[0] === 3) {
            transferAmount = Number(ix.data.readBigUInt64LE(1));
            const destAccount = ix.keys[1]?.pubkey;
            if (
              destAccount &&
              destAccount.equals(RECIPIENT_TOKEN_ACCOUNT) &&
              transferAmount >= price
            ) {
              validTransfer = true;
              break;
            }
          }
        }
      }

      if (!validTransfer) {
        return res.status(402).json({
          error: "Invalid payment: wrong recipient, amount, or no transfer found",
          details: transferAmount > 0
            ? `Found ${transferAmount}, expected at least ${price}`
            : "No valid token transfer",
        });
      }

      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err) {
        return res.status(402).json({
          error: "Transaction simulation failed",
          details: sim.value.err,
          logs: sim.value.logs,
        });
      }

      const signature = await connection.sendRawTransaction(txBuffer, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      await connection.confirmTransaction(signature, "confirmed");

      const explorerUrl = RPC_URL.includes("devnet")
        ? `https://explorer.solana.com/tx/${signature}?cluster=devnet`
        : `https://explorer.solana.com/tx/${signature}`;

      console.log(`✅ Payment verified: level=${level}, price=${price}, tx=${signature}`);

      return res.json({
        data: `Premium content unlocked! Your StatePass (level ${level}) granted access at ${price / 1_000_000} USDC/request.`,
        level,
        paymentDetails: {
          signature,
          amount: transferAmount,
          amountUSDC: transferAmount / 1_000_000,
          recipient: RECIPIENT_TOKEN_ACCOUNT.toBase58(),
          explorerUrl,
        },
      });
    } catch (e: any) {
      console.error("Payment verification error:", e);
      return res.status(402).json({
        error: "Payment verification failed",
        details: e.message,
      });
    }
  }

  // No payment → return 402 quote
  console.log(`Quote: mint=${mintStr}, level=${level}, price=${price}`);
  return res.status(402).json({
    payment: {
      recipientWallet: RECIPIENT_WALLET.toBase58(),
      tokenAccount: RECIPIENT_TOKEN_ACCOUNT.toBase58(),
      mint: USDC_MINT.toBase58(),
      amount: price,
      amountUSDC: price / 1_000_000,
      cluster: RPC_URL.includes("devnet") ? "devnet" : "mainnet-beta",
      level,
      message: `Send ${price / 1_000_000} USDC (level ${level} rate) to access premium content`,
    },
  });
});

app.get("/status", async (_req: any, res: any) => {
  let rateConfig: any = null;
  try {
    const accountInfo = await connection.getAccountInfo(rateConfigPDA);
    if (accountInfo) {
      const config = deserializeRateConfig(accountInfo.data);
      rateConfig = {
        authority: config.authority.toBase58(),
        level1Rate: config.level1Rate,
        level2Rate: config.level2Rate,
        level3Rate: config.level3Rate,
        maxLevel: config.maxLevel,
      };
    } else {
      rateConfig = "NOT_FOUND";
    }
  } catch {
    rateConfig = "NOT_FOUND";
  }

  res.json({
    programId: PROGRAM_ID.toBase58(),
    usdcMint: USDC_MINT.toBase58(),
    recipientWallet: RECIPIENT_WALLET.toBase58(),
    recipientTokenAccount: RECIPIENT_TOKEN_ACCOUNT.toBase58(),
    nftAuthorityPDA: nftAuthorityPDA.toBase58(),
    rateConfigPDA: rateConfigPDA.toBase58(),
    rateConfig,
    rpcUrl: RPC_URL,
  });
});

// ── Devnet USDC Faucet ──
app.get("/api/faucet/usdc", async (req: any, res: any) => {
  const walletStr = req.query.wallet as string;
  if (!walletStr) {
    return res.status(400).json({ error: "Missing 'wallet' query param" });
  }
  try {
    new PublicKey(walletStr);
  } catch {
    return res.status(400).json({ error: "Invalid wallet public key" });
  }

  try {
    const { execSync } = await import("child_process");
    const result = execSync(
      `spl-token faucet ${USDC_MINT.toBase58()} ${walletStr} 2>&1`,
      { timeout: 30000, env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "" } }
    ).toString().trim();

    res.json({ success: true, message: result });
  } catch (e: any) {
    console.error("USDC faucet error:", e);
    res.status(400).json({
      error: "Devnet USDC faucet failed — try manually",
      hint: `spl-token faucet ${USDC_MINT.toBase58()} ${walletStr}`,
      details: e.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🏁 StatePass × x402 server listening on :${PORT}`);
  console.log(`   Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`   RateConfig PDA: ${rateConfigPDA.toBase58()}`);
});
