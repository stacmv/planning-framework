---
name: pf-codereview
description: Review the active issue's code diff for potential problems, grouped by priority — a hard gate between /pf-execute and /pf-test
version: 3.0.0
---

Determine the active issue from `docs/issues/open/`. Read ISSUE-ID from the folder name.

**Position in the pipeline.** This skill runs after `/pf-execute` completes and before `/pf-test`. Unlike `/pf-check` (which reviews one planning document at a time and always leaves "Skip and continue" on the table), this is a **hard gate**: it reviews the issue's actual code diff, and while any P0/P1 finding is open there is no way to proceed except fixing it.

---

## Phase -1: Automigration — this skill's own prerequisite

Before anything else — before Phase 0 — check the active issue's `prompt.md` frontmatter: if it has a `reviewers:` block but no `roles:` block, run the same automigration `/pf`'s Step 2 runs, following the conversion rule and fallback-order algorithm defined in `~/.claude/skills/pf-roles/SKILL.md` (§5, §4) — do not restate that rule here. This skill does not assume `/pf` already did this: it can be invoked directly on a legacy issue, including from `/pf-autopilot`, bypassing `/pf` entirely. This is read/write on `prompt.md` only — the edit rides along with whichever commit this invocation makes in Phase 5.

## Phase 0: Input Gate — `implementation_plan.md` must be complete

Reuse exactly the same mechanical prerequisite check `/pf-execute` runs for its own gate — do not invent a second one. Per the shared "Stage completion" definition in `~/.claude/skills/pf-size-tiers/SKILL.md`, judged fresh from the filesystem, never from memory (see "Evaluating it is a MECHANICAL check" there for the exact tool calls to run):

- **If `size_tier: trivial`:** `notes.md` must be complete (which itself requires `test_plan.md` to be complete). If not, stop: "Notes document is required. Run /pf-brd first." — or, if `test_plan.md` is the incomplete one: "Test plan is required. Run /pf-test-plan first."
- **If `size_tier` is small/medium/large (or absent):** `implementation_plan.md` must be complete — which includes every preceding stage (`brd.md`/`specs.md` or `analysis.md`, and `test_plan.md`). If not, stop naming whichever stage is actually incomplete, exactly as `/pf-execute` does (e.g. "Implementation plan is required. Run /pf-impl-plan first.").

> **Run the check, do not recall it.** Your first action here is a tool call against the issue folder, not a recollection of what you read earlier this session — see "Evaluating it is a MECHANICAL check" in `~/.claude/skills/pf-size-tiers/SKILL.md`.

---

## Phase 1: Determine Review Scope — the issue's diff, not the working tree

The review target is `git diff <parent>...HEAD` — what this issue actually changed — never the ad-hoc working tree.

1. **On the issue branch:** run `git branch --show-current`. If the result is not `issue/ISSUE-ID`, stop: "Switch to the issue branch first: `git checkout issue/ISSUE-ID`"
2. **Detect the parent branch — reuse `/pf-close`'s Phase 3 ("Detect Parent Branch") verbatim, do not invent a second detection method:**
   - Run `git config branch.issue/ISSUE-ID.merge`. **Self-tracking upstream guard:** if the result is empty, the command fails, or it equals `refs/heads/issue/ISSUE-ID` itself, ignore it and fall through. Otherwise strip the `refs/heads/` prefix and use that as PARENT-BRANCH.
   - Fallback: if `develop` is listed in `git branch --list develop`, PARENT-BRANCH is `develop`; otherwise `main`.
