import quotesData from '@/data/quotes.json'

export interface Quote { t: string; a: string }

// Deterministic pick so server- and client-rendered output match (avoids hydration mismatches).
function pickSeeded(arr: Quote[], seed: string): Quote {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i)
    h |= 0
  }
  const idx = Math.abs(h) % arr.length
  return arr[idx]
}

/** Returns the quote of the day for a given dayKey — rotates daily, stable for the whole day. */
export function getDailyQuote(dayKey: string, bank: 'morning' | 'evening' | 'comeback' = 'morning'): Quote {
  const arr = (quotesData as Record<string, Quote[]>)[bank] ?? quotesData.morning
  return pickSeeded(arr, dayKey)
}
