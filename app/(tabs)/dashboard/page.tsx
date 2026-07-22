'use client'
import { useMemo, useState, useEffect } from 'react'
import { useDayKey }       from '@/hooks/useDayKey'
import { usePlannerStore } from '@/store'
import { MoodBar }         from '@/features/dashboard/components/MoodBar'
import { StatGrid }        from '@/features/dashboard/components/StatGrid'
import { RankProgress }    from '@/features/dashboard/components/RankProgress'
import { ProgressBar }     from '@/ui/ProgressBar'
import { SubmitArea }      from '@/features/dashboard/components/SubmitArea'
import { Accordion }       from '@/ui/Accordion'
import { showToast }       from '@/ui/Toast'
import { todayEarned, todayTarget, calcPts } from '@/lib/engine/scoring'
import { getPrevDayKey } from '@/lib/engine/cutoff'
import { getDailyQuote }   from '@/lib/engine/quotes'
import { getManagerMessage } from '@/lib/engine/manager'
import { StreakHistoryModal } from '@/features/dashboard/components/StreakHistoryModal'
import { MorningQuoteOverlay } from '@/features/dashboard/components/MorningQuoteOverlay'
import { LifeScoreCard }   from '@/features/dashboard/components/LifeScoreCard'

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

export default function DashboardPage() {
  const { today }     = useDayKey()
  const now           = new Date()
  const displayName   = useDisplayName()

  const overnightMsg = usePlannerStore(s => s.overnightMsg)
  const clearMsg     = usePlannerStore(s => s.clearOvernightMsg)
  const allTasks     = usePlannerStore(s => s.tasks)
  const tasks        = useMemo(() => allTasks.filter(t => t.date === today), [allTasks, today])
  const done         = tasks.filter(t => t.done)
  const mood         = usePlannerStore(s => s.mood[today])
  const cfg          = usePlannerStore(s => s.cfg)
  const pinnedTaskId = usePlannerStore(s => s.pinnedTaskId)
  const toggleTaskRetro = usePlannerStore(s => s.toggleTaskRetro)
  const submitRetroFix  = usePlannerStore(s => s.submitRetroFix)
  const retroFixedDays  = usePlannerStore(s => s.retroFixedDays)
  const streak       = usePlannerStore(s => s.streak)

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

  const earned  = todayEarned(done, mood, cfg)
  const target  = todayTarget(tasks)
  const pct     = target > 0 ? Math.round(earned / target * 100) : 0
  const quote   = getDailyQuote(today, now.getHours() < 17 ? 'morning' : 'evening')

  const focusTask = tasks.find(t => !t.done && t.id === pinnedTaskId)
    ?? tasks.find(t => !t.done && (t.isSpecial || t.priority === 'high'))
    ?? tasks.find(t => !t.done)

  const managerMsg = getManagerMessage(pct, tasks.length, cfg.tone, mood, today)

  return (
    <div>
      <MorningQuoteOverlay today={today} />
      {/* Overnight banner */}
      {overnightMsg && (
        <div className="bg-[var(--blue-bg)] border border-[var(--blue)] rounded-[10px] p-3 mb-3.5 text-xs text-[var(--blue)] flex justify-between items-center">
          <span>{overnightMsg}</span>
          <button onClick={clearMsg} className="btn-icon">×</button>
        </div>
      )}

      {/* Open Day header */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-semibold">{displayName ? `${displayName}'s Planner` : 'My Planner'}</h1>
            <p className="text-xs text-[var(--text2)] mt-0.5">
              {DAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setStreakHistoryOpen(true)}
              className="relative flex items-center justify-center w-14 h-14"
              title="View streak history"
            >
              <span className="absolute text-[34px] opacity-25 select-none leading-none">🔥</span>
              <span className="relative text-[20px] font-bold">{streak}</span>
            </button>
          </div>
        </div>
        <p className="text-[11px] italic text-[var(--text3)] mt-2 leading-relaxed">
          &ldquo;{quote.t}&rdquo; <span className="opacity-70">— {quote.a}</span>
        </p>
      </div>

      {/* Yesterday reconciliation — grace window until next cutoff */}
      {showRetroFix && (
        <Accordion title={
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
            <div key={t.id} className="flex items-center gap-2.5 p-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] mb-1.5">
              <button
                onClick={() => {
                  const result = toggleTaskRetro(t.id)
                  if (result) showToast(`+${result.pts} RXP · +${result.walletPts} 🪙`)
                  else showToast('Unchecked — points reversed.')
                }}
                className={`w-[21px] h-[21px] rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center text-[11px] transition-all ${t.done ? 'bg-[var(--green-mid)] border-[var(--green-mid)] text-white' : 'border-[var(--border2)] text-transparent'}`}
              >
                {t.done ? '✓' : ''}
              </button>
              <span className={`text-[13px] flex-1 ${t.done ? 'line-through' : ''}`}>{t.title}</span>
              <span className={`text-xs font-semibold ${t.done ? 'text-[var(--green)]' : 'text-[var(--text3)]'}`}>+{calcPts(t)}</span>
            </div>
          ))}

          <div className="border-t border-[var(--border)] mt-2.5 pt-2.5">
            <div className="text-xs text-[var(--text2)] mb-2">Did you redeem a reward yesterday? (optional)</div>
            <div className="flex gap-2 flex-wrap items-center mb-3">
              <input
                value={retroRewardTitle}
                onChange={e => setRetroRewardTitle(e.target.value)}
                placeholder="Reward name..."
                className="flex-1 min-w-[160px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none"
              />
              <input
                type="number"
                value={retroRewardPts}
                onChange={e => setRetroRewardPts(e.target.value)}
                placeholder="Pts redeemed"
                min={0}
                className="w-[110px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none"
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
              className="w-full py-2.5 rounded-[10px] text-sm font-semibold bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]"
            >
              ✓ Submit Changes
            </button>
          </div>
        </Accordion>
      )}

      <MoodBar today={today} />

      {/* Today's Focus — the task to do matters more than progress stats, so it leads */}
      <div className="card mb-3.5 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text3)]">Today's Focus</div>
          <div className="text-[13px] font-medium mt-0.5 truncate">{focusTask?.title ?? (done.length === tasks.length && tasks.length > 0 ? 'All done!' : '—')}</div>
          <div className="text-[11px] text-[var(--text3)] mt-0.5">
            {focusTask ? (focusTask.isSpecial ? '⭐' : ({ high: 'H', med: 'M', low: 'L', special: '⭐' } as Record<string,string>)[focusTask.priority]) : ''}
            {focusTask?.level ? ` · ${focusTask.level}` : ''}
          </div>
        </div>
      </div>

      {/* Day progress */}
      <div className="card mb-3.5">
        <div className="flex justify-between text-xs text-[var(--text2)] mb-1.5">
          <span>Day progress</span>
          <span>{pct}%</span>
        </div>
        <ProgressBar value={pct} />
      </div>

      <StatGrid today={today} onStreakClick={() => setStreakHistoryOpen(true)} />
      <RankProgress />

      <LifeScoreCard />

      {/* Manager */}
      <div className="card mb-3.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[15px]">⚡</span>
          <span className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide">{cfg.managerName}</span>
          <span className="text-[11px] text-[var(--text3)] ml-auto">{cfg.tone}</span>
        </div>
        <div className="text-[13px] text-[var(--text2)] leading-relaxed">{managerMsg}</div>
      </div>

      <SubmitArea today={today} />

      {/* Streak history */}
      <StreakHistoryModal open={streakHistoryOpen} onClose={() => setStreakHistoryOpen(false)} />
    </div>
  )
}
