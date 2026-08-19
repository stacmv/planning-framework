// public/inbox.js — the inbox screen (specs.md §3.3, implementation_plan.md
// Task 15), exercised via dynamic `import()` — the pattern test_plan.md
// TC-019 documents for `public/launcher.js`, since `inbox.js` is a native
// ES module (`export`/`import`) and cannot be `require()`d.
//
// Covers, per test_plan.md:
//   * TC-018 — exactly one `/api/inbox` fetch, both sections rendered from
//     that one response, section-switch touches only local state.
//   * TC-020 (client-render slice mapped to this task) — every rendered
//     item carries project/issue/what's-required/where-to-navigate.
//
// No DOM library is available in this repo (zero dependencies, no
// package.json/node_modules — see lib/inbox.js's own header) and no
// browser DOM exists under Node's test runner, so this file provides the
// smallest possible `document`/element stand-in itself, in the same
// "small local helper, not a dependency" spirit as lib/inbox.js's
// `splitTableCells`. Running `mount()` under plain Node — where no global
// `location` object exists at all — is itself a strong runtime proof that
// the section-switch handler never touches `location.hash`: it would throw
// a ReferenceError immediately if it tried.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { TOOL_DIR } = require("./helpers/fixtures");

const MODULE_PATH = path.join(TOOL_DIR, "public", "inbox.js");
const SOURCE = fs.readFileSync(MODULE_PATH, "utf8");

async function loadModule() {
  return import(pathToFileURL(MODULE_PATH).href);
}

// ---------------------------------------------------------------------------
// Minimal DOM stand-in — just enough of Element/Document for mount() to run.
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
  // Deliberately resolves against a fake origin, the same way a real
  // `HTMLAnchorElement.href` getter resolves a relative/hash-only value
  // (`"#/p/proj-a"`) against the document's base URL
  // (`"http://localhost/#/p/proj-a"`), never returning the bare string that
  // was assigned. This is what caught `renderProjectSummary` reading back
  // `link.href` after setting it instead of navigating on the hash string
  // it already had — a bug the previous echo-back fake couldn't catch
  // (`node --test` passed while a real browser sent every project/issue
  // link in the global inbox to the launcher, garbled). Any future code
  // that repeats that mistake fails here immediately, in the test suite,
  // not by a person clicking around a real page.
  get href() {
    if (this._href === undefined) return this._href;
    return this._href.startsWith("http") ? this._href : `http://localhost/${this._href}`;
  }
  // Depth-first search by predicate — enough to locate rendered nodes
  // without a full querySelector implementation.
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
// Fixtures — one row of each kind, matching lib/inbox.js's collectManualTests()/
// collectHumanTasks() shapes exactly (specs.md §3.2).
// ---------------------------------------------------------------------------

const MANUAL_TEST_ITEM = {
  project: "proj-a",
  issueId: "20260101-feat-fixture-full",
  ptcId: "PTC-003",
  area: "Checklist",
  testCase: "Отметить TC-003 как выполненный",
  priority: "High",
  origin: "20260101-feat-fixture-full#TC-003",
};

const HUMAN_TASK_ITEM = {
  project: "proj-b",
  issueId: "20260202-feat-fixture-human",
  stageKey: "specs",
  operation: "write",
  mode: "blocking",
  artifactPath: "docs/issues/open/20260202-feat-fixture-human/specs.md",
  instruction: "Write specs.md for this issue.",
  status: "queued",
};

const FIXTURE_RESPONSE = {
  manualTests: [MANUAL_TEST_ITEM],
  humanTasks: [HUMAN_TASK_ITEM],
  totalCount: 2,
};

// The unified header (Task 60) also fetches roles/projects/per-project
// issues for its project-selector dropdown — these two projects match
// FIXTURE_RESPONSE's own manualTests/humanTasks project fields.
const ROLES_RESPONSE = { roles: [{ id: "tester", title: "Тестировщик" }, { id: "developer", title: "Разработчик" }] };
const PROJECTS_RESPONSE = [{ name: "proj-a" }, { name: "proj-b" }];

