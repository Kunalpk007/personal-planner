import type { AppConfig, Mood } from '@/store/types'
import {
  LIGHT_DAY_XP_PENALTY, REST_DAY_XP_PENALTY, STREAK_BROKEN_XP_PENALTY,
  SICK_ALLOWANCE_PER_MONTH,
} from '@/constants/points'

/** How many of the sick-mood days in dateStr's calendar month, up to and
 *  including dateStr, have already occurred (chronological count, not just
 *  a running total) — used to decide whether THIS sick day still falls
 *  within the free monthly allowance. */
export function sickCountThisMonth(mood: Record<string, Mood>, dateStr: string): number {
  const monthPrefix = dateStr.slice(0, 7)
  return Object.entries(mood)
    .filter(([d, m]) => m === 'sick' && d.slice(0, 7) === monthPrefix && d <= dateStr)
    .length
}

/** True when dateStr's mood is 'sick' AND it falls within the free monthly
 *  allowance — such a day gets NO XP penalty regardless of what it would
 *  otherwise have been classified as (light/rest/broken-streak). A sick day
 *  beyond the allowance falls through to normal classification instead. */
export function isSickExempt(mood: Record<string, Mood>, dateStr: string): boolean {
  if (mood[dateStr] !== 'sick') return false
  return sickCountThisMonth(mood, dateStr) <= SICK_ALLOWANCE_PER_MONTH
}

export function isLightDay(dateStr: string, cfg: Pick<AppConfig, 'lightDays'>): boolean {
  const day = new Date(`${dateStr}T12:00:00`).getDay()
  return (cfg.lightDays ?? [0, 6]).includes(day)
}

/** XP penalty for a day that was auto-protected by a rest day (streak held,
 *  target missed) — the milder Light Day rate if it was a configured light
 *  day, the regular rest-day rate otherwise. Sick-exempt days are always 0. */
export function restOrLightXpPenalty(
  dateStr: string, cfg: Pick<AppConfig, 'lightDays'>, mood: Record<string, Mood>
): number {
  if (isSickExempt(mood, dateStr)) return 0
  return isLightDay(dateStr, cfg) ? LIGHT_DAY_XP_PENALTY : REST_DAY_XP_PENALTY
}

/** XP penalty for a day processed while the streak is already broken
 *  (streak <= 0, nothing left to rest-protect) — a flat per-day bleed that
 *  continues for as long as the streak stays broken. Sick-exempt days are
 *  always 0. */
export function streakBrokenXpPenalty(dateStr: string, mood: Record<string, Mood>): number {
  if (isSickExempt(mood, dateStr)) return 0
  return STREAK_BROKEN_XP_PENALTY
}
