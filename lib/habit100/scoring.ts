import type { BookValue, HabitDef, Habit100Day, Habit100Meta, Habit100Value } from '@/store/habit100/types'
import { daysBetween, getNextDayKey, getPrevDayKey, getWeekDates } from '@/lib/engine/cutoff'

/** Pure scoring/streak logic for the Consistency Tracker — fully separate
 *  from lib/engine/scoring.ts (the main planner's engine). No side effects,
 *  no store access — everything here is a plain function of (meta, days).
 *  Every habit in meta.habits counts toward the score — there's no
 *  "tracked but not counted" state (removed per explicit decision: if a
 *  habit shouldn't affect the %, it's removed from the list, not flagged). */

/** "HH:MM" -> minutes since midnight, for `time`-type habits (stored/compared
 *  as a plain number, same as any other numeric habit). */
export function timeStrToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function isBookValue(value: unknown): value is BookValue {
  return typeof value === 'object' && value !== null && 'pages' in value
}

export function isHabitDone(habit: HabitDef, value: Habit100Value | undefined): boolean {
  if (value === undefined || value === null) return false
  switch (habit.type) {
    case 'checkbox':
      return value === true
    case 'text':
      return typeof value === 'string' && value.trim().length > 0
    case 'numeric':
    case 'time': {
      if (typeof value !== 'number' || habit.target === undefined) return false
      return habit.comparison === 'lte' ? value <= habit.target : value >= habit.target
    }
    case 'book': {
      if (!isBookValue(value) || habit.target === undefined) return false
      return habit.comparison === 'lte' ? value.pages <= habit.target : value.pages >= habit.target
    }
    default:
      return false
  }
}

export interface DayStats { habitTotal: number; habitDone: number; pct: number }

export function dayStats(meta: Habit100Meta, day: Habit100Day | undefined): DayStats {
  const habitTotal = meta.habits.length
  if (!day || habitTotal === 0) return { habitTotal, habitDone: 0, pct: 0 }
  const habitDone = meta.habits.filter(h => isHabitDone(h, day.values[h.id])).length
  return { habitTotal, habitDone, pct: Math.round((habitDone / habitTotal) * 100) }
}

export function isDisciplined(meta: Habit100Meta, day: Habit100Day | undefined): boolean {
  if (!day) return false
  return dayStats(meta, day).pct >= meta.disciplinedThresholdPct
}

/** 1-based day number within the run (can be <=0 before start, or
 *  >totalDays once finished — callers clamp as needed). */
export function programDayIndex(startDate: string, dateStr: string): number {
  return daysBetween(startDate, dateStr) + 1
}

function dayHasAnyData(day: Habit100Day | undefined): boolean {
  if (!day) return false
  return Object.keys(day.values).length > 0
    || day.mood !== undefined || day.energy !== undefined || day.stress !== undefined || day.anxiety !== undefined
    || day.sleepHours !== undefined || day.weight !== undefined
    || !!day.gratitude || !!day.wrong
}

export function currentStreak(meta: Habit100Meta, days: Habit100Day[], today: string): number {
  const map = new Map(days.map(d => [d.date, d]))
  const todayDisciplined = isDisciplined(meta, map.get(today))
  let cursor = todayDisciplined ? today : getPrevDayKey(today)
  let streak = 0
  while (cursor >= meta.startDate && isDisciplined(meta, map.get(cursor))) {
    streak++
    cursor = getPrevDayKey(cursor)
  }
  return streak
}

export function bestStreak(meta: Habit100Meta, days: Habit100Day[], today: string): number {
  const map = new Map(days.map(d => [d.date, d]))
  const end = today < meta.startDate ? meta.startDate : today
  let run = 0
  let best = 0
  for (let d = meta.startDate; d <= end; d = getNextDayKey(d)) {
    if (isDisciplined(meta, map.get(d))) {
      run++
      best = Math.max(best, run)
    } else {
      run = 0
    }
  }
  return best
}

/** Iterates the date range [meta.startDate, today], skipping `today` itself
 *  if it has no data yet (an in-progress day shouldn't drag the overall/week
 *  % down before the user has had a chance to log anything) — every other
 *  day in range counts, whether or not a record exists for it (a day with
 *  no record at all is a full miss, same as CONTEXT.md's "missed days count
 *  as failures, no grace rule"). */
