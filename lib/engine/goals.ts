import type { Goal, HistoryEntry, Task, Zone } from '@/store/types'
import { getWeekMonday, daysBetween } from './cutoff'

/** First day (YYYY-MM-DD) of the calendar month containing dateStr. */
export function getMonthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`
}

/** Start-of-period boundary for a goal's cadence, anchored on `today`. */
export function periodStartFor(cadence: Goal['cadence'], today: string): string {
  return cadence === 'weekly' ? getWeekMonday(today) : getMonthStart(today)
}

/** Whether `dateStr` falls in the same weekly/monthly period as `today`. */
export function isWithinPeriod(dateStr: string, cadence: Goal['cadence'], today: string): boolean {
  if (cadence === 'monthly') return dateStr.slice(0, 7) === today.slice(0, 7)
  const start = getWeekMonday(today)
  const startDate = new Date(`${start}T12:00:00`)
  const end = new Date(startDate)
  end.setDate(startDate.getDate() + 6)
  const d = new Date(`${dateStr}T12:00:00`)
  return d >= startDate && d <= end
}

/**
 * Progress for a single Goal, derived entirely from history[] (submitted
 * days) plus today's live, not-yet-submitted tasks. Never stored — see
 * store/slices/goals.slice.ts for why.
 *
 * Data-availability note (same limitation as buildZoneBreakdown in
 * historyChart.ts): per-task points aren't preserved for special/deadline-
 * adjusted tasks in history, so zone-scoped goals must use targetType
 * 'taskCount' rather than 'points'. Unscoped 'points' goals can safely sum
 * history[].rxp (the day's total earned points).
 */
export function computeGoalProgress(
  goal: Goal,
  history: HistoryEntry[],
  liveTasks: Task[],
  today: string
): number {
  // Checklist goals (multi-task goals, incl. goal-type friend challenges)
  // aren't period-bound the way weekly/monthly points/taskCount goals are —
  // progress is just how many of the goal's own checklist items are done,
  // tracked directly on the Goal itself via toggleGoalChecklistItem.
  if (goal.targetType === 'checklist') {
    return goal.checklist?.filter(i => i.done).length ?? 0
  }

  let total = 0

  for (const entry of history) {
    if (!isWithinPeriod(entry.date, goal.cadence, today)) continue
    if (goal.targetType === 'points') {
      total += entry.rxp
    } else {
      total += entry.tasks.filter(t => t.done && (!goal.zoneId || t.zone === goal.zoneId)).length
    }
  }

  const alreadySubmittedToday = history.some(e => e.date === today)
  if (!alreadySubmittedToday && isWithinPeriod(today, goal.cadence, today) && goal.targetType === 'taskCount') {
    total += liveTasks.filter(t => t.date === today && t.done && (!goal.zoneId || t.zone === goal.zoneId)).length
  }

  return total
}

export function goalProgressPct(goal: Goal, progress: number): number {
  if (goal.target <= 0) return 0
  return Math.min(100, Math.round((progress / goal.target) * 100))
}

/** Sum of awarded points for goals completed on a given calendar day —
 *  feeds into todayEarned() so goal completions count toward that day's
 *  submit-gate total, not just rankXP/wallet (which completeGoal credits
 *  immediately, independent of the daily submit flow). */
export function goalPtsEarnedOn(goals: Goal[] | undefined, dateStr: string): number {
  return (goals ?? [])
    .filter(g => g.completedAt && g.completedAt.slice(0, 10) === dateStr)
    .reduce((sum, g) => sum + (g.awardedPts ?? 0), 0)
}

// ─── Life Score (Section 4 of docs/PHASE2_SOCIAL_LIFE_OS.md) ────────────────
//
// Reuses the existing Zone concept as the life-domain substrate. Each zone's
// score is a *recency-weighted consistency ratio*: of the days you were
// active in the trailing calendar window, what share did you touch this zone
// — with recent days counting more than older ones. This is the cleanest
// metric available given that per-zone point totals aren't preserved in
// history. Weights are manually set by the user on each Zone (Zone.weight,
// default 1), per the finalized decision to avoid auto-derived weights.
//
// v2 improvements over the original (plain activeDays / recent.length):
//   1. Trailing *calendar* window anchored on the latest recorded day, so
//      sporadic history with gaps can't pull month-old days into a "last 30".
//   2. Recency weighting (linear) — momentum this week matters more than a
//      streak three weeks ago.
//   3. The overall score only pools zones you've *ever* engaged, so a zone
//      you created but never used doesn't unfairly crater Life Score, while a
//      zone you used before and are now neglecting still counts against you
//      (that's the whole point of a life-balance score).

/** Recency-weighted linear window helper: how much a day `daysAgo` from the
 *  anchor counts. Anchor day = periodDays (max), oldest in window = 1. */
function recencyWeight(daysAgo: number, periodDays: number): number {
  return Math.max(1, periodDays - daysAgo)
}

export function computeZoneScore(zoneId: string, history: HistoryEntry[], periodDays: number): number {
  if (history.length === 0) return 0
  // Anchor on the most recent recorded day so "the window" tracks real usage
  // rather than the wall clock (a user returning after a break still sees a
  // meaningful score based on their actual recorded days).
  const anchor = history.reduce((max, e) => (e.date > max ? e.date : max), history[0].date)

  let activeW = 0
  let totalW = 0
  for (const e of history) {
    const daysAgo = daysBetween(e.date, anchor) // 0 = anchor day, grows into the past
    if (daysAgo < 0 || daysAgo >= periodDays) continue
    const w = recencyWeight(daysAgo, periodDays)
    totalW += w
    if (e.tasks.some(t => t.done && t.zone === zoneId)) activeW += w
  }
  return totalW === 0 ? 0 : Math.round((activeW / totalW) * 100)
}

export interface LifeScoreResult {
  total: number
  byZone: Record<string, number>
}

export function computeLifeScore(zones: Zone[], history: HistoryEntry[], periodDays = 30): LifeScoreResult {
  const byZone: Record<string, number> = {}
  for (const z of zones) byZone[z.id] = computeZoneScore(z.id, history, periodDays)

  if (zones.length === 0) return { total: 0, byZone }

  // Only zones the user has *ever* completed a task in count toward the total.
  // A freshly-created, never-used zone shouldn't drag the score to 0; but a
  // zone with any past activity stays in the pool so neglecting it now still
  // lowers the score (the life-balance signal).
  const engaged = zones.filter(z => history.some(e => e.tasks.some(t => t.done && t.zone === z.id)))
  const pool = engaged.length ? engaged : zones

  const totalWeight = pool.reduce((sum, z) => sum + (z.weight ?? 1), 0) || 1
  const weighted = pool.reduce((sum, z) => sum + byZone[z.id] * (z.weight ?? 1), 0)
  return { total: Math.round(weighted / totalWeight), byZone }
}
