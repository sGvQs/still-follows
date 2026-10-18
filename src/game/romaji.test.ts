import { describe, expect, it } from 'vitest'
import { compile, createMatcher, shortestLength, shortestSpelling } from './romaji'
import { WORDS_BY_DIFFICULTY } from './words'

const WORDS = WORDS_BY_DIFFICULTY.HARD

const run = (reading: string, s: string) => {
  const m = createMatcher(compile(reading))
  let last = 'accept'
  for (const ch of s) {
    last = m.feed(ch)
    if (last === 'reject') return 'reject'
  }
  return last
}

describe('romaji', () => {
  it('60語すべて compile でき、最短綴りで complete する', () => {
    expect(WORDS).toHaveLength(60)
    for (const w of WORDS) {
      const c = compile(w.reading)
      const sp = shortestSpelling(c)
      expect(sp.length).toBe(shortestLength(c))
      expect(run(w.reading, sp)).toBe('complete')
    }
  })
  it.each([
    ['ぴゅ', ['pyu', 'pixyu', 'pilyu']],
    ['しっぱい', ['sippai', 'shippai']],
    ['ぱっち', ['patti', 'patchi', 'pacchi']],
    ['かんい', ['kanni', 'kaxni']],
    ['がめん', ['gamen', 'gamexn']],
    ['ふぁ', ['fa', 'fuxa', 'fula']],
    ['しゅ', ['syu', 'shu', 'sixyu', 'shilyu']],
    ['ちょ', ['tyo', 'cho', 'tixyo', 'chilyo']],
    ['じゃ', ['ja', 'jya', 'zya', 'jixya', 'zilya']],
    ['けんさ', ['kensa', 'kennsa', 'kexnsa']],
  ])('%s の代替綴り', (reading, spellings) => {
    for (const s of spellings) expect(run(reading, s), s).toBe('complete')
  })
  it('かんい は kani 不可', () => {
    expect(run('かんい', 'kani')).toBe('reject')
  })
  it('ぱっち の最短は patti で L=5', () => {
    expect(shortestLength(compile('ぱっち'))).toBe(5)
  })
  it('ー は - のみ', () => {
    expect(run('えらー', 'era-')).toBe('complete')
    expect(run('えらー', 'erar')).toBe('reject')
    expect(run('えらー', 'era=')).toBe('reject')
  })
  it('reject は状態を変えない', () => {
    const m = createMatcher(compile('がめん'))
    m.feed('g')
    const before = m.preferredRemaining()
    expect(m.feed('z')).toBe('reject')
    expect(m.preferredRemaining()).toEqual(before)
    expect(m.typedLength).toBe(1)
  })
  it('大文字は小文字化して受理', () => {
    expect(run('むし', 'MUSI')).toBe('complete')
  })
  it('優先候補は短い綴り (si > shi) と進捗', () => {
    const m = createMatcher(compile('むし'))
    m.feed('m'); m.feed('u')
    expect(m.preferredRemaining()).toEqual({ spelling: 'musi', typed: 2, kana: 1 })
    m.feed('s'); m.feed('h')
    expect(m.preferredRemaining().spelling).toBe('mushi')
  })
  it('c 系促音は除外されるが cchi は許可', () => {
    expect(run('ぱっく', 'pakku')).toBe('complete')
    expect(run('ぱっく', 'packu')).toBe('reject')
    expect(run('ぱっく', 'paccu')).toBe('reject')
  })
  it('かんあ=kanna のみ complete、kana は reject', () => {
    expect(run('かんあ', 'kanna')).toBe('complete')
    expect(run('かんあ', 'kana')).toBe('reject')
  })
  it('かんな は kana/kanna とも reject（nn+na）', () => {
    expect(run('かんな', 'kana')).toBe('reject')
    expect(run('かんな', 'kanna')).toBe('reject')
    expect(run('かんな', 'kannna')).toBe('complete')
  })
  it('かんや=kannya', () => {
    expect(run('かんや', 'kannya')).toBe('complete')
    expect(run('かんや', 'kanya')).toBe('reject')
  })
  it('語末ん は n 1回で完了し hozonn は reject', () => {
    expect(run('ほぞん', 'hozon')).toBe('complete')
    expect(run('ほぞん', 'hozonn')).toBe('reject')
  })
  it('ふぁ=fwa、ぢ/づ の代表綴り', () => {
    expect(run('ふぁ', 'fwa')).toBe('complete')
    expect(run('ぢ', 'di')).toBe('complete')
    expect(run('づ', 'du')).toBe('complete')
  })
})
