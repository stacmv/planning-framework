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
- `scripts/setup-planning-v3.sh` — модификация: новый шаг установки шима `pf` (Task 6)
- `scripts/update-skills.sh` — модификация: новый шаг установки шима `pf` (Task 6)
- `scripts/install.sh` — новый файл: однокомандный установщик фреймворка для Linux/macOS (Task 7)
- `scripts/install.ps1` — новый файл: однокомандный установщик фреймворка для Windows (Task 8)
- `README.md` — модификация: секция одно-командной установки (Task 9)

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
- [x] TC-001 passes
- [x] TC-002 passes
- [x] TC-003 passes
- [x] TC-004 passes

---

#### Task 1b: `test/detect.test.js` — автотесты для `detect.js`

**Mapped Test Cases:** TC-001, TC-002, TC-003, TC-004
**Files:**
- `tools/onboarding-tui/test/detect.test.js` - тесты на `node:test` + `node:assert` (без npm-зависимостей, запуск `node --test`)

**Implementation Notes:**
- (P1-5) Каждый TC-001..004 из test_plan.md Status Tracker (Auto) — отдельный `test()`/`it()`-кейс: создать временную директорию (`fs.mkdtempSync`), разложить нужные маркеры (`PLANNING.md`/`CLAUDE.md`/`docs/issues/...`/`docs/planning/session-log.md`), вызвать `detectState(tmpDir)`, проверить `assert.strictEqual`.
- Покрыть отдельным кейсом и P0-1 fallback (только `docs/issues/{open,closed}` + `session-log.md`, без `PLANNING.md`) → `v3`.

**Acceptance Criteria:**
- [x] TC-001 passes (unit test in `detect.test.js`)
- [x] TC-002 passes (unit test in `detect.test.js`)
- [x] TC-003 passes (unit test in `detect.test.js`)
- [x] TC-004 passes (unit test in `detect.test.js`)

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
- [x] TC-005 passes
- [x] TC-009 passes

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
- [x] TC-006 passes

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
- [x] TC-007 passes
- [x] TC-008 passes

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
- [x] TC-010 passes

---

#### Task 6: Глобальный шим `pf` в `setup-planning-v3.sh` и `update-skills.sh`

**Mapped Test Cases:** TC-011, TC-012, TC-013
**Files:**
- `scripts/setup-planning-v3.sh` - новый шаг после установки скиллов: создать `~/.claude/bin` (если отсутствует), записать `~/.claude/bin/pf`, `chmod +x`, проверить `PATH`. Этот шаг относится только к существующему сценарию «установить фреймворк в проект-потребитель» — не связан с `install.sh`/`install.ps1` (Task 7/8), которые устанавливают шим самостоятельно, без вызова этого скрипта.
- `scripts/update-skills.sh` - тот же шаг установки шима, добавленный после существующего цикла обновления скиллов; шим не зависит от `--source`/консьюмер-таргета — всегда указывает на `FRAMEWORK_DIR` (директорию, где лежит сам `update-skills.sh`)

**Implementation Notes:**
- Шаблон файла шима — точно по specs.md ("Глобальный шим `pf` (AC-6)"):
  ```sh
  #!/usr/bin/env sh
  exec node "<FRAMEWORK_ROOT>/tools/onboarding-tui/cli.js" --target "$(pwd)" "$@"
  ```
  `<FRAMEWORK_ROOT>` подставляется во время установки как `$FRAMEWORK_DIR` (в `setup-planning-v3.sh` уже вычислен как `SCRIPT_DIR/..`; в `update-skills.sh` вычислить аналогично через `SCRIPT_DIR/..`) — абсолютный путь, не вычисляется динамически из `$0` шима.
