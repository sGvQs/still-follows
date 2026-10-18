import { describe, expect, it } from 'vitest'
import {
  APPROACH_BASE, APPROACH_MAX, APPROACH_MIN, APPROACH_PER_CHAR, COUNTIN_MS, GAMEOVER_EFFECT_STEPS_X, GAMEOVER_EFFECT_STEPS_Y,
  GAMEOVER_EFFECT_STEP_MS, GAP_MS, WARNING_MS, BUFF_SPEED, BOSS_GUARANTEE_WITHIN,
} from './config'
import { HIT_FLASH_MS, SURVIVE_MS } from './config'
import { approachSeconds, createEngine, stageAt } from './engine'
import { ENEMIES, indicesOf } from './faces'
import { bossPool } from './spawn'
import { compile, shortestLength, shortestSpelling } from './romaji'
import type { WordEntry } from './words'

const N = 6
const entry = (text: string, reading: string): WordEntry => ({ word: { text, reading }, compiled: compile(reading) })
const WORDS = [entry('虫', 'むし'), entry('画面', 'がめん'), entry('保存', 'ほぞん')]
const make = () => {
  let i = 0
  const eng = createEngine({ stageCount: N, playerHp: 1, bag: { next: () => WORDS[i++ % WORDS.length] } })
  return eng
}
const entryFromReading = (reading: string): WordEntry => ({ word: { text: '', reading }, compiled: compile(reading) })
const spell = (e: WordEntry) => shortestSpelling(e.compiled)
const toApproach = (eng: ReturnType<typeof make>, t = 0) => {
  eng.start(t)
  eng.tick(t + COUNTIN_MS)
  return t + COUNTIN_MS
}

