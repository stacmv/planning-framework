// public/launcher.js — the level-1 launcher screen (specs.md §2.1,
// implementation_plan.md Task 23), exercised via dynamic `import()` — the
// pattern test_plan.md TC-019/TC-004 document for this exact file, since it
// is a native ES module (`export`/`import`) and cannot be `require()`d.
//
// public/app.js — the hash router (implementation_plan.md Task 23) — also
// covered here for TC-001 step 3 (which screen `#/` mounts), since no other
// suite in this project touches `app.js` yet.
//
// Covers, per test_plan.md:
//   * TC-004 — `resolveLandingRoute(project, lastIssueByProject)`, with and
//     without a `pf.lastIssue.<project>` entry.
//   * TC-019 — `formatInboxCardLabel(totalCount)`, including the
//     `totalCount === 0` case; a source-level check that `.inbox-card`'s
//     click handler targets `#/inbox`.
//   * TC-001 — the launcher screen's three-block composition (role switch,
//     `.inbox-card`, `.project-grid`) in one module, and that `app.js`
//     routes the empty/`#/` hash to `launcher`, not `workspace`/`inbox`.
//
// This suite is new: `test/workspace-ui.test.js` covers `public/workspace.js`
// only, and no existing file exercises `public/launcher.js` or
// `public/app.js` at all — nothing here duplicates prior coverage.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { TOOL_DIR } = require("./helpers/fixtures");

const LAUNCHER_PATH = path.join(TOOL_DIR, "public", "launcher.js");
const APP_PATH = path.join(TOOL_DIR, "public", "app.js");
const LAUNCHER_SOURCE = fs.readFileSync(LAUNCHER_PATH, "utf8");
const APP_SOURCE = fs.readFileSync(APP_PATH, "utf8");

async function loadLauncher() {
  return import(pathToFileURL(LAUNCHER_PATH).href);
}
async function loadApp() {
  return import(pathToFileURL(APP_PATH).href);
}

// ---------------------------------------------------------------------------
// Minimal DOM stand-in — same shape test/inbox-ui.test.js/test/workspace-ui.test.js
// use, so a launcher `mount()` can run and be inspected under `node --test`.
// ---------------------------------------------------------------------------

class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.className = "";
    this._text = "";
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this._listeners = {};
    this.title = undefined;
    this.type = undefined;
    this._href = undefined;
  }
  get textContent() {
    return this._text;
  }
  set textContent(v) {
    this._text = v;
    this.children = [];
  }
  set innerHTML(v) {
    if (v === "") this.children = [];
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  addEventListener(type, fn) {
    (this._listeners[type] || (this._listeners[type] = [])).push(fn);
  }
  dispatchClick() {
    for (const fn of this._listeners.click || []) fn({ preventDefault() {} });
  }
  set href(v) {
    this._href = v;
  }
  get href() {
    return this._href;
  }
  findAll(predicate) {
    const out = [];
    for (const child of this.children) {
      if (predicate(child)) out.push(child);
      out.push(...child.findAll(predicate));
    }
    return out;
  }
}

function installFakeDocument() {
  global.document = {
    createElement: (tag) => new FakeElement(tag),
  };
}

function routedFetch(routes) {
  return async (url) => {
    if (!(url in routes)) throw new Error(`unexpected fetch in test: ${url}`);
    return { ok: true, status: 200, json: async () => routes[url] };
  };
}

const ROLES_RESPONSE = {
  roles: [
    { id: "analyst", title: "Аналитик", description: "" },
    { id: "developer", title: "Разработчик", description: "" },
    { id: "tester", title: "Тестировщик", description: "" },
  ],
};

const PROJECTS_RESPONSE = [
  { name: "proj-a", issueCount: 3, currentBranch: "develop" },
  { name: "proj-b", issueCount: 0, currentBranch: "develop" },
];

