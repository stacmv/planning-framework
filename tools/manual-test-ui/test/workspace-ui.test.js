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
    this.checked = undefined;
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
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
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
  // CR-005 fix (Task 33) — just enough of `Element.querySelector`/
  // `Element.scrollIntoView` to exercise `workspace.js`'s
  // `maybeScrollToPtcId`'s ONE selector shape (`[data-tc-id="..."]`), so
  // that scroll-to-TC path is actually asserted rather than only
  // feature-detected-and-skipped under this fake DOM. `scrollIntoView` calls
  // are recorded on `this` for tests to inspect, mirroring `dispatchClick`/
  // `dispatchChange`'s own "record, don't actually do" convention.
  querySelector(selector) {
    const m = /^\[data-tc-id="([^"]*)"\]$/.exec(selector);
    if (!m) return null;
    const wanted = m[1];
    return this.findAll((n) => n.dataset && n.dataset.tcId === wanted)[0] || null;
  }
  scrollIntoView(options) {
    this._scrollIntoViewCalls = (this._scrollIntoViewCalls || 0) + 1;
    this._lastScrollIntoViewOptions = options;
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
// sortedIssueOptions — [Issue ▾]'s open/closed distinction (dogfooding
// feedback: open and closed issues were visually identical in the picker).
// ---------------------------------------------------------------------------

test("sortedIssueOptions: closed issues sort after every open one, each group keeping its original relative order", async () => {
  const mod = await loadModule();
  const issues = [
    { issueId: "20260101-closed-a", status: "closed" },
    { issueId: "20260102-open-a", status: "open" },
    { issueId: "20260103-closed-b", status: "closed" },
    { issueId: "20260104-open-b", status: "open" },
  ];
  const result = mod.sortedIssueOptions(issues);
  assert.deepStrictEqual(
    result.map((o) => o.issueId),
    ["20260102-open-a", "20260104-open-b", "20260101-closed-a", "20260103-closed-b"]
  );
});

test("sortedIssueOptions: closed issues get a \"closed · \" label prefix, open issues get their bare id", async () => {
  const mod = await loadModule();
  const result = mod.sortedIssueOptions([
    { issueId: "20260101-open-a", status: "open" },
    { issueId: "20260102-closed-a", status: "closed" },
  ]);
  assert.deepStrictEqual(result, [
    { issueId: "20260101-open-a", label: "20260101-open-a" },
    { issueId: "20260102-closed-a", label: "closed · 20260102-closed-a" },
  ]);
});

test("sortedIssueOptions: tolerates a missing/non-array input", async () => {
  const mod = await loadModule();
  assert.deepStrictEqual(mod.sortedIssueOptions(null), []);
  assert.deepStrictEqual(mod.sortedIssueOptions(undefined), []);
});

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

// ---------------------------------------------------------------------------
// renderChecklistPanel — TC-030 (pure, no DOM, returns a string).
// ---------------------------------------------------------------------------

function tc(id, name, overrides = {}) {
  return {
    id,
    name,
    headingLineIndex: 0,
    prerequisites: [],
    requiredData: [],
    dataStatus: "unknown",
    preparedPath: null,
    steps: [],
    notesLineIndex: null,
    notesText: "",
    parseWarnings: [],
    ...overrides,
  };
}

test("renderChecklistPanel returns a plain string, not a DOM node (TC-030 Preconditions)", async () => {
  const mod = await loadModule();
  const result = mod.renderChecklistPanel({ tcs: [tc("TC-001", "First case")], looseSections: [] });
  assert.strictEqual(typeof result, "string");
});

test("renderChecklistPanel handles a null/malformed input without throwing, still returns a string", async () => {
  const mod = await loadModule();
  assert.strictEqual(typeof mod.renderChecklistPanel(null), "string");
  assert.strictEqual(typeof mod.renderChecklistPanel({}), "string");
});

// TC-030 step 2: .loose-sections comes after the last TC .panel in the
// returned string, never inside a TC block — checked by substring index of
// occurrence, not via DOM. Also checks the required heading/caption text.
test("renderChecklistPanel places .loose-sections after the last TC .panel, with the required heading and caption (TC-030 step 2)", async () => {
  const mod = await loadModule();
  const parsed = {
    tcs: [tc("TC-001", "First case"), tc("TC-002", "Second case")],
    looseSections: [{ afterTc: "TC-001", lineIndex: 5, text: "## Stray heading between blocks" }],
  };
  const html = mod.renderChecklistPanel(parsed);

  const lastPanelOpenIndex = html.lastIndexOf('<div class="panel"');
  const lastPanelCloseIndex = html.indexOf("</div>", lastPanelOpenIndex);
  const looseSectionsIndex = html.indexOf('<div class="loose-sections">');

  assert.ok(lastPanelOpenIndex >= 0, "expected at least one TC .panel");
  assert.ok(looseSectionsIndex >= 0, "expected a .loose-sections block");
  assert.ok(
    looseSectionsIndex > lastPanelCloseIndex,
    ".loose-sections must come after the last TC .panel closes, not inside it"
  );
  assert.ok(html.includes("Дополнительные заметки"), "expected the required heading");
  assert.ok(
    html.includes("нераспознанный текст между блоками чек-листа — не тест-кейс"),
    "expected the required caption"
  );
  assert.ok(html.includes("Stray heading between blocks"), "expected the loose line's own text to appear");
});

// TC-030 step 3: not `.panel` — a distinct class.
test("renderChecklistPanel's .loose-sections block never carries the .panel class (TC-030 step 3)", async () => {
  const mod = await loadModule();
  const html = mod.renderChecklistPanel({
    tcs: [tc("TC-001", "First case")],
    looseSections: [{ afterTc: "TC-001", lineIndex: 3, text: "stray line" }],
  });
  const looseBlockStart = html.indexOf('<div class="loose-sections">');
  const looseBlockEnd = html.lastIndexOf("</div>");
  const looseBlock = html.slice(looseBlockStart, looseBlockEnd);
  assert.ok(!looseBlock.includes('class="panel"'), ".loose-sections must not be (or contain) a .panel");
});

// TC-030 step 4: grouped by afterTc, items within a group in ascending
// lineIndex order, groups in file order — fed out of natural order to
// confirm the function itself sorts/groups rather than trusting input order.
test("renderChecklistPanel groups looseSections by afterTc, items in ascending lineIndex order (TC-030 step 4)", async () => {
  const mod = await loadModule();
  const parsed = {
    tcs: [tc("TC-001", "First"), tc("TC-002", "Second")],
    looseSections: [
      { afterTc: "TC-002", lineIndex: 20, text: "after-TC-002 line A" },
      { afterTc: "TC-001", lineIndex: 12, text: "after-TC-001 line B (later)" },
      { afterTc: "TC-001", lineIndex: 8, text: "after-TC-001 line A (earlier)" },
    ],
  };
  const html = mod.renderChecklistPanel(parsed);

  // Group order: TC-001's group (first afterTc to appear by lineIndex) must
  // come before TC-002's group.
  const tc1GroupIndex = html.indexOf("После TC-001");
  const tc2GroupIndex = html.indexOf("После TC-002");
  assert.ok(tc1GroupIndex >= 0 && tc2GroupIndex >= 0, "expected both groups to render");
  assert.ok(tc1GroupIndex < tc2GroupIndex, "TC-001's group must render before TC-002's group (file order)");

  // Within TC-001's group, the earlier lineIndex (8) item must render
  // before the later one (12), regardless of input array order.
  const earlierIndex = html.indexOf("after-TC-001 line A (earlier)");
  const laterIndex = html.indexOf("after-TC-001 line B (later)");
  assert.ok(earlierIndex >= 0 && laterIndex >= 0);
  assert.ok(earlierIndex < laterIndex, "items within a group must be in ascending lineIndex order");
});

// TC-030 step 5: an item whose afterTc matches no rendered TC still renders,
// at the end of the block — not dropped.
test("renderChecklistPanel keeps an orphan afterTc item, appended at the end of the block (TC-030 step 5)", async () => {
  const mod = await loadModule();
  const parsed = {
    tcs: [tc("TC-001", "First"), tc("TC-002", "Second")],
    looseSections: [
      { afterTc: "TC-001", lineIndex: 4, text: "known group line" },
      { afterTc: "TC-999", lineIndex: 2, text: "orphan line — no TC-999 in this checklist" },
    ],
  };
  const html = mod.renderChecklistPanel(parsed);

  assert.ok(html.includes("orphan line — no TC-999 in this checklist"), "the orphan item must still be rendered, not dropped");

  const knownIndex = html.indexOf("known group line");
  const orphanIndex = html.indexOf("orphan line — no TC-999 in this checklist");
  assert.ok(
    orphanIndex > knownIndex,
    "the orphan item (lineIndex 2, earlier than the known item's lineIndex 4) must still land at the END of the block, not in lineIndex position"
  );
});

// TC-030 step 6: each text line rendered as-is, no markdown parsing —
// markdown syntax characters appear literally (escaped for HTML safety),
// never transformed into markup.
test("renderChecklistPanel renders each loose line as-is, without markdown parsing (TC-030 step 6)", async () => {
  const mod = await loadModule();
  const html = mod.renderChecklistPanel({
    tcs: [tc("TC-001", "First")],
    looseSections: [{ afterTc: "TC-001", lineIndex: 3, text: "**not bold** and _not italic_ and `not code`" }],
  });
  // Escaped literally: no markdown transformation (no <strong>/<em>/<code>
  // produced from this line), just the escaped source text.
  assert.ok(!html.includes("<strong>"), "must not markdown-parse ** as bold");
  assert.ok(!html.includes("<em>"), "must not markdown-parse _..._ as italic");
  assert.ok(
    html.includes("**not bold** and _not italic_ and `not code`"),
    "the raw text must appear verbatim (escaped, not interpreted)"
  );
});

test("renderChecklistPanel renders no .loose-sections block at all when looseSections is empty", async () => {
  const mod = await loadModule();
  const html = mod.renderChecklistPanel({ tcs: [tc("TC-001", "First")], looseSections: [] });
  assert.ok(!html.includes("loose-sections"), "no looseSections means no .loose-sections block");
});

// Switching manual_test_checklist.md to the structured render must not
// narrow what the reader can see compared to the generic raw-markdown path
// this tab used before this task: prerequisites, declared test data,
// header meta and parse warnings still have to show up somewhere in the
// returned string, not only the steps table.
test("renderChecklistPanel includes meta, prerequisites, declared test data and parse warnings, read-only", async () => {
  const mod = await loadModule();
  const parsed = {
    meta: { "Feature Name": "Widget export", "Issue ID": "20260101-feat-a" },
    tcs: [
      tc("TC-001", "Export a widget", {
        prerequisites: ["The fixture repo is checked out."],
        requiredData: ["fixtures/widget.json"],
        dataStatus: "declared",
        notesText: "Nothing unusual observed.",
        parseWarnings: ["row 5: fewer columns than header — skipped"],
      }),
    ],
    looseSections: [],
  };
  const html = mod.renderChecklistPanel(parsed);

  assert.ok(html.includes("Widget export"), "expected meta (Feature Name) to appear");
  assert.ok(html.includes("20260101-feat-a"), "expected meta (Issue ID) to appear");
  assert.ok(html.includes("The fixture repo is checked out."), "expected the TC's prerequisite to appear");
  assert.ok(html.includes("fixtures/widget.json"), "expected the TC's declared test data to appear");
  assert.ok(html.includes("Nothing unusual observed."), "expected the TC's notes to appear");
  assert.ok(
    html.includes("row 5: fewer columns than header — skipped"),
    "expected the TC's parseWarnings to appear, not be silently dropped"
  );
});

test("renderChecklistPanel renders dataStatus \"none\" distinctly from \"declared\"/\"unknown\"", async () => {
  const mod = await loadModule();
  const html = mod.renderChecklistPanel({
    tcs: [tc("TC-001", "No data needed", { dataStatus: "none", requiredData: [] })],
    looseSections: [],
  });
  assert.ok(html.includes("Test Data"), "expected a Test Data label for the explicit \"none\" case");
  assert.ok(html.includes("none"), "expected the explicit \"none\" marker to render");
});

test("renderChecklistPanel renders no Test Data line at all for dataStatus \"unknown\" (silence is not a claim of \"not needed\")", async () => {
  const mod = await loadModule();
  const html = mod.renderChecklistPanel({
    tcs: [tc("TC-001", "Unknown data need")], // default dataStatus: "unknown", requiredData: []
    looseSections: [],
  });
  assert.ok(!html.includes("Test Data"), "an unknown data need must not render as though it were declared \"none\"");
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
// countIssueTodos — TC-029 (pure, no DOM, no fetch). Dogfooding round 2
// revised AC-06a/specs.md §3.4/this test's own TC-029 from project-wide to
// issue-scoped — the counter's own rendered content
// (`loadAndRenderIssueManualTests`) was already issue-scoped, so a
// project-wide number next to issue-scoped content was the real
// inconsistency.
// ---------------------------------------------------------------------------

// TC-029 step 1, literally: 2 pending manual TC on issue A + 1 human task on
// issue B, both project "main" -> counting issue A alone is 2, not 3 — the
// human task on issue B must not leak into issue A's own count.
test("countIssueTodos sums manualTests + humanTasks of ONE issue, ignoring other issues of the same project (TC-029 step 1)", async () => {
  const mod = await loadModule();
  const inboxResponse = {
    manualTests: [
      { project: "main", issueId: "20260101-feat-a", ptcId: "PTC-001" },
      { project: "main", issueId: "20260101-feat-a", ptcId: "PTC-002" },
    ],
    humanTasks: [{ project: "main", issueId: "20260102-feat-b", stageKey: "specs" }],
  };
  assert.strictEqual(mod.countIssueTodos(inboxResponse, "main", "20260101-feat-a"), 2);
  assert.strictEqual(mod.countIssueTodos(inboxResponse, "main", "20260102-feat-b"), 1);
});

// TC-029 step 2: exactly three parameters — project AND issue, but still no
// role parameter at all. This remains the structural half of AC-06b: the
// function is physically incapable of depending on role because it cannot
// see one.
test("countIssueTodos takes exactly three parameters — project + issue, no role parameter (TC-029 step 2, AC-06b)", async () => {
  const mod = await loadModule();
  assert.strictEqual(mod.countIssueTodos.length, 3);
});

test("countIssueTodos returns 0, not undefined/throw, for an issue with no todos (TC-029 step 3)", async () => {
  const mod = await loadModule();
  const inboxResponse = {
    manualTests: [{ project: "other-project", issueId: "20260101-feat-a", ptcId: "PTC-001" }],
    humanTasks: [{ project: "other-project", issueId: "20260101-feat-a", stageKey: "specs" }],
  };
  assert.strictEqual(mod.countIssueTodos(inboxResponse, "main", "20260101-feat-a"), 0);
});

test("countIssueTodos ignores items of other projects/issues and never counts by role", async () => {
  const mod = await loadModule();
  const inboxResponse = {
    manualTests: [
      { project: "main", issueId: "20260101-feat-a", ptcId: "PTC-001" },
      { project: "side-project", issueId: "20260101-feat-a", ptcId: "PTC-099" },
    ],
    humanTasks: [
      { project: "main", issueId: "20260102-feat-b", stageKey: "specs" },
      { project: "main", issueId: "20260101-feat-a", stageKey: "code" },
    ],
  };
  // No item carries a "role" field at all — filtering by project+issue
  // alone already yields the "across all roles" sum (specs.md §3.4).
  for (const item of [...inboxResponse.manualTests, ...inboxResponse.humanTasks]) {
    assert.ok(!("role" in item), "fixture items must not carry a role field, mirroring the real endpoint's shape");
  }
  assert.strictEqual(mod.countIssueTodos(inboxResponse, "main", "20260101-feat-a"), 2);
});

test("countIssueTodos handles null/empty inboxResponse without throwing", async () => {
  const mod = await loadModule();
  assert.strictEqual(mod.countIssueTodos(null, "main", "20260101-feat-a"), 0);
  assert.strictEqual(mod.countIssueTodos({}, "main", "20260101-feat-a"), 0);
  assert.strictEqual(mod.countIssueTodos({ manualTests: [], humanTasks: [] }, "main", "20260101-feat-a"), 0);
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

// Dogfooding round 2: buildTabSet also accepts an ARRAY of role-contents
// responses — the union case mount() now uses for its multi-select role
// filter (empty selection = every role, several selected = their union).
test("buildTabSet([...]) unions several roles' documents, deduped by tab id, still exactly one Дела tab", async () => {
  const mod = await loadModule();
  const tester = testerContents("20260101-feat-a", { qaReportPresent: true });
  const developer = developerContents("20260101-feat-a");
  const tabs = mod.buildTabSet([tester, developer]);

  const ids = tabs.map((t) => t.id);
  assert.deepStrictEqual(ids, ["test_plan", "manual_test_checklist", "qa_report", "specs", "implementation_plan", mod.HUMAN_TASKS_TAB_ID]);
  assert.strictEqual(ids.filter((id) => id === mod.HUMAN_TASKS_TAB_ID).length, 1, "exactly one Дела tab, not one per role");
});

test("buildTabSet([...]) keeps the first occurrence of a tab id two roles both declare, not a duplicate", async () => {
  const mod = await loadModule();
  const testerA = testerContents("20260101-feat-a", { qaReportPresent: true });
  const testerAgain = testerContents("20260101-feat-a", { qaReportPresent: false }); // same ids, different status
  const tabs = mod.buildTabSet([testerA, testerAgain]);

  const qaTabs = tabs.filter((t) => t.id === "qa_report");
  assert.strictEqual(qaTabs.length, 1, "one tab per distinct id, even across several role responses");
  assert.strictEqual(qaTabs[0].item.status, "present", "the FIRST response's item wins, not a later one silently overwriting it");
});

// A bare (non-array) response still works exactly as before — the single-
// role shape every existing pure-function test above already relies on.
test("buildTabSet(singleResponse) is equivalent to buildTabSet([singleResponse])", async () => {
  const mod = await loadModule();
  const contents = testerContents("20260101-feat-a", { qaReportPresent: true });
  assert.deepStrictEqual(mod.buildTabSet(contents), mod.buildTabSet([contents]));
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
// renderTabs — n/a hidden from the row, missing visually distinct, issue vs.
// project grouping (dogfooding feedback on 20260806-feat-project-explorer-
// redesign: n/a/missing tabs were indistinguishable from present ones, and
// issue/project documents were one undifferentiated pill row).
// ---------------------------------------------------------------------------

function mixedKindContents(issueId) {
  return {
    project: "proj-a",
    issueId,
    issueStatus: "open",
    role: { id: "tester", title: "Тестировщик", description: "" },
    items: [
      { id: "test_plan.md", kind: "issue_doc", name: "test_plan.md", label: "Test plan", status: "present" },
      { id: "qa_report.md", kind: "issue_doc", name: "qa_report.md", label: "QA report", status: "missing" },
      {
        id: "manual_test_checklist.md",
        kind: "issue_doc",
        name: "manual_test_checklist.md",
        label: "Manual test checklist",
        status: "not_applicable",
        message: "manual_test_checklist.md не относится к этому типу issue.",
      },
      { id: ".qa-workflow.md", kind: "project_doc", name: ".qa-workflow.md", label: "QA workflow", status: "present" },
    ],
  };
}

test("mount(): n/a items get no button in the row at all, missing items get .doc-tab--missing, present items get neither", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const routes = {
    "/api/roles": ROLES_RESPONSE,
    "/api/projects/proj-a/issues": ISSUES_RESPONSE,
    "/api/projects/proj-a/issues/20260101-feat-a/roles/tester": mixedKindContents("20260101-feat-a"),
    "/api/inbox": EMPTY_INBOX_RESPONSE,
  };
  const fetchImpl = routedFetch(routes);

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
  await handle.ready;

  const buttons = container.findAll((n) => n.tagName === "BUTTON" && n.dataset.tabId);
  const byId = new Map(buttons.map((b) => [b.dataset.tabId, b]));

  assert.ok(byId.has("test_plan"), "present item keeps its button");
  assert.ok(!String(byId.get("test_plan").className).includes("doc-tab--missing"));

  assert.ok(byId.has("qa_report"), "missing item keeps its button");
  assert.ok(String(byId.get("qa_report").className).includes("doc-tab--missing"));

  assert.ok(!byId.has("manual_test_checklist"), "not_applicable item gets no button in the row at all");

  assert.ok(byId.has(".qa-workflow"), "project doc keeps its button");
  assert.ok(!String(byId.get(".qa-workflow").className).includes("doc-tab--missing"));
});

test("mount(): doc-tabs are grouped — issue_doc items under an \"Issue\" label, other kinds under a \"Проект\" label", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const routes = {
    "/api/roles": ROLES_RESPONSE,
    "/api/projects/proj-a/issues": ISSUES_RESPONSE,
    "/api/projects/proj-a/issues/20260101-feat-a/roles/tester": mixedKindContents("20260101-feat-a"),
    "/api/inbox": EMPTY_INBOX_RESPONSE,
  };
  const fetchImpl = routedFetch(routes);

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
  await handle.ready;

  const groups = container.findAll((n) => n.className === "tab-group");
  assert.strictEqual(groups.length, 3, "Issue group, Проект group, and the unlabeled Дела group");

  const labels = groups.map((g) => {
    const label = g.findAll((n) => n.className === "group-label")[0];
    return label ? label.textContent : null;
  });
  assert.deepStrictEqual(labels, ["Issue", "Проект", "Входящие"]);

  const issueGroupIds = groups[0].findAll((n) => n.tagName === "BUTTON").map((b) => b.dataset.tabId);
  assert.deepStrictEqual(issueGroupIds, ["test_plan", "qa_report"]); // manual_test_checklist is n/a, hidden

  const projectGroupIds = groups[1].findAll((n) => n.tagName === "BUTTON").map((b) => b.dataset.tabId);
  assert.deepStrictEqual(projectGroupIds, [".qa-workflow"]);

  const delaGroupIds = groups[2].findAll((n) => n.tagName === "BUTTON").map((b) => b.dataset.tabId);
  assert.deepStrictEqual(delaGroupIds, [mod.HUMAN_TASKS_TAB_ID]);
});

test("mount(): an n/a tab that is (or becomes) the active tab still renders its panel/message, even though it has no button in the row — resolveActiveTab's stability guarantee is preserved", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const routes = {
    "/api/roles": ROLES_RESPONSE,
    "/api/projects/proj-a/issues": ISSUES_RESPONSE,
    "/api/projects/proj-a/issues/20260101-feat-a/roles/tester": mixedKindContents("20260101-feat-a"),
    "/api/inbox": EMPTY_INBOX_RESPONSE,
  };
  const fetchImpl = routedFetch(routes);

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: "20260101-feat-a",
    initialRoles: ["tester"],
    initialTab: "manual_test_checklist",
    fetchImpl,
  });
  await handle.ready;

  assert.ok(
    !container.findAll((n) => n.tagName === "BUTTON" && n.dataset.tabId === "manual_test_checklist").length,
    "the n/a tab still has no button"
  );
  const panel = container.findAll((n) => n.className === "doc-panel")[0];
  assert.ok(panel, "the panel still renders for the hidden-but-active tab");
  assert.strictEqual(panel.dataset.tabId, "manual_test_checklist");
  assert.ok(
    panel.findAll((n) => n.className === "notice" && n.textContent.includes("не относится к этому типу issue")).length,
    "the item's own message is shown, not a blank panel"
  );
});

// ---------------------------------------------------------------------------
// mount() — TC-002 steps 1-3 through the module's own DOM rendering.
// ---------------------------------------------------------------------------

const EMPTY_INBOX_RESPONSE = { manualTests: [], humanTasks: [], totalCount: 0 };

function baseRoutes(overrides = {}) {
  return {
    "/api/roles": ROLES_RESPONSE,
    "/api/projects/proj-a/issues": ISSUES_RESPONSE,
    "/api/projects/proj-a/issues/20260101-feat-a/roles/tester": testerContents("20260101-feat-a", { qaReportPresent: true }),
    "/api/projects/proj-a/issues/20260102-feat-b/roles/tester": testerContents("20260102-feat-b", { qaReportPresent: false }),
    "/api/projects/proj-a/issues/20260101-feat-a/roles/developer": developerContents("20260101-feat-a"),
    "/api/inbox": EMPTY_INBOX_RESPONSE,
    ...overrides,
  };
}

// A microtask-queue flush, for tests that need to wait for a `mount()`-level
// async chain (e.g. `loadIssueTodoCount()`) that is deliberately NOT part
// of `handle.ready` to settle before asserting on rendered output.
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("mount(): [Issue ▾] renders closed issues after open ones with a \"closed · \" prefix", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const routes = {
    "/api/roles": ROLES_RESPONSE,
    "/api/projects/proj-a/issues": {
      currentBranch: "develop",
      defaultBranch: "develop",
      issues: [
        { issueId: "20260099-old-closed", status: "closed", checklistStatus: "here", summary: { passedSteps: 0, totalSteps: 0 } },
        { issueId: "20260101-feat-a", status: "open", checklistStatus: "here", summary: { passedSteps: 0, totalSteps: 0 } },
      ],
    },
    "/api/projects/proj-a/issues/20260101-feat-a/roles/tester": testerContents("20260101-feat-a", { qaReportPresent: true }),
    "/api/inbox": EMPTY_INBOX_RESPONSE,
  };
  const fetchImpl = routedFetch(routes);

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
  await handle.ready;

  const issueSelect = container.findAll((n) => n.className === "issue-select")[0];
  const options = issueSelect.findAll((n) => n.tagName === "OPTION");
  assert.deepStrictEqual(
    options.map((o) => o.textContent),
    ["20260101-feat-a", "closed · 20260099-old-closed"]
  );
});

test("mount() renders a header with a back link, an Issue select, and a multi-select role filter, no persistent sidebar", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
  await handle.ready;

  const headers = container.findAll((n) => n.className === "workspace-header");
  assert.strictEqual(headers.length, 1);

  const back = headers[0].findAll((n) => n.className === "workspace-back")[0];
  assert.ok(back, "expected a back link in the workspace header");
  assert.strictEqual(back.href, "#/");

  // Issue is still a native <select>; role became a multi-select filter
  // (dogfooding round 2) — the same `.role-switch` component every other
  // screen in this tool uses, not a second <select>.
  const selects = headers[0].findAll((n) => n.tagName === "SELECT");
  assert.strictEqual(selects.length, 1, "expected exactly one Issue select");
  const roleSwitches = headers[0].findAll((n) => n.className === "role-switch");
  assert.strictEqual(roleSwitches.length, 1, "expected one .role-switch block");
  assert.strictEqual(roleSwitches[0].findAll((n) => n.tagName === "BUTTON").length, ROLES_RESPONSE.roles.length);

  // No `.sidebar` container anywhere — AC-01b.
  const sidebars = container.findAll((n) => n.className && String(n.className).split(/\s+/).includes("sidebar"));
  assert.strictEqual(sidebars.length, 0);
});

