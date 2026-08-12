## Implementation Plan: Глобальный чек-лист ручных тестов

### Overview

Один новый артефакт (`docs/planning/templates/global/test-plan.md`) и одна
новая фаза в `/pf-close` (Phase 4.5 — перенос `Manual`-кейсов закрываемой
issue в `docs/planning/test-plan.md`, между Phase 4 «Merge» и Phase 5
«Archive»), плюс точечная правка `t5_global_docs()` в
`scripts/converge-to-v3.sh`, которая доставляет шаблон в проекты `converge`.
Ни блокирующих гейтов закрытия, ни регрессионного отбора, ни поля «кто
выполнил» — эти пункты явно исключены из объёма (`brd.md`, Non-Goals).

Продуктовая правка (Task 1) — единый предшественник для всего остального:
все Auto-кейсы группы A (`specs.md`, «Группа A») проверяют, что придуманное
правило реально задокументировано в `skills/pf-close/SKILL.md` через
drift-guard-grep, а кейсы группы B (`specs.md`, «Группа B») проверяют
поведение `test/pf-product-test-plan.sh`/`t5_global_docs()`, которых сегодня
нет вовсе. Пока Task 1 не выполнен, все 19 TC красные по «фичи нет», а не по
дефекту теста — это ожидаемое и диагностичное состояние
(`test_plan.md`, «Prerequisites»), а не сигнал сломанного плана.

Задачи 2–8 пишут единый новый файл `test/pf-product-test-plan.sh` —
по одному TC-кластеру за раз, по тому же принципу, что `test/pf-close.sh`
и `test/skills-role-matrix-static.sh` уже применяют для смежных issue:
транскрибированный bash-helper + обязательный drift-guard-grep для группы A,
прямой запуск скрипта/`pf_run_converge` для группы B. Файл единый и
существует физически только с Task 2 — задачи 3–8 расширяют его, не
переписывают. Ручные кейсы TC-014/TC-016 — отдельная последняя задача,
целиком в изолированной копии репозитория (`test_plan.md`, «Manual-кейсы»).

**Правило порядка внутри общего файла.** Так как suite-файл растёт добавлением
секций в конец и исполняется целиком, инлайново, сверху вниз (`Makefile:39`:
`bash "$$t"` — весь файл одним прогоном интерпретатора), ни один TC-блок не
имеет права вызывать bash-функцию, определённую в задаче с БОЛЬШИМ номером:
такой вызов на исполнении либо упадёт с «command not found», либо (если имя
случайно совпадёт с более ранним черновиком) выполнится не той версией.
Это ограничение и определяет порядок задач 2 → 8 ниже — в частности поэтому
валидатор формы (нужен TC-009, TC-018, TC-019) идёт под номером 4, раньше
первого TC, который его вызывает, а не под номером 5, как в предыдущей
редакции плана (P0 ревью).

### Files to Create/Modify

**New:**
- `docs/planning/templates/global/test-plan.md` — шаблон пустого списка
- `test/pf-product-test-plan.sh` — новый static/behavioural suite, TC-001..TC-013,
  TC-015, TC-017..TC-019 (17 Auto-кейсов)
- `test/fixtures/pf-product-test-plan/issue-mixed-types/docs/issues/open/20990101-feat-fixture-mixed/test_plan.md`
- `test/fixtures/pf-product-test-plan/global-fresh/docs/planning/test-plan.md`
- `test/fixtures/pf-product-test-plan/global-after-retired-deleted/docs/planning/test-plan.md`
- `test/fixtures/pf-product-test-plan/global-stale-counter/docs/planning/test-plan.md`
- `test/fixtures/pf-product-test-plan/global-duplicate-ptc/docs/planning/test-plan.md`
- `test/fixtures/pf-product-test-plan/global-malformed-rows/{prio-bad,status-bad,ptc-bad,no-counter}/docs/planning/test-plan.md`
- `test/fixtures/pf-product-test-plan/issue-pipe-in-fields/docs/issues/open/20990101-feat-fixture-pipes/test_plan.md`
- `test/fixtures/pf-product-test-plan/area-diff-repo/` (минимальная база под `pf_setup_case --git`)
- `test/fixtures/pf-product-test-plan/v3-with-existing-test-plan/docs/planning/test-plan.md`
- `test/fixtures/pf-product-test-plan/issue-duplicate-titles/docs/issues/open/20990101-feat-fixture-duplicate-titles/test_plan.md`
- `test/fixtures/pf-product-test-plan/issue-non-self-contained-title/docs/issues/open/20990101-feat-fixture-title/test_plan.md`
- `test/fixtures/pf-product-test-plan/global-manual-edit/docs/planning/test-plan.md`
- `test/fixtures/pf-product-test-plan/global-retired-row/docs/planning/test-plan.md`
- `test/fixtures/pf-product-test-plan/issue-real-close/docs/issues/open/20990101-feat-fixture-realclose/{test_plan.md,qa_report.md}`
- `test/fixtures/pf-product-test-plan/issue-partial-promotion/docs/issues/open/20990101-feat-fixture-partial/{test_plan.md,qa_report.md}` + `.../issue-partial-promotion/docs/planning/test-plan.md`

**Modified:**
- `skills/pf-close/SKILL.md` — новая `## Phase 4.5` между Phase 4 и Phase 5;
  `git add` на Phase 8 дополняется путём `docs/planning/test-plan.md`
- `scripts/converge-to-v3.sh` — `t5_global_docs()` учится про `test-plan.md`

**Не трогается:** `Makefile` (цикл `test:` подхватывает `test/*.sh` сам),
`test/fixtures/v3-incomplete/` (уже существует и используется как есть для
TC-011, без изменений).

---

### Implementation Tasks

#### Task 1: Шаблон, Phase 4.5 в `/pf-close`, `t5_global_docs()`

**Task Type:** code
**Mapped Test Cases:** none (продуктовый prerequisite — разблокирует все 17
Auto-кейсов из задач 2–7: без него drift-guard'ы группы A не находят правил,
а группа B не находит скрипт/поведение конвергенции)

**Files:**
- `docs/planning/templates/global/test-plan.md` - новый, пустой список по
  `specs.md` («Data model»): заголовок `# Manual Test Plan`, пояснительный
  абзац, строка `Last allocated: none`, таблица `| PTC | Area | Test case |
  Prio | Origin | Last run | Status |` без строк данных
