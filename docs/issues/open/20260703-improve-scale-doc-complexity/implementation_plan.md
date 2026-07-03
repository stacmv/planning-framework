## Implementation Plan: Scale Document Complexity to Task Size

### Overview

This plan implements size-tier-aware Planning Framework documentation, per `brd.md` and `specs.md`. It introduces a new `size_tier` field (trivial/small/medium/large) recorded in each issue's `prompt.md` frontmatter, a new reference skill (`skills/pf-size-tiers/SKILL.md`) that centralizes tier definitions and document budgets, and coordinated changes across the orchestrator (`pf`) and every pipeline skill (`pf-brd`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`, `pf-check`, `pf-execute`, `pf-update`) so that document length, required sections, and pipeline routing scale with the declared tier. Trivial-tier issues collapse BRD/spec/implementation-plan into a single `notes.md` written without a sub-agent, while still producing a standalone, sub-agent-authored `test_plan.md`. An oversized-for-tier check is folded into `pf-check`'s existing sub-agent, with actual enforcement happening as a recomputed prerequisite guard in each downstream skill rather than inside `pf-check` itself. None of this changes actual engineering/implementation behavior for the tasks being planned — only the shape and volume of the planning documents and the pipeline steps used to produce them.

### Files to Create/Modify

- `skills/pf-size-tiers/SKILL.md` — new reference-only skill: tier definitions, document budgets, section-inclusion matrix, `notes.md` template, bug-issue notes.
- `skills/pf/SKILL.md` — tier question at creation, legacy-tier guard, trivial-tier routing table (document-presence-keyed), status-block tier display, Step 5 stage-detection `notes.md` row, bug-issue tier reconfirmation after `analysis.md`, dedupe of the ambiguous `IMPL_PLAN` key in the three Step 6 tables.
- `skills/pf-brd/SKILL.md` — legacy-tier guard, trivial-tier condensed Q&A + direct `notes.md` write (no sub-agent, no `brd.md`), post-BRD tier reconfirmation for small/medium/large.
- `skills/pf-spec/SKILL.md` — legacy-tier guard, oversized-predecessor guard, trivial-tier immediate stop, small-tier section/length scaling.
- `skills/pf-test-plan/SKILL.md` — legacy-tier guard, oversized-predecessor guard, tier passed to sub-agent, trivial source document (`notes.md`) and scaled counts/sections, small-tier scaling.
- `skills/pf-impl-plan/SKILL.md` — legacy-tier guard, oversized-predecessor guard, trivial-tier immediate stop, small-tier section/length scaling.
- `skills/pf-check/SKILL.md` — legacy-tier guard, `notes.md` added to target/predecessor table, oversized-for-tier check folded into the sub-agent dispatch prompt, clarified blocking-enforcement note.
- `skills/pf-execute/SKILL.md` — legacy-tier guard, oversized-predecessor guard, tier-branched prerequisite gate, tier-branched Phase 0 file-commit list, tier-branched Phase 1 task-parsing source.
- `skills/pf-update/SKILL.md` — add `pf-size-tiers` to the "Managed Skills" list.
- `scripts/update-skills.sh` — reference only, not modified (already generically syncs any `skills/` subfolder containing a `SKILL.md`, so `pf-size-tiers` is picked up automatically).

### Implementation Tasks

#### Task 1: Create the `pf-size-tiers` reference skill

