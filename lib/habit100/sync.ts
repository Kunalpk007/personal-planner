import { useHabit100Store } from '@/store/habit100/habit100.store'
import { loadHabit100Meta, loadHabit100Days, loadHabit100Weeks, saveHabit100Meta, saveHabit100Day, saveHabit100Week } from '@/lib/firebase/habit100'
import { waitForAuth } from '@/lib/firebase/client'
import type { Habit100Day, Habit100Meta, Habit100Week } from '@/store/habit100/types'

/** Debounced per-doc Firestore sync for the Consistency Tracker — mirrors
 *  lib/sync/sync.ts's journal-change-detection exactly (diff against the
 *  last-synced snapshot, push only what changed), kept as its own module
 *  rather than folded into the main sync loop so this feature's writes
 *  never ride the main planner doc's full-state resync. */

let _uid: string | null = null
let _debounceTimer: ReturnType<typeof setTimeout> | null = null
let _unsubscribe: (() => void) | null = null
let _authReady = false
let _prevMeta: Habit100Meta | null = null
let _prevDays: Record<string, Habit100Day> = {}
let _prevWeeks: Record<number, Habit100Week> = {}

function isFirebaseEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY
}

async function ensureAuth(): Promise<boolean> {
  if (_authReady) return true
  const ok = await waitForAuth()
  _authReady = ok
  return ok
}

/** Loads the cloud snapshot once on init and merges it into local state —
 *  mirrors StoreBootstrap's local-vs-cloud merge, at Habit100 scale. */
export async function loadHabit100Cloud(uid: string): Promise<void> {
  if (!isFirebaseEnabled()) return
  if (!(await ensureAuth())) return
  try {
    const [meta, days, weeks] = await Promise.all([
      loadHabit100Meta(uid), loadHabit100Days(uid), loadHabit100Weeks(uid),
    ])
    useHabit100Store.getState().mergeFromCloud(meta, days, weeks)
  } catch (e) {
    console.error('[habit100 sync] cloud load error:', e)
  }
}

async function flush(): Promise<void> {
  if (!_uid || !isFirebaseEnabled()) return
  if (!(await ensureAuth())) return
  if (!_uid) return

  const { meta, days, weeks } = useHabit100Store.getState()

  try {
    if (meta && meta !== _prevMeta) {
      await saveHabit100Meta(_uid, meta)
      _prevMeta = meta
    }
    for (const [date, day] of Object.entries(days)) {
      if (_prevDays[date] !== day) {
        await saveHabit100Day(_uid, day)
      }
    }
    _prevDays = { ...days }
    for (const [idx, week] of Object.entries(weeks)) {
      if (_prevWeeks[Number(idx)] !== week) {
        await saveHabit100Week(_uid, week)
      }
    }
    _prevWeeks = { ...weeks }
  } catch (e) {
    console.error('[habit100 sync] flush error:', e)
  }
}

function debouncedFlush(): void {
  if (_debounceTimer) clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null
    flush()
  }, 2000)
}

export function initHabit100Sync(uid: string): void {
  if (_uid === uid && _unsubscribe) return
  destroyHabit100Sync()
  _uid = uid
  const s = useHabit100Store.getState()
  _prevMeta = s.meta
  _prevDays = { ...s.days }
  _prevWeeks = { ...s.weeks }
  _unsubscribe = useHabit100Store.subscribe(() => debouncedFlush())
}

export async function habit100SyncNow(): Promise<void> {
  if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null }
  await flush()
}

export function destroyHabit100Sync(): void {
  if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null }
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null }
  _uid = null
  _prevMeta = null
  _prevDays = {}
  _prevWeeks = {}
}
