// TC-004 — preparing data does not change the repository, and the data
// travels with the issue.
//
// The most expensive requirement of this issue, and the one that decided the
// design. If preparation left files inside the checkout, the working tree
// would go dirty: the UI would refuse to check out a branch and the pre-close
// quality gate would fail on its mandatory `git status --porcelain`. Hence the
// split — the *fixtures* and the script live under git, the *working copy* is
// unpacked under the system temp directory.
//
// Two consequences are checked here rather than assumed:
//   - any number of runs, of any shape, leave the tree byte for byte as it was;
//   - a fresh clone of the repository, with the issue already closed, can
//     still prepare the data with no extra steps — "another machine, later".
//
// Run: node --test test/prepare-repo-state.test.js
"use strict";

const test = require("node:test");
const { after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const fixtures = require("./helpers/fixtures");

const isolated = fixtures.isolateTempRoot("pf-prepare-tc004-");

const { snapshotWorkingTree, assertSameSnapshot } = require("./helpers/snapshot");
const { runPrepare, preparedWorkdir, preparedIssueRoot, parsePrepareOutput } = require("../lib/prepare");

const ISSUE_ID = "20260107-feat-fixture-twocases";

const repo = fixtures.makeTempRepo({ issues: [ISSUE_ID], name: "repo-state" });

after(() => {
  fixtures.cleanupAll();
  isolated.restore();
});

function porcelain(root = repo.root) {
  return execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
}

function abs(root, relPath) {
  return path.join(root, ...relPath.split("/"));
}

async function prepareOk(tcId) {
  const report = await runPrepare({ projectRoot: repo.root, issueId: ISSUE_ID, status: "open", tcId });
  assert.ok(report.ok, `preparing ${tcId || "the whole issue"} failed: ${report.reason} — ${report.message}\n${report.stderr}`);
  return report;
}

// Captured before the first run; every later assertion compares against it.
let treeBefore = null;

test("TC-004/1: the fixture repository starts clean", () => {
  assert.strictEqual(porcelain(), "", "the fixture repository is dirty before anything ran");
  treeBefore = snapshotWorkingTree(repo.root);
  assert.ok(treeBefore.length > 0, "the fixture repository is empty");
});

test("TC-004/2-3: five assorted runs leave the repository untouched", async () => {
  // Whole issue, one case, the same case again, the other case, whole issue —
  // deliberately mixed, because a script that only misbehaves on repeat runs
  // would survive five identical ones.
  const runs = [null, "TC-001", "TC-001", "TC-002", null];
  for (const [index, tcId] of runs.entries()) {
    const report = await prepareOk(tcId);
    assert.ok(report.prepared.length > 0, `run ${index + 1} prepared nothing`);
  }

  assert.strictEqual(porcelain(), "", "preparing data left the working tree dirty");
  assertSameSnapshot(treeBefore, snapshotWorkingTree(repo.root), "preparing data changed the checkout");
});

test("TC-004/4: the working copy is outside the repository and inside the temp directory", async () => {
  const report = await prepareOk("TC-001");
  const [entry] = report.prepared;

  const relative = path.relative(repo.root, entry.workdir);
  assert.ok(
    relative.startsWith(".."),
    `the working copy must not be inside the repository, but is at ${relative}`
  );

  const tmp = fs.realpathSync(os.tmpdir());
  assert.ok(
    fs.realpathSync(entry.workdir).startsWith(tmp + path.sep),
    `the working copy must live under the system temp directory, but is at ${entry.workdir}`
  );
  assert.strictEqual(entry.workdir, preparedWorkdir(ISSUE_ID, "TC-001"));
});

test("TC-004/5: re-preparing a ruined working copy still leaves the repository clean", async () => {
  const workdir = preparedWorkdir(ISSUE_ID, "TC-001");
  fs.writeFileSync(path.join(workdir, "ruined.tmp"), "a run happened here\n", "utf8");
  fs.rmSync(abs(workdir, "prelude/common.json"));

  await prepareOk("TC-001");

  assert.strictEqual(porcelain(), "", "recovering a ruined working copy dirtied the repository");
  assertSameSnapshot(treeBefore, snapshotWorkingTree(repo.root), "recovering a ruined working copy changed the checkout");
});

test("TC-004/6: the script and every fixture are tracked by git", () => {
  const tracked = execFileSync("git", ["ls-files", `docs/issues/open/${ISSUE_ID}/test-data/`], {
    cwd: repo.root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .map((p) => p.replace(`docs/issues/open/${ISSUE_ID}/test-data/`, ""));

  assert.ok(tracked.includes("setup.mjs"), "setup.mjs is not under git — it would not survive a clone");
  for (const relPath of [
    "fixtures/prelude/common.json",
    "fixtures/case-a/input.txt",
    "fixtures/case-a/nested/deep/note.md",
    "fixtures/case-a/empty-dir/.gitkeep",
    "fixtures/case-b/input.csv",
  ]) {
    assert.ok(tracked.includes(relPath), `${relPath} is generated rather than committed`);
  }
});

test("TC-004/7: a fresh clone of the closed issue prepares its data unaided", () => {
  // Closing the issue is a plain rename under git, in its own commit — the
  // path the framework really takes when an issue is closed.
  execFileSync("git", ["mv", `docs/issues/open/${ISSUE_ID}`, `docs/issues/closed/${ISSUE_ID}`], {
    cwd: repo.root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  execFileSync("git", ["commit", "--quiet", "-m", `fixture: close ${ISSUE_ID}`], {
    cwd: repo.root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.strictEqual(porcelain(), "", "closing the issue left the tree dirty");

  // "Another machine": nothing but what git carries.
  const cloneParent = fixtures.makeTempDir("pf-prepare-clone-");
  const clone = path.join(cloneParent, "clone");
  execFileSync("git", ["clone", "--quiet", "--local", repo.root, clone], { stdio: ["ignore", "pipe", "pipe"] });

  const scriptPath = path.join(clone, "docs", "issues", "closed", ISSUE_ID, "test-data", "setup.mjs");
  assert.ok(fs.existsSync(scriptPath), "the setup script did not survive the clone");

  fs.rmSync(preparedIssueRoot(ISSUE_ID), { recursive: true, force: true });
  const stdout = execFileSync(process.execPath, [scriptPath], { cwd: clone, encoding: "utf8" });

  const { prepared } = parsePrepareOutput(stdout);
  assert.deepStrictEqual(prepared.map((p) => p.tcId).sort(), ["TC-001", "TC-002"], "the clone prepared the wrong cases");
  for (const entry of prepared) {
    for (const relPath of entry.files) {
      assert.deepStrictEqual(
        fs.readFileSync(abs(entry.workdir, relPath)),
        fs.readFileSync(abs(path.join(clone, "docs", "issues", "closed", ISSUE_ID, "test-data", "fixtures"), relPath)),
        `${entry.tcId}: ${relPath} differs from the fixture in the clone`
      );
    }
  }

  assert.strictEqual(porcelain(clone), "", "preparing data in a fresh clone dirtied it");
});
