'use client'
import { useMemo, useState } from 'react'
import { usePlannerStore } from '@/store'
import {
  buildDailyTrend, filterTrendRange, findBestWindow, compareToBaseline,
  type DailyTrendPoint,
} from '@/lib/engine/historyChart'

const RANGES: Array<{ label: string; days: number | null }> = [
  { label: '7D',  days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: null },
]

const W = 640
const H = 220
const PAD_L = 40
const PAD_R = 10
const PAD_B = 34
const PAD_T = 12

function shortDate(d: string): string {
  const dt = new Date(`${d}T12:00:00`)
  return `${dt.getDate()}/${dt.getMonth() + 1}`
}

export function DailyTrendChart() {
  const history = usePlannerStore(s => s.history)
  const cfg     = usePlannerStore(s => s.cfg)
  const [rangeIdx, setRangeIdx] = useState(0)
  const [selected, setSelected] = useState<DailyTrendPoint | null>(null)

  const fullTrend = useMemo(() => buildDailyTrend(history, cfg), [history, cfg])
  const trend     = useMemo(() => filterTrendRange(fullTrend, RANGES[rangeIdx].days), [fullTrend, rangeIdx])
  const bestWeek  = useMemo(() => findBestWindow(fullTrend, 7), [fullTrend])
  const baseline  = useMemo(() => compareToBaseline(fullTrend, 7, 4), [fullTrend])

  if (trend.length === 0) {
    return <div className="text-[13px] py-6 text-center" style={{ color: 'var(--vx-fg-4)' }}>No history yet — submit a few days to see your trend.</div>
  }

  const maxPts = Math.max(...trend.map(p => Math.max(p.pts, p.target)), 10)
  const niceMax = Math.ceil(maxPts / 10) * 10
  const plotW  = W - PAD_L - PAD_R
  const plotH  = H - PAD_T - PAD_B
  const slot   = plotW / trend.length
  const barW   = Math.max(2, Math.min(20, slot - 3))
  const xFor   = (i: number) => PAD_L + (i + 0.5) * slot
  const yFor   = (v: number) => PAD_T + plotH - (v / niceMax) * plotH

  const targetPath = trend.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.target)}`).join(' ')
  const metCount = trend.filter(p => p.metTarget).length

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="text-[12px]" style={{ color: 'var(--vx-fg-3)' }}>
          {baseline.deltaPct == null
            ? `Last ${RANGES[rangeIdx].label}: ${baseline.currentTotal} pts logged.`
            : `This week: ${baseline.currentTotal} pts (${baseline.deltaPct >= 0 ? '+' : ''}${baseline.deltaPct}% vs your last-4-week avg)`}
        </div>
        <div className="flex gap-1">
          {RANGES.map((r, i) => (
            <button key={r.label} onClick={() => setRangeIdx(i)}
              className={`vx-pill text-[11px] ${i === rangeIdx ? 'vx-tinted' : ''}`} data-tone={i === rangeIdx ? 'emerald' : undefined}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-2 text-[11px] flex-wrap" style={{ color: 'var(--vx-fg-3)' }}>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'var(--vx-emerald)' }} /> Hit your goal</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'var(--red)' }} /> Below goal</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--vx-fg-4)' }} /> Daily goal</span>
        <span style={{ color: 'var(--vx-fg-4)' }}>· {metCount}/{trend.length} days hit</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Daily points trend">
        {/* y-axis gridlines + labels */}
        {[0, 0.5, 1].map(f => {
          const y = PAD_T + plotH * (1 - f)
          return (
            <g key={f}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="var(--vx-border)" strokeWidth={1} />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--vx-fg-4)">{Math.round(niceMax * f)}</text>
            </g>
          )
        })}

        {/* bars (rounded) */}
        {trend.map((p, i) => {
          const y = yFor(p.pts)
          const h = Math.max(0, PAD_T + plotH - y)
          return (
            <rect key={p.date}
              x={xFor(i) - barW / 2} y={y} width={barW} height={h} rx={Math.min(3, barW / 2)}
              fill={p.metTarget ? 'var(--vx-emerald)' : 'var(--red)'}
              opacity={selected && selected.date !== p.date ? 0.3 : 0.9}
              onClick={() => setSelected(selected?.date === p.date ? null : p)}
              className="cursor-pointer" />
          )
        })}

        {/* daily-goal line */}
        <path d={targetPath} fill="none" stroke="var(--vx-fg-3)" strokeWidth={1.5} strokeDasharray="4 3" />

        {/* x-axis date labels: first, middle, last */}
        {[0, Math.floor((trend.length - 1) / 2), trend.length - 1]
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .map(i => (
            <text key={`x-${i}`} x={xFor(i)} y={H - 14} textAnchor="middle" fontSize={9} fill="var(--vx-fg-4)">{shortDate(trend[i].date)}</text>
          ))}

        {/* protected-day markers under the axis */}
        {trend.map((p, i) => {
          const flag = p.frozen ? '❄' : p.rest ? '🟡' : null
          if (!flag) return null
          return <text key={`f-${p.date}`} x={xFor(i)} y={H - 2} textAnchor="middle" fontSize={9}>{flag}</text>
        })}
      </svg>

      {bestWeek && (
        <div className="text-[11px] mt-1.5" style={{ color: 'var(--vx-amber)' }}>🏆 Best 7-day stretch: {shortDate(bestWeek.startDate)}–{shortDate(bestWeek.endDate)} ({bestWeek.total} pts)</div>
      )}

      {selected ? (
        <div className="vx-tile mt-2 text-[12px] px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
          <span className="font-medium">{selected.date}</span>
          <span style={{ color: selected.metTarget ? 'var(--vx-emerald)' : 'var(--red)' }}>{selected.pts} / {selected.target} pts</span>
          <span style={{ color: 'var(--vx-fg-4)' }}>
            {selected.frozen && '❄ Frozen '}{selected.rest && '🟡 Rest '}{selected.auto && '• Auto '}{selected.late && '! Late'}
            {!selected.frozen && !selected.rest && !selected.auto && !selected.late && (selected.metTarget ? '✓ Goal met' : 'Below goal')}
          </span>
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-center" style={{ color: 'var(--vx-fg-4)' }}>Tap a bar for that day&apos;s detail.</div>
      )}
    </div>
  )
}
