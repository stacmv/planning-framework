---
name: pf-execute
description: Execute the implementation plan for the active issue using task-based sub-agents
version: 3.0.0
---

Determine the active issue from `docs/issues/open/`.

Before checking any other prerequisite, read `prompt.md`'s frontmatter. If it has no `size_tier` field, ask the user via `AskUserQuestion` — same 4 tier options and descriptions as in `~/.claude/skills/pf-size-tiers/SKILL.md`, recommending medium ("matches today's default behavior") — then write the answer into `prompt.md`'s frontmatter before proceeding with the rest of this skill.

**Oversized-predecessor guard.** Before creating tasks, recompute the oversized-for-tier check as a lightweight mechanical count (e.g. `wc -l`) — its own first action, before the full prerequisite read below:
- If `size_tier: trivial`: count lines in `notes.md`. Budget is ~50 lines.
- If `size_tier` is small: count lines in `implementation_plan.md`. Budget is ~150 lines.
- If `size_tier` is medium/large: no cap, skip this check.

If the relevant file exceeds its budget, stop: "`<file>` is oversized for this issue's declared tier (`<tier>`): <actual> lines vs ~<budget> lines. Run /pf-check, then trim or re-classify size_tier."

(Note: `pf-execute` already reads `implementation_plan.md`/`specs.md`/`test_plan.md` itself today — unlike `pf-test-plan`/`pf-impl-plan`, it has no sub-agent-dispatch step for planning-document ingestion, so there is no literal "do not read yourself" text this guard conflicts with. It still uses a cheap mechanical count here, for consistency and to run before the full prerequisite read.)

Read `size_tier` from `prompt.md`'s frontmatter. Check prerequisites — **these are hard stops, and they stay hard stops.** "Exists" always means **complete** per the shared definition of "stage complete" in `~/.claude/skills/pf-size-tiers/SKILL.md` ("Stage completion") — do not restate the criterion here. Its third conjunct is what matters most at this gate: a document is complete only if every preceding stage of its pipeline is complete too, so `implementation_plan.md` is not an input while `test_plan.md` is missing or a stub.
- **If `size_tier: trivial`:** `notes.md` must be complete, and so must `test_plan.md` (it precedes execution). If not, stop: "Notes document is required. Run /pf-brd first." — or, when `test_plan.md` is the incomplete one: "Test plan is required. Run /pf-test-plan first."
- **If `size_tier` is small/medium/large (or absent):** `implementation_plan.md` must be complete — which includes every preceding stage (`brd.md`/`specs.md` or `analysis.md`, and `test_plan.md`). If not, stop: "Implementation plan is required. Run /pf-impl-plan first." — or, when an earlier stage is the incomplete one, name that stage instead and stop there ("Test plan is required. Run /pf-test-plan first.").

Never execute against a stub or a missing test plan. If a document exists but is not complete, this skill stops; replacing it is the job of the skill that produces it.

> **Run the check, do not recall it.** Your FIRST action at this gate is a tool call — `ls -1 docs/issues/open/<ISSUE-ID>/` — and you judge from its output, not from any document already in your context. Manual testing found this gate silently failing to fire when `implementation_plan.md` had been **deleted**: the file was gone from disk but still present in the session's context, so execution proceeded anyway. This skill is the last one before code gets written; a gate that can be satisfied from memory is not a gate. See "Evaluating it is a MECHANICAL check" in `~/.claude/skills/pf-size-tiers/SKILL.md`.

For `size_tier: trivial`, read `docs/issues/open/[ACTIVE-ISSUE-ID]/notes.md` and `test_plan.md`. All design and planning is complete.

For `size_tier` small/medium/large, read `docs/issues/open/[ACTIVE-ISSUE-ID]/implementation_plan.md`, `specs.md` (if present), and `test_plan.md`. All design and planning is complete.

## Phase 0: Branch Setup

