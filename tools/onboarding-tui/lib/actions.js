"use strict";

/**
 * lib/actions.js
 *
 * Thin wrappers around the repository's shell scripts
 * (scripts/converge-to-v4.sh, scripts/update-skills.sh). This module
 * intentionally does NOT re-implement any of their business logic — it
 * only spawns them as child processes with inherited stdio, so the user
 * sees/interacts with exactly the same prompts and output as running them
 * directly (e.g. via the Makefile's `make converge` / `make update-skills`
 * targets).
 *
 * Install and migration are ONE action here, as they are everywhere else:
 * convergence is idempotent and source-agnostic, so the TUI has a single
 * delegate for it — runConverge().
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
 * Delegate to scripts/converge-to-v4.sh — the single entry point for
 * installing, migrating and topping up a project. The target directory is
 * passed explicitly as `--target <dir>`; the script accepts it in any flag
 * position and defaults to `$(pwd)` when omitted.
 *
 * No flags are auto-answered or suppressed: the TUI does NOT pass `--yes`,
 * so the script's own confirmation prompt reaches the user unchanged (a
 * declined prompt is a cancellation, never a silent proceed).
 *
 * @param {string} targetDir
 * @returns {Promise<number|null>}
 */
function runConverge(targetDir) {
  const scriptPath = path.join(repoRoot, "scripts", "converge-to-v4.sh");
  return runScript(scriptPath, ["--target", targetDir]);
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
  runConverge,
  runUpdateSkills,
  killActiveChild,
};
