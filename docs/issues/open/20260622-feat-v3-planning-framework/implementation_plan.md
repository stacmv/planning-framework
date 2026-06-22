# Implementation Plan: Planning Framework v3.0

**Date:** 2026-06-22
**Complexity:** Complex
**Mapped to:** test_plan.md TC-001 through TC-016

---

## Overview

Implement Planning Framework v3.0: create the `skills/` directory with 7 skill files,
update templates, write new scripts (setup, update-skills, migrate), slim PLANNING.md,
and update all documentation.

---

## Files to Create

```
skills/pf.md
skills/pf-brd.md
skills/pf-spec.md
skills/pf-check.md
skills/pf-test-plan.md
skills/pf-impl-plan.md
skills/pf-execute.md

scripts/setup-planning-v3.sh
scripts/update-skills.sh
scripts/migrate-v2-to-v3.sh

docs/planning/templates/issue/brd.md
docs/planning/templates/issue/specs.md
docs/planning/templates/issue/test_plan.md
docs/planning/templates/issue/implementation_plan.md   (renamed from implementation-plan.md)
```

## Files to Modify

```
PLANNING.md             (slim to ~200 lines)
CLAUDE.md               (update for v3.0)
CHANGELOG.md            (add v3.0.0 entry)
README.md               (update version + workflow overview)
docs/planning/FRAMEWORK.md    (update with v3.0 workflow)
docs/planning/QUICKSTART.md   (update 5-minute guide)
```

## Files to Delete

```
scripts/create-issue.sh
scripts/close-issue.sh
```

---

## Implementation Tasks

### Wave 1 — Skills (no dependencies)

#### Task 1.1: Create skills/pf.md (orchestrator)
**Mapped Test Cases:** TC-002, TC-003, TC-016
**Files:** `skills/pf.md`
**Notes:**
- Frontmatter: name, description, version: 3.0.0
- Body: scans `docs/issues/open/`, detects stage by which files exist, outputs next command
- Displays version string in output
**Acceptance Criteria:**
- [ ] TC-002 passes (no issue → helpful message)
- [ ] TC-003 passes (feat issue detected, next step shown)
- [ ] TC-016 passes (version visible)

#### Task 1.2: Create skills/pf-brd.md
**Mapped Test Cases:** TC-004
**Files:** `skills/pf-brd.md`
**Notes:**
- Uses AskUserQuestion until 95% confident
- Reads prompt.md, writes brd.md
- NO technical details in output
**Acceptance Criteria:**
- [ ] TC-004 passes

#### Task 1.3: Create skills/pf-spec.md
**Mapped Test Cases:** TC-005
**Files:** `skills/pf-spec.md`
**Notes:**
- Reads brd.md, writes specs.md
- Handles >1500 line split
**Acceptance Criteria:**
- [ ] TC-005 passes

#### Task 1.4: Create skills/pf-check.md
**Mapped Test Cases:** TC-006, TC-008
**Files:** `skills/pf-check.md`
**Notes:**
- Reads latest doc + all predecessors
- Outputs P0/P1/P2 findings, no file writes
**Acceptance Criteria:**
- [ ] TC-006 passes
- [ ] TC-008 passes

#### Task 1.5: Create skills/pf-test-plan.md
**Mapped Test Cases:** TC-007, TC-011, TC-012
**Files:** `skills/pf-test-plan.md`
**Notes:**
- TC-NNN format, status tracker, known issues section
- Works for feat/improve/bug (reads whatever predecessor docs exist)
**Acceptance Criteria:**
- [ ] TC-007 passes

#### Task 1.6: Create skills/pf-impl-plan.md
**Mapped Test Cases:** TC-009
**Files:** `skills/pf-impl-plan.md`
**Notes:**
- Every task maps to TC codes
- Outputs `implementation_plan.md` (underscored)
**Acceptance Criteria:**
- [ ] TC-009 passes

#### Task 1.7: Create skills/pf-execute.md
**Mapped Test Cases:** TC-010
**Files:** `skills/pf-execute.md`
**Notes:**
- Three phases: task creation, wave execution via sub-agents, summary
- Uses TaskCreate / TaskUpdate / TaskGet
**Acceptance Criteria:**
- [ ] TC-010 passes

---

### Wave 2 — Scripts (depends on Wave 1 skills being finalized)

#### Task 2.1: Create scripts/setup-planning-v3.sh
**Mapped Test Cases:** TC-001
**Files:** `scripts/setup-planning-v3.sh`
**Blocked by:** Task 1.1 (needs final skill file list)
**Notes:**
- Creates folder structure, copies skills to `.claude/skills/`, prints success summary
- Interactive: prompts for target directory
**Acceptance Criteria:**
- [ ] TC-001 passes

