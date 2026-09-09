# Notes — 20260818-improve-project-explorer-launcher-search-and-tc-scroll

## What & Why

Две доработки Project Explorer (`tools/manual-test-ui`), отложенные при закрытии
`20260806-feat-project-explorer-redesign` (CR-014, CR-015).

**1. Поиск на сетке карточек проектов.** `brd.md` того issue (AC-01a) обещал
«сетку карточек проектов **с поиском**», но поиска нет: в `public/` нет ни
одного `<input>` и ни одной подстрочной фильтрации. Это не регресс — фича
никогда не была сделана.

**2. Переход из инбокса не приземляется на нужный тест-кейс.**
`maybeScrollToPtcId()` (`public/workspace.js:1777`) ищет
`[data-tc-id="<ptcId>"]`, но `data-tc-id` заполняется issue-локальным `TC-NNN`
(`lib/checklist.js:77`), а приходит продуктовый `PTC-NNNN`
(`lib/inbox.js:192`). Совпадения не бывает никогда — скролл структурно мёртв, о
чём в коде уже есть честный комментарий (`workspace.js:1554-1558`).

Чинить это дёшево: колонка `Origin` в `docs/planning/test-plan.md` имеет вид
`ISSUE-ID#TC-NNN`, и `ORIGIN_RE` (`lib/inbox.js:65`) **уже** захватывает
`TC-NNN` вторым разом — но `match[2]` отбрасывается, наружу уходит только
склеенная строка `origin`. Нужен проброс одного поля, новых источников данных
не требуется.

## Acceptance Criteria

- AC-1: На главном экране над сеткой есть поле поиска. Ввод подстроки
  оставляет только проекты, у которых совпало имя **или** ID хотя бы одного
  открытого issue; сравнение регистронезависимое.
- AC-2: Секция без совпадений скрывается целиком; при пустом результате
  показывается внятное сообщение вместо пустого экрана. Пустой ввод —
  показываются все проекты.
- AC-3: Строка поиска не переживает перезагрузку (в отличие от ролевого
  фильтра): поиск — разовое действие.
- AC-4: Поиск добавляется только на сетку (`renderLauncherProjectSections`).
  Выпадающий список проектов в шапке (`renderProjectSelector`) не меняется,
  хотя и делит с сеткой общий `renderProjectSections()`.
- AC-5: Поле доступно с клавиатуры и озвучивается: `<input type="search">` со
  связанным label, результат фильтрации сообщается через live-region.
- AC-6: Клик по элементу инбокса приземляется на нужный `TC-NNN` внутри
  чек-листа issue: страница прокручивается к нему и он временно подсвечивается.
- AC-7: Когда `Origin` не разобран или соответствующего TC в чек-листе нет,
  поведение остаётся сегодняшним — переход на правильную вкладку без скролла,
  без ошибки в консоли.

## Tasks

- [ ] Failing-тест на AC-6 первым: проверяет, что после перехода из инбокса
      выбран элемент с `data-tc-id="TC-NNN"`, а не `PTC-NNNN`
      (`tools/manual-test-ui/test/workspace.test.js`).
- [ ] `lib/inbox.js`: в `collectManualTests()` отдавать `tcId: match[2]`
      рядом с `ptcId`/`origin`.
- [ ] Пробросить `tcId` по цепочке: `public/inbox.js` (`manualTestItemView`) →
      `public/app.js` (`inboxTargetHash`, `parseRoute`) → `public/workspace.js`
      (`initialPtcId` → скролл по `tcId`).
- [ ] `workspace.js`: скроллить по `tcId`, добавить временную подсветку
      найденного TC; снять устаревший комментарий про «no-op dressed up as a
      feature». Сохранить feature-detection (тесты идут на фейковом DOM).
- [ ] `public/launcher.js` + `public/project-picker.js`: поле поиска и чистая
      функция фильтрации (по образцу `filterInboxItemsByRoles`,
      `inbox.js:199`), отделённая от DOM.
- [ ] CSS для поля поиска и подсветки TC; проверить контраст во всех темах.
- [ ] Тесты: фильтрация и скрытие пустых секций
      (`test/launcher.test.js`, `test/project-picker.test.js`), проброс `tcId`
      (`test/inbox.test.js`), a11y-инвариант (`test/a11y.test.js`),
      покрытие новых CSS-классов (`test/css-class-coverage.test.js`).

## Out of scope

- `parseChecklist()`'s looseSections-баг — заведён как Known Issue в
  `test_plan.md` предыдущего issue, намеренно вне скоупа.
- Поиск в выпадающем списке проектов в шапке (см. AC-4).
- Обратная связь TC → PTC: в `manual_test_checklist.md` ссылки на PTC нет,
  связь существует только односторонне, в колонке `Origin` продуктового
  тест-плана.
