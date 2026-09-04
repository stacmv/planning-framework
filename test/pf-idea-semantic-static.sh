#!/usr/bin/env bash
# shellcheck disable=SC2016  # backticks are literal markdown code-spans in grep patterns, not command substitution
# @pf-issue [20260902-feat-idea-stage]
# test/pf-idea-semantic-static.sh — scenario-level regression tests for the
# round-2/round-3 code-review findings (CR-014..CR-024, docs/issues/open/
# 20260902-feat-idea-stage/code_review.md) that a fully green `make test`
# missed at the time: every one of them was a semantic gap in a SKILL.md
# contract, not a structural/shape defect, and the existing static suites
# (test/pf-idea-stage-static.sh, test/pf-idea-front-loaded-static.sh) only
# check shape.
#
# Same style as those two suites: read-only, grep/awk-based, no ~/.claude
# involved, no real /pf run — this is a skill-based framework, so "behavior"
# is text in a SKILL.md, and a scenario test here checks that the relevant
# text is present, mutually consistent, order-correct, and (where the
# property is checkable in bash directly, per CR-024) actually round-trips —
# not that any code executes.
#
# Task 37 (CR-023/CR-024) rewrote this suite after a Codex review found it
# was NOT a real barrier: 25/29 asserts only checked that a fixed phrase was
# present somewhere in a wide range (no coupling to the specific call site,
# no negative checks — an adapter could be deleted from a batch this suite
# never looked at and every assert stayed green), and 3 of the CR-019
# property asserts were true by construction (a literal fixture, a
# non-emptiness check, an unconditional `tr -d`) — provably unable to go red
# from ANY mutation of the skill text. This version's bar, enforced while
# writing it: every assert below must name a concrete mutation of the
# SKILL.md source it reads that turns it red, verified in practice on a
# throwaway copy — never against this repo's own working tree (S-5).

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
printf '=== CR-014 & CR-021: spike branch preflight runs before any marker write, Phase 2 reuses it\n'
# ══════════════════════════════════════════════════════════════════════════════
# Contract (Task 36 rewrite of the original CR-014 fix): PARENT-BRANCH for a
# spike close is computed exactly once, in Phase 1's "Branch preflight"
# (skills/pf-close/SKILL.md), BEFORE Phase 1 can write any final-gate marker
# and BEFORE Phase 2 runs at all. Phase 2's own branch guard is retained only
# as defense-in-depth and explicitly reuses that value rather than
# recomputing it. The preflight distinguishes three outcomes over
# branch-state x dirty-tree: (issue/<spike-id> or PARENT-BRANCH) -> no
# action; (foreign branch, clean) -> checkout PARENT-BRANCH; (foreign
# branch, dirty) -> stop before writing anything. Phase 3.5 separately
# guarantees the final-gate marker survives its `git checkout issue/
# <spike-id> -- docs/issues/open/<spike-id>` step by snapshotting it first
# and reconciling by `asked` timestamp, never a blind append.
#
# The previous version of this section grepped for the literal phrase
# "Compute PARENT-BRANCH now" INSIDE Phase 2's range — that phrase legally
# moved to Phase 1 as part of this very fix (Task 36), so the assert had
# gone red for the right reason (Task 37) but the wrong contract. Rewritten
# below to check where PARENT-BRANCH is actually computed, and that Phase 2
# reuses rather than recomputes it.

preflight="$(range_between "$CLOSE" '**Branch preflight (`TYPE: spike` only' '**Front-loaded final decision gate')"
phase2_guard="$(range_between "$CLOSE" '## Phase 2: Pre-Close Cleanup' '## Phase 3: Detect Parent Branch')"
phase35="$(range_between "$CLOSE" '## Phase 3.5: Copy Issue Documents' '## Phase 4: Merge')"

if printf '%s\n' "$preflight" | grep -qF 'Compute PARENT-BRANCH now'; then
  pf_pass "CR-021: Phase 1's branch preflight computes PARENT-BRANCH up front"
