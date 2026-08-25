#!/usr/bin/env bash
# shellcheck disable=SC2016
# ^ file-wide: single-quoted literals throughout intentionally contain
# backticks (markdown code-span markers being matched literally as text, not
# shell expansion).
#
# test/pf-execute-task-dispatch.sh — TC-024, TC-025, TC-026
# (20260806-improve-codereview-convergence, Task 13).
#
# Infrastructure task: this suite writes the harness. The rule itself lands
# in the PAIRED code task (Task 14), which edits skills/pf-execute/SKILL.md.
# Until Task 14 lands:
#   - TC-024 is baseline-GREEN on four of five elements, RED on the fifth
#     (missing-criterion (в) — no explicit task-level "what counts as done").
#   - TC-025 is RED (KI-1: the sub-agent block still prescribes TaskGet/
#     TaskUpdate, tools confirmed unavailable to write:claude sub-agents).
#   - TC-026's pf_execute_resolve_task_content helper steps are GREEN (pure
#     bash, nothing to do with SKILL.md yet); its drift-guard step is RED.
# None of this is a broken test — it is the documented pre-Task-14 state.
#
# ─── The duplicate-heading trap (read before touching this file) ─────────────
# skills/pf-execute/SKILL.md has TWO blocks with the identical literal
# heading "**Create each task** with:" — one under "If `size_tier: trivial`:"
# (its own four-bullet list, no `Task Type` field at all, by design — out of
# scope for this issue) and one under "If `size_tier` is small/medium/large:"
# (the block AC-6.1 actually targets). A bare `grep "Create each task"`
# matches the trivial block first (it appears earlier in the file) or matches
# both indiscriminately. Every TC-024/TC-025 check below narrows to a line
# range located by anchor headings FIRST, the same technique
# test/skills-role-matrix-static.sh's check_order() uses, and self-checks
# that narrowing at TC-024 step 1 (see tc024_trivial_marker_absent below).
#
# Read-only. It runs no script, touches no $HOME, and mutates nothing.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

PF_EXECUTE="$REPO_ROOT/skills/pf-execute/SKILL.md"
FIXTURE="$REPO_ROOT/test/fixtures/pf-codereview-convergence/impl-plan-mismatched-numbering.md"

# ─── Small anchor helpers (style: test/pf-test-tc-mapping-static.sh) ─────────

# line_of <file> <ERE pattern> — first matching line number (grep -n -E), or
# empty if not found.
line_of() {
  grep -n -E "$2" "$1" 2>/dev/null | head -1 | cut -d: -f1
}

# line_of_fixed_after <file> <start line> <literal string> — first line
# number STRICTLY AFTER <start line> matching the literal string, or empty.
# This is the anchor-narrowing primitive: it is what lets TC-024/TC-025 find
# the small/medium/large "Create each task" block instead of the trivial one.
line_of_fixed_after() {
  local file="$1" start="${2:-0}" needle="$3"
  grep -n -F -- "$needle" "$file" 2>/dev/null |
    awk -F: -v s="$start" '$1 > s { print $1; exit }'
}

# line_of_after <file> <start line> <ERE pattern> — same, but ERE.
line_of_after() {
  local file="$1" start="${2:-0}" pattern="$3"
  grep -n -E "$pattern" "$file" 2>/dev/null |
    awk -F: -v s="$start" '$1 > s { print $1; exit }'
}

# section <file> <start line> <end line, exclusive> — prints that range.
section() {
  local file="$1" start="$2" end="$3"
  sed -n "${start},$((end - 1))p" "$file"
}

if [ ! -f "$PF_EXECUTE" ]; then
  pf_fail "TC-024: skills/pf-execute/SKILL.md does not exist (test infrastructure — file missing)"
  pf_fail "TC-025: skills/pf-execute/SKILL.md does not exist (test infrastructure — file missing)"
  pf_fail "TC-026: skills/pf-execute/SKILL.md does not exist (test infrastructure — file missing)"
  pf_summary
  exit $?
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-024: task dispatch names the five-element self-contained minimum\n'
# ══════════════════════════════════════════════════════════════════════════════

