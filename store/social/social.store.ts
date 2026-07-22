'use client'
import { create } from 'zustand'
import { usePlannerStore } from '@/store'
import { getClientAuth } from '@/lib/firebase/client'
import type { Friend, FriendRequest, RewardApproval, TaskValidation, SharedTask } from './types'
import type { FriendTag } from '@/constants/social'
import { FRIEND_SOFT_CAP, FRIEND_NUDGE_AT } from '@/constants/social'
import {
  listenFriends, listenIncomingRequests, listenOutgoingRequests,
  sendFriendRequest as sendFriendRequestApi,
  acceptFriendRequest as acceptFriendRequestApi,
  rejectFriendRequest as rejectFriendRequestApi,
  updateFriendTags as updateFriendTagsApi,
  removeFriend as removeFriendApi,
  setNotaryThreshold as setNotaryThresholdApi,
  getNotaryThreshold as getNotaryThresholdApi,
  listenPendingApprovals, listenOwnApprovals,
  approveRewardApproval as approveRewardApprovalApi,
  rejectRewardApproval as rejectRewardApprovalApi,
  cancelRewardApproval as cancelRewardApprovalApi,
  reassignRewardApproval as reassignRewardApprovalApi,
  autoApproveIfExpired,
  requestTaskValidation as requestTaskValidationApi,
  listenPendingValidations, listenOwnValidations,
  approveTaskValidation as approveTaskValidationApi,
  rejectTaskValidation as rejectTaskValidationApi,
  sendTaskChallenge as sendTaskChallengeApi,
  sendGoalChallenge as sendGoalChallengeApi,
  listenIncomingChallenges, listenSentChallenges, respondToChallenge, markChallengeCompletion,
} from '@/lib/firebase/social'

// Deliberately NOT wrapped in Zustand's `persist` middleware and NOT merged
// into the main `usePlannerStore`. Friends requires a live Firestore
// connection (friend requests, tag changes, reward approvals all need to be
// visible to someone else in near-real-time) — bundling that into the
// offline-first planner store would mean either showing stale cached friend
// data while offline, or making the whole app's persistence model depend on
// connectivity. This store starts empty every session and rehydrates purely
// from Firestore listeners once `init()` is called with a signed-in uid.

export type SendRequestResult =
  | { ok: true }
  | { ok: false; reason: 'not-signed-in' | 'self' | 'cap-reached' | 'already-friends' | 'already-sent' }

interface SocialState {
  uid:         string | null
  displayName: string
  friends:          Friend[]
  incomingRequests: FriendRequest[]
  outgoingRequests: FriendRequest[]
  loaded: boolean

  // Reward approvals where I'm the Notary (need to approve/reject) vs. where
  // I'm the owner (waiting on someone else) — see Section 1.5/6.4 of
  // docs/PHASE2_SOCIAL_LIFE_OS.md. Kept here (not in the offline-first
  // planner store) because both directions require live cross-user reads.
  approvalsToReview: RewardApproval[]
  myOwnApprovals:    RewardApproval[]

  // Task validation (Section 1.3/1.4) — same pending-vs-own split as reward
  // approvals above, mirrored for tasks awaiting a friend's sign-off.
  validationsToReview: TaskValidation[]
  myOwnValidations:    TaskValidation[]

  // Task challenges — SharedTask docs sent TO me, still awaiting my accept/decline.
  incomingChallenges: SharedTask[]

  // Every challenge I've sent, any status — the tracker/history view on
  // FriendsPageContent. Independent of `friends` (see listenSentChallenges).
  sentChallenges: SharedTask[]

  init:     (uid: string, displayName: string) => void
  teardown: () => void

  sendRequest: (toUid: string, toName: string) => Promise<SendRequestResult>
  accept:      (request: FriendRequest) => Promise<void>
  reject:      (requestId: string) => Promise<void>
  setTags:     (friendUid: string, tags: FriendTag[]) => Promise<void>
  remove:      (friendUid: string) => Promise<void>

  setThresholdFor:  (friendUid: string, threshold: number) => Promise<void>
  getThresholdFrom: (notaryUid: string) => Promise<number | undefined>

  approveRequest:   (approvalId: string) => Promise<void>
  rejectRequest:    (approvalId: string, note: string | null) => Promise<void>
  cancelMyRequest:  (approvalId: string) => Promise<void>
  reassignMyRequest: (approvalId: string, newNotaryUid: string) => Promise<void>

  requestValidation: (taskId: string, validatorUid: string, validatorName: string) => Promise<void>
  approveValidation: (validationId: string) => Promise<void>
  rejectValidation:  (validationId: string, note: string | null) => Promise<void>

  sendChallenge:     (friendUid: string, friendName: string, title: string, note: string, zone: string, priority: SharedTask['priority']) => Promise<void>
  sendGoalChallenge: (friendUid: string, friendName: string, title: string, taskTitles: string[], endDate: string) => Promise<void>
  acceptChallenge:  (challenge: SharedTask) => Promise<void>
  declineChallenge: (challengeId: string) => Promise<void>

