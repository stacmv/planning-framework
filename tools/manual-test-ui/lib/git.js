"use strict";

// Thin wrappers around `git`, used only for: figuring out what branch is
// checked out, whether a file exists on the issue's own branch when it's
// not on disk, and — with explicit user confirmation from the UI —
// checking that branch out. No other git operations are ever run here:
// no commit, no push, no merge. Committing stays the job of /pf-close.

const { execFileSync } = require("node:child_process");

function git(cwd, args) {
  // Explicit stdio: "not found" is an expected, routine outcome for
  // branchExists()/showFile() (existence is checked via failure), so their
  // stderr must never leak to the server's own console/log.
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function tryGit(cwd, args) {
  try {
    return { ok: true, stdout: git(cwd, args) };
  } catch (e) {
    return { ok: false, stdout: "", stderr: (e.stderr || e.message || "").toString() };
  }
}

function getCurrentBranch(cwd) {
  const r = tryGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return r.ok ? r.stdout.trim() : null;
}

function isWorkingTreeClean(cwd) {
  const r = tryGit(cwd, ["status", "--porcelain"]);
  return r.ok && r.stdout.trim() === "";
}

function branchExists(cwd, branch) {
  return tryGit(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).ok;
}

// Reads `<relPath>` (POSIX-style, forward slashes) as it exists in `ref`,
// without touching the working tree. Returns null if the ref or path
// doesn't exist rather than throwing — callers treat "not found" as a
// normal, expected outcome.
function showFile(cwd, ref, relPathPosix) {
  const r = tryGit(cwd, ["show", `${ref}:${relPathPosix}`]);
  return r.ok ? r.stdout : null;
}

// Lists the immediate child names of `<relPath>` (POSIX-style) as it exists
// in `ref`, without touching the working tree — this is how issues are
// enumerated from the project's default branch regardless of what's
// currently checked out. Returns [] if the ref or path doesn't exist.
function listTreeNames(cwd, ref, relPathPosix) {
  const r = tryGit(cwd, ["ls-tree", "--name-only", `${ref}:${relPathPosix}`]);
  if (!r.ok) return [];
  return r.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
}

// Picks the branch that should be treated as the source of truth for "what
// issues exist" — a configured override if it actually exists, else the
// first of develop/main/master that exists, else whatever is checked out
// right now (last resort, for a repo that uses none of those names).
function resolveDefaultBranch(cwd, configured) {
  if (configured && branchExists(cwd, configured)) return configured;
  for (const candidate of ["develop", "main", "master"]) {
    if (branchExists(cwd, candidate)) return candidate;
  }
  return getCurrentBranch(cwd);
}

// Throws with the git stderr message on failure — callers decide how to
// surface that (this is the one operation here with a real side effect).
function checkoutBranch(cwd, branch) {
  const r = tryGit(cwd, ["checkout", branch]);
  if (!r.ok) throw new Error(r.stderr.trim() || `git checkout ${branch} failed`);
  return true;
}

// ---------------------------------------------------------------------------
// Human-task completion (POST .../human-tasks/:key/complete) — read-only
// checks only, same "no shell, array-form args" discipline as the rest of
// this module. None of these builds a ref/path from unvalidated user input:
// callers pass an `issueId`/`key` already checked against their own
// allowlists (ISSUE_ID_RE, the 8 known PIPELINE_KEYS) before any of these
// functions is reached.
// ---------------------------------------------------------------------------

// True iff `git status --porcelain -- <relPath>` prints nothing — i.e.
// `relPath` (project-root-relative, POSIX-style) is fully committed, with no
// staged, unstaged or untracked (`??`) state. `relPath` is never interpolated
// into a shell string — it is one element of the array `execFileSync` passes
// straight to the `git` process.
function isPathCommitted(cwd, relPath) {
  const r = tryGit(cwd, ["status", "--porcelain", "--", relPath]);
  return r.ok && r.stdout.trim() === "";
}

// The parent branch of `issueBranch` (e.g. "issue/20260101-feat-x"), exactly
// as `pf-close` Phase 3 resolves it: the branch's own configured upstream
// (`branch.<issueBranch>.merge`) when it names something other than the
// issue branch itself (a self-tracking upstream set by `git push -u` on the
// issue branch is never a parent), else `develop` if it exists, else `main`.
function parentBranchOf(cwd, issueBranch) {
  const r = tryGit(cwd, ["config", `branch.${issueBranch}.merge`]);
  if (r.ok) {
    const raw = r.stdout.trim();
    if (raw) {
      const branch = raw.startsWith("refs/heads/") ? raw.slice("refs/heads/".length) : raw;
      if (branch && branch !== issueBranch) return branch;
    }
  }
  if (branchExists(cwd, "develop")) return "develop";
  return "main";
}

// `git rev-list --count <parentBranch>..<issueBranch>` — how many commits
// `issueBranch` is ahead of `parentBranch`. 0 on any git failure (e.g. one of
// the two branches doesn't exist) rather than throwing: "ahead by zero" and
// "could not tell" are the same non-event to every caller of this function.
function commitsAhead(cwd, parentBranch, issueBranch) {
  const r = tryGit(cwd, ["rev-list", "--count", `${parentBranch}..${issueBranch}`]);
  if (!r.ok) return 0;
  const n = Number.parseInt(r.stdout.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

// `git diff --name-only <parentBranch>..<issueBranch>` — the paths touched by
// the issue branch's commits, relative to the repo root. [] on any git
// failure, never thrown.
function changedFilesBetween(cwd, parentBranch, issueBranch) {
  const r = tryGit(cwd, ["diff", "--name-only", `${parentBranch}..${issueBranch}`]);
  if (!r.ok) return [];
  return r.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// `git rev-parse <ref>` — the full SHA `ref` currently resolves to (NOT
// `--abbrev-ref`, which resolves a symbolic name instead of a commit).
// `null` on any git failure (unknown ref), never thrown.
function revParse(cwd, ref) {
  const r = tryGit(cwd, ["rev-parse", ref]);
  return r.ok ? r.stdout.trim() : null;
}

module.exports = {
  getCurrentBranch,
  isWorkingTreeClean,
  branchExists,
  showFile,
  listTreeNames,
  resolveDefaultBranch,
  checkoutBranch,
  isPathCommitted,
  parentBranchOf,
  commitsAhead,
  changedFilesBetween,
  revParse,
};