function countedDateRange(meta: Habit100Meta, today: string, dayMap: Map<string, Habit100Day>): string[] {
  const out: string[] = []
  for (let d = meta.startDate; d <= today; d = getNextDayKey(d)) {
    if (d === today && !dayHasAnyData(dayMap.get(d))) continue
    out.push(d)
  }
  return out
}

export function overallPct(meta: Habit100Meta, days: Habit100Day[], today: string): number {
  if (meta.habits.length === 0) return 0
  const map = new Map(days.map(d => [d.date, d]))
  const dates = countedDateRange(meta, today, map)
  if (dates.length === 0) return 0
  let doneSlots = 0
  for (const d of dates) {
    const day = map.get(d)
    doneSlots += meta.habits.filter(h => isHabitDone(h, day?.values[h.id])).length
  }
  return Math.round((doneSlots / (dates.length * meta.habits.length)) * 100)
}

export function weekPct(meta: Habit100Meta, days: Habit100Day[], weekMonday: string, today: string): number {
  if (meta.habits.length === 0) return 0
  const map = new Map(days.map(d => [d.date, d]))
  const weekDates = new Set(getWeekDates(weekMonday))
  const dates = countedDateRange(meta, today, map).filter(d => weekDates.has(d))
  if (dates.length === 0) return 0
  let doneSlots = 0
  for (const d of dates) {
    const day = map.get(d)
    doneSlots += meta.habits.filter(h => isHabitDone(h, day?.values[h.id])).length
  }
  return Math.round((doneSlots / (dates.length * meta.habits.length)) * 100)
}

export interface HabitBreakdownEntry { habitId: string; label: string; pct: number }

export function habitBreakdown(meta: Habit100Meta, days: Habit100Day[], today: string): HabitBreakdownEntry[] {
  const map = new Map(days.map(d => [d.date, d]))
  const dates = countedDateRange(meta, today, map)
  return meta.habits.map(h => {
    if (dates.length === 0) return { habitId: h.id, label: h.label, pct: 0 }
    const done = dates.filter(d => isHabitDone(h, map.get(d)?.values[h.id])).length
    return { habitId: h.id, label: h.label, pct: Math.round((done / dates.length) * 100) }
  })
}

export interface MostBroken { habitId: string; label: string; missedCount: number; totalCount: number }

export function mostBrokenHabit(meta: Habit100Meta, days: Habit100Day[], today: string): MostBroken | null {
  const breakdown = habitBreakdown(meta, days, today)
  const map = new Map(days.map(d => [d.date, d]))
  const totalCount = countedDateRange(meta, today, map).length
  if (totalCount === 0 || breakdown.length === 0) return null
  const worst = [...breakdown].sort((a, b) => a.pct - b.pct)[0]
  if (worst.pct === 100) return null // nothing broken
  return { habitId: worst.habitId, label: worst.label, missedCount: Math.round(totalCount * (1 - worst.pct / 100)), totalCount }
}

export type CellStatus = 'disciplined' | 'partial' | 'missed' | 'today' | 'future'

export function cellStatus(meta: Habit100Meta, day: Habit100Day | undefined, dateStr: string, today: string): CellStatus {
  if (dateStr > today) return 'future'
  if (dateStr === today) return 'today'
  if (!day) return 'missed'
  const { pct } = dayStats(meta, day)
  if (pct === 0) return 'missed'
  if (pct >= meta.disciplinedThresholdPct) return 'disciplined'
  return 'partial'
}

/** Proportional milestones (25%/50%/75%/100% of the run length) rather than
 *  fixed day-numbers — a fixed 25/50/75/100 only made sense when every run
 *  was 100 days; now that totalDays is user-configurable, a 30-day run
 *  needs its own milestones (~8/15/23/30), not the 100-day ones. */
export const MILESTONE_PCTS = [0.25, 0.5, 0.75, 1] as const

export function milestoneDays(totalDays: number): number[] {
  return MILESTONE_PCTS.map(p => Math.max(1, Math.round(totalDays * p)))
}

/** Returns the single newest milestone day index crossed since
 *  `alreadyUnlocked`, or null if none — called once per Home load so the
 *  milestone banner fires exactly once per threshold crossed. */
export function checkNewMilestone(dayIndex: number, totalDays: number, alreadyUnlocked: number[]): number | null {
  const next = milestoneDays(totalDays).find(m => dayIndex >= m && !alreadyUnlocked.includes(m))
  return next ?? null
}
