// @ts-ignore tsconfig に node 型が無い（vitest 実行時のみ使う）
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Difficulty } from '../game/difficulty'
import { createEngine } from '../game/engine'
import { compile, shortestSpelling } from '../game/romaji'
import type { WordEntry } from '../game/words'
import { createWebAudioBackend } from './player'
import { createSoundRouter } from './router'

// 実経路の結合テスト: engine → useGame と同じ呼び出し順（begin / tick→getSnapshot→onSnap / handleKey→onKey→onSnap）→ router → 実 player（Fake AudioContext）
// 個別テストは router を FakePlayer で、player を router なしで検証していたため、両者の接続（曲名・preload・want の寿命）は見ていなかった
class P { value = 1; cancelScheduledValues() {} setValueAtTime(v: number) { this.value = v } linearRampToValueAtTime(v: number) { this.value = v } }
class Node { gain = new P(); connect() {} disconnect() {} }
class Src extends Node { buffer: { tag: string } | null = null; onended: (() => void) | null = null; started = 0; stopped = false; start() { this.started++ } stop() { this.stopped = true; this.onended?.() } }
class Ctx {
  state: 'running' | 'suspended' = 'running'
  currentTime = 0
  destination = new Node()
  sources: Src[] = []
  listeners: (() => void)[] = []
  tagOf = new Map<ArrayBuffer, string>()
  createGain() { return new Node() }
  createBufferSource() { const s = new Src(); this.sources.push(s); return s }
  decodeAudioData(d: ArrayBuffer, ok: (b: { tag: string }) => void) { ok({ tag: this.tagOf.get(d) ?? '?' }) }
  addEventListener(_t: string, l: () => void) { this.listeners.push(l) }
  removeEventListener() {}
  allowed = true // false の間は resume() が効かない（ユーザー操作前の自動再生制限）
  resume() { if (this.allowed) this.grant(); return Promise.resolve() }
  grant() { this.allowed = true; this.state = 'running'; this.listeners.forEach((l) => l()) }
  close() { return Promise.resolve() }
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

const WORD: WordEntry = { word: { text: '虫', reading: 'むし' }, compiled: compile('むし') }
const SPELL = shortestSpelling(WORD.compiled)

const setup = (difficulty: Difficulty, ctxState: 'running' | 'suspended' = 'running', surviveMs?: number) => {
  const ctx = new Ctx()
  ctx.state = ctxState
  ctx.allowed = ctxState === 'running'
  const fetched: string[] = []
  vi.stubGlobal('fetch', (u: string) => {
    fetched.push(u)
    const buf = new ArrayBuffer(8)
    ctx.tagOf.set(buf, u)
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(buf) })
  })
  const be = createWebAudioBackend(ctx as unknown as AudioContext)
  const router = createSoundRouter(be)
  const eng = createEngine({ stageCount: 6, playerHp: 1, bag: { next: () => WORD }, enemyBag: { next: () => 1 }, pickBoss: () => 0, surviveMs })
  // useGame の begin / loop / onKeyDown と同じ順序
  const begin = (t: number) => { eng.start(t, difficulty); router.onBegin(eng.getSnapshot(t), t) }
  const frame = (t: number) => { eng.tick(t); router.onSnap(eng.getSnapshot(t), t) }
  const key = (t: number, k: string) => { router.onKey(eng.handleKey(t, k, false)); router.onSnap(eng.getSnapshot(t), t) }
  const run = (from: number, to: number, until: () => boolean) => { let t = from; for (; t <= to && !until(); t += 16) frame(t); return t }
  const music = () => ctx.sources.filter((s) => s.started > 0 && /result-/.test(s.buffer?.tag ?? ''))
  return { ctx, fetched, be, eng, begin, frame, key, run, music }
}

afterEach(() => { vi.unstubAllGlobals() })

