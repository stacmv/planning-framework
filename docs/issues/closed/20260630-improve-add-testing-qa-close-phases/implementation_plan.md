# Implementation Plan: Add Testing, QA and Close Issue Phases

**Issue:** 20260630-improve-add-testing-qa-close-phases
**Date:** 2026-06-30
**Complexity:** Complex (10 tasks, 13 files)

---

## Overview

Extend Planning Framework v3.0 with four new skills (`/pf-test`, `/pf-qa`, `/pf-qa-setup`, `/pf-close`), update two existing skills (`/pf`, `/pf-execute`), add two new templates, update one existing template, and update documentation. All deliverables are Markdown files (SKILL.md, templates, docs).

---

## Files to Create/Modify

**New skill files:**
- `skills/pf-test/SKILL.md`
- `skills/pf-qa/SKILL.md`
- `skills/pf-qa-setup/SKILL.md`
- `skills/pf-close/SKILL.md`

**Modified skill files:**
- `skills/pf/SKILL.md`
- `skills/pf-execute/SKILL.md`
- `skills/pf-update/SKILL.md`

**New templates:**
- `docs/planning/templates/issue/manual_test_checklist.md`
- `docs/planning/templates/issue/qa_report.md`

**Modified templates:**
- `docs/planning/templates/issue/test_plan.md`

**Modified docs:**
- `PLANNING.md`
- `docs/planning/QUICKSTART.md`
- `docs/planning/FRAMEWORK.md`

---

## Implementation Tasks

### Task 1: Update `test_plan.md` template — add Type column

**Mapped Test Cases:** TC-006 (indirect — checklist only includes Manual rows)
**Files:**
- `docs/planning/templates/issue/test_plan.md` — add `Type: Auto / Manual` field to each test case block and `Type` column to Status Tracker table

**Implementation Notes:**
- Add `**Type:** Auto / Manual` line to each `### TC-NNN` block (after Description, before Preconditions)
- Add `Type` column between `TC` and `Test Case` in the Status Tracker table
- Keep all existing structure intact

**Acceptance Criteria:**
- [x] Each TC block has `**Type:** Auto / Manual` field
- [x] Status Tracker table has `Type` column
- [x] Template renders correctly as Markdown

---

### Task 2: Create new issue templates

**Mapped Test Cases:** TC-006, TC-007, TC-009, TC-010, TC-015
**Files:**
- `docs/planning/templates/issue/manual_test_checklist.md` — standalone checklist for external tester
- `docs/planning/templates/issue/qa_report.md` — structured QA result with verdict

**Implementation Notes — `manual_test_checklist.md`:**
- Header: Feature Name, Issue ID, Date, Tester (blank line)
- "How to use" section: plain English, no framework jargon, no skill names
- One section per Manual TC: Name, Prerequisites, Steps table (Step/Action/Expected Result/Result checkbox), Notes line
- No references to "Planning Framework", "BRD", "specs.md", "/pf-*"

**Implementation Notes — `qa_report.md`:**
- Header: Issue ID, Date, Agent
- Automated Checks table: Check / Command / Result / Output
- Manual QA Items section: checklist copied from `.qa-workflow.md`
- Blockers section: list of failing items
- Verdict line: `**PASS**` or `**FAIL**` — must be last line of the verdict section so `/pf-close` can detect it

**Acceptance Criteria:**
- [x] `manual_test_checklist.md` contains no framework terminology (TC-007)
- [x] `qa_report.md` has clear `Verdict: PASS / FAIL` line (TC-010 — enables `/pf-close` check)

**Completed:** 2026-06-30 — Created `docs/planning/templates/issue/manual_test_checklist.md` (standalone tester checklist, no framework jargon) and `docs/planning/templates/issue/qa_report.md` (automated checks table, manual QA items from .qa-workflow.md, blockers section, and parseable `**PASS**`/`**FAIL**` verdict line).

---

### Task 3: Update `/pf-execute` — branch creation as first step

**Mapped Test Cases:** TC-001, TC-002
**Files:**
- `skills/pf-execute/SKILL.md` — prepend branch creation block before Phase 1

**Implementation Notes:**
- New "Phase 0: Branch Setup" section at top of SKILL.md
- Steps: detect ISSUE-ID from active issue folder name, check `git branch --list issue/ISSUE-ID`, create or checkout accordingly
- If branch creation fails (e.g., dirty working tree): stop with clear error message
- After branch setup, proceed to existing Phase 1 (Task Creation) unchanged

