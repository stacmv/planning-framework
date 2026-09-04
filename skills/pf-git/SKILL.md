---
name: pf-git
description: Reference data — the commit & push procedure every pf-* stage runs when it finishes. Not normally invoked directly.
version: 3.0.0
---

This skill is reference data for other Planning Framework skills. It is not meant
to be run directly. If invoked directly, just print the procedure below.

## Stage commit & push — the shared procedure

This section is the **single definition** of how framework work reaches git.
Every `pf-*` skill that produces or changes an artifact **references** this
section at the end of its stage; no skill restates the procedure in its own
words. (Seven independent copies of a rule are exactly how the completion gates
drifted apart before `pf-size-tiers` centralized them — see
`~/.claude/skills/pf-size-tiers/SKILL.md`.)

**The rule:** a stage is not finished when its file is written — it is finished
when that file is **committed and pushed**. Run this procedure as the last action
of the stage, after the artifact is on disk and after any summary you relay to
the user.

### Evaluating it is a MECHANICAL check

Judge from `git status --porcelain`, run fresh at the end of the stage — not from
what you believe you wrote this session. If it reports nothing for the stage's
paths, there is nothing to commit: say so in one line and skip to nothing. Do not
create an empty commit.

---

## Step 0: No-repository guard

Before any of the steps below, check `has_git` (`git rev-parse
--is-inside-work-tree`) — the same computation as `/pf`'s Step 0. If it is
false, do **not** run Step 1 (stage), Step 2 (commit), or Step 3 (push). In
place of the normal Step 4 line, print:

```
Git: not committed — no git repository
```

