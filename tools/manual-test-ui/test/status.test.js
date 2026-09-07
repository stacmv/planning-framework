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

// ---------------------------------------------------------------------------
// CR-016 — `status` (real classifyIssueDoc verdict: present/not_applicable/
// missing) must be read in preference to the collapsed `done` boolean, so a
// stage that legitimately does not apply to this issue never renders as a
// "Нет <Doc>" defect. A stage entry with no `status` field at all (every
// fixture above, and any older caller) keeps behaving exactly as before —
// `!done` is still the fallback.
// ---------------------------------------------------------------------------

// Every stage entry a real `GET .../issues` response now carries: `key`,
// `done` (kept for any caller that only reads that) and `status`.
function stage(key, status) {
  return { key, status, done: status === "present" };
}

// CR-019's scenarios (a)/(a-small) must go through the real classification
// path — the fixture repositories of test/helpers/fixtures.js, read by
// docstate's own buildIssueContext/classifyIssueDoc — instead of a
// hand-built stage list: the bug was precisely that a hand-built list looked
// right while the real resolver resolved user_docs/dev_docs at level 5 (the
// general default, skip: false) for a profile-less trivial/small issue, so
// they classified as `missing` and the launcher showed a false
// "Нет User docs"/"Нет Dev docs" for an open issue.
const { makeTempRepo, autoCleanup, simpleDoc, promptDoc } = require("./helpers/fixtures");
const docstate = require("../lib/docstate");

const TRIVIAL = "20260105-improve-fixture-trivial";
// No fixture issue in the shared catalogue is small-tier; scenario
// (a-small) writes this one itself through extraFiles.
const SMALL = "20260113-improve-fixture-small";

// server.js's STAGE_DOCS — the mapping that turns classified documents into
// the `stages[]` entries issueDocProblem reads. Duplicated here (server.js
// does not export it), same as STAGE_LABELS below duplicates the labels.
const STAGE_DOCS = [
  ["brd", "brd.md"],
  ["specs", "specs.md"],
  ["test_plan", "test_plan.md"],
  ["implementation_plan", "implementation_plan.md"],
  ["code_review", "code_review.md"],
  ["testing", "manual_test_checklist.md"],
  ["user_docs", "user_docs.md"],
  ["dev_docs", "dev_docs.md"],
  ["qa", "qa_report.md"],
];

/** The stages of a real fixture issue, exactly as server.js's issueStages() builds them. */
function realStages(repo, issueId) {
  const ctx = docstate.buildIssueContext(repo.root, issueId, "open");
  return STAGE_DOCS.map(([key, doc]) => {
    const state = docstate.classifyIssueDoc(ctx, doc);
    return { key, status: state.status, done: state.status === "present" };
  });
}

test("issueDocProblem: (a) a real trivial-tier issue without a profile resolves user_docs/dev_docs not_applicable (CR-019)", async (t) => {
  const mod = await loadModule();
  autoCleanup(t);
  // The real classification path, not a hand-built stage list: CR-019 was
  // exactly a hand-built list looking right while the real resolver put
  // user_docs/dev_docs at level 5 for a profile-less issue. The fixture
  // 20260105-improve-fixture-trivial is OPEN, `size_tier: trivial`, and its
  // prompt.md has neither a `profile:` field nor explicit
  // `roles.user_docs`/`roles.dev_docs`. Every document the trivial pipeline
  // does produce is added, so nothing in this issue is genuinely missing.
  const repo = makeTempRepo({
    name: "status-trivial",
    issues: [TRIVIAL],
    extraFiles: {
      [`docs/issues/open/${TRIVIAL}/test_plan.md`]: simpleDoc("Test Plan — trivial fixture", ["### TC-001: Fixture case", "**Priority:** Low"]),
      [`docs/issues/open/${TRIVIAL}/code_review.md`]: simpleDoc("Code Review — trivial fixture", ["**PASS**"]),
      [`docs/issues/open/${TRIVIAL}/manual_test_checklist.md`]: simpleDoc("Manual Test Checklist — trivial fixture", [
        "All fixture cases passed.",
      ]),
      [`docs/issues/open/${TRIVIAL}/qa_report.md`]: simpleDoc("QA Report — trivial fixture", ["**Verdict:** PASS"]),
    },
  });

  const stages = realStages(repo, TRIVIAL);
  const byKey = Object.fromEntries(stages.map((s) => [s.key, s]));
  // The classification itself. These are the assertions that fail if the
  // resolver regresses to resolving the two keys at level 5 (the general
  // default, skip: false) for a profile-less issue — they then come back
  // "missing" and the launcher shows a false "Нет User docs"/"Нет Dev docs".
  assert.strictEqual(byKey.user_docs.status, "not_applicable", "tier-default skip at trivial must apply without a profile (pf-roles §4, level 3)");
  assert.strictEqual(byKey.dev_docs.status, "not_applicable", "tier-default skip at trivial must apply without a profile (pf-roles §4, level 3)");
  // The trivial-tier collapse, through the same real path.
  assert.strictEqual(byKey.brd.status, "not_applicable");
  assert.strictEqual(byKey.specs.status, "not_applicable");
  assert.strictEqual(byKey.implementation_plan.status, "not_applicable");

  // And the launcher reading of that real stage list: with nothing
  // genuinely missing, there is no problem to report at all.
  const issue = { stages, codeReviewVerdict: null, qaVerdict: null };
  assert.strictEqual(mod.issueDocProblem(issue), null, "not_applicable must never read as \"Нет BRD\"/\"Нет User docs\"/…");
  assert.strictEqual(mod.issueStatusMessage(issue, 0, 0), null);
});

