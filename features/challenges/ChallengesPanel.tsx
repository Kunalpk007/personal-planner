'use client'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { usePlannerStore } from '@/store'
import { useSocialStore } from '@/store/social/social.store'
import { Modal } from '@/ui/Modal'
import { showToast } from '@/ui/Toast'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/ui/Pagination'
import type { Task, Goal } from '@/store/types'
import type { SharedTask } from '@/store/social/types'

const PAGE_SIZE = 6

const CANCEL_REASONS = [
  'Changed my mind',
  'No longer relevant',
  'Too ambitious for now',
  'Ran out of time',
  'Other',
]

/** A challenged task carries forward day to day like any other incomplete
 *  task (see carryTask/runOvernightLogic) — each carry gets a fresh task id
 *  but keeps the same `challengeId`, so an ongoing challenge can have
 *  several dated copies sitting in `tasks` at once (yesterday's now-orphaned
 *  copy, today's active one, etc). Collapse to just the most recent one per
 *  challenge so this list shows exactly one live row per challenge instead
 *  of a growing pile of stale duplicates. */
function latestPerChallenge(tasks: Task[]): Task[] {
  const byChallenge = new Map<string, Task>()
  for (const t of tasks) {
    const key = t.challengeId ?? t.id
    const existing = byChallenge.get(key)
    if (!existing || t.date > existing.date || (t.date === existing.date && t.createdAt > existing.createdAt)) {
      byChallenge.set(key, t)
    }
  }
  return [...byChallenge.values()]
}

type AcceptedItem =
  | { kind: 'incoming'; key: string; data: SharedTask }
  | { kind: 'goal';     key: string; data: Goal }
  | { kind: 'task';     key: string; data: Task }

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pending',           color: 'var(--vx-fg-4)' },
  accepted: { label: 'Accepted',          color: 'var(--vx-amber)' },
  declined: { label: 'Declined',          color: 'var(--red)'   },
  done:     { label: 'Completed ✓',       color: 'var(--vx-emerald)' },
}

/** Replaces the old Goals tab. Two sub-views:
 *  - "Challenges given" → everything I've sent (tasks + goals), any status
 *  - "My Challenges"    → incoming ones to respond to, plus the challenge
 *                         tasks/goals already on my own list.
 *  Deep-linkable via ?sub=given|accepted (e.g. from a notification click). */