- Запись шима — идемпотентно перезаписывать файл целиком (`cat > "$GLOBAL_BIN_DIR/pf" <<EOF ... EOF`), не дописывать/не создавать `.bak`/`.old` (TC-012): один и тот же путь кода на первом и повторном запуске, без вопроса подтверждения перезаписи.
- После записи — `chmod +x "$GLOBAL_BIN_DIR/pf"`.
- Проверка `PATH`: `case ":$PATH:" in *":$HOME/.claude/bin:"*) ;; *) echo 'warning: add to PATH: export PATH="$HOME/.claude/bin:$PATH"' ;; esac` — печатать точную строку `export PATH="$HOME/.claude/bin:$PATH"`, не пытаться редактировать `.bashrc`/`.zshrc` (TC-013). Не печатать предупреждение, если директория уже в `PATH`.
- `GLOBAL_BIN_DIR="$HOME/.claude/bin"`, создать через `mkdir -p` при отсутствии.
- Не менять существующую бизнес-логику установки скиллов/шаблонов в обоих скриптах — шаг добавляется как новый блок в конце соответствующего скрипта (после текущего шага 6/финального summary в `setup-planning-v3.sh`, после финального счётчика в `update-skills.sh`).
- Флаг `--self` не добавляется: этот Task касается исключительно существующего сценария «установить фреймворк в проект-потребитель», интерактивные шаги 1-2 (`read -rp`) остаются без изменений.

**Acceptance Criteria:**
- [ ] TC-011 passes
- [ ] TC-012 passes
- [ ] TC-013 passes

**Dependencies:** Нет (первая новая задача; Task 9 не зависит от неё напрямую — см. общий раздел "Dependencies" ниже).
**Complexity Estimate:** Medium — два независимых bash-скрипта, новая логика идемпотентной записи файла + проверка PATH, но без внешних зависимостей и сети.

---

#### Task 7: `scripts/install.sh` — однокомандный установщик для Linux/macOS

**Mapped Test Cases:** TC-014, TC-015
**Files:**
- `scripts/install.sh` - новый POSIX-совместимый bash-скрипт, точка входа для `curl -fsSL .../install.sh | sh`

**Implementation Notes:**
- Шаги строго по specs.md ("Однокомандный установщик фреймворка (AC-7, AC-8)"):
  1. Проверить `command -v git` и `command -v node`; при отсутствии — сообщение на stderr с названием отсутствующей программы и ссылкой на установку (`https://git-scm.com/downloads`, `https://nodejs.org/`), `exit 1`. Не вызывать `apt`/`brew`/etc.
  2. `INSTALL_DIR="$HOME/.claude/planning-framework"`.
  3. Если `"$INSTALL_DIR/.git"` существует — `git -C "$INSTALL_DIR" pull --ff-only`; иначе `git clone https://github.com/stacmv/planning-framework.git "$INSTALL_DIR"`. Один и тот же путь кода в обоих случаях, без интерактивного вопроса о переустановке (US-6, AC-8).
  4. Установка шима и скиллов для самого фреймворка — инлайн-шагами внутри `install.sh`, **без вызова `setup-planning-v3.sh`** (см. P0-обоснование в разделе "Dependencies" ниже):
     - Скиллы: динамически обнаружить все директории с `SKILL.md` в `$INSTALL_DIR/skills/`, зеркаля механизм обнаружения из `scripts/update-skills.sh` (`find "$SOURCE_DIR" -mindepth 1 -maxdepth 1 -type d -print0`, отфильтрованный по `[[ -f "$d/SKILL.md" ]]`), и скопировать каждую найденную директорию в `~/.claude/skills/<имя>/` (`mkdir -p "$dst"` + `cp -r "$src/." "$dst/"`).
     - Шим: записать `~/.claude/bin/pf` тем же шаблоном, что и в Task 6 (`<FRAMEWORK_ROOT>` = `$INSTALL_DIR`), `mkdir -p "$HOME/.claude/bin"` при отсутствии, `chmod +x`, та же проверка `PATH` (тот же `case ":$PATH:" in ...` паттерн, что в Task 6) — реализуется как собственный код `install.sh`, не переиспользуя код Task 6 напрямую (bash-скрипты не импортируют функции друг друга без `source`), но используя идентичный шаблон/логику.
  5. Итоговое сообщение: путь установки (`$INSTALL_DIR`), напоминание про `PATH`, если `~/.claude/bin` там не найдено (тот же паттерн проверки, что и в шаге 4 выше).
- Оба сценария (первая установка / повторный запуск) должны завершаться успешно и без интерактивных вопросов (TC-014).
- Проверки зависимостей — до любого создания/изменения файлов в `$INSTALL_DIR` (TC-015, шаг 4: `~/.claude/planning-framework` не создан при отсутствующих зависимостях).
- `set -e` в начале скрипта; явные проверки зависимостей должны идти до `set -e`-чувствительных шагов, чтобы сообщение об ошибке было понятным, а не голым нулевым/ненулевым кодом от `command -v`.

