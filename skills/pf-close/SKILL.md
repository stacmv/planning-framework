---
name: pf-close
description: Close the active issue — merge branch, archive issue folder, update session-log
version: 4.0.0
---

Determine the active issue from `docs/issues/open/`. If no issue folder is found, stop: "No active issue found. Nothing to close."

Read ISSUE-ID from the active folder name (e.g. `docs/issues/open/20260630-feat-example/` → ISSUE-ID is `20260630-feat-example`).

## Phase 0: Prerequisite Checks

Run all checks in order. Stop immediately if any check fails.

1. **QA report exists:** Check for `docs/issues/open/ISSUE-ID/qa_report.md`. If absent, stop: "QA report not found. Run /pf-qa first."

2. **QA verdict is PASS:** Read `docs/issues/open/ISSUE-ID/qa_report.md`. Locate the `## Verdict` section and find the verdict line. The verdict line is the last non-empty line that contains `**PASS**` or `**FAIL**`. If the verdict contains `**FAIL**` or no `**PASS**` line is found, stop: "QA did not pass. Fix the blockers listed in qa_report.md and re-run /pf-qa."

3. **On correct branch:** Run `git branch --show-current`. If the result is not `issue/ISSUE-ID`, stop: "Switch to the issue branch first: `git checkout issue/ISSUE-ID`"

---

## Phase 1: Confirm with User

Show the following summary and wait for explicit user confirmation before proceeding:

```
Ready to close ISSUE-ID.

This will:
  • Commit any uncommitted changes on the issue branch
  • Detect parent branch (from git config or fallback to develop/main)
  • Merge issue/ISSUE-ID into <parent-branch> with --no-ff
  • Transfer the issue's Manual test cases into docs/planning/test-plan.md
  • Move docs/issues/open/ISSUE-ID/ → docs/issues/closed/ISSUE-ID/
  • Record LLM usage/cost in docs/issues/closed/ISSUE-ID/usage_report.md
  • Append a closure entry to docs/planning/session-log.md
  • Commit the archive changes

Proceed? (yes/no)
```

If the user does not confirm (answers no or anything other than yes), stop: "Close cancelled. No changes made."

To resume:
1. Make whatever changes prompted you to answer no.
2. Re-run `/pf-close` when you are ready to close this issue.

---

## Phase 2: Pre-Close Cleanup

Run on the issue branch.

1. Run `git status --porcelain`.
2. If the output is non-empty (uncommitted changes exist):
   - Run `git add -A`
   - Run `git commit -m "chore: pre-close cleanup [ISSUE-ID]"`
3. If the output is empty, skip — nothing to commit.

Proceed to Phase 3.

---

## Phase 3: Detect Parent Branch

1. Run `git config branch.issue/ISSUE-ID.merge`. **Self-tracking upstream guard:** if the result is empty, the command fails, or the result equals `refs/heads/issue/ISSUE-ID` itself (a self-tracking upstream set by `git push -u` on the issue branch, never a parent), ignore it and fall through to step 2. Otherwise extract the branch name (strip the `refs/heads/` prefix) and use that as PARENT-BRANCH.
2. Fallback (the git-config value was ignored or unavailable):
   - Run `git branch --list develop`. If `develop` is listed, set PARENT-BRANCH to `develop`.
   - Otherwise set PARENT-BRANCH to `main`.

Proceed to Phase 4.

---

## Phase 4: Merge

1. Run `git checkout PARENT-BRANCH`.
2. Run `git merge --no-ff issue/ISSUE-ID -m "merge: close ISSUE-ID"`.
3. If the merge reports a conflict, stop: "Merge conflict detected. Resolve conflicts, then re-run /pf-close."

   **Recovering from a merge conflict:**
   1. Run `git status` to list the conflicting files.
   2. Open each conflicting file and resolve its conflict markers.
   3. Run `git add <file>` for each file you resolved.
   4. Run `git commit` to complete the merge.
   5. Re-run `/pf-close`. It proceeds normally from Phase 0.

---

## Phase 4.5

Runs after Phase 4 (Merge) and before Phase 5 (Archive Issue Folder), while `docs/issues/open/ISSUE-ID/` still exists. This ordering is required: `/pf-close` resolves the active issue by scanning `docs/issues/open/` alone (see the top of this file). If this phase fails after Phase 5 has already moved the issue folder to `docs/issues/closed/`, a re-run of `/pf-close` reports "No active issue found" and the issue's Manual test cases are lost with no way to recover them. Placed before archiving instead, a failure here leaves the issue folder in `docs/issues/open/`, so the issue is still discoverable and nothing is lost.

