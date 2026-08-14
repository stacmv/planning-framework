# Test Plan: Fixture — partial-promotion crash recovery (pf-product-test-plan, TC-016)

Fixture for the TC-016 manual `/pf-close` protocol (`test_plan.md`, "TC-016").
Not a real issue. Read-only in this repository; materialized fresh into an
isolated, remote-less repo copy for the manual protocol run and never opened
against the real repository.

Models an issue whose Phase 4.5 crashed right after writing the first row and
before writing the second or updating the counter. TC-001 below is already
reflected as `PTC-0006` in the paired
`docs/planning/test-plan.md` fixture that sits next to this issue folder in
`test/fixtures/pf-product-test-plan/issue-partial-promotion/`, while TC-002 is
not yet promoted anywhere. A re-run of `/pf-close` against this fixture must
find and promote TC-002 without duplicating or renumbering TC-001.

## Status Tracker

| TC     | Test Case                                                | Type   | Priority | Status | Remarks |
| ------ | --------------------------------------------------------- | ------ | -------- | ------ | ------- |
| TC-001 | Ручной экспорт данных сохраняет выбранный диапазон дат   | Manual | Critical | ✓      |         |
| TC-002 | Уведомление об истечении сессии появляется за 5 минут    | Manual | High     | ✓      |         |
