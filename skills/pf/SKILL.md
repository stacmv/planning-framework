---
name: pf
description: Planning Framework orchestrator — shows active issue, completed stages, and next step
version: 3.0.0
---

You are the Planning Framework v3.0 orchestrator. When invoked as `/pf`, perform the following steps exactly.

## Step 0: Detect folder state

Before anything else — including Step 1 — determine whether the current working directory already carries a Planning Framework project, so the git-sync in Step 2 is never attempted against a directory that isn't even a git repository yet.

Compute two booleans, **freshly, on every single `/pf` invocation** — never cached from a previous run in this session or elsewhere:

- `has_pf` := `PLANNING.md` exists in CWD, **or** `docs/issues/` exists in CWD, **or** `.pf-version` exists in CWD (any one is enough).
- `has_git` := `git rev-parse --is-inside-work-tree` exits 0.

**Distinguish "not a repository" from "git isn't installed at all."** If `git rev-parse` fails, check *why*: a `command not found`-style failure (the shell cannot locate `git` at all) is a different condition from a normal "not a git repository" failure (exit code 128, `fatal: not a git repository…`) — the former means `has_git` cannot even be meaningfully evaluated. In that case, `/pf` has no dependency-installer of its own: stop immediately with a clear message ("`git` not found on PATH — install it, then re-run `/pf`") **only if** the branch below turns out to need `git` (the "straight to project" branch does; see there). The "An idea" branch never needs `git` at all and is unaffected by this edge case — do not stop on missing `git` before that branch has even been chosen.

| `has_pf` | `has_git` | Branch |
|---|---|---|
| true | (either) | Normal path — proceed to Step 1 exactly as today. Nothing below in this Step applies. |
| false | (either) | **NEW** — ask the folder-state question below before doing anything else. |

**The question (`AskUserQuestion`, exactly one call — this is a fork, not a content Q&A cycle, so no 95%-confidence bar applies):**

> **"What are we working on: an idea (which may or may not become a project) or a project we're starting right away?"**
> - **An idea** — work it through first: pain, alternatives, risks, verdict. May end in a project, a spike, or the archive.
> - **A project, right away** — I know what I'm building; scaffold the framework and start as usual.

`has_git` does not affect *whether* this question is asked — only what happens *after* the "project, right away" answer (git initialization is only needed there; the "idea" answer never touches git at all).

**Branch — "An idea" answer.** Creates **only** `docs/issues/open/YYYYMMDD-idea-<slug>/prompt.md`, filled in via the idea intake batch (see the "Idea branch" subsection under "Creating prompt.md" below). Nothing else is created — not `PLANNING.md`, not `docs/planning/`, not `.pf-version`, not a `git init`. `<slug>` is derived the same way as for feat/improve/bug: a short kebab-case slug from the idea's topic, decided when `prompt.md` is written. After writing, proceed straight to the "Idea branch" subsection under "Creating prompt.md" for the terminal git-status line — do not fall through to Step 1/Step 2 for this run.

**Branch — "A project, right away" answer.** Mirrors what `make converge`/`converge-to-v3.sh` already does for a fresh v3 project, but performed **from inside `/pf` itself** as an installed skill — never by invoking `converge-to-v3.sh` (that script isn't available to an end user's installed skill). The scaffold source is `~/.claude/skills/pf/templates/project/`, not `docs/planning/templates/`. Steps:

