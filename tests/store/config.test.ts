import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
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
  afterEach(() => vi.restoreAllMocks())

  it('sets the mood for the given day', () => {
    usePlannerStore.getState().setMood('2024-01-08', 'motivated')
    expect(usePlannerStore.getState().mood['2024-01-08']).toBe('motivated')
  })

  it('uses a 5s lock window when hour is >= 12 (after noon)', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14)
    const before = Date.now()
    usePlannerStore.getState().setMood('2024-01-08', 'neutral')
    const locked = usePlannerStore.getState().moodLockedUntil['2024-01-08']
    expect(new Date(locked).getTime()).toBeLessThan(before + 10_000) // ~5s window
  })

  it('uses a 2hr lock window when hour is < 12 (before noon)', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(9)
    const before = Date.now()
    usePlannerStore.getState().setMood('2024-01-08', 'sick')
    const locked = usePlannerStore.getState().moodLockedUntil['2024-01-08']
    expect(new Date(locked).getTime()).toBeGreaterThan(before + 3_600_000) // > 1hr
  })
})

describe('setEodMood', () => {
  it('records the end-of-day mood', () => {
    usePlannerStore.getState().setEodMood('2024-01-08', 'content')
    expect(usePlannerStore.getState().eodMood['2024-01-08']).toBe('content')
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
