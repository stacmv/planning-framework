# Project Planning Framework

> **A structured approach to maintaining context across development sessions with AI assistants**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](FRAMEWORK.md)

---

## Overview

The **Project Planning Framework** solves the context loss problem that occurs when working on projects across multiple sessions, especially with AI assistants like Claude Code, GitHub Copilot, or ChatGPT.

### Problems This Solves

✅ **"Where did I leave off?"** - Clear session tracking with explicit next steps
✅ **"What decisions did we make?"** - Documented architecture choices with rationale
✅ **"What's the overall plan?"** - Detailed roadmap with dependencies and progress
✅ **"Why did we choose X over Y?"** - Decision history prevents revisiting settled questions
✅ **"What's the project structure?"** - Explicit directory layouts and component specs

---

## Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Download the framework
git clone https://github.com/yourusername/planning-framework.git
cd planning-framework/templates

# Run setup in your project
./setup-planning-framework.sh /path/to/your/project "YourProjectName"
```

**What this does:**
- ✅ Creates `docs/planning/` directory structure
- ✅ Copies and customizes templates with your project name
- ✅ Integrates with `CLAUDE.md` for AI assistant guidance
- ✅ Creates initial git commit (optional)

### Option 2: Manual Setup

```bash
# In your project root
mkdir -p docs/planning

# Copy templates
cp planning-framework/templates/prd-template.md docs/prd.md
cp planning-framework/templates/implementation-plan-template.md docs/planning/implementation-plan.md
cp planning-framework/templates/session-log-template.md docs/planning/session-log.md
cp planning-framework/templates/decisions-template.md docs/planning/decisions.md

# Customize: Replace [Project Name] and YYYY-MM-DD with your values
```

### Option 3: NPM Package (Coming Soon)

```bash
npx @planning-framework/init
```

---

## How It Works

### Core Documents

| Document | Purpose | Update When |
|----------|---------|-------------|
| **prd.md** | Product requirements (WHAT and WHY) | During planning phase |
| **implementation-plan.md** | Task breakdown, dependencies, progress | After each session |
| **session-log.md** | Session notes, blockers, next steps | During/end of each session |
| **decisions.md** | Architecture Decision Records (ADRs) | When making major decisions |

### Session Start Ritual (2 minutes)

When starting a development session, your AI assistant (or you) should:

```bash
# 1. Read session log - See what was done last time
tail -50 docs/planning/session-log.md

# 2. Check implementation status - Review current phase and next task
head -40 docs/planning/implementation-plan.md

