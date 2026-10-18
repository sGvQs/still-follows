import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// sound はモジュールシングルトンなので、毎回 resetModules して動的 import する。node 環境には localStorage が無いので stub する
const KEY = 'still-follows:muted'
const stubStorage = (init: Record<string, string> = {}) => {
  const store = { ...init }
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } })
  return store
}
const load = async () => { vi.resetModules(); return (await import('./player')).sound }

describe('ミュート初期値', () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('保存値なし（初回）はミュート', async () => {
    stubStorage()
    expect((await load()).isMuted()).toBe(true)
  })
  it("'0' 保存済みなら音あり", async () => {
    stubStorage({ [KEY]: '0' })
    expect((await load()).isMuted()).toBe(false)
  })
  it("'1' ならミュート", async () => {
    stubStorage({ [KEY]: '1' })
    expect((await load()).isMuted()).toBe(true)
  })
  it('未知値はミュート', async () => {
    stubStorage({ [KEY]: 'x' })
    expect((await load()).isMuted()).toBe(true)
  })
  it('getItem が例外ならミュート', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied') }, setItem: () => {} })
    expect((await load()).isMuted()).toBe(true)
  })
  it("setMuted(false) で '0' が保存される", async () => {
    const store = stubStorage()
    const s = await load()
    s.setMuted(false)
    expect(s.isMuted()).toBe(false)
    expect(store[KEY]).toBe('0')
  })
})
