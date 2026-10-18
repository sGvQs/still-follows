import { useCallback, useEffect, useRef, useState } from 'react'
import type { Difficulty } from '../game/difficulty'
import type { Language } from '../game/language'
import { createEngine, type Engine, type Snapshot } from '../game/engine'
import { hasModifier } from '../game/score'
import { STAGE_IDS } from '../game/faces'
import { sound } from '../sound/player'
import { createSoundRouter, type SoundRouter } from '../sound/router'

export type Game = { snap: Snapshot; startGame: (difficulty: Difficulty) => void; setLanguage: (language: Language) => void; goTitle: () => void }

const isImeKey = (e: KeyboardEvent) => e.isComposing || e.keyCode === 229 || e.key === 'Process'

export const useGame = (): Game => {
  const engRef = useRef<Engine | null>(null)
  if (engRef.current === null) engRef.current = createEngine({ stageCount: STAGE_IDS.length })
  const eng = engRef.current
  const routerRef = useRef<SoundRouter | null>(null)
  if (routerRef.current === null) routerRef.current = createSoundRouter(sound)
  const router = routerRef.current
  const [snap, setSnap] = useState<Snapshot>(() => eng.getSnapshot(performance.now()))
  const lastRef = useRef<{ revision: number; stage: number; effectScaleX: number | null; effectScaleY: number | null; enemy: number; remainingSec: number }>({ revision: snap.revision, stage: snap.stage, enemy: snap.enemy, effectScaleX: snap.effectScaleX, effectScaleY: snap.effectScaleY, remainingSec: snap.remainingSec })

  // 開始の共通経路（ボタン）。start が false（開始済みなど）なら何もしない
  const begin = useCallback((now: number, difficulty: Difficulty): boolean => {
    if (!eng.start(now, difficulty)) return false
    const s = eng.getSnapshot(now)
    lastRef.current = { revision: s.revision, stage: s.stage, enemy: s.enemy, effectScaleX: s.effectScaleX, effectScaleY: s.effectScaleY, remainingSec: s.remainingSec }
    setSnap(s)
    router.onBegin(s, now)
    return true
  }, [eng, router])

  useEffect(() => {
    const sync = (now: number) => {
      const s = eng.getSnapshot(now)
      router.onSnap(s, now)
      const last = lastRef.current
      if (s.revision !== last.revision || s.stage !== last.stage || s.enemy !== last.enemy || s.effectScaleX !== last.effectScaleX || s.effectScaleY !== last.effectScaleY || s.remainingSec !== last.remainingSec) {
        lastRef.current = { revision: s.revision, stage: s.stage, enemy: s.enemy, effectScaleX: s.effectScaleX, effectScaleY: s.effectScaleY, remainingSec: s.remainingSec }
        setSnap(s)
      }
    }
    let raf = 0
    const loop = (now: number) => {
      eng.tick(now)
      sync(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onKeyDown = (e: KeyboardEvent) => {
      const now = performance.now()
      if (isImeKey(e)) {
        eng.handleKey(now, e.key, true)
        sync(now)
        return
      }
      if (hasModifier(e)) return
      if (e.repeat) return
      // ボタンにフォーカス中は標準の操作に任せる（Tab でフォーカス中の Space は通常のボタン押下＝難易度ボタンなら開始）
      if ((e.target as Element | null)?.closest?.('button')) return
      router.onKey(eng.handleKey(now, e.key, false))
      sync(now)
    }
    const onCompStart = () => { eng.imeDetected(); sync(performance.now()) }
    const onCompEnd = () => { eng.clearComposing(); sync(performance.now()) }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('compositionstart', onCompStart)
    window.addEventListener('compositionend', onCompEnd)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('compositionstart', onCompStart)
      window.removeEventListener('compositionend', onCompEnd)
    }
  }, [eng, router])

  // マウス操作での開始（IME の影響を受けない）
  const startGame = useCallback((difficulty: Difficulty) => { begin(performance.now(), difficulty) }, [begin])

  const setLanguage = useCallback((language: Language) => {
    const now = performance.now()
    if (!eng.setLanguage(language)) return
    setSnap(eng.getSnapshot(now))
  }, [eng])

  const goTitle = useCallback(() => {
    const now = performance.now()
    if (!eng.toTitle()) return
    sound.stopMusic() // rAF が止まっていても確実に止める（router の onSnap でも止まる）
    const s = eng.getSnapshot(now)
    lastRef.current = { revision: s.revision, stage: s.stage, enemy: s.enemy, effectScaleX: s.effectScaleX, effectScaleY: s.effectScaleY, remainingSec: s.remainingSec }
    setSnap(s)
  }, [eng])

  return { snap, startGame, setLanguage, goTitle }
}
