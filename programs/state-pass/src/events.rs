use anchor_lang::prelude::*;

/// Event emitted when a new StatePass NFT is successfully minted.
#[event]
pub struct NftMinted {
    /// The public key of the new NFT Mint account.
    pub nft_mint: Pubkey,
    /// The public key of the recipient (the signer/owner).
    pub recipient: Pubkey,
}

/// Event emitted when the NFT's metadata fields (like level or URI) are updated.
#[event]
pub struct NftMetadataUpdated {
    /// The public key of the updated NFT Mint account.
    pub nft_mint: Pubkey,
    /// The field key that was updated (e.g., "level" or "uri").
    pub field: String,
    /// The new value of the field.
    pub value: String,
}
