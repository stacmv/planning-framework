"use strict";

// TC-014 — regression: the git-facing half of the checklist tool.
//
// Everything here was true before this issue's work and must stay true after
// it: issues are enumerated from the project's *default* branch via
// `git ls-tree`, never from whatever happens to be checked out; the three
// checklist states (`here` / `on_branch` / `missing`) are told apart and a
// `missing` one names the stage that creates it; writing into a checklist
// that only exists on its own branch is refused with 409 and the branch
// name; `checkout` refuses a dirty working tree without touching a single
// file or moving off the current branch; and — the stitch with the other
// half of this issue (AC-03a) — a series of `prepare` runs never leaves
// `git status --porcelain` non-empty, so the checkout guard never trips on
// prepared test data that was never really in the working tree.
//
// Run: node --test tools/manual-test-ui/test/checklist-git.test.js

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fixtures = require("./helpers/fixtures");
const { startServerFor } = require("./helpers/server");
const { snapshotWorkingTree, assertSameSnapshot } = require("./helpers/snapshot");

const FULL = "20260101-feat-fixture-full"; // checklistStatus "here"
const ONBRANCH = "20260104-feat-fixture-onbranch"; // checklistStatus "on_branch"
const NOQA = "20260106-feat-fixture-noqa"; // checklistStatus "missing"
const TWOCASES = "20260107-feat-fixture-twocases"; // has test-data/setup.mjs

function setUp(t, options) {
  const repo = fixtures.makeTempRepo(options);
  const config = fixtures.makeConfig({ projects: [{ name: "main", path: repo.root, defaultBranch: "develop" }] });
  t.after(() => fixtures.cleanupAll());
  return { repo, config };
}

// ---------------------------------------------------------------------------
// Step 1 — issues come from the default branch, not from the checkout
// ---------------------------------------------------------------------------

test("TC-014 step 1: issue listing reads the default branch, not the checked-out one", async (t) => {
  const { repo, config } = setUp(t, { issues: [FULL, ONBRANCH, NOQA], name: "list" });

  // A genuinely unrelated branch: it diverges from develop by *removing* an
  // issue directory, so "the listing survived a foreign checkout" is a real
  // claim rather than a coincidence of the two branches being identical.
  repo.run(["checkout", "--quiet", "-b", "feature/unrelated"]);
  fs.rmSync(repo.issuePath(NOQA), { recursive: true, force: true });
  repo.run(["add", "-A"]);
  repo.run(["commit", "--quiet", "-m", "fixture: unrelated branch without noqa"]);
  assert.strictEqual(repo.currentBranch(), "feature/unrelated", "precondition: on the unrelated branch");
  assert.ok(!fs.existsSync(repo.issuePath(NOQA)), "precondition: noqa's directory is gone on this branch");

  const server = await startServerFor(t, { configPath: config.configPath });
  const res = await server.get("/api/projects/main/issues");
  assert.strictEqual(res.status, 200, res.text);
  assert.strictEqual(res.json.currentBranch, "feature/unrelated");
  assert.strictEqual(res.json.defaultBranch, "develop");

  const ids = res.json.issues.map((i) => i.issueId).sort();
  assert.deepStrictEqual(ids, [FULL, NOQA, ONBRANCH].sort(), `expected all three fixture issues, got: ${ids.join(", ")}`);

  assert.strictEqual(repo.currentBranch(), "feature/unrelated", "listing issues must not itself switch branches");
});

// ---------------------------------------------------------------------------
// Step 2 — the three checklist states, and the stage a missing one names
// ---------------------------------------------------------------------------

test("TC-014 step 2: here / on_branch / missing are told apart, and missing names its stage", async (t) => {
  const { repo, config } = setUp(t, { issues: [FULL, ONBRANCH, NOQA], name: "states" });
  const server = await startServerFor(t, { configPath: config.configPath });

  const res = await server.get("/api/projects/main/issues");
  assert.strictEqual(res.status, 200, res.text);
  const byId = Object.fromEntries(res.json.issues.map((i) => [i.issueId, i]));

  assert.strictEqual(byId[FULL].checklistStatus, "here");
  assert.strictEqual(byId[ONBRANCH].checklistStatus, "on_branch");
  assert.strictEqual(byId[NOQA].checklistStatus, "missing");

  const noqaChecklistRel = encodeURIComponent(`docs/issues/open/${NOQA}/manual_test_checklist.md`);
  const doc = await server.get(`/api/projects/main/issues/${NOQA}/docs?path=${noqaChecklistRel}`);
  assert.strictEqual(doc.status, 200, doc.text);
  assert.strictEqual(doc.json.status, "missing");
  assert.strictEqual(doc.json.stage, "/pf-test", "a missing checklist must name the stage that creates it");
});

// ---------------------------------------------------------------------------
// Step 3 — writing into an on_branch checklist is refused, with the branch
// ---------------------------------------------------------------------------

test("TC-014 step 3: patching a checklist that only exists on its own branch is refused with 409 and the branch name", async (t) => {
  const { repo, config } = setUp(t, { issues: [ONBRANCH], name: "onbranch-write" });
  const server = await startServerFor(t, { configPath: config.configPath });

  const res = await server.patch(`/api/projects/main/issues/${ONBRANCH}/checklist/steps`, {
    tcId: "TC-001",
    step: 1,
    checked: true,
    note: "should not be written",
  });

  assert.strictEqual(res.status, 409, res.text);
  assert.strictEqual(res.json.checklistStatus, "on_branch");
  assert.strictEqual(res.json.branch, `issue/${ONBRANCH}`, "the refusal must name the branch the checklist lives on");
  assert.ok(!fs.existsSync(repo.checklistPath(ONBRANCH)), "the refused write must not have created a checklist on disk");
});

