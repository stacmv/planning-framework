// TC-017 — any configured project, and the edge configurations the tool is
// easy to get wrong on.
//
// Every other suite in this directory drives the server against a project
// named "main" and calls it a day. That leaves one question unanswered: does
// any of this — role contents, document states, instructions, memory,
// preparing a case — actually key off the *project being asked about*, or did
// something quietly key off the directory the server happens to run from, or
// off "main" by name? The fixture below configures three projects at once
// (main, other, bare) against a single running server and asks every
// question TC-006/TC-007/TC-008 already ask, but about "other" — the project
// the server was *not* started "for".
//
// Plus the edge configurations that break a naive implementation outright:
// a project with no issues at all, a directory that is not a git repository,
// a project discovered under `projectRoots` coexisting with one configured
// outside it, and a project whose name and default branch are both
// explicitly overridden in config rather than inferred.
//
// Run: node --test test/multi-project.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fixtures = require("./helpers/fixtures");
const { makeTempRepo, makeMemoryRoot, makeConfig, makeTempDir, writeFileTree, slugForProjectPath, autoCleanup } = fixtures;
const { startServerFor } = require("./helpers/server");

// Before anything reads os.tmpdir(): the prepare step (step 4) unpacks to a
// path derived from the issue id under the system temp directory, which
// parallel suite processes would otherwise share (see prepare.test.js).
const isolated = fixtures.isolateTempRoot("pf-ui-multi-project-");
test.after(() => isolated.restore());

const { preparedWorkdir, preparedIssueRoot } = require("../lib/prepare");

const FULL = "20260101-feat-fixture-full";
const TRIVIAL = "20260105-improve-fixture-trivial";
const DECLARED = "20260109-feat-fixture-declared";

const ROLE_IDS = ["analyst", "developer", "tester"];
const STATES = ["present", "not_applicable", "missing"];

async function fetchRole(server, project, issueId, roleId) {
  const url = `/api/projects/${project}/issues/${issueId}/roles/${roleId}`;
  const res = await server.get(url);
  assert.strictEqual(res.status, 200, `GET ${url} → ${res.status}: ${res.text}`);
  return res.json;
}

