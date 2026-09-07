"use strict";

// public/launcher.js — the level-1 launcher screen (specs.md §2.1, AC-01a,
// AC-04d, implementation_plan.md Task 23).
//
// Native ES module (`export`/`import`) — same client-side convention as
// `public/inbox.js` (specs.md §2.3), not the UMD wrapper `lib/*.js` uses for
// dual Node/browser loading. Runs only in a browser, or is exercised from
// Node's test runner via dynamic `import()` (the pattern test_plan.md
// TC-019/TC-004 document for this file).
//
// One module, three blocks, per specs.md's wireframe:
//   .role-switch  — now a **multi-select filter** (dogfooding round 2), not
//                   a single-role picker: 0, 1, or several roles at once.
//                   Empty selection = unfiltered (show everything) — the
//                   default on first visit too, replacing "auto-pick the
//                   first role". Persisted to localStorage under `pf.role`
//                   as a JSON array (`'["tester","developer"]'`), read by
//                   level 2 as its own default.
//   .inbox-card   — the single global inbox entry point (AC-04d), click ->
//                   `#/inbox`.
//   .project-grid — now three labeled sections (dogfooding round 2,
//                   replacing the bare "N требует внимания", which was
//                   both wrong — see attention.js's own history — and
//                   uninformative even when correct): "Есть открытые
//                   issue" (lists them, with stage + link — not a count),
//                   "Есть проблемы с документами" (names the specific
//                   problem), "Не требующие внимания" (name only).
//                   Priority order, first match wins per project
//                   (`status.js`'s `projectCategory`).
//
// Two pure functions are exported separately from DOM rendering, mirroring
// the split `public/inbox.js` already uses for its view-model builders:
//   resolveLandingRoute()   — TC-004, gives <=2 clicks project -> document.
//   formatInboxCardLabel()  — TC-019, the `.inbox-card` label text.

import { renderProjectSections } from "./project-picker.js";
import { totalAttentionForRoles } from "./attention.js";

export const ROLE_STORAGE_KEY = "pf.role";

function lastIssueStorageKey(project) {
  return `pf.lastIssue.${project}`;
}

// ---------------------------------------------------------------------------
// Pure functions (TC-004, TC-019) — kept free of DOM/localStorage/fetch so
// they're callable from a plain Node test via dynamic `import()`.
// ---------------------------------------------------------------------------

/**
 * Where a click on project `project`'s card should land (specs.md §2.1/§2.3,
 * AC-01e): straight to that project's last-active issue when one is known,
 * else the project's issue list. `lastIssueByProject` is a plain
 * `{[project]: issueId}` map — the caller builds it from `localStorage`
 * (`pf.lastIssue.<project>`), this function never touches storage itself.
 *
 * @param {string} project
 * @param {Object<string, string>} lastIssueByProject
 * @returns {string} the resulting hash — `#/p/<project>/i/<issue>` or `#/p/<project>`
 */
export function resolveLandingRoute(project, lastIssueByProject) {
  const issueId = lastIssueByProject && lastIssueByProject[project];
  if (issueId) {
    return `#/p/${encodeURIComponent(project)}/i/${encodeURIComponent(issueId)}`;
  }
  return `#/p/${encodeURIComponent(project)}`;
}

/**
 * The `.inbox-card` label text (specs.md §2.1 example: "Инбокс — все
 * проекты, 7 дел"). Always carries an explicit count — including zero
 * ("0 дел") — never a placeholder with no number (TC-019 step 2).
 *
 * @param {number} totalCount
 * @returns {string}
 */
export function formatInboxCardLabel(totalCount) {
  const n = Number.isFinite(totalCount) ? Math.max(0, Math.trunc(totalCount)) : 0;
  return `Инбокс — все проекты, ${n} дел`;
}

// ---------------------------------------------------------------------------
// localStorage helpers — best-effort, mirroring app.js's existing pattern
// (storage unavailable or full just means the filter/navigation doesn't
// persist, it still works for the current visit).
// ---------------------------------------------------------------------------

