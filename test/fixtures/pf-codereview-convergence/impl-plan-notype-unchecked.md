# Implementation Plan — Fixture (Check 1, tracker row with empty Type column)

## Overview

Negative control for Check 1's tracker cross-reference (round 2 code
review, Finding 1). Task 2 references TC-002, which HAS a row in the
companion `impl-plan-notype-unchecked-test-plan.md`'s Status Tracker — but
that row's `Type` column is empty. An unchecked line naming a TC-ID whose
`Type` column is missing or empty must still block: the Manual carve-out
requires a KNOWN `Type: Manual`, not merely "not provably Auto."

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
