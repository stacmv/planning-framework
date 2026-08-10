#!/usr/bin/env bash
# test/pf-test-tc-mapping-static.sh — TC-001..TC-007 (20260806-bug-test-plan-tc-untracked).
#
# The Auto-type TCs from that issue's test_plan.md. All seven are grep-based
# structural audits of skills/pf-test/SKILL.md and skills/pf-test-plan/SKILL.md
# (plus, for TC-006 step 2 and TC-004's counter-example, real files under
# tools/manual-test-ui/test/), in the same spirit as
# skills-role-matrix-static.sh's TC-009/TC-014 coverage: read-only, asserts the
# SHAPE the test plan's own Steps describe rather than re-deriving new
# assertions. TC-008 is a live manual /pf-test run and is out of scope here.
#
# Read-only. It runs no script, touches no $HOME, and mutates nothing.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

PF_TEST="$REPO_ROOT/skills/pf-test/SKILL.md"
PF_TEST_PLAN="$REPO_ROOT/skills/pf-test-plan/SKILL.md"
CHECKLIST_PATCH="$REPO_ROOT/tools/manual-test-ui/test/checklist-patch.test.js"

# line_of <file> <ERE pattern> — first matching line number (grep -n -E), or
# empty if not found.
line_of() {
  grep -n -E "$2" "$1" 2>/dev/null | head -1 | cut -d: -f1
}

# line_of_fixed <file> <literal string> — first matching line number
# (grep -n -F), or empty if not found.
line_of_fixed() {
  grep -n -F -- "$2" "$1" 2>/dev/null | head -1 | cut -d: -f1
}

# section <file> <start line> <end line, exclusive> — prints that range.
section() {
  local file="$1" start="$2" end="$3"
  sed -n "${start},$((end - 1))p" "$file"
}

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-001: Phase 3.2 covers TC-IDs inside string literals/arguments\n'
# ══════════════════════════════════════════════════════════════════════════════

if [ ! -f "$PF_TEST" ]; then
  pf_fail "TC-001: skills/pf-test/SKILL.md does not exist"
else
  s32="$(line_of "$PF_TEST" '^### 3\.2')"
  s33="$(line_of "$PF_TEST" '^### 3\.3')"
  s34="$(line_of "$PF_TEST" '^### 3\.4')"

  if [ -z "$s32" ] || [ -z "$s33" ] || [ -z "$s34" ]; then
    pf_fail "TC-001: could not locate ### 3.2 / ### 3.3 / ### 3.4 anchors"
  else
    if section "$PF_TEST" "$s32" "$s33" | grep -qiE "string (literal|argument)|substring|passed to.*helper|pf_pass"; then
      pf_pass "TC-001 step 2: 3.2 documents TC-ID inside a string literal/argument passed to a test helper"
    else
      pf_fail "TC-001 step 2: 3.2 does not document TC-ID inside a string literal/argument"
    fi

    if section "$PF_TEST" "$s33" "$s34" | grep -qiE "substring|same (technique|approach|method)|not (limited|restricted) to (test names|function names)"; then
      pf_pass "TC-001 step 3: 3.3 extends the same substring technique to runner-output matching"
    else
      pf_fail "TC-001 step 3: 3.3 does not extend the substring technique to runner-output matching"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-002: Phase 3.1 is not limited to the branch diff\n'
# ══════════════════════════════════════════════════════════════════════════════

if [ ! -f "$PF_TEST" ]; then
  pf_fail "TC-002: skills/pf-test/SKILL.md does not exist"
