'use client'
import { useState } from 'react'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { defaultHabits, DEFAULT_DISCIPLINED_THRESHOLD_PCT, DEFAULT_TOTAL_DAYS } from '@/lib/habit100/defaults'
import { uid } from '@/lib/engine/cutoff'
import { minutesToTimeStr, timeStrToMinutes } from '@/lib/habit100/scoring'
import type { HabitDef, HabitType, Comparison, Habit100Goal } from '@/store/habit100/types'

// 'book' deliberately excluded — it's a fixed seed-only entry (title/topic/
// pages combined), not something offered when adding a new custom habit.
const ADDABLE_TYPES: Record<Exclude<HabitType, 'book'>, string> = { checkbox: 'Yes/No', numeric: 'Number', time: 'Time', text: 'Text' }
const LENGTH_PRESETS = [30, 50, 75, 100]

/** First-run setup — habit list (seeded, fully editable/removable/
 *  addable), run length, disciplined-day threshold, pinned goals. Once
 *  "Start my N days" is pressed, the habit LIST locks for the whole run
 *  (targets stay editable throughout — see Home's per-habit target edit,
 *  not built into this wizard). Every habit in the list counts toward the
 *  disciplined-day % — there's no separate toggle; removing a habit is how
 *  you keep something out of the score. */