# 3. Review decisions - Refresh on architectural choices
cat docs/planning/decisions.md
```

**Then:** Start with the task marked "Next Session" in the implementation plan.

### Session End Ritual (5 minutes)

Before ending a session:

1. ✅ Update `session-log.md` with completed tasks and next priorities
2. ✅ Update `implementation-plan.md` progress checkboxes
3. ✅ Document any architectural decisions in `decisions.md`
4. ✅ Commit your work: `git commit -m "Session YYYY-MM-DD: Brief description"`

---

## Benefits

### For Developers

✅ **Zero context loss** - Pick up exactly where you left off
✅ **Clear progress** - Visual tracking with checkboxes
✅ **Decision history** - Understand why choices were made
✅ **Better handoffs** - Team members (or future you) can continue seamlessly

### For AI Assistants

✅ **Reduced hallucination** - Clear facts about project state
✅ **Consistent behavior** - Follows documented patterns and decisions
✅ **Proactive planning** - Can suggest next steps based on plan
✅ **Continuity** - Maintains context across session boundaries

### For Teams

✅ **Faster onboarding** - New team members understand project quickly
✅ **Async collaboration** - Clear status for distributed teams
✅ **Audit trail** - Decision history for compliance/review
✅ **Risk management** - Documented dependencies and blockers

---

## Documentation

- 📖 **[Complete Framework Guide](FRAMEWORK.md)** - Detailed documentation
- ⚡ **[Quick Reference](QUICK-REFERENCE.md)** - One-page cheat sheet
- 📁 **[Templates](templates/)** - All document templates
- 💡 **[Example Project](examples/backupsystem/)** - Real-world example

---

## Real-World Example

This framework was developed during the **BackupSystem v2.0** project and proven effective:

- 📄 **1,811-line PRD** covering requirements, architecture, testing strategy
- 📋 **6 phases, 22 components** in implementation plan
- 📝 **Session tracking** with clear next steps across weeks
- 🔍 **7 ADRs** documenting major technical choices (dual PHP/Go implementation, testing frameworks, etc.)

**Result:** Zero context loss between sessions spanning multiple weeks, with seamless handoff between sessions.

See `examples/backupsystem/` for excerpts.

---

## Framework Components

### Templates Included

```
templates/
├── prd-template.md                     # Product Requirements Document
├── implementation-plan-template.md     # Detailed task breakdown
├── session-log-template.md             # Session tracking
├── decisions-template.md               # Architecture Decision Records
├── claude-instructions.md              # CLAUDE.md integration
├── setup-planning-framework.sh         # Bash setup script
└── setup-planning-framework.ps1        # PowerShell setup script
```

### Document Templates

1. **PRD (Product Requirements Document)**
   - Executive summary, vision, objectives
   - Current system analysis
   - Functional and non-functional requirements
   - Technical architecture
   - Success criteria

2. **Implementation Plan**
   - Quick Status section (current phase, next task)
   - Directory structure with checkboxes
   - Phase breakdown with tasks and dependencies
   - Component specifications
   - Progress tracking

3. **Session Log**
   - Session start/end rituals
   - Completed tasks (with checkboxes)
   - Decisions made
   - Blockers encountered
   - Next session priorities

4. **Decisions Log (ADR)**
   - Architecture Decision Record format
   - Context, options, decision, rationale, consequences
   - Status tracking (Accepted/Superseded/Deprecated)

---

## When to Use This Framework

### ✅ Good Fit

- Projects spanning multiple weeks/months
- Projects with multiple contributors
- AI-assisted development
- Complex projects with many architectural decisions
- Learning projects (track progress and understanding)

### ⚠️ May Be Overkill For

- Single-session prototypes
- Trivial scripts (<100 LOC)
- Well-defined, simple tasks
- Projects with continuous context (no breaks)

---

## Customization

### Project Size Adaptations

**Small Projects (8-40 hours):**
- Simplify PRD to 1-2 pages
- Use single-phase implementation plan
- Keep all templates

**Medium Projects (40-200 hours):**
- Use all templates as-is
- Standard customization

**Large Projects (>200 hours):**
- Split implementation plan by phase
- Add `risks.md`, `dependencies.md`, `testing-plan.md`
- Create detailed component specifications

### Domain-Specific Customizations

- **Web Apps:** Add UI/UX requirements, API specs, database schema
- **Data Science:** Add dataset descriptions, model metrics, experiment tracking
- **DevOps:** Add infrastructure diagrams, SLA/SLO definitions, monitoring plans
- **Learning Projects:** Add `/docs/learning/` with exercises and objectives

---

## Integration with Development Tools

### Claude Code / AI Assistants

Add the session start ritual to your `CLAUDE.md` file:

```markdown
## Starting a New Session

**IMPORTANT:** Before starting any work, restore context:

1. Read session log: `tail -50 docs/planning/session-log.md`
2. Check implementation status: `head -40 docs/planning/implementation-plan.md`
3. Review decisions: `cat docs/planning/decisions.md`
4. Start the task marked "Next Session"
```

The setup script automatically adds this to your `CLAUDE.md`.

### Git Hooks

Example pre-commit hook to remind updating planning docs:

```bash
#!/bin/bash
if git diff --cached --name-only | grep -q "^src/"; then
  echo "Remember to update docs/planning/session-log.md"
fi
```

### CI/CD

Check that planning docs are updated when code changes:

```yaml
# .github/workflows/check-docs.yml
- name: Check if session log updated
  run: |
    if git diff --name-only origin/main | grep -q "^src/"; then
      if ! git diff --name-only origin/main | grep -q "docs/planning/session-log.md"; then
        echo "Warning: Code changed but session log not updated"
      fi
    fi
```

---

## Contributing

Improvements welcome! Common contributions:

- ✨ Additional templates (risk register, test plan, deployment plan)
- 🔧 Setup scripts for other platforms
- 📚 Integration examples for other tools (Jira, Linear, Notion)
- 🎨 Domain-specific template variations
- 📖 Real-world project examples

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Support

- 📖 **Documentation:** See [FRAMEWORK.md](FRAMEWORK.md) for complete guide
- ⚡ **Quick Help:** See [QUICK-REFERENCE.md](QUICK-REFERENCE.md)
- 💡 **Examples:** See [examples/](examples/)
- 🐛 **Issues:** [GitHub Issues](https://github.com/yourusername/planning-framework/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/yourusername/planning-framework/discussions)

---

## License

MIT License - Use freely in any project. See [LICENSE](LICENSE) for details.

---

## Acknowledgments

**Created by:** Human + Claude collaboration
**Original Project:** [BackupSystem v2.0](https://github.com/stacmv/BackupSystem)
**Inspired by:** The need for better context preservation in AI-assisted development

---

## Version History

- **v1.0.0** (2025-11-05) - Initial release
  - Core templates (PRD, Implementation Plan, Session Log, Decisions)
  - Setup scripts (Bash, PowerShell)
  - CLAUDE.md integration
  - Complete documentation
  - Real-world example from BackupSystem project

---

**Star this repo if it helps your project! ⭐**
