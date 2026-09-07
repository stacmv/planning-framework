// test/project-picker.test.js — public/project-picker.js's shared
// sectioned project list (dogfooding round 2: shared by the launcher's own
// grid and every other screen's project-selector dropdown). The launcher's
// own tests (test/launcher.test.js) already exercise this rendering
// end-to-end via mount(); this file covers the module directly/in
// isolation, since it now has independent callers beyond the launcher.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const MODULE_PATH = path.join(__dirname, "..", "public", "project-picker.js");

function loadModule() {
  return import(pathToFileURL(MODULE_PATH).href);
}

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
  global.document = { createElement: (tag) => new FakeElement(tag) };
}

test("renderProjectSections: no projects yet (null) shows Загрузка…, empty array shows the configured-nothing message", async () => {
  installFakeDocument();
  const mod = await loadModule();

  const loading = mod.renderProjectSections({ projects: null, projectIssuesByName: {}, roleIds: [], inbox: null, hrefFor: () => "#", onOpenProject: () => {} });
  assert.ok(loading.findAll((n) => n.className === "muted" && n.textContent === "Загрузка…").length);

  const empty = mod.renderProjectSections({ projects: [], projectIssuesByName: {}, roleIds: [], inbox: null, hrefFor: () => "#", onOpenProject: () => {} });
  assert.ok(empty.findAll((n) => n.className === "muted" && n.textContent === "Нет настроенных проектов.").length);
});

test("renderProjectSections: a project whose issues haven't loaded yet renders under \"open\" (not misclassified as \"clear\")", async () => {
  installFakeDocument();
  const mod = await loadModule();

  const root = mod.renderProjectSections({
    projects: [{ name: "proj-a" }],
    projectIssuesByName: {}, // proj-a's own fetch still in flight
    roleIds: [],
    inbox: null,
    hrefFor: (name) => `#/p/${name}`,
    onOpenProject: () => {},
  });

  const titles = root.findAll((n) => n.className === "project-section-title").map((n) => n.textContent);
  assert.deepStrictEqual(titles, [mod.SECTION_TITLES.open]);
});

test("renderProjectSections: hrefFor and onOpenProject are both honored per project", async () => {
  installFakeDocument();
  const mod = await loadModule();
  const opened = [];

  const root = mod.renderProjectSections({
    projects: [{ name: "proj-a" }],
    projectIssuesByName: { "proj-a": [] }, // "clear" — no issues at all
    roleIds: [],
    inbox: null,
    hrefFor: (name) => `#/p/${name}`,
    onOpenProject: (name) => opened.push(name),
  });

  const card = root.findAll((n) => n.className === "project-card")[0];
  assert.strictEqual(card.href, "#/p/proj-a");
  card.dispatchClick();
  assert.deepStrictEqual(opened, ["proj-a"]);
});

test("renderProjectSections: sections render in a fixed order (open, problems, clear), skipping empty ones", async () => {
  installFakeDocument();
  const mod = await loadModule();

  const doneStages = () => ["brd", "specs", "test_plan", "implementation_plan", "code_review", "testing", "user_docs", "dev_docs", "qa"].map((key) => ({ key, done: true }));

  const root = mod.renderProjectSections({
    projects: [{ name: "proj-clear" }, { name: "proj-open" }],
    projectIssuesByName: {
      "proj-clear": [{ issueId: "x", status: "closed", stages: doneStages(), codeReviewVerdict: "PASS", qaVerdict: "PASS" }],
      "proj-open": [{ issueId: "y", status: "open", stages: doneStages() }],
    },
    roleIds: [],
    inbox: null,
    hrefFor: (name) => `#/p/${name}`,
    onOpenProject: () => {},
  });

  const titles = root.findAll((n) => n.className === "project-section-title").map((n) => n.textContent);
  assert.deepStrictEqual(titles, [mod.SECTION_TITLES.open, mod.SECTION_TITLES.clear]);
});

// ---------------------------------------------------------------------------
// renderProjectSelector — the unified header's project control.
// ---------------------------------------------------------------------------

test("renderProjectSelector: closed by default (isOpen: false) shows only the trigger, no panel", async () => {
  installFakeDocument();
  const mod = await loadModule();

  const wrap = mod.renderProjectSelector({
    triggerLabel: "proj-a",
    isOpen: false,
    onToggle: () => {},
    projects: [{ name: "proj-a" }],
    projectIssuesByName: {},
    roleIds: [],
    inbox: null,
    hrefFor: (name) => `#/p/${name}`,
    onOpenProject: () => {},
  });

  const trigger = wrap.findAll((n) => n.className === "project-selector-trigger")[0];
  assert.strictEqual(trigger.textContent, "proj-a");
  assert.strictEqual(trigger.getAttribute("aria-expanded"), "false");
  assert.strictEqual(wrap.findAll((n) => n.className === "project-selector-panel").length, 0);
});

test("renderProjectSelector: isOpen renders the panel with the same sectioned list renderProjectSections builds", async () => {
  installFakeDocument();
  const mod = await loadModule();

  const wrap = mod.renderProjectSelector({
    triggerLabel: "Все проекты",
    isOpen: true,
    onToggle: () => {},
    projects: [{ name: "proj-a" }],
    projectIssuesByName: { "proj-a": [] },
    roleIds: [],
    inbox: null,
    hrefFor: (name) => `#/p/${name}`,
    onOpenProject: () => {},
  });

  const panel = wrap.findAll((n) => n.className === "project-selector-panel")[0];
  assert.ok(panel, "expected the dropdown panel to render when isOpen");
  assert.ok(panel.findAll((n) => n.className === "project-card" && n.dataset.project === "proj-a").length);
});

