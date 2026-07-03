---
doc_language: English
---

Make Planning Framework documents (BRD, specs, test plan, implementation plan) scale in size and detail to the size of the task, so that simpler/smaller issues produce simpler/shorter documents instead of always following the full-size template.

Implement the following ideas (numbered as originally proposed):

1. Add a size classification step early in the pipeline (e.g. in `/pf-brd` or issue creation): classify the issue as trivial / small / medium / large, store it in `prompt.md`'s YAML frontmatter (alongside `doc_language`), and have every downstream skill read that field to decide how much scaffolding to produce.

2. Replace fixed document-size targets (e.g. test-plan's "10-20 test cases typically") with ranges scaled by the size tier (e.g. trivial: 2-4, small: 5-10, medium/large: 10-20).

3. Make whole document sections optional below a size threshold — e.g. skip "Known Issues", "Dependencies", "Complexity Estimate", ASCII diagrams for trivial/small issues; only require them at medium+ tiers. Encode this as explicit conditional instructions in each SKILL.md.

4. Introduce a lightweight "quick" pipeline variant for trivial issues: a single combined short document (e.g. `notes.md`) merging BRD+spec+test-plan+impl-plan content, bypassing the normal 4-file pipeline.

5. Have `/pf` (the orchestrator) branch on size tier at session start: if an issue is tagged trivial, tell the user they can skip straight to the combined quick-pipeline document instead of walking the full CREATE→BRD→SPEC→TEST_PLAN→IMPL_PLAN chain.

6. Scale sub-agent dispatch to size tier: for trivial issues, do drafting inline instead of always dispatching a sub-agent (as `pf-test-plan`/`pf-impl-plan` currently always do), since sub-agent dispatch overhead isn't worth it for a handful of lines.

7. Add explicit line/word budget caps per size tier in skill instructions (similar to the existing "split specs.md into 3 parts if over 1500 lines" rule in `pf-spec`, but as a target ceiling rather than a split trigger) — e.g. "trivial: under ~50 lines total".

8. Derive the size tier automatically from BRD content where possible (e.g. count user stories / acceptance criteria) instead of always asking the user, only prompting to confirm/override when the heuristic is ambiguous.

10. Add a check in `/pf-check` that flags oversized documents relative to the issue's size tier — e.g. warn if `test_plan.md` has 15 test cases but the issue is tagged trivial with one user story — as a corrective mechanism, not just generation-time guidance.

(Idea 9, simplifying the test-case template itself for trivial tiers, is out of scope for this issue and can be considered separately.)

Scope: this affects the skills in `skills/pf-brd`, `skills/pf-spec`, `skills/pf-test-plan`, `skills/pf-impl-plan`, `skills/pf-check`, and `skills/pf/SKILL.md` (orchestrator) in this repository (the Planning Framework itself), since these are the skill definitions that get distributed to consuming projects.
