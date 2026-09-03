---
name: pf-idea-critique
description: Generate the adversarial critique document (critique.md) for the active idea-type issue, dispatching one independent persona per objection angle
version: 3.0.0
---

Determine the active issue by scanning `docs/issues/open/` for an `idea`-type
[ISSUE-ID] (TYPE `idea`, per `~/.claude/skills/pf-idea-lenses/SKILL.md` §5's
stage table). Read `docs/issues/open/[ISSUE-ID]/prompt.md`'s YAML frontmatter
for `idea_tier` and `doc_language` (default English if `doc_language` is
absent).

**Predecessor check.** Both `idea.md` and `research.md` must already exist in
the issue folder. If either is missing, stop and name the missing file plus
the correct stage to run first (`/pf-idea` or `/pf-idea-research`) — do not
guess at their content.

**Interaction: this skill never calls `AskUserQuestion`.** `idea`/`spike`
issues are front-loaded unconditionally
(`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule" and "one
final human gate per issue"). Every point below where an interactive skill
would normally stop and ask — an ambiguous disposition, a persona that never
recovers, a stale `critique.md` on disk — instead takes the recommended
action automatically and records `[assumed]` in `open_questions.md`
(shape per `~/.claude/skills/pf-interaction/SKILL.md`'s "`open_questions.md`
row schema (canonical)", step 2 of the same skill's "Front-loaded rule"),
then continues without stopping.

**Idempotency.** If `critique.md` already exists, judge it against
`~/.claude/skills/pf-size-tiers/SKILL.md`'s "Stage completion" criterion. Per
the Front-loaded rule above, do not ask which action to take:
- **Complete** — treat the stage as already done; report `/pf-idea-verdict`
  as the next step and stop here, without re-running dispatch.
- **Incomplete** (empty file, a stub, a partial document left by an
  interrupted run) — regenerate by running the full procedure below, and
  record `[assumed] critique.md existed as an incomplete stub → regenerated`
  in `open_questions.md`.

## 1. Persona set for this `idea_tier`

Read `~/.claude/skills/pf-idea-lenses/SKILL.md` §3 ("Critique-persona sets by
`idea_tier`") — the single source for this table, not copied here. Take the
row of `✓` marks for this issue's `idea_tier` column, in the table's own row
order:

- **Base four — always present, every tier:** Скептик-инвестор, Целевой
  пользователь, Техлид, Безопасник (US-06a minimum — never omitted,
  regardless of tier).
- **Tier-specific extension** — whichever additional row(s) that column
  marks `✓` (e.g. `infra` adds Эксплуатация/надёжность; `content` adds
  Аудитория/дистрибуция; `product` adds Рыночный аналитик/конкурент;
  `personal` adds none). Read the extension from the table at run time —
  never hardcode a specific tier's total persona count in this skill or in
  any prompt built below, since the table in `pf-idea-lenses` is the sole
  place that count is allowed to change.

This yields an ordered persona list of 4 (personal) or 5 (infra/content/
product, per the table's current marks) entries for this run.

## 2. Resolve the actor once — not per persona

Resolve the role for the `critique` key per
`~/.claude/skills/pf-roles/SKILL.md` §4 (fallback order), reading
`docs/issues/open/[ISSUE-ID]/prompt.md`'s frontmatter. **The actor/tier
resolves exactly once for the whole document — a persona is a prompt-level
point of view, not a separate resolution point.** Every persona in the list
above is dispatched under this same resolved `(actor, tier, model)` triple
(`pf-roles` §4's "Resolution output"); only the prompt text differs between
personas ("you are the <persona>, read `idea.md`/`research.md`, formulate
objections from your point of view..."). Run the Availability check
(`~/.claude/skills/pf-roles/SKILL.md` §11) once against this resolved triple
before dispatching the first persona; if it substitutes a tier/actor
(`degrade-tier`/`switch-provider`), every persona call in this run uses the
substituted triple, and the substitution is logged once per §11 step 4.

## 3. Dispatching personas

Every persona call — whichever path below runs it — returns the same
**unified per-persona result shape**, independent of wave/actor: `{persona,
objections[], raw_text}`. Section assembly and the Summary Table (§4 below)
begin only once every persona's result (or terminal failure, §5) is in hand
— never partially, while a wave/sequence is still outstanding.

Each persona's prompt follows `pf-check`'s Claude review path pattern ("read
X, do not edit anything, return only your findings as your final message"):
give it the paths to `idea.md` and `research.md`, tell it which persona it
is playing and to formulate objections strictly from that point of view. The
persona **never writes to a file** and never edits `idea.md`/`research.md` —
it returns its list of objections; `pf-idea-critique` (this session) is the
only writer, assembling per-persona sections plus the Summary Table itself.

### If `write == claude` (post-alias, `pf-roles` §4) — bounded-concurrency waves

Personas are **not** all dispatched in one unbounded batch (P0-2 fix,
`specs.md` §9 "`Agent` tool with `model:`" row — a typical concurrent
child-slot limit of **3** applies). Batch the ordered persona list from §1
into waves of **at most 3** concurrent `Agent`-tool calls each, `⌈N/3⌉`
waves for `N` personas — 4 personas (personal) → 2 waves (3+1); 5 personas
(infra/content/product) → 2 waves (3+2). Every call within one wave is
dispatched as independent `Agent`-tool invocations in a **single message**
(each with `model: <resolved tier>` per `pf-roles` §9), exactly as specified
for a single wave. **The next wave starts only after every call in the
current wave has returned — successfully or with an error — for every
persona in it.** Do not begin assembly (§4) until every wave has returned.

### If `write != claude` (resolved actor is `codex`) — strictly sequential, no waves

When the document-level actor resolves to `codex`, personas are processed
**one at a time**, not in waves — Codex has no orchestrating primitive
equivalent to the `Agent` tool (`specs.md` §9), so wave-based concurrency is
not simulated here; a longer wall-clock time for this path is an accepted
trade-off, not a defect. Each persona is dispatched through the same
document-review form `pf-check`'s "Codex invocation chain" already defines
canonically — **not** `pf-roles` §7's write-invocator (that form is always
`--write`, with a hard stop on unavailability; a persona is a point of view,
it never writes a file):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task "<persona brief>" --json --model <resolved model>
```

`<persona brief>` is the same "read `idea.md`/`research.md`, you are the
<persona>, formulate objections, do not edit anything" prompt as the
`invoke: agent` path above. Run `pf-check`'s Codex invocation chain steps
1-4 to obtain each result; **step 5 ("Codex genuinely unavailable") applies
independently per persona, not once for the whole document** — a single
persona's Codex call failing (plugin declined, CLI not installed/not
authenticated, or `codex exec`/`task` itself errors) falls back silently to
the Claude review path for that one persona only (Agent tool, `claude`'s
`default_tier`), and does **not** block or stop the remaining personas or
the skill as a whole. Mark that persona's assembled section with the note
"(Codex unavailable — эта персона отработана Claude)" (translated per
`doc_language`) instead of the usual raw-objections list header, so the
substitution is visible in the written `critique.md`.