else
  pf_fail "CR-021: Phase 1's branch preflight no longer computes PARENT-BRANCH — Task 36 moved this out of Phase 2 on purpose, it must live here"
fi

preflight_line="$(first_line "$CLOSE" 'Compute PARENT-BRANCH now')"
stop_line="$(first_line "$CLOSE" 'do not run `git add -A`')"
add_line="$(first_line "$CLOSE" '- Run `git add -A`')"

if [ -n "$preflight_line" ] && [ -n "$stop_line" ]; then
  if [ "$preflight_line" -lt "$stop_line" ]; then
    pf_pass "CR-021: PARENT-BRANCH computation (line $preflight_line) precedes Phase 2's guard (line $stop_line)"
  else
    pf_fail "CR-021: PARENT-BRANCH computation no longer precedes Phase 2's guard — Phase 1 and Phase 2 could disagree on PARENT-BRANCH again"
  fi
else
  pf_fail "CR-021: could not locate both the preflight's PARENT-BRANCH computation and Phase 2's stop wording"
fi

if printf '%s\n' "$phase2_guard" | grep -qF 'do not recompute it'; then
  pf_pass "CR-014: Phase 2's guard explicitly reuses Phase 1's PARENT-BRANCH instead of recomputing it"
else
  pf_fail "CR-014: Phase 2's guard no longer states it reuses (not recomputes) PARENT-BRANCH — the two phases could drift apart"
fi

if printf '%s\n' "$phase2_guard" | grep -qF 'verify the branch first'; then
  pf_pass "CR-014: Phase 2 defines a spike-only branch guard before committing"
else
  pf_fail "CR-014: Phase 2 has no spike branch guard — a spike close would git-add-A unconditionally again"
fi

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

if printf '%s\n' "$phase2_guard" | grep -qF 'neither the spike'; then
  pf_pass "CR-014: the guard's condition names 'neither issue/<spike-id> nor the parent' explicitly"
else
  pf_fail "CR-014: the guard no longer states the neither-branch-nor-parent condition"
fi

if printf '%s\n' "$preflight" | grep -qF 'as defense-in-depth'; then
  pf_pass "CR-014: Phase 2's guard is documented as defense-in-depth, not the primary defense"
else
  pf_fail "CR-014: Phase 2's guard is no longer documented as defense-in-depth — the ordering claim above may be stale"
fi

# Finite-state check: the three outcomes the preflight distinguishes over
# branch-state x dirty-tree must each still be named explicitly — deleting
# or inverting any one of them (e.g. checking out on DIRTY instead of clean)
# would silently reopen CR-005/CR-014/CR-021.
if printf '%s\n' "$preflight" | grep -qF 'no action; proceed'; then
  pf_pass "CR-021: state '(issue/<spike-id> or PARENT-BRANCH)' -> no action"
else
  pf_fail "CR-021: the 'no action' outcome for issue/<spike-id>/PARENT-BRANCH is gone"
fi
if printf '%s\n' "$preflight" | grep -qF 'run `git checkout PARENT-BRANCH` now'; then
  pf_pass "CR-021: state '(foreign branch, clean)' -> checkout PARENT-BRANCH"
else
  pf_fail "CR-021: the '(foreign branch, clean) -> checkout PARENT-BRANCH' outcome is gone"
fi
if printf '%s\n' "$preflight" | grep -qF 'stop here, before showing any confirmation or writing any marker'; then
  pf_pass "CR-021: state '(foreign branch, dirty)' -> stop before any marker write"
else
  pf_fail "CR-021: the '(foreign branch, dirty) -> stop before any marker write' outcome is gone"
fi

