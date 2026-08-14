# Kunal's Planner — Whole-App Read, Take Two

You asked for a fresh full-app analysis, so this isn't a rehash of the coach read from last time — that one's still accurate where it hasn't changed, but a lot has shipped since then (the End-of-Day Ritual, the dashboard decluttering, several bug fixes), and your own message just surfaced a pattern worth naming directly: two real accountability loopholes. Here's where the app actually stands.

## What's genuinely different since the last read

The single biggest gap flagged last time — "you're tracking task completion, not time or attention" — is now partially closed. The Focus Check-in (1–5 scale + what pulled your attention) gives you a real daily signal that a perfect streak can't fake anymore, and the Weekly Review that used to be dead code is now a live Sunday ritual with an actual recap pulled from real data, not a blank text box. Tomorrow's Top 3 closes the other gap from that read too — you now deliberately commit to tomorrow's priority the night before, when you have the clarity, instead of the app auto-picking from whatever's still open. All three of these were sitting as prototype mockups for weeks; they're real now, live-verified end to end.

## The pattern in what you just reported: two accountability loopholes

Your message named two specific things, but they're actually the same underlying gap wearing two outfits, and it's worth seeing it that way rather than as two unrelated bugs.

**Carry-forward has a point penalty, but only if the task is ever finished.** There's already a `-2 points per carried day` reduction baked into `calcPts()` — but that number only ever gets applied *at the moment a task is completed*. If a task carries for 3 days and is still incomplete, the current code (`lib/engine/streak.ts`) just quietly stops carrying it forward. No wallet deduction, no XP hit, nothing — it silently disappears from your list with zero consequence. Functionally, that's a "if I never finish it, it's like it never happened" escape hatch, which is the opposite of what a discipline tool should do.

**Deleting a task has a real penalty — but only for completed ones, and that's backwards from what actually needs guarding.** I checked `removeTask` directly: deleting a *completed* task correctly reverses the XP/wallet it earned (that's the right behavior — you shouldn't be able to double-dip by deleting and re-adding a finished task). But deleting an *incomplete* task costs nothing at all today. That's the real gap, and it's the same shape as the carry-forward one: right now, "delete it" is a strictly better move than "let it carry and get caught by the 3-day cutoff," since both currently cost zero, but deleting is faster. Fixing carry-forward without also fixing this would just push people toward the cheaper loophole.

Both are real, well-scoped feature requests, not something I'd want to guess the exact numbers on — I've sent you a set of questions below to pin down the actual amounts before I touch the scoring code, since this directly affects the XP economy you already tuned carefully (light day -20, rest day -40, freeze -50, streak-broken -10/day bleed).

## A gap in the ritual you probably haven't noticed yet

You asked whether Sunday's flow actually reviews the day, does Submit My Day, and asks for tomorrow's 3 priorities — yes, confirmed by reading the code directly: Sunday's Submit My Day chain is Focus Check-in → Tomorrow's Top 3 → Weekly Review, in that order, every time. But there's a real limitation worth naming: **that whole chain only fires if you actually tap Submit My Day that day.** If a Sunday goes by where you don't submit — a busy day, traveling, whatever — you never see the Weekly Review prompt at all, and nothing brings it back to your attention. It's entirely reactive, not proactive. Real push notifications were explicitly scoped out earlier this project (Firebase's free Spark plan has no server-side cron for scheduled per-user pushes), so a true "hey, it's Sunday, do your review" notification isn't free to build. A cheaper middle ground — an in-app banner that appears if it's evening on a Sunday and you haven't submitted yet — is buildable without any of that infrastructure, and I'd treat that as the practical fix for what you're asking about.

## What's still genuinely strong (unchanged from the last read)

The core loop is still well-built for actual behavior change, not just task-checking — the mood-aware scoring, the rest-day protection with an honest fix-it window, and (if `FLAGS.FRIENDS` is actually on in your deployed environment — this is an env-var-gated feature, worth double-checking it's set where you're using it) the social accountability layer are all real strengths most planner apps don't have. Nothing in this session's changes touched or weakened any of that.

## What's still open from before, unchanged

Two things flagged in earlier passes are still exactly where they were: the five parallel progress systems on the dashboard (Rank/XP, streak, badges, wallet, Life Score) still compete for attention rather than leading with one clear "am I doing well" number, and the daily lifestyle questions (sleep/movement/stress) proposed last turn are still waiting on your answer before I build anything. Both are still live options, not forgotten.

## Where I'd actually rank the next move

If I'm ordering this the way a coach would: close the two accountability loopholes first (carry-forward and delete penalties) — they're the cheapest fix and they directly undermine the discipline the rest of the app is built to encourage. Second, the Sunday "haven't submitted yet" nudge, since a ritual that only fires when you remember to trigger it isn't really a ritual. Third, decide on the lifestyle questions, since that's the piece that actually explains *why* a week went the way it did rather than just what happened. The five-systems consolidation is real but lower urgency — it's a clarity problem, not a trust problem, and the other three are trust problems.
