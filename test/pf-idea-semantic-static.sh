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
#
# Task 40 (round 4 review: CR-027/CR-028/CR-029) rewrote it AGAIN — a second
# "barrier or not" verdict on the same suite. Three concrete gaps closed:
#   - CR-027: the branch-preflight "finite-state check" searched three action
#     phrases independently over a wide range — swapping which condition
#     (clean vs. dirty) led to which action left every assert green. Fixed by
#     pinning each condition to its action as ONE literal spanning both
#     halves on the bullet's own source line (and the 8-cell branch x marker
#     table's own rows), so an inversion changes the literal itself.
#   - CR-027 also flagged that NO assert measured "marker present vs.
#     absent" at all, which is structurally why round 3's suite could not
#     catch CR-025/CR-026. Closed via the 8-cell table asserts below.
#   - CR-027, explicitly NOT accepted: a full finite-state-machine model of
#     the preflight (every branch x dirty x marker x carried-marker
#     transition, prose steps 4a-4d) implemented in bash. This is a textual
#     artifact, not executable code — a full FSM interpreter here is a large
#     rewrite for a shrinking marginal catch rate over the pinned-literal
#     approach above. Accepted scope boundary; point-in-time inversion
#     checks at the specific places CR-027 named instead.
#   - CR-028: `assert_adapter_covers` searched for the phrase "Non-Claude
#     orchestrator" and a step token independently, both over a wide range —
#     flipping `orchestrator_provider != claude` to `== claude`, replacing
#     "replace...with the adapter" with a bare prohibition, or an unrelated
#     adapter mention nearby, all left it green. Fixed by isolating the
#     specific "**Non-Claude orchestrator.**" paragraph for each call site
#     and binding the condition, the apply-verb, and the step token all to
#     THAT paragraph. `adapter_count` now counts structurally-valid
#     paragraphs (condition + apply-verb both present), not phrase mentions.
#   - CR-029: the round-trip extracted a single physical line containing the
#     `status=<open|resolved> answer=<base64|->` fragment — the "no embedded
#     newline" and "status=resolved " checks were then true by construction.
#     Fixed by extracting and normalizing the WHOLE marker template (`<!--
#     pf-pending-interaction:` through `-->`, which spans 4 markdown-wrapped
#     source lines), checking every field's presence and uniqueness, and
#     only then filling in ALL placeholders (not just status/answer) to
#     build the round-trip instance.
#
# Reproducibility (CR-027's other finding): a claim like "N mutations
# checked" is worthless from outside the session that produced it unless the
# mutations themselves are in the repository and re-runnable. See
# test/mutations/pf-idea-semantic.tsv (the manifest) and
# test/pf-idea-semantic-mutations.sh (the runner) — not wired into `make
# test` (see that script's own header for why), run it directly to verify.

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

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== CR-027: branch-preflight conditions are paired with a SINGLE action each (inversion reddens), marker-present/absent measured\n'
# ══════════════════════════════════════════════════════════════════════════════
# Contract: skills/pf-close/SKILL.md's branch preflight (CR-021/CR-026). Round-4
# review found the previous version of this check searched the whole preflight
# range independently for three action phrases ("no action"/"checkout"/
# "stop") — swapping which condition (clean vs. dirty, own-branch vs.
# foreign) leads to which action left all three green, because no assert
# looked at what preceded the action phrase on its own bullet. Below, every
# condition->action pairing is checked as ONE literal substring spanning both
# halves on the bullet's own source line — an inversion changes what that
# combined literal actually reads, so the assert for the ORIGINAL pairing
# goes red. Two direct negative probes additionally look for the specific
# swapped pairing (checkout-on-dirty / stop-on-clean) appearing anywhere.
#
# The "marker present / marker absent" dimension CR-027 named as entirely
# unmeasured (structurally why round 3's suite could not catch
# CR-025/CR-026) is checked against the 8-cell "branch x marker" table
# skills/pf-close/SKILL.md now states explicitly for this purpose — each of
# the four data rows is pinned by a single-line, both-columns literal, so a
# value swapped between the "No marker"/"Marker present" columns of one row,
# or a whole row swapped with another, breaks that row's own assert.
#
# NOT modeled here (accepted scope boundary — see file header): the full
# preflight finite-state machine (every branch x dirty x marker x
# carried-marker transition, prose steps 4a-4d). Point pairing/inversion
# checks at the places CR-027 actually named instead of a bash FSM.

