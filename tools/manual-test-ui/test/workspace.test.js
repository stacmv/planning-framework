// public/workspace.js — level-2 workspace screen (tech spec §2.2,
// implementation_plan.md Task 24), exercised through REAL HTTP round trips
// against a running server (test/helpers/server.js) rather than hand-built
// response fixtures.
//
// test/workspace-ui.test.js already covers this module thoroughly with
// hand-built `buildRoleContents()`-shaped objects (Task 24's own
// self-verification). This file deliberately does NOT repeat that ground —
// it feeds this module's pure functions and `mount()` with responses that
// actually came out of `server.js`/`lib/roles.js`/`lib/checklist.js`/
// `lib/inbox.js` over the wire, the same way a browser would. That is a
// different, genuine gap: it catches drift between what
// `test/workspace-ui.test.js`'s fixtures *assume* the server returns and
// what the server *actually* returns (schema drift a hand-built fixture
// cannot detect by construction).
//
// Covers, per test_plan.md:
//   * TC-002 steps 2-3 — `.doc-tabs` built from a real
//     `GET .../issues/:id/roles/:role`, for two roles, non-overlapping doc
//     tab sets (server-side, not client-mocked).
//   * TC-003 — `resolveActiveTab` fed a real `GET .../roles/analyst`
//     response for two issues (one with `brd.md`, one without).
//   * TC-029 — `countProjectTodos` fed a real `GET /api/inbox` response
//     spanning two issues of one project (and a second, unrelated project,
//     to prove no cross-project leakage); a source-level check that
//     `/api/inbox` is fetched from exactly one call site (TC-029 step 4's
//     grep, which test/workspace-ui.test.js checks only at runtime, not by
//     grep).
//   * TC-030 — `renderChecklistPanel` fed a real
//     `GET .../issues/:id/checklist` response containing a genuine
//     `looseSections` entry (produced by `lib/checklist.js` itself, not
//     fabricated) — block order and CSS class, end to end.
//
// Run: node --test test/workspace.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { TOOL_DIR, makeTempRepo, makeConfig, autoCleanup, checklistDoc } = require("./helpers/fixtures");
const { startServerFor } = require("./helpers/server");

const MODULE_PATH = path.join(TOOL_DIR, "public", "workspace.js");
const SOURCE = fs.readFileSync(MODULE_PATH, "utf8");

async function loadModule() {
  return import(pathToFileURL(MODULE_PATH).href);
}

const FULL = "20260101-feat-fixture-full"; // every role's documents present, incl. brd.md

// A second feat issue with only prompt.md — brd.md is genuinely "missing"
// here (applicable to a feat issue, just not written yet), unlike the
// catalogue's "20260103-bug-fixture-analysis", whose type is "bug" and so
// classifies brd.md as "not_applicable" instead (lib/docstate.js: a bug
// issue states its problem in analysis.md, not a BRD) — the wrong fixture
// for exercising the "missing" branch TC-003 actually asks for.
const NO_BRD = "20260204-feat-fixture-nobrd";
function noBrdPromptDoc() {
  return [
    "---",
    "doc_language: English",
    "size_tier: medium",
    "---",
    "",
    `# ${NO_BRD}`,
    "",
    "Type: feat. brd.md deliberately not written yet.",
    "",
  ].join("\n");
}

const roleUrl = (project, issueId, roleId) => `/api/projects/${project}/issues/${issueId}/roles/${roleId}`;
const checklistUrl = (project, issueId) => `/api/projects/${project}/issues/${issueId}/checklist`;

async function getJson(server, url) {
  const res = await server.get(url);
  assert.strictEqual(res.status, 200, `GET ${url} → ${res.status}: ${res.text}`);
  return res.json;
}

// ---------------------------------------------------------------------------
// Minimal DOM stand-in — same shape test/workspace-ui.test.js uses, needed
// for the mount() round trips below (against a real server, not a routed
// fetch stub).
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
// TC-002 steps 2-3: .doc-tabs from a real GET .../roles/:role, two roles,
// non-overlapping document tab sets.
// ---------------------------------------------------------------------------