export function ChallengesPanel() {
  const searchParams = useSearchParams()
  // Default sub-tab is "My Challenges" (accepted) — that's the actionable
  // one (things to respond to / work on), "Challenges given" is more of a
  // sent-log you check less often. Still overridable via ?sub=, e.g. from a
  // notification click that specifically wants "given".
  const [sub, setSub] = useState<'given' | 'accepted'>('accepted')

  useEffect(() => {
    const s = searchParams.get('sub')
    if (s === 'given' || s === 'accepted') setSub(s)
  }, [searchParams])

  const friends            = useSocialStore(s => s.friends)
  const sentChallenges     = useSocialStore(s => s.sentChallenges)
  const incomingChallenges = useSocialStore(s => s.incomingChallenges)
  const acceptChallenge    = useSocialStore(s => s.acceptChallenge)
  const declineChallenge   = useSocialStore(s => s.declineChallenge)
  const sendChallengeReminder = useSocialStore(s => s.sendChallengeReminder)
  const validationsToReview = useSocialStore(s => s.validationsToReview)
  const approveValidation   = useSocialStore(s => s.approveValidation)
  const rejectValidation    = useSocialStore(s => s.rejectValidation)

  const tasks = usePlannerStore(s => s.tasks)
  const goals = usePlannerStore(s => s.goals)
  const toggleTask              = usePlannerStore(s => s.toggleTask)
  const cancelTask               = usePlannerStore(s => s.cancelTask)
  const toggleGoalChecklistItem = usePlannerStore(s => s.toggleGoalChecklistItem)
  const completeGoal            = usePlannerStore(s => s.completeGoal)
  const uncompleteGoal          = usePlannerStore(s => s.uncompleteGoal)
  const cancelGoal              = usePlannerStore(s => s.cancelGoal)

  const [cancelTarget, setCancelTarget] = useState<{ kind: 'task' | 'goal'; id: string; title: string; from?: string } | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // Challenge items already on my own list (accepted earlier). Not filtered
  // to "not cancelled/not done" — a completed or cancelled challenge should
  // still show here (with its resolved status), just not editable further.
  // See `latestPerChallenge`'s doc comment for why tasks need deduping and
  // goals don't (goals aren't date-carried the way tasks are).
  const acceptedTasks = latestPerChallenge(tasks.filter(t => t.challengedBy))
  const acceptedGoals = goals.filter(g => g.challengedBy)

  const sortedSent = useMemo(
    () => [...sentChallenges].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))),
    [sentChallenges]
  )
  const given = usePagination(sortedSent, PAGE_SIZE)

  const acceptedItems = useMemo<AcceptedItem[]>(() => [
    ...incomingChallenges.map(c => ({ kind: 'incoming' as const, key: `in:${c.id}`, data: c })),
    ...acceptedGoals.map(g => ({ kind: 'goal' as const, key: `g:${g.id}`, data: g })),
    ...acceptedTasks.map(t => ({ kind: 'task' as const, key: `t:${t.id}`, data: t })),
  ], [incomingChallenges, acceptedGoals, acceptedTasks])
  const accepted = usePagination(acceptedItems, PAGE_SIZE)

  return (
    <div>
      {/* Tasks a friend asked you to validate before they count */}
      {validationsToReview.length > 0 && (
        <div className="vx-tile vx-accent-l p-3.5 mb-3" data-tone="purple">
          <div className="text-[13px] font-medium mb-2">Tasks to validate</div>
          {validationsToReview.map(v => (
            <div key={v.id} className="flex items-center gap-2 flex-wrap py-1.5 text-[12px]">
              <span className="flex-1 break-words [overflow-wrap:anywhere] min-w-0">{v.ownerName} did: &ldquo;{v.taskTitle}&rdquo;</span>
              <button onClick={() => approveValidation(v.id)} className="vx-btn vx-btn-primary text-[11px] px-2.5 py-1">Approve</button>
              <button onClick={() => rejectValidation(v.id, null)} className="vx-btn vx-btn-danger text-[11px] px-2.5 py-1">Reject</button>
            </div>
          ))}
        </div>
      )}

      <div className="vx-modeswitch mb-3.5">
        {[
          { k: 'given',    l: 'Challenges given' },
          { k: 'accepted', l: 'My Challenges' },
        ].map(m => (
          <button key={m.k} onClick={() => setSub(m.k as 'given' | 'accepted')}
            className={`vx-modeswitch-item ${sub === m.k ? 'vx-active' : ''}`}>
            {sub === m.k && (
              <motion.div layoutId="vx-challenges-sub-indicator" className="vx-modeswitch-indicator"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
            )}
            <span className="relative z-10">{m.l}</span>
          </button>
        ))}
      </div>

      {sub === 'given' && (
        <>
          {sortedSent.length === 0 && <div className="text-[13px] py-3.5 text-center" style={{ color: 'var(--vx-fg-4)' }}>You haven&apos;t sent any challenges yet.</div>}
          {given.pageItems.map(c => {
            const friendUid = c.participantUids[0]
            const friendName = friends.find(f => f.uid === friendUid)?.displayName ?? friendUid
            const status = c.perUserStatus[friendUid] ?? 'pending'
            const meta = STATUS_META[status] ?? STATUS_META.pending
            const isGoal = c.type === 'goal'
            return (
              <div key={c.id} className="vx-tile mb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="vx-chip mr-1" data-tone={isGoal ? 'cyan' : 'violet'}>{isGoal ? 'GOAL' : 'TASK'}</span>
                    <span className="text-[13px] break-words [overflow-wrap:anywhere]">{c.title}</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ color: meta.color, background: `${meta.color}1a` }}>{meta.label}</span>
                </div>
                <div className="text-[11px] mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--vx-fg-4)' }}>
                  <span>
                    → {friendName}
                    {isGoal && <> · {c.checklist?.length ?? 0} subtasks{c.endDate ? ` · by ${c.endDate}` : ''}{c.completionPoints != null ? ` · +${c.completionPoints} pts (${c.delayPoints ?? Math.round(c.completionPoints * 0.5)} if late)` : ''}</>}
                  </span>
                  {status === 'pending' && (
                    <button
                      onClick={() => { sendChallengeReminder(c.id, friendUid); showToast(`Reminder sent to ${friendName}.`) }}
                      className="vx-btn vx-btn-ghost ml-auto text-[11px] px-2 py-0.5"
                    >
                      🔔 Send Reminder
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          <Pagination page={given.page} totalPages={given.totalPages} hasPrev={given.hasPrev} hasNext={given.hasNext} onPrev={given.prevPage} onNext={given.nextPage} />
        </>
      )}

      {sub === 'accepted' && (
        <>
          {acceptedItems.length === 0 && (
            <div className="text-[13px] py-3.5 text-center" style={{ color: 'var(--vx-fg-4)' }}>No challenges accepted yet.</div>
          )}
          {accepted.pageItems.map(item => {
            if (item.kind === 'incoming') {
              const c = item.data
              return (
                <div key={item.key} className="vx-tile vx-accent-l mb-2" data-tone="purple">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <span className="text-[12px] break-words [overflow-wrap:anywhere] min-w-0 flex-1">
                      <span className="vx-chip mr-1" data-tone={c.type === 'goal' ? 'cyan' : 'violet'}>{c.type === 'goal' ? 'GOAL' : 'TASK'}</span>
                      {c.ownerName}: &ldquo;{c.title}&rdquo;
                      {c.type === 'goal' && <span style={{ color: 'var(--vx-fg-4)' }}> · {c.checklist?.length ?? 0} subtasks{c.endDate ? ` · by ${c.endDate}` : ''}{c.completionPoints != null ? ` · +${c.completionPoints} pts` : ''}</span>}
                    </span>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => { acceptChallenge(c); showToast('Challenge accepted.') }} className="vx-btn vx-btn-accent text-[11px] px-2.5 py-1">Accept</button>
                      <button onClick={() => declineChallenge(c.id)} className="vx-btn vx-btn-ghost text-[11px] px-2.5 py-1">Decline</button>
                    </div>
                  </div>
                </div>
              )
            }
            if (item.kind === 'goal') {
              const g = item.data
              const items = g.checklist ?? []
              const doneCount = items.filter(i => i.done).length
              const allDone = items.length === 0 || items.every(i => i.done)
              const completed = !!g.completedAt
              const cancelled = !!g.cancelledAt
              function handleComplete() {
                if (completed) {
                  const r = uncompleteGoal(g.id)
                  if (r) showToast(`Goal unmarked — -${r.pts} RXP · -${r.walletPts} 🪙 reversed.`)
                  return
                }
                if (!allDone) { showToast('Finish all subtasks first.'); return }
                const r = completeGoal(g.id)
                if (r) showToast(`🎯 Goal complete! +${r.pts} RXP · +${r.walletPts} 🪙`)
              }
              return (
                <div key={item.key} className={`vx-tile vx-accent-l flex items-start gap-2.5 mb-2 ${cancelled ? 'opacity-45' : ''}`} data-tone="cyan">
                  {!cancelled && (
                    <button
                      onClick={handleComplete}
                      disabled={!completed && !allDone}
                      title={completed ? 'Completed — tap to unmark' : allDone ? 'Mark goal complete' : 'Finish all subtasks first'}
                      className={`vx-check mt-0.5 ${completed ? 'vx-done' : allDone ? 'vx-pending' : ''}`}
                      style={allDone && !completed ? { borderColor: 'var(--vx-emerald)', color: 'var(--vx-emerald)' } : undefined}
                    >
                      {completed ? '✓' : allDone ? '✓' : ''}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[12px] break-words [overflow-wrap:anywhere] min-w-0">
                        <span className="vx-chip mr-1" data-tone="cyan">GOAL</span>
                        <span className={completed ? 'line-through' : ''}>{g.title}</span>
                        <span style={{ color: 'var(--vx-fg-4)' }}> · from {g.challengedBy}</span>
                      </span>
                      {!completed && !cancelled && (
                        <button onClick={() => { setCancelTarget({ kind: 'goal', id: g.id, title: g.title, from: g.challengedBy }); setCancelReason('') }} className="vx-btn vx-btn-icon flex-shrink-0" title="Cancel goal" aria-label="Cancel goal">🚫</button>
                      )}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--vx-fg-4)' }}>
                      {cancelled ? `Cancelled${g.cancelReason ? `: ${g.cancelReason}` : ''}` : items.length > 0 ? `${doneCount}/${items.length} done` : null}
                    </div>
                    {!cancelled && items.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {items.map(gi => (
                          <label key={gi.id} className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={gi.done}
                              disabled={completed}
                              onChange={() => {
                                const r = toggleGoalChecklistItem(g.id, gi.id)
                                if (r) showToast(`Goal unmarked — -${r.pts} RXP · -${r.walletPts} 🪙 reversed.`)
                              }}
                            />
                            <span className="break-words [overflow-wrap:anywhere] min-w-0 flex-1" style={{ textDecoration: gi.done ? 'line-through' : 'none', color: gi.done ? 'var(--vx-fg-4)' : 'var(--vx-fg-2)' }}>
                              {gi.title}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            }
            const t = item.data
            const cancelled = !!t.cancelledAt
            return (
              <div key={item.key} className="vx-tile flex items-start gap-2.5 mb-2">
                {!cancelled && (
                  <button
                    onClick={() => {
                      const r = toggleTask(t.id)
                      if (r) showToast(`+${r.pts} RXP · +${r.walletPts} 🪙`)
                    }}
                    className={`vx-check mt-0.5 ${t.done ? 'vx-done' : ''}`}
                    title={t.done ? 'Completed — tap to unmark' : 'Mark task complete'}
                  >
                    {t.done ? '✓' : ''}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[12px] break-words [overflow-wrap:anywhere] min-w-0">
                      <span className="vx-chip mr-1" data-tone="violet">TASK</span>
                      <span className={t.done ? 'line-through' : ''}>{t.title}</span>
                      <span style={{ color: 'var(--vx-fg-4)' }}> · from {t.challengedBy}</span>
                    </span>
                    {!t.done && !cancelled && (
                      <button onClick={() => { setCancelTarget({ kind: 'task', id: t.id, title: t.title, from: t.challengedBy }); setCancelReason('') }} className="vx-btn vx-btn-icon flex-shrink-0" title="Cancel task" aria-label="Cancel task">🚫</button>
                    )}
                  </div>
                  {cancelled && (
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--vx-fg-4)' }}>
                      Cancelled{t.cancelReason ? `: ${t.cancelReason}` : ''}
                    </div>
                  )}
                  {(t.carriedDays ?? 0) > 0 && !t.done && !cancelled && (
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--vx-fg-4)' }}>
                      Carried {t.carriedDays} day{t.carriedDays === 1 ? '' : 's'} — still open, no expiry on a challenge.
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <Pagination page={accepted.page} totalPages={accepted.totalPages} hasPrev={accepted.hasPrev} hasNext={accepted.hasNext} onPrev={accepted.prevPage} onNext={accepted.nextPage} />
        </>

      )}

      <Modal
        open={!!cancelTarget}
        onClose={() => { setCancelTarget(null); setCancelReason('') }}
        title={`Cancel ${cancelTarget?.kind === 'goal' ? 'goal' : 'task'}?`}
        variant="vx"
      >
        <p className="text-sm mb-3" style={{ color: 'var(--vx-fg-2)' }}>
          Why are you cancelling &ldquo;{cancelTarget?.title}&rdquo;? {cancelTarget?.from} will be notified.
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {CANCEL_REASONS.map(r => (
            <button
              key={r}
              onClick={() => setCancelReason(r)}
              className={`vx-btn ${cancelReason === r ? 'vx-btn-primary' : 'vx-btn-ghost'} text-left justify-start w-full text-[13px]`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => { setCancelTarget(null); setCancelReason('') }} className="vx-btn vx-btn-ghost text-sm">Go back</button>
          <button
            onClick={() => {
              if (!cancelReason || !cancelTarget) return
              const ok = cancelTarget.kind === 'goal'
                ? cancelGoal(cancelTarget.id, cancelReason)
                : cancelTask(cancelTarget.id, cancelReason)
              setCancelTarget(null); setCancelReason('')
              if (ok) showToast(`${cancelTarget.kind === 'goal' ? 'Goal' : 'Task'} cancelled.`)
            }}
            disabled={!cancelReason}
            className="vx-btn vx-btn-danger text-sm"
          >
            Cancel {cancelTarget?.kind === 'goal' ? 'goal' : 'task'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
