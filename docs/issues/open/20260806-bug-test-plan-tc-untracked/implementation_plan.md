## Implementation Plan: TC из `/pf-test-plan` не отслеживаются в `/pf-test`

### Overview

Фикс правит только текст двух `SKILL.md`-файлов (Д1, Д2, Д3 из `analysis.md`)
и добавляет один bash-сьют, проверяющий текст статически. Исполняемый код
репозитория не меняется. Порядок: три правки `pf-test/SKILL.md` (Task 1-3),
правка `pf-test-plan/SKILL.md` (Task 4), сьют (Task 5), живой сквозной прогон
(Task 6).

### Files to Create/Modify

- `skills/pf-test/SKILL.md` — Phase 3.1 (Д3), Phase 3.2/3.3 (Д1 + исключение фикстур), зазор Phase 4 → Phase 5 (Д2)
- `skills/pf-test-plan/SKILL.md` — Step 4, связка `Auto` с обнаружимостью (TC-005)
- `test/pf-test-tc-mapping-static.sh` — новый файл, Auto-проверки TC-001..TC-007; Makefile не трогать — `test:` уже перебирает `test/*.sh` (кроме `lib.sh`)

### Implementation Tasks

#### Task 1: Phase 3.1 — снять ограничение диффом ветки (Д3)

**Task Type:** code
**Mapped Test Cases:** TC-002
**Files:** `skills/pf-test/SKILL.md` — раздел `### 3.1` (строки 33-35)

**Implementation Notes:**
- Заголовок `### 3.1` не переименовывать (якорь TC-002).
- Поиск — по **всему** тестовому дереву; диф — не единственный источник. Текст обязан содержать `entire test suite` (или `whole test suite`) и `not the only source` (или `in addition to the diff`): "Scan the entire test suite for test-looking files, regardless of whether they were changed on this branch — `git diff …` is not the only source: in addition to the diff, also scan pre-existing test files."
- Заодно поправить «Important Notes» (текущая строка 210): «skip the TC-ID mapping step; report mapped count as 0» при отсутствующей/ошибающейся ветке — это тот же Д3 через чёрный ход, раз сканирование больше не завязано на диф. Переформулировать: при ошибке `git diff develop...HEAD` деградировать к сканированию всего дерева (как в 3.1 выше), а не пропускать маппинг целиком.

**Acceptance Criteria:**
- [ ] TC-002 passes

#### Task 2: Phase 3.2/3.3 — bash-конвенция и исключение фикстур (Д1 + TC-004)

**Task Type:** code
**Mapped Test Cases:** TC-001, TC-004, TC-006
**Files:** `skills/pf-test/SKILL.md` — разделы `### 3.2`, `### 3.3` (строки 37-51)

**Implementation Notes:**
- Заголовки `### 3.2`/`### 3.3` не переименовывать (якоря TC-001/004/006).
- **Не удалять** три существующих JS/Python-пункта в `### 3.2` (дословно
  `it(...)`, `describe(...)`, `test(...)`) — регрессия TC-006.
- Добавить в `### 3.2` пункт: TC-ID внутри строкового литерала/аргумента, переданного тестовому хелперу (конвенция `pf_pass "TC-009 step 1: ..."`). Слово `pf_pass` должно встретиться буквально. **Важно:** правило должно требовать, чтобы TC-ID **вёл** строку (стоял в её начале, как в `pf_pass "TC-009 ..."`), а не просто встречался где-то внутри — иначе ложно совпадёт с `assert.ok(ru, "TC-001 not parsed")` (`checklist-ru.test.js:47`), где TC-ID упомянут в тексте сообщения, а не является конвенцией самого теста.
- В том же диапазоне (до `### 3.4`) добавить абзац-исключение для фикстур — без него правило ложно сработает на `tools/manual-test-ui/test/checklist-ru.test.js`. Обязан содержать `does not count` (или `must not match`/`ignored`) **и** `fixture`/`test data`: "A TC-ID occurring only inside a string used as fixture/sample test data — not a call to a test helper or assertion — does not count as a match and must be ignored, even though it is a string literal."
- В `### 3.3` распространить приём (подстроки) на вывод раннера. Обязан содержать `substring` и `not limited to test names`: "Use the same substring-matching technique as 3.2 against runner output — not limited to test names or function names; a TC-ID anywhere in captured stdout (e.g. printed verbatim by `pf_pass`) counts as a match."

**Acceptance Criteria:**
- [ ] TC-001 passes
- [ ] TC-004 passes
- [ ] TC-006 passes

#### Task 3: Замкнуть ветку Phase 4 → Phase 5 (Д2)

**Task Type:** code
**Mapped Test Cases:** TC-003
**Files:** `skills/pf-test/SKILL.md` — между «Do NOT proceed to Phase 5 when this gate triggers.» и `### 5.1` (строки 80-87, включая заголовок `## Phase 5`)

