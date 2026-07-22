import {
  collection, doc, getDoc, query, where, onSnapshot, serverTimestamp,
  writeBatch, updateDoc, deleteDoc, setDoc, Timestamp, type Unsubscribe,
} from 'firebase/firestore'
import { getClientDb } from './client'
import type { Friend, FriendRequest, RewardApproval, TaskValidation, SharedTask } from '@/store/social/types'
import type { FriendTag } from '@/constants/social'
import { REWARD_APPROVAL_COOLDOWN_HOURS, HABIT_FLAG_COOLDOWN_HOURS } from '@/constants/social'

/** Every doc type here is written with `createdAt: serverTimestamp()` (the
 *  local `new Date().toISOString()` value gets overwritten right before the
 *  actual Firestore write — see e.g. sendFriendRequest/sendTaskChallenge
 *  below) and some also get `resolvedAt: serverTimestamp()` on
 *  approve/reject. Firestore returns those as `Timestamp` objects on read,
 *  not plain strings — even though every type here (FriendRequest,
 *  RewardApproval, TaskValidation, SharedTask) declares them as `string`.
 *  Reading a doc without normalizing this crashes the moment calling code
 *  treats the field as a string (e.g. `.localeCompare()` in the "Challenges
 *  you've sent" sort — a real bug hit in production, see BUG_TRACKER.md).
 *  A pending write not yet acked by the server can also briefly report
 *  `null` here instead of a Timestamp — coalesced to a safe default so
 *  callers never see anything but a string (or null for resolvedAt, which
 *  is genuinely nullable pre-resolution). */
function normalizeTimestamps<T>(data: Record<string, unknown>): T {
  const out = { ...data }
  if ('createdAt' in out) {
    out.createdAt = out.createdAt instanceof Timestamp ? out.createdAt.toDate().toISOString() : (out.createdAt ?? '')
  }
  if ('resolvedAt' in out) {
    out.resolvedAt = out.resolvedAt instanceof Timestamp ? out.resolvedAt.toDate().toISOString() : (out.resolvedAt ?? null)
  }
  return out as T
}

// ─── Friends subcollection: users/{uid}/friends/{friendUid} ──────────────────

function friendsCol(uid: string) {
  return collection(getClientDb(), 'users', uid, 'friends')
}

function friendDoc(uid: string, friendUid: string) {
  return doc(getClientDb(), 'users', uid, 'friends', friendUid)
}

export function listenFriends(uid: string, cb: (friends: Friend[]) => void): Unsubscribe {
  return onSnapshot(friendsCol(uid), snap => {
    cb(snap.docs.map(d => d.data() as Friend))
  })
}

export async function updateFriendTags(uid: string, friendUid: string, tags: FriendTag[]): Promise<void> {
  await updateDoc(friendDoc(uid, friendUid), { tags, isNotary: tags.includes('notary') })
}

/** Called by the Notary, about a specific friend of theirs — writes to the
 *  Notary's OWN doc (users/{notaryUid}/friends/{friendUid}), never to the
 *  friend's doc, so the friend can never edit their own limit down. */
export async function setNotaryThreshold(notaryUid: string, friendUid: string, threshold: number): Promise<void> {
  await updateDoc(friendDoc(notaryUid, friendUid), { rewardApprovalThreshold: threshold })
}

/** Called by the person about to redeem, to look up the limit *their* chosen
 *  Notary has set for them — reads users/{notaryUid}/friends/{myUid}, which
 *  the relaxed read rule allows since `myUid` is the friendUid being
 *  referenced there. Returns undefined if the Notary hasn't set one yet
 *  (treated as "no cost gate"). */
export async function getNotaryThreshold(notaryUid: string, myUid: string): Promise<number | undefined> {
  const snap = await getDoc(friendDoc(notaryUid, myUid))
  return (snap.data() as Friend | undefined)?.rewardApprovalThreshold
}

export async function removeFriend(uid: string, friendUid: string): Promise<void> {
  // One-directional: removes from your own list only. The other person's copy
  // stays until they remove it too — avoids needing a Cloud Function (this app
  // stays on the free Firebase Spark plan, which doesn't include Functions).
  await deleteDoc(friendDoc(uid, friendUid))
}

// ─── Friend requests: root collection friendRequests/{id} ────────────────────

function friendRequestsCol() {
  return collection(getClientDb(), 'friendRequests')
}

