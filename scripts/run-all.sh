#!/usr/bin/env bash
# 本地全量验证：按 CI 作业顺序跑 web 与 miniprogram 的全部步骤，
# 每一步的输出原文写进 evidence/。任一步失败则整体退出非 0。
# 用法：在仓库根目录执行 bash scripts/run-all.sh
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"
EVIDENCE="$ROOT/evidence"
mkdir -p "$EVIDENCE"

fail=0

# 本机注意：工作区目录组原为 nogroup（65534），pnpm 写文件时会 chown 到父目录的
# 属主（0:65534），而本机 overlayfs 拒绝 chown 到 gid 65534，导致安装 EPERM。
# 已对本交付树执行 chgrp -R 0，此后 pnpm chown 到 0:0 即可通过。
# CI（GitHub runner）不受影响。安装只用 frozen-lockfile，
# lockfile 与 package.json 不一致时必须先重新生成，不得静默回退。
pnpm_install() {
  pnpm install --frozen-lockfile
}

run_step() {
  local name="$1"; shift
  local log="$EVIDENCE/$1"; shift
  echo "=== $name ==="
  echo "\$ $*" | tee "$log"
  "$@" >> "$log" 2>&1
  local code=$?
  echo "exit=$code" | tee -a "$log"
  if [ "$code" -ne 0 ]; then fail=1; echo "FAILED: $name（见 $log）"; fi
}

{
  echo "node: $(node --version)"
  echo "pnpm: $(pnpm --version)"
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} | tee "$EVIDENCE/env.log"

cd "$ROOT/web"
run_step "web 安装依赖" install.log pnpm_install
run_step "web lint" web-lint.log pnpm lint
run_step "web typecheck" web-typecheck.log pnpm typecheck
run_step "web test" web-test.log pnpm test --run
run_step "web build" web-build.log pnpm build
run_step "web 体积门禁（默认 800KB）" bundle-pass.log node ../scripts/check-bundle-size.mjs --dist dist

cd "$ROOT/miniprogram"
run_step "miniprogram 安装依赖" install-mini.log pnpm_install
run_step "miniprogram typecheck" mini-typecheck.log pnpm typecheck
run_step "miniprogram lint" mini-lint.log pnpm lint
run_step "miniprogram appid 检查" appid-pass.log node ../scripts/check-appid.mjs --config project.config.json

cd "$ROOT"
run_step "边界测试（体积/appid）" boundary-cases.log bash tests/boundary-cases.sh
run_step "路径过滤判定模拟" paths-filter-simulation.log node tests/paths-filter-simulation.mjs
if [ "$fail" -ne 0 ]; then
  echo "RESULT: FAIL（见 evidence/ 各日志）"
  exit 1
fi
echo "RESULT: PASS"