test("TC-002: buildTabSet(), fed real GET .../roles/tester and .../roles/developer responses, produces non-overlapping doc tab sets", async (t) => {
  autoCleanup(t);
  const repo = makeTempRepo({ name: "main", issues: [FULL] });
  const config = makeConfig({ projects: [{ name: "main", path: repo.root }] });
  const server = await startServerFor(t, { configPath: config.configPath });
  const mod = await loadModule();

  const testerContents = await getJson(server, roleUrl("main", FULL, "tester"));
  const developerContents = await getJson(server, roleUrl("main", FULL, "developer"));

  const testerTabs = mod.buildTabSet(testerContents);
  const developerTabs = mod.buildTabSet(developerContents);

  // Both real responses actually declared documents (a vacuous "both are
  // empty, so of course they don't overlap" would prove nothing).
  assert.ok(testerTabs.length > 1, "expected the tester role to have real doc tabs, not just Дела");
  assert.ok(developerTabs.length > 1, "expected the developer role to have real doc tabs, not just Дела");

  const testerDocIds = new Set(testerTabs.filter((t2) => t2.kind === "doc").map((t2) => t2.id));
  const developerDocIds = new Set(developerTabs.filter((t2) => t2.kind === "doc").map((t2) => t2.id));
  for (const id of testerDocIds) {
    assert.ok(!developerDocIds.has(id), `tester's "${id}" tab must not also appear in developer's tab set`);
  }

  // Exactly one client-added "Дела" tab in each, appended last — real
  // responses never carry it themselves (server.js's buildRoleContents()
  // knows nothing about it).
  for (const tabs of [testerTabs, developerTabs]) {
    assert.strictEqual(tabs.filter((t2) => t2.id === mod.HUMAN_TASKS_TAB_ID).length, 1);
    assert.strictEqual(tabs[tabs.length - 1].id, mod.HUMAN_TASKS_TAB_ID);
  }
});

test("mount(): a real server round trip builds .doc-tabs for the current role only, and switching role replaces the whole set (TC-002 steps 1-3)", async (t) => {
  autoCleanup(t);
  const repo = makeTempRepo({ name: "main", issues: [FULL] });
  const config = makeConfig({ projects: [{ name: "main", path: repo.root }] });
  const server = await startServerFor(t, { configPath: config.configPath });
  const mod = await loadModule();

  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = (pathname) => fetch(server.baseUrl + pathname);

  const handle = mod.mount(container, { project: "main", issueId: FULL, initialRole: "tester", fetchImpl });
  await handle.ready;

  let tabButtons = container.findAll((n) => n.tagName === "BUTTON" && n.dataset.tabId);
  assert.ok(tabButtons.length > 1, "expected real tester tabs to render");
  const testerIds = tabButtons.map((b) => b.dataset.tabId);
  assert.ok(testerIds.includes(mod.HUMAN_TASKS_TAB_ID));

  // No persistent .sidebar anywhere, against the real DOM this module built.
  assert.strictEqual(container.findAll((n) => String(n.className).split(/\s+/).includes("sidebar")).length, 0);

  await handle.selectRole("developer");
  tabButtons = container.findAll((n) => n.tagName === "BUTTON" && n.dataset.tabId);
  const developerIds = tabButtons.map((b) => b.dataset.tabId);
  for (const id of testerIds) {
    if (id === mod.HUMAN_TASKS_TAB_ID) continue;
    assert.ok(!developerIds.includes(id), `developer's real tab set must not include tester's "${id}"`);
  }
});

// ---------------------------------------------------------------------------
// TC-003: resolveActiveTab, fed a real GET .../roles/analyst response for
// two issues — one with brd.md present, one without.
// ---------------------------------------------------------------------------

