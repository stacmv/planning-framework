# BRD: Planning Framework v3.0

**Version:** 1.0
**Date:** 2026-06-22
**Status:** Approved

---

## Interview Notes

**Method:** User interview via AskUserQuestion — AI interviewed before writing anything, per stated preference.

**Key answers:**
- Primary user: solo developer working across 10+ projects, with occasional collaborators using Gemini CLI or Qwen Code
- Collaborators need to: understand what stage a feature is at, and run the workflow with a non-Claude agent
- Both daily pains are equally felt: PLANNING.md bloat AND no structured design pipeline
- BRD stage: AI interviews first, drafts only after gathering answers
- Success = pipeline consistently followed AND prompt updates propagate to all projects automatically
- Pipeline order must be enforced: skills check prerequisites and refuse if missing
- Scale: 10+ consumer projects — propagation is essential, not optional

---

## Executive Summary

Planning Framework v3.0 solves two compounding problems for a solo developer managing 10+ AI-assisted projects: a duplicated, bloated `PLANNING.md` that diverges across projects and never receives improvements, and a workflow that lets features jump from idea to code with no structured design phase. v3.0 replaces per-project PLANNING.md guidance with installable Claude Code skills and introduces a gated BRD → spec → test plan → implementation plan pipeline before any code is written.

---

## Problem Statement

**Problem 1 — Documentation drift:**
Each consumer project contains a copy of `PLANNING.md` (~420 lines). When the framework improves, those improvements never reach existing projects. Each copy drifts as users customise it. There is no update mechanism.

**Problem 2 — Missing design gate:**
The current workflow (prompt → analysis → implementation-plan) has no formal requirements, specification, or test thinking before implementation begins. Mistakes and misalignments surface during coding, not before. There is no traceability from business goal to test case to code.

---

## Goals

| # | Goal |
|---|---|
| G1 | Claude-specific workflow guidance lives in skills, not duplicated in consumer project files |
| G2 | Every feature goes through a gated BRD → spec → test plan → implementation plan pipeline before implementation |
| G3 | A skill cannot proceed to the next stage unless the prerequisite document exists |
| G4 | Prompt improvements can be distributed to all 10+ consumer projects by running one script |
| G5 | Non-Claude agents (Gemini CLI, Qwen Code) can participate in the same project using PLANNING.md |
| G6 | Any collaborator can open an issue folder and immediately understand what stage it is at |

---

## Non-Goals

- Web UI, dashboard, or visual kanban
- Changing the issue folder naming convention (`YYYYMMDD-type-slug`)
- Changing the branch-per-issue strategy
- Replacing the QA workflow (`.qa-workflow.md`)
- Supporting AI agents beyond Claude Code, Gemini CLI, Qwen Code

---

## Users

| User | Context |
|---|---|
| **Primary: Solo developer** | Works across 10+ projects. Uses Claude Code daily. Wants fast setup and consistent workflow. Main beneficiary of skill distribution. |
| **Secondary: Collaborator** | Joins occasionally. Uses Gemini CLI or Qwen Code, or reads docs manually. Needs PLANNING.md to remain meaningful and issue stage to be visible from folder contents. |

---

## User Stories

### US-01: As a developer starting a new feature, I want to be interviewed about the problem before any document is written, so that the BRD reflects real requirements, not assumptions.

**Acceptance Criteria:**
- AC-01a: Invoking `/pf-brd` starts an interview — Claude asks questions about the problem, goals, and users before writing anything.
- AC-01b: The BRD is drafted only after the interview, not before.
- AC-01c: The BRD contains no technical implementation details.
- AC-01d: Interview notes are preserved in the BRD under a dedicated section.

---

### US-02: As a developer, I want skills to enforce pipeline order so that I cannot accidentally skip stages.

**Acceptance Criteria:**
- AC-02a: `/pf-spec` refuses to run if `brd.md` does not exist in the active issue folder, and tells me why.
- AC-02b: `/pf-test-plan` refuses to run if its prerequisites are missing.
- AC-02c: `/pf-impl-plan` refuses to run if `test_plan.md` does not exist.
- AC-02d: `/pf-execute` refuses to run if `implementation_plan.md` does not exist.

---

### US-03: As a developer maintaining 10+ projects, I want to distribute improved prompts to all consumer projects by running one script, so that I never edit skill files manually across projects.