export async function sendFriendRequest(
  fromUid: string, fromName: string, toUid: string, toName: string
): Promise<string> {
  const ref = doc(friendRequestsCol())
  const request: FriendRequest = {
    id: ref.id, fromUid, fromName, toUid, toName,
    status: 'pending', createdAt: new Date().toISOString(), resolvedAt: null,
  }
  await setDoc(ref, { ...request, createdAt: serverTimestamp() })
  return ref.id
}

export function listenIncomingRequests(uid: string, cb: (requests: FriendRequest[]) => void): Unsubscribe {
  const q = query(friendRequestsCol(), where('toUid', '==', uid), where('status', '==', 'pending'))
  return onSnapshot(q, snap => cb(snap.docs.map(d => normalizeTimestamps<FriendRequest>(d.data()))))
}

export function listenOutgoingRequests(uid: string, cb: (requests: FriendRequest[]) => void): Unsubscribe {
  const q = query(friendRequestsCol(), where('fromUid', '==', uid), where('status', '==', 'pending'))
  return onSnapshot(q, snap => cb(snap.docs.map(d => normalizeTimestamps<FriendRequest>(d.data()))))
}

/** Accepting writes a Friend doc into *both* users' subcollections in one
 *  batch. This requires the security rule on users/{uid}/friends/{friendUid}
 *  to allow `friendUid` (not just `uid`) to create — see firestore.rules —
 *  since the accepting user isn't the owner of the sender's subcollection. */
export async function acceptFriendRequest(request: FriendRequest): Promise<void> {
  const batch = writeBatch(getClientDb())
  const now = new Date().toISOString()

  const forRecipient: Friend = {
    uid: request.fromUid, displayName: request.fromName, tags: [], isNotary: false, addedAt: now,
  }
  const forSender: Friend = {
    uid: request.toUid, displayName: request.toName, tags: [], isNotary: false, addedAt: now,
  }

  batch.set(friendDoc(request.toUid, request.fromUid), forRecipient)
  batch.set(friendDoc(request.fromUid, request.toUid), forSender)
  batch.update(doc(friendRequestsCol(), request.id), { status: 'accepted', resolvedAt: serverTimestamp() })

  await batch.commit()
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await updateDoc(doc(friendRequestsCol(), requestId), { status: 'rejected', resolvedAt: serverTimestamp() })
}

// ─── Reward approvals: root collection rewardApprovals/{id} ──────────────────
// Two independent gates (cost threshold vs. habit-linked cooldown) — see
// docs/PHASE2_SOCIAL_LIFE_OS.md Section 6.4. Both use the same pending/
// cooldown/resolve shape; only the cooldown length and trigger differ.

function rewardApprovalsCol() {
  return collection(getClientDb(), 'rewardApprovals')
}

export async function requestRewardApproval(
  ownerUid: string, notaryUid: string, rewardTitle: string, cost: number, gate: 'cost' | 'habit'
): Promise<string> {
  const ref = doc(rewardApprovalsCol())
  const hours = gate === 'cost' ? REWARD_APPROVAL_COOLDOWN_HOURS : HABIT_FLAG_COOLDOWN_HOURS
  const now = new Date()
  const cooldownEndsAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString()
  const approval: RewardApproval = {
    id: ref.id, ownerUid, notaryUid, rewardTitle, cost, gate,
    status: 'pending', note: null, createdAt: now.toISOString(), cooldownEndsAt, resolvedAt: null,
  }
  await setDoc(ref, { ...approval, createdAt: serverTimestamp() })
  return ref.id
}

export function listenPendingApprovals(notaryUid: string, cb: (approvals: RewardApproval[]) => void): Unsubscribe {
  const q = query(rewardApprovalsCol(), where('notaryUid', '==', notaryUid), where('status', '==', 'pending'))
  return onSnapshot(q, snap => cb(snap.docs.map(d => normalizeTimestamps<RewardApproval>(d.data()))))
}

/** All of the owner's own approval requests, pending *and* resolved — unlike
 *  listenPendingApprovals this isn't filtered to 'pending' only, because the
 *  requester's client needs to notice the moment a request resolves (approved
 *  or rejected) so it can reconcile its local pendingRewardApprovals mirror
 *  (see store/slices/rewardApprovals logic) — a status-filtered query would
 *  make resolved docs simply disappear instead of firing an update. */
