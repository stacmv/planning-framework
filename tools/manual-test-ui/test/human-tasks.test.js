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
// Extended (test_plan.md TC-025, TC-026) with:
//   * the live stale round trip specs.md §4.2/AC-05f/M5 promises: complete a
//     write/doc task, edit the artifact, confirm GET /api/inbox — not just
//     .../human-tasks — comes back `stale` with the CURRENT content's hash,
//     recommit, complete again, confirm the marker/hash move forward and the
//     task is DONE (excluded) again. TC-024/human-task-complete.test.js only
//     ever call `complete` once per fixture; nothing exercises the second
//     round before this.
//   * POST .../human-tasks/:key/reassign (TC-026/AC-05g): the single-line
//     `write: <old>` -> `write: <new>` point-edit for the supported
//     flow-style shape, byte-identical elsewhere, plus its append-only
//     session-log.md marker; an unknown actor rejected before any write;
//     and the documented multi-line block-style limitation refused with an
//     explicit error and the file left untouched.
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
// roles.implementation_plan: write: claude (an llm, not human on its own),
//   review: [human] -> a human-REVIEW task, distinct from all the human-WRITE
//   ones above (CR-004). No marker -> queued, operation: "review".
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
  "  implementation_plan: { write: claude, review: [human] }",
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
  // implementation_plan — write: claude (llm), review: [human] -> a
  // human-REVIEW task (CR-004): discoverable through this route just like a
  // human-WRITE one, with operation: "review", not "write".
  // -------------------------------------------------------------------
  const implPlanTask = tasks.find((t2) => t2.stageKey === "implementation_plan");
  assert.ok(implPlanTask, `expected an "implementation_plan" (human-review) task, got ${JSON.stringify(tasks)}`);
  assert.strictEqual(implPlanTask.operation, "review", "write: claude is not human — only review: [human] is, so operation must be review");
  assert.strictEqual(implPlanTask.status, "queued");
  assert.strictEqual(implPlanTask.artifactPath, `docs/issues/open/${ISSUE_ID}/implementation_plan.md`);
  assert.match(implPlanTask.instruction, /review/i, "a review task's instruction should read as a review instruction, not a write one");

  // -------------------------------------------------------------------
  // Exactly these five present, nothing else (test_plan excluded, every
  // other pipeline key falls through to the general default: write: claude).
  // -------------------------------------------------------------------
  assert.deepStrictEqual(
    tasks.map((t2) => t2.stageKey).sort(),
    ["code", "dev_docs", "implementation_plan", "specs", "user_docs"],
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

// =============================================================================
// TC-025 — complete's marker+hash, the live stale round trip via GET /api/inbox,
// and re-completion moving the marker forward.
// =============================================================================

const STALE_ISSUE_ID = "20260401-feat-fixture-human-stale";
const STALE_PROJECT_NAME = "proj-human-stale";

function markerLineRe(key) {
  return new RegExp(`^\\[human-task done\\] ${key} @ \\S+ content-hash=[0-9a-f]+\\n$`);
}

const STALE_PROMPT_MD = [
  "---",
  "doc_language: English",
  "size_tier: medium",
  "roles:",
  "  brd: { write: human }",
  "---",
  "",
  `# ${STALE_ISSUE_ID}`,
  "",
  "Type: feat. Fixture for the TC-025 stale round trip.",
  "",
].join("\n");

const STALE_BRD_V1 = "# BRD\n\nOriginal real content, not a stub.\n";
const STALE_BRD_V2 = "# BRD\n\nContent changed after the first completion — must go stale.\n";

const STALE_SESSION_LOG_MD = ["# Session Log", "", "## Pre-existing entry", "- Unrelated to human tasks.", ""].join("\n");

function buildStaleFixture(t) {
  autoCleanup(t);
  const project = makeTempRepo({
    name: STALE_PROJECT_NAME,
    issues: [],
    extraFiles: {
      [`docs/issues/open/${STALE_ISSUE_ID}/prompt.md`]: STALE_PROMPT_MD,
      [`docs/issues/open/${STALE_ISSUE_ID}/brd.md`]: STALE_BRD_V1,
      [`docs/issues/open/${STALE_ISSUE_ID}/session-log.md`]: STALE_SESSION_LOG_MD,
      "docs/planning/agents.yml": AGENTS_YML,
    },
  });
  const config = makeConfig({ projects: [{ name: STALE_PROJECT_NAME, path: project.root }] });
  return { project, configPath: config.configPath };
}

function staleSessionLogPath(project) {
  return path.join(project.root, "docs", "issues", "open", STALE_ISSUE_ID, "session-log.md");
}

test("complete -> edit artifact -> GET /api/inbox reports stale -> recommit -> complete again moves marker/hash forward", async (t) => {
  const fx = buildStaleFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath });
  const base = `/api/projects/${STALE_PROJECT_NAME}/issues/${STALE_ISSUE_ID}/human-tasks`;
  const brdAbs = path.join(fx.project.root, "docs", "issues", "open", STALE_ISSUE_ID, "brd.md");

  // 1. First completion — brd.md is already real content, committed by
  //    makeTempRepo's initial commit.
  const logBefore1 = fs.readFileSync(staleSessionLogPath(fx.project), "utf8");
  let res = await server.post(`${base}/brd/complete`, {});
  assert.strictEqual(res.status, 200, res.text);
  assert.strictEqual(res.json.status, "done");
  assert.strictEqual(res.json.contentHash, sha256Hex(STALE_BRD_V1));

  const logAfter1 = fs.readFileSync(staleSessionLogPath(fx.project), "utf8");
  assert.ok(logAfter1.startsWith(logBefore1), "existing session-log.md content must be untouched (append-only)");
  assert.match(logAfter1.slice(logBefore1.length), markerLineRe("brd"));

  // 2. Edit the artifact on disk, WITHOUT re-marking done and without
  //    committing yet — GET /api/inbox reads current content straight off
  //    disk for its stale check, no git commit required for that read.
  fs.writeFileSync(brdAbs, STALE_BRD_V2, "utf8");

  // 3. GET /api/inbox (not .../human-tasks) — the task must come back present
  //    with status "stale", never silently dropped (test_plan.md TC-025 step
  //    3 only requires presence + status here; unlike its sibling
  //    collectHumanTasksForIssue() behind .../human-tasks, lib/inbox.js's
  //    collectHumanTasks() — the function behind GET /api/inbox — does not
  //    set a `contentHash` field on its pushed tasks at all, so this suite
  //    does not assert on one for this call).
  res = await server.get("/api/inbox");
  assert.strictEqual(res.status, 200, res.text);
  const staleTask = res.json.humanTasks.find(
    (h) => h.project === STALE_PROJECT_NAME && h.issueId === STALE_ISSUE_ID && h.stageKey === "brd"
  );
  assert.ok(staleTask, `expected a brd task in GET /api/inbox's humanTasks[], got ${JSON.stringify(res.json.humanTasks)}`);
  assert.strictEqual(staleTask.status, "stale");

  // 4. Commit the change — .../complete's write/doc path requires the
  //    artifact to be fully committed, unlike the read-only stale check.
  fx.project.run(["add", "-A"]);
  fx.project.run(["commit", "--quiet", "-m", "fixture: update brd.md"]);

  // 5. Complete again — new hash, new marker, symmetric to "done" (M5: no
  //    silent loss in either direction).
  const logBefore2 = fs.readFileSync(staleSessionLogPath(fx.project), "utf8");
  res = await server.post(`${base}/brd/complete`, {});
  assert.strictEqual(res.status, 200, res.text);
  assert.strictEqual(res.json.contentHash, sha256Hex(STALE_BRD_V2));
  assert.notStrictEqual(res.json.contentHash, sha256Hex(STALE_BRD_V1));

  const logAfter2 = fs.readFileSync(staleSessionLogPath(fx.project), "utf8");
  assert.ok(logAfter2.startsWith(logBefore2), "second completion must still only append");
  assert.match(logAfter2.slice(logBefore2.length), markerLineRe("brd"));

  // The V1 marker line from step 1 is still there verbatim — append-only
  // means the old marker is never rewritten, only superseded by a later one.
  assert.match(logAfter2, new RegExp(`content-hash=${sha256Hex(STALE_BRD_V1)}`));
  assert.match(logAfter2, new RegExp(`content-hash=${sha256Hex(STALE_BRD_V2)}`));

  // Back to "done" (excluded entirely) now that the latest marker matches
  // current content again.
  res = await server.get("/api/inbox");
  assert.ok(
    !res.json.humanTasks.some((h) => h.project === STALE_PROJECT_NAME && h.issueId === STALE_ISSUE_ID && h.stageKey === "brd"),
    "after re-completion the task must be DONE (excluded), not left stale or duplicated"
  );
});

