"use strict";

// public/project-inbox.js — `#/p/<project>` and `#/p/<project>/inbox`
// (dogfooding feedback point 7 on 20260806-feat-project-explorer-redesign,
// split into two screens in round 2's Task 61).
//
// specs.md §2.3 already described the project screen: "`#/p/<project>` —
// проект выбран, для него ещё нет записи `pf.lastIssue.<project>` —
// монтируется список issue этого проекта". The shipped code never actually
// built that screen — `workspace.js`'s `loadShell()` silently picked
// `issues[0]` and jumped straight into its workspace, so a user never saw a
// list at all, just an unexplained landing on whichever issue happened to
// come first (or, with zero issues, an indefinite "Загрузка…" —
// `code_review.md` CR-007).
//
// Round 2 dogfooding feedback split this one screen into two, both exported
// from this same module (sharing all data-fetching — one more route, not a
// fifth top-level file):
//   `mount()`      — the project screen: unified header, this project's
//                    issues in three sections (Открытые / Требуют внимания /
//                    Закрытые — a per-issue axis, distinct from the
//                    launcher's per-project 3-category classifier in
//                    status.js), and a COLLAPSED inbox summary card linking
//                    through to the dedicated inbox screen below — not the
//                    full per-issue breakdown inline (user: "как на главном
//                    экране").
//   `mountInbox()` — `#/p/<project>/inbox`: the dedicated inbox screen, the
//                    full `groupByIssue`/`renderIssueGroup` breakdown this
//                    project screen used to render inline.
//
// Native ES module — same convention as launcher.js/inbox.js/workspace.js.

import { attentionForRoles } from "./attention.js";
import { groupByIssue, renderIssueGroup, filterInboxItemsByRoles } from "./inbox.js";
import { STAGE_LABELS, issueStatusMessage } from "./status.js";
import { renderProjectSelector } from "./project-picker.js";

// Same well-known key launcher.js/inbox.js already write/read — not
// imported from either (each screen module stays mountable and testable on
// its own, the same reasoning launcher.js's own header comment gives).
export const ROLE_STORAGE_KEY = "pf.role";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

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

async function fetchIssues(project, fetchImpl) {
  const data = await fetchJson(`/api/projects/${encodeURIComponent(project)}/issues`, fetchImpl);
  return Array.isArray(data.issues) ? data.issues : [];
}

async function fetchProjectIssues(projectName, fetchImpl) {
  return fetchIssues(projectName, fetchImpl);
}

async function fetchInbox(fetchImpl) {
  const data = await fetchJson("/api/inbox", fetchImpl);
  return {
    manualTests: Array.isArray(data.manualTests) ? data.manualTests : [],
    humanTasks: Array.isArray(data.humanTasks) ? data.humanTasks : [],
  };
}

// ---------------------------------------------------------------------------
// localStorage — best-effort, same pattern as launcher.js/inbox.js.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Per-issue manual/human counts, role-filtered — `issueStatusMessage` needs
// the two kinds separate (different pluralized nouns), unlike
// `attentionForRoles`'s combined per-issue total. Built via `inbox.js`'s own
// `filterInboxItemsByRoles`, not a second copy of the role-matching rule.
// ---------------------------------------------------------------------------

function countsByIssue(inbox, project, roleIds) {
  const filtered = filterInboxItemsByRoles(inbox && inbox.manualTests, inbox && inbox.humanTasks, roleIds);
  const manual = new Map();
  const human = new Map();
  for (const item of filtered.manualTests) {
    if (item && item.project === project) manual.set(item.issueId, (manual.get(item.issueId) || 0) + 1);
  }
  for (const item of filtered.humanTasks) {
    if (item && item.project === project) human.set(item.issueId, (human.get(item.issueId) || 0) + 1);
  }
  return { manual, human };
}

// ---------------------------------------------------------------------------
// Project screen — three sections, a per-issue axis distinct from the
// launcher's per-project classifier (status.js's `projectCategory`).
// ---------------------------------------------------------------------------

const ISSUE_SECTION_TITLES = { open: "Открытые", attention: "Требуют внимания", closed: "Закрытые" };
const ISSUE_SECTION_ORDER = ["open", "attention", "closed"];

/**
 * @param {object[]} issues
 * @param {object|null} inbox
 * @param {string} project
 * @param {string[]} roleIds
 * @returns {{open: object[], attention: object[], closed: object[]}}
 */
