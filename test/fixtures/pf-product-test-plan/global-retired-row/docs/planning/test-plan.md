# Manual Test Plan

Ручные тест-кейсы продукта. Автотесты — `make test`.
Прогон перед релизом: пройти строки со статусом `pending`, начиная с `Critical`.

Last allocated: PTC-0005

| PTC | Area | Test case | Prio | Origin | Last run | Status |
| --- | --- | --- | --- | --- | --- | --- |
| PTC-0001 | pf-close | Родительская ветка определяется при self-tracking upstream | Critical | 20260729-bug-pf-close-parent-branch#TC-004 | 2026-08-06 | ✓ |
| PTC-0002 | explorer-ui | Тема сохраняется между перезагрузками страницы | High | 20260729-improve-manual-test-data#TC-020 | — | pending |
| PTC-0003 | scripts | Функция конвергенции, потерявшая смысл после рефакторинга | Med | 20260701-old-issue-fixture#TC-002 | 2026-07-15 | retired |
| PTC-0004 | pf-test | Ручной прогон QA чек-листа перед релизом | Low | 20260705-another-issue-fixture#TC-003 | 2026-07-20 | ✓ |
| PTC-0005 | pf-close | Проверка мерджа родительской ветки при закрытии | High | 20260710-issue-x-fixture#TC-001 | 2026-07-25 | ✗ |