function baseRoutes(overrides = {}) {
  return {
    "/api/roles": ROLES_RESPONSE,
    "/api/projects": PROJECTS_RESPONSE,
    "/api/inbox": { manualTests: [], humanTasks: [], totalCount: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveLandingRoute — TC-004 steps 1-2 (pure, no DOM).
// ---------------------------------------------------------------------------

test("resolveLandingRoute goes straight to the last-active issue's workspace when pf.lastIssue.<project> is known (TC-004 step 1)", async () => {
  const mod = await loadLauncher();
  const hash = mod.resolveLandingRoute("A", { A: "20260806-feat-example" });
  assert.strictEqual(hash, "#/p/A/i/20260806-feat-example");
});

test("resolveLandingRoute falls back to the project's issue list when there is no pf.lastIssue.<project> entry (TC-004 step 2)", async () => {
  const mod = await loadLauncher();
  const hash = mod.resolveLandingRoute("B", {});
  assert.strictEqual(hash, "#/p/B");
});

test("resolveLandingRoute encodes project/issue names that need it, and ignores unrelated projects in the map", async () => {
  const mod = await loadLauncher();
  assert.strictEqual(
    mod.resolveLandingRoute("proj a", { "proj a": "20260806-feat-example" }),
    "#/p/proj%20a/i/20260806-feat-example"
  );
  // A map that has entries for OTHER projects but not this one must still
  // fall back to the issue-list route, not throw or pick a wrong entry.
  assert.strictEqual(mod.resolveLandingRoute("B", { A: "20260806-feat-example" }), "#/p/B");
});

// ---------------------------------------------------------------------------
// formatInboxCardLabel — TC-019 steps 1-2 (pure, no DOM).
// ---------------------------------------------------------------------------

test('formatInboxCardLabel(7) reads "Инбокс — все проекты, 7 дел" (TC-019 step 1)', async () => {
  const mod = await loadLauncher();
  assert.strictEqual(mod.formatInboxCardLabel(7), "Инбокс — все проекты, 7 дел");
});

test('formatInboxCardLabel(0) still carries an explicit "0 дел", never a placeholder with no number (TC-019 step 2)', async () => {
  const mod = await loadLauncher();
  const label = mod.formatInboxCardLabel(0);
  assert.ok(label.includes("0 дел"), `expected an explicit "0 дел" in ${JSON.stringify(label)}`);
});

test("formatInboxCardLabel tolerates a non-finite/negative count rather than throwing", async () => {
  const mod = await loadLauncher();
  assert.strictEqual(mod.formatInboxCardLabel(NaN), "Инбокс — все проекты, 0 дел");
  assert.strictEqual(mod.formatInboxCardLabel(-3), "Инбокс — все проекты, 0 дел");
});

// ---------------------------------------------------------------------------
// Source-level check — .inbox-card's click handler targets #/inbox, not a
// project-scoped route (TC-019 step 3).
// ---------------------------------------------------------------------------

test("source: .inbox-card's click handler sets #/inbox (TC-019 step 3)", () => {
  const renderInboxCardBody = LAUNCHER_SOURCE.slice(
    LAUNCHER_SOURCE.indexOf("function renderInboxCard("),
    LAUNCHER_SOURCE.indexOf("function renderProjectGrid(")
  );
  assert.ok(renderInboxCardBody.includes('"#/inbox"'), "the .inbox-card anchor's href must be #/inbox");

  const openInboxBody = LAUNCHER_SOURCE.slice(
    LAUNCHER_SOURCE.indexOf("function openInbox("),
    LAUNCHER_SOURCE.indexOf("function render(")
  );
  assert.ok(openInboxBody.includes('navigate("#/inbox")'), "openInbox() must navigate to #/inbox, unscoped to any project");
});

test(".inbox-card's click handler actually navigates to #/inbox at runtime, not only in its href", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const navigated = [];
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadLauncher();
  const handle = mod.mount(container, { fetchImpl, onNavigate: (hash) => navigated.push(hash) });
  await handle.ready;

  const card = container.findAll((n) => n.className === "inbox-card")[0];
  assert.ok(card, "expected an .inbox-card to be rendered");
  card.dispatchClick();
  assert.deepStrictEqual(navigated, ["#/inbox"]);
});

// ---------------------------------------------------------------------------
// mount() — TC-001 step 2: all three blocks in one module/screen.
// ---------------------------------------------------------------------------

test("mount() renders the role switch, .inbox-card and .project-grid together, in one launcher screen (TC-001 step 2)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes({ "/api/inbox": { manualTests: [], humanTasks: [], totalCount: 7 } }));

  const mod = await loadLauncher();
  const handle = mod.mount(container, { fetchImpl });
  await handle.ready;

  const roots = container.findAll((n) => n.className === "launcher");
  assert.strictEqual(roots.length, 1, "expected exactly one .launcher root");
  const root = roots[0];

  const roleSwitches = root.findAll((n) => n.className === "role-switch");
  const inboxCards = root.findAll((n) => n.className === "inbox-card");
  const projectGrids = root.findAll((n) => n.className === "project-grid");
  assert.strictEqual(roleSwitches.length, 1, "expected a .role-switch block");
  assert.strictEqual(inboxCards.length, 1, "expected an .inbox-card block");
  assert.strictEqual(projectGrids.length, 1, "expected a .project-grid block");

  // The role switch offers every role GET /api/roles returned, and the
  // inbox card carries the live count from GET /api/inbox — both blocks
  // draw from real endpoints, not from constants in launcher.js.
  const roleButtons = roleSwitches[0].findAll((n) => n.tagName === "BUTTON");
  assert.strictEqual(roleButtons.length, ROLES_RESPONSE.roles.length);
  const inboxLabel = inboxCards[0].findAll((n) => n.className === "inbox-card-label")[0];
  assert.strictEqual(inboxLabel.textContent, "Инбокс — все проекты, 7 дел");

  // Project cards come straight out of GET /api/projects, unchanged shape.
  const projectCards = projectGrids[0].findAll((n) => n.className === "project-card");
  assert.strictEqual(projectCards.length, PROJECTS_RESPONSE.length);
  assert.deepStrictEqual(
    projectCards.map((c) => c.dataset.project),
    PROJECTS_RESPONSE.map((p) => p.name)
  );
});

test("GET /api/projects' response shape is passed straight through to .project-grid, unmodified (TC-001 step 1)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadLauncher();
  const handle = mod.mount(container, { fetchImpl });
  await handle.ready;

  // No regression introduced by the launcher redesign: the same
  // {name, issueCount, currentBranch} fields still drive the card.
  const cards = container.findAll((n) => n.className === "project-card");
  assert.strictEqual(cards[0].findAll((n) => n.className === "project-card-meta")[0].textContent, "3 issue");
});

