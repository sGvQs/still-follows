import { describe, expect, it } from 'vitest'
import { gameArea, hpBar, hpBottomY, hpText, hudLeftX, hudRightX, timeText, roomBottomY, topicBottomY, topicCardHeight, warningBand, buffMarkPx } from './layout'
import { WARNING_GAP_RATIO, WARNING_EDGE_RATIO, WARNING_BAND_MAX_H_RATIO } from './config'

describe('layout', () => {
  it('ゲーム領域は room + 下余白を縦中央に置き、room 中心Yを返す', () => {
    const a = gameArea(1000, 80, 8, 10)
    expect(a.height).toBe(880)
    expect(a.top).toBe(60)
    expect(a.roomCenterY).toBe(60 + 400)
  })

  it('room 下端Yは中心 + rows*fontPx/2', () => {
    expect(roomBottomY(337.2, 84, 5.689)).toBeCloseTo(576.1, 1)
    expect(roomBottomY(505.9, 84, 8.533)).toBeCloseTo(864.3, 1)
  })

  it('お題の下端Yは room 下端 - 12px で room 内に収まる', () => {
    const b = roomBottomY(337.2, 84, 5.689)
    expect(topicBottomY(b)).toBeCloseTo(564.1, 1)
    expect(topicBottomY(b) - topicCardHeight()).toBeGreaterThan(337.2 - (84 * 5.689) / 2)
  })

  it('お題カードの高さは padding 込みで 56px', () => {
    expect(topicCardHeight()).toBe(56)
  })

  it('HP 表示は room 上端の少し上に置き、画面外には出さない', () => {
    // room 上端 = 460 - 400 = 60、offset 8 -> 52
    expect(hpBottomY(460, 80, 10, 12)).toBe(52)
    expect(hpBottomY(400, 80, 10, 12)).toBe(12)
  })

  it('HP 表記は残りを # 、失った分を - にする', () => {
    expect(hpText(3, 3)).toBe('HP ###')
    expect(hpText(2, 3)).toBe('HP ##-')
    expect(hpText(0, 3)).toBe('HP ---')
  })

  it('HP バーはプログレスバー形式。例: hpBar(2, 3) = "HP [██░]"', () => {
    expect(hpBar(3, 3)).toBe('HP [███]')
    expect(hpBar(2, 3)).toBe('HP [██░]')
    expect(hpBar(0, 3)).toBe('HP [░░░]')
    expect(hpBar(1, 3)).toBe('HP [█░░]')
  })

  it('時間表記は TIME + 秒（0 未満は 0）', () => {
    expect(timeText(60)).toBe('TIME 60')
    expect(timeText(0)).toBe('TIME 0')
    expect(timeText(-1)).toBe('TIME 0')
  })

  it('HP は縮小後 room の左端、時間は右端に合わせ、画面内に clamp する', () => {
    // 画面 1000、room 幅 1000 x 0.6 = 600 -> 左端 200、右端 800
    expect(hudLeftX(1000, 1000, 0.6, 100)).toBe(200)
    expect(hudRightX(1000, 1000, 0.6, 100)).toBe(700)
    expect(hudLeftX(300, 1000, 0.6, 100)).toBe(0)
    expect(hudRightX(300, 1000, 0.6, 100)).toBe(200)
  })
})

