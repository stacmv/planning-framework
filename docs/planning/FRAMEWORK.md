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

**For new projects:**

```bash
# 1. Get Planning Framework
git clone https://github.com/[your-org]/planning-framework
cd planning-framework

# 2. Run interactive setup (installs framework + skills)
./scripts/setup-planning-v3.sh
# Follow prompts: project name, issue types, QA requirements

# 3. Commit the framework
git add .
git commit -m "Setup Planning Framework v3.0"

# 4. Start working!
# Ask your AI agent to create your first issue, or run /pf
```

**For existing v2.0 projects:**

```bash
# Migrate from v2.0 to v3.0
./scripts/migrate-v2-to-v3.sh
# Backs up v2.0, installs skills, updates structure, generates report
```

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

**TESTING stage** — `/pf-test` runs the automated test suite, updates the Status Tracker in `test_plan.md`, and generates `manual_test_checklist.md` for scenarios that require human verification.

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

Eleven Claude Code skills live in the `skills/` directory and are installed into consumer projects by `setup-planning-v3.sh` and `update-skills.sh`.

| Skill | Command | What it does |
|-------|---------|-------------|
| `pf.md` | `/pf` | Shows active issue, current pipeline stage, and next recommended action |
| `pf-brd.md` | `/pf-brd` | Creates `brd.md` for a feat/improve issue |
| `pf-spec.md` | `/pf-spec` | Creates `specs.md` from `brd.md` |
| `pf-check.md` | `/pf-check` | Verifies consistency between all pipeline documents |
| `pf-test-plan.md` | `/pf-test-plan` | Creates `test_plan.md` from `specs.md` or `analysis.md` |
| `pf-impl-plan.md` | `/pf-impl-plan` | Creates `implementation_plan.md` from `test_plan.md` |
| `pf-execute.md` | `/pf-execute` | Begins implementation; requires complete pipeline |
| `pf-test.md` | `/pf-test` | Runs automated tests, updates Status Tracker, generates `manual_test_checklist.md` |
| `pf-qa.md` | `/pf-qa` | Runs QA checks from `.qa-workflow.md`, produces `qa_report.md` with PASS/FAIL verdict |
| `pf-qa-setup.md` | `/pf-qa-setup` | Creates or updates `.qa-workflow.md` for the project |
| `pf-close.md` | `/pf-close` | Merges issue branch to parent, archives issue folder, updates session-log |

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

```
project/
├── PLANNING.md                          # Framework config
├── .qa-workflow.md                      # QA requirements
│
├── skills/                              # Claude Code skills
│   ├── pf.md                            # /pf — status + next step
│   ├── pf-brd.md                        # /pf-brd — create BRD
│   ├── pf-spec.md                       # /pf-spec — create spec
│   ├── pf-check.md                      # /pf-check — consistency check
│   ├── pf-test-plan.md                  # /pf-test-plan — create test plan
│   ├── pf-impl-plan.md                  # /pf-impl-plan — create impl plan
│   ├── pf-execute.md                    # /pf-execute — begin implementation
│   ├── pf-test.md                       # /pf-test — run tests + manual checklist
│   ├── pf-qa.md                         # /pf-qa — QA checks + qa_report.md
│   ├── pf-qa-setup.md                   # /pf-qa-setup — create/update .qa-workflow.md
│   └── pf-close.md                      # /pf-close — merge, archive, update log
│
├── docs/
│   ├── issues/
│   │   ├── open/                        # Active issues
│   │   │   └── 20240127-feat-add-auth/
│   │   │       ├── prompt.md            # Original request
│   │   │       ├── brd.md               # Business requirements (feat/improve)
│   │   │       ├── specs.md             # Technical spec (feat/improve)
│   │   │       ├── analysis.md          # Analysis (bug)
│   │   │       ├── test_plan.md         # Test plan (all types)
│   │   │       ├── implementation_plan.md  # Task breakdown
│   │   │       ├── session-log.md       # Progress log
│   │   │       └── decisions.md         # (optional) Issue decisions
│   │   │
│   │   └── closed/                      # Completed issues (archived)
│   │       └── 20240126-feat-user-dashboard/
│   │           └── [same structure as open issues]
│   │
│   └── planning/
│       ├── implementation-plan.md       # Roadmap + issue links
│       ├── session-log.md               # One-line timeline
│       ├── decisions.md                 # Global ADRs
│       │
│       └── templates/                   # Framework templates
│           ├── issue/                   # Issue file templates
│           ├── global/                  # Global planning templates
│           ├── config/                  # Config templates
│           └── README.md
│
└── scripts/
    ├── setup-planning-v3.sh             # Interactive setup (includes skills)
    ├── migrate-v2-to-v3.sh              # v2.0 → v3.0 migration
    └── update-skills.sh                 # Propagate skill updates
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

See [FRAMEWORK.md](FRAMEWORK.md) for complete best practices guide including:
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
- [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md) - v1.0 → v2.0 migration
- [templates/README.md](templates/README.md) - Template usage

**Scripts:**
- `scripts/setup-planning-v3.sh` - Interactive setup (includes skills)
- `scripts/migrate-v2-to-v3.sh` - Migration tool
- `scripts/update-skills.sh` - Propagate skill updates to consumer projects

---

**Framework Version:** 3.0.0
**Last Updated:** 2026-06-24

Happy coding with Planning Framework v3.0! 🚀
