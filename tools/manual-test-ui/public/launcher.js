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
//   .role-switch  — role picker, persisted to localStorage under `pf.role`,
//                   read by level 2 as its default (AC-01a: "role is picked
//                   right here").
//   .inbox-card   — the single global inbox entry point (AC-04d), click ->
//                   `#/inbox`.
//   .project-grid — project cards from the existing `GET /api/projects`
//                   (response shape unchanged — specs.md §2.1).
//
// Two pure functions are exported separately from DOM rendering, mirroring
// the split `public/inbox.js` already uses for its view-model builders:
//   resolveLandingRoute()   — TC-004, gives <=2 clicks project -> document.
//   formatInboxCardLabel()  — TC-019, the `.inbox-card` label text.

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
// (storage unavailable or full just means navigation/role choice doesn't
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

export function readStoredRole(storage) {
  const store = safeStorage(storage);
  if (!store) return null;
  try {
    return store.getItem(ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeRole(roleId, storage) {
  const store = safeStorage(storage);
  if (!store) return;
  try {
    store.setItem(ROLE_STORAGE_KEY, roleId);
  } catch {
    /* storage unavailable or full — role choice just won't persist */
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

async function fetchInboxTotal(fetchImpl) {
  const data = await fetchJson("/api/inbox", fetchImpl);
  if (typeof data.totalCount === "number") return data.totalCount;
  const manualTests = Array.isArray(data.manualTests) ? data.manualTests.length : 0;
  const humanTasks = Array.isArray(data.humanTasks) ? data.humanTasks.length : 0;
  return manualTests + humanTasks;
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

function renderRoleSwitch(state, onSelectRole) {
  const wrap = h("div", "role-switch");
  for (const role of state.roles) {
    const active = role.id === state.roleId;
    const btn = h("button", `role-btn${active ? " active" : ""}`, role.title);
    btn.type = "button";
    btn.dataset.roleId = role.id;
    btn.title = role.description || "";
    btn.setAttribute("aria-pressed", String(active));
    btn.addEventListener("click", () => onSelectRole(role.id));
    wrap.appendChild(btn);
  }
  return wrap;
}

function renderInboxCard(state, onOpenInbox) {
  const card = h("a", "inbox-card");
  card.href = "#/inbox";
  const count = state.inboxTotal === null ? null : state.inboxTotal;
  card.appendChild(h("span", "inbox-card-label", formatInboxCardLabel(count === null ? 0 : count)));
  card.addEventListener("click", (event) => {
    event.preventDefault();
    onOpenInbox();
  });
  return card;
}

function renderProjectGrid(state, onOpenProject) {
  const grid = h("div", "project-grid");
  if (!state.projects || state.projects.length === 0) {
    grid.appendChild(h("p", "muted", state.projects === null ? "Загрузка…" : "Нет настроенных проектов."));
    return grid;
  }
  for (const project of state.projects) {
    const card = h("a", "project-card");
    const route = resolveLandingRoute(project.name, state.lastIssueByProject);
    card.href = route;
    card.dataset.project = project.name;
    card.appendChild(h("div", "project-card-name", project.name));
    card.appendChild(h("div", "project-card-meta", `${project.issueCount} issue`));
    if (project.currentBranch) card.title = `checked out: ${project.currentBranch}`;
    card.addEventListener("click", (event) => {
      event.preventDefault();
      onOpenProject(project.name);
    });
    grid.appendChild(card);
  }
  return grid;
}

/**
 * Mount the launcher screen into `container` (an already-attached DOM node,
 * never `document.body` itself — matches every other screen in this tool).
 *
 * @param {Element} container
 * @param {{fetchImpl?: typeof fetch, storage?: Storage,
 *   onNavigate?: (hash: string) => void, initialRole?: string}} [options]
 * @returns {{refresh: () => Promise<void>, getState: () => object, ready: Promise<void>}}
 */
export function mount(container, options = {}) {
  const state = {
    roles: [],
    roleId: options.initialRole || readStoredRole(options.storage) || null,
    projects: null,
    lastIssueByProject: {},
    inboxTotal: null,
    error: null,
  };

  function navigate(hash) {
    if (typeof options.onNavigate === "function") {
      options.onNavigate(hash);
      return;
    }
    if (typeof location !== "undefined") location.hash = hash;
  }

  function selectRole(roleId) {
    if (state.roleId === roleId) return;
    state.roleId = roleId;
    storeRole(roleId, options.storage);
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

    if (state.error) {
      container.appendChild(h("p", "notice error", `Не удалось загрузить лаунчер: ${state.error.message}`));
      return;
    }

    const root = h("div", "launcher");
    root.appendChild(renderRoleSwitch(state, selectRole));
    root.appendChild(renderInboxCard(state, openInbox));
    root.appendChild(renderProjectGrid(state, openProject));
    container.appendChild(root);
  }

  async function refresh() {
    state.error = null;
    try {
      const [roles, projects, inboxTotal] = await Promise.all([
        fetchRoles(options.fetchImpl),
        fetchProjects(options.fetchImpl),
        fetchInboxTotal(options.fetchImpl),
      ]);
      state.roles = roles;
      if (!state.roleId && roles.length) state.roleId = roles[0].id;
      state.projects = projects;
      state.lastIssueByProject = readLastIssueByProject(
        projects.map((p) => p.name),
        options.storage
      );
      state.inboxTotal = inboxTotal;
    } catch (err) {
      state.error = err;
    }
    render();
  }

  render(); // paint immediately (role switch may already have a stored role)
  const ready = refresh();

  return {
    refresh,
    getState: () => ({ ...state }),
    ready,
  };
}
