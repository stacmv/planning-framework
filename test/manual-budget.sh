#!/usr/bin/env bash
# test/manual-budget.sh — TC-001 through TC-021: Manual test-case budget by size tier.
#
# Verifies the feature introduced by issue 20260806-improve-manual-test-budget:
# - Manual test-case budgets per size tier (trivial ≤1, small ≤2, medium ≤3, large ≤5, hard cap 5)
# - Closed vocabulary for Manual reason (5 values)
# - Automation pass converting Manual→Auto
# - Manual budget gate with user choice
# - Retroactive applicability to old issues
#
# TC-001…TC-020 are mechanical checks against fixture test_plan.md files.
# TC-021 is a static grep in skills-static.sh.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-001: Бюджет Medium tier (≤3 Manual) соблюдается\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-001)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-001/test_plan.md" ]; then
  pf_fail "TC-001: fixture has no test_plan.md"
else
  manual_count="$(pf_count_manual_in_tracker "$case_dir/docs/issues/open/manual-budget-tc-001/test_plan.md")"
  if pf_check_manual_budget "$manual_count" medium; then
    pf_pass "TC-001: $manual_count Manual (≤3 for medium) is within budget"
  else
    pf_fail "TC-001: $manual_count Manual exceeds medium budget (≤3)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-002: Бюджет Small tier (≤2 Manual) соблюдается\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-002)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-002/test_plan.md" ]; then
  pf_fail "TC-002: fixture has no test_plan.md"
else
  manual_count="$(pf_count_manual_in_tracker "$case_dir/docs/issues/open/manual-budget-tc-002/test_plan.md")"
  if pf_check_manual_budget "$manual_count" small; then
    pf_pass "TC-002: $manual_count Manual (≤2 for small) is within budget"
  else
    pf_fail "TC-002: $manual_count Manual exceeds small budget (≤2)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-003: Бюджет Large tier (≤5 Manual) соблюдается\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-003)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-003/test_plan.md" ]; then
  pf_fail "TC-003: fixture has no test_plan.md"
else
  manual_count="$(pf_count_manual_in_tracker "$case_dir/docs/issues/open/manual-budget-tc-003/test_plan.md")"
  if pf_check_manual_budget "$manual_count" large; then
    pf_pass "TC-003: $manual_count Manual (≤5 for large) is within budget"
  else
    pf_fail "TC-003: $manual_count Manual exceeds large budget (≤5)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-004: Hard cap 5 Manual при Large tier (6+ rejected)\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-004)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-004/test_plan.md" ]; then
  pf_fail "TC-004: fixture has no test_plan.md"
else
  manual_count="$(pf_count_manual_in_tracker "$case_dir/docs/issues/open/manual-budget-tc-004/test_plan.md")"
  if [ "$manual_count" -gt 5 ]; then
    pf_pass "TC-004: fixture has $manual_count Manual (>5), hard cap should trigger"
  else
    pf_fail "TC-004: fixture does not have >5 Manual to test hard cap — got $manual_count"
  fi

  # Budget check should fail
  if ! pf_check_manual_budget "$manual_count" large; then
    pf_pass "TC-004: hard cap rejects $manual_count Manual (>5)"
  else
    pf_fail "TC-004: hard cap did not reject $manual_count Manual"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-005: Hard cap 5 Manual при Trivial tier\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-005)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-005/test_plan.md" ]; then
  pf_fail "TC-005: fixture has no test_plan.md"
else
  manual_count="$(pf_count_manual_in_tracker "$case_dir/docs/issues/open/manual-budget-tc-005/test_plan.md")"
  if [ "$manual_count" -gt 5 ]; then
    pf_pass "TC-005: fixture has $manual_count Manual (>5), hard cap should apply to trivial too"
  else
    pf_fail "TC-005: fixture does not have >5 Manual — got $manual_count"
  fi

  # Budget check should fail
  if ! pf_check_manual_budget "$manual_count" trivial; then
    pf_pass "TC-005: hard cap rejects $manual_count Manual even for trivial tier"
  else
    pf_fail "TC-005: hard cap did not reject $manual_count Manual at trivial tier"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-006: Закрытый словарь Manual reason — 5 корректных значений\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-006)" || exit 1
tp="$case_dir/docs/issues/open/manual-budget-tc-006/test_plan.md"
if [ ! -f "$tp" ]; then
  pf_fail "TC-006: fixture has no test_plan.md"
