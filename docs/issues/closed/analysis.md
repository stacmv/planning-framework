---
created: 2024-01-27
type: feat
branch: issue/20240127-feat-implement-v2
status: open
---

# Issue Analysis: Implement Planning Framework v2.0

## Problem Understanding

Planning Framework v1.0 has critical issues that prevent effective long-term use:

1. **File Growth** - `implementation-plan.md` and `session-log.md` grow indefinitely, consuming excessive tokens
2. **Branch Conflicts** - Feature branches have conflicting planning docs when merged
3. **Multi-Agent Complexity** - Need separate CLAUDE.md, GEMINI.md, QWEN.md files
4. **No Issue Tracking** - No structured way to track features/bugs across sessions

These problems make the framework difficult to use on real projects, especially with multiple feature branches.

## Proposed Solution

**v2.0 Architecture: Issue-Based Workflow**

Instead of tracking all work in global files, move execution details to isolated issue folders:

```
docs/issues/
├── open/                          # Active work
│   └── YYYYMMDD-type-slug/       # Each issue in its own folder
│       ├── prompt.md             # Original request
│       ├── analysis.md           # Understanding + metadata
│       ├── implementation-plan.md # Task breakdown
│       ├── session-log.md        # Progress log
│       ├── decisions.md          # (optional) Issue decisions
│       └── definition-of-done.md # (optional) Completion criteria
└── closed/                        # Completed work (archived)
```

**Global Files Stay Minimal:**
- `implementation-plan.md` - Only roadmap + active issue links
- `session-log.md` - Only one-line entries when issues close
- `decisions.md` - Only promoted architectural decisions

**Key Benefits:**
- ✅ Global files stay small (bounded by roadmap scope)
- ✅ Issues are branch-specific (no merge conflicts)
- ✅ Context isolation (agent only reads relevant issue)
- ✅ Natural archival (closed issues out of sight)

## Approach

**Phase 1: Bootstrap (DONE)**
- Created minimal v2.0 structure
- Created PLANNING.md, .qa-workflow.md
- Created this issue folder
- Following v2.0 workflow to build v2.0 (dogfooding!)

**Phase 2: Templates (Next)**
- Create all issue file templates
- Create global planning file templates
- Create PLANNING.md template (full version)
- Create .qa-workflow.md template (full version)

**Phase 3: Scripts**
- Interactive setup script (`setup-planning-v2.sh`)
- Migration script for v1.0 projects
- Helper scripts (create-issue, close-issue)

**Phase 4: Documentation**
- Complete FRAMEWORK.md guide
- MIGRATION-GUIDE.md for v1.0 users
- QUICKSTART.md for new users
- Update README.md

**Phase 5: Self-Migration**
- Migrate this project to full v2.0
- Close this issue using v2.0 workflow
- Validate entire lifecycle

**Phase 6: Testing & Release**
- Test on fresh project
- Test migration on v1.0 project
- Create v2.0.0 release
- Update package/distribution

## Dependencies

None - This is the foundational issue for v2.0

## Risks & Mitigations

**Risk:** Design might need adjustments during implementation
**Mitigation:** Dogfooding lets us refine design as we go. Document changes in decisions.md

**Risk:** Breaking changes for v1.0 users
**Mitigation:** Provide clear migration guide and scripts

**Risk:** Templates might be too opinionated
**Mitigation:** Keep templates minimal, provide customization guidance

## Success Criteria

- [ ] All templates created and documented
- [ ] Setup script works on fresh project (<5 min to setup)
- [ ] Migration script converts v1.0 project successfully
- [ ] This project fully migrated to v2.0
- [ ] This issue closed using v2.0 workflow
- [ ] Global files stay under 500 lines
- [ ] Documentation complete and clear

## Next Steps

1. Create implementation-plan.md with detailed task breakdown
2. Start Phase 2: Create templates
3. Update session-log.md after each work session
