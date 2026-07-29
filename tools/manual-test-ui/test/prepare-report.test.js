// TC-005 — the report a prepare run comes back with: success, failure, timeout.
//
// Driven through the HTTP route (`POST .../issues/:id/prepare`), not through
// lib/prepare.js: the engine's own behaviour is TC-002's subject, and what is
// under test here is what a tester is actually told. Three answers have to be
// distinguishable and none of them may be silence:
//
//   * it worked      — what was prepared, where it is, exit code 0;
//   * it failed      — why, in the script's own words, with a non-zero code;
//   * it hung        — stopped on the timeout, and the tool kept serving.
//
// Plus the property that makes a failure survivable: preparation is atomic, so
// after a failed or killed run the working copy is either the previous complete
// one or absent — never half a case. The staging tree a killed script leaves
// behind is swept by the server, so the next run needs no manual tidying.
//
// Run: node --test test/prepare-report.test.js
"use strict";

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const fixtures = require("./helpers/fixtures");

// Before anything reads os.tmpdir(): prepared data lives at a path derived
// from the issue id, which parallel suite processes would otherwise share.
const isolated = fixtures.isolateTempRoot("pf-prepare-tc005-");

const { preparedWorkdir, preparedIssueRoot } = require("../lib/prepare");
const { snapshot, snapshotWorkingTree, assertSameSnapshot } = require("./helpers/snapshot");
const { startServer } = require("./helpers/server");

const ISSUE_ID = "20260107-feat-fixture-twocases";
const LEGACY_ID = "20260110-improve-fixture-legacy";
const TC_ID = "TC-001";
const PROJECT = "main";

// Short on purpose: the case must not cost minutes to prove that a hung script
// is stopped. Passed to the server through the documented override.
const TIMEOUT_MS = 2000;

const repo = fixtures.makeTempRepo({ issues: [ISSUE_ID, LEGACY_ID], name: "prepare-report" });
const config = fixtures.makeConfig({
  projects: [{ name: PROJECT, path: repo.root, defaultBranch: repo.defaultBranch }],
});

const scriptPath = path.join(repo.issuePath(ISSUE_ID), "test-data", "setup.mjs");
const ORIGINAL_SCRIPT = fs.readFileSync(scriptPath, "utf8");
const STAGING_DIR = path.join(preparedIssueRoot(ISSUE_ID), ".staging");

// Captured before anything ran; step 8 compares the repository against it.
const REPO_BEFORE = snapshotWorkingTree(repo.root);

let server = null;

before(async () => {
  server = await startServer({
    configPath: config.configPath,
    env: { PLANNING_TEST_UI_PREPARE_TIMEOUT_MS: String(TIMEOUT_MS) },
  });
});

after(async () => {
  if (server) await server.stop();
  fixtures.cleanupAll();
  isolated.restore();
});

// --- fixture scripts -------------------------------------------------------
//
// Both mimic the shipped template where it matters: they assemble into the
// staging directory and die before the rename that would publish it. That is
// the only way a real run can fail halfway, so it is the failure the case has
// to reproduce.

function stagingPrelude() {
  return [
    'import fs from "node:fs";',
    'import os from "node:os";',
    'import path from "node:path";',
    `const STAGING = path.join(os.tmpdir(), "pf-test-data", ${JSON.stringify(ISSUE_ID)}, ".staging", ${JSON.stringify(TC_ID)});`,
    "fs.mkdirSync(STAGING, { recursive: true });",
    'fs.writeFileSync(path.join(STAGING, "half.txt"), "half of the data\\n");',
  ].join("\n");
}

// Creates one file of two, says why it stopped, exits non-zero.
const FAIL_MIDWAY_SCRIPT = [
  stagingPrelude(),
  'process.stderr.write("fixture failure\\n");',
  "process.exit(1);",
  "",
].join("\n");

// Never finishes; the interval keeps the loop alive until it is killed.
const HANG_SCRIPT = [
  stagingPrelude(),
  'process.stdout.write("fixture is hanging\\n");',
  "setInterval(() => {}, 1000);",
  "",
].join("\n");

// --- helpers ---------------------------------------------------------------

function installScript(source) {
  fs.writeFileSync(scriptPath, source, "utf8");
}

function restoreScript() {
  fs.writeFileSync(scriptPath, ORIGINAL_SCRIPT, "utf8");
}

function prepareUrl(issueId = ISSUE_ID) {
  return `/api/projects/${PROJECT}/issues/${issueId}/prepare`;
}