- `skills/pf-close/SKILL.md` - вставить `## Phase 4.5` между текущими
  `## Phase 4: Merge` и `## Phase 5: Archive Issue Folder`; дополнить `git
  add` в `## Phase 8: Archive Commit` (сейчас: `git add docs/issues/
  docs/planning/session-log.md`) путём `docs/planning/test-plan.md`; дополнить
  список пунктов `## Phase 1: Confirm with User` («This will: …») строкой
  о переносе Manual-кейсов в `docs/planning/test-plan.md` (P2 ревью —
  Phase 4.5 добавляет пользовательски видимый side effect, которого сегодня
  нет в списке, показываемом перед подтверждением закрытия)
- `scripts/converge-to-v3.sh` - `t5_global_docs()` (сейчас перечисляет
  `session-log.md decisions.md implementation-plan.md`): добавить
  `test-plan.md` в перечисляемый список файлов

**Implementation Notes:**
- Основа текста Phase 4.5 — раздел `specs.md` «Stage: `/pf-close` — Phase
  4.5, перенос» почти дословно: он уже написан с прицелом на будущие
  drift-guard-greps (в духе `Self-tracking upstream guard` в Phase 3 —
  см. `test/pf-close.sh` TC-005) и переносить его свободным пересказом —
  верный способ незаметно потерять формулировку, по которой Task 2, 3, 5
  ищут правило. Перенести обязаны все перечисленные ниже пункты — Task 2, 3,
  5 (группа A — drift-guard'ы; Task 4 group B не грепает SKILL.md, см. её
  собственный раздел) проверяют присутствие каждого через grep:
  1. отбор строк Status Tracker закрываемой issue по `Type: Manual`, Auto
     игнорируется целиком; **колонки таблицы определяются по заголовку**
     (`Type`, `Test Case`, `Priority`, `Status`), не по фиксированной
     позиции — в репозитории сосуществуют два реальных порядка колонок:
     `TC | Type | Test Case | Priority | Status | Remarks`
     (`docs/planning/templates/issue/test_plan.md`) и `TC | Test Case | Type
     | Priority | Status | Remarks` (`~/.claude/skills/pf-test-plan/
     SKILL.md`, Step 4 — тот же порядок, что и в `test_plan.md` этой issue).
     Позиционный парсинг на одной из двух раскладок прочитает название кейса
     как `Type` и не перенесёт ни одной строки (P1-B ревью);
  2. таблица нормализации `Priority` → `Prio`: `Critical→Critical,
     High→High, Medium→Med, Low→Low`; значение вне словаря → `Med` +
     примечание в `Test case`;
  3. отображение статуса: `[ ]`→`pending`, `✓`→`✓`, `✗`→`✗`; `Last run` —
     `—` для `pending`, дата закрытия issue для `✓`/`✗`;
  4. правило выделения номера: следующий `PTC` = максимум из числа в строке
     `Last allocated:` и наибольшего `PTC` в таблице, плюс один; обновление
     строки `Last allocated:` после переноса;
  5. экранирование `|` → `\|` в `Area`/`Test case`/`Origin` при записи;
  6. вычисление `Area`: Phase 4.5 идёт ПОСЛЕ Phase 4 (`--no-ff` мердж уже
     состоялся), поэтому трёхточечный `<parent>...<issue-branch>` не годится
     — после `--no-ff` мерджа merge-base(`<parent>`, `issue/ISSUE-ID`) сам
     становится вершиной issue-ветки, и такой diff всегда пуст (измерено на
     `20260806-bug-test-plan-tc-untracked`: `git diff develop...issue/…` → 0
     файлов, `git diff <merge>^1 <merge>^2` → 15 — P1-A ревью). Вместо этого
     — оба родителя мерджа, который на Phase 4.5 ещё является свежим `HEAD`
     родительской ветки: `git diff --name-only HEAD^1 HEAD^2` (`HEAD^1` —
     родительская ветка до мерджа, `HEAD^2` — вершина `issue/ISSUE-ID`);
     исключить пути под `docs/issues/`, для `skills/`/`tools/` взять второй
     сегмент пути, для остальных — первый, побеждает сегмент с наибольшим
     числом файлов, при пустом остатке — `general`;
  7. ключ идемпотентности — пара (`ISSUE-ID`, `TC-NNN`), явно **не**
     название кейса — два кейса с одинаковым названием получают разные
     `PTC`;
  8. правило самодостаточности `Test case`: если исходное название кейса
     нечитаемо вне контекста issue, при переносе дополнить его до
     самостоятельной фразы; уже самостоятельные названия переносятся
     дословно;
  9. место фазы — после Phase 4 (мердж уже состоялся), до Phase 5
     (архивации) — и почему: если перенос упадёт после архивации, повторный
     `/pf-close` не найдёт issue в `docs/issues/open/` («No active issue
     found») и ручные кейсы потеряются безвозвратно; до архивации сбой
     оставляет папку на месте, и фаза идемпотентно доводится до конца при
     повторном запуске.
- Заголовок фазы — буквально `## Phase 4.5` (не `## Phase 4.5: ...` с
  отличающейся пунктуацией, которая помешала бы Task 2's grep на «фазы 4,
  4.5, 5 в этом порядке по номерам строк», TC-013 step 1).
- Phase 1 confirmation text (сейчас — список из шести пунктов «This will:
  …») дополняется седьмым пунктом о переносе Manual-кейсов, между пунктом
  про мердж и пунктом про архивацию папки issue — тем же порядком, каким
  сама Phase 4.5 стоит между Phase 4 и Phase 5. Без этого пункта пользователь
  подтверждает закрытие по устаревшему списку действий, хотя команда
  дополнительно создаёт/меняет глобальный `docs/planning/test-plan.md` (P2
  ревью).
- `git add` на Phase 8 — новая форма: `git add docs/issues/
  docs/planning/session-log.md docs/planning/test-plan.md` (порядок
  аргументов не важен для TC-013, но путь должен быть тем же самым файлом
  `docs/planning/test-plan.md`, не паттерном/маской).
- `t5_global_docs()` правится ТОЛЬКО добавлением имени файла в
  перечисляемый список (`for f in session-log.md decisions.md
  implementation-plan.md test-plan.md`) — логика «не перезаписывать, если
  файл уже существует» уже общая для всех файлов цикла и трогать её не
  нужно (TC-012 проверяет именно эту неизменную логику, применённую к
  новому файлу).
