#!/usr/bin/env bash
# 反向用例：三条“故意失败”验收逐条真实跑出失败，输出原文写进 evidence/。
# 每个用例都在临时目录里改副本，不动仓库原件；跑完即清理。
# 用法：在仓库根目录执行 bash tests/negative-cases.sh
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"
EVIDENCE="$ROOT/evidence"
mkdir -p "$EVIDENCE"

fail=0
expect_fail() {
  # $1 用例名 $2 日志名 $3 期望出现在输出里的关键字；其余参数为命令
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
  echo "OK: $name 如预期失败"
}

# ---- AC2：故意制造类型错误，typecheck 必须失败 ----
TMP2="$(mktemp -d)"
cp -r "$ROOT/web/src" "$ROOT/web/index.html" "$ROOT/web/package.json" "$ROOT/web/tsconfig.json" "$ROOT/web/vite.config.ts" "$ROOT/web/eslint.config.js" "$TMP2/"
ln -s "$ROOT/web/node_modules" "$TMP2/node_modules"
printf '\n// 故意制造的类型错误（反向用例，跑完即删）：\nconst __ac2_bad: number = "类型错误";\n' >> "$TMP2/src/App.tsx"
(cd "$TMP2" && expect_fail "AC2 类型错误" ac2-typecheck-failure.log "error TS2322" pnpm typecheck)
rm -rf "$TMP2"

# ---- AC3：把上限压到 1KB，体积门禁必须失败并打印实际体积 ----
(cd "$ROOT/web" && BUNDLE_MAX_KB=1 expect_fail "AC3 体积超限" ac3-bundle-over-limit.log "超过上限" node ../scripts/check-bundle-size.mjs --dist dist)

# ---- AC4：appid 改成非占位值，检查必须失败 ----
TMP4="$(mktemp -d)"
node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('$ROOT/miniprogram/project.config.json','utf-8'));c.appid='wx1234567890abcdef';fs.writeFileSync('$TMP4/project.config.json',JSON.stringify(c,null,2));"
expect_fail "AC4 appid 非占位值" ac4-appid-failure.log "不是占位值" node "$ROOT/scripts/check-appid.mjs" --config "$TMP4/project.config.json"
rm -rf "$TMP4"

if [ "$fail" -ne 0 ]; then
  echo "RESULT: FAIL（有反向用例未按预期失败）"
  exit 1
fi
echo "RESULT: PASS（三条反向用例均如预期失败）"