describe('engine', () => {
  it('T は clamp 式で、stage は経過割合から決まる', () => {
    for (const e of WORDS) {
      const L = shortestLength(e.compiled)
      const T = Math.min(APPROACH_MAX, Math.max(APPROACH_MIN, APPROACH_BASE + L * APPROACH_PER_CHAR))
      expect(approachSeconds(L, 0)).toBeCloseTo(T)
    }
    expect(stageAt(0, 5, N)).toBe(0)
    expect(stageAt(2500, 5, N)).toBe(3)
    expect(stageAt(4999, 5, N)).toBe(5)
    expect(stageAt(9999, 5, N)).toBe(5)
  })
  it('TITLE -> COUNTIN -> APPROACH -> kill -> GAP -> 次の語', () => {
    const eng = make()
    expect(eng.getSnapshot(0).phase).toBe('TITLE')
    eng.start(0)
    expect(eng.getSnapshot(0).phase).toBe('COUNTIN')
    eng.handleKey(10, 'm')
    eng.tick(COUNTIN_MS)
    expect(eng.getSnapshot(COUNTIN_MS).phase).toBe('APPROACH')
    let t = COUNTIN_MS + 100
    for (const ch of spell(WORDS[0])) {
      expect(eng.handleKey(t, ch)).toMatch(/accept|kill/)
      t += 50
    }
    expect(eng.getSnapshot(t).phase).toBe('GAP')
    expect(eng.getSnapshot(t).kills).toBe(1)
    eng.handleKey(t + 10, 'g')
    eng.tick(t + GAP_MS)
    const s = eng.getSnapshot(t + GAP_MS)
    expect(s.phase).toBe('APPROACH')
    expect(s.word?.text).toBe('画面')
    expect(s.progress?.typed).toBe(0)
  })
  it('elapsed>=T で DYING、stage は被弾時点（最大）、T到達後の打鍵は撃破にならない', () => {
    const eng = make()
    const t0 = toApproach(eng)
    const T = eng.limitMs
    const last = spell(WORDS[0])
    eng.handleKey(t0 + 1, last[0])
    const r = eng.handleKey(t0 + T, last[1])
    expect(r).not.toBe('kill')
    const s = eng.getSnapshot(t0 + T)
    expect(s.phase).toBe('DYING')
    expect(s.stage).toBe(N - 1)
    expect(s.kills).toBe(0)
  })
  it('被弾で DYING になり結果が確定。効果は 2/3/4/5 と進み、境界で RESULT へ。入力は無視される', () => {
    const eng = make()
    const t0 = toApproach(eng)
    eng.handleKey(t0 + 1, spell(WORDS[0])[0])
    const go = t0 + eng.limitMs
    eng.tick(go)
    let s = eng.getSnapshot(go)
    expect(s.phase).toBe('DYING')
    expect(s.result).toEqual({ language: 'JA', difficulty: 'EASY', outcome: 'gameover', kills: 0, keystrokes: 1, mistakes: 0, kana: 0, netKana: 0, activeMs: 0 })
    expect(s.effectScaleX).toBe(GAMEOVER_EFFECT_STEPS_X[0])
    expect(s.effectScaleY).toBe(GAMEOVER_EFFECT_STEPS_Y[0])
    const D = GAMEOVER_EFFECT_STEP_MS
    GAMEOVER_EFFECT_STEPS_X.forEach((v, i) => {
      const w = GAMEOVER_EFFECT_STEPS_Y[i]
      expect(eng.getSnapshot(go + i * D).effectScaleX).toBe(v)
      expect(eng.getSnapshot(go + i * D).effectScaleY).toBe(w)
      expect(eng.getSnapshot(go + (i + 1) * D - 1).effectScaleX).toBe(v)
      expect(eng.getSnapshot(go + (i + 1) * D - 1).effectScaleY).toBe(w)
    })
    expect(eng.handleKey(go + 10, spell(WORDS[0])[1])).toBe('ignored')
    expect(eng.start(go + 11)).toBe(false)
    expect(eng.toTitle()).toBe(false)
    s = eng.getSnapshot(go + 12)
    expect(s).toMatchObject({ keystrokes: 1, kills: 0, stage: N - 1 })
    eng.tick(go + 4 * D - 1)
    expect(eng.getSnapshot(go + 4 * D - 1).phase).toBe('DYING')
    eng.tick(go + 4 * D)
    s = eng.getSnapshot(go + 4 * D)
    expect(s).toMatchObject({ phase: 'RESULT', effectScaleX: null, effectScaleY: null, stage: -1 })
    expect(s.result).toEqual({ language: 'JA', difficulty: 'EASY', outcome: 'gameover', kills: 0, keystrokes: 1, mistakes: 0, kana: 0, netKana: 0, activeMs: 0 })
    expect(eng.handleKey(go + 4 * D + 1, 'a')).toBe('ignored')
  })
  it('DYING 前に撃破した語があっても結果は被弾時点の撃破数・打鍵数のまま', () => {
    const eng = make()
    const t0 = toApproach(eng)
    for (const c of spell(WORDS[0])) eng.handleKey(t0 + 1, c)
    const t1 = t0 + 1 + GAP_MS
    eng.tick(t1)
    eng.tick(t1 + eng.limitMs + 1000)
    expect(eng.getSnapshot(t1 + eng.limitMs + 1000).result).toEqual({
      language: 'JA', difficulty: 'EASY', outcome: 'gameover', kills: 1, keystrokes: spell(WORDS[0]).length, mistakes: 0, kana: 2, netKana: 2, activeMs: 1,
    })
  })
  it('finish(clear) は clear の結果型で RESULT に遷移する', () => {
    const eng = make()
    const t0 = toApproach(eng)
    for (const c of spell(WORDS[0])) eng.handleKey(t0 + 1, c)
    eng.finish('clear', t0 + 1)
    const s = eng.getSnapshot(t0 + 2)
    expect(s.phase).toBe('RESULT')
    expect(s.result).toEqual({ language: 'JA', difficulty: 'EASY', outcome: 'clear', kills: 1, keystrokes: spell(WORDS[0]).length, mistakes: 0, kana: 2, netKana: 2, activeMs: 1 })
  })
  it('打鍵数は正しい打鍵のみ加算し、誤入力は数えず、開始でリセット', () => {
    const eng = make()
    const t0 = toApproach(eng)
    const w = spell(WORDS[0])
    expect(eng.handleKey(t0 + 1, 'q')).toBe('reject')
    expect(eng.getSnapshot(t0 + 1).keystrokes).toBe(0)
    eng.handleKey(t0 + 2, w[0])
    expect(eng.getSnapshot(t0 + 2).keystrokes).toBe(1)
    eng.tick(t0 + eng.limitMs + 10_000)
    expect(eng.toTitle()).toBe(true)
    expect(eng.getSnapshot(t0 + eng.limitMs + 10_000).keystrokes).toBe(0)
  })
  it('toTitle で撃破数・打鍵数・結果がリセットされ、TITLE から再開始できる', () => {
    const eng = make()
    const t0 = toApproach(eng)
    for (const c of spell(WORDS[0])) eng.handleKey(t0 + 1, c)
    eng.finish('clear', t0 + 2)
    expect(eng.toTitle()).toBe(true)
    const s = eng.getSnapshot(t0 + 5)
    expect(s).toMatchObject({ phase: 'TITLE', kills: 0, keystrokes: 0, result: null, word: null })
    expect(eng.toTitle()).toBe(false)
    expect(eng.start(t0 + 10)).toBe(true)
    expect(eng.getSnapshot(t0 + 10)).toMatchObject({ phase: 'COUNTIN', kills: 0, keystrokes: 0 })
  })
  it('被弾 -> RESULT -> toTitle -> 再プレイで演出・結果が残らない', () => {
    const eng = make()
    const t0 = toApproach(eng)
    eng.handleKey(t0 + 1, spell(WORDS[0])[0])
    const end = t0 + eng.limitMs + 4 * GAMEOVER_EFFECT_STEP_MS
    eng.tick(end)
    expect(eng.getSnapshot(end).phase).toBe('RESULT')
    expect(eng.toTitle()).toBe(true)
    expect(eng.start(end + 1)).toBe(true)
    const t1 = end + 1 + COUNTIN_MS
    eng.tick(t1)
    expect(eng.getSnapshot(t1)).toMatchObject({
      phase: 'APPROACH', kills: 0, keystrokes: 0, result: null, effectScaleX: null, stage: 0,
    })
  })
  it('IME 検知キーは無視され、状態は進まず時間も止まらない。clearComposing でフラグが戻る', () => {
    const eng = make()
    const t0 = toApproach(eng)
    const before = eng.getSnapshot(t0 + 10)
    expect(eng.handleKey(t0 + 10, 'm', true)).toBe('ignored')
    expect(eng.handleKey(t0 + 11, 'Process')).toBe('ignored')
    let s = eng.getSnapshot(t0 + 10)
    expect(s.phase).toBe('APPROACH')
    expect(s.composing).toBe(true)
    expect(s.keystrokes).toBe(before.keystrokes)
    expect(s.progress).toEqual(before.progress)
    eng.tick(t0 + eng.limitMs)
    expect(eng.getSnapshot(t0 + eng.limitMs).phase).toBe('DYING')
    eng.clearComposing()
    s = eng.getSnapshot(t0 + 10)
    expect(s.composing).toBe(false)
  })
  it('TITLE 中の文字キーは無視される', () => {
    const eng = make()
    expect(eng.handleKey(0, 'a')).toBe('ignored')
    expect(eng.getSnapshot(0).phase).toBe('TITLE')
  })
  it('COUNTIN/APPROACH 中の start は false', () => {
    const eng = make()
    eng.start(0)
    expect(eng.start(10)).toBe(false)
    eng.tick(COUNTIN_MS)
    expect(eng.start(COUNTIN_MS + 10)).toBe(false)
  })
  it('7段階でも stageAt は等分で 0..6 を返す', () => {
    expect(stageAt(0, 7, 7)).toBe(0)
    expect(stageAt(3500, 7, 7)).toBe(3)
    expect(stageAt(6999, 7, 7)).toBe(6)
  })
  it('敵は被弾時点のものが DYING 中維持され、撃破ごとに選び直され、toTitle で -1 に戻る', () => {
    const seq = [0, 1, 1]
    let j = 0
    const eng = createEngine({
      stageCount: N,
      playerHp: 1,
      bag: { next: () => WORDS[0] },
      enemyBag: { next: () => seq[j++ % seq.length] },
    })
    expect(eng.getSnapshot(0).enemy).toBe(-1)
    const t0 = toApproach(eng)
    expect(eng.getSnapshot(t0).enemy).toBe(0)
    const sp = spell(WORDS[0])
    for (const k of sp) eng.handleKey(t0 + 1, k)
    expect(eng.getSnapshot(t0 + 2).enemy).toBe(-1)
    const t1 = t0 + 1 + GAP_MS
    eng.tick(t1)
    expect(eng.getSnapshot(t1).enemy).toBe(1)
    const go = t1 + eng.limitMs
    eng.tick(go)
    expect(eng.getSnapshot(go).phase).toBe('DYING')
    expect(eng.getSnapshot(go).enemy).toBe(1)
    const end = go + GAMEOVER_EFFECT_STEPS_X.length * GAMEOVER_EFFECT_STEP_MS
    eng.tick(end)
    expect(eng.getSnapshot(end).enemy).toBe(-1)
    expect(eng.toTitle()).toBe(true)
    expect(eng.getSnapshot(end).enemy).toBe(-1)
  })
  it('同じ rng なら語と敵の並びが再現する', () => {
    const run = (seed: number) => {
      let x = seed
      const rng = () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296 }
      const eng = createEngine({ stageCount: N, playerHp: 1, rng })
      const out: number[] = []
      let t = 0
      eng.start(t)
      for (let i = 0; i < 6; i++) {
        t += COUNTIN_MS + 1
        eng.tick(t)
        const s = eng.getSnapshot(t)
        out.push(s.enemy)
        out.push(s.word?.text.length ?? -1)
        const w = s.word
        if (!w) break
        const e = entryFromReading(w.reading)
        for (const k of shortestSpelling(e.compiled)) eng.handleKey(t, k)
        t += GAP_MS
        eng.tick(t)
      }
      return out
    }
    expect(run(5)).toEqual(run(5))
  })
})

