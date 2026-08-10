---
name: pf-test
description: Run tests for the active issue, update Status Tracker, and generate manual_test_checklist.md for external testers
version: 3.0.0
---

Determine the active issue from `docs/issues/open/`. Read `docs/issues/open/[ACTIVE-ISSUE-ID]/test_plan.md` — if it does not exist, stop: "test_plan.md is required. Run /pf-test-plan first."

Then check `docs/issues/open/[ACTIVE-ISSUE-ID]/code_review.md`: it must exist and its `verdict:` field must read literally `PASS` **or** start with `SKIPPED` (the latter written by `/pf-codereview` when `roles.code.review: skip` is confirmed — see `~/.claude/skills/pf-roles/SKILL.md` §1's "`code.review: skip`" section; it is not a failure, and this prerequisite must not block on it). This is a mechanical check — read the file and compare the field's literal value, no judgment call. If the file is missing, or exists with `verdict: FAIL` (or any value other than `PASS`/`SKIPPED...`), stop: "code_review.md (PASS) is required. Run /pf-codereview first." (translate per `doc_language` in `prompt.md`'s YAML frontmatter if it is set to something other than English).

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

Scan the entire test suite for test-looking files, regardless of whether they were changed on this branch — `git diff --name-only develop...HEAD` is not the only source: in addition to the diff, also scan pre-existing test files. A file "looks like a test file" if its path or name contains `test`, `spec`, or `__tests__`, or its extension matches `.test.*`, `.spec.*`, `_test.*`.

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
- **Test Data** — the files and fixtures the test plan declared for that case, verbatim and in the order written there (the value `none` / `не требуются` is itself a declaration and is extracted as such)

### 5.2.1 Generate the `test-data/` directory

Before writing the checklist, generate this issue's own data directory `docs/issues/<status>/[ISSUE-ID]/test-data/`, holding the `fixtures/` every Manual TC declared plus a `setup.mjs` that unpacks them — `<status>` is the directory the issue currently lives in (`open` while it is being worked on). Its two parts:

- `test-data/fixtures/<entry>` — one real file per entry declared under **Test Data**, laid out under `fixtures/` with exactly the relative path the test plan named, and with content that actually satisfies the case's steps. An entry several cases share is written once, under a common subdirectory (e.g. `fixtures/prelude/`).
- `test-data/setup.mjs` — copied verbatim from `~/.claude/skills/pf-test/templates/setup.mjs`. Replace only the block between the `BEGIN GENERATED CONFIG` and `END GENERATED CONFIG` markers: `ISSUE_ID` = this issue's ID, `PRELUDE` = the entries shared by several cases, `CASES` = every Manual TC-ID mapped to the entries it declared. Nothing outside that block is edited, and no dependency is added — the template is standard-library-only on purpose, so a tester can run `node setup.mjs` by hand.

If no Manual TC declares any file (every one of them reads `none` / `не требуются`), create nothing: an issue that needs no data gets no `test-data/` directory at all.

Never unpack prepared data inside the repository. `setup.mjs` writes it under the system temp directory, at `<tmpdir>/pf-test-data/[ISSUE-ID]/[TC-ID]`, which is also the location 5.3 records in the checklist.

### 5.3 Write manual_test_checklist.md

Read the `doc_language` field from `docs/issues/open/[ISSUE-ID]/prompt.md`'s YAML frontmatter (default: English if absent). Write the checklist's prose (test names, steps, notes, the "How to use" section) in that language — this document goes to an external tester, so it should read naturally in their language. Keep the `[ ]` checkbox syntax as-is.

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
- Prepared data: [tmpdir]/pf-test-data/[ISSUE-ID]/TC-NNN

**Test Data:**
- `prelude/common.json`
- `case-a/input.txt`

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | ... | ... | [ ] |
| 2 | ... | ... | [ ] |

**Notes:** [Leave blank or record any observations]

---
```

Repeat the TC block for every Manual TC in the order they appear in the Status Tracker.

**The Test Data declared for every Manual TC is copied into that case's block of the checklist**, under the label `**Test Data:**` (`**Требуемые данные:**` when `doc_language` is Russian), one bullet per file, in the order the test plan declared them. A case the test plan marked as needing no files keeps the label and carries the value on the same line: `**Test Data:** none` (Russian: `**Требуемые данные:** не требуются`). Never drop the label and never leave it with nothing under it — a case that says nothing about its data is indistinguishable from an old checklist written before data was declared at all, and the tooling has to treat it as unknown.

**The location of the prepared data goes into the same case's prerequisites block**, as its own bullet: `- Prepared data: <tmpdir>/pf-test-data/[ISSUE-ID]/[TC-ID]` (Russian: `- Подготовленные данные: <путь>`). Write the concrete path — `<tmpdir>` is the system temp directory of the machine the checklist is generated on (`/tmp` on Linux and macOS) — so that a tester reading the checklist as a plain file, with no tooling at hand, still knows where the files for the case are. Omit this bullet only for a case declared as needing no files.

Both labels are fixed: `Test Data` / `Требуемые данные` and `Prepared data` / `Подготовленные данные`, and nothing else. They are read back mechanically, so a synonym ("Required files", "Данные кейса") silently loses the declaration.

**Critical:** The checklist is written for an external tester who knows nothing about this project's internal tooling. Do not include any of the following in the output: "Planning Framework", "BRD", "specs.md", "/pf", "SKILL.md", "issue branch", "Status Tracker", "implementation plan", or any other developer-workflow jargon. Use plain language describing the feature and user actions only. This applies to the two data labels as well, which is why they are the everyday words "Test Data"/"Требуемые данные" and "Prepared data"/"Подготовленные данные" and not the name of any internal directory or stage.

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

## Phase 7: Commit & Push

As the last action of this skill, run the shared commit & push procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push") for the files this run changed — the updated Status Tracker in `test_plan.md` and `manual_test_checklist.md`. Do not restate the procedure here: it defines what to stage, the commit message, the push guard, and the one-line report, which you append to the Phase 6 summary.

The `test-data/` directory generated in 5.2.1 — its `fixtures/` and its `setup.mjs` — is committed and pushed by this same run, through that same `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push") procedure: the stage that creates an artifact is the stage that commits it. Leave it uncommitted and the working tree stays modified after the stage reports success, which fails the pre-close quality gate and leaves a tester with a checklist whose data cannot be prepared.

This matters more here than anywhere else in the pipeline: `manual_test_checklist.md` exists to be handed to an **external tester**, who cannot receive it if it never leaves this machine.

---

## Important Notes

- **Never skip the failure gate** — a partial pass is a failure. All Auto TCs must be `✓` before the checklist is generated.
- **Do not invent pass/fail status** — only update Status Tracker rows where you found a matching test in the runner output. Leave unmatched rows as `[ ]`.
- **TC-ID format in test_plan.md is `TC-NNN`** (hyphen, three digits). When scanning test files, match both `TC-001` (with hyphen) and `TC001` (without) as the same TC.
- **If the branch diff errors** (`git diff --name-only develop...HEAD` returns an error), do not skip TC-ID mapping — degrade Phase 3.1 to scanning the entire test suite for test-looking files (as described above) and proceed with TC-ID mapping as normal.
