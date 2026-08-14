import { describe, it, expect } from 'vitest'
import { computeWeekRecap } from '@/lib/engine/weeklyReview'
import type { Goal, HistoryEntry, LifestyleCheckin } from '@/store/types'

function makeCheckin(overrides: Partial<LifestyleCheckin> = {}): LifestyleCheckin {
  return { sleep: 'ok', moved: false, stress: 3, at: '2024-01-08T22:00:00.000Z', ...overrides }
}

function makeEntry(date: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    date, done: 3, total: 5, pct: 60, rxp: 40, mood: 'neutral', eodMood: '',
    frozen: false, rest: false, auto: false, late: false, tasks: [], rewards: [],
    ...overrides,
  }
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1', title: 'Goal', cadence: 'weekly', targetType: 'points', target: 100,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// Week of Mon 2024-01-08 .. Sun 2024-01-14
const MONDAY = '2024-01-08'

describe('computeWeekRecap', () => {
  it('sums done/total/rxp across only history entries within the Mon-Sun week', () => {
    const history = [
      makeEntry('2024-01-08', { done: 3, total: 5, rxp: 40 }),
      makeEntry('2024-01-10', { done: 4, total: 4, rxp: 60 }),
      makeEntry('2024-01-14', { done: 2, total: 3, rxp: 20 }),
      makeEntry('2024-01-15', { done: 9, total: 9, rxp: 999 }), // next week — excluded
      makeEntry('2024-01-07', { done: 9, total: 9, rxp: 999 }), // prev week — excluded
    ]
    const recap = computeWeekRecap(MONDAY, history, [], [])
    expect(recap.weekMonday).toBe(MONDAY)
    expect(recap.daysSubmitted).toBe(3)
    expect(recap.tasksDone).toBe(9)
    expect(recap.tasksTotal).toBe(12)
    expect(recap.totalRxp).toBe(120)
  })

  it('counts goals completed within the week by completedAt date', () => {
    const goals = [
      makeGoal({ id: 'g1', completedAt: '2024-01-09T10:00:00.000Z' }),
      makeGoal({ id: 'g2', completedAt: '2024-01-20T10:00:00.000Z' }), // different week
      makeGoal({ id: 'g3', completedAt: null }),
      makeGoal({ id: 'g4' }), // completedAt undefined
    ]
    const recap = computeWeekRecap(MONDAY, [], goals, [])
    expect(recap.goalsCompleted).toBe(1)
  })

  it('counts reward redemptions within the week', () => {
    const redemptions = [
      { date: '2024-01-08' },
      { date: '2024-01-13' },
      { date: '2024-01-20' },
    ]
    const recap = computeWeekRecap(MONDAY, [], [], redemptions)
    expect(recap.rewardsRedeemed).toBe(2)
  })

  it('returns all zeros/nulls for a week with no data', () => {
    const recap = computeWeekRecap(MONDAY, [], [], [])
    expect(recap).toEqual({
      weekMonday: MONDAY, daysSubmitted: 0, tasksDone: 0, tasksTotal: 0,
      goalsCompleted: 0, rewardsRedeemed: 0, totalRxp: 0,
      avgSleep: null, daysMoved: 0, daysWithLifestyle: 0, avgStress: null, correlationNote: null,
    })
  })

  it('defaults lifestyleCheckins to {} when the 5th param is omitted', () => {
    const recap = computeWeekRecap(MONDAY, [], [], [])
    expect(recap.daysWithLifestyle).toBe(0)
  })
})

describe('computeWeekRecap — lifestyle aggregation', () => {
  it('averages sleep (poor=1/ok=2/great=3) and stress across the week, counts days moved', () => {
    const checkins = {
      '2024-01-08': makeCheckin({ sleep: 'poor',  moved: true,  stress: 5 }),
      '2024-01-09': makeCheckin({ sleep: 'great', moved: false, stress: 1 }),
      '2024-01-20': makeCheckin({ sleep: 'poor',  moved: true,  stress: 5 }), // different week — excluded
    }
    const recap = computeWeekRecap(MONDAY, [], [], [], checkins)
    expect(recap.daysWithLifestyle).toBe(2)
    expect(recap.daysMoved).toBe(1)
    expect(recap.avgSleep).toBe(2) // (1 + 3) / 2
    expect(recap.avgStress).toBe(3) // (5 + 1) / 2
  })

  it('returns null averages when no lifestyle check-ins fall within the week', () => {
    const checkins = { '2024-01-20': makeCheckin() } // different week only
    const recap = computeWeekRecap(MONDAY, [], [], [], checkins)
    expect(recap.avgSleep).toBeNull()
    expect(recap.avgStress).toBeNull()
    expect(recap.daysMoved).toBe(0)
    expect(recap.daysWithLifestyle).toBe(0)
  })
})

