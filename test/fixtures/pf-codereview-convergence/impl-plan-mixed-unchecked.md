# Implementation Plan — Fixture (CR-005, mixed Manual+Auto unchecked line)

## Overview

Task 2's Acceptance Criteria line names TWO TC-IDs together: TC-001
(`Manual`) and TC-002 (`Auto`), per the companion
`impl-plan-mixed-unchecked-test-plan.md`'s Status Tracker. A line naming a
mix of Manual and non-Manual TC-IDs must still block — the carve-out only
applies when EVERY TC-ID a line names is Manual.

## Tasks

#### Task 1: Alpha

**Task Type:** code
**Mapped Test Cases:** TC-003
**Files:**
- `alpha.sh` - new

**Acceptance Criteria:**
- [x] TC-003 passes

---

#### Task 2: Beta

**Task Type:** code
**Mapped Test Cases:** TC-001, TC-002
**Files:**
- `beta.sh` - new

**Acceptance Criteria:**
- [x] Beta implemented
- [ ] TC-001/TC-002 — verified together (one Manual, one Auto)
