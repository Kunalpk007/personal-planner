import { doc, getDoc, setDoc, getDocs, deleteDoc, collection, serverTimestamp, writeBatch } from 'firebase/firestore'
import { getClientDb } from './client'

const JOURNAL_COLLECTION = 'journal'

function plannerRef(uid: string) {
  return doc(getClientDb(), 'users', uid, 'planner', 'state')
}

function journalRef(uid: string, dateKey: string) {
  return doc(getClientDb(), 'users', uid, JOURNAL_COLLECTION, dateKey)
}

/** A small, friends-readable profile (name + rankXP) so friend tiles can show
 *  each other's XP without exposing the private planner doc. Lives at
 *  users/{uid}/public/profile; the security rule allows any signed-in user to
 *  read it, only the owner to write. */
function publicProfileRef(uid: string) {
  return doc(getClientDb(), 'users', uid, 'public', 'profile')
}

export async function writePublicProfile(uid: string, displayName: string, rankXP: number): Promise<void> {
  await setDoc(publicProfileRef(uid), { displayName, rankXP, updatedAt: serverTimestamp() })
}

export async function getPublicProfile(uid: string): Promise<{ displayName?: string; rankXP?: number } | null> {
  try {
    const snap = await getDoc(publicProfileRef(uid))
    return snap.exists() ? (snap.data() as { displayName?: string; rankXP?: number }) : null
  } catch {
    return null
  }
}

/** Top-level roster the admin dashboard lists to see all users + basic stats.
 *  Each user maintains only their own row (uid == doc id). */
export async function writeUserIndex(uid: string, displayName: string, email: string, rankXP: number, streak: number): Promise<void> {
  await setDoc(doc(getClientDb(), 'userIndex', uid), {
    displayName, email, rankXP, streak, updatedAt: serverTimestamp(),
  }, { merge: true })
}

// ── Bug reports / complaints ──────────────────────────────────────────────

export interface BugReport {
  id: string
  uid: string
  email: string
  category: string
  message: string
  imageUrl?: string
  createdAt?: unknown
  status?: string
}

export async function submitBugReport(uid: string, email: string, category: string, message: string, imageUrl?: string): Promise<void> {
  const ref = doc(collection(getClientDb(), 'bugReports'))
  await setDoc(ref, { id: ref.id, uid, email, category, message, status: 'open', createdAt: serverTimestamp(), ...(imageUrl ? { imageUrl } : {}) })
}

// ── Admin dashboard reads (gated to the admin uid by security rules) ───────

export async function listUserIndex(): Promise<Array<{ id: string; displayName?: string; email?: string; rankXP?: number; streak?: number }>> {
  const snap = await getDocs(collection(getClientDb(), 'userIndex'))
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
}

export async function listBugReports(): Promise<BugReport[]> {
  const snap = await getDocs(collection(getClientDb(), 'bugReports'))
  return snap.docs.map(d => d.data() as BugReport)
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
