---
name: pf-execute
description: Execute the implementation plan for the active issue using task-based sub-agents
version: 3.0.0
---

Determine the active issue from `docs/issues/open/`. Check prerequisites: `implementation_plan.md` must exist. If not, stop: "Implementation plan is required. Run /pf-impl-plan first."

Read `docs/issues/open/[ACTIVE-ISSUE-ID]/implementation_plan.md`, `specs.md` (if present), and `test_plan.md`. All design and planning is complete.

## Phase 0: Branch Setup

1. Determine ISSUE-ID from the active issue folder name in `docs/issues/open/`.
2. **Commit issue documentation to the current (parent) branch first.** The CREATE→IMPL_PLAN stages run before `/pf-execute`, so at this point you should still be on the parent branch (`develop`/`main`) with the issue's planning docs (`prompt.md`, `brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md`, etc.) sitting uncommitted or already committed there.
   - Run `git status --porcelain -- docs/issues/open/ISSUE-ID/`.
   - If it shows changes, run `git add docs/issues/open/ISSUE-ID/` then `git commit -m "docs: add planning docs for ISSUE-ID"`. This lands the planning docs on the parent branch immediately — they don't wait for the issue to be implemented and merged to become visible.
   - If it shows nothing, skip — already committed.
3. Check if branch exists: `git branch --list issue/ISSUE-ID`
4. If branch does not exist: `git checkout -b issue/ISSUE-ID`
5. If branch exists: `git checkout issue/ISSUE-ID`
6. If checkout fails (e.g. dirty working tree from files outside `docs/issues/`): stop with message "Cannot create/checkout issue branch. Commit or stash your changes first."
7. After branch is ready, proceed to Phase 1.

---

## Phase 1: Task Creation

### Before Creating Tasks
1. Review `implementation_plan.md` completely
2. Understand test case expectations from `test_plan.md`
3. Reference wireframe/prototype for UI (if applicable)
4. Check design system for patterns (if available)

### Create Tasks from Implementation Plan
Parse the implementation plan and use `TaskCreate` to create a task for each implementation item:

1. **Extract all tasks** from `implementation_plan.md`
2. **Identify dependencies** between tasks (what must be done before what)
3. **Create each task** with:
   - Clear description including the specific files to create/modify
   - Mapped test cases (TCs) that verify the task
   - `blocked_by`: tasks that must complete first
   - `blocks`: tasks that depend on this one

---

## Phase 2: Task Execution

### Execution Strategy
Execute tasks using sub-agents for parallel processing:

1. **Group tasks into waves** based on dependencies
2. **Run each task in its own sub-agent** - This keeps context usage low (~18% vs ~56%)
3. **Process waves sequentially** - Wave N+1 starts only after Wave N completes
4. **Commit after each wave, not inside sub-agents.** Sub-agents in a wave run concurrently and must NOT run `git commit` themselves (concurrent commits on the same branch race and corrupt each other). Once every task in a wave is confirmed complete via `TaskList`/`TaskGet`, the orchestrator runs, on the issue branch:
   - `git add -A`
   - `git commit -m "feat: <short wave summary> [ISSUE-ID]"` (mention the TC-IDs or task names covered)
   - Only start the next wave after this commit succeeds.

### For Each Task (Sub-Agent Instructions)
1. Use `TaskGet` to read full task details
2. Create/modify specified files
3. Implement functionality to pass mapped TCs
4. **Self-verify the implementation:**
   - Check that code compiles/runs without errors
   - Verify the functionality matches test expectations
   - Ensure design consistency with existing patterns
5. Use `TaskUpdate` to mark task complete with a brief summary of what was done
6. Note any deviations, concerns, or discovered issues

### If Issues Are Discovered
- Use `TaskCreate` to add new fix/bug tasks
- Set appropriate dependencies so fixes run in correct order
- Continue with other independent tasks

---

## Phase 3: Completion Summary

Before reporting, run `git status --porcelain`. If anything is still uncommitted (e.g. a final wave's changes), commit it: `git add -A` then `git commit -m "chore: finalize implementation [ISSUE-ID]"`. Every task's changes must be committed on the issue branch by the end of this phase.

After all tasks are complete, provide:

### 1. Summary of Changes
- Files created
- Files modified
- Key functionality added

### 2. Self-Verification Results
- What works as expected
- Any concerns or edge cases noted
- Tasks that required fixes (if any)

### 3. Ready for Testing
- Confirm all tasks marked complete
- List any setup needed for testing
- Note any known limitations

---

## Important Notes

- **Do NOT run full test suite** - that's the next step
- **Use `TaskList`** periodically to check overall progress
- **Dependencies are critical** - ensure tasks don't start before their blockers complete
- **Keep sub-agent context focused** - each sub-agent only needs info for its specific task
- **Commits happen at wave boundaries, run by the orchestrator only** - never inside a parallel task sub-agent. This is the only point in the pipeline where code (as opposed to planning docs) gets committed, so don't skip it even for a single-wave plan.
