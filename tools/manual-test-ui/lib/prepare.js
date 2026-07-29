"use strict";

// Running an issue's `test-data/setup.mjs` and turning what it printed into a
// report the tool can show.
//
// This module is the programmatic entry point of "prepare a test case". The
// HTTP route calls it, the test suites call it, and both get the same object
// back — so a test can prove the behaviour without going through a route, and
// a route cannot quietly acquire behaviour no test covers.
//
// Three things it deliberately does *not* do:
//
//  - It never builds a command line. The script is started with
//    `execFile(process.execPath, [scriptPath, tcId])`: no shell, arguments as
//    an array, nothing interpolated into a string. The issue id, the test case
//    id and the script name are validated against fixed patterns first, so a
//    request cannot name a path of its own choosing.
//  - It never decides where prepared data goes. `setup.mjs` owns that; this
//    module only reports the path the script printed. `preparedWorkdir()`
//    exists to let callers *predict* that path (the checklist shows it, tests
//    assert on it) and is written from the same formula on purpose —
//    `<tmpdir>/pf-test-data/<ISSUE-ID>/<TC-ID>`.
//  - It never writes to the repository. Preparing data must leave
//    `git status --porcelain` unchanged, which is the constraint the whole
//    design is built around.
//
// Failure is data, not an exception: a missing script, an undeclared case, a
// non-zero exit and a timeout all come back as a report with `ok: false` and a
// `reason`, so a caller renders them the same way it renders success.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");

// Same shape server.js enforces for issue directories.
const ISSUE_ID_RE = /^[0-9]{8}-(feat|improve|bug)-[a-z0-9-]+$/;
const TC_ID_RE = /^TC-[0-9]{3,}$/;
// A file name, never a path: no separator, no traversal.
const SCRIPT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.mjs$/;
const STATUSES = new Set(["open", "closed"]);

const TEST_DATA_DIR = "test-data";
const SETUP_SCRIPT = "setup.mjs";
const PREPARED_ROOT_DIR = "pf-test-data";

const DEFAULT_TIMEOUT_MS = 60000;
const MAX_BUFFER = 4 * 1024 * 1024;

const PREPARED_LINE_RE = /^PF-PREPARED\s+(\S+)\s+(.+?)\s*$/;
const FILE_LINE_RE = /^PF-FILE\s+(\S+)\s+(.+?)\s*$/;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** `<tmpdir>/pf-test-data` — the root every issue's prepared data lives under. */
function preparedRoot() {
  return path.join(os.tmpdir(), PREPARED_ROOT_DIR);
}

/** `<tmpdir>/pf-test-data/<ISSUE-ID>` */
function preparedIssueRoot(issueId) {
  return path.join(preparedRoot(), issueId);
}

/**
 * `<tmpdir>/pf-test-data/<ISSUE-ID>/<TC-ID>` — where a prepared case is
 * unpacked. The single source of this formula on the tool's side; `setup.mjs`
 * carries the same one, and the checklist repeats it in prose so a tester
 * reading the file without the tool still finds the data.
 */
function preparedWorkdir(issueId, tcId) {
  return path.join(preparedIssueRoot(issueId), tcId);
}

/** `<projectRoot>/docs/issues/<status>/<ISSUE-ID>/test-data` */
function testDataDir({ projectRoot, status, issueId }) {
  return path.join(projectRoot, "docs", "issues", status, issueId, TEST_DATA_DIR);
}

/** `<projectRoot>/docs/issues/<status>/<ISSUE-ID>/test-data/<scriptName>` */
function setupScriptPath({ projectRoot, status, issueId, scriptName = SETUP_SCRIPT }) {
  return path.join(testDataDir({ projectRoot, status, issueId }), scriptName);
}

