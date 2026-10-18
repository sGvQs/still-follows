import { useEffect, useMemo, useRef, useState } from 'react'
import { CHAR_RATIO, COLOR_BG, COLOR_FG, FONT_EN, FONT_MONO, H_SCALE, HP_TEXT_PX, ROOM_BOTTOM_MARGIN_ROWS, V_SCALE, WARNING_EDGE_RATIO, WARNING_GAP_RATIO, WARNING_BAND_MAX_H_RATIO } from '../game/config'
import { ENEMIES } from '../game/faces'
import type { Snapshot } from '../game/engine'
import { fitScale, inkExtent, toGrid, toRuns } from '../game/grid'
import { ROOMS } from '../game/rooms'
import { buffMarkPx, gameArea, hpBar, hpBottomY, hudLeftX, hudRightX, roomBottomY, timeText, topicBottomY, warningBand, WARNING_TEXT } from '../game/layout'
import { Topic } from './Topic'

const preStyle = (fontPx: number, centerY: number, inv: boolean): React.CSSProperties => ({
  margin: 0,
  fontFamily: FONT_MONO,
  fontSize: fontPx,
  lineHeight: `${fontPx}px`,
  whiteSpace: 'pre',
  color: inv ? COLOR_BG : COLOR_FG,
  position: 'absolute',
  left: '50%',
  top: centerY,
  transform: 'translate(-50%, -50%)',
})

const hudStyle = (inv: boolean): React.CSSProperties => ({
  position: 'absolute', zIndex: 1, transform: 'translateY(-100%)',
  fontFamily: FONT_EN, fontSize: HP_TEXT_PX, lineHeight: `${HP_TEXT_PX}px`, whiteSpace: 'pre',
  color: inv ? COLOR_BG : COLOR_FG, background: inv ? COLOR_FG : COLOR_BG,
})

type Props = { snap: Snapshot }

// 敵の顔はモジュールレベルで1回だけ計算する（縮小倍率だけ room ごと）
const ENEMY_FACES = ENEMIES.map((e) => {
  const grids = e.stages.map((s) => toGrid(s.raw))
  return { maxRows: grids[grids.length - 1].rows, cols: grids[grids.length - 1].cols, ink: inkExtent(grids[grids.length - 1]) ?? { left: 0, right: 0 }, faces: grids.map(toRuns) }
})

