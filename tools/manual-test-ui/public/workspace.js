"use strict";

// public/workspace.js — level-2 workspace screen (this issue's tech spec
// §2.2, AC-01b/AC-01c/AC-01d/AC-01e, implementation_plan.md Task 24).
//
// Native ES module (`export`/`import`) — the same client-side convention
// `public/inbox.js`/`public/launcher.js` already use (tech spec §2.3), not
// the UMD wrapper `lib/*.js` uses for dual Node/browser loading. This file
// only ever runs in a browser, or is exercised from Node's test runner via
// dynamic `import()` (the pattern test_plan.md TC-003 documents for this
// exact file).
//
// Scope of this task (test_plan.md TC-002/TC-003):
//   * `.workspace-header` — "← Проекты" back link (level 1), an `[Issue ▾]`
//     dropdown of the current project's issues (replaces the old
//     `#issue-list` sidebar list), and a `[Роль ▾]` dropdown — the same role
//     switcher level 1 has. There is no persistent `.sidebar` container at
//     all (AC-01b) — everything here lives in one header row.
//   * `.doc-tabs` — built from the current role's own `GET .../roles/:role`
//     response (`buildRoleContents`, server.js) for the *current* role only.
//     No document name is ever written down in this file as a literal list
//     — the tab set is always whatever the server just answered, plus one
//     client-added "Дела" tab (see below). `lib/roles.js` needs no changes:
//     the data source is unchanged, only the visual container is (tabs
//     instead of three sidebar lists).
//   * `resolveActiveTab(prevTabId, docsOfNewIssue)` — the pure function that
//     keeps the active document tab when `[Issue ▾]` changes, even into a
//     `missing` document (fixes a P0 `/pf-check` finding: switching issue
//     must never silently switch documents). This rule is scoped to one
//     role — switching `[Роль ▾]` always takes a fresh tab set instead, and
//     never goes through this function.
//
// "Дела" (human tasks) is a new tab in every role's tab set, present from
// Task 24 onward so later tasks have somewhere to attach to: its counter
// logic (`countProjectTodos`, exported below) is Task 25's job — done in
// this file — and the richer content of `manual_test_checklist.md`'s
// `looseSections` block is Task 26's job. This file's tab-set model already
// has room for both — it is not a fixed list of document tabs only.

// Same storage key `public/launcher.js` writes on level 1 (tech spec §2.1:
// "role switch on the launcher stores its choice in localStorage (`pf.role`),
// passed to level 2 as the default"). Not imported from launcher.js — that
// module is written by a separate, concurrently-running task and this one
// has to stay mountable/testable on its own either way — so the key is
// simply the same well-known string, not a shared implementation.
export const ROLE_STORAGE_KEY = "pf.role";

function lastIssueStorageKey(project) {
  return `pf.lastIssue.${project}`;
}

// The client-added tab id for "Дела" — deliberately the same string
// `public/inbox.js`'s `humanTaskItemView()` already uses for `where.tab`
// (its click target), so a human-task item landing on this screen and this
// screen's own tab selection agree on one id for the same place.
export const HUMAN_TASKS_TAB_ID = "human-tasks";

// ---------------------------------------------------------------------------
// Pure functions — tab-set construction and the "keep the tab" rule. Kept
// free of DOM/fetch/localStorage so they're callable and assertable from a
// plain Node test via dynamic `import()` (test_plan.md TC-003's Preconditions).
// ---------------------------------------------------------------------------

// A doc tab's id AND label: the server's own `item.name`/`item.id` with a
// trailing ".md" dropped (tech spec §2.2's wireframe shows
// "test_plan │ manual_test_checklist │ qa_report", not the ".md"-suffixed
// form) — computed from whatever the response says, never from a name
// written down here. This stripped form is the tab's one canonical id
// (`resolveActiveTab`'s `prevTabId`/`selectTab`'s `tabId` are always this
// shape, e.g. "brd", never "brd.md") — one identity, not a raw-id/label pair
// that could disagree.
function tabIdFor(item) {
  const name = String(item.name || item.id || "");
  return name.endsWith(".md") ? name.slice(0, -3) : name;
}