// ---------------------------------------------------------------------------
// app.js — TC-001 step 3: `#/` mounts the launcher, not workspace/inbox.
// ---------------------------------------------------------------------------

test("parseRoute(\"#/\") (and the empty/bare-\"#\" hash) resolves to the launcher screen, not workspace/inbox (TC-001 step 3)", async () => {
  const mod = await loadApp();
  for (const hash of ["#/", "#", "", "garbage"]) {
    const route = mod.parseRoute(hash);
    assert.strictEqual(route.screen, "launcher", `hash ${JSON.stringify(hash)} should route to launcher, got ${route.screen}`);
  }
});

test("parseRoute distinguishes the launcher route from #/inbox and #/p/<project>[/i/<issue>] (contrast for TC-001 step 3)", async () => {
  const mod = await loadApp();
  assert.strictEqual(mod.parseRoute("#/inbox").screen, "inbox");
  assert.strictEqual(mod.parseRoute("#/p/proj-a").screen, "workspace");
  assert.strictEqual(mod.parseRoute("#/p/proj-a/i/20260806-feat-example").screen, "workspace");
});

test("source: app.js's SCREENS table maps \"launcher\" to public/launcher.js, and the empty route resolves to it", () => {
  assert.ok(/launcher:\s*\(\)\s*=>\s*import\(["']\.\/launcher\.js["']\)/.test(APP_SOURCE), "SCREENS.launcher must import ./launcher.js");
  assert.ok(LAUNCHER_SOURCE.includes("export function mount("), "launcher.js must export mount() for app.js to call");
});

// ---------------------------------------------------------------------------
// CR-005 fix (implementation_plan.md Task 33) — an inbox click's `where`
// (public/inbox.js's manualTestItemView/humanTaskItemView) must reach
// workspace.js's mount() as more than just `hash`. Covered end-to-end here:
// real inbox.js view builders -> app.js's inboxTargetHash -> app.js's
// parseRoute, never a hand-written hash string standing in for either side.
// `test/inbox-ui.test.js` (Task 15) already covers `where`'s own shape; this
// only exercises the consuming side, per this task's own scope note.
// ---------------------------------------------------------------------------

const INBOX_PATH = path.join(TOOL_DIR, "public", "inbox.js");
async function loadInbox() {
  return import(pathToFileURL(INBOX_PATH).href);
}

test("CR-005: a manual-TC inbox click's where (roleId/doc/ptcId) survives app.js's hash round trip into workspace.js's initial* options", async () => {
  const app = await loadApp();
  const inbox = await loadInbox();

  const where = inbox.manualTestItemView({
    project: "proj-a",
    issueId: "20260101-feat-a",
    ptcId: "TC-01",
    area: "auth",
    testCase: "Login with valid credentials",
    priority: "High",
    origin: "manual_test_checklist.md",
  }).where;

  const hash = app.inboxTargetHash(where);
  assert.strictEqual(
    hash,
    "#/p/proj-a/i/20260101-feat-a?role=tester&tab=manual_test_checklist.md&ptcId=TC-01"
  );

  const route = app.parseRoute(hash);
  assert.strictEqual(route.screen, "workspace");
  assert.strictEqual(route.project, "proj-a");
  assert.strictEqual(route.issueId, "20260101-feat-a");
  assert.strictEqual(route.initialRole, "tester");
  // `parseRoute` forwards the raw query value verbatim — the ".md" ->
  // tab-id normalization is workspace.js's own `tabIdFor` rule, applied on
  // arrival (see workspace.js's mount()/loadRoleContents comments), not
  // duplicated in app.js.
  assert.strictEqual(route.initialTab, "manual_test_checklist.md");
  assert.strictEqual(route.initialPtcId, "TC-01");
});

test("CR-005: a human-task inbox click's where (tab: \"human-tasks\") survives the same round trip, with no roleId/ptcId set", async () => {
  const app = await loadApp();
  const inbox = await loadInbox();

  const where = inbox.humanTaskItemView({
    project: "proj-a",
    issueId: "20260101-feat-a",
    stageKey: "code",
    operation: "write",
    mode: "blocking",
    artifactPath: null,
    instruction: "Implement the feature",
    status: "queued",
  }).where;

  const hash = app.inboxTargetHash(where);
  assert.strictEqual(hash, "#/p/proj-a/i/20260101-feat-a?tab=human-tasks");

  const route = app.parseRoute(hash);
  assert.strictEqual(route.screen, "workspace");
  assert.strictEqual(route.initialRole, null);
  assert.strictEqual(route.initialTab, "human-tasks");
  assert.strictEqual(route.initialPtcId, null);
});

test("CR-005: inboxTargetHash passes a plain string target through unchanged (the pre-existing <a href> / string-navigate path)", async () => {
  const app = await loadApp();
  assert.strictEqual(app.inboxTargetHash("#/p/proj-a/i/20260101-feat-a"), "#/p/proj-a/i/20260101-feat-a");
  assert.strictEqual(app.inboxTargetHash(null), null);
});
