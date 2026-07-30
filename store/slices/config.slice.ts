import type { StateCreator } from 'zustand'
import type { AppState, AppConfig, Mood } from '../types'
import { getMoodAdjustedMinPts } from '@/lib/engine/scoring'
import { SHOWED_UP_BONUS_PCT } from '@/constants/points'

export interface ConfigSlice {
  setConfig:    (updates: Partial<AppConfig>) => void
  setMood:      (today: string, mood: Mood) => void
  setEodMood:   (today: string, mood: string) => void
  setPinnedTask:(id: string | null) => void
  claimShowedUpBonus: (today: string) => number | null
}

export const createConfigSlice: StateCreator<AppState, [], [], ConfigSlice> = (set, get) => ({
  setConfig(updates) {
    set(s => ({ cfg: { ...s.cfg, ...updates } }))
  },

  // Editable any time before the day is submitted (SubmitArea/MoodBar gate
  // on isSubmitted) — no separate lock window. Reselecting mood mid-day
  // still applies the same flat mood multiplier to the whole day's target,
  // same as picking it the first time.
  setMood(today, mood) {
    set(s => ({ mood: { ...s.mood, [today]: mood } }))
  },

  setEodMood(today, mood) {
    set(s => ({ eodMood: { ...s.eodMood, [today]: mood as any } }))
  },

  setPinnedTask(id) {
    set({ pinnedTaskId: id })
  },

  // Wallet-only bonus for the first app-open of the day — never XP. Guards
  // against re-claiming the same day itself (engagementDays[today] is the
  // "already opened today" flag, set right after this by useOvernightCheck).
  claimShowedUpBonus(today) {
    const s = get()
    if (s.engagementDays[today]) return null
    const minPts = getMoodAdjustedMinPts(today, s.mood[today], s.cfg)
    const bonus = Math.ceil(minPts * SHOWED_UP_BONUS_PCT)
    set({ rewardWallet: s.rewardWallet + bonus })
    return bonus
  },
})
