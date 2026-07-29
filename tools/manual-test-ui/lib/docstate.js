"use strict";

// What state is a document of an issue in? (implementation_plan.md, Task 8.)
//
// Three states, and the order in which they are decided is the whole point:
//
//   1. the file exists — on disk, or on the issue's own branch → `present`;
//   2. the pipeline for this issue's *type and tier* does not produce it
//      → `not_applicable`;
//   3. otherwise → `missing`, naming the stage that creates it.
//
// Existence beats applicability deliberately. The applicability rules are
// derived from a table (`skills/pf-size-tiers`), and a table can be wrong
// about a particular issue — an `analysis.md` written by hand on a feat
// issue, a `notes.md` left over from before a tier was raised. If
// applicability were checked first, a document that is really sitting in the
// directory would be reported as one that "should not be there" and would
// never be shown. A file that exists is a fact; applicability is a rule
// about facts that have not happened yet.
//
// The classification is only as good as the `type` and `size_tier` recorded
// in the issue's `prompt.md`; when they are absent the conservative default
// is the `medium` tier and the type encoded in the issue id (KI-03).
//
// Server-side only: this module reads the filesystem and shells out to git.
// The role table it is used with (`lib/roles.js`) is the browser-loadable
// half of the pair.

const fs = require("node:fs");
const path = require("node:path");

const git = require("./git");
const markdown = require("./markdown");

// The pipelines, copied from the single definition in
// `skills/pf-size-tiers/SKILL.md` ("Pipelines — what 'preceding stage'
// means"). A document is applicable to an issue exactly when it appears in
// that issue's pipeline.
const PIPELINES = {
  trivial: ["prompt.md", "notes.md", "test_plan.md", "manual_test_checklist.md", "qa_report.md"],
  feat: [
    "prompt.md",
    "brd.md",
    "specs.md",
    "test_plan.md",
    "implementation_plan.md",
    "manual_test_checklist.md",
    "qa_report.md",
  ],
  improve: [
    "prompt.md",
    "brd.md",
    "test_plan.md",
    "implementation_plan.md",
    "manual_test_checklist.md",
    "qa_report.md",
  ],
  bug: [
    "prompt.md",
    "analysis.md",
    "test_plan.md",
    "implementation_plan.md",
    "manual_test_checklist.md",
    "qa_report.md",
  ],
};

// Which stage creates which document. Every applicable-but-absent document
// names one: "not there yet" is only actionable together with "and this is
// what would create it" (AC-04g). `prompt.md` and `analysis.md` are written
// by `/pf` itself — the CREATE and ANALYSIS stages have no skill of their
// own — which is why both point at `/pf`.
const ISSUE_DOC_STAGES = {
  "prompt.md": "/pf",
  "brd.md": "/pf-brd",
  "notes.md": "/pf-brd",
  "analysis.md": "/pf",
  "specs.md": "/pf-spec",
  "test_plan.md": "/pf-test-plan",
  "implementation_plan.md": "/pf-impl-plan",
  "manual_test_checklist.md": "/pf-test",
  "qa_report.md": "/pf-qa",
};

// Project-level documents are never issue-specific, so they are always
// applicable; when one is absent, what creates it is the framework install
// (`make converge`) or, for the QA rules, `/pf-qa-setup`.
const PROJECT_DOC_STAGES = {
  ".qa-workflow.md": "/pf-qa-setup",
};
const DEFAULT_PROJECT_DOC_STAGE = "make converge";

// The instructions section and the memory section are not files, but they
// are entries of a role and so must be in one of the three states too
// (TC-007 step 6).
const INSTRUCTIONS_STAGE = "make converge";
const MEMORY_STAGE = "Claude Code sessions on this project";

const DEFAULT_SIZE_TIER = "medium";
const DEFAULT_TYPE = "feat";
const KNOWN_TYPES = ["feat", "improve", "bug"];
const TRIVIAL_TIER = "trivial";

// The three documents a trivial-tier issue collapses into notes.md, plus the
// plan — the pipeline table above is the authority, this set only shapes the
// wording of the explanation.
const TRIVIAL_COLLAPSED = new Set(["brd.md", "analysis.md", "specs.md", "implementation_plan.md"]);

// ---------------------------------------------------------------------------
// Issue metadata
// ---------------------------------------------------------------------------

