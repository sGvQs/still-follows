import {
  BOSS_GUARANTEE_WITHIN, BUFF_SPEED, COUNTIN_MS, HIT_FLASH_MS, WARNING_MS, PLAYER_HP, SURVIVE_MS, GAMEOVER_EFFECT_STEPS_X, GAMEOVER_EFFECT_STEPS_Y, GAMEOVER_EFFECT_STEP_MS, GAP_MS, MISTAKE_PENALTY_KANA, SHRINK_FLOOR, SHRINK_PER_KILL,
} from './config'
import { DEFAULT_DIFFICULTY, DIFFICULTIES, DIFFICULTY_CONFIG, type Approach, type Difficulty } from './difficulty'
import { ENEMIES } from './faces'
import { createMatcher, shortestLength, type Matcher } from './romaji'
import { bossPool, createEnemyBag } from './spawn'
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from './language'
import { createWordBag, type Bag, type Word, type WordEntry } from './words'

export type Phase = 'TITLE' | 'COUNTIN' | 'WARNING' | 'APPROACH' | 'GAP' | 'DYING' | 'RESULT'

export type GameResult = { language: Language; difficulty: Difficulty; outcome: 'clear' | 'gameover'; kills: number; keystrokes: number; mistakes: number; kana: number; netKana: number; activeMs: number }

export type Progress = { spelling: string; typed: number; kana: number }

export type Snapshot = {
  phase: Phase
  language: Language // お題の言語。TITLE で選び、開始中・結果表示中はそのゲームの言語
  difficulty: Difficulty // 開始中・結果表示中はそのゲームの難易度。TITLE 中は最後に選んだ難易度（タイトル背景の room に使う）
  stage: number // APPROACH / DYING 中は 0..n-1（顔の段階。DYING は被弾時点）、WARNING 中は最大段階 n-1、それ以外は -1
  enemy: number // APPROACH / DYING 中は ENEMIES の index（敵の種類。DYING は被弾時点）、WARNING 中はボス種、それ以外は -1
  enemyId: number // このゲームで敵を出した通し番号（1始まり）。TITLE・敵が出る前は 0。GAP・終了後も直前の値を保持し、次の敵が出た瞬間に +1（同じ種類が続いても変わる）
  boss: number // そのゲームのボス種（ENEMIES の index）。ボスのない難易度、または TITLE では -1
  buffed: boolean // APPROACH / DYING で enemy がボス種のとき true（GAP・WARNING・その他は false。DYING は表示を残す）
  effectScaleX: number | null // DYING のみ演出の横スケール（絶対値）、それ以外は null
  effectScaleY: number | null // DYING のみ演出の縦スケール（絶対値）、それ以外は null
  revision: number // 状態が変わるたびに増える（UIの変化検出用）
  word: Word | null
  progress: Progress | null
  kills: number
  keystrokes: number // 正しく受理された打鍵の累計
  result: GameResult | null // RESULT のとき非 null
  composing: boolean
  hp: number
  maxHp: number
  flash: boolean // 被弾の一瞬（青と白を反転する間）
  remainingSec: number // 残り秒数（切り上げ、0 以上）。COUNTIN / WARNING 中は未開始なので満タン、DYING は被弾時点で止まる
}

export type KeyResult = 'ignored' | 'reject' | 'accept' | 'kill'

export type EngineOptions = {
  stageCount: number
  bag?: Bag<WordEntry> // 指定時は全難易度で同じ bag を使う（bags より優先）
  bags?: Record<Difficulty, Bag<WordEntry>>
  enemyBag?: Bag<number> // 指定時は全難易度で同じ enemyBag を使う（enemyBags より優先）。kind（cute / horror）は保証されない
  enemyBags?: Record<Difficulty, Bag<number>>
  rng?: () => number
  pickBoss?: (pool: number[]) => number // ボス種の抽選。pool は候補の ENEMIES index 群、戻りも ENEMIES の index（プール内位置ではない）。既定は rng から作る
  playerHp?: number // 既定 PLAYER_HP
  surviveMs?: number // 既定 SURVIVE_MS
}

