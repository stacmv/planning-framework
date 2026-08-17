// public/workspace.js — level-2 workspace screen (tech spec §2.2,
// implementation_plan.md Task 24), exercised via dynamic `import()` — the
// pattern test_plan.md TC-003 documents for this exact file, since it is a
// native ES module (`export`/`import`) and cannot be `require()`d.
//
// Self-verification for Task 24 only (TC-002/TC-003's Auto slice):
//   * `resolveActiveTab` — both branches (document present / missing at the
//     new issue) plus a source-level check that a role switch never routes
//     through it (TC-003 steps 1-3).
//   * `buildTabSet` — one tab per role item plus exactly one "Дела" tab, and
//     no hardcoded literal document-name list in the module (TC-002 step 4).
//   * `mount()` — `.workspace-header` has no persistent sidebar, `.doc-tabs`
//     is built from `GET .../roles/:role` for the current role only, an
//     issue switch keeps the active tab (even into `missing`) and a role
//     switch replaces the whole tab set (TC-002 steps 1-3).
//
// Task 27 (test/workspace.test.js) owns the fuller integration suite for
// this file, including the real `GET .../roles/:role` HTTP round trip
// through `test/helpers/server.js`; this file's fixtures are hand-built
// response shapes, not a real server.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { TOOL_DIR } = require("./helpers/fixtures");

const MODULE_PATH = path.join(TOOL_DIR, "public", "workspace.js");
const SOURCE = fs.readFileSync(MODULE_PATH, "utf8");

async function loadModule() {
  return import(pathToFileURL(MODULE_PATH).href);
}

