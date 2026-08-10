'use client'
import { useEffect, useMemo, useState } from 'react'
import { usePlannerStore } from '@/store'
import { Modal }           from '@/ui/Modal'
import { showToast }       from '@/ui/Toast'
import { fireConfetti }    from '@/ui/Confetti'
import { calcPts, todayEarned, getMinPts } from '@/lib/engine/scoring'
import { goalPtsEarnedOn } from '@/lib/engine/goals'
import { formatDateShort } from '@/lib/engine/cutoff'
import { getFixableDays }  from '@/lib/engine/retroFix'

/** Two-step "fix a day the overnight logic auto-resolved" flow.
 *
 *  Replaces the old always-visible Dashboard banner/accordion — see
 *  BUGS.md/project.md for the full history of why this exists: a day you
 *  genuinely finished but forgot to check off (or genuinely couldn't open
 *  the app for — a long day, an emergency) used to get permanently
 *  recorded as a Rest Day with no way back. Step 1 is a short confirm
 *  modal (with an honesty reminder — this is for real misses, not
 *  padding a streak). Step 2 is a toggle-only checklist of that day's
 *  existing tasks — no adding new ones. Saving always persists whatever
 *  was toggled; if it now clears the day's target, it also undoes the
 *  Rest Day/miss verdict and restores the streak, refunding the XP/reward
 *  points that were deducted (see submitRetroFix in tasks.slice.ts).
 *
 *  The fixable window is a fixed rule — 12:00 PM the day after — not a
 *  Settings-configurable option (see lib/engine/retroFix.ts). Because of
 *  that rule, there is only ever at most one fixable day at a time, always
 *  "yesterday" relative to whenever this is checked. */
