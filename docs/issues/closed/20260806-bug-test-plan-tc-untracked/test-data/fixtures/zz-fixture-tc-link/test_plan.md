# Test Plan: zz-fixture-tc-link

Fixture plan. Three `Auto` cases, each shaped to discriminate one way the
matching rule can be got wrong.

---

## Test Cases

### TC-001: every label of a case passes

Two checks. The second one's `if` and `else` branches carry **different**
text, so the failure-form string exists in the source but is never printed.
Expected: `✓`.

**Type:** Auto
**Priority:** High

### TC-002: one label fails while another passes

Two checks: the first passes, the second fails unconditionally.
Expected: `✗` — one failing label fails the whole case.

**Type:** Auto
**Priority:** Critical

### TC-003: declared Auto, but nothing prints a label for it

No check anywhere prints a label for this case, while an unrelated suite in
the same run does print its own `TC-003` labels.
Expected: stays `[ ]`, and the stage stops naming it.

**Type:** Auto
**Priority:** High

---

## Status Tracker

| TC     | Test Case | Type   | Priority | Status | Remarks |
| ------ | --------- | ------ | -------- | ------ | ------- |
| TC-001 | every label of a case passes | Auto | High | [ ] | |
| TC-002 | one label fails while another passes | Auto | Critical | [ ] | |
| TC-003 | declared Auto, but nothing prints a label for it | Auto | High | [ ] | |
