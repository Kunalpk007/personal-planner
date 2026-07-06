import { describe, it, expect, vi, afterEach } from 'vitest'
import { getManagerMessage, getTaskCompleteMessage, getConcernMessage, getMilestoneMessage } from '@/lib/engine/manager'

const CFG_TONE = 'balanced' as const

// Control clock hour for branch coverage on time-sensitive paths
function mockHour(h: number) {
  return vi.spyOn(Date.prototype, 'getHours').mockReturnValue(h)
}

afterEach(() => vi.restoreAllMocks())

describe('getManagerMessage', () => {
  it('returns an "empty" message when there are no tasks', () => {
    const msg = getManagerMessage(0, 0, CFG_TONE, undefined, '2024-01-08')
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })

  it('returns a complete message when pct >= 100', () => {
    const msg = getManagerMessage(100, 5, CFG_TONE, undefined, '2024-01-08')
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })

  it('returns "Close..." for pct >= 80', () => {
    expect(getManagerMessage(85, 5, CFG_TONE)).toBe('Close. Finish strong.')
  })

  it('returns "Halfway..." for pct >= 50', () => {
    expect(getManagerMessage(60, 5, CFG_TONE)).toBe('Halfway there. Don\'t slow down.')
  })

  it('returns "Started..." for pct > 0 but < 50', () => {
    expect(getManagerMessage(20, 5, CFG_TONE)).toBe('Started. Keep going.')
  })

  it('returns a zero_am message at pct=0 and hour < 12', () => {
    mockHour(8)
    const msg = getManagerMessage(0, 5, CFG_TONE, undefined, '2024-01-08')
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })

  it('returns a zero_pm message at pct=0 and 12 <= hour < 17', () => {
    mockHour(14)
    const msg = getManagerMessage(0, 5, CFG_TONE, undefined, '2024-01-08')
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })

  it('returns a zero_late message at pct=0 and hour >= 17', () => {
    mockHour(20)
    const msg = getManagerMessage(0, 5, CFG_TONE, undefined, '2024-01-08')
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })

  it('falls back to "balanced" when an unknown tone is provided', () => {
    const msg = getManagerMessage(100, 5, 'unknown' as any, undefined, '2024-01-08')
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })

  it('uses pickRand when no seed is provided', () => {
    const msg = getManagerMessage(0, 0, CFG_TONE)
    expect(typeof msg).toBe('string')
  })
})

describe('getTaskCompleteMessage', () => {
  it('returns a string for each time-of-day period', () => {
    const hours = [8, 14, 20]
    for (const h of hours) {
      mockHour(h)
      const msg = getTaskCompleteMessage('high', false, 'motivated', CFG_TONE)
      expect(typeof msg).toBe('string')
      expect(msg.length).toBeGreaterThan(0)
      vi.restoreAllMocks()
    }
  })

  it('uses the special priority pool when isSpecial is true', () => {
    mockHour(8)
    const msg = getTaskCompleteMessage('high', true, undefined, CFG_TONE)
    expect(typeof msg).toBe('string')
  })
})

describe('getConcernMessage', () => {
  it('returns a non-empty string for any tone', () => {
    expect(getConcernMessage(CFG_TONE).length).toBeGreaterThan(0)
    expect(getConcernMessage('strict').length).toBeGreaterThan(0)
  })
})

describe('getMilestoneMessage', () => {
  it('returns a string for a known milestone streak', () => {
    expect(getMilestoneMessage(7, CFG_TONE).length).toBeGreaterThan(0)
  })

  it('falls back gracefully for an unknown streak milestone', () => {
    expect(getMilestoneMessage(9999, CFG_TONE).length).toBeGreaterThan(0)
  })
})
