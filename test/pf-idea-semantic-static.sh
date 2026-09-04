#!/usr/bin/env bash
# shellcheck disable=SC2016  # backticks are literal markdown code-spans in grep patterns, not command substitution
# @pf-issue [20260902-feat-idea-stage]
# test/pf-idea-semantic-static.sh — scenario-level regression tests for the
# six round-2 code-review findings (CR-014..CR-019, docs/issues/open/
# 20260902-feat-idea-stage/code_review.md) that a fully green `make test`
# missed at the time: every one of them was a semantic gap in a SKILL.md
# contract, not a structural/shape defect, and the existing static suites
# (test/pf-idea-stage-static.sh, test/pf-idea-front-loaded-static.sh) only
# check shape.
#
# Same style as those two suites: read-only, grep/awk-based, no ~/.claude
# involved, no real /pf run — this is a skill-based framework, so "behavior"
# is text in a SKILL.md, and a scenario test here checks that the relevant
# text is present, mutually consistent, and (where the property is checkable
# in bash directly, per CR-019) literally holds — not that any code executes.
#
# One section per finding, each naming what would have to regress in the
# SKILL.md text for that section's asserts to go red again.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

SKILLS="$REPO_ROOT/skills"
CLOSE="$SKILLS/pf-close/SKILL.md"
PF="$SKILLS/pf/SKILL.md"
VERDICT="$SKILLS/pf-idea-verdict/SKILL.md"
INTERACTION="$SKILLS/pf-interaction/SKILL.md"

# range_between <file> <start-literal> <end-literal>
#
# Same helper as test/pf-idea-stage-static.sh: prints the lines from (and
# including) the first line containing <start-literal> up to (but excluding)
# the next line containing <end-literal>. Literal substring match (awk
# index()), not regex — markdown backticks/parens/colons need no escaping.
# An empty <end-literal> means "to end of file".
range_between() {
  local file="$1" s="$2" e="$3"
  awk -v s="$s" -v e="$e" '
    index($0,s) && !flag { flag=1; print; next }
    flag && e != "" && index($0,e) { exit }
    flag { print }
  ' "$file"
}

# first_line <file> <fixed-string> — 1-based line number of the first match,
# empty if not found. Used for ordering asserts (guard-before-action).
first_line() {
  grep -nF -- "$2" "$1" 2>/dev/null | head -1 | cut -d: -f1
}

# ══════════════════════════════════════════════════════════════════════════════
printf '=== CR-014: closing a spike from a foreign branch never commits on it\n'
# ══════════════════════════════════════════════════════════════════════════════
# Contract: skills/pf-close/SKILL.md Phase 2 ("Pre-Close Cleanup"). For
# TYPE:spike, before the unconditional "git add -A" that Phase 2 otherwise
# always runs on a dirty tree, there must be a branch guard that (a) computes
# PARENT-BRANCH early, (b) checks the current branch, and (c) STOPS — without
# running git add -A — when the branch is neither issue/<spike-id> nor
# PARENT-BRANCH. Breaks if: the guard text is deleted (reverting to the
# pre-CR-014 unconditional add -A), or the guard is reordered to fall after
# the git add -A step (making it decorative), or the stop wording no longer
# actually forbids running git add -A.

phase2="$(range_between "$CLOSE" '## Phase 2: Pre-Close Cleanup' '## Phase 3: Detect Parent Branch')"

if printf '%s\n' "$phase2" | grep -qF 'verify the branch first'; then
  pf_pass "CR-014: Phase 2 defines a spike-only branch guard before committing"
else
  pf_fail "CR-014: Phase 2 has no spike branch guard — a spike close would git-add-A unconditionally again"
fi

if printf '%s\n' "$phase2" | grep -qF 'Compute PARENT-BRANCH now'; then
  pf_pass "CR-014: the guard computes PARENT-BRANCH before checking the branch"
else
  pf_fail "CR-014: the guard no longer computes PARENT-BRANCH up front"
fi

stop_line="$(first_line "$CLOSE" 'do not run `git add -A`')"
add_line="$(first_line "$CLOSE" '- Run `git add -A`')"

