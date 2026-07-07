---
name: verify-and-push
description: Use when the user says "push", "commit and push", "verify and push", "create a PR", or asks to run checks and push code. Runs npm run verify to check build/tests/lint, auto-fixes lint issues, then commits, pushes, and creates a PR into master.
---

# verify-and-push

Use this skill whenever the user wants to verify their code and push it to GitHub with a PR.

## Steps

1. **Stage all changes** — `git add -A`
2. **Run `npm run verify`** — this runs:
   - `tsc --noEmit` — TypeScript type check
   - `eslint .` — lint check
   - `vitest run` — unit tests
   - `next build --webpack` — production build
3. **If errors are found**, fix them before proceeding (run lint with `--fix`, resolve type/build/test errors)
4. **Repeat step 2** until `npm run verify` passes cleanly
5. **Commit** — `git commit -m "<type>: <short description>"`
6. **Push** — `git push origin <current-branch>`
7. **Create PR into master** — `gh pr create --base master --head <current-branch> --title "<title>" --body "<summary>"`