**Acceptance Criteria:**
- [ ] TC-014 passes
- [ ] TC-015 passes

**Dependencies:** Не зависит от Task 6 архитектурно (`install.sh` больше не вызывает `setup-planning-v3.sh`) — но должен использовать тот же шаблон файла шима, что и Task 6 (см. раздел "Dependencies" ниже), не вызывая при этом сам скрипт Task 6.
**Complexity Estimate:** Medium — новый скрипт; собственная новая логика — dependency-check, git clone/pull, динамическое обнаружение скиллов (по образцу `update-skills.sh`) и запись шима.

---

#### Task 8: `scripts/install.ps1` — однокомандный установщик для Windows

**Mapped Test Cases:** TC-016
**Files:**
- `scripts/install.ps1` - новый PowerShell-скрипт, точка входа для `irm .../install.ps1 | iex`

**Implementation Notes:**
- Шаги — тот же порядок, что в `install.sh` (Task 7), средствами PowerShell, по specs.md ("`scripts/install.ps1` (Windows)"):
  1. `Get-Command git -ErrorAction SilentlyContinue` / `Get-Command node -ErrorAction SilentlyContinue`; при отсутствии — `Write-Error` с названием отсутствующей программы и ссылкой на установку, `exit 1`.
  2. `$InstallDir = "$HOME\.claude\planning-framework"`.
  3. Если `Test-Path "$InstallDir\.git"` — `git -C $InstallDir pull --ff-only`; иначе `git clone https://github.com/stacmv/planning-framework.git $InstallDir`.
  4. Установка шима: на Windows POSIX-шим неприменим — создать `~/.claude/bin/pf.cmd` с содержимым, эквивалентным `node "<FRAMEWORK_ROOT>\tools\onboarding-tui\cli.js" --target "%CD%" %*` (`<FRAMEWORK_ROOT>` = `$InstallDir`, подставляется во время установки, не вычисляется динамически). Идемпотентная перезапись файла (`Set-Content`, не `Add-Content`), без резервных копий.
  5. Проверка `PATH`: `[Environment]::GetEnvironmentVariable('PATH','User')` — если `$HOME\.claude\bin` отсутствует в результирующей строке, вывести предупреждение с рекомендацией добавить эту директорию через "System Properties > Environment Variables" (Windows-эквивалент строки `export PATH=...` из POSIX-версии — не пытаться автоматически изменить реестр/переменную).
  6. Итоговое сообщение с путём установки и напоминанием про `PATH`, аналогично `install.sh`.
