---
name: verify-and-push
description: >-
  Run the full verify -> commit -> push -> PR -> CI flow for this repo:
  build, test with 100% coverage, push the branch, open/update a PR into
  master, wait for all checks, and fix failures until everything is green.
  Use when the user says "verify and push", "ship this", or asks to push
  changes and make sure CI passes.
---

# Verify and push

End-to-end flow for landing changes on this repo: verify locally, push,
open a PR into `master`, and drive it to green. Do not stop after pushing —
the job isn't done until the PR's checks pass or the user says to stop.

## 1. Verify locally

Run:

```
npm run verify
```

This runs `vitest run --coverage` then `next build --webpack`. Both must
pass before anything is pushed.

- **Coverage must be 100%** for statements, branches, functions, and lines
  (see `vitest.config.mts` thresholds). If coverage falls short, that is a
  blocking failure to fix by adding tests for the uncovered
  lines/branches — never ask the user whether to relax the threshold or
  push anyway. Read the uncovered-line report per file, understand what
  branch/condition is untested, and add real test cases (follow existing
  test file conventions in `tests/unit/` and `tests/store/`). Only remove
  source code instead of testing it if it's genuinely dead/unreachable —
  verify via call-site analysis first.
- If the local test/type/build feedback loop will take many iterations
  (e.g. closing out a large coverage gap), delegate that work to a
  general-purpose agent rather than grinding through it turn by turn.

## 2. Stage and commit

Before `git add`, check `git status` for untracked files that are local
tooling artifacts rather than app source, and exclude them from the
commit (they should not be pushed to the repo):

- `.agents/`, `.claude/skills/*` symlinks — machine-local skill installs
  (this skill's own `SKILL.md` file, if newly added as a real file, is
  fine to commit — only the *symlinked* firebase skill dirs are excluded)
- `skills-lock.json` — skill install lockfile
- `.npm-install.log`, other stray `*.log` install-error leftovers

Stage everything else, and write a commit message focused on *why*, not
a file-by-file listing. Only commit when the user has actually asked for
it (or this skill was invoked, which implies it).

## 3. Push and open/update the PR

```
git push -u origin <branch>   # first push on a new branch needs -u
```

Then check whether a PR into `master` already exists for this branch:

```
gh pr view <branch> --json url,state 2>&1
```

If none exists, open one:

```
gh pr create --base master --title "..." --body "..."
```

If one exists, the push alone updates it — no further action needed to
"re-raise" it.

## 4. Wait for checks and fix failures

Poll until every check is terminal (not pending):

```
gh pr checks <PR#> --json name,bucket
```

This repo has **no GitHub Actions workflows** — the only checks are
Netlify's deploy-preview checks (`Header rules`, `Redirect rules`,
`Pages changed`, `netlify/.../deploy-preview`). A Netlify deploy failure
can't be diagnosed from the GitHub check alone (`gh api .../check-runs`
only gives a `details_url`, and the Netlify deploy/build log API requires
auth this session doesn't have) — if `gh pr checks` shows a Netlify
failure, ask the user to paste the build log from the deploy's Netlify
URL rather than guessing blindly.

**Known recurring failure mode**: Netlify's automatic secrets scanner
fails the build if any value of an env var configured in the Netlify site
matches literal text in the build output. This fires on legitimate,
non-leaky cases:

- Server-only secrets (`SESSION_SECRET`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`) appearing in compiled server bundle chunks
  (API routes/SSR) — those chunks run in Netlify Functions and never
  reach the browser.
- Public identifiers that happen to be configured as an env var value
  (e.g. `NEXT_PUBLIC_FIREBASE_PROJECT_ID` matching the project ID
  committed in `.firebaserc`).

Fix by adding the flagged key to `netlify.toml`:

```toml
[build.environment]
  SECRETS_SCAN_OMIT_KEYS = "SESSION_SECRET,FIREBASE_CLIENT_EMAIL,FIREBASE_PRIVATE_KEY,NEXT_PUBLIC_FIREBASE_PROJECT_ID"
```

Only add a key here if you've confirmed (from the actual log) it's a
false positive, not an actual leaked secret.

For any other failure, read the actual log before changing anything —
don't guess-and-check across multiple pushes.

## 5. Done condition

Keep iterating (fix -> commit -> push -> re-check) until `gh pr checks`
shows every check passed (or neutral/skipped, which is fine) and
`gh pr view --json mergeStateStatus` reports `CLEAN`. Only then report
the task complete.
