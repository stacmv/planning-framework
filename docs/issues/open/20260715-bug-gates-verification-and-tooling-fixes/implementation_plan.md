## Implementation Plan: gates-verification-and-tooling-fixes

### Overview

Четыре разнородные находки `analysis.md`, три из них с реальным кодом. Находка 1
не требует правок кода — только живая верификация уже смёрженного фикса
(`d865899`). Находка 2 не входит в этот план: перепроверена на `develop` и
уже исправлена другим закрытым issue (`20260729-bug-pf-close-parent-branch-and-usage-window`),
своего регресс-теста не требует. Остаются: Находка 3a+побочный риск
патчинга (экранированный `\|` в `checklist.js`), Находка 3b (потеря не-TC
секций), Находка 4 (`make converge` без `--yes`).

### Files to Create/Modify

- `docs/issues/open/20260715-bug-gates-verification-and-tooling-fixes/session-log.md` — запись результатов верификации Находки 1 (Task 1); `manual_test_checklist.md` этого issue появится позже, на стадии `/pf-test` — не деливерабл этого плана
- `tools/manual-test-ui/lib/checklist.js` — `splitCells()` и `patchStepResult()` (Task 2), парсинг не-TC секций (Task 3)
- `tools/manual-test-ui/test/checklist-escaped-pipe.test.js` — новый тест (Task 2)
- `tools/manual-test-ui/test/checklist-patch.test.js` — существующие тесты `patchStepResult()` должны остаться зелёными после Task 2 (не меняется, только прогоняется)
- `tools/manual-test-ui/test/checklist-ru.test.js` — расширяется фикстурой не-TC секции (Task 3)
- `Makefile` — цель `converge`, блок `help:` (Task 4)

### Implementation Tasks

#### Task 1: Верификация входных гейтов Находки 1 (живой прогон, без правок кода)

**Mapped Test Cases:** TC-001, TC-002, TC-003

**Files:**
- `test/skills-static.sh` — не меняется, только запускается (TC-001)
- `docs/issues/open/20260715-bug-gates-verification-and-tooling-fixes/session-log.md` - зафиксировать дословные тексты отказов из TC-002/TC-003

**Implementation Notes:**
- **Продакшн-код по этой находке не меняется.** Починка (`skills/pf-size-tiers/SKILL.md`, `skills/pf-impl-plan/SKILL.md`, `skills/pf-execute/SKILL.md`, `test/skills-static.sh`) уже на `develop` (`d865899`). Задача — только запустить `bash test/skills-static.sh` (TC-001) и провести два живых прогона в отдельной копии закрытого `20260713-bug-v2-to-v3-migration-defects` (не в реальном open-issue), строго по шагам TC-002 и TC-003 из `test_plan.md`.
- `manual_test_checklist.md` этого issue — не деливерабл этой задачи: он генерируется скилом `/pf-test` на более поздней стадии пайплайна (после `/pf-execute`), не задачей implementation plan. Деливерабл здесь — сам факт прогона и его результат; убедиться, что TC-002/TC-003 со своим статусом попадут в чеклист, который `/pf-test` сгенерирует позже (эта задача их не пишет заранее, чтобы не столкнуться с автогенерацией).
- TC-003 требует синхронного вмешательства «между сообщениями модели» (удалить файл после того, как `/pf` уже выбрал следующую стадию, но до вызова скила) — при неудачном окне шаг повторяется, это не fail.
- Если TC-002 или TC-003 провалится (скил продолжил работу по памяти, не проверив диск) — это не повод чинить прозу инструкции ещё раз (она уже усилена), а сигнал завести отдельный follow-up issue с точным транскриптом отказа; в рамках этого issue правок делать не нужно.
- Результат обоих ручных прогонов (дословные тексты отказов) фиксируется в `session-log.md`.

**Acceptance Criteria:**
- [ ] TC-001 passes
- [ ] TC-002 passes
- [ ] TC-003 passes

#### Task 2: Экранированный `\|` в ячейках таблицы — парсинг и обратная сериализация

**Mapped Test Cases:** TC-007, TC-010

