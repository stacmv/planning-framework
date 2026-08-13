# Implementation Plan — Fixture (CR-005, manual-unchecked)

## Overview

Fixture for `pf_execute_all_tasks_checked`'s Manual-TC carve-out (CR-005).
Task 2's Acceptance Criteria references TC-002, a `Manual`-type test case
per the companion `impl-plan-manual-unchecked-test-plan.md`'s Status
Tracker. A still-unchecked line naming only a Manual TC must NOT block
Check 1 — a manual case can only be closed by a live tester run, never by
`/pf-execute` itself.

## Tasks

#### Task 1: Alpha

**Task Type:** code
**Mapped Test Cases:** TC-001
**Files:**
- `alpha.sh` - new

**Acceptance Criteria:**
- [x] TC-001 passes

---

#### Task 2: Beta live verification

**Task Type:** code
**Mapped Test Cases:** TC-002
**Files:**
- `beta.sh` - new

**Acceptance Criteria:**
- [x] Beta implemented
- [ ] TC-002 — verified via live manual run (see test_plan.md TC-002 Steps)
