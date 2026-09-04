---
name: pf-brd
description: Generate a Business Requirements Document (BRD) for the active issue via guided Q&A
version: 3.0.0
---

Determine the active issue by scanning `docs/issues/open/` for [ISSUE-ID].

**Legacy-tier guard (runs first, before any other prerequisite check):** read `docs/issues/open/[ISSUE-ID]/prompt.md`'s YAML frontmatter. If it has no `size_tier` field, ask the user via `AskUserQuestion` — "How big is this task?" with the four options **trivial** / **small** / **medium** / **large** (one-line descriptions from `~/.claude/skills/pf-size-tiers/SKILL.md`'s Tiers table), recommending **medium** ("matches today's default behavior"). Front-loaded check: if `prompt.md`'s `interaction` field resolves to `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule"), apply that rule instead of asking this question interactively. Then write the answer into `prompt.md`'s frontmatter, next to `doc_language`, before proceeding with the rest of this skill.

**Reviewer-assignment guard (runs immediately after the legacy-tier guard above):** **Skip this entire guard if `prompt.md` already has a `profile:` field, or already has a `roles:` block (with or without `profile:`)** — either one means the new schema is already in play (a `profile:` resolves both write and review for every stage via `~/.claude/skills/pf-roles/SKILL.md` §4; a `roles:` block, even a partial one left by automigration, is itself the new schema), so asking this guard's old per-document reviewer question and writing a `reviewers:` block would be redundant — and would violate `~/.claude/skills/pf-roles/SKILL.md` §5's invariant that `reviewers:` is never re-added alongside `roles:`. This guard's text below remains the sole automigration path for issues that have **neither** `profile:` **nor** `roles:` at all — genuinely old issues created before this feature; issues created after this feature always get `roles:` (and, if a profile was chosen, `profile:`) from the role-assignment step in `~/.claude/skills/pf/SKILL.md`'s "Creating prompt.md", so in practice this guard only ever fires for such legacy issues.

Otherwise: read `docs/issues/open/[ISSUE-ID]/prompt.md`'s YAML frontmatter — `size_tier` is guaranteed present by this point. If it has no `reviewers` field, ask the user via `AskUserQuestion` — one question per applicable key, "Who should review `<key>`?" with the three options **claude** / **codex** / **both**. Front-loaded check: if `prompt.md`'s `interaction` field resolves to `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule"), apply that rule instead of asking this question interactively. **The recommended option is not hardcoded** — for each key, run the Recommendation procedure in `~/.claude/skills/pf-roles/SKILL.md` §10 for kind `review`, and recommend whichever of `claude`/`codex`/`both` its top-ranked `actor:tier` maps to (`both` only when §10 step 5's two-provider combo condition holds; otherwise the single top-ranked actor), with its `why`/level as the reason. When `aibudget` is unavailable, §10 step 3 applies and the recommendation falls back to `claude` ("matches today's default behavior") — this legacy guard only ever writes bare actor names (no tier), so a tiered recommendation from §10 is collapsed to its actor for the option label. Then write the answers into `prompt.md`'s frontmatter as a `reviewers:` block, next to `size_tier`, e.g.:

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

**`idea_ref` hook.** If `prompt.md`'s frontmatter carries `idea_ref: <closed-idea-id>`, additionally read `docs/issues/closed/<closed-idea-id>/idea.md`, `docs/issues/closed/<closed-idea-id>/verdict.md`, and the original intake body of `docs/issues/closed/<closed-idea-id>/prompt.md`. Every field already answered there (pain, evidence, MVP, constraints, out-of-scope, differentiation) is **not** asked again in the clarifying-questions loop below — only genuine gaps. `doc_language`/`size_tier`/`roles`/`profile`/`on_unavailable` are normally **already present** in this issue's own `prompt.md` by the time this skill reads it — `~/.claude/skills/pf-close/SKILL.md`'s Phase 4.6 derives and writes them at issue-creation time whenever the closed idea's material supports a confident derivation — so they are not asked again here either. If `size_tier` is nonetheless absent (Phase 4.6's derivation found no recognizable duration signal in the idea's "Cost (Effort)"), the ordinary Legacy-tier guard above asks as it would for any other issue with no tier — the one case where this hook still permits a question.

**Output gate — `notes.md` / `brd.md` already present (regenerate / keep / cancel).** If `notes.md` OR `brd.md` already exists in the same folder, do **not** stop outright. First judge the existing document against the shared definition of "stage complete" in `~/.claude/skills/pf-size-tiers/SKILL.md` ("Stage completion") — do not restate the criterion here. Then ask the user via `AskUserQuestion`, stating whether the document is complete or an incomplete stub, with three options:
- **regenerate** — overwrite it with a freshly generated document (recommend this when it is **not** complete: an empty file, a stub carrying the stub marker, or one left behind by a migration);
- **keep** — leave it untouched and stop, reporting that the BRD stage is already complete (recommend this when it **is** complete);
- **cancel** — stop and change nothing.

Front-loaded check: if `prompt.md`'s `interaction` field resolves to `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule"), apply that rule instead of asking this question interactively.

A stub must never lock its own owner out of the stage that produces it.

Read `size_tier` from `prompt.md`'s frontmatter (set by the guard above if it was missing).

**Documentation language:** read the `doc_language` field from `prompt.md`'s YAML frontmatter (default: English if absent). Ask clarifying questions and write the document's prose content in that language. Keep headings and structural labels in English so downstream tooling keeps working.

## If `size_tier: trivial`

