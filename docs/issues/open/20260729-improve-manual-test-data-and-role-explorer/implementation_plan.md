## Implementation Plan: Подготовка тестового кейса и ролевой project explorer в Manual Test UI

### Overview

Issue состоит из двух равнозначных частей, и план ведёт их параллельно, сходясь на общем
серверном ядре Manual Test UI.

**Часть A — подготовка кейса.** `/pf-test-plan` объявляет требуемые кейсу данные в поле
**Test Data**; `/pf-test` порождает `docs/issues/<status>/<ID>/test-data/` (фикстуры под git +
идемпотентный `setup.mjs` из шаблона) и доводит расположение подготовленных данных до
предусловий чек-листа; Manual Test UI исполняет этот скрипт по whitelist-пути, без shell, по
подтверждению, с таймаутом и полным отчётом. Рабочая копия разворачивается в
`os.tmpdir()/pf-test-data/<ISSUE-ID>/<TC-ID>` — вне репозитория, чтобы `git status --porcelain`
оставался пустым и не ломались ни `checkout` в UI, ни гейт `/pf-qa`.

**Часть B — ролевой explorer.** UI становится role-first: три вкладки верхнего уровня, чек-лист —
один из экранов вкладки QA. Соответствие «роль → документы», состояния документов, инструкции
проекта и память отдаёт сервер; клиент только отображает. Markdown-рендерер и таблица ролей —
модули с двойной загрузкой (Node + браузер), поэтому проверяются из `node --test` без браузерной
инфраструктуры. Ни одной npm-зависимости не добавляется: только стандартная библиотека Node и
встроенный `node --test`.

Первой же задачей расширяется `Makefile`: сегодня `make test` не запускает
`tools/manual-test-ui/test/*.test.js` вовсе (существующий `checklist-ru.test.js` не исполнялся ни
разу), а `/pf-test` знает ровно один раннер. Без этого ни один `Auto`-кейс не получил бы вердикта
и issue не прошёл бы гейт `.qa-workflow.md`.

**Инварианты, которые нельзя нарушить ни одной задачей:**

- точечный патч строки чек-листа (`patchStepResult`/`patchNotes`) не переписывается — только
  дополняется чтение;
- гард на грязное рабочее дерево при `checkout` остаётся; `checkout` — по-прежнему единственная
  изменяющая git-команда;
- три состояния чек-листа (`here` / `on_branch` / `missing`) и перечисление issue с default-ветки
  через `git ls-tree` сохраняются;
- изменяющих действий ровно три: отметки и заметки в чек-листе, `checkout` по подтверждению,
  подготовка кейса;
- `test/lib.sh` и `test/converge-*.sh` этим issue **не изменяются** (в них живут собственные
  литералы `TC-001…TC-020`, правка дала бы ложное сопоставление в `/pf-test`).

**Общие конвенции, обязательные для всех задач:**

1. **Двойная загрузка модуля** (`lib/markdown.js`, `lib/roles.js`) — UMD-обёртка без сборщика:

   ```js
   (function (root, factory) {
     if (typeof module === "object" && module.exports) module.exports = factory();
     else root.PFMarkdown = factory();
   })(typeof self !== "undefined" ? self : this, function () { /* ... */ });
   ```

   При загрузке модуль не обращается ни к `document`, ни к `window`; импортирует только
   `node:`-встроенные модули (лучше — ничего).

2. **Отдача таких модулей браузеру** — маршрут `/lib/<basename>.js` из явного allowlist
   `["markdown.js", "roles.js"]` в `tools/manual-test-ui/lib/`; отсутствующий файл → 404, любой
   другой basename → 403.

3. **Переменные окружения тестов:** `PLANNING_TEST_UI_CONFIG` (уже есть), новые —
   `PLANNING_TEST_UI_MEMORY_ROOT` (корень памяти, по умолчанию `~/.claude`),
   `PLANNING_TEST_UI_PREPARE_TIMEOUT_MS` (таймаут подготовки, по умолчанию 60000).

4. **Slug каталога памяти** вычисляется по фактической раскладке машины: абсолютный путь проекта,
   в котором каждый разделитель пути заменён на `-` (`/home/stac/dev/planning-framework` →
   `-home-stac-dev-planning-framework`), остальные символы сохраняются как есть.

5. **Порт в тестах** — всегда `listen(0)` со случайным свободным портом, никогда фиксированный
   4317: сьюты обязаны переживать параллельный прогон и занятый порт.

---

### Files to Create/Modify

**Create — инструмент:**

| Файл | Зачем |
|---|---|
| `tools/manual-test-ui/lib/markdown.js` | Собственный markdown-рендерер (таблицы, код, frontmatter, экранирование HTML), двойная загрузка |
| `tools/manual-test-ui/lib/roles.js` | Таблица «роль → документы» и правила применимости по типу/тиру, двойная загрузка |
| `tools/manual-test-ui/lib/docstate.js` | Состояние документа: `present` / `missing` (+ стадия) / `not_applicable`, чтение с диска и с ветки |
| `tools/manual-test-ui/lib/paths.js` | Путевая валидация: `realpath` + `path.relative`, allowlist префикса памяти |
| `tools/manual-test-ui/lib/instructions.js` | Сбор действующих `CLAUDE.md` (вложенные + унаследованные), пометка недействующих |
| `tools/manual-test-ui/lib/memory.js` | Перечень `memory/*.md` по slug проекта, исключение транскриптов сессий |
| `tools/manual-test-ui/lib/prepare.js` | Запуск `setup.mjs` по whitelist-пути без shell, таймаут, отчёт, классификация видимости действия |

**Create — тесты инструмента (`tools/manual-test-ui/test/`):**

| Файл | Зачем |
|---|---|
| `helpers/fixtures.js` | Построение фикстурных git-репозиториев, issue-каталогов, корня памяти во временном каталоге |
| `helpers/server.js` | Подъём сервера на фикстурной конфигурации (`listen(0)`), HTTP-хелперы, гарантированная остановка |
| `helpers/snapshot.js` | Слепок дерева (относительные пути + sha256) и его сравнение |
| `markdown.test.js` | TC-009 |
| `checklist-patch.test.js` | TC-013 |
| `prepare.test.js` | TC-002 |
| `prepare-idempotency.test.js` | TC-003 |
| `prepare-repo-state.test.js` | TC-004 |
| `prepare-report.test.js` | TC-005 |
| `prepare-security.test.js` | TC-010 |
| `prepare-visibility.test.js` | TC-018 |
| `roles.test.js` | TC-006 |
| `doc-states.test.js` | TC-007 |
| `dev-sources.test.js` | TC-008 |
| `read-paths.test.js` | TC-011 |
| `readonly.test.js` | TC-012 |
| `checklist-git.test.js` | TC-014 |
| `multi-project.test.js` | TC-017 |
| `fixtures/renderer-kitchen-sink.md`, `fixtures/renderer-kitchen-sink.crlf.md`, `fixtures/renderer-xss.md` | Фикстуры рендерера |
| `fixtures/checklist-crlf.md`, `fixtures/checklist-mixed-eol.md`, `fixtures/checklist-unknown-sections.md`, `fixtures/checklist-mixed-lang.md`, `fixtures/checklist-declared-data.md` | Фикстуры чек-листа |

