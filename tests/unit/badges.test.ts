import { describe, it, expect } from 'vitest'
import { checkTaskMilestone, checkGoalMilestone, checkJournalMilestone } from '@/lib/engine/badges'

describe('checkTaskMilestone', () => {
  it('returns a badge at each task-count milestone', () => {
    expect(checkTaskMilestone(10)).toEqual({ id: 'task-10', label: '10 Tasks Done', icon: '✅' })
    expect(checkTaskMilestone(50)).toEqual({ id: 'task-50', label: '50 Tasks Done', icon: '✅' })
    expect(checkTaskMilestone(100)).toEqual({ id: 'task-100', label: '100 Tasks Done', icon: '🏆' })
    expect(checkTaskMilestone(250)).toEqual({ id: 'task-250', label: '250 Tasks Done', icon: '🏆' })
    expect(checkTaskMilestone(500)).toEqual({ id: 'task-500', label: '500 Tasks Done', icon: '👑' })
  })

  it('returns null for a non-milestone count', () => {
    expect(checkTaskMilestone(11)).toBeNull()
    expect(checkTaskMilestone(0)).toBeNull()
  })
})

describe('checkGoalMilestone', () => {
  it('returns a badge at each completed-goal milestone', () => {
    expect(checkGoalMilestone(1)).toEqual({ id: 'goal-1', label: 'First Goal Completed', icon: '🎯' })
    expect(checkGoalMilestone(5)).toEqual({ id: 'goal-5', label: '5 Goals Completed', icon: '🎯' })
    expect(checkGoalMilestone(10)).toEqual({ id: 'goal-10', label: '10 Goals Completed', icon: '🥇' })
    expect(checkGoalMilestone(25)).toEqual({ id: 'goal-25', label: '25 Goals Completed', icon: '🥇' })
  })

  it('returns null for a non-milestone count', () => {
    expect(checkGoalMilestone(2)).toBeNull()
  })
})

describe('checkJournalMilestone', () => {
  it('returns a badge at each journal-day milestone', () => {
    expect(checkJournalMilestone(1)).toEqual({ id: 'journal-1', label: 'First Journal Entry', icon: '📓' })
    expect(checkJournalMilestone(10)).toEqual({ id: 'journal-10', label: '10 Journal Days', icon: '📓' })
    expect(checkJournalMilestone(30)).toEqual({ id: 'journal-30', label: '30 Journal Days', icon: '📖' })
    expect(checkJournalMilestone(100)).toEqual({ id: 'journal-100', label: '100 Journal Days', icon: '📚' })
  })

  it('returns null for a non-milestone count', () => {
    expect(checkJournalMilestone(2)).toBeNull()
  })
})
