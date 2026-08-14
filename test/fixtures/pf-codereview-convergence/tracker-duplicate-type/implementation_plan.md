# Implementation Plan — Fixture (Check 1, duplicate Status Tracker row, CR-015)

## Overview

Fixture for `pf_execute_all_tasks_checked`'s Manual-TC carve-out (CR-005)
under a MALFORMED, duplicated Status Tracker row (round 3 code review,
CR-015). The companion `test_plan.md` lists `TC-001` TWICE in its Status
Tracker — first as `Type: Manual`, then as `Type: Auto`. Task 1's
Acceptance Criteria has an unchecked line naming only `TC-001`. A helper
that reads only the FIRST matching row would see `Manual` and let this
line through the carve-out; the fix requires ALL rows for a named case to
exist and to say exactly `Manual` before the carve-out applies — so this
line must still block.

## Tasks

#### Task 1: Alpha

**Task Type:** code
**Mapped Test Cases:** TC-001
**Files:**
- `alpha.sh` - new

**Acceptance Criteria:**
- [x] Alpha implemented
- [ ] TC-001 passes
