#!/usr/bin/env bash
# test/skills-role-matrix-static.sh — TC-009, TC-014 (20260806-feat-role-matrix).
#
# The only two TCs in that issue's test_plan.md marked Type: Auto. Both are
# grep-based structural audits of skills/, in the same spirit as
# skills-static.sh's defect-5 coverage: read-only, no ~/.claude/skills
# involved, asserts the SHAPE the test plan's own Steps describe rather than
# re-deriving new assertions.
#
# Read-only. It runs no script, touches no $HOME, and mutates nothing.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

SKILLS="$REPO_ROOT/skills"
ROLES="$SKILLS/pf-roles/SKILL.md"
PF="$SKILLS/pf/SKILL.md"

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-009: pf-roles reference-skill — structural completeness\n'
# ══════════════════════════════════════════════════════════════════════════════

if [ ! -f "$ROLES" ]; then
  pf_fail "TC-009: skills/pf-roles/SKILL.md does not exist"
else
  # ─── Step 1: both schemas documented ────────────────────────────────────────
  if grep -qn "roles:" "$ROLES"; then
    pf_pass "TC-009 step 1: roles: schema documented"
  else
    pf_fail "TC-009 step 1: roles: schema not found"
  fi

  if grep -qn -E "agents\.yml|role-profiles\.yml" "$ROLES"; then
    pf_pass "TC-009 step 1: agents.yml/role-profiles.yml schema documented"
  else
    pf_fail "TC-009 step 1: agents.yml/role-profiles.yml schema not found"
  fi

  # ─── Step 2: fallback order, all levels ─────────────────────────────────────
  if grep -qiE "явная запись.*профил|profile.*tier.*default|fallback" "$ROLES"; then
    pf_pass "TC-009 step 2: fallback order documented"
  else
    pf_fail "TC-009 step 2: fallback order not found"
  fi

  # ─── Step 3: sequential mode mechanics ──────────────────────────────────────
  if grep -qiE "sequential" "$ROLES"; then
    pf_pass "TC-009 step 3: sequential review mode documented"
  else
    pf_fail "TC-009 step 3: sequential review mode not found"
  fi

  # ─── Step 4: every listed consumer references pf-roles/SKILL.md ────────────
  CONSUMERS="pf pf-brd pf-spec pf-test-plan pf-impl-plan pf-check pf-codereview pf-execute pf-user-docs pf-dev-docs pf-qa"
  missing=()
  for c in $CONSUMERS; do
    f="$SKILLS/$c/SKILL.md"
    if [ ! -f "$f" ] || ! grep -q "pf-roles/SKILL.md" "$f"; then
      missing+=("$c")
    fi
  done
  if [ ${#missing[@]} -eq 0 ]; then
    pf_pass "TC-009 step 4: all eleven consumers reference pf-roles/SKILL.md"
  else
    pf_fail "TC-009 step 4: missing reference in: ${missing[*]}"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-014: pipeline routing — user_docs/dev_docs between TESTING and QA\n'
# ══════════════════════════════════════════════════════════════════════════════

if [ ! -f "$PF" ]; then
  pf_fail "TC-014: skills/pf/SKILL.md does not exist"
else
  # ─── Steps 1-2: TESTING -> user_docs -> dev_docs -> QA, in order ───────────
  # Checked once per routing table (feat/improve share one shape; bug has its
  # own) by walking the ordered line numbers of each anchor within that table's
  # section, exactly as test_plan.md's own Step 1/Step 2 describe.
  check_order() {
    local label="$1" start="$2" end="$3"
    local seq
    # Table rows only (start with "| ") — excludes the diagram legend line,
    # whose single line otherwise carries every anchor at once.
    seq="$(sed -n "${start},${end}p" "$PF" | grep -nE '^\|' | grep -E "TESTING|user_docs|dev_docs|QA" | head -20)"
    local testing_line user_docs_line dev_docs_line qa_line
    testing_line="$(printf '%s\n' "$seq" | grep -m1 -E '^[0-9]+:\| TESTING ' | cut -d: -f1)"
    user_docs_line="$(printf '%s\n' "$seq" | grep -m1 "user_docs" | cut -d: -f1)"
    dev_docs_line="$(printf '%s\n' "$seq" | grep -m1 "dev_docs" | cut -d: -f1)"
    qa_line="$(printf '%s\n' "$seq" | grep -m1 -E '^[0-9]+:\| QA ' | cut -d: -f1)"

    if [ -z "$testing_line" ] || [ -z "$user_docs_line" ] || [ -z "$dev_docs_line" ] || [ -z "$qa_line" ]; then
      pf_fail "$label: one of TESTING/user_docs/dev_docs/QA not found in range ${start}-${end}"
    elif [ "$testing_line" -le "$user_docs_line" ] && [ "$user_docs_line" -le "$dev_docs_line" ] && [ "$dev_docs_line" -le "$qa_line" ]; then
      pf_pass "$label: TESTING -> user_docs -> dev_docs -> QA, in order"
    else
      pf_fail "$label: rows out of order (TESTING=$testing_line user_docs=$user_docs_line dev_docs=$dev_docs_line QA=$qa_line)"
    fi
  }

  feat_start="$(grep -n '^### feat workflow' "$PF" | head -1 | cut -d: -f1)"
  bug_start="$(grep -n '^### bug workflow' "$PF" | head -1 | cut -d: -f1)"

  if [ -n "$feat_start" ] && [ -n "$bug_start" ]; then
    check_order "TC-014 step 1: feat/improve routing table" "$feat_start" "$((bug_start - 1))"
    check_order "TC-014 step 2: bug routing table" "$bug_start" '$'
  else
    pf_fail "TC-014 steps 1-2: could not locate feat/bug workflow sections in pf/SKILL.md"
  fi

  # ─── Step 3: skip-display format documented verbatim ───────────────────────
  if grep -qiE "skipped.*roles\.(user_docs|dev_docs)" "$PF"; then
    pf_pass "TC-014 step 3: skip-display format documented"
  else
    pf_fail "TC-014 step 3: skip-display format (skipped (roles.user_docs|dev_docs: skip)) not found"
  fi
fi

pf_summary
