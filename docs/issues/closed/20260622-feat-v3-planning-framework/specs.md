# Specs: Planning Framework v3.0

**Version:** 1.0
**Date:** 2026-06-22
**Status:** Approved
**Satisfies:** BRD US-01 through US-07

---

## 1. Repository Structure Changes

```
planning-framework/
├── skills/                          # NEW — source of truth for all skill files
│   ├── pf.md                        # Orchestrator skill
│   ├── pf-brd.md
│   ├── pf-spec.md
│   ├── pf-check.md
│   ├── pf-test-plan.md
│   ├── pf-impl-plan.md
│   └── pf-execute.md
│
├── scripts/
│   ├── setup-planning-v3.sh         # Replaces setup-planning-v2.sh
│   ├── update-skills.sh             # NEW — updates skills in consumer project
│   ├── migrate-v2-to-v3.sh          # NEW — migrates v2 consumer projects
│   └── issue-status.sh              # Kept unchanged
│   # REMOVED: create-issue.sh, close-issue.sh
│
├── docs/planning/templates/issue/
│   ├── prompt.md                    # Unchanged
│   ├── brd.md                       # NEW
│   ├── specs.md                     # NEW
│   ├── test_plan.md                 # NEW
│   ├── implementation_plan.md       # Renamed (was implementation-plan.md)
│   ├── analysis.md                  # Kept (bug issues)
│   └── session-log.md               # Unchanged
│
├── PLANNING.md                      # Slimmed (~200 lines, multi-agent)
├── CLAUDE.md                        # Updated to reference v3.0 and /pf
└── CHANGELOG.md                     # v3.0.0 entry added
```

---

## 2. Skill File Specification

### 2.1 Format

Every skill file in `skills/` follows the Claude Code skill format:

```markdown
---
name: pf-brd
description: <one-line description used by Claude to decide when to activate>
version: 3.0.0
---

<skill body — instructions for Claude when this skill is invoked>
```

The `name` field must exactly match the filename (without `.md`). The `version` field uses semver.

### 2.2 Skill Inventory

| File | Name | Triggers on |
|---|---|---|
| `pf.md` | `pf` | `/pf` — detects active issue stage, shows next command |
| `pf-brd.md` | `pf-brd` | `/pf-brd` — creates BRD for feat/improve issues |
| `pf-spec.md` | `pf-spec` | `/pf-spec` — creates specs for feat issues |
| `pf-check.md` | `pf-check` | `/pf-check` — reviews latest doc vs predecessors |
| `pf-test-plan.md` | `pf-test-plan` | `/pf-test-plan` — creates test plan |
| `pf-impl-plan.md` | `pf-impl-plan` | `/pf-impl-plan` — creates implementation plan |
| `pf-execute.md` | `pf-execute` | `/pf-execute` — runs implementation via sub-agents |

### 2.3 Skill Bodies (Source: Obsidian vault prompts, paths adapted to issue folder)

#### `pf-brd` body
```
Read docs/issues/open/[ISSUE-ID]/prompt.md to understand the project description.

I want to build [read description from prompt.md]. I want you to help me brainstorm
for the business requirement document (BRD) for this project. Focus on business logic
and rules, user stories, and acceptance criteria.
IMPORTANT: DO NOT INCLUDE ANY TECHNICAL IMPLEMENTATION DETAILS.
Use the AskUserQuestion tool to ask me clarifying questions until you are 95% confident
you can complete this task successfully. For each question, add your recommendation
(with reason why) below the options. This would help me in making a better decision.

Save the BRD to docs/issues/open/[ISSUE-ID]/brd.md.
```

#### `pf-spec` body
```
Read docs/issues/open/[ISSUE-ID]/brd.md.

Based on the BRD, write the specs at docs/issues/open/[ISSUE-ID]/specs.md.
Use ASCII diagrams where necessary to illustrate the UI/UX.
Use the AskUserQuestion tool to ask me clarifying questions until you are 95% confident
you can complete this task successfully. For each question, add your recommendation
(with reason why) below the options. This would help me in making a better decision.

If this specs file will be too big (more than 1500 lines), please split it into 3 parts.
Keep the original file as the index file that links to the 3 parts.
```

#### `pf-check` body
```
Read docs/issues/open/[ISSUE-ID]/specs.md (or the most recently produced document),
analyze the codebase context, and tell me what could be the potential problems with
this document. Let's look at it from different angles and try to consider every edge
case. Use ASCII diagrams to illustrate if needed. Don't edit anything yet.
Let's focus on analysis.

After analysis, group findings by priority: P0 (blocker), P1 (important), P2 (minor).

Then ask: shall we address all the P0 and P1 issues?
If yes: update the document. Use the AskUserQuestion tool to ask clarifying questions
until you are 95% confident. For each question, add your recommendation (with reason why).
```

