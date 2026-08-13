# Implementation Plan: Бюджет Manual-кейсов по size tier

## Overview

Реализация жёсткого бюджета Manual-кейсов по size tier, обязательного поля `Manual reason` из закрытого словаря, автоматического прохода конвертации Manual→Auto при превышении бюджета, и 3-вариантного гейта пользователя для оставшихся превышений. Включает модификацию двух ключевых skills, создание валидирующего инструмента, и полный набор автоматизированных + ручных тестов.

## Files to Create/Modify

- `skills/pf-size-tiers/SKILL.md` — добавить таблицу бюджета Manual по tier, словарь `Manual reason`, требования к валидации
- `skills/pf-test-plan/SKILL.md` — реализовать бюджетную проверку, валидацию `Manual reason`, запуск automation pass, 3-вариантный гейт
- `skills/pf-check/SKILL.md` — расширить "Claude review path" для проверки Manual-бюджета и закрытого словаря
- `test/lib.sh` — добавить helpers для парсинга Status Tracker, подсчёта Manual-кейсов, валидации `Manual reason`
- `tools/manual-budget-validator.js` — новый инструмент для парсинга `test_plan.md` и валидации бюджета
- `test/manual-budget.sh` — новый bash-хارнесс для всех 20 тестовых кейсов
- `test/fixtures/manual-budget-tc-001/` ... `test/fixtures/manual-budget-tc-020/` — fixture-issue для каждого TC
- `Makefile` — уже автоматически запускает test/*.sh, изменений не требует

## Dependencies

1. **Size tiers reference table** (pf-size-tiers/SKILL.md) → база для всех проверок бюджета
2. **Enforcement logic** (pf-test-plan/SKILL.md) → использует таблицу, вызывает валидатор
3. **Manual Budget Validator tool** (tools/manual-budget-validator.js) → парсит test_plan.md, считает Manual, валидирует причины
4. **Test lib helpers** (test/lib.sh) → оборачивают валидатор для удобного вызова из bash
5. **Bash test suite** (test/manual-budget.sh) → запускает все 20 TC, вызывает helpers
6. **Fixture issues** (test/fixtures/manual-budget-tc-*/...) → используются suite для воспроизведения сценариев
7. **External dependency**: issue `20260806-feat-product-test-plan` — вариант "отложить избыток" остаётся информационным до её закрытия

## Complexity Estimate

Medium

---

## Implementation Tasks

### Task 1: Добавить таблицу бюджета Manual и словарь `Manual reason` в pf-size-tiers
**Task Type:** code
**Mapped Test Cases:** TC-020

**Files:**
- `skills/pf-size-tiers/SKILL.md` — добавить раздел "Manual Test Budget by Tier" после раздела "Document budgets"

**Implementation Notes:**
- Таблица:
  ```
  | Tier    | Manual Budget | Hard Cap |
  |---------|---------------|----------|
  | trivial | 0-1           | 5        |
  | small   | ≤2            | 5        |
  | medium  | ≤3            | 5        |
  | large   | ≤5            | 5        |
  ```
- Словарь `Manual reason` (ровно 5 значений):
  - `human-judgment` — визуальная, UX, эстетическая оценка
  - `external-system` — платное API, реальное устройство, сторонний аккаунт
  - `interactive-agent` — живая сессия LLM как объект проверки
  - `cost` — автоматизация технически возможна, но дороже пользы
  - `environment` — окружение недоступно в CI
- Явно отметить, что потолок 5 действует при любом tier
- Явно отметить граничный случай: словарь содержит ровно 5 значений, никаких иных

**Acceptance Criteria:**
- [ ] TC-020 pass — словарь ровно 5 значений в SKILL.md

---

### Task 2: Создать Manual Budget Validator инструмент
**Task Type:** code
**Mapped Test Cases:** TC-006, TC-007, TC-008

**Files:**
- `tools/manual-budget-validator.js` — новый файл

