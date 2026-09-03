---
name: pf-idea
description: Write the idea document (idea.md) for the active idea issue — applies the mandatory lens set for idea_tier to prompt.md's material, front-loaded (no content Q&A)
version: 3.0.0
---

Determine the active issue by scanning `docs/issues/open/` for [ISSUE-ID]. This
skill only applies to `TYPE: idea` issues (folder prefix `idea-`).

Structure mirrors `pf-brd`'s small/medium/large branch — output gate
(regenerate/keep/cancel) by the shared `~/.claude/skills/pf-size-tiers/SKILL.md`
criterion, resolve role for the `idea` key per `~/.claude/skills/pf-roles/SKILL.md`
§4, sub-agent/delegate dispatch by the same logic `pf-brd` uses for a non-default
tier — but **without** the `AskUserQuestion` content loop: all the material this
skill needs is already in `prompt.md` (front-loaded, per
`~/.claude/skills/pf-interaction/SKILL.md`). This is the key difference from
`pf-brd`.

**Prerequisite check.** `prompt.md` must exist with `idea_tier` set in its YAML
frontmatter to one of the four values `~/.claude/skills/pf-idea-lenses/SKILL.md`
§1 defines (`personal` / `infra` / `content` / `product`). If `prompt.md` is
missing, or `idea_tier` is missing or holds any other value, stop and tell the
user: "prompt.md must exist with a valid idea_tier before /pf-idea can run."

**Output gate — `idea.md` already present (regenerate / keep / cancel).** If
`idea.md` already exists, do not stop outright. Judge it against the shared
definition of "stage complete" in `~/.claude/skills/pf-size-tiers/SKILL.md`
("Stage completion"), then ask the user via `AskUserQuestion`, stating whether it
is complete or an incomplete stub:
- **regenerate** — overwrite it with a freshly generated document (recommend this
  when it is not complete: an empty file, a stub, or one left behind by a
  migration);
- **keep** — leave it untouched and stop, reporting that the IDEA stage is
  already complete (recommend this when it is complete);
- **cancel** — stop and change nothing.

A stub must never lock its own owner out of the stage that produces it.

**Documentation language:** read `doc_language` from `prompt.md`'s YAML
frontmatter (default: English if absent). Write `idea.md`'s prose in that
language. Keep the seven `##` section headings, the `###` lens-artifact
subheadings, and the "(допущение, см. `open_questions.md` #N)" marker's
structural shape exactly as specified below, regardless of `doc_language` — they
are structural labels, not translated prose.

Read `idea_tier` from `prompt.md`'s frontmatter and, from
`~/.claude/skills/pf-idea-lenses/SKILL.md` §4 ("Document budgets"), the
`idea.md` line-count budget for that tier (personal ≤150, infra ≤200, content
≤200, product ≤300).

**Resolve role** for the `idea` key per `~/.claude/skills/pf-roles/SKILL.md`
(§4's fallback order).

- If `write == claude` and the resolved tier is `claude`'s `default_tier` —
  unchanged: this session does the work and writes `idea.md` directly — no
  sub-agent dispatch (this skill never dispatched one anyway).
- If `write == claude` with a **non-default** tier (e.g. `claude:opus`) — run
  the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11), then
  dispatch a sub-agent via the `Agent` tool with `model: <tier>` (§9) instead of
  writing inline, built per §7's "Prompt shape for a from-scratch pipeline
  document" folding in the task below, and read `idea.md` (and any
  `open_questions.md` rows it appended) back from disk once it returns.