#### `pf-test-plan` body
```
Read docs/issues/open/[ISSUE-ID]/brd.md and (if present) specs.md.

Create a comprehensive test plan that will verify the implementation matches the specs.

### Step 1: Identify Test Scenarios
Based on the specs:
- Happy path flows
- Error conditions
- Edge cases
- State transitions
- Responsive behavior
- Accessibility requirements

### Step 2: Create Test Cases
For each scenario, create detailed test cases:

  ### TC-NNN: [Test Name]
  **Description:** [What this test verifies]
  **Preconditions:**
  - [Required state before test]
  **Steps:**
  | Step | Action | Expected Result |
  |------|--------|-----------------|
  | 1 | [Action] | [Expected] |
  **Test Data:** Field: `value`
  **Expected Outcome:** [Final verification]
  **Priority:** Critical / High / Medium / Low

### Step 3: Organize by Category
- Functional tests
- UI/UX tests
- Validation tests
- Integration tests (if applicable)
- Edge case tests

### Step 4: Create Status Tracker
  | TC | Test Case | Priority | Status | Remarks |
  |----|-----------|----------|--------|---------|

### Step 5: Add Known Issues Section
  | Issue | Description | TC Affected | Steps to Reproduce | Severity |
  |-------|-------------|-------------|-------------------|----------|

Save to docs/issues/open/[ISSUE-ID]/test_plan.md.
Include: overview and objectives, prerequisites, test cases (10-20 typically),
status tracker, known issues section.
```

#### `pf-impl-plan` body
```
Read docs/issues/open/[ISSUE-ID]/brd.md, specs.md (if present), and test_plan.md.
Specs are approved, test plan is ready. Now we need an implementation plan.

### Step 1: Analyze Test Cases
For each test case (TC-NNN):
- What functionality must exist?
- What files need to be created/modified?
- What dependencies are needed?

### Step 2: Create Task Breakdown
Group test cases into implementation tasks:

  #### Task N: [Name]
  **Mapped Test Cases:** TC-001, TC-002
  **Files:**
  - `path/to/file` — [description]
  **Implementation Notes:**
  - [Key detail]
  **Acceptance Criteria:**
  - [ ] TC-001 passes

### Step 3: Identify Dependencies
- What order should tasks be implemented?
- Any external dependencies?

### Step 4: Estimate Complexity
- Simple: 1-2 tasks
- Medium: 3-5 tasks
- Complex: 6+ tasks

Save to docs/issues/open/[ISSUE-ID]/implementation_plan.md.
Every test case must map to a task.
```

#### `pf-execute` body
```
Read docs/issues/open/[ISSUE-ID]/implementation_plan.md, specs.md (if present),
and test_plan.md. All design and planning is complete.

## Phase 1: Task Creation

Before creating tasks:
1. Review implementation_plan.md completely
2. Understand test case expectations from test_plan.md
3. Reference wireframe/prototype for UI (if applicable)

Parse the implementation plan and use TaskCreate for each implementation item:
- Extract all tasks
- Identify dependencies between tasks
- Create each task with: description, mapped TCs, blocked_by, blocks

## Phase 2: Task Execution

1. Group tasks into waves based on dependencies
2. Run each task in its own sub-agent (keeps context usage low)
3. Process waves sequentially — Wave N+1 starts only after Wave N completes

Each sub-agent:
1. Use TaskGet to read full task details
2. Create/modify specified files
3. Implement functionality to pass mapped TCs
4. Self-verify: check code runs, functionality matches test expectations
5. Use TaskUpdate to mark task complete with summary
6. Note any deviations, concerns, or discovered issues

If issues discovered: use TaskCreate to add fix tasks with correct dependencies.

## Phase 3: Completion Summary

1. Summary of changes (files created/modified, functionality added)
2. Self-verification results (what works, concerns, fixes applied)
3. Ready for testing (all tasks complete, setup needed, known limitations)
```

#### `pf` (orchestrator) body
```
Show the installed Planning Framework version (read version: field from
.claude/skills/pf.md frontmatter).

Scan docs/issues/open/ for issue folders.

If one active issue found: detect issue type from folder name prefix (feat/improve/bug),
check which stage documents exist, and output:

  Planning Framework v[X.X.X]
  Active issue: [ISSUE-ID]  (type: feat/improve/bug)
  Completed stages: [list based on which files are present]
  Next step: /pf-[command]

If multiple issues found: list them and ask which to work on.
If no issues found: state that, and explain how to create an issue folder:
  mkdir docs/issues/open/YYYYMMDD-type-slug
  then add prompt.md with the feature/bug description.
```

---

## 3. Issue Document Templates

