<div align="center">

<img src="https://raw.githubusercontent.com/MingoZhou/dsh-replay/main/assets/jingxiaoshen.png" width="120" alt="鲸小深，dsh-replay 吉祥物" />

# dsh-replay

**给 DeepSeek Harness 会话做只读复盘。**<br/>
成本 · 审计 · 分支树 · 对比 · 可分享 HTML —— **不调用模型，不消耗 token。**

[English](README.md) · [在线 Demo](https://mingozhou.github.io/dsh-replay/) · [安装](#安装) · [为什么不是 Trajectory？](#为什么不是-trajectory) · [隐私](PRIVACY.md)

[![npm](https://img.shields.io/npm/v/@mingozhou/dsh-replay)](https://www.npmjs.com/package/@mingozhou/dsh-replay)
[![downloads](https://img.shields.io/npm/dm/@mingozhou/dsh-replay)](https://www.npmjs.com/package/@mingozhou/dsh-replay)
[![ci](https://github.com/MingoZhou/dsh-replay/actions/workflows/ci.yml/badge.svg)](https://github.com/MingoZhou/dsh-replay/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![dsh](https://img.shields.io/badge/DSH-0.2.1--rc.2-4d6bfe.svg)](https://github.com/MingoZhou/dsh-replay#兼容性)

> **Desktop 一键安装：** **插件 → Add plugin → `@mingozhou/dsh-replay` → Install** → 重启。
> Web/源码：[`dsh plugin --profile <profile> add …`](#安装)。

<img src="https://raw.githubusercontent.com/MingoZhou/dsh-replay/main/assets/demo-zh.webp" width="880" alt="dsh-replay 15 秒演示：档案、成本、审计、导出" />

<sub>15 秒演示 · 示例会话 · 导出的 HTML 完全离线、只读<br/>[GIF 备用](https://raw.githubusercontent.com/MingoZhou/dsh-replay/main/assets/demo-zh.gif) · [完整 demo](https://mingozhou.github.io/dsh-replay/)</sub>

</div>

> **这里的“回放”是只读的。** dsh-replay 不会把会话重新发给模型，不写日志，也不消耗 token。它只是解析 append-only 日志并渲染出来。详见 [FAQ](#faq)。
>
> **历史注记（保留原文，不做删除）**：~~DeepSeek Harness 有一套优雅的 append-only 日志，官方承诺“到达模型的一切都可从日志重建”——但它没有配查看器。**dsh-replay 就是那个查看器。**~~
> 这句话写于 **2026-08**，当时是事实。自 **DSH 0.2.1-rc.2** 起，官方 Web UI 已内置 **Trajectory（轨迹）** 视图，覆盖当前会话的事件账本。dsh-replay 现在做的是 **档案层**：所有会话、成本、Windows 可用的安全审计、分支/对比，以及可脱敏分享的 HTML。[下面有对照](#为什么不是-trajectory)。

---

## 安装

### DeepSeek Harness Desktop（推荐）

1. 左侧栏打开 **插件（Plugins）**。
2. 点 **Add plugin / 添加插件**。
3. 输入 `@mingozhou/dsh-replay`，点 **Install**。
4. 重启 Harness。

> Desktop 的 profile 由 Electron 应用独占管理，`dsh plugin --profile desktop …` 会被拒绝（`profile "desktop" is managed exclusively by the Electron application`）。这不是插件坏了，请用插件页安装。

<img src="https://raw.githubusercontent.com/MingoZhou/dsh-replay/main/assets/plugins-installed.png" width="720" alt="DeepSeek Harness 插件页中的 dsh-replay" />

<sub>插件 → 已安装插件。这是 0.4.1 的条目；0.4.2 会显示新的描述。</sub>

### Web UI / 源码模式

```sh
# 发行版 CLI（npm i -g @deepseek-ai/dsh）
dsh plugin --profile <你的profile> add @mingozhou/dsh-replay

# 从 Harness 源码跑（profile 名为 web）
cd deepseek-harness
pnpm dsh plugin --profile web add @mingozhou/dsh-replay
```

用 `dsh --profile <你的profile> --dump-config` 确认出现 `@mingozhou/dsh-replay` / `replay` 行，然后重启 Harness。

### 从源码安装（开发 / 未发布改动）

```sh
git clone https://github.com/MingoZhou/dsh-replay.git
cd dsh-replay
npm install && npm run build      # lib/ 是构建产物
npm run demo                      # http://localhost:4173，不需要 Harness
```

让 profile 指向文件夹：

```sh
dsh plugin --profile <你的profile> add <插件绝对路径>/dsh-replay
```

### 卸载

- **Desktop**：插件 → dsh-replay → **Remove**。
- **Web**：`dsh plugin --profile <你的profile> remove @mingozhou/dsh-replay`
- **手动兜底**：从 profile 的 `package.json` 的 `dependencies` 和 `dsh.profile.bundles` 两处删除 `@mingozhou/dsh-replay`，在该目录 `pnpm install`，重启。

---

## 为什么不是 Trajectory？

Trajectory 对**当前会话**很好：实时账本、时间概览、逐条 token、思考、系统提示词、虚拟滚动。只需要这些，直接用官方视图就好。dsh-replay 解决的是**会话结束之后**、以及官方视图没回答的问题：

| | 官方 Trajectory | dsh-replay |
| --- | --- | --- |
| 范围 | 当前会话 | **所有会话 + 档案仪表盘** |
| 时间线 | 原生、实时、虚拟化 | 回放、思考、系统提示词、工具摘要 |
| 成本 | token 计数 | **分模型成本、USD/CNY、可编辑价格表** |
| 风险 | — | **Windows 可用的审计、基线抑制、密钥脱敏** |
| 血缘 | — | **分支树 + 精确分岔 + 成本/风险差值** |
| 分享 | 原始会话 ZIP | **脱敏、离线、可交互 HTML** |
| 数据 | 会话内 | **本地档案；无遥测** |

两者可以共存。dsh-replay 不是替代 Trajectory，而是回答“这么多会话里发生了什么、花了多少钱、哪里有风险、怎么给同事看”。

---

## 你会得到什么

| | |
| --- | --- |
| 📊 **档案仪表盘** | 这台机器上的所有会话：本月/全部 token、估算成本、高危发现，按标题/ID/工作区搜索。 |
| 💰 **分模型成本** | 缓存感知的 token 统计、分模型明细、USD/CNY、可编辑价格表。多模型会话不再把全部 token 按一个费率算。 |
| 🛡️ **Windows 可用的审计** | 同时识别 `pwsh`/PowerShell/`cmd` 和 bash；递归删除、凭据读取、外传、持久化、策略变更。会话初始的 permission/sandbox 视为基线，不再每次报 2 条 serious。 |
| 🔐 **密钥脱敏** | 常见 API key、`.env` 赋值、私钥、用户主目录。导出前显示将遮罩多少处。 |
| 📤 **可分享 HTML** | 把一个会话烤进单个离线 `.html`：对方零安装、无网络、不调用模型。适合 bug report 和复盘。 |
| 🌿 **分支树** | 完整血缘、子 Agent、fork 边界，点击直达。 |
| ⚖️ **对比** | 任意两个会话：指标、工具分布、成本/风险差、完整血缘关系、两边首个差异事件。 |
| ⏪ **时间线** | 1–16 倍速回放、思考、系统提示词、搜索、类型过滤、键盘导航；工具标签是命令/路径/URL 摘要，不再是 JSON 墙。 |
| 🌏 **中英双语** | 应用 UI 可切换中英文；DSH 注入的会话视图标签由宿主决定。 |

### 仪表盘、成本、审计、导出

<div align="center">
<img src="https://raw.githubusercontent.com/MingoZhou/dsh-replay/main/assets/overview-zh.png" width="880" alt="概览与成本估算" />
<img src="https://raw.githubusercontent.com/MingoZhou/dsh-replay/main/assets/audit-zh.png" width="880" alt="安全审计：基线抑制、密钥脱敏" />
<img src="https://raw.githubusercontent.com/MingoZhou/dsh-replay/main/assets/export-zh.png" width="880" alt="脱敏、离线 HTML 导出对话框" />
</div>

更多：[仪表盘](https://raw.githubusercontent.com/MingoZhou/dsh-replay/main/assets/dashboard-zh.png) · [时间线](https://raw.githubusercontent.com/MingoZhou/dsh-replay/main/assets/timeline-zh.png) · [分支](https://raw.githubusercontent.com/MingoZhou/dsh-replay/main/assets/forks-zh.png) · [对比](https://raw.githubusercontent.com/MingoZhou/dsh-replay/main/assets/compare-zh.png)

---

## 0.4.2 改了什么

这是一次“还活着”的维护版，优先修信任和首次体验：

- **审计正确性**：`pwsh`/PowerShell/`cmd`、Windows 删除/提权/凭据/外传；初始 `permission/preset` / `sandbox/mode` 不再报；普通 write/network 不再刷屏。
- **成本正确性**：分模型累计；混合模型分别计价；价格表可编辑；USD/CNY。
- **分享安全**：脱敏预览 + 数量 + 大小；未脱敏导出需要显式勾选；导出视图不再显示空的 Forks/Compare。
- **真的变小了**：client bundle **2.0 MB → 232 KB**；吉祥物 **1.4 MB → 73 KB**；README GIF **28.8 MB → 164 KB**；15 秒 WebP **116 KB**。
- **时间线更好用**：思考、系统提示词、模型选择、工具摘要、键盘导航；过滤时保持选中事件。
- **档案仪表盘**：所有会话、本月/全部、token、成本、风险、搜索、工作区过滤。
- **隐私/安全**：API 默认仅 loopback；密钥脱敏；新增 [PRIVACY.md](PRIVACY.md) 和 [SECURITY.md](SECURITY.md)。
- **兼容性**：`engines.dsh`；目标版本 DSH Desktop 0.2.1-rc.2（已对照运行中的 `sessionQuery` 契约；UI 在 demo 模式验证）。

---

## 兼容性

| 组件 | 测试 / 要求 |
| --- | --- |
| DSH Desktop | **0.2.1-rc.2** — 目标版本 / API 契约已核对 |
| DSH Web | 预期 0.2.x（同一套 `sessionQuery` / webServer 契约） |
| Node | **22+** |
| 包版本 | `@mingozhou/dsh-replay@0.4.2` |
| 插件 API 范围 | `engines.dsh >= 0.2.0-rc.8` |

DSH 迭代很快。如果未来版本改坏适配层，`npm run demo` 仍然可用，因为分析/UI 层独立于宿主。遇到问题请附上 DSH 版本和失败的路由。

---

## 隐私与安全

- 插件通过 `ctx.sessionQuery` 读取会话日志；**不写入会话数据**。
- UI 只请求**本地 DSH origin**；无遥测、无云端解析。
- 宿主 API 默认**仅 loopback**、只读。`allowRemote` 是显式 opt-in，且仍然没有认证——不要把端口暴露到网络。
- 导出的 HTML 自包含、离线。**会话日志是原始数据**：导出会遮罩常见凭据，但分享前仍建议自己检查。
- 详见 [PRIVACY.md](PRIVACY.md) 和 [SECURITY.md](SECURITY.md)。

---

## FAQ

**“回放”会重新跑会话 / 调用模型吗？**
不会。它只读取 append-only 日志。不发模型请求、不消耗 token、不写日志。这也是 [issue #2](https://github.com/MingoZhou/dsh-replay/issues/2)，现在放进 FAQ。

**那为什么叫 replay？**
项目开始时官方还没有轨迹视图；“回放”指“播放录像”，不是“重赛”。现在 UI 叫 **会话复盘 / Session Review**，README 第一屏也明确写了只读。

**官方已经有 Trajectory，为什么还装这个？**
Trajectory 是单会话、实时的；dsh-replay 是跨会话档案，并补上钱、风险、血缘、分享。对照见[上面](#为什么不是-trajectory)。

**Windows 能用吗？**
能。0.4.2 专门补了 `pwsh`/PowerShell/`cmd` 和 Windows 路径；旧版审计完全看不到 `Remove-Item`，现在会报。

**为什么包变小了？**
旧版把 1.4 MB 吉祥物 base64 进了每个 client bundle。现在换成 73 KB 的 256px 图；侧栏仍然是彩色吉祥物（没有改成单色 SVG），基础 client bundle 约 232 KB。

**插件页显示已安装，但没有入口？**
完整重启 Harness；客户端插件集合只在启动时扫描。源码安装请确认 `lib/client.js` 存在（`npm run build`）。

**`GET /replay/api/sessions` 返回 404？**
profile 没有组合进 bundle。重新添加并检查配置；Desktop 用插件页，Web 用 `dsh --profile <profile> --dump-config`。

**Desktop 上 `dsh plugin --profile desktop …` 失败？**
正常：Desktop 应用独占该 profile。请用 **插件 → 添加插件**。

**脱敏是绝对安全的吗？**
不是。它是正则匹配、尽力而为；对话框会告诉你遮罩了多少处，未脱敏导出需要手动勾选。真实会话分享前请自己再看一遍。

---

## 路线图

- **从 `edit`/`write` 重建文件 diff**（比原始账本更有价值的下一项）。
- **标注 + 分享链接**。
- **更深的审计规则包**（供应链、网络外传、CI 凭据）+ 规则编辑。
- **更多档案分析**：按工作区花费、周报、预算提醒。
- **从审计发现直达原生 Trajectory**，而不是维护第二套时间线。

实时跟随不是重点：Trajectory 已经做得很好。dsh-replay 把精力放在档案、钱、风险和分享上。

---

## Star

如果 dsh-replay 帮你省下了一个下午的翻日志时间，点个 ⭐ 能让更多 DSH 用户找到它：

**[github.com/MingoZhou/dsh-replay](https://github.com/MingoZhou/dsh-replay)** · [在线 Demo](https://mingozhou.github.io/dsh-replay/) · [Issues](https://github.com/MingoZhou/dsh-replay/issues) · [Discussions](https://github.com/MingoZhou/dsh-replay/discussions)

想写文章？可编辑的发布文案在 [docs/content](docs/content/README.md)。

---

## 许可与致谢

MIT。鲸小深是为本项目创作的原创角色——不是 DeepSeek 官方 logo，也不是第三方同人作品。吉祥物图在 `assets/jingxiaoshen.png`，替换后重新构建即可嵌入。

`core/` 是零依赖分析层，可单独 `import`（`dsh-replay/core`），用来做自己的会话日志工具。它理解打包 chunk row、崩溃残尾、seed 边界、压缩遮蔽、reasoning block 和分模型 usage。
