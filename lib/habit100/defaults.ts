import type { HabitDef } from '@/store/habit100/types'

export const DEFAULT_TOTAL_DAYS = 100
export const DEFAULT_DISCIPLINED_THRESHOLD_PCT = 80

/** Starting template shown in the setup wizard — fully editable/removable/
 *  addable before the run starts (see project.md's Consistency Tracker
 *  design). Every habit in the list counts toward the disciplined-day % —
 *  there's no separate "tracked but not counted" state; if something
 *  shouldn't affect the score, the user removes it rather than toggling a
 *  flag (per explicit decision — the old counted/not-counted split was
 *  confusing for no real benefit).
 *
 *  Labels for time/numeric habits deliberately don't bake in a specific
 *  number ("Wake before", not "Wake before 9") — the actual target is
 *  shown and edited right next to the label, so hardcoding it in the text
 *  too just goes stale the moment someone changes the target. */
export function defaultHabits(): HabitDef[] {
  return [
    // Core
    { id: 'wake',     label: 'Wake before',             type: 'time',     target: 9 * 60, comparison: 'lte' },
    { id: 'nofap',    label: 'No Fap',                   type: 'checkbox' },
    { id: 'workout',  label: 'Workout 30 mins',          type: 'numeric',  unit: 'min',   target: 30,   comparison: 'gte' },
    { id: 'meditate', label: 'Meditate',                  type: 'checkbox' },
    { id: 'water',    label: '3L water',                  type: 'numeric',  unit: 'L',     target: 3,    comparison: 'gte' },
    { id: 'learn',    label: 'Learn something',           type: 'text' },
    { id: 'screen',   label: 'Screen time under',          type: 'numeric',  unit: 'hrs',   target: 4,    comparison: 'lte' },
    { id: 'junk',     label: 'No junk food',               type: 'checkbox' },
    { id: 'alcohol',  label: 'No alcohol',                 type: 'checkbox' },
    { id: 'steps',    label: '8k steps',                   type: 'numeric',  unit: 'steps', target: 8000, comparison: 'gte' },
    { id: 'phone',    label: 'No phone before and after sleep', type: 'checkbox' },
    { id: 'outside',  label: 'Go out 15-30 mins',          type: 'checkbox' },
    { id: 'sun',      label: 'Sunlight',                    type: 'checkbox' },

    // Boosters
    { id: 'sleep11',    label: 'Asleep before',                 type: 'time',     target: 23 * 60, comparison: 'lte' },
    { id: 'journal',    label: 'Journaling',                    type: 'checkbox' },
    { id: 'goaltask',   label: 'Goal-moving task done',         type: 'checkbox' },
    { id: 'doomscroll', label: 'No social-media doomscrolling', type: 'checkbox' },
    { id: 'food',       label: 'Protein / home-cooked meals',   type: 'checkbox' },
    { id: 'stretch',    label: 'Stretching / mobility',         type: 'checkbox' },

    // Nutrition
    { id: 'calories', label: 'Calories',  type: 'numeric', unit: 'kcal', target: 2200, comparison: 'gte', category: 'Nutrition' },
    { id: 'protein',  label: 'Protein',   type: 'numeric', unit: 'g',    target: 120,  comparison: 'gte', category: 'Nutrition' },
    { id: 'fat',       label: 'Fat',       type: 'numeric', unit: 'g',    target: 60,   comparison: 'gte', category: 'Nutrition' },
    { id: 'carbs',     label: 'Carbs',     type: 'numeric', unit: 'g',    target: 220,  comparison: 'gte', category: 'Nutrition' },
    { id: 'fibre',     label: 'Fibre',     type: 'numeric', unit: 'g',    target: 25,   comparison: 'gte', category: 'Nutrition' },

    // Workout detail
    { id: 'workoutNotes', label: 'What did you train today?', type: 'text', category: 'Workout' },

    // Reading — one combined entry (title/topic/pages), not 3 separate
    // habits, so it counts as a single slot like everything else.
    { id: 'bookRead', label: 'Book read', type: 'book', unit: 'pages', target: 10, comparison: 'gte', category: 'Reading' },
  ]
}
