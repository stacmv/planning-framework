# Implementation Plan — Fixture (TC-013, one unchecked)

## Overview

Fixture for `pf_execute_all_tasks_checked`. Identical to
`impl-plan-all-checked.md` except one Acceptance Criteria item under Task 2
is still `- [ ]` — the completeness gate's Check 1 must name it and refuse
to consider this plan done.

## Tasks

#### Task 1: Alpha

**Task Type:** code
**Mapped Test Cases:** TC-001
**Files:**
- `alpha.sh` - new

**Acceptance Criteria:**
- [x] TC-001 passes
- [x] Alpha behaves as documented

---

#### Task 2: Beta tests

**Task Type:** tests
**Mapped Test Cases:** нет — infrastructure task, see Acceptance Criteria
**Files:**
- `test/beta.sh` - new

**Acceptance Criteria:**
- [x] TC-002 harness implemented
- [ ] Helper steps pass
