'use client'
import { useEffect } from 'react'
import { usePlannerStore }   from '@/store'
import { setUserScope, scopedStorageKey } from '@/store/userScope'
import { STORAGE_KEY, INITIAL_STATE } from '@/store/defaults'
import { loadFromFirestore, loadJournalEntries, migrateJournalFromState, saveToFirestore } from '@/lib/firebase/firestore'
import { waitForAuth } from '@/lib/firebase/client'
import { initSync, destroySync } from '@/lib/sync/sync'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

function hasMeaningfulData(raw: string | null): boolean {
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw)
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

function findBestData(uid: string): string | null {
  const migratedTo = localStorage.getItem(`${STORAGE_KEY}__migrated`)
  const legacyOk   = !migratedTo || migratedTo === uid

  const candidates = [
    `${STORAGE_KEY}:${uid}`,
    `${STORAGE_KEY}:${uid}_backup`,
    ...(legacyOk ? [STORAGE_KEY, `${STORAGE_KEY}_backup`] : []),
  ]

  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key)
      if (hasMeaningfulData(raw)) return raw
    } catch {}
  }

  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return raw
    } catch {}
  }

  return null
}

function ensureScopedKey(uid: string): void {
  const scopedKey  = `${STORAGE_KEY}:${uid}`
  const existingRaw = localStorage.getItem(scopedKey)

  if (hasMeaningfulData(existingRaw)) return

  const best = findBestData(uid)
  if (best && best !== existingRaw) {
    if (existingRaw) localStorage.setItem(`${scopedKey}_backup`, existingRaw)
    localStorage.setItem(scopedKey, best)
  }

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
  useEffect(() => {
    const uid: string | null = readCookie('kp_uid')

    if (!uid) {
      try {
        const legacyRaw = localStorage.getItem(STORAGE_KEY)
        if (legacyRaw) {
          const anonKey = `${STORAGE_KEY}:__anon__`
          if (!hasMeaningfulData(localStorage.getItem(anonKey))) {
            localStorage.setItem(anonKey, legacyRaw)
          }
        }
        usePlannerStore.persist.rehydrate()
      } catch (e) {
        console.error('[bootstrap] anonymous init error:', e)
        usePlannerStore.setState({ ...INITIAL_STATE })
      }
      onReady()
      return
    }

    const safeUid: string = uid

    async function init() {
      try {
        setUserScope(safeUid)
        ensureScopedKey(safeUid)

        let savedState: Record<string, unknown> | null = null
        try {
          const raw = localStorage.getItem(scopedStorageKey(STORAGE_KEY))
          if (raw) {
            const parsed = JSON.parse(raw)
            savedState = parsed?.state ?? parsed
          }
        } catch {}

        const firebaseEnabled = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY
        let cloudData: Record<string, unknown> | null = null
        let journalEntries: Record<string, string> = {}

        if (firebaseEnabled) {
          const authReady = await waitForAuth()
          if (!authReady) {
            console.warn('[bootstrap] Firebase Auth not ready — skipping cloud load')
          } else {
            try {
              cloudData = await loadFromFirestore(safeUid)
              const hasEmbeddedJournal = cloudData && (cloudData as Record<string, unknown>)['journal']
              if (hasEmbeddedJournal) {
                await migrateJournalFromState(safeUid, cloudData!)
                delete (cloudData as Record<string, unknown>)['journal']
              }
              journalEntries = await loadJournalEntries(safeUid)
            } catch (e) {
              console.error('[bootstrap] Firestore load error:', e)
            }
          }
        }

        if (cloudData) {
          usePlannerStore.setState({ ...INITIAL_STATE, ...cloudData, ...(savedState ?? {}), journal: journalEntries })
        } else {
          usePlannerStore.setState({ ...INITIAL_STATE, ...(savedState ?? {}) })
        }

        if (firebaseEnabled && !cloudData) {
          const snap = usePlannerStore.getState()
          if (snap.history?.length || snap.tasks?.length) {
            const authReady = await waitForAuth()
            if (authReady) {
              try {
                const { journal: _j, ...rest } = snap as unknown as Record<string, unknown>
                await saveToFirestore(safeUid, rest)
              } catch (e) {
                console.error('[bootstrap] initial Firestore push error:', e)
              }
            }
          }
        }

        if (firebaseEnabled) {
          try {
            initSync(safeUid)
          } catch (e) {
            console.error('[bootstrap] sync init error:', e)
          }
        }
      } catch (e) {
        console.error('[bootstrap] init failed — falling back to partial state:', e)
        usePlannerStore.setState({ ...INITIAL_STATE })
      } finally {
        onReady()
      }
    }

    init()

    return () => {
      destroySync()
    }
  }, [])

  return null
}