- Шаблон должен быть таким, чтобы TC-004 (свежая копия шаблона) и TC-011
  (побайтовое совпадение после `t5_global_docs()`) проходили без
  дополнительных допущений — не добавлять в шаблон ничего, что потребовало
  бы отдельной нормализации в фикстурах Task 3/Task 6.

**Acceptance Criteria:**
- [x] `docs/planning/templates/global/test-plan.md` существует, содержит
  `Last allocated: none` и таблицу без строк данных
- [x] `skills/pf-close/SKILL.md` содержит `## Phase 4.5` между `## Phase 4`
  и `## Phase 5`
- [x] `git add` в Phase 8 включает `docs/planning/test-plan.md`
- [x] `t5_global_docs()` в `scripts/converge-to-v3.sh` перечисляет
  `test-plan.md`
- [x] Phase 1 confirmation text в `skills/pf-close/SKILL.md` упоминает перенос
  ручных кейсов в `docs/planning/test-plan.md`

---

#### Task 2: Каркас suite + отбор/нормализация/статус/порядок фаз (TC-001, TC-002, TC-003, TC-013)

**Task Type:** tests
**Mapped Test Cases:** TC-001, TC-002, TC-003, TC-013
**Blocked By:** Task 1 (все три drift-guard'а грепают текст, который пишет
Task 1)

**Files:**
- `test/pf-product-test-plan.sh` - новый файл: заголовок-комментарий (по
  образцу `test/pf-close.sh`), `source test/lib.sh`, транскрибированные
  bash-helper'ы для отбора по `Type: Manual`, нормализации `Priority` →
  `Prio`, отображения статуса; TC-001, TC-002, TC-003, TC-013; хвостовой
  блок `assert_repo_untouched` + `pf_summary`
- `test/fixtures/pf-product-test-plan/issue-mixed-types/docs/issues/open/20990101-feat-fixture-mixed/test_plan.md`
  - новая фикстура

**Implementation Notes:**
- **Каркас файла** — этот task кладёт первый физический байт
  `test/pf-product-test-plan.sh`. Хвостовые строки `assert_repo_untouched`
  и `pf_summary` должны остаться ПОСЛЕДНИМИ двумя содержательными строками
  файла и в Task 3–7: каждая следующая задача вставляет свои TC-секции
  ПЕРЕД этим хвостом, а не после — иначе `pf_summary` перестанет учитывать
  добавленные PASS/FAIL и вернёт код возврата раньше времени.
- Фикстура `issue-mixed-types` — общая для всех трёх TC этой задачи (тот же
  путь фигурирует в «Требуемые данные» TC-001/002/003 в `test_plan.md`):
  Status Tracker с минимум одной строкой `Type: Auto`, и Manual-строками,
  покрывающими: (a) для TC-001 — минимум 2 строки `Type: Manual`; (b) для
  TC-002 — по одной Manual-строке на каждое из `Priority: Critical / High /
  Medium / Low`, плюс одна строка с нестандартным значением (например
  `Urgent`); (c) для TC-003 — по одной Manual-строке на каждый статус `[ ]`,
  `✓`, `✗`. Один файл `test_plan.md`, покрывающий все комбинации разом,
  проще поддерживать, чем три похожих фикстуры.
- **Заголовок таблицы Status Tracker фикстуры — `TC | Test Case | Type |
  Priority | Status | Remarks`** (тот же порядок, что в `test_plan.md` этой
  самой issue и в `~/.claude/skills/pf-test-plan/SKILL.md` Step 4), а НЕ
  `TC | Type | Test Case | Priority | Status | Remarks` из
  `docs/planning/templates/issue/test_plan.md`. Выбор не случаен (P1-B
  ревью): оба порядка колонок реальны и оба обязаны поддерживаться (Task 1,
  пункт 1) — helper обязан находить колонку `Type` по имени заголовка, а не
  по фиксированной позиции. Фикстура с ЭТИМ порядком — та, что ловит
  позиционную реализацию: если бы helper читал вторую колонку как `Type` по
  позиции, здесь он принял бы название кейса за `Type` и не отобрал бы ни
  одной `Manual`-строки, заваливая TC-001/002/003 по правильной причине.
- **TC-001** (BR-1, отбор): helper читает Status Tracker фикстуры, отбирает
  строки `Type: Manual`, сравнивает число с ожидаемым; drift-guard —
  `grep`/`sed`-срез секции `## Phase 4.5` … до следующего `## Phase` в
  `skills/pf-close/SKILL.md`, ищущий литерал `Type: Manual` в контексте
  отбора (Task 1, пункт 1).
- **TC-002** (нормализация Priority): helper прогоняет 4 табличных значения
  + 1 нестандартное, сверяет с `Critical/High/Med/Low` + `Med` с
  примечанием; drift-guard ищет упоминание `Medium`→`Med` и правило для
  значения вне словаря (Task 1, пункт 2).
- **TC-003** (статус): helper прогоняет `[ ]`/`✓`/`✗`, сверяет
  `pending`/`✓`/`✗` и `Last run` (`—` для pending, дата для прочих);
  drift-guard ищет отображение статусов и правило `Last run` (Task 1,
  пункт 3).
- **TC-013** (порядок фаз и состав коммита, чисто статический, без
  фикстуры): найти номера строк заголовков `## Phase 4`, `## Phase 4.5`,
  `## Phase 5` в `skills/pf-close/SKILL.md` и проверить возрастающий
  порядок; отдельно найти секцию `## Phase 8` и убедиться, что строка `git
  add` содержит подстроку `docs/planning/test-plan.md`.
- Все три drift-guard'а (TC-001..003) сообщают отдельным, специфичным
  текстом при провале — не общим «Phase 4.5 not found» — по образцу
  `test_plan.md`'s требования «Phase 4.5 не документирует отбор по Type:
  Manual» / «...нормализацию Priority → Prio» / «...отображение статусов».

**Acceptance Criteria:**
- [x] TC-001 passes
- [x] TC-002 passes
- [x] TC-003 passes
- [x] TC-013 passes

---

#### Task 3: Выделение номера — три сценария (TC-004, TC-005, TC-006)

**Task Type:** tests
**Mapped Test Cases:** TC-004, TC-005, TC-006
**Blocked By:** Task 2 (расширяет тот же `test/pf-product-test-plan.sh`)

