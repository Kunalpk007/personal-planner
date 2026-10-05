import { describe, it, expect } from 'vitest'
import { defaultHabits, TOTAL_DAYS, DEFAULT_DISCIPLINED_THRESHOLD_PCT } from '@/lib/habit100/defaults'

describe('defaultHabits', () => {
  it('returns a non-empty list with unique ids', () => {
    const habits = defaultHabits()
    expect(habits.length).toBeGreaterThan(0)
    const ids = habits.map(h => h.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every numeric/time habit has a target and comparison', () => {
    for (const h of defaultHabits()) {
      if (h.type === 'numeric' || h.type === 'time') {
        expect(h.target).toBeDefined()
        expect(h.comparison).toBeDefined()
      }
    }
  })

  it('returns a fresh array each call (setup wizard mutates its own copy)', () => {
    const a = defaultHabits()
    const b = defaultHabits()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it('includes the new nutrition/workout/reading fields from this session', () => {
    const ids = defaultHabits().map(h => h.id)
    for (const id of ['calories', 'protein', 'fat', 'carbs', 'fibre', 'workoutNotes', 'bookTitle', 'bookTopic', 'bookPages']) {
      expect(ids).toContain(id)
    }
  })
})

describe('constants', () => {
  it('TOTAL_DAYS is 100', () => {
    expect(TOTAL_DAYS).toBe(100)
  })
  it('DEFAULT_DISCIPLINED_THRESHOLD_PCT is 80', () => {
    expect(DEFAULT_DISCIPLINED_THRESHOLD_PCT).toBe(80)
  })
})