export function listenOwnApprovals(ownerUid: string, cb: (approvals: RewardApproval[]) => void): Unsubscribe {
  const q = query(rewardApprovalsCol(), where('ownerUid', '==', ownerUid))
  return onSnapshot(q, snap => cb(snap.docs.map(d => normalizeTimestamps<RewardApproval>(d.data()))))
}

/** Explicit early approval by the Notary — same end state as letting the
 *  cooldown run out via autoApproveIfExpired, just immediate. */
export async function approveRewardApproval(approvalId: string): Promise<void> {
  await updateDoc(doc(rewardApprovalsCol(), approvalId), { status: 'approved', resolvedAt: serverTimestamp() })
}

export async function rejectRewardApproval(approvalId: string, note: string | null): Promise<void> {
  await updateDoc(doc(rewardApprovalsCol(), approvalId), {
    status: 'rejected', note, resolvedAt: serverTimestamp(),
  })
}

/** Explicit deliberate actions only — there is no automatic force-approve
 *  timer in this codebase. `cancel` refunds pts (handled by the caller in the
 *  rewards slice) and marks the request cancelled; `reassign` swaps the
 *  notary and restarts the cooldown window rather than leaving the original
 *  approval to silently expire. */
export async function cancelRewardApproval(approvalId: string): Promise<void> {
  await updateDoc(doc(rewardApprovalsCol(), approvalId), {
    status: 'cancelled', resolvedAt: serverTimestamp(),
  })
}

export async function reassignRewardApproval(approvalId: string, newNotaryUid: string): Promise<void> {
  const snap = await getDoc(doc(rewardApprovalsCol(), approvalId))
  const existing = snap.data() as RewardApproval | undefined
  const hours = existing?.gate === 'habit' ? HABIT_FLAG_COOLDOWN_HOURS : REWARD_APPROVAL_COOLDOWN_HOURS
  const cooldownEndsAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
  await updateDoc(doc(rewardApprovalsCol(), approvalId), { notaryUid: newNotaryUid, cooldownEndsAt })
}

/** No Cloud Functions on the free Firebase Spark plan, so "silence = approve"
 *  is resolved client-side rather than by a server timer: the reward owner's
 *  own client checks pending approvals against `cooldownEndsAt` on load (see
 *  the rewards flow in Phase 3) and flips expired ones to approved. This is
 *  never a silent bypass of the Notary's veto — it only fires after the
 *  window the Notary was given to actively reject has fully elapsed. */
export async function autoApproveIfExpired(approval: RewardApproval): Promise<boolean> {
  if (approval.status !== 'pending') return false
  if (new Date(approval.cooldownEndsAt).getTime() > Date.now()) return false
  await updateDoc(doc(rewardApprovalsCol(), approval.id), { status: 'approved', resolvedAt: serverTimestamp() })
  return true
}

// ─── Task validation: root collection validations/{id} ───────────────────────
// See docs/PHASE2_SOCIAL_LIFE_OS.md Section 1.3/1.4. Binary approve/reject
// with an optional 1-line note — proof/photo is left as a future optional
// field, never mandatory at the system level.

function validationsCol() {
  return collection(getClientDb(), 'validations')
}

export async function requestTaskValidation(
  taskId: string, taskTitle: string, ownerUid: string, ownerName: string, validatorUid: string
): Promise<string> {
  const ref = doc(validationsCol())
  const validation: TaskValidation = {
    id: ref.id, taskId, taskTitle, ownerUid, ownerName, validatorUid,
    status: 'pending', note: null, createdAt: new Date().toISOString(), resolvedAt: null,
  }
  await setDoc(ref, { ...validation, createdAt: serverTimestamp() })
  return ref.id
}

export function listenPendingValidations(validatorUid: string, cb: (validations: TaskValidation[]) => void): Unsubscribe {
  const q = query(validationsCol(), where('validatorUid', '==', validatorUid), where('status', '==', 'pending'))
  return onSnapshot(q, snap => cb(snap.docs.map(d => normalizeTimestamps<TaskValidation>(d.data()))))
}

/** All of the owner's own validation requests, pending *and* resolved — same
 *  reasoning as listenOwnApprovals: a status-filtered query would make
 *  resolved docs simply disappear instead of firing an update the owner's
 *  client needs to reconcile its local task mirror. */
export function listenOwnValidations(ownerUid: string, cb: (validations: TaskValidation[]) => void): Unsubscribe {
  const q = query(validationsCol(), where('ownerUid', '==', ownerUid))
  return onSnapshot(q, snap => cb(snap.docs.map(d => normalizeTimestamps<TaskValidation>(d.data()))))
}

