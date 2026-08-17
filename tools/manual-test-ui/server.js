#!/usr/bin/env node
"use strict";

// Manual Test UI — a small local server for filling in the manual test
// checklists produced by the pf-test skill (docs/issues/{open,closed}/*/manual_test_checklist.md).
//
// Zero npm dependencies on purpose: this is a personal local tool, not a
// shipped product. It changes exactly three things, each only on an explicit
// request: a checklist cell (PATCH .../checklist/steps|notes), the checked-out
// branch (POST .../checklist/checkout), and a prepared working copy under the
// system temp directory (POST .../issues/:id/prepare). Everything else —
// listing, reading a checklist that lives on an unmerged branch, serving
// documents — is read-only, and none of the three ever writes into the
// repository. Committing stays the job of /pf-close.

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
const prepare = require("./lib/prepare");
const inbox = require("./lib/inbox");

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

// The staging directory setup.mjs assembles a case in before renaming it into
// place. The script sweeps it itself, but a script killed on the timeout never
// reaches its own cleanup — so the server sweeps it after any failed run,
// which is what makes the next prepare work with no manual tidying.
const PREPARE_STAGING_DIR = ".staging";

// How long a setup.mjs may run. Overridable so the suites can shorten it to
// seconds; a bad value falls back to the engine's default rather than to
// NaN (which would mean "no timeout at all").
function prepareTimeoutMs(env = process.env) {
  const parsed = Number.parseInt(env.PLANNING_TEST_UI_PREPARE_TIMEOUT_MS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : prepare.DEFAULT_TIMEOUT_MS;
}

// How a failed run is reported over HTTP. lib/prepare.js never throws — every
// failure comes back as a report with a `reason` — so this table is the whole
// of the route's error handling: it translates, it does not re-decide.
//   * the invalid-* reasons cannot be reached through this route (the server
//     builds every argument itself) and are mapped anyway, so a future caller
//     that does pass something odd gets a 400 rather than a 500;
//   * "exit-code" is 422: the request was well formed, the script refused it;
//   * "timeout" is 504 and "spawn-error" 500 — the tool failed to get an
//     answer, which is not the caller's fault.
const PREPARE_STATUS_BY_REASON = {
  "invalid-project-root": 400,
  "invalid-issue-id": 400,
  "invalid-status": 400,
  "invalid-tc-id": 400,
  "invalid-script-name": 400,
  "no-setup-script": 404,
  "exit-code": 422,
  "output-too-large": 413,
  timeout: 504,
  "spawn-error": 500,
};

// How a *refusal* is reported — the answers the route gives before any script
// is started, one per outcome of the visibility rule (lib/docstate.js). Every
// one of them is a 4xx with a body: none of the five configurations of an
// issue may come back as a 500 or as silence (TC-018).
//   * "not offered" splits by why: an archive and an unresolved conflict are
//     409, a checklist (or a case) that is not there is 404;
//   * "offered but not runnable" is 409 when the caller can fix it (check the
//     branch out, record the data need) and 404 when the script simply is not
//     there — the same 404 the engine gives for the same fact.
const PREPARE_REFUSAL_STATUS = {
  [docstate.PREPARE_CODE.ISSUE_CLOSED]: 409,
  [docstate.PREPARE_CODE.NO_CHECKLIST]: 404,
  [docstate.PREPARE_CODE.DATA_NOT_REQUIRED]: 409,
  [docstate.PREPARE_CODE.NOT_CHECKED_OUT]: 409,
  [docstate.PREPARE_CODE.NO_SETUP_SCRIPT]: 404,
  [docstate.PREPARE_CODE.DATA_NEED_UNKNOWN]: 409,
};

// Reasons that mean the script did start and then went wrong, as opposed to
// never having been started (a missing script, a rejected argument, a process
// that could not be spawned).
const PREPARE_STARTED_REASONS = new Set(["exit-code", "timeout", "output-too-large"]);

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

// What the checklist says a case needs — "declared", "none" or "unknown".
//
// Read from the checklist wherever it lives, the branch-only preview
// included, so a case is classified by what the issue says about it rather
// than by whether the branch happens to be checked out. A case the checklist
// does not mention is `unknown` for the same reason a legacy checklist is:
// the tool has not been told, and must not pretend it has.
function checklistDataStatus(entry, tcId, parsed) {
  let doc = parsed;
  if (!doc) {
    const content = readChecklistContent(entry);
    doc = content === null ? null : parseChecklist(content);
  }
  if (!doc) return docstate.DATA_STATUS.UNKNOWN;
  if (!tcId) return docstate.aggregateDataStatus(doc.tcs);
  const tc = doc.tcs.find((t) => t.id === tcId);
  return tc ? tc.dataStatus : docstate.DATA_STATUS.UNKNOWN;
}

// State of the "prepare test data" action — for one case when `tcId` is
// given, for the issue as a whole when it is not.
//
// It is an action, not a document, but it is an entry of a role and so has
// to carry one of the same three states (TC-007 step 6). The decision itself
// belongs to `docstate.prepareVisibility`, which is pure; this function's
// job is to gather the facts that decision needs — where the checklist is,
// what it says about the data, whether the issue has a setup script — and to
// dress the verdict in the endpoints a client needs. Both the tester role
// (what the UI offers) and the prepare route (what the server accepts) come
// through here, so they cannot disagree.
function prepareActionState(projectName, projectRoot, entry, options = {}) {
  const { tcId = null, parsed = null } = options;
  const scriptLocation = { projectRoot, status: entry.status, issueId: entry.issueId };

  const verdict = docstate.prepareVisibility({
    issueId: entry.issueId,
    issueStatus: entry.status,
    checklistStatus: entry.checklistStatus,
    dataStatus: checklistDataStatus(entry, tcId, parsed),
    hasSetupScript: prepare.hasSetupScript(scriptLocation),
    scriptPath: prepare.setupScriptPath(scriptLocation),
    branch: entry.branch,
    tcId,
  });

  return {
    ...verdict,
    location: null,
    readonly: true,
    branch: verdict.requiresCheckout ? entry.branch : null,
    checkout: verdict.requiresCheckout
      ? {
          required: true,
          branch: entry.branch,
          endpoint: `${issueApiBase(projectName, entry.issueId)}/checklist/checkout`,
          method: "POST",
          message: `Checking out ${entry.branch} happens only on your explicit confirmation.`,
        }
      : null,
    endpoint: `${issueApiBase(projectName, entry.issueId)}/prepare`,
    method: "POST",
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
        state = prepareActionState(projectName, projectRoot, entry);
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

// ---------------------------------------------------------------------------
// Preparing test data
// ---------------------------------------------------------------------------
//
// The only route of this tool that executes anything. Three properties make
// that acceptable, and all three live here rather than in the client:
//
//  1. The path is a whitelist, not a parameter. The script is always
//     `docs/issues/{open,closed}/<ISSUE-ID>/test-data/setup.mjs`, assembled by
//     lib/prepare.js from an issue id that already matched ISSUE_ID_RE and a
//     status that came from the resolved issue — one of exactly two values.
//     A path in the request body is not read, so there is nothing to escape:
//     the request selects an issue, never a file.
//  2. No shell, ever. lib/prepare.js runs `execFile(process.execPath, [...])`
//     with the arguments as an array; this layer starts no process of its own
//     and builds no command line, so `; rm -rf`, `$(id)` and backticks are
//     just characters that fail the issue-id pattern.
//  3. Confirmation is mandatory, exactly as for `checkout`: without
//     `{"confirm": true}` nothing is started at all.
//
// The route's own job after that is small on purpose — decide whether the
// action is offered for this issue at all (the same decision the tester role
// publishes, so the UI and the route cannot disagree), translate the report's
// `reason` into a status code, and sweep the staging directory when a run
// failed. Everything else is the engine's.
function prepareEnvelope(projectName, entry, extra = {}) {
  return {
    project: projectName,
    issueId: entry.issueId,
    issueStatus: entry.status,
    ok: false,
    ran: false,
    reason: null,
    tcId: null,
    ...extra,
  };
}

// Remove `<tmpdir>/pf-test-data/<ISSUE-ID>/.staging`. Called after a failed
// run: setup.mjs assembles a case there and renames it into place, so a run
// that died mid-flight can only have left a *staging* tree behind — the
// working copy itself is either the previous complete one or absent.
function cleanPrepareStaging(issueId) {
  if (!ISSUE_ID_RE.test(issueId)) return;
  try {
    fs.rmSync(path.join(prepare.preparedIssueRoot(issueId), PREPARE_STAGING_DIR), {
      recursive: true,
      force: true,
    });
  } catch {
    /* best effort: a leftover staging tree must not turn into a 500 */
  }
}

// POST .../issues/:id/prepare  { confirm: true, tcId? }
async function handlePrepare(req, res, projectName, projectRoot, entry) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, prepareEnvelope(projectName, entry, {
      error: "invalid_json_body",
      message: "The request body is not valid JSON.",
    }));
  }

  // `null`, a bare string and an array are all valid JSON and none of them is
  // a request this route understands; reading `.confirm` off them would be a
  // 500 or, worse, an undefined that some future edit treats as absent.
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return sendJson(res, 400, prepareEnvelope(projectName, entry, {
      error: "invalid_json_body",
      message: "The request body must be a JSON object.",
    }));
  }

  // First, before anything is looked up or started: this is a destructive
  // action (it rebuilds the working copy from scratch) and it runs a script.
  if (body.confirm !== true) {
    return sendJson(res, 400, prepareEnvelope(projectName, entry, {
      error: "confirmation_required",
      message:
        "Preparing test data runs this issue's test-data/setup.mjs and rebuilds the working copy. " +
        'Repeat the request with {"confirm": true} once you have confirmed it.',
    }));
  }

  // The only value the caller contributes. Validated against the engine's own
  // pattern rather than a second copy of it, so "what the route accepts" and
  // "what the script is asked for" cannot drift apart. Decided before the
  // visibility rule because the rule is per case whenever a case is named.
  const rawTcId = body.tcId === undefined || body.tcId === null ? null : body.tcId;
  if (rawTcId !== null && (typeof rawTcId !== "string" || !prepare.TC_ID_RE.test(rawTcId))) {
    return sendJson(res, 400, prepareEnvelope(projectName, entry, {
      error: "invalid_tc_id",
      message: `Not a test case id: ${JSON.stringify(rawTcId)}. Expected something like "TC-001", or omit it to prepare the whole issue.`,
    }));
  }

  // The same state the tester role publishes for its prepare entry — for this
  // case when one was named — so "the UI offered it" and "the route accepts
  // it" are one decision, not two. Anything the UI would show greyed out is
  // refused here with the same code and the same sentence, never with a 500
  // and never with silence.
  const action = prepareActionState(projectName, projectRoot, entry, { tcId: rawTcId });
  if (!action.offered || !action.enabled) {
    return sendJson(res, PREPARE_REFUSAL_STATUS[action.code] || 409, prepareEnvelope(projectName, entry, {
      tcId: rawTcId,
      // The code is the `reason` as well: a refusal before the engine starts
      // and one the engine reports have to be told apart by nobody.
      reason: action.code,
      error: action.code,
      offered: action.offered,
      enabled: action.enabled,
      branch: action.branch,
      checkout: action.checkout,
      detail: action.reason,
      message: action.message,
    }));
  }

  const timeoutMs = prepareTimeoutMs();
  const report = await prepare.runPrepare({
    projectRoot,
    issueId: entry.issueId,
    // From the resolved issue, never from the request: one of two values.
    status: entry.status,
    tcId: rawTcId,
    timeoutMs,
  });

  if (!report.ok) cleanPrepareStaging(entry.issueId);

  const statusCode = report.ok ? 200 : PREPARE_STATUS_BY_REASON[report.reason] || 500;

  return sendJson(res, statusCode, {
    project: projectName,
    issueId: entry.issueId,
    issueStatus: entry.status,
    tcId: report.tcId,
    ok: report.ok,
    // Whether the script was started at all — the difference between "your
    // data is not prepared because the script said no" and "…because there
    // was nothing to run".
    ran: report.ok || PREPARE_STARTED_REASONS.has(report.reason),
    reason: report.reason,
    message: report.message,
    ...(report.ok ? {} : { error: report.reason }),
    scriptPath: report.scriptPath,
    exitCode: report.exitCode,
    signal: report.signal,
    timedOut: report.timedOut,
    durationMs: report.durationMs,
    timeoutMs,
    stdout: report.stdout,
    stderr: report.stderr,
    prepared: report.prepared,
    structured: report.structured,
    // Convenience for the common single-case request: the one path a tester
    // is told to open. Null whenever the run prepared anything but exactly
    // one case, so nobody mistakes "the first of several" for "the one".
    workdir: report.prepared.length === 1 ? report.prepared[0].workdir : null,
  });
}

