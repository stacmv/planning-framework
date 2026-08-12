#!/usr/bin/env bash
# test/pf-codereview-rounds.sh — TC-001..004 (20260806-improve-codereview-convergence).
#
# Round budget & escalation (US-1) for skills/pf-codereview/SKILL.md. Per this
# issue's implementation_plan.md Task 1, each TC below is two inseparable
# halves in the same case:
#   1. a transcribed bash helper exercised against fixtures under
#      test/fixtures/pf-codereview-convergence/ — pure logic, no dependency on
#      the real SKILL.md text, GREEN from the start;
#   2. a drift-guard that greps the real skills/pf-codereview/SKILL.md for the
#      rule the helper encodes — expected RED until this issue's Task 2 lands
#      (test-first, per test_plan.md's Overview point 3).
#
# A drift-guard failure message always says "rule not documented in SKILL.md"
# — that is the ONLY reason a drift-guard step should be RED right now. A
# missing fixture, a missing SKILL.md, or a helper that cannot run is reported
# as "(infra)" instead, so the two causes are never confused (test_plan.md's
# own requirement, restated in this issue's implementation_plan.md Task 1
# Implementation Notes).
#
# Anchor-narrowing (TC-002 step 4, TC-003 step 4, TC-004): each drift-guard
# below locates the relevant section by its own heading/introductory phrase
# FIRST, then greps only inside that narrowed line range. A bare unscoped grep
# would false-positive: skills/pf-codereview/SKILL.md already mentions
# `/pf-execute` and `PASS` in several unrelated places (Phase 0's prerequisite
# messages, Phase 3's verdict rules) that have nothing to do with round
# budgets. See test/skills-role-matrix-static.sh's check_order for the same
# technique applied to a different skill.
#
# Read-only. Touches no $HOME, runs no script, mutates nothing — fixtures are
# read, never written (S-3); skills/pf-codereview/SKILL.md is read, never
# edited (that file is Task 2's job, not this suite's).

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

SKILL="$REPO_ROOT/skills/pf-codereview/SKILL.md"
FIXDIR="$PF_FIXTURES_DIR/pf-codereview-convergence"

# ─── shared anchor-narrowing helper ────────────────────────────────────────

# _pf_cr_block <file> <start-pattern> [end-pattern]
#
# Locates the first line matching <start-pattern> (extended regex, case-
# insensitive) and prints the text from that line up to (but not including)
# the next line matching <end-pattern> (default: the next "## " heading), or
# to end of file if no such line follows. Prints nothing and returns 1 if
# <start-pattern> is not found anywhere — the caller reads that as "rule not
# documented", never as an infra error, because SKILL.md itself was found and
# read fine; it just doesn't contain the section yet.
_pf_cr_block() {
  local file="$1" start_pat="$2" end_pat="${3:-^## }"
  local start after_start rest end

  start="$(grep -inE -m1 -- "$start_pat" "$file" | cut -d: -f1)"
  [ -z "$start" ] && return 1

  after_start=$((start + 1))
  rest="$(tail -n "+${after_start}" "$file" | grep -inE -m1 -- "$end_pat" | cut -d: -f1)"
  if [ -n "$rest" ]; then
    end=$((start + rest))
  else
    end='$'
  fi
  sed -n "${start},${end}p" "$file"
}

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-001: review_rounds field in prompt.md, default 3\n'
# ══════════════════════════════════════════════════════════════════════════════

# Transcribed helper: pf_cr_review_rounds <prompt.md> — reads review_rounds:
# from the frontmatter; default 3 when the field is absent.
pf_cr_review_rounds() {
  local file="$1" val
  val="$(sed -n 's/^review_rounds:[[:space:]]*//p' "$file" | head -1 | tr -d '[:space:]')"
  printf '%s' "${val:-3}"
}

if [ ! -f "$FIXDIR/with-rounds-5/prompt.md" ]; then
  pf_fail "TC-001 step 1: (infra) fixture missing — $FIXDIR/with-rounds-5/prompt.md"
