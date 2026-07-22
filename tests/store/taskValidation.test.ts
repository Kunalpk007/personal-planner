import { describe, it, expect, beforeEach } from 'vitest'
import { usePlannerStore } from '@/store'
import { resetStore } from './helpers'
import type { Task } from '@/store/types'

function taskInput(overrides: Partial<Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt' | 'subtasks'>> = {}) {
  return {
    title: 'Task', note: '', zone: 'z1', priority: 'high' as const, slot: '' as const,
    deadline: null, date: '2024-01-08', level: '' as const, isSpecial: false, specialPts: 0,
    ...overrides,
  }
}

beforeEach(resetStore)

describe('requestTaskValidation', () => {
  it('marks the task pending without touching done/rankXP/wallet', () => {
    usePlannerStore.getState().addTask(taskInput())
    const id = usePlannerStore.getState().tasks[0].id

    usePlannerStore.getState().requestTaskValidation(id, 'friend-1', 'Bob')

    const task = usePlannerStore.getState().tasks[0]
    expect(task).toMatchObject({ needsValidation: true, validatorUid: 'friend-1', validatorName: 'Bob', validationStatus: 'pending', done: false })
    expect(usePlannerStore.getState().rankXP).toBe(0)
    expect(usePlannerStore.getState().rewardWallet).toBe(0)
  })

  it('leaves other tasks untouched when requesting validation for one of several', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'A' }))
    usePlannerStore.getState().addTask(taskInput({ title: 'B' }))
    const [idA, idB] = usePlannerStore.getState().tasks.map(t => t.id)

    usePlannerStore.getState().requestTaskValidation(idA, 'friend-1', 'Bob')

    const state = usePlannerStore.getState()
    expect(state.tasks.find(t => t.id === idA)?.validationStatus).toBe('pending')
    expect(state.tasks.find(t => t.id === idB)?.validationStatus).toBeUndefined()
  })
})