own_branch_pairing='or PARENT-BRANCH itself** — no action; proceed'
foreign_clean_pairing='clean or marker-only dirty, no carried marker** — run `git checkout PARENT-BRANCH` now'
foreign_dirty_pairing='ordinary dirty (not marker-only)** — stop here, before showing any confirmation'

if grep -qF -- "$own_branch_pairing" "$CLOSE"; then
  pf_pass "CR-027: own-branch condition (issue/<spike-id> or PARENT-BRANCH) is paired with 'no action' on its own source line"
else
  pf_fail "CR-027: own-branch condition is no longer paired with 'no action' on one line — could have been reassigned to a different action"
fi

if grep -qF -- "$foreign_clean_pairing" "$CLOSE"; then
  pf_pass "CR-027: foreign+clean/no-carried-marker condition is paired with checkout on its own source line"
else
  pf_fail "CR-027: foreign+clean/no-carried-marker condition is no longer paired with checkout on one line — a clean/dirty swap would slip through here"
fi

if grep -qF -- "$foreign_dirty_pairing" "$CLOSE"; then
  pf_pass "CR-027: foreign+ordinary-dirty condition is paired with stop on its own source line"
else
  pf_fail "CR-027: foreign+ordinary-dirty condition is no longer paired with stop on one line — a clean/dirty swap would slip through here"
fi

# Direct inversion probes: the exact CR-027 attack is checking out on the
# ordinarily-dirty branch, or stopping on the clean one.
if grep -qF -- 'ordinary dirty (not marker-only)** — run `git checkout PARENT-BRANCH` now' "$CLOSE"; then
  pf_fail "CR-027: found ordinary-dirty paired with checkout — clean/dirty branch actions have been swapped"
else
  pf_pass "CR-027: ordinary-dirty is not paired with checkout (no clean/dirty swap found)"
fi
if grep -qF -- 'clean or marker-only dirty, no carried marker** — stop here' "$CLOSE"; then
  pf_fail "CR-027: found clean/no-carried-marker paired with stop — clean/dirty branch actions have been swapped"
else
  pf_pass "CR-027: clean/no-carried-marker is not paired with stop (no clean/dirty swap found)"
fi

# The 8-cell table's marker-present/absent dimension: full-row literals bind
# the branch condition to BOTH column values together — swapping the two
# column values within one row, or swapping two rows, breaks that row's own
# assert below.
table_row1='| `issue/<spike-id>` | no action (Task 36) | no action; resumed in place by `pf-interaction`'
table_row2='| PARENT-BRANCH itself | no action (Task 36) | no action; resumed in place by `pf-interaction`'
table_row3='| foreign, clean | checkout PARENT-BRANCH (Task 36) | checkout PARENT-BRANCH, carried marker applied onto it'
table_row4='| foreign, dirty | stop (Task 36) | marker-only dirt: same as'

if grep -qF -- "$table_row1" "$CLOSE"; then
  pf_pass "CR-027: table row 'issue/<spike-id>' pairs no-marker='no action' with marker-present='resumed in place'"
else
  pf_fail "CR-027: table row 'issue/<spike-id>' no longer pairs both columns as expected — a cell may have been swapped"
fi
if grep -qF -- "$table_row2" "$CLOSE"; then
  pf_pass "CR-027: table row 'PARENT-BRANCH itself' pairs no-marker='no action' with marker-present='resumed in place'"
else
  pf_fail "CR-027: table row 'PARENT-BRANCH itself' no longer pairs both columns as expected — a cell may have been swapped"
fi
if grep -qF -- "$table_row3" "$CLOSE"; then
  pf_pass "CR-027: table row 'foreign, clean' pairs no-marker='checkout' with marker-present='checkout + apply marker'"
else
  pf_fail "CR-027: table row 'foreign, clean' no longer pairs both columns as expected — a cell may have been swapped"
fi
if grep -qF -- "$table_row4" "$CLOSE"; then
  pf_pass "CR-027: table row 'foreign, dirty' pairs no-marker='stop' with marker-present='marker-only dirt bypasses stop'"
else
  pf_fail "CR-027: table row 'foreign, dirty' no longer pairs both columns as expected — a cell may have been swapped"
fi

# Negative: the two foreign-branch rows' no-marker actions must never appear
# swapped with each other (a clean/dirty inversion at the table level too).
if grep -qF -- '| foreign, clean | stop (Task 36)' "$CLOSE"; then
  pf_fail "CR-027: table row 'foreign, clean' has been paired with 'stop' — clean/dirty rows swapped"
