'use client'
import { useState }        from 'react'
import { usePlannerStore } from '@/store'
import { ProgressBar }     from '@/ui/ProgressBar'
import { Modal }           from '@/ui/Modal'
import defaults            from '@/data/defaults.json'

const RANKS = defaults.ranks

export function RankProgress() {
  const rankXP  = usePlannerStore(s => s.rankXP)
  const [open, setOpen] = useState(false)

  const rank     = [...RANKS].reverse().find(r => rankXP >= r.min) ?? RANKS[0]
  const rankIdx  = RANKS.indexOf(rank)
  const nextRank = RANKS[rankIdx + 1] ?? null
  const pct      = nextRank
    ? Math.round((rankXP - rank.min) / (nextRank.min - rank.min) * 100)
    : 100

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="card mb-3.5 w-full text-left cursor-pointer transition-opacity hover:opacity-90"
      >
        <div className="flex justify-between items-center flex-wrap gap-1 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border"
              style={{ background: rank.bg, color: rank.c, borderColor: rank.bc }}
            >
              {rank.label}
            </span>
            <span className="text-xs text-[var(--text2)]">{rankXP} XP</span>
          </div>
          <span className="text-xs text-[var(--text2)]">
            {nextRank ? `${rankXP - rank.min}/${nextRank.min - rank.min} XP to ${nextRank.label}` : '🏆 MAX RANK'}
          </span>
        </div>
        <ProgressBar value={pct} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="🏆 Rank milestones">
        <div className="space-y-2">
          {RANKS.map((r, i) => {
            const isCurrent = rankXP >= r.min && (i === RANKS.length - 1 || rankXP < RANKS[i + 1].min)
            const isPast    = rankXP >= r.min
            const isNext    = rankIdx + 1 === i
            return (
              <div
                key={r.label}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border"
                style={{
                  background:   isCurrent ? r.bg  : 'var(--bg2)',
                  borderColor:  isCurrent ? r.bc  : 'var(--border)',
                }}
              >
                <span>{isPast ? '✅' : isNext ? '🎯' : '⬜'}</span>
                <div>
                  <div className="text-[13px] font-medium" style={{ color: isCurrent ? r.c : 'var(--text)' }}>
                    {r.label}{isCurrent ? ' ← you' : ''}
                  </div>
                  <div className="text-[11px] text-[var(--text3)]">{r.min} XP</div>
                </div>
              </div>
            )
          })}
        </div>
      </Modal>
    </>
  )
}