test("TC-003: resolveActiveTab(\"brd\", ...) keeps the tab across a real issue switch, brd.md present and missing", async (t) => {
  autoCleanup(t);
  const repo = makeTempRepo({
    name: "main",
    issues: [FULL],
    extraFiles: { [`docs/issues/open/${NO_BRD}/prompt.md`]: noBrdPromptDoc() },
  });
  const config = makeConfig({ projects: [{ name: "main", path: repo.root }] });
  const server = await startServerFor(t, { configPath: config.configPath });
  const mod = await loadModule();

  const docsOfFull = await getJson(server, roleUrl("main", FULL, "analyst"));
  const docsOfNoBrd = await getJson(server, roleUrl("main", NO_BRD, "analyst"));

  // Precondition sanity: the real server really does disagree about brd.md
  // between these two issues — this must not be a vacuous pass because both
  // issues actually have brd.md.
  const brdInFull = docsOfFull.items.find((i) => i.name === "brd.md");
  const brdInNoBrd = docsOfNoBrd.items.find((i) => i.name === "brd.md");
  assert.strictEqual(brdInFull.status, "present");
  assert.strictEqual(brdInNoBrd.status, "missing");

  assert.strictEqual(mod.resolveActiveTab("brd", docsOfFull), "brd");
  assert.strictEqual(mod.resolveActiveTab("brd", docsOfNoBrd), "brd", "the tab must stay put even though brd.md is missing at the new issue");

  const tabsAtNoBrd = mod.buildTabSet(docsOfNoBrd);
  const brdTab = tabsAtNoBrd.find((t2) => t2.id === "brd");
  assert.strictEqual(brdTab.item.status, "missing", "the missing state must still be there for the caller to render");
});

test("mount(): switching Issue against a real server keeps the active tab, even into a missing document (TC-003)", async (t) => {
  autoCleanup(t);
  const repo = makeTempRepo({
    name: "main",
    issues: [FULL],
    extraFiles: { [`docs/issues/open/${NO_BRD}/prompt.md`]: noBrdPromptDoc() },
  });
  const config = makeConfig({ projects: [{ name: "main", path: repo.root }] });
  const server = await startServerFor(t, { configPath: config.configPath });
  const mod = await loadModule();

  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = (pathname) => fetch(server.baseUrl + pathname);

  const handle = mod.mount(container, { project: "main", issueId: FULL, initialRole: "analyst", fetchImpl });
  await handle.ready;

  handle.selectTab("brd");
  assert.strictEqual(handle.getState().activeTabId, "brd");

  await handle.selectIssue(NO_BRD);
  assert.strictEqual(handle.getState().activeTabId, "brd", "the real NO_BRD issue has no brd.md, but the tab must not jump away");

  const panels = container.findAll((n) => n.className === "doc-panel");
  assert.strictEqual(panels.length, 1);
  assert.strictEqual(panels[0].dataset.tabId, "brd");
  const badges = panels[0].findAll((n) => n.className === "badge");
  assert.ok(badges.some((b) => b.textContent === "missing"));
});

// ---------------------------------------------------------------------------
// TC-029: countProjectTodos, fed a real GET /api/inbox response spanning two
// issues of one project, plus an unrelated second project.
// ---------------------------------------------------------------------------

const TODO_ISSUE_A = "20260201-feat-fixture-todos-a";
const TODO_ISSUE_B = "20260202-feat-fixture-todos-b";
const OTHER_HUMAN_ISSUE = "20260203-feat-fixture-todos-other";

// Two valid `pending` rows, both Origin-ing to TODO_ISSUE_A — TC-029 step 1's
// literal "2 pending manual TC" half.
const TEST_PLAN_MD = [
  "# Manual Test Plan",
  "",
  "Last allocated: PTC-0002",
  "",
  "| PTC | Area | Test case | Prio | Origin | Last run | Status |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  `| PTC-0001 | ui | First pending case | High | ${TODO_ISSUE_A}#TC-001 | 2026-08-01 | pending |`,
  `| PTC-0002 | ui | Second pending case | High | ${TODO_ISSUE_A}#TC-002 | 2026-08-01 | pending |`,
  "",
].join("\n");