// =============================================================================
// TC-026 — POST .../human-tasks/:key/reassign: the single-line write: <old> ->
// write: <new> point-edit, its append-only marker, actor validation, and the
// documented multi-line block-style limitation.
// =============================================================================

const REASSIGN_FLOW_ISSUE_ID = "20260402-feat-fixture-reassign-flow";
const REASSIGN_BLOCK_ISSUE_ID = "20260403-feat-fixture-reassign-block";
const REASSIGN_PROJECT_NAME = "proj-human-reassign";

const REASSIGN_FLOW_PROMPT_MD = [
  "---",
  "doc_language: English",
  "size_tier: medium",
  "roles:",
  "  specs: { write: human, review: [claude] }",
  "---",
  "",
  `# ${REASSIGN_FLOW_ISSUE_ID}`,
  "",
  "Type: feat. Fixture for TC-026, single-line flow-style roles.specs.",
  "",
].join("\n");

// Mirrors test/fixtures/roles-resolve-multiline.md's shape: roles.specs split
// across several lines (block-style), the one shape reassign documents as
// unsupported (specs.md §4.3, same root gap as lib/roles-resolve.js's own
// read side, see TC-022).
const REASSIGN_BLOCK_PROMPT_MD = [
  "---",
  "size_tier: large",
  "roles:",
  "  specs:",
  "    write: haiku",
  "    review: [codex]",
  "---",
  "",
  `# ${REASSIGN_BLOCK_ISSUE_ID}`,
  "",
  "Type: feat. Fixture for TC-026 step 6 — multi-line block-style roles.specs.",
  "",
].join("\n");

