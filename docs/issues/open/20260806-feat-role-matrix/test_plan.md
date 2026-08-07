# Test Plan: Матрица ролей write/review по стадиям issue
**Date:** 2026-08-07

## Overview

Эта фича не имеет UI: вся логика — резолвинг роли, автомиграция, режимы
ревью, делегирование записи неClaude-актору, опциональные стадии
документации — реализована как текст `pf-*` skill-файлов, интерпретируемый
LLM-агентом (оркестрирующей Claude Code сессией) во время реального прогона
`/pf`, `/pf-check`, `/pf-codereview`, `/pf-execute`, `/pf-user-docs`,
`/pf-dev-docs`, `/pf-qa`. Соответственно, у плана два рода проверок:

- **Structural (Auto)** — детерминированные grep/sed-проверки формы и
  порядка инструкций внутри самих skill-файлов, того же рода, что уже
  использует `test/skills-static.sh` для предыдущих фич этого проекта:
  воспроизводимы прогоном автоматического набора без участия LLM.
- **Behavioral (Manual)** — реальный прогон соответствующего `pf-*` скилла
  живой Claude Code сессией (в отдельных случаях — с реальным вызовом Codex
  через `codex-companion.mjs`) с наблюдением фактического результата: какой
  актор реально написал/отревьюил файл, какой вопрос реально задан через
  `AskUserQuestion`, какой маркер реально записан в `prompt.md`.

Цель прогона — подтвердить все девять пунктов Acceptance Criteria из
`brd.md`: резолвинг write/review по стадии независимо от совпадения
акторов; параллельный и последовательный режимы ревью; профили по
умолчанию и точечное переопределение; смена ролей посреди пайплайна без
переделки пройденных стадий; автомиграция `reviewers:` → `roles:` без
потери данных; явный пропуск необязательных стадий (кроме авторства кода)
с отображением в `/pf`; подтверждение и риск-строка при пропуске ревью
кода; две новые опциональные стадии документации с tier-дефолтом `skip`
для `trivial`/`small`; расширяемый реестр акторов.

Note: `prompt.md` этой issue (§«Приёмка») требует отклонять
`{write: codex, review: [codex]}` — это требование явно отменено в
`brd.md` (Non-Goals: «инвариант независимости не вводится»), поэтому план
**не** содержит теста на отклонение совпадающего write/review; наоборот,
TC-001 проверяет, что такая комбинация принимается без предупреждений, как
и решил BRD.

## Prerequisites