**Implementation Notes:**
- Экспортирует функции:
  - `parseTestPlan(filePath)` — парсит test_plan.md, вытаскивает Status Tracker
  - `countManualCases(tracker)` — считает строки со статусом `Manual`
  - `validateManualReasons(tracker)` — проверяет каждый Manual на наличие и корректность `Manual reason`
  - `checkBudget(manualCount, tier)` — возвращает {exceeded: bool, budget: number, hardCap: number}
  - `getValidReasons()` — возвращает массив [5 значений]
- Парсинг Status Tracker по регекс-паттерну строк таблицы (вытаскивает TC, Type, Remarks с Manual reason)
- Валидация:
  - `Manual reason` обязателен для каждого Manual-TC
  - Значение должно быть из словаря (case-sensitive)
  - Возвращает список ошибок или пустой массив
- Обработка ошибок: если Status Tracker не найден или парс сломан, выбросить с понятным сообщением

**Acceptance Criteria:**
- [ ] TC-006 pass — 5 корректных значений принимаются, недопустимое отклоняется
- [ ] TC-007 pass — некорректное значение отклоняется с списком допустимых
- [ ] TC-008 pass — отсутствующее `Manual reason` отклоняется

---

### Task 3: Обновить pf-test-plan/SKILL.md — бюджетная проверка, валидация, enforcement logic
**Task Type:** code
**Mapped Test Cases:** TC-001, TC-002, TC-003, TC-004, TC-005, TC-014

**Files:**
- `skills/pf-test-plan/SKILL.md` — добавить шаги после Step 4 (перед сохранением test_plan.md)

**Implementation Notes:**
- **После Step 4** (после создания Status Tracker) добавить:
  1. **Шаг 4a: Валидация `Manual reason`**
     - Вызвать валидатор: проверить каждый Manual-TC
     - Если ошибки — остановиться, требовать исправления, не сохранять test_plan.md
  2. **Шаг 4b: Подсчёт Manual-кейсов и проверка бюджета**
     - Вызвать счётчик Manual-кейсов
     - Если count <= budget — продолжить к сохранению (Step 5)
     - Если count > budget — перейти к automation pass (Шаг 4c)
- **Ретроактивное применение (AC-03)**: бюджетная проверка должна срабатывать и на regenerate пути (когда test_plan.md уже существует)
- **Hard cap сообщение**: если срабатывает потолок 5, сообщение должно явно указывать "бюджет = N (tier), жёсткий потолок = 5"

**Acceptance Criteria:**
- [ ] TC-001, TC-002, TC-003 pass — бюджеты для small/medium/large соблюдаются, гейт не срабатывает
- [ ] TC-004, TC-005 pass — потолок 5 срабатывает при 6+ Manual, сообщение содержит оба числа
- [ ] TC-014 pass — ретроактивное применение бюджета на старой issue работает

---

### Task 4: Добавить test helpers в test/lib.sh для валидации и подсчёта
**Task Type:** code
**Mapped Test Cases:** (support infrastructure, не маппируется на TC)

**Files:**
- `test/lib.sh` — добавить новые функции в раздел Public API

**Implementation Notes:**
- Новые helpers (все оборачивают вызовы tools/manual-budget-validator.js):
  - `pf_count_manual_in_tracker <test_plan_file>` — возвращает число Manual-TC в Status Tracker
  - `pf_validate_manual_reasons <test_plan_file>` — возвращает 0 (OK) или 1 (ошибки), выводит ошибки в stderr
  - `pf_get_manual_reason_vocab` — возвращает 5 корректных значений, одно на строку
  - `pf_check_manual_budget <manual_count> <size_tier>` — возвращает 0 если в бюджете, 1 если превышение
  - `pf_get_budget_for_tier <size_tier>` — возвращает числовой бюджет (не учитывает потолок)
  - `pf_validate_test_plan_structure <test_plan_file>` — проверяет, что Status Tracker существует и парсим
- Все функции вызывают node с инструментом validator: `node -e 'const v = require(process.argv[1]); ...' tools/manual-budget-validator.js`

**Acceptance Criteria:**
- [ ] Все helpers работают корректно и используются suite

---

### Task 5: Реализовать automation pass как sub-agent dispatch в pf-test-plan
**Task Type:** code
**Mapped Test Cases:** TC-009, TC-010

