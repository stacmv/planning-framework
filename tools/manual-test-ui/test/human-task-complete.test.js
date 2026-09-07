// POST /api/projects/:name/issues/:id/human-tasks/:key/complete (server.js's
// handleHumanTaskComplete, lib/inbox.js's resolveHumanTaskOperation,
// lib/git.js's isPathCommitted/parentBranchOf/commitsAhead/
// changedFilesBetween/revParse, lib/docstate.js's isRealDocument).
//
// Three verification paths, one suite section each:
//   * review        — a non-empty `verdict` is the only requirement.
//   * write, doc key   — the mapped file must exist, be real (not a stub)
//     and be fully committed; contentHash is its sha256.
//   * write, code/tests — the issue branch must be ahead of its parent and
//     touch a qualifying path outside docs/issues/; contentHash is the
//     branch HEAD's sha1, never a file hash.
//
// Every success path is also checked for the one side effect this route is
// allowed to have: an append-only `[human-task done]` marker line in the
// issue's session-log.md, with existing content untouched.
//
// Run: node --test test/human-task-complete.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const fixtures = require("./helpers/fixtures");
const { makeTempRepo, makeConfig, autoCleanup } = fixtures;
const { startServerFor } = require("./helpers/server");

const ISSUE_ID = "20260302-feat-fixture-human-complete";
const PROJECT_NAME = "proj-human-complete";
const BASE = `/api/projects/${PROJECT_NAME}/issues/${ISSUE_ID}/human-tasks`;

function sha256Hex(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

const SPECS_MD = "# specs.md\n\nReal content for the review scenario.\n";

// roles.specs   — write: claude (an llm), review: [human] -> REVIEW task.
// roles.brd     — write: human -> WRITE task, document key.
// roles.test_plan — write: human -> WRITE task, document key (stub check).
// roles.code    — write: human -> WRITE task, code/tests key.
// roles.tests   — write: human -> WRITE task, code/tests key.
// roles.implementation_plan — left unresolved -> falls to the general
//   default (write: claude), never a human task; used to check the
//   not_a_human_task rejection.
const PROMPT_MD = [
  "---",
  "doc_language: English",
  "size_tier: medium",
  "roles:",
  "  specs: { write: claude, review: [human] }",
  "  brd: { write: human }",
  "  test_plan: { write: human }",
  "  code: { write: human }",
  "  tests: { write: human }",
  "---",
  "",
  `# ${ISSUE_ID}`,
  "",
  "Type: feat. Fixture for the human-task completion route.",
  "",
].join("\n");

const AGENTS_YML = ["actors:", "  human: { kind: human }", ""].join("\n");

const SESSION_LOG_MD = ["# Session Log", "", "## Pre-existing entry", "- Nothing to do with human tasks.", ""].join("\n");

function buildFixture(t) {
  autoCleanup(t);
  const project = makeTempRepo({
    name: PROJECT_NAME,
    issues: [],
    extraFiles: {
      [`docs/issues/open/${ISSUE_ID}/prompt.md`]: PROMPT_MD,
      [`docs/issues/open/${ISSUE_ID}/specs.md`]: SPECS_MD,
      [`docs/issues/open/${ISSUE_ID}/session-log.md`]: SESSION_LOG_MD,
      "docs/planning/agents.yml": AGENTS_YML,
    },
  });
  const config = makeConfig({ projects: [{ name: PROJECT_NAME, path: project.root }] });
  return { project, configPath: config.configPath };
}

function sessionLogPath(project) {
  return path.join(project.root, "docs", "issues", "open", ISSUE_ID, "session-log.md");
}

function markerLineRe(key) {
  return new RegExp(`^\\[human-task done\\] ${key} @ \\S+ content-hash=[0-9a-f]+\\n$`);
}

// ---------------------------------------------------------------------------
// Review path
// ---------------------------------------------------------------------------

test("review path: missing/whitespace verdict -> 422 invalid_verdict; non-empty -> 200 with contentHash", async (t) => {
  const fx = buildFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath });
  const logBefore = fs.readFileSync(sessionLogPath(fx.project), "utf8");

  let res = await server.post(`${BASE}/specs/complete`, {});
  assert.strictEqual(res.status, 422, res.text);
  assert.strictEqual(res.json.error, "invalid_verdict");

  res = await server.post(`${BASE}/specs/complete`, { verdict: "   " });
  assert.strictEqual(res.status, 422, res.text);
  assert.strictEqual(res.json.error, "invalid_verdict");

  assert.strictEqual(
    fs.readFileSync(sessionLogPath(fx.project), "utf8"),
    logBefore,
    "a rejected review request must never touch session-log.md"
  );

  // "замечаний нет" is a perfectly valid verdict — only non-emptiness matters.
  res = await server.post(`${BASE}/specs/complete`, { verdict: "замечаний нет" });
  assert.strictEqual(res.status, 200, res.text);
  assert.strictEqual(res.json.status, "done");
  assert.strictEqual(
    res.json.contentHash,
    sha256Hex(SPECS_MD),
    "review contentHash must be the current artifact's content identifier (sha256 of specs.md)"
  );

  const logAfter = fs.readFileSync(sessionLogPath(fx.project), "utf8");
  assert.ok(logAfter.startsWith(logBefore), "existing session-log.md content must be untouched (append-only)");
  assert.match(logAfter.slice(logBefore.length), markerLineRe("specs"));
});

