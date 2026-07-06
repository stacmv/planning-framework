## Implementation Plan: `make tui` — интерактивный мастер установки/обновления

### Overview

Добавляем новую точку входа `make tui`, которая запускает Node.js TUI (`tools/onboarding-tui/`, zero npm dependencies, по образцу `tools/manual-test-ui`). TUI определяет состояние целевого проекта (`none` / `v2-or-older` / `v3` / `unknown`), показывает соответствующее меню, для новых пользователей предлагает встроенный туториал по концепциям фреймворка, а фактическую установку/миграцию/обновление делегирует существующим `scripts/*.sh` через `child_process.spawn` с унаследованным stdio. Существующие make-цели не изменяются.

### Files to Create/Modify

- `tools/onboarding-tui/cli.js` — точка входа
- `tools/onboarding-tui/lib/detect.js` — определение состояния проекта
- `tools/onboarding-tui/lib/menu.js` — рендеринг меню и навигация (readline)
- `tools/onboarding-tui/lib/tutorial.js` — экраны туториала
- `tools/onboarding-tui/lib/actions.js` — обёртки spawn над `scripts/*.sh`
- `tools/onboarding-tui/test/detect.test.js` — `node:test`-тесты для `detect.js` (TC-001..004)
- `Makefile` — новая цель `tui` + две строки в `help` (существующие цели не трогаются)

### Implementation Tasks

#### Task 1: `lib/detect.js` — определение состояния проекта

**Mapped Test Cases:** TC-001, TC-002, TC-003, TC-004
**Files:**
- `tools/onboarding-tui/lib/detect.js` - экспортирует функцию (например, `detectState(targetDir)`), возвращающую одно из `none | v2-or-older | v3 | unknown`

**Implementation Notes:**
- Порядок проверок обязателен: сначала проверить `PLANNING.md` — если он есть и содержит валидный маркер версии 3.x (регэксп `/Framework Version:\**\s*3\.\d+/` — терпим к markdown-`**` между двоеточием и числом, т.к. реальный `PLANNING.md` содержит `**Framework Version:** 3.0`), вернуть `v3` **немедленно**, не проверяя `CLAUDE.md` (TC-002, случай B: `v3` побеждает при одновременном наличии `CLAUDE.md`).
- Если `PLANNING.md` присутствует, но маркер 3.x не найден (отсутствует, битый или указывает на другую мажорную версию, например 4.0) — это не `v2-or-older` и не `v3`: вернуть `unknown` (не проваливаться на проверку `CLAUDE.md`), согласно TC-004 (случай C).
- **(P0-1)** Иначе, если нет `PLANNING.md` вовсе — проверить fallback-отпечаток свежеустановленного v3: `docs/issues/open/` и `docs/issues/closed/` оба существуют И `docs/planning/session-log.md` существует → `v3`. Причина: `setup-planning-v3.sh`/`migrate-v2-to-v3.sh` не создают корневой `PLANNING.md`/`CLAUDE.md`, только эту структуру — без этого OR сразу после установки проект определялся бы как `unknown`. Не трогает бизнес-логику самих `.sh`-скриптов — только чтение маркеров в `detect.js`.
- Далее: если `CLAUDE.md` есть, а `PLANNING.md` нет — `v2-or-older`.
- Далее: если нет ни `docs/issues/`, ни `PLANNING.md`, ни `CLAUDE.md` — `none`.
- Всё остальное (включая только `docs/issues/` без обоих маркеров и без fallback-отпечатка v3) — `unknown`.
- Все проверки — синхронные `fs.existsSync`/`fs.readFileSync`, без сети.

**Acceptance Criteria:**
- [ ] TC-001 passes
- [ ] TC-002 passes
- [ ] TC-003 passes
- [ ] TC-004 passes

---

#### Task 1b: `test/detect.test.js` — автотесты для `detect.js`

**Mapped Test Cases:** TC-001, TC-002, TC-003, TC-004
**Files:**
- `tools/onboarding-tui/test/detect.test.js` - тесты на `node:test` + `node:assert` (без npm-зависимостей, запуск `node --test`)

**Implementation Notes:**
- (P1-5) Каждый TC-001..004 из test_plan.md Status Tracker (Auto) — отдельный `test()`/`it()`-кейс: создать временную директорию (`fs.mkdtempSync`), разложить нужные маркеры (`PLANNING.md`/`CLAUDE.md`/`docs/issues/...`/`docs/planning/session-log.md`), вызвать `detectState(tmpDir)`, проверить `assert.strictEqual`.
- Покрыть отдельным кейсом и P0-1 fallback (только `docs/issues/{open,closed}` + `session-log.md`, без `PLANNING.md`) → `v3`.

**Acceptance Criteria:**
- [ ] TC-001 passes (unit test in `detect.test.js`)
- [ ] TC-002 passes (unit test in `detect.test.js`)
- [ ] TC-003 passes (unit test in `detect.test.js`)
- [ ] TC-004 passes (unit test in `detect.test.js`)

---

#### Task 2: `lib/menu.js` — ветвление меню по состоянию

**Mapped Test Cases:** TC-005, TC-009
**Files:**
- `tools/onboarding-tui/lib/menu.js` - рендеринг заголовка "Detected: <state>", пунктов меню для каждого состояния, обработка ввода через `readline`

**Implementation Notes:**
- Таблица пунктов строго по specs.md: `none` → [1] tutorial, [2] Install v3.0; `v2-or-older` → [1] Migrate, [2] What changed overview; `v3` → [1] Update skills, [2] Show issue status; `unknown` → единственный пункт [1] Show detected files.
- Для `unknown` меню никогда не должно содержать пункт, автоматически запускающий установку/миграцию/обновление, и не должно применять никакой таймаут/дефолт-выбор — только явный ввод пользователя (`readline.question`, без `setTimeout`).
- Пункт [1] для `unknown` печатает диагностику: какие из `docs/issues/`, `PLANNING.md`, `CLAUDE.md` найдены/не найдены.
- `q` в любом меню — корректный выход (`rl.close()`, `process.exit(0)`).