/**
 * Read an issue's type and size tier.
 *
 * `prompt.md` frontmatter is the source; the issue id is the fallback for
 * the type (it encodes it, and `ISSUE_ID_RE` has already validated it), and
 * `medium` is the fallback for the tier. Neither fallback is silent — the
 * returned `typeSource`/`tierSource` say where each value came from, so a
 * misclassification can be traced instead of guessed at.
 *
 * @returns {{type: string, sizeTier: string, typeSource: string, tierSource: string}}
 */
function readIssueMeta(promptContent, issueId) {
  const fromId = typeFromIssueId(issueId);
  const meta = {
    type: fromId || DEFAULT_TYPE,
    sizeTier: DEFAULT_SIZE_TIER,
    typeSource: fromId ? "issue-id" : "default",
    tierSource: "default",
  };
  if (typeof promptContent !== "string" || promptContent === "") return meta;

  const entries = (markdown.parseFrontmatter(promptContent).frontmatter || []).filter((e) => e && e.key);
  for (const entry of entries) {
    const key = String(entry.key).trim().toLowerCase();
    const value = String(entry.value).trim().toLowerCase();
    if (key === "size_tier" && value) {
      meta.sizeTier = value;
      meta.tierSource = "prompt.md";
    } else if ((key === "type" || key === "issue_type") && KNOWN_TYPES.includes(value)) {
      meta.type = value;
      meta.typeSource = "prompt.md";
    }
  }
  return meta;
}

