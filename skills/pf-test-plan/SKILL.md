---
name: pf-test-plan
description: Generate a comprehensive test plan for the active issue based on BRD/specs or analysis
version: 4.0.0
---

Before checking any other prerequisite, read `prompt.md`'s frontmatter. If it has no `size_tier` field, ask the user via `AskUserQuestion` — same 4 tier options and descriptions as in `<PF_SKILL_ROOT>/pf-size-tiers/SKILL.md`, recommending medium ("matches today's default behavior") — then write the answer into `prompt.md`'s frontmatter before proceeding with the rest of this skill.

Determine the active issue from `docs/issues/open/`. Read `size_tier` from `prompt.md`'s frontmatter (default: medium if absent). Check prerequisites — "exists" below always means **complete** per the shared definition of "stage complete" in `<PF_SKILL_ROOT>/pf-size-tiers/SKILL.md` ("Stage completion"); a stub does not satisfy a prerequisite:
- **If `size_tier: trivial`:** `notes.md` must be complete. If not, stop: "Notes document is required. Run /pf-brd first."
- **If `size_tier` is small/medium/large (or absent):**
  - For feat/improve issues: `brd.md` must be complete. If not, stop: "BRD is required. Run /pf-brd first."
  - For bug issues: `analysis.md` must be complete. If not, stop: "Write analysis.md (root cause analysis) before creating the test plan."

**Output gate — `test_plan.md` already present (regenerate / keep / cancel).** If `test_plan.md` already exists, do **not** stop outright — this is the gate that used to trap the owner of a migrated issue behind a stub it would not let them replace. Judge the existing file against the same shared definition in `<PF_SKILL_ROOT>/pf-size-tiers/SKILL.md`, then ask the user via `AskUserQuestion`, stating whether it is complete or an incomplete stub:
- **regenerate** — produce a fresh test plan via whichever actor `write` resolves to (see the role resolution below) and overwrite the existing file (recommend this when it is not complete — e.g. a migration stub whose whole body is the stub marker);
- **keep** — leave it untouched and stop, reporting that the TEST_PLAN stage is already complete (recommend this when it is complete);
- **cancel** — stop and change nothing.

**Oversized-predecessor guard.** Before producing `test_plan.md`, recompute the oversized-for-tier check against the predecessor document(s) that will be handed to whichever actor drafts the plan:
- `size_tier: trivial` → `notes.md`, budget ~50 lines.
- `size_tier: small` → `specs.md` for feat/improve, `analysis.md` for bug; budget ~300 lines either way.
- `size_tier: medium`/`large` → `specs.md` for feat/improve, `analysis.md` for bug; no cap.

A bug issue above trivial tier has no `brd.md` and no `specs.md` — `analysis.md`
is its sole predecessor, and it is the file this guard measures. Do not skip the
guard just because `specs.md` is absent.

Use a lightweight **mechanical count only** (e.g. `wc -l` on the file) to perform this check — not a full semantic `Read` of the document. This is not a contradiction of the "do not read these documents or draft the plan yourself" instruction below: a mechanical line count is not a semantic read, and it doesn't touch the document's content — it only tells this skill whether to stop before producing the document. Whichever actor drafts the plan — the dispatched sub-agent, or the delegated actor — still does the actual full reading and drafting, exactly as before.

If the predecessor is oversized for its tier, stop before producing `test_plan.md`, with a message naming the offending file, the tier, and the actual line count vs. the budget, e.g.: "`specs.md` is oversized for this issue's declared tier (`small`): 412 lines vs ~300 budget. Run /pf-check to review, then either trim the document or re-classify the issue's size_tier in prompt.md."

