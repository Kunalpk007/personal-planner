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
export const CARRY_PENALTY = 2    // pts lost per carry day
export const DECAY_GRACE  = 3     // days before rank XP decay starts
export const DECAY_RATE   = 0.98  // 2% per day
export const MAX_PAUSE_DAYS = 20  // streak pause expiry
export const MAX_BOUGHT_FREEZES = 2
