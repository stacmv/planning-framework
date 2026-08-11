# Test Plan: Глобальный чек-лист ручных тестов
**Date:** 2026-08-11

## Overview

Фича не имеет нового UI. Три источника поведения:

- `docs/planning/templates/global/test-plan.md` — новый шаблон, статический файл;
- `skills/pf-close/SKILL.md` — новая Phase 4.5, текст, интерпретируемый
  LLM-агентом во время реального `/pf-close`;
- `scripts/converge-to-v3.sh` (`t5_global_docs()`) и `test/pf-product-test-plan.sh` —
  обычные bash-скрипты, детерминированные и исполняемые напрямую.

Отсюда два рода проверок:

- **Auto** — где поведение детерминировано (алгоритм отбора Manual-строк,
  нормализация `Priority`, отображение статусов, выделение номера,
  экранирование `|`, деривация `Area`, форма строк) и его можно
  транскрибировать в bash-функцию и прогнать на фикстуре — тем же приёмом,
  что уже использует `test/pf-close.sh` для Phase 3/Phase 6 `/pf-close`
  (хардкод алгоритма + drift-guard grep-проверкой текста skill-файла), — а
  также где поведение исполняет сам `converge-to-v3.sh`/`pf-product-test-plan.sh`
  напрямую;
- **Manual** — где утверждение проверяемо только реальным прогоном `/pf-close`
  живой Claude Code сессией: собственно факт переноса и попадание файла в
  коммит закрытия, идемпотентность повторного прогона, восстановление после
  сбоя посреди фазы.

Цель прогона — подтвердить приёмку из `brd.md`: невыполненный ручной кейс не
исчезает при закрытии issue, а виден в `docs/planning/test-plan.md` с
номером, приоритетом и ссылкой на источник (AC-1.1–AC-3.3, BR-1–BR-4).

## Prerequisites

- Реализация по `specs.md` завершена: `docs/planning/templates/global/test-plan.md`
  существует; `skills/pf-close/SKILL.md` содержит Phase 4.5;
  `scripts/converge-to-v3.sh` создаёт файл при отсутствии; `test/pf-product-test-plan.sh`
  существует и подключён к `test:`.
- Фикстуры под `test/fixtures/pf-product-test-plan/` созданы (перечислены по
  TC ниже); `test/lib.sh` доступен как гарантирующий S-1..S-5 харнесс.
- Для Manual-кейсов: рабочее дерево чистое, тестировщик может прогонять
  `/pf-close` в реальной Claude Code сессии на фикстур-issue под
  `docs/issues/open/zz-fixture-*/` — они не являются реальными issue проекта и
  удаляются сразу после соответствующего TC.

## Test Cases

### TC-001: Только Manual-кейсы переносятся в глобальный список (BR-1)

**Description:** Проверяет, что промоушен Phase 4.5 отбирает из Status Tracker закрываемой issue только строки с `Type: Manual` и полностью игнорирует строки с `Type: Auto` — ни сама строка, ни любые её поля не попадают в `docs/planning/test-plan.md`.

**Preconditions:**
- Собрана bash-функция, транскрибирующая алгоритм отбора из `specs.md` («Stage: /pf-close — Phase 4.5», шаг 1), тем же приёмом, что `test/pf-close.sh` использует для Phase 3/Phase 6.
- Фикстура issue, чей Status Tracker содержит минимум одну строку `Type: Auto` и минимум две строки `Type: Manual`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить транскрибированный отбор на фикстуре | В выборке присутствуют обе строки `Type: Manual`, строка `Type: Auto` отсутствует |
| 2 | Сравнить число отобранных строк с числом строк `Type: Manual` в фикстуре | Числа совпадают |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/issue-mixed-types/docs/issues/open/20990101-feat-fixture-mixed/test_plan.md`

**Expected Outcome:** В выборке для промоушена присутствуют только строки `Type: Manual`; ни один Auto-TC не порождает строку в глобальном файле.

**Priority:** Critical

### TC-002: Нормализация Priority Medium → Med

**Description:** Проверяет отображение `Priority` кейса issue в `Prio` глобального списка, включая единственный неоднозначный случай словаря: `Medium` → `Med`.

**Preconditions:**
- Фикстура `test_plan.md` содержит по одной Manual-строке для каждого из четырёх значений `Priority`: `Critical`, `High`, `Medium`, `Low`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Прогнать нормализацию на строках `Critical`/`High`/`Medium`/`Low` | Получено `Critical`/`High`/`Med`/`Low` соответственно |
| 2 | Прогнать нормализацию на строке с нестандартным значением (например, `Urgent`) | Значение переносится как `Med`, `Test case` дополняется примечанием об исходном нестандартном значении |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/issue-mixed-types/docs/issues/open/20990101-feat-fixture-mixed/test_plan.md`

