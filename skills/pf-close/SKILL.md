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

## Phase 6: Update Session Log

1. Read `docs/planning/session-log.md`.
2. Determine a one-line summary:
   - Try to read `docs/issues/closed/ISSUE-ID/qa_report.md` — use the issue title from the `**Issue ID:**` line or any summary text in the report.
   - If that yields nothing useful, read `docs/issues/closed/ISSUE-ID/prompt.md` and use its first heading or first non-empty line.
   - If neither is available, use `ISSUE-ID` as the summary.
3. Append the following line to `session-log.md` (at the end of the file):

   ```
   [Claude Code] ✓ [ISSUE-ID](../issues/closed/ISSUE-ID/) — <one-line summary>
   ```

4. Write the updated content back to `docs/planning/session-log.md`.

---

## Phase 7: Archive Commit

1. Run `git add docs/issues/ docs/planning/session-log.md`.
2. Run `git commit -m "close: archive ISSUE-ID"`.

---

## Phase 8: Report

Print the following closing report:

```
Issue ISSUE-ID closed.

Two commits added to PARENT-BRANCH:
  1. merge: close ISSUE-ID  (merge commit, --no-ff)
  2. close: archive ISSUE-ID  (archive commit)

Issue folder moved to docs/issues/closed/ISSUE-ID/

Remote push: run `git push` when ready.
```

---

## Important Notes

- **Do NOT push automatically** — always leave `git push` to the user.
- **Verdict check is strict** — only `**PASS**` (bold, exact casing) in the Verdict section satisfies the prerequisite. A commented-out or unchecked PASS does not count.
- **No-ff merge is required** — `--no-ff` preserves the issue branch history as a distinct line in the log.
- **If merge fails for reasons other than conflict** (e.g. branch not found, wrong parent), report the git error verbatim and stop.
- **Archive commit uses `docs/issues/`** not just `docs/issues/closed/` so that the removal of the `open/` entry is staged as well.
