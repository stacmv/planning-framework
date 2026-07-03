---
name: pf-impl-plan
description: Create the implementation plan (implementation_plan.md) for the active issue, mapped to test cases
version: 3.0.0
---

Determine the active issue from `docs/issues/open/`. Before checking any other prerequisite, read `prompt.md`'s frontmatter. If it has no `size_tier` field, ask the user via `AskUserQuestion` — same 4 tier options and descriptions as in `skills/pf-size-tiers/SKILL.md`, recommending medium ("matches today's default behavior") — then write the answer into `prompt.md`'s frontmatter before proceeding with the rest of this skill.

Check prerequisites: `test_plan.md` must exist. If not, stop: "Test plan is required. Run /pf-test-plan first."
If `implementation_plan.md` already exists, stop and inform the user — IMPL_PLAN stage is already complete.

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
