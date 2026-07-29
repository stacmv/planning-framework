// TC-006 — the three role sections and what each of them shows.
//
// Roles are the top level of the whole tool, and the mapping "role →
// documents" belongs to the server: the client asks for it and renders the
// answer. That is what makes this case checkable without a browser — the
// layout and the feel of switching are TC-019's business, the *contents* are
// this suite's.
//
// Two properties get most of the attention here, because they are the ones
// that rot silently:
//
//   * a role shows exactly what it declares and nothing beyond it — asserted
//     as set equality, not as "contains", so an entry quietly added to a role
//     fails the suite instead of passing unnoticed;
//   * the server keeps no current role. Answers may not depend on the order
//     of requests or on anything asked before, which is what "switch roles at
//     any moment" means on the wire (step 6).
//
// Run: node --test test/roles.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { TOOL_DIR, makeTempRepo, makeMemoryRoot, makeConfig, autoCleanup } = require("./helpers/fixtures");
const { startServerFor } = require("./helpers/server");

const rolesModule = require("../lib/roles");

const FULL = "20260101-feat-fixture-full";
const TRIVIAL = "20260105-improve-fixture-trivial";

// The declared contents of each role, straight out of the test plan (TC-006
// steps 2-4). Written out literally rather than imported from lib/roles.js:
// a test that reads the table it is checking would agree with any table.
const EXPECTED = {
  analyst: ["prompt.md", "brd.md", "analysis.md", "notes.md", "PLANNING.md", "docs/planning/decisions.md"],
  developer: [
    "specs.md",
    "implementation_plan.md",
    "docs/planning/implementation-plan.md",
    "docs/planning/session-log.md",
    "CLAUDE.md",
    "memory",
  ],
  tester: ["test_plan.md", "manual_test_checklist.md", "qa_report.md", ".qa-workflow.md", "prepare"],
};

function buildFixture(t) {
  autoCleanup(t);
  const repo = makeTempRepo({ name: "roles", issues: [FULL, TRIVIAL] });
  const memRoot = makeMemoryRoot();
  memRoot.addProject({ projectPath: repo.root });
  const config = makeConfig({ projects: [{ name: "main", path: repo.root }] });
  return {
    repo,
    configPath: config.configPath,
    env: { PLANNING_TEST_UI_MEMORY_ROOT: memRoot.root },
  };
}

const roleUrl = (issueId, roleId) => `/api/projects/main/issues/${issueId}/roles/${roleId}`;

async function fetchRole(server, issueId, roleId) {
  const res = await server.get(roleUrl(issueId, roleId));
  assert.strictEqual(res.status, 200, `GET ${roleUrl(issueId, roleId)} → ${res.status}: ${res.text}`);
  return res.json;
}

const namesOf = (payload) => payload.items.map((i) => i.name);
const itemNamed = (payload, name) => payload.items.find((i) => i.name === name);