export async function approveTaskValidation(validationId: string, note: string | null): Promise<void> {
  await updateDoc(doc(validationsCol(), validationId), { status: 'approved', note, resolvedAt: serverTimestamp() })
}

export async function rejectTaskValidation(validationId: string, note: string | null): Promise<void> {
  await updateDoc(doc(validationsCol(), validationId), { status: 'rejected', note, resolvedAt: serverTimestamp() })
}

// ─── Task challenges: root collection sharedTasks/{id} ────────────────────────
// v1 supports exactly one challenged friend per challenge — participantUids
// always holds a single uid, but the array shape leaves room for a true
// multi-participant shared task later without a schema change.

function sharedTasksCol() {
  return collection(getClientDb(), 'sharedTasks')
}

export async function sendTaskChallenge(
  ownerUid: string, ownerName: string, friendUid: string,
  title: string, note: string, zone: string, priority: SharedTask['priority']
): Promise<string> {
  const ref = doc(sharedTasksCol())
  const task: SharedTask = {
    id: ref.id, ownerUid, ownerName, title, note, zone, priority, requiresProof: false,
    participantUids: [friendUid], perUserStatus: { [friendUid]: 'pending' },
    createdAt: new Date().toISOString(),
  }
  await setDoc(ref, { ...task, createdAt: serverTimestamp() })
  return ref.id
}

/** Goal-type challenge — time-bound (endDate), multi-task (checklist), as
 *  opposed to sendTaskChallenge's single-day/single-task shape. Accepting
 *  one calls addChallengeGoal (not addChallengeTask) on the friend's side —
 *  see social.store.ts#acceptChallenge, which branches on `type`. */
export async function sendGoalChallenge(
  ownerUid: string, ownerName: string, friendUid: string,
  title: string, taskTitles: string[], endDate: string
): Promise<string> {
  const ref = doc(sharedTasksCol())
  const task: SharedTask = {
    id: ref.id, ownerUid, ownerName, title, note: '', zone: '', priority: 'med', requiresProof: false,
    participantUids: [friendUid], perUserStatus: { [friendUid]: 'pending' },
    createdAt: new Date().toISOString(),
    type: 'goal', endDate, checklist: taskTitles,
  }
  await setDoc(ref, { ...task, createdAt: serverTimestamp() })
  return ref.id
}

/** Challenges sent TO this friend that are still awaiting their response. */
export function listenIncomingChallenges(friendUid: string, cb: (challenges: SharedTask[]) => void): Unsubscribe {
  const q = query(sharedTasksCol(), where('participantUids', 'array-contains', friendUid))
  return onSnapshot(q, snap => cb(
    snap.docs.map(d => normalizeTimestamps<SharedTask>(d.data())).filter(t => t.perUserStatus[friendUid] === 'pending')
  ))
}

/** All challenges this user has sent, in any status — the tracker/history
 *  view (see FriendsPageContent.tsx) needs pending/accepted/declined/done
 *  entries all at once, not just the still-actionable ones. Independent of
 *  the `friends` list/subcollection entirely, so adding or removing a friend
 *  never touches this — it's its own query keyed only on ownerUid. */
export function listenSentChallenges(ownerUid: string, cb: (challenges: SharedTask[]) => void): Unsubscribe {
  const q = query(sharedTasksCol(), where('ownerUid', '==', ownerUid))
  return onSnapshot(q, snap => cb(snap.docs.map(d => normalizeTimestamps<SharedTask>(d.data()))))
}

export async function respondToChallenge(challengeId: string, friendUid: string, accept: boolean): Promise<void> {
  await updateDoc(doc(sharedTasksCol(), challengeId), {
    [`perUserStatus.${friendUid}`]: accept ? 'accepted' : 'declined',
  })
}

/** Called from the RECIPIENT's own device when they complete (or un-complete)
 *  the local task that was created from this challenge — lets the challenger
 *  see completion in their sent-challenges tracker without needing read
 *  access to the recipient's private task list. Same write shape/rule path
 *  as respondToChallenge (a participant updating their own perUserStatus
 *  key), so no rules change is needed. */
export async function markChallengeCompletion(challengeId: string, friendUid: string, done: boolean): Promise<void> {
  await updateDoc(doc(sharedTasksCol(), challengeId), {
    [`perUserStatus.${friendUid}`]: done ? 'done' : 'accepted',
  })
}
