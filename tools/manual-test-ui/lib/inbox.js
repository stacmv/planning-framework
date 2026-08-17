"use strict";

// lib/inbox.js — the "things to do" this tool collects across every
// configured project, for the Manual Test UI's inbox screen
// (implementation_plan.md Task 6/7, specs.md §3.2, issue
// 20260806-feat-project-explorer-redesign).
//
// Two halves, two functions, merged by the caller (`server.js`'s
// `GET /api/inbox`, Task 7) rather than by a `collectInbox()` wrapper here:
//   * `collectManualTests(projects)` — the pending rows of every project's
//     `docs/planning/test-plan.md`.
//   * `collectHumanTasks(projects)` — every `(issue, roles.<key>)` pair that
//     resolves to `kind: "human"` (`lib/roles-resolve.js`) and is not
//     already done.
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
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const git = require("./git");
const rolesResolve = require("./roles-resolve");

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

// ---------------------------------------------------------------------------
// humanTasks[] collection
// ---------------------------------------------------------------------------
//
// specs.md §3.2 п.2-3, implementation_plan.md Task 7. For every configured
// project, every OPEN issue, every pipeline key that `lib/roles-resolve.js`
// resolves to `kind: "human"`: a queued (or stale) entry, unless a
// `[human-task done] <key> @ <ts> content-hash=<sha>` marker in that issue's
// `session-log.md` matches the artifact's *current* on-disk content.
//
// This module never writes that marker (a later task, POST
// .../human-tasks/:key/complete) — it only reads and compares.

// Mirrors ISSUE_ID_RE in server.js.
const ISSUE_ID_RE = /^[0-9]{8}-(?:feat|improve|bug)-[a-z0-9-]+$/;

// The eight `roles.<key>` pipeline keys resolved for every open issue
// (specs.md §3.2 п.2).
const PIPELINE_KEYS = ["brd", "specs", "test_plan", "implementation_plan", "code", "tests", "user_docs", "dev_docs"];

// `<key>` -> the single file it resolves to inside the issue's own folder,
// for the six keys that map to exactly one document. `code`/`tests` are
// deliberately absent: they don't resolve to a single artifact file
// (specs.md §4.4) — `artifactPath` is `null` for them, and their "what
// counts as content" is the issue branch's HEAD commit instead (see
// `currentContentIdentifier` below). Not merged into `docstate.js`'s
// `ISSUE_DOC_STAGES` on purpose — that table means "the stage that creates
// this document", a different concern from this key -> filename mapping.
const DOC_KEY_FILES = {
  brd: "brd.md",
  specs: "specs.md",
  test_plan: "test_plan.md",
  implementation_plan: "implementation_plan.md",
  user_docs: "user_docs.md",
  dev_docs: "dev_docs.md",
};

const HUMAN_TASK_MARKER_RE = /\[human-task done\]\s+(\S+)\s+@\s+(\S+)\s+content-hash=(\S+)/g;

/**
 * Read one project-relative file (POSIX-style `rel`), disk first — the
 * common case, matching every other reader in this module and in
 * `server.js` — falling back to `git show <ref>:<rel>` when it isn't on
 * disk (e.g. an open issue whose own branch isn't checked out right now;
 * the same `here` vs `on_branch` split `server.js`'s `classifyChecklist`
 * already makes for `manual_test_checklist.md`). `ref` may be `null`
 * (no fallback attempted, e.g. a non-git "bare" project) — returns `null`
 * when the file exists nowhere reachable.
 */
function readProjectFile(projectRoot, rel, ref) {
  const abs = path.join(projectRoot, ...rel.split("/"));
  try {
    return fs.readFileSync(abs, "utf8");
  } catch {
    if (!ref) return null;
    return git.showFile(projectRoot, ref, rel);
  }
}