test("mount() builds .doc-tabs from GET .../roles/:role for the current role only (TC-002 steps 2-3)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
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

// ---------------------------------------------------------------------------
// The header's role filter (dogfooding round 2, multi-select) — clicking a
// role button TOGGLES it (add/remove), and .doc-tabs becomes the UNION of
// every selected role's own documents, unlike selectRole()'s full replace.
// ---------------------------------------------------------------------------

test("mount(): clicking a second role button in the header ADDS its documents to the union, keeping the first role's tabs too", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  let developerCalls = 0;
  const routes = baseRoutes();
  const fetchImpl = async (url) => {
    if (url === "/api/projects/proj-a/issues/20260101-feat-a/roles/developer") developerCalls++;
    return routedFetch(routes)(url);
  };

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
  await handle.ready;

  const developerBtn = container.findAll((n) => n.tagName === "BUTTON" && n.dataset.roleId === "developer")[0];
  assert.strictEqual(developerBtn.getAttribute("aria-pressed"), "false");
  developerBtn.dispatchClick();
  await flush();

  assert.deepStrictEqual(handle.getState().roleIds, ["tester", "developer"]);
  // Re-query: render() rebuilds the DOM from scratch on every toggle.
  const tabIds = container.findAll((n) => n.tagName === "BUTTON" && n.dataset.tabId).map((b) => b.dataset.tabId);
  assert.deepStrictEqual(tabIds, ["test_plan", "manual_test_checklist", "qa_report", "specs", "implementation_plan", mod.HUMAN_TASKS_TAB_ID]);
  assert.strictEqual(developerCalls, 1, "developer's own GET .../roles/developer must be fetched exactly once");
});

