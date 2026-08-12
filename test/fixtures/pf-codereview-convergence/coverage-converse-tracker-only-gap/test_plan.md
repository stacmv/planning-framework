# Test Plan — Fixture (CR-006 mutation proof, tracker-only gap)

## Coverage

TC-001 and TC-002 each have both a Status Tracker row AND a full `### TC-…`
detail section below. TC-003 has a real Status Tracker row but NO
corresponding detail section at all — as if it had been renamed, localized,
or simply never written — and no task in `implementation_plan.md` maps it
either. This is the exact case a header-based reverse-direction scan
(the CR-006 defect) cannot see at all: it would never add TC-003 to its
candidate set in the first place, so it would report full coverage instead
of the real gap.

## Status Tracker

| TC     | Test Case | Type   | Priority | Status | Remarks |
| ------ | --------- | ------ | -------- | ------ | ------- |
| TC-001 | Alpha behaves as documented | Auto | Medium | [ ] | |
| TC-002 | Beta behaves as documented | Auto | Medium | [ ] | |
| TC-003 | Gamma behaves as documented | Auto | Medium | [ ] | no detail section on purpose (CR-006) |

## Test Cases

### TC-001: Alpha behaves as documented

**Description:** Alpha's happy path.

**Priority:** Medium

### TC-002: Beta behaves as documented

**Description:** Beta's happy path.

**Priority:** Medium
