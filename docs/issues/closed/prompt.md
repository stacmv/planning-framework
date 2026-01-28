# Original User Request

**Date:** 2024-01-27

---

## User Prompt

> Planning framework - this project - been installed to other project helps to continuously develop that other project with AI agent like Claude code and Gemini-cli and store data between working sessions.
> But from my experience there some flaws:
> framework files are too big and tend to became larger with time. It lead to agent to read big files and spend input/output tokens much more than needed.
> it's difficult to develop several features in different branches at the same time -- planning docs from branches may conflict with each other
>
> I think we should to:
> dramatically simplify planning framework and its templates, make it simple enough but not too simple
> take in mind and support for Claud Code Plan subagent
> take in mind and support for Gemini-cli and Qwen Code - they use own files line GEMINI.md and QWEN.md instead CLAUDE.md. May be we should use one common file.
> solve the problem with files grow with time. I'm about implementation plan, sessions log and decisions files which tend to grow and to grow.
> add some kind of local issue tracker with strictly defined workflow process how to deal with issues which may relate to new features, improving existing features or fixing bugs.

## Requirements Summary

1. **Fix file growth problem** - Implementation plan and session log grow unbounded
2. **Solve multi-branch conflicts** - Planning docs conflict across feature branches
3. **Multi-agent support** - Single config for Claude/Gemini/Qwen
4. **Simplify framework** - Simpler templates and structure
5. **Add issue tracker** - Local issue tracking with defined workflow
6. **Support Claude Code Plan subagent**

## User's Vision for Issue Tracker

- Issue subfolder structure in planning folder
- Each issue contains: prompt, analysis, definition-of-done, implementation-plan, session-log, decisions
- Issues get feature branches
- QA workflow before closing issues
- Closed issues moved to archive subfolder
- Issue naming: date-type-slug format

## Interactive Discussion Results

Through clarifying questions, we decided:
- Issue naming: `YYYYMMDD-{type}-{slug}` (e.g., 20240127-feat-add-auth)
- Branch naming: `issue/YYYYMMDD-{type}-{slug}`
- Issue types: feat/bug/improve (configurable)
- QA workflow in `.qa-workflow.md`
- Config file: `PLANNING.md` (not AI.md, not CLAUDE.md)
- Issue location: `docs/issues/open/` and `/closed/`
- One issue per session
- Auto-create issues for non-trivial work
- Metadata in YAML frontmatter of analysis.md
- Never auto-delete branches
- Track agent name in session logs

See complete design: `docs/planning/v2.0-design-analysis.md`
