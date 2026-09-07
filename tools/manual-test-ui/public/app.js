"use strict";

// public/app.js — thin hash router (this issue's tech spec §2.3, Task 23 of
// its implementation plan). Decides which of the three screen modules to
// mount based on `location.hash` with a plain `switch`-shaped lookup — no
// external router library, keeping "one command, it works" (G7/AC-08a).
//
// Routing table (tech spec §2.3):
//   "#/"                       -> launcher.js       (level 1)
//   "#/inbox"                  -> inbox.js           (global inbox, AC-04d)
//   "#/p/<project>"            -> project-inbox.js  (no `pf.lastIssue.<project>`
//                                  entry yet — the project's own issue list +
//                                  inbox, not a full level-2 workspace: there
//                                  is no active issue yet, so no active
//                                  role/`.doc-tabs`. Dogfooding fix: this used
//                                  to silently route to workspace.js, which
//                                  auto-picked `issues[0]` instead of ever
//                                  showing a list — the tech spec §2.3
//                                  described a list here from the start.)
//   "#/p/<project>/inbox"      -> project-inbox.js's `mountInbox` (dogfooding
//                                  round 2, Task 61: the project screen's
//                                  full per-issue inbox breakdown promoted to
//                                  its own screen — the project screen itself
//                                  now shows only a collapsed summary card
//                                  linking here).
//   "#/p/<project>/i/<issue>"  -> workspace.js, issueId: <issue> (level 2)
// Anything unrecognized falls back to the launcher, so a garbled/stale hash
// never leaves the page blank.
//
// Deliberately NOT adding a `package.json`/`"type": "module"` here —
// `<script type="module">` in `index.html` needs no such declaration (it is
// plain browser/language support, not an npm package). Adding
// `"type": "module"` at the package level would break `require()` in
// `server.js` and every `lib/*.js`/`test/*.test.js` (G7/AC-08a, tech spec §7).
//
// Screen modules are imported dynamically (one at a time, only for the
// route currently active) rather than as static top-of-file imports. Besides
// the usual lazy-loading benefit, this means `app.js` stays evaluable (and
// its routing logic testable in isolation) even before every screen module
// exists on disk: `public/workspace.js` is written by a separate,
// concurrently-running task and may not be present yet when this file is
// first loaded — a route that never resolves to "workspace" never imports
// it, and a static import would instead fail the whole module graph.
// Each entry names its loader plus which of the module's exports mounts it
// (`entry`, default `"mount"`) — `projectInbox` shares its module and
// data-fetching with `project`, but mounts via `mountInbox` instead
// (dogfooding round 2, Task 61: one module, two screens, one more route,
// not a fifth top-level file — see project-inbox.js's own header comment).
const SCREENS = {
  launcher: { load: () => import("./launcher.js") },
  inbox: { load: () => import("./inbox.js") },
  project: { load: () => import("./project-inbox.js") },
  projectInbox: { load: () => import("./project-inbox.js"), entry: "mountInbox" },
  workspace: { load: () => import("./workspace.js") },
};

// ---------------------------------------------------------------------------
// Pure routing — hash string -> {screen, project, issueId} — kept separate
// from the DOM mounting below so it's testable without a browser (same split
// `resolveLandingRoute`/`resolveActiveTab` use elsewhere in this issue).
// ---------------------------------------------------------------------------

/**
 * Parse `location.hash` into which screen to mount and its route params.
 *
 * @param {string} hash — e.g. `location.hash`, may be `""`/`"#"`/`"#/"`/etc.
 * @returns {{screen: "launcher"|"inbox"|"project"|"projectInbox"|"workspace", project: string|null, issueId: string|null}}
 */
// Query portion of the hash (e.g. `#/p/foo/i/bar?role=tester&tab=manual_test_checklist&ptcId=TC-01`)
// carries an inbox click's initial-landing state (CR-005 fix, this issue's
// Task 33): `role`/`tab`/`ptcId`. This is NOT a
// second route — the path portion (`/p/foo/i/bar`) alone still fully
// determines `{screen, project, issueId}`, exactly as before. The query is
// only ever read once, at `workspace.js`'s `mount()` time, to seed its
// initial role/tab/scroll target; every *subsequent* tab/role/issue switch
// inside that screen stays local component state and never touches
// `location.hash` again (the rule Tasks 15/24 established) — this file
// still never writes a query string of its own, `inbox.js` does, once, for
// the initial navigation only.
const NULL_ROUTE_EXTRAS = { initialRole: null, initialTab: null, initialPtcId: null, initialIssueId: null };

