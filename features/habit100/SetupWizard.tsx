'use client'
import { useState } from 'react'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { defaultHabits, DEFAULT_DISCIPLINED_THRESHOLD_PCT } from '@/lib/habit100/defaults'
import { uid } from '@/lib/engine/cutoff'
import { minutesToTimeStr, timeStrToMinutes } from '@/lib/habit100/scoring'
import type { HabitDef, HabitType, Comparison } from '@/store/habit100/types'

const TYPE_LABELS: Record<HabitType, string> = { checkbox: 'Yes/No', numeric: 'Number', time: 'Time', text: 'Text' }

/** First-run setup — habit list (seeded, fully editable/removable/
 *  addable), start date, disciplined-day threshold, pinned goals. Once
 *  "Start my 100 days" is pressed, the habit LIST locks for the whole run
 *  (targets stay editable throughout — see Home's per-habit target edit,
 *  not built into this wizard). */
export function SetupWizard() {
  const setupTracker = useHabit100Store(s => s.setupTracker)
  const [habits, setHabits] = useState<HabitDef[]>(defaultHabits)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [threshold, setThreshold] = useState(DEFAULT_DISCIPLINED_THRESHOLD_PCT)
  const [goals, setGoals] = useState<[string, string, string]>(['', '', ''])
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<HabitType>('checkbox')

  function removeHabit(id: string) {
    setHabits(hs => hs.filter(h => h.id !== id))
  }
  function toggleCounted(id: string) {
    setHabits(hs => hs.map(h => h.id === id ? { ...h, counted: !h.counted } : h))
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
      id: uid(), label, type: newType, counted: true,
      ...(newType === 'numeric' || newType === 'time' ? { target: 0, comparison: 'gte' as Comparison } : {}),
    }])
    setNewLabel('')
  }
  function start() {
    if (habits.length === 0) return
    setupTracker(habits, startDate, threshold, goals.map(g => g.trim()).filter(Boolean))
  }

  return (
    <div className="flex flex-col gap-5 pb-20">
      <div>
        <div className="text-[18px] font-extrabold mb-1">Set up your 100-day run</div>
        <p className="text-[12px]" style={{ color: 'var(--vx-fg-3)' }}>
          Edit, remove, or add habits below — once you start, the habit list locks for all 100 days
          (you can still change a target number later, just not the list itself).
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {habits.map(h => (
          <div key={h.id} className="habit100-row" style={{ flexWrap: 'wrap' }}>
            <button type="button" onClick={() => toggleCounted(h.id)} className="vx-chip"
              data-tone={h.counted ? 'emerald' : 'neutral'}
              style={{ borderColor: h.counted ? 'var(--color-accent)' : 'var(--vx-border)', color: h.counted ? 'var(--color-accent)' : 'var(--vx-fg-4)' }}
              title="Counts toward disciplined-day %">
              {h.counted ? '✓ counted' : 'not counted'}
            </button>
            <span className="habit100-row-label" style={{ flex: 1 }}>{h.label} <span style={{ color: 'var(--vx-fg-4)' }}>· {TYPE_LABELS[h.type]}</span></span>
            {(h.type === 'numeric' || h.type === 'time') && (
              <>
                <select className="vx-field" style={{ width: 70 }} value={h.comparison ?? 'gte'} onChange={e => setComparison(h.id, e.target.value as Comparison)}>
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
              </>
            )}
            <button type="button" onClick={() => removeHabit(h.id)} className="vx-btn vx-btn-ghost" style={{ padding: '4px 10px' }} aria-label={`Remove ${h.label}`}>✕</button>
          </div>
        ))}
      </div>

      <div className="habit100-row" style={{ flexWrap: 'wrap' }}>
        <input className="vx-field" style={{ flex: 1, minWidth: 140 }} placeholder="Add a habit…" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
        <select className="vx-field" style={{ width: 100 }} value={newType} onChange={e => setNewType(e.target.value as HabitType)}>
          {(Object.keys(TYPE_LABELS) as HabitType[]).map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <button type="button" onClick={addHabit} className="vx-btn vx-btn-primary">+ Add</button>
      </div>

      <div>
        <div className="vx-eyebrow mb-2">Start date</div>
        <input type="date" className="vx-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
      </div>

      <div>
        <div className="vx-eyebrow mb-2">Disciplined-day threshold</div>
        <div className="flex items-center gap-2">
          <input type="number" min={1} max={100} className="vx-field" style={{ width: 80 }} value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
          <span className="text-[12px]" style={{ color: 'var(--vx-fg-3)' }}>% of counted habits done = a disciplined day</span>
        </div>
      </div>

      <div>
        <div className="vx-eyebrow mb-2">Pinned goals (optional, up to 3)</div>
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(i => (
            <input
              key={i}
              className="vx-field"
              placeholder={`Goal ${i + 1}`}
              value={goals[i]}
              onChange={e => setGoals(g => { const next = [...g] as [string, string, string]; next[i] = e.target.value; return next })}
            />
          ))}
        </div>
      </div>

      <button type="button" onClick={start} disabled={habits.length === 0} className="vx-btn vx-btn-primary" style={{ padding: '0.8rem' }}>
        Start my 100 days
      </button>
    </div>
  )
}