// roles.specs resolved to an actor agents.yml declares kind: human — one
// human task, on TODO_ISSUE_B — TC-029 step 1's "1 human task" half.
function humanPromptDoc(issueId) {
  return [
    "---",
    "doc_language: English",
    "size_tier: medium",
    "roles:",
    "  specs: { write: human }",
    "---",
    "",
    `# ${issueId}`,
    "",
    "Type: feat. A pipeline key resolved to a human actor.",
    "",
  ].join("\n");
}
const HUMAN_AGENTS_YML = ["actors:", "  human: { kind: human }", ""].join("\n");

function buildTodosFixture(t) {
  autoCleanup(t);
  const main = makeTempRepo({
    name: "main",
    issues: [],
    extraFiles: {
      "docs/planning/test-plan.md": TEST_PLAN_MD,
      "docs/planning/agents.yml": HUMAN_AGENTS_YML,
      [`docs/issues/open/${TODO_ISSUE_B}/prompt.md`]: humanPromptDoc(TODO_ISSUE_B),
    },
  });
  // A second, unrelated project with its own human task — proves
  // countProjectTodos() does not leak another project's items into "main"'s
  // count (real cross-project data, not a hand-built single-project fixture).
  const other = makeTempRepo({
    name: "other",
    issues: [],
    extraFiles: {
      "docs/planning/agents.yml": HUMAN_AGENTS_YML,
      [`docs/issues/open/${OTHER_HUMAN_ISSUE}/prompt.md`]: humanPromptDoc(OTHER_HUMAN_ISSUE),
    },
  });
  const config = makeConfig({
    projects: [
      { name: "main", path: main.root },
      { name: "other", path: other.root },
    ],
  });
  return { main, other, configPath: config.configPath };
}

test("TC-029 step 1: countProjectTodos(inboxResponse, \"main\"), fed a real GET /api/inbox, sums 2 manual TC (issue A) + 1 human task (issue B) = 3", async (t) => {
  const fx = buildTodosFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath });
  const mod = await loadModule();

  const inboxResponse = await getJson(server, "/api/inbox");

  // Precondition sanity: the real response really does carry both kinds,
  // spread across the two issues and the two projects — not a vacuous fixture.
  assert.ok(inboxResponse.manualTests.some((m) => m.project === "main" && m.issueId === TODO_ISSUE_A));
  assert.ok(inboxResponse.humanTasks.some((h) => h.project === "main" && h.issueId === TODO_ISSUE_B));
  assert.ok(inboxResponse.humanTasks.some((h) => h.project === "other"));

  assert.strictEqual(mod.countProjectTodos(inboxResponse, "main"), 3);
  // The "other" project's own real human task must count for "other", not
  // leak into (or out of) "main"'s sum.
  assert.strictEqual(mod.countProjectTodos(inboxResponse, "other"), 1);
  assert.strictEqual(mod.countProjectTodos(inboxResponse, "nonexistent-project"), 0);
});

test("mount(): Дела tab shows the real project-wide count from GET /api/inbox, unaffected by which issue/role is active", async (t) => {
  const fx = buildTodosFixture(t);
  const server = await startServerFor(t, { configPath: fx.configPath });
  const mod = await loadModule();

  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = (pathname) => fetch(server.baseUrl + pathname);

  const handle = mod.mount(container, { project: "main", issueId: TODO_ISSUE_B, initialRole: "analyst", fetchImpl });
  await handle.ready;
  await new Promise((resolve) => setTimeout(resolve, 0)); // let loadProjectTodoCount settle

  const tabButtons = container.findAll((n) => n.tagName === "BUTTON" && n.dataset.tabId === mod.HUMAN_TASKS_TAB_ID);
  assert.strictEqual(tabButtons.length, 1);
  assert.strictEqual(tabButtons[0].textContent, "Дела (3)", "real project-wide count: 2 manual TC + 1 human task = 3");
});

