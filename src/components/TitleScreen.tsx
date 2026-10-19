import titleRaw from '../assets/title/title.txt?raw'
import { Button } from './Button'
import { DIFFICULTIES, DIFFICULTY_CONFIG, type Difficulty } from '../game/difficulty'
import type { Language } from '../game/language'
import { COLOR_BG, COLOR_DIM, COLOR_FG, FONT_EN, FONT_JP, FONT_MONO } from '../game/config'

const SUBTITLE: Record<Language, string> = {
  JA: '60秒間、近づけさせるな。',
  EN: "60 SECONDS. DON'T LET IT REACH YOU.",
}

// 規約上の表記（OtoLogic 利用規約）。消さないこと
const SOUND_CREDIT = 'Sound by OtoLogic'
// 制作者表記（固有名のため言語切替なし）
const DIRECTOR_CREDIT = 'Directed & developed by sGvQs'

const CREDIT_LINES = [DIRECTOR_CREDIT, SOUND_CREDIT]

const screen: React.CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 2, background: COLOR_BG, color: COLOR_FG, fontFamily: FONT_EN,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: '40px 24px',
  textAlign: 'center',
}

export function TitleScreen({ composing, muted, language, onStart, onToggleMute, onToggleLanguage }: { composing: boolean; muted: boolean; language: Language; onStart: (difficulty: Difficulty) => void; onToggleMute: () => void; onToggleLanguage: () => void }) {
  return (
    <div style={screen}>
      <pre aria-hidden="true" style={{ margin: 0, fontFamily: FONT_MONO, fontSize: 10, lineHeight: 1.3, whiteSpace: 'pre', overflow: 'hidden' }}>
        {titleRaw.replace(/\s+$/, '')}
      </pre>
      <div style={{ marginTop: -16 }}>
        <h1 style={{ margin: 0, fontSize: 10, fontWeight: 'normal', lineHeight: 1.3, color: COLOR_DIM, whiteSpace: 'nowrap' }}>
          {language === 'JA' ? (
            <>
              <span style={{ fontFamily: FONT_EN, fontSize: 10 }}>STILL FOLLOWS</span>
              <span style={{ fontFamily: FONT_JP, fontSize: 12 }}> ― ホラータイピングゲーム</span>
            </>
          ) : (
            <span style={{ fontFamily: FONT_EN, fontSize: 10 }}>STILL FOLLOWS - SIMPLE TYPING GAME</span>
          )}
        </h1>
        <div style={language === 'JA' ? { marginTop: 8, fontSize: 18, fontWeight: 'bold', lineHeight: 1.3, color: COLOR_DIM, fontFamily: FONT_JP } : { marginTop: 8, fontSize: 10, lineHeight: 1.3, color: COLOR_DIM }}>{SUBTITLE[language]}</div>
        {composing && <div style={{ fontSize: 12, marginTop: 8, fontFamily: FONT_JP }}>日本語入力がオンです。半角英数にしてください</div>}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {DIFFICULTIES.map((d) => (
          <Button key={d} label={DIFFICULTY_CONFIG[d].label} size="large" onClick={() => onStart(d)} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <Button label={`LANG ${language}`} onClick={onToggleLanguage} />
        <Button label={`SOUND ${muted ? 'OFF' : 'ON'}`} onClick={onToggleMute} />
      </div>
      <div style={{ marginTop: -10, fontSize: 8, lineHeight: 1.3, color: COLOR_DIM , gap: 4, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        {CREDIT_LINES.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  )
}