**Create — прочее:**

| Файл | Зачем |
|---|---|
| `test/manual-test-ui.sh` | Новый bash-сьют: TC-001 (текст скиллов), TC-015 (отсутствие зависимостей), TC-016 (`make test`) |
| `skills/pf-test/templates/setup.mjs` | Шаблон идемпотентного скрипта подготовки, из которого `/pf-test` порождает `test-data/setup.mjs` |
| `docs/issues/open/20260729-improve-manual-test-data-and-role-explorer/test-data/setup.mjs` + `test-data/fixtures/**` | Данные двух ручных проверок этого issue (TC-019, TC-020) |

**Modify:**

| Файл | Зачем |
|---|---|
| `Makefile` | Цель `test` охватывает `tools/manual-test-ui/test/*.test.js` отдельной секцией с заголовком |
| `tools/manual-test-ui/server.js` | Новые маршруты (роли, документы, инструкции, память, подготовка), усиленная путевая валидация, отдача модулей `/lib/*.js` |
| `tools/manual-test-ui/lib/checklist.js` | Разбор блока требуемых данных кейса и пути подготовленных данных; парсинг и патч существующего формата не меняются |
| `tools/manual-test-ui/public/index.html` | Три вкладки ролей верхнего уровня, область документа, экран чек-листа внутри вкладки QA |
| `tools/manual-test-ui/public/app.js` | Role-first навигация, рендеринг документов через `/lib/markdown.js`, кнопки подготовки; собственного перечня документов нет |
| `tools/manual-test-ui/public/style.css` | Вёрстка вкладок, области документа, таблиц и блоков кода |
| `skills/pf-test-plan/SKILL.md` | Требование заполнять **Test Data** для каждого Manual TC файлами и фикстурами |
| `skills/pf-test/SKILL.md` | Порождение `test-data/` из шаблона, перенос требуемых данных и пути рабочей копии в чек-лист, коммит через `pf-git` |
| `tools/manual-test-ui/README.md` | Роли, новые маршруты API, подготовка кейса, отсутствие зависимостей |
| `skills/pf-manual-test/SKILL.md` | Одна фраза о том, что UI теперь role-first и умеет подготовку кейса |

---

### Implementation Tasks

#### Task 1: `make test` исполняет node-сьюты Manual Test UI

**Mapped Test Cases:** TC-016

**Files:**
- `Makefile` — modify: цель `test` получает вторую ветку `node --test` для `tools/manual-test-ui/test/*.test.js`
- `test/manual-test-ui.sh` — create: скелет нового bash-сьюта и блок проверок TC-016

**Implementation Notes:**
- В цели `test` (`Makefile:36-45`) сейчас ровно одна node-ветка. Добавить вторую по образцу
  первой: собственный счётчик наличия файлов, `printf '\n=== node --test tools/manual-test-ui/test/\n'`
  (заголовок обязателен — по нему `/pf-test` отличает секцию в выводе), затем
  `node --test "tools/manual-test-ui/test/*.test.js" || rc=1`. Ветка `onboarding-tui` остаётся
  нетронутой.
- Именно `|| rc=1`, а не `;` — падение нового сьюта обязано валить весь `make test`.
- Сьют `test/manual-test-ui.sh` начинается как `test/skills-static.sh`: shebang, комментарий-шапка,
  `. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"`, разделы по TC, `pf_summary` в
  конце. Файл попадает под гейт `shellcheck scripts/*.sh test/*.sh` — писать сразу чисто.
- Блок TC-016: шаг 1 — grep `Makefile` на glob; шаги 2, 3, 6 — `make -n test` (печать без
  исполнения; рекурсивный `make test` изнутри своего же прогона недопустим) и проверка
  напечатанного рецепта на вызов `node --test`, на заголовок секции и на `|| rc=1`; шаг 4 —
  прямой прогон `node --test "tools/manual-test-ui/test/*.test.js"`, в выводе ожидаются
  `checklist-ru.test.js` и `# fail 0`; шаг 5 — рецепт по-прежнему содержит
  `tools/onboarding-tui/test/*.test.js`.
- Метки ассертов — ровно те строки `pf_pass`, что заданы в тест-плане: по ним `/pf-test`
  сопоставляет шаги.
- Задача создаёт файл сьюта; блоки TC-001 и TC-015 дописывают Task 7 и Task 15 в более поздних
  волнах — параллельная запись в этот файл запрещена.

**Acceptance Criteria:**
- [ ] TC-016 passes

---

#### Task 2: Модуль markdown-рендерера

**Mapped Test Cases:** TC-009

**Files:**
- `tools/manual-test-ui/lib/markdown.js` — create: рендерер, двойная загрузка
- `tools/manual-test-ui/test/markdown.test.js` — create: проверки TC-009
- `tools/manual-test-ui/test/fixtures/renderer-kitchen-sink.md`, `.crlf.md`, `renderer-xss.md` — create: фикстуры

**Implementation Notes:**
- Никаких зависимостей: собственный построчный парсер. Порядок обработки: сначала экранирование
  HTML во всём исходном тексте (`& < > " '`), потом разметка — так произвольное содержимое
  документа физически не может стать исполняемым элементом.
- Обязательный минимум конструкций: YAML frontmatter (`---` в первой строке → отдельный блок, не
  таблица и не `<hr>`), заголовки H1–H6, вложенные и нумерованные списки, блок кода в тройных
  обратных кавычках (внутри — никакой markdown-интерпретации), инлайн-код, ссылки, таблицы.
- Таблицы — главное: строка-разделитель (`---`, `:---`, `---:`, `:---:`) распознаётся и в данные
  не попадает; заголовки идут в `<th>`, данные в `<td>`; число ячеек в строке выравнивается по
  заголовку; экранированный `\|` внутри ячейки не разрывает её и печатается как `|`.
  Расхождение с `lib/checklist.js` (он `\|` не поддерживает намеренно) зафиксировано как KI-04 —
  парсер чек-листа **не трогать**.
- Ссылка с `javascript:` в URL не должна давать кликабельный переход: схема не в
  allowlist (`http`, `https`, `mailto`, относительные пути) → отдать текстом, без `href`.
- Нормализация переводов строк первым делом: `text.replace(/\r\n/g, "\n")` — вывод CRLF-варианта
  обязан совпасть с LF-вариантом байт в байт.
- Тесты импортируют модуль напрямую и сверяют возвращаемую строку HTML; DOM не участвует.
  Отдельная проверка (шаг 8): модуль не импортирует ничего, кроме `node:`-встроенного, и при
  загрузке не обращается к `document`/`window` (достаточно `require` в чистом Node-процессе, где
  этих глобалей нет).

**Acceptance Criteria:**
- [ ] TC-009 passes

---

