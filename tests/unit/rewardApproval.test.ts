import { describe, it, expect } from 'vitest'
import { decideApprovalGate, cooldownHoursFor, cooldownEndsAt } from '@/lib/engine/rewardApproval'
import { HABIT_FLAG_COOLDOWN_HOURS, REWARD_APPROVAL_COOLDOWN_HOURS } from '@/constants/social'

describe('decideApprovalGate', () => {
  it('returns "habit" when the reward is habit-linked, regardless of cost or threshold', () => {
    expect(decideApprovalGate({ cost: 5, habitLinked: true }, undefined)).toBe('habit')
    expect(decideApprovalGate({ cost: 5, habitLinked: true }, 1000)).toBe('habit')
  })

  it('returns "cost" when cost meets or exceeds the threshold', () => {
    expect(decideApprovalGate({ cost: 100, habitLinked: false }, 100)).toBe('cost')
    expect(decideApprovalGate({ cost: 150, habitLinked: false }, 100)).toBe('cost')
  })

  it('returns null when under threshold', () => {
    expect(decideApprovalGate({ cost: 50, habitLinked: false }, 100)).toBeNull()
  })

  it('returns null when no threshold has been set yet', () => {
    expect(decideApprovalGate({ cost: 5000, habitLinked: false }, undefined)).toBeNull()
  })
})

describe('cooldownHoursFor', () => {
  it('returns the habit cooldown, defaulting when unset', () => {
    expect(cooldownHoursFor('habit', {})).toBe(HABIT_FLAG_COOLDOWN_HOURS)
    expect(cooldownHoursFor('habit', { habitCooldownHours: 6 })).toBe(6)
  })

  it('returns the fixed cost cooldown', () => {
    expect(cooldownHoursFor('cost', {})).toBe(REWARD_APPROVAL_COOLDOWN_HOURS)
  })

  it('returns 0 for no gate', () => {
    expect(cooldownHoursFor(null, {})).toBe(0)
  })
})

describe('cooldownEndsAt', () => {
  it('adds the correct number of hours to the reference time', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const result = cooldownEndsAt('cost', {}, now)
    expect(result).toBe(new Date(now.getTime() + REWARD_APPROVAL_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString())
  })

  it('uses the habit cooldown for the habit gate', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const result = cooldownEndsAt('habit', { habitCooldownHours: 6 }, now)
    expect(result).toBe(new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString())
  })
})