// ---------------------------------------------------------------------------
// Completing a human task
// ---------------------------------------------------------------------------
//
// POST .../human-tasks/:key/complete — the one write this route performs is
// an append-only marker line in the issue's own session-log.md
// (`[human-task done] <key> @ <ts> content-hash=<hash>`), recording that a
// human has finished the `roles.<key>` task `GET .../human-tasks`
// queues/reports on. Three shapes of verification, one per operation/key-kind:
//   * review  — the caller supplies a non-empty verdict; nothing else is
//     checked (a reviewer's word is the artifact here, not a file).
//   * write, one of the six document keys — the mapped file must exist, be
//     real (`docstate.isRealDocument`) and be fully committed
//     (`git.isPathCommitted`); contentHash is its sha256.
//   * write, code/tests — the issue branch must be ahead of its parent
//     branch and touch at least one path outside docs/issues/ (for `tests`,
//     that path must also look like a test file, `test/*.test.js`);
//     contentHash is the branch HEAD's sha1 (`git.revParse`), never a file
//     hash.
//
// `:key` is checked against the 8 known PIPELINE_KEYS (`inbox.PIPELINE_KEYS`)
// before anything else — before any git command sees it — so an unknown key
// can never reach a git argument.
const TEST_FILE_RE = /(^|\/)test\/[^/]+\.test\.js$/;

