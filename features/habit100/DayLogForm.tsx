'use client'
import { useMemo } from 'react'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { HabitFieldInput } from './HabitFieldInput'
import { useDebouncedSave } from '@/hooks/useDebouncedSave'
import type { HabitDef } from '@/store/habit100/types'

const RATING_FIELDS = [
  { key: 'mood' as const,    label: 'Mood' },
  { key: 'energy' as const,  label: 'Energy' },
  { key: 'stress' as const,  label: 'Stress' },
  { key: 'anxiety' as const, label: 'Anxiety' },
]

function groupHabits(habits: HabitDef[]): Array<[string, HabitDef[]]> {
  const groups = new Map<string, HabitDef[]>()
  for (const h of habits) {
    const key = h.category ?? ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(h)
  }
  // uncategorized first, then categories in first-seen order
  const entries = [...groups.entries()]
  entries.sort((a, b) => (a[0] === '' ? -1 : b[0] === '' ? 1 : 0))
  return entries
}

/** The full day-log form — reused for Home's today input, the catch-up
 *  queue's per-day modal, and History's read-only day detail (`readOnly`).
 *  Callers remount this with `key={date}` when switching days so
 *  useDebouncedSave's in-flight text fields always flush before the next
 *  day's values are shown (see that hook's own comment). */
export function DayLogForm({ date, readOnly }: { date: string; readOnly?: boolean }) {
  const meta = useHabit100Store(s => s.meta)
  const day  = useHabit100Store(s => s.days[date])
  const setDayValue = useHabit100Store(s => s.setDayValue)
  const setDayExtra = useHabit100Store(s => s.setDayExtra)

  const groups = useMemo(() => (meta ? groupHabits(meta.habits) : []), [meta])

  const gratitude = useDebouncedSave(day?.gratitude ?? '', v => setDayExtra(date, 'gratitude', v))
  const wrong     = useDebouncedSave(day?.wrong ?? '',     v => setDayExtra(date, 'wrong', v))

  if (!meta) return null
  const locked = !!day?.locked

  return (
    <div className="flex flex-col gap-5">
      {groups.map(([category, habits]) => (
        <div key={category || 'core'}>
          {category && <div className="vx-eyebrow mb-2">{category}</div>}
          <div className="flex flex-col gap-2">
            {habits.map(h => (
              <HabitFieldInput
                key={h.id}
                habit={h}
                value={day?.values[h.id]}
                readOnly={readOnly || locked}
                onChange={v => setDayValue(date, h.id, v)}
              />
            ))}
          </div>
        </div>
      ))}

      <div>
        <div className="vx-eyebrow mb-2">Body &amp; sleep</div>
        <div className="grid grid-cols-2 gap-2">
          <NumberExtra label="Hours slept" value={day?.sleepHours} onCommit={v => setDayExtra(date, 'sleepHours', v)} readOnly={readOnly || locked} />
          <NumberExtra label="Weight (kg)" value={day?.weight}     onCommit={v => setDayExtra(date, 'weight', v)}     readOnly={readOnly || locked} />
        </div>
      </div>

      <div>
        <div className="vx-eyebrow mb-2">How you feel</div>
        <div className="flex flex-col gap-2.5">
          {RATING_FIELDS.map(f => (
            <RatingRow
              key={f.key}
              label={f.label}
              value={day?.[f.key]}
              readOnly={readOnly || locked}
              onChange={v => setDayExtra(date, f.key, v)}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="vx-eyebrow mb-2">Reflection</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <textarea
            className="vx-field"
            placeholder="Gratitude thoughts today"
            value={gratitude.value}
            disabled={readOnly || locked}
            onChange={e => gratitude.onChange(e.target.value)}
            onBlur={gratitude.onBlur}
          />
          <textarea
            className="vx-field"
            placeholder="What went wrong"
            value={wrong.value}
            disabled={readOnly || locked}
            onChange={e => wrong.onChange(e.target.value)}
            onBlur={wrong.onBlur}
          />
        </div>
      </div>

      {!readOnly && !locked && (
        <div className="text-[10px] text-right" style={{ color: 'var(--vx-fg-4)' }}>autosaves — no submit button needed</div>
      )}
    </div>
  )
}

function NumberExtra({ label, value, onCommit, readOnly }: {
  label: string; value: number | undefined; onCommit: (v: number | undefined) => void; readOnly?: boolean
}) {
  return (
    <div className="habit100-row" style={{ justifyContent: 'space-between' }}>
      <span className="habit100-row-label">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        className="vx-field"
        style={{ width: 80 }}
        defaultValue={value ?? ''}
        disabled={readOnly}
        onBlur={e => {
          const n = e.target.value.trim() === '' ? undefined : Number(e.target.value)
          onCommit(n === undefined || Number.isNaN(n) ? undefined : n)
        }}
      />
    </div>
  )
}

function RatingRow({ label, value, onChange, readOnly }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; readOnly?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11.5px]" style={{ width: 56, color: 'var(--vx-fg-3)' }}>{label}</span>
      <div className="flex gap-1" style={{ flex: 1 }}>
        {Array.from({ length: 5 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange(value === n ? undefined : n)}
            className="vx-pill"
            style={{
              flex: 1, padding: '4px 0', fontSize: 10, minWidth: 0,
              background: value && n <= value ? 'var(--color-accent)' : 'var(--vx-card)',
              color: value && n <= value ? '#06240f' : 'var(--vx-fg-4)',
              borderColor: value && n <= value ? 'transparent' : 'var(--vx-border)',
            }}
          >{n}</button>
        ))}
      </div>
    </div>
  )
}
