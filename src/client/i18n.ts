/**
 * Lightweight EN/中文 i18n for the replay UI. The dictionary is plain data;
 * `useI18n()` provides `t(key, params)` plus the current language and setter.
 * Language resolution: explicit choice (persisted) > browser language > en.
 */
import React from 'react'

export type Lang = 'en' | 'zh'

const STORAGE_KEY = 'dshr-lang'

type Dict = Record<string, string>

const en: Dict = {
  'btn.replay': 'Session Replay',
  'modal.close': 'Close',
  'picker.title': 'Pick a session to replay',
  'picker.empty': 'No sessions yet — run something first!',
  'exp.button': 'Export HTML',
  'exp.fail': 'Export failed: {error}',
  'ov.cost': '≈ cost ({label}, est.)',
  'flt.search': 'filter events…',
  'app.loadingText': 'Jing Xiaoshen is rewinding the log…',
  'tab.overview': 'Overview',
  'ov.tokensChart': 'cumulative tokens',
  'ov.toolTime': 'tool time by tool',
  'ov.inputTokens': 'input tokens (billed)',
  'ov.outputTokens': 'output tokens',
  'ov.findings': 'audit findings',
  'tab.timeline': 'Timeline',
  'tab.audit': 'Audit',
  'tab.forks': 'Forks',
  'tab.compare': 'Compare',
  'app.loading': 'Loading session…',
  'app.error': 'Failed to load session — {error}. Is the dsh-replay host plugin enabled?',
  'app.openSession': 'Open a session to replay it.',
  'hdr.turns': '{n} turns',
  'play.event': 'event {i}/{n}',
  'play.position': 'timeline position',
  'ts.title': 'tokens per step',
  'ts.input': 'input (billed)',
  'ts.output': 'output',
  'ts.total': 'Σ in {in} · out {out}',
  'ts.cacheRead': ' · cache-read {n}',
  'ts.barTitle': 'turn {turn} step {step} — in {in}, out {out}',
  'tl.empty': 'No renderable events in this session yet.',
  'tl.turn': 'Turn {n}',
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
  'detail.reasoning': '└ reasoning',
  'detail.shadowed': 'shadowed by compaction',
  'sev.critical': 'critical',
  'sev.serious': 'serious',
  'sev.warning': 'warning',
  'sev.info': 'info',
  'audit.empty': 'No findings — nothing sensitive happened in this session.',
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
  'cmp.divergence':
    'These sessions share lineage and diverge at seq {seq} — identical before it, different history after.',
  'cmp.aria': 'session to compare against',
  'forks.empty': 'No sessions found.',
  'forks.edge': 'forked @ {n} events',
  'forks.subagent': ' · subagent',
  'forks.orphan': ' · parent missing',
  'forks.aria': 'session fork tree',
  'forks.untitled': 'Untitled',
  'forks.forkTag': ' · fork',
  'forks.hint': 'Session lineage: forked sessions and subagents hang under their parent as a tree; sessions without lineage are listed as cards. Click any card to replay it.',
  // audit finding messages (rule keys)
  'f.shell.dangerous': 'shell: {why}',
  'f.shell.plain': 'shell command via {name}',
  'f.file.sensitive': 'file write touches sensitive path',
  'f.file.write': 'file mutation via {name}',
  'f.read.sensitive': 'access to sensitive path via {name}',
  'f.network': 'network access via {name}',
  'f.approval.denied': 'user denied an approval',
  'f.sandbox.change': 'sandbox mode changed',
  'f.permission.change': 'permission preset changed',
  'f.subagent': 'subagent spawned ({mode})',
  'f.tool.error': 'tool failed: {name}',
  'f.turn.error': 'turn ended abnormally: {kind}',
  // dangerous-shell reasons
  'why.rm-rf': 'recursive/forced delete',
  'why.sudo': 'privilege escalation',
  'why.chmod': 'permission change',
  'why.curl-pipe': 'pipe remote script to shell',
  'why.force-push': 'force push',
  'why.disk': 'raw disk operation',
  'why.remote': 'remote host access',
  'why.creds': 'credential material in command',
  // meta timeline labels
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
}

