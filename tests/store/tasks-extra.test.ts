import { describe, it, expect, beforeEach } from 'vitest'
import { usePlannerStore } from '@/store'
import { resetStore } from './helpers'
import type { Task, HistoryEntry } from '@/store/types'

function taskInput(overrides: Partial<Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt' | 'subtasks'>> = {}) {
  return {
    title: 'Task', note: '', zone: 'z1', priority: 'high' as const, slot: '' as const,
    deadline: null, date: '2024-01-08', level: '' as const, isSpecial: false, specialPts: 0,
    ...overrides,
  }
}

function histEntry(date: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    date, done: 0, total: 0, pct: 0, rxp: 0,
    mood: '', eodMood: '', frozen: false, rest: false,
    auto: false, late: false, tasks: [], rewards: [],
    ...overrides,
  }
}

beforeEach(resetStore)

describe('editTask', () => {
  it('updates task fields in place', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'Old title' }))
    const id = usePlannerStore.getState().tasks[0].id

    usePlannerStore.getState().editTask(id, { title: 'New title' })

    expect(usePlannerStore.getState().tasks[0].title).toBe('New title')
  })

  it('recalculates rankXP when priority changes on a done task', () => {
    usePlannerStore.getState().addTask(taskInput({ priority: 'high' }))
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().toggleTask(id) // +20 rxp

    usePlannerStore.getState().editTask(id, { priority: 'low', done: true, completedAt: new Date().toISOString() })

    expect(usePlannerStore.getState().rankXP).toBe(6) // changed to low (6 pts)
  })

  it('does nothing if task id does not exist', () => {
    const before = usePlannerStore.getState()
    usePlannerStore.getState().editTask('unknown-id', { title: 'Ghost' })
    expect(usePlannerStore.getState().tasks).toEqual(before.tasks)
  })

  it('leaves other tasks untouched when editing one of several', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'A' }))
    usePlannerStore.getState().addTask(taskInput({ title: 'B' }))
    const [idA, idB] = usePlannerStore.getState().tasks.map(t => t.id)

    usePlannerStore.getState().editTask(idA, { title: 'A edited' })

    const state = usePlannerStore.getState()
    expect(state.tasks.find(t => t.id === idA)?.title).toBe('A edited')
    expect(state.tasks.find(t => t.id === idB)?.title).toBe('B')
  })
})

describe('pinTask', () => {
  it('pins a task by id', () => {
    usePlannerStore.getState().addTask(taskInput())
    const id = usePlannerStore.getState().tasks[0].id

    usePlannerStore.getState().pinTask(id)

    expect(usePlannerStore.getState().pinnedTaskId).toBe(id)
  })

  it('unpins the task if the same id is passed again', () => {
    usePlannerStore.getState().addTask(taskInput())
    const id = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().pinTask(id)

    usePlannerStore.getState().pinTask(id)

    expect(usePlannerStore.getState().pinnedTaskId).toBeNull()
  })
})