**Expected Outcome:** Все четыре табличных значения совпадают со словарём `specs.md`; значение вне словаря не роняет перенос и помечается примечанием.

**Priority:** High

### TC-003: Отображение статусов issue-кейса в статус глобального списка

**Description:** Проверяет отображение колонки `Status` Status Tracker issue (`[ ]`/`✓`/`✗`) в колонку `Status` глобального списка (`pending`/`✓`/`✗`), а также заполнение `Last run`.

**Preconditions:**
- Фикстура содержит по одной Manual-строке для каждого из трёх значений статуса issue: `[ ]`, `✓`, `✗`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Прогнать отображение на строке со статусом `[ ]` | Результат — `pending` |
| 2 | Прогнать отображение на строке со статусом `✓` | Результат — `✓` |
| 3 | Прогнать отображение на строке со статусом `✗` | Результат — `✗` |
| 4 | Проверить колонку `Last run` для всех трёх строк | У `pending` — `—`; у `✓`/`✗` — дата закрытия issue |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/issue-mixed-types/docs/issues/open/20990101-feat-fixture-mixed/test_plan.md`

**Expected Outcome:** Три исходные формы статуса дают ровно три ожидаемых значения в глобальном списке; словарь не расширяется самодельными значениями.

**Priority:** Critical

### TC-004: Выделение номера в отсутствующем/пустом файле

**Description:** Проверяет выдачу первого номера `PTC-0001`, когда глобальный список ещё не существовал или существует в стартовом состоянии шаблона (`Last allocated: none`, пустая таблица).

**Preconditions:**
- Файл `docs/planning/test-plan.md` — свежая копия шаблона: строка `Last allocated: none`, таблица без строк.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Прогнать выделение номера на пустой таблице | Выдан `PTC-0001` |
| 2 | Прогнать перенос одного Manual-кейса поверх этого состояния | Новая строка получает `PTC-0001`; `Last allocated:` обновлена до `PTC-0001` |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/global-fresh/docs/planning/test-plan.md`

**Expected Outcome:** Первый перенос в новый или пустой файл всегда получает `PTC-0001`.

**Priority:** High

### TC-005: Выделение номера после ручного удаления retired-строки (счётчик побеждает)

**Description:** Проверяет, что удалённая руками строка не приводит к повторной выдаче её номера — при расхождении побеждает бо́льшая из двух величин, здесь это строка `Last allocated:`, а не максимум по самой таблице.

**Preconditions:**
- Файл со строкой `Last allocated: PTC-0007`, при этом наибольший `PTC` в самой таблице — `PTC-0005` (строки `PTC-0006` и `PTC-0007` удалены руками).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Прогнать выделение номера на этом файле | Выдан `PTC-0008` (max(0007, 0005) + 1), не `PTC-0006` |
| 2 | Прогнать перенос одного нового Manual-кейса | Новая строка получает `PTC-0008`; номера `0006` и `0007` нигде не появляются повторно |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/global-after-retired-deleted/docs/planning/test-plan.md`

**Expected Outcome:** Удалённая руками строка не размораживает свой номер для повторного использования (BR-2).

**Priority:** Critical

### TC-006: Выделение номера при отставшем счётчике (таблица побеждает)

**Description:** Проверяет самовосстановление после частичной записи: строки в таблице уже добавлены, а строка-счётчик ещё не обновлена — побеждает максимум по таблице.

**Preconditions:**
- Файл со строкой `Last allocated: PTC-0003`, при этом в таблице уже есть строки вплоть до `PTC-0005` (перенос успел записать строки, но упал до обновления счётчика).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Прогнать выделение номера на этом файле | Выдан `PTC-0006` (max(0003, 0005) + 1), не `PTC-0004` |
| 2 | Прогнать перенос одного нового Manual-кейса | Новая строка получает `PTC-0006`; строка `Last allocated:` обновлена до `PTC-0006` |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/global-stale-counter/docs/planning/test-plan.md`

**Expected Outcome:** Расхождение счётчика и таблицы после сбоя не приводит к повторной выдаче уже записанных номеров.

**Priority:** Critical

### TC-007: Дубликат PTC между параллельными ветками обнаруживается, а не предотвращается