1. Determine ISSUE-ID from the active issue folder name in `docs/issues/open/`.
2. **Commit issue documentation to the current (parent) branch first — a safety net, normally a no-op.** Each planning stage now commits and pushes its own document as it finishes (`~/.claude/skills/pf-git/SKILL.md`), so by the time `/pf-execute` runs there is usually nothing left here. This step stays because the docs may also have been hand-edited, or produced before that rule existed. At this point you should still be on the parent branch (`develop`/`main`) with the issue's planning docs — for `size_tier: trivial`: `prompt.md`, `notes.md`, `test_plan.md`; for small/medium/large: `prompt.md`, `brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md`.
   - Run `git status --porcelain -- docs/issues/open/ISSUE-ID/`.
   - If it shows changes, run `git add docs/issues/open/ISSUE-ID/` then `git commit -m "docs: add planning docs for ISSUE-ID"`, and push per `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push", Step 3) — the push happens here, on the parent branch, before the issue branch is created.
   - If it shows nothing, skip — already committed by the stage that produced them.
3. Check if branch exists: `git branch --list issue/ISSUE-ID`
4. If branch does not exist: `git checkout -b issue/ISSUE-ID`
5. If branch exists: `git checkout issue/ISSUE-ID`
6. If checkout fails (e.g. dirty working tree from files outside `docs/issues/`): stop with message "Cannot create/checkout issue branch. Commit or stash your changes first."
7. After branch is ready, proceed to Phase 1.

---

## Phase 1: Task Creation

### Before Creating Tasks
**If `size_tier: trivial`:**
1. Review `notes.md` completely
2. Understand test case expectations from `test_plan.md`
3. Reference wireframe/prototype for UI (if applicable)
4. Check design system for patterns (if available)

**If `size_tier` is small/medium/large:**
1. Review `implementation_plan.md` completely
2. Understand test case expectations from `test_plan.md`
3. Reference wireframe/prototype for UI (if applicable)
4. Check design system for patterns (if available)

### Create Tasks from Implementation Plan

**If `size_tier: trivial`:** Parse `notes.md`'s "## Tasks" checklist section and use `TaskCreate` to create one task per unchecked `- [ ] Task N — ...` line:

1. **Extract all unchecked task lines** from `notes.md`'s "## Tasks" section
2. **Identify dependencies** between tasks (what must be done before what)
3. **Create each task** with:
   - Clear description including the specific files to create/modify
   - Mapped test cases (TCs) from `test_plan.md` that verify the task
   - `blocked_by`: tasks that must complete first
   - `blocks`: tasks that depend on this one

   **No `Task Type` field** — trivial-tier's `notes.md` "## Tasks" checklist has
   no `**Task Type:** code | tests | docs` field, and never will (out of scope
   for this tier). This is not a gap: every trivial-tier task always resolves
   role for `code` in Phase 2 (never `tests`), since there is no field to say
   otherwise. Do not add a `Task Type` to the created task's description for
   this tier.

**If `size_tier` is small/medium/large:** Parse the implementation plan and use `TaskCreate` to create a task for each implementation item:

1. **Extract all tasks** from `implementation_plan.md`
2. **`Task Type: docs` guard — check before creating any tasks.** If any task in `implementation_plan.md` carries `**Task Type:** docs`, stop here and surface it to the user as an unsupported task type: `docs` is reserved and not dispatched by this issue's implementation (matching `~/.claude/skills/pf-impl-plan/SKILL.md`'s own "reserved... not used for delegation in this issue" framing for this value). Do not call `TaskCreate` for any task yet — catching this at plan-parse time, before any wave starts, avoids stranding an already-running wave on an undispatchable task (see Phase 2, "Execution Strategy" point 2 for what would otherwise happen at dispatch time).
3. **Identify dependencies** between tasks (what must be done before what)
4. **Create each task** with:
   - Clear description including the specific files to create/modify
   - **What counts as done** — an explicit, task-level completion criterion,
     stated plainly rather than folded into the sub-agent instructions below:
     this task is done when the files listed above reflect the change
     described AND its mapped test cases (TCs) below pass. This is what
     "Implement functionality to pass mapped TCs" in "For Each Task —
     `write: claude`" below actually verifies against — stating it here too
     makes it a completion criterion at task-creation time, not only an
     instruction buried inside the sub-agent's own steps.
   - Mapped test cases (TCs) that verify the task
   - `blocked_by`: tasks that must complete first
   - `blocks`: tasks that depend on this one
   - **`Task Type`** — carry the task's `**Task Type:** code | tests`
     field (from `implementation_plan.md`, per
     `~/.claude/skills/pf-impl-plan/SKILL.md`; `docs` was already ruled out
     by point 2 above) verbatim into the created task's own
     description/metadata. Phase 2 resolves role from this stored value —
     it does not re-read `implementation_plan.md` from scratch per task
     (see Phase 2, "Execution Strategy" point 2).
     **Missing-field fallback:** a plan generated before this issue, or
     hand-edited without the field, may have a task with no `Task Type` at
     all. Carry no `Task Type` for that task rather than inventing one here
     — Phase 2 applies the "absent → `code`" default when it resolves this
     task's write actor (see "Execution Strategy" point 2 there; the
     completeness gate below separately reads the same default for its own,
     different purpose). Do not stamp `Task Type: code` at creation time;
     that would create a second, redundant fallback mechanism instead of
     one.

---

## Phase 2: Task Execution

### Execution Strategy
Execute tasks using sub-agents for parallel processing:

1. **Group tasks into waves** based on dependencies
2. **Resolve each task's write actor before dispatching it.** For `size_tier` small/medium/large, each task's `Task Type` (`code` | `tests`) was already carried into the task's own description/metadata at creation time (Phase 1, "Create Tasks from Implementation Plan") — read it from there, not by re-reading `implementation_plan.md` from scratch for each task.
   - **Missing-field fallback.** If a task has no `Task Type` at all (a plan generated before this issue, or hand-edited without the field, so Phase 1 carried nothing), default to `code` here — not `tests`, and not a stop/error. This keeps an old or hand-edited plan executable instead of breaking role resolution below. Phase 1 deliberately does not stamp this default at creation time, to avoid two mechanisms for one rule. **This is not the only place this default is read:** the completeness gate later in this skill (Phase 3.5) applies the same absent-`Task Type`-means-`code` rule for a different purpose — not resolving a write actor, but deciding which forward-direction completeness check applies to a task that carries no `Task Type` at all. Both places must stay in sync with this one rule; changing the default here changes what that gate does too.
   - **`size_tier: trivial` has no `Task Type` field at all** (Phase 1 says so explicitly) — always resolve for `code`, never `tests`, for every task in that tier. This is the same `code` default as the missing-field fallback above, for the same reason: trivial-tier plans simply never carry the field.
   - **`Task Type: docs` should never reach this point.** Phase 1's task-creation step (point 2 there) stops before creating any tasks if `implementation_plan.md` contains a `docs`-typed task, specifically so this dispatch-time check never has to strand a partially-run wave. If a `docs`-typed task is somehow encountered here anyway (e.g. `TaskCreate` was called by hand, bypassing Phase 1), treat it the same way: stop and surface it to the user as an unsupported task type — do not resolve it as `code` or `tests`, and do not dispatch it. A wave containing a stopped task cannot be confirmed complete (point 6 below), so the wave, and any wave after it, does not proceed until this is resolved.

   Once the task's effective `Task Type` is known (carried value, or the missing-field fallback above), resolve role — same "resolve role" pattern used elsewhere for whole documents, applied here per task instead — per `~/.claude/skills/pf-roles/SKILL.md` §4, for `code` (or, when the task's `Task Type` is `tests`, for `tests`) to get that task's `write` actor:
   - **`write == claude`** — unchanged: dispatch a Claude sub-agent via the `Agent` tool, exactly as today (TC-013 — this must stay a true no-regression case). See "For Each Task — `write: claude` (Sub-Agent Instructions)" below.
   - **`write != claude`** (in this issue, only `codex`) — the task is not dispatched to a sub-agent at all. The orchestrating `pf-execute` session itself calls the resolved actor's write-invocator per `~/.claude/skills/pf-roles/SKILL.md` §7 (for `codex`: `codex-companion.mjs task "<prompt>" --write`). See "For Each Task — `write != claude` (delegated actor)" below (TC-012).
   - **Tier and availability.** The role resolved above per §4 also carries a tier (§4's "Resolution output"; bare `write: codex` resolves to `codex`'s `default_tier`, same as any other key). Before dispatching this task — either path — run the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11) for the resolved actor/tier, applying `prompt.md`'s `on_unavailable` if it reports the actor unavailable. Pass the resolved tier per §9's dispatch mapping: the tier name as the `Agent` tool's `model` parameter for a `write == claude` dispatch, or `--model <tier's model id>` on the `codex-companion.mjs task ... --write` call for a delegated dispatch.