async function allRoleItems(server, project, issueId) {
  const items = [];
  for (const roleId of ROLE_IDS) {
    const payload = await fetchRole(server, project, issueId, roleId);
    for (const item of payload.items) items.push({ roleId, ...item });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Main suite: three projects behind one server (steps 1-6)
// ---------------------------------------------------------------------------

function buildMainFixture(t) {
  autoCleanup(t);

  // "main" — the project the server is conceptually "started for". Mirrors
  // the fixture catalogue TC-006/TC-007 already exercise against it.
  const mainRepo = makeTempRepo({ name: "main", issues: [FULL, TRIVIAL] });

  // "other" — a second, unrelated fixture repository. The one issue on it is
  // the positive prepare control: 1 Manual TC, declared data, a working
  // setup.mjs that creates 2 files (test/helpers/fixtures.js:405).
  const otherRepo = makeTempRepo({ name: "other", issues: [DECLARED] });

  // "bare" — deliberately not a git repository, and deliberately declares no
  // issues at all: both edge configurations of TC-017 steps 5-6 in one
  // fixture, exactly as the implementation plan calls for.
  const bareRepo = makeTempRepo({ name: "not-a-repo", git: false, issues: [] });

  const memRoot = makeMemoryRoot();
  memRoot.addProject({
    projectPath: mainRepo.root,
    memory: { "notes.md": "# Main project memory\n\nRemembered fact about main.\n" },
  });
  memRoot.addProject({
    projectPath: otherRepo.root,
    memory: { "notes.md": "# Other project memory\n\nRemembered fact about other, not main.\n" },
  });

  const config = makeConfig({
    projects: [
      { name: "main", path: mainRepo.root },
      { name: "other", path: otherRepo.root },
      { name: "bare", path: bareRepo.root },
    ],
  });

  return {
    mainRepo,
    otherRepo,
    bareRepo,
    memRoot,
    configPath: config.configPath,
    env: { PLANNING_TEST_UI_MEMORY_ROOT: memRoot.root },
  };
}

test("TC-017: any configured project and edge configurations", async (t) => {
  const fx = buildMainFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath, env: fx.env });

  await t.test("step 1: the project list carries all three entries, each resolved against its own path", async () => {
    const res = await server.get("/api/projects");
    assert.strictEqual(res.status, 200, res.text);
    const byName = new Map(res.json.map((p) => [p.name, p]));
    assert.deepStrictEqual([...byName.keys()].sort(), ["bare", "main", "other"]);

    // "main" and "other" are real git repositories on "develop". Both
    // FULL and TRIVIAL are open issues on "main" — openIssueCount/
    // totalIssueCount count every issue dir (`findIssueDirs`), not "has a
    // manual_test_checklist.md" (dogfooding feedback, 20260806 issue: a
    // checklist-only count reads a project with real open issues as "0
    // issue" until one of them reaches `/pf-test`).
    assert.strictEqual(byName.get("main").defaultBranch, "develop");
    assert.strictEqual(byName.get("main").currentBranch, "develop");
    assert.strictEqual(byName.get("main").openIssueCount, 2, "FULL and TRIVIAL are both open, regardless of which has a checklist");
    assert.strictEqual(byName.get("main").totalIssueCount, 2);
    assert.strictEqual(byName.get("other").defaultBranch, "develop");
    assert.strictEqual(byName.get("other").openIssueCount, 1);
    assert.strictEqual(byName.get("other").totalIssueCount, 1);

    // "bare" is not a git repository at all: git.getCurrentBranch and
    // git.resolveDefaultBranch fail closed to null rather than throwing, and
    // it has no issues.
    assert.strictEqual(byName.get("bare").currentBranch, null);
    assert.strictEqual(byName.get("bare").defaultBranch, null);
    assert.strictEqual(byName.get("bare").openIssueCount, 0);
    assert.strictEqual(byName.get("bare").totalIssueCount, 0);

    // Each name really is backed by its *own* directory, not by whichever
    // project happened to be configured first: every project's own
    // project-level document reads back its own, distinguishable content.
    const mainDoc = await server.get("/api/projects/main/docs?path=README.md");
    const otherDoc = await server.get("/api/projects/other/docs?path=README.md");
    assert.match(mainDoc.json.content, /^# main/);
    assert.match(otherDoc.json.content, /^# other/);
    assert.notStrictEqual(mainDoc.json.content, otherDoc.json.content);
  });

  await t.test("step 2: role contents and document states take the same form for a foreign project", async () => {
    // The same shape TC-006/TC-007 assert of "main": every entry of every
    // role has one of the three valid states and a non-empty message, and a
    // "missing" entry names the stage that creates it.
    const items = await allRoleItems(server, "other", DECLARED);
    assert.ok(items.length >= 15, `expected every role to be listed for a foreign project, got ${items.length}`);
    for (const item of items) {
      assert.ok(STATES.includes(item.status), `other/${item.roleId}/${item.name} has status ${JSON.stringify(item.status)}`);
      assert.ok(item.message && item.message.trim() !== "", `other/${item.roleId}/${item.name} has no message`);
      if (item.status === "missing") {
        assert.ok(
          typeof item.stage === "string" && item.stage.trim() !== "",
          `other/${item.roleId}/${item.name} is missing but names no stage`
        );
      }
    }

    // The prepare action is offered — DECLARED has a checklist on disk and a
    // working setup.mjs — and its endpoint names *this* project and issue.
    const tester = await fetchRole(server, "other", DECLARED, "tester");
    const prepare = tester.items.find((i) => i.name === "prepare");
    assert.strictEqual(prepare.kind, "action");
    assert.strictEqual(prepare.offered, true);
    assert.strictEqual(prepare.endpoint, `/api/projects/other/issues/${DECLARED}/prepare`);

    // The developer role's instructions/memory entries point at the foreign
    // project's own endpoints, not at "main"'s.
    const developer = await fetchRole(server, "other", DECLARED, "developer");
    assert.strictEqual(developer.items.find((i) => i.name === "CLAUDE.md").endpoint, "/api/projects/other/instructions");
    assert.strictEqual(developer.items.find((i) => i.name === "memory").endpoint, "/api/projects/other/memory");
  });

  await t.test("step 3: instructions and memory of a foreign project are keyed by its own path", async () => {
    const instructions = await server.get("/api/projects/other/instructions");
    assert.strictEqual(instructions.status, 200, instructions.text);
    const ownClaude = instructions.json.instructions.find((e) => e.relativePath === "CLAUDE.md");
    assert.ok(ownClaude, "other/CLAUDE.md was not listed");
    assert.match(ownClaude.content, /Claude instructions — other/);
    assert.doesNotMatch(ownClaude.content, /Claude instructions — main/);
    assert.strictEqual(ownClaude.path, path.join(fx.otherRepo.root, "CLAUDE.md"));

    const memory = await server.get("/api/projects/other/memory");
    assert.strictEqual(memory.status, 200, memory.text);
    assert.strictEqual(memory.json.slug, slugForProjectPath(fx.otherRepo.root));
    assert.notStrictEqual(memory.json.slug, slugForProjectPath(fx.mainRepo.root));
    assert.strictEqual(memory.json.state, "present");
    assert.match(memory.json.files[0].relativePath, /notes\.md/);
    const notesRes = await server.get(`/api/projects/other/memory/file?path=notes.md`);
    assert.match(notesRes.json.content, /Remembered fact about other, not main/);

    // The same request against "main" resolves to a different slug and a
    // different file, so the two projects' memory cannot have collapsed
    // into one directory.
    const mainMemory = await server.get("/api/projects/main/memory");
    assert.notStrictEqual(mainMemory.json.slug, memory.json.slug);
  });

  await t.test("step 4: preparing a case in a foreign project works, and touches neither repository", async () => {
    const res = await server.post(`/api/projects/other/issues/${DECLARED}/prepare`, { confirm: true });
    assert.strictEqual(res.status, 200, res.text);
    const body = res.json;
    assert.strictEqual(body.ok, true, `prepare failed: ${body.reason} — ${body.message}`);
    assert.strictEqual(body.project, "other");
    assert.strictEqual(body.issueId, DECLARED);
    assert.strictEqual(body.prepared.length, 1);
    assert.strictEqual(body.prepared[0].tcId, "TC-001");
    assert.strictEqual(body.workdir, preparedWorkdir(DECLARED, "TC-001"));

    // Outside both repositories: under the isolated system temp root, not
    // under either fixture's directory.
    const rel = path.relative(fx.mainRepo.root, body.workdir);
    assert.ok(rel.startsWith(".."), "the working copy must not be nested inside the main repository");
    const rel2 = path.relative(fx.otherRepo.root, body.workdir);
    assert.ok(rel2.startsWith(".."), "the working copy must not be nested inside the other repository");
    assert.ok(fs.existsSync(body.workdir), "the working copy was not created");

    // The two files the fixture's setup.mjs declares, byte for byte.
    assert.strictEqual(fs.readFileSync(path.join(body.workdir, "case-a", "input.txt"), "utf8"), "declared fixture\n");
    assert.strictEqual(fs.readFileSync(path.join(body.workdir, "case-a", "second.txt"), "utf8"), "second declared fixture\n");

    // Neither working copy gained an uncommitted change.
    assert.strictEqual(fx.mainRepo.isClean(), true, "preparing a case in 'other' left 'main' dirty");
    assert.strictEqual(fx.otherRepo.isClean(), true, "preparing a case in 'other' left its own working tree dirty");

    t.after(() => fs.rmSync(preparedIssueRoot(DECLARED), { recursive: true, force: true }));
  });

  await t.test("step 5: a project without a single issue answers 200 with an explained, empty list", async () => {
    const res = await server.get("/api/projects/bare/issues");
    assert.strictEqual(res.status, 200, `expected 200 for a project with no issues, got ${res.status}: ${res.text}`);
    assert.ok(res.json && typeof res.json === "object", "the response must be a structured object, not an empty body");
    assert.deepStrictEqual(res.json.issues, []);
    assert.strictEqual(res.json.currentBranch, null);
    assert.strictEqual(res.json.defaultBranch, null);

    // Asking about a specific (well-formed, non-existent) issue in this
    // project is a plain, explained 404 — never a 500 and never silence.
    const roleRes = await server.get(`/api/projects/bare/issues/20260101-feat-fixture-full/roles/tester`);
    assert.strictEqual(roleRes.status, 404);
    assert.strictEqual(roleRes.json.error, "issue_not_found");
  });

  await t.test("step 6: a non-git project does not corrupt the shared server process", async () => {
    // Read-only sources that need no git at all still answer for the
    // non-git project, in the same request cycle as everything above.
    const instructions = await server.get("/api/projects/bare/instructions");
    assert.strictEqual(instructions.status, 200, instructions.text);
    const memory = await server.get("/api/projects/bare/memory");
    assert.strictEqual(memory.status, 200, memory.text);

    // And "main"/"other" keep answering exactly as before, in the same
    // process, right after the non-git project was queried.
    const res = await server.get("/api/projects");
    assert.strictEqual(res.status, 200);
    const byName = new Map(res.json.map((p) => [p.name, p]));
    assert.strictEqual(byName.get("main").defaultBranch, "develop");
    assert.strictEqual(byName.get("other").defaultBranch, "develop");

    const roles = await fetchRole(server, "main", FULL, "analyst");
    assert.strictEqual(roles.issueId, FULL);
    assert.ok(roles.items.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Edge configuration: a project discovered under `projectRoots` coexisting
// with one configured explicitly, outside that root entirely.
// ---------------------------------------------------------------------------

test("TC-017 edge: a project outside the scanned root coexists with one discovered under it", async (t) => {
  autoCleanup(t);

  const scanRoot = makeTempDir("pf-ui-scanroot-");
  writeFileTree(scanRoot, {
    "discovered-proj/docs/issues/open/.gitkeep": "",
    "discovered-proj/docs/issues/closed/.gitkeep": "",
    "discovered-proj/README.md": "# discovered-proj\n\nFound by scanning projectRoots.\n",
  });

  // Deliberately not under scanRoot: a second, independent temp directory.
  const elsewhere = makeTempRepo({ name: "elsewhere", issues: [] });

  const config = makeConfig({
    projectRoots: [scanRoot],
    projects: [{ name: "elsewhere", path: elsewhere.root }],
  });
  const server = await startServerFor(t, { configPath: config.configPath });

  const res = await server.get("/api/projects");
  assert.strictEqual(res.status, 200, res.text);
  const names = res.json.map((p) => p.name).sort();
  assert.deepStrictEqual(names, ["discovered-proj", "elsewhere"]);

  // Each resolves to its own directory: the discovered one to a plain
  // directory with no git at all, the explicit one to its own repository —
  // neither shadows or reads the other's content.
  const discoveredDoc = await server.get("/api/projects/discovered-proj/docs?path=README.md");
  assert.strictEqual(discoveredDoc.status, 200, discoveredDoc.text);
  assert.match(discoveredDoc.json.content, /Found by scanning projectRoots/);

  const elsewhereDoc = await server.get("/api/projects/elsewhere/docs?path=README.md");
  assert.strictEqual(elsewhereDoc.status, 200, elsewhereDoc.text);
  assert.match(elsewhereDoc.json.content, /^# elsewhere/);
});

// ---------------------------------------------------------------------------
// Edge configuration: explicit name and defaultBranch overrides.
// ---------------------------------------------------------------------------

test("TC-017 edge: explicit name and defaultBranch overrides are honoured", async (t) => {
  autoCleanup(t);

  // FULL exists on the repository's real default branch ("develop"); TRIVIAL
  // is added only on a second branch, "release". Auto-resolution
  // (develop/main/master) would settle on "develop" and never see TRIVIAL —
  // seeing it is proof the configured override actually took effect.
  const repo = makeTempRepo({ name: "override-source", issues: [FULL] });
  repo.run(["checkout", "--quiet", "-b", "release"]);
  const trivialFiles = fixtures.FIXTURE_ISSUES[TRIVIAL].files();
  const prefixed = {};
  for (const [rel, content] of Object.entries(trivialFiles)) prefixed[`docs/issues/open/${TRIVIAL}/${rel}`] = content;
  writeFileTree(repo.root, prefixed);
  repo.run(["add", "-A"]);
  repo.run(["commit", "--quiet", "-m", "fixture: add TRIVIAL only on release"]);
  repo.run(["checkout", "--quiet", "develop"]);

  // The configured project name is unrelated to the repository's directory
  // basename — an explicit override of the name, not an accident of it.
  assert.notStrictEqual(path.basename(repo.root), "renamed-project");

  const overriddenConfig = makeConfig({
    projects: [{ name: "renamed-project", path: repo.root, defaultBranch: "release" }],
  });
  const overriddenServer = await startServerFor(t, { configPath: overriddenConfig.configPath });

  const overridden = await overriddenServer.get("/api/projects/renamed-project/issues");
  assert.strictEqual(overridden.status, 200, overridden.text);
  const overriddenIds = overridden.json.issues.map((i) => i.issueId);
  assert.ok(overriddenIds.includes(FULL), "FULL should still be listed on the overridden branch");
  assert.ok(
    overriddenIds.includes(TRIVIAL),
    "TRIVIAL exists only on 'release' — the defaultBranch override must be what surfaces it"
  );

  const projectsList = await overriddenServer.get("/api/projects");
  const entry = projectsList.json.find((p) => p.name === "renamed-project");
  assert.strictEqual(entry.defaultBranch, "release");

  // Without the override, the same repository (auto-resolved to "develop")
  // must not see TRIVIAL — the contrast that makes the override meaningful.
  const plainConfig = makeConfig({ projects: [{ name: "renamed-project", path: repo.root }] });
  const plainServer = await startServerFor(t, { configPath: plainConfig.configPath });
  const plain = await plainServer.get("/api/projects/renamed-project/issues");
  assert.strictEqual(plain.status, 200, plain.text);
  const plainIds = plain.json.issues.map((i) => i.issueId);
  assert.ok(plainIds.includes(FULL));
  assert.ok(!plainIds.includes(TRIVIAL), "without the override, 'develop' must be picked and TRIVIAL must not appear");
});
