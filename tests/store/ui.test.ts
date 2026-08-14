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

describe('markMorningTop3Shown', () => {
  it('marks the morning top-3 prompt as shown for a date', () => {
    usePlannerStore.getState().markMorningTop3Shown('2024-01-08')
    expect(usePlannerStore.getState().morningTop3Shown['2024-01-08']).toBe(true)
  })
})

describe('setWeeklyReviewDone', () => {
  it('stores the three prompts and a timestamp', () => {
    usePlannerStore.getState().setWeeklyReviewDone('2024-01-08', {
      whatWorked: 'Stayed consistent', whatDidnt: 'Slept late', oneChange: 'Earlier wind-down',
    })
    const entry = usePlannerStore.getState().weeklyReviewDone['2024-01-08']
    expect(entry).toBeDefined()
    expect(entry.whatWorked).toBe('Stayed consistent')
    expect(entry.whatDidnt).toBe('Slept late')
    expect(entry.oneChange).toBe('Earlier wind-down')
    expect(entry.at).toBeTruthy()
  })
})

describe('setFocusCheckin', () => {
  it('stores the score, distraction tags, and a timestamp', () => {
    usePlannerStore.getState().setFocusCheckin('2024-01-08', 4, ['Phone / social media'])
    const entry = usePlannerStore.getState().focusCheckins['2024-01-08']
    expect(entry).toBeDefined()
    expect(entry.score).toBe(4)
    expect(entry.distractions).toEqual(['Phone / social media'])
    expect(entry.at).toBeTruthy()
  })
})

describe('setLifestyleCheckin', () => {
  it('stores sleep, moved, stress, and a timestamp', () => {
    usePlannerStore.getState().setLifestyleCheckin('2024-01-08', 'great', true, 2)
    const entry = usePlannerStore.getState().lifestyleCheckins['2024-01-08']
    expect(entry).toBeDefined()
    expect(entry.sleep).toBe('great')
    expect(entry.moved).toBe(true)
    expect(entry.stress).toBe(2)
    expect(entry.at).toBeTruthy()
  })

  it('overwrites a same-day check-in rather than duplicating it', () => {
    usePlannerStore.getState().setLifestyleCheckin('2024-01-08', 'poor', false, 5)
    usePlannerStore.getState().setLifestyleCheckin('2024-01-08', 'ok', true, 3)
    const entry = usePlannerStore.getState().lifestyleCheckins['2024-01-08']
    expect(entry.sleep).toBe('ok')
    expect(entry.moved).toBe(true)
    expect(entry.stress).toBe(3)
    expect(Object.keys(usePlannerStore.getState().lifestyleCheckins)).toHaveLength(1)
  })
})

describe('setTomorrowTop3', () => {
  it('stores up to 3 non-empty items and a timestamp', () => {
    usePlannerStore.getState().setTomorrowTop3('2024-01-09', ['Ship the fix', '', 'Read', 'Gym', 'Extra'])
    const entry = usePlannerStore.getState().tomorrowTop3['2024-01-09']
    expect(entry).toBeDefined()
    expect(entry.items).toEqual(['Ship the fix', 'Read', 'Gym'])
    expect(entry.at).toBeTruthy()
  })

  it('overwrites a previous pick for the same date', () => {
    usePlannerStore.getState().setTomorrowTop3('2024-01-09', ['First'])
    usePlannerStore.getState().setTomorrowTop3('2024-01-09', ['Second'])
    expect(usePlannerStore.getState().tomorrowTop3['2024-01-09'].items).toEqual(['Second'])
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
