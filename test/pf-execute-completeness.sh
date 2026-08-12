#!/usr/bin/env bash
# test/pf-execute-completeness.sh — TC-013..TC-017
# (20260806-improve-codereview-convergence, implementation_plan.md Task 7).
#
# Read-only. Touches no $HOME, runs no script, mutates nothing — every
# fixture lives under test/fixtures/pf-codereview-convergence/ and is only
# ever read.
#
# This suite transcribes the three helpers `/pf-execute`'s completeness gate
# (Task 8, not yet written) will read implementation_plan.md/test_plan.md
# through:
#   pf_execute_all_tasks_checked <plan.md>            — Check 1
#   pf_execute_task_has_test <plan.md> [test_plan.md]  — Check 2 / Check 2b
#   pf_execute_tc_has_task <test_plan.md> <plan.md>    — Check 3
#
# All three parse the LITERAL `**Mapped Test Cases:**` field in a task's own
# heading block — never a TC-ID mentioned anywhere else in that task's prose.
# Getting this backwards is the exact P0 a prior BRD review of this issue
# caught on reversed direction between TC-014 and TC-015 (see
# implementation_plan.md Task 7's Implementation Notes) — the two directions
# are implemented and tested independently of each other below, on purpose.
#
# Task 8 (not landed yet — a separate task in the same issue) is what adds
# the gate itself to skills/pf-execute/SKILL.md. Until then:
#   - TC-013/014/015 helper steps (1-2) are GREEN — pure fixture parsing.
#   - TC-013/014/015 drift-guards (step 3) are RED — the rule they look for
#     is not documented in SKILL.md yet. A RED step 3 alongside GREEN steps
#     1-2 means "rule not implemented", not "harness broken".
#   - TC-016/TC-017 are pure static audits of the same (currently absent)
#     gate block — RED in full, no fixtures involved.
#
# KNOWN, ACCEPTED GAP (see Task 7's Implementation Notes — not fixed here):
# TC-013 only exercises the READING/BLOCKING side of Check 1. It says
# nothing about who actually flips `- [ ]` to `- [x]` in a real run — Task 8
# adds that writing step to Phase 2, but no Auto TC in test_plan.md covers
# the write itself (TC-027's live run is the closest exercise of it,
# incidentally, not by design).

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

FIX="$PF_FIXTURES_DIR/pf-codereview-convergence"
EXEC_SKILL="$REPO_ROOT/skills/pf-execute/SKILL.md"

# ══════════════════════════════════════════════════════════════════════════════
# Helpers under test
# ══════════════════════════════════════════════════════════════════════════════

# pf_execute_all_tasks_checked <plan.md>
#
# Check 1: mechanically scans for any remaining "- [ ]" line anywhere in the
# plan (the same unscoped scan Task 8's Check 1 describes: "Mechanically
# scan implementation_plan.md for any remaining - [ ] line"). Prints the
# first offending line and returns 1 if one is found; prints nothing and
# returns 0 otherwise.
pf_execute_all_tasks_checked() {
  local plan="$1" hit
  hit="$(grep -n -m1 '^- \[ \]' "$plan" 2>/dev/null || true)"
  if [ -z "$hit" ]; then
    return 0
  fi
  printf '%s\n' "$hit"
  return 1
}

# _pf_task_rule_ok <task-type> <mapped-field-text> <acceptance-criteria-text>
#
# Task-Type-aware rule for a single task (Check 2 for `code`, Check 2b for
# `tests`; every other/missing Task Type falls back to the Check 2 / `code`
# rule, matching pf-execute/SKILL.md's own documented missing-field default).
_pf_task_rule_ok() {
  local ttype="$1" mapped="$2" ac="$3"
  case "$ttype" in
    tests)
      # Check 2b: at least one TC-\d+ literal named in Acceptance Criteria.
      printf '%s' "$ac" | grep -qE 'TC-[0-9]+'
      ;;
    *)
      # Check 2: Mapped Test Cases field itself must be non-empty.
      printf '%s' "$mapped" | grep -qE 'TC-[0-9]+'
      ;;
  esac
}

