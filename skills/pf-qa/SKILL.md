---
name: pf-qa
description: Run QA checks from .qa-workflow.md, confirm manual items, and produce qa_report.md with PASS/FAIL verdict
version: 3.0.0
---

Determine the active issue from `docs/issues/open/`. Check prerequisites, in order:

1. **The TESTING stage must have run.** How that is evidenced depends on whether the issue has any `Manual` test cases at all — check `docs/issues/open/ISSUE-ID/test_plan.md`'s Status Tracker for rows whose `Type` is `Manual` (resolve the `Type` column by header name, not by position — see `~/.claude/skills/pf-close/SKILL.md`'s Phase 4.5 for why the two column orders in this repo make position unreliable):

   - **The issue has at least one `Manual` row** — `manual_test_checklist.md` must exist inside the issue folder. If it does not, stop: "Testing stage is not complete. Run /pf-test first."
   - **The issue has no `Manual` rows at all** — `/pf-test` writes no checklist in that case by design (its Phase 5.1: "If there are no Manual rows, skip to Phase 6"), so its absence is the expected outcome, not a missing stage. Do **not** stop. Instead require the evidence that TESTING actually ran: every `Auto` row in the Status Tracker carries a Status of `✓` or `✗` rather than `[ ]`. If any `Auto` row is still `[ ]`, stop with: "Testing stage is not complete — N Auto TC(s) still unprocessed in test_plan.md. Run /pf-test first." (name them).
   - **No Status Tracker table at all** — stop and surface that, rather than reading it as "no Manual rows". A missing table is a malformed test plan, not an Auto-only issue.

   **Why this is not simply "require the file".** An `Auto`-only issue never produces a checklist, so an unconditional file check deadlocks it: `/pf-test` correctly declines to write the file, and `/pf-qa` then refuses to run because the file is absent, with no action available that satisfies both. Measured on `20260806-improve-codereview-convergence`, whose four `Manual` cases were dropped at QA time: the issue became `Auto`-only and had to keep a placeholder `manual_test_checklist.md` purely to get past this check — a file written to satisfy a gate rather than to be read by anyone.
