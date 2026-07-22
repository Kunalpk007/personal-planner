# Kunal's Planner — Bug Tracker & Fix Log

> **How to use this file:**
> Before fixing any bug, Claude will reference this file, state the bug ID, describe the proposed fix logic, and wait for explicit approval. No code is written until "yes, proceed" is given.
> Format for approval request: _"Bug #X — [name]. Proposed fix: [logic]. Approve?"_

---

## Status Legend
| Icon | Meaning |
|------|---------|
| 🔴 | Open — not started |
| 🟡 | Pending approval |
| 🟢 | Fixed & verified |
| ⚫ | Deferred / won't fix |

---

## CRITICAL BUGS

### BUG-001 — Login data isolation (user B sees user A's data)
**Status:** 🟢 Fixed  
**Severity:** Critical  
**Area:** `app/(tabs)/layout.tsx` → `handleSignOut`  
**Root Cause:** `router.push('/login')` is a client-side navigation — the JS module (Zustand singleton) stays in memory. Next.js 16 docs explicitly recommend `window.location.href` for logout flows.  
**Fix Applied:** Changed `router.push('/login')` → `window.location.href = '/login'` for a full page reload that re-initialises all modules.  
**Tests:** `tests/store/isolation.test.ts` (13 tests, all passing)

---

### BUG-002 — Carry-forward tasks not appearing (gap = 1 day)
**Status:** 🟢 Fixed  
**Severity:** Critical  
**Area:** `lib/engine/streak.ts` → `runOvernightLogic`  
**Root Cause:** Loop `for (let d = 1; d < gap; d++)` with gap=1 → `d < 1` is immediately false → body never runs → yesterday's incomplete tasks never copied to today.  
**Fix Applied:** Added explicit `if (gap === 1)` block after the main loop.  
**Tests:** `tests/unit/streak.test.ts` — gap=1 carry tests added.

---

### BUG-003 — Streak history showing wrong icon (78 pts on Saturday showing 🌤 instead of ✅)
**Status:** 🟢 Fixed  
**Severity:** High  
**Area:** `features/dashboard/components/StreakHistoryModal.tsx` → `dayIcon`  
**Root Cause:** Icon logic checked `isWeekend` first and returned 🌤 for any weekend day regardless of whether weekday threshold was met.  
**Fix Applied:** Check `rxp >= weekdayMin` first; 🌤 only when `isWeekend && rxp >= weekendMin && rxp < weekdayMin`.

---

### BUG-004 — ChunkLoadError on browser after dev server recompile
**Status:** 🟢 Fixed  
**Severity:** Medium (dev only)  
**Area:** `app/global-error.tsx` (new file)  
**Root Cause:** Browser holds stale chunk URLs from previous compilation.  
**Fix Applied:** Added global error boundary that detects ChunkLoadError and calls `window.location.reload()` automatically.

---

## HIGH PRIORITY OPEN BUGS

### BUG-005 — RetroFix banner hardcoded 12pm cutoff
**Status:** 🟢 Fixed  
**Severity:** High  
**Area:** `app/(tabs)/dashboard/page.tsx` line 69  
**Root Cause:** `now.getHours() < 12` hardcoded — should use `cfg.cutoffHour` (defaults to 1am) so banner respects the user's configured daily cutoff.  
**Fix Applied:** Changed to `now.getHours() < cfg.cutoffHour`.

---

### BUG-006 — submitRetroFix does not mark day as submitted
**Status:** 🟢 Fixed (partial — streak reconciliation deferred)  
**Severity:** High  
**Area:** `store/slices/tasks.slice.ts` → `submitRetroFix`  
**Root Cause:** `rankXP` and `rewardWallet` were already updated correctly via `toggleTaskRetro` (each individual toggle). Missing piece: `submittedDays[dateKey]` was never set to `true`, so the retro panel could re-appear and the day didn't register as submitted.  
**Fix Applied:** Added `submittedDays: { ...state.submittedDays, [dateKey]: true }` to the `set({})` call.  
**Deferred:** Full streak re-evaluation when retroFix pushes rxp above minPts threshold (complex, separate bug — streak impact depends on all subsequent days).

---

### BUG-007 — Journal entry deletion has no confirmation dialog
**Status:** 🟢 Resolved (was already working)  
**Severity:** Medium  
**Area:** `app/(tabs)/journal/page.tsx`  
**Finding:** `confirmDelete(key)` → `setDeleteKey(key)` → `<Modal open={!!deleteKey}>` → `handleDelete()` → `deleteEntry(deleteKey)`. The modal is fully and correctly wired. No code change needed.

---

### BUG-008 — Journal save gives +5 XP but does NOT credit rewardWallet
**Status:** 🟢 Resolved (was already working)  
**Severity:** Medium  
**Area:** `store/slices/journal.slice.ts` → `saveJournalEntry`  
**Finding:** `walletBonus = Math.floor(JOURNAL_XP / WALLET_RATIO) = Math.floor(5/2) = 2`. The line `rewardWallet: isFirst ? s2.rewardWallet + walletBonus : s2.rewardWallet` is already in place and correct. Toast text matches: "+5 Rank XP + 2 wallet pts for journaling!". No code change needed.

---

