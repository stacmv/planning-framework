# Business Requirements Document: Scale Document Complexity to Task Size

## Overview

Today, every issue that goes through the Planning Framework pipeline (BRD → spec → test plan → implementation plan) produces documents of roughly the same shape and size, regardless of whether the underlying task is a one-line fix or a multi-week feature. This creates unnecessary overhead for small tasks (writing and reviewing a 15-test-case test plan for a one-line change) and risks under-specifying large ones if the fixed template is treated as a ceiling rather than a floor.

This feature introduces a **size tier** concept that travels with an issue from creation through closure, and makes every pipeline skill (and the orchestrator) size-aware: smaller issues get lighter-weight documents and a shorter path through the pipeline; larger issues keep (or exceed) today's behavior.

## Goals

- Every issue is classified into one of four size tiers: **trivial, small, medium, large**.
- Document length, level of detail, and which sections are required scale with the tier.
- Trivial-tier issues can skip the multi-document pipeline in favor of a single lightweight document, while still producing a proper test plan and manual test checklist for QA/human consumption.
- The tier is set as early as possible (at issue creation) and can be corrected once real content exists (after the BRD is drafted), without requiring the user to answer the same classification question twice unless the initial guess turns out to be wrong.
- Oversized documents relative to the declared tier are caught and flagged before the user proceeds further down the pipeline, so scope creep in documentation is visible early rather than only in hindsight.
- Issues created before this feature existed continue to work; they are classified on their first interaction with the pipeline going forward rather than being silently reinterpreted.

## Non-Goals

- Changing the actual engineering work required to implement a feature/fix — this only affects the size and shape of planning documents, not the underlying implementation.
- Redesigning the individual test-case template itself (e.g. simplifying the Preconditions/Steps/Test Data structure for small tiers) — tracked separately, out of scope here.
- Automatically resolving oversized documents on the user's behalf — flagging is in scope, auto-editing is not.

## User Stories

1. **As a framework user fixing a typo or a one-line bug**, I want to skip writing a full BRD, spec, and implementation plan, so that the planning overhead is proportional to the size of the fix.
2. **As a framework user starting a new issue**, I want to give a quick sense of how big the task is right when I describe it, so that the framework can immediately tell me whether I'm in for the full pipeline or a shortcut.
3. **As a framework user who underestimated a task's size**, I want the framework to notice — once the BRD reveals more user stories/acceptance criteria than expected — and ask me to confirm or correct the tier, so that my documentation doesn't stay artificially small for an actually-medium task.
4. **As a framework user working on a medium or large feature**, I want the existing full pipeline (BRD, spec, test plan, implementation plan) to work exactly as it does today, so that nothing regresses for the tasks the framework already serves well.
5. **As a framework user or QA reviewer**, I want a real, separate test plan and manual test checklist to exist for every issue regardless of tier, so that testing artifacts remain consistent and consumable by QA processes and other humans even when the rest of the documentation is condensed.
6. **As a framework user reviewing a drafted document**, I want to be warned if a document has grown larger than what its declared tier calls for, so that I can either trim it or acknowledge the task is actually bigger than I first said.
7. **As a framework user continuing an issue that predates this feature**, I want to be asked to classify it the next time I run a pipeline skill against it, so that the new size-aware behavior applies without requiring me to manually edit old issue files.

## Business Rules

### Size tiers
- Four tiers exist: **trivial**, **small**, **medium**, **large**.
- **Medium** represents today's existing default behavior (current fixed templates/counts) — this is the baseline every existing pipeline skill already implements.
- **Trivial** is for changes on the scale of a one-liner or a single obvious fix.
- **Small** is for a single focused change that's more than a one-liner but clearly bounded.
- **Large** is for issues where the existing "full" template is itself insufficient and may need further splitting (this already happens today for oversized specs; large tier makes that behavior an explicit, named tier rather than an ad hoc overflow case).

### Tier classification lifecycle
- The tier is first estimated at issue creation time, alongside the existing documentation-language question.
- Once the BRD is drafted, the tier is re-checked against the BRD's actual content (e.g. number of user stories and acceptance criteria). If the heuristic disagrees with the initial guess, the user is asked to confirm or override the tier before continuing.
- After this confirmation point, the tier is considered settled for the rest of the pipeline (spec, test plan, implementation plan) unless the user is later asked to re-classify by an oversized-document flag.
- Issues that exist before this feature was introduced (no tier recorded) are not assumed to be any particular tier. The next pipeline skill run against such an issue asks the user to classify it, then records the answer for all subsequent steps on that issue.

### Effect of tier on documents
- For **trivial**-tier issues: the BRD, spec, and implementation plan are replaced by a single combined lightweight document ("notes") capturing what/why, a short list of acceptance points, and a short task breakdown. This single-document step is done directly by the skill, without dispatching a sub-agent, since the expected output is short.
- For **trivial**-tier issues, the test plan and manual test checklist are still produced as their own separate documents (not folded into the combined notes document), because they're consumed by QA processes and other humans who expect them as standalone artifacts. The number of test cases is scaled down for trivial tier, but the test-plan generation step continues to work exactly as it does today (including dispatching its existing sub-agent), since that mechanism doesn't depend on document size.
- For **small**, **medium**, and **large** tiers, the full existing pipeline (BRD → spec → test plan → implementation plan) continues to apply, with document length/detail/section requirements scaled by tier:
  - Lower tiers omit sections that don't add value at that scale (e.g. dependency analysis, complexity estimates, diagrams) and target shorter overall document length.
  - Higher tiers keep or expand on today's requirements (e.g. large tier may require splitting a document into multiple parts, extending today's existing "split if too long" behavior).

### Oversized-document check
- The consistency-check step gains a new check: does each produced document's actual size/detail exceed what's expected for the issue's declared tier?
- This check is **blocking**: if a document is flagged as oversized for its tier, the user cannot proceed to the next pipeline stage until it's resolved.
- Resolution is the user's decision — either trim the document's content back down to the declared tier's expectations, or explicitly change the issue's tier to a larger one that matches the document as written. The check only reports the discrepancy; it does not edit documents automatically.

## Acceptance Criteria

- [ ] A new issue's tier is asked/estimated at creation time, alongside the documentation-language question, and recorded per-issue (analogous to how documentation language is already recorded).
- [ ] After a BRD is drafted, the recorded tier is compared against the BRD's content, and the user is prompted to confirm or override it if there's a mismatch.
- [ ] For trivial-tier issues, no separate BRD, spec, or implementation-plan documents are produced — a single combined document exists instead, produced without a sub-agent dispatch.
- [ ] For trivial-tier issues, a test plan and a manual test checklist still exist as their own documents, with a test-case count appropriate to a trivial-sized task, produced via the same sub-agent-dispatch mechanism used for every other tier.
- [ ] For small, medium, and large tier issues, the existing four-document pipeline (BRD, spec, test plan, implementation plan) is produced, with section inclusion and target length/detail scaled to the declared tier; medium tier's output is unchanged from current behavior.
- [ ] The consistency-check step flags any document whose size/detail exceeds its tier's expectations, and this flag blocks progression to the next stage until the user trims the document or explicitly re-classifies the tier.
- [ ] Issues that predate this feature (no recorded tier) are classified via a user prompt the next time any pipeline skill is run against them, and that classification is then reused for the rest of that issue's pipeline.
- [ ] None of the above changes alter the actual engineering behavior required to implement the underlying task — only the shape and volume of planning documentation and the pipeline steps used to produce it.
