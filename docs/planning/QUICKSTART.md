# Planning Framework v2.0 - Quick Start

**Get started in 5 minutes**
**Version:** 2.0.0
**Last Updated:** 2024-01-27

---

## What is Planning Framework?

Planning Framework v2.0 helps AI agents work on your project across multiple sessions without losing context.

**Key idea:** Each task gets its own **issue folder** with complete context (request, plan, progress). Global files stay small. No merge conflicts.

**Perfect for:** AI-assisted development with Claude Code, Gemini CLI, Qwen Code, or other AI agents.

---

## 5-Minute Setup

### Step 1: Install (1 min)

```bash
# In your project directory
git clone https://github.com/[your-org]/planning-framework /tmp/planning-fw
cd /tmp/planning-fw
./scripts/setup-planning-v2.sh
```

Answer prompts:
- Project name: `your-project`
- Issue types: ` Enter` (use defaults: feat, bug, improve)
- QA checks: `Enter` (use all)
- Agent: `4` (all agents)

**Created:**
- `PLANNING.md` - Framework instructions
- `.qa-workflow.md` - Quality gates
- `docs/issues/open/` and `/closed/` - Issue folders
- `docs/planning/` - Global planning files

### Step 2: Commit (30 sec)

```bash
git add .
git commit -m "Setup Planning Framework v2.0"
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

### Issue Lifecycle

```
USER REQUEST
    ↓
CREATE ISSUE (agent asks if non-trivial)
    ↓
ANALYZE (understand problem, plan approach)
    ↓
IMPLEMENT (work through tasks, track progress)
    ↓
QA (run quality checks - must pass!)
    ↓
CLOSE (merge, archive, update global logs)
```

### File Structure

```
your-project/
├── PLANNING.md                      # Read this first!
├── .qa-workflow.md                  # QA requirements
│
├── docs/
│   ├── issues/
│   │   ├── open/                    # Work in progress
│   │   │   └── 20240127-feat-add-auth/
│   │   │       ├── prompt.md        # Your request
│   │   │       ├── analysis.md      # Agent's plan
│   │   │       ├── implementation-plan.md  # Tasks
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

**Session Start:**
1. Read `PLANNING.md` - Framework instructions
2. Read issue files - Context for this task
3. Read global `decisions.md` - Architectural choices

**During Work:**
- Focus on ONE issue at a time
- Update `session-log.md` after working
- Check off tasks in `implementation-plan.md`
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

**Contains:**
- `prompt.md` - Your original request
- `analysis.md` - Agent's understanding
- `implementation-plan.md` - Task checklist
- `session-log.md` - Progress tracking
- `decisions.md` (optional) - Decisions made
- `definition-of-done.md` (optional) - Completion criteria

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

### For AI Agents

```bash
# Session start - read context
cat PLANNING.md
tail -20 docs/planning/session-log.md
cat docs/planning/implementation-plan.md

# If working on issue
cat docs/issues/open/[issue-id]/prompt.md
cat docs/issues/open/[issue-id]/analysis.md
cat docs/issues/open/[issue-id]/implementation-plan.md

# Create issue (or ask agent)
./scripts/create-issue.sh

# Close issue (or ask agent)
./scripts/close-issue.sh
```

### For Users

```bash
# Check what's being worked on
ls docs/issues/open/

# See progress on current issue
cat docs/issues/open/[issue-id]/session-log.md

# See recent work
tail -20 docs/planning/session-log.md

# Create issue manually
./scripts/create-issue.sh

# Help agent close issue
./scripts/close-issue.sh
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
├── analysis.md         Problem understanding, approach
└── implementation-plan.md   Broken into phases/tasks
```

### Working on Issue

**Agent:**
1. Creates branch: `issue/20240127-feat-add-authentication`
2. Works through `implementation-plan.md` tasks
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
- **[MIGRATION-GUIDE.md](MIGRATION-GUIDE.md)** - Upgrading from v1.0
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
SETUP:       ./scripts/setup-planning-v2.sh
CREATE:      Ask agent to create issue
WORK:        Agent reads issue files, implements, updates progress
QA:          Agent runs .qa-workflow.md
CLOSE:       Agent merges, archives, updates global logs

FOLDER:      docs/issues/open/YYYYMMDD-type-slug/
BRANCH:      issue/YYYYMMDD-type-slug
NAMING:      Date-Type-Slug (e.g., 20240127-feat-add-auth)

REQUIRED:    prompt.md, analysis.md, implementation-plan.md, session-log.md
OPTIONAL:    decisions.md, definition-of-done.md

GLOBAL:      implementation-plan.md (roadmap, stays small!)
             session-log.md (one-line entries)
             decisions.md (architectural decisions)
```

---

**You're ready to use Planning Framework v2.0!**

Create your first issue and start building. 🚀

---

**Version:** 2.0.0
**Last Updated:** 2024-01-27
