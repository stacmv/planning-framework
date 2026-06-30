# Planning Framework v3.0

> **Claude Code users:** Run `/pf` to see your active issue status and next step.

Planning Framework is an issue-based workflow for tracking development work across AI agent sessions, supporting Claude Code, Gemini CLI, and Qwen Code.

---

## Issue Naming Convention

**Format:** `YYYYMMDD-{type}-{slug}`

**Types:**
- `feat` — New feature
- `improve` — Enhancement to existing feature
- `bug` — Fix existing functionality

**Example:** `20240127-feat-add-authentication`

---

## Issue Folder Structure

All issues live under `docs/issues/open/{issue-id}/` while active, moved to `docs/issues/closed/` at closure.

### feat
```
prompt.md             # Original user request
brd.md                # Business requirements document
specs.md              # Technical specifications
test_plan.md          # Test plan
implementation_plan.md # Task breakdown with checkboxes
session-log.md        # Per-session progress entries
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
analysis.md           # Root cause analysis
test_plan.md
implementation_plan.md
session-log.md
```

---

## Workflow Pipelines

### feat
```
CREATE → BRD → SPEC → TEST_PLAN → IMPL_PLAN → /pf-execute → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

### improve
```
CREATE → BRD → TEST_PLAN → IMPL_PLAN → /pf-execute → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

### bug
```
CREATE → ANALYSIS → TEST_PLAN → IMPL_PLAN → /pf-execute → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

**[user check]** = confirm approach with user before writing code (after BRD/ANALYSIS, before TEST_PLAN).

---

## Branch Strategy

Each issue gets its own branch, created before implementation begins:

```
issue/YYYYMMDD-type-slug
```

Issue files (`implementation_plan.md`, `session-log.md`) live on the issue branch and are only visible on the parent branch after the issue is merged at closure.

**Parent branches:** `develop` or `main`
**Merge at closure:** merge commit (preserves history)

---

## Multi-Agent Tracking

Tag all session log entries and commits with your agent name:

**Session log format:**
```
[Claude Code] 2024-01-27: Implemented auth endpoint, 3/5 tasks done
[Gemini CLI] 2024-01-28: Fixed token refresh bug
[Qwen Code] ✓ Closed issue 20240127-feat-add-authentication
```

**Git commit format:**
```
feat: add authentication endpoint

Co-Authored-By: Claude Sonnet <noreply@anthropic.com>
```

---

## QA Gates

Before closing any issue, QA must pass per `.qa-workflow.md`.

Minimum requirements:
- Linting/formatting passes
- All existing tests pass
- New tests added for new behaviour
- Documentation updated if needed
- For bugs: failing test exists before fix, passes after

Do not close an issue until QA passes and user confirms completion.

---

## Global Files

Located at `docs/planning/`:

| File | Purpose | Updated when |
|------|---------|--------------|
| `implementation-plan.md` | Roadmap and active issue links | Issue opened or closed |
| `session-log.md` | One-line entries per issue closure | Issue closed |
| `decisions.md` | Architectural decisions (ADRs) | Significant decision made |

Global files show the roadmap and history. Real-time execution detail lives in issue branches.

---

## Issue Lifecycle

```
open/YYYYMMDD-type-slug/   →   closed/YYYYMMDD-type-slug/
```

**At closure:**
1. QA passes
2. User confirms
3. Merge `issue/YYYYMMDD-type-slug` → parent branch
4. Move `docs/issues/open/{id}` → `docs/issues/closed/{id}`
5. Add one-line entry to `docs/planning/session-log.md`
6. Promote significant decisions to `docs/planning/decisions.md`
7. Update `docs/planning/implementation-plan.md`
8. Commit: `Close issue YYYYMMDD-type-slug: Description`

---

## Agent Rules

- One issue per session
- One branch per issue
- Update `session-log.md` after every session
- Check off tasks in `implementation_plan.md` as completed
- Never close without QA passing and user confirmation
- Document architectural decisions in `decisions.md` (issue-level, then promote at closure)

---

**Framework Version:** 3.0
**Last Updated:** 2026-06-24
