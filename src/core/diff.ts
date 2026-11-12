/** Minimal line diff (LCS) for rebuilding edits from tool arguments. */

export interface DiffLine {
  op: ' ' | '+' | '-'
  text: string
}

export interface DiffStat {
  added: number
  removed: number
}

const MAX_CELLS = 4_000_000

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before === '' ? [] : before.split('\n')
  const b = after === '' ? [] : after.split('\n')
  // Trim the common prefix/suffix first — edits are usually local.
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  const midA = a.slice(head, a.length - tail)
  const midB = b.slice(head, b.length - tail)
  const out: DiffLine[] = a.slice(0, head).map(text => ({ op: ' ', text }))

  if (midA.length * midB.length > MAX_CELLS) {
    for (const text of midA) out.push({ op: '-', text })
    for (const text of midB) out.push({ op: '+', text })
  } else {
    const n = midA.length
    const m = midB.length
    const table: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i][j] = midA[i] === midB[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        out.push({ op: ' ', text: midA[i] })
        i++
        j++
      } else if (table[i + 1][j] >= table[i][j + 1]) {
        out.push({ op: '-', text: midA[i++] })
      } else {
        out.push({ op: '+', text: midB[j++] })
      }
    }
    while (i < n) out.push({ op: '-', text: midA[i++] })
    while (j < m) out.push({ op: '+', text: midB[j++] })
  }
  for (const text of a.slice(a.length - tail)) out.push({ op: ' ', text })
  return out
}

export function diffStat(lines: DiffLine[]): DiffStat {
  let added = 0
  let removed = 0
  for (const line of lines) {
    if (line.op === '+') added++
    else if (line.op === '-') removed++
  }
  return { added, removed }
}

/** Keep changed lines plus `context` unchanged lines around them; gaps become a `…` marker line. */
export function compactDiff(lines: DiffLine[], context = 3): (DiffLine | { op: '…'; text: string })[] {
  const keep = new Uint8Array(lines.length)
  lines.forEach((line, i) => {
    if (line.op === ' ') return
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = 1
  })
  const out: (DiffLine | { op: '…'; text: string })[] = []
  let skipped = 0
  lines.forEach((line, i) => {
    if (keep[i]) {
      if (skipped > 0) out.push({ op: '…', text: String(skipped) })
      skipped = 0
      out.push(line)
    } else {
      skipped++
    }
  })
  if (skipped > 0 && out.length > 0) out.push({ op: '…', text: String(skipped) })
  return out
}
