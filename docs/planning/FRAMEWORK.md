# Planning Framework v3.0 - Complete Guide

**Version:** 3.0.0
**Last Updated:** 2026-06-24

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [Issue Workflow](#issue-workflow)
5. [Skills](#skills)
6. [Pipeline Enforcement](#pipeline-enforcement)
7. [File Structure](#file-structure)
8. [Agent Guidelines](#agent-guidelines)
9. [Best Practices](#best-practices)
10. [Multi-Agent Support](#multi-agent-support)
11. [Customization](#customization)
12. [Troubleshooting](#troubleshooting)
13. [FAQ](#faq)

---

## Overview

Planning Framework v3.0 is an **issue-based workflow system** designed for AI-assisted development across multiple sessions and branches, with a skills layer for Claude Code that enforces a structured document pipeline.

### The Problem

When working with AI agents across multiple sessions:
- Context is lost between sessions
- Planning files grow unbounded
- Feature branches conflict on shared planning docs
- No structured way to track features/bugs
- Implementation starts before requirements are clear

### The Solution

Planning Framework v3.0 solves these problems through:

**Issue-Based Workflow:**
- Each task gets its own issue folder
- Issues contain complete context (BRD, spec, test plan, implementation plan, progress)
- Global files stay minimal (roadmap only)
- No merge conflicts (issue folders are branch-specific)

**Skills-Based Workflow (Claude Code):**
- `/pf` shows active issue status and next step at session start
- BRD → spec → test plan → implementation plan pipeline for feat/improve issues
- Skills enforce prerequisites — each stage requires the prior one to exist
- `/pf-check` verifies cross-document consistency at any point

**Multi-Agent Support:**
- Single `PLANNING.md` config works for Claude/Gemini/Qwen
- Agent names tracked in session logs
- Consistent workflow across all agents

**Quality Gates:**
- `.qa-workflow.md` defines quality requirements
- `test_plan.md` required before any implementation begins
- QA must pass before closing issues

### Key Benefits

✅ **Bounded File Sizes** - Global files stay small, execution details in issues
✅ **No Merge Conflicts** - Issue folders are branch-specific
✅ **Better Context** - Agent reads only relevant issue
✅ **Natural Archival** - Closed issues out of sight
✅ **Structured Pipeline** - Requirements before code
✅ **Multi-Agent** - Works with Claude Code, Gemini CLI, Qwen Code

---

## Getting Started

### Quick Setup (5 Minutes)

**One command, whatever the project starts from** — no framework, v1, v2, half-migrated, or an incomplete v3 install:

```bash
# 1. Get Planning Framework
git clone https://github.com/[your-org]/planning-framework
cd planning-framework

# 2. Converge the project on v3 (installs framework + skills + the `pf` shim,
#    migrates v1/v2 layouts, tops up whatever is missing — idempotent)
make converge TARGET=/path/to/your-project

# 3. Commit the framework
cd /path/to/your-project
git add . && git commit -m "Setup Planning Framework v3.0"

# 4. Start working!
# Run /pf-qa-setup to create .qa-workflow.md, then ask your AI agent for your
# first issue, or run /pf
```

Preview without changing anything:

```bash
./scripts/converge-to-v3.sh --target /path/to/your-project --dry-run
```

There is no separate setup or migration script — `converge` is the single entry point. For what it does to existing issues, the backup and the flags, see [MIGRATION-GUIDE-V3.md](MIGRATION-GUIDE-V3.md).

### What Gets Created

```
your-project/
├── PLANNING.md                      # Framework config
├── .qa-workflow.md                  # QA requirements
├── docs/
│   ├── issues/
│   │   ├── open/                    # Active issues
│   │   └── closed/                  # Completed issues
│   └── planning/
│       ├── implementation-plan.md   # Roadmap (stays small!)
│       ├── session-log.md           # Timeline
│       └── decisions.md             # Architectural decisions
```

---

## Core Concepts

### 1. Issues

**Issues are the unit of work.** Each feature/bug/improvement gets its own issue.

**Issue Naming:** `YYYYMMDD-{type}-{slug}`
- Example: `20240127-feat-add-authentication`
- Date ensures uniqueness across branches
- Type visible at glance (feat/bug/improve)
- Slug provides readability

**Issue Folder Structure:**
```
docs/issues/open/20240127-feat-add-auth/
├── prompt.md                  # Original user request
├── analysis.md                # Understanding + metadata
├── implementation-plan.md     # Task breakdown
├── session-log.md             # Progress tracking
├── decisions.md               # (optional) Issue decisions
└── definition-of-done.md      # (optional) Completion criteria
```

### 2. Branches

**One branch per issue:** `issue/YYYYMMDD-{type}-{slug}`
- 1:1 mapping with issue folder
- Example: `issue/20240127-feat-add-auth`
- Clean isolation, no conflicts

### 3. Global Files

**Stay minimal** - only roadmap, not execution details:

**`docs/planning/implementation-plan.md`:**
- Current milestone overview
- Active issues (with links)
- Planned issues (not started)
- High-level roadmap (2-3 milestones)

**`docs/planning/session-log.md`:**
- One-line entries when issues close
- Format: `[Agent] ✓ [issue-id](link) - Description`
- Ad-hoc work (not tied to issues)

**`docs/planning/decisions.md`:**
- Architectural decisions (ADRs)
- Promoted from closed issues
- Can be split by topic when large

### 4. Quality Assurance

**`.qa-workflow.md`** defines quality gates:
- All issues: linting, tests, docs, security
- Features: integration tests, user docs
- Bugs: failing test → fix → passing test

**QA must pass before closing issues.**

---

## Issue Workflow

### Document Sets by Issue Type

Different issue types require different document sets:

| Document | feat | improve | bug |
|----------|------|---------|-----|
| `prompt.md` | required | required | required |
| `brd.md` | required | required | - |
| `specs.md` | required | required | - |
| `analysis.md` | - | - | required |
| `test_plan.md` | required | required | required |
| `implementation_plan.md` | required | required | required |
| `session-log.md` | required | required | required |
| `decisions.md` | optional | optional | optional |

### Pipeline: feat

```
CREATE → BRD → SPEC → TEST_PLAN → IMPL_PLAN → /pf-execute → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

Use `/pf-brd`, `/pf-spec`, `/pf-test-plan`, `/pf-impl-plan`, `/pf-execute`, `/pf-test`, `/pf-qa`, `/pf-close` in order.
Run `/pf-check` at any point to verify consistency across documents.

### Pipeline: improve

```
CREATE → BRD → TEST_PLAN → IMPL_PLAN → /pf-execute → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

Improve issues skip the spec step — BRD goes directly to test plan.

### Pipeline: bug

```
CREATE → ANALYZE → TEST_PLAN → IMPL_PLAN → /pf-execute → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

Bugs skip BRD/spec and go straight to analysis + test plan (write the failing test first).

### Full Lifecycle

All issue types follow the same end-to-end stages, differing only in their planning documents:

| Stage | feat | improve | bug | Skill |
|-------|------|---------|-----|-------|
| Create | CREATE | CREATE | CREATE | (manual) |
| Plan | BRD → SPEC | BRD | ANALYSIS | `/pf-brd`, `/pf-spec` |
| Test Plan | TEST_PLAN | TEST_PLAN | TEST_PLAN | `/pf-test-plan` |
| Impl Plan | IMPL_PLAN | IMPL_PLAN | IMPL_PLAN | `/pf-impl-plan` |
| Implement | IMPLEMENT | IMPLEMENT | IMPLEMENT | `/pf-execute` |
| Testing | TESTING | TESTING | TESTING | `/pf-test` |
| QA | QA | QA | QA | `/pf-qa` |
| Close | CLOSED | CLOSED | CLOSED | `/pf-close` |

**Task tools are optional in the IMPLEMENT stage.** `/pf-execute` uses Claude Code's task-tracking tools (`TaskCreate`/`TaskList`/`TaskGet`/`TaskUpdate`) only as a progress mirror. Since Claude Code 2.1.233 those tools are disabled by default on the newer models, and `/pf-execute` detects that and carries on: the `- [ ]`/`- [x]` checkboxes in the issue's `implementation_plan.md` are the completion ledger the stage and its completeness gate actually read. To get the progress display back, start the CLI with `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` in its environment (e.g. the `env` block of `settings.json`) and restart — nothing about the pipeline changes either way.

**TESTING stage** — `/pf-test` runs the automated test suite, updates the Status Tracker in `test_plan.md`, and generates `manual_test_checklist.md` for scenarios that require human verification.

**Test attribution.** TC-IDs restart at TC-001 in every issue, so a test's TC-ID alone does not say which issue it belongs to — test files carry an `@pf-issue` marker to make that explicit. A per-test marker, written as a comment directly above the test, names the issue and (optionally) the TC-IDs it covers: `// @pf-issue 20260825-feat-modeleval TC-001, TC-002`. A file-level header marker, in the file's first ~10 lines, sets the default issue for every test in the file that has no marker of its own: `# @pf-issue 20260825-feat-modeleval`. A per-test marker always wins over the file header. `/pf-test` resolves each test's owning issue this way before mapping it to a TC (see `skills/pf-test/SKILL.md` Phase 3.2).

**QA stage** — `/pf-qa` executes every check defined in `.qa-workflow.md` and writes `qa_report.md` with a PASS or FAIL verdict. The issue cannot be closed until this report shows PASS. Use `/pf-qa-setup` to create or update `.qa-workflow.md` for the project.

**CLOSE stage** — `/pf-close` merges the issue branch to the parent, moves the issue folder from `open/` to `closed/`, appends a one-line entry to `docs/planning/session-log.md`, promotes significant decisions, and commits everything.

### Phase 1: Create

**When to create issue:**
- Non-trivial work (>15 minutes)
- Multi-file changes
- New features
- Bug fixes requiring investigation

**Agent behavior:**
- For non-trivial work: Ask user "Should I create issue for this?"
- For trivial fixes: Work directly, log in global session-log

```bash
mkdir docs/issues/open/20240127-feat-add-auth/
# Create prompt.md with user's original request
```

### Phase 2: BRD (feat/improve) or Analyze (bug)

**feat/improve — run `/pf-brd`:**

Creates `brd.md` covering business requirements, user stories, success criteria, scope, and constraints.

**bug — fill out `analysis.md`:**

```yaml
---
created: 2024-01-27
type: bug
branch: issue/20240127-bug-login-crash
status: open
---
```

Analysis includes problem description, reproduction steps, root cause hypothesis, proposed fix, and risks.

### Phase 3: Spec (feat/improve only)

Run `/pf-spec` — creates `specs.md` from `brd.md`.

Spec covers technical design, API contracts, data models, component breakdown, and non-functional requirements.

### Phase 4: Test Plan

Run `/pf-test-plan` — creates `test_plan.md` from `specs.md` (feat/improve) or `analysis.md` (bug).

All issues require `test_plan.md` before implementation begins.

### Phase 5: Implementation Plan

Run `/pf-impl-plan` — creates `implementation_plan.md` from `test_plan.md`.

Breaks work into phases with detailed task checklists. `/pf-execute` refuses to run without this file.

### Phase 6: Implement

Run `/pf-execute` or work manually:

```bash
# Create issue branch
git checkout -b issue/20240127-feat-add-auth

# Work through implementation_plan.md
# Update session-log.md after each session
```

**Rules:**
- ✅ ONE issue per session (focused work)
- ✅ Update session-log.md after each session
- ✅ Check off tasks in implementation_plan.md
- ✅ Document blockers immediately
- ✅ Create decisions.md if architectural decisions made
- ✅ Commit frequently with clear messages

### Phase 7: QA

**Run QA workflow from `.qa-workflow.md`:**

```bash
npm run lint
npm test
npm run test:integration
# Check documentation
# Review security
```

**Must pass:**
- [ ] Linting/formatting
- [ ] All existing tests pass
- [ ] New tests added (covering test_plan.md scenarios)
- [ ] Documentation updated
- [ ] (Bugs) Failing test created, then passes

### Phase 8: Close

**Prerequisites:**
- [ ] QA workflow passes
- [ ] User confirms completion
- [ ] No outstanding blockers

**Closure steps:**

```bash
# 1. Merge to parent branch
git checkout develop
git merge issue/20240127-feat-add-auth

# 2. Move issue to closed
mv docs/issues/open/20240127-feat-add-auth docs/issues/closed/

# 3. Update global session-log.md (one-line entry)
echo "[Claude Code] ✓ [20240127-feat-add-auth](../issues/closed/20240127-feat-add-auth/) - Added JWT authentication" >> docs/planning/session-log.md

# 4. Promote significant decisions to global decisions.md

# 5. Update global implementation-plan.md

# 6. Commit
git add .
git commit -m "Close issue 20240127-feat-add-auth: Added JWT authentication"
```

---

## Skills

28 Claude Code skills live in the `skills/` directory — one directory per skill, each holding a `SKILL.md`. They are installed into `~/.claude/skills/` by `converge-to-v3.sh` and refreshed by `update-skills.sh`.

| Skill | Command | What it does |
|-------|---------|-------------|
| `pf/` | `/pf` | Shows active issue, current pipeline stage, and next recommended action |
| `pf-help/` | `/pf-help` | Framework overview, skill descriptions, quick start for new users |
| `pf-brd/` | `/pf-brd` | Creates `brd.md` for a feat/improve issue (or `notes.md` at the trivial tier) |
| `pf-spec/` | `/pf-spec` | Creates `specs.md` from `brd.md` |
| `pf-check/` | `/pf-check` | Reviews the most recent pipeline document for problems |
| `pf-test-plan/` | `/pf-test-plan` | Creates `test_plan.md` from `specs.md` or `analysis.md` |
| `pf-impl-plan/` | `/pf-impl-plan` | Creates `implementation_plan.md` from `test_plan.md` |
| `pf-execute/` | `/pf-execute` | Executes the implementation plan via sub-agents; requires a complete pipeline |
| `pf-codereview/` | `/pf-codereview` | Hard gate: reviews the issue's code diff (Claude/Codex/both), blocks on open P0/P1 findings |
| `pf-test/` | `/pf-test` | Runs automated tests, updates the Status Tracker, generates `manual_test_checklist.md` |
| `pf-manual-test/` | `/pf-manual-test` | Launches the local Manual Test UI to fill in `manual_test_checklist.md` |
| `pf-qa/` | `/pf-qa` | Runs QA checks from `.qa-workflow.md`, produces `qa_report.md` with a PASS/FAIL verdict |
| `pf-qa-setup/` | `/pf-qa-setup` | Creates or updates `.qa-workflow.md` for the project |
| `pf-close/` | `/pf-close` | Merges the issue branch to parent, archives the issue folder, updates session-log |
| `pf-autopilot/` | `/pf-autopilot` | Drives the active issue to `/pf-close` autonomously; a self-resume schedule survives session limits and connection drops |
| `pf-update/` | `/pf-update` | Updates the installed skills from the framework source repo |
| `pf-size-tiers/` | `/pf-size-tiers` | Reference data: size-tier definitions and document budgets, read by the other skills |
| `pf-git/` | `/pf-git` | Reference data: the commit & push procedure that closes every stage, read by the other skills |
| `pf-roles/` | `/pf-roles` | Reference data: the write/review actor-resolution matrix, read by the other skills |
| `pf-user-docs/` | `/pf-user-docs` | Writes user-facing documentation (README/CHANGELOG/user guide) for the active issue |
| `pf-dev-docs/` | `/pf-dev-docs` | Writes developer-facing documentation (architecture/ADRs/runbook) for the active issue |
| `pf-idea/` | `/pf-idea` | Writes `idea.md` via guided intake already captured in `prompt.md` |
| `pf-idea-research/` | `/pf-idea-research` | Writes `research.md`, verified/unverified facts with sources |
| `pf-idea-critique/` | `/pf-idea-critique` | Writes `critique.md` via independent multi-persona review |
| `pf-idea-verdict/` | `/pf-idea-verdict` | Writes `verdict.md` and runs the end-of-pipeline decision session |
| `pf-idea-spike/` | `/pf-idea-spike` | Writes `hypothesis.md` and `findings.md` for a technical spike |
| `pf-idea-lenses/` | `/pf-idea-lenses` | Reference data: idea_tier lenses/personas/budgets/stage tables, read by the other skills |
| `pf-interaction/` | `/pf-interaction` | Reference data: the front-loaded interaction rule, read by the other skills |

### Updating Skills

To propagate skill updates to all consumer projects registered with the framework:

```bash
./scripts/update-skills.sh
```

---

## Pipeline Enforcement

Skills check prerequisites before running:

- `/pf-spec` requires `brd.md` to exist
- `/pf-test-plan` requires `specs.md` (feat/improve) or `analysis.md` (bug)
- `/pf-impl-plan` requires `test_plan.md`
- `/pf-execute` requires `implementation_plan.md`
- `/pf-test` requires implementation to be underway or complete (checks for issue branch)
- `/pf-qa` requires `manual_test_checklist.md` or runs directly from `.qa-workflow.md`
- `/pf-close` requires `qa_report.md` with PASS verdict
- `/pf-check` reports any missing or inconsistent documents

If a prerequisite is missing, the skill explains what needs to be done first rather than proceeding with incomplete context.

---

## File Structure

### Complete Directory Structure

**In your project:**

```
project/
├── PLANNING.md                          # Framework config
├── .pf-version                          # Framework version stamp
├── CLAUDE.md                            # With one <!-- pf:begin --> … <!-- pf:end --> section
├── .qa-workflow.md                      # QA requirements — written by /pf-qa-setup
│
└── docs/
    ├── issues/
    │   ├── open/                        # Active issues
    │   │   └── 20240127-feat-add-auth/
    │   │       ├── prompt.md            # Original request
    │   │       ├── brd.md               # Business requirements (feat/improve)
    │   │       ├── specs.md             # Technical spec (feat/improve)
    │   │       ├── analysis.md          # Analysis (bug)
    │   │       ├── test_plan.md         # Test plan (all types)
    │   │       ├── implementation_plan.md  # Task breakdown
    │   │       ├── session-log.md       # Progress log
    │   │       └── decisions.md         # (optional) Issue decisions
    │   │
    │   └── closed/                      # Completed issues (archived)
    │       └── 20240126-feat-user-dashboard/
    │           └── [same structure as open issues]
    │
    └── planning/
        ├── implementation-plan.md       # Roadmap + issue links
        ├── session-log.md               # One-line timeline
        ├── decisions.md                 # Global ADRs
        │
        └── templates/                   # Framework templates (mirrors the framework's)
            ├── issue/                   # Issue file templates
            ├── global/                  # Global planning templates
            ├── config/                  # Config templates
            └── README.md
```

**In your home directory** — installed by `converge` (skills are per-user, not per-project):

```
~/.claude/
├── bin/
│   └── pf                               # Global shim → the onboarding TUI
└── skills/                              # 17 skills — one directory per skill
    ├── pf/SKILL.md                      # /pf — status + next step
    ├── pf-help/SKILL.md                 # /pf-help — overview + quick start
    ├── pf-brd/SKILL.md                  # /pf-brd — create BRD
    ├── pf-spec/SKILL.md                 # /pf-spec — create spec
    ├── pf-check/SKILL.md                # /pf-check — review latest document
    ├── pf-test-plan/SKILL.md            # /pf-test-plan — create test plan
    ├── pf-impl-plan/SKILL.md            # /pf-impl-plan — create impl plan
    ├── pf-execute/SKILL.md              # /pf-execute — execute the plan
    ├── pf-test/SKILL.md                 # /pf-test — run tests + manual checklist
    ├── pf-manual-test/SKILL.md          # /pf-manual-test — Manual Test UI
    ├── pf-qa/SKILL.md                   # /pf-qa — QA checks + qa_report.md
    ├── pf-qa-setup/SKILL.md             # /pf-qa-setup — create/update .qa-workflow.md
    ├── pf-close/SKILL.md                # /pf-close — merge, archive, update log
    ├── pf-autopilot/SKILL.md            # /pf-autopilot — drive the issue to closure
    ├── pf-update/SKILL.md               # /pf-update — refresh installed skills
    ├── pf-size-tiers/SKILL.md           # Reference data (tiers, budgets)
    ├── pf-git/SKILL.md                  # Reference data (stage commit & push)
    ├── pf-roles/SKILL.md                # Reference data (write/review actor resolution)
    ├── pf-user-docs/SKILL.md            # /pf-user-docs — write user-facing docs
    └── pf-dev-docs/SKILL.md             # /pf-dev-docs — write developer-facing docs
```

**In the framework repo:**

```
planning-framework/
└── scripts/
    ├── converge-to-v3.sh                # The single entry point: install / migrate / top up
    ├── update-skills.sh                 # Propagate skill updates
    └── issue-status.sh                  # Issue status across remote branches
```

---

## Agent Guidelines

### For AI Assistants

**Session Start Checklist:**

**For Claude Code:** Run `/pf` — it reads active issue context and shows the current pipeline stage and next step automatically.

**For other agents:**

1. **Read global context:**
   - `PLANNING.md` - Framework instructions
   - `docs/planning/implementation-plan.md` - Current roadmap
   - `docs/planning/session-log.md` (last 20 lines) - Recent activity

2. **If working on issue, read:**
   - `docs/issues/open/{issue-id}/prompt.md`
   - `docs/issues/open/{issue-id}/brd.md` or `analysis.md` (depending on type)
   - `docs/issues/open/{issue-id}/implementation_plan.md`
   - `docs/issues/open/{issue-id}/session-log.md`

3. **Read project context:**
   - `docs/planning/decisions.md` - Architectural decisions
   - `.qa-workflow.md` - Quality requirements

**During Work:**

✅ **DO:**
- Focus on ONE issue per session
- Update session-log.md after working
- Check off tasks in implementation-plan.md
- Document blockers immediately
- Ask user before creating issues (if unsure)
- Document architectural decisions
- Commit frequently with clear messages
- Tag session entries with agent name

❌ **DON'T:**
- Work on multiple issues in one session
- Skip QA workflow
- Close issue without user confirmation
- Auto-delete branches
- Skip reading context files
- Make architectural decisions without documenting

**Session End Checklist:**

- [ ] Update issue session-log.md
- [ ] Check off completed tasks in implementation_plan.md
- [ ] Note blockers and next priorities
- [ ] Commit changes with clear message

---

## Best Practices

Best practices covered in this guide and in [QUICKSTART.md](QUICKSTART.md):
- When to create issues
- Writing good analysis
- Breaking down tasks
- Documentation standards
- Git hygiene

---

## Multi-Agent Support

Single `PLANNING.md` works for:
- Claude Code
- Gemini CLI
- Qwen Code
- Any AI agent

Tag session entries with agent name:
```
[Claude Code] ✓ [issue-id](link) - Description
```

---

## Customization

Customize for your project:
- Issue types (add refactor, docs, test, chore, etc.)
- QA workflow (add performance, accessibility, security checks)
- Global file format (add sprint tracking, metrics, etc.)

See templates and PLANNING.md for customization guidance.

---

## Troubleshooting

**File growth?** Split decisions.md by topic
**Context lost?** Check issue folder, global files, closed issues
**Conflicts?** Shouldn't happen (report as bug)
**Dependencies?** Document in analysis.md

See complete troubleshooting guide in full documentation.

---

## FAQ

**Q: How is v2.0 different from v1.0?**
A: Issue-based workflow, bounded global files, no merge conflicts, multi-agent support

**Q: Required vs optional files?**
A: Required: prompt.md, analysis.md, implementation-plan.md, session-log.md
Optional: decisions.md, definition-of-done.md

**Q: Can I work on multiple issues per session?**
A: Recommended ONE per session, but flexible if needed

See complete FAQ in full documentation.

---

## Additional Resources

**Documentation:**
- [QUICKSTART.md](QUICKSTART.md) - 5-minute getting started
- [MIGRATION-GUIDE-V3.md](MIGRATION-GUIDE-V3.md) - Converge any project on v3.0
- [templates/README.md](templates/README.md) - Template usage
- [v1.0-archive/MIGRATION-GUIDE-v1-to-v2.md](v1.0-archive/MIGRATION-GUIDE-v1-to-v2.md) - Historical v1.0 → v2.0 guide (do not execute)

**Scripts:**
- `scripts/converge-to-v3.sh` - The single entry point: install, migrate or top up
- `scripts/update-skills.sh` - Propagate skill updates to consumer projects
- `scripts/issue-status.sh` - Issue status across remote branches

---

**Framework Version:** 3.0.0
**Last Updated:** 2026-06-24

Happy coding with Planning Framework v3.0! 🚀