/**
 * The full `.doc-tabs` tab set for one role's contents: one tab per entry of
 * `roleContents.items` (in the order the server sent them), plus exactly one
 * client-added "Дела" tab at the end. Never reads a document name from a
 * constant in this file — every doc tab's id/label/state comes straight from
 * `roleContents.items` (test_plan.md TC-002 step 4).
 *
 * @param {{items?: Array<{id: string, name?: string, label?: string}>}|null} roleContents
 *   A `GET .../issues/:id/roles/:role` response (`buildRoleContents`), or
 *   anything shaped like one.
 * @returns {Array<{id: string, kind: "doc"|"human-tasks", label: string, item: object|null}>}
 */
export function buildTabSet(roleContents) {
  const items = roleContents && Array.isArray(roleContents.items) ? roleContents.items : [];
  const tabs = items.map((item) => ({
    id: tabIdFor(item),
    kind: "doc",
    label: tabIdFor(item),
    item,
  }));
  tabs.push({
    id: HUMAN_TASKS_TAB_ID,
    kind: "human-tasks",
    // Counter suffix (tech spec §2.2's "Дела ③") is Task 25's job
    // (`countProjectTodos`) — this task only reserves the tab itself.
    label: "Дела",
    item: null,
  });
  return tabs;
}

/**
 * Which tab stays active when `[Issue ▾]` switches to a different issue,
 * *within the same role* (tech spec §2.2, the P0 fix). The rule is the same
 * whether the document exists for the new issue or not: a document tab that
 * was active stays active — a `missing`/`not_applicable` document renders in
 * that state rather than silently switching the reader to a different
 * document. Only when `prevTabId` names a tab that the new tab set does not
 * have at all (not supposed to happen switching issue within one role, since
 * `lib/roles.js` partitions items by role, not by issue) does this fall back
 * to the first tab — never to nothing.
 *
 * Switching `[Роль ▾]` does **not** go through this function at all: a role
 * switch takes a wholly fresh tab set (`buildTabSet` of the new role's own
 * response), because a role's tab set is a different set of documents by
 * construction, not a continuation of the previous one.
 *
 * @param {string|null} prevTabId — the tab id that was active before the issue changed.
 * @param {object|null} docsOfNewIssue — the new issue's `GET .../roles/:role`
 *   response, for the *same* role the reader was already on.
 * @returns {string|null}
 */
export function resolveActiveTab(prevTabId, docsOfNewIssue) {
  const tabs = buildTabSet(docsOfNewIssue);
  if (prevTabId && tabs.some((t) => t.id === prevTabId)) return prevTabId;
  return tabs.length ? tabs[0].id : null;
}

/**
 * The "Дела" tab's counter (specs.md §3.4, US-06, AC-06a/AC-06b, TC-029):
 * the sum of unclosed todos across ALL roles and ALL open issues of one
 * project — never scoped to the currently-selected issue/role. An earlier
 * draft of specs.md §2.2 scoped this to "all roles of *this* issue"; §3.4
 * corrected that to project-wide during `/pf-check`, and this function is
 * that corrected computation.
 *
 * Deliberately takes NO role parameter — that absence is the structural
 * half of AC-06b (TC-029 step 2): a function that cannot see the role
 * cannot make the counter depend on it, so switching `[Роль ▾]` is
 * physically incapable of changing the result. Neither `manualTests[]` nor
 * `humanTasks[]` carries a "role" field at all (a manual TC is always the
 * tester's business by construction; a human task is tied to `stageKey`,
 * not to a viewing role) — filtering by project alone already yields the
 * "across all roles" sum, no separate role-union step needed.
 *
 * @param {{manualTests?: Array<{project?: string}>, humanTasks?: Array<{project?: string}>}|null} inboxResponse
 *   A `GET /api/inbox` response (`server.js`, `lib/inbox.js`'s
 *   `collectManualTests`/`collectHumanTasks`) — the same one
 *   `public/inbox.js`'s global inbox screen fetches, reused here rather
 *   than refetched (see `fetchInbox`/`mount()` below).
 * @param {string} projectName
 * @returns {number}
 */
export function countProjectTodos(inboxResponse, projectName) {
  if (!inboxResponse || !projectName) return 0;
  const manualTests = Array.isArray(inboxResponse.manualTests) ? inboxResponse.manualTests : [];
  const humanTasks = Array.isArray(inboxResponse.humanTasks) ? inboxResponse.humanTasks : [];
  const countOf = (items) => items.filter((item) => item && item.project === projectName).length;
  return countOf(manualTests) + countOf(humanTasks);
}

