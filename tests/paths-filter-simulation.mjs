#!/usr/bin/env node
/**
 * paths-filter 判定模拟：读工作流里的 filters 定义，对给定“改动文件列表”
 * 算出 web / miniprogram 两个输出，与预期逐项核对。
 *
 * 说明（诚实范围）：
 * - dorny/paths-filter 底层用 micromatch 做 glob 匹配；本仓过滤规则只有两种形状——
 *   目录前缀（web/**、miniprogram/**）与精确文件路径（scripts/check-*.mjs、
 *   .github/workflows/frontend-ci.yml）。对这两种形状，前缀/精确匹配与
 *   micromatch 的判定结果一致，因此本模拟不装 micromatch，用等价判定实现。
 * - 本模拟只覆盖“过滤规则 → 输出”的映射，不覆盖 paths-filter 取 PR 文件列表
 *   的那一步（那步在 GitHub 上调 REST API，本地无法跑；changes 作业已按
 *   GPT 裁决 P0-1 补上 pull-requests: read 权限）。
 * - 另注意：顶层触发路径（on.pull_request.paths）决定工作流是否启动；
 *   只改 README.md 这类文件时工作流根本不触发，不进过滤判定。
 *
 * 用法：在仓库根目录执行 node tests/paths-filter-simulation.mjs
 * 输出原文写进 evidence/paths-filter-simulation.log。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowPath = join(root, '.github/workflows/frontend-ci.yml');
const logPath = join(root, 'evidence/paths-filter-simulation.log');
mkdirSync(join(root, 'evidence'), { recursive: true });

const out = [];
function log(line = '') {
  out.push(line);
  console.log(line);
}

// ---- 从工作流文件读 filters 定义（行解析 + 校验，防静默误读） ----
const wf = readFileSync(workflowPath, 'utf-8');
const lines = wf.split('\n');
let baseIndent = null;
const filters = {};
let current = null;
for (const line of lines) {
  if (baseIndent === null) {
    const m = line.match(/^(\s*)filters:\s*\|\s*$/);
    if (m) baseIndent = m[1].length;
    continue;
  }
  if (line.trim() === '') continue;
  const indent = line.match(/^(\s*)/)[1].length;
  if (indent <= baseIndent) break; // filters 块结束
  const nameM = line.match(/^\s+([\w-]+):\s*$/);
  if (nameM && indent === baseIndent + 2) {
    current = nameM[1];
    filters[current] = [];
    continue;
  }
  const patM = line.match(/^\s+-\s+'([^']+)'\s*$/);
  if (patM && current) {
    filters[current].push(patM[1]);
    continue;
  }
  console.error(`无法解析的 filters 行：${line}`);
  process.exit(2);
}
if (!filters.web || filters.web.length === 0 || !filters.miniprogram || filters.miniprogram.length === 0) {
  console.error('filters 定义读不到 web/miniprogram 两组规则，模拟中止');
  process.exit(2);
}
log(`filters 定义（读自 .github/workflows/frontend-ci.yml）：`);
for (const [name, pats] of Object.entries(filters)) {
  log(`  ${name}: ${pats.join(', ')}`);
}
log('');

// ---- 等价匹配：目录前缀 `dir/**` = 该目录下任意文件；其余为精确路径 ----
function matchPattern(file, pattern) {
  if (pattern.endsWith('/**')) {
    return file.startsWith(pattern.slice(0, -3));
  }
  return file === pattern;
}
function evaluate(changedFiles) {
  const result = {};
  for (const [name, pats] of Object.entries(filters)) {
    result[name] = changedFiles.some((f) => pats.some((p) => matchPattern(f, p)));
  }
  return result;
}

// ---- 用例：改动文件 → 预期输出 ----
const cases = [
  { name: '只改工作流文件', changed: ['.github/workflows/frontend-ci.yml'], expect: { web: true, miniprogram: true } },
  { name: '只改体积检查脚本', changed: ['scripts/check-bundle-size.mjs'], expect: { web: true, miniprogram: false } },
  { name: '只改 appid 检查脚本', changed: ['scripts/check-appid.mjs'], expect: { web: false, miniprogram: true } },
  { name: '只改 web 源码', changed: ['web/src/App.tsx'], expect: { web: true, miniprogram: false } },
  { name: '只改小程序源码', changed: ['miniprogram/app.ts'], expect: { web: false, miniprogram: true } },
  { name: '只改 README（不触发工作流，不进过滤）', changed: ['README.md'], expect: { web: false, miniprogram: false } },
  { name: '只改其他脚本（run-all.sh 未映射）', changed: ['scripts/run-all.sh'], expect: { web: false, miniprogram: false } },
  { name: '演示 PR：同时改 web 与 miniprogram', changed: ['web/src/App.tsx', 'miniprogram/app.ts'], expect: { web: true, miniprogram: true } },
  { name: '同时改两个检查脚本', changed: ['scripts/check-bundle-size.mjs', 'scripts/check-appid.mjs'], expect: { web: true, miniprogram: true } },
];

let failed = 0;
for (const c of cases) {
  const got = evaluate(c.changed);
  const ok = got.web === c.expect.web && got.miniprogram === c.expect.miniprogram;
  log(`用例：${c.name}`);
  log(`  改动：${c.changed.join(', ')}`);
  log(`  预期：web=${c.expect.web} miniprogram=${c.expect.miniprogram}`);
  log(`  实际：web=${got.web} miniprogram=${got.miniprogram}  ${ok ? 'OK' : '不符'}`);
  if (!ok) failed += 1;
}
log('');
if (failed > 0) {
  log(`RESULT: FAIL（${failed} 个用例不符）`);
  writeFileSync(logPath, out.join('\n') + '\n');
  process.exit(1);
}
log(`RESULT: PASS（${cases.length}/${cases.length} 个用例均符合预期）`);
writeFileSync(logPath, out.join('\n') + '\n');
