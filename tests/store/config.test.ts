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

  it('setting lightDays to the same set as before is a no-op change (not gated)', () => {
    const current = usePlannerStore.getState().cfg.lightDays
    const result = usePlannerStore.getState().setConfig({ lightDays: [...current] })
    expect(result.blockedLightDays).toBeUndefined()
    expect(usePlannerStore.getState().cfg.lightDaysChangedAt).toBeNull()
  })

  it('allows the first real lightDays change and stamps lightDaysChangedAt', () => {
    const result = usePlannerStore.getState().setConfig({ lightDays: [1, 3] })
    expect(result.blockedLightDays).toBeUndefined()
    expect(usePlannerStore.getState().cfg.lightDays).toEqual([1, 3])
    expect(usePlannerStore.getState().cfg.lightDaysChangedAt).not.toBeNull()
  })

  it('blocks a second lightDays change within the same Monday-start week, but still applies other fields in the same update', () => {
    usePlannerStore.getState().setConfig({ lightDays: [1, 3] })
    const result = usePlannerStore.getState().setConfig({ lightDays: [2, 4], minPts: 55 })
    expect(result.blockedLightDays).toBe(true)
    expect(usePlannerStore.getState().cfg.lightDays).toEqual([1, 3]) // unchanged
    expect(usePlannerStore.getState().cfg.minPts).toBe(55) // still applied
  })

  it('allows a lightDays change again once lightDaysChangedAt falls in a previous week', () => {
    usePlannerStore.setState(s => ({ cfg: { ...s.cfg, lightDaysChangedAt: '2020-01-01T00:00:00.000Z' } }))
    const result = usePlannerStore.getState().setConfig({ lightDays: [5] })
    expect(result.blockedLightDays).toBeUndefined()
    expect(usePlannerStore.getState().cfg.lightDays).toEqual([5])
  })
})

describe('addWater', () => {
  it('adds millilitres to the given day', () => {
    usePlannerStore.getState().addWater('2024-01-08', 250)
    expect(usePlannerStore.getState().waterMl['2024-01-08']).toBe(250)
    usePlannerStore.getState().addWater('2024-01-08', 250)
    expect(usePlannerStore.getState().waterMl['2024-01-08']).toBe(500)
  })

  it('clamps at 0 rather than going negative', () => {
    usePlannerStore.getState().addWater('2024-01-08', 250)
    usePlannerStore.getState().addWater('2024-01-08', -1000)
    expect(usePlannerStore.getState().waterMl['2024-01-08']).toBe(0)
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

  it('bumps moodCheckins once on the first set for a day, not on re-selection', () => {
    expect(usePlannerStore.getState().moodCheckins).toBe(0)
    usePlannerStore.getState().setMood('2024-01-08', 'motivated')
    expect(usePlannerStore.getState().moodCheckins).toBe(1)
    usePlannerStore.getState().setMood('2024-01-08', 'sick')
    expect(usePlannerStore.getState().moodCheckins).toBe(1) // re-pick same day, no extra bump
    usePlannerStore.getState().setMood('2024-01-09', 'neutral')
    expect(usePlannerStore.getState().moodCheckins).toBe(2) // new day, bumps again
  })
})

describe('setEodMood', () => {
  it('records the end-of-day mood', () => {
    usePlannerStore.getState().setEodMood('2024-01-08', 'content')
    expect(usePlannerStore.getState().eodMood['2024-01-08']).toBe('content')
  })

  it('bumps moodCheckins once on the first set for a day, not on re-selection', () => {
    expect(usePlannerStore.getState().moodCheckins).toBe(0)
    usePlannerStore.getState().setEodMood('2024-01-08', 'content')
    expect(usePlannerStore.getState().moodCheckins).toBe(1)
    usePlannerStore.getState().setEodMood('2024-01-08', 'tired')
    expect(usePlannerStore.getState().moodCheckins).toBe(1) // re-pick same day, no extra bump
  })

  it('tracks AM and PM check-ins for the same day independently', () => {
    usePlannerStore.getState().setMood('2024-01-08', 'motivated')
    usePlannerStore.getState().setEodMood('2024-01-08', 'proud')
    expect(usePlannerStore.getState().moodCheckins).toBe(2)
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

  it('snapshots date/bonus/minPts into lastShowedUpBonus for the popup to display', () => {
    usePlannerStore.getState().claimShowedUpBonus('2024-01-08')
    expect(usePlannerStore.getState().lastShowedUpBonus).toEqual({ date: '2024-01-08', bonus: 4, minPts: 70 })
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
