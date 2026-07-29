// TC-018 step 1 — the checklist parser must classify a TC's data need into
// exactly three states before any visibility rule is applied:
//   declared — data is needed and its paths are listed
//   none     — explicitly marked as needing no data
//   unknown  — legacy TC written before the feature existed
// "unknown" must be a distinct string, never undefined and never "none":
// legacy issues must not look like "we know this needs nothing".
// Steps 2-7 of TC-018 (the priority rule itself) are added by Task 10.
// Run: node --test test/prepare-visibility.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { parseChecklist } = require("../lib/checklist");

const FIXTURE = fs.readFileSync(
  path.join(__dirname, "fixtures", "checklist-declared-data.md"),
  "utf8"
);
const parsed = parseChecklist(FIXTURE);
const byId = (id) => {
  const tc = parsed.tcs.find((t) => t.id === id);
  assert.ok(tc, `${id} not parsed`);
  return tc;
};

test("TC-018/1: all fixture TCs parse without warnings", () => {
  assert.strictEqual(parsed.tcs.length, 5, `expected 5 TCs, got ${parsed.tcs.length}`);
  for (const tc of parsed.tcs) {
    assert.deepStrictEqual(tc.parseWarnings, [], `${tc.id}: ${tc.parseWarnings.join("; ")}`);
  }
});

test("TC-018/1: declared data yields a non-empty list and dataStatus 'declared'", () => {
  const tc = byId("TC-001");
  assert.strictEqual(tc.dataStatus, "declared");
  assert.deepStrictEqual(tc.requiredData, ["prelude/common.json", "case-a/input.txt"]);
});

test("TC-018/1: 'не требуются' yields dataStatus 'none', not undefined", () => {
  const tc = byId("TC-002");
  assert.strictEqual(tc.dataStatus, "none");
  assert.notStrictEqual(tc.dataStatus, undefined);
  assert.deepStrictEqual(tc.requiredData, []);
});

test("TC-018/1: a legacy TC with prose-only prerequisites is 'unknown', not 'none'", () => {
  const tc = byId("TC-003");
  assert.strictEqual(tc.dataStatus, "unknown");
  assert.notStrictEqual(tc.dataStatus, "none");
  assert.notStrictEqual(tc.dataStatus, undefined);
  assert.deepStrictEqual(tc.requiredData, []);
  assert.strictEqual(tc.preparedPath, null);
});

test("TC-018/1: prose prerequisites stay in prerequisites and never leak into requiredData", () => {
  const tc = byId("TC-003");
  assert.deepStrictEqual(tc.prerequisites, [
    "Поднять сервис X на порту 8080.",
    "Завести пользователя с ролью «тестировщик».",
  ]);
  assert.deepStrictEqual(tc.requiredData, []);

  // Same border in a TC that *does* declare data: the prose prerequisite is
  // not promoted, and the declared paths are not demoted.
  const declared = byId("TC-001");
  assert.ok(declared.prerequisites.includes("Приложение запущено."));
  assert.ok(!declared.requiredData.includes("Приложение запущено."));
});

test("TC-018/1: English labels classify the same way", () => {
  const en = byId("TC-004");
  assert.strictEqual(en.dataStatus, "declared");
  assert.deepStrictEqual(en.requiredData, ["fixtures/users.csv"]);
  assert.strictEqual(byId("TC-005").dataStatus, "none");
});

test("TC-018/1: prepared-data bullet is lifted out and also kept as a prerequisite", () => {
  const ru = byId("TC-001");
  assert.strictEqual(ru.preparedPath, "/tmp/pf-manual-test/20260109/TC-001");
  assert.ok(
    ru.prerequisites.some((p) => p.startsWith("Подготовленные данные:")),
    "prepared-data bullet must survive in prerequisites"
  );
  assert.strictEqual(byId("TC-004").preparedPath, "/tmp/pf-manual-test/20260109/TC-004");
  assert.strictEqual(byId("TC-002").preparedPath, null);
});

test("TC-018/1: an empty data label does not claim the data is not needed", () => {
  const empty = parseChecklist(
    ["## TC-100: Empty label", "", "**Test Data:**", "", "**Notes:**", ""].join("\n")
  );
  const tc = empty.tcs[0];
  assert.strictEqual(tc.dataStatus, "unknown");
  assert.deepStrictEqual(tc.requiredData, []);
  assert.strictEqual(tc.parseWarnings.length, 1, tc.parseWarnings.join("; "));
});

test("TC-018/1: parsing a TC's data need leaves steps and notes untouched", () => {
  const tc = byId("TC-001");
  assert.strictEqual(tc.steps.length, 1);
  assert.strictEqual(tc.steps[0].step, 1);
  assert.strictEqual(tc.steps[0].checked, false);
  assert.ok(tc.notesLineIndex !== null, "Notes line must still be located");
});