export function parseRoute(hash) {
  const full = String(hash || "").replace(/^#/, "");
  const qIndex = full.indexOf("?");
  const rawPath = qIndex === -1 ? full : full.slice(0, qIndex);
  const rawQuery = qIndex === -1 ? "" : full.slice(qIndex + 1);
  const segments = rawPath.split("/").filter(Boolean); // "/p/foo/i/bar" -> ["p","foo","i","bar"]

  const query = new URLSearchParams(rawQuery);
  const extras = {
    initialRole: query.get("role") || null,
    initialTab: query.get("tab") || null,
    initialPtcId: query.get("ptcId") || null,
    // `?issue=<id>` — the global inbox's per-project issue summary table
    // links to `#/p/<project>/inbox?issue=<id>` to jump straight to that
    // issue's own group on the dedicated inbox screen
    // (`project-inbox.js`'s `initialIssueId`). Read generically here (not
    // gated to the "projectInbox" path branch) since it's just a query
    // param — the same extraction already applies uniformly to every route.
    initialIssueId: query.get("issue") || null,
  };

  if (segments.length === 0) {
    return { screen: "launcher", project: null, issueId: null, ...NULL_ROUTE_EXTRAS };
  }
  if (segments[0] === "inbox") {
    return { screen: "inbox", project: null, issueId: null, ...NULL_ROUTE_EXTRAS };
  }
  if (segments[0] === "p" && segments.length >= 2 && segments[1]) {
    const project = decodeURIComponent(segments[1]);
    if (segments.length >= 4 && segments[2] === "i" && segments[3]) {
      return { screen: "workspace", project, issueId: decodeURIComponent(segments[3]), ...extras };
    }
    if (segments.length === 3 && segments[2] === "inbox") {
      return { screen: "projectInbox", project, issueId: null, ...extras };
    }
    return { screen: "project", project, issueId: null, ...extras };
  }

  return { screen: "launcher", project: null, issueId: null, ...NULL_ROUTE_EXTRAS };
}

// ---------------------------------------------------------------------------
// Mounting
// ---------------------------------------------------------------------------

function navigate(hash) {
  location.hash = hash;
}

// `public/inbox.js`'s `where` (manualTestItemView/humanTaskItemView) carries
// fields beyond `hash` — `roleId`/`doc`/`ptcId` for a manual TC, `tab`/
// `stageKey` for a human task (CR-005: previously every field but `hash` was
// silently dropped here). Encoded as the target hash's OWN query string
// (`role=`/`tab=`/`ptcId=`), not a separate route — `parseRoute` above reads
// it back into `{initialRole, initialTab, initialPtcId}` for
// `workspace.js`'s `mount()`. `doc` (a document filename, e.g.
// "manual_test_checklist.md") is forwarded verbatim as `tab` — the ".md"
// stripping that turns a doc name into a tab id is `workspace.js`'s own
// `tabIdFor` rule (`buildTabSet`), not duplicated here, so this file still
// carries no document-name knowledge of its own (roles.test.js's "app.js
// hard-codes no document name" check). `stageKey` is not forwarded: nothing
// on the receiving end consumes it yet (landing on the "Дела" tab is the
// whole fix this task requires) — CR-005's own "don't over-engineer this".
//
// Exported (unlike `navigate`/`optionsFor` below, which touch `location`/
// build DOM-mounting option objects) for the same reason `parseRoute` above
// is: it is a pure string-in/string-out function, testable without a
// browser — driven end-to-end from `inbox.js`'s real `manualTestItemView`/
// `humanTaskItemView` output in tests, not a hand-written hash string.
export function inboxTargetHash(target) {
  if (!target || typeof target !== "object") return target;
  const base = target.hash || "";
  const params = new URLSearchParams();
  if (target.roleId) params.set("role", target.roleId);
  const tab = target.doc || target.tab;
  if (tab) params.set("tab", tab);
  if (target.ptcId) params.set("ptcId", target.ptcId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function optionsFor(route) {
  switch (route.screen) {
    case "launcher":
      return { onNavigate: navigate };
    case "inbox":
      return { onNavigate: (target) => navigate(inboxTargetHash(target)) };
    case "project":
    case "projectInbox":
      return {
        project: route.project,
        // A manual-test-item click carries a single `role=` (the item's own
        // role, e.g. "tester") — landing pre-filtered to just that role is
        // the useful default; the multi-select filter itself still lives in
        // localStorage for every subsequent visit.
        initialRoles: route.initialRole ? [route.initialRole] : undefined,
        initialIssueId: route.initialIssueId || undefined,
        onNavigate: (target) => navigate(inboxTargetHash(target)),
      };
    case "workspace":
      return {
        project: route.project,
        issueId: route.issueId,
        // A manual-test-item click carries a single `role=` (the item's own
        // role) — landing pre-filtered to just that role is the useful
        // default, same as the "project"/"projectInbox" cases above.
        initialRoles: route.initialRole ? [route.initialRole] : undefined,
        initialTab: route.initialTab || undefined,
        initialPtcId: route.initialPtcId || undefined,
        onNavigate: navigate,
      };
    default:
      return {};
  }
}

let current = null; // the currently mounted screen instance, if it exposes one

async function renderRoute() {
  const container = document.getElementById("app");
  if (!container) return;

  const route = parseRoute(location.hash);
  const screen = SCREENS[route.screen] || SCREENS.launcher;

  if (current && typeof current.unmount === "function") current.unmount();
  current = null;
  container.innerHTML = "";

  try {
    const mod = await screen.load();
    const mountFn = mod[screen.entry || "mount"];
    current = mountFn(container, optionsFor(route));
  } catch (err) {
    container.innerHTML = "";
    const p = document.createElement("p");
    p.className = "notice error";
    p.textContent = `Не удалось открыть экран: ${err.message}`;
    container.appendChild(p);
  }
}

function boot() {
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}

// Guarded so this module stays importable (and `parseRoute` testable) under
// Node's test runner via dynamic `import()` — no `window`/`document` exist
// there, and this file has no other entry point than "evaluate on load" in
// a real browser.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  boot();
}
