'use client'
import { useEffect, useState } from 'react'
import { usePlannerStore } from '@/store'
import { getDailyQuote }   from '@/lib/engine/quotes'
import type { Mood } from '@/store/types'

const MORNING_MOODS: { key: Mood; label: string; color: string }[] = [
  { key: 'motivated', label: '⚡ Motivated', color: '#639922' },
  { key: 'neutral',   label: '😐 Neutral',   color: 'var(--border2)' },
  { key: 'sick',      label: '🤒 Sick',       color: '#E24B4A' },
]

export function MorningQuoteOverlay({ today }: { today: string }) {
  const cfg                  = usePlannerStore(s => s.cfg)
  const morningQuoteShown    = usePlannerStore(s => s.morningQuoteShown)
  const markMorningQuoteShown = usePlannerStore(s => s.markMorningQuoteShown)
  const todayMood            = usePlannerStore(s => s.mood[today])
  const setMood              = usePlannerStore(s => s.setMood)
  const [visible, setVisible] = useState(false)
  const [pickedMood, setPickedMood] = useState<Mood | ''>('')

  useEffect(() => {
    const hours = new Date().getHours()
    if (cfg.quoteMorning && hours >= 4 && hours < 12 && !morningQuoteShown[today]) {
      setVisible(true)
    }
  }, [today, cfg.quoteMorning, morningQuoteShown])

  function dismiss() {
    if (pickedMood && !todayMood) setMood(today, pickedMood)
    markMorningQuoteShown(today)
    setVisible(false)
  }

  if (!visible) return null

  const quote = getDailyQuote(today, 'morning')

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={dismiss}
    >
      <div
        style={{
          maxWidth: 440, width: '100%',
          background: 'var(--bg)', borderRadius: 16,
          border: '1px solid var(--border)',
          padding: '36px 32px',
          textAlign: 'center',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 36, marginBottom: 16 }}>🌅</div>
        <p style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5, color: 'var(--text)', marginBottom: 12 }}>
          &ldquo;{quote.t}&rdquo;
        </p>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>— {quote.a}</p>

        {/* Quick mood check-in for the day */}
        {!todayMood && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>How are you feeling today?</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {MORNING_MOODS.map(m => (
                <button key={m.key} onClick={() => setPickedMood(m.key)}
                  style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                    background: 'var(--bg)', color: 'var(--text2)',
                    border: `${pickedMood === m.key ? '1.5px' : '0.5px'} solid ${m.color}`,
                    fontWeight: pickedMood === m.key ? 600 : 500,
                  }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={dismiss}
          style={{
            padding: '10px 28px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: 'var(--green-bg)', color: 'var(--green)',
            border: '1.5px solid var(--green-mid)', cursor: 'pointer',
          }}
        >
          Start my day ✓
        </button>
      </div>
    </div>
  )
}