#### Task 3: Тестовый харнесс и регресс точечной записи в чек-лист

**Mapped Test Cases:** TC-013

**Files:**
- `tools/manual-test-ui/test/helpers/fixtures.js` — create: фикстурные git-репозитории, issue-каталоги, корень памяти
- `tools/manual-test-ui/test/helpers/server.js` — create: подъём и остановка сервера, HTTP-хелперы
- `tools/manual-test-ui/test/helpers/snapshot.js` — create: слепок дерева и его сравнение
- `tools/manual-test-ui/test/checklist-patch.test.js` — create: проверки TC-013
- `tools/manual-test-ui/test/fixtures/checklist-crlf.md`, `checklist-mixed-eol.md`, `checklist-unknown-sections.md`, `checklist-mixed-lang.md` — create: фикстуры чек-листа

**Implementation Notes:**
- `helpers/fixtures.js` — общий фундамент почти всех node-сьютов. Обязательный набор:
  - `makeTempRepo({ issues, branches })` — каталог в `os.tmpdir()`, `git init`, ветка `develop`,
    коммит; при необходимости ветка `issue/<ID>` с дополнительными файлами; `user.email`/`user.name`
    задаются локально в репозитории, чтобы прогон не зависел от глобального `.gitconfig`;
  - фикстурные issue из тест-плана как декларативные описания:
    `20260101-feat-fixture-full`, `20260102-improve-fixture-nospec`, `20260103-bug-fixture-analysis`,
    `20260104-feat-fixture-onbranch`, `20260105-improve-fixture-trivial`, `20260106-feat-fixture-noqa`,
    `20260107-feat-fixture-twocases`, `20260108-feat-fixture-nodata`, `20260109-feat-fixture-declared`,
    `20260110-improve-fixture-legacy`, `20260111-feat-fixture-noscript`,
    `docs/issues/closed/20260112-feat-fixture-closed`;
  - два жёстких ограничения фикстур: все ID обязаны проходить `ISSUE_ID_RE` (`server.js:22`), а
    issue, документы которого лежат только на ветке, обязан иметь на `develop` хотя бы
    `prompt.md`, иначе его каталога не будет в `git ls-tree`. Пустые каталоги — через `.gitkeep`;
  - `makeMemoryRoot()` — раскладка `<memRoot>/projects/<slug>/memory/*.md`, рядом с `memory/` —
    `*.jsonl` и `sessions-index.json`;
  - `makeConfig({ projects })` — временный `projects.json` + путь для `PLANNING_TEST_UI_CONFIG`;
    реальный `tools/manual-test-ui/projects.json` в автотестах не используется никогда.
  - Всё создаётся в `fs.mkdtempSync(path.join(os.tmpdir(), ...))` и удаляется в `after`/`t.after`,
    в том числе при падении теста.
- `helpers/server.js` — запуск сервера в текущем процессе или дочерним `fork`, всегда на
  `listen(0)`; хелпер возвращает базовый URL и `stop()`. Если сервер сегодня не экспортирует
  фабрику, вынести создание `http.Server` в экспортируемую функцию `createServer(projects)`,
  оставив `main()` тонкой обёрткой — без изменения поведения запуска.
- `helpers/snapshot.js` — `snapshot(dir)` → отсортированный список `{relPath, sha256}`;
  `assertSameSnapshot(a, b, msg)`.
- TC-013 — чистый регресс существующего поведения, `lib/checklist.js` в этой задаче **не
  меняется**: шаг 1 — прогон существующего `checklist-ru.test.js` без правок; шаг 2 — правка
  одного шага, все остальные строки байт в байт прежние; шаг 3 — правка только строки
  `**Notes:**`; шаг 4 — `|` в заметке нормализуется в `/` (текущее поведение `patchStepResult` —
  эталон); шаги 5-6 — CRLF и смешанные переводы строк (весь файл пишется CRLF — зафиксированное
  поведение `detectEol`, это ожидаемый результат, а не дефект); шаг 7 — непонятые парсером секции
  (проза, посторонняя таблица между TC) уцелели.
- Фикстуры чек-листов писать с одинарным пробелом вокруг каждого `|`, иначе сравнение «остальные
  строки прежние» даст ложный провал на выравнивании, которое `patchStepResult` не сохраняет.

**Acceptance Criteria:**
- [ ] TC-013 passes

---

#### Task 4: Разбор объявленных кейсу данных в чек-листе

**Mapped Test Cases:** TC-018 (шаг 1 — классификация парсером)

**Files:**
- `tools/manual-test-ui/lib/checklist.js` — modify: разбор блока требуемых данных и пути подготовленных данных
- `tools/manual-test-ui/test/fixtures/checklist-declared-data.md` — create: фикстура с тремя видами кейсов
- `tools/manual-test-ui/test/prepare-visibility.test.js` — create: шаг 1 TC-018 (остальные шаги дописывает Task 10)

**Implementation Notes:**
- Формат, который будет писать `/pf-test` (Task 7) и читать парсер — внутри секции TC:

  ```
  **Требуемые данные:**
  - `prelude/common.json`
  - `case-a/input.txt`
  ```

  Английский вариант метки — `**Test Data:**`. Явная пометка «данные не требуются» — та же метка
  со значением в одну строку: `**Требуемые данные:** не требуются` (англ. `none`).
  Путь развёрнутой рабочей копии живёт отдельным буллетом в блоке предусловий:
  `- Подготовленные данные: <путь>` (англ. `- Prepared data: <path>`).
- Новые поля каждого TC: `requiredData: string[]`, `dataStatus: "declared" | "none" | "unknown"`,
  `preparedPath: string | null`. `unknown` — именно строка, а не `undefined`: легаси-issue должен
  отличаться от кейса, про который известно, что данные не нужны.
- Прозаические предусловия («поднять сервис X») остаются в `prerequisites` и в `requiredData` не
  попадают — граница ответственности проходит по метке, а не по эвристике.
- **Ничего из существующего поведения не менять:** `patchStepResult`, `patchNotes`, `splitCells`,
  `detectEol`, разбор шагов и предусловий остаются как есть. Новая метка обрабатывается там же,
  где `NOTES_LABEL_RE` — отдельным регэкспом, дополнительным `if` в цикле по секции.
- Регресс: `checklist-ru.test.js` и `checklist-patch.test.js` обязаны проходить без правок.

**Acceptance Criteria:**
- [ ] TC-018 (шаг 1) passes — окончательный вердикт по TC-018 даёт Task 10

---

#### Task 5: Шаблон `setup.mjs` и движок подготовки

**Mapped Test Cases:** TC-002, TC-003, TC-004

**Files:**
- `skills/pf-test/templates/setup.mjs` — create: шаблон идемпотентного скрипта подготовки
- `tools/manual-test-ui/lib/prepare.js` — create: запуск скрипта и разбор его отчёта
- `tools/manual-test-ui/test/prepare.test.js` — create: TC-002
- `tools/manual-test-ui/test/prepare-idempotency.test.js` — create: TC-003
- `tools/manual-test-ui/test/prepare-repo-state.test.js` — create: TC-004

