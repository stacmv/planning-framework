# Implementation Plan — Fixture (TC-014, forward-complete)

## Overview

Fixture for `pf_execute_task_has_test`'s happy path, Task-Type aware
(Check 2 / Check 2b). Every task carries a valid test mapping: `code` tasks
via a non-empty **Mapped Test Cases:** field, the `tests` task via a
`TC-\d+` literal named in its own **Acceptance Criteria:** — never via its
(deliberately empty) **Mapped Test Cases:** field.

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

---

#### Task 3: Gamma tests

**Task Type:** tests
**Mapped Test Cases:** нет — infrastructure task, see Acceptance Criteria
**Files:**
- `test/gamma.sh` - new

**Acceptance Criteria:**
- [x] TC-004 harness implemented; helper steps pass