# ─── Anchor narrowing ─────────────────────────────────────────────────────────
create_tasks_hdr="$(line_of "$PF_EXECUTE" '^### Create Tasks from Implementation Plan')"
trivial_hdr="$(line_of_fixed_after "$PF_EXECUTE" "${create_tasks_hdr:-0}" '**If `size_tier: trivial`:**')"
sml_hdr="$(line_of_fixed_after "$PF_EXECUTE" "${create_tasks_hdr:-0}" '**If `size_tier` is small/medium/large:**')"
sml_end="$(line_of_after "$PF_EXECUTE" "${sml_hdr:-0}" '^(---|## )')"

if [ -z "$create_tasks_hdr" ] || [ -z "$trivial_hdr" ] || [ -z "$sml_hdr" ] || [ -z "$sml_end" ]; then
  pf_fail "TC-024 step 1: could not locate the small/medium/large 'Create each task with:' block by anchor-narrowing (create_tasks_hdr=${create_tasks_hdr:-<none>} trivial_hdr=${trivial_hdr:-<none>} sml_hdr=${sml_hdr:-<none>} sml_end=${sml_end:-<none>})"
  sml_block=""
else
  sml_block="$(section "$PF_EXECUTE" "$sml_hdr" "$sml_end")"

  # Self-check that narrowing actually excludes the trivial block: (1) the
  # trivial heading must sort strictly before the small/medium/large one, and
  # (2) the narrowed small/medium/large block must not contain the trivial
  # block's own unique marker text ("No `Task Type` field").
  ordering_ok=0
  [ "$trivial_hdr" -lt "$sml_hdr" ] && ordering_ok=1
  tc024_trivial_marker_absent=1
  printf '%s\n' "$sml_block" | grep -qF 'No `Task Type` field' && tc024_trivial_marker_absent=0

  pf_note "TC-024: trivial block = lines ${trivial_hdr}-$((sml_hdr - 1)); small/medium/large block = lines ${sml_hdr}-$((sml_end - 1))"

  if [ "$ordering_ok" -eq 1 ] && [ "$tc024_trivial_marker_absent" -eq 1 ]; then
    pf_pass "TC-024 step 1: located the small/medium/large 'Create each task with:' block (lines ${sml_hdr}-$((sml_end - 1))), distinct from and after the trivial block (lines ${trivial_hdr}-$((sml_hdr - 1)))"
  else
    pf_fail "TC-024 step 1: anchor-narrowing did not cleanly separate the two 'Create each task' blocks (ordering_ok=$ordering_ok trivial_marker_absent=$tc024_trivial_marker_absent)"
  fi
fi

if [ -n "$sml_block" ]; then
  # ─── Step 2: the five-element minimum, checked and reported individually — ──
  # baseline (а)(б)(г)(д) must each pass TODAY; (в) is the one expected RED
  # until Task 14. Reporting them as five separate pf_pass/pf_fail calls
  # (rather than one aggregated verdict) is deliberate: it is the only way
  # this suite's own output shows "4 of 5 already there" instead of masking
  # the baseline behind a single failing line.
  if printf '%s\n' "$sml_block" | grep -qiE 'Clear description including the specific files to create/modify'; then
    pf_pass "TC-024 step 2 (a+b): task description names what to do AND the files to create/modify"
  else
    pf_fail "TC-024 step 2 (a+b): no 'clear description including files to create/modify' bullet found"
  fi

  if printf '%s\n' "$sml_block" | grep -qiE 'Mapped test cases.*that verify the task'; then
    pf_pass "TC-024 step 2 (d): mapped test cases (TCs) are named"
  else
    pf_fail "TC-024 step 2 (d): no 'mapped test cases' bullet found"
  fi

  has_blocked_by=0
  has_blocks=0
  printf '%s\n' "$sml_block" | grep -qF '`blocked_by`' && has_blocked_by=1
  printf '%s\n' "$sml_block" | grep -qF '`blocks`' && has_blocks=1
  if [ "$has_blocked_by" -eq 1 ] && [ "$has_blocks" -eq 1 ]; then
    pf_pass "TC-024 step 2 (e): both blocked_by and blocks dependency fields are named"
  else
    pf_fail "TC-024 step 2 (e): dependency fields incomplete (blocked_by: $has_blocked_by, blocks: $has_blocks)"
  fi

  # (в) — the one criterion this issue actually adds: an explicit task-level
  # "what counts as done" completion criterion, distinct from the dependency
  # bullet's incidental use of the words "done"/"complete" (line "what must
  # be done before what" / "tasks that must complete first" — neither of
  # those is a completion criterion for THIS task, so a bare grep for
  # "done|complete" would false-pass on the dependency bullet alone).
  if printf '%s\n' "$sml_block" | grep -qiE 'what counts as (done|complete)|completion criterion|considered (done|complete)|definition of done'; then
    pf_pass "TC-024 step 2 (c): task-level 'what counts as done' completion criterion is named explicitly"
  else
    pf_fail "TC-024 step 2 (c): no explicit task-level completion criterion found (expected RED pending Task 14 — not a defect in this test)"
  fi

  # ─── Step 3: the previously-rejected vague phrasing must not reappear ──────
  if printf '%s\n' "$sml_block" | grep -qiE 'sufficient description|достаточное описание'; then
    pf_fail "TC-024 step 3: vague 'sufficient description' phrasing found in the small/medium/large block (rejected during brd.md review, AC-6.1)"
  else
    pf_pass "TC-024 step 3: no vague 'sufficient description' phrasing in the small/medium/large block"
  fi
