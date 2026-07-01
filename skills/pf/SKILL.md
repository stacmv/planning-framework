---
name: pf
description: Planning Framework orchestrator — shows active issue, completed stages, and next step
version: 3.0.0
---

You are the Planning Framework v3.0 orchestrator. When invoked as `/pf`, perform the following steps exactly.

## Step 1: Read installed version

Read the file `~/.claude/skills/pf/SKILL.md` and extract the value of the `version:` field from its YAML frontmatter. This is the installed version to display. If the file cannot be read, display "unknown".

## Step 2: Scan for open issues

List the contents of `docs/issues/open/` (if it exists). Collect all subdirectories whose names match the pattern `YYYYMMDD-TYPE-SLUG` where TYPE is one of `feat`, `improve`, or `bug` and YYYYMMDD is an 8-digit date.

## Step 3: Handle zero or multiple issues

**No issue folders found:**
Output:
```
Planning Framework v<VERSION>
No open issues found.

Tell me what you want to build or fix and I'll create the issue folder and prompt.md for you.
```
Stop here. When the user responds with the task description, follow "Creating prompt.md" below before writing the file.

**Multiple issue folders found:**
Output:
```
Planning Framework v<VERSION>
Multiple open issues found:
  1. <ISSUE-ID-1>
  2. <ISSUE-ID-2>
  ...

Which issue would you like to work on?
```
Stop here and wait for the user to specify.

## Step 4: Single active issue — detect type

For the single issue folder found, extract TYPE from the folder name:
- Folder starts with `YYYYMMDD-feat-` → type is **feat**
- Folder starts with `YYYYMMDD-improve-` → type is **improve**
- Folder starts with `YYYYMMDD-bug-` → type is **bug**

## Step 5: Detect completed stages

Check which documents exist inside the issue folder (`docs/issues/open/<ISSUE-ID>/`):

| Document present | Stage completed |
|---|---|
| `prompt.md` | CREATE |
| `brd.md` | BRD |
| `specs.md` | SPEC |
| `analysis.md` | ANALYSIS (bug type only) |
| `test_plan.md` | TEST_PLAN |
| `implementation_plan.md` | IMPL_PLAN |
| `manual_test_checklist.md` | TESTING |
| `qa_report.md` | QA |

List all completed stages in order.

## Step 6: Determine next step

Use the type-specific workflow below. The "current position" is the last completed stage.

### feat workflow
```
CREATE → /pf-brd → BRD → /pf-spec → SPEC → /pf-check → (check passes) → /pf-test-plan → TEST_PLAN → /pf-check → (check passes) → /pf-impl-plan → IMPL_PLAN → /pf-check → (check passes) → /pf-execute
```

| Last completed stage | Next step |
|---|---|
| CREATE only | `/pf-brd` |
| BRD | `/pf-spec` |
| SPEC | `/pf-check` |
| SPEC + check passed (no blocking issues noted) | `/pf-test-plan` |
| TEST_PLAN | `/pf-check` |
| TEST_PLAN + check passed | `/pf-impl-plan` |
| IMPL_PLAN | `/pf-check` |
| IMPL_PLAN + check passed | `/pf-execute` |
| IMPL_PLAN | `/pf-test` |
| TESTING | `/pf-qa` |
| QA | `/pf-close` |

### improve workflow
```
CREATE → /pf-brd → BRD → /pf-check → (check passes) → /pf-test-plan → TEST_PLAN → /pf-check → (check passes) → /pf-impl-plan → IMPL_PLAN → /pf-execute
```

| Last completed stage | Next step |
|---|---|
| CREATE only | `/pf-brd` |
| BRD | `/pf-check` |
| BRD + check passed | `/pf-test-plan` |
| TEST_PLAN | `/pf-check` |
| TEST_PLAN + check passed | `/pf-impl-plan` |
| IMPL_PLAN | `/pf-execute` |
| IMPL_PLAN | `/pf-test` |
| TESTING | `/pf-qa` |
| QA | `/pf-close` |

### bug workflow
```
CREATE → ANALYSIS → /pf-check → (check passes) → /pf-test-plan → TEST_PLAN → /pf-check → (check passes) → /pf-impl-plan → IMPL_PLAN → /pf-execute
```

| Last completed stage | Next step |
|---|---|
| CREATE only (no analysis.md) | Ask the user to describe the bug, then write `analysis.md` (root cause, reproduction steps, impact) to the issue folder, in the language recorded in `prompt.md`'s `doc_language` frontmatter field (default English) |
| ANALYSIS present | `/pf-check` |
| ANALYSIS + check passed | `/pf-test-plan` |
| TEST_PLAN | `/pf-check` |
| TEST_PLAN + check passed | `/pf-impl-plan` |
| IMPL_PLAN | `/pf-execute` |
| IMPL_PLAN | `/pf-test` |
| TESTING | `/pf-qa` |
| QA | `/pf-close` |

**Note on "check passed":** A check is considered passed when `test_plan.md` or `implementation_plan.md` exists at the stage where a check would have produced them. If the next document in sequence is already present, treat the check as having passed.

## Step 7: Output

Print the status block:

```
Planning Framework v<VERSION>
Active issue: <ISSUE-ID>  (type: feat/improve/bug)
Completed stages: <STAGE1>, <STAGE2>, ...
Next step: /<next-command>
```

If no stages are completed yet (only the folder exists with no documents), ask the user to describe the task, then follow "Creating prompt.md" below and show:
```
Planning Framework v<VERSION>
Active issue: <ISSUE-ID>  (type: feat/improve/bug)
Completed stages: (none — prompt.md created)
Next step: /pf-brd
```

## Creating prompt.md

Whenever a new issue's `prompt.md` is about to be written (from either path above), first use AskUserQuestion to ask: **"What language should the planning documents for this issue be written in?"** with options English, Russian, and Other (free text). This choice only needs to be asked once per issue.

Write `prompt.md` with a YAML frontmatter block recording the answer, followed by the task description:

```
---
doc_language: English
---

<task description as given by the user>
```

Use the exact language name the user gave (e.g. `Russian`, or whatever they typed for "Other") as the `doc_language` value. Every downstream pf-* skill that produces a document reads this field and writes its prose content in that language, defaulting to English if the field is absent — see each skill's own instructions for specifics.