test("mount(): toggling a role keeps the active tab where it still exists in the new union (unlike selectRole's full replace)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
  await handle.ready;

  handle.selectTab("qa_report");
  assert.strictEqual(handle.getState().activeTabId, "qa_report");

  await handle.toggleRole("developer"); // adds developer's docs — qa_report is still in the union
  assert.strictEqual(handle.getState().activeTabId, "qa_report", "toggling a role ON must not reset the active tab away from a still-present one");
});

test("mount(): toggling a role OFF that was the only one contributing the active tab falls back to the first tab", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: "20260101-feat-a",
    initialRoles: ["tester", "developer"],
    fetchImpl,
  });
  await handle.ready;

  handle.selectTab("specs"); // developer-only document
  assert.strictEqual(handle.getState().activeTabId, "specs");

  await handle.toggleRole("developer"); // removes developer -> specs no longer in the union
  assert.notStrictEqual(handle.getState().activeTabId, "specs");
  assert.deepStrictEqual(handle.getState().roleIds, ["tester"]);
});

test("mount(): empty role selection fetches and unions EVERY role's documents, not one arbitrary default", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(
    baseRoutes({
      "/api/projects/proj-a/issues/20260101-feat-a/roles/analyst": analystContents("20260101-feat-a", { brdPresent: true }),
    })
  );

  const mod = await loadModule();
  // No initialRoles, no stored roles — the empty-selection default.
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", fetchImpl });
  await handle.ready;

  assert.deepStrictEqual(handle.getState().roleIds, []);
  const tabIds = handle.getState().tabs.map((t) => t.id);
  assert.ok(tabIds.includes("brd"), "expected the analyst role's own document");
  assert.ok(tabIds.includes("specs"), "expected the developer role's own document");
  assert.ok(tabIds.includes("test_plan"), "expected the tester role's own document");
});

test("mount(): switching Issue keeps the active tab, even into a missing document (TC-003)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
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
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
  await handle.ready;

  const before = handle.getState().activeTabId;
  handle.selectTab("does-not-exist");
  assert.strictEqual(handle.getState().activeTabId, before);
});

// ---------------------------------------------------------------------------
// CR-005 fix (implementation_plan.md Task 33) — `options.initialRole`/
// `initialTab`/`initialPtcId`, as `app.js` forwards them from an inbox
// item's `where` (test/launcher.test.js covers that forwarding end-to-end;
// these tests cover the consuming side: mount() actually landing there).
// ---------------------------------------------------------------------------

test("mount(): a manual-TC inbox click's initialRoles/initialTab (unnormalized, \".md\"-suffixed) lands on the tester role's manual_test_checklist tab (TC-020 step 3)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  // No initialRoles stored/default — proves initialRoles, not the fallback
  // chain, is what selects "tester" here (ROLES_RESPONSE's own first role
  // is "analyst").
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: "20260101-feat-a",
    // Exactly what app.js's inboxTargetHash forwards for a manual TC click
    // (`where.roleId`, `where.doc` verbatim, not pre-stripped of ".md").
    initialRoles: ["tester"],
    initialTab: "manual_test_checklist.md",
    fetchImpl,
  });
  await handle.ready;

  const state = handle.getState();
  assert.deepStrictEqual(state.roleIds, ["tester"]);
  assert.strictEqual(state.activeTabId, "manual_test_checklist");
});

test("mount(): a human-task inbox click's initialTab (\"human-tasks\") lands on the Дела tab (TC-020 step 3)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  // baseRoutes()'s own fixtures only cover the "tester"/"developer" roles'
  // .../roles/:role response for this issue — the fallback role chain here
  // lands on "analyst" (ROLES_RESPONSE's first role, since no initialRole is
  // given), so that route needs its own fixture too.
  const fetchImpl = routedFetch(
    baseRoutes({
      "/api/projects/proj-a/issues/20260101-feat-a/roles/analyst": analystContents("20260101-feat-a", { brdPresent: true }),
    })
  );

  const mod = await loadModule();
  // No initialRole at all — a human task's `where` carries none; the role
  // still resolves via the normal fallback chain (here: the server's first
  // role, "analyst" per ROLES_RESPONSE) and the Дела tab is present on every
  // role's tab set (buildTabSet), so landing on it does not depend on which
  // role was picked.
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: "20260101-feat-a",
    initialTab: mod.HUMAN_TASKS_TAB_ID,
    fetchImpl,
  });
  await handle.ready;

  assert.strictEqual(handle.getState().activeTabId, mod.HUMAN_TASKS_TAB_ID);
});

test("mount(): initialTab only applies to the initial landing — a later selectRole()/selectIssue() does not re-consult it", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: "20260101-feat-a",
    initialRoles: ["tester"],
    initialTab: "qa_report",
    fetchImpl,
  });
  await handle.ready;
  assert.strictEqual(handle.getState().activeTabId, "qa_report");

  // Role switch takes a fresh tab set (first tab), never re-applying the
  // long-consumed initialTab.
  await handle.selectRole("developer");
  assert.strictEqual(handle.getState().activeTabId, "specs");
});