test("issueDocProblem: (a-small) a real small-tier issue without a profile resolves user_docs/dev_docs not_applicable (CR-019)", async (t) => {
  const mod = await loadModule();
  autoCleanup(t);
  // No fixture in test/helpers/fixtures.js is small-tier, so the small
  // variant of CR-019's scenario is written here through extraFiles, in the
  // same shape as the trivial fixture: OPEN, type improve, `size_tier:
  // small`, no `profile:`, no `roles:` — and every document the small
  // (improve) pipeline produces except the two whose absence is the point.
  const repo = makeTempRepo({
    name: "status-small",
    issues: [],
    extraFiles: {
      [`docs/issues/open/${SMALL}/prompt.md`]: promptDoc({ issueId: SMALL, type: "improve", title: "Small tier.", sizeTier: "small" }),
      [`docs/issues/open/${SMALL}/brd.md`]: simpleDoc("BRD — small fixture", ["## Goals", "- G1: the fixture is complete."]),
      [`docs/issues/open/${SMALL}/test_plan.md`]: simpleDoc("Test Plan — small fixture", ["### TC-001: Fixture case", "**Priority:** Low"]),
      [`docs/issues/open/${SMALL}/implementation_plan.md`]: simpleDoc("Implementation Plan — small fixture", ["#### Task 1: Exist", "**Files:** none"]),
      [`docs/issues/open/${SMALL}/code_review.md`]: simpleDoc("Code Review — small fixture", ["**PASS**"]),
      [`docs/issues/open/${SMALL}/manual_test_checklist.md`]: simpleDoc("Manual Test Checklist — small fixture", [
        "All fixture cases passed.",
      ]),
      [`docs/issues/open/${SMALL}/qa_report.md`]: simpleDoc("QA Report — small fixture", ["**Verdict:** PASS"]),
    },
  });

  const stages = realStages(repo, SMALL);
  const byKey = Object.fromEntries(stages.map((s) => [s.key, s]));
  assert.strictEqual(byKey.user_docs.status, "not_applicable", "tier-default skip at small must apply without a profile (pf-roles §4, level 3)");
  assert.strictEqual(byKey.dev_docs.status, "not_applicable", "tier-default skip at small must apply without a profile (pf-roles §4, level 3)");
  // The improve pipeline has no separate spec, through the same real path.
  assert.strictEqual(byKey.specs.status, "not_applicable");

  const issue = { stages, codeReviewVerdict: null, qaVerdict: null };
  assert.strictEqual(mod.issueDocProblem(issue), null);
  assert.strictEqual(mod.issueStatusMessage(issue, 0, 0), null);
});

test("issueDocProblem: (b) roles.user_docs: skip (not_applicable) produces no \"Нет User docs\" problem", async () => {
  const mod = await loadModule();
  const stages = stagesAllDone().map((s) => stage(s.key, "present"));
  stages.find((s) => s.key === "user_docs").status = "not_applicable"; // roles.user_docs: skip
  const issue = { stages, codeReviewVerdict: "PASS", qaVerdict: "PASS" };
  assert.strictEqual(mod.issueDocProblem(issue), null);
});

test("issueDocProblem: (c) a genuinely missing document still produces a problem, even alongside not_applicable ones", async () => {
  const mod = await loadModule();
  // Mixed states in pipeline order: brd/specs not_applicable (this issue's
  // pipeline never produces them), qa genuinely missing — over-suppression
  // would swallow qa's problem too; under-suppression would flag brd/specs
  // as well. Exactly one problem, and it is the real one.
  const stages = [
    stage("brd", "not_applicable"),
    stage("specs", "not_applicable"),
    stage("test_plan", "present"),
    stage("implementation_plan", "present"),
    stage("code_review", "present"),
    stage("testing", "present"),
    stage("user_docs", "not_applicable"),
    stage("dev_docs", "not_applicable"),
    stage("qa", "missing"),
  ];
  assert.strictEqual(mod.issueDocProblem({ stages }), "Нет QA report");
});
