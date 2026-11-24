#!/usr/bin/env node
/**
 * 体积门禁：读取 Vite 构建产物，打印各 chunk 体积；
 * 主包（index.html 引用的入口 chunk）超过 BUNDLE_MAX_KB（默认 800）时失败。
 * 只打印文件体积，不打印任何环境变量。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function fail(msg) {
  console.error(`BUNDLE CHECK FAILED: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const distIdx = args.indexOf('--dist');
if (distIdx === -1 || !args[distIdx + 1]) {
  fail('用法：node check-bundle-size.mjs --dist <dist 目录>');
}
const distDir = resolve(args[distIdx + 1]);
if (!existsSync(distDir)) {
  fail(`构建产物目录不存在：${distDir}（请先运行 pnpm build）`);
}

const limitKb = Number(process.env.BUNDLE_MAX_KB ?? '800');
if (!Number.isFinite(limitKb) || limitKb <= 0) {
  fail(`BUNDLE_MAX_KB 无效：${process.env.BUNDLE_MAX_KB}`);
}

const assetsDir = join(distDir, 'assets');
const files = existsSync(assetsDir)
  ? readdirSync(assetsDir).map((f) => join('assets', f))
  : [];
const entries = [];
for (const rel of files) {
  const full = join(distDir, rel);
  if (!statSync(full).isFile()) continue;
  if (!/\.(js|css)$/.test(rel)) continue;
  entries.push({ file: rel, kb: statSync(full).size / 1024 });
}
entries.sort((a, b) => b.kb - a.kb);

// 主包 = index.html 引用的入口 js；找不到引用时直接失败，
// 不退化为“最大的 js chunk”（最大 chunk 未必是入口，会把门禁判错）。
let mainFile = null;
const indexHtml = join(distDir, 'index.html');
if (existsSync(indexHtml)) {
  const html = readFileSync(indexHtml, 'utf-8');
  const m = html.match(/src="([^"]+\.js)"/);
  if (m) mainFile = m[1].replace(/^\//, '');
}
if (!mainFile) {
  fail('index.html 中没有找到入口 js 引用（src="...js"），无法确定主包');
}

const totalKb = entries.reduce((s, e) => s + e.kb, 0);
console.log('chunk 体积（KB）：');
for (const e of entries) {
  console.log(`  ${e.file}  ${e.kb.toFixed(2)}`);
}
console.log(`合计（JS+CSS，仅供参考；门禁只看主包 JS）：${totalKb.toFixed(2)} KB`);

const main = entries.find((e) => e.file === mainFile);
if (!main) {
  fail(`入口 chunk 未在产物中找到：${mainFile}`);
}
console.log(`主包：${main.file}  ${main.kb.toFixed(2)} KB，上限：${limitKb} KB`);
if (main.kb > limitKb) {
  fail(`主包 ${main.file} 实际 ${main.kb.toFixed(2)} KB，超过上限 ${limitKb} KB`);
}
console.log('BUNDLE CHECK PASSED');