if [ -n "$stop_line" ] && [ -n "$add_line" ]; then
  pf_pass "CR-014: the stop-on-foreign-branch wording exists ('do not run \`git add -A\`')"
  if [ "$stop_line" -lt "$add_line" ]; then
    pf_pass "CR-014: the guard's stop (line $stop_line) is textually BEFORE the unconditional git add -A (line $add_line)"
  else
    pf_fail "CR-014: the guard's stop (line $stop_line) is not before git add -A (line $add_line) — a foreign-branch dirty tree would still be committed"
  fi
else
  pf_fail "CR-014: could not locate both the stop wording and the git add -A step (guard text likely removed)"
fi

if printf '%s\n' "$phase2" | grep -qF 'neither the spike'; then
  pf_pass "CR-014: the guard's condition names 'neither issue/<spike-id> nor the parent' explicitly"
else
  pf_fail "CR-014: the guard no longer states the neither-branch-nor-parent condition"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== CR-015: every /pf intake question goes through the non-Claude adapter\n'
# ══════════════════════════════════════════════════════════════════════════════
# Contract: skills/pf/SKILL.md — every AskUserQuestion call the intake
# sequence makes must have a "Non-Claude orchestrator" / orchestrator_provider
# substitution documented near it, so a Codex-orchestrated session never hits
# a missing tool mid-intake. Six call sites named by CR-015: Step 0's type
# question, Step 3's type question (+ its spike-vs-feature confirm), the
# doc_language question, the idea-from-a-file confirmation, role assignment,
# and on_unavailable. Each assert below breaks if that specific call site's
# adapter substitution text is removed or the call site itself moves out of
# range of it (i.e. this specific intake question would again be unconditional).

assert_adapter_covers() {
  local label="$1" start="$2" end="$3"
  local range
  range="$(range_between "$PF" "$start" "$end")"
  if printf '%s\n' "$range" | grep -qF 'Non-Claude orchestrator'; then
    pf_pass "CR-015: $label has a Non-Claude orchestrator substitution"
  else
    pf_fail "CR-015: $label has NO Non-Claude orchestrator substitution nearby — unconditional AskUserQuestion again"
  fi
}

assert_adapter_covers 'Step 0 folder-state type question' \
  '**"What are we working on: an idea' \
  '**Branch — "An idea" answer.**'

assert_adapter_covers 'Step 3 type question (+ type-confirm)' \
  '## Step 3: Handle zero or multiple issues' \
  '**Build a feature / Fix a bug**'

step3_range="$(range_between "$PF" '## Step 3: Handle zero or multiple issues' '**Build a feature / Fix a bug**')"
if printf '%s\n' "$step3_range" | grep -qF 'step=type-confirm'; then
  pf_pass "CR-015: the substitution names step=type-confirm explicitly (spike-vs-feature confirmation covered)"
else
  pf_fail "CR-015: the substitution no longer names step=type-confirm — spike confirmation left unconditional"
fi

assert_adapter_covers 'doc_language question' \
  'What language should the planning documents' \
  'Immediately after, use AskUserQuestion to ask a second question'

assert_adapter_covers 'idea-from-a-file confirmation' \
  'Idea from a file (US-03a)' \
  'Unreadable/binary/empty file'

role_range="$(range_between "$PF" '### Role assignment' '**Question 3 (optional')"
if printf '%s\n' "$role_range" | grep -qF 'Non-Claude orchestrator'; then
  pf_pass "CR-015: role assignment has a Non-Claude orchestrator substitution"
else
  pf_fail "CR-015: role assignment has NO Non-Claude orchestrator substitution"
fi
if printf '%s\n' "$role_range" | grep -qF 'step=roles'; then
  pf_pass "CR-015: the substitution names step=roles.<n> explicitly (Question 1 covered)"
else
  pf_fail "CR-015: the substitution no longer names step=roles.<n>"
fi
if printf '%s\n' "$role_range" | grep -qF 'step=on-unavailable'; then
  pf_pass "CR-015: the substitution names step=on-unavailable explicitly (Question 2 covered)"
else
  pf_fail "CR-015: the substitution no longer names step=on-unavailable — on_unavailable question left unconditional"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== CR-016: a pending intake draft is found before has_pf/has_git\n'
