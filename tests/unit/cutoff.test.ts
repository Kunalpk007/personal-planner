import { describe, it, expect } from 'vitest'
import { pad, getDayKey, getPrevDayKey, getWeekMonday, isWeekend, daysBetween, formatDate } from '@/lib/engine/cutoff'
import type { AppConfig } from '@/store/types'

describe('pad', () => {
  it('pads single digits with a leading zero', () => {
    expect(pad(1)).toBe('01')
    expect(pad(9)).toBe('09')
  })

  it('leaves two-digit numbers unchanged', () => {
    expect(pad(10)).toBe('10')
    expect(pad(23)).toBe('23')
  })
})

describe('getDayKey', () => {
  it('rolls over to the previous day before the cutoff hour', () => {
    const d = new Date(2024, 0, 8, 0, 30) // 00:30, cutoff defaults to 1
    expect(getDayKey({ cutoffHour: 1 }, d)).toBe('2024-01-07')
  })

  it('uses the current day at or after the cutoff hour', () => {
    const d = new Date(2024, 0, 8, 1, 0) // 01:00
    expect(getDayKey({ cutoffHour: 1 }, d)).toBe('2024-01-08')
  })

  it('defaults cutoffHour to 1 when not provided', () => {
    const before = new Date(2024, 0, 8, 0, 59)
    const after  = new Date(2024, 0, 8, 1, 0)
    const cfg = {} as Pick<AppConfig, 'cutoffHour'>
    expect(getDayKey(cfg, before)).toBe('2024-01-07')
    expect(getDayKey(cfg, after)).toBe('2024-01-08')
  })

  it('respects a custom cutoff hour', () => {
    const d = new Date(2024, 0, 8, 2, 30) // 02:30, cutoff = 3
    expect(getDayKey({ cutoffHour: 3 }, d)).toBe('2024-01-07')
  })
})

describe('getPrevDayKey', () => {
  it('returns the calendar day before the given date', () => {
    expect(getPrevDayKey('2024-01-08')).toBe('2024-01-07')
  })

  it('handles month boundaries', () => {
    expect(getPrevDayKey('2024-02-01')).toBe('2024-01-31')
  })

  it('handles year boundaries', () => {
    expect(getPrevDayKey('2024-01-01')).toBe('2023-12-31')
  })
})

describe('getWeekMonday', () => {
  it('returns the same date when given a Monday', () => {
    expect(getWeekMonday('2024-01-01')).toBe('2024-01-01') // Jan 1 2024 is a Monday
  })

  it('returns the preceding Monday for a midweek date', () => {
    expect(getWeekMonday('2024-01-03')).toBe('2024-01-01') // Wednesday
  })

  it('returns the preceding Monday for a Sunday', () => {
    expect(getWeekMonday('2024-01-07')).toBe('2024-01-01') // Sunday
  })
})

describe('isWeekend', () => {
  it('returns true for Saturday and Sunday', () => {
    expect(isWeekend('2024-01-06')).toBe(true)
    expect(isWeekend('2024-01-07')).toBe(true)
  })

  it('returns false for weekdays', () => {
    expect(isWeekend('2024-01-08')).toBe(false)
  })
})

describe('formatDate', () => {
  it('formats a date string as "Day, DD Mon YYYY"', () => {
    expect(formatDate('2024-01-01')).toBe('Mon, 1 Jan 2024')
    expect(formatDate('2024-06-15')).toBe('Sat, 15 Jun 2024')
    expect(formatDate('2024-12-25')).toBe('Wed, 25 Dec 2024')
  })
})

describe('daysBetween', () => {
  it('returns the number of days between two dates', () => {
    expect(daysBetween('2024-01-01', '2024-01-10')).toBe(9)
  })

  it('returns 0 for the same date', () => {
    expect(daysBetween('2024-01-01', '2024-01-01')).toBe(0)
  })

  it('returns a negative number when "to" is before "from"', () => {
    expect(daysBetween('2024-01-10', '2024-01-01')).toBe(-9)
  })
})
