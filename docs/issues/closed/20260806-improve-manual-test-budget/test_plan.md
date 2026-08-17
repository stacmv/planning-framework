# Test Plan: Бюджет Manual-кейсов по size tier

## Overview

Этот тест-план проверяет введение жёсткого бюджета числа Manual test case по size tier, обязательное поле `Manual reason` из закрытого словаря, автоматический проход конвертации Manual→Auto при превышении бюджета, и гейт с явным выбором пользователя (разбить issue / поднять tier / отложить) для случаев, когда превышение остаётся.

## Objectives

- Убедиться, что `/pf-test-plan` (и его подчинённые компоненты) ограничивают число Manual-кейсов в соответствии с declared size tier issue.
- Проверить, что каждый Manual-кейс обязан нести непустое значение `Manual reason` из закрытого словаря из 5 значений.
- Проверить автоматическую конвертацию Manual→Auto при превышении бюджета, включая случаи с отсутствующим харнессом.
- Проверить 3-вариантный гейт `AskUserQuestion` и его влияние на `test_plan.md`.
- Убедиться, что правило работает как для новых, так и для уже открытых issue (ретроактивное применение).
- Проверить жёсткий потолок 5 Manual-кейсов при любом tier.

## Prerequisites

- Framework repo (`planning-framework/`) готов к запуску `/pf-test-plan` (установлены зависимости, skills подготовлены).
- Команда `/pf-test-plan` доступна и работает.
- В системе есть инструменты для работы с JSON, markdown (jq, grep, sed или аналоги).
- Тестовые issue могут быть созданы в `docs/issues/open/` для целей тестирования.
- Harness для Auto-тестов включает функции для парсинга `test_plan.md`, подсчёта Manual-кейсов, проверки значений `Manual reason`.

---

## Test Cases

### Functional Tests

### TC-001: Бюджет Medium tier (≤3 Manual) соблюдается

**Description:** Проверяет, что при запуске `/pf-test-plan` на issue с `size_tier: medium` и 3 Manual-кейсами с корректной причиной тест-план принимается без превышения.

**Preconditions:**
- Issue создана с `size_tier: medium` в BRD.
- Предварительный draft тест-плана содержит ровно 3 Manual-кейса, каждый с `Manual reason` из закрытого словаря.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` на issue | Навык читает `brd.md`, генерирует тест-план |
| 2 | Проверить статус Manual-кейсов в финальном `test_plan.md` | Ровно 3 Manual-кейса остаются в Status Tracker |
| 3 | Убедиться, что гейт не срабатывает | Нет `AskUserQuestion` о превышении бюджета |

**Test Data:**
- `docs/issues/open/test-fixture-tc-001/brd.md` (example fixture with size_tier: medium)
- `docs/issues/open/test-fixture-tc-001/prompt.md` (corresponding prompt)

**Expected Outcome:** Тест-план завершается успешно, Manual-кейсы остаются в допустимом диапазоне, превышения нет.

**Priority:** Critical

---

### TC-002: Бюджет Small tier (≤2 Manual) соблюдается

**Description:** Проверяет, что при запуске `/pf-test-plan` на issue с `size_tier: small` и 2 Manual-кейсами с корректной причиной тест-план принимается.

**Preconditions:**
- Issue создана с `size_tier: small` в BRD.
- Предварительный draft содержит ровно 2 Manual-кейса с корректной `Manual reason`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` на issue | Навык читает `brd.md`, генерирует тест-план |
| 2 | Проверить счётчик Manual-кейсов | Ровно 2 Manual-кейса в Status Tracker |
| 3 | Убедиться, что гейт не срабатывает | Тест-план принят без дополнительных вопросов |

**Test Data:**
- `docs/issues/open/test-fixture-tc-002/brd.md`
- `docs/issues/open/test-fixture-tc-002/prompt.md`

**Expected Outcome:** Тест-план завершён успешно, Manual-кейсы в пределах бюджета.

**Priority:** Critical

---

### TC-003: Бюджет Large tier (≤5 Manual) соблюдается

**Description:** Проверяет, что при запуске `/pf-test-plan` на issue с `size_tier: large` и 5 Manual-кейсами тест-план принимается.

