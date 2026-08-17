# Code Review Report

**Issue ID:** 20260806-feat-project-explorer-redesign
**Date:** 2026-08-17
**Reviewer(s):** Claude

---

## Findings Ledger

| ID | Round | Priority | Description | Follow-up Issue | State |
|----|-------|----------|--------------|------------------|-------|
| CR-001 | 1 | P0 | Клиент потерял возможность записывать Result/Notes ручных TC — регресс базовой, существующей функции инструмента. `public/workspace.js`'s `renderTcPanelHtml` рендерит шаги чек-листа как статичный текст (`☑`/`☐` + note), без единого `<input>`/чекбокса/обработчика; ни один клиентский файл не вызывает `PATCH .../checklist/steps` или `.../checklist/notes`. Серверные роуты и `patchStepResult`/`patchNotes` не тронуты и юнит-тестируются, но вызвать их из браузера теперь нечем. Сценарий: тестировщик открывает роль «Тестировщик», `manual_test_checklist.md` — отметить шаг выполненным или вписать Result невозможно. |  | open |
| CR-002 | 1 | P0 | Таб «Дела» на клиенте — заглушка (`workspace.js`: «Содержимое этой вкладки появится отдельной задачей»); весь human-task UI (AC-05a/c/d/e/g) не реализован, хотя серверный API (`GET .../human-tasks`, `POST .../complete`, `POST .../reassign`) полностью готов и протестирован. Единственный способ поставить задачу в очередь `done`/переназначить актора — ручной HTTP-запрос напрямую к серверу, никакого UI-действия нет. Ни одна задача implementation_plan.md явно не назначала построение этого UI. |  | open |
| CR-003 | 1 | P0 | CSS не покрывает значительную часть новой разметки — ключевые контейнеры вообще без стилей: `.doc-panel`, `.project-card`/`.project-card-name`/`.project-card-meta`, `.inbox-item`/`.inbox-item-label`/`.inbox-item-instruction`/`.inbox-item-meta`, `.inbox-tabs`/`.inbox-panels`/`.inbox-section-title`, `.inbox-empty`/`.inbox-error`/`.inbox-loading`, `.workspace-field`/`.workspace-field--issue`/`.workspace-field--role`, `.role-select`/`.issue-select`, `.checklist-body`, `.field-label` — ни одного правила в `style.css`. Открыв `#/` или `#/p/<project>/i/<issue>`, пользователь увидит частично неоформленную разметку. Прямое нарушение AC-02f/g/h, с высокой вероятностью проваливает ручную приёмку TC-012. |  | open |
| CR-004 | 1 | P1 | Human-review-задачи (`roles.<key>.review: [human]`) никогда не попадают в очередь и не блокируют закрытие issue — противоречит AC-05a/AC-05d. `lib/roles-resolve.js`'s `resolveRole()` определяет `kind: "human"` только через `write`-актора, никогда не смотрит в `review[]`; то же ограничение продублировано в `skills/pf-close/SKILL.md`'s новой Phase 0-проверке. Ветка `operation: "review"` реально существует и работает в `POST .../complete`, но узнать о существовании такой задачи через UI/API-перечисление нельзя — ни `test/inbox.test.js`, ни `test/human-tasks.test.js` не проверяют review-фикстуру на пути обнаружения. |  | open |
| CR-005 | 1 | P1 | Клик по элементу инбокса не ведёт на нужный документ/таб — AC-04c/TC-020 шаг 3 выполняется лишь частично. `public/inbox.js` строит богатый `where` (`roleId`/`doc`/`ptcId`/`tab`/`stageKey`), но `app.js`'s `optionsFor("inbox")` пробрасывает в навигацию только `target.hash`, остальные поля отбрасываются; `parseRoute()`/`workspace.js`'s `mount()` не умеют принимать роль/таб/ptcId через hash. Клик по ручному TC приводит на нужные проект+issue, но не обязательно на роль «Тестировщик»/таб `manual_test_checklist.md`; клик по human-задаче не переключает на таб «Дела». |  | open |
| CR-006 | 1 | P1 | Действие «Подготовить тестовые данные» (checkout-баннер + кнопки Prepare, старые `kind: "action"` ветки) не имеет замены в новом UI — новый `renderDocPanel` не рендерит никаких действий для этой ветки. Регресс для проектов, полагающихся на этот флоу подготовки фикстур. |  | open |
| CR-007 | 1 | P2 | Проект без единой issue навсегда зависает на «Загрузка…» вместо информативного пустого состояния (`workspace.js`, ветка `state.project ? "Загрузка…" : "Проект не выбран."`). |  | open |
| CR-008 | 1 | P2 | В `style.css` остались мёртвые блоки `.shell`/`.app`/`.topbar`/`.sidebar`/`.content` от старой разметки — на них больше ничего не ссылается. |  | open |
| CR-009 | 1 | P2 | `readonly.test.js`'s проверка AC-05j («нет UI-визарда выбора актора вне единственного action») проходит формально даже в мире, где самого единственного разрешённого action тоже нет — ложная уверенность, стоит иметь в виду при фиксе CR-002. |  | open |
| CR-010 | 1 | P2 | `pf.lastIssue.${project}` в `launcher.js` — потенциальная (маловероятная) коллизия ключей localStorage, если имя проекта содержит `.`. |  | open |

---

## Verdict

**FAIL**
