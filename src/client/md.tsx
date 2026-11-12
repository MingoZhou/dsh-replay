/**
 * A deliberately small Markdown renderer for message bodies: fenced code,
 * headings, lists, block quotes, paragraphs; inline code, bold, italics and
 * http(s) links. It builds React elements only — no HTML strings — so log
 * content can never inject markup.
 */
import React from 'react'

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[[^\]\n]+\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<>)\]]+)|(\*[^*\s][^*\n]*\*)/gu

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0
  let n = 0
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0
    if (index > last) out.push(text.slice(last, index))
    const token = match[0]
    const key = `${keyBase}-${n++}`
    if (match[1]) out.push(<code key={key}>{token.slice(1, -1)}</code>)
    else if (match[2]) out.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    else if (match[3]) {
      const label = token.slice(1, token.indexOf(']('))
      out.push(
        <a key={key} href={match[4]} target="_blank" rel="noreferrer noopener">
          {label}
        </a>,
      )
    } else if (match[5]) {
      out.push(
        <a key={key} href={token} target="_blank" rel="noreferrer noopener">
          {token}
        </a>,
      )
    } else out.push(<em key={key}>{token.slice(1, -1)}</em>)
    last = index + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ text }: { text: string }): React.ReactElement {
  const lines = text.replaceAll('\r\n', '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = /^\s*(```|~~~)\s*([\w+-]*)\s*$/u.exec(line)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith(fence[1])) body.push(lines[i++])
      i++ // closing fence (or end of text for an unfinished block)
      blocks.push(
        <pre key={key++} className="dshr-code" data-lang={fence[2] || undefined}>
          {body.join('\n')}
        </pre>,
      )
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/u.exec(line)
    if (heading) {
      const level = Math.min(4, heading[1].length)
      blocks.push(
        React.createElement(`h${level + 2}`, { key: key++, className: 'dshr-md-h' }, inline(heading[2], `h${key}`)),
      )
      i++
      continue
    }
    const listItem = /^\s*([-*+]|\d+[.)])\s+(.*)$/u
    if (listItem.test(line)) {
      const ordered = /^\s*\d/u.test(line)
      const items: React.ReactNode[] = []
      while (i < lines.length && listItem.test(lines[i])) {
        const text0 = listItem.exec(lines[i])![2]
        const task = /^\[([ xX])\]\s+(.*)$/u.exec(text0)
        items.push(
          <li key={items.length} data-task={task ? (task[1] === ' ' ? 'todo' : 'done') : undefined}>
            {inline(task ? task[2] : text0, `li${key}-${items.length}`)}
          </li>,
        )
        i++
      }
      blocks.push(React.createElement(ordered ? 'ol' : 'ul', { key: key++ }, items))
      continue
    }
    if (line.startsWith('>')) {
      const body: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) body.push(lines[i++].replace(/^>\s?/u, ''))
      blocks.push(<blockquote key={key++}>{inline(body.join('\n'), `q${key}`)}</blockquote>)
      continue
    }
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*(```|~~~)/u.test(lines[i]) &&
      !/^#{1,6}\s/u.test(lines[i]) &&
      !listItem.test(lines[i]) &&
      !lines[i].startsWith('>')
    ) {
      para.push(lines[i++])
    }
    blocks.push(<p key={key++}>{inline(para.join('\n'), `p${key}`)}</p>)
  }
  return <div className="dshr-md">{blocks}</div>
}
