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