else
  pf_fail "TC-024 step 2 (a+b): skipped — block not located (see step 1)"
  pf_fail "TC-024 step 2 (d): skipped — block not located (see step 1)"
  pf_fail "TC-024 step 2 (e): skipped — block not located (see step 1)"
  pf_fail "TC-024 step 2 (c): skipped — block not located (see step 1)"
  pf_fail "TC-024 step 3: skipped — block not located (see step 1)"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-025: sub-agent instructions do not prescribe TaskGet/TaskUpdate (KI-1)\n'
# ══════════════════════════════════════════════════════════════════════════════

# This heading is unique in the file (no narrowing trap here) — confirmed by
# direct inspection when this suite was written.
subagent_hdr="$(line_of "$PF_EXECUTE" '^### For Each Task — `write: claude` \(Sub-Agent Instructions\)')"
delegated_hdr="$(line_of_after "$PF_EXECUTE" "${subagent_hdr:-0}" '^### For Each Task — `write != claude` \(delegated actor\)')"

if [ -z "$subagent_hdr" ] || [ -z "$delegated_hdr" ]; then
  pf_fail "TC-025 step 1: could not locate the 'For Each Task — write: claude (Sub-Agent Instructions)' block"
else
  pf_pass "TC-025 step 1: located the write:claude sub-agent instructions block (lines ${subagent_hdr}-$((delegated_hdr - 1)))"

  subagent_block="$(section "$PF_EXECUTE" "$subagent_hdr" "$delegated_hdr")"

  # Deliberately one-directional per test_plan.md's own note on TC-025: this
  # step only checks that TaskGet/TaskUpdate are NOT prescribed to the
  # sub-agent here. It is expected RED right now (KI-1) — SKILL.md today
  # literally says "Use TaskGet to read full task details" (step 1) and
  # "Use TaskUpdate to mark task complete" (step 5) in this exact block.
  # ToolSearch confirmed on two separate test sub-agents that write:claude
  # sub-agents have no access to either tool. A green result here BEFORE
  # Task 14 lands would mean this check itself is broken, not that the rule
  # is already satisfied — do not "fix" this test to make it pass early.
  found_prescriptions=""
  printf '%s\n' "$subagent_block" | grep -qi 'Use `TaskGet`' && found_prescriptions="${found_prescriptions}TaskGet "
  printf '%s\n' "$subagent_block" | grep -qi 'Use `TaskUpdate`' && found_prescriptions="${found_prescriptions}TaskUpdate "

  if [ -z "$found_prescriptions" ]; then
    pf_pass "TC-025 step 2: the write:claude sub-agent block does not prescribe TaskGet/TaskUpdate to the sub-agent"
  else
    pf_fail "TC-025 step 2: sub-agent block still prescribes: ${found_prescriptions}(KI-1 — confirmed via ToolSearch on two separate test sub-agents that these tools are unavailable to write:claude sub-agents. This is the EXPECTED state before Task 14 lands, per test_plan.md's own note on TC-025 — not a defect in this test.)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-026: numbering mismatch cannot cause the wrong task to be executed\n'
