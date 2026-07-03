# Manual Test Checklist

**Feature Name:** Scale Document Complexity to Task Size
**Issue ID:** 20260703-improve-scale-doc-complexity
**Date:** 2026-07-03
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

## TC-001: Tier question asked at issue creation

**Prerequisites:**
- No active issue exists yet, or you're ready to create a new scratch issue.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Start creating a new issue with a one-line description (e.g. "Fix typo in README installation section"). | You're asked what language the documentation should be written in. | [ ] |
| 2 | Answer the language question (e.g. English). | Immediately afterward, you're asked "How big is this task?" with four choices (trivial/small/medium/large), each with a short description, and "medium" recommended by default. | [ ] |
| 3 | Choose "small". | The new issue's task file records both your language choice and "small" as the size. | [ ] |

**Notes:**

---

## TC-002: An older issue gets its size classified automatically the first time you touch it

**Prerequisites:**
- A previously-created issue exists whose task file has a documentation language recorded but no task-size field yet.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Open the status view for this older issue. | Before showing the usual status, you're asked the same "How big is this task?" question as in TC-001. | [ ] |
| 2 | Answer "medium". | The task-size answer is saved to the issue, and everything else about the issue stays the same. | [ ] |
| 3 | Open the status view again. | You are not asked the size question again — it proceeds straight to the normal status/next-step display. | [ ] |

**Notes:**

---

## TC-003: The size question also appears if you skip straight to a later step on an older issue

**Prerequisites:**
- A previously-created issue with no task-size recorded, but which already has its business requirements written up.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Skip the usual status check and jump directly to the "write the technical spec" step for this issue. | Before anything else happens, you're asked the "How big is this task?" question, recommending "medium." | [ ] |
| 2 | Answer "large". | The size is saved as "large," and the spec-writing step then continues normally, using that size. | [ ] |

**Notes:**

---

## TC-004: When your answers turn out bigger than expected, you're asked to confirm the size again

**Prerequisites:**
- A new issue created with size "small."
- Plan to answer the requirements questions in a way that produces a clearly larger scope (about 6 distinct user-facing behaviors, each with its own detailed rules).

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Go through the requirements Q&A so the written-up requirements end up covering about 6 distinct behaviors with detailed rules. | The requirements document is saved as usual. | [ ] |
| 2 | Watch what happens right after it's saved. | You're told the actual content looks bigger than "small," and asked to confirm or change the size, with a recommendation (e.g. "medium") and the reasoning behind it. | [ ] |
| 3 | Accept the suggestion ("medium"). | The issue's recorded size updates to "medium," and every later step for this issue now uses "medium." | [ ] |

**Notes:**

---

## TC-005: When your answers match the size you picked, nothing extra is asked

**Prerequisites:**
- A new issue created with size "medium."
- Plan to answer the requirements questions with a scope that clearly matches "medium" (about 5 distinct behaviors).

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Complete the requirements Q&A with about 5 distinct behaviors described. | The requirements document is saved. | [ ] |
| 2 | Watch what happens right after it's saved. | Nothing extra is asked — no confirmation prompt appears at all, since the content already matches "medium." | [ ] |
| 3 | Check the issue's status. | The size is still "medium," unchanged, and the next suggested step is to write the technical spec. | [ ] |

**Notes:**

---

## TC-006: A "trivial"-sized issue gets one short combined document instead of several

**Prerequisites:**
- A new issue created with size "trivial" (e.g. "fix a one-line typo in a config validation message").

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Start the requirements step for this issue. | A short round of clarifying questions runs — similar in spirit to the full requirements Q&A, but noticeably shorter. | [ ] |
| 2 | Watch how the output is produced. | A single short document is written directly (no separate delegated drafting step) — no full-length requirements document is created. | [ ] |
| 3 | Open the resulting document. | It has a short "What & Why" section, an "Acceptance Criteria" checklist, and a "Tasks" checklist — no root-cause section, since this isn't a bug fix — and altogether it's under about 50 lines. | [ ] |

**Notes:**

---

## TC-007: For "trivial" issues, the suggested next step always matches what files actually exist