export function RetroFixPanel({ today }: { today: string }) {
  const history         = usePlannerStore(s => s.history)
  const allTasks         = usePlannerStore(s => s.tasks)
  const retroFixedDays   = usePlannerStore(s => s.retroFixedDays)
  const cfg               = usePlannerStore(s => s.cfg)
  const mood               = usePlannerStore(s => s.mood)
  const goals               = usePlannerStore(s => s.goals)
  const streak               = usePlannerStore(s => s.streak)
  const toggleTaskRetro   = usePlannerStore(s => s.toggleTaskRetro)
  const submitRetroFix    = usePlannerStore(s => s.submitRetroFix)

  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<'confirm' | 'checklist' | null>(null)

  const fixableDays = useMemo(
    () => getFixableDays({ history, tasks: allTasks, retroFixedDays, cfg }, today).filter(d => !dismissed.has(d)),
    [history, allTasks, retroFixedDays, cfg, today, dismissed]
  )
  const date = fixableDays[0] ?? null

  // Auto-opens the confirm step the moment a fixable day shows up — mirrors
  // the PWA install reminder's auto-popup pattern elsewhere in this app.
  // Only re-fires when `date` itself changes (a new day becomes fixable, or
  // the current one stops being fixable), so it never fights the user's own
  // navigation between step 1/2, and dismissing (which removes `date` from
  // fixableDays) won't immediately reopen itself.
  useEffect(() => {
    if (date) setStep('confirm')
  }, [date])

  if (!date) return null

  const entry    = history.find(h => h.date === date)
  const dayTasks = allTasks.filter(t => t.date === date)
  const doneTasks = dayTasks.filter(t => t.done)
  const minPts    = getMinPts(date, cfg)
  const earned    = todayEarned(doneTasks, mood[date], cfg, goalPtsEarnedOn(goals, date))
  const targetMet = dayTasks.length > 0 && earned >= minPts

  function close() {
    setStep(null)
    setDismissed(prev => new Set(prev).add(date!))
  }

  function save() {
    const result = submitRetroFix(date!)
    if (!result.ok) return
    setStep(null)
    if (result.upgraded) {
      fireConfetti()
      showToast(`🔥 Fixed! ${formatDateShort(date!)} now counts as a full day — streak is ${result.newStreak}.`)
    } else {
      showToast(`${formatDateShort(date!)}'s changes saved.`)
    }
  }

  return (
    <>
      <Modal open={step === 'confirm'} onClose={close} variant="vx" maxWidth="max-w-sm">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
               style={{ background: 'linear-gradient(150deg, rgba(52,211,153,0.22), rgba(52,211,153,0.08))', border: '1px solid rgba(52,211,153,0.25)' }}>
            📝
          </div>
          <div>
            <h3 className="text-[16px] font-extrabold tracking-tight mb-0.5">Fix Yesterday&apos;s Tasks?</h3>
            <p className="text-[12px] text-[var(--vx-fg-3)]">
              {formatDateShort(date)} got auto-marked as a {entry?.rest ? 'Rest Day' : 'missed day'}. Fixable until 12 PM today.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4"
             style={{ background: 'rgba(250,199,117,0.08)', border: '1px solid rgba(250,199,117,0.22)' }}>
          <span className="text-[14px] flex-shrink-0">🤝</span>
          <span className="text-[12px] leading-snug text-[var(--vx-fg-2)]">Be honest — this is for real misses, not padding your streak.</span>
        </div>
        <div className="flex gap-2.5">
          <button onClick={close} className="vx-btn vx-btn-ghost" style={{ flex: 1, padding: '0.7rem' }}>Cancel</button>
          <button onClick={() => setStep('checklist')} className="vx-btn vx-btn-primary" style={{ flex: 1, padding: '0.7rem' }}>Fix Tasks</button>
        </div>
      </Modal>

      <Modal open={step === 'checklist'} onClose={close} title={`${formatDateShort(date)} — Your Tasks`} variant="vx" maxWidth="max-w-sm">
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl mb-3.5 text-[12.5px]"
             style={{ background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)' }}>
          <span className="text-[var(--vx-fg-2)]">{doneTasks.length} of {dayTasks.length} done</span>
          <span className="font-bold" style={{ color: targetMet ? 'var(--color-accent)' : 'var(--vx-fg-3)' }}>
            {earned} / {minPts} pts {targetMet ? '✓' : ''}
          </span>
        </div>

        <div className="flex flex-col gap-2 mb-3.5 max-h-[320px] overflow-y-auto">
          {dayTasks.map(t => (
            <div key={t.id} className="flex items-center gap-2.5 p-2.5 rounded-xl"
                 style={t.done
                   ? { background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.22)' }
                   : { background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)' }}>
              <button
                onClick={() => toggleTaskRetro(t.id)}
                className="w-[22px] h-[22px] rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center text-[12px] transition-all"
                style={t.done
                  ? { background: 'var(--color-accent)', borderColor: 'var(--color-accent)', color: '#06281c' }
                  : { borderColor: 'rgba(255,255,255,0.25)', color: 'transparent' }}
              >
                ✓
              </button>
              <span className={`text-[13.5px] flex-1 ${t.done ? 'line-through text-[var(--vx-fg-3)]' : ''}`}>{t.title}</span>
              <span className="text-[11.5px] font-bold" style={{ color: t.done ? 'var(--color-accent)' : 'var(--vx-fg-4)' }}>+{calcPts(t)}</span>
            </div>
          ))}
        </div>

        {targetMet && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3.5"
               style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
            <span className="text-[14px] flex-shrink-0">🔥</span>
            <span className="text-[12px] leading-snug text-[var(--vx-fg-2)]">
              Target met — saving restores your streak to <b style={{ color: 'var(--color-accent)' }}>{streak + 1}</b> and refunds the lost XP/points.
            </span>
          </div>
        )}

        <div className="flex gap-2.5">
          <button onClick={close} className="vx-btn vx-btn-ghost" style={{ flex: 1, padding: '0.7rem' }}>Cancel</button>
          <button onClick={save} className="vx-btn vx-btn-primary" style={{ flex: 1, padding: '0.7rem' }}>Save Changes</button>
        </div>
      </Modal>
    </>
  )
}
