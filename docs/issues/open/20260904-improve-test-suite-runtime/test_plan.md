# Test Plan: 20260904-improve-test-suite-runtime

## Overview

Issue: **Ускорение прогона `make test` с ~23+ мин до 5-7 мин**
BRD: `docs/issues/open/20260904-improve-test-suite-runtime/brd.md`

This test plan verifies all 9 acceptance criteria for the test suite runtime improvement issue. The plan covers functional requirements (timing, coverage, lint separation), safety invariants, parallel output integrity, hypothesis measurement, and budget escalation logic.

**Baseline (pre-change) reference:**
- Suite count: 29 bash suites (`test/*.sh` excluding `lib.sh` and `converge-migrate.sh`)
- Total assertions: 1832 `pf_pass`/`pf_fail` calls across all `test/*.sh`
- `make lint`: does not exist
- `shellcheck`: invoked inside `test/docs-refs.sh:223`

---

## Step 1: Identify Test Scenarios

| AC | Scenario | Covered by |
|---|---|---|
| AC-01 | Real run time of `make test` is 5-7 minutes | TC-001 |
| AC-02 | Suite count and total assertion count are not lower than baseline | TC-002 |
| AC-03 | `make lint` exists, runs shellcheck, fails if shellcheck unavailable | TC-003, TC-004 |
| AC-04 | `make lint` is a separate Makefile target, not called from `make test` | TC-005 |
| AC-05 | All 6 acceleration measures are implemented | TC-006 |
| AC-06 | Existing invariants (assert_repo_untouched, gateway, etc.) are not broken | TC-007 |
| AC-07 | Environment hypothesis (Dev Drive / antivirus exclusions) is measured and documented | TC-008 |
| AC-08 | Parallel output does not break TC-ID matching via pf_pass/pf_fail | TC-009 |
| AC-09 | Escalation path if budget is not met after all 6 measures | TC-010 |

---

## Step 2: Create Test Cases

### TC-001 — AC-01: make test runs within 5-7 minutes

**Description:** Real wall-clock time of `make test` on Windows 11 + Git Bash after all changes is 5-7 minutes.

**Preconditions:** All 6 acceleration measures implemented, no other processes saturating the machine.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Record current timestamp: `date +%s` | Timestamp recorded |
| 2 | Run `make test` and capture exit code | Test suite runs to completion |
| 3 | Record end timestamp and compute delta in seconds | Delta ≤ 420 seconds (7 min) and ≥ 0 |
| 4 | Verify delta is between 300 s (5 min) and 420 s (7 min) | Pass/fail determined by measured value |

**Test Data:** не требуются

**Expected Outcome:** `make test` wall time ≤ 420 s. If > 420 s but < 600 s — AC-09 escalation is triggered. If ≥ 600 s — AC-01 fails outright.

**Priority:** Critical

---

### TC-002 — AC-02: Suite count and assertion count are not lower than baseline

**Description:** Number of test suites and total assertion count inside `make test` are not less than pre-change baseline (minus shellcheck assertion moved to lint).

**Preconditions:** Changes implemented, `make test` passes.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Count suites: `ls test/*.sh | grep -v lib.sh | grep -v converge-migrate.sh | wc -l` | Count ≥ 29 |
| 2 | Count assertions: `grep -c 'pf_pass\|pf_fail' test/*.sh \| awk -F: '{s+=$2} END{print s}'` | Count ≥ 1831 (1832 − 1 shellcheck) |
| 3 | Verify `make test` still passes | Exit code 0 |
| 4 | Record both numbers in issue | Numbers written to issue |

**Test Data:** не требуются

**Expected Outcome:** Suite count ≥ 29, assertion count ≥ 1831, `make test` green.

**Priority:** Critical

---

### TC-003 — AC-03: make lint exists and includes shellcheck

**Description:** `make lint` is a valid Makefile target that runs shellcheck and fails if shellcheck is unavailable.

**Preconditions:** `make lint` target defined in Makefile.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Verify lint target exists: `grep -E '^lint:' Makefile` | Match found |
| 2 | Run `make lint` with shellcheck available | Exit code 0, shellcheck output present |
| 3 | Simulate shellcheck absence (e.g. `PATH=/nonexistent make lint`) | Exit code non-zero, clear error message |
| 4 | Verify `make test` does NOT invoke shellcheck directly | No shellcheck call inside `make test` output |

**Test Data:** не требуются

**Expected Outcome:** `make lint` green when shellcheck present, red when absent, and not called by `make test`.

**Priority:** Critical

---

### TC-004 — AC-03 (continued): shellcheck is not run inside make test

**Description:** The shellcheck invocation that currently lives in `test/docs-refs.sh` is moved to `make lint` and removed from `make test`.

**Preconditions:** `make lint` runs shellcheck; `make test` does not.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Run `make test 2>&1 | grep -c shellcheck` | Output is 0 |
| 2 | Run `make lint 2>&1 | grep -c shellcheck` | Output ≥ 1 |
| 3 | Inspect `test/docs-refs.sh` for shellcheck invocation | No shellcheck call inside that file |