describe('warningBand / buffMarkPx', () => {
  const call = (w: number, h: number, faceH: number, faceW: number) =>
    warningBand(h, w, faceH, faceW, h * WARNING_GAP_RATIO, h * WARNING_EDGE_RATIO, WARNING_BAND_MAX_H_RATIO)
  it('顔の下端と帯の上端の間隔は gapPx 以上で、塊が画面に収まる', () => {
    for (const [w, h] of [[1280, 720], [1024, 600], [400, 300]]) {
      const gap = h * WARNING_GAP_RATIO
      const edge = h * WARNING_EDGE_RATIO
      const b = call(w, h, h * 0.9, w * 0.5)
      expect(b.bandTop - b.faceBottom).toBeGreaterThanOrEqual(gap - 0.001)
      expect(b.centerY - b.bandH / 2).toBeGreaterThanOrEqual(b.bandTop - 1)
      expect(b.centerY + b.bandH / 2).toBeLessThanOrEqual(h - edge + 1)
      expect(b.faceBottom - h * 0.9 * b.faceScale).toBeGreaterThanOrEqual(edge - 0.001)
      expect(b.bandW).toBeLessThanOrEqual(w * 0.9)
    }
  })
  it('帯の幅は画面上の顔の幅と同じくらいで、文字は帯の内側に収まる最大', () => {
    const b = call(1280, 720, 300, 400)
    expect(b.faceScale).toBe(1)
    expect(Math.abs(b.bandW - 400 * b.faceScale)).toBeLessThanOrEqual(b.fontPx)
    expect(b.bandW).toBeLessThanOrEqual(400)
    expect(b.bandH).toBeLessThanOrEqual((720 - 720 * WARNING_EDGE_RATIO * 2) * WARNING_BAND_MAX_H_RATIO)
  })
  it('顔が大きすぎるときは顔だけ縮め、帯は縮んだ顔の幅に合わせる', () => {
    const b = call(1024, 600, 1000, 800)
    expect(b.faceScale).toBeLessThan(1)
    expect(b.bandTop - b.faceBottom).toBeGreaterThanOrEqual(600 * WARNING_GAP_RATIO - 0.001)
    expect(Math.abs(b.bandW - 800 * b.faceScale)).toBeLessThanOrEqual(b.fontPx)
  })
  it('高さの上限が効くと帯は顔より狭くなる', () => {
    const b = call(1280, 720, 200, 1200)
    expect(b.bandW).toBeLessThan(1200)
    expect(b.bandH).toBeLessThanOrEqual((720 - 720 * WARNING_EDGE_RATIO * 2) * WARNING_BAND_MAX_H_RATIO)
  })
  it('狭い画面では幅で clamp する', () => {
    const b = call(200, 600, 100, 1000)
    expect(b.bandW).toBeLessThanOrEqual(200 * 0.9)
  })
  it('顔の縮み率の再クランプ後も、幅で決まるときは文字が帯に収まる最大で、既存の条件も保つ', () => {
    const border = 4
    const widthOf = (f: number) => f * 7 + Math.round(f * 0.4) * 2 + border
    const screens = [[1280, 720], [1024, 600], [400, 300], [1600, 200], [300, 1200], [500, 1000]]
    // 400x300 / 顔 100x113.33 は、再クランプで帯が縮み文字が 0.67px はみ出していた境界の例
    const fixed = [[400, 300, 100, 340 / 3]]
    let checked = 0
    for (const [w, h] of screens) {
      const gap = h * WARNING_GAP_RATIO
      const edge = h * WARNING_EDGE_RATIO
      const cases = [...fixed.filter((c) => c[0] === w && c[1] === h).map((c) => [c[2], c[3]])]
      for (let fh = h * 0.1; fh <= h * 1.2; fh += h / 17) for (let fw = w * 0.1; fw <= w * 1.1; fw += w / 17) cases.push([fh, fw])
      for (const [fh, fw] of cases) {
        const b = call(w, h, fh, fw)
        const label = `${w}x${h} face ${fh}x${fw}`
        if (b.fontPx > 0 && Math.abs(b.bandW - fw * b.faceScale) < 1e-9) {
          expect(widthOf(b.fontPx), label).toBeLessThanOrEqual(b.bandW + 1e-9)
          const bandHOf = (f: number) => f + Math.round(f * 0.4) * 2 + border
          const fits = bandHOf(b.fontPx + 1) <= (h - edge * 2) * WARNING_BAND_MAX_H_RATIO && (h - edge * 2 - gap - bandHOf(b.fontPx + 1)) / fh >= b.faceScale - 1e-9
          if (fits) {
            expect(widthOf(b.fontPx + 1), label).toBeGreaterThan(b.bandW - 1e-9)
          }
          checked++
        }
        expect(b.bandTop - b.faceBottom, label).toBeGreaterThanOrEqual(gap - 1e-6)
        expect(b.faceBottom - fh * b.faceScale, label).toBeGreaterThanOrEqual(edge - 1e-6)
        expect(b.bandTop + b.bandH, label).toBeLessThanOrEqual(h - edge + 1e-6)
        expect(b.bandW, label).toBeLessThanOrEqual(w * 0.9 + 1e-6)
        expect(b.bandH, label).toBeLessThanOrEqual((h - edge * 2) * WARNING_BAND_MAX_H_RATIO + 1e-6)
      }
    }
    expect(checked).toBeGreaterThan(100)
  })
  it('目印は HP / TIME と重ならない', () => {
    expect(buffMarkPx(800, 100, 72, 616, 12)).toBe(12)
    const px = buffMarkPx(200, 0, 72, 116, 12)
    expect(px).toBeLessThan(12)
    expect(100 - px * 3.5).toBeGreaterThanOrEqual(72)
    expect(buffMarkPx(150, 0, 72, 66, 12)).toBe(0)
  })
})