I want to build [read description from prompt.md]. Run a condensed version of the clarifying-questions loop below: same 95%-confidence bar and recommendation-with-reason pattern as the full Q&A, but shorter — fewer questions, scoped to what's needed for a one-liner or single obvious fix (what & why, acceptance criteria, the handful of files/tasks involved). Use the AskUserQuestion tool, adding your recommendation (with reason why) below the options for each question. Front-loaded check: if `prompt.md`'s `interaction` field resolves to `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule"), apply that rule instead of asking this question interactively. This entire loop is skipped and `notes.md` is written from `prompt.md` alone, gaps recorded as `[assumed]`.

Once confident, **resolve role** for the `notes` key — not `brd` — per `~/.claude/skills/pf-roles/SKILL.md` (§4's fallback order). `notes.md` stands in for `brd.md`/`specs.md`/`implementation_plan.md` (and, for bug-type issues, `analysis.md`) as a single document, so it has its own independent role key in the matrix, resolved the same way as every other key, regardless of the fact that this branch lives inside `pf-brd`.

- If `write == claude` and the resolved tier is `claude`'s `default_tier` — unchanged: this session writes `docs/issues/open/[ISSUE-ID]/notes.md` directly using the `notes.md` template from `~/.claude/skills/pf-size-tiers/SKILL.md` (the "What & Why" / "Acceptance Criteria" / "Root Cause / Context" [bug issues only, omit for feat/improve] / "Tasks" sections, target under ~50 lines total). Write it directly — no sub-agent dispatch (this skill never dispatched one anyway).
- If `write == claude` with a **non-default** tier (e.g. `claude:opus`) — run the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11), then dispatch a sub-agent via the `Agent` tool with `model: <tier>` (§9) instead of writing inline, so the requested tier actually runs the write; give it the same context this session already gathered (task description, clarified answers, template/section structure) per §7's "Prompt shape for a from-scratch pipeline document", and read `notes.md` back from disk once it returns.
- If `write != claude` (in this issue, only `codex`) — run the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11), then this session still runs the clarifying-questions loop above itself (delegated actors cannot call `AskUserQuestion`), then delegates the actual write to the resolved actor's write-invocator per `~/.claude/skills/pf-roles/SKILL.md` §7, targeting `docs/issues/open/[ISSUE-ID]/notes.md` with the same template/section structure folded into the prompt built for the actor, and reads the resulting file back from disk once the call returns.

Do not create `brd.md`.

## If `size_tier` is small/medium/large

I want to build [read description from prompt.md]. I want you to help me brainstorm for the business requirement document (BRD) for this project. Focus on business logic and rules, user stories, and acceptance criteria.
IMPORTANT: DO NOT INCLUDE ANY TECHNICAL IMPLEMENTATION DETAILS.
Use the AskUserQuestion tool to ask me clarifying questions until you are 95% confident you can complete this task successfully. For each question, add your recommendation (with reason why) below the options. This would help me in making a better decision. Front-loaded check: if `prompt.md`'s `interaction` field resolves to `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule"), apply that rule instead of asking this question interactively. This entire loop is skipped and `brd.md` is written from `prompt.md` alone, gaps recorded as `[assumed]`.

Once confident, **resolve role** for the `brd` key per `~/.claude/skills/pf-roles/SKILL.md` (§4's fallback order).

- If `write == claude` and the resolved tier is `claude`'s `default_tier` — unchanged: this session saves `docs/issues/open/[ISSUE-ID]/brd.md` directly — no sub-agent dispatch (this skill never dispatched one anyway).
- If `write == claude` with a **non-default** tier (e.g. `claude:opus`) — run the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11), then dispatch a sub-agent via the `Agent` tool with `model: <tier>` (§9) instead of saving inline, built per §7's "Prompt shape for a from-scratch pipeline document" (folding in this run's clarified answers), and read `brd.md` back from disk once it returns.
- If `write != claude` (in this issue, only `codex`) — run the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11), then this session still runs the clarifying-questions loop above itself (delegated actors cannot call `AskUserQuestion`), then delegates the actual write to the resolved actor's write-invocator per `~/.claude/skills/pf-roles/SKILL.md` §7, targeting `docs/issues/open/[ISSUE-ID]/brd.md` with a single prompt built per §7's shape (the target path, `prompt.md`'s path, the requirements clarified in this run, `doc_language`, and the BRD section structure described above) — a from-scratch pipeline document, so use §7's asynchronous case — and reads the resulting `brd.md` back from disk once the call returns.

**Post-save tier reconfirmation:** after saving `brd.md`, re-read it and holistically judge whether its actual scope (user stories, acceptance criteria, business-rule complexity) matches the recorded `size_tier`.
- If your judgment disagrees with the recorded tier, ask the user via `AskUserQuestion` — recommend your own judgment, with reasoning — to confirm or override. If the tier changes, update `size_tier` in `prompt.md`. Front-loaded check: if `prompt.md`'s `interaction` field resolves to `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule"), apply that rule instead of asking this question interactively. Agree with the recorded tier without re-asking; if judgment genuinely disagrees, record `[assumed]` instead and do not change `size_tier` silently.
- If your judgment agrees with the recorded tier, this is a true no-op: do not show any extra prompt or confirmation, not even a pre-filled one.

This reconfirmation step never runs for `size_tier: trivial` — there is no `brd.md` to holistically re-derive scope from in that branch.

## Close the stage: commit & push

As the last action of this skill — after the document is saved and the tier reconfirmation is settled — run the shared commit & push procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push"). Do not restate it here: it defines what to stage (`brd.md`, or `notes.md` for the trivial tier, plus `prompt.md` if the tier changed), the commit message, the push guard, and the one-line report. A stage is not finished until its document is committed and pushed.
