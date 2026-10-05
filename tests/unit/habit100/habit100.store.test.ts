import { describe, it, expect, beforeEach } from 'vitest'
import { useHabit100Store, partializeHabit100 } from '@/store/habit100/habit100.store'
import type { HabitDef, Habit100Day, Habit100Meta, Habit100Week } from '@/store/habit100/types'

function habit(overrides: Partial<HabitDef> = {}): HabitDef {
  return { id: 'h1', label: 'Habit', type: 'checkbox', counted: true, ...overrides }
}

beforeEach(() => {
  useHabit100Store.setState({ uid: null, loaded: false, meta: null, days: {}, weeks: {} })
})

describe('partializeHabit100', () => {
  it('persists only meta/days/weeks, not uid/loaded/actions', () => {
    const state = useHabit100Store.getState()
    expect(partializeHabit100(state)).toEqual({ meta: null, days: {}, weeks: {} })
  })
})

describe('init', () => {
  it('sets uid and loaded', () => {
    useHabit100Store.getState().init('user-1')
    expect(useHabit100Store.getState().uid).toBe('user-1')
    expect(useHabit100Store.getState().loaded).toBe(true)
  })
  it('accepts a null uid (anonymous)', () => {
    useHabit100Store.getState().init(null)
    expect(useHabit100Store.getState().uid).toBeNull()
    expect(useHabit100Store.getState().loaded).toBe(true)
  })
})

describe('setupTracker', () => {
  it('creates meta with the given habits/dates/threshold/goals', () => {
    useHabit100Store.getState().setupTracker([habit()], '2026-01-01', 80, ['Goal A'])
    const meta = useHabit100Store.getState().meta!
    expect(meta.startDate).toBe('2026-01-01')
    expect(meta.totalDays).toBe(100)
    expect(meta.disciplinedThresholdPct).toBe(80)
    expect(meta.habits).toHaveLength(1)
    expect(meta.goals).toEqual(['Goal A'])
    expect(meta.badges).toEqual([])
  })

  it('caps goals at 3', () => {
    useHabit100Store.getState().setupTracker([habit()], '2026-01-01', 80, ['A', 'B', 'C', 'D'])
    expect(useHabit100Store.getState().meta!.goals).toEqual(['A', 'B', 'C'])
  })
})

describe('setDayValue', () => {
  beforeEach(() => {
    useHabit100Store.getState().setupTracker([habit()], '2026-01-01', 80, [])
  })

  it('creates a day record on first write', () => {
    useHabit100Store.getState().setDayValue('2026-01-01', 'h1', true)
    expect(useHabit100Store.getState().days['2026-01-01'].values.h1).toBe(true)
  })

  it('deletes the key when value is undefined', () => {
    useHabit100Store.getState().setDayValue('2026-01-01', 'h1', true)
    useHabit100Store.getState().setDayValue('2026-01-01', 'h1', undefined)
    expect(useHabit100Store.getState().days['2026-01-01'].values.h1).toBeUndefined()
  })

  it('deletes the key when value is an empty string', () => {
    useHabit100Store.getState().setDayValue('2026-01-01', 'notes', 'something')
    useHabit100Store.getState().setDayValue('2026-01-01', 'notes', '')
    expect(useHabit100Store.getState().days['2026-01-01'].values.notes).toBeUndefined()
  })

  it('is a no-op once the day is locked', () => {
    useHabit100Store.getState().setDayValue('2026-01-01', 'h1', true)
    useHabit100Store.getState().lockDay('2026-01-01')
    useHabit100Store.getState().setDayValue('2026-01-01', 'h1', false)
    expect(useHabit100Store.getState().days['2026-01-01'].values.h1).toBe(true)
  })
})

describe('setDayExtra', () => {
  beforeEach(() => {
    useHabit100Store.getState().setupTracker([habit()], '2026-01-01', 80, [])
  })

  it('sets an extra field on a new day', () => {
    useHabit100Store.getState().setDayExtra('2026-01-01', 'mood', 8)
    expect(useHabit100Store.getState().days['2026-01-01'].mood).toBe(8)
  })

  it('deletes the field when value is undefined', () => {
    useHabit100Store.getState().setDayExtra('2026-01-01', 'gratitude', 'thanks')
    useHabit100Store.getState().setDayExtra('2026-01-01', 'gratitude', undefined)
    expect(useHabit100Store.getState().days['2026-01-01'].gratitude).toBeUndefined()
  })

  it('deletes the field when value is an empty string', () => {
    useHabit100Store.getState().setDayExtra('2026-01-01', 'wrong', 'oops')
    useHabit100Store.getState().setDayExtra('2026-01-01', 'wrong', '')
    expect(useHabit100Store.getState().days['2026-01-01'].wrong).toBeUndefined()
  })

  it('is a no-op once the day is locked', () => {
    useHabit100Store.getState().setDayExtra('2026-01-01', 'weight', 70)
    useHabit100Store.getState().lockDay('2026-01-01')
    useHabit100Store.getState().setDayExtra('2026-01-01', 'weight', 71)
    expect(useHabit100Store.getState().days['2026-01-01'].weight).toBe(70)
  })
})

describe('lockDay', () => {
  it('creates and locks a day that never had any data', () => {
    useHabit100Store.getState().lockDay('2026-01-01')
    expect(useHabit100Store.getState().days['2026-01-01'].locked).toBe(true)
  })
})

