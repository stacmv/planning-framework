// test/status.test.js — public/status.js's per-issue status message and
// per-project 3-category classifier. Pure module, no DOM/fetch — same
// convention as test/attention.test.js.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const MODULE_PATH = path.join(__dirname, "..", "public", "status.js");

function loadModule() {
  return import(pathToFileURL(MODULE_PATH).href);
}

function stagesAllDone() {
  return [
    "brd",
    "specs",
    "test_plan",
    "implementation_plan",
    "code_review",
    "testing",
    "user_docs",
    "dev_docs",
    "qa",
  ].map((key) => ({ key, done: true }));
}

// ---------------------------------------------------------------------------
// issueDocProblem / issueStatusMessage — priority 1-6.
// ---------------------------------------------------------------------------

test("issueDocProblem: reports the FIRST missing stage in pipeline order, not just any missing one", async () => {
  const mod = await loadModule();
  const stages = stagesAllDone();
  stages.find((s) => s.key === "specs").done = false;
  stages.find((s) => s.key === "qa").done = false; // also missing, but specs comes first
  assert.strictEqual(mod.issueDocProblem({ stages }), "Нет Spec");
});

test("issueDocProblem: falls through to codeReviewVerdict FAIL once every stage doc exists", async () => {
  const mod = await loadModule();
  assert.strictEqual(
    mod.issueDocProblem({ stages: stagesAllDone(), codeReviewVerdict: "FAIL", qaVerdict: "PASS" }),
    "Code review: FAIL"
  );
});

test("issueDocProblem: falls through to qaVerdict FAIL once stages and code review are clean", async () => {
  const mod = await loadModule();
  assert.strictEqual(
    mod.issueDocProblem({ stages: stagesAllDone(), codeReviewVerdict: "PASS", qaVerdict: "FAIL" }),
    "QA: FAIL"
  );
});

test("issueDocProblem: null when every stage is done and both verdicts are PASS/absent", async () => {
  const mod = await loadModule();
  assert.strictEqual(mod.issueDocProblem({ stages: stagesAllDone(), codeReviewVerdict: "PASS", qaVerdict: null }), null);
});

test("issueDocProblem: tolerates a missing/malformed issue", async () => {
  const mod = await loadModule();
  assert.strictEqual(mod.issueDocProblem({}), null);
  assert.strictEqual(mod.issueDocProblem(null), null);
});

test("issueStatusMessage: a doc problem always wins over pending counts (priority 1-3 beat 4-5)", async () => {
  const mod = await loadModule();
  const stages = stagesAllDone();
  stages.find((s) => s.key === "brd").done = false;
  assert.strictEqual(mod.issueStatusMessage({ stages }, 5, 5), "Нет BRD");
});

test("issueStatusMessage: manual tests (priority 4) beat human tasks (priority 5)", async () => {
  const mod = await loadModule();
  const clean = { stages: stagesAllDone(), codeReviewVerdict: "PASS", qaVerdict: "PASS" };
  assert.strictEqual(mod.issueStatusMessage(clean, 3, 2), "3 ручных теста");
});

test("issueStatusMessage: Russian pluralization — 1/2/5 ручных тестов all read correctly", async () => {
  const mod = await loadModule();
  const clean = { stages: stagesAllDone(), codeReviewVerdict: "PASS", qaVerdict: "PASS" };
  assert.strictEqual(mod.issueStatusMessage(clean, 1, 0), "1 ручной тест");
  assert.strictEqual(mod.issueStatusMessage(clean, 2, 0), "2 ручных теста");
  assert.strictEqual(mod.issueStatusMessage(clean, 5, 0), "5 ручных тестов");
  assert.strictEqual(mod.issueStatusMessage(clean, 11, 0), "11 ручных тестов"); // the "11-14 always many" exception
  assert.strictEqual(mod.issueStatusMessage(clean, 21, 0), "21 ручной тест");
});

test("issueStatusMessage: human-tasks pluralization (priority 5, only reached with zero manual tests)", async () => {
  const mod = await loadModule();
  const clean = { stages: stagesAllDone(), codeReviewVerdict: "PASS", qaVerdict: "PASS" };
  assert.strictEqual(mod.issueStatusMessage(clean, 0, 1), "1 human-задача");
  assert.strictEqual(mod.issueStatusMessage(clean, 0, 3), "3 human-задачи");
  assert.strictEqual(mod.issueStatusMessage(clean, 0, 5), "5 human-задач");
});

test("issueStatusMessage: nothing at all -> null (issue needs nothing)", async () => {
  const mod = await loadModule();
  const clean = { stages: stagesAllDone(), codeReviewVerdict: "PASS", qaVerdict: "PASS" };
  assert.strictEqual(mod.issueStatusMessage(clean, 0, 0), null);
});

// ---------------------------------------------------------------------------
// projectCategory — the launcher grid's / project-selector dropdown's
// shared per-project classification.
// ---------------------------------------------------------------------------

test("projectCategory: any open issue -> \"open\", detail lists every open issue (stages included, not a count)", async () => {
  const mod = await loadModule();
  const issues = [
    { issueId: "20260101-feat-a", status: "open", stages: stagesAllDone() },
    { issueId: "20260102-feat-b", status: "closed", stages: stagesAllDone() },
  ];
  const result = mod.projectCategory(issues);
  assert.strictEqual(result.category, "open");
  assert.deepStrictEqual(
    result.detail.map((d) => d.issueId),
    ["20260101-feat-a"]
  );
});

