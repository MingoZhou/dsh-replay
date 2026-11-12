/**
 * Lightweight EN/中文 i18n for the replay UI. The dictionary is plain data;
 * `useI18n()` provides `t(key, params)` plus the current language and setter.
 * Language resolution: explicit choice (persisted) > browser language > en.
 */
import React from 'react'
import type { AuditFinding } from '../core/audit.js'
import type { TimelineItem } from '../core/timeline.js'

export type Lang = 'en' | 'zh'

const STORAGE_KEY = 'dshr-lang'

/** key → [English, 中文] */
const MESSAGES: Record<string, readonly [string, string]> = {
  "btn.replay": ["Session Replay", "会话回放"],
  "modal.close": ["Close", "关闭"],
  "app.loading": ["Loading…", "加载中…"],
  "app.loadingText": ["Jing Xiaoshen is rewinding the log…", "鲸小深正在倒带日志…"],
  "app.error": ["Failed to load — {error}. Is the dsh-replay host plugin enabled?", "加载失败 — {error}。请确认 dsh-replay 宿主插件已启用。"],
  "picker.empty": ["No sessions yet — run something first!", "还没有会话，先跑点什么吧！"],
  "common.copy": ["Copy", "复制"],
  "common.copied": ["Copied", "已复制"],
  "common.more": ["Show {n} more", "再显示 {n} 条"],
  "common.less": ["Show less", "收起"],
  "common.save": ["Save", "保存"],
  "common.cancel": ["Cancel", "取消"],
  "tab.overview": ["Report", "报告"],
  "tab.timeline": ["Timeline", "时间线"],
  "tab.files": ["Files", "文件改动"],
  "tab.audit": ["Audit", "审计"],
  "tab.forks": ["Forks", "分支"],
  "tab.compare": ["Compare", "对比"],
  "hdr.turns": ["{n} turns", "{n} 轮"],
  "kind.user": ["user", "用户"],
  "kind.assistant": ["assistant", "助手"],
  "kind.tool": ["tool", "工具"],
  "kind.meta": ["meta", "元事件"],
  "kind.context": ["context", "上下文"],
  "sev.critical": ["Critical", "严重"],
  "sev.serious": ["Serious", "较高"],
  "sev.warning": ["Warning", "警告"],
  "sev.info": ["Info", "信息"],
  "rep.score": ["Run score", "运行评分"],
  "rep.verdict.good": ["Healthy run", "运行健康"],
  "rep.verdict.warning": ["Worth a look", "值得留意"],
  "rep.verdict.critical": ["Needs attention", "需要处理"],
  "rep.noDeductions": ["No deductions — nothing failed, looped or tripped an audit rule.", "没有扣分项：无失败、无重复调用、无审计命中。"],
  "rep.ded.critical": ["{n} critical audit finding(s)", "{n} 条严重审计发现"],
  "rep.ded.serious": ["{n} serious audit finding(s)", "{n} 条较高风险审计发现"],
  "rep.ded.failures": ["{n} failed tool call(s)", "{n} 次工具调用失败"],
  "rep.ded.loops": ["{n} repeated-call loop(s)", "{n} 组重复调用"],
  "rep.ded.retries": ["{n} model retry(ies)", "{n} 次模型重试"],
  "rep.ded.abnormal": ["{n} turn(s) ended abnormally", "{n} 轮异常结束"],
  "rep.cost": ["Cost", "成本"],
  "rep.estimate": ["estimate", "估算"],
  "rep.peakShare": ["{pct} at peak rate", "{pct} 按高峰价计"],
  "rep.peakShort": ["peak {pct}", "高峰 {pct}"],
  "rep.active": ["Active time", "活跃时长"],
  "rep.idle": ["+ {d} waiting for you", "另有 {d} 在等你"],
  "rep.tokens": ["Tokens", "Token"],
  "rep.tokensSub": ["in {in} · out {out}", "输入 {in} · 输出 {out}"],
  "rep.cache": ["Cache hit rate", "缓存命中率"],
  "rep.saved": ["saved ≈ {money}", "约省 {money}"],
  "rep.calls": ["Tool calls", "工具调用"],
  "rep.callsFailed": ["{n} failed", "{n} 次失败"],
  "rep.callsClean": ["none failed", "全部成功"],
  "rep.turns": ["Turns / steps", "轮次 / 步数"],
  "rep.ttft": ["first token ≈ {d}", "首 token ≈ {d}"],
  "rep.vsMedian": ["{pct} vs median of your last {n}", "对比近 {n} 次中位数 {pct}"],
  "rep.timeMap": ["Where the time went", "时间去哪了"],
  "rep.timeMapHint": ["real durations; idle gaps between turns are folded · click a block to open it", "按真实耗时绘制，轮次之间的空闲已折叠 · 点击色块可定位"],
  "rep.lane.model": ["model", "模型"],
  "rep.failed": ["failed", "失败"],
  "rep.idleGap": ["idle {d}", "空闲 {d}"],
  "rep.split.model": ["Model", "模型"],
  "rep.split.tool": ["Tools", "工具"],
  "rep.split.other": ["Approvals & overhead", "审批与其他"],
  "rep.split.idle": ["Waiting for user", "等待用户"],
  "rep.cumCost": ["Cumulative cost", "累计成本"],
  "rep.cumTokens": ["Cumulative tokens", "累计 Token"],
  "rep.unit.cost": ["Cost", "成本"],
  "rep.unit.tokens": ["Tokens", "Token"],
  "rep.noUsage": ["This log carries no token usage.", "这份日志没有记录 Token 用量。"],
  "rep.context": ["Context size per step", "每步上下文大小"],
  "rep.contextSeries": ["prompt tokens", "提示词 Token"],
  "rep.contextPeak": ["peak {peak} · {pct} of window", "峰值 {peak} · 占窗口 {pct}"],
  "rep.compactMark": ["compacted", "压缩"],
  "rep.window": ["context window", "上下文窗口"],
  "rep.attention": ["Needs attention", "需要关注"],
  "rep.attentionEmpty": ["Nothing stands out.", "没有需要特别关注的地方。"],
  "rep.att.audit": ["Audit: {critical} critical, {serious} serious", "审计：{critical} 条严重，{serious} 条较高"],
  "rep.att.loop": ["{name} called {n}× in a row with identical arguments", "{name} 用相同参数连续调用了 {n} 次"],
  "rep.att.turn": ["Turn {n} ended: {reason}", "第 {n} 轮异常结束：{reason}"],
  "rep.att.failed": ["{n} of {total} tool calls failed", "{total} 次工具调用中有 {n} 次失败"],
  "rep.att.retries": ["{n} model request(s) had to be retried", "{n} 次模型请求被重试"],
  "rep.att.slow": ["Slow call: {name}", "慢调用：{name}"],
  "rep.att.compaction": ["Context was compacted {n}×", "上下文被压缩了 {n} 次"],
  "rep.att.unpriced": ["No price for: {models} — add it in Settings", "以下模型没有定价：{models}，可在设置里添加"],
  "rep.costParts": ["Cost breakdown", "成本构成"],
  "rep.unverified": ["includes unverified reference prices", "含未核对的参考价"],
  "rep.tools": ["Tool time", "工具耗时"],
  "rep.noTools": ["No tool calls.", "没有工具调用。"],
  "rep.filesLink": ["{n} files · +{add} −{del}", "{n} 个文件 · +{add} −{del}"],
  "rep.toolFailTitle": ["{name}: {n} of {total} calls failed", "{name}：{total} 次调用中 {n} 次失败"],
  "ts.title": ["Tokens per step", "每步 Token"],
  "ts.input": ["input (billed)", "输入（计费）"],
  "ts.output": ["output", "输出"],
  "ts.total": ["Σ in {in} · out {out}", "Σ 输入 {in} · 输出 {out}"],
  "ts.cacheRead": [" · cache read {n}", " · 缓存读 {n}"],
  "ts.barTitle": ["turn {turn} step {step} — in {in} / out {out}", "第 {turn} 轮 第 {step} 步 — 输入 {in} / 输出 {out}"],
  "tl.empty": ["This session has no renderable events.", "这个会话没有可显示的事件。"],
  "tl.noMatch": ["Nothing matches the current filter.", "没有符合当前筛选的内容。"],
  "tl.turn": ["Turn {n}", "第 {n} 轮"],
  "tl.turnShort": ["T{n}", "第{n}轮"],
  "play.event": ["{i}/{n}", "{i}/{n}"],
  "play.position": ["timeline position", "时间线位置"],
  "play.speed": ["playback speed", "播放速度"],
  "flt.search": ["search… or #seq", "搜索… 或 #序号"],
  "flt.failed": ["failed", "失败"],
  "keys.move": ["move", "上下移动"],
  "keys.turn": ["prev / next turn", "上一轮 / 下一轮"],
  "keys.error": ["next failure", "下一个失败"],
  "keys.play": ["play", "播放"],
  "keys.search": ["search", "搜索"],
  "keys.seq": ["jump to seq", "跳到序号"],
  "detail.message": ["Message", "消息"],
  "detail.reasoning": ["Reasoning", "推理过程"],
  "detail.raw": ["Raw", "原文"],
  "detail.rendered": ["Rendered", "渲染"],
  "detail.command": ["Command", "命令"],
  "detail.arguments": ["Arguments", "参数"],
  "detail.result": ["Result", "结果"],
  "detail.error": ["Error", "错误"],
  "detail.failed": ["failed", "失败"],
  "detail.noResult": ["No result recorded (the call was still running or was cancelled).", "没有记录到结果（调用仍在进行或已取消）。"],
  "detail.emptyResult": ["Empty result.", "结果为空。"],
  "detail.showAll": ["Show all {n} lines", "显示全部 {n} 行"],
  "detail.usage": ["Token usage (this step)", "Token 用量（本步）"],
  "detail.inputUncached": ["Uncached input", "输入（未缓存）"],
  "detail.cacheRead": ["Cache read", "缓存读"],
  "detail.cacheWrite": ["Cache write", "缓存写"],
  "detail.output": ["Output", "输出"],
  "detail.reasoningTokens": ["reasoning", "推理"],
  "detail.stepCost": ["≈ cost", "≈ 成本"],
  "detail.eventData": ["Raw event", "原始事件"],
  "detail.shadowed": ["compacted away", "已被压缩遮蔽"],
  "detail.fork": ["Fork here", "从这里分叉"],
  "detail.forkTitle": ["Create a new session from the log up to this event, then continue it in the harness", "用到此事件为止的日志创建一个新会话，然后在 Harness 里继续"],
  "fork.working": ["Forking at #{seq}…", "正在从 #{seq} 分叉…"],
  "fork.done": ["Forked into new session {id}. Open it in the harness sidebar to continue.", "已分叉为新会话 {id}，可在 Harness 侧栏打开并继续。"],
  "fork.fail": ["Fork failed: {error}", "分叉失败：{error}"],
  "fork.open": ["View in Replay", "在 Replay 中查看"],
  "live.on": ["Live", "实时"],
  "live.paused": ["Paused", "已暂停"],
  "live.pause": ["Pause live follow", "暂停实时跟随"],
  "live.resume": ["Resume live follow", "恢复实时跟随"],
  "files.empty": ["This session did not write, edit or patch any file.", "这个会话没有写入、编辑或修补任何文件。"],
  "files.summary": ["{n} files changed", "改动了 {n} 个文件"],
  "files.note": ["Rebuilt from the write / edit / apply_patch calls in the log. Changes made by shell commands are not visible here.", "由日志中的 write / edit / apply_patch 调用重建。通过 shell 命令做的改动不在此列。"],
  "files.status.created": ["created", "新建"],
  "files.status.modified": ["modified", "修改"],
  "files.status.deleted": ["deleted", "删除"],
  "files.op.create": ["create", "新建"],
  "files.op.write": ["overwrite", "覆写"],
  "files.op.edit": ["edit", "编辑"],
  "files.op.delete": ["delete", "删除"],
  "files.op.move": ["move", "移动"],
  "files.failed": ["call failed — not applied", "调用失败，未生效"],
  "files.noBody": ["No content recorded for this operation.", "此操作没有记录内容。"],
  "audit.empty": ["No findings. Squeaky clean!", "没有发现，干干净净！"],
  "audit.note": ["Rule-based: it flags patterns, it does not prove intent. Click a finding to open the event.", "基于规则：只标出模式，不代表真实意图。点击条目可定位到事件。"],
  "audit.ignore": ["Ignore rule", "忽略此规则"],
  "audit.ignoreTitle": ["Hide this rule in every session (stored in this browser)", "在所有会话中隐藏此规则（保存在本浏览器）"],
  "audit.ignored": ["Ignored rules ({n} findings hidden):", "已忽略的规则（隐藏了 {n} 条）："],
  "audit.restore": ["Click to restore", "点击恢复"],
  "rule.shell-danger": ["Risky shell commands", "有风险的 shell 命令"],
  "rule.shell-exec": ["Shell commands", "shell 命令"],
  "rule.file-sensitive": ["Writes to sensitive paths", "写入敏感路径"],
  "rule.file-write": ["File changes", "文件改动"],
  "rule.sensitive-read": ["Access to sensitive paths", "访问敏感路径"],
  "rule.network": ["Network access", "网络访问"],
  "rule.approval-denied": ["Denied approvals", "被拒绝的审批"],
  "rule.sandbox-change": ["Sandbox mode changes", "沙箱模式变更"],
  "rule.permission-change": ["Permission changes", "权限变更"],
  "rule.subagent": ["Subagents", "子 Agent"],
  "rule.tool-error": ["Tool failures", "工具失败"],
  "rule.turn-error": ["Abnormal turn ends", "轮次异常结束"],
  "f.shell.dangerous": ["Shell: {why}", "shell：{why}"],
  "f.shell.plain": ["Shell command via {name}", "通过 {name} 执行命令"],
  "f.file.sensitive": ["Write to a sensitive path via {name}", "通过 {name} 写入敏感路径"],
  "f.file.write": ["File change via {name}", "通过 {name} 修改文件"],
  "f.read.sensitive": ["Sensitive path accessed via {name}", "通过 {name} 访问敏感路径"],
  "f.network": ["Network access via {name}", "通过 {name} 访问网络"],
  "f.approval.denied": ["User denied an approval", "用户拒绝了一次审批"],
  "f.sandbox.change": ["Sandbox mode changed", "沙箱模式已变更"],
  "f.permission.change": ["Permission preset changed", "权限预设已变更"],
  "f.subagent": ["Subagent spawned ({mode})", "启动了子 Agent（{mode}）"],
  "f.tool.error": ["Tool failed: {name}", "工具失败：{name}"],
  "f.turn.error": ["Turn ended abnormally: {kind}", "轮次异常结束：{kind}"],
  "why.rm-rf": ["recursive / forced delete", "递归 / 强制删除"],
  "why.ps-remove": ["recursive delete (Remove-Item)", "递归删除（Remove-Item）"],
  "why.sudo": ["privilege escalation", "提权"],
  "why.chmod": ["permission change", "修改权限"],
  "why.curl-pipe": ["remote script piped to a shell", "远程脚本直接管道给 shell"],
  "why.iwr-iex": ["download and execute (Invoke-Expression)", "下载后直接执行（Invoke-Expression）"],
  "why.exec-policy": ["execution policy bypass / encoded command", "绕过执行策略 / 编码命令"],
  "why.force-push": ["force push", "强制推送"],
  "why.disk": ["raw disk operation", "裸盘操作"],
  "why.registry": ["registry modification", "修改注册表"],
  "why.git-reset": ["discards local changes", "丢弃本地改动"],
  "why.kill": ["force-kills a process", "强制结束进程"],
  "why.remote": ["remote host access", "访问远程主机"],
  "why.creds": ["credential in the command line", "命令行里出现凭据"],
  "meta.turnEnd": ["turn ended: {reason}", "轮次结束：{reason}"],
  "meta.compactSummary": ["context compacted (summary)", "上下文已压缩（摘要）"],
  "meta.compactPrune": ["context pruned", "上下文已裁剪"],
  "meta.approvalAsked": ["approval requested: {tool}", "请求审批：{tool}"],
  "meta.approvalDecided": ["approval decided: {outcome}", "审批结果：{outcome}"],
  "meta.sandbox": ["sandbox mode changed", "沙箱模式变更"],
  "meta.permission": ["permission preset changed", "权限预设变更"],
  "meta.plan": ["plan mode changed", "计划模式变更"],
  "meta.subagent": ["subagent spawned ({mode})", "启动子 Agent（{mode}）"],
  "meta.seed": ["seed boundary (fork / resume point)", "种子边界（分叉 / 恢复点）"],
  "meta.retry": ["model request retried", "模型请求重试"],
  "meta.attempt": ["model attempt failed, no message committed", "模型尝试失败，未产生消息"],
  "meta.goal": ["goal changed", "目标变更"],
  "cmp.with": ["vs", "对比"],
  "cmp.aria": ["session to compare with", "要对比的会话"],
  "cmp.parent": ["(parent)", "（父会话）"],
  "cmp.fork": ["(fork)", "（分叉）"],
  "cmp.none": ["There is no other session to compare with yet.", "还没有可对比的其他会话。"],
  "cmp.metric": ["Metrics", "指标"],
  "cmp.turns": ["Turns", "轮次"],
  "cmp.steps": ["Steps", "步数"],
  "cmp.toolCalls": ["Tool calls", "工具调用"],
  "cmp.toolErrors": ["Tool failures", "工具失败"],
  "cmp.inputTokens": ["Input tokens (billed)", "输入 Token（计费）"],
  "cmp.outputTokens": ["Output tokens", "输出 Token"],
  "cmp.cacheTokens": ["Cache-read tokens", "缓存读 Token"],
  "cmp.duration": ["Duration", "时长"],
  "cmp.toolMix": ["Calls per tool", "各工具调用次数"],
  "cmp.tool": ["Tool", "工具"],
  "cmp.divergence": ["diverges at #{seq}", "在 #{seq} 处分岔"],
  "cmp.sequence": ["Tool sequence, side by side", "工具调用序列并排"],
  "cmp.sequenceHint": ["= same call · ≠ same tool, different arguments · ← → only on one side", "= 相同调用 · ≠ 同工具不同参数 · ← → 仅一侧有"],
  "cmp.sharedPrefix": ["First {n} calls are identical — show", "前 {n} 次调用完全相同 — 展开"],
  "cmp.divergeHere": ["the runs differ from here", "从这里开始不同"],
  "cmp.identical": ["Both runs made exactly the same calls.", "两次运行的调用完全一致。"],
  "cmp.kind.same": ["identical", "完全相同"],
  "cmp.kind.args": ["same tool, different arguments", "同工具，参数不同"],
  "cmp.kind.only-a": ["only in the left run", "仅左侧有"],
  "cmp.kind.only-b": ["only in the right run", "仅右侧有"],
  "forks.empty": ["No sessions to chart yet.", "还没有可绘制的会话。"],
  "forks.hint": ["Fork families and subagents. Since harness 0.2 a fork no longer records its source, so those edges are inferred from the shared first prompt.", "分叉家族与子 Agent。Harness 0.2 起分叉不再记录来源，这类连线由“首条提示相同”推断得出。"],
  "forks.edge": ["inherits {n} events", "继承 {n} 个事件"],
  "forks.subagent": ["subagent", "子 Agent"],
  "forks.forkTag": ["fork", "分叉"],
  "forks.inferred": ["inferred", "推断"],
  "forks.orphan": ["parent missing", "父会话缺失"],
  "forks.untitled": ["untitled", "未命名"],
  "forks.singles": ["Standalone sessions ({n})", "独立会话（{n}）"],
  "dash.title": ["All sessions", "全部会话"],
  "dash.subtitle": ["spend, activity and reliability across sessions", "跨会话的花费、活跃度与可靠性"],
  "dash.range.7": ["7 days", "近 7 天"],
  "dash.range.30": ["30 days", "近 30 天"],
  "dash.range.all": ["All", "全部"],
  "dash.truncated": ["Showing the {n} most recent of {total} sessions.", "共 {total} 个会话，这里统计最近的 {n} 个。"],
  "dash.spend": ["Spend", "花费"],
  "dash.sessions": ["Sessions", "会话数"],
  "dash.activeDays": ["{n} active days", "{n} 个活跃日"],
  "dash.failRate": ["Tool failure rate", "工具失败率"],
  "dash.failSub": ["{n} of {total} calls", "{total} 次调用中 {n} 次"],
  "dash.emptyRange": ["No sessions in this range.", "这个时间范围内没有会话。"],
  "dash.daily": ["Spend per day", "每日花费"],
  "dash.dailyHint": ["stacked by model", "按模型堆叠"],
  "dash.nSessions": ["{n} sessions", "{n} 个会话"],
  "dash.heat": ["When you run agents", "活跃时段"],
  "dash.heatHint": ["tokens by weekday × hour (local time)", "按星期 × 小时统计 Token（本地时间）"],
  "dash.less": ["less", "少"],
  "dash.more": ["more", "多"],
  "dash.top": ["Most expensive sessions", "最贵的会话"],
  "dash.projects": ["By project", "按项目"],
  "dash.tools": ["Tool reliability", "工具可靠性"],
  "dash.toolsHint": ["red = share of failed calls", "红色 = 失败占比"],
  "dash.list": ["Sessions", "会话列表"],
  "dash.search": ["filter by title, id or path", "按标题、ID 或路径筛选"],
  "dash.sort.recent": ["Recent", "最近"],
  "dash.sort.cost": ["Cost", "成本"],
  "dash.sort.tokens": ["Tokens", "Token"],
  "dash.sort.duration": ["Duration", "时长"],
  "dash.callsUnit": ["calls", "次调用"],
  "share.button": ["Share", "分享"],
  "share.title": ["Share this session", "分享这个会话"],
  "share.scope": ["Include", "范围"],
  "share.scope.all": ["Whole session", "整个会话"],
  "share.scope.turn": ["Turn {n} only", "仅第 {n} 轮"],
  "share.scope.custom": ["Seq range", "序号区间"],
  "share.events": ["{n} events", "{n} 个事件"],
  "share.redact": ["Redact", "脱敏"],
  "share.redact.secrets": ["keys & secrets", "密钥与凭据"],
  "share.redact.paths": ["home-directory user names", "主目录里的用户名"],
  "share.redact.emails": ["e-mail addresses", "邮箱地址"],
  "share.found": ["{n} item(s) will be masked before export", "导出前将遮蔽 {n} 处"],
  "share.clean": ["Nothing matched the redaction patterns.", "没有命中任何脱敏规则。"],
  "share.off": ["Redaction is off — the file will contain the log verbatim.", "脱敏已关闭，导出的文件将包含原始日志。"],
  "share.kind.private-key": ["private key block", "私钥块"],
  "share.kind.api-key": ["API key / token", "API Key / 令牌"],
  "share.kind.jwt": ["JWT", "JWT"],
  "share.kind.bearer": ["Authorization header", "Authorization 头"],
  "share.kind.env-assignment": ["secret assignment", "凭据赋值"],
  "share.kind.url-credentials": ["password in URL", "URL 里的密码"],
  "share.kind.home-path": ["home path user name", "主目录用户名"],
  "share.kind.email": ["e-mail address", "邮箱地址"],
  "share.caveat": ["Pattern-based and best-effort: skim the export before posting it publicly. Project names, file contents and prompts are not touched.", "基于规则、尽力而为：公开发布前请自己再扫一眼。项目名、文件内容和提示词不会被改动。"],
  "share.noViewer": ["HTML export is unavailable in this view.", "当前视图无法导出 HTML。"],
  "share.copyMd": ["Copy Markdown summary", "复制 Markdown 摘要"],
  "share.downloadMd": ["Summary .md", "摘要 .md"],
  "share.exportHtml": ["Export HTML", "导出 HTML"],
  "share.building": ["Building…", "正在生成…"],
  "exp.fail": ["Export failed: {error}", "导出失败：{error}"],
  "exp.redacted": ["{n} redacted", "已脱敏 {n} 处"],
  "exp.redactedTitle": ["Secrets and paths were masked before this file was exported", "此文件导出前已遮蔽密钥与路径"],
  "exp.partial": ["excerpt", "节选"],
  "md.title": ["Session report: {title}", "会话复盘：{title}"],
  "md.footer": ["Generated with [dsh-replay](https://github.com/MingoZhou/dsh-replay)", "由 [dsh-replay](https://github.com/MingoZhou/dsh-replay) 生成"],
  "set.title": ["Pricing & currency", "价格与货币"],
  "set.currency": ["Display in", "显示货币"],
  "set.fx": ["CNY per 1 USD", "1 美元兑人民币"],
  "set.peak": ["Peak hours", "高峰时段"],
  "set.peakHint": ["e.g. 9-12, 14-18 · empty = no peak pricing", "例如 9-12, 14-18 · 留空则不区分高峰"],
  "set.model": ["Model", "模型"],
  "set.pattern": ["Match (regex)", "匹配（正则）"],
  "set.cur": ["Quoted in", "报价货币"],
  "set.peakRate": ["peak rate", "高峰价"],
  "set.unverified": ["reference price, unverified", "参考价，未核对"],
  "set.add": ["Add a model", "添加模型"],
  "set.newModel": ["New model", "新模型"],
  "set.remove": ["Remove", "删除"],
  "set.up": ["Move up (rules match top-down)", "上移（规则自上而下匹配）"],
  "set.reset": ["Restore defaults", "恢复默认"],
  "set.note": ["Prices are per 1M tokens. The first matching rule wins. DeepSeek defaults follow the official CNY price page (2026-10); check them against your bill — every figure in Replay is an estimate.", "价格单位为每百万 Token，自上而下第一条匹配的规则生效。DeepSeek 默认值取自官方人民币价格页（2026-10），请以你的账单为准——Replay 里的金额都是估算。"],
}