function routedFetch(overrides = {}) {
  const routes = {
    "/api/inbox": FIXTURE_RESPONSE,
    "/api/roles": ROLES_RESPONSE,
    "/api/projects": PROJECTS_RESPONSE,
    "/api/projects/proj-a/issues": { issues: [] },
    "/api/projects/proj-b/issues": { issues: [] },
    ...overrides,
  };
  return async (url) => {
    if (!(url in routes)) throw new Error(`unexpected fetch in test: ${url}`);
    return { ok: true, status: 200, json: async () => routes[url] };
  };
}

// ---------------------------------------------------------------------------
// TC-018 step 1 — exactly one fetch("/api/inbox") when the screen opens.
// ---------------------------------------------------------------------------

test("mount() fetches /api/inbox exactly once", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  let inboxCalls = 0;
  const base = routedFetch();
  const fetchImpl = async (url) => {
    if (url === "/api/inbox") inboxCalls++;
    return base(url);
  };

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl });
  await handle.ready;

  assert.strictEqual(inboxCalls, 1);
  // Source-level cross-check (TC-018 step 1's literal wording: "grep
  // public/inbox.js for the number of fetch/equivalent calls to
  // /api/inbox") — exactly one call site references the endpoint.
  const inboxUrlOccurrences = SOURCE.match(/["']\/api\/inbox["']/g) || [];
  assert.strictEqual(inboxUrlOccurrences.length, 1, "expected exactly one /api/inbox call site in public/inbox.js");
});

test("refresh() called again does not throw and still hits the same single call site", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  let inboxCalls = 0;
  const base = routedFetch();
  const fetchImpl = async (url) => {
    if (url === "/api/inbox") inboxCalls++;
    return base(url);
  };

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl });
  await handle.ready;
  await handle.refresh(); // an explicit, deliberate re-fetch — not automatic

  assert.strictEqual(inboxCalls, 2);
});

// ---------------------------------------------------------------------------
// TC-018 steps 2/3 (superseded by the dogfooding regroup-by-project
// decision): the top-level screen no longer renders both sections as a
// flat, tab-switched feed across every project — it renders one block per
// project (`groupByProject`), each a heading + issue-summary table. The
// per-issue two-section split now lives one level down, on the
// project-inbox screen (`test/project-inbox.test.js`) and the workspace
// "Дела" tab, both built from the same `renderIssueGroup`/`groupByIssue`
// this file exports.
// ---------------------------------------------------------------------------

test("mount() renders one block per project (groupByProject), each a heading + issue-summary table", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => FIXTURE_RESPONSE });

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl });
  await handle.ready;

  // FIXTURE_RESPONSE's one manual test is proj-a, its one human task is
  // proj-b — two distinct project blocks, not one merged feed.
  const projectSections = container.findAll((n) => n.className === "inbox-project");
  assert.strictEqual(projectSections.length, 2);

  const headings = projectSections.map((s) => s.findAll((n) => n.className === "inbox-project-link")[0].textContent).sort();
  assert.deepStrictEqual(headings, [MANUAL_TEST_ITEM.project, HUMAN_TASK_ITEM.project].sort());

  const projA = projectSections.find((s) => s.findAll((n) => n.className === "inbox-project-link")[0].textContent === "proj-a");
  const rows = projA.findAll((n) => n.tagName === "TR").slice(1); // drop the header row
  assert.strictEqual(rows.length, 1, "proj-a's one issue gets one summary row");
  const issueLink = rows[0].findAll((n) => n.className === "inbox-project-issue-link")[0];
  assert.strictEqual(issueLink.textContent, MANUAL_TEST_ITEM.issueId);
});

