"use strict";

// public/app.js — thin hash router (this issue's tech spec §2.3, Task 23 of
// its implementation plan). Decides which of the three screen modules to
// mount based on `location.hash` with a plain `switch`-shaped lookup — no
// external router library, keeping "one command, it works" (G7/AC-08a).
//
// Routing table (tech spec §2.3):
//   "#/"                       -> launcher.js   (level 1)
//   "#/inbox"                  -> inbox.js       (global inbox, AC-04d)
//   "#/p/<project>"            -> workspace.js, issueId: null
//                                  (no `pf.lastIssue.<project>` entry yet —
//                                  the project's issue list, not a full
//                                  level-2 workspace: there is no active
//                                  issue yet, so no active role/`.doc-tabs`)
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
const SCREENS = {
  launcher: () => import("./launcher.js"),
  inbox: () => import("./inbox.js"),
  workspace: () => import("./workspace.js"),
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
 * @returns {{screen: "launcher"|"inbox"|"workspace", project: string|null, issueId: string|null}}
 */
export function parseRoute(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  const segments = raw.split("/").filter(Boolean); // "/p/foo/i/bar" -> ["p","foo","i","bar"]

  if (segments.length === 0) {
    return { screen: "launcher", project: null, issueId: null };
  }
  if (segments[0] === "inbox") {
    return { screen: "inbox", project: null, issueId: null };
  }
  if (segments[0] === "p" && segments.length >= 2 && segments[1]) {
    const project = decodeURIComponent(segments[1]);
    if (segments.length >= 4 && segments[2] === "i" && segments[3]) {
      return { screen: "workspace", project, issueId: decodeURIComponent(segments[3]) };
    }
    return { screen: "workspace", project, issueId: null };
  }

  return { screen: "launcher", project: null, issueId: null };
}

// ---------------------------------------------------------------------------
// Mounting
// ---------------------------------------------------------------------------

function navigate(hash) {
  location.hash = hash;
}

function optionsFor(route) {
  switch (route.screen) {
    case "launcher":
      return { onNavigate: navigate };
    case "inbox":
      return { onNavigate: (target) => navigate(target && target.hash ? target.hash : target) };
    case "workspace":
      return { project: route.project, issueId: route.issueId, onNavigate: navigate };
    default:
      return {};
  }
}

let current = null; // the currently mounted screen instance, if it exposes one

async function renderRoute() {
  const container = document.getElementById("app");
  if (!container) return;

  const route = parseRoute(location.hash);
  const loadScreen = SCREENS[route.screen] || SCREENS.launcher;

  if (current && typeof current.unmount === "function") current.unmount();
  current = null;
  container.innerHTML = "";

  try {
    const mod = await loadScreen();
    current = mod.mount(container, optionsFor(route));
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