describe('HP と生存クリア', () => {
  const makeHp = (hp = 3) => {
    let i = 0
    return createEngine({ stageCount: N, playerHp: hp, bag: { next: () => WORDS[i++ % WORDS.length] } })
  }
  const approach = (eng: ReturnType<typeof makeHp>) => { eng.start(0); eng.tick(COUNTIN_MS); return COUNTIN_MS }

  it('HP3 は1・2回目の被弾で GAP から再開し、3回目で DYING -> RESULT gameover', () => {
    const eng = makeHp()
    let t = approach(eng)
    expect(eng.getSnapshot(t).hp).toBe(3)
    for (let hit = 1; hit <= 2; hit++) {
      t += eng.limitMs
      eng.tick(t)
      const s = eng.getSnapshot(t)
      expect(s.phase).toBe('GAP')
      expect(s.hp).toBe(3 - hit)
      expect(s.word).toBeNull()
      t += GAP_MS
      eng.tick(t)
      expect(eng.getSnapshot(t).phase).toBe('APPROACH')
      expect(eng.getSnapshot(t).progress?.typed).toBe(0)
    }
    t += eng.limitMs
    eng.tick(t)
    expect(eng.getSnapshot(t).phase).toBe('DYING')
    expect(eng.getSnapshot(t).flash).toBe(false)
    t += GAMEOVER_EFFECT_STEPS_X.length * GAMEOVER_EFFECT_STEP_MS
    eng.tick(t)
    const s = eng.getSnapshot(t)
    expect(s.phase).toBe('RESULT')
    expect(s.hp).toBe(0)
    expect(s.result?.outcome).toBe('gameover')
  })

  it('60秒到達で APPROACH 中でも clear（DYING を通らず、word/敵が残らない）', () => {
    const eng = makeHp(99)
    const t0 = approach(eng)
    eng.tick(t0 + SURVIVE_MS - 1)
    expect(eng.getSnapshot(t0 + SURVIVE_MS - 1).phase).not.toBe('RESULT')
    eng.tick(t0 + SURVIVE_MS)
    const s = eng.getSnapshot(t0 + SURVIVE_MS)
    expect(s.phase).toBe('RESULT')
    expect(s.result).toEqual({ language: 'JA', difficulty: 'EASY', outcome: 'clear', kills: 0, keystrokes: 0, mistakes: 0, kana: 0, netKana: 0, activeMs: expect.any(Number) })
    expect(s.result?.activeMs).toBe(0) // 撃破なし。進行中の語の時間は含めない
    expect(s.word).toBeNull()
    expect(s.enemy).toBe(-1)
    expect(eng.limitMs).toBe(0)
  })

  it('60秒到達は GAP 中でも clear、撃破数・打鍵数が結果に入る', () => {
    const eng = makeHp(99)
    const t0 = approach(eng)
    const sp = spell(WORDS[0])
    // 先頭の語は limitMs 内に打てる位置に進めてから、clear 直前の GAP で止める
    let t = t0 + 10
    for (const ch of sp) { eng.handleKey(t, ch); t += 1 }
    expect(eng.getSnapshot(t).kills).toBe(1)
    eng.tick(t0 + SURVIVE_MS)
    const s = eng.getSnapshot(t0 + SURVIVE_MS)
    expect(s.result?.outcome).toBe('clear')
    expect(s.result?.kills).toBe(1)
    expect(s.result?.keystrokes).toBe(sp.length)
  })

  it('被弾が60秒より後なら clear、同時刻も clear、70秒先の一括 tick でも clear', () => {
    const mk = (surviveMs: number) => {
      let i = 0
      return createEngine({ stageCount: N, playerHp: 1, surviveMs, bag: { next: () => WORDS[i++ % WORDS.length] } })
    }
    const limit = approachSeconds(shortestLength(WORDS[0].compiled), 0) * 1000
    const a = mk(limit + 1) // 被弾(limit)より1ms遅い clear は、tick が先まで進んでいても被弾が先
    a.start(0); a.tick(COUNTIN_MS + limit + 10)
    expect(a.getSnapshot(COUNTIN_MS + limit + 10).result?.outcome).toBe('gameover')
    const c = mk(limit) // 同時刻は clear 優先
    c.start(0); c.tick(COUNTIN_MS + limit)
    expect(c.getSnapshot(COUNTIN_MS + limit).result?.outcome).toBe('clear')
    const d = mk(limit - 1) // 60秒が先なら clear
    d.start(0); d.tick(COUNTIN_MS + limit + 10)
    expect(d.getSnapshot(COUNTIN_MS + limit + 10).result?.outcome).toBe('clear')

    const b = makeHp(1)
    const tb = approach(b)
    b.tick(tb + 70000)
    expect(b.getSnapshot(tb + 70000).phase).toBe('RESULT')
    expect(b.getSnapshot(tb + 70000).result?.outcome).toBe('gameover') // HP1 は先に被弾する
  })

  it('HP1 でも途中の被弾が先なら gameover（60秒より前）', () => {
    const eng = makeHp(1)
    const t0 = approach(eng)
    eng.tick(t0 + eng.limitMs)
    expect(eng.getSnapshot(t0 + eng.limitMs).phase).toBe('DYING')
  })

  it('COUNTIN は60秒に含まれない', () => {
    const eng = makeHp(99)
    eng.start(0)
    eng.tick(SURVIVE_MS)
    expect(eng.getSnapshot(SURVIVE_MS).phase).not.toBe('RESULT')
    eng.tick(COUNTIN_MS + SURVIVE_MS)
    expect(eng.getSnapshot(COUNTIN_MS + SURVIVE_MS).result?.outcome).toBe('clear')
  })

  it('toTitle 後の再プレイで hp と60秒がリセットされる', () => {
    const eng = makeHp(99)
    const t0 = approach(eng)
    eng.tick(t0 + SURVIVE_MS)
    expect(eng.toTitle()).toBe(true)
    expect(eng.getSnapshot(0).hp).toBe(99)
    const base = t0 + SURVIVE_MS + 1000
    eng.start(base)
    eng.tick(base + COUNTIN_MS + SURVIVE_MS - 1)
    expect(eng.getSnapshot(base + COUNTIN_MS + SURVIVE_MS - 1).phase).not.toBe('RESULT')
    eng.tick(base + COUNTIN_MS + SURVIVE_MS)
    expect(eng.getSnapshot(base + COUNTIN_MS + SURVIVE_MS).result?.outcome).toBe('clear')
  })

  it('被弾フラッシュは HIT_FLASH_MS だけ ON になり、ON/OFF で revision が変わる', () => {
    const eng = makeHp()
    const t0 = approach(eng)
    const hit = t0 + eng.limitMs
    eng.tick(hit)
    const on = eng.getSnapshot(hit)
    expect(on.flash).toBe(true)
    eng.tick(hit + HIT_FLASH_MS)
    const off = eng.getSnapshot(hit + HIT_FLASH_MS)
    expect(off.flash).toBe(false)
    expect(off.revision).toBeGreaterThan(on.revision)
  })
  it('誤入力・かな数・活動時間の集計と、リセット', () => {
    const eng = createEngine({ stageCount: N, playerHp: 9, bag: { next: () => WORDS[0] } })
    eng.start(0)
    expect(eng.handleKey(10, 'q')).toBe('ignored') // COUNTIN 中は数えない
    eng.tick(COUNTIN_MS)
    expect(eng.handleKey(COUNTIN_MS + 1, 'q')).toBe('reject')
    eng.handleKey(COUNTIN_MS + 2, 'Process', true) // IME は数えない
    for (const c of spell(WORDS[0])) eng.handleKey(COUNTIN_MS + 100, c)
    expect(eng.handleKey(COUNTIN_MS + 150, 'q')).toBe('ignored') // GAP 中は数えない
    eng.finish('clear', COUNTIN_MS + 200)
    expect(eng.getSnapshot(COUNTIN_MS + 200).result).toEqual({
      language: 'JA', difficulty: 'EASY', outcome: 'clear', kills: 1, keystrokes: spell(WORDS[0]).length, mistakes: 1, kana: 2, netKana: 1, activeMs: 100,
    })
    expect(eng.handleKey(COUNTIN_MS + 300, 'q')).toBe('ignored') // RESULT 中は数えない
    expect(eng.toTitle()).toBe(true)
    eng.start(1000)
    eng.finish('gameover', 1000)
    expect(eng.getSnapshot(1000).result).toMatchObject({ mistakes: 0, kana: 0, netKana: 0, activeMs: 0 })
  })
  it('時間切れの語・進行中の語の APPROACH 時間は activeMs に含めない', () => {
    const eng = createEngine({ stageCount: N, playerHp: 2, bag: { next: () => WORDS[0] } })
    const t0 = toApproach(eng)
    const L = eng.limitMs
    eng.tick(t0 + L)
    expect(eng.getSnapshot(t0 + L).phase).toBe('GAP')
    const t1 = t0 + L + GAP_MS
    eng.tick(t1)
    eng.finish('clear', t1 + 500)
    expect(eng.getSnapshot(t1 + 500).result).toMatchObject({ kana: 0, netKana: 0, activeMs: 0 })
  })
  describe('純かな数', () => {
    const run = (words: WordEntry[], playerHp = 9) => {
      let i = 0
      return createEngine({ stageCount: N, playerHp, bag: { next: () => words[i++ % words.length] } })
    }
    const wrong = (eng: ReturnType<typeof run>, t: number, k: number) => { for (let j = 0; j < k; j++) eng.handleKey(t, 'q') }
    const kill = (eng: ReturnType<typeof run>, t: number, e: WordEntry) => { for (const c of spell(e)) eng.handleKey(t, c) }
    it('誤入力0なら純かな = kana', () => {
      const eng = run([WORDS[0]])
      const t0 = toApproach(eng)
      kill(eng, t0 + 1, WORDS[0])
      eng.finish('clear', t0 + 2)
      expect(eng.getSnapshot(t0 + 2).result).toMatchObject({ kana: 2, netKana: 2 })
    })
    it('語内の誤入力数だけ引かれ、かな数を超えても0未満にならない', () => {
      const eng = run([WORDS[1], WORDS[0]])
      const t0 = toApproach(eng)
      wrong(eng, t0 + 1, 3)
      kill(eng, t0 + 2, WORDS[1]) // 3かな − 3 = 0
      const t1 = t0 + 2 + GAP_MS
      eng.tick(t1)
      wrong(eng, t1 + 1, 5)
      kill(eng, t1 + 2, WORDS[0]) // 2かな − 5 → 0
      eng.finish('clear', t1 + 3)
      expect(eng.getSnapshot(t1 + 3).result).toMatchObject({ kana: 5, netKana: 0, mistakes: 8 })
    })
    it('撃破できなかった語の誤入力は純かなに入らず mistakes には入り、被弾後の GAP を挟んでリセットされる', () => {
      const eng = run([WORDS[0], WORDS[1]], 3)
      const t0 = toApproach(eng)
      wrong(eng, t0 + 1, 4)
      eng.tick(t0 + eng.limitMs) // 被弾
      const t1 = t0 + eng.limitMs + GAP_MS
      eng.tick(t1)
      kill(eng, t1 + 1, WORDS[1]) // 誤入力0 → 3かな
      eng.finish('clear', t1 + 2)
      expect(eng.getSnapshot(t1 + 2).result).toMatchObject({ kana: 3, netKana: 3, mistakes: 4 })
    })
    it('進行中の語の誤入力は clear で純かなに入らない', () => {
      const eng = run([WORDS[0]])
      const t0 = toApproach(eng)
      wrong(eng, t0 + 1, 2)
      eng.finish('clear', t0 + 2)
      expect(eng.getSnapshot(t0 + 2).result).toMatchObject({ kana: 0, netKana: 0, mistakes: 2 })
    })
    it('toTitle 後はリセットされる', () => {
      const eng = run([WORDS[0]])
      const t0 = toApproach(eng)
      wrong(eng, t0 + 1, 1)
      kill(eng, t0 + 2, WORDS[0])
      eng.finish('clear', t0 + 3)
      eng.toTitle()
      const t1 = toApproach(eng, 10000)
      kill(eng, t1 + 1, WORDS[0])
      eng.finish('clear', t1 + 2)
      expect(eng.getSnapshot(t1 + 2).result).toMatchObject({ kana: 2, netKana: 2, mistakes: 0 })
    })
  })

  describe('難易度', () => {
    const bagOf = (w: WordEntry) => ({ next: () => w })
    const A = entry('猫', 'ねこ')
    const B = entry('犬', 'いぬ')
    const C = entry('鳥', 'とり')
    const makeBags = () => createEngine({ stageCount: N, playerHp: 1, bags: { EASY: bagOf(A), NORMAL: bagOf(B), HARD: bagOf(C) } })
    const wordAt = (eng: ReturnType<typeof makeBags>, lead = COUNTIN_MS) => { eng.tick(lead); return eng.getSnapshot(lead).word?.reading }

    it('既定は EASY で、snapshot と result に難易度が載る', () => {
      const eng = makeBags()
      expect(eng.getSnapshot(0).difficulty).toBe('EASY')
      expect(eng.start(0, 'HARD')).toBe(true)
      expect(eng.getSnapshot(0).difficulty).toBe('HARD')
      eng.tick(COUNTIN_MS + 100000)
      expect(eng.getSnapshot(COUNTIN_MS + 100000).result?.difficulty).toBe('HARD')
    })
    it('start の難易度で bag が切り替わる', () => {
      for (const [d, r] of [['EASY', 'ねこ'], ['NORMAL', 'いぬ'], ['HARD', 'とり']] as const) {
        const eng = makeBags()
        eng.start(0, d)
        expect(wordAt(eng, d === 'HARD' ? WARNING_MS : COUNTIN_MS)).toBe(r)
      }
    })
    it('難易度省略時は直前の選択（初期は EASY）で始まる', () => {
      const eng = makeBags()
      eng.start(0)
      expect(wordAt(eng)).toBe('ねこ')
    })
    it('toTitle 後も選択が残り、TITLE 中の snapshot に出る', () => {
      const eng = makeBags()
      eng.start(0, 'NORMAL')
      eng.tick(COUNTIN_MS + 100000)
      expect(eng.toTitle()).toBe(true)
      const s = eng.getSnapshot(COUNTIN_MS + 100001)
      expect(s.phase).toBe('TITLE')
      expect(s.difficulty).toBe('NORMAL')
      eng.start(COUNTIN_MS + 100002)
      expect(eng.getSnapshot(COUNTIN_MS + 100002).difficulty).toBe('NORMAL')
    })
    it('start が失敗したときは更新しない', () => {
      const eng = makeBags()
      eng.start(0, 'NORMAL')
      expect(eng.start(10, 'HARD')).toBe(false)
      expect(eng.getSnapshot(10).difficulty).toBe('NORMAL')
    })
    it('難易度が変わる start で revision が進む', () => {
      const eng = makeBags()
      const r0 = eng.getSnapshot(0).revision
      eng.start(0, 'HARD')
      expect(eng.getSnapshot(0).revision).toBeGreaterThan(r0)
    })
  })
})