describe('computeWeekRecap — correlationNote', () => {
  it('returns null with fewer than 2 days that have both completion data and a check-in', () => {
    const history = [makeEntry('2024-01-08', { done: 1, total: 5 })]
    const checkins = { '2024-01-08': makeCheckin({ sleep: 'poor' }) }
    expect(computeWeekRecap(MONDAY, history, [], [], checkins).correlationNote).toBeNull()
  })

  it('returns null when fewer than 2 days fall below the week average completion ratio', () => {
    // Two days, both at the exact same ratio — neither is "below average".
    const history = [
      makeEntry('2024-01-08', { done: 2, total: 4 }),
      makeEntry('2024-01-09', { done: 2, total: 4 }),
    ]
    const checkins = {
      '2024-01-08': makeCheckin({ sleep: 'poor' }),
      '2024-01-09': makeCheckin({ sleep: 'poor' }),
    }
    expect(computeWeekRecap(MONDAY, history, [], [], checkins).correlationNote).toBeNull()
  })

  it('returns null when fewer than half the low-completion days match poor sleep/high stress', () => {
    const history = [
      makeEntry('2024-01-08', { done: 4, total: 4 }),  // high completion
      makeEntry('2024-01-09', { done: 0, total: 4 }),  // low — good sleep, low stress (no match)
      makeEntry('2024-01-10', { done: 0, total: 4 }),  // low — good sleep, low stress (no match)
    ]
    const checkins = {
      '2024-01-08': makeCheckin({ sleep: 'great', stress: 1 }),
      '2024-01-09': makeCheckin({ sleep: 'great', stress: 1 }),
      '2024-01-10': makeCheckin({ sleep: 'great', stress: 1 }),
    }
    expect(computeWeekRecap(MONDAY, history, [], [], checkins).correlationNote).toBeNull()
  })

  it('states the pattern in plain language when a majority of low-completion days match poor sleep or high stress', () => {
    const history = [
      makeEntry('2024-01-08', { done: 4, total: 4 }),  // high completion, not "low"
      makeEntry('2024-01-09', { done: 0, total: 4 }),  // low — poor sleep (match)
      makeEntry('2024-01-10', { done: 1, total: 4 }),  // low — high stress (match)
    ]
    const checkins = {
      '2024-01-08': makeCheckin({ sleep: 'great', stress: 1 }),
      '2024-01-09': makeCheckin({ sleep: 'poor',  stress: 1 }),
      '2024-01-10': makeCheckin({ sleep: 'great', stress: 5 }),
    }
    const note = computeWeekRecap(MONDAY, history, [], [], checkins).correlationNote
    expect(note).toBe('2 of 2 lower-completion days this week followed poor sleep or a high-stress day.')
  })

  it('skips history entries with total=0 (no tasks that day) when computing completion ratios', () => {
    const history = [
      makeEntry('2024-01-08', { done: 0, total: 0 }), // excluded — no tasks
      makeEntry('2024-01-09', { done: 0, total: 4 }),
      makeEntry('2024-01-10', { done: 4, total: 4 }),
    ]
    const checkins = {
      '2024-01-08': makeCheckin({ sleep: 'poor' }),
      '2024-01-09': makeCheckin({ sleep: 'poor' }),
      '2024-01-10': makeCheckin({ sleep: 'great' }),
    }
    // Only 2 days have both total>0 and a check-in — 2024-01-09 is the lone
    // below-average day, which is < 2 low days, so this stays null.
    expect(computeWeekRecap(MONDAY, history, [], [], checkins).correlationNote).toBeNull()
  })

  it('ignores history days that have no matching lifestyle check-in', () => {
    const history = [
      makeEntry('2024-01-08', { done: 4, total: 4 }),
      makeEntry('2024-01-09', { done: 0, total: 4 }), // no check-in — excluded from the correlation calc
      makeEntry('2024-01-10', { done: 0, total: 4 }),
    ]
    const checkins = {
      '2024-01-08': makeCheckin({ sleep: 'great' }),
      '2024-01-10': makeCheckin({ sleep: 'poor' }),
    }
    // Only 2 days qualify (08, 10) — 10 is the sole below-average day, < 2 low days.
    expect(computeWeekRecap(MONDAY, history, [], [], checkins).correlationNote).toBeNull()
  })
})