# ══════════════════════════════════════════════════════════════════════════════
# Contract: skills/pf/SKILL.md Step 0. A cold /pf must check for an open
# .pf-intake-draft-* marker BEFORE computing has_pf/has_git (which decide the
# folder-state question) — otherwise a fresh session re-asks "type" and
# clobbers the draft. Also: with several drafts pending, behavior must be
# defined (not silently pick one and lose the rest). Breaks if the draft
# check is moved after the boolean computation, or the multi-draft case is
# dropped back to being unhandled.

draft_line="$(first_line "$PF" 'Resume a pending intake draft')"
bool_line="$(first_line "$PF" 'Compute two booleans')"

if [ -n "$draft_line" ] && [ -n "$bool_line" ]; then
  if [ "$draft_line" -lt "$bool_line" ]; then
    pf_pass "CR-016: intake-draft resume check (line $draft_line) runs before has_pf/has_git computation (line $bool_line)"
  else
    pf_fail "CR-016: intake-draft resume check (line $draft_line) no longer precedes has_pf/has_git (line $bool_line) — cold start could re-ask type and clobber the draft"
  fi
else
  pf_fail "CR-016: could not locate both the draft-resume check and the has_pf/has_git computation"
fi

if grep -qF 'More than one found' "$PF"; then
  pf_pass "CR-016: the multiple-pending-drafts case is explicitly handled"
else
  pf_fail "CR-016: the multiple-pending-drafts case is no longer addressed — behavior with >1 draft is undefined again"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== CR-017: Mode 2 entry requires a clean tail, not just verdict.md\n'
# ══════════════════════════════════════════════════════════════════════════════
# Contract: skills/pf-idea-verdict/SKILL.md "Which mode runs". Entering Mode 2
# (the decision session) must require BOTH a fresh PASSED on verdict.md AND
# no later OPEN on idea.md/research.md/critique.md — order-independently
# (checking each file's own last marker, not "whichever pf-check ran last").
# Breaks if the "tail clean" definition is removed, if it stops naming the
# three upstream files, if the order-independence guarantee is dropped, or if
# Mode 2's own entry condition stops referencing "tail clean" (falling back to
# checking verdict.md alone).

if grep -qF 'Define **tail clean** as' "$VERDICT"; then
  pf_pass "CR-017: 'tail clean' is explicitly defined"
else
  pf_fail "CR-017: 'tail clean' definition is gone"
fi

tail_def="$(range_between "$VERDICT" 'Define **tail clean** as' '## Mode 1')"
if printf '%s\n' "$tail_def" | grep -qF '`idea.md`/`research.md`/`critique.md`'; then
  pf_pass "CR-017: the tail-clean definition names idea.md/research.md/critique.md, not just verdict.md"
else
  pf_fail "CR-017: the tail-clean definition no longer checks idea.md/research.md/critique.md"
fi

if printf '%s\n' "$tail_def" | grep -qF 'order-independent'; then
  pf_pass "CR-017: the tail-clean check is documented as order-independent"
else
  pf_fail "CR-017: the order-independence guarantee is no longer stated"
fi

mode2_row="$(printf '%s\n' "$tail_def" | grep -F '**Mode 2**')"
if printf '%s' "$mode2_row" | grep -qF 'tail clean'; then
  pf_pass "CR-017: Mode 2's own entry condition is gated on tail clean, not verdict.md alone"
else
  pf_fail "CR-017: Mode 2's entry row no longer references tail clean"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== CR-018: final-gate open_questions.md is created to the canonical schema\n'
# ══════════════════════════════════════════════════════════════════════════════
# Contract: skills/pf-interaction/SKILL.md "Codex text-REPL adapter", item 2's
# open_questions.md placement bullet. pf-close's Phase 1 tolerates
# open_questions.md's absence, but the non-Claude final-gate marker must not
# — if the file doesn't exist when the marker is about to be written, it must
# be created FIRST, atomically, using the canonical header+table from the
# "row schema (canonical)" section (even with zero data rows) — never a
# marker-only file with a different shape. Breaks if the create-first
# instruction is dropped, or if it stops pointing at the canonical schema
# section (an implementation could then invent its own ad hoc header).

final_gate_bullet="$(range_between "$INTERACTION" '`open_questions.md` (final gate' 'the intake draft (`stage=intake`)')"

