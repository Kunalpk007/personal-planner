import type { StateCreator } from 'zustand'
import type { AppState, Reward, Zone, PendingRewardApproval, PendingApprovalStatus } from '../types'
import { uid } from '@/lib/engine/cutoff'
import { focusReward } from '@/constants/points'

export interface RewardsSlice {
  addReward:    (r: Omit<Reward, 'id'>) => void
  removeReward: (id: string) => void
  redeemReward: (id: string, today: string) => boolean
  addZone:      (name: string, color: string) => void
  removeZone:   (id: string) => void
  setZoneWeight: (id: string, weight: number) => void
  completeFocusSession: (today: string, minutes: number) => { pts: number; xp: number }

  requestRewardApproval:   (approval: Omit<PendingRewardApproval, 'status'>) => void
  resolvePendingApproval:  (id: string, status: PendingApprovalStatus) => void
  cancelPendingApproval:   (id: string) => void
  reassignPendingApproval: (id: string, notaryUid: string, notaryName: string, cooldownEndsAt: string) => void
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

  // ─── Reward approvals — see docs/PHASE2_SOCIAL_LIFE_OS.md Section 1.5/6.4 ──
  // Pts are locked (deducted) the moment a gated redemption is *requested*,
  // not when it's approved — this is what prevents the same pts being spent
  // twice while a request is pending. The actual approve/reject decision is
  // made by the Notary on their own device via Firestore
  // (lib/firebase/social.ts); this reducer only maintains the requester's
  // local, offline-first mirror of that pending state.

  requestRewardApproval(approval) {
    const s = get()
    if (s.rewardWallet < approval.cost) return
    set({
      rewardWallet: s.rewardWallet - approval.cost,
      pendingRewardApprovals: [...s.pendingRewardApprovals, { ...approval, status: 'pending' }],
    })
  },

  resolvePendingApproval(id, status) {
    const s = get()
    const entry = s.pendingRewardApprovals.find(a => a.id === id)
    if (!entry || entry.status !== 'pending') return

    if (status === 'approved') {
      set({
        pendingRewardApprovals: s.pendingRewardApprovals.map(a => a.id === id ? { ...a, status } : a),
        rewardRedemptions: [
          ...s.rewardRedemptions,
          { date: new Date().toISOString().slice(0, 10), title: entry.title, cost: entry.cost, at: new Date().toISOString() },
        ],
      })
    } else if (status === 'rejected') {
      set({
        rewardWallet: s.rewardWallet + entry.cost,
        pendingRewardApprovals: s.pendingRewardApprovals.map(a => a.id === id ? { ...a, status } : a),
      })
    } else {
      set({ pendingRewardApprovals: s.pendingRewardApprovals.map(a => a.id === id ? { ...a, status } : a) })
    }
  },

  cancelPendingApproval(id) {
    const s = get()
    const entry = s.pendingRewardApprovals.find(a => a.id === id)
    if (!entry || entry.status !== 'pending') return
    set({
      rewardWallet: s.rewardWallet + entry.cost,
      pendingRewardApprovals: s.pendingRewardApprovals.map(a => a.id === id ? { ...a, status: 'cancelled' } : a),
    })
  },

  reassignPendingApproval(id, notaryUid, notaryName, cooldownEndsAt) {
    set(s => ({
      pendingRewardApprovals: s.pendingRewardApprovals.map(a =>
        a.id === id ? { ...a, notaryUid, notaryName, cooldownEndsAt } : a
      ),
    }))
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

  setZoneWeight(id, weight) {
    set(s => ({ zones: s.zones.map(z => z.id === id ? { ...z, weight } : z) }))
  },

  // Focus Time — called only once, when a session's countdown reaches zero
  // uninterrupted (see features/dashboard/components/FocusTimeCard.tsx). No
  // reward for a cancelled/abandoned session.
  completeFocusSession(today, minutes) {
    const reward = focusReward(minutes)
    set(s => ({
      rewardWallet: s.rewardWallet + reward.pts,
      rankXP:       s.rankXP + reward.xp,
      focusSessions: [...s.focusSessions, { date: today, minutes, pts: reward.pts, xp: reward.xp, at: new Date().toISOString() }],
    }))
    return reward
  },
})