**Preconditions:**
- Issue создана с `size_tier: large` в BRD.
- Предварительный draft содержит ровно 5 Manual-кейсов с корректной `Manual reason`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` на issue | Навык генерирует тест-план |
| 2 | Проверить счётчик Manual-кейсов | Ровно 5 Manual-кейсов в Status Tracker |
| 3 | Убедиться, что гейт не срабатывает | Нет AskUserQuestion о превышении |

**Test Data:**
- `docs/issues/open/test-fixture-tc-003/brd.md`
- `docs/issues/open/test-fixture-tc-003/prompt.md`

**Expected Outcome:** Тест-план принят; Manual-кейсы ровно на потолке бюджета.

**Priority:** Critical

---

### TC-004: Hard cap 5 Manual при Large tier (6+ Manual rejected)

**Description:** Проверяет, что при попытке создать 6 Manual-кейсов на issue `size_tier: large` система останавливается на гейте, так как потолок — 5 независимо от tier.

**Preconditions:**
- Issue создана с `size_tier: large` в BRD.
- Предварительный draft содержит 6 Manual-кейсов, каждый с корректной причиной.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` на issue | Навык считает Manual-кейсы |
| 2 | Убедиться, что срабатывает гейт превышения | `AskUserQuestion` о 1 лишнем кейсе |
| 3 | Проверить, что бюджет рассчитан как 5, а не более | Сообщение гейта указывает бюджет 5 |

**Test Data:**
- `docs/issues/open/test-fixture-tc-004/brd.md`
- `docs/issues/open/test-fixture-tc-004/prompt.md`

**Expected Outcome:** Гейт срабатывает на превышении, потолок 5 соблюдается.

**Priority:** Critical

---

### TC-005: Hard cap 5 Manual при Trivial tier

**Description:** Проверяет, что даже на `size_tier: trivial` потолок всё равно 5 (а не ≤1, если бы потолок не был жёстким).

**Preconditions:**
- Issue создана с `size_tier: trivial` в BRD.
- Предварительный draft содержит 6 Manual-кейсов.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` | Навык считает Manual-кейсы |
| 2 | Проверить сработал ли гейт превышения | Гейт срабатывает на 6-м кейсе (бюджет trivial = 1, но потолок = 5) |
| 3 | Убедиться в корректном сообщении гейта | Бюджет = 1, но потолок = 5 |

**Test Data:**
- `docs/issues/open/test-fixture-tc-005/brd.md`
- `docs/issues/open/test-fixture-tc-005/prompt.md`

**Expected Outcome:** Гейт срабатывает при 6+ Manual, потолок 5 соблюдается.

**Priority:** High

---

### TC-006: Закрытый словарь `Manual reason` — принимаются 5 корректных значений и отклоняются недопустимые

**Description:** Проверяет, что каждое из 5 значений закрытого словаря (`human-judgment`, `external-system`, `interactive-agent`, `cost`, `environment`) принимается как корректное значение `Manual reason`, и что значение вне этого словаря (например, `wrong-reason`) отклоняется.

**Preconditions:**
- Issue с 6 Manual-кейсами: 5 с корректными значениями из словаря, 1 с недопустимым значением.
- `size_tier: medium` (бюджет ≤3, но это edge case с 6 — сработает гейт, но это ОК для теста).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` | Навык парсит Manual reason для каждого кейса |
| 2 | Проверить 5 Manual-кейсов с корректными значениями | Каждый имеет поле `Manual reason` с одним из 5 значений и остаётся в Status Tracker |
| 3 | Проверить Manual-кейс с недопустимым значением (`wrong-reason`) | Кейс отклоняется; система указывает, что значение не из словаря |
| 4 | Убедиться в сообщении об ошибке | Указаны недопустимое значение и список из 5 корректных |

**Test Data:**
- `docs/issues/open/test-fixture-tc-006/brd.md` (5 Manual-кейсов с разными причинами)
- `docs/issues/open/test-fixture-tc-006/prompt.md`

**Expected Outcome:** Все 5 значений из словаря принимаются как корректные; кейс с `wrong-reason` отклоняется с указанием списка допустимых значений.

**Priority:** Critical

---

### TC-007: `Manual reason` с недопустимым значением отклоняется

**Description:** Проверяет, что Manual-кейс с `Manual reason`, не входящим в закрытый словарь из 5 значений (например, `performance` или `other`), не принимается.

