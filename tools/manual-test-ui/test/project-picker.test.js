// test/project-picker.test.js — public/project-picker.js's shared
// sectioned project list (dogfooding round 2: shared by the launcher's own
// grid and every other screen's project-selector dropdown). The launcher's
// own tests (test/launcher.test.js) already exercise this rendering
// end-to-end via mount(); this file covers the module directly/in
// isolation, since it now has independent callers beyond the launcher.
//
// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll
// (filterProjectsByQuery — TC-001; renderProjectSelector never growing a
// search field — TC-007)
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

// ---------------------------------------------------------------------------
// filterProjectsByQuery — TC-001 (AC-01): substring match on project name OR
// an open issue's id, case-insensitive, literal (never regex) substring.
// ---------------------------------------------------------------------------

function issue(issueId, status) {
  return { issueId, status };
}

// Fixture shared across TC-001 steps: proj-a's second (not first) open
// issue id, a closed issue whose id would otherwise match, and a project
// name containing regex metacharacters that must be treated literally
// (step 8: "." must not match as "any character", and the unbalanced "("
// must not blow up as invalid regex syntax).
const TC001_PROJECTS = [{ name: "alpha-project" }, { name: "beta.project" }, { name: "gamma(project" }];
const TC001_ISSUES_BY_NAME = {
  "alpha-project": [issue("20260101-feat-alpha", "open")],
  "beta.project": [issue("20260201-feat-beta", "closed"), issue("20260202-fix-beta", "open")],
  "gamma(project": [issue("20260301-feat-gamma", "open")],
};

// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll TC-001
test("filterProjectsByQuery: step 1 — substring match on project name returns only that project", async () => {
  const { filterProjectsByQuery } = await loadModule();
  const result = filterProjectsByQuery(TC001_PROJECTS, TC001_ISSUES_BY_NAME, "alpha");
  assert.deepStrictEqual(result.map((p) => p.name), ["alpha-project"]);
});

// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll TC-001
test("filterProjectsByQuery: step 2 — substring match on an open issue id (not the project name) returns that project", async () => {
  const { filterProjectsByQuery } = await loadModule();
  const result = filterProjectsByQuery(TC001_PROJECTS, TC001_ISSUES_BY_NAME, "20260202-fix-beta");
  assert.deepStrictEqual(result.map((p) => p.name), ["beta.project"]);
});

// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll TC-001
test("filterProjectsByQuery: step 3 — matching is case-insensitive for both name and issue-id matches", async () => {
  const { filterProjectsByQuery } = await loadModule();
  const byName = filterProjectsByQuery(TC001_PROJECTS, TC001_ISSUES_BY_NAME, "ALPHA");
  assert.deepStrictEqual(byName.map((p) => p.name), ["alpha-project"]);
  const byIssue = filterProjectsByQuery(TC001_PROJECTS, TC001_ISSUES_BY_NAME, "20260202-FIX-Beta");
  assert.deepStrictEqual(byIssue.map((p) => p.name), ["beta.project"]);
});

// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll TC-001
test("filterProjectsByQuery: step 4 — a substring matching nothing returns an empty array", async () => {
  const { filterProjectsByQuery } = await loadModule();
  const result = filterProjectsByQuery(TC001_PROJECTS, TC001_ISSUES_BY_NAME, "no-such-thing-anywhere");
  assert.deepStrictEqual(result, []);
});

// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll TC-001
test("filterProjectsByQuery: step 5 — a substring matching one project's name AND a different project's issue id returns both", async () => {
  const { filterProjectsByQuery } = await loadModule();
  // A query hitting alpha's name and a different project's issue id, so the
  // two matches are genuinely via different fields.
  const projects = [{ name: "alpha-project" }, { name: "zzz" }];
  const issuesByName = { "alpha-project": [], zzz: [issue("20260301-alpha-carrier", "open")] };
  const result = filterProjectsByQuery(projects, issuesByName, "alpha");
  assert.deepStrictEqual(result.map((p) => p.name).sort(), ["alpha-project", "zzz"]);
});

// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll TC-001
test("filterProjectsByQuery: step 6 — a match on a CLOSED issue's id alone does not pass the project", async () => {
  const { filterProjectsByQuery } = await loadModule();
  // "20260201-feat-beta" is beta.project's closed issue; it shares no
  // substring with beta.project's name or its other (open) issue.
  const result = filterProjectsByQuery(TC001_PROJECTS, TC001_ISSUES_BY_NAME, "20260201-feat-beta");
  assert.deepStrictEqual(result, []);
});

// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll TC-001
test("filterProjectsByQuery: step 7 — matches a non-first open issue in a project with several open issues", async () => {
  const { filterProjectsByQuery } = await loadModule();
  const projects = [{ name: "multi-issue-project" }];
  const issuesByName = {
    "multi-issue-project": [
      issue("20260401-feat-first", "open"),
      issue("20260402-feat-second", "open"),
      issue("20260403-feat-third", "open"),
    ],
  };
  const result = filterProjectsByQuery(projects, issuesByName, "20260403-feat-third");
  assert.deepStrictEqual(result.map((p) => p.name), ["multi-issue-project"]);
});

// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll TC-001
test("filterProjectsByQuery: step 8 — regex metacharacters are treated as literal text, never as regex syntax", async () => {
  const { filterProjectsByQuery } = await loadModule();

  // (a) "." as a literal substring of "beta.project" matches only that
  // project; as a regex it would ALSO match names with any character where
  // the dot sits. Guard against a regex-mode implementation with a decoy
  // name that has some other character in that position.
  const projectsWithDecoy = [...TC001_PROJECTS, { name: "betaXproject" }];
  const dotResult = filterProjectsByQuery(projectsWithDecoy, TC001_ISSUES_BY_NAME, "beta.");
  assert.deepStrictEqual(dotResult.map((p) => p.name), ["beta.project"], '"." must match only the literal dot, not "any character"');

  // (b) an unbalanced "(" is invalid regex syntax (`new RegExp("(")` throws)
  // — a literal-substring search must not throw on it, and must still find
  // the project whose name literally contains it.
  assert.doesNotThrow(() => filterProjectsByQuery(TC001_PROJECTS, TC001_ISSUES_BY_NAME, "gamma("));
  const parenResult = filterProjectsByQuery(TC001_PROJECTS, TC001_ISSUES_BY_NAME, "gamma(");
  assert.deepStrictEqual(parenResult.map((p) => p.name), ["gamma(project"]);
});

// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll TC-001
test("filterProjectsByQuery: empty/whitespace-only query returns every project unfiltered (AC-03)", async () => {
  const { filterProjectsByQuery } = await loadModule();
  const names = TC001_PROJECTS.map((p) => p.name);
  assert.deepStrictEqual(filterProjectsByQuery(TC001_PROJECTS, TC001_ISSUES_BY_NAME, "").map((p) => p.name), names);
  assert.deepStrictEqual(filterProjectsByQuery(TC001_PROJECTS, TC001_ISSUES_BY_NAME, "   ").map((p) => p.name), names);
  assert.deepStrictEqual(filterProjectsByQuery(TC001_PROJECTS, TC001_ISSUES_BY_NAME, undefined).map((p) => p.name), names);
});

// ---------------------------------------------------------------------------
// renderProjectSelector — TC-007 step 1 (AC-05): the header dropdown never
// grows a search field, unlike the launcher's own grid (test/launcher.test.js
// asserts the positive side of this contrast — the search field IS present
// there).
// ---------------------------------------------------------------------------

// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll TC-007
test("renderProjectSelector: an open panel never contains a search input/label, regardless of how many projects are passed (TC-007 step 1)", async () => {
  installFakeDocument();
  const mod = await loadModule();

  const wrap = mod.renderProjectSelector({
    triggerLabel: "Все проекты",
    isOpen: true,
    onToggle: () => {},
    projects: [{ name: "alpha-project" }, { name: "beta.project" }],
    projectIssuesByName: TC001_ISSUES_BY_NAME,
    roleIds: [],
    inbox: null,
    hrefFor: (name) => `#/p/${name}`,
    onOpenProject: () => {},
  });

  assert.strictEqual(wrap.findAll((n) => n.className === "project-search").length, 0, "project-selector panel must not grow a .project-search block");
  assert.strictEqual(wrap.findAll((n) => n.tagName === "INPUT").length, 0, "project-selector panel must contain no <input> at all");
  assert.strictEqual(
    wrap.findAll((n) => n.getAttribute("role") === "searchbox" || n.getAttribute("role") === "textbox").length,
    0
  );
});
