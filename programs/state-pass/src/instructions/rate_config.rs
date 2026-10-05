use anchor_lang::prelude::*;
use crate::state::RateConfig;
use crate::constants::{RATE_CONFIG_SEED};
use crate::error::StatePassError;

/// Initialize the singleton RateConfig account.
/// Stores the deployer (signer) as the authority who can update rates.
pub fn handler_initialize_rate_config(
    ctx: Context<InitializeRateConfig>,
    level1_rate: u64,
    level2_rate: u64,
    level3_rate: u64,
    max_level: u8,
) -> Result<()> {
    let config = &mut ctx.accounts.rate_config;
    config.authority = ctx.accounts.signer.key();
    config.level1_rate = level1_rate;
    config.level2_rate = level2_rate;
    config.level3_rate = level3_rate;
    config.max_level = max_level;

    msg!(
        "RateConfig initialized: l1={}, l2={}, l3={}, max_level={}",
        level1_rate, level2_rate, level3_rate, max_level
    );
    Ok(())
}

/// Update the rate for a specific level.
/// Only the authority (the original deployer) can call this.
pub fn handler_set_rate(
    ctx: Context<SetRate>,
    level: u8,
    new_rate: u64,
) -> Result<()> {
    let config = &mut ctx.accounts.rate_config;

    require!(
        ctx.accounts.signer.key() == config.authority,
        StatePassError::UnauthorizedRateConfigUpdate
    );
    require!(
        level >= 1 && level <= config.max_level,
        StatePassError::InvalidLevel
    );

    match level {
        1 => config.level1_rate = new_rate,
        2 => config.level2_rate = new_rate,
        3 => config.level3_rate = new_rate,
        _ => return Err(StatePassError::InvalidLevel.into()),
    }

    msg!("Rate for level {} set to {}", level, new_rate);
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeRateConfig<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = 8 + RateConfig::INIT_SPACE,
        seeds = [RATE_CONFIG_SEED],
        bump,
    )]
    pub rate_config: Account<'info, RateConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetRate<'info> {
    #[account(
        mut,
        constraint = signer.key() == rate_config.authority @ StatePassError::UnauthorizedRateConfigUpdate
    )]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [RATE_CONFIG_SEED],
        bump,
    )]
    pub rate_config: Account<'info, RateConfig>,
}