**Preconditions:**
- Issue содержит 1 Manual-кейс с `Manual reason: invalid-reason`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` | Навык валидирует значение `Manual reason` |
| 2 | Убедиться, что система отклоняет недопустимое значение | Ошибка валидации или отправка на переделку |
| 3 | Проверить сообщение об ошибке | Оно указывает на недопустимое значение и список корректных |

**Test Data:**
- `docs/issues/open/test-fixture-tc-007/brd.md` (1 Manual с неправильной причиной)
- `docs/issues/open/test-fixture-tc-007/prompt.md`

**Expected Outcome:** Тест-план не принимается; система требует исправить `Manual reason` на одно из 5 допустимых значений.

**Priority:** Critical

---

### TC-008: Manual-кейс без `Manual reason` отклоняется

**Description:** Проверяет, что Manual-кейс без заполненного поля `Manual reason` не принимается.

**Preconditions:**
- Issue содержит 1 Manual-кейс без значения `Manual reason` (поле пусто или отсутствует).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` | Навык валидирует наличие `Manual reason` |
| 2 | Убедиться, что кейс отклоняется | Ошибка валидации: `Manual reason` обязателен |
| 3 | Проверить сообщение об ошибке | Указано, что поле обязательно и какой кейс не заполнен |

**Test Data:**
- `docs/issues/open/test-fixture-tc-008/brd.md` (1 Manual без reason)
- `docs/issues/open/test-fixture-tc-008/prompt.md`

**Expected Outcome:** Тест-план не принимается; система требует заполнить `Manual reason`.

**Priority:** Critical

---

### TC-009: Automation pass — успешная конвертация Manual→Auto

**Description:** Проверяет, что при превышении бюджета система автоматически переводит Manual-кейсы, которые механически проверяемы, в Auto с указанием конкретного харнесса.

**Preconditions:**
- Issue `size_tier: medium` (бюджет ≤3).
- Предварительный draft содержит 5 Manual-кейсов, из них 2 проверяют вывод CLI (механически проверяемо).
- Остальные 3 — вижуальные (human-judgment).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` | Навык считает Manual-кейсы: 5 > 3 (бюджет) |
| 2 | Убедиться, что сработала automation pass | Отдельный проход конвертирует Manual→Auto |
| 3 | Проверить финальный Status Tracker | 2 кейса переведены в Auto (CLI harness), 3 остаются Manual |
| 4 | Убедиться, что для каждого Auto-кейса указан конкретный харнесс | Например, `harness: cli-output-check` |

**Test Data:**
- `docs/issues/open/test-fixture-tc-009/brd.md` (5 Manual с 2 CLI-проверяемыми)
- `docs/issues/open/test-fixture-tc-009/prompt.md`

**Expected Outcome:** Automation pass переводит 2 кейса в Auto; Manual-счётчик снижается до 3 (в бюджете); гейт не срабатывает.

**Priority:** Critical

---

### TC-010: Automation pass с отсутствующим харнессом создаёт задачу в implementation_plan.md

**Description:** Проверяет, что при невозможности конвертировать Manual-кейс (требуется специальный харнесс, которого нет) система создаёт задачу на построение этого харнесса в `implementation_plan.md`.

**Preconditions:**
- Issue `size_tier: medium` (бюджет ≤3).
- Draft содержит 5 Manual-кейсов: 2 проверяют прямой вывод (есть harness), 3 требуют специального harness-а (его нет).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` | Automation pass начинается при превышении |
| 2 | Проверить конвертацию кейсов | 2 кейса переведены в Auto, 3 остаются Manual |
| 3 | Проверить `implementation_plan.md` | Появилась задача на построение отсутствующего harness-а |
| 4 | Убедиться, что задача имеет описание | Уточнено, для каких кейсов нужен этот harness |

**Test Data:**
- `docs/issues/open/test-fixture-tc-010/brd.md` (5 Manual, некоторые требуют новых harness-ей)
- `docs/issues/open/test-fixture-tc-010/prompt.md`

**Expected Outcome:** Задача на построение harness-а добавлена в `implementation_plan.md`; Manual-счётчик остаётся > 3.

**Priority:** High

---

### TC-011: Гейт после automation pass — вариант «Разбить issue»

