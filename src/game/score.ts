import { LEVELS, RESULT_MIN_ACTIVE_MS } from './config'

const WPM_CHARS_PER_WORD = 5

type Level = { min: number; label: string }

export const accuracy = (keystrokes: number, mistakes: number): number | null => {
  const total = keystrokes + mistakes
  return total > 0 ? (keystrokes / total) * 100 : null
}

export const kanaPerMinute = (kana: number, activeMs: number, minActiveMs = RESULT_MIN_ACTIVE_MS): number | null =>
  activeMs > 0 && activeMs >= minActiveMs ? kana / (activeMs / 60000) : null

// 基準以上の最上位の級。基準未満は null（呼び出し側で「未満」と表示）。levels は min の大きい順
export const levelOf = (speed: number, levels: Level[] = LEVELS): string | null =>
  levels.find((l) => speed >= l.min)?.label ?? null

// 英語版の速度（WPM）。5 文字 = 1 語として、純文字数と打っていた時間から求める
export const wordsPerMinute = (chars: number, activeMs: number, minActiveMs = RESULT_MIN_ACTIVE_MS): number | null => {
  const cpm = kanaPerMinute(chars, activeMs, minActiveMs)
  return cpm === null ? null : cpm / WPM_CHARS_PER_WORD
}

// 階級を出すか。クリア時のみで、難易度の設定（showLevel）が true のとき
export const showsLevel = (result: { outcome: 'clear' | 'gameover' }, showLevel: boolean): boolean =>
  showLevel && result.outcome === 'clear'

// 修飾キー付きの打鍵（Cmd+C など）はゲームに渡さない
export const hasModifier = (e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean =>
  e.ctrlKey || e.metaKey || e.altKey
