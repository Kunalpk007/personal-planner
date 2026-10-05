import type { HabitDef } from '@/store/habit100/types'

export const TOTAL_DAYS = 100
export const DEFAULT_DISCIPLINED_THRESHOLD_PCT = 80

/** Starting template shown in the setup wizard — fully editable/removable/
 *  addable before the 100-day run starts (see project.md's Consistency
 *  Tracker design). Seeded from CONTEXT.md's 13 core + boosters, plus this
 *  session's additions (nutrition/macros, workout notes, reading detail —
 *  "read 10+ pages" is replaced by 3 richer fields rather than kept as a
 *  single generic booster). `counted` defaults: original core habits true,
 *  original boosters false (CONTEXT.md's own split), new additions true per
 *  explicit decision. */
export function defaultHabits(): HabitDef[] {
  return [
    // Core (counted)
    { id: 'wake',     label: 'Wake up before 9',       type: 'time',     target: 9 * 60, comparison: 'lte', counted: true },
    { id: 'nofap',    label: 'No Fap',                 type: 'checkbox', counted: true },
    { id: 'workout',  label: 'Workout 30 mins',        type: 'numeric',  unit: 'min',   target: 30,   comparison: 'gte', counted: true },
    { id: 'meditate', label: 'Meditate',                type: 'checkbox', counted: true },
    { id: 'water',    label: '3L water',                type: 'numeric',  unit: 'L',     target: 3,    comparison: 'gte', counted: true },
    { id: 'learn',    label: 'Learn something',         type: 'text',     counted: true },
    { id: 'screen',   label: 'Screen time under 4 hrs',  type: 'numeric',  unit: 'hrs',   target: 4,    comparison: 'lte', counted: true },
    { id: 'junk',     label: 'No junk food',             type: 'checkbox', counted: true },
    { id: 'alcohol',  label: 'No alcohol',               type: 'checkbox', counted: true },
    { id: 'steps',    label: '8k steps',                 type: 'numeric',  unit: 'steps', target: 8000, comparison: 'gte', counted: true },
    { id: 'phone',    label: 'No phone 30 mins after waking and before sleep', type: 'checkbox', counted: true },
    { id: 'outside',  label: 'Go out 15-30 mins',        type: 'checkbox', counted: true },
    { id: 'sun',      label: 'Sunlight',                  type: 'checkbox', counted: true },

    // Boosters (not counted by default)
    { id: 'sleep11',    label: 'Asleep before 11 PM',           type: 'time',     target: 23 * 60, comparison: 'lte', counted: false },
    { id: 'journal',    label: 'Journaling',                    type: 'checkbox', counted: false },
    { id: 'goaltask',   label: 'Goal-moving task done',         type: 'checkbox', counted: false },
    { id: 'doomscroll', label: 'No social-media doomscrolling', type: 'checkbox', counted: false },
    { id: 'food',       label: 'Protein / home-cooked meals',   type: 'checkbox', counted: false },
    { id: 'stretch',    label: 'Stretching / mobility',         type: 'checkbox', counted: false },

    // Nutrition (new — counted by default)
    { id: 'calories', label: 'Calories',  type: 'numeric', unit: 'kcal', target: 2200, comparison: 'gte', counted: true, category: 'Nutrition' },
    { id: 'protein',  label: 'Protein',   type: 'numeric', unit: 'g',    target: 120,  comparison: 'gte', counted: true, category: 'Nutrition' },
    { id: 'fat',       label: 'Fat',       type: 'numeric', unit: 'g',    target: 60,   comparison: 'gte', counted: true, category: 'Nutrition' },
    { id: 'carbs',     label: 'Carbs',     type: 'numeric', unit: 'g',    target: 220,  comparison: 'gte', counted: true, category: 'Nutrition' },
    { id: 'fibre',     label: 'Fibre',     type: 'numeric', unit: 'g',    target: 25,   comparison: 'gte', counted: true, category: 'Nutrition' },

    // Workout detail (new — counted by default)
    { id: 'workoutNotes', label: 'What did you train today?', type: 'text', counted: true, category: 'Workout' },

    // Reading detail (new — replaces the generic "read 10+ pages" booster)
    { id: 'bookTitle',  label: 'Book title',  type: 'text',    counted: true, category: 'Reading' },
    { id: 'bookTopic',  label: 'Topic',       type: 'text',    counted: true, category: 'Reading' },
    { id: 'bookPages',  label: 'Pages read',  type: 'numeric', unit: 'pages', target: 10, comparison: 'gte', counted: true, category: 'Reading' },
  ]
}
