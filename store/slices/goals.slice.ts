import type { StateCreator } from 'zustand'
import type { AppState, Goal, GoalChecklistItem } from '../types'
import { uid } from '@/lib/engine/cutoff'
import { WALLET_RATIO } from '@/constants/points'
import { checkGoalMilestone } from '@/lib/engine/badges'

export interface GoalsSlice {
  addGoal:    (g: Omit<Goal, 'id' | 'createdAt'>) => void
  removeGoal: (id: string) => void
  editGoal:   (id: string, updates: Partial<Omit<Goal, 'id' | 'createdAt'>>) => void
  toggleGoalChecklistItem: (goalId: string, itemId: string) => { pts: number; walletPts: number } | null
  setGoalNote: (goalId: string, note: string) => void
  completeGoal: (goalId: string) => { pts: number; walletPts: number } | null
  uncompleteGoal: (goalId: string) => { pts: number; walletPts: number } | null
  addChallengeGoal: (title: string, taskTitles: string[], endDate: string | undefined, challengedBy: string, points: number, delayPoints: number, challengeId?: string) => string
  cancelGoal: (goalId: string, reason: string) => boolean
}

/** For a 'checklist' goal, `target` is always kept equal to the checklist
 *  length so goalProgressPct(goal, progress) in lib/engine/goals.ts keeps
 *  working generically (progress/target) without a separate code path. */
function syncChecklistTarget(g: Omit<Goal, 'id' | 'createdAt'>): Omit<Goal, 'id' | 'createdAt'> {
  if (g.targetType !== 'checklist') return g
  return { ...g, target: g.checklist?.length ?? 0 }
}

/** Total points a goal awards on completion. 'perSubtask' sums each item's
 *  points; 'whole' (or unset) uses the single Goal.points value. */
function goalFullPoints(g: Goal): number {
  if (g.pointsMode === 'perSubtask') {
    return (g.checklist ?? []).reduce((sum, i) => sum + (i.points ?? 0), 0)
  }
  return g.points ?? 0
}

/** True once the goal's deadline (endDate, a YYYY-MM-DD) has passed. Points
 *  are only reduced once the deadline is crossed — never for carry-forward. */
function isPastDeadline(g: Goal): boolean {
  if (!g.endDate) return false
  return new Date().toISOString().slice(0, 10) > g.endDate
}

export const createGoalsSlice: StateCreator<AppState, [], [], GoalsSlice> = (set, get) => ({
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
    const goal = get().goals.find(g => g.id === goalId)
    if (!goal || !goal.checklist) return null
    const item = goal.checklist.find(i => i.id === itemId)
    if (!item) return null
    const nowDone = !item.done
    const checklist = goal.checklist.map(i => i.id === itemId ? { ...i, done: nowDone } : i)

    // Unchecking a subtask on an already-completed goal reopens the goal and
    // claws back the points it was awarded — a goal can't stay "complete"
    // once one of its subtasks is undone again.
    if (!nowDone && goal.completedAt) {
      const pts = goal.awardedPts ?? 0
      const walletPts = Math.floor(pts / WALLET_RATIO)
      set(s => ({
        goals:        s.goals.map(g => g.id === goalId ? { ...g, checklist, completedAt: null, awardedPts: undefined } : g),
        rankXP:       Math.max(0, s.rankXP - pts),
        rewardWallet: Math.max(0, s.rewardWallet - walletPts),
      }))
      return { pts, walletPts }
    }

    set(s => ({ goals: s.goals.map(g => g.id === goalId ? { ...g, checklist } : g) }))
    return null
  },

  setGoalNote(goalId, note) {
    set(s => ({ goals: s.goals.map(g => g.id === goalId ? { ...g, note } : g) }))
  },

  completeGoal(goalId) {
    const goal = get().goals.find(g => g.id === goalId)
    if (!goal || goal.completedAt) return null
    // A goal can only complete once every checklist item is done.
    const allDone = !goal.checklist || goal.checklist.length === 0 || goal.checklist.every(i => i.done)
    if (!allDone) return null

    const full = goalFullPoints(goal)
    const delayed = isPastDeadline(goal)
    // Past deadline → reduced points (giver-declared delayPoints, or half for
    // own goals). Carry-forward never reduces — only a crossed deadline does.
    const pts = delayed ? (goal.delayPoints ?? Math.round(full * 0.5)) : full
    const walletPts = Math.floor(pts / WALLET_RATIO)
    const completedAt = new Date().toISOString()

    set(s => {
      const doneCount = s.goals.filter(g => g.completedAt).length + 1
      const milestone = checkGoalMilestone(doneCount)
      const badges = milestone && !s.badges.some(b => b.id === milestone.id)
        ? [...s.badges, { ...milestone, date: completedAt.slice(0, 10) }]
        : s.badges
      return {
        goals:        s.goals.map(g => g.id === goalId ? { ...g, completedAt, awardedPts: pts } : g),
        rankXP:       s.rankXP + pts,
        rewardWallet: s.rewardWallet + walletPts,
        badges,
      }
    })
    return { pts, walletPts }
  },

  uncompleteGoal(goalId) {
    const goal = get().goals.find(g => g.id === goalId)
    if (!goal || !goal.completedAt) return null
    const pts = goal.awardedPts ?? 0
    const walletPts = Math.floor(pts / WALLET_RATIO)
    set(s => ({
      goals:        s.goals.map(g => g.id === goalId ? { ...g, completedAt: null, awardedPts: undefined } : g),
      rankXP:       Math.max(0, s.rankXP - pts),
      rewardWallet: Math.max(0, s.rewardWallet - walletPts),
    }))
    return { pts, walletPts }
  },

  addChallengeGoal(title, taskTitles, endDate, challengedBy, points, delayPoints, challengeId) {
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
      challengeId,
      pointsMode: 'whole',
      points,
      delayPoints,
      completedAt: null,
    }
    set(s => ({ goals: [...s.goals, goal] }))
    return goal.id
  },

  // Abandoning a goal with a reason instead of finishing it. Only an active
  // (incomplete, not-already-cancelled) goal can be cancelled. If the goal
  // came from a challenge (challengeId set), social.store.ts's watcher picks
  // up the cancelledAt transition and notifies the challenger with the
  // reason — see markChallengeCancelled in lib/firebase/social.ts.
  cancelGoal(goalId, reason) {
    const goal = get().goals.find(g => g.id === goalId)
    if (!goal || goal.completedAt || goal.cancelledAt) return false
    set(s => ({
      goals: s.goals.map(g => g.id === goalId ? { ...g, cancelledAt: new Date().toISOString(), cancelReason: reason } : g),
    }))
    return true
  },
})