else
  got="$(pf_cr_review_rounds "$FIXDIR/with-rounds-5/prompt.md")"
  if [ "$got" = "5" ]; then
    pf_pass "TC-001 step 1: pf_cr_review_rounds reads review_rounds: 5 from with-rounds-5/prompt.md"
  else
    pf_fail "TC-001 step 1: expected 5, got '$got'"
  fi
fi

if [ ! -f "$FIXDIR/no-rounds-field/prompt.md" ]; then
  pf_fail "TC-001 step 2: (infra) fixture missing — $FIXDIR/no-rounds-field/prompt.md"
else
  got="$(pf_cr_review_rounds "$FIXDIR/no-rounds-field/prompt.md")"
  if [ "$got" = "3" ]; then
    pf_pass "TC-001 step 2: pf_cr_review_rounds defaults to 3 when review_rounds is absent"
  else
    pf_fail "TC-001 step 2: expected default 3, got '$got'"
  fi
fi

if [ ! -f "$SKILL" ]; then
  pf_fail "TC-001 step 3: (infra) skills/pf-codereview/SKILL.md not found"
elif ! grep -qn "review_rounds" "$SKILL"; then
  pf_fail "TC-001 step 3: rule not documented in SKILL.md — 'review_rounds' is not mentioned at all"
else
  hit="$(grep -n "review_rounds" "$SKILL" | head -1 | cut -d: -f1)"
  window_start=$((hit > 3 ? hit - 3 : 1))
  window="$(sed -n "${window_start},$((hit + 3))p" "$SKILL")"
  if printf '%s\n' "$window" | grep -qE '(^|[^0-9])3([^0-9]|$)'; then
    pf_pass "TC-001 step 3: review_rounds field and its default (3) are documented together in SKILL.md"
  else
    pf_fail "TC-001 step 3: rule not documented in SKILL.md — 'review_rounds' found but no default of 3 documented nearby"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-002: early bail-out — >=3 blocking findings in round 1\n'
# ══════════════════════════════════════════════════════════════════════════════

# Transcribed helper: pf_cr_round1_decision <findings-fixture> — counts the
# P0+P1 entries (the range from "### P0" through, but not including, "### P2")
# and returns escalate-to-execute at >=3, fix-cycle below that.
pf_cr_round1_decision() {
  local file="$1" blocking
  blocking="$(sed -n '/^### P0/,/^### P2/p' "$file" | grep -c '^- ')"
  if [ "$blocking" -ge 3 ]; then
    printf 'escalate-to-execute'
  else
    printf 'fix-cycle'
  fi
}

if [ ! -f "$FIXDIR/round1-2-blocking.md" ]; then
  pf_fail "TC-002 step 1: (infra) fixture missing — $FIXDIR/round1-2-blocking.md"
else
  got="$(pf_cr_round1_decision "$FIXDIR/round1-2-blocking.md")"
  if [ "$got" = "fix-cycle" ]; then
    pf_pass "TC-002 step 1: pf_cr_round1_decision(2 blocking) = fix-cycle"
  else
    pf_fail "TC-002 step 1: expected fix-cycle, got '$got'"
  fi
fi

if [ ! -f "$FIXDIR/round1-3-blocking.md" ]; then
  pf_fail "TC-002 step 2: (infra) fixture missing — $FIXDIR/round1-3-blocking.md"
else
  got="$(pf_cr_round1_decision "$FIXDIR/round1-3-blocking.md")"
  if [ "$got" = "escalate-to-execute" ]; then
    pf_pass "TC-002 step 2: pf_cr_round1_decision(3 blocking) = escalate-to-execute"
  else
    pf_fail "TC-002 step 2: expected escalate-to-execute, got '$got'"
  fi
fi

if [ ! -f "$FIXDIR/round1-4-blocking.md" ]; then
  pf_fail "TC-002 step 3: (infra) fixture missing — $FIXDIR/round1-4-blocking.md"
else
  got="$(pf_cr_round1_decision "$FIXDIR/round1-4-blocking.md")"
  if [ "$got" = "escalate-to-execute" ]; then
    pf_pass "TC-002 step 3: pf_cr_round1_decision(4 blocking) = escalate-to-execute"
  else
    pf_fail "TC-002 step 3: expected escalate-to-execute, got '$got'"
  fi
