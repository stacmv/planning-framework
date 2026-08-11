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
  docs/planning/session-log.md`) путём `docs/planning/test-plan.md`
- `scripts/converge-to-v3.sh` - `t5_global_docs()` (сейчас перечисляет
  `session-log.md decisions.md implementation-plan.md`): добавить
  `test-plan.md` в перечисляемый список файлов

**Implementation Notes:**
- Основа текста Phase 4.5 — раздел `specs.md` «Stage: `/pf-close` — Phase
  4.5, перенос» почти дословно: он уже написан с прицелом на будущие
  drift-guard-greps (в духе `Self-tracking upstream guard` в Phase 3 —
  см. `test/pf-close.sh` TC-005) и переносить его свободным пересказом —
  верный способ незаметно потерять формулировку, по которой Task 2–4 ищут
  правило. Перенести обязаны все перечисленные ниже пункты — Task 2–4
  проверяют присутствие каждого через grep:
  1. отбор строк Status Tracker закрываемой issue по `Type: Manual`, Auto
     игнорируется целиком;
  2. таблица нормализации `Priority` → `Prio`: `Critical→Critical,
     High→High, Medium→Med, Low→Low`; значение вне словаря → `Med` +
     примечание в `Test case`;
  3. отображение статуса: `[ ]`→`pending`, `✓`→`✓`, `✗`→`✗`; `Last run` —
     `—` для `pending`, дата закрытия issue для `✓`/`✗`;
  4. правило выделения номера: следующий `PTC` = максимум из числа в строке
     `Last allocated:` и наибольшего `PTC` в таблице, плюс один; обновление
     строки `Last allocated:` после переноса;
  5. экранирование `|` → `\|` в `Area`/`Test case`/`Origin` при записи;
  6. вычисление `Area`: `git diff --name-only <parent>...<issue-branch>`,
     исключить пути под `docs/issues/`, для `skills/`/`tools/` взять второй
     сегмент пути, для остальных — первый, побеждает сегмент с наибольшим
     числом файлов, при пустом остатке — `general`; база — до мерджа (ветка
     issue ещё жива на Phase 4.5);
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
  отличающейся пунктуацией, которая помешала бы Task 4's grep на «фазы 4,
  4.5, 5 в этом порядке по номерам строк», TC-013 step 1).
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
- [ ] `docs/planning/templates/global/test-plan.md` существует, содержит
  `Last allocated: none` и таблицу без строк данных
- [ ] `skills/pf-close/SKILL.md` содержит `## Phase 4.5` между `## Phase 4`
  и `## Phase 5`
- [ ] `git add` в Phase 8 включает `docs/planning/test-plan.md`
- [ ] `t5_global_docs()` в `scripts/converge-to-v3.sh` перечисляет
  `test-plan.md`

---

#### Task 2: Каркас suite + отбор/нормализация/статус/порядок фаз (TC-001, TC-002, TC-003, TC-013)

**Task Type:** tests
**Mapped Test Cases:** TC-001, TC-002, TC-003, TC-013

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
- [ ] TC-001 passes
- [ ] TC-002 passes
- [ ] TC-003 passes
- [ ] TC-013 passes

---

#### Task 3: Выделение номера — три сценария (TC-004, TC-005, TC-006)

**Task Type:** tests
**Mapped Test Cases:** TC-004, TC-005, TC-006

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
- [ ] TC-004 passes
- [ ] TC-005 passes
- [ ] TC-006 passes

---

#### Task 4: Экранирование, Area, идемпотентность, самодостаточность (TC-009, TC-010, TC-015, TC-017)

**Task Type:** tests
**Mapped Test Cases:** TC-009, TC-010, TC-015, TC-017

**Files:**
- `test/pf-product-test-plan.sh` - расширить: TC-009, TC-010, TC-015,
  TC-017 и их helper'ы
