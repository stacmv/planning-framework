# Implementation Plan: Поиск на сетке проектов + прокрутка к тест-кейсу из инбокса

## Overview

Два независимых долга Project Explorer (`tools/manual-test-ui`): поиск по
подстроке на сетке карточек проектов (AC-01…AC-06) и прокрутка/подсветка
нужного тест-кейса при переходе из инбокса (AC-07, AC-08). Ключевой факт кода:
`collectManualTests()` (`lib/inbox.js`) разбирает `Origin` через `ORIGIN_RE`,
но отдаёт наружу только `issueId` (`match[1]`), теряя issue-локальный `tcId`
(`match[2]`) — а до `maybeScrollToPtcId()` (`public/workspace.js`) сегодня
доходит продуктовый `ptcId` (`PTC-NNNN`), которого в чек-листе
(`data-tc-id="TC-NNN"`) никогда нет. План проносит issue-локальный `tcId` по
всей цепочке и добавляет клиентский поиск проектов на лаунчере, по образцу
`filterInboxItemsByRoles` (`public/inbox.js`).

## Files to Create/Modify

- `tools/manual-test-ui/lib/inbox.js` — `collectManualTests()` возвращает `tcId`.
- `tools/manual-test-ui/public/inbox.js` — `manualTestItemView()` кладёт `tcId` в `where`.
- `tools/manual-test-ui/public/app.js` — `inboxTargetHash()`/`parseRoute()` пробрасывают `tcId=`.
- `tools/manual-test-ui/public/workspace.js` — `mount()`/`maybeScrollToPtcId()` используют `initialTcId`, добавляют подсветку + автосброс.
- `tools/manual-test-ui/public/launcher.js` — состояние и обработчик поиска.
- `tools/manual-test-ui/public/project-picker.js` — новая функция `filterProjectsByQuery`; `renderProjectSections()`/`renderProjectSelector()` не меняются.
- `tools/manual-test-ui/public/style.css` — стили поля поиска и подсветки.
- `tools/manual-test-ui/test/inbox.test.js`, `test/inbox-ui.test.js`, `test/workspace.test.js`, `test/workspace-ui.test.js`, `test/launcher.test.js`, `test/project-picker.test.js`, `test/a11y.test.js`.

## Implementation Tasks

#### Task 1: `collectManualTests()` возвращает issue-локальный `tcId`

**Task Type:** code
**Mapped Test Cases:** TC-004
**Files:**
- `tools/manual-test-ui/lib/inbox.js` - в цикле разбора `Origin` добавить `tcId: match[2]` к объекту, пушимому в `manualTests[]`; обновить JSDoc.

**Implementation Notes:**
- Строка со сломанным `Origin` по-прежнему исключается целиком с тем же `console.warn` — не меняется.

**Acceptance Criteria:**
- [ ] TC-004 шаг 1 (элемент несёт `tcId: "TC-007"`) passes

---

#### Task 2: Пронести `tcId` через `manualTestItemView()` → `inboxTargetHash()` → `parseRoute()` → `workspace.js`

**Task Type:** code
**Mapped Test Cases:** TC-004, TC-005, TC-008
**Files:**
- `tools/manual-test-ui/public/inbox.js` - `manualTestItemView()`: добавить `tcId: item.tcId` в `where` (не убирая `ptcId`).
- `tools/manual-test-ui/public/app.js` - `inboxTargetHash()`: `if (target.tcId) params.set("tcId", target.tcId)`. `parseRoute()`: `initialTcId: query.get("tcId") || null` в `extras`/`NULL_ROUTE_EXTRAS`. `optionsFor()` (`case "workspace"`): `initialTcId: route.initialTcId || undefined`.
- `tools/manual-test-ui/public/workspace.js` - заменить `options.initialPtcId`/`maybeScrollToPtcId` на `initialTcId`; при найденном `[data-tc-id]` дополнительно выставить временный класс подсветки и снять его через `setTimeout` (guard на `typeof setTimeout === "function"`); при не найденном — no-op, без исключения, без notice.

**Implementation Notes:**
- Имя параметра — `tcId=`, не переиспользуем `ptcId=` (продуктовый и issue-локальный номера не смешиваются).
- `stageKey` по-прежнему не пробрасывается — вне скоупа.
- BR-3: не найден кейс → тихая деградация, `scrollIntoView` не вызывается нигде, никакой другой `[data-tc-id]` не подсвечивается.

**Acceptance Criteria:**
- [ ] TC-004 шаги 2-5 passes
- [ ] TC-005 шаги 2-6 passes

---

#### Task 3: Тесты на контракт `tcId`, деградацию и полный клик-путь (read-only)

**Task Type:** tests
**Mapped Test Cases:** TC-004, TC-005
**Files:**
- `tools/manual-test-ui/test/inbox.test.js` - фикстура с валидным `Origin` проверяет `tcId` в результате; фикстура со сломанным `Origin` — исключение строки не регрессирует.
- `tools/manual-test-ui/test/workspace.test.js` - `mount()` с `initialTcId: "TC-007"` и чек-листом без такого TC: правильная вкладка, `scrollIntoView` не вызван, нет notice/error, нет подсветки.
- `tools/manual-test-ui/test/inbox-ui.test.js`/`test/workspace-ui.test.js` - полный путь TC-005: рендер `renderManualTestsSection`/`renderIssueGroup` → `dispatchClick()` на реальном `.inbox-item` → перехват `onNavigate` → `inboxTargetHash()` → `parseRoute()` → `mount()` workspace с `TC-002`+`TC-001` в чек-листе — `scrollIntoView` ровно один раз на `TC-002`, подсветка только там; зафиксировать `fetchImpl`-вызовы за весь сценарий — ни одного не-GET (BR-2).

