# Implementation Plan — Fixture (TC-014, forward-gap)

## Overview

Fixture for `pf_execute_task_has_test`'s two independent negative controls
(Check 2 / Check 2b). Task 3's own `**Mapped Test Cases:**` field is empty
even though its `**Description:**` mentions `TC-004` in prose — см. также
TC-004 — that prose mention must NOT count as a mapping (the prior BRD
review's P0 on reversed direction between TC-014 and TC-015). Task 4 is a
`tests`-typed task whose `**Mapped Test Cases:**` field is also empty, by
the same convention every `tests` task in this repository follows, but it
names `TC-005` inside its own `**Acceptance Criteria:**` — the Task-Type-
aware branch (Check 2b) that must NOT be flagged.

## Tasks

#### Task 1: Alpha

**Task Type:** code
**Mapped Test Cases:** TC-001
**Files:**
- `alpha.sh` - new

**Acceptance Criteria:**
- [x] TC-001 passes

---

#### Task 3: Gamma

**Task Type:** code
**Description:** Implements the gamma widget; см. также TC-004 для контекста — this is prose, not the `Mapped Test Cases:` field, and must not be read as a mapping.
**Mapped Test Cases:**
**Files:**
- `gamma.sh` - new

**Acceptance Criteria:**
- [ ] Gamma behaves as documented

---

#### Task 4: Delta tests

**Task Type:** tests
**Mapped Test Cases:** нет — infrastructure task, see Acceptance Criteria
**Files:**
- `test/delta.sh` - new

**Acceptance Criteria:**
- [x] TC-005 harness implemented; helper steps pass
