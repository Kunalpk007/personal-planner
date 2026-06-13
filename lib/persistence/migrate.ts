/**
 * Migrate v1 localStorage data to v2 schema.
 * Runs once, silently, on first load of the Next.js app.
 */
export function migrateV1ToV2(): void {
  const V1_KEY = 'kunals_planner_v1'
  const V2_KEY = 'kunals_planner_v2'

  try {
    const raw = localStorage.getItem(V1_KEY)
    if (!raw || localStorage.getItem(V2_KEY)) return

    const v1 = JSON.parse(raw)

    // Map v1 fields → v2
    const v2 = {
      ...v1,
      rewardWallet: 0,
      restDays:     {},
      weekRestUsed: {},
      eodMood:      {},
      pinnedTaskId: null,
      cfg: {
        minPts:       v1.cfg?.minH !== undefined ? 70 : 70,
        weekendPts:   20,
        cutoffHour:   1,
        tone:         v1.cfg?.tone ?? 'balanced',
        managerName:  'The Manager',
        moodMot:      v1.cfg?.moodMot ?? 1.2,
        moodSick:     v1.cfg?.moodSick ?? 0.5,
        pomoDuration: 25,
        quoteMorning: true,
        quoteEvening: true,
      },
    }

    localStorage.setItem(V2_KEY, JSON.stringify(v2))
    localStorage.removeItem(V1_KEY)
    console.log('[planner] Migrated v1 → v2 successfully')
  } catch (e) {
    console.warn('[planner] Migration failed', e)
  }
}
