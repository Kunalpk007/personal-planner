/**
 * Firestore persistence layer for planner state.
 *
 * Data model:
 *   /users/{uid}/planner/state  ← full AppStateData snapshot
 *
 * This mirrors the localStorage key:
 *   localStorage["kunals_planner_v2:{uid}"]
 *
 * Both use the Firebase UID as the namespace, making the migration
 * path trivial: swap the read/write calls below with localStorage equivalents.
 *
 * Firestore free tier: 50K reads / 20K writes / day — plenty for personal use.
 * Document size limit: 1MB. Extremely long journal entries may approach this;
 * split the journal into a subcollection if needed in future.
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getClientDb } from './client'

function plannerRef(uid: string) {
  return doc(getClientDb(), 'users', uid, 'planner', 'state')
}

/** Strip undefined values — Firestore rejects them. */
function sanitize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export async function loadFromFirestore(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(plannerRef(uid))
  if (!snap.exists()) return null
  const data = snap.data()
  // Remove internal Firestore metadata fields before passing to Zustand
  delete data['_syncedAt']
  return data
}

export async function saveToFirestore(uid: string, state: Record<string, unknown>): Promise<void> {
  await setDoc(plannerRef(uid), {
    ...sanitize(state),
    _syncedAt: serverTimestamp(),
  })
}
