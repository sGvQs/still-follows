// ローマ字入力判定（NFA型マッチャ）

export type Unit = { kana: number; cands: string[] }
export type CompiledWord = { reading: string; units: Unit[] }
export type FeedResult = 'accept' | 'reject' | 'complete'
export type Preferred = { spelling: string; typed: number; kana: number }

const ROWS: Record<string, string[]> = {
  あ: ['a'], い: ['i'], う: ['u', 'wu'], え: ['e'], お: ['o'],
  か: ['ka', 'ca'], き: ['ki'], く: ['ku', 'cu'], け: ['ke'], こ: ['ko', 'co'],
  さ: ['sa'], し: ['si', 'shi'], す: ['su'], せ: ['se'], そ: ['so'],
  た: ['ta'], ち: ['ti', 'chi'], つ: ['tu', 'tsu'], て: ['te'], と: ['to'],
  な: ['na'], に: ['ni'], ぬ: ['nu'], ね: ['ne'], の: ['no'],
  は: ['ha'], ひ: ['hi'], ふ: ['hu', 'fu'], へ: ['he'], ほ: ['ho'],
  ま: ['ma'], み: ['mi'], む: ['mu'], め: ['me'], も: ['mo'],
  や: ['ya'], ゆ: ['yu'], よ: ['yo'],
  ら: ['ra'], り: ['ri'], る: ['ru'], れ: ['re'], ろ: ['ro'],
  わ: ['wa'], を: ['wo'],
  が: ['ga'], ぎ: ['gi'], ぐ: ['gu'], げ: ['ge'], ご: ['go'],
  ざ: ['za'], じ: ['ji', 'zi'], ず: ['zu'], ぜ: ['ze'], ぞ: ['zo'],
  だ: ['da'], ぢ: ['di', 'dzi'], づ: ['du', 'dzu'], で: ['de'], ど: ['do'],
  ば: ['ba'], び: ['bi'], ぶ: ['bu'], べ: ['be'], ぼ: ['bo'],
  ぱ: ['pa'], ぴ: ['pi'], ぷ: ['pu'], ぺ: ['pe'], ぽ: ['po'],
  ぁ: ['xa', 'la'], ぃ: ['xi', 'li'], ぅ: ['xu', 'lu'], ぇ: ['xe', 'le'], ぉ: ['xo', 'lo'],
  ゃ: ['xya', 'lya'], ゅ: ['xyu', 'lyu'], ょ: ['xyo', 'lyo'],
  ー: ['-'],
}

const SMALL_TSU = ['xtu', 'ltu', 'xtsu', 'ltsu']
const SMALL_Y: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' }
const SMALL_V: Record<string, string> = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' }
const YOON_DIRECT: Record<string, string[]> = {
  き: ['ky'], ぎ: ['gy'], し: ['sy', 'sh'], じ: ['j', 'jy', 'zy'], ち: ['ty', 'ch'],
  ぢ: ['dy'], に: ['ny'], ひ: ['hy'], び: ['by'], ぴ: ['py'], み: ['my'], り: ['ry'],
}
const N_BLOCK = new Set(['a', 'i', 'u', 'e', 'o', 'y', 'n'])
const VOWELS = new Set(['a', 'i', 'u', 'e', 'o'])

const uniq = (xs: string[]): string[] => Array.from(new Set(xs))

const yoonCands = (base: string, small: string): string[] => {
  const v = SMALL_Y[small]
  const direct = YOON_DIRECT[base].map((p) => p + v)
  const stems = ROWS[base]
  const via = ['x', 'l'].flatMap((m) => stems.map((s) => `${s}${m}y${v}`))
  return uniq([...direct, ...via])
}

const fuCands = (small: string): string[] => {
  const v = SMALL_V[small]
  const via = ['x', 'l'].flatMap((m) => ROWS['ふ'].map((s) => `${s}${m}${v}`))
  const direct = v === 'a' ? ['fa', 'fwa'] : [`f${v}`]
  return uniq([...direct, ...via])
}

type Raw = { kana: string; cands: string[] | null; kind: 'normal' | 'n' | 'tsu' }

const parse = (reading: string): Raw[] => {
  const raws: Raw[] = []
  const chars = Array.from(reading)
  for (let i = 0; i < chars.length; ) {
    const ch = chars[i]
    const nx = chars[i + 1]
    if (ch === 'ん') { raws.push({ kana: ch, cands: null, kind: 'n' }); i += 1; continue }
    if (ch === 'っ') { raws.push({ kana: ch, cands: null, kind: 'tsu' }); i += 1; continue }
    if (nx && YOON_DIRECT[ch] && SMALL_Y[nx]) {
      raws.push({ kana: ch + nx, cands: yoonCands(ch, nx), kind: 'normal' }); i += 2; continue
    }
    if (ch === 'ふ' && nx && SMALL_V[nx]) {
      raws.push({ kana: ch + nx, cands: fuCands(nx), kind: 'normal' }); i += 2; continue
    }
    const row = ROWS[ch]
    if (!row) throw new Error(`romaji: 未対応のかな "${ch}" (reading: ${reading})`)
    raws.push({ kana: ch, cands: row, kind: 'normal' }); i += 1
  }
  return raws
}

