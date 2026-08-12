# Test Plan: Fixture — mixed Type/Priority/Status (pf-product-test-plan)

Fixture for `test/pf-product-test-plan.sh` TC-001/TC-002/TC-003. Not a real
issue. Read-only; copied fresh into a temp dir by `pf_setup_case` for every
case that uses it — never edited in place.

The Status Tracker below deliberately uses the column order
`TC | Test Case | Type | Priority | Status | Remarks` — the same order
`~/.claude/skills/pf-test-plan/SKILL.md` Step 4 generates, and the ONE order
that traps a positional (not header-name) column parser: reading the second
column as `Type` on this order would read a case title instead and select
zero `Manual` rows.

## Status Tracker

| TC     | Test Case                             | Type   | Priority | Status | Remarks |
| ------ | -------------------------------------- | ------ | -------- | ------ | ------- |
| TC-001 | Background compilation check           | Auto   | Critical | ✓      |         |
| TC-002 | Critical priority case                 | Manual | Critical | [ ]    |         |
| TC-003 | High priority case                     | Manual | High     | ✓      |         |
| TC-004 | Medium priority case                   | Manual | Medium   | ✗      |         |
| TC-005 | Low priority case                      | Manual | Low      | [ ]    |         |
| TC-006 | Nonstandard priority case              | Manual | Urgent   | [ ]    |         |
