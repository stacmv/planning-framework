# Changelog

All notable changes to the Planning Framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2025-11-05

### Added

**Core Framework:**
- Initial release of Planning Framework
- Complete framework documentation (FRAMEWORK.md)
- Quick reference guide (QUICK-REFERENCE.md)
- Comprehensive README with usage examples

**Templates:**
- PRD (Product Requirements Document) template
- Implementation Plan template with progress tracking
- Session Log template with start/end rituals
- Architecture Decisions Log (ADR) template
- CLAUDE.md integration template

**Setup Automation:**
- Bash setup script (`setup-planning-framework.sh`)
- PowerShell setup script (`setup-planning-framework.ps1`)
- Automatic CLAUDE.md integration
- Template customization (project name, dates)

**Examples:**
- BackupSystem project as real-world example
- PRD excerpt showing requirement documentation
- Implementation Plan excerpt showing task breakdown
- Session Log excerpt showing context preservation
- Complete decisions.md with 7 ADRs

**Documentation:**
- MIT License
- Contributing guidelines (CONTRIBUTING.md)
- Changelog (this file)
- Comprehensive .gitignore

### Framework Features

**Context Preservation:**
- Session start ritual (3 steps, 2 minutes)
- Session end ritual (4 steps, 5 minutes)
- Quick Status section in implementation plan
- Checkbox-driven progress tracking

**AI Assistant Integration:**
- CLAUDE.md integration for automatic context loading
- Structured planning documents optimized for LLM consumption
- Decision history prevents revisiting settled questions

**Progress Tracking:**
- Phase-based implementation with dependencies
- Task-level breakdown with time estimates
- Visual progress indicators
- Next session markers

**Decision Documentation:**
- Architecture Decision Record (ADR) format
- Context, options, decision, rationale, consequences
- Status tracking (Accepted/Superseded/Deprecated)

**Flexibility:**
- Customizable for project size (small/medium/large)
- Domain-specific adaptations
- Modular template structure

### Proven Results

**BackupSystem Project Stats:**
- Zero context loss across 3+ weeks
- 5 phases, 27 tasks tracked
- 7 architectural decisions documented
- 1,811-line PRD
- Seamless handoff between sessions

---

## [1.1.0] - 2025-11-12

### Changed - BREAKING CHANGES

**Time Estimations Removed:**
- Removed all time estimation fields from templates (session duration, estimated time, phase duration)
- Removed hour-based project size classifications (e.g., "Small Projects (8-40 hours)" → "Small Projects")
- Removed time statistics from session logs (Total Development Time, Average Session Length)
- Updated task granularity advice (removed "1-4 hour chunks" → "manageable chunks")

**Rationale:** AI-assisted development has significantly different velocity than human-only development. Time estimations created false expectations and added maintenance overhead without providing value. Focus shifted to task completion and progress tracking instead.

**Files Updated:**
- `templates/implementation-plan-template.md` - Removed phase and task time estimates
- `templates/session-log-template.md` - Removed session durations and time statistics
- `templates/README.md` - Updated project size guidelines
- `FRAMEWORK.md` - Updated template feature descriptions and project classifications
- `README.md` - Updated project size adaptations
- `QUICK-REFERENCE.md` - Removed time-based examples and advice
- `docs/planning/` - All local documentation updated
- `examples/backupsystem/` - All examples updated for consistency

### Added

**Migration Support:**
- **`docs/MIGRATION-GUIDE-V1.1.md`** - Comprehensive migration guide for AI assistants
  - Step-by-step instructions for updating existing projects
  - Search & replace patterns for common time estimation formats
  - Examples of what to change vs what to keep
  - Verification checklist
  - Troubleshooting guide

### Kept Unchanged

**Preserved Time References:**
- Technical requirements (RTO/RPO, SLA) in system specifications
- Performance metrics describing system behavior (not dev time)
- Historical decision context in ADRs (when time was part of the decision)
- Session count and completion tracking
- All progress tracking mechanisms (checkboxes, percentages, phase completion)

### Migration

**For Existing Projects:**

To migrate your project to v1.1:

1. **Read the migration guide:** `docs/MIGRATION-GUIDE-V1.1.md`
2. **Run automated checks:**
   ```bash
   grep -rn "Estimated Time:" docs/planning/
   grep -rn "Duration:.*hours" docs/planning/
   ```
3. **Update your files** following the guide patterns
4. **Verify** using the checklist in the migration guide

**AI Assistants:** The migration guide is specifically designed for you to help users update their projects.

### Version Compatibility

- **v1.0 → v1.1:** Breaking changes, manual migration required
- **Migration time:** 10-20 minutes for typical project
- **Files affected:** Typically 5-10 files per project

---

## [Unreleased]

### Planned

**v1.2.0 (Future):**
- NPM package for easy installation
- Additional templates (risk register, testing plan)
- CI/CD integration examples
- Video tutorials
- Domain-specific template packs (web, mobile, data science)
- Integration examples (Jira, Linear, Notion)
- Automated progress report generation

**v2.0.0 (Future):**
- AI-powered task suggestions
- Automated ADR generation
- Claude Code API integration

---

## Release Notes

### v1.0.0 - Initial Release

This is the first public release of the Planning Framework, extracted from the BackupSystem v2.0 project where it was developed and proven effective.

**Key Features:**
- ✅ Complete planning infrastructure for AI-assisted development
- ✅ Four core document templates (PRD, Implementation Plan, Session Log, Decisions)
- ✅ Automated setup scripts for quick project initialization
- ✅ Real-world example from BackupSystem project
- ✅ Comprehensive documentation and guides

**Who Should Use This:**
- Developers working on multi-week/month projects
- Teams using AI assistants (Claude Code, GitHub Copilot, ChatGPT)
- Projects requiring context preservation across sessions
- Open source projects needing structured planning

**Getting Started:**
```bash
git clone https://github.com/yourusername/planning-framework.git
cd planning-framework/templates
./setup-planning-framework.sh /path/to/your/project "YourProjectName"
```

See [README.md](README.md) for full documentation.

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 1.1.0 | 2025-11-12 | Remove time estimations, add migration guide |
| 1.0.0 | 2025-11-05 | Initial release with core templates and documentation |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute improvements.

---

## Links

- **Repository:** https://github.com/yourusername/planning-framework
- **Issues:** https://github.com/yourusername/planning-framework/issues
- **Discussions:** https://github.com/yourusername/planning-framework/discussions
- **Original Project:** https://github.com/stacmv/BackupSystem

---

**Maintained by:** Planning Framework Contributors
**License:** MIT
