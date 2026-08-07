# kunals-planner — Bug Log

Running log of real bugs found (root cause + fix), kept separate from `project.md`'s
narrative progress log so past bugs are easy to scan/search on their own. Every entry
here should also have a matching, more detailed write-up in `project.md`'s Progress log
for the batch it was fixed in.

---

## OPEN

_(none currently)_

## FIXED

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
