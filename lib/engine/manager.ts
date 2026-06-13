import managerData from '@/data/manager.json'
import type { AppConfig } from '@/store/types'

type ToneKey   = 'balanced' | 'strict' | 'encouraging'
type MsgBank   = Record<string, string[]>

function pickRand(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)] ?? ''
}

// Deterministic pick so server- and client-rendered output match (avoids hydration mismatches).
function pickSeeded(arr: string[], seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i)
    h |= 0
  }
  const idx = Math.abs(h) % arr.length
  return arr[idx] ?? ''
}

export function getManagerMessage(
  pct: number,
  totalCount: number,
  tone: AppConfig['tone'],
  mood?: string,
  seed?: string
): string {
  const bank = (managerData as Record<ToneKey, MsgBank>)[tone] ?? managerData.balanced
  const h    = new Date().getHours()
  const pick = (arr: string[], key: string) => seed ? pickSeeded(arr, `${seed}:${key}`) : pickRand(arr)

  if (totalCount === 0)   return pick(bank.empty, 'empty')
  if (pct >= 100)         return pick(bank.complete_high_morning, 'complete')
  if (pct >= 80)          return 'Close. Finish strong.'
  if (pct >= 50)          return 'Halfway there. Don\'t slow down.'
  if (pct > 0)            return 'Started. Keep going.'
  if (h < 12)             return pick(bank.zero_am, 'zero_am')
  if (h < 17)             return pick(bank.zero_pm, 'zero_pm')
  return pick(bank.zero_late, 'zero_late')
}

export function getTaskCompleteMessage(
  priority: string,
  isSpecial: boolean,
  mood: string | undefined,
  tone: AppConfig['tone']
): string {
  const bank = (managerData as Record<ToneKey, MsgBank>)[tone] ?? managerData.balanced
  const h    = new Date().getHours()
  const tod  = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  const pri  = isSpecial ? 'special' : priority

  const key  = `complete_${pri}_${tod}`
  const pool = bank[key] ?? bank[`complete_high_${tod}`] ?? bank.complete_high_morning ?? ['Well done.']
  return pickRand(pool)
}

export function getConcernMessage(tone: AppConfig['tone']): string {
  const bank = (managerData as Record<ToneKey, MsgBank>)[tone] ?? managerData.balanced
  const pool = bank.concern_sick ?? ['Two sick days in a row — take care of yourself.']
  return pickRand(pool)
}

export function getMilestoneMessage(streak: number, tone: AppConfig['tone']): string {
  const bank = (managerData as Record<ToneKey, MsgBank>)[tone] ?? managerData.balanced
  const key  = `streak_${streak}`
  const pool = bank[key] ?? bank.streak_7 ?? ['Milestone reached!']
  return pickRand(pool)
}
