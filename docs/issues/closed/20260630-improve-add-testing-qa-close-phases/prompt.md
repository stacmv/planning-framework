# Prompt: Add Testing, QA and Close Issue Phases

**Date:** 2026-06-30
**Type:** improve
**Reporter:** stacmv

## Request

Add the missing end-of-lifecycle phases to Planning Framework v3.0. Currently the framework covers only the initial development stages and ends at the implementation phase (`/pf-execute`). The full lifecycle needs three additional phases:

### 1. Testing phase (`/pf-test`)
- Run automated tests for the project and record results in `test_plan.md` Status Tracker
- Extract Manual test cases from `test_plan.md` and generate a separate `manual_test_checklist.md` file in the issue folder — a clean standalone file for an external tester (no framework context, just the steps)
- Requires `test_plan.md` to distinguish Auto vs Manual test cases (update template)

### 2. QA phase (`/pf-qa`)
- Execute the project's `.qa-workflow.md` checklist (linting, security audit, pre-merge checks)
- Record results in `qa_report.md` in the issue folder
- Block `/pf-close` until QA passes

### 3. Close issue phase (`/pf-close`)
- Requires `qa_report.md` with no blockers
- Merge issue branch into parent branch
- Move issue folder: `docs/issues/open/ → docs/issues/closed/`
- Append one-line entry to global `docs/planning/session-log.md`
- Commit everything

### Updated workflow (all types)
```
... → /pf-execute → IMPL → /pf-test → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

### Supporting changes needed
- Update `test_plan.md` template: add `Type` column (Auto/Manual) to test cases and Status Tracker
- Update `/pf` orchestrator: recognize TESTING and QA stages, suggest correct next step
- Update `PLANNING.md`: document the full workflow including new phases
- Add new templates: `manual_test_checklist.md`, `qa_report.md`
