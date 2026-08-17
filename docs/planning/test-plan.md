# Manual Test Plan

Ручные тест-кейсы продукта. Автотесты — `make test`.
Прогон перед релизом: пройти строки со статусом `pending`, начиная с `Critical`.

Last allocated: PTC-0007

| PTC | Area | Test case | Prio | Origin | Last run | Status |
| --- | --- | --- | --- | --- | --- | --- |
| PTC-0001 | manual-test-ui | Manual Test UI: чтение отказывает символической ссылке, ведущей наружу проекта (среда, где симлинки создаются) | High | 20260812-bug-flaky-manual-test-ui#TC-003 | 2026-08-13 | ✓ |
| PTC-0002 | manual-test-ui | Manual Test UI: на Linux путь проекта в projects.json остаётся POSIX-формой, без принудительной конвертации | Med | 20260812-bug-flaky-manual-test-ui#TC-006 | 2026-08-13 | ✓ |
| PTC-0003 | manual-test-ui | Manual Test UI: домер стабильности набора по диску, TMPDIR, замусоренному temp, серии из 10 и параллельной нагрузке | Med | 20260812-bug-flaky-manual-test-ui#TC-007 | 2026-08-13 | ✓ |
| PTC-0004 | manual-test-ui | Manual Test UI: процедура атрибуции — отличить предсуществующее падение от внесённого правкой | Critical | 20260812-bug-flaky-manual-test-ui#TC-008 | 2026-08-13 | ✓ |
| PTC-0005 | test | Manual-бюджет `/pf-test-plan`: гейт превышения — выбор «Разбить issue» корректно фиксирует в test_plan.md рекомендацию о разбиении и перечисляет лишние кейсы | High | 20260806-improve-manual-test-budget#TC-011 | 2026-08-17 | ✓ |
| PTC-0006 | test | Manual-бюджет `/pf-test-plan`: гейт превышения — выбор «Поднять tier» запрашивает обоснование, обновляет `size_tier` в prompt.md и укладывает Manual-кейсы в новый бюджет | High | 20260806-improve-manual-test-budget#TC-012 | 2026-08-17 | ✓ |
| PTC-0007 | test | Manual-бюджет `/pf-test-plan`: гейт превышения — выбор «Отложить избыток» фиксирует в test_plan.md, какие кейсы отложены и почему, не меняя Status Tracker | High | 20260806-improve-manual-test-budget#TC-013 | 2026-08-17 | ✓ |
