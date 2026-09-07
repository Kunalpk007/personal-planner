import type { AppState } from '@/store/types'
import { getMinPts } from './scoring'

/** The moment a given day's retro-fix window closes: 12:00 PM (noon) the
 *  day after. Fixed and non-configurable — see getFixableDays' doc comment
 *  for why this replaced the earlier Settings-configurable rolling window. */
export function retroFixDeadline(dateStr: string): Date {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return d
}

/**
 * Which past day (if any) is still eligible for the Dashboard's "Fix
 * Yesterday's Tasks?" modal.
 *
 * Background (see BUGS.md / project.md for the full writeup): the overnight
 * auto-logic (`runOvernightLogic`) locks in a verdict for a missed day the
 * moment the app is next opened — auto-submitted if the target was actually
 * met, otherwise auto-protected as a Rest Day (or, once the streak is
 * already broken, logged as a plain miss). That's necessary so a day
 * doesn't sit unresolved forever, but it means a day where the user
 * genuinely did the work and simply forgot to tick it off in the app (a
 * long day, an emergency, anything that kept them from opening it) gets
 * recorded as a Rest Day with zero chance to correct it — the previous gate
 * for the fix panel (`now.getHours() < cfg.cutoffHour`) was only true for
 * roughly the first hour after midnight, so almost nobody who opened the
 * app at a normal hour ever actually saw it.
 *
 * A day is fixable when it was auto-resolved (`auto: true` — this flag is
 * ONLY ever set by `runOvernightLogic`, including its auto-spent-a-freeze
 * branch; every deliberate action — on-time submit, `declareRestDay`,
 * manual `useFreeze` — stamps `auto: false`, so a day the user explicitly
 * chose to rest on or spend a freeze on is never silently overridden
 * here), it still falls short of that day's target (nothing to fix once it
 * already succeeded),
 * it has real tasks recorded, it hasn't already been fixed, and it's still
 * before its fix deadline: a fixed, non-configurable 12:00 PM the day
 * after (was a Settings-configurable rolling window; simplified to one
 * predictable rule per explicit request). Because the deadline for any day
 * older than yesterday has always already passed by the time "today"
 * exists, this can only ever return the single most recent auto-resolved
 * day — never a backlog of several.
 *
 * Always returns zero or one entry, guaranteed by construction rather than
 * just in practice: the only date that can ever pass the deadline check
 * relative to a `now` that falls on or after `today` is `today`'s own
 * previous day (any older date's deadline — that date plus one day at
 * noon — necessarily falls before `today`, so it's always already passed).
 * No sort/ordering is needed as a result.
 */
export function getFixableDays(
  state: Pick<AppState, 'history' | 'tasks' | 'retroFixedDays' | 'cfg'>,
  today: string,
  now: Date = new Date()
): string[] {
  return state.history
    .filter(h => {
      if (!h.auto) return false
      if (h.date >= today) return false
      if (state.retroFixedDays[h.date]) return false
      if (now >= retroFixDeadline(h.date)) return false
      if (h.rxp >= getMinPts(h.date, state.cfg)) return false
      return state.tasks.some(t => t.date === h.date)
    })
    .map(h => h.date)
}