- Это отдельный скрипт от Task 6 (там — только POSIX `setup-planning-v3.sh`/`update-skills.sh`) и не вызывает bash-скрипты; как и Task 7 (`install.sh`), реализует установку шима/скиллов инлайн, средствами PowerShell — оба однокомандных установщика (Task 7 и Task 8) теперь симметричны: ни один не делегирует в `setup-planning-v3.sh`, оба используют динамическое обнаружение скиллов (без хардкод-списка), что даёт одинаковый и полный набор скиллов на обеих платформах.
- Скиллы устанавливаются в тот же `~/.claude/skills` — динамическое обнаружение директорий с `SKILL.md` в `$InstallDir\skills\` (`Get-ChildItem -Directory` + фильтр по наличию `SKILL.md`, зеркаля механизм `update-skills.sh`), копирование каждой найденной директории средствами `Copy-Item -Recurse -Force`.

**Acceptance Criteria:**
- [ ] TC-016 passes

**Dependencies:** Не зависит от Task 6/7 напрямую (отдельная Windows-реализация под PowerShell, симметричная Task 7 по подходу — динамическое обнаружение скиллов + инлайн-установка шима); логически идёт после Task 7 как парный установщик.
**Complexity Estimate:** Medium — новая PowerShell-логика (dependency-check, git clone/pull, `.cmd`-шим, User-scope PATH), без переиспользования bash-кода.

---

#### Task 9: README.md — секция одно-командной установки

**Mapped Test Cases:** нет отдельного TC (документационное изменение, покрывается качественным ревью по AC-7)
**Files:**
- `README.md` - добавить два блока кода рядом с существующим описанием установки

**Implementation Notes:**
- Разместить оба блока около текущего описания установки в начале README (там, где сегодня описан `setup-planning-v3.sh`/клонирование репозитория вручную), с одной строкой пояснения к каждому — по specs.md ("Общие ограничения установщика": "README получает два блока кода... рядом друг с другом, с одной строкой пояснения к каждому").
- Linux/macOS:
  ```sh
  curl -fsSL https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/install.sh | sh
  ```
- Windows:
  ```powershell
  irm https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/install.ps1 | iex
  ```
- Не удалять существующее описание ручной установки (`git clone` + `setup-planning-v3.sh`) — однокомандные снипеты добавляются как более простая альтернатива, ручной способ остаётся для тех, кто хочет установить в нестандартное место.

**Acceptance Criteria:**
- [ ] README reviewed for accuracy

**Dependencies:** Требует Task 7 и Task 8 (документирует их конечные точки входа).
**Complexity Estimate:** Simple — только документация, без кода.

### Dependencies

- Task 6 (шим-логика в `setup-planning-v3.sh`/`update-skills.sh`) архитектурно **не блокирует** Task 7 (`install.sh`) — `install.sh` не вызывает `setup-planning-v3.sh` и не зависит от её кода. Task 6 и Task 7 связаны только «мягкой» зависимостью: оба должны использовать один и тот же шаблон файла шима (см. Task 6, "Шаблон файла шима"), чтобы `pf`, установленный любым из путей, вёл себя одинаково — но Task 7 не вызывает скрипт Task 6.
- **Принятое решение (вместо открытого вопроса в specs.md):** `install.sh` НЕ вызывает `setup-planning-v3.sh --self`; флаг `--self` не добавляется вовсе. Вместо этого `install.sh` устанавливает шим и скиллы для самого фреймворка собственными инлайн-шагами, используя то же динамическое обнаружение скиллов, что и `update-skills.sh`.
  - Причина (P0, cp-same-file баг): `setup-planning-v3.sh` копирует шаблоны командой `cp -r "$TEMPLATES_SRC/." "$TEMPLATES_DST/"`, где `TEMPLATES_SRC="$FRAMEWORK_DIR/docs/planning/templates"`. При `--self` (`TARGET="$FRAMEWORK_DIR"`) `TEMPLATES_DST` совпадает с `TEMPLATES_SRC` — `cp -r a/. a/` завершается ошибкой «are the same file» с ненулевым кодом, а `set -e` в начале скрипта прерывает выполнение прямо на этом шаге, ещё до шага установки шима (который по плану добавляется в самом конце скрипта). То есть `--self` в реальности никогда не доходил бы до установки шима.
  - Причина (P1, паритет скиллов): при `--self` через `setup-planning-v3.sh` устанавливались бы только 7 скиллов, хардкоженных в массиве `SKILLS=(pf pf-brd pf-spec pf-check pf-test-plan pf-impl-plan pf-execute)`, тогда как `install.ps1` (Task 8) с самого начала проектировался на переиспользование динамического обнаружения `update-skills.sh` (все 15 скиллов в `skills/`). Это давало Linux/macOS-пользователям 7 скиллов против 15 у пользователей Windows.
  - Новое решение устраняет обе проблемы разом: `install.sh` и `install.ps1` используют один и тот же принцип — динамическое обнаружение всех директорий с `SKILL.md`, без хардкод-списка и без обращения к `setup-planning-v3.sh` — что даёт одинаковый полный набор скиллов на обеих платформах и не завязано на `TARGET`/`TEMPLATES_DST` совпадение путей.
- Task 8 (`install.ps1`) — Windows-аналог, не может переиспользовать bash-скрипты; реализует шим/скилл-логику самостоятельно на PowerShell, тем же принципом динамического обнаружения, что и Task 7. Не блокируется Task 6/7, но логически следует за ними как парный установщик.
- Task 9 (README) документирует конечные точки входа Task 7/8 — идёт последней.

### Complexity Estimate

**Medium** — 4 новые задачи (Task 6-9): в основном bash/PowerShell-скрипты без внешних зависимостей. Task 6 расширяет существующие `setup-planning-v3.sh`/`update-skills.sh`; Task 7 и Task 8 — самостоятельные однокомандные установщики (не делегируют в `setup-planning-v3.sh`), оба зеркалят механизм динамического обнаружения скиллов из `update-skills.sh`, каждый на своей платформе; документация (Task 9) — тривиальна.