**Mapped Test Cases:** None directly (this is foundational reference data consumed by every other task; its content is exercised indirectly through TC-006, TC-010, TC-012, TC-013, TC-014, TC-015, TC-016, and directly inspected by TC-020's step 3).

**Files:**
- `skills/pf-size-tiers/SKILL.md` — new file, created per spec §2.

**Implementation Notes:**
- Frontmatter: `name: pf-size-tiers`, description marking it as reference data "not normally invoked directly," `version: 3.0.0`.
- Body opens with an explicit statement that this skill is reference data for other skills, and that direct invocation should just print the tables below (this literal behavior is what TC-020 step 3 checks).
- Include, verbatim per specs.md §2: the Tiers table (trivial/small/medium/large with typical scope), the Document budgets table (BRD/Spec/Impl-plan column and Test plan column), the Section-inclusion matrix (ASCII diagrams, Dependencies, Complexity Estimate, Known Issues table, Status Tracker rows), the "Bug-type issues" subsection (how `analysis.md` maps to trivial's `notes.md`, the `analysis.md` size-budget table for small/medium/large, and where tier confirmation happens for bug issues), and the `notes.md` template block (with the bug-only `## Root Cause / Context` section noted as omitted for feat/improve).
- This file has no functional prerequisites — it's a plain markdown reference doc, so it can technically be written at any point in the task sequence, but doing it first gives every other task a stable table to cite by section number instead of duplicating tier numbers inline.

**Acceptance Criteria:**
- [ ] `skills/pf-size-tiers/SKILL.md` exists with the four required table/section blocks and the "print the tables if invoked directly" instruction, ready to support TC-020 step 3.

---

#### Task 2: `pf/SKILL.md` orchestrator — tier question, legacy guard, trivial routing, status/stage-detection updates

**Mapped Test Cases:** TC-001, TC-002, TC-007, TC-008, TC-009, TC-017

**Files:**
- `skills/pf/SKILL.md` — modify "Creating prompt.md", Step 5, Step 6 (all three workflow tables plus a new trivial-tier table), Step 7's status block.

**Implementation Notes:**
- **3a (TC-001):** In "Creating prompt.md", add a second `AskUserQuestion` immediately after the `doc_language` question: "How big is this task?" with the four tier options and their one-line descriptions (sourced from Task 1's tiers table), recommending medium by default ("today's standard full pipeline — pick this if unsure"). Record the answer as `size_tier` in `prompt.md`'s frontmatter, next to `doc_language`.
- **3b (TC-002):** Before Step 5, add the legacy-tier check: if the active issue's `prompt.md` has no `size_tier` field, ask the same tier question, then write the answer back into `prompt.md`'s frontmatter before continuing to Step 5. Must not re-ask once `size_tier` is present (verified by TC-002 step 3).
- **3c (TC-007, TC-009):** Add a fourth, trivial-tier-only routing table alongside the feat/improve/bug tables: `CREATE → /pf-brd (produces notes.md) → /pf-check → /pf-test-plan → /pf-check → /pf-execute`. This table is **keyed on which documents exist in the issue folder** (`notes.md` absent → `/pf-brd`; `notes.md` present, `test_plan.md` absent → `/pf-check` then `/pf-test-plan` once passed; both present → `/pf-check` then `/pf-execute` once passed), not on "last completed stage" — this is the mechanism TC-007 verifies end-to-end and TC-009 verifies is decoupled from the Step 5 display line. `/pf-spec` and `/pf-impl-plan` must never appear as a next step when `size_tier: trivial`.
- **3d (TC-008):** Update the printed status block's "Active issue" line to `Active issue: <ISSUE-ID>  (type: feat/improve/bug, tier: trivial/small/medium/large)`.
- **3f (TC-009):** Add a row to Step 5's stage-detection table: `notes.md` present → BRD, SPEC, IMPL_PLAN (and ANALYSIS, for bug-type) all completed at once. This affects only the "Completed stages" display line — Step 6's next-step decision for trivial tier always uses the 3c document-presence table instead, which is precisely what TC-009 checks (stages show IMPL_PLAN done, but next step is still `/pf-check`→`/pf-test-plan`, not `/pf-execute`).
- **3e (TC-017):** In Step 6's bug workflow, "CREATE only (no analysis.md)" row: after saving `analysis.md`, add a step that re-reads it and holistically judges whether its actual scope (root cause complexity, blast radius, affected code paths) matches the recorded `size_tier`; if it disagrees, ask via `AskUserQuestion` (recommend the model's judgment with reasoning) to confirm/override, then update `prompt.md`'s `size_tier` if changed. Skip this entirely when `size_tier: trivial` (no standalone `analysis.md` is written at trivial tier for bug issues either — `/pf-brd` produces `notes.md` directly, per Task 3).
- **3g (no dedicated TC, but must not regress TC-007/TC-009):** In all three Step 6 workflow tables (feat, improve, bug), delete the dead `| IMPL_PLAN | /pf-test |` row — it shares its lookup key with the `IMPL_PLAN | /pf-check` (or `/pf-execute`) row and can never be reached; `/pf-execute`'s own completion summary already tells the user to run `/pf-test` next.
- **3h (precedence rule, TC-017):** State explicitly in Step 6 that `size_tier` must be read and checked **before** selecting any type-specific (feat/improve/bug) workflow table. If `size_tier: trivial`, the 3c trivial routing table applies exclusively, regardless of issue type — this is not merely "skip the 3e reconfirmation sub-step," it means the entire bug workflow's "CREATE only (no analysis.md)" action (asking the user to describe the bug and writing `analysis.md`) is bypassed too. A trivial-tier bug issue never gets an `analysis.md`; it goes straight to `/pf-brd`, which produces `notes.md` (including the bug-only `## Root Cause / Context` section) per Task 3's handling. Tier-check-before-type-routing is the precedence rule this sub-step makes explicit; 3e's skip is one consequence of it, not the whole rule.
- Order within this task: implement 3f/3g/3h (table edits and precedence rule) before 3c (new trivial table) since 3c's explanatory text directly references the 3f row and the "Note on 'check passed'" convention at the end of Step 6 — keeping them in the same edit pass avoids inconsistency.

**Acceptance Criteria:**
- [ ] TC-001 passes
- [ ] TC-002 passes
- [ ] TC-007 passes
- [ ] TC-008 passes
- [ ] TC-009 passes
- [ ] TC-017 passes, specifically confirming (per 3h) that a **trivial-tier bug issue** never triggers the bug workflow's CREATE-only action (no user prompt to describe the bug, no `analysis.md` written) and is routed via the 3c trivial table (`/pf-brd` → `notes.md`) instead — this is the tier-before-type bypass check, distinct from TC-017's other steps which cover non-trivial-tier reconfirmation.

---

#### Task 3: `pf-brd/SKILL.md` — trivial-tier `notes.md` path and BRD tier reconfirmation

**Mapped Test Cases:** TC-004, TC-005, TC-006

**Files:**
- `skills/pf-brd/SKILL.md` — modify the opening prerequisite section and the BRD-writing flow.

**Implementation Notes:**
- Add the shared legacy-tier guard (spec §8, verbatim): before any other prerequisite check, read `prompt.md`'s frontmatter; if `size_tier` is absent, ask the tier question (recommend medium, "matches today's default behavior"), then write the answer back before proceeding.
- Read `size_tier` after the guard.
- **If `trivial` (TC-006):** run a condensed version of the same clarifying-questions loop (same 95%-confidence bar, same recommendation-with-reason pattern, just shorter), then write `docs/issues/open/[ISSUE-ID]/notes.md` directly using Task 1's template — no sub-agent dispatch (this skill never dispatched one anyway), and never create `brd.md`. Update the top-of-skill stop-condition check to: if `notes.md` OR `brd.md` already exists, stage is complete.
- **If small/medium/large (TC-004, TC-005):** existing Q&A flow is unchanged. After saving `brd.md`, add a post-save step: re-read `brd.md` and holistically judge whether its actual scope (user stories, acceptance criteria, business-rule complexity) matches the recorded `size_tier`. If the judgment disagrees (TC-004), ask via `AskUserQuestion` (recommend the model's own judgment with reasoning) to confirm/override, then update `prompt.md`'s `size_tier` if changed. If the judgment agrees (TC-005), show no extra prompt at all — this must be a true no-op, not a confirmation shown with the same answer pre-selected.
- This confirmation never applies to trivial tier (there's no `brd.md` to re-derive from) — explicitly guard against running it in the trivial branch.

**Acceptance Criteria:**
- [ ] TC-004 passes
- [ ] TC-005 passes
- [ ] TC-006 passes

---

#### Task 4: `pf-spec/SKILL.md` — legacy guard, trivial stop, small-tier scaling

**Mapped Test Cases:** TC-003, TC-011, TC-012

**Files:**
- `skills/pf-spec/SKILL.md` — modify the opening prerequisite section and the drafting instructions.

**Implementation Notes:**
- Add the shared legacy-tier guard (spec §8) before the existing `brd.md`-exists check. This is the specific guard instance TC-003 exercises directly against `/pf-spec` — verify the guard fires even when `brd.md` already exists (i.e., the tier question happens strictly before the `brd.md` prerequisite check, not after).
- Add the oversized-predecessor guard (spec §9c): before writing `specs.md`, recompute the oversized-for-tier check against `brd.md`.
- **Implementation-level gap closure (resolves a specs.md gap, decided here, not by editing specs.md):** specs.md's document-budgets table (§2) and its oversized-check table (§9b) define a line/case budget for `notes.md`, `specs.md`, `implementation_plan.md`, `analysis.md`, and `test_plan.md`, but **never for `brd.md` itself**. As specified, this guard's recompute against `brd.md` would have nothing to compare against and would be a permanent no-op — it could never block anything, regardless of how oversized `brd.md` actually is. specs.md's §9c design already establishes that each downstream skill "independently recomputes" its own oversized check rather than relying on a shared, persisted result, so it is consistent with that design for this guard's budget line to live only in `pf-spec/SKILL.md` itself. This plan adopts, at the implementation level: **`brd.md` small-tier budget ≤300 lines** (mirroring `analysis.md`'s small-tier budget of ≤300 lines from specs.md §2, since `brd.md` plays the same "first substantive planning document" role for feat/improve issues that `analysis.md` plays for bug issues), and **medium/large: no explicit cap**, unchanged from today's shape (consistent with how every other document type is treated at those tiers). This is a decision made at the implementation-plan level to close a gap left open in specs.md, not a change to specs.md itself.
- Read `size_tier`. **If `trivial` (TC-011):** stop immediately with: "This is a trivial-tier issue — spec is already covered by `notes.md`. Next step: `/pf-test-plan`." Do not create `specs.md`.
- **If `small` (TC-012):** when writing `specs.md`, omit ASCII diagrams unless the issue involves UI/UX (per Task 1's section-inclusion matrix); target ≤300 lines instead of applying the existing 1500-line split trigger.
- **If medium/large:** unchanged from today, including the existing >1500-line → 3-part split rule.

**Acceptance Criteria:**
- [ ] TC-003 passes
- [ ] TC-011 passes
- [ ] TC-012 passes
- [ ] Verify: pf-spec's oversized-predecessor guard blocks proceeding (with a message naming `brd.md`, the tier, and pointing at `/pf-check`) when `brd.md` exceeds the ≤300-line small-tier budget adopted above. No existing TC-NNN covers this specific guard instance — TC-016 covers pf-test-plan's guard against `notes.md`; this is a local verification step for this task only.

---

#### Task 5: `pf-test-plan/SKILL.md` — trivial source document, tier-scaled counts, oversized-predecessor guard

**Mapped Test Cases:** TC-010, TC-013 (shared with Task 6 — TC-013 exercises both `pf-test-plan` and `pf-impl-plan` in the same scenario), TC-016

**Files:**
- `skills/pf-test-plan/SKILL.md` — modify the prerequisite section and the sub-agent dispatch instructions.

**Implementation Notes:**
- Add the shared legacy-tier guard (spec §8).
- Add the oversized-predecessor guard (spec §9c): before dispatching the sub-agent, recompute the oversized-for-tier check against the predecessor(s) — `notes.md` for trivial, `specs.md` (and `brd.md`) otherwise. If oversized, stop with a message naming the offending file, the tier, and pointing at `/pf-check` — this exact stop-and-block behavior is what TC-016 verifies (continuation of TC-015's "Skip and continue" path in `pf-check`).
- **Mechanical-count clarification (resolves apparent conflict with "do not read documents yourself"):** this skill's existing text tells the orchestrator not to read `brd.md`/`specs.md`/`analysis.md` or draft the plan itself — that work is dispatched to a sub-agent. The oversized-predecessor guard above must run *before* that dispatch, which looks like it requires the orchestrator to read the predecessor after all. Resolve this explicitly: the orchestrator performs only a lightweight **mechanical count** to run the guard — e.g. `wc -l` on `notes.md`/`specs.md`/`brd.md` for a line count — not a full semantic `Read` of the document's content. This preserves the context-saving intent (no full document ingestion by the orchestrator itself) while still letting the guard function; the sub-agent, once dispatched, still does the actual full reading and drafting as today.
- Read `size_tier` and pass it through to the dispatched sub-agent — the sub-agent-dispatch mechanism itself is unchanged at every tier (TC-010 explicitly checks the sub-agent still runs for trivial).
- **If `trivial` (TC-010):** source document passed to the sub-agent is `notes.md` (not `brd.md`/`specs.md`, which don't exist for trivial issues). Target 2-4 test cases, ≤80 lines total, omit the Known Issues table (keep the Status Tracker section).
- **If `small`:** target 5-10 test cases, Known Issues table omitted.
- **If medium/large (TC-013, shared with Task 6):** unchanged — 10-20 test cases typical for medium, 20+ allowed for large, Known Issues table included, no regression from current behavior.

**Acceptance Criteria:**
- [ ] TC-010 passes
- [ ] TC-013 passes (test-plan portion: medium/large counts and Known Issues table unchanged)
- [ ] TC-016 passes
- [ ] Verify: small-tier `pf-test-plan` output has 5-10 test cases and omits the Known Issues table (keeping the Status Tracker). No existing TC-NNN covers small-tier specifically — TC-010 covers trivial and TC-013 covers medium/large — so this is a local verification step for this task only.

---

#### Task 6: `pf-impl-plan/SKILL.md` — trivial stop, small-tier omissions, oversized-predecessor guard

**Mapped Test Cases:** TC-013 (shared with Task 5), TC-014

**Files:**
- `skills/pf-impl-plan/SKILL.md` — modify the prerequisite section and the sub-agent task instructions.

**Implementation Notes:**
- Add the shared legacy-tier guard (spec §8).
- Add the oversized-predecessor guard (spec §9c): before writing `implementation_plan.md`, recompute the oversized-for-tier check against `test_plan.md` (and `specs.md`/`brd.md` where applicable).
- **Mechanical-count clarification (resolves apparent conflict with "do not read documents yourself"):** this skill's existing text tells the orchestrator not to read `brd.md`/`specs.md`/`test_plan.md` or draft the plan itself — that work is dispatched to a sub-agent. As with Task 5, the guard above must run before that dispatch. Resolve this explicitly: the orchestrator performs only a lightweight mechanical count for the guard — e.g. `wc -l` on `test_plan.md`/`specs.md`/`brd.md`, or counting `### TC-` headings in `test_plan.md` — not a full semantic `Read`. This preserves the context-saving intent while letting the guard function; the sub-agent still does the actual full reading and drafting once dispatched.
- Read `size_tier`. **If `trivial` (TC-014):** stop immediately with: "This is a trivial-tier issue — the implementation plan is already covered by `notes.md`. Next step: `/pf-test-plan`." Do not create `implementation_plan.md`.
- **If `small` (TC-014):** omit the "Dependencies" and "Complexity Estimate" sections from the template passed to the sub-agent; target ≤150 lines.
- **If medium/large (TC-013, shared with Task 5):** unchanged from today — Dependencies and Complexity Estimate sections present, no line-count cap besides the existing behavior, large tier may include a phased-rollout section.

**Acceptance Criteria:**
- [ ] TC-013 passes (impl-plan portion: medium/large Dependencies/Complexity Estimate sections unchanged, large tier's phased-rollout allowance)
- [ ] TC-014 passes
- [ ] Verify: pf-impl-plan's oversized-predecessor guard blocks proceeding (with a message naming the offending file, the tier, and pointing at `/pf-check`) when `test_plan.md` exceeds its tier's case-count budget from specs.md §9b (trivial >4 cases, small >10 cases, medium >20 cases). This mirrors TC-016's scenario but for this skill's own guard instance — no existing TC-NNN covers pf-impl-plan's guard specifically, so this is a local verification step for this task only.

---

#### Task 7: `pf-check/SKILL.md` — `notes.md` support and oversized-for-tier check

**Mapped Test Cases:** TC-015

**Files:**
- `skills/pf-check/SKILL.md` — modify the opening target/predecessor table and the sub-agent dispatch prompt.

**Implementation Notes:**
- Add the shared legacy-tier guard (spec §8).
- Extend the opening target/predecessor table (§9a): `notes.md` has no predecessors (first document produced for a trivial issue); `test_plan.md`'s predecessor is `notes.md` when `size_tier: trivial` (instead of `brd.md`/`specs.md`, which apply only at small/medium/large).
- Fold the oversized-for-tier check into the existing single sub-agent dispatch (§9b) — do **not** add a second orchestrator-side counting mechanism (this deliberately keeps "Do not read these documents yourself" true for the orchestrator). Append to the dispatch prompt: read `prompt.md`'s `size_tier` (default medium if absent) and `skills/pf-size-tiers/SKILL.md`'s document-budgets table; compare the TARGET document's actual size against its tier's budget (`notes.md` >~50 lines; `specs.md` small >~300 lines, medium/large >1500 lines unsplit; `implementation_plan.md` small >~150 lines; `analysis.md` small >~300 lines; `test_plan.md` trivial >4 cases, small >10 cases, medium >20 cases). If exceeded, emit a **P0** finding with the literal wording from spec §9b (file, tier, actual vs. budget, and the two resolution options).
- Clarify (§9c, doc-only, no behavior change to the UI): pf-check's own "Fix now" / "I'll fix manually" / "Skip and continue" options are unchanged and the oversized-for-tier finding flows through them exactly like any other P0/P1 finding — this is what TC-015 step 3 checks (skip remains available, no special-cased blocking inside pf-check itself).

**Acceptance Criteria:**
- [ ] TC-015 passes

---

#### Task 8: `pf-execute/SKILL.md` — tier-branched prerequisite gate, file list, and task parsing

**Mapped Test Cases:** TC-018, TC-019

**Files:**
- `skills/pf-execute/SKILL.md` — modify the opening prerequisite line, Phase 0 step 2, and Phase 1's "Before Creating Tasks" / "Create Tasks from Implementation Plan" sections.

**Implementation Notes:**
- Add the shared legacy-tier guard (spec §8).
- Add the oversized-predecessor guard (spec §9c): before creating tasks, recompute the oversized-for-tier check against `notes.md` (trivial) or `implementation_plan.md` (small/medium/large).
- **Mechanical-count clarification (same resolution pattern as Tasks 5/6):** `pf-execute` does read `implementation_plan.md`/`specs.md`/`test_plan.md` itself today (unlike `pf-test-plan`/`pf-impl-plan`, it has no sub-agent-dispatch step for planning-document ingestion), so there is no literal "do not read yourself" text to conflict with here. Even so, for consistency with Tasks 5/6 and to keep the guard cheap to run before the full prerequisite read happens, the guard itself performs only a lightweight mechanical count (e.g. `wc -l` on `notes.md`/`implementation_plan.md`) rather than a full semantic read, as its own first action — the subsequent "Read `implementation_plan.md`, `specs.md` (if present), and `test_plan.md`. All design and planning is complete." step (only reached once the guard passes) is unaffected and still does the full read as today.
- **10a (TC-018):** Replace the opening prerequisite line. Read `size_tier` from `prompt.md`'s frontmatter first, then branch: if `trivial`, require `notes.md` (stop with "Notes document is required. Run /pf-brd first." if missing); otherwise (small/medium/large, or absent — legacy guard already resolved that case) require `implementation_plan.md` (unchanged stop message). Likewise branch the following "Read ... All design and planning is complete" sentence: for trivial, read `notes.md` and `test_plan.md`; otherwise read `implementation_plan.md`, `specs.md` (if present), and `test_plan.md` as today.
- **10b (TC-019 step 1):** Replace Phase 0 step 2's parenthetical file list with tier-branched wording: for trivial, `prompt.md`, `notes.md`, `test_plan.md`; for small/medium/large, `prompt.md`, `brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md`. The `git status`/`git add`/`git commit` instructions immediately after remain unchanged (they operate on the whole issue folder regardless of tier).
- **10c (TC-019 steps 2-3):** Branch Phase 1's "Before Creating Tasks" step 1 and "Create Tasks from Implementation Plan": for trivial, review `notes.md` completely and parse its `## Tasks` checklist, creating one `TaskCreate` call per unchecked `- [ ] Task N — ...` line (same per-task fields: description, mapped test cases from `test_plan.md`, `blocked_by`/`blocks`); for small/medium/large, review `implementation_plan.md` and parse it exactly as today. Leave Phase 2/3 (wave grouping, sub-agent execution, commit-per-wave discipline) entirely unchanged — only the source document and per-line-item granularity differ by tier.

**Acceptance Criteria:**
- [ ] TC-018 passes
- [ ] TC-019 passes
- [ ] Verify: pf-execute's oversized-predecessor guard blocks proceeding (with a message naming the offending file, the tier, and pointing at `/pf-check`) when `notes.md` (trivial, >~50 lines) or `implementation_plan.md` (small tier, >~150 lines) is still oversized for the recorded tier. No existing TC-NNN covers this guard instance — TC-016 covers pf-test-plan's guard against `notes.md`, and TC-018/TC-019 cover the prerequisite-*existence* gate, not the oversized-*size* gate — so this is a local verification step for this task only.

---

#### Task 9: `pf-update/SKILL.md` — list `pf-size-tiers` as a managed skill

**Mapped Test Cases:** TC-020

**Files:**
- `skills/pf-update/SKILL.md` — modify the "Managed Skills" list.

**Implementation Notes:**
- Add a bullet to the "Managed Skills" list: "`pf-size-tiers` — reference data: tier definitions and document budgets (not directly invoked)" — matching the exact wording specs.md §11 gives.
- No change needed to `scripts/update-skills.sh`: it already walks every subdirectory of `skills/` containing a `SKILL.md` and copies/diffs it generically, so `skills/pf-size-tiers/` (created in Task 1) is picked up automatically without script changes — this task only needs to make `/pf-update`'s own listed-skills output mention it, per spec §0's bookkeeping-not-new-scope framing.
- Depends on Task 1 existing (so the description text and the skill itself are consistent) but requires no code coordination since `update-skills.sh` needs no edits.

**Acceptance Criteria:**
- [ ] TC-020 passes

---

### Dependencies

- **Task 1 (`pf-size-tiers`) should be done first**, even though these are markdown edits with no compile-time import ordering: every other task's text either cites its tables by name/section or literally reproduces the tier options, and doing Task 1 first avoids having to backfill consistent tier descriptions across 8 files afterward.
- **Task 2 (`pf` orchestrator) next**, since its "Creating prompt.md" tier question (§3a) and legacy guard (§3b) establish the `size_tier` frontmatter contract that every other skill's own legacy guard (§8) mirrors — implementing it first gives a concrete reference example to copy into Tasks 3-8's guards, reducing drift between the six near-identical guard instances.
- **Tasks 3-6 (`pf-brd`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`) can proceed in parallel** once Tasks 1-2 land — they don't depend on each other's text, only on the shared reference tables and the legacy-guard pattern. Recommended order if done sequentially in one session: `pf-brd` → `pf-spec` → `pf-test-plan` → `pf-impl-plan`, mirroring the pipeline's natural document order, since it's easier to reason about `notes.md`'s shape (Task 3) before writing the guards in later skills that reference `notes.md` as a predecessor (Tasks 5, 8).
- **Task 7 (`pf-check`) depends conceptually on Tasks 3-6** being done (or at least designed) first, since its oversized-for-tier check dispatch prompt cites the exact budget figures and predecessor relationships those tasks establish (`notes.md`, small-tier `specs.md`/`implementation_plan.md` caps). It has no hard file dependency, but doing it last among the "document-producing" skills avoids restating budget numbers that might otherwise drift from Task 1's table.
- **Task 8 (`pf-execute`) depends on Task 3** (needs `notes.md`'s `## Tasks` checklist format to be settled) and **Task 6** (needs to know what `implementation_plan.md` looks like at each tier is unchanged) before its Phase 1 branching text can be written with confidence.
- **Task 9 (`pf-update`) depends only on Task 1** (the skill it's listing must exist) and can be done any time after Task 1, independent of Tasks 2-8.
- No external/runtime dependencies: this entire feature is markdown-only changes to skill instruction files; there is no code to build, no package to install, and `scripts/update-skills.sh` requires no modification since it already generically discovers any `skills/*/SKILL.md`.

### Complexity Estimate

**Complex: 9 tasks across 9 files with cross-cutting behavior.** Every task after Task 1 touches a different skill file, but several (Tasks 5/6, and to a lesser extent Task 2's internal 3a-3g sub-steps) have literal cross-references to each other's exact wording and shared conventions (the legacy-tier guard text, the oversized-for-tier budget table, the document-presence-vs-stage-collapse distinction in the orchestrator). This is not "9 independent one-line edits" — it's 9 coordinated edits that must stay mutually consistent, which is why this lands as Complex rather than Medium despite each individual file's diff being modest in size.