# ══════════════════════════════════════════════════════════════════════════════

# pf_execute_resolve_task_content <payload> — transcribed stand-in (test-only,
# pure bash) for the algorithm skills/pf-execute/SKILL.md's dispatch prompt is
# supposed to follow: a sub-agent's task is always resolved from the FULL
# embedded content of its dispatch payload, never from a bare task
# number/identifier. Payload shape (a test-only convention, not a real wire
# format):
#
#   <anything>
#   ---
#   <full task content: description, files, mapped TCs, dependencies...>
#
# Everything up to and including the first line that is exactly "---" is
# treated as the number/identifier part and discarded; everything after it is
# the content. Returns the content on stdout and exit 0 when that content is
# present (non-blank) — regardless of whether the identifier part matches
# anything real. Returns exit 1 and no stdout when there is no content after
# the delimiter (or no delimiter at all) — this is exactly the item-7
# vulnerability step 1 exercises: resolving a task "by number alone".
pf_execute_resolve_task_content() {
  local payload="$1"
  local content
  content="$(printf '%s\n' "$payload" | awk 'f{print} /^---$/{f=1}')"

  if [ -z "$(printf '%s' "$content" | tr -d '[:space:]')" ]; then
    return 1
  fi

  printf '%s\n' "$content"
  return 0
}

# ─── Step 1: number-only payload resolves to nothing ──────────────────────────
# Literal example from test_plan.md's own step 1: a payload carrying ONLY the
# task number ("Task 3"), no task text at all — no "---" delimiter, so
# everything is identifier and nothing is content.
step1_payload='Task 3'
step1_out=""
step1_rc=0
step1_out="$(pf_execute_resolve_task_content "$step1_payload")" || step1_rc=$?

if [ "$step1_rc" -ne 0 ] && [ -z "$step1_out" ]; then
  pf_pass "TC-026 step 1: number-only payload ('Task 3', no content) resolves to nothing"
else
  pf_fail "TC-026 step 1: number-only payload unexpectedly resolved (rc=$step1_rc, out='$step1_out')"
fi

# ─── Step 2: number + full content resolves to the content, even when the ────
# declared number does not match the plan's own label. Content is pulled
# from the real fixture (Section B's "Task 3") so this is grounded in the
# actual mismatched-numbering scenario (the fixture legitimately contains TWO
# tasks both labeled "Task 3" in different sections — see the fixture's own
# header note) rather than an invented string.
if [ ! -f "$FIXTURE" ]; then
  pf_fail "TC-026 step 2: fixture not found: $FIXTURE (test infrastructure — fixture missing, not a rule failure)"
else
  fixture_task_content="$(sed -n '/<!-- TASK-CONTENT-START -->/,/<!-- TASK-CONTENT-END -->/p' "$FIXTURE" | sed '1d;$d')"
  if [ -z "$(printf '%s' "$fixture_task_content" | tr -d '[:space:]')" ]; then
    pf_fail "TC-026 step 2: could not extract task content from fixture markers (test infrastructure — fixture malformed)"
  else
    # Declared number (7) deliberately does not match either "Task 3" label
    # inside the fixture — simulating the orchestrator's own internal
    # dispatch-sequence number, which need not equal implementation_plan.md's
    # section-local "Task N" label.
    step2_payload="$(printf 'ORCHESTRATOR_DISPATCH_NUMBER: 7\n---\n%s' "$fixture_task_content")"
    step2_out=""
    step2_rc=0
    step2_out="$(pf_execute_resolve_task_content "$step2_payload")" || step2_rc=$?

    if [ "$step2_rc" -eq 0 ] && printf '%s' "$step2_out" | grep -qF 'Add invoice PDF export'; then
      pf_pass "TC-026 step 2: payload with mismatched declared number (7 vs. fixture's 'Task 3') still resolves to the embedded task content"
    else
      pf_fail "TC-026 step 2: mismatched-number payload did not resolve to the embedded content (rc=$step2_rc, out='$step2_out')"
    fi
  fi
