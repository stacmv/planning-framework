# Implementation Plan — Fixture (Check 2, code task names an unknown TC)

## Overview

Fixture for `pf_execute_task_has_test`'s Check 2 tracker-existence
requirement (round 3 code review, CR-013). Task 1 is `code`-typed and
names `TC-999` in its own `**Mapped Test Cases:**` field — a `TC-\d+`
literal is present and syntactically well-formed (enough to satisfy the
OLD, pre-fix rule), but `TC-999` has NO row at all in the companion
`test_plan.md`'s Status Tracker. Task 2 is also `code`-typed and names
`TC-001`, which the companion Status Tracker does carry a row for — this
closes Check 3 (every TC has a task) on its own, so the composite gate's
other two checks stay green and only Check 2's own cross-reference can
catch Task 1 self-certifying against a fabricated case.

## Tasks

#### Task 1: Alpha

**Task Type:** code
**Mapped Test Cases:** TC-999
**Files:**
- `alpha.sh` - new

**Acceptance Criteria:**
- [x] TC-999 passes

---

#### Task 2: Beta

**Task Type:** code
**Mapped Test Cases:** TC-001
**Files:**
- `beta.sh` - new

**Acceptance Criteria:**
- [x] TC-001 passes
