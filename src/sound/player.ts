import clickUrl from '../assets/sound/click.wav'
import hoverUrl from '../assets/sound/hover.wav'
import typeAUrl from '../assets/sound/type-a.wav'
import typeBUrl from '../assets/sound/type-b.wav'
import typeCUrl from '../assets/sound/type-c.wav'
import normalFootstepUrl from '../assets/sound/normal-footstep.wav'
import hardFootstepUrl from '../assets/sound/hard-footstep.wav'
import hardOpeningUrl from '../assets/sound/hard-opening.wav'
import resultEasyUrl from '../assets/sound/result-easy.wav'
import resultNormalUrl from '../assets/sound/result-normal.wav'
import resultHardUrl from '../assets/sound/result-hard.wav'

// 効果音の再生（Web Audio）。ゲーム状態との対応は router.ts が持ち、ここは「鳴らす・止める・ミュート」だけ
export type MusicName = 'result-easy' | 'result-normal' | 'result-hard'
export type SoundName = 'click' | 'hover' | 'type-a' | 'type-b' | 'type-c' | 'normal-footstep' | 'hard-footstep' | 'hard-opening' | MusicName

export type SoundPlayer = {
  play: (name: SoundName) => void // 曲（MusicName）はミュート中も流れ続ける（無音のまま進み、解除で続きから聞こえる）
  stopWorld: () => void // 足音と開幕音を止める（click・打鍵音・曲は止めない）
  stopMusic: () => void // 曲を止める（RESULT 離脱時）。同期的に呼べる
  preload: (name: MusicName) => void // 曲を先読みする。選択中の1曲だけ保持する
}

// 実機で聴いて調整する値
const ATTACK_MS = 5 // 音の立ち上がり（0 → 1）。プチ音防止
const FADE_REPLACE_MS = 40 // 足音・打鍵音を新しい音で置き換えるときの、旧音のフェードアウト
const FADE_STOP_MS = 80 // stopWorld（撃破・被弾・終了）で止めるときのフェードアウト
const MAX_TYPE_VOICES = 3 // 打鍵音の同時発音数。超えたら最古を切る
const MUSIC_GAIN = 0.55 // リザルト曲の音量（効果音に対する比。3曲は -18 LUFS に揃えてある）
const HOVER_GAIN = 1.0 // ボタンのホバー音の音量。実音区間の RMS が click より約 5dB 低いので、実機で小さければ 1.5 前後まで上げてよい（ピーク -9.8dBFS なので 1.5 でもクリップしない）

const MUTED_KEY = 'still-follows:muted'

const URLS: Record<SoundName, string> = {
  click: clickUrl,
  hover: hoverUrl,
  'type-a': typeAUrl,
  'type-b': typeBUrl,
  'type-c': typeCUrl,
  'normal-footstep': normalFootstepUrl,
  'hard-footstep': hardFootstepUrl,
  'hard-opening': hardOpeningUrl,
  'result-easy': resultEasyUrl,
  'result-normal': resultNormalUrl,
  'result-hard': resultHardUrl,
}

const isMusic = (name: SoundName): name is MusicName => name.startsWith('result-')

// 種類ごとの扱い。world は stopWorld の対象、footstep は同時に1つだけ（新しい足音が前の足音を切る）
type Channel = 'ui' | 'hover' | 'type' | 'footstep' | 'opening' | 'music'
const CHANNEL: Record<SoundName, Channel> = {
  click: 'ui',
  hover: 'hover',
  'type-a': 'type',
  'type-b': 'type',
  'type-c': 'type',
  'normal-footstep': 'footstep',
  'hard-footstep': 'footstep',
  'hard-opening': 'opening',
  'result-easy': 'music',
  'result-normal': 'music',
  'result-hard': 'music',
}

export type Backend = {
  play: (name: SoundName) => void
  stopWorld: () => void
  stopMusic: () => void
  preload: (name: MusicName) => void
  setMuted: (muted: boolean) => void
  dispose: () => void
}

// AudioContext が無い環境（vitest など）用。何もしない
const noopBackend: Backend = { play: () => {}, stopWorld: () => {}, stopMusic: () => {}, preload: () => {}, setMuted: () => {}, dispose: () => {} }

