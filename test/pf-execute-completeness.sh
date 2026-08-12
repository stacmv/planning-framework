#!/usr/bin/env bash
# test/pf-execute-completeness.sh — TC-013..TC-017
# (20260806-improve-codereview-convergence, implementation_plan.md Task 7).
#
# Read-only. Touches no $HOME, runs no script, mutates nothing — every
# fixture lives under test/fixtures/pf-codereview-convergence/ and is only
# ever read.
#
# This suite transcribes the three helpers `/pf-execute`'s completeness gate
# (Task 8, landed in skills/pf-execute/SKILL.md Phase 3.5) reads
# implementation_plan.md/test_plan.md through:
#   pf_execute_all_tasks_checked <plan.md> <test_plan.md>  — Check 1
#   pf_execute_task_has_test <plan.md> <test_plan.md>      — Check 2 / Check 2b
#   pf_execute_tc_has_task <test_plan.md> <plan.md>        — Check 3
#
# All three parse the LITERAL `**Mapped Test Cases:**` field in a task's own
# heading block — never a TC-ID mentioned anywhere else in that task's prose.
# Getting this backwards is the exact P0 a prior BRD review of this issue
# caught on reversed direction between TC-014 and TC-015 (see
# implementation_plan.md Task 7's Implementation Notes) — the two directions
# are implemented and tested independently of each other below, on purpose.
#
# All three read test-case metadata from test_plan.md's Status Tracker table
# (never a "### TC-…" detail-section heading, which can be absent, renamed
# or localized for a TC that still has a real Status Tracker row) via the
# shared row-parser _pf_status_tracker_rows below. Column position (which
# cell is "TC", which is "Type") is read from the table's own header row,
# not hardcoded to a fixed index. `test_plan.md` is a REQUIRED argument to
# `pf_execute_task_has_test` (round 2 code review, Finding 1): Check 2b's
# `tests` branch cross-references every `TC-\d+` it finds in a task's
# Acceptance Criteria against this same Status Tracker, exactly like Check 1
# and Check 3 already do — a literal that names no real case must still
# block.
#
# code_review.md round 1 findings fixed here:
#   CR-005 — pf_execute_all_tasks_checked used to block on ANY unchecked
#     line, ignoring the rule's own documented Manual-TC carve-out (a
#     Manual test case can only be closed by a live tester run, never by
#     /pf-execute). It now looks up each unchecked line's named TC-ID(s) in
#     the Status Tracker and skips a line only when EVERY TC-ID it names is
#     Type: Manual — a line naming no TC-ID, an unknown TC-ID, or a mix of
#     Manual and non-Manual TC-IDs still blocks (fail-closed).
#   CR-006 — pf_execute_tc_has_task used to collect TCs from "### TC-…"
#     section headings instead of the Status Tracker the rule itself names,
#     so a TC present in the tracker but missing/renamed/localized as a
#     detail section was invisible to the check and silently passed. It now
#     reads the same Status Tracker Check 1 does — and fails closed (blocks,
#     not "zero TCs, all covered") if that tracker is missing entirely.
#
# code_review.md round 2 findings fixed here:
#   Finding 1 (P1) — Check 2b used to accept ANY TC-\d+ literal named in a
#     `tests` task's Acceptance Criteria, including one with no row at all
#     in the Status Tracker (a fabricated TC-999): Check 2b was satisfied,
#     and Check 3 (reverse direction, sourced from the Status Tracker) never
#     saw that ID either, so it went unverified by every check in the gate.
#     _pf_task_rule_ok's `tests` branch now also requires every TC-\d+ it
#     finds in Acceptance Criteria to have a real Status Tracker row — see
#     pf_execute_task_has_test's new required test_plan.md parameter. Check
#     1's own fail-closed behavior (unknown TC-ID / missing-or-empty Type
#     column / mixed Manual+Auto all block; ONLY all-named-and-all-Manual is
#     spared) was already correct in code but undocumented in
#     skills/pf-execute/SKILL.md prose — documented there now, alongside the
#     same rule for Check 2b.
#   Finding 3 (P2, optional) — pf_execute_all_tasks_checked used to
#     re-parse the entire Status Tracker table from scratch (via
#     _pf_status_tracker_type_of -> _pf_status_tracker_rows) once per TC-ID
#     encountered across every unchecked line, instead of once per gate run.
#     The reviewer's own reproduction (29s / timeout) could not be
#     reproduced here (real files: ~1s; synthetic 50x50: ~0s), so this was
#     not a blocker, but materializing the rows once per
#     pf_execute_all_tasks_checked call was cheap and didn't complicate the
#     code, so it's done: _pf_status_tracker_type_of now takes the
#     already-materialized rows text instead of a file path, and
#     pf_execute_all_tasks_checked reads the table exactly once per call.
#
# Every step's drift-guard (its final numbered step, e.g. TC-013 step 3)
# reads skills/pf-execute/SKILL.md's Phase 3.5 text directly by anchor —
# remove or reword that block away from the rule it documents and the
# matching drift-guard goes red. The other steps are pure fixture parsing
# and never touch SKILL.md at all.
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

