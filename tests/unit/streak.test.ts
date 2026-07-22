import { describe, it, expect } from 'vitest'
import { checkStreakMilestone, runOvernightLogic } from '@/lib/engine/streak'
import type { AppState, AppConfig, HistoryEntry, Task } from '@/store/types'

const CFG: AppConfig = {
  minPts: 70, weekendPts: 20, cutoffHour: 1, tone: 'balanced', managerName: 'Manager',
  moodMot: 1.2, moodSick: 0.5, pomoDuration: 25, quoteMorning: true, quoteEvening: true,
  autoExportEnabled: false, theme: 'dark', fontScale: 'normal',
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1', title: 'Task', note: '', zone: 'z1', priority: 'high', slot: '',
    deadline: null, done: true, date: '2024-01-09', createdAt: '2024-01-09T08:00:00.000Z',
    completedAt: '2024-01-09T08:00:00.000Z', subtasks: [], level: '', isSpecial: false, specialPts: 0,
    ...overrides,
  }
}

function makeHistoryEntry(date: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    date, done: 0, total: 0, pct: 0, rxp: 0, mood: '', eodMood: '',
    frozen: false, rest: false, auto: false, late: false, tasks: [], rewards: [],
    ...overrides,
  }
}

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    history: [], tasks: [], mood: {}, cfg: CFG,
    submittedDays: {}, frozenDays: {}, restDays: {}, weekRestUsed: {}, weekDays: {},
    freezeTokens: 0, freezesBought: 0, freezesUsed: 0,
    streak: 0, bestStreak: 0, daysActive: 0, bufferXP: 0, badges: [],
    ...overrides,
  } as unknown as AppState
}

describe('checkStreakMilestone', () => {
  it('returns the freeze bonus for milestone streaks', () => {
    expect(checkStreakMilestone(3)).toBe(1)
    expect(checkStreakMilestone(200)).toBe(2)
  })

  it('returns 0 for non-milestone streaks and 0', () => {
    expect(checkStreakMilestone(4)).toBe(0)
    expect(checkStreakMilestone(0)).toBe(0)
    expect(checkStreakMilestone(999)).toBe(0)  // not in schedule
  })
})