### BUG-009 — Carry-forward tasks lost on auto-submit (overnight auto-logic path)
**Status:** 🟢 Resolved (covered by BUG-002 fix)  
**Severity:** High  
**Finding:** `runOvernightLogic` initialises `patch.tasks = [...state.tasks]` (a full copy) then pushes new carried tasks into it. `applyOvernightPatch` calls `set(patch)` which replaces `tasks` with the correctly-expanded array. The gap=1 case was missing (BUG-002) and is now fixed. Multi-day gap path was always correct.

---

## MEDIUM PRIORITY OPEN BUGS

### BUG-010 — showRetroFix appears for days with 0 tasks (misleading)
**Status:** 🔴 Open  
**Severity:** Medium  
**Area:** `app/(tabs)/dashboard/page.tsx`  
**Description:** `yesterdayTasks.length > 0` check exists but `yesterdayTasks` includes carry-forward tasks which may be injected into "yesterday" from auto-logic. Confirm the filter is using the right date.

---

### BUG-011 — No route-level error boundaries
**Status:** 🟢 Fixed  
**Severity:** High  
**Fix Applied:** Added `error.tsx` to all six tab routes: `dashboard`, `tasks`, `journal`, `rewards`, `history`, `settings`. Each renders a tab-specific message and a "Try again" reset button. Errors in one tab no longer blank the entire app.

---

### BUG-012 — No "Saved / Saving / Offline" sync status indicator
**Status:** 🟢 Fixed  
**Severity:** Medium  
**Fix Applied:** Added `lib/sync-status.ts` (lightweight module-level pub/sub, zero Zustand coupling) and `ui/SyncStatusBadge.tsx` (renders "Saving… / Saved ✓ / Offline ⚠" in the nav bar). `StoreBootstrap` calls `setSyncStatus('saving'/'saved'/'error')` around each debounced Firestore write. Badge only appears when Firebase sync is active.

---

### BUG-013 — Session expiry handled silently
**Status:** 🟢 Fixed  
**Severity:** Medium  
**Fix Applied:** `proxy.ts` now distinguishes between "no cookie" (unauthenticated) and "cookie exists but failed verification" (expired). Expired sessions redirect to `/login?from=...&reason=session_expired`. Login page reads the `reason` param and shows an amber banner: "Your session expired. Please sign in again."

---

### BUG-014 — Dark mode doesn't respect OS preference on first load
**Status:** 🟢 Fixed  
**Severity:** Low  
**Fix Applied:** Added `'system'` to `ThemeMode` type. Default theme in `defaults.json` changed from `"dark"` to `"system"`. `ThemeApplier` now resolves `'system'` via `window.matchMedia('prefers-color-scheme: dark')` and subscribes to live OS changes. Returning users who saved an explicit theme (`'light'` or `'dark'`) in localStorage are unaffected.

---

## SESSION 4 — USER-REPORTED BUGS & FEATURES

### BUG-015 — Same user sees different data on different browsers/devices
**Status:** 🟢 Fixed
**Severity:** Critical
**Area:** `features/auth/StoreBootstrap.tsx`, `store/index.ts`, `store/types.ts`
**Root Cause:** On load, local `localStorage` state always won over the Firestore cloud snapshot (`{...cloudData, ...savedState}`), even if the cloud copy was newer (e.g. edited on another device/browser since).
**Fix Applied:** Added `lastModified` (ISO timestamp) to `AppState`, stamped on every store mutation via a wrapped `set` in `store/index.ts`. `StoreBootstrap` now compares local vs. cloud `lastModified` and merges with whichever snapshot is newer, defaulting to local only when cloud has no newer timestamp.

### BUG-016 — Rest day / streak freeze usable when streak is already 0
**Status:** 🟢 Fixed
**Severity:** Medium
**Area:** `lib/engine/streak.ts` (`runOvernightLogic`), `store/slices/streak.slice.ts` (`useFreeze`, `declareRestDay`)
**Fix Applied:** Both actions now no-op when `streak <= 0`; overnight auto-logic skips the rest/freeze branches entirely at streak 0 and logs a plain "missed" entry instead. UI buttons in `StreakHistoryModal` and the dashboard freeze card are disabled with a "No streak to protect" label.

### BUG-017 — Swipe-to-navigate doesn't register on short/empty pages (e.g. empty History)
**Status:** 🟢 Fixed
**Severity:** Medium
**Area:** `app/(tabs)/layout.tsx`
**Root Cause:** The swipe touch handlers live on `<main>`, which had no `min-height` — on short pages (like History with no entries), most of the viewport sat outside `<main>`, so swipes there never fired `onTouchStart`/`onTouchEnd`.
**Fix Applied:** Added `minHeight: '100dvh'` to `<main>` so the swipe target always covers the full viewport regardless of content length.

### BUG-018 — No feedback on tap/click, so users can't tell if it registered
**Status:** 🟢 Fixed
**Severity:** Medium
**Area:** `ui/ClickFeedback.tsx` (new), mounted in `app/layout.tsx`
**Fix Applied:** Global capture-phase `pointerdown` listener on interactive elements shows the existing `.nav-loading-bar` style after a 100ms delay if the tap hasn't visibly resolved, auto-hiding on route change or after ~1s.

