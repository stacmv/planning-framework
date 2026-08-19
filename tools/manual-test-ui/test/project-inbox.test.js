// public/project-inbox.js — `#/p/<project>` (mount(), the project screen)
// and `#/p/<project>/inbox` (mountInbox(), the dedicated inbox screen) —
// two screens sharing one module (dogfooding round 2, Task 61), exercised
// via dynamic `import()` — same convention test/launcher.test.js already
// uses for a native ES module.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { TOOL_DIR } = require("./helpers/fixtures");

const MODULE_PATH = path.join(TOOL_DIR, "public", "project-inbox.js");

function loadModule() {
  return import(pathToFileURL(MODULE_PATH).href);
}

// ---------------------------------------------------------------------------
// Minimal DOM stand-in — same shape test/launcher.test.js/test/inbox-ui.test.js use.
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
  set href(v) {
    this._href = v;
  }
  // Resolves against a fake origin, same as test/inbox-ui.test.js's fake —
  // catches a real-browser href-readback bug in the test suite instead of
  // only by hand (see inbox.js's renderProjectSummary comment for the story).
  get href() {
    if (this._href === undefined) return this._href;
    return this._href.startsWith("http") ? this._href : `http://localhost/${this._href}`;
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
    title: "",
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

function doneStages() {
  return ["brd", "specs", "test_plan", "implementation_plan", "code_review", "testing", "user_docs", "dev_docs", "qa"].map(
    (key) => ({ key, done: true })
  );
}

const ISSUES_RESPONSE = {
  currentBranch: "develop",
  defaultBranch: "develop",
  issues: [
    {
      issueId: "20260101-feat-a",
      status: "open",
      feature: "Feature A",
      stages: [
        { key: "brd", done: true },
        { key: "specs", done: true },
        { key: "test_plan", done: false },
      ],
      codeReviewVerdict: null,
      qaVerdict: null,
    },
    { issueId: "20260099-old-closed", status: "closed", feature: "Old one", stages: doneStages(), codeReviewVerdict: "PASS", qaVerdict: "PASS" },
  ],
};

function baseRoutes(overrides = {}) {
  return {
    "/api/roles": ROLES_RESPONSE,
    "/api/projects": [{ name: "proj-a" }],
    "/api/projects/proj-a/issues": ISSUES_RESPONSE,
    "/api/inbox": { manualTests: [], humanTasks: [], totalCount: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// mount() — the project screen: header, collapsed inbox summary, sectioned issues.
// ---------------------------------------------------------------------------

test("mount(): renders the unified header (back to launcher, project-selector trigger = project name, role switch)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", fetchImpl });
  await handle.ready;

  const back = container.findAll((n) => n.className === "workspace-back")[0];
  assert.strictEqual(back.textContent, "← Проекты");
  assert.strictEqual(back.href, "http://localhost/#/");

  const trigger = container.findAll((n) => n.className === "project-selector-trigger")[0];
  assert.strictEqual(trigger.textContent, "proj-a");

  assert.strictEqual(container.findAll((n) => n.className === "role-switch").length, 1);
  assert.strictEqual(
    container.findAll((n) => n.className === "role-switch")[0].findAll((n) => n.tagName === "BUTTON").length,
    ROLES_RESPONSE.roles.length
  );
});

test("mount(): sets document.title to \"<project> | Project Explorer\"", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", fetchImpl });
  await handle.ready;

  assert.strictEqual(document.title, "proj-a | Project Explorer");
});

test("mount(): renders a collapsed inbox summary card linking to the dedicated inbox screen, not the full breakdown", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(
    baseRoutes({
      "/api/inbox": {
        manualTests: [{ project: "proj-a", issueId: "20260101-feat-a", ptcId: "PTC-1" }],
        humanTasks: [],
        totalCount: 1,
      },
    })
  );

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", fetchImpl });
  await handle.ready;

  const card = container.findAll((n) => n.className === "inbox-card")[0];
  assert.ok(card, "expected a collapsed .inbox-card summary");
  assert.strictEqual(card.href, "http://localhost/#/p/proj-a/inbox");
  assert.strictEqual(card.findAll((n) => n.className === "inbox-card-label")[0].textContent, "Инбокс проекта — 1 дел");

  // No full per-issue breakdown inline on this screen (that moved to the
  // dedicated inbox screen) — no `.issue-group` blocks here.
  assert.strictEqual(container.findAll((n) => n.className === "issue-group").length, 0);
});

test("mount(): clicking the collapsed inbox card navigates to #/p/<project>/inbox", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());
  const navigated = [];

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", fetchImpl, onNavigate: (h) => navigated.push(h) });
  await handle.ready;

  container.findAll((n) => n.className === "inbox-card")[0].dispatchClick();
  assert.deepStrictEqual(navigated, ["#/p/proj-a/inbox"]);
});