describe('runOvernightLogic', () => {
  it('returns null overnightMsg when there is no history and no past tasks', () => {
    const state = makeState({ history: [], tasks: [] })
    expect(runOvernightLogic(state, '2024-01-10')).toEqual({ overnightMsg: null })
  })

  it('carries forward incomplete tasks to today when there is no history but tasks exist for yesterday', () => {
    const tasks = [
      makeTask({ id: 'x1', date: '2024-01-09', done: false }),
      makeTask({ id: 'x2', date: '2024-01-09', done: true }),
    ]
    const state = makeState({ history: [], tasks })

    const result = runOvernightLogic(state, '2024-01-10')

    // The undone task should be carried forward to today
    const carried = result.tasks?.filter(t => t.date === '2024-01-10') ?? []
    expect(carried).toHaveLength(1)
    expect(carried[0].carriedDays).toBe(1)
    expect(carried[0].done).toBe(false)
  })

  it('carries forward incomplete tasks when gap=1 (history entry for yesterday, normal daily login)', () => {
    // This is the most common case: user has a history entry for yesterday (gap=1).
    // The main loop does not run when gap=1, so the gap=1 carry path must handle it.
    const tasks = [
      makeTask({ id: 'c1', date: '2024-01-09', done: false }),
      makeTask({ id: 'c2', date: '2024-01-09', done: true }),
    ]
    const state = makeState({ history: [makeHistoryEntry('2024-01-09')], tasks })

    const result = runOvernightLogic(state, '2024-01-10')

    const carried = result.tasks?.filter(t => t.date === '2024-01-10') ?? []
    expect(carried).toHaveLength(1)
    expect(carried[0].carriedDays).toBe(1)
    expect(carried[0].title).toBe(tasks[0].title)
  })

  it('does not create duplicate carries on reload when gap=1', () => {
    // Simulate: carry was already created (from a previous run) and is in state.tasks.
    // Running overnight logic again should not add a second copy.
    const original = makeTask({ id: 'c3', date: '2024-01-09', done: false })
    const existingCarry = makeTask({
      id: 'c3-carry', date: '2024-01-10', done: false,
      title: original.title, zone: original.zone, carriedDays: 1,
    })
    const state = makeState({
      history: [makeHistoryEntry('2024-01-09')],
      tasks: [original, existingCarry],
    })

    const result = runOvernightLogic(state, '2024-01-10')

    const carried = result.tasks?.filter(t => t.date === '2024-01-10') ?? []
    expect(carried).toHaveLength(1) // no duplicate
  })

  it('does NOT carry a task at MAX_CARRY via the gap=1 path', () => {
    const tasks = [
      makeTask({ id: 'maxed-gap1', date: '2024-01-09', done: false, carriedDays: 3 }),
    ]
    const state = makeState({ history: [makeHistoryEntry('2024-01-09')], tasks })

    const result = runOvernightLogic(state, '2024-01-10')

    const carried = result.tasks?.filter(t => t.date === '2024-01-10') ?? []
    expect(carried).toHaveLength(0)
  })

  it('does NOT carry a task that has already been carried MAX_CARRY times', () => {
    const tasks = [
      makeTask({ id: 'maxed', date: '2024-01-09', done: false, carriedDays: 3 }),
    ]
    const state = makeState({ history: [makeHistoryEntry('2024-01-08')], tasks })

    const result = runOvernightLogic(state, '2024-01-10')

    // maxed-out carry should be skipped
    const carried = result.tasks?.filter(t => t.date === '2024-01-10') ?? []
    expect(carried).toHaveLength(0)
  })

  it('sorts history by date to find the true last entry, even when history is unsorted', () => {
    const state = makeState({
      history: [makeHistoryEntry('2024-01-10'), makeHistoryEntry('2024-01-08')],
    })
    const result = runOvernightLogic(state, '2024-01-10')
    expect(result.overnightMsg).toBeNull() // last real date is 2024-01-10 -> no gap
  })

  it('returns null overnightMsg when there is no gap since the last history entry', () => {
    const state = makeState({ history: [makeHistoryEntry('2024-01-10')] })
    const result = runOvernightLogic(state, '2024-01-10')
    expect(result.overnightMsg).toBeNull()
  })

  it('returns null overnightMsg with a one-day gap (no days missed)', () => {
    const state = makeState({ history: [makeHistoryEntry('2024-01-09')], streak: 5 })
    const result = runOvernightLogic(state, '2024-01-10')
    expect(result.overnightMsg).toBeNull()
    expect(result.streak).toBe(5)
  })

  it('auto-submits a missed day that already met minPts, awarding streak/buffer/freeze bonuses', () => {
    const tasks = [
      makeTask({ id: 'a', date: '2024-01-09' }),
      makeTask({ id: 'b', date: '2024-01-09' }),
      makeTask({ id: 'c', date: '2024-01-09' }),
      makeTask({ id: 'd', date: '2024-01-09' }), // 4 x 20 = 80 pts >= minPts 70
    ]
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks,
      streak: 2,      // newStreak = 3 -> milestone bonus = 1
      bestStreak: 2,
    })
    const result = runOvernightLogic(state, '2024-01-10') // gap=2, missed day = 2024-01-09

    expect(result.streak).toBe(3)
    expect(result.bestStreak).toBe(3)
    expect(result.freezeTokens).toBe(1) // milestone bonus
    expect(result.rankXP).toBe(5)       // overflow floor((80-70)/2) folded into rank XP
    expect(result.daysActive).toBe(1)
    expect(result.submittedDays?.['2024-01-09']).toBe(true)
    expect(result.weekDays?.['2024-01-09']).toBe(true)
    expect(result.badges).toHaveLength(1)

    const entry = result.history?.[1]
    expect(entry).toMatchObject({ date: '2024-01-09', done: 4, total: 4, rxp: 80, frozen: false, rest: false })
    expect(entry?.tasks).toHaveLength(4)
    expect(result.overnightMsg).toMatch(/^✅/)
  })

  it('auto-protects a missed day that fell short as a rest day (rest takes precedence)', () => {
    const tasks = [makeTask({ id: 'a', date: '2024-01-09' })] // 20 pts < minPts 70
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks,
      streak: 5,
      weekRestUsed: {},
    })
    const result = runOvernightLogic(state, '2024-01-10')

    expect(result.weekRestUsed?.['2024-01-08']).toBe(true) // Monday of that week
    expect(result.restDays?.['2024-01-09']).toBe(true)
    expect(result.submittedDays?.['2024-01-09']).toBe(true)
    expect(result.daysActive).toBe(1)
    expect(result.streak).toBe(5) // unchanged

    const entry = result.history?.[1]
    expect(entry).toMatchObject({ date: '2024-01-09', rxp: 20, rest: true, frozen: false })
    expect(result.overnightMsg).toMatch(/^🟡/)
  })

  it('still uses a rest day even when the week rest was already used and freezes exist (no weekly cap, rest beats freeze)', () => {
    const tasks = [makeTask({ id: 'a', date: '2024-01-09' })] // 20 pts < minPts 70
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks,
      streak: 5,
      weekRestUsed: { '2024-01-08': true },
      freezeTokens: 2,
      freezesBought: 1,
      freezesUsed: 0,
    })
    const result = runOvernightLogic(state, '2024-01-10')

    // Freeze is never spent — rest day always protects instead.
    expect(result.freezeTokens).toBe(2)
    expect(result.freezesUsed).toBe(0)
    expect(result.restDays?.['2024-01-09']).toBe(true)
    expect(result.frozenDays?.['2024-01-09']).toBeUndefined()
    expect(result.submittedDays?.['2024-01-09']).toBe(true)
    expect(result.streak).toBe(5) // unchanged

    const entry = result.history?.[1]
    expect(entry).toMatchObject({ date: '2024-01-09', rxp: 20, frozen: false, rest: true })
    expect(result.overnightMsg).toMatch(/^🟡/)
  })

  it('never breaks a live streak on a short day — rest day always protects it', () => {
    const tasks = [makeTask({ id: 'a', date: '2024-01-09' })] // 20 pts < minPts 70
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks,
      streak: 5,
      weekRestUsed: { '2024-01-08': true },
      freezeTokens: 0,
    })
    const result = runOvernightLogic(state, '2024-01-10')

    expect(result.streak).toBe(5) // unchanged — never breaks
    expect(result.restDays?.['2024-01-09']).toBe(true)
    expect(result.submittedDays?.['2024-01-09']).toBe(true)

    const entry = result.history?.[1]
    expect(entry).toMatchObject({ date: '2024-01-09', rxp: 20, frozen: false, rest: true })
    expect(result.overnightMsg).toMatch(/^🟡/)
  })

  it('records a plain missed day (no rest) when the streak is already 0', () => {
    const tasks = [makeTask({ id: 'a', date: '2024-01-09' })] // 20 pts < minPts 70
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks,
      streak: 0,
      weekRestUsed: {},
    })
    const result = runOvernightLogic(state, '2024-01-10')

    expect(result.streak).toBe(0)
    expect(result.restDays?.['2024-01-09']).toBeUndefined()
    expect(result.submittedDays?.['2024-01-09']).toBeUndefined()

    const entry = result.history?.[1]
    expect(entry).toMatchObject({ date: '2024-01-09', rxp: 20, frozen: false, rest: false })
    expect(result.overnightMsg).toMatch(/^😔/)
  })

  it('records "special" priority in the task snapshot for special tasks', () => {
    const tasks = [
      makeTask({ id: 'sp', date: '2024-01-09', isSpecial: true, specialPts: 50 }),
    ]
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks,
      streak: 1,
    })
    const result = runOvernightLogic(state, '2024-01-10')
    // 50 pts (no mood) >= minPts 70 is false, so it's rest/freeze/break
    // Either way, the history entry should record the task snapshot
    const entry = result.history?.find(h => h.date === '2024-01-09')
    expect(entry?.tasks[0]?.priority).toBe('special')
  })

  it('records pct=0 for a missed day that has no tasks at all', () => {
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks: [], // no tasks recorded for the missed day
      streak: 0,
    })
    const result = runOvernightLogic(state, '2024-01-10')
    const entry = result.history?.find(h => h.date === '2024-01-09')
    expect(entry).toMatchObject({ date: '2024-01-09', done: 0, total: 0, pct: 0 })
  })

  it('carries forward a blocked incomplete task without incrementing the penalty counter (main loop)', () => {
    const tasks = [
      makeTask({ id: 'blocked1', date: '2024-01-09', done: false, blocked: true } as Partial<Task>),
    ]
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks,
      streak: 5,
    })
    const result = runOvernightLogic(state, '2024-01-10')
    const carried = result.tasks?.find(t => t.date === '2024-01-10')
    expect(carried).toBeDefined()
    expect(carried?.carriedDays).toBe(0)
  })

  it('does not award a milestone bonus for a non-milestone auto-submitted streak', () => {
    const tasks = [
      makeTask({ id: 'a', date: '2024-01-09' }),
      makeTask({ id: 'b', date: '2024-01-09' }),
      makeTask({ id: 'c', date: '2024-01-09' }),
      makeTask({ id: 'd', date: '2024-01-09' }), // 80 pts >= minPts 70
    ]
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks,
      streak: 1, // newStreak = 2, not a milestone
      bestStreak: 1,
    })
    const result = runOvernightLogic(state, '2024-01-10')
    expect(result.streak).toBe(2)
    expect(result.badges).toHaveLength(0)
    expect(result.freezeTokens).toBe(0)
  })

  it('treats a missing freezeTokens count as 0 when awarding a milestone bonus', () => {
    const tasks = [
      makeTask({ id: 'a', date: '2024-01-09' }),
      makeTask({ id: 'b', date: '2024-01-09' }),
      makeTask({ id: 'c', date: '2024-01-09' }),
      makeTask({ id: 'd', date: '2024-01-09' }), // 80 pts >= minPts 70
    ]
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks,
      streak: 2, // newStreak = 3 -> milestone bonus = 1
      bestStreak: 2,
      freezeTokens: undefined,
    } as Partial<AppState>)
    const result = runOvernightLogic(state, '2024-01-10')
    expect(result.freezeTokens).toBe(1)
  })

  it('treats a missing daysActive count as 0 on an auto-submitted day', () => {
    const tasks = [
      makeTask({ id: 'a', date: '2024-01-09' }),
      makeTask({ id: 'b', date: '2024-01-09' }),
      makeTask({ id: 'c', date: '2024-01-09' }),
      makeTask({ id: 'd', date: '2024-01-09' }), // 80 pts >= minPts 70
    ]
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks,
      streak: 1,
      bestStreak: 1,
      daysActive: undefined,
    } as Partial<AppState>)
    const result = runOvernightLogic(state, '2024-01-10')
    expect(result.daysActive).toBe(1)
  })

  it('treats a missing daysActive count as 0 on a rest-day-protected auto-submit', () => {
    const tasks = [makeTask({ id: 'a', date: '2024-01-09' })] // 20 pts < minPts 70
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks,
      streak: 5,
      weekRestUsed: {},
      daysActive: undefined,
    } as Partial<AppState>)
    const result = runOvernightLogic(state, '2024-01-10')
    expect(result.daysActive).toBe(1)
  })

  it('carries forward a blocked incomplete task without penalty via the gap=1 path', () => {
    const tasks = [
      makeTask({ id: 'blocked-gap1', date: '2024-01-09', done: false, blocked: true } as Partial<Task>),
    ]
    const state = makeState({ history: [makeHistoryEntry('2024-01-09')], tasks })

    const result = runOvernightLogic(state, '2024-01-10')

    const carried = result.tasks?.filter(t => t.date === '2024-01-10') ?? []
    expect(carried).toHaveLength(1)
    expect(carried[0].carriedDays).toBe(0)
  })

  it('skips days that were already submitted, rested, or frozen', () => {
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks: [],
      submittedDays: { '2024-01-09': true },
      streak: 3,
    })
    const result = runOvernightLogic(state, '2024-01-10')

    // 2024-01-09 is the only missed day and is skipped, so no new history entry is added
    expect(result.history).toHaveLength(1)
    expect(result.overnightMsg).toBeNull()
    expect(result.streak).toBe(3)
  })
})