**Files:**
- `test/pf-product-test-plan.sh` - расширить: helper выделения номера
  (`max(Last allocated:, max PTC в таблице) + 1`), TC-004, TC-005, TC-006
- `test/fixtures/pf-product-test-plan/global-fresh/docs/planning/test-plan.md`
  - новая: копия стартового состояния шаблона (`Last allocated: none`,
  пустая таблица) — по содержимому идентична
  `docs/planning/templates/global/test-plan.md` из Task 1
- `test/fixtures/pf-product-test-plan/global-after-retired-deleted/docs/planning/test-plan.md`
  - новая: `Last allocated: PTC-0007`, в таблице максимум `PTC-0005`
  (строки `PTC-0006`/`PTC-0007` отсутствуют — смоделировано ручное удаление
  retired-строк)
- `test/fixtures/pf-product-test-plan/global-stale-counter/docs/planning/test-plan.md`
  - новая: `Last allocated: PTC-0003`, в таблице уже есть строки вплоть до
  `PTC-0005` (смоделирован сбой переноса после записи строк, но до
  обновления счётчика)

**Implementation Notes:**
- Три фикстуры кодируют три разных состояния счётчика/таблицы, каждая по
  одной строке в `test_plan.md`'s «Требуемые данные» — не сводить в одну
  параметризованную фикстуру, чтобы имя файла само документировало
  сценарий.
- **TC-004** (пусто/свежий файл): helper на пустой таблице выдаёт
  `PTC-0001`; отдельно прогнать перенос одного Manual-кейса поверх этого
  состояния и проверить, что новая строка получила `PTC-0001`, а `Last
  allocated:` обновилась.
- **TC-005** (счётчик больше таблицы побеждает): helper на
  `global-after-retired-deleted` выдаёт `PTC-0008`
  (`max(0007,0005)+1`), не `PTC-0006`; номера `0006`/`0007` не появляются
  повторно после переноса нового кейса.
- **TC-006** (таблица больше счётчика побеждает): helper на
  `global-stale-counter` выдаёт `PTC-0006` (`max(0003,0005)+1`), не
  `PTC-0004`; после переноса `Last allocated:` обновляется до `PTC-0006`.
- Один общий drift-guard на все три TC (тот же grep, что в `test_plan.md`
  предписано разделять между TC-004/005/006 идентичным сообщением): искать
  в `skills/pf-close/SKILL.md` формулировку «следующий номер = максимум из
  `Last allocated:` и наибольшего `PTC` в таблице, плюс один» (Task 1,
  пункт 4). Реализовать как одну bash-функцию `assert_numbering_rule_documented`,
  вызываемую из всех трёх TC, чтобы формулировка проверки не разъехалась
  между копиями.

**Acceptance Criteria:**
- [x] TC-004 passes
- [x] TC-005 passes
- [x] TC-006 passes

---

#### Task 4: Валидатор формы — дубликат PTC и закрытые словари (TC-007, TC-008)

**Task Type:** tests
**Mapped Test Cases:** TC-007, TC-008
**Blocked By:** Task 3 (расширяет тот же `test/pf-product-test-plan.sh` — см.
Dependencies)

**Files:**
- `test/pf-product-test-plan.sh` - расширить: сам исполняемый валидатор
  формы (функция `pf_validate_test_plan_file <path>`, вызываемая и как
  часть suite, и напрямую в TC-007/TC-008), TC-007, TC-008
- `test/fixtures/pf-product-test-plan/global-duplicate-ptc/docs/planning/test-plan.md`
  - новая: две разные строки с одинаковым `PTC-0012`
- `test/fixtures/pf-product-test-plan/global-malformed-rows/prio-bad/docs/planning/test-plan.md`
  - новая: одна строка с `Prio: Medium` (не входит в словарь списка,
  который использует `Med`)
- `test/fixtures/pf-product-test-plan/global-malformed-rows/status-bad/docs/planning/test-plan.md`
  - новая: одна строка с `Status: Passed` (самодельное значение)
- `test/fixtures/pf-product-test-plan/global-malformed-rows/ptc-bad/docs/planning/test-plan.md`
  - новая: одна строка `PTC-12` (не 4 цифры)
- `test/fixtures/pf-product-test-plan/global-malformed-rows/no-counter/docs/planning/test-plan.md`
  - новая: таблица без строки `Last allocated:` над ней

**Implementation Notes:**
- **Эта задача стоит под номером 4, а не 5, как в предыдущей редакции плана
  (P0 ревью — структурный фикс, не заглушка).** Task 5 (следующая) и Task 7
  вызывают `pf_validate_test_plan_file` в TC-009/TC-018/TC-019. Suite-файл
  растёт добавлением секций в конец и исполняется целиком, построчно, одним
  прогоном интерпретатора (см. правило порядка в Overview) — определение
  функции обязано физически предшествовать первому вызову в файле. Расположив
  валидатор здесь, до всех задач, которые его вызывают, план гарантирует это
  на уровне порядка задач, а не полагается на «формально не блокирует».
- Группа B (`test_plan.md`): красный сегодня означает «инфраструктуры нет»,
  а не «правило неверно» — TC-007 step 1 и TC-008 step 1 сначала явно
  проверяют СУЩЕСТВОВАНИЕ `test/pf-product-test-plan.sh`
  (`[ -f test/pf-product-test-plan.sh ]`), не исполняемость. Измерено: 11 из
  13 suite-файлов `test/*.sh` в репозитории сегодня лежат в режиме `100644`
  (не `+x`), а `Makefile:39` запускает каждый как `bash "$$t"` независимо от
  бита прав — проверка `[ -x ]` была бы ложной ВСЕГДА, даже после реализации
  этой задачи, и диагностика группы B никогда бы не сработала как задумано
  (P1-D ревью). `test_plan.md` формулирует шаг как «существует и исполняем»;
  здесь это реализуется как проверка существования, совместимая с реальной
  конвенцией репозитория — а не повод класть файл в режим 755. С отдельным
  диагностическим сообщением, и только потом переходят к поведению; это
  разводит «скрипта нет» и «скрипт есть, но не ловит дефект» на разные
  сообщения, как того требует `test_plan.md`.
- Валидатор — read-only: не изменяет проверяемый файл (важно для TC-019 в
  Task 7, которая сравнивает файл до/после запуска).
