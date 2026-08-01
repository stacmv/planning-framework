"use strict";

/**
 * lib/menu.js
 *
 * Renders the state-branched main menu for the onboarding TUI and collects
 * the user's choice via `node:readline`. This module is intentionally
 * decoupled from detect.js, actions.js, tutorial.js and cli.js: it only
 * knows how to (a) render a menu for a given, already-computed `state`
 * string and (b) translate a keypress into an action token. The caller
 * (cli.js) is responsible for calling detect.js beforehand and for acting
 * on the returned token afterwards.
 *
 * No npm dependencies — only node:readline, node:fs, node:path.
 */

const readline = require("node:readline");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Per-state menu item definitions. Each item maps the key the user types
 * to a label to print and an action token to return.
 *
 * Install and migration collapsed into ONE action token — `converge` (П1-4).
 * Convergence is idempotent and source-agnostic: it brings a project to the
 * v3 target state from no-PF, v1, v2, half-migrated or incomplete-v3 alike,
 * so the three "productive" states differ only in the label they show.
 *
 * `v3` carries a converge item too (Р11): convergence is a TOP-UP, not a
 * no-op-if-already-v3. A project installed by the old v3 setup script detects
 * as `v3` yet has no .pf-version, no PLANNING.md, no CLAUDE.md section and
 * only 7 of the 15 skills — without this item it could never top itself up.
 *
 * IMPORTANT: `unknown` intentionally has exactly one item, and that item
 * never triggers convergence/update — it only prints diagnostics.
 */
const MENUS = {
  none: [
    { key: "1", label: "What is Planning Framework? (tutorial)", action: "tutorial" },
    { key: "2", label: "Install v4.0 into this project", action: "converge" },
  ],
  "v2-or-older": [
    { key: "1", label: "Migrate this project to v4.0", action: "converge" },
    { key: "2", label: "What changed in v4.0? (short overview)", action: "changelog" },
  ],
  v3: [
    { key: "1", label: "Top up this project to the full v4.0 target state", action: "converge" },
    { key: "2", label: "Update agent adapters to latest version", action: "update-skills" },
    { key: "3", label: "Show active issue status (/pf equivalent)", action: "issue-status" },
  ],
  v4: [
    { key: "1", label: "Top up this project to the full v4.0 target state", action: "converge" },
    { key: "2", label: "Update agent adapters to latest version", action: "update-skills" },
    { key: "3", label: "Show active issue status (/pf equivalent)", action: "issue-status" },
  ],
  unknown: [
    { key: "1", label: "Show detected files and let me choose manually", action: "diagnose" },
  ],
};

/**
 * Create a readline interface bound to process stdin/stdout.
 */
function createInterface() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

/**
 * Await-style wrapper around rl.question — no setTimeout, no default
 * selection. Resolves with the raw trimmed line the user typed.
 */
function ask(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(String(answer).trim()));
  });
}

/**
 * Print the diagnostics used by the `unknown` state's [1] option: which of
 * .pf-version, docs/issues/, PLANNING.md, CLAUDE.md were found in the target
 * dir.
 *
 * Diagnostics are the user's ONLY way out of the `unknown` state, so they must
 * not lag behind the detector: `.pf-version` is the machine-readable version
 * marker detect.js keys on, and it is printed WITH ITS VALUE when present and
 * as an explicit "not found" line when absent — never silently omitted.
 */
function printDiagnostics(targetDir) {
  const dir = targetDir || process.cwd();
  const checks = [
    { label: ".pf-version", rel: ".pf-version", showValue: true },
    { label: "docs/issues/", rel: "docs/issues" },
    { label: "PLANNING.md", rel: "PLANNING.md" },
    { label: "CLAUDE.md", rel: "CLAUDE.md" },
  ];

  console.log("");
  console.log(`Diagnostics for: ${dir}`);
  for (const check of checks) {
    const full = path.join(dir, check.rel);
    const found = fs.existsSync(full);

    let status = found ? "found" : "not found";
    if (found && check.showValue) {
      let value = "";
      try {
        value = fs.readFileSync(full, "utf8").trim();
      } catch {
        value = "";
      }
      status = value ? `found — ${value}` : "found — (empty)";
    }

    console.log(`  [${found ? "x" : " "}] ${check.label} — ${status}`);
  }
  console.log("");
}

/**
 * Render the header + menu items for a given state.
 */
function renderMenu(state, items) {
  console.log("");
  console.log("Planning Framework — Setup & Update Wizard");
  console.log(`Detected: ${state}`);
  console.log("");
  for (const item of items) {
    console.log(`  [${item.key}] ${item.label}`);
  }
  console.log("  [q] Quit");
  console.log("");
}

/**
 * Show the main menu for `state` and return the selected action token.
 *
 * @param {"none"|"v2-or-older"|"v3"|"v4"|"unknown"} state
 * @param {{ targetDir?: string, rl?: readline.Interface }} [opts]
 * @returns {Promise<string>} action token, e.g. "tutorial", "converge",
 *   "changelog", "update-skills", "issue-status", "diagnose", or "quit".
 */
async function showMenu(state, opts = {}) {
  const items = MENUS[state];
  if (!items) {
    throw new Error(`showMenu: unknown state "${state}"`);
  }

  const rl = opts.rl || createInterface();
  const ownsRl = !opts.rl;

  try {
    // Loop until the user provides valid input; never time out, never
    // pick a default action on our own.
    for (;;) {
      renderMenu(state, items);
      const answer = await ask(rl, "> ");

      if (answer.toLowerCase() === "q") {
        return "quit";
      }

      const match = items.find((item) => item.key === answer);
      if (match) {
        if (state === "unknown" && match.action === "diagnose") {
          printDiagnostics(opts.targetDir);
          // Stay in the unknown-state menu: there is nothing further to
          // auto-run. The caller decides what, if anything, to do next.
          continue;
        }
        return match.action;
      }

      console.log(`Invalid choice: "${answer}". Please try again.`);
    }
  } finally {
    if (ownsRl) {
      rl.close();
    }
  }
}

module.exports = { showMenu, MENUS, printDiagnostics };