test("projectCategory: no open issues, but a closed one has a doc problem -> \"problems\"", async () => {
  const mod = await loadModule();
  const stagesMissingQa = stagesAllDone();
  stagesMissingQa.find((s) => s.key === "qa").done = false;
  const issues = [{ issueId: "20260102-feat-b", status: "closed", stages: stagesMissingQa }];
  const result = mod.projectCategory(issues);
  assert.strictEqual(result.category, "problems");
  assert.deepStrictEqual(result.detail, { issueId: "20260102-feat-b", message: "Нет QA report" });
});

test("projectCategory: no open issues, nothing flagged -> \"clear\"", async () => {
  const mod = await loadModule();
  const issues = [{ issueId: "20260102-feat-b", status: "closed", stages: stagesAllDone(), codeReviewVerdict: "PASS", qaVerdict: "PASS" }];
  const result = mod.projectCategory(issues);
  assert.deepStrictEqual(result, { category: "clear", detail: null });
});

test("projectCategory: no issues at all -> \"clear\"", async () => {
  const mod = await loadModule();
  assert.deepStrictEqual(mod.projectCategory([]), { category: "clear", detail: null });
  assert.deepStrictEqual(mod.projectCategory(null), { category: "clear", detail: null });
});

// ---------------------------------------------------------------------------
// Role-aware behavior (dogfooding round 2, second pass) — issueDocProblem
// and projectCategory both take an optional roleIds filter, resolved via
// stage-roles.js's "who creates this document" table. Empty/omitted = every
// role's doc problems count, same as before this became role-aware.
// ---------------------------------------------------------------------------

test("issueDocProblem: a missing stage doc owned by an unselected role does not count — falls through to the next relevant one", async () => {
  const mod = await loadModule();
  const stages = stagesAllDone();
  stages.find((s) => s.key === "brd").done = false; // brd -> analyst
  stages.find((s) => s.key === "specs").done = false; // specs -> developer
  // developer-only filter: brd (analyst-owned) is invisible, specs is not.
  assert.strictEqual(mod.issueDocProblem({ stages }, ["developer"]), "Нет Spec");
  // analyst-only filter: only brd is visible.
  assert.strictEqual(mod.issueDocProblem({ stages }, ["analyst"]), "Нет BRD");
});

test("issueDocProblem: a role-filtered verdict FAIL (code_review/qa are developer-owned) is invisible to other roles", async () => {
  const mod = await loadModule();
  const issue = { stages: stagesAllDone(), codeReviewVerdict: "FAIL", qaVerdict: "FAIL" };
  assert.strictEqual(mod.issueDocProblem(issue, ["analyst"]), null);
  assert.strictEqual(mod.issueDocProblem(issue, ["developer"]), "Code review: FAIL");
});

test("issueDocProblem: empty/omitted roleIds is unfiltered, same as before role-awareness", async () => {
  const mod = await loadModule();
  const stages = stagesAllDone();
  stages.find((s) => s.key === "brd").done = false;
  assert.strictEqual(mod.issueDocProblem({ stages }), "Нет BRD");
  assert.strictEqual(mod.issueDocProblem({ stages }, []), "Нет BRD");
});

test("projectCategory: role-filtered — an open issue with no role-relevant doc problem or pending attention is hidden from \"open\"", async () => {
  const mod = await loadModule();
  const issues = [{ issueId: "20260101-feat-a", status: "open", stages: stagesAllDone(), codeReviewVerdict: "PASS", qaVerdict: "PASS" }];
  // Nothing developer-relevant is wrong with this issue and no attention
  // was supplied for it — under a developer filter it has no reason to
  // stay in "open", so the project falls all the way through to "clear".
  assert.deepStrictEqual(mod.projectCategory(issues, ["developer"], {}), { category: "clear", detail: null });
});

test("projectCategory: role-filtered — an open issue with a role-owned doc problem stays in \"open\"", async () => {
  const mod = await loadModule();
  const stages = stagesAllDone();
  stages.find((s) => s.key === "specs").done = false; // developer-owned
  const issues = [{ issueId: "20260101-feat-a", status: "open", stages }];
  const result = mod.projectCategory(issues, ["developer"]);
  assert.strictEqual(result.category, "open");
  assert.deepStrictEqual(result.detail.map((d) => d.issueId), ["20260101-feat-a"]);
});

test("projectCategory: role-filtered — an open issue with pending attentionByIssue (but no doc problem) stays in \"open\"", async () => {
  const mod = await loadModule();
  const issues = [{ issueId: "20260101-feat-a", status: "open", stages: stagesAllDone(), codeReviewVerdict: "PASS", qaVerdict: "PASS" }];
  const result = mod.projectCategory(issues, ["tester"], { "20260101-feat-a": 2 });
  assert.strictEqual(result.category, "open");
  assert.deepStrictEqual(result.detail.map((d) => d.issueId), ["20260101-feat-a"]);
});

test("projectCategory: role-filtered \"problems\" section only surfaces a role-owned message", async () => {
  const mod = await loadModule();
  const stagesMissingQa = stagesAllDone();
  stagesMissingQa.find((s) => s.key === "qa").done = false; // developer-owned
  const issues = [{ issueId: "20260102-feat-b", status: "closed", stages: stagesMissingQa }];
  assert.deepStrictEqual(mod.projectCategory(issues, ["analyst"]), { category: "clear", detail: null });
  const developerResult = mod.projectCategory(issues, ["developer"]);
  assert.strictEqual(developerResult.category, "problems");
  assert.deepStrictEqual(developerResult.detail, { issueId: "20260102-feat-b", message: "Нет QA report" });
});
