import { describe, it, expect } from 'vitest'
import { defaultHabits, DEFAULT_TOTAL_DAYS, DEFAULT_DISCIPLINED_THRESHOLD_PCT } from '@/lib/habit100/defaults'

describe('defaultHabits', () => {
  it('returns a non-empty list with unique ids', () => {
    const habits = defaultHabits()
    expect(habits.length).toBeGreaterThan(0)
    const ids = habits.map(h => h.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every numeric/time/book habit has a target and comparison', () => {
    for (const h of defaultHabits()) {
      if (h.type === 'numeric' || h.type === 'time' || h.type === 'book') {
        expect(h.target).toBeDefined()
        expect(h.comparison).toBeDefined()
      }
    }
  })

  it('no habit carries a "counted" field — everything counts, per explicit decision', () => {
    for (const h of defaultHabits()) {
      expect('counted' in h).toBe(false)
    }
  })

  it('returns a fresh array each call (setup wizard mutates its own copy)', () => {
    const a = defaultHabits()
    const b = defaultHabits()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it('includes the nutrition/workout fields, and reading as one combined "book" entry', () => {
    const ids = defaultHabits().map(h => h.id)
    for (const id of ['calories', 'protein', 'fat', 'carbs', 'fibre', 'workoutNotes', 'bookRead']) {
      expect(ids).toContain(id)
    }
    // Not 3 separate reading fields anymore
    for (const id of ['bookTitle', 'bookTopic', 'bookPages']) {
      expect(ids).not.toContain(id)
    }
  })

  it('time/numeric labels do not bake in a specific target number (it lives in the editable target instead)', () => {
    const byId = Object.fromEntries(defaultHabits().map(h => [h.id, h]))
    expect(byId.wake.label).toBe('Wake before')
    expect(byId.sleep11.label).toBe('Asleep before')
    expect(byId.screen.label).toBe('Screen time under')
    expect(byId.phone.label).toBe('No phone before and after sleep')
  })
})

describe('constants', () => {
  it('DEFAULT_TOTAL_DAYS is 100', () => {
    expect(DEFAULT_TOTAL_DAYS).toBe(100)
  })
  it('DEFAULT_DISCIPLINED_THRESHOLD_PCT is 80', () => {
    expect(DEFAULT_DISCIPLINED_THRESHOLD_PCT).toBe(80)
  })
})
