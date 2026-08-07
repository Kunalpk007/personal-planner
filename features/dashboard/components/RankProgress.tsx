'use client'
import { useState }        from 'react'
import { motion }          from 'framer-motion'
import { usePlannerStore } from '@/store'
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
      <motion.button
        onClick={() => setOpen(true)}
        className="vx-glass vx-glass-tap w-full text-left cursor-pointer"
        initial={{ opacity: 0, y: 22, scale: 0.97, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.56 }}
      >
        <div className="flex justify-between items-center flex-wrap gap-1 mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="vx-rank-badge">🏅 {rank.label}</span>
            <span className="text-xs text-[var(--text2)]">{rankXP} XP</span>
          </div>
          <span className="text-xs text-[var(--text3)]">
            {nextRank ? `${rankXP - rank.min}/${nextRank.min - rank.min} XP to ${nextRank.label}` : '🏆 MAX RANK'}
          </span>
        </div>
        <div className="vx-bar-track">
          <motion.div
            className="vx-bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.7 }}
          />
        </div>
      </motion.button>

      <Modal open={open} onClose={() => setOpen(false)} title="🏆 Rank milestones" variant="vx">
        <div className="space-y-2">
          {RANKS.map((r, i) => {
            const isCurrent = rankXP >= r.min && (i === RANKS.length - 1 || rankXP < RANKS[i + 1].min)
            const isPast    = rankXP >= r.min
            const isNext    = rankIdx + 1 === i
            return (
              <div key={r.label} className={`vx-milestone ${isCurrent ? 'vx-current' : ''}`}>
                <div className="vx-m-icon">{isPast ? '✅' : isNext ? '🎯' : '⬜'}</div>
                <div>
                  <div className="text-[13px] font-medium">
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
