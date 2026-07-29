// TC-002 — preparing a case: readiness, granularity, and running it without
// the tool.
//
// One script per issue, the case is an argument: no argument prepares
// everything, `node setup.mjs TC-002` prepares that case only. The same script
// runs by hand, on any platform the tool runs on, and the location it unpacks
// to is the location written in the checklist — so a tester who never opens
// the UI still finds the data.
//
// "The tool's API" here means `lib/prepare.js`, not an HTTP route: the
// behaviour under test is preparation, and tying the case to routes would make
// it fail for reasons that have nothing to do with it.
//
// Run: node --test test/prepare.test.js
"use strict";

const test = require("node:test");
const { after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");

const fixtures = require("./helpers/fixtures");

// Before anything reads os.tmpdir(): the prepared-data path is derived from
// the issue id, so parallel suite processes would share it otherwise.
const isolated = fixtures.isolateTempRoot("pf-prepare-tc002-");

const { parseChecklist } = require("../lib/checklist");
const { runPrepare, parsePrepareOutput, preparedWorkdir, preparedIssueRoot, setupScriptPath } = require("../lib/prepare");

const ISSUE_ID = "20260107-feat-fixture-twocases";
const CASE_IDS = ["TC-001", "TC-002"];

const repo = fixtures.makeTempRepo({ issues: [ISSUE_ID], name: "prepare" });
const issueDir = repo.issuePath(ISSUE_ID);
const scriptPath = path.join(issueDir, "test-data", "setup.mjs");
const fixturesDir = path.join(issueDir, "test-data", "fixtures");

after(() => {
  fixtures.cleanupAll();
  isolated.restore();
});

// --- helpers ---------------------------------------------------------------

/** Run setup.mjs the way a tester would: node, the script, maybe a case id. */
function runScript(args = []) {
  return new Promise((resolve) => {
    execFile(process.execPath, [scriptPath, ...args], { encoding: "utf8" }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
      resolve({ code, stdout, stderr });
    });
  });
}

function abs(root, relPath) {
  return path.join(root, ...relPath.split("/"));
}

function wipePreparedData() {
  fs.rmSync(preparedIssueRoot(ISSUE_ID), { recursive: true, force: true });
}

/** Every prepared file must equal the fixture under git, byte for byte. */
function assertMatchesFixtures(entry) {
  assert.ok(entry.files.length > 0, `${entry.tcId} reported no files`);
  for (const relPath of entry.files) {
    const prepared = abs(entry.workdir, relPath);
    const source = abs(fixturesDir, relPath);
    assert.ok(fs.existsSync(prepared), `${entry.tcId}: ${relPath} was reported but not created`);
    assert.deepStrictEqual(
      fs.readFileSync(prepared),
      fs.readFileSync(source),
      `${entry.tcId}: ${relPath} differs from the fixture it was copied from`
    );
  }
}

// Step 2 is the reference for step 4; captured rather than recomputed so the
// two really are compared and not just independently re-derived.
let singleCaseByHand = null;

// --- steps -----------------------------------------------------------------

test("TC-002/1: no argument prepares every declared case, byte for byte", async () => {
  wipePreparedData();
  const { code, stdout, stderr } = await runScript();
  assert.strictEqual(code, 0, `exit ${code}; stderr:\n${stderr}`);

  const { prepared, structured } = parsePrepareOutput(stdout);
  assert.ok(structured, `stdout carried no PF-PREPARED lines:\n${stdout}`);
  assert.deepStrictEqual(
    prepared.map((p) => p.tcId).sort(),
    CASE_IDS,
    "both declared cases must be prepared when no case is named"
  );

  for (const entry of prepared) {
    assert.strictEqual(
      entry.workdir,
      preparedWorkdir(ISSUE_ID, entry.tcId),
      "the printed path must be <tmpdir>/pf-test-data/<ISSUE-ID>/<TC-ID>"
    );
    assert.ok(stdout.includes(entry.workdir), "the working copy path must be printed for the tester");
    assert.ok(fs.statSync(entry.workdir).isDirectory(), `${entry.tcId}: no working copy directory`);
    assertMatchesFixtures(entry);
  }
});

test("TC-002/2: a case id prepares that case and only that case", async () => {
  wipePreparedData();
  const { code, stdout, stderr } = await runScript(["TC-002"]);
  assert.strictEqual(code, 0, `exit ${code}; stderr:\n${stderr}`);

  const { prepared } = parsePrepareOutput(stdout);
  assert.deepStrictEqual(prepared.map((p) => p.tcId), ["TC-002"]);
  assert.ok(fs.existsSync(prepared[0].workdir), "TC-002 was not unpacked");
  assert.ok(
    !fs.existsSync(preparedWorkdir(ISSUE_ID, "TC-001")),
    "preparing TC-002 must not create a working copy for TC-001"
  );
  assertMatchesFixtures(prepared[0]);

  singleCaseByHand = { workdir: prepared[0].workdir, files: [...prepared[0].files].sort() };
});

test("TC-002/3: an undeclared case id fails loudly and creates nothing", async () => {
  wipePreparedData();
  const { code, stdout, stderr } = await runScript(["TC-999"]);

  assert.notStrictEqual(code, 0, "an undeclared case id must not exit 0");
  assert.match(stderr, /TC-999/, "stderr must name the id that was not recognised");
  assert.match(stderr, /unknown test case/i, "stderr must say what went wrong, not just fail");
  assert.strictEqual(parsePrepareOutput(stdout).prepared.length, 0, "nothing may be reported as prepared");
  assert.ok(
    !fs.existsSync(preparedIssueRoot(ISSUE_ID)),
    "a rejected case id must not leave a directory behind"
  );
});