**Description:** Проверяет, что `test/pf-product-test-plan.sh` завершается ненулевым кодом и называет конкретный номер, когда две строки глобального файла совпадают по `PTC` — ровно сценарий двух параллельных веток из `specs.md`. Механизм — обнаружение постфактум на `make test`, а не блокировка на уровне записи файла.

**Preconditions:**
- Файл `docs/planning/test-plan.md` содержит две разные строки с одинаковым `PTC-0012` (сымитирован результат молчаливого мерджа двух веток).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `test/pf-product-test-plan.sh` на этом файле | Скрипт завершается ненулевым кодом |
| 2 | Проверить вывод скрипта | В выводе назван конкретный дублирующийся номер `PTC-0012` |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/global-duplicate-ptc/docs/planning/test-plan.md`

**Expected Outcome:** Дубликат ловится первым же `make test` после мерджа; сам факт дубликата в файле не был бы отклонён на этапе записи — уникальность не предотвращается, а обнаруживается.

**Priority:** Critical

### TC-008: Форма строк и закрытые словари Prio/Status

**Description:** Проверяет, что `test/pf-product-test-plan.sh` валидирует форму каждой строки: `PTC-NNNN` (4 цифры), `Prio` ∈ {`Critical`, `High`, `Med`, `Low`}, `Status` ∈ {`pending`, `✓`, `✗`, `retired`}, и наличие строки `Last allocated:` над таблицей.

**Preconditions:**
- Четыре варианта файла `docs/planning/test-plan.md`, каждый с одним нарушением: `Prio: Medium` (не входит в словарь списка), `Status: Passed` (самодельное значение), `PTC-12` (не 4 цифры), файл без строки `Last allocated:`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить скрипт на файле со строкой `Prio: Medium` | Скрипт падает, называя строку и поле `Prio` |
| 2 | Запустить на файле со строкой `Status: Passed` | Скрипт падает, называя строку и поле `Status` |
| 3 | Запустить на файле со строкой `PTC-12` | Скрипт падает, называя некорректную форму номера |
| 4 | Запустить на файле без строки `Last allocated:` | Скрипт падает, называя отсутствие строки-счётчика |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/global-malformed-rows/docs/planning/test-plan.md`

**Expected Outcome:** Ни одно самодельное написание `Prio`/`Status`/`PTC` не проходит незамеченным; закрытые словари не расползаются.

**Priority:** High

### TC-009: Экранирование `|` в Area/Test case/Origin переживает запись и парсинг

**Description:** Проверяет, что символ `|` внутри значений `Area`, `Test case` и `Origin` экранируется как `` \| `` при переносе и что результирующая таблица по-прежнему корректно разбирается на столбцы.

**Preconditions:**
- Issue-кейс, чьё название содержит `|` (например: `Проверить экспорт: CSV \| JSON \| PDF`).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Перенести кейс с `|` в названии в глобальный список | Символ записан как `` \| ``, число полей строки не изменилось |
| 2 | Запустить `test/pf-product-test-plan.sh` на результирующем файле | Строка распознана как одна корректная строка с 7 полями, а не развалилась на лишние столбцы |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/issue-pipe-in-fields/docs/issues/open/20990101-feat-fixture-pipes/test_plan.md`

**Expected Outcome:** `|` в текстовых полях не ломает markdown-таблицу ни при записи, ни при последующем чтении (BR-4).

**Priority:** Medium

### TC-010: Area определяется по diff между родительской и issue-веткой, docs/issues/ исключён

**Description:** Проверяет вычисление `Area` по правилу из `specs.md`: `git diff --name-only <parent>...<issue-branch>`, из результата исключается `docs/issues/`, для `skills/`/`tools/` берётся второй сегмент пути, для остальных — первый, побеждает подсистема с наибольшим числом файлов.

**Preconditions:**
- Свежий git-репозиторий из фикстуры (`pf_setup_case --git`) с веткой `develop` и веткой `issue/<ID>`, отличающейся от `develop` файлами: `skills/pf-close/SKILL.md`, `skills/pf-close/foo.md`, `scripts/converge-to-v3.sh`, `docs/issues/open/<ID>/specs.md`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Вычислить diff между `develop` и `issue/<ID>` | Список из 4 файлов, включая путь под `docs/issues/` |
| 2 | Исключить пути `docs/issues/` | Остаются 3 файла |
| 3 | Применить сегментацию и подсчёт большинства | `pf-close` (2 файла по второму сегменту `skills/pf-close/...`) побеждает `scripts` (1 файл по первому сегменту) |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/area-diff-repo/` (базовая фикстура для `pf_setup_case --git`; ветки и файлы правки создаются шагами теста)

