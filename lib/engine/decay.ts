import { DECAY_GRACE, DECAY_RATE } from '@/constants/points'
import { daysBetween } from './cutoff'

/**
 * Apply rank XP decay: 2%/day after 3-day grace period.
 * Returns new rankXP value.
 */
export function applyRankDecay(
  rankXP: number,
  lastActiveDay: string | null,
  today: string,
  isPaused: boolean
): number {
  if (isPaused || !lastActiveDay) return rankXP

  const diff = daysBetween(lastActiveDay, today)
  if (diff <= DECAY_GRACE) return rankXP

  const decayDays = diff - DECAY_GRACE
  return Math.floor(rankXP * Math.pow(DECAY_RATE, decayDays))
}