# Phase 3.5: the final-gate marker must be snapshotted BEFORE the checkout
# that can overwrite open_questions.md with a stale spike-branch copy, and
# reconciled by `asked` timestamp rather than blindly appended (which would
# duplicate the marker, violating "at most one open marker per point").
snapshot_line="$(first_line "$CLOSE" 'Snapshot the final-gate marker before copying')"
checkout_line="$(first_line "$CLOSE" 'git checkout issue/<spike-id> -- docs/issues/open/<spike-id>')"
if [ -n "$snapshot_line" ] && [ -n "$checkout_line" ] && [ "$snapshot_line" -lt "$checkout_line" ]; then
  pf_pass "CR-021: the final-gate marker is snapshotted (line $snapshot_line) before the checkout that could overwrite it (line $checkout_line)"
else
  pf_fail "CR-021: the marker snapshot no longer precedes the spike-branch checkout — a fresher PARENT-BRANCH marker could be silently clobbered"
fi

if printf '%s\n' "$phase35" | grep -qF "keep only the more recent one as the file's trailing line"; then
  pf_pass "CR-021: the reconcile step keeps the marker with the later 'asked' timestamp, never a blind append"
else
  pf_fail "CR-021: the reconcile-by-timestamp rule is gone — could duplicate or lose the final-gate marker"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== CR-015 & CR-023: every /pf intake question is locally replaced for a non-Claude orchestrator\n'
# ══════════════════════════════════════════════════════════════════════════════
# Contract: skills/pf/SKILL.md — every AskUserQuestion call reachable from
# the idea/spike intake path must have a "Non-Claude orchestrator"
# substitution documented near it, AND that substitution must name the
# specific `step=`/draft-path token for THAT call — not just the generic
# phrase, which a neighboring, unrelated adapter mention could also satisfy.
# Eight call sites are reachable from idea/spike (verified against
# skills/pf/SKILL.md and skills/pf-interaction/SKILL.md item 2's `step`
# dictionary): Step 0's folder-state question, Step 3's type question (+
# type-confirm), doc_language, idea-from-a-file confirmation, the idea
# content batches, the spike content batches, and role assignment (+
# on_unavailable). CR-023's core finding was that the two CONTENT-BATCH
# adapters were never checked at all — deleting either left the suite green.

assert_adapter_covers() {
  local label="$1" start="$2" end="$3" bind="${4:-}"
  local range
  range="$(range_between "$PF" "$start" "$end")"
  if printf '%s\n' "$range" | grep -qF 'Non-Claude orchestrator'; then
    pf_pass "CR-015: $label has a Non-Claude orchestrator substitution"
  else
    pf_fail "CR-015: $label has NO Non-Claude orchestrator substitution nearby — unconditional AskUserQuestion again"
  fi
  if [ -n "$bind" ]; then
    if printf '%s\n' "$range" | grep -qF "$bind"; then
      pf_pass "CR-023: $label's substitution names '$bind' — bound to this specific call, not a generic mention"
    else
      pf_fail "CR-023: $label's substitution no longer names '$bind' — could be satisfied by an unrelated adapter mention nearby"
    fi
  fi
}

assert_adapter_covers 'Step 0 folder-state type question' \
  '**"What are we working on: an idea' \
  '**Branch — "An idea" answer.**' \
  'step=folder-mode'

assert_adapter_covers 'Step 3 type question' \
  '## Step 3: Handle zero or multiple issues' \
  '**Build a feature / Fix a bug**' \
  'step=issue-type'

step3_range="$(range_between "$PF" '## Step 3: Handle zero or multiple issues' '**Build a feature / Fix a bug**')"
if printf '%s\n' "$step3_range" | grep -qF 'step=type-confirm'; then
  pf_pass "CR-015: the substitution names step=type-confirm explicitly (spike-vs-feature confirmation covered)"
else
  pf_fail "CR-015: the substitution no longer names step=type-confirm — spike confirmation left unconditional"
fi

assert_adapter_covers 'doc_language question' \
  'What language should the planning documents' \
  'Immediately after, use AskUserQuestion to ask a second question' \
  'step=language'

