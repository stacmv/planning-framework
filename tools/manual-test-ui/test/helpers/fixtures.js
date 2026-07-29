"use strict";

// Fixture builders shared by every node suite of the Manual Test UI.
//
// Three rules this module exists to enforce, because every suite would
// otherwise re-derive them and get one of them subtly wrong:
//
//  1. Nothing is ever created inside the repository. Every fixture lives in a
//     fresh `fs.mkdtempSync` directory under the OS temp dir and is removed
//     again, including when the test that created it failed.
//  2. The real `tools/manual-test-ui/projects.json` is never read by a test.
//     Suites always point the server at a generated config through
//     `PLANNING_TEST_UI_CONFIG`, so a developer's local project list can
//     neither break the suite nor be touched by it.
//  3. A fixture repository is self-contained: `user.email`/`user.name`,
//     `commit.gpgsign` and `init.defaultBranch` are set *locally*, so a run
//     does not depend on (and cannot be broken by) the machine's global
//     .gitconfig.
//
// Two hard constraints come from server.js and shape the fixture catalogue
// below; changing them will silently make issues invisible to the tool:
//
//  - Every issue id must match ISSUE_ID_RE (`server.js:22`),
//    `^[0-9]{8}-(feat|improve|bug)-[a-z0-9-]+$`.
//  - Issues are enumerated with `git ls-tree` against the *default branch*,
//    not from disk. So an issue whose documents live only on its own
//    `issue/<id>` branch still needs at least one file — `prompt.md` — on
//    `develop`, or its directory is not in the tree at all and the issue
//    simply does not exist as far as the tool is concerned.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const TOOL_DIR = path.resolve(__dirname, "..", "..");
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");
const REPO_ROOT = path.resolve(TOOL_DIR, "..", "..");
const SETUP_TEMPLATE_PATH = path.join(REPO_ROOT, "skills", "pf-test", "templates", "setup.mjs");

// ---------------------------------------------------------------------------
// Temp-directory bookkeeping
// ---------------------------------------------------------------------------

const created = new Set();

function makeTempDir(prefix = "pf-ui-test-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  created.add(dir);
  return dir;
}

function removeTempDir(dir) {
  if (!dir) return;
  fs.rmSync(dir, { recursive: true, force: true });
  created.delete(dir);
}

/**
 * Remove every temp directory this module has handed out.
 *
 * Suites call it from a single `after()` / `t.after()`; it is safe to call
 * more than once and never throws, so a failing test cannot leave the next
 * run to trip over yesterday's fixture.
 */
function cleanupAll() {
  for (const dir of [...created]) {
    try {
      removeTempDir(dir);
    } catch {
      /* best effort: a leftover temp dir must never fail a suite */
    }
  }
}

/**
 * Register `cleanupAll()` on a node:test context, so fixtures are removed
 * whether the test passed, failed or threw.
 *
 *   const { autoCleanup } = require("./helpers/fixtures");
 *   test("...", (t) => { autoCleanup(t); ... });
 */
function autoCleanup(t) {
  t.after(() => cleanupAll());
}

/**
 * Give a suite its own temp root and point `os.tmpdir()` at it.
 *
 * The prepare suites need this and nothing else does: `setup.mjs` unpacks to
 * `<tmpdir>/pf-test-data/<ISSUE-ID>/<TC-ID>`, a path derived from the issue id
 * alone. `node --test` runs suite files in parallel processes, so three suites
 * exercising the same fixture issue would otherwise be rebuilding, corrupting
 * and snapshotting *the same directory* at the same time — flaky, and flaky in
 * a way that looks like a bug in idempotency.
 *
 * Isolating the temp root also guarantees the suite cannot leave anything in
 * the developer's real `/tmp`: everything it creates, directly or through a
 * child process it starts, lands under `root`, which `restore()` deletes whole.
 *
 * Call it at the top of the suite, before anything reads `os.tmpdir()`.
 *
 * @returns {{root: string, restore(): void}}
 */