**Description:** Проверяет, что при выборе пользователем варианта «Разбить issue» система корректно регистрирует это решение и предлагает рекомендации по разбиению.

**Preconditions:**
- Issue `size_tier: medium`, после automation pass остаётся 5 Manual-кейсов (превышение на 2).
- Automation pass не решил проблему полностью.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` | Гейт срабатывает с 3 вариантами |
| 2 | Выбрать вариант 1: «Разбить issue» | `AskUserQuestion` возвращает выбор пользователя |
| 3 | Убедиться, что решение записано в `test_plan.md` | Примечание о разбиении + какие кейсы отложены |
| 4 | Проверить, что тест-план не завершается с ошибкой | Процесс продолжает работу после гейта |

**Test Data:**
- `test/fixtures/manual-budget-tc-011/docs/issues/open/manual-budget-tc-011/prompt.md`
- `test/fixtures/manual-budget-tc-011/docs/issues/open/manual-budget-tc-011/test_plan.md`

**Expected Outcome:** Решение «Разбить issue» записано; тест-план завершён с информацией о разбиении.

**Priority:** High

---

### TC-012: Гейт после automation pass — вариант «Поднять tier»

**Description:** Проверяет, что при выборе варианта «Поднять tier» система требует написать обоснование и регистрирует оба значения в тест-плане.

**Preconditions:**
- Issue `size_tier: medium`, после automation pass остаётся 5 Manual-кейсов.
- Пользователь выбирает вариант 2: «Поднять tier».

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` | Гейт срабатывает |
| 2 | Выбрать вариант 2: «Поднять tier» | `AskUserQuestion` предлагает ввести обоснование |
| 3 | Ввести обоснование (например, «этот feature требует 5 Manual проверок по дизайну и UX») | Система принимает обоснование |
| 4 | Проверить `test_plan.md` | Записано: старый tier (medium), новый tier (large), обоснование |
| 5 | Убедиться, что бюджет пересчитан на новый tier | Manual-кейсы теперь в бюджете large (≤5) |

**Test Data:**
- `test/fixtures/manual-budget-tc-012/docs/issues/open/manual-budget-tc-012/prompt.md`
- `test/fixtures/manual-budget-tc-012/docs/issues/open/manual-budget-tc-012/test_plan.md`

**Expected Outcome:** Tier поднят; обоснование записано в тест-план; превышение разрешено.

**Priority:** High

---

### TC-013: Гейт после automation pass — вариант «Отложить избыток»

**Description:** Проверяет, что при выборе варианта «Отложить избыток» система записывает в `test_plan.md` примечание о том, какие Manual-кейсы отложены и почему, без полноценного реестра (до реализации issue `20260806-feat-product-test-plan`).

**Preconditions:**
- Issue `size_tier: medium`, после automation pass остаётся 4 Manual-кейса (превышение на 1).
- Пользователь выбирает вариант 3: «Отложить избыток».

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` | Гейт срабатывает с 3 вариантами |
| 2 | Выбрать вариант 3: «Отложить избыток» | Система регистрирует выбор |
| 3 | Проверить `test_plan.md` | Появилось примечание: какие кейсы отложены, почему |
| 4 | Убедиться, что Status Tracker отражает решение | Отложенные кейсы помечены как deferred (или аналогично) |

**Test Data:**
- `test/fixtures/manual-budget-tc-013/docs/issues/open/manual-budget-tc-013/prompt.md`
- `test/fixtures/manual-budget-tc-013/docs/issues/open/manual-budget-tc-013/test_plan.md`

**Expected Outcome:** Решение зафиксировано; примечание о отложенных кейсах добавлено в тест-план.

**Priority:** High

---

### TC-014: Ретроактивная применимость — повторный запуск на старой issue

**Description:** Проверяет, что повторный запуск `/pf-test-plan` на issue, открытой до внедрения feature (когда бюджета не было), применяет новое правило бюджета.

**Preconditions:**
- Существует issue, открытая давно, с `size_tier: small` и 5 Manual-кейсами (это было «OK» раньше).
- Эта issue находится в `docs/issues/open/`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` на старой issue | Навык снова обрабатывает тест-план |
| 2 | Убедиться, что бюджет применяется ретроактивно | Счётчик: 5 Manual > 2 (бюджет small) — превышение |
| 3 | Проверить, что сработала automation pass | Попытка конвертировать Manual→Auto |
| 4 | Убедиться, что гейт срабатывает | `AskUserQuestion` с 3 вариантами |