test("mount() never assigns location.hash — project/issue links route through onNavigate", async () => {
  installFakeDocument();
  // No `location` global exists under plain Node — if the handler under
  // test ever touched `location.hash`, this whole test would throw a
  // ReferenceError before reaching any assertion below.
  assert.strictEqual(typeof globalThis.location, "undefined");

  const container = new FakeElement("div");
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => FIXTURE_RESPONSE });
  const navigated = [];

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl, onNavigate: (hash) => navigated.push(hash) });
  await handle.ready;

  const projectLink = container.findAll((n) => n.className === "inbox-project-link" && n.textContent === MANUAL_TEST_ITEM.project)[0];
  projectLink.dispatchClick();
  assert.deepStrictEqual(navigated, [`#/p/${MANUAL_TEST_ITEM.project}`]);

  const issueLink = container.findAll((n) => n.className === "inbox-project-issue-link")[0];
  issueLink.dispatchClick();
  assert.strictEqual(navigated.length, 2);
  assert.ok(navigated[1].startsWith(`#/p/`) && navigated[1].includes("?issue="));

  assert.strictEqual(typeof globalThis.location, "undefined"); // still untouched
  assert.ok(!/location\.hash\s*=/.test(SOURCE), "public/inbox.js must never assign location.hash");
});

// ---------------------------------------------------------------------------
// Unified header + role filter (dogfooding round 2, Task 60): back link +
// project-selector + multi-select role filter, and the filter actually
// drops items — not just annotates them — same fix already applied to the
// launcher's project grid.
// ---------------------------------------------------------------------------

test("mount() renders the unified header — back link, project-selector (\"Все проекты\"), and a role-switch with every role", async () => {
  installFakeDocument();
  const container = new FakeElement("div");

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl: routedFetch() });
  await handle.ready;

  const back = container.findAll((n) => n.className === "workspace-back")[0];
  assert.strictEqual(back.textContent, "← Проекты");
  assert.strictEqual(back.href, "http://localhost/#/");

  const trigger = container.findAll((n) => n.className === "project-selector-trigger")[0];
  assert.strictEqual(trigger.textContent, "Все проекты");

  const roleButtons = container.findAll((n) => n.className === "role-switch")[0].findAll((n) => n.tagName === "BUTTON");
  assert.strictEqual(roleButtons.length, ROLES_RESPONSE.roles.length);
});

test("mount() sets document.title for the inbox screen", async () => {
  installFakeDocument();
  const container = new FakeElement("div");

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl: routedFetch() });
  await handle.ready;

  assert.strictEqual(document.title, "Инбокс | Project Explorer");
});

test("mount(): the back link navigates to #/ via onNavigate, not a location.hash assignment", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const navigated = [];

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl: routedFetch(), onNavigate: (target) => navigated.push(target) });
  await handle.ready;

  container.findAll((n) => n.className === "workspace-back")[0].dispatchClick();
  assert.deepStrictEqual(navigated, ["#/"]);
});

test("mount(): role filter actually drops items with nothing relevant to the selected role — not just an annotation", async () => {
  installFakeDocument();
  const container = new FakeElement("div");

  const mod = await loadModule();
  // developer: proj-b's humanTask (stageKey "specs") is developer's
  // business; proj-a's manualTest is tester's — proj-a must disappear.
  const handle = mod.mount(container, { fetchImpl: routedFetch(), initialRoles: ["developer"] });
  await handle.ready;

  const blocks = container.findAll((n) => n.className === "inbox-project");
  const headings = blocks.map((s) => s.findAll((n) => n.className === "inbox-project-link")[0].textContent);
  assert.deepStrictEqual(headings, [HUMAN_TASK_ITEM.project]);
});

test("mount(): toggling roles re-renders the filtered item list without re-fetching", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  let inboxCalls = 0;
  const base = routedFetch();
  const fetchImpl = async (url) => {
    if (url === "/api/inbox") inboxCalls++;
    return base(url);
  };

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl });
  await handle.ready;

  // Unfiltered: both projects present.
  assert.strictEqual(container.findAll((n) => n.className === "inbox-project").length, 2);

  const testerBtn = container.findAll((n) => n.tagName === "BUTTON" && n.dataset.roleId === "tester")[0];
  testerBtn.dispatchClick();

  const blocksAfter = container.findAll((n) => n.className === "inbox-project");
  assert.deepStrictEqual(
    blocksAfter.map((s) => s.findAll((n) => n.className === "inbox-project-link")[0].textContent),
    [MANUAL_TEST_ITEM.project]
  );
  assert.strictEqual(inboxCalls, 1, "toggling role must not re-fetch /api/inbox");
});

