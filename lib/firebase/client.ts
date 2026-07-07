import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth,      type Auth }      from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Only initialize in the browser — during SSR / build-time static generation
// the NEXT_PUBLIC env vars may be empty, and Firebase throws auth/invalid-api-key.
// All callers are 'use client' components that only access these in useEffect,
// so the lazy path is safe.
let _auth: Auth | null      = null
let _db:   Firestore | null = null

function getApp_() {
  if (typeof window === 'undefined') throw new Error('Firebase client must not be used on the server')
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

export function getClientAuth(): Auth {
  if (!_auth) _auth = getAuth(getApp_())
  return _auth
}

export function getClientDb(): Firestore {
  if (!_db) _db = getFirestore(getApp_())
  return _db
}

/** Wait for Firebase Auth to finish restoring session from persistence (IndexedDB). */
export async function waitForAuth(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const auth = getClientAuth()
    await auth.authStateReady()
    return auth.currentUser !== null
  } catch (e) {
    console.error('waitForAuth error:', e)
    return false
  }
}

// Convenience aliases used by auth pages — same lazy init
export const clientAuth = { get instance() { return getClientAuth() } }
export const clientDb   = { get instance() { return getClientDb() } }
