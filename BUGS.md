# kunals-planner — Bug Log

Running log of real bugs found (root cause + fix), kept separate from `project.md`'s
narrative progress log so past bugs are easy to scan/search on their own. Every entry
here should also have a matching, more detailed write-up in `project.md`'s Progress log
for the batch it was fixed in.

---

## OPEN

_(none currently)_

## FIXED

### 2026-08-09 — Bottom nav renders see-through, scrollable page content (and its buttons) visible/clickable through it

- **Reported by**: Kunal, with a screenshot marked up showing the nav area
  and page content bleeding through it, plus a reference screenshot of a
  properly opaque bottom nav from another app for comparison.
- **Root cause**: `.vx-bottom-nav` combines `background: rgba(...,0.92)`
  with `backdrop-filter: blur(24px)` and `border-radius: 22px`. This is the
  same mobile Chrome/WebView compositing bug already found and fixed once
  this session on `.vx-notif-panel` — certain mobile browsers mis-composite
  `backdrop-filter` together with `border-radius` and clipped children,
  rendering the element fully see-through instead of blurred-opaque. The
  notif panel got the defensive fix at the time; the bottom nav (arguably
  the most-visible fixed element in the whole app) never did.
- **Fix**: `app/globals.css` — `isolation: isolate` to force a real
  stacking/compositing context, an explicit, always-opaque
  `background-color: var(--vx-bg-deep)` (a real per-theme hex, not the
  alpha `--nav-bg-solid` token) as the guaranteed base, and
  `backdrop-filter` moved behind an `@supports` gate so it only layers on
  top where it actually renders correctly.
- **Verification**: Playwright screenshot against a `next build --webpack` +
  `next start` production server with a long scrollable task list behind
  the nav — fully opaque, nothing visible or clickable through it.

### 2026-08-09 — Route-switch loading bar invisible on real phones

- **Reported by**: Kunal — "the loader which is on top of screen is not
  visible on [phone] screen."
- **Root cause**: the bar sits at `top: 0`, the literal top pixel of the
  viewport. On an installed (standalone) iOS PWA, that's under the OS
  status bar — a translucent overlay iOS draws on top of page content in
  standalone mode — so a thin colored bar exactly at that edge gets
  tinted/masked into near-invisibility.
- **Fix**: `app/globals.css` — `top: env(safe-area-inset-top)` (a no-op on
  any non-notched/browser-tab context), height 3px→4px, z-index 300→9999,
  slightly stronger glow.

### 2026-08-09 — Journal "Record voice" always fails

- **Reported by**: Kunal — "it is not working giving error."
- **Root cause, two stacked issues**: (1) `next.config.ts` ships
  `Permissions-Policy: microphone=()` globally — an empty allowlist that
  disables microphone access for every origin, including the app's own —
  so `getUserMedia` was rejected by the browser itself, before any app
  logic ran. (2) even with that fixed, the upload step
  (`uploadJournalAudio`) requires Firebase Storage security rules to be
  deployed; no `storage.rules`/`firebase.json` exists anywhere in the repo,
  so Storage was never actually provisioned and every upload would still
  throw against Firebase's default deny-all rules.
- **Fix**: removed the Record-voice feature entirely for now (button,
  `MediaRecorder` logic, related state/refs) per the user's explicit
  instruction, rather than half-fix #1 and ship a new failure at #2.
  Dictation (speech-to-text) shares neither dependency and is unaffected.
  Full root-cause detail left as a code comment in
  `features/journal/VoiceControls.tsx` for whoever re-adds this later.

### 2026-08-09 — Retro-fix panel almost never appears, and correcting a wrongly-applied Rest Day didn't actually reverse it

- **Reported by**: Kunal. "I recently had completed my tasks but failed to mark
  complete and the app automatically marked the rest day. This creates false data
  and is very demotivating even when the tasks are done... Sometimes due to some
  emergencies or due to a long day we dont [get a chance] to mark tasks completed.
  And after such a stressed day... when a rest day is applied it reduces trust to
  use the app."
- **Symptom**: two compounding problems. (1) A day the user genuinely finished
  but forgot to check off gets auto-marked as a Rest Day (or a plain miss)
  overnight, and there was no real way to correct it afterwards — the
  streak/history/XP stayed permanently wrong even if the user later "fixed" it
  in the app. (2) The panel meant to offer that fix was essentially never
  visible in practice.
- **Root cause 1 (the fix panel almost never showed up)**: the old inline
  retro-fix block on the Dashboard was gated by a check equivalent to
  `now.getHours() < cfg.cutoffHour`. `cutoffHour` defaults to a value in the
  1–4 (AM) range — meaning the panel was only ever rendered during a roughly
  1–4 hour window right after midnight. Anyone opening the app at a normal
  hour (which is effectively everyone, especially after "a long day") would
  never see it at all. This alone explains most of "we don't get a chance to
  enter missed data."
- **Root cause 2 (fixing a day didn't actually fix it)**: the old
  `submitRetroFix` only ever rewrote the day's *displayed* numbers (task
  checklist, `%`, `rxp` shown in history) — it never reversed the underlying
  Rest Day verdict, never restored the streak, never refunded the XP penalty
  that had been applied, and never freed up that week's rest-day slot. So even
  a "successfully fixed" day stayed permanently recorded as a Rest Day with an
  under-counted streak — the false data the user described.
