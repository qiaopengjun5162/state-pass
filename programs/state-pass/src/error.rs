use anchor_lang::prelude::*;

/// 定义程序特有的错误代码
#[error_code]
pub enum StatePassError {
    #[msg("The provided level is invalid or the maximum level has been reached.")]
    InvalidLevel,
    #[msg("Rate config already initialized.")]
    RateConfigAlreadyInitialized,
    #[msg("Rate config not initialized. Call initialize_rate_config first.")]
    RateConfigNotInitialized,
    #[msg("Only rate config authority can perform this action.")]
    UnauthorizedRateConfigUpdate,
}
