#!/usr/bin/env node
"use strict";

// Manual Test UI — a small local server for filling in the manual test
// checklists produced by the pf-test skill (docs/issues/{open,closed}/*/manual_test_checklist.md).
//
// Zero npm dependencies on purpose: this is a personal local tool, not a
// shipped product. The only git operation it ever performs is `git checkout`
// of an issue's own branch, and only after the user explicitly confirms it
// in the UI — everything else (listing, reading a checklist that lives on
// an unmerged branch) is read-only. Committing stays the job of /pf-close.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const { parseChecklist, summarize, patchStepResult, patchNotes } = require("./lib/checklist");
const git = require("./lib/git");
const paths = require("./lib/paths");
const instructions = require("./lib/instructions");
const memory = require("./lib/memory");
const roles = require("./lib/roles");
const docstate = require("./lib/docstate");

const TOOL_DIR = __dirname;
const PUBLIC_DIR = path.join(TOOL_DIR, "public");
const LIB_DIR = path.join(TOOL_DIR, "lib");
const ISSUE_ID_RE = /^[0-9]{8}-(feat|improve|bug)-[a-z0-9-]+$/;

// Modules the browser is allowed to load from lib/. An explicit allowlist,
// not a directory: everything else in lib/ is server-side code (git wrappers,
// path validation) that has no business being downloadable.
const BROWSER_MODULES = ["markdown.js", "roles.js"];

// Documents are prose; a multi-megabyte "document" is a mistake somewhere,
// and streaming it into a JSON response helps nobody.
const MAX_READ_BYTES = 4 * 1024 * 1024;

// A subdirectory counts as a project if it looks like it has ever adopted
// the Planning Framework issue layout — i.e. docs/issues exists. Scans one
// level deep only (matches the flat D:/dev/<project> convention); doesn't
// recurse, so it won't wander into node_modules or nested checkouts.
function discoverProjectsUnderRoot(rootPath) {
  const found = [];
  if (!fs.existsSync(rootPath)) {
    console.warn(`WARNING: projectRoots entry does not exist: ${rootPath} — skipping`);
    return found;
  }
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const candidate = path.join(rootPath, entry.name);
    if (fs.existsSync(path.join(candidate, "docs", "issues"))) {
      found.push({ name: entry.name, path: candidate });
    }
  }
  return found;
}

function loadProjects() {
  const configPath = process.env.PLANNING_TEST_UI_CONFIG || path.join(TOOL_DIR, "projects.json");
  if (!fs.existsSync(configPath)) {
    console.error(`No config found at ${configPath}.`);
    console.error(`Copy projects.json.example to projects.json and set it up (see tools/manual-test-ui/README.md).`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));

  // Keyed by resolved absolute path so the same project can't appear twice
  // under two names (e.g. auto-discovered as "ga" and also listed
  // explicitly as "goal-attacker"). Discovery runs first; explicit
  // `projects` entries for the same path override the name/defaultBranch.
  const byPath = new Map();

  for (const rootPath of raw.projectRoots || []) {
    for (const found of discoverProjectsUnderRoot(path.resolve(rootPath))) {
      const resolved = path.resolve(found.path);
      if (byPath.has(resolved) && byPath.get(resolved).name !== found.name) {
        console.warn(
          `WARNING: "${resolved}" discovered under two different names ` +
            `("${byPath.get(resolved).name}" and "${found.name}") — keeping "${found.name}"`
        );
      }
      byPath.set(resolved, { name: found.name, root: resolved, configuredDefaultBranch: null });
    }
  }

  for (const p of raw.projects || []) {
    if (!p.name || !p.path) continue;
    const resolved = path.resolve(p.path);
    if (!fs.existsSync(resolved)) {
      console.warn(`WARNING: project "${p.name}" path does not exist: ${resolved} — skipping`);
      continue;
    }
    // p.defaultBranch is an optional override; otherwise resolved
    // per-request from develop/main/master, since which branches exist can
    // change without restarting the server. Explicit entries always win
    // over an auto-discovered one at the same path.
    byPath.set(resolved, { name: p.name, root: resolved, configuredDefaultBranch: p.defaultBranch || null });
  }

  const projects = new Map();
  for (const { name, root, configuredDefaultBranch } of byPath.values()) {
    projects.set(name, { root, configuredDefaultBranch });
  }
  return projects;
}

