'use client'
import { usePlannerStore } from '@/store'
import { MOOD_LABELS }     from '@/constants/points'
import { showToast }       from '@/ui/Toast'
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

  const moods: { key: Mood; label: string; style: React.CSSProperties }[] = [
    { key: 'motivated', label: '⚡ Motivated', style: { borderColor: '#639922', color: 'var(--green)' } },
    { key: 'neutral',   label: '😐 Neutral',   style: { borderColor: 'var(--border2)', color: 'var(--text2)' } },
    { key: 'sick',      label: '🤒 Sick',       style: { borderColor: '#E24B4A', color: 'var(--red)' } },
  ]

  return (
    <div className="flex gap-1.5 flex-wrap items-center mb-3.5">
      <span className="text-[11px] text-[var(--text3)]">Mood:</span>
      {moods.map(m => (
        <button
          key={m.key}
          onClick={() => {
            if (mood && mood !== m.key) { showToast(`Mood already set to ${MOOD_LABELS[mood]} for today.`); return }
            if (mood || isSubmitted) return
            setMood(today, m.key)
            if (m.key === 'sick' && moodYesterday === 'sick') {
              showManagerMessage(getConcernMessage(cfg.tone))
            }
          }}
          className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
          style={{
            ...m.style,
            background: 'var(--bg)',
            opacity:     mood && mood !== m.key ? 0.35 : 1,
            cursor:      mood ? (mood === m.key ? 'default' : 'not-allowed') : 'pointer',
            borderWidth: mood === m.key ? '1.5px' : '0.5px',
            fontWeight:  mood === m.key ? 600 : 500,
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
