# Planning Framework v3.0 - Quick Start

**Get started in 5 minutes**
**Version:** 3.0.0
**Last Updated:** 2026-06-24

---

## What is Planning Framework?

Planning Framework v3.0 helps AI agents work on your project across multiple sessions without losing context. v3.0 adds a skills layer for Claude Code that enforces a document pipeline before any implementation starts.

**Key idea:** Each task gets its own **issue folder** with a pipeline of documents (BRD → spec → test plan → implementation plan → progress). Global files stay small. No merge conflicts.

**Perfect for:** AI-assisted development with Claude Code, Gemini CLI, Qwen Code, or other AI agents.

---

## 5-Minute Setup

### Step 1: Install (1 min)

```bash
git clone https://github.com/[your-org]/planning-framework /tmp/planning-fw
cd /tmp/planning-fw
make converge TARGET=/path/to/your-project
```

`converge` is the single entry point: the same command installs into a fresh project, upgrades a v1 or v2 one, finishes a half-migrated one, and tops up an incomplete v3 one. It is idempotent — re-run it any time. Add `--dry-run` to see the plan without changing anything.

**Created:**
- `PLANNING.md` - Framework instructions
- `.pf-version` - Framework version stamp
- `CLAUDE.md` - With a `<!-- pf:begin -->` / `<!-- pf:end -->` framework section
- 17 skills in `~/.claude/skills/` (`/pf`, `/pf-help`, `/pf-brd`, `/pf-spec`, `/pf-check`, `/pf-test-plan`, `/pf-impl-plan`, `/pf-execute`, `/pf-test`, `/pf-manual-test`, `/pf-qa`, `/pf-qa-setup`, `/pf-close`, `/pf-autopilot`, `/pf-update`, `/pf-size-tiers`, `/pf-git`) and the `pf` shim in `~/.claude/bin/`
- `docs/issues/open/` and `/closed/` - Issue folders
- `docs/planning/` - Global planning files + templates

**Not created:** `.qa-workflow.md`. QA gates are project-specific, so there is no template — run `/pf-qa-setup` in Claude Code and it writes one fitted to your project.

### Step 2: Commit (30 sec)

```bash
git add .
git commit -m "Setup Planning Framework v3.0"
```

### Step 3: Create First Issue (2 min)

Tell your AI agent:
```
"I'd like to add [your feature]. Can you create an issue for this?"
```

Agent will:
1. Create issue folder: `docs/issues/open/YYYYMMDD-feat-your-feature/`
2. Fill out `prompt.md` (your request)
3. Fill out `analysis.md` (understanding)
4. Create `implementation-plan.md` (tasks)
5. Start working!

### Step 4: Let Agent Work (1 min)

Agent follows workflow automatically:
- Creates issue branch
- Works through tasks
- Updates progress in `session-log.md`
- Runs QA before closing
- Merges and archives

**Done!** You're using Planning Framework v2.0.

---

## Core Workflow

### 5-Minute Workflow (Claude Code with Skills)

```
/pf                  ← See active issue and next step
/pf-brd              ← Create BRD (feat/improve)
/pf-check            ← Verify BRD is complete
/pf-spec             ← Generate spec from BRD
/pf-check            ← Verify spec matches BRD
/pf-test-plan        ← Generate test plan from spec
/pf-impl-plan        ← Generate implementation plan
/pf-execute          ← Begin implementation
/pf-test             ← Run automated tests and generate manual checklist
/pf-qa               ← Run QA checks and produce qa_report.md
/pf-close            ← Merge branch, archive issue, update session-log
```

Each skill checks that the previous step is done before proceeding.

### Issue Lifecycle

**feat:**
```
CREATE → BRD → SPEC → TEST_PLAN → IMPL_PLAN → /pf-execute → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

**improve:**
```
CREATE → BRD → TEST_PLAN → IMPL_PLAN → /pf-execute → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

**bug:**
```
CREATE → ANALYZE → TEST_PLAN → IMPL_PLAN → /pf-execute → TESTING → /pf-qa → QA → /pf-close → CLOSED
```