// Every issue-id name under docs/issues/{open,closed}, sourced from the
// project's default branch (develop/main/...) via `git ls-tree` — NOT from
// whatever happens to be checked out right now. Issue folders (prompt.md,
// brd.md, ...) land on the default branch as soon as an issue starts, well
// before its manual_test_checklist.md exists anywhere, and sibling issues
// created after the current branch diverged wouldn't be on disk at all —
// so "list all issues" has to mean "as known to the default branch."
function findIssueDirs(projectRoot, defaultBranch) {
  const results = [];
  for (const status of ["open", "closed"]) {
    const names = git.listTreeNames(projectRoot, defaultBranch, `docs/issues/${status}`);
    for (const name of names) {
      if (ISSUE_ID_RE.test(name)) results.push({ issueId: name, status });
    }
  }
  return results;
}

// Determines where an issue's checklist actually lives:
//   "here"      — on disk right now, on the checked-out branch. Editable.
//   "on_branch" — not on disk, but present on the issue's own issue/<id>
//                 branch (created, not yet merged). Read-only preview via
//                 `git show`; editing requires checking that branch out.
//   "missing"   — no checklist anywhere yet (pf-test hasn't run for it).
// Closed issues are always merged, so "on_branch" never applies to them —
// if it's not on disk for a closed issue, it's simply missing.
function classifyChecklist(projectRoot, issueId, status) {
  const checklistPath = path.join(projectRoot, "docs", "issues", status, issueId, "manual_test_checklist.md");
  if (fs.existsSync(checklistPath)) {
    return { checklistStatus: "here", checklistPath, branch: null, previewContent: null };
  }
  if (status === "open") {
    const branch = `issue/${issueId}`;
    if (git.branchExists(projectRoot, branch)) {
      const relPosix = `docs/issues/open/${issueId}/manual_test_checklist.md`;
      const content = git.showFile(projectRoot, branch, relPosix);
      if (content !== null) {
        return { checklistStatus: "on_branch", checklistPath: null, branch, previewContent: content };
      }
    }
  }
  return { checklistStatus: "missing", checklistPath: null, branch: null, previewContent: null };
}

function findChecklists(projectRoot, defaultBranch) {
  return findIssueDirs(projectRoot, defaultBranch).map(({ issueId, status }) => ({
    issueId,
    status,
    ...classifyChecklist(projectRoot, issueId, status),
  }));
}

// Same classification, but for one specific issue (routes that already
// know the issueId, instead of scanning every issue in the project). Checks
// disk first (covers the common case cheaply), then falls back to the
// default-branch issue list for issues that aren't on the checked-out
// branch at all.
function resolveIssue(projectRoot, issueId, defaultBranch) {
  if (!ISSUE_ID_RE.test(issueId)) return null;
  for (const status of ["open", "closed"]) {
    if (fs.existsSync(path.join(projectRoot, "docs", "issues", status, issueId))) {
      return { issueId, status, ...classifyChecklist(projectRoot, issueId, status) };
    }
  }
  const known = findIssueDirs(projectRoot, defaultBranch).find((e) => e.issueId === issueId);
  if (!known) return null;
  return { issueId, status: known.status, ...classifyChecklist(projectRoot, issueId, known.status) };
}

function readChecklistContent(entry) {
  if (entry.checklistStatus === "here") return fs.readFileSync(entry.checklistPath, "utf8");
  if (entry.checklistStatus === "on_branch") return entry.previewContent;
  return null;
}

