'use strict';

// test/css-class-coverage.test.js — CR-003 regression guard (code_review.md,
// implementation_plan.md Task 31; test_plan.md TC-001/TC-002/TC-010/TC-012).
//
// Round-1 `/pf-codereview` found a large chunk of `public/launcher.js`'s,
// `public/inbox.js`'s and `public/workspace.js`'s markup used classes with
// zero matching rules in `public/style.css` — the P0 CR-003 finding. This
// test statically extracts every class name those three files actually
// build (via `h(tag, className, ...)`'s className argument, plus the two
// `.className = "..."` assignments `workspace.js` uses for its `<select>`
// elements) and asserts each one has at least one matching selector in
// `public/style.css`, so a future class added to the markup without a
// matching rule fails the suite instead of silently shipping unstyled.
//
// Static CSS/JS audit, same complexity level as this project's other
// hand-rolled parsers (`test/font-family.test.js`'s `extractFontFamilyRules`,
// `lib/contrast.js`'s `parseRootTokens`) — no real JS/CSS AST, good enough
// for this hand-authored, zero-dependency codebase.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CSS_PATH = path.join(PUBLIC_DIR, 'style.css');
// Comments stripped before matching: this file's own header comments
// mention class names by name (e.g. ".doc-panel is the one visible content
// panel...") without that being a rule for them — matching against the raw
// text would let a mention in prose falsely satisfy the coverage check.
const cssText = fs.readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');

const SOURCE_FILES = ['launcher.js', 'inbox.js', 'workspace.js'];

// Matches `h("tag", <arg2>` — `<arg2>` is a single-quoted, double-quoted or
// backtick-quoted string, possibly containing `${...}` interpolation.
const H_CALL_RE = /h\(\s*["'][a-zA-Z][\w-]*["']\s*,\s*(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;

// Matches the two `<select>.className = "literal"` assignments workspace.js
// uses (those elements are built with `document.createElement`, not `h()`).
const CLASS_ASSIGN_RE = /\.className\s*=\s*(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;

// A real class-name token, not a truncated dynamic-modifier prefix like
// "inbox-item--" (from `` `inbox-item inbox-item--${view.kind}` `` — the
// trailing "--" is what's left once the bare-identifier `${view.kind}`
// interpolation is stripped, and is never a class of its own).
const VALID_TOKEN_RE = /^[a-zA-Z][\w-]*[a-zA-Z0-9]$|^[a-zA-Z]$/;

/**
 * A raw quoted/backtick-quoted JS string literal (including its delimiters)
 * -> the set of statically-known class-name tokens inside it.
 *
 * Handles two shapes actually used in these files:
 *   - a plain literal: `"role-switch"` -> ["role-switch"]
 *   - a template literal with a ternary interpolation whose branches are
 *     themselves string literals: `` `role-btn${active ? " active" : ""}` ``
 *     -> ["role-btn", "active"] (both the static prefix and the literal
 *     strings inside the `${...}` expression are extracted).
 *
 * A bare-identifier interpolation like `` `inbox-item inbox-item--${view.kind}` ``
 * has no statically-knowable value for the `${...}` part — that whole
 * expression is dropped, leaving only the static tokens ("inbox-item",
 * "inbox-item--" is discarded too since a trailing "--" is not a valid
 * token on its own). Coverage for those runtime-only modifier suffixes is
 * intentionally out of scope for this static check.
 */
function tokensFromLiteral(raw) {
  const quote = raw[0];
  const inner = raw.slice(1, -1);

  let text;
  if (quote === '`') {
    // Pull out quoted string literals living inside `${...}` blocks (the
    // ternary-branch case) before discarding the blocks themselves.
    const innerLiterals = [];
    const exprRe = /\$\{([^}]*)\}/g;
    let m;
    while ((m = exprRe.exec(inner))) {
      const exprLiteralRe = /["']([^"']*)["']/g;
      let lm;
      while ((lm = exprLiteralRe.exec(m[1]))) innerLiterals.push(lm[1]);
    }
    const withoutExprs = inner.replace(/\$\{[^}]*\}/g, ' ');
    text = withoutExprs + ' ' + innerLiterals.join(' ');
  } else {
    text = inner;
  }

  return text
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => VALID_TOKEN_RE.test(t));
}

function collectClassTokens(fileName) {
  const src = fs.readFileSync(path.join(PUBLIC_DIR, fileName), 'utf8');
  const tokens = new Set();

  for (const re of [H_CALL_RE, CLASS_ASSIGN_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(src))) {
      for (const token of tokensFromLiteral(match[1])) tokens.add(token);
    }
  }
  return tokens;
}

// A selector for `.token` exists in style.css: `.token` must be followed by
// a non-word/non-hyphen character (or end of file) so `.doc-tab` does not
// count `.doc-tab--active`'s rule as covering the plain `.doc-tab` class.
function hasCssRuleFor(token) {
  const re = new RegExp(`\\.${token}(?![\\w-])`);
  return re.test(cssText);
}

const allTokens = new Map(); // token -> Set<fileName>
for (const file of SOURCE_FILES) {
  for (const token of collectClassTokens(file)) {
    if (!allTokens.has(token)) allTokens.set(token, new Set());
    allTokens.get(token).add(file);
  }
}

test('sanity: extraction finds a non-trivial number of class tokens across launcher.js/inbox.js/workspace.js', () => {
  assert.ok(allTokens.size > 20, `expected >20 distinct class tokens, got ${allTokens.size}`);
  // A couple of known-good spot checks — if these ever stop being found the
  // extractor itself broke, not the coverage it is meant to check.
  assert.ok(allTokens.has('project-card'), 'expected to find "project-card" in launcher.js');
  assert.ok(allTokens.has('inbox-item-label'), 'expected to find "inbox-item-label" in inbox.js');
  assert.ok(allTokens.has('doc-panel'), 'expected to find "doc-panel" in workspace.js');
});

test('every statically-known class built by launcher.js/inbox.js/workspace.js has a matching rule in style.css (CR-003)', () => {
  const missing = [];
  for (const [token, files] of allTokens) {
    if (!hasCssRuleFor(token)) missing.push(`${token} (${[...files].join(', ')})`);
  }
  assert.deepStrictEqual(
    missing,
    [],
    `expected 0 uncovered classes, got:\n${missing.join('\n')}`
  );
});
