import type { AppState, HistoryEntry, Task } from '@/store/types'
import { getWeekMonday, daysBetween, pad, uid } from './cutoff'
import { todayEarned, getMinPts } from './scoring'
import { WALLET_RATIO, MAX_CARRY } from '@/constants/points'
import defaults from '@/data/defaults.json'

const FREEZE_SCH: Record<number, number> = defaults.freezeSchedule as unknown as Record<number, number>

export function checkStreakMilestone(streak: number): number {
  return FREEZE_SCH[streak] ?? 0
}

function snapshotTasks(state: AppState, dateKey: string) {
  return state.tasks
    .filter(t => t.date === dateKey)
    .map(t => ({
      title:       t.title,
      priority:    t.isSpecial ? 'special' : t.priority,
      done:        t.done,
      zone:        t.zone,
      completedAt: t.completedAt,
      level:       t.level,
    }))
}

/**
 * Overnight auto-logic: for each missed day between last submitted and today,
 * re-checks the REAL tasks recorded for that date (tasks[] is never mutated
 * by this function — it's the single source of truth) and either:
 *   1. Auto-submits the day as a complete day (if min pts were actually met), or
 *   2. Falls back to rest day → freeze → streak break.
 * Every missed day always gets a history entry with its real task snapshot,
 * so it shows up in History regardless of which branch was taken.
 */