**Files:**
- `skills/pf-test-plan/SKILL.md` — добавить Шаг 4c (automation pass) после бюджетной проверки

**Implementation Notes:**
- **Шаг 4c: Automation pass** (если count > budget после шага 4b)
  - Это **отдельный dispatched sub-agent** (или delegated actor, если write != claude), не переделка test_plan.md оркестратором
  - Sub-agent читает draft test_plan.md, анализирует каждый Manual-TC:
    - Проверяет, механически ли проверяем (CLI output, содержимое файла, текст в документе) → если да, конвертирует в Auto + указывает harness
    - Если нет и харнесса нет → оставляет Manual, добавляет примечание в implementation_plan.md на построение harness-а
  - Sub-agent пересчитывает Manual-счётчик после конвертации
  - Если счётчик <= бюджета → готово, сохраняет и возвращает контролю оркестратору
  - Если счётчик > бюджета → возвращает статус "превышение остаётся, требуется гейт пользователя"
- Sub-agent dispatch из оркестратора: `Agent({ description: "Automation pass: convert max Manual→Auto in test plan", prompt: "..." })`

**Acceptance Criteria:**
- [ ] TC-009 pass — механически проверяемые TC конвертированы в Auto с указанием конкретного harness
- [ ] TC-010 pass — отсутствующий harness добавлен как задача в implementation_plan.md

---

### Task 6: Реализовать 3-вариантный AskUserQuestion гейт в pf-test-plan
**Task Type:** code
**Mapped Test Cases:** TC-011, TC-012, TC-013

**Files:**
- `skills/pf-test-plan/SKILL.md` — добавить Шаг 4d (гейт) в инструкции

**Implementation Notes:**
- **Шаг 4d: Гейт с 3 вариантами** (если count > budget после automation pass)
  - Срабатывает при count > budget
  - `AskUserQuestion` с ровно тремя опциями, никакого четвёртого варианта:
    1. **"Разбить issue"** (рекомендуется если избыток — связный функциональный кусок)
       - Действие: добавить примечание в test_plan.md о том, что рекомендуется разбить issue
    2. **"Поднять tier"** (требует обоснования)
       - Sub-agent/оркестратор просит ввести обоснование повышения tier
       - Действие: обновить prompt.md: `size_tier` с новым значением, добавить примечание о решении в test_plan.md
       - Пересчитать бюджет по новому tier, убедиться что count <= новый бюджет
    3. **"Отложить избыток"** (без полноценного реестра, только примечание)
       - Действие: добавить раздел в test_plan.md (например "Deferred Test Cases"), перечислив отложенные TC и почему
  - После выбора пользователя сохранить test_plan.md и завершить skill успешно
  - Порядок варианта и их точный текст должны соответствовать требованиям AC-04

**Acceptance Criteria:**
- [ ] TC-011 pass — вариант "Разбить issue" записан в test_plan.md
- [ ] TC-012 pass — вариант "Поднять tier" с обоснованием записан, prompt.md обновлён, бюджет пересчитан
- [ ] TC-013 pass — вариант "Отложить избыток" с примечанием записан

---

### Task 7: Создать bash test suite test/manual-budget.sh
**Task Type:** tests
**Mapped Test Cases:** TC-015, TC-016, TC-017, TC-018, TC-019

**Files:**
- `test/manual-budget.sh` — новый файл

**Implementation Notes:**
- Bash test suite, следует conventions из test/lib.sh (S-1 … S-5)
- Для каждого TC:
  - Вывести заголовок: `printf '\n=== TC-NNN: [описание]\n'`
  - `pf_setup_case manual-budget-tc-NNN >/dev/null` — подготовить fixture
  - Выполнить нужные проверки (парсинг, подсчёт, валидация и т.п.)
  - Использовать helpers из test/lib.sh: `pf_count_manual_in_tracker`, `pf_validate_manual_reasons`, `pf_check_manual_budget` и т.п.
  - Вывести результаты: `pf_pass "сообщение"` или `pf_fail "сообщение"`
- TC-011, TC-012, TC-013 (Manual gate tests) не включены в bash suite — это ручные проверки логики AskUserQuestion
- Итоговый вывод: `pf_summary` (автоматический подсчёт pass/fail)
- Стандартные переменные и трапы: `TMP_WORK`, `TMP_HOME`, очистка при EXIT

