// Feature flags — flip in .env.local to enable Phase 2/3 features
// All false by default in production

export const FLAGS = {
  HISTORY_CHART:  process.env.NEXT_PUBLIC_ENABLE_HISTORY_CHART  === 'true',
  FRIENDS:        process.env.NEXT_PUBLIC_ENABLE_FRIENDS        === 'true',
  GOALS:          process.env.NEXT_PUBLIC_ENABLE_GOALS          === 'true',
  LIFE_SCORE:     process.env.NEXT_PUBLIC_ENABLE_LIFE_SCORE     === 'true',
  NOTION_SYNC:    process.env.NEXT_PUBLIC_ENABLE_NOTION_SYNC    === 'true',
  GCAL_SYNC:      process.env.NEXT_PUBLIC_ENABLE_GCAL_SYNC      === 'true',
  AI_SUMMARY:     process.env.NEXT_PUBLIC_ENABLE_AI_SUMMARY     === 'true',
  PUSH_NOTIFS:    process.env.NEXT_PUBLIC_ENABLE_PUSH_NOTIFS    === 'true',
  ANALYTICS:      process.env.NEXT_PUBLIC_ANALYTICS_ENABLED     === 'true',
} as const

export type FeatureFlag = keyof typeof FLAGS