- **TC-007** (дубликат PTC): запустить валидатор на `global-duplicate-ptc`,
  ожидать ненулевой код возврата и упоминание конкретного номера
  `PTC-0012` в выводе.
- **TC-008** (форма строк и словари): по одному прогону на каждый из 4
  файлов `global-malformed-rows/*`, каждый прогон ожидает ненулевой код и
  сообщение, называющее конкретное поле (`Prio`/`Status`/`PTC`) или
  отсутствие `Last allocated:` — четыре отдельных `pf_assert`/сообщения, не
  один общий.
- Словари для валидатора — те же закрытые множества, что в `specs.md`:
  `Prio ∈ {Critical, High, Med, Low}`, `Status ∈ {pending, ✓, ✗, retired}`,
  `PTC` — ровно 4 цифры после дефиса.
- Эта задача даёт Task 5 (TC-009) и Task 7 (TC-018/TC-019) готовую функцию
  валидатора — определение уже в файле раньше первого вызова, ничего не
  ссылается на заглушку.

**Acceptance Criteria:**
- [x] TC-007 passes
- [x] TC-008 passes

---

#### Task 5: Экранирование, Area, идемпотентность, самодостаточность (TC-009, TC-010, TC-015, TC-017)

**Task Type:** tests
**Mapped Test Cases:** TC-009, TC-010, TC-015, TC-017
**Blocked By:** Task 4 (TC-009 вызывает `pf_validate_test_plan_file`,
определённую в Task 4 — зависимость не только по общему файлу, но и по
исполняемому символу)

**Files:**
- `test/pf-product-test-plan.sh` - расширить: TC-009, TC-010, TC-015,
  TC-017 и их helper'ы
- `test/fixtures/pf-product-test-plan/issue-pipe-in-fields/docs/issues/open/20990101-feat-fixture-pipes/test_plan.md`
  - новая: один `Type: Manual` кейс, чьё название содержит `|` (например
  `Проверить экспорт: CSV | JSON | PDF`)
- `test/fixtures/pf-product-test-plan/area-diff-repo/` - новая: минимальная
  база под `pf_setup_case --git` (один файл-плейсхолдер достаточно; ветки
  `develop`/`issue/<ID>`, правки файлов `skills/pf-close/SKILL.md`,
  `skills/pf-close/foo.md`, `scripts/converge-to-v3.sh`,
  `docs/issues/open/<ID>/specs.md` на `issue/<ID>`, и сам `--no-ff` мердж
  `issue/<ID>` в `develop` (воспроизводящий Phase 4) создаются самим тестом
  поверх базы, не фикстурой — см. `test_plan.md` TC-010 «Требуемые данные»)
- `test/fixtures/pf-product-test-plan/issue-duplicate-titles/docs/issues/open/20990101-feat-fixture-duplicate-titles/test_plan.md`
  - новая: два `Type: Manual` кейса с буквально одинаковым названием
  (`TC-001`, `TC-002`, разные шаги)
- `test/fixtures/pf-product-test-plan/issue-non-self-contained-title/docs/issues/open/20990101-feat-fixture-title/test_plan.md`
  - новая: один самостоятельный Manual-кейс («Тема сохраняется между
  перезагрузками страницы») и один контекстно-зависимый («Проверить шаг 3»)
  с достаточным контекстом в `Description` для детерминированного
  дополнения

**Implementation Notes:**
- **TC-009** (экранирование `|`): перенести кейс с `|` в названии,
  проверить, что записано как `\|` и число полей строки не изменилось;
  прогнать `pf_validate_test_plan_file` (определена в Task 4 — уже реальная
  функция, не заглушка, см. Blocked By выше) на результирующем файле —
  строка должна остаться одной корректной строкой из 7 полей. Drift-guard
  ищет правило экранирования `\|` в `Area`/`Test case`/`Origin` (Task 1,
  пункт 5).
- **TC-010** (Area по diff): построить `pf_setup_case area-diff-repo --git`,
  создать ветку `develop`, ветку `issue/<ID>`, внести туда 4 файла из
  фикстуры-описания выше НА `issue/<ID>`; ЗАТЕМ смоделировать реальный
  Phase 4: переключиться на `develop` и выполнить `git merge --no-ff
  issue/<ID>` — без этого шага фикстура тестировала бы предмерджевый граф, а
  не тот, на котором реально работает Phase 4.5 (P1-A ревью, верифицировано
  на закрытии `20260806-bug-test-plan-tc-untracked`: после `--no-ff` мерджа
  трёхточечный `git diff develop...issue/…` даёт 0 файлов, потому что
  merge-base становится вершиной issue-ветки, тогда как `git diff
  <merge>^1 <merge>^2` даёт 15). Вычислить `git diff --name-only HEAD^1
  HEAD^2` (`HEAD` — только что созданный merge-коммит на `develop`),
  исключить `docs/issues/`, применить сегментацию (второй сегмент для
  `skills/`/`tools/`, первый — для остальных), проверить победу `pf-close`
  (2 файла) над `scripts` (1 файл). Drift-guard ищет команду `git diff
  --name-only HEAD^1 HEAD^2` (или эквивалентную формулировку через
  родителей merge-коммита — не трёхточечный `<parent>...<issue-branch>`),
  исключение `docs/issues/`, правило сегментации и победу большинства
  (Task 1, пункт 6).
- **TC-015** (идемпотентность, изначально Manual в исходном черновике —
  Auto здесь по решению `test_plan.md`: полностью детерминирован на
  фикстуре): прогнать перенос дважды подряд на `issue-duplicate-titles`;
  первый прогон — обе строки с одинаковым названием получают разные `PTC` и
  разные `Origin` (`...#TC-001`/`...#TC-002`); второй прогон без изменений
  в issue — не создаёт новых строк, `Last allocated:` не меняется.
  Drift-guard ищет формулировку ключа идемпотентности — пара `ISSUE-ID` +
  `TC-NNN`, не название (Task 1, пункт 7).
- **TC-017** (самодостаточность `Test case`): перенести оба кейса из
  `issue-non-self-contained-title`; самостоятельное название переносится
  дословно, контекстно-зависимое — дополняется (длиннее исходного, не
  равно голому «Проверить шаг 3», понятно без перехода по `Origin`).
  Drift-guard ищет правило дополнения нечитаемых вне контекста названий
  (Task 1, пункт 8).