## 4. Partial-persona failure (P0-2 fix)

A single persona's dispatch failing (timeout, actor unavailable, malformed
response with no usable objections) does not stop the whole skill — but the
recovery rule differs by whether the persona is one of the mandatory base
four or a tier-specific optional extension:

- **Base four (Скептик-инвестор / Целевой пользователь / Техлид /
  Безопасник) — mandatory for a valid `critique.md`.** On failure, retry
  **once**, same path/actor that was used the first time. If the retry also
  fails, **stop the whole skill with an explicit error** naming the persona
  and the failure — `critique.md` is **not** written half-finished. Report
  the failure and let the user re-run `/pf-idea-critique` once the
  underlying cause (actor availability, transient error) is resolved.
- **Tier-specific optional personas (the 5th, and any further extension
  `pf-idea-lenses` §3 may later add) — best-effort.** On failure, retry
  **once**, same path/actor. If the retry also fails, do not stop: replace
  that persona's section with the single line "(персона недоступна —
  `<причина>`)" (translated per `doc_language`), and add one row to the
  Summary Table for this persona's absence with `Disposition: Риск принят`
  (default — insufficient data for any other assessment) and `Reflected in:
  open_questions.md #N`. Log the row in `open_questions.md` as an `[assumed]`
  entry, e.g. (shape per `~/.claude/skills/pf-interaction/SKILL.md`'s
  "`open_questions.md` row schema (canonical)"):

  | # | Raised by | Question | Assumed answer | Why | Used in | Status |
  |---|---|---|---|---|---|---|
  | N | pf-idea-critique | Персона «\<Persona\>» недоступна — какая диспозиция? | Риск принят | Недостаточно данных для другой оценки после повторного сбоя актора | critique.md §Summary Table (row \<#\>) | assumed |

  The skill then continues normally — the missing optional persona does not
  block the rest of assembly or the write.

## 5. Assembling `critique.md`

Once every persona in §1 has a result (success, Codex→Claude fallback, or
the documented failure text from §4), write the document following the
skeleton in `specs.md` §6.4:

```markdown
# Critique: <краткое имя>

## <Персона 1 — например, "Скептик-инвестор">
- <возражение 1>
- <возражение 2>

## <Персона 2>
...

## Summary Table

| # | Objection | From | Response | Disposition | Reflected in |
|---|---|---|---|---|---|
| 1 | <возражение> | Скептик-инвестор | <ответ> | Отвечено \| Риск принят \| Идея меняется | verdict.md §Reasoning \| open_questions.md #N |
```

- One `##` section per persona, in the same order as §1's resolved list —
  the persona's raw, unedited objections (or the "(Codex unavailable...)" /
  "(персона недоступна...)" note from §3/§4 in place of the list).
