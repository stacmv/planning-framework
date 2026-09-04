---
name: pf-close
description: Close the active issue — merge branch, archive issue folder, update session-log
version: 3.0.0
---

Determine the active issue from `docs/issues/open/`. If no issue folder is found, stop: "No active issue found. Nothing to close."

Read ISSUE-ID from the active folder name (e.g. `docs/issues/open/20260630-feat-example/` → ISSUE-ID is `20260630-feat-example`).

Extract TYPE from ISSUE-ID the same way `~/.claude/skills/pf/SKILL.md` Step 4 does (folder-name prefix); TYPE ∈ {feat, improve, bug, idea, spike}.

## Phase 0: Prerequisite Checks

Run all checks in order. Stop immediately if any check fails.

1. **QA report exists** — only when TYPE is feat, improve, or bug; skipped entirely for idea/spike (neither type ever produces `qa_report.md`). Check for `docs/issues/open/ISSUE-ID/qa_report.md`. If absent, stop: "QA report not found. Run /pf-qa first."

2. **QA verdict is PASS** — only when TYPE is feat, improve, or bug; skipped entirely for idea/spike (neither type ever produces `qa_report.md`). Read `docs/issues/open/ISSUE-ID/qa_report.md`. Locate the `## Verdict` section and find the verdict line. The verdict line is the last non-empty line that contains `**PASS**` or `**FAIL**`. If the verdict contains `**FAIL**` or no `**PASS**` line is found, stop: "QA did not pass. Fix the blockers listed in qa_report.md and re-run /pf-qa."

3. **On correct branch** — the check depends on TYPE:

   | TYPE | Check |
   |---|---|
   | feat / improve / bug | Unchanged: run `git branch --show-current`. If the result is not `issue/ISSUE-ID`, stop: "Switch to the issue branch first: `git checkout issue/ISSUE-ID`" |
   | idea | Not checked at all — the idea pipeline never creates an `issue/<id>` branch. Instead check the new condition: **`## Decision` is present in `verdict.md`**. If not, stop: "Verdict not confirmed. Run /pf-idea-verdict (decision session) first." |
   | spike | Not restricted to any particular branch — Phase 3.5 below unconditionally switches to PARENT-BRANCH before copying documents, regardless of which branch this check finds the session on (CR-005). |

4. **Run Evidence gate (spike only):**
   1. Both `hypothesis.md` and `findings.md` must be complete per `pf-size-tiers`'s "Stage completion" criterion. If not, stop: "Spike is not ready to close: <missing document>. Run /pf-idea-spike first."
   2. `findings.md`'s `## Run Evidence` section must be non-empty and not the template placeholder (`<concrete evidence of an actual run — command+output, path to an artifact, or a direct quote with its source — NOT a restatement of expectation>` from `pf-idea-spike`'s skeleton). If empty/missing/still a placeholder, stop: "findings.md's Run Evidence is empty or a template placeholder — spike close requires evidence of an actual run. Fix findings.md (or re-run /pf-idea-spike Mode 2), then re-run /pf-close."
   3. `## Result vs. Success Criterion` must reference a concrete item from `## Run Evidence` (not an empty section).

5. **Compute `has_git`.** If false (the only reachable case is an `idea` issue created in a bare, non-git folder that has never grown a project since) — set a `NO-REPO` flag for the rest of this `pf-close` run, unless Phase 4.6 later clears it (the only place a repository can appear within a single run).

   **`NO-REPO` branch (idea only):** if step 5 set `NO-REPO`, Phase 2 ("Pre-Close Cleanup"), Phase 3 ("Detect Parent Branch"), and Phase 3.5/4 (merge or spike-copy, both require git) are **skipped entirely** — proceed directly to Phase 4.6.

---

## Phase 1: Confirm with User

