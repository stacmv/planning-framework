// test/attention.test.js — public/attention.js's role<->stageKey mapping
// and per-issue/per-project "needs attention" counting. Pure module, no
// DOM/fetch — loaded the same way test/launcher.test.js loads
// public/launcher.js (native ES module, `await import(pathToFileURL(...))`).
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const MODULE_PATH = path.join(__dirname, "..", "public", "attention.js");

function loadModule() {
  return import(pathToFileURL(MODULE_PATH).href);
}

test("roleForStageKey: every documented stageKey maps to exactly the role whose item list shows that document", async () => {
  const mod = await loadModule();
  assert.strictEqual(mod.roleForStageKey("brd"), "analyst");
  assert.strictEqual(mod.roleForStageKey("analysis"), "analyst");
  assert.strictEqual(mod.roleForStageKey("notes"), "analyst");
  assert.strictEqual(mod.roleForStageKey("specs"), "developer");
  assert.strictEqual(mod.roleForStageKey("implementation_plan"), "developer");
  assert.strictEqual(mod.roleForStageKey("test_plan"), "tester");
});

test("roleForStageKey: code/tests/dev_docs -> developer, user_docs -> analyst (explicit supplement, not derived from any role's item list)", async () => {
  const mod = await loadModule();
  assert.strictEqual(mod.roleForStageKey("code"), "developer");
  assert.strictEqual(mod.roleForStageKey("tests"), "developer");
  assert.strictEqual(mod.roleForStageKey("dev_docs"), "developer");
  assert.strictEqual(mod.roleForStageKey("user_docs"), "analyst");
});

test("roleForStageKey: an unrecognized stageKey maps to no role, not a guess", async () => {
  const mod = await loadModule();
  assert.strictEqual(mod.roleForStageKey("totally-unknown-key"), null);
});

function inboxFixture() {
  return {
    manualTests: [
      { project: "proj-a", issueId: "20260101-feat-a", ptcId: "PTC-0001" },
      { project: "proj-a", issueId: "20260101-feat-a", ptcId: "PTC-0002" },
      { project: "proj-a", issueId: "20260102-feat-b", ptcId: "PTC-0003" },
      { project: "proj-b", issueId: "20260103-feat-c", ptcId: "PTC-0004" },
    ],
    humanTasks: [
      { project: "proj-a", issueId: "20260101-feat-a", stageKey: "specs" }, // developer
      { project: "proj-a", issueId: "20260102-feat-b", stageKey: "brd" }, // analyst
      { project: "proj-a", issueId: "20260102-feat-b", stageKey: "code" }, // developer (supplement)
      { project: "proj-b", issueId: "20260103-feat-c", stageKey: "specs" }, // developer, different project
    ],
  };
}

test("attentionForRoles: tester (single-element array) counts only manualTests for the given project, grouped by issue", async () => {
  const mod = await loadModule();
  const result = mod.attentionForRoles(inboxFixture(), "proj-a", ["tester"]);
  assert.strictEqual(result.total, 3);
  assert.deepStrictEqual(result.byIssue, { "20260101-feat-a": 2, "20260102-feat-b": 1 });
});

test("attentionForRoles: developer counts humanTasks whose stageKey maps to developer, for the given project only", async () => {
  const mod = await loadModule();
  const result = mod.attentionForRoles(inboxFixture(), "proj-a", ["developer"]);
  assert.strictEqual(result.total, 2);
  assert.deepStrictEqual(result.byIssue, { "20260101-feat-a": 1, "20260102-feat-b": 1 });
  // proj-b's own "specs" humanTask must not leak into proj-a's count.
});

test("attentionForRoles: analyst counts humanTasks mapped to analyst, ignores tester/developer-mapped ones", async () => {
  const mod = await loadModule();
  const result = mod.attentionForRoles(inboxFixture(), "proj-a", ["analyst"]);
  assert.strictEqual(result.total, 1);
  assert.deepStrictEqual(result.byIssue, { "20260102-feat-b": 1 });
});