test("mount(): issues render under Открытые/Требуют внимания/Закрытые, skipping empty sections", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", fetchImpl });
  await handle.ready;

  const titles = container.findAll((n) => n.className === "project-section-title").map((n) => n.textContent);
  // 20260101-feat-a is open -> "Открытые"; 20260099-old-closed is closed
  // with nothing flagged -> "Закрытые". No "Требуют внимания" here.
  assert.deepStrictEqual(titles, ["Открытые", "Закрытые"]);

  const cards = container.findAll((n) => n.className === "issue-card");
  assert.strictEqual(cards.length, 2, "one card per issue, open and closed alike");
});

test("mount(): a closed issue with a lingering doc problem lands in \"Требуют внимания\", not \"Закрытые\"", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const stagesMissingQa = doneStages();
  stagesMissingQa.find((s) => s.key === "qa").done = false;
  const fetchImpl = routedFetch(
    baseRoutes({
      "/api/projects/proj-a/issues": {
        issues: [
          { issueId: "20260099-old-closed", status: "closed", stages: stagesMissingQa, codeReviewVerdict: "PASS", qaVerdict: null },
        ],
      },
    })
  );

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", fetchImpl });
  await handle.ready;

  const titles = container.findAll((n) => n.className === "project-section-title").map((n) => n.textContent);
  assert.deepStrictEqual(titles, ["Требуют внимания"]);
  const attention = container.findAll((n) => n.className === "issue-card-attention")[0];
  assert.strictEqual(attention.textContent, "Нет QA report");
});

test("mount(): an issue's stage strip marks done stages, and closed issues carry a badge", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", fetchImpl });
  await handle.ready;

  const cards = container.findAll((n) => n.className === "issue-card");
  const openCard = cards.find((c) => c.dataset.issueId === "20260101-feat-a");
  const doneStagesRendered = openCard.findAll((n) => n.className === "issue-stage issue-stage--done").map((n) => n.textContent);
  assert.deepStrictEqual(doneStagesRendered, ["BRD", "Spec"]);
  const notDone = openCard.findAll((n) => n.className === "issue-stage" && n.textContent === "Test plan");
  assert.strictEqual(notDone.length, 1);

  const closedCard = cards.find((c) => c.dataset.issueId === "20260099-old-closed");
  assert.ok(closedCard.findAll((n) => n.className === "badge" && n.textContent === "closed").length);
  assert.strictEqual(openCard.findAll((n) => n.className === "badge").length, 0);
});

test("mount(): clicking an issue card navigates to that issue's workspace", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());
  const navigated = [];

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", fetchImpl, onNavigate: (h) => navigated.push(h) });
  await handle.ready;

  const card = container.findAll((n) => n.className === "issue-card" && n.dataset.issueId === "20260101-feat-a")[0];
  card.dispatchClick();

  assert.deepStrictEqual(navigated, ["#/p/proj-a/i/20260101-feat-a"]);
});

test("mount(): switching role changes an issue card's status message, without a new /api/projects or /api/inbox fetch", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const getCounts = {};
  const stagesMissingSpecs = doneStages();
  stagesMissingSpecs.find((s) => s.key === "specs").done = false; // developer-owned
  const fetchImpl = async (url) => {
    getCounts[url] = (getCounts[url] || 0) + 1;
    const routes = baseRoutes({
      "/api/projects/proj-a/issues": {
        issues: [{ issueId: "20260101-feat-a", status: "open", stages: stagesMissingSpecs, codeReviewVerdict: null, qaVerdict: null }],
      },
    });
    if (!(url in routes)) throw new Error(`unexpected fetch in test: ${url}`);
    return { ok: true, status: 200, json: async () => routes[url] };
  };

  const mod = await loadModule();
  const handle = mod.mount(container, { project: "proj-a", fetchImpl, initialRoles: ["analyst"] });
  await handle.ready;

  let attention = container.findAll((n) => n.className === "issue-card-attention")[0];
  assert.strictEqual(attention.textContent, "Ничего не требует внимания", "analyst: the missing doc (specs) is developer's, not theirs");

  const developerBtn = container.findAll((n) => n.tagName === "BUTTON" && n.dataset.roleId === "developer")[0];
  developerBtn.dispatchClick();

  attention = container.findAll((n) => n.className === "issue-card-attention")[0];
  assert.strictEqual(attention.textContent, "Нет Spec");

  assert.strictEqual(getCounts["/api/projects/proj-a/issues"], 1);
  assert.strictEqual(getCounts["/api/inbox"], 1);
});

// ---------------------------------------------------------------------------
// classifyProjectIssues — the pure classification function behind the three
// sections above.
// ---------------------------------------------------------------------------

test("classifyProjectIssues: open issues always land in \"open\", regardless of role relevance", async () => {
  const mod = await loadModule();
  const issues = [{ issueId: "a", status: "open", stages: doneStages(), codeReviewVerdict: "PASS", qaVerdict: "PASS" }];
  const result = mod.classifyProjectIssues(issues, null, "proj-a", ["tester"]);
  assert.strictEqual(result.open.length, 1);
  assert.strictEqual(result.attention.length, 0);
  assert.strictEqual(result.closed.length, 0);
});

