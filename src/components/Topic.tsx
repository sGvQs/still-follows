import { COLOR_BG, COLOR_DIM, COLOR_FG, FONT_EN, FONT_JP } from '../game/config'
import {
  TOPIC_BASE_PX, TOPIC_CARD_PADDING_X, TOPIC_CARD_PADDING_Y, TOPIC_LINE_PX,
  TOPIC_ROMAJI_BASE_PX, TOPIC_ROMAJI_LINE_PX, topicCardHeight,
} from '../game/layout'
import type { Snapshot } from '../game/engine'
import { panelStyle } from './panelStyle'

// 入力済みは薄く、次に打つ1文字は白い反転ブロック、未入力は白。全文字に同じ水平 padding(3px) を持たせ、入力しても幅が変わらない。
// inline-block の高さは行高(ローマ字行 14px)いっぱいなので、反転ブロックは文字(9px)より上下に各2.5px、左右に各3px 大きい白枠になる
const charBase = { display: 'inline-block', padding: '0 3px' } as const
const Spelling = ({ spelling, typed, inv }: { spelling: string; typed: number; inv: boolean }) => (
  <>
    {Array.from(spelling).map((ch, i) => (
      <span
        key={i}
        style={i < typed
          ? { ...charBase, color: inv ? COLOR_BG : COLOR_DIM, opacity: inv ? 0.7 : undefined }
          : i === typed
            ? { ...charBase, background: inv ? COLOR_BG : COLOR_FG, color: inv ? COLOR_FG : COLOR_BG }
            : { ...charBase, color: inv ? COLOR_BG : COLOR_FG }}
      >{ch}</span>
    ))}
  </>
)

type Props = { snap: Snapshot; bottomY: number; inv?: boolean }

// room 下部の水平中央に固定するお題カード。文字サイズは直接指定（表記12px / ローマ字9px）。枠線なし。下端中央を基準に置く
export function Topic({ snap, bottomY, inv = false }: Props) {
  const { word, progress } = snap
  return (
    <div style={{
      ...panelStyle, ...(inv ? { background: COLOR_FG, color: COLOR_BG } : null), position: 'absolute', left: '50%', top: Math.round(bottomY), zIndex: 1,
      padding: `${TOPIC_CARD_PADDING_Y}px ${TOPIC_CARD_PADDING_X}px`,
      boxSizing: 'border-box', height: topicCardHeight(),
      whiteSpace: 'pre', transform: 'translate(-50%, -100%)',
    }}>
      <div style={{ fontSize: TOPIC_BASE_PX, lineHeight: `${TOPIC_LINE_PX}px`, fontFamily: FONT_JP }}>{word?.text ?? ' '}</div>
      <div style={{ fontSize: TOPIC_ROMAJI_BASE_PX, lineHeight: `${TOPIC_ROMAJI_LINE_PX}px`, fontFamily: FONT_EN }}>
        {progress ? <Spelling spelling={progress.spelling} typed={progress.typed} inv={inv} /> : ' '}
      </div>
    </div>
  )
}
