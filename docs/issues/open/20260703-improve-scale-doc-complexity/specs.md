# Technical Spec: Scale Document Complexity to Task Size

Based on `brd.md`. Covers the concrete changes needed across the skill files to implement size-tier-aware documentation.

## 0. Scope expansion beyond `prompt.md`'s stated Scope section

`prompt.md`'s Scope section lists only `pf-brd`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`, `pf-check`, and the `pf` orchestrator. This spec additionally touches `skills/pf-execute/SKILL.md` (§10) and `skills/pf-update/SKILL.md` (§11). This is not optional scope creep:

- **`pf-execute` (§10) is required, not optional.** `pf-execute`'s prerequisite gate currently requires `implementation_plan.md` to exist. Trivial-tier issues never produce `implementation_plan.md` — they produce `notes.md` instead (§2, §4). Without updating `pf-execute`, a trivial-tier issue would complete CREATE → BRD → TEST_PLAN via the quick pipeline and then dead-end at the execute step with no way to proceed at all. Trivial tier would be unusable end-to-end, defeating the point of this issue.
- **`pf-update` (§11) is a required bookkeeping consequence**, not new scope in its own right: §2 introduces a new skill file (`skills/pf-size-tiers/SKILL.md`), and `pf-update`'s existing "Managed Skills" list needs to know about it so `/pf-update` reports it correctly, the same way every other shipped skill is listed there today.

## 1. Architecture Overview

```
                    ┌─────────────────────────────┐
                    │ skills/pf-size-tiers/        │
                    │   SKILL.md  (reference data) │
                    │   - tier definitions          │
                    │   - per-tier document budgets │
                    │   - section-inclusion matrix  │
                    └───────────────┬───────────────┘
                                    │ Read()'d by every skill below
        ┌───────────────┬──────────┼───────────┬───────────────┬─────────────┐
        ▼               ▼          ▼           ▼               ▼             ▼
     pf/SKILL.md     pf-brd     pf-spec   pf-test-plan   pf-impl-plan    pf-check
   (orchestrator,   (tier Q,   (tier-    (tier-scaled   (tier-scaled,   (oversized-
    tier question,   notes.md   scaled    test count,    skipped for     doc check,
    trivial routing) for        sections)  sub-agent      trivial)       blocking)
                     trivial)                still runs)
                                                                              │
                                                                              ▼
                                                                         pf-execute
                                                                    (reads notes.md
                                                                     task list when
                                                                     tier=trivial)
```

`prompt.md` frontmatter gains a new field, sitting next to the existing `doc_language` field:

```yaml
---
doc_language: English
size_tier: trivial | small | medium | large
---
```

## 2. New file: `skills/pf-size-tiers/SKILL.md`

