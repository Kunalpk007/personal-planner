'use client'
import { useEffect, useState } from 'react'
import { usePlannerStore } from '@/store'
import { MOOD_LABELS }     from '@/constants/points'
import { showToast }       from '@/ui/Toast'
import { showManagerMessage } from '@/ui/ManagerModal'
import { getConcernMessage } from '@/lib/engine/manager'
import { getPrevDayKey }   from '@/lib/engine/cutoff'
import type { Mood }       from '@/store/types'

function useCountdown(until: string | undefined): number {
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    if (!until) return
    const tick = () => setRemaining(Math.max(0, new Date(until).getTime() - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [until])
  return remaining
}

function fmtMs(ms: number): string {
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60), sec = s % 60
  if (m < 60) return `${m}m${sec > 0 ? ` ${sec}s` : ''}`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function MoodBar({ today }: { today: string }) {
  const mood          = usePlannerStore(s => s.mood[today])
  const moodLockedUntil = usePlannerStore(s => s.moodLockedUntil[today])
  const moodYesterday = usePlannerStore(s => s.mood[getPrevDayKey(today)])
  const setMood       = usePlannerStore(s => s.setMood)
  const isSubmitted   = usePlannerStore(s => !!s.submittedDays[today])
  const cfg           = usePlannerStore(s => s.cfg)

  const remaining = useCountdown(moodLockedUntil)
  const isEditable = !isSubmitted && (!mood || remaining > 0)

  const moods: { key: Mood; label: string; style: React.CSSProperties }[] = [
    { key: 'motivated', label: '⚡ Motivated', style: { borderColor: '#639922', color: 'var(--green)' } },
    { key: 'neutral',   label: '😐 Neutral',   style: { borderColor: 'var(--border2)', color: 'var(--text2)' } },
    { key: 'sick',      label: '🤒 Sick',       style: { borderColor: '#E24B4A', color: 'var(--red)' } },
  ]

  return (
    <div className="mb-3.5">
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-[11px] text-[var(--text3)]">Mood:</span>
        {moods.map(m => (
          <button
            key={m.key}
            onClick={() => {
              if (!isEditable) {
                if (isSubmitted) return
                showToast(`Mood locked — ${MOOD_LABELS[mood!]} set for today.`)
                return
              }
              setMood(today, m.key)
              if (m.key === 'sick' && moodYesterday === 'sick') {
                showManagerMessage(getConcernMessage(cfg.tone))
              }
            }}
            className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
            style={{
              ...m.style,
              background: 'var(--bg)',
              opacity:     mood && mood !== m.key && !isEditable ? 0.35 : 1,
              cursor:      isEditable ? 'pointer' : mood === m.key ? 'default' : 'not-allowed',
              borderWidth: mood === m.key ? '1.5px' : '0.5px',
              fontWeight:  mood === m.key ? 600 : 500,
            }}
          >
            {m.label}
          </button>
        ))}
        {mood && remaining > 0 && (
          <span className="text-[10px] text-[var(--text3)] ml-1">
            (editable {fmtMs(remaining)})
          </span>
        )}
        {mood && remaining === 0 && !isSubmitted && (
          <span className="text-[10px] text-[var(--text3)] ml-1">locked</span>
        )}
      </div>
    </div>
  )
}