describe('subtask operations', () => {
  it('addSubtask appends a subtask with generated id', () => {
    usePlannerStore.getState().addTask(taskInput())
    const taskId = usePlannerStore.getState().tasks[0].id

    usePlannerStore.getState().addSubtask(taskId, 'Sub one')

    const task = usePlannerStore.getState().tasks[0]
    expect(task.subtasks).toHaveLength(1)
    expect(task.subtasks[0].title).toBe('Sub one')
    expect(task.subtasks[0].done).toBe(false)
    expect(task.subtasks[0].id).toBeTruthy()
  })

  it('toggleSubtask flips the done state of a subtask', () => {
    usePlannerStore.getState().addTask(taskInput())
    const taskId = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().addSubtask(taskId, 'Sub')
    const subId = usePlannerStore.getState().tasks[0].subtasks[0].id

    usePlannerStore.getState().toggleSubtask(taskId, subId)
    expect(usePlannerStore.getState().tasks[0].subtasks[0].done).toBe(true)

    usePlannerStore.getState().toggleSubtask(taskId, subId)
    expect(usePlannerStore.getState().tasks[0].subtasks[0].done).toBe(false)
  })

  it('toggleSubtask only flips the targeted subtask, leaving other subtasks and tasks untouched', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'A' }))
    usePlannerStore.getState().addTask(taskInput({ title: 'B' }))
    const [taskA, taskB] = usePlannerStore.getState().tasks.map(t => t.id)
    usePlannerStore.getState().addSubtask(taskA, 'Sub 1')
    usePlannerStore.getState().addSubtask(taskA, 'Sub 2')
    const subs = usePlannerStore.getState().tasks.find(t => t.id === taskA)!.subtasks
    const [sub1, sub2] = subs.map(s => s.id)

    usePlannerStore.getState().toggleSubtask(taskA, sub1)

    const state = usePlannerStore.getState()
    const updatedSubs = state.tasks.find(t => t.id === taskA)!.subtasks
    expect(updatedSubs.find(s => s.id === sub1)?.done).toBe(true)
    expect(updatedSubs.find(s => s.id === sub2)?.done).toBe(false)
    expect(state.tasks.find(t => t.id === taskB)?.subtasks).toHaveLength(0)
  })

  it('addSubtask only appends to the targeted task, leaving another task untouched', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'A' }))
    usePlannerStore.getState().addTask(taskInput({ title: 'B' }))
    const [taskA, taskB] = usePlannerStore.getState().tasks.map(t => t.id)

    usePlannerStore.getState().addSubtask(taskA, 'Sub for A')

    const state = usePlannerStore.getState()
    expect(state.tasks.find(t => t.id === taskA)?.subtasks).toHaveLength(1)
    expect(state.tasks.find(t => t.id === taskB)?.subtasks).toHaveLength(0)
  })

  it('removeSubtask removes only the targeted subtask', () => {
    usePlannerStore.getState().addTask(taskInput())
    const taskId = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().addSubtask(taskId, 'Keep')
    usePlannerStore.getState().addSubtask(taskId, 'Remove')
    const [keepId, removeId] = usePlannerStore.getState().tasks[0].subtasks.map(s => s.id)

    usePlannerStore.getState().removeSubtask(taskId, removeId)

    const subtasks = usePlannerStore.getState().tasks[0].subtasks
    expect(subtasks).toHaveLength(1)
    expect(subtasks[0].id).toBe(keepId)
  })

  it('removeSubtask leaves another task entirely untouched', () => {
    usePlannerStore.getState().addTask(taskInput({ title: 'A' }))
    usePlannerStore.getState().addTask(taskInput({ title: 'B' }))
    const [taskA, taskB] = usePlannerStore.getState().tasks.map(t => t.id)
    usePlannerStore.getState().addSubtask(taskB, 'Keep on B')
    const subId = usePlannerStore.getState().tasks.find(t => t.id === taskB)!.subtasks[0].id

    usePlannerStore.getState().removeSubtask(taskB, subId)

    const state = usePlannerStore.getState()
    expect(state.tasks.find(t => t.id === taskA)?.subtasks).toHaveLength(0)
    expect(state.tasks.find(t => t.id === taskB)?.subtasks).toHaveLength(0)
  })
})