### File Structure

```
your-project/
├── PLANNING.md                      # Read this first!
├── .qa-workflow.md                  # QA requirements
├── skills/                          # Claude Code skills (/pf, /pf-brd, etc.)
│
├── docs/
│   ├── issues/
│   │   ├── open/                    # Work in progress
│   │   │   └── 20240127-feat-add-auth/
│   │   │       ├── prompt.md        # Your request
│   │   │       ├── brd.md           # Business requirements (feat/improve)
│   │   │       ├── specs.md         # Technical spec (feat/improve)
│   │   │       ├── test_plan.md     # Test plan (all types)
│   │   │       ├── implementation_plan.md  # Tasks
│   │   │       └── session-log.md   # Progress
│   │   │
│   │   └── closed/                  # Done!
│   │
│   └── planning/
│       ├── implementation-plan.md   # High-level roadmap
│       ├── session-log.md           # Timeline
│       └── decisions.md             # Architecture decisions
```

### What Agents Do

**Session Start (Claude Code):**
- Run `/pf` — reads active issue, shows stage and next step

**Session Start (other agents):**
1. Read `PLANNING.md` - Framework instructions
2. Read issue files - Context for this task
3. Read global `decisions.md` - Architectural choices

**During Work:**
- Focus on ONE issue at a time
- Update `session-log.md` after working
- Check off tasks in `implementation_plan.md`
- Document decisions if needed

**Session End:**
- Update progress
- Note blockers
- Commit changes

**Before Closing:**
- Run QA workflow (`.qa-workflow.md`)
- Get user confirmation
- Merge and archive

---

## Key Concepts

### Issues

**What:** Each feature/bug/improvement gets an issue folder

**Named:** `YYYYMMDD-{type}-{slug}`
- Example: `20240127-feat-add-authentication`
- Date = uniqueness across branches
- Type = feat, bug, improve (customizable)
- Slug = readable description

**Contains (feat/improve):**
- `prompt.md` - Your original request
- `brd.md` - Business requirements
- `specs.md` - Technical specification
- `test_plan.md` - Test plan (required before implementation)
- `implementation_plan.md` - Task checklist
- `session-log.md` - Progress tracking
- `decisions.md` (optional) - Decisions made

**Contains (bug):**
- `prompt.md` - Your original request
- `analysis.md` - Root cause analysis
- `test_plan.md` - Failing test + fix verification
- `implementation_plan.md` - Task checklist
- `session-log.md` - Progress tracking

### Branches

**One branch per issue:** `issue/YYYYMMDD-{type}-{slug}`
- Matches issue folder name
- Clean isolation
- No conflicts!

### Global Files

**Stay small** - only roadmap, not details:

- **implementation-plan.md** - Current milestone, active issues, roadmap
- **session-log.md** - One-line entries when issues close
- **decisions.md** - Project-wide architectural decisions

Details live in **issue folders**, not global files.

### Quality Assurance

**`.qa-workflow.md`** defines what must pass before closing:
- Linting/formatting
- Tests (existing + new)
- Documentation
- Security review
- (Bugs) Failing test → fix → passing test

**Agent won't close issue until QA passes.**

---

## Common Commands

### For Claude Code (Skills)

```
/pf                  Show active issue and next pipeline step
/pf-brd              Create BRD for active feat/improve issue
/pf-spec             Create spec from BRD
/pf-check            Verify pipeline document consistency
/pf-test-plan        Create test plan from spec or analysis
/pf-impl-plan        Create implementation plan from test plan
/pf-execute          Begin implementation
/pf-test             Run automated tests, update Status Tracker, generate manual_test_checklist.md
/pf-qa               Run QA checks from .qa-workflow.md and produce qa_report.md with PASS/FAIL verdict
/pf-qa-setup         Create or update .qa-workflow.md for the project
/pf-close            Merge branch, archive issue folder, update session-log
```

### For Other AI Agents