describe('HARD WARNING', () => {
  const longWord = entry('長い語', 'ながいことば')
  const makeBoss = (opts: { boss?: number; enemies?: number[]; hp?: number; words?: WordEntry[] } = {}) => {
    const seq = opts.enemies ?? [0, 1, 2, 3]
    const words = opts.words ?? WORDS
    let i = 0
    let j = 0
    return createEngine({
      stageCount: N, playerHp: opts.hp ?? 3,
      bag: { next: () => words[i++ % words.length] },
      enemyBag: { next: () => seq[j++ % seq.length] },
      pickBoss: () => opts.boss ?? 2,
    })
  }
  const word = (e: WordEntry) => e.compiled.reading

  it('EASY / NORMAL は WARNING にならず、boss は -1', () => {
    for (const d of ['EASY', 'NORMAL'] as const) {
      const eng = makeBoss()
      eng.start(0, d)
      expect(eng.getSnapshot(0)).toMatchObject({ phase: 'COUNTIN', boss: -1, buffed: false })
    }
  })
  it('HARD の開始は WARNING で、ボスの最大像・word null・TIME 満タン', () => {
    const eng = makeBoss({ boss: 3 })
    expect(eng.getSnapshot(0).boss).toBe(-1)
    eng.start(0, 'HARD')
    const s = eng.getSnapshot(10)
    expect(s).toMatchObject({ phase: 'WARNING', boss: 3, enemy: 3, stage: N - 1, word: null, progress: null, remainingSec: 60, hp: 3, buffed: false })
  })
  it('WARNING 中のキーは ignored で数えず、WARNING_MS で APPROACH になる', () => {
    const eng = makeBoss()
    eng.start(0, 'HARD')
    expect(eng.handleKey(100, 'q')).toBe('ignored')
    expect(eng.handleKey(200, 'm')).toBe('ignored')
    eng.tick(WARNING_MS - 1)
    expect(eng.getSnapshot(WARNING_MS - 1).phase).toBe('WARNING')
    eng.tick(WARNING_MS)
    const s = eng.getSnapshot(WARNING_MS)
    expect(s.phase).toBe('APPROACH')
    expect(s.keystrokes).toBe(0)
    eng.finish('clear', WARNING_MS)
    expect(eng.getSnapshot(WARNING_MS).result).toMatchObject({ keystrokes: 0, mistakes: 0 })
  })
  it('60秒は WARNING の後から数える', () => {
    // 最大接近時間の語を使い、6体目（保証で強制されるボス種）が60秒より後に来るようにする
    const eng = makeBoss({ hp: 100, boss: 1, enemies: [0], words: [entry('長い', 'あ'.repeat(40))] })
    eng.start(0, 'HARD')
    eng.tick(WARNING_MS + SURVIVE_MS - 1)
    expect(eng.getSnapshot(WARNING_MS + SURVIVE_MS - 1).result).toBeNull()
    eng.tick(WARNING_MS + SURVIVE_MS)
    expect(eng.getSnapshot(WARNING_MS + SURVIVE_MS).result?.outcome).toBe('clear')
    const e2 = makeBoss({ hp: 100, boss: 1, enemies: [0], words: [entry('長い', 'あ'.repeat(40))] })
    e2.start(0, 'HARD')
    e2.tick(SURVIVE_MS)
    expect(e2.getSnapshot(SURVIVE_MS).result).toBeNull()
  })
  it('ボス種の敵の接近時間は通常の 1/BUFF_SPEED（MIN 先 clamp）', () => {
    const L = shortestLength(longWord.compiled)
    const base = approachSeconds(L, 0)
    expect(approachSeconds(L, 0, undefined, BUFF_SPEED)).toBeCloseTo(base / BUFF_SPEED)
    const short = shortestLength(compile('あ'))
    expect(approachSeconds(short, 0, undefined, BUFF_SPEED)).toBeCloseTo(APPROACH_MIN / BUFF_SPEED)
    const boss = makeBoss({ boss: 0, enemies: [0], words: [longWord] })
    boss.start(0, 'HARD')
    boss.tick(WARNING_MS)
    expect(boss.limitMs).toBeCloseTo((base / BUFF_SPEED) * 1000)
    const normal = makeBoss({ boss: 1, enemies: [0], words: [longWord] })
    normal.start(0, 'HARD')
    expect(normal.limitMs).toBeCloseTo(base * 1000)
  })
  it('最初の1体がボス種とは限らない（異なる／同じ両方）', () => {
    const a = makeBoss({ boss: 2, enemies: [0, 2] })
    a.start(0, 'HARD'); a.tick(WARNING_MS)
    expect(a.getSnapshot(WARNING_MS)).toMatchObject({ enemy: 0, buffed: false })
    const b = makeBoss({ boss: 2, enemies: [2, 0] })
    b.start(0, 'HARD'); b.tick(WARNING_MS)
    expect(b.getSnapshot(WARNING_MS)).toMatchObject({ enemy: 2, buffed: true })
  })
  it('ボスの敵は HP3 でも時間切れで即ゲームオーバー（フラッシュなし）、非ボスは通常の被弾', () => {
    const boss = makeBoss({ boss: 0, enemies: [0] })
    boss.start(0, 'HARD'); boss.tick(WARNING_MS)
    const t = WARNING_MS + boss.limitMs
    boss.tick(t)
    expect(boss.getSnapshot(t)).toMatchObject({ phase: 'DYING', hp: 0, flash: false, buffed: true })
    boss.tick(t + 10000)
    expect(boss.getSnapshot(t + 10000).result?.outcome).toBe('gameover')
    const non = makeBoss({ boss: 1, enemies: [0] })
    non.start(0, 'HARD'); non.tick(WARNING_MS)
    const t2 = WARNING_MS + non.limitMs
    non.tick(t2)
    expect(non.getSnapshot(t2)).toMatchObject({ phase: 'GAP', hp: 2, buffed: false })
  })
  it('ボスの撃破は通常と同じ扱い', () => {
    const eng = makeBoss({ boss: 0, enemies: [0] })
    eng.start(0, 'HARD'); eng.tick(WARNING_MS)
    for (const c of shortestSpelling(WORDS[0].compiled)) eng.handleKey(WARNING_MS + 100, c)
    expect(eng.getSnapshot(WARNING_MS + 100)).toMatchObject({ phase: 'GAP', kills: 1, hp: 3, buffed: false })
    expect(word(WORDS[0])).toBe('むし')
  })
  it('toTitle で boss は -1、再 start で再抽選される', () => {
    let k = 0
    const picks = [1, 3]
    const eng = createEngine({ stageCount: N, playerHp: 1, bag: { next: () => WORDS[0] }, pickBoss: () => picks[k++] })
    eng.start(0, 'HARD')
    expect(eng.getSnapshot(0).boss).toBe(1)
    eng.finish('clear', 10)
    expect(eng.toTitle()).toBe(true)
    expect(eng.getSnapshot(11).boss).toBe(-1)
    eng.start(12, 'HARD')
    expect(eng.getSnapshot(12).boss).toBe(3)
  })
  it('既定の pickBoss は rng から bossPool（horror の index 群）の1つを選ぶ', () => {
    const eng = createEngine({ stageCount: N, bag: { next: () => WORDS[0] }, rng: () => 0.8 })
    eng.start(0, 'HARD')
    expect(eng.getSnapshot(0).boss).toBe(bossPool(ENEMIES)[Math.floor(0.8 * bossPool(ENEMIES).length)])
    expect(eng.getSnapshot(0).boss).toBe(4)
  })
})

