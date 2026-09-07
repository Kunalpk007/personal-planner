export const PRIORITY_PTS = {
  high:    20,
  med:     12,
  low:     6,
  special: 0, // uses task.specialPts
} as const

export const MOOD_LABELS = {
  motivated: '⚡ Motivated',
  neutral:   '😐 Neutral',
  sick:      '🤒 Sick',
} as const

export const EOD_MOOD_LABELS = {
  motivated: '⚡ Motivated',
  neutral:   '😐 Neutral',
  tired:     '😤 Tired',
  content:   '😌 Content',
} as const

export const SLOT_HOURS: Record<string, [number, number]> = {
  morning:   [6,  12],
  afternoon: [12, 17],
  evening:   [17, 21],
  night:     [21, 27],
}

export const WALLET_RATIO = 2     // 2 task pts = 1 wallet pt
export const FREEZE_COST  = 250   // wallet pts
export const JOURNAL_XP   = 5     // rank XP first entry/day
export const POMO_BONUS   = 5     // rank XP for completing task during pomo
export const MAX_CARRY    = 3     // days before carried task expires
export const CARRY_PENALTY = 2    // pts lost per carry day (applied at completion time)

// A task that carries past MAX_CARRY days still incomplete is "abandoned" —
// a one-time XP + wallet hit, proportional to the task's own point value,
// applied once at the moment it stops being carried forward (see
// lib/engine/scoring.ts#taskAbandonPenalty). Wallet uses the same
// pts-to-wallet conversion already used elsewhere (WALLET_RATIO) rather than
// a second magic number.
export const TASK_ABANDON_XP_MULT = 1 // XP penalty = basePts(task) * this

// Deleting an incomplete task deducts XP equal to its own point value — but
// not if it was created within this grace window, so fixing a typo or a
// duplicate add doesn't get punished like abandoning a real commitment does.
export const TASK_DELETE_GRACE_MINUTES = 15
export const MAX_PAUSE_DAYS = 20  // streak pause expiry
export const MAX_BOUGHT_FREEZES = 2

// ─── XP penalty system (replaces the old inactivity-decay engine) ──────────
// Flat rankXP deductions tied to why a day's target was missed, instead of a
// blanket 2%/day compounding decay after N days of total inactivity.
export const LIGHT_DAY_XP_PENALTY    = 20  // missed target on a configured Light Day
export const REST_DAY_XP_PENALTY     = 40  // missed target, auto-protected by a rest day
export const FREEZE_USED_XP_PENALTY  = 50  // a streak freeze was spent to cover a miss
export const STREAK_BROKEN_XP_PENALTY = 10 // per day, every day the streak stays broken
export const SICK_ALLOWANCE_PER_MONTH = 2  // free "sick" mood days/month — no XP penalty
export const SHOWED_UP_BONUS_PCT      = 0.05 // wallet-only bonus, 5% of the day's target, on first open

// ─── Focus Time (Dashboard) ─────────────────────────────────────────────────
// A completed, uninterrupted focus session credits both the reward wallet and
// rank XP, scaled by the user-chosen session length (minutes). Rate is
// calibrated off the old fixed 60min→10pts anchor; xp is always 2x pts.
export function focusReward(minutes: number): { pts: number; xp: number } {
  const pts = Math.max(1, Math.round(minutes / 6))
  return { pts, xp: pts * 2 }
}

export const PIN_LENGTH           = 6               // digits
/** Digit count used before the 5→6 digit PIN upgrade. Existing users with a
 *  PIN hashed at this length are asked to re-verify it once, then set a new
 *  PIN_LENGTH-digit PIN — see store/slices/journal.slice.ts (journalPinLength)
 *  and ui/PinGate.tsx's migration steps. */
export const OLD_PIN_LENGTH        = 5
export const PIN_LOCKOUT_THRESHOLD = 5              // failed attempts before lockout
export const PIN_LOCKOUT_MS        = 2 * 60 * 60 * 1000 // 2 hours