test("TC-006: the three roles and their declared contents", async (t) => {
  const { configPath, env } = buildFixture(t);
  const server = await startServerFor(t, { configPath, env });

  await t.test("step 1: exactly three roles, with stable ids", async () => {
    const res = await server.get("/api/roles");
    assert.strictEqual(res.status, 200);
    const ids = res.json.roles.map((r) => r.id);
    assert.deepStrictEqual(ids, ["analyst", "developer", "tester"]);
    // A role with no title is unrenderable, and an empty role is a section
    // that says nothing — both are worth failing on.
    for (const role of res.json.roles) {
      assert.ok(role.title, `role ${role.id} has no title`);
      assert.ok(Array.isArray(role.items) && role.items.length > 0, `role ${role.id} declares no entries`);
    }
  });

  await t.test("step 2: the analyst role, and nothing beyond it", async () => {
    const payload = await fetchRole(server, FULL, "analyst");
    assert.deepStrictEqual(namesOf(payload).sort(), [...EXPECTED.analyst].sort());
    // Every document of the full fixture is really there, so every entry of
    // this role must read as present — this is the baseline the other cases
    // are told apart from.
    for (const name of ["prompt.md", "brd.md", "analysis.md", "notes.md", "PLANNING.md", "docs/planning/decisions.md"]) {
      assert.strictEqual(itemNamed(payload, name).status, "present", `${name} should be present in the full fixture`);
    }
    assert.strictEqual(payload.role.id, "analyst");
    assert.strictEqual(payload.issueId, FULL);
  });

  await t.test("step 3: the developer role, including instructions and memory", async () => {
    const payload = await fetchRole(server, FULL, "developer");
    assert.deepStrictEqual(namesOf(payload).sort(), [...EXPECTED.developer].sort());

    const instructionsItem = itemNamed(payload, "CLAUDE.md");
    assert.strictEqual(instructionsItem.kind, "instructions");
    assert.strictEqual(instructionsItem.status, "present");
    assert.strictEqual(instructionsItem.endpoint, "/api/projects/main/instructions");

    const memoryItem = itemNamed(payload, "memory");
    assert.strictEqual(memoryItem.kind, "memory");
    assert.strictEqual(memoryItem.status, "present");
    assert.strictEqual(memoryItem.endpoint, "/api/projects/main/memory");

    // The project roadmap and the issue's own plan are different documents
    // and must not collapse into one entry (AC-04c).
    assert.notStrictEqual(
      itemNamed(payload, "implementation_plan.md").relativePath,
      itemNamed(payload, "docs/planning/implementation-plan.md").relativePath
    );
  });

  await t.test("step 4: the tester role, including the prepare action", async () => {
    const payload = await fetchRole(server, FULL, "tester");
    assert.deepStrictEqual(namesOf(payload).sort(), [...EXPECTED.tester].sort());

    const prepare = itemNamed(payload, "prepare");
    assert.strictEqual(prepare.kind, "action");
    assert.strictEqual(prepare.method, "POST");
    assert.strictEqual(prepare.endpoint, `/api/projects/main/issues/${FULL}/prepare`);
    // The full fixture's checklist is on disk, so the action is offered.
    assert.strictEqual(prepare.offered, true);
    assert.strictEqual(prepare.requiresCheckout, false);
  });

  await t.test("step 5: a trivial-tier issue shows notes.md instead of brd/analysis/specs", async () => {
    const analyst = await fetchRole(server, TRIVIAL, "analyst");
    assert.strictEqual(analyst.sizeTier, "trivial");
    assert.strictEqual(itemNamed(analyst, "notes.md").status, "present");
    for (const name of ["brd.md", "analysis.md"]) {
      const item = itemNamed(analyst, name);
      assert.strictEqual(item.status, "not_applicable", `${name} should be not applicable on a trivial issue`);
      assert.match(item.reason, /notes\.md/, `${name}'s reason should point at notes.md, got: ${item.reason}`);
    }

    const developer = await fetchRole(server, TRIVIAL, "developer");
    for (const name of ["specs.md", "implementation_plan.md"]) {
      assert.strictEqual(
        itemNamed(developer, name).status,
        "not_applicable",
        `${name} should be not applicable on a trivial issue`
      );
    }
    // …and the substitute is still reachable from the role that needs it.
    assert.ok(itemNamed(analyst, "notes.md").endpoint.includes("notes.md"));
  });

  await t.test("step 6: answers do not depend on request order or on history", async () => {
    const first = await fetchRole(server, FULL, "analyst");

    // Every other role, plus document reads, in between.
    await fetchRole(server, FULL, "tester");
    await server.get(`/api/projects/main/issues/${FULL}/docs?path=${encodeURIComponent(`docs/issues/open/${FULL}/brd.md`)}`);
    await fetchRole(server, TRIVIAL, "developer");
    await server.get("/api/projects/main/docs?path=PLANNING.md");
    await fetchRole(server, FULL, "developer");
    await fetchRole(server, TRIVIAL, "tester");

    const again = await fetchRole(server, FULL, "analyst");
    assert.deepStrictEqual(again, first, "the analyst role's answer changed after other requests");

    // And a role asked for twice in a row is the same answer twice.
    const tester1 = await fetchRole(server, TRIVIAL, "tester");
    const tester2 = await fetchRole(server, TRIVIAL, "tester");
    assert.deepStrictEqual(tester2, tester1);
  });

  await t.test("an unknown role is a 404 that names the roles that exist", async () => {
    const res = await server.get(roleUrl(FULL, "manager"));
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.json.error, "unknown_role");
    assert.match(res.json.message, /analyst/);
  });
});

