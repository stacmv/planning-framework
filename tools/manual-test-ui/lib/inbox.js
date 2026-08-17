"use strict";

// lib/inbox.js — the "things to do" this tool collects across every
// configured project, for the Manual Test UI's inbox screen
// (implementation_plan.md Task 6/7, specs.md §3.2, issue
// 20260806-feat-project-explorer-redesign).
//
// This file currently implements only the `manualTests[]` half of what will
// become `collectInbox(projects)`: the pending rows of every project's
// `docs/planning/test-plan.md`. A later task extends this same module with
// `humanTasks[]` (roles resolved to `kind: human`) and assembles both into
// `collectInbox()`, which `server.js` then exposes as `GET /api/inbox`.
//
// Design constraints, the same ones `lib/roles.js`/`lib/markdown.js` state
// for themselves:
//   * zero dependencies — no npm packages;
//   * pure functions — nothing happens at module load time. Every read only
//     happens when a caller actually invokes `collectManualTests()`;
//   * every failure mode is explicit. A corrupted row (missing/malformed
//     `Origin`) is dropped with a `console.warn` naming the file and line —
//     never silently handed to a caller with an empty `issueId`
//     (specs.md §3.2, TC-017).
//
// Unlike roles.js/markdown.js, this module *does* touch the filesystem
// (`node:fs`, `node:path` — the same builtins `lib/docstate.js` already
// uses to read project documents): it has to, in order to read each
// project's `docs/planning/test-plan.md`. "No I/O at module load time" is
// the constraint that matters here, not "no I/O, ever" — collecting the
// inbox is precisely an I/O operation, run on request.

const fs = require("node:fs");
const path = require("node:path");

// ---------------------------------------------------------------------------
// Status Tracker parsing (docs/planning/test-plan.md)
// ---------------------------------------------------------------------------
//
// KNOWN LIMITATION — read this before touching the regexes/parsing below:
// this logic assumes the `docs/planning/test-plan.md` format exactly as
// documented in
// `docs/issues/closed/20260806-feat-product-test-plan/specs.md` ("Data
// model: docs/planning/test-plan.md") at the time this file was written:
//   * a `| PTC | Area | Test case | Prio | Origin | Last run | Status |`
//     header row, with a `| --- | ... |` separator directly under it;
//   * one data row per line below that, in the same column order;
//   * a literal `|` inside a cell (`Area`, `Test case`, `Origin`) is
//     escaped as `\|`;
//   * `Origin` is `ISSUE-ID#TC-NNN`;
//   * `Status` is one of the closed vocabulary `pending | ✓ | ✗ | retired`.
// If a future issue changes that format, THIS FILE has to be updated to
// match it — it does not read the spec at runtime, and nothing here detects
// a format change on its own.

const TABLE_HEADER_RE = /^\|\s*PTC\s*\|/;
const TABLE_SEPARATOR_RE = /^\|\s*-{2,}/;
// Mirrors ISSUE_ID_RE in server.js (`^[0-9]{8}-(feat|improve|bug)-[a-z0-9-]+$`),
// followed by the `#TC-NNN` suffix that the Origin column adds on top of it.
const ORIGIN_RE = /^([0-9]{8}-(?:feat|improve|bug)-[a-z0-9-]+)#(TC-\d+)$/;
const PENDING_STATUS = "pending";
const TEST_PLAN_RELATIVE_PATH = path.join("docs", "planning", "test-plan.md");

/**
 * "| a | b\|c | d |" -> ["a", "b|c", "d"], trimmed, with `\|` unescaped back
 * to a literal `|`.
 *
 * Modeled on `lib/checklist.js`'s `splitCells()` rather than reused from
 * `lib/markdown.js`'s `splitRow()`: `splitRow()` stashes an escaped pipe
 * behind an internal sentinel token meant to be restored later by
 * `renderInline()` — used standalone (as this module would have to) it
 * would leave that sentinel inside `Area`/`Test case`/`Origin` instead of a
 * literal `|`, and the sentinel isn't exported for a caller to undo. A
 * small local parser is the one `lib/checklist.js`-style option the task
 * describes, and side-steps that mismatch entirely.
 */
