'use client'
import { useEffect } from 'react'
import { usePlannerStore }   from '@/store'
import { runOvernightLogic } from '@/lib/engine/streak'
import { applyRankDecay }    from '@/lib/engine/decay'
import { useDayKey }         from './useDayKey'

/**
 * Runs once on app mount:
 * 1. Apply rank XP decay
 * 2. Run overnight auto-logic (rest → freeze → break)
 * 3. Inject recurring tasks for today
 * 4. Process expired carries
 * 5. Auto-default mood to neutral after 12pm
 */
export function useOvernightCheck() {
  const { today } = useDayKey()
  const store     = usePlannerStore()

  useEffect(() => {
    const state = usePlannerStore.getState()

    // 1. Rank decay
    const newXP = applyRankDecay(
      state.rankXP,
      state.lastActiveDayForDecay,
      today,
      !!state.pausedStreak
    )
    if (newXP !== state.rankXP) store.applyOvernightPatch({ rankXP: newXP })

    // 2. Overnight logic
    const patch = runOvernightLogic(state, today)
    store.applyOvernightPatch(patch)

    // 3. Inject recurring
    store.injectRecurring(today)

    // 4. Expire carries
    store.processExpiredCarries()

    // 5. Auto-neutral mood after 12pm
    const now = new Date()
    if (now.getHours() >= 12 && !state.mood[today]) {
      store.setMood(today, 'neutral')
    }

    // 6. Mark app first used
    store.setAppFirstUsed(today)
    store.markEngagementDay(today)

    // 7. Check paused streak expiry
    store.checkPausedExpiry()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today])
}
