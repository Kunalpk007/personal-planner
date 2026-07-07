import { doc, getDoc, setDoc, getDocs, deleteDoc, collection, serverTimestamp, writeBatch } from 'firebase/firestore'
import { getClientDb } from './client'

const JOURNAL_COLLECTION = 'journal'

function plannerRef(uid: string) {
  return doc(getClientDb(), 'users', uid, 'planner', 'state')
}

function journalRef(uid: string, dateKey: string) {
  return doc(getClientDb(), 'users', uid, JOURNAL_COLLECTION, dateKey)
}

function journalCollectionRef(uid: string) {
  return collection(getClientDb(), 'users', uid, JOURNAL_COLLECTION)
}

function sanitize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export async function loadFromFirestore(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(plannerRef(uid))
  if (!snap.exists()) return null
  const data = snap.data()
  delete data['_syncedAt']
  delete data['journal']
  return data
}

export async function saveToFirestore(uid: string, state: Record<string, unknown>): Promise<void> {
  const { journal: _j, ...rest } = state as { journal?: unknown; [k: string]: unknown }
  await setDoc(plannerRef(uid), {
    ...sanitize(rest),
    _syncedAt: serverTimestamp(),
  })
}

export async function loadJournalEntries(uid: string): Promise<Record<string, string>> {
  const snap = await getDocs(journalCollectionRef(uid))
  const entries: Record<string, string> = {}
  snap.forEach(d => {
    const data = d.data()
    if (data.text) entries[d.id] = data.text
  })
  return entries
}

export async function saveJournalEntryToSubcollection(uid: string, dateKey: string, text: string): Promise<void> {
  await setDoc(journalRef(uid, dateKey), {
    text,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteJournalEntryFromSubcollection(uid: string, dateKey: string): Promise<void> {
  await deleteDoc(journalRef(uid, dateKey))
}

/** Delete all user data from Firestore — planner doc + all journal entries. */
export async function deleteAllUserData(uid: string): Promise<void> {
  // Delete journal subcollection
  const journalSnap = await getDocs(journalCollectionRef(uid))
  const batch = writeBatch(getClientDb())
  journalSnap.forEach(d => batch.delete(d.ref))
  await batch.commit()
  // Delete planner doc
  await deleteDoc(plannerRef(uid))
}

export async function migrateJournalFromState(uid: string, state: Record<string, unknown>): Promise<void> {
  const journal = state['journal'] as Record<string, string> | undefined
  if (!journal || Object.keys(journal).length === 0) return

  const batch = writeBatch(getClientDb())
  for (const [dateKey, text] of Object.entries(journal)) {
    batch.set(journalRef(uid, dateKey), { text, updatedAt: serverTimestamp() })
  }
  await batch.commit()
}
