// test/a11y.test.js — keyboard-accessibility statics (implementation_plan.md
// Task 22; test_plan.md TC-014; specs.md §6, US-03).
//
// TC-014 is explicitly the *statically* checkable slice of US-03 — TC-015
// (live tab-through, visible-focus-by-eye check across the running app) has
// no automated counterpart in this zero-dependency, no-headless-browser
// project (test_plan.md TC-015's own Description) and is out of scope here.
//
// Two source-level checks, both plain string/regex work over the files on
// disk — no DOM, no browser, matching every other `source: ...`-style test
// in this suite (see e.g. test/workspace-ui.test.js's
// "source: selectRole's body never calls resolveActiveTab").
//
//   1. `public/style.css` declares a `:focus-visible` rule (not bare
//      `:focus`) with the required `outline`/`outline-offset` on `--accent`
//      (TC-014 step 1). `--accent`'s contrast against `--bg`/`--surface` is
//      the separate, already-existing test/contrast.test.js (TC-014 step 2,
//      not duplicated here).
//   2. None of `public/launcher.js` / `public/inbox.js` / `public/workspace.js`
//      wires a click handler to a `<div>`/`<span>` in place of a real
//      `<button>`/`<a>` (TC-014 step 3) — checked by cross-referencing every
//      `h("div"|"span", ...)`-built element's variable name against every
//      `<var>.addEventListener("click", ...)` call site in the same file.
//
// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll
// (launcher search box a11y — TC-006, real fake-DOM assertions rather than
// source-level ones, since TC-006 needs the actual rendered attributes/
// association, not just a pattern match on the source text)
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const STYLE_CSS_PATH = path.join(PUBLIC_DIR, "style.css");
const CLIENT_MODULES = ["launcher.js", "inbox.js", "workspace.js"];

// --------------------------------------------------------------- step 1

test(":focus-visible (not bare :focus) sets outline: 2px solid var(--accent); outline-offset: 2px (TC-014 step 1)", () => {
  const css = fs.readFileSync(STYLE_CSS_PATH, "utf8");

  // Find the `:focus-visible { ... }` rule block itself.
  const ruleMatch = css.match(/:focus-visible\s*\{([^}]*)\}/);
  assert.ok(ruleMatch, "expected a `:focus-visible { ... }` rule in public/style.css");

  const body = ruleMatch[1];
  assert.ok(
    /outline:\s*2px\s+solid\s+var\(--accent\)/.test(body),
    `expected \`outline: 2px solid var(--accent)\` inside the :focus-visible rule, got: ${body}`
  );
  assert.ok(
    /outline-offset:\s*2px/.test(body),
    `expected \`outline-offset: 2px\` inside the :focus-visible rule, got: ${body}`
  );

  // No `:focus` rule anywhere in the file (global OR scoped to a class, e.g.
  // `.note-input:focus`) may set `outline: none` — a scoped rule like
  // `.note-input:focus { outline: none }` sits at specificity 0,2,0, which
  // outranks the global `:focus-visible` rule's 0,1,0 and would silently
  // swallow the keyboard focus ring on that element, defeating the whole
  // point of the rule asserted above. `:focus-visible` rules themselves are
  // excluded from this scan (the negative lookahead below) — only bare
  // `:focus` selectors are being checked.
  const focusRuleRe = /[^\s{}]*:focus(?!-visible|-within)\s*\{([^}]*)\}/g;
  let focusMatch;
  while ((focusMatch = focusRuleRe.exec(css))) {
    assert.ok(
      !/outline\s*:\s*none/.test(focusMatch[1]),
      `a \`:focus\` rule sets \`outline: none\`, which can outrank :focus-visible's ring by specificity: ${focusMatch[0]}`
    );
  }
});

// --------------------------------------------------------------- step 3

test("no onclick= attribute in any public/*.js — actions are wired via addEventListener on real elements (TC-014 step 3)", () => {
  for (const name of CLIENT_MODULES) {
    const source = fs.readFileSync(path.join(PUBLIC_DIR, name), "utf8");
    assert.ok(!/\bonclick\s*=/.test(source), `${name}: found an \`onclick=\` attribute — actions must use addEventListener on a real <button>/<a>`);
  }
});