test("mount(): empty role selection stays unfiltered — every project's items render", async () => {
  installFakeDocument();
  const container = new FakeElement("div");

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl: routedFetch(), initialRoles: [] });
  await handle.ready;

  assert.strictEqual(container.findAll((n) => n.className === "inbox-project").length, 2);
});

// ---------------------------------------------------------------------------
// filterInboxItemsByRoles — pure function backing the role filter above.
// ---------------------------------------------------------------------------

test("filterInboxItemsByRoles: empty/null/undefined roleIds is unfiltered", async () => {
  const mod = await loadModule();
  const expected = { manualTests: [MANUAL_TEST_ITEM], humanTasks: [HUMAN_TASK_ITEM] };
  assert.deepStrictEqual(mod.filterInboxItemsByRoles([MANUAL_TEST_ITEM], [HUMAN_TASK_ITEM], []), expected);
  assert.deepStrictEqual(mod.filterInboxItemsByRoles([MANUAL_TEST_ITEM], [HUMAN_TASK_ITEM], null), expected);
  assert.deepStrictEqual(mod.filterInboxItemsByRoles([MANUAL_TEST_ITEM], [HUMAN_TASK_ITEM], undefined), expected);
});

test("filterInboxItemsByRoles: manualTests only survive when \"tester\" is selected", async () => {
  const mod = await loadModule();
  assert.deepStrictEqual(mod.filterInboxItemsByRoles([MANUAL_TEST_ITEM], [], ["tester"]), {
    manualTests: [MANUAL_TEST_ITEM],
    humanTasks: [],
  });
  assert.deepStrictEqual(mod.filterInboxItemsByRoles([MANUAL_TEST_ITEM], [], ["developer"]), {
    manualTests: [],
    humanTasks: [],
  });
});

test("filterInboxItemsByRoles: humanTasks survive only when their stageKey's role is selected", async () => {
  const mod = await loadModule();
  assert.deepStrictEqual(mod.filterInboxItemsByRoles([], [HUMAN_TASK_ITEM], ["developer"]), {
    manualTests: [],
    humanTasks: [HUMAN_TASK_ITEM],
  });
  assert.deepStrictEqual(mod.filterInboxItemsByRoles([], [HUMAN_TASK_ITEM], ["analyst"]), {
    manualTests: [],
    humanTasks: [],
  });
});

test("filterInboxItemsByRoles: tolerates missing/malformed arrays", async () => {
  const mod = await loadModule();
  assert.deepStrictEqual(mod.filterInboxItemsByRoles(null, undefined, ["tester"]), { manualTests: [], humanTasks: [] });
});

// ---------------------------------------------------------------------------
// TC-020 — every rendered item carries project, issue, what's required, and
// where a click takes the user.
// ---------------------------------------------------------------------------