**Implementation Notes:**
- **Шаблон `setup.mjs`.** Один скрипт на issue, цель — необязательный аргумент: без аргументов
  готовится всё, `node setup.mjs TC-002` — только этот кейс. Устройство:
  - константы `ISSUE_ID` и `CASES` — карта `TC-ID → [относительные пути фикстур]`; общий prelude
    перечисляется в каждом кейсе, но имя файла prelude встречается в скрипте **ровно один раз**
    (шаг 6 TC-002 считает вхождения через `grep -c`) — то есть задаётся константой
    `const PRELUDE = ["prelude/common.json"]` и подмешивается в кейсы ссылкой на неё;
  - корень рабочей копии — `path.join(os.tmpdir(), "pf-test-data", ISSUE_ID, TC_ID)`; ровно эта
    формула записывается в предусловия чек-листа (Task 7), чтобы путь из отчёта и путь из
    чек-листа совпадали;
  - идемпотентность через staging + rename: сборка в
    `os.tmpdir()/pf-test-data/<ISSUE-ID>/.staging/<TC-ID>`, затем снос каталога кейса
    (`fs.rmSync(dir, { recursive: true, force: true })`) и `fs.renameSync` staging на место. При
    падении на середине каталог кейса либо не существует, либо равен прежнему консистентному
    состоянию — полуготового состояния не бывает. Staging чистится в начале и в конце каждого
    запуска;
  - неизвестный TC-ID → `exit 1` и внятная строка в stderr с самим ID; ни одного файла не
    создаётся;
  - платформенная независимость обязательна и проверяется: никакого `node:child_process`, никаких
    литералов `bash`/`powershell`/`cmd.exe`, никаких `\\` в строковых литералах путей — каждый
    путь собирается через `path.join`;
  - машиночитаемый отчёт: на каждый подготовленный кейс печатается строка
    `PF-PREPARED <TC-ID> <абсолютный путь>`, затем перечень файлов; `exit 0` при успехе.
  - Импорты — только `node:fs`, `node:path`, `node:os`, `node:url`.
- **`lib/prepare.js`** — программный вход инструмента, который вызывает и HTTP-маршрут (Task 9), и
  тесты. Экспортирует `runPrepare({ projectRoot, issueId, status, tcId, timeoutMs })`:
  - собирает путь скрипта сам:
    `path.join(projectRoot, "docs", "issues", status, issueId, "test-data", "setup.mjs")`;
  - запускает `execFile(process.execPath, [scriptPath, ...(tcId ? [tcId] : [])], { cwd, timeout, shell: false, maxBuffer })`
    — без shell, аргументы массивом, никакой интерполяции строк;
  - возвращает `{ ok, exitCode, timedOut, stdout, stderr, prepared: [{ tcId, workdir, files }] }`,
    разбирая строки `PF-PREPARED`; при отсутствии таких строк отчёт строится из сырого stdout.
- TC-002: шаги 1-3 — прогон `node setup.mjs` руками (без инструмента); шаг 4 — тот же кейс через
  `runPrepare` из `lib/prepare.js`, перечень файлов и путь обязаны совпасть (под «API инструмента»
  понимается именно этот программный вход, а не HTTP — так кейс не зависит от маршрутов);
  шаг 5 — чтение исходника на платформенную независимость; шаг 7 — сверка с блоком предусловий
  фикстурного чек-листа.
- TC-003: слепки через `helpers/snapshot.js`; порча рабочей копии (изменить, удалить, добавить
  лишнее) и восстановление до байтового совпадения; изоляция кейсов; тройной прогон подряд;
  краевые элементы фикстуры — вложенные каталоги, каталог с `.gitkeep`, файл с кириллицей
  (UTF-8 без BOM, побайтная сверка).
- TC-004 — самое дорогое требование: `git status --porcelain` пуст до и после не менее пяти
  разнородных запусков; `path.relative(repoRoot, workdir)` начинается с `..` и путь лежит внутри
  `os.tmpdir()`; `git ls-files docs/issues/open/<ID>/test-data/` перечисляет `setup.mjs` и все
  фикстуры; финальный шаг — перенос issue в `closed/` отдельным коммитом, `git clone --local` во
  временный каталог и прогон `node docs/issues/closed/<ID>/test-data/setup.mjs` в клоне.
- Фикстурный issue `20260107-feat-fixture-twocases` строится через `helpers/fixtures.js` (Task 3);
  его `test-data/setup.mjs` — экземпляр шаблона.

**Acceptance Criteria:**
- [ ] TC-002 passes
- [ ] TC-003 passes
- [ ] TC-004 passes

---

#### Task 6: Серверное ядро чтения: путевая валидация, инструкции проекта, память

**Mapped Test Cases:** TC-008, TC-011

**Files:**
- `tools/manual-test-ui/lib/paths.js` — create: `realpath` + `path.relative`, allowlist префикса памяти
- `tools/manual-test-ui/lib/instructions.js` — create: сбор действующих `CLAUDE.md`
- `tools/manual-test-ui/lib/memory.js` — create: перечень памяти по slug проекта
- `tools/manual-test-ui/server.js` — modify: маршруты чтения файла, инструкций и памяти; отдача `/lib/*.js`; замена префиксного сравнения
- `tools/manual-test-ui/test/dev-sources.test.js` — create: TC-008
- `tools/manual-test-ui/test/read-paths.test.js` — create: TC-011

**Implementation Notes:**
- **`lib/paths.js`** — единственное место, где решается «можно ли это читать»:
  `isInside(rootDir, candidatePath)` сравнивает `fs.realpathSync` обоих (для несуществующего пути —
  realpath ближайшего существующего предка + остаток) и требует, чтобы `path.relative(root, real)`
  не начинался с `..` и не был абсолютным. Это чинит и существующую слабость `server.js:195`
  (`startsWith`, который пропустил бы каталог-сосед `public-x`) — `serveStatic` переводится на ту
  же функцию.
- Разрешённых корней чтения ровно два: каталог проекта и один префикс памяти
  `<memRoot>/projects/<slug>/memory/`. Никаких других расширений. Нормализация выполняется **до**
  сравнения с префиксом, поэтому `memory/../../secrets.md` отвергается.
- Транскрипты сессий недоступны ни перечнем, ни напрямую: `*.jsonl` и `sessions-index.json`
  исключаются и в `lib/memory.js`, и в проверке чтения (AC-05c).
- **`lib/instructions.js`**: корневой `CLAUDE.md` проекта, все вложенные (обход каталога с
  пропуском `.git`, `node_modules`, `.claude`) и унаследованные от родительских каталогов вверх до
  корня ФС — последние с признаком `inherited: true`. Каждый элемент отдаётся со своим полным
  путём: одноимённые файлы обязаны быть различимы. Недействующие — с `active: false` и причиной:
  всё, что лежит под `test/fixtures/` или под `docs/planning/templates/`. Проект без единого
  `CLAUDE.md` → явное сообщение, а не пустой перечень.
