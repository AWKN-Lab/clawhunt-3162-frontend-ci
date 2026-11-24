#!/usr/bin/env node
/**
 * appid 占位检查：project.config.json 的 appid 必须是占位值 touristappid；
 * 真实 appid 只在发布流程注入，仓库里出现非占位值即失败。
 * 只打印 appid 本身（配置文件值），不打印任何环境变量。
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function fail(msg) {
  console.error(`APPID CHECK FAILED: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const cfgIdx = args.indexOf('--config');
if (cfgIdx === -1 || !args[cfgIdx + 1]) {
  fail('用法：node check-appid.mjs --config <project.config.json>');
}
const placeholderIdx = args.indexOf('--placeholder');
const placeholder = placeholderIdx === -1 ? 'touristappid' : args[placeholderIdx + 1];

const configPath = resolve(args[cfgIdx + 1]);
if (!existsSync(configPath)) {
  fail(`配置文件不存在：${configPath}`);
}

let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch (e) {
  fail(`配置文件不是合法 JSON：${configPath}（${e.message}）`);
}

const appid = config.appid;
console.log(`appid：${appid}，占位值：${placeholder}`);
if (typeof appid !== 'string' || appid.length === 0) {
  fail('appid 缺失或为空');
}
if (appid !== placeholder) {
  fail(`appid 不是占位值（当前：${appid}，应为：${placeholder}）；真实 appid 只在发布流程注入`);
}
console.log('APPID CHECK PASSED');
