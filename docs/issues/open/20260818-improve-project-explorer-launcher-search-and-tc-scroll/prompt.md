---
doc_language: Russian
---

Доработки Project Explorer (`tools/manual-test-ui`), обнаруженные при
`/pf-user-docs` для `20260806-feat-project-explorer-redesign`
(`code_review.md`, CR-014, deferred — не блокирует закрытие того issue).

## Что не так

1. **Поиск на сетке карточек проектов не реализован.** `brd.md` того issue,
   AC-01a: «сетка карточек проектов **с поиском**» — явно обещано в BRD, но
   в `public/launcher.js`/`public/index.html` нет ни `search`, ни `filter` (0
   совпадений при grep). Не регресс — фича никогда не была реализована в
   рамках того issue, хотя BRD её требовал.

2. **`ptcId` из инбокса не всегда попадает в нужный TC при переходе в чек-лист.**
   Формат `ptcId` на уровне продукта (`PTC-NNNN`, из
   `docs/planning/test-plan.md`) не совпадает с форматом TC-ID внутри
   отдельного issue (`TC-NNN`, из его собственного
   `manual_test_checklist.md`). Клик по элементу инбокса иногда приземляется
   на правильную issue/таб, но не прокручивает и не подсвечивает нужный
   тест-кейс — сравнение форматов молча не совпадает, без явной ошибки.

## Что не нужно делать

- Не трогать `lib/checklist.js`'s `parseChecklist()` looseSections-баг — он
  уже заведён как Known Issue в `test_plan.md` того issue и намеренно вне
  скоупа (specs.md §1 того issue).
