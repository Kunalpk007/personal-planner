import { describe, it, expect, beforeEach } from 'vitest'
import { usePlannerStore } from '@/store'
import { resetStore } from './helpers'

beforeEach(resetStore)

describe('redeemReward', () => {
  it('fails when the reward id does not exist', () => {
    const result = usePlannerStore.getState().redeemReward('does-not-exist', '2024-01-08')
    expect(result).toBe(false)
    expect(usePlannerStore.getState().rewardRedemptions).toHaveLength(0)
  })

  it('fails when rewardWallet is below the reward cost', () => {
    const reward = usePlannerStore.getState().rewards[0] // r1, cost 15
    usePlannerStore.setState({ rewardWallet: reward.cost - 1 })

    const result = usePlannerStore.getState().redeemReward(reward.id, '2024-01-08')

    expect(result).toBe(false)
    expect(usePlannerStore.getState().rewardWallet).toBe(reward.cost - 1)
    expect(usePlannerStore.getState().rewardRedemptions).toHaveLength(0)
  })

  it('deducts the cost and logs a redemption on success', () => {
    const reward = usePlannerStore.getState().rewards[0] // r1, cost 15
    usePlannerStore.setState({ rewardWallet: 50 })

    const result = usePlannerStore.getState().redeemReward(reward.id, '2024-01-08')

    expect(result).toBe(true)
    const state = usePlannerStore.getState()
    expect(state.rewardWallet).toBe(50 - reward.cost)
    expect(state.rewardRedemptions).toHaveLength(1)
    expect(state.rewardRedemptions[0]).toMatchObject({ date: '2024-01-08', title: reward.title, cost: reward.cost })
    expect(state.rewardRedemptions[0].at).toBeTruthy()
  })
})

