import type { StateCreator } from 'zustand'
import type { AppState, HistoryEntry, PausedStreak, Task } from '../types'
import { checkStreakMilestone } from '@/lib/engine/streak'
import { getWeekMonday, getNextDayKey } from '@/lib/engine/cutoff'
import { uid }                 from '@/lib/engine/cutoff'
import { getMinPts }           from '@/lib/engine/scoring'
import { MAX_PAUSE_DAYS, MAX_BOUGHT_FREEZES, FREEZE_COST, WALLET_RATIO, MAX_CARRY } from '@/constants/points'

export interface StreakSlice {
  submitDay:        (entry: HistoryEntry) => { freezeBonus: number; milestoneStreak: number | null }
  useFreeze:        (today: string) => void
  buyFreeze:        () => boolean
  useBuffer:        (amount: number) => void
  pauseStreak:      (reason: string) => void
  restoreStreak:    () => void
  checkPausedExpiry:() => void
  invalidateStreak: () => void
  resetRankXP:      () => void
  declareRestDay:   (today: string) => void
}

export const createStreakSlice: StateCreator<AppState, [], [], StreakSlice> = (set, get) => ({
  submitDay(entry) {
    const s      = get()
    const newStreak = s.streak + 1
    const best      = Math.max(s.bestStreak, newStreak)
    const bonus     = checkStreakMilestone(newStreak)

    const newBadges = bonus > 0
      ? [...s.badges, { id: `s${newStreak}`, label: `${newStreak}-Day Streak`, icon: '🔥', date: entry.date }]
      : s.badges

    // Points earned beyond the daily minimum go straight into Rank XP (at the
    // same 2:1 ratio the reward wallet uses) rather than a separate buffer.
    const minPts = getMinPts(entry.date, s.cfg)
    const excess = Math.max(0, entry.rxp - minPts)
    const overflowXP = Math.floor(excess / WALLET_RATIO)

    // Carry forward any incomplete tasks from the submitted day, mirroring the
    // overnight auto-logic's carry-forward so manual submission doesn't silently
    // drop pending work (blocked tasks carry without penalty).
    const nextKey = getNextDayKey(entry.date)
    const carried: Task[] = []
    for (const t of s.tasks.filter(t => t.date === entry.date && !t.done)) {
      const newCarried = t.blocked ? (t.carriedDays ?? 0) : (t.carriedDays ?? 0) + 1
      if (!t.blocked && newCarried > MAX_CARRY) continue
      carried.push({
        ...t,
        id:          uid(),
        date:        nextKey,
        done:        false,
        completedAt: null,
        createdAt:   new Date().toISOString(),
        carriedDays: newCarried,
      } as Task)
    }

    set({
      streak:        newStreak,
      bestStreak:    best,
      daysActive:    s.daysActive + 1,
      weekDays:      { ...s.weekDays,      [entry.date]: true },
      submittedDays: { ...s.submittedDays, [entry.date]: true },
      freezeTokens:  s.freezeTokens + bonus,
      badges:        newBadges,
      history:       [...s.history, entry],
      tasks:         carried.length ? [...s.tasks, ...carried] : s.tasks,
      rankXP:        s.rankXP + overflowXP,
      lastActiveDayForDecay: entry.date,
    })

    return { freezeBonus: bonus, milestoneStreak: bonus > 0 ? newStreak : null }
  },

  useFreeze(today) {
    const s = get()
    // A freeze protects an existing streak — with streak at 0 there's nothing to protect.
    if (s.freezeTokens <= 0 || s.streak <= 0) return
    set({
      freezeTokens:  s.freezeTokens - 1,
      freezesBought: Math.max(0, (s.freezesBought ?? 0) - 1),
      freezesUsed:   s.freezesUsed + 1,
      frozenDays:    { ...s.frozenDays,    [today]: true },
      submittedDays: { ...s.submittedDays, [today]: true },
      history: [...s.history, {
        date: today, done: 0, total: 0, pct: 0, rxp: 0,
        mood: '', eodMood: '', frozen: true, rest: false,
        auto: false, late: false, tasks: [], rewards: [],
      }],
    })
  },

  buyFreeze() {
    const s = get()
    if ((s.freezesBought ?? 0) >= MAX_BOUGHT_FREEZES) return false
    if (s.rewardWallet < FREEZE_COST) return false
    set({
      rewardWallet:  s.rewardWallet - FREEZE_COST,
      freezesBought: (s.freezesBought ?? 0) + 1,
      freezeTokens:  s.freezeTokens + 1,
    })
    return true
  },

  useBuffer(amount) {
    set(s => ({
      bufferXP: Math.max(0, s.bufferXP - amount),
      rankXP:   s.rankXP + amount,
    }))
  },

  pauseStreak(reason) {
    set(s => ({
      pausedStreak: { date: new Date().toISOString(), reason, streakAtPause: s.streak },
    }))
  },

  restoreStreak() {
    set(s => ({
      streak:       s.pausedStreak?.streakAtPause ?? s.streak,
      pausedStreak: null,
    }))
  },

  checkPausedExpiry() {
    const { pausedStreak } = get()
    if (!pausedStreak) return
    const days = Math.floor((Date.now() - new Date(pausedStreak.date).getTime()) / 86400000)
    if (days > MAX_PAUSE_DAYS) {
      set({ pausedStreak: null, streak: 0 })
    }
  },

  invalidateStreak() {
    set({ streak: 0, pausedStreak: null })
  },

  resetRankXP() {
    set({ rankXP: 0 })
  },

  declareRestDay(today) {
    const s0 = get()
    // A rest day protects an existing streak — with streak at 0 there's nothing to protect.
    if (s0.streak <= 0) return
    const mon = getWeekMonday(today)
    set(s => ({
      weekRestUsed:  { ...s.weekRestUsed, [mon]: true },
      restDays:      { ...s.restDays,     [today]: true },
      submittedDays: { ...s.submittedDays,[today]: true },
      daysActive:    s.daysActive + 1,
      history: [...s.history, {
        date: today, done: 0, total: 0, pct: 0, rxp: 0,
        mood: s.mood[today] ?? '', eodMood: '', frozen: false,
        rest: true, auto: false, late: false, tasks: [], rewards: [],
      }],
    }))
  },
})
