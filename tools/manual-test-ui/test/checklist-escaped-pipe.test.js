// Regression test: TC-007 and TC-010 (issue 20260715-bug-gates-verification-and-tooling-fixes).
// splitCells() must recognize GFM-escaped "\|" inside a table cell instead of
// splitting the cell in two, and patchStepResult() must re-escape every cell
// before writing the row back so the fix from TC-007 survives a round trip
// through the UI's patch path (TC-010).
// Same flat style as checklist-ru.test.js: top-level assert, no describe/it.
// Run: node test/checklist-escaped-pipe.test.js
"use strict";
const assert = require("assert");
const { parseChecklist, patchStepResult } = require("../lib/checklist");

// Fixture and expected literal exactly as specified in test_plan.md TC-007 —
// TC-010 depends on sharing them.
const ESCAPED_PIPE_FIXTURE = `## TC-001: Экранированный пайп в ячейке

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | \`ls ~/.claude/skills/ \\| wc -l\` | Output is a number | [ ] |

**Notes:**
`;

const EXPECTED_ACTION = "`ls ~/.claude/skills/ | wc -l`";

// --- TC-007: parses as one literal pipe, cell not split ---------------------

const parsed = parseChecklist(ESCAPED_PIPE_FIXTURE);
assert.strictEqual(parsed.tcs.length, 1, `expected 1 TC, got ${parsed.tcs.length}`);
assert.strictEqual(parsed.tcs[0].steps.length, 1, `expected 1 step, got ${parsed.tcs[0].steps.length}`);
assert.strictEqual(parsed.tcs[0].steps[0].action, EXPECTED_ACTION);
assert.strictEqual(parsed.tcs[0].steps[0].expected, "Output is a number");
assert.strictEqual(parsed.tcs[0].steps[0].checked, false);
assert.strictEqual(parsed.tcs[0].parseWarnings.length, 0, `unexpected warnings: ${parsed.tcs[0].parseWarnings.join("; ")}`);

console.log("OK: TC-007 — escaped pipe parses as one literal pipe, cell not split");

// --- TC-010: parse -> patch a step result -> re-parse, escaped pipe survives ---

const patched = patchStepResult(ESCAPED_PIPE_FIXTURE, "TC-001", 1, { checked: true, note: "" });
const reparsed = parseChecklist(patched);
assert.strictEqual(reparsed.tcs[0].steps.length, 1, `expected 1 step after patch, got ${reparsed.tcs[0].steps.length}`);
assert.strictEqual(reparsed.tcs[0].steps[0].action, EXPECTED_ACTION);
assert.strictEqual(reparsed.tcs[0].steps[0].checked, true);

console.log("OK: TC-010 — patchStepResult round trip does not corrupt the escaped-pipe cell");