function splitTableCells(row) {
  let s = row.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

/**
 * Parse every data row of the Status Tracker table out of one
 * `docs/planning/test-plan.md`'s raw content.
 *
 * @param {string} content
 * @returns {Array<{ptc: string, area: string, testCase: string, priority: string,
 *   origin: string, lastRun: string, status: string, lineNumber: number}>}
 *   `lineNumber` is 1-based, for diagnostics only.
 */
function parseStatusTrackerRows(content) {
  const lines = String(content).split(/\r\n|\n/);
  const rows = [];
  let headerSeen = false;
  let separatorSeen = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!headerSeen) {
      if (TABLE_HEADER_RE.test(line)) headerSeen = true;
      continue;
    }
    if (!separatorSeen) {
      if (TABLE_SEPARATOR_RE.test(line)) separatorSeen = true;
      continue;
    }
    // The table is the only thing below its separator row (specs.md: "Файл
    // — markdown с заголовком, строкой-счётчиком и одной таблицей"); the
    // first line that isn't a table row marks the end of it.
    if (!line.trim().startsWith("|")) break;

    const cells = splitTableCells(line);
    if (cells.length < 7) continue; // malformed row shape — not this module's job to validate

    rows.push({
      ptc: cells[0],
      area: cells[1],
      testCase: cells[2],
      priority: cells[3],
      origin: cells[4],
      lastRun: cells[5],
      status: cells[6],
      lineNumber: i + 1,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// manualTests[] collection
// ---------------------------------------------------------------------------

/**
 * The `manualTests[]` half of `collectInbox()` (specs.md §3.2): every
 * `Status: pending` row of every configured project's
 * `docs/planning/test-plan.md`, with `issueId` parsed out of its `Origin`
 * column.
 *
 * `issueId` is REQUIRED on every returned element — never empty or
 * `undefined`. A pending row whose `Origin` is missing or does not match
 * `ISSUE-ID#TC-NNN` is a corrupted file, not a legitimate "no issue" case:
 * it is excluded entirely, and a `console.warn` names the file and the
 * 1-based line number so the corruption is visible rather than silently
 * dropped (TC-017).
 *
 * A project with no `docs/planning/test-plan.md` yet (framework not
 * converged, or no issue has ever been closed there) simply contributes no
 * rows — that is the normal, not the corrupted, case.
 *
 * @param {Map<string, {root: string}>|Iterable<[string, {root: string}]>} projects
 *   Keyed by project name, mapping to (at least) its `root` directory — the
 *   same shape `server.js`'s `loadProjects()` returns.
 * @returns {Array<{project: string, issueId: string, ptcId: string, area: string,
 *   testCase: string, priority: string, origin: string}>}
 */
function collectManualTests(projects) {
  const manualTests = [];

  for (const [projectName, project] of projects) {
    const testPlanPath = path.join(project.root, TEST_PLAN_RELATIVE_PATH);
    let content;
    try {
      content = fs.readFileSync(testPlanPath, "utf8");
    } catch {
      continue; // no docs/planning/test-plan.md yet — nothing to collect for this project
    }

    for (const row of parseStatusTrackerRows(content)) {
      if (row.status !== PENDING_STATUS) continue;

      const match = ORIGIN_RE.exec(row.origin);
      if (!match) {
        console.warn(
          `${testPlanPath}:${row.lineNumber}: pending row has a missing or malformed Origin ` +
            `("${row.origin}", expected ISSUE-ID#TC-NNN) — excluded from manualTests[]`
        );
        continue;
      }

      manualTests.push({
        project: projectName,
        issueId: match[1],
        ptcId: row.ptc,
        area: row.area,
        testCase: row.testCase,
        priority: row.priority,
        origin: row.origin,
      });
    }
  }

  return manualTests;
}

module.exports = {
  TEST_PLAN_RELATIVE_PATH,
  splitTableCells,
  parseStatusTrackerRows,
  collectManualTests,
};
