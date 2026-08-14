#!/usr/bin/env node

/* curl | node installer. It uses git and then delegates skill installation to pf-cli.mjs. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoUrl = process.env.PF_REPO_URL || "https://github.com/stacmv/planning-framework.git";
const branch = process.env.PF_REPO_BRANCH || "develop-v4.0";
const installDir = path.join(os.homedir(), ".claude", "planning-framework");

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
const result = spawnSync(process.execPath, [cli, "update-skills", "--agents", "claude", "--source", installDir], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Installed Planning Framework at ${installDir}`);
console.log(`Run: ${path.join(os.homedir(), ".claude", "bin", process.platform === "win32" ? "pf.js" : "pf")}`);