assert_adapter_covers 'idea-from-a-file confirmation' \
  'Idea from a file (US-03a)' \
  'Unreadable/binary/empty file' \
  'step=file-confirm'

# CR-023's headline finding: these two content-batch adapters were outside
# every range above, so deleting either one (removing the substitution for
# up to 7 AskUserQuestion calls at once) left the whole suite green.
assert_adapter_covers 'Idea intake batch (content Batch 1+2)' \
  '**Idea intake batch' \
  '**Idea from a file (US-03a).**' \
  '.pf-intake-draft-idea.md'

assert_adapter_covers 'Spike intake batch (content Batch 1+2)' \
  '**Spike intake batch' \
  '**No bare-folder carve-out for spike.**' \
  '.pf-intake-draft-spike.md'

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

# Coverage count: every adapter paragraph above starts with the literal
# sentence "**Non-Claude orchestrator.**" (role assignment's one paragraph
# covers both Question 1 and Question 2, so 8 call sites -> 7 paragraphs).
# This catches a call site none of the per-range asserts above happens to
# name losing its adapter, not just the two named above.
adapter_count="$(grep -cF 'Non-Claude orchestrator' "$PF")"
if [ "$adapter_count" -eq 7 ]; then
  pf_pass "CR-023: exactly 7 'Non-Claude orchestrator' substitutions in pf/SKILL.md (one per intake call-site group)"
else
  pf_fail "CR-023: expected exactly 7 'Non-Claude orchestrator' substitutions in pf/SKILL.md, found $adapter_count — a call site gained or lost its adapter"
fi

# Negative: the has_pf/has_git branch table (Step 0) must not be silently
# invertible — "true" must gate the unchanged Normal path, "false" must gate
# the NEW folder-state question, never the reverse.
if grep -qF '| true | (either) | Normal path' "$PF"; then
  pf_pass "CR-023: has_pf=true still routes to the unchanged Normal path"
else
  pf_fail "CR-023: has_pf=true no longer routes to the Normal path row — the branch table changed or was inverted"
fi
if grep -qF '| false | (either) | **NEW**' "$PF"; then
  pf_pass "CR-023: has_pf=false still routes to the NEW folder-state question"
else
  pf_fail "CR-023: has_pf=false no longer routes to the NEW row — the branch table changed or was inverted"
fi

# Negative: with multiple pending drafts, resumption must pick the EARLIEST
# `asked` draft, never the latest (which would silently strand the older,
# already-in-progress one and could discard answers already collected).
if grep -qF 'resume the one with the earliest `asked`' "$PF"; then
  pf_pass "CR-023: multi-draft resumption picks the EARLIEST-asked draft"
else
  pf_fail "CR-023: the earliest-asked-first rule for multiple pending drafts is gone"
fi
if grep -qF 'resume the one with the latest `asked`' "$PF"; then
  pf_fail "CR-023: found a 'latest asked' draft-selection rule alongside/instead of 'earliest' — contradictory or inverted contract"
else
  pf_pass "CR-023: no contradicting 'latest asked' draft-selection rule present"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== CR-016 & CR-020: draft resume ordering, step-key separation, entry provenance, atomic handoff\n'
# ══════════════════════════════════════════════════════════════════════════════
# Contract: skills/pf/SKILL.md Step 0. A cold /pf must check for an open
# .pf-intake-draft-* marker BEFORE computing has_pf/has_git (which decide the
# folder-state question) — otherwise a fresh session re-asks "type" and
# clobbers the draft. CR-020 (Task 35) additionally requires: (a) Step 0's
# two-option fork and Step 3's four-option fork use two DISTINCT step keys
# (`folder-mode` / `issue-type`), never one shared `step=type` serving both
# incompatible questions; (b) which fork produced the draft (`entry`) is
# carried forward as stored state, never re-derived from a freshly
# recomputed `has_pf` at resume time. CR-022 (adjacent, same task) requires
# the handoff from the type-agnostic pending draft to the typed draft to
# create-and-verify the new file BEFORE deleting the old one.

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

