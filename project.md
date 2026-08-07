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

## UI Redesign Initiative (started 2026-08-03)

Separate track from the chunking plan above — a visual/interaction redesign, not a
feature/scoring change. Triggered by user feedback that the app "looks quite dead" and
should feel "lively" and "premium."

- **Decisions made**:
  1. Visual style: **vibrant gradient** direction (dark canvas, glassmorphism, animated
     aurora background, bold gradient text/accents on violet/pink/amber/cyan) — explicitly
     NOT neon-cyberpunk, NOT premium-glass-only (both were alternatives shown and rejected).
  2. Scope: **Dashboard page first** (the flagship/first-seen page) rather than all tabs at
     once. Other tabs (Tasks, Journal, Rewards, History, Settings) are restyled in later
     passes, reusing the same token/variant system established here.
  3. Delivery approach: standalone HTML/CSS/JS prototype first (approved by user), then real
     implementation inside the Next.js app.
  4. Animation library: added **Framer Motion** as a new dependency to drive transitions
     (spring physics, shared-layout sliding indicators, `AnimatePresence` for modals).
- **Status: Dashboard implementation COMPLETE** (see progress log entry below for detail).

## Progress log

- **2026-08-07 — Fourth batch (12 items) + one infra fix discovered along the way:
  streak-modal reorder/freeze-confirm/freeze-count, modals ignoring Light/Cream
  theme, Focus overlay text contrast, water-tracker icon, Submit-bar width/premium
  styling, Journal 10 entries, History 6/page, Calm Down premium texture, Day
  Progress card merges task count + bigger text, "Done today"→Water Intake tile,
  "Points today"→7D Life Score, Water Tracker reordered above Focus Time.** `tsc
  --noEmit` clean, `vitest run --coverage` 418/418 at 100% coverage, `next build
  --webpack` clean, live Playwright verification of every item below.
  - **Infra fix, found while verifying — `postcss.config.mjs` was missing from
    this repo entirely.** Without it, Next.js has no way to invoke
    `@tailwindcss/postcss` (present in `package.json` but inert without this
    file), so `@import "tailwindcss"` in `globals.css` only pulled in Tailwind's
    static theme variables/preflight — every actual utility CLASS (`flex`,
    `grid-cols-2`, `text-2xl`, `text-[15.5px]`, etc.) silently failed to
    generate; the compiled CSS literally still had the raw, unprocessed
    `@tailwind utilities;` directive in it. Confirmed this only affected THIS
    cloud workspace's checkout, not what you've actually been testing — your
    screenshots this whole session clearly show properly-padded, properly-
    spaced, properly-sized UI, which isn't possible without a working
    postcss config, so your local copy already has an equivalent file (or
    something else providing it) that just never made it into this workspace.
    Added the standard two-line config (`plugins: { '@tailwindcss/postcss': {} }`).
    Delivering it is safe either way — if you already have an identical file,
    this is a no-op overwrite; if you don't, it fixes a real (if previously
    invisible-to-you) gap. Re-verified `next build --webpack`'s output CSS
    afterward: `.text-2xl{font-size:...}` and `.flex{display:flex}` etc. now
    present as real rules, confirming the fix.
  1. **Streak modal — "Today's Actions" now leads, freeze needs confirmation,
     freeze count always visible**: `StreakHistoryModal.tsx` reordered so the
     Rest Day / Use Freeze buttons render before the month calendar (previously
     below it, requiring a scroll). "Use Freeze" no longer fires immediately on
     click — it now opens a confirm modal mirroring the existing Rest Day
     confirm pattern. Added a permanent "❄ N streak freezes available" line
     under the two action buttons (previously only discoverable by hitting the
     button's disabled "no tokens" state).
  2. **Modals stuck dark under Light/Cream theme — root cause found**: this
     was a genuine CSS cascade-layers bug, not a missing scope class. The `vx-`
     token defaults (`--vx-bg-deep`, `--vx-card`, `--vx-fg-1..4`, etc.) are
     declared twice: once inside `[data-theme="light"]`/`[data-theme="cream"]`
     blocks in `@layer base` (correct light/cream values), and once in a plain
     `:root` block inside `@layer components` (dark values, meant only as the
     Dashboard-redesign's original fallback). Per the CSS cascade-layers spec,
     a layer declared earlier in the file ALWAYS loses to one declared later,
     regardless of selector specificity — so the `components`-layer `:root`
     dark defaults were unconditionally beating the more-specific but
     earlier-layered `[data-theme="light"]` override, for any element outside
     `.page-container`'s `.vx-light-scope`/`.vx-cream-scope` subtree.
     Everything portalled to `document.body` (Modal, NotificationBell, the
     Calm Down overlay, TaskActionFab, the Focus run overlay, …) lives outside
     that subtree, so all of it was silently stuck dark — this is why it
     specifically looked like "modals ignore the theme" while page content
     (which IS inside the scoped subtree) themed correctly. Fixed by adding a
     second `[data-theme="light"]`/`[data-theme="cream"]` pair directly in
     `@layer components`, positioned after the offending `:root` block — same
     layer, later source order, so it now correctly wins for `<html>` (and
     therefore cascades to every portalled element), while the existing
     `.vx-light-scope`/`.vx-cream-scope` overrides still correctly take
     precedence for anything inside `page-container` since they sit on a
     closer DOM ancestor. Live-verified: `.vx-modal-sheet`'s computed
     `background-color` is `rgb(255,255,255)` under Light theme now (was
     `rgb(27,27,29)`, the dark value, before the fix).
  3. **Focus overlay text illegible**: the radial-gradient backdrop's center
     was only 16% opaque, so bright content behind it (Light/Cream theme, or
     just a busy dashboard) showed straight through and clashed with the
     overlay's fixed white text. Raised the gradient close to fully opaque
     end-to-end and added `backdrop-filter: blur(40px)` — per explicit
     preference for "increase blur intensity" over hand-tuning per-theme text
     colors — so it reads as solid regardless of theme or what's behind it.
  4. **Water tracker icon**: 🥤 (a juice glass with a straw — wrong symbol for
     a water tracker) replaced with a new `ui/WaterGlassIcon.tsx`, a small SVG
     of a plain drinking glass with an animated blue water level. Made it
     dynamic (fill level reflects today's intake vs. the new configurable
     daily target, animates on change with a spring) rather than a static
     "always half full" image, reused by both the Water Drank card and the
     new Water Intake stat tile.
  5. **Submit-My-Day bar vs. bottom nav — width mismatch + "premium" ask**:
     the bar's width formula (`min(860px, calc(100vw - 2rem))`) had nothing to
     do with the nav pill's own width (`max-width: calc(100vw - 24px)`,
     effectively clipped to exactly that on phones), so the bar visibly
     overhung the narrower nav below it. Added a `.vx-submit-bar-pinned`
     modifier class (applied alongside the shared `.fixed-bottom-bar`, which
     Settings' Save button also uses and wasn't touched) that matches the
     nav's width formula exactly (`min(480px, calc(100vw - 24px))`) and a
     `.vx-submit-bar-active` modifier that swaps the old flat white box for
     the same glassy blurred-pill treatment the nav itself uses
     (`--nav-bg-solid` + `backdrop-filter: blur(20px)`), so the two now read
     as one aligned, consistent unit instead of two mismatched shapes.
     Live-measured: bar width and nav width are now pixel-identical (366px on
     a 390px-wide test viewport, both clipped to the same formula).
  6. **Journal past entries 8→10, History 6/page**: both were already using
     the shared `usePagination`/`Pagination` hook+component (Prev/Next
     buttons already existed) — just changed `JOURNAL_PAGE_SIZE` in
     `app/(tabs)/journal/page.tsx` and `PAGE_SIZE` in `app/(tabs)/history/
     page.tsx`. No other code needed.
  7. **Calm Down button "looks dead"**: redesigned from a flat glass pill to
     a soft blue-violet gradient circle with a slow (3.6s) pulsing glow behind
     it via a `::before` radial-gradient — deliberately gentle/slow rather
     than a generic attention-grabbing throb, echoing the breathing rhythm the
     button opens into.
  8. **Day Progress card**: subtext changed from "{earned}/{target} pts so
     far. Keep the streak alive." to "{earned}/{target} pts & {done}/{total}
     tasks so far.\nKeep the streak alive." (line break before "Keep the
     streak alive", per the literal request) — the task count folds in here
     instead of needing its own tile below (see item 10). Both the "Day
     progress" heading and the subtext line are +2px over their previous
     sizes (13.5px→15.5px heading, 11.5px→13.5px subtext).
  9. **StatGrid "Points today" → 7D Life Score, "Done today" → Water Intake**:
     both old tiles were pure duplicates of information already shown
     elsewhere (points/target in the Day Progress card just above, via item
     8; task count now also folded into that same card) — replaced rather
     than kept redundant. "🧭 7D Life Score" calls the existing
     `computeLifeScore(zones, history, 7)` engine function (no new formula).
     "💧 Water Intake" shows `{litres today}` of `{configurable target}L` —
     new `AppConfig.waterTargetMl` field (default 2000 = 2L), configurable in
     a new Settings → Wellness section, shared with the bigger Water Drank
     card's fill-level icon (item 4). `AnimatedNumber` gained an optional
     `decimals` prop (default 0, so every other existing card's integer
     count-up is byte-identical) so the water figure can count up to 2
     decimal places instead of rounding to a whole litre. On reaching the
     target, the tile gets a `.vx-tile-complete` treatment — a pulsing
     emerald glow border plus a diagonal light-sweep shimmer — rather than a
     one-off confetti burst, so the "complete" state stays visibly
     celebratory for as long as it's true, not just for a moment.
  10. **Water Tracker card moved above Focus Time** on the Dashboard
      (`app/(tabs)/dashboard/page.tsx`) — simple render-order swap, no other
      change.

- **2026-08-07 — Third batch (4 items, from live-testing screenshots): Submit-My-Day
  vs. bottom-nav overlap, Tasks-page "+" FAB not visible, Calm Down button symbol →
  plain "calm / down!" text, route-switch loading indicator.** Follow-up to the same
  day's second batch, based on screenshots showing the previous fix wasn't fully
  correct on the user's actual device. `tsc --noEmit` clean, `vitest run --coverage`
  418/418 at 100% coverage, `next build --webpack` clean. Verified live with the same
  throwaway-Playwright-against-dev-server pattern as prior batches (script + temporary
  `proxy.ts` allowlist both removed/reverted afterward) — this time including actual
  `boundingBox()` measurements of the three stacked fixed elements (`.vx-bottom-nav`,
  `.fixed-bottom-bar`, `.vx-task-fab-wrap`) to confirm real pixel clearance rather than
  eyeballing a screenshot, since that's what let the previous overlap ship unnoticed.
  1. **Submit My Day overlapping the bottom nav**: root cause was a plain wrong
     magic-number offset, not a containing-block/portal bug this time — `.fixed-
     bottom-bar`'s mobile override was `bottom: calc(60px + safe-area)`, but the
     actual `.vx-bottom-nav` pill (bottom:16px + its own padding/icon/label content)
     is taller than that 60px gap, so the submit bar's bottom edge landed inside the
     nav pill instead of above it — exactly matching the user's screenshot. Bumped
     to `calc(92px + safe-area)`. Live-measured: bar bottom edge now sits ~8.6px
     above the nav's top edge (was overlapping by roughly that same amount before).
  2. **"+" FAB not visible**: direct consequence of the same miscalculation — the
     FAB's own `bottom: calc(150px + safe-area)` was tuned against the *old* (too
     low) submit-bar position, so once dropped behind/into the taller submit bar
     it was effectively hidden underneath it despite a higher z-index technically
     putting it "in front" (it was rendering, just fully overlapped by the wider,
     opaque submit bar sitting at the same screen position). Raised to `calc(210px
     + safe-area)` on mobile (and `112px` on the desktop breakpoint, which has no
     bottom nav but still has the pinned submit bar at its own `8px` offset —
     tightened proactively even though not reported, since the same offset math
     applies there too). Live-measured final gap between the FAB and the submit
     bar's top edge: 70px — comfortably clear.
  3. **Calm Down button symbol unclear**: replaced the 🌬️ wind emoji + "Calm down"
     label with plain stacked text, exactly as specified — "calm" / "down!" on two
     lines, centered, no icon. Button reshaped from a pill to a circle to suit the
     two-line text better. Removed the old max-width:420px "icon-only on narrow
     phones" fallback entirely since there's no icon to fall back to anymore — the
     two short words fit the circle at any width.
  4. **No feedback while a tab switch/page compile is in progress ("screen looks
     dead")**: added a thin animated progress bar fixed to the very top of the
     viewport (`.vx-route-progress`, same visual pattern as GitHub/YouTube's
     top-of-page loading bar), driven by new `navigating`/`showLoader` state in
     `app/(tabs)/layout.tsx`. It appears ~120ms after a tab tap (bottom nav, top
     nav, or swipe — all funnel through the existing `navigateTab` helper) so an
     instant switch never flashes it, and stays visible for however long the
     switch actually takes, clearing only once the target pathname really commits.
     **Confirmed this exactly matches the reported symptom**: live-measured a cold
     (never-yet-compiled-this-dev-session) navigation to `/tasks` taking **6.5
     seconds** in dev before the pathname updated — previously that whole window
     had zero visual feedback; now the progress bar is visible for the entire
     6.5s and disappears within ~400ms of the page actually being ready. This is
     a dev-mode-compile-specific delay (production builds ship pre-compiled), but
     the same loader also covers any genuinely slow switch in production (e.g. a
     low-end device or a heavy page), so it was kept generic rather than dev-only.

- **2026-08-07 — Second batch (10 items): Calm Down floater fix + quote bank, Focus
  Time confirm+blocking-overlay redesign, Water tracker tile + modal reminder,
  streak-orb circle (2nd pass — background/radius, not just border), goal/task
  cancellation-with-reason + challenge notifications, Tasks-page green expanding FAB,
  mood collapse-to-selected UX, Submit-My-Day/FAB fixed-positioning fix, light-day
  weekly-change gate (Monday week-start), PWA iOS/Android detection hardening.**
  Follow-up to the same day's 12-item batch above, based on live user testing of that
  delivery. `tsc --noEmit` clean, `vitest run --coverage` 418/418 passing at 100%
  statements/branches/functions/lines, `next build --webpack` clean (17 routes, zero
  errors). Verified live via a throwaway Playwright script (`verify2.mjs`, deleted
  after use) against the dev server, using the same temporary `proxy.ts`
  `/dashboard`+`/tasks` allowlist pattern as prior batches (fully reverted afterward).
  1. **Calm Down floater wasn't appearing**: root cause was the same
     filter-creates-containing-block bug documented earlier in this log — the
     overlay was already portalled to `document.body`, but the trigger `<button>`
     itself was not, so it rendered inside `page-container` and (depending on
     scroll position within the tall Dashboard page) could land off-screen or
     behave as non-fixed. Fixed by portalling the button too, mirroring
     `TaskActionFab`'s existing pattern (`features/wellness/CalmDownButton.tsx`).
     Confirmed the button itself was already Dashboard-only-mounted (moved off the
     global app shell in the 12-item batch just before this one — not a regression).
     Live-measured `boundingBox().y` before/after `window.scrollTo(0, 400)`: now
     identical (was drifting before the portal fix). Also added: a Cancel button on
     the breathing overlay (was already present from the 12-item batch, re-verified),
     and a 2000-entry motivational quote bank (`constants/motivationalQuotes.ts`,
     20 sentence templates × 100 trait words, `getRandomQuote()`), a different quote
     shown on every open.
  2. **Focus Time redesigned**: tile no longer shows "Pts gained"/"XP gained" —
     only the three duration buttons remain, with an explanatory line ("Start an
     uninterrupted focus session to earn bonus reward points and XP") instead of
     numbers, so the reward amounts are a surprise/progressive-disclosure rather
     than spelled out on the tile. Clicking a duration now opens a confirm dialog
     ("Start a 25-minute focus session?" / Cancel / Start Focus) before anything
     starts. Confirming opens a new full-screen portalled overlay
     (`.vx-focus-overlay`, `FocusRunOverlay` in `FocusTimeCard.tsx`) reusing the
     existing `GradientRing` animation at a much larger size (260px vs. the small
     inline version) with the countdown below it and a "Cancel session" button —
     this is the literal "app-level" blocking the user asked for (a full-screen
     modal that can only be dismissed by cancelling the session, since a browser
     app has no OS-level screen lock). Cancelling still forfeits the reward, same
     policy as before (not explicitly restated this round, carried over intent).
  3. **Water reminder converted from toast to modal**: `WaterReminder.tsx` now
     renders a `<Modal variant="vx">` ("💧 Hydration reminder") instead of the
     previous silent toast — matches how the PWA install reminder surfaces, per
     the user's explicit comparison. "Later" dismisses; "+250ml, got it" logs the
     water and dismisses in one action. New `WaterTrackerCard` on the Dashboard
     (between Focus Time and Life Score) shows "💧 Water Drank / {X.XX} ltrs so
     far" with −/🥤(250ml)/+ buttons wired to a new `addWater(today, deltaMl)`
     store action (clamped at 0, additive, keyed by day in new `waterMl:
     Record<string, number>` state).
  4. **Streak-orb circle — second pass**: the first (12-item) batch only removed
     `.vx-streak-orb`'s `border`, but the screenshot in this round showed the
     circle was still visible — caused by the *background* (`var(--color-accent-dim)`)
     and explicit `border-radius: 50%`/fixed `width`/`height` still rendering a
     filled circle even with no border stroke. Rewrote the rule to drop
     `background`, `border-radius`, and the fixed dimensions entirely, leaving
     just a flex column (flame emoji + count number, no shape behind them).
     Live-measured `getComputedStyle` on the element: `backgroundColor` is now
     `rgba(0,0,0,0)` and `borderRadius` is `0px`.
  5. **Goal/task cancellation with reason + challenge notifications**: new
     `cancelTask(taskId, reason)` / `cancelGoal(goalId, reason)` store actions
     (soft-cancel via `cancelledAt`/`cancelReason` fields, mutually exclusive with
     `done`/`completedAt` — can't cancel something already finished or already
     cancelled). Surfaced as a 🚫 "Cancel task"/"Cancel goal" icon button with a
     reason-picker confirmation modal (`CANCEL_REASONS`: Changed my mind / No
     longer relevant / Too ambitious for now / Ran out of time / Other) on the
     Tasks page and in `GoalsInTasks.tsx`. **Interpretation call**: cancellation is
     offered on ALL active tasks/goals, not only challenged ones — the user's
     wording ("user should be able to cancel the goal with a cancellation reason")
     didn't restrict it to challenges; only the *notify-the-challenger* half is
     challenge-specific. **Discovered mid-implementation**: goals had NO
     challenge-completion sync to Firestore at all before this batch — only tasks
     did (via `challengeId` + a watcher in `social.store.ts`). Added `challengeId`
     to the `Goal` type, wired it through `addChallengeGoal`/`acceptChallenge`,
     and extended the watcher to cover goals for both completion and the new
     cancellation case. New `markChallengeCancelled()` in `lib/firebase/social.ts`
     stamps `perUserStatus.{uid}: 'cancelled'` + `cancelReason.{uid}` on the shared
     challenge doc; `NotificationBell` surfaces a "Your challenge was cancelled:
     {reason}" notice to the challenger, alongside the existing completion notice.
  6. **Tasks-page action row → floating "+" button**: removed the inline "+Add
     Task / Add Goal / Challenge Friend" row; replaced with `TaskActionFab`
     (bottom-right, portalled, green gradient per explicit correction from the
     pink reference screenshot) that expands into the same three options with a
     staggered Framer Motion transition (each option fades/slides in ~40ms apart)
     and rotates its "+" to "×" while open.
  7. **Mood collapses to the selected chip**: `MoodBar.tsx` now shows only the
     selected mood as a single pill once one is picked for the day, re-expanding
     to the full Motivated/Neutral/Sick picker on click (still fully editable, not
     locked). Resets to the full picker automatically on day rollover (keyed off
     `today` via `useEffect`). Every change was already being appended to
     `moodChangeLog` (added this same batch, `{date, kind: 'am'|'pm', mood, at}` —
     "kind" distinguishes the AM check-in from the separate EOD mood) for future
     historical display; no history UI was requested yet, so only the log itself
     was added.
  8. **Submit-My-Day and the new FAB weren't staying fixed on scroll**: same root
     cause as the Calm Down button (#1) and the previously-documented
     `page-container` `filter` containing-block bug — `SubmitArea`'s `pinned`
     branch (`.fixed-bottom-bar`, used on the Tasks page) was still a plain,
     non-portalled fixed element. Fixed by portalling that branch's rendered
     content to `document.body`; `TaskActionFab` was built portalled from the
     start to avoid the same bug pre-emptively. Live-measured both elements'
     `boundingBox().y` before/after a `window.scrollTo` — both now identical
     (previously the submit bar would drift).
  9. **Light-day weekly-change gate**: `setConfig` now blocks a `lightDays` change
     if one was already made within the current Monday-start week (compares
     `getWeekMonday()` of a new `cfg.lightDaysChangedAt` timestamp against this
     week's Monday), while still applying any other fields in the same update.
     Settings page shows the picker disabled with a "changes again next Monday"
     hint when locked. Separately confirmed via code read that rest-day weekly-cap
     logic (`weekRestUsed` in `streak.slice.ts`/`lib/engine/streak.ts`) was
     **already** using the same Monday-start `getWeekMonday()` helper — no change
     needed there, the user's ask was already satisfied.
  10. **PWA iOS/Android detection**: re-confirmed (by reading, not guessing)
      `detectPlatform()` in `features/pwa/PwaBootstrap.tsx` already branches
      correctly on iOS vs. Android vs. desktop and shows different numbered
      install steps for each — this was genuinely already correct from the prior
      batch. The user's skepticism is most likely explained by testing through
      desktop Chrome's device-emulation toolbar, which doesn't reliably override
      every UA-detection code path. Hardened one real edge case found while
      re-checking it: iPadOS in "desktop site" mode reports a Mac-like
      `navigator.userAgent`, now caught via a `maxTouchPoints > 1` check alongside
      the UA string so it's still classified as iOS rather than desktop.
  - **Verification caveat**: while screenshotting the Dashboard for this batch, the
    existing (untouched-by-this-batch) "Day progress" ring card showed visual
    overlap between the ring and its adjacent text in the throwaway test harness.
    Traced to the test harness's fresh-anonymous-session seed data producing a
    `0/0` target (not a real production data shape) — not caused by, or related
    to, anything changed in this batch (no file in `RankProgress.tsx`/
    `GradientRing.tsx`/the "Day progress" card was touched). Flagging here rather
    than silently ignoring it — worth a real-account check next time this area of
    the Dashboard is touched, but out of scope for this batch's requested items.

- **2026-08-07 — 12-item batch: PWA install reminder, goal/challenge visibility &
  edit-lock fixes, mobile modal centering, Dashboard scroll/streak-orb polish, Calm
  Down breathing exercise, water reminder, Focus Time rewards, mood-scoring rework,
  recurring-task checkbox (replaces the standalone Recurring tab), recurring
  carry-forward exclusion.** All 12 items from the user's batch request implemented.
  Full `tsc --noEmit`, `vitest run --coverage` (401/401, 100% statements/branches/
  functions/lines on the gated paths), and `next build --webpack` all clean.
  Verified live via a throwaway Playwright script against the dev server (using
  `StoreBootstrap`'s anonymous no-cookie fast path + a temporary `proxy.ts`
  `/dashboard`+`/tasks` allowlist entry, both fully reverted/deleted afterward —
  no trace ships): Dashboard is genuinely scrollable (`scrollHeight` 2217 >
  `innerHeight` 780), the streak orb border is `none`, the Focus Time card renders
  with correct duration/reward labels, the Calm Down button opens an animating
  breathing overlay and closes cleanly, the Tasks page mode tabs no longer list
  "Recurring", the Add/Edit Task modals show the new recurring checkbox (unchecked
  by default on Add, correctly pre-checked on Edit for an existing recurring task),
  toggling it on/off correctly adds/removes the task's "🔁 Recurring" chip, and any
  `<Modal>` instance (checked via Add Task, same shared component the Submit-My-Day
  modal uses) is exactly viewport-height with symmetric left/right gaps and no
  overflow — confirming the `100dvh` mobile-viewport fix.
  1. **PWA install reminder**: new `detectPlatform()`/`detectStandalone()` in
     `features/pwa/PwaBootstrap.tsx`. A `<Modal variant="vx">` reminder pops ~2.5s
     after mount, gated to once per calendar day via `localStorage`
     (`kp_pwa_reminder_seen`, ISO date string), with OS-specific numbered install
     steps (iOS Safari share-sheet steps vs. Android Chrome's ⋮-menu steps vs. a
     generic desktop fallback) and "Install now" (when `beforeinstallprompt` fired)
     / "Remind me tomorrow" actions. The pre-existing native floating "Install App"
     button (tied to the real `beforeinstallprompt` event) is unchanged and coexists.
  2. **Completed goals removed from the active list**: `sortedGoals` in
     `app/(tabs)/tasks/page.tsx` changed from "all goals, completed sunk to the
     bottom" (the 2026-07-30 Chunk 2 decision) to `allGoals.filter(g =>
     !g.completedAt)` — **this explicitly reverses that prior decision** per the
     user's new instruction that completed goals should disappear from the current
     list entirely once done (no "completed goals" section was requested this time,
     so none was added — a goal simply drops off the list on completion, same
     end-user-visible behavior as completed tasks already had).
  3. **Challenged tasks/goals non-editable by the accepter**: this was actually
     already implemented in the 2026-08-03 batch (`TaskRow`/`GoalTile` hide
     edit/delete when `challengedBy` is set) — re-verified still correct, no code
     change needed.
  4. **Submit My Day modal off-screen/unscrollable on mobile**: root cause was the
     classic `position: fixed; inset: 0` layout-viewport-vs-visual-viewport mobile
     quirk — `inset`'s implied `bottom` was being computed against the layout
     viewport (extends under the address bar) instead of the visual one. Fixed at
     the shared-component level in `ui/Modal.tsx` (both `default` and `vx`
     variants): backdrop gained `style={{ height: '100dvh' }}` (dynamic viewport
     height overrides `inset`'s implied bottom per CSS 2.1 §10.6.4 over-constraint
     resolution), sheet gained `maxHeight: '82dvh'`/`'88dvh'` + `-webkit-overflow-
     scrolling: touch`. Fixes every modal in the app in one place, not just Submit
     Day. Also patched three hand-rolled overlays that duplicate `.vx-modal-backdrop`
     markup instead of using `<Modal>` (same bug, needed the same fix individually):
     both `SubmitArea.tsx` evening-quote overlays (vx + non-vx) and
     `MorningQuoteOverlay.tsx`.
  5. **Streak-orb circle removed**: `.vx-streak-orb`'s `border: 1px solid
     var(--vx-border)` changed to `border: none` in `app/globals.css`. (The soft
     amber glow `box-shadow` and the tile's own circular background are unaffected
     — those aren't a border and weren't part of the complaint.)
  6. **Dashboard scrollability**: no concrete blocking bug found via static
     analysis (no `overflow:hidden`/fixed-height container on the page or its
     ancestors). Applied defensive CSS (`html`/`body` explicit `overflow-y: auto`
     and `min-height: 100dvh`) and confirmed via live Playwright measurement that
     the page was already — and remains — genuinely scrollable; this item is best
     read as pre-emptive given the same batch adds two new Dashboard sections
     (Focus Time, Calm Down) that make the page taller.
  7. **Calm Down button + 5-minute guided breathing**: new `features/wellness/
     CalmDownButton.tsx`, a fixed floating action button (`.vx-calm-fab`, bottom-
     right) mounted globally in `app/(tabs)/layout.tsx` so it's available on every
     tab, not just Dashboard. Opens a full-screen portalled overlay with a
     Framer-Motion circle that scales up/down on a **4s inhale / 6s exhale** cycle
     (a generic, widely-used calming cadence — chosen since the user said to "keep
     it general so normal people can do," not a clinical/personalized protocol) and
     a "Breathe in… / Breathe out…" label, auto-closing after 5 minutes with a
     visible countdown, plus a manual close button.
  8. **Water reminder**: new `features/wellness/WaterReminder.tsx`, mounted
     globally alongside the Calm Down button. Purely local `localStorage`-based
     (not synced to the zustand store/Firestore — a per-device nag, not app state),
     checks every 60s whether 2 hours have elapsed since the last reminder
     (`kp_water_last_reminder`), shows a random rotating message via the existing
     toast singleton. Seeds silently on first-ever run so a brand-new user isn't
     nagged immediately.
  9. **Focus Time section**: new `features/dashboard/components/FocusTimeCard.tsx`,
     inserted on the Dashboard between `RankProgress` and `LifeScoreCard`. Three
     duration buttons (25 min / 45 min / 1 hr) start a live countdown; on natural
     completion, credits the reward table below via a new store action
     `completeFocusSession`. Cancelling early forfeits the reward (no partial
     credit) — this wasn't explicitly specified, but matches how every other
     timed-reward mechanic in the app already works (e.g. an interrupted day
     doesn't get partial submit credit).
     - New `FOCUS_REWARDS` table in `constants/points.ts`: 25min → 2 pts / 4 XP,
       45min → 5 pts / 10 XP, 60min → 10 pts / 20 XP (exact numbers from the
       user's request).
     - `AppState` gained `focusSessions: FocusSessionLog[]` (date/minutes/pts/xp/
       timestamp log) and `completeFocusSession(today, minutes)`, implemented in
       `store/slices/rewards.slice.ts` — credits `rewardWallet`/`rankXP` directly,
       parallel to how goal completion already credits both.
  10. **Mood scoring rework**: per the user's explicit clarification, only
      `motivated` still boosts the day's mood multiplier and only `sick` still
      reduces it — **this is actually the existing behavior already** (`getMoodMult`
      in `lib/engine/scoring.ts` only special-cases `motivated`/`sick`; `neutral`
      and all 8 evening-only `EodMood` values were already scoring-neutral, just
      recorded) — so no scoring-logic change was needed here, only the second half:
      **mood check-in counting**. Added `moodCheckins: number` to `AppState`
      (defaults to 0), incremented idempotently (only on a given date's *first*
      set, not on every edit/re-set) in both `setMood` (AM) and `setEodMood` (PM)
      in `store/slices/config.slice.ts`. Surfaced as a small "N check-ins" label in
      `MoodBar.tsx` next to the mood picker.
  11. **Recurring-task checkbox (not a standalone tab)**: the user explicitly
      corrected their own original ask mid-session — **reversing** the 2026-08-03
      batch's `RecurringPanel`/`EditRecurringModal`/"Recurring" mode-tab
      implementation. That entire UI (both function definitions, the mode-tab
      entry, the `?mode=recur` deep-link routing) was deleted from
      `app/(tabs)/tasks/page.tsx`. In its place: a single checkbox — "🔁 Make this
      recurring (auto-adds it every day)" — inside `AddTaskModal`, and "🔁
      Recurring task (auto-adds a fresh copy of this every day)" inside
      `EditTaskModal`, pre-checked/unchecked based on whether `task.recurId` points
      at a live `RecurringTemplate`. Checking it on Add creates a new
      `RecurringTemplate` (`addRecurring`, now returns the new id instead of
      `void`) and links the new task to it via `recurId`; on Edit, checking/
      unchecking calls `addRecurring`/`editRecurring`/`removeRecurring` as
      appropriate to keep the template in sync with the task's current fields.
      `TaskRow` shows a "🔁 Recurring" chip on any task with a live `recurId`. The
      underlying `RecurringTemplate`/`injectRecurring` daily-instantiation
      mechanism (store/engine layer) is untouched — only the entry-point UI
      changed, per the user's clarification that this was the intent all along.
  12. **Recurring tasks excluded from next-day carry-forward**: added a `!recurId`
      guard everywhere an incomplete task gets copied to the next day, since a
      linked `RecurringTemplate` already produces a fresh instance for the next day
      on its own — carrying the old (undone) instance forward too would duplicate
      it. Guarded in all four places this happens: `submitDay`
      (`store/slices/streak.slice.ts`), `runOvernightLogic`'s main loop AND its
      `gap === 1` special case (`lib/engine/streak.ts`), and the standalone
      `carryTask` action (`store/slices/tasks.slice.ts`).

- **2026-08-03 — 14-item bug/polish batch: notif-bell mobile transparency, selectable
  Light/Cream theme, recurring-task edit/delete, non-editable challenge tasks/goals,
  dashboard quote contrast, Pomodoro/Auto-export removal, badge variety, Invalidate
  Streak removal, showed-up bonus %, streak-orb border, PIN 5→6 migration, Settings
  tab wrap, bug-report photo upload.** All 14 items from the user's batch request
  addressed; one fragment ("it website mode the") was too garbled to act on and was
  left unimplemented — flagged back to the user rather than guessed at.
  - **Notification bell mobile transparency**: root cause never fully pinned down —
    `--vx-bg-deep` (the panel's background) is a fully opaque, theme-independent hex
    value, so it should never be literally transparent; leading theory is a mobile
    Chromium/WebView compositing bug where `backdrop-filter` + `border-radius` +
    `overflow: hidden` mis-composites. Applied a defensive fix in `app/globals.css`'s
    `.vx-notif-panel`: explicit opaque `background-color` fallback, `isolation: isolate`,
    and gated `backdrop-filter`/`-webkit-backdrop-filter` behind an `@supports` query
    so blur is skipped wherever it might not composite correctly — the solid background
    always applies regardless of `@supports` support.
  - **Theme system reworked to actually respond to the picker** (previously had no
    visible effect): `.vx-dark-scope` was being unconditionally applied to every page's
    `page-container` in `app/(tabs)/layout.tsx`, overriding the theme regardless of
    `cfg.theme`. Now `AppShell` picks one of `vx-dark-scope`/`vx-light-scope`/
    `vx-cream-scope` based on `cfg.theme`. Added new `.vx-light-scope`/`.vx-cream-scope`
    blocks in `app/globals.css` (full token parallel — `--vx-fg-1..4`, `--vx-surface-tint`,
    `--vx-card`/`--vx-border`/`--vx-bg-void`/`--vx-bg-deep`, plus the legacy alias tokens)
    and did a mechanical pass converting ~110 hardcoded `rgba(255,255,255,N)` inline
    colors across 17 files to the new `var(--vx-fg-N)`/`var(--vx-surface-tint)` tokens so
    every vx- component actually repaints under Light/Cream instead of staying white-on-white
    or invisible. `ThemeMode` narrowed to `'light' | 'dark' | 'cream'` — "System" removed
    everywhere (it never actually tracked the OS theme). Nav/bottom-nav/notification-bell
    chrome intentionally still stays fixed dark glass in all three themes, matching the
    pre-existing documented "always dark glass" nav pattern from the UI Redesign Initiative.
  - **Recurring tasks**: `app/(tabs)/tasks/page.tsx` gained a `RecurringPanel` (lists
    `store.recurring` templates as tiles with edit/delete) and `EditRecurringModal`
    (full edit form for a template). `AddTaskModal` gained an `initialRecurring` prop so
    the panel's "+ Add Recurring Task" button pre-checks the recurring checkbox, while
    the normal "+ Add Task" button still defaults unchecked — there was no dedicated
    recurring-entry-point before this, so "default checked in the recurring flow" is
    interpreted per that new distinction.
  - **Challenge tasks/goals are now view+complete-only**: `TaskRow` (tasks/page.tsx) and
    `GoalTile` (`features/goals/GoalsInTasks.tsx`) hide their edit/delete buttons when
    `task.challengedBy`/`goal.challengedBy` is set — completing is still allowed.
  - **Dashboard quote contrast**: swapped `text-[var(--text3)]` for explicit
    `var(--vx-fg-3)`/`var(--vx-fg-4)` inline colors on the quote + attribution.
  - **Removed from Settings**: the Pomodoro section, the Auto-export section (+ its
    `AutoExportFolderRow` helper), and the "Invalidate Streak" button/confirmation modal.
    Only the Settings UI was removed in all three cases — the underlying config fields
    (`autoExportEnabled`, `pomoDuration`) and the `invalidateStreak` store action are
    still present/untouched, since the ask read as "declutter the screen," not "delete
    the feature."
  - **Badge variety**: new `lib/engine/badges.ts` with milestone tables for tasks done
    (10/50/100/250/500), goals done (1/5/10/25), and journal days (1/10/30/100) — pure
    functions, unit-tested to 100% branch coverage, wired into `toggleTask`/`completeGoal`/
    `saveJournalEntry` with in-`set()` dedup against `s.badges`. Existing streak-length
    badges are untouched/separate.
  - **"You showed up" bonus now shows its %**: `claimShowedUpBonus` (config.slice.ts)
    now also stamps `lastShowedUpBonus: { date, bonus, minPts }`; `MorningQuoteOverlay`
    reads it and shows "🎁 +{bonus} 🪙" plus "Day progress bonus: {bonus/minPts%}" —
    matches Decision #8's "Progress % shown = bonus/minPts ratio".
  - **Streak orb**: removed the `border: 1px solid rgba(251,191,36,0.35)` from
    `.vx-streak-orb` — the soft amber glow (`box-shadow`) and the orb's own circular
    background remain, since those aren't a "border" and are part of the intended design.
  - **Journal PIN 5→6 digit migration**: `PIN_LENGTH` bumped to 6 (`OLD_PIN_LENGTH = 5`
    kept for reference), new `journalPinLength` field stamps whichever length a PIN was
    hashed at. `PinPad` gained an optional `length` prop; `PinGate` detects
    `pinLength !== PIN_LENGTH` and runs a `migrate-verify` (old 5-digit PinPad) →
    `migrate-setup` (normal 6-digit PinSetup) flow before unlocking. Hash verification
    itself needed no change — PBKDF2/SHA-256 doesn't bake in digit count.
  - **Settings tab row wrap**: added `flex-wrap: wrap` to `.vx-modeswitch` + a matching
    inline style on the Settings tab row so it wraps to a second line on narrow screens
    instead of overflowing.
  - **Bug report photo upload**: new `uploadBugReportImage` (`lib/firebase/storage.ts`,
    same pattern as the existing `uploadJournalAudio`), `BugReport`/`submitBugReport`
    gained an optional `imageUrl`. `BugReportForm` gained a 5MB-capped image picker with
    preview/remove, uploads best-effort before submitting (a failed upload doesn't block
    the report).
  - **Verification**: `tsc --noEmit`, `vitest run --coverage` (396/396, 100%
    statements/branches/functions/lines on the gated paths), and `next build --webpack`
    all clean. Visual QA via the usual throwaway `/dev-preview` route (seeded store +
    `useSocialStore`, bypassed auth via a one-line `proxy.ts` allowlist entry — both
    fully removed after) + Playwright: confirmed Dark/Light/Cream all render distinctly,
    the mobile notif panel opens opaque with visible text, Settings tabs wrap on a
    375px viewport, the Recurring panel and challenge-task/goal read-only state render
    correctly, the FAQ tab's screenshot-attach control renders, and the PIN migration
    screen shows the correct "enter your current 5-digit PIN" copy. One false alarm
    during QA: the harness's first draft nested the aurora background inside the same
    positioned box as the page content (instead of as a sibling of a `position: relative`
    `<main>`, like the real `app/(tabs)/layout.tsx`), which made the Settings "Streak &
    Badges" tab appear completely blank — fixed the harness to match the real DOM
    structure, re-verified, confirmed it renders fine; no app code was at fault.
  - **Not implemented**: item 5 of the original batch ("it website mode the") was too
    garbled to safely infer intent — needs the user to restate it.

- **2026-08-03 — Notification panel reworked: icon-anchored dropdown instead of a
  centered modal.** User feedback on the previous fix: "The Notification modal should
  open from the notification icon attached to it, like apps usually have not a
  confirmation box like." The centered-modal treatment (previous log entry) correctly
  fixed the transparency/positioning bug, but didn't match how bell/notification
  icons behave in every other app (Gmail, Slack, Twitter/X, etc.) — a small dropdown
  anchored right under the icon, not a full-screen dimmed dialog.
  - `ui/NotificationBell.tsx`: reverted from `<Modal variant="vx">` back to a custom
    `position: fixed` panel anchored to the bell button's `getBoundingClientRect()`,
    portalled to `document.body` (this part was already correct pre-modal-refactor and
    is what avoids the `page-container` `filter`-creates-containing-block bug from the
    prior entry — portalling escapes it same as Modal.tsx does).
  - **Made the anchoring robust this time** (the original pre-redesign version of this
    dropdown didn't clamp, which likely contributed to the "transparent"/broken-looking
    reports): `right` is clamped so the panel can't be pushed past either screen edge,
    and `maxHeight` is computed from the actual remaining viewport space below the icon
    (`window.innerHeight - rect.bottom - 24`) so it can never run off the bottom of the
    screen either. Panel width is `min(320px, calc(100vw - 16px))` in CSS so it's never
    wider than the viewport regardless of where it lands.
  - Kept everything from the modal-based version that wasn't about *how it opens*:
    opaque `var(--vx-bg-deep)` background (this was never actually the issue —
    confirmed via live inspection both times — it's a real global CSS var, resolves
    fine everywhere), per-item dismiss (×) and "Dismiss all" (now in the panel's own
    header row instead of a body button, closer to how e.g. Gmail's notification
    panel lays out its clear-all action). Outside-click-to-close and
    close-on-scroll/resize restored (standard dropdown behavior — a centered modal
    doesn't need these, an anchored dropdown does).
  - CSS: restored `.vx-notif-panel`/`.vx-notif-header` (redesigned as a flex header
    row with the title + a `.vx-notif-dismiss-all` text button, rather than relying on
    Modal's title bar), kept `.vx-notif-list`/`.vx-notif-item`/`.vx-notif-item-text`/
    `.vx-notif-item-dismiss` from the previous pass unchanged.
  - **Verification**: same throwaway `/dev-preview` + Playwright pattern (deleted
    after, along with the `proxy.ts` allowlist entry). Confirmed via
    `getBoundingClientRect()` that the panel anchors directly below-right of the bell
    icon (not centered/full-screen) and stays fully within the viewport at both a
    normal desktop width (1280px) and right at the 1024px breakpoint where the bell
    becomes reachable (1030px) — `right`/`left` never negative, never past
    `window.innerWidth`. Confirmed dismiss-one and dismiss-all both work visually.
    Full `tsc`/`vitest` (381/381)/`next build --webpack` all clean.
  - Same mobile-reachability note as before still applies (not in scope for this
    fix): the bell only renders inside `.vx-nav-top`, CSS-hidden below 1024px width;
    `.vx-bottom-nav` (the real mobile nav) doesn't include it.

- **2026-08-03 — Bug fix: modals centering on the scrollable page instead of the
  viewport; notification panel redesigned as a centered modal with dismiss.**
  User report: "all the modal are opening below the mobile screen... the notification
  modal is transparent now and the text is not visible."
  - **Root cause (modals)**: `app/(tabs)/layout.tsx`'s `page-container` motion.div
    animates the CSS `filter` property (`blur(4px)` → `blur(0px)` on route change). A
    non-`none` `filter` on an ancestor establishes a new containing block for
    `position: fixed` descendants — same rule as `transform`/`will-change`/
    `backdrop-filter` — so every non-portalled "fixed, centered" modal backdrop was
    actually being sized and centered against the full scrollable `page-container` box
    instead of the true viewport. On any page taller than one screen this put the
    modal well below what's visible. Confirmed via live `getBoundingClientRect()`
    inspection in a throwaway repro (backdrop rect height jumped from 900 — the real
    viewport — to ~2972 — the full page's scroll height — the moment the `filter`
    animate prop was present on the ancestor).
  - **Fix**: `ui/Modal.tsx` (both `default` and `vx` variants) now renders via
    `createPortal(..., document.body)`, matching the pattern already used by
    `NotificationBell`. This fixes every `<Modal>` usage across the whole app in one
    place. Also portalled three hand-rolled overlays that duplicated
    `.vx-modal-backdrop` markup instead of using the shared component (same bug,
    needed the same fix individually): `features/dashboard/components/
    MorningQuoteOverlay.tsx`, and both the vx and non-vx evening-quote overlays in
    `features/dashboard/components/SubmitArea.tsx`.
  - **Root cause (notification panel)**: `ui/NotificationBell.tsx` rendered a
    corner-anchored dropdown positioned via `getBoundingClientRect()`-derived pixel
    `top`/`right` coordinates. This was fragile — background/text became unreliable
    depending on where the panel ended up — and didn't match what the user actually
    wanted.
  - **Fix + new feature**: rebuilt the notification panel to render through the same
    shared `Modal` (`variant="vx"`) instead of a hand-positioned dropdown, so it's
    always a proper full-screen-backdrop, centered, opaque sheet like every other
    modal (and automatically gets the portal fix above). Added per-item dismiss (×
    button) and a "Dismiss all" action — dismissal is a local-only concept (notifications
    are derived from live Firestore subscriptions each render, nothing to delete
    server-side), tracked via a `dismissed` id set in `localStorage`
    (`kp_notif_dismissed:<uid>`), mirroring the existing `seen`/`kp_notif_seen:<uid>`
    pattern. Dropped the now-unused corner-positioning/outside-click/scroll-close
    logic entirely (no longer needed once it's a centered modal). New CSS:
    `.vx-notif-list`, `.vx-notif-item` (flex row), `.vx-notif-item-text`,
    `.vx-notif-item-dismiss`; removed the now-unused `.vx-notif-panel`/`.vx-notif-header`
    (header is now Modal's own title bar).
  - **Verification**: reproduced the modal bug live (throwaway `/dev-preview` route +
    Playwright, same disposable-route pattern as prior sessions — deleted along with
    its one-line `proxy.ts` allowlist entry afterward) by measuring the backdrop's
    actual rect before/after the fix; confirmed it changed from full-page-height to
    exactly the viewport `{0,0,420,900}`. Confirmed the notification panel opens
    centered with a fully opaque background and visible text, and that both dismiss
    actions work (individual item disappears; "Dismiss all" clears the list to
    "Nothing yet."). Full `tsc`/`vitest` (381/381)/`next build --webpack` all clean.
  - Note for future work: the notification bell only renders inside `.vx-nav-top`,
    which is CSS-hidden below 1024px width (`.vx-bottom-nav` — the actual mobile nav —
    doesn't include it at all). Not touched in this fix since it wasn't part of what
    was reported, but worth flagging: on a genuinely narrow/mobile viewport the bell
    is currently not reachable at all, only on tablet/desktop-width screens.

- **2026-08-03 — UI Redesign: Notification bell + Tasks/Rewards/History/Settings/Journal
  COMPLETE.** Extends the vx redesign (previously Dashboard-only) to the rest of the app,
  per the agreed rollout sequence: notification bell fix first, then tasks → rewards →
  history → settings → journal. Build (`next build --webpack`) and full test suite
  (`vitest run`, 381/381) pass with zero regressions after every page; no engine/store logic
  touched, presentational layer only.
  - **Trigger**: notification dropdown didn't match the dark nav (used theme-linked
    `var(--bg)`/`var(--border)`/`var(--text)` against an always-dark nav background).
    `ui/NotificationBell.tsx` restyled with fixed vx- colors (`.vx-bell-btn`, `.vx-bell-badge`,
    `.vx-notif-panel/-header/-empty/-item`), `AnimatePresence`/`motion.div` for the dropdown.
  - **Found & fixed while investigating**: `.vx-nav-btn`/`.vx-tab-item` also used theme-linked
    text color against the always-dark nav — Light-theme users would have seen near-invisible
    nav text everywhere, not just around the bell. Fixed with fixed `rgba(255,255,255,...)`
    values (nav is always dark glass regardless of theme).
  - **Architectural decision**: `.vx-dark-scope` (previously Dashboard-only) is now applied to
    `page-container` for ALL tabs via `app/(tabs)/layout.tsx`, and the ambient aurora background
    now renders once there too (removed from Dashboard's own page). Low-risk — it only
    re-declares existing token names to their existing Dark-theme values — and a prerequisite
    for the redesign to look consistent across tabs. Settings' Theme-picker row copy was
    updated to state this honestly ("the in-app experience always uses this signature dark
    look now — Light/System still apply to the sign-in screens") rather than leaving a
    now-partially-inert control unexplained.
  - **New shared vx- primitives added to `app/globals.css`**: `.vx-field` (dark-glass
    input/select/textarea), `.vx-btn` + variants (`ghost`/`primary`/`accent`/`cyan`/`danger`/
    `icon`), `.vx-tile` (+`.vx-accent-l` colored-left-border variants), `.vx-chip` (+ tone
    variants), `.vx-modeswitch` (segmented control w/ framer-motion sliding pill, same pattern
    as LifeScoreCard's period selector), `.vx-check` (round checkbox), `.vx-keypad-btn` (PIN
    pad keys), plus new tones on the existing `.vx-pill.vx-tinted`. `.setting-input` and
    `.badge` (both used pervasively across Settings) were redefined in place to vx tokens —
    a single-class fix that upgraded dozens of call sites at once.
  - **Bug pattern fixed everywhere it appeared**: hardcoded light-theme hex colors combined
    with theme-var backgrounds (e.g. `border-[#CECBF6]`, `#E24B4A`, `#EF9F27`, `#4A9EE0`) that
    didn't respond to dark-scope re-declaration — found and fixed in Tasks' `Countdown` chip,
    Rewards' streak-freeze button, and `features/journal/VoiceControls.tsx`'s dictation/record
    buttons (this last one only surfaced during the Journal pass — confirmed zero remaining
    matches via grep across the whole app afterward).
  - **Pages redesigned** (all `<Modal>`/`<Accordion>` usages got `variant="vx"`; mode/tab
    toggles converted to `.vx-modeswitch` with a shared framer-motion `layoutId` per page):
    Tasks (+ `GoalsInTasks.tsx`, `ChallengesPanel.tsx`, `FriendsPageContent.tsx`,
    `ui/Pagination.tsx` simplified), Rewards (+ `PendingApprovalsPanel.tsx`), History (+
    `HistoryChartsSection.tsx`, `DailyTrendChart.tsx`, `ZoneBreakdownChart.tsx`), Settings
    (largest pass — `SectionLabel`/`SettingCard`/`SettingRow` helpers, theme/font pickers,
    zone management, streak controls, all destructive-action modals, `BugReportForm`,
    `AutoExportFolderRow`), Journal (+ `ui/PinGate.tsx`, `ui/PinPad.tsx`, `ui/PinSetup.tsx` —
    all three shared by the Journal PIN gate and Settings' PIN-management modal, so fixing them
    once covers both entry points).
  - **Verification**: beyond build/tests, did a visual pass via a temporary throwaway
    `/dev-preview` route (seeded representative store data across tasks/goals/history/
    journal/badges, bypassed auth via a one-line `proxy.ts` allowlist entry) rendering all six
    tabs directly, screenshotted with Playwright. All six confirmed correctly dark/vibrant with
    no light-theme bleed-through. One apparent white-background artifact on the two longest
    pages (Settings/Journal) traced to a Playwright `fullPage`-screenshot + instant-`scrollTo`
    repaint race, not a real bug — confirmed by inspecting live computed styles (the aurora's
    `position: fixed` element correctly reports `{0,0,420,900}`, full coverage) and by
    reproducing a real wheel-scroll + repaint wait, which showed full dark coverage with no
    gap. The `/dev-preview` route and the `proxy.ts` tweak were both fully removed/reverted
    afterward — no trace ships.
  - Next up (not started): nothing remaining in the UI Redesign Initiative — all six tabs now
    share the vx design system. Future feature work should keep using the existing vx- token/
    variant conventions established across Dashboard + this chunk rather than introducing new
    ad-hoc styling.

- **2026-08-03 — UI Redesign: Dashboard implementation COMPLETE.** Real (non-prototype)
  implementation of the approved vibrant-gradient redesign, scoped to the Dashboard page only
  per the agreed scope. Build (`next build --webpack`) and full test suite (`vitest run`,
  381/381) pass with zero regressions — confirms no engine/store logic was touched, only the
  presentational layer.
  - Added `framer-motion` as a new dependency (`package.json`/`package-lock.json`).
  - `app/globals.css`: new unlayered "vx-" prefixed section (tokens, gradients, glass cards,
    aurora background, gradient text, pills/segmented controls, rings/bars, modal/accordion/
    nav styling) — kept clearly separated from existing "legacy" classes/tokens by naming
    convention and file position, so nothing else is affected.
  - `ui/Modal.tsx` and `ui/Accordion.tsx` gained an opt-in `variant?: 'default' | 'vx'` prop —
    default branch is byte-identical to before, so every other page's usage is unaffected.
  - New shared components: `ui/AnimatedNumber.tsx` (spring-driven count-up), `ui/GradientRing.tsx`
    (animated SVG progress ring), `ui/Confetti.tsx` (imperative `fireConfetti()`, mirrors the
    existing `showToast()` singleton pattern).
  - Rewrote Dashboard's own components for the new look while preserving all underlying
    logic/computations exactly: `MoodBar`, `StatGrid`, `RankProgress`, `LifeScoreCard`,
    `StreakHistoryModal`, `MorningQuoteOverlay`, `SubmitArea` (forked on the existing `pinned`
    prop so the Tasks-page usage of `SubmitArea` is completely untouched), and the Dashboard
    page itself (`app/(tabs)/dashboard/page.tsx`).
  - `app/(tabs)/layout.tsx`: top nav and bottom nav restyled with a Framer Motion
    `layoutId`-based sliding active-tab indicator; page-transition wrapper now animates
    opacity/slide/blur on route change. A `.vx-dark-scope` class (full dark-theme token
    re-declaration) is applied to the shared `page-container` only when `pathname ===
    '/dashboard'`, so the redesign renders correctly regardless of the user's Light/Dark/System
    theme setting without affecting any other tab.
  - Verified via a temporary, throwaway `/dev-preview` route (seeded store data, bypassed auth)
    since exercising the real authenticated `/dashboard` route would have required driving the
    real Firebase auth flow — deliberately avoided. That route, and the one-line `proxy.ts`
    tweak that exposed it, have both been fully removed/reverted; no trace of them ships.
  - Next up (not started): apply the same "vx" token/variant system to Tasks, Journal,
    Rewards, History, and Settings in later passes, per the agreed Dashboard-first scope.

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
