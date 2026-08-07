'use client'
import { useEffect, useState } from 'react'
import { usePlannerStore } from '@/store'
import { showManagerMessage } from '@/ui/ManagerModal'
import { getConcernMessage } from '@/lib/engine/manager'
import { getPrevDayKey }   from '@/lib/engine/cutoff'
import type { Mood }       from '@/store/types'

const MOODS: { key: Mood; label: string; tone: string }[] = [
  { key: 'motivated', label: '⚡ Motivated', tone: 'emerald' },
  { key: 'neutral',   label: '😐 Neutral',   tone: 'neutral' },
  { key: 'sick',      label: '🤒 Sick',       tone: 'amber' },
]

/** Mood picker. On the first open of the day (no mood set yet) shows all
 *  three options. Once one is picked, collapses to a single chip showing
 *  just the selected mood — tapping that chip re-expands the picker so it
 *  can be changed, then collapses again on the next pick. Every pick (first
 *  or a later change) is logged to moodChangeLog (see config.slice.ts) even
 *  though only the collapsed/expanded display changes here. */
export function MoodBar({ today }: { today: string }) {
  const mood          = usePlannerStore(s => s.mood[today])
  const moodYesterday = usePlannerStore(s => s.mood[getPrevDayKey(today)])
  const setMood       = usePlannerStore(s => s.setMood)
  const isSubmitted   = usePlannerStore(s => !!s.submittedDays[today])
  const cfg           = usePlannerStore(s => s.cfg)
  const moodCheckins  = usePlannerStore(s => s.moodCheckins)

  // Editable any time before the day is submitted — no lock window.
  const isEditable = !isSubmitted

  const [expanded, setExpanded] = useState(false)
  // Collapse back down whenever the day rolls over (a fresh day with no
  // mood yet should show the full picker again, not a stale expanded state).
  useEffect(() => { setExpanded(false) }, [today])

  const showPicker = !mood || expanded

  function pick(next: Mood) {
    if (!isEditable) return
    setMood(today, next)
    setExpanded(false)
    if (next === 'sick' && moodYesterday === 'sick') {
      showManagerMessage(getConcernMessage(cfg.tone))
    }
  }

  const selected = mood ? MOODS.find(m => m.key === mood) : undefined

  return (
    <div className="vx-pill-row">
      <span className="text-[11px] text-[var(--text3)] self-center mr-0.5">Mood</span>
      {showPicker ? (
        MOODS.map(m => (
          <button
            key={m.key}
            onClick={() => pick(m.key)}
            disabled={!isEditable}
            data-tone={m.tone}
            className={`vx-pill ${mood === m.key ? 'vx-sel' : ''}`}
          >
            {m.label}
          </button>
        ))
      ) : (
        <button
          onClick={() => isEditable && setExpanded(true)}
          disabled={!isEditable}
          data-tone={selected?.tone}
          className="vx-pill vx-sel"
          title={isEditable ? 'Tap to change your mood' : undefined}
        >
          {selected?.label}
        </button>
      )}
      {mood && isSubmitted && (
        <span className="text-[10px] text-[var(--text3)] self-center ml-1">locked</span>
      )}
      {moodCheckins > 0 && (
        <span className="text-[10px] text-[var(--text3)] self-center ml-auto" title="Total mood check-ins logged (morning + evening)">
          {moodCheckins} check-ins
        </span>
      )}
    </div>
  )
}
