'use strict';

const fs = require('node:fs');
const path = require('node:path');

const V3_VERSION_RE = /Framework Version:\**\s*3\.\d+/;

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

/**
 * Detect the Planning Framework state of a target directory.
 * @param {string} targetDir
 * @returns {"none"|"v2-or-older"|"v3"|"unknown"}
 */
function detectState(targetDir) {
  const planningMdPath = path.join(targetDir, 'PLANNING.md');
  const claudeMdPath = path.join(targetDir, 'CLAUDE.md');
  const issuesOpenPath = path.join(targetDir, 'docs', 'issues', 'open');
  const issuesClosedPath = path.join(targetDir, 'docs', 'issues', 'closed');
  const sessionLogPath = path.join(targetDir, 'docs', 'planning', 'session-log.md');

  const planningMdExists = fs.existsSync(planningMdPath);

  // 1. PLANNING.md present: version marker decides immediately.
  if (planningMdExists) {
    const contents = fs.readFileSync(planningMdPath, 'utf8');
    if (V3_VERSION_RE.test(contents)) {
      return 'v3';
    }
    return 'unknown';
  }

  // 2. No PLANNING.md: fallback v3 fingerprint from fresh install/migration.
  if (isDir(issuesOpenPath) && isDir(issuesClosedPath) && isFile(sessionLogPath)) {
    return 'v3';
  }

  const claudeMdExists = fs.existsSync(claudeMdPath);
  const issuesExist = fs.existsSync(path.join(targetDir, 'docs', 'issues'));

  // 3. CLAUDE.md present (and none of the above matched) -> v2-or-older.
  if (claudeMdExists) {
    return 'v2-or-older';
  }

  // 4. Nothing at all -> none.
  if (!issuesExist && !planningMdExists && !claudeMdExists) {
    return 'none';
  }

  // 5. Anything else -> unknown.
  return 'unknown';
}

module.exports = { detectState };