const mergeTsu = (next: string[]): string[] => {
  const out: string[] = []
  for (const c of next) {
    const h = c[0]
    if (!VOWELS.has(h) && h !== 'n' && h !== 'c') out.push(h + c)
  }
  for (const c of next) if (!VOWELS.has(c[0]) && c[0] !== 'n') for (const s of SMALL_TSU) out.push(s + c)
  for (const c of next) if (c.startsWith('ch')) { out.push('t' + c); out.push('c' + c) }
  return uniq(out)
}

export const compile = (reading: string): CompiledWord => {
  if (reading.length === 0) throw new Error('romaji: 空の reading')
  const raws = parse(reading)
  // っ の静的合成
  const merged: Raw[] = []
  for (let i = 0; i < raws.length; i++) {
    const r = raws[i]
    const nx = raws[i + 1]
    if (r.kind === 'tsu') {
      if (nx && nx.kind === 'normal' && nx.cands) {
        merged.push({ kana: r.kana + nx.kana, cands: mergeTsu(nx.cands), kind: 'normal' })
        i += 1
      } else merged.push({ kana: r.kana, cands: SMALL_TSU, kind: 'normal' })
    } else merged.push(r)
  }
  const units: Unit[] = merged.map((r, idx) => {
    const kana = Array.from(r.kana).length
    if (r.kind !== 'n') return { kana, cands: r.cands as string[] }
    const next = merged[idx + 1]
    if (!next) return { kana, cands: ['n', 'xn'] }
    const nextCands = next.kind === 'n' ? ['nn'] : (next.cands as string[])
    const allowN = nextCands.every((c) => !N_BLOCK.has(c[0]))
    return { kana, cands: allowN ? ['nn', 'xn', 'n'] : ['nn', 'xn'] }
  })
  return { reading, units }
}

// 英語のお題用。1 文字 = 1 ユニット（綴りは 1 通り）。小文字の英字と半角スペースのみ
export const compileEnglish = (reading: string): CompiledWord => {
  if (!/^[a-z]+( [a-z]+)*$/.test(reading)) throw new Error(`romaji: 英語の reading は小文字の英字と半角スペースのみ (reading: ${reading})`)
  return { reading, units: Array.from(reading).map((ch) => ({ kana: 1, cands: [ch] })) }
}

const unitShortest = (u: Unit): number => u.cands.reduce((m, c) => Math.min(m, c.length), Infinity)

export const shortestLength = (w: CompiledWord): number =>
  w.units.reduce((s, u) => s + unitShortest(u), 0)

// 最短綴り（同率は登録順）
export const shortestSpelling = (w: CompiledWord): string =>
  w.units.map((u) => u.cands.reduce((b, c) => (c.length < b.length ? c : b))).join('')

type State = { u: number; c: number; p: number }

export type Matcher = {
  feed: (ch: string) => FeedResult
  preferredRemaining: () => Preferred
  readonly typedLength: number
  readonly done: boolean
}

export const createMatcher = (w: CompiledWord): Matcher => {
  const tail: number[] = new Array(w.units.length + 1).fill(0)
  for (let i = w.units.length - 1; i >= 0; i--) tail[i] = tail[i + 1] + unitShortest(w.units[i])
  let typed = ''
  let done = false
  let states: State[] = w.units[0].cands.map((_, c) => ({ u: 0, c, p: 0 }))

  const pick = (): State => {
    let best = states[0]
    let bestLen = Infinity
    for (const s of states) {
      const len = w.units[s.u].cands[s.c].length - s.p + tail[s.u + 1]
      if (len < bestLen) { best = s; bestLen = len }
    }
    return best
  }

  const feed = (raw: string): FeedResult => {
    if (done || raw.length !== 1) return 'reject'
    const ch = raw.toLowerCase()
    const next: State[] = []
    const seen = new Set<string>()
    const add = (s: State) => {
      const k = `${s.u}:${s.c}:${s.p}`
      if (!seen.has(k)) { seen.add(k); next.push(s) }
    }
    let complete = false
    for (const s of states) {
      const cand = w.units[s.u].cands[s.c]
      if (cand[s.p] !== ch) continue
      if (s.p + 1 < cand.length) { add({ u: s.u, c: s.c, p: s.p + 1 }); continue }
      if (s.u === w.units.length - 1) { complete = true; continue }
      w.units[s.u + 1].cands.forEach((_, c) => add({ u: s.u + 1, c, p: 0 }))
    }
    if (!complete && next.length === 0) return 'reject'
    typed += ch
    if (complete) { done = true; return 'complete' }
    states = next
    return 'accept'
  }

  const preferredRemaining = (): Preferred => {
    if (done) return { spelling: typed, typed: typed.length, kana: w.reading.length }
    const s = pick()
    const rest = w.units[s.u].cands[s.c].slice(s.p) + w.units.slice(s.u + 1).map((u) => u.cands.reduce((b, c) => (c.length < b.length ? c : b))).join('')
    let kana = 0
    for (let i = 0; i < s.u; i++) kana += w.units[i].kana
    return { spelling: typed + rest, typed: typed.length, kana }
  }

  return {
    feed,
    preferredRemaining,
    get typedLength() { return typed.length },
    get done() { return done },
  }
}
