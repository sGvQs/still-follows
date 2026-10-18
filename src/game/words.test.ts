import { describe, expect, it } from 'vitest'
import { DIFFICULTIES, DIFFICULTY_CONFIG, type Difficulty } from './difficulty'
import { approachSeconds } from './engine'
import { compile, compileEnglish, createMatcher, shortestLength } from './romaji'
import { createBag, createWordBag, WORD_ENTRIES_EN_BY_DIFFICULTY, WORDS_BY_DIFFICULTY, WORDS_EN_BY_DIFFICULTY, WORD_ENTRIES_BY_DIFFICULTY } from './words'
import { createEngine } from './engine'

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

// 難易度ごとの期待値。EASY・NORMAL は拡張済み（EASY 50・NORMAL 63）
const EXPECTED: Record<Difficulty, { count: number; minShortest: number; maxShortest: number; maxLongest: number }> = {
  EASY: { count: 50, minShortest: 2, maxShortest: 40, maxLongest: 50 },
  NORMAL: { count: 63, minShortest: 10, maxShortest: 40, maxLongest: 50 },
  HARD: { count: 60, minShortest: 20, maxShortest: 40, maxLongest: 50 },
}

describe.each(DIFFICULTIES)('words %s', (difficulty) => {
  const WORDS = WORDS_BY_DIFFICULTY[difficulty]
  const WORD_ENTRIES = WORD_ENTRIES_BY_DIFFICULTY[difficulty]
  const exp = EXPECTED[difficulty]
  it('全語 compile でき reading はひらがなと長音のみ', () => {
    for (const w of WORDS) {
      expect(() => compile(w.reading)).not.toThrow()
      expect(w.reading).toMatch(/^[ぁ-ゖー]+$/)
    }
    expect(WORD_ENTRIES).toHaveLength(WORDS.length)
  })
  it('件数が期待どおりで、text・reading に記号を含まず、重複しない', () => {
    expect(WORDS).toHaveLength(exp.count)
    for (const w of WORDS) {
      expect(w.text).not.toMatch(/[、。，．0-9０-９a-zA-Zａ-ｚＡ-Ｚ()（）「」『』・]/)
      expect(w.reading).not.toMatch(/[、。，．0-9０-９a-zA-Zａ-ｚＡ-Ｚ()（）「」『』・]/)
    }
    expect(new Set(WORDS.map((w) => w.text)).size).toBe(WORDS.length)
    expect(new Set(WORDS.map((w) => w.reading)).size).toBe(WORDS.length)
  })
  it('text・reading に空白（半角・全角）を含まない', () => {
    for (const w of WORDS) {
      expect(w.text).not.toMatch(/[\s\u3000]/)
      expect(w.reading).not.toMatch(/[\s\u3000]/)
    }
  })
  it('最短打鍵数・最長綴りは期待の範囲、接近時間は MIN〜MAX', () => {
    const { approach } = DIFFICULTY_CONFIG[difficulty]
    for (const e of WORD_ENTRIES) {
      const L = shortestLength(e.compiled)
      const longest = e.compiled.units.reduce((s, u) => s + Math.max(...u.cands.map((c) => c.length)), 0)
      expect(L).toBeGreaterThanOrEqual(exp.minShortest)
      expect(L).toBeLessThanOrEqual(exp.maxShortest)
      expect(longest).toBeLessThanOrEqual(exp.maxLongest)
      const t = approachSeconds(L, 0, approach)
      expect(t).toBeGreaterThanOrEqual(approach.min)
      expect(t).toBeLessThanOrEqual(approach.max)
    }
  })
  it('1周内で重複せず、周回境界で直前語が連続しない', () => {
    for (const seed of [1, 2, 3, 42, 99]) {
      for (const rng of [seeded(seed), () => 0, () => 0.999999]) {
        const bag = createWordBag(rng, difficulty)
        let prev = ''
        for (let lap = 0; lap < 5; lap++) {
          const seen = new Set<string>()
          for (let i = 0; i < WORDS.length; i++) {
            const e = bag.next()
            expect(seen.has(e.word.reading)).toBe(false)
            seen.add(e.word.reading)
            if (i === 0 && lap > 0) expect(e.word.reading).not.toBe(prev)
            prev = e.word.reading
          }
          expect(seen.size).toBe(WORDS.length)
        }
      }
    }
  })
})

