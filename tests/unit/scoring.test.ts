import { describe, it, expect } from 'vitest'
import {
  basePts, calcPts, getMoodMult, todayEarned, todayTarget, walletPtsFor, getMinPts, getMoodAdjustedMinPts,
} from '@/lib/engine/scoring'
import type { Task, AppConfig } from '@/store/types'

const CFG: AppConfig = {
  minPts: 70, weekendPts: 20, cutoffHour: 1, tone: 'balanced', managerName: 'Manager',
  moodMot: 1.2, moodSick: 0.5, pomoDuration: 25, quoteMorning: true, quoteEvening: true,
  autoExportEnabled: false, theme: 'dark',
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1', title: 'Task', note: '', zone: 'z1', priority: 'high', slot: '',
    deadline: null, done: false, date: '2024-01-08', createdAt: '2024-01-08T08:00:00.000Z',
    completedAt: null, subtasks: [], level: '', isSpecial: false, specialPts: 0,
    ...overrides,
  }
}

describe('basePts', () => {
  it('returns priority points for normal tasks', () => {
    expect(basePts(makeTask({ priority: 'high' }))).toBe(20)
    expect(basePts(makeTask({ priority: 'med' }))).toBe(12)
    expect(basePts(makeTask({ priority: 'low' }))).toBe(6)
  })

  it('returns specialPts for special tasks', () => {
    expect(basePts(makeTask({ isSpecial: true, specialPts: 35 }))).toBe(35)
  })

  it('falls back to 10 when priority is not a known key', () => {
    expect(basePts(makeTask({ priority: 'unknown' as any }))).toBe(10)
  })
})

describe('calcPts', () => {
  it('returns base points when completed on time with no deadline', () => {
    expect(calcPts(makeTask({ priority: 'high' }))).toBe(20)
  })

  it('applies 0.7 multiplier when completed within 1hr of deadline', () => {
    const task = makeTask({
      priority: 'high',
      deadline: '2024-01-08T10:00:00.000Z',
      completedAt: '2024-01-08T10:30:00.000Z',
    })
    expect(calcPts(task)).toBe(14) // round(20 * 0.7)
  })

  it('applies 0.4 multiplier when completed more than 1hr late', () => {
    const task = makeTask({
      priority: 'high',
      deadline: '2024-01-08T10:00:00.000Z',
      completedAt: '2024-01-08T11:30:01.000Z',
    })
    expect(calcPts(task)).toBe(8) // round(20 * 0.4)
  })

  it('applies no penalty when completed before deadline', () => {
    const task = makeTask({
      priority: 'high',
      deadline: '2024-01-08T10:00:00.000Z',
      completedAt: '2024-01-08T09:00:00.000Z',
    })
    expect(calcPts(task)).toBe(20)
  })

  it('applies 0.8 multiplier on slot mismatch', () => {
    const task = makeTask({
      priority: 'high', slot: 'morning',
      completedAt: new Date(2024, 0, 8, 14, 0, 0).toISOString(), // 14:00 local, outside 6-12
    })
    expect(calcPts(task)).toBe(16) // round(20 * 0.8)
  })

  it('applies no penalty when completed within slot hours', () => {
    const task = makeTask({
      priority: 'high', slot: 'morning',
      completedAt: new Date(2024, 0, 8, 8, 0, 0).toISOString(),
    })
    expect(calcPts(task)).toBe(20)
  })

  it('applies carry penalty and floors at 1', () => {
    const task = makeTask({ priority: 'low', carriedDays: 5 }) // 6 - 5*2 = -4
    expect(calcPts(task)).toBe(1)
  })

  it('subtracts carry penalty without floor when above 1', () => {
    const task = makeTask({ priority: 'high', carriedDays: 2 }) // 20 - 2*2 = 16
    expect(calcPts(task)).toBe(16)
  })
})

describe('getMoodMult', () => {
  it('returns moodMot for motivated', () => {
    expect(getMoodMult('motivated', CFG)).toBe(1.2)
  })

  it('returns moodSick for sick', () => {
    expect(getMoodMult('sick', CFG)).toBe(0.5)
  })

  it('returns 1.0 for neutral or undefined', () => {
    expect(getMoodMult('neutral', CFG)).toBe(1.0)
    expect(getMoodMult(undefined, CFG)).toBe(1.0)
  })

  it('falls back to defaults when cfg values are missing', () => {
    const partial = { moodMot: undefined, moodSick: undefined } as unknown as AppConfig
    expect(getMoodMult('motivated', partial)).toBe(1.2)
    expect(getMoodMult('sick', partial)).toBe(0.5)
  })
})

describe('todayEarned', () => {
  it('sums points and applies mood multiplier, rounding result', () => {
    const tasks = [
      makeTask({ priority: 'high' }), // 20
      makeTask({ priority: 'med' }),  // 12
    ]
    expect(todayEarned(tasks, 'motivated', CFG)).toBe(38) // round(32 * 1.2)
    expect(todayEarned(tasks, 'neutral', CFG)).toBe(32)
  })

  it('returns 0 for an empty list', () => {
    expect(todayEarned([], 'neutral', CFG)).toBe(0)
  })
})

describe('todayTarget', () => {
  it('sums base points regardless of done state', () => {
    const tasks = [
      makeTask({ priority: 'high', done: true }),
      makeTask({ priority: 'low', done: false }),
    ]
    expect(todayTarget(tasks)).toBe(26)
  })
})

describe('walletPtsFor', () => {
  it('converts task points to wallet points at the 2:1 ratio, flooring', () => {
    expect(walletPtsFor(8)).toBe(4)
    expect(walletPtsFor(7)).toBe(3)
    expect(walletPtsFor(1)).toBe(0)
  })
})

describe('getMoodAdjustedMinPts', () => {
  it('returns minPts * moodMot when motivated', () => {
    expect(getMoodAdjustedMinPts('2024-01-08', 'motivated', CFG)).toBe(84) // round(70 * 1.2)
  })

  it('returns minPts * moodSick when sick', () => {
    expect(getMoodAdjustedMinPts('2024-01-08', 'sick', CFG)).toBe(35) // round(70 * 0.5)
  })

  it('returns minPts unchanged for neutral mood', () => {
    expect(getMoodAdjustedMinPts('2024-01-08', 'neutral', CFG)).toBe(70)
  })

  it('adjusts weekendPts for mood', () => {
    expect(getMoodAdjustedMinPts('2024-01-06', 'motivated', CFG)).toBe(24) // round(20 * 1.2)
  })
})

describe('getMinPts', () => {
  it('returns weekendPts on Saturday/Sunday', () => {
    expect(getMinPts('2024-01-06', CFG)).toBe(20) // Saturday
    expect(getMinPts('2024-01-07', CFG)).toBe(20) // Sunday
  })

  it('returns minPts on weekdays', () => {
    expect(getMinPts('2024-01-08', CFG)).toBe(70) // Monday
  })

  it('falls back to defaults when cfg values are missing', () => {
    const partial = { minPts: undefined, weekendPts: undefined } as unknown as AppConfig
    expect(getMinPts('2024-01-08', partial)).toBe(70)
    expect(getMinPts('2024-01-06', partial)).toBe(20)
  })
})
