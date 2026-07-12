import { usePlannerStore } from '@/store'
import { saveToFirestore, saveJournalEntryToSubcollection, deleteJournalEntryFromSubcollection } from '@/lib/firebase/firestore'
import { waitForAuth } from '@/lib/firebase/client'
import { setSyncStatus } from '@/lib/sync-status'

let _uid: string | null = null
let _debounceTimer: ReturnType<typeof setTimeout> | null = null
let _prevJournal: Record<string, string> = {}
let _unsubscribe: (() => void) | null = null
let _authReady = false

function isFirebaseEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY
}

/** Ensure Firebase Auth has restored the session before touching Firestore. */
async function ensureAuth(): Promise<boolean> {
  if (_authReady) return true
  setSyncStatus('waiting')
  const ok = await waitForAuth()
  _authReady = ok
  if (!ok) {
    console.warn('[sync] auth not ready — Firestore operations deferred')
    setSyncStatus('error')
  }
  return ok
}

async function syncPlannerState(): Promise<void> {
  if (!_uid || !isFirebaseEnabled()) return
  if (!(await ensureAuth())) return
  if (!_uid) return // guard against destroySync during async gap
  try {
    setSyncStatus('saving')
    const state = usePlannerStore.getState()
    await saveToFirestore(_uid, state as unknown as Record<string, unknown>)
    setSyncStatus('saved')
  } catch (e) {
    console.error('[sync] brain-sync error:', e)
    setSyncStatus('error')
  }
}

function hasJournalChanged(current: Record<string, string>): Array<{ dateKey: string; text: string | null }> {
  const changes: Array<{ dateKey: string; text: string | null }> = []
  const prevKeys = new Set(Object.keys(_prevJournal))
  const currKeys = new Set(Object.keys(current))

  for (const key of currKeys) {
    if (!prevKeys.has(key) || _prevJournal[key] !== current[key]) {
      changes.push({ dateKey: key, text: current[key] })
    }
  }
  for (const key of prevKeys) {
    if (!currKeys.has(key)) {
      changes.push({ dateKey: key, text: null })
    }
  }
  return changes
}

async function flushJournalChanges(): Promise<void> {
  if (!_uid || !isFirebaseEnabled()) return
  if (!(await ensureAuth())) return
  if (!_uid) return // guard against destroySync during async gap

  const current = usePlannerStore.getState().journal
  const changes = hasJournalChanged(current)
  if (changes.length === 0) return

  for (const { dateKey, text } of changes) {
    if (!_uid) break
    try {
      if (text !== null) {
        await saveJournalEntryToSubcollection(_uid, dateKey, text)
      } else {
        await deleteJournalEntryFromSubcollection(_uid, dateKey)
      }
    } catch (e) {
      console.error(`[sync] journal change error for ${dateKey}:`, e)
    }
  }
  if (_uid) _prevJournal = { ...current }
}

function debouncedSyncPlannerState(): void {
  if (_debounceTimer) clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null
    syncPlannerState()
  }, 2000)
}

export function initSync(uid: string): void {
  if (_uid === uid && _unsubscribe) return
  destroySync()

  _uid = uid
  _prevJournal = { ...usePlannerStore.getState().journal }

  _unsubscribe = usePlannerStore.subscribe(() => {
    const current = usePlannerStore.getState().journal
    if (hasJournalChanged(current).length > 0) {
      flushJournalChanges()
    }
    debouncedSyncPlannerState()
  })
}

export async function syncNow(): Promise<void> {
  await flushJournalChanges()
  await syncPlannerState()
}

export function destroySync(): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }
  if (_unsubscribe) {
    _unsubscribe()
    _unsubscribe = null
  }
  _uid = null
  _prevJournal = {}
}
