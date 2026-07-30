'use client'
import { usePlannerStore } from '@/store'
import { showManagerMessage } from '@/ui/ManagerModal'
import { getConcernMessage } from '@/lib/engine/manager'
import { getPrevDayKey }   from '@/lib/engine/cutoff'
import type { Mood }       from '@/store/types'

export function MoodBar({ today }: { today: string }) {
  const mood          = usePlannerStore(s => s.mood[today])
  const moodYesterday = usePlannerStore(s => s.mood[getPrevDayKey(today)])
  const setMood       = usePlannerStore(s => s.setMood)
  const isSubmitted   = usePlannerStore(s => !!s.submittedDays[today])
  const cfg           = usePlannerStore(s => s.cfg)

  // Editable any time before the day is submitted — no lock window.
  const isEditable = !isSubmitted

  const moods: { key: Mood; label: string; style: React.CSSProperties }[] = [
    { key: 'motivated', label: '⚡ Motivated', style: { borderColor: '#639922', color: 'var(--green)' } },
    { key: 'neutral',   label: '😐 Neutral',   style: { borderColor: 'var(--border2)', color: 'var(--text2)' } },
    { key: 'sick',      label: '🤒 Sick',       style: { borderColor: '#E24B4A', color: 'var(--red)' } },
  ]

  return (
    <div className="mb-3.5">
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-[11px] text-[var(--text3)]">Mood:</span>
        <select
          value={mood ?? ''}
          disabled={!isEditable}
          onChange={e => {
            const next = e.target.value as Mood
            setMood(today, next)
            if (next === 'sick' && moodYesterday === 'sick') {
              showManagerMessage(getConcernMessage(cfg.tone))
            }
          }}
          className="setting-input"
          style={{ opacity: isEditable ? 1 : 0.6, cursor: isEditable ? 'pointer' : 'not-allowed' }}
        >
          <option value="" disabled>Select mood…</option>
          {moods.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        {mood && isSubmitted && (
          <span className="text-[10px] text-[var(--text3)] ml-1">locked</span>
        )}
      </div>
    </div>
  )
}
