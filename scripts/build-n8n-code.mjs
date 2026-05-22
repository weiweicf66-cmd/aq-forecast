#!/usr/bin/env node
// 从模板 (n8n/*.js 含 $vars.X 占位) + .env.local 生成可直接粘贴到 n8n 的 .local.js。
//
// 用法： node --env-file=.env.local scripts/build-n8n-code.mjs
// 或   npm run build:n8n

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const REQUIRED_VARS = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "GITHUB_BRANCH"];
const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`缺少环境变量: ${missing.join(", ")}`);
  console.error(`提示：用 npm run build:n8n 或 node --env-file=.env.local scripts/build-n8n-code.mjs`);
  console.error(`参考 .env.example`);
  process.exit(1);
}

const TARGETS = [
  { src: "n8n/code-node.js",       dst: "n8n/code-node.local.js" },
  { src: "n8n/eval-code-node.js",  dst: "n8n/eval-code-node.local.js" },
];

const HEADER = `// !!! 自动生成：由 scripts/build-n8n-code.mjs 从 ${"<src>"} + .env.local 生成。
// !!! 含 GitHub PAT，已 gitignore (*.local.js)，不会推到 GitHub。
// 不要手动编辑：
//   - 改算法 → 编辑 ${"<src>"} → 跑 npm run build:n8n
//   - 换 token → 编辑 .env.local → 跑 npm run build:n8n
// 这是 n8n Code 节点要粘贴的版本。
`;

for (const { src, dst } of TARGETS) {
  let body = await readFile(path.join(root, src), "utf8");
  for (const k of REQUIRED_VARS) {
    const literal = JSON.stringify(process.env[k]);
    body = body.split(`$vars.${k}`).join(literal);
  }
  const header = HEADER.replaceAll("<src>", src);
  await writeFile(path.join(root, dst), header + "\n" + body, "utf8");
  console.log(`✓ ${dst}`);
}

console.log("完成。把对应 .local.js 内容粘到 n8n 的 Code 节点。");
