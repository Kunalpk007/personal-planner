import { describe, it, expect } from 'vitest'
import {
  getMonthStart, periodStartFor, isWithinPeriod, computeGoalProgress, goalProgressPct,
  computeZoneScore, computeLifeScore,
} from '@/lib/engine/goals'
import type { Goal, HistoryEntry, Task, Zone } from '@/store/types'

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1', title: 'Test goal', cadence: 'weekly', targetType: 'points', target: 100,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeEntry(date: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    date, done: 1, total: 1, pct: 100, rxp: 50, mood: 'neutral', eodMood: '',
    frozen: false, rest: false, auto: false, late: false, tasks: [], rewards: [],
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1', title: 'Task', note: '', zone: '', priority: 'med', slot: '', deadline: null,
    done: true, date: '2024-01-08', createdAt: '', completedAt: null, subtasks: [], level: '',
    isSpecial: false, specialPts: 0,
    ...overrides,
  }
}

describe('getMonthStart', () => {
  it('returns the first day of the month', () => {
    expect(getMonthStart('2024-03-17')).toBe('2024-03-01')
  })
})

describe('periodStartFor', () => {
  it('returns the Monday of the week for weekly cadence', () => {
    expect(periodStartFor('weekly', '2024-01-10')).toBe('2024-01-08')
  })

  it('returns the month start for monthly cadence', () => {
    expect(periodStartFor('monthly', '2024-01-10')).toBe('2024-01-01')
  })
})

describe('isWithinPeriod', () => {
  it('accepts dates within the same ISO week (weekly)', () => {
    expect(isWithinPeriod('2024-01-08', 'weekly', '2024-01-10')).toBe(true) // Monday
    expect(isWithinPeriod('2024-01-14', 'weekly', '2024-01-10')).toBe(true) // Sunday, same week
  })

  it('rejects dates outside the current week (weekly)', () => {
    expect(isWithinPeriod('2024-01-07', 'weekly', '2024-01-10')).toBe(false) // prior Sunday
    expect(isWithinPeriod('2024-01-15', 'weekly', '2024-01-10')).toBe(false) // next Monday
  })

  it('accepts/rejects dates by calendar month (monthly)', () => {
    expect(isWithinPeriod('2024-01-01', 'monthly', '2024-01-31')).toBe(true)
    expect(isWithinPeriod('2024-02-01', 'monthly', '2024-01-31')).toBe(false)
  })
})

describe('computeGoalProgress', () => {
  it('sums rxp across the period for a points goal', () => {
    const goal = makeGoal({ cadence: 'weekly', targetType: 'points', target: 100 })
    const history = [
      makeEntry('2024-01-08', { rxp: 40 }),
      makeEntry('2024-01-09', { rxp: 30 }),
      makeEntry('2024-01-01', { rxp: 999 }), // different week — excluded
    ]
    expect(computeGoalProgress(goal, history, [], '2024-01-10')).toBe(70)
  })

  it('counts completed tasks in a zone for a taskCount goal', () => {
    const goal = makeGoal({ cadence: 'weekly', targetType: 'taskCount', zoneId: 'Health', target: 5 })
    const history = [
      makeEntry('2024-01-08', {
        tasks: [
          { title: 'a', priority: 'high', done: true, zone: 'Health', completedAt: null, level: '' },
          { title: 'b', priority: 'low', done: false, zone: 'Health', completedAt: null, level: '' },
          { title: 'c', priority: 'med', done: true, zone: 'Work', completedAt: null, level: '' },
        ],
      }),
    ]
    expect(computeGoalProgress(goal, history, [], '2024-01-10')).toBe(1)
  })

  it('counts across all zones when zoneId is omitted', () => {
    const goal = makeGoal({ cadence: 'weekly', targetType: 'taskCount', target: 5 })
    const history = [
      makeEntry('2024-01-08', {
        tasks: [
          { title: 'a', priority: 'high', done: true, zone: 'Health', completedAt: null, level: '' },
          { title: 'c', priority: 'med', done: true, zone: 'Work', completedAt: null, level: '' },
        ],
      }),
    ]
    expect(computeGoalProgress(goal, history, [], '2024-01-10')).toBe(2)
  })

  it('includes live (not-yet-submitted) tasks for today when today is not in history', () => {
    const goal = makeGoal({ cadence: 'weekly', targetType: 'taskCount', target: 5 })
    const liveTasks = [makeTask({ date: '2024-01-10', done: true })]
    expect(computeGoalProgress(goal, [], liveTasks, '2024-01-10')).toBe(1)
  })

  it('excludes live tasks from a different zone than the goal', () => {
    const goal = makeGoal({ cadence: 'weekly', targetType: 'taskCount', zoneId: 'Health', target: 5 })
    const liveTasks = [makeTask({ date: '2024-01-10', done: true, zone: 'Work' })]
    expect(computeGoalProgress(goal, [], liveTasks, '2024-01-10')).toBe(0)
  })

  it('does not double-count live tasks when today has already been submitted', () => {
    const goal = makeGoal({ cadence: 'weekly', targetType: 'taskCount', target: 5 })
    const history = [makeEntry('2024-01-10', { tasks: [{ title: 'a', priority: 'high', done: true, zone: '', completedAt: null, level: '' }] })]
    const liveTasks = [makeTask({ date: '2024-01-10', done: true })]
    expect(computeGoalProgress(goal, history, liveTasks, '2024-01-10')).toBe(1)
  })

  it('does not add live tasks toward a points goal (no reliable live pts source)', () => {
    const goal = makeGoal({ cadence: 'weekly', targetType: 'points', target: 100 })
    const liveTasks = [makeTask({ date: '2024-01-10', done: true })]
    expect(computeGoalProgress(goal, [], liveTasks, '2024-01-10')).toBe(0)
  })

  it('for a checklist goal, counts done checklist items regardless of period/history/liveTasks', () => {
    const goal = makeGoal({
      targetType: 'checklist', target: 3,
      checklist: [
        { id: 'i1', title: 'a', done: true },
        { id: 'i2', title: 'b', done: false },
        { id: 'i3', title: 'c', done: true },
      ],
    })
    // history/liveTasks are irrelevant for checklist goals — progress comes
    // purely from the goal's own checklist items.
    expect(computeGoalProgress(goal, [makeEntry('2024-01-01', { rxp: 999 })], [makeTask({ done: true })], '2024-01-10')).toBe(2)
  })

  it('for a checklist goal with no checklist array, progress is 0', () => {
    const goal = makeGoal({ targetType: 'checklist', target: 0 })
    expect(computeGoalProgress(goal, [], [], '2024-01-10')).toBe(0)
  })
})