A reference-only pseudo-skill. It is discoverable like any other skill (so `update-skills.sh` syncs it and `/pf-update`'s Managed Skills list includes it), but its own body tells the model it exists to be read by other skills, not run standalone.

```markdown
---
name: pf-size-tiers
description: Reference data — size-tier definitions and document budgets, read by other pf-* skills. Not normally invoked directly.
version: 3.0.0
---

This skill is reference data for other Planning Framework skills. It is not meant
to be run directly. If invoked directly, just print the tables below.

## Tiers

| Tier    | Typical scope                                             |
|---------|-------------------------------------------------------------|
| trivial | One-liner or single obvious fix. 1 user story, ≤3 ACs.       |
| small   | Single focused change, clearly bounded. 2-3 user stories.    |
| medium  | Today's framework default. 4-6 user stories.                 |
| large   | Multi-subsystem or 7+ user stories.                           |

## Document budgets

| Tier    | BRD/Spec/Impl-plan                                   | Test plan                          |
|---------|-------------------------------------------------------|-------------------------------------|
| trivial | Replaced by single `notes.md`, target ≤50 lines total  | 2-4 test cases, ≤80 lines, no Known Issues table |
| small   | 3 separate docs, condensed: specs.md ≤300 lines, implementation_plan.md ≤150 lines | 5-10 test cases |
| medium  | 3 separate docs, today's existing shape (no explicit cap besides the existing >1500-line specs.md split rule) | 10-20 test cases (today's default) |
| large   | Same as medium, plus: specs.md >1500 lines splits into 3 parts (existing rule); implementation_plan.md may include a phased-rollout section | 20+ test cases allowed |

## Section-inclusion matrix

| Section                                  | trivial | small | medium | large |
|-------------------------------------------|:---:|:---:|:---:|:---:|
| ASCII diagrams (specs.md)                  | —   | only if UI/UX present | if UI/UX present | if UI/UX present |
| Dependencies (implementation_plan.md)      | —   | —   | ✓   | ✓   |
| Complexity Estimate (implementation_plan.md) | —  | —   | ✓   | ✓   |
| Known Issues table (test_plan.md)          | —   | —   | ✓   | ✓   |
| Status Tracker (test_plan.md)              | ✓   | ✓   | ✓   | ✓   |

`—` means omit the section entirely rather than leaving it blank/stubbed.

## Bug-type issues

`analysis.md` plays the role of `brd.md`+`specs.md` for bug issues (no separate spec stage exists today). At trivial tier, `notes.md` merges `analysis.md` + `implementation_plan.md` content (root cause/repro + a short task list). `test_plan.md` stays separate at every tier, same as feat/improve.

### `analysis.md` size budget (small/medium/large tiers)

| Tier   | `analysis.md` budget                                                  |
|--------|-------------------------------------------------------------------------|
| small  | ≤300 lines (mirrors specs.md's small-tier cap)                          |
| medium | today's existing shape, no explicit cap                                 |
| large  | same as medium, no explicit cap                                         |

(Trivial tier has no standalone `analysis.md` — it's folded into `notes.md`, see above and §3e.)

### Tier confirmation for bug issues (where it happens)

Bug issues have no `pf-brd` step — `analysis.md` is written directly by `/pf` itself (see `pf/SKILL.md` Step 6, bug workflow, "CREATE only" row). So the tier-confirmation-after-content step (the same holistic re-check that §4 describes `pf-brd` performing on `brd.md` for feat/improve) happens inside `/pf`'s own `analysis.md`-writing step instead — see §3e for the literal instruction added to `pf/SKILL.md`. This does not apply when `size_tier: trivial` (no standalone `analysis.md` is written in that case — `/pf-brd` produces `notes.md` directly instead, per §3c, including for bug-type issues).

## `notes.md` template (trivial tier only, all issue types)

    # Notes: [Issue Title]

    ## What & Why
    [1-3 sentences]

    ## Acceptance Criteria
    - [ ] ...
    - [ ] ...

    ## Root Cause / Context
    [Bug issues only — what's broken and why. Omit this section for feat/improve issues.]

    ## Tasks
    - [ ] Task 1 — [file(s), 1-line description]
    - [ ] Task 2 — [file(s), 1-line description]

Target: under ~50 lines total. Written directly by whichever skill produces it — no sub-agent dispatch.
```

## 3. Changes to `skills/pf/SKILL.md` (orchestrator)

### 3a. Tier question at issue creation

In "Creating prompt.md", add a second `AskUserQuestion` immediately after the existing doc-language question:

> "How big is this task?" with options **trivial** / **small** / **medium** / **large**, each showing the one-line description from the tier table above, recommending **medium** by default ("today's standard full pipeline — pick this if unsure").

Record the answer as `size_tier` in `prompt.md` frontmatter, next to `doc_language`.

### 3b. Legacy issues (no `size_tier` field)

Before Step 5 (detect completed stages), add: if the active issue's `prompt.md` lacks a `size_tier` field, ask the same tier question as 3a, then write the answer back into `prompt.md`'s frontmatter before continuing. (This mirrors the guard added to every other pipeline skill — see §8 below — so the tier gets set regardless of which skill the user runs first.)

### 3c. Trivial-tier routing

Add a trivial-tier routing table alongside the existing feat/improve/bug tables:

```
CREATE → /pf-brd (produces notes.md) → /pf-check → /pf-test-plan → /pf-check → /pf-execute
```

This replaces the feat/improve/bug-specific BRD→SPEC→IMPL_PLAN chain whenever `size_tier: trivial`, regardless of issue type. `/pf-spec` and `/pf-impl-plan` are never listed as a "next step" for a trivial issue.

**This flow needs its own Step-6 lookup table, keyed on document presence rather than on collapsed stage name.** The three existing workflow tables (feat/improve/bug) are keyed on "last completed stage," and §3f makes `notes.md` collapse to BRD+SPEC+IMPL_PLAN (+ANALYSIS) all at once for the *completed-stages display line* in §3d/Step 7. If the trivial table were keyed the same way, "last completed stage" would read as IMPL_PLAN as soon as only `notes.md` exists, which would incorrectly route straight to `/pf-check → /pf-execute` and skip `/pf-test-plan` entirely — the opposite of the flow above. To avoid that, key the trivial table on which documents actually exist in the issue folder, not on the collapsed stage name. Reuse the existing "Note on 'check passed'" convention at the end of Step 6 (if the next document in sequence is already present, treat the check as having passed) rather than deriving a new one just for trivial:

| `size_tier: trivial` — documents present | Next step |
|---|---|
| `notes.md` does not exist yet | `/pf-brd` |
| `notes.md` exists, `test_plan.md` does not | `/pf-check` (before `test_plan.md` exists), then `/pf-test-plan` (once check passed, per the existing "check passed" convention) |
| `notes.md` + `test_plan.md` both exist | `/pf-check` (before executing), then `/pf-execute` (once check passed) |

Completed-stage detection (Step 5, via §3f) still treats `notes.md` as satisfying BRD, SPEC, IMPL_PLAN (and ANALYSIS, for bug-type) all at once — but only for the **completed-stages display line** in the printed status block (§3d). Step 6's next-step decision for `size_tier: trivial` always uses the document-presence table above instead of the generic "last completed stage" lookup the other three tables use, precisely so the BRD/SPEC/IMPL_PLAN collapse doesn't cause `/pf-test-plan` to be skipped.

### 3d. Status output

Add the tier to the printed status block:

```
Planning Framework v<VERSION>
Active issue: <ISSUE-ID>  (type: feat/improve/bug, tier: trivial/small/medium/large)
Completed stages: <STAGE1>, <STAGE2>, ...
Next step: /<next-command>
```

### 3e. Tier confirmation for bug issues (writing `analysis.md`)

In Step 6's bug workflow table, the "CREATE only (no analysis.md)" row's instruction — "Ask the user to describe the bug, then write `analysis.md` ... to the issue folder" — gains a step immediately after saving `analysis.md`: re-read it and holistically judge whether its actual scope (root cause complexity, blast radius, number of affected code paths) matches the recorded `size_tier`. If the model's judgment disagrees, ask the user via `AskUserQuestion` (recommend the model's judgment with reasoning) to confirm or override, then update `prompt.md`'s `size_tier` if changed. This exactly mirrors §4's confirmation step for `pf-brd`'s BRD-writing branch — it's relocated here because bug issues skip the BRD stage entirely, so there is no `pf-brd` invocation to do it during. Skip this for `size_tier: trivial`: no standalone `analysis.md` is written at trivial tier — `/pf-brd` produces `notes.md` directly instead (§3c applies to bug-type issues too).

