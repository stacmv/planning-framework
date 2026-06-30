---
name: pf-update
description: Update Planning Framework skills to the latest version from the framework source repo
version: 3.0.0
---

Update the installed Planning Framework skills to the latest version.

## Managed Skills

The following skills are discovered and updated automatically:

- `pf` — orchestrator: shows active issue status and next step
- `pf-help` — framework overview and quick-start
- `pf-brd` — Business Requirements Document generation
- `pf-spec` — technical spec authoring
- `pf-check` — pipeline document consistency review
- `pf-test-plan` — test plan generation
- `pf-impl-plan` — implementation plan creation
- `pf-execute` — implementation execution via sub-agents
- `pf-test` — run tests for the active issue
- `pf-qa` — QA checklist execution
- `pf-qa-setup` — QA environment setup
- `pf-close` — issue closure workflow
- `pf-update` — this skill (self-updates)

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

## Step 3: Report

Tell the user which skills were updated and confirm they are now active in this session.
