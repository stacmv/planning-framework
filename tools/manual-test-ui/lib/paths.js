"use strict";

// The single place in the Manual Test UI where "may this be read?" is
// decided (implementation_plan.md, Task 6).
//
// Two rules, and nothing else:
//
//  1. Containment is decided on *real* paths (`fs.realpathSync`) compared by
//     path segments (`path.relative`), never by string prefix. A string
//     prefix says `/tool/public-x/evil.js` is inside `/tool/public`, and a
//     symlink says a file is inside a directory it merely points into from.
//     Both are wrong, and both used to be reachable through `serveStatic`.
//  2. Exactly two read roots exist: the project directory itself, and one
//     extra prefix — `<memoryRoot>/projects/<slug>/memory/`, the accumulated
//     memory Claude Code keeps for that project outside the repository. No
//     other directory outside the project is readable, ever.
//
// Session transcripts (`*.jsonl`, `sessions-index.json`) live *next to*
// `memory/`, not inside it, and are additionally rejected by name: they are
// raw conversation logs, not a project document, and this tool never shows
// them.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Overridable so a test never reads (or is influenced by) the developer's
// real `~/.claude`.
const MEMORY_ROOT_ENV = "PLANNING_TEST_UI_MEMORY_ROOT";

const SESSIONS_INDEX_NAME = "sessions-index.json";

/**
 * `fs.realpathSync` for a path that need not exist: resolves the longest
 * existing ancestor and re-appends the remainder.
 *
 * A non-existent path still has to be judged (a 403 for an escaping path
 * must not depend on whether the attacker guessed a file name that exists),
 * and the remainder cannot reintroduce an escape because `path.resolve`
 * has already collapsed every `..` before the walk starts.
 */
function realpathOrNearest(target) {
  let current = path.resolve(target);
  const remainder = [];
  for (;;) {
    try {
      const real = fs.realpathSync(current);
      return remainder.length ? path.join(real, ...remainder) : real;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      remainder.unshift(path.basename(current));
      current = parent;
    }
  }
}

// Segment-wise containment on two already-real paths. `path.relative` of a
// directory that merely shares a textual prefix starts with a `..` segment;
// a directory genuinely named `..foo` does not, which is why the first
// segment is compared rather than the string prefixed with "..".
function containsPath(realRoot, realCandidate) {
  if (realRoot === realCandidate) return true;
  const rel = path.relative(realRoot, realCandidate);
  if (rel === "" ) return true;
  if (path.isAbsolute(rel)) return false;
  return rel.split(path.sep)[0] !== "..";
}

/**
 * Is `candidatePath` the directory `rootDir` itself or something under it,
 * after both have been resolved through symlinks?
 */
function isInside(rootDir, candidatePath) {
  return containsPath(realpathOrNearest(rootDir), realpathOrNearest(candidatePath));
}

/**
 * Resolve a client-supplied path against one allowed root.
 *
 * Accepts either a path relative to `rootDir` or an absolute one; both end
 * up judged the same way, so there is no encoding of the request that gets
 * a different answer than another. Returns a failure *record* rather than
 * throwing: every caller turns it into a 4xx, and a 500 here would itself
 * be a defect (TC-011).
 *
 * @returns {{ok: true, path: string, realPath: string, relativePath: string}
 *          |{ok: false, status: number, error: string, message: string}}
 */
function resolveWithinRoot(rootDir, requested) {
  if (typeof requested !== "string" || requested.trim() === "") {
    return { ok: false, status: 400, error: "missing_path", message: "A `path` query parameter is required." };
  }
  if (requested.includes("\0")) {
    return { ok: false, status: 400, error: "invalid_path", message: "The path contains a NUL byte." };
  }
  const absolute = path.isAbsolute(requested) ? path.resolve(requested) : path.resolve(rootDir, requested);
  if (!isInside(rootDir, absolute)) {
    return {
      ok: false,
      status: 403,
      error: "path_not_allowed",
      message: "The requested path is outside the directories this tool may read.",
    };
  }
  return {
    ok: true,
    path: absolute,
    realPath: realpathOrNearest(absolute),
    relativePath: toPosix(path.relative(rootDir, absolute)),
  };
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

// ---------------------------------------------------------------------------
// The one allowed extension outside the project: accumulated memory
// ---------------------------------------------------------------------------

/**
 * Claude Code keys per-project state by the project's absolute path with
 * every non-alphanumeric character replaced by a dash:
 * `/home/stac/dev/planning-framework` → `-home-stac-dev-planning-framework`.
 *
 * The mapping is lossy on purpose (a path already containing dashes, dots or
 * non-ASCII characters collapses into the same alphabet) — this function only
 * has to reproduce it, not invert it. Kept identical to
 * `test/helpers/fixtures.js:slugForProjectPath`, which builds the fixtures.
 */
function slugForProjectPath(projectPath) {
  return path.resolve(projectPath).replace(/[^A-Za-z0-9]/g, "-");
}

function memoryRoot(env = process.env) {
  const configured = env && env[MEMORY_ROOT_ENV];
  if (configured && String(configured).trim() !== "") return path.resolve(String(configured).trim());
  return path.join(os.homedir(), ".claude");
}

// `<memoryRoot>/projects/<slug>` — the directory that also holds the session
// transcripts, which is why it is never itself a read root.
function projectStateDir(projectRoot, env = process.env) {
  return path.join(memoryRoot(env), "projects", slugForProjectPath(projectRoot));
}

// `<memoryRoot>/projects/<slug>/memory` — the read root.
function memoryDirForProject(projectRoot, env = process.env) {
  return path.join(projectStateDir(projectRoot, env), "memory");
}

/** `*.jsonl` or `sessions-index.json`, at any depth. Never shown, never read. */
function isSessionTranscript(filePath) {
  const base = path.basename(String(filePath));
  return base.toLowerCase().endsWith(".jsonl") || base === SESSIONS_INDEX_NAME;
}

/** Read-permission check for a document of the project itself. */
function resolveProjectFile(projectRoot, requested) {
  return resolveWithinRoot(projectRoot, requested);
}

/**
 * Read-permission check for a memory file, i.e. the *only* path that is
 * allowed to sit outside the project directory.
 *
 * Normalisation happens before the prefix comparison, so
 * `memory/../../secrets.md` is rejected; transcripts are rejected on top of
 * that even though `<slug>/*.jsonl` already escapes `memory/`.
 */
function resolveMemoryFile(projectRoot, requested, env = process.env) {
  const memoryDir = memoryDirForProject(projectRoot, env);
  const resolved = resolveWithinRoot(memoryDir, requested);
  if (!resolved.ok) return resolved;
  if (isSessionTranscript(resolved.path)) {
    return {
      ok: false,
      status: 403,
      error: "transcript_not_readable",
      message: "Session transcripts are not part of what this tool shows.",
    };
  }
  return { ...resolved, memoryDir };
}

module.exports = {
  MEMORY_ROOT_ENV,
  SESSIONS_INDEX_NAME,
  realpathOrNearest,
  containsPath,
  isInside,
  resolveWithinRoot,
  toPosix,
  slugForProjectPath,
  memoryRoot,
  projectStateDir,
  memoryDirForProject,
  isSessionTranscript,
  resolveProjectFile,
  resolveMemoryFile,
};
