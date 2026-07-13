# Migration Guide: v1.0 → v2.0

> **⚠️ HISTORICAL — v1.0 → v2.0. Archived, not maintained.**
> Kept for reference only. `migrate-v1-to-v2.sh` no longer exists, and v2.0 is
> no longer a supported target. To bring a project of **any** age (v1, v2,
> half-migrated, or none) to the current v3 state, run `make converge`
> (`scripts/converge-to-v3.sh`) — it supersedes every per-version migration
> script. See `docs/planning/MIGRATION-GUIDE-V3.md`.

**Planning Framework Migration**
**Version:** 2.0.0
**Last Updated:** 2024-01-27

---

## Table of Contents

1. [Why Migrate](#why-migrate)
2. [What's Changed](#whats-changed)
3. [Pre-Migration](#pre-migration)
4. [Migration Steps](#migration-steps)
5. [Post-Migration](#post-migration)
6. [Troubleshooting](#troubleshooting)

---

## Why Migrate

### v1.0 Problems

Planning Framework v1.0 has fundamental issues:

**❌ Unbounded File Growth:**
- `implementation-plan.md` grows indefinitely
- `session-log.md` becomes huge
- Agents read 1000s of lines for context

**❌ Merge Conflicts:**
- Feature branches conflict on planning docs
- Difficult to work on multiple features
- Time wasted resolving conflicts

**❌ Multi-Agent Complexity:**
- Need CLAUDE.md, GEMINI.md, QWEN.md
- Duplicate instructions
- Hard to keep in sync

**❌ No Issue Tracking:**
- No structured feature/bug workflow
- All work mixed in one file
- Hard to track what's complete

### v2.0 Solutions

**✅ Issue-Based Workflow:**
- Each task in its own folder
- Global files stay small (roadmap only)
- Agents read only relevant context

**✅ No Merge Conflicts:**
- Issues are branch-specific
- No shared planning docs
- Clean parallel development

**✅ Single Config:**
- One `PLANNING.md` for all agents
- Multi-agent support built-in
- Consistent workflow

**✅ Built-in Issue Tracking:**
- Structured feature/bug workflow
- Clear lifecycle (6 phases)
- Quality gates before closure

---

## What's Changed

### File Structure

**v1.0:**
```
project/
├── CLAUDE.md
├── GEMINI.md (if using Gemini)
├── QWEN.md (if using Qwen)
└── docs/planning/
    ├── implementation-plan.md  (grows forever)
    ├── session-log.md          (grows forever)
    └── decisions.md
```

**v2.0:**
```
project/
├── PLANNING.md                 (replaces CLAUDE.md, etc.)
├── .qa-workflow.md             (new: QA gates)
├── docs/
│   ├── issues/
│   │   ├── open/               (new: active issues)
│   │   └── closed/             (new: completed issues)
│   └── planning/
│       ├── implementation-plan.md  (now minimal!)
│       ├── session-log.md          (one-line entries!)
│       └── decisions.md            (same, but split by topic)
```

### Workflow Changes

| v1.0 | v2.0 |
|------|------|
| All work in global files | Work in issue folders |
| No issue tracking | Issue-based workflow |
| Single agent config files | Multi-agent PLANNING.md |
| No QA workflow | QA gates before closing |
| Manual context management | Structured context in issues |

### Compatibility

**Breaking changes:**
- CLAUDE.md → PLANNING.md (different format)
- implementation-plan.md format changed
- session-log.md format changed
- New folder structure (docs/issues/)

**Migration script handles all changes automatically.**

---

## Pre-Migration

### Prerequisites

**Required:**
- Git repository
- Planning Framework v1.0 installed
- Uncommitted changes committed or stashed

**Recommended:**
- Review v1.0 files one last time
- Note any important context to preserve
- Backup project (git clone to temp folder)

### Backup Strategy

Migration script automatically backs up:
- All v1.0 planning files
- Timestamped backup folder
- Non-destructive (can roll back)

**Manual backup (optional):**
```bash
# Clone entire project
cp -r project-name project-name-backup

# Or just planning files
mkdir ~/planning-backup
cp -r docs/planning ~/planning-backup/
cp CLAUDE.md ~/planning-backup/ 2>/dev/null || true
```

### Estimated Time

- **Script runtime:** 1-5 minutes
- **Review/customize:** 15-30 minutes
- **Testing:** 10-15 minutes
- **Total:** 30-60 minutes

---

## Migration Steps

### Option 1: Automated Migration (Recommended)

**Step 1: Run migration script**

```bash
cd your-project/
./scripts/migrate-v1-to-v2.sh
```

**The script will:**
1. Check git status (warns about uncommitted changes)
2. Back up all v1.0 files to `docs/planning/v1.0-archive-[timestamp]/`
3. Create v2.0 folder structure
4. Convert global planning files
5. Create PLANNING.md and .qa-workflow.md
6. Generate migration report
7. Display next steps

**Step 2: Review generated files**

```bash
# Review new config files
cat PLANNING.md
cat .qa-workflow.md

# Review migration report
cat docs/planning/MIGRATION-REPORT-*.md
```

**Step 3: Customize for your project**

```markdown
# Edit PLANNING.md
- Update project name
- Customize issue types
- Add project-specific notes

# Edit .qa-workflow.md
- Update test commands
- Add project-specific checks
- Set coverage requirements
```

**Step 4: Update global planning files**

```markdown
# Edit docs/planning/implementation-plan.md
- Add current milestone
- List active work as planned issues
- Set roadmap (next 2-3 milestones)

# Review docs/planning/session-log.md
- v1.0 history preserved in backup
- New v2.0 format starts here

# Review docs/planning/decisions.md
- Compatible with v2.0 (no changes needed)
```

**Step 5: Commit migration**

```bash
git add .
git commit -m "Migrate to Planning Framework v2.0

- Migrate from v1.0 to v2.0 issue-based workflow
- Create PLANNING.md (replaces CLAUDE.md)
- Add .qa-workflow.md for quality gates
- Create issue folder structure
- v1.0 files backed up to docs/planning/v1.0-archive-*
- See migration report for details"
```

**Step 6: Test the migration**

```bash
# Create a test issue
./scripts/create-issue.sh
# Type: feat
# Slug: test-migration

# Verify issue folder created
ls docs/issues/open/

# Read PLANNING.md
cat PLANNING.md
```

**Done!** You're on v2.0.

---

### Option 2: Manual Migration

If migration script isn't available:

**Step 1: Backup v1.0 files**

```bash
mkdir -p docs/planning/v1.0-archive
cp CLAUDE.md docs/planning/v1.0-archive/ 2>/dev/null || true
cp GEMINI.md docs/planning/v1.0-archive/ 2>/dev/null || true
cp QWEN.md docs/planning/v1.0-archive/ 2>/dev/null || true
cp docs/planning/*.md docs/planning/v1.0-archive/
```

**Step 2: Create v2.0 structure**

```bash
mkdir -p docs/issues/open
mkdir -p docs/issues/closed
```

**Step 3: Copy templates**

```bash
# Get Planning Framework repo
git clone https://github.com/[your-org]/planning-framework /tmp/planning-fw

# Copy config templates
cp /tmp/planning-fw/docs/planning/templates/config/PLANNING.md ./
cp /tmp/planning-fw/docs/planning/templates/config/.qa-workflow.md ./

# Copy global planning templates
cp /tmp/planning-fw/docs/planning/templates/global/implementation-plan.md docs/planning/
cp /tmp/planning-fw/docs/planning/templates/global/session-log.md docs/planning/
```

**Step 4: Customize templates**

```bash
# Replace placeholders
PROJECT_NAME="YourProject"
sed -i "s/\[Project Name\]/$PROJECT_NAME/g" PLANNING.md
sed -i "s/\[Project Name\]/$PROJECT_NAME/g" .qa-workflow.md
sed -i "s/\[Project Name\]/$PROJECT_NAME/g" docs/planning/implementation-plan.md
sed -i "s/\[Project Name\]/$PROJECT_NAME/g" docs/planning/session-log.md

# Update dates
CURRENT_DATE=$(date +%Y-%m-%d)
sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" PLANNING.md
sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" .qa-workflow.md
sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" docs/planning/*.md
```

**Step 5: Preserve v1.0 decisions**

```bash
# decisions.md is compatible - keep it
# Just ensure proper format
```

**Step 6: Update old config files**

```bash
# Update CLAUDE.md with migration notice
cat > CLAUDE.md << 'EOF'
# ⚠️ Migrated to Planning Framework v2.0

This project has been migrated to Planning Framework v2.0.

**New configuration file:** PLANNING.md

See PLANNING.md for the new framework instructions.
EOF
```

**Step 7: Commit**

```bash
git add .
git commit -m "Migrate to Planning Framework v2.0 (manual migration)"
```

---

## Post-Migration

### Immediate Tasks

**1. Verify migration**

```bash
# Check file structure
tree docs/

# Should show:
# docs/
# ├── issues/
# │   ├── open/
# │   └── closed/
# └── planning/
#     ├── implementation-plan.md
#     ├── session-log.md
#     ├── decisions.md
#     └── v1.0-archive-*/
```

**2. Review migration report**

```bash
cat docs/planning/MIGRATION-REPORT-*.md
```

**3. Test issue creation**

```bash
./scripts/create-issue.sh
# Or ask AI agent to create an issue
```

### Converting v1.0 Work to Issues

**Optional:** Convert completed v1.0 work to closed issues for history.

**For each major completed feature:**

```bash
# 1. Create closed issue folder
mkdir docs/issues/closed/20231215-feat-initial-setup

# 2. Create minimal files
cat > docs/issues/closed/20231215-feat-initial-setup/prompt.md << 'EOF'
# Original User Request

Initial project setup and structure.

## Requirements
- Project scaffolding
- Basic configuration
- Initial documentation
EOF

cat > docs/issues/closed/20231215-feat-initial-setup/analysis.md << 'EOF'
---
created: 2023-12-15
type: feat
branch: main
status: closed
---

# Issue Analysis: Initial Setup

Initial project setup completed in early development.

See v1.0 archive for detailed history.
EOF
```

**Benefits:**
- Complete historical record
- Consistent issue-based structure
- Easy to reference past work

**Not required** - v1.0 backup preserves all history.

### Training Your Team/Agents

**For AI agents:**
- Point them to PLANNING.md
- First issue: Walk through complete workflow
- Emphasize: ONE issue per session

**For human developers:**
- Share QUICKSTART.md
- Demo issue creation → closure workflow
- Share scripts (create-issue.sh, close-issue.sh)

### Setting Up Your First Issue

```bash
# Ask AI agent to create first real issue
"I'd like to add [feature]. Can you create an issue for this?"

# Agent will:
1. Create issue folder
2. Fill out prompt.md, analysis.md
3. Create implementation-plan.md
4. Start working!
```

---

## Troubleshooting

### Migration Script Fails

**Problem:** Script exits with error

**Solution:**
1. Check error message
2. Common issues:
   - Not in git repo: `git init`
   - Uncommitted changes: `git commit` or `git stash`
   - Missing templates: Re-clone planning-framework
3. Try manual migration (see above)

### Lost v1.0 Data

**Problem:** Can't find old planning files

**Solution:**
```bash
# Check backup folder
ls docs/planning/v1.0-archive-*/

# Check .v1-backup files
ls docs/planning/*.v1-backup

# Restore if needed
cp docs/planning/v1.0-archive-*/* docs/planning/
```

### PLANNING.md Conflicts

**Problem:** PLANNING.md already exists

**Solution:**
- Script creates `PLANNING.md.new`
- Review differences
- Merge manually or use new version

### Issue Folder Not Created

**Problem:** `docs/issues/open/` empty after migration

**Solution:**
- This is normal! v2.0 starts fresh
- Create first issue with agent or script
- Old work preserved in v1.0 archive

### Agent Confused by New Format

**Problem:** AI agent doesn't understand v2.0 workflow

**Solution:**
1. Point agent to PLANNING.md: "Read PLANNING.md for framework instructions"
2. Walk through one complete issue lifecycle
3. Emphasize key points:
   - Read issue files before working
   - One issue per session
   - Update session-log.md
   - Run QA before closing

### Scripts Don't Run

**Problem:** `./scripts/*.sh` permission denied

**Solution:**
```bash
chmod +x scripts/*.sh
```

**Problem:** Scripts have Windows line endings

**Solution:**
```bash
dos2unix scripts/*.sh
# Or:
sed -i 's/\r$//' scripts/*.sh
```

---

## Rolling Back (If Needed)

If migration didn't work:

```bash
# 1. Restore from backup folder
cp docs/planning/v1.0-archive-*/* docs/planning/

# 2. Restore old config
cp docs/planning/v1.0-archive-*/CLAUDE.md ./

# 3. Remove v2.0 files
rm PLANNING.md .qa-workflow.md
rm -rf docs/issues/

# 4. Commit
git add .
git commit -m "Rollback to Planning Framework v1.0"
```

---

## Getting Help

**Resources:**
- [FRAMEWORK.md](FRAMEWORK.md) - Complete v2.0 guide
- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- Migration report: `docs/planning/MIGRATION-REPORT-*.md`

**Support:**
- GitHub Issues: https://github.com/[your-org]/planning-framework/issues
- Discussions: https://github.com/[your-org]/planning-framework/discussions

---

## Migration Checklist

Use this checklist to track your migration:

### Pre-Migration
- [ ] Git repository clean (no uncommitted changes)
- [ ] Reviewed v1.0 files
- [ ] Noted important context
- [ ] (Optional) Created manual backup

### Migration
- [ ] Ran migration script OR completed manual steps
- [ ] Reviewed generated files
- [ ] Customized PLANNING.md
- [ ] Customized .qa-workflow.md
- [ ] Updated implementation-plan.md with current roadmap
- [ ] Reviewed migration report

### Post-Migration
- [ ] Committed migration
- [ ] Verified file structure
- [ ] Tested issue creation
- [ ] Created first real issue
- [ ] Walked agent through workflow
- [ ] (Optional) Converted major completed work to closed issues

### Cleanup
- [ ] Removed/archived old config files
- [ ] Updated team documentation
- [ ] Celebrated! 🎉

---

**Welcome to Planning Framework v2.0!**

You've successfully migrated. Enjoy bounded file sizes, no merge conflicts, and a streamlined workflow! 🚀

---

**Version:** 2.0.0
**Last Updated:** 2024-01-27