test("mount(): a garbled/stale initialRoles entry not in this project's role list is dropped silently — empty selection shows every role's union, not a blank/broken screen", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  // Dropping to an empty selection means EVERY role gets fetched (the same
  // "empty = everything" rule the filter uses elsewhere) — "analyst" needs
  // its own fixture here (baseRoutes() already covers developer/tester).
  const fetchImpl = routedFetch(
    baseRoutes({
      "/api/projects/proj-a/issues/20260101-feat-a/roles/analyst": analystContents("20260101-feat-a", { brdPresent: true }),
    })
  );

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: "20260101-feat-a",
    initialRoles: ["no-such-role"],
    fetchImpl,
  });
  await handle.ready;

  assert.strictEqual(handle.getState().error, null);
  // The garbled id is gone; nothing else took its place — an empty
  // selection is itself a valid, meaningful state now, not an error.
  assert.deepStrictEqual(handle.getState().roleIds, []);
  // And the tab set is the union of every role's documents (prompt/brd from
  // analyst, specs/implementation_plan from developer, test_plan/
  // manual_test_checklist/qa_report from tester) — a real, rich tab set,
  // not an empty/broken one.
  assert.ok(handle.getState().tabs.length > 1, "expected a real tab set, not an empty/broken one");
  const tabIds = handle.getState().tabs.map((t) => t.id);
  assert.ok(tabIds.includes("brd"), "expected the analyst role's own document in the union");
  assert.ok(tabIds.includes("specs"), "expected the developer role's own document in the union");
  assert.ok(tabIds.includes("test_plan"), "expected the tester role's own document in the union");
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
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
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
    initialRoles: ["tester"],
    fetchImpl,
    onNavigate: (hash) => navigated.push(hash),
  });
  await handle.ready;

  const back = container.findAll((n) => n.className === "workspace-back")[0];
  back.dispatchClick();
  assert.deepStrictEqual(navigated, ["#/"]);
});

// ---------------------------------------------------------------------------
// mount(): "Дела" counter — GET /api/inbox fetched once, reused across role/
// [Issue ▾] switches, but recomputed (client-side, no new fetch) whenever
// the issue changes (revised AC-06a: issue-scoped, not project-wide;
// AC-06b: still role-independent — TC-029 step 4).
// ---------------------------------------------------------------------------

test("mount(): fetches /api/inbox exactly once — role switch keeps the count, issue switch recomputes it from the same response (TC-029 step 4, AC-06b)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");

  let inboxCalls = 0;
  const routes = baseRoutes({
    "/api/inbox": {
      manualTests: [
        { project: "proj-a", issueId: "20260101-feat-a", ptcId: "PTC-001" },
        { project: "proj-a", issueId: "20260101-feat-a", ptcId: "PTC-002" },
      ],
      humanTasks: [{ project: "proj-a", issueId: "20260102-feat-b", stageKey: "specs" }],
    },
    // Needed for this test's own selectRole("developer") -> selectIssue("20260102-feat-b")
    // sequence — baseRoutes() only wires the developer role up for issue A.
    "/api/projects/proj-a/issues/20260102-feat-b/roles/developer": developerContents("20260102-feat-b"),
  });
  const fetchImpl = async (url) => {
    if (url === "/api/inbox") inboxCalls++;
    return routedFetch(routes)(url);
  };

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
  await handle.ready;
  await flush(); // let loadIssueTodoCount (fire-and-forget from loadShell) settle

  assert.strictEqual(inboxCalls, 1, "expected exactly one GET /api/inbox on initial mount");

  function delaLabel() {
    return container.findAll((n) => n.tagName === "BUTTON" && n.dataset.tabId === mod.HUMAN_TASKS_TAB_ID)[0].textContent;
  }

  // Issue A's own 2 manualTests — the humanTask belongs to issue B, excluded.
  assert.strictEqual(delaLabel(), "Дела (2)");

  await handle.selectRole("developer");
  await flush();
  assert.strictEqual(inboxCalls, 1, "switching Role must not trigger a repeat GET /api/inbox");
  // Still issue A — role switch does not change the (issue-scoped) count.
  assert.strictEqual(delaLabel(), "Дела (2)");

  await handle.selectIssue("20260102-feat-b");
  await flush();

  assert.strictEqual(inboxCalls, 1, "switching Issue must not trigger a repeat GET /api/inbox — recomputed from the same response");
  // Issue B's own 1 humanTask now, not issue A's manualTests.
  assert.strictEqual(delaLabel(), "Дела (1)");
});

test("mount(): Дела tab label shows no count until /api/inbox resolves, then updates in place", async () => {
  installFakeDocument();
  const container = new FakeElement("div");

  let resolveInbox;
  const inboxPromise = new Promise((resolve) => {
    resolveInbox = resolve;
  });
  const routes = baseRoutes();
  const fetchImpl = async (url) => {
    if (url === "/api/inbox") {
      await inboxPromise;
      return {
        ok: true,
        status: 200,
        json: async () => ({ manualTests: [{ project: "proj-a", issueId: "20260101-feat-a", ptcId: "PTC-1" }], humanTasks: [] }),
      };
    }
    return routedFetch(routes)(url);
  };

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
  await handle.ready;

  let tabButtons = container.findAll((n) => n.tagName === "BUTTON" && n.dataset.tabId === mod.HUMAN_TASKS_TAB_ID);
  assert.strictEqual(tabButtons[0].textContent, "Дела", "no count yet — /api/inbox has not resolved");

  resolveInbox();
  await flush();

  tabButtons = container.findAll((n) => n.tagName === "BUTTON" && n.dataset.tabId === mod.HUMAN_TASKS_TAB_ID);
  assert.strictEqual(tabButtons[0].textContent, "Дела (1)", "count appears once /api/inbox resolves, without a role/issue switch");
});

// ---------------------------------------------------------------------------
// Checklist write UI (Task 29, CR-001 fix) — real, interactive `.step-*`/
// `.tc-notes-*` DOM nodes built by `buildStepRow`/`buildNotesEditorNode`,
// wired to `PATCH .../checklist/steps`/`PATCH .../checklist/notes`
// (server.js, unchanged by this task). Fake-fetch unit tests: the real HTTP
// round trip against server.js/lib/checklist.js lives in
// test/workspace.test.js (that file is the one already wired to
// startServerFor, and a fake-fetch test alone cannot catch a request-body
// shape the real route would reject — e.g. `step` sent as a string).
// ---------------------------------------------------------------------------

function checklistFixture(overrides = {}) {
  return {
    meta: { "Feature Name": "Fixture" },
    tcs: [
      {
        id: "TC-001",
        name: "First case",
        headingLineIndex: 0,
        prerequisites: [],
        requiredData: [],
        dataStatus: "unknown",
        steps: [
          { step: 1, action: "Do thing 1", expected: "Thing 1 happens", checked: false, note: "", lineIndex: 10, resultColIndex: 3 },
          { step: 2, action: "Do thing 2", expected: "Thing 2 happens", checked: true, note: "already ok", lineIndex: 11, resultColIndex: 3 },
        ],
        notesLineIndex: 20,
        notesText: "",
        parseWarnings: [],
      },
    ],
    looseSections: [],
    ...overrides,
  };
}

// `patchResponses.steps`/`patchResponses.notes` — `{ status, json }` for the
// two PATCH routes; defaults to a 200 `{ ok: true }` for both, matching
// server.js's real success shape. `checklistGetCalls` counts GETs of the
// checklist document itself (not its /steps or /notes children) — the
// signal a cache-invalidation test needs.
function checklistFetchMock({ patchResponses = {}, checklistData } = {}) {
  const calls = []; // PATCH calls: { url, method, body }
  const checklistGetCalls = [];
  const routes = baseRoutes();
  const checklistUrl = "/api/projects/proj-a/issues/20260101-feat-a/checklist";

  const fetchImpl = async (url, init) => {
    if (url === checklistUrl && (!init || !init.method)) {
      checklistGetCalls.push(url);
      return { ok: true, status: 200, json: async () => (checklistData ? checklistData() : checklistFixture()) };
    }
    if (init && init.method === "PATCH") {
      const key = url.endsWith("/steps") ? "steps" : "notes";
      calls.push({ url, method: init.method, body: JSON.parse(init.body) });
      const resp = patchResponses[key] || { status: 200, json: { ok: true } };
      return { ok: resp.status < 300, status: resp.status, json: async () => resp.json };
    }
    return routedFetch(routes)(url);
  };
  return { fetchImpl, calls, checklistGetCalls };
}

async function mountOnChecklistTab(fetchImpl) {
  installFakeDocument();
  const container = new FakeElement("div");
  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
  await handle.ready;
  handle.selectTab("manual_test_checklist");
  await flush();
  await flush(); // let the checklist's own async fetchDoc().then(renderChecklistBody) settle
  return { mod, container, handle };
}

// CR-005 fix (Task 33) — a manual-TC inbox click's `ptcId`, forwarded as
// `options.initialPtcId`, scrolls the matching TC's `.tc-wrap[data-tc-id]`
// into view once the checklist tab has actually rendered. Landing on the
// right TAB (asserted above) is the primary fix; this is the "nice-to-have
// on top" the implementation notes describe — asserted here via
// `FakeElement.querySelector`/`scrollIntoView` (see the class definition
// above), a minimal-but-real stand-in, not a DOM library.
test("mount(): initialPtcId scrolls the matching TC panel into view once the checklist tab has rendered (CR-005 nice-to-have)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const { fetchImpl } = checklistFetchMock();

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: "20260101-feat-a",
    initialRoles: ["tester"],
    initialTab: "manual_test_checklist.md",
    initialPtcId: "TC-001",
    fetchImpl,
  });
  await handle.ready;
  await flush();
  await flush(); // let the checklist's own async fetchDoc().then(renderChecklistBody) settle

  assert.strictEqual(handle.getState().activeTabId, "manual_test_checklist");
  const tcWrap = container.findAll((n) => n.dataset && n.dataset.tcId === "TC-001")[0];
  assert.ok(tcWrap, "expected the TC-001 tc-wrap to have rendered");
  assert.strictEqual(tcWrap._scrollIntoViewCalls, 1, "expected exactly one scrollIntoView call on the matching TC panel");
});

test("mount(): initialPtcId is a one-shot — revisiting the checklist tab later does not scroll again", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const { fetchImpl } = checklistFetchMock();

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: "20260101-feat-a",
    initialRoles: ["tester"],
    initialTab: "manual_test_checklist.md",
    initialPtcId: "TC-001",
    fetchImpl,
  });
  await handle.ready;
  await flush();
  await flush();

  // Navigate away and back to the checklist tab.
  handle.selectTab("test_plan");
  handle.selectTab("manual_test_checklist");
  await flush();
  await flush();

  // Every render() rebuilds the DOM from scratch (`container.innerHTML =
  // ""`), so the revisited tab's tc-wrap is a BRAND NEW node — it never had
  // `scrollIntoView` called on it at all, which is exactly the proof that
  // the one-shot flag suppressed a second scroll attempt (a re-triggered
  // scroll would have called it on this very node).
  const tcWrap = container.findAll((n) => n.dataset && n.dataset.tcId === "TC-001")[0];
  assert.ok(tcWrap, "expected TC-001 to still be rendered after the tab revisit");
  assert.ok(!tcWrap._scrollIntoViewCalls, "a tab revisit must not re-trigger the initial-landing scroll");
});

