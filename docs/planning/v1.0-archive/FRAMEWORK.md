# Project Planning Framework

> **⚠️ HISTORICAL — v1.1. Archived, not maintained.**
> Kept for reference only. The `templates/` directory and the
> `setup-planning-framework.sh` script it describes were removed in v3.0.
> The current guide is [`docs/planning/FRAMEWORK.md`](../FRAMEWORK.md); the
> single install/upgrade path is `make converge` (`scripts/converge-to-v3.sh`).

**Version:** 1.1
**Created:** 2025-11-04
**Last Updated:** 2025-11-12
**Purpose:** Reusable planning infrastructure for AI-assisted software development

---

## Overview

This framework provides a structured approach to maintaining context across multiple development sessions when working with AI assistants (Claude Code, GitHub Copilot, etc.). It solves the **context loss problem** that occurs when sessions end and new ones begin.

### Problems This Framework Solves

1. **"Where did I leave off?"** - Clear session tracking with next steps
2. **"What decisions did we make?"** - Documented architecture choices with rationale
3. **"What's the overall plan?"** - Detailed roadmap with dependencies and progress
4. **"Why did we choose X over Y?"** - Decision history prevents revisiting settled questions
5. **"What's the project structure?"** - Explicit directory layouts and component specs

---

## Framework Components

### Core Documents

```
docs/
├── prd.md                          # Product Requirements (WHAT and WHY)
├── planning/
│   ├── FRAMEWORK.md               # This file (meta-documentation)
│   ├── implementation-plan.md     # Detailed roadmap (HOW and WHEN)
│   ├── session-log.md             # Session notes and progress
│   └── decisions.md               # Architecture Decision Records (ADRs)
└── [domain-specific]/             # Optional: learning materials, etc.
```

### Document Purposes

| Document | Purpose | Updated When | Primary Consumer |
|----------|---------|--------------|------------------|
| **prd.md** | Requirements, features, scope | During planning phase | Human & AI (initial context) |
| **implementation-plan.md** | Task breakdown, dependencies, progress | After each session (progress) | AI (session start, task selection) |
| **session-log.md** | Session notes, blockers, decisions | During and end of each session | AI & Human (continuity) |
| **decisions.md** | Architecture choices with rationale | When major decisions made | AI (consistency), Human (review) |

---

## How It Works

### Session Start Ritual (AI Assistant)

When starting a new session, Claude (or another AI) should:

1. **Read session log** - See what was done last time
   ```bash
   tail -50 docs/planning/session-log.md
   ```

2. **Check implementation status** - Review current phase and next task
   ```bash
   head -40 docs/planning/implementation-plan.md  # Quick Status section
   ```

3. **Review decisions** - Refresh on architectural choices
   ```bash
   cat docs/planning/decisions.md
   ```

4. **Begin work** - Start with task marked "Next Session" or "in_progress"

### Session End Ritual

Before ending a session:

1. **Update session log** (`session-log.md`)
   - Fill in "Completed" section with checkboxes
   - Document decisions made
   - Note any blockers
   - Set "Next Session" priorities

2. **Update implementation plan** (`implementation-plan.md`)
   - Check off completed tasks
   - Update "Quick Status" section at top
   - Update phase progress percentages
   - Mark next task

3. **Commit work**
   ```bash
   git add .
   git commit -m "Session YYYY-MM-DD: Brief description"
   ```

4. **Log decisions** (`decisions.md`)
   - Add any architectural decisions using ADR format

---

## Document Templates

### Template 1: PRD (Product Requirements Document)

See: `templates/prd-template.md`

**Sections:**
- Executive Summary (vision, objectives)
- Current System Analysis (if applicable)
- Core Requirements (FR-1, FR-2, etc.)
- Technical Architecture
- Success Criteria
- Open Questions

**When to create:** At project start, before implementation

### Template 2: Implementation Plan

See: `templates/implementation-plan-template.md`

**Key Features:**
- **Quick Status** section at top (current phase, next task, progress overview)
- **Directory structure** with checkboxes
- **Phase breakdown** with tasks, dependencies, deliverables
- **Checkbox-driven progress tracking**
- **Next Session Checklist**

**When to create:** After PRD is approved, before coding starts

### Template 3: Session Log

See: `templates/session-log-template.md`

**Structure:**
- **How to Start/End a Session** (rituals)
- **Session entries** (newest first)
  - Date and duration
  - Goals
  - Completed (with checkboxes)
  - Decisions made
  - Blockers
  - Next session priorities

**When to create:** First development session

### Template 4: Decisions Log (ADR)

See: `templates/decisions-template.md`

**ADR Format:**
- Date
- Context (problem)
- Options Considered
- Decision
- Rationale
- Consequences (positive/negative)
- Status (Accepted/Superseded/Deprecated)

**When to create:** Whenever making significant technical decisions

---

## Integration with AI Assistant

### CLAUDE.md Integration

Add this section to your project's `CLAUDE.md` file:

```markdown
## Starting a New Session

**IMPORTANT:** Before starting any work, follow these steps to restore context:

1. **Read session log** - See what was done last time and what's next:
   ```bash
   tail -50 docs/planning/session-log.md
   ```

2. **Check implementation status** - Review current phase and next task:
   ```bash
   head -40 docs/planning/implementation-plan.md
   ```

3. **Review decisions** - Refresh on architectural choices:
   ```bash
   cat docs/planning/decisions.md
   ```

4. **Start the task** - Begin with the task marked "Next Session" in implementation plan

**Planning Infrastructure Location:**
- `/docs/planning/implementation-plan.md` - Detailed task breakdown, component specs, progress tracking
- `/docs/planning/session-log.md` - Session-by-session progress and notes
- `/docs/planning/decisions.md` - Architecture Decision Records (ADR)
- `/docs/prd.md` - Product Requirements Document (what and why)
```

### Best Practices for AI Assistants

**For Claude Code / AI Assistants:**

1. **Always start sessions** by reading the three core planning documents
2. **Update progress immediately** after completing tasks (don't batch)
3. **Document decisions** in real-time using ADR format
4. **Ask clarifying questions** if implementation plan is ambiguous
5. **Maintain consistency** - follow patterns in decisions.md
6. **Update "Next Session"** marker before ending work

---

## Framework Benefits

### For Developers

✅ **Clear context** - No time wasted remembering "where was I?"
✅ **Decision history** - Understand why choices were made
✅ **Progress visibility** - See what's done and what's next
✅ **Prevents backsliding** - Documented decisions prevent revisiting settled issues
✅ **Better handoffs** - Other devs (or future you) can pick up easily

### For AI Assistants

✅ **Reduced hallucination** - Clear facts about project state
✅ **Consistent behavior** - Follows documented patterns and decisions
✅ **Proactive planning** - Can suggest next steps based on plan
✅ **Better reasoning** - Understands "why" not just "what"
✅ **Continuity** - Maintains context across session boundaries

### For Teams

✅ **Onboarding** - New team members understand project quickly
✅ **Async collaboration** - Clear status for distributed teams
✅ **Audit trail** - Decision history for compliance/review
✅ **Risk management** - Documented dependencies and blockers

---

## Customization Guide

### Adapting for Different Project Types

**Small Projects:**
- Simplify `implementation-plan.md` to single-page task list
- Combine `session-log.md` and `implementation-plan.md`
- Optional: Skip ADRs if decisions are straightforward

**Large Projects:**
- Break `implementation-plan.md` into multiple files by phase
- Add `risks.md` for risk management
- Add `dependencies.md` for external dependencies
- Consider adding `testing-plan.md`

**Open Source Projects:**
- Add `CONTRIBUTING.md` referencing planning docs
- Make `implementation-plan.md` public roadmap
- Use ADRs to explain project direction to contributors

**Learning Projects:**
- Add `/docs/learning/` directory (like our `/docs/learning-go/`)
- Link exercises to implementation plan tasks
- Track learning objectives alongside code objectives

### Adding Custom Sections

Common additions:
- `docs/planning/risks.md` - Risk register
- `docs/planning/dependencies.md` - External dependencies tracking
- `docs/planning/testing-plan.md` - Test strategy
- `docs/planning/deployment-plan.md` - Release/deployment strategy
- `docs/planning/performance-targets.md` - Performance benchmarks

---

## Quick Setup for New Projects

### Option 1: Manual Setup

1. **Create directory structure:**
   ```bash
   mkdir -p docs/planning
   ```

2. **Copy templates:**
   ```bash
   cp templates/prd-template.md docs/prd.md
   cp templates/implementation-plan-template.md docs/planning/implementation-plan.md
   cp templates/session-log-template.md docs/planning/session-log.md
   cp templates/decisions-template.md docs/planning/decisions.md
   ```

3. **Add to CLAUDE.md:**
   - Copy the "Starting a New Session" section above

4. **Customize templates:**
   - Fill in project-specific information
   - Remove sections that don't apply

### Option 2: Setup Script

Run the provided setup script:

```bash
./setup-planning-framework.sh [project-name]
```

This will:
- Create directory structure
- Copy templates
- Generate CLAUDE.md section
- Create initial git commit

---

## Real-World Example

**The BackupSystem project** is a working example of this framework in action. See `examples/backupsystem/` for excerpts:

- 📄 **PRD**: 1,811 lines covering requirements, architecture, testing strategy
- 📋 **Implementation Plan**: 6 phases, 22 components, detailed task breakdown
- 📝 **Session Log**: Tracks sessions with checkboxes and next steps
- 🔍 **Decisions Log**: 7 ADRs documenting major technical choices
- 📚 **Learning Materials**: Passive Go learning path integrated with implementation

**Results:**
- Zero context loss between sessions spanning 3+ weeks
- Clear progress visibility at all times
- Documented rationale for dual PHP/Go implementation
- Seamless handoff between sessions
- Framework proved valuable enough to extract and publish

**Full project:** [BackupSystem on GitHub](https://github.com/stacmv/BackupSystem)

---

## Version History

- **v1.1** (2025-11-12) - Remove time estimations, add migration guide
- **v1.0** (2025-11-04) - Initial framework extracted from BackupSystem project

---

## License

This framework is released under MIT License. Feel free to adapt and use in any project.

---

## Feedback & Contributions

If you improve this framework, please share your enhancements! Common improvements:
- Additional templates for specific project types
- Integration with project management tools (Jira, Linear, etc.)
- Automated status report generation
- LLM-specific optimizations for other AI assistants

---

**Created by:** Human + Claude collaboration
**Original Project:** [BackupSystem v2.0](https://github.com/stacmv/BackupSystem)
**License:** MIT
