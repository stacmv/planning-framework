---
name: pf-qa
description: Run QA checks from .qa-workflow.md, confirm manual items, and produce qa_report.md with PASS/FAIL verdict
version: 3.0.0
---

Determine the active issue from `docs/issues/open/`. Check prerequisites: `manual_test_checklist.md` must exist inside the issue folder. If it does not exist, stop: "Testing stage is not complete. Run /pf-test first."

---

## Phase 0: Load QA Workflow

1. Read `.qa-workflow.md` from the project root.
2. If `.qa-workflow.md` is absent:
   - Warn: "`.qa-workflow.md` not found. Run `/pf-qa-setup` to create one for this project."
   - Fall back to a minimal built-in checklist:
     - (a) Git working tree clean check: run `git status --porcelain` — pass if output is empty.
     - (b) Test suite detection: check for `package.json` (→ `npm test`), `pytest.ini` / `pyproject.toml` (→ `pytest`), `Makefile` with `test` target (→ `make test`), `Cargo.toml` (→ `cargo test`), `go.mod` (→ `go test ./...`). Run the first match found.
   - Proceed with only these built-in checks if no `.qa-workflow.md` exists.
3. If `.qa-workflow.md` is present, proceed to Phase 1.

---

## Phase 1: Command Discovery

Scan `.qa-workflow.md` for runnable commands:

1. Read through the file and identify every fenced code block delimited by ` ```bash ` or ` ```sh `.
2. For each fenced block, look at the nearest preceding heading (`##`, `###`) or bold label (text matching `**...**`) that appears before the block.
3. If that heading or label contains any of these trigger words (case-insensitive): **Automated**, **Commands**, **Lint**, **Test**, **Security**, **Build**, **Format** — the block is a runnable block.
4. Extract every non-empty, non-comment line from runnable blocks. Lines starting with `#` are comments — skip them. Lines that are only illustrative alternatives (e.g. `# or: yarn lint`) are comments — skip them.
5. Collect the resulting command list. Deduplicate: if the same command string appears more than once, keep only the first occurrence.
6. Note: blocks that are entirely comments (all lines start with `#`) mean the project has not customized `.qa-workflow.md` yet — skip those blocks and warn: "No runnable commands found in `.qa-workflow.md`. The file may not be customized for this project."

---

## Phase 2: Run Automated Checks

Run each discovered command (plus any built-in fallback commands from Phase 0):

1. Run each command via Bash, capturing both exit code and stdout/stderr output.
2. Record the result for each command:
   - Exit code 0 → **PASS**
   - Non-zero exit code → **FAIL**
3. Truncate captured output to at most 500 characters per command for the report (keep the last 500 characters if longer, as they typically contain the most relevant error detail).
4. Do not abort on failure — run all commands and collect all results.

---

## Phase 3: Manual Item Confirmation

Find all checklist items (`- [ ]`) in `.qa-workflow.md` that are NOT located inside a runnable block section (i.e., not under a heading or bold label that triggered command extraction in Phase 1).

These items require human confirmation. Present them to the user as a grouped list and ask: "Please review each item below and confirm whether it passes or fails. Respond with the item number and PASS or FAIL."

Example prompt:
```
Manual QA items need your confirmation:

1. No debug code (console.log, debugger, print statements)
2. No commented-out code blocks
3. No unresolved TODOs
4. Feature works as described in the issue
5. All changes committed, no uncommitted work

For each item, reply with: 1 PASS, 2 PASS, 3 FAIL, etc.
```

Wait for the user's response before proceeding to Phase 4.

---

## Phase 4: Write qa_report.md

Compile all results and write `docs/issues/open/ISSUE-ID/qa_report.md` using the following structure:

```markdown
# QA Report

**Issue ID:** ISSUE-ID
**Date:** YYYY-MM-DD
**Agent:** Claude

---

## Automated Checks

| Check | Command | Result | Output |
|-------|---------|--------|--------|
| [label] | `[command]` | ✓ PASS / ✗ FAIL | [truncated output or "—"] |

---

## Manual QA Items

[Reproduce the checklist sections from .qa-workflow.md, replacing `- [ ]` with `- [x]` for PASS items and `- [ ]` for FAIL items, annotating each FAIL with `← FAIL`]

---

## Blockers

[List every item that failed — either automated or manual — with a brief description of what failed. If none, write: _None._]

---

## Verdict

**PASS**
```

Rules for the Verdict section:
- If zero blockers: write `**PASS**` on its own line.
- If any blockers exist: write `**FAIL**` on its own line.
- The verdict must appear as a standalone line (`**PASS**` or `**FAIL**`) so `/pf-close` can detect it with a simple text search.

---

## Phase 5: Report Result

After writing `qa_report.md`, report to the user:

- **If PASS:** "QA passed. Run /pf-close to close the issue."
- **If FAIL:** "QA failed. Fix the blockers listed in `docs/issues/open/ISSUE-ID/qa_report.md` and re-run /pf-qa."

---

## Important Notes

- **Do not close the issue** — that is `/pf-close`'s job. This skill only produces the QA report.
- **Run all automated checks even if some fail** — a complete picture is more useful than stopping at the first failure.
- **The Verdict line must be unambiguous** — write exactly `**PASS**` or `**FAIL**` (bold, on its own line, nothing else on that line).
- **If `.qa-workflow.md` has no runnable commands and no manual items**, note this in the report and set Verdict to PASS with a warning: "No QA checks were defined. Customize `.qa-workflow.md` for meaningful QA coverage."
- **Git status check**: always run `git status --porcelain` as part of automated checks, even if not explicitly listed in `.qa-workflow.md`, and fail if uncommitted changes exist.
