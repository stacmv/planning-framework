## Implementation Plan: Редизайн Project Explorer (`tools/manual-test-ui`)

### Overview

Редизайн переводит `tools/manual-test-ui` с сегодняшней трёхколоночной
раскладки (вкладки ролей + три независимых списка сайдбара, `overflow: hidden`
на `body`, почти нечитаемая тёмная палитра) на двухуровневую навигацию
(лаунчер → рабочее пространство проекта без сайдбара), палитру Pine с
проверенным контрастом и оформление по референсу владельца (панели,
акцентные заголовки, мягкая тональная заливка вместо жёстких grid-линий).
Отдельный содержательный слой — единый инбокс across projects, впервые
объединяющий два типа дел (ручные тест-кейсы `pending` и человеческие
write/review-задачи, назначенные новому актору `human`), и сама реализация
актора `human`: очередь вместо автовыполнения, проверка факта выполнения
(письменный вердикт / существующий закоммиченный артефакт / состояние
ветки), hash-based `stale`-переход, переназначение на llm-актора.

Существующий серверный стек (`http`, без Express) и клиентский стек
(ванильный JS, без сборки) не меняются — редизайн добавляет два новых
серверных модуля (`lib/inbox.js`, `lib/roles-resolve.js`), три новых
API-семейства (`GET /api/inbox`, `GET/POST .../human-tasks`), три новых
клиентских ES-модуля (`public/launcher.js`, `public/workspace.js`,
`public/inbox.js`, с `app.js`, оставшимся тонким роутером), и правки трёх
framework-скиллов вне `tools/manual-test-ui` (`skills/pf-roles/SKILL.md`,
`skills/pf-close/SKILL.md`, `skills/pf-autopilot/SKILL.md`), без которых
актор `human` не может быть вызван ни одним pf-*-скиллом.

Порядок задач ниже — не порядок нумерации ради порядка: framework-скиллы
(Задачи 1-3) снимают hard-stop и определяют схему `mode:`, от которой зависит
`lib/roles-resolve.js` (Задача 4); человеческая очередь и инбокс (Задачи
4-15) — самостоятельный содержательный слой, который навигационная оболочка
(Задачи 23-27) потребляет (карточка инбокса на лаунчере, счётчик «Дела» на
уровне 2). CSS-токены/типографика/a11y (Задачи 16-22) не зависят ни от чего
из перечисленного и могут выполняться в любой момент до финальной интеграции
Задач 23-27. Референсные скриншоты и owner sign-off — внешний, не-агентный
блокер (AC-02k), формально предшествующий самому старту `/pf-execute`, а не
одна из задач ниже (сабагент не может ни снять скриншоты чужого legacy-сервиса,
ни подписаться за владельца) — см. раздел «Prerequisite» сразу после Overview.

### Prerequisite — blocks all tasks below

Прежде чем для этой issue будет запущен `/pf-execute`, владелец должен вручную:

- (a) сохранить два референсных скриншота GLog v.0.7 в папку issue —
  `reference-glog-list.png` и `reference-glog-detail.png` (`specs.md` §5.3);
- (b) записать явную строку owner sign-off в `session-log.md` (`specs.md`
  §5.4) — подтверждение по демо/скриншот-ревью итоговой палитры/типографики
  как «удобно для длительной работы», датированную **до** первого коммита
  `/pf-execute` для этой issue.

Это ручной, чисто человеческий гейт: `/pf-execute` для этой issue не должен
проходить дальше него без обоих условий. Он **намеренно не входит** в
пронумерованный список задач ниже — ни один кодирующий суб-агент не может
физически ни сделать скриншоты чужого legacy-сервиса владельца, ни
подписаться за него; попытка закрыть этот шаг фиктивными плейсхолдер-файлами
обесценила бы саму цель AC-02e/AC-02k. Порядок по `specs.md` §5.4/Non-Goals
(«бриф → критика и альтернативы от Codex → выбор владельцем → реализация»)
не подменяется и не автоматизируется этим пунктом — здесь фиксируется только
факт его завершённости.

**Что проверяет завершённость этого шага (не Acceptance Criteria отдельной
задачи — трассируемость самого Prerequisite; намеренно **не** `- [ ] TC-…`
checkbox-синтаксис, а обычные пункты списка: `pf-execute/SKILL.md`'s Phase
3.5 Completeness Gate Check 1 механически сканирует весь
`implementation_plan.md` на предмет **любой** оставшейся строки `- [ ]`, не
только внутри блоков пронумерованных задач, и не делает исключения для TC-009
здесь — TC-009 `Auto`-типизирован, так что checkbox-строка с ним неизбежно
заблокировала бы гейт навечно, ведь ни одна волна `/pf-execute` её не пишет —
это не Acceptance Criteria ни одной задачи. Обычные пункты вне
`- [ ]`-синтаксиса Check 1 не видит.):**
- TC-009 (**только шаг 3** — `Auto`-типизированный TC, но именно этот шаг —
  файловая проверка существования
  `reference-glog-list.png`/`reference-glog-detail.png` в папке issue; шаги
  1-2 того же TC — числовой диапазон типографики — не про этот Prerequisite,
  см. Задачу 19). Если референсы ещё не сохранены, этот шаг **обязан упасть
  громко** — это и есть механизм, делающий пропущенный Prerequisite видимым в
  `node --test`, а не пробел, который надо обходить.
- TC-013 (`Manual` — строка owner sign-off в `session-log.md`, датированная
  до начала `/pf-execute`, плюс собственно демонстрация/скриншот-ревью
  владельцем)

**Mapped Test Cases:** TC-009, TC-013 (реверсивная трассируемость для
`pf-execute/SKILL.md`'s Phase 3.5 Check 3 — «every TC has a task»; этот
Prerequisite не пронумерованная задача и не dispatch-ится `/pf-execute`, но
поле называется так же, как в задачах ниже, специально для той же
механической сверки с Status Tracker `test_plan.md`, а не как Acceptance
Criteria этого раздела)

**Это блокер уровня issue, а не отдельной задачи**: см. Dependencies — ни
одна из Задач 1-28 не должна выполняться агентом до появления обоих
референсных PNG и строки sign-off.

---

### Files to Create/Modify

**Новые файлы:**
- `docs/issues/open/20260806-feat-project-explorer-redesign/reference-glog-list.png` — создаёт **владелец** до старта `/pf-execute` (Prerequisite выше, не задача этого списка; не создаётся и не заменяется никаким диспетчеризуемым сабагентом)
- `docs/issues/open/20260806-feat-project-explorer-redesign/reference-glog-detail.png` — то же самое: создаёт **владелец** до старта `/pf-execute` (Prerequisite выше)
- `tools/manual-test-ui/lib/roles-resolve.js`
- `tools/manual-test-ui/lib/inbox.js`
- `tools/manual-test-ui/lib/contrast.js`
- `tools/manual-test-ui/public/launcher.js`
- `tools/manual-test-ui/public/workspace.js`
- `tools/manual-test-ui/public/inbox.js`
- `tools/manual-test-ui/test/roles-resolve.test.js`
- `tools/manual-test-ui/test/fixtures/prompt-roles-flow.md`
- `tools/manual-test-ui/test/inbox.test.js`
- `tools/manual-test-ui/test/human-tasks.test.js`
- `tools/manual-test-ui/test/contrast.test.js`
- `tools/manual-test-ui/test/launcher.test.js`
- `tools/manual-test-ui/test/workspace.test.js`

**Изменяемые файлы:**
- `tools/manual-test-ui/server.js`
- `tools/manual-test-ui/lib/git.js`
- `tools/manual-test-ui/public/app.js`
- `tools/manual-test-ui/public/index.html`
- `tools/manual-test-ui/public/style.css`
- `tools/manual-test-ui/test/readonly.test.js`
- `skills/pf-roles/SKILL.md`
- `skills/pf-close/SKILL.md`
- `skills/pf-autopilot/SKILL.md`

**Не меняются содержательно** (специфицировано явно в `specs.md` §1/§7):
`lib/roles.js`, `lib/docstate.js`, `lib/checklist.js` (кроме точечной правки
в Задаче 9), `lib/prepare.js`, `lib/markdown.js`, `lib/memory.js`,
`lib/instructions.js`, `lib/paths.js`.

---

### Implementation Tasks

#### Task 1: `skills/pf-roles/SKILL.md` — `human` в дефолтном `agents.yml`, поле `mode`, снятие hard-stop

**Task Type:** code
**Mapped Test Cases:** TC-027

**Files:**
- `skills/pf-roles/SKILL.md` — §1 (схема `roles.<key>`), §2 (дефолтный `agents.yml`, hard-stop на `kind: human`), §4 (резолвинг)

**Implementation Notes:**
- §2, дефолтное содержимое `agents.yml`: добавить `human: { kind: human, inbox: project-explorer }` строкой рядом с `claude`/`haiku`/`codex`/`gemini` (AC-05h). Поле `inbox:` уже присутствует в черновом примере — не изобретать заново.
- §1, схема `roles.<key>`: новое опциональное поле `mode: blocking | non-blocking` (дефолт `non-blocking`, если поле отсутствует). Отдельное от `review.mode: parallel|sequential` (§6 того же файла) — разный уровень вложенности и смысл; явно указать в тексте, что это два разных поля, чтобы не путались при будущих правках.
- §2/§4, снятие hard-stop: текущий текст «Any resolver that encounters `kind: human` while resolving an actor **must stop with an explicit, understandable error**» и пример сообщения `actor '<name>' is kind: human — not supported until 20260806-improve-project-explorer-redesign` — заменить на: резолвер при встрече `kind: human` возвращает вызывающему коду структурированный результат `{ kind: "human", inbox: <значение> }`, не бросает исключение и не завершает работу с ошибкой. Обработка (постановка в очередь) — ответственность вызывающего (`lib/inbox.js`, Задача 6/7), не самого резолвера.
- **Устаревшая ссылка на issue-id должна полностью исчезнуть, не просто обновиться**: текст `"not supported until 20260806-improve-project-explorer-redesign"` ссылается на более раннее имя *этой же* issue (`improve-...` вместо фактического `feat-...`). Заголовок подраздела `### kind: human — not supported yet, and must fail explicitly` тоже больше не отражает реальность — переписать заголовок и текст под новое поведение (снят hard-stop, обрабатывается вызывающим кодом), не оставляя ни один из старых issue-id-упоминаний, даже исправленным на текущий id — сам hard-stop уходит, ссылка на issue, которая его снимает, бессмысленна в тексте о постоянном ограничении.
- §4, раздел `### kind: human and code: skip during resolution` — обновить формулировку: `kind: human` больше не «hard-stop condition» в смысле ошибки резолвинга; переформулировать как «структурированный результат, требующий обработки вызывающим кодом», сохранив соседний абзац про `code: skip` без изменений (это по-прежнему настоящий hard-stop).