**Acceptance Criteria:**
- [ ] TC-015, TC-016, TC-017, TC-018, TC-019 pass — edge cases и validation coverage
- [ ] Suite запускается из Makefile (`make test`)
- [ ] Финальный summary показывает 5 auto-tests passed

---

### Task 8: Создать test fixtures для 20 TC сценариев
**Task Type:** tests
**Mapped Test Cases:** (support infrastructure, не маппируется на TC)

**Files:**
- `test/fixtures/manual-budget-tc-001/prompt.md` + `brd.md` (example issue with size_tier: medium, 3 Manual TC)
- `test/fixtures/manual-budget-tc-002/prompt.md` + `brd.md` (size_tier: small, 2 Manual TC)
- `test/fixtures/manual-budget-tc-003/prompt.md` + `brd.md` (size_tier: large, 5 Manual TC)
- `test/fixtures/manual-budget-tc-004/prompt.md` + `brd.md` (size_tier: large, 6 Manual TC, triggers gate)
- `test/fixtures/manual-budget-tc-005/prompt.md` + `brd.md` (size_tier: trivial, 6 Manual TC, hard cap 5)
- `test/fixtures/manual-budget-tc-006/prompt.md` + `brd.md` (6 Manual TC: 5 с разными корректными reasons, 1 с неправильным)
- `test/fixtures/manual-budget-tc-007/prompt.md` + `brd.md` (1 Manual TC с `Manual reason: invalid-reason`)
- `test/fixtures/manual-budget-tc-008/prompt.md` + `brd.md` (1 Manual TC без `Manual reason`)
- `test/fixtures/manual-budget-tc-009/prompt.md` + `brd.md` (size_tier: medium, 5 Manual TC: 2 CLI-проверяемых, 3 визуальных)
- `test/fixtures/manual-budget-tc-010/prompt.md` + `brd.md` (size_tier: medium, 5 Manual TC: некоторые требуют новых harness-ей)
- `test/fixtures/manual-budget-tc-011/prompt.md` + `brd.md` (size_tier: medium, 5 Manual TC после automation pass, требует гейта)
- `test/fixtures/manual-budget-tc-012/prompt.md` + `brd.md` (как TC-011, для проверки tier-поднятия)
- `test/fixtures/manual-budget-tc-013/prompt.md` + `brd.md` (size_tier: medium, 4 Manual TC после automation pass, требует гейта)
- `test/fixtures/manual-budget-tc-014/prompt.md` + `brd.md` (старая issue с `size_tier: small`, 5 Manual TC, ретроактивное применение)
- `test/fixtures/manual-budget-tc-015/prompt.md` + `brd.md` (1 Manual TC: файл проверяется, но `Manual reason: cost`)
- `test/fixtures/manual-budget-tc-016/prompt.md` + `brd.md` (как TC-009, для проверки сохранения логики при конвертации)
- `test/fixtures/manual-budget-tc-017/prompt.md` + `brd.md` (size_tier: medium, 3 Manual TC, в бюджете, automation pass не нужна)
- `test/fixtures/manual-budget-tc-018/prompt.md` + `brd.md` (size_tier: medium, 5 Manual TC: 2 конвертируемых, 3 нет, после automation = 3)
- `test/fixtures/manual-budget-tc-019/prompt.md` + `brd.md` (как TC-018, для проверки идемпотентности)
- `test/fixtures/manual-budget-tc-020/` — не требует test_plan.md, просто проверяет словарь в SKILL.md

**Implementation Notes:**
- Каждый fixture — это папка с minimal prompt.md + brd.md (для feat/improve)
- prompt.md должен содержать: `---` + `doc_language: Russian` + `size_tier: <tier>` + `roles: {...}`
- brd.md должен быть достаточно полным, чтобы при чтении инструментом было понятно, какие TC нужны
- Для некоторых TC (TC-004..TC-008, TC-015..TC-019) можно напрямую добавить draft test_plan.md с нужной Status Tracker вместо полного brd.md
- TC-014: snapshot Status Tracker из закрытой issue `20260703-improve-scale-doc-complexity` в fixture
- TC-020: не требует fixture, просто grep SKILL.md на словарь