**Expected Outcome:** `Area` = `pf-close`; документы самой issue не участвуют в подсчёте.

**Priority:** Medium

### TC-011: converge создаёт docs/planning/test-plan.md из шаблона, если файла нет

**Description:** Проверяет, что `t5_global_docs()` в `scripts/converge-to-v3.sh` копирует `docs/planning/templates/global/test-plan.md` в `docs/planning/test-plan.md`, когда целевой файл отсутствует — тем же путём, что уже покрыт для `session-log.md`/`decisions.md`/`implementation-plan.md`.

**Preconditions:**
- Фикстура `v3-incomplete` — `docs/planning/test-plan.md` в ней отсутствует.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `pf_run_converge` на фикстуре `v3-incomplete` | Прогон завершается успешно |
| 2 | Проверить `docs/planning/test-plan.md` в целевой директории | Файл создан и совпадает по содержимому с `docs/planning/templates/global/test-plan.md` |

**Требуемые данные:**
- `test/fixtures/v3-incomplete/`

**Expected Outcome:** Первая же конвергенция проекта без файла создаёт его из шаблона.

**Priority:** High

### TC-012: converge никогда не перезаписывает существующий docs/planning/test-plan.md

**Description:** Проверяет, что пользовательское содержимое файла не теряется при повторной конвергенции — файл трактуется как пользовательский документ, как и три существующих глобальных файла.

**Preconditions:**
- Фикстура-копия `v3-incomplete`, дополненная `docs/planning/test-plan.md` с заведомо нешаблонным содержимым (посторонней строкой-меткой, отличной от шаблона).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `pf_run_converge` на этой фикстуре | Прогон завершается успешно |
| 2 | Сравнить содержимое `docs/planning/test-plan.md` до и после прогона | Содержимое побайтово не изменилось |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/v3-with-existing-test-plan/docs/planning/test-plan.md`

**Expected Outcome:** `t5_global_docs()` не трогает файл, если он уже существует.

**Priority:** High

### TC-013: Порядок фаз /pf-close и состав коммита закрытия (drift-guard)

**Description:** Статическая проверка (в духе `test/pf-close.sh` TC-005): `skills/pf-close/SKILL.md` документирует Phase 4.5 между Phase 4 (Merge) и Phase 5 (Archive Issue Folder), а команда `git add` на Phase 8 включает путь `docs/planning/test-plan.md`.

**Preconditions:**
- Нет — статическая проверка текста файла.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Найти в файле заголовки фаз 4, 4.5 и 5 | Заголовки идут в этом порядке по номерам строк |
| 2 | Найти команду `git add` в разделе Phase 8 | Команда включает `docs/planning/test-plan.md` наряду с `docs/issues/` и `docs/planning/session-log.md` |

**Требуемые данные:**
- `D:/dev/planning-framework/skills/pf-close/SKILL.md`

**Expected Outcome:** Перенос выполняется, пока папка issue ещё в `docs/issues/open/` (до архивации), и файл списка гарантированно уезжает в коммит закрытия.

**Priority:** Critical

### TC-014: Реальное закрытие issue переносит ручные кейсы и коммитит файл

**Description:** Сквозная проверка живой Claude Code сессией: закрытие issue с Manual- и Auto-кейсами действительно создаёт строки в `docs/planning/test-plan.md`, и файл действительно входит в коммит `close: archive ISSUE-ID`.

**Preconditions:**
- Фикстур-issue с `test_plan.md`, содержащим минимум один `Type: Manual` и один `Type: Auto` кейс, оформлена как ветка `issue/<ID>` и готова к `/pf-close` (QA-отчёт с `**PASS**` на месте, Phase 0 не блокирует).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-close` на фикстур-issue | Закрытие проходит без ошибок |
| 2 | Открыть `docs/planning/test-plan.md` после закрытия | Появилась ровно одна новая строка на каждый `Type: Manual` кейс; строк на Auto-кейс нет |
| 3 | Проверить состав коммита `close: archive <ID>` | В списке изменённых файлов присутствует `docs/planning/test-plan.md` |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/issue-real-close/`

**Expected Outcome:** После реального закрытия ручной кейс виден в общем списке с номером, приоритетом и ссылкой на источник — без открытия закрытой issue (AC-1.1, AC-2.1, AC-2.3).

**Priority:** Critical

### TC-015: Идемпотентность повторного запуска Phase 4.5 при одинаковых названиях кейсов

**Description:** Проверяет, что повторный прогон промоушена не создаёт дублей и не жжёт номера впустую, и что ключом является пара `ISSUE-ID` + `TC-NNN`, а не текст названия — два Manual-кейса одной issue с одинаковым названием должны получить два разных `PTC`.

**Preconditions:**
- Фикстур-issue, чей `test_plan.md` содержит два `Type: Manual` кейса с буквально одинаковым названием (`TC-001` и `TC-002`, разные шаги).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Прогнать Phase 4.5 для этой issue первый раз | Обе строки-дубликаты по названию появляются в глобальном списке под разными `PTC`, каждая со своей ссылкой `Origin` (`ISSUE-ID#TC-001` / `ISSUE-ID#TC-002`) |
| 2 | Прогнать Phase 4.5 повторно для той же issue без изменений в ней | Новые строки не появляются, строка `Last allocated:` не меняется |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/issue-duplicate-titles/docs/issues/open/20990101-feat-fixture-duplicate-titles/test_plan.md`

**Expected Outcome:** Совпадающие названия не схлопываются в одну строку и не путаются друг с другом; повторный прогон — no-op.

**Priority:** High

### TC-016: Восстановление после сбоя в середине Phase 4.5

**Description:** Проверяет, что сбой во время переноса не теряет ручные кейсы: папка issue остаётся в `docs/issues/open/`, и повторный `/pf-close` находит issue и доводит перенос до конца.

**Preconditions:**
- Фикстур-issue с двумя `Type: Manual` кейсами, из которых один уже отражён в `docs/planning/test-plan.md` (сымитирован сбой сразу после первой записанной строки, до второй строки и до обновления `Last allocated:`), при этом папка issue ещё лежит в `docs/issues/open/` (Phase 5 не выполнялась).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-close` на этой фикстуре | Команда находит issue в `docs/issues/open/`, а не завершается с «No active issue found» |
| 2 | Дождаться завершения Phase 4.5 | Вторая Manual-строка добавлена, дублей по первой строке не возникло, `Last allocated:` обновлён до нового максимума |
| 3 | Дождаться завершения закрытия | Issue архивируется штатно, коммит закрытия содержит `docs/planning/test-plan.md` |

