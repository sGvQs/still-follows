import { compile, compileEnglish, type CompiledWord } from '../romaji'
import { DEFAULT_DIFFICULTY, type Difficulty } from '../difficulty'
import { DEFAULT_LANGUAGE, type Language } from '../language'
import { EASY_WORDS } from './easy'
import { EASY_WORDS_EN } from './easy_en'
import { HARD_WORDS } from './hard'
import { HARD_WORDS_EN } from './hard_en'
import { NORMAL_WORDS } from './normal'
import { NORMAL_WORDS_EN } from './normal_en'
import type { Rng, Word } from './types'

export type { Rng, Word }
export type WordEntry = { word: Word; compiled: CompiledWord }

export const WORDS_BY_DIFFICULTY: Record<Difficulty, Word[]> = { EASY: EASY_WORDS, NORMAL: NORMAL_WORDS, HARD: HARD_WORDS }

// 起動時に全語をコンパイルし、失敗は例外にする
export const WORD_ENTRIES_BY_DIFFICULTY: Record<Difficulty, WordEntry[]> = {
  EASY: EASY_WORDS.map((word) => ({ word, compiled: compile(word.reading) })),
  NORMAL: NORMAL_WORDS.map((word) => ({ word, compiled: compile(word.reading) })),
  HARD: HARD_WORDS.map((word) => ({ word, compiled: compile(word.reading) })),
}

export const WORDS_EN_BY_DIFFICULTY: Record<Difficulty, Word[]> = { EASY: EASY_WORDS_EN, NORMAL: NORMAL_WORDS_EN, HARD: HARD_WORDS_EN }

export const WORD_ENTRIES_EN_BY_DIFFICULTY: Record<Difficulty, WordEntry[]> = {
  EASY: EASY_WORDS_EN.map((word) => ({ word, compiled: compileEnglish(word.reading) })),
  NORMAL: NORMAL_WORDS_EN.map((word) => ({ word, compiled: compileEnglish(word.reading) })),
  HARD: HARD_WORDS_EN.map((word) => ({ word, compiled: compileEnglish(word.reading) })),
}

export const WORD_ENTRIES_BY_LANGUAGE: Record<Language, Record<Difficulty, WordEntry[]>> = { JA: WORD_ENTRIES_BY_DIFFICULTY, EN: WORD_ENTRIES_EN_BY_DIFFICULTY }

const shuffle = <T,>(xs: T[], rng: Rng): T[] => {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export type Bag<T> = { next: () => T }

// シャッフルバッグ: 1周内重複なし、再充填時に直前の要素を先頭にしない
export const createBag = <T,>(entries: T[], rng: Rng = Math.random): Bag<T> => {
  let queue: T[] = []
  let last: T | null = null
  const refill = () => {
    queue = shuffle(entries, rng)
    if (entries.length > 1 && queue[0] === last) {
      const j = 1 + Math.floor(rng() * (queue.length - 1))
      ;[queue[0], queue[j]] = [queue[j], queue[0]]
    }
  }
  return {
    next: () => {
      if (queue.length === 0) refill()
      const e = queue.shift() as T
      last = e
      return e
    },
  }
}

export const createWordBag = (rng: Rng = Math.random, difficulty: Difficulty = DEFAULT_DIFFICULTY, language: Language = DEFAULT_LANGUAGE): Bag<WordEntry> =>
  createBag(WORD_ENTRIES_BY_LANGUAGE[language][difficulty], rng)
