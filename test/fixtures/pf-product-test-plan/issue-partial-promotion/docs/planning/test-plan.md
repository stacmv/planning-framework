# Manual Test Plan

Ручные тест-кейсы продукта. Автотесты — `make test`.
Прогон перед релизом: пройти строки со статусом `pending`, начиная с `Critical`.

Last allocated: PTC-0005

| PTC | Area | Test case | Prio | Origin | Last run | Status |
| --- | --- | --- | --- | --- | --- | --- |
| PTC-0001 | pf-close | Родительская ветка определяется при self-tracking upstream | Critical | 20260729-bug-pf-close-parent-branch#TC-004 | 2026-08-06 | ✓ |
| PTC-0002 | explorer-ui | Тема сохраняется между перезагрузками страницы | High | 20260729-improve-manual-test-data#TC-020 | — | pending |
| PTC-0003 | scripts | Конвергенция создаёт test-plan.md из шаблона, если файла нет | High | 20260806-feat-product-test-plan#TC-011 | — | pending |
| PTC-0004 | scripts | Конвергенция никогда не перезаписывает существующий test-plan.md | High | 20260806-feat-product-test-plan#TC-012 | — | pending |
| PTC-0005 | pf-close | Дубликат PTC между параллельными ветками обнаруживается | Critical | 20260806-feat-product-test-plan#TC-007 | — | pending |
| PTC-0006 | reporting | Ручной экспорт данных сохраняет выбранный диапазон дат | Critical | 20990101-feat-fixture-partial#TC-001 | 2026-08-11 | ✓ |
