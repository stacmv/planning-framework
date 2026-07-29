// TC-007 — document states: not applicable, missing (with the stage that
// creates it), present only on the issue branch, and present in a closed
// issue.
//
// The distinction this suite exists for is the one a reader cannot make on
// their own: "this document is not supposed to be here" versus "this
// document has not been written yet". Both look like an absent file on
// disk; only the issue's type and size tier tell them apart, and getting it
// backwards is worse than showing nothing — it sends someone off to write a
// spec that the pipeline never asks for.
//
// The order of the rule is asserted as well as its outcome: a file that
// really exists is reported as present even where the applicability table
// says it should not (steps 3 and 6 rest on that), because the table is a
// rule about what has not happened yet and the file is a fact.
//
// Run: node --test test/doc-states.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");

const { makeTempRepo, makeMemoryRoot, makeConfig, autoCleanup } = require("./helpers/fixtures");
const { startServerFor } = require("./helpers/server");

const docstate = require("../lib/docstate");

const NOSPEC = "20260102-improve-fixture-nospec";
const BUG = "20260103-bug-fixture-analysis";
const ONBRANCH = "20260104-feat-fixture-onbranch";
const TRIVIAL = "20260105-improve-fixture-trivial";
const NOQA = "20260106-feat-fixture-noqa";
const FULL = "20260101-feat-fixture-full";
const CLOSED = "20260112-feat-fixture-closed";

const ROLE_IDS = ["analyst", "developer", "tester"];
const STATES = ["present", "not_applicable", "missing"];

function buildFixture(t, issues) {
  autoCleanup(t);
  const repo = makeTempRepo({ name: "doc-states", issues });
  const memRoot = makeMemoryRoot();
  memRoot.addProject({ projectPath: repo.root });
  const config = makeConfig({ projects: [{ name: "main", path: repo.root }] });
  return { repo, configPath: config.configPath, env: { PLANNING_TEST_UI_MEMORY_ROOT: memRoot.root } };
}

function issueRel(issueId, docName, status = "open") {
  return `docs/issues/${status}/${issueId}/${docName}`;
}

async function fetchDoc(server, issueId, docName, status = "open") {
  const rel = issueRel(issueId, docName, status);
  const res = await server.get(
    `/api/projects/main/issues/${issueId}/docs?path=${encodeURIComponent(rel)}`
  );
  assert.strictEqual(res.status, 200, `GET ${rel} → ${res.status}: ${res.text}`);
  return res.json;
}

async function fetchRole(server, issueId, roleId) {
  const res = await server.get(`/api/projects/main/issues/${issueId}/roles/${roleId}`);
  assert.strictEqual(res.status, 200, `GET role ${roleId} of ${issueId} → ${res.status}: ${res.text}`);
  return res.json;
}

async function allRoleItems(server, issueId) {
  const items = [];
  for (const roleId of ROLE_IDS) {
    const payload = await fetchRole(server, issueId, roleId);
    for (const item of payload.items) items.push({ roleId, ...item });
  }
  return items;
}