else
  s31="$(line_of "$PF_TEST" '^### 3\.1')"
  s32="$(line_of "$PF_TEST" '^### 3\.2')"

  if [ -z "$s31" ] || [ -z "$s32" ]; then
    pf_fail "TC-002: could not locate ### 3.1 / ### 3.2 anchors"
  else
    if section "$PF_TEST" "$s31" "$s32" | grep -qiE "existing test files|regardless of (whether|the branch)|not limited to (the diff|files changed)|whole test suite|entire test suite"; then
      pf_pass "TC-002 step 2: 3.1 states the search is not limited to files changed on the branch"
    else
      pf_fail "TC-002 step 2: 3.1 does not state the search is unrestricted by the branch diff"
    fi

    if section "$PF_TEST" "$s31" "$s32" | grep -qiE "not the only source|in addition to (the diff|git diff)|beyond (the diff|files changed on)"; then
      pf_pass "TC-002 step 3: 3.1 states git diff is not the only source, in addition to it"
    else
      pf_fail "TC-002 step 3: 3.1 does not state git diff is not the only source"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-003: the Phase 4 -> Phase 5 gap is closed with an explicit stop message\n'
# ══════════════════════════════════════════════════════════════════════════════

if [ ! -f "$PF_TEST" ]; then
  pf_fail "TC-003: skills/pf-test/SKILL.md does not exist"
else
  gap_start="$(line_of_fixed "$PF_TEST" "Do NOT proceed to Phase 5 when this gate triggers")"
  s51="$(line_of "$PF_TEST" '^### 5\.1')"

  if [ -z "$gap_start" ] || [ -z "$s51" ]; then
    pf_fail "TC-003: could not locate the Phase 4/Phase 5 gap anchors"
  else
    if section "$PF_TEST" "$gap_start" "$s51" | grep -qiE "unmatched|precondition|left (as|unset)"; then
      pf_pass "TC-003 step 2: the 'unmatched Auto rows, no failures' branch is named explicitly"
    else
      pf_fail "TC-003 step 2: the 'unmatched Auto rows, no failures' branch is not named"
    fi

    if section "$PF_TEST" "$gap_start" "$s51" | grep -q "Stop with message"; then
      pf_pass "TC-003 step 3: that branch defines its own 'Stop with message'"
    else
      pf_fail "TC-003 step 3: that branch has no 'Stop with message'"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-004: matching excludes TC-IDs inside test fixtures/data\n'
# ══════════════════════════════════════════════════════════════════════════════

if [ ! -f "$PF_TEST" ]; then
  pf_fail "TC-004: skills/pf-test/SKILL.md does not exist"
else
  s32="$(line_of "$PF_TEST" '^### 3\.2')"
  s34="$(line_of "$PF_TEST" '^### 3\.4')"

  if [ -z "$s32" ] || [ -z "$s34" ]; then
    pf_fail "TC-004: could not locate ### 3.2 / ### 3.4 anchors"
  else
    sec="$(section "$PF_TEST" "$s32" "$s34")"
    has_intent=0
    has_subject=0
    printf '%s\n' "$sec" | grep -qiE "exclud|ignor|does not count|must not match" && has_intent=1
    printf '%s\n' "$sec" | grep -qiE "fixture|test data|sample data|string constant" && has_subject=1

    if [ "$has_intent" -eq 1 ] && [ "$has_subject" -eq 1 ]; then
      pf_pass "TC-004: 3.2-3.4 both state the exclusion intent and name fixtures/test data as its subject"
    else
      pf_fail "TC-004: exclusion rule incomplete (intent found: $has_intent, fixture/test-data subject found: $has_subject)"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-005: pf-test-plan documents an Auto declaration pf-test can find\n'
# ══════════════════════════════════════════════════════════════════════════════

if [ ! -f "$PF_TEST_PLAN" ]; then
  pf_fail "TC-005: skills/pf-test-plan/SKILL.md does not exist"
else
  step4="$(line_of "$PF_TEST_PLAN" '^### Step 4')"
  step5="$(line_of "$PF_TEST_PLAN" '^### Step 5')"

  if [ -z "$step4" ] || [ -z "$step5" ]; then
    pf_fail "TC-005: could not locate ### Step 4 / ### Step 5 anchors"
  else
    if section "$PF_TEST_PLAN" "$step4" "$step5" | grep -qiE "findable|discoverable|matched by|see (skills/)?pf-test/SKILL\.md"; then
      pf_pass "TC-005: Step 4 ties the Auto column to what /pf-test's scanning can discover"
    else
      pf_fail "TC-005: Step 4 does not tie the Auto column to /pf-test's discoverability"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-006: JS/Python TC-ID conventions are still recognized (regression)\n'
