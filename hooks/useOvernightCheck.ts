'use client'
import { useEffect } from 'react'
import { usePlannerStore }   from '@/store'
import { runOvernightLogic } from '@/lib/engine/streak'
import { applyRankDecay }    from '@/lib/engine/decay'
import { useDayKey }         from './useDayKey'

/**
 * Runs once on app mount (per day):
 * 1. Apply rank XP decay
 * 2. Run overnight auto-logic (rest day protects incomplete days)
 * 3. Inject recurring tasks for today
 * 4. Process expired carries
 * 5. Auto-default mood to neutral after 12pm
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

    // 1. Rank decay — applied first so the overnight pass (which now folds
    //    any overflow XP straight into rankXP) reads a post-decay value and
    //    doesn't accidentally clobber the decay.
    const decayedXP = applyRankDecay(
      store.rankXP,
      store.lastActiveDayForDecay,
      today,
      !!store.pausedStreak
    )
    if (decayedXP !== store.rankXP) store.applyOvernightPatch({ rankXP: decayedXP })

    // 2. Overnight logic — read fresh state so it sees the decayed rankXP.
    const state = usePlannerStore.getState()
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
  }, [today])
}