**Prerequisites:**
- A "trivial"-sized scratch issue you can advance through three points: (a) just created, (b) after its short document exists, (c) after its test plan also exists.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Check status with only the initial task description present. | Suggested next step: write the short combined document. | [ ] |
| 2 | Create that document, then check status again. | Suggested next step: review it, then write the test plan. | [ ] |
| 3 | Create the test plan, then check status again. | Suggested next step: review it, then move on to building the change. At no point is "write a separate spec" or "write a separate implementation plan" suggested. | [ ] |

**Notes:**

---

## TC-008: The status display shows both the issue's type and its size

**Prerequisites:**
- Any scratch issue with a recorded size (e.g. "small").

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Check the issue's status. | A status summary is printed. | [ ] |
| 2 | Look at the line naming the active issue. | It shows both the issue's type and its size together (e.g. "type: feat, tier: small"). | [ ] |

**Notes:**

---

## TC-009: For "trivial" issues, the "what's done" list and the "what's next" suggestion don't contradict each other

**Prerequisites:**
- A "trivial" scratch issue that has its short combined document but not yet a test plan.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Check status. | The "completed so far" list shows requirements, spec, and implementation planning all as done (since the one short document covers all three). | [ ] |
| 2 | Look at the "next step" suggestion in the same output. | It says to review and then write the test plan — NOT to move on to building the change — confirming the "completed" list is just a display shortcut and doesn't skip the real next step. | [ ] |

**Notes:**

---

## TC-010: Test plans for "trivial" issues are still written by a dedicated drafting step, just shorter

**Prerequisites:**
- A "trivial" scratch issue with its short combined document already in place, describing a one-line config-message fix.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Start the test-plan step. | A dedicated drafting step still runs (same as for any other issue size) and is told to base the plan on the short combined document, since there's no separate requirements/spec document for a trivial issue. | [ ] |
| 2 | Open the resulting test plan. | It contains 2 to 4 test cases and a tracking table, with no "known issues" section, and the whole document is roughly 80 lines or less. | [ ] |

**Notes:**

---

## TC-011: Writing a separate spec is skipped entirely for "trivial" issues

**Prerequisites:**
- A "trivial" scratch issue with its short combined document already present.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Try to run the "write the technical spec" step directly on this issue. | It stops right away with a message explaining that the spec is already covered by the short combined document, and pointing you to the test-plan step instead. No separate spec document is created. | [ ] |

**Notes:**

---

## TC-012: "Small"-sized specs skip diagrams (unless there's a UI) and stay short

**Prerequisites:**
- A "small" scratch issue (not involving any user interface) with its requirements document already written.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Run the "write the technical spec" step. | The spec is produced without a diagram, since the feature has no user-facing screen or interaction. | [ ] |
| 2 | Check the document's length. | It targets roughly 300 lines or fewer. | [ ] |
| 3 | Repeat with a "small" issue that DOES involve a user-facing screen (e.g. a confirmation popup). | This time a diagram is included, since the feature has a UI component. | [ ] |

**Notes:**

---

## TC-013: "Medium" and "large" issues look exactly like they did before this change

**Prerequisites:**
- A "medium" scratch issue with its requirements and spec already written.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Run the test-plan step on the medium issue. | 10-20 test cases are produced, including a "known issues" section — same shape as before this change. | [ ] |
| 2 | Run the planning step on the same issue. | The resulting plan includes sections for dependencies and a complexity estimate, same as before. | [ ] |
| 3 | Repeat both steps on a "large" issue whose spec has grown past 1500 lines. | The spec splits into 3 linked parts as it already did before; the test plan may include 20+ cases; the plan may include an extra section describing a staged rollout. | [ ] |

**Notes:**

---

## TC-014: "Trivial" planning is skipped, and "small" planning is shorter

**Prerequisites:**
- One "trivial" scratch issue with its short document and test plan in place; one "small" scratch issue with its requirements, spec, and test plan in place.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Run the planning step on the trivial issue. | It stops immediately, explaining the plan is already covered by the short combined document, pointing you to the test-plan step. No separate plan document is created. | [ ] |
| 2 | Run the planning step on the small issue. | A plan is produced without a dependencies section or a complexity-estimate section, targeting roughly 150 lines or fewer. | [ ] |

**Notes:**

---

## TC-015: An oversized short document gets flagged when reviewed

