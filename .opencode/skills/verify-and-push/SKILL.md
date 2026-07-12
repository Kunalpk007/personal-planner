---
name: verify-and-push
description: Use when the user says "push", "commit and push", "verify and push", "create a PR", or asks to run checks and push code. Writes test cases for changes, runs npm run verify, auto-fixes lint issues, then commits, pushes, creates a PR into master, and waits for all checks to pass.
---

# verify-and-push

Use this skill whenever the user wants to verify their code and push it to GitHub with a PR.

## Steps

### 1. Analyze changes and write test cases

1. Run `git diff --name-only` to see what files changed.
2. For each changed source file (under `lib/`, `store/`, `hooks/`, `features/`, `app/`), identify the functions/logic that changed.
3. Run `npm run test:coverage` to get the current coverage report.
4. Add or update test files in `tests/` to cover the changed logic:
   - **Store changes** → `tests/store/` (e.g., `tasks.test.ts`, `streak.test.ts`)
   - **Engine/lib changes** → `tests/unit/` (e.g., `scoring.test.ts`, `cutoff.test.ts`)
   - **New features** → create `tests/unit/<feature>.test.ts`
5. Ensure **100% coverage (statements, functions, lines)** for the changed files. The coverage thresholds in `vitest.config.mts` are: 99% statements, 85% branches, 99% functions, 99% lines.
6. Run `npm run test:coverage` and verify coverage meets thresholds. If not, add more test cases.

### 2. Check for secrets

Before staging, scan the diff for potential secrets (Netlify builds fail if secrets are committed):

1. Run `git diff --cached` (or `git diff` if nothing staged) and pipe through a secrets grep:
   ```
   git diff --cached 2>$null; if ($?) { $diff = git diff --cached } else { $diff = git diff }
   ```
2. Check for patterns like:
   - Firebase service account private keys (`private_key`, `client_secret`, `client_email`)
   - API keys / tokens (`sk-`, `pk-`, `AKIA`, `ghp_`, `gho_`)
   - Hardcoded secrets instead of `process.env.*` or `env()` references
   - `.env` or `.env.local` files being tracked
3. If secrets are detected, **ask the user**: "Secrets detected in the diff. Netlify will fail. Do you want me to remove them?" If yes → use `git restore --staged <file>` to unstage the file, or edit the file to use environment variables instead. Do NOT commit secrets.
4. If the user confirms no secrets or they've been removed, proceed.

### 3. Stage all changes

`git add -A`

### 4. Run `npm run verify`

This runs:
- `tsc --noEmit` — TypeScript type check
- `eslint .` — lint check
- `vitest run` — unit tests
- `next build --webpack` — production build

### 5. Fix errors

If errors are found, fix them before proceeding:
- Run `npm run lint:fix` to auto-fix lint issues
- Resolve type errors from `tsc --noEmit`
- Fix test failures from `vitest run`
- Fix build errors from `next build --webpack`

### 6. Repeat step 4 until `npm run verify` passes cleanly

### 7. Commit

`git commit -m "<type>: <short description>"`

Use conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`.

### 8. Push

`git push origin <current-branch>`

### 9. Create PR into master

`gh pr create --base master --head <current-branch> --title "<descriptive title>" --body "<detailed summary of changes>"`

The title and body must be meaningful:
- **Title**: `<type>: <what changed>` (e.g., `feat: add PWA support with service worker and install prompt`)
- **Body**: Bullet points of what was changed and why

### 10. Wait for PR checks to pass

Run `gh pr view <pr-number> --json statusCheckRollup --jq '.statusCheckRollup[] | "\(.name): \(.conclusion)"'` repeatedly until all checks complete.

If all checks pass → Report success to the user.

### 11. If checks fail

1. Report which checks failed and the failure details to the user.
2. Ask the user: "Some checks failed. Do you want me to fix the issues?"
3. If user says yes → fix the issues → go back to step 2.
4. If user says no → stop and report the failures.

### PR Checklist for the user

Share these as important pre-PR checks (ask user if they want to verify these):

| Check | Description | Command |
|-------|-------------|---------|
| TypeScript | No type errors | `tsc --noEmit` |
| Lint | No lint errors | `eslint .` |
| Unit tests | All pass, 100% coverage | `vitest run --coverage` |
| Build | Production build succeeds | `next build --webpack` |
| E2E tests | Playwright tests pass | `npm run test:e2e` |
| Manual smoke | Open app, login, use each tab | Manual |
| Console errors | No JS console errors | `npm run dev` + check browser console |
| Responsive | Works mobile (≤639px) and tablet (640-1024px) | Responsive dev tools |
| PWA | Lighthouse PWA audit passes | Lighthouse tab in Chrome DevTools |
| Accessibility | No obvious a11y violations | axe DevTools or manual tab navigation |
| Git status | No unintended changes | `git status` |
| Commit audit | No secrets, no large files | `git diff --stat` |

### Test case review steps

Tell the user they can verify test coverage by running:

```bash
npm run test:coverage
```

Then open `coverage/index.html` in their browser to see per-file coverage details.

To see test results in the terminal:

```bash
npm run test
```