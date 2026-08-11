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

Run the detected command. Capture stdout and stderr **combined into one stream** (e.g. via `2>&1`), along with the exit code. This matters beyond convenience: this repo's own `pf_fail` (`test/lib.sh:65-68`) writes to stderr while `pf_pass` writes to stdout, and 3.3 below searches this one combined stream — if the two are captured separately instead, no `pf_fail` label is ever found where 3.3 looks, and a genuinely failing test is misread as "not matched" instead of `✗`.

---

## Phase 3: TC-ID Mapping

### 3.1 Find test files on the issue branch

Scan the entire test suite for test-looking files, regardless of whether they were changed on this branch — `git diff --name-only develop...HEAD` is not the only source: in addition to the diff, also scan pre-existing test files. A file "looks like a test file" if its path or name contains `test`, `spec`, or `__tests__`, or its extension matches `.test.*`, `.spec.*`, `_test.*`.

### 3.2 Scan for TC-ID patterns

A file found in 3.1 contributes TC-IDs to the **active issue's** map only if
it identifies itself as belonging to that issue: the active ISSUE-ID appears
somewhere in the file **or its path** — this repo's existing convention, e.g.
`test/skills-role-matrix-static.sh:2`, whose header names its issue — or the
file appears in `git diff --name-only develop...HEAD` (it is this issue's own
work, changed on this branch). A file scanned in 3.1 that qualifies under
neither test is not mapped to this issue: do not record any TC-ID found in it
here, even where a pattern below matches literally.

For each qualifying file, scan its content for any of these patterns:

- Function or method name contains a TC-ID: `test_TC001_`, `it_TC001_`, or the literal `TC001` (zero-padded or not) anywhere in a function name, `it(...)`, `describe(...)`, or `test(...)` call
- Comment directly above a test: `# TC-001` or `// TC-001`
- Describe block title starting with the TC-ID: `describe('TC-001:` or `describe("TC-001:`
- A TC-ID inside a string literal that is the test's own **label** — the argument by which a test-registration or result-reporting helper names the case: the shell convention `pf_pass "TC-009 step 1: ..."` / `pf_fail "TC-009 ..."`, or the JS `test(...)` / `describe(...)` / `it(...)` title argument. What decides a match is the string's *role* — does it name/register this case to a test helper or reporter? — not where inside the string the TC-ID sits.

A TC-ID counts as a match only under that role. It does not count, and must
be ignored, in any of these forms even though each is a string literal
containing the TC-ID:

- An assertion's failure-message argument — `assert.ok(ru, "TC-001 not parsed")` (`tools/manual-test-ui/test/checklist-ru.test.js:47`) — the string reports on an assertion; it does not label a case to a test helper.
- A TC-ID as an object field value — `tcId: "TC-001"` (`tools/manual-test-ui/test/checklist-git.test.js:101`) — data describing a case, not a label passed to a test-registration or reporting helper.
- A TC-ID as a selector or parameter — `prepareOk("TC-001")`, `const runs = [null, "TC-001", ...]` (`tools/manual-test-ui/test/prepare-repo-state.test.js`), `CASE_IDS = ["TC-001", "TC-002"]` (`prepare.test.js:35`) — the TC-ID picks or lists a case; it does not label this test.
- A TC-ID inside a string used as fixture or sample test data — the string is data under test, not a label. Example: `tools/manual-test-ui/test/checklist-ru.test.js` embeds `## TC-001:` inside a fixture constant (also `## TC-002:`); that is data under test, not a declaration that this file tests TC-001.
- A banner announcing which case is about to run, printed unconditionally before its checks — `printf '=== TC-009: ...'` (`test/skills-role-matrix-static.sh:20`), `printf '=== TC-001: ...'` (`test/pf-test-tc-mapping-static.sh:40`) — the string names the case but carries no pass/fail information: it is printed whether the case goes on to pass or fail, so it is not a result-reporting label and does not decide anything in 3.3.

These five are the same rule, not separate exceptions: a TC-ID does not count
and must not match — is ignored — unless the string is the label a
test-registration or result-reporting helper uses to name this case.