describe('HARD のボス保証', () => {
  // 各語を打ち切って撃破し、最初の total 体の敵を順に集める（enemy は WARNING 後の APPROACH で見える）
  const firstEnemies = (difficulty: 'EASY' | 'NORMAL' | 'HARD', rng: () => number, boss: number, total: number): { enemies: number[]; draws: number } => {
    let draws = 0
    const counted = () => { draws += 1; return rng() }
    const eng = createEngine({ stageCount: N, playerHp: 3, bag: { next: () => WORDS[0] }, rng: counted, pickBoss: () => boss })
    const lead = difficulty === 'HARD' ? WARNING_MS : COUNTIN_MS
    eng.start(0, difficulty)
    eng.tick(lead)
    const enemies: number[] = []
    let t = lead
    for (let k = 0; k < total; k++) {
      enemies.push(eng.getSnapshot(t).enemy)
      for (const c of shortestSpelling(WORDS[0].compiled)) eng.handleKey(t + 1, c)
      t += GAP_MS + 10
      eng.tick(t)
    }
    return { enemies, draws }
  }
  const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }

  it('保証の数は config の定数 6', () => {
    expect(BOSS_GUARANTEE_WITHIN).toBe(6)
  })
  it('HARD は、全ボス種・多数の rng で、最初の6体にボス種が1回以上含まれる', () => {
    let violations = 0
    for (let boss = 0; boss < 6; boss++) {
      for (let seed = 1; seed <= 300; seed++) {
        const { enemies } = firstEnemies('HARD', seeded(seed), boss, BOSS_GUARANTEE_WITHIN)
        if (!enemies.includes(boss)) violations += 1
      }
    }
    expect(violations).toBe(0)
  })
  it('保証の有無で HARD の敵列と rng 消費回数が変わらない（boss=-1 と boss 指定で同じ列）', () => {
    let guaranteedDiffers = 0
    for (let seed = 1; seed <= 300; seed++) {
      const without = firstEnemies('HARD', seeded(seed), -1, BOSS_GUARANTEE_WITHIN)
      const withBoss = firstEnemies('HARD', seeded(seed), 0, BOSS_GUARANTEE_WITHIN)
      // 保証は6体目だけを置き換える。最初の5体と rng 消費回数（pickBoss は rng を使わない注入なので差は bag の消費のみ）は同じ
      expect(withBoss.enemies.slice(0, BOSS_GUARANTEE_WITHIN - 1)).toEqual(without.enemies.slice(0, BOSS_GUARANTEE_WITHIN - 1))
      expect(withBoss.draws).toBe(without.draws)
      if (withBoss.enemies.join() !== without.enemies.join()) guaranteedDiffers += 1
    }
    expect(guaranteedDiffers).toBeGreaterThan(0)
  })
  it('EASY の既定バッグは cute のみで、ボス種（horror）を含まない', () => {
    const horror = new Set(indicesOf('horror'))
    for (let seed = 1; seed <= 100; seed++) {
      const { enemies } = firstEnemies('EASY', seeded(seed), -1, 12)
      expect(enemies.some((e) => horror.has(e))).toBe(false)
    }
  })
  it('既定バッグ+実際の bossPool で、ボスは必ず horror の範囲に入り、保証がなければ違反するケースが存在する', () => {
    const horror = new Set(indicesOf('horror'))
    let wouldViolate = 0
    for (let seed = 1; seed <= 300; seed++) {
      const eng = createEngine({ stageCount: N, playerHp: 3, bag: { next: () => WORDS[0] }, rng: seeded(seed) })
      eng.start(0, 'HARD')
      const boss = eng.getSnapshot(0).boss
      expect(horror.has(boss)).toBe(true)
      eng.tick(WARNING_MS)
      const enemies: number[] = []
      let t = WARNING_MS
      for (let k = 0; k < BOSS_GUARANTEE_WITHIN; k++) {
        enemies.push(eng.getSnapshot(t).enemy)
        for (const c of shortestSpelling(WORDS[0].compiled)) eng.handleKey(t + 1, c)
        t += GAP_MS + 10
        eng.tick(t)
      }
      expect(enemies).toContain(boss)
      // 保証がなければ違反: 同じ rng の素のバッグ列（rng 消費順が同じ pickBoss 後の状態）を直接数えるため、boss=-1 の列を使う
      const raw = firstEnemies('HARD', seeded(seed), -1, BOSS_GUARANTEE_WITHIN).enemies
      if (!raw.includes(boss)) wouldViolate += 1
    }
    expect(wouldViolate).toBeGreaterThan(0)
  })
  it('enemyBag（共通）> enemyBags（難易度別）> 既定 の優先順位', () => {
    const mk = (n: number) => ({ next: () => n })
    const first = (eng: ReturnType<typeof createEngine>, d: 'EASY' | 'NORMAL' | 'HARD') => {
      eng.start(0, d)
      eng.tick(d === 'HARD' ? WARNING_MS : COUNTIN_MS)
      return eng.getSnapshot(d === 'HARD' ? WARNING_MS : COUNTIN_MS).enemy
    }
    const base = { stageCount: N, bag: { next: () => WORDS[0] }, pickBoss: () => 0 }
    const enemyBags = { EASY: mk(7), NORMAL: mk(8), HARD: mk(9) }
    for (const d of ['EASY', 'NORMAL', 'HARD'] as const) {
      expect(first(createEngine({ ...base, enemyBag: mk(11), enemyBags }), d)).toBe(11)
      expect(first(createEngine({ ...base, enemyBags }), d)).toBe({ EASY: 7, NORMAL: 8, HARD: 9 }[d])
    }
    // 既定: EASY は cute のみ
    expect(indicesOf('cute')).toContain(first(createEngine(base), 'EASY'))
  })
  it('注入した enemyBag にも保証が効き、7体目以降は enemyBag のまま', () => {
    const seq = [0, 1, 2, 3, 4, 5, 0, 1, 2]
    let j = 0
    const eng = createEngine({ stageCount: N, bag: { next: () => WORDS[0] }, enemyBag: { next: () => seq[j++] }, pickBoss: () => 12 })
    eng.start(0, 'HARD')
    eng.tick(WARNING_MS)
    const got: number[] = []
    let t = WARNING_MS
    for (let k = 0; k < 8; k++) {
      got.push(eng.getSnapshot(t).enemy)
      for (const c of shortestSpelling(WORDS[0].compiled)) eng.handleKey(t + 1, c)
      t += GAP_MS + 10
      eng.tick(t)
    }
    expect(got).toEqual([0, 1, 2, 3, 4, 12, 0, 1])
  })
})