test("view-model builders expose project/issue/what/where for both item kinds", async () => {
  const mod = await loadModule();

  const manualView = mod.manualTestItemView(MANUAL_TEST_ITEM);
  assert.strictEqual(manualView.project, MANUAL_TEST_ITEM.project);
  assert.strictEqual(manualView.issueId, MANUAL_TEST_ITEM.issueId);
  assert.ok(manualView.what && manualView.what.length > 0);
  assert.strictEqual(manualView.what, MANUAL_TEST_ITEM.testCase);
  assert.strictEqual(
    manualView.where.hash,
    `#/p/${encodeURIComponent(MANUAL_TEST_ITEM.project)}/i/${encodeURIComponent(MANUAL_TEST_ITEM.issueId)}`
  );
  assert.strictEqual(manualView.where.doc, "manual_test_checklist.md");
  assert.strictEqual(manualView.where.ptcId, MANUAL_TEST_ITEM.ptcId);

  const humanView = mod.humanTaskItemView(HUMAN_TASK_ITEM);
  assert.strictEqual(humanView.project, HUMAN_TASK_ITEM.project);
  assert.strictEqual(humanView.issueId, HUMAN_TASK_ITEM.issueId);
  assert.ok(humanView.what && humanView.what.length > 0);
  assert.ok(humanView.what.includes(HUMAN_TASK_ITEM.stageKey));
  assert.ok(humanView.what.includes(HUMAN_TASK_ITEM.operation));
  assert.strictEqual(
    humanView.where.hash,
    `#/p/${encodeURIComponent(HUMAN_TASK_ITEM.project)}/i/${encodeURIComponent(HUMAN_TASK_ITEM.issueId)}`
  );
  assert.strictEqual(humanView.where.tab, "human-tasks");
  assert.strictEqual(humanView.instruction, HUMAN_TASK_ITEM.instruction);
});

test("each project's issue-summary row carries correct manual-test/human-task counts (AC-04c, superseded shape)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => FIXTURE_RESPONSE });

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl });
  await handle.ready;

  // Item-level click-through (AC-04c: "клик ведёт на соответствующий
  // документ/чек-лист/таб Дела нужного проекта и issue") now happens one
  // level down — `renderIssueGroup` (tested above) and
  // `test/project-inbox.test.js` — not at this top-level summary. This
  // level's own promise is an accurate count getting you to the right
  // project/issue in the first place.
  const rows = container.findAll((n) => n.tagName === "TR").filter((r) => r.findAll((n) => n.tagName === "TD").length);
  assert.strictEqual(rows.length, 2, "one summary row per project (one issue each)");

  for (const row of rows) {
    const cells = row.findAll((n) => n.tagName === "TD");
    const issueId = cells[0].findAll((n) => n.className === "inbox-project-issue-link")[0].textContent;
    if (issueId === MANUAL_TEST_ITEM.issueId) {
      assert.strictEqual(cells[1].textContent, "1");
      assert.strictEqual(cells[2].textContent, "0");
    } else if (issueId === HUMAN_TASK_ITEM.issueId) {
      assert.strictEqual(cells[1].textContent, "0");
      assert.strictEqual(cells[2].textContent, "1");
    } else {
      assert.fail(`unexpected issue row: ${issueId}`);
    }
  }
});

// ---------------------------------------------------------------------------
// groupByIssue / renderIssueGroup — shared by the project-inbox screen and
// the workspace "Дела" tab (dogfooding decision: group by issue within a
// project, two sections per issue, not one merged table).
// ---------------------------------------------------------------------------

const OTHER_MANUAL_TEST_ITEM = {
  ...MANUAL_TEST_ITEM,
  ptcId: "PTC-004",
  testCase: "Отметить TC-004 как выполненный",
};

test("groupByIssue: groups both arrays by issueId, first-appearance order, every issue appearing in either array gets an entry", async () => {
  const mod = await loadModule();
  const sameIssueManualTest = { ...MANUAL_TEST_ITEM, issueId: HUMAN_TASK_ITEM.issueId };
  const groups = mod.groupByIssue([MANUAL_TEST_ITEM, sameIssueManualTest], [HUMAN_TASK_ITEM]);

  assert.deepStrictEqual(
    groups.map((g) => g.issueId),
    [MANUAL_TEST_ITEM.issueId, HUMAN_TASK_ITEM.issueId]
  );
  const first = groups.find((g) => g.issueId === MANUAL_TEST_ITEM.issueId);
  assert.strictEqual(first.manualTests.length, 1);
  assert.strictEqual(first.humanTasks.length, 0);

  const second = groups.find((g) => g.issueId === HUMAN_TASK_ITEM.issueId);
  assert.strictEqual(second.manualTests.length, 1, "the human task's issue also picked up the same-issue manual test");
  assert.strictEqual(second.humanTasks.length, 1);
});

