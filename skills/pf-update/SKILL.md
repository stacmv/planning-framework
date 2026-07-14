---
name: pf-update
description: Update Planning Framework skills to the latest version from the framework source repo
version: 3.0.0
---

Update the installed Planning Framework skills to the latest version.

## Managed Skills

The update script **discovers skills by globbing `skills/*/SKILL.md` in the framework repo** — it never reads the list below, and a new skill is picked up without editing this file. The list is documentation only; keep it in sync, but the script is the source of truth.

All 16 skills:

- `pf` — orchestrator: shows active issue status and next step
- `pf-help` — framework overview and quick-start
- `pf-brd` — Business Requirements Document generation
- `pf-spec` — technical spec authoring
- `pf-check` — pipeline document consistency review
- `pf-test-plan` — test plan generation
- `pf-impl-plan` — implementation plan creation
- `pf-execute` — implementation execution via sub-agents
- `pf-test` — run tests for the active issue
- `pf-manual-test` — local Manual Test UI for `manual_test_checklist.md`
- `pf-qa` — QA checklist execution
- `pf-qa-setup` — QA environment setup
- `pf-close` — issue closure workflow
- `pf-autopilot` — autonomous drive of the active issue to `/pf-close` with a self-resume schedule
- `pf-update` — this skill (self-updates)
- `pf-size-tiers` — reference data: tier definitions and document budgets (not directly invoked)

## Step 1: Find the framework source

Look for the planning-framework repo in common locations by running:
```
find ~/dev ~/projects ~/code /home -maxdepth 3 -name "update-skills.sh" -path "*/planning-framework/*" 2>/dev/null | head -5
```

If found, use that path. If not found, ask the user: "Where is the planning-framework repo on your machine?"

## Step 2: Run the update

Run the update script:
```
bash <path-to-planning-framework>/scripts/update-skills.sh
```

Show the output to the user ([new], [updated], [unchanged] per skill).

## Step 3: Reconcile the project's `.pf-version`

Updating the skills without touching `.pf-version` lets the marker drift silently: the project claims one framework version while running another. So, after the update:

1. Read the framework version from the framework repo — `PF_VERSION` in `scripts/converge-to-v3.sh`.
2. Read the current project's `.pf-version` (the file at the repo root of the project `/pf-update` was invoked in).
3. Compare:
   - **Match** — say so in one line and move on. Nothing to do.
   - **Mismatch or `.pf-version` missing entirely** — do **not** rewrite the file yourself: the marker is written by convergence, together with the layout and documents it stands for. Print a recommendation instead, naming both versions:
     "This project's `.pf-version` says `<project-version>`, the framework is `<framework-version>`. Run convergence to bring the project up to date: `make converge` in the project, or `bash <path-to-planning-framework>/scripts/converge-to-v3.sh --target <project-path>`."
     (If `.pf-version` is absent, say "This project has no `.pf-version` marker" and give the same recommendation.)

## Step 4: Report

Tell the user which skills were updated, report the `.pf-version` verdict from Step 3, and confirm the skills are now active in this session.