// TC-029 step 4's grep: no repeat fetch("/api/inbox") when Role/Issue
// switches — checked at the source level here (test/workspace-ui.test.js
// already checks this at runtime with a call counter; this is the
// complementary static check the test plan's step literally asks for).
test("source: /api/inbox has exactly one call site (fetchInbox), memoized by fetchInboxOnce (TC-029 step 4)", () => {
  const fetchInboxCallSites = SOURCE.match(/fetchInbox\(options\.fetchImpl\)/g) || [];
  assert.strictEqual(fetchInboxCallSites.length, 1, "fetchInbox(options.fetchImpl) must have exactly one call site, inside fetchInboxOnce()");
  assert.ok(SOURCE.includes("if (!inboxPromise)"), "the memoization guard must exist so a repeat call reuses the first promise");
});

// ---------------------------------------------------------------------------
// TC-030: renderChecklistPanel, fed a real GET .../checklist response with a
// genuine looseSections entry produced by lib/checklist.js itself.
// ---------------------------------------------------------------------------

const CHECKLIST_ISSUE = "20260301-feat-fixture-checklist-loose";

test("TC-030: renderChecklistPanel(), fed a real GET .../checklist response, places .loose-sections after the last TC panel with the right class", async (t) => {
  autoCleanup(t);
  const repo = makeTempRepo({
    name: "main",
    issues: [],
    extraFiles: {
      [`docs/issues/open/${CHECKLIST_ISSUE}/prompt.md`]: [
        "---",
        "doc_language: English",
        "size_tier: medium",
        "---",
        "",
        `# ${CHECKLIST_ISSUE}`,
        "",
        "Type: feat. Checklist with a stray line between TC blocks.",
        "",
      ].join("\n"),
      [`docs/issues/open/${CHECKLIST_ISSUE}/manual_test_checklist.md`]: checklistDoc({
        issueId: CHECKLIST_ISSUE,
        feature: "Loose section fixture",
        cases: 2,
        steps: 1,
        // A line inside TC-001's own section that matches none of
        // lib/checklist.js's known labels — this is what actually lands in
        // parsed.looseSections with afterTc: "TC-001" (not a hand-built
        // object shaped like one).
        extraSections: { "TC-001": ["Случайная нераспознанная строка, зажатая между блоками."] },
      }),
    },
  });
  const config = makeConfig({ projects: [{ name: "main", path: repo.root }] });
  const server = await startServerFor(t, { configPath: config.configPath });
  const mod = await loadModule();

  const parsedChecklist = await getJson(server, checklistUrl("main", CHECKLIST_ISSUE));

  // Precondition sanity: the real parser really produced a loose section
  // from this fixture, attached to TC-001 — not a fixture that accidentally
  // parses clean.
  assert.ok(Array.isArray(parsedChecklist.looseSections) && parsedChecklist.looseSections.length >= 1);
  assert.ok(parsedChecklist.looseSections.some((s) => s.afterTc === "TC-001"));

  const html = mod.renderChecklistPanel(parsedChecklist);
  assert.strictEqual(typeof html, "string");

  const lastPanelOpenIndex = html.lastIndexOf('<div class="panel"');
  const lastPanelCloseIndex = html.indexOf("</div>", lastPanelOpenIndex);
  const looseSectionsIndex = html.indexOf('<div class="loose-sections">');
  assert.ok(lastPanelOpenIndex >= 0 && looseSectionsIndex >= 0);
  assert.ok(looseSectionsIndex > lastPanelCloseIndex, ".loose-sections must render after the last TC .panel, not inside it");
  assert.ok(html.includes("Дополнительные заметки"));
  assert.ok(html.includes("После TC-001"));
  assert.ok(html.includes("Случайная нераспознанная строка"), "the real stray line's text must actually reach the rendered HTML");

  const looseBlock = html.slice(looseSectionsIndex, html.lastIndexOf("</div>"));
  assert.ok(!looseBlock.includes('class="panel"'), ".loose-sections must never carry the .panel class");
});
