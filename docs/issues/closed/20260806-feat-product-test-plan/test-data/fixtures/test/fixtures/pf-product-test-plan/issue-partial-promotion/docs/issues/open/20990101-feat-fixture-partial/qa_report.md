# QA Report

**Issue ID:** 20990101-feat-fixture-partial
**Date:** 2026-08-11
**Agent:** Fixture (pf-product-test-plan, TC-016)

---

## Automated Checks

| Check | Command | Result | Output |
|-------|---------|--------|--------|
| Fixture issue — no product code to check | n/a | ✓ PASS | This is a fixture issue for the TC-016 manual `/pf-close` crash-recovery protocol; it carries no code changes, so there is nothing for an automated check to run against. |

---

## Manual QA Items

- [x] **[AI check] Fixture models a mid-Phase-4.5 crash** — the paired `docs/planning/test-plan.md` fixture already contains TC-001's row (`PTC-0006`), while its `Last allocated:` line is still `PTC-0005` — the value from before that row was written. A re-run must compute `max(0005, 0006) + 1 = PTC-0007` for TC-002.

---

## Blockers

_None._

---

## Verdict

**PASS**
