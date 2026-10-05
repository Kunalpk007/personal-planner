/** Consistency Tracker ("habit100") — fully separate from the main planner
 *  store/engine by design (see project.md's "Consistency Tracker" design
 *  discussion: own streak, own scoring, never touches rankXP/streak/wallet). */

/** `book` is a special, fixed-shape entry (title/topic/pages in one card) —
 *  used only by the default seed template, never offered as a type you can
 *  pick when adding a new custom habit (see SetupWizard's add-habit type
 *  list, which deliberately excludes it). */
export type HabitType = 'checkbox' | 'numeric' | 'time' | 'text' | 'book'
export type Comparison = 'gte' | 'lte'

export interface HabitDef {
  id:          string
  label:       string
  type:        HabitType
  /** Display unit for numeric habits (e.g. 'min', 'L', 'hrs', 'steps', 'kcal', 'g', 'pages'). */
  unit?:       string
  /** Numeric target (numeric/book types) or minutes-since-midnight (time type). */
  target?:     number
  /** Only meaningful for numeric/time/book types — 'gte' = hit at or above
   *  target (e.g. 8k steps), 'lte' = hit at or below target (e.g. screen
   *  time under 4hrs). */
  comparison?: Comparison
  /** Optional visual grouping label (e.g. 'Nutrition') — display-only. */
  category?:   string
}

export interface Habit100Meta {
  startDate:                string   // yyyy-mm-dd
  totalDays:                number   // user-configurable at setup, default 100
  disciplinedThresholdPct:  number   // default 80
  habits:                   HabitDef[]
  goals:                    string[] // up to 3 pinned goals
  /** Milestone day numbers already shown (derived from MILESTONE_PCTS ×
   *  totalDays at the time each was crossed) — prevents the banner from
   *  re-firing on every Home load once unlocked. */
  badges:                   number[]
  createdAt:                string
  updatedAt:                string
}

export interface BookValue {
  title: string
  topic: string
  pages: number
}

export type Habit100Value = boolean | number | string | BookValue

export interface Habit100Day {
  date:        string
  values:      Record<string, Habit100Value>
  mood?:       number  // 1-10
  energy?:     number  // 1-10
  stress?:     number  // 1-10
  anxiety?:    number  // 1-10
  sleepHours?: number
  weight?:     number
  gratitude?:  string
  wrong?:      string
  /** Once true, this day is permanently immutable — set only via the
   *  catch-up-queue's explicit confirm action, or Home's own day rolling
   *  past (today auto-locks once it stops being "today" — see habit100.store.ts). */
  locked:      boolean
  updatedAt:   string
}

export interface Habit100Week {
  weekIndex: number  // 1-based program week
  worked:    string
  change:    string
  updatedAt: string
}
