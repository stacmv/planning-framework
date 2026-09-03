---
name: pf-idea-verdict
description: Write verdict.md (Mode 1) for the active idea issue, then run the end-of-pipeline decision session (Mode 2) — the single final human gate that confirms project/spike-first/defer/archive
version: 3.0.0
---

Determine the active issue by scanning `docs/issues/open/` for a folder whose
`prompt.md` has `type: idea` (folder name pattern `<date>-idea-<slug>`, per
`~/.claude/skills/pf/SKILL.md` Step 4's detection). `<slug>` throughout this
skill is that folder's own slug — the same convention `idea.md`/`research.md`/
`critique.md` already use for their own `# ...: <slug>` titles.

**Front-loaded, with exactly one exception.** `idea` issues are front-loaded
unconditionally (`~/.claude/skills/pf-interaction/SKILL.md`). Mode 1 below
never calls `AskUserQuestion` — every point that would be a content question
in an interactive stage instead follows the Front-loaded rule (take the
judged answer, log `[assumed] <question> → <answer> — <why>` to
`open_questions.md`, continue). **Mode 2 is the opposite of that pattern on
purpose:** it is the pipeline's one designated final human gate
(`~/.claude/skills/pf-interaction/SKILL.md`, "One final human gate per issue —
not two"), so it calls a real `AskUserQuestion` — the Front-loaded rule does
not suppress it, because it is not a mid-pipeline content question being
asked instead of assumed; it *is* the gate.

**Prerequisite check.** `idea.md`, `research.md`, and `critique.md` must all
exist (`open_questions.md` is optional — it may not exist yet if nothing in
the pipeline so far had anything to log). If any of the three is missing,
stop and tell the user which stage to run first, per the stage table in
`~/.claude/skills/pf-idea-lenses/SKILL.md` §5 (`research.md` missing →
`/pf-idea-research`; `critique.md` missing → `/pf-idea-critique`).

Read `prompt.md`'s frontmatter: `idea_tier`, `doc_language`, `roles`
(`verdict` key), `on_unavailable`, and the `## What Would Convince You:
Project` section of its body (the user's own criterion for a `project`
verdict, gathered at intake).

## Which mode runs

Judge `verdict.md` against the shared "Stage completion" definition in
`~/.claude/skills/pf-size-tiers/SKILL.md` — a mechanical check, not a recall
from earlier in this session. Additionally, per the stage table in
`~/.claude/skills/pf-idea-lenses/SKILL.md` §5, scan `session-log.md` for
`[pf-check PASSED] verdict.md @ ...` / `[pf-check OPEN] verdict.md @ ...`
markers and take the **last one by position in the file** (the same
"last marker wins" rule `~/.claude/skills/pf/SKILL.md` already applies for
every other stage).

- **`verdict.md` absent, or exists but not complete** → **Mode 1**.
- **`verdict.md` complete, "## Decision" present** → nothing to do. Report
  the verdict stage is already complete and confirmed; next step
  `/pf-close`. Do not touch the file.
- **`verdict.md` complete, "## Decision" absent, last check marker
  `PASSED`** → **Mode 2**.
- **`verdict.md` complete, "## Decision" absent, last check marker `OPEN` (or
  no marker at all yet)** → do **not** write and do **not** open Mode 2.
  Report status and stop: next step `/pf-check`. This single branch covers
  both the ordinary post-Mode-1 state (just written, check not run yet) and
  the post-override state (§3.5.2 below re-marked the tail `OPEN`) — in both
  cases the correct action is "wait for a fresh `PASSED`", not rewrite or
  ask again. **If reached via the post-override state**, do not stop at the
  bare `/pf-check` next step — scan `session-log.md` for every other
  `[pf-check OPEN]` marker left by the same override (`idea.md`/
  `research.md`/`critique.md`, not only `verdict.md`) and report the full
  ordered list exactly as §3.5.2 step 8 below does, each with its own
  explicit `/pf-check <file>` command (CR-003) — a bare `/pf-check` alone
  only ever re-checks `verdict.md`.

## Mode 1 — write `verdict.md`

**Resolve role** for the `verdict` key per `~/.claude/skills/pf-roles/SKILL.md`
§4's fallback order (`prompt.md`'s `roles.verdict` entry resolves it at level
1 for every idea issue created after this feature, per the §6.1 skeleton).

- `write == claude`, default tier — this session evaluates the material and
  writes `verdict.md` directly. No sub-agent dispatch.
- `write == claude`, non-default tier — run the Availability check
  (`pf-roles` §11), then dispatch a sub-agent via the `Agent` tool with
  `model: <tier>` (§9), prompt built per §7's "Prompt shape for a
  from-scratch pipeline document" (target path, `idea.md`/`research.md`/
  `critique.md`/`open_questions.md` content, the task below, `doc_language`)
  — read `verdict.md` back from disk once it returns.
