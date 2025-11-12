# Planning Framework Templates

This directory contains reusable templates for the Project Planning Framework.

## Quick Start

### For a New Project

1. **Copy templates to your project:**
   ```bash
   # Create directory structure
   mkdir -p docs/planning

   # Copy templates (customize the names)
   cp prd-template.md ../../../docs/prd.md
   cp implementation-plan-template.md ../../../docs/planning/implementation-plan.md
   cp session-log-template.md ../../../docs/planning/session-log.md
   cp decisions-template.md ../../../docs/planning/decisions.md
   ```

2. **Add framework instructions to CLAUDE.md:**
   ```bash
   # If CLAUDE.md doesn't exist
   cp claude-instructions.md ../../../CLAUDE.md

   # If CLAUDE.md exists, append the "Starting a New Session" section
   cat claude-instructions.md >> ../../../CLAUDE.md
   ```

3. **Customize templates:**
   - Replace `[Project Name]` with your actual project name
   - Replace `YYYY-MM-DD` with current date
   - Remove sections that don't apply
   - Add project-specific sections

### Using the Setup Script

For faster setup, use the provided script:

```bash
./setup-planning-framework.sh [project-path] [project-name]
```

This will:
- Create directory structure
- Copy and customize templates
- Generate CLAUDE.md section
- Create initial git commit

## Template Descriptions

### prd-template.md
**Purpose:** Product Requirements Document

**When to use:** Start of every project, before implementation

**Key sections:**
- Executive Summary (vision, objectives)
- Background & Context
- Functional & Non-Functional Requirements
- Technical Architecture
- Success Criteria

**Customization tips:**
- Adjust sections based on project size
- Small projects: Simplify to single-page
- Large projects: Split into multiple documents

---

### implementation-plan-template.md
**Purpose:** Detailed task breakdown and progress tracking

**When to use:** After PRD is approved, before coding starts

**Key sections:**
- Quick Status (current phase, next task)
- Directory structure with checkboxes
- Phase breakdown with tasks and dependencies
- Component specifications
- Next Session Checklist

**Customization tips:**
- Adjust number of phases based on project timeline
- Add custom sections: risks, dependencies, etc.
- For small projects: Simplify to single-phase task list

---

### session-log-template.md
**Purpose:** Session-by-session progress notes

**When to use:** First development session, updated every session

**Key sections:**
- How to Start/End a Session (rituals)
- Session entries (newest first)
  - Completed tasks
  - Decisions made
  - Blockers
  - Next session priorities

**Customization tips:**
- Use session templates at bottom for consistency
- Add custom session types (refactoring, bug fix, etc.)
- Include metrics if helpful (time tracking, velocity)

---

### decisions-template.md
**Purpose:** Architecture Decision Records (ADRs)

**When to use:** Whenever making significant technical decisions

**Key sections:**
- ADR format (Context, Options, Decision, Rationale, Consequences)
- Decision index for quick reference
- Templates for common decision types

**Customization tips:**
- Add category-specific templates
- Include diagrams for complex decisions
- Link to related code/PRs

---

### claude-instructions.md
**Purpose:** Instructions for CLAUDE.md to use the framework

**When to use:** Add to CLAUDE.md at project start

**Contents:**
- Session start ritual (what to read)
- Planning infrastructure location
- Instructions for AI assistants

**Customization tips:**
- Adjust paths if using different directory structure
- Add project-specific instructions
- Include links to key files

---

## Framework Philosophy

### Core Principles

1. **Context preservation** - No information loss between sessions
2. **AI-friendly** - Structured for LLM consumption
3. **Human-readable** - Developers can understand without AI
4. **Checkbox-driven** - Visual progress tracking
5. **Decision documentation** - Rationale for future reference

### When to Use This Framework

✅ **Good fit:**
- Projects spanning multiple weeks/months
- Projects with multiple contributors
- AI-assisted development
- Complex projects with many decisions
- Learning projects (track progress)

⚠️ **May be overkill for:**
- Single-session prototypes
- Trivial scripts (<100 LOC)
- Well-defined, simple tasks
- Solo projects with continuous context

### Adapting for Project Size

**Tiny projects:**
- Use: implementation-plan (simplified), session-log
- Skip: PRD, decisions.md

**Small projects:**
- Use: All templates
- Simplify: PRD (1-2 pages), implementation-plan (single phase)

**Medium projects:**
- Use: All templates (full)
- Standard customization

**Large projects:**
- Use: All templates (full)
- Extend: Split implementation-plan by phase, add risks.md

---

## Integration with Development Tools

### Git Integration

**Commit hooks:**
```bash
# .git/hooks/pre-commit
#!/bin/bash
# Remind to update planning docs
if git diff --cached --name-only | grep -q "^src/"; then
  echo "Remember to update docs/planning/session-log.md"
fi
```

**Commit message templates:**
```
Session YYYY-MM-DD: [Brief description]

- Completed: [Tasks from implementation plan]
- Decisions: [Reference to ADRs if any]
- Next: [Next task from implementation plan]
```

### CI/CD Integration

**GitHub Actions example:**
```yaml
# .github/workflows/check-docs.yml
name: Check Planning Docs
on: [pull_request]

jobs:
  check-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check if session log updated
        run: |
          if git diff --name-only origin/main | grep -q "^src/"; then
            if ! git diff --name-only origin/main | grep -q "docs/planning/session-log.md"; then
              echo "Warning: Code changed but session log not updated"
              exit 1
            fi
          fi
```

### IDE Integration

**VSCode snippets:**
```json
{
  "ADR Template": {
    "prefix": "adr",
    "body": [
      "## ADR-${1:XXX}: ${2:Title}",
      "",
      "**Date:** ${CURRENT_YEAR}-${CURRENT_MONTH}-${CURRENT_DATE}",
      "**Status:** ${3|Proposed,Accepted,Superseded,Deprecated|}",
      "",
      "### Context",
      "${4:Problem description}",
      "",
      "### Options Considered",
      "1. **${5:Option A}:** ${6:Description}",
      "",
      "### Decision",
      "${7:Chosen option}",
      "",
      "### Consequences",
      "${8:Impact}"
    ]
  }
}
```

---

## Examples

See the BackupSystem project for a working example:
- `docs/prd.md` - Comprehensive 1,811-line PRD
- `docs/planning/implementation-plan.md` - 6 phases, 22 components
- `docs/planning/session-log.md` - Session tracking with next steps
- `docs/planning/decisions.md` - 7 ADRs documenting major choices

---

## Contributing

Improvements to this framework are welcome!

**Common enhancements:**
- Additional document templates (risks, dependencies, testing plans)
- Setup scripts for different platforms
- Integration examples for other tools
- Project-type-specific variations

---

## License

These templates are released under MIT License. Use freely in any project.

---

**Created:** 2025-11-04
**Version:** 1.1
**Last Updated:** 2025-11-12
**Project:** BackupSystem v2.0