# _pf_trim <string> — whitespace trim via pure parameter expansion (no
# subprocess). Table rows in a real test_plan.md can run to dozens of rows x
# several columns; forking `sed`/`printf` once per cell for a plain trim
# made this helper slow enough to be a liability against a real,
# full-sized test_plan.md (not just the small fixtures below) — pure-bash
# trimming avoids that fork cost entirely.
_pf_trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# _pf_status_tracker_heading_line <test_plan.md>
#
# Prints the line number of the FIRST "## Status Tracker" heading, or
# nothing if the file has none at all. Shared by _pf_status_tracker_rows
# (below) and pf_execute_tc_has_task's own "tracker missing entirely" guard,
# so both ask the same question the same way.
_pf_status_tracker_heading_line() {
  grep -n -E '^##[[:space:]]+Status Tracker' "$1" 2>/dev/null | head -1 | cut -d: -f1
}

# _pf_status_tracker_rows <test_plan.md>
#
# Prints one "TC-ID<TAB>Type" pair per data row of the FIRST "## Status
# Tracker" table in test_plan.md — the authoritative source Check 1's
# Manual-TC carve-out and Check 3's reverse-direction scan both read test
# cases from, per skills/pf-execute/SKILL.md — never a "### TC-…"
# detail-section heading, which can be absent, renamed or localized for a TC
# that still has a real Status Tracker row (the CR-006 defect this exists to
# stop transcribing around). Column position ("TC", "Type") is read from the
# table's own header row, not hardcoded to a fixed index, so a
# differently-ordered table still parses. Prints nothing if the file has no
# "## Status Tracker" heading at all — callers that must distinguish "no
# tracker" from "tracker with nothing missing" use
# _pf_status_tracker_heading_line directly instead (see
# pf_execute_tc_has_task below: an ABSENT tracker is a hard failure, not
# "zero TCs, so everything is covered").
_pf_status_tracker_rows() {
  local test_plan="$1"
  local start line tc_col=1 type_col=0 have_header=0
  local -a cells

  start="$(_pf_status_tracker_heading_line "$test_plan")"
  [ -z "$start" ] && return 0

  while IFS= read -r line; do
    [[ "$line" =~ ^##[[:space:]] ]] && break
    [[ "$line" != \|* ]] && continue
    # Skip the header/data separator row ("| --- | --- | ...").
    [[ "$line" =~ ^\|[-:\|\ ]+\|?$ ]] && continue

    IFS='|' read -r -a cells <<<"$line"
    local i
    for i in "${!cells[@]}"; do
      cells[i]="$(_pf_trim "${cells[$i]}")"
    done

    if [ "$have_header" -eq 0 ]; then
      for i in "${!cells[@]}"; do
        case "${cells[$i]}" in
          TC) tc_col="$i" ;;
          Type) type_col="$i" ;;
        esac
      done
      have_header=1
      continue
    fi

    if [[ "${cells[$tc_col]:-}" =~ ^TC-[0-9]+$ ]]; then
      printf '%s\t%s\n' "${cells[$tc_col]}" "${cells[$type_col]:-}"
    fi
  done < <(tail -n "+$((start + 1))" "$test_plan")
}

