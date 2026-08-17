# Implementation Plan: Бюджет Manual-кейсов по size tier

## Overview

Реализация жёсткого бюджета Manual-кейсов по size tier, обязательного поля `Manual reason` из закрытого словаря, автоматического прохода конвертации Manual→Auto при превышении бюджета, и 3-вариантного гейта пользователя для оставшихся превышений. Включает модификацию двух ключевых skills, создание валидирующего инструмента, и полный набор автоматизированных + ручных тестов.

## Files to Create/Modify

- `skills/pf-size-tiers/SKILL.md` — добавить таблицу бюджета Manual по tier, словарь `Manual reason`, требования к валидации
- `skills/pf-test-plan/SKILL.md` — реализовать бюджетную проверку, валидацию `Manual reason`, запуск automation pass, 3-вариантный гейт
- `skills/pf-check/SKILL.md` — расширить "Claude review path" для проверки Manual-бюджета и закрытого словаря
- `test/lib.sh` — добавить helpers для парсинга Status Tracker, подсчёта Manual-кейсов, валидации `Manual reason`
- ~~`tools/manual-budget-validator.js`~~ — не создан, см. Task 2 DEVIATION (bash в `test/lib.sh` вместо Node)
- `test/manual-budget.sh` — новый bash-харнесс, покрывает 17 из 18 Auto TC (см. Task 7 SCOPE EXPANDED)
- `test/skills-static.sh` — расширен одной проверкой для TC-021 (не в исходном списке — добавлено вместе с TC-021 во время execution, см. Task 7)
- `test/fixtures/manual-budget-tc-001/` ... `test/fixtures/manual-budget-tc-020/` — fixture-issue для каждого TC
- `Makefile` — уже автоматически запускает test/*.sh, изменений не требует
- `docs/planning/tech-debt.md` — стандартный remnant-carry `/pf-codereview`'а (BR-5) для не-`fixed` находок ревью (CR-001/002/003, все `wont-fix`), не часть исходно объявленного скоупа этой issue

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
- [x] TC-020 pass — словарь ровно 5 значений в SKILL.md

---

### Task 2: Manual Budget — парсинг и валидация (bash, не Node)
**Task Type:** code
**Mapped Test Cases:** TC-006, TC-007, TC-008

**DEVIATION FROM ORIGINAL PLAN (recorded during /pf-execute):** исходный план предполагал новый `tools/manual-budget-validator.js`. Обнаружено, что в репозитории уже есть рабочий, протестированный bash-парсер Status Tracker по имени колонки — `_pf_status_tracker_rows`/`_pf_status_tracker_type_of` в `test/pf-execute-completeness.sh`. Дублировать эту логику в Node — лишняя поверхность и расхождение с конвенциями репо (vanilla bash test harness, ноль внешних зависимостей). Task 2 объединена с Task 4: обе решаются добавлением чистых bash-функций в `test/lib.sh`, переиспользующих существующий паттерн парсинга. Новый `.js`-файл не создаётся.

**Конвенция Manual reason (решение, зафиксированное здесь, т.к. ни brd.md, ни test_plan.md не специфицируют механику):** для строк со статусом `Manual` колонка `Remarks` Status Tracker обязана начинаться с `Manual reason: <value>` (значение — одно из 5 слов словаря), опционально с произвольным текстом после. Это переиспользует существующую колонку (без изменения структуры таблицы) и уже согласуется с тем, как Auto-строки в `Remarks` этого же test_plan.md несут `Harness: ...`.

**Files:**
- `test/lib.sh` — новые публичные функции (см. Task 4 ниже — этот таск и Task 4 реализуются одним проходом по одному файлу)

**Implementation Notes:**
- Опираться на существующий паттерн `_pf_status_tracker_rows`/`_pf_trim` (`test/pf-execute-completeness.sh`) — либо промоутировать их в `test/lib.sh` как публичные (без `_` префикса) и переиспользовать в обоих файлах, либо продублировать минимальный эквивалент в `test/lib.sh`, если промоушен рискует затронуть уже стабильный `pf-execute-completeness.sh`. Решение — на усмотрение исполнителя, с пометкой в summary.
- Валидация:
  - `Manual reason` обязателен для каждой `Manual`-строки
  - Значение должно быть из словаря (case-sensitive), ровно 5 значений: `human-judgment`, `external-system`, `interactive-agent`, `cost`, `environment`
  - Возвращает список ошибок или пустой результат (exit code)
- Обработка ошибок: отсутствующий Status Tracker — понятное сообщение, не падение с трассировкой

**Acceptance Criteria:**
- [x] TC-006 pass — 5 корректных значений принимаются, недопустимое отклоняется
- [x] TC-007 pass — некорректное значение отклоняется с списком допустимых
- [x] TC-008 pass — отсутствующее `Manual reason` отклоняется

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
- [x] TC-001, TC-002, TC-003 pass — бюджеты для small/medium/large соблюдаются, гейт не срабатывает
- [x] TC-004, TC-005 pass — потолок 5 срабатывает при 6+ Manual, сообщение содержит оба числа
- [x] TC-014 pass — ретроактивное применение бюджета на старой issue работает

---

### Task 4: Добавить test helpers в test/lib.sh для валидации и подсчёта
**Task Type:** code
**Mapped Test Cases:** TC-001, TC-006, TC-020 (helpers эти TC и проверяют напрямую; см. `~/.claude/skills/pf-execute/SKILL.md` Check 2 — каждый `code`-task обязан именовать хотя бы один реальный TC)

**Реализуется одним проходом вместе с Task 2 (см. DEVIATION там) — не отдельный вызов Node, чистый bash.**

**Files:**
- `test/lib.sh` — добавить новые функции в раздел Public API

**Implementation Notes:**
- Новые helpers, чистый bash, переиспользуют паттерн `_pf_status_tracker_rows`/`_pf_trim` из `test/pf-execute-completeness.sh` (см. Task 2 DEVIATION):
  - `pf_count_manual_in_tracker <test_plan_file>` — возвращает число `Manual`-строк в Status Tracker
  - `pf_validate_manual_reasons <test_plan_file>` — возвращает 0 (OK) или 1 (ошибки), выводит ошибки в stderr; проверяет, что `Remarks` каждой `Manual`-строки начинается с `Manual reason: <value>`, value ∈ словарь
  - `pf_get_manual_reason_vocab` — печатает 5 корректных значений, одно на строку
  - `pf_check_manual_budget <manual_count> <size_tier>` — возвращает 0 если в бюджете, 1 если превышение (бюджет: trivial 0-1, small ≤2, medium ≤3, large ≤5, hard cap 5 при любом tier)
  - `pf_get_budget_for_tier <size_tier>` — возвращает числовой бюджет (без учёта потолка)
  - `pf_validate_test_plan_structure <test_plan_file>` — проверяет, что Status Tracker существует и парсим

**Acceptance Criteria:**
- [x] Все helpers работают корректно и используются suite

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
- [x] TC-009 pass — механически проверяемые TC конвертированы в Auto с указанием конкретного harness
- [x] TC-010 pass — отсутствующий harness добавлен как задача в implementation_plan.md

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
- [x] TC-011 pass — вариант "Разбить issue" записан в test_plan.md
- [x] TC-012 pass — вариант "Поднять tier" с обоснованием записан, prompt.md обновлён, бюджет пересчитан
- [x] TC-013 pass — вариант "Отложить избыток" с примечанием записан

---

### Task 7: Создать bash test suite test/manual-budget.sh
**Task Type:** tests
**Mapped Test Cases:** TC-001, TC-002, TC-003, TC-004, TC-005, TC-006, TC-007, TC-008, TC-009, TC-010, TC-014, TC-015, TC-016, TC-017, TC-018, TC-019, TC-020

**SCOPE EXPANDED during execution (deviation):** исходный план мапил на этот таск только TC-015..019 — остальные Auto TC (001-010, 014, 020) были названы в Mapped Test Cases других тасков (что удовлетворяет Check 2), но реального bash-теста для них никто не писал. Это разрыв: 12 из 17 объявленных Auto TC не имели бы кода теста вообще. Исправлено здесь — этот таск покрывает ВСЕ Auto TC, кроме TC-021 (статическая grep-проверка текста `pf-check/SKILL.md`, добавляется отдельно в `test/skills-static.sh`, не сюда — другой файл, другой паттерн проверки).

**Files:**
- `test/manual-budget.sh` — новый файл, покрывает TC-001..010, TC-014..020 (17 Auto TC)
- `test/skills-static.sh` — добавить одну проверку для TC-021 (grep на упоминание "Manual test-case budget by tier" и `Manual reason` в секции "Claude review path" `skills/pf-check/SKILL.md`) — этот файл уже существует и уже содержит именно такие статические grep-проверки текста skill-файлов, см. его текущее содержимое для стиля

**Important — what "Auto" means here:** большинство этих TC (кроме TC-001..008, TC-020, которые прямо тестируют bash-helpers из Task 4 через `pf_setup_case`-фикстуры) описывают ПОВЕДЕНИЕ `/pf-test-plan`'s Step 4b/4c/4d (budget check / automation pass / gate) — реальный прогон этого шага требует LLM-суждения (сам automation pass — это диспатч суб-агента) и НЕ детерминирован для bash. Поэтому TC-009/010/014/016-019 тестируются иначе: против ЗАФИКСИРОВАННЫХ fixture test_plan.md, представляющих состояние "до" и "после" automation pass/гейта (созданы в Task 8), проверяются мехонические свойства — например, TC-016 ("успешная конвертация сохраняет логику") сравнивает, что суммарное число TC между "до" и "после" фикстурами не изменилось, изменился только `Type`/`Remarks`; TC-017/018/019 проверяют идемпотентность и корректность подсчёта через `pf_count_manual_in_tracker`/`pf_check_manual_budget` на разных фикстурах. Не пытаться реально диспатчить LLM sub-agent из bash-теста.

**Implementation Notes:**
- Bash test suite, следует conventions из test/lib.sh (S-1 … S-5)
- Для каждого TC:
  - Вывести заголовок: `printf '\n=== TC-NNN: [описание]\n'`
  - `pf_setup_case manual-budget-tc-NNN >/dev/null` — подготовить fixture (см. Task 8)
  - Выполнить нужные проверки, используя helpers из test/lib.sh: `pf_count_manual_in_tracker`, `pf_validate_manual_reasons`, `pf_get_manual_reason_vocab`, `pf_get_budget_for_tier`, `pf_check_manual_budget`, `pf_validate_test_plan_structure`
  - Вывести результаты: `pf_pass "сообщение"` или `pf_fail "сообщение"`
- TC-011, TC-012, TC-013 (Manual gate tests) не включены в bash suite — это ручные проверки логики AskUserQuestion
- Итоговый вывод: `pf_summary` (автоматический подсчёт pass/fail)
- Стандартные переменные и трапы: `TMP_WORK`, `TMP_HOME`, очистка при EXIT

**Acceptance Criteria:**
- [x] TC-001..010, TC-014..020 pass — все 17 Auto TC покрыты реальными assertions
- [x] TC-021 pass — grep-проверка добавлена в test/skills-static.sh
- [x] Suite запускается из Makefile (`make test`)
- [x] Финальный summary показывает 17 auto-tests passed в manual-budget.sh

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
- [x] Все fixtures готовы и загружены в test/fixtures/manual-budget-tc-*/, поддерживают выполнение TC-001 через TC-020 (Mapped Test Cases живёт у Task 7 по конвенции для `tests`-тасков; см. `~/.claude/skills/pf-execute/SKILL.md` Check 2b)
- [x] Suite успешно загружает каждый fixture с `pf_setup_case`
- [x] Тесты находят Status Tracker в каждом fixture

