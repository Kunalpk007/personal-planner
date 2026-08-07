'use client'

// Premium, restrained palette (previously a neon violet/pink/cyan/amber
// mix) — celebratory but tasteful, in the app's own accent + neutral gold/
// blue/slate family rather than a rainbow burst.
const COLORS = ['#34D399', '#1B8A54', '#F0C24B', '#5B8DEF', '#A6ADB8']

/** Fire-and-forget confetti burst for the vibrant-redesign Dashboard's
 *  celebratory moments (day submitted, rank milestone, streak freeze earned).
 *  Imperative on purpose — mirrors the existing `showToast()` pattern in
 *  ui/Toast.tsx rather than requiring a mounted component + state. Appends a
 *  throwaway layer to <body> and lets each particle clean itself up. */
export function fireConfetti(count = 60) {
  if (typeof document === 'undefined') return

  let layer = document.getElementById('vx-confetti-layer')
  if (!layer) {
    layer = document.createElement('div')
    layer.id = 'vx-confetti-layer'
    document.body.appendChild(layer)
  }

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div')
    piece.className = 'vx-confetti-piece'
    const size = 6 + Math.random() * 6
    piece.style.width = `${size}px`
    piece.style.height = `${size * 0.4}px`
    piece.style.left = `${Math.random() * 100}vw`
    piece.style.background = COLORS[i % COLORS.length]
    const duration = 2.2 + Math.random() * 1.6
    piece.style.animationDuration = `${duration}s`
    piece.style.animationDelay = `${Math.random() * 0.4}s`
    layer.appendChild(piece)
    setTimeout(() => piece.remove(), (duration + 0.4) * 1000)
  }
}
