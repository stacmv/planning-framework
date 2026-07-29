// TC-010 — the one executing operation of this tool, from the hostile side.
//
// The server runs exactly one thing: `docs/issues/{open,closed}/<ISSUE-ID>/test-data/setup.mjs`.
// The path is assembled on the server from an issue id that already matched
// ISSUE_ID_RE and a status that is one of two values, so the request selects an
// *issue*, never a file. Nothing is started without confirmation, and nothing
// is ever handed to a shell.
//
// A decoy script sits outside every allowed directory and writes a marker file
// when it runs. The marker is checked after every single step: one appearance
// anywhere in this suite means arbitrary code ran, and the case fails.
//
// Run: node --test test/prepare-security.test.js
"use strict";

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const fixtures = require("./helpers/fixtures");

const isolated = fixtures.isolateTempRoot("pf-prepare-tc010-");

const prepare = require("../lib/prepare");
const { preparedIssueRoot, preparedWorkdir } = prepare;
const { snapshotWorkingTree, assertSameSnapshot } = require("./helpers/snapshot");
const { startServer } = require("./helpers/server");

const ISSUE_ID = "20260107-feat-fixture-twocases";
const CLOSED_ID = "20260112-feat-fixture-closed";
const TC_ID = "TC-001";
const PROJECT = "main";

const repo = fixtures.makeTempRepo({ issues: [ISSUE_ID, CLOSED_ID], name: "prepare-security" });
const config = fixtures.makeConfig({
  projects: [{ name: PROJECT, path: repo.root, defaultBranch: repo.defaultBranch }],
});

const WHITELIST_SCRIPT = path.join(repo.issuePath(ISSUE_ID), "test-data", "setup.mjs");
const REPO_BEFORE = snapshotWorkingTree(repo.root);

// --- the decoy -------------------------------------------------------------

const decoyDir = fixtures.makeTempDir("pf-prepare-decoy-");
const decoyScript = path.join(decoyDir, "setup.mjs");
const decoyMarker = path.join(decoyDir, "EXECUTED.marker");

fs.writeFileSync(
  decoyScript,
  [
    'import fs from "node:fs";',
    'import path from "node:path";',
    'import { fileURLToPath } from "node:url";',
    "const here = path.dirname(fileURLToPath(import.meta.url));",
    'fs.writeFileSync(path.join(here, "EXECUTED.marker"), "the decoy ran\\n");',
    'process.stdout.write("PF-PREPARED TC-001 " + here + "\\n");',
    "",
  ].join("\n"),
  "utf8"
);

function assertDecoyDormant(step) {
  assert.ok(!fs.existsSync(decoyMarker), `${step}: the decoy script at ${decoyScript} was executed`);
}

let server = null;

before(async () => {
  server = await startServer({ configPath: config.configPath });
});

after(async () => {
  if (server) await server.stop();
  fixtures.cleanupAll();
  isolated.restore();
});

// --- helpers ---------------------------------------------------------------

function prepareUrl(issueId) {
  return `/api/projects/${PROJECT}/issues/${issueId}/prepare`;
}

function postPrepare(body, issueId = ISSUE_ID) {
  return server.post(prepareUrl(issueId), body);
}

function wipePreparedData() {
  fs.rmSync(preparedIssueRoot(ISSUE_ID), { recursive: true, force: true });
}

function readSource(relPath) {
  return fs.readFileSync(path.join(fixtures.TOOL_DIR, ...relPath.split("/")), "utf8");
}

