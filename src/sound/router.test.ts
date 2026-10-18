import { describe, expect, it } from 'vitest'
import { COUNTIN_MS, SURVIVE_MS, GAMEOVER_EFFECT_STEPS_X, GAMEOVER_EFFECT_STEP_MS, GAP_MS, WARNING_MS } from '../game/config'
import type { Difficulty } from '../game/difficulty'
import { createEngine, type Snapshot } from '../game/engine'
import { compile, shortestSpelling } from '../game/romaji'
import type { WordEntry } from '../game/words'
import type { SoundName, SoundPlayer } from './player'
import { createSoundRouter, SOUND_SYNC_GAP_MS } from './router'

const N = 6
const WORD: WordEntry = { word: { text: '虫', reading: 'むし' }, compiled: compile('むし') }
const SPELL = shortestSpelling(WORD.compiled)

const fakePlayer = () => {
  const log: string[] = [] // play と stopWorld('STOP')
  const meta: string[] = [] // stopMusic('STOP_MUSIC') と preload('PRELOAD:<name>')
  const player: SoundPlayer = {
    play: (n: SoundName) => { log.push(n) },
    stopWorld: () => { log.push('STOP') },
    stopMusic: () => { meta.push('STOP_MUSIC') },
    preload: (n) => { meta.push(`PRELOAD:${n}`) },
  }
  return { log, meta, player }
}
// 同じ敵が続く列（enemyId だけが変わる）。boss は pickBoss で指定
const setup = (difficulty: Difficulty = 'NORMAL', opts: { boss?: number; enemy?: number; hp?: number; rng?: () => number } = {}) => {
  const { log, meta, player } = fakePlayer()
  const eng = createEngine({
    stageCount: N, playerHp: opts.hp ?? 3, bag: { next: () => WORD },
    enemyBag: { next: () => opts.enemy ?? 1 }, pickBoss: () => opts.boss ?? 0,
  })
  const router = createSoundRouter(player, opts.rng ?? (() => 0))
  const begin = (t: number) => {
    eng.start(t, difficulty)
    router.onBegin(eng.getSnapshot(t), t)
  }
  // 前進して観測（tick → getSnapshot → onSnap）。step ごとに観測する
  const observe = (from: number, to: number, step = 50) => {
    for (let t = from; t <= to; t += step) { eng.tick(t); router.onSnap(eng.getSnapshot(t), t) }
  }
  return { eng, router, log, meta, begin, observe }
}
const feet = (log: string[]) => log.filter((n) => n.endsWith('footstep'))