fi

if [ ! -f "$SKILL" ]; then
  pf_fail "TC-002 step 4: (infra) skills/pf-codereview/SKILL.md not found"
else
  block="$(_pf_cr_block "$SKILL" 'phase 3\.5|round 1 early bail')"
  if [ -z "$block" ]; then
    pf_fail "TC-002 step 4: rule not documented in SKILL.md — no Phase 3.5 / round-1 early-bail-out section found"
  else
    threshold=0
    destination=0
    plan_tasks=0
    # CR-004: the digit/word must sit right next to the threshold phrase
    # itself ("<N|three> or more block...") — NOT just anywhere in the whole
    # Phase 3.5 block. A bare whole-block search for a lone "3" is satisfied
    # by this same block's own introductory sentence ("This check runs
    # immediately after Phase 3 first writes…"), which supplies a "3" from
    # "Phase 3" regardless of what the real escalation threshold says.
    # Flattened to one line first so the anchor still works if this paragraph
    # is ever hard-wrapped across multiple physical lines.
    flat_block="$(printf '%s' "$block" | tr '\n' ' ')"
    if printf '%s\n' "$block" | grep -qiE 'round 1' &&
      printf '%s' "$flat_block" | grep -qiE '(^|[^0-9])3[[:space:]]+or[[:space:]]+more[[:space:]]+block|\bthree[[:space:]]+or[[:space:]]+more[[:space:]]+block'; then
      threshold=1
    fi
    printf '%s\n' "$block" | grep -qE '/pf-execute' && destination=1
    printf '%s\n' "$block" | grep -qiE 'implementation_plan\.md' && plan_tasks=1

    if [ "$threshold" -eq 1 ] && [ "$destination" -eq 1 ] && [ "$plan_tasks" -eq 1 ]; then
      pf_pass "TC-002 step 4: round-1 >=3-blocking early bail-out (-> /pf-execute, findings -> implementation_plan.md tasks) documented together"
    else
      missing=""
      [ "$threshold" -eq 0 ] && missing="${missing}round1+threshold+blocking "
      [ "$destination" -eq 0 ] && missing="${missing}/pf-execute-destination "
      [ "$plan_tasks" -eq 0 ] && missing="${missing}implementation_plan.md-tasks "
      pf_fail "TC-002 step 4: rule not documented in SKILL.md — missing signal(s): ${missing}"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-003: budget exhaustion — return to /pf-execute, never PASS, never an infinite loop\n'
# ══════════════════════════════════════════════════════════════════════════════

# Transcribed helper: pf_cr_budget_decision <round> <budget> <open_blocking>
_pf_cr_read_field() {
  local file="$1" field="$2"
  sed -n "s/^${field}:[[:space:]]*//p" "$file" | head -1 | tr -d '[:space:]'
}

pf_cr_budget_decision() {
  local round="$1" budget="$2" open_blocking="$3"
  if [ "$round" -lt "$budget" ]; then
    printf 'continue-fix-cycle'
  elif [ "$open_blocking" -eq 0 ]; then
    printf 'pass'
  else
    printf 'return-to-execute'
  fi
}

if [ ! -f "$FIXDIR/budget-exhausted-open.md" ]; then
  pf_fail "TC-003 step 1: (infra) fixture missing — $FIXDIR/budget-exhausted-open.md"
else
  fx="$FIXDIR/budget-exhausted-open.md"
  round="$(_pf_cr_read_field "$fx" round)"
  budget="$(_pf_cr_read_field "$fx" budget)"
  open_blocking="$(_pf_cr_read_field "$fx" open_blocking)"
  got="$(pf_cr_budget_decision "$round" "$budget" "$open_blocking")"
  if [ "$got" = "return-to-execute" ]; then
    pf_pass "TC-003 step 1: pf_cr_budget_decision(round=budget, open_blocking>0) = return-to-execute"
  else
    pf_fail "TC-003 step 1: expected return-to-execute, got '$got'"
  fi
fi

