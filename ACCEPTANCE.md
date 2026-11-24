# 验收对照 · ClawHunt #3162

单子：GitHub Actions 前端 CI：工作台构建与小程序 TypeScript 编译。
截止：2026-11-30。投标价：$81.00（90%）。

本地验证环境：Node v24.22.1、pnpm 10.34.9（CI 用 Node 20，见工作流）。Node 20 已在本机实测通过：Node v20.20.2（最新 20.x LTS，官网下载、SHA256 对官方清单核对无误），web 与 miniprogram 全套步骤 10/10 通过（安装、lint、typecheck、test 3/3、build 54.71s、体积门禁主包 619.02 KB、appid 检查），日志见 `evidence/node20-*.log`。

GPT 复核（2026-11-25，修改后 GO）已按七点改完：P0-1 changes 作业补 `pull-requests: read`；P0-2 触发路径加 `scripts/**`、过滤映射补两个检查脚本与工作流文件；P0-3 工作流文件改动触发两个作业（判定模拟 9/9 通过）；P1-1 README 删掉 `actions: write` 建议；P1-2 体积脚本只认 index.html 入口引用、边界测试 8/8 通过；P1-3 Node 20 实测通过（上）；P1-4 演示 PR 与截图待推仓后做（见“还剩什么”）。

## 验收 1：web 与 miniprogram 两个作业在 PR 上均通过（附截图）

**本地状态：通过。PR 截图：待推后补。**

- 本地全量验证 `bash scripts/run-all.sh`，RESULT: PASS，输出原文见 `evidence/`：
- `web-lint.log`、`web-typecheck.log`、`web-test.log`、`web-build.log`、`bundle-pass.log`
- `mini-typecheck.log`、`mini-lint.log`、`appid-pass.log`
- 工作流本身（`.github/workflows/frontend-ci.yml`）含 `changes` + `web` + `miniprogram` 三个作业；演示 PR 同时改 `web/**` 与 `miniprogram/**`，两个作业都会跑。
- GPT 复核 P0 改动：`changes` 作业有 `pull-requests: read` 权限（paths-filter 在 PR 事件中调 GitHub REST API 取文件列表要用）；触发路径含 `scripts/**`；过滤映射：`scripts/check-bundle-size.mjs` → web、`scripts/check-appid.mjs` → miniprogram、工作流文件本身 → 两者。判定模拟 `node tests/paths-filter-simulation.mjs` 9/9 通过（只改工作流文件时两作业都跑；只改体积脚本只跑 web；只改 appid 脚本只跑 miniprogram），证据：`evidence/paths-filter-simulation.log`。模拟只覆盖“过滤规则 → 输出”的映射，不覆盖取 PR 文件列表那一步（须 GitHub 实测）。
- PR 上的实际运行截图须推仓建 PR 后补，见“还剩什么”。

## 验收 2：故意制造类型错误时 typecheck 步骤失败

**本地已验证：失败如预期。**

- 反向用例 `bash tests/negative-cases.sh`（AC2 一节）：在临时目录复制 web 工程并在 `App.tsx` 末尾追加 `const __ac2_bad: number = "类型错误";`，跑 `pnpm typecheck`。
- 证据：`evidence/ac2-typecheck-failure.log`——`tsc --noEmit` 报 `error TS2322`，退出码非 0；仓库原件未动。

## 验收 3：主包超过 BUNDLE_MAX_KB 时作业失败并打印实际体积

**本地已验证：失败如预期，并打印实际体积。**

- 反向用例（AC3 一节）：先正常构建，再 `BUNDLE_MAX_KB=1 node scripts/check-bundle-size.mjs --dist web/dist`。
- 证据：`evidence/ac3-bundle-over-limit.log`——打印全部 chunk 体积与主包实际 KB，报 `超过上限 1 KB`，退出码非 0。
- 通过侧：`evidence/bundle-pass.log`——默认上限 800 KB 时通过并打印同样明细。
- 主包识别：`scripts/check-bundle-size.mjs` 沿 `web/dist/index.html` 的入口引用（`src="...js"`）确定入口 JS；找不到引用时直接失败，不退化为“最大的 js chunk”；门禁只看主包 JS，JS+CSS 合计仅供参考。
- 边界测试 `bash tests/boundary-cases.sh` 8/8 通过：主包恰好 800 KB（819200 字节）通过、约 800.01 KB（819210 字节）失败、819201 字节（最小超限）失败；appid 缺失、为空、null、非占位值均失败、占位值通过。证据：`evidence/boundary-bundle-*.log`、`evidence/boundary-appid-*.log`、`evidence/boundary-cases.log`。

## 验收 4：把 appid 改成非占位值时 miniprogram 作业失败

**本地已验证：失败如预期。**

- 反向用例（AC4 一节）：把 `project.config.json` 的 appid 改成 `wx1234567890abcdef`（虚构测试值），跑 `scripts/check-appid.mjs`。
- 证据：`evidence/ac4-appid-failure.log`——报 `appid 不是占位值`，退出码非 0。
- 通过侧：`evidence/appid-pass.log`——占位值 `touristappid` 时通过。
- 检查方式：`scripts/check-appid.mjs` 精确值匹配（`appid !== 'touristappid'` 即失败）；配置缺失、空值、null 均失败。边界测试同验收 3（8/8 通过）。

## 还剩什么

1. 推仓到公开仓 `AWKN-Lab/clawhunt-3162-frontend-ci`（main 分支），建演示 PR（同时改 `web/**` 与 `miniprogram/**`），等 CI 跑完后补两张成功运行截图（验收 1，P1-4）。推仓前须再送 GPT 复核一轮，并附上 `scripts/check-bundle-size.mjs` 与 `scripts/check-appid.mjs` 两份源码（上一轮只附了日志没附源码）。
2. PR 上若 `actions/upload-artifact` 报 403（见 README“已知的权限说明”），先记下实际错误原文再排查，不预先扩权；`actions: write` 不需要加（上传产物不用它）。
3. 投标：投标价 $81.00 仍适用（范围与验收均未变）；投标本身须走平台提交流程，本次本地交付不含投标动作。