**Acceptance Criteria:**
- [ ] SKILL.md Phase 0 section creates branch when absent (TC-001)
- [ ] SKILL.md Phase 0 section checkouts existing branch without error (TC-002)

---

### Task 4: Create `/pf-test` skill

**Mapped Test Cases:** TC-003, TC-004, TC-005, TC-006, TC-007
**Files:**
- `skills/pf-test/SKILL.md`

**Implementation Notes:**
- Prerequisite guard: `test_plan.md` must exist; if not, stop with message
- Detect project test runner: check `package.json` → `npm test`; `Makefile` → `make test`; `pyproject.toml` / `pytest.ini` → `pytest`; `composer.json` → `./vendor/bin/phpunit`; fallback: ask user
- Run test suite; capture stdout/stderr
- Scan test files on current branch for TC-ID patterns: `TC-NNN` in function names, comments, or describe blocks → map to Status Tracker rows
- Update Status Tracker: matched rows → ✓ or ✗; unmatched Auto rows → aggregate note
- If any Auto test fails: write `test_results.md` with failure summary; stop; do NOT create `manual_test_checklist.md`
- If all pass (or no Auto TCs): extract all `Type: Manual` rows from Status Tracker → generate `manual_test_checklist.md` using the new template format (standalone, no jargon)
- Report: X auto passed / Y mapped to TCs / Z manual pending

**Acceptance Criteria:**
- [ ] Stops with clear message when `test_plan.md` absent (TC-003)
- [ ] Does not create `manual_test_checklist.md` when any Auto test fails (TC-004)
- [ ] Updates Status Tracker row for TC-ID annotated tests (TC-005)
- [ ] `manual_test_checklist.md` contains only Manual TC rows (TC-006)
- [ ] `manual_test_checklist.md` contains no framework terminology (TC-007)

---

### Task 5: Create `/pf-qa` skill

**Mapped Test Cases:** TC-008, TC-009, TC-010
**Files:**
- `skills/pf-qa/SKILL.md`

**Implementation Notes:**
- Prerequisite: `manual_test_checklist.md` must exist (TESTING stage complete); if not, stop
- Read `.qa-workflow.md` from project root; if absent: warn + suggest `/pf-qa-setup` + offer minimal built-in checklist (git status clean, test runner pass)
- Command discovery: scan sections whose headers contain "Automated", "Commands", "Lint", "Test", "Security", "Build"; extract fenced bash blocks; run each command
- Present remaining manual checklist items to user for confirmation (interactive)
- Write `qa_report.md`: Automated Checks table, Manual QA Items with statuses, Blockers list, Verdict line (`**PASS**` or `**FAIL**`)
- Verdict = FAIL if any automated command exits non-zero OR any manual item marked as failed

**Acceptance Criteria:**
- [ ] Warns gracefully + offers fallback when `.qa-workflow.md` absent (TC-008)
- [ ] Runs discovered commands and populates `qa_report.md` (TC-009)
- [ ] `qa_report.md` has clear `Verdict: PASS / FAIL` (TC-010)

---

### Task 6: Create `/pf-qa-setup` skill

**Mapped Test Cases:** TC-011, TC-012
**Files:**
- `skills/pf-qa-setup/SKILL.md`

**Implementation Notes:**
- Detect project type from root files: `package.json` → Node.js, `pyproject.toml`/`requirements.txt` → Python, `go.mod` → Go, `composer.json` → PHP, `Makefile` → Make-based
- Propose commands appropriate for detected type (lint, test, security audit, build)
- Format: readable Markdown with natural language section headers and standard bash fenced blocks — no special machine syntax required
- If `.qa-workflow.md` already exists: read it, show diff of proposed additions, ask user to confirm before writing — never silently overwrite
- Sections: Automated Checks (with commands), Manual Checks (checklist items), Project-Specific (placeholder for custom checks)

**Acceptance Criteria:**
- [ ] Detects Node.js and proposes `npm run lint`, `npm test`, `npm audit` (TC-011)
- [ ] Updates existing file non-destructively, preserving custom content (TC-012)

---

### Task 7: Create `/pf-close` skill

**Mapped Test Cases:** TC-010 (gate), TC-013, TC-014, TC-015, TC-016
**Files:**
- `skills/pf-close/SKILL.md`