3. **Run each `write: claude` task in its own sub-agent** - This keeps context usage low (~18% vs ~56%)
4. **Within a wave, run `write != claude` (Codex-delegated) tasks sequentially, after every `write: claude` sub-agent in that wave has finished, and before that wave's commit — never concurrently with the Claude sub-agents.** Today, Claude sub-agents in a wave run concurrently via the `Agent` tool and never commit themselves — only the orchestrator commits at the wave boundary, specifically to avoid a working-tree race. Codex-delegated tasks go through a different, synchronous channel (`Bash` → `codex-companion.mjs task ... --write`), and the joint safety of that channel running at the same time as parallel `Agent`-tool sub-agents has not been validated in this issue. This ordering is a **temporary simplification for this issue**, not a permanent architectural constraint — cross-channel parallel-safety can be investigated separately once the role matrix is in real use.
5. **Process waves sequentially** - Wave N+1 starts only after Wave N completes
6. **Commit and push after each wave, not inside sub-agents or delegated-actor calls.** Claude sub-agents in a wave run concurrently and must NOT run `git commit` themselves (concurrent commits on the same branch race and corrupt each other); Codex-delegated tasks (run sequentially per point 4 above) must not commit themselves either — same reason, one commit per wave. Once every task in a wave is confirmed complete, the orchestrator runs the shared commit & push procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push") for that wave, on the issue branch. How "confirmed complete" is judged differs by task kind, and the two channels are not symmetric:
   - **For `write: claude` tasks** — in practice, from each dispatched sub-agent's own final response/summary, not from a `TaskList`/`TaskGet` check. `TaskList`/`TaskGet` is the channel this instruction used to name here, but as "Why the orchestrator, not the actor, reads and marks the task" below explains, Claude sub-agents have no access to `TaskUpdate` at all today, so a task's `TaskGet` state is never actually advanced by the sub-agent that did the work — checking it would not reflect real completion. This is an existing, out-of-scope gap (not introduced or fixed by this issue); until it's fixed, the sub-agent's own final response is the orchestrator's real completion signal for these tasks.
   - **For `write != claude` (delegated) tasks** — by the orchestrator's own judgment, per point 4 (not point 5) in the "For Each Task — `write != claude` (delegated actor)" instructions below: point 4 is where the orchestrator re-reads the target file(s) from disk and confirms they match the task; point 5 is only the mechanical `TaskUpdate` call that follows once that judgment is already made.
   - **Write that task's own checkboxes, immediately after it is confirmed complete via either path above, and before this wave's `git add -A` below.** Edit `implementation_plan.md` and flip **that task's own** `**Acceptance Criteria:**` checkboxes from `- [ ]` to `- [x]`, one task at a time — never rewrite the whole document in a single pass. This is the write side of the completeness gate in Phase 3.5 below: nothing else in `pf-execute` ever marks these checkboxes, so without this step that gate would find every task still unchecked no matter how much real work actually finished. **Partial confirmation:** if the confirmation (sub-agent summary, or orchestrator disk re-read) reports the task incomplete, deviated from, or only partially done, leave its checkboxes exactly as `- [ ]` instead — do not check any of them; an inaccurately checked box would defeat the point of that gate. **Ordering matters:** this edit must land before the wave's commit below, so it rides the same `git add -A` as the rest of the wave's changes.
   - `git add -A` — a wave owns the code, so this is the one stage that stages the whole worktree rather than a scoped path. This commits whatever was actually written, regardless of which actor wrote it — there is no separate commit marking a task as delegated; the wave/commit structure itself is unchanged.
   - `git commit -m "feat: <short wave summary> [ISSUE-ID]"` (mention the TC-IDs or task names covered)
   - then push per that procedure's Step 3 guard — an interrupted run must not leave a completed wave stranded on one machine
   - Only start the next wave after this commit succeeds. A failed **push** does not block the next wave (the wave is committed locally); a failed **commit** does.

