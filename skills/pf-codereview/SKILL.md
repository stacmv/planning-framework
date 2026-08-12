---
name: pf-codereview
description: Review the active issue's code diff for potential problems, grouped by priority — a hard gate between /pf-execute and /pf-test
version: 3.0.0
---

Determine the active issue from `docs/issues/open/`. Read ISSUE-ID from the folder name.

**Position in the pipeline.** This skill runs after `/pf-execute` completes and before `/pf-test`. Unlike `/pf-check` (which reviews one planning document at a time and always leaves "Skip and continue" on the table), this is a **hard gate**: it reviews the issue's actual code diff, and while any P0/P1 finding is open there is no way to proceed except fixing it.

---

## Phase 0: Input Gate — `implementation_plan.md` must be complete

This runs **first, before automigration (Phase 0.5) or any role resolution** — it needs neither. Checking the prerequisite before touching `prompt.md` means that if this gate stops the skill, nothing has been mutated yet: no dirty, unowned `prompt.md` edit is left behind for a run that never reaches Phase 5's commit.

Reuse exactly the same mechanical prerequisite check `/pf-execute` runs for its own gate — do not invent a second one. Per the shared "Stage completion" definition in `~/.claude/skills/pf-size-tiers/SKILL.md`, judged fresh from the filesystem, never from memory (see "Evaluating it is a MECHANICAL check" there for the exact tool calls to run):

- **If `size_tier: trivial`:** `notes.md` must be complete (which itself requires `test_plan.md` to be complete). If not, stop: "Notes document is required. Run /pf-brd first." — or, if `test_plan.md` is the incomplete one: "Test plan is required. Run /pf-test-plan first."
- **If `size_tier` is small/medium/large (or absent):** `implementation_plan.md` must be complete — which includes every preceding stage (`brd.md`/`specs.md` or `analysis.md`, and `test_plan.md`). If not, stop naming whichever stage is actually incomplete, exactly as `/pf-execute` does (e.g. "Implementation plan is required. Run /pf-impl-plan first.").

> **Run the check, do not recall it.** Your first action here is a tool call against the issue folder, not a recollection of what you read earlier this session — see "Evaluating it is a MECHANICAL check" in `~/.claude/skills/pf-size-tiers/SKILL.md`.

---

## Phase 0.5: Automigration — this skill's own prerequisite

