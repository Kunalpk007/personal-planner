import type { HistoryEntry, AppConfig } from '@/store/types'
import { getMoodAdjustedMinPts } from './scoring'

// ─── Daily trend ──────────────────────────────────────────────────────────────
// `HistoryEntry.rxp` is the mood-adjusted task pts earned that day (see
// SubmitArea.tsx: `rxp: earned` where `earned = todayEarned(...)`), not the
// Rank XP pool. It's the correct field to chart as "points earned per day."

export interface DailyTrendPoint {
  date:      string
  pts:       number
  target:    number
  metTarget: boolean
  frozen:    boolean
  rest:      boolean
  auto:      boolean
  late:      boolean
}

export function buildDailyTrend(history: HistoryEntry[], cfg: AppConfig): DailyTrendPoint[] {
  return [...history]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => {
      const target = getMoodAdjustedMinPts(e.date, e.mood, cfg)
      return {
        date:      e.date,
        pts:       e.rxp,
        target,
        metTarget: e.rxp >= target,
        frozen:    e.frozen,
        rest:      e.rest,
        auto:      e.auto,
        late:      e.late,
      }
    })
}

/** Filter a sorted trend to the last N days (or all, if `days` is null). */
export function filterTrendRange(trend: DailyTrendPoint[], days: number | null): DailyTrendPoint[] {
  if (days == null) return trend
  return trend.slice(Math.max(0, trend.length - days))
}

// ─── Best window (best N-day stretch, e.g. best week) ────────────────────────

export interface BestWindow {
  startDate: string
  endDate:   string
  total:     number
}

/** Rolling-sum scan for the highest-total N-day window. Requires a full window
 *  of data (no partial windows at the edges) so short histories return null. */
export function findBestWindow(trend: DailyTrendPoint[], windowSize = 7): BestWindow | null {
  if (trend.length < windowSize) return null
  let best: BestWindow | null = null
  for (let i = 0; i <= trend.length - windowSize; i++) {
    const slice = trend.slice(i, i + windowSize)
    const total = slice.reduce((sum, p) => sum + p.pts, 0)
    if (!best || total > best.total) {
      best = { startDate: slice[0].date, endDate: slice[slice.length - 1].date, total }
    }
  }
  return best
}

// ─── Personal-baseline comparison (self vs past-self, never vs other users) ──

export interface BaselineComparison {
  currentTotal:  number
  baselineAvg:   number   // average per-period total over the prior periods
  deltaPct:      number | null  // null if baseline is 0 (nothing to compare against)
}

/** Compares the most recent `periodDays` window against the average of the
 *  `lookbackPeriods` windows before it. Default: this week vs. the last 4 weeks. */
export function compareToBaseline(
  trend: DailyTrendPoint[],
  periodDays = 7,
  lookbackPeriods = 4
): BaselineComparison {
  const current = trend.slice(Math.max(0, trend.length - periodDays))
  const currentTotal = current.reduce((s, p) => s + p.pts, 0)

  const priorSlice = trend.slice(0, Math.max(0, trend.length - periodDays))
  const lookbackDays = periodDays * lookbackPeriods
  const priorWindow = priorSlice.slice(Math.max(0, priorSlice.length - lookbackDays))

  if (priorWindow.length === 0) {
    return { currentTotal, baselineAvg: 0, deltaPct: null }
  }

  const periodsAvailable = Math.max(1, Math.round(priorWindow.length / periodDays))
  const baselineAvg = priorWindow.reduce((s, p) => s + p.pts, 0) / periodsAvailable
  const deltaPct = baselineAvg > 0 ? Math.round(((currentTotal - baselineAvg) / baselineAvg) * 100) : null

  return { currentTotal, baselineAvg, deltaPct }
}

// ─── Mood vs. output correlation ──────────────────────────────────────────────

const MOOD_SCORE: Record<string, number> = { sick: 0, neutral: 1, motivated: 2 }

export interface MoodCorrelationPoint {
  date:      string
  mood:      string
  moodScore: number
  pts:       number
}

