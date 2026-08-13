# Implementation Plan: падения `tools/manual-test-ui` — недетерминированности нет

**Date:** 2026-08-13

## Overview

Две детерминированные причины из `analysis.md`, обе в тестовом коде.

**Причина 1** (Task 1-2): `fs.symlinkSync` в `buildFixture()` роняет `EPERM` на все
девять подпроверок TC-011 вместо одной. Симлинк переносится в свой шаг, в
собственный контекст `t2`, и `EPERM` даёт видимый `t2.skip()`.

**Причина 2** (Task 3-4): `projects.json` пишется `printf`-ом с POSIX-путём как
есть. Заменяется на `cygpath -w` (где он есть; иначе POSIX без изменений) плюс
`node -e`-сериализатор, где `JSON.stringify` закрывает экранирование. Task 3
заодно разносит сообщение шага 4 и добавляет `pf_note` для TC-006.

Task 5 — три ручные процедуры без правок кода. **`/pf-test` вне объёма:** после
фикса предсуществующих падений не остаётся, и остановка гейта на любом `✗` снова
корректна; смягчать её значило бы завести гейт, который можно уговорить.

## Implementation Tasks

#### Task 1: Симлинк TC-011 — из фикстуры в собственный шаг, видимый skip

**Task Type:** code
**Mapped Test Cases:** TC-003
**Files:**
- `tools/manual-test-ui/test/read-paths.test.js` — `buildFixture()` (строка 73), `t.test("step 2: …")` (строки 148-157)

**Implementation Notes:**
- Убрать `fs.symlinkSync(...)` из `buildFixture()` и перенести внутрь
  `t.test("step 2: …", async (t2) => { … })` — **параметр `t2` надо добавить**,
  сейчас callback без него. В `try/catch`: `EPERM`/`EACCES` → `t2.skip(...)`,
  **никогда внешний `t`** — иначе пропускаются все девять подпроверок, то есть
  воспроизводится ровно тот баг, который задача чинит. Плюс `console.error` с
  `EPERM`/`Developer Mode`/symlink в тексте (второй канал: рендер skip зависит от
  репортёра, см. Task 2), затем `return`. Любой другой код ошибки — `throw`.
- Симлинк используется только в этом `t.test`, переносить больше нечего.
  Остальные восемь не трогать: они чинятся тем, что `buildFixture()` перестаёт
  падать.

**Acceptance Criteria:**
- [ ] `node --test …/read-paths.test.js` exits 0; восемь подпроверок `ok`,
      `step 2` — `# SKIP` с причиной (проверяемо здесь)
- [ ] TC-003 passes (нужна машина с доступными symlink)

#### Task 2: `test/manual-test-ui.sh` — TC-001/TC-002 поверх `ui_out`

**Task Type:** tests
**Mapped Test Cases:** TC-001, TC-002
**Files:**
- `test/manual-test-ui.sh` — новая секция после TC-016 step 4 (после строки 118), переиспользует переменную `ui_out`

**Implementation Notes:**
- **Сначала снять реальный `ui_out`**: node здесь может печатать `spec`-репортёр
  (`✔`/`✖`) вместо TAP. Паттерны — под увиденное; трёхсостояние и запрет
  засчитывать провал за успех обязательны в любом формате.
- Каждый шаг — `pf_pass`/`pf_fail` с литералом `TC-NNN step K: …` дословно из
  `test_plan.md`: единственная форма, распознаваемая `/pf-test` Phase 3.2. Баннер
  `printf` меткой не считается, после номера обязан идти статический текст.
- Восемь подпроверок TC-001 ищутся по **дословным** именам `t.test(...)` из
  `read-paths.test.js:125-254`. Успех = якорный `^[[:space:]]*ok [0-9]+ - <name>`
  (ведущие пробелы — node вкладывает подтесты) **и** отсутствие `not ok` с тем же
  именем. Наивный `grep -F` совпал бы и с `not ok` как подстрокой, засчитав провал
  за успех.
- TC-002 step 1 — те же якоря для `step 2: a symlink pointing out …`, три
  состояния: `# SKIP` (skip), `ok` без `SKIP` (executed), отсутствие обоих
  (missing → `pf_fail`; **эта ветка и ловит исходный дефект**). Step 2: рядом есть
  `EPERM`/`Developer Mode`/symlink. Step 3: без `not ok`. Step 4: ни одна из
  восьми прочих подпроверок не несёт `# SKIP`.