if printf '%s\n' "$final_gate_bullet" | grep -qF 'it first, atomically, with the canonical header and table from'; then
  pf_pass "CR-018: absent open_questions.md is created first, atomically, before the final-gate marker is written"
else
  pf_fail "CR-018: the create-first-if-absent instruction for open_questions.md is gone"
fi

if printf '%s\n' "$final_gate_bullet" | grep -qF 'row schema (canonical)'; then
  pf_pass "CR-018: the created file is explicitly tied to the canonical row-schema section"
else
  pf_fail "CR-018: the created file no longer references the canonical row-schema section — shape is unspecified again"
fi

if printf '%s\n' "$final_gate_bullet" | grep -qF 'even with zero'; then
  pf_pass "CR-018: creation is unconditional on there being any data rows yet"
else
  pf_fail "CR-018: the zero-rows case is no longer covered"
fi

# The canonical schema itself must actually define a header + table, so
# "create it per that schema" has something concrete to point at.
canon="$(range_between "$INTERACTION" '## `open_questions.md` row schema (canonical)' '## One final human gate per issue')"
if printf '%s\n' "$canon" | grep -qF '# Open Questions —' && printf '%s\n' "$canon" | grep -qF '| # | Raised by | Question |'; then
  pf_pass "CR-018: the canonical schema itself still defines the header line and table header row"
else
  pf_fail "CR-018: the canonical schema section no longer defines a concrete header+table shape"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== CR-019: pending-interaction answers are base64 in their own field\n'
# ══════════════════════════════════════════════════════════════════════════════
# Contract: skills/pf-interaction/SKILL.md item 2's closed-state schema.
# `status` must be a closed two-value enum (open|resolved) and the free-text
# reply must live in a SEPARATE `answer` field, base64-encoded — never
# embedded as `status=resolved:<answer>` — because a raw reply containing a
# newline or the literal sequence `-->` would otherwise break the single-line
# HTML-comment marker. First check the contract text says this; then check
# the property literally: base64-encoding a reply that contains both a
# newline and `-->` produces output containing neither.

if grep -qF 'closed two-value enum' "$INTERACTION"; then
  pf_pass "CR-019: 'status' is documented as a closed two-value enum"
else
  pf_fail "CR-019: 'status' is no longer documented as a closed enum — free text could leak back in"
fi

if grep -qF 'standard base64' "$INTERACTION" && grep -qF '`answer` — the free-text reply' "$INTERACTION"; then
  pf_pass "CR-019: the free-text reply is documented as a separate, base64-encoded 'answer' field"
else
  pf_fail "CR-019: the separate base64-encoded 'answer' field is no longer documented"
fi

# Property check: a hostile reply containing both a newline and the marker's
# own closing sequence, base64-encoded, must contain neither.
hostile_reply=$'first line\nsecond line--> status=resolved:tricked -->'
if ! printf '%s' "$hostile_reply" | grep -qF -- '-->'; then
  pf_fail "CR-019: test fixture is broken — hostile_reply doesn't even contain '-->' to begin with"
elif ! printf '%s\n' "$hostile_reply" | grep -q .; then
  pf_fail "CR-019: test fixture is broken — hostile_reply has no embedded newline to begin with"
else
  pf_pass "CR-019: fixture confirmed hostile (embeds a newline and a literal '-->')"
fi

encoded="$(printf '%s' "$hostile_reply" | base64 | tr -d '\n')"

if [ -n "$encoded" ] && [[ "$encoded" != *$'\n'* ]]; then
  pf_pass "CR-019: base64(hostile_reply) contains no embedded newline"
else
  pf_fail "CR-019: base64(hostile_reply) still contains a newline — the marker line would still break"
fi

if [[ "$encoded" != *'-->'* ]]; then
  pf_pass "CR-019: base64(hostile_reply) contains no literal '-->' — cannot terminate the HTML comment early"
else
  pf_fail "CR-019: base64(hostile_reply) still contains '-->' — the RFC 4648 standard alphabet claim doesn't hold here"
fi

# ─── S-5 ──────────────────────────────────────────────────────────────────────
assert_repo_untouched

pf_summary