export function Stage({ snap }: Props) {
  const { stage, enemy } = snap
  const room = ROOMS[snap.difficulty]
  const enemies = useMemo(() => ENEMY_FACES.map((e) => ({ scale: fitScale(room.rows, e.maxRows), maxRows: e.maxRows, cols: e.cols, ink: e.ink, faces: e.faces })), [room])
  const ref = useRef<HTMLDivElement>(null)
  const [fitPx, setFitPx] = useState(10)
  const [viewH, setViewH] = useState(0)
  const [viewW, setViewW] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const calc = () => {
      setFitPx(Math.min(el.clientWidth / (room.cols * CHAR_RATIO), el.clientHeight / (room.rows + ROOM_BOTTOM_MARGIN_ROWS)))
      setViewH(el.clientHeight)
      setViewW(el.clientWidth)
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [room])

  const fontPx = fitPx * V_SCALE
  const area = gameArea(viewH, room.rows, ROOM_BOTTOM_MARGIN_ROWS, fontPx)
  const current = enemy >= 0 ? enemies[enemy] : null
  const face = current && stage >= 0 ? current.faces[Math.min(stage, current.faces.length - 1)] : null
  const isWarning = snap.phase === 'WARNING'
  const scaleX = snap.effectScaleX ?? H_SCALE
  const faceFullPx = fontPx * (current?.scale ?? 1)
  const warning = warningBand(viewH, viewW, (current?.maxRows ?? 0) * faceFullPx, ((current?.ink.right ?? 0) - (current?.ink.left ?? 0)) * CHAR_RATIO * faceFullPx * scaleX, viewH * WARNING_GAP_RATIO, viewH * WARNING_EDGE_RATIO, WARNING_BAND_MAX_H_RATIO)
  // 顔の絵の見た目の中心が canvas 中心からずれる分（帯をその中心に置く）
  const inkOffsetX = current ? ((current.ink.left + current.ink.right) / 2 - current.cols / 2) * CHAR_RATIO * faceFullPx * warning.faceScale * scaleX : 0
  const faceFontPx = fontPx * (current?.scale ?? 1) * (isWarning ? warning.faceScale : 1)
  const faceCenterY = isWarning ? warning.faceCenterY : area.roomCenterY
  const scaleY = snap.effectScaleY ?? 1
  const inv = snap.flash
  const hpY = hpBottomY(area.roomCenterY, room.rows, fontPx, HP_TEXT_PX)
  const roomWidthPx = room.cols * CHAR_RATIO * fontPx
  const hpStr = hpBar(snap.hp, snap.maxHp)
  const timeStr = timeText(snap.remainingSec)
  const hudLeft = hudLeftX(viewW, roomWidthPx, H_SCALE, hpStr.length * HP_TEXT_PX)
  const hudRight = hudRightX(viewW, roomWidthPx, H_SCALE, timeStr.length * HP_TEXT_PX)
  const roomBottom = roomBottomY(area.roomCenterY, room.rows, fontPx)
  const bottomY = topicBottomY(roomBottom)
  const hpW = hpStr.length * HP_TEXT_PX
  // 暫定: WARNING 中は背景(room)・HP・TIME を隠す。戻すときはこの1行を false にする
  const hideChrome = snap.phase === 'WARNING'
  const markPx = buffMarkPx(viewW, Math.round(hudLeft), hpW, Math.round(hudRight), HP_TEXT_PX)

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: inv ? COLOR_FG : undefined }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${scaleX}, ${scaleY})`, transformOrigin: '50% 50%', zIndex: 0 }}>
        {!hideChrome && <pre style={preStyle(fontPx, area.roomCenterY, inv)}>{room.lines.join('\n')}</pre>}
        {face && (
          <pre style={preStyle(faceFontPx, faceCenterY, inv)}>
            {face.map((runs, r) => (
              <div key={r}>
                {runs.map((run, i) => (
                  <span key={i} style={run.opaque ? { background: inv ? COLOR_FG : COLOR_BG } : undefined}>{run.text}</span>
                ))}
              </div>
            ))}
          </pre>
        )}
      </div>
      {viewH > 0 && !hideChrome && (
        <>
          <div style={{ ...hudStyle(inv), left: Math.round(hudLeft), top: Math.round(hpY) }}>{timeStr}</div>
          <div style={{ ...hudStyle(inv), left: Math.round(hudRight), top: Math.round(hpY) }}>{hpStr}</div>
        </>
      )}
      {viewH > 0 && snap.buffed && markPx > 0 && (
        <div style={{ ...hudStyle(inv), fontSize: markPx, lineHeight: `${markPx}px`, left: '50%', top: Math.round(hpY), transform: 'translate(-50%, -100%)' }}>{WARNING_TEXT}</div>
      )}
      {viewH > 0 && snap.phase === 'WARNING' && warning.fontPx > 0 && (
        <div className="warning-band" style={{
          position: 'absolute', zIndex: 1, left: `calc(50% + ${inkOffsetX}px)`, top: Math.round(warning.centerY), transform: 'translate(-50%, -50%)',
          boxSizing: 'border-box', width: warning.bandW, textAlign: 'center',
          fontFamily: FONT_EN, fontSize: warning.fontPx, lineHeight: `${warning.fontPx}px`, padding: `${warning.padPx}px`, whiteSpace: 'pre',
        }}>{WARNING_TEXT}</div>
      )}
      {face && viewH > 0 && snap.phase !== 'WARNING' && <Topic snap={snap} bottomY={bottomY} inv={inv} />}
    </div>
  )
}