// ---------------------------------------------------------------------------
// Minimal DOM stand-in — same shape test/inbox-ui.test.js uses, extended
// with a plain `value` property (select/option elements need it; FakeElement
// otherwise never distinguishes tag names).
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
    this.hidden = false;
    this.type = undefined;
    this.disabled = false;
    this.value = undefined;
    this.selected = undefined;
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
  dispatchChange() {
    for (const fn of this._listeners.change || []) fn({});
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

// ---------------------------------------------------------------------------
// Fixture role-content responses — hand-built `buildRoleContents()` shapes.
// ---------------------------------------------------------------------------

function testerContents(issueId, { qaReportPresent }) {
  return {
    project: "proj-a",
    issueId,
    issueStatus: "open",
    role: { id: "tester", title: "Тестировщик", description: "" },
    items: [
      { id: "test_plan.md", kind: "issue_doc", name: "test_plan.md", label: "Test plan", status: "present" },
      {
        id: "manual_test_checklist.md",
        kind: "issue_doc",
        name: "manual_test_checklist.md",
        label: "Manual test checklist",
        status: "present",
      },
      {
        id: "qa_report.md",
        kind: "issue_doc",
        name: "qa_report.md",
        label: "QA report",
        status: qaReportPresent ? "present" : "missing",
      },
    ],
  };
}

// The analyst fixture with a `brd.md` present/missing — mirrors
// test_plan.md TC-003's own Steps column literally
// (`resolveActiveTab("brd", docsOfIssueA)` -> `"brd"`), not just an
// equivalent scenario under a different tab id.
function analystContents(issueId, { brdPresent }) {
  return {
    project: "proj-a",
    issueId,
    issueStatus: "open",
    role: { id: "analyst", title: "Аналитик", description: "" },
    items: [
      { id: "prompt.md", kind: "issue_doc", name: "prompt.md", label: "Issue prompt", status: "present" },
      { id: "brd.md", kind: "issue_doc", name: "brd.md", label: "Business requirements", status: brdPresent ? "present" : "missing" },
    ],
  };
}

function developerContents(issueId) {
  return {
    project: "proj-a",
    issueId,
    issueStatus: "open",
    role: { id: "developer", title: "Разработчик", description: "" },
    items: [
      { id: "specs.md", kind: "issue_doc", name: "specs.md", label: "Technical spec", status: "present" },
      {
        id: "implementation_plan.md",
        kind: "issue_doc",
        name: "implementation_plan.md",
        label: "Implementation plan",
        status: "present",
      },
    ],
  };
}

const ROLES_RESPONSE = {
  roles: [
    { id: "analyst", title: "Аналитик", description: "" },
    { id: "developer", title: "Разработчик", description: "" },
    { id: "tester", title: "Тестировщик", description: "" },
  ],
};

const ISSUES_RESPONSE = {
  currentBranch: "develop",
  defaultBranch: "develop",
  issues: [
    { issueId: "20260101-feat-a", status: "open", checklistStatus: "here", summary: { passedSteps: 0, totalSteps: 0 } },
    { issueId: "20260102-feat-b", status: "open", checklistStatus: "here", summary: { passedSteps: 0, totalSteps: 0 } },
  ],
};

function routedFetch(routes) {
  return async (url) => {
    if (!(url in routes)) {
      throw new Error(`unexpected fetch in test: ${url}`);
    }
    return { ok: true, status: 200, json: async () => routes[url] };
  };
}

// ---------------------------------------------------------------------------
// resolveActiveTab — TC-003 steps 1-2 (pure, no DOM).
// ---------------------------------------------------------------------------

// test_plan.md TC-003 steps 1-2, literally: `resolveActiveTab("brd",
// docsOfIssueA)` where `docsOfIssueA` is `GET .../issues/A/roles/analyst`
// (`brd.md` present) -> `"brd"`; same call against issue B (`brd.md`
// missing) -> still `"brd"`. Tab ids are the role item's name with ".md"
// stripped (`tabIdFor`), so `"brd"` is the real, canonical id — not a
// shorthand the test plan happens to use.
test("resolveActiveTab(\"brd\", ...) keeps the tab when brd.md is present at the new issue (TC-003 step 1)", async () => {
  const mod = await loadModule();
  const docsOfIssueA = analystContents("20260101-feat-a", { brdPresent: true });
  assert.strictEqual(mod.resolveActiveTab("brd", docsOfIssueA), "brd");
});

test("resolveActiveTab(\"brd\", ...) keeps the tab when brd.md is missing at the new issue (TC-003 step 2)", async () => {
  const mod = await loadModule();
  const docsOfIssueB = analystContents("20260102-feat-b", { brdPresent: false });
  assert.strictEqual(mod.resolveActiveTab("brd", docsOfIssueB), "brd");
  // And the tab set itself still carries the "missing" state for the caller
  // to render, rather than silently omitting it.
  const tabs = mod.buildTabSet(docsOfIssueB);
  const brdTab = tabs.find((t) => t.id === "brd");
  assert.strictEqual(brdTab.item.status, "missing");
});

test("resolveActiveTab keeps the tab when the document is present at the new issue (tester role)", async () => {
  const mod = await loadModule();
  const docsOfIssueA = testerContents("20260101-feat-a", { qaReportPresent: true });
  const result = mod.resolveActiveTab("qa_report", docsOfIssueA);
  assert.strictEqual(result, "qa_report");
});

test("resolveActiveTab keeps the tab when the document is missing at the new issue (renders as missing, does not auto-switch)", async () => {
  const mod = await loadModule();
  const docsOfIssueB = testerContents("20260102-feat-b", { qaReportPresent: false });
  const result = mod.resolveActiveTab("qa_report", docsOfIssueB);
  assert.strictEqual(result, "qa_report");
  // And the tab set itself still carries the "missing" state for the caller
  // to render, rather than silently omitting it.
  const tabs = mod.buildTabSet(docsOfIssueB);
  const qaTab = tabs.find((t) => t.id === "qa_report");
  assert.strictEqual(qaTab.item.status, "missing");
});

test("resolveActiveTab falls back to the first tab when prevTabId names no tab of the new set", async () => {
  const mod = await loadModule();
  const docsOfIssueA = testerContents("20260101-feat-a", { qaReportPresent: true });
  const result = mod.resolveActiveTab("nonexistent", docsOfIssueA);
  assert.strictEqual(result, "test_plan");
});

// A role switch never routes through resolveActiveTab (TC-003 step 3) — the
// module-level check that `selectRole`'s body never names the function,
// while `loadRoleContents` (which both `selectIssue` and the initial load go
// through) does.
test("source: selectRole's body never calls resolveActiveTab; loadRoleContents does", () => {
  const selectRoleBody = SOURCE.slice(SOURCE.indexOf("async function selectRole("), SOURCE.indexOf("function selectTab("));
  assert.ok(!selectRoleBody.includes("resolveActiveTab"), "selectRole must take a fresh tab set, not go through resolveActiveTab");

  const loadRoleContentsBody = SOURCE.slice(
    SOURCE.indexOf("async function loadRoleContents("),
    SOURCE.indexOf("async function selectIssue(")
  );
  assert.ok(loadRoleContentsBody.includes("resolveActiveTab"), "loadRoleContents should be resolveActiveTab's one call site");
});

// ---------------------------------------------------------------------------
// buildTabSet — TC-002 steps 2-4 (pure, no DOM).
// ---------------------------------------------------------------------------

test("buildTabSet returns one tab per role item, in order, plus exactly one Дела tab", async () => {
  const mod = await loadModule();
  const contents = testerContents("20260101-feat-a", { qaReportPresent: true });
  const tabs = mod.buildTabSet(contents);

  assert.strictEqual(tabs.length, contents.items.length + 1);
  assert.deepStrictEqual(
    tabs.slice(0, -1).map((t) => t.id),
    contents.items.map((i) => i.id.replace(/\.md$/, ""))
  );
  const last = tabs[tabs.length - 1];
  assert.strictEqual(last.id, mod.HUMAN_TASKS_TAB_ID);
  assert.strictEqual(last.kind, "human-tasks");
  assert.strictEqual(last.label, "Дела");
});

test("buildTabSet on an empty/null response still returns just the Дела tab, not a crash", async () => {
  const mod = await loadModule();
  assert.deepStrictEqual(mod.buildTabSet(null).map((t) => t.id), [mod.HUMAN_TASKS_TAB_ID]);
  assert.deepStrictEqual(mod.buildTabSet({}).map((t) => t.id), [mod.HUMAN_TASKS_TAB_ID]);
});

// TC-002 step 4's grep check: no literal array in this module simultaneously
// names several role-declared documents — the tab set must come from the
// server response, never from a constant here.
test("source: no hardcoded literal array of role document names (TC-002 step 4)", () => {
  const suspiciousNames = ["specs", "implementation_plan", "test_plan", "brd"];
  const arrayLiteralRe = /\[[^\]]*\]/g;
  let match;
  while ((match = arrayLiteralRe.exec(SOURCE))) {
    const literal = match[0];
    const hits = suspiciousNames.filter((name) => literal.includes(`"${name}"`) || literal.includes(`'${name}'`));
    assert.ok(hits.length < 2, `found a literal array combining role document names: ${literal}`);
  }
});