# CR-020: the pre-fix collapsed key `step=type` must not reappear anywhere —
# folder-mode and issue-type each need their own key so a resumed session
# can tell which of the two incompatible questions is pending.
if grep -qF 'step=type`' "$PF" || grep -qF 'step=type`' "$INTERACTION"; then
  pf_fail "CR-020: found the pre-fix collapsed key 'step=type' — folder-mode and issue-type must stay separate keys"
else
  pf_pass "CR-020: no collapsed 'step=type' key anywhere — folder-mode/issue-type stayed separate"
fi

# CR-020, second half: intake origin (`entry`) must be carried forward from
# the draft, never re-derived from a freshly recomputed has_pf on resume.
if grep -qF 'not on a freshly recomputed `has_pf`' "$PF"; then
  pf_pass "CR-020: the bare-folder/existing-project carve-out branches on stored entry, not a freshly recomputed has_pf"
else
  pf_fail "CR-020: the 'stored entry, not freshly recomputed has_pf' guarantee is gone — resuming could silently flip the carve-out"
fi

# CR-022: handoff from the type-agnostic pending draft to the typed draft
# must create-and-verify the new file BEFORE deleting the old one — never
# the reverse, or an interruption mid-handoff leaves no open marker anywhere
# (Step 0 would then find "None found" and restart intake from scratch).
create_line="$(first_line "$INTERACTION" 'Create the typed draft below')"
verify_line="$(first_line "$INTERACTION" 'Read the typed-draft path back and confirm')"
delete_line="$(first_line "$INTERACTION" 'Only then remove `.pf-intake-draft-pending.md`')"
if [ -n "$create_line" ] && [ -n "$verify_line" ] && [ -n "$delete_line" ] \
   && [ "$create_line" -lt "$verify_line" ] && [ "$verify_line" -lt "$delete_line" ]; then
  pf_pass "CR-022: handoff order is create (line $create_line) -> verify (line $verify_line) -> delete (line $delete_line)"
else
  pf_fail "CR-022: handoff steps are missing or out of order (create=$create_line verify=$verify_line delete=$delete_line) — could reopen the zero-open-marker gap"
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
printf '\n=== CR-019 & CR-024: pending-interaction marker — status/answer are separate fields, round-trip\n'
# ══════════════════════════════════════════════════════════════════════════════
# Contract: skills/pf-interaction/SKILL.md item 2's closed-state schema.
# `status` must be a closed two-value enum (open|resolved) and the free-text
# reply must live in a SEPARATE `answer` field, standard base64 — never
# embedded as `status=resolved:<answer>` — because a raw reply containing a
# newline or the literal sequence `-->` would otherwise break the
# single-line HTML-comment marker.
#
# The previous version of this section's last three asserts were true BY
# CONSTRUCTION and could not go red from any SKILL.md mutation (confirmed by
# the round-3 review): the fixture literally contained `-->`; the newline
# check (`printf '%s\n' x | grep -q .`) only proved the string was
# non-empty; `tr -d '\n'` guarantees a single line regardless of what
# encoder produced its input; and `-->` is algebraically impossible in the
# base64 alphabet regardless of the skill text. None of that exercises the
# contract text at all. Replaced below with: (1) a literal check that the
# marker TEMPLATE in the skill text itself defines `status=` and `answer=`
# as two distinct, space-separated fields, (2) a round-trip built by filling
# THAT extracted template's placeholders (not an independently-invented
# format) with a hostile multiline/Unicode reply, verifying the result is
# one line, `status` stays closed, and decoding `answer` back reproduces the
# original byte-for-byte, and (3) an explicit count-based check that the old
# `status=resolved:<answer>` form appears exactly once in the file — as the
# rejected example in the contract's own rationale sentence, never as an
# actual field spec anywhere else.

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

