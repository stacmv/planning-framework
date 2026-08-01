'use strict';

const fs = require('node:fs');
const path = require('node:path');

// PLANNING.md version stamp, e.g. "**Framework Version:** 3.0.0". The stamp is
// a DOCUMENT, not the machine-readable marker: .pf-version outranks it (Р7).
const V4_VERSION_RE = /Framework Version:\**\s*4\.\d+/;
const V3_VERSION_RE = /Framework Version:\**\s*3\.\d+/;
const V2_VERSION_RE = /Framework Version:\**\s*2\.\d+/;

// .pf-version carries a bare semver-ish string, e.g. "3.0.0".
const PF_VERSION_RE = /^(\d+)\.(\d+)/;

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function readFileOrNull(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Detect the Planning Framework state of a target directory.
 *
 * Detection order (Р7, as amended in analysis.md — the order is normative and
 * each step returns immediately unless it explicitly falls through):
 *
 *   1. planning/issues/ present            -> 'v2-or-older'
 *      The structural fingerprint of an UNFINISHED migration outranks every
 *      version marker. Convergence tops a project up to T1–T8 (writing
 *      .pf-version = 3.0.0 and a 3.0-stamped PLANNING.md) even when a phase-3
 *      transfer failed and phase 5 was therefore skipped (D-B). Reading the
 *      marker first would call such a project 'v3', hand it the v3 menu and
 *      leave the untransferred planning/ data silently behind.
 *   2. .pf-version present                 -> 4.x = 'v4'; 3.x = 'v3'; 1.x/2.x =
 *      'v2-or-older'; anything else (5.0.0, garbage) = 'unknown'.
 *   3. PLANNING.md version stamp           -> 4.x = 'v4'; 3.x = 'v3'; 2.x = 'v2-or-older';
 *      any other stamp, or none at all, falls THROUGH (defect 6: the old code
 *      short-circuited to 'unknown' here, which made the 'v2-or-older' branch
 *      unreachable for every real v2 project — they all carry a 2.0 stamp).
 *   4. structural v3 fingerprint           -> 'v3'
 *      (docs/issues/{open,closed} + docs/planning/session-log.md)
 *   5. CLAUDE.md present AND no PLANNING.md -> 'v2-or-older'
 *      The "no PLANNING.md" precondition is kept on purpose: a future 4.x
 *      project with a CLAUDE.md must not be classified as v2 and offered a
 *      migration DOWNWARDS.
 *   6. nothing at all -> 'none'; anything else -> 'unknown'.
 *
 * There is deliberately no 'v1' token (KI-9): MENUS has exactly four keys and
 * showMenu() throws on an unknown state. A v1 project lands in 'v2-or-older';
 * convergence tells v1 from v2 internally.
 *
 * @param {string} targetDir
 * @returns {"none"|"v2-or-older"|"v3"|"v4"|"unknown"}
 */
function detectState(targetDir) {
  const planningMdPath = path.join(targetDir, 'PLANNING.md');
  const claudeMdPath = path.join(targetDir, 'CLAUDE.md');
  const pfVersionPath = path.join(targetDir, '.pf-version');
  const v2IssuesPath = path.join(targetDir, 'planning', 'issues');
  const issuesOpenPath = path.join(targetDir, 'docs', 'issues', 'open');
  const issuesClosedPath = path.join(targetDir, 'docs', 'issues', 'closed');
  const sessionLogPath = path.join(targetDir, 'docs', 'planning', 'session-log.md');

  // 1. Unfinished migration beats every version marker: planning/issues/ is the
  //    v2 structural fingerprint.
  if (isDir(v2IssuesPath)) {
    return 'v2-or-older';
  }

  // 2. .pf-version — the one machine-readable version marker.
  const pfVersionRaw = readFileOrNull(pfVersionPath);
  if (pfVersionRaw !== null) {
    const m = PF_VERSION_RE.exec(pfVersionRaw.trim());
    if (m) {
      const major = Number(m[1]);
      if (major === 4) {
        return 'v4';
      }
      if (major === 3) {
        return 'v3';
      }
      if (major === 1 || major === 2) {
        return 'v2-or-older';
      }
    }
    return 'unknown';
  }

  // 3. PLANNING.md version stamp — documentation, consulted only after the
  //    marker. Neither 3.x nor 2.x: fall through, do NOT short-circuit.
  const planningMdExists = fs.existsSync(planningMdPath);
  if (planningMdExists) {
    const contents = readFileOrNull(planningMdPath) || '';
    if (V4_VERSION_RE.test(contents)) {
      return 'v4';
    }
    if (V3_VERSION_RE.test(contents)) {
      return 'v3';
    }
    if (V2_VERSION_RE.test(contents)) {
      return 'v2-or-older';
    }
  }

  // 4. Structural v3 fingerprint from a fresh install/migration.
  if (isDir(issuesOpenPath) && isDir(issuesClosedPath) && isFile(sessionLogPath)) {
    return 'v3';
  }

  const claudeMdExists = fs.existsSync(claudeMdPath);
  const issuesExist = fs.existsSync(path.join(targetDir, 'docs', 'issues'));

  // 5. CLAUDE.md present, no PLANNING.md -> v2-or-older (this is also what
  //    gives a plain CLAUDE.md-only project its token — D-C).
  if (claudeMdExists && !planningMdExists) {
    return 'v2-or-older';
  }

  // 6. Nothing at all -> none.
  if (!issuesExist && !planningMdExists && !claudeMdExists) {
    return 'none';
  }

  // Anything else -> unknown.
  return 'unknown';
}

module.exports = { detectState };
