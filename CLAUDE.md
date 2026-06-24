# Planning Framework v3.0 - Claude Code Integration

**⚠️ Important: This project uses Planning Framework v3.0**

Planning Framework v3.0 uses **`PLANNING.md`** for all AI agents (Claude, Gemini, Qwen).

👉 **Read `PLANNING.md` for complete framework instructions.**

---

## Quick Migration Note

**v2.0 → v3.0 Changes:**
- Skills-based workflow via `/pf` and related commands
- BRD → spec → test plan → implementation plan pipeline
- `skills/` directory with 7 Claude Code skills
- See `PLANNING.md` for new workflow

**For v2.0 projects:** Run `./scripts/migrate-v2-to-v3.sh` to upgrade.

---

## What's New in v3.0

**Skills-Based Workflow:**
- Run `/pf` to see active issue status and next step
- BRD → spec → test plan → implementation plan pipeline for feat/improve issues
- `/pf-check` verifies consistency between pipeline documents
- Skills enforce prerequisites — each step requires the previous one

**Key Files:**
- `PLANNING.md` - Framework instructions (**READ THIS**)
- `.qa-workflow.md` - QA requirements
- `skills/` - Claude Code skills (`/pf`, `/pf-brd`, `/pf-spec`, `/pf-check`, `/pf-test-plan`, `/pf-impl-plan`, `/pf-execute`)
- `docs/planning/implementation-plan.md` - Roadmap
- `docs/planning/session-log.md` - Timeline
- `docs/planning/decisions.md` - Architectural decisions

---

## Session Start (v3.0)

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

## Session End (v3.0)

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
- **[MIGRATION-GUIDE.md](docs/planning/MIGRATION-GUIDE.md)** - v2.0 → v3.0 upgrade

---

## For Projects Using v2.0

This file kept for backwards compatibility. New v3.0 projects use `PLANNING.md`.

**To upgrade your v2.0 project:**
```bash
./scripts/migrate-v2-to-v3.sh
```

---

**Framework Version:** 3.0.0
**Last Updated:** 2026-06-24

**👉 Read `PLANNING.md` for complete instructions.**
