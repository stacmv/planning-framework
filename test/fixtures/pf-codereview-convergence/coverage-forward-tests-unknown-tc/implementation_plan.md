# Implementation Plan — Fixture (Check 2b, tests task names an unknown TC)

## Overview

Fixture for `pf_execute_task_has_test`'s Check 2b tracker-existence
requirement (round 2 code review, Finding 1). Task 2 is `tests`-typed and
names `TC-999` in its own `**Acceptance Criteria:**` — a `TC-\d+` literal is
present and syntactically well-formed (enough to satisfy the OLD, pre-fix
rule), but `TC-999` has NO row at all in the companion `test_plan.md`'s
Status Tracker. Naming a literal is not enough on its own: the case it
names must actually exist, or Check 2b must still block — this is the exact
gap a prior round of `/pf-codereview` found unverified by every check in
the completeness gate (Check 2b accepted the literal; Check 3, sourced from
the Status Tracker, never saw `TC-999` either).

## Tasks

#### Task 1: Alpha

**Task Type:** code
**Mapped Test Cases:** TC-001
**Files:**
- `alpha.sh` - new

**Acceptance Criteria:**
- [x] TC-001 passes

---

#### Task 2: Beta tests

**Task Type:** tests
**Mapped Test Cases:** нет — infrastructure task, see Acceptance Criteria
**Files:**
- `test/beta.sh` - new

**Acceptance Criteria:**
- [x] TC-999 harness implemented; helper steps pass
