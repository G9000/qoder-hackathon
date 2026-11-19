---
name: create-pr
description: Prepare and open a pull request from the current branch. Use when the user asks to create a PR, open a pull request, ship a branch for review, or prepare changes for a PR. Runs project checks, summarizes commits and diffs, confirms before pushing, and creates the PR with gh.
---

# Create PR

## Overview

Turn the current branch into a reviewable pull request without risking lost work,
secret leaks, or a red CI run. This skill inspects the repo, verifies the change,
and only pushes after explicit confirmation.

## Guardrails

- **Never push without an explicit "yes".** Show the branch, commits, diffstat, and
  check results first.
- **Never force-push.** No `--force`, no `--force-with-lease`, no rewriting public
  history.
- **Never run on `main`/`master`.** Create a branch from the current work instead.
- **Never stage everything.** Use named paths. Never `git add -A` or `git add .`.
- **Never commit secrets or build output**: `.env`, `.env.local`, `*.zip`,
  `node_modules/`, `.next/`, credentials, tokens.
- **Do not open a PR with failing checks** unless the user explicitly accepts the
  failure and the reason is written in the PR body.
- If the working tree has uncommitted changes, show the diff and ask before
  committing. Never discard work.

## Procedure

### 1. Inspect the repository

Run these in parallel:

```bash
git status --short
git branch --show-current
git remote -v
git log --oneline -10
```

Determine the base branch:

```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo refs/remotes/origin/main
```

If there is no `origin` remote, stop and ask the user for the remote URL. Do not guess.

### 2. Confirm the branch

- On `main`/`master`: propose `<ticket-id>-<short-slug>` (for example
  `a1-seed-quotes`) and create it only after confirmation:
  `git switch -c <branch>`.
- On a feature branch: continue.
- If the branch has no commits ahead of the base, stop. There is nothing to PR.

### 3. Handle uncommitted work

If `git status --short` is non-empty:

1. Show `git diff --stat` and the file list.
2. Ask which files belong in this PR.
3. Stage only those paths: `git add <path> ...`.
4. Commit with a ticket-prefixed message, one ticket per commit:
   `git commit -m "<TICKET>: <what changed>"`.
5. Re-check `git status --short` before proceeding.

Never stage `.env*`, `*.zip`, `node_modules/`, `.next/`, or anything that looks like a
credential.

### 4. Run checks

Detect the package manager (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`) and run
the available checks in this order:

```bash
npm test
npm run check        # only if the script exists
npx tsc --noEmit     # only if tsconfig.json exists
npm run build        # only if the script exists
```

If any check fails:

- Stop.
- Show the failing command and the last 20–30 lines.
- Report the failure to the user and do not push.
- Offer to fix the failure as a separate step.

### 5. Draft the PR

Collect:

```bash
git log --oneline <base>..HEAD
git diff --stat <base>...HEAD
```

Write a title under 70 characters. Prefix it with the ticket IDs when applicable.
Use this body template:

```markdown
## Summary
- <what changed and why, 1-3 bullets>

## Tickets
- <A1> <one-line intent>
- <B2> <one-line intent>

## Test plan
- [ ] `npm test`
- [ ] `npm run check`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`
- [ ] Manual demo path: <make/model + damage type + expected rows>

## Evidence
- <screenshot, eval report, or diff link>

## Risk / rollback
- <what could break; how to revert>
```

### 6. Confirm before pushing

Show the user:

- branch name and base branch
- commit list
- diffstat
- check results
- the exact title and body

Ask: **"Push `<branch>` and open this PR?"** Proceed only on an explicit yes.

### 7. Push

```bash
git push -u origin <branch>
```

If the push is rejected because the remote has newer commits, stop. Do not force.
Fetch, inspect, and ask how to proceed.

### 8. Open the PR

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)"
```

Return the PR URL. If a PR already exists for the branch, report it and offer
`gh pr view --web` instead of creating a duplicate.

## Failure handling

| Situation | Action |
|---|---|
| No `origin` remote | Stop; ask for the remote URL |
| `gh` not installed | Report; suggest installing GitHub CLI |
| `gh` not authenticated | Tell the user to run `! gh auth login` |
| On `main` with changes | Create a ticket-prefixed branch, then continue |
| Checks fail | Stop; report the command and tail of output |
| Push rejected | Fetch and inspect; never force-push |
| PR already exists | Report the existing URL; do not duplicate |
| Dirty tree after commit | Re-check; report remaining files and ask |

## Project notes

- Ticket prefixes in this repo: `T0`, `A1`–`A4`, `B1`–`B4`, `C1`–`C3`, `D1`–`D6`,
  `E1`–`E5`. One commit per ticket.
- The PR test plan must cover the definition of done in `AGENT.md` §11: the bumper
  pair ranking, the coverage/capability filters, and offline mode.
- Do not describe seeded prices as market data. Every price claim needs provenance.
- WhatsApp/Telegram integration is out of scope for this build; do not add a webhook
  or provider SDK in a PR.