2. For each of `user_docs`, `dev_docs`: resolve the role for that key per `~/.claude/skills/pf-roles/SKILL.md` (§4's fallback order), reading `docs/issues/open/ISSUE-ID/prompt.md`'s frontmatter (`roles:`/`profile:`). If the resolved role is `skip` (explicit, via a profile's point-specific entry, or via the tier-default fallback for `size_tier: trivial`/`small`), this key's file requirement does not apply — move on to the next key. Otherwise `docs/issues/open/ISSUE-ID/user_docs.md` (respectively `dev_docs.md`) must exist and be non-empty. If it is missing or empty, stop with the same pattern as the check above: "User docs stage is not complete. Run /pf-user-docs first." (respectively "Dev docs stage is not complete. Run /pf-dev-docs first.").

**Documentation language:** read the `doc_language` field from `docs/issues/open/ISSUE-ID/prompt.md`'s YAML frontmatter (default: English if absent). Write prose in `qa_report.md` (blocker descriptions, notes) in that language, but keep the report's structural labels and the `**PASS**`/`**FAIL**` verdict markers in English exactly as specified below, since `/pf-close` parses them literally.

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
2. Record the result for each command. **Which signal decides depends on what the command is asserting, and the two shapes are not interchangeable:**

   - **Positive check** — the command does work and succeeds by exiting 0 (`shellcheck …`, `make test`, `git merge-base --is-ancestor …`). Exit code 0 → **PASS**, non-zero → **FAIL**.
   - **Negative check** — the command searches for something that must **not** be there, and succeeds by finding nothing (`git diff … | grep -E "^\+.*TODO"`, `… | grep -iE "…(api[_-]?key|secret|password|token)…"`). Here **no output → PASS, any output → FAIL**, and the exit code is not the signal: `grep` exits 1 precisely when it finds nothing, which is the passing case.

   **Recognising which is which.** A command whose last stage is a `grep`/`rg` search for a forbidden pattern is a negative check. When in doubt, read the checklist item the block sits under: `.qa-workflow.md`'s own items state the expectation in words ("returns zero matches", "returns empty output"), and that wording is authoritative over the exit code.

   **This distinction is not theoretical.** This repository's `.qa-workflow.md` currently defines six negative checks — TODOs, debug output, `curl | sh`, hardcoded secrets, app-code/CI files, and unprocessed test-plan rows. Applying "non-zero exit → FAIL" literally to them reports **six blockers on a completely clean diff**, every one of them false, and a run that should end in `PASS` ends in `FAIL` with nothing wrong. Measured on `20260806-improve-codereview-convergence`. A verdict that inverts on the cleanest possible input is worse than no check: it trains its reader to disbelieve the report.

   **A grep that errors is still a failure.** Exit codes above 1 (`grep` exits 2 on an unreadable file or a bad pattern) are infrastructure failures, not "found nothing" — report those as **FAIL** with the captured stderr, never as a pass. The passing case for a negative check is specifically *exit 1 with empty output*.
3. Truncate captured output to at most 500 characters per command for the report (keep the last 500 characters if longer, as they typically contain the most relevant error detail).
4. Do not abort on failure — run all commands and collect all results.

---

## Phase 3: Manual Item Confirmation

Find all checklist items (`- [ ]`) in `.qa-workflow.md` that are NOT located inside a runnable block section (i.e., not under a heading or bold label that triggered command extraction in Phase 1).

These items require human confirmation. Present them to the user as a grouped list and ask: "Please review each item below and confirm whether it passes or fails. Respond with the item number and PASS or FAIL." Front-loaded check: if `prompt.md`'s `interaction` field resolves to `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule"), apply that rule instead of asking this question interactively. This is a hook site even though it is plain-text confirmation, not a literal `AskUserQuestion` call: the Front-loaded rule generalizes to any point where a stage would otherwise wait for a human reply. Resolution: assume **PASS** for every item with no contraindication in the collected artifacts, recording an explicit `[assumed]` line per item in `open_questions.md` — each such item still appears in `qa_report.md` as an assumed-PASS, never hidden.

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

Wait for the user's response before proceeding to Phase 3.5.

---

## Phase 3.5: Resolve the code-review risk line

Resolve the role for the `code` key per `~/.claude/skills/pf-roles/SKILL.md` (§4's fallback order), reading `docs/issues/open/ISSUE-ID/prompt.md`'s frontmatter. If `roles.code.review == skip`:

- Read the `confirmed:` marker recorded next to `roles.code.review: skip` in `prompt.md`'s frontmatter (written by `/pf` or `pf-codereview` — see `~/.claude/skills/pf-roles/SKILL.md`'s "`code.review: skip`" section).
- This unconditionally produces one risk line for Phase 4's report, verbatim except for the date:
  ```
  ⚠ Risk: code review was skipped for this issue (roles.code.review: skip, confirmed <date>). No independent review of the implementation exists.
  ```

If `roles.code.review` is anything other than `skip`, there is no risk line to add here — proceed to Phase 4 with an empty risk list.

This check runs regardless of whether `code_review.md` shows `verdict: PASS` or `verdict: SKIPPED` — the risk line is about the *role*, not about which verdict a prior stage happened to record.

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

## Risks

[List every risk line produced by Phase 3.5 (and any future risk source), one per line. If none, write: _None._]

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
- **The Risks section never affects the Verdict.** A non-empty Risks section (including the `roles.code.review: skip` line from Phase 3.5) is informational only — it does not turn a `PASS` into a `FAIL` by itself. Only entries in the Blockers section do that.

---

## Phase 5: Report Result

After writing `qa_report.md`, report to the user:

- **If PASS:** "QA passed. Run /pf-close to close the issue."
- **If FAIL:** "QA failed. Fix the blockers listed in `docs/issues/open/ISSUE-ID/qa_report.md` and re-run /pf-qa."

---

## Phase 6: Commit & Push

As the last action of this skill — **after** the verdict is written and reported, on a PASS and on a FAIL alike — run the shared commit & push procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push") for `qa_report.md`. Do not restate the procedure here: it defines what to stage, the commit message (which carries the verdict), the push guard, and the one-line report you append to Phase 5's output.

**Order matters.** This phase runs after Phase 3's git-status check, never before it: committing earlier would let this skill's own artifact — or worse, an unrelated dirty worktree — satisfy the very check that exists to catch it. That is also why the shared procedure stages `qa_report.md` by path instead of `git add -A`.

---

## Important Notes

- **Do not close the issue** — that is `/pf-close`'s job. This skill only produces the QA report.
- **Run all automated checks even if some fail** — a complete picture is more useful than stopping at the first failure.
- **The Verdict line must be unambiguous** — write exactly `**PASS**` or `**FAIL**` (bold, on its own line, nothing else on that line).
- **If `.qa-workflow.md` has no runnable commands and no manual items**, note this in the report and set Verdict to PASS with a warning: "No QA checks were defined. Customize `.qa-workflow.md` for meaningful QA coverage."
- **Git status check**: always run `git status --porcelain` as part of automated checks, even if not explicitly listed in `.qa-workflow.md`, and fail if uncommitted changes exist.