export type T = (key: string, params?: Record<string, string | number>) => string

export function makeT(lang: Lang): T {
  const index = lang === 'zh' ? 1 : 0
  return (key, params) => {
    const template = MESSAGES[key]?.[index] ?? MESSAGES[key]?.[0] ?? key
    if (params === undefined) return template
    return template.replaceAll(/\{(\w+)\}/gu, (match, name: string) =>
      params[name] === undefined ? match : String(params[name]),
    )
  }
}

/** Every message key — used by the build to verify the UI references only defined keys. */
export const MESSAGE_KEYS: readonly string[] = Object.keys(MESSAGES)

export function detectLang(): Lang {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'zh') return stored
  } catch {
    /* storage unavailable (private mode, sandboxed frame) */
  }
  const nav = globalThis.navigator?.language ?? 'en'
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function persistLang(lang: Lang): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lang)
  } catch {
    /* best effort */
  }
}

export interface I18n {
  lang: Lang
  t: T
  setLang: (lang: Lang) => void
}

export const I18nContext = React.createContext<I18n>({
  lang: 'en',
  t: makeT('en'),
  setLang: () => {},
})

export function useI18n(): I18n {
  return React.useContext(I18nContext)
}

// ---- localization helpers over core-produced structures ----

/** Localized finding message; falls back to the stable English title. */
export function localizeFinding(t: T, finding: AuditFinding): string {
  if (finding.messageKey === undefined) return finding.title
  const params: Record<string, string> = { ...finding.params }
  if (params['whyKey'] !== undefined) params['why'] = t(`why.${params['whyKey']}`)
  return t(finding.messageKey, params)
}

