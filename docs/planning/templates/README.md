# Planning Framework v4.0 Templates

This folder is a **framework artifact**: it is mirrored into your project from the Planning
Framework repository, so anything you add or edit here is removed again on the next run. Treat it as
reference material.

---

## Template Categories

### 1. Issue Templates (`issue/`)
Templates for the files in an issue folder (`docs/issues/open/YYYYMMDD-type-slug/`). Which of them
an issue carries depends on its type and size tier — the `/pf-*` skills create them for you:

- `prompt.md` - Original user request
- `brd.md` - Business requirements (`feat`, `improve`)
- `analysis.md` - Root cause analysis (`bug`)
- `specs.md` - Technical specification (`feat`)
- `test_plan.md` - Test plan
- `implementation_plan.md` - Task breakdown with checkboxes
- `session-log.md` - Session-by-session progress
- `manual_test_checklist.md`, `qa_report.md` - Testing and QA output
- `decisions.md`, `definition-of-done.md` - Optional

A `trivial`-tier issue carries a single `notes.md` instead of the BRD/spec chain; that template
lives in the `pf-size-tiers` skill, not here.

### 2. Global Planning Templates (`global/`)
Templates for the project-wide planning files (`docs/planning/`). They are created **only if
missing** — your copies are never overwritten:

- `implementation-plan.md` - High-level roadmap with issue links
- `session-log.md` - One-line entries when issues close
- `decisions.md` - Global architectural decision records (ADRs)

### 3. Config Templates (`config/`)
Templates for the framework configuration in the repository root:

- `PLANNING.md` - Framework instructions (framework artifact: overwritten on every run)
- `CLAUDE.md` - Body of the `<!-- pf:begin -->` … `<!-- pf:end -->` section that is inserted into
  your `CLAUDE.md`, and the whole file when you do not have one yet

There is **no `.qa-workflow.md` template**: QA checks are project-specific and are generated for
your project by the `/pf-qa-setup` skill.

---

## How to Use These Templates

You normally do not use them by hand. The framework's convergence script brings any project — with
no Planning Framework, or an older one, or a partial v3/v4 — to the current v4 layout, and copies these
templates as part of it:

```bash
node scripts/pf-cli.mjs converge --agents codex --yes
```

The `[Project Name]` placeholder in `config/PLANNING.md` and `config/CLAUDE.md` is substituted with
the name of your project directory during that run.

### Manual setup

**1. Create the folder structure:**
```bash
mkdir -p docs/issues/open
mkdir -p docs/issues/closed
mkdir -p docs/planning
```

**2. Copy the config file to the repo root and fill in the placeholder:**
```bash
cp docs/planning/templates/config/PLANNING.md ./
sed -i "s/\[Project Name\]/$(basename "$PWD")/g" PLANNING.md
```

**3. Copy the global planning files:**
```bash
cp docs/planning/templates/global/implementation-plan.md docs/planning/
cp docs/planning/templates/global/session-log.md docs/planning/
cp docs/planning/templates/global/decisions.md docs/planning/
```

**4. Generate the QA workflow:**
Run `/pf-qa-setup` in Claude Code — it detects your build/lint/test commands and writes
`.qa-workflow.md` for you.

**5. Create your first issue** — run `/pf` and let the skills build the documents.

---

## Template Customization

### Issue Types
Default: `feat`, `bug`, `improve`

To add custom types, edit `PLANNING.md`:
```markdown
**Issue Types:**
- `feat` - New feature
- `bug` - Fix existing functionality
- `improve` - Enhance existing feature
- `refactor` - Code restructuring
- `docs` - Documentation only
- `test` - Testing improvements
- `chore` - Maintenance tasks
```

### QA Workflow
`.qa-workflow.md` lives in your repository root and is **yours** — the framework never overwrites
it. Run `/pf-qa-setup` to create it, then customize:
- Add project-specific checks
- Update commands for your build system
- Set coverage requirements
- Define performance budgets

### Global Planning Files
Adjust to your team's needs:
- Change milestone structure
- Add custom sections
- Modify progress tracking format

---

## Examples

### Example: Creating First Issue Manually

```bash
# 1. Create issue folder
mkdir docs/issues/open/20240127-feat-user-auth

# 2. Copy templates
cp docs/planning/templates/issue/*.md docs/issues/open/20240127-feat-user-auth/

# 3. Fill out the templates
# - prompt.md: Paste user request
# - analysis.md (bug) / brd.md (feat, improve): Analyze the problem
# - test_plan.md: Define the test cases
# - implementation_plan.md: Break down into tasks
# - session-log.md: Add first session entry

# 4. Create branch
git checkout -b issue/20240127-feat-user-auth

# 5. Start working!
```

### Example: Project-Specific Template

Extra per-issue files belong in **your** issue folders, not here: this directory is mirrored from
the framework, so a file added to it is deleted again on the next run.

```bash
# Add straight to the issue folder
docs/issues/open/20240127-feat-user-auth/security-review.md
```

Document custom files in `PLANNING.md`.

---

## Template Maintenance

Templates are maintained in the Planning Framework repository and are versioned with the framework
(v4.0, v3.1, …). Breaking changes get a major bump. To pull the current set into your project, run
the framework's convergence script (`node scripts/pf-cli.mjs converge`); to refresh the installed skills, run
`/pf-update`.

---

## Migrating an Older Project

`node scripts/pf-cli.mjs converge` is idempotent and brings a project to the v4 layout from **any** starting point — no
framework at all, v1, v2, a half-migrated tree, or an incomplete v3/v4. See
`docs/planning/MIGRATION-GUIDE-V3.md`.

---

## Help & Support

**Questions:**
- See `docs/planning/FRAMEWORK.md` for complete guide
- See `docs/planning/QUICKSTART.md` for quick start
- Open issue on GitHub: https://github.com/[your-org]/planning-framework

**Contributing:**
- Suggest template improvements via GitHub issues
- Share your customized templates
- Help improve documentation

---

**Framework Version:** 4.0
