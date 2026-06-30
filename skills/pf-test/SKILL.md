---
name: pf-test
description: Run tests for the active issue, update Status Tracker, and generate manual_test_checklist.md for external testers
version: 3.0.0
---

Determine the active issue from `docs/issues/open/`. Read `docs/issues/open/[ACTIVE-ISSUE-ID]/test_plan.md` — if it does not exist, stop: "test_plan.md is required. Run /pf-test-plan first."

---

## Phase 1: Detect Test Runner

Check the project root for the following files in order. Use the first match:

1. `package.json` exists → command is `npm test`
2. `Makefile` exists AND contains a `test:` target → command is `make test`
3. `pyproject.toml` or `pytest.ini` exists → command is `pytest`
4. `composer.json` exists → command is `./vendor/bin/phpunit`
5. None of the above match → ask the user: "No test runner detected. What command should I use to run the test suite?"

---

## Phase 2: Run the Test Suite

Run the detected command. Capture all stdout and stderr output along with the exit code.

---

## Phase 3: TC-ID Mapping

### 3.1 Find test files on the issue branch

Run `git diff --name-only develop...HEAD` and filter the output to files that look like test files (paths or names containing `test`, `spec`, or `__tests__`; extensions `.test.*`, `.spec.*`, `_test.*`).

### 3.2 Scan for TC-ID patterns

For each test file found in 3.1, scan its content for any of these patterns:

- Function or method name contains a TC-ID: `test_TC001_`, `it_TC001_`, or the literal `TC001` (zero-padded or not) anywhere in a function name, `it(...)`, `describe(...)`, or `test(...)` call
- Comment directly above a test: `# TC-001` or `// TC-001`
- Describe block title starting with the TC-ID: `describe('TC-001:` or `describe("TC-001:`

Collect a map of TC-ID → test name(s) as found in the runner output.

### 3.3 Match to runner output

Compare the test names captured in Phase 2 against the TC-ID map from 3.2. Determine pass or fail for each mapped TC-ID.

Tests that have no TC-ID pattern are counted in an aggregate total but are not mapped individually.

### 3.4 Update the Status Tracker

Open `test_plan.md`. In the **Status Tracker** table, for each row where the TC-ID was matched:

- Replace `[ ]` in the **Status** column with `✓` if the test passed
- Replace `[ ]` with `✗` if the test failed

For rows not matched by any test file pattern, leave the Status column unchanged.

Save `test_plan.md`.

---

## Phase 4: Failure Gate

Count all rows in the Status Tracker where **Type is `Auto`** and **Status is `✗`**.

If that count is greater than zero:

1. Write `docs/issues/open/[ISSUE-ID]/test_results.md` with:
   - The runner command used
   - Exit code
   - Names of all failed tests
   - Full captured output (truncate to the first 100 lines if output exceeds 100 lines; append a note "… output truncated" if truncated)

2. Stop with message: "Auto tests failed. Fix the failures and re-run /pf-test. See test_results.md for details."

Do NOT proceed to Phase 5 when this gate triggers.

---

## Phase 5: Generate Manual Test Checklist

Proceed here only when all Auto-type TCs in the Status Tracker have Status `✓`, OR when the Status Tracker contains no rows with Type `Auto`.

### 5.1 Extract Manual TCs

Read every row in the Status Tracker where **Type is `Manual`**. Collect the TC-IDs.

If there are no Manual rows, skip to Phase 6.

### 5.2 Build the checklist

For each Manual TC-ID collected in 5.1, find its full test case section in `test_plan.md` — the block starting with `### TC-NNN:` and ending before the next `###` heading. Extract:

- Test case name (from the heading)
- Preconditions / prerequisites
- Steps table (Step | Action | Expected Result)

### 5.3 Write manual_test_checklist.md

Write `docs/issues/open/[ISSUE-ID]/manual_test_checklist.md` using this exact format:

```
# Manual Test Checklist

**Feature Name:** [Feature name from the test_plan.md title or Overview section]
**Issue ID:** [ISSUE-ID]
**Date:** [today's date YYYY-MM-DD]
**Tester:**

---

## How to use

This checklist walks you through testing a specific feature by hand.

1. Read through each test section before you start so you know what to expect.
2. Set up any prerequisites listed at the top of each test — if you cannot complete a prerequisite, stop and ask the developer before continuing.
3. Follow the steps in order. After each step, check the "Expected Result" column and write what actually happened in the "Result" column.
4. Mark the checkbox `[x]` if the step behaved as expected, or leave it `[ ]` if something was wrong.
5. Use the Notes line at the bottom of each test to record anything unusual, even if the test passed.
6. When you finish all tests, hand this document back to the developer.

---

## TC-NNN: [Test Case Name]

**Prerequisites:**
- [prerequisite 1]
- [prerequisite 2]

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | ... | ... | [ ] |
| 2 | ... | ... | [ ] |

**Notes:** [Leave blank or record any observations]

---
```

Repeat the TC block for every Manual TC in the order they appear in the Status Tracker.

**Critical:** The checklist is written for an external tester who knows nothing about this project's internal tooling. Do not include any of the following in the output: "Planning Framework", "BRD", "specs.md", "/pf", "SKILL.md", "issue branch", "Status Tracker", "implementation plan", or any other developer-workflow jargon. Use plain language describing the feature and user actions only.

---

## Phase 6: Report Summary

Print a single summary message:

```
X auto tests passed (Y mapped to TC-IDs). Z manual test case(s) written to manual_test_checklist.md.
```

Where:
- **X** = total number of auto tests that passed (from runner output)
- **Y** = number of those X tests that were matched to a TC-ID
- **Z** = number of Manual TC rows extracted in Phase 5 (0 if none)

If there were no Auto-type TCs, replace the auto tests sentence with: "No automated tests in this issue."

---

## Important Notes

- **Never skip the failure gate** — a partial pass is a failure. All Auto TCs must be `✓` before the checklist is generated.
- **Do not invent pass/fail status** — only update Status Tracker rows where you found a matching test in the runner output. Leave unmatched rows as `[ ]`.
- **TC-ID format in test_plan.md is `TC-NNN`** (hyphen, three digits). When scanning test files, match both `TC-001` (with hyphen) and `TC001` (without) as the same TC.
- **If the issue branch does not exist** (`git diff develop...HEAD` returns an error), run the full test suite and skip the TC-ID mapping step; report mapped count as 0.