- **`lib/memory.js`**: slug по общей конвенции (см. Overview, п. 4), корень — из
  `PLANNING_TEST_UI_MEMORY_ROOT` (в тестах реальный `~/.claude` не читается никогда). Три
  различимых состояния: файлы есть; каталога `memory/` нет («памяти по проекту нет»); каталог есть,
  но пуст. Пути с дефисами и не-ASCII символами обязаны сопоставляться верно.
- **Маршруты** (все GET, read-only):
  `/api/projects/:name/docs?path=<относительный путь>` — чтение файла проекта,
  `/api/projects/:name/instructions`, `/api/projects/:name/memory`,
  `/api/projects/:name/memory/file?path=<...>`.
  Любое нарушение путевой валидации → 4xx, содержимое не отдаётся; 500 недопустим.
- **Отдача модулей браузеру**: маршрут `/lib/<basename>.js` с allowlist
  `["markdown.js", "roles.js"]` (`roles.js` появится в Task 7 — отсутствующий файл отдаёт 404, это
  нормально). Любой другой basename → 403.
- Фикстура TC-011 с каталогом-соседом статики (`public-x/evil.js`) разворачивается во временной
  копии инструмента, а не в репозитории.

**Acceptance Criteria:**
- [ ] TC-008 passes
- [ ] TC-011 passes

---

#### Task 7: Скиллы `/pf-test-plan` и `/pf-test` + статический блок сьюта

**Mapped Test Cases:** TC-001

**Files:**
- `skills/pf-test-plan/SKILL.md` — modify: обязательное непустое **Test Data** для каждого Manual TC
- `skills/pf-test/SKILL.md` — modify: порождение `test-data/`, перенос данных и пути в чек-лист, коммит через `pf-git`
- `test/manual-test-ui.sh` — modify: дописать блок TC-001

**Implementation Notes:**
- `/pf-test-plan`: в структуру, передаваемую суб-агенту (Step 2 шаблона тест-кейса), добавить
  прямое предписание — для каждого TC с типом `Manual` поле **Test Data** обязано быть непустым и
  перечислять **файлы и фикстуры**, которые кейсу нужны. Тут же — граница ответственности:
  прозаические предусловия (поднять сервис, завести учётную запись, подготовить внешнюю систему)
  в **Test Data** не попадают, они остаются в Preconditions.
- `/pf-test`, Phase 5: перед записью чек-листа порождать
  `docs/issues/open/<ISSUE-ID>/test-data/` — фикстуры файлами и `setup.mjs` из
  `~/.claude/skills/pf-test/templates/setup.mjs`; в блок каждого Manual TC чек-листа переносить
  объявленные ему данные, а в блок предусловий — строку с расположением подготовленных данных
  (формула `<tmpdir>/pf-test-data/<ISSUE-ID>/<TC-ID>`), чтобы чек-лист оставался самодостаточным
  при чтении файлом, вне инструмента.
- Phase 7 расширить явным упоминанием: порождённый `test-data/` коммитится и пушится той же
  стадией через общую процедуру `~/.claude/skills/pf-git/SKILL.md` («Stage commit & push») — иначе
  рабочее дерево остаётся изменённым и падает гейт `/pf-qa` (AC-03b).
- **Критично:** запрет §5.3 на внутреннюю терминологию (`BRD`, `specs.md`, `/pf`, `SKILL.md`,
  `issue branch`, `Status Tracker`, `implementation plan`) остаётся в тексте **полностью** —
  шаг 7 TC-001 проверяет его целиком. Новые метки в чек-листе поэтому обиходные: «Требуемые
  данные», «Подготовленные данные».
- Блок TC-001 в `test/manual-test-ui.sh` — семь grep-проверок с точными метками `pf_pass` из
  тест-плана. Проверки статические, ничего не исполняют; предмет — текст двух скиллов в рабочей
  копии. Стиль ассертов — как в `test/skills-static.sh`; `shellcheck` обязан оставаться чистым.
- Задача не трогает код инструмента и потому идёт параллельно серверным волнам; в файл сьюта в
  этой волне пишет только она.

**Acceptance Criteria:**
- [ ] TC-001 passes

---

#### Task 8: Роли и состояния документов (серверный API)

**Mapped Test Cases:** TC-006, TC-007

**Files:**
- `tools/manual-test-ui/lib/roles.js` — create: таблица «роль → документы», двойная загрузка
- `tools/manual-test-ui/lib/docstate.js` — create: классификация состояния документа
- `tools/manual-test-ui/server.js` — modify: маршруты ролей и документов роли
- `tools/manual-test-ui/test/roles.test.js` — create: TC-006
- `tools/manual-test-ui/test/doc-states.test.js` — create: TC-007

**Implementation Notes:**
- **`lib/roles.js`** — ровно три роли со стабильными идентификаторами `analyst`, `developer`,
  `tester` и их наполнением:
  - `analyst`: `prompt.md`, `brd.md`, `analysis.md`, `notes.md`, `PLANNING.md`,
    `docs/planning/decisions.md`;
  - `developer`: `specs.md`, `implementation_plan.md`, `docs/planning/implementation-plan.md`,
    `docs/planning/session-log.md`, раздел инструкций проекта (`CLAUDE.md`) и раздел памяти;
  - `tester`: `test_plan.md`, `manual_test_checklist.md`, `qa_report.md`, `.qa-workflow.md` и
    действие подготовки кейса.
  Сверх объявленного роль не отдаёт ничего. Модуль чистый (данные + правила), без обращения к ФС,
  грузится и в Node, и в браузер.
- **`lib/docstate.js`** — три состояния и правило их выбора, именно в этом порядке:
  1. файл существует (на диске или на ветке issue) → `present`;
  2. документ не порождается пайплайном для данного типа и тира → `not_applicable`;
  3. иначе → `missing` с указанием порождающей стадии.
  Существование побеждает применимость намеренно: иначе реально лежащий в каталоге документ
  оказался бы скрыт.
  Правила применимости: `size_tier: trivial` → `brd.md`/`analysis.md`/`specs.md`/
  `implementation_plan.md` неприменимы, их заменяет `notes.md`; тип `bug` → `brd.md` неприменим,
  применим `analysis.md`; типы `feat`/`improve` → наоборот. Карта стадий:
  `brd.md`/`notes.md` → `/pf-brd`, `specs.md` → `/pf-spec`, `test_plan.md` → `/pf-test-plan`,
  `implementation_plan.md` → `/pf-impl-plan`, `manual_test_checklist.md` → `/pf-test`,
  `qa_report.md` → `/pf-qa`. Тип и тир читаются из `prompt.md` (frontmatter); при их отсутствии —
  консервативный дефолт `medium` (зафиксировано как KI-03).
- **Документ только на ветке:** если файла нет на диске, issue открыт и ветка `issue/<ID>`
  существует — содержимое берётся через `git.showFile` (уже есть в `lib/git.js`), помечается
  `readonly: true`, в ответе указывается имя ветки и предлагается переключение. Само переключение —
  существующий маршрут `checkout` с его гардом, без изменений.