// ---------------------------------------------------------------------------
// Write path — document keys
// ---------------------------------------------------------------------------

test("write/doc path: missing -> 422 artifact_missing; uncommitted -> 422 artifact_not_committed; committed -> 200", async (t) => {
  const fx = buildFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath });
  const brdAbs = path.join(fx.project.root, "docs", "issues", "open", ISSUE_ID, "brd.md");
  const logBefore1 = fs.readFileSync(sessionLogPath(fx.project), "utf8");

  // 1. missing file entirely.
  let res = await server.post(`${BASE}/brd/complete`, {});
  assert.strictEqual(res.status, 422, res.text);
  assert.strictEqual(res.json.error, "artifact_missing");
  assert.strictEqual(fs.readFileSync(sessionLogPath(fx.project), "utf8"), logBefore1);

  // 2. present on disk, real content, but not committed (untracked "??").
  const brdContent = "# BRD\n\nReal body beyond the heading, not a stub.\n";
  fs.writeFileSync(brdAbs, brdContent, "utf8");
  res = await server.post(`${BASE}/brd/complete`, {});
  assert.strictEqual(res.status, 422, res.text);
  assert.strictEqual(res.json.error, "artifact_not_committed");
  assert.strictEqual(fs.readFileSync(sessionLogPath(fx.project), "utf8"), logBefore1);

  // 3. committed -> succeeds, marker appended, contentHash is a file sha256.
  fx.project.run(["add", "-A"]);
  fx.project.run(["commit", "--quiet", "-m", "fixture: commit brd.md"]);
  const logBefore2 = fs.readFileSync(sessionLogPath(fx.project), "utf8");

  res = await server.post(`${BASE}/brd/complete`, {});
  assert.strictEqual(res.status, 200, res.text);
  assert.strictEqual(res.json.status, "done");
  assert.strictEqual(res.json.contentHash, sha256Hex(brdContent));

  const logAfter = fs.readFileSync(sessionLogPath(fx.project), "utf8");
  assert.ok(logAfter.startsWith(logBefore2), "existing session-log.md content must be untouched (append-only)");
  assert.match(logAfter.slice(logBefore2.length), markerLineRe("brd"));
});

test("write/doc path: a fully-committed stub still reads as 422 artifact_missing, not artifact_not_committed", async (t) => {
  const fx = buildFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath });
  const tpAbs = path.join(fx.project.root, "docs", "issues", "open", ISSUE_ID, "test_plan.md");

  fs.writeFileSync(tpAbs, "# Test Plan\n\nTODO: Run /pf-test-plan to fill this in.\n", "utf8");
  fx.project.run(["add", "-A"]);
  fx.project.run(["commit", "--quiet", "-m", "fixture: commit stub test_plan.md"]);

  const res = await server.post(`${BASE}/test_plan/complete`, {});
  assert.strictEqual(res.status, 422, res.text);
  assert.strictEqual(
    res.json.error,
    "artifact_missing",
    "existence + non-stub is checked before the commit check, so a committed stub is still artifact_missing"
  );
});

// ---------------------------------------------------------------------------
// Write path — code/tests keys
// ---------------------------------------------------------------------------

