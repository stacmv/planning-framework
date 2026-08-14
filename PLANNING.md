# Planning Framework v4.0

> **Claude Code users:** Run `/pf`. **Codex users:** use the local `pf` skill from `.agents/skills`.

Planning Framework is an issue-based workflow for tracking development work across AI agent sessions. PF4 keeps the same core workflow and adds first-class adapters for Claude Code and Codex.

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
CREATE → BRD → SPEC → TEST_PLAN → IMPL_PLAN → /pf-execute → /pf-codereview → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

### improve
```
CREATE → BRD → TEST_PLAN → IMPL_PLAN → /pf-execute → /pf-codereview → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

### bug
```
CREATE → ANALYSIS → TEST_PLAN → IMPL_PLAN → /pf-execute → /pf-codereview → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

**[user check]** = confirm approach with user before writing code (after BRD/ANALYSIS, before TEST_PLAN).

---

## Branch Strategy

Each issue gets its own branch, created before implementation begins:

```
issue/YYYYMMDD-type-slug
```

Planning docs (`prompt.md`, `brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md`) are committed to the **parent branch** as soon as `/pf-execute` starts — before the issue branch is even created — so they're visible on `develop`/`main` right away rather than waiting for the issue to be merged. Only the code changes made while implementing the issue live on the issue branch, and become visible on the parent branch when the issue is merged at closure.

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
- **Commit and push every completed unit of issue work** — per `<PF_SKILL_ROOT>/pf-git/SKILL.md` ("Stage commit & push"). `<PF_SKILL_ROOT>` is `~/.claude/skills` in Claude Code and `.agents/skills` in Codex.
- Update `session-log.md` after every session
- Check off tasks in `implementation_plan.md` as completed
- Never close without QA passing and user confirmation
- Document architectural decisions in `decisions.md` (issue-level, then promote at closure)

---

**Framework Version:** 4.0
**Last Updated:** 2026-06-24

---

## PF4 multi-agent runtime

PF4 supports Claude Code and Codex as runtime/master agents. The runtime agent owns workflow state
and file edits. A peer reviewer may inspect documents or code, but fixes are applied by the runtime
agent.

Reviewer values in issue frontmatter may be `self`, `peer`, `both`, `claude`, or `codex`. `self`
means the current runtime agent; `peer` means the other supported agent when it is available.
