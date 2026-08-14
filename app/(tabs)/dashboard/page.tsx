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
import { RetroFixPanel }   from '@/features/dashboard/components/RetroFixPanel'
import { TomorrowTop3Card } from '@/features/dashboard/components/TomorrowTop3Card'
import { SundayReviewNudge } from '@/features/dashboard/components/SundayReviewNudge'
import { todayEarned, todayTarget } from '@/lib/engine/scoring'
import { goalPtsEarnedOn } from '@/lib/engine/goals'
import { getDailyQuote }   from '@/lib/engine/quotes'
import { getManagerMessage } from '@/lib/engine/manager'
import { StreakHistoryModal } from '@/features/dashboard/components/StreakHistoryModal'
import { MorningQuoteOverlay } from '@/features/dashboard/components/MorningQuoteOverlay'
import { MorningTop3Prompt } from '@/features/dashboard/components/MorningTop3Prompt'
import { LifeScoreModal }  from '@/features/dashboard/components/LifeScoreCard'
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
  const streak       = usePlannerStore(s => s.streak)
  const allGoals     = usePlannerStore(s => s.goals)

  const [streakHistoryOpen, setStreakHistoryOpen] = useState(false)
  const [lifeScoreOpen, setLifeScoreOpen] = useState(false)

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
        <MorningTop3Prompt today={today} />
        {/* Overnight banner */}
        {overnightMsg && (
          <div className="bg-[var(--blue-bg)] border border-[var(--blue)] rounded-[10px] p-3 mb-3.5 text-xs text-[var(--blue)] flex justify-between items-center">
            <span>{overnightMsg}</span>
            <button onClick={clearMsg} className="btn-icon">×</button>
          </div>
        )}

        {/* Sunday-evening nudge: the Weekly Review only fires as part of
            Submit My Day, so a Sunday you don't submit means it never shows
            at all — see SundayReviewNudge.tsx. */}
        <SundayReviewNudge today={today} />

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

        {/* Missed check-offs reconciliation — a two-step confirm+checklist
            modal (auto-opens, doesn't sit as a persistent banner), fixable
            until a fixed, non-configurable 12:00 PM the day after. See
            RetroFixPanel.tsx / lib/engine/retroFix.ts. */}
        <RetroFixPanel today={today} />

        {/* Priorities picked the night before via the end-of-day ritual —
            see EndOfDayRitual.tsx / project.md's "Time/attention tracking +
            weekly rituals". Renders nothing if none were picked for today. */}
        <TomorrowTop3Card today={today} />

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

        <StatGrid today={today} onLifeScoreClick={() => setLifeScoreOpen(true)} />
        <RankProgress />

        {/* Water Tracker now leads Focus Time — per explicit reordering
            request. */}
        <WaterTrackerCard today={today} />

        <FocusTimeCard today={today} />

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
        {/* Life Score detail — tap the 7D tile above to open (see StatGrid.tsx) */}
        <LifeScoreModal open={lifeScoreOpen} onClose={() => setLifeScoreOpen(false)} />
      </div>
    </div>
  )
}