# pf_execute_task_has_test <plan.md> [test_plan.md]
#
# Forward direction (Check 2 / Check 2b). Walks implementation_plan.md task
# by task, reading each task's own **Task Type:**, **Mapped Test Cases:**
# field and **Acceptance Criteria:** block — nothing else in the task's
# prose is ever consulted. Prints the name of every task that fails its
# Task-Type rule (one per line) and returns 1 if any did; returns 0 (no
# output) if every task passed. `test_plan.md` is accepted for signature
# parity with TC-014's transcribed helper call but is not required for this
# direction's own pass/fail rule (Check 3, below, is the direction that
# reads test_plan.md as its primary source).
pf_execute_task_has_test() {
  local plan="$1"
  local failing=()
  local task_name="" task_type="" mapped="" ac_text="" in_ac=0 have_task=0
  local line

  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^####[[:space:]]+(Task[^:]*): ]]; then
      if [ "$have_task" -eq 1 ] && ! _pf_task_rule_ok "$task_type" "$mapped" "$ac_text"; then
        failing+=("$task_name")
      fi
      task_name="${BASH_REMATCH[1]}"
      task_type=""
      mapped=""
      ac_text=""
      in_ac=0
      have_task=1
      continue
    fi

    [ "$have_task" -eq 0 ] && continue

    if [[ "$line" =~ ^\*\*Task[[:space:]]Type:\*\*[[:space:]]*(.*)$ ]]; then
      task_type="$(printf '%s' "${BASH_REMATCH[1]}" | tr '[:upper:]' '[:lower:]' | tr -d '\r')"
      in_ac=0
      continue
    fi

    if [[ "$line" =~ ^\*\*Mapped[[:space:]]Test[[:space:]]Cases:\*\*[[:space:]]*(.*)$ ]]; then
      mapped="${BASH_REMATCH[1]}"
      in_ac=0
      continue
    fi

    if [[ "$line" =~ ^\*\*Acceptance[[:space:]]Criteria:\*\* ]]; then
      in_ac=1
      continue
    fi

    if [ "$line" = '---' ] || [[ "$line" =~ ^\*\*[A-Za-z] ]] || [[ "$line" =~ ^####[[:space:]] ]]; then
      in_ac=0
    fi

    if [ "$in_ac" -eq 1 ]; then
      ac_text="$ac_text
$line"
    fi
  done <"$plan"

  if [ "$have_task" -eq 1 ] && ! _pf_task_rule_ok "$task_type" "$mapped" "$ac_text"; then
    failing+=("$task_name")
  fi

  if [ ${#failing[@]} -eq 0 ]; then
    return 0
  fi
  printf '%s\n' "${failing[@]}"
  return 1
}

# pf_execute_tc_has_task <test_plan.md> <plan.md>
#
# Reverse direction (Check 3). Collects every TC-\d+ that heads a "### TC-…"
# section in test_plan.md, and every TC-\d+ named in some task's own
# **Mapped Test Cases:** field in plan.md — that field, and nothing else in
# the plan's prose (an Overview mention does not count, by design: this is
# the exact reverse of TC-014's negative control, checked independently).
# Prints every TC missing a task (one per line) and returns 1 if any are
# missing; returns 0 (no output) if every TC has one.
pf_execute_tc_has_task() {
  local test_plan="$1" plan="$2"
  local all_tc mapped_tc missing=() tc

  all_tc="$(grep -oE '^### TC-[0-9]+' "$test_plan" 2>/dev/null | grep -oE 'TC-[0-9]+' | LC_ALL=C sort -u)"
  mapped_tc="$(grep -E '^\*\*Mapped Test Cases:\*\*' "$plan" 2>/dev/null | grep -oE 'TC-[0-9]+' | LC_ALL=C sort -u)"

  while IFS= read -r tc; do
    [ -z "$tc" ] && continue
    if ! printf '%s\n' "$mapped_tc" | grep -qx "$tc"; then
      missing+=("$tc")
    fi
  done <<<"$all_tc"

  if [ ${#missing[@]} -eq 0 ]; then
    return 0
  fi
  printf '%s\n' "${missing[@]}"
  return 1
}

# _pf_anchor_slice <file> <anchor-literal> [span-lines]
#
# Anchor-narrowing (test/skills-role-matrix-static.sh's technique): prints
# <span-lines> (default 15) lines of <file> starting at the first line
# containing <anchor> literally. Prints nothing and returns 1 if the anchor
# is not found — the expected outcome today, since Task 8 has not landed.
_pf_anchor_slice() {
  local file="$1" anchor="$2" span="${3:-15}"
  local ln
  ln="$(grep -n -F -- "$anchor" "$file" 2>/dev/null | head -1 | cut -d: -f1)"
  if [ -z "$ln" ]; then
    return 1
  fi
  sed -n "${ln},$((ln + span))p" "$file"
}

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-013: completeness gate — all implementation-plan checkboxes done\n'
# ══════════════════════════════════════════════════════════════════════════════

ALL_CHECKED="$FIX/impl-plan-all-checked.md"
ONE_UNCHECKED="$FIX/impl-plan-one-unchecked.md"

if out="$(pf_execute_all_tasks_checked "$ALL_CHECKED")"; then
  pf_pass "TC-013 step 1: pf_execute_all_tasks_checked(all-checked) == true"
else
  pf_fail "TC-013 step 1: pf_execute_all_tasks_checked(all-checked) unexpectedly false: $out"
fi

if out="$(pf_execute_all_tasks_checked "$ONE_UNCHECKED")"; then
  pf_fail "TC-013 step 2: pf_execute_all_tasks_checked(one-unchecked) unexpectedly true"
else
  pf_pass "TC-013 step 2: pf_execute_all_tasks_checked(one-unchecked) == false, names: ${out#*:}"
fi

if block="$(_pf_anchor_slice "$EXEC_SKILL" 'Check 1' 12)" &&
  printf '%s' "$block" | grep -qiE 'block|blocking|hard stop|блокир|останавлив'; then
  pf_pass "TC-013 step 3: checkbox-completeness rule (Check 1) documented and marked blocking in skills/pf-execute/SKILL.md"
else
  pf_fail "TC-013 step 3: checkbox-completeness rule not documented in SKILL.md (expected RED pending Task 8 — rule not documented in SKILL.md)"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-014: completeness gate — every task has a mapped test (forward)\n'
# ══════════════════════════════════════════════════════════════════════════════

FWD_COMPLETE_PLAN="$FIX/coverage-forward-complete/implementation_plan.md"
FWD_COMPLETE_TP="$FIX/coverage-forward-complete/test_plan.md"
FWD_GAP_PLAN="$FIX/coverage-forward-gap/implementation_plan.md"
FWD_GAP_TP="$FIX/coverage-forward-gap/test_plan.md"

if out="$(pf_execute_task_has_test "$FWD_COMPLETE_PLAN" "$FWD_COMPLETE_TP")"; then
  pf_pass "TC-014 step 1: pf_execute_task_has_test(coverage-forward-complete) == true for every task"
else
  pf_fail "TC-014 step 1: unexpected failing task(s) on forward-complete fixture: $out"
fi

fwd_gap_out="$(pf_execute_task_has_test "$FWD_GAP_PLAN" "$FWD_GAP_TP")"
fwd_gap_rc=$?
if [ "$fwd_gap_rc" -ne 0 ] &&
  printf '%s\n' "$fwd_gap_out" | grep -qx 'Task 3' &&
  ! printf '%s\n' "$fwd_gap_out" | grep -qx 'Task 4'; then
  pf_pass "TC-014 step 2: pf_execute_task_has_test(coverage-forward-gap) flags Task 3 (empty field despite TC-004 prose mention — negative control) and spares Task 4 (tests-typed, TC-005 in Acceptance Criteria — Check 2b branch)"
else
  pf_fail "TC-014 step 2: unexpected result on forward-gap fixture (rc=$fwd_gap_rc, failing task(s): [$fwd_gap_out])"
fi

# Direction self-test: the forward pattern must NOT be satisfied by
# reverse-only phrasing (TC-015's own wording), independent of whether
# SKILL.md has any of this text yet at all.
_pf_fwd_re='(each|every)[^.\n]{0,60}(code )?task[^.\n]{0,80}(has|have|must have)[^.\n]{0,40}test'
_pf_reverse_sample='Every test case is mapped to a task via the Mapped Test Cases field.'
if printf '%s' "$_pf_reverse_sample" | grep -qiE "$_pf_fwd_re"; then
  pf_fail "TC-014 step 3: forward-direction pattern is not direction-specific — it matches reverse-only (TC-015) phrasing"
else
  pf_pass "TC-014 step 3: forward-direction pattern correctly rejects reverse-only phrasing (direction self-test)"
fi

if block="$(_pf_anchor_slice "$EXEC_SKILL" 'Check 2' 12)" &&
  printf '%s' "$block" | grep -qiE "$_pf_fwd_re" &&
  printf '%s' "$block" | grep -q 'Mapped Test Cases'; then
  pf_pass "TC-014 step 3: forward-direction rule ('every code task has a test', tied to Mapped Test Cases) documented in skills/pf-execute/SKILL.md"
else
  pf_fail "TC-014 step 3: forward-direction rule not documented in SKILL.md (expected RED pending Task 8 — rule not documented in SKILL.md)"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-015: completeness gate — every TC has a task (reverse)\n'
# ══════════════════════════════════════════════════════════════════════════════

CONV_COMPLETE_TP="$FIX/coverage-converse-complete/test_plan.md"
CONV_COMPLETE_PLAN="$FIX/coverage-converse-complete/implementation_plan.md"
CONV_GAP_TP="$FIX/coverage-converse-gap/test_plan.md"
CONV_GAP_PLAN="$FIX/coverage-converse-gap/implementation_plan.md"

if out="$(pf_execute_tc_has_task "$CONV_COMPLETE_TP" "$CONV_COMPLETE_PLAN")"; then
  pf_pass "TC-015 step 1: pf_execute_tc_has_task(coverage-converse-complete) == true for every TC"
else
  pf_fail "TC-015 step 1: unexpected missing TC(s) on converse-complete fixture: $out"
fi

conv_gap_out="$(pf_execute_tc_has_task "$CONV_GAP_TP" "$CONV_GAP_PLAN")"
conv_gap_rc=$?
if [ "$conv_gap_rc" -ne 0 ] && printf '%s\n' "$conv_gap_out" | grep -qx 'TC-004'; then
  pf_pass "TC-015 step 2: pf_execute_tc_has_task(coverage-converse-gap) flags TC-004 (not named in any task's Mapped Test Cases field, despite an Overview prose mention — negative control)"
else
  pf_fail "TC-015 step 2: unexpected result on converse-gap fixture (rc=$conv_gap_rc, missing TC(s): [$conv_gap_out])"
fi

# Direction self-test: the reverse pattern must NOT be satisfied by
# forward-only phrasing (TC-014's own wording).
_pf_rev_re='(each|every)[^.\n]{0,60}(test case|TC)[^.\n]{0,80}(is |must be )?mapped[^.\n]{0,40}(to (a|the) )?task'
_pf_forward_sample='Every code task has a test named in its Mapped Test Cases field.'
if printf '%s' "$_pf_forward_sample" | grep -qiE "$_pf_rev_re"; then
  pf_fail "TC-015 step 3: reverse-direction pattern is not direction-specific — it matches forward-only (TC-014) phrasing"
else
  pf_pass "TC-015 step 3: reverse-direction pattern correctly rejects forward-only phrasing (direction self-test)"
fi

if block="$(_pf_anchor_slice "$EXEC_SKILL" 'Check 3' 12)" &&
  printf '%s' "$block" | grep -qiE "$_pf_rev_re" &&
  printf '%s' "$block" | grep -q 'Mapped Test Cases'; then
  pf_pass "TC-015 step 3: reverse-direction rule ('every TC is mapped to a task', tied to Mapped Test Cases), documented separately from the forward check, in skills/pf-execute/SKILL.md"
else
  pf_fail "TC-015 step 3: reverse-direction rule not documented in SKILL.md (expected RED pending Task 8 — rule not documented in SKILL.md)"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-016: completeness gate — all three checks are blocking, not warnings\n'
# ══════════════════════════════════════════════════════════════════════════════

check1_ln="$(grep -n -F 'Check 1' "$EXEC_SKILL" 2>/dev/null | head -1 | cut -d: -f1)"

if [ -z "$check1_ln" ]; then
  pf_fail "TC-016 step 1: completeness-gate block (Check 1/2/3) not found in skills/pf-execute/SKILL.md — rule not documented in SKILL.md"
  pf_fail "TC-016 step 2: cannot confirm Check 1/2/3 are worded as blocking — gate block absent, rule not documented in SKILL.md"
  pf_fail "TC-016 step 3: cannot confirm absence of 'a warning is enough' wording — gate block absent, rule not documented in SKILL.md"
else
  pf_pass "TC-016 step 1: completeness-gate block found at line $check1_ln (Check 1 anchor)"

  missing_blocking=()
  for anchor in "Check 1" "Check 2" "Check 3"; do
    if ! _pf_anchor_slice "$EXEC_SKILL" "$anchor" 15 | grep -qiE 'block|blocking|hard stop|блокир|останавлив'; then
      missing_blocking+=("$anchor")
    fi
  done
  if [ ${#missing_blocking[@]} -eq 0 ]; then
    pf_pass "TC-016 step 2: Check 1, Check 2 and Check 3 are each worded as blocking"
  else
    pf_fail "TC-016 step 2: not worded as blocking near: ${missing_blocking[*]}"
  fi

  gate_tail="$(sed -n "${check1_ln},$((check1_ln + 80))p" "$EXEC_SKILL")"
  if printf '%s' "$gate_tail" | grep -qiE "warning (is enough|suffices)|sufficient.{0,20}warning|достаточно предупреждения|предупреждени.{0,20}(достаточно|хватит)"; then
    pf_fail "TC-016 step 3: found 'a warning is enough'-style wording near the completeness gate"
  else
    pf_pass "TC-016 step 3: no 'a warning is enough' wording found near the completeness gate"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-017: completeness gate — mechanical checks, no model judgment\n'
# ══════════════════════════════════════════════════════════════════════════════

check1_ln2="$(grep -n -F 'Check 1' "$EXEC_SKILL" 2>/dev/null | head -1 | cut -d: -f1)"

if [ -z "$check1_ln2" ]; then
  pf_fail "TC-017 step 1: completeness-gate block not found in skills/pf-execute/SKILL.md — rule not documented in SKILL.md"
  pf_fail "TC-017 step 2: cannot confirm 'mechanical/deterministic' wording — gate block absent, rule not documented in SKILL.md"
  pf_fail "TC-017 step 3: cannot confirm absence of judgment-call wording — gate block absent, rule not documented in SKILL.md"
else
  pf_pass "TC-017 step 1: completeness-gate block found at line $check1_ln2 (Check 1 anchor)"

  gate_tail2="$(sed -n "${check1_ln2},$((check1_ln2 + 80))p" "$EXEC_SKILL")"

  if printf '%s' "$gate_tail2" | grep -qiE 'mechanical|deterministic|механически'; then
    pf_pass "TC-017 step 2: 'mechanical'/'deterministic' wording found near the completeness gate"
  else
    pf_fail "TC-017 step 2: no 'mechanical'/'deterministic' wording found near the completeness gate"
  fi

  if printf '%s' "$gate_tail2" | grep -qiE 'judge|decide whether|на усмотрение|по вашему мнению'; then
    pf_fail "TC-017 step 3: found judgment-call wording ('judge'/'decide whether'/'на усмотрение') near the completeness gate"
  else
    pf_pass "TC-017 step 3: no judgment-call wording found near the completeness gate"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════

assert_repo_untouched

pf_summary
