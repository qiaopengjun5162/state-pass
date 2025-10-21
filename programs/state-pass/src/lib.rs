#![allow(unexpected_cfgs, deprecated)]

use anchor_lang::prelude::*;
use anchor_lang::{
    solana_program::program::{invoke, invoke_signed},
    system_program,
};
use anchor_spl::{
    associated_token::{self, AssociatedToken},
    token_2022::{
        self,
        spl_token_2022::{
            self, extension::ExtensionType, instruction::AuthorityType, state::Mint as SplMint,
        },
        Token2022,
    },
    token_interface::{
        spl_pod::optional_keys::OptionalNonZeroPubkey,
        spl_token_metadata_interface::{
            self,
            state::{Field, TokenMetadata},
        },
    },
};

declare_id!("DQVhwp8Vg11LJKwrqrHHzxYpLzxjaAVw72s8WgR555bi");

mod constants {
    // PDA 种子，用于签署 Mint 和 Metadata 更新
    pub const NFT_AUTHORITY_SEED: &[u8] = b"nft_authority";
    // Metadata 中的自定义字段，用于存储 NFT 等级
    pub const NFT_METADATA_FIELD_LEVEL: &str = "level";
}

#[program]
pub mod state_pass {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    /// 铸造初始 StatePass NFT (Level 1)
    pub fn mint_nft(
        ctx: Context<MintNft>,
        name: String,
        symbol: String,
        uri: String, // Level 1 的元数据 URI
    ) -> Result<()> {
        // --- 1. 创建并初始化 Mint 账户 ---

        // 1a. 动态计算元数据所需空间，使其更健壮
        let initial_level = "1".to_string();

        // 实例化一个 TokenMetadata 结构体，用于计算其打包后的确切长度
        let token_metadata = TokenMetadata {
            // 将 Option<Pubkey> 转换为 OptionalNonZeroPubkey
            update_authority: OptionalNonZeroPubkey::try_from(Some(
                ctx.accounts.nft_authority.key(),
            ))?,
            mint: ctx.accounts.mint.key(),
            name: name.clone(),
            symbol: symbol.clone(),
            uri: uri.clone(),
            additional_metadata: vec![(
                constants::NFT_METADATA_FIELD_LEVEL.to_string(),
                initial_level.clone(),
            )],
        };

        // 计算 Metadata 及其 TLV 所需的空间
        let metadata_space = token_metadata.tlv_size_of()? - 4;
        // let metadata_space = token_metadata.get_packed_len()?;

        // 1b. 计算整个 Mint 账户（包括扩展）所需的空间
        let mint_extensions = [ExtensionType::MetadataPointer];
        let mint_space = ExtensionType::try_calculate_account_len::<SplMint>(&mint_extensions)?;
        let lamports_required = Rent::get()?.minimum_balance(mint_space + metadata_space);

        msg!(
            "Create Mint and metadata account size and cost: {} lamports: {}",
            mint_space + metadata_space,
            lamports_required
        );
        msg!("Lamports required: {}", lamports_required);

        // 1c. 创建账户
        system_program::create_account(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                system_program::CreateAccount {
                    from: ctx.accounts.signer.to_account_info(),
                    to: ctx.accounts.mint.to_account_info(),
                },
            ),
            lamports_required,
            mint_space as u64,
            &ctx.accounts.token_program.key(),
        )?;

        // 1d. 将 mint 账户分配给 token 程序

