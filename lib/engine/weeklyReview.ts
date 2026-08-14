import type { HistoryEntry, Goal, LifestyleCheckin } from '@/store/types'
import { getWeekDates } from './cutoff'

export interface WeekRecap {
  weekMonday:      string
  daysSubmitted:   number
  tasksDone:       number
  tasksTotal:      number
  goalsCompleted:  number
  rewardsRedeemed: number
  totalRxp:        number
  /** Average sleep quality this week, 1 (poor) - 3 (great), or null if no
   *  lifestyle check-ins were logged this week at all. */
  avgSleep:          number | null
  /** Days moved vs. days a lifestyle check-in was actually logged (not /7 —
   *  a week with only 2 check-ins shouldn't read as "2/7 moved", it should
   *  read as "2/2"). */
  daysMoved:         number
  daysWithLifestyle: number
  /** Average stress/overwhelm this week, 1 (calm) - 5 (overwhelmed), or
   *  null if no lifestyle check-ins were logged this week at all. */
  avgStress:         number | null
  /** Plain-language pattern callout, e.g. "3 of 4 lower-completion days
   *  this week followed poor sleep or a high-stress day." Deliberately
   *  conservative — only set when there's a real, majority pattern across
   *  at least 2 low-completion days; otherwise null, leaving the raw
   *  averages above to speak for themselves rather than overclaiming a
   *  pattern from thin data (see lifestyle-questions-analysis.md's third
   *  open question — this is the built default until told otherwise). */
  correlationNote:   string | null
}

const SLEEP_SCORE: Record<LifestyleCheckin['sleep'], number> = { poor: 1, ok: 2, great: 3 }

/** Pure, derive-only recap of a Mon-Sun week for the Weekly Review screen —
 *  never stored, always recomputed from history[]/goals[]/rewardRedemptions[]
 *  /lifestyleCheckins so it can't drift out of sync with the underlying
 *  records (same principle as computeGoalProgress in goals.ts). */
export function computeWeekRecap(
  weekMonday: string,
  history: HistoryEntry[],
  goals: Goal[],
  rewardRedemptions: Array<{ date: string }>,
  lifestyleCheckins: Record<string, LifestyleCheckin> = {},
): WeekRecap {
  const dates = new Set(getWeekDates(weekMonday))
  const weekHistory = history.filter(h => dates.has(h.date))

  const tasksDone  = weekHistory.reduce((sum, h) => sum + h.done, 0)
  const tasksTotal = weekHistory.reduce((sum, h) => sum + h.total, 0)
  const totalRxp   = weekHistory.reduce((sum, h) => sum + h.rxp, 0)

  const goalsCompleted  = goals.filter(g => g.completedAt && dates.has(g.completedAt.slice(0, 10))).length
  const rewardsRedeemed = rewardRedemptions.filter(r => dates.has(r.date)).length

  const weekLifestyle = Object.entries(lifestyleCheckins).filter(([date]) => dates.has(date))
  const daysWithLifestyle = weekLifestyle.length
  const daysMoved = weekLifestyle.filter(([, c]) => c.moved).length
  const avgSleep  = daysWithLifestyle > 0
    ? Math.round((weekLifestyle.reduce((sum, [, c]) => sum + SLEEP_SCORE[c.sleep], 0) / daysWithLifestyle) * 10) / 10
    : null
  const avgStress = daysWithLifestyle > 0
    ? Math.round((weekLifestyle.reduce((sum, [, c]) => sum + c.stress, 0) / daysWithLifestyle) * 10) / 10
    : null

  const correlationNote = computeCorrelationNote(weekHistory, lifestyleCheckins)

  return {
    weekMonday,
    daysSubmitted: weekHistory.length,
    tasksDone,
    tasksTotal,
    goalsCompleted,
    rewardsRedeemed,
    totalRxp,
    avgSleep,
    daysMoved,
    daysWithLifestyle,
    avgStress,
    correlationNote,
  }
}

/** Cross-references each day's task-completion ratio against that same
 *  day's sleep/stress, and states the pattern in plain language only when
 *  it's a real majority pattern across at least 2 lower-completion days —
 *  otherwise returns null rather than overclaiming from thin data. */
function computeCorrelationNote(
  weekHistory: HistoryEntry[],
  lifestyleCheckins: Record<string, LifestyleCheckin>,
): string | null {
  const withCompletion = weekHistory
    .filter(h => h.total > 0)
    .map(h => ({ date: h.date, ratio: h.done / h.total, checkin: lifestyleCheckins[h.date] }))
    .filter(d => d.checkin)

  if (withCompletion.length < 2) return null

  const avgRatio = withCompletion.reduce((sum, d) => sum + d.ratio, 0) / withCompletion.length
  const lowDays  = withCompletion.filter(d => d.ratio < avgRatio)
  if (lowDays.length < 2) return null

  const matching = lowDays.filter(d => d.checkin!.sleep === 'poor' || d.checkin!.stress >= 4)
  if (matching.length / lowDays.length < 0.5) return null

  return `${matching.length} of ${lowDays.length} lower-completion days this week followed poor sleep or a high-stress day.`
}
