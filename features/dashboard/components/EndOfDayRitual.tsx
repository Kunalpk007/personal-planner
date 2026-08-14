'use client'
import { useEffect, useState } from 'react'
import { usePlannerStore } from '@/store'
import { Modal } from '@/ui/Modal'
import { showToast } from '@/ui/Toast'
import { DISTRACTION_TAGS, type DistractionTag, type FocusCheckin, type SleepQuality, type LifestyleCheckin } from '@/store/types'
import { getNextDayKey, getWeekMonday, formatDateShort } from '@/lib/engine/cutoff'
import { computeWeekRecap } from '@/lib/engine/weeklyReview'

const FOCUS_SCALE: Array<{ score: FocusCheckin['score']; emoji: string; label: string }> = [
  { score: 1, emoji: '😵‍💫', label: 'Scattered' },
  { score: 2, emoji: '😕', label: 'Distracted' },
  { score: 3, emoji: '😐', label: 'Okay' },
  { score: 4, emoji: '🙂', label: 'Focused' },
  { score: 5, emoji: '🔥', label: 'Deep focus' },
]

const SLEEP_SCALE: Array<{ value: SleepQuality; emoji: string; label: string }> = [
  { value: 'poor',  emoji: '😩', label: 'Poor' },
  { value: 'ok',    emoji: '😐', label: 'OK' },
  { value: 'great', emoji: '😴', label: 'Great' },
]

const STRESS_SCALE: Array<{ level: LifestyleCheckin['stress']; emoji: string; label: string }> = [
  { level: 1, emoji: '😌', label: 'Calm' },
  { level: 2, emoji: '🙂', label: 'Fine' },
  { level: 3, emoji: '😐', label: 'Some' },
  { level: 4, emoji: '😖', label: 'Stressed' },
  { level: 5, emoji: '🥵', label: 'Overwhelmed' },
]

type Step = 'focus' | 'lifestyle' | 'top3' | 'weekly'

/** Appended right after EOD mood on the Submit My Day flow — four optional,
 *  non-scored rituals designed to answer "am I wasting time" and to close
 *  the loop on planning: a same-day focus/attention self-rating, the daily
 *  sleep/movement/stress lifestyle check-in (see LifestyleCheckin —
 *  originally proposed split across AM/PM touchpoints in
 *  lifestyle-questions-analysis.md, folded into this single evening flow
 *  instead per explicit user decision, to avoid a second daily interrupt),
 *  up to 3 priorities picked for tomorrow, and (Sundays only, this app's
 *  week-end day since weeks are Monday-start) a Weekly Review. See
 *  project.md's "Time/attention tracking + weekly rituals" design — this is
 *  the real implementation of what was previously only a prototype mockup.
 *
 *  Every step is skippable — none of this gates or blocks the day already
 *  being submitted by the time this shows. `active` flips true right after
 *  handleSubmit(); `onDone` fires once the sequence (focus → lifestyle →
 *  top3 → maybe weekly) completes or is skipped through, so the caller can
 *  resume its own post-submit flow (celebration / evening quote). */
