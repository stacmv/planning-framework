---
name: pf-size-tiers
description: Reference data — size-tier definitions and document budgets, read by other pf-* skills. Not normally invoked directly.
version: 3.0.0
---

This skill is reference data for other Planning Framework skills. It is not meant
to be run directly. If invoked directly, just print the tables below.

## Stage completion — the shared definition

This section is the **single definition** of "stage complete" for the whole
framework. Every gate in every `pf-*` skill **references** this section; no skill
restates the criterion in its own words. (Seven independent copies of the
criterion are exactly how the skills drifted apart in the first place — see "Why"
below.)

### Evaluating it is a MECHANICAL check, never a memory exercise

**Before judging any stage, you MUST run a tool call against the filesystem and
judge from its output.** Do not answer from a document you read earlier in this
session, and do not answer from what you believe the issue folder contains — the
file may have been deleted, emptied or replaced since you last looked, and it is
precisely that case the gate exists to catch.

The minimum evidence, gathered fresh at every gate:

```bash
ls -1 docs/issues/open/<ISSUE-ID>/                  # which documents exist AT ALL
wc -c docs/issues/open/<ISSUE-ID>/<doc>             # non-empty?
grep -c 'TODO: Run /pf-' docs/issues/open/<ISSUE-ID>/<doc>   # a stub?
```

This mirrors the oversized-predecessor guard, which already mandates a mechanical
count (`wc -l`, counting `### TC-` headings) rather than a semantic read — and
which works for exactly that reason.

**Why this paragraph exists.** Manual testing of the very issue that introduced
this section found the input gates failing to fire when a prerequisite document
had been **deleted**: `/pf-impl-plan` and `/pf-execute` both proceeded, because
the model was reasoning from a copy of the document still sitting in its context
rather than from the disk. The instruction was correct; it simply did not compel
anyone to look. A gate that can be satisfied from memory is not a gate.

**A stage is complete IF AND ONLY IF all three conjuncts hold:**

1. **The document exists** — the file is present in the issue folder.
2. **The document is real, not a stub** — the file has a non-empty body beyond
   its heading, **and** the stub marker `TODO: Run /pf-` occurs nowhere in it
   (search the **whole file**, not the first N lines).
3. **Every preceding stage of its pipeline is itself complete** — by this same
   definition, applied recursively. A stage is never complete while an earlier
   stage of its pipeline is incomplete, however real its own document looks.

If any conjunct fails, the stage is **not complete**, and its document must be
treated as **absent** — for the completed-stages display, for routing, and for
every prerequisite gate.

### Pipelines — what "preceding stage" means

| Pipeline | Stage order |
|---|---|
| `size_tier: trivial` (all issue types) | CREATE (`prompt.md`) → BRD/SPEC/IMPL_PLAN collapsed into NOTES (`notes.md`) → TEST_PLAN (`test_plan.md`) → CODE_REVIEW (`code_review.md`) → TESTING (`manual_test_checklist.md`) → USER_DOCS (`user_docs.md`) → DEV_DOCS (`dev_docs.md`) → QA (`qa_report.md`) |
| feat (small/medium/large) | CREATE → BRD (`brd.md`) → SPEC (`specs.md`) → TEST_PLAN → IMPL_PLAN (`implementation_plan.md`) → CODE_REVIEW (`code_review.md`) → TESTING → USER_DOCS (`user_docs.md`) → DEV_DOCS (`dev_docs.md`) → QA |
| improve (small/medium/large) | CREATE → BRD → TEST_PLAN → IMPL_PLAN → CODE_REVIEW (`code_review.md`) → TESTING → USER_DOCS (`user_docs.md`) → DEV_DOCS (`dev_docs.md`) → QA |
| bug (small/medium/large) | CREATE → ANALYSIS (`analysis.md`) → TEST_PLAN → IMPL_PLAN → CODE_REVIEW (`code_review.md`) → TESTING → USER_DOCS (`user_docs.md`) → DEV_DOCS (`dev_docs.md`) → QA |
| `idea` (issue TYPE, not `size_tier` — see note below) | See `~/.claude/skills/pf-idea-lenses/SKILL.md`'s "Stage tables" (the `idea` table) — read live from there, not copied here. |
| `spike` (issue TYPE, not `size_tier` — see note below) | See the same file's "Stage tables" (the `spike` table). |