# The literal marker template line must define status/answer as two
# distinct, space-separated fields — `status=<open|resolved> answer=
# <base64|->` — not a merged `status=<open|resolved:<answer>>` form.
marker_template_line="$(grep -F 'status=<open|resolved> answer=<base64|->' "$INTERACTION" | head -1)"
if [ -n "$marker_template_line" ]; then
  pf_pass "CR-024: the marker template defines 'status' and 'answer' as two distinct, space-separated fields"
else
  pf_fail "CR-024: the marker template no longer defines separate 'status=<open|resolved>' and 'answer=<base64|->' fields — CR-019's fix may have been reverted"
fi

# Round-trip: fill the extracted template's placeholders with a base64
# encoding of a hostile multiline/Unicode reply, then verify the result.
hostile_reply=$'первая строка — юникод\nвторая строка--> status=resolved:tricked -->'
encoded_answer="$(printf '%s' "$hostile_reply" | base64 | tr -d '\n')"
instance=""
if [ -n "$marker_template_line" ]; then
  instance="${marker_template_line//<open|resolved>/resolved}"
  instance="${instance//<base64|->/$encoded_answer}"
fi

if [ -n "$marker_template_line" ] && [[ "$instance" != *$'\n'* ]]; then
  pf_pass "CR-024: the filled-in template fragment is a single line (no embedded newline survived encoding)"
else
  pf_fail "CR-024: the filled-in template fragment contains an embedded newline, or the template is missing — the marker line would break"
fi

if [ -n "$marker_template_line" ] && [[ "$instance" == *'status=resolved '* ]]; then
  pf_pass "CR-024: 'status=resolved' is closed and immediately followed by the separate 'answer=' field, not ':<raw-answer>'"
else
  pf_fail "CR-024: 'status=resolved' is no longer followed by a distinct 'answer=' field (or the template is missing)"
fi

if [ -n "$marker_template_line" ]; then
  parsed_answer="$(printf '%s' "$instance" | sed -E 's/.*answer=([^ ]*).*/\1/')"
  decoded="$(printf '%s' "$parsed_answer" | base64 -d 2>/dev/null || true)"
  if [ "$decoded" = "$hostile_reply" ]; then
    pf_pass "CR-024: round-trip holds — decoding the template's 'answer=' field reproduces the hostile multiline/Unicode reply byte-for-byte"
  else
    pf_fail "CR-024: round-trip broke — decoding the template's 'answer=' field did not reproduce the original hostile reply"
  fi
else
  pf_fail "CR-024: round-trip skipped — no marker template to fill in (see previous FAIL)"
fi

# The old merged form must appear exactly once in the whole file — as the
# rejected example inside the contract's own rationale sentence ("...the
# reason status and answer are two separate fields instead of one
# status=resolved:<answer> field..."), never anywhere else as an actual spec.
if grep -qF 'instead of one `status=resolved:<answer>` field' "$INTERACTION"; then
  pf_pass "CR-024: the contract explicitly rejects the old merged form (status=resolved:<answer>)"
else
  pf_fail "CR-024: the contract no longer explicitly rejects the old merged status=resolved:<answer> form"
fi

status_resolved_colon_count="$(grep -oF 'status=resolved:' "$INTERACTION" | wc -l)"
if [ "$status_resolved_colon_count" -eq 1 ]; then
  pf_pass "CR-024: 'status=resolved:' appears exactly once in pf-interaction/SKILL.md — only as the rejected old form"
else
  pf_fail "CR-024: 'status=resolved:' appears $status_resolved_colon_count times (expected exactly 1) — the old merged form may have crept back in as an actual field spec"
fi

# ─── S-5 ──────────────────────────────────────────────────────────────────────
assert_repo_untouched

pf_summary