function sha256Hex(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

// The HEAD commit sha of `issue/<issueId>`, or `null` when that branch
// doesn't exist (not yet created, or a non-git project). A later task
// (specs.md §4.4) fully implements the code/tests completion check
// (ahead-of-parent + touches-a-non-docs-path); this is only the "what
// counts as content" identifier that check's stale-detection would share
// with everything else here.
function issueBranchHeadSha(projectRoot, issueId) {
  try {
    return execFileSync("git", ["rev-parse", `issue/${issueId}`], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * "What is the current content-identifier for this key?" — the one piece
 * `stale` detection needs and the one piece that differs by key: a file
 * hash for the six document keys, the issue branch's HEAD sha for
 * `code`/`tests` (specs.md §4.4 — "контент" for those two is branch state,
 * not a file). Kept as its own small function, not inlined, so a later task
 * can swap the `code`/`tests` half for the real ahead-of-parent check
 * without touching the document half.
 *
 * @returns {string|null} `null` means "no current content to compare against"
 *   (artifact missing on disk, or branch doesn't exist) — never fabricated.
 */
function currentContentIdentifier(projectRoot, issueId, key, artifactRelPath) {
  if (key === "code" || key === "tests") return issueBranchHeadSha(projectRoot, issueId);
  if (!artifactRelPath) return null;
  const abs = path.join(projectRoot, ...artifactRelPath.split("/"));
  try {
    return sha256Hex(fs.readFileSync(abs, "utf8"));
  } catch {
    return null;
  }
}

// The *last* `[human-task done] <key> @ <ts> content-hash=<sha>` marker for
// `key` in `session-log.md` — append-only (specs.md §4.2), so a re-completion
// after a `stale` round-trip adds a new line rather than replacing the old
// one, and the last one is the current truth.
function findLastMarker(sessionLogContent, key) {
  if (!sessionLogContent) return null;
  HUMAN_TASK_MARKER_RE.lastIndex = 0;
  let match;
  let found = null;
  while ((match = HUMAN_TASK_MARKER_RE.exec(sessionLogContent)) !== null) {
    if (match[1] === key) found = { ts: match[2], contentHash: match[3] };
  }
  return found;
}

// `operation` ("write" | "review") distinguishes a human-write instruction
// from a human-review one (CR-004) — a reviewer isn't being told to author
// the artifact, just to look at it and record a verdict (specs.md §4.2).
function instructionFor(key, operation) {
  if (operation === "review") {
    if (key === "code") return "Review the code for this issue.";
    if (key === "tests") return "Review the tests for this issue.";
    return `Review ${DOC_KEY_FILES[key]} for this issue.`;
  }
  if (key === "code") return "Implement code for this issue.";
  if (key === "tests") return "Write tests for this issue.";
  return `Write ${DOC_KEY_FILES[key]} for this issue.`;
}

/**
 * The `humanTasks[]` half of `collectInbox()` (specs.md §3.2): every
 * `(open issue, roles.<key>)` pair resolving to `kind: "human"`
 * (`lib/roles-resolve.js`, `pf-roles/SKILL.md` §4) that isn't already done.
 *
 * A pair with a `[human-task done]` marker whose recorded hash matches the
 * artifact's *current* content is DONE and excluded entirely. A pair with a
 * marker whose hash does **not** match is `stale` and included — never
 * silently dropped (AC-05f/M5). A pair with no marker at all is `queued`.
 *
 * @param {Map<string, {root: string, configuredDefaultBranch?: string|null}>|
 *   Iterable<[string, {root: string, configuredDefaultBranch?: string|null}]>} projects
 * @returns {Array<{project: string, issueId: string, stageKey: string, operation: string,
 *   mode: string, artifactPath: string|null, instruction: string, status: "queued"|"stale"}>}
 */
function collectHumanTasks(projects) {
  const humanTasks = [];

  for (const [projectName, project] of projects) {
    const projectRoot = project.root;
    const defaultBranch = git.resolveDefaultBranch(projectRoot, project.configuredDefaultBranch || null);
    if (!defaultBranch) continue; // not a git repo (or no branch resolves) — nothing to enumerate

    const openIssueIds = git
      .listTreeNames(projectRoot, defaultBranch, "docs/issues/open")
      .filter((name) => ISSUE_ID_RE.test(name));

    const agentsText = readProjectFile(projectRoot, "docs/planning/agents.yml", defaultBranch) || "";
    const roleProfilesText = readProjectFile(projectRoot, "docs/planning/role-profiles.yml", defaultBranch) || "";

    for (const issueId of openIssueIds) {
      const issueRel = `docs/issues/open/${issueId}`;
      const issueBranch = `issue/${issueId}`;

      const promptText = readProjectFile(projectRoot, `${issueRel}/prompt.md`, issueBranch);
      if (promptText === null) continue; // no prompt.md anywhere for this issue — nothing to resolve

      const sessionLogText = readProjectFile(projectRoot, `${issueRel}/session-log.md`, issueBranch) || "";

      for (const key of PIPELINE_KEYS) {
        const resolved = rolesResolve.resolveRole(key, { promptText, roleProfilesText, agentsText });
        if (!resolved || resolved.kind !== "human") continue;

        const artifactPath = DOC_KEY_FILES[key] ? `${issueRel}/${DOC_KEY_FILES[key]}` : null;
        const currentId = currentContentIdentifier(projectRoot, issueId, key, artifactPath);
        const marker = findLastMarker(sessionLogText, key);

        let status;
        if (!marker) {
          status = "queued";
        } else if (currentId !== null && marker.contentHash === currentId) {
          continue; // marker matches current content — done, excluded entirely
        } else {
          status = "stale";
        }

        // `resolveRole` now detects `kind: "human"` through either the
        // `write` actor or a human entry in `review[]` — `resolved.via`
        // says which one matched (CR-004: a human-review task must be just
        // as discoverable as a human-write one).
        const operation = resolved.via === "review" ? "review" : "write";

        humanTasks.push({
          project: projectName,
          issueId,
          stageKey: key,
          operation,
          mode: resolved.mode || "non-blocking",
          artifactPath,
          instruction: instructionFor(key, operation),
          status,
        });
      }
    }
  }

  return humanTasks;
}

/**
 * The per-issue slice of `collectHumanTasks()`, scoped to exactly one
 * project's exactly one issue — for `GET .../issues/:id/human-tasks`
 * (specs.md §4.3, implementation_plan.md Task 10). Same resolution and
 * done/stale logic as `collectHumanTasks()` (marker lookup, content-hash
 * comparison), just without the "every configured project, every open
 * issue" enumeration that route doesn't need — the caller has already
 * resolved the one issue this is for (`server.js`'s `resolveIssue()`).
 *
 * READ-ONLY, like the rest of this module and like `collectHumanTasks()`:
 * this never writes `session-log.md` (that is a later task, `POST
 * .../human-tasks/:key/complete`) and never performs the resolved operation
 * itself (AC-05a) — it only reports on what is queued or stale.
 *
 * @param {string} projectRoot
 * @param {string} issueId       Already validated against ISSUE_ID_RE.
 * @param {"open"|"closed"} issueStatus
 * @param {string|null} defaultBranch The project's resolved default branch
 *   (`git.resolveDefaultBranch()`), used only as the read fallback for
 *   `docs/planning/agents.yml`/`role-profiles.yml` when they aren't on disk
 *   right now — the same fallback `collectHumanTasks()` uses for them, so
 *   the two never disagree about whether a `roles.<key>` actor is `human`.
 * @returns {Array<{stageKey: string, operation: string, mode: string,
 *   artifactPath: string|null, instruction: string, status: "queued"|"stale",
 *   contentHash?: string}>}
 */
function collectHumanTasksForIssue(projectRoot, issueId, issueStatus, defaultBranch) {
  const issueRel = `docs/issues/${issueStatus}/${issueId}`;
  // Mirrors docstate.buildIssueContext: only OPEN issues ever get a branch
  // fallback (a closed issue is merged by definition — its own `issue/<id>`
  // branch, if it still exists, says nothing about where its documents
  // live).
  const issueBranch = issueStatus === "open" && git.branchExists(projectRoot, `issue/${issueId}`) ? `issue/${issueId}` : null;

  const promptText = readProjectFile(projectRoot, `${issueRel}/prompt.md`, issueBranch);
  if (promptText === null) return []; // no prompt.md anywhere for this issue — nothing to resolve

  const sessionLogText = readProjectFile(projectRoot, `${issueRel}/session-log.md`, issueBranch) || "";
  // Same read + fallback as collectHumanTasks() for these two project-level
  // files: disk first, then `defaultBranch` via `git show` — NOT `ref: null`.
  // A project whose agents.yml/role-profiles.yml aren't checked out right
  // now (e.g. this route is hit against an issue branch that doesn't carry
  // them) must resolve `human` actors exactly like /api/inbox does, or a key
  // would silently vanish from this route while still showing up there.
  const agentsText = readProjectFile(projectRoot, "docs/planning/agents.yml", defaultBranch || null) || "";
  const roleProfilesText = readProjectFile(projectRoot, "docs/planning/role-profiles.yml", defaultBranch || null) || "";

  const tasks = [];
  for (const key of PIPELINE_KEYS) {
    const resolved = rolesResolve.resolveRole(key, { promptText, roleProfilesText, agentsText });
    if (!resolved || resolved.kind !== "human") continue;

    const artifactPath = DOC_KEY_FILES[key] ? `${issueRel}/${DOC_KEY_FILES[key]}` : null;
    const currentId = currentContentIdentifier(projectRoot, issueId, key, artifactPath);
    const marker = findLastMarker(sessionLogText, key);

    let status;
    if (!marker) {
      status = "queued";
    } else if (currentId !== null && marker.contentHash === currentId) {
      continue; // marker matches current content — done, excluded entirely
    } else {
      status = "stale";
    }

    // See the identical comment in collectHumanTasks(): resolveRole surfaces
    // `kind: "human"` through either the `write` actor or a human entry in
    // `review[]` — `resolved.via` says which one matched.
    const operation = resolved.via === "review" ? "review" : "write";

    const task = {
      stageKey: key,
      operation,
      mode: resolved.mode || "non-blocking",
      artifactPath,
      instruction: instructionFor(key, operation),
      status,
    };
    // Never fabricated: omitted entirely when there is no current content to
    // hash against (artifact missing on disk, or — for code/tests — the
    // issue branch doesn't exist), matching currentContentIdentifier()'s own
    // contract. Deliberate choice for `stale`: this is the CURRENT content's
    // hash (`currentId`), not the stale marker's recorded one
    // (`marker.contentHash`) — "what would `.../complete` write if called
    // right now", not "what was true when it was last marked done". A future
    // caller that wants the old value can still read it via the
    // `[human-task done]` marker in session-log.md directly.
    if (currentId !== null) task.contentHash = currentId;
    tasks.push(task);
  }

  return tasks;
}

// ---------------------------------------------------------------------------
// Resolving one (issue, key) pair's operation — write vs. review
// ---------------------------------------------------------------------------
//
// `POST .../human-tasks/:key/complete` (server.js) needs to know, for the one
// key it was called with, whether the human actor is on the WRITE side
// (`roles.<key>.write` resolves to `kind: "human"`) or the REVIEW side
// (`roles.<key>.review` lists an actor that resolves to `kind: "human"`).
// `resolveRole()` itself now detects both (`resolved.via`, CR-004 fix) and is
// the single source of truth for that detection — this function just
// translates `via` into the `operation`/`mode` shape this route's caller
// wants, and stays the one place that also has to handle "not a human task
// at all" (`operation: null`). Kept here, next to `collectHumanTasksForIssue`,
// so both read the same `roles.<key>` the same way and cannot disagree about
// what's a human task.
//
// @returns {null} the issue itself cannot be resolved at all (no prompt.md
//   anywhere reachable) — distinct from "resolved, but not a human task for
//   this key", which returns `operation: null` instead.
function resolveHumanTaskOperation(projectRoot, issueId, issueStatus, defaultBranch, key) {
  if (!PIPELINE_KEYS.includes(key)) return null;

  const issueRel = `docs/issues/${issueStatus}/${issueId}`;
  const issueBranch = issueStatus === "open" && git.branchExists(projectRoot, `issue/${issueId}`) ? `issue/${issueId}` : null;

  const promptText = readProjectFile(projectRoot, `${issueRel}/prompt.md`, issueBranch);
  if (promptText === null) return null;

  const agentsText = readProjectFile(projectRoot, "docs/planning/agents.yml", defaultBranch || null) || "";
  const roleProfilesText = readProjectFile(projectRoot, "docs/planning/role-profiles.yml", defaultBranch || null) || "";

  const resolved = rolesResolve.resolveRole(key, { promptText, roleProfilesText, agentsText });
  const artifactPath = DOC_KEY_FILES[key] ? `${issueRel}/${DOC_KEY_FILES[key]}` : null;
  const base = { key, artifactPath, issueRel, issueBranch };

  if (resolved && resolved.kind === "human") {
    const operation = resolved.via === "review" ? "review" : "write";
    return { ...base, operation, mode: resolved.mode || "non-blocking" };
  }

  return { ...base, operation: null, mode: null };
}

module.exports = {
  TEST_PLAN_RELATIVE_PATH,
  splitTableCells,
  parseStatusTrackerRows,
  collectManualTests,
  ISSUE_ID_RE,
  PIPELINE_KEYS,
  DOC_KEY_FILES,
  collectHumanTasks,
  collectHumanTasksForIssue,
  resolveHumanTaskOperation,
  currentContentIdentifier,
  sha256Hex,
};