- Реализация по `specs.md` завершена: `skills/pf-roles/SKILL.md` существует;
  `skills/pf-brd`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`, `pf-execute`,
  `pf-check`, `pf-codereview`, `pf-qa`, `pf/SKILL.md` обновлены; новые
  `skills/pf-user-docs/SKILL.md`, `skills/pf-dev-docs/SKILL.md` существуют.
- Установленные копии синхронизированы (`/pf-update` или
  `scripts/update-skills.sh` прогнаны после реализации).
- Рабочее дерево `D:/dev/planning-framework` чистое; тестировщик имеет
  возможность запускать `/pf`, `/pf-check`, `/pf-codereview`, `/pf-execute`,
  `/pf-user-docs`, `/pf-dev-docs`, `/pf-qa` в реальной Claude Code сессии.
- Codex CLI и `codex-companion.mjs` доступны и настроены (нужны для TC-005,
  TC-012, TC-017) — без них эти три TC не воспроизводимы и должны быть
  помечены как blocked, а не пройдены/провалены.
- Тестировщик может создавать и удалять временные фикстур-issue под
  `docs/issues/open/zz-fixture-*/` — они не являются реальными issue
  проекта и удаляются сразу после соответствующего TC.
- `docs/planning/agents.yml` и `docs/planning/role-profiles.yml` для
  TC-006 должны отсутствовать в момент старта теста (переименовать/удалить
  перед прогоном, если уже созданы предыдущим тестом, и восстановить после).

## Test Cases

### Functional: role resolution, review modes, actor registry

### TC-001: Явные `roles:` — резолвинг write и review по стадии, включая совпадающего актора
**Description:** Стадия с явной записью `roles.<key>` резолвится ровно в тот `write` и тот `review`, что записаны, для нескольких стадий одновременно, включая случай, когда `write` и единственный элемент `review` — один и тот же актор (это разрешено по BRD Non-Goals).
**Type:** Manual
**Preconditions:** Фикстур-issue создана (см. Test Data), `docs/planning/agents.yml` содержит дефолтные акторы `claude`/`codex`.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В фикстур-issue задать `roles: { brd: {write: claude, review: [codex]}, specs: {write: codex, review: [codex]} }`. | Файл сохранён. |
| 2 | Запустить `/pf-brd` на фикстур-issue. | BRD пишет Claude напрямую (без делегирования), как и раньше; поведение не меняется. |
| 3 | Запустить `/pf-spec` на фикстур-issue (после BRD). | Спецификацию фактически пишет Codex через `codex-companion.mjs task ... --write`, а не оркестрирующая Claude-сессия; запись `{write: codex, review: [codex]}` не отклоняется и не выдаёт предупреждения. |
| 4 | Запустить `/pf-check` на `specs.md`. | Ревью выполняет Codex (`roles.specs.review == [codex]`), даже несмотря на совпадение с автором. |

**Test Data:**
- `docs/issues/open/zz-fixture-explicit-roles/prompt.md` (временная фикстура, создаётся тестировщиком: `size_tier: small`, `doc_language: Russian`, блок `roles:` из шага 1)

**Expected Outcome:** Обе стадии резолвятся строго по явной записи `roles.<key>`; совпадение write/review принимается без блокировки.
**Priority:** High

### TC-002: Fallback на профиль при отсутствии `roles:`, но наличии `profile:`
**Description:** Issue без блока `roles:`, но с `profile: codex-implements` резолвит каждую стадию через `role-profiles.yml`: `default` для стадий без точечного переопределения, точечная запись профиля — для `code`/`tests`/`user_docs`.
**Type:** Manual
**Preconditions:** `docs/planning/role-profiles.yml` содержит профиль `codex-implements` как в §4 `specs.md`.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Создать фикстур-issue с `profile: codex-implements` и без блока `roles:`. | Файл сохранён. |
| 2 | Запустить `/pf-brd`. | BRD резолвится через `default` профиля (`write: claude, review: [codex]`) — пишет Claude, ревьюит Codex. |
| 3 | Довести issue до стадии `code` (implementation plan с одной задачей достаточно). Запустить `/pf-execute`. | Код резолвится через точечную запись `code: {write: codex, review: [claude]}` — задачу реально пишет Codex. |

**Test Data:**
- `docs/issues/open/zz-fixture-profile-fallback/prompt.md` (временная фикстура: `profile: codex-implements`, без `roles:`)

**Expected Outcome:** Все стадии без точечной записи в `roles:` резолвятся через `default` профиля; стадии с точечной записью профиля (`code`, `tests`, `user_docs`) резолвятся именно через неё.
**Priority:** High

### TC-003: Fallback по умолчанию — ни `roles:`, ни `profile:` не заданы
**Description:** Issue совсем без `roles:`/`profile:` ведёт себя как до этой фичи: `write: claude` для всех ключей, `review` резолвится из старого `reviewers:`, если он есть, иначе `[claude]`.
**Type:** Manual
**Preconditions:** Ни `roles:`, ни `profile:`, ни `reviewers:` в фикстуре нет.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Создать фикстур-issue без `roles:`, `profile:` и `reviewers:` вовсе. | Файл сохранён. |
| 2 | Запустить `/pf-brd`. | BRD пишет Claude, поведение идентично поведению до этой issue. |
| 3 | Запустить `/pf-check` на `brd.md`. | Ревью выполняет только Claude (`review: [claude]`) — дефолт последнего уровня fallback. |

**Test Data:**
- `docs/issues/open/zz-fixture-no-roles-no-profile/prompt.md` (временная фикстура: `size_tier: small`, без `roles:`/`profile:`/`reviewers:`)

**Expected Outcome:** Поведение полностью совпадает с сегодняшним (pre-feature) поведением framework.
**Priority:** High

### TC-004: Параллельный режим ревью — объединение находок с тегами источника
**Description:** `roles.<key>.review: {mode: parallel, by: [claude, codex]}` (или короткая форма `[codex]`) даёт то же поведение, что сегодняшняя `both`-агрегация в `pf-check`: оба ревьюера проверяют один и тот же артефакт одновременно, находки объединяются с пометкой источника, без дедупликации.
**Type:** Manual
**Preconditions:** Фикстур-issue с готовым `specs.md`, `roles.specs.review: {mode: parallel, by: [claude, codex]}`.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-check` на `specs.md`. | Оба ревьюера получают идентичную версию `specs.md` как TARGET. |
| 2 | Прочитать итоговый отчёт ревью. | Находки Claude и находки Codex присутствуют одновременно, каждая помечена источником; ни одна находка не потеряна из-за дедупликации/арбитража. |

**Test Data:**
- `docs/issues/open/zz-fixture-parallel-review/specs.md` (временная фикстура — любой валидный черновик спецификации, достаточно 1-2 страниц, с минимум одной подставной проблемой, которую однозначно найдёт ревью)
- `docs/issues/open/zz-fixture-parallel-review/prompt.md` (та же временная фикстура: `roles.specs.review` как в Preconditions)

**Expected Outcome:** Поведение совпадает с сегодняшней `both`-логикой один в один; регрессии нет.
**Priority:** High