test("attentionForRoles: several roles selected at once counts the union — tester+analyst here", async () => {
  const mod = await loadModule();
  const result = mod.attentionForRoles(inboxFixture(), "proj-a", ["tester", "analyst"]);
  // tester: 2 (20260101-feat-a) + 1 (20260102-feat-b) manual tests.
  // analyst: 1 (20260102-feat-b, "brd" humanTask).
  assert.strictEqual(result.total, 4);
  assert.deepStrictEqual(result.byIssue, { "20260101-feat-a": 2, "20260102-feat-b": 2 });
});

test("attentionForRoles: missingDocsByIssue folds into the per-issue count when supplied", async () => {
  const mod = await loadModule();
  const result = mod.attentionForRoles(inboxFixture(), "proj-a", ["developer"], { "20260101-feat-a": 2, "20260199-feat-z": 1 });
  assert.strictEqual(result.total, 5); // 2 (specs) + 2 (missing) + 1 (code) + 1 (missing, new issue)
  assert.deepStrictEqual(result.byIssue, {
    "20260101-feat-a": 3,
    "20260102-feat-b": 1,
    "20260199-feat-z": 1,
  });
});

// Empty selection = unfiltered (dogfooding round 2: role became a
// multi-select *filter* — "nothing selected" reads as "no filter applied",
// not "filter for nobody's role", which is a real behavior change from the
// single-role version this superseded (there, no role meant zero).
test("attentionForRoles: empty/null/undefined selection is unfiltered — every manualTest and humanTask for the project counts", async () => {
  const mod = await loadModule();
  const expected = { total: 6, byIssue: { "20260101-feat-a": 3, "20260102-feat-b": 3 } };
  assert.deepStrictEqual(mod.attentionForRoles(inboxFixture(), "proj-a", []), expected);
  assert.deepStrictEqual(mod.attentionForRoles(inboxFixture(), "proj-a", null), expected);
  assert.deepStrictEqual(mod.attentionForRoles(inboxFixture(), "proj-a", undefined), expected);
});

test("attentionForRoles: tolerates a missing/malformed inbox response", async () => {
  const mod = await loadModule();
  assert.deepStrictEqual(mod.attentionForRoles(null, "proj-a", ["tester"]), { total: 0, byIssue: {} });
  assert.deepStrictEqual(mod.attentionForRoles({}, "proj-a", ["tester"]), { total: 0, byIssue: {} });
});

// ---------------------------------------------------------------------------
// totalAttentionForRoles — the global inbox card's own count, same
// role-matching rule as attentionForRoles but across every project at once
// (dogfooding fix: the card used to show the raw unfiltered total regardless
// of the role filter).
// ---------------------------------------------------------------------------

test("totalAttentionForRoles: empty/null/undefined selection is unfiltered — counts every manualTest and humanTask", async () => {
  const mod = await loadModule();
  const fixture = inboxFixture();
  assert.strictEqual(mod.totalAttentionForRoles(fixture, []), 8); // 4 manualTests + 4 humanTasks
  assert.strictEqual(mod.totalAttentionForRoles(fixture, null), 8);
  assert.strictEqual(mod.totalAttentionForRoles(fixture, undefined), 8);
});

test("totalAttentionForRoles: tester counts only manualTests (all projects), not humanTasks", async () => {
  const mod = await loadModule();
  assert.strictEqual(mod.totalAttentionForRoles(inboxFixture(), ["tester"]), 4);
});

test("totalAttentionForRoles: developer counts humanTasks mapped to developer, across every project", async () => {
  const mod = await loadModule();
  // specs(proj-a), code(proj-a), specs(proj-b) -> 3 developer-mapped humanTasks; brd(proj-a) is analyst's.
  assert.strictEqual(mod.totalAttentionForRoles(inboxFixture(), ["developer"]), 3);
});

test("totalAttentionForRoles: several roles selected at once counts the union", async () => {
  const mod = await loadModule();
  // tester: 4 manualTests. analyst: 1 humanTask (brd). No overlap.
  assert.strictEqual(mod.totalAttentionForRoles(inboxFixture(), ["tester", "analyst"]), 5);
});

test("totalAttentionForRoles: tolerates a missing/malformed inbox response", async () => {
  const mod = await loadModule();
  assert.strictEqual(mod.totalAttentionForRoles(null, ["tester"]), 0);
  assert.strictEqual(mod.totalAttentionForRoles({}, ["tester"]), 0);
});
