---
doc_language: English
---

# Prompt

Add the missing commit step to pf-execute. And I think it should commit issue documentation to develop before branching.

## Context

Follow-up to a Q&A about when the Planning Framework expects the AI to commit work. That review surfaced a real gap: `pf-execute` created the issue branch and ran implementation tasks but never actually issued a `git commit` during Phase 2 (task execution). It also left planning docs (prompt.md, brd.md, specs.md, test_plan.md, implementation_plan.md) to be carried onto the issue branch implicitly, rather than committed to the parent branch first.

## Changes made

- `pf-execute` Phase 0: commit the issue's planning docs to the parent branch (develop/main) before creating/checking out the issue branch.
- `pf-execute` Phase 2: commit after each wave of parallel tasks completes (orchestrator-only, not inside sub-agents, to avoid concurrent git operations).
- `pf-execute` Phase 3: final safety-net commit for any uncommitted stragglers before reporting completion.
- `PLANNING.md` Branch Strategy section updated to describe the new split: planning docs land on the parent branch immediately; only code changes are isolated on the issue branch until merge.

This issue folder was created after the fact for record-keeping — the change itself was implemented directly (small, single-file skill edit) without going through the full BRD/spec/test-plan pipeline.
