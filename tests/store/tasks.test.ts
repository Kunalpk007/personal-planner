import { describe, it, expect, beforeEach } from 'vitest'
import { usePlannerStore } from '@/store'
import { resetStore } from './helpers'
import type { Task } from '@/store/types'

function taskInput(overrides: Partial<Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt' | 'subtasks'>> = {}) {
  return {
    title: 'Test task', note: '', zone: 'z1', priority: 'high' as const, slot: '' as const,
    deadline: null, date: '2024-01-08', level: '' as const, isSpecial: false, specialPts: 0,
    ...overrides,
  }
}

beforeEach(resetStore)

describe('addTask', () => {
  it('adds a task with generated id, createdAt, and default done/completedAt/subtasks', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'Write report' }))
    const tasks = usePlannerStore.getState().tasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ title: 'Write report', done: false, completedAt: null, subtasks: [] })
    expect(tasks[0].id).toBeTruthy()
    expect(tasks[0].createdAt).toBeTruthy()
  })
})

describe('toggleTask', () => {
  it('marks a task done and awards rank XP and wallet points', () => {
    usePlannerStore.getState().addTask(taskInput({ priority: 'high', date: '2024-01-08' }))
    const id = usePlannerStore.getState().tasks[0].id

    const result = usePlannerStore.getState().toggleTask(id)

    expect(result).toEqual({ pts: 20, walletPts: 10 })
    const state = usePlannerStore.getState()
    expect(state.tasks[0].done).toBe(true)
    expect(state.tasks[0].completedAt).toBeTruthy()
    expect(state.rankXP).toBe(20)
    expect(state.rewardWallet).toBe(10)
  })

  it('reverses rank XP and wallet points when un-completing a task', () => {
    usePlannerStore.getState().addTask(taskInput({ priority: 'high' }))
    const id = usePlannerStore.getState().tasks[0].id

    usePlannerStore.getState().toggleTask(id) // complete
    const result = usePlannerStore.getState().toggleTask(id) // un-complete

    expect(result).toBeNull()
    const state = usePlannerStore.getState()
    expect(state.tasks[0].done).toBe(false)
    expect(state.tasks[0].completedAt).toBeNull()
    expect(state.rankXP).toBe(0)
    expect(state.rewardWallet).toBe(0)
  })

  it('clamps rankXP and rewardWallet at 0 when un-completing', () => {
    usePlannerStore.getState().addTask(taskInput({ priority: 'high' }))
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().toggleTask(id) // +20 rxp, +10 wallet

    // Manually drain the wallet/rxp below what un-completing would subtract
    usePlannerStore.setState({ rankXP: 5, rewardWallet: 2 })
    usePlannerStore.getState().toggleTask(id) // un-complete: would subtract 20/10

    const state = usePlannerStore.getState()
    expect(state.rankXP).toBe(0)
    expect(state.rewardWallet).toBe(0)
  })

  it('returns null and does nothing for an unknown task id', () => {
    const before = usePlannerStore.getState()
    const result = usePlannerStore.getState().toggleTask('does-not-exist')
    expect(result).toBeNull()
    expect(usePlannerStore.getState()).toEqual(before)
  })

  it('leaves other tasks untouched when completing one of several', () => {
    usePlannerStore.getState().addTask(taskInput({ priority: 'high', title: 'A' }))
    usePlannerStore.getState().addTask(taskInput({ priority: 'low', title: 'B' }))
    const [idA, idB] = usePlannerStore.getState().tasks.map(t => t.id)

    usePlannerStore.getState().toggleTask(idA)

    const state = usePlannerStore.getState()
    expect(state.tasks.find(t => t.id === idA)?.done).toBe(true)
    expect(state.tasks.find(t => t.id === idB)?.done).toBe(false)
  })

  it('leaves other tasks untouched when un-completing one of several', () => {
    usePlannerStore.getState().addTask(taskInput({ priority: 'high', title: 'A' }))
    usePlannerStore.getState().addTask(taskInput({ priority: 'low', title: 'B' }))
    const [idA, idB] = usePlannerStore.getState().tasks.map(t => t.id)
    usePlannerStore.getState().toggleTask(idA)
    usePlannerStore.getState().toggleTask(idB)

    usePlannerStore.getState().toggleTask(idA) // un-complete A

    const state = usePlannerStore.getState()
    expect(state.tasks.find(t => t.id === idA)?.done).toBe(false)
    expect(state.tasks.find(t => t.id === idB)?.done).toBe(true)
  })
})

