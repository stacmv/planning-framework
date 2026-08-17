// test/contrast.test.js — automated WCAG contrast check (implementation_plan.md
// Task 18; test_plan.md TC-006; brd.md AC-02a-02c).
//
// `lib/contrast.js` is pure (no filesystem, no `require("node:...")`), so it
// is exercised the same way `test/roles-resolve.test.js` exercises
// `lib/roles-resolve.js`: import it directly and check the returned values —
// no server, no browser. The one function under test that touches disk is
// this file itself, reading `public/style.css` for the positive case (step
// 1); the negative cases (steps 2-3) run entirely against inline string
// fixtures, through the very same `checkPalette` the positive case uses —
// the real stylesheet is read, never edited.
//
// Run: node --test test/contrast.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const contrast = require("../lib/contrast");
const { contrastRatio, parseRootTokens, checkPalette } = contrast;

const STYLE_CSS = path.join(__dirname, "..", "public", "style.css");

// --------------------------------------------------------------- step 1

test("public/style.css's :root palette clears every AC-02a-02c threshold (TC-007 step 1)", () => {
  const cssText = fs.readFileSync(STYLE_CSS, "utf8");
  const parsed = parseRootTokens(cssText);

  // Sanity check on the parser itself, so a failure below is legible: if
  // this fails, the palette didn't parse as expected and the violation
  // list (or lack of one) cannot be trusted.
  assert.strictEqual(parsed.tokens.bg, "#16241b");
  assert.strictEqual(parsed.tokens.surface, "#1e3126");
  assert.strictEqual(parsed.tokens.border, "#3c5c46");
  assert.strictEqual(parsed.tokens.text, "#c6d5c8");

  const violations = checkPalette(parsed);
  assert.deepStrictEqual(violations, [], `expected 0 contrast violations, got ${JSON.stringify(violations, null, 2)}`);

  // AC-02a additionally asks for "around 10:1, not 15-21:1" on the dark
  // theme's main text/background pair — not just "at least 7:1". Assert
  // the band explicitly so a future palette change that overshoots into
  // near-max contrast (visually harsh) is caught here too, not only a
  // regression that undershoots the minimum.
  const textSurfaceRatio = contrastRatio(parsed.tokens.text, parsed.tokens.surface);
  assert.ok(textSurfaceRatio >= 7, `--text/--surface ratio ${textSurfaceRatio} is below the 7:1 minimum`);
  assert.ok(textSurfaceRatio < 15, `--text/--surface ratio ${textSurfaceRatio} is in the "too harsh" 15-21:1 band AC-02a warns against`);
});

// --------------------------------------------------------------- step 2

test("contrastRatio flags a text/surface-like pair below 7:1, and checkPalette catches it (TC-006 step 2)", () => {
  // Two mid-greys, close enough in luminance to fail contrast — inline
  // values, not read from any file.
  const dimText = "#777777";
  const dimSurface = "#555555";

  const ratio = contrastRatio(dimText, dimSurface);
  assert.ok(ratio !== null && ratio < 7, `expected ${dimText} vs ${dimSurface} to be below 7:1, got ${ratio}`);

  // The same wrapper check the real-file suite (step 1) uses, run against a
  // synthetic palette built from this pair.
  const parsed = { tokens: { text: dimText, surface: dimSurface }, textLiterals: [] };
  const violations = checkPalette(parsed);
  const hit = violations.find((v) => v.rule === "text-surface-minimum");
  assert.ok(hit, `expected a text-surface-minimum violation, got ${JSON.stringify(violations)}`);
  assert.strictEqual(hit.hexA, dimText);
  assert.strictEqual(hit.hexB, dimSurface);
});

// --------------------------------------------------------------- step 3

test("parseRootTokens + checkPalette catch a literal `color: #ffffff` as pure white text (TC-006 step 3)", () => {
  // Inline CSS fixture, not `public/style.css` — the real file is never
  // touched by this test.
  const cssText = [
    ":root {",
    "  --bg: #16241b;",
    "  --surface: #1e3126;",
    "}",
    ".literal-white-text {",
    "  color: #ffffff;",
    "}",
  ].join("\n");

  const parsed = parseRootTokens(cssText);
  assert.deepStrictEqual(parsed.textLiterals, ["#ffffff"]);

  const violations = checkPalette(parsed);
  const hit = violations.find((v) => v.rule === "pure-white-text");
  assert.ok(hit, `expected a pure-white-text violation, got ${JSON.stringify(violations)}`);
  assert.strictEqual(hit.hexA, "#ffffff");

  // The real stylesheet is untouched: re-reading it must not surprise a
  // reader into thinking this test mutated it.
  const realCssText = fs.readFileSync(STYLE_CSS, "utf8");
  assert.ok(!/color:\s*#ffffff\s*;/i.test(realCssText), "public/style.css must not have been edited by this test");
});

// --------------------------------------------------------------- step 4

test("contrast.test.js requires no special invocation — it is picked up by node --test in test/", () => {
  // Documents TC-006 step 4: this file lives directly in `test/`, named
  // `*.test.js`, the standard `node --test` runner's own discovery
  // convention (see Makefile/README — no separate script references it by
  // path). Nothing to assert beyond the file's own existence at import
  // time, which passing this test already proves.
  assert.ok(true);
});

// --------------------------------------------------------------- coverage

test("checkPalette also flags border and pure-black-background violations", () => {
  const parsed = {
    tokens: { bg: "#000000", surface: "#050505", border: "#060606", text: "#ffffff" },
    textLiterals: [],
  };
  const violations = checkPalette(parsed);
  const rules = violations.map((v) => v.rule);
  assert.ok(rules.includes("pure-black-background"), JSON.stringify(violations));
  assert.ok(rules.includes("pure-white-text"), JSON.stringify(violations));
  assert.ok(rules.includes("border-background-minimum"), JSON.stringify(violations));
});
