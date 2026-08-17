// GET /api/inbox — the aggregated "things to do" endpoint (server.js,
// lib/inbox.js's collectManualTests()/collectHumanTasks()), exercised
// end-to-end and across more than one project.
//
// Two questions this suite answers that a unit test of lib/inbox.js alone
// cannot:
//   * is the route reachable without being "scoped" to any one project —
//     i.e. does GET /api/inbox (not .../projects/:name/inbox) really merge
//     every configured project's contributions into one response;
//   * does a malformed Status Tracker row get dropped loudly (a console.warn
//     naming the file and line), never silently.
//
// Two fixture projects, built directly with test/helpers/fixtures.js
// (mirrors test/multi-project.test.js's conventions):
//   * "proj-a" — a hand-written docs/planning/test-plan.md with one valid
//     `pending` row and one row whose Origin is malformed.
//   * "proj-b" — an open issue whose prompt.md resolves roles.specs to an
//     actor agents.yml declares `kind: human`.
//
// Run: node --test test/inbox.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const fixtures = require("./helpers/fixtures");
const { makeTempRepo, makeConfig, autoCleanup } = fixtures;
const { startServerFor } = require("./helpers/server");

// ---------------------------------------------------------------------------
// Fixture bodies
// ---------------------------------------------------------------------------

const VALID_ISSUE_ID = "20260101-feat-fixture-full";
const VALID_ORIGIN = `${VALID_ISSUE_ID}#TC-001`;
const INVALID_ORIGIN = "not-a-real-origin";

// Line numbers matter here: parseStatusTrackerRows reports a 1-based line
// number in its console.warn, and the test asserts on it directly rather
// than with a loose regex, so this constant has to track the fixture body
// exactly. Count from line 1 of TEST_PLAN_MD below.
const INVALID_ROW_LINE = 8;

const TEST_PLAN_MD = [
  /* 1 */ "# Manual Test Plan",
  /* 2 */ "",
  /* 3 */ "Last allocated: PTC-0002",
  /* 4 */ "",
  /* 5 */ "| PTC | Area | Test case | Prio | Origin | Last run | Status |",
  /* 6 */ "| --- | --- | --- | --- | --- | --- | --- |",
  /* 7 */ `| PTC-0001 | ui | Valid pending case | High | ${VALID_ORIGIN} | 2026-08-01 | pending |`,
  /* 8 */ `| PTC-0002 | ui | Invalid origin case | Med | ${INVALID_ORIGIN} | 2026-08-01 | pending |`,
  /* 9 */ "",
].join("\n");

const HUMAN_ISSUE_ID = "20260201-feat-fixture-human";

// roles.specs explicitly names an actor that agents.yml (below) declares
// `kind: human` — the one pipeline key this issue resolves to a human task.
// Every other PIPELINE_KEYS falls through to the general default (write:
// claude), which resolves to an `llm` actor and contributes nothing.
const HUMAN_PROMPT_MD = [
  "---",
  "doc_language: English",
  "size_tier: medium",
  "roles:",
  "  specs: { write: human }",
  "---",
  "",
  `# ${HUMAN_ISSUE_ID}`,
  "",
  "Type: feat. A pipeline key resolved to a human actor.",
  "",
].join("\n");

const HUMAN_AGENTS_YML = ["actors:", "  human: { kind: human }", ""].join("\n");

// ---------------------------------------------------------------------------
// Fixture assembly
// ---------------------------------------------------------------------------

function buildFixture(t) {
  autoCleanup(t);

  const projA = makeTempRepo({
    name: "proj-a",
    issues: [],
    extraFiles: { "docs/planning/test-plan.md": TEST_PLAN_MD },
  });

  const projB = makeTempRepo({
    name: "proj-b",
    issues: [],
    extraFiles: {
      [`docs/issues/open/${HUMAN_ISSUE_ID}/prompt.md`]: HUMAN_PROMPT_MD,
      "docs/planning/agents.yml": HUMAN_AGENTS_YML,
    },
  });

  const config = makeConfig({
    projects: [
      { name: "proj-a", path: projA.root },
      { name: "proj-b", path: projB.root },
    ],
  });

  return { projA, projB, configPath: config.configPath };
}

// ---------------------------------------------------------------------------
// The test
// ---------------------------------------------------------------------------

