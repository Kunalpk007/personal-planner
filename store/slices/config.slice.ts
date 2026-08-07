import type { StateCreator } from 'zustand'
import type { AppState, AppConfig, Mood } from '../types'
import { getMoodAdjustedMinPts } from '@/lib/engine/scoring'
import { getWeekMonday } from '@/lib/engine/cutoff'
import { SHOWED_UP_BONUS_PCT } from '@/constants/points'

function sameDaySet(a: number[], b: number[]): boolean {
  const sa = [...a].sort().join(',')
  const sb = [...b].sort().join(',')
  return sa === sb
}

export interface ConfigSlice {
  setConfig:    (updates: Partial<AppConfig>) => { blockedLightDays?: boolean }
  setMood:      (today: string, mood: Mood) => void
  setEodMood:   (today: string, mood: string) => void
  setPinnedTask:(id: string | null) => void
  claimShowedUpBonus: (today: string) => number | null
  addWater:     (today: string, deltaMl: number) => void
}

export const createConfigSlice: StateCreator<AppState, [], [], ConfigSlice> = (set, get) => ({
  // `lightDays` is special-cased: changing the actual selection is gated to
  // once per Monday-start calendar week (getWeekMonday, the same helper the
  // rest-day weekly-cap logic already uses — see project.md). Any other
  // fields present in the same `updates` object still apply normally even
  // when the lightDays change itself is blocked, so a single Settings "Save"
  // covering multiple fields doesn't lose unrelated edits.
  setConfig(updates) {
    const s = get()
    if (updates.lightDays !== undefined && !sameDaySet(updates.lightDays, s.cfg.lightDays)) {
      const todayIso = new Date().toISOString().slice(0, 10)
      const thisWeekMon = getWeekMonday(todayIso)
      const lastChangeWeekMon = s.cfg.lightDaysChangedAt ? getWeekMonday(s.cfg.lightDaysChangedAt.slice(0, 10)) : null
      if (lastChangeWeekMon === thisWeekMon) {
        const { lightDays: _drop, ...rest } = updates
        set(s2 => ({ cfg: { ...s2.cfg, ...rest } }))
        return { blockedLightDays: true }
      }
      set(s2 => ({ cfg: { ...s2.cfg, ...updates, lightDaysChangedAt: new Date().toISOString() } }))
      return {}
    }
    set(s2 => ({ cfg: { ...s2.cfg, ...updates } }))
    return {}
  },

  // Editable any time before the day is submitted (SubmitArea/MoodBar gate
  // on isSubmitted) — no separate lock window. Reselecting mood mid-day
  // still applies the same flat mood multiplier to the whole day's target,
  // same as picking it the first time. moodCheckins only bumps the first
  // time a given day gets an AM mood — re-picking doesn't inflate the count.
  // Every pick (first or a later change) is also appended to moodChangeLog,
  // an unbounded history of the raw picks (separate from moodCheckins,
  // which purposely stays a once-per-day counter).
  setMood(today, mood) {
    set(s => ({
      mood: { ...s.mood, [today]: mood },
      moodCheckins: s.mood[today] === undefined ? s.moodCheckins + 1 : s.moodCheckins,
      moodChangeLog: [...s.moodChangeLog, { date: today, kind: 'am', mood, at: new Date().toISOString() }],
    }))
  },

  // Same idempotency for the end-of-day mood — only the first EOD pick for a
  // given day counts toward moodCheckins.
  setEodMood(today, mood) {
    set(s => ({
      eodMood: { ...s.eodMood, [today]: mood as any },
      moodCheckins: s.eodMood[today] === undefined ? s.moodCheckins + 1 : s.moodCheckins,
      moodChangeLog: [...s.moodChangeLog, { date: today, kind: 'pm', mood, at: new Date().toISOString() }],
    }))
  },

  setPinnedTask(id) {
    set({ pinnedTaskId: id })
  },

  // +/- 250ml buttons on the Water Drank dashboard tile. Clamped at 0 so
  // repeated "-" taps can't go negative.
  addWater(today, deltaMl) {
    set(s => ({
      waterMl: { ...s.waterMl, [today]: Math.max(0, (s.waterMl[today] ?? 0) + deltaMl) },
    }))
  },

  // Wallet-only bonus for the first app-open of the day — never XP. Guards
  // against re-claiming the same day itself (engagementDays[today] is the
  // "already opened today" flag, set right after this by useOvernightCheck).
  // Also snapshots { date, bonus, minPts } into lastShowedUpBonus so
  // MorningQuoteOverlay can display the day-progress bonus (bonus/minPts%)
  // without recomputing mood-adjusted minPts itself.
  claimShowedUpBonus(today) {
    const s = get()
    if (s.engagementDays[today]) return null
    const minPts = getMoodAdjustedMinPts(today, s.mood[today], s.cfg)
    const bonus = Math.ceil(minPts * SHOWED_UP_BONUS_PCT)
    set({ rewardWallet: s.rewardWallet + bonus, lastShowedUpBonus: { date: today, bonus, minPts } })
    return bonus
  },
})
