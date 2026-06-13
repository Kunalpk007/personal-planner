'use client'
import { useMemo, useState } from 'react'
import { useDayKey }       from '@/hooks/useDayKey'
import { usePlannerStore } from '@/store'
import { MoodBar }         from '@/features/dashboard/components/MoodBar'
import { StatGrid }        from '@/features/dashboard/components/StatGrid'
import { RankProgress }    from '@/features/dashboard/components/RankProgress'
import { ProgressBar }     from '@/ui/ProgressBar'
import { SubmitArea }      from '@/features/dashboard/components/SubmitArea'
import { Accordion }       from '@/ui/Accordion'
import { Modal }           from '@/ui/Modal'
import { showToast }       from '@/ui/Toast'
import { todayEarned, todayTarget, calcPts } from '@/lib/engine/scoring'
import { getPrevDayKey }   from '@/lib/engine/cutoff'
import { getDailyQuote }   from '@/lib/engine/quotes'
import { getManagerMessage } from '@/lib/engine/manager'

const DAYS  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function DashboardPage() {
  const { today } = useDayKey()
  const now       = new Date()

  const overnightMsg = usePlannerStore(s => s.overnightMsg)
  const clearMsg     = usePlannerStore(s => s.clearOvernightMsg)
  const allTasks     = usePlannerStore(s => s.tasks)
  const tasks        = useMemo(() => allTasks.filter(t => t.date === today), [allTasks, today])
  const done         = tasks.filter(t => t.done)
  const mood         = usePlannerStore(s => s.mood[today])
  const cfg          = usePlannerStore(s => s.cfg)
  const freezeTokens = usePlannerStore(s => s.freezeTokens)
  const bufferXP     = usePlannerStore(s => s.bufferXP)
  const pinnedTaskId = usePlannerStore(s => s.pinnedTaskId)
  const useFreeze    = usePlannerStore(s => s.useFreeze)
  const useBuffer    = usePlannerStore(s => s.useBuffer)
  const toggleTaskRetro = usePlannerStore(s => s.toggleTaskRetro)
  const streak       = usePlannerStore(s => s.streak)
  const isSettledToday = usePlannerStore(s => !!s.submittedDays[today])

  const [fixDismissed, setFixDismissed] = useState(false)
  const [bufferModalOpen, setBufferModalOpen] = useState(false)
  const [freezeModalOpen, setFreezeModalOpen] = useState(false)

  const prevDay      = getPrevDayKey(today)
  const yesterdayTasks = useMemo(() => allTasks.filter(t => t.date === prevDay), [allTasks, prevDay])
  const bufferUseAmount = Math.min(bufferXP, 50)

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
            <h1 className="text-[19px] font-semibold">Kunal&apos;s Planner</h1>
            <p className="text-xs text-[var(--text2)] mt-0.5">
              {DAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()}
            </p>
          </div>
          <div className="relative flex items-center justify-center w-14 h-14 flex-shrink-0">
            <span className="absolute text-[34px] opacity-25 select-none leading-none">🔥</span>
            <span className="relative text-[20px] font-bold">{streak}</span>
          </div>
        </div>
        <p className="text-[11px] italic text-[var(--text3)] mt-2 leading-relaxed">
          &ldquo;{quote.t}&rdquo; <span className="opacity-70">— {quote.a}</span>
        </p>
      </div>

      {/* Yesterday reconciliation — grace window until next cutoff */}
      {yesterdayTasks.length > 0 && !fixDismissed && (
        <Accordion title={
          <div className="flex items-center justify-between flex-1 gap-2">
            <span>📝 Yesterday ({prevDay}) — fix missed check-offs</span>
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
            Forgot to tick something off before the cutoff? Toggle it here — points and history will update.
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
        </Accordion>
      )}

      <MoodBar today={today} />
      <StatGrid today={today} />
      <RankProgress />

      {/* Day progress */}
      <div className="mb-3.5">
        <div className="flex justify-between text-xs text-[var(--text2)] mb-1.5">
          <span>Day progress</span>
          <span>{pct}%</span>
        </div>
        <ProgressBar value={pct} />
      </div>

      {/* Power row */}
      <div className="flex gap-2.5 mb-3.5 flex-wrap">
        <PowerCard
          label="Buffer XP" value={bufferXP} sub="banked overflow"
          action={bufferXP > 0 ? () => setBufferModalOpen(true) : undefined}
          actionLabel="Use"
          actionColor="green"
        />
        <PowerCard
          label="Freezes" value={freezeTokens} sub={isSettledToday ? 'today already protected' : 'protect streak'}
          action={(freezeTokens > 0 && !isSettledToday) ? () => setFreezeModalOpen(true) : undefined}
          actionLabel="Use"
          actionColor="amber"
        />
        <div className="card flex-1 min-w-[150px] flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text3)]">Today's Focus</div>
            <div className="text-[13px] font-medium mt-0.5 truncate">{focusTask?.title ?? (done.length === tasks.length && tasks.length > 0 ? 'All done!' : '—')}</div>
            <div className="text-[11px] text-[var(--text3)] mt-0.5">
              {focusTask ? (focusTask.isSpecial ? '⭐' : ({ high: 'H', med: 'M', low: 'L', special: '⭐' } as Record<string,string>)[focusTask.priority]) : ''}
              {focusTask?.level ? ` · ${focusTask.level}` : ''}
            </div>
          </div>
        </div>
      </div>

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

      {/* Buffer XP confirmation */}
      <Modal open={bufferModalOpen} onClose={() => setBufferModalOpen(false)} title="🪫 Use Buffer XP">
        <p className="text-sm text-[var(--text2)] mb-3">
          Convert <strong>{bufferUseAmount} Buffer XP</strong> into <strong>+{bufferUseAmount} Rank XP</strong>?
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setBufferModalOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
          <button
            onClick={() => { useBuffer(bufferUseAmount); setBufferModalOpen(false); showToast(`+${bufferUseAmount} Rank XP from buffer.`) }}
            className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]"
          >
            Use {bufferUseAmount} pts
          </button>
        </div>
      </Modal>

      {/* Freeze confirmation */}
      <Modal open={freezeModalOpen} onClose={() => setFreezeModalOpen(false)} title="❄ Use Streak Freeze">
        <p className="text-sm text-[var(--text2)] mb-3">
          Spend <strong>1 Streak Freeze</strong> to protect today&apos;s streak? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setFreezeModalOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
          <button
            onClick={() => { useFreeze(today); setFreezeModalOpen(false); showToast('❄ Freeze used. Streak protected.') }}
            className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--amber-bg)] text-[var(--amber)] border border-[#EF9F27]"
          >
            Use Freeze
          </button>
        </div>
      </Modal>
    </div>
  )
}

function PowerCard({
  label, value, sub, action, actionLabel, actionColor
}: {
  label: string; value: number; sub: string;
  action?: () => void; actionLabel?: string; actionColor?: 'green' | 'amber'
}) {
  const colors = {
    green: { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-mid)' },
    amber: { bg: 'var(--amber-bg)', color: 'var(--amber)', border: '#EF9F27' },
  }
  const c = colors[actionColor ?? 'green']
  return (
    <div className="card !p-3 flex-1 min-w-[150px] flex items-center justify-between gap-2">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-[var(--text3)]">{label}</div>
        <div className="text-[20px] font-semibold mt-0.5">{value}</div>
        <div className="text-[11px] text-[var(--text2)]">{sub}</div>
      </div>
      {action && (
        <button
          onClick={action}
          disabled={value <= 0}
          className="px-3 py-1.5 rounded-md text-xs font-medium border disabled:opacity-35"
          style={{ background: c.bg, color: c.color, borderColor: c.border }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
