#!/usr/bin/env node
/**
 * 体积门禁：读取 Vite 构建产物，打印各 chunk 体积；
 * 入口 JS（index.html 引用的全部 src="...js"）超过 BUNDLE_MAX_KB（默认 800）时失败。
 * 门禁口径：只检查入口 JS，不含静态依赖 chunk 与 CSS；JS+CSS 合计仅供参考。
 * assets/ 目录递归扫描（嵌套子目录的 JS 也计入清单）；index.html 里有多个
 * 入口时全部都要过门禁，漏掉任何一个都算漏检。
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

// 递归扫描 assets/，收齐全部 .js 与 .css（嵌套子目录也计入清单）。
const entries = [];
function walk(dir, relBase) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relBase ? `${relBase}/${name}` : name;
    if (statSync(full).isDirectory()) {
      walk(full, rel);
    } else if (/\.(js|css)$/.test(name)) {
      entries.push({ file: rel, kb: statSync(full).size / 1024 });
    }
  }
}
const assetsDir = join(distDir, 'assets');
if (existsSync(assetsDir)) walk(assetsDir, 'assets');
entries.sort((a, b) => b.kb - a.kb);

// 入口 = index.html 引用的全部 src="...js"；一个都没有时直接失败，
// 不退化为“最大的 js chunk”（最大 chunk 未必是入口，会把门禁判错）。
let mainFiles = [];
const indexHtml = join(distDir, 'index.html');
if (existsSync(indexHtml)) {
  const html = readFileSync(indexHtml, 'utf-8');
  const seen = new Set();
  for (const m of html.matchAll(/src="([^"]+\.js)"/g)) {
    const f = m[1].replace(/^\//, '');
    if (!seen.has(f)) {
      seen.add(f);
      mainFiles.push(f);
    }
  }
}
if (mainFiles.length === 0) {
  fail('index.html 中没有找到入口 js 引用（src="...js"），无法确定主包');
}

const totalKb = entries.reduce((s, e) => s + e.kb, 0);
console.log('chunk 体积（KB）：');
for (const e of entries) {
  console.log(`  ${e.file}  ${e.kb.toFixed(2)}`);
}
console.log(`合计（JS+CSS，仅供参考；门禁只看入口 JS，不含静态依赖 chunk 与 CSS）：${totalKb.toFixed(2)} KB`);

const mains = [];
for (const f of mainFiles) {
  const found = entries.find((e) => e.file === f);
  if (!found) {
    fail(`入口 chunk 未在产物中找到：${f}`);
  }
  mains.push(found);
}
console.log(`入口（共 ${mains.length} 个，上限：${limitKb} KB）：`);
for (const m of mains) {
  console.log(`  主包：${m.file}  ${m.kb.toFixed(2)} KB`);
}
for (const m of mains) {
  if (m.kb > limitKb) {
    fail(`主包 ${m.file} 实际 ${m.kb.toFixed(2)} KB，超过上限 ${limitKb} KB`);
  }
}
console.log('BUNDLE CHECK PASSED');
