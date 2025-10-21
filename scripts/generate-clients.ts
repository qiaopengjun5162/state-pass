/**
 * @file This script automates the generation of TypeScript and Rust clients
 * from Anchor IDLs using the Codama toolchain. It dynamically discovers all
 * available IDLs in the `target/idl` directory and generates clients for them in parallel.
 */

import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor as renderJavaScriptVisitor } from "@codama/renderers-js";
import { renderVisitor as renderRustVisitor } from "@codama/renderers-rust";
import * as fs from "fs";
import * as path from "path";

/**
 * 为单个 Anchor 程序生成 TypeScript 和 Rust 客户端。
 *
 * @param programName - target/idl/ 目录下不带 .json 后缀的程序名。
 * @param projectRoot - Anchor 项目的根目录路径。
 */
async function generateClientsForProgram(
  programName: string,
  projectRoot: string,
): Promise<void> {
  console.log(`\n🚀 开始为程序 [${programName}] 生成客户端...`);

  try {
    // --- 1. 定义所有相关路径 ---
    const anchorIdlPath = path.join(
      projectRoot,
      "target",
      "idl",
      `${programName}.json`,
    );
    const outputTsPath = path.join(projectRoot, "clients", "ts", programName); // 将 ts 客户端代码存放在 clients/ts/ 目录下
    const outputRsPath = path.join(projectRoot, "clients", "rs", programName); // 将 rust 客户端代码存放在 clients/rs/ 目录下
    const outputCodamaIdlDir = path.join(projectRoot, "idl", "codama"); // 将 Codama IDL 存放在独立的 idl/codama 目录中
    const outputCodamaIdlPath = path.join(
      outputCodamaIdlDir,
      `${programName}.codama.json`,
    );

    console.log(`  - 读取 Anchor IDL 从: ${anchorIdlPath}`);

    // --- 2. 读取并转换 IDL ---
    if (!fs.existsSync(anchorIdlPath)) {
      console.warn(
        `  - ⚠️  警告: 找不到 ${programName} 的 IDL 文件，已跳过。请先编译您的 Anchor 程序。`,
      );
      return;
    }
    const anchorIdl = JSON.parse(fs.readFileSync(anchorIdlPath, "utf-8"));
    const codamaRoot = createFromRoot(rootNodeFromAnchor(anchorIdl));
    console.log(`  - ✅ Anchor IDL 已成功转换为 Codama 格式。`);

    // --- 3. 保存 Codama 中间格式的 IDL 文件 ---
    if (!fs.existsSync(outputCodamaIdlDir)) {
      fs.mkdirSync(outputCodamaIdlDir, { recursive: true });
    }
    fs.writeFileSync(outputCodamaIdlPath, codamaRoot.getJson());
    console.log(`  - ✅ Codama 格式的 IDL 已保存至: ${outputCodamaIdlPath}`);

    // --- 4. 生成 TypeScript 客户端 ---
    codamaRoot.accept(
      renderJavaScriptVisitor(outputTsPath, {
        formatCode: true, // 使用 Prettier 自动格式化生成的代码
        deleteFolderBeforeRendering: true, // 每次生成前清空目标文件夹
      }),
    );
    console.log(`  - ✅ TypeScript 客户端已成功生成至: ${outputTsPath}`);

    // --- 5. 生成 Rust 客户端 ---
    codamaRoot.accept(
      renderRustVisitor(outputRsPath, {
        // 建议在 CI/CD 环境中禁用格式化，以避免因缺少 cargo fmt 工具而导致失败
        formatCode: false,
        deleteFolderBeforeRendering: true,
        // 确保为账户生成 Anchor 相关的 traits (如 AccountDeserialize)
        anchorTraits: true,
      }),
    );
    console.log(`  - ✅ Rust 客户端已成功生成至: ${outputRsPath}`);
  } catch (error) {
    console.error(`  - ❌ 处理程序 [${programName}] 时发生严重错误:`, error);
  }
}

/**
 * 脚本主执行函数。
 */
async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const idlDir = path.join(projectRoot, "target", "idl");

  // 新增功能：从命令行参数获取要生成的程序名
  const specifiedPrograms = process.argv.slice(2);

  let programsToGenerate: string[];

  if (specifiedPrograms.length > 0) {
    // 如果提供了命令行参数，则只处理指定的程序
    programsToGenerate = specifiedPrograms;
    console.log(
      `--- [${new Date().toLocaleTimeString()}] 将为指定的 ${programsToGenerate.length} 个程序生成客户端 ---`,
    );
  } else {
    // 如果没有提供命令行参数，则恢复旧逻辑：扫描并处理所有找到的 IDL
    console.log(
      `--- [${new Date().toLocaleTimeString()}] 未指定程序，开始扫描 ${idlDir} 目录下的所有 IDL 文件 ---`,
    );

    if (!fs.existsSync(idlDir)) {
      console.error(`\n❌ 错误: 找不到 IDL 目录: ${idlDir}。`);
      console.error(
        "请先在您的 Anchor 项目根目录运行 `anchor build` 来生成 IDL 文件。",
      );
      process.exit(1);
    }

    programsToGenerate = fs
      .readdirSync(idlDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.replace(".json", ""));
  }

  if (programsToGenerate.length === 0) {
    console.log("\n🟡 未找到任何需要处理的程序。");
    return;
  }

  console.log(`\n🔍 将处理以下程序: [${programsToGenerate.join(", ")}]`);

  await Promise.all(
    programsToGenerate.map((programName) =>
      generateClientsForProgram(programName, projectRoot),
    ),
  );
}

// --- 脚本入口 ---
main()
  .then(() =>
    console.log(
      `\n--- [${new Date().toLocaleTimeString()}] 所有客户端生成任务执行完毕 ---`,
    ),
  )
  .catch((error) => {
    console.error("\n--- 脚本执行过程中发生未捕获的错误 ---", error);
    process.exit(1);
  });

/*

### 如何使用

现在，您的脚本有了两种强大的使用方式：

1.  **生成所有客户端（默认行为）**：
    和以前一样，不带任何参数运行脚本，它会自动扫描 `target/idl` 目录并为所有找到的程序生成客户端。
    ```sh
    ts-node generate-clients.ts
    ```

2.  **生成指定的客户端**：
    在命令后面跟上您想生成的程序名（一个或多个，用空格隔开），脚本将只处理您指定的程序。
    ```sh
    # 只为 token_2022_nft 生成客户端
    ts-node generate-clients.ts token_2022_nft

    # 同时为 red_packet 和 dao_program 生成客户端
    ts-node generate-clients.ts red_packet dao_program

*/
