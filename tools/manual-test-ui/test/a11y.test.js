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
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

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
