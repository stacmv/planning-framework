# Implementation Plan — Fixture (CR-006 fail-closed, no Status Tracker at all)

## Overview

Both TC-001 and TC-002 are fully mapped below — this fixture isolates the
"tracker missing entirely" case from any real coverage gap. Even with
perfect mapping, `pf_execute_tc_has_task` must still fail on the companion
`test_plan.md` because that file has no "## Status Tracker" heading at all.

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
