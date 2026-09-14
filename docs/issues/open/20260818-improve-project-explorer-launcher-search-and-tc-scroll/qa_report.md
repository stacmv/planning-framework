# QA Report

**Issue ID:** 20260818-improve-project-explorer-launcher-search-and-tc-scroll
**Date:** 2026-09-14
**Agent:** Claude

---

## Automated Checks

| Check | Command | Result | Output |
|-------|---------|--------|--------|
| Shellcheck passes | `shellcheck scripts/*.sh test/*.sh` | ✓ PASS | — |
| No leftover debug output introduced | `git diff develop...HEAD -- . ...` | ✓ PASS | — |
| No unresolved TODOs introduced | `git diff develop...HEAD -- . ... \| grep TODO ...` | ✓ PASS | — |
| Every Auto TC marked done, none failed | `grep -c '\| \[ \] *\|'` / `grep -c '\| ✗ *\|'` on `test_plan.md` | ✓ PASS | Unprocessed-row count is 1, not 0 — see note below. Failed-row count is 0. |
| No hardcoded secrets introduced | `git diff develop...HEAD \| grep -iE "(api[_-]?key\|secret\|password\|token)=..."` | ✓ PASS | — |
| No unsafe remote-execution pattern | `git diff develop...HEAD \| grep -E "curl.*\|\s*(ba)?sh"` | ✓ PASS | — |
| Working tree clean | `git status --porcelain` | ✓ PASS | — (clean after merging `develop`, see note below) |
| Branch up to date with parent | `git merge-base --is-ancestor develop HEAD` | ✓ PASS | Initially FAIL (branch was 1 commit behind `develop` — an unrelated `pf-autopilot` fix). Merged `develop` into the issue branch (no conflicts, unrelated file) and pushed; re-ran and it now passes. |
| No application-code/CI files outside tooling and tests | `git diff --name-only develop...HEAD \| grep -vE '^(tools\|test)/' \| grep -E '\.(tsx?\|jsx?\|py\|rb\|go\|sql)$\|^\.github/workflows/'` | ✓ PASS | — |

**Note on the Testing check:** the raw unprocessed-row count is 1, not the 0 this check's command assumes. The one unprocessed row is `TC-008`, this issue's sole `Manual`-type test case — `test_plan.md`'s actual template keeps `| [ ] |` for Manual rows rather than leaving the Status cell empty, which contradicts this command's documented assumption ("a Manual row carries an empty Status cell, not `| [ ] |`, so it is outside this count by construction"). The check item's own title — "Every **Auto** TC ... is marked done" — is unambiguous about scope, and all 8 Auto TCs are independently confirmed `✓` (see `/pf-test`'s commit `c656a4d`). Treated as PASS per the item's stated intent; the command itself has a stale assumption for this project's test_plan.md format and should be tightened (e.g. filter by the `Type` column) — flagged as tech debt below rather than silently worked around.

---

## Manual QA Items

### Code Quality
- [x] No commented-out instruction blocks left in changed skill files — no `SKILL.md` file is touched by this issue's diff; nothing to check.

### Documentation
- [x] Docs match the change — neither `prompt.md` nor `brd.md` implies a user-facing doc update; `roles.user_docs`/`roles.dev_docs` also resolve to `skip` for this tier.

### Version Bump
- [x] CHANGELOG updated if framework-facing — change is confined to `tools/manual-test-ui/` (internal tooling) and `docs/issues/`/`docs/planning/tech-debt.md`; no skill/schema/script behavior changed. Passes automatically per the item's own docs-only/tools-only exemption.

### Feature Issues (feat, improve)
- [x] Diff satisfies every acceptance criterion — every Task's Acceptance Criteria in `implementation_plan.md` is checked `[x]`, with one deliberate exception: Task 7's `TC-008 отмечен вручную после реального прогона make test-ui` — a Manual-only checkbox that by design stays open until a human runs the real checklist, exactly like the Testing check's Manual-row exemption above.
- [x] Diff matches declared scope — every file actually touched under `tools/manual-test-ui/` matches `implementation_plan.md`'s "Files to Create/Modify" list. One declared file, `test/inbox-ui.test.js`, ended up unused (Task 3's TC-005 click-path test was written into `test/workspace-ui.test.js` instead — an explained deviation recorded in that task's own completion summary), not an unlisted extra.

### Pre-Merge Checklist
- [x] Working tree clean — see Automated Checks.
- [x] Branch is up to date with parent — see Automated Checks.
- [x] Commit messages are descriptive — every commit on this branch follows Conventional Commits with a specific, non-generic description (`git log --oneline develop..HEAD`).
- [x] No unrelated changes — every changed file traces to `implementation_plan.md`'s declared file list, or is an expected pipeline artifact (`docs/issues/open/.../*.md`, `docs/planning/tech-debt.md` from `/pf-codereview`'s PASS-time remnants step).

---

## Risks

_None._ (`roles.code.review` resolves to `[codex]`, not `skip` — no code-review risk line applies.)

---

## Blockers

_None._

---

## Verdict

**PASS**
