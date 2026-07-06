import { describe, it, expect, beforeEach } from 'vitest'
import { usePlannerStore } from '@/store'
import { resetStore } from './helpers'
import { JOURNAL_XP, WALLET_RATIO, PIN_LOCKOUT_THRESHOLD } from '@/constants/points'

beforeEach(resetStore)

describe('saveJournalEntry', () => {
  it('creates a new entry and awards XP + wallet points for the first entry of the day', () => {
    const { isFirst } = usePlannerStore.getState().saveJournalEntry('2024-01-08', 'First thought')

    expect(isFirst).toBe(true)
    const state = usePlannerStore.getState()
    const keys  = Object.keys(state.journal).filter(k => k.startsWith('2024-01-08'))
    expect(keys).toHaveLength(1)
    expect(state.journal[keys[0]]).toBe('First thought')
    expect(state.rankXP).toBe(JOURNAL_XP)
    expect(state.rewardWallet).toBe(Math.floor(JOURNAL_XP / WALLET_RATIO))
  })

  it('does NOT award XP or wallet points for subsequent entries on the same day', () => {
    usePlannerStore.getState().saveJournalEntry('2024-01-08', 'First')
    const before = usePlannerStore.getState()

    const { isFirst } = usePlannerStore.getState().saveJournalEntry('2024-01-08', 'Second')

    expect(isFirst).toBe(false)
    const state = usePlannerStore.getState()
    expect(state.rankXP).toBe(before.rankXP)
    expect(state.rewardWallet).toBe(before.rewardWallet)
    const keys = Object.keys(state.journal).filter(k => k.startsWith('2024-01-08'))
    expect(keys).toHaveLength(2)
  })

  it('updates an existing entry by key when editKey is provided, without changing XP', () => {
    usePlannerStore.getState().saveJournalEntry('2024-01-08', 'Original')
    const key = Object.keys(usePlannerStore.getState().journal)[0]
    const xpBefore = usePlannerStore.getState().rankXP

    const { isFirst } = usePlannerStore.getState().saveJournalEntry('2024-01-08', 'Updated', key)

    expect(isFirst).toBe(false)
    const state = usePlannerStore.getState()
    expect(state.journal[key]).toBe('Updated')
    expect(state.rankXP).toBe(xpBefore)
  })

  it('generates a unique key including seconds when two entries are saved in the same minute', () => {
    usePlannerStore.getState().saveJournalEntry('2024-01-08', 'Entry A')
    // Manually inject a duplicate-minute entry to force seconds suffix
    const existing = Object.keys(usePlannerStore.getState().journal)
    const minuteKey = existing[0].slice(0, 16) // e.g. "2024-01-08 HH:MM"
    usePlannerStore.setState(s => ({ journal: { ...s.journal, [minuteKey]: 'Fake' } }))

    usePlannerStore.getState().saveJournalEntry('2024-01-08', 'Entry B')

    const keys = Object.keys(usePlannerStore.getState().journal)
    expect(keys.length).toBeGreaterThan(1)
  })
})

describe('deleteJournalEntry', () => {
  it('removes an entry by key without affecting other entries', () => {
    usePlannerStore.getState().saveJournalEntry('2024-01-08', 'Keep me')
    usePlannerStore.getState().saveJournalEntry('2024-01-08', 'Delete me')
    const [keepKey, delKey] = Object.keys(usePlannerStore.getState().journal).slice(0, 2)

    usePlannerStore.getState().deleteJournalEntry(delKey)

    const journal = usePlannerStore.getState().journal
    expect(journal[keepKey]).toBeDefined()
    expect(journal[delKey]).toBeUndefined()
  })
})

describe('setJournalPin / setJournalSecurity / recordPinFailure / resetPinFailures', () => {
  it('sets a journal PIN hash', () => {
    usePlannerStore.getState().setJournalPin('abc123')
    expect(usePlannerStore.getState().journalPin).toBe('abc123')
  })

  it('clears the PIN and related security fields when null is passed', () => {
    usePlannerStore.getState().setJournalPin('abc123')
    usePlannerStore.getState().setJournalPin(null)
    const state = usePlannerStore.getState()
    expect(state.journalPin).toBeNull()
    expect(state.journalPinQuestion).toBeNull()
    expect(state.journalPinAnswerHash).toBeNull()
  })

  it('setJournalSecurity stores all three fields together', () => {
    usePlannerStore.getState().setJournalSecurity('hash', 'What is your pet name?', 'answerhash')
    const state = usePlannerStore.getState()
    expect(state.journalPin).toBe('hash')
    expect(state.journalPinQuestion).toBe('What is your pet name?')
    expect(state.journalPinAnswerHash).toBe('answerhash')
  })

  it('records pin failures and increments the counter', () => {
    usePlannerStore.getState().recordPinFailure()
    usePlannerStore.getState().recordPinFailure()
    expect(usePlannerStore.getState().pinFailedAttempts).toBe(2)
  })

  it('resets pin failure counter', () => {
    usePlannerStore.getState().recordPinFailure()
    usePlannerStore.getState().resetPinFailures()
    expect(usePlannerStore.getState().pinFailedAttempts).toBe(0)
  })

  it('sets pinLockoutUntil when failures reach PIN_LOCKOUT_THRESHOLD', () => {
    for (let i = 0; i < PIN_LOCKOUT_THRESHOLD; i++) {
      usePlannerStore.getState().recordPinFailure()
    }
    expect(usePlannerStore.getState().pinLockoutUntil).not.toBeNull()
  })
})