# _pf_status_tracker_type_of <tc-id> <rows-text>
#
# Prints the Type cell (e.g. "Auto", "Manual") of <tc-id>'s Status Tracker
# row and returns 0. Returns 1 with no output if <rows-text> has no row for
# <tc-id> at all (including an empty <rows-text>, e.g. a file with no Status
# Tracker heading) — both are "unknown", and every caller below treats
# "unknown" as NOT Manual (fail-closed).
#
# <rows-text> is the FULL, already-materialized output of
# _pf_status_tracker_rows — the caller reads the table once (one command
# substitution, which runs that producer to completion) and passes the
# result in here, rather than this function re-reading and re-parsing
# test_plan.md itself on every call (round 2 code review, Finding 3: called
# once per TC-ID named across every unchecked line, as
# `pf_execute_all_tasks_checked` does, re-parsing per call made the whole
# table re-scanned as many times as there are TC-ID mentions in the plan —
# wasteful, though not reproducibly slow enough to be a blocker). This
# function only ever loops over the string it's given via a here-string —
# never a live process-substitution pipe consumed with an early `return`.
# An earlier version fed the while loop directly from
# `< <(_pf_status_tracker_rows ...)` inside this function and returned as
# soon as it found a match, leaving that producer still writing into a pipe
# nobody was draining; called repeatedly this reliably hung after a handful
# of calls on this platform's process-substitution implementation. Fully
# materializing the rows (now done once, by the caller) removes the live
# pipe entirely.
#
# CR-015 (round 3 code review): <tc-id> can legitimately have MORE THAN ONE
# row in a malformed <rows-text> (a duplicated TC-ID in test_plan.md's
# Status Tracker — a defect in that document, not in this helper, but one
# this helper must not paper over). An earlier version returned the FIRST
# matching row's Type and silently ignored every later one: with `TC-001`
# listed twice — `Manual` first, `Auto` below — an unclosed Acceptance
# Criteria line naming only `TC-001` read as "Manual" and slipped through
# Check 1's carve-out, even though the case is actually Auto. This version
# scans EVERY row for <tc-id> and returns `Manual` only when ALL of them
# say exactly `Manual`; if any matching row disagrees, it returns a value
# that is deliberately never the literal string `Manual` (so every caller's
# existing `[ "$t" = "Manual" ]` check fails closed on the divergence,
# without those callers needing to know anything changed here).
_pf_status_tracker_type_of() {
  local tc="$1" rows="$2"
  local row_tc row_type
  local found=0 all_manual=1 first_type=""
  while IFS=$'\t' read -r row_tc row_type; do
    if [ "$row_tc" = "$tc" ]; then
      found=1
      [ -z "$first_type" ] && first_type="$row_type"
      [ "$row_type" = "Manual" ] || all_manual=0
    fi
  done <<<"$rows"

  if [ "$found" -eq 0 ]; then
    return 1
  fi
  if [ "$all_manual" -eq 1 ]; then
    printf '%s' "Manual"
  else
    printf 'CONFLICT:%s' "$first_type"
  fi
  return 0
}

# _pf_status_tracker_tc_ids <test_plan.md>
#
# Prints every TC-ID that has a Status Tracker row (one per line, in file
# order, not de-duplicated — callers that need a set pipe through `sort -u`
# themselves).
_pf_status_tracker_tc_ids() {
  _pf_status_tracker_rows "$1" | cut -f1
}

# pf_execute_all_tasks_checked <plan.md> <test_plan.md>
#
# Check 1: mechanically scans implementation_plan.md for any remaining
# "- [ ]" line, then applies the rule's own documented Manual-TC carve-out
# (skills/pf-execute/SKILL.md, Check 1): a line is skipped ONLY when it
# names at least one TC-ID and EVERY TC-ID it names is Type: Manual per
# test_plan.md's Status Tracker. Every other unchecked line blocks —
# including a line naming no TC-ID at all, a TC-ID with no Status Tracker
# row (typo/renamed), or a mix of Manual and non-Manual TC-IDs — the
# carve-out is narrow by design (CR-005) and must never become "any
# unchecked line is fine". Prints the first blocking line and returns 1 if
# one is found; prints nothing and returns 0 if every unchecked line is a
# pure-Manual carve-out (or there are none).
#
# Reads test_plan.md's Status Tracker exactly ONCE per call (round 2 code
# review, Finding 3), not once per TC-ID mentioned across every unchecked
# line — see _pf_status_tracker_type_of's docstring above for why a
# per-TC-ID re-parse was wasteful.
pf_execute_all_tasks_checked() {
  local plan="$1" test_plan="$2"
  local line tc has_tc all_manual t
  local tracker_rows
  tracker_rows="$(_pf_status_tracker_rows "$test_plan")"

  while IFS= read -r line; do
    has_tc=0
    all_manual=1
    while IFS= read -r tc; do
      [ -z "$tc" ] && continue
      has_tc=1
      t="$(_pf_status_tracker_type_of "$tc" "$tracker_rows")"
      [ "$t" = "Manual" ] || all_manual=0
    done < <(printf '%s\n' "$line" | grep -oE 'TC-[0-9]+')

    if [ "$has_tc" -eq 0 ] || [ "$all_manual" -eq 0 ]; then
      printf '%s\n' "$line"
      return 1
    fi
  done < <(grep -n -E '^- \[ \]' "$plan" 2>/dev/null)

  return 0
}

