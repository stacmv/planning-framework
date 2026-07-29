# Planning Framework v3.0

> **Issue-based workflow for AI-assisted development across sessions and branches**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](docs/planning/FRAMEWORK.md)

---

## What's New in v3.0

**Skills-Based Workflow** - Run `/pf` to see active issue status and your next step — no manual file reads to orient
**BRD Pipeline** - feat/improve issues follow BRD → spec → test plan → implementation plan before any code
**Pipeline Enforcement** - Skills refuse to run if prerequisites are missing, keeping documents consistent
**`/pf-check`** - Verifies consistency across all pipeline documents at any point
**One entry point** - `make converge` installs, migrates or tops up a project from *any* starting state
**`scripts/update-skills.sh`** - Propagate skill updates to all consumer projects from one place

## Skills

Sixteen Claude Code skills live in `skills/`, one directory per skill (`skills/<name>/SKILL.md`). Converge installs all of them into `~/.claude/skills/`.

| Command | Purpose |
|---------|---------|
| `/pf` | Show active issue status and next step |
| `/pf-help` | Framework overview and quick start |
| `/pf-brd` | Create the Business Requirements Document for an issue |
| `/pf-spec` | Write the technical spec from the BRD |
| `/pf-test-plan` | Generate the test plan from the spec (or the analysis, for bugs) |
| `/pf-impl-plan` | Create the implementation plan from the test plan |
| `/pf-check` | Review the most recent pipeline document for problems |
| `/pf-execute` | Execute the implementation plan via sub-agents |
| `/pf-test` | Run tests, update the Status Tracker, build the manual test checklist |
| `/pf-manual-test` | Fill in the manual test checklist interactively |
| `/pf-qa` | Run QA checks from `.qa-workflow.md`, produce `qa_report.md` |
| `/pf-qa-setup` | Create or update `.qa-workflow.md` for the project |
| `/pf-close` | Merge the issue branch, archive the issue, update the session log |
| `/pf-autopilot` | Drive the active issue to `/pf-close` autonomously (self-resume schedule survives session limits) |
| `/pf-update` | Update the installed skills from the framework repo |
| `/pf-size-tiers` | Reference data (size tiers, document budgets) — read by the other skills |
| `/pf-git` | Reference data (the commit & push procedure closing every stage) — read by the other skills |

### Upgrading from v2.0?
Run `make converge TARGET=/path/to/your-project`. See **[MIGRATION-GUIDE-V3.md](docs/planning/MIGRATION-GUIDE-V3.md)** for what it does to your issues, the backup, and `--dry-run`.

---

## What's New in v2.0

**Issue-Based Workflow** - Each task gets its own folder with complete context
**Bounded File Sizes** - Global files stay small, execution details in issues
**No Merge Conflicts** - Issue folders are branch-specific
**Multi-Agent Support** - Single config for Claude/Gemini/Qwen
**Quality Gates** - Built-in QA workflow

---

## The Problem

When working with AI agents across multiple sessions:
- ❌ Context is lost between sessions
- ❌ Planning files grow unbounded
- ❌ Feature branches conflict on shared planning docs
- ❌ No structured way to track features/bugs

## The Solution

Planning Framework v2.0 uses an **issue-based workflow**:
- ✅ Each task in its own issue folder
- ✅ Complete context (prompt, analysis, plan, progress)
- ✅ Global files stay minimal (roadmap only)
- ✅ Zero merge conflicts (branch-specific issues)
- ✅ Multi-agent support (Claude Code, Gemini CLI, Qwen Code)

---

## Quick Start (5 Minutes)

### One-Command Install

The fastest way to get the framework — clones it, installs the global `pf` command and all skills:

**Linux / macOS** (requires `git` and `node` on your `PATH`):
```sh
curl -fsSL https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/install.sh | sh
```

**Windows** (PowerShell, requires `git` and `node` on your `PATH`):
```powershell
irm https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/install.ps1 | iex
```

Re-running the same command later updates an existing install in place (no prompts).

> The installer pulls from the `main` (release) branch; `develop` is the active-development trunk. To install into a custom location instead, use the manual steps below, or explore the framework interactively with `make tui`.

### Manual Install / Upgrade — one command for every case

```bash
# 1. Clone planning framework
git clone https://github.com/[your-org]/planning-framework
cd planning-framework

# 2. Converge your project on v3
make converge TARGET=/path/to/your-project
# Works whatever the project starts from: no framework, v1, v2,
# half-migrated, or an incomplete v3 install. Idempotent.

# 3. Review and commit
cd /path/to/your-project && git status && git add . && git commit -m "Planning Framework v3.0"

# 4. Set up QA gates and create the first issue
# In Claude Code: /pf-qa-setup, then "Create an issue to [add feature]"
```