**Acceptance Criteria:**
- [ ] TC-005 passes
- [ ] TC-009 passes

---

#### Task 3: `lib/tutorial.js` — обучающий туториал для новых пользователей

**Mapped Test Cases:** TC-006
**Files:**
- `tools/onboarding-tui/lib/tutorial.js` - 4 последовательных экрана с навигацией Enter/`b`/`q`

**Implementation Notes:**
- Экран 1: понятие issue и назначение `docs/issues/`. Экран 2: жизненный цикл `CREATE → BRD/ANALYSIS → SPEC → TEST_PLAN → IMPL_PLAN → EXECUTE → TEST → QA → CLOSE` (порядок стадий важен). Экран 3: роль `/pf`-команд (`/pf`, `/pf-brd`, `/pf-check`, `/pf-execute`, `/pf-qa`, `/pf-close` и т.д.), по одной строке. Экран 4: ссылки на `PLANNING.md` и `docs/planning/FRAMEWORK.md` — упомянуть, не требовать открытия.
- Хранить текущий индекс экрана (0-3); Enter → `min(idx+1, 3)`, `b` → `max(idx-1, 0)`, `q` → выход в главное меню состояния `none` без выполнения установки.
- Туториал не должен ничего блокировать: выход в меню и немедленный выбор "Install v3.0" должны работать без прохождения всех экранов.

**Acceptance Criteria:**
- [ ] TC-006 passes

---

#### Task 4: `lib/actions.js` + `cli.js` — делегирование существующим скриптам через spawn

**Mapped Test Cases:** TC-007, TC-008
**Files:**
- `tools/onboarding-tui/lib/actions.js` - функции `runSetupV3(targetDir)`, `runMigrateV2ToV3(targetDir)`, `runUpdateSkills()`, каждая — тонкая обёртка над `child_process.spawn`
- `tools/onboarding-tui/cli.js` - точка входа: парсит `--target` (по умолчанию `process.cwd()`, если не передан — P1-6), вызывает `detect.js`, запускает `menu.js`, на выбор пункта — соответствующий метод `actions.js`

**Implementation Notes:**
- (P1-4) Скрипты запускать строго как `spawn("bash", [scriptPath, ...args], { stdio: "inherit", cwd: ... })` — **не** исполнять `scriptPath` напрямую как команду. Это соответствует тому, как их вызывает сам Makefile (`bash scripts/x.sh`), и не зависит от сохранности exec-бита при копировании/checkout.
- `runSetupV3`/`runMigrateV2ToV3` вызывают скрипт с путём к `targetDir` там, где скрипт это поддерживает (`migrate-v2-to-v3.sh` принимает `$1`); `setup-planning-v3.sh` интерактивно спрашивает директорию сам — TUI не подменяет этот промпт, просто наследует stdio.
  - (P2-7, принятый trade-off) `runSetupV3(targetDir)` не может передать `targetDir` в `setup-planning-v3.sh` — скрипт всегда спрашивает директорию через `read -rp`. Если пользователь задал `TARGET=`, его один раз всё равно спросит сам скрипт — это ожидаемо, не баг.
- `runUpdateSkills` не принимает и не подставляет `targetDir` (скрипт всегда пишет в `$HOME/.claude/skills` — TUI это не оборачивает и не меняет).
- Дождаться события `exit`/`close` дочернего процесса перед возвратом управления в меню; проброс `SIGINT` (Ctrl+C) в TUI должен приводить к завершению также и дочернего процесса (не оставлять сирот) — например, через `process.on("SIGINT", ...)` с явным `child.kill()` перед выходом.
  - (P2-9) Ctrl+C, когда дочерний процесс не запущен (экраны меню/туториала), обрабатывается штатным поведением Node (`process.exit`) — специальной логики не требуется; явный код нужен только для проброса SIGINT в активный дочерний процесс (уже описано выше).
- Не дублировать и не переписывать бизнес-логику `.sh`-скриптов — только вызов.

**Acceptance Criteria:**
- [ ] TC-007 passes
- [ ] TC-008 passes

---

#### Task 5: `Makefile` — цель `tui` и обратная совместимость

**Mapped Test Cases:** TC-010
**Files:**
- `Makefile` - добавить `tui` в `.PHONY`, новую цель `tui`, строку в `help`; существующие цели/строки не менять

**Implementation Notes:**
- Новая цель:
  ```
  tui:
  	node tools/onboarding-tui/cli.js $(if $(TARGET),--target $(TARGET),)
  ```
- (P2-8) `tui` добавляется в **существующий** однострочный список `.PHONY: ...` — не создавать новый отдельный блок `.PHONY`.
- `help` получает две дополнительные строки, по существующей конвенции (`make test-ui PORT=4400`, `make update-skills SOURCE=path`):
  - `make tui                           Launch the interactive onboarding/update wizard` (P1-3)
  - `make tui TARGET=<path>              Run against a specific target project directory` (P1-3)
  Существующие строки `help` остаются без изменений.
- `TARGET` — единственная make-переменная, реально влияющая на цель `tui`; `setup-v3` и `migrate-v2-to-v3` её не поддерживают и не должны её получать.
- Проверить вручную, что `make help`, `make setup-v3`, `make migrate-v2-to-v3`, `make update-skills`, `make migrate-v1-to-v2`, `make setup-v2`, `make issue-status` работают как до изменения (сравнение с веткой `develop`).

**Acceptance Criteria:**
- [ ] TC-010 passes