3. **Compute the diff:** `git diff PARENT-BRANCH...HEAD` (three-dot: everything reachable from `HEAD` since it diverged from PARENT-BRANCH — the same base ref `pf-check`'s Codex invocation chain calls `<base-ref>` when it runs `--scope branch --base <base-ref>`, so both reviews of this issue always agree on what "the diff" means).

This diff — plus `implementation_plan.md` and `test_plan.md` for intent/context — is what gets reviewed below, whichever reviewer(s) run it. Never widen scope to the whole working tree or to files outside the diff.

---

## Phase 1.5: `roles.code.review: skip`

Before running Phase 2 at all, resolve the role for `code` (per `~/.claude/skills/pf-roles/SKILL.md` §4's fallback order — the same resolution Phase 2 below would otherwise do first) and check whether its `review` is `skip` (specs.md §7.3; `pf-roles/SKILL.md` §1's "`code.review: skip`" section). `code: skip` at the whole-stage level is invalid and stopped with an explicit error by the resolver itself (§1 there); this is specifically `review: skip`, with `write` still required and present.

If `roles.code.review` is anything other than `skip`, this phase does nothing further — proceed to Phase 2, which resolves the role again (resolution is never cached, per `pf-roles/SKILL.md` §8).

If it **is** `skip`:
- Check `docs/issues/open/ISSUE-ID/prompt.md`'s frontmatter for a `confirmed:` marker adjacent to `roles.code.review: skip`.
- **If `confirmed:` is already present** (written earlier by `/pf`'s `code.review: skip` confirmation guard, or by this skill itself on a previous run) — do not run any reviewer path (Phase 2 and Phase 3's normal PASS/FAIL logic do not run).
- **If `confirmed:` is absent** (e.g. `code.review: skip` was hand-edited into `prompt.md`, bypassing `/pf` entirely) — ask the user the same question `/pf` would ask, via `AskUserQuestion`: **"Code review is disabled for this issue — confirm?"** On "yes," write `confirmed: <today's date>` into `prompt.md`'s frontmatter next to `roles.code.review: skip`, in the exact form `~/.claude/skills/pf-roles/SKILL.md` §1 shows (`code: { write: claude, review: skip, confirmed: 2026-08-07 }`), then continue below. Do not run any reviewer path either way — the confirmation only gates whether the skip is allowed to stand, not whether review runs.
- Write `docs/issues/open/ISSUE-ID/code_review.md` with `verdict: SKIPPED (roles.code.review: skip, confirmed <confirmation date>)` in place of the normal PASS/FAIL verdict format from Phase 3, and do **not** block progression to `/pf-test` — skip Phase 2, Phase 3, and Phase 4's gate entirely, and go straight to Phase 5 (Commit & Push).

---

## Phase 2: Reviewer Selection

Resolve the role for the `code` key per `~/.claude/skills/pf-roles/SKILL.md` (§4's fallback order), reading `docs/issues/open/ISSUE-ID/prompt.md`'s frontmatter (`roles:`/`profile:`, post-automigration from Phase -1). This resolution is not reused from Phase 1.5 — it is re-read fresh here (never cached, per `pf-roles/SKILL.md` §8), and by this point Phase 1.5 has already established that `review` is not `skip`. If role resolution yields no `roles:`/`profile:` at all for this issue (§4's level 5 general default), the resolved review is `[claude]` — the same backward-compatibility default `pf-check` uses, and for the same reason: issues created before this field existed must review code exactly as `claude`-only would have.

The resolved role's `review` field (a list + `mode`, per `pf-roles` §1) drives which path runs, identically to `pf-check`:
- `{ mode: parallel, by: [claude] }` (or `review` absent — general default) — the "Claude review" path below only.
- `{ mode: parallel, by: [codex] }` — `pf-check`'s **"Codex invocation chain"** only (`skills/pf-check/SKILL.md`).
- `{ mode: parallel, by: [claude, codex] }` — both, independently, then merged per `pf-check`'s **"`both`-mode aggregation"**.
- `{ mode: sequential, by: [...] }` — `pf-check`'s **"Sequential review mode"** (`skills/pf-check/SKILL.md`), applied to the code diff instead of a document: each reviewer in `by` reviews in turn, findings between passes are auto-dispatched to the resolved `write` actor for `code` (§4 below covers who that is), and the final `code_review.md` (Phase 3) lists each pass as its own `[<actor>, pass N]` block, same as `pf-check`'s final report — this skill references that mechanism by name rather than restating it.

`roles.code.review: skip` is a separate, valid value handled entirely in Phase 1.5 above (before this phase even runs) — it is not one of the four shapes above and does not run any reviewer path. By the time this phase runs, Phase 1.5 has already ruled it out.

### Claude review path

Dispatch a single sub-agent (Agent tool, default/general-purpose type) with a prompt along these lines:

> Read `docs/issues/open/ISSUE-ID/implementation_plan.md` and `test_plan.md` for context on what this issue was supposed to build. Then review this diff (the issue's actual changes, `git diff PARENT-BRANCH...HEAD` — run that command yourself if not already given the output) for bugs, regressions, security issues, missed edge cases, and inconsistency with the mapped test cases. Do not review or comment on code outside the diff. Do not edit anything — analysis only.
>
> Group findings by priority: P0 (blocker), P1 (important), P2 (minor).
>
> Read the `doc_language` field from `docs/issues/open/ISSUE-ID/prompt.md`'s YAML frontmatter (default: English if absent) and write your findings in that language.
>
> Your reply is the only thing the orchestrator will see. Return ONLY the prioritized findings (as your final message).

### Codex path (`codex` or the Codex half of `both`)

Run `pf-check`'s **"Codex invocation chain"** exactly as documented in `skills/pf-check/SKILL.md` — this skill references that chain by name rather than restating or redefining it. The only adaptation is scope: instead of "the whole target document," `<base-ref>` is PARENT-BRANCH from Phase 1 above, and the brief given to Codex is "review this diff against PARENT-BRANCH for bugs, regressions, security issues, and inconsistency with implementation_plan.md/test_plan.md" in place of the document-review brief — `pf-check`'s own chain text already anticipates this exact split ("the code-review case in `pf-codereview` where the same `--base <base-ref>` diff spans the entire issue implementation instead of one file").

### Severity → priority mapping

Use `pf-check`'s **"Severity → priority mapping"** table verbatim (`critical`/`high` → P0, `medium` → P1, `low` → P2) — this skill does not redefine it. As in `pf-check`, this mapping applies only to structured (`review-output.schema.json`) Codex output; a raw `codex exec` fallback response has no `severity` field and is shown as-is in its own "Codex findings (unstructured)" block, never forced into P0/P1/P2.

### `both`-mode aggregation

When the resolved `review` is `{ mode: parallel, by: [claude, codex] }`, run the Claude path and the Codex path independently, wait for both, then merge exactly per `pf-check`'s **"`both`-mode aggregation"** section: one combined list grouped by P0/P1/P2, each finding prefixed `[Claude]` / `[Codex]` (or `[Codex→Claude fallback]` if Codex fell back within the `both` run), no deduplication or arbitration between the two.

---

## Phase 3: Write `code_review.md`

Write `docs/issues/open/ISSUE-ID/code_review.md`, mirroring `qa_report.md`'s verdict-field pattern:

```markdown
# Code Review Report

**Issue ID:** ISSUE-ID
**Date:** YYYY-MM-DD
**Reviewer(s):** Claude | Codex | Claude + Codex

---

## Findings

### P0 (Blocker)
[list, or _None._]

### P1 (Important)
[list, or _None._]

### P2 (Minor)
[list, or _None._]

---

## Verdict

**PASS**
```

Rules for the Verdict section (identical in spirit to `pf-qa`'s):
- If there is no open P0 or P1 finding (P2-or-none): write `**PASS**` on its own line.
- If any P0 or P1 finding is open: write `**FAIL**` on its own line.
- The verdict must appear as a standalone line (`**PASS**` or `**FAIL**`) so `/pf-test`'s prerequisite check can detect it with a simple text search, the same way `/pf-close` reads `qa_report.md`.

Write finding prose in the issue's `doc_language` (default English), keeping `[Claude]`/`[Codex]` tags, priority headings and the verdict markers in English exactly as shown above.

---

## Phase 4: The Hard Gate — no "Skip and continue"

**This phase does not run at all when Phase 1.5 resolved `roles.code.review: skip`** — that path already wrote `verdict: SKIPPED` and went straight to Phase 5, bypassing Phase 2, Phase 3, and this gate entirely (see Phase 1.5 above).

**If Phase 3 produced `verdict: PASS`** (no open P0/P1): report the result and stop here — no `AskUserQuestion` is needed, there is nothing to resolve. State the next step: "Code review passed. Run /pf-test."

**If Phase 3 produced `verdict: FAIL`** (at least one open P0/P1): present the findings, then use `AskUserQuestion` with **exactly these two options — never a third "skip" option**:

**"How would you like to proceed?"**
- **Fix now** — I'll address all P0 and P1 findings and update the code. I'll ask you clarifying questions where needed.
- **I'll fix manually, then re-run /pf-codereview** — You'll edit the code yourself, then run `/pf-codereview` again to re-verify.

This is the one deliberate difference from `pf-check`'s gate: `pf-check` always keeps a third "Skip and continue" option; this skill never offers it while a P0/P1 finding is open, per the BRD's requirement that the code-review gate is genuinely blocking. Only P2-or-none resolves to `verdict: PASS` without any gate question at all.

**If "Fix now":** dispatch the fix to this stage's resolved `write` actor for `code` (`~/.claude/skills/pf-roles/SKILL.md` §4's fallback order — resolved fresh, same as Phase 2). **The fixer is not always Claude** — it is whichever actor `write` resolves to, regardless of which reviewer(s) produced the findings; Codex, in any *review* invocation form, still only ever finds problems, never fixes in that same pass, but a `code` stage whose `write` is `codex` gets its fixes from `codex`. This is a deliberate behavior change from before this issue (BRD Non-Goals — no write/review independence invariant is introduced).
- **If `write == claude`:** dispatch a fix sub-agent (Agent tool, default/general-purpose type) — same as before. Give it: PARENT-BRANCH (so it can re-derive the diff), the full P0/P1 findings list (source-tagged `[Claude]`/`[Codex]` if `both`, or `[<actor>, pass N]` if sequential), and `implementation_plan.md`/`test_plan.md` for context. Instruct it to read what it needs, use `AskUserQuestion` itself for genuinely ambiguous points, patch the diff directly, and return only a short summary of what changed.
- **If `write != claude`** (in this issue, only `codex`): use the write-invocation form from `~/.claude/skills/pf-roles/SKILL.md` §7, with the "apply these findings to an existing file" prompt form from §6 there (not the "write a document from scratch" form) — adapted to a code diff instead of a single document: the prompt names PARENT-BRANCH and the changed files instead of one target path, and includes the same P0/P1 findings list. The actor edits the repository itself (`--write`); this skill re-derives the diff afterward the same way Phase 1 always does, and reports a short summary to the user (no clarifying-question loop — a delegated actor cannot call `AskUserQuestion`).

After the fix returns, **loop**: go back to Phase 1 (recompute the diff — it has changed), re-run Phase 2 (the same resolved `review` reviewer(s)) and Phase 3 (rewrite `code_review.md`), then re-evaluate this Phase 4 gate. Repeat automatically — no need to re-ask the user to re-invoke the skill — until `verdict: PASS`. Relay each iteration's fix summary to the user as it happens.

**If "I'll fix manually, then re-run /pf-codereview":** confirm the choice, state that `code_review.md` currently records `verdict: FAIL`, and stop. Do not loop — the next `/pf-codereview` invocation starts a fresh Phase 0.

---

## Phase 5: Commit & Push

As the last action of this skill invocation — after the loop above (if any) has settled, whether it ends in `verdict: PASS`, `verdict: SKIPPED` (Phase 1.5), or the user chose to fix manually and left `verdict: FAIL` — run the shared commit & push procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push"). Do not restate the procedure here: it defines the push guard and the one-line git report. Stage `docs/issues/open/ISSUE-ID/code_review.md`, plus `prompt.md` if Phase -1's automigration or Phase 1.5's `confirmed:` write touched it this run, plus any file(s) a fix actor actually edited during this invocation's Fix-now loop (never `git add -A` — same scoped-staging rule every other `pf-*` stage follows). Commit message: `docs: code_review.md — <PASS|FAIL|SKIPPED> [<ISSUE-ID>]` (mirrors `pf-qa`'s `qa_report.md — <PASS|FAIL> [<ISSUE-ID>]` message; see `~/.claude/skills/pf-git/SKILL.md`'s Step 2 table).

---

## Important Notes

- **Do not run the test suite** — that is `/pf-test`'s job, gated on this skill's `verdict: PASS` or `verdict: SKIPPED` (see `skills/pf-test/SKILL.md`).
- **Never widen the diff to the whole working tree.** The scope is always `PARENT-BRANCH...HEAD`, computed fresh each loop iteration.
- **The severity mapping and the Codex invocation chain live in exactly one place** — `skills/pf-check/SKILL.md`. This skill references them; it never copies or re-derives them, so the two skills cannot drift apart on what P0/P1/P2 mean.
- **"Skip and continue" does not exist here, ever, while P0/P1 is open.** This is the one deliberate divergence from `pf-check`'s gate — everything else about reviewer selection, Codex fallback, and `both`-aggregation is identical. `roles.code.review: skip` (Phase 1.5) is a different mechanism entirely — a role explicitly configured (and confirmed) to skip review altogether, not a gate response chosen while findings are open.
- **The fixer is not always Claude** — it is this stage's resolved `write` actor (`~/.claude/skills/pf-roles/SKILL.md` §4), which may be `codex`. Codex, in any *review* invocation form, only ever produces findings within that same pass; it never fixes in a review pass. This is a deliberate behavior change from before this issue (BRD Non-Goals — no write/review independence invariant).
