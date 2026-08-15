import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "scripts", "pf-cli.mjs");
const installer = path.join(root, "scripts", "install.mjs");
const skills = fs.readdirSync(path.join(root, "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, "skills", entry.name, "SKILL.md")));

function run(target, args = []) {
  return spawnSync(process.execPath, [cli, "converge", "--target", target, "--agents", "codex", "--yes", ...args], { encoding: "utf8" });
}

function uninstall(target, args = []) {
  return spawnSync(process.execPath, [cli, "uninstall", "--target", target, "--agents", "codex", "--yes", ...args], { encoding: "utf8" });
}

function lifecycle(command, target, args = [], home) {
  const env = home ? { ...process.env, HOME: home, USERPROFILE: home } : process.env;
  return spawnSync(process.execPath, [cli, command, "--target", target, ...args], { encoding: "utf8", env });
}

function git(target, args) {
  return spawnSync("git", ["-C", target, ...args], { encoding: "utf8" });
}

test("installer documents automatic Claude/Codex selection", () => {
  const result = spawnSync(process.execPath, [installer, "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /--agents auto\|codex\|claude\|both/);
  assert.match(result.stdout, /auto-detect Claude Code and Codex/);
});

test("fresh Codex convergence installs every discovered skill and AGENTS adapter", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "pf-v4-fresh-"));
  try {
    fs.writeFileSync(path.join(target, "README.md"), "consumer\n");
    const result = run(target);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.readFileSync(path.join(target, ".pf-version"), "utf8").trim(), "4.0.0");
    assert.match(fs.readFileSync(path.join(target, "PLANNING.md"), "utf8"), /Framework Version:\*\* 4\.0/);
    const agents = fs.readFileSync(path.join(target, "AGENTS.md"), "utf8");
    assert.match(agents, /pf4:begin/);
    assert.match(agents, /request_user_input/);
    assert.match(agents, /current Codex session/);
    assert.match(fs.readFileSync(path.join(target, "PLANNING.md"), "utf8"), /<PF_SKILL_ROOT>/);
    const installed = fs.readdirSync(path.join(target, ".agents", "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(target, ".agents", "skills", entry.name, "SKILL.md")));
    assert.equal(installed.length, skills.length);
    const second = run(target);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.match(second.stdout, /Detected state: v4/);
    assert.equal(fs.readFileSync(path.join(target, "AGENTS.md"), "utf8").match(/pf4:begin/g).length, 1);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("Codex uninstall removes PF integration but preserves planning data", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "pf-v4-uninstall-"));
  try {
    fs.writeFileSync(path.join(target, "README.md"), "consumer\n");
    assert.equal(run(target).status, 0);
    fs.writeFileSync(path.join(target, "AGENTS.md"), `# Local instructions\n\n${fs.readFileSync(path.join(target, "AGENTS.md"), "utf8")}`);
    const result = uninstall(target);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(path.join(target, ".agents")), false);
    assert.equal(fs.existsSync(path.join(target, ".pf-version")), false);
    assert.equal(fs.readFileSync(path.join(target, "AGENTS.md"), "utf8"), "# Local instructions\n");
    assert.equal(fs.existsSync(path.join(target, "PLANNING.md")), true);
    assert.equal(fs.existsSync(path.join(target, "docs", "planning")), true);
    assert.match(result.stdout, /kept PLANNING\.md, docs\/planning\/, and docs\/issues\//);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("activate and deactivate provide a safe Claude lifecycle", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pf-v4-claude-home-"));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "pf-v4-claude-target-"));
  try {
    const activated = lifecycle("activate", target, ["--agents", "claude", "--yes"], home);
    assert.equal(activated.status, 0, activated.stderr || activated.stdout);
    const skillsRoot = path.join(home, ".claude", "skills");
    assert.equal(fs.readdirSync(skillsRoot).filter((name) => fs.existsSync(path.join(skillsRoot, name, "SKILL.md"))).length, skills.length);
    const shim = path.join(home, ".claude", "bin", process.platform === "win32" ? "pf.js" : "pf");
    assert.equal(fs.existsSync(shim), true);
    assert.match(fs.readFileSync(shim, "utf8"), /pf\.mjs/);

    const deactivated = spawnSync(process.execPath, [shim, "deactivate", "--target", target, "--agents", "claude", "--yes"], {
      encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home }
    });
    assert.equal(deactivated.status, 0, deactivated.stderr || deactivated.stdout);
    assert.equal(fs.existsSync(skillsRoot), false);
    assert.equal(fs.existsSync(shim), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("deactivate removes the Codex adapter and keeps planning data", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "pf-v4-deactivate-"));
  try {
    fs.writeFileSync(path.join(target, "README.md"), "consumer\n");
    const activated = lifecycle("activate", target, ["--agents", "codex", "--yes"]);
    assert.equal(activated.status, 0, activated.stderr || activated.stdout);
    const deactivated = lifecycle("deactivate", target, ["--agents", "codex", "--yes"]);
    assert.equal(deactivated.status, 0, deactivated.stderr || deactivated.stdout);
    assert.equal(fs.existsSync(path.join(target, ".agents")), false);
    assert.equal(fs.existsSync(path.join(target, "PLANNING.md")), true);
    assert.equal(fs.existsSync(path.join(target, "docs", "planning")), true);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("uninstall --remove-core only deletes a verified PF4 runtime cache", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pf-v4-core-home-"));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "pf-v4-core-target-"));
  const core = path.join(home, ".planning-framework");
  try {
    fs.mkdirSync(path.join(core, ".git"), { recursive: true });
    fs.writeFileSync(path.join(core, ".git", "config"), '[remote "origin"]\n\turl = https://github.com/stacmv/planning-framework.git\n');
    const result = lifecycle("uninstall", target, ["--agents", "claude", "--yes", "--remove-core"], home);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(core), false);
    assert.match(result.stdout, /removed PF4 runtime cache/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("v2 convergence transfers documents, normalizes plan names and removes only framework paths", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "pf-v4-v2-"));
  try {
    const source = path.join(root, "test", "fixtures", "v2-latin");
    fs.cpSync(source, target, { recursive: true });
    const result = run(target, ["--doc-language", "English"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(path.join(target, "planning")), false);
    assert.equal(fs.existsSync(path.join(target, "docs", "issues", "open", "20250201-feat-latin", "implementation_plan.md")), false);
    assert.equal(fs.existsSync(path.join(target, "docs", "issues", "open", "20250201-feat-latin", "prompt.md")), true);
    assert.match(fs.readFileSync(path.join(target, "docs", "issues", "open", "20250201-feat-latin", "prompt.md"), "utf8"), /doc_language: English/);
    assert.equal(fs.existsSync(path.join(target, "planning", "backup")), false);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("Codex convergence stages the generated adapter in a git consumer project", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "pf-v4-git-"));
  try {
    fs.writeFileSync(path.join(target, "README.md"), "consumer\n");
    assert.equal(git(target, ["init", "-q"]).status, 0);
    assert.equal(git(target, ["config", "user.email", "pf-test@example.invalid"]).status, 0);
    assert.equal(git(target, ["config", "user.name", "PF test"]).status, 0);
    assert.equal(git(target, ["add", "README.md"]).status, 0);
    assert.equal(git(target, ["commit", "-qm", "initial"]).status, 0);
    const result = run(target);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const status = git(target, ["status", "--porcelain=v1"]).stdout;
    assert.match(status, /A  \.agents\/skills\//);
    assert.match(status, /A  AGENTS\.md/);
    assert.match(status, /A  \.pf-version/);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});