**Acceptance Criteria:**
- [ ] Все fixtures готовы и загружены в test/fixtures/manual-budget-tc-*/
- [ ] Suite успешно загружает каждый fixture с `pf_setup_case`
- [ ] Тесты находят Status Tracker в каждом fixture

---

### Task 9: Документировать ручные тесты гейта для `/pf-manual-test`
**Task Type:** code
**Mapped Test Cases:** (support infrastructure, not mapped to TC — verification instructions for manual testing phase)

**Files:**
- `docs/issues/open/20260806-improve-manual-test-budget/manual_test_checklist.md` — инструкции для ручной проверки TC-011, TC-012, TC-013

**Implementation Notes:**
- Создать простой markdown-файл с инструкциями для TC-011, TC-012, TC-013, которые потребуют ручной проверки.
- **TC-011: Гейт вариант "Разбить issue"**
  - Вручную запустить `/pf-test-plan` на test-fixture-tc-011 (issue с превышением бюджета)
  - Выбрать первый вариант: "Разбить issue"
  - Убедиться, что примечание о разбиении добавлено в test_plan.md
  - Проверить, что тест-план завершён успешно
  
- **TC-012: Гейт вариант "Поднять tier"**
  - Вручную запустить `/pf-test-plan` на test-fixture-tc-012
  - Выбрать второй вариант: "Поднять tier"
  - Ввести обоснование (например, "этот feature требует 5 Manual проверок по дизайну и UX")
  - Убедиться, что prompt.md обновлён с новым tier, test_plan.md содержит обоснование
  - Убедиться, что Manual-счётчик теперь в бюджете нового tier
  
- **TC-013: Гейт вариант "Отложить избыток"**
  - Вручную запустить `/pf-test-plan` на test-fixture-tc-013
  - Выбрать третий вариант: "Отложить избыток"
  - Убедиться, что примечание о отложенных TC добавлено в test_plan.md
  - Проверить, что test_plan.md содержит какие TC отложены

**Acceptance Criteria:**
- [ ] Инструкции ясны и воспроизводимы
- [ ] Все три варианта гейта могут быть проверены вручную
- [ ] manual_test_checklist.md интегрируется с `/pf-manual-test`

---

### Task 10: Расширить `/pf-check` для проверки Manual-бюджета и закрытого словаря `Manual reason`
**Task Type:** code
**Mapped Test Cases:** (support infrastructure, не маппируется на TC — расширяет существующий pf-check gate)

**Files:**
- `skills/pf-check/SKILL.md` — расширить prompt "Claude review path" (раздел, где проверяется oversized-for-tier)

**Implementation Notes:**
- В раздел "Claude review path" (после проверки на oversized-для-tier для test_plan.md) добавить новую логику:
  - Парсит `test_plan.md` (ищет Status Tracker)
  - Считает Manual-кейсы, сравнивает с бюджетом текущего tier (из `skills/pf-size-tiers/SKILL.md`)
  - Проверяет каждый Manual-TC на наличие `Manual reason` и его корректность (ровно 5 значений из словаря)
  - Если Manual-count > tier-budget ИЛИ Manual reason некорректен/отсутствует → добавить P1 finding с типом oversized/invalid, не проходить проверку дальше
  - Сообщение должно указывать: Manual-count, tier-budget, hard-cap (5), и список некорректных reasons (если есть)
- Использовать тот же инструмент `tools/manual-budget-validator.js`, что и pf-test-plan, или вызвать функции через ту же архитектуру
- Проверка срабатывает для любого `test_plan.md` с таблицей Status Tracker, независимо от tier

**Acceptance Criteria:**
- [ ] `/pf-check` флагирует превышение Manual-бюджета как P1 oversized finding
- [ ] `/pf-check` флагирует некорректные/отсутствующие `Manual reason` как P1 invalid finding
- [ ] Оба типа фактов верны: используется актуальная информация из pf-size-tiers
- [ ] Проверка не срабатывает на test_plan.md без Status Tracker