// Append `[human-task done] <key> @ <ISO-8601 UTC ts> content-hash=<hash>` to
// the issue's session-log.md — append-only, never touching a byte of what's
// already there (the same marker `lib/inbox.js`'s `findLastMarker()` reads
// back). Creates the file if it does not exist yet rather than failing: a
// human task can be the very first thing recorded in a fresh issue's log.
function appendHumanTaskMarker(projectRoot, issueRel, key, contentHash) {
  const sessionLogPath = path.join(projectRoot, ...issueRel.split("/"), "session-log.md");
  let existing = "";
  try {
    existing = fs.readFileSync(sessionLogPath, "utf8");
  } catch {
    existing = "";
  }
  const ts = new Date().toISOString();
  const separator = existing && !existing.endsWith("\n") ? "\n" : "";
  const line = `[human-task done] ${key} @ ${ts} content-hash=${contentHash}\n`;
  fs.writeFileSync(sessionLogPath, existing + separator + line, "utf8");
}

// POST .../issues/:id/human-tasks/:key/complete  { verdict? }
async function handleHumanTaskComplete(req, res, projectRoot, entry, defaultBranch, key) {
  if (!inbox.PIPELINE_KEYS.includes(key)) {
    return sendJson(res, 404, {
      error: "unknown_key",
      message: `No such pipeline key. Known keys: ${inbox.PIPELINE_KEYS.join(", ")}.`,
    });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "invalid_json_body", message: "The request body is not valid JSON." });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return sendJson(res, 400, { error: "invalid_json_body", message: "The request body must be a JSON object." });
  }

  const resolved = inbox.resolveHumanTaskOperation(projectRoot, entry.issueId, entry.status, defaultBranch, key);
  if (!resolved) return sendJson(res, 404, { error: "issue_not_found" });
  if (!resolved.operation) {
    return sendJson(res, 404, {
      error: "not_a_human_task",
      message: `roles.${key} does not resolve to a human actor for this issue.`,
    });
  }

  // The content-identifier this key currently carries — the SAME value
  // GET .../human-tasks compares a marker against
  // (`inbox.currentContentIdentifier`). Writing anything else into the
  // marker would make a just-completed task show right back up as "stale".
  // `fallbackSeed` only matters when there is no current content to hash
  // (e.g. a review of a key whose artifact doesn't exist on disk) — in that
  // case the next read will find no current content either and treat the
  // task as stale regardless of what was written here.
  function currentHash(fallbackSeed) {
    const id = inbox.currentContentIdentifier(projectRoot, entry.issueId, key, resolved.artifactPath);
    return id !== null ? id : inbox.sha256Hex(fallbackSeed);
  }

  if (resolved.operation === "review") {
    const verdict = typeof body.verdict === "string" ? body.verdict.trim() : "";
    if (!verdict) {
      return sendJson(res, 422, {
        error: "invalid_verdict",
        message: "A non-empty verdict is required to complete a review task.",
      });
    }
    const contentHash = currentHash(`${key}:${verdict}`);
    appendHumanTaskMarker(projectRoot, resolved.issueRel, key, contentHash);
    return sendJson(res, 200, { status: "done", contentHash });
  }

  // operation === "write"
  if (key === "code" || key === "tests") {
    const issueBranch = `issue/${entry.issueId}`;
    if (!git.branchExists(projectRoot, issueBranch)) {
      return sendJson(res, 422, { error: "artifact_missing", message: `No ${issueBranch} branch exists yet.` });
    }
    const parentBranch = git.parentBranchOf(projectRoot, issueBranch);
    const ahead = git.commitsAhead(projectRoot, parentBranch, issueBranch);
    if (!(ahead > 0)) {
      return sendJson(res, 422, {
        error: "artifact_missing",
        message: `${issueBranch} has no commits ahead of ${parentBranch} yet.`,
      });
    }
    const changed = git.changedFilesBetween(projectRoot, parentBranch, issueBranch);
    const outsideDocs = changed.filter((p) => !p.startsWith("docs/issues/"));
    const qualifies = key === "tests" ? outsideDocs.some((p) => TEST_FILE_RE.test(p)) : outsideDocs.length > 0;
    if (!qualifies) {
      return sendJson(res, 422, {
        error: "artifact_missing",
        message:
          key === "tests"
            ? `No test/*.test.js file outside docs/issues/ was changed on ${issueBranch}.`
            : `No file outside docs/issues/ was changed on ${issueBranch}.`,
      });
    }
    const contentHash = git.revParse(projectRoot, issueBranch);
    appendHumanTaskMarker(projectRoot, resolved.issueRel, key, contentHash);
    return sendJson(res, 200, { status: "done", contentHash });
  }

  // The six document keys (brd, specs, test_plan, implementation_plan,
  // user_docs, dev_docs).
  const artifactPath = resolved.artifactPath;
  const abs = path.join(projectRoot, ...artifactPath.split("/"));
  let content;
  try {
    content = fs.readFileSync(abs, "utf8");
  } catch {
    return sendJson(res, 422, { error: "artifact_missing", message: `${artifactPath} does not exist yet.` });
  }
  if (!docstate.isRealDocument(content)) {
    return sendJson(res, 422, { error: "artifact_missing", message: `${artifactPath} is empty or still a stub.` });
  }
  if (!git.isPathCommitted(projectRoot, artifactPath)) {
    return sendJson(res, 422, {
      error: "artifact_not_committed",
      message: `${artifactPath} has uncommitted changes — commit it first.`,
    });
  }
  const contentHash = inbox.sha256Hex(content);
  appendHumanTaskMarker(projectRoot, resolved.issueRel, key, contentHash);
  return sendJson(res, 200, { status: "done", contentHash });
}