describe('goalProgressPct', () => {
  it('returns 0 when target is zero or negative', () => {
    expect(goalProgressPct(makeGoal({ target: 0 }), 50)).toBe(0)
  })

  it('computes a rounded percentage', () => {
    expect(goalProgressPct(makeGoal({ target: 200 }), 50)).toBe(25)
  })

  it('caps at 100 when progress exceeds target', () => {
    expect(goalProgressPct(makeGoal({ target: 50 }), 999)).toBe(100)
  })
})

describe('computeZoneScore', () => {
  it('returns 0 for empty history', () => {
    expect(computeZoneScore('Health', [], 30)).toBe(0)
  })

  it('computes the ratio of active days within the trailing window', () => {
    const history = [
      makeEntry('2024-01-01', { tasks: [{ title: 'a', priority: 'high', done: true, zone: 'Health', completedAt: null, level: '' }] }),
      makeEntry('2024-01-02', { tasks: [] }),
    ]
    expect(computeZoneScore('Health', history, 30)).toBe(50)
  })

  it('only considers the trailing periodDays entries', () => {
    const history = [
      makeEntry('2024-01-01', { tasks: [{ title: 'a', priority: 'high', done: true, zone: 'Health', completedAt: null, level: '' }] }),
      makeEntry('2024-01-02', { tasks: [] }),
      makeEntry('2024-01-03', { tasks: [] }),
    ]
    // periodDays=1 -> only the last entry (no Health activity) counts
    expect(computeZoneScore('Health', history, 1)).toBe(0)
  })
})

describe('computeLifeScore', () => {
  it('returns 0 total for no zones', () => {
    expect(computeLifeScore([], [])).toEqual({ total: 0, byZone: {} })
  })

  it('weights zone scores equally when weight is unset', () => {
    const zones: Zone[] = [{ id: 'z1', name: 'Health', color: '#fff' }, { id: 'z2', name: 'Work', color: '#000' }]
    const history = [
      makeEntry('2024-01-01', { tasks: [{ title: 'a', priority: 'high', done: true, zone: 'z1', completedAt: null, level: '' }] }),
    ]
    const result = computeLifeScore(zones, history, 1)
    expect(result.byZone.z1).toBe(100)
    expect(result.byZone.z2).toBe(0)
    expect(result.total).toBe(50)
  })

  it('applies manual weights when set', () => {
    const zones: Zone[] = [
      { id: 'z1', name: 'Health', color: '#fff', weight: 3 },
      { id: 'z2', name: 'Work', color: '#000', weight: 1 },
    ]
    const history = [
      makeEntry('2024-01-01', { tasks: [{ title: 'a', priority: 'high', done: true, zone: 'z1', completedAt: null, level: '' }] }),
    ]
    const result = computeLifeScore(zones, history, 1)
    // (100*3 + 0*1) / 4 = 75
    expect(result.total).toBe(75)
  })

  it('falls back to a total weight of 1 when all zone weights are 0 (avoids divide-by-zero)', () => {
    const zones: Zone[] = [{ id: 'z1', name: 'Health', color: '#fff', weight: 0 }]
    const result = computeLifeScore(zones, [], 30)
    expect(result.total).toBe(0)
  })
})