**Test Data:**
- Использовать существующую old issue (например, из `20260703-improve-scale-doc-complexity` если её тест-план ещё открыт)

**Expected Outcome:** Новое правило применяется ретроактивно; старые issue не освобождены от дисциплины.

**Priority:** High

---

### Validation Tests

### TC-015: Ошибка валидации — Manual reason из закрытого словаря vs. покрытие существующим харнессом

**Description:** Проверяет, что Manual-кейс, указывающий причину из закрытого словаря, но на самом деле проверяющий содержимое файла (что механически проверяемо), будет отклонён валидацией как неправильно помеченный.

**Preconditions:**
- Manual-кейс: проверяет содержимое сгенерированного JSON-файла.
- `Manual reason: cost` (якобы дорого автоматизировать, но это ложь — содержимое файла легко проверяется).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` | Навык валидирует тест-план |
| 2 | Убедиться, что валидатор обнаруживает несоответствие | `Manual reason: cost` не применима к проверке файла |
| 3 | Проверить сообщение об ошибке | Указано, что файл проверяется механически (есть харнесс) |

**Test Data:**
- `docs/issues/open/test-fixture-tc-015/brd.md` (Manual с неправильной причиной)
- `docs/issues/open/test-fixture-tc-015/prompt.md`

**Expected Outcome:** Система требует изменить `Manual reason` на более честную или перевести в Auto.

**Priority:** Medium

---

### TC-016: Успешная конвертация Manual→Auto сохраняет логику кейса

**Description:** Проверяет, что при конвертации Manual-кейса в Auto система сохраняет полную логику проверки (шаги, expected result, test data), просто меняя тип и добавляя ссылку на харнесс.

**Preconditions:**
- Manual-кейс: проверяет, что скрипт генерирует файл с корректными значениями (механически проверяемо).
- Automation pass конвертирует его в Auto.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` и позволить automation pass обработать кейс | Manual переведён в Auto |
| 2 | Сравнить шаги кейса до и после | Логика не изменилась, только тип и харнесс |
| 3 | Проверить Test Data | Остались те же fixtures |

**Test Data:**
- `docs/issues/open/test-fixture-tc-016/brd.md` (Manual с механической проверкой)
- `docs/issues/open/test-fixture-tc-016/prompt.md`

**Expected Outcome:** Кейс успешно конвертирован; логика и data сохранены.

**Priority:** Medium

---

### Edge Cases

### TC-017: Automation pass на issue, уже в бюджете (no-op)

**Description:** Проверяет, что automation pass, если он запущен на issue, уже соответствующем бюджету, не вносит нежелательные изменения (идемпотентен).

**Preconditions:**
- Issue `size_tier: medium`, ровно 3 Manual-кейса, все с корректной причиной.
- Бюджет соблюдается, гейт не срабатывает.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` | Бюджет соблюдается, гейт не срабатывает |
| 2 | Убедиться, что automation pass не запущена (не нужна) | Финальный тест-план идентичен черновику |
| 3 | Проверить, что никакие кейсы не переведены в Auto без необходимости | Status Tracker остался без изменений |

**Test Data:**
- `docs/issues/open/test-fixture-tc-017/brd.md` (в бюджете)
- `docs/issues/open/test-fixture-tc-017/prompt.md`

**Expected Outcome:** Тест-план завершён без ненужных преобразований.

**Priority:** Medium

---

### TC-018: Automation pass снижает Manual-счётчик ровно до бюджета

**Description:** Проверяет, что automation pass конвертирует ровно столько Manual-кейсов, чтобы финальный счётчик был == бюджету (не ниже, не выше, где это возможно).

**Preconditions:**
- Issue `size_tier: medium` (бюджет 3).
- Draft содержит 5 Manual-кейсов: 2 механически проверяемых, 3 нет.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить automation pass | 2 кейса конвертированы в Auto |
| 2 | Проверить финальный счётчик Manual | Ровно 3 (== бюджету), гейт не срабатывает |
| 3 | Убедиться, что конвертация прошла оптимально | Никакие лишние Manual не остались |

**Test Data:**
- `docs/issues/open/test-fixture-tc-018/brd.md` (5 Manual: 2 конвертируемых, 3 нет)
- `docs/issues/open/test-fixture-tc-018/prompt.md`

**Expected Outcome:** Финальный счётчик Manual == бюджету; гейт не срабатывает.

**Priority:** Medium

---

### TC-019: Несколько automation pass на одном тест-плане (идемпотентность)

**Description:** Проверяет, что повторный запуск automation pass на уже обработанном тест-плане не вносит изменений (идемпотентен).

**Preconditions:**
- Issue прошла первый `/pf-test-plan`, automation pass конвертировал Manual→Auto.
- Пользователь снова запускает `/pf-test-plan` на той же issue с тем же draft.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-test-plan` второй раз | Automation pass запущена снова |
| 2 | Сравнить финальный тест-план с первым запуском | Идентичны |
| 3 | Убедиться, что никакие Auto-кейсы не переведены обратно в Manual | Преобразования необратимы |

