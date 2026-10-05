'use client'
import { useMemo, useState } from 'react'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { HabitGrid } from './HabitGrid'
import { useDebouncedSave } from '@/hooks/useDebouncedSave'
import {
  currentStreak, bestStreak, overallPct, weekPct, habitBreakdown, mostBrokenHabit,
  programDayIndex, checkNewMilestone, milestoneDays,
} from '@/lib/habit100/scoring'
import { formatDate, getWeekMonday, getNextDayKey } from '@/lib/engine/cutoff'
import type { Habit100Day, Habit100Meta } from '@/store/habit100/types'

/** Everything that's NOT fast daily input — grid, stats, habit breakdown,
 *  trend charts, weekly review, milestone badges, end-of-cycle report.
 *  Reached only via the "Progress" button from Home, per explicit request
 *  that viewing progress is a distraction from the tracker's real job
 *  (quick daily capture). */
export function ProgressView({ today }: { today: string }) {
  const meta = useHabit100Store(s => s.meta)
  const days = useHabit100Store(s => s.days)
  const weeks = useHabit100Store(s => s.weeks)
  const saveWeeklyReview = useHabit100Store(s => s.saveWeeklyReview)
  const unlockMilestone = useHabit100Store(s => s.unlockMilestone)

  const dayList = useMemo(() => Object.values(days), [days])
  const weekMonday = useMemo(() => getWeekMonday(today), [today])
  const weekIndex = meta ? Math.ceil((Math.max(1, programDayIndex(meta.startDate, weekMonday))) / 7) : 1

  const [bannerShownFor, setBannerShownFor] = useState<number | null>(null)

  if (!meta) return null

  const dayIndex = Math.min(programDayIndex(meta.startDate, today), meta.totalDays)
  const streak = currentStreak(meta, dayList, today)
  const best = bestStreak(meta, dayList, today)
  const overall = overallPct(meta, dayList, today)
  const thisWeek = weekPct(meta, dayList, weekMonday, today)
  const breakdown = habitBreakdown(meta, dayList, today)
  const worst = mostBrokenHabit(meta, dayList, today)
  const week = weeks[weekIndex]

  const newMilestone = checkNewMilestone(dayIndex, meta.totalDays, meta.badges)
  if (newMilestone && bannerShownFor !== newMilestone) {
    // Unlock on render is safe here — unlockMilestone is idempotent (checks
    // meta.badges.includes already) and this only fires once per threshold
    // since meta.badges updates immediately after.
    unlockMilestone(newMilestone)
    setBannerShownFor(newMilestone)
  }

  return (
    <div className="flex flex-col gap-5 pb-20">
      <div className="vx-glass">
        <div className="text-[36px] font-extrabold leading-none" style={{ color: 'var(--vx-violet)' }}>
          {dayIndex}<span className="text-[16px] font-bold" style={{ color: 'var(--vx-fg-4)' }}> / {meta.totalDays}</span>
        </div>
        <div className="text-[11px] mt-2" style={{ color: 'var(--vx-fg-3)' }}>{meta.totalDays - dayIndex} days left</div>
        <div style={{ height: 6, borderRadius: 99, background: 'var(--vx-border)', overflow: 'hidden', marginTop: 10 }}>
          <div style={{ height: '100%', width: `${(dayIndex / meta.totalDays) * 100}%`, background: 'var(--vx-violet)', borderRadius: 99 }} />
        </div>
        {meta.goals.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-3">
            {meta.goals.map((g, i) => (
              <div key={i} className="habit100-row" style={{ padding: '6px 10px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--vx-cyan)', flexShrink: 0 }} />
                <span className="text-[12px]" style={{ color: 'var(--vx-fg-2)' }}>{g}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {newMilestone && (
        <div className="vx-glass" style={{ background: 'color-mix(in srgb, var(--vx-violet) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--vx-violet) 30%, transparent)' }}>
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: 20 }}>🏅</span>
            <div className="text-[12.5px]" style={{ color: 'var(--vx-fg-2)' }}>Milestone unlocked — <b style={{ color: 'var(--vx-violet)' }}>{newMilestone} days</b>.</div>
          </div>
        </div>
      )}

      {dayIndex >= meta.totalDays && <EndOfCycleReport meta={meta} days={dayList} today={today} />}

      <HabitGrid today={today} />

      <div className="grid grid-cols-4 gap-2.5">
        <StatCard label="Current streak" value={streak} sub={`best ${best}`} />
        <StatCard label="Overall" value={`${overall}%`} />
        <StatCard label="This week" value={`${thisWeek}%`} />
        <StatCard label="Milestones" value={meta.badges.length} sub={`of ${milestoneDays(meta.totalDays).length}`} />
      </div>

      <div className="vx-glass">
        <div className="vx-eyebrow mb-3">Habit breakdown</div>
        <div className="flex flex-col gap-2.5">
          {breakdown.map(b => (
            <div key={b.habitId}>
              <div className="flex justify-between text-[11.5px] mb-1">
                <span style={{ color: 'var(--vx-fg-2)' }}>{b.label}</span>
                <span style={{ color: b.pct >= 80 ? 'var(--color-accent)' : b.pct >= 50 ? 'var(--vx-amber)' : 'var(--red)', fontWeight: 700 }}>{b.pct}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: 'var(--vx-border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.pct}%`, borderRadius: 99, background: b.pct >= 80 ? 'var(--color-accent)' : b.pct >= 50 ? 'var(--vx-amber)' : 'var(--red)' }} />
              </div>
            </div>
          ))}
        </div>
        {worst && (
          <div className="mt-3 habit100-row" style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--red) 25%, transparent)' }}>
            <span style={{ fontSize: 14 }}>⚠</span>
            <div className="text-[12px]" style={{ color: 'var(--vx-fg-2)' }}>
              <b style={{ color: 'var(--red)' }}>{worst.label}</b> is most often skipped — missed {worst.missedCount} of {worst.totalCount} days.
            </div>
          </div>
        )}
      </div>

      <TrendCharts meta={meta} days={dayList} today={today} />

      <WeeklyReviewCard
        weekIndex={weekIndex}
        weekMonday={weekMonday}
        worked={week?.worked ?? ''}
        change={week?.change ?? ''}
        onSave={(worked, change) => saveWeeklyReview(weekIndex, worked, change)}
      />
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="vx-glass" style={{ padding: '0.8rem 0.75rem' }}>
      <div className="text-[18px] font-extrabold leading-none">{value}</div>
      <div className="text-[9.5px] mt-1.5" style={{ color: 'var(--vx-fg-3)' }}>{label}</div>
      {sub && <div className="text-[9px]" style={{ color: 'var(--vx-fg-4)' }}>{sub}</div>}
    </div>
  )
}

