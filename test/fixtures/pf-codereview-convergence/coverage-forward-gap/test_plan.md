# Test Plan — Fixture (TC-014, forward-gap)

## Coverage

TC-001 is mapped to Task 1. TC-004 is mentioned only in Task 3's prose
description, never in any task's `**Mapped Test Cases:**` field — a
negative control. TC-005 is named in Task 4's `**Acceptance Criteria:**`
(Task 4 is `tests`-typed; its `**Mapped Test Cases:**` field stays empty by
convention) and has a real Status Tracker row below, so Check 2b's
tracker-existence cross-reference (round 2 code review, Finding 1) finds it
and does not flag Task 4.

## Status Tracker

| TC     | Test Case | Type   | Priority | Status | Remarks |
| ------ | --------- | ------ | -------- | ------ | ------- |
| TC-001 | Alpha behaves as documented | Auto | Medium | [ ] | |
| TC-004 | Gamma behaves as documented | Auto | Medium | [ ] | |
| TC-005 | Delta harness | Auto | Medium | [ ] | |

## Test Cases

### TC-001: Alpha behaves as documented

**Description:** Alpha's happy path.

**Priority:** Medium

### TC-004: Gamma behaves as documented

**Description:** Gamma's happy path — nobody picked this up in
`implementation_plan.md`'s `Mapped Test Cases:` field.

**Priority:** Medium

### TC-005: Delta harness

**Description:** Infrastructure harness for Delta.

**Priority:** Medium