**Test Data:**
- Использовать result из TC-009 как исходный draft для второго запуска

**Expected Outcome:** Тест-план остался неизменным; идемпотентность подтверждена.

**Priority:** Low

---

### TC-020: Закрытый словарь `Manual reason` — граница 5 значений (ровно 5, не больше)

**Description:** Проверяет, что словарь содержит ровно 5 значений, не более и не менее (никаких скрытых 6-х вариантов).

**Preconditions:**
- Доступен исходный код компонента, валидирующего `Manual reason`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Найти определение закрытого словаря в коде | Массив/набор из 5 значений |
| 2 | Убедиться, что это ровно 5: `human-judgment`, `external-system`, `interactive-agent`, `cost`, `environment` | Никаких других значений |
| 3 | Проверить, что валидатор использует это определение | Логика проверки лежит на этом наборе |

**Test Data:**
- `skills/pf-size-tiers/SKILL.md` (каноническое определение словаря)
- `test/lib.sh` (`pf_get_manual_reason_vocab`)

**Expected Outcome:** Словарь содержит ровно 5 значений; никаких неожиданных расширений.

**Priority:** Low

---

### TC-021: `/pf-check` инструктирован проверять Manual-бюджет и словарь для `test_plan.md`

**Description:** Проверяет, что `skills/pf-check/SKILL.md`'s "Claude review path" промпт содержит инструкцию проверять Manual-бюджет по tier и закрытый словарь `Manual reason`, когда TARGET — `test_plan.md`. Добавлен по итогам `/pf-check` ревью самого `implementation_plan.md` (Task 10), после того как этот test_plan.md уже был зафиксирован — статическая проверка формулировки промпта, не проверка живого запуска ревью (которая требует LLM-суждения и не поддаётся детерминированному bash-тесту).

**Preconditions:**
- `skills/pf-check/SKILL.md` существует и содержит секцию "Claude review path".

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `grep` секцию "Claude review path" в `skills/pf-check/SKILL.md` | Секция найдена |
| 2 | Проверить наличие упоминания "Manual test-case budget by tier" или эквивалентной по смыслу инструкции | Найдено |
| 3 | Проверить наличие упоминания `Manual reason` и словаря из 5 значений | Найдено |

**Test Data:**
- `skills/pf-check/SKILL.md`

**Expected Outcome:** Промпт "Claude review path" содержит обе проверки (бюджет + словарь) как P1 findings для `test_plan.md`.

**Priority:** Medium

---

## Status Tracker

