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

---

## Verdict

**PASS**