test("classifyProjectIssues: a closed issue with a role-owned doc problem lands in \"attention\"; role-irrelevant lands in \"closed\"", async () => {
  const mod = await loadModule();
  const stagesMissingBrd = doneStages();
  stagesMissingBrd.find((s) => s.key === "brd").done = false; // analyst-owned
  const issues = [{ issueId: "a", status: "closed", stages: stagesMissingBrd }];

  const developerResult = mod.classifyProjectIssues(issues, null, "proj-a", ["developer"]);
  assert.strictEqual(developerResult.attention.length, 0);
  assert.strictEqual(developerResult.closed.length, 1);

  const analystResult = mod.classifyProjectIssues(issues, null, "proj-a", ["analyst"]);
  assert.strictEqual(analystResult.attention.length, 1);
  assert.strictEqual(analystResult.attention[0].message, "Нет BRD");
});

test("classifyProjectIssues: a closed issue with pending role-relevant manual tests lands in \"attention\"", async () => {
  const mod = await loadModule();
  const issues = [{ issueId: "a", status: "closed", stages: doneStages(), codeReviewVerdict: "PASS", qaVerdict: "PASS" }];
  const inbox = { manualTests: [{ project: "proj-a", issueId: "a" }], humanTasks: [] };
  const result = mod.classifyProjectIssues(issues, inbox, "proj-a", ["tester"]);
  assert.strictEqual(result.attention.length, 1);
  assert.strictEqual(result.attention[0].message, "1 ручной тест");
});

// ---------------------------------------------------------------------------
// mountInbox() — the dedicated project-inbox screen: full per-issue breakdown.
// ---------------------------------------------------------------------------

test("mountInbox(): renders the header with a back link to the project screen, and the full per-issue breakdown", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(
    baseRoutes({
      "/api/inbox": {
        manualTests: [{ project: "proj-a", issueId: "20260101-feat-a", ptcId: "PTC-0001", testCase: "Case 1" }],
        humanTasks: [],
        totalCount: 1,
      },
    })
  );

  const mod = await loadModule();
  const handle = mod.mountInbox(container, { project: "proj-a", fetchImpl });
  await handle.ready;

  const back = container.findAll((n) => n.className === "workspace-back")[0];
  assert.strictEqual(back.textContent, "← proj-a");
  assert.strictEqual(back.href, "http://localhost/#/p/proj-a");

  const groups = container.findAll((n) => n.className === "issue-group");
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].id, "issue-20260101-feat-a");
  assert.ok(groups[0].findAll((n) => n.className === "inbox-item-label" && n.textContent.includes("Case 1")).length);
});

test("mountInbox(): sets document.title to \"<project>: инбокс | Project Explorer\"", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mountInbox(container, { project: "proj-a", fetchImpl });
  await handle.ready;

  assert.strictEqual(document.title, "proj-a: инбокс | Project Explorer");
});

test("mountInbox(): groups this project's own manualTests/humanTasks by issue, ignoring other projects", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(
    baseRoutes({
      "/api/inbox": {
        manualTests: [
          { project: "proj-a", issueId: "20260101-feat-a", ptcId: "PTC-0001", testCase: "Case 1" },
          { project: "proj-b", issueId: "20260101-feat-a", ptcId: "PTC-0002", testCase: "Wrong project" },
        ],
        humanTasks: [],
        totalCount: 2,
      },
    })
  );

  const mod = await loadModule();
  const handle = mod.mountInbox(container, { project: "proj-a", fetchImpl });
  await handle.ready;

  const groups = container.findAll((n) => n.className === "issue-group");
  assert.strictEqual(groups.length, 1, "only proj-a's own issue gets a group");
});

test("mountInbox(): no items for this project renders the empty state", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(baseRoutes());

  const mod = await loadModule();
  const handle = mod.mountInbox(container, { project: "proj-a", fetchImpl });
  await handle.ready;

  assert.ok(container.findAll((n) => n.className === "inbox-empty" && n.textContent.includes("Нет дел")).length);
});

test("mountInbox(): the role filter actually drops items irrelevant to the selected role", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = routedFetch(
    baseRoutes({
      "/api/inbox": {
        manualTests: [{ project: "proj-a", issueId: "20260101-feat-a", ptcId: "PTC-0001", testCase: "Case 1" }],
        humanTasks: [],
        totalCount: 1,
      },
    })
  );

  const mod = await loadModule();
  const handle = mod.mountInbox(container, { project: "proj-a", fetchImpl, initialRoles: ["developer"] });
  await handle.ready;

  // developer: the only item is a manual test (tester's business) -> no groups.
  assert.strictEqual(container.findAll((n) => n.className === "issue-group").length, 0);
  assert.ok(container.findAll((n) => n.className === "inbox-empty").length);
});
