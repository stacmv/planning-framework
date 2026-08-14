#!/usr/bin/env node

/* curl | node installer. It uses git and then delegates skill installation to pf-cli.mjs. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoUrl = process.env.PF_REPO_URL || "https://github.com/stacmv/planning-framework.git";
const branch = process.env.PF_REPO_BRANCH || "develop-v4.0";
const installDir = path.join(os.homedir(), ".claude", "planning-framework");

function option(name, fallback) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const agents = option("--agents", process.env.PF_AGENTS || "claude");
const target = path.resolve(option("--target", process.env.PF_TARGET || process.cwd()));
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: curl -fsSL <installer-url> | node -- [--agents claude|codex|both] [--target <project>]");
  process.exit(0);
}
if (!["claude", "codex", "both"].includes(agents)) throw new Error(`Invalid --agents value: ${agents}`);

function run(args) {
  const result = spawnSync("git", args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed with exit code ${result.status}`);
}

if (spawnSync("git", ["--version"], { stdio: "ignore" }).status !== 0) throw new Error("git is required");
if (spawnSync(process.execPath, ["--version"], { stdio: "ignore" }).status !== 0) throw new Error("Node.js is required");

console.log(`Planning Framework v4.0 installer (${branch})`);
if (fs.existsSync(path.join(installDir, ".git"))) {
  run(["-C", installDir, "fetch", "origin", branch]);
  run(["-C", installDir, "reset", "--hard", `origin/${branch}`]);
} else {
  if (fs.existsSync(installDir)) fs.rmSync(installDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(installDir), { recursive: true });
  run(["clone", "-b", branch, repoUrl, installDir]);
}

const cli = path.join(installDir, "scripts", "pf-cli.mjs");
const command = agents === "claude" ? "update-skills" : "converge";
const args = [cli, command, "--agents", agents, "--source", installDir];
if (command === "converge") args.push("--target", target, "--yes");
const result = spawnSync(process.execPath, args, { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Installed Planning Framework at ${installDir}`);
if (agents === "claude") console.log(`Run: ${path.join(os.homedir(), ".claude", "bin", process.platform === "win32" ? "pf.js" : "pf")}`);
else console.log(`Codex skills: ${path.join(target, ".agents", "skills")}`);
