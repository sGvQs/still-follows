import { useEffect, useSyncExternalStore } from 'react'
import { ResultScreen } from './components/ResultScreen'
import { Stage } from './components/Stage'
import { TitleScreen } from './components/TitleScreen'
import { COLOR_BG, COLOR_FG, FONT_EN } from './game/config'
import { useGame } from './hooks/useGame'
import { sound } from './sound/player'

const PAGE_TITLE = {
  JA: 'STILL FOLLOWS｜ホラータイピングゲーム',
  EN: 'STILL FOLLOWS | Free Browser Typing Game (No Install)',
} as const

const toggleMute = () => sound.setMuted(!sound.isMuted())

export function App() {
  const { snap, startGame, setLanguage, goTitle } = useGame()
  const muted = useSyncExternalStore(sound.subscribe, sound.isMuted)
  useEffect(() => {
    document.documentElement.lang = snap.language === 'JA' ? 'ja' : 'en'
    document.title = PAGE_TITLE[snap.language]
  }, [snap.language])
  const offStage = snap.phase === 'TITLE' || snap.phase === 'RESULT'
  return (
    <div className="screen">
      {!offStage && <Stage snap={snap} />}
      {snap.phase === 'TITLE' && <TitleScreen composing={snap.composing} muted={muted} language={snap.language} onToggleLanguage={() => setLanguage(snap.language === 'JA' ? 'EN' : 'JA')} onStart={startGame} onToggleMute={toggleMute} />}
      {snap.phase === 'RESULT' && snap.result && <ResultScreen result={snap.result} onTitle={goTitle} />}
      {/* 被弾のフラッシュ中は背景が白になるので、文字色を青にして溶けないようにする */}
      {muted && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 3, fontFamily: FONT_EN, fontSize: 10, color: snap.flash ? COLOR_BG : COLOR_FG, pointerEvents: 'none' }}>MUTE</div>
      )}
    </div>
  )
}