test("TC-007: document states", async (t) => {
  const { repo, configPath, env } = buildFixture(t, [FULL, NOSPEC, BUG, ONBRANCH, TRIVIAL, NOQA, CLOSED]);
  const server = await startServerFor(t, { configPath, env });

  await t.test("step 1: a document the pipeline does not produce is not applicable", async () => {
    const doc = await fetchDoc(server, NOSPEC, "specs.md");
    assert.strictEqual(doc.status, "not_applicable");
    // Not "missing": an improve issue is never going to have a spec, and
    // telling the reader to run /pf-spec would be telling them to do
    // something the pipeline does not include.
    assert.notStrictEqual(doc.status, "missing");
    assert.strictEqual(doc.stage, null);
    assert.ok(doc.reason && doc.reason.length > 0, "a not-applicable document must say why");
    assert.ok(doc.message && doc.message.length > 0, "a not-applicable document must not come back as an empty body");
    assert.strictEqual(doc.content, null);

    // The same verdict through the role the document belongs to.
    const developer = await fetchRole(server, NOSPEC, "developer");
    assert.strictEqual(developer.items.find((i) => i.name === "specs.md").status, "not_applicable");
  });

  await t.test("step 2: a document the pipeline does produce is missing, and names its stage", async () => {
    const doc = await fetchDoc(server, NOQA, "qa_report.md");
    assert.strictEqual(doc.status, "missing");
    assert.strictEqual(doc.stage, "/pf-qa");
    assert.match(doc.message, /\/pf-qa/);
    assert.strictEqual(doc.content, null);

    // Its siblings in the same issue are told apart correctly: the ones the
    // feat pipeline produced are present, the ones it does not produce at
    // all are not applicable.
    const tester = await fetchRole(server, NOQA, "tester");
    assert.strictEqual(tester.items.find((i) => i.name === "test_plan.md").status, "present");
    assert.strictEqual(tester.items.find((i) => i.name === "manual_test_checklist.md").stage, "/pf-test");
    const analyst = await fetchRole(server, NOQA, "analyst");
    assert.strictEqual(analyst.items.find((i) => i.name === "analysis.md").status, "not_applicable");
  });

  await t.test("step 3: a bug issue has an analysis, not a BRD", async () => {
    const analysis = await fetchDoc(server, BUG, "analysis.md");
    assert.strictEqual(analysis.status, "present");
    assert.strictEqual(analysis.location, "disk");
    assert.strictEqual(analysis.readonly, false);
    assert.match(analysis.content, /Root cause/);

    const brd = await fetchDoc(server, BUG, "brd.md");
    assert.strictEqual(brd.status, "not_applicable");
    assert.match(brd.reason, /analysis\.md/);

    // And the type came from the issue itself, not from a default.
    const analyst = await fetchRole(server, BUG, "analyst");
    assert.strictEqual(analyst.type, "bug");
  });

  await t.test("step 4: a document that exists only on the issue branch is a read-only preview", async () => {
    const branch = `issue/${ONBRANCH}`;
    assert.notStrictEqual(repo.currentBranch(), branch, "the fixture must not start on the issue branch");

    const doc = await fetchDoc(server, ONBRANCH, "brd.md");
    assert.strictEqual(doc.status, "present");
    assert.strictEqual(doc.location, "branch");
    assert.strictEqual(doc.readonly, true);
    assert.strictEqual(doc.branch, branch);
    assert.strictEqual(doc.content, repo.run(["show", `${branch}:${issueRel(ONBRANCH, "brd.md")}`]));

    // The switch is offered, by name, and is a POST the user has to trigger
    // — never something that happens as a side effect of reading.
    assert.ok(doc.checkout, "no checkout was offered for a branch-only document");
    assert.strictEqual(doc.checkout.branch, branch);
    assert.strictEqual(doc.checkout.method, "POST");
    assert.match(doc.checkout.endpoint, new RegExp(`${ONBRANCH}/checklist/checkout$`));
    assert.strictEqual(repo.currentBranch(), "develop", "reading a document must not switch branches");

    // A document that is on neither disk nor the branch is still classified
    // normally rather than swallowed by the branch lookup.
    const qa = await fetchDoc(server, ONBRANCH, "qa_report.md");
    assert.strictEqual(qa.status, "missing");
    assert.strictEqual(qa.stage, "/pf-qa");
  });

  await t.test("step 6: no entry of any role is left blank", async () => {
    const items = await allRoleItems(server, TRIVIAL);
    assert.ok(items.length >= 15, `expected every role to be listed, got ${items.length} entries`);
    for (const item of items) {
      assert.ok(
        STATES.includes(item.status),
        `${item.roleId}/${item.name} has status ${JSON.stringify(item.status)}`
      );
      assert.ok(item.message && item.message.trim() !== "", `${item.roleId}/${item.name} has no message`);
      if (item.status === "missing") {
        assert.ok(
          typeof item.stage === "string" && item.stage.trim() !== "",
          `${item.roleId}/${item.name} is missing but names no stage that creates it`
        );
      }
      if (item.status === "not_applicable") {
        assert.ok(item.reason && item.reason.trim() !== "", `${item.roleId}/${item.name} says why not`);
      }
    }
    // The trivial issue has no checklist, so the prepare action tracks it.
    const prepare = items.find((i) => i.name === "prepare");
    assert.strictEqual(prepare.status, "missing");
    assert.strictEqual(prepare.stage, "/pf-test");
  });

  await t.test("step 7: a closed issue reads exactly like an open one", async () => {
    const closed = await allRoleItems(server, CLOSED);
    const open = await allRoleItems(server, FULL);

    for (const item of closed) {
      if (item.kind === "action") continue;
      const twin = open.find((i) => i.roleId === item.roleId && i.name === item.name);
      assert.ok(twin, `the closed issue lists ${item.roleId}/${item.name} and the open one does not`);
      assert.strictEqual(
        item.status,
        twin.status,
        `${item.roleId}/${item.name}: ${item.status} when closed, ${twin.status} when open`
      );
    }

    // Readable, not merely listed.
    const brd = await fetchDoc(server, CLOSED, "brd.md", "closed");
    assert.strictEqual(brd.status, "present");
    assert.match(brd.content, /BRD — closed fixture/);

    // The one deliberate difference: preparing test data is not offered for
    // an archive (AC-04i).
    const prepare = closed.find((i) => i.name === "prepare");
    assert.strictEqual(prepare.offered, false);
    assert.strictEqual(prepare.status, "not_applicable");
    assert.ok(prepare.reason && prepare.reason.length > 0);
  });

  await t.test("a file the pipeline says nothing about is not declared inapplicable", async () => {
    // "This tool has no rule about that file" and "the pipeline does not
    // produce it" are different answers. Reporting the first as the second
    // would tell a reader that a file they can see referenced in the issue
    // has no business existing.
    const doc = await fetchDoc(server, FULL, "test-data/setup.mjs");
    assert.strictEqual(doc.status, "missing");
    assert.strictEqual(doc.stage, null);
    assert.strictEqual(doc.reason, null);
    assert.ok(doc.message && doc.message.length > 0);
  });

  await t.test("a path outside the issue folder is refused, not served", async () => {
    const escapes = ["../../../../etc/passwd", "/etc/passwd", `docs/issues/open/${FULL}/../../../../PLANNING.md`];
    for (const attempt of escapes) {
      const res = await server.get(
        `/api/projects/main/issues/${NOQA}/docs?path=${encodeURIComponent(attempt)}`
      );
      assert.ok(res.status >= 400 && res.status < 500, `${attempt} → ${res.status}`);
      assert.ok(!res.json || res.json.content === undefined, `${attempt} returned content`);
    }
  });
});