### 3.1 `brd.md` template
```markdown
# BRD: [Feature Name]

**Version:** 1.0
**Date:** YYYY-MM-DD
**Status:** Draft

## Interview Notes
[Raw notes from the user interview — who was interviewed, key quotes, pain points
raised, constraints mentioned. Preserved verbatim so the BRD is traceable.]

## Executive Summary
[2-3 sentences derived from the interview]

## Problem Statement
[What pain does this solve, as voiced by the user during the interview?]

## Goals
| # | Goal |
|---|---|
| G1 | ... |

## Non-Goals
- ...

## User Stories
[Each story traceable to an interview stage or specific user quote]

### US-01: As a [role], I want [goal] so that [benefit].
**Acceptance Criteria:**
- AC-01a: ...
```

### 3.2 `specs.md` template
```markdown
# Specs: [Feature Name]

**Version:** 1.0
**Date:** YYYY-MM-DD
**Satisfies:** BRD US-XX through US-XX

## 1. Overview
[Brief technical summary]

## 2. File/Directory Structure
[ASCII tree or table]

## 3. Component Specs
[Detailed technical breakdown]

## 4. Data Flows
[ASCII diagrams as needed]
```

### 3.3 `test_plan.md` template
```markdown
# Test Plan: [Feature Name]

**Date:** YYYY-MM-DD

## Overview
[Objectives and scope]

## Test Cases

### TC-001: [Test Name]
**Description:** ...
**Preconditions:** ...
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | ... | ... |
**Priority:** Critical / High / Medium / Low

## Status Tracker
| TC | Test Case | Priority | Status | Remarks |
|----|-----------|----------|--------|---------|
| TC-001 | ... | High | [ ] | |

## Known Issues
| Issue | Description | TC Affected | Severity |
|-------|-------------|-------------|----------|
```

### 3.4 `implementation_plan.md` template
```markdown
# Implementation Plan: [Feature Name]

**Date:** YYYY-MM-DD
**Complexity:** Simple / Medium / Complex

## Overview
[Brief description]

## Files to Create/Modify
[List]

## Implementation Tasks

### Task 1: [Name]
**Mapped Test Cases:** TC-001, TC-002
**Files:**
- `path/to/file` — [description]
**Acceptance Criteria:**
- [ ] TC-001 passes
- [ ] TC-002 passes

## Dependencies
[Task ordering, external deps]

## Complexity Estimate
[Simple/Medium/Complex + rationale]
```

---

## 4. Script Specifications

### 4.1 `setup-planning-v3.sh`

Behavior:
1. Prompt for target project directory (default: current directory).
2. Create `docs/issues/open/`, `docs/issues/closed/`, `docs/planning/`.
3. Copy template files from framework's `docs/planning/templates/` to target.
4. Create `.claude/skills/` in target project.
5. Copy all files from framework's `skills/` to `{target}/.claude/skills/`.
6. Initialize `docs/planning/session-log.md`, `decisions.md`, `implementation-plan.md` from global templates.
7. Print success summary listing installed skill commands.

### 4.2 `update-skills.sh`

Behavior:
1. Accept optional `--source <path>` (default: same directory as the script, i.e. the framework install).
2. Copy each file from `skills/` to `.claude/skills/` in the current directory.
3. For each file, report: `[updated]`, `[unchanged]`, or `[new]`.
4. Print total count.

### 4.3 `migrate-v2-to-v3.sh`

Behavior:
1. Find all `docs/issues/open/*/implementation-plan.md` files and rename to `implementation_plan.md`.
2. Find all open issue folders missing `test_plan.md` and add a stub `test_plan.md`.
3. Delete `scripts/create-issue.sh` and `scripts/close-issue.sh` if present.
4. Print migration report (files renamed, stubs added, scripts removed).

---

## 5. PLANNING.md Slim-Down Spec

**Remove:**
- Claude-specific session start steps (moved to `/pf` skill)
- Claude-specific workflow instructions (moved to individual skills)
- Session end ritual details for Claude (skills handle this)

**Keep:**
- Issue naming convention (`YYYYMMDD-type-slug`)
- Issue folder structure (which files go where, by issue type)
- Branch strategy (one branch per issue)
- Multi-agent tracking format (`[Claude Code]`, `[Gemini CLI]`, `[Qwen Code]`)
- QA gates (reference to `.qa-workflow.md`)
- Global files spec (session-log.md, decisions.md, implementation-plan.md)
- One-line note: *"Claude Code users: run `/pf` for guided workflow."*

**Target:** ~200 lines (down from 422).

---

## 6. Version & Distribution

- Each `skills/pf*.md` file carries `version: 3.0.0` in its frontmatter.
- The `/pf` orchestrator reads and displays this version.
- Future prompt improvements → bump version, commit/tag, consumer runs `update-skills.sh`.
- Breaking changes (renamed files, schema changes) → major version bump + CHANGELOG entry.
