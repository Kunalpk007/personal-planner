import type { FriendTag } from '@/constants/social'

// ─── Friends ───────────────────────────────────────────────────────────────
// Stored at users/{uid}/friends/{friendUid} — a subcollection keyed by the
// other user's uid, not an array field. This is what lets the friend list
// scale past the v1 soft cap without a data-model change later: adding
// friend #6 or #500 is just another document, and no single document ever
// grows unbounded or needs a full-array rewrite on every change.

export interface Friend {
  uid:         string    // the friend's Firebase Auth uid
  displayName: string
  tags:        FriendTag[]
  isNotary:    boolean   // convenience flag — mirrors tags.includes('notary') but explicit for reward-approval lookups
  addedAt:     string    // ISO timestamp
  /** Only meaningful when isNotary — the wallet-pt cost above which a
   *  redemption needs this Notary's sign-off. Set by the Notary themselves
   *  (via their own tag edit on their side of the relationship), not by the
   *  reward owner — letting the owner freely lower their own threshold would
   *  defeat the anti-cheat point (see docs/PHASE2_SOCIAL_LIFE_OS.md
   *  Section 6.4). Undefined means "not set yet" — treat as no cost gate. */
  rewardApprovalThreshold?: number
}

// ─── Friend requests ─────────────────────────────────────────────────────────
// Stored at the collection root (friendRequests/{requestId}), not nested,
// since a request doesn't belong to either user's subtree until it resolves.

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected'

export interface FriendRequest {
  id:        string
  fromUid:   string
  fromName:  string
  toUid:     string
  toName:    string
  status:    FriendRequestStatus
  createdAt: string
  resolvedAt: string | null
}

// ─── Shared / validated tasks ────────────────────────────────────────────────
// A task that exists on more than one person's list (shared) or needs a
// friend's sign-off before it counts (assigned+validated). See
// docs/PHASE2_SOCIAL_LIFE_OS.md Section 1.4.

// 'pending' = challenge sent, awaiting the friend's accept/decline.
// 'accepted' = friend accepted — a real Task now exists on their own list
//   (see store/slices/tasks.slice.ts#addChallengeTask); this collection
//   doesn't track their completion of it, only that they took it on.
// 'declined' = friend turned it down.
// 'done' reserved for a future true multi-participant shared task where
//   completion itself needs to be visible cross-user.
export type SharedTaskStatus = 'pending' | 'accepted' | 'declined' | 'done'

export interface SharedTask {
  id:               string
  ownerUid:         string
  ownerName:        string
  title:            string
  note:             string
  zone:             string
  priority:         'high' | 'med' | 'low' | 'special'
  requiresProof:    boolean   // e.g. "attach photo of gym check-in" — optional, never mandatory system-wide
  participantUids:  string[]  // v1: always exactly one friend uid; array shape leaves room for true multi-participant later
  perUserStatus:    Record<string, SharedTaskStatus>
  createdAt:        string
  /** Undefined/'task' = a normal single-day task challenge (the original
   *  behavior — accepting injects one Task via addChallengeTask). 'goal' =
   *  a multi-task, time-bound challenge — accepting instead calls
   *  addChallengeGoal to create a checklist Goal on the friend's list. */
  type?:            'task' | 'goal'
  /** Goal-type challenges only. Capped at "today + 2 months" at creation time. */
  endDate?:         string
  /** Goal-type challenges only — denormalized task titles that become the
   *  goal's checklist items on accept. */
  checklist?:       string[]
}

// ─── Task validation ──────────────────────────────────────────────────────────

export type ValidationStatus = 'pending' | 'approved' | 'rejected'

export interface TaskValidation {
  id:           string
  taskId:       string
  taskTitle:    string   // denormalized so the validator can see what they're being asked to sign off on
  ownerUid:     string
  ownerName:    string   // denormalized so the validator knows who's asking
  validatorUid: string
  status:       ValidationStatus
  note:         string | null
  createdAt:    string
  resolvedAt:   string | null
}

// ─── Reward approvals ─────────────────────────────────────────────────────────
// See docs/PHASE2_SOCIAL_LIFE_OS.md Section 1.5 / Section 6.4 for the full
// two-gate design (cost threshold + habit-linked cooldown) and the
// reassign/cancel deadlock resolution (never a silent auto-approve).

export type RewardApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type RewardApprovalGate   = 'cost' | 'habit'

export interface RewardApproval {
  id:            string
  ownerUid:      string
  notaryUid:     string
  rewardTitle:   string
  cost:          number
  gate:          RewardApprovalGate
  status:        RewardApprovalStatus
  note:          string | null
  createdAt:     string
  cooldownEndsAt: string   // ISO timestamp — silence from the Notary until this time = auto-approved
  resolvedAt:    string | null
}
