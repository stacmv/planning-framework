# Implementation Plan — Fixture (TC-015, converse-gap)

## Overview

Fixture for `pf_execute_tc_has_task`'s negative control (Check 3). See also
TC-004 for background on why this Overview paragraph exists at all — that
mention is prose, in the plan's Overview, not inside any task's own
`**Mapped Test Cases:**` field, and must NOT count as a mapping. No task
below names `TC-004` in its `**Mapped Test Cases:**` field: this is the
requirement from `test_plan.md` that nobody picked up.

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
**Mapped Test Cases:** TC-002, TC-003
**Files:**
- `beta.sh` - new

**Acceptance Criteria:**
- [x] TC-002 passes
- [x] TC-003 passes
