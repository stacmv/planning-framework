"use strict";

// Content-addressed snapshots of a directory tree.
//
// Several test cases in this issue's test plan are phrased as "do something,
// then prove nothing else moved" — reset a prepared case and expect the tree
// to come back byte for byte (TC-003), prepare one case and expect a sibling
// case's tree untouched, run a read-only route and expect the repository
// unchanged (TC-012). All of those want the same primitive: a stable,
// comparable fingerprint of a directory.
//
// Deliberately content-based, not mtime-based: a script that rewrites a file
// with identical bytes must count as "unchanged", because that is exactly
// what an idempotent setup.mjs does.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * Fingerprint every file under `dir`, recursively.
 *
 * Returns a list of `{ relPath, sha256, size }`, sorted by `relPath`, with
 * POSIX-style separators so a snapshot compares equal across platforms.
 *
 * - A directory that contains nothing at all is recorded as a single entry
 *   `{ relPath: "<rel>/", sha256: null, size: null }`. Git cannot store empty
 *   directories, so fixtures use a `.gitkeep` inside them — but a *prepared*
 *   working copy may legitimately contain one, and "the empty directory
 *   disappeared" has to be a visible difference rather than a silent one.
 * - Symlinks are recorded by their target, never followed: following them
 *   would let a fixture escape the tree being fingerprinted.
 * - A missing `dir` yields `[]` rather than throwing — "nothing here yet" is
 *   a normal state to compare against (e.g. before the first prepare run).
 *
 * @param {string} dir
 * @param {{ exclude?: (relPath: string) => boolean }} [options]
 *   `exclude` is consulted with the POSIX-style relative path of every entry
 *   (directories included, without a trailing slash); returning true prunes
 *   it. Used to keep `.git` out of repository snapshots.
 * @returns {Array<{relPath: string, sha256: string|null, size: number|null}>}
 */
function snapshot(dir, options = {}) {
  const exclude = options.exclude || (() => false);
  const out = [];
  if (!fs.existsSync(dir)) return out;

  const walk = (absDir, relDir) => {
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    let kept = 0;
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (exclude(rel)) continue;
      kept++;
      const abs = path.join(absDir, entry.name);
      if (entry.isSymbolicLink()) {
        const target = fs.readlinkSync(abs);
        out.push({ relPath: rel, sha256: `symlink:${sha256(Buffer.from(target, "utf8"))}`, size: null });
      } else if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.isFile()) {
        const buf = fs.readFileSync(abs);
        out.push({ relPath: rel, sha256: sha256(buf), size: buf.length });
      }
      // Sockets, FIFOs and device nodes have no place in a fixture tree and
      // are skipped rather than guessed at.
    }
    if (kept === 0 && relDir) {
      out.push({ relPath: `${relDir}/`, sha256: null, size: null });
    }
  };

  walk(dir, "");
  out.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
  return out;
}

/** Snapshot of a git working tree, with `.git` itself pruned. */
function snapshotWorkingTree(dir, options = {}) {
  const inner = options.exclude || (() => false);
  return snapshot(dir, {
    ...options,
    exclude: (rel) => rel === ".git" || rel.startsWith(".git/") || inner(rel),
  });
}

/**
 * Structured difference between two snapshots — the thing you actually want
 * in an assertion message, since "expected [1200 entries] to deep-equal
 * [1200 entries]" tells a reader nothing.
 *
 * @returns {{added: string[], removed: string[], changed: string[]}}
 */
function diffSnapshots(before, after) {
  const b = new Map(before.map((e) => [e.relPath, e.sha256]));
  const a = new Map(after.map((e) => [e.relPath, e.sha256]));
  const added = [];
  const removed = [];
  const changed = [];
  for (const [rel, hash] of a) {
    if (!b.has(rel)) added.push(rel);
    else if (b.get(rel) !== hash) changed.push(rel);
  }
  for (const rel of b.keys()) {
    if (!a.has(rel)) removed.push(rel);
  }
  added.sort();
  removed.sort();
  changed.sort();
  return { added, removed, changed };
}

function formatDiff(diff) {
  const parts = [];
  if (diff.added.length) parts.push(`added: ${diff.added.join(", ")}`);
  if (diff.removed.length) parts.push(`removed: ${diff.removed.join(", ")}`);
  if (diff.changed.length) parts.push(`changed: ${diff.changed.join(", ")}`);
  return parts.length ? parts.join(" | ") : "no differences";
}

/**
 * Assert two snapshots are identical, reporting *what* differs rather than
 * dumping both lists.
 */
function assertSameSnapshot(before, after, message = "tree changed") {
  const diff = diffSnapshots(before, after);
  if (diff.added.length || diff.removed.length || diff.changed.length) {
    assert.fail(`${message} — ${formatDiff(diff)}`);
  }
}

/** Assert two snapshots differ — the guard half of an idempotency test. */
function assertSnapshotDiffers(before, after, message = "expected the tree to change") {
  const diff = diffSnapshots(before, after);
  if (!diff.added.length && !diff.removed.length && !diff.changed.length) {
    assert.fail(`${message} — but the trees are identical`);
  }
}

module.exports = {
  snapshot,
  snapshotWorkingTree,
  diffSnapshots,
  formatDiff,
  assertSameSnapshot,
  assertSnapshotDiffers,
  sha256,
};
