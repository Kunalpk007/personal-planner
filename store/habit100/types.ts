/** Consistency Tracker ("habit100") — fully separate from the main planner
 *  store/engine by design (see project.md's "Consistency Tracker" design
 *  discussion: own streak, own scoring, never touches rankXP/streak/wallet). */

export type HabitType = 'checkbox' | 'numeric' | 'time' | 'text'
export type Comparison = 'gte' | 'lte'

export interface HabitDef {
  id:          string
  label:       string
  type:        HabitType
  /** Display unit for numeric habits (e.g. 'min', 'L', 'hrs', 'steps', 'kcal', 'g', 'pages'). */
  unit?:       string
  /** Numeric target (numeric type) or minutes-since-midnight (time type). */
  target?:     number
  /** Only meaningful for numeric/time types — 'gte' = hit at or above target
   *  (e.g. 8k steps), 'lte' = hit at or below target (e.g. screen time under 4hrs). */
  comparison?: Comparison
  /** Counts toward the disciplined-day % — editable per habit at setup. */
  counted:     boolean
  /** Optional visual grouping label (e.g. 'Nutrition') — display-only. */
  category?:   string
}

export interface Habit100Meta {
  startDate:                string   // yyyy-mm-dd
  totalDays:                number   // fixed 100
  disciplinedThresholdPct:  number   // default 80
  habits:                   HabitDef[]
  goals:                    string[] // up to 3 pinned goals
  /** Milestone day numbers (25/50/75/100) already shown — prevents the
   *  banner from re-firing on every Home load once unlocked. */
  badges:                   number[]
  createdAt:                string
  updatedAt:                string
}

export type Habit100Value = boolean | number | string

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
