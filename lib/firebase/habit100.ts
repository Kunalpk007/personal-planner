import { doc, getDoc, setDoc, getDocs, collection, writeBatch, serverTimestamp } from 'firebase/firestore'
import { getClientDb } from './client'
import type { Habit100Meta, Habit100Day, Habit100Week } from '@/store/habit100/types'

/** Firestore access for the Consistency Tracker — mirrors the Journal
 *  subcollection pattern exactly (one small doc per day, not folded into
 *  the main planner/state doc), so this feature's writes never bloat or
 *  trigger a rewrite of the unrelated main-app sync document. See
 *  lib/sync/sync.ts's journal handling + lib/habit100/sync.ts, which
 *  mirrors it for this feature. */

function metaRef(uid: string) {
  return doc(getClientDb(), 'users', uid, 'habit100', 'meta')
}
function dayRef(uid: string, dateKey: string) {
  return doc(getClientDb(), 'users', uid, 'habit100days', dateKey)
}
function dayCollectionRef(uid: string) {
  return collection(getClientDb(), 'users', uid, 'habit100days')
}
function weekRef(uid: string, weekIndex: number) {
  return doc(getClientDb(), 'users', uid, 'habit100weeks', String(weekIndex))
}
function weekCollectionRef(uid: string) {
  return collection(getClientDb(), 'users', uid, 'habit100weeks')
}

function sanitize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export async function loadHabit100Meta(uid: string): Promise<Habit100Meta | null> {
  const snap = await getDoc(metaRef(uid))
  return snap.exists() ? (snap.data() as Habit100Meta) : null
}

export async function saveHabit100Meta(uid: string, meta: Habit100Meta): Promise<void> {
  await setDoc(metaRef(uid), { ...sanitize(meta), _syncedAt: serverTimestamp() })
}

export async function loadHabit100Days(uid: string): Promise<Habit100Day[]> {
  const snap = await getDocs(dayCollectionRef(uid))
  return snap.docs.map(d => d.data() as Habit100Day)
}

export async function saveHabit100Day(uid: string, day: Habit100Day): Promise<void> {
  await setDoc(dayRef(uid, day.date), { ...sanitize(day), _syncedAt: serverTimestamp() })
}

export async function loadHabit100Weeks(uid: string): Promise<Habit100Week[]> {
  const snap = await getDocs(weekCollectionRef(uid))
  return snap.docs.map(d => d.data() as Habit100Week)
}

export async function saveHabit100Week(uid: string, week: Habit100Week): Promise<void> {
  await setDoc(weekRef(uid, week.weekIndex), { ...sanitize(week), _syncedAt: serverTimestamp() })
}

/** Deletes the entire Consistency Tracker record — used when starting a
 *  fresh 100-day cycle after finishing (or abandoning) the current one. */
export async function deleteAllHabit100Data(uid: string): Promise<void> {
  const [daySnap, weekSnap] = await Promise.all([getDocs(dayCollectionRef(uid)), getDocs(weekCollectionRef(uid))])
  const batch = writeBatch(getClientDb())
  daySnap.forEach(d => batch.delete(d.ref))
  weekSnap.forEach(d => batch.delete(d.ref))
  batch.delete(metaRef(uid))
  await batch.commit()
}