test("checklist: renders one checkbox/note/Save control per step, pre-filled from the fetched checklist", async () => {
  const { fetchImpl } = checklistFetchMock();
  const { container } = await mountOnChecklistTab(fetchImpl);

  const checkboxes = container.findAll((n) => n.className === "step-checkbox");
  const noteInputs = container.findAll((n) => n.className === "step-note-input");
  assert.strictEqual(checkboxes.length, 2, "expected one checkbox per step");
  assert.strictEqual(checkboxes[0].checked, false);
  assert.strictEqual(checkboxes[1].checked, true);
  assert.strictEqual(noteInputs[1].value, "already ok");
});

test("checklist: Save on a step calls PATCH .../checklist/steps with {tcId, step (number), checked, note} (TC-023 step 6)", async () => {
  const { fetchImpl, calls } = checklistFetchMock();
  const { container } = await mountOnChecklistTab(fetchImpl);

  const checkboxes = container.findAll((n) => n.className === "step-checkbox");
  const noteInputs = container.findAll((n) => n.className === "step-note-input");
  const saveButtons = container.findAll((n) => n.className === "step-save-btn");

  checkboxes[0].checked = true;
  noteInputs[0].value = "Verified manually";
  saveButtons[0].dispatchClick();
  await flush();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, "/api/projects/proj-a/issues/20260101-feat-a/checklist/steps");
  assert.strictEqual(calls[0].method, "PATCH");
  assert.deepStrictEqual(calls[0].body, { tcId: "TC-001", step: 1, checked: true, note: "Verified manually" });
  assert.strictEqual(typeof calls[0].body.step, "number", "step must be sent as a number — server.js rejects a string");
});

test("checklist: a rejected empty-Result PATCH (422 empty_result) surfaces a visible, human error — not the raw code, not swallowed (TC-023 step 5)", async () => {
  const { fetchImpl } = checklistFetchMock({ patchResponses: { steps: { status: 422, json: { error: "empty_result" } } } });
  const { container } = await mountOnChecklistTab(fetchImpl);

  const checkboxes = container.findAll((n) => n.className === "step-checkbox");
  const saveButtons = container.findAll((n) => n.className === "step-save-btn");
  checkboxes[0].checked = true; // note left empty on purpose
  saveButtons[0].dispatchClick();
  await flush();

  const statuses = container.findAll((n) => n.className && n.className.split(" ")[0] === "step-save-status");
  assert.strictEqual(statuses.length, 2);
  const [status] = statuses;
  assert.ok(status.textContent && status.textContent.length > 0, "the rejection must render visible text, not be swallowed");
  assert.notStrictEqual(status.textContent, "empty_result", "must not leak the raw machine error code verbatim");
  assert.match(status.textContent, /result|note/i, "expected a human explanation, not just a code");
  assert.ok(status.className.includes("error"), "the status element must carry a visible error indicator");
});

test("checklist: a successful save shows a confirmation and keeps the tester's entered values on screen (no full reload)", async () => {
  const { fetchImpl } = checklistFetchMock();
  const { container } = await mountOnChecklistTab(fetchImpl);

  const checkboxes = container.findAll((n) => n.className === "step-checkbox");
  const noteInputs = container.findAll((n) => n.className === "step-note-input");
  const saveButtons = container.findAll((n) => n.className === "step-save-btn");

  checkboxes[0].checked = true;
  noteInputs[0].value = "Verified manually";
  saveButtons[0].dispatchClick();
  await flush();

  const statuses = container.findAll((n) => n.className && n.className.split(" ")[0] === "step-save-status");
  assert.strictEqual(statuses[0].textContent, "Saved");
  assert.strictEqual(checkboxes[0].checked, true, "the checkbox must still reflect what was just saved");
  assert.strictEqual(noteInputs[0].value, "Verified manually", "the note must still reflect what was just saved");
});

test("checklist: a successful step save invalidates the cached checklist fetch, so revisiting the tab re-fetches instead of replaying stale data", async () => {
  const { fetchImpl, checklistGetCalls } = checklistFetchMock();
  const { mod, container, handle } = await mountOnChecklistTab(fetchImpl);

  assert.strictEqual(checklistGetCalls.length, 1, "expected exactly one GET of the checklist on first visit");

  const checkboxes = container.findAll((n) => n.className === "step-checkbox");
  const noteInputs = container.findAll((n) => n.className === "step-note-input");
  const saveButtons = container.findAll((n) => n.className === "step-save-btn");
  checkboxes[0].checked = true;
  noteInputs[0].value = "Verified manually";
  saveButtons[0].dispatchClick();
  await flush();

  // Navigate away and back to the checklist tab — before this task's
  // targeted `invalidateDoc`, the memoized `docCache` entry would still be
  // there and no second GET would ever happen, even though the document was
  // just written to.
  handle.selectTab("test_plan");
  await flush();
  handle.selectTab("manual_test_checklist");
  await flush();
  await flush();

  assert.strictEqual(checklistGetCalls.length, 2, "expected a fresh GET of the checklist after a successful write");
});

test("checklist: the TC notes editor sends PATCH .../checklist/notes with {tcId, notesText}", async () => {
  const { fetchImpl, calls } = checklistFetchMock();
  const { container } = await mountOnChecklistTab(fetchImpl);

  const notesInputs = container.findAll((n) => n.className === "tc-notes-input");
  const notesSaveButtons = container.findAll((n) => n.className === "tc-notes-save-btn");
  assert.strictEqual(notesInputs.length, 1, "TC-001 has a notesLineIndex, so it must get a notes editor");

  notesInputs[0].value = "Ran the full flow twice.";
  notesSaveButtons[0].dispatchClick();
  await flush();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, "/api/projects/proj-a/issues/20260101-feat-a/checklist/notes");
  assert.deepStrictEqual(calls[0].body, { tcId: "TC-001", notesText: "Ran the full flow twice." });
});

test("checklist: a TC with no **Notes:** line to patch (notesLineIndex null) gets no notes editor — avoids a guaranteed-400 control", async () => {
  const noNotesLine = checklistFixture();
  noNotesLine.tcs[0].notesLineIndex = null;
  const { fetchImpl } = checklistFetchMock({ checklistData: () => noNotesLine });
  const { container } = await mountOnChecklistTab(fetchImpl);

  const notesInputs = container.findAll((n) => n.className === "tc-notes-input");
  assert.strictEqual(notesInputs.length, 0);
});

// ---------------------------------------------------------------------------
// "Дела" (human-tasks) tab UI (Task 30, CR-002 fix — code_review.md: the tab
// used to be a pure placeholder, "Содержимое этой вкладки появится отдельной
// задачей", even though GET .../human-tasks (Task 10) and
// POST .../human-tasks/:key/complete|reassign (Tasks 11/12) were already
// fully implemented server-side). TC-024/TC-025/TC-026 map to server-side
// tests of those three routes (test/workspace.test.js/test/readonly.test.js
// — untouched by this task, per implementation notes); these tests cover
// this tab's own wiring to them: request shapes, the review-vs-write
// complete UI split, the reassign dropdown, and visible error surfacing.
// TC-032 (write-allowlist / no second actor picker) is
// test/readonly.test.js's own grep check, unaffected by adding this UI as
// long as it stays scoped to the one hand-off action — see that test.
// ---------------------------------------------------------------------------

// `docs/planning/agents.yml`'s shipped default shape (`server.js`'s own
// `DEFAULT_AGENTS_YAML` comment) plus a `human` actor, mirroring
// test/workspace.test.js's own `HUMAN_AGENTS_YML` fixture convention.
const AGENTS_YAML_TEXT = [
  "actors:",
  "  claude: { kind: llm, invoke: agent,  model: claude-sonnet-5 }",
  "  human:  { kind: human }",
  "",
].join("\n");

const AGENTS_YAML_ROUTE = "/api/projects/proj-a/docs?path=docs%2Fplanning%2Fagents.yml";

function humanTask(overrides = {}) {
  return {
    stageKey: "user_docs",
    operation: "write",
    mode: "non-blocking",
    artifactPath: "docs/issues/open/20260101-feat-a/user_docs.md",
    instruction: "Write user_docs.md for this issue.",
    status: "queued",
    ...overrides,
  };
}

// `patchResponses`-style mock, mirroring `checklistFetchMock()` above:
// `completeResponse`/`reassignResponse` are `{status, json}`, defaulting to
// a 200 success shape matching server.js's real ones. `tasksData` re-fetched
// on every GET (a function, not a fixed value), so a test can hand back a
// different list after a reload without hand-rolling its own fetch impl.
function humanTasksFetchMock({ tasks, completeResponse, reassignResponse, agentsYamlText, manualTests } = {}) {
  const tasksList = tasks || [humanTask()];
  const tasksEndpoint = "/api/projects/proj-a/issues/20260101-feat-a/human-tasks";
  const calls = []; // { url, method, body }
  const tasksGetCalls = [];
  const routes = baseRoutes({
    [AGENTS_YAML_ROUTE]: { content: agentsYamlText === undefined ? AGENTS_YAML_TEXT : agentsYamlText },
    ...(manualTests ? { "/api/inbox": { manualTests, humanTasks: [], totalCount: manualTests.length } } : {}),
  });

  const fetchImpl = async (url, init) => {
    if (url === tasksEndpoint && (!init || !init.method)) {
      tasksGetCalls.push(url);
      return { ok: true, status: 200, json: async () => tasksList };
    }
    if (init && init.method === "POST" && url.startsWith(tasksEndpoint)) {
      const body = JSON.parse(init.body);
      calls.push({ url, method: init.method, body });
      const isComplete = url.endsWith("/complete");
      const resp = isComplete
        ? completeResponse || { status: 200, json: { status: "done", contentHash: "abc123" } }
        : reassignResponse || { status: 200, json: { status: "reassigned", actor: body.actor } };
      return { ok: resp.status < 300, status: resp.status, json: async () => resp.json };
    }
    return routedFetch(routes)(url);
  };
  return { fetchImpl, calls, tasksGetCalls, tasksEndpoint };
}

async function mountOnHumanTasksTab(fetchImpl) {
  installFakeDocument();
  const container = new FakeElement("div");
  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["tester"], fetchImpl });
  await handle.ready;
  handle.selectTab(mod.HUMAN_TASKS_TAB_ID);
  await flush();
  await flush(); // let loadAndRenderHumanTasks's Promise.allSettled settle
  return { mod, container, handle };
}

test("Дела tab: renders the task list from GET .../human-tasks — stageKey/operation/instruction/status, no longer the placeholder", async () => {
  const { fetchImpl, tasksGetCalls } = humanTasksFetchMock({
    tasks: [humanTask({ stageKey: "specs", operation: "review", instruction: "Review specs.md.", status: "stale" })],
  });
  const { container } = await mountOnHumanTasksTab(fetchImpl);

  assert.strictEqual(tasksGetCalls.length, 1, "expected one GET of the human-tasks list");
  assert.ok(
    !container.findAll((n) => n.textContent === "Содержимое этой вкладки появится отдельной задачей.").length,
    "the old stub text must be gone"
  );

  const rows = container.findAll((n) => n.className === "human-task-row");
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].dataset.stageKey, "specs");
  assert.ok(container.findAll((n) => n.className === "human-task-key" && n.textContent === "specs").length);
  assert.ok(container.findAll((n) => n.className === "human-task-operation" && n.textContent === "(review)").length);
  assert.ok(container.findAll((n) => n.className === "human-task-instruction" && n.textContent === "Review specs.md.").length);
  // stale renders with the same .badge class doc tabs already use.
  assert.ok(container.findAll((n) => n.className === "badge" && n.textContent === "stale").length);
});