# ══════════════════════════════════════════════════════════════════════════════

if [ ! -f "$PF_TEST" ]; then
  pf_fail "TC-006: skills/pf-test/SKILL.md does not exist"
else
  s32="$(line_of "$PF_TEST" '^### 3\.2')"
  s33="$(line_of "$PF_TEST" '^### 3\.3')"

  if [ -z "$s32" ] || [ -z "$s33" ]; then
    pf_fail "TC-006 step 1: could not locate ### 3.2 / ### 3.3 anchors"
  else
    if section "$PF_TEST" "$s32" "$s33" | grep -qE "it\(\.\.\.|describe\(\.\.\.|test\(\.\.\."; then
      pf_pass "TC-006 step 1: the it(...)/describe(...)/test(...) convention is still in 3.2"
    else
      pf_fail "TC-006 step 1: the it(...)/describe(...)/test(...) convention is missing from 3.2"
    fi
  fi

  if [ ! -f "$CHECKLIST_PATCH" ]; then
    pf_fail "TC-006 step 2: tools/manual-test-ui/test/checklist-patch.test.js does not exist"
  elif grep -qE 'test\("TC-013 step 1' "$CHECKLIST_PATCH"; then
    pf_pass "TC-006 step 2: checklist-patch.test.js still carries the TC-013 step 1 JS-convention example"
  else
    pf_fail "TC-006 step 2: checklist-patch.test.js no longer carries the TC-013 step 1 JS-convention example"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-007: no pre-existing file under test/ was modified by this fix\n'
# ══════════════════════════════════════════════════════════════════════════════

EXPECTED_NEW_FILE="test/pf-test-tc-mapping-static.sh"

have_develop=1
git -C "$REPO_ROOT" rev-parse --verify develop >/dev/null 2>&1 || have_develop=0
current_branch="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)"

if [ "$have_develop" -eq 0 ]; then
  pf_note "TC-007: 'develop' ref not found locally — develop...HEAD cannot be computed; skipping this issue's self-check."
elif [ "$current_branch" = "develop" ]; then
  pf_note "TC-007: currently on develop — develop...HEAD is empty by definition; self-check only means something on the issue branch."
else
  modified="$(git -C "$REPO_ROOT" diff --name-only --diff-filter=M develop...HEAD -- test/ 2>/dev/null)"
  added="$(git -C "$REPO_ROOT" diff --name-only --diff-filter=A develop...HEAD -- test/ 2>/dev/null)"

  if [ -z "$modified" ]; then
    pf_pass "TC-007 step 1: no existing file under test/ was modified (develop...HEAD)"
  else
    pf_fail "TC-007 step 1: existing test/ files modified: $modified"
  fi

  if [ "$added" = "$EXPECTED_NEW_FILE" ]; then
    pf_pass "TC-007 step 2: exactly one file added under test/ — $EXPECTED_NEW_FILE"
  else
    self_untracked=0
    if git -C "$REPO_ROOT" status --porcelain -- "$EXPECTED_NEW_FILE" 2>/dev/null | grep -q '^??'; then
      self_untracked=1
    fi
    if [ -z "$added" ] && [ "$self_untracked" -eq 1 ]; then
      pf_note "TC-007 step 2: deferred — $EXPECTED_NEW_FILE is untracked/uncommitted, so develop...HEAD does not show it as an addition yet; re-run after it is committed on the issue branch."
    else
      pf_fail "TC-007 step 2: expected exactly '$EXPECTED_NEW_FILE' added under test/, got: ${added:-<none>}"
    fi
  fi
fi

pf_summary