async function handleApi(req, res, parts, projects, query) {
  // parts = pathname split on "/", filtered — e.g.
  // ["api","roles"]
  // ["api","inbox"]
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
  // ["api","projects",":name","issues",":id","human-tasks"]
  // ["api","projects",":name","issues",":id","prepare"]          POST {confirm, tcId?}

  // GET /api/roles — the role table itself. Project- and issue-independent:
  // which roles exist and what each declares is a property of the framework,
  // not of a repository.
  if (parts.length === 2 && parts[1] === "roles" && req.method === "GET") {
    return sendJson(res, 200, { roles: roles.listRoles() });
  }

  // GET /api/inbox — the "things to do" across every configured project, not
  // scoped to whichever one the tool happens to be pointed "at" (specs.md
  // §3.2, AC-04a): every pending manual test case plus every open issue's
  // `roles.<key>` pair resolved to `kind: human` and not yet done
  // (`lib/inbox.js`'s `collectManualTests`/`collectHumanTasks`).
  if (parts.length === 2 && parts[1] === "inbox" && req.method === "GET") {
    const manualTests = inbox.collectManualTests(projects);
    const humanTasks = inbox.collectHumanTasks(projects);
    return sendJson(res, 200, { manualTests, humanTasks, totalCount: manualTests.length + humanTasks.length });
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

  // POST .../issues/:id/prepare  { confirm: true, tcId? } — run this issue's
  // test-data/setup.mjs. The single executing route of the tool; see
  // handlePrepare for why it is safe to have one.
  if (parts.length === 6 && parts[5] === "prepare" && req.method === "POST") {
    return handlePrepare(req, res, projectName, projectRoot, entry);
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

  // GET .../issues/:id/human-tasks — every `roles.<key>` pair of this issue
  // resolving to `kind: "human"` (lib/roles-resolve.js) and not yet done
  // (lib/inbox.js's collectHumanTasksForIssue, the same marker/content-hash
  // logic GET /api/inbox's humanTasks[] already uses, scoped to one issue).
  // Pure read/report — this route NEVER performs the resolved operation
  // itself (AC-05a): no write, no side effect, just the queue.
  if (parts.length === 6 && parts[5] === "human-tasks" && req.method === "GET") {
    return sendJson(res, 200, inbox.collectHumanTasksForIssue(projectRoot, entry.issueId, entry.status, defaultBranch));
  }

  // POST .../issues/:id/human-tasks/:key/complete  { verdict? } — mark this
  // issue's roles.<key> human task done. See handleHumanTaskComplete for the
  // three verification paths (review / write-doc / write-code).
  if (parts.length === 8 && parts[5] === "human-tasks" && parts[7] === "complete" && req.method === "POST") {
    const key = decodeURIComponent(parts[6]);
    return handleHumanTaskComplete(req, res, projectRoot, entry, defaultBranch, key);
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
    // The prepare verdict travels with the checklist, for the issue and for
    // every case, from the same function the tester role and the prepare
    // route use. The client renders what it is given: it never re-derives
    // "this case needs no data" from the parsed fields, so there is one rule
    // in one place (AC-06c).
    parsed.prepare = prepareActionState(projectName, projectRoot, entry, { parsed });
    for (const tc of parsed.tcs) {
      tc.prepare = prepareActionState(projectName, projectRoot, entry, { tcId: tc.id, parsed });
    }
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
    // A step marked passed with no explanation of what was actually verified
    // is worse than an unchecked box — it looks done but records nothing.
    // Unchecking never requires text: clearing a mistaken check is always
    // allowed to leave the note blank.
    if (checked === true && !String(note || "").trim()) {
      return sendJson(res, 422, { error: "empty_result" });
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
  PREPARE_STATUS_BY_REASON,
  PREPARE_STARTED_REASONS,
  prepareTimeoutMs,
};

// Started as a script: serve. Required as a module (tests, and the test
// harness's forward-compatible path): export only, so requiring the file
// cannot leave a stray server bound to the tool's real port.
if (require.main === module) main();