These two pipelines are keyed on issue TYPE (folder-name prefix `idea`-/
`spike`-), not on any `size_tier` value — `idea`/`spike` issues never carry
`size_tier` at all (see `pf-idea-lenses/SKILL.md`'s `idea_tier` instead).
Unlike every other row in this table, these two rows do not restate the
stage order inline — they point at `pf-idea-lenses/SKILL.md`, the single
normative source. Conjunct 3 of "Stage completion" described earlier in
this section, when evaluated for an `idea`/`spike` issue, reads the order
from that file directly at evaluation time.

**USER_DOCS and DEV_DOCS are formally-skippable stages**, present in every
pipeline above — including `size_tier: trivial` — between TESTING and QA.
They are never simply absent from the stage order; whether either actually
requires a document on a given issue is decided by role resolution
(`pf-roles` §4, level 3), not by the pipeline table. Both
resolve to `skip` by default at `trivial`/`small` tier (fallback level 3),
and may resolve to `skip` at any tier via an explicit
`roles.user_docs`/`roles.dev_docs: skip` or a profile's point-specific
entry. A stage resolved to `skip` counts as **complete** for routing
purposes without a document ever existing on disk — see
`~/.claude/skills/pf/SKILL.md` Step 5/Step 6 for how that is applied and
displayed.

CODE_REVIEW applies uniformly across every tier, including `trivial` — code
review does not scale down with document tier; findings are findings, not
prose to trim (see `specs.md` §8 of the pluggable-reviewers issue).

Routing keys on the **first incomplete stage** of the pipeline — never on the
last document that happens to sit on disk. A migrated v2 issue can carry a
perfectly real `implementation_plan.md` and no `test_plan.md` at all: its first
incomplete stage is TEST_PLAN, so its next step is `/pf-test-plan`, never
`/pf-execute`.

### Scope

- The criterion applies to **every** document of an issue, not to `test_plan.md`
  alone: `prompt.md`, `notes.md`, `brd.md`, `specs.md`, `analysis.md`,
  `test_plan.md`, `implementation_plan.md`, `code_review.md`,
  `manual_test_checklist.md`, `user_docs.md`, `dev_docs.md`, `qa_report.md`,
  `idea.md`, `research.md`, `critique.md`, `verdict.md`, `hypothesis.md`,
  `findings.md`. `open_questions.md` is deliberately excluded from this
  list — it is a side ledger, not a pipeline-stage document; see
  `20260902-feat-idea-stage/specs.md` §5.6.
- `user_docs.md`/`dev_docs.md` are the one exception to conjunct 1 above:
  when role resolution (`pf-roles` §4, level 3) yields
  `skip` for `roles.user_docs`/`roles.dev_docs`, that stage counts as
  complete even though no file exists on disk — the exception is narrow and
  applies to these two keys only. Every other document in the list above
  still requires physical presence on disk to count as complete. The `skip`
  determination itself is subject to the same mechanical-check rule as
  everything else in this section: it is made by reading the issue's
  `prompt.md` frontmatter fresh from disk at judgment time, never from a
  resolution remembered earlier in the session — a stale "it resolved to
  skip when I last checked" is exactly the kind of memory-based answer this
  section exists to rule out.
- It applies to issues under `docs/issues/open/` — those are the only ones the
  pipeline routes. Issues under `docs/issues/closed/` are archive: the pointer
  `brd.md` that convergence leaves in a closed legacy issue (it links to the
  surviving `prompt.md` / `analysis.md` / `definition-of-done.md`) is a pointer,
  not an unfinished document. It deliberately carries no `TODO: Run /pf-` marker,
  and this criterion never fires on it.

### Why this exists (history — do not delete)

The old v2→v3 migration wrote a `test_plan.md` whose entire body was the stub
marker. Because the skills judged "stage complete" purely by file existence,
`/pf` reported `Completed stages: CREATE, TEST_PLAN, IMPL_PLAN` and routed
straight to `/pf-execute` — implementation against a test plan that did not
exist. That happened on a real project. Seven independent gates each carried
their own copy of the criterion, so mending one mended nothing. Hence: one
definition, here; references, everywhere else.

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

## Manual test-case budget by tier

`test_plan.md`'s Status Tracker limits how many `Manual`-type rows an issue may carry, by `size_tier`:

| Tier    | Manual budget | Hard cap |
|---------|----------------|----------|
| trivial | 0-1            | 5        |
| small   | ≤2             | 5        |
| medium  | ≤3             | 5        |
| large   | ≤5             | 5        |

The hard cap of 5 applies unconditionally — `large` tier does not let the budget grow past it.

### `Manual reason` — closed vocabulary

Every `Manual`-type row's `Remarks` column must begin with `Manual reason: <value>` (optionally followed by free text), where `<value>` is exactly one of these five — no others:

- `human-judgment` — visual/UX/aesthetic judgment
- `external-system` — a paid API, a real device, a third-party account
- `interactive-agent` — a live LLM session as the thing under test (the subject and the measuring instrument must be different systems — a case where the model reads the expected outcome and reports on its own success does not qualify, whatever reason it claims)
- `cost` — automation is technically possible but not worth it; must include an effort estimate in the reason text
- `environment` — the needed environment is unavailable in CI

A `Manual` row with no `Manual reason:` prefix in `Remarks`, or with a value outside this list, is invalid and must be rejected during test-plan generation.

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