**Acceptance Criteria:**
- [x] TC-009 passes
- [x] TC-010 passes
- [x] TC-015 passes
- [x] TC-017 passes

---

#### Task 6: Поведение `converge` — создание и не-перезапись (TC-011, TC-012)

**Task Type:** tests
**Mapped Test Cases:** TC-011, TC-012
**Blocked By:** Task 5 (расширяет тот же `test/pf-product-test-plan.sh`)

**Files:**
- `test/pf-product-test-plan.sh` - расширить: TC-011, TC-012
- `test/fixtures/pf-product-test-plan/v3-with-existing-test-plan/docs/planning/test-plan.md`
  - новая: содержимое заведомо не совпадает с шаблоном (посторонняя
  строка-метка, например `<!-- fixture: pre-existing user content -->`
  рядом с валидной таблицей)

**Implementation Notes:**
- **TC-011** (создание из шаблона): step 1 — явная проверка, что
  `docs/planning/templates/global/test-plan.md` существует (иначе отдельное
  сообщение «шаблон ещё не создан», Task 1 не выполнен); step 2 — запустить
  `pf_run_converge` (обёртка `test/lib.sh`, НЕ вызывать
  `scripts/converge-to-v3.sh` напрямую — S-1) на копии `test/fixtures/v3-incomplete/`
  (существующая фикстура, не создаётся здесь) и сравнить
  `docs/planning/test-plan.md` в целевой директории с шаблоном побайтово.
- **TC-012** (не перезаписывает существующий): step 1 — позитивная
  проверка, что тело функции `t5_global_docs()` в
  `scripts/converge-to-v3.sh` (диапазон строк от `t5_global_docs() {` до
  закрывающей `}`) содержит `test-plan.md` в перечисляемом списке — если
  нет, тест падает с «t5_global_docs() ещё не знает про test-plan.md»
  (Task 1 не выполнен), и это ожидаемый красный, а не вакуозный проход;
  step 2 — скопировать `v3-incomplete`, положить в неё
  `v3-with-existing-test-plan`'s `docs/planning/test-plan.md`, прогнать
  `pf_run_converge`; step 3 — сравнить файл до/после побайтово, ожидать
  отсутствие изменений.
- Обе TC используют только публичные обёртки `test/lib.sh`
  (`pf_run_converge`, `pf_setup_case`) — прямой вызов
  `scripts/converge-to-v3.sh` запрещён S-1 и проверяется отдельно
  `test/safety-audit.sh` (TC-032), не этой задачей.

**Acceptance Criteria:**
- [x] TC-011 passes
- [x] TC-012 passes

---

#### Task 7: Ручная правка и retired-строка переживают формат (TC-018, TC-019)

**Task Type:** tests
**Mapped Test Cases:** TC-018, TC-019
**Blocked By:** Task 6 (расширяет тот же `test/pf-product-test-plan.sh`;
кроме того использует `pf_validate_test_plan_file` из Task 4)

**Files:**
- `test/pf-product-test-plan.sh` - расширить: TC-018, TC-019; хвостовой
  блок `assert_repo_untouched` + `pf_summary` (из Task 2) остаётся
  последним
- `test/fixtures/pf-product-test-plan/global-manual-edit/docs/planning/test-plan.md`
  - новая: одна строка `Status: pending`
- `test/fixtures/pf-product-test-plan/global-retired-row/docs/planning/test-plan.md`
  - новая: `Last allocated: PTC-0005`, строки `PTC-0001`..`PTC-0005`, у
  `PTC-0003` — `Status: retired`