# Step 1b (CR-001): round > budget, not just round == budget. The ledger's
# round counter is append-only and never resets — including across this
# exact escalation path — so a later cycle's first fresh round can already
# start above the budget. Before CR-001, Phase 4 branched only on
# `round < review_rounds` and `round == review_rounds`; a round strictly
# greater than the budget fell into neither branch. The helper above already
# uses `-lt`/`else` rather than `-eq`, so it was never the gap — this fixture
# is what was missing (test_plan.md's TC-003 Preconditions never listed a
# round > budget case at all).
if [ ! -f "$FIXDIR/budget-exceeded-open.md" ]; then
  pf_fail "TC-003 step 1b: (infra) fixture missing — $FIXDIR/budget-exceeded-open.md"
else
  fx="$FIXDIR/budget-exceeded-open.md"
  round="$(_pf_cr_read_field "$fx" round)"
  budget="$(_pf_cr_read_field "$fx" budget)"
  open_blocking="$(_pf_cr_read_field "$fx" open_blocking)"
  got="$(pf_cr_budget_decision "$round" "$budget" "$open_blocking")"
  if [ "$got" = "return-to-execute" ]; then
    pf_pass "TC-003 step 1b: pf_cr_budget_decision(round=4, budget=3, open_blocking>0) = return-to-execute — round > budget is also exhausted, not just round == budget"
  else
    pf_fail "TC-003 step 1b: expected return-to-execute, got '$got'"
  fi
fi

if [ ! -f "$FIXDIR/budget-remaining-open.md" ]; then
  pf_fail "TC-003 step 2: (infra) fixture missing — $FIXDIR/budget-remaining-open.md"
else
  fx="$FIXDIR/budget-remaining-open.md"
  round="$(_pf_cr_read_field "$fx" round)"
  budget="$(_pf_cr_read_field "$fx" budget)"
  open_blocking="$(_pf_cr_read_field "$fx" open_blocking)"
  got="$(pf_cr_budget_decision "$round" "$budget" "$open_blocking")"
  if [ "$got" = "continue-fix-cycle" ]; then
    pf_pass "TC-003 step 2: pf_cr_budget_decision(round<budget, open_blocking>0) = continue-fix-cycle"
  else
    pf_fail "TC-003 step 2: expected continue-fix-cycle, got '$got'"
  fi
fi

if [ ! -f "$FIXDIR/budget-exhausted-clean.md" ]; then
  pf_fail "TC-003 step 3: (infra) fixture missing — $FIXDIR/budget-exhausted-clean.md"
else
  fx="$FIXDIR/budget-exhausted-clean.md"
  round="$(_pf_cr_read_field "$fx" round)"
  budget="$(_pf_cr_read_field "$fx" budget)"
  open_blocking="$(_pf_cr_read_field "$fx" open_blocking)"
  got="$(pf_cr_budget_decision "$round" "$budget" "$open_blocking")"
  if [ "$got" = "pass" ]; then
    pf_pass "TC-003 step 3: pf_cr_budget_decision(round=budget, open_blocking=0) = pass — a clean round closes the cycle regardless of round number"
  else
    pf_fail "TC-003 step 3: expected pass, got '$got'"
  fi
fi

if [ ! -f "$SKILL" ]; then
  pf_fail "TC-003 step 4: (infra) skills/pf-codereview/SKILL.md not found"
