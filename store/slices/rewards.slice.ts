import type { StateCreator } from 'zustand'
import type { AppState, Reward, Zone } from '../types'
import { uid } from '@/lib/engine/cutoff'

export interface RewardsSlice {
  addReward:    (r: Omit<Reward, 'id'>) => void
  removeReward: (id: string) => void
  redeemReward: (id: string, today: string) => boolean
  addZone:      (name: string, color: string) => void
  removeZone:   (id: string) => void
}

export const createRewardsSlice: StateCreator<AppState, [], [], RewardsSlice> = (set, get) => ({
  addReward(r) {
    set(s => ({ rewards: [...s.rewards, { ...r, id: uid() }] }))
  },

  removeReward(id) {
    set(s => ({ rewards: s.rewards.filter(r => r.id !== id) }))
  },

  redeemReward(id, today) {
    const s = get()
    const r = s.rewards.find(x => x.id === id)
    if (!r || s.rewardWallet < r.cost) return false
    set({
      rewardWallet: s.rewardWallet - r.cost,
      rewardRedemptions: [...s.rewardRedemptions, { date: today, title: r.title, cost: r.cost, at: new Date().toISOString() }],
    })
    return true
  },

  addZone(name, color) {
    set(s => ({ zones: [...s.zones, { id: uid(), name, color }] }))
  },

  removeZone(id) {
    set(s => {
      if (s.zones.length <= 1) return s
      return { zones: s.zones.filter(z => z.id !== id) }
    })
  },
})
