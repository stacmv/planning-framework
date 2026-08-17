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

/**
 * Mount the inbox screen into `container` (an already-attached DOM node —
 * this module never inserts itself into `document.body`, matching every
 * other read-only screen in this tool). Fetches `/api/inbox` exactly once,
 * as soon as the screen opens (AC-04b), and renders both sections from
 * that one response.
 *
 * `.inbox-tabs` switches which section is visible by flipping
 * `state.activeSection` — LOCAL component state only. This handler never
 * touches `location.hash` and never calls `options.onNavigate` (TC-018
 * step 3) — that callback is reserved for actual item navigation
 * (AC-04c), a separate concern from which section is on screen.
 *
 * @param {Element} container
 * @param {{fetchImpl?: typeof fetch, onNavigate?: (target: object) => void,
 *   initialSection?: string}} [options]
 * @returns {{refresh: () => Promise<void>, setActiveSection: (section: string) => void,
 *   getState: () => {activeSection: string, data: object|null, error: Error|null},
 *   ready: Promise<void>}}
 */
export function mount(container, options = {}) {
  const state = {
    activeSection:
      options.initialSection === SECTIONS.HUMAN_TASKS ? SECTIONS.HUMAN_TASKS : SECTIONS.MANUAL_TESTS,
    data: null,
    error: null,
  };

  function render() {
    container.innerHTML = "";

    if (state.error) {
      container.appendChild(h("p", "inbox-error", `Не удалось загрузить инбокс: ${state.error.message}`));
      return;
    }
    if (!state.data) {
      container.appendChild(h("p", "inbox-loading", "Загрузка…"));
      return;
    }

    const tabs = h("div", "inbox-tabs");
    for (const sectionKey of [SECTIONS.MANUAL_TESTS, SECTIONS.HUMAN_TASKS]) {
      const count =
        sectionKey === SECTIONS.MANUAL_TESTS ? state.data.manualTests.length : state.data.humanTasks.length;
      const active = state.activeSection === sectionKey;
      const btn = h("button", `inbox-tab${active ? " inbox-tab--active" : ""}`, `${SECTION_TITLES[sectionKey]} (${count})`);
      btn.type = "button";
      btn.dataset.section = sectionKey;
      btn.setAttribute("aria-pressed", String(active));
      // Section switch: local `state.activeSection` only — see the
      // function-level comment above for why `location.hash` never
      // appears here.
      btn.addEventListener("click", () => setActiveSection(sectionKey));
      tabs.appendChild(btn);
    }
    container.appendChild(tabs);

    const panels = h("div", "inbox-panels");
    panels.appendChild(
      renderSection(SECTIONS.MANUAL_TESTS, state.data.manualTests, manualTestItemView, options.onNavigate)
    );
    panels.appendChild(
      renderSection(SECTIONS.HUMAN_TASKS, state.data.humanTasks, humanTaskItemView, options.onNavigate)
    );
    for (const panel of panels.children) {
      panel.hidden = panel.dataset.section !== state.activeSection;
    }
    container.appendChild(panels);
  }

  function setActiveSection(sectionKey) {
    if (sectionKey !== SECTIONS.MANUAL_TESTS && sectionKey !== SECTIONS.HUMAN_TASKS) return;
    if (sectionKey === state.activeSection) return;
    state.activeSection = sectionKey;
    render();
  }

  async function refresh() {
    state.error = null;
    try {
      // The one and only call site of fetchInboxData()/`/api/inbox` in this
      // module (TC-018 step 1). `mount()` below calls this exactly once;
      // a caller wanting a fresh copy has to call `refresh()` itself,
      // deliberately — this module never re-polls behind its back.
      state.data = await fetchInboxData(options.fetchImpl);
    } catch (err) {
      state.error = err;
    }
    render();
  }

  render(); // paint "Загрузка…" immediately, before the fetch resolves
  const ready = refresh();

  return {
    refresh,
    setActiveSection,
    getState: () => ({ ...state }),
    ready,
  };
}
