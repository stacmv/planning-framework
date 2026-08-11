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

    # Guards P0-1 (code_review.md, pass 3): 3.2 collects pass-form/fail-form
    # candidates for an if/else check site, but only one of the pair is ever
    # printed at runtime. The aggregation rule in 3.2-3.4 must therefore state
    # THREE independent semantic properties, not just be present as a
    # paragraph (grepping for the mere presence of "aggregat[a-z]* rule" was
    # exactly the P0-1 bug — the paragraph existed and was still wrong):
    #   (a) a candidate that does not appear is not evidence of failure and
    #       does not by itself block a "matched" verdict;
    #   (b) a candidate that DOES appear and reports failure drives the
    #       TC-ID to "not a pass" (the aggregation must not let a failing
    #       appearing candidate be outvoted by other passing ones);
    #   (c) whether at least one candidate appears at all is what separates
    #       "matched" from "not matched" (not whether every candidate
    #       appears).
    # All three must hold; any one alone is easy to satisfy vacuously (e.g.
    # (c)'s "does not count as matched" phrase alone says nothing about (a)).
    agg_sec="$(section "$PF_TEST" "$s32" "$s34")"
    has_absence_not_failure=0
    has_failing_dominates=0
    has_matched_distinction=0
    printf '%s\n' "$agg_sec" | grep -qiE "not evidence|does not (by itself )?block|absence.*(is not|isn.t).*fail" && has_absence_not_failure=1
    printf '%s\n' "$agg_sec" | grep -qiE "appearing.*fail|fail.*appearing" && has_failing_dominates=1
    printf '%s\n' "$agg_sec" | grep -qiE "no candidate.*appear|at least one candidate appear|does not count as matched" && has_matched_distinction=1

    if [ "$has_absence_not_failure" -eq 1 ] && [ "$has_failing_dominates" -eq 1 ] && [ "$has_matched_distinction" -eq 1 ]; then
      pf_pass "TC-001 step 4: 3.2-3.4 state all three aggregation properties (absence != failure, an appearing failure dominates, at-least-one-appearing decides matched vs. not-matched)"
    else
      pf_fail "TC-001 step 4: aggregation rule incomplete (absence-not-failure: $has_absence_not_failure, failing-dominates: $has_failing_dominates, matched-distinction: $has_matched_distinction)"
    fi

    # Guards P1-1/P2 (code_review.md, pass 3): the unconditional banner printf
    # (a fifth string form carrying a TC-ID) must be named among the excluded
    # forms via two independent signals — that it is unconditional/unrelated
    # to outcome, AND that it carries no pass/fail information — the same
    # two-signal pattern TC-004 uses below, so a legitimate rewording of one
    # signal alone (e.g. renaming "banner" to "announcement string") cannot
    # silently zero out this assertion the way a single `grep "banner"` would.
    banner_sec="$(section "$PF_TEST" "$s32" "$s33")"
    has_unconditional=0
    has_no_verdict=0
    printf '%s\n' "$banner_sec" | grep -qiE "unconditional|regardless of (whether|the outcome)|before its checks" && has_unconditional=1
    printf '%s\n' "$banner_sec" | grep -qiE "no pass/fail information|carries no (pass|verdict)|not a result-reporting label" && has_no_verdict=1

    if [ "$has_unconditional" -eq 1 ] && [ "$has_no_verdict" -eq 1 ]; then
      pf_pass "TC-001 step 5: the unconditional, verdict-free banner form is named among the excluded forms"
    else
      pf_fail "TC-001 step 5: banner exclusion incomplete (unconditional: $has_unconditional, no-verdict: $has_no_verdict)"
    fi

    # Guards P1-1 (code_review.md, pass 3): pf_fail (test/lib.sh:65-68) writes
    # to stderr while pf_pass writes to stdout. Phase 2 must state the two
    # streams are captured COMBINED, and 3.3 must search that combined output
    # (naming stderr) rather than "stdout" alone — otherwise no pf_fail label
    # is ever found and a real failure is misread as "not matched".
    p2_start="$(line_of "$PF_TEST" '^## Phase 2')"
    p3_start="$(line_of "$PF_TEST" '^## Phase 3')"

    if [ -z "$p2_start" ] || [ -z "$p3_start" ]; then
      pf_fail "TC-001 step 6: could not locate ## Phase 2 / ## Phase 3 anchors"
    else
      has_phase2_combined=0
      has_33_combined=0
      section "$PF_TEST" "$p2_start" "$p3_start" | grep -qiE "combined into one stream|combine[ds]? stdout and stderr|one (combined )?stream" && has_phase2_combined=1
      section "$PF_TEST" "$s33" "$s34" | grep -qiE "combined stdout.?stderr|combined output|stderr" && has_33_combined=1

      if [ "$has_phase2_combined" -eq 1 ] && [ "$has_33_combined" -eq 1 ]; then
        pf_pass "TC-001 step 6: Phase 2 combines stdout+stderr and 3.3 searches that combined output (names stderr)"
      else
        pf_fail "TC-001 step 6: stdout/stderr combination not stated end-to-end (Phase 2 combined: $has_phase2_combined, 3.3 combined/stderr: $has_33_combined)"
      fi
    fi

    # Guards P0-1 (code_review.md, pass 4): 3.2's "verbatim" candidate
    # instruction cannot ever match runner output for a label built with
    # shell interpolation, e.g. pf_fail "TC-001 step 4: ...
    # ($has_absence_not_failure, ...)" (this file, step 4 above) — bash
    # substitutes the value BEFORE pf_fail is called, so the printed line
    # never contains the literal "$has_absence_not_failure" text. The fix
    # must state THREE independent semantic properties together, not just be
    # present as a paragraph (the same "paragraph exists but is still wrong"
    # trap step 4's guard above documents):
    #   (a) the label may carry a substituted/runtime-variable part that the
    #       source's literal text does not determine;
    #   (b) a candidate is therefore recorded/matched only up to that point
    #       (truncated at the interpolation boundary), not as the full
    #       source literal;
    #   (c) the degenerate case is named: a candidate with no distinguishing
    #       text beyond the bare TC-ID is not matched by prefix alone.
    # All three must hold; any one alone leaves the defect's mechanism
    # unfixed even if the word "interpolation" appears somewhere.
    interp_sec="$(section "$PF_TEST" "$s32" "$s34")"
    has_variable_part=0
    has_truncated_match=0
    has_degenerate_guard=0
    printf '%s\n' "$interp_sec" | grep -qiE "interpolat|substitut.*(value|variable)|runtime.?substituted|variable.substitution" && has_variable_part=1
    printf '%s\n' "$interp_sec" | grep -qiE "truncat.*(interpolation|point)|first interpolation point|prefix.anchored" && has_truncated_match=1
    printf '%s\n' "$interp_sec" | grep -qiE "no distinguishing text|nothing survived truncation|not.*matched by prefix alone|leave.*unmatched by this candidate" && has_degenerate_guard=1

    if [ "$has_variable_part" -eq 1 ] && [ "$has_truncated_match" -eq 1 ] && [ "$has_degenerate_guard" -eq 1 ]; then
      pf_pass "TC-001 step 7: 3.2/3.3 state all three interpolation-matching properties (variable part named, matching truncated at the interpolation point, degenerate bare-TC-ID guard)"
    else
      pf_fail "TC-001 step 7: interpolation-matching fix incomplete (variable-part: $has_variable_part, truncated-match: $has_truncated_match, degenerate-guard: $has_degenerate_guard)"
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
  # Scoped to the exclusion rule's own block, not the whole 3.2-3.4 range: from
  # the "in any of these forms" intro through the "not separate exceptions"
  # closing line — the same anchor-narrowing technique
  # skills-role-matrix-static.sh's check_order uses (narrow to a known block by
  # anchor text, then check inside it), so an unrelated future occurrence of
  # "fixture"/"exclude" elsewhere in 3.2-3.4 cannot produce a vacuous pass here.
  excl_start="$(line_of_fixed "$PF_TEST" "in any of these forms")"
  excl_end="$(line_of_fixed "$PF_TEST" "not separate exceptions")"

  if [ -z "$excl_start" ] || [ -z "$excl_end" ]; then
    pf_fail "TC-004: could not locate the exclusion rule's block anchors"
  else
    sec="$(section "$PF_TEST" "$excl_start" "$((excl_end + 1))")"
    has_intent=0
    has_subject=0
    printf '%s\n' "$sec" | grep -qiE "exclud|ignor|does not count|must not match" && has_intent=1
    printf '%s\n' "$sec" | grep -qiE "fixture|test data|sample data|string constant" && has_subject=1

    if [ "$has_intent" -eq 1 ] && [ "$has_subject" -eq 1 ]; then
      pf_pass "TC-004: the exclusion rule's own block states both the exclusion intent and fixtures/test data as its subject"
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