**Recovering from a failure inside this phase.** By the time this phase runs, Phase 4 has already checked out PARENT-BRANCH and merged, so a failure here leaves you **on PARENT-BRANCH** with a modified-but-uncommitted `docs/planning/test-plan.md`. A re-run of `/pf-close` does not resume by itself — Phase 0's third check requires the current branch to be `issue/ISSUE-ID` and stops with "Switch to the issue branch first". Recover in this order, and **discard the partial write first — do not try to preserve it**:

1. **Throw the partial write away.** On PARENT-BRANCH, restore the file from the last commit: `git checkout -- docs/planning/test-plan.md`. If this phase had just created the file in this same run so it is still untracked (`git checkout --` then fails with "pathspec did not match"), delete it instead: `rm docs/planning/test-plan.md`. Nothing is lost either way — the rows are re-derived from the issue's own `test_plan.md`, which is the source of truth, and rows promoted by *previous* issues are in the committed version of the file, untouched.
2. `git checkout issue/ISSUE-ID`.
3. Re-run `/pf-close`. It proceeds normally from Phase 0.

**Why discarding is required and not merely tidier.** Keeping the partial write costs you two distinct things, both measured — the first blocks the recovery outright, the second quietly damages history even when the recovery completes:

- **Step 2 aborts outright** when the issue branch was cut before `docs/planning/test-plan.md` existed on PARENT-BRANCH — a very common shape, since every branch older than the file lacks it. Switching would have to delete a file that has local modifications, so git refuses: `error: Your local changes to the following files would be overwritten by checkout: docs/planning/test-plan.md … Aborting`, exit 1. The documented recovery would simply not be executable for those branches.
- **A half-written row is committed into the issue branch's history** even where the checkout does succeed. A preserved partial write makes Phase 2 commit it as `chore: pre-close cleanup [ISSUE-ID]` on the issue branch, so whatever the interrupted run had managed to write — possibly a row truncated mid-line — becomes a permanent commit, and the branch gains a commit it never did any work for. Phase 4's re-run then creates a **second** merge commit instead of a no-op. There is nothing to gain in exchange: this phase re-derives every row from the issue's own `test_plan.md` on the next run, so the preserved text is never read.

  **This no longer corrupts `Area`** — step 5 keys on the *first* merge that brought the issue in, not on `HEAD`, precisely so that a second merge cannot change the file set it measures — whether that second merge comes from this recovery path or from the operator committing a `test_plan.md` fix under the stop-and-surface rule of the main procedure below. (That rule lives in the numbered procedure that starts after this block; it is not the `git checkout issue/ISSUE-ID` step numbered 2 just above.) Earlier revisions of this phase did compute `Area` from `HEAD`'s parents and did produce a meaningless value here; that is fixed, and this bullet is kept only to explain why discarding is still the right move.

Discarding avoids both: the tree stays clean, Phase 2 has nothing to commit, and Phase 4's re-merge really is `Already up to date` with `HEAD` still pointing at the original merge commit.

Re-running is safe: no row is duplicated, because identity is the pair (`ISSUE-ID`, `TC-NNN`) (step 3 below) and the number is the maximum of the counter and the table plus one (step 4 below).

1. **Ensure `docs/planning/test-plan.md` exists — do this first, before selecting anything.** If it does not exist, create it by copying `docs/planning/templates/global/test-plan.md`. If that template is also missing (an older project that has never been converged), write the file inline with exactly this content instead:

   ```markdown
   # Manual Test Plan

   Ручные тест-кейсы продукта. Автотесты — `make test`.
   Прогон перед релизом: пройти строки со статусом `pending`, начиная с `Critical`.

   Last allocated: none

   | PTC | Area | Test case | Prio | Origin | Last run | Status |
   | --- | --- | --- | --- | --- | --- | --- |
   ```

   **This step runs unconditionally, even when the issue turns out to have no `Manual` rows at all.** It is deliberately ordered before selection because Phase 8's `git add` names `docs/planning/test-plan.md` unconditionally, and `git add` with a single non-existent pathspec exits 128 and stages **nothing at all** — not even the other paths on the same command line. Creating the file only when a row is promoted would therefore break the archive commit of every issue whose test plan is `Auto`-only, leaving the issue moved on disk but never committed. Measured: `git add docs/issues/ docs/planning/session-log.md docs/planning/test-plan.md` with the last path absent → `fatal: pathspec ... did not match any files`, exit 128, empty index.