```bash
# Session start - read context
cat PLANNING.md
tail -20 docs/planning/session-log.md
cat docs/planning/implementation-plan.md

# If working on issue
cat docs/issues/open/[issue-id]/prompt.md
cat docs/issues/open/[issue-id]/brd.md         # or analysis.md for bugs
cat docs/issues/open/[issue-id]/implementation_plan.md

# Check issue progress
ls docs/issues/open/[issue-id]/
cat docs/issues/open/[issue-id]/session-log.md
```

### For Users

```bash
# Check what's being worked on
ls docs/issues/open/

# See progress on current issue
cat docs/issues/open/[issue-id]/session-log.md

# See recent work
tail -20 docs/planning/session-log.md

# Update skills in this project from framework source
./scripts/update-skills.sh
```

---

## Example Session

### Creating an Issue

**You:**
> "I need to add user authentication to the app"

**Agent:**
> "This looks like non-trivial work. Should I create an issue for this?"

**You:**
> "Yes"

**Agent creates:**
```
docs/issues/open/20240127-feat-add-authentication/
├── prompt.md           "I need to add user authentication..."
├── brd.md              Business requirements, user stories, success criteria
├── specs.md            Technical design, API contracts, component breakdown
├── test_plan.md        Test scenarios and acceptance criteria
└── implementation_plan.md   Broken into phases/tasks
```

### Working on Issue

**Agent:**
1. Creates branch: `issue/20240127-feat-add-authentication`
2. Works through `implementation_plan.md` tasks
3. After session, updates `session-log.md`:

```markdown
## Session: 2024-01-27

### Completed
- [x] Created User model
- [x] Added JWT middleware
- [ ] Added login endpoint (in progress)

### Next Session
- [ ] Finish login endpoint
- [ ] Add tests
```

### Closing Issue

**Agent:**
> "I've completed all tasks. Running QA workflow..."

**QA passes:**
- ✓ Linting
- ✓ Tests
- ✓ Documentation

**Agent:**
> "Issue is complete! Should I close it?"

**You:**
> "Yes"

**Agent:**
1. Merges `issue/20240127-feat-add-authentication` → `develop`
2. Moves issue folder: `open/` → `closed/`
3. Updates global `session-log.md`:
   ```
   [Claude Code] ✓ [20240127-feat-add-authentication](../issues/closed/20240127-feat-add-authentication/) - Added JWT authentication
   ```
4. Commits everything

**Done!**

---

## Tips & Tricks

### For Best Results

**DO:**
- ✅ Let agent create issues for non-trivial work
- ✅ One issue per session (focused work)
- ✅ Review `session-log.md` to see progress
- ✅ Check `implementation-plan.md` to see what's left
- ✅ Trust the QA workflow

**DON'T:**
- ❌ Create issues for typo fixes (work directly)
- ❌ Skip QA workflow (quality matters!)
- ❌ Work on multiple issues at once (stay focused)
- ❌ Delete branches immediately (manual cleanup when ready)

### Customization

**Add custom issue types** in `PLANNING.md`:
```markdown
**Issue Types:**
- `feat` - New feature
- `bug` - Fix bug
- `improve` - Enhance existing
- `docs` - Documentation only      ← Add this
- `refactor` - Code restructuring   ← Add this
```

**Customize QA** in `.qa-workflow.md`:
```markdown
### Project-Specific
- [ ] Performance: API response < 100ms
- [ ] Security: No SQL injection risks
- [ ] Accessibility: WCAG AA compliant
```

### Multi-Agent Usage

**Works with:**
- Claude Code
- Gemini CLI
- Qwen Code
- Any AI agent

**Same `PLANNING.md` for all!**

Session logs track which agent did what:
```
[Claude Code] ✓ [issue-id] - Description
[Gemini CLI] 2024-01-28: Ad-hoc work
[Qwen Code] ✓ [issue-id] - Description
```

---

## Updating Skills

When the framework publishes skill updates, pull them into your project:

```bash
./scripts/update-skills.sh
```

This copies the latest skill files from the framework source into your project's `skills/` directory. Commit the result to propagate the update to your team.

---

## Migrating from v1 or v2