**Acceptance Criteria:**
- [ ] TC-001 passes
- [ ] TC-002 passes

#### Task 3: `projects.json` — сериализатор вместо `printf`, `TC-004` шаги, `pf_note`

**Task Type:** code
**Mapped Test Cases:** TC-004
**Files:**
- `test/manual-test-ui.sh` — строки 348-350 (запись конфига), строки 385-392 (сообщение шага 4)

**Implementation Notes:**
- Заменить `printf '{"projects":…}' … >"$tc015_config"` на два шага.
  **Конвертация:** `command -v cygpath` → `repo_path="$(cygpath -w
  "$tc015_repo")"`, иначе `repo_path="$tc015_repo"` — на Windows даёт нативный
  путь с обратными слэшами, на Linux POSIX остаётся как есть, ветвления по
  `uname` не нужно. **Сериализация:** `node -e` с `JSON.stringify` — сам
  закрывает экранирование обратных слэшей и кавычек.
- Сразу после — прочитать `.projects[0].path` тем же `node -e` в `written_path`
  и вывести дословно: `pf_note "TC-015: tc015_repo (raw, from pf_mktemp_d) =
  $tc015_repo"` и `pf_note "TC-015: projects.json path field = $written_path"`.
  Нужны для TC-006 step 1; `written_path` нужен и Task 4.
- Строки 385-392 разбить на два шага с TC-ID: после ожидания старта —
  `TC-004 step 1: server started` / `… did not start`; после `/api/projects` —
  `TC-004 step 2: server listed the fixture project` / `… did not list …`.
  При провале лог и тело ответа в `>&2`. Step 2 не выполняется, если step 1
  не прошёл.

**Acceptance Criteria:**
- [ ] TC-004 passes

#### Task 4: `TC-005` — JSON остаётся валиден и путь не искажается

**Task Type:** tests
**Mapped Test Cases:** TC-005
**Files:**
- `test/manual-test-ui.sh` — новая секция после Task 3, использует `$written_path`

**Implementation Notes:**
- Та же проверка `command -v cygpath`, что в Task 3. Есть — `written_path` уже
  содержит обратные слэши, то есть ломает JSON сам по себе; `expected_path` равен
  ему, отдельной фикстуры не нужно. Нет (POSIX) — создать через `pf_mktemp_d`
  каталог с `"` в имени и записать конфиг тем же механизмом.
- Шаги — `pf_pass`/`pf_fail` с литералами `TC-005 step 1..4` дословно из
  `test_plan.md`.
- Step 2/3: `node -e "JSON.parse(...)"`, сравнение `path` с `expected_path`
  **побайтно**, без нормализации. Step 4: поднять сервер на этом конфиге (паттерн
  Task 3) и завершить процесс по окончании шага.

**Acceptance Criteria:**
- [ ] TC-005 passes

#### Task 5: Ручные процедуры — TC-006, TC-007, TC-008

**Task Type:** tests
**Mapped Test Cases:** TC-006, TC-007, TC-008
**Files:** нет — три процедуры поверх исправленного сьюта, кода не меняют

**Implementation Notes:**
- **TC-006 (Linux/WSL, платформа недостижима из этой среды).** Прогнать
  `bash test/manual-test-ui.sh` целиком, найти обе строки `pf_note "TC-015: …"`
  из Task 3 и сравнить побайтно: идентичны — значит конвертация не применилась,
  POSIX-путь остался как есть. `TC-004 step 1/2` тем же прогоном зелёные.
- **TC-007 (домер стабильности).** После Task 1-4: 3+3 прогона обоих уровней как
  базовая линия, далее по одной переменной — диск, `TMPDIR`, «грязный»
  temp-каталог, серия ≥10, параллельная нагрузка. Системные `tmp`-каталоги —
  **только наблюдение** (`[ -d ]`, без create/delete: S-1…S-5).
- **TC-008 (атрибуция).** ≥2 прогона на чистом `develop` (до мержа) и ≥2 на ветке
  issue. Правило: падение относится к issue, только если отсутствует в базовой
  линии и стабильно на ветке. Таблица «падение → категория» без пропусков.
  Поведение `/pf-test` кейс не проверяет — скилл вне объёма.

**Acceptance Criteria:**
- [ ] TC-006 passes (руками, вне этой среды)
- [ ] TC-007 passes (таблица переменных приложена)
- [ ] TC-008 passes (таблица атрибуции приложена)