describe('recurring templates', () => {
  it('addRecurring creates a template with generated id', () => {
    usePlannerStore.getState().addRecurring({
      title: 'Daily standup', note: '', zone: 'z1',
      priority: 'med', slot: 'morning', level: '', isSpecial: false, specialPts: 0,
    })
    const rec = usePlannerStore.getState().recurring
    expect(rec).toHaveLength(1)
    expect(rec[0].title).toBe('Daily standup')
    expect(rec[0].id).toBeTruthy()
  })

  it('editRecurring updates a template field', () => {
    usePlannerStore.getState().addRecurring({
      title: 'Old', note: '', zone: 'z1',
      priority: 'med', slot: '', level: '', isSpecial: false, specialPts: 0,
    })
    const id = usePlannerStore.getState().recurring[0].id

    usePlannerStore.getState().editRecurring(id, { title: 'New' })

    expect(usePlannerStore.getState().recurring[0].title).toBe('New')
  })

  it('editRecurring leaves other templates untouched', () => {
    usePlannerStore.getState().addRecurring({
      title: 'A', note: '', zone: 'z1',
      priority: 'med', slot: '', level: '', isSpecial: false, specialPts: 0,
    })
    usePlannerStore.getState().addRecurring({
      title: 'B', note: '', zone: 'z1',
      priority: 'med', slot: '', level: '', isSpecial: false, specialPts: 0,
    })
    const [idA, idB] = usePlannerStore.getState().recurring.map(r => r.id)

    usePlannerStore.getState().editRecurring(idA, { title: 'A edited' })

    const recurring = usePlannerStore.getState().recurring
    expect(recurring.find(r => r.id === idA)?.title).toBe('A edited')
    expect(recurring.find(r => r.id === idB)?.title).toBe('B')
  })

  it('removeRecurring deletes a template by id', () => {
    usePlannerStore.getState().addRecurring({
      title: 'Remove me', note: '', zone: 'z1',
      priority: 'low', slot: '', level: '', isSpecial: false, specialPts: 0,
    })
    const id = usePlannerStore.getState().recurring[0].id

    usePlannerStore.getState().removeRecurring(id)

    expect(usePlannerStore.getState().recurring).toHaveLength(0)
  })

  it('injectRecurring creates tasks for today from templates (skips existing)', () => {
    usePlannerStore.getState().addRecurring({
      title: 'Daily standup', note: '', zone: 'z1',
      priority: 'med', slot: '', level: '', isSpecial: false, specialPts: 0,
    })
    const recurId = usePlannerStore.getState().recurring[0].id

    usePlannerStore.getState().injectRecurring('2024-01-08')
    expect(usePlannerStore.getState().tasks).toHaveLength(1)
    expect(usePlannerStore.getState().tasks[0].date).toBe('2024-01-08')
    expect(usePlannerStore.getState().tasks[0].recurId).toBe(recurId)

    // Second call should not duplicate
    usePlannerStore.getState().injectRecurring('2024-01-08')
    expect(usePlannerStore.getState().tasks).toHaveLength(1)
  })
})

describe('carryTask', () => {
  it('creates a carried copy of the task on the next day', () => {
    usePlannerStore.getState().addTask(taskInput({ date: '2024-01-08' }))
    const id = usePlannerStore.getState().tasks[0].id

    usePlannerStore.getState().carryTask(id, '2024-01-09')

    const tasks = usePlannerStore.getState().tasks
    expect(tasks).toHaveLength(2)
    const carried = tasks.find(t => t.date === '2024-01-09')!
    expect(carried.carriedDays).toBe(1)
    expect(carried.done).toBe(false)
  })

  it('does not carry a task that has already been carried 3 times (MAX_CARRY)', () => {
    usePlannerStore.getState().addTask(taskInput({ date: '2024-01-08', carriedDays: 3 }))
    const id = usePlannerStore.getState().tasks[0].id

    usePlannerStore.getState().carryTask(id, '2024-01-09')

    expect(usePlannerStore.getState().tasks).toHaveLength(1) // no carry created
  })

  it('does nothing if task id does not exist', () => {
    usePlannerStore.getState().carryTask('ghost-id', '2024-01-09')
    expect(usePlannerStore.getState().tasks).toHaveLength(0)
  })
})

describe('processExpiredCarries', () => {
  it('removes tasks carried more than MAX_CARRY days', () => {
    usePlannerStore.getState().addTask(taskInput({ date: '2024-01-05', carriedDays: 4 }))
    usePlannerStore.getState().addTask(taskInput({ date: '2024-01-06', carriedDays: 3 }))
    usePlannerStore.getState().addTask(taskInput({ date: '2024-01-08' })) // no carriedDays

    usePlannerStore.getState().processExpiredCarries()

    const remaining = usePlannerStore.getState().tasks
    expect(remaining).toHaveLength(2) // only carriedDays=3 and unset remain
    expect(remaining.every(t => !t.carriedDays || t.carriedDays <= 3)).toBe(true)
  })
})