- **Закрытый issue:** документы читаются наравне с открытыми, из `docs/issues/closed/<ID>/`.
- **Маршруты:** `GET /api/roles` (перечень ролей),
  `GET /api/projects/:name/issues/:id/roles/:role` (наполнение роли со статусами каждой позиции).
  Сервер не хранит выбранную роль: ответы не зависят ни от порядка запросов, ни от предыдущих —
  это проверяется явно (TC-006, шаг 6).
- Ни одна позиция роли не бывает пустой: у каждой либо `present`, либо `not_applicable`, либо
  `missing` со стадией (TC-007, шаг 6).
- В этой волне `server.js` правит только эта задача.

**Acceptance Criteria:**
- [ ] TC-006 passes
- [ ] TC-007 passes

---

#### Task 9: Prepare API: whitelist, отсутствие shell, подтверждение, таймаут, отчёт

**Mapped Test Cases:** TC-005, TC-010

**Files:**
- `tools/manual-test-ui/server.js` — modify: маршрут подготовки кейса и issue целиком
- `tools/manual-test-ui/lib/prepare.js` — modify: таймаут, отчёт о неуспехе, уборка после провала
- `tools/manual-test-ui/test/prepare-report.test.js` — create: TC-005
- `tools/manual-test-ui/test/prepare-security.test.js` — create: TC-010

**Implementation Notes:**
- Маршрут: `POST /api/projects/:name/issues/:id/prepare` с телом `{ confirm: true, tcId? }`.
  Без `confirm` — отказ, скрипт не запускается (как у существующего `checkout`). `tcId`
  валидируется отдельным регэкспом `^TC-\d{3}$`.
- **Путь собирает сервер**, из проверенного `ISSUE_ID_RE` (`server.js:22`) issue-id и статуса из
  ровно двух допустимых значений (`open`/`closed`). Любое поле пути в теле запроса игнорируется
  либо приводит к отказу — клиент произвольный путь не передаёт. Обход каталога, абсолютный путь,
  `..%2f..`, символы шелл-инъекции (`; rm -rf`, `$(id)`, обратные кавычки) отсекаются валидацией
  с кодом 4xx; скрипт-приманка вне разрешённых каталогов не должен исполниться ни разу.
- Запуск — `execFile` с массивом аргументов и без `shell: true`; интерполяции строки в команду нет
  нигде. Это проверяется в том числе чтением исходников сервера (TC-010, шаг 5).
- Действие для закрытого issue отклоняется на уровне маршрута (4xx): whitelist-путь структурно
  покрывает и `open`, и `closed` (тестировщик может запустить скрипт закрытого issue руками), но
  само действие в инструменте закрытому issue не предлагается — AC-04i.
- Таймаут — асинхронный запуск (`execFile` с колбэком/промисом), сервер продолжает отвечать: любой
  параллельный GET во время зависшего скрипта обязан вернуть 200. По истечении
  `PLANNING_TEST_UI_PREPARE_TIMEOUT_MS` (тестовая конфигурация — 2 с) процесс убивается, ответ
  помечается как неуспех с причиной «превышено время».
- Отчёт при успехе: перечень подготовленного, путь рабочей копии, stdout, stderr, код возврата 0.
  При неуспехе: признак неуспеха, текст stderr, ненулевой код возврата.
- После неуспеха и после таймаута полуготового состояния не остаётся: рабочая копия либо
  отсутствует, либо равна предыдущему консистентному слепку (staging + rename из Task 5), а
  каталог `.staging` вычищается серверной стороной. Следующая подготовка корректным скриптом
  обязана пройти без ручной чистки.
- Issue без `test-data/setup.mjs` → внятный отказ 4xx («подготовка для этого issue не объявлена»),
  не 500 и не молчание.
- В этой волне `server.js` правит только эта задача.

**Acceptance Criteria:**
- [ ] TC-005 passes
- [ ] TC-010 passes

---

#### Task 10: Классификация потребности в данных и правило приоритета видимости

**Mapped Test Cases:** TC-018

**Files:**
- `tools/manual-test-ui/lib/prepare.js` — modify: функция видимости действия по кейсу и по issue
- `tools/manual-test-ui/server.js` — modify: выдача видимости в наполнении роли «тестировщик» и в ответе чек-листа
- `tools/manual-test-ui/test/prepare-visibility.test.js` — modify: дописать шаги 2-7 TC-018

**Implementation Notes:**
- Правило приоритета — единственная функция, возвращающая
  `{ offered: boolean, enabled: boolean, reason: string | null }`:
  - `dataStatus === "none"` → `offered: false`, никаких сообщений об ошибке (знание о кейсе
    побеждает наличие каталога `test-data/` у issue);
  - `dataStatus === "declared"` и `setup.mjs` есть и чек-лист правится (`here`) → `offered: true`,
    `enabled: true`;
  - `dataStatus === "declared"`, но `setup.mjs` нет → `offered: true`, `enabled: false`, причина
    указывает на отсутствие скрипта подготовки (то же и на уровне issue целиком);
  - `dataStatus === "unknown"` (легаси-issue) → `offered: true`, `enabled: false`, с пояснением;
    отметки и заметки в таком чек-листе при этом работают полностью;
  - чек-лист в состоянии `on_branch` → `offered: true`, `enabled: false`, причина — требуется
    переключение на ветку; после переключения по подтверждению действие становится доступным
    (замыкает шаг 5 TC-007);
  - issue закрыт → `offered: false` и на уровне issue, и на уровне кейса.
- Ни одна из конфигураций не даёт ни 500, ни молчаливой пустоты — это отдельный предмет проверки.
- Пять фикстурных issue уже описаны в `helpers/fixtures.js`: `20260108-feat-fixture-nodata`,
  `20260109-feat-fixture-declared`, `20260110-improve-fixture-legacy`,
  `20260111-feat-fixture-noscript`, `closed/20260112-feat-fixture-closed`.
- В этой волне `server.js` правит только эта задача.

**Acceptance Criteria:**
- [ ] TC-018 passes

---

#### Task 11: Клиент role-first

**Mapped Test Cases:** TC-019, TC-006 (шаг 7 — у клиента нет собственного перечня документов)

**Files:**
- `tools/manual-test-ui/public/index.html` — modify: три вкладки ролей верхнего уровня, область документа, экран чек-листа внутри вкладки QA
- `tools/manual-test-ui/public/app.js` — modify: role-first навигация, рендеринг документов, кнопки подготовки
- `tools/manual-test-ui/public/style.css` — modify: вёрстка вкладок, документа, таблиц, блоков кода

**Implementation Notes:**
- Навигация — одна связная цепочка: проект → задача → раздел роли → документ. Второго
  параллельного дерева списков быть не должно; разделы ролей читаются как верхний уровень
  приложения, текущий визуально выделен, переключение доступно в любой момент, в том числе с
  открытым документом; выбранные проект и задача при переключении сохраняются.
