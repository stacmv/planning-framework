#!/usr/bin/env node
"use strict";

/**
 * tools/onboarding-tui/cli.js
 *
 * Entry point for the Planning Framework onboarding TUI. Wires together:
 *   - lib/detect.js    -> figure out the target project's current state
 *   - lib/menu.js      -> render a state-branched menu, collect a choice
 *   - lib/tutorial.js  -> the "what is Planning Framework?" walkthrough
 *   - lib/actions.js   -> delegate convergence / update-skills to the
 *                         repository's Node CLI via child_process.spawn
 *
 * Install and migration are a single action: `converge`. It is offered from
 * the `none`, `v2-or-older`, `v3` and `v4` states alike (an incomplete project
 * tops itself up with the very same run).
 *
 * No npm dependencies.
 */

const { detectState } = require("./lib/detect");
const { showMenu } = require("./lib/menu");
const { runTutorial } = require("./lib/tutorial");
const actions = require("./lib/actions");

/**
 * Parse `--target <path>` out of argv. Defaults to process.cwd() when
 * not provided (P1-6).
 */
function parseTargetDir(argv) {
  const idx = argv.indexOf("--target");
  if (idx !== -1 && argv[idx + 1]) {
    return argv[idx + 1];
  }
  return process.cwd();
}

function printChangelog() {
  console.log("");
  console.log("What changed in v4.0?");
  console.log("----------------------");
  console.log("  - Multi-agent workflow via Claude Code and Codex adapters");
  console.log("  - BRD -> spec -> test plan -> implementation plan pipeline");
  console.log("  - Peer reviewer mode: self, peer, both, claude or codex");
  console.log("  - Codex skills installed into .agents/skills/ when Codex is enabled");
  console.log("  - See PLANNING.md in the migrated project for full details");
  console.log("");
}

function printIssueStatus() {
  console.log("");
  console.log("Issue status");
  console.log("------------");
  console.log("  Run `/pf` in Claude Code or the `pf` skill in Codex for full");
  console.log("  active issue status and the next recommended step.");
  console.log("");
}

async function main() {
  const targetDir = parseTargetDir(process.argv.slice(2));
  const state = detectState(targetDir);

  // If a delegated script is running when the user hits Ctrl+C, forward
  // the signal so we don't leave an orphaned child process behind. When
  // no child is active (menu/tutorial screens), default Node behavior
  // (process exits) is fine, so this handler only needs to do extra work
  // in the "child active" case.
  process.on("SIGINT", () => {
    actions.killActiveChild();
    process.exit(130);
  });

  for (;;) {
    const action = await showMenu(state, { targetDir });

    if (action === "quit") {
      return;
    }

    if (action === "tutorial") {
      await runTutorial();
      continue;
    }

    if (action === "changelog") {
      printChangelog();
      continue;
    }

    if (action === "issue-status") {
      printIssueStatus();
      continue;
    }

    if (action === "converge") {
      await actions.runConverge(targetDir);
      return;
    }

    if (action === "update-skills") {
      await actions.runUpdateSkills();
      return;
    }

    // Unknown action token — shouldn't happen given menu.js's contract,
    // but avoid looping forever silently.
    console.error(`cli.js: unrecognized action "${action}"`);
    return;
  }
}

main();
