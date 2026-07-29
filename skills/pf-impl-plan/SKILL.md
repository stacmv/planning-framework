---
name: pf-impl-plan
description: Create the implementation plan (implementation_plan.md) for the active issue, mapped to test cases
version: 3.0.0
---

Determine the active issue from `docs/issues/open/`. Before checking any other prerequisite, read `prompt.md`'s frontmatter. If it has no `size_tier` field, ask the user via `AskUserQuestion` — same 4 tier options and descriptions as in `~/.claude/skills/pf-size-tiers/SKILL.md`, recommending medium ("matches today's default behavior") — then write the answer into `prompt.md`'s frontmatter before proceeding with the rest of this skill.

**Input gate — this one stays a hard stop.** Check prerequisites: `test_plan.md` must be **complete** per the shared definition of "stage complete" in `~/.claude/skills/pf-size-tiers/SKILL.md` ("Stage completion") — do not restate the criterion here. If it is missing, or exists but is not complete (empty, carrying the stub marker, or with an incomplete stage behind it), **stop**: "Test plan is required. Run /pf-test-plan first." A stub is not an input.

> **Run the check, do not recall it.** Your FIRST action at this gate is a tool call — `ls -1 docs/issues/open/<ISSUE-ID>/` — and you judge from its output, not from any document already in your context. Manual testing found this gate silently failing to fire when `test_plan.md` had been **deleted**: the file was gone from disk but still present in the session's context, so the skill proceeded. See "Evaluating it is a MECHANICAL check" in `pf-size-tiers`. A gate that can be satisfied from memory is not a gate.

**Output gate — `implementation_plan.md` already present (regenerate / keep / cancel).** If `implementation_plan.md` already exists, do **not** stop outright — a migrated v2 issue arrives with one already in place (renamed from `implementation-plan.md`), and a hard stop locks its owner out of their own plan. Judge it against the same shared definition in `~/.claude/skills/pf-size-tiers/SKILL.md`, then ask the user via `AskUserQuestion`, stating whether it is complete or an incomplete stub:
- **regenerate** — dispatch the sub-agent below and overwrite it with a plan mapped to the current `test_plan.md` (recommend this when it is not complete, or when it predates the test plan it must map to);
- **keep** — leave it untouched and stop, reporting that the IMPL_PLAN stage is already complete (recommend this when it is complete);
- **cancel** — stop and change nothing.

**Oversized-predecessor guard.** Before writing `implementation_plan.md`, recompute the oversized-for-tier check against `test_plan.md` (and `specs.md`/`brd.md` where applicable). Do this with a lightweight **mechanical count** only — e.g. `wc -l` on `specs.md`/`brd.md`, or counting `### TC-` headings in `test_plan.md` for its case count — **not** a full semantic `Read` of the document. This is the same "do not read documents yourself" tension pf-test-plan's guard resolves the same way: the mechanical count is not a semantic read, and the sub-agent dispatched below still does the full reading and drafting once it runs. Budget for `test_plan.md`: trivial >4 cases, small >10 cases, medium >20 cases (large has no cap). If oversized, stop with a message naming the offending file, the tier, and the actual count vs. budget, and pointing at "run /pf-check to review, then either trim the document or re-classify the issue's size_tier in prompt.md."

Read `size_tier` from `prompt.md`.

**If `trivial`:** stop immediately with exactly: "This is a trivial-tier issue — the implementation plan is already covered by `notes.md`. Next step: `/pf-test-plan`." Do not create `implementation_plan.md`.

**If `small`:** omit the "Dependencies" and "Complexity Estimate" sections from the template passed to the sub-agent below; target ≤150 lines total.

**If medium/large:** unchanged from today — Dependencies and Complexity Estimate sections present, no new line-count cap. Large tier's `implementation_plan.md` may additionally include a "Phased Rollout" section describing multi-stage deployment.

**Do not read these documents, analyze the codebase, or draft the plan yourself.** Dispatch a single sub-agent (Agent tool, default/general-purpose type — no need for a fork) to do it. Give it the issue ID, the `size_tier`, and the full task below (small tier: pass the template with "Dependencies"/"Complexity Estimate" omitted, per above). Instruct it to read `brd.md`, `specs.md` (if present), and `test_plan.md` itself, analyze the codebase as needed, write the result directly to `docs/issues/open/[ISSUE-ID]/implementation_plan.md`, and return only a short summary (task count, complexity estimate, files touched) — not the document contents, since the orchestrator does not need them.

Tell the sub-agent to also read the `doc_language` field from `prompt.md`'s YAML frontmatter (default: English if absent) and write the plan's prose content (overview, implementation notes, descriptions) in that language, keeping headings, file paths, and structural labels (e.g. `Task N`, `Mapped Test Cases`, `Acceptance Criteria`) in English/as-is so downstream tooling keeps working.

## Task to pass to the sub-agent

Create a detailed implementation plan that maps to the test cases.

### Step 1: Analyze Test Cases

For each test case (TC-NNN):
- What functionality must exist?
- What files need to be created/modified?
- What dependencies are needed?

### Step 2: Create Task Breakdown

Group test cases into implementation tasks:

```markdown
## Implementation Plan: [Feature Name]

### Overview
[Brief description]

### Files to Create/Modify
[List all files]

### Implementation Tasks

#### Task 1: [Name]
**Mapped Test Cases:** TC-001, TC-002, TC-003
**Files:**
- `path/to/file1` - [description]
- `path/to/file2` - [description]

**Implementation Notes:**
- [Key detail 1]
- [Key detail 2]

**Acceptance Criteria:**
- [ ] TC-001 passes
- [ ] TC-002 passes
- [ ] TC-003 passes
```

### Step 3: Identify Dependencies

**Skip this step (and the "Dependencies" section of the template) if `size_tier: small`.**

- What order should tasks be implemented?
- Any external dependencies?

### Step 4: Estimate Complexity

**Skip this step (and the "Complexity Estimate" section of the template) if `size_tier: small`.**

- Simple: 1-2 tasks, straightforward
- Medium: 3-5 tasks, some complexity
- Complex: 6+ tasks, significant work

If `size_tier: large`, the implementation plan may include an additional "Phased Rollout" section describing multi-stage deployment, where applicable.

Save the implementation plan to `docs/issues/open/[ISSUE-ID]/implementation_plan.md`. For `size_tier: small`, target ≤150 lines total.

Every test case must map to a task. Tasks should be completable in one session.

Where [ISSUE-ID] means: scan docs/issues/open/ and use the active issue folder name.

Once the sub-agent returns, relay its summary to the user.

## Close the stage: commit & push

After relaying the summary, run the shared commit & push procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push") as the last action of this skill. The orchestrator does this, never the sub-agent. Do not restate the procedure here: it defines what to stage, the commit message, the push guard, and the one-line report. A stage is not finished until its document is committed and pushed.