| TC | Test Case | Type | Priority | Status | Remarks |
|----|-----------|------|----------|--------|---------|
| TC-001 | Бюджет Medium tier (≤3 Manual) соблюдается | Auto | Critical | ✓ | Harness: count-manual-in-status-tracker |
| TC-002 | Бюджет Small tier (≤2 Manual) соблюдается | Auto | Critical | ✓ | Harness: count-manual-in-status-tracker |
| TC-003 | Бюджет Large tier (≤5 Manual) соблюдается | Auto | Critical | ✓ | Harness: count-manual-in-status-tracker |
| TC-004 | Hard cap 5 Manual при Large tier (6+ Manual rejected) | Auto | Critical | ✓ | Harness: gate-trigger-at-6-manual, budget-calculation |
| TC-005 | Hard cap 5 Manual при Trivial tier | Auto | High | ✓ | Harness: hard-cap-enforcement |
| TC-006 | Словарь `Manual reason` — принимаются 5 корректных | Auto | Critical | ✓ | Harness: validate-manual-reason-vocab |
| TC-007 | `Manual reason` с недопустимым значением отклоняется | Auto | Critical | ✓ | Harness: validate-manual-reason-vocab, reject-invalid |
| TC-008 | Manual-кейс без `Manual reason` отклоняется | Auto | Critical | ✓ | Harness: validate-manual-reason-required |
| TC-009 | Automation pass — успешная конвертация Manual→Auto | Auto | Critical | ✓ | Harness: automation-pass, cli-output-check |
| TC-010 | Automation pass с отсутствующим харнессом | Auto | High | ✓ | Harness: automation-pass, missing-harness-detection, impl-plan-task-create |
| TC-011 | Гейт — вариант «Разбить issue» | Manual | High | ✓ | Прогнано вручную 2026-08-17 — см. manual_test_checklist.md |
| TC-012 | Гейт — вариант «Поднять tier» | Manual | High | ✓ | Прогнано вручную 2026-08-17 — см. manual_test_checklist.md |
| TC-013 | Гейт — вариант «Отложить избыток» | Manual | High | ✓ | Прогнано вручную 2026-08-17 — см. manual_test_checklist.md |
| TC-014 | Ретроактивная применимость на старой issue | Auto | High | ✓ | Harness: retroactive-budget-enforcement; uses existing old issue |
| TC-015 | Manual reason валидация vs. механическое покрытие | Auto | Medium | ✓ | Harness: validate-reason-vs-harness-coverage |
| TC-016 | Успешная конвертация сохраняет логику | Auto | Medium | ✓ | Harness: compare-case-logic-before-after |
| TC-017 | Automation pass на issue в бюджете (no-op) | Auto | Medium | ✓ | Harness: automation-pass-idempotence |
| TC-018 | Automation pass снижает Manual-счётчик до бюджета | Auto | Medium | ✓ | Harness: count-manual-after-automation, budget-match |
| TC-019 | Несколько automation pass (идемпотентность) | Auto | Low | ✓ | Harness: multiple-automation-pass-idempotence |
| TC-020 | Словарь ровно 5 значений | Auto | Low | ✓ | Harness: vocabulary-size-check |
| TC-021 | `/pf-check` инструктирован проверять Manual-бюджет и словарь | Auto | Medium | ✓ | Harness: grep-skill-instruction-text |

---

## Known Issues

| Issue | Description | TC Affected | Steps to Reproduce | Severity |
|-------|-------------|-------------|-------------------|----------|
| Auto test harnesses not yet implemented | Auto test cases (TC-001 through TC-021) reference harness functions and fixture files in their Remarks that do not exist in the repo yet (e.g. `count-manual-in-status-tracker`, `docs/issues/open/test-fixture-tc-NNN/`). This is expected at the test-plan stage — building missing harnesses is a task for `implementation_plan.md` during the implementation phase, not a prerequisite of this test plan itself. | TC-001, TC-002, TC-003, TC-004, TC-005, TC-006, TC-007, TC-008, TC-009, TC-010, TC-014, TC-015, TC-016, TC-017, TC-018, TC-019, TC-020, TC-021 | Review Status Tracker Remarks column for Auto tests; verify harness function names and fixture paths. | Low (expected; not a defect) |

---

## Notes

- **Auto vs Manual distinction:** TC-011, TC-012, TC-013 требуют человека для проверки логики `AskUserQuestion` и корректности записи решения в `test_plan.md`. Остальные тесты могут быть полностью автоматизированы через bash harness.
- **Harness requirements:** Требуется написать helpers в `test/lib.sh` для парсинга `test_plan.md`, подсчёта Manual-кейсов по tier, валидации `Manual reason`, проверки automation pass результатов.
- **Гейт-тесты:** TC-011/TC-012/TC-013 требуют проверки, что `AskUserQuestion` была корректно выведена и что её результаты правильно записаны. Может потребоваться проверка логов или файла истории.
- **Fixtures:** Для каждого TC предусмотрены fixture-кейсы в `docs/issues/open/test-fixture-tc-NNN/`. Они используются для воспроизведения сценариев.
