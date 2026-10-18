import { APPROACH_BASE, APPROACH_MAX, APPROACH_MIN, APPROACH_PER_CHAR } from './config'

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD'

export const DIFFICULTIES: Difficulty[] = ['EASY', 'NORMAL', 'HARD']
export const DEFAULT_DIFFICULTY: Difficulty = 'EASY'

// 接近時間（秒）= clamp(base + 最短打鍵数 × perChar, min, max)。60秒（SURVIVE_MS）・HP は全難易度共通
export type Approach = { base: number; perChar: number; min: number; max: number }

export type DifficultyConfig = {
  label: string
  showLevel: boolean // リザルトに階級を出すか
  approach: Approach
  boss: boolean // ゲーム開始時にボス種を選び、WARNING を出すか
}

const DEFAULT_APPROACH: Approach = { base: APPROACH_BASE, perChar: APPROACH_PER_CHAR, min: APPROACH_MIN, max: APPROACH_MAX }

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  EASY: { label: 'EASY', showLevel: true, boss: false, approach: { ...DEFAULT_APPROACH } },
  NORMAL: { label: 'NORMAL', showLevel: true, boss: false, approach: { ...DEFAULT_APPROACH } },
  HARD: { label: 'HARD', showLevel: true, boss: true, approach: { ...DEFAULT_APPROACH } },
}
