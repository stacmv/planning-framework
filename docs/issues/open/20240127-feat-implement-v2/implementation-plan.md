# Implementation Plan: Planning Framework v2.0

**Issue:** 20240127-feat-implement-v2
**Started:** 2024-01-27
**Status:** In Progress

---

## Overview

Implement complete Planning Framework v2.0 with templates, scripts, and documentation. Use v2.0 workflow to build itself (dogfooding).

---

## Phase 1: Bootstrap ✅ COMPLETE

- [x] Create issue folder structure (docs/issues/open, closed)
- [x] Create PLANNING.md (bootstrap version)
- [x] Create .qa-workflow.md (bootstrap version)
- [x] Create minimal global planning files
- [x] Create this issue folder
- [x] Create prompt.md, analysis.md, this file

---

## Phase 2: Templates 🔄 IN PROGRESS

### 2.1 Issue Templates
- [ ] Create `docs/planning/templates/issue/` folder
- [ ] Template: `prompt.md` - Original user request format
- [ ] Template: `analysis.md` - With YAML frontmatter, analysis structure
- [ ] Template: `implementation-plan.md` - Task breakdown format
- [ ] Template: `session-log.md` - Session entry format
- [ ] Template: `decisions.md` - Issue-specific ADR format (optional)
- [ ] Template: `definition-of-done.md` - Completion criteria (optional)

### 2.2 Global Planning Templates
- [ ] Template: `implementation-plan.md` - Roadmap + issue links format
- [ ] Template: `session-log.md` - v2.0 one-line format
- [ ] Template: `decisions.md` - Global ADR format (keep v1.0, it's good)

### 2.3 Config Templates
- [ ] Template: `PLANNING.md` - Full featured version
- [ ] Template: `.qa-workflow.md` - Comprehensive QA checklist
- [ ] Template: Project-specific customization examples

---

## Phase 3: Scripts

### 3.1 Setup Script
- [ ] Create `scripts/setup-planning-v2.sh`
- [ ] Interactive prompts:
  - [ ] Project name
  - [ ] Issue types (default: feat/bug/improve)
  - [ ] QA requirements
  - [ ] Agent preference
- [ ] Create folder structure
- [ ] Generate PLANNING.md from template
- [ ] Generate .qa-workflow.md from template
- [ ] Initialize global planning files
- [ ] Success message with next steps

### 3.2 Migration Script
- [ ] Create `scripts/migrate-v1-to-v2.sh`
- [ ] Backup v1.0 files
- [ ] Parse v1.0 implementation-plan.md
- [ ] Convert completed sections to closed issues
- [ ] Extract decisions from v1.0 session-log
- [ ] Generate v2.0 global files
- [ ] Create migration report

### 3.3 Helper Scripts (Optional)
- [ ] `scripts/create-issue.sh` - Manual issue creation
- [ ] `scripts/close-issue.sh` - Issue closure automation
- [ ] Test all scripts on clean environment

---

## Phase 4: Documentation

### 4.1 Core Documentation
- [ ] `docs/planning/FRAMEWORK.md` - Complete v2.0 guide
  - [ ] Overview and philosophy
  - [ ] Getting started
  - [ ] Issue workflow
  - [ ] File structure
  - [ ] Agent guidelines
  - [ ] Best practices
  - [ ] FAQ

- [ ] `docs/planning/MIGRATION-GUIDE.md`
  - [ ] Why migrate to v2.0
  - [ ] Pre-migration checklist
  - [ ] Step-by-step migration
  - [ ] Script usage
  - [ ] Manual migration fallback
  - [ ] Troubleshooting

- [ ] `docs/planning/QUICKSTART.md`
  - [ ] 5-minute setup guide
  - [ ] First issue tutorial
  - [ ] Key concepts
  - [ ] Next steps

### 4.2 Project Documentation
- [ ] Update `README.md`
  - [ ] v2.0 highlights
  - [ ] Quick links
  - [ ] Installation
  - [ ] Examples

- [ ] Update `CLAUDE.md` → Reference to `PLANNING.md`
  - [ ] Keep for backwards compatibility
  - [ ] Point to new PLANNING.md
  - [ ] Explain v2.0

### 4.3 Examples
- [ ] Example: Fresh project setup
- [ ] Example: Issue creation to closure
- [ ] Example: Multi-agent usage
- [ ] Example: Custom issue types

---

## Phase 5: Self-Migration

### 5.1 Archive v1.0
- [ ] Create `docs/planning/v1.0-archive/` folder
- [ ] Move old v1.0 files to archive
- [ ] Update references

### 5.2 Apply Full v2.0 Templates
- [ ] Replace bootstrap PLANNING.md with full template
- [ ] Replace bootstrap .qa-workflow.md with full template
- [ ] Apply full templates to global planning files

### 5.3 Validate This Issue
- [ ] Ensure this issue follows all v2.0 standards
- [ ] Complete definition-of-done (if created)
- [ ] Run QA workflow
- [ ] Close this issue using v2.0 workflow

---

## Phase 6: Testing & Release

### 6.1 Testing
- [ ] Test setup script on fresh project
  - [ ] Clone to temp folder
  - [ ] Run setup script
  - [ ] Verify all files created correctly
  - [ ] Create test issue
  - [ ] Close test issue

- [ ] Test migration script
  - [ ] Create v1.0 test project
  - [ ] Run migration script
  - [ ] Verify conversion
  - [ ] Check for data loss

- [ ] Test with multiple agents
  - [ ] Test with Claude Code
  - [ ] Test with Gemini CLI (if available)
  - [ ] Verify agent name tracking

### 6.2 Release Preparation
- [ ] Version bump to 2.0.0
- [ ] Create CHANGELOG.md entry
- [ ] Tag git release v2.0.0
- [ ] Create GitHub release notes
- [ ] Package distribution files

### 6.3 Announcement
- [ ] Write blog post / announcement
- [ ] Update project homepage
- [ ] Notify v1.0 users
- [ ] Share on relevant communities

---

## Definition of Done

This issue is complete when:
- [ ] All templates created and documented
- [ ] Setup script runs successfully (<5 min)
- [ ] Migration script converts v1.0 projects
- [ ] All documentation written and reviewed
- [ ] This project fully migrated to v2.0
- [ ] This issue closed using v2.0 workflow
- [ ] All tests pass
- [ ] QA workflow passes
- [ ] v2.0.0 released

---

## Progress Tracking

**Phase 1:** ✅ Complete (5/5 tasks)
**Phase 2:** ⏸️ Not Started (0/11 tasks)
**Phase 3:** ⏸️ Not Started (0/8 tasks)
**Phase 4:** ⏸️ Not Started (0/10 tasks)
**Phase 5:** ⏸️ Not Started (0/6 tasks)
**Phase 6:** ⏸️ Not Started (0/9 tasks)

**Overall:** 5/49 tasks complete (10%)

---

## Next Session

**Priority:** Start Phase 2.1 - Create issue templates
**Start with:** Create templates folder and prompt.md template