export function runOvernightLogic(state: AppState, today: string): Partial<AppState> & { overnightMsg: string | null } {
  const sorted = [...state.history].sort((a, b) => a.date.localeCompare(b.date))
  const lastHistoryDate = sorted[sorted.length - 1]?.date

  // For new users with no history, anchor to the day before the earliest past task
  // so the overnight loop processes that task day and carries incomplete tasks forward.
  let lastDate = lastHistoryDate
  if (!lastDate) {
    const earliest = state.tasks.map(t => t.date).filter(d => d < today).sort()[0]
    if (earliest) {
      const d = new Date(`${earliest}T12:00:00`)
      d.setDate(d.getDate() - 1)
      lastDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
  }
  if (!lastDate) return { overnightMsg: null }

  const gap = daysBetween(lastDate, today)
  if (gap <= 0) return { overnightMsg: null }

  const patch: Partial<AppState> = {
    submittedDays: { ...state.submittedDays },
    frozenDays:    { ...state.frozenDays },
    restDays:      { ...state.restDays },
    weekRestUsed:  { ...state.weekRestUsed },
    weekDays:      { ...state.weekDays },
    freezeTokens:  state.freezeTokens,
    freezesBought: state.freezesBought,
    freezesUsed:   state.freezesUsed,
    streak:        state.streak,
    bestStreak:    state.bestStreak,
    daysActive:    state.daysActive,
    bufferXP:      state.bufferXP,
    badges:        [...state.badges],
    history:       [...state.history],
    tasks:         [...state.tasks],
  }

  let overnightMsg: string | null = null

  for (let d = 1; d < gap; d++) {
    const md = new Date(`${lastDate}T12:00:00`)
    md.setDate(md.getDate() + d)
    const mk = `${md.getFullYear()}-${pad(md.getMonth() + 1)}-${pad(md.getDate())}`

    if (patch.submittedDays![mk] || patch.restDays![mk] || patch.frozenDays![mk]) continue

    const dayTasks  = state.tasks.filter(t => t.date === mk)
    const doneTasks = dayTasks.filter(t => t.done)
    const earned    = todayEarned(doneTasks, state.mood[mk], state.cfg)
    const minPts    = getMinPts(mk, state.cfg)
    const pct       = dayTasks.length ? Math.round(doneTasks.length / dayTasks.length * 100) : 0
    const taskSnap  = snapshotTasks(state, mk)

    const baseEntry: Omit<HistoryEntry, 'frozen' | 'rest' | 'rxp'> = {
      date: mk, done: doneTasks.length, total: dayTasks.length, pct,
      mood: state.mood[mk] ?? '', eodMood: '', auto: true, late: false,
      tasks: taskSnap, rewards: [],
    }

    // Carry forward incomplete tasks to the next day (mirrors carryTask), up
    // to the max carry-day cap, so auto-submitted days don't silently drop work.
    const nd = new Date(`${mk}T12:00:00`)
    nd.setDate(nd.getDate() + 1)
    const nextKey = `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}-${pad(nd.getDate())}`
    for (const t of dayTasks.filter(t => !t.done)) {
      // Blocked tasks carry forward without incrementing the penalty counter
      const newCarried = t.blocked ? (t.carriedDays ?? 0) : (t.carriedDays ?? 0) + 1
      if (t.blocked || newCarried <= MAX_CARRY) {
        patch.tasks!.push({
          ...t,
          id:          uid(),
          date:        nextKey,
          done:        false,
          completedAt: null,
          createdAt:   new Date().toISOString(),
          carriedDays: newCarried,
        } as Task)
      }
    }

    if (earned >= minPts) {
      // Day was actually completed — auto-submit it as a full day, just like a manual submit.
      const newStreak = patch.streak! + 1
      patch.bestStreak = Math.max(patch.bestStreak!, newStreak)
      const bonus = checkStreakMilestone(newStreak)
      if (bonus > 0) {
        patch.badges!.push({ id: `s${newStreak}`, label: `${newStreak}-Day Streak`, icon: '🔥', date: mk })
        patch.freezeTokens = (patch.freezeTokens ?? 0) + bonus
      }
      // Buffer XP at the same 2:1 ratio as the reward wallet
      const excess = Math.max(0, earned - minPts)
      patch.bufferXP = (patch.bufferXP ?? 0) + Math.floor(excess / WALLET_RATIO)

      patch.streak             = newStreak
      patch.daysActive         = (patch.daysActive ?? 0) + 1
      patch.weekDays![mk]      = true
      patch.submittedDays![mk] = true
      patch.history!.push({ ...baseEntry, rxp: earned, frozen: false, rest: false })
      overnightMsg = `✅ ${mk} auto-submitted — ${earned}/${minPts} pts were already met. Streak +1!`
      continue
    }

    const mon = getWeekMonday(mk)

    if (!patch.weekRestUsed![mon]) {
      patch.weekRestUsed![mon] = true
      patch.restDays![mk]      = true
      patch.submittedDays![mk] = true
      patch.daysActive         = (patch.daysActive ?? 0) + 1
      patch.history!.push({ ...baseEntry, rxp: earned, frozen: false, rest: true })
      overnightMsg = `🟡 Rest Day auto-used for ${mk} (${earned}/${minPts} pts). Streak protected.`
    } else if ((patch.freezeTokens ?? 0) > 0) {
      patch.freezeTokens! -= 1
      if ((patch.freezesBought ?? 0) > 0) patch.freezesBought! -= 1
      patch.freezesUsed        = (patch.freezesUsed ?? 0) + 1
      patch.frozenDays![mk]    = true
      patch.submittedDays![mk] = true
      patch.history!.push({ ...baseEntry, rxp: earned, frozen: true, rest: false })
      overnightMsg = `❄ Auto-freeze used for ${mk} (${earned}/${minPts} pts). Streak protected.`
    } else {
      patch.streak = 0
      patch.history!.push({ ...baseEntry, rxp: earned, frozen: false, rest: false })
      overnightMsg = `😔 Streak broke on ${mk} (${earned}/${minPts} pts). No protection available. Start fresh!`
    }
  }

  // The main loop processes days strictly BETWEEN lastDate and today (exclusive).
  // When gap=1 (lastDate = yesterday — the normal daily login), the loop
  // condition `d < 1` is false immediately, so carry-forward never runs.
  // We handle that case explicitly here.
  if (gap === 1) {
    const prevDay = lastDate // yesterday in the typical case
    for (const t of state.tasks.filter(t => t.date === prevDay && !t.done)) {
      // Blocked tasks carry without penalty; unblocked tasks respect MAX_CARRY
      const newCarried = t.blocked ? (t.carriedDays ?? 0) : (t.carriedDays ?? 0) + 1
      if (!t.blocked && newCarried > MAX_CARRY) continue
      // Dedup: skip if a carry of this task already exists in today's list
      const alreadyCarried = patch.tasks!.some(
        ct => ct.date === today && ct.title === t.title && ct.zone === t.zone
      )
      if (alreadyCarried) continue
      patch.tasks!.push({
        ...t,
        id:          uid(),
        date:        today,
        done:        false,
        completedAt: null,
        createdAt:   new Date().toISOString(),
        carriedDays: newCarried,
      } as Task)
    }
  }

  return { ...patch, overnightMsg }
}