function typeFromIssueId(issueId) {
  const m = /^[0-9]{8}-(feat|improve|bug)-/.exec(String(issueId || ""));
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Applicability
// ---------------------------------------------------------------------------

/** The document sequence this issue's pipeline produces, in stage order. */
function pipelineFor(meta) {
  if (meta && meta.sizeTier === TRIVIAL_TIER) return PIPELINES[TRIVIAL_TIER];
  const type = meta && PIPELINES[meta.type] ? meta.type : DEFAULT_TYPE;
  return PIPELINES[type];
}

/**
 * Is `docName` produced by this issue's pipeline at all?
 *
 * A name the pipelines say nothing about (a file inside `test-data/`, say)
 * is treated as applicable: "this tool has no rule about it" must not be
 * reported to a reader as "it should not be here".
 *
 * @returns {{applicable: boolean, reason: string|null}}
 */
function applicability(docName, meta) {
  if (!Object.prototype.hasOwnProperty.call(ISSUE_DOC_STAGES, docName)) {
    return { applicable: true, reason: null };
  }
  if (pipelineFor(meta).includes(docName)) return { applicable: true, reason: null };
  return { applicable: false, reason: notApplicableReason(docName, meta) };
}

function notApplicableReason(docName, meta) {
  const tier = (meta && meta.sizeTier) || DEFAULT_SIZE_TIER;
  const type = (meta && meta.type) || DEFAULT_TYPE;
  if (tier === TRIVIAL_TIER) {
    if (TRIVIAL_COLLAPSED.has(docName)) {
      return `a trivial-tier issue collapses the BRD, the spec and the implementation plan into notes.md`;
    }
    return `the trivial-tier pipeline does not produce ${docName}`;
  }
  if (docName === "notes.md") {
    return `notes.md stands in for brd.md, specs.md and implementation_plan.md only on trivial-tier issues, and this one is ${tier} tier`;
  }
  if (docName === "analysis.md") {
    return `analysis.md belongs to the bug pipeline; a ${type} issue states its problem in brd.md`;
  }
  if (docName === "brd.md") {
    return `a ${type} issue states its problem in analysis.md, not in a BRD`;
  }
  if (docName === "specs.md") {
    return `the ${type} pipeline goes from its problem statement straight to the test plan — it has no separate spec`;
  }
  return `the ${type} pipeline (${tier} tier) does not produce ${docName}`;
}

function stageFor(docName) {
  return Object.prototype.hasOwnProperty.call(ISSUE_DOC_STAGES, docName) ? ISSUE_DOC_STAGES[docName] : null;
}

// ---------------------------------------------------------------------------
// Per-issue context
// ---------------------------------------------------------------------------

function isFile(absPath) {
  try {
    return fs.statSync(absPath).isFile();
  } catch {
    return false;
  }
}

function fileSize(absPath) {
  try {
    return fs.statSync(absPath).size;
  } catch {
    return null;
  }
}

/**
 * Everything the per-document classification needs, gathered once.
 *
 * Gathered once because it costs subprocesses: whether the issue's own
 * branch exists and what it holds are two `git` calls, and a role with nine
 * entries would otherwise make eighteen. `branchFiles` is the issue folder's
 * immediate children *on that branch* — enough to answer "does it exist
 * there" for every pipeline document without a `git show` per document.
 *
 * Closed issues never get a branch: they are merged by definition, so an
 * `issue/<id>` branch that still exists says nothing about where their
 * documents live. This mirrors `classifyChecklist` in server.js.
 *
 * @param {string} projectRoot
 * @param {string} issueId    Already validated against ISSUE_ID_RE.
 * @param {"open"|"closed"} issueStatus
 */
function buildIssueContext(projectRoot, issueId, issueStatus) {
  const issueDir = path.join(projectRoot, "docs", "issues", issueStatus, issueId);
  const issueRelDir = `docs/issues/${issueStatus}/${issueId}`;

  let branch = null;
  let branchFiles = new Set();
  if (issueStatus === "open") {
    const candidate = `issue/${issueId}`;
    if (git.branchExists(projectRoot, candidate)) {
      branch = candidate;
      branchFiles = new Set(git.listTreeNames(projectRoot, candidate, issueRelDir));
    }
  }

  const ctx = { projectRoot, issueId, issueStatus, issueDir, issueRelDir, branch, branchFiles };
  const prompt = readIssueFile(ctx, "prompt.md");
  const meta = readIssueMeta(prompt ? prompt.content : null, issueId);
  return { ...ctx, ...meta, metaSource: prompt ? prompt.location : "none" };
}

/**
 * Read one document of the issue, from disk if it is there and from the
 * issue's branch if it is not.
 *
 * @returns {{content: string, location: "disk"|"branch"}|null}
 */
function readIssueFile(ctx, docName) {
  const abs = path.join(ctx.issueDir, ...String(docName).split("/"));
  if (isFile(abs)) {
    try {
      return { content: fs.readFileSync(abs, "utf8"), location: "disk" };
    } catch {
      return null;
    }
  }
  if (!ctx.branch) return null;
  const content = git.showFile(ctx.projectRoot, ctx.branch, `${ctx.issueRelDir}/${docName}`);
  return content === null ? null : { content, location: "branch" };
}

function existsOnBranch(ctx, docName) {
  if (!ctx.branch) return false;
  // The cheap answer for a document that sits directly in the issue folder —
  // which every pipeline document does; anything nested falls back to a
  // `git show`, which is rare enough not to matter.
  if (!String(docName).includes("/")) return ctx.branchFiles.has(docName);
  return git.showFile(ctx.projectRoot, ctx.branch, `${ctx.issueRelDir}/${docName}`) !== null;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function checkoutOffer(ctx) {
  return {
    required: true,
    branch: ctx.branch,
    message: `This document exists only on ${ctx.branch}. Check that branch out to edit it — the switch happens only on your explicit confirmation.`,
  };
}

/**
 * The state of one document of an issue.
 *
 * @returns {{status: "present"|"not_applicable"|"missing", location: string|null,
 *            readonly: boolean, branch: string|null, checkout: object|null,
 *            stage: string|null, reason: string|null, message: string,
 *            relativePath: string, path: string|null, bytes: number|null}}
 */
function classifyIssueDoc(ctx, docName) {
  const relativePath = `${ctx.issueRelDir}/${docName}`;
  const abs = path.join(ctx.issueDir, ...String(docName).split("/"));

  if (isFile(abs)) {
    return {
      status: "present",
      location: "disk",
      readonly: false,
      branch: null,
      checkout: null,
      stage: null,
      reason: null,
      message: `${docName} is in the working tree.`,
      relativePath,
      path: abs,
      bytes: fileSize(abs),
    };
  }

  if (existsOnBranch(ctx, docName)) {
    return {
      status: "present",
      location: "branch",
      readonly: true,
      branch: ctx.branch,
      checkout: checkoutOffer(ctx),
      stage: null,
      reason: null,
      message: `${docName} exists only on ${ctx.branch} — shown read-only.`,
      relativePath,
      path: null,
      bytes: null,
    };
  }

  const applicable = applicability(docName, ctx);
  if (!applicable.applicable) {
    return {
      status: "not_applicable",
      location: null,
      readonly: true,
      branch: null,
      checkout: null,
      stage: null,
      reason: applicable.reason,
      message: `${docName} does not apply to this issue: ${applicable.reason}.`,
      relativePath,
      path: null,
      bytes: null,
    };
  }

  const stage = stageFor(docName);
  return {
    status: "missing",
    location: null,
    readonly: true,
    branch: null,
    checkout: null,
    stage,
    reason: null,
    message: stage
      ? `${docName} has not been created yet — ${stage} creates it.`
      : `${docName} does not exist in this issue.`,
    relativePath,
    path: null,
    bytes: null,
  };
}

/**
 * The state of a project-level document (PLANNING.md, .qa-workflow.md, …).
 *
 * Applicability does not arise: these belong to the project, not to a
 * pipeline. They are either there or not yet installed.
 */
function classifyProjectDoc(projectRoot, relativePath) {
  const abs = path.join(projectRoot, ...String(relativePath).split("/"));
  if (isFile(abs)) {
    return {
      status: "present",
      location: "disk",
      readonly: false,
      branch: null,
      checkout: null,
      stage: null,
      reason: null,
      message: `${relativePath} is in the working tree.`,
      relativePath,
      path: abs,
      bytes: fileSize(abs),
    };
  }
  const stage = PROJECT_DOC_STAGES[relativePath] || DEFAULT_PROJECT_DOC_STAGE;
  return {
    status: "missing",
    location: null,
    readonly: true,
    branch: null,
    checkout: null,
    stage,
    reason: null,
    message: `${relativePath} does not exist in this project — ${stage} creates it.`,
    relativePath,
    path: null,
    bytes: null,
  };
}

/**
 * The state of the project-instructions section.
 *
 * "Present" means at least one CLAUDE.md bears on the project, inherited
 * ones included; the section is never an empty panel (AC-04e), so the
 * absent case carries the module's own sentence.
 *
 * @param {{instructions: Array, activeCount: number, ownCount: number,
 *          inheritedCount: number, message: string|null}} collected
 *   The result of `lib/instructions.collectInstructions`.
 */
function classifyInstructions(collected) {
  const total = collected && collected.instructions ? collected.instructions.length : 0;
  if (total > 0) {
    return {
      status: "present",
      location: "disk",
      readonly: true,
      branch: null,
      checkout: null,
      stage: null,
      reason: null,
      message:
        collected.message ||
        `${collected.activeCount} of ${total} CLAUDE.md file${total === 1 ? "" : "s"} apply to this project.`,
      relativePath: null,
      path: null,
      bytes: null,
    };
  }
  return {
    status: "missing",
    location: null,
    readonly: true,
    branch: null,
    checkout: null,
    stage: INSTRUCTIONS_STAGE,
    reason: null,
    message:
      (collected && collected.message) ||
      `No CLAUDE.md applies to this project — ${INSTRUCTIONS_STAGE} installs one.`,
    relativePath: null,
    path: null,
    bytes: null,
  };
}

/**
 * The state of the accumulated-memory section.
 *
 * @param {{state: "present"|"absent"|"empty", message: string, files: Array}} listed
 *   The result of `lib/memory.listProjectMemory`.
 */
function classifyMemory(listed) {
  if (listed && listed.state === "present") {
    return {
      status: "present",
      location: "memory",
      readonly: true,
      branch: null,
      checkout: null,
      stage: null,
      reason: null,
      message: listed.message,
      relativePath: null,
      path: listed.memoryDir || null,
      bytes: null,
    };
  }
  return {
    status: "missing",
    location: null,
    readonly: true,
    branch: null,
    checkout: null,
    stage: MEMORY_STAGE,
    reason: null,
    // Said in words, never as an empty list (AC-04f).
    message: (listed && listed.message) || "No memory has been recorded for this project yet.",
    relativePath: null,
    path: null,
    bytes: null,
  };
}

module.exports = {
  PIPELINES,
  ISSUE_DOC_STAGES,
  PROJECT_DOC_STAGES,
  DEFAULT_PROJECT_DOC_STAGE,
  INSTRUCTIONS_STAGE,
  MEMORY_STAGE,
  DEFAULT_SIZE_TIER,
  readIssueMeta,
  pipelineFor,
  applicability,
  stageFor,
  buildIssueContext,
  readIssueFile,
  classifyIssueDoc,
  classifyProjectDoc,
  classifyInstructions,
  classifyMemory,
};
