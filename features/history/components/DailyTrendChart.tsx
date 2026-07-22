'use client'
import { useMemo, useState } from 'react'
import { usePlannerStore } from '@/store'
import {
  buildDailyTrend, filterTrendRange, findBestWindow, compareToBaseline,
  type DailyTrendPoint,
} from '@/lib/engine/historyChart'

const RANGES: Array<{ label: string; days: number | null }> = [
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: null },
]

const W = 640
const H = 200
const PAD_L = 32
const PAD_B = 24
const PAD_T = 10

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
    return <div className="text-[13px] text-[var(--text3)] py-6 text-center">No history yet — submit a few days to see your trend.</div>
  }

  const maxPts = Math.max(...trend.map(p => Math.max(p.pts, p.target)), 10)
  const plotW  = W - PAD_L - 8
  const plotH  = H - PAD_T - PAD_B
  const barW   = Math.max(2, Math.min(18, plotW / trend.length - 2))
  const xFor   = (i: number) => PAD_L + (i + 0.5) * (plotW / trend.length)
  const yFor   = (v: number) => PAD_T + plotH - (v / maxPts) * plotH

  const targetPath = trend
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.target)}`)
    .join(' ')

  const bestInRange = bestWeek && trend.some(p => p.date === bestWeek.startDate)
    ? bestWeek
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="text-[12px] text-[var(--text2)]">
          {baseline.deltaPct == null
            ? `Last ${RANGES[rangeIdx].label}: ${baseline.currentTotal} pts logged so far.`
            : `This week: ${baseline.currentTotal} pts (${baseline.deltaPct >= 0 ? '+' : ''}${baseline.deltaPct}% vs. your last-4-week avg)`}
        </div>
        <div className="flex gap-1">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRangeIdx(i)}
              className={`text-[11px] px-2 py-1 rounded-full border ${
                i === rangeIdx
                  ? 'bg-[var(--green-mid)] text-white border-[var(--green-mid)]'
                  : 'border-[var(--border2)] text-[var(--text3)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {bestWeek && (
        <div className="text-[11px] text-[var(--amber)] mb-1.5">
          🏆 Best 7-day stretch: {bestWeek.startDate} → {bestWeek.endDate} ({bestWeek.total} pts)
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Daily points trend">
        {/* y-axis gridlines */}
        {[0, 0.5, 1].map(f => (
          <line key={f} x1={PAD_L} x2={W - 8} y1={PAD_T + plotH * (1 - f)} y2={PAD_T + plotH * (1 - f)}
            stroke="var(--border)" strokeWidth={1} />
        ))}

        {/* best-week shaded region */}
        {bestInRange && (() => {
          const startI = trend.findIndex(p => p.date === bestInRange.startDate)
          const endI   = trend.findIndex(p => p.date === bestInRange.endDate)
          if (startI < 0 || endI < 0) return null
          const x0 = xFor(startI) - barW
          const x1 = xFor(endI) + barW
          return <rect x={x0} y={PAD_T} width={x1 - x0} height={plotH} fill="var(--amber)" opacity={0.08} />
        })()}

        {/* bars */}
        {trend.map((p, i) => (
          <rect
            key={p.date}
            x={xFor(i) - barW / 2}
            y={yFor(p.pts)}
            width={barW}
            height={Math.max(0, PAD_T + plotH - yFor(p.pts))}
            fill={p.metTarget ? 'var(--green-mid)' : 'var(--red)'}
            opacity={selected && selected.date !== p.date ? 0.35 : 0.85}
            onClick={() => setSelected(selected?.date === p.date ? null : p)}
            className="cursor-pointer"
          />
        ))}

        {/* target line */}
        <path d={targetPath} fill="none" stroke="var(--text3)" strokeWidth={1.5} strokeDasharray="3 3" />

        {/* flag markers */}
        {trend.map((p, i) => {
          const flag = p.frozen ? '❄' : p.rest ? '🟡' : p.auto ? '•' : p.late ? '!' : null
          if (!flag) return null
          return (
            <text key={`f-${p.date}`} x={xFor(i)} y={H - 6} textAnchor="middle" fontSize={9}>
              {flag}
            </text>
          )
        })}
      </svg>

      {selected && (
        <div className="mt-2 text-[12px] bg-[var(--bg2)] border border-[var(--border)] rounded-[8px] px-3 py-2 flex items-center justify-between">
          <span>{selected.date}</span>
          <span className={selected.metTarget ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
            {selected.pts} / {selected.target} pts
          </span>
          <span className="text-[var(--text3)]">
            {selected.frozen && '❄ Frozen '}
            {selected.rest && '🟡 Rest '}
            {selected.auto && '• Auto '}
            {selected.late && '! Late'}
          </span>
        </div>
      )}
    </div>
  )
}