else
  pf_pass "CR-027: table row 'foreign, clean' is not paired with 'stop'"
fi
if grep -qF -- '| foreign, dirty | checkout PARENT-BRANCH (Task 36)' "$CLOSE"; then
  pf_fail "CR-027: table row 'foreign, dirty' has been paired with 'checkout' — clean/dirty rows swapped"
else
  pf_pass "CR-027: table row 'foreign, dirty' is not paired with 'checkout'"
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

# extract_adapter_paragraph — reads a (possibly wide) range on stdin, prints
# just the "**Non-Claude orchestrator.**" paragraph inside it (its bold
# header line through the next blank line), nothing if absent. Isolating
# this one paragraph — rather than searching the whole wide range — is the
# CR-028 fix: everything checked below is bound to THIS specific paragraph.
extract_adapter_paragraph() {
  awk '
    /\*\*Non-Claude orchestrator\.\*\*/ { flag=1 }
    flag { print }
    flag && /^[[:space:]]*$/ { exit }
  '
}

# para_join — collapses a multi-line paragraph to one space-joined line, so a
# regex spanning a markdown-wrapped sentence (e.g. "replace ... call above
# with\nthat adapter") still matches as one phrase.
para_join() { tr '\n' ' ' | tr -s ' '; }

# assert_adapter_covers <label> <range-start> <range-end> [bind-token]
#
# CR-028: the previous version made two INDEPENDENT searches — the phrase
# "Non-Claude orchestrator" and a step/draft-path token — over the whole
# wide range, so it stayed green if `orchestrator_provider != claude` was
# flipped to `== claude`, if "replace...with the adapter" was swapped for a
# bare prohibition, or if some unrelated adapter mention elsewhere in the
# range happened to satisfy the phrase search. Below, every check — the
# condition, the apply-verb, and the bind token — is run against the SAME
# isolated paragraph, so any one of those three mutations reddens the
# specific assert that names it.
assert_adapter_covers() {
  local label="$1" start="$2" end="$3" bind="${4:-}"
  local range para para1
  range="$(range_between "$PF" "$start" "$end")"
  para="$(printf '%s\n' "$range" | extract_adapter_paragraph)"

  if [ -z "$para" ]; then
    pf_fail "CR-015: $label has NO Non-Claude orchestrator substitution nearby — unconditional AskUserQuestion again"
    pf_fail "CR-028: $label — no paragraph found to check condition/apply-verb binding (see previous FAIL)"
    return
  fi
  pf_pass "CR-015: $label has a Non-Claude orchestrator substitution"

  # The inequality must be LOCAL to this paragraph, and no contradicting
  # equality may sit in it — `!= claude` -> `== claude` would hand the
  # adapter to Claude sessions and leave a Codex session's AskUserQuestion
  # unconditional again.
  if printf '%s\n' "$para" | grep -qF 'orchestrator_provider != claude'; then
    pf_pass "CR-028: $label's paragraph tests orchestrator_provider != claude locally"
  else
    pf_fail "CR-028: $label's paragraph no longer tests != claude locally — could have been flipped to == claude"
  fi
  if printf '%s\n' "$para" | grep -qF 'orchestrator_provider == claude'; then
    pf_fail "CR-028: $label's paragraph also contains an == claude condition — inverted or contradictory guard"
  else
    pf_pass "CR-028: $label's paragraph has no contradicting == claude condition"
  fi

  # The paragraph must APPLY the adapter, never merely forbid the
  # unconditional call without saying what replaces it.
  para1="$(printf '%s\n' "$para" | para_join)"
  if printf '%s' "$para1" | grep -Eq 'replace.*with (that|the) adapter'; then
    pf_pass "CR-028: $label's paragraph applies the adapter ('replace ... with the adapter'), not a bare prohibition"
  else
    pf_fail "CR-028: $label's paragraph no longer says 'replace ... with the adapter' — could be a bare prohibition with nothing applied"
  fi

  if [ -n "$bind" ]; then
    if printf '%s\n' "$para" | grep -qF -- "$bind"; then
      pf_pass "CR-023: $label's substitution names '$bind' inside its OWN Non-Claude-orchestrator paragraph"
    else
      pf_fail "CR-023: $label's substitution no longer names '$bind' inside its own paragraph — could be satisfied by an unrelated adapter mention nearby"
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
role_para="$(printf '%s\n' "$role_range" | extract_adapter_paragraph)"
if [ -z "$role_para" ]; then
  pf_fail "CR-015: role assignment has NO Non-Claude orchestrator substitution"
  pf_fail "CR-028: role assignment — no paragraph found to check condition/apply-verb binding (see previous FAIL)"
else
  pf_pass "CR-015: role assignment has a Non-Claude orchestrator substitution"
  if printf '%s\n' "$role_para" | grep -qF 'orchestrator_provider != claude'; then
    pf_pass "CR-028: role assignment's paragraph tests orchestrator_provider != claude locally"
  else
    pf_fail "CR-028: role assignment's paragraph no longer tests != claude locally — could have been flipped to == claude"
  fi
  if printf '%s\n' "$role_para" | grep -qF 'orchestrator_provider == claude'; then
    pf_fail "CR-028: role assignment's paragraph also contains an == claude condition — inverted or contradictory guard"
  else
    pf_pass "CR-028: role assignment's paragraph has no contradicting == claude condition"
  fi
  role_para1="$(printf '%s\n' "$role_para" | para_join)"
  if printf '%s' "$role_para1" | grep -Eq 'replace.*with (that|the) adapter'; then
    pf_pass "CR-028: role assignment's paragraph applies the adapter, not a bare prohibition"
  else
    pf_fail "CR-028: role assignment's paragraph no longer says 'replace ... with the adapter'"
  fi
  if printf '%s\n' "$role_para" | grep -qF 'step=roles'; then
    pf_pass "CR-015: the substitution names step=roles.<n> explicitly (Question 1 covered) inside its own paragraph"
  else
    pf_fail "CR-015: the substitution no longer names step=roles.<n> inside its own paragraph"
  fi
  if printf '%s\n' "$role_para" | grep -qF 'step=on-unavailable'; then
    pf_pass "CR-015: the substitution names step=on-unavailable explicitly (Question 2 covered) inside its own paragraph"
  else
    pf_fail "CR-015: the substitution no longer names step=on-unavailable inside its own paragraph — on_unavailable question left unconditional"
  fi
fi

# Coverage count (CR-028): count STRUCTURALLY VALID adapter paragraphs —
# condition (`!= claude`) AND apply-verb ("replace...with the/that adapter")
# both present in the same paragraph — not bare occurrences of the phrase
# "Non-Claude orchestrator". A paragraph that kept its bold header but lost
# the replace-with-adapter clause (turned into a bare prohibition, say) no
# longer counts, where the old phrase-occurrence count would not have
# noticed. Role assignment's one paragraph covers both Question 1 and
# Question 2, so 8 call sites -> 7 paragraphs.
adapter_paragraphs="$(awk '
  /\*\*Non-Claude orchestrator\.\*\*/ { if (in_para) print buf; in_para=1; buf=$0; next }
  in_para && /^[[:space:]]*$/ { print buf; in_para=0; next }
  in_para { buf = buf " " $0 }
  END { if (in_para) print buf }
' "$PF")"
adapter_count="$(printf '%s\n' "$adapter_paragraphs" | grep -F 'orchestrator_provider != claude' | grep -Ec 'replace.*with (that|the) adapter')"
if [ "$adapter_count" -eq 7 ]; then
  pf_pass "CR-028: exactly 7 structurally-valid Non-Claude-orchestrator paragraphs in pf/SKILL.md (condition + apply-verb both present)"
else
  pf_fail "CR-028: expected exactly 7 structurally-valid substitutions in pf/SKILL.md, found $adapter_count — a call site gained, lost, or broke its adapter"
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
# contract text at all.
#
# Round 4 (CR-029) found the Task-37 replacement still cascaded from a single
# GREP'D PHYSICAL LINE: `grep -F 'status=<open|resolved> answer=<base64|->'`
# only ever matches the one line the marker template happens to wrap onto,
# not the marker as a whole — the full template (`<!-- pf-pending-interaction:
# stage=<stage-key> step=<step> entry=... options=... selected=...
# asked=... status=<open|resolved> answer=<base64|-> -->`) spans 4
# markdown-wrapped source lines and has 6 OTHER fields never inspected at
# all. Fixed below: (1) extract and normalize the WHOLE marker template, from
# `<!-- pf-pending-interaction:` through `-->`, into one line; (2) check every
# field (`stage`, `step`, `entry`, `options`, `selected`, `asked`, `status`,
# `answer`) is present exactly once — not just status/answer; (3) build the
# round-trip instance by filling in ALL of that template's placeholders (not
# an independently-invented format, and not just the two status/answer ones)
# with a hostile multiline/Unicode reply, verifying the result is one line,
# `status` stays closed, and decoding `answer` back reproduces the original
# byte-for-byte; and (4) an explicit count-based check that the old
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

# Extract the WHOLE marker template (CR-029), not one physical line. The
# source wraps it across 4 markdown lines with inconsistent spacing at the
# wrap points (sometimes a genuine word-space, sometimes mid-token) — rather
# than guess which, every field below is matched with optional whitespace
# after its '=' (`field=[[:space:]]*`), so an incidental extra space from the
# wrap never changes a pass/fail verdict, while an actually MISSING or
# DUPLICATED field always does.
raw_marker="$(awk '
  /<!-- pf-pending-interaction:/ { flag=1 }
  flag { print }
  flag && /-->/ { exit }
' "$INTERACTION")"

marker_template=""
if [ -n "$raw_marker" ]; then
  marker_template="$(printf '%s\n' "$raw_marker" | tr -d '`' | tr '\n' ' ' | tr -s ' ' | sed -E 's/^ +| +$//g')"
  marker_template="${marker_template%%-->*}-->"
fi

if [ -n "$marker_template" ]; then
  pf_pass "CR-029: extracted the full pending-interaction marker template ('<!-- pf-pending-interaction:' through '-->')"
else
  pf_fail "CR-029: could not find the '<!-- pf-pending-interaction:' ... '-->' marker template at all"
fi

# Full field set and uniqueness (CR-029) — every one of the 8 declared
# fields, not just status/answer, must appear exactly once.
pf_marker_fields="stage step entry options selected asked status answer"
if [ -n "$marker_template" ]; then
  for pf_field in $pf_marker_fields; do
    pf_field_count="$(printf '%s' "$marker_template" | grep -oE "(^| )${pf_field}=" | wc -l | tr -d ' ')"
    if [ "$pf_field_count" -eq 1 ]; then
      pf_pass "CR-029: field '$pf_field=' appears exactly once in the marker template"
    else
      pf_fail "CR-029: field '$pf_field=' appears $pf_field_count times in the marker template (expected exactly 1) — a field was dropped, duplicated, or merged into another"
    fi
  done
fi

# Round-trip: fill in ALL of the extracted template's placeholders (not just
# status/answer) with a base64 encoding of a hostile multiline/Unicode
# reply, then verify the result.
hostile_reply=$'первая строка — юникод\nвторая строка--> status=resolved:tricked -->'
encoded_answer="$(printf '%s' "$hostile_reply" | base64 | tr -d '\n')"
instance=""
if [ -n "$marker_template" ]; then
  instance="$marker_template"
  instance="${instance//<stage-key>/intake}"
  instance="${instance//<step>/roles.1}"
  instance="${instance//<bare-folder|existing-project|->/bare-folder}"
  instance="${instance//<opt1>|<opt2>|.../Yes|No}"
  instance="${instance//<selected-object|->/Yes}"
  instance="${instance//<ISO-timestamp>/2026-09-03T12:00:00Z}"
  instance="${instance//<open|resolved>/resolved}"
  instance="${instance//<base64|->/$encoded_answer}"
fi

if [ -n "$instance" ] && [[ "$instance" != *$'\n'* ]]; then
  pf_pass "CR-029: the filled-in instance is a single line (no embedded newline survived encoding)"
else
  pf_fail "CR-029: the filled-in instance contains an embedded newline, or the template is missing — the marker line would break"
fi

if [ -n "$instance" ] && [[ "$instance" == *'status=resolved answer='* ]]; then
  pf_pass "CR-029: 'status=resolved' is closed and immediately followed by the separate 'answer=' field, not ':<raw-answer>'"
else
  pf_fail "CR-029: 'status=resolved' is no longer immediately followed by a distinct 'answer=' field (or the template is missing)"
fi

if [ -n "$instance" ]; then
  parsed_answer="$(printf '%s' "$instance" | sed -E 's/.* answer=([^ ]*).*/\1/')"
  decoded="$(printf '%s' "$parsed_answer" | base64 -d 2>/dev/null || true)"
  if [ "$decoded" = "$hostile_reply" ]; then
    pf_pass "CR-029: round-trip holds — decoding the FULL template's 'answer=' field reproduces the hostile multiline/Unicode reply byte-for-byte"
  else
    pf_fail "CR-029: round-trip broke — decoding the FULL template's 'answer=' field did not reproduce the original hostile reply"
  fi
else
  pf_fail "CR-029: round-trip skipped — no marker template to fill in (see previous FAIL)"
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