- `write != claude` (`codex`) — run the Availability check (§7's
  "Availability check before writing"), then delegate the write to the
  resolved actor's write-invocator per §7 (asynchronous, from-scratch case),
  same inputs as above. Read `verdict.md` back from disk once it returns.

### Task to pass to whichever actor writes the document

Read `idea.md`, `research.md`, `critique.md`, and `open_questions.md` (if it
exists).

1. Evaluate the material against the closed verdict dictionary in
   `~/.claude/skills/pf-idea-lenses/SKILL.md` §6 — exactly `project` /
   `spike-first` / `defer` / `archive`, nothing else (no `incubate-until`, no
   fifth value). The choice is a judgment call, not a formula, but "##
   Reasoning" must explicitly check and name all five signals:
   - Is the pain confirmed? (`research.md`'s Facts table / `idea.md`'s Pain &
     Evidence.)
   - Are there critical open technical questions still unanswered, whose
     answer would be cheaper to get from a real experiment than from a full
     project? → leans `spike-first`.
   - Do `critique.md`'s Summary Table objections that are **not**
     "Отвечено" outweigh the idea's benefit **right now**? → leans `defer`
     (write free-text return conditions — **no dates**, BRD Non-Goals). Do
     they outweigh it **fundamentally**, not just for now? → leans
     `archive`.
   - Does the idea meet the user's own bar from `prompt.md`'s "## What Would
     Convince You: Project"?
2. "## Return Conditions" is written **only** when the recommended verdict is
   `defer`. Free text, no dates. Omit the section entirely for the other
   three verdicts (do not write it empty — omit the heading).
3. "## Assumptions Summary" — one line per `open_questions.md` row whose
   `Status` is `assumed` (skip `overridden`/`resolved` rows): a retelling of
   that row's Question/Assumed answer/Why, not a bare pointer — the decision
   session must be able to read this on one screen without opening
   `open_questions.md`.
4. "## Unverified Facts Summary" — the same treatment for every row whose
   `Status` is `unverified-fact`.
