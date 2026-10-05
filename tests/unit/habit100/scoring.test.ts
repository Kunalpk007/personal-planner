import { describe, it, expect } from 'vitest'
import {
  timeStrToMinutes, minutesToTimeStr, isHabitDone, dayStats, isDisciplined, programDayIndex,
  currentStreak, bestStreak, overallPct, weekPct, habitBreakdown, mostBrokenHabit, cellStatus,
  checkNewMilestone, MILESTONE_DAYS,
} from '@/lib/habit100/scoring'
import type { HabitDef, Habit100Day, Habit100Meta } from '@/store/habit100/types'

function makeHabit(overrides: Partial<HabitDef> = {}): HabitDef {
  return { id: 'h1', label: 'Habit', type: 'checkbox', counted: true, ...overrides }
}

function makeMeta(overrides: Partial<Habit100Meta> = {}): Habit100Meta {
  return {
    startDate: '2026-01-01', totalDays: 100, disciplinedThresholdPct: 80,
    habits: [makeHabit()], goals: [], badges: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeDay(date: string, overrides: Partial<Habit100Day> = {}): Habit100Day {
  return { date, values: {}, locked: false, updatedAt: '2026-01-01T00:00:00.000Z', ...overrides }
}

describe('timeStrToMinutes', () => {
  it('parses a valid HH:MM string', () => {
    expect(timeStrToMinutes('09:05')).toBe(545)
    expect(timeStrToMinutes('00:00')).toBe(0)
    expect(timeStrToMinutes('23:59')).toBe(1439)
  })
  it('returns null for an invalid string', () => {
    expect(timeStrToMinutes('')).toBeNull()
    expect(timeStrToMinutes('9:5')).toBeNull()
    expect(timeStrToMinutes('not-a-time')).toBeNull()
  })
})

describe('minutesToTimeStr', () => {
  it('formats minutes as HH:MM', () => {
    expect(minutesToTimeStr(545)).toBe('09:05')
    expect(minutesToTimeStr(0)).toBe('00:00')
  })
  it('wraps past 24 hours', () => {
    expect(minutesToTimeStr(1440)).toBe('00:00')
    expect(minutesToTimeStr(1500)).toBe('01:00')
  })
})

describe('isHabitDone', () => {
  it('is false for undefined/null values regardless of type', () => {
    expect(isHabitDone(makeHabit({ type: 'checkbox' }), undefined)).toBe(false)
    expect(isHabitDone(makeHabit({ type: 'checkbox' }), null as unknown as undefined)).toBe(false)
  })
  it('checkbox: only true counts as done', () => {
    const h = makeHabit({ type: 'checkbox' })
    expect(isHabitDone(h, true)).toBe(true)
    expect(isHabitDone(h, false)).toBe(false)
  })
  it('text: non-empty trimmed string counts as done', () => {
    const h = makeHabit({ type: 'text' })
    expect(isHabitDone(h, 'hello')).toBe(true)
    expect(isHabitDone(h, '   ')).toBe(false)
    expect(isHabitDone(h, '')).toBe(false)
  })
  it('numeric: false when value is not a number', () => {
    const h = makeHabit({ type: 'numeric', target: 10, comparison: 'gte' })
    expect(isHabitDone(h, 'oops' as unknown as number)).toBe(false)
  })
  it('numeric: false when habit has no target', () => {
    const h = makeHabit({ type: 'numeric' })
    expect(isHabitDone(h, 50)).toBe(false)
  })
  it('numeric: gte comparison', () => {
    const h = makeHabit({ type: 'numeric', target: 8000, comparison: 'gte' })
    expect(isHabitDone(h, 8000)).toBe(true)
    expect(isHabitDone(h, 7999)).toBe(false)
  })
  it('numeric: lte comparison', () => {
    const h = makeHabit({ type: 'numeric', target: 4, comparison: 'lte' })
    expect(isHabitDone(h, 4)).toBe(true)
    expect(isHabitDone(h, 5)).toBe(false)
  })
  it('time: behaves like numeric (minutes-since-midnight)', () => {
    const h = makeHabit({ type: 'time', target: 540, comparison: 'lte' })
    expect(isHabitDone(h, 500)).toBe(true)
    expect(isHabitDone(h, 600)).toBe(false)
  })
  it('falls back to false for an unrecognized habit type', () => {
    const h = makeHabit({ type: 'bogus' as unknown as HabitDef['type'] })
    expect(isHabitDone(h, 'anything')).toBe(false)
  })
})

describe('dayStats / isDisciplined', () => {
  it('dayStats returns zeros when day is undefined', () => {
    const meta = makeMeta()
    expect(dayStats(meta, undefined)).toEqual({ countedTotal: 1, countedDone: 0, pct: 0 })
  })
  it('dayStats returns zeros when there are no counted habits', () => {
    const meta = makeMeta({ habits: [makeHabit({ counted: false })] })
    const day = makeDay('2026-01-01')
    expect(dayStats(meta, day)).toEqual({ countedTotal: 0, countedDone: 0, pct: 0 })
  })
  it('dayStats computes pct from counted habits only', () => {
    const meta = makeMeta({ habits: [makeHabit({ id: 'a', counted: true }), makeHabit({ id: 'b', counted: true }), makeHabit({ id: 'c', counted: false })] })
    const day = makeDay('2026-01-01', { values: { a: true, b: false, c: true } })
    expect(dayStats(meta, day)).toEqual({ countedTotal: 2, countedDone: 1, pct: 50 })
  })
  it('isDisciplined is false when day is undefined', () => {
    expect(isDisciplined(makeMeta(), undefined)).toBe(false)
  })
  it('isDisciplined compares pct against the threshold', () => {
    const meta = makeMeta({ habits: [makeHabit({ id: 'a' }), makeHabit({ id: 'b' })], disciplinedThresholdPct: 50 })
    expect(isDisciplined(meta, makeDay('d', { values: { a: true, b: false } }))).toBe(true) // 50 >= 50
    expect(isDisciplined(meta, makeDay('d', { values: { a: false, b: false } }))).toBe(false)
  })
})

describe('programDayIndex', () => {
  it('returns 1 on the start date', () => {
    expect(programDayIndex('2026-01-01', '2026-01-01')).toBe(1)
  })
  it('returns the correct day number later in the run', () => {
    expect(programDayIndex('2026-01-01', '2026-01-10')).toBe(10)
  })
  it('returns <=0 before the start date', () => {
    expect(programDayIndex('2026-01-10', '2026-01-01')).toBe(-8)
  })
})

describe('currentStreak', () => {
  const meta = makeMeta({ habits: [makeHabit()], disciplinedThresholdPct: 100 })

  it('counts from today when today is already disciplined', () => {
    const days = [
      makeDay('2026-01-01', { values: { h1: true } }),
      makeDay('2026-01-02', { values: { h1: true } }),
      makeDay('2026-01-03', { values: { h1: true } }),
    ]
    expect(currentStreak(meta, days, '2026-01-03')).toBe(3)
  })

  it('starts from yesterday when today is not yet disciplined (in-progress day)', () => {
    const days = [
      makeDay('2026-01-01', { values: { h1: true } }),
      makeDay('2026-01-02', { values: { h1: true } }),
      // 2026-01-03 (today) has no data yet
    ]
    expect(currentStreak(meta, days, '2026-01-03')).toBe(2)
  })

  it('is 0 when there is no streak at all', () => {
    expect(currentStreak(meta, [], '2026-01-05')).toBe(0)
  })

  it('stops exactly at the start date boundary (inclusive)', () => {
    const days = [
      makeDay('2026-01-01', { values: { h1: true } }), // = meta.startDate
      makeDay('2026-01-02', { values: { h1: true } }),
    ]
    expect(currentStreak(meta, days, '2026-01-02')).toBe(2)
  })

  it('breaks on a day that exists but is not disciplined', () => {
    const days = [
      makeDay('2026-01-01', { values: { h1: true } }),
      makeDay('2026-01-02', { values: { h1: false } }),
      makeDay('2026-01-03', { values: { h1: true } }),
    ]
    expect(currentStreak(meta, days, '2026-01-03')).toBe(1)
  })
})

describe('bestStreak', () => {
  const meta = makeMeta({ habits: [makeHabit()], disciplinedThresholdPct: 100 })

  it('finds the longest run across the whole recorded history', () => {
    const days = [
      makeDay('2026-01-01', { values: { h1: true } }),
      makeDay('2026-01-02', { values: { h1: true } }),
      makeDay('2026-01-03', { values: { h1: false } }),
      makeDay('2026-01-04', { values: { h1: true } }),
      makeDay('2026-01-05', { values: { h1: true } }),
      makeDay('2026-01-06', { values: { h1: true } }),
    ]
    expect(bestStreak(meta, days, '2026-01-06')).toBe(3)
  })

  it('is 0 with no disciplined days at all', () => {
    expect(bestStreak(meta, [], '2026-01-05')).toBe(0)
  })

  it('clamps the end of the range to the start date when today is before it', () => {
    expect(bestStreak(meta, [], '2025-12-20')).toBe(0)
  })
})

describe('overallPct / weekPct', () => {
  it('overallPct is 0 with no counted habits', () => {
    const meta = makeMeta({ habits: [makeHabit({ counted: false })] })
    expect(overallPct(meta, [], '2026-01-01')).toBe(0)
  })

  it('overallPct skips today when it has no data yet, but counts every other day in range (missing or not)', () => {
    const meta = makeMeta({ habits: [makeHabit()] })
    // 2026-01-02 has no record at all and is NOT today — still counts as a miss.
    // 2026-01-03 (today) has no record either, but IS today — skipped entirely.
    const days = [makeDay('2026-01-01', { values: { h1: true } })]
    // range counted = 01-01 (done) + 01-02 (no record -> miss); 01-03 skipped (today, empty)
    expect(overallPct(meta, days, '2026-01-03')).toBe(50)
  })

  it('overallPct counts today once it has any data', () => {
    const meta = makeMeta({ habits: [makeHabit()] })
    const days = [makeDay('2026-01-01', { values: { h1: true } })]
    expect(overallPct(meta, days, '2026-01-01')).toBe(100)
  })

  it('overallPct is 0 when the counted date range is empty (today not started, nothing before it)', () => {
    const meta = makeMeta({ habits: [makeHabit()], startDate: '2026-01-01' })
    expect(overallPct(meta, [], '2026-01-01')).toBe(0)
  })

  it('weekPct is 0 with no counted habits', () => {
    const meta = makeMeta({ habits: [makeHabit({ counted: false })] })
    expect(weekPct(meta, [], '2026-01-05', '2026-01-08')).toBe(0)
  })

  it('weekPct scopes to only the dates within that week', () => {
    const meta = makeMeta({ habits: [makeHabit()], startDate: '2025-12-01' })
    const days = [
      makeDay('2025-12-29', { values: { h1: false } }), // prior week — excluded
      makeDay('2026-01-05', { values: { h1: true } }),  // Monday of the target week
      makeDay('2026-01-06', { values: { h1: true } }),
    ]
    // Week of 2026-01-05 (Mon) .. 2026-01-11 (Sun); today = 01-06
    expect(weekPct(meta, days, '2026-01-05', '2026-01-06')).toBe(100)
  })

  it('weekPct is 0 when nothing in that week falls within the counted range', () => {
    const meta = makeMeta({ habits: [makeHabit()], startDate: '2026-02-01' })
    // Week requested is entirely before the tracker's start date
    expect(weekPct(meta, [], '2026-01-05', '2026-02-01')).toBe(0)
  })
})

describe('habitBreakdown', () => {
  it('returns 0% per habit when the date range is empty', () => {
    const meta = makeMeta({ habits: [makeHabit({ id: 'a' }), makeHabit({ id: 'b' })], startDate: '2026-01-01' })
    expect(habitBreakdown(meta, [], '2026-01-01')).toEqual([
      { habitId: 'a', label: 'Habit', pct: 0 },
      { habitId: 'b', label: 'Habit', pct: 0 },
    ])
  })

  it('computes a per-habit completion % across the counted range', () => {
    const meta = makeMeta({ habits: [makeHabit({ id: 'a' })], startDate: '2026-01-01' })
    const days = [
      makeDay('2026-01-01', { values: { a: true } }),
      makeDay('2026-01-02', { values: { a: false } }),
    ]
    expect(habitBreakdown(meta, days, '2026-01-02')).toEqual([{ habitId: 'a', label: 'Habit', pct: 50 }])
  })
})

describe('mostBrokenHabit', () => {
  it('returns null when the date range is empty', () => {
    const meta = makeMeta({ startDate: '2026-01-01' })
    expect(mostBrokenHabit(meta, [], '2026-01-01')).toBeNull()
  })

  it('returns null when there are no habits at all', () => {
    const meta = makeMeta({ habits: [], startDate: '2026-01-01' })
    const days = [makeDay('2026-01-01')]
    expect(mostBrokenHabit(meta, days, '2026-01-01')).toBeNull()
  })

  it('returns null when nothing is broken (100% across the board)', () => {
    const meta = makeMeta({ habits: [makeHabit({ id: 'a' })], startDate: '2026-01-01' })
    const days = [makeDay('2026-01-01', { values: { a: true } })]
    expect(mostBrokenHabit(meta, days, '2026-01-01')).toBeNull()
  })

  it('identifies the worst-performing counted habit', () => {
    const meta = makeMeta({ habits: [makeHabit({ id: 'a', label: 'Good' }), makeHabit({ id: 'b', label: 'Bad' })], startDate: '2026-01-01' })
    const days = [
      makeDay('2026-01-01', { values: { a: true, b: false } }),
      makeDay('2026-01-02', { values: { a: true, b: false } }),
    ]
    expect(mostBrokenHabit(meta, days, '2026-01-02')).toEqual({ habitId: 'b', label: 'Bad', missedCount: 2, totalCount: 2 })
  })
})

describe('cellStatus', () => {
  const meta = makeMeta({ habits: [makeHabit()], disciplinedThresholdPct: 80 })

  it('future for a date after today', () => {
    expect(cellStatus(meta, undefined, '2026-01-10', '2026-01-05')).toBe('future')
  })
  it('today for the current date, regardless of data', () => {
    expect(cellStatus(meta, undefined, '2026-01-05', '2026-01-05')).toBe('today')
  })
  it('missed when there is no record at all for a past date', () => {
    expect(cellStatus(meta, undefined, '2026-01-01', '2026-01-05')).toBe('missed')
  })
  it('missed when the day exists but scored 0%', () => {
    const day = makeDay('2026-01-01', { values: { h1: false } })
    expect(cellStatus(meta, day, '2026-01-01', '2026-01-05')).toBe('missed')
  })
  it('partial when below the disciplined threshold but above 0', () => {
    const meta2 = makeMeta({ habits: [makeHabit({ id: 'a' }), makeHabit({ id: 'b' })], disciplinedThresholdPct: 80 })
    const day = makeDay('2026-01-01', { values: { a: true, b: false } }) // 50%
    expect(cellStatus(meta2, day, '2026-01-01', '2026-01-05')).toBe('partial')
  })
  it('disciplined when at/above the threshold', () => {
    const day = makeDay('2026-01-01', { values: { h1: true } })
    expect(cellStatus(meta, day, '2026-01-01', '2026-01-05')).toBe('disciplined')
  })
})

describe('checkNewMilestone', () => {
  it('returns null when no threshold has been crossed yet', () => {
    expect(checkNewMilestone(10, [])).toBeNull()
  })
  it('returns the crossed milestone when not yet unlocked', () => {
    expect(checkNewMilestone(25, [])).toBe(25)
  })
  it('returns null once that milestone is already unlocked', () => {
    expect(checkNewMilestone(25, [25])).toBeNull()
  })
  it('returns the earliest un-unlocked milestone when multiple are crossed at once', () => {
    expect(checkNewMilestone(100, [])).toBe(25)
    expect(checkNewMilestone(100, [25, 50])).toBe(75)
  })
  it('returns null once every milestone is unlocked', () => {
    expect(checkNewMilestone(100, [...MILESTONE_DAYS])).toBeNull()
  })
})