2. Read `docs/issues/open/ISSUE-ID/test_plan.md`'s Status Tracker table and select only the rows whose `Type` is `Manual`. Rows with `Type: Auto` are never promoted — skip them entirely, including every one of their fields. If the table exists and contains no `Manual` rows, this phase has nothing more to do; proceed to Phase 5 (the file from step 1 stays, empty table and all).

   **Columns are resolved by header name, not by position.** Locate the columns literally named `Type`, `Test Case`, `Priority`, and `Status` in the table's header row, wherever they appear. The repo's own template (`docs/planning/templates/issue/test_plan.md`) orders columns `TC | Type | Test Case | Priority | Status | Remarks`, while the `pf-test-plan` skill generates `TC | Test Case | Type | Priority | Status | Remarks` — both orders exist in real issues and disagree with each other. A parser that reads a fixed column position instead of the header name reads the case title as the `Type` on one of the two orders and promotes nothing.

   **Stop and surface anything you cannot classify — never drop a row silently.** Three malformed inputs are indistinguishable from a legitimate "nothing to promote" if you just skip them, and each one silently discards a manual test case, which is precisely the loss this whole phase exists to prevent. In every one of these cases, **stop and report the problem to the user instead of proceeding to Phase 5**:

   - a row whose `Type` is neither `Manual` nor `Auto` (an empty cell, a different casing like `manual`, or a decorated value like `Manual (blocked)`) — do not treat it as `Auto` by default; a `Critical` manual case must not vanish over a typo;
   - no Status Tracker table found at all (the section is missing, renamed, or its header row does not carry the columns named above) — this is not the same as a table with no `Manual` rows, and must not be reported as such;
   - a selected `Manual` row whose `Test Case` cell is empty — an empty title cannot be made self-contained (see the rule below) and would land in a human-readable checklist as a blank line.

   **When you stop here, say what the operator has to do — the fix is not on the branch they are standing on.** Phase 4 has already merged and switched to PARENT-BRANCH, so the offending `docs/issues/open/ISSUE-ID/test_plan.md` is not what is in front of them. Report the concrete defect (which row, which cell, what is wrong with it) and tell them to: follow "Recovering from a failure inside this phase" above (discard the partial write, `git checkout issue/ISSUE-ID`), **fix the offending row in `test_plan.md` on the issue branch, commit it**, and only then re-run `/pf-close`. Without the fix step spelled out, a re-run simply stops at the same row again — the loop is not obvious from the stop message alone.

3. For each selected `Manual` row not already present in the list, append a row. Identity for "already present" is the pair (`ISSUE-ID`, `TC-NNN`) — never the case title: two `Manual` cases in the same issue may share a title and must still get separate `PTC` numbers and separate rows.

   | Issue field | → | List field |
   |---|---|---|
   | case title | → | `Test case` (see self-containedness rule below) |
   | `Priority` | → | `Prio` (see normalization below) |
   | `Status` `[ ]` / `✓` / `✗` | → | `Status` `pending` / `✓` / `✗` |
   | ISSUE-ID + TC-NNN | → | `Origin`, formatted `ISSUE-ID#TC-NNN` (not a filesystem path) |
   | the issue's closing date, when `Status` is not `pending` | → | `Last run` (`—` when `pending`) |
   | — | → | `PTC` (see numbering below) |
   | — | → | `Area` (see below) |

   **Priority normalization.** `Critical`→`Critical`, `High`→`High`, `Medium`→`Med`, `Low`→`Low`. Any value outside this dictionary is normalized to `Med`, and the original value is noted in `Test case` so a closed dictionary doesn't silently swallow an unrecognized priority.

   **Self-containedness.** If a case title only reads in the context of the issue (e.g. "Verify step 3"), expand it into a self-contained phrase when transferring it. Titles that already stand alone are transferred verbatim.

   **Escaping.** Any `|` inside `Area`, `Test case`, or `Origin` is written as `\|` when the row is written. Each cell stays a single line.

