'use client'
import { useEffect, useRef } from 'react'
import { usePlannerStore }   from '@/store'
import { setUserScope, scopedStorageKey } from '@/store/userScope'
import { STORAGE_KEY, INITIAL_STATE } from '@/store/defaults'
import { loadFromFirestore, saveToFirestore } from '@/lib/firebase/firestore'
import { setSyncStatus } from '@/lib/sync-status'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

/**
 * Checks whether a raw localStorage value string contains meaningful
 * user data (vs. the empty INITIAL_STATE written by the setState bug).
 */
function hasMeaningfulData(raw: string | null): boolean {
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw)
    // Zustand persist wraps state under { state: {...}, version: N }
    const s = parsed?.state ?? parsed
    return (
      (s?.history?.length   > 0) ||
      (s?.tasks?.length     > 0) ||
      (s?.rankXP            > 0) ||
      (s?.streak            > 0) ||
      (s?.rewardWallet      > 0) ||
      (s?.daysActive        > 0)
    )
  } catch {
    return false
  }
}

/**
 * Finds the best available planner data for a given uid by scanning all
 * possible localStorage locations (scoped key, backup, legacy, legacy backup).
 * Returns the raw JSON string of the best data found, or null.
 *
 * The unscoped legacy key is only considered if it was never migrated for a
 * DIFFERENT user — otherwise user B would inherit user A's legacy data.
 */
function findBestData(uid: string): string | null {
  // The legacy unscoped key is safe to read only if it hasn't already been
  // claimed by a different user's migration.
  const migratedTo = localStorage.getItem(`${STORAGE_KEY}__migrated`)
  const legacyOk   = !migratedTo || migratedTo === uid

  const candidates = [
    `${STORAGE_KEY}:${uid}`,
    `${STORAGE_KEY}:${uid}_backup`,
    ...(legacyOk ? [STORAGE_KEY, `${STORAGE_KEY}_backup`] : []),
  ]

  // Prefer a candidate that has meaningful data
  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key)
      if (hasMeaningfulData(raw)) return raw
    } catch {}
  }

  // Fall back to any existing data (even if empty)
  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return raw
    } catch {}
  }

  return null
}

/**
 * Ensures the scoped key for uid contains the best available data.
 * Copies from legacy / backup locations if the scoped key is missing or stale.
 */
function ensureScopedKey(uid: string): void {
  const scopedKey  = `${STORAGE_KEY}:${uid}`
  const existingRaw = localStorage.getItem(scopedKey)

  // If scoped key already has meaningful data, nothing to do
  if (hasMeaningfulData(existingRaw)) return

  // Look for better data elsewhere and copy it to the scoped key
  const best = findBestData(uid)
  if (best && best !== existingRaw) {
    // Write backup of whatever is in the scoped key first
    if (existingRaw) localStorage.setItem(`${scopedKey}_backup`, existingRaw)
    localStorage.setItem(scopedKey, best)
  }

  // Mark legacy key as migrated so other users don't inherit it
  const legacyRaw = localStorage.getItem(STORAGE_KEY)
  if (legacyRaw) {
    localStorage.setItem(`${STORAGE_KEY}__migrated`, uid)
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(`${STORAGE_KEY}_backup`)
  }
}

interface Props {
  onReady: () => void
}

export function StoreBootstrap({ onReady }: Props) {
  const syncRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipRef = useRef(true)

  useEffect(() => {
    const uid: string | null = readCookie('kp_uid')

    if (!uid) {
      // No session cookie — user is not logged in or has an old session.
      // Try to load from the legacy unscoped key so old sessions still work.
      const legacyRaw = localStorage.getItem(STORAGE_KEY)
      if (legacyRaw) {
        // Set anon scope so persist reads from the legacy-fallback path
        // (scopedStorageKey returns __anon__ when _userId is null, but
        // the persist middleware stored data at STORAGE_KEY directly in
        // old sessions, so we copy it to __anon__ to let rehydrate find it)
        const anonKey = `${STORAGE_KEY}:__anon__`
        if (!hasMeaningfulData(localStorage.getItem(anonKey))) {
          localStorage.setItem(anonKey, legacyRaw)
        }
      }
      usePlannerStore.persist.rehydrate()
      onReady()
      return
    }

    const safeUid: string = uid  // narrowed — null case handled above
    let unsubscribe: (() => void) | null = null

    async function init() {
      // 1. Set scope first — all storage key lookups below use this uid.
      setUserScope(safeUid)

      // 2. Migrate legacy unscoped data to this user's scoped key if needed.
      ensureScopedKey(safeUid)

      // 3. Read this user's saved localStorage data BEFORE any setState call.
      //    Critical: setState triggers the persist middleware to write to localStorage,
      //    which would overwrite the user's saved data before we have a chance to
      //    read it back. By snapshotting first we avoid that race.
      let savedState: Record<string, unknown> | null = null
      try {
        const raw = localStorage.getItem(scopedStorageKey(STORAGE_KEY))
        if (raw) {
          const parsed = JSON.parse(raw)
          savedState = parsed?.state ?? parsed
        }
      } catch {}

      // 4. Try Firestore if configured (cloud source of truth).
      const firebaseEnabled = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY
      let cloudData: Record<string, unknown> | null = null
      if (firebaseEnabled) {
        try {
          cloudData = await loadFromFirestore(safeUid)
        } catch {
          // Offline or credentials invalid — fall through to localStorage snapshot.
        }
      }

      // 5. Load the user's data into the store.
      //
      //    We spread INITIAL_STATE first so that:
      //    a) Every field in the store is reset to a known-safe default, wiping
      //       any previous user's in-memory data (the cross-user isolation fix).
      //    b) Fields not present in the user's saved data get their default values
      //       (handles schema additions without breaking old saves).
      //    We use merge mode (no `true` flag) so Zustand keeps the slice action
      //    functions that were set up when the store was created.
      if (cloudData) {
        usePlannerStore.setState({ ...INITIAL_STATE, ...cloudData })
      } else {
        usePlannerStore.setState({ ...INITIAL_STATE, ...(savedState ?? {}) })
      }

      // 6. First-time migration to Firestore (only when cloud had no data yet).
      if (firebaseEnabled && !cloudData) {
        const snap = usePlannerStore.getState()
        if (snap.history?.length || snap.tasks?.length) {
          try { await saveToFirestore(safeUid, snap as unknown as Record<string, unknown>) }
          catch { /* offline */ }
        }
      }

      skipRef.current = false
      onReady()

      if (firebaseEnabled) {
        unsubscribe = usePlannerStore.subscribe((state) => {
          if (skipRef.current) return
          if (syncRef.current) clearTimeout(syncRef.current)
          syncRef.current = setTimeout(() => {
            setSyncStatus('saving')
            saveToFirestore(safeUid, state as unknown as Record<string, unknown>)
              .then(() => setSyncStatus('saved'))
              .catch(() => setSyncStatus('error'))
          }, 5000)
        })
      }
    }

    init()

    return () => {
      if (syncRef.current) clearTimeout(syncRef.current)
      if (unsubscribe) unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
