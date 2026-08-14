---
name: pf-help
description: Show Planning Framework overview, skill descriptions, and quick-start instructions for new users
version: 4.0.0
---

Display the following help text exactly:

---

# Planning Framework v4.0

A structured workflow for AI-assisted software development. Every feature or fix goes through a design pipeline before any code is written.

## How it works

Each task lives in an **issue folder** under `docs/issues/open/YYYYMMDD-type-slug/`.
Run `/pf` in Claude Code, or use the local `pf` skill from `.agents/skills` in Codex, to see where you are and what to do next.

## Workflow by issue type

**Feature** (`feat`):
> BRD → Spec → ✓ Check → Test Plan → ✓ Check → Implementation Plan → ✓ Check → Execute → Test → QA → Close

**Improvement** (`improve`):
> BRD → ✓ Check → Test Plan → ✓ Check → Implementation Plan → ✓ Check → Execute → Test → QA → Close

**Bug fix** (`bug`):
> Root Cause Analysis → ✓ Check → Test Plan → ✓ Check → Implementation Plan → ✓ Check → Execute → Test → QA → Close

## Skills

| Command | What it does |
|---|---|
| `/pf` | Show active issue, completed stages, and next step |
| `/pf-brd` | Interview you about the problem, then write the BRD |
| `/pf-spec` | Write the technical specification based on the BRD |
| `/pf-check` | Review the latest document for inconsistencies and gaps |
| `/pf-test-plan` | Create a test plan with TC-NNN test cases |
| `/pf-impl-plan` | Create an implementation plan mapped to test cases |
| `/pf-execute` | Execute the implementation plan using sub-agents |
| `/pf-test` | Run tests, update the Status Tracker, generate `manual_test_checklist.md` |
| `/pf-manual-test` | Launch the local Manual Test UI to fill in the manual test checklist |
| `/pf-qa-setup` | Create or update `.qa-workflow.md` for this project |
| `/pf-qa` | Run QA checks, confirm manual items, produce `qa_report.md` (PASS/FAIL) |
| `/pf-close` | Close the issue — merge branch, archive folder, update session-log |
| `/pf-autopilot` | Drive the active issue to `/pf-close` autonomously (self-resume schedule survives session limits) |
| `/pf-update` | Update all skills to the latest version |
| `/pf-help` | Show this help |

## Quick start

1. Open Claude Code in your project
2. Run `/pf` — if no issue exists, describe what you want to build and the AI creates the issue folder
3. Follow the next step shown by `/pf` at each stage
4. Run `/pf-check` after each document before moving to the next stage
5. After `/pf-execute`, run `/pf-test` then `/pf-qa` — QA must pass before `/pf-close`

## Issue folder contents

| Type | Documents |
|---|---|
| feat | `prompt.md`, `brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md`, `session-log.md`, `manual_test_checklist.md`, `qa_report.md` |
| improve | `prompt.md`, `brd.md`, `test_plan.md`, `implementation_plan.md`, `session-log.md`, `manual_test_checklist.md`, `qa_report.md` |
| bug | `prompt.md`, `analysis.md`, `test_plan.md`, `implementation_plan.md`, `session-log.md`, `manual_test_checklist.md`, `qa_report.md` |

## Installing in a new project

One command handles every case — a fresh project, an older (v1/v2) one, or an
incomplete v3/v4 one. Run it from the project directory:

```bash
node ~/dev/planning-framework/scripts/pf-cli.mjs converge
```

Or, from the framework repository: `node scripts/pf-cli.mjs converge --target /path/to/project --agents codex --yes`

## Updating skills

Run `/pf-update` inside Claude Code, or:
```bash
node ~/dev/planning-framework/scripts/pf-cli.mjs update-skills
```

---
