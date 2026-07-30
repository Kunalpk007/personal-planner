'use client'
import { useEffect } from 'react'
import { usePlannerStore }   from '@/store'
import { runOvernightLogic } from '@/lib/engine/streak'
import { showToast }         from '@/ui/Toast'
import { useDayKey }         from './useDayKey'

/**
 * Runs once on app mount (per day):
 * 1. Run overnight auto-logic (rest day protects incomplete days, applies
 *    the flat XP-penalty system per missed day — see lib/engine/xpPenalty.ts)
 * 2. Inject recurring tasks for today
 * 3. Process expired carries
 * 4. Auto-default mood to neutral after 12pm
 * 5. Award the "you showed up" wallet bonus on the first open of the day
 *
 * Reads the store via getState() rather than subscribing to it — this hook
 * lives in the always-mounted AppShell, so a full-store subscription here
 * would re-render the entire shell on every single mutation (task toggles,
 * keystrokes, etc). Zustand action references are stable, so getState() is
 * all that's needed.
 */
export function useOvernightCheck() {
  const { today } = useDayKey()

  useEffect(() => {
    const store = usePlannerStore.getState()

    // 1. Overnight logic — rest-day protection / XP penalties for missed days.
    const patch = runOvernightLogic(store, today)
    store.applyOvernightPatch(patch)

    // 2. Inject recurring
    store.injectRecurring(today)

    // 3. Expire carries
    store.processExpiredCarries()

    // 4. Auto-neutral mood after 12pm
    const now = new Date()
    if (now.getHours() >= 12 && !store.mood[today]) {
      store.setMood(today, 'neutral')
    }

    // 5. "You showed up" bonus — wallet-only, once per day (the action
    //    itself guards against re-claiming via engagementDays).
    const bonus = store.claimShowedUpBonus(today)
    if (bonus) showToast(`🎉 You showed up! +${bonus} 🪙`)

    // 6. Mark app first used
    store.setAppFirstUsed(today)
    store.markEngagementDay(today)

    // 7. Check paused streak expiry
    store.checkPausedExpiry()
  }, [today])
}
