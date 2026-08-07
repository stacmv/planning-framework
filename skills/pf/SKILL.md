---
name: pf
description: Planning Framework orchestrator — shows active issue, completed stages, and next step
version: 3.0.0
---

You are the Planning Framework v3.0 orchestrator. When invoked as `/pf`, perform the following steps exactly.

## Step 1: Read installed version

Read the file `~/.claude/skills/pf/SKILL.md` and extract the value of the `version:` field from its YAML frontmatter. This is the installed version to display. If the file cannot be read, display "unknown".

## Step 2: Scan for open issues

**Sync with remote first.** `docs/issues/open/` is tracked in git — if another session or machine created or advanced an issue and pushed it, the local working tree can be stale, and a purely local scan would miss it or show it as less complete than it really is. Before listing:

1. Run `git remote`. If it prints nothing (no remote configured), skip straight to the listing below.
2. Run `git fetch origin`. If this fails (offline, auth), proceed with the local view as-is and note in Step 7's output: "Remote check failed — showing local view only."
3. Run `git branch --show-current` to get CURRENT-BRANCH, then `git rev-list --count HEAD..origin/CURRENT-BRANCH` (skip this and the next point if `origin/CURRENT-BRANCH` doesn't exist).
4. If the count is 0, local is already up to date. If it is greater than 0, run `git pull --ff-only` so any remote-only issue folders or document updates are brought in before scanning. If `--ff-only` fails (history has diverged), do not force anything — proceed with the local view and note in Step 7's output: "N unpulled commit(s) on origin/CURRENT-BRANCH — run `git pull` manually."

List the contents of the `docs/issues/open/` directory of the active project (relative to /pf's CWD) (if it exists). Collect all subdirectories whose names match the pattern `YYYYMMDD-TYPE-SLUG` where TYPE is one of `feat`, `improve`, or `bug` and YYYYMMDD is an 8-digit date.

**Automigration: `reviewers:` → `roles:`.** For **every** open issue folder just collected — not only whichever one the user ends up picking in Step 3 — check its `prompt.md` frontmatter: if it has a `reviewers:` block but no `roles:` block, convert it now, following the conversion rule and fallback-order algorithm defined in `~/.claude/skills/pf-roles/SKILL.md` (§5, §4) — do not restate that rule here. This covers every key actually present in that issue's `reviewers:` block (including `analysis`/`notes`, not only the five planning-doc keys), maps `both` → `[claude, codex]`, writes the resulting `roles:` block into `prompt.md`, and removes the old `reviewers:` block entirely (not left alongside). No question is asked to the user — fully deterministic. This step runs here, before Step 3's issue picker and before Step 4, specifically so it isn't limited to whichever issue is eventually selected.

This step does **not** commit anything itself — `/pf`'s own scan is read/write on `prompt.md` only, never a git operation. The `prompt.md` edit rides along with whichever `pf-*` stage runs next for that issue and writes to it, staged and committed per that stage's own procedure in `~/.claude/skills/pf-git/SKILL.md`'s Step 1 staging table.

## Step 3: Handle zero or multiple issues

**No issue folders found:**
Output:
```
Planning Framework v<VERSION>
No open issues found.

Tell me what you want to build or fix and I'll create the issue folder and prompt.md for you.
```
Stop here. When the user responds with the task description, follow "Creating prompt.md" below before writing the file.

**Multiple issue folders found:**
Output:
```
Planning Framework v<VERSION>
Multiple open issues found:
  1. <ISSUE-ID-1>
  2. <ISSUE-ID-2>
  ...

Which issue would you like to work on?
```
Stop here and wait for the user to specify.

## Step 4: Single active issue — detect type

For the single issue folder found, extract TYPE from the folder name:
- Folder starts with `YYYYMMDD-feat-` → type is **feat**
- Folder starts with `YYYYMMDD-improve-` → type is **improve**
- Folder starts with `YYYYMMDD-bug-` → type is **bug**

## Legacy-tier guard (before Step 5)

Before proceeding to Step 5, check the active issue's `prompt.md` frontmatter. If it has no `size_tier` field, ask the same tier question as in "Creating prompt.md" below (four options — trivial/small/medium/large, one-line descriptions, recommending medium by default), then write the answer back into `prompt.md`'s frontmatter before continuing. Do not re-ask once `size_tier` is already present.

## Reviewer-assignment guard (before Step 5)

**Skip this entire guard if `prompt.md` already has a `profile:` field.** A `profile:` resolves both write and review for every stage via `~/.claude/skills/pf-roles/SKILL.md` (§4), so asking this guard's question would be redundant. This guard's text below remains the sole automigration path for issues that have **neither** `profile:` nor `roles:` — genuinely old issues created before this feature. Issues created after this feature always get `profile:` from the mandatory question in "Creating prompt.md" above, so in practice this guard only ever fires for such legacy issues.

Before proceeding to Step 5, and only for a **bug**-type issue whose `size_tier` is not `trivial` (a trivial-tier bug issue never writes `analysis.md` — per the precedence rule in Step 6 it is routed to `/pf-brd` instead, which carries its own copy of this guard for that case): check the active issue's `prompt.md` frontmatter. If it has no `reviewers` field, ask the user via `AskUserQuestion` — one question per key, "Who should review `<key>`?" with the three options **claude** / **codex** / **both**, recommending **claude** for every key ("matches today's default behavior") — for the keys `analysis`, `test_plan`, `implementation_plan`, `code`. Write the answers into `prompt.md`'s frontmatter as a `reviewers:` block, next to `size_tier`, e.g.:

```yaml
reviewers:
  analysis: claude
  test_plan: claude
  implementation_plan: claude
  code: claude
```

Do not re-ask once `reviewers` is already present — check for the field's presence before asking, exactly as the guard above already does for `size_tier`.

For `feat`/`improve`-type issues, and for any `trivial`-tier issue (including bug), this guard does not fire — `~/.claude/skills/pf-brd/SKILL.md`'s own reviewer-assignment guard covers those cases instead.

## `code.review: skip` confirmation guard (before Step 5)

Before proceeding to Step 5, check the active issue's `prompt.md` frontmatter for `roles.code.review: skip` (whether it resolves there via an explicit point-specific entry or was just written by the automigration step above). This covers both the moment the user sets it at issue creation and the next `/pf` run after a hand-edit to `prompt.md`.

If `roles.code.review: skip` is present **without** an adjacent `confirmed:` marker, ask the user via `AskUserQuestion`: **"Code review is disabled for this issue — confirm?"** On a "yes" answer, write `confirmed: <today's date>` next to it in `prompt.md`'s frontmatter, in the exact form defined in `~/.claude/skills/pf-roles/SKILL.md` §1:

```yaml
code: { write: claude, review: skip, confirmed: 2026-08-07 }
```

If `confirmed:` is already present, do nothing — do not re-ask.

`/pf-codereview` asks this same question itself, and writes the same marker, if this step gets bypassed (e.g. `/pf-codereview` is invoked directly on an issue that never passed through this guard) — that duplicate safety net lives in `~/.claude/skills/pf-codereview/SKILL.md`, not restated here. This section only fixes the moment and place this fires within `/pf`.

## Step 5: Detect completed stages

Check which documents inside the issue folder at `<ISSUE-ID>/` in the `docs/issues/open/` directory of the active project (relative to /pf's CWD) are **complete**.

**A document counts only when its stage is complete** — apply the shared definition of "stage complete" in `~/.claude/skills/pf-size-tiers/SKILL.md` ("Stage completion" section): the file exists, **and** it has a real body carrying no stub marker, **and** every preceding stage of its pipeline is complete. A document that fails any conjunct is treated as **absent** here. This gate does not restate the criterion — it reads it from `~/.claude/skills/pf-size-tiers/SKILL.md`.

The criterion applies to **every row** of the table below — `notes.md`, `manual_test_checklist.md` and `qa_report.md` included — not to `test_plan.md` alone.

| Document complete (per `~/.claude/skills/pf-size-tiers/SKILL.md`) | Stage completed |
|---|---|
| `prompt.md` | CREATE |
| `brd.md` | BRD |
| `specs.md` | SPEC |
| `analysis.md` | ANALYSIS (bug type only) |
| `test_plan.md` | TEST_PLAN |
| `implementation_plan.md` | IMPL_PLAN |
| `code_review.md` | CODE_REVIEW |
| `manual_test_checklist.md` | TESTING |
| `qa_report.md` | QA |
| `notes.md` | BRD, SPEC, IMPL_PLAN (and ANALYSIS, for bug-type) — all at once |

List all completed stages in order. Note: the `notes.md` row is for the **completed-stages display line** only (this line, and Step 7's status block). Step 6's next-step decision for `size_tier: trivial` never uses this collapsed-stage view — see the precedence rule and trivial-tier routing table in Step 6.

## Step 6: Determine next step

**Precedence rule — check `size_tier` before selecting a workflow table.** Read `size_tier` from the issue's `prompt.md` frontmatter (by this point Step 5's legacy-tier guard has already ensured this field is present) *before* selecting any type-specific (feat/improve/bug) workflow table below. If `size_tier: trivial`, the trivial-tier routing table applies **exclusively**, regardless of issue type — do not consult the feat/improve/bug tables at all. In particular, for a trivial-tier bug issue, this means the bug workflow's entire "CREATE only (no analysis.md)" action (asking the user to describe the bug and writing `analysis.md`) is bypassed too, not just its reconfirmation sub-step: a trivial-tier bug issue never gets an `analysis.md`; it goes straight to `/pf-brd`, which produces `notes.md` instead (including the bug-only `## Root Cause / Context` section).

If `size_tier` is small/medium/large, use the type-specific workflow below as before.

**Routing rule — every table below keys on the FIRST INCOMPLETE stage** of the issue's pipeline, per the shared definition of "stage complete" in `~/.claude/skills/pf-size-tiers/SKILL.md` ("Stage completion"). "Current position" therefore means: the last stage that is complete *with every stage before it also complete*. A document that exists further down the pipeline never advances the position past a hole behind it — a migrated v2 issue carrying a real `implementation_plan.md` but no `test_plan.md` is routed to `/pf-test-plan`, not to `/pf-execute`.

### trivial-tier workflow (all issue types)

Applies whenever `size_tier: trivial`, superseding the feat/improve/bug tables below entirely:

```
CREATE → /pf-brd (produces notes.md) → /pf-check → /pf-test-plan → /pf-check → /pf-execute → /pf-codereview
```

This table is keyed on **which documents in the issue folder are complete**, not on "last completed stage" — Step 5's `notes.md` row collapses BRD/SPEC/IMPL_PLAN (and ANALYSIS) into the completed-stages *display* line all at once, which would incorrectly suggest routing straight to `/pf-execute` if this table were keyed the same way. Keying on the documents avoids that: `/pf-test-plan` is never skipped just because `notes.md` also stands in for the earlier stages.

"Complete" here is **not** "the file exists": it is the shared definition in `~/.claude/skills/pf-size-tiers/SKILL.md`. A stub `test_plan.md` left on disk by an old migration is **not** complete, so the middle row applies and the next step is `/pf-test-plan` — the last row cannot be reached against a stub.

| `size_tier: trivial` — documents complete (per `~/.claude/skills/pf-size-tiers/SKILL.md`) | Next step |
|---|---|
| `notes.md` is not complete | `/pf-brd` |
| `notes.md` complete, `test_plan.md` not complete | `/pf-check` (before a complete `test_plan.md` exists), then `/pf-test-plan` (once check passed, per the "Note on 'check passed'" convention below) |
| `notes.md` + `test_plan.md` both complete, `code_review.md` not complete | `/pf-check` (before executing), then `/pf-execute` (once check passed), then `/pf-codereview` (once execution done) |

`/pf-spec` and `/pf-impl-plan` must never appear as a next step when `size_tier: trivial`.

### feat workflow
```
CREATE → /pf-brd → BRD → /pf-spec → SPEC → /pf-check → (check passes) → /pf-test-plan → TEST_PLAN → /pf-check → (check passes) → /pf-impl-plan → IMPL_PLAN → /pf-check → (check passes) → /pf-execute → /pf-codereview → TESTING → /pf-qa → QA → /pf-close
```

Stages are complete per `~/.claude/skills/pf-size-tiers/SKILL.md`; the first incomplete stage governs.

| Position (first incomplete stage governs) | Next step |
|---|---|
| CREATE only | `/pf-brd` |
| BRD | `/pf-spec` |
| SPEC | `/pf-check` |
| SPEC + check passed (no blocking issues noted) | `/pf-test-plan` |
| TEST_PLAN | `/pf-check` |
| TEST_PLAN + check passed | `/pf-impl-plan` |
| IMPL_PLAN (every preceding stage complete) | `/pf-check` |
| IMPL_PLAN + check passed | `/pf-execute` |
| **`implementation_plan.md` exists, but BRD / SPEC / TEST_PLAN is not complete** (a migrated v2 issue, or a stub `test_plan.md`) | Go **back to the first incomplete stage**: `/pf-brd` if `brd.md` is not complete, else `/pf-spec` if `specs.md` is not complete, else `/pf-test-plan`. Never `/pf-execute`. |
| CODE_REVIEW (`implementation_plan.md` complete, `code_review.md` not complete) | `/pf-codereview` |
| TESTING | `/pf-qa` |
| QA | `/pf-close` |

### improve workflow
```
CREATE → /pf-brd → BRD → /pf-check → (check passes) → /pf-test-plan → TEST_PLAN → /pf-check → (check passes) → /pf-impl-plan → IMPL_PLAN → /pf-execute → /pf-codereview → TESTING → /pf-qa → QA → /pf-close
```

Stages are complete per `~/.claude/skills/pf-size-tiers/SKILL.md`; the first incomplete stage governs.

| Position (first incomplete stage governs) | Next step |
|---|---|
| CREATE only | `/pf-brd` |
| BRD | `/pf-check` |
| BRD + check passed | `/pf-test-plan` |
| TEST_PLAN | `/pf-check` |
| TEST_PLAN + check passed | `/pf-impl-plan` |
| IMPL_PLAN (every preceding stage complete) | `/pf-execute` |
| **`implementation_plan.md` exists, but BRD / TEST_PLAN is not complete** (a migrated v2 issue, or a stub `test_plan.md`) | Go **back to the first incomplete stage**: `/pf-brd` if `brd.md` is not complete, else `/pf-test-plan`. Never `/pf-execute`. |
| CODE_REVIEW (`implementation_plan.md` complete, `code_review.md` not complete) | `/pf-codereview` |
| TESTING | `/pf-qa` |
| QA | `/pf-close` |

### bug workflow
```
CREATE → ANALYSIS → /pf-check → (check passes) → /pf-test-plan → TEST_PLAN → /pf-check → (check passes) → /pf-impl-plan → IMPL_PLAN → /pf-execute → /pf-codereview → TESTING → /pf-qa → QA → /pf-close
```

Stages are complete per `~/.claude/skills/pf-size-tiers/SKILL.md`; the first incomplete stage governs.

| Position (first incomplete stage governs) | Next step |
|---|---|
| CREATE only (no complete analysis.md) | Ask the user to describe the bug. **Resolve role** for the `analysis` key per `~/.claude/skills/pf-roles/SKILL.md` (§4's fallback order) to get `write`. If `write == claude`, behavior is unchanged: this session writes `analysis.md` (root cause, reproduction steps, impact) to the issue folder directly, in the language recorded in `prompt.md`'s `doc_language` frontmatter field (default English). If `write != claude` (in this issue, only `codex`), this orchestrating session still runs the clarifying `AskUserQuestion` dialog itself — delegated actors cannot call `AskUserQuestion` — then delegates the actual file write to the resolved actor's write-invocator per `~/.claude/skills/pf-roles/SKILL.md` §7 (targeting `analysis.md` in the issue folder), and reads the resulting file back from disk once the call returns. Either way, once `analysis.md` exists on disk, re-read it and holistically judge whether its actual scope (root cause complexity, blast radius, number of affected code paths) matches the recorded `size_tier` — this reconfirmation step is unchanged. If the judgment disagrees, ask the user via `AskUserQuestion` (recommend the model's own judgment, with reasoning) to confirm or override, then update `prompt.md`'s `size_tier` if changed. (This reconfirmation step never runs when `size_tier: trivial` — per the precedence rule above, trivial-tier bug issues never reach this row at all; they are routed via the trivial-tier table to `/pf-brd`, which produces `notes.md` instead.) |
| ANALYSIS present | `/pf-check` |
| ANALYSIS + check passed | `/pf-test-plan` |
| TEST_PLAN | `/pf-check` |
| TEST_PLAN + check passed | `/pf-impl-plan` |
| IMPL_PLAN (every preceding stage complete) | `/pf-execute` |
| **`implementation_plan.md` exists, but `test_plan.md` is missing or not complete** (the migrated v2 bug issue: `analysis.md` + a renamed `implementation_plan.md`, no test plan) | `/pf-test-plan`. Never `/pf-execute` — there is no test plan to implement against. |
| **`implementation_plan.md` or `test_plan.md` exists, but `analysis.md` is not complete** | Back to the first incomplete stage — the "CREATE only" row's action (write `analysis.md`). |
| CODE_REVIEW (`implementation_plan.md` complete, `code_review.md` not complete) | `/pf-codereview` |
| TESTING | `/pf-qa` |
| QA | `/pf-close` |

**Note on "check passed":** A check counts as passed only when the document it was run against is **complete** per the shared definition in `~/.claude/skills/pf-size-tiers/SKILL.md` ("Stage completion") **and** the next document in sequence is complete as well. Mere existence of the next file is **not** enough: an empty or stub document (one that fails the shared definition) never counts as a passed check — it is treated as absent, and the next step is the skill that produces it.

## Step 7: Output

Print the status block:

```
Planning Framework v<VERSION>
Active issue: <ISSUE-ID>  (type: feat/improve/bug, tier: trivial/small/medium/large)
Completed stages: <STAGE1>, <STAGE2>, ...
Next step: /<next-command>
```

If Step 2's remote sync produced a note (fetch failed, or unpulled commits remain), append it as one extra line at the end of the block, e.g. `Note: N unpulled commit(s) on origin/CURRENT-BRANCH — run \`git pull\` manually.` Omit the line entirely when the sync was clean.

If no stages are completed yet (only the folder exists with no documents), ask the user to describe the task, then follow "Creating prompt.md" below and show:
```
Planning Framework v<VERSION>
Active issue: <ISSUE-ID>  (type: feat/improve/bug, tier: trivial/small/medium/large)
Completed stages: (none — prompt.md created)
Next step: /pf-brd
```

## Creating prompt.md

Whenever a new issue's `prompt.md` is about to be written (from either path above), first use AskUserQuestion to ask: **"What language should the planning documents for this issue be written in?"** with options English, Russian, and Other (free text). This choice only needs to be asked once per issue.

Immediately after, use AskUserQuestion to ask a second question: **"How big is this task?"** with four options, one line each (from `~/.claude/skills/pf-size-tiers/SKILL.md`'s Tiers table), recommending **medium** by default ("today's standard full pipeline — pick this if unsure"):

- **trivial** — One-liner or single obvious fix. 1 user story, ≤3 ACs.
- **small** — Single focused change, clearly bounded. 2-3 user stories.
- **medium** (recommended) — Today's framework default. 4-6 user stories.
- **large** — Multi-subsystem or 7+ user stories.

Immediately after, use AskUserQuestion to ask a third question: **"Which role profile should this issue use?"** with options listing the profile names found in `docs/planning/role-profiles.yml` (see `~/.claude/skills/pf-roles/SKILL.md` §3 for the file's schema and auto-creation rule), recommending **solo-claude** ("matches today's behavior").

Write `prompt.md` with a YAML frontmatter block recording all three answers, followed by the task description:

```
---
doc_language: English
size_tier: medium
profile: solo-claude
---

<task description as given by the user>
```

Use the exact language name the user gave (e.g. `Russian`, or whatever they typed for "Other") as the `doc_language` value. Every downstream pf-* skill that produces a document reads this field and writes its prose content in that language, defaulting to English if the field is absent — see each skill's own instructions for specifics.

Record the chosen tier (`trivial`, `small`, `medium`, or `large`) as `size_tier`, next to `doc_language`. Every downstream pf-* skill reads this field and scales document length/sections/routing accordingly — see `~/.claude/skills/pf-size-tiers/SKILL.md` for the full tables and each skill's own instructions for specifics.

Record the chosen profile name as `profile:`, next to `size_tier`. Every downstream pf-* skill that resolves a stage's write/review role reads this field as part of the fallback order — see `~/.claude/skills/pf-roles/SKILL.md` §4. Once `profile:` is set, the Reviewer-assignment guard earlier in this file no longer fires for this issue.
