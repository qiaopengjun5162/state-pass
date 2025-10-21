use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::{
    token_2022::Token2022,
    token_interface::spl_token_metadata_interface::{self, state::Field},
};

use crate::constants;
use crate::events::NftMetadataUpdated;
use crate::state::NftAuthority;

/// 后端服务调用此指令，用于将 NFT 升级到新的等级。
/// 签名者必须是 NFT Authority PDA。
pub fn handler_update_pass_level(
    ctx: Context<UpdatePassLevel>,
    new_level: u8,
    new_uri: String, // 新等级对应的元数据 URI (如: level2.json)
) -> Result<()> {
    // 1. 准备 PDA 签名
    let seeds = &[constants::NFT_AUTHORITY_SEED, &[ctx.bumps.nft_authority]];
    let signer_seeds: &[&[&[u8]]] = &[&seeds[..]];

    let new_level_str = new_level.to_string();

    msg!(
        "Upgrading NFT {} to Level {} with URI: {}",
        ctx.accounts.mint.key(),
        new_level_str,
        new_uri
    );

    // --- 2. 更新自定义字段: level ---
    // 这是 StatePass 的核心状态变化，记录 NFT 的当前等级。
    invoke_signed(
        &spl_token_metadata_interface::instruction::update_field(
            &Token2022::id(),
            ctx.accounts.mint.key,
            ctx.accounts.nft_authority.to_account_info().key, // 必须是 Update Authority
            Field::Key(constants::NFT_METADATA_FIELD_LEVEL.to_string()),
            new_level_str.clone(),
        ),
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.nft_authority.to_account_info(),
        ],
        signer_seeds,
    )?;

    // --- 3. 更新 URI 字段 ---
    // 这一步改变了 NFT 的视觉外观和描述，实现“升级”效果。
    invoke_signed(
        &spl_token_metadata_interface::instruction::update_field(
            &Token2022::id(),
            ctx.accounts.mint.key,
            ctx.accounts.nft_authority.to_account_info().key, // 必须是 Update Authority
            Field::Uri,                                       // 使用预定义的 Field::Uri
            new_uri,
        ),
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.nft_authority.to_account_info(),
        ],
        signer_seeds,
    )?;

    // --- 4. 触发事件 ---
    emit!(NftMetadataUpdated {
        nft_mint: ctx.accounts.mint.key(),
        field: constants::NFT_METADATA_FIELD_LEVEL.to_string(),
        value: new_level_str,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(new_level: u8, new_uri: String)]
pub struct UpdatePassLevel<'info> {
    // 必须传入要升级的 Mint 账户，它存储了 Metadata
    // Mint 账户必须是可变的 (mut)
    #[account(mut)]
    /// CHECK: Token-2022 Mint 账户，包含了元数据
    pub mint: AccountInfo<'info>,

    // 权限 PDA，必须是 Signer 才能签署 CPI 调用
    #[account(
        seeds = [constants::NFT_AUTHORITY_SEED],
        bump
    )]
    pub nft_authority: Account<'info, NftAuthority>,

    // 必要的程序
    pub token_program: Program<'info, Token2022>,
}