# _pf_task_rule_ok <task-type> <mapped-field-text> <acceptance-criteria-text> <tracker-tc-ids>
#
# Task-Type-aware rule for a single task (Check 2 for `code`, Check 2b for
# `tests`; every other/missing Task Type falls back to the Check 2 / `code`
# rule, matching pf-execute/SKILL.md's own documented missing-field default).
#
# <tracker-tc-ids> is the FULL, already-materialized, newline-separated set
# of every TC-ID that has a Status Tracker row (the caller's own
# `_pf_status_tracker_tc_ids "$test_plan" | sort -u`, computed ONCE per
# `pf_execute_task_has_test` call) — never a file path this function reads
# and re-parses itself. Before round 3 code review (CR-016), the `tests`
# branch below took <test_plan.md> instead and called
# `_pf_status_tracker_tc_ids "$test_plan"` fresh inside its own per-TC-ID
# loop — the exact re-parse-per-iteration pattern CR-012 had already been
# fixed out of Check 1 (`pf_execute_all_tasks_checked`, above), reintroduced
# next to it by the fix that added Check 2b's tracker cross-reference. No
# reproducible timing failure was ever demonstrated for either case (real
# issue files: ~1s; a synthetic 50x50 plan: ~0s, unloaded machine) — this is
# a consistency cleanup, not a fix for a measured slowdown.
#
# Check 2b (round 2 code review, Finding 1): naming a `TC-\d+` literal in
# Acceptance Criteria is not enough by itself — every such literal must also
# have a real row in the Status Tracker, the same fail-closed cross-reference
# Check 1 uses. A task whose Acceptance Criteria names only a fabricated ID
# (e.g. `TC-999`, no Status Tracker row at all) still fails this rule, even
# though a `TC-\d+`-shaped literal is syntactically present.
#
# Check 2 (round 3 code review, CR-013): the exact same tracker-existence
# requirement now applies to the `code` branch — naming a `TC-\d+` literal in
# `**Mapped Test Cases:**` is not enough by itself either; every such literal
# must also have a real Status Tracker row. Before this fix, a `code` task
# could self-certify against a fabricated case (`TC-999`, no tracker row) and
# every check in the completeness gate stayed green: Check 1 doesn't look at
# this task's field at all, this rule only checked the literal's shape, and
# Check 3 is sourced from the tracker so it never saw the fabricated ID
# either — three green checks around one undetected gap.
_pf_task_rule_ok() {
  local ttype="$1" mapped="$2" ac="$3" tracker_tc_ids="$4"
  case "$ttype" in
    tests)
      # Check 2b: at least one TC-\d+ literal named in Acceptance Criteria,
      # AND every TC-\d+ named there must exist as a Status Tracker row.
      local tc found_any=0
      while IFS= read -r tc; do
        [ -z "$tc" ] && continue
        found_any=1
        printf '%s\n' "$tracker_tc_ids" | grep -qx "$tc" || return 1
      done < <(printf '%s' "$ac" | grep -oE 'TC-[0-9]+')
      [ "$found_any" -eq 1 ]
      ;;
    *)
      # Check 2: Mapped Test Cases field must name at least one TC-\d+, AND
      # every TC-\d+ it names must exist as a Status Tracker row (CR-013 —
      # the same fail-closed cross-reference Check 2b already applies above).
      local tc found_any=0
      while IFS= read -r tc; do
        [ -z "$tc" ] && continue
        found_any=1
        printf '%s\n' "$tracker_tc_ids" | grep -qx "$tc" || return 1
      done < <(printf '%s' "$mapped" | grep -oE 'TC-[0-9]+')
      [ "$found_any" -eq 1 ]
      ;;
  esac
}