describe('resolveTaskValidation', () => {
  it('approved: completes the task and awards pts/wallet, same as a normal toggle', () => {
    usePlannerStore.getState().addTask(taskInput({ priority: 'high' })) // 20pts
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().requestTaskValidation(id, 'friend-1', 'Bob')

    const result = usePlannerStore.getState().resolveTaskValidation(id, 'approved', 'nice work')

    expect(result).toEqual({ pts: 20, walletPts: 10 })
    const task = usePlannerStore.getState().tasks[0]
    expect(task.done).toBe(true)
    expect(task.validationStatus).toBe('approved')
    expect(task.validationNote).toBe('nice work')
    expect(usePlannerStore.getState().rankXP).toBe(20)
    expect(usePlannerStore.getState().rewardWallet).toBe(10)
  })

  it('rejected: leaves the task undone, no pts awarded, note stored', () => {
    usePlannerStore.getState().addTask(taskInput())
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().requestTaskValidation(id, 'friend-1', 'Bob')

    const result = usePlannerStore.getState().resolveTaskValidation(id, 'rejected', 'not done')

    expect(result).toBeNull()
    const task = usePlannerStore.getState().tasks[0]
    expect(task.done).toBe(false)
    expect(task.validationStatus).toBe('rejected')
    expect(task.validationNote).toBe('not done')
    expect(usePlannerStore.getState().rankXP).toBe(0)
  })

  it('rejected: defaults the note to null when omitted, leaving other tasks untouched', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'A' }))
    usePlannerStore.getState().addTask(taskInput({ title: 'B' }))
    const [idA, idB] = usePlannerStore.getState().tasks.map(t => t.id)
    usePlannerStore.getState().requestTaskValidation(idA, 'friend-1', 'Bob')

    usePlannerStore.getState().resolveTaskValidation(idA, 'rejected')

    const state = usePlannerStore.getState()
    expect(state.tasks.find(t => t.id === idA)?.validationNote).toBeNull()
    expect(state.tasks.find(t => t.id === idB)?.validationStatus).toBeUndefined()
  })

  it('defaults the note to null when omitted', () => {
    usePlannerStore.getState().addTask(taskInput())
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().requestTaskValidation(id, 'friend-1', 'Bob')

    usePlannerStore.getState().resolveTaskValidation(id, 'approved')

    expect(usePlannerStore.getState().tasks[0].validationNote).toBeNull()
  })

  it('approved: leaves other tasks untouched when resolving one of several', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'A', priority: 'high' }))
    usePlannerStore.getState().addTask(taskInput({ title: 'B', priority: 'high' }))
    const [idA, idB] = usePlannerStore.getState().tasks.map(t => t.id)
    usePlannerStore.getState().requestTaskValidation(idA, 'friend-1', 'Bob')

    usePlannerStore.getState().resolveTaskValidation(idA, 'approved')

    const state = usePlannerStore.getState()
    expect(state.tasks.find(t => t.id === idA)?.done).toBe(true)
    expect(state.tasks.find(t => t.id === idB)?.done).toBe(false)
  })

  it('is a no-op for an unknown task id', () => {
    expect(usePlannerStore.getState().resolveTaskValidation('does-not-exist', 'approved')).toBeNull()
  })

  it('is a no-op when the task is not in pending state', () => {
    usePlannerStore.getState().addTask(taskInput())
    const id = usePlannerStore.getState().tasks[0].id
    // never requested validation — validationStatus is undefined, not 'pending'
    const result = usePlannerStore.getState().resolveTaskValidation(id, 'approved')
    expect(result).toBeNull()
    expect(usePlannerStore.getState().rankXP).toBe(0)
  })

  it('does not double-resolve an already-approved task', () => {
    usePlannerStore.getState().addTask(taskInput())
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().requestTaskValidation(id, 'friend-1', 'Bob')
    usePlannerStore.getState().resolveTaskValidation(id, 'approved')

    const second = usePlannerStore.getState().resolveTaskValidation(id, 'approved')

    expect(second).toBeNull()
    expect(usePlannerStore.getState().rankXP).toBe(20)
  })
})

describe('cancelTaskValidation', () => {
  it('resets validation fields, leaving the task untouched otherwise', () => {
    usePlannerStore.getState().addTask(taskInput())
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().requestTaskValidation(id, 'friend-1', 'Bob')

    usePlannerStore.getState().cancelTaskValidation(id)

    const task = usePlannerStore.getState().tasks[0]
    expect(task.needsValidation).toBe(false)
    expect(task.validatorUid).toBeUndefined()
    expect(task.validationStatus).toBeUndefined()
    expect(task.done).toBe(false)
  })

  it('leaves other tasks untouched when cancelling validation for one of several', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'A' }))
    usePlannerStore.getState().addTask(taskInput({ title: 'B' }))
    const [idA, idB] = usePlannerStore.getState().tasks.map(t => t.id)
    usePlannerStore.getState().requestTaskValidation(idA, 'friend-1', 'Bob')
    usePlannerStore.getState().requestTaskValidation(idB, 'friend-1', 'Bob')

    usePlannerStore.getState().cancelTaskValidation(idA)

    const state = usePlannerStore.getState()
    expect(state.tasks.find(t => t.id === idA)?.needsValidation).toBe(false)
    expect(state.tasks.find(t => t.id === idB)?.needsValidation).toBe(true)
  })
})

describe('addChallengeTask', () => {
  it('creates a task stamped with the challengeId and who challenged it', () => {
    const id = usePlannerStore.getState().addChallengeTask(taskInput({ title: 'Go for a run' }), 'challenge-1', 'Bob')

    const task = usePlannerStore.getState().tasks.find(t => t.id === id)
    expect(task).toMatchObject({ title: 'Go for a run', challengeId: 'challenge-1', challengedBy: 'Bob', done: false })
  })
})
