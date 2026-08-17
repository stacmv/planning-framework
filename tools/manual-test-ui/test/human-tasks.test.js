// GET /api/projects/:name/issues/:id/human-tasks (server.js,
// lib/inbox.js's collectHumanTasksForIssue()) — the per-issue slice of
// GET /api/inbox's humanTasks[] (specs.md §4.3, implementation_plan.md
// Task 10, test_plan.md TC-023 steps 1-4).
//
// What this suite checks that a unit test of lib/inbox.js alone cannot:
//   * the route is reachable and returns the documented array shape;
//   * `mode` reads its default ("non-blocking") when prompt.md doesn't say,
//     and the explicit override when it does — both on the SAME issue, so a
//     bug that hardcodes one or the other is caught;
//   * the queue/done/stale contract (specs.md §4.2/AC-05f): a key with a
//     `[human-task done]` marker whose hash matches the artifact's current
//     content is excluded entirely; a matching-key marker whose hash does
//     NOT match comes back `stale`, not silently dropped;
//   * the `code`/`tests` path (no single `artifactPath`, content identity is
//     the issue branch's HEAD sha, not a file hash — specs.md §4.4);
//   * the route never performs the resolved operation itself (AC-05a) and
//     never writes anything, `session-log.md` included — a real GET against
//     a real git repository, with the whole tree fingerprinted before and
//     after.
//
// Run: node --test test/human-tasks.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const fixtures = require("./helpers/fixtures");
const { makeTempRepo, makeConfig, autoCleanup } = fixtures;
const { startServerFor } = require("./helpers/server");
const { snapshotWorkingTree, assertSameSnapshot } = require("./helpers/snapshot");

const ISSUE_ID = "20260301-feat-fixture-human-tasks";