### TC-005: Последовательный режим ревью — цепочка с автоприменением фиксов
**Description:** `roles.<key>.review: {mode: sequential, by: [haiku, codex]}` — первый ревьюер находит проблемы, актор `write` этой стадии применяет фиксы автоматически (без запроса подтверждения у пользователя), затем исправленный артефакт уходит второму ревьюеру. Финальный отчёт показывает оба прохода отдельными блоками `[<actor>, pass N]`, включая уже исправленные находки с пометкой `(fixed before next reviewer)`.
**Type:** Manual
**Preconditions:** Фикстур-issue с `specs.md`, содержащим намеренно внесённую проблему, которую первый ревьюер (`haiku`) точно найдёт (например явное противоречие двух абзацев); `roles.specs: {write: claude, review: {mode: sequential, by: [haiku, codex]}}`.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-check` на `specs.md`. | `haiku` ревьюит первым и находит внесённую проблему. |
| 2 | Дождаться завершения прохода `haiku`. | Findings `haiku` автоматически передаются актору `write` (Claude), который применяет фикс **без** отдельного запроса подтверждения у пользователя; `specs.md` перечитывается с диска. |
| 3 | Проверить, что `codex` получает уже исправленную версию. | `codex` ревьюит версию файла ПОСЛЕ фикса, не оригинал. |
| 4 | Прочитать финальный отчёт. | Содержит два блока `[haiku, pass 1]` и `[codex, pass 2]`; находка `haiku` из pass 1 присутствует с пометкой `(fixed before next reviewer)`. |

**Test Data:**
- `docs/issues/open/zz-fixture-sequential-review/specs.md` (временная фикстура с намеренно внесённым, легко обнаружимым дефектом)
- `docs/issues/open/zz-fixture-sequential-review/prompt.md` (та же временная фикстура: `roles.specs.review` как в Preconditions)

**Expected Outcome:** Цепочка проходит без промежуточного вопроса пользователю; итоговый документ отражает исправление от первого прохода; отчёт различает оба прохода.
**Priority:** High

### TC-006: Реестр акторов и профилей — автосоздание при первом обращении
**Description:** Если `docs/planning/agents.yml` и/или `docs/planning/role-profiles.yml` ещё не существуют в проекте, первый `pf-*` скилл, которому нужен резолвинг актора/профиля, создаёт их со стандартным дефолтным содержимым из `specs.md` §3/§4, без вопроса пользователю.
**Type:** Manual
**Preconditions:** `docs/planning/agents.yml` и `docs/planning/role-profiles.yml` отсутствуют (переименованы/удалены перед тестом, см. Prerequisites).
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Убедиться, что обоих файлов нет. | `ls docs/planning/agents.yml docs/planning/role-profiles.yml` — оба отсутствуют. |
| 2 | Запустить любой `pf-*` скилл, которому нужен резолвинг роли (например `/pf` на issue с `profile:`). | Скилл не спрашивает пользователя о создании файлов. |
| 3 | Прочитать созданные файлы. | `agents.yml` содержит `actors: {claude, haiku, codex, gemini}` как в `specs.md` §3; `role-profiles.yml` содержит минимум три профиля (`solo-claude`, `claude-writes-codex-reviews`, `codex-implements`) как в §4. |

**Test Data:**
- `docs/planning/agents.yml` (ожидаемое итоговое содержимое — эталон для сравнения, см. `specs.md` §3)
- `docs/planning/role-profiles.yml` (ожидаемое итоговое содержимое — эталон для сравнения, см. `specs.md` §4)

**Expected Outcome:** Оба файла созданы автоматически с корректным дефолтным содержимым при первом обращении, без вмешательства пользователя.
**Priority:** Medium

### TC-007: Единственный вопрос выбора профиля при создании issue
**Description:** `skills/pf/SKILL.md`, "Creating prompt.md" — сразу после вопроса про `size_tier` задаётся ровно один дополнительный вопрос о профиле, со списком имён из `role-profiles.yml` и рекомендацией `solo-claude`. Существующий отдельный reviewer-assignment guard не задаётся повторно для issue, получившей `profile:` этим вопросом.
**Type:** Manual
**Preconditions:** Новая issue создаётся через `/pf` с нуля (без `prompt.md`, либо `prompt.md` без `size_tier`/`profile`).
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf` для создания новой issue, ответить на вопрос про `size_tier`. | Сразу следующим — вопрос "Какой профиль ролей использовать?" со списком профилей и `solo-claude`, рекомендованным как «сегодняшнее поведение». |
| 2 | Ответить, выбрав `claude-writes-codex-reviews`. | `profile: claude-writes-codex-reviews` записан в frontmatter `prompt.md`, рядом с `size_tier`. |
| 3 | Дойти до стадии, где раньше задавался отдельный reviewer-assignment guard ("кто ревьюит каждый документ"). | Этот вопрос **не** задаётся повторно — профиль уже покрывает и write, и review. |

**Test Data:** не требуются (создаётся штатная новая issue средствами `/pf`, без готовых фикстур)

**Expected Outcome:** Ровно один дополнительный вопрос о профиле; никакого дублирующего guard-вопроса для issue с уже заданным `profile:`.
**Priority:** High

