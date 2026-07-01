---
name: pf-close
description: Close the active issue — merge branch, archive issue folder, update session-log
version: 3.0.0
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
  • Move docs/issues/open/ISSUE-ID/ → docs/issues/closed/ISSUE-ID/
  • Record LLM usage/cost in docs/issues/closed/ISSUE-ID/usage_report.md
  • Append a closure entry to docs/planning/session-log.md
  • Commit the archive changes

Proceed? (yes/no)
```

If the user does not confirm (answers no or anything other than yes), stop: "Close cancelled. No changes made."

---

## Phase 2: Pre-Close Cleanup

Run on the issue branch.

1. Run `git status --porcelain`.
2. If the output is non-empty (uncommitted changes exist):
   - Run `git add -A`
   - Run `git commit -m "chore: pre-close cleanup [ISSUE-ID]"`
3. If the output is empty, skip — nothing to commit.

---

## Phase 3: Detect Parent Branch

1. Run `git config branch.issue/ISSUE-ID.merge`. If this returns a value such as `refs/heads/develop`, extract the branch name (strip the `refs/heads/` prefix). Use that as PARENT-BRANCH.
2. If the command returns nothing or fails:
   - Run `git branch --list develop`. If `develop` is listed, set PARENT-BRANCH to `develop`.
   - Otherwise set PARENT-BRANCH to `main`.

---

## Phase 4: Merge

1. Run `git checkout PARENT-BRANCH`.
2. Run `git merge --no-ff issue/ISSUE-ID -m "merge: close ISSUE-ID"`.
3. If the merge reports a conflict, stop: "Merge conflict detected. Resolve conflicts manually on PARENT-BRANCH, then re-run /pf-close."

---

## Phase 5: Archive Issue Folder

1. Ensure `docs/issues/closed/` directory exists. If it does not, create it (e.g. `mkdir -p docs/issues/closed/`).
2. Move `docs/issues/open/ISSUE-ID/` to `docs/issues/closed/ISSUE-ID/` (e.g. `mv docs/issues/open/ISSUE-ID docs/issues/closed/ISSUE-ID`).

---

## Phase 6: Compute LLM Usage & Cost

This phase produces `docs/issues/closed/ISSUE-ID/usage_report.md`, a best-effort record of which LLMs worked the issue and roughly how many tokens / dollars that took. Treat every number here as approximate — never invent a figure that isn't backed by real data.

1. **Find the issue's start time.** Run:
   ```
   git log --reverse --format=%aI -- docs/issues/closed/ISSUE-ID | head -1
   ```
   This is START-TS. If it returns nothing, skip auto-computation (step 2) and go straight to step 3 with a note that the window could not be determined.

2. **Auto-compute Claude usage from local transcripts.**
   - Transcript directory: `~/.claude/projects/<cwd-with-slashes-replaced-by-dashes>/` (e.g. `pwd` of `/home/stac/dev/planning-framework` → `-home-stac-dev-planning-framework`). If this directory doesn't exist, skip to step 3.
   - For every `*.jsonl` file in that directory, read each line as JSON, keep entries where `.type == "assistant"` and `.timestamp >= START-TS`, dedupe by `.message.id` (a single API response can appear more than once in the log), then group by `.message.model` and sum `.message.usage.input_tokens`, `.cache_creation_input_tokens`, `.cache_read_input_tokens`, and `.output_tokens`.
   - A small inline Python (or `jq`) script run via Bash is the right tool for this — don't try to do the aggregation by eye.
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

---

## Phase 8: Archive Commit

1. Run `git add docs/issues/ docs/planning/session-log.md`.
2. Run `git commit -m "close: archive ISSUE-ID"`.

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

Remote push: run `git push` when ready.
```

---

## Important Notes

- **Do NOT push automatically** — always leave `git push` to the user.
- **Verdict check is strict** — only `**PASS**` (bold, exact casing) in the Verdict section satisfies the prerequisite. A commented-out or unchecked PASS does not count.
- **No-ff merge is required** — `--no-ff` preserves the issue branch history as a distinct line in the log.
- **If merge fails for reasons other than conflict** (e.g. branch not found, wrong parent), report the git error verbatim and stop.
- **Archive commit uses `docs/issues/`** not just `docs/issues/closed/` so that the removal of the `open/` entry is staged as well.
- **Usage numbers are approximate, never fabricated.** Auto-computed Claude figures come only from real transcript data (`~/.claude/projects/.../*.jsonl`); non-Claude figures come only from a manually maintained `usage.md` in the issue folder. If a number can't be derived from one of those two sources, the report says so — it does not estimate or guess.
- **The auto-computed window is a heuristic, not exact attribution** — it sums all Claude Code activity in this project directory between the issue's first commit and close time, so overlapping unrelated work will inflate it.
