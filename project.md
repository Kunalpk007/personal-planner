# kunals-planner — Project Context

Living context file for the in-progress feature/bug batch. Point a new session at
this file to resume cold. Not auto-loaded — see "How to use this file" at the bottom.

## App architecture facts (verified against code, not assumed)

- **Mood**: `store/types.ts` — AM `Mood` = `motivated|neutral|sick`, separate `EodMood`
  (8 options, evening only). Stored `store.mood[date]`, lock window `store.moodLockedUntil[date]`.
  Set via `setMood` (`store/slices/config.slice.ts:16-27`).
- **Mood → points**: `lib/engine/scoring.ts` — `getMoodMult` (line 38-42): motivated ×`cfg.moodMot`
  (default 1.2), sick ×`cfg.moodSick` (default 0.5). Applied to both earned pts (`todayEarned`)
  and the submit threshold (`getMoodAdjustedMinPts`, line 66-68) — flat multiplier on the whole
  day, not time-weighted. This is intentionally being kept as-is (see Decisions below).
- **Daily target**: `getMinPts(date, cfg)` — weekday `cfg.minPts` (default 70), weekend
  `cfg.weekendPts` (default 20, hardcoded Sat/Sun check). Being generalized to user-configurable
  "light days" (any 2 days/week, Settings-configurable) — see Decisions.
- **Submit flow**: `SubmitArea.tsx` → `submitDay` in `store/slices/tasks.slice.ts`. Gate:
  `canSubmit = (minPts - earned) <= 0`.
- **Streak engine**: `lib/engine/streak.ts` — `runOvernightLogic` (automatic overnight catch-up,
  runs on next login): for each missed day since last submit, either auto-submits (if min pts
  were actually met) or falls back to **rest day** (streak protected, not incremented — always
  wins over losing the streak when `streak > 0`, no weekly cap) or, if `streak <= 0` already,
  just logs a plain unprotected missed day.
- **Manual protection actions** (separate from the automatic overnight path):
  `useFreeze(today)` and `declareRestDay(today)` in `store/slices/streak.slice.ts` — explicit
  user-triggered buttons, not auto-fired by overnight logic. `useFreeze` requires
  `freezeTokens > 0 && streak > 0`; spends one token, marks `frozenDays[today]`.
- **Existing rank-XP decay** (found mid-analysis, **being replaced** — see Decisions):
  `lib/engine/decay.ts` `applyRankDecay` — 2%/day compounding after a 3-day grace period of
  *zero task activity* (`lastActiveDayForDecay` stale vs `today`), run in `useOvernightCheck.ts`
  before the overnight settlement pass. `DECAY_GRACE=3`, `DECAY_RATE` in `constants/points.ts`.
- **Life Score**: `lib/engine/goals.ts:84-105`. Per-zone score = consistency ratio (% of last
  `periodDays` where ≥1 task done in that zone), NOT a share-of-total-tasks metric (a share-based
  formula was proposed and rejected — see Decisions, it always sums to ~100 and can't signal
  overall performance). Total = weighted average using user-editable `Zone.weight` (default 1).
  Currently hardcoded to a 30-day window (`LifeScoreCard.tsx`).
- **Goals**: `features/goals/GoalsInTasks.tsx` — `MAX_GOAL_TITLE=40`, `MAX_GOAL_NOTE=200`,
  subtasks currently uncapped. `completeGoal` (`store/slices/goals.slice.ts:73-93`) credits
  `rankXP`/`walletPts` directly — does NOT touch `history`/today's RXP used by the submit gate.
  Completed goals are filtered out of the Tasks page entirely (`page.tsx:206`), no "completed
  goals" list exists yet.
- **Challenges**: root Firestore collection `sharedTasks/{id}` (`lib/firebase/social.ts:291`).
  `listenIncomingChallenges`/`listenSentChallenges` subscribe per-user. `respondToChallenge`,
  `markChallengeCompletion` mutate via `updateDoc` directly on the shared doc — no separate
  notifications collection; `NotificationBell` derives all notification types client-side from
  live subscriptions to existing docs (friend requests, challenges, reward approvals, etc.),
  capped to latest 30. All notification types currently route to `/tasks?mode=friends` on click
  (`ui/NotificationBell.tsx:200`) — being changed, see Decisions.