// ---------------------------------------------------------------------------
// mount() — TC-002 steps 1-3 through the module's own DOM rendering.
// ---------------------------------------------------------------------------

function baseRoutes(overrides = {}) {
  return {
    "/api/roles": ROLES_RESPONSE,
    "/api/projects/proj-a/issues": ISSUES_RESPONSE,
    "/api/projects/proj-a/issues/20260101-feat-a/roles/tester": testerContents("20260101-feat-a", { qaReportPresent: true }),
    "/api/projects/proj-a/issues/20260102-feat-b/roles/tester": testerContents("20260102-feat-b", { qaReportPresent: false }),
    "/api/projects/proj-a/issues/20260101-feat-a/roles/developer": developerContents("20260101-feat-a"),
    ...overrides,
  };
}

test("mount() renders a header with a back link and no persistent sidebar container, plus Issue/Роль selects", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRole: "tester", fetchImpl });
  await handle.ready;

  const headers = container.findAll((n) => n.className === "workspace-header");
  assert.strictEqual(headers.length, 1);

  const back = headers[0].findAll((n) => n.className === "workspace-back")[0];
  assert.ok(back, "expected a back link in the workspace header");
  assert.strictEqual(back.href, "#/");

  const selects = headers[0].findAll((n) => n.tagName === "SELECT");
  assert.strictEqual(selects.length, 2, "expected exactly one Issue select and one Роль select");

  // No `.sidebar` container anywhere — AC-01b.
  const sidebars = container.findAll((n) => n.className && String(n.className).split(/\s+/).includes("sidebar"));
  assert.strictEqual(sidebars.length, 0);
});

test("mount() builds .doc-tabs from GET .../roles/:role for the current role only (TC-002 steps 2-3)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRole: "tester", fetchImpl });
  await handle.ready;

  let tabButtons = container.findAll((n) => n.tagName === "BUTTON" && n.dataset.tabId);
  assert.deepStrictEqual(
    tabButtons.map((b) => b.dataset.tabId),
    ["test_plan", "manual_test_checklist", "qa_report", mod.HUMAN_TASKS_TAB_ID]
  );
  // First doc tab active by default.
  assert.strictEqual(handle.getState().activeTabId, "test_plan");

  // Switching role replaces the WHOLE tab set — no overlap with the previous
  // role's document ids (TC-002 step 3's "never see both at once").
  await handle.selectRole("developer");
  tabButtons = container.findAll((n) => n.tagName === "BUTTON" && n.dataset.tabId);
  const newIds = tabButtons.map((b) => b.dataset.tabId);
  assert.deepStrictEqual(newIds, ["specs", "implementation_plan", mod.HUMAN_TASKS_TAB_ID]);
  for (const oldId of ["test_plan", "manual_test_checklist", "qa_report"]) {
    assert.ok(!newIds.includes(oldId), `developer's tab set must not include the tester-only tab ${oldId}`);
  }
});

