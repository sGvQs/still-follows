import { describe, expect, it } from 'vitest'
import { LEVELS, RESULT_MIN_ACTIVE_MS } from './config'
import { accuracy, hasModifier, kanaPerMinute, levelOf, showsLevel, wordsPerMinute } from './score'

describe('score', () => {
  it('正解率', () => {
    expect(accuracy(0, 0)).toBeNull()
    expect(accuracy(10, 0)).toBe(100)
    expect(accuracy(0, 5)).toBe(0)
    expect(accuracy(95, 5)).toBeCloseTo(95)
  })
  it('速度', () => {
    expect(kanaPerMinute(10, 0)).toBeNull()
    expect(kanaPerMinute(10, 9999)).toBeNull()
    expect(kanaPerMinute(10, 10000)).toBeCloseTo(60)
    expect(kanaPerMinute(0, 30000)).toBe(0)
  })
  it('純かな数での速度と階級', () => {
    // 60秒で60かな撃破・誤入力3回 → 純かな57
    expect(kanaPerMinute(57, 60000)).toBeCloseTo(57)
    expect(levelOf(kanaPerMinute(57, 60000)!)).toBe('準2級')
    expect(levelOf(kanaPerMinute(4.9, 60000)!)).toBeNull()
    expect(levelOf(kanaPerMinute(5, 60000)!)).toBe('6級')
    // 誤入力0なら従来（kana）と一致
    expect(levelOf(kanaPerMinute(60, 60000)!)).toBe('2級')
  })
  it('レベル境界', () => {
    const table: [number, string][] = [
      [5, '6級'], [10, '5級'], [25, '4級'], [35, '3級'], [45, '準2級'],
      [60, '2級'], [80, '準1級'], [100, '1級'], [150, '初段'], [200, '特段'],
    ]
    expect(levelOf(4.9)).toBeNull()
    table.forEach(([min, label], i) => {
      expect(levelOf(min)).toBe(label)
      if (i > 0) expect(levelOf(min - 0.1)).toBe(table[i - 1][1])
    })
    expect(levelOf(1000)).toBe('特段')
  })
  it('LEVELS は降順で10階級・重複なし', () => {
    expect(LEVELS).toHaveLength(10)
    const mins = LEVELS.map((l) => l.min)
    expect(mins).toEqual([...mins].sort((x, y) => y - x))
    expect(new Set(mins).size).toBe(10)
    expect(new Set(LEVELS.map((l) => l.label)).size).toBe(10)
  })
  it('修飾キー', () => {
    expect(hasModifier({ ctrlKey: false, metaKey: false, altKey: false })).toBe(false)
    expect(hasModifier({ ctrlKey: true, metaKey: false, altKey: false })).toBe(true)
    expect(hasModifier({ ctrlKey: false, metaKey: true, altKey: false })).toBe(true)
    expect(hasModifier({ ctrlKey: false, metaKey: false, altKey: true })).toBe(true)
  })
})

describe('showsLevel', () => {
  it('クリアかつ難易度の設定が true のときだけ階級を出す', () => {
    expect(showsLevel({ outcome: 'clear' }, true)).toBe(true)
    expect(showsLevel({ outcome: 'clear' }, false)).toBe(false)
    expect(showsLevel({ outcome: 'gameover' }, true)).toBe(false)
  })
})

describe('wordsPerMinute', () => {
  it('5 文字 = 1 語として 1 分あたりの語数を返し、活動時間が足りないと null', () => {
    expect(wordsPerMinute(100, 60000, 0)).toBe(20)
    expect(wordsPerMinute(100, 0)).toBeNull()
    expect(wordsPerMinute(100, RESULT_MIN_ACTIVE_MS - 1)).toBeNull()
  })
})