For each qualifying file, collect a map of TC-ID → the list of every
**candidate** label string matched above for it, recorded in its
**matchable form** — not the bare TC-ID, and not the full source literal
either. This repo's convention routinely interpolates a shell variable (or
equivalent) inside the label — `pf_fail "TC-001 step 4: aggregation rule
incomplete (absence-not-failure: $has_absence_not_failure, ...)"`
(`test/pf-test-tc-mapping-static.sh:92`) is typical — and at runtime the
shell substitutes that value **before** the label is printed, so the line
the runner actually prints never contains the literal `$has_...` text: a
candidate recorded as the full, untruncated source literal can never appear
in the output, no matter how the check site resolves at runtime. To record
a matchable candidate, truncate the label at the first interpolation
point — a `$name`, `${...}`, or an equivalent variable-substitution/format
placeholder in the file's language — and keep only the text before it. That
leading text is static: the source writes it literally, so it is exactly
what prints at runtime; everything from the interpolation point onward is a
runtime value and is not knowable from the source, so it is not part of the
candidate. A label with no interpolation point has no truncation to make;
its matchable form is the label in full, verbatim, exactly as before. 3.3
matches each candidate's matchable form against the output — not the bare
ID and not the untruncated source literal. They are called candidates
deliberately, not expectations: 3.2 scans **source text**, where an
`if`/`else` pair's two branches are both always present in the file, so
both are always found and recorded here — but at runtime exactly one branch
of that pair executes, so at most one of the two ever appears in the
output. 3.2 does not decide which; 3.3 does, from what actually printed.

A single TC-ID commonly collects more than one candidate, and all of them
must be recorded, not only the first one found: this repo's own bash
convention registers one candidate per check site (one step), each with its
own text — and a single logical check site is itself commonly written as an
`if`/`else` pair carrying a **pass-form** and a **fail-form** with different
literal text. For example `test/pf-test-tc-mapping-static.sh:53-57` registers
both `pf_pass "TC-001 step 2: 3.2 documents TC-ID inside a string
literal/…"` and `pf_fail "TC-001 step 2: 3.2 does not document TC-ID inside a
string literal/…"` for the very same site — record both as separate
candidates for TC-001. A guard clause with no paired success text (e.g.
`test/skills-role-matrix-static.sh:24`'s `pf_fail "TC-009: skills/pf-roles/
SKILL.md does not exist"`, with no matching `pf_pass`) is recorded the same
way: a candidate that simply has no sibling, still just a candidate that may
or may not appear.

For example, `test/skills-role-matrix-static.sh`'s TC-009 is checked at five
**check sites** (step 1 twice, step 2, step 3, step 4), each written as one
`if`/`else` pair — so 3.2 records ten pass/fail candidate strings for TC-009
(plus the guard-only fail candidate above), not five: five is the count of
check sites, not of candidate strings, and 3.2 records strings, one per
literal actually in the source, with no collapsing of a pass/fail pair into a
single "site label".

When the matched text is not itself something the runner prints (a comment directly
above a test, or a bare function name) — record the adjacent test's own
name/title instead: the string the runner does print for that test, so 3.3
still has something to find in the captured output.

### 3.3 Match to runner output

For each TC-ID mapped in 3.2, search the **combined stdout+stderr output** captured in Phase 2 (see Phase 2 above — the two streams are captured as one stream, not separately) for each candidate's **matchable form** recorded for it there — not the bare TC-ID, and not the untruncated source literal. A candidate matches when its matchable form appears as a **prefix-anchored substring** of a line in that combined output: the matchable form must line up with the start of the label on that line, while the rest of the line — whatever runtime-substituted text follows the interpolation point the matchable form was truncated at — may be anything.

This is the same substring-matching technique as 3.2, with one difference: it is anchored. Two distinct freedoms must not be confused. **Position within the label is not free** — the matchable form must line up with the start of the label; a matchable form occurring partway inside a longer label does not match. **Which line carries it is free** — any line of the combined output qualifies, wherever it occurs in the run, and the match is not limited to test names or function names (for example a line printed by `pf_pass` to stdout, or by `pf_fail` to stderr). A candidate matched under those two conditions counts as an **appearing** candidate for that TC-ID.

Degenerate case: if a candidate's matchable form carries no distinguishing text beyond the bare TC-ID — nothing survived truncation — it must not be matched by prefix alone; leave that TC-ID unmatched by this candidate rather than risk attributing an unrelated line to it (measured against this repo's convention, the *shortest* real check site still keeps nineteen static characters after the TC-ID — `test/pf-close.sh:58`, whose matchable form truncates to `TC-001: PARENT-BRANCH = '` — so this guard is a rare corner, not the common path, and no runner-section or suite-header fallback is used to resolve it).

