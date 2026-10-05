'use client'
import { useEffect, useState } from 'react'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { initHabit100Sync, loadHabit100Cloud } from '@/lib/habit100/sync'
import { readUidFromCookieSync } from '@/store/userScope'

/** Lazily initializes the Consistency Tracker's cloud sync — only called
 *  from the /habit100 route pages themselves (never globally), since most
 *  sessions never open the tracker and shouldn't pay for its Firestore
 *  listeners/loads. Local (persisted) state is already available
 *  immediately via useHabit100Store's own hydration, so the Dashboard's
 *  preview tile needs none of this. */
export function useHabit100Bootstrap() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const uid = readUidFromCookieSync()
    const store = useHabit100Store.getState()
    store.init(uid)
    if (!uid) { setReady(true); return }

    let cancelled = false
    initHabit100Sync(uid)
    loadHabit100Cloud(uid).finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [])

  return { ready }
}
