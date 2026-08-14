# Planning Framework v4.0 - Claude Code Integration

**⚠️ Important: This project uses Planning Framework v4.0**

Planning Framework v4.0 uses **`PLANNING.md`** for all AI agents (Claude, Gemini, Qwen).

👉 **Read `PLANNING.md` for complete framework instructions.**

---

## Quick Migration Note

**v2.0 → v4.0 Changes:**
- Skills-based workflow via `/pf` and related commands
- BRD → spec → test plan → implementation plan pipeline
- `skills/` directory with 21 Claude Code skills
- Single entry point: `make converge` (installs, migrates or tops up — from any starting state)
- See `PLANNING.md` for new workflow

**For v2.0 projects:** Run `make converge TARGET=/path/to/project`.
See **[MIGRATION-GUIDE-V3.md](docs/planning/MIGRATION-GUIDE-V3.md)**.

---

## What's New in v4.0

**Skills-Based Workflow:**
- Run `/pf` to see active issue status and next step
- BRD → spec → test plan → implementation plan pipeline for feat/improve issues
- `/pf-check` verifies consistency between pipeline documents
- Skills enforce prerequisites — each step requires the previous one

**Key Files:**
- `PLANNING.md` - Framework instructions (**READ THIS**)
- `.qa-workflow.md` - QA requirements
- `skills/` - 21 Claude Code skills (`/pf`, `/pf-help`, `/pf-brd`, `/pf-spec`, `/pf-check`, `/pf-test-plan`, `/pf-impl-plan`, `/pf-execute`, `/pf-codereview`, `/pf-test`, `/pf-manual-test`, `/pf-qa`, `/pf-qa-setup`, `/pf-close`, `/pf-autopilot`, `/pf-update`, `/pf-size-tiers`, `/pf-git`, `/pf-roles`, `/pf-user-docs`, `/pf-dev-docs`)
- `docs/planning/implementation-plan.md` - Roadmap
- `docs/planning/session-log.md` - Timeline
- `docs/planning/decisions.md` - Architectural decisions

---

## Session Start (v4.0)

**Run `/pf` to see active issue status and next step.**

The `/pf` skill reads your active issue, shows current pipeline stage, and tells you what to do next. No manual file reads needed to orient yourself.

For full framework details, see `PLANNING.md`.

---

## Issue Workflow

```
CREATE → ANALYZE → PLAN → IMPLEMENT → QA → CLOSE
```

**Agent Guidelines:**
- ✅ ONE issue per session (focused work)
- ✅ Update issue session-log.md after working
- ✅ Check off tasks in implementation-plan.md
- ✅ Run QA before closing (.qa-workflow.md)
- ✅ Get user confirmation before closing

**See `PLANNING.md` for complete workflow.**

---

## Session End (v4.0)

**If working on issue:**
- [ ] Update issue `session-log.md`
- [ ] Check off completed tasks in issue `implementation_plan.md`
- [ ] Note blockers and next priorities
- [ ] Commit changes

**If closing issue:**
- [ ] Run QA workflow (`.qa-workflow.md`)
- [ ] Merge branch to parent
- [ ] Move issue: `open/` → `closed/`
- [ ] Update global `session-log.md` (one-line entry)
- [ ] Promote significant decisions to global `decisions.md`
- [ ] Commit closure

**See `PLANNING.md` for complete closure workflow.**

---

## Documentation

- **[PLANNING.md](PLANNING.md)** - **START HERE** - Complete framework config
- **[FRAMEWORK.md](docs/planning/FRAMEWORK.md)** - Full documentation
- **[QUICKSTART.md](docs/planning/QUICKSTART.md)** - 5-minute guide
- **[MIGRATION-GUIDE-V3.md](docs/planning/MIGRATION-GUIDE-V3.md)** - upgrade any project to v4.0 with `converge`

---

## For Projects Using v2.0

This file kept for backwards compatibility. New v4.0 projects use `PLANNING.md`.

**To upgrade your v2.0 project:**
```bash
make converge TARGET=/path/to/your-project
```

`converge` is the only install/upgrade path — it handles a fresh project, v1, v2,
a half-migrated one and an incomplete v3 one alike. See
[MIGRATION-GUIDE-V3.md](docs/planning/MIGRATION-GUIDE-V3.md).

---

**Framework Version:** 4.0.0
**Last Updated:** 2026-06-24

**👉 Read `PLANNING.md` for complete instructions.**