- Клиент **не содержит собственного списка имён документов**: и перечень ролей, и наполнение роли,
  и статусы позиций приходят из API (Task 8). Метки состояний («неприменим», «отсутствует, создаёт
  такая-то стадия», «только на ветке — переключиться?») отрисовываются по данным ответа.
- Markdown рендерится подключением `<script src="/lib/markdown.js">` и вызовом того же модуля, что
  проверен в `node --test` (Task 2) — второй реализации рендерера в клиенте нет.
- Существующий экран чек-листа переносится внутрь вкладки «Тестировщик» **без изменения логики**:
  те же обработчики отметок и заметок, тот же баннер `on_branch` с кнопкой `Checkout` и тем же
  `confirm()`. Рядом появляются кнопки подготовки — на кейс и на issue целиком — с подтверждением
  перед запуском и показом итога, пути, вывода скрипта и кода возврата.
- Строго read-only визуально: полей ввода и кнопок сохранения нет нигде, кроме экрана чек-листа.
- Вёрстка: прокручивается только область документа (списки и вкладки остаются на месте); широкие
  таблицы и блоки кода получают собственную горизонтальную прокрутку — страница целиком вбок не
  едет; длинный текст в ячейке переносится по словам; при сужении окна до 1024×640 разделы не
  наезжают друг на друга.
- Задача не трогает `server.js` и потому идёт параллельно серверной задаче своей волны.

**Acceptance Criteria:**
- [ ] TC-019 passes (Manual)
- [ ] TC-006 (шаг 7, клиентская часть) passes

---

#### Task 12: Регресс git-поведения чек-листа

**Mapped Test Cases:** TC-014

**Files:**
- `tools/manual-test-ui/test/checklist-git.test.js` — create: TC-014

**Implementation Notes:**
- Задача только проверяющая: если она находит расхождение, чинится код предыдущих задач, а не
  ослабляется проверка.
- Предмет: перечисление issue с default-ветки через `git ls-tree` при посторонней checked-out
  ветке (ни один issue не исчезает); различимость трёх состояний чек-листа (`here`, `on_branch`,
  `missing`, у последнего — указание порождающей стадии); отказ 409 с именем ветки на правку
  чек-листа в состоянии `on_branch`; отказ `dirty_working_tree` при грязном дереве, после которого
  ни один файл не изменён и ветка прежняя; успешное переключение при чистом дереве по явному
  подтверждению.
- Шаг 6 — стык двух частей issue: после серии подготовок (issue целиком + отдельный кейс)
  переключение ветки обязано пройти, `git status --porcelain` остаётся пустым, гард не срабатывает
  ложно. Это та самая регрессия, ради которой рабочая копия живёт вне репозитория.
- Фикстуры (три issue в состояниях `here`/`on_branch`/`missing`, посторонняя ветка
  `feature/unrelated`, снимаемая после шага правка `README.md`) строятся через
  `helpers/fixtures.js`.

**Acceptance Criteria:**
- [ ] TC-014 passes

---

#### Task 13: Read-only — исчерпывающий перечень изменяющих действий

**Mapped Test Cases:** TC-012

**Files:**
- `tools/manual-test-ui/test/readonly.test.js` — create: TC-012

**Implementation Notes:**
- Проверка негативная, перебором. Перечень не-GET маршрутов извлекается **из исходников**
  `tools/manual-test-ui/server.js`, а не из документации, и обязан состоять ровно из трёх семейств:
  отметки/заметки чек-листа, переключение ветки, подготовка кейса. Любой четвёртый не-GET маршрут
  — провал.
- Попытки записи в `brd.md`, `specs.md`, `implementation_plan.md`, `test_plan.md`, `qa_report.md`,
  `PLANNING.md`, `CLAUDE.md` и файл памяти каждым из существующих не-GET маршрутов — каждый раз
  отказ (404/405/403), ни один файл не изменён.
- Проверка git-операций в `lib/git.js` и `server.js`: нет `commit`, `push`, `merge`, `reset`,
  `clean`, `checkout -f`; единственная изменяющая git-команда — `checkout`.
- Слепок sha256 всех документов фикстурного проекта снимается до и после серии попыток и обязан
  совпасть. Позитивный контроль: все три разрешённых действия выполняются, и изменяется только
  `manual_test_checklist.md`.

**Acceptance Criteria:**
- [ ] TC-012 passes

---

#### Task 14: Любой настроенный проект и краевые конфигурации

**Mapped Test Cases:** TC-017

**Files:**
- `tools/manual-test-ui/test/multi-project.test.js` — create: TC-017

**Implementation Notes:**
- Конфигурация из трёх записей: `main` (репозиторий из TC-007), `other` (второй фикстурный
  репозиторий с `20260109-feat-fixture-declared`), `bare` (каталог `<tmp>/not-a-repo/docs/issues/`
  без `.git`). Сервер запущен из каталога первого проекта.
- Ключевое: всё, проверенное в TC-006 и TC-007, обязано работать для **постороннего** проекта в
  той же форме; инструкции и память определяются по его собственному пути (его slug), а не по
  пути проекта, из которого запущен инструмент. Подготовка кейса в постороннем проекте
  отрабатывает, рабочая копия — вне обоих репозиториев, `git status --porcelain` пуст в обоих.
- Краевые конфигурации: проект без единого issue → внятное сообщение и код 200 (не 500, не пустой
  ответ без объяснения); каталог, не являющийся git-репозиторием → внятное сообщение, после
  которого остальные проекты продолжают работать в том же процессе сервера.
- Если что-то из этого не работает, чинится код соответствующей задачи — проверка не ослабляется.

**Acceptance Criteria:**
- [ ] TC-017 passes

---

#### Task 15: Отсутствие дополнительных зависимостей и документация

**Mapped Test Cases:** TC-015

**Files:**
- `test/manual-test-ui.sh` — modify: дописать блок TC-015
- `tools/manual-test-ui/README.md` — modify: роли, новые маршруты, подготовка кейса
- `skills/pf-manual-test/SKILL.md` — modify: одна фраза о role-first UI и подготовке кейса

**Implementation Notes:**
- Блок TC-015 — четыре ассерта с точными метками `pf_pass` из тест-плана: (1) в
  `tools/manual-test-ui/` нет ни `package.json`, ни `package-lock.json`, ни `node_modules`;
  (2) в `server.js`, `lib/*.js`, `public/*.js` и новых модулях каждый `require`/`import` — либо
  `node:`-встроенный, либо относительный путь внутри инструмента; (3) шаблон
  `skills/pf-test/templates/setup.mjs` и фикстурные `setup.mjs` импортируют только
  `node:`-встроенные; (4) сервер поднимается с `PLANNING_TEST_UI_CONFIG` на фикстурной
  конфигурации без единой установки и отдаёт перечень проектов.
- Блок пишется последним, когда состав модулей окончателен; в файл сьюта в этой волне пишет только
  эта задача.