test("GET /api/inbox aggregates manualTests[]/humanTasks[] across every configured project", async (t) => {
  const fx = buildFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath });

  const res = await server.get("/api/inbox");
  assert.strictEqual(res.status, 200, `GET /api/inbox → ${res.status}: ${res.text}`);

  const body = res.json;
  assert.ok(body && typeof body === "object", "response body must be a JSON object");
  assert.deepStrictEqual(
    Object.keys(body).sort(),
    ["humanTasks", "manualTests", "totalCount"].sort(),
    `unexpected top-level shape: ${JSON.stringify(Object.keys(body))}`
  );
  assert.ok(Array.isArray(body.manualTests), "manualTests must be an array");
  assert.ok(Array.isArray(body.humanTasks), "humanTasks must be an array");

  // -------------------------------------------------------------------
  // manualTests[] — cross-project aggregation, the valid row only.
  // -------------------------------------------------------------------

  const projects = new Set(body.manualTests.map((m) => m.project));
  assert.ok(projects.has("proj-a"), "manualTests[] must include proj-a's contribution");

  assert.strictEqual(body.manualTests.length, 1, `expected exactly one valid pending row, got ${JSON.stringify(body.manualTests)}`);
  const manualEntry = body.manualTests[0];
  assert.strictEqual(manualEntry.project, "proj-a");
  assert.strictEqual(manualEntry.issueId, VALID_ISSUE_ID);
  assert.strictEqual(manualEntry.ptcId, "PTC-0001");
  assert.strictEqual(manualEntry.origin, VALID_ORIGIN);

  // Every element has every field, non-empty — the contract server.js and
  // lib/inbox.js's own doc comment both promise (specs.md §3.2, TC-017).
  for (const m of body.manualTests) {
    for (const field of ["project", "issueId", "ptcId", "area", "testCase", "priority", "origin"]) {
      assert.ok(
        typeof m[field] === "string" && m[field].trim() !== "",
        `manualTests[] entry is missing/empty field "${field}": ${JSON.stringify(m)}`
      );
    }
  }

  // The invalid-Origin row must not appear at all.
  assert.ok(
    !body.manualTests.some((m) => m.origin === INVALID_ORIGIN),
    "the malformed-Origin row must be excluded from manualTests[]"
  );
  assert.ok(
    !body.manualTests.some((m) => m.ptcId === "PTC-0002"),
    "PTC-0002 (malformed Origin) must not appear in manualTests[]"
  );

  // ...and its drop must be loud: a console.warn naming the file and the
  // 1-based line number, not a silent exclusion.
  const testPlanPath = path.join(fx.projA.root, "docs", "planning", "test-plan.md");
  const stderr = server.stderr();
  assert.ok(
    stderr.includes(`${testPlanPath}:${INVALID_ROW_LINE}:`),
    `expected a console.warn naming ${testPlanPath}:${INVALID_ROW_LINE}: — stderr was:\n${stderr}`
  );
  assert.match(stderr, /malformed Origin/, `expected the warning to mention "malformed Origin" — stderr was:\n${stderr}`);

  // -------------------------------------------------------------------
  // humanTasks[] — the human-actor pipeline key from proj-b's open issue.
  // -------------------------------------------------------------------

  assert.ok(
    body.humanTasks.some((h) => h.project === "proj-b"),
    "humanTasks[] must include proj-b's contribution"
  );

  const humanEntry = body.humanTasks.find((h) => h.project === "proj-b" && h.issueId === HUMAN_ISSUE_ID && h.stageKey === "specs");
  assert.ok(humanEntry, `expected a humanTasks[] entry for proj-b/${HUMAN_ISSUE_ID}/specs, got ${JSON.stringify(body.humanTasks)}`);
  assert.strictEqual(humanEntry.operation, "write");
  assert.strictEqual(humanEntry.mode, "non-blocking");
  assert.strictEqual(humanEntry.status, "queued");
  assert.strictEqual(humanEntry.artifactPath, `docs/issues/open/${HUMAN_ISSUE_ID}/specs.md`);
  assert.strictEqual(humanEntry.instruction, "Write specs.md for this issue.");

  // Every element has every non-empty field the spec calls out, plus
  // whatever lib/inbox.js actually attaches (artifactPath/instruction) —
  // present (not necessarily non-empty: artifactPath is legitimately null
  // for the code/tests keys, though none of that applies to this fixture).
  for (const h of body.humanTasks) {
    for (const field of ["project", "issueId", "stageKey", "operation", "mode", "status"]) {
      assert.ok(
        typeof h[field] === "string" && h[field].trim() !== "",
        `humanTasks[] entry is missing/empty field "${field}": ${JSON.stringify(h)}`
      );
    }
    assert.ok(
      Object.prototype.hasOwnProperty.call(h, "artifactPath"),
      `humanTasks[] entry is missing the "artifactPath" field: ${JSON.stringify(h)}`
    );
    assert.ok(
      Object.prototype.hasOwnProperty.call(h, "instruction") && typeof h.instruction === "string" && h.instruction.trim() !== "",
      `humanTasks[] entry is missing a non-empty "instruction": ${JSON.stringify(h)}`
    );
  }

  // -------------------------------------------------------------------
  // totalCount
  // -------------------------------------------------------------------

  assert.strictEqual(body.totalCount, body.manualTests.length + body.humanTasks.length);
});
