# Planning Framework v2.0 - Complete Guide

**Version:** 2.0.0
**Last Updated:** 2024-01-27

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [Issue Workflow](#issue-workflow)
5. [File Structure](#file-structure)
6. [Agent Guidelines](#agent-guidelines)
7. [Best Practices](#best-practices)
8. [Multi-Agent Support](#multi-agent-support)
9. [Customization](#customization)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)

---

## Overview

Planning Framework v2.0 is an **issue-based workflow system** designed for AI-assisted development across multiple sessions and branches.

### The Problem

When working with AI agents across multiple sessions:
- Context is lost between sessions
- Planning files grow unbounded
- Feature branches conflict on shared planning docs
- No structured way to track features/bugs

### The Solution

Planning Framework v2.0 solves these problems through:

**Issue-Based Workflow:**
- Each task gets its own issue folder
- Issues contain complete context (prompt, analysis, plan, progress)
- Global files stay minimal (roadmap only)
- No merge conflicts (issue folders are branch-specific)

**Multi-Agent Support:**
- Single `PLANNING.md` config works for Claude/Gemini/Qwen
- Agent names tracked in session logs
- Consistent workflow across all agents

**Quality Gates:**
- `.qa-workflow.md` defines quality requirements
- QA must pass before closing issues
- Separate requirements for features/bugs/improvements

### Key Benefits

✅ **Bounded File Sizes** - Global files stay small, execution details in issues
✅ **No Merge Conflicts** - Issue folders are branch-specific
✅ **Better Context** - Agent reads only relevant issue
✅ **Natural Archival** - Closed issues out of sight
✅ **Clear Workflow** - 6-phase issue lifecycle
✅ **Multi-Agent** - Works with Claude Code, Gemini CLI, Qwen Code

---

## Getting Started

### Quick Setup (5 Minutes)

**For new projects:**

```bash
# 1. Get Planning Framework
git clone https://github.com/[your-org]/planning-framework
cd planning-framework

# 2. Run interactive setup
./scripts/setup-planning-v2.sh
# Follow prompts: project name, issue types, QA requirements

# 3. Commit the framework
git add .
git commit -m "Setup Planning Framework v2.0"

# 4. Start working!
# Ask your AI agent to create your first issue
```

**For existing v1.0 projects:**

```bash
# Migrate from v1.0 to v2.0
./scripts/migrate-v1-to-v2.sh
# Backs up v1.0, creates v2.0 structure, generates report
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

### Complete Lifecycle (6 Phases)

```
CREATE → ANALYZE → PLAN → IMPLEMENT → QA → CLOSE
```

### Phase 1: Create

**When to create issue:**
- Non-trivial work (>15 minutes)
- Multi-file changes
- New features
- Bug fixes requiring investigation

**Agent behavior:**
- For non-trivial work: Ask user "Should I create issue for this?"
- For trivial fixes: Work directly, log in global session-log

**Steps:**
```bash
# Create issue folder
mkdir docs/issues/open/20240127-feat-add-auth/

# Create prompt.md
# Paste user's original request
```

### Phase 2: Analyze

**Fill out analysis.md:**

```yaml
---
created: 2024-01-27
type: feat
branch: issue/20240127-feat-add-auth
status: open
---
```

**Analysis includes:**
- Problem understanding
- Proposed solution approach
- Technical considerations
- Dependencies and blockers
- Risks & mitigations
- Success criteria

### Phase 3: Plan

**Create implementation-plan.md:**
- Break down into phases
- Detailed task checklist
- Component specifications
- Progress tracking

**Optional: Create definition-of-done.md**
- Detailed completion criteria
- Test scenarios
- Acceptance checklist

### Phase 4: Implement

**Start working:**

```bash
# Commit current changes
git add . && git commit -m "..."

# Create issue branch
git checkout -b issue/20240127-feat-add-auth

# Work through implementation-plan.md
# Update session-log.md after each session
```

**Rules:**
- ✅ ONE issue per session (focused work)
- ✅ Update session-log.md after each session
- ✅ Check off tasks in implementation-plan.md
- ✅ Document blockers immediately
- ✅ Create decisions.md if architectural decisions made
- ✅ Commit frequently with clear messages

### Phase 5: QA

**Run QA workflow from `.qa-workflow.md`:**

```bash
# Example
npm run lint
npm test
npm run test:integration
# Check documentation
# Review security
```

**Must pass:**
- [ ] Linting/formatting
- [ ] All existing tests pass
- [ ] New tests added
- [ ] Documentation updated
- [ ] (Bugs) Failing test created, then passes

**If QA fails:**
- Fix issues
- Retry QA workflow
- Don't close until all checks pass

### Phase 6: Close

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
# (Manual: copy important ADRs)

# 5. Update global implementation-plan.md
# (Mark milestone complete, update progress)

# 6. Commit
git add .
git commit -m "Close issue 20240127-feat-add-auth: Added JWT authentication"

# 7. Branch cleanup (manual)
# git branch -d issue/20240127-feat-add-auth
```

---

## File Structure

### Complete Directory Structure

```
project/
├── PLANNING.md                          # Framework config
├── .qa-workflow.md                      # QA requirements
│
├── docs/
│   ├── issues/
│   │   ├── open/                        # Active issues
│   │   │   └── 20240127-feat-add-auth/
│   │   │       ├── prompt.md            # Original request
│   │   │       ├── analysis.md          # Understanding + metadata
│   │   │       ├── implementation-plan.md  # Task breakdown
│   │   │       ├── session-log.md       # Progress log
│   │   │       ├── decisions.md         # (optional) Issue decisions
│   │   │       └── definition-of-done.md   # (optional) Criteria
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
    ├── setup-planning-v2.sh             # Interactive setup
    ├── migrate-v1-to-v2.sh              # v1.0 → v2.0 migration
    ├── create-issue.sh                  # Manual issue creation
    └── close-issue.sh                   # Issue closure helper
```

---

## Agent Guidelines

### For AI Assistants

**Session Start Checklist:**

1. **Read global context:**
   - `PLANNING.md` - Framework instructions
   - `docs/planning/implementation-plan.md` - Current roadmap
   - `docs/planning/session-log.md` (last 20 lines) - Recent activity

2. **If working on issue, read:**
   - `docs/issues/open/{issue-id}/prompt.md`
   - `docs/issues/open/{issue-id}/analysis.md`
   - `docs/issues/open/{issue-id}/implementation-plan.md`
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
- [ ] Check off completed tasks in implementation-plan.md
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
- `scripts/setup-planning-v2.sh` - Interactive setup
- `scripts/migrate-v1-to-v2.sh` - Migration tool
- `scripts/create-issue.sh` - Issue creation helper
- `scripts/close-issue.sh` - Issue closure helper

---

**Framework Version:** 2.0.0
**Last Updated:** 2024-01-27

Happy coding with Planning Framework v2.0! 🚀
