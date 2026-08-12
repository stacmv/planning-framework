# Manual Test Plan

Ручные тест-кейсы продукта. Автотесты — `make test`.
Прогон перед релизом: пройти строки со статусом `pending`, начиная с `Critical`.

Last allocated: PTC-0012

| PTC | Area | Test case | Prio | Origin | Last run | Status |
| --- | --- | --- | --- | --- | --- | --- |
| PTC-0011 | pf-close | Родительская ветка определяется при self-tracking upstream | Critical | 20260729-bug-pf-close-parent-branch#TC-004 | 2026-08-06 | ✓ |
| PTC-0012 | explorer-ui | Тема сохраняется между перезагрузками страницы | High | 20260806-feat-product-test-plan#TC-020 | — | pending |
| PTC-0012 | scripts | Конвергенция создаёт test-plan.md из шаблона, если файла нет | High | 20260806-feat-other-branch#TC-011 | — | pending |