### TC-008: Смена профиля/ролей посреди пайплайна затрагивает только непройденные стадии
**Description:** Ручная правка `roles:`/`profile:` в `prompt.md` посреди уже идущего пайплайна подхватывается со следующего запуска любого `pf-*` скилла (кэша резолвинга нет), но не переделывает уже пройденные стадии и не портит их результат.
**Type:** Manual
**Preconditions:** Фикстур-issue, у которой `brd.md` и `specs.md` уже завершены с профилем `solo-claude`.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Убедиться, что `brd.md`/`specs.md` уже существуют и полны (стадии BRD, SPEC пройдены). | `/pf` показывает их как Completed. |
| 2 | Вручную поменять `profile: solo-claude` на `profile: codex-implements` в `prompt.md`. | Файл сохранён без запуска какого-либо скилла смены профиля — отдельного скилла для этого нет (см. `specs.md` §4.1). |
| 3 | Запустить `/pf-test-plan`, затем довести до `code`-задачи через `/pf-execute`. | Новый профиль применяется к ещё не пройденным стадиям (`code` реализует Codex). |
| 4 | Перечитать `brd.md`/`specs.md`. | Содержимое не изменилось; стадии BRD/SPEC не переделываются задним числом. |

**Test Data:**
- `docs/issues/open/zz-fixture-mid-pipeline-switch/prompt.md` (временная фикстура с уже пройденными BRD/SPEC под `profile: solo-claude`)
- `docs/issues/open/zz-fixture-mid-pipeline-switch/brd.md`, `specs.md` (готовые, минимальные, для контроля неизменности на шаге 4)

**Expected Outcome:** Новый профиль/роли действуют только для стадий после точки правки; уже готовые документы не тронуты.
**Priority:** High