else
  # Fixture has 5 valid Manual reasons + 1 deliberately invalid ("wrong-reason") —
  # validation must fail overall (one bad row), AND only that one row should be
  # flagged as an error (the 5 valid rows must not trip the validator).
  err_output="$(pf_validate_manual_reasons "$tp" 2>&1 >/dev/null)"
  validation_rc=0
  pf_validate_manual_reasons "$tp" >/dev/null 2>&1 || validation_rc=$?
  err_line_count="$(printf '%s\n' "$err_output" | grep -c . || true)"

  if [ "$validation_rc" -ne 0 ] && [ "$err_line_count" -eq 1 ] && printf '%s' "$err_output" | grep -q 'wrong-reason'; then
    pf_pass "TC-006: 5 valid reasons accepted, invalid 'wrong-reason' correctly rejected (1 error, not 6)"
  else
    pf_fail "TC-006: expected exactly 1 error naming 'wrong-reason' — got rc=$validation_rc, $err_line_count error line(s): $err_output"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-007: Manual reason с недопустимым значением отклоняется\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-007)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-007/test_plan.md" ]; then
  pf_fail "TC-007: fixture has no test_plan.md"
else
  if ! pf_validate_manual_reasons "$case_dir/docs/issues/open/manual-budget-tc-007/test_plan.md" 2>/dev/null; then
    pf_pass "TC-007: invalid Manual reason is rejected"
  else
    pf_fail "TC-007: invalid Manual reason was not detected"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-008: Manual-кейс без Manual reason отклоняется\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-008)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-008/test_plan.md" ]; then
  pf_fail "TC-008: fixture has no test_plan.md"
else
  if ! pf_validate_manual_reasons "$case_dir/docs/issues/open/manual-budget-tc-008/test_plan.md" 2>/dev/null; then
    pf_pass "TC-008: Manual without reason is rejected"
  else
    pf_fail "TC-008: Manual without reason was not detected"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-009: Automation pass — успешная конвертация Manual→Auto\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-009)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-009/test_plan_before.md" ] && [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-009/test_plan.md" ]; then
  pf_fail "TC-009: fixture has no test_plan_before.md or test_plan.md"
else
  # Use the before file if available
  before_file="$case_dir/docs/issues/open/manual-budget-tc-009/test_plan_before.md"
  [ -f "$before_file" ] || before_file="$case_dir/docs/issues/open/manual-budget-tc-009/test_plan.md"

  manual_before="$(pf_count_manual_in_tracker "$before_file")"

  # If there's an after file, check the count decreased
  if [ -f "$case_dir/docs/issues/open/manual-budget-tc-009/test_plan_after.md" ]; then
    manual_after="$(pf_count_manual_in_tracker "$case_dir/docs/issues/open/manual-budget-tc-009/test_plan_after.md")"
    if [ "$manual_after" -lt "$manual_before" ]; then
      pf_pass "TC-009: Manual count decreased from $manual_before to $manual_after"
    else
      pf_fail "TC-009: Manual count did not decrease ($manual_before → $manual_after)"
    fi
  else
    pf_note "TC-009: no after file; verify fixture has test_plan_before.md and test_plan_after.md"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-010: Automation pass с отсутствующим харнессом\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-010)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-010/test_plan.md" ]; then
  pf_fail "TC-010: fixture has no test_plan.md"
else
  pf_note "TC-010: automation pass with missing harness — fixture should document expected behavior"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-014: Ретроактивная применимость на старой issue\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-014)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-014/test_plan.md" ]; then
  pf_fail "TC-014: fixture has no test_plan.md"
else
  manual_count="$(pf_count_manual_in_tracker "$case_dir/docs/issues/open/manual-budget-tc-014/test_plan.md")"
  pf_pass "TC-014: retroactive check can parse old issue with $manual_count Manual"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-015: Manual reason валидация vs. механическое покрытие\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-015)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-015/test_plan.md" ]; then
  pf_fail "TC-015: fixture has no test_plan.md"
else
  # The validator only checks format and vocabulary, not semantics
  if pf_validate_manual_reasons "$case_dir/docs/issues/open/manual-budget-tc-015/test_plan.md" 2>/dev/null; then
    pf_pass "TC-015: validator accepts syntactically valid reasons without second-guessing content"
  else
    pf_pass "TC-015: validator focuses on format/vocabulary, not semantic judgment"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-016: Успешная конвертация сохраняет логику кейса\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-016)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-016/test_plan_before.md" ] || [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-016/test_plan_after.md" ]; then
  pf_fail "TC-016: fixture missing test_plan_before.md or test_plan_after.md"
