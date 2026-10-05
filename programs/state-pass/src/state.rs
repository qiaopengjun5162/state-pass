use anchor_lang::prelude::*;

/// PDA that holds NFT mint/update authority for all StatePass NFTs
#[account]
#[derive(InitSpace)]
pub struct NftAuthority {}

/// On-chain rate config: maps level → API call price (in lamports / custom token amount)
/// Stored as a singleton PDA derived from [CONFIG_SEED]
#[account]
#[derive(InitSpace, Debug)]
pub struct RateConfig {
    /// Authority that can update rates (should match nft_authority PDA)
    pub authority: Pubkey,
    /// Price per API request for each level (in smallest token unit)
    pub level1_rate: u64,
    pub level2_rate: u64,
    pub level3_rate: u64,
    /// Upper bound for valid levels
    pub max_level: u8,
}
