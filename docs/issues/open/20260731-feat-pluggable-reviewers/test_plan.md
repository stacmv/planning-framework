# Test Plan: Pluggable Reviewers (Claude / Codex) for Documents and Code

## Overview

Эта фича вводит поле `reviewers` во frontmatter `prompt.md` (выбор ревьюера —
`claude`/`codex`/`both` — отдельно для BRD, specs, test_plan,
implementation_plan и кода), гарду, которая один раз при создании issue
запрашивает этот выбор, единый механизм вызова Codex с цепочкой fallback на
Claude, расширение `pf-check` для ревью документов силами Codex/обоих
ревьюеров, и новый жёсткий гейт `pf-codereview` — стадию ревью кода между
`/pf-execute` и `/pf-test`.

## Scope decision — dogfooding instead of a formal manual test pass

Единственный пользователь этого framework — владелец проекта; отдельного
внешнего тестировщика нет. По решению владельца формальный ручной прогон
всех сценариев (создание issue, назначение ревьюера, вызов Codex, гейт
`pf-codereview`, предусловие `/pf-test`) не требуется перед закрытием этого
issue: поведение будет проверено в реальном использовании framework, и любые
найденные дефекты пойдут отдельными issue на исправление, а не блокируют
закрытие этого issue.

Единственный оставшийся тест-кейс — статическая проверка согласованности
(TC-001 ниже): она не требует ни ручного прогона, ни отдельной тестовой
машины, недорога и уже реализуема прямо сейчас чтением файлов.

## Objectives

- Убедиться, что сопоставление severity → приоритет (Codex → P0/P1/P2)
  задокументировано согласованно в `pf-check` и `pf-codereview` — то есть
  что второй скилл ссылается на первый, а не завёл собственное,
  потенциально расходящееся определение.

## Prerequisites

- Репозиторий содержит обновлённые `skills/pf-check/SKILL.md` и
  `skills/pf-codereview/SKILL.md`.

---

## Step 1: Identify Test Scenarios

Единственный оставшийся сценарий — статическая проверка согласованности
документации между двумя скиллами (без UI/UX, без ручного прогона).

---

## Step 2: Create Test Cases

### TC-001: Нормализация severity Codex → приоритеты P0/P1/P2

**Description:** Статическая проверка того, что соответствие severity
Codex-ответа (`critical`/`high` → P0, `medium` → P1, `low` → P2)
документировано согласованно в `pf-check` и `pf-codereview`, и что оба
скилла ссылаются на одно и то же сопоставление, а не переопределяют его
независимо.

**Preconditions:**
- Репозиторий содержит обновлённые `skills/pf-check/SKILL.md` и
  `skills/pf-codereview/SKILL.md`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Найти в `skills/pf-check/SKILL.md` описание сопоставления severity → приоритет | Присутствуют все три соответствия: critical/high → P0, medium → P1, low → P2 |
| 2 | Найти аналогичное описание в `skills/pf-codereview/SKILL.md` | Сопоставление то же самое (те же три пары), не переопределено иначе |
| 3 | Проверить упоминание, что сырой (неструктурированный) ответ `codex exec` не подвергается этому сопоставлению | Явно указано, что несхемный ответ показывается как есть, отдельным блоком, без приписывания P0/P1/P2 |

**Test Data:** none

**Expected Outcome:** Оба скилла согласованно документируют одно и то же
сопоставление severity → приоритет, без расхождений между документом и
кодом.

**Priority:** Medium

---

## Step 3: Organize by Category

### Document Review (pf-check / pf-codereview consistency)
- TC-001: Нормализация severity Codex → P0/P1/P2

(Все остальные ранее спланированные кейсы — назначение ревьюера при
создании issue, happy-path вызова Codex, агрегация `both`, жёсткость
гейта `pf-codereview`, предусловие `/pf-test`, обратная совместимость —
сняты из формального тест-плана по решению владельца: см. "Scope decision"
выше. Реализация не меняется, эти сценарии просто не верифицируются
формальным тестом перед закрытием этого issue.)

---

## Step 4: Create Status Tracker

## Status Tracker

| TC     | Test Case | Type   | Priority | Status | Remarks |
| ------ | --------- | ------ | -------- | ------ | ------- |
| TC-001 | Нормализация severity Codex → P0/P1/P2 | Auto | Medium | ✓ | Verified 2026-07-31: both skills document the same critical/high→P0, medium→P1, low→P2 mapping and both note the raw `codex exec` response is never passed through it. |