### For Each Task — `write: claude` (Sub-Agent Instructions)
Dispatch via the `Agent` tool is unchanged (no regression on that mechanism). The steps below are revised so they stop asking the sub-agent for tools it does not have (AC-6.2, KI-1: confirmed via `ToolSearch` on two separate test sub-agents that `write: claude` sub-agents have no access to `TaskGet` or `TaskUpdate`):
1. Work from the task's full content already included in this dispatch prompt — description, files, the "what counts as done" completion criterion, mapped TCs, and dependencies (the five-element minimum from "Create Tasks from Implementation Plan" above). Never fetch it via `TaskGet` — you do not have access to that tool.
2. Create/modify specified files
3. Implement functionality to pass mapped TCs
4. **Self-verify the implementation:**
   - Check that code compiles/runs without errors
   - Verify the functionality matches test expectations
   - Ensure design consistency with existing patterns
5. Return a completion summary as your final message, briefly describing what was done. Do not call `TaskUpdate` — you do not have access to that tool either. The orchestrator reads this final-message summary and calls `TaskUpdate` itself (see "Execution Strategy" point 6 above).
6. Note any deviations, concerns, or discovered issues in that same final-message summary.

**Numbering-mismatch immunity (AC-6.3).** The dispatch prompt above always includes the task's full content — description, files, completion criterion, mapped TCs, dependencies — never a bare task number or identifier alone. This explicitly covers the case where the orchestrator's own internal wave/task dispatch numbering does not match `implementation_plan.md`'s own `Task N` labels: a sub-agent must never be told to go look up "Task 3" by number alone, because that numbering does not always match, and doing so risks executing the wrong task entirely (the exact failure `prompt.md` item 7's second paragraph describes).