```bash
make converge TARGET=/path/to/your-project
```

The same command as a fresh install — there is no separate migration script. It:
1. Detects the starting state (none / v1 / v2 / half-migrated / incomplete v3)
2. Backs up `planning/` to `planning-backup-<timestamp>/` before touching anything
3. Moves your issues and global documents from `planning/` into `docs/`
4. Renames `implementation-plan.md` → `implementation_plan.md` inside issue folders
5. Deletes v1/v2 framework artifacts **by whitelist** (never `rm -rf planning/`)
6. Tops up to the v3 target state: `.pf-version`, `PLANNING.md`, the `CLAUDE.md` section, templates, all 15 skills, the `pf` shim
7. Prints a report — including, per issue, which v3 documents are still missing

Run it with `--dry-run` first to see the plan.

Open issues keep working: no stub documents are minted, `/pf` simply routes you to the first incomplete stage. Closed issues are never rewritten — they get a `brd.md` pointer to their legacy documents. Bug issues follow the analysis + test plan path and are unaffected.

Full detail: **[MIGRATION-GUIDE-V3.md](MIGRATION-GUIDE-V3.md)**.

---

## Troubleshooting

### "Agent doesn't understand framework"

**Solution:**
```
"Please read PLANNING.md for framework instructions"
```

### "Files growing too large"

**Solution:**
This shouldn't happen! Issues contain details, not global files.

If `decisions.md` gets large:
```bash
# Split by topic
mv docs/planning/decisions.md docs/planning/decisions-api.md
# Create new decisions.md
# Update PLANNING.md with split
```

### "Merge conflicts in planning docs"

**Solution:**
This shouldn't happen! Issue folders are branch-specific.

If it does, report as bug: https://github.com/[your-org]/planning-framework/issues

### "Lost context from previous session"

**Solution:**
Read issue files:
```bash
cat docs/issues/open/[issue-id]/session-log.md
cat docs/issues/open/[issue-id]/implementation-plan.md
```

---

## Next Steps

### Learn More

- **[FRAMEWORK.md](FRAMEWORK.md)** - Complete guide (all features, best practices, FAQ)
- **[MIGRATION-GUIDE-V3.md](MIGRATION-GUIDE-V3.md)** - Converging any project on v3.0
- **[templates/README.md](templates/README.md)** - Template documentation

### Get Help

- **GitHub Issues:** https://github.com/[your-org]/planning-framework/issues
- **Discussions:** https://github.com/[your-org]/planning-framework/discussions
- **Documentation:** Read PLANNING.md in your project

### Share

Love Planning Framework? Share it:
- Star on GitHub
- Tweet about it
- Tell your AI agent friends!

---

## Quick Reference Card

```
CONVERGE:    make converge TARGET=<path>   (install / migrate / top up — one command)
PREVIEW:     ./scripts/converge-to-v3.sh --target <path> --dry-run
UPDATE:      ./scripts/update-skills.sh

SESSION:     /pf → shows status and next step (Claude Code)
PIPELINE:    /pf-brd → /pf-spec → /pf-test-plan → /pf-impl-plan → /pf-execute → /pf-test → /pf-qa → /pf-close
CHECK:       /pf-check → verifies pipeline consistency
QA SETUP:    /pf-qa-setup → create/update .qa-workflow.md

FOLDER:      docs/issues/open/YYYYMMDD-type-slug/
BRANCH:      issue/YYYYMMDD-type-slug
NAMING:      Date-Type-Slug (e.g., 20240127-feat-add-auth)

feat/improve: prompt.md, brd.md, specs.md, test_plan.md, implementation_plan.md, session-log.md
bug:          prompt.md, analysis.md, test_plan.md, implementation_plan.md, session-log.md
optional:     decisions.md

GLOBAL:      implementation-plan.md (roadmap, stays small!)
             session-log.md (one-line entries)
             decisions.md (architectural decisions)
```

---

**You're ready to use Planning Framework v3.0!**

Create your first issue and start building. 🚀

---

**Version:** 3.0.0
**Last Updated:** 2026-06-24
