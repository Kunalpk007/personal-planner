import { describe, it, expect, beforeEach } from 'vitest'
import { usePlannerStore } from '@/store'
import { resetStore } from './helpers'
import { FREEZE_COST, MAX_BOUGHT_FREEZES } from '@/constants/points'
import type { HistoryEntry, Task } from '@/store/types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1', title: 'Task', note: '', zone: 'z1', priority: 'high', slot: '',
    deadline: null, done: false, date: '2024-01-08', createdAt: '2024-01-08T08:00:00.000Z',
    completedAt: null, subtasks: [], level: '', isSpecial: false, specialPts: 0,
    ...overrides,
  }
}

function historyEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    date: '2024-01-08', done: 4, total: 4, pct: 100, rxp: 80,
    mood: 'neutral', eodMood: '', frozen: false, rest: false,
    auto: false, late: false, tasks: [], rewards: [],
    ...overrides,
  }
}

beforeEach(resetStore)

describe('submitDay', () => {
  it('increments streak/bestStreak/daysActive and marks the day submitted', () => {
    const result = usePlannerStore.getState().submitDay(historyEntry({ date: '2024-01-08', rxp: 80 }))

    const state = usePlannerStore.getState()
    expect(state.streak).toBe(1)
    expect(state.bestStreak).toBe(1)
    expect(state.daysActive).toBe(1)
    expect(state.submittedDays['2024-01-08']).toBe(true)
    expect(state.weekDays['2024-01-08']).toBe(true)
    expect(state.history).toHaveLength(1)
    expect(state.lastActiveDayForDecay).toBe('2024-01-08')
    expect(result).toEqual({ freezeBonus: 0, milestoneStreak: null })
  })

  it('folds excess points beyond minPts directly into rank XP at a 2:1 ratio', () => {
    // 2024-01-08 is a Monday -> minPts = 70. Earned 80 -> excess 10 -> +5 rank XP
    usePlannerStore.setState({ rankXP: 100 })
    usePlannerStore.getState().submitDay(historyEntry({ date: '2024-01-08', rxp: 80 }))
    expect(usePlannerStore.getState().rankXP).toBe(105)
  })

  it('does not add overflow rank XP when rxp is below minPts', () => {
    usePlannerStore.setState({ rankXP: 100 })
    usePlannerStore.getState().submitDay(historyEntry({ date: '2024-01-08', rxp: 50 }))
    expect(usePlannerStore.getState().rankXP).toBe(100)
  })

  it('awards a freeze token and badge when a milestone streak is reached', () => {
    usePlannerStore.setState({ streak: 2, bestStreak: 2 }) // next submit -> streak 3 (milestone)

    const result = usePlannerStore.getState().submitDay(historyEntry({ date: '2024-01-10', rxp: 80 }))

    const state = usePlannerStore.getState()
    expect(state.streak).toBe(3)
    expect(state.freezeTokens).toBe(1)
    expect(state.badges).toHaveLength(1)
    expect(state.badges[0]).toMatchObject({ id: 's3', label: '3-Day Streak' })
    expect(result).toEqual({ freezeBonus: 1, milestoneStreak: 3 })
  })

  it('carries forward an incomplete task to the next day', () => {
    usePlannerStore.setState({
      tasks: [
        makeTask({ id: 'incomplete', date: '2024-01-08', done: false }),
        makeTask({ id: 'complete', date: '2024-01-08', done: true }),
      ],
    })

    usePlannerStore.getState().submitDay(historyEntry({ date: '2024-01-08', rxp: 80 }))

    const carried = usePlannerStore.getState().tasks.filter(t => t.date === '2024-01-09')
    expect(carried).toHaveLength(1)
    expect(carried[0].carriedDays).toBe(1)
    expect(carried[0].done).toBe(false)
  })

  it('carries forward a blocked incomplete task without incrementing the penalty counter', () => {
    usePlannerStore.setState({
      tasks: [makeTask({ id: 'blocked1', date: '2024-01-08', done: false, blocked: true } as Partial<Task>)],
    })

    usePlannerStore.getState().submitDay(historyEntry({ date: '2024-01-08', rxp: 80 }))

    const carried = usePlannerStore.getState().tasks.find(t => t.date === '2024-01-09')
    expect(carried).toBeDefined()
    expect(carried?.carriedDays).toBe(0)
  })

  it('does not carry an unblocked task once it has already been carried MAX_CARRY times', () => {
    usePlannerStore.setState({
      tasks: [makeTask({ id: 'maxed', date: '2024-01-08', done: false, carriedDays: 3 })],
    })

    usePlannerStore.getState().submitDay(historyEntry({ date: '2024-01-08', rxp: 80 }))

    const carried = usePlannerStore.getState().tasks.filter(t => t.date === '2024-01-09')
    expect(carried).toHaveLength(0)
  })
})