type Voice = { source: AudioBufferSourceNode; gain: GainNode }

export const createWebAudioBackend = (ctx: AudioContext): Backend => {
  const master = ctx.createGain()
  master.connect(ctx.destination)
  // ch ごとのゲイン（将来、種類別に音量を変えられるように master との間に挟む）
  const channelGain = {} as Record<Channel, GainNode>
  for (const ch of ['ui', 'hover', 'type', 'footstep', 'opening', 'music'] as const) {
    channelGain[ch] = ctx.createGain()
    if (ch === 'music') channelGain[ch].gain.value = MUSIC_GAIN
    if (ch === 'hover') channelGain[ch].gain.value = HOVER_GAIN
    channelGain[ch].connect(master)
  }

  const buffers = new Map<SoundName, AudioBuffer>()
  // 未デコードなら鳴らさず捨てる（待たない）ので、読み込み失敗は握りつぶしてよい
  const decode = (data: ArrayBuffer) => new Promise<AudioBuffer>((resolve, reject) => {
    ctx.decodeAudioData(data, resolve, reject) // Safari 向けにコールバック形式
  })
  for (const name of Object.keys(URLS) as SoundName[]) {
    if (isMusic(name)) continue // 曲は大きいので起動時には取らず、preload で選択中の1曲だけ取る
    fetch(URLS[name]).then((r) => r.arrayBuffer()).then(decode).then((b) => { buffers.set(name, b) }).catch(() => {})
  }

  let footstep: Voice | null = null
  let musicVoice: (Voice & { name: MusicName }) | null = null
  let opening: Voice | null = null
  const typeVoices: Voice[] = []

  // 現在値からのスケジュールに切り替えて 0 へ下げ、止める（cancelScheduledValues → setValueAtTime → ramp の順）
  const fadeOut = (v: Voice, ms: number) => {
    const now = ctx.currentTime
    const g = v.gain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(0, now + ms / 1000)
    try { v.source.stop(now + ms / 1000 + 0.01) } catch { /* 停止済み */ }
  }

  const tryResume = () => { if (ctx.state !== 'running') void ctx.resume().catch(() => {}) }
  // 自動再生ポリシー対策。最初の操作で再開し、動き出したら外す
  const gestures = ['pointerdown', 'keydown'] as const
  const onGesture = () => tryResume()
  const hasWindow = typeof window !== 'undefined'
  const detach = () => { if (hasWindow) gestures.forEach((t) => window.removeEventListener(t, onGesture, true)) }
  const onState = () => {
    if (ctx.state !== 'running') return
    detach()
    tryStartMusic() // suspended のまま RESULT に入った場合の救済
  }
  if (hasWindow) gestures.forEach((t) => window.addEventListener(t, onGesture, true))
  ctx.addEventListener('statechange', onState)

  // 曲: 選択中の1曲だけ保持する。song が今の曲名と違えば旧 buffer は捨てる（再生中の voice には影響しない）
  type Song = { name: MusicName; buffer: AudioBuffer | null }
  let song: Song | null = null
  let want: MusicName | null = null // 鳴らしたい曲。stopMusic で消える

  const preload = (name: MusicName) => {
    if (song?.name === name) return // 取得済み・取得中は再 fetch しない
    const mine: Song = { name, buffer: null }
    song = mine
    fetch(URLS[name])
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer() })
      .then(decode)
      .then((b) => { if (song === mine) { mine.buffer = b; tryStartMusic() } })
      .catch((e) => { console.warn(`[sound] 曲の読み込み・デコードに失敗: ${name}`, e); if (song === mine) song = null }) // 次の preload で再試行される
  }

  function tryStartMusic() {
    if (!want || musicVoice || song?.name !== want || !song.buffer) return
    if (ctx.state !== 'running') { tryResume(); return } // running になったら onState から再試行
    const name = want
    const source = ctx.createBufferSource()
    source.buffer = song.buffer
    const gain = ctx.createGain()
    source.connect(gain)
    gain.connect(channelGain.music)
    const voice = { source, gain, name }
    musicVoice = voice
    const now = ctx.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + ATTACK_MS / 1000)
    source.onended = () => {
      source.disconnect()
      gain.disconnect()
      if (musicVoice === voice) musicVoice = null
    }
    source.start(now)
  }

  const playMusic = (name: MusicName) => {
    want = name
    if (musicVoice && musicVoice.name !== name) { fadeOut(musicVoice, FADE_REPLACE_MS); musicVoice = null }
    if (song?.name !== name) preload(name)
    tryResume()
    tryStartMusic()
  }

  const stopMusic = () => {
    want = null
    if (musicVoice) fadeOut(musicVoice, FADE_STOP_MS)
    musicVoice = null
  }

  const play = (name: SoundName) => {
    if (isMusic(name)) return playMusic(name)
    tryResume()
    const buffer = buffers.get(name)
    if (!buffer || ctx.state !== 'running') return
    const ch = CHANNEL[name]
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    source.connect(gain)
    gain.connect(channelGain[ch])
    const voice: Voice = { source, gain }
    const now = ctx.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + ATTACK_MS / 1000)
    if (ch === 'footstep') {
      if (footstep) fadeOut(footstep, FADE_REPLACE_MS)
      footstep = voice
    } else if (ch === 'opening') {
      if (opening) fadeOut(opening, FADE_REPLACE_MS)
      opening = voice
    } else if (ch === 'type') {
      typeVoices.push(voice)
      if (typeVoices.length > MAX_TYPE_VOICES) fadeOut(typeVoices.shift()!, FADE_REPLACE_MS)
    }
    source.onended = () => {
      source.disconnect()
      gain.disconnect()
      if (footstep === voice) footstep = null
      if (opening === voice) opening = null
      const i = typeVoices.indexOf(voice)
      if (i >= 0) typeVoices.splice(i, 1)
    }
    source.start(now)
  }

  const stopWorld = () => {
    if (footstep) fadeOut(footstep, FADE_STOP_MS)
    if (opening) fadeOut(opening, FADE_STOP_MS)
    footstep = null
    opening = null
  }

  return {
    play,
    stopWorld,
    stopMusic,
    preload,
    setMuted: (muted) => {
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime)
    },
    dispose: () => {
      detach()
      ctx.removeEventListener('statechange', onState)
      void ctx.close().catch(() => {})
    },
  }
}

