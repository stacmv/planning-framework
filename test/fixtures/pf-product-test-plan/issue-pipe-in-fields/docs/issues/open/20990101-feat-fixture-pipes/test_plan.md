# Test Plan: Fixture — pipe character in a Manual case title (pf-product-test-plan)

Fixture for `test/pf-product-test-plan.sh` TC-009. Not a real issue.
Read-only; copied fresh into a temp dir by `pf_setup_case` for every case
that uses it — never edited in place.

The Test Case title below carries a literal `|`, written here as `\|` — the
same escape ANY markdown table needs for a cell containing a pipe, so this
row is itself valid markdown, not merely a stand-in for one. Phase 4.5 must
carry the real `|` through unescaping-on-read and re-escaping-on-write
without corrupting the row (BR-4, specs.md "Устойчивость к ручной правке").

## Status Tracker

| TC     | Test Case                                    | Type   | Priority | Status | Remarks |
| ------ | --------------------------------------------- | ------ | -------- | ------ | ------- |
| TC-001 | Проверить экспорт: CSV \| JSON \| PDF        | Manual | Medium   | [ ]    |         |
