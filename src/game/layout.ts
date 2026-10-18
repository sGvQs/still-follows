import { HP_ABOVE_ROOM_PX, TOPIC_BOTTOM_OFFSET_PX } from './config'

export const TOPIC_BASE_PX = 12 // 表記（DotGothic16）の文字サイズ
export const TOPIC_ROMAJI_BASE_PX = 9 // ローマ字（Press Start 2P）の文字サイズ
export const TOPIC_LINE_PX = 18 // 表記行の行高（12px x 1.5）
export const TOPIC_ROMAJI_LINE_PX = 14 // ローマ字行の行高（9px x 1.5 = 13.5 を整数に丸める）
export const TOPIC_CARD_PADDING_Y = 12 // お題カードの上下 padding
export const TOPIC_CARD_PADDING_X = 18

// お題カードの高さ（box-sizing: border-box の外寸）。2行 + 上下 padding（枠線なし）
export const topicCardHeight = (): number =>
  TOPIC_LINE_PX + TOPIC_ROMAJI_LINE_PX + TOPIC_CARD_PADDING_Y * 2

export type GameArea = { top: number; height: number; roomCenterY: number }

// ゲーム領域 = room + 下余白。領域全体を縦中央に置く。顔は room の中心(roomCenterY)に固定する（領域ではクリップしない）
export const gameArea = (viewH: number, roomRows: number, marginRows: number, fontPx: number): GameArea => {
  const height = (roomRows + marginRows) * fontPx
  const top = (viewH - height) / 2
  return { top, height, roomCenterY: top + (roomRows * fontPx) / 2 }
}

// room の下端Y（画面上端=0 基準）
export const roomBottomY = (roomCenterY: number, roomRows: number, fontPx: number): number =>
  roomCenterY + (roomRows * fontPx) / 2

// お題カードの下端Y。room の下端から TOPIC_BOTTOM_OFFSET_PX だけ上（顔の段階に依存しない固定位置）
export const topicBottomY = (roomBottom: number, offset = TOPIC_BOTTOM_OFFSET_PX): number => roomBottom - offset

// HP 表示の下端Y。room の上端から HP_ABOVE_ROOM_PX だけ上。画面外に出ないよう textPx 以上に clamp する
export const hpBottomY = (roomCenterY: number, roomRows: number, fontPx: number, textPx: number, offset = HP_ABOVE_ROOM_PX): number =>
  Math.max(textPx, roomCenterY - (roomRows * fontPx) / 2 - offset)

// 残りHPを塗り、失ったHPを抜くプログレスバー表記。例: hpBar(2, 3) = 'HP [██░]'
export const hpBar = (hp: number, maxHp: number): string => {
  const current = Math.max(0, Math.min(maxHp, hp))
  return `HP [${'█'.repeat(current)}${'░'.repeat(maxHp - current)}]`
}

// 互換性のため hpText を残す（旧形式: 'HP ##-'）
export const hpText = (hp: number, maxHp: number): string => {
  const left = Math.max(0, Math.min(maxHp, hp))
  return `HP ${'#'.repeat(left)}${'-'.repeat(maxHp - left)}`
}

// 残り時間の表記。例: timeText(60) = 'TIME 60'。0 未満は 0
export const timeText = (sec: number): string => `TIME ${Math.max(0, Math.ceil(sec))}`

// HP / 時間表示の左端X。room（横縮小後）の左端に HP の左端、右端に時間の右端を合わせ、画面内に clamp する
// roomCenterX は画面中央、roomWidthPx は縮小前の room 幅、scaleX は横縮小率
export const hudLeftX = (viewW: number, roomWidthPx: number, scaleX: number, textW: number): number =>
  Math.max(0, Math.min(viewW - textW, viewW / 2 - (roomWidthPx * scaleX) / 2))

export const hudRightX = (viewW: number, roomWidthPx: number, scaleX: number, textW: number): number =>
  Math.max(0, Math.min(viewW - textW, viewW / 2 + (roomWidthPx * scaleX) / 2 - textW))

export const WARNING_TEXT = 'WARNING'
const WARNING_BAND_PAD_RATIO = 0.4 // 帯の上下 padding（文字サイズ比、片側）
const WARNING_BAND_BORDER_PX = 2
const WARNING_VIEW_W_RATIO = 0.9 // 帯の幅が画面幅に占める上限

// 開始前 WARNING のレイアウト。背景を描かない間だけの値で、APPROACH 以降には使わない。
// 「顔 + 間隔 + 帯」を 1 つの塊にして画面の縦中央に置く。顔と帯の間隔は gapPx 固定で、
// 塊が画面（上下に edgePx の余白）に収まらないときは顔だけ縮める（faceScale < 1）。
// 帯の外寸の幅は画面上の顔の絵の見た目の幅（faceWidthPx は縮小前・絵の左右の端の間。faceWidthPx * faceScale）にそろえ、文字（Press Start 2P は 1 文字 = 1em 幅）は
// 帯の内側に収まる最大にする。ただし帯の高さが画面の maxBandHRatio、幅が画面の 90% を超えない範囲で
// （上限が効くと帯は顔より狭くなる）
export type WarningLayout = { faceCenterY: number; faceScale: number; faceBottom: number; bandTop: number; centerY: number; fontPx: number; padPx: number; bandW: number; bandH: number }