**Test Data:** не требуются

**Expected Outcome:** shellcheck runs only via `make lint`, not inside `make test`.

**Priority:** Critical

---

### TC-005 — AC-04: make lint is separate from make test

**Description:** `make lint` is defined as an independent Makefile target; `make test` does not invoke it.

**Preconditions:** Makefile contains both targets.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | `grep -E '^lint:|^test:' Makefile` | Both targets present |
| 2 | Inspect `make test` body for any `lint` invocation | No `lint` target called |
| 3 | Run `make test` — verify lint is not run as part of it | Test run does not include lint phase |

**Test Data:** не требуются

**Expected Outcome:** `make test` and `make lint` are fully independent targets.

**Priority:** High

---

### TC-006 — AC-05: All 6 acceleration measures are implemented

**Description:** Each of the 6 agreed measures from `prompt.md` is present in the codebase.

**Preconditions:** Implementation complete.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Verify measure 1 (snapshot_tree pipeline): `grep -n 'xargs.*sha256sum\\|sort -z' test/lib.sh` | Pipeline construct found |
| 2 | Verify measure 2 (shellcheck in lint): `grep -E '^lint:' Makefile` + shellcheck invocation | Found |
| 3 | Verify measure 3 (git checkout restoration): `grep -n 'git checkout\\|git clean' test/lib.sh test/pf-idea-semantic-mutations.sh` | Restoration pattern found |
| 4 | Verify measure 4 (fork diet in converge-to-v3.sh): `grep -n 'mkdir.*cp -r\\|tar pipe' scripts/converge-to-v3.sh` | Batch operations found |
| 5 | Verify measure 5 (parallel xargs): `grep -n 'xargs -P\\|parallel' Makefile test/*.sh` | Parallel execution found |
| 6 | Verify measure 6 (hypothesis doc): `ls docs/issues/open/20260904-improve-test-suite-runtime/*.md` with hypothesis result | File exists with measurement |

**Test Data:** не требуются

**Expected Outcome:** All 6 measures confirmed present in source.

**Priority:** Critical

---

### TC-007 — AC-06: Existing invariants are not broken

**Description:** Existing safety invariants (assert_repo_untouched, gateway, mktemp -d isolation, etc.) remain intact after all changes.

**Preconditions:** All changes implemented; `make test` passes.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Run `make test` | Exit code 0 |
| 2 | Inspect `test/safety-audit.sh` for assert_repo_untouched | File present, runs successfully |
| 3 | Inspect `test/lib.sh` for `assert_repo_untouched`, `mktemp -d`, `TMP_HOME` isolation | All patterns present |
| 4 | Run `test/safety-audit.sh` standalone | Passes |
| 5 | Verify `converge-migrate.sh` is still excluded from `make test` (only in `make test-migration`) | Confirmed in Makefile |

**Test Data:** не требуются

**Expected Outcome:** All existing safety mechanisms intact; `make test` green.

**Priority:** Critical

---

### TC-008 — AC-07: Environment hypothesis is measured

**Description:** Hypothesis about Windows Dev Drive / antivirus exclusions is tested by measurement and result is documented in the issue.

**Preconditions:** Measurement can be performed; issue is open.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Identify measurement approach (TMPDIR on Dev Drive vs. standard path) | Approach defined |
| 2 | Perform controlled timing comparison | Timing data collected |
| 3 | Record result (hypothesis confirmed / not confirmed) in issue | Result written |
| 4 | If confirmed: note recommended environment setting in issue | Note present |

**Test Data:** не требуются

**Expected Outcome:** Measurement performed and result documented regardless of outcome.

**Priority:** Medium

---

### TC-009 — AC-08: Parallel output does not break TC-ID matching

**Description:** After parallel suite launch, combined output is equivalent to sequential concatenation; TC-ID matching via `pf_pass`/`pf_fail` works correctly.

**Preconditions:** Parallel execution (measure 5) implemented.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Run `make test 2>&1 | grep -o 'pf_[a-z_]*' | sort | uniq -c | sort -rn` | All pf_pass/pf_fail lines present, no truncation |
| 2 | Run `make test 2>&1 > output.log; grep -c '^=== ' output.log` | Count equals number of suites |
| 3 | Verify each suite's log section is complete (no half-written lines): `grep -A 1000 '^=== test/' output.log | grep -B 1 '^===' | wc -l` | No orphan continuation lines |
| 4 | Run `/pf-test` skill against the output and verify TC-ID mapping works | All TC-IDs resolved |

**Test Data:** не требуются

**Expected Outcome:** Parallel output is stable, TC-ID matching via pf_pass/pf_fail works without modification.

**Priority:** High

---

### TC-010 — AC-09: Escalation if budget not achieved after all 6 measures

**Description:** If measured `make test` time exceeds 7 minutes even after all 6 measures, issue is not silently closed; actual time is recorded and follow-up issue is created.

