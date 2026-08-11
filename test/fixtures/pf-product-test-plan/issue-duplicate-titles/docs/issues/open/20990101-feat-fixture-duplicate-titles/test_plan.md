# Test Plan: Fixture — two Manual cases sharing one title (pf-product-test-plan)

Fixture for `test/pf-product-test-plan.sh` TC-015. Not a real issue.
Read-only; copied fresh into a temp dir by `pf_setup_case` for every case
that uses it — never edited in place.

TC-001 and TC-002 below are byte-identical in `Test Case` on purpose: the
idempotency key Phase 4.5 uses is the pair (`ISSUE-ID`, `TC-NNN`), never the
case title (specs.md, "Идемпотентность") — a helper that keyed on the title
instead would collapse these two rows into one.

## Status Tracker

| TC     | Test Case                                      | Type   | Priority | Status | Remarks |
| ------ | ----------------------------------------------- | ------ | -------- | ------ | ------- |
| TC-001 | Тема сохраняется между перезагрузками страницы | Manual | High     | [ ]    |         |
| TC-002 | Тема сохраняется между перезагрузками страницы | Manual | High     | ✓      |         |