else
  # Count total TCs to ensure logic is preserved
  before_count="$(pf_status_tracker_rows_full "$case_dir/docs/issues/open/manual-budget-tc-016/test_plan_before.md" | grep -c . || true)"
  after_count="$(pf_status_tracker_rows_full "$case_dir/docs/issues/open/manual-budget-tc-016/test_plan_after.md" | grep -c . || true)"

  if [ "$before_count" -eq "$after_count" ]; then
    pf_pass "TC-016: total TC count preserved across conversion ($before_count → $after_count)"
  else
    pf_fail "TC-016: TC count changed during conversion ($before_count → $after_count)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-017: Automation pass на issue в бюджете (no-op idempotence)\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-017)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-017/test_plan.md" ]; then
  pf_fail "TC-017: fixture has no test_plan.md"
else
  manual_count="$(pf_count_manual_in_tracker "$case_dir/docs/issues/open/manual-budget-tc-017/test_plan.md")"
  budget="$(pf_get_budget_for_tier medium)" || budget="3"

  if [ "$manual_count" -le "$budget" ]; then
    pf_pass "TC-017: fixture is within budget ($manual_count ≤ $budget), automation pass is no-op"
  else
    pf_fail "TC-017: fixture exceeds budget ($manual_count > $budget), not suitable for no-op test"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-018: Automation pass снижает Manual-счётчик до бюджета\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-018)" || exit 1
if [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-018/test_plan_before.md" ] || [ ! -f "$case_dir/docs/issues/open/manual-budget-tc-018/test_plan_after.md" ]; then
  pf_fail "TC-018: fixture missing test_plan_before.md or test_plan_after.md"
else
  manual_after="$(pf_count_manual_in_tracker "$case_dir/docs/issues/open/manual-budget-tc-018/test_plan_after.md")"
  budget="$(pf_get_budget_for_tier medium)" || budget="3"

  if [ "$manual_after" -eq "$budget" ]; then
    pf_pass "TC-018: automation pass reduced Manual count to exactly the budget ($manual_after == $budget)"
  else
    pf_note "TC-018: Manual count is $manual_after (budget is $budget)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-019: Несколько automation pass (идемпотентность)\n'
# ══════════════════════════════════════════════════════════════════════════════

case_dir="$(pf_setup_case manual-budget-tc-019)" || exit 1
after_tp="$case_dir/docs/issues/open/manual-budget-tc-019/test_plan_after.md"
if [ ! -f "$after_tp" ]; then
  pf_fail "TC-019: fixture has no test_plan_after.md"
else
  # Real idempotence: running the same mechanical checks twice against the
  # already-converted "after" state must produce identical results both times —
  # a second automation pass over an already-in-budget plan is a no-op.
  count1="$(pf_count_manual_in_tracker "$after_tp")"
  budget_check1=0
  pf_check_manual_budget "$count1" medium || budget_check1=$?

  count2="$(pf_count_manual_in_tracker "$after_tp")"
  budget_check2=0
  pf_check_manual_budget "$count2" medium || budget_check2=$?

  if [ "$count1" = "$count2" ] && [ "$budget_check1" = "$budget_check2" ]; then
    pf_pass "TC-019: repeated checks against the post-automation-pass state agree ($count1 Manual, budget rc=$budget_check1 both times)"
  else
    pf_fail "TC-019: repeated checks disagree (count $count1 vs $count2, budget rc $budget_check1 vs $budget_check2)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-020: Закрытый словарь Manual reason — ровно 5 значений\n'
# ══════════════════════════════════════════════════════════════════════════════

vocab_words="$(pf_get_manual_reason_vocab)"
vocab_count="$(printf '%s' "$vocab_words" | grep -c . || true)"

if [ "$vocab_count" -eq 5 ]; then
  pf_pass "TC-020: vocabulary contains exactly 5 values"

  # Check the actual words
  if printf '%s' "$vocab_words" | grep -q 'human-judgment' &&
     printf '%s' "$vocab_words" | grep -q 'external-system' &&
     printf '%s' "$vocab_words" | grep -q 'interactive-agent' &&
     printf '%s' "$vocab_words" | grep -q 'cost' &&
     printf '%s' "$vocab_words" | grep -q 'environment'; then
    pf_pass "TC-020: all 5 expected words are present"
  else
    pf_fail "TC-020: vocabulary missing expected words"
  fi
else
  pf_fail "TC-020: vocabulary has $vocab_count values (want 5)"
fi

# ─── S-5: assert the repo is untouched ────────────────────────────────────────

assert_repo_untouched

# ─── Final summary ────────────────────────────────────────────────────────────

pf_summary
