// test/style-tokens.test.js — static CSS structure checks for TC-005/TC-008/
// TC-009/TC-010 (test_plan.md, 20260806-feat-project-explorer-redesign).
//
// Companion to test/contrast.test.js, which owns the WCAG threshold checks
// (TC-006/TC-007/TC-014) — this file checks CSS *structure* claims that are
// not about contrast ratios:
//   * TC-005 — no `overflow: hidden` on `body`/`.shell` (the two claims stay
//     block-scoped: `public/style.css` legitimately has several
//     `overflow: hidden` declarations elsewhere — `.context-label`,
//     `.workspace-project`, `.inbox-item-meta`, all `text-overflow: ellipsis`
//     truncation, not a scroll lock — so a whole-file substring search would
//     be the wrong check and would even give a false failure signal on a
//     correct file);
//   * TC-008 — zero hardcoded `color: #hex` literals outside `:root`, reusing
//     `lib/contrast.js`'s `parseRootTokens` the same way test/contrast.test.js
//     does;
//   * TC-009 — the `h1`/body font-size ratio lands in [1.3, 1.8];
//   * TC-010 — `.panel-table`'s alternating-row fill is a `color-mix()`
//     tonal tint, not a hard per-row border, and that tint still clears the
//     AC-02a-02c text-contrast threshold.
//
// Run: node --test test/style-tokens.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { parseRootTokens, contrastRatio } = require("../lib/contrast");

const STYLE_CSS = path.join(__dirname, "..", "public", "style.css");
const cssText = fs.readFileSync(STYLE_CSS, "utf8");

// --------------------------------------------------------------- helpers

// Every top-level `<selector-list> { <body> }` block whose comma-separated
// selector list contains the bare token `selectorToken` exactly (so
// `body` never matches `.md-body`/`tbody`/`.human-tasks-body`, and `.shell`
// never matches some hypothetical `.shell-inner`).
function findSelectorBlocks(css, selectorToken) {
  const blocks = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selectorToken)) blocks.push(m[2]);
  }
  return blocks;
}

// A single named top-level rule, anchored to the start of its own line (this
// stylesheet has no nesting, so every real rule's selector starts at column
// 0) — used for selectors like `body` and `.brand h1` where exactly one rule
// is expected to carry that literal selector text.
function findExactSelectorBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("(?:^|\\n)" + escaped + "\\s*\\{([^}]*)\\}", "m");
  const m = re.exec(css);
  return m ? m[1] : null;
}

