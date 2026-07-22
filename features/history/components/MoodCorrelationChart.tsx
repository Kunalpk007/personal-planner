'use client'
import { useMemo } from 'react'
import { usePlannerStore } from '@/store'
import { buildMoodCorrelation, summarizeMoodCorrelation, linearRegression } from '@/lib/engine/historyChart'

const MOOD_COLOR: Record<string, string> = {
  sick:      'var(--red)',
  neutral:   'var(--text3)',
  motivated: 'var(--green-mid)',
}
const MOOD_LABEL: Record<string, string> = { sick: '🤒 Sick', neutral: '😐 Neutral', motivated: '⚡ Motivated' }

const W = 640
const H = 220
const PAD_L = 32
const PAD_B = 28
const PAD_T = 10

export function MoodCorrelationChart() {
  const history = usePlannerStore(s => s.history)
  const points  = useMemo(() => buildMoodCorrelation(history), [history])
  const summary = useMemo(() => summarizeMoodCorrelation(points), [points])
  const fit     = useMemo(() => linearRegression(points.map(p => ({ x: p.moodScore, y: p.pts }))), [points])

  if (points.length === 0) {
    return <div className="text-[13px] text-[var(--text3)] py-6 text-center">Log your mood for a few days to see this correlation.</div>
  }

  const maxPts = Math.max(...points.map(p => p.pts), 10)
  const plotW  = W - PAD_L - 16
  const plotH  = H - PAD_T - PAD_B
  const xFor   = (moodScore: number) => PAD_L + (moodScore / 2) * plotW
  const yFor   = (pts: number) => PAD_T + plotH - (pts / maxPts) * plotH

  // jitter same-mood points horizontally so overlapping days are still visible
  const jittered = points.map((p, i) => {
    const sameMoodBefore = points.slice(0, i).filter(q => q.moodScore === p.moodScore).length
    const jitter = ((sameMoodBefore % 5) - 2) * 6
    return { ...p, jx: xFor(p.moodScore) + jitter }
  })

  return (
    <div>
      <div className="text-[13px] font-medium mb-2">{summary.sentence}</div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Mood vs. output correlation">
        {[0, 1, 2].map(score => (
          <line key={score} x1={xFor(score)} x2={xFor(score)} y1={PAD_T} y2={PAD_T + plotH} stroke="var(--border)" strokeWidth={1} />
        ))}

        {fit && (
          <line
            x1={xFor(0)} y1={yFor(Math.max(0, fit.intercept))}
            x2={xFor(2)} y2={yFor(Math.max(0, fit.slope * 2 + fit.intercept))}
            stroke="var(--purple)" strokeWidth={2} strokeDasharray="4 3"
          />
        )}

        {jittered.map(p => (
          <circle key={p.date} cx={p.jx} cy={yFor(p.pts)} r={5} fill={MOOD_COLOR[p.mood]} opacity={0.75}>
            <title>{`${p.date}: ${MOOD_LABEL[p.mood]}, ${p.pts} pts`}</title>
          </circle>
        ))}

        {[0, 1, 2].map(score => (
          <text key={`lbl-${score}`} x={xFor(score)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--text3)">
            {['🤒', '😐', '⚡'][score]}
          </text>
        ))}
      </svg>

      <div className="flex gap-3 mt-2 flex-wrap">
        {(['sick', 'neutral', 'motivated'] as const).map(m => (
          summary.avgByMood[m] != null && (
            <div key={m} className="text-[11px] text-[var(--text3)]">
              {MOOD_LABEL[m]}: avg <span className="font-semibold text-[var(--text2)]">{summary.avgByMood[m]}</span> pts
            </div>
          )
        ))}
        {summary.r != null && (
          <div className="text-[11px] text-[var(--text3)]">r = {summary.r.toFixed(2)}</div>
        )}
      </div>
    </div>
  )
}
