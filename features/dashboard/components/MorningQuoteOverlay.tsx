'use client'
import { useEffect, useState } from 'react'
import { usePlannerStore } from '@/store'
import { getDailyQuote }   from '@/lib/engine/quotes'

export function MorningQuoteOverlay({ today }: { today: string }) {
  const cfg                  = usePlannerStore(s => s.cfg)
  const morningQuoteShown    = usePlannerStore(s => s.morningQuoteShown)
  const markMorningQuoteShown = usePlannerStore(s => s.markMorningQuoteShown)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hours = new Date().getHours()
    if (cfg.quoteMorning && hours >= 4 && !morningQuoteShown[today]) {
      setVisible(true)
    }
  }, [today, cfg.quoteMorning, morningQuoteShown])

  function dismiss() {
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
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 28 }}>— {quote.a}</p>
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