### TC-009: `pf-roles` reference-skill — структурная полнота (static)
**Description:** `skills/pf-roles/SKILL.md` — reference-скилл (как `pf-git`/`pf-size-tiers`), не вызывается напрямую, но содержит все элементы, перечисленные в `specs.md` §11: схему `roles:`/`profile:`, схему `agents.yml`/`role-profiles.yml`, полный порядок fallback (явная запись → профиль → tier-дефолт `skip` для доков → общий дефолт), описание автомиграции, механику `sequential`-режима — и на него реально ссылаются все перечисленные потребители.
**Type:** Auto
**Preconditions:** Реализация завершена.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `grep -n "roles:" skills/pf-roles/SKILL.md` и `grep -n "agents.yml\|role-profiles.yml" skills/pf-roles/SKILL.md`. | Обе схемы задокументированы. |
| 2 | `grep -iE "явная запись.*профил|profile.*tier.*default|fallback" skills/pf-roles/SKILL.md`. | Порядок fallback описан целиком, всеми четырьмя уровнями. |
| 3 | `grep -iE "sequential" skills/pf-roles/SKILL.md`. | Механика последовательного режима описана. |
| 4 | Для каждого из `pf`, `pf-brd`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`, `pf-check`, `pf-codereview`, `pf-execute`, `pf-user-docs`, `pf-dev-docs`, `pf-qa`: `grep -l "pf-roles/SKILL.md" skills/<name>/SKILL.md`. | Все одиннадцать скиллов ссылаются на `pf-roles/SKILL.md`. |

**Test Data:**
- `skills/pf-roles/SKILL.md`
- `skills/pf/SKILL.md`, `skills/pf-brd/SKILL.md`, `skills/pf-spec/SKILL.md`, `skills/pf-test-plan/SKILL.md`, `skills/pf-impl-plan/SKILL.md`, `skills/pf-check/SKILL.md`, `skills/pf-codereview/SKILL.md`, `skills/pf-execute/SKILL.md`, `skills/pf-user-docs/SKILL.md`, `skills/pf-dev-docs/SKILL.md`, `skills/pf-qa/SKILL.md`

**Expected Outcome:** `pf-roles/SKILL.md` — единая точка резолвинга, и все потребители реально на неё ссылаются, а не дублируют алгоритм у себя.
**Priority:** Medium

### Migration/backward-compat tests

### TC-010: Автомиграция `reviewers:` → `roles:` через `/pf`, без потери данных
**Description:** Issue со старым `reviewers:` и без `roles:` при первом обращении через `/pf` автоматически переводится на новую схему: `write: claude` для каждого перенесённого ключа, `review` — список из старого значения (`both` → `[claude, codex]`), старый блок `reviewers:` удаляется целиком, без вопроса пользователю.
**Type:** Manual
**Preconditions:** Issue с `reviewers:` в frontmatter, без `roles:`. Собственный `prompt.md` этой issue (`20260806-feat-role-matrix`) на момент написания этого плана уже является таким кандидатом (`reviewers: {brd: codex, specs: codex, test_plan: codex, implementation_plan: both, code: both}`) — годится как реальные Test Data, при условии что к моменту прогона TC он ещё не мигрирован ручной правкой.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Зафиксировать содержимое `reviewers:` до прогона. | `implementation_plan: both`, `code: both`, остальные — `codex`. |
| 2 | Запустить `/pf` (Step 2, до Step 4). | Скилл выполняет автомиграцию для этой issue как часть сканирования `docs/issues/open/`, до перехода к Step 4. |
| 3 | Прочитать `prompt.md` после прогона. | Появился блок `roles:` с `brd: {write: claude, review: [codex]}`, `implementation_plan: {write: claude, review: [claude, codex]}`, `code: {write: claude, review: [claude, codex]}` и т.д.; блок `reviewers:` полностью удалён, не оставлен рядом. |
| 4 | Проверить git-историю правки. | Правка `prompt.md` закоммичена как часть staged-путей следующего шага пайплайна, который писал в эту issue, — не отдельным самостоятельным коммитом ради самой миграции. |

**Test Data:**
- `docs/issues/open/20260806-feat-role-matrix/prompt.md` (реальный, содержит `reviewers:` на момент написания плана — либо, если уже мигрирован раньше, временная фикстура `docs/issues/open/zz-fixture-migration/prompt.md` с эквивалентным `reviewers:` блоком)

**Expected Outcome:** Конверсия детерминирована, без вопросов пользователю; ни один старый ревьюер не потерян; `both` корректно разворачивается в `[claude, codex]`.
**Priority:** Critical

### TC-011: Автомиграция — собственное предусловие `pf-check`/`pf-codereview` при прямом вызове
**Description:** `/pf-check` и `/pf-codereview`, вызванные напрямую на legacy issue (в обход `/pf`, в том числе из `/pf-autopilot`), сами выполняют ту же автомиграционную проверку как собственный первый шаг — до резолвинга `roles.<key>` — а не полагаются на то, что `/pf` уже прошёлся по этой issue.
**Type:** Manual
**Preconditions:** Свежая фикстур-issue с `reviewers:` и без `roles:`, к которой `/pf` **ни разу не обращался** (это ключевое условие — сценарий именно "в обход /pf").
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Создать фикстур-issue с `reviewers: {specs: codex}` и валидным `specs.md`, не запуская `/pf` на ней вообще. | `roles:` в frontmatter отсутствует. |
| 2 | Запустить `/pf-check` напрямую на `specs.md` этой issue. | Перед резолвингом `roles.specs` скилл сам обнаруживает `reviewers:` без `roles:` и выполняет конверсию (тот же алгоритм §5), затем резолвит `roles.specs.review == [codex]` из только что созданной записи. |
| 3 | Прочитать `prompt.md` после прогона. | `roles:` появился, `reviewers:` удалён — идентично результату TC-010, но выполнено самим `pf-check`, а не `/pf`. |

**Test Data:**
- `docs/issues/open/zz-fixture-direct-invocation/prompt.md` (временная фикстура: `reviewers: {specs: codex}`, без `roles:`)
- `docs/issues/open/zz-fixture-direct-invocation/specs.md` (минимальный валидный черновик)

**Expected Outcome:** Автомиграция происходит независимо от того, был ли до этого вызван `/pf` — прямой вызов `/pf-check`/`/pf-codereview` на legacy issue не спотыкается об отсутствие `roles:`.
**Priority:** High

### Integration tests: pf-execute delegation, pipeline routing

### TC-012: `pf-execute` делегирует задачу актору-неClaude (`code.write: codex`)
**Description:** Ключевой сквозной сценарий Acceptance Criteria #1 и User Story 10: issue с `roles.code.write: codex` реализуется фактически Codex'ом (реальная запись в файлы через `codex-companion.mjs task ... --write`), а не Claude-субагентом — распределение ролей в конфиге соответствует наблюдаемому поведению, а не остаётся записью на бумаге.
**Type:** Manual
**Preconditions:** Фикстур-issue с готовым `implementation_plan.md`, содержащим одну простую, однозначно verifiable задачу (например создать файл с заданным содержимым); `roles.code: {write: codex, review: [claude]}`.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-execute`. | Перед выполнением задачи скилл резолвит `roles.code` → `write: codex`. |
| 2 | Наблюдать вызов. | `pf-execute` **не** диспетчерит Claude-субагента через `Agent` tool для этой задачи; вместо этого вызывается `codex-companion.mjs task "<prompt>" --write` с промптом, нацеленным на ту же задачу/файл. |
| 3 | Проверить результат в репозитории. | Файл из задачи реально создан/изменён так, как предписывала задача; `git log`/diff показывают правку, сделанную в рамках этого вызова. |
| 4 | Проверить коммит волны. | `git add -A` на границе волны (см. `pf-git`) закоммитил фактически записанное Codex'ом, тем же путём, что и при write:claude — волновая структура не изменилась. |

**Test Data:**
- `docs/issues/open/zz-fixture-execute-codex/implementation_plan.md` (временная фикстура: одна простая задача с однозначно проверяемым результатом)
- `docs/issues/open/zz-fixture-execute-codex/prompt.md` (та же временная фикстура: `roles.code.write: codex`)

**Expected Outcome:** Реализацию задачи фактически выполняет Codex, что видно по наблюдаемому вызову и по факту записи; конфиг соответствует реальности.
**Priority:** Critical