---

### Task 9: Документировать ручные тесты гейта для `/pf-manual-test`
**Task Type:** code
**Mapped Test Cases:** TC-011, TC-012, TC-013 (эти три Manual TC верифицируются через этот чеклист — прямая связь)

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
- [x] Инструкции ясны и воспроизводимы
- [x] Все три варианта гейта могут быть проверены вручную
- [x] manual_test_checklist.md интегрируется с `/pf-manual-test` (формат сверен с `tools/manual-test-ui/lib/checklist.js`'s парсером — `## TC-NNN:` заголовки, `**Prerequisites:**`/`**Test Data:**`/Steps-таблица с колонкой Result — совпадает)

---

### Task 10: Расширить `/pf-check` для проверки Manual-бюджета и закрытого словаря `Manual reason`
**Task Type:** code
**Mapped Test Cases:** TC-021 (новый TC, добавлен в test_plan.md во время execution — см. заметку ниже)

**Files:**
- `skills/pf-check/SKILL.md` — расширить prompt "Claude review path" (раздел, где проверяется oversized-for-tier)

**Implementation Notes:**
- В раздел "Claude review path" (после проверки на oversized-для-tier для test_plan.md) добавить новую логику:
  - Парсит `test_plan.md` (ищет Status Tracker)
  - Считает Manual-кейсы, сравнивает с бюджетом текущего tier (из `skills/pf-size-tiers/SKILL.md`)
  - Проверяет каждый Manual-TC на наличие `Manual reason` и его корректность (ровно 5 значений из словаря)
  - Если Manual-count > tier-budget ИЛИ Manual reason некорректен/отсутствует → добавить P1 finding с типом oversized/invalid, не проходить проверку дальше
  - Сообщение должно указывать: Manual-count, tier-budget, hard-cap (5), и список некорректных reasons (если есть)
- **Note on TC-021:** `test_plan.md` не содержал TC под это расширение — Task 10 появилась только после `/pf-check` на уже зафиксированном `implementation_plan.md`, когда `test_plan.md` уже прошёл собственный `/pf-check`. Добавлен `TC-021` (Auto, статическая grep-проверка формулировки в `skills/pf-check/SKILL.md` — не живой прогон ревью, т.к. это LLM-суждение, недетерминированное для bash-теста) напрямую в `test_plan.md` во время execution, чтобы `~/.claude/skills/pf-execute/SKILL.md`'s Check 2 (каждый `code`-task называет реальный TC) не блокировался фиктивной или отсутствующей связью.
- **DEVIATION (см. Task 2):** нет отдельного инструмента для вызова — "Claude review path" уже является текстовой инструкцией для LLM-ревьюера (не исполняемый скрипт), поэтому проверка формулируется как ещё один пункт того же промпта: ревьюер сам механически считает `Manual`-строки в Status Tracker и сверяет `Remarks` каждой на префикс `Manual reason: <value>` из словаря (см. `pf-size-tiers/SKILL.md`), точно так же, как он уже это делает для oversized-for-tier проверки строк/кейсов чуть выше в этом же промпте
- Проверка срабатывает для любого `test_plan.md` с таблицей Status Tracker, независимо от tier

**Acceptance Criteria:**
- [x] `/pf-check` флагирует превышение Manual-бюджета как P1 oversized finding
- [x] `/pf-check` флагирует некорректные/отсутствующие `Manual reason` как P1 invalid finding
- [x] Оба типа фактов верны: используется актуальная информация из pf-size-tiers
- [x] Проверка не срабатывает на test_plan.md без Status Tracker

