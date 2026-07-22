# Phase 2 Discussion Doc — Social Accountability, Goals, Life Score & History Graph
_Companion to docs/CONTEXT.md — grounded in the actual v2 codebase (Zustand slices, Firestore, scoring engine)_
_Drafted: 2026-07-15_

This is a discussion document, not a build spec. Every section ends with decisions I need from you before this becomes tasks. Nothing here has been coded yet.

---

## 0. What already exists that this builds on

Three things already in the codebase change the shape of what's possible, worth stating up front:

- **You already have a backend.** `lib/firebase/firestore.ts` writes each user's state to `users/{uid}/planner/state`, with a separate journal subcollection. CONTEXT.md files this under Phase 3 ("Backend + Multi-Device Sync"), but it's live now. That means a friends/social feature — which requires reading another user's data — is buildable today without waiting for a "Phase 3 backend" milestone. It's the single biggest unlock for everything below.
- **You already have one social-ish actor: the Manager.** `lib/engine/manager.ts` + `data/manager.json` — a tone-configurable (Balanced/Strict/Encouraging), named AI coach with ~150 canned lines keyed by priority × time-of-day × mood. The Friends system should be designed as siblings of the Manager, not a bolt-on — same "someone is watching and reacting to what you do" psychological mechanism, upgraded from simulated to real.
- **`zones` already exist as a life-domain concept.** `store/types.ts` has `Zone { id, name, color }`, user-defined, attached to every task. This is the natural substrate for the Life Score (Section 3) — no new taxonomy needed, just aggregation on top of what's there.

---

## 1. Friends & Accountability System

### 1.1 The core psychological bet

Solo streak mechanics (what you have now) run on **loss aversion against your past self**. Adding real people changes the mechanism to **loss aversion against your reputation with people who matter to you** — which is a stronger and stickier lever, but only if it's low-friction and can't be gamed. Two failure modes to design against explicitly:
1. **Friction kills it** — if validating a friend's task takes more than ~5 seconds, it dies within a week (this is why group chats fail as accountability tools).
2. **Cheating kills trust** — if the validator rubber-stamps everything, the whole mechanic becomes theater and both sides quietly stop caring.

### 1.2 Friend limit: 3–5, and why that's correct (not just a scaling constraint)

Dunbar-adjacent research on accountability specifically (not just social network size) consistently shows **effectiveness drops sharply past ~5 accountability contacts** — it becomes a broadcast, not a relationship, and each person feels less individually responsible for checking on you (diffusion of responsibility). So the cap isn't just an engineering nicety, it's the correct product decision. Recommend:
- **Hard default: 5.** Configurable per-user in Settings, but 5 is the ceiling in v1.
- **Soft nudge at 3**: "3 is usually the sweet spot — more people, less accountability per person." Shown once, dismissible.
- Architecture should not hardcode "5" anywhere structural — see 1.6.

### 1.3 Friend types (tags) — expanding your list

You proposed Manager, Colleague, Motivator. Here's a fuller taxonomy, each mapped to a distinct **behavioral function** so they're not just cosmetic labels:

| Tag | Function | Validates | Tone default |
|---|---|---|---|
| **Mentor** *(formerly "Manager" — renamed to avoid clashing with the AI Manager)* | Authority figure — reviews outcomes, not effort. Best for career/discipline tasks. | Job/work tasks, deadlines | Strict |
| **Coach** | Long-game mentor — cares about trend, not any single day. | Fitness, skill-building goals | Encouraging |
| **Motivator / Hype** | Pure positive reinforcement, high-frequency low-stakes reactions. | Anything, mostly reacts not gatekeeps | Encouraging |
| **Rival** | Competitive mirror — sees your stats side-by-side, no validation power. | Nothing (view-only) | N/A |
| **Accountability Partner** | Mutual, symmetric — you validate each other's tasks 1:1. Most common real-world pattern (gym buddy, study partner). | Whatever you assign each other | Balanced |
| **The Notary** | The single friend with reward-approval authority (see Section 1.5). Usually your most trusted tie. | Rewards only, not tasks | Balanced |
| **Silent Witness** | Sees your public activity feed, zero validation power, zero pressure. For the friend you want watching but not judging. | Nothing | N/A |

A friend can hold **multiple tags** (your real gym buddy is both Coach and Accountability Partner). Tags aren't just flavor text — they gate what a friend is *allowed* to do (a Silent Witness cannot approve/reject anything; a Rival can't either). This constrains the UI meaningfully and prevents "I accidentally let my rival reject my reward."