function safeStorage(storage) {
  if (storage) return storage;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * The multi-select role filter's persisted selection — a JSON array of
 * role ids (`'["tester","developer"]'`), replacing the single-string
 * format the single-select switcher used. Malformed/legacy-format content
 * (e.g. a leftover bare `"tester"` string from before this change) parses
 * to `[]` rather than throwing — the same safe "falls back to unfiltered"
 * behavior a missing key already had.
 *
 * @param {Storage} [storage]
 * @returns {string[]}
 */
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

// `{[project]: issueId}` built from `pf.lastIssue.<project>` entries, one
// lookup per known project name (specs.md §2.1) — never a full-storage scan,
// so it works the same whether localStorage holds one entry or many
// unrelated keys.
export function readLastIssueByProject(projectNames, storage) {
  const store = safeStorage(storage);
  const map = {};
  if (!store) return map;
  for (const name of projectNames || []) {
    try {
      const value = store.getItem(lastIssueStorageKey(name));
      if (value) map[name] = value;
    } catch {
      /* ignore — that project just won't have a remembered issue */
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Data — one fetch per block, each independently overridable for tests.
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

async function fetchInbox(fetchImpl) {
  const data = await fetchJson("/api/inbox", fetchImpl);
  const manualTests = Array.isArray(data.manualTests) ? data.manualTests : [];
  const humanTasks = Array.isArray(data.humanTasks) ? data.humanTasks : [];
  const totalCount = typeof data.totalCount === "number" ? data.totalCount : manualTests.length + humanTasks.length;
  return { manualTests, humanTasks, totalCount };
}

async function fetchProjectIssues(projectName, fetchImpl) {
  const data = await fetchJson(`/api/projects/${encodeURIComponent(projectName)}/issues`, fetchImpl);
  return Array.isArray(data.issues) ? data.issues : [];
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

function renderInboxCard(state, onOpenInbox) {
  const card = h("a", "inbox-card");
  card.href = "#/inbox";
  // Role-filtered, same as the project sections (dogfooding fix: this
  // count used to ignore the filter entirely, always showing the raw
  // unfiltered total).
  const count = state.inbox ? totalAttentionForRoles(state.inbox, state.roleIds) : 0;
  card.appendChild(h("span", "inbox-card-label", formatInboxCardLabel(count)));
  card.addEventListener("click", (event) => {
    event.preventDefault();
    onOpenInbox();
  });
  return card;
}

function renderLauncherProjectSections(state, onOpenProject) {
  return renderProjectSections({
    projects: state.projects,
    projectIssuesByName: state.projectIssues,
    roleIds: state.roleIds,
    inbox: state.inbox,
    hrefFor: (name) => resolveLandingRoute(name, state.lastIssueByProject),
    onOpenProject,
  });
}

/**
 * Mount the launcher screen into `container` (an already-attached DOM node,
 * never `document.body` itself — matches every other screen in this tool).
 *
 * @param {Element} container
 * @param {{fetchImpl?: typeof fetch, storage?: Storage,
 *   onNavigate?: (hash: string) => void, initialRoles?: string[]}} [options]
 * @returns {{refresh: () => Promise<void>, getState: () => object, ready: Promise<void>}}
 */
export function mount(container, options = {}) {
  const state = {
    roles: [],
    roleIds: Array.isArray(options.initialRoles) ? options.initialRoles : readStoredRoles(options.storage),
    projects: null,
    projectIssues: {},
    lastIssueByProject: {},
    inbox: null,
    error: null,
  };

  function navigate(hash) {
    if (typeof options.onNavigate === "function") {
      options.onNavigate(hash);
      return;
    }
    if (typeof location !== "undefined") location.hash = hash;
  }

  function toggleRole(roleId) {
    state.roleIds = state.roleIds.includes(roleId) ? state.roleIds.filter((r) => r !== roleId) : [...state.roleIds, roleId];
    storeRoles(state.roleIds, options.storage);
    render();
  }

  function openProject(projectName) {
    navigate(resolveLandingRoute(projectName, state.lastIssueByProject));
  }

  function openInbox() {
    navigate("#/inbox");
  }

  function render() {
    container.innerHTML = "";
    if (typeof document !== "undefined") document.title = "Project Explorer";

    if (state.error) {
      container.appendChild(h("p", "notice error", `Не удалось загрузить лаунчер: ${state.error.message}`));
      return;
    }

    const root = h("div", "launcher");
    root.appendChild(renderRoleSwitch(state, toggleRole));
    root.appendChild(renderInboxCard(state, openInbox));
    root.appendChild(renderLauncherProjectSections(state, openProject));
    container.appendChild(root);
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
      const [roles, projects, inbox] = await Promise.all([
        fetchRoles(options.fetchImpl),
        fetchProjects(options.fetchImpl),
        fetchInbox(options.fetchImpl),
      ]);
      state.roles = roles;
      state.projects = projects;
      state.lastIssueByProject = readLastIssueByProject(
        projects.map((p) => p.name),
        options.storage
      );
      state.inbox = inbox;
      render();
      // Fanned out after the initial render so the page paints project
      // cards immediately (as "loading") rather than blocking on N extra
      // requests, one per configured project.
      await loadProjectIssues(projects.map((p) => p.name));
      return;
    } catch (err) {
      state.error = err;
    }
    render();
  }

  render(); // paint immediately (role filter may already be stored)
  const ready = refresh();

  return {
    refresh,
    getState: () => ({ ...state }),
    ready,
  };
}
