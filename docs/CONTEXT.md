# Kunal's Planner — Complete Project Context, SOW & Discussion Archive
_Single source of truth for all sessions, decisions, and architecture choices_
_Last updated: 2026-06-12_

---

## 1. What the App Currently Has (v2 Feature Inventory)

### Core Features
- **Dashboard** — mood bar (one-shot per day, locked after selection), stats grid (pts today, wallet, done count, streak), rank progress bar with ℹ milestone modal, day progress bar, power row (buffer XP, freeze tokens, Today's Focus card), manager card, single submit button with disabled state + hover tooltip
- **Tasks** — today's tasks with H/M/L/⭐ priority badges, zone pill, pts display, 📌 pin icon, pomo clock icon, edit + delete. Recurring templates tab. Carried tasks with penalty display (-2pts/day). Subtasks per task. Priority sort: Special > High > Med > Low.
- **Journal** — multiple entries per day (key: `YYYY-MM-DD HH:MM`), +5 Rank XP first entry only, edit shows "Update entry" (no XP label), PIN overlay (4-digit, SHA-256 hash)
- **Rewards** — wallet chip (purple), buy freeze button, reward list with cost vs wallet check, custom reward add form, redeem any time (no submit gate)
- **History** — last 60 entries, accordion per day, shows done/total, start mood, EOD mood, RXP, flags (Auto/Late/❄/🟡), tasks list, rewards redeemed
- **Settings** — 4 tabs: General (manager, submission rules, mood multipliers, pomo, quotes on/off, zones, export/import) · Streak & Badges (all-time stats, badges, pause/invalidate/reset-rank) · Rules & Guide (collapsible accordions) · Phase 2 roadmap

### Points System
| Priority | Base | Deadline modifier | Slot mismatch | Carry penalty |
|----------|------|-------------------|---------------|---------------|
| High | 20 | On time 100%, <1hr late 70%, >1hr 40% | -20% | -2pts/day |
| Medium | 12 | Same | Same | Same |
| Low | 6 | Same | Same | Same |
| ⭐ Special | Custom | Same | Same | Same |

- Mood multiplier applies to earned pts only (not target pts) — this is a fixed design decision
- Rank XP: separate pool, earned on task completion + journal, decays 2%/day after 3-day grace

### Reward Wallet
- Separate from Rank XP and task pts
- Every 2 task pts earned → 1 wallet pt (accumulated silently on toggle)
- Permanent, never resets. 50% decay on 1-year anniversary
- Used to redeem rewards + buy streak freezes (500 wallet pts = 1 freeze)
- Redeem anytime — no submit requirement

### Streak System
- Full day (min pts) → +1. Weekend pulse (20+ pts) → +1. Rest Day → unchanged. Freeze → unchanged. Paused → frozen. Miss → 0
- 1 Rest Day/week, any day, resets Monday. Does not carry over
- Freeze: earned at milestones (3,7,15,21,50,100,175,200,250,300,325,365) + buyable (500 pts, max 2 purchased at a time)
- Pause: up to 20 days. After 20 days, auto-expires and streak resets

### Cutoff Auto-Logic
At cutoff hour (default 1AM, max 4AM): min pts met → auto-submit (flagged Auto) → no activity + rest unused → auto-rest → freeze available → auto-freeze → streak breaks. Next morning: overnight banner.

### Manager (AI Coach)
- User-nameable, 3 tones (Balanced/Strict/Encouraging), ~150 messages across priority × time-of-day × mood contexts
- Passive dashboard card + popup toast on each task completion

### Motivational Quotes
- Morning: full-screen overlay, first open after 4AM, shows streak count, tap to dismiss
- Evening: shown after day submission
- Both toggleable independently in Settings → General
- Comeback theme when streak = 0 and history exists
- 75 quotes loaded (40 morning, 20 evening, 15 comeback)

### Pomodoro
- Background-safe: uses `Date.now()` end timestamps (not interval counting, survives tab switches)
- Default 25 min, configurable 5–60 min
- Completing task during pomo: +5 bonus Rank XP

---

## 2. Key Design Decisions (Locked — Do Not Change)

1. **Mood affects target pts only, not rank XP** — discussed and confirmed. Toggling mood does not add/remove already-earned rank XP
2. **Freeze does not increment streak** — it protects, not increments. Streak stays exactly where it was
3. **Rewards redeemable anytime** — removed "submit first" gate. Wallet is always spendable
4. **No min task mix** — replaced entirely by min points threshold. H/M/L ratio enforcement removed
5. **No Light Day** — removed. Replaced by Rest Day + Weekend Pulse
6. **No competing leaderboard** — self vs past-self only. Permanently off roadmap
7. **Carry penalty decrement** — -2pts per carry day, max 3 days, then task expires
8. **Wallet ratio** — fixed at 2:1 (2 task pts = 1 wallet pt)
9. **Storage key** — `kunals_planner_v2` (migrates from v1 on first load)
10. **Quote overlays** — configurable On/Off in Settings, default both On

---

## 3. Flaws & Things to Reconcile (Tech Debt)

### Bugs Fixed in v1 → v2
- ✅ Mood toggle was adding/subtracting rank XP (wrong). Fixed — XP now only changes on task toggle
- ✅ Journal textarea not clearing after save
- ✅ Journal text restoring on tab navigation (draft restore bug)
- ✅ H/M/L not showing on tasks — now shows as colored badge pills
- ✅ Mood buttons not properly disabled after selection
- ✅ modal-freeze showing on every panel (missing `<div class="modal-overlay">` wrapper)
- ✅ Journal saving multiple entries per day now with timestamp key

### Still Pending / Known Issues
- ⚠ **AES journal encryption** — PIN UI and SHA-256 hashing built, but actual WebCrypto AES-GCM encryption of journal text not yet implemented. Journal entries stored plain text. Do before any public release
- ⚠ **Auto-submit at cutoff** — overnight logic runs on mount (next session open), not truly at the clock hitting 1AM. Real-time cutoff requires a service worker or periodic background sync (Phase 2)
- ⚠ **Carry-forward UI** — modal after submit to select which tasks to carry is built in HTML v2 but needs to be a proper component in the Next.js version
- ⚠ **Pomo bonus XP** — +5 bonus XP for completing task during active pomo is not yet wired in the Next.js version (the logic is in constants, but the hook needs to detect "task completed while pomo running")
- ⚠ **Edit task modal** — full edit form (priority, note, deadline, slot, subtasks) is a stub in the tasks page. Needs a proper `EditTaskModal` component
- ⚠ **Edit recurring template** — modal exists in HTML but is a stub in Next.js
- ⚠ **Weekly review** — Monday morning modal with last week stats. Built in HTML v2, not yet ported to Next.js
- ⚠ **`setting-input` class** — used in settings page but needs to be globally available (added to globals.css, verify it compiles)
- ⚠ **Import JSON** — currently does `Object.assign(state, data)` which is not Zustand-idiomatic. Should use `usePlannerStore.setState(data)`
- ⚠ **v1 → v2 migration** — `migrateV1ToV2()` is written but not called anywhere in the Next.js app. Call it in `app/layout.tsx` via a `useEffect`

### Architecture Concerns
- The single Zustand store with persist middleware will serialize the full state on every change. As tasks/history grow, this can slow down. Solution: debounce the persist write (Zustand has `partialize` option to exclude large arrays from auto-persist and save them manually)
- `usePlannerStore.getState()` inside `useOvernightCheck` breaks the reactive model — consider passing state as parameters instead
- Import of `state` object in settings export handler is not the Zustand way — use `usePlannerStore.getState()` in the export function

---

## 4. Competitive Watchlist — Things to Do Better

### vs Todoist
- Todoist has Karma but it's gamified weakly — no real streak mechanic or consequence. Our streak + freeze system is more emotionally engaging
- Watch: Todoist's natural language input ("Buy milk every Monday at 9am"). We need this eventually
- Watch: Todoist's recurring task flexibility. Our slot system (morning/afternoon/evening/night) is simpler but less powerful

### vs Habitica
- Habitica is full RPG — avatar, quests, guilds. We're not that. Our advantage: cleaner, more serious, less childish
- Watch: Habitica's social/guild features if we ever go B2B (team accountability)
- Do better: our points system is more nuanced (deadline penalty, slot mismatch, mood mult). Habitica is flat

### vs Streaks (iOS)
- Streaks is beautiful and simple. 12 habits max. No tasks.
- Watch: their widget game. Streak count on home screen widget converts users.
- Do better: we have journaling, manager coaching, XP progression — Streaks has none of this

### vs Notion
- Notion has everything but does nothing great. Our app is opinionated — that's the value
- Watch: Notion AI (AI-generated weekly summaries). This is our Phase 2 AI summary feature
- Do better: we're mobile-first, Notion is a desktop product at heart

### vs Finch / Fabulous
- Finch is habit tracking via a pet. Cute but shallow
- Fabulous is wellness-focused, morning routines, lots of hand-holding
- Do better: we're productivity-first, not wellness-first. Different audience (builders, founders, students — not general wellness)

### Universal Differentiators (Build These)
- **One-tap day submission** with a meaningful cutoff creates daily accountability that no other app has
- **The Manager** — personalized, tone-configurable AI coach is the killer feature. Invest here
- **Streak freeze economy** — earned freeze tokens with milestone rewards creates a satisfying meta-game
- **PIN-encrypted journal** — privacy-first journaling within a productivity app is rare
- **Import/export JSON** — trust and portability. Users keep their data. Big in India

---

## 5. Phase 2 Roadmap

### P2.1 — History Graph (highest priority after launch)
- Day-by-day pts chart (Recharts, lazy loaded)
- Mood vs output correlation line
- Best week highlight
- Flag: `NEXT_PUBLIC_ENABLE_HISTORY_CHART`

### P2.2 — Real-Time Cutoff via Service Worker
- Background sync or push from service worker at cutoff hour
- Runs overnight logic even when app is closed
- Requires: PWA service worker + Notification API permission

### P2.3 — Notion Sync
- Adapter interface: `sync/base.adapter.ts`
- Notion tasks → planner tasks (one-way first, then two-way)
- OAuth via Notion public integration
- Flag: `NEXT_PUBLIC_ENABLE_NOTION_SYNC`

### P2.4 — Google Calendar Sync
- Two-way: planner tasks with deadlines → GCal events
- OAuth PKCE flow (no backend required for read)
- Flag: `NEXT_PUBLIC_ENABLE_GCAL_SYNC`

### P2.5 — AI Weekly Summary
- Uses journal entries + task history + mood data
- Claude API call (or local model for privacy)
- Shown on Monday morning instead of basic weekly review modal
- Flag: `NEXT_PUBLIC_ENABLE_AI_SUMMARY`

---

## 6. Phase 3 Roadmap

### P3.1 — Backend + Multi-Device Sync
- Next.js API routes + Supabase (PostgreSQL + Row Level Security)
- Auth: email magic link (no password) or Apple Sign In for iOS
- Sync on submit (not on every keystroke)
- State: keep localStorage as optimistic cache, sync on open + submit

### P3.2 — Mobile App (Capacitor → App Store / Play Store)
- Capacitor wraps the Next.js web app
- Native push notifications (local: daily reminder + cutoff warning)
- Haptic feedback on task completion
- Biometric unlock for journal (Face ID / fingerprint)
- Target: sub-15MB installed size

### P3.3 — Telegram / WhatsApp Notifications (GitHub Actions)
- GitHub Actions cron: 8AM IST daily
- Telegram Bot API (free): sends morning summary + task reminder
- WhatsApp via Twilio (free tier): same content
- Phase 3 because requires backend to know user's tasks

### P3.4 — B2B / Team Mode
- Multi-user: each user has their own state
- Admin dashboard: team streaks, completion rates
- Weekly team report (exportable PDF)
- Custom branding for enterprise
- This is the acquisition-target feature

---

## 7. Brainstorming Questions (Open)

1. What is the one mechanic someone screenshots and sends to a friend on Day 3?
2. Does the app make you want to come back after a missed day, or quit?
3. What does the app offer a user who is already disciplined? (Underserved today)
4. What anonymous, on-device telemetry do we need to prove retention to investors?
5. What is the product name? (Not "Kunal's Planner" — needs to scale)
6. When is the right moment to ask for an App Store review? (Hypothesis: after 21-day streak badge)
7. One-time purchase (₹499) vs freemium vs B2B — which first?
8. What AI coaching feature would make someone pay ₹99/month without thinking?
9. How do we handle the trust/privacy concern when AI reads the journal?
10. Who is the exact user? (Hypothesis: 22–35 year old builder/student in India with income and ambition but no discipline system)

---

## 8. Tech Stack Summary

| Layer | Tech | Why |
|-------|------|-----|
| Framework | Next.js 15 App Router | SSG/SSR flexibility, Capacitor compatible, TypeScript native |
| State | Zustand + persist middleware | One slice per feature, easy to delete features |
| Styling | Tailwind v4 + CSS vars | Zero runtime, design tokens in CSS, dark mode free |
| Storage | localStorage (v2) → Supabase (v3) | Offline-first, migrate without rewrite |
| Mobile | Capacitor | One codebase → web + iOS + Android |
| Data | JSON files | Tree-shakeable, i18n-ready, no logic |
| Crypto | WebCrypto API | Native browser, no dependency |

---

## 9. File Naming Conventions

- Feature components: `PascalCase.tsx` (e.g. `MoodBar.tsx`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g. `useDayKey.ts`)
- Store slices: `kebab-case.slice.ts` (e.g. `tasks.slice.ts`)
- Engine functions: `kebab-case.ts` (e.g. `scoring.ts`)
- Data files: `kebab-case.json`
- Constants: `kebab-case.ts`
- Pages: `page.tsx` (Next.js convention)
- Layouts: `layout.tsx`