**Resolved:** the human tag is **Mentor**, not Manager — avoids colliding with the existing AI Manager character. "Manager" stays reserved for the AI coach everywhere in the UI.

### 1.4 Task assignment model

Three distinct task relationships, not one:

1. **Solo task** (current behavior) — unchanged, no friend involved.
2. **Shared task** — same task appears on both people's lists, both must complete independently, both see each other's status live (e.g., "read 20 pages" as a mutual reading challenge). Good for Rival/Accountability Partner.
3. **Assigned + validated task** — you create a task, tag it "needs validation," pick which friend(s) validate. Task shows a pending state until validated. This is the one that actually creates accountability pressure — someone else has to look at what you did.

Validation itself: **binary approve/reject with an optional 1-line note**, not a form. Anything heavier gets abandoned. Photo/proof-attach as an *optional* field the task creator can require (useful for gym/job tasks — "attach photo of gym check-in"), never mandatory at the system level.

### 1.5 Reward validation (your "no manual rewards" problem)

You've correctly identified that letting users self-report and self-approve rewards is a cheating vector — it undermines the entire wallet economy. Two complementary fixes:

**A. Kill manual reward *cost* entry, keep manual reward *naming*.** Users already pick what they want to redeem for (`addReward` — title + cost). The cheat surface isn't "what reward," it's "did I actually earn the pts." Since pts are already 100% algorithmically derived from `calcPts()` (deadline/slot/mood modifiers — see `lib/engine/scoring.ts`), the wallet itself can't be gamed from the pts side already. The actual gap is **redemption**, not earning: nothing stops someone from just clicking every reward. That's what needs the friend gate.

**B. The Notary role — two independent gates, resolved 2026-07-15 (see Section 6.4 for full detail):**

- **Cost gate.** The Notary (manually chosen, never auto-assigned) sets the pt threshold above which redemption needs their sign-off — the user cannot lower it themselves, which is what keeps this an actual check rather than theater. Below threshold: instant, frictionless. Above threshold: the redemption doesn't *block* waiting for the Notary — it fires immediately into a **48-hour pending window** with pts already locked out of the wallet, and the Notary can reject inside that window (full refund). Silence for 48h = approved. This means redemption is never hostage to the Notary's availability, while a real human still has to actively not-object.
- **Habit gate.** Independent of cost: the user can flag any specific reward as linked to a habit they're trying to reduce (classic case — a 20-pt "Drink tea" reward while actively cutting back on tea). A flagged reward gets a mandatory **12-hour cooldown** (6–12h configurable) before it finalizes, *regardless of how cheap it is*, because the risk here isn't point-economy cheating, it's the user quietly undermining their own stated goal. Same approver, same reject-within-window mechanic. If a reward is flagged *and* over the cost threshold, only the longer (48h) window applies.
- **Deadlock handling.** No silent auto-approval if the Notary goes dark — that would quietly remove the human gate entirely. Instead the user can always **reassign the approver** (fresh cooldown starts) or **cancel the pending redemption** (instant refund, reward not granted). A request can sit indefinitely otherwise; since the user wants the reward, they're the one motivated to resolve it, not the system.

**C. Anti-cheat signal layer (no friend needed).** Independent of Notary, flag suspicious patterns automatically for the user's own dashboard (not punitive, just visibility): tasks completed in <60 seconds of creation, identical task titles completed daily at implausible speed, completion timestamps outside any plausible activity window. This is "aware, not enforced" — matches your stated goal in the Life Score section of making the user *aware* of their own patterns rather than gamifying deception detection.

### 1.6 Scalable architecture