Matching the bare TC-ID alone is not enough: a bare `TC-001` collides with unrelated occurrences elsewhere in a full `make test` run — banners (e.g. `test/converge-fresh.sh:15`), other issues' TC-IDs, or the fixtures/selectors excluded in 3.2 — while the full label recorded in 3.2 is specific enough to avoid that collision. Determine pass or fail for each appearing candidate from its match, e.g. whether the label was printed by `pf_pass` or `pf_fail`, or from the runner's own pass/fail report for the test carrying that label. Search the *combined* output specifically, not stdout alone: this repo's own `pf_fail` (`test/lib.sh:65-68`) writes to stderr while `pf_pass` writes to stdout, so searching stdout alone would make every `pf_fail` candidate permanently non-appearing and the `✗` outcome below unreachable.

**Aggregation rule, for every TC-ID mapped in 3.2** (whether it collected one candidate or several): 3.2 collected *candidates* — strings that could appear in the output — not a checklist all of which must appear. Only the candidates that actually appear in the combined output, as just decided above, count toward the verdict. A collected candidate that does **not** appear is not evidence of anything failing, and never by itself blocks `✓`: it is simply the branch of an `if`/`else` pair (or a guard) that did not execute this run, exactly as 3.2 describes. Decide the TC-ID's status from the appearing candidates alone:

- **No candidate collected for this TC-ID appears anywhere in the output.** The TC-ID does not count as matched by this step — it is not `✓`. It is left for 3.4's "not matched" handling, which is what feeds the Phase 5 precondition.
- **At least one candidate appears, and any appearing candidate reported failure.** The TC-ID is `✗`. One failing *appearing* candidate fails the whole TC-ID, no matter how many other appearing candidates for it reported success — this is what keeps a TC-ID whose step 1 passed and step 4 failed at `✗`, never `✓`.
- **At least one candidate appears, and every appearing candidate reported success.** The TC-ID is `✓`.

Tests that have no TC-ID pattern are counted in an aggregate total but are not mapped individually.

### 3.4 Update the Status Tracker

Open `test_plan.md`. In the **Status Tracker** table, for each row where the TC-ID was matched:

- Replace `[ ]` in the **Status** column with `✓` if the test passed
- Replace `[ ]` with `✗` if the test failed

For rows the TC-ID mapping did not match, leave the Status column unchanged. This covers both ways a row goes unmatched, not only the first: 3.2 found no candidate for that TC-ID at all, **or** 3.2 collected candidates but none of them appeared in the combined output (3.3's first aggregation outcome). Either way the row keeps its `[ ]`, which is what the Phase 5 precondition then acts on.

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

If, after Phase 3, one or more Auto-type rows remain unmatched — Status still `[ ]`, with no `✗` rows to trigger the gate above — this precondition is not met. Stop with message: "N Auto TC(s) have no matching test in the runner output — Status left as `[ ]`: TC-xxx, TC-yyy, ... . Add a test using a convention from Phase 3.2, or re-run /pf-test, before generating the manual checklist." (list every unmatched TC-ID, not just the count.)

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
- **If the branch diff errors** (`git diff --name-only develop...HEAD` returns an error), do not skip TC-ID mapping — Phase 3.1's scan of the entire test suite is unaffected. In 3.2's qualifying-file test, the diff limb is simply unavailable: qualify files by the active-ISSUE-ID limb alone (the ID appears in the file or its path) until the diff can be computed again.
