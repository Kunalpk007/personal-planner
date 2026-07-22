'use client'
import { useEffect } from 'react'
import { usePlannerStore }   from '@/store'
import { setUserScope, scopedStorageKey } from '@/store/userScope'
import { STORAGE_KEY, INITIAL_STATE } from '@/store/defaults'
import { loadFromFirestore, loadJournalEntries, migrateJournalFromState, saveToFirestore } from '@/lib/firebase/firestore'
import { waitForAuth, getClientAuth } from '@/lib/firebase/client'
import { initSync, destroySync } from '@/lib/sync/sync'
import { useSocialStore } from '@/store/social/social.store'
import { FLAGS } from '@/constants/feature-flags'
import { setSyncStatus } from '@/lib/sync-status'

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
        // Whether Firebase Auth actually has a signed-in user. Everything that
        // touches Firestore (cloud load, brain-sync, Friends listeners) MUST
        // be gated on this — the security rules require request.auth, so any
        // Firestore read/listen attempted while this is false is rejected with
        // permission-denied (which is exactly the console-error storm this
        // guards against).
        let authReady = false

        // Signed-in but no Firebase config baked into this build — this
        // deployment (e.g. Netlify without NEXT_PUBLIC_FIREBASE_* env vars
        // set) is running entirely local-only. Surface it loudly instead of
        // silently diverging from other devices — see SyncStatusBadge.tsx.
        if (!firebaseEnabled) setSyncStatus('disabled')

        if (firebaseEnabled) {
          authReady = await waitForAuth()
          if (!authReady) {
            // The app's own session cookie (kp_uid) exists, but the Firebase
            // client's auth session isn't restored (currentUser is null) —
            // common on a fresh browser/device where the Firebase session
            // never persisted. Run local-only rather than firing a wall of
            // permission-denied Firestore errors; the user can re-sign-in to
            // re-establish the Firebase session.
            console.warn('[bootstrap] Firebase Auth not ready (no currentUser) — running local-only this session; cloud sync & Friends disabled until re-login')
            setSyncStatus('disabled')
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

        // Tracks whether the cloud snapshot won the local-vs-cloud merge below.
        // Hoisted so the cloud-heal push further down can tell whether THIS
        // device is holding authoritative data the cloud is missing.
        let preferCloud = false

        if (cloudData) {
          // Last-write-wins: prefer whichever snapshot (local vs. cloud) was
          // modified more recently, instead of always assuming local is newer.
          // Without a local timestamp we have no way to know local is stale,
          // so it still wins by default — but a newer cloud write overrides it.
          const localTs = (savedState as Record<string, unknown> | null)?.lastModified as string | undefined
          const cloudTs = (cloudData as Record<string, unknown>).lastModified as string | undefined
          const cloudIsNewer = !!cloudTs && (!localTs || cloudTs > localTs)

          // Safety net for a real bug: `lastModified` is stamped on EVERY
          // local mutation, including journal edits (store/index.ts's
          // stampedSet wraps every slice, journal included) — even though
          // journal itself never participates in this merge (it's always
          // loaded fresh from its own Firestore subcollection just below).
          // That means a device used mainly for journaling can end up with
          // a `lastModified` that looks newer than another device's real
          // last sync, even though its own tasks/streak/history are empty —
          // e.g. a rarely-used desktop browser picks up an empty/legacy
          // local snapshot (see ensureScopedKey/findBestData above), the
          // user writes a journal entry, and that empty snapshot's
          // timestamp now "wins" the comparison above and would silently
          // wipe out real progress synced from another device. Never let an
          // empty local snapshot beat cloud data that actually has content,
          // regardless of which timestamp claims to be newer.
          const localLooksEmpty = !savedState || (
            !((savedState as Record<string, unknown>).tasks as unknown[] | undefined)?.length &&
            !((savedState as Record<string, unknown>).history as unknown[] | undefined)?.length &&
            !((savedState as Record<string, unknown>).streak as number | undefined)
          )
          const cloudHasContent = !!(
            ((cloudData as Record<string, unknown>).tasks as unknown[] | undefined)?.length ||
            ((cloudData as Record<string, unknown>).history as unknown[] | undefined)?.length ||
            ((cloudData as Record<string, unknown>).streak as number | undefined)
          )
          preferCloud = cloudIsNewer || (localLooksEmpty && cloudHasContent)

          const merged = preferCloud
            ? { ...INITIAL_STATE, ...(savedState ?? {}), ...cloudData }
            : { ...INITIAL_STATE, ...cloudData, ...(savedState ?? {}) }
          usePlannerStore.setState({ ...merged, journal: journalEntries })
        } else {
          usePlannerStore.setState({ ...INITIAL_STATE, ...(savedState ?? {}) })
        }

        // Cloud-heal push. Root cause of the "desktop/Netlify shows no
        // tasks/streak but journal is fine, while mobile has everything"
        // divergence: journal syncs through its own per-entry subcollection
        // (users/{uid}/journal/*) which is small and reliable, but the whole
        // planner state (tasks/streak/history) rides in ONE document
        // (users/{uid}/planner/state). If that single write ever fell behind
        // on the device that actually holds the data — a transient error, an
        // auth-timing gap, or simply that this push previously only ran when
        // the cloud doc was entirely ABSENT — the cloud planner doc stays
        // stale/empty, so every OTHER device loads empty tasks/streak while
        // its journal (separate path) looks perfect.
        //
        // Fix: whenever THIS device won the merge (its local data is at least
        // as new as cloud, or cloud was absent) AND it actually has content,
        // re-upload it so the cloud planner doc catches up. The device that
        // holds streak 7 + history now heals the cloud, and the empty desktop
        // converges on the next load. Guarded by `preferCloud` so a device
        // that's genuinely behind never clobbers newer cloud data.
        if (firebaseEnabled && authReady && !preferCloud) {
          const snap = usePlannerStore.getState()
          const hasContent = !!(snap.history?.length || snap.tasks?.length || snap.streak)
          if (hasContent) {
            try {
              const { journal: _j, ...rest } = snap as unknown as Record<string, unknown>
              await saveToFirestore(safeUid, rest)
            } catch (e) {
              console.error('[bootstrap] cloud-heal push error:', e)
            }
          }
        }

        // Only start the brain-sync loop and the Friends listeners once
        // Firebase Auth is confirmed ready — attaching them without an
        // authenticated user makes every Firestore listen fail with
        // permission-denied. With no auth, the app stays local-only.
        if (firebaseEnabled && authReady) {
          try {
            initSync(safeUid)
          } catch (e) {
            console.error('[bootstrap] sync init error:', e)
          }
          // Friends is a separate, non-persisted, online-only store (see
          // store/social/social.store.ts) — it doesn't share the planner
          // store's offline-first cache/merge logic above, it just needs a
          // uid + display name to start its own Firestore listeners.
          //
          // Gated behind FLAGS.FRIENDS: these listeners read the
          // friends/friendRequests/rewardApprovals collections, which only
          // exist in the *extended* Firestore rules (see firestore.rules).
          // Starting them unconditionally means every signed-in user gets a
          // permission-denied snapshot error the moment they open the app,
          // even with Friends turned off and even before the extended rules
          // are deployed — this flag check is what actually prevents that.
          if (FLAGS.FRIENDS) {
            try {
              const authUser = getClientAuth().currentUser
              useSocialStore.getState().init(safeUid, authUser?.displayName || authUser?.email || 'Anonymous')
            } catch (e) {
              console.error('[bootstrap] social init error:', e)
            }
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
      useSocialStore.getState().teardown()
    }
  }, [])

  return null
}
