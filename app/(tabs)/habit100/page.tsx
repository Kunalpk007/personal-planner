'use client'
import { useRouter } from 'next/navigation'
import { useDayKey } from '@/hooks/useDayKey'
import { useHabit100Bootstrap } from '@/hooks/useHabit100Bootstrap'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { SetupWizard } from '@/features/habit100/SetupWizard'
import { DayLogForm } from '@/features/habit100/DayLogForm'
import { CatchUpQueue } from '@/features/habit100/CatchUpQueue'
import { currentStreak, dayStats, programDayIndex } from '@/lib/habit100/scoring'

/** Consistency Tracker home — reached only by tapping the Dashboard's
 *  "Track Consistency" tile, not from the bottom nav (per explicit
 *  request: this is a fast input surface, not a destination tab). Shows
 *  the setup wizard on first visit, otherwise today's day log plus a
 *  minimal header and the History/Progress entry points — full stats/
 *  charts/grid live one tap deeper on Progress, by design. */
export default function Habit100HomePage() {
  const router = useRouter()
  const { today } = useDayKey()
  useHabit100Bootstrap()

  const meta = useHabit100Store(s => s.meta)
  const days = useHabit100Store(s => s.days)

  if (!meta) {
    return (
      <div>
        <BackToDashboard />
        <SetupWizard />
      </div>
    )
  }

  const dayIndex = Math.min(programDayIndex(meta.startDate, today), meta.totalDays)
  const streak = currentStreak(meta, Object.values(days), today)
  const todayPct = dayStats(meta, days[today]).pct

  return (
    <div className="pb-20">
      <BackToDashboard />

      <CatchUpQueue today={today} />

      <div className="vx-glass flex items-center justify-between mb-4">
        <div>
          <div className="vx-eyebrow">Day {dayIndex} / {meta.totalDays}</div>
          <div className="text-[12px] mt-1" style={{ color: 'var(--vx-fg-3)' }}>🔥 {streak}-day streak · {todayPct}% logged today</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push('/habit100/history')} className="vx-btn vx-btn-ghost text-xs">🕘 History</button>
          <button onClick={() => router.push('/habit100/progress')} className="vx-btn vx-btn-ghost text-xs">📊 Progress</button>
        </div>
      </div>

      <DayLogForm key={today} date={today} />
    </div>
  )
}

function BackToDashboard() {
  const router = useRouter()
  return (
    <button onClick={() => router.push('/dashboard')} className="vx-btn vx-btn-ghost text-xs mb-3" style={{ display: 'inline-flex' }}>
      ← Dashboard
    </button>
  )
}