describe('足音', () => {
  it('同じ敵で stage が進むたびに鳴る。NORMAL と HARD で音が違う', () => {
    for (const [d, name] of [['NORMAL', 'normal-footstep'], ['HARD', 'hard-footstep']] as const) {
      const s = setup(d, { boss: 5 }) // ボス種(5)と別の敵(1)
      s.begin(0)
      const t0 = d === 'HARD' ? WARNING_MS : COUNTIN_MS
      s.observe(0, t0)
      expect(feet(s.log)).toEqual([]) // 開始直後・出現では鳴らない
      s.observe(t0, t0 + s.eng.limitMs - 1)
      expect(feet(s.log)).toEqual(Array(N - 1).fill(name))
    }
  })
  it('ボス種でも HARD の足音（stage の数だけ）', () => {
    const s = setup('HARD', { boss: 1, enemy: 1 })
    s.begin(0)
    s.observe(0, WARNING_MS)
    expect(s.eng.getSnapshot(WARNING_MS).buffed).toBe(true)
    s.observe(WARNING_MS, WARNING_MS + s.eng.limitMs - 1, 20)
    expect(feet(s.log)).toEqual(Array(N - 1).fill('hard-footstep'))
  })
  it('EASY は鳴らない', () => {
    const s = setup('EASY')
    s.begin(0)
    s.observe(0, COUNTIN_MS + s.eng.limitMs - 1)
    expect(s.log.filter((n) => n !== 'STOP')).toEqual([])
  })
  it('COUNTIN → APPROACH（開始直後）で鳴らない', () => {
    const s = setup('NORMAL')
    s.begin(0)
    s.observe(0, COUNTIN_MS + 100)
    expect(s.eng.getSnapshot(COUNTIN_MS).stage).toBe(0)
    expect(s.log).toEqual([])
  })
  it('WARNING → APPROACH で鳴らない（開幕音は WARNING 開始時の1回だけ）', () => {
    const s = setup('HARD', { boss: 5 })
    s.begin(0)
    s.observe(0, WARNING_MS + 100)
    expect(s.log).toEqual(['hard-opening'])
  })
  it('新しい敵の初回観測（GAP → APPROACH）では鳴らない。リトライ後も同様', () => {
    const s = setup('NORMAL')
    s.begin(0)
    s.observe(0, COUNTIN_MS)
    const t = COUNTIN_MS + 100
    for (const c of SPELL) s.router.onKey(s.eng.handleKey(t, c))
    s.log.length = 0
    s.observe(t, t + GAP_MS + 100, 20)
    expect(s.eng.getSnapshot(t + GAP_MS).enemyId).toBe(2)
    expect(feet(s.log)).toEqual([])

    // ゲームオーバー → TITLE → 再開
    const s2 = setup('NORMAL', { hp: 1 })
    s2.begin(0)
    s2.observe(0, COUNTIN_MS + s2.eng.limitMs)
    const end = COUNTIN_MS + s2.eng.limitMs + GAMEOVER_EFFECT_STEPS_X.length * GAMEOVER_EFFECT_STEP_MS + 10
    s2.observe(COUNTIN_MS + s2.eng.limitMs, end, 10)
    expect(s2.eng.toTitle()).toBe(true)
    s2.router.onSnap(s2.eng.getSnapshot(end), end)
    s2.log.length = 0
    s2.begin(end + 10)
    s2.observe(end + 10, end + 10 + COUNTIN_MS + 200)
    expect(s2.log).toEqual([])
  })
  it('300ms 以上空いたら鳴らさず現在値に同期する。その後は通常どおり鳴る', () => {
    const s = setup('NORMAL')
    s.begin(0)
    s.observe(0, COUNTIN_MS)
    const mid = COUNTIN_MS + s.eng.limitMs * 0.5
    s.eng.tick(mid)
    s.router.onSnap(s.eng.getSnapshot(mid), mid) // 空きが大きいので鳴らない
    expect(feet(s.log)).toEqual([])
    s.observe(mid + 20, COUNTIN_MS + s.eng.limitMs - 1, 20)
    expect(feet(s.log).length).toBe(2) // stage 3 → 5 の2回
  })
  it('空きが SOUND_SYNC_GAP_MS 未満なら鳴らす', () => {
    const s = setup('NORMAL')
    s.begin(0)
    s.observe(0, COUNTIN_MS)
    const per = s.eng.limitMs / N
    const a = COUNTIN_MS + per - 20 // stage 0 の末尾
    const b = COUNTIN_MS + per + 5 // stage 1
    expect(b - a).toBeLessThan(SOUND_SYNC_GAP_MS)
    s.router.onSnap(s.eng.getSnapshot(a), a - 10) // 直前の観測（空きなし扱いにするため時刻を近づける）
    s.router.onSnap(s.eng.getSnapshot(b), b)
    expect(feet(s.log)).toEqual(['normal-footstep'])
  })
  it('tick が複数フェーズを一気に進めたときは、途中の足音は失われる（仕様）', () => {
    const s = setup('NORMAL')
    s.begin(0)
    s.observe(0, COUNTIN_MS)
    const per = s.eng.limitMs / N
    // 直前の観測は同じ敵の stage 0。時間切れ → GAP → 次の敵の APPROACH まで一気に進む
    const t = COUNTIN_MS + s.eng.limitMs + GAP_MS + 10
    s.router.onSnap(s.eng.getSnapshot(COUNTIN_MS + per - 10), COUNTIN_MS + per - 10)
    s.log.length = 0
    s.eng.tick(t)
    s.router.onSnap(s.eng.getSnapshot(t), t)
    expect(s.eng.getSnapshot(t).phase).toBe('APPROACH')
    expect(feet(s.log)).toEqual([])
  })
})