const createBackend = (): Backend => {
  try {
    const Ctor = typeof window === 'undefined' ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    return Ctor ? createWebAudioBackend(new Ctor()) : noopBackend
  } catch {
    return noopBackend
  }
}

// ミュート状態の保存。既定はミュート（職場・夜中で突然鳴らさない）。'0'（明示的にON）のときだけ音あり。
// キー無し・'1'・未知値・読めない場合はミュート。保存できない環境では毎回OFFから始まる
const loadMuted = (): boolean => {
  try { return localStorage.getItem(MUTED_KEY) !== '0' } catch { return true }
}
const saveMuted = (muted: boolean) => {
  try { localStorage.setItem(MUTED_KEY, muted ? '1' : '0') } catch { /* 保存できなくても動く */ }
}

const createSound = () => {
  const backend = createBackend()
  let muted = loadMuted()
  const listeners = new Set<() => void>()
  backend.setMuted(muted)
  return {
    play: (name: SoundName) => { if (!muted || isMusic(name)) backend.play(name) }, // 曲だけはミュート中も進める（master gain 0 で無音）
    stopWorld: () => backend.stopWorld(),
    stopMusic: () => backend.stopMusic(),
    preload: (name: MusicName) => backend.preload(name),
    // ミュートは master gain 0 + stopWorld。以降 play は曲以外何もしない
    setMuted: (next: boolean) => {
      if (next === muted) return
      muted = next
      saveMuted(muted)
      backend.setMuted(muted)
      if (muted) backend.stopWorld()
      listeners.forEach((l) => l())
    },
    isMuted: () => muted,
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } },
    dispose: () => backend.dispose(),
  }
}

// モジュールシングルトン（StrictMode で二重に作らない）
export const sound = createSound()

import.meta.hot?.dispose(() => sound.dispose())