function sha256Hex(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

// Known content for the two document keys that carry a session-log.md
// marker, so the test can compute the "matches" and "doesn't match" hashes
// itself rather than trust the route's own math.
const TEST_PLAN_MD = "# test_plan.md\n\nDone marker matches this exact content.\n";
const DEV_DOCS_MD = "# dev_docs.md\n\nContent has changed since the marker was written.\n";
const DONE_MARKER_TS = "2026-08-01T00:00:00Z";
const STALE_MARKER_TS = "2026-08-02T00:00:00Z";

const SESSION_LOG_MD = [
  "# Session Log",
  "",
  // test_plan: marker hash matches TEST_PLAN_MD's current content -> DONE,
  // must be excluded from the response entirely.
  `[human-task done] test_plan @ ${DONE_MARKER_TS} content-hash=${sha256Hex(TEST_PLAN_MD)}`,
  // dev_docs: marker hash does NOT match DEV_DOCS_MD's current content ->
  // STALE, must appear in the response with status "stale".
  `[human-task done] dev_docs @ ${STALE_MARKER_TS} content-hash=deadbeef${"0".repeat(56)}`,
  "",
].join("\n");

// roles.specs: no explicit mode -> must default to non-blocking, no
//   session-log marker, artifact doesn't exist -> queued, no contentHash.
// roles.user_docs: explicit mode: blocking -> must be reflected verbatim, no
//   marker -> queued.
// roles.test_plan: DONE (marker hash matches current content) -> excluded.
// roles.dev_docs: STALE (marker hash does not match current content) ->
//   present, status "stale".
// roles.code: human, code/tests path (no artifactPath, content identity is
//   the issue branch HEAD sha) -> queued (no issue/<id> branch exists in
//   this fixture, so there is nothing to hash yet — contentHash omitted).
// Every other PIPELINE_KEYS key falls through to the general default
// (write: claude), an `llm` actor — contributes nothing to the response.
const PROMPT_MD = [
  "---",
  "doc_language: English",
  "size_tier: medium",
  "roles:",
  "  specs: { write: human }",
  "  user_docs: { write: human, mode: blocking }",
  "  test_plan: { write: human }",
  "  dev_docs: { write: human }",
  "  code: { write: human }",
  "---",
  "",
  `# ${ISSUE_ID}`,
  "",
  "Type: feat. Several pipeline keys resolved to a human actor.",
  "",
].join("\n");

const AGENTS_YML = ["actors:", "  human: { kind: human }", ""].join("\n");

function buildFixture(t) {
  autoCleanup(t);

  const project = makeTempRepo({
    name: "proj-human-tasks",
    issues: [],
    extraFiles: {
      [`docs/issues/open/${ISSUE_ID}/prompt.md`]: PROMPT_MD,
      [`docs/issues/open/${ISSUE_ID}/test_plan.md`]: TEST_PLAN_MD,
      [`docs/issues/open/${ISSUE_ID}/dev_docs.md`]: DEV_DOCS_MD,
      [`docs/issues/open/${ISSUE_ID}/session-log.md`]: SESSION_LOG_MD,
      "docs/planning/agents.yml": AGENTS_YML,
    },
  });

  const config = makeConfig({ projects: [{ name: "proj-human-tasks", path: project.root }] });

  return { project, configPath: config.configPath };
}

test("GET .../issues/:id/human-tasks reports queued/stale human tasks, excludes done ones, never mutates anything", async (t) => {
  const fx = buildFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath });

  const sessionLogPath = path.join(fx.project.root, "docs", "issues", "open", ISSUE_ID, "session-log.md");
  const sessionLogBefore = fs.readFileSync(sessionLogPath, "utf8");

  const before = snapshotWorkingTree(fx.project.root);

  const res = await server.get(`/api/projects/proj-human-tasks/issues/${ISSUE_ID}/human-tasks`);
  assert.strictEqual(res.status, 200, `GET .../human-tasks → ${res.status}: ${res.text}`);
  assert.ok(Array.isArray(res.json), `response body must be an array, got ${JSON.stringify(res.json)}`);

  const tasks = res.json;

  // -------------------------------------------------------------------
  // specs — default mode, queued, no artifact on disk -> no contentHash.
  // -------------------------------------------------------------------
  const specsTask = tasks.find((t2) => t2.stageKey === "specs");
  assert.ok(specsTask, `expected a "specs" task, got ${JSON.stringify(tasks)}`);
  assert.strictEqual(specsTask.operation, "write");
  assert.strictEqual(specsTask.mode, "non-blocking", "roles.specs has no explicit mode -> must default to non-blocking");
  assert.strictEqual(specsTask.status, "queued");
  assert.strictEqual(specsTask.artifactPath, `docs/issues/open/${ISSUE_ID}/specs.md`);
  assert.ok(typeof specsTask.instruction === "string" && specsTask.instruction.trim() !== "");
  assert.ok(!("contentHash" in specsTask), `contentHash must be omitted when the artifact doesn't exist: ${JSON.stringify(specsTask)}`);

  // -------------------------------------------------------------------
  // user_docs — explicit mode: blocking, queued.
  // -------------------------------------------------------------------
  const userDocsTask = tasks.find((t2) => t2.stageKey === "user_docs");
  assert.ok(userDocsTask, `expected a "user_docs" task, got ${JSON.stringify(tasks)}`);
  assert.strictEqual(userDocsTask.mode, "blocking", "roles.user_docs.mode: blocking must be reflected verbatim");
  assert.strictEqual(userDocsTask.status, "queued");

  // -------------------------------------------------------------------
  // test_plan — DONE (marker hash matches current content) -> excluded
  // entirely, not just "hidden" behind some status value.
  // -------------------------------------------------------------------
  assert.ok(
    !tasks.some((t2) => t2.stageKey === "test_plan"),
    `a DONE key must be excluded entirely from the response, got ${JSON.stringify(tasks)}`
  );

  // -------------------------------------------------------------------
  // dev_docs — STALE (marker hash does not match current content) ->
  // present, status "stale", never silently dropped (AC-05f).
  // -------------------------------------------------------------------
  const devDocsTask = tasks.find((t2) => t2.stageKey === "dev_docs");
  assert.ok(devDocsTask, `a STALE key must still appear in the response, got ${JSON.stringify(tasks)}`);
  assert.strictEqual(devDocsTask.status, "stale");
  assert.strictEqual(devDocsTask.contentHash, sha256Hex(DEV_DOCS_MD), "stale task's contentHash must be the CURRENT content's hash");

  // -------------------------------------------------------------------
  // code — the code/tests path: no single artifactPath, content identity
  // is the issue branch's HEAD sha, not a file hash. No issue/<id> branch
  // exists in this fixture, so there is nothing to hash yet.
  // -------------------------------------------------------------------
  const codeTask = tasks.find((t2) => t2.stageKey === "code");
  assert.ok(codeTask, `expected a "code" task, got ${JSON.stringify(tasks)}`);
  assert.strictEqual(codeTask.artifactPath, null, "code/tests keys never resolve to a single artifactPath (specs.md §4.4)");
  assert.strictEqual(codeTask.status, "queued");
  assert.ok(!("contentHash" in codeTask), `contentHash must be omitted with no issue/<id> branch to hash: ${JSON.stringify(codeTask)}`);

  // -------------------------------------------------------------------
  // Exactly these four present, nothing else (test_plan excluded, every
  // other pipeline key falls through to the general default: write: claude).
  // -------------------------------------------------------------------
  assert.deepStrictEqual(
    tasks.map((t2) => t2.stageKey).sort(),
    ["code", "dev_docs", "specs", "user_docs"],
    `unexpected stageKeys: ${JSON.stringify(tasks.map((t2) => t2.stageKey))}`
  );

  // -------------------------------------------------------------------
  // The critical property: a pure GET, zero side effects anywhere.
  // -------------------------------------------------------------------
  assert.strictEqual(
    fs.readFileSync(sessionLogPath, "utf8"),
    sessionLogBefore,
    "GET .../human-tasks must never write to session-log.md"
  );
  const after = snapshotWorkingTree(fx.project.root);
  assertSameSnapshot(before, after, "GET .../human-tasks must not change anything in the repository's working tree");
});

test("GET .../issues/:id/human-tasks 404s for an unknown issue id", async (t) => {
  const fx = buildFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath });

  const res = await server.get("/api/projects/proj-human-tasks/issues/20269999-feat-does-not-exist/human-tasks");
  assert.strictEqual(res.status, 404, `expected 404 for an unknown issue, got ${res.status}: ${res.text}`);
});