test("Дела tab: an empty queue renders a message, not a blank pane", async () => {
  const { fetchImpl } = humanTasksFetchMock({ tasks: [] });
  const { container } = await mountOnHumanTasksTab(fetchImpl);

  const empty = container.findAll((n) => n.className && n.className.split(" ").includes("human-tasks-empty"));
  assert.strictEqual(empty.length, 1);
  assert.ok(empty[0].textContent.length > 0);
  assert.strictEqual(container.findAll((n) => n.className === "human-task-row").length, 0);
});

// ---------------------------------------------------------------------------
// Дела tab's manual-tests half (dogfooding fix, CR-5a) — the counter
// already summed manualTests+humanTasks project-wide (specs.md §3.4), but
// the tab body used to render only humanTasks; a project with pending
// manual tests and zero human tasks showed a nonzero count next to
// "Нет задач для этой issue."
// ---------------------------------------------------------------------------

test("Дела tab: renders this issue's own manual tests from the already-fetched /api/inbox response, filtered by issueId", async () => {
  const { fetchImpl } = humanTasksFetchMock({
    tasks: [],
    manualTests: [
      { project: "proj-a", issueId: "20260101-feat-a", ptcId: "PTC-0001", area: "Checklist", testCase: "Проверить шаг 1" },
      { project: "proj-a", issueId: "20260102-feat-b", ptcId: "PTC-0002", area: "Checklist", testCase: "Другая issue — не должна попасть" },
      { project: "proj-b", issueId: "20260101-feat-a", ptcId: "PTC-0003", area: "Checklist", testCase: "Другой проект — не должна попасть" },
    ],
  });
  const { container } = await mountOnHumanTasksTab(fetchImpl);

  const labels = container.findAll((n) => n.className === "inbox-item-label");
  assert.strictEqual(labels.length, 1, "only this project's this-issue manual test");
  assert.ok(labels[0].textContent.includes("Проверить шаг 1"));

  // The human-tasks empty state still renders independently — the two
  // sections are not conflated into one condition.
  assert.ok(container.findAll((n) => n.className && n.className.split(" ").includes("human-tasks-empty")).length);
});

test("Дела tab: no manual tests for this issue renders the section's own empty state, not a blank pane", async () => {
  const { fetchImpl } = humanTasksFetchMock({ tasks: [humanTask()], manualTests: [] });
  const { container } = await mountOnHumanTasksTab(fetchImpl);

  const manualTestsBody = container.findAll((n) => n.className === "manual-tests-body")[0];
  assert.ok(manualTestsBody);
  assert.ok(manualTestsBody.findAll((n) => n.className === "inbox-empty" && n.textContent.length > 0).length);
});

test("Дела tab: clicking a manual test switches to the tester role's manual_test_checklist tab", async () => {
  const { fetchImpl } = humanTasksFetchMock({
    tasks: [],
    manualTests: [{ project: "proj-a", issueId: "20260101-feat-a", ptcId: "PTC-0001", area: "Checklist", testCase: "Проверить шаг 1" }],
  });
  installFakeDocument();
  const container = new FakeElement("div");
  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: "20260101-feat-a", initialRoles: ["developer"], fetchImpl });
  await handle.ready;
  handle.selectTab(mod.HUMAN_TASKS_TAB_ID);
  await flush();
  await flush();

  const link = container.findAll((n) => n.className === "inbox-item inbox-item--manualTest")[0];
  assert.ok(link, "expected the manual test row to render even though the mount started on the developer role");
  link.dispatchClick();
  await flush();
  await flush();

  assert.deepStrictEqual(handle.getState().roleIds, ["tester"]);
  assert.strictEqual(handle.getState().activeTabId, mod.CHECKLIST_DOC_ID);
});

test("Дела tab: operation \"review\" shows a verdict input; complete sends {verdict} to POST .../complete (TC-024 step 1-2 shape)", async () => {
  const { fetchImpl, calls } = humanTasksFetchMock({
    tasks: [humanTask({ stageKey: "specs", operation: "review" })],
  });
  const { container } = await mountOnHumanTasksTab(fetchImpl);

  const verdictInputs = container.findAll((n) => n.className === "human-task-verdict-input");
  assert.strictEqual(verdictInputs.length, 1, "a review task must get a verdict input");
  verdictInputs[0].value = "замечаний нет";

  const completeButtons = container.findAll((n) => n.className === "human-task-complete-btn");
  completeButtons[0].dispatchClick();
  await flush();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, "/api/projects/proj-a/issues/20260101-feat-a/human-tasks/specs/complete");
  assert.strictEqual(calls[0].method, "POST");
  assert.deepStrictEqual(calls[0].body, { verdict: "замечаний нет" });
});

test("Дела tab: operation \"write\" (document/code/tests key) shows no verdict input; complete sends no verdict field", async () => {
  const { fetchImpl, calls } = humanTasksFetchMock({
    tasks: [humanTask({ stageKey: "code", operation: "write" })],
  });
  const { container } = await mountOnHumanTasksTab(fetchImpl);

  assert.strictEqual(container.findAll((n) => n.className === "human-task-verdict-input").length, 0);

  const completeButtons = container.findAll((n) => n.className === "human-task-complete-btn");
  completeButtons[0].dispatchClick();
  await flush();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, "/api/projects/proj-a/issues/20260101-feat-a/human-tasks/code/complete");
  assert.ok(!("verdict" in calls[0].body), "a write task's complete body must carry no verdict field");
});

test("Дела tab: reassign dropdown is built from agents.yml's actors: list, and calls POST .../reassign with {actor} (AC-05g/TC-026 step 2 shape)", async () => {
  const { fetchImpl, calls } = humanTasksFetchMock({
    tasks: [humanTask({ stageKey: "specs" })],
  });
  const { container } = await mountOnHumanTasksTab(fetchImpl);

  const select = container.findAll((n) => n.className === "human-task-actor-select")[0];
  assert.ok(select, "expected the hand-off actor <select>");
  const optionValues = select.children.map((o) => o.value);
  assert.deepStrictEqual(optionValues, ["claude", "human"], "options come from agents.yml's actors:, in file order");

  select.value = "claude";
  const reassignButtons = container.findAll((n) => n.className === "human-task-reassign-btn");
  reassignButtons[0].dispatchClick();
  await flush();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, "/api/projects/proj-a/issues/20260101-feat-a/human-tasks/specs/reassign");
  assert.strictEqual(calls[0].method, "POST");
  assert.deepStrictEqual(calls[0].body, { actor: "claude" });
});

test("Дела tab: the reassign control is the ONLY actor-picker <select> anywhere on this tab", async () => {
  const { fetchImpl } = humanTasksFetchMock({ tasks: [humanTask(), humanTask({ stageKey: "code" })] });
  const { container } = await mountOnHumanTasksTab(fetchImpl);

  const actorSelects = container.findAll((n) => n.className === "human-task-actor-select");
  assert.strictEqual(actorSelects.length, 2, "one per task row — still the single control TYPE, AC-05j");
});

test("Дела tab: when agents.yml has no actors, the reassign dropdown/button are disabled rather than offering an empty/broken pick", async () => {
  const { fetchImpl } = humanTasksFetchMock({ tasks: [humanTask()], agentsYamlText: "" });
  const { container } = await mountOnHumanTasksTab(fetchImpl);

  const select = container.findAll((n) => n.className === "human-task-actor-select")[0];
  const button = container.findAll((n) => n.className === "human-task-reassign-btn")[0];
  assert.strictEqual(select.disabled, true);
  assert.strictEqual(button.disabled, true);
});

test("Дела tab: a rejected complete (422 invalid_verdict) surfaces the server's message visibly — not silently swallowed", async () => {
  const { fetchImpl } = humanTasksFetchMock({
    tasks: [humanTask({ stageKey: "specs", operation: "review" })],
    completeResponse: {
      status: 422,
      json: { error: "invalid_verdict", message: "A non-empty verdict is required to complete a review task." },
    },
  });
  const { container } = await mountOnHumanTasksTab(fetchImpl);

  const completeButtons = container.findAll((n) => n.className === "human-task-complete-btn");
  completeButtons[0].dispatchClick(); // verdict left empty on purpose
  await flush();

  const statuses = container.findAll((n) => n.className && n.className.split(" ")[0] === "human-task-complete-status");
  assert.strictEqual(statuses.length, 1);
  assert.ok(statuses[0].textContent.length > 0, "the rejection must render visible text, not be swallowed");
  assert.match(statuses[0].textContent, /verdict/i);
  assert.ok(statuses[0].className.includes("error"), "the status element must carry a visible error indicator");
});

test("Дела tab: a rejected reassign (409 unsupported_roles_format) surfaces the server's message visibly (TC-026 step 6)", async () => {
  const { fetchImpl } = humanTasksFetchMock({
    tasks: [humanTask({ stageKey: "specs" })],
    reassignResponse: {
      status: 409,
      json: {
        error: "unsupported_roles_format",
        message: "roles.specs in prompt.md is not written in the single-line flow-style this tool can edit — reassign it manually by editing prompt.md.",
      },
    },
  });
  const { container } = await mountOnHumanTasksTab(fetchImpl);

  const reassignButtons = container.findAll((n) => n.className === "human-task-reassign-btn");
  reassignButtons[0].dispatchClick();
  await flush();

  const statuses = container.findAll((n) => n.className && n.className.split(" ")[0] === "human-task-reassign-status");
  assert.strictEqual(statuses.length, 1);
  assert.ok(statuses[0].textContent.length > 0);
  assert.match(statuses[0].textContent, /manually/i);
  assert.ok(statuses[0].className.includes("error"));
});

test("Дела tab: a successful complete triggers a fresh GET .../human-tasks (reload, not a full page reload)", async () => {
  const { fetchImpl, tasksGetCalls } = humanTasksFetchMock({ tasks: [humanTask({ stageKey: "specs", operation: "review" })] });
  const { container } = await mountOnHumanTasksTab(fetchImpl);

  assert.strictEqual(tasksGetCalls.length, 1);

  const verdictInputs = container.findAll((n) => n.className === "human-task-verdict-input");
  verdictInputs[0].value = "замечаний нет";
  const completeButtons = container.findAll((n) => n.className === "human-task-complete-btn");
  completeButtons[0].dispatchClick();
  await flush();
  await flush(); // let the reload's own GET + re-render settle

  assert.strictEqual(tasksGetCalls.length, 2, "a successful complete must re-fetch the task list, not just mutate in place silently");
});