- **Summary Table** — `pf-idea-critique` (this session, not any persona)
  formulates the disposition for every objection raised across every
  persona section. `Disposition` is a **closed three-value dictionary**,
  verbatim, never a fourth value: **Отвечено** (why the objection does not
  change the idea, with reasoning), **Риск принят** (consciously left
  as-is, no change to the idea), **Идея меняется** (which section of
  `idea.md` should be corrected). `pf-idea-critique` **never edits
  `idea.md` itself** — that correction is deferred to either the user's
  decision session override (`pf-idea-verdict` mode 2) or is recorded as
  input for `verdict.md`'s reasoning.
- **Every row must carry a non-empty `Reflected in`** (AC-06c) — a
  reference into `verdict.md` (once it exists) or an `open_questions.md`
  row number. If this session cannot determine a disposition unambiguously
  for a given objection, it does not guess: it writes an `[assumed]` row to
  `open_questions.md` (same shape as §4's example row) carrying the
  recommended disposition, and points `Reflected in` at that row.
- **Budget** (`~/.claude/skills/pf-idea-lenses/SKILL.md` §4, the single
  source — not restated as an independent number here): personal ≤200,
  infra ≤250, content ≤250, product ≤300 lines. Exceeding the budget does
  not block the write — note it in this stage's report; the actual gate is
  the following `/pf-check`, same pattern as `pf-idea`'s own budget check.

## 6. Close the stage: commit & push

As the last action of this skill, run the shared commit & push procedure in
`~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push") — do not restate
it here. Stage `docs/issues/open/[ISSUE-ID]/critique.md`, plus
`open_questions.md` if this run appended to it, plus `prompt.md` if
automigration ran this same invocation (`~/.claude/skills/pf-roles/SKILL.md`
§5). The no-git-repository case is handled by that same shared procedure
(`~/.claude/skills/pf/SKILL.md` Step 0's `has_git` guard covers the earlier
CREATE stage; `pf-git`'s own guard covers every stage after it, including
this one) — this skill does not duplicate that check.

Report the outcome (personas dispatched, any base-four hard stop, any
optional-persona best-effort substitution) and print the next step:
`/pf-idea-verdict`.
