---
name: pf-brd
description: Generate a Business Requirements Document (BRD) for the active issue via guided Q&A
version: 3.0.0
---

Determine the active issue by scanning `docs/issues/open/` for [ISSUE-ID].

**Legacy-tier guard (runs first, before any other prerequisite check):** read `docs/issues/open/[ISSUE-ID]/prompt.md`'s YAML frontmatter. If it has no `size_tier` field, ask the user via `AskUserQuestion` — "How big is this task?" with the four options **trivial** / **small** / **medium** / **large** (one-line descriptions from `~/.claude/skills/pf-size-tiers/SKILL.md`'s Tiers table), recommending **medium** ("matches today's default behavior") — then write the answer into `prompt.md`'s frontmatter, next to `doc_language`, before proceeding with the rest of this skill.

**Reviewer-assignment guard (runs immediately after the legacy-tier guard above):** read `docs/issues/open/[ISSUE-ID]/prompt.md`'s YAML frontmatter — `size_tier` is guaranteed present by this point. If it has no `reviewers` field, ask the user via `AskUserQuestion` — one question per applicable key, "Who should review `<key>`?" with the three options **claude** / **codex** / **both**, recommending **claude** for every key ("matches today's default behavior") — then write the answers into `prompt.md`'s frontmatter as a `reviewers:` block, next to `size_tier`, e.g.:

```yaml
reviewers:
  brd: claude
  specs: claude
  test_plan: claude
  implementation_plan: claude
  code: claude
```

Do not re-ask once `reviewers` is already present — check for the field's presence before asking, exactly as the legacy-tier guard above already does for `size_tier`.

The applicable key set depends on `size_tier` and, when not `trivial`, on the issue type (feat/improve — detected from the folder name pattern, same as `~/.claude/skills/pf/SKILL.md` Step 4):
- `size_tier: trivial` (any issue type, including bug — this is the only place a trivial-tier issue's reviewers get asked, since it never reaches `/pf`'s own bug-specific guard): `notes`, `test_plan`, `code`.
- `size_tier` small/medium/large, issue type `feat`: `brd`, `specs`, `test_plan`, `implementation_plan`, `code`.
- `size_tier` small/medium/large, issue type `improve`: `brd`, `test_plan`, `implementation_plan`, `code` (no `specs`).

A non-trivial `bug` issue never reaches `pf-brd` (see `~/.claude/skills/pf/SKILL.md`'s bug workflow) — that case is handled by the equivalent guard in `~/.claude/skills/pf/SKILL.md` instead.

Read `docs/issues/open/[ISSUE-ID]/prompt.md` to understand the project description.

**Output gate — `notes.md` / `brd.md` already present (regenerate / keep / cancel).** If `notes.md` OR `brd.md` already exists in the same folder, do **not** stop outright. First judge the existing document against the shared definition of "stage complete" in `~/.claude/skills/pf-size-tiers/SKILL.md` ("Stage completion") — do not restate the criterion here. Then ask the user via `AskUserQuestion`, stating whether the document is complete or an incomplete stub, with three options:
- **regenerate** — overwrite it with a freshly generated document (recommend this when it is **not** complete: an empty file, a stub carrying the stub marker, or one left behind by a migration);
- **keep** — leave it untouched and stop, reporting that the BRD stage is already complete (recommend this when it **is** complete);
- **cancel** — stop and change nothing.

A stub must never lock its own owner out of the stage that produces it.

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

## Close the stage: commit & push

As the last action of this skill — after the document is saved and the tier reconfirmation is settled — run the shared commit & push procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push"). Do not restate it here: it defines what to stage (`brd.md`, or `notes.md` for the trivial tier, plus `prompt.md` if the tier changed), the commit message, the push guard, and the one-line report. A stage is not finished until its document is committed and pushed.