test("Дела tab: a successful reassign also triggers a fresh GET .../human-tasks", async () => {
  const { fetchImpl, tasksGetCalls } = humanTasksFetchMock({ tasks: [humanTask({ stageKey: "specs" })] });
  const { container } = await mountOnHumanTasksTab(fetchImpl);

  assert.strictEqual(tasksGetCalls.length, 1);

  const reassignButtons = container.findAll((n) => n.className === "human-task-reassign-btn");
  reassignButtons[0].dispatchClick();
  await flush();
  await flush();

  assert.strictEqual(tasksGetCalls.length, 2);
});

// ---------------------------------------------------------------------------
// parseActorNames — pure (TC-026-adjacent: the source docs/planning/agents.yml
// this reads from is the same file POST .../reassign validates `actor`
// against server-side).
// ---------------------------------------------------------------------------

test("parseActorNames extracts flow-style actors: entries in file order", async () => {
  const mod = await loadModule();
  assert.deepStrictEqual(mod.parseActorNames(AGENTS_YAML_TEXT), ["claude", "human"]);
});

test("parseActorNames handles null/empty/no actors: block without throwing", async () => {
  const mod = await loadModule();
  assert.deepStrictEqual(mod.parseActorNames(null), []);
  assert.deepStrictEqual(mod.parseActorNames(""), []);
  assert.deepStrictEqual(mod.parseActorNames("some: other\nyaml: here\n"), []);
});

test("parseActorNames stops at the actors: block's dedent, not picking up an unrelated later block", async () => {
  const mod = await loadModule();
  const text = ["actors:", "  claude: { kind: llm }", "other_block:", "  claude2: { kind: llm }", ""].join("\n");
  assert.deepStrictEqual(mod.parseActorNames(text), ["claude"]);
});

// ---------------------------------------------------------------------------
// Checkout banner + "prepare test data" action (Task 34, CR-006 fix —
// code_review.md). Round-1 /pf-codereview found the pre-redesign app.js's
// checkout banner (`item.checkout`) and "Prepare test data" action
// (`item.kind === "action"`, lib/roles.js's "prepare" tester-role entry) had
// no replacement in the redesigned `renderDocPanel` — the server routes
// (`POST .../checklist/checkout`, `POST .../issues/:id/prepare`) were never
// touched, only the client stopped offering them.
// ---------------------------------------------------------------------------

const ISSUE_A = "20260101-feat-a";

// `checklistCheckout` mirrors `docstate.classifyIssueDoc`'s `checkout` shape
// for a document that lives only on the issue branch; `action` overrides the
// tester role's "prepare" entry (`lib/roles.js`), whose shape mirrors
// server.js's `prepareActionState()` verdict.
function testerContentsWithExtras(issueId, { checklistCheckout = null, action = {} } = {}) {
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
        location: checklistCheckout ? "branch" : "disk",
        checkout: checklistCheckout,
      },
      {
        id: "prepare",
        kind: "action",
        name: "prepare",
        label: "Prepare test data",
        offered: false,
        enabled: false,
        status: "missing",
        endpoint: `/api/projects/proj-a/issues/${issueId}/prepare`,
        method: "POST",
        checkout: null,
        ...action,
      },
    ],
  };
}

function extrasRoutes(issueId, contents, overrides = {}) {
  return {
    "/api/roles": ROLES_RESPONSE,
    "/api/projects/proj-a/issues": ISSUES_RESPONSE,
    [`/api/projects/proj-a/issues/${issueId}/roles/tester`]: contents,
    [`/api/projects/proj-a/issues/${issueId}/checklist`]: { meta: {}, tcs: [], looseSections: [] },
    ...overrides,
  };
}

function countingFetch(routes, { onPost } = {}) {
  const getCounts = {};
  const postCalls = [];
  const fetchImpl = async (url, init) => {
    if (init && init.method === "POST") {
      const body = init.body ? JSON.parse(init.body) : null;
      postCalls.push({ url, body });
      if (onPost) return onPost(url, body);
    } else {
      getCounts[url] = (getCounts[url] || 0) + 1;
    }
    return routedFetch(routes)(url);
  };
  return { fetchImpl, getCounts, postCalls };
}

test("checkout banner renders for an item with item.checkout, regardless of item.kind (CR-006)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const checkout = {
    branch: `issue/${ISSUE_A}`,
    endpoint: `/api/projects/proj-a/issues/${ISSUE_A}/checklist/checkout`,
    method: "POST",
    message: "This checklist lives on the issue branch, which isn't checked out. Showing a read-only preview.",
  };
  const contents = testerContentsWithExtras(ISSUE_A, { checklistCheckout: checkout });
  const { fetchImpl, postCalls } = countingFetch(extrasRoutes(ISSUE_A, contents));

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: ISSUE_A,
    initialRoles: ["tester"],
    fetchImpl,
    confirmImpl: () => false,
  });
  await handle.ready;
  handle.selectTab("manual_test_checklist");
  await flush();

  const banners = container.findAll((n) => n.className === "checkout-banner");
  assert.strictEqual(banners.length, 1, "expected exactly one checkout banner");
  assert.ok(
    banners[0].findAll((n) => typeof n.textContent === "string" && n.textContent.includes("isn't checked out")).length,
    "expected the checkout message to render"
  );

  const btn = container.findAll((n) => n.className === "btn" && n.textContent.startsWith("Checkout"))[0];
  assert.ok(btn, "expected a Checkout <branch> button");

  // Declining the confirmation must send no request at all (the protection
  // against an accidental branch switch this task is explicitly required to
  // keep).
  btn.dispatchClick();
  await flush();
  assert.strictEqual(postCalls.length, 0, "declining confirm() must not POST the checkout route");
});

test("checkout banner: confirming calls POST checkout.endpoint, then reloads issues + role contents (CR-006)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const checkout = {
    branch: `issue/${ISSUE_A}`,
    endpoint: `/api/projects/proj-a/issues/${ISSUE_A}/checklist/checkout`,
    method: "POST",
    message: "This checklist lives on the issue branch, which isn't checked out.",
  };
  const contents = testerContentsWithExtras(ISSUE_A, { checklistCheckout: checkout });
  const { fetchImpl, getCounts, postCalls } = countingFetch(extrasRoutes(ISSUE_A, contents), {
    onPost: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, branch: checkout.branch }) }),
  });

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: ISSUE_A,
    initialRoles: ["tester"],
    fetchImpl,
    confirmImpl: () => true,
  });
  await handle.ready;
  handle.selectTab("manual_test_checklist");
  await flush();

  const rolesUrl = `/api/projects/proj-a/issues/${ISSUE_A}/roles/tester`;
  const issuesUrl = "/api/projects/proj-a/issues";
  assert.strictEqual(getCounts[rolesUrl], 1, "sanity: one role-contents fetch before the checkout");
  assert.strictEqual(getCounts[issuesUrl], 1, "sanity: one issue-list fetch before the checkout");

  const btn = container.findAll((n) => n.className === "btn" && n.textContent.startsWith("Checkout"))[0];
  btn.dispatchClick();
  await flush();
  await flush();

  assert.strictEqual(postCalls.length, 1);
  assert.strictEqual(postCalls[0].url, checkout.endpoint);
  assert.strictEqual(postCalls[0].body === null || Object.keys(postCalls[0].body).length === 0, true, "checkout POST carries no meaningful body");

  // afterCheckout() re-fetches both the issue list and this role's contents
  // (docCache.clear() + loadRoleContents(true)) — the same full reload the
  // pre-redesign app.js did via loadIssues()+refreshRoleContents().
  assert.strictEqual(getCounts[rolesUrl], 2, "expected role contents to be re-fetched after a successful checkout");
  assert.strictEqual(getCounts[issuesUrl], 2, "expected the issue list to be re-fetched after a successful checkout");
});

test("checkout banner: a failed checkout surfaces the server's error message and re-enables the button", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const checkout = {
    branch: `issue/${ISSUE_A}`,
    endpoint: `/api/projects/proj-a/issues/${ISSUE_A}/checklist/checkout`,
    method: "POST",
    message: "This checklist lives on the issue branch, which isn't checked out.",
  };
  const contents = testerContentsWithExtras(ISSUE_A, { checklistCheckout: checkout });
  const { fetchImpl } = countingFetch(extrasRoutes(ISSUE_A, contents), {
    onPost: async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: "dirty_working_tree", message: "Working tree has uncommitted changes — commit or stash them yourself first, then retry." }),
    }),
  });

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: ISSUE_A,
    initialRoles: ["tester"],
    fetchImpl,
    confirmImpl: () => true,
  });
  await handle.ready;
  handle.selectTab("manual_test_checklist");
  await flush();

  const btn = container.findAll((n) => n.className === "btn" && n.textContent.startsWith("Checkout"))[0];
  btn.dispatchClick();
  await flush();
  await flush();

  assert.strictEqual(btn.disabled, false, "the button must be re-enabled after a failed checkout");
  const errors = container.findAll((n) => n.className === "notice error" && n.textContent.includes("uncommitted changes"));
  assert.strictEqual(errors.length, 1, "expected the server's own error message to render visibly, not be swallowed");
});

test("prepare action: item.kind \"action\" not offered renders no action-row/prepare-result at all", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const contents = testerContentsWithExtras(ISSUE_A, {
    action: { offered: false, enabled: false, message: "This issue is closed; the prepare action is not offered for it." },
  });
  const { fetchImpl } = countingFetch(extrasRoutes(ISSUE_A, contents));

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: ISSUE_A, initialRoles: ["tester"], fetchImpl });
  await handle.ready;
  handle.selectTab("prepare");
  await flush();

  assert.strictEqual(container.findAll((n) => n.className === "action-row").length, 0);
  assert.strictEqual(container.findAll((n) => n.className === "prepare-result").length, 0);
  // The item's own message still renders (generic notice, every item kind).
  assert.ok(container.findAll((n) => n.className === "notice" && n.textContent.includes("closed")).length);
});

test("prepare action: offered but not enabled renders a disabled button and the reason", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const contents = testerContentsWithExtras(ISSUE_A, {
    action: {
      offered: true,
      enabled: false,
      reason: "the checklist lives on issue/20260101-feat-a, which is not checked out",
      message: "Check out issue/20260101-feat-a first — test data is prepared into the checked-out issue.",
    },
  });
  const { fetchImpl } = countingFetch(extrasRoutes(ISSUE_A, contents));

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: ISSUE_A, initialRoles: ["tester"], fetchImpl });
  await handle.ready;
  handle.selectTab("prepare");
  await flush();

  const buttons = container.findAll((n) => n.className === "btn" && n.textContent.includes("Prepare test data"));
  assert.strictEqual(buttons.length, 1);
  assert.strictEqual(buttons[0].disabled, true);
  assert.ok(
    container.findAll((n) => n.className === "muted" && n.textContent.includes("not checked out")).length,
    "expected the disabled reason to render"
  );
});

