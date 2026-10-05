'use client'
import { useEffect, useRef, useState } from 'react'
import { useDebouncedSave } from '@/hooks/useDebouncedSave'
import { isHabitDone, minutesToTimeStr, timeStrToMinutes } from '@/lib/habit100/scoring'
import type { BookValue, HabitDef, Habit100Value } from '@/store/habit100/types'

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

  if (habit.type === 'book') {
    const book = (typeof value === 'object' && value !== null && 'pages' in value) ? value as BookValue : { title: '', topic: '', pages: 0 }
    return <BookRow habit={habit} value={book} onChange={onChange} readOnly={readOnly} done={done} />
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

/** A single combined entry for "Book read" — title/topic/pages all live
 *  under one habit (one counted slot), not three separate habits, so
 *  reading isn't silently weighted 3x against every other habit. "Done" is
 *  decided by pages alone (see isHabitDone's 'book' case) — title/topic
 *  are detail, not required.
 *
 *  Uses ONE combined local object + a single debounce timer, not three
 *  independent useDebouncedSave instances — title/topic committed via
 *  separate debounces would each reconstruct the saved object from a
 *  stale snapshot of its sibling fields, so editing both within the same
 *  debounce window could silently clobber whichever committed first. */
function BookRow({ habit, value, onChange, readOnly, done }: {
  habit: HabitDef; value: BookValue; onChange: (v: Habit100Value | undefined) => void; readOnly?: boolean; done: boolean
}) {
  const [local, setLocal] = useState(value)
  const localRef = useRef(local)
  const savedRef = useRef(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { localRef.current = local }, [local])

  function flush() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    const cur = localRef.current
    if (cur === savedRef.current) return
    savedRef.current = cur
    const empty = !cur.title.trim() && !cur.topic.trim() && !cur.pages
    onChange(empty ? undefined : cur)
  }

  function change(next: BookValue) {
    setLocal(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, 3000)
  }

  useEffect(() => {
    const onHide = () => flush()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      flush()
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="habit100-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
      <div className="flex items-center gap-2.5 w-full">
        <span className={`vx-check ${done ? 'vx-done' : ''}`} style={{ pointerEvents: 'none' }}>{done ? '✓' : ''}</span>
        <span className="habit100-row-label" style={{ flex: 1 }}>{habit.label}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full" style={{ paddingLeft: 30 }}>
        <input type="text" className="vx-field" placeholder="Book title" value={local.title} disabled={readOnly}
          onChange={e => change({ ...local, title: e.target.value })} onBlur={flush} />
        <input type="text" className="vx-field" placeholder="Topic" value={local.topic} disabled={readOnly}
          onChange={e => change({ ...local, topic: e.target.value })} onBlur={flush} />
        <div className="flex items-center gap-1.5">
          <input
            type="number" inputMode="numeric" className="vx-field" placeholder="Pages"
            value={local.pages ? String(local.pages) : ''} disabled={readOnly}
            onChange={e => {
              const n = e.target.value.trim() === '' ? 0 : Number(e.target.value)
              change({ ...local, pages: Number.isNaN(n) ? 0 : n })
            }}
            onBlur={flush}
          />
          {habit.unit && <span className="habit100-unit">{habit.unit}</span>}
        </div>
      </div>
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
