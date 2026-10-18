import { NORMAL_HORROR_RATE } from './config'
import type { Difficulty } from './difficulty'
import type { Enemy } from './faces'
import { createBag, type Bag } from './words'

export const ENEMY_TICKETS = 2 // バッグに入れる各種の枚数

const indicesByKind = (enemies: Enemy[], kind: Enemy['kind']): number[] =>
  enemies.flatMap((e, i) => (e.kind === kind ? [i] : []))

const kindBag = (enemies: Enemy[], kind: Enemy['kind'], rng: () => number): Bag<number> => {
  const idx = indicesByKind(enemies, kind)
  return createBag(idx.flatMap((i) => Array.from({ length: ENEMY_TICKETS }, () => i)), rng)
}

// HARD のボス抽選の母集団（horror の index 群）。EASY / NORMAL は boss=-1 で使わない
export const bossPool = (enemies: Enemy[]): number[] => indicesByKind(enemies, 'horror')

// 難易度ごとの既定の敵バッグ。
// EASY=cute のみ、HARD=horror のみ（kind 抽選なし。rng 消費はバッグのシャッフルのみ）。
// NORMAL は cute 用・horror 用の2バッグを持ち、next() ごとに rng を1回消費して kind を決める。
// 注意: NORMAL の「同種連続防止」（シャッフルバッグの再充填境界）は各サブバッグ内でのみ効く。
// cute と horror をまたぐ並びでは、同じ種が連続することがある。
export const createEnemyBag = (difficulty: Difficulty, rng: () => number, enemies: Enemy[]): Bag<number> => {
  if (difficulty === 'EASY') return kindBag(enemies, 'cute', rng)
  if (difficulty === 'HARD') return kindBag(enemies, 'horror', rng)
  const cute = kindBag(enemies, 'cute', rng)
  const horror = kindBag(enemies, 'horror', rng)
  return { next: () => (rng() < NORMAL_HORROR_RATE ? horror.next() : cute.next()) }
}