### TC-013: `pf-execute` — регрессия для `write: claude` не появилась
**Description:** Для задач с `roles.code.write: claude` (или отсутствием `roles.code` вовсе, при дефолте) `pf-execute` продолжает диспетчерить обычного Claude-субагента через `Agent` tool, без изменений в сегодняшнем поведении.
**Type:** Manual
**Preconditions:** Фикстур-issue аналогична TC-012, но `roles.code.write: claude` (или `roles` не задан вовсе).
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-execute` с `write: claude`. | `pf-execute` резолвит `write == claude`. |
| 2 | Наблюдать вызов. | Диспетчеризация происходит через `Agent` tool на Claude-субагента, как сегодня — без обращения к `codex-companion.mjs`. |

**Test Data:**
- `docs/issues/open/zz-fixture-execute-claude/implementation_plan.md` (та же простая задача, что в TC-012, для сравнимости)
- `docs/issues/open/zz-fixture-execute-claude/prompt.md` (та же фикстура: `roles.code.write: claude` или `roles` отсутствует)

**Expected Outcome:** Поведение для `write: claude` идентично поведению до этой issue.
**Priority:** Medium

### TC-014: Маршрутизация пайплайна — `user_docs`/`dev_docs` между TESTING и QA (static)
**Description:** `skills/pf/SKILL.md` — таблицы feat/improve/bug (Step 6) и статусный блок Completed stages (Step 5) — содержат новые строки `user_docs`/`dev_docs` строго между строкой TESTING и строкой QA, с учётом `skip`.
**Type:** Auto
**Preconditions:** Реализация Step 6/Step 5 `pf/SKILL.md` завершена.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `grep -n "TESTING\|user_docs\|dev_docs\|^.*QA" skills/pf/SKILL.md` (feat/improve таблица). | Строки идут в порядке TESTING → user_docs → dev_docs → QA, без перестановок. |
| 2 | То же для bug-таблицы. | Тот же порядок. |
| 3 | `grep -iE "skipped.*roles\.(user_docs\|dev_docs)" skills/pf/SKILL.md`. | Формат отображения пропуска (`skipped (roles.user_docs: skip)`) задокументирован дословно, как в `specs.md` §8. |

**Test Data:**
- `skills/pf/SKILL.md`

**Expected Outcome:** Обе новые стадии корректно встроены в маршрутизацию во всех типах issue, с явной обработкой `skip`.
**Priority:** High

### TC-015: `pf-qa` prerequisite — требует `user_docs.md`/`dev_docs.md`, если стадия не `skip`
**Description:** `/pf-qa` расширяет prerequisite-проверку: для каждой из `user_docs`/`dev_docs`, которая не помечена `skip`, требуется существующий и непустой `user_docs.md`/`dev_docs.md`; при отсутствии — блокирующее сообщение того же вида, что сегодня для `manual_test_checklist.md`.
**Type:** Manual
**Preconditions:** Фикстур-issue дошла до стадии QA, `roles.user_docs` не `skip`, но `user_docs.md` физически отсутствует.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Убедиться, что `roles.user_docs` не `skip`, а файл `user_docs.md` отсутствует. | Предусловие сценария выполнено. |
| 2 | Запустить `/pf-qa`. | Скилл останавливается с сообщением вида "User docs is not complete. Run /pf-user-docs first." — тем же паттерном, что и для отсутствующего `manual_test_checklist.md`, не проходит дальше. |
| 3 | Запустить `/pf-user-docs`, затем повторить `/pf-qa`. | На этот раз prerequisite выполнен, `/pf-qa` идёт дальше. |
| 4 | Повторить шаги 1-3 для `dev_docs`/`pf-dev-docs`. | Идентичное поведение для второй новой стадии. |

**Test Data:**
- `docs/issues/open/zz-fixture-qa-prereq/prompt.md` (временная фикстура: `roles.user_docs`/`roles.dev_docs` не `skip`, дошла до стадии QA всеми предыдущими стадиями)

**Expected Outcome:** `/pf-qa` не проходит дальше без `user_docs.md`/`dev_docs.md`, если соответствующая стадия не объявлена пропущенной; после прогона `pf-user-docs`/`pf-dev-docs` — проходит.
**Priority:** High

### Edge case tests: skip confirmation gating, missing/oversized registry

### TC-016: `code.review: skip` — подтверждение через `/pf` в момент установки роли
**Description:** Когда пользователь устанавливает `roles.code.review: skip` (при создании issue или ручной правкой `prompt.md`, обнаруженной на следующем запуске `/pf`), `/pf` спрашивает подтверждение через `AskUserQuestion` ("Ревью кода для этой issue отключено — подтвердить?") и, получив "да", записывает `confirmed: <дата>` рядом с `roles.code.review: skip` в frontmatter `prompt.md`.
**Type:** Manual
**Preconditions:** Фикстур-issue, в которой пользователь только что вручную вписал `roles.code.review: skip` без `confirmed:`, и после этого запускает `/pf`.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Вручную вписать `code: {write: claude, review: skip}` (без `confirmed:`) в `prompt.md`. | Файл сохранён. |
| 2 | Запустить `/pf`. | `/pf` обнаруживает `roles.code.review: skip` без `confirmed:` и задаёт вопрос через `AskUserQuestion`: "Ревью кода для этой issue отключено — подтвердить?". |
| 3 | Ответить "да". | `prompt.md` получает `confirmed: 2026-08-07` (сегодняшняя дата) рядом с `roles.code.review: skip`, форма записи как в `specs.md` §2 (`code: { write: claude, review: skip, confirmed: <дата> }`). |

**Test Data:**
- `docs/issues/open/zz-fixture-skip-confirm-pf/prompt.md` (временная фикстура: `code.review: skip` без `confirmed:`)

**Expected Outcome:** Подтверждение запрашивается один раз, в момент обнаружения, и маркер записывается в правильном месте и формате.
**Priority:** Critical

### TC-017: `code.review: skip` — `pf-codereview` сам запрашивает подтверждение при ручной правке в обход `/pf`
**Description:** Если `code.review: skip` попал в `prompt.md` в обход `/pf` (например, `/pf-codereview` вызван напрямую сразу после ручной правки, без промежуточного запуска `/pf`) — и к моменту, когда `/pf-codereview` доходит до этой роли, `confirmed:` ещё нет, тот же вопрос задаёт и тот же маркер записывает сам `pf-codereview`, прежде чем продолжить.
**Type:** Manual
**Preconditions:** Фикстур-issue, аналогичная TC-016, но `/pf-codereview` запускается напрямую, минуя `/pf`.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Вручную вписать `code: {write: claude, review: skip}` (без `confirmed:`) в `prompt.md`. | Файл сохранён, `/pf` не запускается. |
| 2 | Запустить `/pf-codereview` напрямую. | Скилл проверяет наличие `confirmed:` рядом с `roles.code.review: skip`; не найдя его, сам задаёт тот же вопрос через `AskUserQuestion`. |
| 3 | Ответить "да". | `prompt.md` получает `confirmed: <дата>`, `pf-codereview` не запускает ревью, записывает в `code_review.md` `verdict: SKIPPED (roles.code.review: skip, confirmed <дата>)`, не блокирует переход к `/pf-test`. |

**Test Data:**
- `docs/issues/open/zz-fixture-skip-confirm-direct/prompt.md` (временная фикстура: `code.review: skip` без `confirmed:`)

**Expected Outcome:** Подтверждение и запись маркера происходят идентично TC-016, даже если `/pf-codereview` вызван напрямую, а не через `/pf`.
**Priority:** High

### TC-018: `code.review: skip` — строка риска в `qa_report.md`
**Description:** Когда `roles.code.review == skip` для issue (с уже записанным `confirmed:`), `/pf-qa` безусловно добавляет информационную строку риска в `qa_report.md`; строка не блокирует `PASS`-вердикт сама по себе.
**Type:** Manual
**Preconditions:** Фикстур-issue дошла до стадии QA с `code: {write: claude, review: skip, confirmed: 2026-08-01}`.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-qa` на такой issue (все прочие QA-проверки — PASS). | `qa_report.md` создан. |
| 2 | Прочитать `qa_report.md`. | Содержит строку `⚠ Risk: code review was skipped for this issue (roles.code.review: skip, confirmed 2026-08-01). No independent review of the implementation exists.` (или эквивалентную по смыслу). |
| 3 | Проверить итоговый вердикт. | Наличие этой risk-строки само по себе не превращает `PASS` в `FAIL` — вердикт определяется прочими QA-проверками, как и для остальных risk-строк. |

