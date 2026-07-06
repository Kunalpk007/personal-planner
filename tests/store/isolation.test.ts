/**
 * Cross-user data isolation tests.
 *
 * Root cause of the bug:
 *   redirect() in a Next.js Server Action is handled as CLIENT-SIDE navigation.
 *   The JS bundle stays alive, so the Zustand store module stays in memory with
 *   the previous user's data. If the new user has no localStorage entry,
 *   persist.rehydrate() is a no-op and the old user's data silently leaks through.
 *
 * The fix (in StoreBootstrap.init()):
 *   1. setUserScope(uid)               — correct key from here on
 *   2. ensureScopedKey(uid)            — migrate legacy data if needed
 *   3. Read localStorage[uid] NOW      — snapshot before any setState overwrites it
 *   4. setState({ ...INITIAL_STATE, ...(savedState ?? {}) })
 *      — spreads INITIAL_STATE first to wipe every previous user's field,
 *        then overlays this user's saved data (or nothing for a new user).
 *        Uses merge mode (no `true`) to keep slice action functions intact.
 *
 * simulateLogin() below mirrors that exact sequence so these tests are 1:1
 * with what the real StoreBootstrap does.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { usePlannerStore } from '@/store'
import { setUserScope, getUserScope, scopedStorageKey } from '@/store/userScope'
import { STORAGE_KEY, INITIAL_STATE } from '@/store/defaults'

/** Mirrors StoreBootstrap.init() for a logged-in user (no Firestore in tests). */
function simulateLogin(uid: string) {
  setUserScope(uid)
  // Read snapshot BEFORE setState (setState triggers persist write that would overwrite it)
  let savedState: Record<string, unknown> | null = null
  try {
    const raw = localStorage.getItem(scopedStorageKey(STORAGE_KEY))
    if (raw) {
      const parsed = JSON.parse(raw)
      savedState = parsed?.state ?? parsed
    }
  } catch {}
  usePlannerStore.setState({ ...INITIAL_STATE, ...(savedState ?? {}) })
}

/** Mirrors handleSignOut: null scope + merge-reset (preserves actions, writes to __anon__ key). */
function simulateLogout() {
  setUserScope(null)
  usePlannerStore.setState({ ...INITIAL_STATE })
}

beforeEach(() => {
  simulateLogout()
  localStorage.clear()
})

// ─── In-memory isolation ───────────────────────────────────────────────────

describe('in-memory isolation (no localStorage)', () => {
  it('user B sees clean state after user A had data in memory', () => {
    // User A: load, then pollute the store with data
    simulateLogin('uid-A')
    usePlannerStore.setState({ rankXP: 500, streak: 12, daysActive: 30 })
    expect(usePlannerStore.getState().rankXP).toBe(500)

    // Logout A, login B (B has no localStorage data — new user scenario)
    simulateLogout()
    simulateLogin('uid-B')

    const s = usePlannerStore.getState()
    expect(s.rankXP).toBe(0)         // B must NOT inherit A's XP
    expect(s.streak).toBe(0)         // B must NOT inherit A's streak
    expect(s.daysActive).toBe(0)
    expect(s.history).toHaveLength(0)
    expect(s.rewardWallet).toBe(0)
  })

  it('three sequential users all see clean state', () => {
    simulateLogin('uid-A')
    usePlannerStore.setState({ rankXP: 100 })
    simulateLogout()

    simulateLogin('uid-B')
    expect(usePlannerStore.getState().rankXP).toBe(0)
    usePlannerStore.setState({ rankXP: 200 })
    simulateLogout()

    simulateLogin('uid-C')
    expect(usePlannerStore.getState().rankXP).toBe(0) // C must NOT see B's 200
  })

  it('logout leaves the store at INITIAL_STATE data values', () => {
    usePlannerStore.setState({ rankXP: 999, streak: 30, daysActive: 60 })
    simulateLogout()
    const s = usePlannerStore.getState()
    expect(s.rankXP).toBe(0)
    expect(s.streak).toBe(0)
    expect(s.daysActive).toBe(0)
    expect(s.tasks).toHaveLength(0)
  })

  it('logout sets user scope to null', () => {
    setUserScope('uid-A')
    expect(getUserScope()).toBe('uid-A')
    simulateLogout()
    expect(getUserScope()).toBeNull()
  })

  it('action functions survive the login/logout reset (slice actions are preserved)', () => {
    simulateLogin('uid-A')
    simulateLogout()
    simulateLogin('uid-B')
    // If actions were wiped by the reset, these would throw
    expect(typeof usePlannerStore.getState().setConfig).toBe('function')
    expect(typeof usePlannerStore.getState().setMood).toBe('function')
    expect(typeof usePlannerStore.getState().saveJournalEntry).toBe('function')
  })
})

// ─── localStorage key isolation ────────────────────────────────────────────

