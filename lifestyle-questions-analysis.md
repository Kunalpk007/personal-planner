# Daily Lifestyle Questions — What to Actually Ask, and Why

You asked me to analyse what daily lifestyle questions would give real insight into your day, and tie cleanly into the weekly review alongside tasks/rewards/goals. This is a proposal, not something I've built — same as the retro-fix redesign, I want your sign-off on the actual questions before touching real code, since these are the kind of thing you'll be answering every single day and a bad choice here creates fatigue fast.

## What the app already asks you, every day

Before proposing anything new, here's the honest inventory of daily signals that already exist, so nothing below duplicates them:

- **AM mood** — Motivated / Neutral / Sick. A coarse energy/readiness check, feeds the day's scoring multiplier.
- **EOD mood** — a richer end-of-day emotional read (proud, content, etc.), recorded but not scored.
- **Focus check-in** (just built this session) — a 1–5 "how focused was today" score plus what pulled your attention (phone, meetings, procrastination, interruptions, low energy, unclear priorities, other).
- **Water intake** — logged in ml against a daily target.
- **Tomorrow's Top 3** (just built) — the priorities you name the night before.
- Plus, indirectly, every task/goal done-or-not and the reward wallet.

So mood, attention, and hydration are already covered. What's genuinely missing is the stuff that actually *drives* all of those — the inputs, not just the outputs.

## The three questions I'd actually add

**Sleep — hours and quality, one tap each.** This is the single biggest omission, and it's not close. Sleep is the strongest predictor of next-day focus, mood, and follow-through of anything on this list, and right now the app has zero visibility into it. You could have a rough night, spend the whole next day distracted and short-fused, and the app would just show a low focus score with no explanation attached — you'd see the symptom in the weekly review but never connect it to the cause. Ask it first thing in the morning (pairs naturally with the existing AM mood check-in, same moment, same tap-and-go interaction): "How did you sleep?" as a 3-option scale (Poor / OK / Great) rather than asking for exact hours — precision isn't the point, a trend line is, and a slider or number pad adds friction for no real gain.

**Movement — did you move your body today, yes or no.** Not a workout tracker, not minutes or calorie counting — just a single binary check at end-of-day: "Did you move today?" (a walk, a workout, anything that wasn't sitting). This is the second-strongest lever on mood and energy after sleep, and it's currently invisible. Keeping it binary matters — the moment this becomes "how many minutes" or "what type," it turns into homework and you'll start skipping it, which defeats the purpose.

**Stress / overwhelm — a 1–5 scale, same UI pattern as the focus check-in.** This is the one that actually explains the *why* behind a bad day in a way "focus score" alone can't. A low focus score tells you attention was scattered; a high stress score tells you *why* — you were carrying too much, not just distracted. The two together are far more diagnostic than either alone, and since you've already built the exact 1–5 pill-selector UI for the focus check-in, this is a near-zero-cost addition to the same modal, not a new pattern to design.

That's it — three questions, all single-tap, no free text required for any of them. Sleep in the morning (with mood), movement and stress in the evening (with the focus check-in you already built). I deliberately didn't propose more than this: every additional daily question is a small tax on the habit itself, and the whole point of this ritual is that you actually keep doing it past week two.

## What I'd deliberately leave out, and why

You might expect diet, screen time, or a gratitude/journal prompt on a list like this — I'm leaving all three out on purpose. Diet is high-friction to log honestly and the payoff is thin unless you're tracking macros for a real reason, which isn't what you asked for. Screen time is already partially covered by the focus check-in's distraction tags ("Phone / social media" is already one of the seven options) — a separate number would just be a second, redundant way of asking the same thing. And a gratitude/journal prompt already exists as its own dedicated Journal feature elsewhere in the app — duplicating it here would split one habit into two half-habits instead of strengthening either.

## How this actually plugs into the Weekly Review

This is the part that makes the three questions worth asking at all — a single day's sleep or stress score is just a data point, but a week of them, set against the tasks/goals/rewards you already track, is where the real insight shows up. Concretely, the Weekly Review (the screen built this session) should show, alongside the existing tasks-done/goals-done/rewards-redeemed recap:

- Average sleep quality and average stress for the week, plotted the same way the streak/mood trend charts already work on the History page — nothing new to design, just a second series on an existing chart type.
- Days moved vs. days didn't, as a simple X/7 count next to the existing "days submitted" tile.
- The one correlation that actually matters and that you can't currently see anywhere: cross-referencing low-sleep or high-stress days against that same day's task completion and focus score. If every one of your lowest-completion days this week also happens to be your worst sleep night, that's the actual answer to "what should I have avoided" — not a guess, a pattern pulled straight from your own week. That's the "reconcile" piece you specifically asked for: the weekly review stops being a summary of what happened and starts being able to tell you *why* it happened.

## What I need from you before building this

Three things, in order of how much they change the implementation:

1. **Do the three questions above feel right**, or is there a substitution you'd rather make (e.g., swap stress for something else that matters more to you)?
2. **Where should sleep get asked** — I proposed folding it into the existing AM mood check-in (`MorningQuoteOverlay`) since that's already a morning touchpoint; the alternative is a separate prompt, which is more visible but is one more thing to dismiss every morning.
3. **Should the correlation callout in the Weekly Review be automatic** (the app spots the pattern and states it plainly, like "3 of your 4 lowest days followed poor sleep") **or just the raw numbers**, leaving you to draw the connection yourself? The automatic version is more useful but is also the first place this app would ever tell you something about yourself rather than just recording what you told it — worth deciding deliberately rather than defaulting into it.

Once you tell me which way to go on those three, I'll prototype the actual screens (same as the retro-fix and the ritual screens) before writing any real code.
