# Test Plan: Scale Document Complexity to Task Size

## Overview

This test plan verifies the size-tier-aware behavior introduced across the Planning Framework's pipeline skills (`skills/pf/SKILL.md`, `pf-brd`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`, `pf-check`, `pf-execute`, `pf-update`) and the new reference skill `skills/pf-size-tiers/SKILL.md`, per `brd.md` and `specs.md` of this issue.

Because this feature is a set of markdown skill-instruction files rather than executable application code, there is no automated test suite to run. Every test case below is a **manual verification scenario**: a tester (human or an agent role-playing the framework user) drives an actual Planning Framework session against a scratch/test issue, observes the prompts, files, and messages the skills produce, and checks them against the expected behavior described in `specs.md`. No responsive-layout or visual-accessibility angle applies here — the only "UI" is markdown prose and `AskUserQuestion` prompts, so those categories are intentionally omitted; instead, test cases check that the produced markdown documents stay within their prescribed section sets and size budgets, since that structural conformance is this feature's equivalent of a UI contract.

## Objectives

- Confirm the `size_tier` field is asked at issue creation, recorded in `prompt.md` frontmatter, and re-confirmed once real BRD/analysis content exists.
- Confirm trivial-tier issues follow the lightweight `notes.md` path end-to-end (creation through `/pf-execute`), while small/medium/large issues keep or scale the existing four-document pipeline.
- Confirm legacy issues (no `size_tier` recorded) are classified on first contact with any pipeline skill.
- Confirm the oversized-for-tier check in `/pf-check` fires correctly and that blocking is enforced by each downstream skill's own recomputed guard, not by `/pf-check` itself.
- Confirm `/pf-update` and the distribution mechanism are aware of the new `skills/pf-size-tiers/SKILL.md` file.
- Confirm none of the above changes alter actual engineering/implementation behavior — only document shape and pipeline routing.

## Prerequisites