        // Assign the mint to the token program
        system_program::assign(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                system_program::Assign {
                    account_to_assign: ctx.accounts.mint.to_account_info(),
                },
            ),
            &Token2022::id(),
        )?;

        // 1e. 初始化 Metadata Pointer 扩展
        // 这个扩展必须在初始化 Mint 之前完成
        // 它告诉 Token-2022 program 元数据存储在哪里（这里是 Mint 账户自身）
        // Initialize the metadata pointer (Need to do this before initializing the mint)
        let init_meta_data_pointer_ix =
            spl_token_2022::extension::metadata_pointer::instruction::initialize(
                &Token2022::id(),
                &ctx.accounts.mint.key(),
                Some(ctx.accounts.nft_authority.key()), // 元数据更新权限
                Some(ctx.accounts.mint.key()),          // 元数据地址
            )?;

        // 调用指令
        invoke(
            &init_meta_data_pointer_ix,
            &[
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.nft_authority.to_account_info(),
            ],
        )?;

        // 1e. 初始化 Mint 自身
        // Initialize the mint cpi
        let mint_cpi_ix = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token_2022::InitializeMint2 {
                mint: ctx.accounts.mint.to_account_info(),
            },
        );

        token_2022::initialize_mint2(mint_cpi_ix, 0, &ctx.accounts.nft_authority.key(), None)?;

        // --- 2. 初始化元数据 ---

        // 准备 PDA 签名
        let seeds = &[constants::NFT_AUTHORITY_SEED, &[ctx.bumps.nft_authority]];
        let signer_seeds: &[&[&[u8]]] = &[&seeds[..]];

        msg!(
            "Initializing metadata for mint: {}",
            ctx.accounts.mint.key()
        );

        // 2a. 初始化基础元数据 (name, symbol, uri)
        // Init the metadata account
        let init_token_meta_data_ix = &spl_token_metadata_interface::instruction::initialize(
            &Token2022::id(),
            ctx.accounts.mint.key,
            ctx.accounts.nft_authority.to_account_info().key, // Mint Authority
            ctx.accounts.mint.key,                            // Metadata Address
            ctx.accounts.nft_authority.to_account_info().key, // Update Authority (NFT Authority PDA)
            name,
            symbol,
            uri,
        );

        invoke_signed(
            init_token_meta_data_ix,
            &[
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.nft_authority.to_account_info(),
            ],
            signer_seeds,
        )?;

        // 2b. 添加自定义元数据字段 "level"
        // Update the metadata account with an additional metadata field in this case the player level
        invoke_signed(
            &spl_token_metadata_interface::instruction::update_field(
                &Token2022::id(),
                ctx.accounts.mint.key,
                ctx.accounts.nft_authority.to_account_info().key,
                Field::Key(constants::NFT_METADATA_FIELD_LEVEL.to_string()),
                initial_level.clone(),
            ),
            &[
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.nft_authority.to_account_info(),
            ],
            signer_seeds,
        )?;

        // --- 3. 创建 ATA 并铸造 NFT ---

        // 3a. 创建关联代币账户 (ATA)
        // Create the associated token account
        associated_token::create(CpiContext::new(
            ctx.accounts.associated_token_program.to_account_info(),
            associated_token::Create {
                payer: ctx.accounts.signer.to_account_info(),
                associated_token: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.signer.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
        ))?;

        // 3b. 铸造一枚代币到 ATA
        // Mint one token to the associated token account of the player
        token_2022::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token_2022::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.nft_authority.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;

        // --- 4. 锁定 Mint 权限，确保其不可再增发 ---
        // Freeze the mint authority so no more tokens can be minted to make it an NFT
        token_2022::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token_2022::SetAuthority {
                    current_authority: ctx.accounts.nft_authority.to_account_info(),
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                },
                signer_seeds,
            ),
            AuthorityType::MintTokens,
            None,
        )?;

        // --- 5. 触发事件 ---
        emit!(NftMinted {
            nft_mint: ctx.accounts.mint.key(),
            recipient: ctx.accounts.signer.key(),
        });

        emit!(NftMetadataUpdated {
            nft_mint: ctx.accounts.mint.key(),
            field: constants::NFT_METADATA_FIELD_LEVEL.to_string(),
            value: initial_level,
        });

        Ok(())
    }

    /// 后端服务调用此指令，用于将 NFT 升级到新的等级。
    /// 签名者必须是 NFT Authority PDA。
    pub fn update_pass_level(
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
}

#[derive(Accounts)]
pub struct Initialize {}

// 定义 PDA 账户，用于程序签名
#[account]
#[derive(InitSpace)]
pub struct NftAuthority {}

#[derive(Accounts)]
pub struct MintNft<'info> {
    // 交易的发起者和费用支付者，也是 NFT 的接收者
    #[account(mut)]
    pub signer: Signer<'info>,

    // Mint 账户，需要是一个新的、未初始化的 Signer
    #[account(mut)]
    pub mint: Signer<'info>,

    /// CHECK: 我们将在指令中创建这个账户，所以这里只做基本检查
    /// CHECK: We will create this one for the user
    #[account(mut)]
    pub token_account: AccountInfo<'info>,

    // 程序派生地址 (PDA)，作为 Mint 和 Metadata 的权限
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + NftAuthority::INIT_SPACE,
        seeds = [constants::NFT_AUTHORITY_SEED],
        bump
    )]
    pub nft_authority: Account<'info, NftAuthority>,

    // 系统依赖的程序
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
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

// 定义事件结构体，用于链上链下通信
#[event]
pub struct NftMinted {
    pub nft_mint: Pubkey,
    pub recipient: Pubkey,
}

#[event]
pub struct NftMetadataUpdated {
    pub nft_mint: Pubkey,
    pub field: String,
    pub value: String,
}
