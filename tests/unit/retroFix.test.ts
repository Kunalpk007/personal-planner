import { describe, it, expect } from 'vitest'
import { getFixableDays, retroFixDeadline } from '@/lib/engine/retroFix'
import type { AppState, AppConfig, HistoryEntry, Task } from '@/store/types'

const CFG: AppConfig = {
  minPts: 70, weekendPts: 20, lightDays: [0, 6], lightDaysChangedAt: null, cutoffHour: 1, tone: 'balanced', managerName: 'Manager',
  moodMot: 1.2, moodSick: 0.5, pomoDuration: 25, quoteMorning: true, quoteEvening: true,
  autoExportEnabled: false, theme: 'dark', fontScale: 'normal', waterTargetMl: 2000,
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1', title: 'Task', note: '', zone: 'z1', priority: 'high', slot: '',
    deadline: null, done: false, date: '2024-01-09', createdAt: '2024-01-09T08:00:00.000Z',
    completedAt: null, subtasks: [], level: '', isSpecial: false, specialPts: 0,
    ...overrides,
  }
}

function makeHistoryEntry(date: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    date, done: 0, total: 1, pct: 0, rxp: 20, mood: '', eodMood: '',
    frozen: false, rest: true, auto: true, late: false, tasks: [], rewards: [],
    ...overrides,
  }
}

type FixableState = Pick<AppState, 'history' | 'tasks' | 'retroFixedDays' | 'cfg'>

function makeState(overrides: Partial<FixableState> = {}): FixableState {
  return {
    history: [], tasks: [], retroFixedDays: {}, cfg: CFG,
    ...overrides,
  }
}

