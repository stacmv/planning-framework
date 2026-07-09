---
name: pf-brd
description: Generate a Business Requirements Document (BRD) for the active issue via guided Q&A
version: 3.0.0
---

Determine the active issue by scanning `docs/issues/open/` for [ISSUE-ID].

**Legacy-tier guard (runs first, before any other prerequisite check):** read `docs/issues/open/[ISSUE-ID]/prompt.md`'s YAML frontmatter. If it has no `size_tier` field, ask the user via `AskUserQuestion` — "How big is this task?" with the four options **trivial** / **small** / **medium** / **large** (one-line descriptions from `~/.claude/skills/pf-size-tiers/SKILL.md`'s Tiers table), recommending **medium** ("matches today's default behavior") — then write the answer into `prompt.md`'s frontmatter, next to `doc_language`, before proceeding with the rest of this skill.

Read `docs/issues/open/[ISSUE-ID]/prompt.md` to understand the project description. If `notes.md` OR `brd.md` already exists in the same folder, stop and inform the user — BRD stage is already complete.

Read `size_tier` from `prompt.md`'s frontmatter (set by the guard above if it was missing).

**Documentation language:** read the `doc_language` field from `prompt.md`'s YAML frontmatter (default: English if absent). Ask clarifying questions and write the document's prose content in that language. Keep headings and structural labels in English so downstream tooling keeps working.

## If `size_tier: trivial`

I want to build [read description from prompt.md]. Run a condensed version of the clarifying-questions loop below: same 95%-confidence bar and recommendation-with-reason pattern as the full Q&A, but shorter — fewer questions, scoped to what's needed for a one-liner or single obvious fix (what & why, acceptance criteria, the handful of files/tasks involved). Use the AskUserQuestion tool, adding your recommendation (with reason why) below the options for each question.

Once confident, write `docs/issues/open/[ISSUE-ID]/notes.md` directly using the `notes.md` template from `~/.claude/skills/pf-size-tiers/SKILL.md` (the "What & Why" / "Acceptance Criteria" / "Root Cause / Context" [bug issues only, omit for feat/improve] / "Tasks" sections, target under ~50 lines total). Write it directly — no sub-agent dispatch (this skill never dispatched one anyway). Do not create `brd.md`.

## If `size_tier` is small/medium/large

I want to build [read description from prompt.md]. I want you to help me brainstorm for the business requirement document (BRD) for this project. Focus on business logic and rules, user stories, and acceptance criteria.
IMPORTANT: DO NOT INCLUDE ANY TECHNICAL IMPLEMENTATION DETAILS.
Use the AskUserQuestion tool to ask me clarifying questions until you are 95% confident you can complete this task successfully. For each question, add your recommendation (with reason why) below the options. This would help me in making a better decision.

Save the BRD to `docs/issues/open/[ISSUE-ID]/brd.md`.

**Post-save tier reconfirmation:** after saving `brd.md`, re-read it and holistically judge whether its actual scope (user stories, acceptance criteria, business-rule complexity) matches the recorded `size_tier`.
- If your judgment disagrees with the recorded tier, ask the user via `AskUserQuestion` — recommend your own judgment, with reasoning — to confirm or override. If the tier changes, update `size_tier` in `prompt.md`.
- If your judgment agrees with the recorded tier, this is a true no-op: do not show any extra prompt or confirmation, not even a pre-filled one.

This reconfirmation step never runs for `size_tier: trivial` — there is no `brd.md` to holistically re-derive scope from in that branch.
