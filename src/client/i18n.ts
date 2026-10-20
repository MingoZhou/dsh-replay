/**
 * Lightweight EN/中文 i18n for the review UI. The dictionary is plain data;
 * `useI18n()` provides `t(key, params)` plus the current language and setter.
 * Language resolution: explicit choice (persisted) > browser language > en.
 *
 * A tiny external store keeps the sidebar button, the modal chrome and the
 * embedded app in sync when the language is toggled from any of them.
 */
import React from 'react'

export type Lang = 'en' | 'zh'

const STORAGE_KEY = 'dshr-lang'

type Dict = Record<string, string>

const en: Dict = {
  'btn.replay': 'Session Review',
  'modal.close': 'Close',
  'modal.title': 'Session review',
  'app.reviewSub': 'read-only · no model calls · no token spend',
  'app.refresh': 'Refresh',
  'app.updated': 'updated {time}',
  'app.back': 'All sessions',
  'app.retry': 'Retry',
  'lang.switch': 'Switch language',
  'picker.title': 'Pick a session to review',
  'picker.empty': 'No sessions yet — run something first!',
  'picker.search': 'Search title, id or workspace…',
  'picker.allWorkspaces': 'All workspaces',
  'picker.live': 'live',
  'picker.count': '{n} sessions',
  'picker.subagent': 'subagent',
  'picker.fork': 'fork',
  'exp.button': 'Export HTML',
  'exp.title': 'Export a shareable replay',
  'exp.warning': 'A session log is raw data. This export masks common credentials, but you should still review it before sharing.',
  'exp.redact': 'Redact common secrets and home paths',
  'exp.includeRaw': 'Include unredacted raw data (not recommended)',
  'exp.size': 'Estimated size: {size}',
  'exp.redactions': '{n} secret/home-path values will be masked',
  'exp.confirm': 'Export HTML',
  'exp.cancel': 'Cancel',
  'exp.note': 'The exported file is standalone: it runs offline and makes no network requests.',
  'exp.fail': 'Export failed: {error}',
  'ov.cost': '≈ cost ({label}, est.)',
  'ov.costPanel': 'cost estimate',
  'ov.costNote': 'Estimate from recorded tokens. Prices are editable and may lag provider changes.',
  'ov.perModel': 'per model',
  'ov.risk': 'risk findings',
  'ov.noCost': 'No pricing matched this model',
  'ov.currency': 'Currency',
  'ov.editPrices': 'Edit prices',
  'ov.priceSaved': 'Prices saved',
  'ov.priceReset': 'Reset defaults',
  'ov.updated': 'updated {date}',
  'flt.search': 'filter events…',
  'app.loadingText': 'Jing Xiaoshen is sorting the log…',
  'tab.dashboard': 'Dashboard',
  'tab.overview': 'Overview',
  'ov.tokensChart': 'cumulative tokens',
  'ov.toolTime': 'tool time by tool',
  'ov.inputTokens': 'input tokens (billed)',
  'ov.outputTokens': 'output tokens',
  'ov.findings': 'risk findings',
  'tab.timeline': 'Timeline',
  'tab.audit': 'Audit',
  'tab.forks': 'Forks',
  'tab.compare': 'Compare',
  'app.loading': 'Loading session…',
  'app.error': 'Failed to load session — {error}. Is the dsh-replay host plugin enabled?',
  'app.openSession': 'Open a session to review it.',
  'dash.title': 'Session archive',
  'dash.subtitle': 'Every session on this machine, at a glance.',
  'dash.sessions': 'sessions',
  'dash.tokens': 'billed tokens',
  'dash.cost': 'estimated cost',
  'dash.risk': 'high-risk findings',
  'dash.recent': 'recent sessions',
  'dash.empty': 'No sessions yet — run something first!',
  'dash.thisMonth': 'this month',
  'dash.allTime': 'all time',
  'dash.live': 'live',
  'dash.open': 'Open',
  'dash.errors': 'tool errors',
  'dash.scanned': 'indexed {n} sessions',
  'hdr.turns': '{n} turns',
  'play.event': 'event {i}/{n}',
  'play.position': 'timeline position',
  'tl.play': 'play',
  'tl.pause': 'pause',
  'tl.speed': 'playback speed',
  'ts.title': 'tokens per step',
  'ts.input': 'input (billed)',
  'ts.output': 'output',
  'ts.total': 'Σ in {in} · out {out}',
  'ts.cacheRead': ' · cache-read {n}',
  'ts.barTitle': 'turn {turn} step {step} — in {in}, out {out}',
  'tl.empty': 'No renderable events in this session yet.',
  'tl.turn': 'Turn {n}',
  'tl.reasoning': 'thinking',
  'tl.system': 'system prompt',
  'tl.model': 'model selected: {model}',
  'tl.summary': 'summary',
  'kind.user': 'user',
  'kind.assistant': 'assistant',
  'kind.tool': 'tool',
  'kind.meta': 'meta',
  'detail.message': 'message',
  'detail.arguments': 'arguments',
  'detail.result': 'result',
  'detail.usage': 'token usage (this step)',
  'detail.eventData': 'event data',
  'detail.callId': 'call id',
  'detail.duration': 'duration',
  'detail.noResult': 'no result recorded',
  'detail.error': 'error',
  'detail.inputUncached': 'input (uncached)',
  'detail.cacheRead': 'cache read',
  'detail.cacheWrite': 'cache write',
  'detail.output': 'output',
  'detail.reasoning': 'reasoning',
  'detail.shadowed': 'shadowed by compaction',
  'detail.copy': 'copy',
  'detail.copied': 'copied',
  'sev.critical': 'critical',
  'sev.serious': 'serious',
  'sev.warning': 'warning',
  'sev.info': 'info',
  'audit.empty': 'No findings — no rule matched this session.',
  'audit.noRisk': 'No risk findings.',
  'audit.coverage': 'Regex scan over tool names and arguments. Tool output content is not inspected; false negatives and false positives are possible.',
  'audit.scanned': 'scanned {n} events · {rules} rules',
  'audit.baseline': '{n} baseline config events ignored',
  'audit.riskOnly': 'risk only',
  'audit.all': 'all',
  'audit.export': 'export report',
  'audit.category.shell': 'shell',
  'audit.category.file': 'file',
  'audit.category.network': 'network',
  'audit.category.approval': 'approval',
  'audit.category.config': 'config',
  'audit.category.error': 'error',
  'audit.category.secret': 'credential',
  'cmp.with': 'Compare with',
  'cmp.parent': '(parent)',
  'cmp.fork': '(fork)',
  'cmp.none': 'No other session to compare with.',
  'cmp.metric': 'metric',
  'cmp.delta': 'Δ',
  'cmp.turns': 'turns',
  'cmp.steps': 'steps',
  'cmp.events': 'events',
  'cmp.toolCalls': 'tool calls',
  'cmp.toolErrors': 'tool errors',
  'cmp.inputTokens': 'input tokens (billed)',
  'cmp.outputTokens': 'output tokens',
  'cmp.cacheTokens': 'cache-read tokens',
  'cmp.duration': 'duration',
  'cmp.toolMix': 'tool mix',
  'cmp.tool': 'tool',
  'cmp.cost': 'est. cost',
  'cmp.risk': 'risk findings',
  'cmp.divergence':
    'These sessions share lineage and diverge at seq {seq} — identical before it, different history after.',
  'cmp.divergenceA': 'A · first differing event',
  'cmp.divergenceB': 'B · first differing event',
  'cmp.aria': 'session to compare against',
  'cmp.relation': 'lineage',
  'cmp.relation.same': 'same session',
  'cmp.relation.a-parent-of-b': 'A is an ancestor of B',
  'cmp.relation.b-parent-of-a': 'B is an ancestor of A',
  'cmp.relation.siblings': 'siblings (shared parent)',
  'cmp.relation.none': 'no direct lineage',
  'forks.empty': 'No sessions found.',
  'forks.edge': 'forked @ {n} events',
  'forks.subagent': ' · subagent',
  'forks.orphan': ' · parent missing',
  'forks.aria': 'session fork tree',
  'forks.untitled': 'Untitled',
  'forks.forkTag': ' · fork',
  'forks.hint': 'Session lineage: forked sessions and subagents hang under their parent as a tree; sessions without lineage are listed as cards. Click any card to review it.',
  'forks.compare': 'compare',
  'forks.open': 'open',
  'f.shell.dangerous': 'shell: {why}',
  'f.shell.plain': 'shell command via {name}',
  'f.file.sensitive': 'file write touches sensitive path',
  'f.file.write': 'file mutation via {name}',
  'f.file.secret': 'credential material written to a file',
  'f.file.destructive': 'destructive file operation via {name}',
  'f.read.sensitive': 'access to sensitive path via {name}',
  'f.network': 'network request may carry sensitive data via {name}',
  'f.output.secret': 'tool output contains credential material',
  'f.approval.denied': 'user denied an approval',
  'f.sandbox.change': 'sandbox mode changed',
  'f.permission.change': 'permission preset changed',
  'f.subagent': 'subagent spawned ({mode})',
  'f.tool.error': 'tool failed: {name}',
  'f.turn.error': 'turn ended abnormally: {kind}',
  'why.rm-rf': 'recursive/forced delete',
  'why.sudo': 'privilege escalation',
  'why.chmod': 'permission change',
  'why.curl-pipe': 'pipe remote script to shell',
  'why.force-push': 'force push',
  'why.disk': 'raw disk operation',
  'why.remote': 'remote host access',
  'why.creds': 'credential material in command',
  'why.exec-policy': 'script execution policy change',
  'why.system-tamper': 'boot/shadow/log tampering',
  'why.persistence': 'persistence or account change',
  'why.encoded-shell': 'encoded PowerShell command',
  'why.exfil': 'possible credential exfiltration',
  'why.publish': 'package/release publish',
  'meta.turnEnd': 'turn ended: {reason}',
  'meta.compactSummary': 'context compacted (summary)',
  'meta.compactPrune': 'context pruned',
  'meta.approvalAsked': 'approval requested: {tool}',
  'meta.approvalDecided': 'approval decided: {outcome}',
  'meta.sandbox': 'sandbox mode changed',
  'meta.permission': 'permission preset changed',
  'meta.plan': 'plan mode change',
  'meta.subagent': 'subagent spawned ({mode})',
  'meta.seed': 'seed boundary (fork/resume point)',
  'meta.retry': 'model request retried',
  'meta.goal': 'goal changed',
  'meta.system': 'system prompt',
  'meta.model': 'model: {model}',
  'meta.command': 'command: {command}',
}

