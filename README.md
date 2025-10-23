# 🔗 StatePass: 基于 Token-2022 的动态 NFT (dNFT) 项目

Solana Anchor program leveraging the Token-2022 Metadata extension to create dynamic, upgradable StatePass NFTs whose metadata is fully controlled by a Program Derived Address (PDA).
StatePass 是一个基于 $\text{Token}$-2022 的动态数字资产标准，它将静态 $\text{NFT}$ 转化为可进化的会员卡、支付凭证和线下动态身份。

🚀 项目概述 (Project Overview)

StatePass 是一个基于 Solana 区块链和 Anchor 框架构建的程序，它利用 Token-2022 标准及其 Token Metadata 扩展来实现动态 NFT (dNFT)。

该 $\text{NFT}$ 被设计为一张具有可升级状态的“通行证”（StatePass），其元数据（如等级 Level 和 URI）可以由程序控制，而不是由初始的 Mint Authority 控制。

✨ 核心功能 (Core Features)

NFT Minting ($\text{MintNft}$):

铸造一个 $\text{Token-2022 NFT}$（$0$ 小数位，最大供应量 $1$）。

在 $\text{NFT}$ 上附加 $\text{Metadata}$ 扩展，包含初始 $\text{URI}$ 和自定义字段 level: 1。

铸造完成后，销毁 Mint Authority 和 Freeze Authority，并将 $\text{NFT}$ 的所有权交接给一个 Program Derived Address ($\text{PDA}$)，确保只有程序本身能够修改其元数据。

NFT Upgrading ($\text{UpdatePassLevel}$):

通过 $\text{PDA}$ 签名，调用 $\text{Token Metadata}$ 扩展的 UpdateField 指令。

将 $\text{NFT}$ 的等级字段 (level) 更新为新的值。

将 $\text{NFT}$ 的 $\text{URI}$ 更新为与新等级对应的元数据文件链接。

发出 $\text{Anchor Event}$ (NftMetadataUpdated)，以便客户端可以实时监听状态变化。

🛠️ 项目结构 (Project Structure)

智能合约 (Rust)

文件/目录

描述

src/lib.rs

核心程序逻辑，包含所有指令、账户定义和事件定义。

programs/state-pass/

Anchor 项目根目录。

Anchor.toml

Anchor 配置和本地测试脚本。

客户端测试 (TypeScript)

文件

描述

tests/token-2022-nft.ts

客户端测试脚本。验证 $\text{Mint}$、元数据初始化、$\text{PDA}$ 权限设置、以及 $\text{NFT}$ 升级和事件发射功能。集成了重试逻辑以确保本地测试环境的稳定性。

💡 如何开始 (Getting Started)

先决条件

Rust 和 Cargo

Solana CLI

Anchor CLI (v0.29.0 或更高版本)

Node.js (v18+) 和 yarn/npm

编译与部署

# 1. 构建合约

anchor build

# 2. 部署到本地/开发网

# 注意: 替换为您自己的 Program ID

anchor deploy --program-id <YOUR_PROGRAM_ID>

运行测试

# 运行 TypeScript 测试套件

anchor test

计划中的代码重构

为了提高可维护性，我们计划将 src/lib.rs 进行模块化拆分，例如：

src/instructions/：放置所有指令逻辑。

src/state.rs：放置账户和事件定义。

这是下一个开发步骤。
