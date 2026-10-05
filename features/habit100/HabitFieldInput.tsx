'use client'
import { useState } from 'react'
import { useDebouncedSave } from '@/hooks/useDebouncedSave'
import { isHabitDone, minutesToTimeStr, timeStrToMinutes } from '@/lib/habit100/scoring'
import type { HabitDef, Habit100Value } from '@/store/habit100/types'

/** One habit's input row — the type-dispatch for the whole tracker's autosave
 *  rules: checkbox/numeric/time commit immediately or on blur (discrete
 *  interactions, nothing to debounce); text debounces 3s with flush-on-exit
 *  (see useDebouncedSave). `readOnly` renders History's locked-day detail
 *  view using the exact same component, just without any input affordance. */
export function HabitFieldInput({ habit, value, onChange, readOnly }: {
  habit: HabitDef
  value: Habit100Value | undefined
  onChange: (v: Habit100Value | undefined) => void
  readOnly?: boolean
}) {
  const done = isHabitDone(habit, value)

  if (habit.type === 'checkbox') {
    return (
      <div className="habit100-row">
        <button
          type="button"
          className={`vx-check ${done ? 'vx-done' : ''}`}
          disabled={readOnly}
          onClick={() => onChange(!done)}
          aria-label={habit.label}
        >
          {done ? '✓' : ''}
        </button>
        <span className="habit100-row-label">{habit.label}</span>
      </div>
    )
  }

  if (habit.type === 'time') {
    const timeStr = typeof value === 'number' ? minutesToTimeStr(value) : ''
    return (
      <div className="habit100-row">
        <span className={`vx-check ${done ? 'vx-done' : ''}`} style={{ pointerEvents: 'none' }}>{done ? '✓' : ''}</span>
        <span className="habit100-row-label" style={{ flex: 1 }}>{habit.label}</span>
        <input
          type="time"
          className="vx-field"
          style={{ width: 110 }}
          value={timeStr}
          disabled={readOnly}
          onChange={e => {
            const mins = timeStrToMinutes(e.target.value)
            onChange(mins === null ? undefined : mins)
          }}
        />
      </div>
    )
  }

  if (habit.type === 'numeric') {
    return <NumericRow habit={habit} value={typeof value === 'number' ? value : undefined} onChange={onChange} readOnly={readOnly} done={done} />
  }

  // text
  return <TextRow habit={habit} value={typeof value === 'string' ? value : ''} onChange={onChange} readOnly={readOnly} done={done} />
}

function NumericRow({ habit, value, onChange, readOnly, done }: {
  habit: HabitDef; value: number | undefined; onChange: (v: Habit100Value | undefined) => void; readOnly?: boolean; done: boolean
}) {
  const [local, setLocal] = useState(value === undefined ? '' : String(value))
  return (
    <div className="habit100-row">
      <span className={`vx-check ${done ? 'vx-done' : ''}`} style={{ pointerEvents: 'none' }}>{done ? '✓' : ''}</span>
      <span className="habit100-row-label" style={{ flex: 1 }}>{habit.label}</span>
      <input
        type="number"
        inputMode="decimal"
        className="vx-field"
        style={{ width: 90 }}
        placeholder={habit.unit}
        value={local}
        disabled={readOnly}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => {
          const n = local.trim() === '' ? undefined : Number(local)
          onChange(n === undefined || Number.isNaN(n) ? undefined : n)
        }}
      />
      {habit.unit && <span className="habit100-unit">{habit.unit}</span>}
    </div>
  )
}

function TextRow({ habit, value, onChange, readOnly, done }: {
  habit: HabitDef; value: string; onChange: (v: Habit100Value | undefined) => void; readOnly?: boolean; done: boolean
}) {
  const { value: local, onChange: change, onBlur } = useDebouncedSave(value, v => onChange(v.trim() === '' ? undefined : v))
  return (
    <div className="habit100-row" style={{ alignItems: 'flex-start' }}>
      <span className={`vx-check ${done ? 'vx-done' : ''}`} style={{ pointerEvents: 'none', marginTop: 2 }}>{done ? '✓' : ''}</span>
      <div style={{ flex: 1 }}>
        <div className="habit100-row-label" style={{ marginBottom: 4 }}>{habit.label}</div>
        <input
          type="text"
          className="vx-field"
          value={local}
          disabled={readOnly}
          onChange={e => change(e.target.value)}
          onBlur={onBlur}
        />
      </div>
    </div>
  )
}