**Skip this entire phase for `TYPE: idea`** — the confirmed `## Decision` in `verdict.md` (already checked by Phase 0's branch check) is already the confirmation to close; asking "Proceed? (yes/no)" here would be a second confirmation for one decision session (see `pf-interaction` — one final human gate per issue). Proceed directly to Phase 2 (or, under `NO-REPO`, directly to Phase 4.6). For `TYPE: spike`, this phase is unchanged in substance — spike has no separate decision session, so this Phase 1 confirmation **is** the single final human gate — but the summary text below differs (see the `TYPE: spike` variant), and this TYPE additionally runs a branch preflight before anything else in this Phase, including before any marker write below — see "Branch preflight" immediately next (CR-021). For feat/improve/bug, unchanged **unless** `prompt.md`'s `interaction` field resolves to `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule") — see "Front-loaded final decision gate" below. Without that field (the default — absent, `interaction: interactive`, or any value other than literally `front-loaded`), this Phase is exactly the plain summary and yes/no confirmation documented next, unchanged.

**Branch preflight (`TYPE: spike` only, before anything else in this Phase — CR-021).** Two round-2 fixes conflict on the spike path otherwise: a non-Claude orchestrator's final-gate question (below, and `~/.claude/skills/pf-interaction/SKILL.md`'s Codex adapter) writes a `pf-pending-interaction` marker into `open_questions.md` as its very first act, and on an originally clean *foreign* branch that write alone makes the tree dirty — which then trips Phase 2's CR-014 guard, stopping the very close the guard exists to protect: the guard cannot tell "was already dirty" from "just became dirty because this Phase wrote a marker". Resolve the branch *before* any marker can be written, using exactly the same three outcomes CR-014's guard already distinguishes, computed here instead of left to Phase 2 — extended below (CR-026) to also cover a marker that already existed *before* this preflight ran at all, left over from an earlier, interrupted `/pf-close` attempt.

**Achievability (CR-026).** Every branch below that mentions a marker only matters when this session's orchestrator is not Claude (`orchestrator_provider != claude` — under Claude, `stage=final-gate` is never written at all, so a spike close under Claude only ever hits the four already-closed no-marker cells, Task 36). Running `/pf-close` under a Codex orchestrator is itself outside this issue's scope (BRD Non-Goals). This section is a latent-defect fix, made now purely so a future Codex-runtime issue does not inherit a contract that silently drops or reopens a confirmation — it is not something this issue's own scope exercises end-to-end.

1. **Detect and snapshot an existing marker first, before deciding anything else (CR-026).** Read `docs/issues/open/<spike-id>/open_questions.md` exactly as it is on disk right now — on whatever branch the session currently occupies, before any checkout below — the same way Phase 3.5 step 2 later reads it, for a different checkout. If its last line matches the `<!-- pf-pending-interaction: stage=final-gate ... asked=<ISO-timestamp> ... -->` marker format (`pf-interaction`'s "Pending-state — exact marker" section), save that exact line aside (in memory, or a scratch path outside `docs/issues/`) as the **carried marker**, together with its `asked` timestamp. If no such file or no such line exists here, there is no carried marker — every bullet below that mentions one simply does not apply, and this preflight behaves exactly as it did before CR-026.
2. Compute PARENT-BRANCH now, using Phase 3's steps 1-2 below (safe this early — those two steps only read git config and list local branches, they never touch the working tree). Phase 2's guard, Phase 3, and Phase 3.5 all reuse this same value for the rest of this run instead of recomputing it.
3. **Classify the working tree — "marker-only dirty" counts as clean here (CR-026).** Run `git status --porcelain`. If it is empty, the tree is clean, as before. If it is non-empty, check whether the *entire* dirt is exactly the carried marker's own trailing line in `docs/issues/open/<spike-id>/open_questions.md` — i.e. `git status --porcelain` names that one path and no other, and `git diff -- docs/issues/open/<spike-id>/open_questions.md` touches only its last line (no other line added, removed, or changed). When that holds, treat the tree as **marker-only dirty** below — it behaves exactly like "clean", never like "dirty", in step 4's branch decision. A tree with any other uncommitted content, marker or not, is ordinary dirty, unchanged from before CR-026.
4. Run `git branch --show-current`:
   - **`issue/<spike-id>` (when that branch exists) or PARENT-BRANCH itself** — no action; proceed with the rest of this Phase exactly where the session already is. Whatever this Phase writes or dirties here is safe per Phase 2's existing guard (a cleanup commit on either branch is harmless — see Phase 2 below). A carried marker, if any, is untouched — still sitting on the branch the session is already on — and is picked up by `pf-interaction`'s ordinary "Safe resumption" rule (re-show the pending question at its recorded `step` before asking anything new) the moment this Phase's final-gate logic runs below; nothing extra to do here.
   - **Any other branch, clean or marker-only dirty, no carried marker** — run `git checkout PARENT-BRANCH` now, before continuing with the rest of this Phase. Nothing is lost (the tree was clean), and every write this Phase makes from here on — including a non-Claude marker write — lands on PARENT-BRANCH instead of a branch this issue has no business touching.
   - **Any other branch, clean or marker-only dirty, carried marker present (CR-026 — the two previously unclosed cells, "чистая посторонняя + маркер" and "грязная посторонняя + маркер-only").** A plain checkout, as the bullet above does, would strand the marker on this foreign branch: Phase 3.5 below only ever pulls `docs/issues/open/<spike-id>` back from `issue/<spike-id>`, never from an arbitrary foreign branch, so a marker left behind here is never recovered — silently losing the open confirmation. Instead:
     a. If the tree is marker-only dirty rather than already clean, discard just that one file's uncommitted edit — `git checkout -- docs/issues/open/<spike-id>/open_questions.md` — safe, because its exact content is already saved as the carried marker in step 1; nothing is lost by discarding the working-tree copy. The tree is now genuinely clean.
     b. Run `git checkout PARENT-BRANCH`, exactly as the bullet above.
     c. Apply the carried marker onto PARENT-BRANCH's own copy of `docs/issues/open/<spike-id>/open_questions.md`: create the file first if it does not exist there yet (the same atomic create-before-write CR-018 already establishes for this same file elsewhere — `~/.claude/skills/pf-interaction/SKILL.md`'s "Pending-state" section); if it exists and its last line already matches a `stage=final-gate` marker, reconcile by the same "keep only the more recent `asked` timestamp, never a blind append" rule Phase 3.5 step 3 uses below (reused here by reference, not restated); otherwise append the carried marker as the file's new last line. This is a plain, uncommitted working-tree write — Phase 2's `git add -A` + cleanup commit (now running on PARENT-BRANCH, a recognized branch) picks it up normally.
     d. Continue with the rest of this Phase exactly as the own-branch bullet above — `pf-interaction`'s "Safe resumption" rule finds the marker on PARENT-BRANCH and resumes it before anything else is asked. This is what "возобновить прежде любого другого действия" (CR-026) means in practice: no stop, no fresh question.
   - **Any other branch, ordinary dirty (not marker-only)** — stop here, before showing any confirmation or writing any marker: "Uncommitted changes on <branch>, which is neither issue/<spike-id> nor the parent branch (<PARENT-BRANCH>). This branch is unrelated to the spike being closed. Commit or stash these changes yourself, switch to issue/<spike-id> (if it exists) or <PARENT-BRANCH>, then re-run /pf-close." (Same message CR-014's guard already used for this exact case — this preflight now catches it one phase earlier, before anything can be written at all.) A carried marker, if step 1 found one, is not lost by this stop — it sits on disk exactly where it was, untouched, and the next `/pf-close` re-run's own step 1 re-detects it fresh.

**All eight cells, "branch × marker present", stated explicitly (CR-026):**

| Branch | No marker | Marker present |
|---|---|---|
| `issue/<spike-id>` | no action (Task 36) | no action; resumed in place by `pf-interaction`'s "Safe resumption" |
| PARENT-BRANCH itself | no action (Task 36) | no action; resumed in place by `pf-interaction`'s "Safe resumption" |
| foreign, clean | checkout PARENT-BRANCH (Task 36) | checkout PARENT-BRANCH, carried marker applied onto it (step 4, bullet 3 above) |
| foreign, dirty | stop (Task 36) | marker-only dirt: same as "foreign, clean" row above, never stops; dirt beyond the marker: stop, marker preserved on disk for the re-run |

In no cell is a confirmation lost, silently overwritten, or left blocking the close: the four left-column cells were already closed by Task 36; the two right-column own-branch cells were never broken (nothing moves, so nothing can strand the marker); the two right-column foreign-branch cells are what this task closes.

Under normal flow, by the time the rest of this Phase runs — including any final-gate marker write — the current branch is always `issue/<spike-id>` or PARENT-BRANCH, so Phase 2's CR-014 guard never fires for spike anymore; it remains unchanged below as defense-in-depth (e.g. a session resuming mid-Phase-1 through some path that skipped this preflight). A carried marker (step 1 above) is not something Phase 2's guard needs to know about separately: if the preflight ran, the marker is already resolved into one of the rows above before Phase 2 is ever reached; if the preflight was skipped and Phase 2's guard stops on a genuinely foreign branch, nothing on disk has been touched, so no marker is lost there either — the guard remains unchanged below not because it is still expected to trigger, but because its own stop is already marker-safe by construction.

**Front-loaded final decision gate (feat/improve/bug only, AC-12d).** If `prompt.md`'s `interaction` field resolves to `front-loaded`, this Phase is this issue's one final human gate — the same role the decision session plays for `idea`/`spike` (`~/.claude/skills/pf-interaction/SKILL.md`, "One final human gate per issue — not two"). Before showing the plain summary below, extend it instead of replacing it:

1. **Show the full ledger first.** Read `open_questions.md` (it may not exist — see below) and print every `[assumed]` row and every `unverified-fact` row recorded across every stage this issue ran through, one batch, the same shape as `pf-idea-verdict`'s decision session batch (its "1. One batch" section): each row legible on its own — `<question> → <assumed answer> — <why> (#<N>)` for `assumed` rows, the same format minus the assumed answer for `unverified-fact` rows — not merely a count. If `open_questions.md` does not exist for this issue (no hook site ever needed it), show an empty ledger, not an error — the same lazy-creation rule that already governs this file for `idea`/`spike`.
2. **Then show today's ordinary summary** (the "Ready to close ISSUE-ID... " block below, merge/archive/usage/session-log bullets) — after the ledger, not instead of it.
3. **Offer three responses instead of the plain yes/no:**
   - **Proceed** — close as-is, every assumption stands; continue to Phase 2 exactly as today.
   - **Override an assumption** — pick one `open_questions.md` row with `Status: assumed` and give a new answer. Regenerate only the sections its `Used in` field names, and invalidate/re-check the rest of this issue's own document tail (this issue's own pipeline order — e.g. `brd.md → specs.md → test_plan.md → implementation_plan.md` [+ code, where applicable] — the same "canonical pipeline order, invalidate the whole tail" discipline `pf-idea-verdict`'s "2. Override" section already documents for `idea`, reused here by reference, not restated). Re-run `/pf-check` on every document this invalidated before this gate can be shown again (same `[pf-check OPEN]` marker mechanism), then return to step 1 above with the refreshed ledger.
   - **Stop** — cancel close, same as today's "no".

   When this session's own orchestrator is not Claude
   (`orchestrator_provider != claude` — `~/.claude/skills/pf-interaction/SKILL.md`'s
   "Codex text-REPL adapter" defines the flag; independent of any role's
   resolved `write` actor), replace this three-option prompt with that
   adapter — same options, same pending-state discipline.

   **This substitution also covers `TYPE: spike`**, despite this block's
   heading (AC-12d is a feat/improve/bug-specific acceptance criterion):
   spike's Phase 1 confirmation is a different shape — the plain summary +
   yes/no confirmation below, with the `TYPE: spike` variant text, unchanged
   in substance per US-09e (it does **not** inherit this three-option
   prompt) — but it is likewise this issue's single final human gate
   (`~/.claude/skills/pf-interaction/SKILL.md`, "One final human gate per
   issue"), so it is asked via this same adapter (`stage=final-gate`)
   whenever `orchestrator_provider != claude`, on the same basis as this
   step's own substitution above.
4. **A confirmed Proceed is this issue's recorded final confirmation** — proceed with Phase 2 onward exactly as today.

Show the following summary and wait for explicit user confirmation before proceeding (front-loaded issues show this after the ledger above, as step 2; issues without `interaction: front-loaded` show only this, as today):

```
Ready to close ISSUE-ID.

This will:
  • Commit any uncommitted changes on the issue branch
  • Detect parent branch (from git config or fallback to develop/main)
  • Merge issue/ISSUE-ID into <parent-branch> with --no-ff
  • Transfer the issue's Manual test cases into docs/planning/test-plan.md
  • Move docs/issues/open/ISSUE-ID/ → docs/issues/closed/ISSUE-ID/
  • Record LLM usage/cost in docs/issues/closed/ISSUE-ID/usage_report.md
  • Append a closure entry to docs/planning/session-log.md
  • Commit the archive changes

Proceed? (yes/no)
```

**`TYPE: spike` variant** — replace the "Merge issue/ISSUE-ID into <parent-branch> with --no-ff" line with: "Copy docs/issues/open/ISSUE-ID/ from issue/ISSUE-ID to <parent-branch> — code stays on issue/ISSUE-ID, never merged or deleted". The rest of the summary is unchanged.

**Front-loaded issues (`interaction: front-loaded`):** the closing "Proceed? (yes/no)" line above is replaced by the three-option prompt from step 3 above (Proceed / Override an assumption / Stop) — do not ask plain yes/no on top of it, this is the same single confirmation, not a second one.

If the user does not confirm (answers no or anything other than yes — or, for a front-loaded issue, chooses Stop), stop: "Close cancelled. No changes made."

To resume:
1. Make whatever changes prompted you to answer no.
2. Re-run `/pf-close` when you are ready to close this issue.

---

## Phase 2: Pre-Close Cleanup

Run on the issue branch. **`TYPE: spike` is the exception** — Phase 0 places no restriction on which branch a spike close starts from, so this phase adds a branch guard for it (see step 2 below) before committing anything.

1. Run `git status --porcelain`.
2. If the output is non-empty (uncommitted changes exist):
   - **`TYPE: spike` only — verify the branch first (CR-014; defense-in-depth under Phase 1's preflight — CR-021).** Reuse PARENT-BRANCH already computed by Phase 1's branch preflight above (CR-021) — do not recompute it (Phase 1 now computes it unconditionally for spike, the same value Phase 3 and Phase 3.5 also reuse). Run `git branch --show-current`:
     - If it is `issue/<spike-id>` (when that branch exists) or PARENT-BRANCH itself, continue to the `git add -A` step below — a cleanup commit landing on either is harmless: `issue/<spike-id>` is never merged or deleted, so nothing committed there is ever lost, and PARENT-BRANCH is the correct final home anyway.
     - Otherwise the working tree is dirty on a branch that is neither the spike's own branch nor the parent — **stop**, do not run `git add -A`: "Uncommitted changes on <branch>, which is neither issue/<spike-id> nor the parent branch (<PARENT-BRANCH>). This branch is unrelated to the spike being closed. Commit or stash these changes yourself, switch to issue/<spike-id> (if it exists) or <PARENT-BRANCH>, then re-run /pf-close." Without this guard, Phase 3.5 below would unconditionally switch to PARENT-BRANCH and never revisit this branch again, permanently stranding a `chore: pre-close cleanup` commit on it — the bug CR-014 fixed. **Under normal flow this branch of the guard is unreachable** — Phase 1's preflight (CR-021) already redirected a clean foreign branch to PARENT-BRANCH and stopped on a dirty one before this Phase could even be reached. It stays here as a safety net for any path that reaches Phase 2 without having gone through that preflight.
   - Run `git add -A`
   - Run `git commit -m "chore: pre-close cleanup [ISSUE-ID]"`
3. If the output is empty, skip — nothing to commit.

Proceed to Phase 3.

---

## Phase 3: Detect Parent Branch

**`TYPE: spike` only:** Phase 1's branch preflight (CR-021) already computed PARENT-BRANCH unconditionally, earlier in this same run — reuse that value and proceed straight to Phase 3.5 below, without recomputing steps 1-2 (step 3 below is `TYPE: idea` only and never applies to spike anyway). For every other TYPE, compute it here as usual:

1. Run `git config branch.issue/ISSUE-ID.merge`. **Self-tracking upstream guard:** if the result is empty, the command fails, or the result equals `refs/heads/issue/ISSUE-ID` itself (a self-tracking upstream set by `git push -u` on the issue branch, never a parent), ignore it and fall through to step 2. Otherwise extract the branch name (strip the `refs/heads/` prefix) and use that as PARENT-BRANCH.
2. Fallback (the git-config value was ignored or unavailable):
   - Run `git branch --list develop`. If `develop` is listed, set PARENT-BRANCH to `develop`.
   - Otherwise set PARENT-BRANCH to `main`.
3. **`TYPE: idea` only (no `NO-REPO`):** run `git checkout PARENT-BRANCH` right here — the same checkout Phase 4's step 1 does for feat/improve/bug, but with no following `git merge` (idea never merges anything). This puts the branch idea will be archived from into the right state for Phase 5 (`mv`) and Phase 8 (archive commit). (`TYPE: spike` gets its own checkout as part of Phase 3.5 below — no duplicate step needed here.)

For feat/improve/bug: Proceed to Phase 4. For `TYPE: spike`: Proceed to Phase 3.5. For `TYPE: idea`: Proceed to Phase 4.5 (Phase 3.5 and Phase 4 do not apply to idea — idea never merges).

---

## Phase 3.5: Copy Issue Documents (spike only, requires git)

**Applies only to `TYPE: spike`** (`NO-REPO` is unreachable for spike — see Phase 0's type table). Runs between Phase 3 and Phase 4, and **replaces Phase 4 entirely** for this TYPE — do not also run Phase 4 for a spike.

1. Switch to PARENT-BRANCH (already determined by Phase 1's branch preflight for `TYPE: spike` — CR-021 — reused here, never recomputed) **unconditionally**, **without** `git merge` — regardless of which branch the session currently occupies (PARENT-BRANCH itself, `issue/<spike-id>`, or any other branch). This guarantees the copy in step 3 below, the archive in Phase 5, and the commit in Phase 8 all land on PARENT-BRANCH even when `/pf-close` was invoked from a foreign branch (CR-005) — never on whatever branch the session happened to be standing on.
2. **Snapshot the final-gate marker before copying (CR-021).** Phase 1's final-gate confirmation, whenever this session's orchestrator is not Claude (`~/.claude/skills/pf-interaction/SKILL.md`'s Codex adapter, `stage=final-gate`), lives in a `pf-pending-interaction` marker line appended as the last line of `docs/issues/open/<spike-id>/open_questions.md`. Step 3 below is about to replace that whole file with whatever version exists on `issue/<spike-id>` — which may predate this close entirely, carry an unrelated leftover marker from an earlier, separate close attempt, or simply carry no such line at all. Before running step 3: if `docs/issues/open/<spike-id>/open_questions.md` exists on the current branch (PARENT-BRANCH, per step 1) and its last line matches the `<!-- pf-pending-interaction: stage=final-gate ... asked=<ISO-timestamp> ... -->` marker format (`pf-interaction`'s "Pending-state — exact marker" section), save that exact line aside (in memory, or a scratch path outside `docs/issues/`), together with its `asked` timestamp. If no such file or no such line exists here, there is nothing to protect — proceed straight to step 3. **This is frequently this run's own resolved marker (CR-026):** when Phase 1's branch preflight above hit the "carried marker present" cell, its step c already wrote the carried marker onto this same PARENT-BRANCH copy of the file, possibly already resolved by the time Phase 1's final-gate logic finished running — this snapshot step is what carries that same-run resolution into the reconciliation below, distinct from — and prioritized over, see step 3's reconcile logic — a merely older leftover marker.
3. If the branch `issue/<spike-id>` exists (check with `git branch --list`), run `git checkout issue/<spike-id> -- docs/issues/open/<spike-id>`. This copies only the issue folder's contents from the spike branch onto the current branch (PARENT-BRANCH), touching nothing outside that folder. This is a staged change, not a commit — it is committed by the ordinary Phase 8.

   **Reconcile the marker by timestamp, never by blind append (CR-021) — except a same-run resolution always wins outright (CR-026).** This is not simply "restore what step 2 saved" — the checkout can just as easily bring in a *fresher* marker than the one saved (this run's own Phase 1 confirmation may have happened on `issue/<spike-id>` itself, when Phase 1's branch preflight left the session there, in which case the checkout is what carries it forward, and step 2's snapshot — if it found anything at all — is necessarily older, leftover history from an unrelated earlier attempt). Never keep both: `pf-interaction`'s marker contract is "at most one open marker per interactive point... replaces it in place, never duplicates it", so this reconciliation must always end with exactly one trailing `stage=final-gate` line, not two.
   - If step 2 saved nothing, leave the checked-out file exactly as the checkout wrote it — nothing to reconcile.
   - **If the line step 2 saved is this same run's own resolution (CR-026)** — this same `/pf-close` execution is what wrote it, whether via Phase 1's branch preflight carrying it onto PARENT-BRANCH and resuming it there (Phase 1, "carried marker present", step c-d above), or via Phase 1's final-gate logic resolving it directly while already standing on PARENT-BRANCH (the "own-branch, PARENT-BRANCH itself" cell) — **keep the saved line as the file's trailing line unconditionally, overwriting whatever the checkout just brought in, regardless of either marker's `asked` timestamp.** Do not fall through to the timestamp comparison below in this case: a checked-out line for the same interactive point, even a technically fresher `status=open` one, cannot be a legitimate later event than a resolution this very run just produced in front of the user running it — treating it as "fresher" would silently reopen a question this run's own operator already answered, which is exactly the failure CR-026 fixes. (Distinguishing this case from ordinary leftover history is not a text-matching exercise — the session already knows, from having executed Phase 1 itself earlier in this same run, whether it is the one that produced this resolution.)
   - **Otherwise** (step 2 saved a line, but it is leftover history — a `status=open` marker never resolved by this run, or a `status=resolved` line this run did not itself produce, from an unrelated earlier close attempt) — look at the just-checked-out `open_questions.md`'s last line:
     - If it does **not** match the `stage=final-gate` marker format at all (missing, or the checkout brought a version with no marker), append the saved line back as the file's last line — the same trailing-line placement `pf-interaction` already specifies, never as a table row.
     - If it **does** match, compare the two markers' `asked` timestamps and keep only the more recent one as the file's trailing line: if the saved line's `asked` is later, overwrite the checked-out trailing line with the saved line (replace, not append); if the checked-out line's `asked` is equal to or later than the saved one, leave the checked-out line exactly as it is — it already reflects the newer confirmation, and re-appending the older saved line would create a second marker and mislead a future resumption into re-asking an already-resolved question.

   Every other file, and every other line of `open_questions.md`, is left exactly as the checkout wrote it — only this one trailing marker line is ever touched, and it is always resolved to a single line, never two.
4. If the branch does not exist (the experiment never required code), skip step 3 — the documents are already on PARENT-BRANCH, and step 2's snapshot (if any) was never at risk in the first place.
5. The `issue/<spike-id>` branch, if it exists, is **never merged and never deleted** — not here, and not anywhere else in `pf-close`. Nothing in this file should run `git merge issue/<spike-id>` or `git branch -d issue/<spike-id>`.

Proceed to Phase 4.5.

---

## Phase 4: Merge

**Applies only to `TYPE: feat`, `improve`, or `bug`.** `TYPE: spike` uses Phase 3.5 above instead; `TYPE: idea` does not merge at all (see the checkout step Phase 3 adds for idea).

1. Run `git checkout PARENT-BRANCH`.
2. Run `git merge --no-ff issue/ISSUE-ID -m "merge: close ISSUE-ID"`.
3. If the merge reports a conflict, stop: "Merge conflict detected. Resolve conflicts, then re-run /pf-close."

   **Recovering from a merge conflict:**
   1. Run `git status` to list the conflicting files.
   2. Open each conflicting file and resolve its conflict markers.
   3. Run `git add <file>` for each file you resolved.
   4. Run `git commit` to complete the merge.
   5. Re-run `/pf-close`. It proceeds normally from Phase 0.

---

## Phase 4.5

Skip this entire phase for `TYPE: idea` or `TYPE: spike` — neither type ever produces a `test_plan.md`; reading a non-existent Status Tracker would incorrectly trigger the "no Status Tracker table found at all" stop-and-surface rule in step 2 below. For `TYPE: idea` under `NO-REPO`, this phase is reached directly from Phase 0 (Phases 2/3/3.5/4 all skipped) and is skipped in turn, proceeding to Phase 4.6.

Runs after Phase 4 (Merge) and before Phase 5 (Archive Issue Folder), while `docs/issues/open/ISSUE-ID/` still exists. This ordering is required: `/pf-close` resolves the active issue by scanning `docs/issues/open/` alone (see the top of this file). If this phase fails after Phase 5 has already moved the issue folder to `docs/issues/closed/`, a re-run of `/pf-close` reports "No active issue found" and the issue's Manual test cases are lost with no way to recover them. Placed before archiving instead, a failure here leaves the issue folder in `docs/issues/open/`, so the issue is still discoverable and nothing is lost.

**Recovering from a failure inside this phase.** By the time this phase runs, Phase 4 has already checked out PARENT-BRANCH and merged, so a failure here leaves you **on PARENT-BRANCH** with a modified-but-uncommitted `docs/planning/test-plan.md`. A re-run of `/pf-close` does not resume by itself — Phase 0's third check requires the current branch to be `issue/ISSUE-ID` and stops with "Switch to the issue branch first". Recover in this order, and **discard the partial write first — do not try to preserve it**:

1. **Throw the partial write away.** On PARENT-BRANCH, restore the file from the last commit: `git checkout -- docs/planning/test-plan.md`. If this phase had just created the file in this same run so it is still untracked (`git checkout --` then fails with "pathspec did not match"), delete it instead: `rm docs/planning/test-plan.md`. Nothing is lost either way — the rows are re-derived from the issue's own `test_plan.md`, which is the source of truth, and rows promoted by *previous* issues are in the committed version of the file, untouched.
2. `git checkout issue/ISSUE-ID`.
3. Re-run `/pf-close`. It proceeds normally from Phase 0.

**Why discarding is required and not merely tidier.** Keeping the partial write costs you two distinct things, both measured — the first blocks the recovery outright, the second quietly damages history even when the recovery completes:

- **Step 2 aborts outright** when the issue branch was cut before `docs/planning/test-plan.md` existed on PARENT-BRANCH — a very common shape, since every branch older than the file lacks it. Switching would have to delete a file that has local modifications, so git refuses: `error: Your local changes to the following files would be overwritten by checkout: docs/planning/test-plan.md … Aborting`, exit 1. The documented recovery would simply not be executable for those branches.
- **A half-written row is committed into the issue branch's history** even where the checkout does succeed. A preserved partial write makes Phase 2 commit it as `chore: pre-close cleanup [ISSUE-ID]` on the issue branch, so whatever the interrupted run had managed to write — possibly a row truncated mid-line — becomes a permanent commit, and the branch gains a commit it never did any work for. Phase 4's re-run then creates a **second** merge commit instead of a no-op. There is nothing to gain in exchange: this phase re-derives every row from the issue's own `test_plan.md` on the next run, so the preserved text is never read.

  **This no longer corrupts `Area`** — step 5 keys on the *first* merge that brought the issue in, not on `HEAD`, precisely so that a second merge cannot change the file set it measures — whether that second merge comes from this recovery path or from the operator committing a `test_plan.md` fix under the stop-and-surface rule of the main procedure below. (That rule lives in the numbered procedure that starts after this block; it is not the `git checkout issue/ISSUE-ID` step numbered 2 just above.) Earlier revisions of this phase did compute `Area` from `HEAD`'s parents and did produce a meaningless value here; that is fixed, and this bullet is kept only to explain why discarding is still the right move.

Discarding avoids both: the tree stays clean, Phase 2 has nothing to commit, and Phase 4's re-merge really is `Already up to date` with `HEAD` still pointing at the original merge commit.

Re-running is safe: no row is duplicated, because identity is the pair (`ISSUE-ID`, `TC-NNN`) (step 3 below) and the number is the maximum of the counter and the table plus one (step 4 below).

1. **Ensure `docs/planning/test-plan.md` exists — do this first, before selecting anything.** If it does not exist, create it by copying `docs/planning/templates/global/test-plan.md`. If that template is also missing (an older project that has never been converged), write the file inline with exactly this content instead:

   ```markdown
   # Manual Test Plan

   Ручные тест-кейсы продукта. Автотесты — `make test`.
   Прогон перед релизом: пройти строки со статусом `pending`, начиная с `Critical`.

   Last allocated: none

   | PTC | Area | Test case | Prio | Origin | Last run | Status |
   | --- | --- | --- | --- | --- | --- | --- |
   ```

   **This step runs unconditionally, even when the issue turns out to have no `Manual` rows at all.** It is deliberately ordered before selection because Phase 8's `git add` names `docs/planning/test-plan.md` unconditionally, and `git add` with a single non-existent pathspec exits 128 and stages **nothing at all** — not even the other paths on the same command line. Creating the file only when a row is promoted would therefore break the archive commit of every issue whose test plan is `Auto`-only, leaving the issue moved on disk but never committed. Measured: `git add docs/issues/ docs/planning/session-log.md docs/planning/test-plan.md` with the last path absent → `fatal: pathspec ... did not match any files`, exit 128, empty index.

2. Read `docs/issues/open/ISSUE-ID/test_plan.md`'s Status Tracker table and select only the rows whose `Type` is `Manual`. Rows with `Type: Auto` are never promoted — skip them entirely, including every one of their fields. If the table exists and contains no `Manual` rows, this phase has nothing more to do; proceed to Phase 5 (the file from step 1 stays, empty table and all).

   **Columns are resolved by header name, not by position.** Locate the columns literally named `Type`, `Test Case`, `Priority`, and `Status` in the table's header row, wherever they appear. The repo's own template (`docs/planning/templates/issue/test_plan.md`) orders columns `TC | Type | Test Case | Priority | Status | Remarks`, while the `pf-test-plan` skill generates `TC | Test Case | Type | Priority | Status | Remarks` — both orders exist in real issues and disagree with each other. A parser that reads a fixed column position instead of the header name reads the case title as the `Type` on one of the two orders and promotes nothing.

   **Stop and surface anything you cannot classify — never drop a row silently.** Three malformed inputs are indistinguishable from a legitimate "nothing to promote" if you just skip them, and each one silently discards a manual test case, which is precisely the loss this whole phase exists to prevent. In every one of these cases, **stop and report the problem to the user instead of proceeding to Phase 5**:

   - a row whose `Type` is neither `Manual` nor `Auto` (an empty cell, a different casing like `manual`, or a decorated value like `Manual (blocked)`) — do not treat it as `Auto` by default; a `Critical` manual case must not vanish over a typo;
   - no Status Tracker table found at all (the section is missing, renamed, or its header row does not carry the columns named above) — this is not the same as a table with no `Manual` rows, and must not be reported as such;
   - a selected `Manual` row whose `Test Case` cell is empty — an empty title cannot be made self-contained (see the rule below) and would land in a human-readable checklist as a blank line.

   **When you stop here, say what the operator has to do — the fix is not on the branch they are standing on.** Phase 4 has already merged and switched to PARENT-BRANCH, so the offending `docs/issues/open/ISSUE-ID/test_plan.md` is not what is in front of them. Report the concrete defect (which row, which cell, what is wrong with it) and tell them to: follow "Recovering from a failure inside this phase" above (discard the partial write, `git checkout issue/ISSUE-ID`), **fix the offending row in `test_plan.md` on the issue branch, commit it**, and only then re-run `/pf-close`. Without the fix step spelled out, a re-run simply stops at the same row again — the loop is not obvious from the stop message alone.

3. For each selected `Manual` row not already present in the list, append a row. Identity for "already present" is the pair (`ISSUE-ID`, `TC-NNN`) — never the case title: two `Manual` cases in the same issue may share a title and must still get separate `PTC` numbers and separate rows.

   | Issue field | → | List field |
   |---|---|---|
   | case title | → | `Test case` (see self-containedness rule below) |
   | `Priority` | → | `Prio` (see normalization below) |
   | `Status` `[ ]` / `✓` / `✗` | → | `Status` `pending` / `✓` / `✗` |
   | ISSUE-ID + TC-NNN | → | `Origin`, formatted `ISSUE-ID#TC-NNN` (not a filesystem path) |
   | the issue's closing date, when `Status` is not `pending` | → | `Last run` (`—` when `pending`) |
   | — | → | `PTC` (see numbering below) |
   | — | → | `Area` (see below) |

   **Priority normalization.** `Critical`→`Critical`, `High`→`High`, `Medium`→`Med`, `Low`→`Low`. Any value outside this dictionary is normalized to `Med`, and the original value is noted in `Test case` so a closed dictionary doesn't silently swallow an unrecognized priority.

   **Self-containedness.** If a case title only reads in the context of the issue (e.g. "Verify step 3"), expand it into a self-contained phrase when transferring it. Titles that already stand alone are transferred verbatim.

   **Escaping.** Any `|` inside `Area`, `Test case`, or `Origin` is written as `\|` when the row is written. Each cell stays a single line.

4. **PTC numbering.** The next `PTC` number is the maximum of (a) the number in the `Last allocated:` line and (b) the highest `PTC` number already in the table, plus one.

   **If the `Last allocated:` line is missing entirely, recreate it** — do not stop, and do not skip updating it. `BR-4` allows this file to be hand-edited, so the line can simply have been deleted. It is reconstructible: treat the missing counter as `none` (i.e. `0`) for the arithmetic above, which leaves the table's own highest `PTC` as the effective maximum, then write the line back above the table in the form below. Silently proceeding without it is the failure to avoid: a `sed`-style in-place substitution on a file that has no such line succeeds with exit 0 and changes nothing, so the counter would vanish while the row still gets written.

   **Write it as `PTC-` followed by exactly four digits, zero-padded** — `PTC-0001`, never a bare `1` and never `PTC-1`. This applies to both the `PTC` cell of the new row and the `Last allocated:` line. A fresh list starts at `Last allocated: none`, which counts as **0** for the arithmetic above, so the first number ever allocated is `PTC-0001`. Stating the written form here is not redundant with the arithmetic: a real close of a fresh list, run against an earlier revision of this phase that specified only "maximum … plus one", produced the row `| 1 | general | … |` and the counter `Last allocated: 1` — arithmetically right, and rejected by the project's own format validator, which requires exactly four digits. Both sources matter: the `Last allocated:` counter still remembers a number whose row was later deleted by hand (e.g. a `retired` row removed manually), while the table still remembers rows written by a previous run that was interrupted before it could update the counter. After writing the new row(s), update `Last allocated:` to the new highest number.

5. **Area.** Derive it from the file list of **the first merge commit that brought this issue into PARENT-BRANCH**, not from whatever `HEAD` happens to be:

   ```
   MERGE=$(git log --merges --format=%H --grep "merge: close ISSUE-ID" PARENT-BRANCH | tail -1)
   git diff --name-only "$MERGE^1" "$MERGE^2"
   ```

   `git log` lists newest first, so `tail -1` picks the **earliest** such merge. On a clean run that merge is `HEAD` itself — the fresh commit Phase 4 just made — so this is exactly `git diff --name-only HEAD^1 HEAD^2` and nothing changes.

   **Why not just `HEAD^1 HEAD^2`.** A retry can put a *second* merge on PARENT-BRANCH, and then `HEAD`'s parents no longer describe the issue's file set. This is reachable through the stop-and-surface rule in step 2: it tells the operator to fix the offending row in `test_plan.md` **on the issue branch and commit it**, which gives the branch a new commit, so Phase 4's re-run really does merge again. `HEAD^1 HEAD^2` then contains nothing but that one `docs/issues/…/test_plan.md` fix — which the exclusion below drops — leaving `Area: general` for every promoted row instead of the issue's real subsystem. Measured on a throwaway repo: naive form → `docs/issues/open/ISS/test_plan.md` only (→ `general`); first-merge form → that plus `skills/pf-close/SKILL.md` (→ `pf-close`). Keying on the first merge is stateless and needs no reset of the parent branch.

   **Do not use the three-dot form** `git diff --name-only PARENT-BRANCH...issue/ISSUE-ID` — after Phase 4's `--no-ff` merge, the merge-base of the two branches has become the tip of `issue/ISSUE-ID` itself, so a three-dot diff at this point always returns an empty file list (measured on a real close: 0 files vs. 15 files for the `HEAD^1 HEAD^2` form on the same repository state). Exclude any paths under `docs/issues/`, **plus exactly these four bookkeeping files and no others**: `docs/planning/session-log.md`, `docs/planning/decisions.md`, `docs/planning/implementation-plan.md`, and `docs/planning/test-plan.md`. None of the four describes a product subsystem, and excluding them keeps a row from being labelled the meaningless `Area: docs` when the merge diff happens to contain nothing else.

   **The exclusion is that named list — not a glob, and not the directory.** Two ways of over-reaching are both wrong here:
   - `docs/planning/*.md` would also swallow real documentation that lives at the same level — in this repository `FRAMEWORK.md`, `QUICKSTART.md`, `MIGRATION-GUIDE-V3.md` and `v2.0-design-analysis.md`. An issue whose whole change is rewriting `FRAMEWORK.md` would then get `Area: general`, which is precisely the meaningless value the exclusion exists to prevent.
   - Excluding the `docs/planning/` tree would additionally swallow `docs/planning/templates/`, which holds real product artifacts of this framework — the issue that added `docs/planning/templates/global/test-plan.md` did product work there. **Subdirectories of `docs/planning/` are never excluded.**

   Of the remaining paths, take the second path segment for anything under `skills/` or `tools/` (e.g. `skills/pf-close/…` → `pf-close`), and the first segment for everything else (e.g. `scripts/…` → `scripts`). The segment with the most files wins; if nothing remains after the exclusions, use `general`.

6. Leave the updated `docs/planning/test-plan.md` in the working tree — it is committed on Phase 8, whose `git add` now includes this path.

---

## Phase 4.6: Bootstrap + Follow-up Issue (idea only, before archiving)

**Applies only to `TYPE: idea`.** Runs between Phase 4.5 and Phase 5 — **before** archiving, not after, following the same principle that already justifies today's Phase 4.5 ordering: a failure here must leave the idea folder still in `docs/issues/open/`, discoverable, not lost inside `closed/`.

1. Read the confirmed verdict from `docs/issues/open/ISSUE-ID/verdict.md`'s `## Decision` section. The issue has **not** been moved to `closed/` yet at this point.
2. **`defer` or `archive`:** this phase is a no-op. Do not touch `has_git`/`NO-REPO`, do not create anything. Proceed to Phase 5.
3. **`project` or `spike-first`** (both verdicts go through the identical bootstrap below — a `spike-first` idea born in a bare folder gets exactly the same repository/scaffold as a `project` idea, so the resulting spike is always git-backed):
   a. Compute, **separately**:
      - `has_git` — as usual (`git rev-parse --is-inside-work-tree`).
      - `has_full_scaffold` := `PLANNING.md` exists in CWD. **Not** the `has_pf` disjunction (`PLANNING.md` OR `docs/issues/` OR `.pf-version`) used elsewhere in the framework — that disjunction is already true for a bare idea folder purely because `docs/issues/open/` exists, even though no scaffold exists at all.
   b. If `!has_git` — run `git init`.
   c. If `!has_full_scaffold` — expand the scaffold: the same procedure as `~/.claude/skills/pf/SKILL.md` Step 0's "A project, right away" branch, steps 2 and 4-7 (create `docs/issues/{open,closed}/` and `docs/planning/` where they don't already exist — for an idea already living inside a project they exist; write `.pf-version`; copy `PLANNING.md`/`CLAUDE.md`; copy `docs/planning/*.md` without overwriting anything that exists; mirror `docs/planning/templates/`). That procedure's step 1 (`git init`) and step 3 (`.pf-version`) are already covered by b/this step; its steps 8-9 (skip shim reinstall, "no issue folders found" flow) do not apply here — this phase leads into follow-up issue creation below, never into intake.
   d. **PARENT-BRANCH.**
      - If Phase 3 already computed it during this run (the "idea inside an existing project" case — `NO-REPO` was never set) — reuse that same value, including the checkout that Phase 3's added step already performed.
      - If Phase 3 was skipped (the bare-folder case — `NO-REPO` was set by Phase 0) — PARENT-BRANCH := the branch the session is on immediately after step b's `git init` (`git branch --show-current`). Do not fall back to Phase 3's develop/main detection — there is nothing to compare against, since `git init` has only just created this one branch.
   e. **Atomic initial scaffold commit — only if step b or step c actually did something in this run** (idempotency: a re-run after a partial failure must neither fail nor create an empty commit when the repository/scaffold is already in place):
      `git add PLANNING.md CLAUDE.md .pf-version docs/planning` (scoped — **not** `-A`, and **not** `docs/issues/`, which is committed separately by the ordinary Phase 8) and
      `git commit -m "chore: bootstrap PF scaffold for ISSUE-ID (verdict: <verdict>)"`.
   f. Clear `NO-REPO` (guaranteed false from this point on for `project`/`spike-first` — the flag matters, per "Non-git guard (`NO-REPO`) across Phase 5-9" in Important Notes below, only for a `defer`/`archive` verdict in an originally-bare non-git folder, the one case where it survives past this phase).
   g. Determine `<slug>` from `idea.md`'s title/topic.
   h. **Idempotency — recovery from a partial failure.** Before creating a new follow-up issue, check whether a folder already exists under `docs/issues/open/` whose frontmatter carries `idea_ref: ISSUE-ID` (evidence that a previous, interrupted run of this same phase already created the follow-up issue but never reached Phase 5). If one exists, reuse it — do not create a second one, do not overwrite it — skip straight to the matching report line (i/j below), then to Phase 5.
   i. **`project` verdict:** create `docs/issues/open/<YYYYMMDD>-feat-<slug>/prompt.md`, pre-filled:
      - `doc_language` — inherited directly from the idea.
      - `roles`/`profile`/`on_unavailable` — copied as-is when present in the idea's `prompt.md` (the same values apply — the idea's `idea`/`research`/`critique`/`verdict` keys resolve through the same `pf-roles` algorithm as `code`/`tests`/…; the idea has no explicit values for `code`/`brd`/`specs`/… so only what's actually present is copied — whatever is absent stays absent, and the ordinary fallback applies later, as for any new issue).
      - `size_tier` — derived from `idea.md`'s "Cost (Effort)" and `idea_tier`, per the table below, and **written immediately** (not left for the legacy-tier guard to ask about later), with the reasoning logged as `[assumed]` in a **new** `open_questions.md` for this feat-issue:

        | `idea_tier` | Signal in "Cost (Effort)" | Derived `size_tier` |
        |---|---|---|
        | `personal` | any | `small` |
        | `infra` | "a few hours" / "one day" or shorter | `small` |
        | `infra` | "a few days" or longer | `medium` |
        | `content` | any | `small` |
        | `product` | "a week" or shorter | `medium` |
        | `product` | "a few weeks" / "a month" or longer | `large` |

        If "Cost (Effort)" carries no recognizable duration signal (free text with no time unit) — `size_tier` is **not** written; it stays a genuine gap, and the ordinary legacy-tier guard in `/pf-brd`/`pf-spec`/… asks about it as it would for any issue with no tier (the one case where AC-08c's "only ask when it can't be derived" rule still permits a question).
      - `idea_ref: <idea-id>`; body — composed from `idea.md` + `verdict.md` + the original intake text of `prompt.md` (the idea, still physically in `open/` at this point per step 1 above). Report line for Phase 9: "Created follow-up issue: <feat-id> (idea_ref: <idea-id>). Next: /pf-brd."
   j. **`spike-first` verdict:** likewise create `docs/issues/open/<YYYYMMDD>-spike-<slug>/prompt.md`, `idea_tier: <copied from the idea's own `prompt.md` frontmatter>` alongside `idea_ref: <idea-id>` — the same `prompt.md` and the same `idea_tier` field this phase already reads for step i's `size_tier` derivation table; the spike `prompt.md` schema (`specs-part2.md` §6.8) requires this field, and `/pf-idea-spike` reads it immediately for `hypothesis.md`/`findings.md` budgets (§6.10) — an empty `idea_tier` here makes every auto-generated spike invalid. With `## Question`/`## Success Criterion`/`## Time-box`/`## Method` best-effort derived from `verdict.md`'s "## Reasoning" and `critique.md`'s Summary Table (rows disposed "Idea changes" or carrying an unresolved technical objection are the natural source for a Question candidate). Nothing is asked of the user — the same front-loaded rule applies: resolve ambiguity with the recommended judgment, log it `[assumed]` in a **new** `open_questions.md` for the just-created spike-issue. This spike is now **always** git-backed (steps a-f above already ran identically for both `project` and `spike-first`) — `pf-idea-spike`'s Mode 2 can create `issue/<spike-id>` if the experiment needs code, with no "no repository" risk. Report line for Phase 9: "Created follow-up issue: <spike-id> (idea_ref: <idea-id>). Next: /pf-idea-spike."
4. Proceed to Phase 5.

**Recovery — what a re-run of `/pf-close` does if Phase 4.6 failed partway.** A run interrupted inside this phase leaves `docs/issues/open/` holding **two** folders: the original idea (ISSUE-ID, not yet archived) and, if the failure happened after step h/i/j, the already-created follow-up issue. Within one continuous run, `/pf-close`'s active-issue detection ("read ISSUE-ID from the active folder name" at the top of this file) is unaffected by this — ISSUE-ID is fixed once, at the very start, and never rescanned. What is affected is only a **new, cold** `/pf-close` invocation (a new session, after the failure): if `docs/issues/open/` contains more than one folder, `pf-close` cannot silently pick the first one — the same principle `/pf` already applies when several issues are open (not a new mechanism): prefer the folder whose `verdict.md`/`findings.md` already carries a confirmed closure marker (for idea, `## Decision`); if more than one candidate qualifies, stop and ask the user which to close. The follow-up folder this phase just created is distinguishable by its `idea_ref`, which points at an ISSUE-ID whose own folder is **still** in `open/` — an unambiguous sign that "Phase 4.6 partially ran, but Phase 5 hasn't moved the idea yet," not a second, independent active issue.

---

## Phase 5: Archive Issue Folder

1. Ensure `docs/issues/closed/` directory exists. If it does not, create it (e.g. `mkdir -p docs/issues/closed/`).
2. Move `docs/issues/open/ISSUE-ID/` to `docs/issues/closed/ISSUE-ID/` (e.g. `mv docs/issues/open/ISSUE-ID docs/issues/closed/ISSUE-ID`).

Proceed to Phase 6.

---

## Phase 6: Compute LLM Usage & Cost

This phase produces `docs/issues/closed/ISSUE-ID/usage_report.md`, a best-effort record of which LLMs worked the issue and roughly how many tokens / dollars that took. Treat every number here as approximate — never invent a figure that isn't backed by real data.

1. **Find the issue's start time.** Run:
   ```
   git log --reverse --format=%aI -- docs/issues/open/ISSUE-ID | head -1
   ```
   This is START-TS — the issue lived under `docs/issues/open/ISSUE-ID` throughout its history (Phase 5's move to `closed/` is still uncommitted at this point, and the archive commit is not made until Phase 8, so the `closed/` path does not yet exist in git history). If it returns nothing, skip auto-computation (step 2) and go straight to step 3 with a note that the window could not be determined.

2. **Auto-compute Claude usage from local transcripts.**
   - Transcript directory: `~/.claude/projects/<cwd-with-slashes-replaced-by-dashes>/` (e.g. `pwd` of `/home/stac/dev/planning-framework` → `-home-stac-dev-planning-framework`). If this directory doesn't exist, skip to step 3.
   - For every `*.jsonl` file in that directory, read each line as JSON, keep entries where `.type == "assistant"` and `.timestamp >= START-TS`, dedupe by `.message.id` (a single API response can appear more than once in the log), then group by `.message.model` and sum `.message.usage.input_tokens`, `.cache_creation_input_tokens`, `.cache_read_input_tokens`, and `.output_tokens`.
   - A small inline `jq` (or Node.js) script run via Bash is the right tool for this — don't try to do the aggregation by eye.
   - **Caveat to carry into the report:** this time-window heuristic captures *all* Claude Code activity in this project directory during the window, not just this issue. If the user worked on something else in parallel, note that the figure may be inflated.
   - For pricing, invoke the `claude-api` skill to get current per-model $/Mtok rates and compute an approximate cost. If that skill is unavailable or a model's price can't be found, report the token counts only and mark cost as "unavailable — pricing table not found" rather than guessing.

3. **Merge manual entries for other LLMs.** Check for `docs/issues/closed/ISSUE-ID/usage.md`. This is a convention where any agent (Gemini, Qwen, or a human) can append a session entry as work happens, e.g.:
   ```
   ## Session: 2026-06-25
   - Model: gemini-2.5-pro
   - Tokens: input 12000, output 3400
   - Cost: ~$0.08
   ```
   If the file exists, parse and include its entries verbatim (labeled "manual") in the report. If it doesn't exist, note that no non-Claude usage was logged.

4. **Write `docs/issues/closed/ISSUE-ID/usage_report.md`** with a table like:

   ```
   # LLM Usage — ISSUE-ID

   | Source | Model | Input tok | Output tok | Cache tok | Approx cost | Notes |
   |---|---|---|---|---|---|---|
   | auto  | claude-sonnet-5 | 120,000 | 8,400 | 340,000 | ~$1.42 | window: 2026-06-25T.. → close |
   | manual | gemini-2.5-pro  | 12,000  | 3,400 | —       | ~$0.08 | from usage.md |

   **Total approx cost:** ~$1.50

   _Auto figures cover all Claude Code activity in this project directory during the issue window, not solely this issue — treat as an upper bound if other work overlapped._
   ```

   If no data was available from either source, write the file stating that plainly instead of omitting it.

Proceed to Phase 7.

---

## Phase 7: Update Session Log

**If `NO-REPO`:** `docs/planning/session-log.md` does not exist (no PF scaffold was ever created for this issue) — skip this phase entirely, and note in Phase 9's report: "session-log.md not updated — no PF scaffold exists in this folder." Do not create `docs/planning/` just to hold one line.

1. Read `docs/planning/session-log.md`.
2. Determine a one-line summary:
   - Try to read `docs/issues/closed/ISSUE-ID/qa_report.md` — use the issue title from the `**Issue ID:**` line or any summary text in the report.
   - If that yields nothing useful, read `docs/issues/closed/ISSUE-ID/prompt.md` and use its first heading or first non-empty line.
   - If neither is available, use `ISSUE-ID` as the summary.
3. Append the following line to `session-log.md` (at the end of the file):

   ```
   [Claude Code] ✓ [ISSUE-ID](../issues/closed/ISSUE-ID/) — <one-line summary> · LLM usage: see [usage_report.md](../issues/closed/ISSUE-ID/usage_report.md)
   ```

   If Phase 6 found no usage data at all, omit the "LLM usage" clause.
4. Write the updated content back to `docs/planning/session-log.md`.

Proceed to Phase 8.

---

## Phase 8: Archive Commit

**If `NO-REPO`:** skip both `git add` and `git commit` — there is no repository to commit to. Report "not committed — no git repository" in Phase 9 instead of the usual commit-summary lines.

1. Run `git add docs/issues/ docs/planning/session-log.md docs/planning/test-plan.md`.
2. Run `git commit -m "close: archive ISSUE-ID"`.

Proceed to Phase 8.5.

---

## Phase 8.5: Push Parent Branch (safe auto-push)

After the archive commit, push PARENT-BRANCH to its remote automatically — but only when it is safe. This step never aborts the closure: the issue is already closed locally, so any push problem is reported in Phase 9, not fatal.

**If `NO-REPO`:** this phase does not run at all — there is no repository, so there is nothing to push and no remote to check. This is a distinct condition from "no remote configured" below, but the wording reported in Phase 9 is the same either way; the distinction is not visible to the user.

1. **Safety guard — skip the push (and record the reason for the Phase 9 report) if either holds:**
   - PARENT-BRANCH is `main` or `master` — release branches are pushed by the user manually, never automatically.
   - No git remote is configured (`git remote` prints nothing).
2. **Resolve the remote:** use PARENT-BRANCH's configured remote (`git config branch.PARENT-BRANCH.remote`); if unset, use `origin` when it exists, otherwise skip per the guard above.
3. **Push, safely:** run `git push <remote> PARENT-BRANCH` (add `-u` if the branch has no upstream yet). Never use `--force` / `--force-with-lease`, never `--no-verify`.
4. **On push failure** (auth, non-fast-forward, network): do NOT abort — the closure is already committed locally. Capture the git error and surface it in the Phase 9 report with an instruction to push manually once resolved.

Proceed to Phase 9.

---

## Phase 9: Report

**Autopilot schedule cleanup — `TYPE: idea`/`spike` only, before printing the report below.** Check whether a schedule named `pf-autopilot-<project>` exists (`CronList`). If it does, delete it (`CronDelete pf-autopilot-<project>`) and add one line to this phase's report: "Autopilot schedule removed." If none exists, say nothing extra — this is the common case for an issue that was never driven by autopilot. This is the one point every `idea`/`spike` closure passes through regardless of whether a human closed it directly or `/pf-autopilot` stopped itself before the final gate, so it is the reliable place to clear a schedule an autopilot run may have left behind.

Print the following closing report:

```
Issue ISSUE-ID closed.

Two commits added to PARENT-BRANCH:
  1. merge: close ISSUE-ID  (merge commit, --no-ff)
  2. close: archive ISSUE-ID  (archive commit)

Issue folder moved to docs/issues/closed/ISSUE-ID/
LLM usage recorded in docs/issues/closed/ISSUE-ID/usage_report.md

Remote push: <report the Phase 8.5 outcome, one of>
  - pushed PARENT-BRANCH to <remote>
  - skipped — PARENT-BRANCH is main/master; push manually for releases
  - skipped — no remote configured; add one and run `git push` when ready
  - FAILED — <git error>; run `git push` manually after resolving
```

**If `NO-REPO`:** replace the entire "Two commits added to PARENT-BRANCH…"/"Remote push: …" block above with a single line: "Not committed — no git repository. Issue folder archived on disk only: docs/issues/closed/ISSUE-ID/."

---

## Important Notes

- **Non-git guard (`NO-REPO`) across Phase 5-9.** Once set by Phase 0's step 5, `NO-REPO` is never recomputed inside Phase 6-8 — the only place it can flip to "there's a repository now" within one `pf-close` run is Phase 4.6 (step 3.f, `project`/`spike-first` verdict), which runs **before** Phase 5. So everything below applies only to a `defer`/`archive` verdict for an idea that started life in an originally-bare, non-git folder — the one case where `NO-REPO` survives all the way to Phase 5 and beyond:

  | Phase | Effect when `NO-REPO` has survived to this point |
  |---|---|
  | Phase 5 ("Archive Issue Folder") | Unchanged — `mv`, not a git operation; runs regardless of `NO-REPO`. |
  | Phase 6 ("Compute LLM Usage & Cost") | No structural change — step 1's empty `git log` result already routes straight to step 3 with "window could not be determined", which is the only reachable path under `NO-REPO` anyway. `usage_report.md` is written noting the absence of auto-computed data, same as for any issue with no transactions at start. |
  | Phase 7 ("Update Session Log") | Skipped entirely — see the caveat at the top of that phase. |
  | Phase 8 ("Archive Commit") | `git add`/`git commit` skipped — see the caveat at the top of that phase. |
  | Phase 8.5 ("Push Parent Branch") | Skipped entirely, same as "no remote configured" — see the caveat at the top of that phase. |
  | Phase 9 ("Report") | The usual commit/push block is replaced by one line — see the caveat at the end of that phase. |

- **Auto-push the parent branch on close, but only when safe** (Phase 8.5) — push PARENT-BRANCH to its remote automatically if a remote is configured AND the parent is not `main`/`master`. Never force-push, never `--no-verify`. If no remote exists or the parent is a release branch, skip with a note; if the push errors, report it but keep the closure (already committed locally). Releases to `main`/`master` are always pushed by the user manually.
- **Verdict check is strict** — only `**PASS**` (bold, exact casing) in the Verdict section satisfies the prerequisite. A commented-out or unchecked PASS does not count.
- **No-ff merge is required** — `--no-ff` preserves the issue branch history as a distinct line in the log.
- **If merge fails for reasons other than conflict** (e.g. branch not found, wrong parent), report the git error verbatim and stop.
- **Archive commit uses `docs/issues/`** not just `docs/issues/closed/` so that the removal of the `open/` entry is staged as well.
- **Usage numbers are approximate, never fabricated.** Auto-computed Claude figures come only from real transcript data (`~/.claude/projects/.../*.jsonl`); non-Claude figures come only from a manually maintained `usage.md` in the issue folder. If a number can't be derived from one of those two sources, the report says so — it does not estimate or guess.
- **The auto-computed window is a heuristic, not exact attribution** — it sums all Claude Code activity in this project directory between the issue's first commit and close time, so overlapping unrelated work will inflate it.