// approach 省略時は既定の難易度（現行値と同じ）の設定を使う
// speed は clamp と SHRINK の後で割る（MIN を先に適用してから割る）
export const approachSeconds = (shortest: number, kills: number, approach: Approach = DIFFICULTY_CONFIG[DEFAULT_DIFFICULTY].approach, speed = 1): number => {
  const t0 = Math.min(approach.max, Math.max(approach.min, approach.base + shortest * approach.perChar))
  return (t0 * Math.max(SHRINK_FLOOR, 1 - SHRINK_PER_KILL * kills)) / speed
}

export const stageAt = (elapsedMs: number, seconds: number, n: number): number =>
  Math.max(0, Math.min(n - 1, Math.floor((elapsedMs / (seconds * 1000)) * n)))

export const createEngine = (opts: EngineOptions) => {
  const n = opts.stageCount
  // 難易度ごとに1つずつ保持し、start で作り直さない
  // bag / bags を指定したときは言語に関わらずそれを使う
  const bagsByLanguage: Record<Language, Record<Difficulty, Bag<WordEntry>>> = Object.fromEntries(LANGUAGES.map((l) => [l, opts.bag
    ? { EASY: opts.bag, NORMAL: opts.bag, HARD: opts.bag }
    : opts.bags ?? Object.fromEntries(DIFFICULTIES.map((d) => [d, createWordBag(opts.rng, d, l)]))])) as Record<Language, Record<Difficulty, Bag<WordEntry>>>
  // 難易度ごとに1つずつ保持し、start で作り直さない。優先順位は enemyBag > enemyBags > 既定
  const enemyBags: Record<Difficulty, Bag<number>> = opts.enemyBag
    ? { EASY: opts.enemyBag, NORMAL: opts.enemyBag, HARD: opts.enemyBag }
    : opts.enemyBags ?? Object.fromEntries(DIFFICULTIES.map((d) => [d, createEnemyBag(d, opts.rng ?? Math.random, ENEMIES)])) as Record<Difficulty, Bag<number>>

  const rng = opts.rng ?? Math.random
  const pickBoss = opts.pickBoss ?? ((pool: number[]) => pool[Math.floor(rng() * pool.length)])

  const maxHp = opts.playerHp ?? PLAYER_HP
  const surviveMs = opts.surviveMs ?? SURVIVE_MS
  let hp = maxHp
  let survivedStartAt = -1 // 最初の APPROACH の理論開始時刻（-1 = 未開始）
  let flashUntil = 0 // 0 = フラッシュなし
  let phase: Phase = 'TITLE'
  let difficulty: Difficulty = DEFAULT_DIFFICULTY // 現在（または直近）のゲームの難易度。start が成功したときだけ更新し、toTitle でも消さない
  let language: Language = DEFAULT_LANGUAGE // 次に始める（または直近の）ゲームの言語。TITLE 中だけ setLanguage で変えられる
  let phaseStartAt = 0
  let kills = 0
  let keystrokes = 0
  let mistakes = 0 // APPROACH 中の誤入力（reject）の累計
  let kana = 0 // 撃破した語の読みのかな数の累計
  let netKana = 0 // 純かな数。撃破した語ごとに max(0, かな数 − 語内の誤入力数 × MISTAKE_PENALTY_KANA) を加算。撃破できなかった語の誤入力は含めない
  let wordMistakes = 0 // 現在の語での誤入力数（語が切り替わる時に 0 に戻す）
  let activeMs = 0 // 撃破した語を打っていた時間（APPROACH 開始から撃破まで）の累計。撃破できなかった語・GAP・COUNTIN は含めない
  let result: GameResult | null = null
  let entry: WordEntry | null = null
  let matcher: Matcher | null = null
  let limitMs = 0
  let dyingStage = 0
  let boss = -1 // そのゲームのボス種（-1 = なし）
  let spawned = 0 // このゲームで出した敵の数（BOSS_GUARANTEE_WITHIN まで数える）
  let bossSeen = false // このゲームでボス種が出たか
  // 敵の通し番号。spawned（ボス保証用に WITHIN 体で数えるのをやめる）とは別物
  // 不変条件: nextWord() の呼び出し元は begin と tick の GAP→APPROACH だけで、どちらも直後に touch() するため、
  // enemyId の変化は revision で検出できる（UI 側の変化検出に enemyId を足さなくてよい）
  let enemyId = 0
  let enemy = -1 // 現在の敵。被弾時点のものが GAP 終了まで維持される
  let composing = false
  let revision = 0

  const touch = () => { revision += 1 }

  const nextWord = () => {
    entry = bagsByLanguage[language][difficulty].next()
    enemyId += 1
    wordMistakes = 0
    enemy = enemyBags[difficulty].next()
    // HARD のボス保証: WITHIN 体目までにボス種が出ていなければ、WITHIN 体目をボス種にする（bag の消費は変えない）
    if (boss >= 0 && spawned < BOSS_GUARANTEE_WITHIN) {
      spawned += 1
      if (enemy === boss) bossSeen = true
      else if (spawned === BOSS_GUARANTEE_WITHIN && !bossSeen) enemy = boss
    }
    matcher = createMatcher(entry.compiled)
    limitMs = approachSeconds(shortestLength(entry.compiled), kills, DIFFICULTY_CONFIG[difficulty].approach, enemy === boss ? BUFF_SPEED : 1) * 1000
  }

  const dyingTotalMs = () => GAMEOVER_EFFECT_STEPS_X.length * GAMEOVER_EFFECT_STEP_MS

  // 'gameover' は結果を確定して DYING（演出）へ、'clear' は直接 RESULT へ。at は遷移の基準時刻
  const finish = (outcome: GameResult['outcome'], at: number) => {
    result = { language, difficulty, outcome, kills, keystrokes, mistakes, kana, netKana, activeMs: survivedStartAt < 0 ? 0 : activeMs }
    flashUntil = 0
    if (outcome === 'gameover') {
      dyingStage = n - 1
      phase = 'DYING'
      phaseStartAt = at
    } else {
      phase = 'RESULT'
      entry = null
      matcher = null
      enemy = -1
      limitMs = 0
    }
    touch()
  }

  // 現在のフェーズが次に遷移する理論時刻（遷移しないフェーズは null）
  const nextEventAt = (): number | null => {
    if (phase === 'COUNTIN') return phaseStartAt + COUNTIN_MS
    if (phase === 'WARNING') return phaseStartAt + WARNING_MS
    if (phase === 'APPROACH') return phaseStartAt + limitMs
    if (phase === 'GAP') return phaseStartAt + GAP_MS
    if (phase === 'DYING') return phaseStartAt + dyingTotalMs()
    return null
  }

  // 時間経過によるフェーズ遷移・時間切れ判定。イベント時刻の早い順に処理し、同時刻は clear 優先
  const tick = (now: number): Phase => {
    if (flashUntil > 0 && now >= flashUntil) { flashUntil = 0; touch() }
    for (;;) {
      const ev = nextEventAt()
      if (ev === null) break
      const clearAt = survivedStartAt >= 0 && (phase === 'APPROACH' || phase === 'GAP') ? survivedStartAt + surviveMs : Infinity
      if (clearAt <= ev && clearAt <= now) {
        finish('clear', clearAt)
      } else if (ev > now) {
        break
      } else if (phase === 'COUNTIN' || phase === 'WARNING') {
        phaseStartAt = ev
        survivedStartAt = ev
        phase = 'APPROACH'
        touch()
      } else if (phase === 'GAP') {
        phaseStartAt = ev
        nextWord()
        phase = 'APPROACH'
        touch()
      } else if (phase === 'APPROACH') {
        // ボス種の敵は HP に関係なく一撃（被弾フラッシュなしで gameover）
        hp = enemy === boss ? 0 : hp - 1
        if (hp > 0) {
          phaseStartAt = ev
          phase = 'GAP'
          enemy = -1
          if (ev + HIT_FLASH_MS > now) flashUntil = ev + HIT_FLASH_MS
          touch()
        } else {
          finish('gameover', ev)
        }
      } else {
        phase = 'RESULT'
        touch()
      }
    }
    return phase
  }

  const begin = (now: number) => {
    kills = 0
    keystrokes = 0
    mistakes = 0
    kana = 0
    netKana = 0
    wordMistakes = 0
    activeMs = 0
    hp = maxHp
    survivedStartAt = -1
    flashUntil = 0
    result = null
    boss = DIFFICULTY_CONFIG[difficulty].boss ? pickBoss(bossPool(ENEMIES)) : -1 // nextWord（最初の語と敵の決定）より前に抽選する
    spawned = 0
    bossSeen = false
    enemyId = 0
    nextWord()
    phase = DIFFICULTY_CONFIG[difficulty].boss ? 'WARNING' : 'COUNTIN'
    phaseStartAt = now
    touch()
  }

  const start = (now: number, selected: Difficulty = difficulty): boolean => {
    if (phase === 'TITLE') {
      difficulty = selected // begin が touch() で revision を進める
      begin(now)
      return true
    }
    return false
  }

  const setLanguage = (selected: Language): boolean => {
    if (phase !== 'TITLE') return false
    if (selected !== language) { language = selected; touch() }
    return true
  }

  const toTitle = (): boolean => {
    if (phase !== 'RESULT') return false
    kills = 0
    keystrokes = 0
    mistakes = 0
    kana = 0
    netKana = 0
    wordMistakes = 0
    activeMs = 0
    hp = maxHp
    survivedStartAt = -1
    flashUntil = 0
    result = null
    entry = null
    enemy = -1
    boss = -1
    enemyId = 0
    matcher = null
    limitMs = 0
    composing = false
    phase = 'TITLE'
    touch()
    return true
  }

  // IME 検知。キーは無視するだけで、ゲームは止めない（composing は TITLE の警告表示に使う）
  const imeDetected = () => {
    composing = true
    touch()
  }

  const clearComposing = () => {
    if (composing) { composing = false; touch() }
  }

  const handleKey = (now: number, key: string, isComposing = false): KeyResult => {
    if (isComposing || key === 'Process' || key === 'Unidentified') {
      imeDetected()
      return 'ignored'
    }
    if (composing) clearComposing()
    if (key.length !== 1) return 'ignored'
    tick(now)
    if (phase !== 'APPROACH' || !matcher) return 'ignored'
    const before = matcher.typedLength
    const r = matcher.feed(key)
    if (r === 'reject') { mistakes += 1; wordMistakes += 1; return 'reject' }
    keystrokes += 1
    if (r === 'accept') { if (matcher.typedLength !== before) touch(); return 'accept' }
    kills += 1
    const wordKana = entry ? entry.compiled.reading.length : 0
    kana += wordKana
    netKana += Math.max(0, wordKana - wordMistakes * MISTAKE_PENALTY_KANA)
    activeMs += Math.max(0, now - phaseStartAt)
    phase = 'GAP'
    phaseStartAt = now
    touch()
    return 'kill'
  }

  const getSnapshot = (now: number): Snapshot => {
    let stage = -1
    let shownEnemy = -1
    let effectScaleX: number | null = null
    let effectScaleY: number | null = null
    if (phase === 'WARNING') { stage = n - 1; shownEnemy = boss }
    if (phase === 'APPROACH') { stage = stageAt(now - phaseStartAt, limitMs / 1000, n); shownEnemy = enemy }
    if (phase === 'DYING') {
      stage = dyingStage
      shownEnemy = enemy
      const steps = GAMEOVER_EFFECT_STEPS_X
      if (steps.length > 0) {
        const i = Math.floor((now - phaseStartAt) / GAMEOVER_EFFECT_STEP_MS)
        const k = Math.max(0, Math.min(steps.length - 1, i))
        effectScaleX = steps[k]
        effectScaleY = GAMEOVER_EFFECT_STEPS_Y[k]
      }
    }

    let remainingMs = surviveMs
    if (survivedStartAt >= 0) {
      const at = phase === 'DYING' ? phaseStartAt : now
      remainingMs = Math.max(0, survivedStartAt + surviveMs - at)
    }

    const showWord = phase !== 'TITLE' && phase !== 'GAP' && phase !== 'WARNING'
    return {
      phase,
      language,
      difficulty,
      stage,
      enemy: shownEnemy,
      enemyId,
      boss,
      buffed: (phase === 'APPROACH' || phase === 'DYING') && enemy === boss,
      effectScaleX,
      effectScaleY,
      revision,
      word: showWord && entry ? entry.word : null,
      progress: showWord && matcher ? matcher.preferredRemaining() : null,
      kills,
      keystrokes,
      result,
      composing,
      hp,
      maxHp,
      flash: flashUntil > 0 && now < flashUntil,
      remainingSec: Math.ceil(remainingMs / 1000),
    }
  }

  return {
    start, setLanguage, toTitle, finish, handleKey, tick, imeDetected, clearComposing, getSnapshot,
    // テスト・診断用の内部値
    get phaseStartAt() { return phaseStartAt },
    get limitMs() { return limitMs },
  }
}

export type Engine = ReturnType<typeof createEngine>