**Acceptance Criteria:**
- [x] TC-027 passes (шаги 1-3 — hard-stop removed, default `agents.yml` entry; шаг 4 требует `lib/roles-resolve.js`, см. Задачу 4; покрыто `test/pf-roles-human-actor.sh`)

---

#### Task 2: `skills/pf-close/SKILL.md` — Phase 0, проверка незавершённых human-задач

**Task Type:** code
**Mapped Test Cases:** TC-028

**Files:**
- `skills/pf-close/SKILL.md` — Phase 0 (Prerequisite Checks)

**Implementation Notes:**
- Новый пункт 4 внутри существующей Phase 0, **после** трёх сегодняшних («QA report exists», «QA verdict is PASS», «On correct branch») — не отдельная фаза. Алгоритм — `specs.md` §4.1a, дословно:
  1. Прочитать `prompt.md` активной issue, резолвить `roles.<key>` для каждого ключа пайплайна (`brd`, `specs`, `test_plan`, `implementation_plan`, `code`, `tests`, `user_docs`, `dev_docs`, плюс `analysis`/`notes` если применимо) по алгоритму `pf-roles/SKILL.md` §4 — тем же, который уже выполняет каждый pf-*-скилл для своей собственной роли.
  2. Отобрать ключи, резолвящиеся в `kind: human`.
  3. Для каждого такого ключа проверить `docs/issues/open/ISSUE-ID/session-log.md` на отметку `[human-task done] <key> @ <ts> content-hash=<sha256>`. Отметка отсутствует — ключ не выполнен. Отметка есть, но `sha256` на диске (тем же путём, что резолвится для ключа — см. Задача 24) не совпадает с записанным — `stale`, тоже не выполнен.
  4. Хотя бы один невыполненный ключ — остановиться с сообщением, перечисляющим незакрытые ключи.
- Это markdown-skill-native алгоритм: `pf-close` выполняет его сам через Read/Bash, без обращения к `tools/manual-test-ui` (который опциональный dev-инструмент со своим `projects.json`) и без JS.

**Acceptance Criteria:**
- [x] TC-028 passes (часть про `/pf-close` Phase 0; покрыто `test/pf-roles-human-actor.sh`)

---

#### Task 3: `skills/pf-autopilot/SKILL.md` — снятие расписания при останове на human-задачах

**Task Type:** code
**Mapped Test Cases:** TC-028

**Files:**
- `skills/pf-autopilot/SKILL.md` — Step 2 (Work loop)

**Implementation Notes:**
- Если `/pf-close` останавливается из-за незавершённых human-задач (Задача 2) — автопилот снимает cron-расписание (`CronDelete pf-autopilot-<project>`) и завершает **отчётом**, а не повторяет попытку на следующем `continue`-resume («не крутится вхолостую», AC-05b).
- Добавить явную обработку в Step 2, рядом с существующими пунктами 1-5 (пункт 1 уже упоминает `/pf-close` как одну из стадий цикла) — не отдельный новый Step.

**Acceptance Criteria:**
- [x] TC-028 passes (часть про `/pf-autopilot`; покрыто `test/pf-roles-human-actor.sh`)

---

#### Task 4: `lib/roles-resolve.js` — резолвер `roles.<key>` (flow-YAML подмножество + fallback-алгоритм)

**Task Type:** code
**Mapped Test Cases:** TC-021, TC-022, TC-027

**Files:**
- `tools/manual-test-ui/lib/roles-resolve.js` — новый

**Implementation Notes:**
- Design constraints — как у `lib/roles.js`/`lib/markdown.js`: zero dependencies, чистые функции, ничего не трогает на этапе загрузки модуля (`specs.md` §3.2).
- **Не порт существующей логики** — в кодовой базе нет ни одного YAML-парсера, способного прочитать `roles: { brd: { write: claude, review: [claude] } }`. Написать с нуля построчный ридер узкого подмножества:
  - вложенные мэппинги ровно в 2 уровня (`roles:` → `<key>:` → `write`/`review`/`run`/`skip`/`mode`), не произвольная глубина;
  - flow-стиль объектов в одну строку (`{ key: value, key2: [a, b] }`) — единственная поддерживаемая форма; multi-line block-стиль **не поддерживается** — явное, задокументированное ограничение, не баг (см. Acceptance Criteria);
  - flow-стиль списков в одну строку (`[a, b]`);
  - голые скалярные значения на уровне `<key>` (например `dev_docs: skip`).
- Новое поле `mode: blocking | non-blocking` (Задача 1, `pf-roles/SKILL.md` §1) читается наравне с `write`/`review`/`skip` и кладётся в объект резолвинга.
- Полный резолвинг ключа `<key>` реализует все пять уровней fallback-алгоритма `pf-roles/SKILL.md` §4 (нужен `lib/inbox.js`/Задаче 7 для точного ответа «кто пишет/ревьюит этот ключ», не только для случая, когда `roles.<key>` явно прописан в `prompt.md`):
  1. явная точечная запись `roles.<key>` в `prompt.md` (парсер выше);
  2. точечная запись выбранного профиля (`profile:` в `prompt.md`, `role-profiles.yml`, тот же flow-YAML-парсер применяется к `profiles:` блоку);
  3. tier-дефолт `skip` для `user_docs`/`dev_docs` при `size_tier: trivial`/`small`;
  4. `default`-запись выбранного профиля;
  5. общий дефолт `write: claude, review: [claude]`, если нет ни `roles:`, ни `profile:`.
- При встрече `kind: human` (после резолвинга актора против `agents.yml`) — вернуть структурированный `{ kind: "human", inbox: <значение> }`, не бросать исключение (симметрично Задаче 1).
- **Задокументированное ограничение**: запись `roles.<key>`, разбитая на несколько строк (multi-line block-style YAML), не гарантированно разбирается корректно. При встрече такой записи — не бросать необработанное исключение и не завершать процесс сервера; результат для этого ключа либо явно помечен нераспознанным/неполным, либо не содержит вымышленных `write`/`review` (см. TC-022, Known Issues в `test_plan.md`).
- Экспортировать отдельно переиспользуемые примитивы (парсинг одной flow-строки в объект, парсинг списка) — понадобятся `POST .../reassign` (Задача 25) для построчной замены, хотя сама замена там текстовая, не через этот парсер.

**Acceptance Criteria:**
- [x] TC-021 passes
- [x] TC-022 passes
- [x] TC-027 passes (шаг 4 — резолвинг `human: { kind: human, inbox: project-explorer }` возвращает `{ kind: "human", inbox: "project-explorer" }`, без исключения)

---

#### Task 5: `test/roles-resolve.test.js` — тесты `lib/roles-resolve.js`

**Task Type:** tests
**Mapped Test Cases:** TC-021, TC-022

**Files:**
- `tools/manual-test-ui/test/roles-resolve.test.js` — новый
- `tools/manual-test-ui/test/fixtures/prompt-roles-flow.md` — новый, committed fixture

**Implementation Notes:**
- `prompt-roles-flow.md` — снимок реального однострочного flow-стиля, каким сегодня написаны `prompt.md` этого репозитория, **зафиксированный коммитом**, не живой glob по `docs/issues/open/` при каждом прогоне (устраняет риск вакуумного прохождения при 0 совпадений или ложного падения от чужого issue в будущем — `test_plan.md` TC-021 шаг 4). Минимум: `brd: { write: claude, review: [codex] }`, `specs: { write: codex, review: [claude], mode: blocking }`, `code: { write: codex, review: [claude] }`, `dev_docs: skip`.
- Кейсы: одиночная flow-запись с `write`/`review`; запись с `mode: blocking`; голый скаляр (`dev_docs: skip`); фикстурный многострочный блок из `prompt-roles-flow.md`, все ключи разобраны без исключений.
- Негативный кейс (TC-022): fixture `prompt.md` с одним `<key>` в multi-line block-стиле — парсер не бросает необработанное исключение, результат для этого ключа не содержит вымышленных `write`/`review`.

**Acceptance Criteria:**
- [x] TC-021 passes
- [x] TC-022 passes

---

#### Task 6: `lib/inbox.js` — `collectInbox()`, парсинг `manualTests[]` из Status Tracker

**Task Type:** code
**Mapped Test Cases:** TC-016, TC-017

**Files:**
- `tools/manual-test-ui/lib/inbox.js` — новый

**Implementation Notes:**
- Design constraints — те же, что `lib/roles.js`/`lib/markdown.js` (`specs.md` §3.2): zero dependencies, чистые функции.
- Для каждого настроенного проекта прочитать `docs/planning/test-plan.md`, распарсить Status Tracker (переиспользовать построчный парсер таблиц `lib/markdown.js`, если он даёт построчный доступ к ячейкам; иначе — маленький построчный парсер по образцу `lib/checklist.js`), собрать строки `Status: pending`.
- `issueId` — **обязательное** поле каждого элемента `manualTests[]` (не `issueId?`), парсится из колонки `Origin` в формате `ISSUE-ID#TC-NNN` (формат из `20260806-feat-product-test-plan/specs.md`). Строка без валидного `Origin` — признак повреждённого файла: исключается из `manualTests[]` с предупреждением в серверном логе (`console.warn`, файл + номер строки), не отдаётся клиенту с пустым/`undefined` `issueId`.
- Каждый элемент `manualTests[]`: `{ project, issueId, ptcId, area, testCase, priority, origin }` (`specs.md` §3.2).
- **Известное ограничение спецификации** (`specs.md` §8): формат парсинга предполагает Status Tracker, описанный в `20260806-feat-product-test-plan/specs.md` на момент написания этого плана; если формат изменится в будущей issue, `lib/inbox.js` нужно свериться с актуальной версией того `specs.md`.
- Human-задачи (`humanTasks[]`) — не в этой задаче, см. Задача 7 (зависит от Задачи 4, `lib/roles-resolve.js`).