// ---------------------------------------------------------------------------
// localStorage helpers — best effort, mirroring the pattern this issue's
// other new screens already use: storage unavailable or full just means a
// choice doesn't persist across reloads, navigation still works either way.
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

function storeLastIssue(project, issueId, storage) {
  const store = safeStorage(storage);
  if (!store || !project || !issueId) return;
  try {
    store.setItem(lastIssueStorageKey(project), issueId);
  } catch {
    /* storage unavailable or full — last-issue memory just won't persist */
  }
}

// ---------------------------------------------------------------------------
// Data — one call site per endpoint, each independently overridable for tests.
// ---------------------------------------------------------------------------

async function fetchJson(pathname, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(pathname);
  if (!res.ok) {
    throw new Error(`GET ${pathname} failed: ${res.status}${res.statusText ? " " + res.statusText : ""}`);
  }
  return res.json();
}

function projectBase(project) {
  return `/api/projects/${encodeURIComponent(project)}`;
}

function issueBase(project, issueId) {
  return `${projectBase(project)}/issues/${encodeURIComponent(issueId)}`;
}

async function fetchRoles(fetchImpl) {
  const data = await fetchJson("/api/roles", fetchImpl);
  return data.roles || [];
}

async function fetchIssues(project, fetchImpl) {
  const data = await fetchJson(`${projectBase(project)}/issues`, fetchImpl);
  return (data && data.issues) || [];
}

// The single call site of `GET .../issues/:id/roles/:role` in this module
// (test_plan.md TC-002 step 2/3) — every doc tab and its state comes from
// this one response, for whichever (issue, role) pair is currently selected.
async function fetchRoleContents(project, issueId, roleId, fetchImpl) {
  return fetchJson(`${issueBase(project, issueId)}/roles/${encodeURIComponent(roleId)}`, fetchImpl);
}