**Implementation Notes:**
- **TC-018** (ручная правка переживает формат, AC-3.1): step 1 —
  существование валидатора (Task 4), иначе отдельное сообщение; step 2 —
  эмулировать ручную правку (`Status: pending` → `Status: ✓` + дата в `Last
  run`) прямо в копии фикстуры; step 3 — прогнать валидатор, ожидать успех;
  step 4 — прогнать перенос ещё одного нового Manual-кейса поверх этого
  файла (тем же helper'ом, что Task 2), убедиться, что вручную изменённая
  строка осталась побайтово такой же.
- **TC-019** (retired не удаляется и не переиспользуется, AC-3.3): step 1 —
  существование валидатора; step 2 — прогнать валидатор на
  `global-retired-row`, ожидать успех (`retired` — валидное значение
  словаря); step 3 — сравнить файл до/после запуска валидатора, ожидать
  отсутствие изменений (валидатор read-only, строка `PTC-0003` на месте);
  step 4 — прогнать перенос нового Manual-кейса поверх файла, ожидать
  `PTC-0006` (`max(0005)+1`), номер `PTC-0003` нигде не переиспользуется.
- Эта задача — последняя, трогающая тело `test/pf-product-test-plan.sh`:
  после неё хвостовой блок `assert_repo_untouched` / `pf_summary`
  подтверждается финальным чтением файла (не изменяется, только
  проверяется, что остался в конце).

**Acceptance Criteria:**
- [x] TC-018 passes
- [x] TC-019 passes

---

#### Task 8: Manual — реальное закрытие и восстановление после сбоя (TC-014, TC-016)

**Task Type:** tests
**Mapped Test Cases:** TC-014, TC-016
**Blocked By:** Task 1 (использует только `skills/pf-close/SKILL.md`, не
трогает `test/pf-product-test-plan.sh` — не зависит от Task 2–7 по коду, но
не может идти раньше Task 1)

**Files:**
- `test/fixtures/pf-product-test-plan/issue-real-close/docs/issues/open/20990101-feat-fixture-realclose/test_plan.md`
  - новая: минимум один `Type: Manual` и один `Type: Auto` кейс
- `test/fixtures/pf-product-test-plan/issue-real-close/docs/issues/open/20990101-feat-fixture-realclose/qa_report.md`
  - новая: `## Verdict` с `**PASS**` (нужно для прохождения `/pf-close`
  Phase 0)
- `test/fixtures/pf-product-test-plan/issue-partial-promotion/docs/issues/open/20990101-feat-fixture-partial/test_plan.md`
  - новая: два `Type: Manual` кейса
- `test/fixtures/pf-product-test-plan/issue-partial-promotion/docs/issues/open/20990101-feat-fixture-partial/qa_report.md`
  - новая: `**PASS**`
- `test/fixtures/pf-product-test-plan/issue-partial-promotion/docs/planning/test-plan.md`
  - новая: **до** промоушена этой фикстур-issue список уже содержал
  `Last allocated: PTC-0005` (и, опционально, ранее перенесённые строки
  вплоть до `PTC-0005` — пустая таблица тоже подходит). Фикстура фиксирует
  состояние ПОСЛЕ первой записанной строки, но ДО второй и ДО обновления
  счётчика: таблица уже содержит `PTC-0006` (`Origin:
  20990101-feat-fixture-partial#TC-001`), а строка-счётчик всё ещё
  `Last allocated: PTC-0005` — значение ДО промоушена, не `PTC-0006` (P2
  ревью). Если бы счётчик уже стоял на `PTC-0006`, состояние было бы
  неотличимо от штатного (счётчик и таблица согласованы), и TC-016 не
  проверяло бы восстановление после сбоя, а тривиально повторяло бы
  TC-004/006. Повторный `/pf-close` обязан посчитать номер второй строки как
  `max(0005, 0006) + 1 = PTC-0007`, не переиспользуя и не повторяя
  `PTC-0006`.

**Implementation Notes:**
- **Изоляция реального `$HOME` — только на уровне репозитория и remote, не
  на уровне транскриптов Claude Code (P1-C ревью).** Шаги 1–3 ниже
  гарантируют, что копия репозитория не имеет доступа ни к реальному
  remote, ни к реальным issue — тем же уровнем защиты, что `test/lib.sh`
  даёт Auto-кейсам через `TMP_HOME` для `converge-to-v3.sh` (`test/lib.sh:11`).
  Но `converge-to-v3.sh` эта задача не запускает — она открывает ЖИВУЮ
  сессию Claude Code, а `HOME` для такой сессии подменить временной пустой
  директорией нельзя: сессии нужны реальные учётные данные/конфигурация из
  `~/.claude/`, которых во временном `HOME` не будет. Поэтому протокол НЕ
  претендует на полную изоляцию `$HOME` и прямо перечисляет, что реально
  пишется за пределами копии репозитория: сессия создаёт транскрипт
  `~/.claude/projects/<cwd-копии-с-заменёнными-слэшами>/*.jsonl` (путь
  зависит от пути копии, см. `skills/pf-close/SKILL.md` Phase 6) и может
  обновить список недавних проектов Claude Code. Она НЕ трогает
  `~/.claude/skills/`, `~/.claude/bin/pf` и транскрипты других проектов —
  единственное, что реально мутируется вне копии репозитория, это
  project-scoped транскрипт этой самой копии, безвредный и специфичный для
  временного пути. Шаг 6 ниже проверяет ровно то, что действительно
  критично для безопасности прогона — состояние РЕАЛЬНОГО репозитория, а не
  состояние `~/.claude/`.
- Оба TC — Manual, изолированная одноразовая копия репозитория, НЕ
  `<repo-root>` (`test_plan.md`, «Manual-кейсы»). Обязательная
  последовательность для каждого:
  1. Снять копию репозитория в новую временную директорию вне
     `<repo-root>` (например `mktemp -d` + `cp -a`, включая `.git`) — тем
     же приёмом, что `pf_repo_copy` использует для Auto-кейсов, но
     выполняется здесь вручную (эти два TC — не Auto-скрипт, а протокол
     для человека/агента, запускающего Claude Code).
  2. **Первым действием внутри копии** — `git remote remove origin`, затем
     `git remote -v` и убедиться, что вывод пуст. Это обязано случиться
     раньше любого другого шага, а не сноской в конце: иначе Phase 8.5
     («safe auto-push») в /pf-close теоретически может запушить в реальный
     remote.
  3. Удалить из копии все реальные issue под `docs/issues/`, оставить
     только фикстур-issue из «Files» выше, на ветке `issue/<fixture-ID>`.
  4. Открыть Claude Code сессию с рабочей директорией = корень изолированной
     копии (не реального репозитория) и выполнить `/pf-close`.
  5. Проверить `docs/planning/test-plan.md` внутри копии и состав коммита
     `close: archive <fixture-ID>` (`git show --stat`).
  6. Последним шагом — в РЕАЛЬНОМ репозитории (`<repo-root>`) выполнить
     `git status --porcelain` и сравнить с состоянием непосредственно перед
     шагом 1: вывод обязан быть идентичен.
- **TC-014** (реальное закрытие): фикстура `issue-real-close` — свежая
  issue с одним Manual и одним Auto кейсом; ожидание — ровно одна новая
  строка на Manual-кейс, ни одной на Auto-кейс, файл входит в коммит
  закрытия, отчёт Phase 9 называет push «skipped — no remote configured».
- **TC-016** (восстановление после сбоя): фикстура `issue-partial-promotion`
  моделирует сбой ровно после первой строки — папка issue ещё в
  `docs/issues/open/` (Phase 5 не выполнялась), `docs/planning/test-plan.md`
  уже содержит одну строку с новым `PTC`, а строка-счётчик всё ещё на
  значении ДО этого промоушена (точные значения — см. «Files» выше, P2
  ревью: без этого уточнения фикстуру можно было бы по ошибке собрать так,
  что счётчик уже согласован с таблицей, и тест перестал бы отличаться от
  штатного случая). Повторный `/pf-close` обязан найти issue (не «No active
  issue found»), дописать вторую строку без дублей, обновить
  `Last allocated:` до нового максимума, и штатно завершить закрытие.
- Эти два TC не привязаны к моменту закрытия ЭТОЙ issue
  (`20260806-feat-product-test-plan`) — в отличие от исторического паттерна
  «TC подтверждается при закрытии самой issue» (см. `implementation_plan.md`
  issue `20260729-bug-pf-close-parent-branch-and-usage-window`, Task 6),
  они используют собственные одноразовые фикстур-issue и должны быть
  прогнаны как отдельный ручной прогон до/вне закрытия текущей issue —
  реальное закрытие `20260806-feat-product-test-plan` само по себе не
  Manual-кейс этой issue (в её `Status Tracker` нет ручных TC про
  собственное закрытие).

**Acceptance Criteria:**
- [x] TC-014 passes (confirmed manually per the isolated-copy protocol above)
- [x] TC-016 passes (confirmed manually per the isolated-copy protocol above)

---

### Dependencies

- **Task 1 блокирует задачи 2–8 технически, не только по порядку
  нумерации.** Все drift-guard'ы группы A (Task 2, 3, 5) грепают текст, который
  Task 1 пишет в `skills/pf-close/SKILL.md` — без него они красные по
  отсутствующей фиче, а не по дефекту теста. TC-011/TC-012 (Task 6) читают
  шаблон и правку `t5_global_docs()`, которых до Task 1 не существует.
  Ни одна из задач 2–8 не может быть запущена параллельно с Task 1 или до
  него.
- **Задачи 2–8 пишут ОДИН И ТОТ ЖЕ файл `test/pf-product-test-plan.sh`
  последовательно — это ОБЯЗАНО быть видно `/pf-execute`'у на уровне
  графа задач, не только в этом абзаце прозы (P2 ревью).** `/pf-execute`
  группирует задачи в волны по зависимостям и параллелит `write: claude`
  задачи внутри одной волны (`skills/pf-execute/SKILL.md`, Phase 2,
  «Execution Strategy» пункты 1 и 3) — семь сабагентов, дописывающих один и
  тот же файл в параллельной волне, дают гонку записи независимо от того,
  что логика каждого куска самодостаточна. Поэтому при `TaskCreate` каждая
  из задач 2–8 ОБЯЗАНА нести `blocked_by`, указывающий на непосредственно
  предыдущую задачу этого списка (Task 3 → `blocked_by: [Task 2]`, Task 4 →
  `[Task 3]`, и так далее по каждому явному «**Blocked By:**» под
  заголовком каждой задачи выше) — это гарантирует семь последовательных
  волн по одной задаче, а не полагается на то, что читающий план агент сам
  заметит правило в тексте. Технической зависимости по логике между
  большинством задач нет (TC-004/005/006 не нуждаются в TC-001/002/003, и
  т.д.), но каждая вставляет свои TC-секции в конец уже существующего файла,
  перед хвостовым блоком `assert_repo_untouched`/`pf_summary` (см. Task 2's
  Implementation Notes) — сериализация нужна из-за общего файла, а не из-за
  логики.
- **Task 4 (валидатор формы) технически предшествует Task 5's TC-009 (шаг 2)
  и Task 7's TC-018/TC-019 — это структурная зависимость, а не вопрос
  читаемости плана (P0 ревью).** Все три места вызывают функцию
  `pf_validate_test_plan_file`, которую определяет Task 4. Suite-файл растёт
  добавлением секций в конец и исполняется целиком построчно одним прогоном
  интерпретатора (`Makefile:39`: `bash "$$t"`) — вызов функции, чьё
  определение стоит в файле НИЖЕ точки вызова, либо падает с «command not
  found», либо (если реализация вставит временную заглушку, чтобы формально
  пройти написание кода) делает `TC-009 passes` недостоверным. Порядок задач
  2 → 3 → 4 → 5 → 6 → 7 → 8 в этой редакции плана — не просто нумерация для
  читаемости (как было в предыдущей редакции, где валидатор шёл под номером
  5, ПОСЛЕ первого своего вызова в Task 4): Task 4 теперь физически идёт
  раньше всех трёх мест, которые её вызывают, и таблица `Blocked By` под
  каждой задачей выше делает эту зависимость явной для `TaskCreate`.
- **Task 8 (Manual) не зависит от Task 2–7 по коду** — она не трогает
  `test/pf-product-test-plan.sh` и использует только `skills/pf-close/
  SKILL.md` из Task 1 (`Blocked By: Task 1`, см. заголовок задачи). Может
  выполняться сразу после Task 1, в т.ч. параллельно с волнами 2–7; оставлена
  последней в списке задач, потому что она самая дорогая по времени (два
  полных ручных прогона `/pf-close`) и разумнее подтверждать текст Phase 4.5
  автотестами (Task 2–7) до того, как тратить время на ручной прогон против
  него — это выбор порядка изложения и исполнения, а не блокировка по коду.
- **Task 1 намеренно остаётся единой задачей, а не делится на «шаблон +
  Phase 4.5 + Phase 8/Phase 1 правка» и «`t5_global_docs()`» (P2 ревью).**
  Обе половины — крошечные правки (несколько строк каждая) одной и той же
  продуктовой фичи, и первый пункт этого раздела уже фиксирует, что ни одна
  из задач 2–8 не может стартовать параллельно с Task 1 или до него — то
  есть разбиение Task 1 не открыло бы дополнительный параллелизм (Task 8
  всё равно ждёт весь Task 1 целиком, включая `t5_global_docs()`, прежде чем
  TC-011/TC-012 в Task 6 смогут её прочитать). Task 1 остаётся единственной
  точкой отказа для всего плана сознательно: делить её означало бы
  координационные накладные расходы без выигрыша в скорости.
- **Внешние зависимости:** нет — фича не трогает `~/.claude/skills/`
  напрямую (изменения в `skills/pf-close/SKILL.md` этого репозитория
  распространяются в целевые проекты штатным `make update-skills`/
  `/pf-update`, вне объёма этой issue). `make test` подхватывает
  `test/pf-product-test-plan.sh` автоматически — `Makefile` менять не
  нужно (`specs.md`, «Files to Create/Modify»).

### Complexity Estimate

**Complex (6+ tasks).** Восемь задач: одна продуктовая (шаблон + новая фаза
скилла + правка конвергенции), шесть автотестовых (по кластерам из 17
Auto-кейсов test_plan.md, каждая — отдельные фикстуры и секция общего
suite-файла) и одна ручная (два сквозных прогона `/pf-close` в изолированной
копии). Оценка отражает то, что тест-план описывает 19 кейсов с
detailированными Preconditions/Steps и явно требует создавать фикстуры под
15 новых путей `test/fixtures/pf-product-test-plan/...` — не искусственно
раздута ради числа задач.

### TC coverage map

| TC | Task |
|---|---|
| TC-001 | Task 2 |
| TC-002 | Task 2 |
| TC-003 | Task 2 |
| TC-004 | Task 3 |
| TC-005 | Task 3 |
| TC-006 | Task 3 |
| TC-007 | Task 4 |
| TC-008 | Task 4 |
| TC-009 | Task 5 |
| TC-010 | Task 5 |
| TC-011 | Task 6 |
| TC-012 | Task 6 |
| TC-013 | Task 2 |
| TC-014 | Task 8 |
| TC-015 | Task 5 |
| TC-016 | Task 8 |
| TC-017 | Task 5 |
| TC-018 | Task 7 |
| TC-019 | Task 7 |