**Files:**
- `tools/manual-test-ui/lib/checklist.js` - `splitCells()` (`:39-47`) распознаёт `\|` и не разбивает по нему ячейку; `patchStepResult()` (`:209-225`) восстанавливает экранирование при перезаписи строки
- `tools/manual-test-ui/test/checklist-escaped-pipe.test.js` - новый файл, фикстура `ESCAPED_PIPE_FIXTURE` и литерал `EXPECTED_ACTION` из `test_plan.md` (TC-007), плюс сценарий парсинг-патч-повторный парсинг (TC-010)
- `tools/manual-test-ui/test/checklist-patch.test.js` - не меняется по содержанию, но существующие сценарии (в т.ч. "step 4: a pipe in a note becomes a slash") должны остаться зелёными после правки - прогнать и убедиться

**Implementation Notes:**
- Оба дефекта — один корень (`splitCells`/`patchStepResult` в одном файле), фиксятся одной задачей: чинить только парсинг без обратной сериализации оставит `patchStepResult` ломать файл при первой же отметке чекбокса в UI — регрессия, которую TC-007 не ловит (не патчит и не перечитывает), а TC-010 ловит.
- `splitCells()`: заменить `s.split("|")` на regex-split с negative lookbehind, без плейсхолдера и без отдельного шага восстановления:
  ```js
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
  ```
  Split режет строку по каждому `|`, которому не предшествует `\`; `.replace(/\\\|/g, "|")` затем раскрывает `\|` внутри уже выделенной ячейки в литеральный `|`. Итог — `\|` внутри ячейки парсится как один литеральный `|`, ячейка не делится (контракт TC-007: `EXPECTED_ACTION` — строка с раскрытым пайпом, а не оставленным `\|`, см. литерал в `test_plan.md`).
- `patchStepResult()` (`:216-222`): после фикса выше `splitCells(row)` возвращает уже раскрытые ячейки, поэтому при сборке строки обратно нужно экранировать **все** ячейки перед `join`, не только патчимую: `cells.map((c) => c.replace(/\|/g, "\\|")).join(" | ")`. Это безопасно для патчимой ячейки — `box`/`cleanNote` не содержат `|` (`cleanNote` уже заменяет `|` на `/`, `:220`), экранирование её не тронет — а соседние нетронутые ячейки с исходным `\|` не потеряют экранирование при перезаписи строки. Без этого шага первая же отметка чекбокса в UI на строке с `\|` разрушает эту же ячейку заново — это и есть TC-010.
- Не трогать `RESULT_CELL_RE`, `TEST_DATA_LABEL_RE` и прочую логику вне `splitCells`/`patchStepResult` — фикс локален.
- Тестовый файл — плоский стиль (top-level `assert`, без `describe/it`), как `checklist-ru.test.js`; тест обязателен написать до фикса и убедиться, что он красный (см. `test_plan.md`, TC-007 Expected Outcome), затем зафиксировать зелёным после правки.

**Acceptance Criteria:**
- [ ] TC-007 passes
- [ ] TC-010 passes
- [ ] `make test` зелёный (включая существующий `tools/manual-test-ui/test/checklist-patch.test.js` — новое экранирование не должно его сломать)

#### Task 3: Не-TC секции между TC-блоками не теряются молча

**Mapped Test Cases:** TC-008

**Files:**
- `tools/manual-test-ui/lib/checklist.js` - цикл разбора тела TC-секции (`:92-180`): контент строк, не совпавших ни с одним известным лейблом, между двумя TC-блоками сейчас не попадает никуда (`parseWarnings` пуст, `meta`/`prerequisites`/`notesText` его не содержат). Цикл до первого TC (`:56-61`, наполняющий `meta`) не трогается — TC-008 покрывает только межблочный случай, расширять на header-блок не нужно, это рискует задеть уже проверенное поведение `meta` в `checklist-ru.test.js`
- `tools/manual-test-ui/test/checklist-ru.test.js` - добавить в конец файла блок с `LOST_SECTION_FIXTURE` из `test_plan.md` (TC-008)

**Implementation Notes:**
- Дефект — не сам regex `TC_HEADING_RE` (`:9`), а то, что цикл разбора тела TC (`:92-180`) не имеет ветки для строк, которые не совпали ни с одним из известных лейблов (`PREREQ_LABEL_RE`, `STEPS_HEADER_RE`, `TEST_DATA_LABEL_RE`, `PREPARED_PATH_RE`, `NOTES_LABEL_RE`) — такие строки просто пропускаются циклом `for` без действия.
- Реализация — на выбор (test_plan.md не предписывает форму, только факт непотери): (а) собирать нераспознанные строки между TC-блоками в отдельное поле результата (например, `parsed.looseSections` или подобное), либо (б) добавлять предупреждение в `parseWarnings` предыдущего TC с сохранённым текстом. Выбрать вариант (а) — отдельное поле — так как секция «Общая подготовка» концептуально не принадлежит предыдущему TC, и UI (`tools/manual-test-ui`, вне охвата этой задачи) сможет впоследствии решить, показывать ли её.
- Ограничить фикс только контентом между `sectionEnd`-границами TC-блоков (тем, что уже проходит через цикл `:92-180`) — не расширять на header-блок до первого TC (`:56-61`), чтобы не задеть `meta`.
- Регресс-тест дописывается в конец `checklist-ru.test.js` (не новый файл — так предписывает `test_plan.md`), с фикстурой `LOST_SECTION_FIXTURE` и маркером `SECTION-MARKER-3b7f2c`, проверяемым через `JSON.stringify(parsed).includes(...)`.
- `tools/manual-test-ui/test/checklist-patch.test.js` (step 7, "sections the parser does not understand survive a patch") не должен сломаться: он проверяет, что `patchStepResult` не переписывает нераспознанные строки файла целиком — это уже гарантировано тем, что патч меняет только одну строку по `lineIndex`, и не зависит от того, попадает ли контент в `parsed.looseSections`.

**Acceptance Criteria:**
- [ ] TC-008 passes
- [ ] `make test` зелёный (включая `tools/manual-test-ui/test/checklist-patch.test.js` step 7)

#### Task 4: `make converge` пробрасывает `--yes`

**Mapped Test Cases:** TC-009

**Files:**
- `Makefile` - цель `converge` (`:79-80`) и блок `help:` (`:15-16`)

**Implementation Notes:**
- По образцу `tui`/`update-skills`, использующих `$(if $(VAR),--flag,)`: добавить `$(if $(YES),--yes,)` вторым аргументом в вызов `scripts/converge-to-v3.sh` внутри цели `converge`.
- `scripts/converge-to-v3.sh` разбирает флаги обычным циклом `while`/`case` по `$1` со `shift` (`--target`/`--target=*` на `:126-133`, `--yes | -y` на `:145`) — порядок `--target ... --yes` не важен, флаг распознаётся независимо от позиции.
- `make converge TARGET=/tmp/x YES=1` должен печатать (`make -n`) команду с `--target /tmp/x --yes`; `make converge TARGET=/tmp/x` без `YES` — без `--yes`, поведение по умолчанию (интерактивный запрос `converge-to-v3.sh`) не меняется.
- В блок `help:` добавить строку-пару к `make converge TARGET=<path>` (`:16`), например `make converge TARGET=<path> YES=1    Converge non-interactively (skip confirmation prompt)` — по прецеденту парных строк `tui`/`test-ui` в том же блоке.
- Обновление внешней документации (`README.md`, `CLAUDE.md`, `docs/planning/*.md`), упоминающей `make converge`, — вне acceptance этого issue (`analysis.md` явно отмечает это как "не блокер"); не трогать.
- Условие приёмки Находки 4 в `analysis.md` — реальный прогон `make converge TARGET=/tmp/x YES=1 < /dev/null`, доходящий до converge; TC-009 (авто) проверяет только вывод `make -n`, поэтому один живой прогон стоит сделать вручную при закрытии задачи, не полагаясь только на `make -n`.

**Acceptance Criteria:**
- [ ] TC-009 passes
