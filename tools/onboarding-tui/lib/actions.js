"use strict";

/**
 * lib/actions.js
 *
 * Thin wrappers around the existing, already-working shell scripts
 * (scripts/setup-planning-v3.sh, scripts/migrate-v2-to-v3.sh,
 * scripts/update-skills.sh). This module intentionally does NOT
 * re-implement any of their business logic — it only spawns them as
 * child processes with inherited stdio, so the user sees/interacts with
 * exactly the same prompts and output as running them directly (e.g. via
 * the Makefile's `make setup-v3`, `make migrate-v2-to-v3`, `make
 * update-skills` targets).
 *
 * No npm dependencies — only node:child_process, node:path.
 */

const { spawn } = require("node:child_process");
const path = require("node:path");

// tools/onboarding-tui/lib/actions.js -> tools/onboarding-tui -> tools -> repo root.
// Three levels up from this file's directory (lib/) reaches the repo root,
// where scripts/ lives.
const repoRoot = path.join(__dirname, "..", "..", "..");

/**
 * Track the currently-running child process (if any) so a SIGINT
 * received by the TUI process can be forwarded to it instead of leaving
 * it orphaned. Only one delegated action ever runs at a time.
 */
let activeChild = null;

/**
 * Spawn `bash <scriptPath> [...args]` with inherited stdio and resolve
 * once the child exits.
 *
 * @param {string} scriptPath absolute path to the .sh script
 * @param {string[]} args extra positional args to pass to the script
 * @param {{ cwd?: string }} [spawnOpts]
 * @returns {Promise<number|null>} the child's exit code
 */
function runScript(scriptPath, args = [], spawnOpts = {}) {
  return new Promise((resolve) => {
    const child = spawn("bash", [scriptPath, ...args], {
      stdio: "inherit",
      ...spawnOpts,
    });

    activeChild = child;

    const finish = (code) => {
      if (activeChild === child) {
        activeChild = null;
      }
      resolve(code);
    };

    child.on("exit", finish);
    child.on("close", finish);
  });
}

/**
 * Delegate to scripts/setup-planning-v3.sh.
 *
 * NOTE (P2-7, accepted trade-off): setup-planning-v3.sh always prompts
 * interactively for its own target directory via `read -rp`, defaulting
 * to `$(pwd)`. We can't pass targetDir to it as an argument (it doesn't
 * accept one) — the best we can do is run the script with
 * `cwd: targetDir`, so that its own default matches the directory the
 * user picked in the TUI. The script will still prompt the user once
 * more to confirm/override that same directory; this is expected, not a
 * bug — the TUI never suppresses or auto-answers the script's prompts.
 *
 * @param {string} targetDir
 * @returns {Promise<number|null>}
 */
function runSetupV3(targetDir) {
  const scriptPath = path.join(repoRoot, "scripts", "setup-planning-v3.sh");
  return runScript(scriptPath, [], { cwd: targetDir });
}

/**
 * Delegate to scripts/migrate-v2-to-v3.sh, passing targetDir as the
 * script's positional $1 (it supports this natively, defaulting to `.`
 * when omitted).
 *
 * @param {string} targetDir
 * @returns {Promise<number|null>}
 */
function runMigrateV2ToV3(targetDir) {
  const scriptPath = path.join(repoRoot, "scripts", "migrate-v2-to-v3.sh");
  return runScript(scriptPath, [targetDir]);
}

/**
 * Delegate to scripts/update-skills.sh. This script is not
 * project-scoped: it always writes to `$HOME/.claude/skills` regardless
 * of which target project the TUI is pointed at, so no targetDir is
 * accepted or forwarded here.
 *
 * @returns {Promise<number|null>}
 */
function runUpdateSkills() {
  const scriptPath = path.join(repoRoot, "scripts", "update-skills.sh");
  return runScript(scriptPath);
}

/**
 * Forward a SIGINT (Ctrl+C) to the currently-active delegated child
 * process, if any, so it doesn't get left running as an orphan when the
 * TUI process exits. Intended to be called from a
 * `process.on("SIGINT", ...)` handler in cli.js. When no child is
 * active (menu/tutorial screens), this is a no-op and default Node
 * SIGINT/exit behavior applies.
 */
function killActiveChild() {
  if (activeChild) {
    activeChild.kill();
  }
}

module.exports = {
  runSetupV3,
  runMigrateV2ToV3,
  runUpdateSkills,
  killActiveChild,
};
