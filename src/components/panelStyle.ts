import type { CSSProperties } from 'react'
import { COLOR_BG, COLOR_FG, FONT_EN } from '../game/config'

// 青い四角いパネル（お題カード）。枠線・padding は用途ごとに指定する
export const panelStyle: CSSProperties = {
  background: COLOR_BG, color: COLOR_FG, fontFamily: FONT_EN, textAlign: 'center',
}
