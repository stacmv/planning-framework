# BRD: Add Testing, QA and Close Issue Phases

**Date:** 2026-06-30
**Issue:** 20260630-improve-add-testing-qa-close-phases
**Type:** improve

---

## Problem Statement

Planning Framework v3.0 covers issue lifecycle only through the implementation phase. After `/pf-execute` completes there is no structured guidance for testing, quality assurance, or formally closing the issue. Agents are left without a defined process for the final third of the lifecycle, leading to inconsistent QA practices and ad-hoc issue closure.

---

## Goals

1. Extend the framework lifecycle to cover testing, QA, and closure as first-class phases with dedicated skills
2. Produce a standalone `manual_test_checklist.md` artifact that an external tester can use without knowledge of the framework
3. Enforce QA gate before issue can be closed
4. Make closure deterministic: branch merge + folder move + session-log entry in one skill invocation
5. Add `/pf-qa-setup` skill to create/update `.qa-workflow.md` for a project in a format readable by both humans and AI

## Non-Goals

- CI/CD integration (out of scope — the framework is CI-agnostic)
- Automated test generation (test cases are already in `test_plan.md`)
- Changing how existing phases work
- Moving planning documents to issue branch (planning docs intentionally stay on develop so all open issues are visible from a single checkout)
- Remote push after `/pf-close` (left to the developer; the skill operates locally only)

---

## User Stories

**As an AI agent**, I want to know what to do after implementation completes, so I don't invent an ad-hoc process each session.

**As a developer**, I want QA to be a required gate before closing, so issues aren't closed with failing checks.

**As an external tester**, I want a clean standalone checklist file with only the manual test steps, so I can test without reading framework documents.

**As a developer**, I want `/pf-close` to handle all closure mechanics in one step, so I don't miss moving the folder or updating session-log.

**As a developer**, I want a skill to create and maintain `.qa-workflow.md`, so it stays up-to-date and remains readable by both me and AI agents.

---

## Proposed Solution

### New skills

| Skill | Input | Output | Stage marker |
|---|---|---|---|
| `/pf-test` | `test_plan.md` (done), project test runner | Updated Status Tracker in `test_plan.md` + `manual_test_checklist.md` | TESTING |
| `/pf-qa` | `.qa-workflow.md`, test results | `qa_report.md` | QA |
| `/pf-close` | `qa_report.md` (no blockers) | merged branch, issue moved to `closed/`, session-log entry | CLOSED |
| `/pf-qa-setup` | project root | `.qa-workflow.md` created or updated | — (utility, not a pipeline stage) |

### Stage detection in `/pf`

| File present | Stage |
|---|---|
| `manual_test_checklist.md` | TESTING |
| `qa_report.md` | QA |
| issue folder in `closed/` | CLOSED |

### Updated workflow (all issue types)
```
... → /pf-execute → [IMPL_PLAN done] → /pf-test → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

### Template changes

**`test_plan.md`** — add `Type` column (Auto / Manual) to each test case and to the Status Tracker table. Required for `/pf-test` to split automated from manual cases.

**New template `manual_test_checklist.md`** — standalone format for external tester:
```markdown
# Manual Test Checklist: [Feature Name]

**Issue:** ISSUE-ID
**Date:** YYYY-MM-DD
**Tester:** ___________

## How to use
Check each item as you test. Mark ✓ Pass or ✗ Fail in the Result column.
No framework knowledge required — just follow the steps.

## Test Cases

### TC-NNN: [Test Name]
**Prerequisites:** [What must be set up before testing]
| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1    | ...    | ...             | [ ]    |
**Notes:** ___________
```

**New template `qa_report.md`** — structured QA result:
```markdown
# QA Report: [Feature Name]

**Issue:** ISSUE-ID
**Date:** YYYY-MM-DD
**Agent:** [Claude Code / Gemini CLI / etc.]

## Automated Checks
| Check | Command | Result | Output |
|-------|---------|--------|--------|
| Lint  | npm run lint | ✓ PASS | |
| Tests | npm test | ✓ PASS | 42 passed |
| Security | npm audit | ✓ PASS | 0 vulnerabilities |

## Manual QA Items
[Checklist from .qa-workflow.md with status]

## Blockers
[List any failing items that must be fixed before closing]

## Verdict
**PASS** / **FAIL**
```

---

## `/pf-execute` — Branch Creation (clarification of existing skill)

The first step of `/pf-execute` must be:
1. Check if issue branch already exists (`git branch --list issue/ISSUE-ID`)
2. If not: `git checkout -b issue/ISSUE-ID`
3. If yes: `git checkout issue/ISSUE-ID`

Planning documents (brd.md, specs.md, test_plan.md, implementation_plan.md) remain on develop — this is intentional so all open issues are visible from a single checkout without branch switching.

---

## `/pf-test` Behaviour

### Auto test mapping
Tests written during `/pf-execute` for a specific issue should reference the TC-ID in their name or annotation so `/pf-test` can map results per test case. Convention (any of these is acceptable):
- Function name prefix: `test_TC001_description` / `it_TC001_description`
- Annotation comment: `# TC-001` directly above the test function
- Describe block: `describe('TC-001: ...')`

`/pf-test` scans test files modified in the issue branch for these patterns and maps runner output to TC-IDs.

Tests without TC references are reported as suite-level aggregate (N passed / M failed) in the Status Tracker but not mapped to individual rows.