(translated per `doc_language`, if set to something other than English).
This is the single definition of that text — every stage that reaches this
procedure references it rather than restating the wording, including `/pf`'s
CREATE step for the idea branch, which prints it inline since there is
nothing yet to stage (see `pf/SKILL.md`'s "Terminal git-status line"), and
`/pf-close`'s no-repo branch.

## Step 1: Stage the artifact — scoped, never `-A`

Stage **only the paths this stage owns**:

| Stage | Paths to `git add` |
| ----- | ------------------ |
| `/pf-brd` | `docs/issues/open/<ISSUE-ID>/brd.md` (+ `prompt.md` if `size_tier` changed) (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-spec` | `docs/issues/open/<ISSUE-ID>/specs.md` (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-test-plan` | `docs/issues/open/<ISSUE-ID>/test_plan.md` (+ `prompt.md` if `size_tier` changed) (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-impl-plan` | `docs/issues/open/<ISSUE-ID>/implementation_plan.md` (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-check` | the document(s) the fix sub-agent actually edited (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-execute` | `-A` at a wave boundary — this stage owns the code, not just the issue folder (+ `prompt.md`, if automigration ran this same invocation — already covered by `-A`, since it sweeps the whole worktree) |
| `/pf-codereview` | `docs/issues/open/<ISSUE-ID>/code_review.md` (+ the file(s) the fix sub-agent actually edited, on a Fix-now loop iteration) (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-test` | `docs/issues/open/<ISSUE-ID>/test_plan.md`, `manual_test_checklist.md` (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-user-docs` | `docs/issues/open/<ISSUE-ID>/user_docs.md` (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-dev-docs` | `docs/issues/open/<ISSUE-ID>/dev_docs.md` (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-qa` | `docs/issues/open/<ISSUE-ID>/qa_report.md` (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-idea` | `docs/issues/open/<ISSUE-ID>/idea.md` (+ `open_questions.md`, if created/changed this run) (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-idea-research` | `docs/issues/open/<ISSUE-ID>/research.md` (+ `open_questions.md`) (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-idea-critique` | `docs/issues/open/<ISSUE-ID>/critique.md` (+ `open_questions.md`) (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-idea-verdict` [mode 1] | `docs/issues/open/<ISSUE-ID>/verdict.md` (+ `open_questions.md`) (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-idea-verdict` [mode 2, decision session] | `docs/issues/open/<ISSUE-ID>/verdict.md`, `open_questions.md` (+ any documents whose sections were regenerated on override) (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-idea-spike` [mode 1] | `docs/issues/open/<ISSUE-ID>/hypothesis.md` (+ `prompt.md`, if automigration ran this same invocation) |
| `/pf-idea-spike` [mode 2] | `docs/issues/open/<ISSUE-ID>/findings.md` (+ experiment code — `-A` for this stage if a branch was created, same rationale as `/pf-execute`, since this stage also "owns the code, not just the issue folder" when code exists) (+ `prompt.md`, if automigration ran this same invocation) |

For `size_tier: trivial`, `notes.md` stands in for `brd.md` / `specs.md` /
`implementation_plan.md` — stage it under whichever stage produced it.

**Why every row carries the automigration qualifier.** The `reviewers:` →
`roles:` automigration (`~/.claude/skills/pf-roles/SKILL.md` §5) edits
`prompt.md` but never commits that edit itself — by design, so it doesn't
create a commit of its own just for the migration. Whichever `pf-*` stage
runs next for that issue after automigration fired is the one responsible
for staging that edit alongside its own artifact. Before this qualifier
existed on every row, only `/pf-brd`/`/pf-test-plan` carried a `prompt.md`
qualifier at all (for `size_tier` changes) — so a stage without one (most of
them) would leave the automigration edit unstaged and uncommitted, and it
would only surface much later as a dirty-tree failure at `/pf-qa`, far
removed from its actual cause. Only one stage actually stages this edit in a
given run — whichever one runs immediately after automigration fired — but
every row needs the qualifier because any of them could be that stage.

**Why scoped and not `git add -A`.** `/pf-qa` fails the run when `git status` is
dirty (see its Important Notes), and that check only means something if unrelated
edits are still visible when QA runs. A stage that sweeps the whole worktree into
its own commit hides exactly what QA exists to catch. If `git status` shows
changes outside this stage's paths, leave them alone and mention them in the
stage's report — do not commit them, do not revert them.

## Step 2: Commit

Conventional Commits, with the issue ID so the closure report can attribute the
work:

| Stage | Message |
| ----- | ------- |
| `/pf-brd` | `docs: brd.md for <ISSUE-ID>` |
| `/pf-spec` | `docs: specs.md for <ISSUE-ID>` |
| `/pf-test-plan` | `docs: test_plan.md (<N> TC, <A> Auto/<M> Manual) [<ISSUE-ID>]` |
| `/pf-impl-plan` | `docs: implementation_plan.md (<N> tasks) [<ISSUE-ID>]` |
| `/pf-check` | `docs: /pf-check corrections to <doc> [<ISSUE-ID>]` |
| `/pf-execute` | `feat: <short wave summary> [<ISSUE-ID>]` (or `fix:` / `refactor:` as fits) |
| `/pf-codereview` | `docs: code_review.md — <PASS\|FAIL> [<ISSUE-ID>]` |
| `/pf-test` | `test: status tracker + manual checklist [<ISSUE-ID>]` |
| `/pf-user-docs` | `docs: user_docs.md for <ISSUE-ID>` |
| `/pf-dev-docs` | `docs: dev_docs.md for <ISSUE-ID>` |
| `/pf-qa` | `docs: qa_report.md — <PASS\|FAIL> [<ISSUE-ID>]` |

Never `--no-verify`: a repo's pre-commit hooks apply to framework commits too.

## Step 3: Push, safely

Same guard as `/pf-close` Phase 8.5 — this procedure and that phase must not
diverge.

1. **Skip the push (and record the reason for the stage's report) if either holds:**
   - The current branch is `main` or `master` — release branches are pushed by
     the user manually, never automatically.
   - No git remote is configured (`git remote` prints nothing).
2. **Resolve the remote:** use the current branch's configured remote
   (`git config branch.<CURRENT-BRANCH>.remote`); if unset, use `origin` when it
   exists, otherwise skip per the guard above.
3. **Push:** `git push <remote> <CURRENT-BRANCH>` (add `-u` if the branch has no
   upstream yet). Never `--force` / `--force-with-lease`, never `--no-verify`.
4. **On push failure** (auth, non-fast-forward, network): do **NOT** abort the
   stage and do **NOT** retry in a loop — the work is already committed locally,
   which is the half that prevents data loss. Capture the git error and surface
   it in the stage's report.

**Which branch this lands on is not this skill's decision.** Planning stages run
on the parent branch (`develop`), because the issue branch is not created until
`/pf-execute`; `/pf-execute` and everything after it run on the issue branch.
Push whatever branch you are actually on.

## Step 4: Report one line

Append to the stage's normal output exactly one line, so an interrupted session
leaves evidence of how far the work got:

```
Git: committed <short-sha> · <pushed to <remote>/<branch> | not pushed — <reason>>
```

Where `<reason>` is one of: `branch is main/master, push manually`, `no remote
configured`, or the verbatim git error.

---

## Why this exists

`/pf` syncs with the remote before it scans for issues (`git fetch` +
`git pull --ff-only`), so a session on another machine sees whatever has been
pushed. That is only half a mechanism: before this procedure, the planning stages
committed nothing at all, `/pf-execute` committed without pushing, and work first
reached the remote at `/pf-close`. Everything between issue creation and closure
lived in one machine's working tree, where a session limit, a connection drop or
a machine switch destroyed it.

The failure this prevents is not hypothetical: it is why `/pf-autopilot` already
carried its own "commit and push after each completed stage" instruction. That
instruction was right — it was just scoped to one skill instead of all of them.
