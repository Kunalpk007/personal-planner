# Claude Chrome Extension — App Test Script

> **How to use:** Open Claude.ai in Chrome with the Claude extension.
> Paste the entire block below into the chat and send it.
> Claude will test the running app at http://localhost:3000 and return a full report.

---

## PASTE THIS INTO CLAUDE CHROME EXTENSION:

```
You are a senior QA Engineer doing a production-readiness audit of a personal productivity app called "Kunal's Planner" running at http://localhost:3000.

Open the app and systematically test every area listed below. For each test ID report: ✅ PASS, ❌ FAIL, or ⚠️ PARTIAL with a specific reason. At the end, give an overall rating X/10 and a prioritised fix list.

══════════════════════════════════════════════
AUTH FLOW
══════════════════════════════════════════════
[AUTH-01] Sign up with a brand-new email → lands on /dashboard ✅
[AUTH-02] Sign out → page does a FULL reload (not client navigation) — check Network tab, should see full document request
[AUTH-03] Sign in with wrong password → error message appears, form stays visible
[AUTH-04] Sign in as User A (note XP) → sign out → sign in as User B (new account) → User B sees 0 XP, 0 streak — NOT User A's data
[AUTH-05] Sign in as User B → sign out → sign back in as User A → User A's original XP is restored
[AUTH-06] Open incognito tab → go to /dashboard → redirected to /login
[AUTH-07] Session expiry: manually delete kp_session cookie (DevTools → Application → Cookies) → refresh → redirected to /login with amber "Your session expired" banner
[AUTH-08] Google sign-in button visible on login page (only if Firebase configured) → clicking opens Google popup

══════════════════════════════════════════════
DASHBOARD
══════════════════════════════════════════════
[DASH-01] Today's date shown as "Sat, 14 Jun 2026" format (day abbr + date + month abbr + year)
[DASH-02] Streak counter visible with 🔥 icon behind the number
[DASH-03] Clicking the 🔥 streak button opens the Streak History modal
[DASH-04] Streak History modal shows last 28 days with correct icons per day (✅ full, 🌤 easy weekend, ❌ break, ❄ freeze, 🟡 rest)
[DASH-05] Day progress bar at 0% with no tasks; increases as tasks are completed
[DASH-06] Manager message visible; tone changes at different completion percentages (check 0%, 50%, 100%)
[DASH-07] RetroFix banner: appears before the daily cutoff hour if yesterday has incomplete tasks
[DASH-08] RetroFix banner: HIDES immediately after clicking "Submit Changes" (does not re-appear)
[DASH-09] Buffer XP card — "Use" button disabled when buffer = 0
[DASH-10] Streak Freeze card — "Use" button disabled when freezeTokens = 0

══════════════════════════════════════════════
TASKS
══════════════════════════════════════════════
[TASK-01] Add a High priority task → appears in today's task list
[TASK-02] Complete a High task (20pts) → RankXP increases by 20, wallet increases by 10
[TASK-03] Un-complete the same task → RankXP and wallet decrease back to original
[TASK-04] Add a task for today, don't complete it, check tomorrow (or advance date) → task appears with carry penalty label (-2 pts per day carried)
[TASK-05] Add recurring task → appears every day without duplicating
[TASK-06] Add subtask to a task → complete the subtask → parent task tracks completion
[TASK-07] Special task with custom points (e.g. 50 pts) → 50 pts awarded on completion

══════════════════════════════════════════════
SCORING ACCURACY
══════════════════════════════════════════════
[SCORE-01] High task (20pts) + Motivated mood (1.2x) = 24 RXP for the day — verify stat grid
[SCORE-02] Open DevTools console, run: usePlannerStore.getState().tasks — find a carried task, confirm calcPts() returns base - (carriedDays * 2)
[SCORE-03] Wallet pts: completing 20pt task adds 10 to wallet (20 / WALLET_RATIO=2 = 10)
[SCORE-04] Weekend submission: earning only weekendPts (default 20) but < minPts (default 70) → streak history shows 🌤 not ❌

══════════════════════════════════════════════
JOURNAL
══════════════════════════════════════════════
[JOUR-01] Write first entry of the day → toast shows "+5 Rank XP + 2 wallet pts for journaling!" → XP and wallet actually increase
[JOUR-02] Write second entry same day → no XP toast (isFirst guard working)
[JOUR-03] Edit an existing entry → "Entry updated." toast → no XP change
[JOUR-04] Delete entry → confirmation modal appears → "Cancel" keeps the entry → "Delete" removes it
[JOUR-05] Past entries tab → entries grouped by day → day label in "Sat, DD Mon YYYY" format
[JOUR-06] Journal PIN: set a 5-digit PIN → sign out and back in → PIN gate appears before journal content

══════════════════════════════════════════════
REWARDS
══════════════════════════════════════════════
[REW-01] Wallet balance shown and increases when tasks are completed
[REW-02] Redeem a reward → wallet balance decreases by reward cost → reward appears in today's redeemed list
[REW-03] Attempt to redeem when wallet < cost → error shown, balance unchanged
[REW-04] Add custom reward → appears in list immediately
[REW-05] Delete a reward → removed from list with no side effects

══════════════════════════════════════════════
HISTORY
══════════════════════════════════════════════
[HIST-01] Submitted days appear in reverse chronological order
[HIST-02] Date shown in "Sat, DD Mon YYYY" format in every history row
[HIST-03] Expanding a day shows task list with ✓ (done) and ✗ (not done) icons
[HIST-04] "Auto" badge in amber on auto-submitted days
[HIST-05] "Late" badge in red on late-submitted days
[HIST-06] Rewards redeemed that day appear when expanding a history row

══════════════════════════════════════════════
SETTINGS
══════════════════════════════════════════════
[SET-01] Change daily target (minPts) → dashboard progress bar recalculates immediately
[SET-02] Change weekend pts → reflected in streak calculation
[SET-03] Change manager name → dashboard manager section shows new name instantly
[SET-04] Switch theme Dark → Light → System → app re-themes instantly without reload
[SET-05] Theme "System" → matches OS dark/light mode; changes automatically when OS switches

══════════════════════════════════════════════
ERROR HANDLING
══════════════════════════════════════════════
[ERR-01] Each tab (Dashboard, Tasks, Journal, Rewards, History, Settings) has its own error.tsx — verify by checking files exist at app/(tabs)/*/error.tsx
[ERR-02] "Try again" button in error boundary resets the tab without full page reload
[ERR-03] Global error boundary auto-reloads on ChunkLoadError (check app/global-error.tsx)
[ERR-04] Navigate to /dashboard while logged out → redirected to /login?from=/dashboard

══════════════════════════════════════════════
DATA PERSISTENCE & SYNC
══════════════════════════════════════════════
[PERS-01] Add tasks → earn XP → hard refresh (Ctrl+Shift+R) → all data persists
[PERS-02] Open DevTools → Application → Local Storage → data at key "kunals_planner_v2:{uid}" (scoped, NOT bare key)
[PERS-03] If Firebase configured: nav bar shows "Saving…" then "Saved ✓" after ~5 seconds of activity
[PERS-04] If Firebase configured: go offline (DevTools → Network → Offline) → app still works from localStorage → nav bar shows "Offline ⚠"
[PERS-05] Sign out → localStorage key for previous user is preserved (not wiped) — next sign-in restores their data

══════════════════════════════════════════════
SECURITY SPOT-CHECK
══════════════════════════════════════════════
[SEC-01] DevTools → Application → Cookies → kp_session cookie should NOT be readable by JS (httpOnly flag set)
[SEC-02] DevTools → Application → Cookies → kp_uid cookie IS readable by JS (needed for localStorage scoping)
[SEC-03] POST to /api/auth/session without a valid Firebase ID token → returns 400/401
[SEC-04] DevTools → Network → inspect JS bundles → FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must NOT appear in any bundle (server-only)
[SEC-05] No plaintext passwords, JWTs or session tokens visible in localStorage

══════════════════════════════════════════════
MOBILE / RESPONSIVE
══════════════════════════════════════════════
[MOB-01] Resize browser to 375px wide → bottom navigation bar appears, top desktop nav hides
[MOB-02] No horizontal scroll at 375px viewport width
[MOB-03] All buttons and inputs are touch-friendly (min 44px tap target)
[MOB-04] Cards and text remain readable at 375px (no overflow, no truncation of critical info)

══════════════════════════════════════════════

After running all tests, provide:

**1. FULL RESULTS TABLE** — one row per test ID with ✅/❌/⚠️ and reason for non-pass.

**2. CRITICAL FAILURES** — any ❌ that blocks core user flows (auth, data, scoring).

**3. CURRENT RATING** — score out of 10 with breakdown:
   - Auth & Isolation: /2
   - Core Features (tasks/journal/rewards): /2
   - Data Integrity (scoring/persist): /2
   - Error Handling & UX polish: /2
   - Security & Production readiness: /2

**4. WHAT'S NEEDED FOR 10/10** — specific missing items preventing a perfect score.

**5. NEXT 5 FIXES** — prioritised list of the most impactful things to fix next, with file names.
```

---

## How to Interpret Results

| Rating | Meaning |
|--------|---------|
| 9–10/10 | Production ready — ship it |
| 7–8/10 | Launch-ready with minor issues — fix within a week |
| 5–6/10 | Core works but gaps in error handling / security |
| < 5/10 | Critical bugs blocking real user use |

---

## Suggested Test Accounts

For AUTH-04 and AUTH-05 (isolation tests), use:
- **User A**: `test-a@example.com` / `TestPass123!`
- **User B**: `test-b@example.com` / `TestPass123!`

Sign up both before running isolation tests.

---

_Last updated: 2026-06-17_
