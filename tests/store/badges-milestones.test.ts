import { describe, it, expect, beforeEach } from 'vitest'
import { usePlannerStore } from '@/store'
import { resetStore } from './helpers'
import type { Task } from '@/store/types'

function taskInput(overrides: Partial<Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt' | 'subtasks'>> = {}) {
  return {
    title: 'Test task', note: '', zone: 'z1', priority: 'low' as const, slot: '' as const,
    deadline: null, date: '2024-01-08', level: '' as const, isSpecial: false, specialPts: 0,
    ...overrides,
  }
}

beforeEach(resetStore)

describe('task-count badge milestones (toggleTask)', () => {
  it('awards the 10-tasks badge exactly on the 10th completed task, not before or after', () => {
    const ids: string[] = []
    for (let i = 0; i < 11; i++) {
      usePlannerStore.getState().addTask(taskInput({ title: `T${i}` }))
      ids.push(usePlannerStore.getState().tasks[i].id)
    }

    for (let i = 0; i < 9; i++) usePlannerStore.getState().toggleTask(ids[i])
    expect(usePlannerStore.getState().badges.some(b => b.id === 'task-10')).toBe(false)

    usePlannerStore.getState().toggleTask(ids[9]) // 10th completion
    expect(usePlannerStore.getState().badges.filter(b => b.id === 'task-10')).toHaveLength(1)

    usePlannerStore.getState().toggleTask(ids[10]) // 11th completion — not a milestone
    expect(usePlannerStore.getState().badges.filter(b => b.id === 'task-10')).toHaveLength(1)
  })

  it('does not duplicate a milestone badge if the done-count returns to it later', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'A' }))
    usePlannerStore.getState().addTask(taskInput({ title: 'B' }))
    const [idA, idB] = usePlannerStore.getState().tasks.map(t => t.id)

    // Seed 9 already-done tasks so completing A lands exactly on the 10th.
    for (let i = 0; i < 9; i++) {
      usePlannerStore.getState().addTask(taskInput({ title: `seed-${i}` }))
    }
    const seedIds = usePlannerStore.getState().tasks.filter(t => t.title.startsWith('seed-')).map(t => t.id)
    seedIds.forEach(id => usePlannerStore.getState().toggleTask(id))

    usePlannerStore.getState().toggleTask(idA) // 10th done -> badge
    expect(usePlannerStore.getState().badges.filter(b => b.id === 'task-10')).toHaveLength(1)

    usePlannerStore.getState().toggleTask(idA) // un-complete -> back to 9 done
    usePlannerStore.getState().toggleTask(idB) // complete a different task -> 10 done again

    expect(usePlannerStore.getState().badges.filter(b => b.id === 'task-10')).toHaveLength(1)
  })
})

describe('goal-completion badge milestones (completeGoal)', () => {
  function checklistGoal(title: string) {
    usePlannerStore.getState().addGoal({
      title, cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 10, completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: true }],
    })
    return usePlannerStore.getState().goals.at(-1)!.id
  }

  it('awards the first-goal badge on the 1st completion, and not again on the 2nd (not a milestone)', () => {
    const g1 = checklistGoal('A')
    usePlannerStore.getState().completeGoal(g1)
    expect(usePlannerStore.getState().badges.filter(b => b.id === 'goal-1')).toHaveLength(1)

    const g2 = checklistGoal('B')
    usePlannerStore.getState().completeGoal(g2)
    expect(usePlannerStore.getState().badges.filter(b => b.id === 'goal-1')).toHaveLength(1)
  })

  it('does not duplicate the first-goal badge when the completed count returns to 1 later', () => {
    const g1 = checklistGoal('A')
    usePlannerStore.getState().completeGoal(g1)
    expect(usePlannerStore.getState().badges.filter(b => b.id === 'goal-1')).toHaveLength(1)

    usePlannerStore.getState().uncompleteGoal(g1) // back to 0 completed
    const g2 = checklistGoal('B')
    usePlannerStore.getState().completeGoal(g2) // completed count -> 1 again

    expect(usePlannerStore.getState().badges.filter(b => b.id === 'goal-1')).toHaveLength(1)
  })
})

describe('journal-day badge milestones (saveJournalEntry)', () => {
  it('awards the first-entry badge on the first journal entry ever', () => {
    usePlannerStore.getState().saveJournalEntry('2024-01-08', 'Hello')
    expect(usePlannerStore.getState().badges.filter(b => b.id === 'journal-1')).toHaveLength(1)
  })

  it('does not award a new badge for a second entry on the same day', () => {
    usePlannerStore.getState().saveJournalEntry('2024-01-08', 'First')
    usePlannerStore.getState().saveJournalEntry('2024-01-08', 'Second')
    expect(usePlannerStore.getState().badges.filter(b => b.id === 'journal-1')).toHaveLength(1)
  })

  it('does not award a badge for the 2nd distinct journal day (not a milestone)', () => {
    usePlannerStore.getState().saveJournalEntry('2024-01-08', 'Day 1')
    usePlannerStore.getState().saveJournalEntry('2024-01-09', 'Day 2')
    expect(usePlannerStore.getState().badges.some(b => b.id.startsWith('journal-') && b.id !== 'journal-1')).toBe(false)
  })

  it('awards the 10-journal-days badge on the 10th distinct day of journaling', () => {
    for (let i = 1; i <= 10; i++) {
      usePlannerStore.getState().saveJournalEntry(`2024-01-${String(i).padStart(2, '0')}`, `Entry ${i}`)
    }
    expect(usePlannerStore.getState().badges.filter(b => b.id === 'journal-10')).toHaveLength(1)
  })
})