function buildReassignFixture(t) {
  autoCleanup(t);
  const project = makeTempRepo({
    name: REASSIGN_PROJECT_NAME,
    issues: [],
    extraFiles: {
      [`docs/issues/open/${REASSIGN_FLOW_ISSUE_ID}/prompt.md`]: REASSIGN_FLOW_PROMPT_MD,
      [`docs/issues/open/${REASSIGN_BLOCK_ISSUE_ID}/prompt.md`]: REASSIGN_BLOCK_PROMPT_MD,
      "docs/planning/agents.yml": AGENTS_YML,
    },
  });
  const config = makeConfig({ projects: [{ name: REASSIGN_PROJECT_NAME, path: project.root }] });
  return { project, configPath: config.configPath };
}

function promptPath(project, issueId) {
  return path.join(project.root, "docs", "issues", "open", issueId, "prompt.md");
}

function reassignSessionLogPath(project, issueId) {
  return path.join(project.root, "docs", "issues", "open", issueId, "session-log.md");
}

test("reassign: single-line flow-style write: is point-edited, byte-identical elsewhere, marker appended; unknown actor rejected first", async (t) => {
  const fx = buildReassignFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath });
  const base = `/api/projects/${REASSIGN_PROJECT_NAME}/issues/${REASSIGN_FLOW_ISSUE_ID}/human-tasks`;
  const promptAbs = promptPath(fx.project, REASSIGN_FLOW_ISSUE_ID);
  const logAbs = reassignSessionLogPath(fx.project, REASSIGN_FLOW_ISSUE_ID);

  const before = fs.readFileSync(promptAbs, "utf8");
  assert.strictEqual(fs.existsSync(logAbs), false, "no session-log.md yet — reassign must be able to create it");

  // 2-3. reassign specs -> claude (a shipped-default actor, resolvable even
  // though agents.yml here only declares "human" explicitly).
  let res = await server.post(`${base}/specs/reassign`, { actor: "claude" });
  assert.strictEqual(res.status, 200, res.text);
  assert.deepStrictEqual(res.json, { status: "reassigned", actor: "claude" });

  const afterFirstEdit = fs.readFileSync(promptAbs, "utf8");
  assert.strictEqual(
    afterFirstEdit,
    before.replace("write: human", "write: claude"),
    "the only difference from the pre-call snapshot must be the write: substring — review, indentation, line endings, everything else untouched"
  );
  assert.notStrictEqual(afterFirstEdit, before);

  // 4. session-log.md gets an append-only reassignment record.
  const logAfterFirst = fs.readFileSync(logAbs, "utf8");
  assert.match(logAfterFirst, /^\[human-task reassigned\] specs @ \S+ from=human to=claude\n$/);

  // 5. An actor unknown to agents.yml (explicit or shipped-default) is
  // rejected — the point-edit never runs, file and log stay exactly as they
  // are after the successful call above.
  res = await server.post(`${base}/specs/reassign`, { actor: "totally-unknown-actor-xyz" });
  assert.strictEqual(res.status, 422, res.text);
  assert.strictEqual(res.json.error, "unknown_actor");
  assert.strictEqual(fs.readFileSync(promptAbs, "utf8"), afterFirstEdit, "a rejected actor must never touch prompt.md");
  assert.strictEqual(fs.readFileSync(logAbs, "utf8"), logAfterFirst, "a rejected actor must never touch session-log.md");
});

test("reassign: multi-line block-style roles.<key> is refused with an explicit error, file left byte-untouched", async (t) => {
  const fx = buildReassignFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath });
  const base = `/api/projects/${REASSIGN_PROJECT_NAME}/issues/${REASSIGN_BLOCK_ISSUE_ID}/human-tasks`;
  const promptAbs = promptPath(fx.project, REASSIGN_BLOCK_ISSUE_ID);
  const logAbs = reassignSessionLogPath(fx.project, REASSIGN_BLOCK_ISSUE_ID);

  const before = fs.readFileSync(promptAbs, "utf8");

  const res = await server.post(`${base}/specs/reassign`, { actor: "claude" });
  assert.strictEqual(res.status, 409, res.text);
  assert.strictEqual(res.json.error, "unsupported_roles_format");

  assert.strictEqual(
    fs.readFileSync(promptAbs, "utf8"),
    before,
    "an unsupported (multi-line block-style) roles.<key> entry must leave prompt.md byte-identical — never a silent no-op that still edits, never a partial/corrupting edit"
  );
  assert.strictEqual(fs.existsSync(logAbs), false, "a refused reassign must not create session-log.md either");
});