describe('saveWeeklyReview', () => {
  it('stores a week record keyed by weekIndex', () => {
    useHabit100Store.getState().saveWeeklyReview(3, 'worked well', 'change this')
    expect(useHabit100Store.getState().weeks[3]).toMatchObject({ weekIndex: 3, worked: 'worked well', change: 'change this' })
  })
})

describe('unlockMilestone', () => {
  it('is a no-op when there is no tracker set up yet', () => {
    useHabit100Store.getState().unlockMilestone(25)
    expect(useHabit100Store.getState().meta).toBeNull()
  })

  it('adds a milestone to meta.badges', () => {
    useHabit100Store.getState().setupTracker([habit()], '2026-01-01', 80, [])
    useHabit100Store.getState().unlockMilestone(25)
    expect(useHabit100Store.getState().meta!.badges).toEqual([25])
  })

  it('does not duplicate an already-unlocked milestone', () => {
    useHabit100Store.getState().setupTracker([habit()], '2026-01-01', 80, [])
    useHabit100Store.getState().unlockMilestone(25)
    useHabit100Store.getState().unlockMilestone(25)
    expect(useHabit100Store.getState().meta!.badges).toEqual([25])
  })
})

describe('resetTracker', () => {
  it('clears meta/days/weeks', () => {
    useHabit100Store.getState().setupTracker([habit()], '2026-01-01', 80, [])
    useHabit100Store.getState().setDayValue('2026-01-01', 'h1', true)
    useHabit100Store.getState().saveWeeklyReview(1, 'a', 'b')
    useHabit100Store.getState().resetTracker()
    const s = useHabit100Store.getState()
    expect(s.meta).toBeNull()
    expect(s.days).toEqual({})
    expect(s.weeks).toEqual({})
  })
})

describe('mergeFromCloud', () => {
  function cloudMeta(overrides: Partial<Habit100Meta> = {}): Habit100Meta {
    return { startDate: '2026-01-01', totalDays: 100, disciplinedThresholdPct: 80, habits: [habit()], goals: [], badges: [], createdAt: 't0', updatedAt: 't0', ...overrides }
  }
  function cloudDay(date: string, updatedAt: string, overrides: Partial<Habit100Day> = {}): Habit100Day {
    return { date, values: {}, locked: false, updatedAt, ...overrides }
  }
  function cloudWeek(weekIndex: number, updatedAt: string, overrides: Partial<Habit100Week> = {}): Habit100Week {
    return { weekIndex, worked: '', change: '', updatedAt, ...overrides }
  }

  it('adopts cloud meta when local has none', () => {
    useHabit100Store.getState().mergeFromCloud(cloudMeta(), [], [])
    expect(useHabit100Store.getState().meta).toEqual(cloudMeta())
  })

  it('keeps local meta when cloud is null', () => {
    useHabit100Store.getState().setupTracker([habit()], '2026-01-01', 80, [])
    const local = useHabit100Store.getState().meta
    useHabit100Store.getState().mergeFromCloud(null, [], [])
    expect(useHabit100Store.getState().meta).toEqual(local)
  })

  it('prefers newer cloud meta over older local meta', () => {
    useHabit100Store.setState({ meta: cloudMeta({ updatedAt: '2026-01-01T00:00:00.000Z' }) })
    const newer = cloudMeta({ updatedAt: '2026-02-01T00:00:00.000Z', disciplinedThresholdPct: 90 })
    useHabit100Store.getState().mergeFromCloud(newer, [], [])
    expect(useHabit100Store.getState().meta!.disciplinedThresholdPct).toBe(90)
  })

  it('keeps newer local meta over older cloud meta', () => {
    useHabit100Store.setState({ meta: cloudMeta({ updatedAt: '2026-02-01T00:00:00.000Z', disciplinedThresholdPct: 95 }) })
    const older = cloudMeta({ updatedAt: '2026-01-01T00:00:00.000Z' })
    useHabit100Store.getState().mergeFromCloud(older, [], [])
    expect(useHabit100Store.getState().meta!.disciplinedThresholdPct).toBe(95)
  })

  it('merges per-day docs: adds missing, updates older, keeps newer local', () => {
    useHabit100Store.setState({
      days: {
        '2026-01-01': cloudDay('2026-01-01', '2026-01-01T10:00:00.000Z', { values: { h1: true } }), // newer local
      },
    })
    useHabit100Store.getState().mergeFromCloud(null, [
      cloudDay('2026-01-01', '2026-01-01T05:00:00.000Z', { values: { h1: false } }), // older cloud — ignored
      cloudDay('2026-01-02', '2026-01-02T00:00:00.000Z', { values: { h1: true } }),  // new — adopted
    ], [])
    const days = useHabit100Store.getState().days
    expect(days['2026-01-01'].values.h1).toBe(true) // local kept
    expect(days['2026-01-02'].values.h1).toBe(true) // cloud adopted
  })

  it('merges per-week docs the same way', () => {
    useHabit100Store.setState({ weeks: { 1: cloudWeek(1, '2026-01-10T00:00:00.000Z', { worked: 'local' }) } })
    useHabit100Store.getState().mergeFromCloud(null, [], [
      cloudWeek(1, '2026-01-01T00:00:00.000Z', { worked: 'stale-cloud' }), // older — ignored
      cloudWeek(2, '2026-01-02T00:00:00.000Z', { worked: 'new-cloud' }),   // new — adopted
    ])
    const weeks = useHabit100Store.getState().weeks
    expect(weeks[1].worked).toBe('local')
    expect(weeks[2].worked).toBe('new-cloud')
  })
})
