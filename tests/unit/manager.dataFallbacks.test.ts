import { describe, it, expect, vi, afterEach } from 'vitest'

// This file exercises defensive fallback branches in lib/engine/manager.ts that
// can never be reached through the real data/manager.json content (every real
// tone always has non-empty `empty`/`complete_high_*`/`concern_sick`/`streak_7`
// arrays). We mock the data file with deliberately incomplete/empty banks to
// simulate a corrupted or partial data file and confirm the manager module
// degrades gracefully instead of throwing.
vi.mock('@/data/manager.json', () => ({
  default: {
    // Empty arrays exercise the `?? ''` fallback in both pickRand (no seed)
    // and pickSeeded (with seed) — indexing an empty array is always undefined.
    empty_bank: {
      empty: [],
      zero_am: ['am'], zero_pm: ['pm'], zero_late: ['late'],
    },
    // Has complete_high_morning but no afternoon/evening variants, so looking
    // up an afternoon/evening key falls through to the complete_high_morning fallback.
    morning_only: {
      complete_high_morning: ['morning fallback message'],
    },
    // No complete_* keys at all, so every lookup falls all the way through to
    // the final hardcoded ['Well done.'] default.
    no_complete: {},
    // No concern_sick key, so getConcernMessage falls to its hardcoded default.
    no_concern: {},
    // No streak_* keys, so getMilestoneMessage falls to its hardcoded default.
    no_streak: {},
  },
}))

const {
  getManagerMessage,
  getTaskCompleteMessage,
  getConcernMessage,
  getMilestoneMessage,
} = await import('@/lib/engine/manager')

function mockHour(h: number) {
  return vi.spyOn(Date.prototype, 'getHours').mockReturnValue(h)
}

afterEach(() => vi.restoreAllMocks())

describe('manager message data fallbacks (mocked incomplete data file)', () => {
  it('pickRand falls back to "" when the bank array is empty (no seed)', () => {
    const msg = getManagerMessage(0, 0, 'empty_bank' as any)
    expect(msg).toBe('')
  })

  it('pickSeeded falls back to "" when the bank array is empty (with seed)', () => {
    const msg = getManagerMessage(0, 0, 'empty_bank' as any, undefined, 'some-seed')
    expect(msg).toBe('')
  })

  it('falls back to the complete_high_morning pool when the tod-specific pool is missing', () => {
    mockHour(14) // afternoon
    const msg = getTaskCompleteMessage('high', false, undefined, 'morning_only' as any)
    expect(msg).toBe('morning fallback message')
  })

  it('falls back to the hardcoded default when no complete_* pools exist at all', () => {
    mockHour(14)
    const msg = getTaskCompleteMessage('high', false, undefined, 'no_complete' as any)
    expect(msg).toBe('Well done.')
  })

  it('falls back to the hardcoded default concern message when concern_sick is missing', () => {
    const msg = getConcernMessage('no_concern' as any)
    expect(msg).toBe('Two sick days in a row — take care of yourself.')
  })

  it('falls back to the hardcoded default milestone message when no streak_* keys exist', () => {
    const msg = getMilestoneMessage(7, 'no_streak' as any)
    expect(msg).toBe('Milestone reached!')
  })
})