**Test Data:**
- `docs/issues/open/zz-fixture-qa-skip-risk/prompt.md` (временная фикстура: `code.review: skip, confirmed: 2026-08-01`, дошла до стадии QA)

**Expected Outcome:** Риск явно виден в `qa_report.md` и не тихий; вердикт не блокируется автоматически только из-за этой строки.
**Priority:** Medium

### TC-019: Tier-дефолт `skip` для `user_docs`/`dev_docs` при `trivial`/`small`
**Description:** Для issue с `size_tier: trivial` или `size_tier: small`, у которых `roles.user_docs`/`roles.dev_docs` не заданы явно (и профиль их тоже не переопределяет), обе стадии резолвятся в `skip` по умолчанию — это последний уровень fallback, после профиля.
**Type:** Manual
**Preconditions:** Фикстур-issue с `size_tier: small`, без `roles.user_docs`/`roles.dev_docs` и без `profile:`, переопределяющего их.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Создать фикстур-issue с `size_tier: small`, без явных `roles.user_docs`/`roles.dev_docs`. | Файл сохранён. |
| 2 | Довести issue до маршрутизации между TESTING и QA, запустить `/pf`. | Статусный блок показывает `user_docs`/`dev_docs` как `skipped` (tier-дефолт), не как следующий шаг. |
| 3 | Запустить `/pf-qa`. | Prerequisite-проверка для `user_docs.md`/`dev_docs.md` **не** блокирует переход — обе стадии считаются пропущенными по дефолту тира. |
| 4 | Повторить с `size_tier: medium` на отдельной фикстуре (тот же набор ролей). | Для `medium` дефолт — **не** `skip`, а `write: claude, review: [claude]` (общий дефолт после tier-уровня fallback); `/pf` показывает стадию как следующий шаг, а не как пропущенную. |

