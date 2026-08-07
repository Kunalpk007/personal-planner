/** A large bank of short, general-audience motivational lines for the Calm
 *  Down overlay (see features/wellness/CalmDownButton.tsx). Deliberately
 *  generic — no clinical/personal-situation framing — so it reads well for
 *  "normal people" regardless of what's going on in their day.
 *
 *  Built from 20 sentence templates × 100 trait words = exactly 2000 unique
 *  strings, generated once at module load (pure, deterministic — no
 *  Math.random here). getRandomQuote() below is what picks one at display
 *  time. This combinatorial approach is how we get to a genuine "bank of
 *  2000" without 2000 hand-authored lines — the trait words are all real,
 *  distinct, everyday strengths people can actually lean on. */

const TRAITS: string[] = [
  'courage', 'focus', 'patience', 'kindness', 'discipline', 'self-belief', 'resilience', 'clarity',
  'gratitude', 'grit', 'determination', 'curiosity', 'honesty', 'humility', 'persistence', 'optimism',
  'confidence', 'compassion', 'integrity', 'boldness', 'calm', 'energy', 'effort', 'consistency',
  'self-respect', 'ambition', 'awareness', 'balance', 'bravery', 'care', 'commitment', 'conviction',
  'creativity', 'dedication', 'diligence', 'drive', 'empathy', 'endurance', 'enthusiasm', 'faith',
  'fearlessness', 'flexibility', 'forgiveness', 'generosity', 'gentleness', 'genuineness', 'grace',
  'honor', 'hope', 'humor', 'initiative', 'inspiration', 'intention', 'intuition', 'joy',
  'kindheartedness', 'leadership', 'loyalty', 'mindfulness', 'momentum', 'openness', 'passion', 'peace',
  'perseverance', 'perspective', 'playfulness', 'poise', 'positivity', 'presence', 'pride', 'purpose',
  'readiness', 'reflection', 'reliability', 'resolve', 'respect', 'responsibility', 'self-awareness',
  'self-care', 'self-control', 'self-discipline', 'self-trust', 'sincerity', 'spirit', 'stamina',
  'steadiness', 'strength', 'tenacity', 'thankfulness', 'thoughtfulness', 'tolerance', 'trust',
  'understanding', 'vigor', 'vision', 'vitality', 'warmth', 'willpower', 'wisdom', 'wonder',
]

const TEMPLATES: Array<(w: string) => string> = [
  w => `Today is a new chance to practice ${w}.`,
  w => `Small steps taken with ${w} add up to big change.`,
  w => `You already have everything you need — trust your ${w}.`,
  w => `Let ${w} guide you through today, one moment at a time.`,
  w => `Progress, not perfection — lead with ${w} today.`,
  w => `Your ${w} is stronger than any doubt in your head.`,
  w => `Believe in the power of your own ${w}.`,
  w => `One day at a time, one act of ${w} at a time.`,
  w => `You are capable of more than you know — lean into your ${w}.`,
  w => `Every setback is a setup for growth when met with ${w}.`,
  w => `Choose ${w} over comfort, and watch yourself grow.`,
  w => `The person you're becoming is built on today's ${w}.`,
  w => `Show up for yourself today with ${w} and see what happens.`,
  w => `${w[0].toUpperCase()}${w.slice(1)} is a muscle — the more you use it, the stronger it gets.`,
  w => `You don't need to feel ready to act with ${w}.`,
  w => `Whatever today brings, meet it with ${w}.`,
  w => `Your future self is thanking you for today's ${w}.`,
  w => `Growth lives on the other side of ${w}.`,
  w => `Trust the process, and trust your ${w}.`,
  w => `Nothing great was built without ${w} — start today.`,
]

export const MOTIVATIONAL_QUOTES: string[] = (() => {
  const out: string[] = []
  for (const template of TEMPLATES) {
    for (const trait of TRAITS) {
      out.push(template(trait))
    }
  }
  return out
})()

export function getRandomQuote(): string {
  return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
}