**Требуемые данные:**
- `test/fixtures/pf-product-test-plan/issue-partial-promotion/`

**Expected Outcome:** Незавершённый перенос не блокирует и не искажает повторный запуск — то, ради чего Phase 4.5 стоит до архивации, а не после.

**Priority:** Critical

## Status Tracker

| TC     | Test Case | Type   | Priority | Status | Remarks |
| ------ | --------- | ------ | -------- | ------ | ------- |
| TC-001 | Только Manual-кейсы переносятся в глобальный список (BR-1) | Auto | Critical | [ ] | |
| TC-002 | Нормализация Priority Medium → Med | Auto | High | [ ] | |
| TC-003 | Отображение статусов issue-кейса в статус глобального списка | Auto | Critical | [ ] | |
| TC-004 | Выделение номера в отсутствующем/пустом файле | Auto | High | [ ] | |
| TC-005 | Выделение номера после ручного удаления retired-строки | Auto | Critical | [ ] | |
| TC-006 | Выделение номера при отставшем счётчике | Auto | Critical | [ ] | |
| TC-007 | Дубликат PTC между параллельными ветками обнаруживается | Auto | Critical | [ ] | |
| TC-008 | Форма строк и закрытые словари Prio/Status | Auto | High | [ ] | |
| TC-009 | Экранирование `\|` в Area/Test case/Origin | Auto | Medium | [ ] | |
| TC-010 | Area определяется по diff между родительской и issue-веткой | Auto | Medium | [ ] | |
| TC-011 | converge создаёт test-plan.md из шаблона, если файла нет | Auto | High | [ ] | |
| TC-012 | converge никогда не перезаписывает существующий test-plan.md | Auto | High | [ ] | |
| TC-013 | Порядок фаз /pf-close и состав коммита закрытия | Auto | Critical | [ ] | |
| TC-014 | Реальное закрытие issue переносит ручные кейсы и коммитит файл | Manual | Critical | [ ] | |
| TC-015 | Идемпотентность повторного запуска Phase 4.5 при одинаковых названиях | Manual | High | [ ] | |
| TC-016 | Восстановление после сбоя в середине Phase 4.5 | Manual | Critical | [ ] | |

## Known Issues

| Issue | Description | TC Affected | Steps to Reproduce | Severity |
| ----- | ----------- | ----------- | ------------------ | -------- |
|       |             |             |                     |          |
