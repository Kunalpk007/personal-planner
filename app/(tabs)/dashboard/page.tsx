'use client'
import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useDayKey }       from '@/hooks/useDayKey'
import { usePlannerStore } from '@/store'
import { MoodBar }         from '@/features/dashboard/components/MoodBar'
import { StatGrid }        from '@/features/dashboard/components/StatGrid'
import { RankProgress }    from '@/features/dashboard/components/RankProgress'
import { GradientRing }    from '@/ui/GradientRing'
import { SubmitArea }      from '@/features/dashboard/components/SubmitArea'
import { Accordion }       from '@/ui/Accordion'
import { showToast }       from '@/ui/Toast'
import { todayEarned, todayTarget, calcPts } from '@/lib/engine/scoring'
import { goalPtsEarnedOn } from '@/lib/engine/goals'
import { getPrevDayKey } from '@/lib/engine/cutoff'
import { getDailyQuote }   from '@/lib/engine/quotes'
import { getManagerMessage } from '@/lib/engine/manager'
import { StreakHistoryModal } from '@/features/dashboard/components/StreakHistoryModal'
import { MorningQuoteOverlay } from '@/features/dashboard/components/MorningQuoteOverlay'
import { LifeScoreCard }   from '@/features/dashboard/components/LifeScoreCard'
import { FocusTimeCard }   from '@/features/dashboard/components/FocusTimeCard'
import { WaterTrackerCard } from '@/features/dashboard/components/WaterTrackerCard'
import { CalmDownButton }  from '@/features/wellness/CalmDownButton'
import { NotificationBell } from '@/ui/NotificationBell'
import { FLAGS }           from '@/constants/feature-flags'

const DAYS  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function useDisplayName(): string {
  const [name, setName] = useState('')
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)kp_display=([^;]+)/)
    if (m) {
      let v = m[1]
      for (let i = 0; i < 4; i++) {
        try { const prev = v; v = decodeURIComponent(v); if (v === prev) break } catch { break }
      }
      setName(v)
    }
  }, [])
  return name
}