const zh: Dict = {
  'btn.replay': '会话回放',
  'modal.close': '关闭',
  'picker.title': '选择要回放的会话',
  'picker.empty': '还没有会话 — 先去跑点什么吧!',
  'exp.button': '导出 HTML',
  'exp.fail': '导出失败:{error}',
  'ov.cost': '≈ 成本({label},估算)',
  'flt.search': '搜索事件…',
  'app.loadingText': '鲸小深正在倒带日志…',
  'tab.overview': '概览',
  'ov.tokensChart': '累计 Token',
  'ov.toolTime': '各工具耗时',
  'ov.inputTokens': '输入 token(计费)',
  'ov.outputTokens': '输出 token',
  'ov.findings': '审计发现',
  'tab.timeline': '时间线',
  'tab.audit': '审计',
  'tab.forks': '分支',
  'tab.compare': '对比',
  'app.loading': '会话加载中…',
  'app.error': '会话加载失败 — {error}。请确认 dsh-replay 宿主插件已启用。',
  'app.openSession': '打开一个会话即可回放。',
  'hdr.turns': '{n} 轮',
  'play.event': '事件 {i}/{n}',
  'play.position': '时间线位置',
  'ts.title': '每步 token',
  'ts.input': '输入(计费)',
  'ts.output': '输出',
  'ts.total': 'Σ 输入 {in} · 输出 {out}',
  'ts.cacheRead': ' · 缓存读 {n}',
  'ts.barTitle': '第 {turn} 轮第 {step} 步 — 输入 {in},输出 {out}',
  'tl.empty': '该会话暂无可渲染事件。',
  'tl.turn': '第 {n} 轮',
  'kind.user': '用户',
  'kind.assistant': '助手',
  'kind.tool': '工具',
  'kind.meta': '元',
  'detail.message': '消息',
  'detail.arguments': '参数',
  'detail.result': '结果',
  'detail.usage': 'Token 用量(本步)',
  'detail.eventData': '事件数据',
  'detail.callId': '调用 ID',
  'detail.duration': '耗时',
  'detail.noResult': '未记录结果',
  'detail.error': '错误',
  'detail.inputUncached': '输入(未缓存)',
  'detail.cacheRead': '缓存读',
  'detail.cacheWrite': '缓存写',
  'detail.output': '输出',
  'detail.reasoning': '└ 推理',
  'detail.shadowed': '已被压缩遮蔽',
  'sev.critical': '严重',
  'sev.serious': '较高',
  'sev.warning': '警告',
  'sev.info': '信息',
  'audit.empty': '无发现 — 本会话没有敏感操作。',
  'cmp.with': '对比对象',
  'cmp.parent': '(父会话)',
  'cmp.fork': '(分支)',
  'cmp.none': '没有其他会话可对比。',
  'cmp.metric': '指标',
  'cmp.delta': 'Δ',
  'cmp.turns': '轮数',
  'cmp.steps': '步数',
  'cmp.events': '事件数',
  'cmp.toolCalls': '工具调用',
  'cmp.toolErrors': '工具错误',
  'cmp.inputTokens': '输入 token(计费)',
  'cmp.outputTokens': '输出 token',
  'cmp.cacheTokens': '缓存读 token',
  'cmp.duration': '时长',
  'cmp.toolMix': '工具分布',
  'cmp.tool': '工具',
  'cmp.divergence': '这两个会话同源,自 seq {seq} 起分歧 — 之前完全一致,之后历史不同。',
  'cmp.aria': '选择对比会话',
  'forks.empty': '未找到会话。',
  'forks.edge': '于第 {n} 个事件处分叉',
  'forks.subagent': ' · 子Agent',
  'forks.orphan': ' · 父会话缺失',
  'forks.aria': '会话分支树',
  'forks.untitled': '未命名会话',
  'forks.forkTag': ' · 分支',
  'forks.hint': '会话血缘:fork 出的会话和子 Agent 会挂在父会话下形成树;没有血缘的会话平铺为卡片。点击任意卡片即可回放该会话。',
  'f.shell.dangerous': '危险 shell:{why}',
  'f.shell.plain': '通过 {name} 执行 shell 命令',
  'f.file.sensitive': '文件写入涉及敏感路径',
  'f.file.write': '通过 {name} 修改文件',
  'f.read.sensitive': '通过 {name} 访问敏感路径',
  'f.network': '通过 {name} 访问网络',
  'f.approval.denied': '用户拒绝了一次审批',
  'f.sandbox.change': '沙箱模式变更',
  'f.permission.change': '权限预设变更',
  'f.subagent': '派生子 Agent({mode})',
  'f.tool.error': '工具失败:{name}',
  'f.turn.error': '轮次异常结束:{kind}',
  'why.rm-rf': '递归/强制删除',
  'why.sudo': '提权操作',
  'why.chmod': '权限修改',
  'why.curl-pipe': '远程脚本管道执行',
  'why.force-push': '强制推送',
  'why.disk': '底层磁盘操作',
  'why.remote': '远程主机访问',
  'why.creds': '命令中包含凭据',
  'meta.turnEnd': '轮次结束:{reason}',
  'meta.compactSummary': '上下文已压缩(摘要)',
  'meta.compactPrune': '上下文已修剪',
  'meta.approvalAsked': '请求审批:{tool}',
  'meta.approvalDecided': '审批结果:{outcome}',
  'meta.sandbox': '沙箱模式变更',
  'meta.permission': '权限预设变更',
  'meta.plan': '计划模式变更',
  'meta.subagent': '派生子 Agent({mode})',
  'meta.seed': '种子边界(fork/resume 点)',
  'meta.retry': '模型请求已重试',
  'meta.goal': '目标变更',
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
    default:
      return item.label
  }
}
