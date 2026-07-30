import { describe, it, expect } from 'vitest'
import {
  sickCountThisMonth, isSickExempt, isLightDay, restOrLightXpPenalty, streakBrokenXpPenalty,
} from '@/lib/engine/xpPenalty'
import type { Mood } from '@/store/types'

describe('sickCountThisMonth', () => {
  it('counts sick days in the same month up to and including the given date', () => {
    const mood: Record<string, Mood> = {
      '2024-01-02': 'sick', '2024-01-05': 'sick', '2024-01-10': 'sick',
    }
    expect(sickCountThisMonth(mood, '2024-01-05')).toBe(2)
    expect(sickCountThisMonth(mood, '2024-01-10')).toBe(3)
  })

  it('excludes sick days from a different month', () => {
    const mood: Record<string, Mood> = { '2023-12-30': 'sick', '2024-01-02': 'sick' }
    expect(sickCountThisMonth(mood, '2024-01-02')).toBe(1)
  })

  it('excludes non-sick moods', () => {
    const mood: Record<string, Mood> = { '2024-01-02': 'motivated', '2024-01-05': 'sick' }
    expect(sickCountThisMonth(mood, '2024-01-05')).toBe(1)
  })

  it('returns 0 for an empty mood record', () => {
    expect(sickCountThisMonth({}, '2024-01-05')).toBe(0)
  })
})

describe('isSickExempt', () => {
  it('is false when the day mood is not sick', () => {
    const mood: Record<string, Mood> = { '2024-01-05': 'motivated' }
    expect(isSickExempt(mood, '2024-01-05')).toBe(false)
  })

  it('is false when the day has no mood set at all', () => {
    expect(isSickExempt({}, '2024-01-05')).toBe(false)
  })

  it('is true for the 1st and 2nd sick day of the month', () => {
    const mood: Record<string, Mood> = { '2024-01-02': 'sick', '2024-01-05': 'sick' }
    expect(isSickExempt(mood, '2024-01-02')).toBe(true)
    expect(isSickExempt(mood, '2024-01-05')).toBe(true)
  })

  it('is false for the 3rd+ sick day of the month', () => {
    const mood: Record<string, Mood> = {
      '2024-01-02': 'sick', '2024-01-05': 'sick', '2024-01-10': 'sick',
    }
    expect(isSickExempt(mood, '2024-01-10')).toBe(false)
  })
})

describe('isLightDay', () => {
  it('uses cfg.lightDays when set', () => {
    expect(isLightDay('2024-01-09', { lightDays: [2] })).toBe(true)  // Tuesday
    expect(isLightDay('2024-01-08', { lightDays: [2] })).toBe(false) // Monday
  })

  it('defaults to Sat/Sun when lightDays is missing', () => {
    expect(isLightDay('2024-01-06', {} as any)).toBe(true)  // Saturday
    expect(isLightDay('2024-01-08', {} as any)).toBe(false) // Monday
  })
})

describe('restOrLightXpPenalty', () => {
  it('returns 0 when the day is sick-exempt', () => {
    const mood: Record<string, Mood> = { '2024-01-08': 'sick' }
    expect(restOrLightXpPenalty('2024-01-08', { lightDays: [0, 6] }, mood)).toBe(0)
  })

  it('returns the light-day rate on a configured light day', () => {
    expect(restOrLightXpPenalty('2024-01-06', { lightDays: [0, 6] }, {})).toBe(20) // Saturday
  })

  it('returns the regular rest-day rate on a non-light day', () => {
    expect(restOrLightXpPenalty('2024-01-08', { lightDays: [0, 6] }, {})).toBe(40) // Monday
  })

  it('applies the regular rest rate even for a 3rd+ sick day (allowance exhausted)', () => {
    const mood: Record<string, Mood> = {
      '2024-01-02': 'sick', '2024-01-05': 'sick', '2024-01-08': 'sick',
    }
    expect(restOrLightXpPenalty('2024-01-08', { lightDays: [0, 6] }, mood)).toBe(40)
  })
})

describe('streakBrokenXpPenalty', () => {
  it('returns 0 when the day is sick-exempt', () => {
    const mood: Record<string, Mood> = { '2024-01-08': 'sick' }
    expect(streakBrokenXpPenalty('2024-01-08', mood)).toBe(0)
  })

  it('returns the flat streak-broken rate otherwise', () => {
    expect(streakBrokenXpPenalty('2024-01-08', {})).toBe(10)
  })
})