### For Each Task — `write != claude` (delegated actor)
Not a sub-agent dispatch. The **orchestrating `pf-execute` session itself** performs every step below — sequentially, per delegated task, at the point in the wave described in "Execution Strategy" point 4 above:

1. The orchestrator uses `TaskGet` **itself** (it has this tool as orchestrator — it is the session that ran `TaskCreate` in Phase 1) to read the task's full details. It does not ask the delegated actor to do this.
2. It builds the write-invocation prompt from: the task's description (from step 1), the relevant slice of `implementation_plan.md` (this task plus its immediate context — dependencies, adjacent tasks), and repo context — targeting the same file(s)/scope a Claude sub-agent would have gotten for this same task (TC-012).
3. It calls the resolved actor's write-invocator per `~/.claude/skills/pf-roles/SKILL.md` §7 — for `codex`: `codex-companion.mjs task "<prompt>" --write` (synchronous, for a small/targeted one-or-two-file task) or the `--write --background` + polling form (for a task creating several files from nothing) — the same sync/async judgment call §7 describes.
4. After the call returns, the orchestrator judges completion **itself**, from the command's result and the actual file state on disk (re-read the target file(s), confirm they match what the task asked for) — never from a completion claim the delegated actor might make in its own output.
5. The orchestrator itself calls `TaskUpdate` to mark the task complete, with a brief summary of what was done. The delegated actor never calls `TaskUpdate` — it has no access to it.
6. Note any deviations, concerns, or discovered issues the same way as for a `write: claude` task (see "If Issues Are Discovered" below).