test("write/code path: no branch -> no commits ahead -> docs-only commit -> qualifying commit -> 200 with branch-HEAD contentHash", async (t) => {
  const fx = buildFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath });
  const issueBranch = `issue/${ISSUE_ID}`;

  // 1. no issue/<id> branch at all yet.
  let res = await server.post(`${BASE}/code/complete`, {});
  assert.strictEqual(res.status, 422, res.text);
  assert.strictEqual(res.json.error, "artifact_missing");

  fx.project.run(["checkout", "--quiet", "-b", issueBranch]);

  // 2. branch exists, but 0 commits ahead of its parent.
  res = await server.post(`${BASE}/code/complete`, {});
  assert.strictEqual(res.status, 422, res.text);
  assert.strictEqual(res.json.error, "artifact_missing");

  // 3. a commit touching only docs/issues/ — still not qualifying.
  const notesAbs = path.join(fx.project.root, "docs", "issues", "open", ISSUE_ID, "extra-notes.md");
  fs.writeFileSync(notesAbs, "Docs-only change.\n", "utf8");
  fx.project.run(["add", "-A"]);
  fx.project.run(["commit", "--quiet", "-m", "fixture: docs-only commit"]);
  res = await server.post(`${BASE}/code/complete`, {});
  assert.strictEqual(res.status, 422, res.text);
  assert.strictEqual(res.json.error, "artifact_missing");

  // `tests` specifically still refuses a plain (non-test) file outside docs/.
  const srcAbs = path.join(fx.project.root, "src", "example.js");
  fs.mkdirSync(path.dirname(srcAbs), { recursive: true });
  fs.writeFileSync(srcAbs, "module.exports = 1;\n", "utf8");
  fx.project.run(["add", "-A"]);
  fx.project.run(["commit", "--quiet", "-m", "fixture: non-test code change"]);

  res = await server.post(`${BASE}/tests/complete`, {});
  assert.strictEqual(res.status, 422, res.text);
  assert.strictEqual(res.json.error, "artifact_missing", "a non-test file outside docs/issues/ does not satisfy the tests key");

  // But `code` is satisfied by that same non-test file outside docs/issues/.
  fx.project.run(["checkout", "--quiet", fx.project.defaultBranch]);
  const logBeforeCode = fs.readFileSync(sessionLogPath(fx.project), "utf8");
  res = await server.post(`${BASE}/code/complete`, {});
  assert.strictEqual(res.status, 200, res.text);
  assert.strictEqual(res.json.status, "done");
  const headSha = fx.project.run(["rev-parse", issueBranch]).trim();
  assert.strictEqual(res.json.contentHash, headSha, "code contentHash must be the issue branch HEAD sha1, not a file hash");
  assert.notStrictEqual(res.json.contentHash.length, 64, "sha1 (40 hex chars), not a sha256 (64)");
  const logAfterCode = fs.readFileSync(sessionLogPath(fx.project), "utf8");
  assert.ok(logAfterCode.startsWith(logBeforeCode));
  assert.match(logAfterCode.slice(logBeforeCode.length), markerLineRe("code"));

  // 4. add a qualifying test/*.test.js commit -> `tests` now succeeds too.
  fx.project.run(["checkout", "--quiet", issueBranch]);
  const testAbs = path.join(fx.project.root, "test", "example.test.js");
  fs.mkdirSync(path.dirname(testAbs), { recursive: true });
  fs.writeFileSync(testAbs, "// fixture test\n", "utf8");
  fx.project.run(["add", "-A"]);
  fx.project.run(["commit", "--quiet", "-m", "fixture: add a test file"]);
  fx.project.run(["checkout", "--quiet", fx.project.defaultBranch]);

  const logBeforeTests = fs.readFileSync(sessionLogPath(fx.project), "utf8");
  res = await server.post(`${BASE}/tests/complete`, {});
  assert.strictEqual(res.status, 200, res.text);
  const headSha2 = fx.project.run(["rev-parse", issueBranch]).trim();
  assert.strictEqual(res.json.contentHash, headSha2);
  const logAfterTests = fs.readFileSync(sessionLogPath(fx.project), "utf8");
  assert.ok(logAfterTests.startsWith(logBeforeTests));
  assert.match(logAfterTests.slice(logBeforeTests.length), markerLineRe("tests"));
});

// ---------------------------------------------------------------------------
// Key validation
// ---------------------------------------------------------------------------

test("an unrecognized :key is 404, and a key that doesn't resolve to a human actor is 404 not_a_human_task", async (t) => {
  const fx = buildFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath });

  let res = await server.post(`${BASE}/not-a-real-key/complete`, {});
  assert.strictEqual(res.status, 404, res.text);
  assert.strictEqual(res.json.error, "unknown_key");

  // implementation_plan has no roles entry here -> falls to the general
  // default (write: claude) -> never a human task.
  res = await server.post(`${BASE}/implementation_plan/complete`, { verdict: "ok" });
  assert.strictEqual(res.status, 404, res.text);
  assert.strictEqual(res.json.error, "not_a_human_task");
});