export function EndOfDayRitual({ today, active, onDone }: { today: string; active: boolean; onDone: () => void }) {
  const setFocusCheckin   = usePlannerStore(s => s.setFocusCheckin)
  const setLifestyleCheckin = usePlannerStore(s => s.setLifestyleCheckin)
  const setTomorrowTop3   = usePlannerStore(s => s.setTomorrowTop3)
  const setWeeklyReviewDone = usePlannerStore(s => s.setWeeklyReviewDone)
  const addTask             = usePlannerStore(s => s.addTask)
  const zones               = usePlannerStore(s => s.zones)
  const history            = usePlannerStore(s => s.history)
  const goals               = usePlannerStore(s => s.goals)
  const rewardRedemptions   = usePlannerStore(s => s.rewardRedemptions)
  const lifestyleCheckins   = usePlannerStore(s => s.lifestyleCheckins)

  const isSunday = new Date(`${today}T12:00:00`).getDay() === 0
  const weekMonday = getWeekMonday(today)

  const [step, setStep] = useState<Step | null>(null)
  const [focusScore, setFocusScore] = useState<FocusCheckin['score'] | null>(null)
  const [distractions, setDistractions] = useState<DistractionTag[]>([])
  const [sleep, setSleep] = useState<SleepQuality | null>(null)
  const [moved, setMoved] = useState<boolean | null>(null)
  const [stress, setStress] = useState<LifestyleCheckin['stress'] | null>(null)
  const [top3, setTop3] = useState<[string, string, string]>(['', '', ''])
  const [whatWorked, setWhatWorked] = useState('')
  const [whatDidnt, setWhatDidnt] = useState('')
  const [oneChange, setOneChange] = useState('')

  // Reset local step state fresh each time the ritual is (re)activated.
  useEffect(() => {
    if (active) {
      setStep('focus')
      setFocusScore(null)
      setDistractions([])
      setSleep(null)
      setMoved(null)
      setStress(null)
      setTop3(['', '', ''])
      setWhatWorked('')
      setWhatDidnt('')
      setOneChange('')
    }
  }, [active])

  function toggleDistraction(tag: DistractionTag) {
    setDistractions(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function finishFocus(skip: boolean) {
    if (!skip && focusScore) setFocusCheckin(today, focusScore, distractions)
    setStep('lifestyle')
  }

  function finishLifestyle(skip: boolean) {
    if (!skip && sleep && moved !== null && stress) setLifestyleCheckin(today, sleep, moved, stress)
    setStep('top3')
  }

  function finishTop3(skip: boolean) {
    if (!skip) {
      const tomorrow = getNextDayKey(today)
      const filled = top3.map(x => x.trim()).filter(x => x.length > 0)
      if (filled.length > 0) {
        const zoneId = zones[0]?.id ?? ''
        for (const title of filled) {
          addTask({ title, note: '', zone: zoneId, priority: 'med', slot: '', deadline: null, date: tomorrow, level: '', isSpecial: false, specialPts: 0 })
        }
        setTomorrowTop3(tomorrow, filled)
      }
    }
    if (isSunday) {
      setStep('weekly')
    } else {
      setStep(null)
      onDone()
    }
  }

  function finishWeekly(skip: boolean) {
    if (!skip && (whatWorked.trim() || whatDidnt.trim() || oneChange.trim())) {
      setWeeklyReviewDone(weekMonday, { whatWorked: whatWorked.trim(), whatDidnt: whatDidnt.trim(), oneChange: oneChange.trim() })
      showToast('📆 Weekly Review saved.')
    }
    setStep(null)
    onDone()
  }

  const recap = computeWeekRecap(weekMonday, history, goals, rewardRedemptions, lifestyleCheckins)

  return (
    <>
      {/* Step 1 — Focus/attention check-in (non-scored, see FocusCheckin type). */}
      <Modal open={step === 'focus'} onClose={() => finishFocus(true)} title="How focused was today?" variant="vx" maxWidth="max-w-sm">
        <p className="text-[12px] text-[var(--vx-fg-3)] mb-3.5">
          Not scored — just a private signal for your Weekly Review. Skip any time.
        </p>
        <div className="flex justify-between gap-1.5 mb-4">
          {FOCUS_SCALE.map(f => (
            <button
              key={f.score}
              onClick={() => setFocusScore(f.score)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-medium transition-all"
              style={focusScore === f.score
                ? { background: 'var(--color-accent-dim)', border: '1.5px solid var(--color-accent)', color: 'var(--vx-fg-1)' }
                : { background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)', color: 'var(--vx-fg-3)' }}
            >
              <span className="text-[18px]">{f.emoji}</span>
              {f.label}
            </button>
          ))}
        </div>
        {focusScore !== null && (
          <div className="mb-4">
            <div className="text-[11.5px] text-[var(--vx-fg-3)] mb-2">What pulled your focus today? (optional)</div>
            <div className="flex flex-wrap gap-1.5">
              {DISTRACTION_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleDistraction(tag)}
                  className="vx-chip"
                  data-tone={distractions.includes(tag) ? 'amber' : 'neutral'}
                  style={{ cursor: 'pointer', opacity: distractions.includes(tag) ? 1 : 0.7 }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2.5">
          <button onClick={() => finishFocus(true)} className="vx-btn vx-btn-ghost" style={{ flex: 1, padding: '0.7rem' }}>Skip</button>
          <button onClick={() => finishFocus(false)} disabled={focusScore === null} className="vx-btn vx-btn-primary" style={{ flex: 1, padding: '0.7rem', opacity: focusScore === null ? 0.5 : 1 }}>Save</button>
        </div>
      </Modal>

      {/* Step 2 — Lifestyle check-in: sleep quality, movement, stress (see
          LifestyleCheckin). All three single-tap, no free text — feeds the
          Weekly Review's trend tiles + correlation callout below. */}
      <Modal open={step === 'lifestyle'} onClose={() => finishLifestyle(true)} title="How was your day, really?" variant="vx" maxWidth="max-w-sm">
        <p className="text-[12px] text-[var(--vx-fg-3)] mb-3.5">
          Not scored — just three quick taps for your Weekly Review. Skip any time.
        </p>
        <div className="mb-3.5">
          <div className="text-[11.5px] text-[var(--vx-fg-3)] mb-2">How did you sleep last night?</div>
          <div className="flex justify-between gap-1.5">
            {SLEEP_SCALE.map(o => (
              <button
                key={o.value}
                onClick={() => setSleep(o.value)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-medium transition-all"
                style={sleep === o.value
                  ? { background: 'var(--color-accent-dim)', border: '1.5px solid var(--color-accent)', color: 'var(--vx-fg-1)' }
                  : { background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)', color: 'var(--vx-fg-3)' }}
              >
                <span className="text-[18px]">{o.emoji}</span>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3.5">
          <div className="text-[11.5px] text-[var(--vx-fg-3)] mb-2">Did you move your body today?</div>
          <div className="flex gap-1.5">
            {[{ value: true, label: '🏃 Yes' }, { value: false, label: '🛋️ No' }].map(o => (
              <button
                key={String(o.value)}
                onClick={() => setMoved(o.value)}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-medium transition-all"
                style={moved === o.value
                  ? { background: 'var(--color-accent-dim)', border: '1.5px solid var(--color-accent)', color: 'var(--vx-fg-1)' }
                  : { background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)', color: 'var(--vx-fg-3)' }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <div className="text-[11.5px] text-[var(--vx-fg-3)] mb-2">How stressed did today feel?</div>
          <div className="flex justify-between gap-1.5">
            {STRESS_SCALE.map(s => (
              <button
                key={s.level}
                onClick={() => setStress(s.level)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-medium transition-all"
                style={stress === s.level
                  ? { background: 'var(--color-accent-dim)', border: '1.5px solid var(--color-accent)', color: 'var(--vx-fg-1)' }
                  : { background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)', color: 'var(--vx-fg-3)' }}
              >
                <span className="text-[18px]">{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => finishLifestyle(true)} className="vx-btn vx-btn-ghost" style={{ flex: 1, padding: '0.7rem' }}>Skip</button>
          <button onClick={() => finishLifestyle(false)} disabled={!sleep || moved === null || !stress} className="vx-btn vx-btn-primary" style={{ flex: 1, padding: '0.7rem', opacity: (!sleep || moved === null || !stress) ? 0.5 : 1 }}>Save</button>
        </div>
      </Modal>

      {/* Step 3 — Tomorrow's Top 3: quick-creates up to 3 real tasks dated
          tomorrow (see finishTop3 above), skippable. */}
      <Modal open={step === 'top3'} onClose={() => finishTop3(true)} title="Tomorrow's Top 3" variant="vx" maxWidth="max-w-sm">
        <p className="text-[12px] text-[var(--vx-fg-3)] mb-3.5">
          Add up to 3 quick tasks for tomorrow — they&apos;ll already be on your list when the day starts. Skip any time.
        </p>
        <div className="flex flex-col gap-2 mb-4">
          {[0, 1, 2].map(i => (
            <input
              key={i}
              className="vx-field"
              placeholder={`Priority ${i + 1}${i === 0 ? '' : ' (optional)'}`}
              value={top3[i]}
              maxLength={80}
              onChange={e => setTop3(prev => { const next = [...prev] as [string, string, string]; next[i] = e.target.value; return next })}
            />
          ))}
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => finishTop3(true)} className="vx-btn vx-btn-ghost" style={{ flex: 1, padding: '0.7rem' }}>Skip</button>
          <button onClick={() => finishTop3(false)} className="vx-btn vx-btn-primary" style={{ flex: 1, padding: '0.7rem' }}>Add tasks</button>
        </div>
      </Modal>

      {/* Step 4 — Weekly Review, Sunday only (this app's week-end day). */}
      <Modal open={step === 'weekly'} onClose={() => finishWeekly(true)} title="Weekly Review" variant="vx" maxWidth="max-w-sm">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)' }}>
            <div className="text-[17px] font-extrabold">{recap.tasksDone}/{recap.tasksTotal}</div>
            <div className="text-[10.5px] text-[var(--vx-fg-4)]">Tasks done</div>
          </div>
          <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)' }}>
            <div className="text-[17px] font-extrabold">{recap.totalRxp}</div>
            <div className="text-[10.5px] text-[var(--vx-fg-4)]">RXP earned</div>
          </div>
          <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)' }}>
            <div className="text-[17px] font-extrabold">{recap.goalsCompleted}</div>
            <div className="text-[10.5px] text-[var(--vx-fg-4)]">Goals done</div>
          </div>
          <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)' }}>
            <div className="text-[17px] font-extrabold">{recap.daysSubmitted}/7</div>
            <div className="text-[10.5px] text-[var(--vx-fg-4)]">Days submitted</div>
          </div>
        </div>
        {recap.daysWithLifestyle > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)' }}>
              <div className="text-[15px] font-extrabold">{recap.avgSleep}/3</div>
              <div className="text-[10.5px] text-[var(--vx-fg-4)]">Avg sleep</div>
            </div>
            <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)' }}>
              <div className="text-[15px] font-extrabold">{recap.daysMoved}/{recap.daysWithLifestyle}</div>
              <div className="text-[10.5px] text-[var(--vx-fg-4)]">Days moved</div>
            </div>
            <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)' }}>
              <div className="text-[15px] font-extrabold">{recap.avgStress}/5</div>
              <div className="text-[10.5px] text-[var(--vx-fg-4)]">Avg stress</div>
            </div>
          </div>
        )}
        {recap.correlationNote && (
          <p className="text-[11.5px] mb-2 p-2 rounded-lg" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>
            💡 {recap.correlationNote}
          </p>
        )}
        <p className="text-[11px] text-[var(--vx-fg-4)] mb-3">Week of {formatDateShort(weekMonday)} — optional, skip any time.</p>
        <div className="flex flex-col gap-2.5 mb-4">
          <textarea className="vx-field" rows={2} placeholder="What worked this week?" value={whatWorked} maxLength={200} onChange={e => setWhatWorked(e.target.value)} />
          <textarea className="vx-field" rows={2} placeholder="What didn't — what would you avoid next time?" value={whatDidnt} maxLength={200} onChange={e => setWhatDidnt(e.target.value)} />
          <textarea className="vx-field" rows={2} placeholder="One thing to change next week" value={oneChange} maxLength={200} onChange={e => setOneChange(e.target.value)} />
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => finishWeekly(true)} className="vx-btn vx-btn-ghost" style={{ flex: 1, padding: '0.7rem' }}>Skip</button>
          <button onClick={() => finishWeekly(false)} className="vx-btn vx-btn-primary" style={{ flex: 1, padding: '0.7rem' }}>Save</button>
        </div>
      </Modal>
    </>
  )
}