describe('停止', () => {
  it('撃破（onKey kill）・被弾・DYING・RESULT・TITLE 入りで止まる。打鍵音は止めない', () => {
    const kill = setup('NORMAL')
    kill.begin(0)
    kill.observe(0, COUNTIN_MS)
    kill.log.length = 0
    for (const c of SPELL) kill.router.onKey(kill.eng.handleKey(COUNTIN_MS + 10, c))
    expect(kill.log[kill.log.length - 2]).toBe('STOP') // 最後の打鍵: 足音を止めてから打鍵音
    expect(kill.log[kill.log.length - 1]).toMatch(/^type-/)

    const hit = setup('NORMAL')
    hit.begin(0)
    hit.observe(0, COUNTIN_MS)
    hit.log.length = 0
    hit.observe(COUNTIN_MS, COUNTIN_MS + hit.eng.limitMs + 10, 10)
    expect(hit.eng.getSnapshot(COUNTIN_MS + hit.eng.limitMs + 10).phase).toBe('GAP')
    expect(hit.log[hit.log.length - 1]).toBe('STOP')

    const over = setup('NORMAL', { hp: 1 })
    over.begin(0)
    over.observe(0, COUNTIN_MS)
    const go = COUNTIN_MS + over.eng.limitMs
    over.log.length = 0
    over.observe(go - 10, go + 10, 10)
    expect(over.eng.getSnapshot(go + 10).phase).toBe('DYING')
    expect(over.log[over.log.length - 1]).toBe('STOP')
    over.log.length = 0
    const res = go + GAMEOVER_EFFECT_STEPS_X.length * GAMEOVER_EFFECT_STEP_MS + 10
    over.observe(go + 20, res, 10)
    expect(over.eng.getSnapshot(res).phase).toBe('RESULT')
    expect(over.log).toEqual(['STOP', 'result-normal'])
    over.log.length = 0
    over.eng.toTitle()
    over.router.onSnap(over.eng.getSnapshot(res + 10), res + 10)
    expect(over.log).toEqual(['STOP'])
  })
})

describe('打鍵音', () => {
  const snap = (): Snapshot => setup().eng.getSnapshot(0)
  it('accept と kill で鳴り、reject・ignored では鳴らない', () => {
    const { log, player } = fakePlayer()
    const r = createSoundRouter(player, () => 0)
    r.onKey('reject'); r.onKey('ignored')
    expect(log).toEqual([])
    r.onKey('accept')
    expect(log).toEqual(['type-a'])
    r.onKey('kill')
    expect(log.filter((n) => n.startsWith('type-'))).toEqual(['type-a', 'type-b'])
    expect(snap().phase).toBe('TITLE')
  })
  it('直前と同じ音を連続させない（rng がどの値でも）', () => {
    for (const v of [0, 0.4, 0.5, 0.999]) {
      const { log, player } = fakePlayer()
      const r = createSoundRouter(player, () => v)
      for (let i = 0; i < 30; i++) r.onKey('accept')
      const types = log.filter((n) => n.startsWith('type-'))
      for (let i = 1; i < types.length; i++) expect(types[i]).not.toBe(types[i - 1])
    }
  })
})

describe('開幕音', () => {
  it('HARD の start 直後（WARNING）だけ鳴る', () => {
    for (const d of ['EASY', 'NORMAL'] as const) {
      const s = setup(d)
      s.begin(0)
      expect(s.log).toEqual([])
    }
    const s = setup('HARD')
    s.begin(0)
    expect(s.log).toEqual(['hard-opening'])
  })
})

describe('前回 onSnap 時刻', () => {
  it('空いた後の同期（onKeyDown 経由の onSnap も同じ）で更新され、直後の通常観測は鳴る', () => {
    const s = setup('NORMAL')
    s.begin(0)
    s.observe(0, COUNTIN_MS)
    const per = s.eng.limitMs / N
    const boundary = COUNTIN_MS + per * 3 // stage 3 に入る時刻
    // 500ms 以上空いた最初の観測（キー経由でも同じ onSnap）。同期扱いで鳴らない
    const sync = boundary - 10
    s.router.onSnap(s.eng.getSnapshot(sync), sync)
    expect(feet(s.log)).toEqual([])
    // 前回時刻が更新されていれば、15ms 後の観測は空きが小さいので鳴る（更新されていないと沈黙する）
    s.router.onSnap(s.eng.getSnapshot(boundary + 5), boundary + 5)
    expect(feet(s.log)).toEqual(['normal-footstep'])
  })
})