describe('words', () => {
  it('汎用バッグは任意の要素を1周内重複なく返す', () => {
    const bag = createBag(['a', 'b', 'c'], seeded(7))
    const lap = [bag.next(), bag.next(), bag.next()]
    expect([...lap].sort()).toEqual(['a', 'b', 'c'])
  })
})

const EXPECTED_EN: Record<Difficulty, { count: number; minLen: number; maxLen: number }> = {
  EASY: { count: 50, minLen: 3, maxLen: 20 },
  NORMAL: { count: 61, minLen: 10, maxLen: 40 },
  HARD: { count: 61, minLen: 20, maxLen: 50 },
}

describe.each(DIFFICULTIES)('英語の words %s', (difficulty) => {
  const WORDS = WORDS_EN_BY_DIFFICULTY[difficulty]
  const exp = EXPECTED_EN[difficulty]
  it('件数・長さが期待どおりで、小文字の英字とスペースだけを打ち、重複しない', () => {
    expect(WORDS).toHaveLength(exp.count)
    expect(WORD_ENTRIES_EN_BY_DIFFICULTY[difficulty]).toHaveLength(exp.count)
    for (const w of WORDS) {
      expect(w.reading).toBe(w.text.toLowerCase())
      expect(w.reading).toMatch(/^[a-z]+( [a-z]+)*$/)
      expect(w.reading.length).toBeGreaterThanOrEqual(exp.minLen)
      expect(w.reading.length).toBeLessThanOrEqual(exp.maxLen)
      const t = approachSeconds(w.reading.length, 0, DIFFICULTY_CONFIG[difficulty].approach)
      expect(t).toBeGreaterThanOrEqual(DIFFICULTY_CONFIG[difficulty].approach.min)
    }
    expect(new Set(WORDS.map((w) => w.reading)).size).toBe(WORDS.length)
  })
  it('1周内で重複しない', () => {
    const bag = createWordBag(seeded(5), difficulty, 'EN')
    const seen = new Set<string>()
    for (let i = 0; i < WORDS.length; i++) seen.add(bag.next().word.reading)
    expect(seen.size).toBe(WORDS.length)
  })
})

describe('英語入力', () => {
  it('スペースを含めて 1 文字ずつ打てて、大文字でも受理し、誤入力は reject', () => {
    const m = createMatcher(compileEnglish('good night'))
    for (const ch of 'good') expect(m.feed(ch)).toBe('accept')
    expect(m.feed('x')).toBe('reject')
    expect(m.feed(' ')).toBe('accept')
    for (const ch of 'nigh') expect(m.feed(ch)).toBe('accept')
    expect(m.feed('T')).toBe('complete')
  })
  it('英語以外の文字は compileEnglish できない', () => {
    expect(() => compileEnglish('あ')).toThrow()
    expect(() => compileEnglish('a  b')).toThrow()
    expect(() => compileEnglish(' a')).toThrow()
  })
  it('エンジンは TITLE で選んだ言語のお題を出し、開始後は言語を変えられない', () => {
    const eng = createEngine({ stageCount: 3, rng: () => 0 })
    expect(eng.getSnapshot(0).language).toBe('JA')
    expect(eng.setLanguage('EN')).toBe(true)
    expect(eng.getSnapshot(0).language).toBe('EN')
    expect(eng.start(0, 'EASY')).toBe(true)
    expect(eng.setLanguage('JA')).toBe(false)
    expect(eng.getSnapshot(0).language).toBe('EN')
    const text = eng.getSnapshot(5000).word?.text ?? ''
    expect(WORDS_EN_BY_DIFFICULTY.EASY.map((w) => w.text)).toContain(text)
  })
})
