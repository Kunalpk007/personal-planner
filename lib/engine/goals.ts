import type { Goal, HistoryEntry, Task, Zone } from '@/store/types'
import { getWeekMonday } from './cutoff'

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

// ─── Life Score (Section 4 of docs/PHASE2_SOCIAL_LIFE_OS.md) ────────────────
//
// Reuses the existing Zone concept as the life-domain substrate. Each zone's
// score is a consistency ratio (days with at least one completed task in
// that zone / days in the trailing window) — the cleanest metric available
// given that per-zone point totals aren't preserved in history (same
// limitation noted above). Weights are manually set by the user on each
// Zone (Zone.weight, default 1 = equal weight), per the finalized decision
// to avoid auto-derived weights.

export function computeZoneScore(zoneId: string, history: HistoryEntry[], periodDays: number): number {
  const recent = history.slice(-periodDays)
  if (recent.length === 0) return 0
  const activeDays = recent.filter(e => e.tasks.some(t => t.done && t.zone === zoneId)).length
  return Math.round((activeDays / recent.length) * 100)
}

export interface LifeScoreResult {
  total: number
  byZone: Record<string, number>
}

export function computeLifeScore(zones: Zone[], history: HistoryEntry[], periodDays = 30): LifeScoreResult {
  const byZone: Record<string, number> = {}
  for (const z of zones) byZone[z.id] = computeZoneScore(z.id, history, periodDays)

  if (zones.length === 0) return { total: 0, byZone }

  const totalWeight = zones.reduce((sum, z) => sum + (z.weight ?? 1), 0) || 1
  const weighted = zones.reduce((sum, z) => sum + byZone[z.id] * (z.weight ?? 1), 0)
  return { total: Math.round(weighted / totalWeight), byZone }
}
