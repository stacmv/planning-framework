---
name: pf-help
description: Show Planning Framework overview, skill descriptions, and quick-start instructions for new users
version: 3.0.0
---

Display the following help text exactly:

---

# Planning Framework v3.0

A structured workflow for AI-assisted software development. Every feature or fix goes through a design pipeline before any code is written.

## How it works

Each task lives in an **issue folder** under `docs/issues/open/YYYYMMDD-type-slug/`.
Run `/pf` at any time to see where you are and what to do next.

## Workflow by issue type

**Feature** (`feat`):
> BRD → Spec → ✓ Check → Test Plan → ✓ Check → Implementation Plan → ✓ Check → Execute

**Improvement** (`improve`):
> BRD → ✓ Check → Test Plan → ✓ Check → Implementation Plan → ✓ Check → Execute

**Bug fix** (`bug`):
> Root Cause Analysis → ✓ Check → Test Plan → ✓ Check → Implementation Plan → ✓ Check → Execute

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
| `/pf-update` | Update all skills to the latest version |
| `/pf-help` | Show this help |

## Quick start

1. Open Claude Code in your project
2. Run `/pf` — if no issue exists, describe what you want to build and the AI creates the issue folder
3. Follow the next step shown by `/pf` at each stage
4. Run `/pf-check` after each document before moving to the next stage

## Issue folder contents

| Type | Documents |
|---|---|
| feat | `prompt.md`, `brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md` |
| improve | `prompt.md`, `brd.md`, `test_plan.md`, `implementation_plan.md` |
| bug | `prompt.md`, `analysis.md`, `test_plan.md`, `implementation_plan.md` |

## Installing in a new project

```bash
bash ~/dev/planning-framework/scripts/setup-planning-v3.sh
```

## Updating skills

Run `/pf-update` inside Claude Code, or:
```bash
bash ~/dev/planning-framework/scripts/update-skills.sh
```

---
