import type { CSSProperties } from 'react'
import { FONT_EN } from '../game/config'
import { sound } from '../sound/player'

// このゲーム唯一のボタン（方針。他のファイルで生のボタンを書かない）
// 色・枠線・カーソル・ホバー反転は styles.css の .btn に集約（インラインでは :hover が書けないため）
// 大きさは 2 通りだけ。normal は補助の操作（LANG / SOUND / TITLE）、large は主要な操作（難易度の選択）
export type ButtonSize = 'normal' | 'large'
const STYLES: Record<ButtonSize, CSSProperties> = {
  normal: { fontSize: 10, padding: '4px 12px', fontFamily: FONT_EN, lineHeight: 'inherit' },
  large: { fontSize: 14, padding: '8px 20px', fontFamily: FONT_EN, lineHeight: 'inherit' },
}

export function Button({ label, onClick, size = 'normal' }: { label: string; onClick?: () => void; size?: ButtonSize }) {
  return (
    <button type="button" className="btn" style={STYLES[size]} onPointerEnter={() => sound.play('hover')} onClick={(e) => {
      e.currentTarget.blur()
      // onClick を先に実行する（goTitle が内部で stopWorld しても click が消されない）。click は stopWorld の対象外
      onClick?.()
      sound.play('click')
    }}>
      {label}
    </button>
  )
}
