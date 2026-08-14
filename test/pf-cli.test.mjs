import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "scripts", "pf-cli.mjs");
const skills = fs.readdirSync(path.join(root, "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, "skills", entry.name, "SKILL.md")));

function run(target, args = []) {
  return spawnSync(process.execPath, [cli, "converge", "--target", target, "--agents", "codex", "--yes", ...args], { encoding: "utf8" });
}

function git(target, args) {
  return spawnSync("git", ["-C", target, ...args], { encoding: "utf8" });
}

test("fresh Codex convergence installs every discovered skill and AGENTS adapter", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "pf-v4-fresh-"));
  try {
    fs.writeFileSync(path.join(target, "README.md"), "consumer\n");
    const result = run(target);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.readFileSync(path.join(target, ".pf-version"), "utf8").trim(), "4.0.0");
    assert.match(fs.readFileSync(path.join(target, "PLANNING.md"), "utf8"), /Framework Version:\*\* 4\.0/);
    assert.match(fs.readFileSync(path.join(target, "AGENTS.md"), "utf8"), /pf4:begin/);
    const installed = fs.readdirSync(path.join(target, ".agents", "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(target, ".agents", "skills", entry.name, "SKILL.md")));
    assert.equal(installed.length, skills.length);
    const second = run(target);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(fs.readFileSync(path.join(target, "AGENTS.md"), "utf8").match(/pf4:begin/g).length, 1);
  } finally {
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