**Acceptance Criteria:**
- [x] TC-016 passes (часть про `manualTests[]`)
- [x] TC-017 passes

---

#### Task 7: `server.js` — `GET /api/inbox` (агрегация across projects, `humanTasks[]`, stale-пересчёт)

**Task Type:** code
**Mapped Test Cases:** TC-016, TC-020, TC-025

**Files:**
- `tools/manual-test-ui/server.js` — новый маршрут `GET /api/inbox`
- `tools/manual-test-ui/lib/inbox.js` — расширение `collectInbox()` для `humanTasks[]`

**Implementation Notes:**
- Human-очередь резолвится **на лету**, не хранится отдельным файлом (`specs.md` §1) — на каждый запрос сервер сканирует `prompt.md` всех настроенных проектов/issue, резолвит роли через `lib/roles-resolve.js` (Задача 4) для всех ключей пайплайна, строит список задач из тех точек, что резолвятся в `human`.
- Для каждой пары `(issue, key)`, резолвящейся в `human` — проверить `session-log.md` issue на маркер `[human-task done] <key> @ <ts> content-hash=<sha256>` (Задача 24 пишет этот маркер). Отметка отсутствует → статус `queued`. Отметка есть и хеш совпадает с текущим содержимым артефакта на диске → задача не входит в `humanTasks[]` (выполнена). Отметка есть, но хеш **не** совпадает → задача снова `queued`, помечена `stale` (AC-05f/M5) — не теряется молча.
- Ответ: `{ manualTests: [...], humanTasks: [...], totalCount }`, где `humanTasks[]` несёт `{ project, issueId, stageKey, operation, mode, artifactPath, instruction, status }`; `mode` — из `roles.<key>.mode`, дефолт `non-blocking`.
- `totalCount = manualTests.length + humanTasks.length`.
- Один эндпоинт обслуживает и глобальный экран инбокса (Задача 15), и project-scoped счётчик «Дела» на уровне 2 (Задача 25) — клиент фильтрует один и тот же ответ по `project`, повторного запроса не требуется (`specs.md` §3.4).

**Acceptance Criteria:**
- [x] TC-016 passes
- [x] TC-020 passes (обязательные поля `humanTasks[]`)
- [x] TC-025 passes (пересчёт stale при построении инбокса)

---

#### Task 8: `test/inbox.test.js` — тесты `GET /api/inbox` и `lib/inbox.js`

**Task Type:** tests
**Mapped Test Cases:** TC-016, TC-017, TC-020

**Files:**
- `tools/manual-test-ui/test/inbox.test.js` — новый

**Implementation Notes:**
- Multi-project фикстура (через `test/helpers/fixtures.js`): проект A с `pending`-строкой в `docs/planning/test-plan.md` (валидный и невалидный `Origin`), проект B с `roles.<key>` → `human`.
- Проверить форму ответа, `totalCount`, обязательность и непустоту `issueId` в каждом элементе `manualTests[]`, серверный лог-предупреждение для повреждённой строки (TC-017), обязательные поля каждого элемента обоих массивов (TC-020).

**Acceptance Criteria:**
- [x] TC-016 passes
- [x] TC-017 passes
- [x] TC-020 passes

---

#### Task 9: `PATCH .../checklist/steps` — новая проверка непустого Result (AC-05c)

**Task Type:** code
**Mapped Test Cases:** TC-023

**Files:**
- `tools/manual-test-ui/server.js` — маршрут `PATCH .../checklist/steps`

**Implementation Notes:**
- **Это новое поведение, не существующая защита** — `specs.md` §4.4 ошибочно утверждает обратное (сам `test_plan.md` TC-023 фиксирует это как пробел спецификации, который реализация обязана закрыть). Проверка кода подтверждает: `lib/checklist.js`'s `patchStepResult` принимает `note || ""` без проверки непустоты; `server.js`'s текущий маршрут валидирует только типы (`tcId` — строка, `step` — число), не содержимое `note`.
- Расширить существующий маршрут (не изобретать отдельный «closed»-статус, которого нет ни в формате `manual_test_checklist.md`, ни в спецификации): если `checked === true` и `note` пуст **после `trim()`** — вернуть `422 { error: "empty_result" }`, не патчить файл. `checked === false` с пустым `note` — по-прежнему разрешено (снятие отметки не требует текста).
- Позитивный путь (непустой `note`) не задет — существующее поведение сохраняется.

**Acceptance Criteria:**
- [x] TC-023 passes (шаги 5-6 — негативный и позитивный кейсы AC-05c)

---

#### Task 10: `server.js` — `GET .../issues/:id/human-tasks`

**Task Type:** code
**Mapped Test Cases:** TC-023

**Files:**
- `tools/manual-test-ui/server.js` — новый маршрут

**Implementation Notes:**
- Резолвит `roles.<key>` для всех ключей пайплайна этой issue через `lib/roles-resolve.js` (Задача 4), отбирает резолвящиеся в `human`, возвращает `[{ stageKey, operation, mode, artifactPath, instruction, status, contentHash? }]` (`specs.md` §4.3).
- `mode` читается из результата резолвинга (`roles.<key>.mode`, дефолт `non-blocking`, если `prompt.md` не указывает явно).
- Операция, зарезолвившаяся в `human`, **никогда** не выполняется автоматически — маршрут только сообщает о задаче, не запускает никакого действия (AC-05a).

**Acceptance Criteria:**
- [x] TC-023 passes (шаги 1-4 — очередь вместо авто-выполнения, `mode` blocking/non-blocking)

---

#### Task 11: `server.js`/`lib/git.js` — `POST .../human-tasks/:key/complete`

**Task Type:** code
**Mapped Test Cases:** TC-024, TC-025

**Files:**
- `tools/manual-test-ui/server.js` — новый маршрут
- `tools/manual-test-ui/lib/git.js` — новые обёртки

