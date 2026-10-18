import type { Difficulty } from '../game/difficulty'
import type { KeyResult, Snapshot } from '../game/engine'
import type { MusicName, SoundName, SoundPlayer } from './player'

// ゲーム状態 → 再生の対応。素材が増えたら、該当する分岐に play を1行足す
// 誤入力・撃破・被弾は今は無音（素材待ち）。ゲームオーバー・クリアは RESULT 入りで難易度別のリザルト曲

// 前回の観測からこれ以上空いたら、鳴らさず状態だけ現在値へ同期する（背面タブ復帰・処理落ちで足音が溜まって鳴るのを防ぐ）
// 仕様として「その間は鳴らさない」。GAP_MS（敵の間隔）とは無関係の独立した値
export const SOUND_SYNC_GAP_MS = 300

const TYPE_SOUNDS: SoundName[] = ['type-a', 'type-b', 'type-c']

// 敵が近づく足音。EASY は無し
const FOOTSTEP: Record<Difficulty, SoundName | null> = { EASY: null, NORMAL: 'normal-footstep', HARD: 'hard-footstep' }

// リザルト曲。Record なので難易度を足すと曲の指定漏れが型エラーになる
const RESULT_MUSIC: Record<Difficulty, MusicName> = { EASY: 'result-easy', NORMAL: 'result-normal', HARD: 'result-hard' }

type Seen = Pick<Snapshot, 'phase' | 'enemyId' | 'stage' | 'difficulty'>

export const createSoundRouter = (player: SoundPlayer, rng: () => number = Math.random) => {
  let prev: Seen | null = null
  let lastAt = -Infinity // 前回 onSnap（または onBegin）の時刻。onKeyDown 経由の sync も onSnap を呼ぶので両経路で更新される
  let lastType = -1 // 直前の打鍵音の添字

  const remember = (snap: Snapshot, now: number) => {
    prev = { phase: snap.phase, enemyId: snap.enemyId, stage: snap.stage, difficulty: snap.difficulty }
    lastAt = now
  }

  // 開始の瞬間。HARD の WARNING 開始なら開幕音
  const onBegin = (snap: Snapshot, now: number) => {
    remember(snap, now)
    player.stopMusic() // 防御: 前の曲が残っていても止める
    player.preload(RESULT_MUSIC[snap.difficulty]) // 選択難易度の1曲だけ先読み
    if (snap.difficulty === 'HARD' && snap.phase === 'WARNING') player.play('hard-opening')
  }

  // 正解打鍵（accept と最後の1打鍵の kill）で打鍵音。reject / ignored は無音
  const onKey = (result: KeyResult) => {
    if (result !== 'accept' && result !== 'kill') return
    if (result === 'kill') player.stopWorld() // 撃破の直後に足音を切る（撃破音は素材待ち）
    lastType = (lastType + 1 + Math.floor(rng() * 2)) % TYPE_SOUNDS.length // 直前と同じ音を連続させない
    player.play(TYPE_SOUNDS[lastType])
  }

  const onSnap = (snap: Snapshot, now: number) => {
    const before = prev
    const synced = before === null || now - lastAt >= SOUND_SYNC_GAP_MS
    remember(snap, now)
    if (before === null) return

    // 止める: 撃破・被弾（APPROACH を出る）と、DYING / RESULT / TITLE 入り。WARNING 中の開幕音は止めない
    if (snap.phase !== before.phase && snap.phase !== 'COUNTIN' && snap.phase !== 'WARNING' && snap.phase !== 'APPROACH') {
      player.stopWorld()
    }
    // リザルト曲: 同期ガード（背面タブ復帰など）を超えていても、RESULT 入りなら鳴らす
    if (snap.phase !== before.phase) {
      if (snap.phase === 'RESULT') player.play(RESULT_MUSIC[snap.difficulty])
      else if (before.phase === 'RESULT') player.stopMusic()
    }
    if (synced) return

    // 足音: 同じ敵の APPROACH 内で stage が進んだとき。
    // 敵の出現（別の phase から APPROACH に入る stage 0）は鳴らさない。出現でも鳴らしたいなら、ここに出現用の分岐を1行足す
    // （COUNTIN / GAP / WARNING 中も enemyId は有効なので、開始直後の誤爆は before.phase === 'APPROACH' の条件で除いている）
    if (before.phase === 'APPROACH' && snap.phase === 'APPROACH' && before.enemyId === snap.enemyId && snap.stage > before.stage && before.stage >= 0) {
      const name = FOOTSTEP[snap.difficulty]
      if (name) player.play(name)
    }
  }

  return { onBegin, onKey, onSnap }
}

export type SoundRouter = ReturnType<typeof createSoundRouter>