function field(data: unknown, key: string): unknown {
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>)[key] : undefined
}

/** Localized rail label for meta items; other kinds keep their content labels. */
export function localizeItemLabel(t: T, item: TimelineItem): string {
  if (item.kind !== 'meta') return item.label
  const d = item.event.data
  switch (item.type) {
    case 'turn/end':
      return t('meta.turnEnd', { reason: String(field(field(d, 'reason'), 'kind') ?? '') })
    case 'compaction/summary':
      return t('meta.compactSummary')
    case 'compaction/prune':
      return t('meta.compactPrune')
    case 'approval/asked':
      return t('meta.approvalAsked', { tool: String(field(d, 'toolName') ?? '') })
    case 'approval/decided': {
      const outcome = field(d, 'outcome') ?? field(d, 'decision')
      return t('meta.approvalDecided', { outcome: typeof outcome === 'string' ? outcome : JSON.stringify(outcome) })
    }
    case 'sandbox/mode':
      return t('meta.sandbox')
    case 'permission/preset':
      return t('meta.permission')
    case 'plan/mode':
      return t('meta.plan')
    case 'subagent/descriptor':
      return t('meta.subagent', { mode: String(field(d, 'mode') ?? '') })
    case 'session/end-seed':
      return t('meta.seed')
    case 'llm/retry':
    case 'llm/retry-started':
      return t('meta.retry')
    case 'assistant/attempt':
      return t('meta.attempt')
    case 'goal/change':
      return t('meta.goal')
    default:
      return item.label
  }
}