function postPrepare(body, issueId = ISSUE_ID) {
  return server.post(prepareUrl(issueId), body);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function porcelain() {
  return execFileSync("git", ["status", "--porcelain"], { cwd: repo.root, encoding: "utf8" });
}

function workdirSnapshot() {
  return snapshot(preparedWorkdir(ISSUE_ID, TC_ID));
}

function assertStagingSwept(what) {
  assert.ok(
    !fs.existsSync(STAGING_DIR),
    `${what}: the staging tree survived at ${STAGING_DIR} — the next prepare would need manual cleaning`
  );
}

// The state a successful run leaves behind; steps 3, 4 and 6 compare to it.
let reference = null;

// --- steps -----------------------------------------------------------------

test("TC-005/1: a successful prepare says what was prepared, where, and how it ended", async () => {
  const res = await postPrepare({ confirm: true, tcId: TC_ID });
  assert.strictEqual(res.status, 200, `expected 200, got ${res.status}: ${res.text}`);

  const body = res.json;
  assert.strictEqual(body.ok, true, `prepare failed: ${body.reason} — ${body.message}`);
  assert.strictEqual(body.ran, true);
  assert.strictEqual(body.reason, null);
  assert.strictEqual(body.error, undefined, "a successful report must carry no error field");
  assert.strictEqual(body.exitCode, 0, "a successful run must report exit code 0");
  assert.strictEqual(body.timedOut, false);
  assert.strictEqual(body.signal, null);
  assert.strictEqual(body.stderr, "", "a successful run must report an empty stderr");
  assert.strictEqual(body.issueId, ISSUE_ID);
  assert.strictEqual(body.issueStatus, "open");
  assert.strictEqual(body.tcId, TC_ID);
  assert.strictEqual(body.timeoutMs, TIMEOUT_MS, "the configured timeout must be the one in force");
  assert.strictEqual(typeof body.durationMs, "number");

  // What was prepared.
  assert.strictEqual(body.structured, true, `stdout carried no PF-PREPARED lines:\n${body.stdout}`);
  assert.strictEqual(body.prepared.length, 1, "one case was asked for, one must be reported");
  const [entry] = body.prepared;
  assert.strictEqual(entry.tcId, TC_ID);
  assert.ok(entry.files.includes("prelude/common.json"), `prepared files: ${entry.files.join(", ")}`);
  assert.ok(entry.files.includes("case-a/input.txt"), `prepared files: ${entry.files.join(", ")}`);

  // Where it is.
  assert.strictEqual(entry.workdir, preparedWorkdir(ISSUE_ID, TC_ID), "the reported path must be the documented one");
  assert.strictEqual(body.workdir, entry.workdir, "the single-case shortcut must agree with the list");
  assert.ok(fs.statSync(entry.workdir).isDirectory(), "the reported working copy does not exist");
  assert.ok(body.stdout.includes(entry.workdir), "the path must appear in the script's own output too");
  for (const relPath of entry.files) {
    assert.ok(
      fs.existsSync(path.join(entry.workdir, ...relPath.split("/"))),
      `${relPath} was reported as prepared but is not in the working copy`
    );
  }

  // And which script produced it — always the whitelist path.
  assert.strictEqual(body.scriptPath, scriptPath);

  reference = workdirSnapshot();
  assert.ok(reference.length > 0, "the successful run left an empty working copy");
});

test("TC-005/2: a script that fails midway is reported as a failure, with its reason", async () => {
  installScript(FAIL_MIDWAY_SCRIPT);
  const res = await postPrepare({ confirm: true, tcId: TC_ID });

  assert.strictEqual(res.status, 422, `expected 422 for a failing script, got ${res.status}: ${res.text}`);
  const body = res.json;
  assert.strictEqual(body.ok, false, "a script that exited non-zero must not be reported as success");
  assert.strictEqual(body.ran, true, "the script did run — the failure is its own, not the tool's");
  assert.strictEqual(body.reason, "exit-code");
  assert.strictEqual(body.error, "exit-code", "a failure must carry an error code the client can branch on");
  assert.notStrictEqual(body.exitCode, 0, "the non-zero exit code must be reported");
  assert.strictEqual(body.timedOut, false, "an ordinary failure is not a timeout");
  assert.match(body.stderr, /fixture failure/, "the script's stderr must reach the tester");
  assert.match(body.message, /fixture failure/, "the message must say why, not just that");
  assert.deepStrictEqual(body.prepared, [], "a failed run must not claim it prepared anything");
});

test("TC-005/3: nothing is left half-prepared after a failure", () => {
  assertSameSnapshot(
    reference,
    workdirSnapshot(),
    "the failed run changed the working copy — a tester would start on half-prepared data"
  );
  assert.ok(
    !fs.existsSync(path.join(preparedWorkdir(ISSUE_ID, TC_ID), "half.txt")),
    "a partially written file surfaced in the working copy"
  );
  assertStagingSwept("after a failed run");
});

test("TC-005/4: a correct script prepares cleanly after the failure, with no manual cleanup", async () => {
  restoreScript();
  const res = await postPrepare({ confirm: true, tcId: TC_ID });

  assert.strictEqual(res.status, 200, `expected 200 after a failed attempt, got ${res.status}: ${res.text}`);
  assert.strictEqual(res.json.ok, true, `prepare failed: ${res.json.reason} — ${res.json.message}`);
  assertSameSnapshot(
    reference,
    workdirSnapshot(),
    "re-preparing after a failure did not reproduce the reference working copy"
  );
});

test("TC-005/5: a hung script is stopped on the timeout and the tool keeps answering", async () => {
  installScript(HANG_SCRIPT);

  let settled = false;
  const pending = postPrepare({ confirm: true, tcId: TC_ID }).then((r) => {
    settled = true;
    return r;
  });

  // Long enough for the script to be running, far short of the timeout.
  await delay(Math.min(500, TIMEOUT_MS / 2));
  const meanwhile = await server.get("/api/projects");
  assert.strictEqual(meanwhile.status, 200, "a plain GET was not answered while a script was hanging");
  assert.strictEqual(settled, false, "the prepare request finished early — the fixture script did not hang");

  const res = await pending;
  assert.strictEqual(res.status, 504, `expected 504 for a timeout, got ${res.status}: ${res.text}`);
  const body = res.json;
  assert.strictEqual(body.ok, false);
  assert.strictEqual(body.ran, true);
  assert.strictEqual(body.reason, "timeout");
  assert.strictEqual(body.error, "timeout");
  assert.strictEqual(body.timedOut, true, "the report must say the run was stopped on time, not merely that it failed");
  assert.match(body.message, /did not finish|time/i, "the reason must read as 'it ran out of time'");
  assert.ok(body.message.includes(String(TIMEOUT_MS)), `the message must name the limit that was hit: ${body.message}`);
  assert.ok(
    body.durationMs >= TIMEOUT_MS - 250,
    `the script was stopped after ${body.durationMs}ms, well before the ${TIMEOUT_MS}ms limit`
  );
  assert.ok(
    body.durationMs < TIMEOUT_MS * 5,
    `the script ran ${body.durationMs}ms — the timeout did not stop it promptly`
  );
});

test("TC-005/6: nothing is left half-prepared after a timeout either", () => {
  assertSameSnapshot(
    reference,
    workdirSnapshot(),
    "the timed-out run changed the working copy — a tester would start on half-prepared data"
  );
  assertStagingSwept("after a timeout");
});

test("TC-005/7: an issue that declares no prepared data is refused clearly, not with a 500", async () => {
  const res = await postPrepare({ confirm: true }, LEGACY_ID);

  assert.ok(res.status >= 400 && res.status < 500, `expected a 4xx refusal, got ${res.status}: ${res.text}`);
  assert.strictEqual(res.status, 404);
  const body = res.json;
  assert.ok(body, `the refusal must be a JSON answer, not silence: ${JSON.stringify(res.text)}`);
  assert.strictEqual(body.ok, false);
  assert.strictEqual(body.ran, false, "nothing may have been started for an issue with no setup script");
  assert.strictEqual(body.reason, "no-setup-script");
  assert.strictEqual(body.error, "no-setup-script");
  assert.ok(body.message.includes(LEGACY_ID), `the message must name the issue: ${body.message}`);
  assert.match(body.message, /declared|setup\.mjs/, `the message must say what is missing: ${body.message}`);
});

test("TC-005/8: the whole series left the repository exactly as it was", () => {
  restoreScript();
  assert.strictEqual(porcelain(), "", "preparing test data through the route dirtied the working tree");
  assertSameSnapshot(REPO_BEFORE, snapshotWorkingTree(repo.root), "preparing test data changed the checkout");
});
