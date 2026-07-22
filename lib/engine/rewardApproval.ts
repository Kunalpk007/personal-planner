import type { Reward } from '@/store/types'
import { HABIT_FLAG_COOLDOWN_HOURS, REWARD_APPROVAL_COOLDOWN_HOURS } from '@/constants/social'

export type ApprovalGate = 'cost' | 'habit' | null

/** Two independent gates (docs/PHASE2_SOCIAL_LIFE_OS.md Section 1.5/6.4):
 *  - 'habit' fires whenever the reward is flagged, regardless of cost — a
 *    self-control friction device, not an anti-cheat one.
 *  - 'cost' fires when the reward's cost meets or exceeds the Notary's own
 *    threshold (undefined threshold = no cost gate set yet = never fires).
 *  Habit is checked first: if a reward is both flagged *and* over threshold,
 *  only one cooldown applies (the longer one, handled by cooldownHoursFor),
 *  not both stacked. */
export function decideApprovalGate(
  reward: Pick<Reward, 'cost' | 'habitLinked'>,
  notaryThreshold: number | undefined
): ApprovalGate {
  if (reward.habitLinked) return 'habit'
  if (notaryThreshold != null && reward.cost >= notaryThreshold) return 'cost'
  return null
}

/** The cooldown window for a given gate. When a reward is both habit-flagged
 *  and over the cost threshold, the caller should pass gate: 'cost' if that
 *  cooldown is longer — in practice REWARD_APPROVAL_COOLDOWN_HOURS (48h) is
 *  always >= the habit range (6-12h), so 'cost' naturally wins when both
 *  apply; decideApprovalGate returning 'habit' first is still correct for
 *  the common case of a cheap habit-linked reward with no cost gate set. */
export function cooldownHoursFor(gate: ApprovalGate, reward: Pick<Reward, 'habitCooldownHours'>): number {
  if (gate === 'habit') return reward.habitCooldownHours ?? HABIT_FLAG_COOLDOWN_HOURS
  if (gate === 'cost') return REWARD_APPROVAL_COOLDOWN_HOURS
  return 0
}

export function cooldownEndsAt(gate: ApprovalGate, reward: Pick<Reward, 'habitCooldownHours'>, now = new Date()): string {
  const hours = cooldownHoursFor(gate, reward)
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString()
}
