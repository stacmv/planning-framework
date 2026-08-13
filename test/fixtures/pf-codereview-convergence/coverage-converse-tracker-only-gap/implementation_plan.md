# Implementation Plan — Fixture (CR-006 mutation proof, tracker-only gap)

## Overview

Fixture for `pf_execute_tc_has_task`'s CR-006 regression check (Check 3).
TC-003 (see `test_plan.md`'s Status Tracker) is not named in any task's own
`**Mapped Test Cases:**` field below — nobody picked up that requirement,
and it has no `### TC-003` detail section either, so a header-based scan
of `test_plan.md` would never even know TC-003 exists.

## Tasks

#### Task 1: Alpha

**Task Type:** code
**Mapped Test Cases:** TC-001
**Files:**
- `alpha.sh` - new

**Acceptance Criteria:**
- [x] TC-001 passes

---

#### Task 2: Beta

**Task Type:** code
**Mapped Test Cases:** TC-002
**Files:**
- `beta.sh` - new

**Acceptance Criteria:**
- [x] TC-002 passes