function useGreeting(): string {
  const [g, setG] = useState('Good day')
  useEffect(() => {
    const h = new Date().getHours()
    setG(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
  }, [])
  return g
}

export default function DashboardPage() {
  const { today }     = useDayKey()
  const now           = new Date()
  const displayName   = useDisplayName()
  const greeting      = useGreeting()

  const overnightMsg = usePlannerStore(s => s.overnightMsg)
  const clearMsg     = usePlannerStore(s => s.clearOvernightMsg)
  const allTasks     = usePlannerStore(s => s.tasks)
  const tasks        = useMemo(() => allTasks.filter(t => t.date === today && !t.cancelledAt), [allTasks, today])
  const done         = tasks.filter(t => t.done)
  const mood         = usePlannerStore(s => s.mood[today])
  const cfg          = usePlannerStore(s => s.cfg)
  const pinnedTaskId = usePlannerStore(s => s.pinnedTaskId)
  const toggleTaskRetro = usePlannerStore(s => s.toggleTaskRetro)
  const submitRetroFix  = usePlannerStore(s => s.submitRetroFix)
  const retroFixedDays  = usePlannerStore(s => s.retroFixedDays)
  const streak       = usePlannerStore(s => s.streak)
  const allGoals     = usePlannerStore(s => s.goals)

  const [fixDismissed, setFixDismissed] = useState(false)
  const [retroRewardTitle, setRetroRewardTitle] = useState('')
  const [retroRewardPts, setRetroRewardPts] = useState('')
  const [streakHistoryOpen, setStreakHistoryOpen] = useState(false)

  const prevDay      = getPrevDayKey(today)
  const yesterdayTasks = useMemo(() => allTasks.filter(t => t.date === prevDay), [allTasks, prevDay])
  // Show even when auto-submitted — user may still have missed checkoffs.
  // Only hide once they've explicitly submitted the retro panel (retroFixedDays) or dismissed it.
  const showRetroFix = yesterdayTasks.length > 0
    && !fixDismissed
    && !retroFixedDays[prevDay]
    && now.getHours() < cfg.cutoffHour

  const earned  = todayEarned(done, mood, cfg, goalPtsEarnedOn(allGoals, today))
  const target  = todayTarget(tasks)
  const pct     = target > 0 ? Math.round(earned / target * 100) : 0
  const quote   = getDailyQuote(today, now.getHours() < 17 ? 'morning' : 'evening')

  const focusTask = tasks.find(t => !t.done && t.id === pinnedTaskId)
    ?? tasks.find(t => !t.done && (t.isSpecial || t.priority === 'high'))
    ?? tasks.find(t => !t.done)

  const managerMsg = getManagerMessage(pct, tasks.length, cfg.tone, mood, today)

  return (
    <div className="relative">
      {/* Ambient aurora background now lives once in app/(tabs)/layout.tsx,
          shared across every tab as the rollout proceeds (see project.md's
          "UI Redesign Initiative") — no longer duplicated per-page here. */}
      <div className="relative" style={{ zIndex: 1 }}>
        <MorningQuoteOverlay today={today} />
        {/* Overnight banner */}
        {overnightMsg && (
          <div className="bg-[var(--blue-bg)] border border-[var(--blue)] rounded-[10px] p-3 mb-3.5 text-xs text-[var(--blue)] flex justify-between items-center">
            <span>{overnightMsg}</span>
            <button onClick={clearMsg} className="btn-icon">×</button>
          </div>
        )}

        {/* Header */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="vx-eyebrow">{greeting}</div>
              <h1 className="text-[26px] font-extrabold tracking-tight vx-text-hero" style={{ fontFamily: 'inherit' }}>
                {displayName ? `${displayName}'s Planner` : 'My Planner'}
              </h1>
              <p className="text-xs text-[var(--text2)] mt-0.5">
                {DAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()}
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {FLAGS.FRIENDS && (
                <div className="lg:hidden flex items-center">
                  <NotificationBell />
                </div>
              )}
              <button
                onClick={() => setStreakHistoryOpen(true)}
                className="vx-streak-orb"
                title="View streak history"
              >
                <span className="vx-flame">🔥</span>
                <span className="vx-n vx-text-amber">{streak}</span>
              </button>
            </div>
          </div>
          <p className="text-[11.5px] italic mt-2.5 leading-relaxed max-w-[480px]" style={{ color: 'var(--vx-fg-3)' }}>
            &ldquo;{quote.t}&rdquo; <span style={{ color: 'var(--vx-fg-4)' }}>— {quote.a}</span>
          </p>
        </motion.div>

        {/* Yesterday reconciliation — grace window until next cutoff */}
        {showRetroFix && (
          <Accordion variant="vx" title={
            <div className="flex items-center justify-between flex-1 gap-2">
              <span>📝 Yesterday ({prevDay}) — Fix Missed Check-offs</span>
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); setFixDismissed(true) }}
                className="btn-icon"
              >
                ×
              </span>
            </div>
          }>
            <p className="text-xs text-[var(--text2)] mb-2.5">
              Forgot to tick something off before the cutoff? Toggle it here, then submit to update yesterday&apos;s history, streak and XP.
            </p>
            {yesterdayTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2.5 p-2.5 rounded-[10px] border border-[var(--vx-border)] bg-[var(--vx-surface-tint)] mb-1.5">
                <button
                  onClick={() => {
                    const result = toggleTaskRetro(t.id)
                    if (result) showToast(`+${result.pts} RXP · +${result.walletPts} 🪙`)
                    else showToast('Unchecked — points reversed.')
                  }}
                  className={`w-[21px] h-[21px] rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center text-[11px] transition-all ${t.done ? 'bg-[var(--vx-emerald)] border-[var(--vx-emerald)] text-white' : 'border-[var(--border2)] text-transparent'}`}
                >
                  {t.done ? '✓' : ''}
                </button>
                <span className={`text-[13px] flex-1 ${t.done ? 'line-through' : ''}`}>{t.title}</span>
                <span className={`text-xs font-semibold ${t.done ? 'text-[var(--vx-emerald)]' : 'text-[var(--text3)]'}`}>+{calcPts(t)}</span>
              </div>
            ))}

            <div className="border-t border-[var(--vx-border)] mt-2.5 pt-2.5">
              <div className="text-xs text-[var(--text2)] mb-2">Did you redeem a reward yesterday? (optional)</div>
              <div className="flex gap-2 flex-wrap items-center mb-3">
                <input
                  value={retroRewardTitle}
                  onChange={e => setRetroRewardTitle(e.target.value)}
                  placeholder="Reward name..."
                  className="flex-1 min-w-[160px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--vx-border)] bg-[var(--vx-surface-tint)] text-[var(--text)] outline-none"
                />
                <input
                  type="number"
                  value={retroRewardPts}
                  onChange={e => setRetroRewardPts(e.target.value)}
                  placeholder="Pts redeemed"
                  min={0}
                  className="w-[110px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--vx-border)] bg-[var(--vx-surface-tint)] text-[var(--text)] outline-none"
                />
              </div>
              <button
                onClick={() => {
                  const cost = +retroRewardPts || 0
                  const reward = retroRewardTitle.trim() && cost > 0 ? { title: retroRewardTitle.trim(), cost } : undefined
                  const result = submitRetroFix(prevDay, reward)
                  if (!result.ok) { showToast('Not enough wallet pts for that reward.'); return }
                  setRetroRewardTitle(''); setRetroRewardPts('')
                  showToast(`Yesterday’s changes saved.${reward ? ` 🎁 ${reward.title} redeemed.` : ''}`)
                }}
                className="vx-submit-btn"
                style={{ padding: '0.625rem' }}
              >
                ✓ Submit Changes
              </button>
            </div>
          </Accordion>
        )}

        <MoodBar today={today} />

        {/* Today's Focus — the task to do matters more than progress stats, so it leads */}
        <motion.div
          className="vx-glass flex items-center gap-2"
          style={{ background: 'var(--color-accent-dim)', borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)' }}
          initial={{ opacity: 0, y: 22, scale: 0.97, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.14 }}
        >
          <div className="flex-1 min-w-0">
            <div className="vx-eyebrow">🎯 Today's Focus</div>
            <div className="text-[15px] font-semibold mt-1 truncate">{focusTask?.title ?? (done.length === tasks.length && tasks.length > 0 ? 'All done!' : '—')}</div>
            <div className="text-[11px] text-[var(--text3)] mt-1">
              {focusTask ? (focusTask.isSpecial ? '⭐ special' : ({ high: 'High priority', med: 'Medium priority', low: 'Low priority', special: '⭐ special' } as Record<string,string>)[focusTask.priority]) : ''}
              {focusTask?.level ? ` · ${focusTask.level}` : ''}
            </div>
          </div>
        </motion.div>

        {/* Day progress */}
        <motion.div
          className="vx-glass flex items-center gap-5"
          initial={{ opacity: 0, y: 22, scale: 0.97, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.21 }}
        >
          <GradientRing pct={pct} />
          <div className="flex-1 min-w-0">
            {/* "Points today" and "Done today" were their own separate stat
                tiles below (see StatGrid) even though this card already
                showed the points progress — redundant. Task count now folds
                into this same line instead of a standalone tile. Both this
                line and the heading above it are +2px over their previous
                size per explicit request. */}
            <div className="text-[15.5px] font-semibold mb-1.5">Day progress</div>
            <div className="text-[13.5px] text-[var(--text3)] leading-relaxed">
              {pct >= 100
                ? "Target hit — submit whenever you're ready."
                : (
                  <>
                    {earned}/{target} pts &amp; {done.length}/{tasks.length} tasks so far.<br />
                    Keep the streak alive.
                  </>
                )}
            </div>
          </div>
        </motion.div>

        <StatGrid today={today} onStreakClick={() => setStreakHistoryOpen(true)} />
        <RankProgress />

        {/* Water Tracker now leads Focus Time — per explicit reordering
            request. */}
        <WaterTrackerCard today={today} />

        <FocusTimeCard today={today} />

        <LifeScoreCard />

        {/* Calm Down floating button + breathing overlay — Dashboard only,
            fixed position (doesn't move on scroll). */}
        <CalmDownButton />

        {/* Manager */}
        <motion.div
          className="vx-glass flex gap-3 items-start"
          initial={{ opacity: 0, y: 22, scale: 0.97, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.7 }}
        >
          <div className="vx-manager-avatar">⚡</div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[var(--text2)] uppercase tracking-wide">{cfg.managerName}</span>
              <span className="text-[11px] text-[var(--text3)] ml-auto">{cfg.tone}</span>
            </div>
            <div className="text-[13px] text-[var(--text2)] leading-relaxed mt-1">{managerMsg}</div>
          </div>
        </motion.div>

        <SubmitArea today={today} />

        {/* Streak history */}
        <StreakHistoryModal open={streakHistoryOpen} onClose={() => setStreakHistoryOpen(false)} />
      </div>
    </div>
  )
}
