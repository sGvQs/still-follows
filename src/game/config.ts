// ゲーム設定値（秒の単位に注意: APPROACH_* は秒、*_MS はミリ秒）
export const APPROACH_BASE = 3.5
export const APPROACH_PER_CHAR = 0.5
export const APPROACH_MIN = 5
export const APPROACH_MAX = 18
export const SHRINK_PER_KILL = 0
export const SHRINK_FLOOR = 0.5
export const GAP_MS = 300
export const COUNTIN_MS = 800
export const WARNING_MS = 3000 // ボスのある難易度（HARD）の開始前に WARNING を出す時間（COUNTIN の代わり）
export const BUFF_SPEED = 2 // ボス種の敵の接近速度の倍率（接近時間は 1/BUFF_SPEED）
export const BOSS_GUARANTEE_WITHIN = 6 // HARD で最初のこの体数の中に、ボス種を必ず1回以上出す
export const PLAYER_HP = 3 // 許容する被弾回数 + 1（0 になったらゲームオーバー）
export const SURVIVE_MS = 60000 // COUNTIN / WARNING 後この時間生き延びたらクリア
export const HIT_FLASH_MS = 200 // 被弾時に青と白を反転する時間
export const V_SCALE = 0.8
export const H_SCALE = 0.6
export const GAMEOVER_EFFECT_STEPS_X = [2, 3, 4, 5] // 被弾演出の横スケール（絶対値、段階順）
export const GAMEOVER_EFFECT_STEPS_Y = [2, 3, 4, 5] // 被弾演出の縦スケール（絶対値、段階順。X と同じ段数）
if (GAMEOVER_EFFECT_STEPS_X.length !== GAMEOVER_EFFECT_STEPS_Y.length) {
  throw new Error('GAMEOVER_EFFECT_STEPS_X と GAMEOVER_EFFECT_STEPS_Y の段数が一致していません')
}
export const GAMEOVER_EFFECT_STEP_MS = 150 // 演出1段階の長さ
export const CHAR_RATIO = 0.6
export const ROOM_BOTTOM_MARGIN_ROWS = 8 // room の下に入れる余白の行数（背景色のまま）
export const HP_ABOVE_ROOM_PX = 8 // HP 表示の下端を room の上端からこの分だけ上に置く
export const HP_TEXT_PX = 12 // HP 表示の文字サイズ（Press Start 2P）
export const WARNING_GAP_RATIO = 0.025// WARNING 中の顔の下端と帯の上端の間隔（画面高さ比）
export const WARNING_EDGE_RATIO = 0.04 // WARNING 中の顔・帯の上下に空ける余白（画面高さ比）
export const WARNING_BAND_MAX_H_RATIO = 0.18 // WARNING の帯の高さの上限（上下余白を除いた画面高さ比）。効くと帯は顔より狭くなる
export const TOPIC_BOTTOM_OFFSET_PX = 12 // お題の下端を room の下端からこの分だけ上に置く

// 色（出典: 旧 index.html / dist/index.html の body と HEAD の styles.css の --color-bg / --color-text / --color-text-secondary）
export const COLOR_BG = '#1a4a8a'
export const COLOR_FG = '#ffffff'
export const COLOR_DIM = 'rgba(255, 255, 255, 0.7)'
export const FONT_JP = "'DotGothic16'" // 日本語表示専用（index.html で読み込み。フォールバックなし）
export const FONT_EN = "'Press Start 2P'" // 英字・数字の表示専用（index.html で読み込み。フォールバックなし）
// ASCII アート（room・顔・title.txt の pre）専用。文字幅比 CHAR_RATIO(0.6) とブロック文字のため等幅のまま
export const FONT_MONO = 'Menlo, Consolas, "Courier New", monospace'

// リザルトの階級の目安
// 出典: 提供された認定基準（10分間の純字数。団体名は未確認、一次資料未確認。受領確認日 2026-10-16）を、10で割って1分あたりに直した値。
// ゲームの「純かな」は純字数の近似であり、検定の判定とは一致しない。min は 純かな/分 の下限。大きい順に並べる
export const LEVELS = [
  { min: 200, label: '特段' },
  { min: 150, label: '初段' },
  { min: 100, label: '1級' },
  { min: 80, label: '準1級' },
  { min: 60, label: '2級' },
  { min: 45, label: '準2級' },
  { min: 35, label: '3級' },
  { min: 25, label: '4級' },
  { min: 10, label: '5級' },
  { min: 5, label: '6級' },
]
export const MISTAKE_PENALTY_KANA = 1 // 誤入力1回につき、撃破した語のかな数から引く量（語ごとに0未満にはならない）
export const RESULT_MIN_ACTIVE_MS = 10000 // 速度を出すのに必要な活動時間の下限（未満は「-」）
export const NORMAL_HORROR_RATE = 0.2 // NORMAL で敵1体ごとに horror から選ぶ確率（それ以外は cute）