**Prerequisites:**
- A "trivial" scratch issue whose short combined document has been padded out to around 120 lines (simulating a task that grew bigger than expected).

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Run the review/consistency-check step against this document. | A review runs and compares the document's actual length against what's expected for a "trivial"-sized issue. | [ ] |
| 2 | Read the findings. | A top-priority finding appears, saying the document is too long for the declared size, showing the actual length vs. the expected budget, and suggesting either trimming it or reclassifying the issue as a bigger size. | [ ] |
| 3 | Choose to skip the finding and continue anyway. | You're allowed to skip it — nothing prevents you from continuing at this step. | [ ] |

**Notes:**

---

## TC-016: If you skip that warning, the very next step still refuses to continue until it's fixed

**Prerequisites:**
- Continuation of TC-015: you chose to skip the warning without trimming the document or changing its size.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Run the test-plan step on the same issue. | Before doing anything else, it re-checks the same document's length against the size budget and finds it's still too long. | [ ] |
| 2 | See what happens. | It stops with a message telling you the document is still oversized for the declared size, and suggests going back to review it, then trimming it or reclassifying the issue. No test plan is produced yet. | [ ] |
| 3 | Trim the document back down (or reclassify the issue to a bigger size), then try the test-plan step again. | This time it proceeds normally and produces the test plan. | [ ] |

**Notes:**

---

## TC-017: For bug reports, the size gets double-checked right after you describe the bug — not during a later step

**Prerequisites:**
- A new bug-type issue created with size "small," with no root-cause write-up yet.
- Plan to describe a bug whose real cause and impact clearly span more than one part of the system.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Let the process ask you to describe the bug, and answer with a description showing it affects multiple parts of the system. | The root-cause write-up is saved. | [ ] |
| 2 | Watch what happens right after it's saved. | You're told the actual complexity looks bigger than "small," and asked to confirm or change the size, with a recommendation and reasoning. | [ ] |
| 3 | Accept the suggestion to bump it to "medium." | The issue's size updates to "medium." | [ ] |
| 4 | Repeat the same bug-report flow, but this time create the issue as "trivial" size from the start. | No root-cause write-up is created at all — instead you go straight into writing the short combined document, which includes both the root-cause explanation and a task checklist. No size double-check happens at this point. | [ ] |

**Notes:**

---

## TC-018: "Trivial" issues no longer get stuck at the final build step

**Prerequisites:**
- Two scratch issues: (a) a "trivial" one with only its short document and test plan present (no separate plan document); (b) a "medium" one with a full plan document present.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Run the "build it" step on the trivial issue. | It checks for the short combined document (found) and proceeds, reading that document and the test plan — not a separate spec or plan document. | [ ] |
| 2 | Temporarily remove the short combined document from the trivial issue and try again. | It stops, telling you the short document is required and pointing you back to the requirements step. | [ ] |
| 3 | Run the "build it" step on the medium issue. | It checks for the full plan document (found) and proceeds exactly as it always has. | [ ] |

**Notes:**

---

## TC-019: For "trivial" issues, the to-do list for building the change comes from the short document's checklist

**Prerequisites:**
- A "trivial" scratch issue whose short combined document has a task checklist with 2 unchecked items, and a test plan already in place.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Run the "build it" step. | Before starting work, it lists the trivial-issue's file set (the task description, the short document, and the test plan) — not the file set used for bigger issues. | [ ] |
| 2 | Watch how the to-do list is built. | It reads the short document's task checklist and creates one work item per unchecked line, matching each to the relevant test cases the same way it would from a full plan document. | [ ] |
| 3 | Count the resulting work items. | Two work items are created, matching the two checklist lines. | [ ] |

**Notes:**

---

## TC-020: Updating to the latest tooling picks up the new reference document

**Prerequisites:**
- A project set up with an older version of this tooling, missing the new size-reference document.

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Run the update step in the older project. | Its list of managed items now includes an entry for the new size-reference document, describing it as reference data that's "not directly invoked." | [ ] |
| 2 | Confirm the update finishes. | The new reference document is copied into the project alongside everything else that was updated. | [ ] |
| 3 | Try invoking the size-reference item directly (not as part of another step). | It simply prints its reference tables (tiers, document budgets, section rules) rather than trying to run an interactive process. | [ ] |

**Notes:**

---