test("TC-002/4: the tool's API prepares the same files at the same path", async () => {
  assert.ok(singleCaseByHand, "step 2 must run before step 4");
  wipePreparedData();

  const report = await runPrepare({
    projectRoot: repo.root,
    issueId: ISSUE_ID,
    status: "open",
    tcId: "TC-002",
  });

  assert.ok(report.ok, `runPrepare failed: ${report.reason} — ${report.message}\n${report.stderr}`);
  assert.strictEqual(report.exitCode, 0);
  assert.strictEqual(report.timedOut, false);
  assert.strictEqual(report.scriptPath, setupScriptPath({ projectRoot: repo.root, status: "open", issueId: ISSUE_ID }));
  assert.strictEqual(report.prepared.length, 1);

  const [entry] = report.prepared;
  assert.strictEqual(entry.tcId, "TC-002");
  assert.strictEqual(entry.workdir, singleCaseByHand.workdir, "by hand and through the tool must agree on the path");
  assert.deepStrictEqual([...entry.files].sort(), singleCaseByHand.files, "by hand and through the tool must agree on the files");
  assertMatchesFixtures(entry);

  assert.ok(
    !fs.existsSync(preparedWorkdir(ISSUE_ID, "TC-001")),
    "the tool must honour the case argument as strictly as the command line does"
  );
});

test("TC-002/5: the script is platform independent", () => {
  // Both the shipped template and the instance generated from it: a portable
  // template that the generator mangles is no use to anyone.
  for (const [label, file] of [
    ["template", fixtures.SETUP_TEMPLATE_PATH],
    ["generated", scriptPath],
  ]) {
    const source = fs.readFileSync(file, "utf8");

    assert.ok(!/child_process/.test(source), `${label}: must not reach for sub-processes`);
    assert.ok(!/\bbash\b/i.test(source), `${label}: must not mention a POSIX shell`);
    assert.ok(!/powershell/i.test(source), `${label}: must not mention PowerShell`);
    assert.ok(!/cmd\.exe/i.test(source), `${label}: must not mention the Windows command interpreter`);
    assert.ok(!source.includes("\\\\"), `${label}: must not contain escaped backslashes — those are Windows path literals`);

    // Only the four standard modules the template is allowed to use.
    const imported = [...source.matchAll(/from\s+"(node:[a-z_]+)"/g)].map((m) => m[1]).sort();
    assert.deepStrictEqual([...new Set(imported)], ["node:fs", "node:os", "node:path", "node:url"], `${label}: unexpected imports`);
    assert.ok(!/require\(/.test(source), `${label}: an .mjs script must not use require()`);

    // Every path is composed, never written down: no fs call takes a literal.
    assert.ok(!/fs\.[A-Za-z]+\(\s*["'`]/.test(source), `${label}: no fs call may take a hard-coded path`);
    assert.ok(!/["'`]\/(tmp|var|home|Users)\b/.test(source), `${label}: no absolute path literal`);
    assert.ok(!/["'][A-Za-z]:/.test(source), `${label}: no drive-letter path literal`);
    assert.ok(source.includes("os.tmpdir()"), `${label}: the temp directory must come from the OS`);
    assert.ok(
      (source.match(/path\.join\(/g) || []).length >= 6,
      `${label}: paths must be composed with path.join`
    );
  }
});

test("TC-002/6: the shared prelude is named once and lands in every case", async () => {
  // The `grep -c` of the test plan: one *line* mentioning the shared fixture.
  for (const [label, file] of [
    ["template", fixtures.SETUP_TEMPLATE_PATH],
    ["generated", scriptPath],
  ]) {
    const matching = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.includes("common.json"));
    assert.strictEqual(
      matching.length,
      1,
      `${label}: the shared fixture must be named exactly once, found ${matching.length}: ${matching.join(" / ")}`
    );
  }

  wipePreparedData();
  const { code, stdout } = await runScript();
  assert.strictEqual(code, 0);
  const { prepared } = parsePrepareOutput(stdout);

  const source = fs.readFileSync(abs(fixturesDir, "prelude/common.json"));
  for (const entry of prepared) {
    assert.ok(entry.files.includes("prelude/common.json"), `${entry.tcId}: the shared fixture was not reported`);
    assert.deepStrictEqual(
      fs.readFileSync(abs(entry.workdir, "prelude/common.json")),
      source,
      `${entry.tcId}: the shared fixture differs from the original`
    );
  }
});

test("TC-002/7: the checklist points at the directory the script uses", () => {
  const checklist = parseChecklist(fs.readFileSync(repo.checklistPath(ISSUE_ID), "utf8"));

  for (const tcId of CASE_IDS) {
    const tc = checklist.tcs.find((c) => c.id === tcId);
    assert.ok(tc, `${tcId} is missing from the fixture checklist`);
    assert.strictEqual(
      tc.preparedPath,
      preparedWorkdir(ISSUE_ID, tcId),
      `${tcId}: the checklist prerequisites must name the directory setup.mjs unpacks to`
    );
    assert.ok(
      tc.preparedPath.startsWith(path.join(os.tmpdir(), "pf-test-data")),
      `${tcId}: the documented path must follow <tmpdir>/pf-test-data/<ISSUE-ID>/<TC-ID>`
    );
  }
});