export function SetupWizard() {
  const setupTracker = useHabit100Store(s => s.setupTracker)
  const [habits, setHabits] = useState<HabitDef[]>(defaultHabits)
  const [totalDays, setTotalDays] = useState(DEFAULT_TOTAL_DAYS)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [threshold, setThreshold] = useState(DEFAULT_DISCIPLINED_THRESHOLD_PCT)
  const [goals, setGoals] = useState<Habit100Goal[]>([{ text: '', habitId: '' }, { text: '', habitId: '' }, { text: '', habitId: '' }])
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<Exclude<HabitType, 'book'>>('checkbox')

  function removeHabit(id: string) {
    setHabits(hs => hs.filter(h => h.id !== id))
    // a goal pointing at a removed habit would otherwise save a dangling
    // habitId with no way to show a progress bar for it
    setGoals(g => g.map(x => x.habitId === id ? { ...x, habitId: '' } : x))
  }
  function setTarget(id: string, target: number | undefined) {
    setHabits(hs => hs.map(h => h.id === id ? { ...h, target } : h))
  }
  function setComparison(id: string, comparison: Comparison) {
    setHabits(hs => hs.map(h => h.id === id ? { ...h, comparison } : h))
  }
  function addHabit() {
    const label = newLabel.trim()
    if (!label) return
    setHabits(hs => [...hs, {
      id: uid(), label, type: newType,
      ...(newType === 'numeric' || newType === 'time' ? { target: 0, comparison: 'gte' as Comparison } : {}),
    }])
    setNewLabel('')
  }
  function start() {
    if (habits.length === 0) return
    const cleanGoals = goals
      .map(g => ({ text: g.text.trim(), habitId: g.habitId }))
      .filter(g => g.text && g.habitId)
    setupTracker(habits, startDate, threshold, cleanGoals, totalDays)
  }

  return (
    <div className="flex flex-col gap-5 pb-20">
      <div>
        <div className="text-[18px] font-extrabold mb-1">Set up your consistency run</div>
        <p className="text-[12px]" style={{ color: 'var(--vx-fg-3)' }}>
          Edit, remove, or add habits below — once you start, the habit list locks for all {totalDays} days
          (you can still change a target number later, just not the list itself).
        </p>
      </div>

      <div>
        <div className="vx-eyebrow mb-2">How many days?</div>
        <div className="flex items-center gap-2 flex-wrap">
          {LENGTH_PRESETS.map(n => (
            <button key={n} type="button" onClick={() => setTotalDays(n)} className="vx-pill"
              style={totalDays === n ? { background: 'var(--color-accent)', color: '#06240f', borderColor: 'transparent' } : undefined}>
              {n}
            </button>
          ))}
          <input
            type="number" min={1} className="vx-field" style={{ width: 90 }}
            value={totalDays} onChange={e => setTotalDays(Math.max(1, Number(e.target.value) || 1))}
          />
          <span className="text-[11.5px]" style={{ color: 'var(--vx-fg-3)' }}>days</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {habits.map(h => (
          <div key={h.id} className="habit100-card">
            <button type="button" onClick={() => removeHabit(h.id)} className="habit100-card-remove" aria-label={`Remove ${h.label}`}>✕</button>
            <div className="habit100-card-label">{h.label}</div>
            {(h.type === 'numeric' || h.type === 'time' || h.type === 'book') && (
              <div className="habit100-card-controls">
                <select className="vx-field" style={{ width: 80 }} value={h.comparison ?? 'gte'} onChange={e => setComparison(h.id, e.target.value as Comparison)}>
                  <option value="gte">{h.type === 'time' ? 'after' : '≥'}</option>
                  <option value="lte">{h.type === 'time' ? 'before' : '≤'}</option>
                </select>
                {h.type === 'time' ? (
                  <input
                    type="time"
                    className="vx-field"
                    style={{ width: 110 }}
                    value={typeof h.target === 'number' ? minutesToTimeStr(h.target) : ''}
                    onChange={e => {
                      const mins = timeStrToMinutes(e.target.value)
                      setTarget(h.id, mins === null ? undefined : mins)
                    }}
                  />
                ) : (
                  <>
                    <input
                      type="number"
                      className="vx-field"
                      style={{ width: 70 }}
                      value={h.target ?? 0}
                      onChange={e => setTarget(h.id, Number(e.target.value))}
                    />
                    {h.unit && <span className="habit100-unit">{h.unit}</span>}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="habit100-card" style={{ background: 'var(--vx-surface-tint)' }}>
        <div className="habit100-card-controls" style={{ width: '100%', flexWrap: 'wrap', paddingRight: 0 }}>
          <input className="vx-field" style={{ flex: 1, minWidth: 140 }} placeholder="Add a habit…" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
          <select className="vx-field" style={{ width: 100 }} value={newType} onChange={e => setNewType(e.target.value as Exclude<HabitType, 'book'>)}>
            {(Object.keys(ADDABLE_TYPES) as Array<Exclude<HabitType, 'book'>>).map(t => <option key={t} value={t}>{ADDABLE_TYPES[t]}</option>)}
          </select>
          <button type="button" onClick={addHabit} className="vx-btn vx-btn-primary">+ Add</button>
        </div>
      </div>

      <div>
        <div className="vx-eyebrow mb-2">Start date</div>
        <input type="date" className="vx-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
      </div>

      <div>
        <div className="vx-eyebrow mb-2">Disciplined-day threshold</div>
        <div className="flex items-center gap-2">
          <input type="number" min={1} max={100} className="vx-field" style={{ width: 80 }} value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
          <span className="text-[12px]" style={{ color: 'var(--vx-fg-3)' }}>% of habits done = a disciplined day</span>
        </div>
      </div>

      <div>
        <div className="vx-eyebrow mb-2">Pinned goals (optional, up to 3)</div>
        <p className="text-[11px] mb-2" style={{ color: 'var(--vx-fg-4)' }}>Each goal is tied to one habit above — its progress bar is that habit's own consistency %.</p>
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex gap-2">
              <input
                className="vx-field"
                style={{ flex: 1 }}
                placeholder={`Goal ${i + 1}`}
                value={goals[i].text}
                onChange={e => setGoals(g => { const next = [...g]; next[i] = { ...next[i], text: e.target.value }; return next })}
              />
              <select
                className="vx-field"
                style={{ width: 130 }}
                value={goals[i].habitId}
                onChange={e => setGoals(g => { const next = [...g]; next[i] = { ...next[i], habitId: e.target.value }; return next })}
              >
                <option value="">Which habit?</option>
                {habits.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <button type="button" onClick={start} disabled={habits.length === 0} className="vx-btn vx-btn-primary" style={{ padding: '0.8rem' }}>
        Start my {totalDays} days
      </button>
    </div>
  )
}