test("prepare action: offered and enabled — click (after confirmation) POSTs {confirm:true} to item.endpoint and renders the result", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const prepareEndpoint = `/api/projects/proj-a/issues/${ISSUE_A}/prepare`;
  const contents = testerContentsWithExtras(ISSUE_A, {
    action: { offered: true, enabled: true, endpoint: prepareEndpoint, message: "The declared test data of this issue can be prepared." },
  });
  const { fetchImpl, postCalls } = countingFetch(extrasRoutes(ISSUE_A, contents), {
    onPost: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        ran: true,
        tcId: null,
        exitCode: 0,
        signal: null,
        timedOut: false,
        durationMs: 120,
        scriptPath: "/fixture/test-data/setup.mjs",
        stdout: "prepared TC-001\n",
        stderr: "",
        prepared: [{ tcId: "TC-001", workdir: "/tmp/pf-test-data/TC-001" }],
        message: "Prepared 1 case.",
      }),
    }),
  });

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: ISSUE_A,
    initialRoles: ["tester"],
    fetchImpl,
    confirmImpl: () => true,
  });
  await handle.ready;
  handle.selectTab("prepare");
  await flush();

  const btn = container.findAll((n) => n.className === "btn" && n.textContent.includes("Prepare test data"))[0];
  assert.ok(btn && !btn.disabled);
  btn.dispatchClick();
  await flush();
  await flush();

  assert.strictEqual(postCalls.length, 1);
  assert.strictEqual(postCalls[0].url, prepareEndpoint);
  assert.deepStrictEqual(postCalls[0].body, { confirm: true });

  const results = container.findAll((n) => n.className === "prepare-result");
  assert.strictEqual(results.length, 1);
  assert.ok(results[0].findAll((n) => n.textContent === "Prepared").length, "expected a Prepared heading");
  assert.ok(results[0].findAll((n) => n.className === "badge ok").length, "expected an ok badge");
  assert.ok(
    results[0].findAll((n) => n.tagName === "PRE").length,
    "expected stdout to render as a pre.output block"
  );
});

test("prepare action: a refused run (non-2xx, ok:false body) renders \"Not prepared\" with the server's reason — not silently swallowed", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const prepareEndpoint = `/api/projects/proj-a/issues/${ISSUE_A}/prepare`;
  const contents = testerContentsWithExtras(ISSUE_A, {
    action: { offered: true, enabled: true, endpoint: prepareEndpoint, message: "The declared test data of this issue can be prepared." },
  });
  const { fetchImpl } = countingFetch(extrasRoutes(ISSUE_A, contents), {
    onPost: async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        ok: false,
        ran: true,
        reason: "script_failed",
        error: "script_failed",
        exitCode: 1,
        signal: null,
        timedOut: false,
        durationMs: 40,
        stdout: "",
        stderr: "boom\n",
        prepared: [],
        message: "The setup script exited with code 1.",
      }),
    }),
  });

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: ISSUE_A,
    initialRoles: ["tester"],
    fetchImpl,
    confirmImpl: () => true,
  });
  await handle.ready;
  handle.selectTab("prepare");
  await flush();

  const btn = container.findAll((n) => n.className === "btn" && n.textContent.includes("Prepare test data"))[0];
  btn.dispatchClick();
  await flush();
  await flush();

  const results = container.findAll((n) => n.className === "prepare-result");
  assert.strictEqual(results.length, 1);
  assert.ok(results[0].findAll((n) => n.textContent === "Not prepared").length);
  assert.ok(results[0].findAll((n) => n.className === "badge fail" && n.textContent === "script_failed").length);
  assert.ok(
    results[0].findAll((n) => n.textContent === "The setup script exited with code 1.").length,
    "expected the server's own message to render, not be swallowed"
  );
});

test("prepare action: declining the confirmation sends no request", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const prepareEndpoint = `/api/projects/proj-a/issues/${ISSUE_A}/prepare`;
  const contents = testerContentsWithExtras(ISSUE_A, {
    action: { offered: true, enabled: true, endpoint: prepareEndpoint, message: "The declared test data of this issue can be prepared." },
  });
  const { fetchImpl, postCalls } = countingFetch(extrasRoutes(ISSUE_A, contents));

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: ISSUE_A,
    initialRoles: ["tester"],
    fetchImpl,
    confirmImpl: () => false,
  });
  await handle.ready;
  handle.selectTab("prepare");
  await flush();

  const btn = container.findAll((n) => n.className === "btn" && n.textContent.includes("Prepare test data"))[0];
  btn.dispatchClick();
  await flush();

  assert.strictEqual(postCalls.length, 0);
});

test("prepare action: a rejected fetch (network failure) re-enables the button and surfaces a visible error, instead of hanging on \"Preparing…\"", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const prepareEndpoint = `/api/projects/proj-a/issues/${ISSUE_A}/prepare`;
  const contents = testerContentsWithExtras(ISSUE_A, {
    action: { offered: true, enabled: true, endpoint: prepareEndpoint, message: "The declared test data of this issue can be prepared." },
  });
  const routes = extrasRoutes(ISSUE_A, contents);
  const fetchImpl = async (url, init) => {
    if (init && init.method === "POST") throw new Error("network unreachable");
    return routedFetch(routes)(url);
  };

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: ISSUE_A,
    initialRoles: ["tester"],
    fetchImpl,
    confirmImpl: () => true,
  });
  await handle.ready;
  handle.selectTab("prepare");
  await flush();

  const btn = container.findAll((n) => n.className === "btn" && n.textContent.includes("Prepare test data"))[0];
  const originalLabel = btn.textContent;
  btn.dispatchClick();
  await flush();
  await flush();

  assert.strictEqual(btn.disabled, false, "the button must be re-enabled after a rejected fetch, not stuck reading \"Preparing…\"");
  assert.strictEqual(btn.textContent, originalLabel);
  const errors = container.findAll((n) => n.className === "notice error" && n.textContent.includes("network unreachable"));
  assert.strictEqual(errors.length, 1, "expected the rejection's message to render visibly, not be silently swallowed");
});

test("defaultConfirm: declines when no real window.confirm is reachable (safe default, no accidental confirmation)", async () => {
  const mod = await loadModule();
  // No `global.window` installed in this suite at all — mirrors node --test's
  // own environment, exactly the case this default has to handle safely.
  const contents = testerContentsWithExtras(ISSUE_A, {
    action: { offered: true, enabled: true, endpoint: `/api/projects/proj-a/issues/${ISSUE_A}/prepare` },
  });
  const { fetchImpl, postCalls } = countingFetch(extrasRoutes(ISSUE_A, contents));

  installFakeDocument();
  const container = new FakeElement("div");
  const handle = mod.mount(container, { project: "proj-a", issueId: ISSUE_A, initialRoles: ["tester"], fetchImpl });
  // No confirmImpl passed — falls back to defaultConfirm(), which must not
  // throw even without a `window` at all, and must not proceed.
  await handle.ready;
  handle.selectTab("prepare");
  await flush();

  const btn = container.findAll((n) => n.className === "btn" && n.textContent.includes("Prepare test data"))[0];
  btn.dispatchClick();
  await flush();

  assert.strictEqual(postCalls.length, 0, "with no confirm mechanism reachable, the default must decline, not proceed");
});

// ---------------------------------------------------------------------------
// Per-case prepare button (CR-006 follow-up) — pre-redesign app.js (line 933)
// rendered a "Prepare test data for ${tc.id}" button per case, in addition
// to the whole-issue one above; the redesign initially restored only the
// whole-issue action. server.js already sends `tc.prepare` (same verdict
// shape as the whole-issue `prepare`, one per test case) — these tests cover
// the client actually rendering and wiring it.
// ---------------------------------------------------------------------------

function checklistWithTcPrepare(prepareOverrides = {}) {
  return {
    meta: { "Feature Name": "Fixture" },
    tcs: [
      {
        id: "TC-001",
        name: "First case",
        headingLineIndex: 0,
        prerequisites: [],
        requiredData: ["fixture.txt"],
        dataStatus: "declared",
        steps: [],
        notesLineIndex: 20,
        notesText: "",
        parseWarnings: [],
        prepare: {
          offered: true,
          enabled: true,
          endpoint: `/api/projects/proj-a/issues/${ISSUE_A}/prepare`,
          message: "The declared test data of TC-001 can be prepared.",
          ...prepareOverrides,
        },
      },
    ],
    looseSections: [],
  };
}

test("checklist tab: renders a per-case \"Prepare test data for TC-001\" button from tc.prepare, distinct from the whole-issue action", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const contents = testerContentsWithExtras(ISSUE_A);
  const { fetchImpl } = countingFetch(
    extrasRoutes(ISSUE_A, contents, {
      [`/api/projects/proj-a/issues/${ISSUE_A}/checklist`]: checklistWithTcPrepare(),
    })
  );

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: ISSUE_A, initialRoles: ["tester"], fetchImpl });
  await handle.ready;
  handle.selectTab("manual_test_checklist");
  await flush();
  await flush();

  const buttons = container.findAll((n) => n.className === "btn subtle" && n.textContent === "Prepare test data for TC-001");
  assert.strictEqual(buttons.length, 1, "expected exactly one per-case prepare button for TC-001");
  assert.strictEqual(buttons[0].disabled, false);
});

test("checklist tab: clicking the per-case prepare button POSTs {confirm:true, tcId:\"TC-001\"} to the prepare endpoint", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const contents = testerContentsWithExtras(ISSUE_A);
  const prepareEndpoint = `/api/projects/proj-a/issues/${ISSUE_A}/prepare`;
  const { fetchImpl, postCalls } = countingFetch(
    extrasRoutes(ISSUE_A, contents, {
      [`/api/projects/proj-a/issues/${ISSUE_A}/checklist`]: checklistWithTcPrepare({ endpoint: prepareEndpoint }),
    }),
    {
      onPost: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          ran: true,
          tcId: "TC-001",
          exitCode: 0,
          signal: null,
          timedOut: false,
          durationMs: 80,
          scriptPath: "/fixture/test-data/setup.mjs",
          stdout: "prepared TC-001\n",
          stderr: "",
          prepared: [{ tcId: "TC-001", workdir: "/tmp/pf-test-data/TC-001" }],
          message: "Prepared TC-001.",
        }),
      }),
    }
  );

  const mod = await loadModule();
  const handle = mod.mount(container, {
    project: "proj-a",
    issueId: ISSUE_A,
    initialRoles: ["tester"],
    fetchImpl,
    confirmImpl: () => true,
  });
  await handle.ready;
  handle.selectTab("manual_test_checklist");
  await flush();
  await flush();

  const btn = container.findAll((n) => n.className === "btn subtle" && n.textContent === "Prepare test data for TC-001")[0];
  assert.ok(btn && !btn.disabled);
  btn.dispatchClick();
  await flush();
  await flush();

  assert.strictEqual(postCalls.length, 1);
  assert.strictEqual(postCalls[0].url, prepareEndpoint);
  assert.deepStrictEqual(postCalls[0].body, { confirm: true, tcId: "TC-001" });
});

test("checklist tab: a case whose prepare is not offered renders no per-case prepare button", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const contents = testerContentsWithExtras(ISSUE_A);
  const { fetchImpl } = countingFetch(
    extrasRoutes(ISSUE_A, contents, {
      [`/api/projects/proj-a/issues/${ISSUE_A}/checklist`]: checklistWithTcPrepare({
        offered: false,
        enabled: false,
        message: "TC-001 states that it needs no prepared test data, so there is nothing to prepare for it.",
      }),
    })
  );

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", issueId: ISSUE_A, initialRoles: ["tester"], fetchImpl });
  await handle.ready;
  handle.selectTab("manual_test_checklist");
  await flush();
  await flush();

  assert.strictEqual(
    container.findAll((n) => n.className === "btn subtle" && n.textContent.includes("Prepare test data for TC-001")).length,
    0
  );
});
