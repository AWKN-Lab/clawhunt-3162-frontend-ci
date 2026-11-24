#!/usr/bin/env bash
# 边界测试：主包体积边界与 appid 边界。每个用例都在临时目录里做，
# 不动仓库原件；输出原文写进 evidence/。
# 用法：在仓库根目录执行 bash tests/boundary-cases.sh
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"
EVIDENCE="$ROOT/evidence"
mkdir -p "$EVIDENCE"

fail=0

expect_pass() {
  # $1 用例名 $2 日志名 $3 期望关键字；其余参数为命令
  local name="$1"; local log="$2"; local want="$3"; shift 3
  echo "=== $name ==="
  echo "\$ $*" | tee "$EVIDENCE/$log"
  "$@" >> "$EVIDENCE/$log" 2>&1
  local code=$?
  echo "exit=$code" | tee -a "$EVIDENCE/$log"
  if [ "$code" -ne 0 ]; then
    echo "UNEXPECTED FAIL: $name 本应通过却失败了"; fail=1; return
  fi
  if ! grep -q -- "$want" "$EVIDENCE/$log"; then
    echo "UNEXPECTED OUTPUT: $name 未出现期望关键字 [$want]"; fail=1; return
  fi
  echo "OK: $name 如预期通过"
}

expect_fail() {
  # $1 用例名 $2 日志名 $3 期望关键字；其余参数为命令
  # 失败必须同时满足三点：退出码非 0、出现期望关键字、出现脚本自身的
  # 失败标记（BUNDLE/APPID CHECK FAILED）。只看退出码会把脚本自身异常
  #（如模块加载失败、路径错误）误判为门禁通过，故多验一层错误类型。
  local name="$1"; local log="$2"; local want="$3"; shift 3
  echo "=== $name ==="
  echo "\$ $*" | tee "$EVIDENCE/$log"
  "$@" >> "$EVIDENCE/$log" 2>&1
  local code=$?
  echo "exit=$code" | tee -a "$EVIDENCE/$log"
  if [ "$code" -eq 0 ]; then
    echo "UNEXPECTED PASS: $name 本应失败却通过了"; fail=1; return
  fi
  if ! grep -q -- "$want" "$EVIDENCE/$log"; then
    echo "UNEXPECTED OUTPUT: $name 未出现期望关键字 [$want]"; fail=1; return
  fi
  if ! grep -q -- "CHECK FAILED" "$EVIDENCE/$log"; then
    echo "UNEXPECTED ERROR TYPE: $name 失败了但不是检查脚本的门禁失败（缺少 CHECK FAILED 标记，可能是脚本自身异常）"; fail=1; return
  fi
  echo "OK: $name 如预期失败"
}

# ---- 体积边界：主包恰好 800 KB 通过；超过 800 KB 失败 ----
# 脚本按 1024 换算：800 KB = 819200 字节；800.01 KB = 819210.24 字节不是整数，
# 取 819210 字节（约 800.01 KB）作失败侧；另加 819201 字节（最小超限）作失败侧。
mk_bundle() {
  # $1 主包大小（字节） $2 目标目录
  local size="$1" dir="$2"
  mkdir -p "$dir/dist/assets"
  printf '<!doctype html><html><head><meta charset="UTF-8" /></head><body><script type="module" src="/assets/index-test.js"></script></body></html>' > "$dir/dist/index.html"
  head -c "$size" /dev/zero > "$dir/dist/assets/index-test.js"
}

TMPB="$(mktemp -d)"
mk_bundle 819200 "$TMPB/pass800"
(cd "$TMPB/pass800" && BUNDLE_MAX_KB=800 expect_pass "体积边界：主包恰好 800 KB（819200 字节）" boundary-bundle-800-pass.log "BUNDLE CHECK PASSED" node "$ROOT/scripts/check-bundle-size.mjs" --dist dist)
mk_bundle 819210 "$TMPB/fail80001"
(cd "$TMPB/fail80001" && BUNDLE_MAX_KB=800 expect_fail "体积边界：主包约 800.01 KB（819210 字节）" boundary-bundle-80001-fail.log "超过上限" node "$ROOT/scripts/check-bundle-size.mjs" --dist dist)
mk_bundle 819201 "$TMPB/fail800min"
(cd "$TMPB/fail800min" && BUNDLE_MAX_KB=800 expect_fail "体积边界：主包 819201 字节（最小超限）" boundary-bundle-819201-fail.log "超过上限" node "$ROOT/scripts/check-bundle-size.mjs" --dist dist)
rm -rf "$TMPB"

# ---- appid 边界：缺失、空值、null、非占位值均失败；占位值通过 ----
TMPA="$(mktemp -d)"
printf '{}' > "$TMPA/missing.json"
expect_fail "appid 边界：缺失" boundary-appid-missing-fail.log "appid 缺失或为空" node "$ROOT/scripts/check-appid.mjs" --config "$TMPA/missing.json"
printf '{"appid":""}' > "$TMPA/empty.json"
expect_fail "appid 边界：为空" boundary-appid-empty-fail.log "appid 缺失或为空" node "$ROOT/scripts/check-appid.mjs" --config "$TMPA/empty.json"
printf '{"appid":null}' > "$TMPA/null.json"
expect_fail "appid 边界：null" boundary-appid-null-fail.log "appid 缺失或为空" node "$ROOT/scripts/check-appid.mjs" --config "$TMPA/null.json"
printf '{"appid":"wx1234567890abcdef"}' > "$TMPA/other.json"
expect_fail "appid 边界：非占位值" boundary-appid-other-fail.log "不是占位值" node "$ROOT/scripts/check-appid.mjs" --config "$TMPA/other.json"
printf '{"appid":"touristappid"}' > "$TMPA/ok.json"
expect_pass "appid 边界：占位值" boundary-appid-placeholder-pass.log "APPID CHECK PASSED" node "$ROOT/scripts/check-appid.mjs" --config "$TMPA/ok.json"
rm -rf "$TMPA"

if [ "$fail" -ne 0 ]; then
  echo "RESULT: FAIL（有边界用例未按预期表现）"
  exit 1
fi
echo "RESULT: PASS（边界用例 8/8 均按预期表现）"