- README дополняется тремя вещами: три раздела по ролям и что в каждом; таблица новых маршрутов
  API (роли, документы, инструкции, память, подготовка); подготовка кейса — что делает, куда
  разворачивает данные (вне репозитория, `os.tmpdir()`), что подтверждение обязательно, что
  повторный запуск = сброс. Утверждение «No database, no npm dependencies» остаётся в силе и после
  изменений — это и есть предмет TC-015.
- Гейт `.qa-workflow.md` («Docs match the change») читает `prompt.md`/`brd.md` и диф: без правки
  README он не проходит.

**Acceptance Criteria:**
- [ ] TC-015 passes

---

#### Task 16: Данные ручных проверок этого issue

**Mapped Test Cases:** TC-020, TC-019 (данные для шагов 4-5)

**Files:**
- `docs/issues/open/20260729-improve-manual-test-data-and-role-explorer/test-data/setup.mjs` — create: экземпляр шаблона для двух ручных проверок
- `docs/issues/open/20260729-improve-manual-test-data-and-role-explorer/test-data/fixtures/**` — create: исходные файлы TC-019 и TC-020

**Implementation Notes:**
- Обе ручные проверки этого issue сами требуют подготовленных данных, поэтому issue обязан нести
  собственный `test-data/` — иначе TC-020 нечем проходить.
- Для TC-019: копия конфигурации из двух записей (по образцу `projects.json.example`) и документ с
  широкой таблицей на шесть колонок. Для TC-020: два текстовых файла по 2-3 строки.
  Не меньше двух файлов на проверку.
- `setup.mjs` — экземпляр шаблона из Task 5, без отклонений от него: рабочая копия в
  `os.tmpdir()/pf-test-data/20260729-improve-manual-test-data-and-role-explorer/<TC-ID>`,
  цель — необязательный аргумент, идемпотентность через staging + rename.
- Фикстуры и скрипт кладутся **под git** (они сопровождают issue и после закрытия), рабочая копия
  — нет. После задачи `git status --porcelain` обязан быть пуст: артефакты коммитятся волной, в
  которой задача исполняется.
- Блок предусловий обеих проверок в `manual_test_checklist.md` с путём развёрнутых данных
  порождает `/pf-test` по новым правилам (Task 7) — руками этот файл в рамках задачи не пишется.

**Acceptance Criteria:**
- [ ] TC-020 passes (Manual)
- [ ] TC-019 (данные для шагов 4-5) готовы

---

### Dependencies

Задачи сгруппированы в семь волн. Внутри волны задачи независимы и исполняются параллельно; волна
N+1 стартует только после полного завершения волны N. Правило, определившее разбиение: **в одной
волне `server.js` правит ровно одна задача** (параллельные суб-агенты работают в одном рабочем
дереве, и одновременная правка одного файла их сталкивает). То же правило действует для
`test/manual-test-ui.sh` (Task 1 → Task 7 → Task 15) и для `lib/prepare.js` (Task 5 → Task 9 →
Task 10).

| Wave | Задачи | Правит `server.js` | Почему именно здесь |
|---|---|---|---|
| 1 | Task 1, Task 2, Task 3, Task 4 | — | Полностью независимы друг от друга. `Makefile` идёт первым: без него ни один node-сьют не получает вердикта |
| 2 | Task 5, Task 6 | Task 6 | Task 5 зависит от харнесса (Task 3) и не трогает сервер; Task 6 закладывает путевую валидацию и отдачу модулей |
| 3 | Task 7, Task 8 | Task 8 | Task 8 зависит от Task 6 (валидация, маршруты чтения); Task 7 — только скиллы и bash-сьют, конфликтов нет |
| 4 | Task 9 | Task 9 | Зависит от Task 5 (движок подготовки) и Task 6 (валидация); одна задача в волне |
| 5 | Task 10, Task 11 | Task 10 | Task 10 зависит от Task 4 (классификация) и Task 9 (маршрут); Task 11 зависит от Task 8 и Task 2, но правит только `public/` |
| 6 | Task 12, Task 13, Task 14 | — | Только тестовые файлы; все три требуют финального набора маршрутов |
| 7 | Task 15, Task 16 | — | Task 15 требует окончательного состава модулей; Task 16 — шаблона из Task 5 |

Явные зависимости по существу, а не только по волнам:

- Task 3 → Task 5, 6, 8, 9, 10, 12, 13, 14 (все node-сьюты строятся на харнессе).
- Task 4 → Task 10 (видимость опирается на `dataStatus`), Task 7 (формат меток чек-листа задаётся
  парсером и должен совпасть с тем, что пишет `/pf-test`).
- Task 2 → Task 11 (клиент подключает тот же модуль рендерера) и Task 6 (allowlist `/lib/*.js`).
- Task 5 → Task 9, Task 16 (шаблон и движок), Task 12 (шаг 6 — серия подготовок).
- Task 6 → Task 8, Task 9 (маршруты опираются на общую валидацию путей).
- Task 8 → Task 11 (клиенту нужен API ролей), Task 14 (форма ответов сверяется с TC-006/TC-007).
- Task 9 → Task 10, Task 12 (шаг 6), Task 13 (перечень не-GET маршрутов финализируется здесь).

Внешних зависимостей нет: только Node из стандартной поставки (проверено на v22.17.0), `git`,
`make` и `shellcheck` — всё уже требуется проектом. Ни одна задача не добавляет npm-пакетов.

---

### Complexity Estimate

**Complex** — 16 задач в 7 волнах.

- **Крупные задачи** (по объёму нового кода и числу проверок): Task 5 (шаблон + движок подготовки,
  три сьюта), Task 6 (три новых модуля + перевод путевой валидации), Task 8 (роли и состояния
  документов), Task 11 (переработка клиента).
- **Средние:** Task 2, Task 9, Task 10, Task 12, Task 13, Task 14, Task 3.
- **Небольшие:** Task 1, Task 4, Task 7, Task 15, Task 16.

Главные риски и где они срабатывают:

1. **Регресс существующего чек-листа** — самый дорогой. `patchStepResult` пересобирает патчимую
   строку целиком, и любое неаккуратное расширение парсера ломает точечность записи. Митигируется
   тем, что Task 4 не трогает патч-функции, а Task 3 и Task 12 фиксируют эталонное поведение до
   того, как начнётся правка сервера.
2. **Столкновение параллельных суб-агентов на `server.js`** — снято правилом «одна задача на файл
   в волне»; при отклонении от расписания волн риск возвращается.
3. **Чистота рабочего дерева** (AC-03a) — центральное требование issue: любая подготовка,
   оставившая файл внутри репозитория, валит и `checkout` в UI, и гейт `/pf-qa`. Проверяется
   дважды и с разных сторон — Task 5 (TC-004) и Task 12 (TC-014, шаг 6).
4. **Расхождение двух парсеров одного формата** (KI-04): экранированный `\|` поддерживает только
   новый рендерер, `lib/checklist.js` — намеренно нет. Не «чинить» это по ходу дела.
5. **Зависимость памяти от абсолютного пути проекта** (KI-01) — принятое ограничение, а не дефект;
   Task 6 не должен пытаться его обойти.