5. **"## Decision" is never written in this mode.** The file ends after "##
   Unverified Facts Summary" — no placeholder heading, nothing after it. Its
   physical absence is the only machine-readable signal that the verdict is
   not yet confirmed (`specs-part2.md` §6.5 of this issue, finding #13); a
   later append by Mode 2 is the only thing that ever adds it.

Write `docs/issues/open/[ISSUE-ID]/verdict.md`, exactly this skeleton (no
`## Decision` heading anywhere in it):

```markdown
# Verdict: <slug>

## Recommended Verdict
<project | spike-first | defer | archive> — <однострочное обоснование>

## Reasoning
<полное обоснование, сверенное с пятью сигналами выше>

## Return Conditions
<ТОЛЬКО для defer — свободный текст условий возврата, без дат>

## Assumptions Summary
<построчный пересказ каждой записи open_questions.md со Status=assumed>

## Unverified Facts Summary
<построчный пересказ каждой записи open_questions.md со Status=unverified-fact>
```

**Budget:** `idea_tier` `personal` ≤60, `infra`/`content`/`product` ≤100
lines (not counting a later `## Decision` block, which is added on top of
this budget) — single source `~/.claude/skills/pf-idea-lenses/SKILL.md` §4;
do not hardcode a second copy of it here beyond this one reference.

Once the actor returns, relay a short summary: recommended verdict, how many
`[assumed]`/unverified-fact rows were summarized, budget observation if
exceeded. Next step to print: `/pf-check`.

### Close Mode 1: commit & push

Run the shared procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage
commit & push") for `verdict.md`. A stage is not finished until its document
is committed and pushed.

## Mode 2 — decision session

**Never dispatched by autopilot; own defensive check (US-10b, specs-part1.md
§3.5.4).** If this skill was invoked with the argument `autopilot`
(`/pf-autopilot` passes it — same convention as
`~/.claude/skills/pf-check/SKILL.md`'s "Autopilot mode") and the mode
determined above is Mode 2, do **not** call `AskUserQuestion`. Instead stop
immediately and print the final report: the recommended verdict + its
reasoning (condensed), the full list of `[assumed]` rows, and the full list
of open/unverified-fact rows from `open_questions.md` — the detailed
autopilot-facing edit to `~/.claude/skills/pf-autopilot/SKILL.md` that
consumes this report is Task 12 of this issue's implementation plan, not
this skill's job; this skill only guarantees it never opens the real gate on
its own in that context. Leave `verdict.md` untouched (no "## Decision").

**Otherwise — this session always runs Mode 2 itself, regardless of the
resolved `verdict` write actor.** Delegated actors cannot call
`AskUserQuestion` (`~/.claude/skills/pf-roles/SKILL.md` §7), and Mode 2 is
the pipeline's designated human gate, not a delegable content-writing task —
there is no "write != claude" branch here.

When this session's own orchestrator is not Claude
(`orchestrator_provider != claude` — `~/.claude/skills/pf-interaction/SKILL.md`'s
"Codex text-REPL adapter" defines the flag; it is independent of the
resolved `verdict` write actor referenced above, consistent with "there is
no `write != claude` branch here"), replace this `AskUserQuestion` call with
that adapter — same options, same pending-state discipline.

### 1. One batch (`AskUserQuestion`, ≤4 questions — the same limit as intake)

Ask a single question: **"Вердикт по идее: `<recommended-verdict>`.
Подтверждаете?"** Its body shows, in full:
- The recommended verdict and its reasoning, condensed (full text stays in
  `verdict.md`'s "## Reasoning" for reference).
- **Полный список `[assumed]`-допущений** — every `open_questions.md` row
  with `Status: assumed`, formatted `<question> → <assumed answer> — <why>
  (#<N>)`.
- **Полный список открытых вопросов** — the full `open_questions.md` journal
  (every non-`resolved` row, `overridden` included for audit visibility),
  shown as the umbrella ledger this batch is drawn from.
- **Полный список непроверенных фактов** — every row with `Status:
  unverified-fact`, same format as the assumptions list above (these are
  shown for awareness — they carry no assumed answer, and are not
  overridable via option 3 below, only assumptions are).

Three options:
- **Подтвердить `<recommended-verdict>`** — go to "3. Confirmation" below
  with this verdict.
- **Выбрать другой вердикт** — a second `AskUserQuestion` listing the
  remaining three dictionary values (whichever three are not the
  recommendation); the value the user picks there becomes the confirmed
  verdict, go to "3. Confirmation" below with it.
- **Переопределить допущение** — go to "2. Override" below.

### 2. Override (AC-07d)

A third `AskUserQuestion` lists every `open_questions.md` row with `Status:
assumed`, one per option (single-select — multiple overrides in one pass are
not supported; the cycle below lets the user come back and override another
one afterward). The user picks one row and gives a new answer as free text.

1. Read that row's `Used in` field — the `документ §секция` pair(s) it
   lists, semicolon-separated if more than one.
2. **Canonical pipeline order is fixed:** `idea.md → research.md →
   critique.md → verdict.md` (the same order
   `~/.claude/skills/pf-idea-lenses/SKILL.md` §5's stage table encodes). Find
   the earliest document in this order among those named in `Used in`.
3. **Content regeneration — scoped to exactly what's named.** For each
   `документ §секция` pair in `Used in`, replace only the text between that
   `##`-heading and the next one in that file with a version reflecting the
   new answer — never rewrite the rest of the file, never rewrite the whole
   document. This is the one case where `pf-idea-verdict` is authorized to
   write into `idea.md`/`research.md`/`critique.md` (normally each owned by
   its own writing skill) — an explicit exception scoped to this override
   loop only.
4. **Marker invalidation — scoped wider, to the whole tail.** `Used in` is
   necessary but not sufficient: a later stage can depend on the same fact
   without literally quoting it. So, independent of which sections were
   literally rewritten in step 3, every document from the earliest one found
   in step 2 through `verdict.md` (the fixed tail of the canonical order) is
   considered invalidated, even documents `Used in` never named. For each
   such document, append to `session-log.md`:
   `[pf-check OPEN] <file> @ <UTC-ISO-8601-timestamp> — invalidated by
   override of open_questions.md #<N>` — the same marker shape
   `~/.claude/skills/pf-check/SKILL.md` already defines, written here
   directly by this skill instead of by `/pf-check` (the same mechanism
   `/pf`'s routing already reads: last marker by position wins).
5. Mark the original row `overridden` in `open_questions.md`'s `Status`
   column — do not delete it. Update its `Assumed answer` cell in place to
   keep both answers visible for audit: `~~<original answer>~~ → <new
   answer>`. This is the one field in the framework allowed to be edited
   after the fact (`~/.claude/skills/pf-interaction/SKILL.md`'s
   "`open_questions.md` row schema (canonical)", the "mixed append/edit
   mode" note).
6. **Recompute the recommended verdict from scratch**, applying Mode 1's
   task in full to the now-updated material, and update `verdict.md`'s "##
   Recommended Verdict" / "## Reasoning" / "## Return Conditions" / "##
   Assumptions Summary" / "## Unverified Facts Summary" within this same
   pass (`verdict.md` is always in the invalidated tail, so this always
   happens on override, regardless of what `Used in` named).
7. Commit & push per the shared procedure in
   `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push"), staging
   `verdict.md`, `open_questions.md`, and whichever of `idea.md`/
   `research.md`/`critique.md` step 3 actually edited.
8. **Stop here — do not loop back to "1. One batch" in this same run.**
   Report: every document marked `[pf-check OPEN]` above needs a fresh
   `PASSED` from `/pf-check` before the decision session can show again (the
   "VERDICT + check OPEN after override" row of the stage table). **List each
   invalidated document individually, in canonical pipeline order** (`idea.md
   → research.md → critique.md → verdict.md`, whichever subset step 4 marked
   this run), with its own explicit command: `/pf-check <file>`
   (`~/.claude/skills/pf-check/SKILL.md`'s explicit-TARGET argument — CR-003).
   Do **not** print a bare `/pf-check` as the next step here: with no
   argument it only ever re-picks the single most-recently-produced document
   (`verdict.md`), and `research.md`/`critique.md` sit outside the stage
   table's normal check gate entirely
   (`~/.claude/skills/pf-idea-lenses/SKILL.md` §5, "Почему `/pf-check` только
   после `idea.md` и после `verdict.md`") — so nothing would ever revisit
   their `OPEN` marker without naming them explicitly here. Once every listed
   document carries a fresh `PASSED` as its last marker, the user re-runs
   `/pf-idea-verdict`, which re-enters this "Which mode runs" logic above and
   reopens the decision session with the recomputed verdict/lists. The user
   may come back and override another `[assumed]` row in a later run of
   Mode 2, once all `OPEN` documents are `PASSED` again and the batch
   reappears.

### 3. Confirmation (specs-part1.md §3.5.3 of this issue)

Append to the end of `verdict.md`:

```markdown
## Decision

**Confirmed verdict:** <project | spike-first | defer | archive>
**Confirmed by:** <user, via this decision session>
**Date:** <YYYY-MM-DD>
**Timestamp:** <UTC ISO-8601>
```

This append-block is the **only** machine-readable signal that the verdict
is confirmed (AC-07e) — `/pf-close`'s prerequisite guard for `TYPE: idea`
checks for exactly this section's presence, nothing else.

### Close Mode 2 (confirmation branch): commit & push

Run the shared procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage
commit & push") for `verdict.md`. Next step to print: `/pf-close`.
