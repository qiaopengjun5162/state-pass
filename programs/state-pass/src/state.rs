use anchor_lang::prelude::*;

// 定义 PDA 账户，用于程序签名
#[account]
#[derive(InitSpace)]
pub struct NftAuthority {}