describe('submitRetroFix', () => {
  it('updates an existing history entry with the current task state', () => {
    usePlannerStore.getState().addTask(taskInput({ date: '2024-01-07', priority: 'high' }))
    const taskId = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().toggleTaskRetro(taskId) // mark done

    // Seed a history entry for that day (as overnight logic would)
    usePlannerStore.setState({ history: [histEntry('2024-01-07', { done: 0, total: 1, pct: 0, rxp: 0 })] })

    const result = usePlannerStore.getState().submitRetroFix('2024-01-07')

    expect(result).toEqual({ ok: true })
    const entry = usePlannerStore.getState().history[0]
    expect(entry.done).toBe(1)
    expect(entry.rxp).toBeGreaterThan(0)
    expect(entry.pct).toBe(100)
    expect(usePlannerStore.getState().retroFixedDays['2024-01-07']).toBe(true)
  })

  it('creates a new history entry when none exists for that date', () => {
    usePlannerStore.getState().addTask(taskInput({ date: '2024-01-07', priority: 'med' }))
    const taskId = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().toggleTaskRetro(taskId)

    // No history entry for 2024-01-07
    const result = usePlannerStore.getState().submitRetroFix('2024-01-07')

    expect(result).toEqual({ ok: true })
    const history = usePlannerStore.getState().history
    expect(history).toHaveLength(1)
    expect(history[0].date).toBe('2024-01-07')
    expect(history[0].done).toBe(1)
  })

  it('deducts a reward from the wallet when one is provided', () => {
    usePlannerStore.getState().addTask(taskInput({ date: '2024-01-07' }))
    usePlannerStore.setState({ rewardWallet: 100, history: [histEntry('2024-01-07')] })

    const result = usePlannerStore.getState().submitRetroFix('2024-01-07', { title: 'Treat', cost: 30 })

    expect(result).toEqual({ ok: true })
    expect(usePlannerStore.getState().rewardWallet).toBe(70)
    expect(usePlannerStore.getState().rewardRedemptions).toHaveLength(1)
  })

  it('returns { ok: false, reason: "insufficient-wallet" } when wallet cannot cover the reward', () => {
    usePlannerStore.getState().addTask(taskInput({ date: '2024-01-07' }))
    usePlannerStore.setState({ rewardWallet: 10, history: [histEntry('2024-01-07')] })

    const result = usePlannerStore.getState().submitRetroFix('2024-01-07', { title: 'Treat', cost: 50 })

    expect(result).toEqual({ ok: false, reason: 'insufficient-wallet' })
    expect(usePlannerStore.getState().rewardWallet).toBe(10)
  })

  it('records pct=0 when there are no tasks at all for that date', () => {
    // No tasks added for 2024-01-07
    const result = usePlannerStore.getState().submitRetroFix('2024-01-07')

    expect(result).toEqual({ ok: true })
    const entry = usePlannerStore.getState().history.find(h => h.date === '2024-01-07')
    expect(entry).toMatchObject({ done: 0, total: 0, pct: 0 })
  })

  it('records "special" priority in the task snapshot for a special task', () => {
    usePlannerStore.getState().addTask(taskInput({ date: '2024-01-07', isSpecial: true, specialPts: 40 }))
    const taskId = usePlannerStore.getState().tasks[0].id
    usePlannerStore.getState().toggleTaskRetro(taskId)

    usePlannerStore.getState().submitRetroFix('2024-01-07')

    const entry = usePlannerStore.getState().history.find(h => h.date === '2024-01-07')
    expect(entry?.tasks[0]?.priority).toBe('special')
  })

  it('treats a missing rewards array on the existing history entry as empty', () => {
    usePlannerStore.getState().addTask(taskInput({ date: '2024-01-07' }))
    const entry = histEntry('2024-01-07')
    delete (entry as { rewards?: unknown }).rewards
    usePlannerStore.setState({ history: [entry], rewardWallet: 100 })

    const result = usePlannerStore.getState().submitRetroFix('2024-01-07', { title: 'Treat', cost: 5 })

    expect(result).toEqual({ ok: true })
    const updated = usePlannerStore.getState().history.find(h => h.date === '2024-01-07')
    expect(updated?.rewards).toEqual(['Treat'])
  })
})
