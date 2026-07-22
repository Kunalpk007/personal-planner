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

  it('addChallengeGoal creates a checklist goal from titles, trimming blanks, tagged with challengedBy/endDate', () => {
    const id = usePlannerStore.getState().addChallengeGoal(
      'Get fit', ['Run 5k', '  ', 'Eat clean'], '2026-09-01', 'Bob'
    )

    const goal = usePlannerStore.getState().goals.find(g => g.id === id)!
    expect(goal.title).toBe('Get fit')
    expect(goal.targetType).toBe('checklist')
    expect(goal.target).toBe(2)
    expect(goal.checklist?.map(i => i.title)).toEqual(['Run 5k', 'Eat clean'])
    expect(goal.checklist?.every(i => i.done === false)).toBe(true)
    expect(goal.endDate).toBe('2026-09-01')
    expect(goal.challengedBy).toBe('Bob')
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
