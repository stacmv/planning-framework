// WCAG contrast checking for the Manual Test UI's own palette
// (implementation_plan.md, Task 18; test_plan.md TC-006).
//
// Design constraints, identical to `lib/roles-resolve.js` and
// `lib/markdown.js`:
//   * zero dependencies — no npm packages and no `node:` builtins either, so
//     the same file loads under `require` and under `<script src>` through
//     the UMD wrapper below;
//   * nothing is touched at load time — no `document`, no `window`, no I/O.
//     This module never reads a file itself: a caller (a test, or server
//     code) reads `public/style.css` (or hands in an inline fixture string)
//     and passes the raw text in. That is what keeps `checkPalette` runnable
//     against a fixture string in `test/contrast.test.js` without touching
//     the real stylesheet (TC-006 steps 2-3);
//   * pure functions, deep results — nothing here mutates its input.
//
// `parseRootTokens` is a line-by-line parser, deliberately the same
// complexity level as this tool's other hand-written parsers
// (`lib/roles-resolve.js`'s indent-tree reader, `lib/markdown.js`'s block
// splitter) — not a CSS AST. It reads two things out of a stylesheet's raw
// text:
//   * `:root` custom-property color tokens (`--name: #hex;`) — the palette;
//   * literal `color: #hex;` declarations anywhere in the text — a
//     hardcoded text color that bypasses the token system entirely
//     (brd.md AC-02b: "every color applied as text color... including
//     hardcoded hex literals" must clear the same thresholds a named token
//     does). `color: var(--x)` is not a literal and is skipped here — it is
//     already covered through the token `--x` names.
//
// `checkPalette` is the one function both the real-file positive check and
// the inline-fixture negative checks call (test_plan.md TC-006's own
// wording: "та же обёрточная проверка, что использует сьют на реальном
// файле") — so "the check that runs on `public/style.css`" and "the check
// the negative fixtures exercise" are one piece of code, never two copies
// that could quietly drift apart.
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PFContrast = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ------------------------------------------------------------- luminance

  var HEX_RE = /^#([0-9a-fA-F]{6})$/;

  /** `"#rrggbb"` -> `[r, g, b]` (0-255 each), or `null` if not recognized. */
  function hexToRgb(hex) {
    var m = HEX_RE.exec(String(hex == null ? "" : hex).trim());
    if (!m) return null;
    var n = m[1];
    return [parseInt(n.substr(0, 2), 16), parseInt(n.substr(2, 2), 16), parseInt(n.substr(4, 2), 16)];
  }

  function srgbChannelToLinear(c) {
    var v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  /** WCAG relative luminance of an `[r, g, b]` triple. */
  function relativeLuminance(rgb) {
    var r = srgbChannelToLinear(rgb[0]);
    var g = srgbChannelToLinear(rgb[1]);
    var b = srgbChannelToLinear(rgb[2]);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * WCAG 2.x contrast ratio between two `#rrggbb` colors: 1 (no contrast) to
   * 21 (black vs white).
   *
   * @param {string} hexA
   * @param {string} hexB
   * @returns {number|null} `null` if either input is not a recognized
   *   6-digit hex color — never throws.
   */
  function contrastRatio(hexA, hexB) {
    var rgbA = hexToRgb(hexA);
    var rgbB = hexToRgb(hexB);
    if (!rgbA || !rgbB) return null;
    var lumA = relativeLuminance(rgbA);
    var lumB = relativeLuminance(rgbB);
    var lighter = Math.max(lumA, lumB);
    var darker = Math.min(lumA, lumB);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // ------------------------------------------------------------- CSS parsing

  var TOKEN_LINE_RE = /--([a-zA-Z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/;
  // Matches a `color: #hex;` declaration, but not `background-color:` /
  // `border-color:` — those end in "-color", and the character immediately
  // before "color" here must be line-start, `;`, `{`, `}` or whitespace.
  var COLOR_PROP_RE = /(?:^|[;{}\s])color\s*:\s*(#[0-9a-fA-F]{6})\s*;/;

  /**
   * @param {string} cssText Raw CSS source — a whole stylesheet, or an
   *   inline fixture string. Never read from disk by this module.
   * @returns {{tokens: Object<string,string>, textLiterals: string[]}}
   *   `tokens` — every `--name: #hex;` custom property found, keyed without
   *   the leading `--`, lowercased. `textLiterals` — every hardcoded
   *   `color: #hex;` value found (duplicates included; a threshold check
   *   does not care how many places repeat the same mistake).
   */
  function parseRootTokens(cssText) {
    var text = String(cssText == null ? "" : cssText)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    var lines = text.split("\n");
    var tokens = {};
    var textLiterals = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var tokenMatch = TOKEN_LINE_RE.exec(line);
      if (tokenMatch) {
        tokens[tokenMatch[1]] = tokenMatch[2].toLowerCase();
        continue; // a custom-property declaration line is not also a `color:` literal
      }
      var colorMatch = COLOR_PROP_RE.exec(line);
      if (colorMatch) textLiterals.push(colorMatch[1].toLowerCase());
    }
    return { tokens: tokens, textLiterals: textLiterals };
  }

  // ------------------------------------------------------------------ checks

  var PURE_BLACK = "#000000";
  var PURE_WHITE = "#ffffff";

  // Tokens that are backgrounds, not text — excluded from the "is this a
  // text color" set below.
  var BACKGROUND_TOKEN_NAMES = ["bg", "surface"];
  var BORDER_TOKEN_NAMES = ["border"];

  // Every other token (the main text color, status colors, the accent used
  // for panel-header text — AC-02f) is treated as a potential text color for
  // AC-02b/AC-02c. Deliberately a denylist, not an allowlist: a palette
  // token this module has never heard of is checked by default, not
  // silently skipped.
  function textTokenNames(tokens) {
    var names = [];
    for (var name in tokens) {
      if (!Object.prototype.hasOwnProperty.call(tokens, name)) continue;
      if (BACKGROUND_TOKEN_NAMES.indexOf(name) !== -1) continue;
      if (BORDER_TOKEN_NAMES.indexOf(name) !== -1) continue;
      names.push(name);
    }
    return names;
  }

  function addViolation(violations, rule, fields) {
    var v = { rule: rule };
    for (var k in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, k)) v[k] = fields[k];
    }
    violations.push(v);
  }

  function checkAgainstBackgrounds(violations, rule, threshold, label, hex, bg, surface) {
    if (bg) {
      var ratioBg = contrastRatio(hex, bg);
      if (ratioBg !== null && ratioBg < threshold) {
        addViolation(violations, rule, { a: label, b: "bg", hexA: hex, hexB: bg, ratio: ratioBg, threshold: threshold });
      }
    }
    if (surface) {
      var ratioSurface = contrastRatio(hex, surface);
      if (ratioSurface !== null && ratioSurface < threshold) {
        addViolation(violations, rule, { a: label, b: "surface", hexA: hex, hexB: surface, ratio: ratioSurface, threshold: threshold });
      }
    }
  }

  /**
   * Run every AC-02a-02c threshold (brd.md) against one parsed palette
   * (`parseRootTokens`'s return value). Returns the list of violations —
   * empty when the palette is clean.
   *
   * @param {{tokens: Object<string,string>, textLiterals: string[]}} parsed
   * @returns {Array<{rule: string, [key: string]: *}>}
   */
  function checkPalette(parsed) {
    var tokens = (parsed && parsed.tokens) || {};
    var textLiterals = (parsed && parsed.textLiterals) || [];
    var violations = [];

    var bg = tokens.bg;
    var surface = tokens.surface;
    var border = tokens.border;
    var text = tokens.text;

    // AC-02a: --text to --surface >= 7:1.
    if (text && surface) {
      var mainRatio = contrastRatio(text, surface);
      if (mainRatio !== null && mainRatio < 7) {
        addViolation(violations, "text-surface-minimum", {
          a: "text",
          b: "surface",
          hexA: text,
          hexB: surface,
          ratio: mainRatio,
          threshold: 7,
        });
      }
    }

    // AC-02b: every text-ish color (named token or hardcoded literal) to
    // --bg and to --surface, >= 4.5:1. Also feeds AC-02c's "no pure white
    // text" check below.
    var candidates = [];
    var names = textTokenNames(tokens);
    var i;
    for (i = 0; i < names.length; i++) {
      candidates.push({ label: names[i], hex: tokens[names[i]] });
    }
    for (i = 0; i < textLiterals.length; i++) {
      candidates.push({ label: "literal:" + textLiterals[i], hex: textLiterals[i] });
    }

    for (i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      checkAgainstBackgrounds(violations, "text-background-minimum", 4.5, c.label, c.hex, bg, surface);
      if (String(c.hex).toLowerCase() === PURE_WHITE) {
        addViolation(violations, "pure-white-text", { a: c.label, hexA: c.hex });
      }
    }

    // AC-02c: borders to neighboring backgrounds, >= 1.5:1.
    if (border) {
      checkAgainstBackgrounds(violations, "border-background-minimum", 1.5, "border", border, bg, surface);
    }

    // AC-02c: no pure black background, on either background token.
    for (i = 0; i < BACKGROUND_TOKEN_NAMES.length; i++) {
      var bgName = BACKGROUND_TOKEN_NAMES[i];
      var bgHex = tokens[bgName];
      if (bgHex && String(bgHex).toLowerCase() === PURE_BLACK) {
        addViolation(violations, "pure-black-background", { a: bgName, hexA: bgHex });
      }
    }

    return violations;
  }

  return {
    hexToRgb: hexToRgb,
    relativeLuminance: relativeLuminance,
    contrastRatio: contrastRatio,
    parseRootTokens: parseRootTokens,
    checkPalette: checkPalette,
  };
});
