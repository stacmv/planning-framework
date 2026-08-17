# Code Review Report

**Issue ID:** 20260806-improve-manual-test-budget
**Date:** 2026-08-13
**Reviewer(s):** Claude + Codex

---

## Findings Ledger

| ID | Round | Priority | Description | Follow-up Issue | State |
|----|-------|----------|--------------|------------------|-------|
| CR-001 | 1 | P1 | `test/lib.sh`'s `pf_validate_manual_reasons()` (`reason_val="${reason_val%%[^a-z-]*}"`, line 453) claimed to fail extracting the reason word when `Remarks` has explanatory text after it (e.g. `"Manual reason: cost — 2 days"`), incorrectly rejecting a valid `cost` reason. **Verified false by direct empirical test**: `[^a-z-]*` is a glob pattern, not a regex — `[^a-z-]` matches exactly one non-`[a-z-]` character, and the following `*` then matches everything to the end unconditionally (glob `*` is not "repeat the class"). Tested directly: `"cost — effort estimate here"` → `"cost"`, `"cost - 2 days of effort"` → `"cost"`, `"human-judgment"` → `"human-judgment"` (hyphen correctly preserved as part of the word, not treated as a delimiter). The reviewer's own failure-scenario reasoning applied regex semantics to a glob pattern; the actual bash behavior is correct. No code changed. | | wont-fix |
| CR-002 | 1 | P2 | Test fixtures (`test/fixtures/manual-budget-tc-006` etc.) only use bare `Manual reason: <value>` with no trailing explanatory text, so the (non-existent) extraction bug CR-001 hypothesized would not have been caught by the suite even if real. Genuine, if minor, coverage gap — a fixture with `Manual reason: cost — <estimate text>` would make the suite self-documenting about this already-correct behavior. Not fixed in this round — no failure scenario, coverage-only. | | wont-fix |
| CR-003 | 1 | P2 | `skills/pf-size-tiers/SKILL.md`'s Manual budget table uses `0-1` for `trivial` but `≤2`/`≤3`/`≤5` for the other three tiers — inconsistent notation (readable either way, but not uniform). No functional impact — every consumer (`pf_get_budget_for_tier`, the skill-instruction prose) already interprets it correctly as "at most 1". Style-only. | | wont-fix |
| CR-004 | 1 | P1 | Found during `/pf-test`'s TC-ID mapping (Phase 3), after this ledger's original `PASS`: TC-010's implementation in `test/manual-budget.sh` only called `pf_note`, never `pf_pass`/`pf_fail` — no assertion at all, so it could never be discovered by `/pf-test`'s scanning and would have left an Auto TC permanently unmatched, blocking manual-checklist generation. Rewrote it into two real assertions (Manual-reason validation survives trailing `(missing)` harness text; at least one row documents the missing harness by name). That second assertion, piped `pf_status_tracker_rows_full \| grep -qiE 'missing'`, then itself failed intermittently under this file's `pipefail` (`test/lib.sh`) — `grep -q` exits as soon as it finds a match, SIGPIPEs the still-writing multi-line producer, and pipefail reports the pipeline as failed even though grep matched. Fixed by capturing the producer's output to a variable before grepping it, the same pattern already safe elsewhere in this file. Verified with 3 repeated runs post-fix, all green; full `make test` green. | | fixed |

---

## Verdict

**PASS**
