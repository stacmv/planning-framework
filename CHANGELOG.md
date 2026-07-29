# Changelog

All notable changes to the Planning Framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- `/pf-autopilot` skill — drives the active issue to `/pf-close` autonomously: creates a self-resume schedule (CronCreate) before starting work, retries a sub-agent once after a connection drop, proceeds with recommended defaults only after 3 unanswered `AskUserQuestion` attempts (logging each as `[autopilot default]` in the issue session-log), and removes the schedule on closure
- `pf-git` reference skill — the single definition of the commit & push procedure that closes every pipeline stage: scoped staging per stage, Conventional Commit messages carrying the issue ID, and the same push guard `/pf-close` Phase 8.5 uses (never `main`/`master`, never `--force`/`--no-verify`, a failed push is reported rather than fatal). Not invoked directly

### Changed
- Every artifact-producing stage now commits **and pushes** when it finishes — `/pf-brd`, `/pf-spec`, `/pf-test-plan`, `/pf-impl-plan`, `/pf-check` (on "Fix now"), `/pf-execute` (per wave, push added to the existing commit), `/pf-test` and `/pf-qa` each reference `pf-git` instead of restating the rule. Previously the planning stages committed nothing and work first reached the remote at `/pf-close`, so a session limit, a dropped connection or a second machine lost it — and `/pf`'s fetch+pull sync had nothing to find
- `PLANNING.md` Agent Rules — the same commit & push rule binds issue work done by hand, without a skill
- `/pf-execute` Phase 0 step 2 (committing planning docs to the parent branch) is now a documented safety net rather than the normal path, and pushes what it commits
- `/pf-autopilot` takes an optional issue ID (`/pf-autopilot [ISSUE-ID]`) and pins it for the whole run, including in the cron prompt (`/pf-autopilot continue <ISSUE-ID>`). Previously it derived its target "exactly as `/pf` does", and `/pf` halts to ask when several issues are open — so an unattended resume stalled on every wake-up and the run never advanced. An unknown explicit ID now stops the run instead of retargeting it; with no ID and several issues open it asks, falling back to the newest by date after 3 unanswered attempts (logged as `[autopilot default]`). A second schedule for the same project is refused — two autonomous sessions would race for the working tree and branch

---

## [3.0.0] - 2026-06-24

### Added
- `skills/` directory with 7 Claude Code skills: `/pf`, `/pf-brd`, `/pf-spec`, `/pf-check`, `/pf-test-plan`, `/pf-impl-plan`, `/pf-execute`
- BRD → spec → test plan → implementation plan pipeline for feature and improvement issues
- `/pf-check` consistency verification between pipeline documents
- `scripts/setup-planning-v3.sh` — installs framework including skills into consumer project
- `scripts/update-skills.sh` — distributes skill updates to consumer projects
- `scripts/migrate-v2-to-v3.sh` — migrates v2.0 consumer projects to v3.0
- New issue templates: `brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md`

### Changed
- PLANNING.md slimmed to multi-agent essentials; Claude-specific guidance moved to skills
- Issue document set varies by type: feat/improve use BRD pipeline; bug uses analysis + test plan
- `implementation-plan.md` renamed to `implementation_plan.md` (underscores) in issue folders
- All issues now require `test_plan.md` before implementation

### Removed
- `scripts/create-issue.sh` — rarely used, removed to reduce maintenance burden
- `scripts/close-issue.sh` — rarely used, removed to reduce maintenance burden

---

## [2.0.0] - 2026-01-28

### Added - MAJOR RELEASE

**Issue-Based Workflow:**
- Complete redesign around isolated issue folders
- No merge conflicts on planning docs across branches
- Better context isolation per feature
- Natural archival (closed issues out of sight)
- Global files stay small (roadmap only)

**Self-Contained Projects:**
- Framework files copied to your project (~90 KB)
- No external dependencies
- Works offline
- Natural usage: `./planning/scripts/create-issue.sh`
- Templates available for AI reference

**New Structure:**
```
your-project/
├── PLANNING.md                   ← AI agents find first
├── .qa-workflow.md               ← QA checklist
└── planning/                     ← Everything in one place!
    ├── issues/open/              ← Active work
    ├── issues/closed/            ← Archived
    ├── scripts/                  ← Helper scripts
    ├── templates/                ← All templates
    ├── FRAMEWORK.md              ← Complete guide
    └── *.md                      ← Planning docs
```

**Templates (15 files):**
- Issue: 6 templates (prompt, analysis, plan, log, decisions, definition-of-done)
- Global: 3 templates (implementation-plan, session-log, decisions)
- Config: 2 templates (PLANNING.md, .qa-workflow.md)
- All templates with YAML frontmatter

**Scripts (5 scripts):**
- `setup-planning-v2.sh` - Interactive setup (<5 seconds)
- `create-issue.sh` - Manual issue creation helper
- `close-issue.sh` - Issue closure automation
- `issue-status.sh` - Check issue progress from remote branches
- `migrate-v1-to-v2.sh` - Migration from v1.0/v1.1

**Documentation:**
- `FRAMEWORK.md` - Complete v2.0 guide (500+ lines)
- `QUICKSTART.md` - 5-minute getting started (400+ lines)
- `MIGRATION-GUIDE.md` - v1.0 → v2.0 upgrade guide (400+ lines)
- `README.md` - Updated with v2.0 info

**Multi-Agent Support:**
- Single `PLANNING.md` works for Claude Code, Gemini CLI, Qwen Code
- No more separate CLAUDE.md, GEMINI.md files

**Branch Status Visibility:**
- New `issue-status.sh` script shows real-time progress
- Solves problem of issue branches being ahead of parent
- Check progress from any branch

### Changed - BREAKING CHANGES

**File Structure:**
- `docs/planning/` → `planning/`
- `docs/issues/` → `planning/issues/`
- CLAUDE.md → PLANNING.md (multi-agent)

**Workflow:**
- Global tracking → Issue-based workflow
- Single implementation plan → Per-issue plans
- Continuous session log → Issue session logs

### Fixed

- Script permissions (all scripts now executable)
- Path handling in setup script
- Template processing validation

### Migration from v1.0/v1.1

**Automated Migration:**
```bash
./scripts/migrate-v1-to-v2.sh
```

**Manual Migration:**
See `MIGRATION-GUIDE.md` for complete step-by-step instructions.

**Key Benefits:**
- Cleaner structure (everything in `planning/`)
- Self-contained (no external deps)
- Better branch management (no conflicts)
- Multi-agent support

### Development Stats

- 8 commits on issue branch
- 63/72 tasks completed (87.5%)
- 6 phases: Bootstrap → Templates → Scripts → Docs → Self-Migration → Testing
- ~5000 lines of code/docs written
- Dogfooding approach (v2.0 built using v2.0 workflow)

### Testing

- ✅ Installation tested on fresh project
- ✅ Scripts validated (create-issue, setup, etc.)
- ✅ QA workflow passed
- ✅ Production ready

---

## [1.1.0] - 2025-11-12

### Changed - BREAKING CHANGES

**(Content preserved from original - see above)**

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

**v2.1.0 (Future):**
- NPM package for easy installation
- Additional templates (risk register, testing plan)
- CI/CD integration examples
- Video tutorials
- Domain-specific template packs (web, mobile, data science)
- Integration examples (Jira, Linear, Notion)

**v3.0.0 (Future):**
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
| 3.0.0 | 2026-06-24 | **Major Release:** Skills-based workflow, BRD pipeline, `/pf` commands |
| 2.0.0 | 2026-01-28 | **Major Release:** Issue-based workflow, self-contained projects, multi-agent support |
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
