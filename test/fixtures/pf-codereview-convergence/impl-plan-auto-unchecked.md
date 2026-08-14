# Implementation Plan — Fixture (CR-005 mutation proof, auto-unchecked)

## Overview

Negative control for the Manual-TC carve-out (CR-005): Task 2 references
TC-002, an `Auto`-type test case per the companion
`impl-plan-auto-unchecked-test-plan.md`'s Status Tracker. Its unchecked
Acceptance Criteria line MUST still block Check 1 — proving the carve-out
only exempts Manual TCs and does not disable the check itself.

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
- [x] Beta implemented
- [ ] TC-002 passes