export function classifyProjectIssues(issues, inbox, project, roleIds) {
  const { manual, human } = countsByIssue(inbox, project, roleIds);
  const bySection = { open: [], attention: [], closed: [] };
  for (const issue of Array.isArray(issues) ? issues : []) {
    const manualCount = manual.get(issue.issueId) || 0;
    const humanCount = human.get(issue.issueId) || 0;
    const message = issueStatusMessage(issue, manualCount, humanCount, roleIds);
    if (issue.status === "open") {
      bySection.open.push({ issue, message });
    } else if (message) {
      bySection.attention.push({ issue, message });
    } else {
      bySection.closed.push({ issue, message: null });
    }
  }
  return bySection;
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

  const back = h("a", "workspace-back", state.view === "inbox" ? `← ${state.project}` : "← Проекты");
  // Captured, not read back from `back.href`: a real browser's `href`
  // getter resolves to the *absolute* URL, not the relative hash string
  // just assigned (the same mistake `inbox.js`'s `renderProjectSummary`
  // made and fixed — see its own comment for the full story).
  const backTargetHash = state.view === "inbox" ? projectHrefFor(state.project) : "#/";
  back.href = backTargetHash;
  back.addEventListener("click", (event) => {
    if (!handlers.hasOnNavigate) return; // plain <a href> navigation still works without a router
    event.preventDefault();
    handlers.onNavigate(backTargetHash);
  });
  header.appendChild(back);

  header.appendChild(
    renderProjectSelector({
      triggerLabel: state.project || "",
      isOpen: state.projectSelectorOpen,
      onToggle: handlers.onToggleProjectSelector,
      projects: state.projects,
      projectIssuesByName: state.projectIssues,
      roleIds: state.roleIds,
      inbox: state.inbox,
      hrefFor: projectHrefFor,
      onOpenProject: handlers.onOpenProject,
    })
  );

  header.appendChild(renderRoleSwitch(state, handlers.onToggleRole));

  return header;
}

function renderStageStrip(stages) {
  const strip = h("div", "issue-stage-strip");
  const byKey = new Map((stages || []).map((s) => [s.key, s.done]));
  for (const [key, label] of STAGE_LABELS) {
    const done = byKey.get(key) === true;
    strip.appendChild(h("span", `issue-stage${done ? " issue-stage--done" : ""}`, label));
  }
  return strip;
}

function renderIssueCard(issue, message, onOpen) {
  const card = h("a", "issue-card");
  card.href = "#";
  card.dataset.issueId = issue.issueId;

  const titleRow = h("div", "issue-card-title-row");
  titleRow.appendChild(h("span", "issue-card-id", issue.issueId));
  if (issue.status === "closed") titleRow.appendChild(h("span", "badge", "closed"));
  card.appendChild(titleRow);

  if (issue.feature) card.appendChild(h("div", "issue-card-feature", issue.feature));
  card.appendChild(renderStageStrip(issue.stages));

  card.appendChild(h("div", "issue-card-attention", message || "Ничего не требует внимания"));

  card.addEventListener("click", (event) => {
    event.preventDefault();
    onOpen(issue.issueId);
  });
  return card;
}

function renderIssueSections(bySection, onOpenIssue) {
  const root = h("div", "project-sections");
  for (const key of ISSUE_SECTION_ORDER) {
    const items = bySection[key];
    if (items.length === 0) continue;
    const section = h("div", "project-section");
    section.appendChild(h("h2", "project-section-title", ISSUE_SECTION_TITLES[key]));
    const grid = h("div", "issue-card-grid");
    for (const { issue, message } of items) grid.appendChild(renderIssueCard(issue, message, onOpenIssue));
    section.appendChild(grid);
    root.appendChild(section);
  }
  return root;
}

// The project screen's collapsed inbox summary (user: "как на главном
// экране" — a card, not the full per-issue breakdown), linking through to
// the dedicated inbox screen. Reuses launcher.js's `.inbox-card`/
// `.inbox-card-label` classes — same role, same look, a different href.
function renderInboxSummaryCard(state, onOpenInbox) {
  const count = state.inbox ? attentionForRoles(state.inbox, state.project, state.roleIds).total : 0;
  const card = h("a", "inbox-card");
  card.href = `${projectHrefFor(state.project)}/inbox`;
  card.appendChild(h("span", "inbox-card-label", `Инбокс проекта — ${count} дел`));
  card.addEventListener("click", (event) => {
    event.preventDefault();
    onOpenInbox();
  });
  return card;
}

function renderProjectView(state, handlers) {
  const root = h("div", "project-inbox");
  root.appendChild(renderHeader(state, handlers));

  if (!state.issues) {
    root.appendChild(h("p", "muted", "Загрузка…"));
    return root;
  }

  root.appendChild(renderInboxSummaryCard(state, handlers.onOpenInbox));

  const bySection = classifyProjectIssues(state.issues, state.inbox, state.project, state.roleIds);
  if (state.issues.length === 0) {
    root.appendChild(h("p", "inbox-empty", "В этом проекте пока нет issue."));
  } else {
    root.appendChild(renderIssueSections(bySection, handlers.onOpenIssue));
  }

  return root;
}