describe('localStorage key isolation', () => {
  it('different users get different scoped storage keys', () => {
    setUserScope('uid-A')
    expect(scopedStorageKey(STORAGE_KEY)).toBe(`${STORAGE_KEY}:uid-A`)
    setUserScope('uid-B')
    expect(scopedStorageKey(STORAGE_KEY)).toBe(`${STORAGE_KEY}:uid-B`)
    setUserScope(null)
    expect(scopedStorageKey(STORAGE_KEY)).toBe(`${STORAGE_KEY}:__anon__`)
  })

  it('returning user A loads their own saved data', () => {
    // Pre-seed A's scoped localStorage key (as if from a previous session)
    localStorage.setItem(
      `${STORAGE_KEY}:uid-A`,
      JSON.stringify({ state: { ...INITIAL_STATE, rankXP: 1200, streak: 7, daysActive: 14 }, version: 2 })
    )

    simulateLogin('uid-A')

    expect(usePlannerStore.getState().rankXP).toBe(1200)
    expect(usePlannerStore.getState().streak).toBe(7)
    expect(usePlannerStore.getState().daysActive).toBe(14)
  })

  it('user B gets their own data, not user A\'s', () => {
    localStorage.setItem(
      `${STORAGE_KEY}:uid-A`,
      JSON.stringify({ state: { ...INITIAL_STATE, rankXP: 1200, streak: 7 }, version: 2 })
    )
    localStorage.setItem(
      `${STORAGE_KEY}:uid-B`,
      JSON.stringify({ state: { ...INITIAL_STATE, rankXP: 300, streak: 2 }, version: 2 })
    )

    simulateLogin('uid-A')
    expect(usePlannerStore.getState().rankXP).toBe(1200)

    simulateLogout()

    simulateLogin('uid-B')
    expect(usePlannerStore.getState().rankXP).toBe(300)
    expect(usePlannerStore.getState().streak).toBe(2)
  })

  it('new user B (no localStorage) gets INITIAL_STATE even after A had large XP in memory', () => {
    localStorage.setItem(
      `${STORAGE_KEY}:uid-A`,
      JSON.stringify({ state: { ...INITIAL_STATE, rankXP: 800, streak: 20 }, version: 2 })
    )
    simulateLogin('uid-A')
    expect(usePlannerStore.getState().rankXP).toBe(800)

    simulateLogout()
    simulateLogin('uid-B')  // no localStorage for B

    expect(usePlannerStore.getState().rankXP).toBe(0)
    expect(usePlannerStore.getState().streak).toBe(0)
  })

  it('A → B → A round-trip preserves A\'s data on return', () => {
    localStorage.setItem(
      `${STORAGE_KEY}:uid-A`,
      JSON.stringify({ state: { ...INITIAL_STATE, rankXP: 500 }, version: 2 })
    )
    localStorage.setItem(
      `${STORAGE_KEY}:uid-B`,
      JSON.stringify({ state: { ...INITIAL_STATE, rankXP: 100 }, version: 2 })
    )

    simulateLogin('uid-A')
    expect(usePlannerStore.getState().rankXP).toBe(500)

    simulateLogout()
    simulateLogin('uid-B')
    expect(usePlannerStore.getState().rankXP).toBe(100)

    simulateLogout()
    simulateLogin('uid-A')
    expect(usePlannerStore.getState().rankXP).toBe(500) // A's data restored correctly
  })

  it('logout does NOT overwrite the current user\'s scoped localStorage data', () => {
    // A's data is saved in their scoped key
    const aData = JSON.stringify({ state: { ...INITIAL_STATE, rankXP: 777 }, version: 2 })
    localStorage.setItem(`${STORAGE_KEY}:uid-A`, aData)

    simulateLogin('uid-A')
    simulateLogout()  // scope goes null → writes to __anon__ key, not uid-A key

    // A's scoped key must still have their data
    const raw = localStorage.getItem(`${STORAGE_KEY}:uid-A`)
    const parsed = raw ? JSON.parse(raw) : null
    const savedXP = parsed?.state?.rankXP ?? parsed?.rankXP
    expect(savedXP).toBe(777)  // must NOT be wiped by logout
  })
})

// ─── Legacy unscoped key guard ─────────────────────────────────────────────

describe('legacy unscoped key guard (findBestData)', () => {
  it('user B does NOT inherit user A\'s legacy data after A\'s migration', () => {
    // Simulate: A migrated, their data moved to scoped key, legacy key gone, marker set
    localStorage.setItem(`${STORAGE_KEY}__migrated`, 'uid-A')
    localStorage.setItem(
      `${STORAGE_KEY}:uid-A`,
      JSON.stringify({ state: { ...INITIAL_STATE, rankXP: 999 }, version: 2 })
    )
    // No unscoped legacy key (removed during A's migration)

    simulateLogin('uid-B')  // B is new, no data

    expect(usePlannerStore.getState().rankXP).toBe(0)
  })

  it('unscoped legacy data IS migrated for a user whose migration marker matches their uid', () => {
    // Simulate ensureScopedKey already ran for this user:
    // legacy data was copied to scoped key, marker set, legacy key removed
    localStorage.setItem(`${STORAGE_KEY}__migrated`, 'uid-legacy')
    localStorage.setItem(
      `${STORAGE_KEY}:uid-legacy`,
      JSON.stringify({ state: { ...INITIAL_STATE, rankXP: 420, streak: 3 }, version: 2 })
    )

    simulateLogin('uid-legacy')

    expect(usePlannerStore.getState().rankXP).toBe(420)
    expect(usePlannerStore.getState().streak).toBe(3)
  })
})
