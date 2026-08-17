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
  get href() {
    return this._href;
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

// ---------------------------------------------------------------------------
// TC-018 step 1 — exactly one fetch("/api/inbox") when the screen opens.
// ---------------------------------------------------------------------------

test("mount() fetches /api/inbox exactly once", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    assert.strictEqual(url, "/api/inbox");
    return { ok: true, status: 200, json: async () => FIXTURE_RESPONSE };
  };

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl });
  await handle.ready;

  assert.strictEqual(calls, 1);
  // Source-level cross-check (TC-018 step 1's literal wording: "grep
  // public/inbox.js for the number of fetch/equivalent calls to
  // /api/inbox") — exactly one call site references the endpoint.
  const inboxUrlOccurrences = SOURCE.match(/["']\/api\/inbox["']/g) || [];
  assert.strictEqual(inboxUrlOccurrences.length, 1, "expected exactly one /api/inbox call site in public/inbox.js");
});

test("refresh() called again does not throw and still hits the same single call site", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return { ok: true, status: 200, json: async () => FIXTURE_RESPONSE };
  };

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl });
  await handle.ready;
  await handle.refresh(); // an explicit, deliberate re-fetch — not automatic

  assert.strictEqual(calls, 2);
});

// ---------------------------------------------------------------------------
// TC-018 steps 2/3 — both sections rendered from the one response; distinct
// sections (not a merged feed); switching sections touches only local state.
// ---------------------------------------------------------------------------

test("mount() renders both sections from the single fetched object, as distinct sections", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => FIXTURE_RESPONSE });

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl });
  await handle.ready;

  const sections = container.findAll((n) => n.tagName === "SECTION");
  assert.strictEqual(sections.length, 2, "expected two distinct <section> elements, not one merged feed");
  const sectionKeys = sections.map((s) => s.dataset.section).sort();
  assert.deepStrictEqual(sectionKeys, [mod.SECTIONS.HUMAN_TASKS, mod.SECTIONS.MANUAL_TESTS].sort());

  // Distinct, human-readable titles (AC-04b) — not an identical badge on
  // both sections.
  const titles = sections.map((s) => s.findAll((n) => n.className === "inbox-section-title")[0].textContent);
  assert.ok(titles[0] !== titles[1]);
  assert.ok(titles.some((t) => t.startsWith(mod.SECTION_TITLES[mod.SECTIONS.MANUAL_TESTS])));
  assert.ok(titles.some((t) => t.startsWith(mod.SECTION_TITLES[mod.SECTIONS.HUMAN_TASKS])));
});

test("switching sections changes only local activeSection state, never location.hash", async () => {
  installFakeDocument();
  // No `location` global exists under plain Node — if the handler under
  // test ever touched `location.hash`, this whole test would throw a
  // ReferenceError before reaching any assertion below.
  assert.strictEqual(typeof globalThis.location, "undefined");

  const container = new FakeElement("div");
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => FIXTURE_RESPONSE });

  const mod = await loadModule();
  const handle = mod.mount(container, { fetchImpl });
  await handle.ready;

  assert.strictEqual(handle.getState().activeSection, mod.SECTIONS.MANUAL_TESTS);

  const tabButtons = container.findAll((n) => n.tagName === "BUTTON" && n.dataset.section);
  assert.strictEqual(tabButtons.length, 2);
  const humanTasksTab = tabButtons.find((b) => b.dataset.section === mod.SECTIONS.HUMAN_TASKS);
  humanTasksTab.dispatchClick();

  assert.strictEqual(handle.getState().activeSection, mod.SECTIONS.HUMAN_TASKS);
  assert.strictEqual(typeof globalThis.location, "undefined"); // still untouched

  handle.setActiveSection(mod.SECTIONS.MANUAL_TESTS);
  assert.strictEqual(handle.getState().activeSection, mod.SECTIONS.MANUAL_TESTS);

  // Source-level cross-check, matching TC-018 step 3's literal wording.
  // (Comments are allowed to *mention* location.hash — e.g. to explain why
  // it's absent — so this checks for an actual assignment, not any
  // occurrence of the substring.)
  assert.ok(!/location\.hash\s*=/.test(SOURCE), "public/inbox.js must never assign location.hash");
  assert.ok(/activeSection/.test(SOURCE), "section switching should be visible as local activeSection state");
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

test("rendered items are clickable and carry project/issue/where data (AC-04c)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  const navigated = [];
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => FIXTURE_RESPONSE });

  const mod = await loadModule();
  const handle = mod.mount(container, {
    fetchImpl,
    onNavigate: (target) => navigated.push(target),
  });
  await handle.ready;

  const links = container.findAll((n) => n.tagName === "A");
  assert.strictEqual(links.length, 2, "expected one clickable item per manual test + human task");

  const manualLink = links.find((a) => a.dataset.issueId === MANUAL_TEST_ITEM.issueId);
  const humanLink = links.find((a) => a.dataset.issueId === HUMAN_TASK_ITEM.issueId);
  assert.ok(manualLink, "manual test item not found among rendered <a> elements");
  assert.ok(humanLink, "human task item not found among rendered <a> elements");

  assert.strictEqual(manualLink.dataset.project, MANUAL_TEST_ITEM.project);
  assert.strictEqual(manualLink.href, `#/p/${MANUAL_TEST_ITEM.project}/i/${MANUAL_TEST_ITEM.issueId}`);
  assert.strictEqual(humanLink.dataset.project, HUMAN_TASK_ITEM.project);
  assert.strictEqual(humanLink.href, `#/p/${HUMAN_TASK_ITEM.project}/i/${HUMAN_TASK_ITEM.issueId}`);

  // Clicking navigates — verified through the onNavigate hook (AC-04c: "клик
  // ведёт на соответствующий документ/чек-лист/таб Дела нужного проекта и
  // issue").
  manualLink.dispatchClick();
  humanLink.dispatchClick();
  assert.strictEqual(navigated.length, 2);
  assert.strictEqual(navigated[0].ptcId, MANUAL_TEST_ITEM.ptcId);
  assert.strictEqual(navigated[1].stageKey, HUMAN_TASK_ITEM.stageKey);

  // Every rendered item's visible label is non-empty text naming "what's
  // required" — never a blank/placeholder card (TC-020's "ни один элемент
  // не отдаётся без указания «что» и «куда»").
  const labels = container.findAll((n) => n.className === "inbox-item-label");
  assert.strictEqual(labels.length, 2);
  for (const label of labels) {
    assert.ok(label.textContent && label.textContent.trim().length > 0);
  }
});