function issueSummary(entry) {
  const content = readChecklistContent(entry);
  const parsed = content ? parseChecklist(content) : null;
  return {
    issueId: entry.issueId,
    status: entry.status,
    checklistStatus: entry.checklistStatus,
    branch: entry.branch,
    feature: parsed ? parsed.meta["Feature Name"] || "" : "",
    date: parsed ? parsed.meta["Date"] || "" : "",
    summary: parsed ? summarize(parsed) : { totalSteps: 0, passedSteps: 0, totalTcs: 0 },
  };
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function serveStatic(res, pathname) {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(PUBLIC_DIR, rel);
  const resolved = path.resolve(filePath);
  // Containment is decided by lib/paths, i.e. on real paths compared segment
  // by segment. The string prefix this used to be would have accepted a
  // sibling directory sharing the prefix (`public-x/evil.js`) and anything a
  // symlink under public/ pointed at (TC-011).
  if (!paths.isInside(PUBLIC_DIR, resolved)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(resolved);
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
    res.writeHead(200, { "Content-Type": (types[ext] || "application/octet-stream") + "; charset=utf-8" });
    res.end(data);
  });
}

// GET /lib/<basename>.js — the modules that load both in Node (`require`,
// under `node --test`) and in the browser (`<script src>`), served so the
// client never carries a second copy of logic the suite already covers.
// Allowlisted by exact basename: an unlisted name is 403 whether or not the
// file exists, and a listed-but-absent one is a plain 404.
function serveLibModule(res, pathname) {
  const match = /^\/lib\/([^/]+)$/.exec(pathname);
  const name = match ? match[1] : null;
  if (!name || !BROWSER_MODULES.includes(name)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  const resolved = path.resolve(path.join(LIB_DIR, name));
  if (!paths.isInside(LIB_DIR, resolved)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    res.end(data);
  });
}