describe('リザルト曲の結合（engine → router → player）', () => {
  for (const d of ['EASY', 'NORMAL', 'HARD'] as const) {
    const name = `result-${d.toLowerCase()}`
    it(`${d}: 被弾（DYING → RESULT）で難易度の曲が1本だけ鳴り、他難易度の曲は取得されない`, async () => {
      const s = setup(d)
      s.begin(0)
      await flush()
      expect(s.fetched.filter((u) => /result-/.test(u)).map((u) => u.replace(/.*(result-\w+)\.wav/, '$1'))).toEqual([name])
      s.run(16, 120_000, () => s.eng.getSnapshot(0).phase === 'RESULT')
      expect(s.eng.getSnapshot(0).phase).toBe('RESULT')
      expect(s.music()).toHaveLength(1)
      expect(s.music()[0].buffer!.tag).toContain(name)
      expect(s.music()[0].stopped).toBe(false)
    })
  }

  it('クリア（APPROACH/GAP から直接 RESULT）でも鳴る', async () => {
    const s = setup('EASY', 'running', 3000)
    s.begin(0)
    await flush()
    s.run(16, 20_000, () => s.eng.getSnapshot(0).phase === 'RESULT')
    const snap = s.eng.getSnapshot(0)
    expect(snap.phase).toBe('RESULT')
    expect(snap.result?.outcome).toBe('clear')
    expect(s.music()).toHaveLength(1)
  })

  it('キー入力と同じフレームで RESULT に入る経路（撃破しつつ時間切れ）でも鳴る', async () => {
    const s = setup('NORMAL', 'running', 3000)
    s.begin(0)
    await flush()
    let t = 16
    for (; t < 20_000 && s.eng.getSnapshot(t).phase !== 'RESULT'; t += 16) {
      s.frame(t)
      if (s.eng.getSnapshot(t).phase === 'APPROACH') for (const k of SPELL) s.key(t, k)
    }
    expect(s.eng.getSnapshot(t).phase).toBe('RESULT')
    expect(s.music()).toHaveLength(1)
  })

  it('suspended で RESULT に入っても、最初の操作（resume）で鳴り出す', async () => {
    const s = setup('NORMAL', 'suspended')
    s.begin(0)
    await flush()
    s.run(16, 120_000, () => s.eng.getSnapshot(0).phase === 'RESULT')
    expect(s.music()).toHaveLength(0)
    s.ctx.grant()
    expect(s.music()).toHaveLength(1)
  })

  it('RESULT 離脱（goTitle 相当）で止まり、再プレイでまた鳴る。2周目は再 fetch しない', async () => {
    const s = setup('EASY')
    s.begin(0)
    await flush()
    const t = s.run(16, 120_000, () => s.eng.getSnapshot(0).phase === 'RESULT')
    expect(s.music()).toHaveLength(1)
    s.eng.toTitle(); be_stop(s)
    expect(s.music()[0].stopped).toBe(true)
    s.begin(t + 1000)
    await flush()
    s.run(t + 1016, t + 120_000, () => s.eng.getSnapshot(0).phase === 'RESULT')
    expect(s.music()).toHaveLength(2)
    expect(s.fetched.filter((u) => /result-/.test(u))).toHaveLength(1)
  })
})

// useGame.goTitle は toTitle のあと sound.stopMusic を呼ぶ（ここでは router の onSnap 経路で止まることを見る）
const be_stop = (s: ReturnType<typeof setup>) => { s.frame(1_000_000) }

describe('曲ファイル', () => {
  for (const n of ['easy', 'normal', 'hard']) {
    it(`result-${n}.wav は 16bit PCM / 44.1kHz / 2ch の WAV`, () => {
      const b = readFileSync(new URL(`../assets/sound/result-${n}.wav`, import.meta.url))
      expect(b.toString('ascii', 0, 4)).toBe('RIFF')
      expect(b.toString('ascii', 8, 12)).toBe('WAVE')
      expect(b.readUInt16LE(20)).toBe(1) // PCM
      expect(b.readUInt16LE(22)).toBe(2)
      expect(b.readUInt32LE(24)).toBe(44100)
      expect(b.readUInt16LE(34)).toBe(16)
    })
  }
})