### 3f. Step 5 stage-detection table: add `notes.md` row

Add a row to Step 5's document-presence table:

| Document present | Stage completed |
|---|---|
| `notes.md` | BRD, SPEC, IMPL_PLAN (and ANALYSIS, for bug-type) — all at once |

This is the literal table form of §3c's existing prose ("Completed-stage detection (Step 5) treats `notes.md` as satisfying BRD, SPEC, IMPL_PLAN ... all at once"); §3c described the behavior, this adds the corresponding row to the table the skill actually scans against.

### 3g. Resolve the duplicate-key ambiguity in Step 6's tables

Today's feat/improve/bug workflow tables in Step 6 each contain two rows keyed by the identical bare string `IMPL_PLAN`:

```
| IMPL_PLAN | `/pf-check` |            (or `/pf-execute` for improve/bug, where no post-impl-plan check exists)
| IMPL_PLAN + check passed | `/pf-execute` |
| IMPL_PLAN | `/pf-test` |
```

This is a pre-existing ambiguity, not introduced by this spec, but it must be resolved rather than compounded now that a third tier-dependent axis (notes.md-satisfies-everything) is being added to the same table. The last row (`IMPL_PLAN | /pf-test`) is dead/unreachable as written: it has the same lookup key as the first row, so it can never be distinguished from it by document presence alone — there is no document in the issue folder that marks "code has been executed." Resolve it by deleting that row from all three workflow tables (feat, improve, bug). It is redundant, not lost information: `/pf-execute`'s own completion (its Phase 3 "Ready for Testing" summary, and its existing "Do NOT run full test suite — that's the next step" note) is what already tells the user to run `/pf-test` next, independent of Step 5's stage-detection table. Step 5 does not need a row to represent that transition.

## 4. Changes to `skills/pf-brd/SKILL.md`