// Send one file the path validation has already approved. Failure modes are
// spelled out (missing / not a file / too large) because "the tool went
// quiet" and "that document does not exist" are different answers, and
// because a read that fails must never become a 500 (TC-011).
function sendFileContent(res, absPath, extra = {}) {
  let stat;
  try {
    stat = fs.statSync(absPath);
  } catch {
    return sendJson(res, 404, { error: "file_not_found", message: "No such file.", ...extra });
  }
  if (stat.isDirectory()) {
    return sendJson(res, 400, { error: "not_a_file", message: "That path is a directory, not a document.", ...extra });
  }
  if (!stat.isFile()) {
    return sendJson(res, 400, { error: "not_a_file", message: "That path is not a regular file.", ...extra });
  }
  if (stat.size > MAX_READ_BYTES) {
    return sendJson(res, 413, {
      error: "file_too_large",
      message: `That file is larger than the ${MAX_READ_BYTES} bytes this tool will read.`,
      bytes: stat.size,
      ...extra,
    });
  }
  let content;
  try {
    content = fs.readFileSync(absPath, "utf8");
  } catch (e) {
    return sendJson(res, 404, { error: "file_not_readable", message: e.message, ...extra });
  }
  return sendJson(res, 200, { ...extra, path: absPath, bytes: stat.size, content });
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
//
// The server owns the role → documents mapping and the state of every entry
// in it; the client renders what it is given and keeps no list of its own
// (AC-04a…AC-04d, TC-006). Nothing about a role is remembered between
// requests either — there is no "current role" on the server, which is what
// makes switching roles free at any moment and makes two identical requests
// literally identical answers (TC-006 step 6).

function projectApiBase(projectName) {
  return `/api/projects/${encodeURIComponent(projectName)}`;
}

function issueApiBase(projectName, issueId) {
  return `${projectApiBase(projectName)}/issues/${encodeURIComponent(issueId)}`;
}

// Where a role entry's content is fetched from. Emitted per entry so the
// client never has to build an API path — and so a document that lives only
// on the issue branch is fetched through the route that knows how to preview
// it, rather than through the plain project-document route that would 404.
function endpointForItem(projectName, entry, item, state) {
  const base = projectApiBase(projectName);
  switch (item.kind) {
    case roles.KIND.ISSUE_DOC:
      return `${issueApiBase(projectName, entry.issueId)}/docs?path=${encodeURIComponent(state.relativePath)}`;
    case roles.KIND.PROJECT_DOC:
      return `${base}/docs?path=${encodeURIComponent(state.relativePath)}`;
    case roles.KIND.INSTRUCTIONS:
      return `${base}/instructions`;
    case roles.KIND.MEMORY:
      return `${base}/memory`;
    case roles.KIND.ACTION:
      return `${issueApiBase(projectName, entry.issueId)}/prepare`;
    default:
      return null;
  }
}

// State of the "prepare this case's test data" entry of the tester role.
//
// It is an action, not a document, but it is an entry of a role and so has
// to carry one of the same three states (TC-007 step 6). It tracks the
// checklist, which is what the data is prepared *for*:
//   * closed issue          → not offered at all (AC-04i);
//   * no checklist yet      → missing, and /pf-test is what creates it;
//   * checklist on a branch → offered, disabled, and the reason says the
//     branch has to be checked out first (AC-04h, TC-007 step 5);
//   * checklist on disk     → offered and enabled.
// The per-case refinement (declared / none / unknown test data) is layered
// on top of this by a later task; the shape is already the one it returns.
function prepareActionState(projectName, entry) {
  const common = { location: null, readonly: true, branch: null, checkout: null, reason: null };
  if (entry.status === "closed") {
    return {
      ...common,
      status: "not_applicable",
      stage: null,
      offered: false,
      enabled: false,
      requiresCheckout: false,
      reason: "a closed issue is an archive — preparing its test data is not offered here",
      message: "This issue is closed; the prepare action is not offered for it.",
    };
  }
  if (entry.checklistStatus === "missing") {
    return {
      ...common,
      status: "missing",
      stage: "/pf-test",
      offered: false,
      enabled: false,
      requiresCheckout: false,
      message: "There is no manual_test_checklist.md to prepare data for yet — /pf-test creates it.",
    };
  }
  if (entry.checklistStatus === "on_branch") {
    return {
      ...common,
      status: "present",
      stage: null,
      offered: true,
      enabled: false,
      requiresCheckout: true,
      branch: entry.branch,
      checkout: {
        required: true,
        branch: entry.branch,
        endpoint: `${issueApiBase(projectName, entry.issueId)}/checklist/checkout`,
        method: "POST",
        message: `Checking out ${entry.branch} happens only on your explicit confirmation.`,
      },
      reason: `the checklist lives on ${entry.branch}, which is not checked out`,
      message: `Check out ${entry.branch} first — test data is prepared into the checked-out issue.`,
    };
  }
  return {
    ...common,
    status: "present",
    stage: null,
    offered: true,
    enabled: true,
    requiresCheckout: false,
    message: "Test data can be prepared for the cases of this issue.",
  };
}

// One role, its entries, and the state of each — for one issue.
function buildRoleContents(projectName, projectRoot, entry, roleId) {
  const role = roles.getRole(roleId);
  const ctx = docstate.buildIssueContext(projectRoot, entry.issueId, entry.status);
  const checkoutEndpoint = `${issueApiBase(projectName, entry.issueId)}/checklist/checkout`;

  const items = role.items.map((item) => {
    let state;
    let method = "GET";
    switch (item.kind) {
      case roles.KIND.ISSUE_DOC:
        state = docstate.classifyIssueDoc(ctx, item.name);
        break;
      case roles.KIND.PROJECT_DOC:
        state = docstate.classifyProjectDoc(projectRoot, item.docPath);
        break;
      case roles.KIND.INSTRUCTIONS:
        state = docstate.classifyInstructions(instructions.collectInstructions(projectRoot));
        break;
      case roles.KIND.MEMORY:
        state = docstate.classifyMemory(memory.listProjectMemory(projectRoot, process.env));
        break;
      case roles.KIND.ACTION:
        state = prepareActionState(projectName, entry);
        method = "POST";
        break;
      default:
        // Unreachable while lib/roles.js and this switch agree; an entry with
        // no state at all is exactly what TC-007 step 6 forbids, so say so
        // rather than emit a blank.
        state = {
          status: "missing",
          stage: "unknown",
          location: null,
          readonly: true,
          branch: null,
          checkout: null,
          reason: null,
          message: `This tool does not know how to resolve a role entry of kind "${item.kind}".`,
          relativePath: null,
          path: null,
          bytes: null,
        };
    }
    if (state.checkout && !state.checkout.endpoint) {
      state = { ...state, checkout: { ...state.checkout, endpoint: checkoutEndpoint, method: "POST" } };
    }
    return { ...item, ...state, endpoint: endpointForItem(projectName, entry, item, state), method };
  });

  return {
    project: projectName,
    issueId: entry.issueId,
    issueStatus: entry.status,
    type: ctx.type,
    sizeTier: ctx.sizeTier,
    typeSource: ctx.typeSource,
    tierSource: ctx.tierSource,
    metaSource: ctx.metaSource,
    currentBranch: git.getCurrentBranch(projectRoot),
    issueBranch: ctx.branch,
    checklistStatus: entry.checklistStatus,
    role: { id: role.id, title: role.title, description: role.description },
    items,
  };
}

// GET .../issues/:id/docs?path=… — one document of one issue, with its state.
//
// Not folded into the project-wide `docs` route because two things are true
// here and nowhere else: a document may exist only on the issue's own branch
// (previewed read-only, with the switch offered), and a document that does
// not exist has an *answer* — not applicable to this issue, or not created
// yet by such-and-such stage. All three states come back as 200 with an
// explanation: the client has to render the explanation, and a 404 would
// make it show an error instead (AC-04g).
function serveIssueDoc(res, projectName, projectRoot, entry, requested) {
  const resolved = paths.resolveProjectFile(projectRoot, requested);
  if (!resolved.ok) {
    return sendJson(res, resolved.status, { error: resolved.error, message: resolved.message });
  }
  const ctx = docstate.buildIssueContext(projectRoot, entry.issueId, entry.status);
  if (!paths.isInside(ctx.issueDir, resolved.path)) {
    return sendJson(res, 400, {
      error: "path_not_in_issue",
      message: `That path is not inside ${ctx.issueRelDir}. Project documents are read through ${projectApiBase(projectName)}/docs.`,
    });
  }
  const docName = paths.toPosix(path.relative(ctx.issueDir, resolved.path));
  if (!docName) {
    return sendJson(res, 400, { error: "not_a_file", message: "That path is the issue folder itself, not a document." });
  }

  const state = docstate.classifyIssueDoc(ctx, docName);
  const envelope = {
    project: projectName,
    issueId: entry.issueId,
    issueStatus: entry.status,
    name: docName,
    relativePath: state.relativePath,
    status: state.status,
    location: state.location,
    readonly: state.readonly,
    branch: state.branch,
    checkout: state.checkout
      ? {
          ...state.checkout,
          endpoint: `${issueApiBase(projectName, entry.issueId)}/checklist/checkout`,
          method: "POST",
        }
      : null,
    stage: state.stage,
    reason: state.reason,
    message: state.message,
  };

  if (state.status === "present" && state.location === "disk") {
    return sendFileContent(res, state.path, envelope);
  }
  if (state.status === "present" && state.location === "branch") {
    const content = git.showFile(projectRoot, state.branch, state.relativePath);
    if (content === null) {
      // The branch moved between listing and reading. Report the state, not
      // a 500.
      return sendJson(res, 200, {
        ...envelope,
        status: "missing",
        location: null,
        stage: docstate.stageFor(docName),
        content: null,
        bytes: null,
        message: `${docName} is no longer on ${state.branch}.`,
      });
    }
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > MAX_READ_BYTES) {
      return sendJson(res, 413, {
        ...envelope,
        error: "file_too_large",
        message: `That file is larger than the ${MAX_READ_BYTES} bytes this tool will read.`,
        bytes,
      });
    }
    return sendJson(res, 200, { ...envelope, bytes, content });
  }
  return sendJson(res, 200, { ...envelope, bytes: null, content: null });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(new Error("invalid_json_body"));
      }
    });
    req.on("error", reject);
  });
}