export function buildMoodCorrelation(history: HistoryEntry[]): MoodCorrelationPoint[] {
  return history
    .filter(e => e.mood && MOOD_SCORE[e.mood] !== undefined)
    .map(e => ({ date: e.date, mood: e.mood, moodScore: MOOD_SCORE[e.mood], pts: e.rxp }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Pearson correlation coefficient. Returns null when undefined (fewer than 2
 *  points, or zero variance on either axis). */
export function correlationCoefficient(points: Array<{ x: number; y: number }>): number | null {
  const n = points.length
  if (n < 2) return null
  const meanX = points.reduce((s, p) => s + p.x, 0) / n
  const meanY = points.reduce((s, p) => s + p.y, 0) / n
  let num = 0, denX = 0, denY = 0
  for (const p of points) {
    const dx = p.x - meanX
    const dy = p.y - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  if (denX === 0 || denY === 0) return null
  return num / Math.sqrt(denX * denY)
}

/** Simple linear regression (least squares). Returns null on insufficient/flat data. */
export function linearRegression(points: Array<{ x: number; y: number }>): { slope: number; intercept: number } | null {
  const n = points.length
  if (n < 2) return null
  const meanX = points.reduce((s, p) => s + p.x, 0) / n
  const meanY = points.reduce((s, p) => s + p.y, 0) / n
  let num = 0, den = 0
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY)
    den += (p.x - meanX) * (p.x - meanX)
  }
  if (den === 0) return null
  const slope = num / den
  return { slope, intercept: meanY - slope * meanX }
}

export interface MoodCorrelationSummary {
  r:            number | null
  avgByMood:    Partial<Record<'sick' | 'neutral' | 'motivated', number>>
  sentence:     string
}

/** Auto-generated plain-language summary — the sentence is what actually gets
 *  remembered and acted on, not the scatter plot alone. */
export function summarizeMoodCorrelation(points: MoodCorrelationPoint[]): MoodCorrelationSummary {
  const byMood: Record<string, number[]> = {}
  for (const p of points) {
    (byMood[p.mood] ??= []).push(p.pts)
  }
  const avgByMood: MoodCorrelationSummary['avgByMood'] = {}
  for (const key of Object.keys(byMood)) {
    const arr = byMood[key]
    avgByMood[key as 'sick' | 'neutral' | 'motivated'] = Math.round(arr.reduce((s, v) => s + v, 0) / arr.length)
  }

  const r = correlationCoefficient(points.map(p => ({ x: p.moodScore, y: p.pts })))

  const motivated = avgByMood.motivated
  const neutral   = avgByMood.neutral
  let sentence = 'Not enough mood data yet to find a pattern — keep logging your daily mood.'
  if (motivated != null && neutral != null && neutral > 0) {
    const diffPct = Math.round(((motivated - neutral) / neutral) * 100)
    if (Math.abs(diffPct) >= 10) {
      sentence = diffPct > 0
        ? `On motivated days you average ${diffPct}% more pts than on neutral days.`
        : `Motivated days average ${Math.abs(diffPct)}% fewer pts than neutral days — worth a second look.`
    } else {
      sentence = 'No strong link found yet between mood and output — needs more data.'
    }
  }

  return { r, avgByMood, sentence }
}

// ─── Zone breakdown over time ─────────────────────────────────────────────────
// HistoryEntry.tasks doesn't retain the exact pts earned per task (special-task
// custom pts and deadline/slot modifiers aren't preserved historically), so the
// honest, always-accurate metric here is completed task *count* per zone, not
// approximated points. Still shows life-balance drift week to week.

export interface ZoneWeekBreakdown {
  weekStart: string
  zones:     Record<string, number>
}

/** Buckets completed tasks by zone into calendar weeks (Mon-start), based on
 *  each day's date. */
export function buildZoneBreakdown(history: HistoryEntry[]): ZoneWeekBreakdown[] {
  const buckets = new Map<string, Record<string, number>>()
  for (const entry of history) {
    const weekStart = mondayOf(entry.date)
    const bucket = buckets.get(weekStart) ?? {}
    for (const t of entry.tasks ?? []) {
      if (!t.done) continue
      const zone = t.zone || 'Unassigned'
      bucket[zone] = (bucket[zone] ?? 0) + 1
    }
    buckets.set(weekStart, bucket)
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, zones]) => ({ weekStart, zones }))
}

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  const day = d.getDay() // 0 = Sun
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

// ─── Calendar heatmap ──────────────────────────────────────────────────────────

export interface HeatmapDay {
  date: string
  pct:  number | null // null = no entry that day
}

/** Builds a dense day-by-day series (no gaps) between the earliest history
 *  entry and today, filling missing days with `pct: null` so the heatmap grid
 *  renders without holes. */
export function buildHeatmap(history: HistoryEntry[], today: string): HeatmapDay[] {
  if (history.length === 0) return []
  const byDate = new Map(history.map(e => [e.date, e.pct]))
  const sortedDates = [...byDate.keys()].sort()
  const start = sortedDates[0]
  const days: HeatmapDay[] = []
  const cur = new Date(`${start}T12:00:00`)
  const end = new Date(`${today}T12:00:00`)
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10)
    days.push({ date: key, pct: byDate.get(key) ?? null })
    cur.setDate(cur.getDate() + 1)
  }
  return days
}
