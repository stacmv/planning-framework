# Test Plan — Fixture (CR-006 fail-closed, no Status Tracker at all)

## Coverage

This test_plan.md has full `### TC-…` detail sections for TC-001 and
TC-002, both fully mapped in `implementation_plan.md`, but NO "## Status
Tracker" heading anywhere in the file. `pf_execute_tc_has_task` must treat
a genuinely absent Status Tracker as a hard failure — not as "zero TCs
named, so coverage is trivially complete" — since the tracker is the rule's
own authoritative source and its absence means this check cannot vouch for
anything at all.

## Test Cases

### TC-001: Alpha behaves as documented

**Description:** Alpha's happy path.

**Priority:** Medium

### TC-002: Beta behaves as documented

**Description:** Beta's happy path.

**Priority:** Medium