function TrendCharts({ meta, days, today }: { meta: Habit100Meta; days: Habit100Day[]; today: string }) {
  const points = useMemo(() => {
    const map = new Map(days.map(d => [d.date, d]))
    const out: Array<{ mood?: number; energy?: number; stress?: number; weight?: number }> = []
    let d = meta.startDate
    while (d <= today) {
      const day = map.get(d)
      out.push({ mood: day?.mood, energy: day?.energy, stress: day?.stress, weight: day?.weight })
      d = getNextDayKey(d)
    }
    return out.slice(-30)
  }, [meta, days, today])

  function sparkline(values: Array<number | undefined>, color: string, max = 10) {
    const known = values.map((v, i) => [i, v] as const).filter(([, v]) => v !== undefined) as Array<[number, number]>
    if (known.length < 2) return null
    const w = 400, h = 56
    const stepX = w / Math.max(1, values.length - 1)
    const pts = known.map(([i, v]) => `${i * stepX},${h - (v / max) * (h - 6) - 3}`).join(' ')
    return <polyline key={color} points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
  }

  const hasFeel = points.some(p => p.mood !== undefined || p.energy !== undefined || p.stress !== undefined)
  const hasWeight = points.some(p => p.weight !== undefined)
  if (!hasFeel && !hasWeight) return null

  return (
    <div className="vx-glass">
      <div className="vx-eyebrow mb-3">Trends</div>
      {hasFeel && (
        <>
          <div className="text-[11px] mb-1.5" style={{ color: 'var(--vx-fg-3)' }}>Mood · Energy · Stress (1-10)</div>
          <svg width="100%" height={56} viewBox="0 0 400 56" preserveAspectRatio="none">
            {sparkline(points.map(p => p.mood), 'var(--vx-cyan)')}
            {sparkline(points.map(p => p.energy), 'var(--vx-violet)')}
            {sparkline(points.map(p => p.stress), 'var(--vx-amber)')}
          </svg>
        </>
      )}
      {hasWeight && (
        <>
          <div className="text-[11px] mt-4 mb-1.5" style={{ color: 'var(--vx-fg-3)' }}>Weight (kg)</div>
          <svg width="100%" height={56} viewBox="0 0 400 56" preserveAspectRatio="none">
            {sparkline(points.map(p => p.weight), 'var(--color-accent)', Math.max(1, ...points.map(p => p.weight ?? 0)) || 1)}
          </svg>
        </>
      )}
    </div>
  )
}