test("TC-007 step 7: a closed issue is never read from an issue branch", (t) => {
  autoCleanup(t);
  // A closed issue is merged by definition, so a surviving `issue/<id>`
  // branch says nothing about where its documents live — reading from it
  // would show whatever that stale branch happened to hold instead of the
  // archived truth.
  const repo = makeTempRepo({ name: "closed-branch", issues: [CLOSED] });
  repo.run(["branch", `issue/${CLOSED}`, "develop"]);

  const ctx = docstate.buildIssueContext(repo.root, CLOSED, "closed");
  assert.strictEqual(ctx.branch, null, "a closed issue must not be resolved against an issue branch");
  assert.strictEqual(ctx.branchFiles.size, 0);
});

// Step 5 gets its own repository: it checks a branch out, and a suite that
// mutated the shared fixture would make every case after it depend on the
// order they ran in.
test("TC-007 step 5: preparing a case requires the issue branch, and only by confirmation", async (t) => {
  const { repo, configPath, env } = buildFixture(t, [ONBRANCH]);
  const server = await startServerFor(t, { configPath, env });
  const branch = `issue/${ONBRANCH}`;

  const before = (await fetchRole(server, ONBRANCH, "tester")).items.find((i) => i.name === "prepare");
  assert.strictEqual(before.enabled, false, "the action must not be available before the branch is checked out");
  assert.strictEqual(before.requiresCheckout, true);
  assert.strictEqual(before.branch, branch);
  assert.match(before.reason, /checked out|branch/i, "the reason must say a checkout is needed");
  assert.strictEqual(repo.currentBranch(), "develop", "listing a role must not switch branches");

  // The switch itself: the existing, explicitly confirmed route.
  const checkout = await server.post(`/api/projects/main/issues/${ONBRANCH}/checklist/checkout`, {});
  assert.strictEqual(checkout.status, 200, checkout.text);
  assert.strictEqual(repo.currentBranch(), branch);

  const after = (await fetchRole(server, ONBRANCH, "tester")).items.find((i) => i.name === "prepare");
  assert.strictEqual(after.requiresCheckout, false, "the checkout requirement should be gone");
  assert.strictEqual(after.offered, true);
  if (after.reason) {
    assert.doesNotMatch(after.reason, /checked out/i, "the checkout reason should not survive the checkout");
  }

  // And the branch-only documents are now ordinary editable files.
  const brd = await fetchDoc(server, ONBRANCH, "brd.md");
  assert.strictEqual(brd.status, "present");
  assert.strictEqual(brd.location, "disk");
  assert.strictEqual(brd.readonly, false);
  assert.strictEqual(brd.checkout, null);
});