function requireCheckedOut(res, entry) {
  if (entry.checklistStatus === "here") return true;
  if (entry.checklistStatus === "on_branch") {
    sendJson(res, 409, {
      error: "not_checked_out",
      checklistStatus: "on_branch",
      branch: entry.branch,
      message: `This checklist lives on ${entry.branch}, which isn't checked out. Checkout that branch first (POST .../checkout), then retry.`,
    });
    return false;
  }
  sendJson(res, 404, {
    error: "checklist_not_found",
    checklistStatus: "missing",
    message: "No manual_test_checklist.md exists yet for this issue — run /pf-test on it first.",
  });
  return false;
}

async function handleApi(req, res, parts, projects, query) {
  // parts = pathname split on "/", filtered — e.g.
  // ["api","roles"]
  // ["api","projects"]
  // ["api","projects",":name","docs"]           ?path=<relative path>
  // ["api","projects",":name","instructions"]
  // ["api","projects",":name","memory"]
  // ["api","projects",":name","memory","file"]  ?path=<relative path>
  // ["api","projects",":name","issues"]
  // ["api","projects",":name","issues",":id","checklist"]
  // ["api","projects",":name","issues",":id","checklist","steps"]
  // ["api","projects",":name","issues",":id","checklist","notes"]
  // ["api","projects",":name","issues",":id","checklist","checkout"]
  // ["api","projects",":name","issues",":id","docs"]             ?path=<relative path>
  // ["api","projects",":name","issues",":id","roles",":role"]

  // GET /api/roles — the role table itself. Project- and issue-independent:
  // which roles exist and what each declares is a property of the framework,
  // not of a repository.
  if (parts.length === 2 && parts[1] === "roles" && req.method === "GET") {
    return sendJson(res, 200, { roles: roles.listRoles() });
  }

  if (parts.length === 2 && parts[1] === "projects" && req.method === "GET") {
    const list = [...projects.entries()].map(([name, p]) => {
      const defaultBranch = git.resolveDefaultBranch(p.root, p.configuredDefaultBranch);
      return {
        name,
        currentBranch: git.getCurrentBranch(p.root),
        defaultBranch,
        issueCount: findChecklists(p.root, defaultBranch).filter((e) => e.checklistStatus !== "missing").length,
      };
    });
    return sendJson(res, 200, list);
  }

  if (parts[1] !== "projects" || parts.length < 3) {
    return sendJson(res, 404, { error: "not_found" });
  }
  const projectName = decodeURIComponent(parts[2]);
  const project = projects.get(projectName);
  if (!project) return sendJson(res, 404, { error: "unknown_project" });
  const projectRoot = project.root;

  // ---- read-only sources that need no git and no issue -------------------
  // Placed before the default-branch lookup on purpose: none of them depends
  // on git, and resolving a branch costs a subprocess per request.

  // GET .../docs?path=<relative path> — any document of the project itself.
  // The path comes from the client, so it goes through lib/paths and nothing
  // else; a rejection is always 4xx with no content attached.
  if (parts.length === 4 && parts[3] === "docs" && req.method === "GET") {
    const requested = query.get("path");
    const resolved = paths.resolveProjectFile(projectRoot, requested);
    if (!resolved.ok) {
      return sendJson(res, resolved.status, { error: resolved.error, message: resolved.message });
    }
    return sendFileContent(res, resolved.path, {
      project: projectName,
      relativePath: resolved.relativePath,
    });
  }

  // GET .../instructions — every CLAUDE.md in force for the project, with
  // the inherited ones flagged and templates/fixtures marked inactive.
  if (parts.length === 4 && parts[3] === "instructions" && req.method === "GET") {
    return sendJson(res, 200, { project: projectName, ...instructions.collectInstructions(projectRoot) });
  }

  // GET .../memory — accumulated memory for the project, from outside the
  // repository. Session transcripts are not part of it.
  if (parts.length === 4 && parts[3] === "memory" && req.method === "GET") {
    return sendJson(res, 200, { project: projectName, ...memory.listProjectMemory(projectRoot, process.env) });
  }

  // GET .../memory/file?path=<path relative to the project's memory dir>
  if (parts.length === 5 && parts[3] === "memory" && parts[4] === "file" && req.method === "GET") {
    const requested = query.get("path");
    const resolved = paths.resolveMemoryFile(projectRoot, requested, process.env);
    if (!resolved.ok) {
      return sendJson(res, resolved.status, { error: resolved.error, message: resolved.message });
    }
    return sendFileContent(res, resolved.path, {
      project: projectName,
      relativePath: resolved.relativePath,
      memoryDir: resolved.memoryDir,
    });
  }

  const defaultBranch = git.resolveDefaultBranch(projectRoot, project.configuredDefaultBranch);

  if (parts.length === 4 && parts[3] === "issues" && req.method === "GET") {
    const list = findChecklists(projectRoot, defaultBranch).map(issueSummary);
    return sendJson(res, 200, { currentBranch: git.getCurrentBranch(projectRoot), defaultBranch, issues: list });
  }

  if (parts.length < 6 || parts[3] !== "issues") {
    return sendJson(res, 404, { error: "not_found" });
  }
  const issueId = decodeURIComponent(parts[4]);
  const entry = resolveIssue(projectRoot, issueId, defaultBranch);
  if (!entry) return sendJson(res, 404, { error: "issue_not_found" });

  // GET .../issues/:id/docs?path=<relative path> — one issue document, with
  // its state (present / not applicable / missing, and where it lives).
  if (parts.length === 6 && parts[5] === "docs" && req.method === "GET") {
    return serveIssueDoc(res, projectName, projectRoot, entry, query.get("path"));
  }

  // GET .../issues/:id/roles/:role — the entries of one role for one issue.
  if (parts.length === 7 && parts[5] === "roles" && req.method === "GET") {
    const roleId = decodeURIComponent(parts[6]);
    if (!roles.hasRole(roleId)) {
      return sendJson(res, 404, {
        error: "unknown_role",
        message: `No such role. This tool has ${roles.ROLE_IDS.join(", ")}.`,
      });
    }
    return sendJson(res, 200, buildRoleContents(projectName, projectRoot, entry, roleId));
  }

  if (parts[5] !== "checklist") {
    return sendJson(res, 404, { error: "not_found" });
  }

  // GET full parsed checklist — works read-only even when checklistStatus
  // is "on_branch" (previews via git show), so the UI can show the TC list
  // and let the user decide whether to check the branch out.
  if (parts.length === 6 && req.method === "GET") {
    const content = readChecklistContent(entry);
    if (content === null) {
      return sendJson(res, 404, {
        error: "checklist_not_found",
        checklistStatus: "missing",
        message: "No manual_test_checklist.md exists yet for this issue — run /pf-test on it first.",
      });
    }
    const parsed = parseChecklist(content);
    parsed.checklistStatus = entry.checklistStatus;
    parsed.branch = entry.branch;
    return sendJson(res, 200, parsed);
  }

  // POST .../checklist/checkout — the one place this tool touches git state,
  // and only on explicit user confirmation from the UI.
  if (parts.length === 7 && parts[6] === "checkout" && req.method === "POST") {
    if (entry.checklistStatus === "here") return sendJson(res, 200, { ok: true, alreadyCheckedOut: true });
    if (entry.checklistStatus !== "on_branch") {
      return sendJson(res, 400, { error: "no_branch_to_checkout" });
    }
    if (!git.isWorkingTreeClean(projectRoot)) {
      return sendJson(res, 409, {
        error: "dirty_working_tree",
        message: "Working tree has uncommitted changes — commit or stash them yourself first, then retry.",
      });
    }
    try {
      git.checkoutBranch(projectRoot, entry.branch);
    } catch (e) {
      return sendJson(res, 500, { error: "checkout_failed", message: e.message });
    }
    return sendJson(res, 200, { ok: true, branch: entry.branch });
  }

  // PATCH .../checklist/steps  { tcId, step, checked, note }
  if (parts.length === 7 && parts[6] === "steps" && req.method === "PATCH") {
    if (!requireCheckedOut(res, entry)) return;
    let body;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      return sendJson(res, 400, { error: "invalid_json_body" });
    }
    const { tcId, step, checked, note } = body;
    if (typeof tcId !== "string" || typeof step !== "number") {
      return sendJson(res, 400, { error: "tcId (string) and step (number) are required" });
    }
    try {
      const content = fs.readFileSync(entry.checklistPath, "utf8");
      const patched = patchStepResult(content, tcId, step, { checked: !!checked, note: note || "" });
      fs.writeFileSync(entry.checklistPath, patched, "utf8");
      return sendJson(res, 200, { ok: true, summary: summarize(parseChecklist(patched)) });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  // PATCH .../checklist/notes  { tcId, notesText }
  if (parts.length === 7 && parts[6] === "notes" && req.method === "PATCH") {
    if (!requireCheckedOut(res, entry)) return;
    let body;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      return sendJson(res, 400, { error: "invalid_json_body" });
    }
    const { tcId, notesText } = body;
    if (typeof tcId !== "string") {
      return sendJson(res, 400, { error: "tcId (string) is required" });
    }
    try {
      const content = fs.readFileSync(entry.checklistPath, "utf8");
      const patched = patchNotes(content, tcId, notesText || "");
      fs.writeFileSync(entry.checklistPath, patched, "utf8");
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  return sendJson(res, 404, { error: "not_found" });
}

/**
 * Build the HTTP server for a project map, without listening.
 *
 * Separate from main() so tests can drive the real routing with their own
 * fixture configuration and an ephemeral port, instead of a process that
 * has already bound 4317.
 */
function createServer(projects) {
  return http.createServer(async (req, res) => {
    let pathname;
    let query;
    try {
      const [rawPath, rawQuery = ""] = req.url.split("?");
      pathname = decodeURI(rawPath);
      query = new URLSearchParams(rawQuery);
    } catch {
      // A malformed percent-escape is a bad request, not a crashed server.
      return sendJson(res, 400, { error: "invalid_url", message: "The request URL could not be decoded." });
    }
    if (pathname.startsWith("/api/")) {
      const parts = pathname.split("/").filter(Boolean);
      try {
        await handleApi(req, res, parts, projects, query);
      } catch (e) {
        console.error(e);
        sendJson(res, 500, { error: "internal_error", message: e.message });
      }
      return;
    }
    if (pathname === "/lib" || pathname.startsWith("/lib/")) {
      return serveLibModule(res, pathname);
    }
    serveStatic(res, pathname);
  });
}

function main() {
  const projects = loadProjects();
  if (projects.size === 0) {
    console.error("No valid projects configured in projects.json. Nothing to serve.");
    process.exit(1);
  }

  const portArgIdx = process.argv.indexOf("--port");
  const port = portArgIdx !== -1 ? parseInt(process.argv[portArgIdx + 1], 10) : parseInt(process.env.PORT || "4317", 10);

  const server = createServer(projects);

  server.listen(port, () => {
    console.log(`Manual Test UI running at http://localhost:${port}`);
    console.log(`Projects: ${[...projects.keys()].join(", ")}`);
  });
  return server;
}

module.exports = {
  createServer,
  loadProjects,
  main,
  BROWSER_MODULES,
  ISSUE_ID_RE,
};

// Started as a script: serve. Required as a module (tests, and the test
// harness's forward-compatible path): export only, so requiring the file
// cannot leave a stray server bound to the tool's real port.
if (require.main === module) main();
