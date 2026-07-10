// Regression test: pf-test generates checklists in the issue's doc_language
// (e.g. Russian) — the parser must recognize localized section labels and the
// Result column, not only the English ones.
// Run: node test/checklist-ru.test.js
"use strict";
const assert = require("assert");
const { parseChecklist, summarize } = require("../lib/checklist");

const RU_FIXTURE = `# Чек-лист ручного тестирования

**Название функции:** Пример
**Issue ID:** 20260101-feat-example

## TC-001: Пример русского тест-кейса

**Предварительные условия:**
- Приложение запущено.

**Шаги:**

| Шаг | Действие | Ожидаемый результат | Результат |
|------|--------|-----------------|--------|
| 1 | Открыть главную страницу | Страница открылась | [ ] |
| 2 | Нажать кнопку | Кнопка нажалась | [x] прошло |

**Заметки:** (оставьте пустым)

## TC-002: English test case still works

**Prerequisites:**
- App is running.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Open the page | Page opens | [ ] |

**Notes:**
`;

const parsed = parseChecklist(RU_FIXTURE);
const tcs = parsed.tcs;
assert.strictEqual(tcs.length, 2, `expected 2 TCs, got ${tcs.length}`);

const ru = tcs.find((t) => t.id === "TC-001");
assert.ok(ru, "TC-001 not parsed");
assert.strictEqual(ru.steps.length, 2, `RU steps: expected 2, got ${ru.steps.length}`);
assert.strictEqual(ru.prerequisites.length, 1, `RU prereqs: expected 1, got ${ru.prerequisites.length}`);
assert.strictEqual(ru.steps[1].checked, true, "RU step 2 must be checked");
assert.strictEqual(ru.parseWarnings.length, 0, `RU warnings: ${ru.parseWarnings.join("; ")}`);

const en = tcs.find((t) => t.id === "TC-002");
assert.strictEqual(en.steps.length, 1, `EN steps: expected 1, got ${en.steps.length}`);

const sum = summarize(parsed);
assert.strictEqual(sum.totalSteps, 3, `totalSteps: expected 3, got ${sum.totalSteps}`);
assert.strictEqual(sum.passedSteps, 1, `passedSteps: expected 1, got ${sum.passedSteps}`);

console.log("OK: checklist-ru.test.js — 2 TCs, RU+EN parsed, " + sum.totalSteps + " steps");
