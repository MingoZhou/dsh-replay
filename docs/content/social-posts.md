# Social posts / 发布文案

Use the screenshots in `assets/`:
- dashboard-zh.png (best first image)
- overview-zh.png (cost + chart)
- audit-zh.png (risk)
- export-zh.png (share)

Replace the bracketed numbers with your own session. Do not post a real session
without reviewing the exported/redacted file.

## V2EX

**标题：** 给 DeepSeek Harness 写了一个“会话尸检”插件，顺便回答一个被问烂的问题

**正文：**

之前发过 dsh-replay，最早是给 Harness 的 append-only 日志做回放。后来官方出了 Trajectory，我就把重心改了：不再卷“当前会话的时间线”，而是做跨会话的档案、成本、安全审计和分享。

先回答最多人问的：**回放不会把 session 重新发给模型，也不花 token。** 它只是读日志，像看录像，不是重赛。

现在打开是一个档案仪表盘：这个月跑了多少会话、花了多少、哪些会话有高危操作。点进去有分模型成本、Windows 可用的审计（`pwsh`/`Remove-Item` 也能识别）、分支对比，以及一键导出脱敏 HTML。

仓库：https://github.com/MingoZhou/dsh-replay
Demo：https://mingozhou.github.io/dsh-replay/

Desktop 在「插件 → Add plugin」里输入 `@mingozhou/dsh-replay` 就能装。欢迎拍砖。

## 小红书

**标题：** 让 AI 跑完 5 小时，我只想知道它到底干了啥

Agent 跑完一个长任务，只回一句“完成了”，真的很像开盲盒。

我给它做了个“会话尸检”工具：
💰 分模型算钱，缓存也算进去
🛡️ 标出删库、读 `.env`、密钥外传
🌿 两个 fork 从哪个事件分岔
📤 一键导出离线 HTML，同事不用装任何东西

重点：**只读，不会重跑模型，不花 token。**

在线 demo 放这里，点开就能玩：https://mingozhou.github.io/dsh-replay/
GitHub：https://github.com/MingoZhou/dsh-replay

#DeepSeek #AIAgent #程序员工具 #开源 #效率工具

## 知乎

**标题：** Agent 跑完长任务只回“完成了”，怎么复盘？

可以顺着三个问题做：

1. **钱**：token 不等于成本。长会话可能中途换模型，缓存命中率也在变；要分模型、缓存感知地估。
2. **风险**：不能只看 bash。Windows 上的 `pwsh`、`Remove-Item -Recurse -Force`、`iwr | iex` 同样危险；还要看 `.env`、私钥、工具输出里的 key。
3. **分享**：会话日志是原始数据，直接发出去可能泄露密钥。导出前要脱敏，并且让对方零安装打开。

我把自己用的工具开源了：dsh-replay。它不重跑模型，只读日志；现在有档案仪表盘、分模型成本、Windows 审计、分支对比和脱敏 HTML 导出。

https://github.com/MingoZhou/dsh-replay

（DSH 0.2.1-rc.2 已内置 Trajectory 看当前会话；dsh-replay 做的是“所有会话 + 结束之后”。两者不冲突。）

## X / Twitter

I built a read-only “session autopsy” for DeepSeek Harness.

Not a rerun: no model calls, no tokens, no writes.
It reads the append-only log and gives you:

- archive dashboard across sessions
- per-model cost (cache-aware, USD/CNY)
- Windows-aware audit (pwsh, Remove-Item, .env)
- fork/compare + redacted standalone HTML

Demo: https://mingozhou.github.io/dsh-replay/
Repo: https://github.com/MingoZhou/dsh-replay

## Reddit (r/LocalLLaMA or r/LLMDevs)

**Title:** I built a read-only session autopsy for DeepSeek Harness (cost, audit, fork compare, shareable HTML)

I kept asking the same questions after long agent runs: where did the tokens go, did it touch `.env`, and how do I show a teammate without shipping my whole harness?

dsh-replay reads the append-only session log and renders it. It makes no model calls and spends no tokens.

What it adds over the built-in Trajectory view (which is great for the current session):
- archive dashboard across every session
- per-model, cache-aware cost + editable price table
- Windows-aware audit (`pwsh`, `Remove-Item`, encoded PowerShell, credential reads)
- fork tree + exact divergence + cost/risk deltas
- redacted standalone HTML export

Demo: https://mingozhou.github.io/dsh-replay/
Repo: https://github.com/MingoZhou/dsh-replay

Feedback welcome — especially on audit false positives/negatives.