4. **PTC numbering.** The next `PTC` number is the maximum of (a) the number in the `Last allocated:` line and (b) the highest `PTC` number already in the table, plus one.

   **If the `Last allocated:` line is missing entirely, recreate it** — do not stop, and do not skip updating it. `BR-4` allows this file to be hand-edited, so the line can simply have been deleted. It is reconstructible: treat the missing counter as `none` (i.e. `0`) for the arithmetic above, which leaves the table's own highest `PTC` as the effective maximum, then write the line back above the table in the form below. Silently proceeding without it is the failure to avoid: a `sed`-style in-place substitution on a file that has no such line succeeds with exit 0 and changes nothing, so the counter would vanish while the row still gets written.

   **Write it as `PTC-` followed by exactly four digits, zero-padded** — `PTC-0001`, never a bare `1` and never `PTC-1`. This applies to both the `PTC` cell of the new row and the `Last allocated:` line. A fresh list starts at `Last allocated: none`, which counts as **0** for the arithmetic above, so the first number ever allocated is `PTC-0001`. Stating the written form here is not redundant with the arithmetic: a real close of a fresh list, run against an earlier revision of this phase that specified only "maximum … plus one", produced the row `| 1 | general | … |` and the counter `Last allocated: 1` — arithmetically right, and rejected by the project's own format validator, which requires exactly four digits. Both sources matter: the `Last allocated:` counter still remembers a number whose row was later deleted by hand (e.g. a `retired` row removed manually), while the table still remembers rows written by a previous run that was interrupted before it could update the counter. After writing the new row(s), update `Last allocated:` to the new highest number.

5. **Area.** Derive it from the file list of **the first merge commit that brought this issue into PARENT-BRANCH**, not from whatever `HEAD` happens to be:

   ```
   MERGE=$(git log --merges --format=%H --grep "merge: close ISSUE-ID" PARENT-BRANCH | tail -1)
   git diff --name-only "$MERGE^1" "$MERGE^2"
   ```

   `git log` lists newest first, so `tail -1` picks the **earliest** such merge. On a clean run that merge is `HEAD` itself — the fresh commit Phase 4 just made — so this is exactly `git diff --name-only HEAD^1 HEAD^2` and nothing changes.

   **Why not just `HEAD^1 HEAD^2`.** A retry can put a *second* merge on PARENT-BRANCH, and then `HEAD`'s parents no longer describe the issue's file set. This is reachable through the stop-and-surface rule in step 2: it tells the operator to fix the offending row in `test_plan.md` **on the issue branch and commit it**, which gives the branch a new commit, so Phase 4's re-run really does merge again. `HEAD^1 HEAD^2` then contains nothing but that one `docs/issues/…/test_plan.md` fix — which the exclusion below drops — leaving `Area: general` for every promoted row instead of the issue's real subsystem. Measured on a throwaway repo: naive form → `docs/issues/open/ISS/test_plan.md` only (→ `general`); first-merge form → that plus `skills/pf-close/SKILL.md` (→ `pf-close`). Keying on the first merge is stateless and needs no reset of the parent branch.

   **Do not use the three-dot form** `git diff --name-only PARENT-BRANCH...issue/ISSUE-ID` — after Phase 4's `--no-ff` merge, the merge-base of the two branches has become the tip of `issue/ISSUE-ID` itself, so a three-dot diff at this point always returns an empty file list (measured on a real close: 0 files vs. 15 files for the `HEAD^1 HEAD^2` form on the same repository state). Exclude any paths under `docs/issues/`, **plus exactly these four bookkeeping files and no others**: `docs/planning/session-log.md`, `docs/planning/decisions.md`, `docs/planning/implementation-plan.md`, and `docs/planning/test-plan.md`. None of the four describes a product subsystem, and excluding them keeps a row from being labelled the meaningless `Area: docs` when the merge diff happens to contain nothing else.

   **The exclusion is that named list — not a glob, and not the directory.** Two ways of over-reaching are both wrong here:
   - `docs/planning/*.md` would also swallow real documentation that lives at the same level — in this repository `FRAMEWORK.md`, `QUICKSTART.md`, `MIGRATION-GUIDE-V3.md` and `v2.0-design-analysis.md`. An issue whose whole change is rewriting `FRAMEWORK.md` would then get `Area: general`, which is precisely the meaningless value the exclusion exists to prevent.
   - Excluding the `docs/planning/` tree would additionally swallow `docs/planning/templates/`, which holds real product artifacts of this framework — the issue that added `docs/planning/templates/global/test-plan.md` did product work there. **Subdirectories of `docs/planning/` are never excluded.**

   Of the remaining paths, take the second path segment for anything under `skills/` or `tools/` (e.g. `skills/pf-close/…` → `pf-close`), and the first segment for everything else (e.g. `scripts/…` → `scripts`). The segment with the most files wins; if nothing remains after the exclusions, use `general`.