New Firestore structure (siblings of the existing `users/{uid}/planner/state` doc — doesn't touch existing schema):

```
users/{uid}/friends/{friendUid}        → { tags: string[], status: 'pending'|'active'|'blocked', addedAt, isNotary: bool }
friendRequests/{requestId}             → { fromUid, toUid, status, createdAt }
sharedTasks/{taskId}                   → { ownerUid, participantUids[], title, ...task fields, perUserStatus: {uid: 'done'|'pending'} }
validations/{validationId}             → { taskId, ownerUid, validatorUid, status: 'pending'|'approved'|'rejected', note, createdAt, resolvedAt }
rewardApprovals/{approvalId}           → { ownerUid, notaryUid, rewardTitle, cost, status, createdAt, resolvedAt }
```

Why this scales past the 5-friend soft cap without a redesign: friendship is a subcollection keyed by the *other* user's uid (not an array field on the planner doc), so adding friend #6, #50, or #500 is just another document — no document grows unbounded, no array-size limits (Firestore caps arrays practically around a few thousand items but more importantly, arrays force full-document rewrites on every change, which is exactly the "serialize full state on every change" problem CONTEXT.md already flags as tech debt for the main store). The **5-friend limit lives entirely in the UI/config layer**, not the data layer — change one config constant to raise it later, no migration.

New Zustand slice: `social.slice.ts` (or a new lightweight store if you want to keep the offline-first planner store untouched by anything requiring network — worth deciding, see open questions). Feature flag: `NEXT_PUBLIC_ENABLE_FRIENDS`, matching the existing `FLAGS` convention in `constants/feature-flags.ts`.

**Tab placement**: you suggested "beside the recurring tasks tab" — recurring is actually a *tab within* Tasks, not a top-level tab (`app/(tabs)/tasks`). Recommend Friends as its own top-level tab (`app/(tabs)/friends`) alongside Dashboard/Tasks/Journal/Rewards/History/Settings, since it's a peer concept (a relationship graph) not a task view. Validation queue items should also surface as a badge/notification on the Dashboard so it's not a tab users forget exists.

---

## 2. Goals (weekly / monthly)

Lightweight, sits on top of existing data rather than requiring new tracking:

```ts
interface Goal {
  id: string
  title: string
  cadence: 'weekly' | 'monthly'
  zoneId?: string          // optional link to existing Zone
  targetType: 'points' | 'taskCount' | 'streakDays' | 'custom'
  target: number
  periodStart: string      // ISO date, week/month boundary
  progress: number         // derived, not stored — computed from history + tasks
}
```

Progress is **always derived at render time** from existing `history[]` and `tasks[]`, never separately tracked and re-synced — this avoids a whole class of "goal says 80% but tasks say something else" bugs. A weekly goal like "40 pts in Health zone this week" is just a filter+sum over `history[].tasks` for the current week where `zone === 'health'`.

UI: goals live as a compact strip on the Dashboard (above or below the existing power row), plus a dedicated section in History for "goals hit this month." Monday's existing Weekly Review modal (currently a stub per CONTEXT.md tech debt) is the natural place to set next week's goals and show last week's goal results in one screen — this also finally gives that stubbed feature a real purpose instead of just being stats.

---

## 3. Life Score — the "organize every part of your life" score

This is the feature that ties everything together and matches your framing: work discipline, finance, health, relationships, bad-habit-breaking, all in one number the user can track improvement on.

**Don't invent a new taxonomy — extend `Zone`.** Zones are already user-created, colored, and attached to every task (`zone: string` on `Task`). Ship a set of **suggested default zones** at onboarding (Work, Health, Finance, Relationships, Habits, Learning) that the user can rename/merge/delete like any zone today, plus let them add more (this respects the fact that a genuinely custom life doesn't fit six boxes for everyone).

**Life Score = weighted composite, not a simple average**, because a perfect Work score covering for a collapsed Health zone shouldn't read as "doing great":

```
LifeScore = Σ (zoneScore_i × weight_i)  where zoneScore_i = rolling 7/30-day completion-and-consistency
            score for zone i, weight_i = user-set or usage-inferred importance
```

`zoneScore` itself should reward **consistency over volume** — someone who does a little in every zone every day should outscore someone who binges one zone and ignores others for a week, because that mirrors the actual "organized life" outcome you're going for. A simple, explainable formula: average of (days-with-any-activity-in-zone / days-in-period) and (pts-earned-in-zone / pts-target-in-zone), so a zone with zero activity for 5 days visibly drags the score down even if the other 2 days were great.

