import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWebAudioBackend, type Backend } from './player'

// 簡易 FakeAudioContext。実際の音量・スケジューリング・デコードの精度は再現しない（呼び出しと状態遷移だけ検証する）
class FakeParam {
  value = 1
  cancelScheduledValues() {}
  setValueAtTime(v: number) { this.value = v }
  linearRampToValueAtTime(v: number) { this.value = v }
}
class FakeNode { gain = new FakeParam(); connect() {} disconnect() {} }
class FakeSource extends FakeNode {
  buffer: unknown = null
  onended: (() => void) | null = null
  started = 0
  stopped = false
  start() { this.started++ }
  stop() { this.stopped = true; this.onended?.() }
}
class FakeCtx {
  state: 'running' | 'suspended' | 'closed' = 'running'
  currentTime = 0
  destination = new FakeNode()
  sources: FakeSource[] = []
  gains: FakeNode[] = []
  listeners: (() => void)[] = []
  decodeFail = false
  createGain() { const g = new FakeNode(); this.gains.push(g); return g }
  createBufferSource() { const s = new FakeSource(); this.sources.push(s); return s }
  decodeAudioData(_d: ArrayBuffer, ok: (b: unknown) => void, ng: (e: unknown) => void) { if (this.decodeFail) ng(new Error('decode')); else ok({ id: Math.random() }) }
  addEventListener(_t: string, l: () => void) { this.listeners.push(l) }
  removeEventListener() {}
  resume() { return Promise.resolve() }
  close() { return Promise.resolve() }
  setState(s: 'running' | 'suspended') { this.state = s; this.listeners.forEach((l) => l()) }
}

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
const musicSources = (c: FakeCtx) => c.sources.filter((s) => s.started > 0)
const startedSources = musicSources

describe('リザルト曲（player）', () => {
  let ctx: FakeCtx
  let be: Backend
  let fetched: string[]
  let fetchMode: 'ok' | 'reject' | 'http'
  const musicFetches = () => fetched.filter((u) => /result-/.test(u))
  beforeEach(() => {
    ctx = new FakeCtx()
    fetched = []
    fetchMode = 'ok'
    vi.stubGlobal('fetch', (u: string) => {
      fetched.push(u)
      if (fetchMode === 'reject') return Promise.reject(new Error('net'))
      return Promise.resolve({ ok: fetchMode === 'ok', arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
    })
    be = createWebAudioBackend(ctx as unknown as AudioContext)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('起動時の一括 fetch に曲は含まれない', async () => {
    await flush()
    expect(fetched.length).toBeGreaterThan(0)
    expect(musicFetches()).toEqual([])
  })
  it('ロード完了前の play は、完了後に開始する（pending play）', async () => {
    be.play('result-easy')
    expect(musicSources(ctx)).toHaveLength(0)
    await flush()
    expect(musicSources(ctx)).toHaveLength(1)
  })
  it('preload 済みなら play で即開始。二重 play で voice は増えない（HMR/StrictMode）', async () => {
    be.preload('result-normal'); await flush()
    be.play('result-normal'); be.play('result-normal')
    expect(musicSources(ctx)).toHaveLength(1)
  })
  it('同難易度の再 preload は fetch しない。別難易度で旧 buffer は破棄され、戻すと再 fetch', async () => {
    be.preload('result-easy'); await flush()
    be.preload('result-easy'); await flush()
    expect(musicFetches()).toHaveLength(1)
    be.preload('result-hard'); await flush()
    expect(musicFetches()).toHaveLength(2)
    be.preload('result-easy'); await flush()
    expect(musicFetches()).toHaveLength(3)
  })
  for (const mode of ['reject', 'http'] as const) {
    it(`fetch 失敗（${mode}）後に同難易度で再 preload される`, async () => {
      fetchMode = mode
      be.preload('result-easy'); await flush()
      fetchMode = 'ok'
      be.preload('result-easy'); await flush()
      expect(musicFetches()).toHaveLength(2)
      be.play('result-easy')
      expect(musicSources(ctx)).toHaveLength(1)
    })
  }
  it('decode 失敗後に同難易度で再 preload される', async () => {
    ctx.decodeFail = true
    be.preload('result-easy'); await flush()
    ctx.decodeFail = false
    be.preload('result-easy'); await flush()
    expect(musicFetches()).toHaveLength(2)
  })
  it('stopMusic で voice が止まり、pending play も開始されない', async () => {
    be.preload('result-easy'); await flush()
    be.play('result-easy')
    be.stopMusic()
    expect(musicSources(ctx)[0].stopped).toBe(true)
    const c2 = new FakeCtx(); fetched = []
    const b2 = createWebAudioBackend(c2 as unknown as AudioContext)
    b2.play('result-hard'); b2.stopMusic(); await flush()
    expect(musicSources(c2)).toHaveLength(0)
  })
  it('suspended のまま play → running になったら開始。stopMusic 後の statechange では開始しない', async () => {
    ctx.state = 'suspended'
    be.preload('result-easy'); await flush()
    be.play('result-easy')
    expect(musicSources(ctx)).toHaveLength(0)
    ctx.setState('running')
    expect(musicSources(ctx)).toHaveLength(1)
    be.stopMusic()
    ctx.setState('suspended'); ctx.setState('running')
    expect(musicSources(ctx)).toHaveLength(1)
    // 停止後に suspended で play → stopMusic → running でも鳴らない
    ctx.state = 'suspended'
    be.play('result-easy'); be.stopMusic(); ctx.setState('running')
    expect(musicSources(ctx)).toHaveLength(1)
  })
  it('stopWorld は曲を止めない', async () => {
    be.preload('result-easy'); await flush()
    be.play('result-easy'); be.stopWorld()
    expect(musicSources(ctx)[0].stopped).toBe(false)
  })
  it('ミュート中も voice は作られ master gain は 0 のまま。解除で新規 voice は作られない（続きから）', async () => {
    be.preload('result-easy'); await flush()
    be.setMuted(true)
    be.play('result-easy')
    const master = ctx.gains[0]
    expect(musicSources(ctx)).toHaveLength(1)
    expect(master.gain.value).toBe(0)
    be.setMuted(false)
    expect(master.gain.value).toBe(1)
    expect(musicSources(ctx)).toHaveLength(1)
    expect(musicSources(ctx)[0].stopped).toBe(false)
  })
})

describe('ホバー音（player）', () => {
  let ctx: FakeCtx
  let be: Backend
  beforeEach(async () => {
    ctx = new FakeCtx()
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }))
    be = createWebAudioBackend(ctx as unknown as AudioContext)
    await flush()
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('play(hover) で voice が作られて開始される', () => {
    be.play('hover')
    expect(startedSources(ctx)).toHaveLength(1)
  })
  it('連続して play(hover) しても旧 voice は止められず、重なって鳴る', () => {
    be.play('hover'); be.play('hover')
    const v = startedSources(ctx)
    expect(v).toHaveLength(2)
    expect(v.every((x) => !x.stopped)).toBe(true)
  })
  it('ミュート中は master gain が 0（解除で 1）。ミュート判定そのものは sound.play 側', () => {
    be.setMuted(true)
    be.play('hover')
    expect(ctx.gains[0].gain.value).toBe(0)
    be.setMuted(false)
    expect(ctx.gains[0].gain.value).toBe(1)
  })
})