function isolateTempRoot(prefix = "pf-ui-suite-") {
  const previous = { TMPDIR: process.env.TMPDIR, TEMP: process.env.TEMP, TMP: process.env.TMP };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  // TMPDIR is what os.tmpdir() reads on POSIX, TEMP/TMP on Windows; a child
  // process inherits all three, so `setup.mjs` resolves the same root.
  process.env.TMPDIR = root;
  process.env.TEMP = root;
  process.env.TMP = root;
  return {
    root,
    restore() {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

function writeFileTree(rootDir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(rootDir, ...rel.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  }
}

// ---------------------------------------------------------------------------
// Fixture document bodies
// ---------------------------------------------------------------------------

function frontmatter({ docLanguage = "English", sizeTier = "medium" } = {}) {
  return ["---", `doc_language: ${docLanguage}`, `size_tier: ${sizeTier}`, "---", ""].join("\n");
}

function promptDoc({ issueId, type, title, docLanguage, sizeTier }) {
  return (
    frontmatter({ docLanguage, sizeTier }) +
    [`# ${issueId}`, "", `Type: ${type}. ${title}`, "", "Fixture issue — generated by test/helpers/fixtures.js.", ""].join("\n")
  );
}

function simpleDoc(heading, lines) {
  return [`# ${heading}`, "", ...lines, ""].join("\n");
}

/**
 * A checklist with `count` Manual test cases of `steps` steps each.
 *
 * Written with a single space around every `|`: `patchStepResult` rebuilds
 * the whole row it patches and does not preserve column padding, so an
 * aligned fixture would make "every other line is byte for byte identical"
 * fail for a reason that has nothing to do with the behaviour under test.
 */
function checklistDoc({
  issueId,
  feature = "Fixture feature",
  date = "2026-07-29",
  cases = 2,
  steps = 3,
  extraSections = {},
  preparedRoot = null,
}) {
  const lines = [
    "# Manual Test Checklist",
    "",
    `**Feature Name:** ${feature}`,
    `**Issue ID:** ${issueId}`,
    `**Date:** ${date}`,
    "",
  ];
  for (let c = 1; c <= cases; c++) {
    const tcId = `TC-${String(c).padStart(3, "0")}`;
    lines.push(`## ${tcId}: Fixture case ${c}`, "");
    lines.push("**Prerequisites:**");
    lines.push(`- The fixture issue ${issueId} is checked out.`);
    // The location of the prepared working copy belongs in the checklist
    // itself (AC-01f): a tester reading the file without the tool has to be
    // able to find the data. `preparedRoot` is passed as the *same* value
    // setup.mjs derives — <tmpdir>/pf-test-data/<ISSUE-ID> — so a test can
    // compare the two literally instead of matching a shape.
    if (preparedRoot) lines.push(`- Подготовленные данные: ${path.join(preparedRoot, tcId)}`);
    lines.push("");
    const extra = extraSections[tcId];
    if (extra) lines.push(...extra, "");
    lines.push("**Steps:**", "");
    lines.push("| Step | Action | Expected Result | Result |");
    lines.push("| --- | --- | --- | --- |");
    for (let s = 1; s <= steps; s++) {
      lines.push(`| ${s} | Fixture action ${s} of ${tcId} | Fixture expectation ${s} | [ ] |`);
    }
    lines.push("", "**Notes:**", "");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// setup.mjs instances
// ---------------------------------------------------------------------------

const CONFIG_BEGIN = "// --- BEGIN GENERATED CONFIG ---";
const CONFIG_END = "// --- END GENERATED CONFIG ---";

/**
 * Instantiate `skills/pf-test/templates/setup.mjs` for a fixture issue.
 *
 * Read from the template rather than copied into this file on purpose: the
 * fixture script *is* the shipped template with its config block filled in, so
 * the suites that assert on portability and on idempotency are asserting about
 * the artefact `/pf-test` actually writes into an issue. A copy here would
 * drift, and the drift would be invisible — the tests would keep passing while
 * the template rotted.
 *
 * `prelude` is emitted once and spread into the cases that use it, which is
 * what makes "the shared fixture is named exactly once" true of the generated
 * script and not only of the template.
 *
 * @param {{issueId: string, prelude?: string[], cases: Record<string, string[]>}} spec
 *   `cases` values list entries *besides* the prelude; pass `usePrelude: false`
 *   per case by listing it in `withoutPrelude`.
 * @returns {string}
 */
function renderSetupScript({ issueId, prelude = [], cases, withoutPrelude = [] }) {
  const template = fs.readFileSync(SETUP_TEMPLATE_PATH, "utf8");
  const begin = template.indexOf(CONFIG_BEGIN);
  const end = template.indexOf(CONFIG_END);
  if (begin === -1 || end === -1) {
    throw new Error(
      `${SETUP_TEMPLATE_PATH} no longer has its generated-config markers — ` +
        "the template and this renderer have to be changed together"
    );
  }

  const q = (s) => JSON.stringify(s);
  const body = [CONFIG_BEGIN, `const ISSUE_ID = ${q(issueId)};`, `const PRELUDE = [${prelude.map(q).join(", ")}];`, "const CASES = {"];
  for (const [tcId, entries] of Object.entries(cases)) {
    const parts = withoutPrelude.includes(tcId) ? [] : ["...PRELUDE"];
    body.push(`  ${q(tcId)}: [${[...parts, ...entries.map(q)].join(", ")}],`);
  }
  body.push("};");

  return template.slice(0, begin) + body.join("\n") + "\n" + template.slice(end);
}

// ---------------------------------------------------------------------------
// The fixture issue catalogue
// ---------------------------------------------------------------------------

// Declarative on purpose: a suite names the issues it needs and gets exactly
// those, so a repository built for a checklist test is not carrying the
// role-explorer fixtures around, and a new suite adds a fixture here instead
// of hand-rolling one more variant of `git init`.
//
// `files`       — committed to the default branch.
// `branchFiles` — committed to `issue/<id>` only, on top of `files`. Used for
//                 the `on_branch` checklist state; the issue still needs a
//                 `prompt.md` in `files` to be visible in `git ls-tree`.
const FIXTURE_ISSUES = {
  // Full document set: the "everything is present" baseline for the role
  // explorer (TC-006) and the editable checklist (`here`) for TC-013/TC-014.
  "20260101-feat-fixture-full": {
    status: "open",
    files: () => ({
      "prompt.md": promptDoc({ issueId: "20260101-feat-fixture-full", type: "feat", title: "Full document set." }),
      "brd.md": simpleDoc("BRD — full fixture", ["## Goals", "- G1: the fixture is complete.", "## Acceptance Criteria", "- AC-01: every pipeline document exists."]),
      "analysis.md": simpleDoc("Analysis — full fixture", ["The fixture needs no analysis.", "It exists to be listed."]),
      "notes.md": simpleDoc("Notes — full fixture", ["Free-form notes.", "Three lines is enough.", "No structure is implied."]),
      "specs.md": simpleDoc("Specs — full fixture", ["## Interfaces", "- None: this is a fixture.", "## Data", "- None."]),
      "implementation_plan.md": simpleDoc("Implementation Plan — full fixture", ["#### Task 1: Exist", "**Mapped Test Cases:** TC-001", "**Files:** none"]),
      "test_plan.md": simpleDoc("Test Plan — full fixture", ["### TC-001: Fixture case", "**Priority:** Low"]),
      "manual_test_checklist.md": checklistDoc({ issueId: "20260101-feat-fixture-full", feature: "Full fixture" }),
      "qa_report.md": simpleDoc("QA Report — full fixture", ["**Verdict:** PASS", "All fixture checks passed."]),
    }),
  },

  // type improve, so specs.md is applicable but deliberately absent →
  // "not_applicable" vs "missing" discrimination in TC-007.
  "20260102-improve-fixture-nospec": {
    status: "open",
    files: () => ({
      "prompt.md": promptDoc({ issueId: "20260102-improve-fixture-nospec", type: "improve", title: "No specs on purpose." }),
      "brd.md": simpleDoc("BRD — nospec fixture", ["## Goals", "- G1: exercise the missing-specs path."]),
      "implementation_plan.md": simpleDoc("Implementation Plan — nospec fixture", ["#### Task 1: Exist", "**Files:** none"]),
    }),
  },

  // type bug: analysis.md instead of brd.md.
  "20260103-bug-fixture-analysis": {
    status: "open",
    files: () => ({
      "prompt.md": promptDoc({ issueId: "20260103-bug-fixture-analysis", type: "bug", title: "Analysis instead of a BRD." }),
      "analysis.md": simpleDoc("Analysis — bug fixture", ["## Root cause", "- The fixture was never wrong.", "## Fix", "- Nothing to fix."]),
    }),
  },

  // Only prompt.md on develop; the rest lives on the issue branch. This is
  // the `on_branch` case — and the reason prompt.md cannot be omitted.
  "20260104-feat-fixture-onbranch": {
    status: "open",
    files: () => ({
      "prompt.md": promptDoc({ issueId: "20260104-feat-fixture-onbranch", type: "feat", title: "Documents live on the issue branch." }),
    }),
    branchFiles: () => ({
      "brd.md": simpleDoc("BRD — on-branch fixture", ["## Goals", "- G1: be reachable only via git show."]),
      "manual_test_checklist.md": checklistDoc({ issueId: "20260104-feat-fixture-onbranch", feature: "On-branch fixture", cases: 1, steps: 2 }),
    }),
  },

  // trivial tier: notes.md stands in for brd/analysis/specs.
  "20260105-improve-fixture-trivial": {
    status: "open",
    files: () => ({
      "prompt.md": promptDoc({
        issueId: "20260105-improve-fixture-trivial",
        type: "improve",
        title: "Trivial tier.",
        sizeTier: "trivial",
      }),
      "notes.md": simpleDoc("Notes — trivial fixture", [
        "A trivial issue does not get a BRD.",
        "It does not get an analysis either.",
        "Nor a spec.",
        "This file replaces all three.",
      ]),
    }),
  },

  // Pipeline documents up to test_plan.md, no qa_report.md → "missing, and
  // here is the stage that creates it".
  "20260106-feat-fixture-noqa": {
    status: "open",
    files: () => ({
      "prompt.md": promptDoc({ issueId: "20260106-feat-fixture-noqa", type: "feat", title: "No QA report yet." }),
      "brd.md": simpleDoc("BRD — noqa fixture", ["## Goals", "- G1: stop before QA."]),
      "specs.md": simpleDoc("Specs — noqa fixture", ["## Interfaces", "- None."]),
      "test_plan.md": simpleDoc("Test Plan — noqa fixture", ["### TC-001: Fixture case", "**Priority:** Low"]),
    }),
  },

  // Two Manual cases with declared test data and a shared prelude — the
  // reference issue for the prepare-a-case suites.
  "20260107-feat-fixture-twocases": {
    status: "open",
    files: () => ({
      "prompt.md": promptDoc({
        issueId: "20260107-feat-fixture-twocases",
        type: "feat",
        title: "Two cases with declared data.",
        docLanguage: "Russian",
      }),
      "manual_test_checklist.md": checklistDoc({
        issueId: "20260107-feat-fixture-twocases",
        feature: "Two cases with declared data",
        cases: 2,
        steps: 3,
        preparedRoot: path.join(os.tmpdir(), "pf-test-data", "20260107-feat-fixture-twocases"),
        extraSections: {
          "TC-001": ["**Test Data:**", "- `prelude/common.json`", "- `case-a/input.txt`"],
          "TC-002": ["**Test Data:**", "- `prelude/common.json`", "- `case-b/input.csv`"],
        },
      }),
      // An instance of the shipped template. TC-001 also claims the two edge
      // fixtures of case-a — a nested directory and a directory whose only
      // content is a .gitkeep — because "the working copy comes back byte for
      // byte" has to cover those, not only flat files.
      "test-data/setup.mjs": renderSetupScript({
        issueId: "20260107-feat-fixture-twocases",
        prelude: ["prelude/common.json"],
        cases: {
          "TC-001": ["case-a/input.txt", "case-a/nested", "case-a/empty-dir"],
          "TC-002": ["case-b/input.csv"],
        },
      }),
      "test-data/fixtures/prelude/common.json": '{\n  "shared": true\n}\n',
      "test-data/fixtures/case-a/input.txt": "first line\nsecond line\n",
      "test-data/fixtures/case-b/input.csv": "id,name\n1,plain\n2,Ёлка\n",
      "test-data/fixtures/case-a/nested/deep/note.md": "Вложенная заметка.\n",
      "test-data/fixtures/case-a/empty-dir/.gitkeep": "",
    }),
  },

  // A Manual case explicitly marked as needing no data, in an issue that
  // does have a test-data/ directory — the priority rule of TC-018 step 5.
  "20260108-feat-fixture-nodata": {
    status: "open",
    files: () => ({
      "prompt.md": promptDoc({ issueId: "20260108-feat-fixture-nodata", type: "feat", title: "Case needs no data." }),
      "manual_test_checklist.md": checklistDoc({
        issueId: "20260108-feat-fixture-nodata",
        feature: "No data needed",
        cases: 1,
        steps: 2,
        extraSections: { "TC-001": ["**Test Data:** none"] },
      }),
      "test-data/fixtures/unused/placeholder.txt": "not used by any case\n",
    }),
  },

  // Declared data plus a working setup script — the positive control.
  "20260109-feat-fixture-declared": {
    status: "open",
    files: () => ({
      "prompt.md": promptDoc({ issueId: "20260109-feat-fixture-declared", type: "feat", title: "Declared data with a setup script." }),
      "manual_test_checklist.md": checklistDoc({
        issueId: "20260109-feat-fixture-declared",
        feature: "Declared data",
        cases: 1,
        steps: 2,
        extraSections: { "TC-001": ["**Test Data:**", "- `case-a/input.txt`", "- `case-a/second.txt`"] },
      }),
      // The script is what makes this the *positive* control: declared data
      // and a way to prepare it, so it can be told apart from the noscript
      // fixture below, where only the script is missing (TC-018 steps 3, 6).
      "test-data/setup.mjs": renderSetupScript({
        issueId: "20260109-feat-fixture-declared",
        cases: { "TC-001": ["case-a/input.txt", "case-a/second.txt"] },
      }),
      "test-data/fixtures/case-a/input.txt": "declared fixture\n",
      "test-data/fixtures/case-a/second.txt": "second declared fixture\n",
    }),
  },

  // Legacy checklist: prose prerequisites only, no test-data/ at all. Must
  // read as "unknown", never as "needs nothing".
  "20260110-improve-fixture-legacy": {
    status: "open",
    files: () => ({
      "prompt.md": promptDoc({ issueId: "20260110-improve-fixture-legacy", type: "improve", title: "Legacy checklist." }),
      "manual_test_checklist.md": [
        "# Manual Test Checklist",
        "",
        "**Feature Name:** Legacy checklist",
        `**Issue ID:** 20260110-improve-fixture-legacy`,
        "",
        "## TC-001: Legacy case",
        "",
        "**Prerequisites:**",
        "- Поднять сервис X и дождаться готовности.",
        "- Войти под учётной записью тестировщика.",
        "",
        "**Steps:**",
        "",
        "| Step | Action | Expected Result | Result |",
        "| --- | --- | --- | --- |",
        "| 1 | Открыть сервис X | Сервис отвечает | [ ] |",
        "| 2 | Выйти | Сессия закрыта | [ ] |",
        "",
        "**Notes:**",
        "",
      ].join("\n"),
    }),
  },

  // Declared data, fixtures present, setup.mjs absent → "visible but
  // unavailable, and here is why".
  "20260111-feat-fixture-noscript": {
    status: "open",
    files: () => ({
      "prompt.md": promptDoc({ issueId: "20260111-feat-fixture-noscript", type: "feat", title: "Declared data, no setup script." }),
      "manual_test_checklist.md": checklistDoc({
        issueId: "20260111-feat-fixture-noscript",
        feature: "No setup script",
        cases: 1,
        steps: 2,
        extraSections: { "TC-001": ["**Test Data:**", "- `case-a/input.txt`"] },
      }),
      "test-data/fixtures/case-a/input.txt": "orphaned fixture\n",
    }),
  },

  // The one closed issue: reading must work exactly as for an open one,
  // while the prepare action must not be offered.
  "20260112-feat-fixture-closed": {
    status: "closed",
    files: () => ({
      "prompt.md": promptDoc({ issueId: "20260112-feat-fixture-closed", type: "feat", title: "Closed issue, full document set." }),
      "brd.md": simpleDoc("BRD — closed fixture", ["## Goals", "- G1: stay readable after closing."]),
      "analysis.md": simpleDoc("Analysis — closed fixture", ["Nothing to analyse."]),
      "notes.md": simpleDoc("Notes — closed fixture", ["Closed issues keep their notes."]),
      "specs.md": simpleDoc("Specs — closed fixture", ["## Interfaces", "- None."]),
      "implementation_plan.md": simpleDoc("Implementation Plan — closed fixture", ["#### Task 1: Exist", "**Files:** none"]),
      "test_plan.md": simpleDoc("Test Plan — closed fixture", ["### TC-001: Fixture case", "**Priority:** Low"]),
      "manual_test_checklist.md": checklistDoc({ issueId: "20260112-feat-fixture-closed", feature: "Closed fixture", cases: 1, steps: 2 }),
      "qa_report.md": simpleDoc("QA Report — closed fixture", ["**Verdict:** PASS"]),
      "test-data/fixtures/case-a/input.txt": "closed fixture data\n",
    }),
  },
};

const ALL_FIXTURE_ISSUE_IDS = Object.keys(FIXTURE_ISSUES);

// Project-root files a fixture repository always carries, so the role
// explorer has the project-level documents it lists next to issue documents.
function defaultProjectFiles(name) {
  return {
    "PLANNING.md": simpleDoc(`Planning — ${name}`, ["Framework Version: 3.0.0", "Fixture project."]),
    "CLAUDE.md": simpleDoc(`Claude instructions — ${name}`, ["Fixture project instructions.", "Trunk branch: develop."]),
    ".qa-workflow.md": simpleDoc(`QA workflow — ${name}`, ["## Automated", "- make test", "## Manual", "- none"]),
    "docs/planning/decisions.md": simpleDoc("Decisions", ["## D-001: Use fixtures", "Fixtures beat real repositories in tests."]),
    "docs/planning/session-log.md": simpleDoc("Session Log", ["## 2026-07-29", "- Fixture project created."]),
    "docs/planning/implementation-plan.md": simpleDoc("Implementation Plan", ["## Roadmap", "- Nothing planned."]),
    "README.md": simpleDoc(name, ["Fixture project for the Manual Test UI test suite."]),
  };
}

// ---------------------------------------------------------------------------
// Git fixture repositories
// ---------------------------------------------------------------------------

function runGit(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * Build a throwaway git repository containing the requested fixture issues.
 *
 * @param {object} [options]
 * @param {string[]} [options.issues]        Fixture ids from FIXTURE_ISSUES.
 *                                           Defaults to the full catalogue.
 * @param {string[]} [options.branches]      Extra branches to create off the
 *                                           default branch (e.g. an unrelated
 *                                           `feature/…` to check out).
 * @param {string}   [options.defaultBranch] Defaults to "develop".
 * @param {string}   [options.name]          Project name used in the
 *                                           project-level fixture documents.
 * @param {object}   [options.extraFiles]    `{ "rel/path": "content" }`,
 *                                           committed to the default branch.
 * @param {boolean}  [options.projectFiles]  Set false to omit PLANNING.md &c.
 * @param {boolean}  [options.git]           Set false for a directory that
 *                                           is deliberately *not* a git repo
 *                                           (TC-017 step 6).
 * @returns {{root: string, defaultBranch: string, issues: string[],
 *            issuePath(id): string, run(args): string, currentBranch(): string,
 *            cleanup(): void}}
 */
function makeTempRepo(options = {}) {
  const {
    issues = ALL_FIXTURE_ISSUE_IDS,
    branches = [],
    defaultBranch = "develop",
    name = "fixture-project",
    extraFiles = {},
    projectFiles = true,
    git = true,
  } = options;

  const root = makeTempDir(`pf-ui-repo-${name}-`);

  for (const id of issues) {
    if (!FIXTURE_ISSUES[id]) {
      throw new Error(`unknown fixture issue "${id}" — add it to FIXTURE_ISSUES in test/helpers/fixtures.js`);
    }
  }

  if (projectFiles) writeFileTree(root, defaultProjectFiles(name));
  writeFileTree(root, extraFiles);

  // Both status directories always exist, even when empty: the tool reads
  // docs/issues/{open,closed} and "the directory is missing" is a different
  // situation from "the directory is empty".
  for (const status of ["open", "closed"]) {
    const dir = path.join(root, "docs", "issues", status);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, ".gitkeep"), "", "utf8");
  }

  const onBranch = [];
  for (const id of issues) {
    const spec = FIXTURE_ISSUES[id];
    const base = `docs/issues/${spec.status}/${id}`;
    const files = {};
    for (const [rel, content] of Object.entries(spec.files())) files[`${base}/${rel}`] = content;
    writeFileTree(root, files);
    if (spec.branchFiles) onBranch.push({ id, base, files: spec.branchFiles() });
  }

  if (!git) {
    return {
      root,
      defaultBranch: null,
      issues: [...issues],
      issuePath: (id) => path.join(root, "docs", "issues", FIXTURE_ISSUES[id].status, id),
      run: () => {
        throw new Error("this fixture is deliberately not a git repository");
      },
      currentBranch: () => null,
      cleanup: () => removeTempDir(root),
    };
  }

  runGit(root, ["init", "--quiet", "--initial-branch", defaultBranch]);
  // Local, not global: the suite must run identically on a machine with no
  // git identity configured and must never read the developer's own.
  runGit(root, ["config", "user.email", "fixtures@planning-framework.invalid"]);
  runGit(root, ["config", "user.name", "PF Fixture"]);
  runGit(root, ["config", "commit.gpgsign", "false"]);
  runGit(root, ["config", "core.autocrlf", "false"]);
  runGit(root, ["add", "-A"]);
  runGit(root, ["commit", "--quiet", "-m", "fixture: initial commit"]);

  for (const { id, base, files } of onBranch) {
    const branch = `issue/${id}`;
    runGit(root, ["checkout", "--quiet", "-b", branch]);
    const prefixed = {};
    for (const [rel, content] of Object.entries(files)) prefixed[`${base}/${rel}`] = content;
    writeFileTree(root, prefixed);
    runGit(root, ["add", "-A"]);
    runGit(root, ["commit", "--quiet", "-m", `fixture: ${id} documents on its own branch`]);
    runGit(root, ["checkout", "--quiet", defaultBranch]);
  }

  for (const branch of branches) {
    runGit(root, ["branch", branch, defaultBranch]);
  }

  return {
    root,
    defaultBranch,
    issues: [...issues],
    issuePath: (id) => path.join(root, "docs", "issues", FIXTURE_ISSUES[id].status, id),
    checklistPath: (id) => path.join(root, "docs", "issues", FIXTURE_ISSUES[id].status, id, "manual_test_checklist.md"),
    run: (args) => runGit(root, args),
    currentBranch: () => runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim(),
    isClean: () => runGit(root, ["status", "--porcelain"]).trim() === "",
    cleanup: () => removeTempDir(root),
  };
}

// ---------------------------------------------------------------------------
// Memory root
// ---------------------------------------------------------------------------

// Claude Code keys its per-project state by the project's absolute path with
// every non-alphanumeric character replaced by a dash — `/home/u/dev/proj`
// becomes `-home-u-dev-proj`. Fixtures reproduce that so a suite can prove
// the tool resolves memory by the *project's own* path and not by the path
// the server happens to be running from (TC-017 step 3).
function slugForProjectPath(projectPath) {
  return path.resolve(projectPath).replace(/[^A-Za-z0-9]/g, "-");
}

/**
 * Build a stand-in for `~/.claude`.
 *
 * Layout: `<memRoot>/projects/<slug>/memory/*.md`, with the session
 * transcripts (`*.jsonl`, `sessions-index.json`) sitting *next to* `memory/`
 * — that adjacency is the point: it is what makes "transcripts are excluded"
 * a claim worth testing rather than a tautology.
 *
 * @returns {{root: string, projectsDir: string, slugFor(p): string,
 *            addProject(opts): {slug: string, dir: string, memoryDir: string},
 *            cleanup(): void}}
 */
function makeMemoryRoot(options = {}) {
  const root = options.root || makeTempDir("pf-ui-memory-");
  const projectsDir = path.join(root, "projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  function addProject({ projectPath, slug, memory = {}, transcripts = true, sessionsIndex = true }) {
    const resolvedSlug = slug || slugForProjectPath(projectPath);
    const dir = path.join(projectsDir, resolvedSlug);
    const memoryDir = path.join(dir, "memory");
    fs.mkdirSync(memoryDir, { recursive: true });

    const entries = Object.keys(memory).length
      ? memory
      : {
          "notes.md": simpleDoc("Accumulated notes", ["Fixture memory entry.", "Two lines is enough."]),
          "decisions.md": simpleDoc("Remembered decisions", ["Prefer fixtures over real repositories."]),
        };
    for (const [rel, content] of Object.entries(entries)) {
      const abs = path.join(memoryDir, ...rel.split("/"));
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, "utf8");
    }

    if (transcripts) {
      fs.writeFileSync(
        path.join(dir, "1b71dada-729e-45f3-a17d-d6769d11c2d6.jsonl"),
        JSON.stringify({ type: "user", text: "secret transcript content" }) + "\n",
        "utf8"
      );
    }
    if (sessionsIndex) {
      fs.writeFileSync(
        path.join(dir, "sessions-index.json"),
        JSON.stringify({ sessions: [{ id: "1b71dada-729e-45f3-a17d-d6769d11c2d6" }] }, null, 2) + "\n",
        "utf8"
      );
    }

    return { slug: resolvedSlug, dir, memoryDir };
  }

  return {
    root,
    projectsDir,
    slugFor: slugForProjectPath,
    addProject,
    cleanup: () => removeTempDir(root),
  };
}

// ---------------------------------------------------------------------------
// Server configuration
// ---------------------------------------------------------------------------

/**
 * Write a throwaway `projects.json` and return the path plus the environment
 * that points the server at it.
 *
 * The real `tools/manual-test-ui/projects.json` is never used by a test —
 * it lists whatever projects the developer happens to have checked out, so
 * relying on it would make the suite unreproducible and give a bug in the
 * tool a live repository to damage.
 *
 * @param {{projects?: Array<{name: string, path: string, defaultBranch?: string}>,
 *          projectRoots?: string[]}} config
 * @returns {{configPath: string, env: {PLANNING_TEST_UI_CONFIG: string}, cleanup(): void}}
 */
function makeConfig(config = {}) {
  const dir = makeTempDir("pf-ui-config-");
  const configPath = path.join(dir, "projects.json");
  const body = {};
  if (config.projectRoots) body.projectRoots = config.projectRoots;
  body.projects = (config.projects || []).map((p) => ({
    name: p.name,
    path: p.path,
    ...(p.defaultBranch ? { defaultBranch: p.defaultBranch } : {}),
  }));
  fs.writeFileSync(configPath, JSON.stringify(body, null, 2) + "\n", "utf8");
  return {
    configPath,
    env: { PLANNING_TEST_UI_CONFIG: configPath },
    cleanup: () => removeTempDir(dir),
  };
}

// ---------------------------------------------------------------------------
// Checklist fixture files
// ---------------------------------------------------------------------------

/**
 * Read one of the checked-in checklist fixtures from `test/fixtures/`.
 *
 * Guards the line endings on the way out: `checklist-crlf.md` and
 * `checklist-mixed-eol.md` exist to pin CRLF handling, and if a git
 * autocrlf setting or an editor ever normalises them the suite must say so
 * loudly instead of quietly testing nothing.
 */
function readChecklistFixture(name) {
  const file = name.endsWith(".md") ? name : `${name}.md`;
  const abs = path.join(FIXTURES_DIR, file);
  const content = fs.readFileSync(abs, "utf8");
  if (file === "checklist-crlf.md" && /(^|[^\r])\n/.test(content)) {
    throw new Error(`${file} has been normalised to LF — the CRLF fixture is no longer testing anything`);
  }
  if (file === "checklist-mixed-eol.md") {
    if (!content.includes("\r\n")) throw new Error(`${file} has lost its CRLF endings`);
    if (!/(^|[^\r])\n/.test(content)) throw new Error(`${file} has lost its lone LF ending`);
  }
  return content;
}

/**
 * Copy a checklist fixture over an issue's `manual_test_checklist.md`, so an
 * end-to-end test can drive the real HTTP write path against the exact bytes
 * a unit test uses.
 */
function installChecklistFixture(repo, issueId, fixtureName) {
  const content = readChecklistFixture(fixtureName);
  const target = repo.checklistPath(issueId);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  return { path: target, content };
}

module.exports = {
  TOOL_DIR,
  FIXTURES_DIR,
  REPO_ROOT,
  SETUP_TEMPLATE_PATH,
  renderSetupScript,
  FIXTURE_ISSUES,
  ALL_FIXTURE_ISSUE_IDS,
  makeTempDir,
  removeTempDir,
  isolateTempRoot,
  cleanupAll,
  autoCleanup,
  writeFileTree,
  makeTempRepo,
  makeMemoryRoot,
  makeConfig,
  slugForProjectPath,
  readChecklistFixture,
  installChecklistFixture,
  checklistDoc,
  simpleDoc,
  promptDoc,
};
