# Planning Framework v3.0 — [Project Name]

> **Claude Code users:** run `/pf` to see the active issue, its current stage, and the next step.

Planning Framework is an issue-based workflow for tracking development work across AI agent
sessions. It works with Claude Code, Gemini CLI and Qwen Code; the `/pf-*` skills listed below are
the Claude Code front end for it.

---

## Issue Naming Convention

**Format:** `YYYYMMDD-{type}-{slug}`

**Types:**
- `feat` — new feature
- `improve` — enhancement to an existing feature
- `bug` — fix broken behaviour

**Example:** `20240127-feat-add-authentication`

---

## Issue Folder Structure

Every issue lives in `docs/issues/open/{issue-id}/` while it is active and is moved to
`docs/issues/closed/{issue-id}/` at closure.

### feat
```
prompt.md               # Original user request
brd.md                  # Business requirements
specs.md                # Technical specification
test_plan.md            # Test plan
implementation_plan.md  # Task breakdown with checkboxes
session-log.md          # Per-session progress entries
```

### improve
```
prompt.md
brd.md
test_plan.md
implementation_plan.md
session-log.md
```

### bug
```
prompt.md
analysis.md             # Root cause analysis
test_plan.md
implementation_plan.md
session-log.md
```

Small issues carry fewer documents: a `trivial` issue keeps a single `notes.md` instead of the
`brd.md`/`analysis.md` + `specs.md` chain. The size tier is chosen when the issue is created — the
tiers and their document budgets are defined in the `pf-size-tiers` skill.

---

## Workflow Pipelines

Each stage produces one document, and a stage may only start once every stage before it is
complete. A document that does not exist, is empty, or still carries a `TODO: Run /pf-…` marker
does **not** count as a completed stage.

### feat
```
CREATE → BRD → SPEC → TEST_PLAN → IMPL_PLAN → EXECUTE → TESTING → QA → CLOSED
```

### improve
```
CREATE → BRD → TEST_PLAN → IMPL_PLAN → EXECUTE → TESTING → QA → CLOSED
```

### bug
```
CREATE → ANALYSIS → TEST_PLAN → IMPL_PLAN → EXECUTE → TESTING → QA → CLOSED
```

**[user check]** — confirm the approach with the user before any code is written (after
BRD/ANALYSIS, before TEST_PLAN).

---

## Skills

| Skill | What it does |
|---|---|
| `/pf` | Orchestrator: shows the active issue, completed stages and the next step |
| `/pf-help` | Framework overview and quick start |
| `/pf-brd` | Business requirements (`brd.md`, or `notes.md` for a trivial issue) |
| `/pf-spec` | Technical specification (`specs.md`) |
| `/pf-test-plan` | Test plan (`test_plan.md`) |
| `/pf-impl-plan` | Implementation plan (`implementation_plan.md`) |
| `/pf-check` | Reviews the document produced last, reports problems by priority |
| `/pf-execute` | Executes the implementation plan, task by task |
| `/pf-test` | Runs the tests, updates the status tracker, generates the manual checklist |
| `/pf-manual-test` | Manual test UI for filling in `manual_test_checklist.md` |
| `/pf-qa` | Runs `.qa-workflow.md`, produces `qa_report.md` with a PASS/FAIL verdict |
| `/pf-qa-setup` | Creates or updates `.qa-workflow.md` for this project |
| `/pf-close` | Closes the issue: merges the branch, archives the folder, updates the session log |
| `/pf-update` | Updates the installed skills from the framework repository |
| `/pf-size-tiers` | Reference data: size tiers and document budgets (read by the other skills) |

---

## Branch Strategy

Each issue gets its own branch, created before implementation starts:

```
issue/YYYYMMDD-type-slug
```

The planning documents (`prompt.md`, `brd.md`, `specs.md`, `test_plan.md`,
`implementation_plan.md`) are committed to the **parent branch** as soon as `/pf-execute` starts —
before the issue branch is created — so they are visible on `develop`/`main` immediately instead of
waiting for the issue to be merged. Only the code changes made while implementing the issue live on
the issue branch; they reach the parent branch when the issue is merged at closure.

**Parent branches:** `develop` or `main`
**Merge at closure:** merge commit (preserves history)

---

## Multi-Agent Tracking

Tag every session-log entry and every commit with your agent name.

**Session log:**
```
[Claude Code] <date>: Implemented auth endpoint, 3/5 tasks done
[Gemini CLI]  <date>: Fixed token refresh bug
[Qwen Code]   ✓ Closed issue 20240127-feat-add-authentication
```

**Commit message:**
```
feat: add authentication endpoint

Co-Authored-By: Claude Sonnet <noreply@anthropic.com>
```

---

## QA Gates

Before an issue is closed, QA must pass according to `.qa-workflow.md` in the repository root.

That file is **project-specific** and is not shipped with the framework: run `/pf-qa-setup` to
generate one that matches this project's build, lint and test commands.

Minimum requirements:
- Linting/formatting passes
- All existing tests pass
- New behaviour is covered by new tests
- Documentation updated where needed
- For bugs: a failing test exists before the fix and passes after it

Never close an issue before QA passes and the user confirms.

---

## Global Files

Located in `docs/planning/`:

| File | Purpose | Updated when |
|---|---|---|
| `implementation-plan.md` | Roadmap and links to active issues | An issue is opened or closed |
| `session-log.md` | One line per closed issue | An issue is closed |
| `decisions.md` | Architectural decisions (ADRs) | A significant decision is made |
| `templates/` | Reference copies of the framework documents | Refreshed by the framework |

The global files hold the roadmap and the history; the real-time detail of the work lives in the
issue folders. `docs/planning/templates/` is a **framework artifact** — it is mirrored from the
framework itself, so anything you add there will be removed again; do not edit it.

---

## Issue Lifecycle

```
open/YYYYMMDD-type-slug/   →   closed/YYYYMMDD-type-slug/
```

**At closure (`/pf-close`):**
1. QA passes
2. The user confirms
3. `issue/YYYYMMDD-type-slug` is merged into the parent branch
4. `docs/issues/open/{id}` → `docs/issues/closed/{id}`
5. A one-line entry is added to `docs/planning/session-log.md`
6. Significant decisions are promoted to `docs/planning/decisions.md`
7. `docs/planning/implementation-plan.md` is updated
8. Commit: `Close issue YYYYMMDD-type-slug: Description`

---

## Agent Rules

- One issue per session
- One branch per issue
- Update `session-log.md` after every session
- Check off tasks in `implementation_plan.md` as you complete them
- Never skip a pipeline stage, and never work against a document that does not exist yet
- Never close an issue without a passing QA and the user's confirmation
- Record architectural decisions in the issue's `decisions.md`, promote them at closure

---

**Framework Version:** 3.0

The machine-readable version marker of this installation is `.pf-version` in the repository root.