**Implementation Notes:**
- Не трогать стоп-сообщение Phase 4 (строка 78) — TC-003 step 3 проверяет, что в новом диапазоне оно не повторяется.
- Сразу после «Proceed here only when all Auto-type TCs … OR … no rows with Type `Auto`.» добавить абзац про ветку «гейт не сработал, но предусловие Phase 5 не выполнено»: обязан содержать `unmatched` (или `precondition`/`left as`) **и** буквально `Stop with message` (регистрозависимо): "If, after Phase 3, one or more Auto-type rows remain unmatched — Status still `[ ]`, with no `✗` rows to trigger the gate above — this precondition is not met. Stop with message: \"N Auto TC(s) have no matching test in the runner output — Status left as `[ ]`. Add a test using a convention from Phase 3.2, or re-run /pf-test, before generating the manual checklist.\""

**Acceptance Criteria:**
- [ ] TC-003 passes

#### Task 4: `pf-test-plan/SKILL.md` Step 4 — связать `Auto` с обнаружимостью (TC-005)

**Task Type:** code
**Mapped Test Cases:** TC-005
**Files:** `skills/pf-test-plan/SKILL.md` — раздел `### Step 4` (строки 101-111)

**Implementation Notes:**
- Заголовки `### Step 4`/`### Step 5` не переименовывать (якорь TC-005).
- Добавить в Step 4 предложение, называющее `Auto` **discoverable** сканированием `/pf-test` — слово `discoverable` должно встретиться буквально: "A TC marked `Auto` must be discoverable by `/pf-test`'s TC-ID scanning (Phase 3.2/3.3 in `skills/pf-test/SKILL.md`) — written using a convention that phase recognizes. If it cannot be, mark it `Manual` instead."

**Acceptance Criteria:**
- [ ] TC-005 passes

#### Task 5: `test/pf-test-tc-mapping-static.sh` — Auto-проверки TC-001..TC-007

**Task Type:** tests
**Mapped Test Cases:** TC-007
**Files:** `test/pf-test-tc-mapping-static.sh` — новый файл

**Implementation Notes:**
- По образцу `test/skills-role-matrix-static.sh`: источник `test/lib.sh`, read-only, использует `pf_pass`/`pf_fail`/`pf_summary`, не трогает `~/.claude`.
- Реализовать буквально шаги TC-001..TC-007 из `test_plan.md`: границы разделов через `grep -n '^### N.M'` + `sed -n "start,$((end-1))p"`, затем соответствующие `grep -qiE`/`grep -qE`/`grep -q` из каждого TC (паттерны дословно из `test_plan.md`, не переизобретать).
- Проверяемые файлы: `skills/pf-test/SKILL.md`, `skills/pf-test-plan/SKILL.md`, `tools/manual-test-ui/test/checklist-patch.test.js` (TC-006 step 2).
- TC-007 self-check в этом же файле: `git diff --name-only --diff-filter=M develop...HEAD -- test/` пуст; `--diff-filter=A` — ровно `test/pf-test-tc-mapping-static.sh`.
- Исполняемый (`chmod +x`). Makefile не трогать.
- TC-007 предполагает прогон на закоммиченной ветке issue (см. Prerequisites в `test_plan.md`): на `develop` или до коммита `develop...HEAD` пуст. Для этого шага использовать `pf_note` вместо `pf_fail`, когда `git diff --name-only --diff-filter=A develop...HEAD -- test/` не может однозначно определить ветку issue (по образцу отложенной проверки T11-inv в `test/lib.sh`), а не жёсткий `pf_fail`.

**Acceptance Criteria:**
- [ ] `bash test/pf-test-tc-mapping-static.sh` завершается кодом 0
- [ ] TC-007 passes

#### Task 6: Сквозная валидация — TC-008 в изолированной копии

**Task Type:** tests
**Mapped Test Cases:** TC-008
**Files:** нет (валидация; ничего не меняется в основном чекауте)

**Implementation Notes:**
- Выполнить процедуру TC-008 из `test_plan.md` буквально, шаги 1-7: изолированная копия (по образцу `pf_repo_copy`), `git remote remove origin`, удаление реальной issue из копии, фикстура `docs/issues/open/zz-fixture-tc-link/` + `test/zz-fixture-tc-link-check.sh` из «Требуемые данные» TC-008, фикс установлен в `~/.claude/skills/pf-test(-plan)/SKILL.md` копии, запуск `/pf-test` на неё.
- Подтвердить поведенчески: (а) `TC-001` фикстуры получает `✓`; (б) Phase 5 не останавливается на предусловии (Task 3); (в) копия удаляется по завершении, основной чекаут не затронут.
- При расхождении с текстом `SKILL.md` — вернуться к Task 1-4, поправить формулировку, повторить.

**Acceptance Criteria:**
- [ ] TC-008 passes (`TC-001` фикстуры — `✓`, Phase 5 без остановки,
      временная копия удалена)