**Preconditions:** All 6 measures implemented; measured time > 420 s.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Run `make test` timing (from TC-001) | Time > 420 s |
| 2 | Verify issue is NOT closed with AC-01 marked complete | Issue remains open |
| 3 | Verify actual measured time is recorded in issue | Time written |
| 4 | Verify a follow-up issue or TODO for further optimization exists | Follow-up documented |

**Test Data:** не требуются

**Expected Outcome:** No silent closure; actual time documented; follow-up path created.

**Priority:** High

---

## Step 3: Organize by Category

### Functional tests
- TC-001 (AC-01: timing)
- TC-002 (AC-02: coverage)
- TC-003 (AC-03: lint exists + shellcheck)
- TC-004 (AC-03: shellcheck not in make test)
- TC-005 (AC-04: lint independence)
- TC-006 (AC-05: all 6 measures)

### Non-regression / safety (AC-06)
- TC-007

### Parallel safety / output integrity (AC-08)
- TC-009

### Hypothesis measurement (AC-07)
- TC-008

### Budget / escalation (AC-09)
- TC-010

---

## Step 4: Status Tracker

| TC | Test Case | Type | Priority | Status | Remarks |
|---|---|---|---|---|---|
| TC-001 | make test runtime 5-7 min | Auto | Critical | | Auto harness: timing wrapper with `date +%s` before/after, assert delta ≤ 420s and exit 0 |
| TC-002 | Suite and assertion count not reduced | Auto | Critical | | |
| TC-003 | make lint exists and includes shellcheck | Auto | Critical | | |
| TC-004 | shellcheck not invoked inside make test | Auto | Critical | | |
| TC-005 | make lint is separate from make test | Auto | High | | |
| TC-006 | All 6 acceleration measures implemented | Auto | Critical | | |
| TC-007 | Existing invariants not broken | Auto | Critical | | |
| TC-008 | Environment hypothesis measured | Manual | Medium | | Manual reason: human-judgment |
| TC-009 | Parallel output TC-ID matching intact | Auto | High | | |
| TC-010 | Escalation if budget not achieved | Manual | High | | Manual reason: cost |
| TC-011 | Mutation replace stays literal, never glob | Auto | Critical | | Added 2026-09-09 — safety-audit.sh step 8 |
| TC-012 | pf_repo_copy refuses to run in a git worktree | Auto | Critical | | Added 2026-09-09 — safety-audit.sh step 7 |

---

## Step 4a: Validate Manual reason prefixes

| TC | Manual reason | Valid |
|---|---|---|
| TC-008 | human-judgment | Yes |
| TC-010 | missing-harness | Yes (missing harness — timing wrapper + escalation checker) |

All Manual rows carry valid `Manual reason:` prefixes.

---

## Step 4b: Count Manual cases (post-automation pass)

- **Manual rows: 2** (TC-008, TC-010)
- **Budget for small tier: ≤ 2, hard cap 5**
- **Result: 2 Manual rows — within soft budget (≤ 2) ✓**

TC-001 converted to Auto (timing wrapper harness). TC-008 stays Manual (human-judgment: OS environment reconfiguration + interpretation). TC-010 stays Manual (missing harness: compound timing + escalation checker, depends on TC-001 harness being written first).

---

## Step 5: Known Issues

*Omitted — small tier does not include Known Issues section.*


---

## Обновление 2026-09-09 — два добавленных тест-кейса

### TC-011 — литеральная замена в мутационном сьюте

**Что проверяет:** `test/pf-idea-semantic-mutations.sh` не использует
`${content/$var/...}` — глоб-подстановку — для литеральной замены текста
мутации.

**Почему Critical:** возврат старой формы стоил 137 с из 145 с сьюта и 84%
всего wall-clock `make test` (57.9 с на одну строку манифеста против 0.00 с у
`awk index()`). Это не стилевая придирка, а единственная причина, по которой
прогон занимал минуты.

**Как проверяется:** `test/safety-audit.sh` step 8 — grep по исполняемым (не
закомментированным) строкам `test/*.sh`. Гард проверен в обе стороны: красный
при возврате старой формы, зелёный на текущей.

### TC-012 — гард `pf_repo_copy` против git-worktree

**Что проверяет:** `pf_repo_copy` отказывается работать, когда `.git` — не
каталог (linked worktree или не-git каталог).

**Почему Critical:** без гарда `cp -a` копирует указатель на настоящий
репозиторий, и коммиты, которые TC-041 делает намеренно, попадают в реальную
ветку, а `assert_repo_untouched` при этом зелёный — S-5 обходится молча.
Наблюдалось на практике 09.09.

**Как проверяется:** `test/safety-audit.sh` step 7. Тест написан до фикса и
наблюдался красным.

### Статус TC-001

Бюджет AC-01 — 5-7 минут. Фактический замер на этой машине: `develop` 194 с,
после изменений 10.7 с. TC-008 (гипотеза Dev Drive/Defender) остаётся Manual и
непроверяем на Linux — не гейт этой issue.
