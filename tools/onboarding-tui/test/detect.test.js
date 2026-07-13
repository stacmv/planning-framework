'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { detectState } = require('../lib/detect.js');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'detect-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('TC-001: empty temp dir with no markers -> none', () => {
  const tmpDir = makeTmpDir();
  try {
    const result = detectState(tmpDir);
    assert.strictEqual(result, 'none');
  } finally {
    cleanup(tmpDir);
  }
});

test('TC-003: only CLAUDE.md present -> v2-or-older', () => {
  const tmpDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# Some old CLAUDE.md content\n');
    const result = detectState(tmpDir);
    assert.strictEqual(result, 'v2-or-older');
  } finally {
    cleanup(tmpDir);
  }
});

test('TC-002: PLANNING.md with valid v3.x marker plus CLAUDE.md -> v3 (v3 wins)', () => {
  const tmpDir = makeTmpDir();
  try {
    fs.writeFileSync(
      path.join(tmpDir, 'PLANNING.md'),
      '# Planning Framework\n\n**Framework Version:** 3.0.0\n'
    );
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# Some old CLAUDE.md content\n');
    const result = detectState(tmpDir);
    assert.strictEqual(result, 'v3');
  } finally {
    cleanup(tmpDir);
  }
});

test('TC-004: PLANNING.md with invalid/mismatched version marker -> unknown', () => {
  const tmpDir = makeTmpDir();
  try {
    fs.writeFileSync(
      path.join(tmpDir, 'PLANNING.md'),
      '# Planning Framework\n\n**Framework Version:** 4.0.0\n'
    );
    const result = detectState(tmpDir);
    assert.strictEqual(result, 'unknown');
  } finally {
    cleanup(tmpDir);
  }
});

test('TC-004b: PLANNING.md with no version line at all -> unknown', () => {
  const tmpDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(tmpDir, 'PLANNING.md'), '# Planning Framework\n\nNo version info here.\n');
    const result = detectState(tmpDir);
    assert.strictEqual(result, 'unknown');
  } finally {
    cleanup(tmpDir);
  }
});

test('P0-1: fallback v3 fingerprint (docs/issues/{open,closed} + session-log.md, no PLANNING.md) -> v3', () => {
  const tmpDir = makeTmpDir();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'issues', 'open'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs', 'issues', 'closed'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs', 'planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'planning', 'session-log.md'), '# Session Log\n');
    const result = detectState(tmpDir);
    assert.strictEqual(result, 'v3');
  } finally {
    cleanup(tmpDir);
  }
});

