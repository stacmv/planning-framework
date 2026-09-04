"use strict";

const readline = require("node:readline");

/**
 * The 4 tutorial screens, in order. Each is a plain-text block introducing
 * a core Planning Framework concept for first-time (`none` state) users.
 */
const SCREENS = [
  // Screen 1: what an "issue" is and why docs/issues/ exists.
  `Screen 1/4 — What is an "issue"?

An "issue" is a single unit of planned work (a feature, improvement, or
fix) tracked as its own folder under docs/issues/. Each issue moves
through a pipeline of documents (BRD, spec, test plan, implementation
plan, QA report) before it is closed.

docs/issues/ exists so that:
  - Only one issue is "active" (open) at a time, keeping work focused.
  - Every decision and plan is written down and reviewable before code
    changes are made.
  - Completed issues are archived (docs/issues/closed/) for history.`,

  // Screen 2: lifecycle order (exact order matters).
  `Screen 2/4 — The issue lifecycle

Every issue moves through these stages, in this order:

  CREATE -> BRD/ANALYSIS -> SPEC -> TEST_PLAN -> IMPL_PLAN -> EXECUTE -> TEST -> QA -> CLOSE

  1. CREATE       - open a new issue folder
  2. BRD/ANALYSIS - capture business requirements / analyze the ask
  3. SPEC         - write the technical spec
  4. TEST_PLAN    - define test cases up front
  5. IMPL_PLAN    - break the spec into implementation tasks
  6. EXECUTE      - implement the tasks
  7. TEST         - run automated/manual tests
  8. QA           - verify against the QA workflow, PASS/FAIL
  9. CLOSE        - merge, archive, and log the outcome`,

  // Screen 3: role of /pf-* commands.
  `Screen 3/4 — The /pf commands

Each stage of the lifecycle has a matching skill/command. You don't need
to memorize every one — just the pattern: "/pf-<stage>" drives that
stage of the pipeline for the active issue.

  /pf              - show active issue status and what to do next
  /pf-brd          - generate the Business Requirements Document
  /pf-spec         - write the technical spec
  /pf-test-plan    - generate the test plan
  /pf-impl-plan    - create the implementation plan
  /pf-check        - review the most recent document for problems
  /pf-execute      - execute the implementation plan via sub-agents
  /pf-codereview   - hard gate: review the code diff (Claude/Codex/both)
  /pf-test         - run tests and build the manual test checklist
  /pf-manual-test  - fill in the manual test checklist interactively
  /pf-qa           - run QA checks and produce qa_report.md
  /pf-qa-setup     - create/update .qa-workflow.md for this project
  /pf-close        - merge, archive, and close the issue
  /pf-autopilot    - drive the active issue to /pf-close autonomously
  /pf-help         - framework overview and quick start
  /pf-update       - update the installed skills from the framework repo
  /pf-size-tiers   - reference data (size tiers, document budgets); read by
                     the other skills, not normally invoked directly
  /pf-git          - reference data (the commit & push that closes every
                     stage); read by the other skills, not invoked directly
  /pf-roles        - reference data (write/review actor resolution); read by
                     the other skills, not normally invoked directly
  /pf-user-docs    - write user-facing documentation for the active issue
  /pf-dev-docs     - write developer-facing documentation for the active issue
  /pf-idea         - write idea.md via guided intake already captured in prompt.md
  /pf-idea-research - write research.md, verified/unverified facts with sources
  /pf-idea-critique - write critique.md via independent multi-persona review
  /pf-idea-verdict - write verdict.md and run the end-of-pipeline decision session
  /pf-idea-spike   - write hypothesis.md and findings.md for a technical spike
  /pf-idea-lenses  - reference data (idea_tier lenses, personas, budgets, stage
                     tables); read by the other skills, not invoked directly
  /pf-interaction  - reference data (the front-loaded interaction rule); read
                     by the other skills, not normally invoked directly

That is all 28 of them.`,

  // Screen 4: pointers to more detail.
  `Screen 4/4 — Where to learn more

This tutorial only covers the basics. For full detail, when you're
ready, see:

  - PLANNING.md                  - complete framework instructions
  - docs/planning/FRAMEWORK.md   - full documentation

You don't need to open either of these now to continue using the
onboarding wizard.`,
];

const LAST_SCREEN_INDEX = SCREENS.length - 1;

function renderScreen(index) {
  console.log("\n" + "=".repeat(60));
  console.log(SCREENS[index]);
  console.log("=".repeat(60));
  const hints = [];
  hints.push("[Enter] next");
  if (index > 0) hints.push("[b] back");
  hints.push("[q] quit to menu");
  console.log(hints.join("   "));
}

/**
 * Runs the 4-screen interactive tutorial.
 *
 * Navigation:
 *   Enter -> advance to min(idx + 1, 3)
 *   b     -> go back to max(idx - 1, 0)
 *   q     -> quit immediately, resolving/returning control to the caller,
 *            regardless of which screen is currently shown.
 *
 * @returns {Promise<void>} resolves once the user quits the tutorial.
 */
async function runTutorial() {
  return new Promise((resolve) => {
    let index = 0;

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    function prompt() {
      renderScreen(index);
      rl.question("> ", (answer) => {
        const input = String(answer || "").trim().toLowerCase();

        if (input === "q") {
          rl.close();
          resolve();
          return;
        }

        if (input === "b") {
          index = Math.max(index - 1, 0);
          prompt();
          return;
        }

        // Enter (empty input) or anything else advances.
        index = Math.min(index + 1, LAST_SCREEN_INDEX);
        prompt();
      });
    }

    prompt();
  });
}

module.exports = { runTutorial };
