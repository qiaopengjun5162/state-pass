#![allow(unexpected_cfgs, deprecated)]

use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

// 引入模块中的内容
use instructions::*;

declare_id!("21xpRqRTFk7N7ybdPA2RyTmRqQB9FH4Xerty9jeTU1Dx");

#[program]
pub mod state_pass {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler_initialize(ctx)
    }

    /// 铸造初始 StatePass NFT (Level 1)
    pub fn mint_nft(
        ctx: Context<MintNft>,
        name: String,
        symbol: String,
        uri: String, // Level 1 的元数据 URI
    ) -> Result<()> {
        instructions::mint_nft::handler_mint_nft(ctx, name, symbol, uri)
    }

    /// 后端服务调用此指令，用于将 NFT 升级到新的等级。
    /// 签名者必须是 NFT Authority PDA。
    pub fn update_pass_level(
        ctx: Context<UpdatePassLevel>,
        new_level: u8,
        new_uri: String, // 新等级对应的元数据 URI (如: level2.json)
    ) -> Result<()> {
        instructions::update_pass_level::handler_update_pass_level(ctx, new_level, new_uri)
    }

    /// 初始化全局费率配置（一次性设置，l1/l2/l3 对应的 API 单价）
    pub fn initialize_rate_config(
        ctx: Context<InitializeRateConfig>,
        level1_rate: u64,
        level2_rate: u64,
        level3_rate: u64,
        max_level: u8,
    ) -> Result<()> {
        instructions::rate_config::handler_initialize_rate_config(ctx, level1_rate, level2_rate, level3_rate, max_level)
    }

    /// 更新某个 level 的费率（仅 authority 可调用）
    pub fn set_rate(
        ctx: Context<SetRate>,
        level: u8,
        new_rate: u64,
    ) -> Result<()> {
        instructions::rate_config::handler_set_rate(ctx, level, new_rate)
    }
}