- Add the legacy-tier guard (§8).
- Read `size_tier` from `prompt.md`.
- **If `size_tier: trivial`:** instead of the existing BRD Q&A flow, run a condensed version of the same clarifying-questions loop (same 95%-confidence bar, same recommendation-with-reason pattern), then write `docs/issues/open/[ISSUE-ID]/notes.md` directly using the template in §2 (no sub-agent — this skill never dispatched one anyway). Do not create `brd.md`. Stop-condition check at the top becomes: if `notes.md` OR `brd.md` already exists, stage is complete.
- **If `size_tier` is small/medium/large:** existing behavior, unchanged, except: after saving `brd.md`, re-read it and holistically judge whether its actual scope (user stories, acceptance criteria, complexity of business rules) matches the recorded tier. If the model's judgment disagrees with the recorded tier, ask the user (`AskUserQuestion`, recommend the model's judgment with reasoning) to confirm or override, then update `prompt.md`'s `size_tier` if changed. This confirmation does not apply to trivial tier (there's no BRD to re-derive from).

**Accepted gap:** because trivial tier skips tier reconfirmation (there's no BRD/analysis content to holistically re-derive scope from — `notes.md` is written straight from the condensed Q&A), an issue misclassified as trivial that later turns out to need more than the trivial budget has no dedicated safety net at this stage. The only corrective signal for an underestimated trivial issue is the oversized-for-tier check on `notes.md` (§9b), surfaced the next time `/pf-check` runs and enforced by the downstream-recompute guard (§9c) before `/pf-test-plan`/`/pf-execute` proceed. This is a deliberate trade-off, not an oversight: adding a trivial-tier reconfirmation step would require generating something BRD-like to judge against, which defeats the point of the lightweight trivial path.

## 5. Changes to `skills/pf-spec/SKILL.md`

- Add the legacy-tier guard (§8).
- Add the oversized-predecessor guard (§9c): before writing `specs.md`, recompute the oversized-for-tier check against `brd.md`.
- Read `size_tier`. **If `trivial`:** stop immediately — "This is a trivial-tier issue — spec is already covered by `notes.md`. Next step: `/pf-test-plan`."
- **If small:** when writing `specs.md`, omit ASCII diagrams unless the issue involves UI/UX; target ≤300 lines (§2 budget table) instead of the existing 1500-line split trigger.
- **If medium/large:** unchanged from today (including the existing >1500-line → 3-part split rule).

## 6. Changes to `skills/pf-test-plan/SKILL.md`

- Add the legacy-tier guard (§8).
- Add the oversized-predecessor guard (§9c): before dispatching the sub-agent, recompute the oversized-for-tier check against its predecessor(s) — `notes.md` (trivial) or `specs.md` (small/medium/large).
- Read `size_tier`; pass it to the dispatched sub-agent (this skill keeps dispatching a sub-agent at every tier, per the earlier decision — the mechanism doesn't change, only the target counts and sections do).
- **If `trivial`:** source document is `notes.md` instead of `brd.md`/`specs.md`. Target 2-4 test cases, ≤80 lines, omit the Known Issues table section entirely (keep Status Tracker).
- **If small:** target 5-10 test cases; Known Issues table omitted.
- **If medium/large:** unchanged (10-20 typically for medium; 20+ allowed for large), Known Issues table included.

## 7. Changes to `skills/pf-impl-plan/SKILL.md`

- Add the legacy-tier guard (§8).
- Add the oversized-predecessor guard (§9c): before writing `implementation_plan.md`, recompute the oversized-for-tier check against `test_plan.md` (and `specs.md`/`brd.md` where applicable).
- Read `size_tier`. **If `trivial`:** stop immediately — "This is a trivial-tier issue — the implementation plan is already covered by `notes.md`. Next step: `/pf-test-plan`." (mirrors §5's trivial stop in pf-spec).
- **If small:** omit the "Dependencies" and "Complexity Estimate" sections from the template; target ≤150 lines.
- **If medium/large:** unchanged from today.

## 8. Shared legacy-tier guard (added verbatim, adapted per skill, to pf-brd/pf-spec/pf-test-plan/pf-impl-plan/pf-check/pf-execute)

> Before checking any other prerequisite, read `prompt.md`'s frontmatter. If it has no `size_tier` field, ask the user via `AskUserQuestion` — same 4 tier options and descriptions as in `skills/pf-size-tiers/SKILL.md`, recommending medium ("matches today's default behavior") — then write the answer into `prompt.md`'s frontmatter before proceeding with the rest of this skill.

## 9. Changes to `skills/pf-check/SKILL.md`

- Add the legacy-tier guard (§8).
- Add `notes.md` to the target/predecessor resolution table (§9a).
- Add a new check category: **oversized for tier** (§9b), folded into the existing sub-agent's analysis prompt.
- Specify how "blocking" actually works given pf-check's UI always offers "Skip and continue" (§9c).

### 9a. Target/predecessor table gains `notes.md`

Today's table (in pf-check's opening paragraph) only covers `specs.md`, `test_plan.md`, `implementation_plan.md`. Add:

- If checking `notes.md`: no predecessors (it's the first document produced for a trivial-tier issue — there is no `brd.md` before it).
- If checking `test_plan.md` **and `size_tier: trivial`**: predecessor is `notes.md` instead of `brd.md` (and `specs.md` if present). The existing `test_plan.md` row's predecessor list (`brd.md`, and `specs.md` if present) applies only when `size_tier` is small/medium/large.

### 9b. The oversized-for-tier check: folded into the existing sub-agent's dispatch prompt

Decision: fold this into the single sub-agent pf-check already dispatches for every other finding category, rather than having the orchestrator compute it separately before or after dispatch. Rationale: the sub-agent already reads the target and predecessor documents in full and does line/section counting-by-eye for every other finding it produces; handing it the tier and a budget table to compare against is the same shape of work, and avoids writing and maintaining a second, separate counting mechanism in the orchestrator (which would also have to duplicate the file-reading pf-check otherwise explicitly avoids doing itself — see "Do not read these documents yourself").

Concretely, add to the sub-agent dispatch prompt (after the existing "Read `docs/issues/open/[ISSUE-ID]/[TARGET]` and its predecessor documents" sentence):

> Also read `docs/issues/open/[ISSUE-ID]/prompt.md`'s `size_tier` field (default: medium if absent) and `skills/pf-size-tiers/SKILL.md`'s document-budgets table. Compare [TARGET]'s actual size against that tier's budget for [TARGET]'s document type:
> - `notes.md` (trivial) > ~50 lines
> - `specs.md`: small > ~300 lines; medium/large > 1500 lines without having been split into 3 parts
> - `implementation_plan.md`: small > ~150 lines
> - `analysis.md`: small > ~300 lines
> - `test_plan.md`: trivial > 4 cases, small > 10 cases, medium > 20 cases
>
> If [TARGET] exceeds its tier's budget, include a **P0** finding: "`<file>` is oversized for this issue's declared tier (`<tier>`): <actual> vs <budget>. Either trim the document, or re-classify the issue to a larger tier (edit `size_tier` in `prompt.md`)."

This finding then flows through pf-check's existing P0/P1/P2 presentation and "Fix now" / "I'll fix manually" / "Skip and continue" flow exactly like any other P0 finding — no new UI path is introduced.

### 9c. How "blocking" actually works (enforcement mechanism)

pf-check's own UI does not change: "Skip and continue" remains available for the oversized-for-tier finding exactly as it does for every other P0/P1 finding today, so pf-check stays advisory-only in its own UI — consistent with how every other finding already works there. Genuine enforcement happens one level down, in each downstream skill's own prerequisite check, not inside pf-check.

Mechanism: **no persisted state.** Each downstream skill (`pf-spec`, `pf-test-plan`, `pf-impl-plan`, `pf-execute`) independently recomputes the same oversized-for-tier comparison from §9b against its own predecessor document(s), as one more prerequisite-gate check before it starts producing its own document (added to each skill's own section: §5, §6, §7, §10). This was chosen over having pf-check write a machine-checkable note/flag file, because:

- It needs no new file, note format, or "unresolved-finding" bookkeeping that can drift out of sync with the document's actual current content (e.g. a stale note left over from a run before the user manually trimmed the file).
- It naturally reflects the predecessor's state *at the moment the downstream skill runs*, not the state at the time pf-check last ran — if the user fixed the document without re-running `/pf-check`, downstream skills correctly see it's fine now and don't block; if the user ignored it via "Skip and continue" and the document is still oversized, downstream skills correctly still block.
- The budget table and comparison logic already live in one place (`skills/pf-size-tiers/SKILL.md`, §2) and are cheap to recompute — no meaningful duplication of effort versus reading a persisted flag.

If a downstream skill's recomputed check finds its predecessor oversized for tier, it stops before producing its own document with a message such as: "`<predecessor-file>` is oversized for this issue's declared tier (`<tier>`). Run `/pf-check` to review it, then either trim the document or re-classify the issue (`size_tier` in `prompt.md`)." This is the literal blocking behavior referred to by "blocking" throughout this spec — pf-check itself never refuses to let the user proceed; the next skill down the pipeline does.

## 10. Changes to `skills/pf-execute/SKILL.md`

- Add the legacy-tier guard (§8).
- Add the oversized-predecessor guard (§9c): before creating tasks, recompute the oversized-for-tier check against `notes.md` (trivial) or `implementation_plan.md` (small/medium/large).
- Read `size_tier` from `prompt.md` and branch the prerequisite gate, Phase 0's file-commit list, and Phase 1's plan-parsing instructions on it, as follows.

### 10a. Prerequisite gate (literal text change)

Today's opening line reads:

> Determine the active issue from `docs/issues/open/`. Check prerequisites: `implementation_plan.md` must exist. If not, stop: "Implementation plan is required. Run /pf-impl-plan first."

Replace it with:

> Determine the active issue from `docs/issues/open/`. Read `size_tier` from `prompt.md`'s frontmatter. Check prerequisites:
> - **If `size_tier: trivial`:** `notes.md` must exist. If not, stop: "Notes document is required. Run /pf-brd first."
> - **If `size_tier` is small/medium/large (or absent — see §8):** `implementation_plan.md` must exist. If not, stop: "Implementation plan is required. Run /pf-impl-plan first."

The following sentence — "Read `docs/issues/open/[ACTIVE-ISSUE-ID]/implementation_plan.md`, `specs.md` (if present), and `test_plan.md`. All design and planning is complete." — likewise branches: for `size_tier: trivial`, read `notes.md` and `test_plan.md` (there is no `specs.md`/`implementation_plan.md` to read); otherwise read `implementation_plan.md`, `specs.md` (if present), and `test_plan.md` as today.

### 10b. Phase 0 file-commit list (literal text change)

Today's Phase 0 step 2 names the files to check for uncommitted planning docs:

> ... the issue's planning docs (`prompt.md`, `brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md`, etc.) sitting uncommitted or already committed there.

Replace `(prompt.md, brd.md, specs.md, test_plan.md, implementation_plan.md, etc.)` with tier-aware wording:

> ... the issue's planning docs — for `size_tier: trivial`: `prompt.md`, `notes.md`, `test_plan.md`; for small/medium/large: `prompt.md`, `brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md` — sitting uncommitted or already committed there.

The `git status --porcelain -- docs/issues/open/ISSUE-ID/` / `git add` / `git commit` instructions immediately after are unchanged (they operate on the whole issue folder regardless of which specific files exist, so no tier branching is needed there).

### 10c. Phase 1 "parse the implementation plan" instructions (literal text change)

Today's "Before Creating Tasks" step 1 reads "Review `implementation_plan.md` completely", and "Create Tasks from Implementation Plan" says "Parse the implementation plan and use `TaskCreate` to create a task for each implementation item" with sub-step "**Extract all tasks** from `implementation_plan.md`". Replace all three references with tier-branched wording:

> **If `size_tier: trivial`:** Review `notes.md` completely. Parse its "Tasks" checklist section and use `TaskCreate` to create a task for each unchecked item — treat each `- [ ] Task N — [file(s), description]` line the same way an `implementation_plan.md` line item is treated today (per-task description, mapped test cases from `test_plan.md`, dependencies, `blocked_by`/`blocks`).
>
> **If `size_tier` is small/medium/large:** Review `implementation_plan.md` completely, unchanged from today. Parse the implementation plan and use `TaskCreate` to create a task for each implementation item, extracting all tasks from `implementation_plan.md`.

Everything else in Phase 1/2/3 (task creation fields, wave grouping, sub-agent execution, commit-per-wave discipline) is unchanged — only the source document and the granularity of "one line item = one task" differ by tier, and `notes.md`'s flatter task list (no nested implementation detail) is expected to produce fewer, coarser-grained tasks than a full `implementation_plan.md` would for the same tier of work.

## 11. Changes to `skills/pf-update/SKILL.md`

Add `pf-size-tiers` to the "Managed Skills" list: "`pf-size-tiers` — reference data: tier definitions and document budgets (not directly invoked)".

## 12. Out of scope (confirmed with user)

- Simplifying the individual test-case template structure itself for lower tiers (BRD's noted idea 9) — separate issue.
- Changing `scripts/setup-planning-v3.sh` / `migrate-v2-to-v3.sh` — not required, since `size_tier` is optional/back-filled per-issue by the legacy guard rather than needing a migration script.