describe('enemyId（敵の通し番号）', () => {
  // 同じ種類の敵が連続する列を注入する（enemy が同じでも enemyId は変わる）
  const makeSame = (playerHp = 3, surviveMs?: number) =>
    createEngine({ stageCount: N, playerHp, surviveMs, bag: { next: () => WORDS[0] }, enemyBag: { next: () => 2 } })
  const killNow = (eng: ReturnType<typeof makeSame>, t: number) => { for (const c of spell(WORDS[0])) eng.handleKey(t, c) }

  it('TITLE では 0、begin 後は COUNTIN 中から 1', () => {
    const eng = makeSame()
    expect(eng.getSnapshot(0).enemyId).toBe(0)
    eng.start(0)
    expect(eng.getSnapshot(0).phase).toBe('COUNTIN')
    expect(eng.getSnapshot(0).enemyId).toBe(1)
    expect(eng.getSnapshot(0).stage).toBe(-1)
  })
  it('撃破して次の敵が出ると +1（enemy が同じでも変わる）。GAP 中は直前の値を保持する', () => {
    const eng = makeSame()
    const t0 = toApproach(eng)
    killNow(eng, t0 + 1)
    const gap = eng.getSnapshot(t0 + 2)
    expect(gap.phase).toBe('GAP')
    expect(gap.enemy).toBe(-1)
    expect(gap.enemyId).toBe(1)
    eng.tick(t0 + 1 + GAP_MS)
    const s = eng.getSnapshot(t0 + 1 + GAP_MS)
    expect(s.phase).toBe('APPROACH')
    expect(s.enemy).toBe(2)
    expect(s.enemyId).toBe(2)
  })
  it('時間切れで hp>0 の被弾後も、次の敵で +1', () => {
    const eng = makeSame(3)
    const t0 = toApproach(eng)
    const hit = t0 + eng.limitMs
    eng.tick(hit)
    expect(eng.getSnapshot(hit).phase).toBe('GAP')
    expect(eng.getSnapshot(hit).enemyId).toBe(1)
    eng.tick(hit + GAP_MS)
    expect(eng.getSnapshot(hit + GAP_MS).phase).toBe('APPROACH')
    expect(eng.getSnapshot(hit + GAP_MS).enemyId).toBe(2)
  })
  it('toTitle で 0 に戻り、再 start で 1 から数え直す', () => {
    const eng = makeSame(1)
    const t0 = toApproach(eng)
    killNow(eng, t0 + 1)
    eng.tick(t0 + 1 + GAP_MS)
    expect(eng.getSnapshot(t0 + 1 + GAP_MS).enemyId).toBe(2)
    const go = t0 + 1 + GAP_MS + eng.limitMs
    eng.tick(go + GAMEOVER_EFFECT_STEPS_X.length * GAMEOVER_EFFECT_STEP_MS)
    expect(eng.getSnapshot(go + 1000).phase).toBe('RESULT')
    expect(eng.getSnapshot(go + 1000).enemyId).toBe(2) // 終了後は保持
    expect(eng.toTitle()).toBe(true)
    expect(eng.getSnapshot(go + 1000).enemyId).toBe(0)
    eng.start(go + 2000)
    expect(eng.getSnapshot(go + 2000).enemyId).toBe(1)
  })
  it('gameover・clear の終了では増えない', () => {
    const over = makeSame(1)
    const t0 = toApproach(over)
    const go = t0 + over.limitMs
    over.tick(go)
    expect(over.getSnapshot(go).phase).toBe('DYING')
    expect(over.getSnapshot(go).enemyId).toBe(1)

    const clear = makeSame(3, 1000)
    const c0 = toApproach(clear)
    clear.tick(c0 + 1000)
    expect(clear.getSnapshot(c0 + 1000).phase).toBe('RESULT')
    expect(clear.getSnapshot(c0 + 1000).enemyId).toBe(1)
  })
  it('stage は COUNTIN で -1、APPROACH 内では 0 始まりで単調増加（同じ enemyId のまま）', () => {
    const eng = makeSame()
    eng.start(0)
    expect(eng.getSnapshot(0).stage).toBe(-1)
    const t0 = COUNTIN_MS
    eng.tick(t0)
    let prev = -1
    for (let t = t0; t < t0 + eng.limitMs; t += 50) {
      const s = eng.getSnapshot(t)
      expect(s.phase).toBe('APPROACH')
      expect(s.enemyId).toBe(1)
      if (t === t0) expect(s.stage).toBe(0)
      expect(s.stage).toBeGreaterThanOrEqual(prev)
      prev = s.stage
    }
    expect(prev).toBe(N - 1)
  })
})