const zh: Dict = {
  'btn.replay': '会话复盘',
  'modal.close': '关闭',
  'modal.title': '会话复盘',
  'app.reviewSub': '只读 · 不调用模型 · 不消耗 token',
  'app.refresh': '刷新',
  'app.updated': '更新于 {time}',
  'app.back': '全部会话',
  'app.retry': '重试',
  'lang.switch': '切换语言',
  'picker.title': '选择要复盘的会话',
  'picker.empty': '还没有会话 — 先去跑点什么吧！',
  'picker.search': '搜索标题、ID 或工作区…',
  'picker.allWorkspaces': '全部工作区',
  'picker.live': '运行中',
  'picker.count': '{n} 个会话',
  'picker.subagent': '子 Agent',
  'picker.fork': '分支',
  'exp.button': '导出 HTML',
  'exp.title': '导出可分享的复盘',
  'exp.warning': '会话日志是原始数据。导出会遮罩常见密钥，但分享前仍建议自己检查一遍。',
  'exp.redact': '遮罩常见密钥和用户主目录',
  'exp.includeRaw': '包含未脱敏原文（不推荐）',
  'exp.size': '预计大小：{size}',
  'exp.redactions': '将遮罩 {n} 处密钥/路径',
  'exp.confirm': '导出 HTML',
  'exp.cancel': '取消',
  'exp.note': '导出文件完全离线，不会发起任何网络请求。',
  'exp.fail': '导出失败：{error}',
  'ov.cost': '≈ 成本（{label}，估算）',
  'ov.costPanel': '成本估算',
  'ov.costNote': '根据日志中的 token 估算；价格可编辑，可能滞后于官方调价。',
  'ov.perModel': '分模型',
  'ov.risk': '风险发现',
  'ov.noCost': '没有匹配到该模型的价格',
  'ov.currency': '货币',
  'ov.editPrices': '编辑价格',
  'ov.priceSaved': '价格已保存',
  'ov.priceReset': '恢复默认',
  'ov.updated': '更新于 {date}',
  'flt.search': '搜索事件…',
  'app.loadingText': '鲸小深正在整理日志…',
  'tab.dashboard': '仪表盘',
  'tab.overview': '概览',
  'ov.tokensChart': '累计 Token',
  'ov.toolTime': '各工具耗时',
  'ov.inputTokens': '输入 token（计费）',
  'ov.outputTokens': '输出 token',
  'ov.findings': '风险发现',
  'tab.timeline': '时间线',
  'tab.audit': '审计',
  'tab.forks': '分支',
  'tab.compare': '对比',
  'app.loading': '会话加载中…',
  'app.error': '会话加载失败 — {error}。请确认 dsh-replay 宿主插件已启用。',
  'app.openSession': '打开一个会话即可复盘。',
  'dash.title': '会话档案',
  'dash.subtitle': '这台机器上的所有会话，一眼看完。',
  'dash.sessions': '会话',
  'dash.tokens': '计费 token',
  'dash.cost': '估算成本',
  'dash.risk': '高危发现',
  'dash.recent': '最近会话',
  'dash.empty': '还没有会话 — 先去跑点什么吧！',
  'dash.thisMonth': '本月',
  'dash.allTime': '全部',
  'dash.live': '运行中',
  'dash.open': '打开',
  'dash.errors': '工具错误',
  'dash.scanned': '已索引 {n} 个会话',
  'hdr.turns': '{n} 轮',
  'play.event': '事件 {i}/{n}',
  'play.position': '时间线位置',
  'tl.play': '播放',
  'tl.pause': '暂停',
  'tl.speed': '播放速度',
  'ts.title': '每步 token',
  'ts.input': '输入（计费）',
  'ts.output': '输出',
  'ts.total': 'Σ 输入 {in} · 输出 {out}',
  'ts.cacheRead': ' · 缓存读 {n}',
  'ts.barTitle': '第 {turn} 轮第 {step} 步 — 输入 {in}，输出 {out}',
  'tl.empty': '该会话暂无可渲染事件。',
  'tl.turn': '第 {n} 轮',
  'tl.reasoning': '思考',
  'tl.system': '系统提示词',
  'tl.model': '选择模型：{model}',
  'tl.summary': '摘要',
  'kind.user': '用户',
  'kind.assistant': '助手',
  'kind.tool': '工具',
  'kind.meta': '元',
  'detail.message': '消息',
  'detail.arguments': '参数',
  'detail.result': '结果',
  'detail.usage': 'Token 用量（本步）',
  'detail.eventData': '事件数据',
  'detail.callId': '调用 ID',
  'detail.duration': '耗时',
  'detail.noResult': '未记录结果',
  'detail.error': '错误',
  'detail.inputUncached': '输入（未缓存）',
  'detail.cacheRead': '缓存读',
  'detail.cacheWrite': '缓存写',
  'detail.output': '输出',
  'detail.reasoning': '推理过程',
  'detail.shadowed': '已被压缩遮蔽',
  'detail.copy': '复制',
  'detail.copied': '已复制',
  'sev.critical': '严重',
  'sev.serious': '较高',
  'sev.warning': '警告',
  'sev.info': '信息',
  'audit.empty': '未命中当前规则。',
  'audit.noRisk': '未发现风险。',
  'audit.coverage': '基于工具名/参数的正则扫描；不检查工具输出内容，可能漏报或误报。',
  'audit.scanned': '扫描了 {n} 个事件 · {rules} 条规则',
  'audit.baseline': '已忽略 {n} 条初始配置',
  'audit.riskOnly': '只看风险',
  'audit.all': '全部',
  'audit.export': '导出报告',
  'audit.category.shell': 'Shell',
  'audit.category.file': '文件',
  'audit.category.network': '网络',
  'audit.category.approval': '审批',
  'audit.category.config': '配置',
  'audit.category.error': '错误',
  'audit.category.secret': '凭据',
  'cmp.with': '对比对象',
  'cmp.parent': '（父会话）',
  'cmp.fork': '（分支）',
  'cmp.none': '没有其他会话可对比。',
  'cmp.metric': '指标',
  'cmp.delta': 'Δ',
  'cmp.turns': '轮数',
  'cmp.steps': '步数',
  'cmp.events': '事件数',
  'cmp.toolCalls': '工具调用',
  'cmp.toolErrors': '工具错误',
  'cmp.inputTokens': '输入 token（计费）',
  'cmp.outputTokens': '输出 token',
  'cmp.cacheTokens': '缓存读 token',
  'cmp.duration': '时长',
  'cmp.toolMix': '工具分布',
  'cmp.tool': '工具',
  'cmp.cost': '估算成本',
  'cmp.risk': '风险发现',
  'cmp.divergence': '这两个会话同源，自 seq {seq} 起分歧 — 之前完全一致，之后历史不同。',
  'cmp.divergenceA': 'A · 首个差异事件',
  'cmp.divergenceB': 'B · 首个差异事件',
  'cmp.aria': '选择对比会话',
  'cmp.relation': '血缘',
  'cmp.relation.same': '同一会话',
  'cmp.relation.a-parent-of-b': 'A 是 B 的祖先',
  'cmp.relation.b-parent-of-a': 'B 是 A 的祖先',
  'cmp.relation.siblings': '同源分支（共享父会话）',
  'cmp.relation.none': '无直接血缘',
  'forks.empty': '未找到会话。',
  'forks.edge': '于第 {n} 个事件处分叉',
  'forks.subagent': ' · 子 Agent',
  'forks.orphan': ' · 父会话缺失',
  'forks.aria': '会话分支树',
  'forks.untitled': '未命名会话',
  'forks.forkTag': ' · 分支',
  'forks.hint': '会话血缘：fork 出的会话和子 Agent 会挂在父会话下形成树；没有血缘的会话平铺为卡片。点击任意卡片即可复盘该会话。',
  'forks.compare': '对比',
  'forks.open': '打开',
  'f.shell.dangerous': '危险 shell：{why}',
  'f.shell.plain': '通过 {name} 执行 shell 命令',
  'f.file.sensitive': '文件写入涉及敏感路径',
  'f.file.write': '通过 {name} 修改文件',
  'f.file.secret': '凭据被写入文件',
  'f.file.destructive': '通过 {name} 执行破坏性文件操作',
  'f.read.sensitive': '通过 {name} 访问敏感路径',
  'f.network': '通过 {name} 的网络请求可能携带敏感数据',
  'f.output.secret': '工具输出包含凭据',
  'f.approval.denied': '用户拒绝了一次审批',
  'f.sandbox.change': '沙箱模式变更',
  'f.permission.change': '权限预设变更',
  'f.subagent': '派生子 Agent（{mode}）',
  'f.tool.error': '工具失败：{name}',
  'f.turn.error': '轮次异常结束：{kind}',
  'why.rm-rf': '递归/强制删除',
  'why.sudo': '提权操作',
  'why.chmod': '权限修改',
  'why.curl-pipe': '远程脚本管道执行',
  'why.force-push': '强制推送',
  'why.disk': '底层磁盘操作',
  'why.remote': '远程主机访问',
  'why.creds': '命令中包含凭据',
  'why.exec-policy': '修改脚本执行策略',
  'why.system-tamper': '篡改启动/卷影/日志',
  'why.persistence': '持久化或账户变更',
  'why.encoded-shell': '编码的 PowerShell 命令',
  'why.exfil': '可能外传凭据',
  'why.publish': '发布包/Release',
  'meta.turnEnd': '轮次结束：{reason}',
  'meta.compactSummary': '上下文已压缩（摘要）',
  'meta.compactPrune': '上下文已修剪',
  'meta.approvalAsked': '请求审批：{tool}',
  'meta.approvalDecided': '审批结果：{outcome}',
  'meta.sandbox': '沙箱模式变更',
  'meta.permission': '权限预设变更',
  'meta.plan': '计划模式变更',
  'meta.subagent': '派生子 Agent（{mode}）',
  'meta.seed': '种子边界（fork/resume 点）',
  'meta.retry': '模型请求已重试',
  'meta.goal': '目标变更',
  'meta.system': '系统提示词',
  'meta.model': '模型：{model}',
  'meta.command': '命令：{command}',
}

