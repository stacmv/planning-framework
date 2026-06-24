---
name: pf-check
description: Review the most recently produced planning document in the active issue for potential problems, grouped by priority
version: 3.0.0
---

Determine the active issue from `docs/issues/open/`. Identify the most recently produced document and all its predecessor documents:
- If checking specs.md: read brd.md and specs.md
- If checking test_plan.md: read brd.md (and specs.md if present) and test_plan.md
- If checking implementation_plan.md: read brd.md, specs.md (if present), test_plan.md, and implementation_plan.md

Read `docs/issues/open/[ISSUE-ID]/specs.md` (or the most recently produced document), analyze the codebase context, and tell me what could be the potential problems with this document. Let's look at it from different angles and try to consider every edge case. Use ASCII diagrams to illustrate if needed. Don't edit anything yet. Let's focus on analysis.

Group findings by priority: P0 (blocker), P1 (important), P2 (minor).

Then use AskUserQuestion to present these options:

**"How would you like to proceed?"**
- **Fix now** — I'll address all P0 and P1 issues and update the document. I'll ask you clarifying questions where needed.
- **I'll fix manually** — You'll edit the document yourself, then run /pf-check again to re-verify.
- **Skip and continue** — Proceed to the next pipeline stage despite the issues (not recommended for P0).

If "Fix now": update the document. Use AskUserQuestion to ask clarifying questions until you are 95% confident. For each question, add your recommendation (with reason why) below the options.
If "I'll fix manually" or "Skip and continue": confirm the choice and state the next /pf-* command to run.
