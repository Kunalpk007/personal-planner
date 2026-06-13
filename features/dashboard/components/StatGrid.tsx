'use client'
import { useMemo }                from 'react'
import { usePlannerStore }        from '@/store'
import { todayEarned, todayTarget, getMoodMult } from '@/lib/engine/scoring'

export function StatGrid({ today }: { today: string }) {
  const allTasks = usePlannerStore(s => s.tasks)
  const tasks   = useMemo(() => allTasks.filter(t => t.date === today), [allTasks, today])
  const done    = tasks.filter(t => t.done)
  const mood    = usePlannerStore(s => s.mood[today])
  const cfg     = usePlannerStore(s => s.cfg)
  const wallet  = usePlannerStore(s => s.rewardWallet)
  const streak  = usePlannerStore(s => s.streak)

  const earned  = todayEarned(done, mood, cfg)
  const target  = todayTarget(tasks)
  const mult    = getMoodMult(mood, cfg)

  const cards = [
    {
      label: 'Points today',
      val:   earned,
      sub:   `target: ${target}${mood ? ` (${Math.round(mult * 100)}%)` : ''}`,
    },
    { label: 'Reward Wallet', val: wallet, sub: '2:1 from task pts' },
    { label: 'Done today',    val: done.length, sub: `of ${tasks.length}` },
    { label: 'Streak',        val: streak,      sub: 'days', fire: true },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--spacing-gap)', marginBottom: '1.5rem' }}>
      {cards.map(c => (
        <div key={c.label} className="stat-card">
          <div className="stat-label">{c.label}</div>
          {c.fire ? (
            <div className="stat-value relative inline-flex items-center justify-center min-w-[1.5em]">
              <span className="absolute text-[28px] opacity-20 select-none leading-none">🔥</span>
              <span className="relative">{c.val}</span>
            </div>
          ) : (
            <div className="stat-value">{c.val}</div>
          )}
          <div className="text-[11px] text-[var(--text2)] mt-1">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}