else
  # Anchor-narrow to the "Budget exhaustion" block Task 2 adds, the same
  # technique required for TC-002/TC-004 — a bare unscoped grep for
  # "/pf-execute" and "PASS" would false-positive on Phase 0's prerequisite
  # messages and Phase 3's verdict rules elsewhere in this same file.
  #
  # Anchor on the block's OWN bold heading, not on any mention of the phrase.
  # The earlier anchor ('budget exhaustion', case-insensitive) matched the
  # cross-reference inside the PASS branch above it — "see Budget exhaustion
  # immediately below" — and then ran to the next bold line, so the block it
  # returned happened to include the real paragraph and the step passed for the
  # wrong reason. It broke the moment another paragraph was inserted between the
  # two, which is how this was found. Anchoring on the heading makes the step
  # independent of what sits above it.
  block="$(_pf_cr_block "$SKILL" '^\*\*Budget exhaustion' '^(\*\*|## )')"
  if [ -z "$block" ]; then
    pf_fail "TC-003 step 4: rule not documented in SKILL.md — no 'Budget exhaustion' section found"
  else
    returns_to_execute=0
    never_pass_never_loop=0
    if printf '%s\n' "$block" | grep -qi 'budget' &&
      printf '%s\n' "$block" | grep -qi 'exhaust' &&
      printf '%s\n' "$block" | grep -qE '/pf-execute'; then
      returns_to_execute=1
    fi
    if printf '%s\n' "$block" | grep -qiE 'not[^.]*\bPASS\b|never[^.]*\bPASS\b' &&
      printf '%s\n' "$block" | grep -qiE 'infinite loop|endless loop|loop (again|forever|indefinitely)|not[^.]*loop again'; then
      never_pass_never_loop=1
    fi

    if [ "$returns_to_execute" -eq 1 ] && [ "$never_pass_never_loop" -eq 1 ]; then
      pf_pass "TC-003 step 4: budget exhaustion -> return to /pf-execute AND never-PASS/never-infinite-loop both documented in the Budget exhaustion block"
    else
      missing=""
      [ "$returns_to_execute" -eq 0 ] && missing="${missing}budget-exhausted-returns-to-/pf-execute "
      [ "$never_pass_never_loop" -eq 0 ] && missing="${missing}not-PASS-and-not-infinite-loop "
      pf_fail "TC-003 step 4: rule not documented in SKILL.md — missing half(s): ${missing}"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-004: round N>1 requires BOTH closure of prior findings AND review of its own fix diff\n'
# ══════════════════════════════════════════════════════════════════════════════
# No fixtures — pure static audit of the real skill text (test_plan.md TC-004
# Preconditions: "Нет (статический аудит текста)").

if [ ! -f "$SKILL" ]; then
  pf_fail "TC-004 step 1: (infra) skills/pf-codereview/SKILL.md not found"
else
  # Anchor-narrow to the Phase 4 section itself (heading to the next "## Phase
  # 5" heading) — this alone already excludes Phase 0's prerequisite messages
  # and Phase 3's verdict rules, both of which also mention /pf-execute/PASS
  # but have nothing to do with the round-2+ instruction.
  block="$(_pf_cr_block "$SKILL" '^## Phase 4' '^## Phase 5')"
  if [ -z "$block" ]; then
    pf_fail "TC-004 step 1: (infra) Phase 4 section not found in SKILL.md — heading missing or renamed"
  else
    pf_pass "TC-004 step 1: Phase 4's round-2+ instruction block located"

    closure=0
    if printf '%s\n' "$block" | grep -qiE 'closure of|verif(y|ies|ied)[^.]*(prior|previous)[^.]*(round|finding)[^.]*closed|(prior|previous) round[^.]*closed'; then
      closure=1
      pf_pass "TC-004 step 2: closure-of-prior-round-findings signal found in the Phase 4 block"
    else
      pf_fail "TC-004 step 2: rule not documented in SKILL.md — no closure-of-prior-round-findings signal in the Phase 4 block"
    fi

    own_diff=0
    if printf '%s\n' "$block" | grep -qiE "review[^.]*(this|the|current) round.?s own[^.]*(diff|fix)|own diff"; then
      own_diff=1
      pf_pass "TC-004 step 3: review-own-fix-diff signal found in the Phase 4 block"
    else
      pf_fail "TC-004 step 3: rule not documented in SKILL.md — no review-own-fix-diff signal in the Phase 4 block"
    fi

    if [ "$closure" -eq 1 ] && [ "$own_diff" -eq 1 ]; then
      pf_pass "TC-004 step 4: both signals present together in the same Phase 4 block — round N>1 requires closure verification AND own-diff review"
    else
      pf_fail "TC-004 step 4: rule not documented in SKILL.md — Phase 4's round-2+ instruction is one-sided or missing both signals together (a one-sided 'only verify closure' or 'only review the new diff' instruction is exactly what let round 9 of 20260709-feat-dockerize ship 2 new P0s unreviewed)"
    fi
  fi
fi

pf_summary
