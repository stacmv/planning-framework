# CLAUDE.md Instructions

Copy this section into your project's `CLAUDE.md` file to integrate the Planning Framework.

---

## Starting a New Session

**IMPORTANT:** Before starting any work, follow these steps to restore context:

1. **Read session log** - See what was done last time and what's next:
   ```bash
   tail -50 docs/planning/session-log.md
   ```

2. **Check implementation status** - Review current phase and next task:
   ```bash
   head -40 docs/planning/implementation-plan.md
   ```

3. **Review decisions** - Refresh on architectural choices:
   ```bash
   cat docs/planning/decisions.md
   ```

4. **Start the task** - Begin with the task marked "Next Session" in implementation plan

**Planning Infrastructure Location:**
- `/docs/planning/implementation-plan.md` - Detailed task breakdown, component specs, progress tracking
- `/docs/planning/session-log.md` - Session-by-session progress and notes
- `/docs/planning/decisions.md` - Architecture Decision Records (ADR)
- `/docs/prd.md` - Product Requirements Document (what and why)

---

## Session End Ritual

Before ending a session, **ALWAYS**:

1. **Update session log** - Add entry to `docs/planning/session-log.md`:
   - Completed tasks (with checkboxes)
   - Decisions made (reference ADRs)
   - Any blockers
   - Next session priorities

2. **Update implementation plan** - In `docs/planning/implementation-plan.md`:
   - Check off completed tasks
   - Update "Quick Status" section
   - Mark next task clearly

3. **Document decisions** - Add to `docs/planning/decisions.md`:
   - Create ADR for any architectural decisions
   - Use standard ADR format

4. **Commit changes**:
   ```bash
   git add .
   git commit -m "Session YYYY-MM-DD: [Brief description]"
   ```

---

## Planning Framework Usage

This project uses a structured planning framework to maintain context across sessions.

**Key principles:**
- All progress tracked with checkboxes
- Decisions documented with rationale (ADRs)
- Next steps always clearly marked
- Context preserved for AI assistants

**For detailed framework documentation:**
- See `/docs/planning/FRAMEWORK.md` for complete guide
- See `/docs/planning/templates/` for document templates

---

## What AI Assistants Should Do

**On every session start:**
1. ✅ Read the three core planning documents (session log, implementation plan, decisions)
2. ✅ Understand current phase and next task
3. ✅ Ask clarifying questions if context is unclear
4. ✅ Follow patterns and decisions documented in decisions.md

**During session:**
1. ✅ Update progress immediately (don't batch updates)
2. ✅ Document decisions as they're made (ADR format)
3. ✅ Note any blockers in real-time
4. ✅ Commit frequently with clear messages

**Before session ends:**
1. ✅ Update all three core documents
2. ✅ Mark next task clearly
3. ✅ Ensure "Quick Status" reflects reality
4. ✅ Create git commit with session summary

**Never:**
- ❌ Skip reading planning docs at session start
- ❌ Make architectural decisions without documenting (ADR)
- ❌ Complete tasks without updating implementation plan
- ❌ End session without updating session log

---

## Customization Notes

[Add any project-specific planning instructions here]

---

**Planning Framework Version:** 1.0
**Last Updated:** YYYY-MM-DD