- If `write != claude` (in this issue, only `codex`) — run the Availability
  check (`~/.claude/skills/pf-roles/SKILL.md` §11). This skill has no
  `AskUserQuestion` content loop to run first (see "Never asks content
  questions" below), so proceed straight to delegating the write to the resolved
  actor's write-invocator per `~/.claude/skills/pf-roles/SKILL.md` §7, targeting
  `docs/issues/open/[ISSUE-ID]/idea.md` with a single prompt carrying the task
  below (a from-scratch pipeline document — §7's asynchronous case). Read the
  resulting file(s) back from disk once it returns.

## Task to pass to whichever actor does the work and writes the document

Read `docs/issues/open/[ISSUE-ID]/prompt.md` (its intake body, not just its
frontmatter) — the idea, evidence of pain, constraints, out of scope, and "what
would convince you: project" criterion — and `idea_tier`.

1. Read `idea_tier` from `prompt.md`'s frontmatter.
2. Read from `~/.claude/skills/pf-idea-lenses/SKILL.md` §2 ("Lens sets by
   `idea_tier`") the mandatory lens set for this `idea_tier`, and from §4
   ("Document budgets") the `idea.md` line-count budget for this `idea_tier`.
3. Compose `idea.md` following the section skeleton below, applying each
   mandatory lens to the material in `prompt.md`. Where applying a lens needs a
   fact that `prompt.md` does not contain and that cannot be derived logically
   (e.g. a market-size estimate for a `product` idea's TAM/SAM/SOM) — **never
   invent it and never ask the user**: write an `[assumed]` row to
   `docs/issues/open/[ISSUE-ID]/open_questions.md`, using the schema in
   `~/.claude/skills/pf-interaction/SKILL.md` ("`open_questions.md` row
   schema (canonical)"), with `Raised by: pf-idea` and `Status: assumed`, carrying the best
   guess and its reasoning. If the file does not exist yet, create it with
   header `# Open Questions — [ISSUE-ID]` plus the table header row (this may be
   the first stage with something to log, per
   `~/.claude/skills/pf-interaction/SKILL.md`'s "created lazily" note);
   otherwise append below the last existing row, continuing its `#` numbering.
   Use that guess in the section's prose, marked explicitly: "(допущение, см.
   `open_questions.md` #N)" (or the `doc_language` equivalent of the marker
   text — but keep the literal reference `open_questions.md #N`, since that is
   what downstream tooling and the eventual decision session look for).
4. The "Lenses Applied" section lists **exactly** the lens set that
   `~/.claude/skills/pf-idea-lenses/SKILL.md` §2 returned for this `idea_tier`
   — `idea.md` never adds to or removes from that list (AC-04c: "`idea.md` does
   not override it").
5. Once written, check the document's length mechanically (`wc -l`) against the
   budget from step 2 — the same "mechanical check" pattern as the
   `pf-execute`/`pf-check` oversized-guards (a line count, not a semantic
   judgment). If it exceeds the budget, do **not** stop the write or trim
   content — note it as a P1-like observation in this stage's own report
   ("`idea.md` exceeds the `<tier>` budget: N vs budget"), since the actual gate
   on size is the subsequent `/pf-check` (see
   `~/.claude/skills/pf-idea-lenses/SKILL.md` §5).

**Never asks content questions.** All the material this skill needs is already
in `prompt.md` (front-loaded). No `AskUserQuestion` call happens anywhere in
this task, for any actor, other than the output gate above (a different,
structural decision — whether to regenerate an existing file) — the only
interactive point this skill ever has, same as every other writing skill in
this pipeline.

Write `docs/issues/open/[ISSUE-ID]/idea.md`, exactly this skeleton — seven `##`
top-level section headings, in this fixed order (`specs.md` §6.2.1):

```markdown
# Idea: <краткое имя>

## Pain & Evidence
<боль и свидетельства из prompt.md>

## Analogs / Prior Art
<существующие аналоги/решения>

## Differentiation / USP
<чем отличается>

## MVP
<минимальный жизнеспособный вариант>

## Cost (Effort)
<оценка усилий>

## Risks
<риски>

## Lenses Applied
<ровно список линз, вернувшийся из pf-idea-lenses §2 для этого idea_tier>

### <Название линзы 1>
<артефакт линзы — например, "5 Почему">

### <Название линзы 2>
<артефакт линзы>
```

Each mandatory lens's own artifact (Lean Canvas, JTBD, SWOT, pre-mortem,
TAM/SAM/SOM, Build vs. Buy, Audience/Distribution Fit, 5 почему) is nested as a
`###` subheading **inside** "Lenses Applied" — it never becomes a new top-level
section; the seven top-level headings above are fixed and do not grow with
`idea_tier`.

Once the actor returns, relay a short summary: which lenses were applied, how
many `[assumed]` rows were added to `open_questions.md` (if any), and the
budget observation from step 5 above if the document exceeded its budget. Next
step to print: `/pf-check`.

## Close the stage: commit & push

As the last action of this skill — after `idea.md` (and any `open_questions.md`
rows) are saved — run the shared commit & push procedure in
`~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push"), with the "no
repository" guard (`specs.md` §3.1.4 / §3.1.2). Do not restate it here: it
defines what to stage (`idea.md` plus `open_questions.md` if touched), the
commit message, the no-git-repository guard, the push guard, and the one-line
report. A stage is not finished until its document is committed and pushed.
