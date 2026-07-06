import { describe, it, expect, beforeEach } from 'vitest'
import { usePlannerStore } from '@/store'
import { resetStore } from './helpers'

beforeEach(resetStore)

describe('clearOvernightMsg', () => {
  it('sets overnightMsg to null', () => {
    usePlannerStore.setState({ overnightMsg: 'Test message' })
    usePlannerStore.getState().clearOvernightMsg()
    expect(usePlannerStore.getState().overnightMsg).toBeNull()
  })
})

describe('markMorningQuoteShown', () => {
  it('marks the morning quote as shown for a date', () => {
    usePlannerStore.getState().markMorningQuoteShown('2024-01-08')
    expect(usePlannerStore.getState().morningQuoteShown['2024-01-08']).toBe(true)
  })
})

describe('setWeeklyReviewDone', () => {
  it('stores the reflection and a timestamp', () => {
    usePlannerStore.getState().setWeeklyReviewDone('2024-01-08', 'Great week!')
    const entry = usePlannerStore.getState().weeklyReviewDone['2024-01-08']
    expect(entry).toBeDefined()
    expect(entry.reflection).toBe('Great week!')
    expect(entry.at).toBeTruthy()
  })
})

describe('markEngagementDay', () => {
  it('marks a day as an engagement day', () => {
    usePlannerStore.getState().markEngagementDay('2024-01-08')
    expect(usePlannerStore.getState().engagementDays['2024-01-08']).toBe(true)
  })
})

describe('setAppFirstUsed', () => {
  it('sets appFirstUsed if it was null', () => {
    usePlannerStore.setState({ appFirstUsed: null })
    usePlannerStore.getState().setAppFirstUsed('2024-01-08')
    expect(usePlannerStore.getState().appFirstUsed).toBe('2024-01-08')
  })

  it('does not overwrite an already set appFirstUsed', () => {
    usePlannerStore.setState({ appFirstUsed: '2024-01-01' })
    usePlannerStore.getState().setAppFirstUsed('2024-01-08')
    expect(usePlannerStore.getState().appFirstUsed).toBe('2024-01-01')
  })
})

describe('applyOvernightPatch', () => {
  it('merges a patch object into the store state', () => {
    usePlannerStore.getState().applyOvernightPatch({ streak: 42 })
    expect(usePlannerStore.getState().streak).toBe(42)
  })
})

describe('logChange', () => {
  it('appends a change log entry with timestamp, action, and detail', () => {
    usePlannerStore.getState().logChange('test-action', 'Some detail')
    const log = usePlannerStore.getState().changeLog
    expect(log.length).toBeGreaterThan(0)
    const last = log[log.length - 1]
    expect(last.action).toBe('test-action')
    expect(last.detail).toBe('Some detail')
    expect(last.ts).toBeTruthy()
  })

  it('caps the change log at 500 entries', () => {
    for (let i = 0; i < 510; i++) {
      usePlannerStore.getState().logChange('a', String(i))
    }
    expect(usePlannerStore.getState().changeLog.length).toBe(500)
  })
})