// Comment lines dropped: both files explain in prose how the script is
// started, and a suite that read those sentences as code would be asserting
// about the documentation instead of about the program.
function codeOf(source) {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

// --- steps -----------------------------------------------------------------

test("TC-010/0: the decoy really does run when something runs it", () => {
  // Otherwise every "the marker did not appear" assertion below would hold
  // just as well for a script that could never have written it.
  execFileSync(process.execPath, [decoyScript], { encoding: "utf8" });
  assert.ok(fs.existsSync(decoyMarker), "the decoy did not write its marker even when run directly");
  fs.rmSync(decoyMarker);
  assertDecoyDormant("step 0");
});

test("TC-010/1: a script path in the request body is ignored; only the whitelist path runs", async () => {
  wipePreparedData();
  const res = await postPrepare({
    confirm: true,
    tcId: TC_ID,
    // Every name a caller might hope the server reads a path from.
    path: decoyScript,
    script: decoyScript,
    scriptPath: decoyScript,
    setupScript: decoyScript,
    scriptName: "../../../../../../../evil/setup.mjs",
    projectRoot: decoyDir,
    cwd: decoyDir,
    status: "closed",
    issueId: "../../../../etc",
  });

  assert.strictEqual(res.status, 200, `the positive control must still work: ${res.text}`);
  assert.strictEqual(res.json.ok, true, `${res.json.reason} — ${res.json.message}`);
  assert.strictEqual(res.json.scriptPath, WHITELIST_SCRIPT, "a path from the body reached the runner");
  assert.strictEqual(res.json.issueId, ISSUE_ID, "an issue id from the body overrode the one in the URL");
  assert.strictEqual(res.json.issueStatus, "open", "a status from the body overrode the resolved one");
  assert.strictEqual(res.json.prepared[0].workdir, preparedWorkdir(ISSUE_ID, TC_ID));
  assertDecoyDormant("step 1");
});

test("TC-010/2: an issue id with directory traversal is refused on validation", async () => {
  const hostile = [
    "..",
    "../..",
    "../../etc",
    "..%2f..",
    "..%2f..%2fetc%2fpasswd",
    "/etc/passwd",
    "docs/issues/open/20260107-feat-fixture-twocases",
    "20260107-feat-fixture-twocases/../../../../etc",
  ];

  for (const id of hostile) {
    const res = await postPrepare({ confirm: true, tcId: TC_ID }, encodeURIComponent(id));
    assert.ok(
      res.status >= 400 && res.status < 500,
      `issue id ${JSON.stringify(id)} was answered with ${res.status}, not a 4xx refusal: ${res.text}`
    );
    assert.ok(res.json, `issue id ${JSON.stringify(id)} produced no JSON answer`);
    assertDecoyDormant(`step 2 (${id})`);
  }
});

test("TC-010/3: the status segment is not a parameter — exactly two values, neither from the caller", async () => {
  // There is no status in the URL to substitute: the route is
  // .../issues/:id/prepare, and a path that tries to add one is not a route.
  for (const injected of ["open", "closed", "..", "%2e%2e"]) {
    const res = await server.post(`/api/projects/${PROJECT}/issues/${ISSUE_ID}/${injected}/prepare`, {
      confirm: true,
    });
    assert.ok(
      res.status >= 400 && res.status < 500,
      `a status segment ${JSON.stringify(injected)} was accepted with ${res.status}: ${res.text}`
    );
  }

  // And the engine that builds the path accepts nothing but the two.
  for (const status of ["evil", "../closed", "OPEN", "", null, "open/../../..", "open ", " closed"]) {
    const report = await prepare.runPrepare({
      projectRoot: repo.root,
      issueId: ISSUE_ID,
      status,
      tcId: TC_ID,
    });
    assert.strictEqual(report.ok, false, `status ${JSON.stringify(status)} was accepted`);
    assert.strictEqual(report.reason, "invalid-status", `status ${JSON.stringify(status)}: ${report.reason}`);
  }
  for (const status of ["open", "closed"]) {
    assert.strictEqual(
      prepare.setupScriptPath({ projectRoot: "/p", status, issueId: ISSUE_ID }),
      path.join("/p", "docs", "issues", status, ISSUE_ID, "test-data", "setup.mjs"),
      "the whitelist formula changed"
    );
  }
  assertDecoyDormant("step 3");
});

test("TC-010/3b: a closed issue is refused — its archive is read, never re-run", async () => {
  const res = await postPrepare({ confirm: true }, CLOSED_ID);
  assert.ok(res.status >= 400 && res.status < 500, `expected a 4xx refusal, got ${res.status}: ${res.text}`);
  assert.strictEqual(res.json.ok, false);
  assert.strictEqual(res.json.ran, false);
  assert.strictEqual(res.json.error, "issue_closed");
  assert.ok(res.json.message && res.json.message.length > 0, "the refusal must explain itself");

  // Reading the same issue's documents is unaffected — closed is an archive,
  // not a locked room.
  const doc = await server.get(
    `/api/projects/${PROJECT}/issues/${CLOSED_ID}/docs?path=${encodeURIComponent(
      `docs/issues/closed/${CLOSED_ID}/brd.md`
    )}`
  );
  assert.strictEqual(doc.status, 200, `a closed issue's documents must stay readable: ${doc.text}`);
  assertDecoyDormant("step 3b");
});

test("TC-010/4: shell metacharacters in an issue id are refused, not interpreted", async () => {
  const hostile = [
    `${ISSUE_ID}; rm -rf /`,
    `${ISSUE_ID} && node ${decoyScript}`,
    `${ISSUE_ID}; node ${decoyScript}`,
    `${ISSUE_ID} | node ${decoyScript}`,
    "$(id)",
    `$(node ${decoyScript})`,
    "`id`",
    `\`node ${decoyScript}\``,
    `${ISSUE_ID}\nnode ${decoyScript}`,
    `${ISSUE_ID}$(node ${decoyScript})`,
  ];

  for (const id of hostile) {
    const res = await postPrepare({ confirm: true }, encodeURIComponent(id));
    assert.ok(
      res.status >= 400 && res.status < 500,
      `issue id ${JSON.stringify(id)} was answered with ${res.status}: ${res.text}`
    );
    assertDecoyDormant(`step 4 (${id})`);
  }

  // The same characters in the only field the caller does contribute.
  for (const tcId of ["TC-001; id", "TC-001 && id", "$(id)", "`id`", "TC-1", "tc-001", "../TC-001", 1, true, {}]) {
    const res = await postPrepare({ confirm: true, tcId });
    assert.strictEqual(res.status, 400, `tcId ${JSON.stringify(tcId)} was answered with ${res.status}: ${res.text}`);
    assert.strictEqual(res.json.error, "invalid_tc_id");
    assert.strictEqual(res.json.ran, false);
    assertDecoyDormant(`step 4 (tcId ${JSON.stringify(tcId)})`);
  }
});

test("TC-010/5: the sources start no shell and build no command line", () => {
  const serverSrc = codeOf(readSource("server.js"));
  const prepareSrc = codeOf(readSource("lib/prepare.js"));

  // A bare call to one of these — as opposed to `regex.exec(...)`, which is a
  // different function altogether.
  const RUNNERS = /(?<![.\w])(exec|execSync|execFile|execFileSync|spawn|spawnSync|fork)\s*\(/;
  const SHELL_RUNNERS = /(?<![.\w])(exec|execSync|spawn|spawnSync)\s*\(/;

  // The server starts no process at all: the whole executing surface is one
  // call into lib/prepare.js.
  assert.ok(!/require\(["']node:child_process["']\)/.test(serverSrc), "server.js reaches for child_process itself");
  assert.ok(!RUNNERS.test(serverSrc), "server.js starts a process of its own");
  assert.match(serverSrc, /prepare\.runPrepare\(/, "server.js no longer prepares through lib/prepare.js");

  // And lib/prepare.js starts it with an argument array, never a string.
  assert.match(prepareSrc, /execFile\(\s*process\.execPath,\s*args,/, "the script is no longer started via execFile(argv[])");
  assert.match(prepareSrc, /shell:\s*false/, "execFile is no longer pinned to shell: false");
  assert.ok(!SHELL_RUNNERS.test(prepareSrc), "lib/prepare.js gained a runner that takes a command line");

  for (const [label, src] of [["server.js", serverSrc], ["lib/prepare.js", prepareSrc]]) {
    assert.ok(!/shell\s*:\s*true/.test(src), `${label}: a shell is enabled somewhere`);
    assert.ok(!/\/bin\/(sh|bash)|cmd\.exe|powershell/i.test(src), `${label}: names a shell interpreter`);
  }

  // No string is ever interpolated into something that is run: the arguments
  // are an array built from validated values.
  assert.match(prepareSrc, /const args = \[scriptPath\];/, "the argument array is no longer built from the resolved path");
});

test("TC-010/6: without confirmation nothing is started", async () => {
  for (const body of [{}, { tcId: TC_ID }, { confirm: false }, { confirm: "true" }, { confirm: 1 }, { confirm: null }]) {
    wipePreparedData();
    const res = await postPrepare(body);

    assert.strictEqual(res.status, 400, `body ${JSON.stringify(body)} was answered with ${res.status}: ${res.text}`);
    assert.strictEqual(res.json.error, "confirmation_required");
    assert.strictEqual(res.json.ok, false);
    assert.strictEqual(res.json.ran, false);
    assert.ok(
      !fs.existsSync(preparedIssueRoot(ISSUE_ID)),
      `body ${JSON.stringify(body)}: the script ran without confirmation`
    );
    assertDecoyDormant(`step 6 (${JSON.stringify(body)})`);
  }

  // A body that is valid JSON but not a request: still a refusal, never a 500.
  for (const raw of ["null", "[]", '"confirm"', "true", "not json at all"]) {
    wipePreparedData();
    const res = await server.post(prepareUrl(ISSUE_ID), raw);
    assert.strictEqual(res.status, 400, `body ${raw} was answered with ${res.status}: ${res.text}`);
    assert.strictEqual(res.json.error, "invalid_json_body");
    assert.ok(!fs.existsSync(preparedIssueRoot(ISSUE_ID)), `body ${raw}: the script ran anyway`);
    assertDecoyDormant(`step 6 (${raw})`);
  }

  // Confirmation is the only thing that was missing.
  const ok = await postPrepare({ confirm: true, tcId: TC_ID });
  assert.strictEqual(ok.status, 200, `the confirmed request must succeed: ${ok.text}`);
  assert.ok(fs.existsSync(preparedWorkdir(ISSUE_ID, TC_ID)));
});

test("TC-010/7: none of it touched the repository, and the decoy never ran", () => {
  assert.strictEqual(
    execFileSync("git", ["status", "--porcelain"], { cwd: repo.root, encoding: "utf8" }),
    "",
    "the prepare route dirtied the working tree"
  );
  assertSameSnapshot(REPO_BEFORE, snapshotWorkingTree(repo.root), "the prepare route changed the checkout");
  assertDecoyDormant("the whole suite");
});
