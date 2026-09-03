---
name: pf-idea-research
description: Write the research document (research.md) for the active idea issue — fact-checks claims from idea.md against real sources, marking each verified/unverified, never asking the user
version: 3.0.0
---

Determine the active issue by scanning `docs/issues/open/` for [ISSUE-ID]. This
skill only applies to `TYPE: idea` issues (folder prefix `idea-`).

**Prerequisite check.** `idea.md` must exist and be **complete** per the shared
definition of "stage complete" in `~/.claude/skills/pf-size-tiers/SKILL.md`
("Stage completion") — do not restate the criterion here. Additionally, per the
idea-pipeline stage table (`~/.claude/skills/pf-idea-lenses/SKILL.md` §5),
`research.md` requires `idea.md`'s `/pf-check` gate to have actually passed:
scan `session-log.md` for `[pf-check PASSED] idea.md @ ...` / `[pf-check OPEN]
idea.md @ ...` markers and take the **last one by position in the file** (the
same "last marker wins" rule `~/.claude/skills/pf/SKILL.md` already applies for
every other stage). If `idea.md` is missing or incomplete, or the most recent
marker for it is not `PASSED` (or no marker exists at all), stop and tell the
user: "idea.md must exist and pass /pf-check before research can run. Run
/pf-idea, then /pf-check, first."

**Output gate — `research.md` already present (regenerate / keep / cancel).**
If `research.md` already exists, do not stop outright. Judge it against the
same shared definition of "stage complete", then ask the user via
`AskUserQuestion`, stating whether it is complete or an incomplete stub:
- **regenerate** — overwrite it with a freshly researched document (recommend
  this when it is not complete, or when it predates the `idea.md` it must
  research);
- **keep** — leave it untouched and stop, reporting that the RESEARCH stage is
  already complete (recommend this when it is complete);
- **cancel** — stop and change nothing.

This output gate is the **only** interactive moment in this skill — see "Never
asks content questions" below.

**Documentation language:** read `doc_language` from `prompt.md`'s YAML
frontmatter (default: English if absent). Write `research.md`'s prose (Claim
text, Methodology, Notes) in that language. Keep headings, structural labels,
and the `Status` column's two fixed values (`проверено` / `не проверено`, see
below) exactly as specified, regardless of `doc_language` — they are a closed
two-value vocabulary, not translated prose.

Read `idea_tier` from `prompt.md`'s frontmatter and, from
`~/.claude/skills/pf-idea-lenses/SKILL.md` §4 ("Document budgets"), the
`research.md` line-count budget for that tier (personal ≤80, infra ≤120,
content ≤120, product ≤200). This is a **soft** target, not a hard stop — the
Facts table's row count is driven by how many fact-checkable claims `idea.md`
actually contains, not forced to fit the budget. If the written document
exceeds it, note this as an observation in this stage's report rather than
blocking or trimming content.

**Resolve role** for the `research` key per `~/.claude/skills/pf-roles/SKILL.md`
(§4's fallback order).

- If `write == claude` and the resolved tier is `claude`'s `default_tier` —
  this session does the research and writes `research.md` directly (WebSearch/
  WebFetch are already available to this session, no separate enablement
  needed) — no sub-agent dispatch.
- If `write == claude` with a **non-default** tier (e.g. `claude:opus`) — run
  the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11), then
  dispatch a sub-agent via the `Agent` tool with `model: <tier>` (§9) instead of
  researching/writing inline, built per §7's "Prompt shape for a from-scratch
  pipeline document" folding in the task below, and read `research.md` back
  from disk once it returns.