**Resolve role** for the `test_plan` key per `<PF_SKILL_ROOT>/pf-roles/SKILL.md` (§4's fallback order), before deciding how to produce the document.

- If `write == claude` — unchanged: **do not read these documents or draft the plan yourself** (beyond the mechanical count above). Dispatch a single sub-agent (Agent tool, default/general-purpose type — no need for a fork) to do the reading, drafting, and writing — this sub-agent-dispatch mechanism is unchanged at every tier, including trivial: a sub-agent is still dispatched for trivial-tier test plans, only the source document and target counts differ. Give it the issue ID, `size_tier`, which source document(s) to read, and the full structure below (Steps 1-5).
- If `write != claude` (in this issue, only `codex`) — this skill has no `AskUserQuestion` clarifying loop of its own to run (the test plan is derived mechanically from the predecessor documents, the same way the sub-agent path already does it). Instead of dispatching a Claude sub-agent, delegate the write to the resolved actor's write-invocator per `<PF_SKILL_ROOT>/pf-roles/SKILL.md` §7, targeting `docs/issues/open/[ACTIVE-ISSUE-ID]/test_plan.md` with a single prompt carrying the same instructions the sub-agent would otherwise receive: the issue ID, `size_tier`, which source document(s) to read (by path — the actor reads them itself, the same "do not inline document content" boundary the mechanical-count guard above already observes), `doc_language`, and the full structure below (Steps 1-5). A from-scratch pipeline document is §7's asynchronous case.

The source document(s) to read/pass, and the target test-case count, by tier:

- **If `size_tier: trivial`:** source document is `notes.md` (not `brd.md`/`specs.md`, which don't exist for trivial issues). Target 2-4 test cases, ≤80 lines total. Omit the Known Issues table section (Step 5) entirely — keep the Status Tracker section (Step 4).
- **If `size_tier: small`:** source document(s) are `brd.md` + `specs.md` if present for feat/improve, `analysis.md` for bug. Target 5-10 test cases. Omit the Known Issues table section (Step 5).
- **If `size_tier: medium`/`large` (or absent):** source document(s) are `brd.md` + `specs.md` if present for feat/improve, `analysis.md` for bug — unchanged from today. Target 10-20 test cases typical for medium, 20+ allowed for large. Include the Known Issues table section (Step 5) — no regression from current behavior.

Tell it (the sub-agent, or — for a delegated actor — folded into the write prompt) to also read the `doc_language` field from `prompt.md`'s YAML frontmatter (default: English if absent) and write the test plan's prose content (test case names, descriptions, steps, notes) in that language, keeping headings and structural labels (e.g. `Status Tracker`, `TC-NNN`, `Priority`) in English so downstream tooling keeps working. Instruct it to write the result directly to `docs/issues/open/[ACTIVE-ISSUE-ID]/test_plan.md`. The sub-agent path returns only a short summary (test case count, categories covered) — not the document contents, since the orchestrator does not need them. For a delegated actor, once the write-invocator call returns, read `test_plan.md` back from disk and derive that same short summary from it instead.

The structure to pass to whichever actor drafts the plan:

### Step 1: Identify Test Scenarios

Based on the specs:
- Happy path flows
- Error conditions
- Edge cases
- State transitions
- Responsive behavior
- Accessibility requirements

### Step 2: Create Test Cases

For each scenario, create detailed test cases:

```markdown
### TC-NNN: [Test Name]

**Description:** [What this test verifies]

**Preconditions:**
- [Required state before test]
- [Required data]

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | [Action to take] | [What should happen] |
| 2 | [Action to take] | [What should happen] |

**Test Data:**
- `path/to/fixture.json`
- `path/to/input.txt`

**Expected Outcome:** [Final verification]

**Priority:** Critical / High / Medium / Low
```

**Test Data is mandatory and must be non-empty for every test case whose Type is `Manual`** (Step 4): the field lists the concrete **files and fixtures** that case needs — one bullet per entry, each a path, so the data can later be prepared for the tester automatically instead of by hand. A Manual case that genuinely needs no files still declares that, in one line and with the same label: `**Test Data:** none` (write it as `**Требуемые данные:** не требуются` when `doc_language` is Russian). A Manual test case with a blank, missing or hand-waving Test Data field is not acceptable — "the usual sample data" is not a file.

**Boundary of responsibility: Test Data holds files and fixtures only.** Prose preconditions — bring up a service, create an account, provision an external system, obtain credentials — are **not** test data: they stay in **Preconditions** and must never be listed under Test Data. The line is drawn by what the entry *is* (a file that can be copied into place vs. an action a human performs), not by how important it is.

### Step 3: Organize by Category

Group test cases:

- Functional tests
- UI/UX tests
- Validation tests
- Integration tests (if applicable)
- Edge case tests

### Step 4: Create Status Tracker

Each row must include a **Type** column: `Auto` if the test case is verified by running an automated test suite (e.g. a unit/integration test asserting behavior of executable code), or `Manual` if it can only be verified by a human following steps by hand (e.g. inspecting a generated document, running a CLI/skill interactively, checking prose content). `/pf-test` uses this column to decide which TCs gate on the automated test suite and which go into the manual test checklist — every TC must be marked one or the other, there is no unmarked/blank state.

A TC marked `Auto` must be discoverable by `/pf-test`'s TC-ID scanning (Phase 3.2/3.3 in `skills/pf-test/SKILL.md`) — written using a convention that phase recognizes. If it cannot be, mark it `Manual` instead.

```markdown
## Status Tracker

| TC     | Test Case | Type   | Priority | Status | Remarks |
| ------ | --------- | ------ | -------- | ------ | ------- |
| TC-001 | [Name]    | Auto/Manual | High | [ ]    |         |
```

### Step 5: Add Known Issues Section

(Omit this entire section for `size_tier: trivial` and `size_tier: small` — see the tier instructions above. Include it for `medium`/`large`.)

```markdown
## Known Issues

| Issue | Description | TC Affected | Steps to Reproduce | Severity |
| ----- | ----------- | ----------- | ------------------ | -------- |
|       |             |             |                    |          |
```

Save the test plan to `docs/issues/open/[ACTIVE-ISSUE-ID]/test_plan.md`.

Include: overview and objectives, prerequisites, test cases (2-4 for trivial and ≤80 lines total, 5-10 for small, 10-20 typically for medium, 20+ allowed for large), status tracker, and (medium/large only) known issues section.

Once the sub-agent (or, when `write != claude`, the delegated actor) returns, relay the summary to the user — the sub-agent's own summary on the `write == claude` path, or the summary derived from reading `test_plan.md` on the delegated path.

## Close the stage: commit & push

After relaying the summary, run the shared commit & push procedure in `<PF_SKILL_ROOT>/pf-git/SKILL.md` ("Stage commit & push") as the last action of this skill. The orchestrator does this, never the sub-agent. Do not restate the procedure here: it defines what to stage, the commit message (including the TC counts), the push guard, and the one-line report. A stage is not finished until its document is committed and pushed.