**Acceptance Criteria:**
- AC-03a: Running `scripts/update-skills.sh` in a consumer project copies the latest skill files from the framework source.
- AC-03b: The script reports each file as `[updated]`, `[unchanged]`, or `[new]`.
- AC-03c: Each skill file carries a version number so I can see what is installed.
- AC-03d: The `/pf` orchestrator displays the installed version.

---

### US-04: As a developer, I want the `/pf` orchestrator to tell me what stage I am at and what to do next, so that I do not need to remember the pipeline.

**Acceptance Criteria:**
- AC-04a: `/pf` scans the active issue folder and identifies which stage documents exist.
- AC-04b: `/pf` outputs the issue type, completed stages, and the exact next command to run.
- AC-04c: If no active issue exists, `/pf` explains how to create one.

---

### US-05: As a Gemini CLI or Qwen Code user collaborating on the same project, I want PLANNING.md to describe the issue structure and document expectations, so that I can participate without Claude Code.

**Acceptance Criteria:**
- AC-05a: PLANNING.md remains at the consumer project root after v3.0 setup.
- AC-05b: PLANNING.md describes which documents belong in each issue type (feat/improve/bug).
- AC-05c: PLANNING.md describes the workflow stages so a non-Claude agent can follow them.
- AC-05d: PLANNING.md is ≤220 lines (Claude-specific detail removed, moved to skills).

---

### US-06: As a collaborator opening an issue folder, I want to immediately understand what stage the feature is at, so that I don't need to ask the developer.

**Acceptance Criteria:**
- AC-06a: The presence or absence of `brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md` in the issue folder unambiguously signals the completed stages.
- AC-06b: No tool is needed to read this state — it is visible from folder contents alone.

---

### US-07: As a developer working on a bug fix, I want a focused workflow that skips BRD and spec but still requires a test plan before implementation.

**Acceptance Criteria:**
- AC-07a: Bug issues contain `analysis.md` (root-cause doc) instead of `brd.md`.
- AC-07b: Bug issues do not get `specs.md`.
- AC-07c: `/pf` detects the issue type from the folder name prefix (`bug`) and suggests the correct next stage.
- AC-07d: `/pf-test-plan` works for bug issues reading from `analysis.md`.

---

### US-08: As the framework author, I want to remove `create-issue.sh` and `close-issue.sh` from the framework, as they add maintenance burden and are rarely used.

**Acceptance Criteria:**
- AC-08a: Both scripts are deleted from this repo.
- AC-08b: `migrate-v2-to-v3.sh` removes them from consumer projects it migrates.
- AC-08c: No workflow step depends on these scripts — issue folders are created manually or documented as a simple `mkdir`.

---

## Document Sets by Issue Type

| Type | Documents |
|---|---|
| **feat** | `prompt.md`, `brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md`, `session-log.md` |
| **improve** | `prompt.md`, `brd.md`, `test_plan.md`, `implementation_plan.md`, `session-log.md` |
| **bug** | `prompt.md`, `analysis.md`, `test_plan.md`, `implementation_plan.md`, `session-log.md` |

---

## Workflow Stages

**Feature:**
`CREATE → BRD (interview) → SPEC → [check SPEC vs BRD] → TEST_PLAN → [check TEST_PLAN vs BRD] → IMPL_PLAN → [check IMPL_PLAN vs BRD+SPEC] → IMPLEMENT → QA → CLOSE`

**Improve:**
`CREATE → BRD (interview) → TEST_PLAN → [check TEST_PLAN vs BRD] → IMPL_PLAN → [check IMPL_PLAN vs BRD] → IMPLEMENT → QA → CLOSE`

**Bug:**
`CREATE → ANALYZE → TEST_PLAN → [check TEST_PLAN vs ANALYZE] → IMPL_PLAN → [check IMPL_PLAN vs ANALYZE] → IMPLEMENT → QA → CLOSE`

Each check stage reads the latest document against its predecessors and blocks progress if P0/P1 issues are found.

---

## Success Metrics

- Every new feature in any consumer project goes through the full BRD → spec → test plan → pipeline before a line of code is written.
- Prompt updates reach all 10+ projects via `update-skills.sh` with no manual file editing.
- PLANNING.md is ≤220 lines in consumer projects.
- No `create-issue.sh` or `close-issue.sh` in any consumer project post-migration.
- Collaborators using Gemini CLI or Qwen Code can participate using PLANNING.md alone.