function hexToRgbLocal(hex) {
  const n = hex.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

// Reproduces `color-mix(in srgb, var(--a) weightA%, var(--b))`: a plain
// per-channel weighted average in sRGB space (no linearization) — the same
// interpolation CSS `color-mix(in srgb, ...)` performs.
function mixSrgb(hexA, weightAPercent, hexB) {
  const a = hexToRgbLocal(hexA);
  const b = hexToRgbLocal(hexB);
  const wA = weightAPercent / 100;
  const wB = 1 - wA;
  const channel = (i) => Math.round(a[i] * wA + b[i] * wB);
  return "#" + [0, 1, 2].map((i) => channel(i).toString(16).padStart(2, "0")).join("");
}

// --------------------------------------------------------------- TC-005

test("body's rule block does not set overflow: hidden (TC-005)", () => {
  const bodyBlocks = findSelectorBlocks(cssText, "body");
  assert.ok(bodyBlocks.length > 0, "expected at least one `body` selector rule block in public/style.css");
  for (const block of bodyBlocks) {
    assert.ok(!/overflow\s*:\s*hidden/i.test(block), `body rule block must not contain overflow: hidden, got: ${block}`);
  }
});

test(".shell (the root layout container) does not set overflow: hidden (TC-005)", () => {
  const shellBlocks = findSelectorBlocks(cssText, ".shell");
  assert.ok(shellBlocks.length > 0, "expected a `.shell { ... }` rule in public/style.css");
  for (const block of shellBlocks) {
    assert.ok(!/overflow\s*:\s*hidden/i.test(block), `.shell rule block must not contain overflow: hidden, got: ${block}`);
  }
});

test("local overflow: hidden on inner text-truncation containers is untouched — this is not a whole-file ban (TC-005 step 2)", () => {
  // Regression guard on the two checks above: they must stay block-scoped,
  // not a blanket "no `overflow: hidden` anywhere in the file" scan. Several
  // `text-overflow: ellipsis` truncation rules legitimately pair with
  // `overflow: hidden` elsewhere in this file (.context-label,
  // .workspace-project, .inbox-item-meta) — prove at least one such pairing
  // still exists, so this suite would fail loudly if a future edit
  // regressed it into a global ban.
  const ellipsisPairings = cssText.match(/overflow\s*:\s*hidden;\s*text-overflow\s*:\s*ellipsis;/g) || [];
  assert.ok(ellipsisPairings.length > 0, "expected at least one legitimate `overflow: hidden` + `text-overflow: ellipsis` pairing to remain in public/style.css");
});

// --------------------------------------------------------------- TC-008

test("zero hardcoded `color: #hex` literals outside :root — parseRootTokens finds none (TC-008 steps 1-2)", () => {
  const parsed = parseRootTokens(cssText);
  assert.strictEqual(
    parsed.textLiterals.length,
    0,
    `expected zero hardcoded color: #hex literals (AC-02j), got: ${JSON.stringify(parsed.textLiterals)}`
  );
});

test("grep-level check: zero `color: #hex` occurrences anywhere in style.css (TC-008 step 1)", () => {
  const matches = cssText.match(/(?:^|[;{}\s])color\s*:\s*#[0-9a-fA-F]{3,6}\s*;/g) || [];
  assert.deepStrictEqual(matches, [], `expected zero color:#hex matches, got: ${JSON.stringify(matches)}`);
});

test("the 4 specific legacy literals (#fff, #dbe6ff, #f0d9a0, #f2b5b1) do not appear anywhere in the file (TC-008 step 2)", () => {
  const lower = cssText.toLowerCase();
  for (const hex of ["#fff", "#dbe6ff", "#f0d9a0", "#f2b5b1"]) {
    // Negative lookahead for a following hex digit so `#fff` doesn't false-
    // positive against an unrelated `#ffffff` elsewhere in the file.
    const re = new RegExp(hex.replace("#", "#") + "(?![0-9a-fA-F])", "i");
    assert.ok(!re.test(lower), `expected ${hex} to not appear anywhere in style.css`);
  }
});

// --------------------------------------------------------------- TC-009

test("h1/body font-size ratio is within 1.3x-1.8x (TC-009 steps 1-2)", () => {
  const bodyBlock = findExactSelectorBlock(cssText, "body");
  assert.ok(bodyBlock, "expected a `body { ... }` rule in public/style.css");
  const bodyMatch = /font-size\s*:\s*(\d+(?:\.\d+)?)px/.exec(bodyBlock);
  assert.ok(bodyMatch, `expected body's rule block to declare a px font-size, got: ${bodyBlock}`);
  const baseSizePx = parseFloat(bodyMatch[1]);

  const h1Block = findExactSelectorBlock(cssText, ".brand h1");
  assert.ok(h1Block, "expected a `.brand h1 { ... }` rule in public/style.css");

  // Resolve h1's font-size to px. Nothing between `<body>` and `.brand h1`
  // (`.topbar`, `.brand`) sets its own font-size, so `1em` in a `calc()`/`em`
  // value here still resolves against body's own base size.
  const calcMatch = /font-size\s*:\s*calc\(\s*1em\s*\*\s*([\d.]+)\s*\)/.exec(h1Block);
  const emMatch = /font-size\s*:\s*([\d.]+)em\b/.exec(h1Block);
  const pxMatch = /font-size\s*:\s*(\d+(?:\.\d+)?)px/.exec(h1Block);

  let h1SizePx;
  if (calcMatch) {
    h1SizePx = baseSizePx * parseFloat(calcMatch[1]);
  } else if (emMatch) {
    h1SizePx = baseSizePx * parseFloat(emMatch[1]);
  } else if (pxMatch) {
    h1SizePx = parseFloat(pxMatch[1]);
  } else {
    assert.fail(`could not parse a font-size from .brand h1 rule block: ${h1Block}`);
  }

  const ratio = h1SizePx / baseSizePx;
  assert.ok(
    ratio >= 1.3 && ratio <= 1.8,
    `expected h1/body font-size ratio within 1.3-1.8, got ${ratio} (h1=${h1SizePx}px, body=${baseSizePx}px)`
  );
});

test("reference screenshots for TC-009 step 3 / TC-012 exist in the issue folder", () => {
  const issueDir = path.join(__dirname, "..", "..", "..", "docs", "issues", "open", "20260806-feat-project-explorer-redesign");
  for (const file of ["reference-glog-list.png", "reference-glog-detail.png"]) {
    assert.ok(fs.existsSync(path.join(issueDir, file)), `expected ${file} to exist in ${issueDir}`);
  }
});

// --------------------------------------------------------------- TC-010

test(".panel-table's odd rows use color-mix() tonal fill, not a hard per-row border (TC-010 steps 1-2)", () => {
  const mixRuleRe = /\.panel-table[^{]*tbody tr:nth-child\(odd\)[^{]*\{[^}]*background:\s*color-mix\(in srgb,\s*var\(--surface\)\s*\d+%,\s*var\(--accent\)\)/s;
  assert.ok(
    mixRuleRe.test(cssText),
    "expected `.panel-table tbody tr:nth-child(odd)` (or equivalent) to set background: color-mix(in srgb, var(--surface) N%, var(--accent))"
  );

  // No hard `border: 1px solid ...` on every row inside .panel-table (only
  // `.panel-table th`'s `border-bottom` — a single header separator — is
  // allowed; that's a distinct property from a full `border:` per row).
  const rowBorderRe = /\.panel-table\s+tbody\s+tr[^{]*\{[^}]*\bborder\s*:\s*1px\s+solid/s;
  assert.ok(!rowBorderRe.test(cssText), "expected .panel-table data rows to not carry a hard border: 1px solid between every row");
});

test("the odd-row tonal fill still clears the AC-02a-02c text-contrast threshold against --text (TC-010 step 3)", () => {
  const parsed = parseRootTokens(cssText);
  const { tokens } = parsed;
  assert.ok(tokens.surface && tokens.accent && tokens.text, "expected --surface/--accent/--text tokens to be present");

  const mixMatch = /color-mix\(in srgb,\s*var\(--surface\)\s*(\d+)%,\s*var\(--accent\)\)/.exec(cssText);
  assert.ok(mixMatch, "expected to find .panel-table's color-mix(...) declaration to read its mix percentage");
  const surfaceWeightPercent = parseInt(mixMatch[1], 10);

  const mixedHex = mixSrgb(tokens.surface, surfaceWeightPercent, tokens.accent);
  const ratio = contrastRatio(tokens.text, mixedHex);
  assert.ok(
    ratio !== null && ratio >= 4.5,
    `expected --text on the odd-row tint (${mixedHex}, mixed from --surface ${surfaceWeightPercent}% / --accent) to clear the 4.5:1 AC-02b threshold, got ${ratio}`
  );
});