Not sure what it would do? Add `--dry-run`:

```bash
./scripts/converge-to-v3.sh --target /path/to/your-project --dry-run
```

**See [QUICKSTART.md](docs/planning/QUICKSTART.md) for the complete 5-minute guide and [MIGRATION-GUIDE-V3.md](docs/planning/MIGRATION-GUIDE-V3.md) for upgrades.**

---

## How It Works

### Issue-Based Workflow

```
USER REQUEST → CREATE ISSUE → ANALYZE → PLAN → IMPLEMENT → QA → CLOSE
```

### File Structure

```
your-project/
├── PLANNING.md                      # Framework config
├── .qa-workflow.md                  # QA requirements
│
├── docs/
│   ├── issues/
│   │   ├── open/                    # Active work
│   │   │   └── 20240127-feat-add-auth/
│   │   │       ├── prompt.md        # Original request
│   │   │       ├── analysis.md      # Understanding
│   │   │       ├── implementation-plan.md  # Tasks
│   │   │       └── session-log.md   # Progress
│   │   │
│   │   └── closed/                  # Completed (archived)
│   │
│   └── planning/
│       ├── implementation-plan.md   # Roadmap (stays small!)
│       ├── session-log.md           # Timeline
│       └── decisions.md             # Decisions
```

### What Agents Do

**Session Start:**
1. Read `PLANNING.md` - Framework instructions
2. Read issue files - Context for current task
3. Read global `decisions.md` - Architectural choices

**During Work:**
- Focus on ONE issue per session
- Update progress in `session-log.md`
- Check off tasks in `implementation-plan.md`

**Before Closing:**
- Run QA workflow (`.qa-workflow.md`)
- Get user confirmation
- Merge and archive issue

---

## Key Features

### 1. Issue Naming

**Format:** `YYYYMMDD-{type}-{slug}`

**Example:** `20240127-feat-add-authentication`

- Date ensures uniqueness across branches
- Type visible at glance (feat/bug/improve)
- Slug provides readability

### 2. Branches

**One branch per issue:** `issue/YYYYMMDD-{type}-{slug}`
- 1:1 mapping with issue folder
- Clean isolation, no conflicts

### 3. Global Files (Stay Small!)

**implementation-plan.md** - Roadmap + active issues
**session-log.md** - One-line entries when issues close
**decisions.md** - Architectural decisions

**Details live in issue folders, not global files.**

### 4. Quality Assurance

`.qa-workflow.md` defines gates before closing:
- Linting/formatting
- Tests (existing + new)
- Documentation
- Security review

---

## Documentation

- 📖 **[Complete Guide](docs/planning/FRAMEWORK.md)** - Full documentation
- ⚡ **[Quick Start](docs/planning/QUICKSTART.md)** - 5-minute setup
- 🔄 **[Migration Guide](docs/planning/MIGRATION-GUIDE-V3.md)** - Converge any project on v3.0
- 📁 **[Templates](docs/planning/templates/)** - All templates
- 🗄️ **[v1.0 Archive](docs/planning/v1.0-archive/)** - Historical v1/v2 documents (not executable)

---

## Multi-Agent Support

Works with:
- **Claude Code** - Anthropic's CLI tool
- **Gemini CLI** - Google's CLI tool
- **Qwen Code** - Qwen's CLI tool
- **Any AI agent** - Generic instructions

**Single `PLANNING.md` for all agents.**

Session logs track which agent did what:
```
[Claude Code] ✓ [issue-id](link) - Description
[Gemini CLI] 2024-01-28: Ad-hoc work
```

---

## Scripts & Automation

**One-command installer** (Linux/macOS/Windows — clones the framework, installs `pf` + skills):
```bash
curl -fsSL https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/install.sh | sh   # Linux/macOS
irm https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/install.ps1 | iex        # Windows
```

**Install / migrate / top up — one script:**
```bash
make converge                       # Converge the current directory on v3
make converge TARGET=<path>         # ...or a specific project
./scripts/converge-to-v3.sh --dry-run --target <path>   # Show the plan, change nothing
```

Installs the framework + skills + the global `pf` shim, migrates v1/v2 layouts, and tops up an incomplete v3 install. Same script for all of it.

**Interactive:**
```bash
make tui                            # Onboarding/update wizard (also available as `pf`)
```

**Skills maintenance:**
```bash
./scripts/update-skills.sh          # Propagate skill updates to consumer projects
```

All scripts:
- Interactive prompts
- Colorized output
- Error handling
- Comprehensive help

---

## Benefits

### For Developers

✅ **Zero context loss** - Pick up exactly where you left off
✅ **Clear progress** - Visual tracking with checkboxes
✅ **Isolated work** - Issues don't interfere with each other
✅ **No conflicts** - Branch-specific planning files