function WeeklyReviewCard({ weekIndex, weekMonday, worked, change, onSave }: {
  weekIndex: number; weekMonday: string; worked: string; change: string; onSave: (worked: string, change: string) => void
}) {
  const w = useDebouncedSave(worked, v => onSave(v, c.value))
  const c = useDebouncedSave(change, v => onSave(w.value, v))
  return (
    <div className="vx-glass">
      <div className="flex items-center justify-between mb-2.5">
        <div className="vx-eyebrow">Week {weekIndex} review</div>
        <span className="text-[10.5px]" style={{ color: 'var(--vx-fg-4)' }}>from {formatDate(weekMonday)}</span>
      </div>
      <div className="flex flex-col gap-2">
        <textarea className="vx-field" placeholder="What worked this week?" value={w.value} onChange={e => w.onChange(e.target.value)} onBlur={w.onBlur} />
        <textarea className="vx-field" placeholder="What to change next week" value={c.value} onChange={e => c.onChange(e.target.value)} onBlur={c.onBlur} />
      </div>
    </div>
  )
}

function EndOfCycleReport({ meta, days, today }: { meta: Habit100Meta; days: Habit100Day[]; today: string }) {
  const breakdown = habitBreakdown(meta, days, today)
  const best = [...breakdown].sort((a, b) => b.pct - a.pct)[0]
  const worst = [...breakdown].sort((a, b) => a.pct - b.pct)[0]
  const weights = [...days].sort((a, b) => a.date.localeCompare(b.date)).map(d => d.weight).filter((w): w is number => w !== undefined)
  const weightDelta = weights.length >= 2 ? (weights[weights.length - 1] - weights[0]).toFixed(1) : null

  return (
    <div className="vx-glass" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--color-accent) 25%, transparent)' }}>
      <div className="text-[15px] font-extrabold mb-3">🎉 {meta.totalDays} days complete</div>
      <div className="flex flex-col gap-1.5 text-[12.5px]" style={{ color: 'var(--vx-fg-2)' }}>
        {best && <div>Best habit: <b>{best.label}</b> ({best.pct}%)</div>}
        {worst && <div>Needs the most work: <b>{worst.label}</b> ({worst.pct}%)</div>}
        <div>Longest streak: <b>{bestStreak(meta, days, today)}</b> days</div>
        {weightDelta !== null && <div>Weight change: <b>{weightDelta} kg</b></div>}
      </div>
    </div>
  )
}
