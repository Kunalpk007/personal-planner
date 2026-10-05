'use client'
import { useMemo, useState } from 'react'
import { Modal } from '@/ui/Modal'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { DayLogForm } from './DayLogForm'
import { formatDateShort, getNextDayKey, getPrevDayKey } from '@/lib/engine/cutoff'

/** Auto-opens one modal per unresolved past day, oldest first — the ONLY
 *  way any day's data is ever edited after the fact (History is view-only).
 *  "Not now" dismisses the current one for this session with no penalty —
 *  it reappears next time Home loads. Only the explicit "Confirm & lock"
 *  action (behind a warning) permanently locks a day; nothing else does. */
export function CatchUpQueue({ today }: { today: string }) {
  const meta = useHabit100Store(s => s.meta)
  const days = useHabit100Store(s => s.days)
  const lockDay = useHabit100Store(s => s.lockDay)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)

  const pendingDates = useMemo(() => {
    if (!meta) return []
    const out: string[] = []
    const end = getPrevDayKey(today)
    for (let d = meta.startDate; d <= end; d = getNextDayKey(d)) {
      if (!days[d]?.locked && !dismissed.has(d)) out.push(d)
    }
    return out
  }, [meta, days, today, dismissed])

  const date = pendingDates[0]
  if (!meta || !date) return null

  function dismiss() {
    setDismissed(prev => new Set(prev).add(date))
    setConfirming(false)
  }
  function confirmLock() {
    lockDay(date)
    setConfirming(false)
  }

  return (
    <Modal open onClose={dismiss} title={`Catch up — ${formatDateShort(date)}`} variant="vx" maxWidth="max-w-sm">
      {!confirming ? (
        <>
          <p className="text-[12px] mb-3" style={{ color: 'var(--vx-fg-3)' }}>
            Looks like {formatDateShort(date)} didn't get logged. Fill in whatever you remember — once you
            confirm, this day locks for good.
          </p>
          <DayLogForm key={date} date={date} />
          <div className="flex gap-2.5 mt-4">
            <button onClick={dismiss} className="vx-btn vx-btn-ghost" style={{ flex: 1, padding: '0.7rem' }}>Not now</button>
            <button onClick={() => setConfirming(true)} className="vx-btn vx-btn-primary" style={{ flex: 1, padding: '0.7rem' }}>Confirm &amp; lock</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] mb-4" style={{ color: 'var(--vx-fg-2)' }}>
            No further changes will be possible for {formatDateShort(date)} after this. Lock it in?
          </p>
          <div className="flex gap-2.5">
            <button onClick={() => setConfirming(false)} className="vx-btn vx-btn-ghost" style={{ flex: 1, padding: '0.7rem' }}>Keep editing</button>
            <button onClick={confirmLock} className="vx-btn vx-btn-primary" style={{ flex: 1, padding: '0.7rem' }}>Lock it</button>
          </div>
        </>
      )}
    </Modal>
  )
}
