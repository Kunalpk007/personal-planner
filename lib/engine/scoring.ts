import type { Task, AppConfig } from '@/store/types'
import { PRIORITY_PTS, SLOT_HOURS, CARRY_PENALTY, WALLET_RATIO } from '@/constants/points'

export function basePts(task: Task): number {
  if (task.isSpecial && task.specialPts) return task.specialPts
  return PRIORITY_PTS[task.priority as keyof typeof PRIORITY_PTS] ?? 10
}

export function calcPts(task: Task): number {
  let pts = basePts(task)

  // Deadline modifier
  if (task.deadline && task.completedAt) {
    const dl = new Date(task.deadline).getTime()
    const ct = new Date(task.completedAt).getTime()
    if (ct > dl + 3_600_000)  pts = Math.round(pts * 0.4)  // >1hr late
    else if (ct > dl)          pts = Math.round(pts * 0.7)  // within 1hr
    // on time = 100%
  }

  // Slot mismatch -20%
  if (task.slot && task.completedAt) {
    const hour  = new Date(task.completedAt).getHours()
    const range = SLOT_HOURS[task.slot]
    if (range && (hour < range[0] || hour >= range[1])) {
      pts = Math.round(pts * 0.8)
    }
  }

  // Carry penalty — waived for blocked tasks (blocked = not the person's fault)
  if (task.carriedDays && task.carriedDays > 0 && !task.blocked) {
    pts = Math.max(1, pts - task.carriedDays * CARRY_PENALTY)
  }

  return Math.max(1, pts)
}

export function getMoodMult(mood: string | undefined, cfg: Pick<AppConfig, 'moodMot' | 'moodSick'>): number {
  if (mood === 'motivated') return cfg.moodMot ?? 1.2
  if (mood === 'sick')      return cfg.moodSick ?? 0.5
  return 1.0
}

export function todayEarned(doneTasks: Task[], mood: string | undefined, cfg: AppConfig): number {
  const raw = doneTasks.reduce((sum, t) => sum + calcPts(t), 0)
  return Math.round(raw * getMoodMult(mood, cfg))
}

export function todayTarget(tasks: Task[]): number {
  return tasks.reduce((sum, t) => sum + basePts(t), 0)
}

export function walletPtsFor(taskPts: number): number {
  return Math.floor(taskPts / WALLET_RATIO)
}

export function getMinPts(dateStr: string, cfg: AppConfig): number {
  const d = new Date(`${dateStr}T12:00:00`)
  const isWknd = d.getDay() === 0 || d.getDay() === 6
  return isWknd ? (cfg.weekendPts ?? 20) : (cfg.minPts ?? 70)
}

/** Returns the mood-adjusted minimum pts threshold for a given day.
 *  Motivated raises the bar (you earn more, so the target is higher).
 *  Sick lowers it (allowance for low-energy days). */
export function getMoodAdjustedMinPts(dateStr: string, mood: string | undefined, cfg: AppConfig): number {
  return Math.round(getMinPts(dateStr, cfg) * getMoodMult(mood, cfg))
}