**Habits/vices are structurally different from tasks** (you can't "complete" not-smoking the way you complete "go to gym"). Recommend a lightweight **habit tracker as its own small primitive** — binary yes/no per day per habit, separate from tasks, feeding into the same zone/Life Score system, rather than forcing bad habits into the task-completion model where they don't fit.

**Display**: a single number (0–100) on the Dashboard, with the zone breakdown as a radar/spider chart on tap — this is the one place a radar chart genuinely earns its keep (6 life domains, at-a-glance imbalance is the whole point), even though radar charts are usually overused elsewhere.

---

## 4. History Graph (Phase 2.1) — interactive design

This is explicitly next-up in your own roadmap (P2.1, flag `NEXT_PUBLIC_ENABLE_HISTORY_CHART` already reserved in `constants/feature-flags.ts`, not yet consumed anywhere). Recharts is the planned library per CONTEXT.md and isn't in `package.json` yet, so this is a clean build, not a retrofit.

### 4.1 What data already exists to plot
`AppStateData.history: HistoryEntry[]` already carries, per day: `done/total/pct`, `rxp`, `mood`, `eodMood`, `frozen`, `rest`, `auto`, `late`, per-task detail (`priority`, `zone`, `completedAt`, `level`), and rewards redeemed. Combined with `rewardRedemptions[]` and (once Section 3 exists) per-zone data, there's enough for a genuinely rich chart without adding new tracking — this should be pure derived visualization, no schema changes required for v1.

### 4.2 Chart types, layered as tabs/toggles (not one busy chart)

1. **Daily points trend** — primary line/bar hybrid: bars for pts earned per day, overlaid line for the day's minPts target (`getMinPts()`), so "above/below the bar" is instantly visible without a separate legend read. Color the bar red/amber/green by whether the day cleared target.
2. **Streak + freeze overlay** — a thin ribbon under the main chart marking frozen days (❄), rest days (🟡), auto-submitted days (Auto), and late-flagged days — exactly the flags already shown in the current accordion History view, just rendered as a timeline instead of buried in a list.
3. **Mood vs. output correlation** — dual-axis: mood (start-of-day, categorical → numeric mapped) against pts earned that day. This is the one you specifically called out. Render as a scatter with a fitted trend line, plus a plain-language callout auto-generated from the correlation ("On motivated days you average 34% more pts" / "No strong link found yet — needs more data"). Numbers, not just a visual, because a vague scatter plot alone won't change behavior — the sentence is what gets internalized and remembered.
4. **Zone breakdown over time** — stacked area chart, one band per zone, showing life-balance drift week to week. Directly visualizes the Life Score concept from Section 3 — if Health's band is thinning over a month, the user sees it before the number even drops.
5. **Best week / worst week highlight** — not a separate chart, an annotation layer on chart #1: shaded region + label on the single best 7-day window in the visible range, auto-computed (rolling sum, take max). Loss-aversion-adjacent framing works better as "your Aug 3–9 week, still your record — 12 days to beat it" than a flat stat.
6. **Calendar heatmap** (GitHub-contributions-style) — full year at a glance, colored by daily pct. This is the chart people screenshot and share (ties directly to your own Brainstorming Question #1 in CONTEXT.md — "what does someone screenshot on Day 3"). Cheap to build, disproportionately high shareability.

### 4.3 Interactivity that actually motivates (not just chart-library defaults)

- **Brush/zoom** on the main trend chart — default view last 30 days, drag to zoom into any range, "All time" toggle.
- **Tap any point** → opens that day's existing History accordion entry inline (reuse, don't rebuild).
- **Filter by zone/priority** — toggle chips above the chart, so "just show me Health" is one tap, feeding the same filtered state into all chart types at once.
- **Personal-baseline comparison, never other-user comparison** — this matters given your own locked decision (CONTEXT.md #6: "No competing leaderboard... self vs past-self only"). Every chart should default to comparing current period vs. the user's own prior period ("this week vs. your last-4-week average"), not vs. anyone else. The Friends feature (Section 1) is explicitly the *only* place another person's data appears — keep History pure self-comparison so the two features don't compete for the same psychological slot.
- **Streak-preserving framing on the chart itself** — e.g., a subtle countdown/pressure element like "2 more days at this pace = new best streak" computed live from the visible trend, shown as a chart annotation, not a separate banner.

### 4.4 Performance note (ties to existing tech debt)
CONTEXT.md already flags that the single persisted Zustand store re-serializes fully on every change as history grows. A history chart reading `history[]` directly off the store is fine at 60–200 entries; past roughly a year of daily data you'll want either (a) a derived/memoized selector that only recomputes when `history.length` changes, or (b) moving `history` to its own lazily-loaded slice/collection instead of the main persisted blob. Worth deciding before, not after, this ships — retrofitting a chart onto a restructured store is more painful than building the chart against the right structure from day one.

---

## 5. Additional retention/psychology ideas (things not yet on your roadmap)

You asked what else helps users never stop using the app. In rough priority order of impact-per-effort, given what already exists:

- **Identity-based framing, not just task framing.** The single highest-leverage habit-psychology lever is language: "I am someone who trains" outperforms "I completed my gym task" for long-term retention. Small copy change — Manager messages and streak milestones could occasionally frame around identity ("30 days of being someone who shows up") rather than only counting.
- **Future-self commitment device.** A one-time or monthly "letter to future you" (text entry, timestamped, resurfaces automatically on a set date or milestone). Cheap to build (reuses the journal encryption/PIN infra you already have), high emotional payoff, and directly extends the existing journal feature rather than adding a new subsystem.
- **Seasons / resets.** Long streak systems eventually punish a single bad week so hard people quit rather than repair it (you've partly solved this with freeze/pause, which is good). Consider a quarterly "season" framing — best week/streak per season, gentle soft-reset of *display* stats each quarter while all-time stats stay intact underneath — gives people who had one bad month in Q1 a genuine fresh start in Q2 without losing their real history.
- **Monthly Life Audit** — an auto-generated one-screen summary (Life Score trend, best/worst zone, streak history, one Manager-voiced reflection line) pushed as a notification on the 1st. This is a natural home for the already-planned P2.5 AI Weekly Summary, just scoped monthly and cheaper (template-based, not necessarily an LLM call, until you want the AI version).
- **Underserved-user problem (your Brainstorming Q3: "what does the app offer someone already disciplined?").** For a maxed-out streak user, the game shifts from *consistency* to *optimization* — surface things like "your Tuesday completion rate is 20% below your other days" or "High-priority tasks slip most often after 9pm" — pattern-mining insights that only a disciplined, data-rich user would find valuable. This is a good justification for investing in the history graph early: it's the retention mechanic for your best users, not just your struggling ones.
- **Anti-cheat awareness, reframed positively** — Section 1.5C's suspicious-pattern detection can double as a *self-honesty* nudge even for solo users with zero friends added: "3 tasks today were marked done within 30 seconds of creation — worth a second look?" Non-judgmental, private, but reinforces that the score means something.

---

## 6. Decisions (2026-07-15)

1. **"Manager" tag collision** — ✅ **Decided.** Human friend tag renamed to **Mentor**. "Manager" stays reserved for the AI coach only. Doc updated throughout (Section 1.3).
2. **Friend system data location** — ✅ **Decided.** Separate online-only module, independent of the offline-first Zustand store. Friends tab requires connectivity; rest of the app keeps full offline capability untouched.
3. **Notary selection** — ✅ **Decided.** Always explicit manual selection — no auto-default off the Mentor/Accountability Partner tag. User must deliberately pick their Notary the first time a reward needs approval.
4. **Reward approval threshold** — ✅ **Decided.** Two independent gates, not one:

   **a. Cost-based gate (anti-cheat).** Notary sets the pt threshold — the user cannot lower their own threshold, closing the self-approval loophole. Below threshold: instant redemption. Above threshold: redemption enters a **48-hour cooldown/pending window** instead of a hard block. Pts are deducted/locked the moment redemption is requested (never double-spendable), the Notary can reject within the window (refunds pts, reverses the reward), and no action by the deadline = auto-approved. This never makes redemption hostage to the Notary being online, while still giving them real veto power.

   **b. Habit-linked gate (self-control, not cost).** Separate from cost: the user can flag a specific reward as tied to a habit they're actively trying to reduce (e.g. "Drink tea" at 20 pts, while cutting back on tea) — a cheap reward that would otherwise redeem instantly. A flagged reward always gets a **12-hour minimum cooldown** (configurable 6–12h per reward), regardless of cost, during which any approver can reject it. This is a different threat model than (a) — it's not about someone gaming the point economy, it's a deliberate friction/impulse-delay device the user sets on themselves. If a reward is both over the cost threshold *and* habit-flagged, the longer window (48h) applies — the two don't stack.

   **c. Deadlock resolution — no silent auto-approve.** If the Notary is unreachable and a request sits pending past a reasonable point, there is **no automatic force-approval** — that would quietly defeat the whole point of having a human gate. Instead the user gets two explicit, deliberate actions at any time: **reassign the approver** (restarts the cooldown window under the new approver) or **cancel the request** (instant pts refund, reward not granted). The pending request can sit indefinitely otherwise — since the user wants the reward, they're naturally incentivized to resolve it themselves rather than the system bailing them out silently.
5. **Life Score zone weights** — ✅ **Decided.** Manual — user sets each zone's importance themselves. No activity-based auto-weighting in v1.
6. **Sequencing** — ✅ **Decided.** Build in parallel. History Graph (Section 4) is self-contained enough not to block on Friends architecture, so both tracks proceed side by side rather than one gating the other.

Next step: turn Sections 1–4 into an actual implementation plan (data model diffs, new files, phased PRs), once #4 is resolved.