- `test/fixtures/pf-product-test-plan/issue-pipe-in-fields/docs/issues/open/20990101-feat-fixture-pipes/test_plan.md`
  - новая: один `Type: Manual` кейс, чьё название содержит `|` (например
  `Проверить экспорт: CSV | JSON | PDF`)
- `test/fixtures/pf-product-test-plan/area-diff-repo/` - новая: минимальная
  база под `pf_setup_case --git` (один файл-плейсхолдер достаточно; ветки
  `develop`/`issue/<ID>` и правки файлов `skills/pf-close/SKILL.md`,
  `skills/pf-close/foo.md`, `scripts/converge-to-v3.sh`,
  `docs/issues/open/<ID>/specs.md` создаются самим тестом поверх базы, не
  фикстурой — см. `test_plan.md` TC-010 «Требуемые данные»)
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
  прогнать сам `test/pf-product-test-plan.sh` (валидатор формы строк, уже
  существует с Task 5) на результирующем файле — строка должна остаться
  одной корректной строкой из 7 полей. Drift-guard ищет правило
  экранирования `\|` в `Area`/`Test case`/`Origin` (Task 1, пункт 5).
- **TC-010** (Area по diff): построить `pf_setup_case area-diff-repo --git`,
  создать ветку `develop`, ветку `issue/<ID>`, внести туда 4 файла из
  фикстуры-описания выше, вычислить `git diff --name-only
  develop...issue/<ID>`, исключить `docs/issues/`, применить сегментацию
  (второй сегмент для `skills/`/`tools/`, первый — для остальных),
  проверить победу `pf-close` (2 файла) над `scripts` (1 файл). Drift-guard
  ищет команду `git diff --name-only`, исключение `docs/issues/`, правило
  сегментации и победу большинства (Task 1, пункт 6).
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
- Эта задача зависит от `test/pf-product-test-plan.sh` формы валидации
  строк — если Task 5 (валидатор) выполняется позже по номеру, TC-009's шаг
  2 («запустить валидатор на результирующем файле») временно обращается к
  функции-заглушке; см. Dependencies — реальный порядок исполнения задач
  учитывает это, Task 5 не обязан предшествовать технически (валидатор —
  чистая функция формы, не требующая контекста Task 4), но приложение
  рекомендует не запускать их с разрывом в разные волны без причины.

**Acceptance Criteria:**
- [ ] TC-009 passes
- [ ] TC-010 passes
- [ ] TC-015 passes
- [ ] TC-017 passes

---

#### Task 5: Валидатор формы — дубликат PTC и закрытые словари (TC-007, TC-008)