test("mount(): switching Issue keeps the active tab, even into a missing document (TC-003)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRole: "tester", fetchImpl });
  await handle.ready;

  handle.selectTab("qa_report");
  assert.strictEqual(handle.getState().activeTabId, "qa_report");

  // Issue B's qa_report.md is "missing" — the active tab must not jump away.
  await handle.selectIssue("20260102-feat-b");
  assert.strictEqual(handle.getState().activeTabId, "qa_report");

  const panels = container.findAll((n) => n.className === "doc-panel");
  assert.strictEqual(panels.length, 1);
  assert.strictEqual(panels[0].dataset.tabId, "qa_report");
  const badges = panels[0].findAll((n) => n.className === "badge");
  assert.ok(badges.some((b) => b.textContent === "missing"), "the missing document should render with a missing badge, not switch tabs");
});

test("mount(): selectTab only accepts a tab id from the current tab set", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRole: "tester", fetchImpl });
  await handle.ready;

  const before = handle.getState().activeTabId;
  handle.selectTab("does-not-exist");
  assert.strictEqual(handle.getState().activeTabId, before);
});

test("mount(): document content is fetched by endpoint (not tab.id), deduped, and an A->B issue switch never paints A's content into B's panel", async () => {
  installFakeDocument();
  const container = new FakeElement("div");

  const contentCalls = [];
  const routes = baseRoutes({
    "/api/projects/proj-a/issues/20260101-feat-a/roles/tester": {
      ...testerContents("20260101-feat-a", { qaReportPresent: true }),
      items: [
        {
          id: "test_plan.md",
          kind: "issue_doc",
          name: "test_plan.md",
          label: "Test plan",
          status: "present",
          endpoint: "/api/projects/proj-a/issues/20260101-feat-a/docs?path=test_plan.md",
        },
      ],
    },
    "/api/projects/proj-a/issues/20260102-feat-b/roles/tester": {
      ...testerContents("20260102-feat-b", { qaReportPresent: false }),
      items: [
        {
          id: "test_plan.md",
          kind: "issue_doc",
          name: "test_plan.md",
          label: "Test plan",
          status: "present",
          endpoint: "/api/projects/proj-a/issues/20260102-feat-b/docs?path=test_plan.md",
        },
      ],
    },
    "/api/projects/proj-a/issues/20260101-feat-a/docs?path=test_plan.md": { content: "Contents of issue A." },
    "/api/projects/proj-a/issues/20260102-feat-b/docs?path=test_plan.md": { content: "Contents of issue B." },
  });
  const fetchImpl = async (url) => {
    if (url.includes("/docs?path=")) contentCalls.push(url);
    return routedFetch(routes)(url);
  };

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRole: "tester", fetchImpl });
  await handle.ready;
  // `render()` runs twice for the initial load's own state settling
  // (paint-immediately, then loadShell's own render) — still only one fetch
  // per distinct endpoint.
  const issueAFetches = contentCalls.filter((u) => u.includes("feat-a"));
  assert.strictEqual(issueAFetches.length, 1, `expected exactly one fetch of issue A's document, got ${issueAFetches.length}`);

  await handle.selectIssue("20260102-feat-b");
  // Let the panel's async content fetch resolve and repaint.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const panels = container.findAll((n) => n.className === "md-body");
  assert.strictEqual(panels.length, 1);
  assert.strictEqual(panels[0].textContent, "Contents of issue B.", "issue A's content must never appear in issue B's panel");
});

test("mount(): back link navigates to level 1 via onNavigate when provided", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());
  const navigated = [];

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: "20260101-feat-a",
    initialRole: "tester",
    fetchImpl,
    onNavigate: (hash) => navigated.push(hash),
  });
  await handle.ready;

  const back = container.findAll((n) => n.className === "workspace-back")[0];
  back.dispatchClick();
  assert.deepStrictEqual(navigated, ["#/"]);
});