6. Leave the updated `docs/planning/test-plan.md` in the working tree — it is committed on Phase 8, whose `git add` now includes this path.

---

## Phase 5: Archive Issue Folder

1. Ensure `docs/issues/closed/` directory exists. If it does not, create it (e.g. `mkdir -p docs/issues/closed/`).
2. Move `docs/issues/open/ISSUE-ID/` to `docs/issues/closed/ISSUE-ID/` (e.g. `mv docs/issues/open/ISSUE-ID docs/issues/closed/ISSUE-ID`).

Proceed to Phase 6.

---

## Phase 6: Compute LLM Usage & Cost

This phase produces `docs/issues/closed/ISSUE-ID/usage_report.md`, a best-effort record of which LLMs worked the issue and roughly how many tokens / dollars that took. Treat every number here as approximate — never invent a figure that isn't backed by real data.

**Codex runtime adapter.** A Codex session has no Claude Code transcript to scan.
Do not treat the absence of `~/.claude/projects/...` as an error and do not invoke
the Claude-only `claude-api` skill. Use `usage.md` for any manually recorded Codex
session data; when it is absent, report that Codex usage was not recorded rather
than estimating it.

1. **Find the issue's start time.** Run:
   ```
   git log --reverse --format=%aI -- docs/issues/open/ISSUE-ID | head -1
   ```
   This is START-TS — the issue lived under `docs/issues/open/ISSUE-ID` throughout its history (Phase 5's move to `closed/` is still uncommitted at this point, and the archive commit is not made until Phase 8, so the `closed/` path does not yet exist in git history). If it returns nothing, skip auto-computation (step 2) and go straight to step 3 with a note that the window could not be determined.

2. **Auto-compute Claude usage from local transcripts when running in Claude Code.**
   - Transcript directory: `~/.claude/projects/<cwd-with-slashes-replaced-by-dashes>/` (e.g. `pwd` of `/home/stac/dev/planning-framework` → `-home-stac-dev-planning-framework`). If this directory doesn't exist, skip to step 3.
   - For every `*.jsonl` file in that directory, read each line as JSON, keep entries where `.type == "assistant"` and `.timestamp >= START-TS`, dedupe by `.message.id` (a single API response can appear more than once in the log), then group by `.message.model` and sum `.message.usage.input_tokens`, `.cache_creation_input_tokens`, `.cache_read_input_tokens`, and `.output_tokens`.
   - A small inline `jq` (or Node.js) script run via the runtime command tool is the right tool for this — don't try to do the aggregation by eye.
   - **Caveat to carry into the report:** this time-window heuristic captures *all* Claude Code activity in this project directory during the window, not just this issue. If the user worked on something else in parallel, note that the figure may be inflated.
   - For pricing, invoke the `claude-api` skill to get current per-model $/Mtok rates and compute an approximate cost. If that skill is unavailable or a model's price can't be found, report the token counts only and mark cost as "unavailable — pricing table not found" rather than guessing.

3. **Merge manual entries for other LLMs.** Check for `docs/issues/closed/ISSUE-ID/usage.md`. This is a convention where any agent (Gemini, Qwen, or a human) can append a session entry as work happens, e.g.:
   ```
   ## Session: 2026-06-25
   - Model: gemini-2.5-pro
   - Tokens: input 12000, output 3400
   - Cost: ~$0.08
   ```
   If the file exists, parse and include its entries verbatim (labeled "manual") in the report. If it doesn't exist, note that no non-Claude usage was logged.

4. **Write `docs/issues/closed/ISSUE-ID/usage_report.md`** with a table like:

   ```
   # LLM Usage — ISSUE-ID

   | Source | Model | Input tok | Output tok | Cache tok | Approx cost | Notes |
   |---|---|---|---|---|---|---|
   | auto  | claude-sonnet-5 | 120,000 | 8,400 | 340,000 | ~$1.42 | window: 2026-06-25T.. → close |
   | manual | gemini-2.5-pro  | 12,000  | 3,400 | —       | ~$0.08 | from usage.md |

   **Total approx cost:** ~$1.50

   _Auto figures cover all Claude Code activity in this project directory during the issue window, not solely this issue — treat as an upper bound if other work overlapped._
   ```

   If no data was available from either source, write the file stating that plainly instead of omitting it.

Proceed to Phase 7.

---

## Phase 7: Update Session Log

1. Read `docs/planning/session-log.md`.
2. Determine a one-line summary:
   - Try to read `docs/issues/closed/ISSUE-ID/qa_report.md` — use the issue title from the `**Issue ID:**` line or any summary text in the report.
   - If that yields nothing useful, read `docs/issues/closed/ISSUE-ID/prompt.md` and use its first heading or first non-empty line.
   - If neither is available, use `ISSUE-ID` as the summary.
3. Append the following line to `session-log.md` (at the end of the file):

   ```
   [Claude Code] ✓ [ISSUE-ID](../issues/closed/ISSUE-ID/) — <one-line summary> · LLM usage: see [usage_report.md](../issues/closed/ISSUE-ID/usage_report.md)
   ```

   If Phase 6 found no usage data at all, omit the "LLM usage" clause.
4. Write the updated content back to `docs/planning/session-log.md`.

Proceed to Phase 8.

---

## Phase 8: Archive Commit

1. Run `git add docs/issues/ docs/planning/session-log.md docs/planning/test-plan.md`.
2. Run `git commit -m "close: archive ISSUE-ID"`.

Proceed to Phase 8.5.

---

## Phase 8.5: Push Parent Branch (safe auto-push)

After the archive commit, push PARENT-BRANCH to its remote automatically — but only when it is safe. This step never aborts the closure: the issue is already closed locally, so any push problem is reported in Phase 9, not fatal.

1. **Safety guard — skip the push (and record the reason for the Phase 9 report) if either holds:**
   - PARENT-BRANCH is `main` or `master` — release branches are pushed by the user manually, never automatically.
   - No git remote is configured (`git remote` prints nothing).
2. **Resolve the remote:** use PARENT-BRANCH's configured remote (`git config branch.PARENT-BRANCH.remote`); if unset, use `origin` when it exists, otherwise skip per the guard above.
3. **Push, safely:** run `git push <remote> PARENT-BRANCH` (add `-u` if the branch has no upstream yet). Never use `--force` / `--force-with-lease`, never `--no-verify`.
4. **On push failure** (auth, non-fast-forward, network): do NOT abort — the closure is already committed locally. Capture the git error and surface it in the Phase 9 report with an instruction to push manually once resolved.

Proceed to Phase 9.

---

## Phase 9: Report

Print the following closing report:

```
Issue ISSUE-ID closed.

Two commits added to PARENT-BRANCH:
  1. merge: close ISSUE-ID  (merge commit, --no-ff)
  2. close: archive ISSUE-ID  (archive commit)

Issue folder moved to docs/issues/closed/ISSUE-ID/
LLM usage recorded in docs/issues/closed/ISSUE-ID/usage_report.md

Remote push: <report the Phase 8.5 outcome, one of>
  - pushed PARENT-BRANCH to <remote>
  - skipped — PARENT-BRANCH is main/master; push manually for releases
  - skipped — no remote configured; add one and run `git push` when ready
  - FAILED — <git error>; run `git push` manually after resolving
```

---

## Important Notes

- **Auto-push the parent branch on close, but only when safe** (Phase 8.5) — push PARENT-BRANCH to its remote automatically if a remote is configured AND the parent is not `main`/`master`. Never force-push, never `--no-verify`. If no remote exists or the parent is a release branch, skip with a note; if the push errors, report it but keep the closure (already committed locally). Releases to `main`/`master` are always pushed by the user manually.
- **Verdict check is strict** — only `**PASS**` (bold, exact casing) in the Verdict section satisfies the prerequisite. A commented-out or unchecked PASS does not count.
- **No-ff merge is required** — `--no-ff` preserves the issue branch history as a distinct line in the log.
- **If merge fails for reasons other than conflict** (e.g. branch not found, wrong parent), report the git error verbatim and stop.
- **Archive commit uses `docs/issues/`** not just `docs/issues/closed/` so that the removal of the `open/` entry is staged as well.
- **Usage numbers are approximate, never fabricated.** Auto-computed Claude figures come only from real transcript data (`~/.claude/projects/.../*.jsonl`); non-Claude figures come only from a manually maintained `usage.md` in the issue folder. If a number can't be derived from one of those two sources, the report says so — it does not estimate or guess.
- **The auto-computed window is a heuristic, not exact attribution** — it sums all Claude Code activity in this project directory between the issue's first commit and close time, so overlapping unrelated work will inflate it.
