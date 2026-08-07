/** Badge/medal milestone tables — item 8 of the 2026-08 batch: badges used to
 *  be streak-length-only (see store/slices/streak.slice.ts /
 *  lib/engine/streak.ts). These add three more categories (tasks completed,
 *  goals completed, journal days) so there's more than one axis to work
 *  toward. Each is a pure lookup so the awarding slice just checks
 *  "does this new count land on a milestone I haven't already got?". */

export interface BadgeMilestone {
  id:    string
  label: string
  icon:  string
}

const TASK_MILESTONES: Record<number, BadgeMilestone> = {
  10:  { id: 'task-10',  label: '10 Tasks Done',  icon: '✅' },
  50:  { id: 'task-50',  label: '50 Tasks Done',  icon: '✅' },
  100: { id: 'task-100', label: '100 Tasks Done', icon: '🏆' },
  250: { id: 'task-250', label: '250 Tasks Done', icon: '🏆' },
  500: { id: 'task-500', label: '500 Tasks Done', icon: '👑' },
}

export function checkTaskMilestone(doneCount: number): BadgeMilestone | null {
  return TASK_MILESTONES[doneCount] ?? null
}

const GOAL_MILESTONES: Record<number, BadgeMilestone> = {
  1:  { id: 'goal-1',  label: 'First Goal Completed', icon: '🎯' },
  5:  { id: 'goal-5',  label: '5 Goals Completed',    icon: '🎯' },
  10: { id: 'goal-10', label: '10 Goals Completed',   icon: '🥇' },
  25: { id: 'goal-25', label: '25 Goals Completed',   icon: '🥇' },
}

export function checkGoalMilestone(completedCount: number): BadgeMilestone | null {
  return GOAL_MILESTONES[completedCount] ?? null
}

const JOURNAL_MILESTONES: Record<number, BadgeMilestone> = {
  1:   { id: 'journal-1',   label: 'First Journal Entry', icon: '📓' },
  10:  { id: 'journal-10',  label: '10 Journal Days',     icon: '📓' },
  30:  { id: 'journal-30',  label: '30 Journal Days',     icon: '📖' },
  100: { id: 'journal-100', label: '100 Journal Days',    icon: '📚' },
}

export function checkJournalMilestone(distinctDays: number): BadgeMilestone | null {
  return JOURNAL_MILESTONES[distinctDays] ?? null
}