export const warningBand = (viewH: number, viewW: number, faceHeightPx: number, faceWidthPx: number, gapPx: number, edgePx: number, maxBandHRatio: number): WarningLayout => {
  const bd = WARNING_BAND_BORDER_PX * 2
  const unitW = WARNING_TEXT.length + WARNING_BAND_PAD_RATIO * 2 // 帯の幅 = fontPx * unitW + bd
  const unitH = 1 + WARNING_BAND_PAD_RATIO * 2 // 帯の高さ = fontPx * unitH + bd
  const k = unitH / unitW
  const total = viewH - edgePx * 2
  const fCap = Math.min((viewW * WARNING_VIEW_W_RATIO - bd) / unitW, (total * maxBandHRatio - bd) / unitH)
  // 顔の縮み率 s と帯の文字サイズ f は互いに依存するので、上限が効く場合 / 効かない場合を順に解く
  const sCap = faceHeightPx > 0 ? Math.min(1, (total - gapPx - (fCap * unitH + bd)) / faceHeightPx) : 1
  const fitW = (s: number) => (faceWidthPx * s - bd) / unitW
  let faceScale = sCap
  let fRaw = fCap
  if (faceWidthPx > 0 && fitW(sCap) < fCap) {
    const den = faceHeightPx + k * faceWidthPx
    faceScale = Math.min(1, (total - gapPx - bd * (1 - k)) / den)
    fRaw = fitW(faceScale)
  }
  const widthLimited = faceWidthPx > 0 && fitW(faceScale) <= fCap
  let fontPx = Math.max(0, Math.floor(Math.min(fCap, fRaw)))
  const padOf = (f: number) => Math.round(f * WARNING_BAND_PAD_RATIO)
  const bandHOf = (f: number) => f + padOf(f) * 2 + bd
  const bandWOf = (f: number) => f * WARNING_TEXT.length + padOf(f) * 2 + bd
  // 顔の再クランプで帯の幅が縮むと文字が収まらなくなるので、文字サイズの決定と顔の縮み率の再クランプを、変化しなくなるまで繰り返す（縮み率は単調に減るので収束する。念のため回数に上限を置く）
  let bandW = 0
  for (let i = 0; i < 16; i++) {
    // 連続値で解いた文字サイズは丸めの分だけ控えめなので、再クランプ後の帯にまだ 1 つ大きい文字が収まるなら大きくする
    const grown = fontPx + 1
    const grownScale = faceHeightPx > 0 ? Math.min(faceScale, (total - gapPx - bandHOf(grown)) / faceHeightPx) : faceScale
    if (grown <= fCap + 1 && bandHOf(grown) <= total * maxBandHRatio && grownScale >= faceScale - 1e-9 && bandWOf(grown) <= (widthLimited ? faceWidthPx * faceScale : Infinity) + 1e-9 && bandWOf(grown) <= viewW * WARNING_VIEW_W_RATIO + 1e-9) fontPx = grown
    const targetW = widthLimited ? faceWidthPx * faceScale : Infinity
    while (fontPx > 0 && (bandHOf(fontPx) > total * maxBandHRatio || bandWOf(fontPx) > targetW + 1e-9)) fontPx--
    // 幅で決まるときは顔の絵の左右の端にぴったり合わせる（文字は帯の中で中央）。上限で決まるときは文字に合わせた幅
    bandW = widthLimited ? targetW : bandWOf(fontPx)
    if (faceHeightPx <= 0) break
    const next = Math.max(0, Math.min(faceScale, (total - gapPx - bandHOf(fontPx)) / faceHeightPx))
    if (next >= faceScale) break
    faceScale = next
  }
  const padPx = padOf(fontPx)
  const bandH = bandHOf(fontPx)
  const faceH = faceHeightPx * faceScale
  const top = (viewH - (faceH + gapPx + bandH)) / 2
  const faceBottom = top + faceH
  const bandTop = faceBottom + gapPx
  return { faceCenterY: top + faceH / 2, faceScale, faceBottom, bandTop, centerY: bandTop + bandH / 2, fontPx, padPx, bandW, bandH }
}

// バフ中の目印（固定文字 WARNING）の文字サイズ。画面中央に置き、HP（左）・TIME（右）と gapPx 以上離す。
// 入りきらないときは目印を小さくする（HP / TIME は動かさない）。0 以下なら描画しない
export const buffMarkPx = (viewW: number, hudLeft: number, hpW: number, hudRight: number, maxPx: number, gapPx = 8): number => {
  const half = Math.min(viewW / 2 - (hudLeft + hpW), hudRight - viewW / 2) - gapPx
  return Math.max(0, Math.min(maxPx, Math.floor((half * 2) / WARNING_TEXT.length)))
}