### BUG-019 — Auto-submit and manual submit both dropped pending tasks instead of carrying them forward
**Status:** 🟢 Fixed
**Severity:** High
**Area:** `store/slices/streak.slice.ts` (`submitDay`), `lib/engine/cutoff.ts`
**Root Cause:** Manual "Submit My Day" (`SubmitArea.tsx` → `submitDay`) never carried incomplete tasks forward — it only wrote a history entry. Because the overnight auto-logic skips any day already in `submittedDays`, a manually-submitted day's leftover tasks were never carried by either path.
**Fix Applied:** `submitDay` now carries forward incomplete tasks to the next day (respecting `blocked` no-penalty carry and `MAX_CARRY`), mirroring the existing overnight-logic carry behavior. Added `getNextDayKey` helper to `cutoff.ts`.

### FEAT-009 — Faster repeat loads via improved SW caching ("app-like feel")
**Status:** 🟢 Fixed
**Area:** `public/sw.js`
**Fix Applied:** Static assets now use stale-while-revalidate (serve cached copy instantly, refresh in the background) instead of network-first, since Next.js content-hashes build assets. Bumped cache name to `kunals-planner-v3`. Navigation requests remain network-first with offline fallback.

### BUG-020 — Rank milestone section: remove separate ℹ button, make card clickable
**Status:** 🟢 Fixed
**Area:** `features/dashboard/components/RankProgress.tsx`
**Fix Applied:** The whole card is now a `<button>` that opens the rank modal; the ℹ icon button was removed.

### BUG-021 — Streak stat card on dashboard should open the same detail view as the header streak icon
**Status:** 🟢 Fixed
**Area:** `features/dashboard/components/StatGrid.tsx`, `app/(tabs)/dashboard/page.tsx`
**Fix Applied:** Added `onStreakClick` prop to `StatGrid`; the Streak stat card is now a button wired to the same `StreakHistoryModal` the header 🔥 button opens.

### BUG-022 — System theme not applied on auth pages / theme reset on logout
**Status:** 🟢 Fixed
**Severity:** Medium
**Area:** `lib/theme.ts` (new), `ui/GlobalThemeApplier.tsx` (new), `ui/ThemeApplier.tsx`, `app/layout.tsx`
**Root Cause:** `ThemeApplier` was only mounted inside the tabs layout, so login/signup/reset-password pages never got `data-theme` applied. Separately, logout resets the whole store to `INITIAL_STATE`, which also reset `cfg.theme`.
**Fix Applied:** Theme choice is now mirrored to an unscoped `localStorage` key (`kp_theme`, outside the per-user store) via `lib/theme.ts`. A new `GlobalThemeApplier` mounted at the root layout applies it on every page including auth pages, and survives logout since it isn't part of the reset user state.

### BUG-023 — "Today's Focus" should lead, not follow, Day Progress on dashboard
**Status:** 🟢 Fixed
**Area:** `app/(tabs)/dashboard/page.tsx`
**Fix Applied:** Moved the Today's Focus card above the Day Progress card — the task to act on now leads the stats.

### FEAT-010 — Blocked tasks require a linked dependency task
**Status:** 🟢 Fixed
**Area:** `app/(tabs)/tasks/page.tsx`, `store/types.ts`, `store/slices/tasks.slice.ts`
**Fix Applied:** Added `blockedByTaskId`/`blockedByTitle` to `Task`. The 🚫 toggle (now available on any task, not just already-carried ones) opens `BlockTaskModal`, letting the user pick an existing open task as the blocker or create a new one to link (`addTask` now returns the created id). Unblocking clears the link directly.

### BUG-024 — Blocked tasks need a clearer visual highlight
**Status:** 🟢 Fixed
**Area:** `app/(tabs)/tasks/page.tsx` (`TaskRow`)
**Fix Applied:** Blocked tasks get a distinct red left-border/background treatment (separate from the amber "carried" style) and show "🚫 Blocked by: {title}" instead of the generic carry note.

### BUG-025 — Tasks page zone filter took up too much space
**Status:** 🟢 Fixed
**Area:** `app/(tabs)/tasks/page.tsx`
**Fix Applied:** Replaced the wrapping row of zone pill buttons with a single-line `<select>` dropdown.

### BUG-026 — Journal PIN / encryption screens anchored awkwardly near the top; Encrypt Journal toggle low-visibility
**Status:** 🟢 Fixed
**Area:** `ui/PinGate.tsx`, `app/(tabs)/journal/page.tsx`
**Fix Applied:** All PIN gate/setup/forgot-PIN screens and the journal encryption unlock/decrypting screens now vertically center within the viewport (`min-h-[70vh]` + `items-center`) instead of being pinned near the top. The "🔒 Encrypt Journal" toggle button was restyled with a green filled treatment for visibility.

---

## SESSION 5 — FRIENDS/CHALLENGES POLISH, GOALS, SYNC DEBUGGING

### BUG-027 — Friends listener `permission-denied` on first load
**Status:** 🟢 Fixed
**Severity:** High
**Area:** Firestore security rules / `lib/firebase/social.ts` listener setup
**Root Cause:** A Friends-related `onSnapshot` query was reading before the user's own auth token was fully attached to the request context, tripping the security rule's `request.auth` check.
**Fix Applied:** Listener setup sequenced to only attach after a confirmed signed-in uid is available (see `useSocialStore.init`, only called from `StoreBootstrap` once auth resolves).

