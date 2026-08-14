"use strict";

/* The TUI delegates to the same dependency-free Node CLI used by Make. */
const { spawn } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..", "..", "..");
let activeChild = null;

function runCommand(scriptPath, args = [], spawnOpts = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: "inherit",
      ...spawnOpts,
    });
    activeChild = child;
    const finish = (code) => {
      if (activeChild === child) activeChild = null;
      resolve(code);
    };
    child.on("exit", finish);
    child.on("close", finish);
    child.on("error", () => finish(1));
  });
}

function cliPath() {
  return path.join(repoRoot, "scripts", "pf-cli.mjs");
}

function runConverge(targetDir) {
  return runCommand(cliPath(), ["converge", "--target", targetDir]);
}

function runUpdateSkills() {
  return runCommand(cliPath(), ["update-skills"]);
}

function killActiveChild() {
  if (activeChild) activeChild.kill();
}

module.exports = { runConverge, runUpdateSkills, killActiveChild };
