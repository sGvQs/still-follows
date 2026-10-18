import backroomRaw from '../assets/room/backroom.txt?raw'
import libraryRaw from '../assets/room/library.txt?raw'
import outsideRaw from '../assets/room/outside.txt?raw'
import type { Difficulty } from './difficulty'
import { toGrid, type Grid } from './grid'

// 難易度ごとの room。モジュール読み込み時に1回だけ toGrid する
export const ROOMS: Record<Difficulty, Grid> = {
  EASY: toGrid(outsideRaw),
  NORMAL: toGrid(libraryRaw),
  HARD: toGrid(backroomRaw),
}
