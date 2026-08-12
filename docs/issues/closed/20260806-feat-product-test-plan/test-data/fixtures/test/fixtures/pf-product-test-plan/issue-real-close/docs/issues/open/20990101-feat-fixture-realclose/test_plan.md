# Test Plan: Fixture — real /pf-close protocol run (pf-product-test-plan, TC-014)

Fixture for the TC-014 manual `/pf-close` protocol (`test_plan.md`, "TC-014").
Not a real issue. Read-only in this repository; materialized fresh into an
isolated, remote-less repo copy for the manual protocol run and never opened
against the real repository (`test_plan.md`, "Manual-кейсы").

TC-001 (`Type: Manual`) is the row a real `/pf-close` run is expected to
promote into `docs/planning/test-plan.md` — its title is written to already
read as a self-contained phrase, so the promoted row can be judged without
following its `Origin`. TC-002 (`Type: Auto`) exists so the same run can prove
that an Auto case produces zero rows, not just that a Manual case produces one.

## Status Tracker

| TC     | Test Case                                                | Type   | Priority | Status | Remarks |
| ------ | --------------------------------------------------------- | ------ | -------- | ------ | ------- |
| TC-001 | Ручной экспорт отчёта сохраняет выбранный формат файла   | Manual | Critical | ✓      |         |
| TC-002 | Фоновая пересборка поискового индекса не блокирует UI    | Auto   | High     | ✓      |         |