test("TC-006 step 7: the role table loads in both runtimes and the client keeps no copy", async (t) => {
  autoCleanup(t);

  await t.test("required from Node, it is the same table", () => {
    assert.deepStrictEqual(rolesModule.ROLE_IDS, ["analyst", "developer", "tester"]);
    for (const [roleId, names] of Object.entries(EXPECTED)) {
      assert.deepStrictEqual(
        rolesModule.itemsOf(roleId).map((i) => i.name).sort(),
        [...names].sort(),
        `role ${roleId} declares something other than its documented contents`
      );
    }
  });

  await t.test("the table cannot be mutated through what it hands out", () => {
    const first = rolesModule.getRole("analyst");
    first.items.push({ kind: "issue_doc", name: "smuggled.md" });
    first.items[0].name = "tampered.md";
    const second = rolesModule.getRole("analyst");
    assert.deepStrictEqual(second.items.map((i) => i.name), EXPECTED.analyst);
  });

  await t.test("loaded as a browser script, it touches neither document nor window", () => {
    const source = fs.readFileSync(path.join(TOOL_DIR, "lib", "roles.js"), "utf8");
    // No Node at all: a `require` or a `node:` builtin makes the file
    // unloadable in a browser, whatever the UMD wrapper does.
    assert.doesNotMatch(source, /\brequire\s*\(/, "lib/roles.js must not require anything");
    assert.doesNotMatch(source, /"node:|'node:/, "lib/roles.js must not use node: builtins");

    // A stand-in browser global: `self` is what the UMD wrapper attaches to,
    // and every other browser global is a trap. The traps have to be
    // installed *inside* the context — an accessor defined on the sandbox
    // object before `createContext` is not reflected into it, so the mutant
    // "roles.js reads document.title at load" would survive.
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(
      "globalThis.self = globalThis;" +
        "for (const name of ['document', 'window', 'localStorage', 'fetch', 'navigator']) {" +
        "  Object.defineProperty(globalThis, name, {" +
        "    get() { throw new Error('lib/roles.js touched ' + name + ' at load time'); }," +
        "    configurable: true });" +
        "}",
      sandbox
    );
    vm.runInContext(source, sandbox, { filename: "roles.js" });

    assert.ok(sandbox.PFRoles, "the browser build exposes no PFRoles global");
    // Array.from, because values crossing a vm realm boundary have that
    // realm's prototypes and would fail deepStrictEqual on identity alone.
    assert.deepStrictEqual(Array.from(sandbox.PFRoles.ROLE_IDS), ["analyst", "developer", "tester"]);
    assert.deepStrictEqual(
      Array.from(sandbox.PFRoles.itemsOf("tester"), (i) => i.name).sort(),
      [...EXPECTED.tester].sort()
    );
  });

  await t.test("public/app.js carries no list of document names of its own", () => {
    const appJs = fs.readFileSync(path.join(TOOL_DIR, "public", "app.js"), "utf8");
    // manual_test_checklist.md is exempt: the checklist screen predates the
    // role explorer and names its own subject in a message. Every *other*
    // document name may only come from the API — a hard-coded one here is a
    // second answer to "what does this role show".
    const forbidden = Object.values(EXPECTED)
      .flat()
      .filter((name) => name.includes(".") && name !== "manual_test_checklist.md");
    for (const name of forbidden) {
      assert.ok(!appJs.includes(name), `public/app.js hard-codes the document name ${name}`);
    }
  });

  await t.test("the module is served to the browser", async () => {
    const repo = makeTempRepo({ name: "roles-lib", issues: [FULL] });
    const config = makeConfig({ projects: [{ name: "main", path: repo.root }] });
    const server = await startServerFor(t, { configPath: config.configPath });
    const res = await server.get("/lib/roles.js");
    assert.strictEqual(res.status, 200, "/lib/roles.js is not served");
    assert.match(res.headers["content-type"], /javascript/);
    assert.ok(res.text.includes("PFRoles"));
  });
});