describe('requestRewardApproval / resolvePendingApproval / cancelPendingApproval / reassignPendingApproval', () => {
  function makeApproval(overrides: Partial<import('@/store/types').PendingRewardApproval> = {}) {
    return {
      id: 'a1', rewardId: 'r1', title: 'Order pizza', cost: 300, gate: 'cost' as const,
      notaryUid: 'notary-1', notaryName: 'Bob', createdAt: '2024-01-08T00:00:00.000Z',
      cooldownEndsAt: '2024-01-10T00:00:00.000Z',
      ...overrides,
    }
  }

  it('locks pts and adds a pending entry on request', () => {
    usePlannerStore.setState({ rewardWallet: 500 })
    usePlannerStore.getState().requestRewardApproval(makeApproval())

    const state = usePlannerStore.getState()
    expect(state.rewardWallet).toBe(200)
    expect(state.pendingRewardApprovals).toHaveLength(1)
    expect(state.pendingRewardApprovals[0]).toMatchObject({ id: 'a1', status: 'pending', cost: 300 })
  })

  it('does not request when wallet is insufficient', () => {
    usePlannerStore.setState({ rewardWallet: 100 })
    usePlannerStore.getState().requestRewardApproval(makeApproval())

    const state = usePlannerStore.getState()
    expect(state.rewardWallet).toBe(100)
    expect(state.pendingRewardApprovals).toHaveLength(0)
  })

  it('resolvePendingApproval("approved") finalizes a redemption without refunding', () => {
    usePlannerStore.setState({ rewardWallet: 500 })
    usePlannerStore.getState().requestRewardApproval(makeApproval())

    usePlannerStore.getState().resolvePendingApproval('a1', 'approved')

    const state = usePlannerStore.getState()
    expect(state.rewardWallet).toBe(200) // stays locked/spent, not refunded
    expect(state.rewardRedemptions).toHaveLength(1)
    expect(state.rewardRedemptions[0]).toMatchObject({ title: 'Order pizza', cost: 300 })
    expect(state.pendingRewardApprovals[0].status).toBe('approved')
  })

  it('resolvePendingApproval("rejected") refunds the locked pts', () => {
    usePlannerStore.setState({ rewardWallet: 500 })
    usePlannerStore.getState().requestRewardApproval(makeApproval())

    usePlannerStore.getState().resolvePendingApproval('a1', 'rejected')

    const state = usePlannerStore.getState()
    expect(state.rewardWallet).toBe(500)
    expect(state.rewardRedemptions).toHaveLength(0)
    expect(state.pendingRewardApprovals[0].status).toBe('rejected')
  })

  it('resolvePendingApproval is a no-op for an unknown id or an already-resolved entry', () => {
    usePlannerStore.setState({ rewardWallet: 500 })
    usePlannerStore.getState().requestRewardApproval(makeApproval())

    usePlannerStore.getState().resolvePendingApproval('does-not-exist', 'approved')
    expect(usePlannerStore.getState().pendingRewardApprovals[0].status).toBe('pending')

    usePlannerStore.getState().resolvePendingApproval('a1', 'approved')
    usePlannerStore.getState().resolvePendingApproval('a1', 'rejected') // already resolved — ignored
    expect(usePlannerStore.getState().rewardWallet).toBe(200) // not refunded a second time
  })

  it('cancelPendingApproval refunds pts and marks cancelled', () => {
    usePlannerStore.setState({ rewardWallet: 500 })
    usePlannerStore.getState().requestRewardApproval(makeApproval())

    usePlannerStore.getState().cancelPendingApproval('a1')

    const state = usePlannerStore.getState()
    expect(state.rewardWallet).toBe(500)
    expect(state.pendingRewardApprovals[0].status).toBe('cancelled')
  })

  it('cancelPendingApproval is a no-op for an unknown id or already-resolved entry', () => {
    usePlannerStore.setState({ rewardWallet: 500 })
    usePlannerStore.getState().requestRewardApproval(makeApproval())
    usePlannerStore.getState().cancelPendingApproval('a1')

    usePlannerStore.getState().cancelPendingApproval('does-not-exist')
    usePlannerStore.getState().cancelPendingApproval('a1') // already cancelled
    expect(usePlannerStore.getState().rewardWallet).toBe(500) // no double refund
  })

  it('resolvePendingApproval("cancelled") marks cancelled without refunding again', () => {
    usePlannerStore.setState({ rewardWallet: 500 })
    usePlannerStore.getState().requestRewardApproval(makeApproval())

    usePlannerStore.getState().resolvePendingApproval('a1', 'cancelled')

    const state = usePlannerStore.getState()
    expect(state.rewardWallet).toBe(200) // this path doesn't refund — cancelPendingApproval does that separately
    expect(state.pendingRewardApprovals[0].status).toBe('cancelled')
  })

  it('rejecting one pending approval leaves an unrelated pending approval untouched', () => {
    usePlannerStore.setState({ rewardWallet: 1000 })
    usePlannerStore.getState().requestRewardApproval(makeApproval({ id: 'a1', cost: 100 }))
    usePlannerStore.getState().requestRewardApproval(makeApproval({ id: 'a2', cost: 200 }))

    usePlannerStore.getState().resolvePendingApproval('a1', 'rejected')

    const other = usePlannerStore.getState().pendingRewardApprovals.find(a => a.id === 'a2')
    expect(other?.status).toBe('pending')
  })

  it('resolving one pending approval to "cancelled" leaves an unrelated pending approval untouched', () => {
    usePlannerStore.setState({ rewardWallet: 1000 })
    usePlannerStore.getState().requestRewardApproval(makeApproval({ id: 'a1', cost: 100 }))
    usePlannerStore.getState().requestRewardApproval(makeApproval({ id: 'a2', cost: 200 }))

    usePlannerStore.getState().resolvePendingApproval('a1', 'cancelled')

    const other = usePlannerStore.getState().pendingRewardApprovals.find(a => a.id === 'a2')
    expect(other?.status).toBe('pending')
  })

  it('resolving one pending approval leaves an unrelated pending approval untouched', () => {
    usePlannerStore.setState({ rewardWallet: 1000 })
    usePlannerStore.getState().requestRewardApproval(makeApproval({ id: 'a1', cost: 100 }))
    usePlannerStore.getState().requestRewardApproval(makeApproval({ id: 'a2', cost: 200 }))

    usePlannerStore.getState().resolvePendingApproval('a1', 'approved')

    const other = usePlannerStore.getState().pendingRewardApprovals.find(a => a.id === 'a2')
    expect(other?.status).toBe('pending')
  })

  it('cancelling one pending approval leaves an unrelated pending approval untouched', () => {
    usePlannerStore.setState({ rewardWallet: 1000 })
    usePlannerStore.getState().requestRewardApproval(makeApproval({ id: 'a1', cost: 100 }))
    usePlannerStore.getState().requestRewardApproval(makeApproval({ id: 'a2', cost: 200 }))

    usePlannerStore.getState().cancelPendingApproval('a1')

    const other = usePlannerStore.getState().pendingRewardApprovals.find(a => a.id === 'a2')
    expect(other?.status).toBe('pending')
  })

  it('reassignPendingApproval updates the notary and cooldown', () => {
    usePlannerStore.setState({ rewardWallet: 500 })
    usePlannerStore.getState().requestRewardApproval(makeApproval())

    usePlannerStore.getState().reassignPendingApproval('a1', 'notary-2', 'Carol', '2024-01-12T00:00:00.000Z')

    const entry = usePlannerStore.getState().pendingRewardApprovals[0]
    expect(entry.notaryUid).toBe('notary-2')
    expect(entry.notaryName).toBe('Carol')
    expect(entry.cooldownEndsAt).toBe('2024-01-12T00:00:00.000Z')
  })

  it('reassignPendingApproval leaves an unrelated pending approval untouched', () => {
    usePlannerStore.setState({ rewardWallet: 1000 })
    usePlannerStore.getState().requestRewardApproval(makeApproval({ id: 'a1', cost: 100 }))
    usePlannerStore.getState().requestRewardApproval(makeApproval({ id: 'a2', cost: 200, notaryUid: 'notary-1', notaryName: 'Bob' }))

    usePlannerStore.getState().reassignPendingApproval('a1', 'notary-2', 'Carol', '2024-01-12T00:00:00.000Z')

    const other = usePlannerStore.getState().pendingRewardApprovals.find(a => a.id === 'a2')
    expect(other?.notaryUid).toBe('notary-1')
    expect(other?.notaryName).toBe('Bob')
  })
})