# pf_execute_task_has_test <plan.md> <test_plan.md>
#
# Forward direction (Check 2 / Check 2b). Walks implementation_plan.md task
# by task, reading each task's own **Task Type:**, **Mapped Test Cases:**
# field and **Acceptance Criteria:** block — nothing else in the task's
# prose is ever consulted. Prints the name of every task that fails its
# Task-Type rule (one per line) and returns 1 if any did; returns 0 (no
# output) if every task passed. `test_plan.md` is REQUIRED (round 2 code
# review, Finding 1; round 3, CR-013): both the `tests` branch (Check 2b)
# and the `code` branch (Check 2) cross-reference every named `TC-\d+`
# against the Status Tracker via `_pf_task_rule_ok` above. The tracker's
# TC-ID set is read ONCE here — via `_pf_status_tracker_tc_ids | sort -u` —
# and passed into every `_pf_task_rule_ok` call below, rather than each call
# (or, worse, each TC-ID within a call) re-reading and re-parsing
# test_plan.md itself (CR-016; see `_pf_task_rule_ok`'s docstring).
pf_execute_task_has_test() {
  local plan="$1" test_plan="$2"
  local failing=()
  local task_name="" task_type="" mapped="" ac_text="" in_ac=0 have_task=0
  local line
  local tracker_tc_ids
  tracker_tc_ids="$(_pf_status_tracker_tc_ids "$test_plan" | LC_ALL=C sort -u)"

  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^####[[:space:]]+(Task[^:]*): ]]; then
      if [ "$have_task" -eq 1 ] && ! _pf_task_rule_ok "$task_type" "$mapped" "$ac_text" "$tracker_tc_ids"; then
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

  if [ "$have_task" -eq 1 ] && ! _pf_task_rule_ok "$task_type" "$mapped" "$ac_text" "$tracker_tc_ids"; then
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
# Reverse direction (Check 3). Collects every TC-\d+ that has a row in
# test_plan.md's Status Tracker — the same authoritative source the rule
# itself names ("For every TC row in test_plan.md's Status Tracker") and
# Check 1 above also reads — NEVER a "### TC-…" detail-section heading
# (CR-006: a TC can have a real Status Tracker row while its detail section
# is absent, renamed or localized, and that must still count as a TC this
# check owes coverage for). Compares against every TC-\d+ named in some
# task's own **Mapped Test Cases:** field in plan.md — that field, and
# nothing else in the plan's prose (an Overview mention does not count, by
# design: this is the exact reverse of TC-014's negative control, checked
# independently). Prints every TC missing a task (one per line) and returns
# 1 if any are missing; returns 0 (no output) if every TC has one.
#
# Fail-closed when the Status Tracker is missing ENTIRELY (no "## Status
# Tracker" heading at all): that must NOT read as "zero TCs to check, so
# coverage is complete" — an empty `all_tc` from a genuinely absent tracker
# would be the exact CR-006 defect shape (the authoritative source yields
# nothing, the check declares success) recreated on a different path. A
# tracker that exists but happens to name zero TCs is a degenerate but
# honest "nothing to check"; a tracker that does not exist at all is a
# broken test_plan.md this check cannot vouch for, so it blocks instead.
pf_execute_tc_has_task() {
  local test_plan="$1" plan="$2"
  local all_tc mapped_tc missing=() tc

  if [ -z "$(_pf_status_tracker_heading_line "$test_plan")" ]; then
    printf 'NO-STATUS-TRACKER: %s has no "## Status Tracker" heading — Check 3 cannot verify reverse coverage at all\n' "$test_plan"
    return 1
  fi

  all_tc="$(_pf_status_tracker_tc_ids "$test_plan" | LC_ALL=C sort -u)"
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
# is not found at all.
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
ALL_CHECKED_TP="$FIX/impl-plan-all-checked-test-plan.md"
ONE_UNCHECKED="$FIX/impl-plan-one-unchecked.md"
ONE_UNCHECKED_TP="$FIX/impl-plan-one-unchecked-test-plan.md"
MANUAL_UNCHECKED="$FIX/impl-plan-manual-unchecked.md"
MANUAL_UNCHECKED_TP="$FIX/impl-plan-manual-unchecked-test-plan.md"
AUTO_UNCHECKED="$FIX/impl-plan-auto-unchecked.md"
AUTO_UNCHECKED_TP="$FIX/impl-plan-auto-unchecked-test-plan.md"
MIXED_UNCHECKED="$FIX/impl-plan-mixed-unchecked.md"
MIXED_UNCHECKED_TP="$FIX/impl-plan-mixed-unchecked-test-plan.md"

if out="$(pf_execute_all_tasks_checked "$ALL_CHECKED" "$ALL_CHECKED_TP")"; then
  pf_pass "TC-013 step 1: pf_execute_all_tasks_checked(all-checked) == true"
else
  pf_fail "TC-013 step 1: pf_execute_all_tasks_checked(all-checked) unexpectedly false: $out"
fi

if out="$(pf_execute_all_tasks_checked "$ONE_UNCHECKED" "$ONE_UNCHECKED_TP")"; then
  pf_fail "TC-013 step 2: pf_execute_all_tasks_checked(one-unchecked) unexpectedly true"
else
  pf_pass "TC-013 step 2: pf_execute_all_tasks_checked(one-unchecked) == false, names: ${out#*:}"
fi

# ─── CR-005 regression: the Manual-TC carve-out ────────────────────────────
# Positive case: an unchecked Acceptance Criteria line naming ONLY a
# Manual-type TC (per the companion test_plan.md's Status Tracker) must NOT
# block — a manual case is closed later, by a live tester run, never by
# /pf-execute itself.
if out="$(pf_execute_all_tasks_checked "$MANUAL_UNCHECKED" "$MANUAL_UNCHECKED_TP")"; then
  pf_pass "TC-013 step 2b (CR-005): pf_execute_all_tasks_checked(manual-unchecked) == true — unchecked Manual-TC line does not block"
else
  pf_fail "TC-013 step 2b (CR-005): unchecked Manual-TC line unexpectedly blocked: $out"
fi

# Mutation proof for CR-005: the carve-out must be NARROW, not a way to
# accidentally turn Check 1 off altogether. Same shape of fixture as above,
# except the unchecked line's TC-ID is Type: Auto in its Status Tracker — it
# MUST still block. If this step ever goes green for the wrong reason (the
# carve-out swallowing non-Manual lines too), that is CR-005 fixed into a
# regression, not a fix.
if out="$(pf_execute_all_tasks_checked "$AUTO_UNCHECKED" "$AUTO_UNCHECKED_TP")"; then
  pf_fail "TC-013 step 2c (CR-005 mutation proof): pf_execute_all_tasks_checked(auto-unchecked) unexpectedly true — an unchecked AUTO-TC line must still block, or the Manual carve-out has swallowed Check 1 itself"
else
  pf_pass "TC-013 step 2c (CR-005 mutation proof): pf_execute_all_tasks_checked(auto-unchecked) == false, names: ${out#*:} — unchecked Auto-TC line still blocks"
fi

# Third branch: a line naming a MIX of Manual and non-Manual TC-IDs together
# must still block — the carve-out only fires when EVERY named TC-ID is
# Manual, never "at least one".
if out="$(pf_execute_all_tasks_checked "$MIXED_UNCHECKED" "$MIXED_UNCHECKED_TP")"; then
  pf_fail "TC-013 step 2d (CR-005, mixed Manual+Auto): pf_execute_all_tasks_checked(mixed-unchecked) unexpectedly true — a line naming one Manual and one Auto TC-ID must still block"
else
  pf_pass "TC-013 step 2d (CR-005, mixed Manual+Auto): pf_execute_all_tasks_checked(mixed-unchecked) == false, names: ${out#*:} — mixed-type line still blocks"
fi

# ─── round 2 code review, Finding 1: tracker row present but Type empty ────
# TC-002 HAS a Status Tracker row, but that row's Type column is empty. An
# unchecked line naming it must still block — a carve-out that treated
# "unknown Type" as "assume Manual" would recreate CR-005 on a new path.
NOTYPE_UNCHECKED="$FIX/impl-plan-notype-unchecked.md"
NOTYPE_UNCHECKED_TP="$FIX/impl-plan-notype-unchecked-test-plan.md"

if out="$(pf_execute_all_tasks_checked "$NOTYPE_UNCHECKED" "$NOTYPE_UNCHECKED_TP")"; then
  pf_fail "TC-013 step 2e (Finding 1, empty Type column): pf_execute_all_tasks_checked(notype-unchecked) unexpectedly true — a TC-ID with a Status Tracker row but an empty Type column must still block"
else
  pf_pass "TC-013 step 2e (Finding 1, empty Type column): pf_execute_all_tasks_checked(notype-unchecked) == false, names: ${out#*:} — empty-Type-column row still blocks"
fi

# ─── round 3 code review, CR-015: duplicate Status Tracker row, divergent Type
# TC-001 has TWO rows in the companion test_plan.md's Status Tracker — first
# Manual, then Auto. A helper that trusts only the first match would read
# "Manual" and let this unchecked line through the carve-out even though the
# case is actually Auto. It must still block: the carve-out only applies when
# EVERY row for a named case exists and says exactly Manual.
DUP_TYPE_PLAN="$FIX/tracker-duplicate-type/implementation_plan.md"
DUP_TYPE_TP="$FIX/tracker-duplicate-type/test_plan.md"

if out="$(pf_execute_all_tasks_checked "$DUP_TYPE_PLAN" "$DUP_TYPE_TP")"; then
  pf_fail "TC-013 step 2f (CR-015 mutation proof): pf_execute_all_tasks_checked(tracker-duplicate-type) unexpectedly true — TC-001 has a duplicated Status Tracker row (Manual then Auto); the divergence must still block, not resolve to whichever row came first"
else
  pf_pass "TC-013 step 2f (CR-015 mutation proof): pf_execute_all_tasks_checked(tracker-duplicate-type) == false, names: ${out#*:} — duplicate row with divergent Type still blocks"
fi

if block="$(_pf_anchor_slice "$EXEC_SKILL" 'Check 1' 12)" &&
  printf '%s' "$block" | grep -qiE 'block|blocking|hard stop|блокир|останавлив'; then
  pf_pass "TC-013 step 3: checkbox-completeness rule (Check 1) documented and marked blocking in skills/pf-execute/SKILL.md"
else
  pf_fail "TC-013 step 3: checkbox-completeness rule not documented in SKILL.md"
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

# ─── round 2 code review, Finding 1: Check 2b tracker-existence mutation proof
# A `tests` task naming a TC-ID that has NO row at all in the Status Tracker
# (a fabricated TC-999) must still block Check 2b — a bare TC-\d+ literal in
# Acceptance Criteria is not enough on its own; the case it names must be
# real, or this is the exact gap that went unverified by every check in the
# completeness gate (Check 2b satisfied by the literal; Check 3, sourced
# from the Status Tracker, never sees an ID with no row there either).
UNKNOWN_TC_PLAN="$FIX/coverage-forward-tests-unknown-tc/implementation_plan.md"
UNKNOWN_TC_TP="$FIX/coverage-forward-tests-unknown-tc/test_plan.md"

unknown_tc_out="$(pf_execute_task_has_test "$UNKNOWN_TC_PLAN" "$UNKNOWN_TC_TP")"
unknown_tc_rc=$?
if [ "$unknown_tc_rc" -ne 0 ] && printf '%s\n' "$unknown_tc_out" | grep -qx 'Task 2'; then
  pf_pass "TC-014 step 2b (Finding 1 mutation proof): pf_execute_task_has_test(coverage-forward-tests-unknown-tc) flags Task 2 — TC-999 named in Acceptance Criteria has no Status Tracker row at all"
else
  pf_fail "TC-014 step 2b (Finding 1 mutation proof): unexpected result (rc=$unknown_tc_rc, failing task(s): [$unknown_tc_out]) — a fabricated TC-ID with no tracker row must still block Check 2b"
fi

# ─── round 3 code review, CR-013: Check 2 (`code` branch) tracker-existence
# mutation proof — the symmetric half of Finding 1 above, for `code` tasks
# instead of `tests` tasks. Task 1 is `code`-typed and names `TC-999` in its
# own `**Mapped Test Cases:**` field — a well-formed literal, but `TC-999`
# has NO row at all in the companion test_plan.md's Status Tracker. Task 2
# (also `code`-typed) names `TC-001`, which DOES have a tracker row, and
# alone closes Check 3 (every TC has a task) — before this fix, Check 1,
# Check 2 and Check 3 were all green on this exact input and Task 1
# self-certified against a fabricated case undetected.
CODE_UNKNOWN_TC_PLAN="$FIX/coverage-forward-code-unknown-tc/implementation_plan.md"
CODE_UNKNOWN_TC_TP="$FIX/coverage-forward-code-unknown-tc/test_plan.md"

code_unknown_tc_out="$(pf_execute_task_has_test "$CODE_UNKNOWN_TC_PLAN" "$CODE_UNKNOWN_TC_TP")"
code_unknown_tc_rc=$?
if [ "$code_unknown_tc_rc" -ne 0 ] &&
  printf '%s\n' "$code_unknown_tc_out" | grep -qx 'Task 1' &&
  ! printf '%s\n' "$code_unknown_tc_out" | grep -qx 'Task 2'; then
  pf_pass "TC-014 step 2c (CR-013 mutation proof): pf_execute_task_has_test(coverage-forward-code-unknown-tc) flags Task 1 (TC-999 in Mapped Test Cases has no Status Tracker row at all) and spares Task 2 (TC-001, a real row)"
else
  pf_fail "TC-014 step 2c (CR-013 mutation proof): unexpected result (rc=$code_unknown_tc_rc, failing task(s): [$code_unknown_tc_out]) — a code task naming a fabricated TC-ID with no tracker row must still block Check 2, symmetric with Check 2b"
fi

# Direction self-test: the forward pattern must NOT be satisfied by
# reverse-only phrasing (TC-015's own wording), independent of whether
# SKILL.md has any of this text yet at all.
_pf_fwd_re='(each|every)[^.]{0,60}(code )?task[^.]{0,80}(has|have|must have)[^.]{0,40}test'
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
  pf_fail "TC-014 step 3: forward-direction rule not documented in SKILL.md"
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

# ─── CR-006 regression: source TCs from the Status Tracker, not "### TC-…" ──
# headings. TRACKER_ONLY_GAP has a real Status Tracker row for TC-003 with
# NO corresponding "### TC-003" detail section at all (absent, as if
# renamed/localized) and no task maps it either — exactly the case a
# header-based scan cannot even see (it would never add TC-003 to its
# candidate set, so it would report full coverage). The tracker-based
# helper must still flag it as missing.
TRACKER_ONLY_GAP_TP="$FIX/coverage-converse-tracker-only-gap/test_plan.md"
TRACKER_ONLY_GAP_PLAN="$FIX/coverage-converse-tracker-only-gap/implementation_plan.md"

tracker_gap_out="$(pf_execute_tc_has_task "$TRACKER_ONLY_GAP_TP" "$TRACKER_ONLY_GAP_PLAN")"
tracker_gap_rc=$?
if [ "$tracker_gap_rc" -ne 0 ] && printf '%s\n' "$tracker_gap_out" | grep -qx 'TC-003'; then
  pf_pass "TC-015 step 2b (CR-006 mutation proof): pf_execute_tc_has_task(coverage-converse-tracker-only-gap) flags TC-003 — present in the Status Tracker with NO '### TC-003' detail section and no task mapping it; a header-based scan would have missed it entirely"
else
  pf_fail "TC-015 step 2b (CR-006 mutation proof): unexpected result on tracker-only-gap fixture (rc=$tracker_gap_rc, missing TC(s): [$tracker_gap_out]) — TC-003 has a Status Tracker row but no detail section; if this isn't flagged, the helper is (still) reading TCs from '### TC-…' headings instead of the Status Tracker"
fi

# Fail-closed regression: a test_plan.md with NO "## Status Tracker"
# heading at all must be detected as a hard failure, never as "zero TCs
# named, so coverage is complete" — the exact CR-006 defect shape recreated
# on a different path if the tracker source ever comes back empty for the
# wrong reason.
NO_TRACKER_TP="$FIX/coverage-converse-no-tracker/test_plan.md"
NO_TRACKER_PLAN="$FIX/coverage-converse-no-tracker/implementation_plan.md"

no_tracker_out="$(pf_execute_tc_has_task "$NO_TRACKER_TP" "$NO_TRACKER_PLAN")"
no_tracker_rc=$?
if [ "$no_tracker_rc" -ne 0 ] && printf '%s\n' "$no_tracker_out" | grep -q 'NO-STATUS-TRACKER'; then
  pf_pass "TC-015 step 2c (CR-006 fail-closed): pf_execute_tc_has_task(coverage-converse-no-tracker) blocks — test_plan.md has no Status Tracker at all, so this check cannot vouch for anything (even though both TCs it DOES describe are fully mapped)"
else
  pf_fail "TC-015 step 2c (CR-006 fail-closed): unexpected result with no Status Tracker heading at all (rc=$no_tracker_rc, out=[$no_tracker_out]) — an absent tracker must block, not vacuously pass as 'zero TCs to check'"
fi

# Direction self-test: the reverse pattern must NOT be satisfied by
# forward-only phrasing (TC-014's own wording).
_pf_rev_re='(each|every)[^.]{0,60}(test case|TC)[^.]{0,80}(is |must be )?mapped[^.]{0,40}(to (a|the) )?task'
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
  pf_fail "TC-015 step 3: reverse-direction rule not documented in SKILL.md"
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
