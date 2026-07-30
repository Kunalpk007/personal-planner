import { describe, it, expect } from 'vitest'
import {
  getMonthStart, periodStartFor, isWithinPeriod, computeGoalProgress, goalProgressPct,
  computeZoneScore, computeLifeScore, goalPtsEarnedOn,
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

describe('goalPtsEarnedOn', () => {
  it('sums awardedPts for goals completed on the given date', () => {
    const goals = [
      makeGoal({ id: 'g1', completedAt: '2024-01-08T10:00:00.000Z', awardedPts: 20 }),
      makeGoal({ id: 'g2', completedAt: '2024-01-08T18:30:00.000Z', awardedPts: 15 }),
    ]
    expect(goalPtsEarnedOn(goals, '2024-01-08')).toBe(35)
  })

  it('excludes goals completed on a different date', () => {
    const goals = [makeGoal({ completedAt: '2024-01-07T10:00:00.000Z', awardedPts: 20 })]
    expect(goalPtsEarnedOn(goals, '2024-01-08')).toBe(0)
  })

  it('excludes goals that are still open', () => {
    const goals = [makeGoal({ completedAt: null, awardedPts: 20 })]
    expect(goalPtsEarnedOn(goals, '2024-01-08')).toBe(0)
  })

  it('treats a missing awardedPts as 0', () => {
    const goals = [makeGoal({ completedAt: '2024-01-08T10:00:00.000Z' })]
    expect(goalPtsEarnedOn(goals, '2024-01-08')).toBe(0)
  })

  it('treats an undefined goals array as empty', () => {
    expect(goalPtsEarnedOn(undefined, '2024-01-08')).toBe(0)
  })
})

describe('computeZoneScore', () => {
  it('returns 0 for empty history', () => {
    expect(computeZoneScore('Health', [], 30)).toBe(0)
  })

  it('returns 0 when periodDays is 0 (every entry falls outside the window)', () => {
    const history = [makeEntry('2024-01-01', { tasks: [] })]
    expect(computeZoneScore('Health', history, 0)).toBe(0)
  })

  it('recency-weights the window: an older active day scores just under 50', () => {
    const history = [
      makeEntry('2024-01-01', { tasks: [{ title: 'a', priority: 'high', done: true, zone: 'Health', completedAt: null, level: '' }] }),
      makeEntry('2024-01-02', { tasks: [] }),
    ]
    // anchor 01-02: active day (01-01) weight 29, idle anchor weight 30 -> 29/59 = 49
    expect(computeZoneScore('Health', history, 30)).toBe(49)
  })

  it('recency-weights the window: a recent active day scores just over 50', () => {
    const history = [
      makeEntry('2024-01-01', { tasks: [] }),
      makeEntry('2024-01-02', { tasks: [{ title: 'a', priority: 'high', done: true, zone: 'Health', completedAt: null, level: '' }] }),
    ]
    // anchor 01-02: active anchor weight 30, idle 01-01 weight 29 -> 30/59 = 51
    expect(computeZoneScore('Health', history, 30)).toBe(51)
  })

  it('only considers the trailing periodDays calendar window', () => {
    const history = [
      makeEntry('2024-01-01', { tasks: [{ title: 'a', priority: 'high', done: true, zone: 'Health', completedAt: null, level: '' }] }),
      makeEntry('2024-01-02', { tasks: [] }),
      makeEntry('2024-01-03', { tasks: [] }),
    ]
    // periodDays=1 -> only the anchor day (01-03, no Health activity) counts
    expect(computeZoneScore('Health', history, 1)).toBe(0)
  })
})

describe('computeLifeScore', () => {
  it('returns 0 total for no zones', () => {
    expect(computeLifeScore([], [])).toEqual({ total: 0, byZone: {} })
  })

  it('averages engaged zones equally when weight is unset', () => {
    const zones: Zone[] = [{ id: 'z1', name: 'Health', color: '#fff' }, { id: 'z2', name: 'Work', color: '#000' }]
    const history = [
      makeEntry('2024-01-01', { tasks: [{ title: 'a', priority: 'high', done: true, zone: 'z1', completedAt: null, level: '' }] }),
      makeEntry('2024-01-02', { tasks: [{ title: 'b', priority: 'high', done: true, zone: 'z2', completedAt: null, level: '' }] }),
    ]
    const result = computeLifeScore(zones, history, 30)
    expect(result.byZone.z1).toBe(49) // active older day
    expect(result.byZone.z2).toBe(51) // active anchor day
    expect(result.total).toBe(50)     // (49 + 51) / 2
  })

  it('excludes a never-used zone from the total (does not crater the score)', () => {
    const zones: Zone[] = [{ id: 'z1', name: 'Health', color: '#fff' }, { id: 'z2', name: 'Unused', color: '#000' }]
    const history = [
      makeEntry('2024-01-01', { tasks: [{ title: 'a', priority: 'high', done: true, zone: 'z1', completedAt: null, level: '' }] }),
    ]
    const result = computeLifeScore(zones, history, 30)
    expect(result.byZone.z2).toBe(0)  // shown as 0 individually
    expect(result.total).toBe(100)    // but excluded from the total → z1 alone = 100
  })

  it('a previously-used but now-neglected zone still counts against the total', () => {
    const zones: Zone[] = [{ id: 'z1', name: 'Health', color: '#fff' }, { id: 'z2', name: 'Work', color: '#000' }]
    // z2 was done long ago but not in the recent window → engaged, low score.
    const history = [
      makeEntry('2024-01-15', { tasks: [{ title: 'old', priority: 'high', done: true, zone: 'z2', completedAt: null, level: '' }] }),
      makeEntry('2024-03-01', { tasks: [{ title: 'a', priority: 'high', done: true, zone: 'z1', completedAt: null, level: '' }] }),
    ]
    const result = computeLifeScore(zones, history, 30)
    // anchor 03-01; 01-15 is >30 days earlier so out of window → z2 has 0 in-window activity
    expect(result.byZone.z2).toBe(0)
    // but z2 IS engaged (used on 02-01), so it stays in the pool and drags the total below z1's 100
    expect(result.total).toBeLessThan(100)
  })

  it('applies manual weights when set', () => {
    const zones: Zone[] = [
      { id: 'z1', name: 'Health', color: '#fff', weight: 3 },
      { id: 'z2', name: 'Work', color: '#000', weight: 1 },
    ]
    const history = [
      makeEntry('2024-01-01', { tasks: [
        { title: 'a', priority: 'high', done: true, zone: 'z1', completedAt: null, level: '' },
        { title: 'b', priority: 'high', done: true, zone: 'z2', completedAt: null, level: '' },
      ] }),
      makeEntry('2024-01-02', { tasks: [{ title: 'c', priority: 'high', done: true, zone: 'z1', completedAt: null, level: '' }] }),
    ]
    const result = computeLifeScore(zones, history, 30)
    // z1 done both days -> 100; z2 done only older day -> 29/59 = 49
    // weighted (100*3 + 49*1) / 4 = 87
    expect(result.byZone.z1).toBe(100)
    expect(result.byZone.z2).toBe(49)
    expect(result.total).toBe(87)
  })

  it('falls back to a total weight of 1 when all zone weights are 0 (avoids divide-by-zero)', () => {
    const zones: Zone[] = [{ id: 'z1', name: 'Health', color: '#fff', weight: 0 }]
    const result = computeLifeScore(zones, [], 30)
    expect(result.total).toBe(0)
  })
})
