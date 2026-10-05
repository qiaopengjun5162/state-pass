/// PDA seed for the NFT Authority, which holds mint/update authority.
/// (用于签署 Mint 和 Metadata 更新的 PDA 种子)
pub const NFT_AUTHORITY_SEED: &[u8] = b"nft_authority";

/// Custom metadata field key used to store the NFT's current level.
/// (Metadata 中的自定义字段，用于存储 NFT 等级)
pub const NFT_METADATA_FIELD_LEVEL: &str = "level";

/// PDA seed for the global Rate Config account.
/// (全局费率配置账户的 PDA 种子)
pub const RATE_CONFIG_SEED: &[u8] = b"rate_config";
