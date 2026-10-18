export type Grid = { lines: string[]; cols: number; rows: number }

export const toGrid = (raw: string): Grid => {
  const lines = raw.replace(/\r/g, '').split('\n')
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
  const cols = lines.reduce((m, l) => Math.max(m, l.length), 0)
  return { lines: lines.map((l) => l.padEnd(cols, ' ')), cols, rows: lines.length }
}

// 外周から到達できない空白を true にする (flood fill)
export const outsideMask = (g: Grid): boolean[][] => {
  const mask = g.lines.map(() => new Array<boolean>(g.cols).fill(false))
  const stack: [number, number][] = []
  const push = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= g.rows || c >= g.cols) return
    if (mask[r][c] || g.lines[r][c] !== ' ') return
    mask[r][c] = true
    stack.push([r, c])
  }
  for (let r = 0; r < g.rows; r++) { push(r, 0); push(r, g.cols - 1) }
  for (let c = 0; c < g.cols; c++) { push(0, c); push(g.rows - 1, c) }
  while (stack.length > 0) {
    const [r, c] = stack.pop() as [number, number]
    push(r + 1, c); push(r - 1, c); push(r, c + 1); push(r, c - 1)
  }
  return mask
}

// 絵の見た目の左右の端（外周から到達できる空白だけの列を除いた列範囲。right は含まない）。絵が無いときは null
export const inkExtent = (g: Grid): { left: number; right: number } | null => {
  const mask = outsideMask(g)
  let left = -1
  let right = -1
  for (let c = 0; c < g.cols; c++) {
    if (mask.some((row) => !row[c])) {
      if (left < 0) left = c
      right = c + 1
    }
  }
  return left < 0 ? null : { left, right }
}

export type Run = { text: string; opaque: boolean }

export const toRuns = (g: Grid): Run[][] => {
  const mask = outsideMask(g)
  return g.lines.map((line, r) => {
    const runs: Run[] = []
    for (let c = 0; c < g.cols; c++) {
      const opaque = !mask[r][c]
      const last = runs[runs.length - 1]
      if (last && last.opaque === opaque) last.text += line[c]
      else runs.push({ text: line[c], opaque })
    }
    return runs
  })
}

// 最大段階の行数が room に収まる一様な縮小倍率（1 を超えない）。全段階に同じ倍率を掛ける
export const fitScale = (roomRows: number, maxRows: number): number => Math.min(1, roomRows / maxRows)