const DICTS: Record<Lang, Dict> = { en, zh }

export type T = (key: string, params?: Record<string, string | number>) => string

export function makeT(lang: Lang): T {
  return (key, params) => {
    let text = DICTS[lang][key] ?? DICTS.en[key] ?? key
    if (params !== undefined) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value))
      }
    }
    return text
  }
}

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

// ---- tiny language store -------------------------------------------------
let cachedLang: Lang | undefined
const listeners = new Set<() => void>()

export function getLang(): Lang {
  cachedLang ??= detectLang()
  return cachedLang
}

export function setLang(lang: Lang): void {
  if (cachedLang === lang) return
  cachedLang = lang
  persistLang(lang)
  for (const listener of listeners) listener()
}

export function subscribeLang(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLang(): Lang {
  return React.useSyncExternalStore(subscribeLang, getLang, getLang)
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
import type { AuditFinding } from '../core/audit.js'
import type { TimelineItem } from '../core/timeline.js'

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
      return t('meta.approvalDecided', {
        outcome: typeof outcome === 'string' ? outcome : JSON.stringify(outcome),
      })
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
    case 'goal/change':
      return t('meta.goal')
    case 'system/message':
      return t('meta.system')
    case 'model/selection':
      return t('meta.model', { model: String(field(d, 'model') ?? '') })
    case 'command/run': {
      const command = field(d, 'command')
      return t('meta.command', { command: typeof command === 'string' ? command : JSON.stringify(d) })
    }
    default:
      return item.label
  }
}