- If `write != claude` (in this issue, only `codex`) — run the Availability
  check (`~/.claude/skills/pf-roles/SKILL.md` §11). This skill has no
  `AskUserQuestion` content loop to run first (see below), so proceed straight
  to delegating the write to the resolved actor's write-invocator per
  `~/.claude/skills/pf-roles/SKILL.md` §7, targeting
  `docs/issues/open/[ISSUE-ID]/research.md` with a single prompt carrying the
  task below (a from-scratch pipeline document — §7's asynchronous case). Read
  the resulting file(s) back from disk once it returns.

## Task to pass to whichever actor does the research and writes the document

Read `docs/issues/open/[ISSUE-ID]/prompt.md` (its intake body, not just its
frontmatter) and `idea.md`.

1. Extract every claim in `idea.md` that can be fact-checked against a real
   source — analogs (do they exist, what do they do, price/license),
   platform/API constraints, legal/licensing constraints. This list is not
   closed; the four categories above are the minimum (BRD AC-05a).
2. For each claim, try to find a source: web search, reading documentation, or
   reading a file the user named at intake.
   - **Source found →** the row's `Status` is `проверено`, `Source` carries the
     URL or file path.
   - **No source found, search results conflict, or the claim is inherently
     unverifiable** (opinion, forecast, "as a rule...") **→** the row's
     `Status` is `не проверено`. The row is **never dropped from the
     document** — an unverified fact does not become a mid-pipeline question to
     the user (US-03d); it stays visible and marked as such.
3. **Hard invariant on how this document is written (AC-05b) — not a
   convention, a fact about what this skill outputs:** a row with
   `Status: проверено` and an empty `Source` is an invalid combination. Never
   write that combination. (Comparable to how `pf-test-plan` never writes a
   `Manual` row without a `Manual reason:` prefix.)
4. For every `не проверено` row, additionally append one row (one row per
   fact, not a paraphrase) to `docs/issues/open/[ISSUE-ID]/open_questions.md`,
   using the schema in `specs.md` §6.9 (this issue's own spec — the shared
   `open_questions.md` format). If the file does not exist yet, create it with
   header `# Open Questions — [ISSUE-ID]` plus the table header row (this
   skill may be the first stage with something to log, per
   `~/.claude/skills/pf-interaction/SKILL.md`'s "created lazily" note);
   otherwise append below the last existing row, continuing its `#` numbering.
   For each such row:
   - **Raised by:** `pf-idea-research`.
   - **Question:** the claim, reformulated as a question.
   - **Assumed answer:** the literal string `(нет — не проверено, не
     допущение)` — unchanged, not translated, not paraphrased. This is
     **not** an `[assumed]` answer; it marks a genuinely unresolved fact.
   - **Why:** the reason it could not be verified.
   - **Used in:** `research.md (Facts #<N>)`, referencing that row's number in
     the Facts table.
   - **Status:** `unverified-fact` — never `assumed` (AC-03d distinguishes the
     two: an assumption is a taken answer, an unverified fact is an explicit
     unresolved one).
5. Write the "Methodology" section: what was searched, how (queries, sources
   consulted), and what was not checked and why. Not decoration — the next
   reviewer (`/pf-check`, if invoked manually against `research.md`, though the
   default stage table does not route it here) and the eventual decision
   session need to know the search's actual coverage.

**Never asks content questions.** This is the one writing skill in the idea/
spike pipeline where even an intake-style clarifying loop would be wrong: an
unverified fact does not need the user's input to become an unverified-fact
row — that determination is the whole point of this stage. No `AskUserQuestion`
call happens anywhere in this task, for any actor. The output gate above (a
different, structural decision — whether to regenerate an existing file) is
the only interactive point this skill ever has, same as every other writing
skill in this pipeline.

Write `docs/issues/open/[ISSUE-ID]/research.md`, exactly this skeleton:

```markdown
# Research: <краткое имя>

## Facts

| # | Claim | Status | Source | Notes |
|---|---|---|---|---|
| 1 | <утверждение> | проверено | <URL или путь к файлу> | |
| 2 | <утверждение> | не проверено | — | <почему не удалось проверить> |

## Methodology
<что и как искалось — запросы, источники, что не проверялось и почему>

## Open Questions Raised
<указатель на open_questions.md — не дублирует содержимое>
```

The "Open Questions Raised" section is a pointer (e.g. "See `open_questions.md`
rows N-M") — it never repeats the row content inline.

Once the actor returns, relay a short summary: how many claims were checked,
how many verified vs. not, how many rows were added to `open_questions.md`, and
the budget observation from above if the document exceeded its soft target.
Next step to print: `/pf-idea-critique`.

## Close the stage: commit & push

As the last action of this skill — after `research.md` (and any
`open_questions.md` rows) are saved — run the shared commit & push procedure in
`~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push"). Do not restate it
here: it defines what to stage (`research.md` plus `open_questions.md` if
touched), the commit message, the no-git-repository guard, the push guard, and
the one-line report. A stage is not finished until its document is committed
and pushed.
