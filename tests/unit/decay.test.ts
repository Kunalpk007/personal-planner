import { describe, it, expect } from 'vitest'
import { applyRankDecay } from '@/lib/engine/decay'

describe('applyRankDecay', () => {
  it('returns rankXP unchanged when paused', () => {
    expect(applyRankDecay(1000, '2024-01-01', '2024-01-10', true)).toBe(1000)
  })

  it('returns rankXP unchanged when lastActiveDay is null', () => {
    expect(applyRankDecay(1000, null, '2024-01-10', false)).toBe(1000)
  })

  it('returns rankXP unchanged within the grace period', () => {
    expect(applyRankDecay(1000, '2024-01-01', '2024-01-04', false)).toBe(1000) // diff = 3 = grace
  })

  it('applies decay rate per day beyond the grace period', () => {
    // diff = 4, decayDays = 1 -> floor(1000 * 0.98^1) = 980
    expect(applyRankDecay(1000, '2024-01-01', '2024-01-05', false)).toBe(980)
  })

  it('compounds decay across multiple days', () => {
    // diff = 6, decayDays = 3 -> floor(1000 * 0.98^3) = floor(941.19...) = 941
    expect(applyRankDecay(1000, '2024-01-01', '2024-01-07', false)).toBe(941)
  })
})
