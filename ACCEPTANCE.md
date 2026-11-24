# 验收对照 · ClawHunt #3162

单子：GitHub Actions 前端 CI：工作台构建与小程序 TypeScript 编译。
截止：2026-11-30。投标价：$81.00（90%）。

本地验证环境：Node v24.22.1、pnpm 10.34.9；CI 用 Node 24（见工作流）。Node 20 已于 2026-04-30 EOL，GitHub Actions 已于 2026-09-23 移除 Node 20 运行时，本仓已迁移至 Node 24（见下“Node 24 迁移记录”）；Node 20 的本地测试日志保留在 `evidence/node20-*.log`，作历史兼容证据（当时 web 与 miniprogram 全套步骤 10/10 通过，build 54.71s、主包 619.02 KB）。

GPT 复核（2026-11-25，修改后 GO）已按七点改完：P0-1 changes 作业补 `pull-requests: read`；P0-2 触发路径加 `scripts/**`、过滤映射补两个检查脚本与工作流文件；P0-3 工作流文件改动触发两个作业（判定模拟 9/9 通过）；P1-1 README 删掉 `actions: write` 建议；P1-2 体积脚本只认 index.html 入口引用、边界测试 8/8 通过；P1-3 Node 20 实测通过（上）；P1-4 演示 PR 与截图已完成（PR #1，run 45473363943，见验收 1）。

GPT 复核第二轮（2026-11-25 01:14，修改后 GO）：七项整改基本落实，抓出新 P0——Node 20 已停服，工作流必须迁到 Node 24；另 P1 一项——README 缓存权限说明错误。裁决全文见 `~/workspace/goals/20/files/GPT复核-3162交付-2026-11-25-第二轮.md`。本次迁移已按裁决做完三项必须完成 + 两项建议。

## Node 24 迁移记录（2026-11-25）

- 工作流两个作业的 node-version 由 '20' 改为 '24'；第三方 Action 全部升级到声明 node24 运行时的版本，并重新固定到完整 commit SHA（每个版本均用 gh api 实查：读该版本 action.yml 的 runs.using 确认为 node24）。

| Action | 新版本 | 固定 SHA |
| --- | --- | --- |
| actions/checkout | v7.0.1 | 3d3c42e5aac5ba805825da76410c181273ba90b1 |
| actions/setup-node | v7.1.0 | 949feb2413d6458794dcd2491c4babbbce0c15c1 |
| actions/upload-artifact | v7.0.2 | cf430e030ddbb5b0abf93d22962f4752f3646cd9 |
| pnpm/action-setup | v6.1.1 | 73e46992e05b19abd31f2f3c20e0e7370d762115 |
| dorny/paths-filter | v4.0.3 | ceb8a2b8f2d89434be7ff52d3de7ec3738c5cc9d |

- README 缓存说明按 GPT 改法重写：Actions Cache 使用独立缓存权限，缓存写入受限时可能出现保存警告，不影响构建步骤；无需因此增加 GITHUB_TOKEN 的 `actions: write` 权限。删掉原来“pnpm 缓存保存同样需要写权限”的错误说法。
- `scripts/check-bundle-size.mjs` 增加多入口检测（取 index.html 里全部 `src="...js"`，不再只取第一个）与 assets/ 递归扫描；门禁口径写清：只检查入口 JS，不含静态依赖 chunk 与 CSS。
- `tests/boundary-cases.sh` 的失败用例除退出码非零外，再验脚本自身的失败标记（CHECK FAILED），避免脚本自身异常被误判为门禁通过。

Node 24 下全套重验（本机 Node v24.22.1、pnpm 10.34.9，2026-11-25）：

- `scripts/run-all.sh`：RESULT: PASS——web 安装、lint、typecheck、test 3/3、build（41.91s）、体积门禁主包 619.02 KB；miniprogram 安装、typecheck、lint、appid 检查；边界测试 8/8；路径过滤判定模拟 9/9。
- `tests/negative-cases.sh`：RESULT: PASS——AC2 追加错误类型报 error TS2322（exit 2）；AC3 上限压到 1KB 报“超过上限 1 KB”并打印实际体积（exit 1）；AC4 appid 改虚构值报“不是占位值”（exit 1）。
- 多入口与嵌套扫描专项（`evidence/node24-bundle-multi-entry.log`）：双入口其一超限时失败并点名超限入口；入口在 assets/sub/ 嵌套目录时递归扫描找到并通过；双入口均在限内通过；非入口大 chunk（900KB 静态依赖）超限时门禁仍通过（只看入口 JS）。
- 新日志全部以 node24- 前缀存进 `evidence/`（25 份），与 node20-*.log（11 份）并存，未覆盖、未删除。

## 验收 1：web 与 miniprogram 两个作业在 PR 上均通过（附截图）