**Implementation Notes:**
- Переиспользовать существующий `dispatchClick()` из `test/inbox-ui.test.js`/`test/workspace-ui.test.js`.

**Acceptance Criteria:**
- [ ] TC-004, TC-005 — полностью зелёные

---

#### Task 4: Чистая функция поиска по проектам

**Task Type:** code
**Mapped Test Cases:** TC-001
**Files:**
- `tools/manual-test-ui/public/project-picker.js` - экспортировать `filterProjectsByQuery(projects, projectIssuesByName, query)`: пустой (после `trim()`) `query` — вернуть всё; иначе литеральное (без regex), регистронезависимое `toLowerCase().includes()`-совпадение по `project.name` ИЛИ `issueId` хотя бы одного элемента `projectIssuesByName[project.name]` со `status !== "closed"`.

**Implementation Notes:**
- Никакого `new RegExp(query)` — иначе TC-001 шаг 8 (метасимволы, непарные скобки) ломается.

**Acceptance Criteria:**
- [ ] TC-001 (все 8 шагов) passes

---

#### Task 5: Поле поиска на лаунчере — рендер, скрытие пустых секций, сообщение, a11y, непрестистентность

**Task Type:** code
**Mapped Test Cases:** TC-002, TC-003, TC-006, TC-007, TC-009
**Files:**
- `tools/manual-test-ui/public/launcher.js` - в `state` добавить `searchQuery` (по умолчанию `""`, только в памяти модуля — не в `options.storage`/`localStorage`/`sessionStorage`/hash). `renderLauncherProjectSections()`: применить `filterProjectsByQuery(state.projects, state.projectIssues, state.searchQuery)` перед вызовом `renderProjectSections()`; при пустом результате — не вызывать её, вернуть сообщение "нет совпадений" (текст, отличный от "Загрузка…"/"Нет настроенных проектов."). Новая функция рендера: `<label>` (видимый текст, связан через `for`/`id`) + `<input type="search">` с классом-сигналом (напр. `project-search-input`, без `tabindex`/`disabled`/`hidden`) + `aria-live="polite"` регион с числом найденных/сообщением; `input`-обработчик обновляет `state.searchQuery` и вызывает `render()` без обращения к серверу.
- `tools/manual-test-ui/public/style.css` - стили нового `input`/`label`/aria-live-блока (нужны для `test/css-class-coverage.test.js`).

**Implementation Notes:**
- Поле поиска рендерится только в `launcher.js`, до вызова `renderProjectSections()` — `renderProjectSelector()` (шапка других экранов) его не приобретает (AC-05), т.к. `project-picker.js` не меняется.
- Пустая строка после `trim()` (в т.ч. только пробелы) = "показать всё".
- `state.searchQuery` переживает `render()` из `loadProjectIssues()`/`toggleRole()` (обычное поведение состояния модуля) и обнуляется только при новом `mount()`.

**Acceptance Criteria:**
- [ ] TC-002, TC-003, TC-006, TC-007, TC-009 (реализационная часть) passes

---

#### Task 6: Тесты на поиск, рендер, a11y и неизменность шапки/непрестистентность

**Task Type:** tests
**Mapped Test Cases:** TC-001, TC-002, TC-003, TC-006, TC-007, TC-009
**Files:**
- `tools/manual-test-ui/test/project-picker.test.js` - юнит-тесты `filterProjectsByQuery` (TC-001, все 8 шагов); TC-007 (`renderProjectSelector` без поля поиска vs. лаунчер с полем).
- `tools/manual-test-ui/test/launcher.test.js` - TC-002 (пустой ввод/пробелы = всё, `fetchImpl` без не-GET), TC-003 (скрытие секций + отдельное сообщение), TC-009 (переживает `loadProjectIssues()`/`toggleRole()`, отсутствует в storage/hash, новый `mount()` = чистое состояние, независимо от `pf.role`).
- `tools/manual-test-ui/test/a11y.test.js` - TC-006 (input фокусируем без искусственного `tabindex`, `<label>` виден и связан, `aria-live` меняется).

**Implementation Notes:**
- Фикстуры проектов с regex-метасимволами и с закрытыми issue — готовятся in-memory в тесте.
- TC-009 использует те же фейковые `localStorage`/`sessionStorage`/`location.hash`, что и существующие тесты `.role-switch`.

**Acceptance Criteria:**
- [ ] TC-001, TC-002, TC-003, TC-006, TC-007, TC-009 — зелёные под `node --test`

---

#### Task 7: Ручная проверка восприятия скролла и подсветки в браузере

**Task Type:** tests
**Mapped Test Cases:** TC-008
**Files:**
- нет файлов кода — исполняется вручную через `make test-ui`, отмечается в `manual_test_checklist.md` при `/pf-test`.

**Implementation Notes:**
- Механика уже доказана автоматически в Task 3 (TC-005) — здесь только визуальное восприятие и самостоятельное снятие подсветки за ≤10 секунд.

**Acceptance Criteria:**
- [ ] TC-008 отмечен вручную после реального прогона `make test-ui`
