// Friends & Accountability — v1 constants.
// See docs/PHASE2_SOCIAL_LIFE_OS.md Section 1 for the full design discussion.

export const FRIEND_SOFT_CAP = 5   // hard ceiling in v1 — configurable per user, not hardcoded elsewhere
export const FRIEND_NUDGE_AT = 3   // show the "3 is usually the sweet spot" nudge once past this many

export type FriendTag =
  | 'mentor'                 // authority figure — reviews outcomes, career/discipline tasks (formerly "Manager", renamed to avoid clashing with the AI Manager)
  | 'coach'                   // long-game mentor — cares about trend, not any single day
  | 'motivator'               // pure positive reinforcement, high-frequency reactions
  | 'rival'                   // competitive mirror, view-only, no validation power
  | 'accountability_partner'  // mutual, symmetric — most common real-world pattern
  | 'notary'                  // reward-approval authority only (see rewards approval flow)
  | 'silent_witness'          // sees activity feed, zero validation power, zero pressure

export const FRIEND_TAG_META: Record<FriendTag, { label: string; canValidateTasks: boolean; canApproveRewards: boolean }> = {
  mentor:                  { label: 'Mentor',                canValidateTasks: true,  canApproveRewards: false },
  coach:                   { label: 'Coach',                  canValidateTasks: true,  canApproveRewards: false },
  motivator:               { label: 'Motivator',              canValidateTasks: false, canApproveRewards: false },
  rival:                   { label: 'Rival',                  canValidateTasks: false, canApproveRewards: false },
  accountability_partner:  { label: 'Accountability Partner', canValidateTasks: true,  canApproveRewards: false },
  notary:                  { label: 'Notary',                 canValidateTasks: false, canApproveRewards: true },
  silent_witness:          { label: 'Silent Witness',         canValidateTasks: false, canApproveRewards: false },
}

export const FRIEND_TAGS = Object.keys(FRIEND_TAG_META) as FriendTag[]

// Fixed zone list for challenge tasks only. A challenger's own zones are
// custom per-user (different names/ids/colors), and the task gets injected
// into the RECIPIENT's task list on accept — so a zone id chosen from the
// challenger's own list would be meaningless on the recipient's side. Using
// a small shared, stable set keeps "zone" legible on both ends without
// requiring everyone's custom zones to line up.
export const CHALLENGE_ZONES: { id: string; name: string; color: string }[] = [
  { id: 'health',   name: 'Health',   color: '#E24B4A' },
  { id: 'fitness',  name: 'Fitness',  color: '#EF9F27' },
  { id: 'finance',  name: 'Finance',  color: '#2FAE60' },
  { id: 'personal', name: 'Personal', color: '#7B6EF6' },
  { id: 'other',    name: 'Other',    color: '#888888' },
]

// Reward approval cooldown windows (Section 1.5 / Section 6.4 of the discussion doc)
export const REWARD_APPROVAL_COOLDOWN_HOURS = 48   // cost-gate: Notary-set threshold, silence = approve
export const HABIT_FLAG_COOLDOWN_HOURS      = 12   // habit-gate: self-control friction, independent of cost
export const HABIT_FLAG_COOLDOWN_MIN_HOURS  = 6
export const HABIT_FLAG_COOLDOWN_MAX_HOURS  = 12