- **Fix**: two parts.
  1. Replaced the single-day, cutoff-hour-gated panel with `RetroFixPanel`
     (`features/dashboard/components/RetroFixPanel.tsx`), driven by a new pure
     function `getFixableDays` (`lib/engine/retroFix.ts`) — it surfaces every
     day within a rolling window (`cfg.retroWindowDays`, new Settings field,
     default 3, range 1–7) that the overnight engine auto-resolved (`auto:
     true` — never a day the user deliberately chose to rest/freeze) and that
     still falls short of that day's target, regardless of what hour it is now.
  2. Rewrote `submitRetroFix` (`store/slices/tasks.slice.ts`) so that when the
     corrected tasks actually clear the day's target, it does a real reversal:
     refunds the exact XP penalty originally applied for that day (via the
     same deterministic `restOrLightXpPenalty`/`streakBrokenXpPenalty`
     functions used to apply it), increments the streak (safe for any day in
     the window — the automatic path never decrements a live streak, only
     ever holds it flat via rest-day protection), re-grants any streak
     milestone bonus newly crossed, clears the day from `restDays`, and
     recomputes that week's `weekRestUsed` flag (checking whether another rest
     day still exists that same week rather than blindly clearing it). A
     deliberate rest day or freeze (`auto: false`) is never touched.
- **Verification**: `lib/engine/retroFix.ts` and the `tasks.slice.ts` upgrade
  branch brought to 100% unit-test coverage (`tests/unit/retroFix.test.ts`,
  new cases in `tests/store/tasks-extra.test.ts`) — 440/440 tests passing,
  100% statements/branches/functions/lines. Live end-to-end verification via a
  throwaway Playwright script against a seeded anonymous session: confirmed
  the panel renders and is labeled correctly outside the old 1–4AM window,
  ticking off the day's tasks and saving flips the history entry from
  `rest: true` to `rest: false, late: true`, the streak increments live in the
  rendered UI, `restDays`/`weekRestUsed` are correctly cleared/recomputed, and
  the exact rankXP delta matches hand-calculated expectations (task-level XP
  credited at checkbox-toggle time + the day's overflow-past-target bonus +
  the refunded original penalty, mirroring how a normal on-time submission
  is credited) once the test scenario's date range was cleaned up to remove
  an unrelated, correctly-behaving extra auto-processed gap day that had
  initially made the numbers look wrong.

### 2026-08-07 — Submit My Day bar floats too far above the bottom nav on real devices (production)

- **Reported by**: Kunal, with a screenshot from a real phone in production. "The
  submit my day is not getting fixed at the bottom close to the navigation bar. There
  is a gap between which should not be there. In local environment it didn't show, but
  production is showing this bug."
- **Symptom**: on a real phone, the Submit My Day bar (Tasks page) sits with a large,
  visibly wrong gap above the bottom nav pill instead of sitting close to it. Not
  reproducible when just eyeballing it in desktop dev tools.
- **Root cause**: CSS safe-area-inset handling was applied asymmetrically between the
  two elements. `.fixed-bottom-bar` (the Submit bar), `.vx-calm-fab`, and
  `.vx-task-fab-wrap` all correctly add `env(safe-area-inset-bottom)` to their `bottom`
  offset so they rise to clear a device's home-indicator/gesture-nav area. `.vx-bottom-nav`
  (the floating nav pill) did **not** — it was hardcoded to `bottom: 16px` regardless of
  the device's safe-area inset. On a desktop browser or a plain emulator, that inset is
  always `0`, so the missing `env()` call was invisible and the two elements lined up
  with the intended ~8.6px gap. On a real phone with a non-zero safe-area inset (Android
  gesture-nav phones, iPhones with a home indicator both commonly report 24–48px), the
  Submit bar kept rising with the inset while the nav pill stayed pinned at a flat 16px
  — opening a gap that grows in exact proportion to the device's inset. This is **not**
  a dev-vs-production code difference (confirmed — see Verification) — it's a
  desktop/emulator-testing-vs-real-device difference that only a real phone can surface,
  which is exactly why it looked fine "in local environment" and only showed up once
  actually used on a production device.
- **Fix**: `app/globals.css` — `.vx-bottom-nav`'s `bottom` changed from a flat `16px` to
  `calc(16px + env(safe-area-inset-bottom))`, matching every other fixed bottom element
  it needs to stay aligned with. The nav now rises by the same amount as the Submit bar
  (and the Calm Down button, and the task FAB) on any device, so the gap between them
  stays constant regardless of the device's safe area.
- **Verification**: wrote a throwaway Playwright script (`debug_gap.mjs`, deleted after
  use) that opens `/tasks` at a 390×844 mobile viewport and uses the Chrome DevTools
  Protocol's `Emulation.setSafeAreaInsetsOverride` to simulate real device insets
  (0px / 24px / 34px / 48px — spanning "no inset" through "iPhone home indicator" through
  "typical Android gesture nav"), then measures the live `getBoundingClientRect()` gap
  between `.fixed-bottom-bar` and `.vx-bottom-nav`.
  - **Before the fix**: gap grew 1:1 with the inset — 8.6px / 32.6px / 42.6px / 56.6px at
    insets 0 / 24 / 34 / 48px respectively. Exactly matches the reported symptom and
    explains why it scales with how aggressive a given phone's gesture-nav/home-indicator
    area is.
  - **After the fix**: gap is a constant 8.6px at every tested inset (0 / 24 / 34 / 48px).
  - Ran the exact same measurement against **both** `next dev` (Turbopack — this repo's
    `dev` script) and a real `next build --webpack && next start` production server, both
    before and after the fix, to specifically rule out a dev/prod bundler difference —
    results were identical in both modes at every inset tested. Confirms this was purely
    a device-inset issue, not a build-tool CSS discrepancy.
  - `tsc --noEmit` clean, `vitest run --coverage` 418/418 at 100% coverage,
    `next build --webpack` clean, matching this session's standard verification bar.
