#!/usr/bin/env bash
# shellcheck disable=SC2016  # backticks are literal markdown code-spans in grep patterns, not command substitution
# @pf-issue [20260902-feat-idea-stage]
# test/pf-idea-front-loaded-static.sh — static, grep/awk-based structural
# checks for the front-loaded hook-site table (specs-part2.md §7.13,
# specs-part3.md §8.2; implementation_plan.md Task 22).
#
# For every (skill, section) row in specs-part2.md §7.13's table: extract the
# text range between that row's heading/anchor and the next heading of the
# same-or-higher level, then assert on that range —
#   - ordinary "hook" rows: the range must contain BOTH `pf-interaction` and
#     `front-loaded` (the canonical hook text or its semantic equivalent);
#   - the two named exception rows (`code.review: skip` confirmation, in
#     `pf-codereview` and in `pf`): the range must NOT contain that reference;
#   - the codex-install-prompt rows (`pf-check`'s "Codex invocation chain"
#     step 1/2a and step 3, finding #12): a conditional assert — the range
#     need not contain the hook, but must mention both "intake" and
#     "unconditional" in prose;
#   - `pf-close`'s Phase 1 (finding #10 — an extended gate, not a plain
#     exception): a positive assert — the range must contain BOTH
#     `front-loaded` AND text confirming that behavior is unchanged for an
#     issue without that field;
#   - `pf-test`'s "No test runner detected" (finding #11): the range around
#     that plain-text question must carry the hook reference too, not just
#     the (still-true) absence of a literal `AskUserQuestion` call.
#
# Same style as test/pf-idea-stage-static.sh: read-only, no ~/.claude/skills
# involved, no real /pf run, no script execution — every check below only
# greps/awks file text.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

SKILLS="$REPO_ROOT/skills"
BRD="$SKILLS/pf-brd/SKILL.md"
SPEC="$SKILLS/pf-spec/SKILL.md"
TESTPLAN="$SKILLS/pf-test-plan/SKILL.md"
IMPLPLAN="$SKILLS/pf-impl-plan/SKILL.md"
EXECUTE="$SKILLS/pf-execute/SKILL.md"
CHECK="$SKILLS/pf-check/SKILL.md"
USERDOCS="$SKILLS/pf-user-docs/SKILL.md"
DEVDOCS="$SKILLS/pf-dev-docs/SKILL.md"
CODEREVIEW="$SKILLS/pf-codereview/SKILL.md"
QA="$SKILLS/pf-qa/SKILL.md"
TEST="$SKILLS/pf-test/SKILL.md"
CLOSE="$SKILLS/pf-close/SKILL.md"
PF="$SKILLS/pf/SKILL.md"

# range_between <file> <start-literal> <end-literal>
#
# Prints the lines from (and including) the first line containing <start-literal>
# up to (but excluding) the next line containing <end-literal>. Both patterns are
# matched as literal substrings (awk index()), not regexes, so headings with
# markdown/regex metacharacters (backticks, parens, colons) need no escaping.
# Prints nothing if <start-literal> is never found. Same helper as
# test/pf-idea-stage-static.sh — duplicated locally (not sourced from there)
# so this file has no cross-file dependency on another test's internals.
range_between() {
  local file="$1" s="$2" e="$3"
  awk -v s="$s" -v e="$e" '
    index($0,s) && !flag { flag=1; print; next }
    flag && e != "" && index($0,e) { exit }
    flag { print }
  ' "$file"
}

# assert_hook <TC-tag> <label> <file> <start> <end>
#
# Positive assert for an ordinary hook row: the range must contain BOTH
# `pf-interaction` and `front-loaded`.
assert_hook() {
  # $1 is the TC-ID. It stays at every call site so a reader (and a grep) can
  # see which case a site belongs to, but the labels below spell TC-020
  # literally: /pf-test truncates a label at its first interpolation, so a
  # label starting with "$tag" collapses to the bare TC-ID and stops being
  # matchable against the runner output.
  local label="$2" file="$3" start="$4" end="$5"
  local range
  range="$(range_between "$file" "$start" "$end")"
  if [ -z "$range" ]; then
    pf_fail "TC-020: front-loaded hook site — anchor not found: $label ($start)"
    return
  fi
  if printf '%s' "$range" | grep -q 'pf-interaction' && printf '%s' "$range" | grep -q 'front-loaded'; then
    pf_pass "TC-020: front-loaded hook present — $label"
  else
    pf_fail "TC-020: front-loaded hook missing — $label"
  fi
}