test("groupByIssue: tolerates missing/malformed arrays", async () => {
  const mod = await loadModule();
  assert.deepStrictEqual(mod.groupByIssue(null, undefined), []);
  assert.deepStrictEqual(mod.groupByIssue([{ project: "p" }], []), []); // no issueId -> dropped, not crashed
});

// ---------------------------------------------------------------------------
// groupByProject — the top-level global inbox's own grouping (dogfooding
// decision: group by project first, each project's own items further
// grouped by issue).
// ---------------------------------------------------------------------------

test("groupByProject: groups by project, alphabetically, each project's issues further grouped by groupByIssue", async () => {
  const mod = await loadModule();
  const result = mod.groupByProject(
    [
      { project: "proj-b", issueId: "20260101-feat-a", ptcId: "PTC-1" },
      { project: "proj-a", issueId: "20260102-feat-b", ptcId: "PTC-2" },
    ],
    [{ project: "proj-a", issueId: "20260102-feat-b", stageKey: "specs" }]
  );

  assert.deepStrictEqual(
    result.map((p) => p.project),
    ["proj-a", "proj-b"]
  );

  const projA = result.find((p) => p.project === "proj-a");
  assert.strictEqual(projA.issues.length, 1);
  assert.strictEqual(projA.issues[0].issueId, "20260102-feat-b");
  assert.strictEqual(projA.issues[0].manualTests.length, 1);
  assert.strictEqual(projA.issues[0].humanTasks.length, 1);

  const projB = result.find((p) => p.project === "proj-b");
  assert.strictEqual(projB.issues.length, 1);
  assert.strictEqual(projB.issues[0].manualTests.length, 1);
  assert.strictEqual(projB.issues[0].humanTasks.length, 0);
});

test("groupByProject: tolerates missing/malformed arrays", async () => {
  const mod = await loadModule();
  assert.deepStrictEqual(mod.groupByProject(null, undefined), []);
});

test("renderIssueGroup: renders a heading with the issue id and both sections, scoped to only the items handed to it", async () => {
  installFakeDocument();

  const mod = await loadModule();
  const group = mod.renderIssueGroup(MANUAL_TEST_ITEM.issueId, [MANUAL_TEST_ITEM, OTHER_MANUAL_TEST_ITEM], [], null);

  assert.strictEqual(group.className, "issue-group");
  const title = group.findAll((n) => n.className === "issue-group-title")[0];
  assert.strictEqual(title.textContent, MANUAL_TEST_ITEM.issueId);

  const sectionTitles = group.findAll((n) => n.className === "inbox-section-title").map((n) => n.textContent);
  assert.deepStrictEqual(sectionTitles, ["Ручные тесты (2)", "Человеческие задачи (0)"]);

  const items = group.findAll((n) => n.className === "inbox-item-label");
  assert.strictEqual(items.length, 2);
});

test("renderIssueGroup: sets its DOM id from anchorId, when given, for the global inbox's summary-table links to target", async () => {
  installFakeDocument();
  const mod = await loadModule();
  const group = mod.renderIssueGroup(HUMAN_TASK_ITEM.issueId, [], [HUMAN_TASK_ITEM], null, "issue-20260202-feat-fixture-human");
  assert.strictEqual(group.id, "issue-20260202-feat-fixture-human");
});

test("renderIssueGroup: navigation clicks still carry through to onNavigate, same as the top-level inbox", async () => {
  installFakeDocument();
  const navigated = [];
  const mod = await loadModule();
  const group = mod.renderIssueGroup(MANUAL_TEST_ITEM.issueId, [MANUAL_TEST_ITEM], [], (target) => navigated.push(target));

  const link = group.findAll((n) => n.tagName === "A")[0];
  link.dispatchClick();
  assert.strictEqual(navigated.length, 1);
  assert.strictEqual(navigated[0].ptcId, MANUAL_TEST_ITEM.ptcId);
});
