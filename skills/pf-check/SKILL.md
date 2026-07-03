---
name: pf-check
description: Review the most recently produced planning document in the active issue for potential problems, grouped by priority
version: 3.0.0
---

Before checking any other prerequisite, read `prompt.md`'s frontmatter. If it has no `size_tier` field, ask the user via `AskUserQuestion` — same 4 tier options and descriptions as in `skills/pf-size-tiers/SKILL.md`, recommending medium ("matches today's default behavior") — then write the answer into `prompt.md`'s frontmatter before proceeding with the rest of this skill.

Determine the active issue from `docs/issues/open/`. Identify the most recently produced document (TARGET) and all its predecessor documents:
- If checking notes.md: no predecessors (it's the first document produced for a trivial-tier issue — there is no brd.md before it).
- If checking specs.md: predecessors are brd.md
- If checking test_plan.md: predecessors are brd.md (and specs.md if present). **Exception:** if `size_tier: trivial`, the predecessor is notes.md instead — the brd.md/specs.md predecessor relationship only applies when `size_tier` is small/medium/large.
- If checking implementation_plan.md: predecessors are brd.md, specs.md (if present), test_plan.md

**Do not read these documents yourself.** Dispatch a single sub-agent (Agent tool, default/general-purpose type — no need for a fork, since its full context is not needed afterward) with a prompt along these lines:

> Read `docs/issues/open/[ISSUE-ID]/[TARGET]` and its predecessor documents: [list]. Analyze the codebase context and identify potential problems with [TARGET] from different angles, considering every edge case. Use ASCII diagrams to illustrate if helpful. Do not edit anything — analysis only.
>
> Also read `docs/issues/open/[ISSUE-ID]/prompt.md`'s `size_tier` field (default: medium if absent) and `skills/pf-size-tiers/SKILL.md`'s document-budgets table. Compare [TARGET]'s actual size against that tier's budget for [TARGET]'s document type:
> - `notes.md` (trivial) > ~50 lines
> - `specs.md`: small > ~300 lines; medium/large > 1500 lines without having been split into 3 parts
> - `implementation_plan.md`: small > ~150 lines
> - `analysis.md`: small > ~300 lines
> - `test_plan.md`: trivial > 4 cases, small > 10 cases, medium > 20 cases
>
> If [TARGET] exceeds its tier's budget, include a **P0** finding: "`<file>` is oversized for this issue's declared tier (`<tier>`): <actual> vs <budget>. Either trim the document, or re-classify the issue to a larger tier (edit `size_tier` in `prompt.md`)."
>
> Group findings by priority: P0 (blocker), P1 (important), P2 (minor).
>
> Read the `doc_language` field from `docs/issues/open/[ISSUE-ID]/prompt.md`'s YAML frontmatter (default: English if absent) and write your findings in that language.
>
> Your reply is the only thing the orchestrator will see — it will not have read these documents. Return ONLY the prioritized findings (as your final message), not full document contents or restated context.

Present the returned findings to the user as-is, then use AskUserQuestion to present these options:

**"How would you like to proceed?"**
- **Fix now** — I'll address all P0 and P1 issues and update the document. I'll ask you clarifying questions where needed.
- **I'll fix manually** — You'll edit the document yourself, then run /pf-check again to re-verify.
- **Skip and continue** — Proceed to the next pipeline stage despite the issues (not recommended for P0).

Note: these three options are unchanged from today, and the oversized-for-tier finding (above) flows through them exactly like any other P0/P1 finding — "Skip and continue" remains available for it too. pf-check itself does not implement any special blocking behavior for oversized documents; it stays advisory-only, same as for every other finding. The real enforcement happens downstream: each pipeline skill (pf-spec, pf-test-plan, pf-impl-plan, pf-execute) independently recomputes this same oversized-for-tier comparison against its own predecessor document(s) as a prerequisite-gate check before it starts producing its own document, and stops there if the predecessor is still oversized.

If "Fix now": dispatch a second sub-agent (Agent tool, default/general-purpose type) to apply the fix. Give it: the target document path, the predecessor document paths, and the full P0/P1 findings list from the analysis step. Instruct it to read what it needs, use AskUserQuestion itself to ask clarifying questions until it is 95% confident (with a recommendation and reason below each option), edit the document directly (honoring the same `doc_language` field for any prose it writes, keeping structural labels in English), and return only a short summary of what changed. Relay that summary to the user.
If "I'll fix manually" or "Skip and continue": confirm the choice and state the next /pf-* command to run.
