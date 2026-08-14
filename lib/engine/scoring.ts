import type { Task, AppConfig } from '@/store/types'
import { PRIORITY_PTS, SLOT_HOURS, CARRY_PENALTY, WALLET_RATIO, TASK_ABANDON_XP_MULT } from '@/constants/points'

export function basePts(task: Task): number {
  if (task.isSpecial && task.specialPts) return task.specialPts
  return PRIORITY_PTS[task.priority as keyof typeof PRIORITY_PTS] ?? 10
}

export function calcPts(task: Task): number {
  let pts = basePts(task)

  // Time-bound deadline modifier: completing after the deadline earns half.
  // (Simple, predictable rule for time-bound tasks — see the countdown pill
  // and half-pts display in app/(tabs)/tasks/page.tsx.)
  if (task.deadline && task.completedAt) {
    const dl = new Date(task.deadline).getTime()
    const ct = new Date(task.completedAt).getTime()
    if (ct > dl) pts = Math.round(pts * 0.5)  // late → half; on time = 100%
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

/** One-time penalty for a task that's been carried past MAX_CARRY days and
 *  is still incomplete — "abandoned" rather than finished. Proportional to
 *  the task's own point value (`basePts`, not the already carry-decayed
 *  `calcPts` — by day 3 that would've shrunk toward 1, which would make the
 *  penalty for ignoring a high-priority task barely bigger than a low-
 *  priority one, the opposite of what "proportional" should mean here).
 *  Applied once, at the moment a task stops being carried forward — see the
 *  three call sites in lib/engine/streak.ts and
 *  store/slices/tasks.slice.ts#carryTask. Wallet reuses the existing
 *  pts-to-wallet conversion (WALLET_RATIO) rather than a second ratio. */
export function taskAbandonPenalty(task: Task): { xp: number; wallet: number } {
  const xp = basePts(task) * TASK_ABANDON_XP_MULT
  const wallet = Math.floor(xp / WALLET_RATIO)
  return { xp, wallet }
}

export function getMoodMult(mood: string | undefined, cfg: Pick<AppConfig, 'moodMot' | 'moodSick'>): number {
  if (mood === 'motivated') return cfg.moodMot ?? 1.2
  if (mood === 'sick')      return cfg.moodSick ?? 0.5
  return 1.0
}

/** goalPtsToday — points from goals completed on this date (see
 *  lib/engine/goals.ts#goalPtsEarnedOn), added on top of the mood-adjusted
 *  task total so goal completions count toward the daily submit-gate too.
 *  Goal points aren't mood-scaled — that multiplier is a task-specific rule,
 *  and goal points already have their own deadline-based reduction. */
export function todayEarned(doneTasks: Task[], mood: string | undefined, cfg: AppConfig, goalPtsToday = 0): number {
  const raw = doneTasks.reduce((sum, t) => sum + calcPts(t), 0)
  return Math.round(raw * getMoodMult(mood, cfg)) + goalPtsToday
}

export function todayTarget(tasks: Task[]): number {
  return tasks.reduce((sum, t) => sum + basePts(t), 0)
}

export function walletPtsFor(taskPts: number): number {
  return Math.floor(taskPts / WALLET_RATIO)
}

export function getMinPts(dateStr: string, cfg: AppConfig): number {
  const d = new Date(`${dateStr}T12:00:00`)
  const isLightDay = (cfg.lightDays ?? [0, 6]).includes(d.getDay())
  return isLightDay ? (cfg.weekendPts ?? 20) : (cfg.minPts ?? 70)
}

/** Returns the mood-adjusted minimum pts threshold for a given day.
 *  Motivated raises the bar (you earn more, so the target is higher).
 *  Sick lowers it (allowance for low-energy days). */
export function getMoodAdjustedMinPts(dateStr: string, mood: string | undefined, cfg: AppConfig): number {
  return Math.round(getMinPts(dateStr, cfg) * getMoodMult(mood, cfg))
}
