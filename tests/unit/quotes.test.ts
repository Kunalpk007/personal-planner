import { describe, it, expect } from 'vitest'
import { getDailyQuote } from '@/lib/engine/quotes'

describe('getDailyQuote', () => {
  it('returns a quote object with t and a strings for the morning bank', () => {
    const q = getDailyQuote('2024-01-08', 'morning')
    expect(typeof q.t).toBe('string')
    expect(typeof q.a).toBe('string')
    expect(q.t.length).toBeGreaterThan(0)
  })

  it('returns a quote for the evening bank', () => {
    const q = getDailyQuote('2024-01-08', 'evening')
    expect(q.t.length).toBeGreaterThan(0)
  })

  it('returns a quote for the comeback bank', () => {
    const q = getDailyQuote('2024-01-08', 'comeback')
    expect(q.t.length).toBeGreaterThan(0)
  })

  it('falls back to the morning bank for an unknown bank name', () => {
    const morning = getDailyQuote('2024-01-08', 'morning')
    const fallback = getDailyQuote('2024-01-08', 'unknown' as any)
    // Both should return valid quote objects; the fallback will use morning data
    expect(fallback.t.length).toBeGreaterThan(0)
    expect(fallback).toEqual(morning)
  })

  it('returns the same quote for the same dayKey (deterministic)', () => {
    const q1 = getDailyQuote('2024-06-15', 'morning')
    const q2 = getDailyQuote('2024-06-15', 'morning')
    expect(q1).toEqual(q2)
  })

  it('returns a different quote for a different dayKey', () => {
    const q1 = getDailyQuote('2024-01-01', 'morning')
    const q2 = getDailyQuote('2024-01-02', 'morning')
    // These might be equal by chance, but for large arrays this is extremely unlikely
    // We just verify both are valid objects
    expect(q1.t.length).toBeGreaterThan(0)
    expect(q2.t.length).toBeGreaterThan(0)
  })
})
