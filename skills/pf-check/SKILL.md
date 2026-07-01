---
name: pf-check
description: Review the most recently produced planning document in the active issue for potential problems, grouped by priority
version: 3.0.0
---

Determine the active issue from `docs/issues/open/`. Identify the most recently produced document (TARGET) and all its predecessor documents:
- If checking specs.md: predecessors are brd.md
- If checking test_plan.md: predecessors are brd.md (and specs.md if present)
- If checking implementation_plan.md: predecessors are brd.md, specs.md (if present), test_plan.md

**Do not read these documents yourself.** Dispatch a single sub-agent (Agent tool, default/general-purpose type — no need for a fork, since its full context is not needed afterward) with a prompt along these lines:

> Read `docs/issues/open/[ISSUE-ID]/[TARGET]` and its predecessor documents: [list]. Analyze the codebase context and identify potential problems with [TARGET] from different angles, considering every edge case. Use ASCII diagrams to illustrate if helpful. Do not edit anything — analysis only.
>
> Group findings by priority: P0 (blocker), P1 (important), P2 (minor).
>
> Your reply is the only thing the orchestrator will see — it will not have read these documents. Return ONLY the prioritized findings (as your final message), not full document contents or restated context.

Present the returned findings to the user as-is, then use AskUserQuestion to present these options:

**"How would you like to proceed?"**
- **Fix now** — I'll address all P0 and P1 issues and update the document. I'll ask you clarifying questions where needed.
- **I'll fix manually** — You'll edit the document yourself, then run /pf-check again to re-verify.
- **Skip and continue** — Proceed to the next pipeline stage despite the issues (not recommended for P0).

If "Fix now": dispatch a second sub-agent (Agent tool, default/general-purpose type) to apply the fix. Give it: the target document path, the predecessor document paths, and the full P0/P1 findings list from the analysis step. Instruct it to read what it needs, use AskUserQuestion itself to ask clarifying questions until it is 95% confident (with a recommendation and reason below each option), edit the document directly, and return only a short summary of what changed. Relay that summary to the user.
If "I'll fix manually" or "Skip and continue": confirm the choice and state the next /pf-* command to run.
