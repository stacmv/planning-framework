# Issue: Planning Framework v3.0

**Date:** 2026-06-22
**Type:** feat
**ID:** 20260622-feat-v3-planning-framework

## Original Request

> Planning framework documentation will go off consumer project to Claude skill; feature/issue workflow will be changed to BRD -> spec -> test plan -> implementation plan flow. Prompts for each stage now drafted and stored in Obsidian vault "/home/stac/obsidian/notes/0 Inbox" (read files which names start with "Промпт").

## Clarifications Gathered

- Skill replaces PLANNING.md as the Claude-specific workflow guide
- PLANNING.md stays but becomes slim — keeps multi-agent (Gemini, Qwen) content
- Skills embedded in consumer project `.claude/skills/` (not global ~/.claude/skills/)
- Setup script installs skills automatically
- Issue folder structure kept; document set changes per issue type
- Skill commands: `/pf` (orchestrator), `/pf-brd`, `/pf-spec`, `/pf-check`, `/pf-test-plan`, `/pf-impl-plan`, `/pf-execute`
- `create-issue.sh` and `close-issue.sh` removed (rarely used)
- `update-skills.sh` added for distributing prompt updates
- Improve issues: BRD + test_plan + impl_plan (no spec)
- Bug issues: analysis + test_plan + impl_plan
- Consistency check stage between each document pair