**Test Data:**
- `docs/issues/open/zz-fixture-tier-skip-small/prompt.md` (временная фикстура: `size_tier: small`, без `roles.user_docs`/`dev_docs`)
- `docs/issues/open/zz-fixture-tier-skip-medium/prompt.md` (временная фикстура: `size_tier: medium`, без `roles.user_docs`/`dev_docs`, для контраста на шаге 4)

**Expected Outcome:** `trivial`/`small` по умолчанию пропускают обе стадии документации; `medium`/`large` — нет.
**Priority:** Medium

### TC-020: Отсутствующий актор в реестре / `kind: human` — явная ошибка, не необработанное исключение
**Description:** Резолвер актора, столкнувшись с `kind: human` в `agents.yml` (заготовка на будущее — см. BRD Non-Goals), обязан явно завершаться понятной ошибкой ("actor '<name>' is kind: human — not supported until 20260806-improve-project-explorer-redesign"), а не падать необработанным исключением или тихо игнорировать роль.
**Type:** Manual
**Preconditions:** `docs/planning/agents.yml` временно дополнен записью `reviewer_human: { kind: human, inbox: project-explorer }`; фикстур-issue ссылается на этого актора в `roles.<key>.review`.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Добавить в `agents.yml` запись `reviewer_human: {kind: human, inbox: project-explorer}` (временно, откатить после теста). | Файл сохранён. |
| 2 | В фикстур-issue задать `roles.specs.review: [reviewer_human]`. | Файл сохранён. |
| 3 | Запустить `/pf-check` на `specs.md` этой issue. | Резолвер явно останавливается с сообщением вида "actor 'reviewer_human' is kind: human — not supported until 20260806-improve-project-explorer-redesign"; сессия не падает необработанным исключением и не продолжает молча без ревью. |

**Test Data:**
- `docs/planning/agents.yml` (временно дополненный записью `kind: human`, откатить после теста)
- `docs/issues/open/zz-fixture-kind-human/prompt.md` (временная фикстура: `roles.specs.review: [reviewer_human]`)
- `docs/issues/open/zz-fixture-kind-human/specs.md` (минимальный валидный черновик)

**Expected Outcome:** Понятная, предсказуемая ошибка вместо падения; формат реестра не потребовал переделки резолвера для появления `human`.
**Priority:** Low

## Status Tracker

| TC     | Test Case | Type   | Priority | Status | Remarks |
| ------ | --------- | ------ | -------- | ------ | ------- |
| TC-001 | Явные `roles:` — резолвинг write/review, включая совпадающего актора | Manual | High | [ ] | |
| TC-002 | Fallback на профиль при отсутствии `roles:` | Manual | High | [ ] | |
| TC-003 | Fallback по умолчанию без `roles:`/`profile:` | Manual | High | [ ] | |
| TC-004 | Параллельный режим ревью | Manual | High | [ ] | |
| TC-005 | Последовательный режим ревью с автоприменением фиксов | Manual | High | [ ] | |
| TC-006 | Автосоздание `agents.yml`/`role-profiles.yml` при первом обращении | Manual | Medium | [ ] | |
| TC-007 | Единственный вопрос выбора профиля при создании issue | Manual | High | [ ] | |
| TC-008 | Смена профиля/ролей посреди пайплайна — только непройденные стадии | Manual | High | [ ] | |
| TC-009 | `pf-roles` reference-skill — структурная полнота | Auto | Medium | ✓ | |
| TC-010 | Автомиграция `reviewers:` → `roles:` через `/pf`, без потери данных | Manual | Critical | [ ] | |
| TC-011 | Автомиграция как собственное предусловие `pf-check`/`pf-codereview` | Manual | High | [ ] | |
| TC-012 | `pf-execute` делегирует задачу Codex как write-актору | Manual | Critical | [ ] | |
| TC-013 | `pf-execute` — регрессия для `write: claude` не появилась | Manual | Medium | [ ] | |
| TC-014 | Маршрутизация пайплайна — `user_docs`/`dev_docs` между TESTING и QA | Auto | High | ✓ | |
| TC-015 | `pf-qa` prerequisite — требует `user_docs.md`/`dev_docs.md`, если не `skip` | Manual | High | [ ] | |
| TC-016 | `code.review: skip` — подтверждение через `/pf` | Manual | Critical | [ ] | |
| TC-017 | `code.review: skip` — `pf-codereview` сам запрашивает подтверждение | Manual | High | [ ] | |
| TC-018 | `code.review: skip` — строка риска в `qa_report.md` | Manual | Medium | [ ] | |
| TC-019 | Tier-дефолт `skip` для `user_docs`/`dev_docs` при `trivial`/`small` | Manual | Medium | [ ] | |
| TC-020 | Отсутствующий актор в реестре / `kind: human` — явная ошибка | Manual | Low | [ ] | |

## Known Issues

| Issue | Description | TC Affected | Steps to Reproduce | Severity |
| ----- | ----------- | ----------- | ------------------ | -------- |
|       |             |             |                     |          |