/** Whether an issue declares prepared data at all. */
function hasSetupScript({ projectRoot, status, issueId, scriptName = SETUP_SCRIPT }) {
  try {
    return fs.statSync(setupScriptPath({ projectRoot, status, issueId, scriptName })).isFile();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Report parsing
// ---------------------------------------------------------------------------

/**
 * Read the `PF-PREPARED` / `PF-FILE` lines out of a script's stdout.
 *
 * A script that prints neither is still a valid script — the tool just has
 * nothing structured to show for it, and the caller falls back to raw stdout.
 * `structured` says which of the two happened, so "prepared nothing" and
 * "printed in its own format" are distinguishable.
 *
 * @param {string} stdout
 * @returns {{prepared: Array<{tcId: string, workdir: string, files: string[]}>,
 *            structured: boolean}}
 */
function parsePrepareOutput(stdout) {
  const prepared = [];
  const byId = new Map();

  for (const rawLine of String(stdout || "").split(/\r?\n/)) {
    const preparedMatch = rawLine.match(PREPARED_LINE_RE);
    if (preparedMatch) {
      const entry = { tcId: preparedMatch[1], workdir: preparedMatch[2], files: [] };
      // A repeated id (the script was asked twice) reports once, with the
      // last path it announced: the working copy is a single directory.
      if (byId.has(entry.tcId)) {
        const existing = byId.get(entry.tcId);
        existing.workdir = entry.workdir;
        existing.files = [];
      } else {
        byId.set(entry.tcId, entry);
        prepared.push(entry);
      }
      continue;
    }
    const fileMatch = rawLine.match(FILE_LINE_RE);
    if (fileMatch) {
      const entry = byId.get(fileMatch[1]);
      if (entry) entry.files.push(fileMatch[2]);
    }
  }

  return { prepared, structured: prepared.length > 0 };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function makeReport(overrides) {
  return {
    ok: false,
    reason: null,
    message: "",
    issueId: null,
    status: null,
    tcId: null,
    scriptPath: null,
    exitCode: null,
    signal: null,
    timedOut: false,
    durationMs: 0,
    stdout: "",
    stderr: "",
    prepared: [],
    structured: false,
    ...overrides,
  };
}

function failure(reason, message, overrides = {}) {
  return makeReport({ ok: false, reason, message, ...overrides });
}

// ---------------------------------------------------------------------------
// runPrepare
// ---------------------------------------------------------------------------

/**
 * Prepare an issue's test data, or one case of it.
 *
 * @param {object} options
 * @param {string}  options.projectRoot     Absolute path of the project.
 * @param {string}  options.issueId         Issue directory name.
 * @param {string}  [options.status]        "open" (default) or "closed".
 * @param {string}  [options.tcId]          Prepare only this case; omit for
 *                                          the whole issue.
 * @param {number}  [options.timeoutMs]     Default 60000. A script that hangs
 *                                          must not hang the tool.
 * @param {string}  [options.scriptName]    Default "setup.mjs".
 * @param {string}  [options.cwd]           Default: the script's directory.
 * @param {object}  [options.env]           Default: the current environment.
 * @returns {Promise<{
 *   ok: boolean, reason: string|null, message: string,
 *   issueId: string|null, status: string|null, tcId: string|null,
 *   scriptPath: string|null, exitCode: number|null, signal: string|null,
 *   timedOut: boolean, durationMs: number, stdout: string, stderr: string,
 *   prepared: Array<{tcId: string, workdir: string, files: string[]}>,
 *   structured: boolean
 * }>}
 *
 * `reason` is null on success and otherwise one of:
 *   "invalid-project-root", "invalid-issue-id", "invalid-status",
 *   "invalid-tc-id", "invalid-script-name", "no-setup-script",
 *   "timeout", "output-too-large", "spawn-error", "exit-code".
 *
 * Never rejects: every failure is a resolved report.
 */
function runPrepare(options = {}) {
  const {
    projectRoot,
    issueId,
    status = "open",
    tcId = null,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    scriptName = SETUP_SCRIPT,
    cwd,
    env,
  } = options;

  if (typeof projectRoot !== "string" || projectRoot.length === 0 || !path.isAbsolute(projectRoot)) {
    return Promise.resolve(
      failure("invalid-project-root", "projectRoot must be an absolute path")
    );
  }
  if (typeof issueId !== "string" || !ISSUE_ID_RE.test(issueId)) {
    return Promise.resolve(failure("invalid-issue-id", `not an issue id: ${String(issueId)}`));
  }
  if (!STATUSES.has(status)) {
    return Promise.resolve(
      failure("invalid-status", `status must be "open" or "closed", got: ${String(status)}`, { issueId })
    );
  }
  if (tcId !== null && tcId !== undefined && !TC_ID_RE.test(String(tcId))) {
    return Promise.resolve(
      failure("invalid-tc-id", `not a test case id: ${String(tcId)}`, { issueId, status })
    );
  }
  if (!SCRIPT_NAME_RE.test(String(scriptName))) {
    return Promise.resolve(
      failure("invalid-script-name", `not a setup script name: ${String(scriptName)}`, { issueId, status })
    );
  }

  const caseId = tcId === undefined ? null : tcId;
  const scriptPath = setupScriptPath({ projectRoot, status, issueId, scriptName });
  const base = { issueId, status, tcId: caseId, scriptPath };

  let scriptIsFile = false;
  try {
    scriptIsFile = fs.statSync(scriptPath).isFile();
  } catch {
    scriptIsFile = false;
  }
  if (!scriptIsFile) {
    return Promise.resolve(
      failure("no-setup-script", `no prepared data is declared for ${issueId}: ${scriptPath} does not exist`, base)
    );
  }

  const args = [scriptPath];
  if (caseId) args.push(caseId);
  const startedAt = Date.now();

  return new Promise((resolve) => {
    execFile(
      process.execPath,
      args,
      {
        // The script resolves its fixtures relative to its own location, so
        // cwd never affects the result; it is pinned all the same, so a script
        // that does use a relative path writes next to itself rather than
        // wherever the server happened to be started.
        cwd: cwd || path.dirname(scriptPath),
        env: env || process.env,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        shell: false,
        windowsHide: true,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - startedAt;
        const out = String(stdout || "");
        const err = String(stderr || "");
        const { prepared, structured } = parsePrepareOutput(out);
        const signal = (error && error.signal) || null;
        const exitCode = error ? (typeof error.code === "number" ? error.code : null) : 0;

        let reason = null;
        let message = "";
        if (error && error.code === "ENOBUFS") {
          reason = "output-too-large";
          message = `the script printed more than ${MAX_BUFFER} bytes and was stopped`;
        } else if (error && error.killed) {
          reason = "timeout";
          message = `the script did not finish within ${timeoutMs} ms and was stopped`;
        } else if (error && typeof error.code === "string") {
          reason = "spawn-error";
          message = `the script could not be started: ${error.code}`;
        } else if (exitCode !== 0) {
          reason = "exit-code";
          message = err.trim() || `the script exited with code ${exitCode}`;
        } else {
          message = structured
            ? `prepared ${prepared.length} test case(s)`
            : out.trim() || "the script finished without printing anything";
        }

        resolve(
          makeReport({
            ...base,
            ok: reason === null,
            reason,
            message,
            exitCode,
            signal,
            timedOut: reason === "timeout",
            durationMs,
            stdout: out,
            stderr: err,
            prepared,
            structured,
          })
        );
      }
    );
  });
}

module.exports = {
  runPrepare,
  parsePrepareOutput,
  preparedRoot,
  preparedIssueRoot,
  preparedWorkdir,
  testDataDir,
  setupScriptPath,
  hasSetupScript,
  ISSUE_ID_RE,
  TC_ID_RE,
  SETUP_SCRIPT,
  TEST_DATA_DIR,
  PREPARED_ROOT_DIR,
  DEFAULT_TIMEOUT_MS,
  MAX_BUFFER,
};
