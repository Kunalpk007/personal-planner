import { describe, it, expect } from 'vitest'
import { checkStreakMilestone, runOvernightLogic } from '@/lib/engine/streak'
import type { AppState, AppConfig, HistoryEntry, Task } from '@/store/types'

const CFG: AppConfig = {
  minPts: 70, weekendPts: 20, cutoffHour: 1, tone: 'balanced', managerName: 'Manager',
  moodMot: 1.2, moodSick: 0.5, pomoDuration: 25, quoteMorning: true, quoteEvening: true,
  autoExportEnabled: false, theme: 'dark',
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

  it('returns 0 for non-milestone streaks', () => {
    expect(checkStreakMilestone(4)).toBe(0)
    expect(checkStreakMilestone(0)).toBe(0)
  })
})

describe('runOvernightLogic', () => {
  it('returns null overnightMsg when there is no history', () => {
    const state = makeState({ history: [] })
    expect(runOvernightLogic(state, '2024-01-10')).toEqual({ overnightMsg: null })
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
    expect(result.bufferXP).toBe(5)     // floor((80-70)/2)
    expect(result.daysActive).toBe(1)
    expect(result.submittedDays?.['2024-01-09']).toBe(true)
    expect(result.weekDays?.['2024-01-09']).toBe(true)
    expect(result.badges).toHaveLength(1)

    const entry = result.history?.[1]
    expect(entry).toMatchObject({ date: '2024-01-09', done: 4, total: 4, rxp: 80, frozen: false, rest: false })
    expect(entry?.tasks).toHaveLength(4)
    expect(result.overnightMsg).toMatch(/^✅/)
  })

  it('uses a rest day for a missed day that fell short, when the week rest is unused', () => {
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

  it('uses a freeze for a missed day that fell short, when the week rest is already used', () => {
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

    expect(result.freezeTokens).toBe(1)
    expect(result.freezesBought).toBe(0)
    expect(result.freezesUsed).toBe(1)
    expect(result.frozenDays?.['2024-01-09']).toBe(true)
    expect(result.submittedDays?.['2024-01-09']).toBe(true)
    expect(result.streak).toBe(5) // unchanged

    const entry = result.history?.[1]
    expect(entry).toMatchObject({ date: '2024-01-09', rxp: 20, frozen: true, rest: false })
    expect(result.overnightMsg).toMatch(/^❄/)
  })

  it('breaks the streak when no rest day or freeze is available', () => {
    const tasks = [makeTask({ id: 'a', date: '2024-01-09' })] // 20 pts < minPts 70
    const state = makeState({
      history: [makeHistoryEntry('2024-01-08')],
      tasks,
      streak: 5,
      weekRestUsed: { '2024-01-08': true },
      freezeTokens: 0,
    })
    const result = runOvernightLogic(state, '2024-01-10')

    expect(result.streak).toBe(0)
    expect(result.submittedDays?.['2024-01-09']).toBeUndefined()

    const entry = result.history?.[1]
    expect(entry).toMatchObject({ date: '2024-01-09', rxp: 20, frozen: false, rest: false })
    expect(result.overnightMsg).toMatch(/^😔/)
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