#### Task 2.2: Create scripts/update-skills.sh
**Mapped Test Cases:** TC-013
**Files:** `scripts/update-skills.sh`
**Notes:**
- `--source <path>` flag; copies skills/ to .claude/skills/; reports [new]/[updated]/[unchanged]
**Acceptance Criteria:**
- [ ] TC-013 passes

#### Task 2.3: Create scripts/migrate-v2-to-v3.sh
**Mapped Test Cases:** TC-014
**Files:** `scripts/migrate-v2-to-v3.sh`
**Notes:**
- Rename `implementation-plan.md` → `implementation_plan.md` in all open issues
- Add `test_plan.md` stub to open issues missing it
- Delete `create-issue.sh`, `close-issue.sh` if present
- Print migration report
**Acceptance Criteria:**
- [ ] TC-014 passes

#### Task 2.4: Delete obsolete scripts
**Mapped Test Cases:** TC-014
**Files:** `scripts/create-issue.sh` (delete), `scripts/close-issue.sh` (delete)
**Notes:** Remove from repo; migrate script handles consumer projects
**Acceptance Criteria:**
- [ ] Files deleted from repo

---

### Wave 3 — Templates (parallel with Wave 2)

#### Task 3.1: Create issue templates (brd, specs, test_plan, implementation_plan)
**Mapped Test Cases:** TC-004, TC-005, TC-007, TC-009
**Files:**
- `docs/planning/templates/issue/brd.md`
- `docs/planning/templates/issue/specs.md`
- `docs/planning/templates/issue/test_plan.md`
- `docs/planning/templates/issue/implementation_plan.md`
**Notes:** Rename existing `implementation-plan.md` template to `implementation_plan.md`
**Acceptance Criteria:**
- [ ] Templates follow structure defined in specs.md section 3

---

### Wave 4 — Documentation (depends on Waves 1–3)

#### Task 4.1: Slim PLANNING.md to ~200 lines
**Mapped Test Cases:** TC-015
**Files:** `PLANNING.md`
**Blocked by:** Wave 1 (can only remove Claude-specific content once skills exist)
**Notes:**
- Remove Claude session start ritual, Claude-specific workflow instructions
- Keep: issue structure, naming, branch strategy, multi-agent tracking, QA gates, global files
- Add `/pf` one-liner
**Acceptance Criteria:**
- [ ] TC-015 passes (≤220 lines, multi-agent content intact)

#### Task 4.2: Update CLAUDE.md, README.md, CHANGELOG.md, FRAMEWORK.md, QUICKSTART.md
**Mapped Test Cases:** (documentation coverage)
**Files:** Listed above
**Notes:**
- CLAUDE.md: reference v3.0 and `/pf` skill
- CHANGELOG.md: v3.0.0 entry
- README.md: new workflow overview, version bump
- FRAMEWORK.md: v3.0 workflow, document types, skill commands
- QUICKSTART.md: 5-minute guide with skill commands

---

## Issue Type Decision Table (for /pf orchestrator logic)

| Detected by prefix | Type | Stage sequence |
|---|---|---|
| `YYYYMMDD-feat-*` | feat | CREATE → BRD → SPEC → check → TEST_PLAN → check → IMPL_PLAN → check → IMPLEMENT → QA → CLOSE |
| `YYYYMMDD-improve-*` | improve | CREATE → BRD → check → TEST_PLAN → check → IMPL_PLAN → check → IMPLEMENT → QA → CLOSE |
| `YYYYMMDD-bug-*` | bug | CREATE → ANALYZE → check → TEST_PLAN → check → IMPL_PLAN → check → IMPLEMENT → QA → CLOSE |

Stage detection (which files exist):
- `prompt.md` only → CREATE done
- `brd.md` present → BRD done
- `specs.md` present → SPEC done
- `test_plan.md` present → TEST_PLAN done
- `implementation_plan.md` present → IMPL_PLAN done

---

## Dependencies

```
Wave 1 (Skills) → Wave 2 (Scripts) → Wave 4 (Docs)
Wave 1 (Skills) → Wave 3 (Templates) [parallel with Wave 2]
Wave 2 + Wave 3 → Wave 4 (Docs)
```

## Complexity Estimate

**Complex** — 7 new skill files, 3 new scripts, 4 new templates, multiple doc updates,
deletion of 2 scripts, and a non-trivial migration script with file rename logic.