### Steps
1. Read `test_plan.md` — verify it exists and has test cases
2. Detect project test runner from `package.json`, `Makefile`, `pyproject.toml`, etc.
3. Run test suite; capture output
4. Match TC-ID patterns in output → update Status Tracker rows where `Type = Auto` with result (✓ / ✗)
5. Report aggregate for unmatched tests
6. **If any Auto tests fail: write failure summary to `test_results.md`, stop. Do NOT create `manual_test_checklist.md`.** Fix failing tests in `/pf-execute`, then re-run `/pf-test`.
7. If all Auto tests pass (or no Auto tests): extract all rows where `Type = Manual` → write `manual_test_checklist.md`
8. Report summary: X auto passed / Y manual pending

TESTING stage is marked complete by presence of `manual_test_checklist.md` — so a failed test run does not advance the pipeline.

---

## `/pf-qa` Behaviour

### Command discovery
`/pf-qa` reads `.qa-workflow.md` as-is (the file is human-readable Markdown with bash code blocks). The AI identifies runnable commands from sections whose headers contain words like "Commands", "Automated", "Lint", "Test", "Security", "Build". Each fenced bash block under those sections is a candidate command to run.

If `.qa-workflow.md` does not exist:
- Warn the user: "`.qa-workflow.md` not found. Run `/pf-qa-setup` to create one for this project."
- Offer to run a minimal built-in checklist: git status clean check, basic test runner if detectable

### Steps
1. Read `.qa-workflow.md` from project root
2. Extract and run automatable commands; capture pass/fail
3. Present remaining manual QA items to user for confirmation
4. Write `qa_report.md` with: automated results, manual item statuses, blockers, verdict
5. If verdict = FAIL: list blockers, do not proceed to `/pf-close`

---

## `/pf-qa-setup` Behaviour

Creates or updates `.qa-workflow.md` for the current project. Detects project type (Node.js, Python, Go, PHP, etc.) from project root files and proposes appropriate commands. Format is conversational Markdown — readable by humans and by `/pf-qa` without special parsing. Sections use natural language headers with bash code blocks for commands.

If `.qa-workflow.md` already exists: opens it for review, proposes additions or corrections.

---

## `/pf-close` Behaviour

### Git sequence
1. Verify `qa_report.md` exists and verdict = PASS
2. Commit any uncommitted changes on the issue branch: `git add . && git commit -m "chore: pre-close cleanup"`
3. `git checkout <parent-branch>` (auto-detected: develop or main)
4. `git merge --no-ff issue/ISSUE-ID -m "merge: close ISSUE-ID"` → merge commit
5. Move `docs/issues/open/ISSUE-ID/ → docs/issues/closed/ISSUE-ID/`
6. Append to `docs/planning/session-log.md`:
   `[Agent] ✓ [ISSUE-ID](../issues/closed/ISSUE-ID/) — <one-line summary>`
7. `git add docs/issues/ docs/planning/session-log.md`
8. `git commit -m "close: archive ISSUE-ID"` → archive commit
9. Report: issue closed. Remote push is left to the developer.

Result: two commits on parent branch — merge commit + archive commit. This is intentional and keeps history readable.

---

## Success Criteria

- [ ] `/pf-execute` creates issue branch as first step before any code is written
- [ ] `/pf-test` maps Auto test results to TC-IDs when tests follow TC-ID naming convention
- [ ] `/pf-test` blocks TESTING stage (no `manual_test_checklist.md`) if any Auto test fails
- [ ] `/pf-test` produces `manual_test_checklist.md` with only Manual test cases in standalone format
- [ ] `/pf-qa` reads `.qa-workflow.md` without requiring special machine-readable format
- [ ] `/pf-qa` handles missing `.qa-workflow.md` gracefully (warns + offers fallback)
- [ ] `/pf-qa` produces `qa_report.md` with clear PASS/FAIL verdict
- [ ] `/pf-qa-setup` creates/updates `.qa-workflow.md` detecting project type automatically
- [ ] `/pf-close` refuses to run if `qa_report.md` is missing or verdict = FAIL
- [ ] `/pf-close` uses `--no-ff` merge and produces two clean commits on parent branch
- [ ] `/pf-close` leaves no open-folder remnant and updates session-log
- [ ] `/pf` correctly identifies TESTING and QA stages and suggests right next step
- [ ] `test_plan.md` template has `Type` column (Auto / Manual)
- [ ] `PLANNING.md` documents full lifecycle including new phases

---

## Affected Files

**New skills:**
- `skills/pf-test/SKILL.md`
- `skills/pf-qa/SKILL.md`
- `skills/pf-qa-setup/SKILL.md`
- `skills/pf-close/SKILL.md`

**Modified skills:**
- `skills/pf/SKILL.md` — stage detection + workflow tables for TESTING, QA, CLOSED
- `skills/pf-execute/SKILL.md` — add branch creation as first step
- `skills/pf-update/SKILL.md` — include new skills in update list

**Modified templates:**
- `docs/planning/templates/issue/test_plan.md` — add Type column (Auto/Manual)
- `docs/planning/templates/config/.qa-workflow.md` — ensure format is AI-parseable without special syntax

**New templates:**
- `docs/planning/templates/issue/manual_test_checklist.md`
- `docs/planning/templates/issue/qa_report.md`

**Modified docs:**
- `PLANNING.md` — extend workflow diagrams and stage descriptions to full lifecycle
- `docs/planning/QUICKSTART.md` — update skill reference table with new skills
- `docs/planning/FRAMEWORK.md` — full lifecycle section