  /** True once past FRIEND_NUDGE_AT — UI shows the "3 is usually the sweet
   *  spot" nudge once, not a hard block (only FRIEND_SOFT_CAP blocks). */
  atNudgeThreshold: () => boolean
  atCap:            () => boolean
}

let unsubs: Array<() => void> = []

// Tracks the last-known `done` state per challengeId for tasks created from
// an accepted challenge, so the recipient's device can tell Firestore about
// a completion (or un-completion) exactly once per transition, rather than
// re-writing on every unrelated planner-store change. Reset in teardown().
let _challengeDoneState: Record<string, boolean> = {}

export const useSocialStore = create<SocialState>((set, get) => ({
  uid: null, displayName: '', friends: [], incomingRequests: [], outgoingRequests: [], loaded: false,
  approvalsToReview: [], myOwnApprovals: [],
  validationsToReview: [], myOwnValidations: [],
  incomingChallenges: [], sentChallenges: [],

  init(uid, displayName) {
    if (get().uid === uid) return
    // Defensive guard: never attach Firestore listeners without a signed-in
    // Firebase user. The security rules require request.auth, so listeners
    // started before auth is ready just emit a storm of permission-denied
    // errors. StoreBootstrap already gates this on waitForAuth(), but this
    // keeps the store safe if init() is ever called from elsewhere.
    if (typeof window !== 'undefined') {
      try {
        if (getClientAuth().currentUser === null) return
      } catch { return }
    }
    get().teardown()
    set({ uid, displayName, loaded: false })
    unsubs.push(listenFriends(uid, friends => set({ friends, loaded: true })))
    unsubs.push(listenIncomingRequests(uid, incomingRequests => set({ incomingRequests })))
    unsubs.push(listenOutgoingRequests(uid, outgoingRequests => set({ outgoingRequests })))
    unsubs.push(listenPendingApprovals(uid, approvalsToReview => set({ approvalsToReview })))
    unsubs.push(listenOwnApprovals(uid, allMyApprovals => {
      // Unfiltered (all statuses, not just pending) — nothing else reads
      // this field for the "pending queue" case (that's approvalsToReview,
      // the *incoming* ones), so this is free to double as the source for
      // the notification bell's "your redemption was rejected" entries.
      set({ myOwnApprovals: allMyApprovals })

      // Bridge Firestore's resolution back into the offline-first planner
      // store's local mirror (store/slices/rewards.slice.ts) — this is what
      // actually finalizes the redemption (adds the rewardRedemptions entry)
      // or refunds the locked pts, on the requester's own device.
      const planner = usePlannerStore.getState()
      for (const a of allMyApprovals) {
        const local = planner.pendingRewardApprovals.find(p => p.id === a.id)
        if (local && local.status === 'pending' && a.status !== 'pending') {
          planner.resolvePendingApproval(a.id, a.status === 'cancelled' ? 'cancelled' : a.status)
        }
      }

      // No server-side timer resolves an expired cooldown (no Cloud Functions
      // on the free Spark plan) — the owner's own client does it on load,
      // and it's still a real authenticated write, not a silent bypass.
      for (const a of allMyApprovals) {
        if (a.status === 'pending' && new Date(a.cooldownEndsAt).getTime() <= Date.now()) {
          autoApproveIfExpired(a).catch(() => {})
        }
      }
    }))
    unsubs.push(listenPendingValidations(uid, validationsToReview => set({ validationsToReview })))
    unsubs.push(listenOwnValidations(uid, allMyValidations => {
      // Unfiltered for the same reason as myOwnApprovals above.
      set({ myOwnValidations: allMyValidations })

      // Same bridge pattern as reward approvals: a validation resolving
      // (approved/rejected) on the validator's device needs to flip the
      // owner's local task mirror — this is what actually awards the
      // withheld pts (see resolveTaskValidation in tasks.slice.ts).
      const planner = usePlannerStore.getState()
      for (const v of allMyValidations) {
        const task = planner.tasks.find(t => t.id === v.taskId)
        if (task && task.validationStatus === 'pending' && v.status !== 'pending') {
          planner.resolveTaskValidation(v.taskId, v.status, v.note)
        }
      }
    }))
    unsubs.push(listenIncomingChallenges(uid, incomingChallenges => set({ incomingChallenges })))
    unsubs.push(listenSentChallenges(uid, sentChallenges => set({ sentChallenges })))

    // Seed known done-state from whatever challenge-derived tasks already
    // exist locally, WITHOUT writing anything back — only a real transition
    // after this point should fire a Firestore update. Real-time delivery:
    // this is a plain Zustand subscribe on the local planner store, not a
    // poll — a completion is written the instant toggleTask flips `done`,
    // same as everything else in this store (no batching/interval anywhere).
    for (const t of usePlannerStore.getState().tasks) {
      if (t.challengeId) _challengeDoneState[t.challengeId] = t.done
    }
    unsubs.push(usePlannerStore.subscribe(() => {
      const currentUid = get().uid
      if (!currentUid) return
      for (const t of usePlannerStore.getState().tasks) {
        if (!t.challengeId) continue
        if (_challengeDoneState[t.challengeId] === t.done) continue
        _challengeDoneState[t.challengeId] = t.done
        markChallengeCompletion(t.challengeId, currentUid, t.done).catch(() => {})
      }
    }))
  },

  teardown() {
    unsubs.forEach(u => u())
    unsubs = []
    _challengeDoneState = {}
    set({
      uid: null, displayName: '', friends: [], incomingRequests: [], outgoingRequests: [], loaded: false,
      approvalsToReview: [], myOwnApprovals: [],
      validationsToReview: [], myOwnValidations: [],
      incomingChallenges: [], sentChallenges: [],
    })
  },

  async sendRequest(toUid, toName) {
    const { uid, displayName, friends, outgoingRequests } = get()
    if (!uid) return { ok: false, reason: 'not-signed-in' }
    if (toUid === uid) return { ok: false, reason: 'self' }
    if (friends.length >= FRIEND_SOFT_CAP) return { ok: false, reason: 'cap-reached' }
    if (friends.some(f => f.uid === toUid)) return { ok: false, reason: 'already-friends' }
    if (outgoingRequests.some(r => r.toUid === toUid)) return { ok: false, reason: 'already-sent' }
    await sendFriendRequestApi(uid, displayName, toUid, toName)
    return { ok: true }
  },

  async accept(request) {
    await acceptFriendRequestApi(request)
  },

  async reject(requestId) {
    await rejectFriendRequestApi(requestId)
  },

  async setTags(friendUid, tags) {
    const { uid } = get()
    if (!uid) return
    await updateFriendTagsApi(uid, friendUid, tags)
  },

  async remove(friendUid) {
    const { uid } = get()
    if (!uid) return
    await removeFriendApi(uid, friendUid)
  },

  async setThresholdFor(friendUid, threshold) {
    const { uid } = get()
    if (!uid) return
    await setNotaryThresholdApi(uid, friendUid, threshold)
  },

  async getThresholdFrom(notaryUid) {
    const { uid } = get()
    if (!uid) return undefined
    return getNotaryThresholdApi(notaryUid, uid)
  },

  async approveRequest(approvalId) {
    await approveRewardApprovalApi(approvalId)
  },

  async rejectRequest(approvalId, note) {
    await rejectRewardApprovalApi(approvalId, note)
  },

  async cancelMyRequest(approvalId) {
    await cancelRewardApprovalApi(approvalId)
  },

  async reassignMyRequest(approvalId, newNotaryUid) {
    await reassignRewardApprovalApi(approvalId, newNotaryUid)
  },

  async requestValidation(taskId, validatorUid, validatorName) {
    const { uid, displayName } = get()
    if (!uid) return
    const task = usePlannerStore.getState().tasks.find(t => t.id === taskId)
    if (!task) return
    usePlannerStore.getState().requestTaskValidation(taskId, validatorUid, validatorName)
    await requestTaskValidationApi(taskId, task.title, uid, displayName, validatorUid)
  },

  async approveValidation(validationId) {
    await approveTaskValidationApi(validationId, null)
  },

  async rejectValidation(validationId, note) {
    await rejectTaskValidationApi(validationId, note)
  },

  async sendChallenge(friendUid, _friendName, title, note, zone, priority) {
    const { uid, displayName } = get()
    if (!uid) return
    // friendName isn't persisted on the SharedTask doc (only the recipient
    // needs to know who challenged them, via ownerName) — kept as a param so
    // callers can use it for a local confirmation toast.
    await sendTaskChallengeApi(uid, displayName, friendUid, title, note, zone, priority)
  },

  async sendGoalChallenge(friendUid, _friendName, title, taskTitles, endDate) {
    const { uid, displayName } = get()
    if (!uid) return
    await sendGoalChallengeApi(uid, displayName, friendUid, title, taskTitles, endDate)
  },

  async acceptChallenge(challenge) {
    const { uid } = get()
    if (!uid) return
    if (challenge.type === 'goal') {
      usePlannerStore.getState().addChallengeGoal(
        challenge.title, challenge.checklist ?? [], challenge.endDate, challenge.ownerName
      )
    } else {
      usePlannerStore.getState().addChallengeTask({
        title: challenge.title, note: challenge.note, zone: challenge.zone, priority: challenge.priority,
        slot: '', deadline: null, date: new Date().toISOString().slice(0, 10),
        level: '', isSpecial: false, specialPts: 0,
      }, challenge.id, challenge.ownerName)
    }
    await respondToChallenge(challenge.id, uid, true)
  },

  async declineChallenge(challengeId) {
    const { uid } = get()
    if (!uid) return
    await respondToChallenge(challengeId, uid, false)
  },

  atNudgeThreshold() {
    return get().friends.length >= FRIEND_NUDGE_AT
  },
  atCap() {
    return get().friends.length >= FRIEND_SOFT_CAP
  },
}))
