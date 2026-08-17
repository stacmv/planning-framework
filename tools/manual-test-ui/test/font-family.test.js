'use strict';

// TC-011: Sans-serif for prose, monospace only for code (AC-02i).
//
// Static CSS audit: no headless browser harness in this zero-dependency
// tool (same constraint as TC-015), so this reads public/style.css text
// directly rather than rendering it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS_PATH = path.join(__dirname, '..', 'public', 'style.css');
const css = fs.readFileSync(CSS_PATH, 'utf8');

// Selectors whose font-family is expected to describe interface prose.
const PROSE_SELECTORS = new Set(['html', 'body', ':root', '.doc-panel', '.panel']);

// A selector counts as "code-like" (allowed to declare a monospace stack)
// when it targets code/pre/kbd/samp elements or a `.mono`-style class,
// anywhere in the selector chain (e.g. `.md-body pre code`).
const CODE_LIKE_RE = /(^|[\s>+~.])(code|pre|kbd|samp)\b|\.mono\b/i;

function isCodeLikeSelector(selector) {
  return CODE_LIKE_RE.test(selector.trim());
}

// Naive top-level rule parser: `selector-list { declarations }`. Good enough
// for this hand-authored stylesheet (no nested rules, no @-blocks around
// font-family declarations) — same complexity level as the project's other
// hand-rolled parsers (e.g. lib/contrast.js's parseRootTokens).
function extractFontFamilyRules(cssText) {
  const rules = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = ruleRe.exec(cssText))) {
    const selectorList = match[1].trim();
    const body = match[2];
    if (!selectorList || selectorList.startsWith('@')) continue;
    const famMatch = body.match(/font-family\s*:\s*([^;]+);?/i);
    if (!famMatch) continue;
    const selectors = selectorList.split(',').map((s) => s.trim());
    const tokens = famMatch[1]
      .split(',')
      .map((t) => t.trim().replace(/^["']|["']$/g, '').toLowerCase());
    rules.push({ selectors, raw: famMatch[1].trim(), tokens });
  }
  return rules;
}

const rules = extractFontFamilyRules(css);

test('style.css declares at least one font-family rule', () => {
  assert.ok(rules.length > 0, 'expected to find font-family declarations in style.css');
});

test('prose selectors (body/.doc-panel/.panel/:root) use a sans-serif stack (TC-011 step 1)', () => {
  const proseRules = rules.filter((rule) =>
    rule.selectors.some((sel) => PROSE_SELECTORS.has(sel))
  );
  assert.ok(
    proseRules.length > 0,
    'expected at least one of html/body/:root/.doc-panel/.panel to declare font-family'
  );
  for (const rule of proseRules) {
    assert.ok(
      !rule.tokens.includes('serif'),
      `prose selector(s) "${rule.selectors.join(', ')}" must not use "serif" (font-family: ${rule.raw})`
    );
    assert.ok(
      !rule.tokens.includes('monospace'),
      `prose selector(s) "${rule.selectors.join(', ')}" must not use "monospace" as part of the stack (font-family: ${rule.raw})`
    );
  }
});

test('no non-code selector declares a monospace font-family (TC-011 step 2)', () => {
  for (const rule of rules) {
    const nonCodeSelectors = rule.selectors.filter((sel) => !isCodeLikeSelector(sel));
    if (nonCodeSelectors.length === 0) continue;
    assert.ok(
      !rule.tokens.includes('monospace'),
      `non-code selector(s) "${nonCodeSelectors.join(', ')}" must not declare a monospace font-family (font-family: ${rule.raw})`
    );
  }
});

test('code-like selectors that declare font-family keep it monospace (TC-011 step 2)', () => {
  const codeRules = rules.filter((rule) => rule.selectors.every(isCodeLikeSelector));
  for (const rule of codeRules) {
    assert.ok(
      rule.tokens.includes('monospace'),
      `code-like selector(s) "${rule.selectors.join(', ')}" must include "monospace" in its stack (font-family: ${rule.raw})`
    );
  }
});