**Implementation Notes:**
- Три независимых пути проверки выполнения (`specs.md` §4.4):
  1. **human-review**: тело `{ verdict?: string }`; без непустого (после `trim()`) `verdict` → `422 invalid_verdict`. Текст «замечаний нет» — валидное непустое значение, ничем не отличается от любого другого (проверяется непустота, не содержание).
  2. **human-write, документные ключи** (`brd`, `specs`, `test_plan`, `implementation_plan`, `user_docs`, `dev_docs` — каждый резолвится ровно в один файл): `artifactPath` берётся из самой задачи (`docs/issues/open/ISSUE-ID/<file>.md`), не из тела запроса. Маппинг ключ → имя файла: `brd → brd.md`, `specs → specs.md`, `test_plan → test_plan.md`, `implementation_plan → implementation_plan.md`, `user_docs → user_docs.md` (см. `skills/pf-user-docs/SKILL.md`), `dev_docs → dev_docs.md` (см. `skills/pf-dev-docs/SKILL.md`) — та же дублирующая пара имён, что `lib/docstate.js`'s `ISSUE_DOC_STAGES` уже держит для `brd.md`/`specs.md`/`implementation_plan.md`; для `user_docs`/`dev_docs`, отсутствующих в `ISSUE_DOC_STAGES`, добавить новую константу-маппинг именно в `lib/inbox.js` или `server.js` (не расширять `ISSUE_DOC_STAGES` — та таблица про «стадию, создающую документ» для `docstate`, семантически другая штука). Проверка по порядку:
     - существует и не пустой, не заглушка (тот же признак, что `pf-size-tiers/SKILL.md`'s "Stage completion" — непустое тело сверх заголовка, отсутствие `TODO: Run /pf-`) → иначе `422 artifact_missing`;
     - закоммичен: `git status --porcelain -- <artifactPath>` (новая обёртка `lib/git.js`) должен вернуть пустой вывод для этого пути (в т.ч. `??` — не добавлен — тоже отказ) → иначе `422 artifact_not_committed`, отдельный код от `artifact_missing`;
     - оба условия выполнены → sha256 содержимого, маркер в `session-log.md`.
  3. **human-write, `code`/`tests`**: нет единственного `artifactPath` — эти два ключа резолвятся в произвольный набор файлов. Проверка:
     - родительская ветка issue — тем же способом, что `pf-close` Phase 3 (`git config branch.issue/ISSUE-ID.merge`, иначе `develop`/`main`) — новая обёртка `lib/git.js`;
     - `git rev-list --count <parent>..issue/<ID>` `> 0` — новая обёртка;
     - `git diff --name-only <parent>..issue/<ID>` содержит хотя бы один путь вне `docs/issues/` (для `tests` — дополнительно совпадающий с `test/*.test.js`) — новая обёртка;
     - оба условия → выполнено; `contentHash` — sha1 `git rev-parse HEAD` issue-ветки (новая обёртка), не файловый sha256 — «контент» здесь и есть состояние ветки;
     - любое условие не выполнено → `422 artifact_missing` (тот же код, что и для документных ключей — семантически то же «результата ещё нет»).
- Успех (любой из трёх путей): маркер `[human-task done] <key> @ <ts> content-hash=<sha…>` дописывается в `session-log.md` issue (append-only, симметрично `[pf-check PASSED]`); ответ `200 { status: "done", contentHash }`.
- Новые обёртки `lib/git.js`: `commitsAhead(cwd, parent, branch)` (`git rev-list --count`), `changedFilesBetween(cwd, parent, branch)` (`git diff --name-only`), `isPathCommitted(cwd, relPath)` (`git status --porcelain -- <path>`, пустой вывод = true), `revParse(cwd, ref)` (`git rev-parse <ref>` — полный SHA, не `--abbrev-ref`), `parentBranchOf(cwd, issueBranch)` (`git config branch.<issueBranch>.merge`, fallback `develop`/`main`). Ни одна не строит аргумент из непровалидированного пользовательского ввода — `issueId` уже прошёл `ISSUE_ID_RE`, `:key` — против ключей `roles:`.

**Acceptance Criteria:**
- [x] TC-024 passes
- [x] TC-025 passes

---

#### Task 12: `server.js` — `POST .../human-tasks/:key/reassign`

**Task Type:** code
**Mapped Test Cases:** TC-026

**Files:**
- `tools/manual-test-ui/server.js` — новый маршрут

**Implementation Notes:**
- Правит `roles.<key>.write` в `prompt.md` issue (AC-05g). **Не** parse-mutate-serialize круг (риск испортить форматирование/комментарии) — точечная построчная текстовая замена (`specs.md` §4.3):
  1. прочитать `prompt.md` как текст;
  2. найти строку `^\s*<key>:\s*\{.*\}\s*$` внутри `roles:`-блока (тот же однострочный flow-стиль, на который опирается Задача 4);
  3. заменить внутри этой строки только подстроку `write: <старое>` на `write: <новое>`, регекспом ограниченным одной строкой — не трогая `review`/`mode`/прочие поля и ни одной другой строки файла;
  4. записать файл байт-в-байт идентичным, кроме этой подстроки — переносы строк, отступы, соседние комментарии, порядок ключей сохраняются.
- Тело `{ actor: "claude" | "codex" | "haiku" | ... }` — валидируется против `docs/planning/agents.yml`'s `actors:` (не любая строка).
- **Ограничение, принимаемое явно**: если `roles.<key>` записан в multi-line block-стиле — механизм его не находит; возвращает `409`/`501`-подобную ошибку с текстом «переназначьте вручную правкой `prompt.md`», файл **не** трогается — не молчаливый no-op и не порча файла частичной заменой.
- Успех: append-only запись о переназначении (ключ, старый актор, новый актор, таймштамп) в `session-log.md` issue. Ответ `200 { status: "reassigned", actor }`.

**Acceptance Criteria:**
- [x] TC-026 passes

---

#### Task 13: `test/human-tasks.test.js` — тесты `/human-tasks` API

**Task Type:** tests
**Mapped Test Cases:** TC-023, TC-024, TC-025, TC-026

**Files:**
- `tools/manual-test-ui/test/human-tasks.test.js` — новый

**Implementation Notes:**
- Фикстуры через `test/helpers/fixtures.js`'s `makeTempRepo` — issue-ветка, родительская ветка, управляемые коммиты (тот же механизм, что `test/multi-project.test.js`/`test/doc-states.test.js`).
- Покрыть: очередь вместо авто-выполнения + `mode` blocking/non-blocking (TC-023), три ветки валидации `complete` (review/write-документ/write-код, TC-024), маркер + hash + stale-переход (TC-025), построчную замену `reassign` + её ограничение (TC-026).
- Негативный кейс `empty_result` (Задача 9) уже покрыт в этом же сьюте или отдельно — не дублировать логику проверки, только собрать сценарии из `test_plan.md` шагов.

**Acceptance Criteria:**
- [x] TC-023 passes
- [x] TC-024 passes
- [x] TC-025 passes
- [x] TC-026 passes

---

#### Task 14: `test/readonly.test.js` — расширение инвентаризации на 2 новых маршрута и 3 новых git-подкоманды

**Task Type:** tests
**Mapped Test Cases:** TC-032

**Files:**
- `tools/manual-test-ui/test/readonly.test.js`

**Implementation Notes:**
- Существующая инвентаризация (`TC-012` старой нумерации) держит **три семейства** немутирующих-в-остальном маршрутов (`checklist marks (PATCH .../checklist/steps)` + `checklist notes (PATCH .../checklist/notes)`, сгруппированные как «checklist marks/notes»; `branch checkout`; `prepare`) — четыре факта `route.re`, три текстовых «семьи». Добавить два новых факта/семьи: `POST .../human-tasks/:key/complete`, `POST .../human-tasks/:key/reassign` — итог **пять семей**, шесть route-проверок; обновить ожидаемое число (`expectedRoutes.length`) и текст assertion-сообщения.
- Расширить построчную инвентаризацию `lib/git.js` (тот же способ, что и сегодня — regex по литеральным первым аргументам каждого `tryGit(cwd, [...])`) на пять новых обёрток Задачи 11: набор git-подкоманд `checkout`, `ls-tree`, `rev-parse`, `show`, `status` (существующие) плюс **три новых** подкоманды — `rev-list`, `diff`, `config` (не пять: `status --porcelain` и `rev-parse` уже входят в существующий список подкоманд, новые обёртки их переиспользуют, а не добавляют новую подкоманду). Ни одна из пяти новых обёрток не строит аргумент из непровалидированного пользовательского ввода.
- Поведенческая проверка (снимок/diff рабочего дерева, `test/helpers/snapshot.js`) — для `complete` (успешный документный путь: меняются ровно артефакт + `session-log.md`) и для `reassign` (меняются ровно `prompt.md` — только подстрока `write:` — и `session-log.md`).
- Grep `public/*.js` на отсутствие UI-визарда выбора актора вне действия «отдать агенту» (AC-05j) — назначение остаётся ручной правкой `prompt.md`, кроме единственного action.

**Acceptance Criteria:**
- [x] TC-032 passes

---

#### Task 15: `public/inbox.js` — экран инбокса, два раздела из одного `/api/inbox`

**Task Type:** code
**Mapped Test Cases:** TC-018, TC-020

**Files:**
- `tools/manual-test-ui/public/inbox.js` — новый ES-модуль

**Implementation Notes:**
- Ровно один `fetch("/api/inbox")` при открытии экрана — оба раздела («Ручные тесты», «Человеческие задачи») рендерятся из одного и того же полученного объекта, без второго запроса (AC-04b/`specs.md` §3.3).
- Раздельные визуальные секции/локальный таб — не общая лента с одинаковым бейджем (BRD Interview Notes: «не сваливаются в одну ленту»). Переключение раздела меняет **только локальное состояние** компонента (например `activeSection`), не `location.hash` — не отдельные маршруты.
- Каждый элемент даёт как минимум: проект, issue, что конкретно требуется (`testCase` / `stageKey`+`operation`), и куда вести пользователя по клику (переход на соответствующий документ/чек-лист/таб «Дела» нужного проекта и issue) — AC-04c.

**Acceptance Criteria:**
- [x] TC-018 passes
- [x] TC-020 passes (клиентский рендер обязательных полей; навигация по клику
      теперь ведёт на нужную роль/таб/`ptcId` — CR-005 исправлен Задачей 33)

---

#### Task 16: `:root` — токены палитры Pine, body-скролл

**Task Type:** code
**Mapped Test Cases:** TC-005, TC-007

**Files:**
- `tools/manual-test-ui/public/style.css`

**Implementation Notes:**
- Заменить `:root` block ровно на 10 токенов AC-02d: `--bg: #16241b`, `--surface: #1e3126` (схлопывает сегодняшние `--panel`/`--panel-2` — отдельного требования на их различие в BRD нет), `--border: #3c5c46`, `--text: #c6d5c8`, `--muted: #96ac9c`, `--ok: #6ec97f` (переименование `--pass`), `--fail: #f08d84`, `--warn: #e0b95c`, `--held: #b6a0ef` (новый — для human-задач в состоянии, ожидающем стороннего действия), `--accent: #5cc4d4`.
- Удалить старые имена (`--panel`, `--panel-2`, `--pass`) как мёртвый код — не оставлять рядом с новыми (TC-007 шаг 3).
- Ровно одна цветовая схема — никакой media query светлой темы, `data-theme`-переключателя, второго набора токенов (Non-Goals: мультитемность не запрашивалась).
- Убрать `overflow: hidden` на `body` (сегодня `style.css:25`) — Problem Statement #3/AC-01f. Локальные `overflow-y`/`overflow-x` на внутренних панелях (`.doc-panel` и т.п.) — не баг, оставить.

**Acceptance Criteria:**
- [x] TC-005 passes (покрыто `test/style-tokens.test.js`)
- [x] TC-007 passes

---

#### Task 17: Замена захардкоженных цветовых литералов токенами

**Task Type:** code
**Mapped Test Cases:** TC-008

**Files:**
- `tools/manual-test-ui/public/style.css`

**Implementation Notes:**
- Устранить все `color: #...`-литералы, найденные сегодня: `#fff` (строки `.role-btn.active`/аналог в новой разметке, `.list li.active`, `.list li.active .badge`), `#dbe6ff` (`.list li.active .meta`), `#f0d9a0` (`.notice.warn`), `#f2b5b1` (`.notice.error`) — заменить на токены Pine (Задача 16). AC-02j: полное покрытие, не частичное — grep по всему файлу на `color:\s*#[0-9a-fA-F]{3,6}` должен дать ноль совпадений после правки.
- После замены прогнать `test/contrast.test.js` (Задача 18) — заменённые токены обязаны проходить контрастные пороги, AC-02b становится проверяемым по факту.
- Учесть, что эта задача выполняется поверх новой разметки Задач 23-27 (`.role-switch`/`.list`/`.notice` и т.п. могут получить новые имена классов) — искать литералы по факту в файле на момент выполнения, не по старым селекторам буквально.

**Acceptance Criteria:**
- [x] TC-008 passes (покрыто `test/style-tokens.test.js` — `textLiterals.length === 0`)

---

#### Task 18: `lib/contrast.js` + `test/contrast.test.js` — автотест контраста

**Task Type:** tests
**Mapped Test Cases:** TC-006

**Files:**
- `tools/manual-test-ui/lib/contrast.js` — новый (переиспользуемые чистые функции)
- `tools/manual-test-ui/test/contrast.test.js` — новый

**Implementation Notes:**
- Логика вычисления контраста вынесена в переиспользуемые чистые функции — `parseRootTokens(cssText)` (построчный парсер `--name: #hex;`, тот же уровень сложности, что и остальные ручные парсеры этого инструмента) и `contrastRatio(hexA, hexB)` (WCAG-контраст) — экспортированные из `lib/contrast.js`, **не** только вплетённые в сам тестовый файл: негативные кейсы (см. ниже) должны прогоняться на inline-строках-фикстурах, не требуя правки реального `public/style.css`.
- `test/contrast.test.js` (обычный `node --test`-файл, лежит в `test/`, подхватывается стандартным раннером без отдельного вызова):
  1. позитивный прогон на реальном `public/style.css` — 0 нарушений;
  2. негативный кейс — `contrastRatio` на паре, заведомо дающей <7:1 (inline, не файл) — обёрточная проверка фиксирует нарушение;
  3. негативный кейс — `parseRootTokens` на inline-CSS с `color: #ffffff` — нарушение «ни чистого белого текста» обнаружено на этой фикстуре, реальный файл не редактируется.
- Пороги — AC-02a-02c: `--text`↔`--surface` ≥7:1 (тёмная тема — около 10:1, не 15-21:1); каждый цвет текста (включая литералы, пока Задача 17 их не заменила — на момент выполнения этой задачи литералы уже устранены Задачей 17, порядок задач это учитывает) ↔`--bg` и ↔`--surface` ≥4.5:1; границы ≥1.5:1; ни чистого чёрного фона, ни чистого белого текста.

**Acceptance Criteria:**
- [x] TC-006 passes

---

#### Task 19: Типографика — соотношение `h1`/body 1.3-1.8x

**Task Type:** code
**Mapped Test Cases:** TC-009

**Files:**
- `tools/manual-test-ui/public/style.css`

**Implementation Notes:**
- `h1 { font-size: calc(1em * 1.5); }` — 1.5 как середина диапазона 1.3-1.8x (AC-02e), фикс текущего бага (h1=15px vs body=14px, разница практически отсутствует).
- Проверяется построчным парсером `font-size` для `body`/`html` и `h1` (может быть в `em`/`px`/`calc()`).

**Acceptance Criteria:**
- [x] TC-009 passes (шаги 1-2 — числовой диапазон `h1`/body, покрыто `test/style-tokens.test.js`; шаг 3 — файловая проверка референсов — см. раздел «Prerequisite» выше, не эту задачу)

---

#### Task 20: `.panel`/`.panel-header`/`.panel-table` — панельный паттерн, тональная заливка

**Task Type:** code
**Mapped Test Cases:** TC-010, TC-012

**Files:**
- `tools/manual-test-ui/public/style.css`

**Implementation Notes:**
- Новый переиспользуемый класс `.panel`: `border: 1px solid var(--border)`, `.panel-header` — акцентным цветом (`var(--accent)`), единый внутренний паддинг по всему приложению (AC-02f — каждая смысловая область экрана — отдельная панель с подписанным заголовком, не сплошное полотно).
- `.panel-table`: чередующаяся мягкая заливка строк через `background: color-mix(in srgb, var(--surface) 85%, var(--accent))` на нечётных строках — не жёсткие `border`-линии между каждой строкой (AC-02h). Без отдельной hardcoded «зелёной» переменной — вычисляется от `--surface`+`--accent`.
- Контекстные действия и быстрые переходы (выбор issue/роли, переход к делу, кнопки действий) видны сразу на экране, не спрятаны в дополнительное меню/модальное окно (AC-02g) — реализуется в разметке Задач 23-27, но CSS-паттерн для них (`.action-row` и т.п.) — здесь.
- TC-012 (визуальная приёмка по референсу) — manual, требует готовых Задач 23-27 (разметка) и выполненного Prerequisite (референсы GLog v.0.7, см. раздел выше); acceptance здесь фиксирует, что паттерн реализован и владелец подтверждает соответствие референсу на живом экране. Эта проверка происходит **после** реализации, а не до старта `/pf-execute` — в отличие от TC-009/TC-013 она не входит в Prerequisite-раздел и остаётся Acceptance Criteria этой задачи.

**Acceptance Criteria:**
- [x] TC-010 passes (покрыто `test/style-tokens.test.js` — `color-mix` заливка, контраст ≥4.5:1)
- [x] TC-012 passes (manual — владелец подтверждает соответствие референсу)

---

#### Task 21: Sans-serif/monospace — аудит `font-family`

**Task Type:** code
**Mapped Test Cases:** TC-011

**Files:**
- `tools/manual-test-ui/public/style.css`

**Implementation Notes:**
- `body`/`.doc-panel`/`.panel` и вся проза интерфейса — sans-serif стек (без `serif`, без `monospace` как основного).
- `code`/`pre`/`.mono`-подобные селекторы — моноширинный стек, ограниченный только этими селекторами (существующая договорённость, AC-02i — не меняется этим issue, только проверяется, что редизайн её не нарушил).

**Acceptance Criteria:**
- [x] TC-011 passes

---

#### Task 22: `:focus-visible` — видимый индикатор фокуса, аудит нативных `<button>`

**Task Type:** code
**Mapped Test Cases:** TC-014, TC-015

**Files:**
- `tools/manual-test-ui/public/style.css`
- `tools/manual-test-ui/public/workspace.js`
- `tools/manual-test-ui/public/inbox.js`
- `tools/manual-test-ui/public/launcher.js`

**Implementation Notes:**
- `:focus-visible` (не `:focus` — не показывать рамку при клике мышью): `outline: 2px solid var(--accent); outline-offset: 2px` — контраст `--accent` к `--bg`/`--surface` уже покрыт Задачей 18.
- Порядок `tabindex` — естественный DOM-порядок (не выставляется вручную) — разметка `.role-switch` → `.inbox-card` → `.project-grid` (уровень 1), `.workspace-header` элементы → `.doc-tabs` → содержимое панели (уровень 2) должна физически идти в этом порядке в HTML, не переставляться CSS grid/flex-`order` (§6 `specs.md`).
- Кнопки действий (`.human-task-actions`, действия чек-листа, действия на всех трёх новых клиентских модулях) — нативные `<button>`, не `<div onclick>` — клавиатурная доступность по умолчанию, без ARIA-костылей.
- TC-015 (живая проверка табуляции по всему приложению) — manual, требует готовых Задач 23-27; acceptance здесь фиксирует статически проверяемую часть (индикатор, `<button>`), живую проверку — после готовности навигации.

**Acceptance Criteria:**
- [x] TC-014 passes
- [x] TC-015 passes (manual — живая проверка после готовности Задач 23-27)

---

#### Task 23: `public/app.js` (тонкий роутер) + `public/launcher.js` — уровень 1

**Task Type:** code
**Mapped Test Cases:** TC-001, TC-004, TC-019

**Files:**
- `tools/manual-test-ui/public/app.js` — переписан в тонкий роутер
- `tools/manual-test-ui/public/launcher.js` — новый ES-модуль
- `tools/manual-test-ui/public/index.html` — точка монтирования, `<script type="module">`

**Implementation Notes:**
- `app.js` решает, какой из трёх модулей (`launcher.js`/`workspace.js`/`inbox.js`) монтировать, на основе `location.hash` — простой `switch`, без внешнего роутера: `#/` → лаунчер, `#/inbox` → инбокс, `#/p/<project>` → список issue проекта (нет записи `pf.lastIssue.<project>`), `#/p/<project>/i/<issue>` → рабочее пространство (`specs.md` §2.3).
- **Не добавлять `package.json`/`"type": "module"`** — `<script type="module">` в HTML не требует `package.json`-декларации; `"type": "module"` сломал бы `require()` в `server.js` и во всех `lib/*.js`/`test/*.test.js` (G7/AC-08a, `specs.md` §7).
- `launcher.js` — три блока в одном модуле: переключатель роли (хранится в `localStorage` `pf.role`, передаётся уровню 2 как дефолт), `.inbox-card` (клик → `#/inbox`), `.project-grid` (карточки из существующего `GET /api/projects`, без изменения формата ответа — BRD не требует счётчика дел на карточке проекта, только на `.inbox-card`).
- Экспортировать `resolveLandingRoute(project, lastIssueByProject)` — чистая функция, возвращающая итоговый hash (`#/p/<project>/i/<issue>` если есть запись `pf.lastIssue.<project>`, иначе `#/p/<project>`) — клик по карточке проекта вызывает её. Даёт ≤2 клика (проект → документ) для уже активной issue.
- Экспортировать `formatInboxCardLabel(totalCount)` — чистая функция форматирования подписи `.inbox-card`, отдельная от DOM-рендеринга (пример: «Инбокс — все проекты, 7 дел», включая явное «0 дел», не placeholder без числа).
- `.inbox-card` вызывает `GET /api/inbox` (Задача 7) для `totalCount`.

**Acceptance Criteria:**
- [x] TC-001 passes
- [x] TC-004 passes
- [x] TC-019 passes

---

#### Task 24: `public/workspace.js` — шапка (`Issue ▾`/`Роль ▾`), `.doc-tabs`, `resolveActiveTab`

**Task Type:** code
**Mapped Test Cases:** TC-002, TC-003

**Files:**
- `tools/manual-test-ui/public/workspace.js` — новый ES-модуль

**Implementation Notes:**
- `.workspace-header`: «← Проекты» → уровень 1; `[Issue ▾]` — выпадающий список issue текущего проекта (замена `#issue-list`); `[Роль ▾]` — тот же переключатель роли, что на уровне 1. Никакого постоянного `.sidebar`-контейнера (AC-01b).
- `.doc-tabs` строится из ответа существующего `GET .../issues/:id/roles/:role` (`buildRoleContents`, `server.js:930`) для **текущей роли** — **не** из захардкоженного списка имён документов в клиентском коде (grep-проверка TC-002 шаг 4 требует отсутствия такого списка). `lib/roles.js` **не требует правок** — источник данных не меняется, меняется только визуальный контейнер.
- Переключение `[Роль ▾]` заменяет **весь** набор вкладок (новый `GET .../roles/:newRole`) — документы разных ролей никогда не видны одновременно.
- Переключение `[Issue ▾]` **не** меняет активный таб документа (снимает P0 `/pf-check`): экспортировать чистую функцию `resolveActiveTab(prevTabId, docsOfNewIssue)`, реализующую правило — если документ есть у новой issue, остаться на том же табе; если документ `missing` у новой issue, тоже остаться на том же табе (рендерится в состоянии `missing`, не переключение на другой документ автоматически). Правило применяется **только** внутри одной роли — смена роли берёт набор вкладок заново, не через `resolveActiveTab`.
- Таб «Дела» — новый в наборе каждой роли, счётчик — см. Задачу 25.

**Round-2 dogfooding update (as shipped — supersedes the single-role notes above):** `[Роль ▾]` заменён мультивыбор-фильтром `.role-switch` (тот же компонент, что и на уровне 1); `.doc-tabs` строится через `buildTabSet([...])` как объединение ответов `GET .../roles/:role` для КАЖДОЙ выбранной роли (пустой выбор — объединение всех ролей проекта), дедуплицированное по id таба. Переключение (toggle) одной роли теперь идёт через `resolveActiveTab` — сохраняет активный таб, если он остался в объединении; полную замену на ровно одну роль (используется табом «Дела» для перехода к чек-листу тестировщика) даёт отдельная функция `selectRole`, которая продолжает брать свежий первый таб. `brd.md` AC-01b и `specs.md` §2.2 обновлены синхронно.

**Acceptance Criteria:**
- [x] TC-002 passes
- [x] TC-003 passes

---

#### Task 25: `public/workspace.js` — таб «Дела», `countProjectTodos`

**Task Type:** code
**Mapped Test Cases:** TC-029

**Files:**
- `tools/manual-test-ui/public/workspace.js`

**Implementation Notes:**
- AC-06a дословно (первая редакция): счётчик — сумма незакрытых дел **по всем ролям и по всем открытым issue текущего проекта**, не только по текущей выбранной issue/роли (project-wide, не issue-wide — исправляет расхождение более ранней редакции `specs.md`, зафиксированное в §3.4).
- Экспортировать `countProjectTodos(inboxResponse, projectName)` — **ровно два параметра, без роли**: отсутствие параметра роли в сигнатуре — сама структурная проверка AC-06b (счётчик физически не может зависеть от роли). Вычисление: клиент запрашивает `GET /api/inbox` (Задача 7, тот же эндпоинт, что и глобальный инбокс) один раз, фильтрует оба массива (`manualTests`, `humanTasks`) по `project === projectName`, суммирует длины. Ни один элемент не несёт поля «роль» (ручной TC — всегда дело тестировщика по построению; human-задача привязана к `stageKey`, не к роли-зрителю), так что фильтрация по проекту уже даёт сумму «по всем ролям».
- Переключение `[Роль ▾]`/`[Issue ▾]` внутри одного проекта **не** порождает повторный `fetch("/api/inbox")` — переиспользуется один и тот же ответ (AC-06b — счётчик виден **до** переключения, поскольку переключение его вообще не трогает).

**Round-2 dogfooding update (as shipped — supersedes the project-wide notes above):** AC-06a пересмотрен на issue-scoped — содержимое самого таба «Дела» уже фильтровалось по текущей issue, и project-wide число рядом с ним не соответствовало тому, что реально показывал таб. Функция переименована в `countIssueTodos(inboxResponse, projectName, issueId)` — **ровно три параметра, всё ещё без роли** (AC-06b не изменился: структурная гарантия остаётся, просто к ней добавился issue-фильтр). `GET /api/inbox` по-прежнему запрашивается один раз и переиспользуется при переключении роли; но при переключении issue значение пересчитывается заново из того же уже полученного ответа (без повторного `fetch`). `brd.md` AC-06a и `specs.md` §3.4 обновлены синхронно.

**Acceptance Criteria:**
- [x] TC-029 passes

---

#### Task 26: `public/workspace.js` — `looseSections` → «Дополнительные заметки»

**Task Type:** code
**Mapped Test Cases:** TC-030

**Files:**
- `tools/manual-test-ui/public/workspace.js`

**Implementation Notes:**
- Источник — уже существующий `GET .../issues/:id/checklist` (`server.js`, отдаёт `parseChecklist()`'s результат целиком, включая `looseSections: [{ afterTc, lineIndex, text }]`) — ничего нового на сервере не требуется, только клиентское чтение поля, которое сегодня игнорируется.
- Рендерится в `.doc-panel` роли «Тестировщик», на экране `manual_test_checklist.md`, **после** последнего TC-`.panel`, не внутри какого-либо TC-блока.
- Экспортировать `renderChecklistPanel(parsedChecklist)` — чистая функция, возвращающая **HTML-строку (или другое чисто сериализуемое значение) и только это**, не DOM-узлы: под `node --test` в этом zero-dependency проекте нет `document.createElement` — ветка контракта, требующая построения узлов, невыполнима под тестом. Порядок в возвращённой строке проверяется по индексу вхождения подстроки, не через DOM.
- Визуальное отличие от `.panel` (AC-07b): отдельный класс — `border: 1px dashed var(--border)` (пунктир), фон `color-mix(in srgb, var(--surface) 92%, var(--warn))` (на `--warn`, не `--accent` — чтобы не читаться как акцентный заголовок обычной панели), заголовок **«Дополнительные заметки»** (не «TC-…», не порядковый номер), подпись «нераспознанный текст между блоками чек-листа — не тест-кейс».
- Элементы группируются по `afterTc`, рендерятся в порядке `lineIndex`. Элемент с `afterTc`, не совпадающим ни с одним отрендеренным TC (не должно происходить при корректном документе, но защитно обрабатывается) — всё равно попадает в конец блока, не отбрасывается (принцип `lib/checklist.js` «don't let it vanish silently» перенесён на UI).
- Каждая строка `text` рендерится как есть, без markdown-разбора — read-only, как и весь остальной `.doc-panel` (Non-Goals: без ручного редактирования документов пайплайна через UI).

**Acceptance Criteria:**
- [x] TC-030 passes

---

#### Task 27: `test/launcher.test.js` + `test/workspace.test.js` — тесты клиентских ES-модулей

**Task Type:** tests
**Mapped Test Cases:** TC-001, TC-002, TC-003, TC-004, TC-019, TC-029, TC-030

**Files:**
- `tools/manual-test-ui/test/launcher.test.js` — новый
- `tools/manual-test-ui/test/workspace.test.js` — новый

**Implementation Notes:**
- `public/launcher.js`/`public/workspace.js` — нативные ES-модули (`export`/`import`), не UMD-модули вроде `lib/roles.js`: `require()`/`vm.runInContext` не годятся для `export`-синтаксиса (`SyntaxError` вне модульного контекста); `test/roles.test.js`'s `node:vm`-загрузка `lib/roles.js` не прецедент здесь. Загрузка — динамическим `import()`: `await import(pathToFileURL(path.join(TOOL_DIR, "public", "<file>.js")).href)` (`node:url`'s `pathToFileURL`) — работает из CommonJS-тестового файла без флагов.
- `test/launcher.test.js`: `resolveLandingRoute` (с записью `pf.lastIssue.<project>` и без неё — TC-004), `formatInboxCardLabel` (включая `totalCount === 0` — TC-019), grep `launcher.js`/`app.js` на обработчик клика `.inbox-card` устанавливающий `#/inbox` (TC-019 шаг 3), состав экрана лаунчера и обработка hash `#/` (TC-001).
- `test/workspace.test.js`: `resolveActiveTab` (документ есть у обеих issue / отсутствует у новой — TC-003), `.doc-tabs` через `GET .../roles/:role` для двух ролей без пересечения наборов (TC-002, через `test/helpers/server.js`, не через `import()` — это серверный HTTP-вызов), отсутствие захардкоженного списка документов в `workspace.js` (TC-002 шаг 4), `countIssueTodos` — сигнатура ровно из трёх аргументов (project+issue, без роли — round-2 dogfooding: было два аргумента/project-wide, стало issue-scoped, см. Задачу 25), 0 для issue без дел, отсутствие повторного `fetch` при смене роли/issue но пересчёт при смене issue (TC-029), `renderChecklistPanel` — порядок блоков, CSS-класс, группировка `looseSections` по `afterTc`/`lineIndex`, orphan `afterTc` не отброшен, no-markdown (TC-030).

**Acceptance Criteria:**
- [x] TC-001 passes
- [x] TC-002 passes
- [x] TC-003 passes
- [x] TC-004 passes
- [x] TC-019 passes
- [x] TC-029 passes
- [x] TC-030 passes

---

#### Task 28: Регрессия US-08 — отсутствие новых зависимостей, три состояния чек-листа, точечная запись

**Task Type:** tests
**Mapped Test Cases:** TC-031

**Files:**
- `tools/manual-test-ui/test/doc-states.test.js` (или новый регрессионный сьют, если существующий не покрывает все три состояния поверх нового `.doc-panel`)

**Implementation Notes:**
- Финальный регрессионный проход поверх всего редизайна (`specs.md` §7): `tools/manual-test-ui/` не получила `package.json`/`node_modules` с внешними `dependencies` (либо не появился вовсе, либо появился без внешних зависимостей); инструмент стартует одной командой (`make test-ui`) без предварительного `npm install` (G7/AC-08a/M6).
- Три состояния чек-листа (`missing`/`branch-only`/`on-disk`, `lib/docstate.js` — не менялся содержательно) классифицируются как и раньше, рендерятся внутри нового `.doc-panel` (Задача 24/26).
- Checkout ветки issue по подтверждению — работает как прежде (`lib/git.js`'s исходные пять методов не тронуты, кроме добавленных в Задаче 11).
- Точечная запись Result/Notes (`lib/checklist.js`'s `patchStepResult`/`patchNotes`) меняет ровно одну строку файла — остальной документ (форматирование, прочие TC, `looseSections`) байт-в-байт не тронут.
- Известная недетерминированность `prepare.test.js`/`read-paths.test.js` (BRD Non-Goals) — не путать с регрессией этой issue; при флаке этих двух файлов повторить прогон, не относить на счёт редизайна.

**Acceptance Criteria:**
- [x] TC-031 passes (все шаги; шаг 4 и клиентский путь записи Result/Notes,
      ранее регрессировавшие — CR-001/CR-006, восстановлены Задачами 29/34)

---

## Задачи из /pf-codereview, раунд 1 (эскалация Phase 3.5 — ≥3 блокирующих находок)

`code_review.md`'s раунд 1 вернул 3×P0 + 3×P1 — порог Phase 3.5 (`~/.claude/skills/pf-codereview/SKILL.md`) для отказа от цикла фиксов в пользу возврата в `/pf-execute`. Задачи 29-34 ниже — каждая напрямую закрывает одну находку `code_review.md` (`CR-NNN`), с `**Mapped Test Cases:**`, указывающими на существующие TC из `test_plan.md`'s Status Tracker (ни одного нового TC-ID не изобретено).

---

#### Task 29 (fix CR-001): `public/workspace.js` — клиентская запись Result/Notes ручных TC

**Task Type:** code
**Mapped Test Cases:** TC-023, TC-031

**Files:**
- `tools/manual-test-ui/public/workspace.js`

**Implementation Notes:**
- `renderTcPanelHtml` сейчас рендерит шаги чек-листа как статичный текст (`☑`/`☐` + note) — заменить на реальные интерактивные элементы: чекбокс/кнопка для `checked`, `<textarea>`/`<input>` для `note`, привязанные к обработчикам, вызывающим существующие серверные маршруты `PATCH .../checklist/steps` и `PATCH .../checklist/notes` (маршруты и `patchStepResult`/`patchNotes` не менялись — не трогать `lib/checklist.js`/`server.js` этой задачей).
- Новая серверная валидация непустого `note` при `checked: true` (Задача 9, AC-05c) должна быть видна пользователю как понятная ошибка в UI, не проглатываться молча.
- Обновление после успешного `PATCH` — обновить локальное состояние панели без полной перезагрузки документа (тот же `fetchDoc`/`docCache`-паттерн, что уже используется для чтения — здесь нужна точечная инвалидация одного документа после записи, не всего кэша).
- TC-031 шаг 4/5 (checkout, точечная запись) — эта задача закрывает именно клиентский путь записи; серверная часть уже покрыта Задачей 28.

**Acceptance Criteria:**
- [x] TC-023 passes (клиентский путь записи Result/Notes, включая отказ на пустой Result)
- [x] TC-031 passes (точечная запись — теперь и с клиента)

---

#### Task 30 (fix CR-002): `public/workspace.js` — human-task UI в табе «Дела»

**Task Type:** code
**Mapped Test Cases:** TC-024, TC-025, TC-026, TC-032

**Files:**
- `tools/manual-test-ui/public/workspace.js`

**Implementation Notes:**
- Полноценный UI для таба «Дела» (заглушка «появится отдельной задачей» — убрать): список задач из `GET .../human-tasks` (уже реализован, Задача 10), с полями `stageKey`/`operation`/`instruction`/`status`.
- Действие «Завершить» — для `operation: "review"` показывает поле ввода `verdict` (текст, может быть «замечаний нет»), для `write`-документных/код-ключей — кнопку подтверждения без дополнительного ввода; вызывает `POST .../human-tasks/:key/complete` (Задача 11, не менять).
- Действие «Отдать агенту» (AC-05g/AC-05j) — единственное разрешённое действие выбора актора в UI (не общий визард): выпадающий список из `docs/planning/agents.yml`'s `actors:`, вызывает `POST .../human-tasks/:key/reassign` (Задача 12, не менять). Держать явно единственным таким контролом — TC-032's grep-проверка (Задача 14) фиксирует его отсутствие где-либо ещё.
- После успешного действия — обновить список (новый `GET .../human-tasks`), либо оптимистично убрать выполненную задачу из списка.
- Обработка ошибок сервера (`422`/`409`) — понятное сообщение пользователю, не проглатывается молча (симметрично Задаче 29).

**Acceptance Criteria:**
- [x] TC-024 passes (клиентский вызов complete по всем трём веткам валидации)
- [x] TC-025 passes (клиентское отражение маркера/hash/stale)
- [x] TC-026 passes (клиентский вызов reassign, включая ограничение multi-line — понятная ошибка в UI)
- [x] TC-032 passes (единственный actor-контрол — точно там, где заявлено, и нигде больше)

---

#### Task 31 (fix CR-003): `public/style.css` — стили для непокрытой разметки уровня 1/2/инбокса

**Task Type:** code
**Mapped Test Cases:** TC-001, TC-002, TC-010, TC-012

**Files:**
- `tools/manual-test-ui/public/style.css`

**Implementation Notes:**
- Добавить правила (Pine-токены, `.panel`-паттерн — переиспользовать, не изобретать новую систему) для каждого класса, реально строящегося в `launcher.js`/`inbox.js`/`workspace.js`, но сегодня не имеющего ни одного правила в `style.css`: `.doc-panel`, `.project-card`/`.project-card-name`/`.project-card-meta`, `.inbox-item`/`.inbox-item-label`/`.inbox-item-instruction`/`.inbox-item-meta`, `.inbox-tabs`/`.inbox-panels`/`.inbox-section-title`, `.inbox-empty`/`.inbox-error`/`.inbox-loading`, `.workspace-field`/`.workspace-field--issue`/`.workspace-field--role`, `.role-select`/`.issue-select`, `.checklist-body`, `.field-label`.
- Базовые сброс-стили на `button`/`a`/`select` — по образцу существующего `*{box-sizing}`/`body`, без излишеств.
- Перед началом — свежий grep всех `className`/`h(tag, className, ...)` вызовов по трём клиентским модулям против `style.css`, чтобы не пропустить что-то ещё, появившееся между написанием этой находки и её фиксом.
- Задача 20's `.panel`/`.panel-header`/`.panel-table` — не переопределять, расширять тем же паттерном color-mix/токенов.

**Acceptance Criteria:**
- [x] TC-001 passes (лаунчер визуально оформлен)
- [x] TC-002 passes (рабочее пространство визуально оформлено)
- [x] TC-010 passes (панельный паттерн распространён на все новые контейнеры; покрыто `test/css-class-coverage.test.js` + `test/style-tokens.test.js`)
- [x] TC-012 passes (визуальная приёмка владельцем — теперь возможна без «голой» разметки)

---

#### Task 32 (fix CR-004): `lib/roles-resolve.js`/`skills/pf-close/SKILL.md` — human-review-задачи обнаруживаются, не только human-write

**Task Type:** code
**Mapped Test Cases:** TC-027, TC-028

**Files:**
- `tools/manual-test-ui/lib/roles-resolve.js`
- `tools/manual-test-ui/lib/inbox.js`
- `skills/pf-close/SKILL.md`

**Implementation Notes:**
- `resolveRole()` сегодня определяет `kind: "human"` только через `write`-актора — распространить обнаружение и на `review[]` (уже частично сделано в `resolveHumanTaskOperation()`, Задача 11, для пути `complete` — здесь нужно то же на пути **обнаружения/перечисления**, не только завершения).
- `lib/inbox.js`'s `collectHumanTasks()`/`collectHumanTasksForIssue()` — включить в перечисление review-задачи с `kind: human` в `review[]`, не только write-задачи.
- `skills/pf-close/SKILL.md`'s Phase 0 human-task check (Задача 2) — расширить выбор ключей: не только «resolved **write** actor is kind: human», но и любой ключ, чей `review[]` резолвится в `kind: human`.
- Не менять семантику самого `POST .../complete` (Задача 11) — только обнаружение/перечисление ниже по цепочке (инбокс, счётчик «Дела», `/pf-close`).

**Acceptance Criteria:**
- [x] TC-027 passes (human-review-задачи обнаружимы наравне с human-write — покрыто `roles-resolve.test.js`/`inbox.test.js`, TC-ID метки добавлены)
- [x] TC-028 passes (`/pf-close` Phase 0 блокируется и на незакрытой review-задаче; покрыто `test/pf-roles-human-actor.sh`)

---

#### Task 33 (fix CR-005): `public/app.js`/`public/workspace.js` — клик по элементу инбокса ведёт на нужную роль/таб

**Task Type:** code
**Mapped Test Cases:** TC-020

**Files:**
- `tools/manual-test-ui/public/app.js`
- `tools/manual-test-ui/public/workspace.js`

**Implementation Notes:**
- `public/inbox.js` уже строит полный `where` (`roleId`/`doc`/`ptcId` для ручного TC; `tab: "human-tasks"`/`stageKey` для human-задачи) — эта задача учит `app.js`/`workspace.js` его использовать, не переделывает `inbox.js`.
- `app.js`'s `optionsFor("inbox")` сегодня пробрасывает в навигацию только `target.hash` — расширить, чтобы `where`'s дополнительные поля тоже доходили до смонтированного экрана (например через query-часть hash или через прямую передачу объекта, если навигация остаётся в пределах одного SPA-состояния — выбрать решение, совместимое с уже принятым правилом «переключение секции/таба — только локальное состояние, не отдельный route», Задача 15/24).
- `workspace.js`'s `mount()` — принять опциональные `initialRole`/`initialTab`/`initialPtcId` и применить их при первом рендере (роль — до `loadShell()`, таб — после первого `buildTabSet()`, аналогично `resolveActiveTab`'s логике, но для начального перехода, не для переключения issue).
- Клик по human-задаче — таб «Дела» должен стать активным сразу (полезно только после Задачи 30 — до неё таб останется заглушкой, но переключение на него уже должно работать).

**Acceptance Criteria:**
- [x] TC-020 passes (шаг 3 — клик ведёт на нужную роль/таб/чек-лист целиком, не только на верный проект+issue)

---

#### Task 34 (fix CR-006): `public/workspace.js` — восстановить действие подготовки тестовых данных

**Task Type:** code
**Mapped Test Cases:** TC-031

**Files:**
- `tools/manual-test-ui/public/workspace.js`

**Implementation Notes:**
- Старый `app.js` рендерил checkout-баннер и кнопки `POST .../prepare`/`.../checklist/checkout` для веток `kind: "action"` (`buildRoleContents`'s ответ, `server.js`) — новый `renderDocPanel` не рендерит для этой ветки ничего, кроме заголовочных полей.
- Восстановить действие: для `item.kind === "action"` — рендерить понятную кнопку/баннер, вызывающую тот же существующий серверный маршрут (не трогать `lib/git.js`/`server.js` — точки входа не изменились, изменилась только визуальная оболочка, симметрично остальному редизайну).
- Подтверждение перед checkout — сохранить (не убирать существовавшую защиту от случайного переключения ветки).

**Acceptance Criteria:**
- [x] TC-031 passes (шаг 4 — checkout по подтверждению снова доступен из UI)

**Addendum (найдено при `/pf-user-docs`, не в исходном скоупе TC-031):** старый
`app.js` (строка 933) рендерил кнопку `Prepare test data for ${tc.id}` для
каждого TC отдельно, в дополнение к кнопке на уровне всей issue — эта задача
восстановила только последнюю. Серверный `tc.prepare` уже существовал
(`server.js`, идентичная форма `parsed.prepare`), клиент его просто не читал.
Дописано: `buildPrepareActionNode` принимает опциональный `tcId`,
`renderChecklistBody` вызывает его на каждый TC. 4 новых теста в
`workspace-ui.test.js`.

---

### Dependencies section

**Prerequisite — блокирует сам вызов `/pf-execute`, не отдельную задачу.** См. раздел «Prerequisite» в начале документа: референсные скриншоты GLog v.0.7 и строка owner sign-off в `session-log.md` — это внешний, не-агентный шаг (AC-02k), который должен быть завершён владельцем **до** старта `/pf-execute` для этой issue целиком; он не диспетчеризуется `/pf-execute` как первая из задач ниже, а предшествует самому запуску.

**Задачи 29-34 (эскалация code review, раунд 1) — file-exclusivity.** Задачи 29, 30, 33, 34 все пишут `public/workspace.js` — не могут выполняться в одной волне друг с другом (тот же принцип file-exclusivity, применённый и к волнам 4-13 исходного прохода). Задача 31 (`style.css`) и Задача 32 (`lib/roles-resolve.js`/`lib/inbox.js`/`skills/pf-close/SKILL.md`) не пересекаются ни с `workspace.js`, ни друг с другом — каждая может идти параллельно с одной из workspace.js-задач. Рекомендуемые волны: {29, 31}, {30, 32}, {33}, {34} — либо любая другая группировка, уважающая то же ограничение.

**Task ordering:**

1. **Задачи 1-3 (framework-скиллы) — перед Задачей 4.** `lib/roles-resolve.js` реализует поле `mode` и обработку `kind: human` по схеме, которую определяет Задача 1 (`pf-roles/SKILL.md` §1/§2/§4) — без снятого hard-stop и определённого поля `mode` резолвер нечего резолвить корректно. Задачи 2 и 3 (pf-close/pf-autopilot) не зависят друг от друга и не блокируют ничего в `tools/manual-test-ui/` — могут выполняться параллельно с Задачами 4+.
2. **Задача 4 (`lib/roles-resolve.js`) — перед Задачами 7, 10, 11, 12.** Все серверные маршруты, резолвящие роль (`GET /api/inbox`'s `humanTasks[]`, `GET/POST .../human-tasks/*`), читают через этот модуль.
3. **Задача 5 (тесты `roles-resolve`) — сразу после Задачи 4**, до Задачи 7 (не строго обязательно, но логично: ловит регрессии парсера раньше, чем на него начинают полагаться другие маршруты).
4. **Задача 6 (`lib/inbox.js` manualTests) — независима от Задачи 4**, может выполняться параллельно с Задачами 1-5. **Задача 7 (`GET /api/inbox`, полная — с `humanTasks[]`) зависит и от Задачи 4, и от Задачи 6.**
5. **Задача 8 (тесты `inbox`) — после Задачи 7.**
6. **Задача 9 (empty-Result проверка) — независима**, может выполняться в любой момент; логически стоит перед Задачей 10 (обе трогают чек-лист/human-задачи), но не блокирует её технически.
7. **Задачи 10-12 (human-tasks эндпоинты) — после Задачи 4.** Задача 11 зависит от новых обёрток `lib/git.js`, которые она сама и вводит — самодостаточна. Задача 12 не зависит от 10/11.
8. **Задача 13 (тесты human-tasks) — после Задач 9-12.**
9. **Задача 14 (`readonly.test.js`) — последняя из серверного трека**, после Задач 10, 11, 12 (инвентаризация новых маршрутов и git-подкоманд должна фиксировать уже существующий код, не опережать его).
10. **Задача 15 (`public/inbox.js`) — после Задачи 7** (потребляет `GET /api/inbox`).
11. **Задачи 16-22 (CSS-токены/типографика/панели/шрифты/фокус) — независимы от серверного трека (Задачи 1-15)**, могут выполняться в любой момент параллельно с ним. Задача 17 (замена литералов) — после Задачи 16 (нужны новые токены, на которые заменять). Задача 18 (`test/contrast.test.js`) — после Задач 16-17 (проверяет финальные значения). Задача 20 (`.panel`) использует токены Задачи 16. TC-012/TC-015 (manual, внутри Задач 20/22) требуют готовых Задач 23-27 для живой проверки — их acceptance формально закрывается позже остального содержимого этих задач.
12. **Задачи 23-27 (навигационная оболочка) — после Задачи 7 (для `.inbox-card`/`GET /api/inbox` в Задаче 23 и таба «Дела» в Задаче 25) и предпочтительно после Задач 16, 20, 21, 22 (используют новые CSS-классы `.panel`/`.panel-table`/`:focus-visible`)** — не строго блокирующая зависимость (можно верстать на старых классах и перестилизовать), но так дешевле.
13. **Задача 28 (регрессия US-08) — последняя**, после всех остальных: финальная сверка, что редизайн не сломал уже работающие гарантии.

**Внешние зависимости:**
- Prerequisite (см. выше) зависит от владельца (референсные скриншоты GLog v.0.7, устные критика/выбор по процессу Non-Goals) — не от какой-либо из пронумерованных задач.
- Все framework-скилл-задачи (1-3) требуют, чтобы `~/.claude/skills/` были синхронизированы через `scripts/update-skills.sh` после мержа этой issue — вне scope самого плана, но нужно для того, чтобы правки реально повлияли на будущие `pf-*`-вызовы в других проектах.

**Known limitation — `write: human` на `code`/`tests` в `/pf-execute` (не закрывается этой issue).** BRD's AC-05j допускает, что `roles.<key>.write: human` может быть вручную выставлен для любого ключа пайплайна, включая `code`/`tests` — не только для `brd`/`specs`/`test_plan`/`implementation_plan`/`user_docs`/`dev_docs`. Эта issue **не добавляет** обработку `write: human` в сам `/pf-execute`: если будущий `prompt.md` выставит `roles.code.write: human` (или `roles.tests.write: human`), текущий двухветочный диспетчер `/pf-execute` (`claude` / не-`claude` через `codex-companion`, `skills/pf-execute/SKILL.md`) этот случай не учитывает. `specs.md`'s G8/§4.1 называет в скоупе только `pf-roles`/`pf-close`/`pf-autopilot`, не `pf-execute` — это осознанно **не** исправляется здесь, а явно фиксируется как пробел для будущей issue, чтобы не быть молча забытым.

---

### Complexity Estimate

**Complex** (6+ задач — фактически 28 задач). Обоснование: issue затрагивает три независимых подсистемы (навигационная оболочка с разбиением `app.js` на три ES-модуля; единый инбокс и полноценная реализация актора `human` с новым YAML-подмножеством, hash-based stale-проверкой и тремя разными путями валидации выполнения; палитра/типографика/a11y с автоматической контрастной проверкой) плюс три независимо редактируемых framework-скилл-файла вне `tools/manual-test-ui`, с ~32 test cases, покрывающими UI, API и skill-файлы одновременно.

---

### Phased Rollout

Фазировка добавляет реальную ценность здесь — не ради ритуала, а потому что часть работы буквально не компилируется без предыдущей:

- **Фаза 0 — Prerequisite (владелец).** Референсные скриншоты + owner sign-off — см. раздел «Prerequisite» выше, не пронумерованная задача. Ничего из следующего не стартует без неё, и сам `/pf-execute` не запускается до неё.
- **Фаза 1 — framework-скиллы.** Задачи 1-3. Разблокирует схему (`mode`, снятый hard-stop), без которой `lib/roles-resolve.js` не может резолвить `kind: human` корректно.
- **Фаза 2 — human-очередь и инбокс (серверный трек).** Задачи 4-15. Самостоятельный содержательный слой; тестируется полностью через API/lib, без браузера — весь трек можно закрыть и провалидировать (`node --test`) до того, как навигационная оболочка вообще существует.
- **Фаза 3 — палитра/типографика/a11y (CSS-трек).** Задачи 16-22. Полностью независима от Фазы 2, может идти параллельно с ней (или до, или после) — единственная внутренняя зависимость — порядок токены → замена литералов → контраст-тест.
- **Фаза 4 — навигационная оболочка.** Задачи 23-27. Собирает Фазы 2 и 3 воедино (инбокс-карточка и таб «Дела» потребляют API Фазы 2; разметка использует CSS-паттерны Фазы 3) — последняя содержательная фаза, где UI впервые становится демонстрируемым целиком.
- **Фаза 5 — финальная регрессия.** Задача 28.

Ручные TC TC-012 и TC-015, лежащие внутри Задач 20/22, физически закрываются только после того, как Фаза 4 сделала экран демонстрируемым — это не отдельная фаза, а свойство manual-типа этих TC, уже отражённое в Dependencies выше. TC-013 (owner sign-off) закрывается ещё в Фазе 0, до старта `/pf-execute` — см. раздел «Prerequisite».
