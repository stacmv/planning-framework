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

const TOOL_DIR = __dirname;
const PUBLIC_DIR = path.join(TOOL_DIR, "public");
const ISSUE_ID_RE = /^[0-9]{8}-(feat|improve|bug)-[a-z0-9-]+$/;

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
  if (!resolved.startsWith(path.resolve(PUBLIC_DIR))) {
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

async function handleApi(req, res, parts, projects) {
  // parts = pathname split on "/", filtered — e.g.
  // ["api","projects"]
  // ["api","projects",":name","issues"]
  // ["api","projects",":name","issues",":id","checklist"]
  // ["api","projects",":name","issues",":id","checklist","steps"]
  // ["api","projects",":name","issues",":id","checklist","notes"]
  // ["api","projects",":name","issues",":id","checklist","checkout"]

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
  const defaultBranch = git.resolveDefaultBranch(projectRoot, project.configuredDefaultBranch);

  if (parts.length === 4 && parts[3] === "issues" && req.method === "GET") {
    const list = findChecklists(projectRoot, defaultBranch).map(issueSummary);
    return sendJson(res, 200, { currentBranch: git.getCurrentBranch(projectRoot), defaultBranch, issues: list });
  }

  if (parts.length < 6 || parts[3] !== "issues" || parts[5] !== "checklist") {
    return sendJson(res, 404, { error: "not_found" });
  }
  const issueId = decodeURIComponent(parts[4]);
  const entry = resolveIssue(projectRoot, issueId, defaultBranch);
  if (!entry) return sendJson(res, 404, { error: "issue_not_found" });

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

function main() {
  const projects = loadProjects();
  if (projects.size === 0) {
    console.error("No valid projects configured in projects.json. Nothing to serve.");
    process.exit(1);
  }

  const portArgIdx = process.argv.indexOf("--port");
  const port = portArgIdx !== -1 ? parseInt(process.argv[portArgIdx + 1], 10) : parseInt(process.env.PORT || "4317", 10);

  const server = http.createServer(async (req, res) => {
    const pathname = decodeURI(req.url.split("?")[0]);
    if (pathname.startsWith("/api/")) {
      const parts = pathname.split("/").filter(Boolean);
      try {
        await handleApi(req, res, parts, projects);
      } catch (e) {
        console.error(e);
        sendJson(res, 500, { error: "internal_error", message: e.message });
      }
      return;
    }
    serveStatic(res, pathname);
  });

  server.listen(port, () => {
    console.log(`Manual Test UI running at http://localhost:${port}`);
    console.log(`Projects: ${[...projects.keys()].join(", ")}`);
  });
}

main();