fi

# ─── Step 3: drift-guard — SKILL.md states the numbering-mismatch rule ───────
# Test-first: expected RED pending Task 14. Checks that some paragraph in
# SKILL.md states BOTH that the dispatch payload always carries the task's
# full content AND explicitly covers the case where numbering does not line
# up (not just "include the files" in general, which the file already says
# today without ever addressing numbering mismatch).
paragraphs="$(awk 'BEGIN{RS=""} {gsub(/\n/," "); print}' "$PF_EXECUTE")"
drift_match="$(printf '%s\n' "$paragraphs" | grep -iE 'full content' | grep -iE 'numbering|mismatch|does(n.t| not) match' | head -1)"

if [ -n "$drift_match" ]; then
  pf_pass "TC-026 step 3: SKILL.md states the dispatch payload always carries full task content, explicitly covering the numbering-mismatch case"
else
  pf_fail "TC-026 step 3: numbering-mismatch immunity rule not documented in SKILL.md yet (test-first, expected RED pending Task 14 — SKILL.md and the fixture are both present and the helper ran correctly above, so this is NOT a test-infrastructure defect: it is the rule itself not being written yet)"
fi


# ─── Task-tool availability: optional layer, checkbox ledger (2026-08-25) ────
# Claude Code >=2.1.233 disables TaskCreate/List/Get/Update by default on newer
# models, so pf-execute must run without them and say how to get them back.
printf '
=== Task tools optional (Claude Code >=2.1.233 default)
'
EXEC_SKILL_TT="skills/pf-execute/SKILL.md"
if [ ! -f "$EXEC_SKILL_TT" ]; then
  pf_fail "task-tools INFRA: $EXEC_SKILL_TT not found"
else
  tt_text="$(cat "$EXEC_SKILL_TT")"

  if printf '%s' "$tt_text" | grep -qF 'select:TaskCreate,TaskList,TaskGet,TaskUpdate'; then
    pf_pass "task-tools step 1: Phase 1 probes availability via ToolSearch select:TaskCreate,TaskList,TaskGet,TaskUpdate"
  else
    pf_fail "task-tools step 1: no ToolSearch availability probe for the Task tools documented in SKILL.md"
  fi

  if printf '%s' "$tt_text" | grep -qF 'CLAUDE_CODE_ENABLE_TODO_TOOLS=1'; then
    pf_pass "task-tools step 2: disabled-notice names CLAUDE_CODE_ENABLE_TODO_TOOLS=1 as the way back"
  else
    pf_fail "task-tools step 2: disabled-notice does not name CLAUDE_CODE_ENABLE_TODO_TOOLS=1 — user cannot re-enable"
  fi

  with_n="$(printf '%s' "$tt_text" | grep -c '(with Task tools)')"
  without_n="$(printf '%s' "$tt_text" | grep -c '(without')"
  if [ "$with_n" -ge 3 ] && [ "$without_n" -ge 3 ]; then
    pf_pass "task-tools step 3:instructions carries both forms (with: $with_n, without: $without_n)"
  else
    pf_fail "task-tools step 3: with/without forms unbalanced or missing (with: $with_n, without: $without_n; need >=3 each)"
  fi

  if printf '%s' "$tt_text" | grep -qE 'never an error and never a stop|never a stop'; then
    pf_pass "task-tools step 4: missing Task tools is explicitly not an error/stop (autopilot-safe)"
  else
    pf_fail "task-tools step 4: SKILL.md does not say a missing Task tool is not an error — autopilot could stall"
  fi

  if printf '%s' "$tt_text" | grep -qE 'only completion ledger'; then
    pf_pass "task-tools step 5: checkbox-only-ledger invariant stated for the completeness gate"
  else
    pf_fail "task-tools step 5: checkbox-only-ledger invariant not stated near the completeness gate"
  fi

  if printf '%s' "$tt_text" | grep -qE 'mirror — never a ledger|progress mirror'; then
    pf_pass "task-tools step 6: Task list described as a mirror, not a ledger"
  else
    pf_fail "task-tools step 6: Task list not described as a mirror — risks being read as authoritative"
  fi
fi

pf_summary
