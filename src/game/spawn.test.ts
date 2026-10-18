import { describe, expect, it } from 'vitest'
import { NORMAL_HORROR_RATE } from './config'
import { ENEMIES, indicesOf } from './faces'
import { bossPool, createEnemyBag } from './spawn'

const cute = new Set(indicesOf('cute'))
const horror = new Set(indicesOf('horror'))
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }

describe('spawn', () => {
  it('cute / horror の index 集合は互いに素で、合わせて ENEMIES 全体', () => {
    expect([...cute].filter((i) => horror.has(i))).toEqual([])
    expect([...cute, ...horror].sort((a, b) => a - b)).toEqual(ENEMIES.map((_, i) => i))
    expect(cute.size).toBe(7)
    expect(horror.size).toBe(6)
  })
  it('bossPool は horror のみ', () => {
    expect(new Set(bossPool(ENEMIES))).toEqual(horror)
  })
  it('EASY は 500 回引いて全て cute', () => {
    const bag = createEnemyBag('EASY', seeded(1), ENEMIES)
    for (let i = 0; i < 500; i++) expect(cute.has(bag.next())).toBe(true)
  })
  it('HARD は 500 回引いて全て horror', () => {
    const bag = createEnemyBag('HARD', seeded(2), ENEMIES)
    for (let i = 0; i < 500; i++) expect(horror.has(bag.next())).toBe(true)
  })
  it('EASY / HARD は kind 抽選で rng を消費しない（消費はバッグのシャッフルのみ）', () => {
    // 1周目（種数×ENEMY_TICKETS 枚）の間、シャッフル1回分以外は rng を呼ばない
    let draws = 0
    const rng = seeded(3)
    const bag = createEnemyBag('EASY', () => { draws += 1; return rng() }, ENEMIES)
    bag.next()
    const afterFirst = draws
    for (let i = 0; i < 5; i++) bag.next()
    expect(draws).toBe(afterFirst)
  })
  it('NORMAL は rng 固定値で決定的: 0.19 は horror、0.2 は cute、1体につき rng を1回消費', () => {
    // 注: 注入した enemyBag は kind を保証しない（kind が保証されるのは既定の createEnemyBag のみ）
    let cur = 0.5
    let calls = 0
    const bag = createEnemyBag('NORMAL', () => { calls += 1; return cur }, ENEMIES)
    // 両サブバッグを一度ずつ満たす（再充填のシャッフルが rng を使うため、以降の計測から除く）
    cur = 0.5; bag.next()
    cur = 0; bag.next()
    const cases: Array<[number, 'horror' | 'cute']> = [[0.19, 'horror'], [0.2, 'cute'], [0, 'horror'], [0.99, 'cute'], [0.1999999, 'horror']]
    for (const [v, kind] of cases) {
      cur = v
      const before = calls
      const e = bag.next()
      expect(calls - before).toBe(1)
      expect((kind === 'horror' ? horror : cute).has(e)).toBe(true)
    }
  })
  it('NORMAL の horror 率は 0.2 前後（シード固定 5000 回）', () => {
    const bag = createEnemyBag('NORMAL', seeded(5), ENEMIES)
    let h = 0
    for (let i = 0; i < 5000; i++) if (horror.has(bag.next())) h += 1
    expect(Math.abs(h / 5000 - NORMAL_HORROR_RATE)).toBeLessThan(0.03)
  })
})