Only once Phase 0 has passed — before Phase 1 — check the active issue's `prompt.md` frontmatter: if it has a `reviewers:` block but no `roles:` block, run the same automigration `/pf`'s Step 2 runs, following the conversion rule and fallback-order algorithm defined in `~/.claude/skills/pf-roles/SKILL.md` (§5, §4) — do not restate that rule here. This skill does not assume `/pf` already did this: it can be invoked directly on a legacy issue, including from `/pf-autopilot`, bypassing `/pf` entirely. This is read/write on `prompt.md` only — the edit rides along with whichever commit this invocation makes in Phase 5. Running this after Phase 0 (rather than before it) means Phase 0 stopping the skill early never leaves a `prompt.md` mutation behind — see Phase 0's note above.

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
- Check `docs/issues/open/ISSUE-ID/prompt.md`'s frontmatter for a `confirmed:` marker adjacent to `roles.code.review: skip`. **Scope note:** this `confirmed:` check reads literal `prompt.md` text only, not the full §4 resolution chain — a profile-level point-specific `skip` (with no matching literal text in `prompt.md`) would not be caught here. No default profile currently produces that, so this is a documented scope boundary, matching `/pf`'s equivalent confirmation-guard note.
- **If `confirmed:` is already present** (written earlier by `/pf`'s `code.review: skip` confirmation guard, or by this skill itself on a previous run) — do not run any reviewer path (Phase 2 and Phase 3's normal PASS/FAIL logic do not run). Write `docs/issues/open/ISSUE-ID/code_review.md` with `verdict: SKIPPED (roles.code.review: skip, confirmed <confirmation date>)` in place of the normal PASS/FAIL verdict format from Phase 3, and do **not** block progression to `/pf-test` — skip Phase 2, Phase 3, and Phase 4's gate entirely, and go straight to Phase 5 (Commit & Push).
- **If `confirmed:` is absent** (e.g. `code.review: skip` was hand-edited into `prompt.md`, bypassing `/pf` entirely) — ask the user the same question `/pf` would ask, via `AskUserQuestion`: **"Code review is disabled for this issue — confirm?"** The two answers are **not** equivalent — branch on the actual reply:
  - **"yes"** — write `confirmed: <today's date>` into `prompt.md`'s frontmatter next to `roles.code.review: skip`, in the exact form `~/.claude/skills/pf-roles/SKILL.md` §1 shows (`code: { write: claude, review: skip, confirmed: 2026-08-07 }`). Then do not run any reviewer path — write `docs/issues/open/ISSUE-ID/code_review.md` with `verdict: SKIPPED (roles.code.review: skip, confirmed <confirmation date>)` in place of the normal PASS/FAIL verdict format from Phase 3, and do **not** block progression to `/pf-test` — skip Phase 2, Phase 3, and Phase 4's gate entirely, and go straight to Phase 5 (Commit & Push).
  - **"no"** — the skip is declined. Do **not** write a `confirmed:` marker. Do **not** write `verdict: SKIPPED`, and do **not** skip Phase 2/3/4. Since the literal configured `roles.code.review` value (`skip`) cannot itself be resolved to a reviewer, treat this run's review as the general `[claude]` default (`~/.claude/skills/pf-roles/SKILL.md` §4's fallback — the same default Phase 2 uses whenever no `roles:`/`profile:` is configured at all): run the **Claude review path** below directly for this run, then continue into Phase 3 (write `code_review.md`) and Phase 4 (the hard gate) exactly as if `review` had resolved to `[claude]` in the first place. (Do not re-enter Phase 2's role resolution here — reading `prompt.md` again would just see `skip` a second time; this is a one-time override for this run's review only, it does not rewrite `roles.code.review` in `prompt.md`.) State plainly to the user that answering "no" means code review actually runs now, on this diff — it does not silently continue treating the code as unreviewed, and it does not loop back into asking the same skip-confirmation question again this run.

---

## Phase 2: Reviewer Selection

