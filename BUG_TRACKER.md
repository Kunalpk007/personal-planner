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

_Last updated: 2026-06-17 | Session 3 — BUG-005 through BUG-014 resolved | By: Claude_