test("renderProjectSelector: clicking the trigger calls onToggle — the caller owns isOpen, this function doesn't toggle itself", async () => {
  installFakeDocument();
  const mod = await loadModule();
  let toggled = 0;

  const wrap = mod.renderProjectSelector({
    triggerLabel: "proj-a",
    isOpen: false,
    onToggle: () => toggled++,
    projects: [],
    projectIssuesByName: {},
    roleIds: [],
    inbox: null,
    hrefFor: () => "#",
    onOpenProject: () => {},
  });

  wrap.findAll((n) => n.className === "project-selector-trigger")[0].dispatchClick();
  assert.strictEqual(toggled, 1);
});

// ---------------------------------------------------------------------------
// Role filtering (dogfooding round 2, second pass) — renderProjectSections
// computes attentionForRoles' byIssue BEFORE classifying, so the role
// filter can actually hide an issue/project, not just annotate it.
// ---------------------------------------------------------------------------

const doneStages = () =>
  ["brd", "specs", "test_plan", "implementation_plan", "code_review", "testing", "user_docs", "dev_docs", "qa"].map((key) => ({
    key,
    done: true,
  }));

test("renderProjectSections: role filter hides a project whose only open issue has nothing relevant to the selected role", async () => {
  installFakeDocument();
  const mod = await loadModule();

  const root = mod.renderProjectSections({
    projects: [{ name: "proj-a" }],
    projectIssuesByName: {
      "proj-a": [{ issueId: "20260101-feat-a", status: "open", stages: doneStages(), codeReviewVerdict: "PASS", qaVerdict: "PASS" }],
    },
    roleIds: ["developer"],
    inbox: { manualTests: [{ project: "proj-a", issueId: "20260101-feat-a" }], humanTasks: [] }, // tester's business only
    hrefFor: (name) => `#/p/${name}`,
    onOpenProject: () => {},
  });

  const titles = root.findAll((n) => n.className === "project-section-title").map((n) => n.textContent);
  assert.deepStrictEqual(titles, [mod.SECTION_TITLES.clear], "no developer-relevant reason exists to keep proj-a in \"open\"");
});

test("renderProjectSections: role filter keeps a project's open issue visible once the inbox shows role-relevant pending work", async () => {
  installFakeDocument();
  const mod = await loadModule();

  const root = mod.renderProjectSections({
    projects: [{ name: "proj-a" }],
    projectIssuesByName: {
      "proj-a": [{ issueId: "20260101-feat-a", status: "open", stages: doneStages(), codeReviewVerdict: "PASS", qaVerdict: "PASS" }],
    },
    roleIds: ["tester"],
    inbox: { manualTests: [{ project: "proj-a", issueId: "20260101-feat-a" }], humanTasks: [] },
    hrefFor: (name) => `#/p/${name}`,
    onOpenProject: () => {},
  });

  const titles = root.findAll((n) => n.className === "project-section-title").map((n) => n.textContent);
  assert.deepStrictEqual(titles, [mod.SECTION_TITLES.open]);
  const meta = root.findAll((n) => n.className === "project-card-issue-meta")[0].textContent;
  assert.ok(meta.includes("1 для вас"), `expected the pending manual test to annotate the card, got ${JSON.stringify(meta)}`);
});

test("renderProjectSections: role filter narrows the \"problems\" section to role-owned doc problems only", async () => {
  installFakeDocument();
  const mod = await loadModule();
  const stagesMissingQa = doneStages();
  stagesMissingQa.find((s) => s.key === "qa").done = false; // developer-owned, per stage-roles.js

  const base = {
    projects: [{ name: "proj-a" }],
    projectIssuesByName: { "proj-a": [{ issueId: "20260102-feat-b", status: "closed", stages: stagesMissingQa }] },
    inbox: null,
    hrefFor: (name) => `#/p/${name}`,
    onOpenProject: () => {},
  };

  const analystView = mod.renderProjectSections({ ...base, roleIds: ["analyst"] });
  assert.deepStrictEqual(
    analystView.findAll((n) => n.className === "project-section-title").map((n) => n.textContent),
    [mod.SECTION_TITLES.clear]
  );

  const developerView = mod.renderProjectSections({ ...base, roleIds: ["developer"] });
  assert.deepStrictEqual(
    developerView.findAll((n) => n.className === "project-section-title").map((n) => n.textContent),
    [mod.SECTION_TITLES.problems]
  );
  assert.strictEqual(
    developerView.findAll((n) => n.className === "project-card-problem")[0].textContent,
    "20260102-feat-b: Нет QA report"
  );
});

test("renderProjectSections: empty roleIds stays unfiltered — every open issue counts regardless of relevance", async () => {
  installFakeDocument();
  const mod = await loadModule();

  const root = mod.renderProjectSections({
    projects: [{ name: "proj-a" }],
    projectIssuesByName: {
      "proj-a": [{ issueId: "20260101-feat-a", status: "open", stages: doneStages(), codeReviewVerdict: "PASS", qaVerdict: "PASS" }],
    },
    roleIds: [],
    inbox: { manualTests: [{ project: "proj-a", issueId: "20260101-feat-a" }], humanTasks: [] },
    hrefFor: (name) => `#/p/${name}`,
    onOpenProject: () => {},
  });

  const titles = root.findAll((n) => n.className === "project-section-title").map((n) => n.textContent);
  assert.deepStrictEqual(titles, [mod.SECTION_TITLES.open]);
});