**Task Type:** tests
**Mapped Test Cases:** TC-007, TC-008

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
- Группа B (`test_plan.md`): красный сегодня означает «инфраструктуры нет»,
  а не «правило неверно» — TC-007 step 1 и TC-008 step 1 сначала явно
  проверяют существование и исполняемость `test/pf-product-test-plan.sh`
  (`[ -x test/pf-product-test-plan.sh ]`) с отдельным диагностическим
  сообщением, и только потом переходят к поведению; это разводит «скрипта
  нет» и «скрипт есть, но не ловит дефект» на разные сообщения, как того
  требует `test_plan.md`.
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
- Эта задача даёт остальным (Task 4's TC-009, Task 6, Task 7) готовую
  функцию валидатора — технически она нужна раньше по содержанию, но
  реального блокера по коду нет: функция самодостаточна и не зависит от
  TC-001..006/009/010/015/017. Расположена под номером 5 для читаемости
  плана (drift-guard-кейсы группы A собраны рядом, кейсы группы B — рядом).

**Acceptance Criteria:**
- [ ] TC-007 passes
- [ ] TC-008 passes

---

#### Task 6: Поведение `converge` — создание и не-перезапись (TC-011, TC-012)

**Task Type:** tests
**Mapped Test Cases:** TC-011, TC-012

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
- [ ] TC-011 passes
- [ ] TC-012 passes

---

#### Task 7: Ручная правка и retired-строка переживают формат (TC-018, TC-019)

**Task Type:** tests
**Mapped Test Cases:** TC-018, TC-019

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
  существование валидатора (Task 5), иначе отдельное сообщение; step 2 —
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
- [ ] TC-018 passes
- [ ] TC-019 passes

---

#### Task 8: Manual — реальное закрытие и восстановление после сбоя (TC-014, TC-016)

**Task Type:** tests
**Mapped Test Cases:** TC-014, TC-016

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
  - новая: уже содержит ОДНУ (не обе) строку промоушена этой issue — состояние
  «сбой сразу после первой записанной строки, до второй и до обновления
  `Last allocated:`»

**Implementation Notes:**
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
  уже содержит одну строку. Повторный `/pf-close` обязан найти issue (не
  «No active issue found»), дописать вторую строку без дублей, обновить
  `Last allocated:`, и штатно завершить закрытие.
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
- [ ] TC-014 passes (confirmed manually per the isolated-copy protocol above)
- [ ] TC-016 passes (confirmed manually per the isolated-copy protocol above)

---

### Dependencies

- **Task 1 блокирует задачи 2–8 технически, не только по порядку
  нумерации.** Все drift-guard'ы группы A (Task 2–4) грепают текст, который
  Task 1 пишет в `skills/pf-close/SKILL.md` — без него они красные по
  отсутствующей фиче, а не по дефекту теста. TC-011/TC-012 (Task 6) читают
  шаблон и правку `t5_global_docs()`, которых до Task 1 не существует.
  Ни одна из задач 2–8 не может быть запущена параллельно с Task 1 или до
  него.
- **Задачи 2–8 пишут ОДИН И ТОТ ЖЕ файл `test/pf-product-test-plan.sh`
  последовательно.** Технической зависимости по логике между большинством
  из них нет (TC-004/005/006 не нуждаются в TC-001/002/003, и т.д.), но
  каждая вставляет свои TC-секции в конец уже существующего файла, перед
  хвостовым блоком `assert_repo_untouched`/`pf_summary` (см. Task 2's
  Implementation Notes). Выполнять их нужно строго по возрастанию номера
  задачи в одной последовательности волн `/pf-execute`, а не параллельно —
  иначе два сабагента, пишущие в конец одного файла одновременно, дают
  конфликт слияния независимо от того, что логика каждого куска
  самодостаточна.
- **Task 5 (валидатор формы) логически предшествует TC-009 (Task 4, шаг 2)
  и TC-018/TC-019 (Task 7)** — все три вызывают функцию
  `pf_validate_test_plan_file`, которую Task 5 определяет. Формально это не
  блокирует компиляцию (Task 4 может быть выполнена раньше при условии, что
  вызов валидатора в TC-009 шаг 2 временно ссылается на функцию, которая
  появится в Task 5), но линейный порядок 2 → 3 → 4 → 5 → 6 → 7 → 8,
  предписанный выше пунктом про общий файл, уже гарантирует, что Task 5
  выполняется до Task 7 — оставлять TC-009's зависимость от Task 5 нужно
  просто держать в уме, если порядок когда-либо пересматривается.
- **Task 8 (Manual) не зависит от Task 2–7 по коду** — она не трогает
  `test/pf-product-test-plan.sh` и использует только `skills/pf-close/
  SKILL.md` из Task 1. Формально может выполняться сразу после Task 1;
  оставлена последней в плане, потому что она самая дорогая по времени
  (два полных ручных прогона `/pf-close`) и разумнее подтверждать текст
  Phase 4.5 автотестами (Task 2–7) до того, как тратить время на ручной
  прогон против него.
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
| TC-007 | Task 5 |
| TC-008 | Task 5 |
| TC-009 | Task 4 |
| TC-010 | Task 4 |
| TC-011 | Task 6 |
| TC-012 | Task 6 |
| TC-013 | Task 2 |
| TC-014 | Task 8 |
| TC-015 | Task 4 |
| TC-016 | Task 8 |
| TC-017 | Task 4 |
| TC-018 | Task 7 |
| TC-019 | Task 7 |
