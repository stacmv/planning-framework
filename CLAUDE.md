# Planning Framework v2.0 - Claude Code Integration

**⚠️ Important: This project uses Planning Framework v2.0**

Planning Framework v2.0 uses **`PLANNING.md`** for all AI agents (Claude, Gemini, Qwen).

👉 **Read `PLANNING.md` for complete framework instructions.**

---

## Quick Migration Note

**v1.0 → v2.0 Changes:**
- `CLAUDE.md` → `PLANNING.md` (multi-agent support)
- Global files → Issue-based workflow
- See `PLANNING.md` for new workflow

**For v1.0 projects:** Run `./scripts/migrate-v1-to-v2.sh` to upgrade.

---

## What's New in v2.0

**Issue-Based Workflow:**
- Each task gets its own issue folder
- Complete context in: `docs/issues/open/YYYYMMDD-type-slug/`
- Global files stay small (roadmap only)

**Key Files:**
- `PLANNING.md` - Framework instructions (**READ THIS**)
- `.qa-workflow.md` - QA requirements
- `docs/planning/implementation-plan.md` - Roadmap
- `docs/planning/session-log.md` - Timeline
- `docs/planning/decisions.md` - Architectural decisions

---

## Session Start (v2.0)

**1. Read framework config:**
```bash
cat PLANNING.md
```

**2. Read global context:**
```bash
tail -20 docs/planning/session-log.md
cat docs/planning/implementation-plan.md
```

**3. If working on issue, read:**
```bash
cat docs/issues/open/[issue-id]/prompt.md
cat docs/issues/open/[issue-id]/analysis.md
cat docs/issues/open/[issue-id]/implementation-plan.md
cat docs/issues/open/[issue-id]/session-log.md
```

**4. Read project decisions:**
```bash
cat docs/planning/decisions.md
```

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

## Session End (v2.0)

**If working on issue:**
- [ ] Update issue `session-log.md`
- [ ] Check off completed tasks in issue `implementation-plan.md`
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
- **[MIGRATION-GUIDE.md](docs/planning/MIGRATION-GUIDE.md)** - v1.0 → v2.0 upgrade

---

## For Projects Using v1.0

This file kept for backwards compatibility. New v2.0 projects use `PLANNING.md`.

**To upgrade your v1.0 project:**
```bash
./scripts/migrate-v1-to-v2.sh
```

---

**Framework Version:** 2.0.0
**Last Updated:** 2024-01-27

**👉 Read `PLANNING.md` for complete instructions.**
