import { describe, it, expect, beforeEach } from 'vitest'
import { usePlannerStore } from '@/store'
import { resetStore } from './helpers'

beforeEach(resetStore)

describe('addGoal / removeGoal / editGoal', () => {
  it('adds a goal with a generated id and createdAt', () => {
    usePlannerStore.getState().addGoal({ title: 'Move more', cadence: 'weekly', targetType: 'taskCount', target: 5 })
    const goals = usePlannerStore.getState().goals
    expect(goals).toHaveLength(1)
    expect(goals[0]).toMatchObject({ title: 'Move more', cadence: 'weekly', targetType: 'taskCount', target: 5 })
    expect(goals[0].id).toBeTruthy()
    expect(goals[0].createdAt).toBeTruthy()
  })

  it('removes a goal by id', () => {
    usePlannerStore.getState().addGoal({ title: 'Move more', cadence: 'weekly', targetType: 'taskCount', target: 5 })
    const id = usePlannerStore.getState().goals[0].id

    usePlannerStore.getState().removeGoal(id)

    expect(usePlannerStore.getState().goals).toHaveLength(0)
  })

  it('editGoal updates only the targeted goal', () => {
    usePlannerStore.getState().addGoal({ title: 'Move more', cadence: 'weekly', targetType: 'taskCount', target: 5 })
    usePlannerStore.getState().addGoal({ title: 'Save money', cadence: 'monthly', targetType: 'points', target: 500 })
    const [g1, g2] = usePlannerStore.getState().goals

    usePlannerStore.getState().editGoal(g1.id, { target: 10 })

    const goals = usePlannerStore.getState().goals
    expect(goals.find(g => g.id === g1.id)?.target).toBe(10)
    expect(goals.find(g => g.id === g2.id)?.target).toBe(500)
  })
})

