import type { CSSProperties } from 'react'
import { Button } from './Button'
import { COLOR_BG, COLOR_DIM, COLOR_FG, FONT_EN, FONT_JP, LEVELS } from '../game/config'
import type { GameResult } from '../game/engine'
import { DIFFICULTY_CONFIG } from '../game/difficulty'
import { accuracy, kanaPerMinute, levelOf, showsLevel, wordsPerMinute } from '../game/score'

const HEADINGS: Record<GameResult['outcome'], string> = { clear: 'CLEAR', gameover: 'GAME OVER' }

const screen: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 2, background: COLOR_BG, color: COLOR_FG, fontFamily: FONT_EN,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: '40px 24px',
  textAlign: 'center',
}

// ASCII（英数字・記号）は FONT_EN、それ以外（日本語）は FONT_JP に文字種ごとに振り分ける
function Mixed({ text }: { text: string }) {
  const parts = text.match(/[\x20-\x7e]+|[^\x20-\x7e]+/g) ?? []
  return (
    <>
      {parts.map((part, i) => (
        <span key={i} style={{ fontFamily: /^[\x20-\x7e]/.test(part) ? FONT_EN : FONT_JP }}>{part}</span>
      ))}
    </>
  )
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ fontSize: 18, fontFamily: FONT_EN }}>
      <span style={{ color: COLOR_DIM }}><Mixed text={label} /></span> <span style={{ color: COLOR_FG }}><Mixed text={String(value)} /></span>
    </div>
  )
}

export function ResultScreen({ result, onTitle }: { result: GameResult; onTitle: () => void }) {
  const en = result.language === 'EN'
  const acc = accuracy(result.keystrokes, result.mistakes)
  const speed = kanaPerMinute(result.netKana, result.activeMs)
  const grade = speed !== null ? levelOf(speed) : null
  const wpm = wordsPerMinute(result.netKana, result.activeMs)
  const level = en ? null : showsLevel(result, DIFFICULTY_CONFIG[result.difficulty].showLevel) && speed !== null ? (grade !== null ? `${grade}レベル` : `${LEVELS[LEVELS.length - 1].label}未満`) : null
  return (
    <div style={screen}>
      <div style={{ fontSize: 28 }}><Mixed text={HEADINGS[result.outcome]} /></div>
      <div>
        <Row label={en ? 'KILLS' : '撃破数'} value={result.kills} />
        <div style={{ height: 6 }} />
        <Row label={en ? 'ACCURACY' : '正解率'} value={acc === null ? '-' : `${acc.toFixed(1)}%`} />
        {en && (
          <>
            <div style={{ height: 6 }} />
            <Row label="SPEED" value={wpm === null ? '-' : `${Math.round(wpm)} WPM`} />
          </>
        )}
        {level !== null && (
          <>
            <div style={{ height: 6 }} />
            <Row label="階級" value={level} />
          </>
        )}
      </div>
      <Button label="TITLE" onClick={onTitle} size="large" />
    </div>
  )
}