- **Rewards**: `app/(tabs)/rewards/page.tsx`. Redemption debits wallet immediately, optional
  approval-gate flow if `FLAGS.FRIENDS`. Streak freeze: `buyFreeze()` (streak.slice.ts:93-99),
  cost `FREEZE_COST=250` wallet pts, capped `freezesBought < MAX_BOUGHT_FREEZES(2)`.
- **History**: `app/(tabs)/history/page.tsx`, no pagination — hardcoded `slice(0, 60)`. Charts:
  Trend, Mood-correlation, Zones, Heatmap (all 4 exist today).
- **Tasks page**: zone filter is a `<select>` dropdown, not full-width chips. Submit-Day area
  renders in-flow at the bottom of the task list (not sticky/fixed) — `.bottom-nav` IS
  `position: fixed` (`app/globals.css:233-244`).

## Decisions made (source of truth — supersedes anything above marked "being changed")

1. **Mood editing**: editable any time during the day (no 2hr/EOD lock complexity), locks at
   day rollover or submit. Scoring formula unchanged — flat multiplier on the whole day's
   target (e.g. neutral→sick: 70→35 regardless of tasks already done), exactly as today.
2. **Light days**: generalize from hardcoded weekend to user-configurable, any 2 days/week,
   set in Settings. Reduces that day's target (percentage TBD at implementation, mirrors
   existing weekend reduction ratio unless specified otherwise).
3. **Sick allowance**: 2 free sick-mood uses per calendar month, no XP penalty. 3rd+ use in the
   same month still applies the sick multiplier to target, but the day counts toward the XP
   penalty system below (mapped to whichever of light/rest/freeze bucket applies that day —
   not a separate 5th rate).