// ---------------------------------------------------------------------------
// Step 4 — checkout refuses a dirty working tree, untouched
// ---------------------------------------------------------------------------

test("TC-014 step 4: checkout refuses a dirty working tree, changing neither files nor branch", async (t) => {
  const { repo, config } = setUp(t, { issues: [ONBRANCH], name: "dirty-checkout" });
  const server = await startServerFor(t, { configPath: config.configPath });

  const readmePath = path.join(repo.root, "README.md");
  fs.appendFileSync(readmePath, "an uncommitted line\n");
  assert.ok(!repo.isClean(), "precondition: the working tree must be dirty");

  const branchBefore = repo.currentBranch();
  const treeBefore = snapshotWorkingTree(repo.root);

  const res = await server.post(`/api/projects/main/issues/${ONBRANCH}/checklist/checkout`, {});

  assert.strictEqual(res.status, 409, res.text);
  assert.strictEqual(res.json.error, "dirty_working_tree");
  assert.strictEqual(repo.currentBranch(), branchBefore, "a refused checkout must not move off the current branch");
  assertSameSnapshot(treeBefore, snapshotWorkingTree(repo.root), "a refused checkout must not touch a single file");

  // The dirty edit was ours to make, so it is ours to remove — the fixture
  // repository is thrown away regardless, but the test plan asks for it back
  // explicitly (test data note for step 4).
  repo.run(["checkout", "--quiet", "--", "README.md"]);
  assert.ok(repo.isClean(), "the dirty edit should have been cleanly reverted");
});

// ---------------------------------------------------------------------------
// Step 5 — checkout succeeds on a clean tree, by explicit request
// ---------------------------------------------------------------------------

test("TC-014 step 5: checkout succeeds on a clean tree, by explicit confirmation", async (t) => {
  const { repo, config } = setUp(t, { issues: [ONBRANCH], name: "clean-checkout" });
  const server = await startServerFor(t, { configPath: config.configPath });

  assert.ok(repo.isClean(), "precondition: the working tree must be clean");

  const res = await server.post(`/api/projects/main/issues/${ONBRANCH}/checklist/checkout`, {});
  assert.strictEqual(res.status, 200, res.text);
  assert.strictEqual(res.json.ok, true);
  assert.strictEqual(res.json.branch, `issue/${ONBRANCH}`);
  assert.strictEqual(repo.currentBranch(), `issue/${ONBRANCH}`);

  // And the checklist really is editable now — the other side of the
  // classification this suite pins in step 2.
  const checklist = await server.get(`/api/projects/main/issues/${ONBRANCH}/checklist`);
  assert.strictEqual(checklist.status, 200, checklist.text);
  assert.strictEqual(checklist.json.checklistStatus, "here");
});

// ---------------------------------------------------------------------------
// Step 6 — a series of prepare runs never dirties the tree, so the guard
// never trips on data that was only ever unpacked outside the repository
// ---------------------------------------------------------------------------

test("TC-014 step 6: preparing a whole issue and one of its cases leaves the tree clean, and a branch checkout right after still succeeds", async (t) => {
  // setup.mjs unpacks under `<tmpdir>/pf-test-data/<ISSUE-ID>`; isolate that
  // root so this suite cannot collide with another one running in parallel,
  // and cannot leave anything behind in the developer's real /tmp.
  const isolated = fixtures.isolateTempRoot("pf-ui-tc014-");
  t.after(() => {
    fixtures.cleanupAll();
    isolated.restore();
  });

  const repo = fixtures.makeTempRepo({ issues: [TWOCASES, ONBRANCH], name: "prepare-then-checkout" });
  const config = fixtures.makeConfig({ projects: [{ name: "main", path: repo.root, defaultBranch: "develop" }] });
  const server = await startServerFor(t, { configPath: config.configPath });

  assert.ok(repo.isClean(), "precondition: the working tree must start clean");
  const treeBefore = snapshotWorkingTree(repo.root);

  const whole = await server.post(`/api/projects/main/issues/${TWOCASES}/prepare`, { confirm: true });
  assert.strictEqual(whole.status, 200, whole.text);
  assert.ok(whole.json.ok, `preparing the whole issue failed: ${whole.text}`);

  const oneCase = await server.post(`/api/projects/main/issues/${TWOCASES}/prepare`, { confirm: true, tcId: "TC-001" });
  assert.strictEqual(oneCase.status, 200, oneCase.text);
  assert.ok(oneCase.json.ok, `preparing TC-001 failed: ${oneCase.text}`);

  assert.ok(repo.isClean(), "a series of prepare runs left the working tree dirty");
  assertSameSnapshot(treeBefore, snapshotWorkingTree(repo.root), "preparing test data changed the checkout");

  // The stitch: the guard that refused a genuinely dirty tree in step 4 must
  // not confuse "data was prepared" with "the tree is dirty" — checkout of an
  // unrelated issue's branch must go through exactly as it would have before
  // anything was prepared.
  const checkout = await server.post(`/api/projects/main/issues/${ONBRANCH}/checklist/checkout`, {});
  assert.strictEqual(checkout.status, 200, checkout.text);
  assert.strictEqual(repo.currentBranch(), `issue/${ONBRANCH}`);
  assert.ok(repo.isClean(), "checking out a branch right after preparing data left the tree dirty");
});
