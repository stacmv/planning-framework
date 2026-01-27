# Planning Framework Configuration

**Version:** 2.0.0-bootstrap
**Last Updated:** 2024-01-27

## Overview

This project uses Planning Framework v2.0 for tracking development work across AI agent sessions.

## Starting a New Session

**IMPORTANT:** Read these files in order:

1. **This file (PLANNING.md)** - Framework instructions
2. **If working on an issue:**
   - `docs/issues/open/{issue-id}/prompt.md` - Original request
   - `docs/issues/open/{issue-id}/analysis.md` - Understanding & approach
   - `docs/issues/open/{issue-id}/implementation-plan.md` - Task breakdown
   - `docs/issues/open/{issue-id}/session-log.md` - Progress history
3. **Global context:**
   - `docs/planning/implementation-plan.md` - Roadmap & active issues
   - `docs/planning/decisions.md` - Architectural decisions
4. **Quality requirements:**
   - `.qa-workflow.md` - QA checklist before closing issues

## Issue Naming Convention

**Format:** `YYYYMMDD-{type}-{slug}`

**Example:** `20240127-feat-add-authentication`

**Issue Types:**
- `feat` - New feature
- `bug` - Fix existing functionality
- `improve` - Enhance existing feature

## Issue Workflow

### 1. Create Issue (when user requests non-trivial work)
```bash
# Agent asks: "Should I create issue for this work?"
# Create folder: docs/issues/open/YYYYMMDD-type-slug/
# Create files: prompt.md, analysis.md
```

### 2. Analyze & Plan
```bash
# Fill out analysis.md with YAML frontmatter
# Create implementation-plan.md with task breakdown
# Optional: definition-of-done.md
```

### 3. Implement
```bash
# Create branch: issue/YYYYMMDD-type-slug
# Work through tasks in implementation-plan.md
# Update session-log.md after each session
# ONE issue per session (focused work)
```

### 4. Quality Assurance
```bash
# Run QA workflow from .qa-workflow.md
# Must pass before closing issue
```

### 5. Close Issue
```bash
# Merge branch to parent
# Move issue folder: open/ → closed/
# Update global session-log.md with one-line entry
# Promote significant decisions to global decisions.md
# Update global implementation-plan.md
# Commit: "Close issue YYYYMMDD-type-slug: Description"
```

## Session End Ritual

**If working on issue:**
- [ ] Update issue session-log.md
- [ ] Check off completed tasks in implementation-plan.md
- [ ] Note any blockers
- [ ] Mark next session priorities
- [ ] Commit changes

**If closing issue:**
- [ ] Run QA workflow
- [ ] Merge branch
- [ ] Move to closed/
- [ ] Update global session-log.md
- [ ] Promote decisions
- [ ] Commit closure

## Agent Guidelines

**DO:**
- ✓ Read issue files before starting work
- ✓ One issue per session (focused work)
- ✓ Update session-log.md after each session
- ✓ Run QA before closing issues
- ✓ Tag session log entries with agent name

**DON'T:**
- ✗ Work on multiple issues in one session
- ✗ Skip QA workflow
- ✗ Close issue without user confirmation
- ✗ Auto-delete branches

## Multi-Agent Support

This PLANNING.md works for:
- Claude Code
- Gemini CLI
- Qwen Code

Tag session log entries with your agent name:
```markdown
[Claude Code] ✓ [20240127-feat-add-auth](../issues/closed/20240127-feat-add-auth) - Added JWT auth
```

---

**Note:** This is a bootstrap version. Full templates and documentation will be added as part of implementing v2.0.
