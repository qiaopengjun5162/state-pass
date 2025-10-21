use anchor_lang::prelude::*;

/// 定义程序特有的错误代码
#[error_code]
pub enum StatePassError {
    #[msg("The provided level is invalid or the maximum level has been reached.")]
    InvalidLevel,
    // 您可以在这里添加更多可能需要的错误，例如：
    // #[msg("The NFT is currently frozen and cannot be updated.")]
    // NftIsFrozen,
}
