#!/usr/bin/env node

/* Planning Framework v4 command line. Deliberately dependency-free. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PF_VERSION = "4.0.0";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_SRC = path.join(ROOT, "skills");
const TEMPLATES_SRC = path.join(ROOT, "docs", "planning", "templates");
const PF_BEGIN = "<!-- pf:begin -->";
const PF_END = "<!-- pf:end -->";
const PF4_BEGIN = "<!-- pf4:begin -->";
const PF4_END = "<!-- pf4:end -->";

const exists = (p) => fs.existsSync(p);
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const say = (value = "") => console.log(value);

function fail(message, code = 2) {
  console.error(`ERROR: ${message}`);
  process.exitCode = code;
  throw new Error(message);
}

function git(target, args, options = {}) {
  const result = spawnSync("git", ["-C", target, ...args], {
    encoding: "utf8", stdio: options.stdio || ["ignore", "pipe", "pipe"]
  });
  return result;
}

function gitAvailable(target) {
  return git(target, ["rev-parse", "--is-inside-work-tree"]).status === 0;
}

function gitTracked(target, relative) {
  return git(target, ["ls-files", "--error-unmatch", "--", relative]).status === 0;
}

function walkFiles(root) {
  if (!isDir(root)) return [];
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(full));
    else if (entry.isFile()) result.push(full);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

function walkDirs(root) {
  if (!isDir(root)) return [];
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(root, entry.name);
    result.push(full, ...walkDirs(full));
  }
  return result.sort((a, b) => b.length - a.length);
}

function copyTree(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
}

function sameFile(a, b) {
  try { return fs.readFileSync(a).equals(fs.readFileSync(b)); } catch { return false; }
}

function relative(target, full) { return path.relative(target, full).split(path.sep).join("/"); }

function removePath(p) {
  if (exists(p)) fs.rmSync(p, { recursive: true, force: true });
}

function renderTemplate(file, projectName) {
  return fs.readFileSync(file, "utf8").replaceAll("[Project Name]", projectName);
}

function parseArgs(argv) {
  const options = { target: process.cwd(), agents: "auto", yes: false, dryRun: false, force: false, source: null, failAfter: null };
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = (name) => {
      if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
      if (i + 1 >= argv.length) fail(`${name} requires a value`);
      i += 1; return argv[i];
    };
    if (arg === "--target" || arg.startsWith("--target=")) options.target = value("--target");
    else if (arg === "--agents" || arg.startsWith("--agents=")) options.agents = value("--agents");
    else if (arg === "--source" || arg.startsWith("--source=")) options.source = value("--source");
    else if (arg === "--doc-language" || arg.startsWith("--doc-language=")) options.docLanguage = value("--doc-language");
    else if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg.startsWith("--fail-after=")) {
      if (process.env.PF_CONVERGE_TEST_HOOKS !== "1") fail(`unknown option: ${arg}`);
      options.failAfter = Number(arg.slice(13));
      if (!Number.isInteger(options.failAfter) || options.failAfter < 0) fail("--fail-after requires a non-negative integer");
    } else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("-")) fail(`unknown option: ${arg}`);
    else positionals.push(arg);
  }
  if (positionals.length) options.positionals = positionals;
  return options;
}

function usage(command = "converge") {
  if (command === "update-skills") return `Usage: node scripts/pf-cli.mjs update-skills [--source <dir>] [--target <dir>] [--agents auto|both|claude|codex]`;
  if (command === "issue-status") return `Usage: node scripts/pf-cli.mjs issue-status <issue-id> [--target <dir>]`;
  return `Usage: node scripts/pf-cli.mjs converge [options]

Converges a project from no PF, v1, v2, mixed, incomplete v3, or complete v3 to v4.

  --target <dir>         Project to converge (default: current directory)
  --agents <mode>        auto, both, claude, or codex (default: auto)
  --yes                  Skip the destructive-phase confirmation
  --dry-run              Print the plan without changing files
  --force                Ignore tracked worktree changes
  --doc-language <lang>  Russian or English
  --help                 Show this help`;
}

function resolveAgents(value) {
  if (value === "auto") {
    const has = (name) => {
      const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
      const extensions = process.platform === "win32" ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";") : [""];
      return dirs.some((dir) => extensions.some((extension) => isFile(path.join(dir, `${name}${extension}`))));
    };
    const claude = has("claude");
    const codex = has("codex");
    return claude && codex ? "both" : codex ? "codex" : "claude";
  }
  if (!["both", "claude", "codex"].includes(value)) fail(`invalid --agents '${value}' - valid values: auto, both, claude, codex`);
  return value;
}

function filesUnder(root) {
  return walkFiles(root).map((full) => relative(root, full));
}

function collectMigration(target) {
  const sources = [];
  if (isDir(path.join(target, "planning", "issues"))) sources.push(...walkFiles(path.join(target, "planning", "issues")));
  for (const name of ["implementation-plan.md", "session-log.md", "decisions.md"]) {
    const full = path.join(target, "planning", name);
    if (isFile(full)) sources.push(full);
  }
  const deletes = ["planning/issues", "planning/scripts", "planning/templates", "planning/FRAMEWORK.md", "planning/implementation-plan.md", "planning/session-log.md", "planning/decisions.md"]
    .filter((name) => exists(path.join(target, name)));
  return { sources: sources.sort(), deletes };
}

function detectState(target) {
  const hasV2 = isDir(path.join(target, "planning", "issues"));
  const hasV3 = isDir(path.join(target, "docs", "issues"));
  if (hasV2 && hasV3) return "mixed";
  if (hasV2) return "v2";
  const marker = isFile(path.join(target, ".pf-version")) ? fs.readFileSync(path.join(target, ".pf-version"), "utf8").trim() : "";
  if (/^4\.\d+(?:\.\d+)?$/.test(marker)) return "v4";
  if (/^3\.\d+(?:\.\d+)?$/.test(marker)) return "v3";
  if (hasV3) return "v3";
  if (isDir(path.join(target, "docs", "planning"))) return "v1";
  return "no-pf";
}

function destinationFor(target, source, remap) {
  const planningIssues = path.join(target, "planning", "issues");
  if (source.startsWith(`${planningIssues}${path.sep}`)) {
    const rel = relative(planningIssues, source);
    const parts = rel.split("/");
    if (parts.length === 1) return path.join(target, "docs", "issues", ...parts);
    const status = parts[0];
    if (parts.length === 2) return path.join(target, "docs", "issues", status, parts[1]);
    const id = parts[1];
    const tail = parts.slice(2);
    if (tail.at(-1) === "implementation-plan.md") tail[tail.length - 1] = "implementation_plan.md";
    return path.join(target, "docs", "issues", remap.get(id) || status, id, ...tail);
  }
  return path.join(target, "docs", "planning", path.basename(source));
}

function sidecar(destination) {
  return destination.endsWith(".md") ? `${destination.slice(0, -3)}.v2.md` : `${destination}.v2`;
}

function computeRemap(target, sources, warnings) {
  const remap = new Map();
  const seen = new Set();
  const issuesRoot = path.join(target, "planning", "issues");
  for (const source of sources) {
    if (!source.startsWith(`${issuesRoot}${path.sep}`)) continue;
    const parts = relative(issuesRoot, source).split("/");
    if (parts.length < 3) continue;
    const key = `${parts[0]}/${parts[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const open = isDir(path.join(target, "docs", "issues", "open", parts[1]));
    const closed = isDir(path.join(target, "docs", "issues", "closed", parts[1]));
    const status = open ? "open" : closed ? "closed" : parts[0];
    if (status !== parts[0]) {
      remap.set(parts[1], status);
      warnings.push(`issue ${parts[1]} is '${parts[0]}' under planning/ but '${status}' under docs/ - merging into docs/issues/${status}/${parts[1]}`);
    }
  }
  return remap;
}

function moveFile(target, source, destination, gitOk) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (gitOk && gitTracked(target, relative(target, source))) {
    const moved = git(target, ["mv", "-f", "--", relative(target, source), relative(target, destination)]);
    if (moved.status === 0) return;
  }
  fs.copyFileSync(source, destination);
  fs.unlinkSync(source);
}

function askConfirmation() {
  if (!process.stdin.isTTY) return Promise.resolve(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question("Proceed? [y/N] ", (answer) => { rl.close(); resolve(/^y(es)?$/i.test(answer.trim())); }));
}

function writeClaude(target, projectName, skipClaude, warnings) {
  if (skipClaude) return;
  const source = path.join(TEMPLATES_SRC, "config", "CLAUDE.md");
  if (!isFile(source)) throw new Error(`template not found: ${source}`);
  const body = renderTemplate(source, projectName).replaceAll("Framework Version:** 3.0", "Framework Version:** 4.0").replaceAll("Planning Framework v3.0", "Planning Framework v4.0");
  const file = path.join(target, "CLAUDE.md");
  if (!isFile(file)) {
    fs.writeFileSync(file, `# ${projectName}\n\n${PF_BEGIN}\n${body}\n${PF_END}\n`);
    say("  created  CLAUDE.md (with the pf section)");
    return;
  }
  const current = fs.readFileSync(file, "utf8");
  const begins = [...current.matchAll(new RegExp(PF_BEGIN, "g"))].map((m) => m.index);
  const ends = [...current.matchAll(new RegExp(PF_END, "g"))].map((m) => m.index);
  if (begins.length === 1 && ends.length === 1 && begins[0] < ends[0]) {
    const end = ends[0] + PF_END.length;
    fs.writeFileSync(file, `${current.slice(0, begins[0])}${PF_BEGIN}\n${body}\n${PF_END}${current.slice(end)}`);
    say("  updated  CLAUDE.md (pf section replaced in place)");
  } else if (!begins.length && !ends.length) {
    fs.writeFileSync(file, `${current.replace(/\s*$/, "")}\n\n${PF_BEGIN}\n${body}\n${PF_END}\n`);
    say("  updated  CLAUDE.md (pf section appended)");
  } else {
    warnings.push(`CLAUDE.md carries unbalanced pf markers (${begins.length} x '${PF_BEGIN}', ${ends.length} x '${PF_END}') - no section was written`);
  }
}

function writeAgents(target) {
  const file = path.join(target, "AGENTS.md");
  const section = `${PF4_BEGIN}\n# Planning Framework v4\n\nThis repository uses Planning Framework v4. Read \`PLANNING.md\` first, then use the local PF skills from \`.agents/skills\`.\n\n## Runtime rules\n\n- Codex may be the runtime/master agent for the PF workflow.\n- The runtime/master agent owns file edits and workflow state.\n- Reviewer agents are read-only and return findings to the runtime agent.\n- \`self\` means the current runtime, \`peer\` means the other installed agent, and \`both\` runs both reviews.\n- Codex uses its current session and available tools; no Bash helper is required.\n- In Codex, use request_user_input (or the current conversation) for questions, and use the current Codex session for any Agent/codex-companion delegation.\n- If TaskCreate, TaskGet, or TaskUpdate are unavailable, keep the task ledger in the implementation plan and update it only after rereading files.\n${PF4_END}`;
  const current = isFile(file) ? fs.readFileSync(file, "utf8") : "";
  const begin = current.indexOf(PF4_BEGIN);
  const end = current.indexOf(PF4_END);
  if (begin >= 0 && end > begin) fs.writeFileSync(file, `${current.slice(0, begin)}${section}${current.slice(end + PF4_END.length)}`);
  else fs.writeFileSync(file, `${current.replace(/\s*$/, "")}\n\n${section}\n`);
  say("  added/updated AGENTS.md PF4 section");
}

function installSkills(sourceRoot, destinationRoot, report) {
  fs.mkdirSync(destinationRoot, { recursive: true });
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const source = path.join(sourceRoot, entry.name);
    if (!isFile(path.join(source, "SKILL.md"))) continue;
    const destination = path.join(destinationRoot, entry.name);
    fs.mkdirSync(destination, { recursive: true });
    copyTree(source, destination);
    report.push(entry.name);
  }
}

function installShim() {
  const bin = path.join(os.homedir(), ".claude", "bin");
  fs.mkdirSync(bin, { recursive: true });
  const cli = path.join(ROOT, "tools", "onboarding-tui", "cli.js");
  const shim = `#!/usr/bin/env node\nrequire(${JSON.stringify(cli)});\n`;
  const file = path.join(bin, process.platform === "win32" ? "pf.js" : "pf");
  fs.writeFileSync(file, shim, { mode: 0o755 });
  if (process.platform === "win32") fs.writeFileSync(path.join(bin, "pf.cmd"), `@node "${file}" %*\r\n`);
  return file;
}

function checkWorktree(target, force, warnings, gitOk) {
  if (!gitOk) return;
  const lines = (git(target, ["status", "--porcelain=v1"]).stdout || "").split(/\r?\n/).filter(Boolean).filter((line) => !line.startsWith("??"));
  if (!lines.length) { say("  git: worktree clean (no unstaged changes to tracked files)"); return; }
  if (force) { warnings.push("worktree has uncommitted changes to tracked files - proceeding because of --force"); return; }
  console.error("ERROR: the worktree has uncommitted changes to TRACKED files:");
  console.error(lines.join("\n"));
  console.error("Commit or stash them first, or re-run with --force.");
  const error = new Error("dirty worktree"); error.code = 3; throw error;
}

function stageFootprint(target, gitOk) {
  if (!gitOk) return;
  const paths = [".pf-version", "PLANNING.md", "CLAUDE.md", "AGENTS.md", ".agents", "docs/issues", "docs/planning", "planning"]
    .filter((p) => exists(path.join(target, p)) || gitTracked(target, p));
  if (paths.length) git(target, ["add", "-A", "--", ...paths]);
}

function requiredDocs(dir, id) {
  if (isFile(path.join(dir, "notes.md"))) return ["test_plan.md"];
  const type = id.split("-")[1];
  return ["feat", "improve"].includes(type) ? ["brd.md", "specs.md", "test_plan.md", "implementation_plan.md"] : ["test_plan.md", "implementation_plan.md"];
}

function skillForDoc(doc) {
  return { "brd.md": "/pf-brd", "notes.md": "/pf-brd", "specs.md": "/pf-spec", "test_plan.md": "/pf-test-plan", "implementation_plan.md": "/pf-impl-plan" }[doc] || "/pf";
}

function missingDocs(target) {
  const result = [];
  const root = path.join(target, "docs", "issues", "open");
  if (!isDir(root)) return result;
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const dir = path.join(root, entry.name); const missing = [];
    for (const doc of requiredDocs(dir, entry.name)) if (!isFile(path.join(dir, doc))) missing.push(`${doc} (${skillForDoc(doc)})`);
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".md"))) {
      if (fs.readFileSync(path.join(dir, file), "utf8").includes("TODO: Run /pf-")) missing.push(`${file} [a stub, not a document - re-run ${skillForDoc(file)}]`);
    }
    if (missing.length) result.push(`${entry.name}: ${missing.join(", ")}`);
  }
  return result;
}

function topUp(target, projectName, skipClaude, agents, warnings, report) {
  for (const dir of ["docs/issues/open", "docs/issues/closed", "docs/planning"]) {
    if (!isDir(path.join(target, dir))) { fs.mkdirSync(path.join(target, dir), { recursive: true }); say(`  created  ${dir}/`); }
  }
  fs.writeFileSync(path.join(target, ".pf-version"), `${PF_VERSION}\n`); say(`  wrote    .pf-version (${PF_VERSION})`);
  const planningTemplate = path.join(TEMPLATES_SRC, "config", "PLANNING.md");
  if (!isFile(planningTemplate)) throw new Error(`template not found: ${planningTemplate}`);
  fs.writeFileSync(path.join(target, "PLANNING.md"), renderTemplate(planningTemplate, projectName).replaceAll("v3.0", "v4.0").replaceAll("3.0", "4.0")); say("  wrote    PLANNING.md");
  writeClaude(target, projectName, skipClaude, warnings);
  for (const name of ["session-log.md", "decisions.md", "implementation-plan.md", "test-plan.md"]) {
    const destination = path.join(target, "docs", "planning", name); const source = path.join(TEMPLATES_SRC, "global", name);
    if (!exists(destination) && isFile(source)) { fs.copyFileSync(source, destination); say(`  created  docs/planning/${name}`); }
  }
  const mirror = path.join(target, "docs", "planning", "templates");
  fs.mkdirSync(mirror, { recursive: true });
  const sourceFiles = new Set(filesUnder(TEMPLATES_SRC));
  const sourceDirs = new Set(walkDirs(TEMPLATES_SRC).map((dir) => relative(TEMPLATES_SRC, dir)));
  for (const rel of sourceFiles) { const dst = path.join(mirror, rel); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(TEMPLATES_SRC, rel), dst); }
  for (const rel of filesUnder(mirror)) if (!sourceFiles.has(rel)) { removePath(path.join(mirror, rel)); say(`  mirrored away  docs/planning/templates/${rel}`); }
  for (const dir of walkDirs(mirror)) { const rel = relative(mirror, dir); if (!sourceDirs.has(rel) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir); }
  say("  mirrored docs/planning/templates/");

  if (!skipClaude) {
    installSkills(SKILLS_SRC, path.join(os.homedir(), ".claude", "skills"), report.skills);
    say(`  installed ${report.skills.length} skill(s) -> ${path.join(os.homedir(), ".claude", "skills")}`);
    say(`  installed pf shim -> ${installShim()}`);
  }
  if (agents === "codex" || agents === "both") {
    installSkills(SKILLS_SRC, path.join(target, ".agents", "skills"), report.codexSkills);
    say(`  installed ${report.codexSkills.length} skill(s) -> .agents/skills`);
    writeAgents(target);
  }
}

function printReport(target, state, options, warnings, errors, report, backup, incomplete) {
  say("\n========================================");
  say(options.dryRun ? "  DRY-RUN - no changes were made" : incomplete ? "  Converge INCOMPLETE - target state was NOT reached" : "  Converge complete");
  say("========================================\n");
  say(`Detected state : ${state}`); say(`Project        : ${target}`); say(`Framework      : ${ROOT} (v${PF_VERSION})\n`);
  if (report.transferred.length) say(`Issues transferred: ${report.transferred.join(", ")}\n`);
  if (report.sidecars.length) say(`Both copies kept: ${report.sidecars.join(", ")}\n`);
  if (report.deleted.length) say(`Deleted (whitelist): ${report.deleted.join(", ")}\n`);
  if (backup) say(`Backup (kept):\n  ${backup}\n`);
  const missing = missingDocs(target);
  if (missing.length) { say("Open issues missing documents:"); missing.forEach((item) => say(`  - ${item}`)); say(""); }
  if (warnings.length) { say(`WARNINGS (${warnings.length}):`); warnings.forEach((item) => say(`  - ${item}`)); say(""); }
  if (errors.length) { say(`ERRORS (${errors.length}):`); errors.forEach((item) => say(`  - ${item}`)); say("Phase 5 deletion was skipped; planning/ is intact.\n"); }
}

async function converge(rawOptions) {
  const options = rawOptions; const target = path.resolve(options.target); const projectName = path.basename(target);
  if (!isDir(target)) fail(`target directory does not exist: ${target}`);
  if (options.docLanguage && !["russian", "english"].includes(options.docLanguage.toLowerCase())) fail(`invalid --doc-language '${options.docLanguage}' - valid values: Russian, English`);
  if (options.docLanguage) options.docLanguage = options.docLanguage[0].toUpperCase() + options.docLanguage.slice(1).toLowerCase();
  const agents = resolveAgents(options.agents); const skipClaude = agents === "codex" || process.env.PF_CONVERGE_SKIP_CLAUDE === "1";
  const state = detectState(target); const warnings = []; const errors = []; const report = { transferred: [], sidecars: [], deleted: [], skills: [], codexSkills: [] };
  const gitOk = gitAvailable(target); const migration = collectMigration(target); const remap = computeRemap(target, migration.sources, warnings);
  const backupWanted = migration.sources.length > 0 || migration.deletes.length > 0;
  say("\nPlanning Framework - converge to v4\n===================================\n");
  say(`Detected state: ${state}`); say(`Agent adapters: ${agents}`);
  if (options.dryRun) {
    say("\nPlan (dry run - nothing will be changed):");
    migration.sources.forEach((source) => say(`  ${relative(target, source)} -> ${relative(target, destinationFor(target, source, remap))}`));
    if (migration.deletes.length) { say("\n  Would delete (whitelist):"); migration.deletes.forEach((item) => say(`    ${item}`)); }
    say(`\n  Would ${backupWanted ? "back up planning/" : "not create a backup"}`);
    say("  Would install the v4 project state, all discovered skills, and the selected adapters.");
    printReport(target, state, options, warnings, errors, report, null, false); return 0;
  }
  checkWorktree(target, options.force, warnings, gitOk);
  if (backupWanted && !options.yes && !options.force && !(await askConfirmation())) { say("\nConverge cancelled by the user. Nothing was changed."); return 4; }
  let backup = null;
  if (backupWanted) {
    const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const base = path.join(target, `planning-backup-${stamp}`); backup = base; let n = 2;
    while (exists(backup)) backup = `${base}-${n++}`;
    fs.mkdirSync(backup, { recursive: true }); copyTree(path.join(target, "planning"), path.join(backup, "planning")); say(`\nPhase 2 - backup\n  backed up planning/ -> ${path.basename(backup)}/planning/\n`);
  }
  let transferFailed = false; let moved = 0; const issueSeen = new Set();
  for (const source of migration.sources) {
    if (!isFile(source)) continue;
    const destination = destinationFor(target, source, remap); let parent = path.dirname(destination);
    while (parent !== target && parent.startsWith(`${target}${path.sep}`)) { if (exists(parent) && !isDir(parent)) { errors.push(`file-vs-directory collision: '${relative(target, source)}' cannot be placed under '${relative(target, parent)}'`); transferFailed = true; break; } parent = path.dirname(parent); }
    if (transferFailed && errors.at(-1)?.includes(relative(target, source))) continue;
    if (isDir(destination)) { errors.push(`file-vs-directory collision: destination '${relative(target, destination)}' is a directory`); transferFailed = true; continue; }
    try {
      if (!exists(destination)) moveFile(target, source, destination, gitOk);
      else if (sameFile(source, destination)) fs.unlinkSync(source);
      else { const parked = sidecar(destination); if (isDir(parked)) throw new Error(`cannot park v2 copy: ${relative(target, parked)} is a directory`); if (isFile(parked) && sameFile(source, parked)) fs.unlinkSync(source); else { moveFile(target, source, parked, gitOk); report.sidecars.push(relative(target, parked)); warnings.push(`kept both copies: ${relative(target, destination)} and ${relative(target, parked)}`); } }
      moved += 1;
      const parts = relative(path.join(target, "planning", "issues"), source).split("/");
      if (parts.length >= 3 && !issueSeen.has(parts[1])) { issueSeen.add(parts[1]); report.transferred.push(parts[1]); }
      if (options.failAfter !== null && moved >= options.failAfter) { say(`--fail-after=${options.failAfter}: aborting after ${moved} transferred file(s) (test hook)`); return 70; }
    } catch (error) { errors.push(`${error.message} while moving '${relative(target, source)}'`); transferFailed = true; }
  }
  say(`\nPhase 3 - transferred ${moved} file(s)`);
  const issueRoot = path.join(target, "docs", "issues");
  for (const source of walkFiles(issueRoot).filter((file) => path.basename(file) === "implementation-plan.md")) {
    const destination = path.join(path.dirname(source), "implementation_plan.md");
    if (!exists(destination)) moveFile(target, source, destination, gitOk);
    else if (sameFile(source, destination)) fs.unlinkSync(source);
    else { const parked = sidecar(destination); if (!exists(parked)) { moveFile(target, source, parked, gitOk); report.sidecars.push(relative(target, parked)); } }
  }
  for (const dir of ["open", "closed"].flatMap((status) => isDir(path.join(issueRoot, status)) ? fs.readdirSync(path.join(issueRoot, status), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(issueRoot, status, e.name)) : [])) {
    const id = path.basename(dir); const prompt = path.join(dir, "prompt.md");
    const language = options.docLanguage || detectLanguage(dir);
    if (dir.includes(`${path.sep}open${path.sep}`) && isFile(prompt)) addDocLanguage(prompt, language, warnings);
    if (dir.includes(`${path.sep}closed${path.sep}`) && !isFile(path.join(dir, "brd.md")) && !isFile(path.join(dir, "notes.md"))) addClosedPointer(dir);
  }
  if (!transferFailed) for (const rel of migration.deletes) { removePath(path.join(target, rel)); report.deleted.push(rel); }
  if (transferFailed) { say("Phase 5 - SKIPPED: a transfer failed, so planning/ is left intact"); }
  if (!transferFailed && isDir(path.join(target, "planning")) && fs.readdirSync(path.join(target, "planning")).length === 0) fs.rmdirSync(path.join(target, "planning"));
  topUp(target, projectName, skipClaude, agents, warnings, report);
  if (gitOk) stageFootprint(target, gitOk);
  printReport(target, state, options, warnings, errors, report, backup, transferFailed);
  return transferFailed ? 1 : 0;
}

function detectLanguage(dir) {
  let cyr = 0; let latin = 0;
  for (const name of ["prompt.md", "analysis.md"]) if (isFile(path.join(dir, name))) { const text = fs.readFileSync(path.join(dir, name), "utf8"); cyr += (text.match(/[\u0400-\u04ff]/g) || []).length; latin += (text.match(/[A-Za-z]/g) || []).length; }
  return cyr > latin ? "Russian" : "English";
}

function addDocLanguage(file, language, warnings) {
  const text = fs.readFileSync(file, "utf8"); if (/^doc_language:/m.test(text.split(/^---\s*$/m)[1] || "")) return;
  const lines = text.split(/\r?\n/);
  if (lines[0] === "---") { const close = lines.indexOf("---", 1); if (close < 0) { warnings.push(`${relative(process.cwd(), file)} has malformed frontmatter - left untouched`); return; } lines.splice(close, 0, `doc_language: ${language}`); }
  else lines.unshift("---", `doc_language: ${language}`, "---", "");
  fs.writeFileSync(file, lines.join("\n")); say(`  doc_language: ${path.basename(path.dirname(file))} -> ${language}`);
}

function addClosedPointer(dir) {
  const links = ["prompt.md", "analysis.md", "definition-of-done.md"].filter((name) => isFile(path.join(dir, name))).map((name) => `- [\`${name}\`](${name})`).join("\n");
  if (!links) return;
  fs.writeFileSync(path.join(dir, "brd.md"), `# BRD: ${path.basename(dir)}\n\nThis issue was closed before the v3 pipeline existed, so it has no BRD.\nIts requirements are recorded in the legacy documents kept alongside this file:\n\n${links}\n\nThe archive is not rewritten - only pointed at.\n`);
  say(`  pointer:  docs/issues/closed/${path.basename(dir)}/brd.md`);
}

function updateSkills(options) {
  const source = path.resolve(options.source || ROOT); const agents = resolveAgents(options.agents); const report = [];
  if (agents === "claude" || agents === "both") installSkills(path.join(source, "skills"), path.join(os.homedir(), ".claude", "skills"), report);
  if (agents === "codex" || agents === "both") { if (!options.target) fail("--target is required for --agents codex"); installSkills(path.join(source, "skills"), path.join(path.resolve(options.target), ".agents", "skills"), report); writeAgents(path.resolve(options.target)); }
  if (agents !== "codex") installShim();
  say(`Updated ${report.length} skill(s) for ${agents}.`); return 0;
}

function issueStatus(options) {
  const id = options.positionals?.[0]; if (!id) fail("Issue ID required.\n" + usage("issue-status"), 1);
  const target = path.resolve(options.target); const branch = `issue/${id}`; const issuePath = path.join(target, "docs", "issues", "open", id); say("Issue status\n------------"); if (!isDir(issuePath)) say(`Issue not found locally: ${relative(target, issuePath)}`);
  const fetched = git(target, ["fetch", "origin"]); if (fetched.status !== 0) fail("git fetch origin failed", 1);
  const remote = `origin/${branch}`; if (git(target, ["rev-parse", remote]).status !== 0) fail(`Branch not found: ${remote}`, 1);
  const current = (git(target, ["branch", "--show-current"]).stdout || "").trim(); const hash = (args) => (git(target, args).stdout || "").trim();
  say(`Issue: ${id}\nBranch: ${branch}\nCurrent Branch: ${current || "(detached)"}`); const local = hash(["rev-parse", branch]); const remoteHash = hash(["rev-parse", remote]); if (!local) say("Local branch: not present"); else say(local === remoteHash ? "Local branch: in sync with remote" : `Local branch: out of sync (behind ${hash(["rev-list", "--count", `${local}..${remoteHash}`])}, ahead ${hash(["rev-list", "--count", `${remoteHash}..${local}`])})`);
  const plan = `${relative(target, issuePath)}/implementation_plan.md`; const content = git(target, ["show", `${remote}:${plan}`]); say(content.status === 0 ? "\nImplementation plan progress:\n" + (content.stdout.match(/## Progress Tracking[\s\S]{0,2000}/)?.[0] || "No progress tracking found") : "\nImplementation plan not found on remote branch"); return 0;
}

async function main() {
  const raw = process.argv.slice(2);
  const command = raw[0] && !raw[0].startsWith("-") ? raw.shift() : "converge";
  const options = parseArgs(raw);
  if (options.help) { say(usage(command)); return; }
  try { const code = command === "converge" ? await converge(options) : command === "update-skills" ? updateSkills(options) : command === "issue-status" ? issueStatus(options) : fail(`unknown command: ${command}`); process.exitCode = code; }
  catch (error) { if (error.code) process.exitCode = error.code; else if (process.exitCode === undefined || process.exitCode === 0) process.exitCode = 1; }
}

main();