### For AI Agents

✅ **Focused context** - Read only relevant issue
✅ **Clear workflow** - 6-phase lifecycle
✅ **Consistent behavior** - Follows documented patterns
✅ **Reduced tokens** - Small files, not 1000s of lines

### For Teams

✅ **Parallel development** - No merge conflicts
✅ **Issue tracking** - Built-in feature/bug management
✅ **Quality gates** - QA workflow before merging
✅ **Decision history** - Architectural choices documented

---

## Real-World Usage

Planning Framework v2.0 was built using itself (dogfooding):
- **Issue:** `20240127-feat-implement-v2`
- **6 phases:** Bootstrap, Templates, Scripts, Documentation, Self-Migration, Testing
- **51 tasks:** Tracked in implementation-plan.md
- **Progress:** Updated after each session
- **Result:** Working v2.0 framework! 🎉

---

## Customization

### Issue Types

Default: `feat`, `bug`, `improve`

Add more in `PLANNING.md`:
```markdown
- `refactor` - Code restructuring
- `docs` - Documentation only
- `test` - Testing improvements
- `chore` - Maintenance tasks
```

### QA Workflow

Customize `.qa-workflow.md`:
```markdown
### Project-Specific
- [ ] Performance: API response < 100ms
- [ ] Security: No SQL injection risks
- [ ] Accessibility: WCAG AA compliant
```

---

## When to Use

### ✅ Good Fit

- Multi-session projects (days/weeks/months)
- AI-assisted development
- Multiple feature branches
- Complex projects with many decisions
- Team collaboration

### ⚠️ May Be Overkill For

- Single-session prototypes
- Trivial scripts (<100 LOC)
- Well-defined, simple tasks

---

## What's Different from v1.0?

| Feature | v1.0 | v2.0 |
|---------|------|------|
| **Work tracking** | Global files | Issue folders |
| **File growth** | Unbounded | Bounded (roadmap only) |
| **Merge conflicts** | Yes (planning docs) | No (branch-specific) |
| **Multi-agent** | Separate configs | Single PLANNING.md |
| **Issue tracking** | Manual | Built-in workflow |
| **QA gates** | None | .qa-workflow.md |

---

## Contributing

Contributions welcome! Areas:

- ✨ Additional templates
- 🔧 Platform-specific improvements
- 📚 Integration examples
- 🎨 Domain-specific variations
- 📖 Real-world examples

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Support

- 📖 **Documentation:** [FRAMEWORK.md](docs/planning/FRAMEWORK.md)
- ⚡ **Quick Help:** [QUICKSTART.md](docs/planning/QUICKSTART.md)
- 🔄 **Migration:** [MIGRATION-GUIDE-V3.md](docs/planning/MIGRATION-GUIDE-V3.md)
- 🐛 **Issues:** [GitHub Issues](https://github.com/[your-org]/planning-framework/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/[your-org]/planning-framework/discussions)

---

## License

MIT License - Use freely in any project. See [LICENSE](LICENSE) for details.

---

## Acknowledgments

**Created by:** Human + Claude collaboration
**Inspired by:** Need for better context preservation in AI-assisted development
**Built with:** Planning Framework v2.0 (dogfooding!)

---

## Version History

- **v3.0.0** (2026-06-24) - Skills-Based Workflow
  - 7 Claude Code skills (`/pf`, `/pf-brd`, `/pf-spec`, `/pf-check`, `/pf-test-plan`, `/pf-impl-plan`, `/pf-execute`)
  - BRD → spec → test plan → implementation plan pipeline
  - Pipeline enforcement (prerequisites checked by skills)
  - `scripts/setup-planning-v3.sh` and `scripts/update-skills.sh`
  - See [CHANGELOG.md](CHANGELOG.md) for details

- **v2.0.0** (2026-01-28) - Issue-Based Workflow
  - Issue-based workflow (each task in its own folder)
  - Bounded file sizes (global files stay small)
  - No merge conflicts (branch-specific issues)
  - Multi-agent support (single PLANNING.md)
  - Built-in QA workflow
  - Automation scripts (setup, migration, helpers)
  - Comprehensive documentation
  - See [CHANGELOG.md](CHANGELOG.md) for details

- **v1.1.0** (2025-11-12) - Time Estimation Removal
  - Remove time estimation fields
  - Update templates and documentation

- **v1.0.0** (2025-11-05) - Initial Release
  - Core templates (PRD, Implementation Plan, Session Log, Decisions)
  - Setup scripts
  - CLAUDE.md integration

---

**Star this repo if it helps your project! ⭐**

**Planning Framework v3.0 - Build better with AI assistance** 🚀
