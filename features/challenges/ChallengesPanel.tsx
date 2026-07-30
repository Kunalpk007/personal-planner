'use client'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { usePlannerStore } from '@/store'
import { useSocialStore } from '@/store/social/social.store'
import { showToast } from '@/ui/Toast'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/ui/Pagination'
import type { Task, Goal } from '@/store/types'
import type { SharedTask } from '@/store/social/types'

const PAGE_SIZE = 6

type AcceptedItem =
  | { kind: 'incoming'; key: string; data: SharedTask }
  | { kind: 'goal';     key: string; data: Goal }
  | { kind: 'task';     key: string; data: Task }

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pending',           color: 'var(--text3)' },
  accepted: { label: 'Accepted',          color: 'var(--amber)' },
  declined: { label: 'Declined',          color: 'var(--red)'   },
  done:     { label: 'Completed ✓',       color: 'var(--green)' },
}

/** Replaces the old Goals tab. Two sub-views:
 *  - "Challenges given" → everything I've sent (tasks + goals), any status
 *  - "My Challenges"    → incoming ones to respond to, plus the challenge
 *                         tasks/goals already on my own list.
 *  Deep-linkable via ?sub=given|accepted (e.g. from a notification click). */
export function ChallengesPanel() {
  const searchParams = useSearchParams()
  const [sub, setSub] = useState<'given' | 'accepted'>('given')

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

  // Challenge items already on my own list (accepted earlier).
  const acceptedTasks = tasks.filter(t => t.challengedBy)
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
        <div className="rounded-[10px] border border-[var(--purple)] bg-[var(--bg)] p-3.5 mb-3">
          <div className="text-[13px] font-medium mb-2">Tasks to validate</div>
          {validationsToReview.map(v => (
            <div key={v.id} className="flex items-center gap-2 flex-wrap py-1.5 text-[12px]">
              <span className="flex-1 break-words [overflow-wrap:anywhere] min-w-0">{v.ownerName} did: &ldquo;{v.taskTitle}&rdquo;</span>
              <button onClick={() => approveValidation(v.id)} className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--green-mid)] text-white">Approve</button>
              <button onClick={() => rejectValidation(v.id, null)} className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border2)] text-[var(--red)]">Reject</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex bg-[var(--bg3)] rounded-[10px] p-1 mb-3.5">
        {[
          { k: 'given',    l: 'Challenges given' },
          { k: 'accepted', l: 'My Challenges' },
        ].map(m => (
          <button key={m.k} onClick={() => setSub(m.k as 'given' | 'accepted')}
            className={`flex-1 text-center px-4 py-1.5 text-[13px] font-medium rounded-[7px] transition-all ${sub === m.k ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm' : 'text-[var(--text2)]'}`}>
            {m.l}
          </button>
        ))}
      </div>

      {sub === 'given' && (
        <>
          {sortedSent.length === 0 && <div className="text-[13px] text-[var(--text3)] py-3.5 text-center">You haven&apos;t sent any challenges yet.</div>}
          {given.pageItems.map(c => {
            const friendUid = c.participantUids[0]
            const friendName = friends.find(f => f.uid === friendUid)?.displayName ?? friendUid
            const status = c.perUserStatus[friendUid] ?? 'pending'
            const meta = STATUS_META[status] ?? STATUS_META.pending
            const isGoal = c.type === 'goal'
            return (
              <div key={c.id} className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-3 mb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border mr-1 ${isGoal ? 'bg-[var(--blue-bg)] text-[var(--blue)] border-[var(--blue)]' : 'bg-[var(--purple-bg)] text-[var(--purple)] border-[#CECBF6]'}`}>{isGoal ? 'GOAL' : 'TASK'}</span>
                    <span className="text-[13px] break-words [overflow-wrap:anywhere]">{c.title}</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ color: meta.color, background: `${meta.color}1a` }}>{meta.label}</span>
                </div>
                <div className="text-[11px] text-[var(--text3)] mt-1 flex items-center gap-2 flex-wrap">
                  <span>
                    → {friendName}
                    {isGoal && <> · {c.checklist?.length ?? 0} subtasks{c.endDate ? ` · by ${c.endDate}` : ''}{c.completionPoints != null ? ` · +${c.completionPoints} pts (${c.delayPoints ?? Math.round(c.completionPoints * 0.5)} if late)` : ''}</>}
                  </span>
                  {status === 'pending' && (
                    <button
                      onClick={() => { sendChallengeReminder(c.id, friendUid); showToast(`Reminder sent to ${friendName}.`) }}
                      className="ml-auto text-[11px] px-2 py-0.5 rounded-full border border-[var(--border2)] text-[var(--text2)] flex items-center gap-1"
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
            <div className="text-[13px] text-[var(--text3)] py-3.5 text-center">No challenges accepted yet.</div>
          )}
          {accepted.pageItems.map(item => {
            if (item.kind === 'incoming') {
              const c = item.data
              return (
                <div key={item.key} className="rounded-[10px] border border-[var(--purple)] bg-[var(--bg)] p-3 mb-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <span className="text-[12px] break-words [overflow-wrap:anywhere] min-w-0 flex-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border mr-1 ${c.type === 'goal' ? 'bg-[var(--blue-bg)] text-[var(--blue)] border-[var(--blue)]' : 'bg-[var(--purple-bg)] text-[var(--purple)] border-[#CECBF6]'}`}>{c.type === 'goal' ? 'GOAL' : 'TASK'}</span>
                      {c.ownerName}: &ldquo;{c.title}&rdquo;
                      {c.type === 'goal' && <span className="text-[var(--text3)]"> · {c.checklist?.length ?? 0} subtasks{c.endDate ? ` · by ${c.endDate}` : ''}{c.completionPoints != null ? ` · +${c.completionPoints} pts` : ''}</span>}
                    </span>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => { acceptChallenge(c); showToast('Challenge accepted.') }} className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--purple)] text-white">Accept</button>
                      <button onClick={() => declineChallenge(c.id)} className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border2)] text-[var(--text3)]">Decline</button>
                    </div>
                  </div>
                </div>
              )
            }
            if (item.kind === 'goal') {
              const g = item.data
              return (
                <div key={item.key} className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-3 mb-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[12px] break-words [overflow-wrap:anywhere] min-w-0">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--blue-bg)] text-[var(--blue)] border border-[var(--blue)] mr-1">GOAL</span>
                      {g.title} <span className="text-[var(--text3)]">· from {g.challengedBy}</span>
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ color: g.completedAt ? 'var(--green)' : 'var(--amber)', background: g.completedAt ? 'var(--green-bg)' : 'var(--amber-bg)' }}>
                      {g.completedAt ? 'Completed ✓' : 'In progress'}
                    </span>
                  </div>
                </div>
              )
            }
            const t = item.data
            return (
              <div key={item.key} className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-3 mb-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] break-words [overflow-wrap:anywhere] min-w-0">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--purple-bg)] text-[var(--purple)] border border-[#CECBF6] mr-1">TASK</span>
                    {t.title} <span className="text-[var(--text3)]">· from {t.challengedBy}</span>
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ color: t.done ? 'var(--green)' : 'var(--amber)', background: t.done ? 'var(--green-bg)' : 'var(--amber-bg)' }}>
                    {t.done ? 'Completed ✓' : 'In progress'}
                  </span>
                </div>
              </div>
            )
          })}
          <Pagination page={accepted.page} totalPages={accepted.totalPages} hasPrev={accepted.hasPrev} hasNext={accepted.hasNext} onPrev={accepted.prevPage} onNext={accepted.nextPage} />
        </>
      )}
    </div>
  )
}
