import { describe, expect, it } from 'vitest'
import backroomRaw from '../assets/room/backroom.txt?raw'
import libraryRaw from '../assets/room/library.txt?raw'
import outsideRaw from '../assets/room/outside.txt?raw'
import playroomRaw from '../assets/room/playroom.txt?raw'
import { DIFFICULTIES } from './difficulty'
import { ROOMS } from './rooms'
import { ENEMIES, STAGE_IDS } from './faces'
import { fitScale, inkExtent, outsideMask, toGrid, toRuns } from './grid'

const fnv = (str: string) => {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0
  return h.toString(16)
}

const summarize = (raw: string) => {
  const g = toGrid(raw)
  const runs = toRuns(g)
  const mask = outsideMask(g)
  const sig = runs.map((r) => r.map((x) => `${x.opaque ? 'O' : 'T'}${x.text.length}`).join(',')).join('|')
  return {
    cols: g.cols,
    rows: g.rows,
    outside: mask.flat().filter(Boolean).length,
    hash: fnv(sig + g.lines.join('\n')),
  }
}

describe('grid', () => {
  it('room と各 face のグリッド・マスク・runs が固定', () => {
    const all = Object.fromEntries([['room-easy', outsideRaw], ['room-normal', libraryRaw], ['room-hard', backroomRaw], ...ENEMIES.flatMap((e) => e.stages.map((s) => [`${e.id}-${s.id}`, s.raw] as const))].map(([k, v]) => [k, summarize(v)]))
    expect(all).toMatchSnapshot()
  })
  it('空白で囲まれた内側は不透明', () => {
    const g = toGrid('###\n# #\n###')
    expect(toRuns(g)[1].map((r) => r.opaque)).toEqual([true])
    expect(toRuns(toGrid('  \n  ')).flat().every((r) => !r.opaque)).toBe(true)
  })
  it('素材は ASCII のみ・列数が段階名と一致・全種で段階数が同じ', () => {
    for (const e of ENEMIES) {
      expect(e.stages.map((s) => s.id)).toEqual(STAGE_IDS)
      for (const s of e.stages) {
        expect(s.raw).toMatch(/^[\x20-\x7e\r\n]*$/)
        expect(toGrid(s.raw).cols).toBe(Number(s.id))
      }
    }
  })
  it('room は ASCII のみ・全行 300 桁・十分な行数（playroom も同様）', () => {
    const raws = { outside: outsideRaw, library: libraryRaw, backroom: backroomRaw, playroom: playroomRaw }
    for (const raw of Object.values(raws)) {
      expect(raw).toMatch(/^[\x20-\x7e\r\n]*$/)
      const g = toGrid(raw)
      expect(g.rows).toBeGreaterThanOrEqual(80)
      expect(g.lines.every((l) => l.length === 300)).toBe(true)
      expect(g.cols).toBe(300)
    }
  })
  it('難易度ごとの room が割り当てどおり', () => {
    expect(ROOMS.EASY).toEqual(toGrid(outsideRaw))
    expect(ROOMS.NORMAL).toEqual(toGrid(libraryRaw))
    expect(ROOMS.HARD).toEqual(toGrid(backroomRaw))
  })
  it.each(DIFFICULTIES)('縮小後の最大段階は %s の room に収まり、段階間の大小関係を保つ', (difficulty) => {
    const room = ROOMS[difficulty]
    for (const e of ENEMIES) {
      const grids = e.stages.map((s) => toGrid(s.raw))
      const scale = fitScale(room.rows, grids[grids.length - 1].rows)
      expect(scale).toBeLessThanOrEqual(1)
      expect(grids[grids.length - 1].rows * scale).toBeLessThanOrEqual(room.rows + 1e-9)
      expect(grids[grids.length - 1].cols * scale).toBeLessThanOrEqual(room.cols)
      for (let i = 1; i < grids.length; i++) expect(grids[i].rows).toBeGreaterThan(grids[i - 1].rows)
    }
  })
  it('fitScale は room に収まるなら 1', () => {
    expect(fitScale(83, 50)).toBe(1)
    expect(fitScale(80, 160)).toBe(0.5)
  })
})

describe('inkExtent', () => {
  it('左右の空白だけの列を除いた端を返す', () => {
    expect(inkExtent(toGrid('  ###  \n  # #  \n  ###  '))).toEqual({ left: 2, right: 5 })
  })
  it('絵の内側の空白は端に含める（外周から届かない）', () => {
    expect(inkExtent(toGrid('#   #'))).toEqual({ left: 0, right: 5 })
  })
  it('絵が無ければ null', () => {
    expect(inkExtent(toGrid('   \n   '))).toBeNull()
  })
  it('全敵の最大段階で端が canvas 内にある', () => {
    for (const e of ENEMIES) {
      const g = toGrid(e.stages[e.stages.length - 1].raw)
      const x = inkExtent(g)
      expect(x).not.toBeNull()
      expect(x!.left).toBeGreaterThanOrEqual(0)
      expect(x!.right).toBeLessThanOrEqual(g.cols)
    }
  })
})