describe('useFreeze', () => {
  it('does nothing when there are no freeze tokens', () => {
    const before = usePlannerStore.getState()
    usePlannerStore.getState().useFreeze('2024-01-08')
    expect(usePlannerStore.getState()).toEqual(before)
  })

  it('does nothing when streak is 0, even with freeze tokens available', () => {
    usePlannerStore.setState({ freezeTokens: 2, streak: 0 })
    const before = usePlannerStore.getState()
    usePlannerStore.getState().useFreeze('2024-01-08')
    expect(usePlannerStore.getState()).toEqual(before)
  })

  it('spends a freeze token, marks the day frozen/submitted, and logs history', () => {
    usePlannerStore.setState({ freezeTokens: 2, freezesBought: 1, freezesUsed: 0, streak: 3 })

    usePlannerStore.getState().useFreeze('2024-01-08')

    const state = usePlannerStore.getState()
    expect(state.freezeTokens).toBe(1)
    expect(state.freezesBought).toBe(0)
    expect(state.freezesUsed).toBe(1)
    expect(state.frozenDays['2024-01-08']).toBe(true)
    expect(state.submittedDays['2024-01-08']).toBe(true)
    expect(state.history).toHaveLength(1)
    expect(state.history[0]).toMatchObject({ date: '2024-01-08', frozen: true, rest: false })
    expect(state.streak).toBe(3) // using a freeze protects the streak — never increments it
  })

  it('treats a missing freezesBought count as 0 and clamps it at 0', () => {
    usePlannerStore.setState({ freezeTokens: 1, streak: 3, freezesBought: undefined } as never)

    usePlannerStore.getState().useFreeze('2024-01-08')

    expect(usePlannerStore.getState().freezesBought).toBe(0)
  })
})

describe('buyFreeze', () => {
  it('fails when rewardWallet is below FREEZE_COST', () => {
    usePlannerStore.setState({ rewardWallet: FREEZE_COST - 1 })
    const result = usePlannerStore.getState().buyFreeze()
    expect(result).toBe(false)
    expect(usePlannerStore.getState().freezeTokens).toBe(0)
  })

  it('succeeds and deducts the cost, incrementing freezeTokens/freezesBought', () => {
    usePlannerStore.setState({ rewardWallet: FREEZE_COST })
    const result = usePlannerStore.getState().buyFreeze()

    expect(result).toBe(true)
    const state = usePlannerStore.getState()
    expect(state.rewardWallet).toBe(0)
    expect(state.freezesBought).toBe(1)
    expect(state.freezeTokens).toBe(1)
  })

  it('fails once MAX_BOUGHT_FREEZES has been reached', () => {
    usePlannerStore.setState({ rewardWallet: FREEZE_COST * (MAX_BOUGHT_FREEZES + 1), freezesBought: MAX_BOUGHT_FREEZES })
    const result = usePlannerStore.getState().buyFreeze()
    expect(result).toBe(false)
  })

  it('treats a missing freezesBought count as 0 when checking the cap and incrementing', () => {
    usePlannerStore.setState({ rewardWallet: FREEZE_COST, freezesBought: undefined } as never)
    const result = usePlannerStore.getState().buyFreeze()
    expect(result).toBe(true)
    expect(usePlannerStore.getState().freezesBought).toBe(1)
  })
})

describe('useBuffer', () => {
  it('moves bufferXP into rankXP', () => {
    usePlannerStore.setState({ bufferXP: 20, rankXP: 100 })
    usePlannerStore.getState().useBuffer(15)
    const state = usePlannerStore.getState()
    expect(state.bufferXP).toBe(5)
    expect(state.rankXP).toBe(115)
  })

  it('clamps bufferXP at 0 when using more than available', () => {
    usePlannerStore.setState({ bufferXP: 5, rankXP: 0 })
    usePlannerStore.getState().useBuffer(15)
    const state = usePlannerStore.getState()
    expect(state.bufferXP).toBe(0)
    expect(state.rankXP).toBe(15)
  })
})

describe('declareRestDay', () => {
  it('does nothing when streak is 0', () => {
    usePlannerStore.setState({ streak: 0 })
    const before = usePlannerStore.getState()
    usePlannerStore.getState().declareRestDay('2024-01-09')
    expect(usePlannerStore.getState()).toEqual(before)
  })

  it('marks the day and week as rested, and logs a rest history entry', () => {
    usePlannerStore.setState({ streak: 3 })
    usePlannerStore.getState().declareRestDay('2024-01-09')

    const state = usePlannerStore.getState()
    expect(state.weekRestUsed['2024-01-08']).toBe(true) // Monday of that week
    expect(state.restDays['2024-01-09']).toBe(true)
    expect(state.submittedDays['2024-01-09']).toBe(true)
    expect(state.daysActive).toBe(1)
    expect(state.history).toHaveLength(1)
    expect(state.history[0]).toMatchObject({ date: '2024-01-09', rest: true, frozen: false })
    expect(state.streak).toBe(3) // taking a rest day protects the streak — never increments it
  })
})
