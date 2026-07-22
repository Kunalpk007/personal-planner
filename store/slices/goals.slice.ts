import type { StateCreator } from 'zustand'
import type { AppState, Goal, GoalChecklistItem } from '../types'
import { uid } from '@/lib/engine/cutoff'

export interface GoalsSlice {
  addGoal:    (g: Omit<Goal, 'id' | 'createdAt'>) => void
  removeGoal: (id: string) => void
  editGoal:   (id: string, updates: Partial<Omit<Goal, 'id' | 'createdAt'>>) => void
  toggleGoalChecklistItem: (goalId: string, itemId: string) => void
  addChallengeGoal: (title: string, taskTitles: string[], endDate: string | undefined, challengedBy: string) => string
}

/** For a 'checklist' goal, `target` is always kept equal to the checklist
 *  length so goalProgressPct(goal, progress) in lib/engine/goals.ts keeps
 *  working generically (progress/target) without a separate code path. */
function syncChecklistTarget(g: Omit<Goal, 'id' | 'createdAt'>): Omit<Goal, 'id' | 'createdAt'> {
  if (g.targetType !== 'checklist') return g
  return { ...g, target: g.checklist?.length ?? 0 }
}

/** Goals (Section 3 of docs/PHASE2_SOCIAL_LIFE_OS.md).
 *  Only definitions live here — progress is always derived at render time
 *  from history[]/tasks[] via lib/engine/goals.ts, never stored, so it can
 *  never drift out of sync with the underlying task data. */
export const createGoalsSlice: StateCreator<AppState, [], [], GoalsSlice> = (set) => ({
  addGoal(g) {
    const goal = syncChecklistTarget(g)
    set(s => ({ goals: [...s.goals, { ...goal, id: uid(), createdAt: new Date().toISOString() }] }))
  },

  removeGoal(id) {
    set(s => ({ goals: s.goals.filter(g => g.id !== id) }))
  },

  editGoal(id, updates) {
    set(s => ({
      goals: s.goals.map(g => {
        if (g.id !== id) return g
        const merged = { ...g, ...updates }
        return merged.targetType === 'checklist' ? { ...merged, target: merged.checklist?.length ?? 0 } : merged
      }),
    }))
  },

  toggleGoalChecklistItem(goalId, itemId) {
    set(s => ({
      goals: s.goals.map(g => {
        if (g.id !== goalId || !g.checklist) return g
        return { ...g, checklist: g.checklist.map(item => item.id === itemId ? { ...item, done: !item.done } : item) }
      }),
    }))
  },

  addChallengeGoal(title, taskTitles, endDate, challengedBy) {
    const checklist: GoalChecklistItem[] = taskTitles
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => ({ id: uid(), title: t, done: false }))
    const goal: Goal = {
      id: uid(),
      title,
      cadence: 'weekly', // unused for checklist-type progress; kept for type shape consistency
      targetType: 'checklist',
      target: checklist.length,
      createdAt: new Date().toISOString(),
      checklist,
      endDate,
      challengedBy,
    }
    set(s => ({ goals: [...s.goals, goal] }))
    return goal.id
  },
})