test('partial/ambiguous: only docs/issues/open present (no closed, no session-log) -> unknown', () => {
  const tmpDir = makeTmpDir();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'issues', 'open'), { recursive: true });
    const result = detectState(tmpDir);
    assert.strictEqual(result, 'unknown');
  } finally {
    cleanup(tmpDir);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Cases below belong to issue 20260713-bug-v2-to-v3-migration-defects.
//
// They carry the TCD- prefix on purpose (KI-20): the labels TC-001…TC-004b
// and P0-1 above are already taken by ANOTHER issue, and the two trackers
// must not collide. The bodies above are not renamed and not edited — TC-035
// asserts exactly that they stay green under the new detection order.
// ═══════════════════════════════════════════════════════════════════════════

const { MENUS } = require('../lib/menu.js');

// ─── helpers ───────────────────────────────────────────────────────────────

function writePfVersion(dir, value) {
  fs.writeFileSync(path.join(dir, '.pf-version'), `${value}\n`);
}

function writePlanningMd(dir, stamp) {
  const body =
    stamp === null
      ? '# Planning Framework\n\nNo version info here.\n'
      : `# Planning Framework\n\n**Framework Version:** ${stamp}\n`;
  fs.writeFileSync(path.join(dir, 'PLANNING.md'), body);
}

/** The v2 structural fingerprint: planning/issues/{open,closed}. */
function makeV2Layout(dir) {
  fs.mkdirSync(path.join(dir, 'planning', 'issues', 'open'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'planning', 'issues', 'closed'), { recursive: true });
}

/** The v3 structural fingerprint: docs/issues/{open,closed} + session-log.md. */
function makeV3Layout(dir) {
  fs.mkdirSync(path.join(dir, 'docs', 'issues', 'open'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'issues', 'closed'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'planning'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'planning', 'session-log.md'), '# Session Log\n');
}

/** Run `fn(tmpDir)` in a fresh temp dir, then return detectState()'s verdict. */
function stateAfter(fn) {
  const tmpDir = makeTmpDir();
  try {
    fn(tmpDir);
    return detectState(tmpDir);
  } finally {
    cleanup(tmpDir);
  }
}

// Every token any TCD- case observes, collected for TC-034 step 6.
const observedTokens = new Set();

function assertState(fn, expected, message) {
  const actual = stateAfter(fn);
  observedTokens.add(actual);
  assert.strictEqual(actual, expected, message);
}

// ─── TC-033 (TCD-01…TCD-06): .pf-version outranks the PLANNING.md stamp ────
//
// None of these cases creates planning/issues/, so rule 1 never fires here and
// what is under test is rule 2 — the machine-readable marker beating the
// document stamp, in both directions.

test('TCD-01: .pf-version 3.0.0 beats a 2.0-stamped PLANNING.md -> v3', () => {
  assertState((dir) => {
    writePfVersion(dir, '3.0.0');
    writePlanningMd(dir, '2.0');
  }, 'v3');
});

test('TCD-02: .pf-version 2.0.0 beats a 3.0-stamped PLANNING.md -> v2-or-older', () => {
  assertState((dir) => {
    writePfVersion(dir, '2.0.0');
    writePlanningMd(dir, '3.0');
  }, 'v2-or-older');
});

test('TCD-03: .pf-version 1.0.0 -> v2-or-older (no separate v1 token — KI-9)', () => {
  assertState((dir) => writePfVersion(dir, '1.0.0'), 'v2-or-older');
});

test('TCD-04: .pf-version 4.0.0 (a future version) -> unknown', () => {
  assertState((dir) => writePfVersion(dir, '4.0.0'), 'unknown');
});

test('TCD-05: .pf-version holding garbage -> unknown', () => {
  assertState((dir) => writePfVersion(dir, 'hello'), 'unknown');
});

test('TCD-06: .pf-version 3.1.0 -> v3 (the rule is 3.x, not 3.0 exactly)', () => {
  assertState((dir) => writePfVersion(dir, '3.1.0'), 'v3');
});

// ─── TC-034 (TCD-07…TCD-11): real v2, v1, and the mixed layout (defect 6) ──

test('TCD-07: a real v2 project (2.0-stamped PLANNING.md + planning/issues/) -> v2-or-older', () => {
  // Defect 6: today the 2.0 stamp short-circuits to 'unknown' and the TUI
  // never offers Migrate. Rule 1 answers first here; rule 3 would agree.
  assertState((dir) => {
    makeV2Layout(dir);
    writePlanningMd(dir, '2.0');
  }, 'v2-or-older');
});

test('TCD-08: planning/issues/ with no PLANNING.md at all -> v2-or-older', () => {
  assertState((dir) => makeV2Layout(dir), 'v2-or-older');
});

test('TCD-09: a v1 project (CLAUDE.md + docs/planning/session-log.md) -> v2-or-older', () => {
  // Rule 5. No new token is introduced: converge tells v1 from v2 internally.
  assertState((dir) => {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Planning Framework Integration\n');
    fs.mkdirSync(path.join(dir, 'docs', 'planning'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs', 'planning', 'session-log.md'), '# Session Log\n');
  }, 'v2-or-older');
});

test('TCD-10: mixed/half-migrated layout -> v2-or-older, even once markers say v3', () => {
  // The whole reason rule 1 comes first. A convergence run whose phase-3
  // transfer failed (D-B) skips phase 5 — planning/ survives — yet phase 6 has
  // legitimately written .pf-version = 3.0.0 and a 3.0-stamped PLANNING.md.
  // Reading the marker first would report 'v3', hand the project the v3 menu,
  // and leave the untransferred data silently behind. This is TC-054 step 8.
  const tmpDir = makeTmpDir();
  try {
    makeV2Layout(tmpDir);
    makeV3Layout(tmpDir);

    // (a) mixed layout, no version markers yet.
    let result = detectState(tmpDir);
    observedTokens.add(result);
    assert.strictEqual(result, 'v2-or-older', 'mixed layout, no markers');

    // (b) the same project after a failed migration topped it up to T1–T8.
    writePfVersion(tmpDir, '3.0.0');
    writePlanningMd(tmpDir, '3.0');
    result = detectState(tmpDir);
    observedTokens.add(result);
    assert.strictEqual(result, 'v2-or-older', 'failed migration must not report v3');
  } finally {
    cleanup(tmpDir);
  }
});

test('TCD-11: a 4.0-stamped PLANNING.md next to CLAUDE.md -> unknown, not v2', () => {
  // Rule 5 keeps its "no PLANNING.md" precondition: a future version must not
  // be classified as v2 and offered a migration DOWNWARDS.
  assertState((dir) => {
    writePlanningMd(dir, '4.0');
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Some CLAUDE.md content\n');
  }, 'unknown');
});

// ─── TC-034 step 6: every token detectState can return has a menu ───────────

test('TCD: every state token observed above is a key of MENUS (KI-9)', () => {
  // showMenu() throws on an unknown state — and it is NOT called here: it opens
  // readline on process.stdin and loops until valid input, so under `node --test`
  // it would hang. The exported MENUS map is checked instead.
  assert.deepStrictEqual(Object.keys(MENUS).sort(), ['none', 'unknown', 'v2-or-older', 'v3']);

  // 'none' comes from TC-001 above, which does not feed observedTokens.
  observedTokens.add(stateAfter(() => {}));

  const menuKeys = new Set(Object.keys(MENUS));
  for (const token of observedTokens) {
    assert.ok(menuKeys.has(token), `detectState returned "${token}", which has no menu`);
  }
  assert.deepStrictEqual([...observedTokens].sort(), ['none', 'unknown', 'v2-or-older', 'v3']);
});