describe('toggleTaskRetro', () => {
  it('completes a past task, awards points, and logs a change entry', () => {
    usePlannerStore.getState().addTask(taskInput({ priority: 'med', date: '2024-01-07', title: 'Yesterday task' }))
    const id = usePlannerStore.getState().tasks[0].id

    const result = usePlannerStore.getState().toggleTaskRetro(id)

    expect(result).toEqual({ pts: 12, walletPts: 6 })
    const state = usePlannerStore.getState()
    expect(state.tasks[0].done).toBe(true)
    expect(state.rankXP).toBe(12)
    expect(state.rewardWallet).toBe(6)
    expect(state.changeLog.at(-1)).toMatchObject({ action: 'retro-toggle' })
    expect(state.changeLog.at(-1)?.detail).toContain('Yesterday task')
  })

  it('un-completes a previously done task and reverses points', () => {
    usePlannerStore.getState().addTask(taskInput({ priority: 'med', date: '2024-01-07' }))
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().toggleTaskRetro(id) // complete: +12/+6

    const result = usePlannerStore.getState().toggleTaskRetro(id) // un-complete

    expect(result).toBeNull()
    const state = usePlannerStore.getState()
    expect(state.tasks[0].done).toBe(false)
    expect(state.rankXP).toBe(0)
    expect(state.rewardWallet).toBe(0)
  })

  it('returns null and does nothing for an unknown task id', () => {
    const before = usePlannerStore.getState()
    const result = usePlannerStore.getState().toggleTaskRetro('does-not-exist')
    expect(result).toBeNull()
    expect(usePlannerStore.getState()).toEqual(before)
  })

  it('leaves other tasks untouched when retro-completing one of several', () => {
    usePlannerStore.getState().addTask(taskInput({ priority: 'med', date: '2024-01-07', title: 'A' }))
    usePlannerStore.getState().addTask(taskInput({ priority: 'med', date: '2024-01-07', title: 'B' }))
    const [idA, idB] = usePlannerStore.getState().tasks.map(t => t.id)

    usePlannerStore.getState().toggleTaskRetro(idA)

    const state = usePlannerStore.getState()
    expect(state.tasks.find(t => t.id === idA)?.done).toBe(true)
    expect(state.tasks.find(t => t.id === idB)?.done).toBe(false)
  })
})

describe('removeTask', () => {
  it('removes an incomplete task without touching XP', () => {
    usePlannerStore.getState().addTask(taskInput())
    const id = usePlannerStore.getState().tasks[0].id

    usePlannerStore.getState().removeTask(id)

    const state = usePlannerStore.getState()
    expect(state.tasks).toHaveLength(0)
    expect(state.rankXP).toBe(0)
  })

  it('removes a completed task and deducts its points', () => {
    usePlannerStore.getState().addTask(taskInput({ priority: 'high' }))
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().toggleTask(id) // +20 rxp, +10 wallet

    usePlannerStore.getState().removeTask(id)

    const state = usePlannerStore.getState()
    expect(state.tasks).toHaveLength(0)
    expect(state.rankXP).toBe(0)
    expect(state.rewardWallet).toBe(0)
  })

  it('clears pinnedTaskId when the pinned task is removed', () => {
    usePlannerStore.getState().addTask(taskInput())
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().pinTask(id)

    usePlannerStore.getState().removeTask(id)

    expect(usePlannerStore.getState().pinnedTaskId).toBeNull()
  })

  it('clears pinnedTaskId when a pinned, completed task is removed', () => {
    usePlannerStore.getState().addTask(taskInput({ priority: 'high' }))
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().toggleTask(id) // mark done
    usePlannerStore.getState().pinTask(id)

    usePlannerStore.getState().removeTask(id)

    expect(usePlannerStore.getState().pinnedTaskId).toBeNull()
  })

  it('leaves pinnedTaskId untouched when removing a different completed task', () => {
    usePlannerStore.getState().addTask(taskInput({ priority: 'high', title: 'A' }))
    usePlannerStore.getState().addTask(taskInput({ priority: 'high', title: 'B' }))
    const [idA, idB] = usePlannerStore.getState().tasks.map(t => t.id)
    usePlannerStore.getState().toggleTask(idA) // mark A done
    usePlannerStore.getState().pinTask(idB)

    usePlannerStore.getState().removeTask(idA)

    expect(usePlannerStore.getState().pinnedTaskId).toBe(idB)
  })
})

describe('cancelTask', () => {
  it('cancels an active task with a reason, leaving other tasks untouched', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'Abandon me' }))
    usePlannerStore.getState().addTask(taskInput({ title: 'Leave me alone' }))
    const [t1, t2] = usePlannerStore.getState().tasks
    const ok = usePlannerStore.getState().cancelTask(t1.id, 'Changed my mind')
    expect(ok).toBe(true)
    const task = usePlannerStore.getState().tasks.find(t => t.id === t1.id)
    expect(task?.cancelledAt).not.toBeNull()
    expect(task?.cancelReason).toBe('Changed my mind')
    const other = usePlannerStore.getState().tasks.find(t => t.id === t2.id)
    expect(other?.cancelledAt).toBeUndefined()
  })

  it('returns false and no-ops for a task that does not exist', () => {
    expect(usePlannerStore.getState().cancelTask('nope', 'reason')).toBe(false)
  })

  it('returns false and no-ops for an already-done task', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'Finish me' }))
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().toggleTask(id)
    expect(usePlannerStore.getState().cancelTask(id, 'reason')).toBe(false)
  })

  it('returns false and no-ops for an already-cancelled task', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'Cancel twice' }))
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().cancelTask(id, 'first reason')
    expect(usePlannerStore.getState().cancelTask(id, 'second reason')).toBe(false)
    expect(usePlannerStore.getState().tasks.find(t => t.id === id)?.cancelReason).toBe('first reason')
  })

  it('a cancelled task is excluded from carryTask (never carried forward)', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'Cancelled, not carried' }))
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().cancelTask(id, 'reason')
    usePlannerStore.getState().carryTask(id, '2024-01-09')
    expect(usePlannerStore.getState().tasks.filter(t => t.date === '2024-01-09')).toHaveLength(0)
  })
})