// GET /api/inbox — the same project-independent endpoint
// `public/inbox.js`'s global inbox screen calls (specs.md §3.4). Its own
// URL carries no project/issue/role — `mount()` below fetches it exactly
// once per mount (`fetchInboxOnce`) and reuses the response for
// `countProjectTodos` across every `[Роль ▾]`/`[Issue ▾]` switch (AC-06b,
// TC-029 step 4).
async function fetchInbox(fetchImpl) {
  return fetchJson("/api/inbox", fetchImpl);
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

function renderHeader(state, handlers) {
  const header = h("header", "workspace-header");

  const back = h("a", "workspace-back", "← Проекты");
  back.href = "#/";
  back.addEventListener("click", (event) => {
    event.preventDefault();
    handlers.onBack();
  });
  header.appendChild(back);

  header.appendChild(h("span", "workspace-project", state.project || ""));

  const issueField = h("label", "workspace-field workspace-field--issue");
  issueField.appendChild(h("span", "field-label", "Issue"));
  const issueSelect = document.createElement("select");
  issueSelect.className = "issue-select";
  issueSelect.setAttribute("aria-label", "Issue ▾");
  for (const issue of state.issues) {
    const opt = document.createElement("option");
    opt.value = issue.issueId;
    opt.textContent = issue.issueId;
    if (issue.issueId === state.issueId) opt.selected = true;
    issueSelect.appendChild(opt);
  }
  issueSelect.disabled = state.issues.length === 0;
  issueSelect.addEventListener("change", () => handlers.onSelectIssue(issueSelect.value));
  issueField.appendChild(issueSelect);
  header.appendChild(issueField);

  const roleField = h("label", "workspace-field workspace-field--role");
  roleField.appendChild(h("span", "field-label", "Роль"));
  const roleSelect = document.createElement("select");
  roleSelect.className = "role-select";
  roleSelect.setAttribute("aria-label", "Роль ▾");
  for (const role of state.roles) {
    const opt = document.createElement("option");
    opt.value = role.id;
    opt.textContent = role.title;
    if (role.id === state.roleId) opt.selected = true;
    roleSelect.appendChild(opt);
  }
  roleSelect.disabled = state.roles.length === 0;
  roleSelect.addEventListener("change", () => handlers.onSelectRole(roleSelect.value));
  roleField.appendChild(roleSelect);
  header.appendChild(roleField);

  return header;
}

function renderTabs(state, handlers) {
  const tabs = h("nav", "doc-tabs");
  tabs.setAttribute("aria-label", "Документы роли");
  for (const tab of state.tabs) {
    const active = tab.id === state.activeTabId;
    const btn = h("button", `doc-tab${active ? " doc-tab--active" : ""}`, tab.label);
    btn.type = "button";
    btn.dataset.tabId = tab.id;
    btn.dataset.tabKind = tab.kind;
    btn.setAttribute("aria-pressed", String(active));
    btn.addEventListener("click", () => handlers.onSelectTab(tab.id));
    tabs.appendChild(btn);
  }
  return tabs;
}

// The short status word next to a doc tab's title, straight from what the
// server already decided (`buildRoleContents`) — this module picks how to
// say it, not whether it is true.
function statusBadgeText(item) {
  if (!item) return null;
  if (item.status === "present") return item.location === "branch" ? "on branch" : null;
  if (item.status === "not_applicable") return "n/a";
  if (item.status === "missing") return "missing";
  return null;
}

// The active tab's content pane. Deliberately small for this task: a doc tab
// shows the server's own header fields plus, when the document is actually
// `present`, its fetched content; the "Дела" tab's counter is real as of
// Task 25 (`tab.label` already carries it — see `decorateHumanTasksTab` in
// `mount()`), its richer content is still Task 26's job. Kinds this screen
// does not yet have a dedicated pane for (`instructions`/`memory`/`action`)
// still show the server's own header fields, just without a richer body —
// none of that is in TC-002/TC-003's scope.
function renderDocPanel(tab, runtime) {
  const panel = h("div", "doc-panel");
  panel.dataset.tabId = tab.id;

  if (tab.kind === "human-tasks") {
    panel.appendChild(h("h2", null, tab.label));
    panel.appendChild(h("p", "muted", "Содержимое этой вкладки появится отдельной задачей."));
    return panel;
  }

  const item = tab.item;
  if (!item) {
    panel.appendChild(h("p", "muted", "Нет данных."));
    return panel;
  }

  const titleRow = h("div", "doc-title-row");
  titleRow.appendChild(h("h2", null, item.label || item.name || item.id));
  const badgeText = statusBadgeText(item);
  if (badgeText) titleRow.appendChild(h("span", "badge", badgeText));
  panel.appendChild(titleRow);

  if (item.name) panel.appendChild(h("code", "doc-path", item.name));
  if (item.description) panel.appendChild(h("p", "doc-description", item.description));
  if (item.message) panel.appendChild(h("p", "notice", item.message));

  const readableKind = item.kind === "issue_doc" || item.kind === "project_doc";
  if (readableKind && item.status === "present" && item.endpoint) {
    const body = h("div", "md-body");
    body.appendChild(h("p", "muted", "Загрузка…"));
    panel.appendChild(body);

    // Guarded by the *endpoint*, not `tab.id`: tab ids are the role's
    // document names stripped of ".md" (`tabIdFor`), which are the same
    // string across different issues within one role by design (that is
    // what makes `resolveActiveTab` able to "keep the tab" across an issue
    // switch) — so `tab.id` alone cannot tell issue A's in-flight fetch from
    // issue B's. `item.endpoint` encodes project+issue+path, so it always
    // can. `runtime.fetchDoc` also dedupes repeat renders of the same
    // endpoint (an issue switch calls `render()` twice — see `selectIssue`).
    const endpoint = item.endpoint;
    runtime
      .fetchDoc(endpoint)
      .then((data) => {
        if (runtime.getActiveEndpoint() !== endpoint) return; // reader moved on while it loaded
        body.innerHTML = "";
        const text = data && typeof data.content === "string" ? data.content : "";
        if (!text.trim()) {
          body.appendChild(h("p", "muted", "This document is empty."));
        } else if (typeof window !== "undefined" && window.PFMarkdown) {
          body.innerHTML = window.PFMarkdown.render(text);
        } else {
          body.textContent = text;
        }
      })
      .catch((err) => {
        if (runtime.getActiveEndpoint() !== endpoint) return;
        body.innerHTML = "";
        body.appendChild(h("p", "notice error", err.message));
      });
  }

  return panel;
}

/**
 * Mount the level-2 workspace screen into `container` (an already-attached
 * DOM node — this module never inserts itself into `document.body`, matching
 * every other screen in this tool).
 *
 * `options.roleId` is intentionally not required: `public/app.js`'s router
 * only ever hands this screen `{project, issueId, onNavigate}` (the role is
 * this screen's own concern, exactly like on the launcher), so the initial
 * role comes from `options.initialRole`, then `localStorage`'s `pf.role`,
 * then the first role the server lists — the same fallback chain
 * `public/launcher.js` uses.
 *
 * @param {Element} container
 * @param {{project: string, issueId?: string|null, initialRole?: string,
 *   fetchImpl?: typeof fetch, storage?: Storage,
 *   onNavigate?: (hash: string) => void}} options
 * @returns {{selectIssue: (issueId: string) => Promise<void>,
 *   selectRole: (roleId: string) => Promise<void>,
 *   selectTab: (tabId: string) => void,
 *   refresh: () => Promise<void>, getState: () => object, ready: Promise<void>}}
 */
export function mount(container, options = {}) {
  const state = {
    project: options.project || null,
    issueId: options.issueId || null,
    roleId: options.initialRole || readStoredRole(options.storage) || null,
    roles: [],
    issues: [],
    tabs: [],
    activeTabId: null,
    error: null,
    // The "Дела" tab's project-wide counter (`countProjectTodos`, AC-06a) —
    // `null` until `/api/inbox` first resolves, then a number for the rest
    // of this mount's lifetime (a project never changes within one mount).
    projectTodoCount: null,
  };

  function navigate(hash) {
    if (typeof options.onNavigate === "function") {
      options.onNavigate(hash);
      return;
    }
    if (typeof location !== "undefined") location.hash = hash;
  }

  function onBack() {
    navigate("#/");
  }

  // Endpoint -> in-flight/resolved fetch, so re-rendering the same document
  // (an issue switch renders twice — see `selectIssue`) never issues a
  // second request for it, and so a document's own endpoint — not `tab.id`,
  // which is intentionally shared across issues — is what decides whether a
  // response arriving late is still the one the panel wants to paint.
  const docCache = new Map();
  function fetchDoc(endpoint) {
    if (!docCache.has(endpoint)) docCache.set(endpoint, fetchJson(endpoint, options.fetchImpl));
    return docCache.get(endpoint);
  }
  function activeEndpoint() {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    return tab && tab.item ? tab.item.endpoint : null;
  }

  // `/api/inbox` has exactly one call site in this whole module: this
  // memoized promise (AC-06b, TC-029 step 4). It is created at most once per
  // mount and never invalidated by `selectRole`/`selectIssue` — a project
  // never changes within one mount, and the endpoint carries no project/
  // issue/role of its own, so the first response is valid for the rest of
  // this mount's lifetime.
  let inboxPromise = null;
  function fetchInboxOnce() {
    if (!inboxPromise) inboxPromise = fetchInbox(options.fetchImpl);
    return inboxPromise;
  }

  // Bakes `state.projectTodoCount` into the "Дела" tab's own label (kept out
  // of `buildTabSet` itself, which stays a pure function of one role's
  // response and knows nothing of `/api/inbox`). Called every time
  // `state.tabs` is rebuilt, so a role/issue switch's fresh tab set still
  // carries the already-known count instead of losing it.
  function decorateHumanTasksTab() {
    const tab = state.tabs.find((t) => t.id === HUMAN_TASKS_TAB_ID);
    if (!tab) return;
    tab.label = state.projectTodoCount === null ? "Дела" : `Дела (${state.projectTodoCount})`;
  }

  // Fetches (once) and computes the project-wide "Дела" counter, independent
  // of `loadShell()`/`loadRoleContents()` — it does not need roles, issues
  // or role contents to resolve, only `state.project` (AC-06a/AC-06b).
  async function loadProjectTodoCount() {
    if (!state.project) return;
    try {
      const inboxResponse = await fetchInboxOnce();
      state.projectTodoCount = countProjectTodos(inboxResponse, state.project);
    } catch {
      state.projectTodoCount = null; // Дела tab just renders without a count
    }
    decorateHumanTasksTab();
    render();
  }

  function render() {
    container.innerHTML = "";

    if (state.error) {
      container.appendChild(h("p", "notice error", `Не удалось загрузить рабочее пространство: ${state.error.message}`));
      return;
    }

    const root = h("div", "workspace");
    root.appendChild(renderHeader(state, { onBack, onSelectIssue: selectIssue, onSelectRole: selectRole }));
    root.appendChild(renderTabs(state, { onSelectTab: selectTab }));

    const activeTab = state.tabs.find((t) => t.id === state.activeTabId) || null;
    if (activeTab) {
      root.appendChild(renderDocPanel(activeTab, { fetchDoc, getActiveEndpoint: activeEndpoint }));
    } else {
      root.appendChild(h("p", "muted", state.project ? "Загрузка…" : "Проект не выбран."));
    }

    container.appendChild(root);
  }

  // Re-fetches `.../roles/:role` for the current (project, issue, role) and
  // rebuilds `.doc-tabs` from that one response. `preserveActiveTab` decides
  // whether the previous tab id is carried through `resolveActiveTab()`
  // (an issue switch, within the same role) or dropped for a fresh first tab
  // (a role switch, or the very first load — no previous tab to keep).
  async function loadRoleContents(preserveActiveTab) {
    if (!state.project || !state.issueId || !state.roleId) {
      state.tabs = [];
      state.activeTabId = null;
      render();
      return;
    }
    const prevTabId = state.activeTabId;
    try {
      const contents = await fetchRoleContents(state.project, state.issueId, state.roleId, options.fetchImpl);
      state.tabs = buildTabSet(contents);
      decorateHumanTasksTab(); // carry the already-known project-wide count into the fresh tab set
      state.activeTabId = preserveActiveTab ? resolveActiveTab(prevTabId, contents) : state.tabs[0]?.id ?? null;
      state.error = null;
    } catch (err) {
      state.error = err;
    }
    render();
  }

  // [Issue ▾] — does NOT change the active document tab (test_plan.md
  // TC-003, tech spec §2.2's P0 fix): the fetch below carries the previous
  // `state.activeTabId` through `resolveActiveTab()`.
  //
  // Deliberately does not write `location.hash` (unlike `onBack`/`.doc-tabs`
  // clicks navigating elsewhere): `app.js`'s router remounts this whole
  // screen from scratch on every `hashchange`, which would drop
  // `state.activeTabId` and reopen this exact P0 this function fixes. An
  // issue switch is local component state, the same way `public/inbox.js`'s
  // section switch is — not a route change.
  async function selectIssue(issueId) {
    if (!issueId || issueId === state.issueId) return;
    state.issueId = issueId;
    storeLastIssue(state.project, issueId, options.storage);
    render(); // reflect the dropdown's new value immediately, tabs catch up async
    await loadRoleContents(true);
  }

  // [Роль ▾] — replaces the ENTIRE tab set (test_plan.md TC-002 step 3): a
  // fresh `GET .../roles/:newRole` call, never routed through
  // `resolveActiveTab()`. Documents of different roles are never shown at
  // the same time.
  async function selectRole(roleId) {
    if (!roleId || roleId === state.roleId) return;
    state.roleId = roleId;
    storeRole(roleId, options.storage);
    state.activeTabId = null;
    state.tabs = [];
    render();
    await loadRoleContents(false);
  }

  function selectTab(tabId) {
    if (tabId === state.activeTabId) return;
    if (!state.tabs.some((t) => t.id === tabId)) return;
    state.activeTabId = tabId;
    render();
  }

  async function loadShell() {
    try {
      const [roles, issues] = await Promise.all([
        fetchRoles(options.fetchImpl),
        state.project ? fetchIssues(state.project, options.fetchImpl) : Promise.resolve([]),
      ]);
      state.roles = roles;
      state.issues = issues;
      if (!state.roleId && roles.length) state.roleId = roles[0].id;
      if (!state.issueId && issues.length) state.issueId = issues[0].issueId;
    } catch (err) {
      state.error = err;
      render();
      return;
    }
    await loadRoleContents(false);
  }

  render(); // paint immediately (role/issue may already be known)
  const ready = loadShell();
  // Independent of `loadShell()`/`loadRoleContents()`: the "Дела" counter
  // needs only `state.project` (AC-06a/AC-06b), not roles/issues/role
  // contents, so it starts in parallel rather than waiting its turn — and is
  // not folded into `ready`, so a test/caller awaiting `ready` is not made
  // to depend on `/api/inbox` succeeding.
  loadProjectTodoCount();

  return {
    selectIssue,
    selectRole,
    selectTab,
    refresh: () => loadRoleContents(true),
    getState: () => ({ ...state, tabs: [...state.tabs], roles: [...state.roles], issues: [...state.issues] }),
    ready,
  };
}