**Implementation Notes:**
- Prerequisites: `qa_report.md` must exist AND contain `**PASS**` verdict; if FAIL or absent, stop with message listing blockers
- Git sequence (exact order):
  1. Commit any uncommitted changes on issue branch: `git add . && git commit -m "chore: pre-close cleanup"` (skip if nothing to commit)
  2. Detect parent branch: check `git config branch.<issue-branch>.merge`; fallback to `develop`, then `main`
  3. `git checkout <parent-branch>`
  4. `git merge --no-ff issue/ISSUE-ID -m "merge: close ISSUE-ID"`
  5. Move `docs/issues/open/ISSUE-ID/` → `docs/issues/closed/ISSUE-ID/`
  6. Append to `docs/planning/session-log.md`: `[Agent] ✓ [ISSUE-ID](../issues/closed/ISSUE-ID/) — <one-line summary>`
  7. `git add docs/issues/ docs/planning/session-log.md`
  8. `git commit -m "close: archive ISSUE-ID"`
- Report: issue closed, two commits on parent, remote push left to developer

**Acceptance Criteria:**
- [ ] Refuses when `qa_report.md` absent or verdict = FAIL (TC-010 gate, TC-010)
- [ ] SKILL.md specifies `--no-ff` merge flag (TC-013)
- [ ] Issue folder moved to `closed/` with no remnant in `open/` (TC-014)
- [ ] One-line entry appended to `docs/planning/session-log.md` (TC-015)
- [ ] Exactly two new commits on parent branch after close (TC-016)

---

### Task 8: Update `/pf` — add TESTING, QA, CLOSED stage detection

**Mapped Test Cases:** TC-017, TC-018
**Files:**
- `skills/pf/SKILL.md`

**Implementation Notes:**
- Step 5 (Detect completed stages): add three new rows to the detection table:
  - `manual_test_checklist.md` present → TESTING
  - `qa_report.md` present → QA
  - issue folder in `closed/` → CLOSED (edge case: shouldn't appear in active scan, but handle gracefully)
- Step 6 (Determine next step): extend all three workflow tables with post-IMPL_PLAN steps:

  ```
  | IMPL_PLAN complete | /pf-test |
  | TESTING complete   | /pf-qa   |
  | QA complete        | /pf-close |
  ```
- Apply to all three type tables (feat, improve, bug)

**Acceptance Criteria:**
- [ ] `/pf` shows TESTING stage and suggests `/pf-qa` when `manual_test_checklist.md` present (TC-017)
- [ ] `/pf` shows QA stage and suggests `/pf-close` when `qa_report.md` present (TC-018)

---

### Task 9: Update `/pf-update` — include new skills

**Mapped Test Cases:** (no direct TC — completeness)
**Files:**
- `skills/pf-update/SKILL.md`

**Implementation Notes:**
- Add `pf-test`, `pf-qa`, `pf-qa-setup`, `pf-close` to the list of skills the update command manages
- Verify the existing copy mechanism covers new skill directories

**Acceptance Criteria:**
- [ ] All four new skills listed in `/pf-update` skill roster

---

### Task 10: Update documentation

**Mapped Test Cases:** (no direct TC — completeness)
**Files:**
- `PLANNING.md` — extend workflow diagrams to show TESTING → QA → CLOSE; add stage descriptions; add new skills to skill reference
- `docs/planning/QUICKSTART.md` — add `/pf-test`, `/pf-qa`, `/pf-qa-setup`, `/pf-close` to skill table; update workflow diagram
- `docs/planning/FRAMEWORK.md` — add "Full Lifecycle" section covering all stages end-to-end

**Implementation Notes:**
- Keep changes minimal and consistent with existing doc style
- Workflow diagrams use the same ASCII format already in PLANNING.md

**Acceptance Criteria:**
- [ ] `PLANNING.md` shows complete workflow for all three issue types including close
- [ ] `QUICKSTART.md` skill table lists all 9+ skills with one-line descriptions

---

## Task Dependencies

```
Wave 1 (independent, start here):
  Task 1 — test_plan.md template
  Task 2 — new templates (manual_test_checklist, qa_report)
  Task 3 — pf-execute update

Wave 2 (after Wave 1):
  Task 4 — pf-test     (references template format from Task 1 & 2)
  Task 5 — pf-qa       (references qa_report format from Task 2)
  Task 6 — pf-qa-setup (independent of other skills)
  Task 7 — pf-close    (references qa_report verdict format from Task 2)

Wave 3 (after Wave 2):
  Task 8 — pf orchestrator  (all new stages must be defined first)
  Task 9 — pf-update        (all new skills must exist)
  Task 10 — documentation   (all skills must be final)
```

## Complexity

**Complex** — 10 tasks, 13 files, 3 waves. Each individual task is straightforward (Markdown authoring), but the skills must be internally consistent with each other (stage markers, file names, git commands).