Resolve the role for the `code` key per `~/.claude/skills/pf-roles/SKILL.md` (§4's fallback order), reading `docs/issues/open/ISSUE-ID/prompt.md`'s frontmatter (`roles:`/`profile:`, post-automigration from Phase 0.5). This resolution is not reused from Phase 1.5 — it is re-read fresh here (never cached, per `pf-roles/SKILL.md` §8), and by this point Phase 1.5 has already established that `review` is not `skip` — except for the Phase 1.5 "no" branch, which skips straight to the Claude review path for that one run instead of re-entering this phase (see Phase 1.5 above). If role resolution yields no `roles:`/`profile:` at all for this issue (§4's level 5 general default), the resolved review is `[claude]` — the same backward-compatibility default `pf-check` uses, and for the same reason: issues created before this field existed must review code exactly as `claude`-only would have.

The resolved role's `review` field (a list + `mode`, per `pf-roles` §1) drives which path runs, identically to `pf-check`:
- `{ mode: parallel, by: [claude] }` (or `review` absent — general default) — the "Claude review" path below only.
- `{ mode: parallel, by: [codex] }` — `pf-check`'s **"Codex invocation chain"** only (`skills/pf-check/SKILL.md`).
- `{ mode: parallel, by: [claude, codex] }` — both, independently, then merged per `pf-check`'s **"`both`-mode aggregation"**.
- `{ mode: sequential, by: [...] }` — `pf-check`'s **"Sequential review mode"** (`skills/pf-check/SKILL.md`), applied to the code diff instead of a document: each reviewer in `by` reviews in turn, findings between passes are auto-dispatched to the resolved `write` actor for `code` (§4 below covers who that is), and the final `code_review.md` (Phase 3) lists each pass as its own `[<actor>, pass N]` block, same as `pf-check`'s final report — this skill references that mechanism by name rather than restating it.

`roles.code.review: skip` is a separate, valid value handled entirely in Phase 1.5 above (before this phase even runs) — it is not one of the four shapes above. On confirmed skip, it does not run any reviewer path at all; on a declined ("no") confirmation, Phase 1.5 runs the Claude review path itself and this phase is not re-entered for that run (see Phase 1.5's "no" branch above). Either way, by the time this phase would run, Phase 1.5 has already handled the `skip` case.

### Claude review path

Dispatch a single sub-agent (Agent tool, default/general-purpose type) with a prompt along these lines:

> Read `docs/issues/open/ISSUE-ID/implementation_plan.md` and `test_plan.md` for context on what this issue was supposed to build. Then review this diff (the issue's actual changes, `git diff PARENT-BRANCH...HEAD` — run that command yourself if not already given the output) for bugs, regressions, security issues, missed edge cases, and inconsistency with the mapped test cases. Do not review or comment on code outside the diff. Do not edit anything — analysis only.
>
> Group findings by priority: P0 (blocker), P1 (important), P2 (minor).
>
> Read the `doc_language` field from `docs/issues/open/ISSUE-ID/prompt.md`'s YAML frontmatter (default: English if absent) and write your findings in that language.
>
> Your reply is the only thing the orchestrator will see. Return ONLY the prioritized findings (as your final message).

**Round 2 and later:** extend the prompt above with the current findings ledger from `code_review.md` (every prior round's `CR-NNN` rows, Phase 3 below) alongside the diff, plus this explicit instruction: *these findings are already triaged — do not repeat them; look specifically for new problems introduced by this round's fix diff.* Passing the ledger, not just the diff, is what lets the reviewer separate "already-known" from "new" (AC-2.3) — a bare re-run of this same prompt with no ledger attached would just re-report round 1's findings all over again.

### Codex path (`codex` or the Codex half of `both`)

Run `pf-check`'s **"Codex invocation chain"** exactly as documented in `skills/pf-check/SKILL.md` — this skill references that chain by name rather than restating or redefining it. The only adaptation is scope: instead of "the whole target document," `<base-ref>` is PARENT-BRANCH from Phase 1 above, and the brief given to Codex is "review this diff against PARENT-BRANCH for bugs, regressions, security issues, and inconsistency with implementation_plan.md/test_plan.md" in place of the document-review brief — `pf-check`'s own chain text already anticipates this exact split ("the code-review case in `pf-codereview` where the same `--base <base-ref>` diff spans the entire issue implementation instead of one file").

**Round 2 and later:** extend that brief the same way as the Claude review path above — include the current findings ledger from `code_review.md` (every prior round's `CR-NNN` rows) alongside the diff, plus the same explicit instruction: these findings are already triaged, do not repeat them; look specifically for new problems introduced by this round's fix diff.

### Severity → priority mapping

Use `pf-check`'s **"Severity → priority mapping"** table verbatim (`critical`/`high` → P0, `medium` → P1, `low` → P2) — this skill does not redefine it. As in `pf-check`, this mapping applies only to structured (`review-output.schema.json`) Codex output; a raw `codex exec` fallback response has no `severity` field and is shown as-is in its own "Codex findings (unstructured)" block, never forced into P0/P1/P2.

### `both`-mode aggregation

When the resolved `review` is `{ mode: parallel, by: [claude, codex] }`, run the Claude path and the Codex path independently, wait for both, then merge exactly per `pf-check`'s **"`both`-mode aggregation"** section: one combined list grouped by P0/P1/P2, each finding prefixed `[Claude]` / `[Codex]` (or `[Codex→Claude fallback]` if Codex fell back within the `both` run), no deduplication or arbitration between the two.

---

## Phase 3: Write `code_review.md` — the append-only `CR-NNN` findings ledger

Write `docs/issues/open/ISSUE-ID/code_review.md`, mirroring `qa_report.md`'s verdict-field pattern. Findings are **never** poured into rewritable `### P0`/`### P1`/`### P2` list-sections — that shape has no stable identity across rounds, and a fresh list silently replacing the old one is exactly how a real P2 finding vanished, unnoticed, from round 1 of a prior issue. Findings instead live in a single **append-only ledger table**, one row per finding, keyed by a stable ID:

```markdown
# Code Review Report

**Issue ID:** ISSUE-ID
**Date:** YYYY-MM-DD
**Reviewer(s):** Claude | Codex | Claude + Codex

---

## Findings Ledger

| ID | Round | Priority | Description | State |
|----|-------|----------|--------------|-------|
| CR-001 | 1 | P0 | [failure scenario the finding names] | open |
| CR-002 | 1 | P2 | [description] | open |

---

## Verdict

**PASS**
```

**Append-only (BR-8).** Each row's ID is a stable, permanent identifier in the format `CR-NNN` — three digits, zero-padded (e.g. `CR-001`, `CR-014`) — assigned once, sequentially (highest existing number + 1), and never reused. A later Phase 3 run, on this round or any later one, only ever does one of two things to this table: **appends** a brand-new `CR-NNN` row for a newly reported finding, or **updates the `State` cell** of an already-existing row. It never rewrites or deletes a previously written row's ID, round number, or description — that identity is permanent once written.

**Fields, at minimum, per row:**
- **ID** — the stable `CR-NNN` described above.
- **Round** — the review round this finding was first reported in. This is the one authoritative round counter this skill uses anywhere (Phase 4's round-budget/escalation logic reads it) — no second, separate round counter is introduced.
- **Priority** — P0 (blocker) / P1 (important) / P2 (minor).
- **Description** — the finding itself (for a P1 later resolved via a follow-up issue, its created issue's ID/path is recorded here too — see Phase 4/6's triage rubric).
- **State** — exactly one of the six values below.

**Closed state dictionary — exactly six values, verbatim.** A finding's `State` cell holds exactly one of:
- `open` — the initial state assigned to a finding when it is first created.
- `fixed` — terminal: the fix has been applied and re-reviewed.
- `accepted-risk` — terminal: the risk is knowingly accepted as-is.
- `deferred` — terminal: postponed (this includes the P1-via-follow-up-issue path — see Phase 4/6's triage rubric).
- `wont-fix` — terminal: rejected as not worth fixing.
- `duplicate-of CR-NNN` — terminal: the same underlying issue as another row, cited by its ID.

No seventh value is added, and none of these five terminal values is renamed or replaced with a synonym — `open` is the one non-terminal, initial value; the other five are terminal resolutions.

**`PASS` validation (AC-2.4).** Before writing `verdict: PASS`, confirm every row in the ledger carries an explicit, non-empty `State` — no finding without an explicit state may reach `PASS`. A genuinely empty `State` cell is a violation of this rule regardless of that row's priority (this is exactly the class of defect that let a P2 vanish silently in a prior round-1 review with no row, no record, no trace). A row whose `State` is the literal value `open` is **not** a violation of this rule — `open` is a real, explicit value from the six-value dictionary above, not a missing record. Whether an open P0/P1 blocks `PASS` is the separate rule immediately below, layered on top of this one, not a substitute for it.

Rules for the Verdict section (identical in spirit to `pf-qa`'s):
- If there is no open P0 or P1 finding (every P0/P1 row's `State` is one of the five terminal values, never `open`) **and** the `PASS` validation above holds (no row of any priority has an empty `State`): write `**PASS**` on its own line.
- If any P0 or P1 finding is open: write `**FAIL**` on its own line. This condition is unconditional — no round number and no review-round budget ever turns an open P0/P1 into a `PASS` (Phase 4's round-budget/escalation logic reads this same ledger but never overrides this line).
- The verdict must appear as a standalone line (`**PASS**` or `**FAIL**`) so `/pf-test`'s prerequisite check can detect it with a simple text search, the same way `/pf-close` reads `qa_report.md`.

Write finding prose in the issue's `doc_language` (default English), keeping `[Claude]`/`[Codex]` tags, the ledger's column headers, and the verdict markers in English exactly as shown above.

---

## Phase 3.5: Round 1 Early Bail-Out

This check runs immediately after Phase 3 first writes `code_review.md` for **round 1** specifically — a separate, named point between Phase 3 and Phase 4. It does not run again for round 2 or later; from round 2 onward, Phase 4's "Round N>1 dual check" (below) is what governs the loop instead.

Count the round-1 findings whose `Priority` is P0 or P1 (blocking) in the ledger Phase 3 just wrote. **If round 1 found 3 or more blocking (P0/P1) findings**, do not enter Phase 4's fix loop at all: convert each blocking finding into a new task appended to `docs/issues/open/ISSUE-ID/implementation_plan.md`, and route the issue back to `/pf-execute` for a fresh implementation pass — three or more blockers in the first round means the implementation itself is not ready, not that a quick fix loop will converge it. Below this threshold — 0, 1, or 2 blocking findings in round 1 — Phase 4 runs exactly as documented below, unmodified.

Each finding converted into a task this way must carry a non-empty `**Mapped Test Cases:**` field, naming the original TC-ID(s) from `test_plan.md`'s Status Tracker whose passing behavior the finding's fix must preserve — never a newly invented TC-ID absent from that Status Tracker. An empty field here would block the very next `/pf-execute` → `/pf-codereview` handoff at `/pf-execute`'s own completeness gate. Reusing an existing TC-ID across more than one task is legal — that gate only requires the field non-empty on every `code` task and every TC named by at least one task; it does not require a one-to-one mapping.

---

## Phase 4: The Hard Gate — no "Skip and continue"

**This phase does not run at all when Phase 1.5's skip confirmation came back "yes"** (skip stands, confirmed) — that path already wrote `verdict: SKIPPED` and went straight to Phase 5, bypassing Phase 2, Phase 3, and this gate entirely (see Phase 1.5 above). If Phase 1.5's confirmation came back **"no"** instead, the skip was declined and review actually ran (Phase 1.5's "no" branch) — this gate runs normally, exactly as if `review` had never been `skip`.

**`review_rounds` field.** The round budget for this issue is read from `docs/issues/open/ISSUE-ID/prompt.md`'s YAML frontmatter field `review_rounds`; when the field is absent, the default is `3`. Every check below that compares "the current round" against a budget compares it against this value.

**Round number.** This skill keeps exactly one round counter: the highest `Round` value recorded anywhere in `code_review.md`'s findings ledger (Phase 3), plus 1 for a fresh review about to run — or round `1` when the ledger is empty (the first review ever run for this issue). No second, separate round counter is introduced anywhere in this skill; that would be exactly the kind of "two mechanisms for one fact" the BRD flags as a defect (the same principle behind AC-3.2's ban on a parallel `blocking:` field alongside priority).

**If Phase 3 produced `verdict: PASS`** (no open P0/P1): report the result and stop here — no `AskUserQuestion` is needed, there is nothing to resolve. State the next step: "Code review passed. Run /pf-test." This holds regardless of round number — a clean review closes the cycle even on the round equal to the budget (see Budget exhaustion immediately below).

**Budget exhaustion (AC-1.3, BR-7).** When the current round equals `review_rounds` (the budget) and at least one P0/P1 finding is still open in the ledger, this cycle has exhausted its budget: write `verdict` as not `PASS` (never `PASS` while a blocking finding remains open — Phase 3's unconditional FAIL rule above already guarantees this) and do not loop again into another round — an exhausted budget must never turn into an infinite loop of further rounds; instead, take the same path as Phase 3.5's early bail-out above: convert every remaining open P0/P1 finding into a new task appended to `implementation_plan.md`, each with a non-empty `Mapped Test Cases:` field naming the TC-ID(s) it must keep passing, and route the issue back to `/pf-execute`. When the current round equals the budget but this round's own review is clean (no open P0/P1 — the `verdict: PASS` bullet above already covers this case), the cycle closes as `PASS` regardless of round number: the budget is a trigger for escalation, never a ceiling that blocks a legitimate `PASS`.

**If Phase 3 produced `verdict: FAIL`** (at least one open P0/P1) **and the current round is below the budget** (`round < review_rounds` — once the round reaches the budget, the Budget exhaustion rule above applies instead): present the findings, then use `AskUserQuestion` with **exactly these two options — never a third "skip" option**:

**"How would you like to proceed?"**
- **Fix now** — I'll address all P0 and P1 findings and update the code. I'll ask you clarifying questions where needed.
- **I'll fix manually, then re-run /pf-codereview** — You'll edit the code yourself, then run `/pf-codereview` again to re-verify.

This is the one deliberate difference from `pf-check`'s gate: `pf-check` always keeps a third "Skip and continue" option; this skill never offers it while a P0/P1 finding is open, per the BRD's requirement that the code-review gate is genuinely blocking. Only P2-or-none resolves to `verdict: PASS` without any gate question at all.

**If "Fix now":** dispatch the fix to this stage's resolved `write` actor for `code` (`~/.claude/skills/pf-roles/SKILL.md` §4's fallback order — resolved fresh, same as Phase 2). **The fixer is not always Claude** — it is whichever actor `write` resolves to, regardless of which reviewer(s) produced the findings; Codex, in any *review* invocation form, still only ever finds problems, never fixes in that same pass, but a `code` stage whose `write` is `codex` gets its fixes from `codex`. This is a deliberate behavior change from before this issue (BRD Non-Goals — no write/review independence invariant is introduced).
- **If `write == claude`:** dispatch a fix sub-agent (Agent tool, default/general-purpose type) — same as before. Give it: PARENT-BRANCH (so it can re-derive the diff), the full P0/P1 findings list (source-tagged `[Claude]`/`[Codex]` if `both`, or `[<actor>, pass N]` if sequential), and `implementation_plan.md`/`test_plan.md` for context. Instruct it to read what it needs, use `AskUserQuestion` itself for genuinely ambiguous points, patch the diff directly, and return only a short summary of what changed.
- **If `write != claude`** (in this issue, only `codex`): use the write-invocation form from `~/.claude/skills/pf-roles/SKILL.md` §7, with the "apply these findings to an existing file" prompt form from §6 there (not the "write a document from scratch" form) — adapted to a code diff instead of a single document: the prompt names PARENT-BRANCH and the changed files instead of one target path, and includes the same P0/P1 findings list. The actor edits the repository itself (`--write`); this skill re-derives the diff afterward the same way Phase 1 always does, and reports a short summary to the user (no clarifying-question loop — a delegated actor cannot call `AskUserQuestion`).

After the fix returns, **loop**: go back to Phase 1 (recompute the diff — it has changed), re-run Phase 2 (the same resolved `review` reviewer(s)) and Phase 3 (rewrite `code_review.md`), then re-evaluate this Phase 4 gate. Repeat automatically — no need to re-ask the user to re-invoke the skill — until `verdict: PASS`. Relay each iteration's fix summary to the user as it happens.

**Round N>1 dual check (AC-1.4).** Starting with round 2 and every round after it, re-running Phase 2 in this loop must do two things together, not one instead of the other: (a) verify closure of every blocking (P0/P1) finding from the previous round's ledger rows — confirm each one's `State` cell (Phase 3's ledger) is now a terminal value, not `open`, checked directly against the ledger rather than assumed from the fixer's own summary; and (b) review the round's own diff for new problems the fix itself may have introduced. A one-sided version of this instruction — only (a), or only (b) — is exactly what let a prior round ship new P0 findings unreviewed; do not phrase this loop step as merely "re-run Phase 2" without naming both halves. Phase 2's round-2+ reviewer brief (above, in both the Claude review path and the Codex path) is what makes (a) checkable — it hands the reviewer the prior ledger and an instruction not to repeat it — and what performs (b) — its "look specifically for new problems introduced by this round's fix diff" instruction; this loop step requires that both actually happen on every round-2+ iteration, not just one of them.

**Exception — this run started from Phase 1.5's "no" branch (declined skip):** "re-run Phase 2" here means re-running the **Claude review path directly**, the same one-time override Phase 1.5 established, not re-entering Phase 2's role resolution — `prompt.md` still literally reads `roles.code.review: skip`, unconfirmed, so a fresh Phase 2 resolution would see `skip` again and the loop would silently stop reviewing on iteration 2. The `[claude]` override, once triggered by a "no" answer, holds for every iteration of this loop for the rest of this invocation; the skip-confirmation question is not re-asked within it.

**If "I'll fix manually, then re-run /pf-codereview":** confirm the choice, state that `code_review.md` currently records `verdict: FAIL`, and stop. Do not loop — the next `/pf-codereview` invocation starts a fresh Phase 0.

---

## Phase 5: Commit & Push

As the last action of this skill invocation — after the loop above (if any) has settled, whether it ends in `verdict: PASS`, `verdict: SKIPPED` (Phase 1.5), the user chose to fix manually and left `verdict: FAIL`, or Phase 3.5's round-1 early bail-out / Phase 4's budget-exhaustion path escalated back to `/pf-execute` (verdict remains `FAIL`) — run the shared commit & push procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push"). Do not restate the procedure here: it defines the push guard and the one-line git report. Stage `docs/issues/open/ISSUE-ID/code_review.md`, plus `prompt.md` if Phase 0.5's automigration or Phase 1.5's `confirmed:` write touched it this run, plus `implementation_plan.md` if Phase 3.5's early bail-out or Phase 4's budget-exhaustion path appended tasks to it this run, plus any file(s) a fix actor actually edited during this invocation's Fix-now loop (never `git add -A` — same scoped-staging rule every other `pf-*` stage follows). Commit message: `docs: code_review.md — <PASS|FAIL|SKIPPED> [<ISSUE-ID>]` (mirrors `pf-qa`'s `qa_report.md — <PASS|FAIL> [<ISSUE-ID>]` message; see `~/.claude/skills/pf-git/SKILL.md`'s Step 2 table).

---

## Important Notes

- **Do not run the test suite** — that is `/pf-test`'s job, gated on this skill's `verdict: PASS` or `verdict: SKIPPED` (see `skills/pf-test/SKILL.md`).
- **Never widen the diff to the whole working tree.** The scope is always `PARENT-BRANCH...HEAD`, computed fresh each loop iteration.
- **The severity mapping and the Codex invocation chain live in exactly one place** — `skills/pf-check/SKILL.md`. This skill references them; it never copies or re-derives them, so the two skills cannot drift apart on what P0/P1/P2 mean.
- **"Skip and continue" does not exist here, ever, while P0/P1 is open.** This is the one deliberate divergence from `pf-check`'s gate — everything else about reviewer selection, Codex fallback, and `both`-aggregation is identical. `roles.code.review: skip` (Phase 1.5) is a different mechanism entirely — a role explicitly configured (and confirmed) to skip review altogether, not a gate response chosen while findings are open.
- **The fixer is not always Claude** — it is this stage's resolved `write` actor (`~/.claude/skills/pf-roles/SKILL.md` §4), which may be `codex`. Codex, in any *review* invocation form, only ever produces findings within that same pass; it never fixes in a review pass. This is a deliberate behavior change from before this issue (BRD Non-Goals — no write/review independence invariant).