- A local checkout of this repository with the size-tier changes applied to: `skills/pf/SKILL.md`, `skills/pf-brd/SKILL.md`, `skills/pf-spec/SKILL.md`, `skills/pf-test-plan/SKILL.md`, `skills/pf-impl-plan/SKILL.md`, `skills/pf-check/SKILL.md`, `skills/pf-execute/SKILL.md`, `skills/pf-update/SKILL.md`, and the new `skills/pf-size-tiers/SKILL.md`.
- Ability to run `/pf`, `/pf-brd`, `/pf-spec`, `/pf-test-plan`, `/pf-impl-plan`, `/pf-check`, `/pf-execute`, `/pf-update` as Claude Code skills in a scratch project (or this repo's own `docs/issues/` tree, using disposable test issue IDs that are deleted/archived after the run).
- At least one pre-existing "legacy" test issue folder with a `prompt.md` that has `doc_language` but no `size_tier` field, to exercise the legacy guard.
- Willingness to create and discard several scratch issues (one per tier, one bug-type, one intentionally oversized) — these should use obviously-fake issue IDs (e.g. `99999999-test-*`) so they are never mistaken for real work and are cleaned up after the test pass.

## Test Cases

### Tier Classification & Lifecycle

### TC-001: Tier question asked at issue creation

**Description:** Verifies that creating a new issue asks the user for `size_tier` immediately after the existing `doc_language` question, and records the answer in `prompt.md` frontmatter.

**Preconditions:**
- No active issue exists (or the tester is prepared to create a new scratch issue).
- `skills/pf/SKILL.md` contains the updated "Creating prompt.md" step from spec §3a.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf` and start creating a new issue with a one-line description. | The existing `doc_language` `AskUserQuestion` appears first. |
| 2 | Answer the `doc_language` question. | Immediately afterward, a second `AskUserQuestion` appears: "How big is this task?" with options trivial/small/medium/large, each showing its one-line description, and medium recommended by default. |
| 3 | Select `small`. | `prompt.md` is created with both `doc_language` and `size_tier: small` in its YAML frontmatter. |

**Test Data:**
- Issue description: `Fix typo in README installation section`
- doc_language: `English`
- size_tier answer: `small`

**Expected Outcome:** `prompt.md` frontmatter contains `size_tier: small` alongside `doc_language: English`, and the tier question offered all four options with the medium default called out as "today's standard full pipeline — pick this if unsure."

**Priority:** Critical

---

### TC-002: Legacy issue is classified on first pipeline-skill run

**Description:** Verifies that an issue created before this feature (no `size_tier` field) gets classified the next time any pipeline skill runs against it, per spec §3b and the shared legacy guard §8.

**Preconditions:**
- A scratch issue exists with `prompt.md` containing `doc_language` but no `size_tier` key.
- The issue has no `brd.md`/`notes.md` yet (fresh legacy issue).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf` against this legacy issue. | Before Step 5 (detect completed stages) runs, the tier question from TC-001 (same 4 options, medium recommended) is asked. |
| 2 | Answer `medium`. | `prompt.md` is rewritten with `size_tier: medium` added to its frontmatter, other frontmatter fields preserved. |
| 3 | Run `/pf` again. | The tier question is not asked again; `/pf` proceeds straight to normal status/next-step detection using the now-recorded tier. |

**Test Data:**
- Legacy `prompt.md` frontmatter before: `doc_language: English` only.
- Answer: `medium`

**Expected Outcome:** `prompt.md` gains `size_tier: medium` after the first run and is not re-prompted on subsequent runs.

**Priority:** Critical

---

### TC-003: Legacy guard fires identically when a non-`/pf` skill is run first

**Description:** Verifies the legacy guard (spec §8) is not exclusive to `/pf` — any of `pf-brd`/`pf-spec`/`pf-test-plan`/`pf-impl-plan`/`pf-check`/`pf-execute` run directly against a legacy issue triggers the same tier question before any of that skill's own prerequisite checks.

**Preconditions:**
- A scratch legacy issue exists (no `size_tier`), with `brd.md` already present (so `/pf-spec` would otherwise proceed normally).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-spec` directly against the legacy issue. | Before any other prerequisite check, the tier `AskUserQuestion` (4 options, medium recommended, "matches today's default behavior") is shown. |
| 2 | Answer `large`. | `prompt.md` frontmatter is updated with `size_tier: large`, then `pf-spec`'s normal flow (reading `brd.md`, writing `specs.md`) continues using that tier. |

**Test Data:**
- Skill invoked: `/pf-spec`
- Answer: `large`

**Expected Outcome:** The tier is recorded exactly as it would be via `/pf`, confirming the guard text in spec §8 is applied verbatim/adapted across all six skills, not only the orchestrator.

**Priority:** High

---

### TC-004: BRD-content tier confirmation — heuristic disagrees with recorded tier

**Description:** Verifies that after `brd.md` is drafted for a small/medium/large-tier issue, the model re-derives scope from the BRD's actual content and prompts to confirm/override if it disagrees with the recorded tier, per spec §4.

**Preconditions:**
- Scratch issue created with `size_tier: small` recorded at creation.
- The user's answers during `/pf-brd`'s Q&A produce a BRD with 6 user stories and correspondingly detailed acceptance criteria and business rules (i.e., clearly medium/large-shaped content, not small).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-brd` and answer the clarifying questions so the resulting `brd.md` has 6 user stories. | `brd.md` is saved as usual. |
| 2 | Observe the step immediately after saving. | The model re-reads `brd.md`, judges its scope against `size_tier: small`, finds a mismatch, and asks the user via `AskUserQuestion` to confirm or override, recommending its own judgment (e.g. medium) with reasoning. |
| 3 | Accept the model's recommendation (`medium`). | `prompt.md`'s `size_tier` is updated to `medium`; downstream skills (`pf-spec`, etc.) subsequently use `medium`. |

**Test Data:**
- Recorded tier at creation: `small`
- BRD content: 6 user stories, 15+ acceptance criteria
- Confirmation answer: `medium` (override)

**Expected Outcome:** `prompt.md`'s `size_tier` reflects the confirmed/overridden value, and this happens exactly once (not re-asked on later skill runs for the same issue).

**Priority:** Critical

---

### TC-005: BRD-content tier confirmation — heuristic agrees, no prompt shown

**Description:** Verifies the confirmation step is a no-op (no extra question shown) when the BRD's actual content matches the recorded tier, avoiding needless friction.

**Preconditions:**
- Scratch issue created with `size_tier: medium`.
- `/pf-brd` Q&A produces a BRD with 5 user stories (squarely medium-shaped, per the tier table in `pf-size-tiers`).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-brd` to completion, producing a 5-user-story `brd.md`. | `brd.md` saved. |
| 2 | Observe the post-save step. | The model judges scope matches `medium`; no `AskUserQuestion` for tier confirmation is shown. |
| 3 | Run `/pf` to check status. | `size_tier` remains `medium`, unchanged; next step is `/pf-spec`. |

**Test Data:**
- Recorded tier: `medium`
- BRD content: 5 user stories

**Expected Outcome:** No confirmation prompt appears when judgment and recorded tier already agree.

**Priority:** Medium

---

### Trivial-Tier Pipeline

### TC-006: pf-brd on trivial tier produces notes.md directly, no sub-agent, no brd.md

**Description:** Verifies that for `size_tier: trivial`, `/pf-brd` runs a condensed Q&A and writes `notes.md` directly (no sub-agent dispatch, no `brd.md`), per spec §2 and §4.

**Preconditions:**
- Scratch issue created with `size_tier: trivial` (e.g. "fix a one-line typo in config validation message").

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-brd`. | A condensed clarifying-questions loop runs (same 95%-confidence bar and recommendation pattern as full BRD, but shorter). |
| 2 | Observe how the document is produced. | The model writes `docs/issues/open/[ISSUE-ID]/notes.md` itself — no sub-agent is dispatched. `brd.md` is never created. |
| 3 | Inspect `notes.md`. | It follows the template from spec §2: `# Notes: [Title]`, `## What & Why`, `## Acceptance Criteria`, `## Tasks` (no `## Root Cause / Context` section, since this is not a bug issue), and is under ~50 lines total. |

**Test Data:**
- Issue type: `improve`
- size_tier: `trivial`

**Expected Outcome:** `notes.md` exists, `brd.md` does not, and the file matches the template and line-budget in `skills/pf-size-tiers/SKILL.md`.

**Priority:** Critical

---

### TC-007: Trivial-tier routing table — document-presence-keyed lookup

**Description:** Verifies the trivial-tier Step-6 lookup in `/pf` is keyed on which documents exist (not on "last completed stage"), so `/pf-test-plan` is never skipped, per spec §3c.

**Preconditions:**
- Scratch trivial-tier issue at three points in its lifecycle: (a) no `notes.md` yet, (b) `notes.md` exists but no `test_plan.md`, (c) both `notes.md` and `test_plan.md` exist.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf` with only `prompt.md` present. | Next step reported: `/pf-brd`. |
| 2 | Create `notes.md` (via `/pf-brd`), then run `/pf`. | Next step reported: `/pf-check` (pre-test-plan check); once treated as passed (per the existing "check passed" convention), next step becomes `/pf-test-plan`. |
| 3 | Create `test_plan.md` (via `/pf-test-plan`), then run `/pf`. | Next step reported: `/pf-check` (pre-execute check), then `/pf-execute` once passed. `/pf-spec` and `/pf-impl-plan` are never offered as next steps at any point. |

**Test Data:**
- size_tier: `trivial`

**Expected Outcome:** At every stage, the routing matches the table in spec §3c exactly, and `pf-test-plan` is reached rather than skipped — the specific regression this table exists to prevent.

**Priority:** Critical

---

### TC-008: Status output includes the tier

**Description:** Verifies `/pf`'s printed status block shows the issue's tier alongside its type, per spec §3d.

**Preconditions:**
- Any scratch issue with a recorded `size_tier` (e.g. `small`) and issue type `feat`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf`. | Status block is printed. |
| 2 | Inspect the "Active issue" line. | Reads `Active issue: <ISSUE-ID>  (type: feat, tier: small)` — both type and tier shown together. |

**Test Data:**
- Issue type: `feat`
- size_tier: `small`

**Expected Outcome:** Tier appears in the status line exactly as specified, without disrupting the "Completed stages" / "Next step" lines that follow.

**Priority:** Medium

---

### TC-009: Step 5 stage detection — notes.md collapses BRD/SPEC/IMPL_PLAN for the display line only

**Description:** Verifies that once `notes.md` exists, the "Completed stages" display line lists BRD, SPEC, and IMPL_PLAN as done (per spec §3f), while Step 6's *next-step* decision still correctly uses the document-presence table (TC-007) rather than treating IMPL_PLAN as truly complete.

**Preconditions:**
- Scratch trivial-tier issue with only `notes.md` present (no `test_plan.md` yet).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf`. | "Completed stages" line lists BRD, SPEC, IMPL_PLAN (all collapsed from the single `notes.md`). |
| 2 | Inspect the "Next step" line on the same output. | Reads `/pf-check` (leading to `/pf-test-plan`), **not** `/pf-execute` — confirming the collapse affects only the display line, not routing. |

**Test Data:**
- size_tier: `trivial`
- Files present: `prompt.md`, `notes.md`

**Expected Outcome:** Both facts hold simultaneously: stages shown as complete include IMPL_PLAN, yet the next step is still `/pf-test-plan`'s pre-check — proving the two mechanisms (§3d display vs. §3c routing) are correctly decoupled.

**Priority:** High

---

### TC-010: pf-test-plan still dispatches its sub-agent at trivial tier, scaled to 2-4 cases

**Description:** Verifies that for trivial tier, `/pf-test-plan` keeps using its existing sub-agent-dispatch mechanism (unlike `pf-brd`, which skips dispatch), but targets 2-4 test cases, ≤80 lines, and omits the Known Issues table, per spec §6.

**Preconditions:**
- Scratch trivial-tier issue with `notes.md` present, describing a one-line config-validation-message fix.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-test-plan`. | The skill dispatches its sub-agent (same mechanism as for other tiers), passing `size_tier: trivial` and `notes.md` as the source document (not `brd.md`/`specs.md`, which don't exist). |
| 2 | Inspect the resulting `test_plan.md`. | Contains 2-4 test cases, a Status Tracker section, and no Known Issues table. Total length is roughly ≤80 lines. |

**Test Data:**
- size_tier: `trivial`
- Source document: `notes.md`

**Expected Outcome:** `test_plan.md` exists as a standalone document (not folded into `notes.md`), sized and shaped per the trivial budget in `skills/pf-size-tiers/SKILL.md`.

**Priority:** Critical

---

### Small/Medium/Large Pipeline Scaling

### TC-011: pf-spec stops immediately for trivial tier

**Description:** Verifies `/pf-spec` refuses to produce a document for trivial-tier issues and instead points to the next real step, per spec §5.

**Preconditions:**
- Scratch trivial-tier issue with `notes.md` present.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-spec` directly against the trivial issue. | The skill stops immediately with a message equivalent to: "This is a trivial-tier issue — spec is already covered by `notes.md`. Next step: `/pf-test-plan`." No `specs.md` is created. |

**Test Data:**
- size_tier: `trivial`

**Expected Outcome:** No `specs.md` file is produced; the stop message correctly names `/pf-test-plan` as next.

**Priority:** High

---

### TC-012: pf-spec small-tier scaling — omits diagrams, targets ≤300 lines

**Description:** Verifies small-tier `specs.md` omits ASCII diagrams (unless UI/UX is involved) and targets the ≤300-line budget instead of the 1500-line split trigger, per spec §5 and the section-inclusion matrix in `pf-size-tiers`.

**Preconditions:**
- Scratch small-tier issue (non-UI feature) with `brd.md` present.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-spec`. | `specs.md` is produced without an ASCII architecture diagram (since the feature has no UI/UX component). |
| 2 | Check the document's length. | Length is targeted at ≤300 lines rather than being evaluated against the 1500-line split rule. |
| 3 | Repeat with a small-tier issue that does involve a UI component. | An ASCII diagram is included this time, per the matrix's "only if UI/UX present" rule for small tier. |

**Test Data:**
- size_tier: `small`
- Non-UI issue: "Add a config validation helper function"
- UI issue: "Add a confirmation modal before delete"

**Expected Outcome:** Diagram inclusion and length budget match the section-inclusion matrix exactly for both non-UI and UI small-tier cases.

**Priority:** High

---

### TC-013: pf-test-plan and pf-impl-plan — medium/large tiers unchanged from today's behavior

**Description:** Regression check confirming medium-tier (today's baseline) and large-tier output is unaffected by this feature, per BRD's explicit acceptance criterion that medium tier's output is unchanged.

**Preconditions:**
- Scratch medium-tier issue with `brd.md` and `specs.md` already present.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-test-plan` on the medium-tier issue. | `test_plan.md` produced with 10-20 test cases and a Known Issues table, identical in shape to pre-feature output. |
| 2 | Run `/pf-impl-plan` on the same issue. | `implementation_plan.md` includes Dependencies and Complexity Estimate sections, unchanged from today. |
| 3 | Repeat both runs on a large-tier issue with a >1500-line `specs.md`. | `specs.md` splits into 3 parts per the existing rule; `test_plan.md` allows 20+ cases; `implementation_plan.md` may include a phased-rollout section. |

**Test Data:**
- size_tier: `medium` then `large`

**Expected Outcome:** No regressions in medium-tier document shape/count; large-tier behavior matches or exceeds today's split/scope rules.

**Priority:** High

---

### Legacy Issue Handling

### TC-014: pf-impl-plan trivial stop and small-tier section omission

**Description:** Verifies `/pf-impl-plan` mirrors `pf-spec`'s trivial stop-message behavior, and that small tier omits Dependencies/Complexity Estimate and targets ≤150 lines, per spec §7.

**Preconditions:**
- One scratch trivial-tier issue with `notes.md`/`test_plan.md` present; one scratch small-tier issue with `brd.md`/`specs.md`/`test_plan.md` present.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-impl-plan` on the trivial issue. | Stops immediately: "This is a trivial-tier issue — the implementation plan is already covered by `notes.md`. Next step: `/pf-test-plan`." No `implementation_plan.md` created. |
| 2 | Run `/pf-impl-plan` on the small-tier issue. | `implementation_plan.md` is produced without "Dependencies" or "Complexity Estimate" sections, targeting ≤150 lines. |

**Test Data:**
- Trivial issue: size_tier `trivial`
- Small issue: size_tier `small`

**Expected Outcome:** Trivial issue never gets `implementation_plan.md`; small-tier document omits the two named sections and respects the line budget.

**Priority:** High

---

### pf-check Oversized Detection

### TC-015: pf-check flags an oversized notes.md as a P0 finding

**Description:** Verifies the oversized-for-tier check correctly flags a trivial-tier `notes.md` that has grown past ~50 lines, using the predecessor-resolution rule that `notes.md` has no predecessors, per spec §9a/§9b.

**Preconditions:**
- Scratch trivial-tier issue whose `notes.md` has been manually padded to ~120 lines (simulating scope creep).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-check` against `notes.md`. | The sub-agent is dispatched, reads `notes.md` and `prompt.md`'s `size_tier`, and compares against the trivial budget (~50 lines) from `skills/pf-size-tiers/SKILL.md`. |
| 2 | Inspect the findings. | A **P0** finding appears: "`notes.md` is oversized for this issue's declared tier (`trivial`): <actual> vs <budget>. Either trim the document, or re-classify the issue to a larger tier." |
| 3 | Choose "Skip and continue" in pf-check's UI. | pf-check allows skipping (advisory-only in its own UI, per §9c) — no error at this stage. |

**Test Data:**
- size_tier: `trivial`
- `notes.md` actual length: ~120 lines (budget: ~50)

**Expected Outcome:** The P0 finding is generated with the correct file/tier/actual-vs-budget wording, and "Skip and continue" remains available exactly as for any other P0 finding.

**Priority:** Critical

---

### TC-016: Downstream skill blocks when predecessor is still oversized after "Skip and continue"

**Description:** Verifies the actual enforcement mechanism: `/pf-check` never blocks by itself, but the next skill down the pipeline recomputes the same oversized check and refuses to proceed if the predecessor document is still oversized, per spec §9c.

**Preconditions:**
- Continuation of TC-015: the tester chose "Skip and continue" in `/pf-check` without trimming `notes.md` or changing the tier.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-test-plan` on the same issue. | Before dispatching its sub-agent, the skill recomputes the oversized-for-tier check against `notes.md` and finds it still oversized. |
| 2 | Observe the outcome. | The skill stops with a message such as: "`notes.md` is oversized for this issue's declared tier (`trivial`). Run `/pf-check` to review it, then either trim the document or re-classify the issue." No `test_plan.md` is produced. |
| 3 | Trim `notes.md` back under 50 lines (or change `size_tier` to `small`), then re-run `/pf-test-plan`. | The recomputed check now passes; `test_plan.md` is produced normally. |

**Test Data:**
- size_tier: `trivial` (then corrected to `small` in the alternate resolution path)

**Expected Outcome:** Blocking is observed to happen in the downstream skill's own prerequisite gate, never inside `/pf-check`'s UI — confirming the enforcement mechanism described in spec §9c, and that resolving the discrepancy (either way) unblocks progress.

**Priority:** Critical

---

### Bug-Type Tier Handling

### TC-017: Bug-issue tier confirmation happens inside /pf's analysis.md step, not pf-brd

**Description:** Verifies that for non-trivial bug-type issues, the BRD-content-based tier reconfirmation (TC-004's equivalent) is relocated to `/pf`'s own `analysis.md`-writing step, since bug issues have no `pf-brd` stage, per spec §3e.

**Preconditions:**
- Scratch bug-type issue created with `size_tier: small`, no `analysis.md` yet.
- The bug's actual root cause/blast radius, once described, is clearly larger than "small" (touches multiple subsystems).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf` and let it ask the user to describe the bug, then write `analysis.md`. | `analysis.md` is saved to the issue folder. |
| 2 | Observe the step immediately after saving. | The model re-reads `analysis.md`, judges scope (root cause complexity, blast radius, affected code paths) against `size_tier: small`, disagrees, and asks the user via `AskUserQuestion` to confirm/override, recommending its own judgment with reasoning. |
| 3 | Accept the override to `medium`. | `prompt.md`'s `size_tier` updates to `medium`. |
| 4 | Repeat steps 1-3 for a bug issue created as `size_tier: trivial`. | No `analysis.md` is written at all; `/pf-brd` produces `notes.md` directly instead (merging analysis + task list, including a `## Root Cause / Context` section per the trivial `notes.md` template), and no tier-reconfirmation step runs. |

**Test Data:**
- Non-trivial case: size_tier `small` → confirmed/overridden to `medium`.
- Trivial case: size_tier `trivial`.

**Expected Outcome:** Tier reconfirmation for bug issues occurs exactly once, inside the `analysis.md`-writing step of `/pf` (not `pf-brd`), and is correctly skipped entirely for trivial-tier bugs where `notes.md` replaces `analysis.md`.

**Priority:** High

---

### pf-execute Trivial Handling

### TC-018: pf-execute prerequisite gate branches correctly by tier

**Description:** Verifies `/pf-execute`'s prerequisite check requires `notes.md` for trivial tier and `implementation_plan.md` for small/medium/large, per spec §10a — the change that makes trivial tier usable end-to-end at all.

**Preconditions:**
- Two scratch issues: (a) trivial tier with only `notes.md` + `test_plan.md` present (no `implementation_plan.md`); (b) medium tier with `implementation_plan.md` present.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-execute` on the trivial issue. | Prerequisite check requires `notes.md` (present) — passes. Skill reads `notes.md` and `test_plan.md` ("all design and planning is complete"), not `specs.md`/`implementation_plan.md`. |
| 2 | Delete `notes.md` from the trivial issue and re-run `/pf-execute`. | Stops with: "Notes document is required. Run /pf-brd first." |
| 3 | Run `/pf-execute` on the medium issue. | Prerequisite check requires `implementation_plan.md` (present) — passes; behaves exactly as before this feature. |

**Test Data:**
- Trivial issue: `notes.md`, `test_plan.md` present; `implementation_plan.md` absent.
- Medium issue: `implementation_plan.md` present.

**Expected Outcome:** Each tier's prerequisite gate matches spec §10a exactly, and a trivial issue that previously would have dead-ended at `/pf-execute` now proceeds successfully — the core regression this section exists to prevent.

**Priority:** Critical

---

### TC-019: pf-execute parses notes.md's Tasks checklist into TaskCreate calls (trivial tier)

**Description:** Verifies `/pf-execute`'s Phase 1 task-creation step, for trivial tier, parses `notes.md`'s `## Tasks` checklist (rather than `implementation_plan.md`) into tasks, and that Phase 0's file-commit list references the trivial-tier file set, per spec §10b/§10c.

**Preconditions:**
- Scratch trivial-tier issue with `notes.md` containing a `## Tasks` section with 2 unchecked items, and `test_plan.md` present.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-execute`. | Phase 0 checks for uncommitted planning docs using the trivial-tier file list: `prompt.md`, `notes.md`, `test_plan.md` (not `brd.md`/`specs.md`/`implementation_plan.md`, which don't exist). |
| 2 | Observe Phase 1 task creation. | The skill reviews `notes.md` completely and creates one `TaskCreate` call per unchecked `- [ ] Task N — ...` line in the Tasks checklist, mapping test cases from `test_plan.md` the same way it would from `implementation_plan.md` line items. |
| 3 | Inspect resulting task count. | Two tasks are created, matching the two checklist items — coarser-grained than a typical `implementation_plan.md`-derived task list, as expected for `notes.md`'s flatter structure. |

**Test Data:**
- `notes.md` Tasks section: 2 items
- size_tier: `trivial`

**Expected Outcome:** Task creation correctly sources from `notes.md`'s checklist, and Phase 0/1/2/3 mechanics (wave grouping, sub-agent execution, commit-per-wave) otherwise behave identically to the small/medium/large path.

**Priority:** High

---

### Distribution / pf-update

### TC-020: pf-update lists pf-size-tiers as a managed skill

**Description:** Verifies `/pf-update`'s "Managed Skills" list includes the new `skills/pf-size-tiers/SKILL.md` reference file, so it is synced and reported like every other shipped skill, per spec §11.

**Preconditions:**
- A consuming project with an older Planning Framework skill set (missing `pf-size-tiers`) and access to this repository as the framework source.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `/pf-update` in the consuming project. | The skill's "Managed Skills" list output includes an entry: "`pf-size-tiers` — reference data: tier definitions and document budgets (not directly invoked)". |
| 2 | Confirm the update proceeds. | `skills/pf-size-tiers/SKILL.md` is copied into the consuming project's `skills/` directory alongside the other updated skill files. |
| 3 | Invoke `pf-size-tiers` directly (not via another skill's Read call). | Per its own body ("If invoked directly, just print the tables below"), it prints the Tiers, Document budgets, and Section-inclusion matrix tables rather than attempting any interactive workflow. |

**Test Data:**
- Consuming project: any project previously set up under Planning Framework v3.0 without `pf-size-tiers`.

**Expected Outcome:** `pf-size-tiers` is treated as a first-class managed/distributed skill, and its direct-invocation fallback behavior matches its own stated purpose.

**Priority:** Medium

---

## Status Tracker

| TC     | Test Case                                                                 | Priority | Status | Remarks |
| ------ | -------------------------------------------------------------------------- | -------- | ------ | ------- |
| TC-001 | Tier question asked at issue creation                                      | Critical | [ ]    |         |
| TC-002 | Legacy issue is classified on first pipeline-skill run                     | Critical | [ ]    |         |
| TC-003 | Legacy guard fires identically when a non-/pf skill is run first           | High     | [ ]    |         |
| TC-004 | BRD-content tier confirmation — heuristic disagrees with recorded tier     | Critical | [ ]    |         |
| TC-005 | BRD-content tier confirmation — heuristic agrees, no prompt shown          | Medium   | [ ]    |         |
| TC-006 | pf-brd on trivial tier produces notes.md directly, no sub-agent, no brd.md | Critical | [ ]    |         |
| TC-007 | Trivial-tier routing table — document-presence-keyed lookup                | Critical | [ ]    |         |
| TC-008 | Status output includes the tier                                            | Medium   | [ ]    |         |
| TC-009 | Step 5 stage detection — notes.md collapse vs. routing decoupling          | High     | [ ]    |         |
| TC-010 | pf-test-plan still dispatches its sub-agent at trivial tier, scaled counts | Critical | [ ]    |         |
| TC-011 | pf-spec stops immediately for trivial tier                                 | High     | [ ]    |         |
| TC-012 | pf-spec small-tier scaling — omits diagrams, targets ≤300 lines           | High     | [ ]    |         |
| TC-013 | pf-test-plan / pf-impl-plan — medium/large tiers unchanged                | High     | [ ]    |         |
| TC-014 | pf-impl-plan trivial stop and small-tier section omission                  | High     | [ ]    |         |
| TC-015 | pf-check flags an oversized notes.md as a P0 finding                      | Critical | [ ]    |         |
| TC-016 | Downstream skill blocks when predecessor is still oversized                | Critical | [ ]    |         |
| TC-017 | Bug-issue tier confirmation happens inside /pf's analysis.md step          | High     | [ ]    |         |
| TC-018 | pf-execute prerequisite gate branches correctly by tier                    | Critical | [ ]    |         |
| TC-019 | pf-execute parses notes.md's Tasks checklist into TaskCreate calls          | High     | [ ]    |         |
| TC-020 | pf-update lists pf-size-tiers as a managed skill                           | Medium   | [ ]    |         |

## Known Issues

| Issue | Description | TC Affected | Steps to Reproduce | Severity |
| ----- | ------------ | ------------ | -------------------- | -------- |
|       |              |              |                      |          |
