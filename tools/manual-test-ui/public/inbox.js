"use strict";

// public/inbox.js — the inbox screen (specs.md §3, AC-04b/AC-04c/AC-04d,
// implementation_plan.md Task 15).
//
// Native ES module (`export`/`import`) — the client-side convention this
// issue's new files use (specs.md §2.3), NOT the UMD wrapper `lib/*.js`
// uses for dual Node/browser loading. This file only ever runs in a
// browser, or is exercised from Node's test runner via dynamic `import()`
// (the pattern test_plan.md TC-019 documents for `public/launcher.js`).
//
// Renders BOTH sections — "Ручные тесты" (`manualTests[]`) and
// "Человеческие задачи" (`humanTasks[]`) — from exactly ONE
// `GET /api/inbox` response (AC-04b/specs.md §3.3): `mount()` fetches once
// when the screen opens, never again on its own. Switching between the two
// sections flips only local component state (`state.activeSection`) —
// never `location.hash` — because these are two views of one already-
// fetched response, not two routes (specs.md §3.3, TC-018 step 3).
//
// Not wired into any page yet: `index.html`/`app.js`/`launcher.js` are
// Task 23's job. This module is self-contained — it exports a `mount()`
// entry point plus the pure view-model builders `mount()` is built from —
// so it is usable and testable standalone today, and pluggable later
// without change.
//
// Unified header + role filter (dogfooding round 2, Task 60): this screen
// now carries the same header launcher.js's grid/project-selector already
// establish — a back link to the launcher, a project-selector dropdown
// (`project-picker.js`, trigger reads "Все проекты" since there is no
// "current" project here), and the multi-select role filter. Selecting
// role(s) actually filters which manualTests/humanTasks render — not just
// an annotation — mirroring the same fix applied to the launcher's project
// grid (`filterInboxItemsByRoles` below; empty selection = unfiltered, same
// rule as `attention.js`'s `attentionForRoles`).

import { roleForStageKey } from "./attention.js";
import { renderProjectSelector } from "./project-picker.js";

export const SECTIONS = Object.freeze({
  MANUAL_TESTS: "manualTests",
  HUMAN_TASKS: "humanTasks",
});

// The exact two section names AC-04b/BRD interview notes require —
// "не сваливаются в одну ленту с одинаковыми на вид карточками": two
// distinct, separately-labeled sections, not one feed with a shared badge.
export const SECTION_TITLES = Object.freeze({
  [SECTIONS.MANUAL_TESTS]: "Ручные тесты",
  [SECTIONS.HUMAN_TASKS]: "Человеческие задачи",
});

// ---------------------------------------------------------------------------
// Data — exactly one fetch of /api/inbox
// ---------------------------------------------------------------------------

/**
 * The single request this screen ever makes (AC-04b, TC-018 step 1).
 * `fetchImpl` defaults to the global `fetch` — overridable so tests (and a
 * future caller wrapping retries) never have to touch the real network or
 * the global.
 *
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{manualTests: object[], humanTasks: object[], totalCount: number}>}
 */