### BUG-028 — Accepted challenge tasks never showed "Challenged by {name}"
**Status:** 🟢 Fixed
**Severity:** Medium
**Area:** `store/social/social.store.ts` (`acceptChallenge`), `store/slices/tasks.slice.ts` (`addChallengeTask`), `store/types.ts`
**Root Cause:** `addChallengeTask` never set the `challengedBy` field on the created task, and `acceptChallenge` never passed the challenger's name through to it — so the "Challenged by X" badge in `TaskRow` always read `undefined`.
**Fix Applied:** Added a third `challengedBy: string` param threaded through `addChallengeTask`'s signature and `acceptChallenge`'s call site (`challenge.ownerName`).

### BUG-029 — Tasks/streak not syncing between local and Netlify deploys
**Status:** 🟢 Fixed (config guidance + defensive code)
**Severity:** Critical
**Area:** `netlify.toml` / Netlify dashboard env vars (root cause), `features/auth/StoreBootstrap.tsx`, `lib/sync-status.ts`, `ui/SyncStatusBadge.tsx` (defensive fix)
**Root Cause:** `.env.local` (the real Firebase config) is gitignored and never reaches Netlify's build; `netlify.toml` has no `[build.environment]` block. With Firebase env vars unset, the Netlify build silently falls back to a legacy local-only auth path, so nothing ever reaches Firestore — no error shown anywhere.
**Fix Applied:** No code fix possible for the missing env vars themselves (user needs to set them in Netlify's dashboard + trigger a clean rebuild + check Firebase Authorized Domains). Added a `'disabled'` sync status (`setSyncStatus('disabled')` when `firebaseEnabled` is false) so a "No cloud sync ⚠" badge now appears in the nav bar instead of failing silently — this class of misconfiguration can never be silent again.

### BUG-030 — Desktop sync: tasks/streak missing but journal data comes through fine
**Status:** 🟢 Fixed
**Severity:** Critical
**Area:** `features/auth/StoreBootstrap.tsx`
**Root Cause:** `lastModified` is stamped on every local mutation across all slices, including journal edits (shared `stampedSet` wrapper in `store/index.ts`) — but journal itself never participates in the local-vs-cloud last-write-wins merge (it's always loaded fresh from its own Firestore subcollection, bypassing the merge entirely). So a device used mainly for journaling could end up with a `lastModified` that looks "newer" than another device's real task/streak sync, even though its local tasks/streak/history were empty — causing that emptiness to wrongly win the merge and overwrite real cloud data.
**Fix Applied:** Merge logic in `StoreBootstrap` now also checks whether local state "looks empty" (no tasks, no history, streak 0) while cloud has real content, and prefers cloud in that case regardless of which `lastModified` is technically newer.

### BUG-031 — Notification dropdown rendered behind page content
**Status:** 🟢 Fixed
**Severity:** Medium
**Area:** `ui/NotificationBell.tsx`, `app/globals.css` (`.nav-top`)
**Root Cause:** `.nav-top { overflow-x: auto; ... }` clips any absolutely-positioned descendant — the dropdown was a DOM descendant of that horizontally-scrolling nav container, so it got visually clipped/hidden behind the page below it. Not a z-index/stacking issue.
**Fix Applied:** Dropdown now renders via `createPortal` into `document.body` with `position: fixed`, computing its `{top, right}` from the bell button's `getBoundingClientRect()` on open — escapes the clipping ancestor entirely.

### BUG-032 — Notification bell icon (🔔 emoji) didn't match bottom-tab icon style
**Status:** 🟢 Fixed
**Severity:** Low
**Area:** `ui/NotificationBell.tsx`
**Fix Applied:** Replaced the emoji with a `BellIcon()` SVG matching the exact stroke style used by the bottom-tab icons in `app/(tabs)/layout.tsx` (`viewBox 0 0 24 24`, `stroke="currentColor"`, `strokeWidth 1.8`).

### FEAT-011 — Challenge tracker/history (who challenged what, accepted/declined/completed)
**Status:** 🟢 Fixed
**Area:** `lib/firebase/social.ts` (`listenSentChallenges`, `markChallengeCompletion`), `store/social/social.store.ts`, `features/friends/components/FriendsPageContent.tsx`
**Fix Applied:** New `sentChallenges` listener (keyed only on `ownerUid`, independent of the `friends` array) feeds a "Challenges you've sent" panel showing every challenge ever sent with a live status pill (Pending / Accepted — pending / Declined / Completed ✓). Completion is reported back automatically the instant the recipient toggles the derived task's `done` state — no polling.

### FEAT-012 — Notification bell (incoming requests, validations, challenges, approvals, resolutions)
**Status:** 🟢 Fixed
**Area:** `ui/NotificationBell.tsx` (new), `app/(tabs)/layout.tsx`
**Fix Applied:** Bell in the top nav aggregates incoming friend requests, validations-to-review, incoming challenges, approvals-to-review, plus "your thing was rejected/accepted/completed" notices, all driven by existing live Firestore listeners — no new polling. Unseen count badge persisted per-user in `localStorage`.

### FEAT-013 — WhatsApp share button for friend invites
**Status:** 🟢 Fixed
**Area:** `features/friends/components/FriendsPageContent.tsx`
**Fix Applied:** `wa.me/?text=` deep link with a prefilled invite message + the user's friend code — free, no WhatsApp Business API needed (same pattern as other apps' WhatsApp share buttons).

### FEAT-014 — Confirmation modal before removing a friend
**Status:** 🟢 Fixed
**Area:** `features/friends/components/FriendsPageContent.tsx` (`FriendRow`)
**Fix Applied:** Remove now opens a `<Modal>` confirmation instead of removing immediately.

### FEAT-015 — Fixed zone list for friend challenges (Health/Fitness/Finance/Personal/Other)
**Status:** 🟢 Fixed
**Area:** `constants/social.ts` (`CHALLENGE_ZONES`), `app/(tabs)/tasks/page.tsx` (`resolveZone`, `ChallengeModal`)
**Root Cause:** Zones are per-user custom lists — a challenger's zone id could be meaningless (or map to a totally different zone) on the recipient's account.
**Fix Applied:** Challenges always use a fixed, app-wide zone set instead of the challenger's personal zones; `resolveZone()` falls back through custom zones → `CHALLENGE_ZONES` → a generic gray pill so a zone id from either source always renders something sensible.

### FEAT-016 — Friends moved from its own nav tab into a Tasks-page mode
**Status:** 🟢 Fixed
**Area:** `app/(tabs)/tasks/page.tsx`, `app/(tabs)/layout.tsx`, `app/(tabs)/friends/page.tsx`
**Fix Applied:** Friends is now a third mode on the Tasks page (alongside Today's Tasks / Recurring Templates), reached via `?mode=friends`. The old `/friends` route now just redirects there for backward-compat with old links/the notification bell.

### BUG-033 — "createdAt.localeCompare is not a function" crash reloading Friends
**Status:** 🟢 Fixed
**Severity:** Critical (crashes the whole Tasks/Friends page)
**Area:** `lib/firebase/social.ts` (all `listen*` functions), `features/friends/components/FriendsPageContent.tsx`, `ui/NotificationBell.tsx`
**Root Cause:** Every doc written by this file (`FriendRequest`, `RewardApproval`, `TaskValidation`, `SharedTask`) sets `createdAt`/`resolvedAt` via `serverTimestamp()` at write time — overwriting the plain ISO string built locally right before the write. Firestore returns those fields as `Timestamp` objects on read, not strings, even though every type here declares them `string`. That mismatch was invisible until code actually called a string method on the field — which the "Challenges you've sent" sort in `FriendsPageContent.tsx` (`b.createdAt.localeCompare(a.createdAt)`) does, and only once there were 2+ sent challenges to actually invoke the sort comparator. A pending, not-yet-acked write can also briefly report `createdAt` as `null`.
**Fix Applied:** Added `normalizeTimestamps()` in `lib/firebase/social.ts`, applied at every `onSnapshot` doc-mapping site (8 listener functions), converting `Timestamp` → ISO string (and coalescing `null`/pending values to a safe default) before the data ever reaches app state. Also hardened the two call sites that were sorting on these fields (`FriendsPageContent`'s sent-challenges sort, `NotificationBell`'s notification sort) to tolerate a non-string value defensively, in case any other doc shape slips through in the future.

### FEAT-017 — Weekly/monthly goals made of multiple tasks; goal-type friend challenges with an end date
**Status:** 🟢 Fixed
**Area:** `store/types.ts`, `store/slices/goals.slice.ts`, `lib/engine/goals.ts`, `app/(tabs)/settings/page.tsx`, `features/dashboard/components/GoalsCard.tsx`, `store/social/types.ts`, `lib/firebase/social.ts`, `store/social/social.store.ts`, `app/(tabs)/tasks/page.tsx`, `features/friends/components/FriendsPageContent.tsx`
**Fix Applied:** Added a `'checklist'` goal type — a goal made of multiple named sub-tasks with per-item checkboxes, `target` auto-synced to checklist length. Friend challenges can now be sent as a "Goal (multiple tasks)" with an end date capped at today + 2 months; accepting one creates a checklist Goal (not a single Task) on the recipient's own Goals list, tagged with who challenged them.

---

## SESSION 6 — REST-DAY PRECEDENCE, XP CLEANUP, PERFORMANCE

### BUG-034 — Production build broken by a dangling `t.flag` reference in the tab list
**Status:** 🟢 Fixed
**Severity:** Critical (fails `next build` → Netlify deploy)
**Area:** `app/(tabs)/layout.tsx`
**Root Cause:** When Friends moved from a standalone tab into a Tasks-page mode (FEAT-016), the one `ALL_TABS` entry that carried a `flag` field was removed, but the `ALL_TABS.filter(t => t.flag === undefined || t.flag)` line kept referencing `t.flag` — now a property that doesn't exist on the inferred element type, a TS2339 error. Dev mode (Turbopack) ignores type errors so it never surfaced in use, but `next build` runs `tsc` and would fail. It went unnoticed because the earlier verify-sandbox copy of this file was stale.
**Fix Applied:** Dropped the now-meaningless filter — `TABS` is just the six-entry array, since no tab is feature-flagged anymore.

### FEAT-018 — Rest day now takes precedence over losing the streak
**Status:** 🟢 Fixed
**Area:** `lib/engine/streak.ts` (`runOvernightLogic`)
**Change:** On any incomplete day where there's a live streak, the overnight pass now always auto-applies a Rest Day (streak held, not incremented) instead of ever spending a freeze or breaking the streak. The once-per-week rest cap no longer gates this — a rest day always wins over a break. With the streak already at 0 the day is still just recorded as a plain miss (nothing to protect).

### FEAT-019 — Removed Buffer XP + Freeze dashboard boxes; overflow folds into Rank XP
**Status:** 🟢 Fixed
**Area:** `app/(tabs)/dashboard/page.tsx`, `store/slices/streak.slice.ts`, `lib/engine/streak.ts`
**Change:** Deleted the two "Power row" cards (Buffer XP / Freezes) and their confirmation modals from the dashboard — the streak count already lives next to the 🔥 header. Points earned beyond the daily minimum (previously banked as a separate, manually-spent buffer) now go straight into Rank XP at the same 2:1 ratio, in both manual submit (`submitDay`) and overnight auto-submit. Freezes are still earned/bought and usable from Rewards + the streak-history modal.

### FEAT-020 — Confirmation before saving a journal entry
**Status:** 🟢 Fixed
**Area:** `app/(tabs)/journal/page.tsx`
**Change:** The Save/Update button now opens a confirmation modal; the entry is only written after the user confirms, so an accidental tap can't post an entry.

### PERF-001 — Tab click/swipe felt slow even though the app was fast
**Status:** 🟢 Fixed
**Severity:** High (UX)
**Area:** `ui/ClickFeedback.tsx` (unwired), `app/layout.tsx`, `app/(tabs)/layout.tsx`, `hooks/useOvernightCheck.ts`
**Root Cause (analysis):** The app wasn't actually slow — three things made it *look* slow.
  1. `ClickFeedback` dimmed the whole screen with a spinner overlay on any tap that didn't resolve within 100ms. Every tab switch (route change + animation) trips that window, so navigation always flashed a fake "loading" overlay.
  2. Tab buttons use `router.push`, not `<Link>`, so Next.js never prefetched the tab routes — each first click fetched its route cold.
  3. A nav loading-bar + slide animation stacked on top of the overlay.
  Separately, `useOvernightCheck` (which lives in the always-mounted AppShell) subscribed to the *entire* store via `usePlannerStore()`, re-rendering the shell on every single mutation (every task toggle, keystroke, etc).
**Fix Applied:** Removed `ClickFeedback` from the tree and the nav loading-bar. Prefetch every tab route on mount (`router.prefetch`) so navigation is warm/instant. Rewrote `useOvernightCheck` to read the store via `getState()` instead of subscribing, eliminating the whole-shell re-render on every mutation (also reordered rank-decay vs. the overnight pass so the new overflow-into-rankXP fold doesn't clobber the decay).

### BUG-035 — `permission-denied` Firestore error storm when Firebase Auth isn't ready
**Status:** 🟢 Fixed
**Severity:** High (console error storm; misleading, and could mask real errors)
**Area:** `features/auth/StoreBootstrap.tsx`, `store/social/social.store.ts`
**Root Cause:** `waitForAuth()` returns `false` when the app's own session cookie (`kp_uid`) exists but the Firebase client's auth session isn't restored (`currentUser === null`) — e.g. a fresh browser/device where the Firebase session never persisted. The bootstrap correctly *skipped the cloud load* in that case, but then still called `initSync()` and `useSocialStore.init()` unconditionally (they were only gated on `firebaseEnabled`, not on auth readiness). Those attach `onSnapshot` listeners, and Firestore's security rules require `request.auth`, so every listener immediately failed with `permission-denied` — a wall of console errors plus a `[sync] auth not ready` warning.
**Fix Applied:** Hoisted the `authReady` result in `StoreBootstrap` and gated the initial cloud push, `initSync()`, and the Friends `init()` all on `firebaseEnabled && authReady`. When auth isn't ready the app runs local-only and the sync badge shows "No cloud sync ⚠". Added a defensive guard inside `useSocialStore.init()` that no-ops if `getClientAuth().currentUser` is null, so the listeners can never attach pre-auth even if called from elsewhere.

### FEAT-021 — Confirm rest day / freeze never increment the streak
**Status:** 🟢 Verified + locked with tests
**Area:** `store/slices/streak.slice.ts` (`useFreeze`, `declareRestDay`), `lib/engine/streak.ts` (overnight rest branch)
**Finding:** The streak is only ever incremented on a genuinely completed day (`submitDay` and the overnight auto-submit when `earned >= minPts`). Using a freeze, taking a rest day, and the overnight rest-day auto-protection all hold the streak unchanged (never +1), and the dashboard/StatGrid read `streak` directly rather than deriving it from history. Added explicit `expect(streak).toBe(unchanged)` assertions to the `useFreeze` and `declareRestDay` tests so this can't regress.

---

## SESSION 7 — SYNC DIVERGENCE, TASK TILE OVERHAUL, TIME-BOUND TASKS, ERROR RESILIENCE

### BUG-036 — Desktop/Netlify shows no tasks/streak while journal syncs and mobile has everything
**Status:** 🟢 Fixed
**Severity:** Critical (data appears "lost" on a device)
**Area:** `features/auth/StoreBootstrap.tsx`, `lib/firebase/firestore.ts` (architecture)
**Root Cause (analysis):** The app syncs two different ways. Journal entries go to a **per-entry subcollection** (`users/{uid}/journal/{dateKey}`) — many small, independent writes. The entire planner state (tasks, streak, history, XP) rides in **one document** (`users/{uid}/planner/state`) written whole. On load, journal is ALWAYS applied fresh from its subcollection, so it looks perfect on every device. Tasks/streak come from the single planner doc via a local-vs-cloud merge. If that one document ever fell behind on the device holding the real data — a transient write error, an auth-timing gap, or (the real gap here) because the only "push local to cloud" path fired **exclusively when the cloud doc was entirely absent** — the cloud planner doc stayed stale/empty. Result: mobile (which created the data) shows its rich *local* copy, its journal subcollection is fully synced, but the planner doc never received streak 7 + history — so desktop/Netlify load an empty planner doc (journal still fine). Firestore rules were verified to allow planner writes, and journal loading proves auth works on desktop, which is what isolated the cause to the planner doc itself being behind.
**Fix Applied:** Turned the one-time push into a **cloud-heal**: on every load, if THIS device won the local-vs-cloud merge (its data is at least as new as cloud, or cloud was absent) AND it has content, re-upload the planner state so the cloud doc catches up — not only when the cloud doc is missing. The device holding streak 7 now heals the cloud, and the empty desktop converges on its next load. Guarded by the same `preferCloud` flag so a genuinely-behind device never clobbers newer cloud data. (Combined with the Session-6 auth-ready gating, this closes the divergence.)

### FEAT-022 — Goals moved off the dashboard into a Goals tab on the Tasks page
**Status:** 🟢 Done
**Area:** `app/(tabs)/dashboard/page.tsx`, `app/(tabs)/tasks/page.tsx`
**Change:** Removed the GoalsCard from the dashboard. Added a "Goals" mode to the Tasks page tab strip, positioned before "Friends" (Today's Tasks / Recurring / Goals / Friends), deep-linkable via `?mode=goals`.

### FEAT-023 — Time-bound tasks: end time, half points if late, live countdown
**Status:** 🟢 Done
**Area:** `lib/engine/scoring.ts`, `app/(tabs)/tasks/page.tsx`
**Change:** A task's deadline (a `datetime-local`, so date + end time) now makes it "time-bound." Scoring simplified: completing after the deadline earns a flat **half** points (replaced the old 0.7/0.4 within-1hr/over-1hr tiers). The tile shows a minimal countdown pill ("2h 15m left", turning to "Overdue · ½ pts" once it passes) that ticks each minute, and an overdue-but-unfinished task shows its halved potential ("+10 ½") in red. Kept deliberately compact so the tile isn't cluttered.

### FEAT-024 — Task tile restructure: edit/delete top-right, diagonal pencil, block-in-edit
**Status:** 🟢 Done
**Area:** `app/(tabs)/tasks/page.tsx`
**Change:** Edit and delete now sit at the top-right of each tile. The edit icon is a diagonal pencil SVG (was a horizontal ✏ glyph). The "Block task" action moved off the tile into the Edit modal — Edit → "🚫 Block this task" opens the dependency-picker modal (and shows an Unblock control when already blocked). Focus-star stays in the tile footer next to the points.

### FEAT-025 — Input length limits with inline red validation
**Status:** 🟢 Done
**Area:** `app/(tabs)/tasks/page.tsx` (task name ≤ 30, note ≤ 100), `app/(tabs)/settings/page.tsx` (zone ≤ 15)
**Change:** New shared `LimitedField` renders a red border + "Max length N" message below the field when exceeded, and disables Add/Save until fixed — applied to the add-task form, the edit-task modal, and the zone creator.

### BUG-037 — Long task name/note overflowed the tile and the page
**Status:** 🟢 Fixed
**Area:** `app/(tabs)/tasks/page.tsx` (`TaskRow`)
**Root Cause:** Title/note used non-wrapping flex children with no min-width constraint, so a long unbroken string pushed past the tile and off the page.
**Fix Applied:** Content column is now `min-w-0` with `break-words [overflow-wrap:anywhere]` on the title, note, and blocked-by text, so long strings wrap inside the tile.

### FEAT-026 — Submit My Day button at the bottom of the Tasks page
**Status:** 🟢 Done
**Area:** `app/(tabs)/tasks/page.tsx`
**Change:** The SubmitArea now also renders at the very bottom of the Tasks list (normal mode).

### BUG-038 — ChunkLoadError on the Tasks tab; error screens that didn't recover on retry
**Status:** 🟢 Fixed
**Severity:** High (user stuck on an error screen)
**Area:** `ui/RouteErrorFallback.tsx` (new), all seven `app/(tabs)/*/error.tsx`, `app/global-error.tsx`
**Root Cause:** A stale JS bundle (ChunkLoadError — common in dev after a Turbopack recompile, and possible right after a deploy) can't be fixed by Next's `reset()` (it just re-renders the same broken chunk), so the per-route error screens looped on "Try again." 
**Fix Applied:** New shared `RouteErrorFallback` used by every route error boundary: it detects the various chunk-error shapes and **auto-reloads once** (guarded by a `sessionStorage` stamp so a genuinely broken build can't loop), and offers both "Try again" (`reset()`) and a "Reload app" hard-reload so the user always has a way out. `global-error.tsx` got the same loop-guarded auto-reload. Net effect: users don't get stranded on an error screen — a retry (or the automatic reload) recovers.

---

## PRODUCTION GAPS (Not bugs, but blockers for prod)

### PROD-001 — Firestore security rules not set
**Status:** 🔴 Open  
**Severity:** Critical for production  
**Description:** Currently any authenticated Firebase user can read/write any other user's Firestore document. Security rules needed: `allow read, write: if request.auth.uid == userId`  
**Effort:** Config-only (Firebase Console). Claude writes the rules, you paste them.

---

### PROD-002 — No rate limiting on `/api/auth/session`
**Status:** 🔴 Open  
**Severity:** High for production  
**Description:** The session exchange endpoint has no brute-force protection. Firebase itself rate-limits auth attempts but the custom session route does not.

---

### PROD-003 — No account deletion flow
**Status:** 🔴 Open  
**Severity:** High (GDPR requirement)  
**Description:** Users have no way to delete their account + data. Required for any app with real users in EU/UK.

---

### PROD-004 — Export data not implemented
**Status:** 🔴 Open  
**Severity:** Medium  
**Description:** `autoExportEnabled` flag exists in `AppConfig` but no export UI or API exists.

---

### PROD-005 — PWA Service Worker missing
**Status:** 🔴 Open  
**Severity:** Medium  
**Description:** `manifest.ts` exists. No Service Worker → "Add to home screen" doesn't work offline.

---

## FIXED BUGS ARCHIVE

| ID | Bug | Fixed In Session | Verified |
|----|-----|-----------------|---------|
| BUG-001 | Login isolation (window.location.href) | Session 2 | ✅ |
| BUG-002 | Carry-forward gap=1 | Session 2 | ✅ |
| BUG-003 | Streak icon wrong for weekends | Session 2 | ✅ |
| BUG-004 | ChunkLoadError recovery | Session 2 | ✅ |
| BUG-005 | RetroFix hardcoded 12pm cutoff → cfg.cutoffHour | Session 3 | ✅ |
| BUG-006 | submitRetroFix missing submittedDays update | Session 3 | ✅ |
| BUG-007 | Journal delete confirm — already working | Session 3 (N/C) | ✅ |
| BUG-008 | Journal wallet credit — already working | Session 3 (N/C) | ✅ |
| BUG-009 | Auto-submit carry-forward — covered by BUG-002 | Session 3 (N/C) | ✅ |
| BUG-011 | Route-level error.tsx for all 6 tabs | Session 3 | ✅ |
| BUG-012 | Sync status badge (Saving/Saved/Offline) | Session 3 | ✅ |
| BUG-013 | Session expiry silent redirect | Session 3 | ✅ |
| BUG-014 | OS dark mode preference on first load | Session 3 | ✅ |
| — | Date format "Sat, 13 Jun 2026" everywhere | Session 2 | ✅ |
| — | Streak history day abbreviation (Mon/Tue…) | Session 2 | ✅ |
| BUG-027 | Friends listener permission-denied on first load | Session 5 | ✅ |
| BUG-028 | challengedBy not set on accepted challenge tasks | Session 5 | ✅ |
| BUG-029 | Local/Netlify sync — missing Firebase env vars (silent fallback) | Session 5 | ✅ |
| BUG-030 | Desktop sync — journal edits corrupting lastModified merge | Session 5 | ✅ |
| BUG-031 | Notification dropdown clipped behind page content | Session 5 | ✅ |
| BUG-032 | Notification bell icon mismatched bottom-tab style | Session 5 | ✅ |
| BUG-033 | createdAt.localeCompare crash — Firestore Timestamp not normalized to string | Session 5 | ✅ |
| BUG-034 | Prod build broken by dangling t.flag reference in tab list | Session 6 | ✅ |
| BUG-035 | permission-denied storm — Firestore listeners attached before auth ready | Session 6 | ✅ |
| BUG-036 | Desktop/Netlify tasks+streak missing — stale planner doc, cloud-heal push | Session 7 | ✅ |
| BUG-037 | Long task name/note overflowed the tile/page — now wraps | Session 7 | ✅ |
| BUG-038 | ChunkLoadError / non-recovering error screens — shared auto-reload fallback | Session 7 | ✅ |

---

## FEATURE REQUESTS (post-bug-fix)

| ID | Feature | Priority |
|----|---------|---------|
| FEAT-001 | Skeleton loading states instead of "Loading…" | Medium |
| FEAT-002 | Sync status badge ("Saved ✓ / Saving… / Offline") | High |
| FEAT-003 | Account deletion + data wipe | High (GDPR) |
| FEAT-004 | JSON data export | Medium |
| FEAT-005 | PWA offline support | Medium |
| FEAT-006 | OS dark mode preference detection | Low |
| FEAT-007 | Changelog visible in Settings | Low |
| FEAT-008 | Push notifications | Low |

---

## APPROVAL WORKFLOW (how Claude will use this file)

When a bug fix session starts, Claude will:
1. Read this file and identify the next 🔴 Open bug
2. State: _"Ready to fix BUG-XXX — [name]. Here's my proposed logic: [explanation]. Do you approve this approach?"_
3. Wait for explicit approval ("yes" / "proceed" / "go ahead")
4. Implement, test, update this file's status to 🟢
5. Move to the next bug

If the user wants to override priority, just say "skip to BUG-XXX" or "fix PROD-001 first."

---

_Last updated: 2026-07-21 | Session 7 — BUG-036 through BUG-038, FEAT-022 through FEAT-026 resolved | By: Claude_
