# Developer Guide — Kunal's Planner

## Table of Contents
1. [Quick Start](#quick-start)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Auth & Session Flow](#auth--session-flow)
5. [Store Architecture](#store-architecture)
6. [Data Flow: Login → Dashboard](#data-flow-login--dashboard)
7. [Scoring Engine](#scoring-engine)
8. [Overnight Logic](#overnight-logic)
9. [All AppConfig Settings](#all-appconfig-settings)
10. [Cookies Reference](#cookies-reference)
11. [Firebase Setup](#firebase-setup)
12. [Environment Variables](#environment-variables)
13. [Running Locally](#running-locally)
14. [Testing](#testing)
15. [Coding Conventions](#coding-conventions)
16. [Key Invariants](#key-invariants)

---

## Quick Start

```bash
npm install
cp .env.local.example .env.local   # fill in SESSION_SECRET at minimum
npm run dev                         # http://localhost:3000
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router (`app/`) |
| UI | React 19, Tailwind CSS 4 |
| State | Zustand 5 with `persist` middleware |
| Auth | Custom JWT via `jose` (HS256, 7-day sessions) |
| Passwords | Argon2id via `@node-rs/argon2` |
| Database | Firebase Firestore (optional; falls back to localStorage) |
| Testing | Vitest 4 + `@vitest/coverage-v8` |
| E2E | Playwright |
| Build | `next build --webpack` (Turbopack disabled for compatibility) |

**Read `node_modules/next/dist/docs/` before touching routing or middleware.** Next.js 16 has breaking changes from prior major versions.

---

## Project Structure

```
app/                     Next.js App Router pages
  (tabs)/                Authenticated tab layout
    layout.tsx           StoreBootstrap + nav shell
    dashboard/page.tsx   Main daily view
    tasks/page.tsx       Task list
    journal/page.tsx     Journal entries
    rewards/page.tsx     Reward wallet redemption
    history/page.tsx     Streak + history calendar
    settings/page.tsx    AppConfig editor
  login/page.tsx
  signup/page.tsx
  reset-password/page.tsx
  actions/auth.ts        Server Actions: login, signup, logout, reset
  api/auth/              Route handlers (signout, session)
  proxy.ts               Route protection (NOT middleware.ts — see below)

store/
  index.ts               Zustand store (persist + recoveringStorage)
  types.ts               All domain types (Task, HistoryEntry, AppState…)
  defaults.ts            INITIAL_STATE + DEFAULT_CFG
  userScope.ts           uid namespace for localStorage keys
  slices/
    tasks.slice.ts       addTask, toggleTask, submitRetroFix, carry-forward…
    streak.slice.ts      pauseStreak, restoreStreak, checkPausedExpiry…
    rewards.slice.ts     redeemReward, addZone, removeZone…
    journal.slice.ts     saveJournalEntry, deleteJournalEntry, PIN…
    config.slice.ts      setConfig, setMood, setEodMood, setPinnedTask…
    ui.slice.ts          applyOvernightPatch, logChange, engagement…

lib/
  auth/
    session.ts           JWT encrypt/decrypt, createSession, deleteSession
    users.ts             Firestore user CRUD (findUserByEmail, createUser…)
    password.ts          hashPassword / verifyPassword (Argon2id)
  firebase/
    admin.ts             Firebase Admin SDK (server-side only)
    client.ts            Firebase Client SDK (browser)
    firestore.ts         loadFromFirestore / saveToFirestore
  engine/
    scoring.ts           basePts, calcPts, todayEarned, getMinPts…
    streak.ts            runOvernightLogic, checkStreakMilestone, snapshotTasks
    manager.ts           Coaching message generator
    quotes.ts            Morning/evening quote picker
    cutoff.ts            Day cutoff logic (cutoffHour config)
    decay.ts             Rank XP daily decay
  crypto/
    pin.ts               sha256 (journal PIN hashing)
  persistence/
    export.ts            JSON export helper
    migrate.ts           State migration between schema versions
    fsBackup.ts          Optional filesystem backup

features/
  auth/StoreBootstrap.tsx   Data hydration sequencer (see Data Flow below)
  dashboard/               Dashboard-specific components (StreakHistoryModal…)

constants/
  points.ts               PRIORITY_PTS, WALLET_RATIO, JOURNAL_XP, MAX_CARRY…

data/
  defaults.json           Seed data: zones, rewards, ranks, freezeSchedule, cfg

tests/
  unit/                   Pure function tests (scoring, streak, quotes…)
  store/                  Zustand slice tests
  setup/localStorage.ts   vitest localStorage mock
```

---

## Auth & Session Flow

### Route Protection

Protection is in `app/proxy.ts`, **not** `middleware.ts`. Next.js 16 changed how
edge middleware works; this project moved protection into a server-side proxy module
imported by protected layout files.

### Three Cookies

All three cookies are set together in `lib/auth/session.ts:createSession()`:

| Cookie | httpOnly | Purpose |
|---|---|---|
| `kp_session` | Yes | JWT (HS256, 7 days). The real auth token — JS cannot read it. |
| `kp_uid` | No | User ID. JS-readable. Used to namespace `localStorage` keys per user. |
| `kp_display` | No | URL-encoded display name (derived from email). UI reads this to show "X's Planner". |

`kp_display` is derived automatically: `kunalpk007@gmail.com` → `"Kunal"`. The logic
strips digits, splits on `.` and `_`, and title-cases each word.

---

## Store Architecture

### Zustand Persist + User Scoping

All state lives in a single Zustand store (`store/index.ts`) with `persist` middleware
that writes to `localStorage["kunals_planner_v2:{uid}"]`.

The uid namespace prevents two users on the same browser from seeing each other's data.

**Critical: `store/userScope.ts` initialises `_userId` synchronously at module import time**
by reading `kp_uid` from `document.cookie`. This is required because Zustand's
auto-rehydration fires during the first import of `store/index.ts` — before any
`useEffect` can run. If `_userId` is null at that moment, rehydration reads from the
wrong `__anon__` key and the user sees empty data.

```
Module import order:
  store/index.ts imported
    → store/userScope.ts evaluated
      → readUidFromCookieSync() runs immediately
      → _userId = "<uid from cookie>"   ← must be set before next line
    → Zustand persist rehydrates from localStorage["kunals_planner_v2:{uid}"]  ✓
```

### Recovering Storage

The custom `recoveringStorage` adapter in `store/index.ts` adds write-behind backup:
before every write it copies the previous value to `{key}_backup`. Reads fall back to
the backup if the primary key is corrupt or missing.

### Slices

State is split into six slices merged at store creation:
- `tasks.slice.ts` — tasks, recurring, submitDay, submitRetroFix, carry-forward
- `streak.slice.ts` — streak, bestStreak, freeze tokens, pause/restore
- `rewards.slice.ts` — rewardWallet, redemptions, zones, reward catalogue
- `journal.slice.ts` — journal entries, PIN, lockout
- `config.slice.ts` — cfg (AppConfig), mood, eodMood, pinnedTaskId
- `ui.slice.ts` — overnightMsg, changeLog, engagement, morningQuote, XP decay

Slices receive `(set, get, api)` and return plain action objects merged into the store.

---

## Data Flow: Login → Dashboard

```
1. User submits login form
   → loginAction (Server Action) verifies password via Argon2id
   → createSession() sets kp_session + kp_uid + kp_display cookies
   → redirect('/dashboard')

2. Browser navigates to /dashboard
   → app/(tabs)/layout.tsx renders TabsLayout
   → TabsLayout renders <StoreBootstrap onReady={...} />
   → storeReady = false → shows "Loading…" spinner

3. StoreBootstrap.useEffect runs (client-side only)
   a. Reads kp_uid cookie → uid
   b. ensureScopedKey(uid): copies legacy/backup data to scoped key if needed
   c. setUserScope(uid): updates _userId in userScope.ts
   d. If NEXT_PUBLIC_FIREBASE_API_KEY is set:
        loadFromFirestore(uid) → if cloud data found, setState(cloudData)
      Else or on network error:
        usePlannerStore.persist.rehydrate() from localStorage[scoped key]
   e. onReady() → storeReady = true
   f. Subscribes to store changes → debounced saveToFirestore every 5 seconds

4. storeReady = true → AppShell renders with correct user data
   → useOvernightCheck() runs runOvernightLogic and dispatches applyOvernightPatch
   → Dashboard reads tasks, streak, history from store
```

---

## Scoring Engine

All scoring lives in `lib/engine/scoring.ts`.

### Points per task (`basePts`)

| Priority | Base Points |
|---|---|
| `high` | 20 |
| `med` | 12 |
| `low` | 6 |
| `special` | `task.specialPts` (set per task) |

### `calcPts(task)` — final points for a completed task

1. Start with `basePts(task)`.
2. **Deadline penalty**: if completed > 0min late → ×0.7; > 1hr late → ×0.4.
3. **Slot mismatch**: if task has `slot` and was completed outside that slot's hours → ×0.8.
4. **Carry penalty**: subtract `carriedDays * CARRY_PENALTY` (2 pts/day), floor at 1.

Penalties stack multiplicatively (deadline × slot), then carry is subtracted from the
multiplied result.

### Daily target

`getMinPts(date, cfg)` returns `cfg.weekendPts` (default 20) on Sat/Sun, `cfg.minPts`
(default 70) on weekdays. A day "passes" when `rxp >= minPts`.

### Wallet ratio

`walletPtsFor(pts)` = `Math.floor(pts / WALLET_RATIO)` where `WALLET_RATIO = 2`.
Every 2 task XP earns 1 wallet point.

### Journal XP

First journal entry per day → `+5 rankXP` and `+2 rewardWallet`.
Subsequent entries per day → no award.

---

## Overnight Logic

`lib/engine/streak.ts:runOvernightLogic(state, today)` runs once per login via
`useOvernightCheck`. It processes every calendar day between the last history entry
and today.

For each missed day it:
1. Computes `rxp` from that day's tasks.
2. If `rxp >= minPts` → **auto-submit as success** (streak++, badge check, freeze bonus).
3. Else if week rest token is unused → **auto rest day** (streak preserved).
4. Else if freeze tokens > 0 → **auto freeze** (streak preserved, token consumed).
5. Else → **streak breaks** (streak = 0, no submittedDays entry).

`bufferXP` is credited as `floor((rxp - minPts) / 2)` for days that pass.

### Carry-forward

Incomplete tasks with `carriedDays < MAX_CARRY (3)` are copied to the next day with
`carriedDays++`. Tasks at `MAX_CARRY` are dropped. The carry loop runs as part of
overnight processing.

For new users with no history, the loop anchor is set to the day **before** the
earliest past task date, so the loop processes that task day correctly.

### `submitRetroFix`

Available in the morning (before noon) for yesterday's incomplete tasks. Updates
`rankXP`, `rewardWallet`, `history`, and streak if the retro-fixed day now meets
`minPts`. If no history entry exists for that date (new user), a new entry is pushed.

---

## All AppConfig Settings

Stored at `state.cfg`, editable from Settings. Defaults come from `data/defaults.json`.

| Field | Default | Description |
|---|---|---|
| `minPts` | 70 | Points needed to pass a weekday. A day below this breaks the streak. |
| `weekendPts` | 20 | Points needed to pass a weekend day (Sat/Sun). Lower bar for rest. |
| `cutoffHour` | 1 | Hour (0–23) at which the "current day" rolls over. Setting to 1 means 1 AM is still "last night" — useful for night-owls. |
| `tone` | `'balanced'` | Manager coaching tone. Options: `'balanced'` \| `'strict'` \| `'encouraging'`. Controls message language from `lib/engine/manager.ts`. |
| `managerName` | `'The Manager'` | Display name for the AI manager in coaching modals. |
| `moodMot` | 1.2 | XP multiplier applied when morning mood is "Motivated". Applied to `todayEarned`. |
| `moodSick` | 0.5 | XP multiplier applied when morning mood is "Sick". |
| `pomoDuration` | 25 | Pomodoro timer length in minutes. |
| `quoteMorning` | true | Show a motivational quote at the top of Dashboard before noon. |
| `quoteEvening` | true | Show an evening reflection quote after noon. |
| `autoExportEnabled` | false | If true, triggers a JSON export of planner state on each save (for offline backup). |
| `theme` | `'dark'` | UI theme. Options: `'dark'` \| `'light'`. Applied by `ThemeApplier` via CSS variables. |

---

## Cookies Reference

| Cookie | httpOnly | JS Readable | Lifetime | Set by | Used by |
|---|---|---|---|---|---|
| `kp_session` | Yes | No | 7 days | `createSession` | `proxy.ts` (route auth) |
| `kp_uid` | No | Yes | 7 days | `createSession` | `userScope.ts` (localStorage namespace), `StoreBootstrap` |
| `kp_display` | No | Yes | 7 days | `createSession` | `useDisplayName` hook (dashboard title) |

---

## Firebase Setup

Firebase is **optional**. Without it, the app works entirely on localStorage.

To enable cloud sync:
1. Create a Firebase project with Firestore enabled.
2. Add a web app and copy the config keys.
3. Set the `NEXT_PUBLIC_FIREBASE_*` variables (see below).
4. For server-side operations (user storage), also set `FIREBASE_SERVICE_ACCOUNT_JSON`.

Data model: `/users/{uid}/planner/state` — one document per user, full state snapshot.
The `_syncedAt` field is added by the server and stripped on read.

Firestore free tier: 50K reads / 20K writes / day — sufficient for personal use.
If the journal grows very large (approaching 1MB), split it into a subcollection.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | Yes | Minimum 32-char random string. Used to sign JWT sessions. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | No | Firebase web app API key. Presence enables cloud sync. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | No | Firebase auth domain. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | No | Firebase project ID. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | No | Firebase storage bucket. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | No | Firebase messaging sender ID. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | No | Firebase app ID. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | No | JSON blob of the service account key for Admin SDK (server user CRUD). |

To run without Firebase: only `SESSION_SECRET` is needed. The app stores all state in
`localStorage` namespaced by `kp_uid`.

---

## Running Locally

```bash
# Install dependencies
npm install

# Start dev server (hot-reloading)
npm run dev

# Type-check only
npx tsc --noEmit

# Lint
npm run lint

# Run tests (single pass)
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Full pre-deploy verification (tsc + lint + coverage + build)
npm run verify
```

`npm run build` uses `--webpack` to bypass Turbopack, which has known incompatibilities
with several dependencies in this project.

---

## Testing

### Structure

```
tests/
  unit/            Pure function tests — no store, no React
    scoring.test.ts
    streak.test.ts
    manager.test.ts
    quotes.test.ts
    userScope.test.ts
  store/           Zustand slice integration tests
    helpers.ts     resetStore() helper (call in beforeEach)
    tasks.test.ts
    tasks-extra.test.ts
    streak-extra.test.ts
    journal.test.ts
    config.test.ts
    rewards.test.ts
    ui.test.ts
  setup/
    localStorage.ts  Mocks localStorage + sessionStorage for Node environment
```

### Coverage Thresholds

Configured in `vitest.config.mts`. Must pass `npm run verify`:

| Metric | Threshold | Notes |
|---|---|---|
| Statements | 99% | |
| Branches | 85% | `??` fallback branches and browser-only `document.cookie` code in Node are uncoverable |
| Functions | 99% | |
| Lines | 99% | |

Coverage is measured over `lib/engine/**`, `store/slices/**`, and `store/userScope.ts`.
React components and Next.js pages are excluded (covered by E2E tests).

### Writing Store Tests

Always call `resetStore()` in `beforeEach`:

```ts
import { usePlannerStore } from '@/store'
import { resetStore } from './helpers'

beforeEach(resetStore)

it('does something', () => {
  usePlannerStore.getState().someAction(...)
  expect(usePlannerStore.getState().someField).toBe(...)
})
```

### Writing Unit Tests

Pass minimal `AppState` / `AppConfig` objects via `makeState()` / `CFG` helpers.
See `tests/unit/streak.test.ts` for the pattern.

---

## Coding Conventions

- **No comments** unless the WHY is genuinely non-obvious. Identifiers should speak for themselves.
- **No features beyond the task**. A bug fix should not touch unrelated code.
- **No error handling for impossible cases**. Only validate at system boundaries.
- **Slices are pure**: slice functions only call `set`/`get` — no side effects, no fetches.
- **Dates as ISO strings**: `YYYY-MM-DD` for day keys, full ISO strings for timestamps.
- **`date` on Task** is the assigned day, not createdAt. Tasks are day-scoped.
- **`submittedDays[date]`** is set for completed/rest/frozen days. It is NOT set for streak-breaking missed days. This is the canonical way to check "was this day finalised."
- **Import `'server-only'`** in any file that uses Firebase Admin or the `cookies()` API.
- **No default exports from slices** — they export named `create*Slice` functions.
- Tailwind classes are preferred over inline styles except for dynamic values.

---

## Key Invariants

These must hold at all times. Break one and the app will silently miscount streaks or lose data.

1. **`_userId` must be set before first store read** — `readUidFromCookieSync()` in `userScope.ts` ensures this at module evaluation time.

2. **`submittedDays[date]`** is the canonical "day done" flag. Everything that gates on day completion (showRetroFix, streak counting, calendar icons) must read this field, not `history[i].auto` or `pct`.

3. **Streak icons use `rxp >= minPts`**, not `pct >= 100**. XP is the scoring unit. Tasks can be added after-the-fact, making `pct` unstable.

4. **`runOvernightLogic` is idempotent** — calling it twice with the same `today` must produce the same result. It skips days already in `submittedDays`.

5. **`MAX_CARRY = 3`** — tasks carried 3 times are dropped, not carried a 4th time. The check is `carriedDays >= MAX_CARRY` (exclusive).

6. **Firestore is the source of truth when online** — after `StoreBootstrap` loads cloud data, the subscribe/debounce loop keeps it updated. Never write directly to Firestore from a slice.

7. **No user data crosses uid boundaries** — `scopedStorageKey` always includes `:{uid}`. Never write to the bare `STORAGE_KEY` key in new code.