export async function fetchInboxData(fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch("/api/inbox");
  if (!res.ok) {
    throw new Error(`GET /api/inbox failed: ${res.status}${res.statusText ? " " + res.statusText : ""}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Pure view-model builders (AC-04c: project, issue, what's required, where a
// click goes) — kept separate from DOM construction so they're testable
// without a browser. Mirrors the split test_plan.md TC-019 documents for
// `public/launcher.js`'s `formatInboxCardLabel`.
// ---------------------------------------------------------------------------

// Level-2 workspace hash for one project/issue (specs.md §2.3:
// `#/p/<project>/i/<issue>`). Both item kinds land here — a manual test on
// the tester role's `manual_test_checklist.md` tab, a human task on the
// "Дела" tab — `workspace.js` (Task 24) reads `where.roleId`/`where.doc` or
// `where.tab` to pick which one once it exists.
function workspaceHash(project, issueId) {
  return `#/p/${encodeURIComponent(project)}/i/${encodeURIComponent(issueId)}`;
}

/**
 * One `manualTests[]` row (`{project, issueId, ptcId, area, testCase,
 * priority, origin}`, lib/inbox.js's `collectManualTests`) -> the view this
 * screen renders. "What's required" is `testCase`; the click target is the
 * tester role's `manual_test_checklist.md` tab for this project/issue,
 * scrolled to `ptcId` (specs.md §3.1: a manual TC is always a tester's
 * concern by construction).
 *
 * @param {{project: string, issueId: string, ptcId: string, area: string,
 *   testCase: string, priority: string, origin: string}} item
 */
export function manualTestItemView(item) {
  return {
    kind: "manualTest",
    project: item.project,
    issueId: item.issueId,
    what: item.testCase,
    instruction: null,
    where: {
      hash: workspaceHash(item.project, item.issueId),
      roleId: "tester",
      doc: "manual_test_checklist.md",
      ptcId: item.ptcId,
    },
    label: item.ptcId ? `${item.ptcId} — ${item.testCase}` : item.testCase,
    meta: [item.project, item.issueId, item.area].filter(Boolean).join(" · "),
  };
}

/**
 * One `humanTasks[]` row (`{project, issueId, stageKey, operation, mode,
 * artifactPath, instruction, status}`, lib/inbox.js's `collectHumanTasks`)
 * -> the view this screen renders. A human task has no `testCase` field —
 * its "what's required" equivalent is `stageKey`+`operation`
 * (specs.md §3.1/AC-04c); the click target is that project/issue's "Дела"
 * tab (specs.md §2.2's `.doc-tabs` "Дела ③" — the same screen the
 * project-level counter opens).
 *
 * @param {{project: string, issueId: string, stageKey: string, operation: string,
 *   mode: string, artifactPath: string|null, instruction: string, status: string}} item
 */
export function humanTaskItemView(item) {
  const what = `${item.stageKey} (${item.operation})`;
  return {
    kind: "humanTask",
    project: item.project,
    issueId: item.issueId,
    what,
    instruction: item.instruction,
    where: {
      hash: workspaceHash(item.project, item.issueId),
      tab: "human-tasks",
      stageKey: item.stageKey,
    },
    label: item.status === "stale" ? `${what} — stale` : what,
    meta: [item.project, item.issueId, item.artifactPath].filter(Boolean).join(" · "),
  };
}

// ---------------------------------------------------------------------------
// DOM rendering
// ---------------------------------------------------------------------------

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

// One inbox item -> a clickable element carrying project/issue/what/where
// (AC-04c, TC-020 step 3). A real `href` is always set, so this navigates
// even before any router wires up `onNavigate` — plain hash navigation
// works standalone, matching this task's "self-contained, not blocked on
// launcher.js/workspace.js" instruction.
function renderItem(view, onNavigate) {
  const a = h("a", `inbox-item inbox-item--${view.kind}`);
  a.href = view.where.hash;
  a.dataset.project = view.project;
  a.dataset.issueId = view.issueId;

  a.appendChild(h("div", "inbox-item-label", view.label));
  if (view.instruction) {
    a.appendChild(h("div", "inbox-item-instruction", view.instruction));
  }
  a.appendChild(h("div", "inbox-item-meta", view.meta));

  a.addEventListener("click", (event) => {
    if (typeof onNavigate !== "function") return; // plain <a href> navigation still works without a router
    event.preventDefault();
    onNavigate(view.where);
  });

  return a;
}

/**
 * The role filter's actual effect on this screen (Task 60): drop items the
 * selected role(s) have no business with, before grouping. `roleIds` empty/
 * null/undefined = unfiltered — same rule as `attention.js`'s
 * `attentionForRoles`/`totalAttentionForRoles`. A manual test is always the
 * tester's business by construction; a human task is filtered by
 * `roleForStageKey(item.stageKey)`.
 *
 * @param {object[]} manualTests
 * @param {object[]} humanTasks
 * @param {string[]} [roleIds]
 * @returns {{manualTests: object[], humanTasks: object[]}}
 */
export function filterInboxItemsByRoles(manualTests, humanTasks, roleIds) {
  const selected = Array.isArray(roleIds) ? roleIds.filter(Boolean) : [];
  const unfiltered = selected.length === 0;
  const mt = Array.isArray(manualTests) ? manualTests : [];
  const ht = Array.isArray(humanTasks) ? humanTasks : [];
  return {
    manualTests: unfiltered || selected.includes("tester") ? mt : [],
    humanTasks: unfiltered ? ht : ht.filter((item) => selected.includes(roleForStageKey(item && item.stageKey))),
  };
}

// ---------------------------------------------------------------------------
// Per-issue grouping — shared by the project-inbox screen (a project's own
// issues, each with its own manual-tests/human-tasks block) and the
// workspace "Дела" tab (this one issue's own subset of the same data).
// Neither merges the two item kinds into one table with a type column —
// same two labeled sections as the top-level inbox always used, kept
// deliberately (dogfooding decision, explicit: "две секции, как сейчас").
// ---------------------------------------------------------------------------

/**
 * `manualTests[]`/`humanTasks[]` (already filtered to whatever scope the
 * caller wants — one project, one issue) grouped by `issueId`, in first-
 * appearance order. Every issue that appears in *either* array gets an
 * entry, even if the other array has nothing for it.
 *
 * @param {object[]} manualTests
 * @param {object[]} humanTasks
 * @returns {Array<{issueId: string, manualTests: object[], humanTasks: object[]}>}
 */
export function groupByIssue(manualTests, humanTasks) {
  const order = [];
  const byIssue = new Map();
  const bucket = (issueId) => {
    if (!byIssue.has(issueId)) {
      byIssue.set(issueId, { issueId, manualTests: [], humanTasks: [] });
      order.push(issueId);
    }
    return byIssue.get(issueId);
  };
  for (const item of Array.isArray(manualTests) ? manualTests : []) {
    if (item && item.issueId) bucket(item.issueId).manualTests.push(item);
  }
  for (const item of Array.isArray(humanTasks) ? humanTasks : []) {
    if (item && item.issueId) bucket(item.issueId).humanTasks.push(item);
  }
  return order.map((issueId) => byIssue.get(issueId));
}

/**
 * `manualTests[]`/`humanTasks[]` grouped by `project`, each project's own
 * items further grouped by issue via `groupByIssue` — the global inbox's
 * own shape (dogfooding decision): "проект — заголовок и ссылка на инбокс
 * проекта, issues сводкой по делам — таблица со ссылками на переход к
 * делам issue", replacing the previous flat two-section/tab-switch list
 * across every project at once. Projects sorted alphabetically — the
 * response carries no inherent project order worth preserving.
 *
 * @param {object[]} manualTests
 * @param {object[]} humanTasks
 * @returns {Array<{project: string, issues: Array<{issueId: string, manualTests: object[], humanTasks: object[]}>}>}
 */
export function groupByProject(manualTests, humanTasks) {
  const projects = new Set();
  for (const item of Array.isArray(manualTests) ? manualTests : []) {
    if (item && item.project) projects.add(item.project);
  }
  for (const item of Array.isArray(humanTasks) ? humanTasks : []) {
    if (item && item.project) projects.add(item.project);
  }
  return [...projects].sort().map((project) => {
    const ofProject = (items) => (Array.isArray(items) ? items : []).filter((i) => i.project === project);
    return { project, issues: groupByIssue(ofProject(manualTests), ofProject(humanTasks)) };
  });
}

/**
 * One issue's block: heading + the same two labeled sections
 * (`SECTION_TITLES`) the top-level inbox renders, scoped to just this
 * issue's own items. `anchorId`, when given, is set as the block's `id` so
 * a caller (the global inbox's per-project summary table) can link
 * straight to this issue's own section with a `#fragment`.
 *
 * @param {string} issueId
 * @param {object[]} manualTests
 * @param {object[]} humanTasks
 * @param {(target: object) => void} [onNavigate]
 * @param {string} [anchorId]
 */
export function renderIssueGroup(issueId, manualTests, humanTasks, onNavigate, anchorId) {
  const group = h("section", "issue-group");
  if (anchorId) group.id = anchorId;
  group.appendChild(h("h3", "issue-group-title", issueId));
  group.appendChild(renderTwoSectionPanels(manualTests, humanTasks, onNavigate));
  return group;
}

/**
 * Just the two labeled sections, no issue heading — the workspace "Дела"
 * tab reuses this directly (it is already on that one issue's own screen,
 * so a repeated issue-id heading would be redundant); `renderIssueGroup`
 * above is this plus a heading, for contexts (the project-inbox screen)
 * that show several issues' worth of it side by side.
 */
export function renderTwoSectionPanels(manualTests, humanTasks, onNavigate) {
  const panels = h("div", "issue-group-panels");
  panels.appendChild(renderSection(SECTIONS.MANUAL_TESTS, manualTests, manualTestItemView, onNavigate));
  panels.appendChild(renderSection(SECTIONS.HUMAN_TASKS, humanTasks, humanTaskItemView, onNavigate));
  return panels;
}

/**
 * Just the "Ручные тесты" section, read-only (`renderItem`'s link, no
 * complete/reassign actions — those exist only for human tasks). Used by
 * the workspace "Дела" tab, which already has its own richer, interactive
 * human-tasks list (`workspace.js`'s `loadAndRenderHumanTasks` —
 * complete/reassign, via the per-issue `GET .../human-tasks` endpoint, not
 * the plain read-only rows `humanTaskItemView` builds) and only needed the
 * manual-tests half of this module's two sections, not both.
 */
export function renderManualTestsSection(items, onNavigate) {
  return renderSection(SECTIONS.MANUAL_TESTS, items, manualTestItemView, onNavigate);
}

function renderSection(sectionKey, items, viewFn, onNavigate) {
  const section = h("section", `inbox-section inbox-section--${sectionKey}`);
  section.dataset.section = sectionKey;
  section.appendChild(h("h2", "inbox-section-title", `${SECTION_TITLES[sectionKey]} (${items.length})`));

  if (items.length === 0) {
    section.appendChild(h("p", "inbox-empty", "Ничего нет."));
    return section;
  }

  const list = h("ul", "inbox-list");
  for (const item of items) {
    const li = document.createElement("li");
    li.appendChild(renderItem(viewFn(item), onNavigate));
    list.appendChild(li);
  }
  section.appendChild(list);
  return section;
}

function projectHash(project) {
  return `#/p/${encodeURIComponent(project)}`;
}

// Routes to the project's own DEDICATED inbox screen (`#/p/<project>/inbox`,
// project-inbox.js's `mountInbox`), not the project screen itself — the
// per-issue breakdown this scrolls to (`initialIssueId`) lives there now
// (dogfooding round 2, Task 61), not inline on the project screen anymore.
function issueSummaryHash(project, issueId) {
  return `${projectHash(project)}/inbox?issue=${encodeURIComponent(issueId)}`;
}

// One project's block: a heading linking to its own project-inbox screen,
// then a summary table of its issues (id + manual-test/human-task counts),
// each row linking to that issue's own group there
// (`issueSummaryHash`/`project-inbox.js`'s `initialIssueId`). A real
// `<table>`, not `.inbox-list` rows — this is genuinely tabular (aligned
// counts across issues), unlike the item rows `renderItem` builds.
function renderProjectSummary(projectGroup, onNavigate) {
  const section = h("section", "inbox-project");

  const heading = h("div", "inbox-project-heading");
  const link = h("a", "inbox-project-link", projectGroup.project);
  // Captured, not read back from `link.href`: a real browser's `href`
  // getter returns the *resolved absolute URL*
  // (`http://host/path#/p/proj-a`), not the relative hash string just
  // assigned — handing that resolved string to app.js's hash setter
  // produces a garbled route that falls back to the launcher. The fake DOM
  // `node --test` uses doesn't resolve URLs, so this only showed up in a
  // real browser, not the test suite (`renderItem` above never made this
  // mistake — it keeps navigating on `view.where`, never on `a.href`).
  const projectTargetHash = projectHash(projectGroup.project);
  link.href = projectTargetHash;
  link.addEventListener("click", (event) => {
    if (typeof onNavigate !== "function") return;
    event.preventDefault();
    onNavigate(projectTargetHash);
  });
  heading.appendChild(link);
  section.appendChild(heading);

  const table = h("table", "inbox-project-table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of ["Issue", "Ручные тесты", "Человеческие задачи"]) {
    headRow.appendChild(h("th", null, label));
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const issue of projectGroup.issues) {
    const row = document.createElement("tr");

    const idCell = document.createElement("td");
    const idLink = h("a", "inbox-project-issue-link", issue.issueId);
    const issueTargetHash = issueSummaryHash(projectGroup.project, issue.issueId); // see the capture note above
    idLink.href = issueTargetHash;
    idLink.addEventListener("click", (event) => {
      if (typeof onNavigate !== "function") return;
      event.preventDefault();
      onNavigate(issueTargetHash);
    });
    idCell.appendChild(idLink);
    row.appendChild(idCell);

    row.appendChild(h("td", null, String(issue.manualTests.length)));
    row.appendChild(h("td", null, String(issue.humanTasks.length)));
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  section.appendChild(table);

  return section;
}

// ---------------------------------------------------------------------------
// Unified header — back link + project-selector + multi-select role filter
// (dogfooding round 2, Task 60). Same well-known localStorage key/format
// launcher.js already writes/reads — not imported from it: each screen
// module keeps its own small copy, same "stays independently mountable and
// testable" convention launcher.js's own header comment explains.
// ---------------------------------------------------------------------------

export const ROLE_STORAGE_KEY = "pf.role";

function safeStorage(storage) {
  if (storage) return storage;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function readStoredRoles(storage) {
  const store = safeStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(ROLE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((r) => typeof r === "string") : [];
  } catch {
    return [];
  }
}

export function storeRoles(roleIds, storage) {
  const store = safeStorage(storage);
  if (!store) return;
  try {
    store.setItem(ROLE_STORAGE_KEY, JSON.stringify(Array.isArray(roleIds) ? roleIds : []));
  } catch {
    /* storage unavailable or full — selection just won't persist */
  }
}

async function fetchJson(pathname, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(pathname);
  if (!res.ok) {
    throw new Error(`GET ${pathname} failed: ${res.status}${res.statusText ? " " + res.statusText : ""}`);
  }
  return res.json();
}

async function fetchRoles(fetchImpl) {
  const data = await fetchJson("/api/roles", fetchImpl);
  return data.roles || [];
}

async function fetchProjects(fetchImpl) {
  const data = await fetchJson("/api/projects", fetchImpl);
  return Array.isArray(data) ? data : [];
}

async function fetchProjectIssues(projectName, fetchImpl) {
  const data = await fetchJson(`/api/projects/${encodeURIComponent(projectName)}/issues`, fetchImpl);
  return Array.isArray(data.issues) ? data.issues : [];
}

function renderRoleSwitch(state, onToggleRole) {
  const wrap = h("div", "role-switch");
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", "Фильтр по роли");
  for (const role of state.roles) {
    const active = state.roleIds.includes(role.id);
    const btn = h("button", `role-btn${active ? " active" : ""}`, role.title);
    btn.type = "button";
    btn.dataset.roleId = role.id;
    btn.title = role.description || "";
    btn.setAttribute("aria-pressed", String(active));
    btn.addEventListener("click", () => onToggleRole(role.id));
    wrap.appendChild(btn);
  }
  return wrap;
}

function projectHrefFor(name) {
  return `#/p/${encodeURIComponent(name)}`;
}

function renderHeader(state, handlers) {
  const header = h("header", "workspace-header");

  const back = h("a", "workspace-back", "← Проекты");
  back.href = "#/";
  back.addEventListener("click", (event) => {
    if (!handlers.hasOnNavigate) return; // plain <a href> navigation still works without a router
    event.preventDefault();
    handlers.onNavigate("#/");
  });
  header.appendChild(back);

  header.appendChild(
    renderProjectSelector({
      triggerLabel: "Все проекты",
      isOpen: state.projectSelectorOpen,
      onToggle: handlers.onToggleProjectSelector,
      projects: state.projects,
      projectIssuesByName: state.projectIssues,
      roleIds: state.roleIds,
      inbox: state.data,
      hrefFor: projectHrefFor,
      onOpenProject: handlers.onOpenProject,
    })
  );

  header.appendChild(renderRoleSwitch(state, handlers.onToggleRole));

  return header;
}

/**
 * Mount the inbox screen into `container` (an already-attached DOM node —
 * this module never inserts itself into `document.body`, matching every
 * other read-only screen in this tool). Fetches `/api/inbox` exactly once,
 * as soon as the screen opens (AC-04b), and renders one block per project
 * (`groupByProject`) — a heading linking to that project's own inbox
 * screen, then a summary table of its issues.
 *
 * Dogfooding decision, replacing the original flat two-section/tab-switch
 * list across every project at once: with several projects configured, a
 * flat list gave no sense of "where" anything was without reading every
 * row's own project column. `renderProjectSummary`'s table and
 * `project-inbox.js`'s own per-issue two-section groups now carry that
 * distinction — this screen is an index into them, not the exhaustive
 * item list itself.
 *
 * The unified header's role filter (Task 60) actually filters which
 * manualTests/humanTasks get grouped and rendered — `filterInboxItemsByRoles`
 * above — not merely an annotation; empty selection = unfiltered, same as
 * every other screen's role filter.
 *
 * @param {Element} container
 * @param {{fetchImpl?: typeof fetch, storage?: Storage,
 *   onNavigate?: (target: object|string) => void, initialRoles?: string[]}} [options]
 * @returns {{refresh: () => Promise<void>,
 *   getState: () => {data: object|null, error: Error|null}, ready: Promise<void>}}
 */
export function mount(container, options = {}) {
  const state = {
    data: null,
    error: null,
    roles: [],
    roleIds: Array.isArray(options.initialRoles) ? options.initialRoles : readStoredRoles(options.storage),
    projects: null,
    projectIssues: {},
    projectSelectorOpen: false,
  };

  // Deliberately no `location.hash` fallback here (unlike launcher.js/
  // project-inbox.js): every clickable element this screen renders already
  // carries a real `href`, and this module's own invariant — proven by
  // running under plain Node, where no `location` global exists at all — is
  // that it never touches `location.hash` directly, only ever `onNavigate`.
  function navigate(target) {
    if (typeof options.onNavigate === "function") options.onNavigate(target);
  }

  function toggleRole(roleId) {
    state.roleIds = state.roleIds.includes(roleId) ? state.roleIds.filter((r) => r !== roleId) : [...state.roleIds, roleId];
    storeRoles(state.roleIds, options.storage);
    render();
  }

  function toggleProjectSelector() {
    state.projectSelectorOpen = !state.projectSelectorOpen;
    render();
  }

  function openProject(name) {
    state.projectSelectorOpen = false;
    navigate(projectHrefFor(name));
  }

  const handlers = {
    onNavigate: navigate,
    hasOnNavigate: typeof options.onNavigate === "function",
    onToggleRole: toggleRole,
    onToggleProjectSelector: toggleProjectSelector,
    onOpenProject: openProject,
  };

  function render() {
    container.innerHTML = "";
    if (typeof document !== "undefined") document.title = "Инбокс | Project Explorer";

    container.appendChild(renderHeader(state, handlers));

    if (state.error) {
      container.appendChild(h("p", "inbox-error", `Не удалось загрузить инбокс: ${state.error.message}`));
      return;
    }
    if (!state.data) {
      container.appendChild(h("p", "inbox-loading", "Загрузка…"));
      return;
    }

    const projects = h("div", "inbox-projects");
    const filtered = filterInboxItemsByRoles(state.data.manualTests, state.data.humanTasks, state.roleIds);
    const groups = groupByProject(filtered.manualTests, filtered.humanTasks);
    if (groups.length === 0) {
      projects.appendChild(h("p", "inbox-empty", "Ничего нет."));
    } else {
      for (const projectGroup of groups) {
        projects.appendChild(renderProjectSummary(projectGroup, options.onNavigate));
      }
    }
    container.appendChild(projects);
  }

  async function loadProjectIssues(projectNames) {
    const results = await Promise.all(
      projectNames.map((name) =>
        fetchProjectIssues(name, options.fetchImpl)
          .then((issues) => ({ name, issues }))
          .catch(() => ({ name, issues: [] }))
      )
    );
    for (const { name, issues } of results) state.projectIssues[name] = issues;
    render();
  }

  async function refresh() {
    state.error = null;
    try {
      // The one and only call site of fetchInboxData()/`/api/inbox` in this
      // module (TC-018 step 1). `mount()` below calls this exactly once;
      // a caller wanting a fresh copy has to call `refresh()` itself,
      // deliberately — this module never re-polls behind its back.
      const [data, roles, projects] = await Promise.all([
        fetchInboxData(options.fetchImpl),
        fetchRoles(options.fetchImpl),
        fetchProjects(options.fetchImpl),
      ]);
      state.data = data;
      state.roles = roles;
      state.projects = projects;
      render();
      // Fanned out after the initial render, same as launcher.js — the
      // project-selector dropdown's own classification needs these, but
      // the screen itself paints immediately rather than blocking on N
      // extra requests.
      await loadProjectIssues(projects.map((p) => p.name));
      return;
    } catch (err) {
      state.error = err;
    }
    render();
  }

  render(); // paint "Загрузка…" immediately, before the fetch resolves
  const ready = refresh();

  return {
    refresh,
    getState: () => ({ ...state }),
    ready,
  };
}