**线上状态：通过。演示 PR #1（分支 demo/ac1-20261125，提交 6c146ab），CI 运行 45473363943 已完成，结论 success，总耗时 55 秒；三个作业全部成功：变更检测 12 秒、web（工作台）37 秒、miniprogram（小程序）16 秒；产物 web-dist 1 个，207 KB（212,075 字节），未过期。两作业均实际运行，证明 paths-filter 在真实 PR 文件列表上对 web 与 miniprogram 均返回 true；artifact 上传在 contents: read 下成功，未报 403，`actions: write` 不需要。截图已归档：`evidence/ci-run-45473363943-overview.pdf`（运行总览，1 页）与 `evidence/ci-run-45473363943-web-job.pdf`（web 作业详情，2 页；浏览器工具只提供页面存 PDF，未提供 PNG 直存，故为 PDF 存档）。**

- 本地全量验证 `bash scripts/run-all.sh`，RESULT: PASS，输出原文见 `evidence/`：
- `web-lint.log`、`web-typecheck.log`、`web-test.log`、`web-build.log`、`bundle-pass.log`
- `mini-typecheck.log`、`mini-lint.log`、`appid-pass.log`
- 工作流本身（`.github/workflows/frontend-ci.yml`）含 `changes` + `web` + `miniprogram` 三个作业；演示 PR 同时改 `web/**` 与 `miniprogram/**`，两个作业都会跑。
- GPT 复核 P0 改动：`changes` 作业有 `pull-requests: read` 权限（paths-filter 在 PR 事件中调 GitHub REST API 取文件列表要用）；触发路径含 `scripts/**`；过滤映射：`scripts/check-bundle-size.mjs` → web、`scripts/check-appid.mjs` → miniprogram、工作流文件本身 → 两者。判定模拟 `node tests/paths-filter-simulation.mjs` 9/9 通过（只改工作流文件时两作业都跑；只改体积脚本只跑 web；只改 appid 脚本只跑 miniprogram），证据：`evidence/paths-filter-simulation.log`。模拟只覆盖“过滤规则 → 输出”的映射，不覆盖取 PR 文件列表那一步（须 GitHub 实测）。
- PR 上的实际运行已完成并归档，见本节线上状态。

## 验收 2：故意制造类型错误时 typecheck 步骤失败

**本地已验证：失败如预期。**

- 反向用例 `bash tests/negative-cases.sh`（AC2 一节）：在临时目录复制 web 工程并在 `App.tsx` 末尾追加 `const __ac2_bad: number = "类型错误";`，跑 `pnpm typecheck`。
- 证据：`evidence/ac2-typecheck-failure.log`——`tsc --noEmit` 报 `error TS2322`，退出码非 0；仓库原件未动。

## 验收 3：主包超过 BUNDLE_MAX_KB 时作业失败并打印实际体积

**本地已验证：失败如预期，并打印实际体积。**

- 反向用例（AC3 一节）：先正常构建，再 `BUNDLE_MAX_KB=1 node scripts/check-bundle-size.mjs --dist web/dist`。
- 证据：`evidence/ac3-bundle-over-limit.log`——打印全部 chunk 体积与主包实际 KB，报 `超过上限 1 KB`，退出码非 0。
- 通过侧：`evidence/bundle-pass.log`——默认上限 800 KB 时通过并打印同样明细。
- 主包识别：`scripts/check-bundle-size.mjs` 沿 `web/dist/index.html` 的入口引用（`src="...js"`）确定入口 JS；找不到引用时直接失败，不退化为“最大的 js chunk”；门禁只看入口 JS（限定入口 JS：index.html 引用的全部入口都要过门禁，静态依赖 chunk 与 CSS 不计入），JS+CSS 合计仅供参考；assets/ 递归扫描，嵌套子目录的 JS 也计入清单。
- 边界测试 `bash tests/boundary-cases.sh` 8/8 通过：主包恰好 800 KB（819200 字节）通过、约 800.01 KB（819210 字节）失败、819201 字节（最小超限）失败；appid 缺失、为空、null、非占位值均失败、占位值通过。证据：`evidence/boundary-bundle-*.log`、`evidence/boundary-appid-*.log`、`evidence/boundary-cases.log`。

## 验收 4：把 appid 改成非占位值时 miniprogram 作业失败

**本地已验证：失败如预期。**

- 反向用例（AC4 一节）：把 `project.config.json` 的 appid 改成 `wx1234567890abcdef`（虚构测试值），跑 `scripts/check-appid.mjs`。
- 证据：`evidence/ac4-appid-failure.log`——报 `appid 不是占位值`，退出码非 0。
- 通过侧：`evidence/appid-pass.log`——占位值 `touristappid` 时通过。
- 检查方式：`scripts/check-appid.mjs` 精确值匹配（`appid !== 'touristappid'` 即失败）；配置缺失、空值、null 均失败。边界测试同验收 3（8/8 通过）。

## 还剩什么

1. 演示 PR 与截图已完成（PR #1，run 45473363943，AC1 线上通过；见验收 1）。演示 PR 本身暂不合并（仅两行注释触发用）；是否合并另行决定。
2. `actions/upload-artifact` 在 PR 上实际上传成功（web-dist，207 KB），未报 403；`actions: write` 确认不需要加。
3. 投标：投标价 $81.00 仍适用（范围与验收均未变）；投标本身须走平台提交流程，本次本地交付不含投标动作。