# assert_no_hook <TC-tag> <label> <file> <start> <end>
#
# Negative assert for a named exception row: the range must NOT contain a
# hook reference (checked as absence of `pf-interaction`, the anchor every
# canonical/equivalent hook reference carries).
assert_no_hook() {
  # $1 is the TC-ID. It stays at every call site so a reader (and a grep) can
  # see which case a site belongs to, but the labels below spell TC-020
  # literally: /pf-test truncates a label at its first interpolation, so a
  # label starting with "$tag" collapses to the bare TC-ID and stops being
  # matchable against the runner output.
  local label="$2" file="$3" start="$4" end="$5"
  local range
  range="$(range_between "$file" "$start" "$end")"
  if [ -z "$range" ]; then
    pf_fail "TC-020: front-loaded hook site — anchor not found: $label ($start)"
    return
  fi
  if printf '%s' "$range" | grep -q 'pf-interaction'; then
    pf_fail "TC-020: exception row unexpectedly carries a hook — $label"
  else
    pf_pass "TC-020: exception row correctly has no hook — $label"
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-020 step 1: ordinary hook rows — pf-brd (specs-part2.md §7.13)\n'
# ══════════════════════════════════════════════════════════════════════════════

assert_hook "TC-020" "pf-brd: Legacy-tier guard" "$BRD" \
  '**Legacy-tier guard' '**Reviewer-assignment guard'

assert_hook "TC-020" "pf-brd: Reviewer-assignment guard" "$BRD" \
  '**Reviewer-assignment guard' '**`idea_ref` hook'

assert_hook "TC-020" 'pf-brd: Output gate ("notes.md"/"brd.md" already present)' "$BRD" \
  '**Output gate — `notes.md`' '## If `size_tier: trivial`'

assert_hook "TC-020" 'pf-brd: "## If `size_tier: trivial`" Q&A cycle' "$BRD" \
  '## If `size_tier: trivial`' '## If `size_tier` is small/medium/large'

assert_hook "TC-020" 'pf-brd: "## If `size_tier` is small/medium/large" Q&A cycle + Post-save tier reconfirmation' "$BRD" \
  '## If `size_tier` is small/medium/large' '## Close the stage: commit & push'

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-020 step 1: ordinary hook rows — pf-spec\n'
# ══════════════════════════════════════════════════════════════════════════════

assert_hook "TC-020" "pf-spec: Legacy-tier guard" "$SPEC" \
  'Before checking any other prerequisite' 'Check that `docs/issues/open/[ISSUE-ID]/brd.md` is'

assert_hook "TC-020" 'pf-spec: Output gate ("specs.md" already present)' "$SPEC" \
  '**Output gate — `specs.md`' "Read \`size_tier\` from \`prompt.md\`'s frontmatter."

assert_hook "TC-020" "pf-spec: main Q&A cycle (after \"Based on the BRD...\")" "$SPEC" \
  'Based on the BRD, produce the specs' '**If `size_tier: small`:**'

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-020 step 1: ordinary hook rows — pf-test-plan\n'
# ══════════════════════════════════════════════════════════════════════════════

assert_hook "TC-020" "pf-test-plan: Legacy-tier guard" "$TESTPLAN" \
  'Before checking any other prerequisite' 'Determine the active issue from `docs/issues/open/`.'

assert_hook "TC-020" 'pf-test-plan: Output gate ("test_plan.md" already present)' "$TESTPLAN" \
  '**Output gate — `test_plan.md`' '### Step 1: Identify Test Scenarios'

assert_hook "TC-020" "pf-test-plan: Manual-budget-exceeded question (Step 4d)" "$TESTPLAN" \
  '### Step 4d: Gate' '### Step 5: Add Known Issues Section'

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-020 step 1: ordinary hook rows — pf-impl-plan, pf-execute\n'
# ══════════════════════════════════════════════════════════════════════════════

assert_hook "TC-020" "pf-impl-plan: Legacy-tier guard" "$IMPLPLAN" \
  'Determine the active issue from `docs/issues/open/`. Before checking' \
  '**Input gate — this one stays a hard stop.**'

assert_hook "TC-020" 'pf-impl-plan: Output gate ("implementation_plan.md" already present)' "$IMPLPLAN" \
  '**Output gate — `implementation_plan.md`' '## Task to pass to whichever actor drafts the plan'

assert_hook "TC-020" "pf-execute: Legacy-tier guard" "$EXECUTE" \
  'Before checking any other prerequisite' '**Oversized-predecessor guard.**'

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-020 step 1: ordinary hook rows — pf-check\n'
# ══════════════════════════════════════════════════════════════════════════════

assert_hook "TC-020" "pf-check: Legacy-tier guard" "$CHECK" \
  'First, determine TYPE' '## Automigration'

assert_hook "TC-020" '"How would you like to proceed?" review gate (reuses Autopilot mode, not a new hook)' "$CHECK" \
  '### Sequential review mode' '## Close the stage: commit & push'

assert_hook "TC-020" 'fix sub-agent'"'"'s own AskUserQuestion (If "Fix now")' "$CHECK" \
  '### Sequential review mode' '## Close the stage: commit & push'

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-020 step 3: codex-install prompts — pf-check "Codex invocation chain" (finding #12, conditional assert)\n'
# ══════════════════════════════════════════════════════════════════════════════
# Per implementation_plan.md Task 22 / specs-part3.md §8.2: this assert does
# NOT require presence or absence of the hook reference — only that the
# section text names both paths ("intake" for an issue that enabled
# front-loaded at CREATE-time, "unconditional" for an issue that added the
# field to prompt.md by hand afterward).

CODEX_CHAIN="$(range_between "$CHECK" '### Codex invocation chain' '### Severity')"
if [ -z "$CODEX_CHAIN" ]; then
  pf_fail 'TC-020: pf-check "Codex invocation chain" section not found'
else
  if printf '%s' "$CODEX_CHAIN" | grep -qi 'intake' && printf '%s' "$CODEX_CHAIN" | grep -qi 'unconditional'; then
    pf_pass 'TC-020: pf-check Codex invocation chain step 2a/step 3 — both "intake" and "unconditional" paths named'
  else
    pf_fail 'TC-020: pf-check Codex invocation chain step 2a/step 3 — "intake" and/or "unconditional" not both named'
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-020 step 1: ordinary hook rows — pf-user-docs, pf-dev-docs\n'
# ══════════════════════════════════════════════════════════════════════════════

assert_hook "TC-020" "pf-user-docs: main Q&A cycle" "$USERDOCS" \
  '## Write `user_docs.md`' '## Review `user_docs.md`'

assert_hook "TC-020" "pf-dev-docs: main Q&A cycle" "$DEVDOCS" \
  '## Write `dev_docs.md`' '## Review `dev_docs.md`'

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-020 step 1 & 2: pf-codereview — one hook row, one exception row\n'
# ══════════════════════════════════════════════════════════════════════════════

assert_no_hook "TC-020" '`code.review: skip` confirmation (own copy — always asked, exception)' "$CODEREVIEW" \
  '## Phase 1.5:' '## Phase 2: Reviewer Selection'

assert_hook "TC-020" 'Review-gate reuse (after Phase 3, not a new hook) + fix sub-agent AskUserQuestion' "$CODEREVIEW" \
  '## Phase 4: The Hard Gate' '## Phase 5: Commit & Push'

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-020 step 1: ordinary hook row — pf-qa\n'
# ══════════════════════════════════════════════════════════════════════════════

assert_hook "TC-020" '"These items require human confirmation" (plain-text, generalized hook)' "$QA" \
  '## Phase 3: Manual Item Confirmation' '## Phase 3.5'

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-020 step 5: pf-test — "No test runner detected" (finding #11)\n'
# ══════════════════════════════════════════════════════════════════════════════
# The fix for finding #11 is that the plain-text question is now covered by
# the hook — literal-AskUserQuestion absence is no longer treated as proof
# there is no stop here. Assert BOTH halves: the hook reference is present
# around the question, AND (unchanged, still true) no literal AskUserQuestion
# call exists anywhere in this file.

assert_hook "TC-020" '"No test runner detected" plain-text question' "$TEST" \
  '## Phase 1: Detect Test Runner' '## Phase 2: Run the Test Suite'

# Every mention of the string "AskUserQuestion" in this file must be the
# prose disclaimer ("...not a literal `AskUserQuestion` call...") that
# explains finding #11 — never an actual invocation instruction (the
# "ask the user via `AskUserQuestion`" shape used elsewhere in this
# framework). A bare substring-absence check would be too strict: the
# disclaimer itself has to name the tool to explain it is NOT calling it.
ASKUQ_LINES="$(grep -c 'AskUserQuestion' "$TEST" || true)"
ASKUQ_DISCLAIMED="$(grep -c 'not a literal.*AskUserQuestion' "$TEST" || true)"
if [ "$ASKUQ_LINES" -eq "$ASKUQ_DISCLAIMED" ]; then
  pf_pass 'TC-020: pf-test still contains no literal AskUserQuestion call (finding #11 — this half was already true; every mention is the disclaiming prose, not an invocation)'
else
  pf_fail "TC-020: pf-test contains an AskUserQuestion mention that is not the disclaiming prose ($ASKUQ_LINES total, $ASKUQ_DISCLAIMED disclaimed)"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-020 step 4: pf-close Phase 1 — extended final decision gate (finding #10, positive assert)\n'
# ══════════════════════════════════════════════════════════════════════════════
# Not a plain exception: the table marks this row "не исключение — расширенный
# финальный гейт". Assert the range contains BOTH the front-loaded hook
# reference AND text confirming behavior is unchanged for an issue without
# the field.

CLOSE_PHASE1="$(range_between "$CLOSE" '## Phase 1: Confirm with User' '## Phase 2: Pre-Close Cleanup')"
if [ -z "$CLOSE_PHASE1" ]; then
  pf_fail 'TC-020: pf-close Phase 1 section not found'
else
  if printf '%s' "$CLOSE_PHASE1" | grep -q 'front-loaded'; then
    pf_pass 'TC-020: pf-close Phase 1 — front-loaded extended gate present'
  else
    pf_fail 'TC-020: pf-close Phase 1 — no mention of front-loaded'
  fi
  if printf '%s' "$CLOSE_PHASE1" | grep -q 'unchanged'; then
    pf_pass 'TC-020: pf-close Phase 1 — behavior-unchanged-without-the-field text present'
  else
    pf_fail 'TC-020: pf-close Phase 1 — no text confirming unchanged behavior without the field'
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-020 step 1 & 2: pf — two hook rows, one exception row\n'
# ══════════════════════════════════════════════════════════════════════════════

assert_hook "TC-020" 'Reviewer-assignment guard (before Step 5, bug-type)' "$PF" \
  '## Reviewer-assignment guard (before Step 5)' '## `code.review: skip` confirmation guard (before Step 5)'

assert_no_hook "TC-020" '`code.review: skip` confirmation guard (before Step 5, exception)' "$PF" \
  '## `code.review: skip` confirmation guard (before Step 5)' '## Step 5: Detect completed stages'

assert_hook "TC-020" 'Bug workflow, "CREATE only" row (clarifying dialog + tier reconfirmation)' "$PF" \
  '### bug workflow' '## Step 7: Output'

# ─── S-5 ──────────────────────────────────────────────────────────────────────
assert_repo_untouched

pf_summary
