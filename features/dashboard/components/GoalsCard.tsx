'use client'
import { useMemo } from 'react'
import { usePlannerStore } from '@/store'
import { computeGoalProgress, goalProgressPct } from '@/lib/engine/goals'
import { FLAGS } from '@/constants/feature-flags'

export function GoalsCard({ today }: { today: string }) {
  const goals   = usePlannerStore(s => s.goals)
  const history = usePlannerStore(s => s.history)
  const tasks   = usePlannerStore(s => s.tasks)
  const zones   = usePlannerStore(s => s.zones)
  const toggleGoalChecklistItem = usePlannerStore(s => s.toggleGoalChecklistItem)

  const rows = useMemo(() => goals.map(g => {
    const progress = computeGoalProgress(g, history, tasks, today)
    return { goal: g, progress, pct: goalProgressPct(g, progress) }
  }), [goals, history, tasks, today])

  if (!FLAGS.GOALS) return null

  return (
    <div className="card mb-3.5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-[15px]">🎯</span>
        <span className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide">Goals</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-[12px] text-[var(--text3)]">No goals yet — add one in Settings → Goals.</div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(({ goal, progress, pct }) => {
            const zoneName = goal.zoneId ? zones.find(z => z.id === goal.zoneId)?.name : null
            const isChecklist = goal.targetType === 'checklist'
            return (
              <div key={goal.id}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="truncate">
                    {goal.title}
                    {zoneName && <span className="text-[var(--text3)]"> · {zoneName}</span>}
                    <span className="text-[var(--text3)]"> · {isChecklist ? (goal.endDate ? `by ${goal.endDate}` : 'checklist') : goal.cadence}</span>
                    {goal.challengedBy && <span className="text-[var(--text3)]"> · from {goal.challengedBy}</span>}
                  </span>
                  <span className="text-[var(--text2)] flex-shrink-0 ml-2">{progress}/{goal.target}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg3)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--green-mid)' : 'var(--blue)' }}
                  />
                </div>
                {isChecklist && goal.checklist && goal.checklist.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {goal.checklist.map(item => (
                      <label key={item.id} className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => toggleGoalChecklistItem(goal.id, item.id)}
                        />
                        <span style={{ textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--text3)' : 'var(--text2)' }}>
                          {item.title}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
