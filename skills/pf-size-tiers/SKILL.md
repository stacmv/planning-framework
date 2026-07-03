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
