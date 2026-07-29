// TC-003 — repeated preparation is idempotent, and one case does not disturb
// another.
//
// The "prepare" button is also the "reset" button: every run rebuilds the
// working copy from the fixtures under git, whatever the previous run did to
// it. There is no teardown step, and a tester never has to work out what a
// failed run changed. Preparing one case leaves every other case alone.
//
// Comparisons are content snapshots (relative path + sha256), never mtimes:
// rewriting a file with identical bytes is exactly what an idempotent script
// does and must count as "unchanged".
//
// Run: node --test test/prepare-idempotency.test.js
"use strict";

const test = require("node:test");
const { after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fixtures = require("./helpers/fixtures");

const isolated = fixtures.isolateTempRoot("pf-prepare-tc003-");

const { snapshot, assertSameSnapshot, assertSnapshotDiffers } = require("./helpers/snapshot");
const { runPrepare, preparedWorkdir, preparedIssueRoot } = require("../lib/prepare");

const ISSUE_ID = "20260107-feat-fixture-twocases";

const repo = fixtures.makeTempRepo({ issues: [ISSUE_ID], name: "idempotency" });
const fixturesDir = path.join(repo.issuePath(ISSUE_ID), "test-data", "fixtures");

after(() => {
  fixtures.cleanupAll();
  isolated.restore();
});

function prepare(tcId) {
  return runPrepare({ projectRoot: repo.root, issueId: ISSUE_ID, status: "open", tcId });
}

async function prepareOk(tcId) {
  const report = await prepare(tcId);
  assert.ok(report.ok, `preparing ${tcId} failed: ${report.reason} — ${report.message}\n${report.stderr}`);
  return report;
}

function workdir(tcId) {
  return preparedWorkdir(ISSUE_ID, tcId);
}

function abs(root, relPath) {
  return path.join(root, ...relPath.split("/"));
}

// Every assertion below is relative to this: the state a first, clean run
// produces. Captured once, in step 1, and never recomputed.
let S1 = null;

test("TC-003/1: a first run produces the reference state", async () => {
  fs.rmSync(preparedIssueRoot(ISSUE_ID), { recursive: true, force: true });

  await prepareOk("TC-001");
  S1 = snapshot(workdir("TC-001"));

  assert.ok(S1.length > 0, "the reference snapshot is empty — nothing was unpacked");
  assert.ok(
    !fs.existsSync(path.join(preparedIssueRoot(ISSUE_ID), ".staging")),
    "the staging directory must not survive a successful run"
  );
});

test("TC-003/2: a ruined working copy really is different", () => {
  fs.appendFileSync(abs(workdir("TC-001"), "case-a/input.txt"), "the tester typed this\n", "utf8");
  fs.rmSync(abs(workdir("TC-001"), "prelude/common.json"));
  fs.writeFileSync(abs(workdir("TC-001"), "case-a/junk.tmp"), "left over from a run\n", "utf8");

  assertSnapshotDiffers(S1, snapshot(workdir("TC-001")), "the fixture corruption did not take");
});

test("TC-003/3: preparing again restores the reference state exactly", async () => {
  await prepareOk("TC-001");

  // All three kinds of damage, named separately so a failure says which one.
  const restored = snapshot(workdir("TC-001"));
  const byPath = new Map(restored.map((e) => [e.relPath, e]));
  assert.ok(byPath.has("prelude/common.json"), "the deleted file was not restored");
  assert.ok(!byPath.has("case-a/junk.tmp"), "the extra file was not removed");
  assert.deepStrictEqual(
    fs.readFileSync(abs(workdir("TC-001"), "case-a/input.txt")),
    fs.readFileSync(abs(fixturesDir, "case-a/input.txt")),
    "the edited file was not restored"
  );

  assertSameSnapshot(S1, restored, "a repeated run did not reproduce the reference state");
});

test("TC-003/4: resetting one case does not touch another", async () => {
  await prepareOk("TC-002");
  const S2 = snapshot(workdir("TC-002"));
  assert.ok(S2.length > 0, "TC-002 was not unpacked");

  await prepareOk("TC-001");

  assertSameSnapshot(S2, snapshot(workdir("TC-002")), "preparing TC-001 disturbed TC-002");
  assertSameSnapshot(S1, snapshot(workdir("TC-001")), "TC-001 drifted from the reference state");
});

test("TC-003/5: three consecutive runs are three identical results", async () => {
  for (let run = 1; run <= 3; run++) {
    const report = await prepareOk("TC-001");
    assert.strictEqual(report.exitCode, 0, `run ${run} did not exit 0`);
    assertSameSnapshot(S1, snapshot(workdir("TC-001")), `run ${run} produced a different state`);
    assert.ok(
      !fs.existsSync(path.join(preparedIssueRoot(ISSUE_ID), ".staging")),
      `run ${run} left its staging directory behind`
    );
  }
});

test("TC-003/6: nested directories, a .gitkeep directory and non-ASCII content survive", () => {
  const dir = workdir("TC-001");

  // A directory two levels down, not just a file in the root of the copy.
  const nested = abs(dir, "case-a/nested/deep/note.md");
  assert.ok(fs.existsSync(nested), "the nested fixture directory was not reproduced");

  // Git cannot store an empty directory, so the fixture holds a .gitkeep —
  // and the prepared copy must hold it too, or the directory is simply gone.
  const gitkeep = abs(dir, "case-a/empty-dir/.gitkeep");
  assert.ok(fs.existsSync(gitkeep), "the .gitkeep directory was not reproduced");
  assert.strictEqual(fs.statSync(gitkeep).size, 0, ".gitkeep must stay empty");

  // Byte for byte, and UTF-8 without a BOM: a copy that re-encodes would pass
  // a string comparison and fail a tester diffing the file.
  const relPath = "case-a/nested/deep/note.md";
  const prepared = fs.readFileSync(nested);
  assert.deepStrictEqual(prepared, fs.readFileSync(abs(fixturesDir, relPath)), `${relPath} was not copied byte for byte`);
  assert.ok(
    [...prepared.toString("utf8")].some((ch) => ch.codePointAt(0) > 127),
    `${relPath} is meant to carry non-ASCII text`
  );
  assert.notDeepStrictEqual([...prepared.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${relPath} gained a BOM`);
});

test("TC-003/6: the non-ASCII cell of the other case is byte identical too", async () => {
  await prepareOk("TC-002");
  const prepared = fs.readFileSync(abs(workdir("TC-002"), "case-b/input.csv"));
  const source = fs.readFileSync(abs(fixturesDir, "case-b/input.csv"));
  assert.deepStrictEqual(prepared, source, "case-b/input.csv was not copied byte for byte");
  assert.ok(prepared.toString("utf8").includes("Ёлка"), "the non-ASCII cell did not survive");
  assert.notDeepStrictEqual([...prepared.subarray(0, 3)], [0xef, 0xbb, 0xbf], "case-b/input.csv gained a BOM");
});