function renderInboxView(state, handlers) {
  const root = h("div", "project-inbox");
  root.appendChild(renderHeader(state, handlers));

  const section = h("div", "project-inbox-section");
  section.appendChild(h("h2", null, `Инбокс проекта: ${state.project}`));

  if (!state.inbox) {
    section.appendChild(h("p", "muted", "Загрузка…"));
    root.appendChild(section);
    return root;
  }

  const filtered = filterInboxItemsByRoles(state.inbox.manualTests, state.inbox.humanTasks, state.roleIds);
  const manualTests = filtered.manualTests.filter((i) => i.project === state.project);
  const humanTasks = filtered.humanTasks.filter((i) => i.project === state.project);
  const groups = groupByIssue(manualTests, humanTasks);
  if (groups.length === 0) {
    section.appendChild(h("p", "inbox-empty", "Нет дел для этого проекта."));
  } else {
    for (const group of groups) {
      section.appendChild(
        renderIssueGroup(group.issueId, group.manualTests, group.humanTasks, handlers.onNavigate, `issue-${group.issueId}`)
      );
    }
  }
  root.appendChild(section);
  return root;
}

// `options.initialIssueId` (`?issue=<id>`, set by the global inbox's per-
// project issue summary table — see `inbox.js`) scrolls to that issue's own
// group once the inbox screen has actually rendered. Best-effort, same
// pattern `workspace.js`'s `maybeScrollToPtcId` already uses — a no-op
// under the fake DOM `node --test` uses (no `querySelector`), a real jump
// in a browser.
function maybeScrollToIssue(container, issueId) {
  if (!issueId || !container || typeof container.querySelector !== "function") return;
  let el = null;
  try {
    el = container.querySelector(`#issue-${CSS.escape(String(issueId))}`);
  } catch {
    return;
  }
  if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "start" });
}

/**
 * Mount either the project screen (`view: "project"`, the default) or the
 * dedicated project-inbox screen (`view: "inbox"`) into `container`. Shared
 * by both exported entry points below — same data-fetching, same header,
 * different body.
 *
 * @param {Element} container
 * @param {{project: string, fetchImpl?: typeof fetch, storage?: Storage,
 *   onNavigate?: (target: object|string) => void, initialRoles?: string[],
 *   initialIssueId?: string}} options
 * @param {"project"|"inbox"} view
 * @returns {{refresh: () => Promise<void>, getState: () => object, ready: Promise<void>}}
 */
function mountShared(container, options, view) {
  const state = {
    container,
    project: options.project || null,
    view,
    roles: [],
    roleIds: Array.isArray(options.initialRoles) ? options.initialRoles : readStoredRoles(options.storage),
    projects: null,
    projectIssues: {},
    projectSelectorOpen: false,
    issues: null,
    inbox: null,
    error: null,
  };

  function navigate(target) {
    if (typeof options.onNavigate === "function") options.onNavigate(target);
    // No `location.hash` fallback here, deliberately — same invariant
    // inbox.js's own header keeps: every clickable element this screen
    // renders already carries a real `href`.
  }

  function openIssue(issueId) {
    navigate(`#/p/${encodeURIComponent(state.project)}/i/${encodeURIComponent(issueId)}`);
  }

  function openInbox() {
    state.projectSelectorOpen = false;
    navigate(`${projectHrefFor(state.project)}/inbox`);
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
    onOpenIssue: openIssue,
    onOpenInbox: openInbox,
  };

  function render() {
    container.innerHTML = "";
    if (typeof document !== "undefined") {
      document.title =
        state.view === "inbox" ? `${state.project}: инбокс | Project Explorer` : `${state.project} | Project Explorer`;
    }

    if (state.error) {
      container.appendChild(h("p", "notice error", `Не удалось загрузить проект: ${state.error.message}`));
      return;
    }

    container.appendChild(state.view === "inbox" ? renderInboxView(state, handlers) : renderProjectView(state, handlers));
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

  let initialIssueIdConsumed = false;
  async function refresh() {
    state.error = null;
    try {
      const [roles, issues, inbox, projects] = await Promise.all([
        fetchRoles(options.fetchImpl),
        state.project ? fetchIssues(state.project, options.fetchImpl) : Promise.resolve([]),
        fetchInbox(options.fetchImpl),
        fetchProjects(options.fetchImpl),
      ]);
      state.roles = roles;
      state.issues = issues;
      state.inbox = inbox;
      state.projects = projects;
      if (state.project) state.projectIssues[state.project] = issues; // already fetched, no need to refetch for the dropdown
      render();
      await loadProjectIssues(projects.map((p) => p.name).filter((name) => name !== state.project));
    } catch (err) {
      state.error = err;
      render();
    }
    if (!initialIssueIdConsumed) {
      initialIssueIdConsumed = true; // one-shot regardless of whether the group was actually found
      maybeScrollToIssue(container, options.initialIssueId);
    }
  }

  render(); // paint immediately (role filter may already be stored)
  const ready = refresh();

  return {
    refresh,
    getState: () => ({ ...state }),
    ready,
  };
}

/** The project screen: unified header, sectioned issues, collapsed inbox summary+link. */
export function mount(container, options = {}) {
  return mountShared(container, options, "project");
}

/** The dedicated project-inbox screen (`#/p/<project>/inbox`): unified header, full per-issue breakdown. */
export function mountInbox(container, options = {}) {
  return mountShared(container, options, "inbox");
}