describe('checklist goals', () => {
  it('addGoal syncs target to checklist.length for checklist-type goals', () => {
    usePlannerStore.getState().addGoal({
      title: 'Trip prep', cadence: 'weekly', targetType: 'checklist', target: 999,
      checklist: [
        { id: 'i1', title: 'Book flights', done: false },
        { id: 'i2', title: 'Pack bags', done: false },
      ],
    })
    const goal = usePlannerStore.getState().goals[0]
    expect(goal.target).toBe(2)
  })

  it('addGoal defaults target to 0 for a checklist goal created with no checklist', () => {
    usePlannerStore.getState().addGoal({
      title: 'No list', cadence: 'weekly', targetType: 'checklist', target: 999,
    })
    const goal = usePlannerStore.getState().goals[0]
    expect(goal.target).toBe(0)
  })

  it('editGoal defaults target to 0 when switching a goal to checklist type with no checklist', () => {
    usePlannerStore.getState().addGoal({ title: 'Points goal', cadence: 'weekly', targetType: 'points', target: 100 })
    const id = usePlannerStore.getState().goals[0].id

    usePlannerStore.getState().editGoal(id, { targetType: 'checklist' })

    expect(usePlannerStore.getState().goals[0].target).toBe(0)
  })

  it('editGoal re-syncs target when the checklist changes', () => {
    usePlannerStore.getState().addGoal({
      title: 'Trip prep', cadence: 'weekly', targetType: 'checklist', target: 2,
      checklist: [{ id: 'i1', title: 'Book flights', done: false }, { id: 'i2', title: 'Pack bags', done: false }],
    })
    const id = usePlannerStore.getState().goals[0].id

    usePlannerStore.getState().editGoal(id, {
      checklist: [{ id: 'i1', title: 'Book flights', done: false }],
    })

    expect(usePlannerStore.getState().goals[0].target).toBe(1)
  })

  it('toggleGoalChecklistItem flips only the targeted item on the targeted goal', () => {
    usePlannerStore.getState().addGoal({
      title: 'Trip prep', cadence: 'weekly', targetType: 'checklist', target: 2,
      checklist: [{ id: 'i1', title: 'Book flights', done: false }, { id: 'i2', title: 'Pack bags', done: false }],
    })
    const goalId = usePlannerStore.getState().goals[0].id

    usePlannerStore.getState().toggleGoalChecklistItem(goalId, 'i1')

    const items = usePlannerStore.getState().goals[0].checklist!
    expect(items.find(i => i.id === 'i1')?.done).toBe(true)
    expect(items.find(i => i.id === 'i2')?.done).toBe(false)

    usePlannerStore.getState().toggleGoalChecklistItem(goalId, 'i1')
    expect(usePlannerStore.getState().goals[0].checklist!.find(i => i.id === 'i1')?.done).toBe(false)
  })

  it('toggleGoalChecklistItem is a no-op for a goal with no checklist', () => {
    usePlannerStore.getState().addGoal({ title: 'Points goal', cadence: 'weekly', targetType: 'points', target: 100 })
    const goalId = usePlannerStore.getState().goals[0].id

    usePlannerStore.getState().toggleGoalChecklistItem(goalId, 'missing')

    expect(usePlannerStore.getState().goals[0].checklist).toBeUndefined()
  })

  it('addChallengeGoal creates a checklist goal with giver points, trimming blanks, tagged with challengedBy/endDate', () => {
    const id = usePlannerStore.getState().addChallengeGoal(
      'Get fit', ['Run 5k', '  ', 'Eat clean'], '2026-09-01', 'Bob', 40, 20
    )

    const goal = usePlannerStore.getState().goals.find(g => g.id === id)!
    expect(goal.title).toBe('Get fit')
    expect(goal.targetType).toBe('checklist')
    expect(goal.target).toBe(2)
    expect(goal.checklist?.map(i => i.title)).toEqual(['Run 5k', 'Eat clean'])
    expect(goal.checklist?.every(i => i.done === false)).toBe(true)
    expect(goal.endDate).toBe('2026-09-01')
    expect(goal.challengedBy).toBe('Bob')
    expect(goal.pointsMode).toBe('whole')
    expect(goal.points).toBe(40)
    expect(goal.delayPoints).toBe(20)
  })

  it('completeGoal awards whole points once all subtasks are done, and refuses otherwise', () => {
    usePlannerStore.setState({ rankXP: 0, rewardWallet: 0 })
    usePlannerStore.getState().addGoal({
      title: 'Ship it', cadence: 'weekly', targetType: 'checklist', target: 2,
      pointsMode: 'whole', points: 20, completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: false }, { id: 'b', title: 'y', done: false }],
    })
    const gid = usePlannerStore.getState().goals[0].id

    // subtasks pending -> cannot complete
    expect(usePlannerStore.getState().completeGoal(gid)).toBeNull()

    usePlannerStore.getState().toggleGoalChecklistItem(gid, 'a')
    usePlannerStore.getState().toggleGoalChecklistItem(gid, 'b')
    const r = usePlannerStore.getState().completeGoal(gid)

    expect(r).toEqual({ pts: 20, walletPts: 10 })
    const g = usePlannerStore.getState().goals[0]
    expect(g.completedAt).toBeTruthy()
    expect(usePlannerStore.getState().rankXP).toBe(20)
    expect(usePlannerStore.getState().rewardWallet).toBe(10)
    // already complete -> null
    expect(usePlannerStore.getState().completeGoal(gid)).toBeNull()
  })

  it('completeGoal sums per-subtask points', () => {
    usePlannerStore.setState({ rankXP: 0, rewardWallet: 0 })
    usePlannerStore.getState().addGoal({
      title: 'PerSub', cadence: 'weekly', targetType: 'checklist', target: 2,
      pointsMode: 'perSubtask', completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: true, points: 6 }, { id: 'b', title: 'y', done: true, points: 4 }],
    })
    const gid = usePlannerStore.getState().goals[0].id
    const r = usePlannerStore.getState().completeGoal(gid)
    expect(r?.pts).toBe(10)
  })

  it('completeGoal reduces points to delayPoints when past the deadline', () => {
    usePlannerStore.setState({ rankXP: 0, rewardWallet: 0 })
    usePlannerStore.getState().addGoal({
      title: 'Late', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 40, delayPoints: 12, endDate: '2000-01-01', completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: true }],
    })
    const gid = usePlannerStore.getState().goals[0].id
    const r = usePlannerStore.getState().completeGoal(gid)
    expect(r?.pts).toBe(12) // past deadline -> giver's delayPoints
  })

  it('setGoalNote saves a note onto the goal', () => {
    usePlannerStore.getState().addGoal({ title: 'N', cadence: 'weekly', targetType: 'checklist', target: 0, pointsMode: 'whole', points: 5, completedAt: null, checklist: [] })
    const gid = usePlannerStore.getState().goals[0].id
    usePlannerStore.getState().setGoalNote(gid, 'remember this')
    expect(usePlannerStore.getState().goals[0].note).toBe('remember this')
  })

  it('setGoalNote leaves other goals untouched', () => {
    usePlannerStore.getState().addGoal({ title: 'A', cadence: 'weekly', targetType: 'checklist', target: 0, pointsMode: 'whole', points: 5, completedAt: null, checklist: [] })
    usePlannerStore.getState().addGoal({ title: 'B', cadence: 'weekly', targetType: 'checklist', target: 0, pointsMode: 'whole', points: 5, completedAt: null, checklist: [] })
    const [g1, g2] = usePlannerStore.getState().goals

    usePlannerStore.getState().setGoalNote(g1.id, 'note for A')

    const goals = usePlannerStore.getState().goals
    expect(goals.find(g => g.id === g1.id)?.note).toBe('note for A')
    expect(goals.find(g => g.id === g2.id)?.note).toBeUndefined()
  })

  it('completeGoal treats a missing per-subtask points value as 0 for that item', () => {
    usePlannerStore.setState({ rankXP: 0, rewardWallet: 0 })
    usePlannerStore.getState().addGoal({
      title: 'Mixed', cadence: 'weekly', targetType: 'checklist', target: 2,
      pointsMode: 'perSubtask', completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: true, points: 6 }, { id: 'b', title: 'y', done: true }],
    })
    const gid = usePlannerStore.getState().goals[0].id
    const r = usePlannerStore.getState().completeGoal(gid)
    expect(r?.pts).toBe(6) // item 'b' has no points -> contributes 0
  })

  it('completeGoal only updates the targeted goal, leaving other goals untouched', () => {
    usePlannerStore.setState({ rankXP: 0, rewardWallet: 0 })
    usePlannerStore.getState().addGoal({
      title: 'A', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 10, completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: true }],
    })
    usePlannerStore.getState().addGoal({
      title: 'B', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 15, completedAt: null,
      checklist: [{ id: 'b', title: 'y', done: false }],
    })
    const [g1, g2] = usePlannerStore.getState().goals

    usePlannerStore.getState().completeGoal(g1.id)

    const goals = usePlannerStore.getState().goals
    expect(goals.find(g => g.id === g1.id)?.completedAt).toBeTruthy()
    expect(goals.find(g => g.id === g2.id)?.completedAt).toBeFalsy()
  })

  it('completeGoal treats a missing checklist as 0 per-subtask points', () => {
    usePlannerStore.setState({ rankXP: 0, rewardWallet: 0 })
    usePlannerStore.getState().addGoal({
      title: 'No subs', cadence: 'weekly', targetType: 'checklist', target: 0,
      pointsMode: 'perSubtask', completedAt: null,
    })
    const gid = usePlannerStore.getState().goals[0].id
    const r = usePlannerStore.getState().completeGoal(gid)
    expect(r?.pts).toBe(0)
  })

  it('completeGoal treats a missing whole-goal points value as 0', () => {
    usePlannerStore.setState({ rankXP: 0, rewardWallet: 0 })
    usePlannerStore.getState().addGoal({
      title: 'No pts', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: true }],
    })
    const gid = usePlannerStore.getState().goals[0].id
    const r = usePlannerStore.getState().completeGoal(gid)
    expect(r?.pts).toBe(0)
  })

  it('completeGoal defaults to half points when past deadline with no giver-declared delayPoints', () => {
    usePlannerStore.setState({ rankXP: 0, rewardWallet: 0 })
    usePlannerStore.getState().addGoal({
      title: 'Own goal, late', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 40, endDate: '2000-01-01', completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: true }],
    })
    const gid = usePlannerStore.getState().goals[0].id
    const r = usePlannerStore.getState().completeGoal(gid)
    expect(r?.pts).toBe(20) // half of 40, no explicit delayPoints
  })

  it('completeGoal snapshots the awarded points onto the goal as awardedPts', () => {
    usePlannerStore.setState({ rankXP: 0, rewardWallet: 0 })
    usePlannerStore.getState().addGoal({
      title: 'Snap', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 25, completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: true }],
    })
    const gid = usePlannerStore.getState().goals[0].id
    usePlannerStore.getState().completeGoal(gid)
    expect(usePlannerStore.getState().goals[0].awardedPts).toBe(25)
  })

  it('uncompleteGoal reverses a completed goal and claws back rankXP/rewardWallet', () => {
    usePlannerStore.setState({ rankXP: 50, rewardWallet: 30 })
    usePlannerStore.getState().addGoal({
      title: 'Undo me', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 20, completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: true }],
    })
    const gid = usePlannerStore.getState().goals[0].id
    usePlannerStore.getState().completeGoal(gid)
    expect(usePlannerStore.getState().rankXP).toBe(70)
    expect(usePlannerStore.getState().rewardWallet).toBe(40)

    const r = usePlannerStore.getState().uncompleteGoal(gid)

    expect(r).toEqual({ pts: 20, walletPts: 10 })
    const g = usePlannerStore.getState().goals[0]
    expect(g.completedAt).toBeNull()
    expect(g.awardedPts).toBeUndefined()
    expect(usePlannerStore.getState().rankXP).toBe(50)
    expect(usePlannerStore.getState().rewardWallet).toBe(30)
  })

  it('uncompleteGoal only reopens the targeted goal, leaving other goals untouched', () => {
    usePlannerStore.setState({ rankXP: 50, rewardWallet: 30 })
    usePlannerStore.getState().addGoal({
      title: 'A', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 20, completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: true }],
    })
    usePlannerStore.getState().addGoal({
      title: 'B', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 15, completedAt: null,
      checklist: [{ id: 'b', title: 'y', done: true }],
    })
    const [g1, g2] = usePlannerStore.getState().goals
    usePlannerStore.getState().completeGoal(g1.id)
    usePlannerStore.getState().completeGoal(g2.id)

    usePlannerStore.getState().uncompleteGoal(g1.id)

    const goals = usePlannerStore.getState().goals
    expect(goals.find(g => g.id === g1.id)?.completedAt).toBeNull()
    expect(goals.find(g => g.id === g2.id)?.completedAt).toBeTruthy()
  })

  it('toggleGoalChecklistItem reopen path only touches the targeted goal, leaving others untouched', () => {
    usePlannerStore.setState({ rankXP: 50, rewardWallet: 30 })
    usePlannerStore.getState().addGoal({
      title: 'A', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 20, completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: true }],
    })
    usePlannerStore.getState().addGoal({
      title: 'B', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 15, completedAt: null,
      checklist: [{ id: 'b', title: 'y', done: true }],
    })
    const [g1, g2] = usePlannerStore.getState().goals
    usePlannerStore.getState().completeGoal(g1.id)
    usePlannerStore.getState().completeGoal(g2.id)

    usePlannerStore.getState().toggleGoalChecklistItem(g1.id, 'a')

    const goals = usePlannerStore.getState().goals
    expect(goals.find(g => g.id === g1.id)?.completedAt).toBeNull()
    expect(goals.find(g => g.id === g2.id)?.completedAt).toBeTruthy()
    expect(goals.find(g => g.id === g2.id)?.checklist!.find(i => i.id === 'b')?.done).toBe(true)
  })

  it('uncompleteGoal is a no-op (returns null) for a goal that is not completed', () => {
    usePlannerStore.getState().addGoal({
      title: 'Never done', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 20, completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: false }],
    })
    const gid = usePlannerStore.getState().goals[0].id
    expect(usePlannerStore.getState().uncompleteGoal(gid)).toBeNull()
  })

  it('uncompleteGoal clamps rankXP/rewardWallet at 0 instead of going negative', () => {
    usePlannerStore.setState({ rankXP: 5, rewardWallet: 2 })
    usePlannerStore.getState().addGoal({
      title: 'Big award', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 100, completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: true }],
    })
    const gid = usePlannerStore.getState().goals[0].id
    usePlannerStore.getState().completeGoal(gid)
    // Spend the wallet/xp down externally so clawback would go negative.
    usePlannerStore.setState({ rankXP: 0, rewardWallet: 0 })

    usePlannerStore.getState().uncompleteGoal(gid)

    expect(usePlannerStore.getState().rankXP).toBe(0)
    expect(usePlannerStore.getState().rewardWallet).toBe(0)
  })

  it('toggleGoalChecklistItem reopens an already-completed goal and claws back points when a subtask is unchecked', () => {
    usePlannerStore.setState({ rankXP: 50, rewardWallet: 30 })
    usePlannerStore.getState().addGoal({
      title: 'Reopen me', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 20, completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: true }],
    })
    const gid = usePlannerStore.getState().goals[0].id
    usePlannerStore.getState().completeGoal(gid)

    const r = usePlannerStore.getState().toggleGoalChecklistItem(gid, 'a')

    expect(r).toEqual({ pts: 20, walletPts: 10 })
    const g = usePlannerStore.getState().goals[0]
    expect(g.completedAt).toBeNull()
    expect(g.checklist!.find(i => i.id === 'a')?.done).toBe(false)
    expect(usePlannerStore.getState().rankXP).toBe(50)
    expect(usePlannerStore.getState().rewardWallet).toBe(30)
  })

  it('toggleGoalChecklistItem returns null and leaves the checklist untouched for an unknown item id', () => {
    usePlannerStore.getState().addGoal({
      title: 'Has checklist', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 20, completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: false }],
    })
    const gid = usePlannerStore.getState().goals[0].id
    const r = usePlannerStore.getState().toggleGoalChecklistItem(gid, 'missing')
    expect(r).toBeNull()
    expect(usePlannerStore.getState().goals[0].checklist!.find(i => i.id === 'a')?.done).toBe(false)
  })

  it('uncompleteGoal treats a missing awardedPts (legacy pre-snapshot goal) as 0 clawback', () => {
    usePlannerStore.setState({ rankXP: 10, rewardWallet: 5 })
    usePlannerStore.getState().addGoal({
      title: 'Legacy', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 20, completedAt: new Date().toISOString(),
      checklist: [{ id: 'a', title: 'x', done: true }],
    })
    const gid = usePlannerStore.getState().goals[0].id

    const r = usePlannerStore.getState().uncompleteGoal(gid)

    expect(r).toEqual({ pts: 0, walletPts: 0 })
    expect(usePlannerStore.getState().rankXP).toBe(10)
    expect(usePlannerStore.getState().rewardWallet).toBe(5)
  })

  it('toggleGoalChecklistItem reopening a legacy completed goal (no awardedPts) claws back 0', () => {
    usePlannerStore.setState({ rankXP: 10, rewardWallet: 5 })
    usePlannerStore.getState().addGoal({
      title: 'Legacy reopen', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 20, completedAt: new Date().toISOString(),
      checklist: [{ id: 'a', title: 'x', done: true }],
    })
    const gid = usePlannerStore.getState().goals[0].id

    const r = usePlannerStore.getState().toggleGoalChecklistItem(gid, 'a')

    expect(r).toEqual({ pts: 0, walletPts: 0 })
    expect(usePlannerStore.getState().goals[0].completedAt).toBeNull()
    expect(usePlannerStore.getState().rankXP).toBe(10)
    expect(usePlannerStore.getState().rewardWallet).toBe(5)
  })

  it('toggleGoalChecklistItem on a not-yet-completed goal returns null and just flips the item, leaving other goals untouched', () => {
    usePlannerStore.getState().addGoal({
      title: 'Plain toggle', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 20, completedAt: null,
      checklist: [{ id: 'a', title: 'x', done: false }],
    })
    usePlannerStore.getState().addGoal({
      title: 'Other', cadence: 'weekly', targetType: 'checklist', target: 1,
      pointsMode: 'whole', points: 10, completedAt: null,
      checklist: [{ id: 'b', title: 'y', done: false }],
    })
    const [g1, g2] = usePlannerStore.getState().goals
    const r = usePlannerStore.getState().toggleGoalChecklistItem(g1.id, 'a')
    expect(r).toBeNull()
    expect(usePlannerStore.getState().goals.find(g => g.id === g1.id)?.checklist!.find(i => i.id === 'a')?.done).toBe(true)
    expect(usePlannerStore.getState().goals.find(g => g.id === g2.id)?.checklist!.find(i => i.id === 'b')?.done).toBe(false)
  })
})

describe('setZoneWeight', () => {
  it('sets a weight on the targeted zone only', () => {
    usePlannerStore.getState().addZone('Health', '#111')
    usePlannerStore.getState().addZone('Work', '#222')
    const zones = usePlannerStore.getState().zones
    const health = zones.find(z => z.name === 'Health')!
    const work = zones.find(z => z.name === 'Work')!

    usePlannerStore.getState().setZoneWeight(health.id, 3)

    const updated = usePlannerStore.getState().zones
    expect(updated.find(z => z.id === health.id)?.weight).toBe(3)
    expect(updated.find(z => z.id === work.id)?.weight).toBeUndefined()
  })
})
