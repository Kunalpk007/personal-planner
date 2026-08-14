'use client'
import { useState } from 'react'
import { usePlannerStore } from '@/store'

/** A passive reminder that today's Weekly Review will be silently skipped if
 *  the day never gets submitted — the End-of-Day Ritual (EndOfDayRitual.tsx)
 *  only fires as part of Submit My Day, so a Sunday that passes without a
 *  submit means the Weekly Review never shows at all, with nothing bringing
 *  it back. Real push notifications aren't available (no server-side cron on
 *  Firebase's free Spark plan — see project.md), so this is the cheap,
 *  in-app alternative: shown only Sunday evening (after 6pm — a fixed local
 *  hour, same convention as the existing "auto-neutral mood after 12pm"
 *  overnight check) and only if today hasn't been submitted yet.
 *
 *  Purely informational — dismiss is local/session-only, no persisted state.
 *  A reload bringing it back is correct here: it's a passive banner, not a
 *  blocking modal, and the whole point is "don't let this get missed." */
export function SundayReviewNudge({ today }: { today: string }) {
  const isSubmitted = usePlannerStore(s => !!s.submittedDays[today])
  const [dismissed, setDismissed] = useState(false)

  const isSunday  = new Date(`${today}T12:00:00`).getDay() === 0
  const isEvening = new Date().getHours() >= 18

  if (!isSunday || !isEvening || isSubmitted || dismissed) return null

  return (
    <div className="bg-[var(--blue-bg)] border border-[var(--blue)] rounded-[10px] p-3 mb-3.5 text-xs text-[var(--blue)] flex justify-between items-center gap-2">
      <span>📆 It&apos;s Sunday evening — submit your day to get your Weekly Review before the week resets.</span>
      <button onClick={() => setDismissed(true)} className="btn-icon flex-shrink-0">×</button>
    </div>
  )
}
