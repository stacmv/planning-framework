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