**Why the orchestrator, not the actor, reads and marks the task.** Historically the `write: claude` path (above) instructed the dispatched Claude sub-agent to call `TaskGet` as its first action and `TaskUpdate` as its last. Per `prompt.md`'s "Учесть при реализации" note (2026-08-06, see also `20260806-improve-codereview-convergence` item 7), that channel does not work in practice: sub-agents were confirmed (via `ToolSearch`, on two separate test sub-agents) to have no access to `TaskGet`/`TaskUpdate` at all. **That breakage is now fixed** — `20260806-improve-codereview-convergence` rewrote those two steps (see the `write: claude` block above: the sub-agent works from the task content already in its dispatch prompt, and returns a completion summary the orchestrator reads before calling `TaskUpdate` itself). Both paths therefore now agree on who holds these tools, and both reach the same place from different directions: a Codex actor invoked via `codex-companion.mjs` is not a Claude sub-agent at all, and has no access to these framework tools whatsoever — not merely "unavailable from sub-agent context" the way the `write: claude` case turned out to be, but genuinely inapplicable, since it isn't a Claude Code sub-agent in the first place. The orchestrating `pf-execute` session already holds `TaskGet`/`TaskUpdate` access (it is what called `TaskCreate` in Phase 1), so for delegated tasks it reads the task before the call and marks it complete after the call returns, instead of asking the actor to do either.

### If Issues Are Discovered
- Use `TaskCreate` to add new fix/bug tasks
- Set appropriate dependencies so fixes run in correct order
- Continue with other independent tasks

---

## Phase 3: Completion Summary

