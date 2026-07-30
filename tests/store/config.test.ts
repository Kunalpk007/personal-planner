import { describe, it, expect, beforeEach } from 'vitest'
import { usePlannerStore } from '@/store'
import { resetStore } from './helpers'

beforeEach(resetStore)

describe('setConfig', () => {
  it('merges partial updates into cfg without overwriting other fields', () => {
    const before = usePlannerStore.getState().cfg
    usePlannerStore.getState().setConfig({ minPts: 100 })
    const after = usePlannerStore.getState().cfg
    expect(after.minPts).toBe(100)
    expect(after.tone).toBe(before.tone) // unchanged
  })
})

describe('setMood', () => {
  it('sets the mood for the given day', () => {
    usePlannerStore.getState().setMood('2024-01-08', 'motivated')
    expect(usePlannerStore.getState().mood['2024-01-08']).toBe('motivated')
  })

  it('overwrites a previously set mood for the same day (editable all day)', () => {
    usePlannerStore.getState().setMood('2024-01-08', 'motivated')
    usePlannerStore.getState().setMood('2024-01-08', 'sick')
    expect(usePlannerStore.getState().mood['2024-01-08']).toBe('sick')
  })
})

describe('setEodMood', () => {
  it('records the end-of-day mood', () => {
    usePlannerStore.getState().setEodMood('2024-01-08', 'content')
    expect(usePlannerStore.getState().eodMood['2024-01-08']).toBe('content')
  })
})

describe('claimShowedUpBonus', () => {
  it('awards ceil(5% of the mood-adjusted minPts) to the wallet, not XP', () => {
    usePlannerStore.setState({ rankXP: 0, rewardWallet: 0 })
    // 2024-01-08 is a Monday -> minPts 70, no mood set -> mult 1.0 -> 5% = 3.5 -> ceil 4
    const bonus = usePlannerStore.getState().claimShowedUpBonus('2024-01-08')
    expect(bonus).toBe(4)
    expect(usePlannerStore.getState().rewardWallet).toBe(4)
    expect(usePlannerStore.getState().rankXP).toBe(0)
  })

  it('returns null and awards nothing if the day was already an engagement day', () => {
    usePlannerStore.setState({ rewardWallet: 0, engagementDays: { '2024-01-08': true } })
    const bonus = usePlannerStore.getState().claimShowedUpBonus('2024-01-08')
    expect(bonus).toBeNull()
    expect(usePlannerStore.getState().rewardWallet).toBe(0)
  })
})

describe('setPinnedTask', () => {
  it('sets the pinned task id', () => {
    usePlannerStore.getState().setPinnedTask('task-abc')
    expect(usePlannerStore.getState().pinnedTaskId).toBe('task-abc')
  })

  it('clears the pinned task id when null is passed', () => {
    usePlannerStore.getState().setPinnedTask('task-abc')
    usePlannerStore.getState().setPinnedTask(null)
    expect(usePlannerStore.getState().pinnedTaskId).toBeNull()
  })
})