describe('addZone / removeZone', () => {
  it('addZone appends a zone with a generated id', () => {
    const before = usePlannerStore.getState().zones.length
    usePlannerStore.getState().addZone('Work', '#ff0000')
    const zones = usePlannerStore.getState().zones
    expect(zones).toHaveLength(before + 1)
    expect(zones.at(-1)).toMatchObject({ name: 'Work', color: '#ff0000' })
    expect(zones.at(-1)?.id).toBeTruthy()
  })

  it('removeZone removes a zone by id when multiple zones exist', () => {
    usePlannerStore.getState().addZone('Zone A', '#aaa')
    usePlannerStore.getState().addZone('Zone B', '#bbb')
    const zones = usePlannerStore.getState().zones
    const idToRemove = zones.at(-1)!.id

    usePlannerStore.getState().removeZone(idToRemove)

    expect(usePlannerStore.getState().zones.find(z => z.id === idToRemove)).toBeUndefined()
  })

  it('removeZone does nothing when only one zone remains', () => {
    // Reset to exactly one zone
    usePlannerStore.setState({ zones: [{ id: 'only', name: 'Only', color: '#000' }] })
    usePlannerStore.getState().removeZone('only')
    expect(usePlannerStore.getState().zones).toHaveLength(1)
  })
})

describe('addReward / removeReward', () => {
  it('adds a reward with a generated id', () => {
    const before = usePlannerStore.getState().rewards.length
    usePlannerStore.getState().addReward({ title: 'Extra reward', cost: 30 })

    const rewards = usePlannerStore.getState().rewards
    expect(rewards).toHaveLength(before + 1)
    expect(rewards.at(-1)).toMatchObject({ title: 'Extra reward', cost: 30 })
    expect(rewards.at(-1)?.id).toBeTruthy()
  })

  it('removes a reward by id', () => {
    usePlannerStore.getState().addReward({ title: 'Extra reward', cost: 30 })
    const id = usePlannerStore.getState().rewards.at(-1)!.id
    const before = usePlannerStore.getState().rewards.length

    usePlannerStore.getState().removeReward(id)

    const rewards = usePlannerStore.getState().rewards
    expect(rewards).toHaveLength(before - 1)
    expect(rewards.find(r => r.id === id)).toBeUndefined()
  })
})
