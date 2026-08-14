'use strict';

/**
 * tools/onboarding-tui/test/menu.test.js
 *
 * TC-036 — the single `converge` action token across all three productive
 *          states, and no live reference to the scripts it replaces.
 * TC-037 — printDiagnostics() prints .pf-version.
 *
 * KI-9: showMenu() is never called from here. It opens readline on
 * process.stdin and loops until it gets valid input, so under `node --test`
 * it would hang forever. Only the exported MENUS map and printDiagnostics()
 * are exercised.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { MENUS, printDiagnostics } = require('../lib/menu.js');
const actions = require('../lib/actions.js');

const TUI_ROOT = path.join(__dirname, '..');
const TOOLS_ROOT = path.join(TUI_ROOT, '..');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'menu-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function actionsOf(state) {
  return MENUS[state].map((item) => item.action);
}

/** Capture everything printed to console.log while `fn` runs. */
function captureLog(fn) {
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines.join('\n');
}

/** Every file under `dir`, recursively. */
function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      out.push(...walkFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// TC-036: one action token — `converge` — in none, v2-or-older and v3
// ═══════════════════════════════════════════════════════════════════════════

test('TC-036 step 1: MENUS.none offers converge, and no `install` token remains', () => {
  const tokens = actionsOf('none');
  assert.ok(tokens.includes('converge'), 'MENUS.none has no converge item');
  assert.ok(!tokens.includes('install'), 'MENUS.none still carries the old `install` token');

  const item = MENUS.none.find((i) => i.action === 'converge');
  assert.match(item.label, /install/i, 'the none-state label should read as an install');
});

test("TC-036 step 2: MENUS['v2-or-older'] offers converge, and no `migrate` token remains", () => {
  // This closes the deferred step 2 of TC-002 (test/converge-fresh.sh).
  const tokens = actionsOf('v2-or-older');
  assert.ok(tokens.includes('converge'), "MENUS['v2-or-older'] has no converge item");
  assert.ok(!tokens.includes('migrate'), "MENUS['v2-or-older'] still carries the old `migrate` token");

  const item = MENUS['v2-or-older'].find((i) => i.action === 'converge');
  assert.match(item.label, /migrat/i, 'the v2 label should read as a migration');
});

test('TC-036 step 3: MENUS.v3 offers converge — an incomplete v3 project can top itself up (Р11)', () => {
  const tokens = actionsOf('v3');
  assert.ok(tokens.includes('converge'), 'MENUS.v3 has no converge item — Р11 is unimplemented');
  assert.ok(tokens.includes('update-skills'));
  assert.ok(tokens.includes('issue-status'));
});

test('TC-036 step 3b: MENUS.v4 offers converge and adapter actions', () => {
  const tokens = actionsOf('v4');
  assert.ok(tokens.includes('converge'), 'MENUS.v4 has no converge item');
  assert.ok(tokens.includes('update-skills'));
  assert.ok(tokens.includes('issue-status'));
});

test('TC-036 step 4: MENUS.unknown is untouched — exactly one item, `diagnose`', () => {
  assert.deepStrictEqual(actionsOf('unknown'), ['diagnose']);
  assert.strictEqual(MENUS.unknown.length, 1);
});

test('TC-036: menu keys are unique within every state', () => {
  for (const state of Object.keys(MENUS)) {
    const keys = MENUS[state].map((i) => i.key);
    assert.deepStrictEqual([...new Set(keys)], keys, `duplicate menu key in MENUS.${state}`);
  }
});

test('TC-036 step 5: actions.js exports runConverge and nothing named after the old scripts', () => {
  assert.strictEqual(typeof actions.runConverge, 'function');
  assert.strictEqual(actions.runSetupV3, undefined, 'runSetupV3 must be gone');
  assert.strictEqual(actions.runMigrateV2ToV3, undefined, 'runMigrateV2ToV3 must be gone');

  const src = fs.readFileSync(path.join(TUI_ROOT, 'lib', 'actions.js'), 'utf8');
  assert.match(src, /pf-cli\.mjs/, 'runConverge must delegate to the Node CLI');
  // The P2-7 compromise comment described a prompt-for-target quirk of the
  // script that is being deleted; it must not outlive it.
  assert.ok(!src.includes('P2-7'), 'the P2-7 compromise comment must be deleted');
});

test('TC-036 step 6: cli.js dispatches `converge` and has no install/migrate branches', () => {
  const src = fs.readFileSync(path.join(TUI_ROOT, 'cli.js'), 'utf8');
  assert.match(src, /action === "converge"/, 'cli.js does not dispatch the converge token');
  assert.match(src, /runConverge\(/, 'cli.js does not call runConverge');
  assert.ok(!/action === "install"/.test(src), 'cli.js still has an `install` branch');
  assert.ok(!/action === "migrate"/.test(src), 'cli.js still has a `migrate` branch');
});

test('TC-036 step 7: no file under tools/ names either of the two scripts being deleted', () => {
  // The Phase III gate, as a test: grepping tools/ for the names of the old
  // setup/migrate scripts must return zero — module headers and comments
  // included. The two names are ASSEMBLED at runtime rather than written out,
  // so that this file does not become the very match it is hunting for.
  const setupScript = ['setup', 'planning', 'v3'].join('-');
  const migrateScript = ['migrate', 'v2', 'to', 'v3'].join('-');
  const needle = new RegExp(`${setupScript}|${migrateScript}`);

  const offenders = walkFiles(TOOLS_ROOT).filter((file) =>
    needle.test(fs.readFileSync(file, 'utf8'))
  );
  assert.deepStrictEqual(
    offenders.map((f) => path.relative(TOOLS_ROOT, f)),
    [],
    'these files still name a script that is being deleted'
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// TC-037: printDiagnostics prints .pf-version
// ═══════════════════════════════════════════════════════════════════════════

test('TC-037 step 1: printDiagnostics prints .pf-version WITH its value when present', () => {
  const tmpDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(tmpDir, '.pf-version'), '3.0.0\n');
    const out = captureLog(() => printDiagnostics(tmpDir));
    assert.match(out, /\.pf-version/, '.pf-version line is missing');
    assert.match(out, /3\.0\.0/, "the marker's value is not printed");
    assert.match(out, /\[x\] \.pf-version/, '.pf-version should be marked as found');
  } finally {
    cleanup(tmpDir);
  }
});

test('TC-037 step 2: printDiagnostics still prints a .pf-version line when it is absent', () => {
  const tmpDir = makeTmpDir();
  try {
    const out = captureLog(() => printDiagnostics(tmpDir));
    assert.match(out, /\.pf-version/, 'the line must be reported as missing, not silently skipped');
    assert.match(out, /\[ \] \.pf-version — not found/);
  } finally {
    cleanup(tmpDir);
  }
});

test('TC-037 step 3: the other three checks still print as before', () => {
  const tmpDir = makeTmpDir();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'issues'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'PLANNING.md'), '# Planning\n');
    const out = captureLog(() => printDiagnostics(tmpDir));

    assert.match(out, /\[x\] docs\/issues\/ — found/);
    assert.match(out, /\[x\] PLANNING\.md — found/);
    assert.match(out, /\[ \] CLAUDE\.md — not found/);
    assert.match(out, new RegExp(`Diagnostics for: ${tmpDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  } finally {
    cleanup(tmpDir);
  }
});