Before reporting, run `git status --porcelain`. If anything is still uncommitted (e.g. a final wave's changes), commit it: `git add -A` then `git commit -m "chore: finalize implementation [ISSUE-ID]"`, then push it per `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push", Step 3). Every task's changes must be committed **and pushed** on the issue branch by the end of this phase; include that procedure's one-line git report in the summary below.

## Phase 3.5: Completeness Gate (blocking, before the completion report)

Before providing the report below, run these checks — mechanical, deterministic scans of `implementation_plan.md` and `test_plan.md`'s Status Tracker, never a matter of judgment about whether coverage looks adequate. This gate belongs only here: per US-4 it is an output gate on *handing this stage's work off* to `/pf-codereview` — not an input gate `/pf-codereview` itself runs — so `/pf-codereview` does not repeat it. **Every check below is a hard stop.** A failing check blocks reporting this stage complete — noting the gap in the summary and moving on anyway is not an option here; that is exactly what did not hold in the source incident (`20260709-feat-dockerize`, finding 4).

**Check 1 — every plan checkbox is done (AC-4.1), scoped to Auto TCs.** Mechanically scan `implementation_plan.md` for any remaining `- [ ]` line. For each one found, extract every `TC-\d+` literal it names and look up each one's `Type` column in `test_plan.md`'s Status Tracker (the same cross-reference the reverse-direction check below also uses). This is fail-closed: a still-unchecked line blocks this gate unless it names at least one TC-ID AND every TC-ID it names satisfies all three of — (a) it has a row in the Status Tracker at all, (b) that row's `Type` column is present and non-empty, and (c) that `Type` is exactly `Manual`. Concretely, each of the following still blocks: the line names no TC-ID at all; a named TC-ID has no Status Tracker row (a typo, a rename, or a fabricated ID such as `TC-999`); a named TC-ID's `Type` column is missing or empty; or the line names a mix of `Manual` and non-`Manual` (including `Auto`) TC-IDs together. The single exception — the only shape of unchecked line this check lets through — is one where every TC-ID it names exists in the tracker and every one of them is `Type: Manual` (this plan's own TC-027/TC-009/TC-019/TC-020 lines close only after a live run held post-`/pf-execute`), since Manual TCs close later via `/pf-test`'s manual checklist / `/pf-manual-test`, never here. The carve-out is narrow by construction — one mechanical table lookup per named TC-ID, never "any unchecked line is fine." **This check only works because of the per-task checkbox-write step added to Phase 2, "Execution Strategy" point 6 above — run Check 1 only after every wave has already gone through that write step.** A remaining Auto-TC `- [ ]` found after that point names a genuinely unfinished task; a gate that instead read its own successful writes as still-missing would be a false block, not a real gap.

**Check 2 — every `code` task has a test, forward direction (AC-4.2).** Applies only to tasks whose `**Task Type:**` is `code` (or absent, per Phase 2's missing-field default). For every such task, its own `**Mapped Test Cases:**` field must name at least one `TC-\d+` — a TC-ID mentioned only in the task's prose, outside that field, does not count. Naming a `TC-\d+` literal is not enough on its own: every `TC-\d+` it names must also exist as a row in `test_plan.md`'s Status Tracker — the same fail-closed cross-reference Check 2b below applies to `tests` tasks (a missing row still blocks). A `code` task whose Mapped Test Cases names only a fabricated ID (e.g. `TC-999`, no Status Tracker row at all) still fails this check, even though the field is syntactically well-formed — a composite gate that only checked form let exactly this self-certify against a made-up case (CR-013) while Check 1 and Check 3 both stayed green. This is the direction that would have caught rounds 5 and 8 of `20260709-feat-dockerize` (functionality declared, not built): every code task has a real test named in its own Mapped Test Cases field, or Check 2 blocks.

**Check 2b — `tests`-typed tasks name a TC in Acceptance Criteria (AC-4.2, `tests` variant).** For every task whose `**Task Type:**` is `tests`, its `**Acceptance Criteria:**` section must name at least one `TC-\d+` literal — prose is fine there, unlike the machine-parsed `**Mapped Test Cases:**` field. That field is **not** empty for a `tests`-typed task by convention — it carries a short prose rationale instead of TC numbers (e.g. `нет — infrastructure task: …`), because the field is machine-parsed, so a TC-ID sitting in its prose would be misread as a real mapping; the TC-IDs a `tests` task exercises belong to its paired `code` task instead. Naming a `TC-\d+` literal is not enough on its own: every `TC-\d+` named in Acceptance Criteria must also exist as a row in `test_plan.md`'s Status Tracker — the same fail-closed cross-reference Check 1 above applies (a missing row still blocks). A `tests` task with an empty `Mapped Test Cases:` field and no `TC-\d+` anywhere in its Acceptance Criteria blocks this gate exactly like Check 2 does for `code` tasks; so does one whose Acceptance Criteria names only a TC-ID with no Status Tracker row at all (e.g. a fabricated `TC-999`) — that is a real, untracked gap, not a passing case, even though the field is syntactically well-formed.

**Check 3 — every TC has a task, reverse direction (AC-4.3).** For every TC row in `test_plan.md`'s Status Tracker, at least one task's `**Mapped Test Cases:**` field in `implementation_plan.md` must name it — a mention anywhere else in the plan's prose does not count. Every test case is mapped to a task via that field, or Check 3 blocks. This is a different gap from Check 2/2b (a requirement nobody picked up, not a task nobody tested) and does not substitute for either.

Every check above is a mechanical, deterministic scan or table lookup — none of them is phrased as "use your judgment whether coverage looks adequate," and none should ever become one.

After all tasks are complete, and the completeness gate above passes, provide:

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
- **`TaskList` is for high-level wave/task-count bookkeeping only** (e.g. "how many tasks remain in this wave"), not per-task completion tracking — per Phase 2 point 6 above, `TaskList`/`TaskGet` does not reflect real completion for `write: claude` tasks; only each sub-agent's own final summary does.
- **Dependencies are critical** - ensure tasks don't start before their blockers complete
- **Keep sub-agent context focused** - each sub-agent only needs info for its specific task
- **Commits happen at wave boundaries, run by the orchestrator only** - never inside a parallel task sub-agent, and never inside a delegated (`write != claude`) actor call either. This is the only point in the pipeline where code (as opposed to planning docs) gets committed, so don't skip it even for a single-wave plan.
- **Role resolution is per task, not per wave or per plan** - a single wave can freely mix `write: claude` and `write: codex` tasks; each task resolves its own `code`/`tests` role independently (see "Execution Strategy" point 2).
- **No write/review independence check here** - a task written by Codex may also be reviewed by Codex if the issue's `roles.code.review` is configured that way (see Task 4 / BRD Non-Goals). `pf-execute` does not add its own check for this.