describe('リザルト曲', () => {
  const MUSIC = { EASY: 'result-easy', NORMAL: 'result-normal', HARD: 'result-hard' } as const
  const music = (log: string[]) => log.filter((n) => n.startsWith('result-'))
  // クリア: HP を十分に持たせて SURVIVE_MS 生き延びる（クリアは DYING を経由せず直接 RESULT）
  const clear = (s: ReturnType<typeof setup>, d: Difficulty) => {
    s.begin(0)
    const t = (d === 'HARD' ? WARNING_MS : COUNTIN_MS) + SURVIVE_MS + 2000
    s.observe(0, t, 50)
    return t
  }
  for (const d of ['EASY', 'NORMAL', 'HARD'] as const) {
    it(`${d}: DYING 経由のゲームオーバーで曲が1回だけ。RESULT 中の連続 onSnap でも増えない`, () => {
      const s = setup(d, { hp: 1 })
      s.begin(0)
      const t0 = d === 'HARD' ? WARNING_MS : COUNTIN_MS
      s.observe(0, t0 + s.eng.limitMs + GAMEOVER_EFFECT_STEPS_X.length * GAMEOVER_EFFECT_STEP_MS + 10, 10)
      expect(music(s.log)).toEqual([MUSIC[d]])
      s.observe(100000, 101000, 10)
      expect(music(s.log)).toEqual([MUSIC[d]])
    })
    it(`${d}: 直接 RESULT のクリアで曲が1回だけ`, () => {
      const s = setup(d, { hp: 100000 })
      const t = clear(s, d)
      expect(s.eng.getSnapshot(t).phase).toBe('RESULT')
      expect(music(s.log)).toEqual([MUSIC[d]])
      s.observe(t + 10, t + 500, 10)
      expect(music(s.log)).toEqual([MUSIC[d]])
    })
  }
  it('同期ガード（300ms 超）を超えていても RESULT 入りで鳴り、離脱で止まる', () => {
    const s = setup('NORMAL', { hp: 1 })
    s.begin(0)
    s.observe(0, COUNTIN_MS)
    const res = COUNTIN_MS + s.eng.limitMs + GAMEOVER_EFFECT_STEPS_X.length * GAMEOVER_EFFECT_STEP_MS + 10
    s.eng.tick(res) // 背面タブ復帰相当: 一気に RESULT
    s.router.onSnap(s.eng.getSnapshot(res), res)
    expect(res - COUNTIN_MS).toBeGreaterThan(SOUND_SYNC_GAP_MS)
    expect(s.eng.getSnapshot(res).phase).toBe('RESULT')
    expect(music(s.log)).toEqual(['result-normal'])
    s.meta.length = 0
    const later = res + 5000 // 離脱も空いた後の観測で止まる
    s.eng.toTitle()
    s.router.onSnap(s.eng.getSnapshot(later), later)
    expect(s.meta).toEqual(['STOP_MUSIC'])
  })
  it('RESULT → TITLE で STOP_MUSIC', () => {
    const s = setup('EASY', { hp: 1 })
    s.begin(0)
    const res = COUNTIN_MS + s.eng.limitMs + GAMEOVER_EFFECT_STEPS_X.length * GAMEOVER_EFFECT_STEP_MS + 10
    s.observe(0, res, 10)
    s.meta.length = 0
    s.eng.toTitle()
    s.router.onSnap(s.eng.getSnapshot(res + 10), res + 10)
    expect(s.meta).toEqual(['STOP_MUSIC'])
  })
  it('onBegin: 選択難易度の1曲だけ preload し、STOP_MUSIC を呼ぶ。難易度を変えると preload が変わる', () => {
    const s = setup('HARD')
    s.begin(0)
    expect(s.meta).toEqual(['STOP_MUSIC', 'PRELOAD:result-hard'])
    const e = setup('EASY')
    e.begin(0)
    expect(e.meta).toEqual(['STOP_MUSIC', 'PRELOAD:result-easy'])
    const n = setup('NORMAL')
    n.begin(0)
    expect(n.meta).toEqual(['STOP_MUSIC', 'PRELOAD:result-normal'])
  })
})