describe('getFixableDays', () => {
  it('includes an auto-resolved rest day before its noon-next-day deadline', () => {
    const state = makeState({
      history: [makeHistoryEntry('2024-01-09', { rxp: 20, rest: true, auto: true })],
      tasks: [makeTask({ date: '2024-01-09' })],
    })
    expect(getFixableDays(state, '2024-01-10', new Date('2024-01-10T11:00:00'))).toEqual(['2024-01-09'])
  })

  it('includes an auto-resolved plain miss (streak already broken) before its deadline', () => {
    const state = makeState({
      history: [makeHistoryEntry('2024-01-09', { rxp: 20, rest: false, frozen: false, auto: true })],
      tasks: [makeTask({ date: '2024-01-09' })],
    })
    expect(getFixableDays(state, '2024-01-10', new Date('2024-01-10T09:00:00'))).toEqual(['2024-01-09'])
  })

  it('excludes a day the user deliberately chose (declareRestDay/useFreeze/on-time submit — auto: false)', () => {
    const state = makeState({
      history: [makeHistoryEntry('2024-01-09', { rxp: 0, rest: true, auto: false })],
      tasks: [makeTask({ date: '2024-01-09' })],
    })
    expect(getFixableDays(state, '2024-01-10', new Date('2024-01-10T09:00:00'))).toEqual([])
  })

  it('excludes a frozen day', () => {
    const state = makeState({
      history: [makeHistoryEntry('2024-01-09', { rxp: 0, rest: false, frozen: true, auto: true })],
      tasks: [makeTask({ date: '2024-01-09' })],
    })
    expect(getFixableDays(state, '2024-01-10', new Date('2024-01-10T09:00:00'))).toEqual([])
  })

  it('excludes today and future dates', () => {
    const state = makeState({
      history: [makeHistoryEntry('2024-01-10', { rxp: 20 })],
      tasks: [makeTask({ date: '2024-01-10' })],
    })
    expect(getFixableDays(state, '2024-01-10', new Date('2024-01-10T09:00:00'))).toEqual([])
  })

  it('excludes a day already marked as fixed', () => {
    const state = makeState({
      history: [makeHistoryEntry('2024-01-09', { rxp: 20 })],
      tasks: [makeTask({ date: '2024-01-09' })],
      retroFixedDays: { '2024-01-09': true },
    })
    expect(getFixableDays(state, '2024-01-10', new Date('2024-01-10T09:00:00'))).toEqual([])
  })

  it('excludes a day once its noon-next-day deadline has passed (exactly at the deadline)', () => {
    const state = makeState({
      history: [makeHistoryEntry('2024-01-09', { rxp: 20 })],
      tasks: [makeTask({ date: '2024-01-09' })],
    })
    expect(getFixableDays(state, '2024-01-10', new Date('2024-01-10T12:00:00'))).toEqual([])
  })

  it('includes a day right up until its deadline (11:59am the day after)', () => {
    const state = makeState({
      history: [makeHistoryEntry('2024-01-09', { rxp: 20 })],
      tasks: [makeTask({ date: '2024-01-09' })],
    })
    expect(getFixableDays(state, '2024-01-10', new Date('2024-01-10T11:59:00'))).toEqual(['2024-01-09'])
  })

  it('excludes a day that already met minPts (already fully successful, nothing to fix)', () => {
    const state = makeState({
      history: [makeHistoryEntry('2024-01-09', { rxp: 80, rest: false, auto: true })],
      tasks: [makeTask({ date: '2024-01-09' })],
    })
    expect(getFixableDays(state, '2024-01-10', new Date('2024-01-10T09:00:00'))).toEqual([])
  })

  it('excludes a day with no tasks recorded at all', () => {
    const state = makeState({
      history: [makeHistoryEntry('2024-01-09', { rxp: 0 })],
      tasks: [],
    })
    expect(getFixableDays(state, '2024-01-10', new Date('2024-01-10T09:00:00'))).toEqual([])
  })

  it('defaults `now` to the current time when not provided', () => {
    // A history entry dated far in the past is always well past its
    // noon-next-day deadline relative to whenever this test actually runs.
    const state = makeState({
      history: [makeHistoryEntry('2020-01-01', { rxp: 0 })],
      tasks: [makeTask({ date: '2020-01-01' })],
    })
    expect(getFixableDays(state, '2020-01-02')).toEqual([])
  })

  it('only ever surfaces the single most recent auto-resolved day, never a backlog', () => {
    // Two consecutive auto-resolved misses. By the time "today" is
    // 2024-01-11, 2024-01-09's own deadline (2024-01-10T12:00) has already
    // passed, even though 2024-01-10's deadline (2024-01-11T12:00) is still
    // open — this is what the fixed noon-next-day rule guarantees on its
    // own, without needing an explicit backlog cap.
    const state = makeState({
      history: [
        makeHistoryEntry('2024-01-09', { rxp: 10 }),
        makeHistoryEntry('2024-01-10', { rxp: 10 }),
      ],
      tasks: [makeTask({ date: '2024-01-09' }), makeTask({ date: '2024-01-10' })],
    })
    expect(getFixableDays(state, '2024-01-11', new Date('2024-01-11T09:00:00'))).toEqual(['2024-01-10'])
  })

  it('respects a light day minPts when deciding whether a day already succeeded', () => {
    // 2024-01-06 is a Saturday (light day, minPts=20 per CFG.weekendPts)
    const state = makeState({
      history: [makeHistoryEntry('2024-01-06', { rxp: 20, rest: false, auto: true })],
      tasks: [makeTask({ date: '2024-01-06' })],
    })
    expect(getFixableDays(state, '2024-01-10', new Date('2024-01-10T09:00:00'))).toEqual([]) // 20 >= weekendPts(20), already succeeded
  })
})

describe('retroFixDeadline', () => {
  it('returns noon the day after the given date', () => {
    expect(retroFixDeadline('2024-01-09')).toEqual(new Date('2024-01-10T12:00:00'))
  })

  it('handles a month boundary', () => {
    expect(retroFixDeadline('2024-01-31')).toEqual(new Date('2024-02-01T12:00:00'))
  })
})
