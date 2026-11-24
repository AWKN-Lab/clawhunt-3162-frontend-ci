# ClawHunt #3162 · GitHub Actions 前端 CI

会员空间平台 · GitHub Actions 前端 CI：工作台构建与小程序 TypeScript 编译。

本仓交付：`.github/workflows/frontend-ci.yml`（web 与 miniprogram 两个作业）+ 两个最小示例工程（工作台一个页面、小程序一个页面），用于证明流水线可用。

## 目录

| 路径 | 说明 |
| --- | --- |
| `.github/workflows/frontend-ci.yml` | 前端 CI：changes（路径过滤）+ web + miniprogram |
| `web/` | 工作台示例：React + TypeScript + Vite + TDesign，一个页面 |
| `miniprogram/` | 小程序示例：微信原生 + TypeScript，一个页面 |
| `scripts/check-bundle-size.mjs` | 构建产物 chunk 体积统计与主包门禁 |
| `scripts/check-appid.mjs` | `project.config.json` 的 appid 占位检查 |
| `scripts/run-all.sh` | 本地全量验证（按 CI 顺序跑全部步骤） |
| `tests/negative-cases.sh` | 反向用例：三条“故意失败”验收逐条真实跑出失败 |
| `evidence/` | 本地实测输出原文 |
| `ACCEPTANCE.md` | 四条验收标准与证据的逐条对照 |

## 工作流说明

- 触发：PR 修改 `web/**`、`miniprogram/**`、`scripts/**` 或本工作流文件时运行。
- `changes` 作业用 `dorny/paths-filter` 判定改了哪边；`web` 与 `miniprogram` 各自只在对应路径被改时跑。`changes` 作业有 `pull-requests: read` 权限（paths-filter 在 PR 事件中调 GitHub REST API 取文件列表要用）；`web` 与 `miniprogram` 保持 `contents: read`。
- 过滤映射：`scripts/check-bundle-size.mjs` 触发 web、`scripts/check-appid.mjs` 触发 miniprogram、工作流文件本身触发两者；只改工作流文件时两个作业都会跑（本地判定模拟见 `tests/paths-filter-simulation.mjs`，`evidence/paths-filter-simulation.log`）。
- `web` 作业：Node 24，pnpm 按 lockfile 安装并缓存，依次跑 lint（ESLint）、typecheck（`tsc --noEmit`）、test（Vitest）、build（Vite）；构建后统计各 chunk 体积，入口 JS 超过 `BUNDLE_MAX_KB`（默认 800）时失败；`dist/` 作为 artifact 保留 7 天。体积门禁口径：只检查入口 JS，不含静态依赖 chunk 与 CSS。
- `miniprogram` 作业：跑 `tsc --noEmit` 与 ESLint，并检查 `project.config.json` 的 appid 为占位值。
- 两个作业都不在日志中打印环境变量；工作流顶层权限只给 `contents: read`，`changes` 作业另加 `pull-requests: read`（见上）；第三方 action 全部固定到提交 SHA；同分支新提交取消旧运行（`concurrency` + `cancel-in-progress`）。

## 本地运行

```bash
# 全量验证（web + miniprogram，输出原文在 evidence/）
bash scripts/run-all.sh

# 反向用例（三条故意失败，输出原文在 evidence/）
bash tests/negative-cases.sh

# 边界测试（体积/appid 边界，输出原文在 evidence/）
bash tests/boundary-cases.sh

# 路径过滤判定模拟（改动文件 → 两作业输出，输出原文在 evidence/）
node tests/paths-filter-simulation.mjs

# 只跑工作台
cd web && pnpm install && pnpm lint && pnpm typecheck && pnpm test --run && pnpm build

# 只跑小程序
cd miniprogram && pnpm install && pnpm typecheck && pnpm lint
```

本地验证环境：Node v24.22.1、pnpm 10.34.9；CI 用 Node 24（见工作流）。Node 20 已于 2026-04-30 EOL，GitHub Actions 已于 2026-09-23 移除 Node 20 运行时，本仓已迁移至 Node 24；Node 20 的本地测试日志保留在 `evidence/node20-*.log`，作历史兼容证据。

本机注意：工作区目录组原为 `nogroup`（65534），pnpm 写文件时会 chown 到父目录属主（0:65534），而本机 overlayfs 拒绝 chown 到 gid 65534，导致安装报 EPERM。已对本交付树执行 `chgrp -R 0` 解决；CI（GitHub runner）不受影响。

## 体积阈值调整方法

主包上限由变量 `BUNDLE_MAX_KB` 控制，默认 800（KB）。

- 改工作流默认值：编辑 `.github/workflows/frontend-ci.yml` 里 `web` 作业的 `env.BUNDLE_MAX_KB`。
- 本地单次覆盖：`BUNDLE_MAX_KB=500 bash scripts/run-all.sh`，或 `BUNDLE_MAX_KB=1 node scripts/check-bundle-size.mjs --dist web/dist`。
- 主包指 `web/dist/index.html` 引用的入口 chunk（有多个入口时全部都要过门禁）；脚本每次都会打印全部 chunk 体积与合计。门禁只检查入口 JS，不含静态依赖 chunk 与 CSS；合计仅供参考。

## appid 占位值

`miniprogram/project.config.json` 的 appid 必须是占位值 `touristappid`（微信开发者工具的游客 appid）。真实 appid 只在发布流程注入，仓库里出现非占位值时 `miniprogram` 作业失败。检查脚本：`scripts/check-appid.mjs`。

## 已知的权限说明

工作流顶层权限只给 `contents: read`（按本单要求）；`changes` 作业另加 `pull-requests: read`（见上）。以下两点如在 PR 运行中出现需留意：

- `actions/upload-artifact@v4` 上传 `dist/` 不需要 `actions: write`（`actions: write` 是管理 Actions 用的，如取消运行）。保持 `contents: read` 即可。首次 PR 实测上传步骤：若上传步骤报 403，先把实际错误原文记下来再排查（可能是 token 权限、artifact 名称或路径问题），不预先扩权。
- Actions Cache 使用独立缓存权限。缓存写入受限时可能出现保存警告，不影响构建步骤；无需因此增加 GITHUB_TOKEN 的 `actions: write` 权限。

## 数据与保密

两个示例工程只用虚构的演示数据（演示空间 A/B/C、演示企业），不含任何真实个人信息、企业信息或客户名称。