1. `git init` — only if `has_git` is false (if it's already a repository, leave it alone). If `git` itself isn't on PATH (see the distinction above), stop here with the "`git` not found on PATH" message instead of proceeding.
2. Create `docs/issues/{open,closed}/` and `docs/planning/`.
3. Write `.pf-version` with the value of the `version:` field from the installed `~/.claude/skills/pf/SKILL.md`'s YAML frontmatter (read it fresh here) — **not** `PF_VERSION` from `converge-to-v3.sh`, which an installed skill has no access to. These are two independent literals that require manual sync when either is bumped.
4. Copy `~/.claude/skills/pf/templates/project/config/PLANNING.md` → `./PLANNING.md`, substituting `[Project Name]` with the current directory's name.
5. Create/append `CLAUDE.md` with the marker block `<!-- pf:begin -->…<!-- pf:end -->`, body from `~/.claude/skills/pf/templates/project/config/CLAUDE.md`, rendered the same way. In a genuinely empty folder, `CLAUDE.md` doesn't exist yet — just create it with this block.
6. Copy `~/.claude/skills/pf/templates/project/global/*.md` → `docs/planning/*.md`, skipping any target file that already exists (in a fresh folder, none do).
7. Mirror `~/.claude/skills/pf/templates/project/` → `docs/planning/templates/`.
8. Skip the "reinstall skills/shim" steps — `/pf` is already the installed skill; there is nothing to reinstall.
9. Continue into Step 3's "no issue folders found" flow (`docs/issues/open/` was just created and is empty).

**Scaffold errors stop the run, they don't produce a half-scaffolded project.** If `~/.claude/skills/pf/templates/project/` doesn't exist (a `pf` install predating this feature), stop with: "Project scaffold not found in the installed `pf` skill (`~/.claude/skills/pf/templates/project/` doesn't exist). Update your skills: `/pf-update`." — do not silently continue into a partially-scaffolded project.

## Step 1: Read installed version

Read the file `~/.claude/skills/pf/SKILL.md` and extract the value of the `version:` field from its YAML frontmatter. This is the installed version to display. If the file cannot be read, display "unknown".

## Step 2: Scan for open issues

**Sync with remote first.** `docs/issues/open/` is tracked in git — if another session or machine created or advanced an issue and pushed it, the local working tree can be stale, and a purely local scan would miss it or show it as less complete than it really is. Before listing:

**Not-a-repo guard.** If `has_git` is false (computed in Step 0, **recomputed on this run**, never read from a cache) — skip this entire git-sync (points 1-4 below) altogether and go straight to listing `docs/issues/open/`. Without this, points 1-4 below fail with exit code 128 (`fatal: not a git repository…`) before the user has even seen the "idea or project" question, breaking the "doesn't crash" guarantee for a bare, non-git folder. This applies to **every** `/pf` run, not only the first one in a freshly-scaffolded folder — a project that has `PLANNING.md` but was never `git init`-ed (e.g. extracted from an archive) hits this guard too.

1. Run `git remote`. If it prints nothing (no remote configured), skip straight to the listing below.
2. Run `git fetch origin`. If this fails (offline, auth), proceed with the local view as-is and note in Step 7's output: "Remote check failed — showing local view only."
3. Run `git branch --show-current` to get CURRENT-BRANCH, then `git rev-list --count HEAD..origin/CURRENT-BRANCH` (skip this and the next point if `origin/CURRENT-BRANCH` doesn't exist).
4. If the count is 0, local is already up to date. If it is greater than 0, run `git pull --ff-only` so any remote-only issue folders or document updates are brought in before scanning. If `--ff-only` fails (history has diverged), do not force anything — proceed with the local view and note in Step 7's output: "N unpulled commit(s) on origin/CURRENT-BRANCH — run `git pull` manually."

List the contents of the `docs/issues/open/` directory of the active project (relative to /pf's CWD) (if it exists). Collect all subdirectories whose names match the pattern `YYYYMMDD-TYPE-SLUG` where TYPE is one of `feat`, `improve`, `bug`, `idea`, or `spike`, and YYYYMMDD is an 8-digit date.

**Automigration: `reviewers:` → `roles:` — scoped to the selected issue only.** This does **not** run across every open issue folder just collected. It runs exactly once for exactly one issue: the **selected** issue — the sole folder found, if only one exists (in which case it's the de facto selection and this runs right here, immediately, before Step 3), or otherwise the one Step 3's picker resolves once the user answers "Which issue would you like to work on?" (in which case this runs then, before Step 4, once ISSUE-ID is known). Either way, for that one issue's `prompt.md` frontmatter: if it has a `reviewers:` block but no `roles:` block, convert it now, following the conversion rule and fallback-order algorithm defined in `~/.claude/skills/pf-roles/SKILL.md` (§5, §4) — do not restate that rule here. This covers every key actually present in that issue's `reviewers:` block (including `analysis`/`notes`, not only the five planning-doc keys), maps `both` → `[claude, codex]`, writes the resulting `roles:` block into `prompt.md`, and removes the old `reviewers:` block entirely (not left alongside). No question is asked to the user — fully deterministic.

**Every other open issue is left untouched by this step.** Each one migrates on its own first `/pf`/`pf-check`/`pf-codereview` touch instead — the automigration-as-prerequisite copies those three skills already carry (`pf-check`/`pf-codereview` run this same check as their own first step; the selected-issue case above is `/pf`'s own copy) — whenever that issue is actually next worked on. Running this for every open issue in one `/pf` pass (the earlier behavior) left every non-selected issue's `prompt.md` edit unstaged and unowned: `~/.claude/skills/pf-git/SKILL.md`'s staging table only ever qualifies the automigration edit for whichever issue the *next* `pf-*` stage actually operates on, so a migrated-but-untouched issue's `prompt.md` change had no commit claiming it, and would later trip `~/.claude/skills/pf-qa/SKILL.md`'s whole-tree `git status --porcelain` check for a different issue than the one being worked on. Scoping to the selected issue only avoids that.

This step does **not** commit anything itself — `/pf`'s own scan is read/write on `prompt.md` only, never a git operation. The `prompt.md` edit rides along with whichever `pf-*` stage runs next for that issue and writes to it, staged and committed per that stage's own procedure in `~/.claude/skills/pf-git/SKILL.md`'s Step 1 staging table.

## Step 3: Handle zero or multiple issues

**No issue folders found:**
Print the header, then ask via `AskUserQuestion` (exactly one call):
```
Planning Framework v<VERSION>
No open issues found.
```
> **"What are we working on?"**
> - **Build a feature** — new functionality (`feat`)
> - **Fix a bug** — something's broken (`bug`)
> - **Describe an idea** — an idea that may or may not become a project (`idea`)
> - **Run a technical spike** — answer a technical question with an experiment (`spike`)

Free text via the built-in "Other" option remains available for anything that doesn't literally fit one of the four buttons — this is not a fifth button. It routes exactly as it does today: heuristically, including into `improve` when the text reads as an improvement rather than a new feature — unchanged. **If** the free text instead describes a technical experiment ("check this technically first", "PoC", "figure out experimentally whether…"), do not silently create a `feat`/`improve` issue under it: ask one additional confirming `AskUserQuestion` — **"This sounds like a technical spike — create a `spike` issue instead of a feature?"** (**Yes, spike** / **No, it's a feature**) — before creating the issue of whichever type the answer settles on.

**Build a feature / Fix a bug** (or free text classified as such, including `improve`) continues the **exact same, unchanged** path as today: "Creating prompt.md" below, feat/improve/bug branch — no additional fork inside that path.

**Describe an idea / Run a technical spike** (or free text confirmed as a spike) create `docs/issues/open/YYYYMMDD-idea-<slug>/` (respectively `YYYYMMDD-spike-<slug>/`) via the "Idea branch" / "Spike branch" subsections of "Creating prompt.md" below — the **existing-project** variant of those subsections (role assignment and `on_unavailable` are asked normally here; this is different from Step 0's bare-folder carve-out, which only ever produces an `idea`-type issue and skips those questions).

Stop here and wait for the answer. When the user responds, follow whichever path above the answer resolves to before writing any file.

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
- Folder starts with `YYYYMMDD-idea-` → type is **idea**
- Folder starts with `YYYYMMDD-spike-` → type is **spike**

**`type:` vs. folder name — conflict is an error.** `idea`/`spike` issues also carry a redundant `type: idea|spike` field in `prompt.md`'s frontmatter (feat/improve/bug issues carry no such field today, and this check does not apply to them). Whenever `prompt.md` has a `type:` field, compare it against the TYPE just read from the folder name. A mismatch is **not** a silent priority of one over the other — stop with a clear error: *"`prompt.md`'s `type: <X>` doesn't match the folder name (`<Y>`) — fix this by hand; which one is correct?"* Do not guess and continue.

## Legacy-tier guard (before Step 5)

**Skip this guard entirely if TYPE is `idea` or `spike`.** Those issues never carry a `size_tier` field at all — they carry `idea_tier` instead (an independent field, §5.4 of this issue's specs) — so this guard would otherwise ask a question that doesn't apply to them.

Before proceeding to Step 5, check the active issue's `prompt.md` frontmatter. If it has no `size_tier` field, ask the same tier question as in "Creating prompt.md" below (four options — trivial/small/medium/large, one-line descriptions, recommending medium by default), then write the answer back into `prompt.md`'s frontmatter before continuing. Do not re-ask once `size_tier` is already present.

## Reviewer-assignment guard (before Step 5)

**Skip this guard entirely if TYPE is `idea` or `spike`** — same reason as the Legacy-tier guard above; stated here explicitly to avoid any ambiguity, even though the guard below already only fires for `bug`-type issues and would not match `idea`/`spike` anyway.

**Skip this entire guard if `prompt.md` already has a `profile:` field, or already has a `roles:` block (with or without `profile:`)** — either one means the new schema is already in play (a `profile:` resolves both write and review for every stage via `~/.claude/skills/pf-roles/SKILL.md` §4; a `roles:` block, even a partial one left by automigration, is itself the new schema), so asking this guard's old per-document reviewer question and writing a `reviewers:` block would be redundant — and would violate `~/.claude/skills/pf-roles/SKILL.md` §5's invariant that `reviewers:` is never re-added alongside `roles:`. This guard's text below remains the sole automigration path for issues that have **neither** `profile:` **nor** `roles:` at all — genuinely old issues created before this feature. Issues created after this feature always get `roles:` (and, if a profile was chosen, `profile:`) from the role-assignment step in "Creating prompt.md" below, so in practice this guard only ever fires for such legacy issues.

Before proceeding to Step 5, and only for a **bug**-type issue whose `size_tier` is not `trivial` (a trivial-tier bug issue never writes `analysis.md` — per the precedence rule in Step 6 it is routed to `/pf-brd` instead, which carries its own copy of this guard for that case): check the active issue's `prompt.md` frontmatter. If it has no `reviewers` field, ask the user via `AskUserQuestion` — one question per key, "Who should review `<key>`?" with the three options **claude** / **codex** / **both**, for the keys `analysis`, `test_plan`, `implementation_plan`, `code`. Front-loaded check: if `prompt.md`'s `interaction` field resolves to `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule"), apply that rule instead of asking this question interactively. **The recommended option is not hardcoded** — for each key, run the Recommendation procedure in `~/.claude/skills/pf-roles/SKILL.md` §10 for kind `review`, and recommend whichever of `claude`/`codex`/`both` its top-ranked `actor:tier` maps to (`both` is recommended only when §10 step 5's two-provider combo condition holds and both actors rank near the top; otherwise recommend the single top-ranked actor), with its `why`/level as the reason. When `aibudget` is unavailable, §10 step 3 applies and the recommendation falls back to `claude` ("matches today's default behavior") — this legacy guard only ever writes bare actor names (no tier — `reviewers:` predates the `actor:tier` grammar), so a tiered recommendation from §10 is collapsed to its actor for the option label. Write the answers into `prompt.md`'s frontmatter as a `reviewers:` block, next to `size_tier`, e.g.:

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

**Skip this guard entirely if TYPE is `idea` or `spike`** — those issues have no `code` key at all, so `roles.code.review: skip` can never be present; stated here explicitly for the same reason as the two guards above.

Before proceeding to Step 5, check the active issue's `prompt.md` frontmatter for `roles.code.review: skip` (whether it resolves there via an explicit point-specific entry or was just written by the automigration step above). This covers both the moment the user sets it at issue creation and the next `/pf` run after a hand-edit to `prompt.md`.

**Scope note:** this check reads literal `prompt.md` text only — it does not run the full `~/.claude/skills/pf-roles/SKILL.md` §4 resolution chain (which could in principle resolve `review: skip` from a profile's point-specific entry, level 2, with no matching literal text in `prompt.md`). No default profile currently produces a point-specific `skip` for `code`, so this is a documented scope boundary, not a known gap.

If `roles.code.review: skip` is present **without** an adjacent `confirmed:` marker, ask the user via `AskUserQuestion`: **"Code review is disabled for this issue — confirm?"** The two answers are not equivalent — branch on the actual reply:
- **"yes"** — write `confirmed: <today's date>` next to it in `prompt.md`'s frontmatter, in the exact form defined in `~/.claude/skills/pf-roles/SKILL.md` §1:

```yaml
code: { write: claude, review: skip, confirmed: 2026-08-07 }
```

- **"no"** — do **not** write a `confirmed:` marker. `/pf` itself does not run code review (that only ever happens inside `/pf-codereview`), so there is nothing to "fall through to" here — this guard's only effect either way is what it writes to `prompt.md`. Leaving `confirmed:` unwritten means the value stays exactly as it was before this guard ran: `roles.code.review: skip`, unconfirmed. Proceed to Step 5 normally. When this issue's pipeline later reaches `/pf-codereview`, its own Phase 1.5 will see `skip` with no `confirmed:` marker and ask the same question again — and if answered "no" there too, `/pf-codereview` actually runs code review rather than skipping it (see its Phase 1.5 "no" branch in `~/.claude/skills/pf-codereview/SKILL.md`). This guard does not silently let the skip stand unconfirmed forever; it just doesn't itself perform the skip or the review — that enforcement lives entirely in `/pf-codereview`.

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
| `user_docs.md` (or `roles.user_docs` resolved to `skip` — see note below) | USER_DOCS |
| `dev_docs.md` (or `roles.dev_docs` resolved to `skip` — see note below) | DEV_DOCS |
| `qa_report.md` | QA |
| `idea.md` | IDEA |
| `research.md` | RESEARCH |
| `critique.md` | CRITIQUE |
| `verdict.md` | VERDICT (document written; **not** the same as "verdict confirmed by the human" — see the decision-session distinction in Step 6 below) |
| `hypothesis.md` | HYPOTHESIS |
| `findings.md` | FINDINGS |
| `notes.md` | BRD, SPEC, IMPL_PLAN (and ANALYSIS, for bug-type) — all at once |

**`open_questions.md` never appears in this table, in any form.** It is a side ledger that any of the six idea/spike writing skills (or `/pf` itself, during intake) may create the first time it has something to record — never created empty ahead of time — and its presence or absence never enters the completeness criterion for any stage.

List all completed stages in order. Note: the `notes.md` row is for the **completed-stages display line** only (this line, and Step 7's status block). Step 6's next-step decision for `size_tier: trivial` never uses this collapsed-stage view — see the precedence rule and trivial-tier routing table in Step 6.

**USER_DOCS/DEV_DOCS and `skip`.** Before checking `user_docs.md`/`dev_docs.md` against the shared stage-completion definition, resolve `roles.user_docs`/`roles.dev_docs` per `~/.claude/skills/pf-roles/SKILL.md` (§4's fallback order), reading the issue's `prompt.md` frontmatter. If the resolved role is `skip` — explicit, via a profile's point-specific entry, or via the tier-default fallback for `size_tier: trivial`/`small` — the corresponding stage counts as **complete for routing purposes** (Step 6) without `user_docs.md`/`dev_docs.md` ever existing on disk, and Step 6's first-incomplete-stage routing moves straight past it. It is **not**, however, listed among the plain stage names on the completed-stages display line: it is rendered separately as `skipped (roles.user_docs: skip)` (respectively `skipped (roles.dev_docs: skip)`) — see Step 7. If the role does not resolve to `skip`, USER_DOCS/DEV_DOCS follow the ordinary per-document rule above like any other stage, and appear on the display line as plain `USER_DOCS`/`DEV_DOCS` once their document is complete.

## Step 6: Determine next step

**Precedence rule — check `size_tier` before selecting a workflow table.** Read `size_tier` from the issue's `prompt.md` frontmatter (by this point Step 5's legacy-tier guard has already ensured this field is present) *before* selecting any type-specific (feat/improve/bug) workflow table below. If `size_tier: trivial`, the trivial-tier routing table applies **exclusively**, regardless of issue type — do not consult the feat/improve/bug tables at all. In particular, for a trivial-tier bug issue, this means the bug workflow's entire "CREATE only (no analysis.md)" action (asking the user to describe the bug and writing `analysis.md`) is bypassed too, not just its reconfirmation sub-step: a trivial-tier bug issue never gets an `analysis.md`; it goes straight to `/pf-brd`, which produces `notes.md` instead (including the bug-only `## Root Cause / Context` section).

If `size_tier` is small/medium/large, use the type-specific workflow below as before.

**Routing rule — every table below keys on the FIRST INCOMPLETE stage** of the issue's pipeline, per the shared definition of "stage complete" in `~/.claude/skills/pf-size-tiers/SKILL.md` ("Stage completion"). "Current position" therefore means: the last stage that is complete *with every stage before it also complete*. A document that exists further down the pipeline never advances the position past a hole behind it — a migrated v2 issue carrying a real `implementation_plan.md` but no `test_plan.md` is routed to `/pf-test-plan`, not to `/pf-execute`.

**idea/spike pipeline.** If TYPE is `idea` or `spike`, **only** the stage table from `~/.claude/skills/pf-idea-lenses/SKILL.md`'s "Stage tables" (the `idea` table, respectively the `spike` table) applies — routing follows that table's own first-incomplete-stage rule and the same `[pf-check PASSED]`/`[pf-check OPEN]` marker semantics as everywhere else in this file. It is not restated here. None of the trivial-tier/feat/improve/bug tables below apply to `idea`/`spike` issues at all. **One exception to "route on existence/marker alone"** — the only place in this entire file where routing reads a document's body rather than just its existence and its last `session-log.md` marker: distinguishing the row "VERDICT (document written, check not yet passed)" from "VERDICT + check passed, `## Decision` absent" requires actually opening `verdict.md` and checking whether it contains a `## Decision` section — the mere existence of the file and the last `[pf-check ...]` marker are not sufficient to tell these two rows apart. Implement this explicitly; do not assume the ordinary "stage complete" machinery already covers it.

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
| `notes.md` complete, `test_plan.md` not complete | `/pf-check` (before a complete `test_plan.md` exists), then `/pf-test-plan` (once the check-passed marker is recorded — see the check-passed convention near the end of this step) |
| `notes.md` + `test_plan.md` both complete, `code_review.md` not complete | `/pf-check` (before executing), then `/pf-execute` (once check passed), then `/pf-codereview` (once execution done) |

`/pf-spec` and `/pf-impl-plan` must never appear as a next step when `size_tier: trivial`.

### feat workflow
```
CREATE → /pf-brd → BRD → /pf-spec → SPEC → /pf-check → (check passes) → /pf-test-plan → TEST_PLAN → /pf-check → (check passes) → /pf-impl-plan → IMPL_PLAN → /pf-check → (check passes) → /pf-execute → /pf-codereview → TESTING → /pf-user-docs* → /pf-dev-docs* → /pf-qa → QA → /pf-close
```
(`*` — optional; may resolve to `roles.<key>: skip`, see Step 5's USER_DOCS/DEV_DOCS note.)

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
| TESTING | `/pf-user-docs` — unless `roles.user_docs` resolves to `skip` (per Step 5's note), in which case treat USER_DOCS as complete and continue down this table |
| USER_DOCS (complete or `skip`-resolved) | `/pf-dev-docs` — unless `roles.dev_docs` resolves to `skip`, in which case treat DEV_DOCS as complete and continue down this table |
| DEV_DOCS (complete or `skip`-resolved) | `/pf-qa` |
| QA | `/pf-close` |

### improve workflow
```
CREATE → /pf-brd → BRD → /pf-check → (check passes) → /pf-test-plan → TEST_PLAN → /pf-check → (check passes) → /pf-impl-plan → IMPL_PLAN → /pf-execute → /pf-codereview → TESTING → /pf-user-docs* → /pf-dev-docs* → /pf-qa → QA → /pf-close
```
(`*` — optional; may resolve to `roles.<key>: skip`, see Step 5's USER_DOCS/DEV_DOCS note.)

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
| TESTING | `/pf-user-docs` — unless `roles.user_docs` resolves to `skip` (per Step 5's note), in which case treat USER_DOCS as complete and continue down this table |
| USER_DOCS (complete or `skip`-resolved) | `/pf-dev-docs` — unless `roles.dev_docs` resolves to `skip`, in which case treat DEV_DOCS as complete and continue down this table |
| DEV_DOCS (complete or `skip`-resolved) | `/pf-qa` |
| QA | `/pf-close` |

### bug workflow
```
CREATE → ANALYSIS → /pf-check → (check passes) → /pf-test-plan → TEST_PLAN → /pf-check → (check passes) → /pf-impl-plan → IMPL_PLAN → /pf-execute → /pf-codereview → TESTING → /pf-user-docs* → /pf-dev-docs* → /pf-qa → QA → /pf-close
```
(`*` — optional; may resolve to `roles.<key>: skip`, see Step 5's USER_DOCS/DEV_DOCS note.)

Stages are complete per `~/.claude/skills/pf-size-tiers/SKILL.md`; the first incomplete stage governs.

| Position (first incomplete stage governs) | Next step |
|---|---|
| CREATE only (no complete analysis.md) | Ask the user to describe the bug. **Resolve role** for the `analysis` key per `~/.claude/skills/pf-roles/SKILL.md` (§4's fallback order) to get `write`. If `write == claude`, behavior is unchanged: this session writes `analysis.md` (root cause, reproduction steps, impact) to the issue folder directly, in the language recorded in `prompt.md`'s `doc_language` frontmatter field (default English). If `write != claude` (in this issue, only `codex`), this orchestrating session still runs the clarifying `AskUserQuestion` dialog itself — delegated actors cannot call `AskUserQuestion` — then delegates the actual file write to the resolved actor's write-invocator per `~/.claude/skills/pf-roles/SKILL.md` §7 (targeting `analysis.md` in the issue folder), and reads the resulting file back from disk once the call returns. Front-loaded check: if `prompt.md`'s `interaction` field resolves to `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule"), apply that rule instead of asking this question interactively. The clarifying dialog is skipped and `analysis.md` is written from `prompt.md` alone, gaps recorded as `[assumed]`. Either way, once `analysis.md` exists on disk, re-read it and holistically judge whether its actual scope (root cause complexity, blast radius, number of affected code paths) matches the recorded `size_tier` — this reconfirmation step is unchanged. If the judgment disagrees, ask the user via `AskUserQuestion` (recommend the model's own judgment, with reasoning) to confirm or override, then update `prompt.md`'s `size_tier` if changed — the same front-loaded hook applies to this reconfirmation question too: assume agreement with the recorded tier without re-asking, recording `[assumed]` instead if judgment genuinely disagrees, without silently changing `size_tier`. (This reconfirmation step never runs when `size_tier: trivial` — per the precedence rule above, trivial-tier bug issues never reach this row at all; they are routed via the trivial-tier table to `/pf-brd`, which produces `notes.md` instead.) |
| ANALYSIS present | `/pf-check` |
| ANALYSIS + check passed | `/pf-test-plan` |
| TEST_PLAN | `/pf-check` |
| TEST_PLAN + check passed | `/pf-impl-plan` |
| IMPL_PLAN (every preceding stage complete) | `/pf-execute` |
| **`implementation_plan.md` exists, but `test_plan.md` is missing or not complete** (the migrated v2 bug issue: `analysis.md` + a renamed `implementation_plan.md`, no test plan) | `/pf-test-plan`. Never `/pf-execute` — there is no test plan to implement against. |
| **`implementation_plan.md` or `test_plan.md` exists, but `analysis.md` is not complete** | Back to the first incomplete stage — the "CREATE only" row's action (write `analysis.md`). |
| CODE_REVIEW (`implementation_plan.md` complete, `code_review.md` not complete) | `/pf-codereview` |
| TESTING | `/pf-user-docs` — unless `roles.user_docs` resolves to `skip` (per Step 5's note), in which case treat USER_DOCS as complete and continue down this table |
| USER_DOCS (complete or `skip`-resolved) | `/pf-dev-docs` — unless `roles.dev_docs` resolves to `skip`, in which case treat DEV_DOCS as complete and continue down this table |
| DEV_DOCS (complete or `skip`-resolved) | `/pf-qa` |
| QA | `/pf-close` |

**Note on "check passed":** The source of truth for whether a check passed is the explicit marker line `/pf-check` writes when it finishes (see below), not the circular "next document is also complete" heuristic, which now applies only as a legacy fallback for issues predating this marker — and which, where it does apply, judges "complete" by the shared definition in `~/.claude/skills/pf-size-tiers/SKILL.md` ("Stage completion"), never by a criterion restated here. `/pf-check` writes exactly one of two mutually exclusive lines each time it finishes — but that exclusivity holds only **within a single run**, never across the file's history: `session-log.md` is append-only, and a document routinely gets checked, revised, and checked again, so the file can (and normally does) accumulate **several marker lines for the same `<TARGET>`**, in any combination of `PASSED`/`OPEN`, left over from earlier runs.

`[pf-check PASSED] <TARGET> @ <UTC-ISO-8601-timestamp>` — marker: `session-log.md` — check passed for `<TARGET>`, written by `/pf-check`, read by `/pf`.

`[pf-check OPEN] <TARGET> @ <UTC-ISO-8601-timestamp> — <reason>` — marker: `session-log.md` — check ran but did NOT pass for `<TARGET>` (open P0/P1 remain), written by `/pf-check`, read by `/pf` (not counted as a passed check — see `/pf`'s "Note on 'check passed'").

**Take the LAST marker line for the current `<TARGET>`, by position in the file — never "is a `PASSED` line present for `<TARGET>` anywhere".** Collect every `[pf-check PASSED] <TARGET> @ ...` and `[pf-check OPEN] <TARGET> @ ...` line matching the current TARGET (match the literal bracketed tag immediately followed by TARGET, not a bare substring search for the word `PASSED` alone) and use only the one that sits furthest down the file — the most recently appended. Every earlier marker line for that same TARGET is history, not current status, and counts for nothing, no matter which tag it carries: an earlier `PASSED` line does **not** override a later `OPEN` line for the same TARGET. This is the exact sequence a normal review-then-revise cycle produces — check passes at 10:00 and appends `PASSED`, the document is then revised, check runs again at 11:00 and is skipped with an open P0, appending `OPEN` below the earlier `PASSED` — and the later `OPEN` line is what governs.

If the last marker for TARGET is the `OPEN` line, the check does **not** count as passed, no matter how recently it ran or whether a `PASSED` line for TARGET exists earlier in the file: do not advance to the next pipeline stage as if it had — treat TARGET exactly as if its check had not run yet, so the workflow table's row for TARGET alone (without "+ check passed") governs, and the next step comes back around to `/pf-check`. If the last marker for TARGET is the `PASSED` line, the check counts as passed for that document — no further condition needed. If neither line is present at all for TARGET (an issue whose `session-log.md` predates this convention, or a check that genuinely has not run yet), fall back to the legacy definition: the document is **complete** per the shared definition in `~/.claude/skills/pf-size-tiers/SKILL.md` ("Stage completion") **and** the next document in sequence is complete as well. Mere existence of the next file is **not** enough under this fallback: an empty or stub document (one that fails the shared definition) never counts as a passed check — it is treated as absent, and the next step is the skill that produces it.

## Step 7: Output

Print the status block:

```
Planning Framework v<VERSION>
Active issue: <ISSUE-ID>  (type: feat/improve/bug, tier: trivial/small/medium/large)
Completed stages: <STAGE1>, <STAGE2>, ...
Next step: /<next-command>
Roles for next stage: write=<actor:tier>, review=<actor:tier[, actor:tier]> (mode: parallel|sequential)
```

**`idea`/`spike` values in the header line.** The status block's form does not change for `idea`/`spike` issues — same layout, same fields. `type` is `idea`/`spike` and `tier` shows the issue's `idea_tier` value (`personal`/`infra`/`content`/`product`) instead of `size_tier` — these issues carry no `size_tier` field at all (§5.4 of this issue's specs).

**`verdict.md` awaiting the decision session.** When the idea pipeline's position is "VERDICT + check passed, `## Decision` absent" (per the idea/spike routing paragraph in Step 6), `Next step` does **not** print the plain command `/pf-idea-verdict` — it prints exactly **`/pf-idea-verdict (decision session)`**, so the user doesn't mistake this step for ordinary document (re)generation.

**"Roles for next stage" line.** Map `Next step`'s command back to its role key (e.g. `/pf-spec` → `specs`, `/pf-execute` → `code` — the same TARGET-to-key mapping `~/.claude/skills/pf-check/SKILL.md`'s "Reviewer selection" table uses, or, for `/pf-execute`, the `code`/`tests` split `~/.claude/skills/pf-execute/SKILL.md` Phase 2 resolves per task) and resolve it per `~/.claude/skills/pf-roles/SKILL.md` §4, tier filled in per §4's "Resolution output". Render `write` and each `review.by` entry as `actor:tier` (always with the tier shown explicitly, even when it is just the actor's `default_tier` — e.g. `claude:sonnet`, not bare `claude`), and the review `mode`. Omit this line entirely when `Next step` is not a role-resolvable stage (`/pf-check`, `/pf-qa`, `/pf-close`, or the zero-stages "just created" block below). This is a display-only read — it does not run the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11); that runs only at actual dispatch time, inside the stage skill itself.

**USER_DOCS/DEV_DOCS on the Completed stages line.** If `roles.user_docs`/`roles.dev_docs` resolved to `skip` (per Step 5's note), that stage is included on the Completed stages line using the literal pattern `skipped (roles.user_docs: skip)` (respectively `skipped (roles.dev_docs: skip)`) — not the plain stage name `USER_DOCS`/`DEV_DOCS`, and never as `Next step`. If the stage's document is genuinely complete instead, it appears as the plain stage name `USER_DOCS`/`DEV_DOCS` like any other completed stage. If the stage is neither complete nor `skip`-resolved, it is omitted from the line entirely, same as any other incomplete stage. Example: `Completed stages: CREATE, BRD, SPEC, TEST_PLAN, IMPL_PLAN, CODE_REVIEW, TESTING, skipped (roles.user_docs: skip), skipped (roles.dev_docs: skip)`.

If Step 2's remote sync produced a note (fetch failed, or unpulled commits remain), append it as one extra line at the end of the block, e.g. `Note: N unpulled commit(s) on origin/CURRENT-BRANCH — run \`git pull\` manually.` Omit the line entirely when the sync was clean.

If no stages are completed yet (only the folder exists with no documents), ask the user to describe the task, then follow "Creating prompt.md" below and show:
```
Planning Framework v<VERSION>
Active issue: <ISSUE-ID>  (type: feat/improve/bug, tier: trivial/small/medium/large)
Completed stages: (none — prompt.md created)
Next step: /pf-brd
```

## Creating prompt.md

**This section, as written below, is the `feat`/`improve`/`bug` path — unchanged.** It applies whenever the new issue is a feature/fix, exactly as before. The "Idea branch" and "Spike branch" subsections at the end of this section are the separate paths taken when the new issue's type is `idea`/`spike` — reached either via Step 0's bare-folder "An idea" answer (produces `idea` only) or via Step 3's four-option question in an already-scaffolded project (produces `idea` or `spike`) — they do not extend or alter anything below.

Whenever a new issue's `prompt.md` is about to be written (from either path above), first use AskUserQuestion to ask: **"What language should the planning documents for this issue be written in?"** with options English, Russian, and Other (free text). This choice only needs to be asked once per issue.

Immediately after, use AskUserQuestion to ask a second question: **"How big is this task?"** with four options, one line each (from `~/.claude/skills/pf-size-tiers/SKILL.md`'s Tiers table), recommending **medium** by default ("today's standard full pipeline — pick this if unsure"):

- **trivial** — One-liner or single obvious fix. 1 user story, ≤3 ACs.
- **small** — Single focused change, clearly bounded. 2-3 user stories.
- **medium** (recommended) — Today's framework default. 4-6 user stories.
- **large** — Multi-subsystem or 7+ user stories.

Immediately after, run the **role-assignment step** below — it replaces the old single "Which role profile?" question with per-stage assignment, applying a profile being one option among others rather than the only path.

### Role assignment

**Question 1 — "How should roles be assigned for this issue?"** Options:
- **Individually per stage (recommended)** — assign write/review per stage group below, using availability-based recommendations.
- **Apply profile `<name>`** — one option per profile name found in `docs/planning/role-profiles.yml` (`~/.claude/skills/pf-roles/SKILL.md` §3), up to the 4-option limit combined with "Individually". With the three shipped profiles this already fills all 4 slots; if a project's `role-profiles.yml` carries more, replace the overflow with a single **"a profile…"** option that opens a second `AskUserQuestion` listing every profile name.

**If a profile was chosen:** record it as `profile:` (no `roles:` block is written — resolution falls through to the profile via `~/.claude/skills/pf-roles/SKILL.md` §4). Skip straight to the `on_unavailable` question below.

**If "Individually per stage":** determine this issue's applicable stage keys from its type and `size_tier`, using the same key sets `~/.claude/skills/pf-brd/SKILL.md`'s reviewer-assignment guard already enumerates (`notes`/`test_plan`/`code` for `trivial`; `brd`/`specs`/`test_plan`/`implementation_plan`/`code` for `feat`; `brd`/`test_plan`/`implementation_plan`/`code` for `improve`; `analysis`/`test_plan`/`implementation_plan`/`code` for non-trivial `bug`), plus `tests` whenever `code` applies and `size_tier` is not `trivial` (trivial-tier tasks always resolve `code`, never `tests` — `~/.claude/skills/pf-execute/SKILL.md` Phase 1), plus `user_docs`/`dev_docs` only when `size_tier` is `medium` or `large` (for `trivial`/`small` these tier-default to `skip` — per `~/.claude/skills/pf-roles/SKILL.md` §4 level 3 — asking would be pointless noise; a project that genuinely wants them forced on every tier still can, via a custom profile, per §3).

Group these keys into up to three groups, and ask **write** then **review** for each group that has at least one applicable key:
- **(a) Planning documents** — whichever of `notes`/`brd`/`specs`/`analysis`/`test_plan`/`implementation_plan` apply.
- **(b) Code & tests** — `code`, and `tests` if applicable.
- **(c) Documentation** — `user_docs`, `dev_docs` (only asked at all when applicable per above).

For each group's **write** question ("Who should write `<group>`?") and **review** question ("Who should review `<group>`?"), build options via the Recommendation procedure in `~/.claude/skills/pf-roles/SKILL.md` §10 (kind derived from the group: planning documents → `planning`, code & tests write → `code`, any review → `review`) — the top-ranked `actor:tier` is the recommended option, with its `why`/level as the reason; the 2nd/3rd ranked results are the next options. Review questions may additionally offer the two-provider parallel combo (§10 step 5) when its condition holds. The **last option in every group question is "Set per stage…"**, which expands that group into one write question and one review question per individual key in it, each built the same way via §10 — for a user who wants finer control than the group-level default. Free-text `actor:tier` entry is always available via `AskUserQuestion`'s built-in "Other".

Once every group (or its expanded per-key questions) is answered, expand the answers into a fully **per-key** `roles:` block — never a group-level shorthand; `prompt.md` always records one `roles.<key>` entry per applicable key, whether the user answered at group granularity or asked for "Set per stage…" on some groups and not others.

**Question 2 (after role assignment, either path) — "If the assigned model is unavailable when a stage runs?"** Options: **degrade-tier** (recommended — keeps autopilot moving, same provider, cheaper tier), **switch-provider**, **wait**. Record the answer as `on_unavailable:` — see `~/.claude/skills/pf-roles/SKILL.md` §11 for what each value does at dispatch time. This is asked exactly once per issue, regardless of which role-assignment path was taken, since it governs every later stage's dispatch, run unattended by autopilot.

Write `prompt.md` with a YAML frontmatter block recording every answer, followed by the task description. Example, "Individually per stage" path, medium-tier feat issue:

```
---
doc_language: English
size_tier: medium
on_unavailable: degrade-tier
roles:
  brd:                  { write: claude, review: [claude] }
  specs:                { write: claude, review: [claude] }
  test_plan:             { write: claude:opus, review: [codex:sol] }
  implementation_plan:   { write: claude, review: [claude] }
  code:                  { write: codex:sol, review: [claude] }
  tests:                 { write: codex:sol, review: [claude] }
  user_docs:             { write: claude, review: [claude] }
  dev_docs:              { write: claude, review: [claude] }
---

<task description as given by the user>
```

Or, "Apply profile" path:

```
---
doc_language: English
size_tier: medium
profile: claude-writes-codex-reviews
on_unavailable: degrade-tier
---

<task description as given by the user>
```

Use the exact language name the user gave (e.g. `Russian`, or whatever they typed for "Other") as the `doc_language` value. Every downstream pf-* skill that produces a document reads this field and writes its prose content in that language, defaulting to English if the field is absent — see each skill's own instructions for specifics.

Record the chosen tier (`trivial`, `small`, `medium`, or `large`) as `size_tier`, next to `doc_language`. Every downstream pf-* skill reads this field and scales document length/sections/routing accordingly — see `~/.claude/skills/pf-size-tiers/SKILL.md` for the full tables and each skill's own instructions for specifics.

Record the role-assignment answers as `roles:` and/or `profile:`, and the `on_unavailable` answer as `on_unavailable:`, next to `size_tier`. Every downstream pf-* skill that resolves a stage's write/review role reads these fields as part of the fallback order — see `~/.claude/skills/pf-roles/SKILL.md` §4 and §11. Note that `profile:` plus a partial `roles:` still works, via §4's level ordering — nothing about this flow forbids hand-adding point-specific `roles.<key>` overrides on top of a chosen profile later. Once `profile:` and/or `roles:` is set (from either path above), the Reviewer-assignment guard earlier in this file no longer fires for this issue.

### Idea branch

Taken when the new issue's type is `idea` — reached either via Step 0's bare-folder "An idea" answer (`has_pf` was false), or via Step 3's "Describe an idea" button/confirmed free text in an already-scaffolded project (`has_pf` was already true). Reuse the `doc_language` question above rather than asking it twice; everything else below is content this branch, not "Creating prompt.md"'s general path, is responsible for.

**Idea intake batch — two `AskUserQuestion` calls, at most 4 questions each** (never a per-field round-trip):
- **Batch 1** (4 questions): `idea_tier` (`personal`/`infra`/`content`/`product` — one-line descriptions from `~/.claude/skills/pf-idea-lenses/SKILL.md` §1, recommending based on the topic if it's obvious, otherwise no default); the idea itself — typed directly, **or** a path to a file to extract it from (see "Idea from a file" below); Evidence of Pain; Constraints.
- **Batch 2** (3 questions): Out of Scope; "What Would Convince You: Project" (what would have to be true for the eventual verdict to be `project`); Decision Rights (what the AI may decide on its own, without asking, for the rest of this idea's pipeline).

**Idea from a file (US-03a).** If the user names a file instead of typing the idea directly, `/pf` reads it and decides for itself how to extract the idea from the contents — this is deliberately not prescribed (BRD Non-Goals: "how exactly to extract the idea from a file is not regulated by the skill, the AI decides"). After extraction, show the extracted text back to the user for confirmation with one more `AskUserQuestion` — **"Yes, that's it"** / **"No, let me rephrase"** (free text via "Other") — before it goes anywhere. Only confirmed text is written into `prompt.md`. This is the only point in the whole issue where reading an external file happens at all (potentially from the user's own notes/vault), and it happens as an ordinary read of a path the user named — no special-cased knowledge of any particular tool or storage location anywhere in this flow.

**Unreadable/binary/empty file (§5.8).** If the named file can't be read as text (binary, corrupted, missing), do not fail silently: report the read error and ask the user to type the idea directly instead — within the same intake call, re-asking only that one question, not the whole batch.

**Bare-folder carve-out (AC-01b) — Step 0 entry only.** When this branch was reached via Step 0 (`has_pf` was false), **skip role assignment and the `on_unavailable` question entirely** — no `roles:`/`profile:`/`on_unavailable:` field is written by this intake. Resolution for this issue falls back to the framework default (`write: claude, review: [claude]`) until the user hand-adds a `roles.<key>` entry to `prompt.md` later.

**Existing-project role assignment — Step 3 entry only.** When this branch was reached via Step 3 (`has_pf` was already true), run the same **Role assignment** procedure documented above (Question 1 — individually per stage / apply a profile; Question 2 — `on_unavailable`), unchanged except for the applicable key set: `idea`, `research`, `critique`, `verdict` (never `code`/`tests`/`user_docs`/`dev_docs` — those keys don't apply to this pipeline). Group them as a single group ("Idea documents") for the write/review questions, built via the same `~/.claude/skills/pf-roles/SKILL.md` §10 Recommendation procedure as any other group in that section.

Write `prompt.md`:

```
---
type: idea
doc_language: <as answered above>
idea_tier: <personal|infra|content|product>
interaction: front-loaded
profile: <name>                    # Step 3 entry only, if a profile was chosen
roles:                             # Step 3 entry only — keys: idea, research, critique, verdict
  idea:      { write: claude, review: [claude] }
  research:  { write: claude, review: [claude] }
  critique:  { write: claude, review: [claude] }
  verdict:   { write: claude, review: [claude] }
on_unavailable: degrade-tier        # Step 3 entry only
---

## Idea
<idea text, typed or extracted-and-confirmed>

## Evidence of Pain
<...>

## Constraints
<...>

## Out of Scope
<...>

## What Would Convince You: Project
<...>

## Decision Rights
<...>
```

For the Step 0 (bare-folder) entry, `profile:`/`roles:`/`on_unavailable:` are all omitted, per the carve-out above — nothing else about the file differs.

Write **only** `docs/issues/open/YYYYMMDD-idea-<slug>/prompt.md` for the Step 0 entry — nothing else on disk (no `PLANNING.md`, no `docs/planning/`, no `.pf-version`, no `git init`), per Step 0's "An idea" branch above. The Step 3 entry writes `prompt.md` inside the already-scaffolded project as usual — no additional scaffolding step, nothing extra to create.

### Spike branch

Taken when the new issue's type is `spike` — reached only via Step 3's "Run a technical spike" button, or via free text confirmed as a spike by the follow-up question — always in an already-scaffolded project (`has_pf` true). Step 0's bare-folder path never produces a `spike` issue directly; only `idea` (a `spike` can later be auto-created from an idea's `spike-first` verdict — a different mechanism, not this branch). Reuse the `doc_language` question above.

**Spike intake batch — the same shape as the idea branch: two `AskUserQuestion` calls, at most 4 questions each:**
- **Batch 1** (4 questions): Question (what's being tested); Success Criterion (as the user states it); Time-box (how much time/effort is budgeted); Method (how it will be tested).
- **Batch 2** (up to 3 questions): Constraints (optional); Out of Scope (optional); Decision Rights (what the AI may decide on its own without asking).

**No bare-folder carve-out for spike.** Unlike the Idea branch, there is no bare-folder entry to carve out here at all: Step 0's "An idea" answer only ever produces `type: idea`, never `type: spike` (see above), so a `spike` issue is never created in a folder where `has_pf` is false. Role assignment and the `on_unavailable` question are therefore **always** asked for a spike issue — never skipped the way the idea branch's bare-folder carve-out skips them.

**Role assignment.** Always the Step 3 entry (a bare-folder spike doesn't exist — see above), so role assignment always runs: the same **Role assignment** procedure above, keys `hypothesis`, `findings` only, grouped as a single group ("Spike documents"), then the same `on_unavailable` question.

Write `prompt.md`:

```
---
type: spike
doc_language: <as answered above>
idea_tier: <personal|infra|content|product>   # same dictionary — affects only hypothesis.md/findings.md budgets, not lenses/personas (spike never produces idea.md/critique.md)
interaction: front-loaded
profile: <name>                     # if a profile was chosen
roles:                              # keys: hypothesis, findings
  hypothesis: { write: claude, review: [claude] }
  findings:   { write: claude, review: [claude] }
on_unavailable: degrade-tier
---

## Question
<what's being tested>

## Success Criterion
<...>

## Time-box
<...>

## Method
<...>

## Constraints
<optional>

## Out of Scope
<optional>

## Decision Rights
<...>
```

### `type:` vs. folder name (both branches)

Both branches above write `type: idea`/`type: spike` even though the folder name already carries the same information — this redundancy is intentional (§5.1 of this issue's specs: hand-edit risk, and `type:` doubles as the key `~/.claude/skills/pf-roles/SKILL.md` §4 resolves against). Step 4's type/folder-name conflict check (above) is what enforces the two staying in sync on every later `/pf` run.

### Terminal git-status line (AC-01d, both branches)

Once `prompt.md` is written, this CREATE step is the **only** stage in the idea/spike pipeline that prints its git-status line inline rather than through `pf-git` — there is nothing yet to stage or commit for `pf-git` to run against. If `has_git` is false at the moment intake completes (computed in Step 0 for the bare-folder entry, or already known from this run's Step 2 for the Step 3 entry), append to the usual intake report exactly the same wording `pf-git`'s no-repository guard prints for every other stage (translated per `doc_language`):

```
Git: not committed — no git repository
```

If `has_git` is true, no such line is printed here — the commit for `prompt.md` rides along with whichever stage runs next, per `pf-git`'s normal staging procedure.