test("no <div>/<span>/<li> carries a click handler in place of a native <button>/<a> (TC-014 step 3, specs.md §6)", () => {
  // Both element-creation paths these modules use: the local `h(tag, ...)`
  // helper (launcher.js/inbox.js/workspace.js all define one) and a direct
  // `document.createElement(...)` call (e.g. inbox.js's `<li>` wrapper) —
  // either one could in principle end up with a click handler attached.
  const divSpanVarRe = /(?:const|let|var)\s+(\w+)\s*=\s*(?:h\(\s*|document\.createElement\(\s*)["'](?:div|span|li)["']/g;
  const clickListenerVarRe = /(\w+)\.addEventListener\(\s*["']click["']/g;

  for (const name of CLIENT_MODULES) {
    const source = fs.readFileSync(path.join(PUBLIC_DIR, name), "utf8");

    const divSpanVars = new Set();
    let m;
    while ((m = divSpanVarRe.exec(source))) divSpanVars.add(m[1]);

    const clickListenerVars = new Set();
    while ((m = clickListenerVarRe.exec(source))) clickListenerVars.add(m[1]);

    const offenders = [...divSpanVars].filter((v) => clickListenerVars.has(v));
    assert.deepStrictEqual(
      offenders,
      [],
      `${name}: variable(s) ${JSON.stringify(offenders)} are built as <div>/<span> (via h("div"/"span", ...)) but also carry a click addEventListener — must be a native <button> (or <a href> for navigation)`
    );
  }
});

test("every click-handled element in launcher.js/inbox.js/workspace.js is a real <button> or <a> (positive control)", () => {
  // Guards the negative check above against a false pass (e.g. a helper
  // renamed so the two regexes above never overlap by coincidence): asserts
  // there IS at least one real button/anchor wired to a click handler in
  // each file, so "found zero offenders" reflects an actually-audited file,
  // not an empty/no-op scan.
  for (const name of CLIENT_MODULES) {
    const source = fs.readFileSync(path.join(PUBLIC_DIR, name), "utf8");
    const buttonOrAnchorVarRe = /(?:const|let|var)\s+(\w+)\s*=\s*h\(\s*["'](?:button|a)["']/g;
    const clickListenerVarRe = /(\w+)\.addEventListener\(\s*["']click["']/g;

    const buttonOrAnchorVars = new Set();
    let m;
    while ((m = buttonOrAnchorVarRe.exec(source))) buttonOrAnchorVars.add(m[1]);

    const clickListenerVars = new Set();
    while ((m = clickListenerVarRe.exec(source))) clickListenerVars.add(m[1]);

    const wired = [...buttonOrAnchorVars].filter((v) => clickListenerVars.has(v));
    assert.ok(wired.length > 0, `${name}: expected at least one native <button>/<a> wired to a click handler`);
  }
});

// ---------------------------------------------------------------------------
// TC-006 (AC-06) — the launcher's search <input> is keyboard-focusable
// without any artificial tabindex, its <label> is visible and programmatically
// associated, and its aria-live region's content actually changes with the
// query. Unlike the source-level checks above, this needs the real rendered
// DOM (attribute values, for/id association, live text), so it mounts the
// launcher against the same minimal fake DOM test/launcher.test.js uses.
// ---------------------------------------------------------------------------

const LAUNCHER_PATH = path.join(PUBLIC_DIR, "launcher.js");

async function loadLauncher() {
  return import(pathToFileURL(LAUNCHER_PATH).href);
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
  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
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

function routedFetch(routes) {
  return async (url) => {
    if (!(url in routes)) throw new Error(`unexpected fetch in test: ${url}`);
    return { ok: true, status: 200, json: async () => routes[url] };
  };
}

function baseRoutes(overrides = {}) {
  return {
    "/api/roles": { roles: [] },
    "/api/projects": [{ name: "alpha-project" }, { name: "beta-project" }],
    "/api/projects/alpha-project/issues": { issues: [] },
    "/api/projects/beta-project/issues": { issues: [] },
    "/api/inbox": { manualTests: [], humanTasks: [], totalCount: 0 },
    ...overrides,
  };
}

async function mountLauncherFor(container) {
  const mod = await loadLauncher();
  const handle = mod.mount(container, { fetchImpl: routedFetch(baseRoutes()) });
  await handle.ready;
  return mod;
}

// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll TC-006
test("launcher search <input>: no tabindex, disabled, hidden or aria-hidden — plain native tab order (TC-006 step 1)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  await mountLauncherFor(container);

  const input = container.findAll((n) => n.className === "project-search-input")[0];
  assert.ok(input, "expected the .project-search-input <input> to be rendered");
  assert.strictEqual(input.tagName, "INPUT");
  assert.strictEqual(input.hasAttribute("tabindex"), false, "no tabindex must be set on the native input");
  assert.strictEqual(input.hasAttribute("disabled"), false);
  assert.strictEqual(input.hasAttribute("hidden"), false);
  assert.notStrictEqual(input.getAttribute("aria-hidden"), "true");
});

// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll TC-006
test("launcher search <input> has a visible <label> with non-empty text, programmatically associated via for/id (TC-006 step 2)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  await mountLauncherFor(container);

  const input = container.findAll((n) => n.className === "project-search-input")[0];
  const label = container.findAll((n) => n.tagName === "LABEL")[0];
  assert.ok(label, "expected a <label> for the search input");
  assert.ok(label.textContent && label.textContent.trim().length > 0, "the <label> must carry visible, non-empty text");
  assert.notStrictEqual(label.className, "visually-hidden", "the label must be visible, not screen-reader-only");
  assert.notStrictEqual(label.getAttribute("aria-hidden"), "true");
  assert.ok(input.id, "the search <input> must have an id for the label to reference");
  assert.strictEqual(label.htmlFor, input.id, "the <label>'s `for` must match the <input>'s `id` (programmatic association)");
});

// @pf-issue 20260818-improve-project-explorer-launcher-search-and-tc-scroll TC-006
test("launcher search has an aria-live=\"polite\" region whose text changes with the query/match count (TC-006 step 3)", async () => {
  installFakeDocument();
  const container = new FakeElement("div");
  await mountLauncherFor(container);

  function liveRegion() {
    return container.findAll((n) => n.getAttribute("aria-live") === "polite")[0];
  }

  const before = liveRegion();
  assert.ok(before, 'expected an aria-live="polite" element');
  const textBeforeQuery = before.textContent;

  const input = container.findAll((n) => n.className === "project-search-input")[0];
  input.value = "alpha";
  for (const fn of input._listeners.input || []) fn();

  const after = liveRegion();
  assert.ok(after, 'expected an aria-live="polite" element to still be present after typing');
  assert.notStrictEqual(after.textContent, textBeforeQuery, "the aria-live region's text must change when the query/match count changes");
  assert.ok(after.textContent.length > 0, "the aria-live region must report something, not stay silently empty");
});