4. **XP penalty system (flat amounts, replaces old inactivity decay — pending final confirm)**:
   - Light day missed → **-20 XP**
   - Rest day (auto-protected) → **-40 XP**
   - Freeze manually used → **-50 XP**
   - Sick (within monthly allowance) → **0 XP**, no penalty
   - Streak broken (`streak <= 0` after a miss) → **-10 XP per day**, starting the day after
     the break, repeating daily until the user meets min pts again (which resets/stops the
     bleed); cycle repeats on the next streak break. Example: 446 XP, streak lost → 436 next
     day → 426 → ... → 346 after 10 days → user meets target on day 11 → bleed stops. This
     bleed fires on every calendar day once `streak <= 0`, regardless of light/rest/freeze
     status, replacing the per-event penalties for as long as the streak stays broken (matches
     the existing code path: once streak is 0, no rest-day auto-protection applies anyway).
   - **CONFIRMED**: old `lib/engine/decay.ts` 2%-compounding inactivity decay is being fully
     **replaced** by the flat system above — remove its usage from `useOvernightCheck.ts`.
   - **-50 XP applies to ANY streak-freeze consumption**, not narrowly to the manual
     `useFreeze()` action specifically — implement by hooking wherever `freezeTokens` actually
     decrements / `frozenDays[date]` gets set, not by name-checking the calling action, so any
     future freeze-consuming path (not just today's manual button) is covered.
5. **Life Score**: keep exact current formula and user-configurable weights. Add a period
   selector — label "Last [dropdown]", options 7D/15D/30D/60D/90D, feeds `computeLifeScore`'s
   existing `periodDays` param. No formula change.
6. **Goals**: standardize title AND subtask AND challenge-goal-title to max **30 chars** (was
   40 for title, uncapped for subtasks). Hard-block input past 30 chars, show inline error at
   the limit, consistent across Add Goal and Challenge Goal forms.
   - Completed goals should get a "completed" section (like tasks), currently entirely hidden.
   - **CONFIRMED**: goal completion adds points to reward wallet AND rankXP AND that day's
     RXP/submit-gate total, credited on the **completion day itself** (not the original due
     day), even if completed before deadline. Requires wiring `completeGoal`
     (`store/slices/goals.slice.ts:73-93`) to also touch `history`/today's RXP, which it
     currently doesn't.
7. **Challenges/notifications**:
   - Confirm modal before sending a challenge (currently fires immediately on click).
   - WhatsApp share/reminder integration: **dropped entirely** — replaced with an in-app-only
     reminder notification (design above, reuses `sharedTasks` doc + existing NotificationBell
     pattern, no new Firestore collection).
   - Rename "Challenge accepted" tab → "My Challenges".
   - Cap both Challenges-given and My-Challenges lists to 6 on screen; build ONE shared
     pagination hook/util reused across Challenges (6/page) and History (8/page) — no
     duplicated pagination logic.
   - Notification click routing: "incoming challenge" AND "own-challenge-accepted/declined/done"
     notifications → Challenges-given tab (confirmed). Reminder notification (new,
     recipient-side) → **CONFIRMED**: routes to "My Challenges".
8. **"You showed up" bonus**: 5% of mood-adjusted min pts, floor/ceil if decimal, credited to
   wallet only (not XP), on first app-open of the day. Progress % shown = bonus/minPts ratio.
9. **Rewards**: on redeem, show a confirmation modal displaying the reward redeemed + points
   deducted; remove that reward from the available list for the rest of the current day
   (re-appears next day), shown as disabled rather than removed pre-redemption. Streak freeze
   count: surface at-a-glance (icon + count) rather than buried in modals only.
10. **Tasks/History UI** (low-risk, no open questions): remove zone-filter dropdown from Tasks
    page; fit Add Task / Add Goal / Challenge Friend buttons on one responsive row; pin Submit
    My Day above the bottom nav (careful with existing `position: fixed` bottom-nav stacking);
    make Streak tile visually affordable/clickable; show Goals on Dashboard; add 7D bar graph
    to History page; remove Heatmap + Mood-correlation charts from History; redesign history
    tile to one line: `Thu, 30 Jul  7/10  Motivate :)  +70XP  >` (no year, no auto/late tags).

## Open questions

None remaining — all resolved as of 2026-07-30 (see CONFIRMED notes inline above).

## Progress log

- **2026-07-30 — Chunk 4 COMPLETE** (Rewards + all UI-only items). Build (`next build --webpack`)
  and full test suite (`vitest run`) pass; coverage clean except a pre-existing branch-coverage
  gap in `lib/engine/goals.ts:116` and `store/slices/goals.slice.ts:28-30,70,84-88` that predates
  this session (uncommitted WIP already present in git status at session start) — will be closed
  as part of Chunk 2, which touches those exact lines for the goal-completion RXP wiring.
  - Note: coverage's 100% threshold (`vitest.config.mts`) only `include`s `lib/engine/**`,
    `store/slices/**`, `store/userScope.ts` — plain `.tsx` UI/page/hook files (e.g. the new
    `hooks/usePagination.ts`, `ui/Pagination.tsx`) are outside that scope and carry no test
    obligation. Chunks 1 and 2 DO touch coverage-tracked files and will need accompanying tests.
  - Added `hooks/usePagination.ts` + `ui/Pagination.tsx` as the shared pagination utility (per
    the "single place, reused" requirement) — Chunk 3's Challenges pagination should reuse these
    directly rather than reimplementing.
  - Added `lib/engine/cutoff.ts` `formatDateShort` (date without year) alongside the existing
    `formatDate` rather than changing `formatDate` itself, since `formatDate` is still used
    as-is by Journal and StreakHistoryModal.
  - `SubmitArea` now takes an optional `pinned` prop (fixed-position above bottom nav via the
    existing `.fixed-bottom-bar` CSS utility) — Tasks page passes `pinned`, Dashboard usage left
    unchanged (in-flow) since only the Tasks-tab placement was requested.
  - Rewards "redeemed today" tracking matches by `title` against `rewardRedemptions` (which has
    no `rewardId` field) since `redeemReward` never persisted the reward's own id — acceptable
    given reward titles are effectively unique in practice, flagged here in case it ever bites.

- **2026-07-30 — Chunk 3 COMPLETE** (Challenges: confirm-before-send, rename, pagination,
  notification routing, in-app reminder). Build and full test suite pass; same pre-existing
  branch-coverage gap as Chunk 4 (unrelated files, not touched here).
  - `ChallengesPanel.tsx`: "Challenges accepted" tab relabeled "My Challenges" (internal state
    key `'accepted'` left unchanged to minimize diff). Both tabs paginated to 6/page via the
    shared `usePagination`/`Pagination` from Chunk 4. Panel now reads `?sub=given|accepted` from
    the URL (via `useSearchParams`, safe since it's always rendered inside Tasks page's existing
    Suspense boundary) to support deep-linking from notifications.
  - `ChallengeModal` (tasks/page.tsx): "Send Challenge" now opens a nested confirm `Modal`
    (summary + Cancel/Confirm & Send) instead of sending immediately; actual send moved to
    `confirmSend()`.
  - `SharedTask` type gained `reminderSentAt?: Record<string, string>` (keyed by friendUid, ISO
    timestamp) — set via new `lib/firebase/social.ts` `sendChallengeReminder()` (plain
    `updateDoc`, no Firestore rules change needed since the existing `sharedTasks` rule already
    lets the owner update any field). Wired through `social.store.ts`'s new
    `sendChallengeReminder` action. "🔔 Send Reminder" button shows on `Challenges given` items
    with `status === 'pending'` only (per literal spec — friend hasn't accepted/declined yet).
    WhatsApp send was explicitly dropped per user decision — in-app only.
  - `NotificationBell.tsx`: added a `route` field to `NotifItem` so each item can navigate
    independently instead of everything going to `/tasks?mode=friends`. `incomingChallenges` and
    `sentChallenges`' accepted/declined/done notices → `/tasks?mode=challenges&sub=given`. New
    reminder notification (derived from `incomingChallenges[].reminderSentAt[myUid]`, no new
    Firestore listener) → `/tasks?mode=challenges&sub=accepted` ("My Challenges"), per user
    decision. All other notification kinds (friend request, validation, reward approval, etc.)
    unchanged, still route to `/tasks?mode=friends`.

- **2026-07-30 — Chunk 2 COMPLETE** (Goals: 30-char limits, completed-goals visibility,
  goal-completion points wired into daily RXP). Build and full test suite pass; the pre-existing
  branch-coverage gap flagged in Chunks 3/4 is now fully closed (100% statements/branches/
  functions/lines) — added targeted tests for the missing `??` fallback branches and the
  goal-not-matched-id branch in `completeGoal`'s map.
  - **NOTE — discovered mid-chunk**: `lib/engine/goals.ts`'s Life Score section had evolved on
    disk since I first described it earlier in this conversation (uncommitted pre-session WIP,
    consistent with the original modified-file list at session start). It's now a "v2" — same
    consistency-ratio concept, but **recency-weighted** (a linear weighting so recent days count
    more than older ones within the window, anchored on the most recent recorded day rather than
    the wall clock) and pools only zones the user has **ever engaged** (an unused zone doesn't
    crater the total, but a previously-used-then-neglected zone still counts against it). This is
    strictly better than the plain ratio I originally explained, and doesn't change any decision
    made — flagging only because the concrete numeric example I gave earlier no longer matches
    the exact formula (the concept — consistency, not task-share — is unchanged).
  - `MAX_GOAL_TITLE` 40→30; added `MAX_GOAL_SUBTASK=30` in `GoalsInTasks.tsx`; challenge-goal
    title/subtask inputs in `ChallengeModal` (tasks/page.tsx) now reuse the existing
    `LimitedField` component for the same 30-char inline-error behavior, instead of plain
    `<input>`s with no cap.
  - Tasks page no longer filters out completed goals (`sortedGoals` = all goals, completed
    sunk to the bottom) — `GoalTile` already had full completed-state styling (strikethrough,
    opacity), it just was never reached because the page filtered completed goals out entirely.
  - `Goal` type gained `awardedPts?: number`, snapshotted by `completeGoal` at completion time
    (post deadline-reduction) so later date-scoped lookups don't have to re-derive an amount that
    would drift once a deadline has since passed. New `lib/engine/goals.ts#goalPtsEarnedOn(goals,
    dateStr)` sums it for a given day. `lib/engine/scoring.ts#todayEarned` gained an optional 4th
    param `goalPtsToday` (default 0, added on top of the mood-scaled task total — goal points are
    NOT mood-scaled, since that multiplier is task-specific and goal points already have their
    own deadline-based reduction). Wired into all 5 call sites: `SubmitArea`, `StatGrid`,
    dashboard's day-progress %, `streak.ts#runOvernightLogic` (per missed day `mk`), and
    `tasks.slice.ts#submitRetroFix`. Wallet/rankXP crediting was already same-day/immediate in
    `completeGoal` — the only actual gap was the daily submit-gate total.

- **2026-07-30 — Chunk 1 COMPLETE** (mood window, configurable light days, sick allowance,
  flat XP-penalty system replacing the old inactivity decay). Build and full test suite pass;
  100% coverage maintained throughout (added `tests/unit/xpPenalty.test.ts` and extended
  `tests/store/config.test.ts`).
  - **Mood**: `setMood`/`MoodBar` simplified — editable any time before the day is submitted,
    no lock window. Removed `moodLockedUntil` entirely (type, defaults, config.slice.ts,
    MoodBar.tsx countdown UI). No change to the scoring formula — same flat mood multiplier
    on the whole day's target as before.
  - **Light days**: `AppConfig.lightDays: number[]` (default `[0,6]`, i.e. Sat/Sun, preserving
    prior behavior for existing users). `getMinPts` now checks `cfg.lightDays` instead of a
    hardcoded weekend check. Settings page gained a 7-day toggle picker capped at 2 selections,
    next to the renamed "Light Day minimum" field (was "Week-off Hours").
  - **Sick allowance**: new `lib/engine/xpPenalty.ts` — `sickCountThisMonth`/`isSickExempt`
    (2 free sick-mood days/month, chronological count within the calendar month). A 3rd+ sick
    day still gets the sick mood multiplier on the target (unchanged) but no longer exempts the
    day from the XP penalty system below.
  - **XP penalty system** (same file): `restOrLightXpPenalty` (light day miss → -20, regular
    rest-day protection → -40, sick-exempt → 0) and `streakBrokenXpPenalty` (flat -10/day while
    `streak <= 0`, sick-exempt → 0). Wired into `runOvernightLogic`'s two missed-day branches
    (`lib/engine/streak.ts`), `useFreeze` (-50 flat, no sick exemption — spending a freeze is a
    deliberate action) and `declareRestDay` (same light/rest logic as the automatic path) in
    `store/slices/streak.slice.ts`. All rankXP reductions clamp at 0 via `Math.max(0, ...)`,
    consistent with existing spend-like reductions elsewhere in the codebase.
  - **Old decay system removed**: deleted `lib/engine/decay.ts` + its test, removed the
    `applyRankDecay` step from `hooks/useOvernightCheck.ts`, and fully removed the now-dead
    `lastActiveDayForDecay` field (type, defaults, `tasks.slice.ts` ×2 write sites,
    `streak.slice.ts` submitDay, plus their test assertions) rather than leaving it as unused
    cruft. `DECAY_GRACE`/`DECAY_RATE` constants removed from `constants/points.ts`.
  - **"You showed up" bonus**: new `claimShowedUpBonus(today)` action in `config.slice.ts` —
    `ceil(5% × mood-adjusted minPts)` credited to `rewardWallet` only (never rankXP), guarded
    against re-claiming the same day via `engagementDays[today]` (self-contained idempotency,
    not reliant on caller discipline). Wired into `useOvernightCheck.ts` right before
    `markEngagementDay`, with a toast on award. New `SHOWED_UP_BONUS_PCT` constant.

## Implementation chunking plan (agreed, all unblocked)

1. Mood window + light-days config + sick allowance + XP penalty system (highest risk, engine
   changes — replaces `lib/engine/decay.ts` entirely).
2. Goals: char limits (30/30/30), completed-goals section, points-to-RXP/wallet/rankXP wiring
   on completion day.
3. Challenges: confirm-before-send, rename, shared pagination hook, notification routing,
   in-app reminder (routes to "My Challenges").
4. Rewards + all UI-only items (Tasks page layout, History redesign, streak tile affordance,
   Dashboard goals).

Executing in order 4 → 3 → 2 → 1 (lowest risk first), per prior agreement.

## How to use this file

Not auto-loaded by Claude Code — only `CLAUDE.md`/`AGENTS.md` (and anything they `@import`) load
automatically at session start. To resume: either paste/reference this file's path at the start
of a session, or add `@project.md` to `CLAUDE.md` to make it load automatically like `AGENTS.md`
does today.

Keep this file updated as decisions are made or chunks are completed — treat "Decisions made" as
the source of truth over the "architecture facts" section if they ever conflict (the latter is a
point-in-time snapshot of the code, the former is what we've agreed to build).
