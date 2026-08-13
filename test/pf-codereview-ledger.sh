#!/usr/bin/env bash
# test/pf-codereview-ledger.sh — TC-005..TC-008 (20260806-improve-codereview-convergence).
#
# Task 3 of that issue's implementation_plan.md: infrastructure for the
# findings-ledger user story (US-2). Task 4 (a separate, later task) redesigns
# skills/pf-codereview/SKILL.md's Phase 3 as an append-only `CR-NNN` ledger
# with a closed six-value State dictionary; this suite transcribes the three
# helpers that behavior implies (`pf_cr_append_finding`, `pf_cr_valid_state`,
# `pf_cr_validate_pass_ledger`) plus the drift-guards that compare each
# helper's assumptions against the REAL text of SKILL.md — per test_plan.md's
# Overview (point 1), a helper that only agrees with itself proves nothing.
#
# Expected RED today, honestly, by design (test-first — test_plan.md point 3):
#   TC-005 steps 1-3 GREEN (pure bash on the fixture); step 4 (drift-guard) RED.
#   TC-006 steps 1-2 GREEN (pure bash); steps 3-4 (drift-guards) RED.
#   TC-007 wholly RED — no fixtures, pure static audit of SKILL.md.
#   TC-008 steps 1-3 GREEN (pure bash on fixtures); step 4 (drift-guard) RED.
# Every RED drift-guard message below says "rule not documented in SKILL.md"
# to stay distinguishable from an infra failure (missing fixture, missing
# SKILL.md, a broken anchor) — test_plan.md's own requirement (Overview,
# point 3).
#
# Six-value dictionary (closed, per implementation_plan.md Task 3 — decided in
# brd.md/test_plan.md, not revisited here): `open` (initial) plus five
# terminal resolutions — `fixed`, `accepted-risk`, `deferred`, `wont-fix`,
# `duplicate-of CR-NNN`. pf_cr_valid_state hardcodes exactly these six.
#
# Read-only against the real repo: this suite never writes into $REPO_ROOT.
# The only mutation (TC-005's append) happens on a copy under a fresh
# pf_mktemp_d temp dir — the fixture file itself is never touched (S-3).

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

SKILL="$REPO_ROOT/skills/pf-codereview/SKILL.md"
FIXTURES_DIR="$REPO_ROOT/test/fixtures/pf-codereview-convergence"

# line_of <file> <ERE pattern> — first matching line number (grep -n -E), or
# empty if not found. Same helper shape as
# test/pf-test-tc-mapping-static.sh / test/skills-role-matrix-static.sh.
line_of() {
  grep -n -E "$2" "$1" 2>/dev/null | head -1 | cut -d: -f1
}

# section <file> <start line> <end line, exclusive> — prints that range.
section() {
  local file="$1" start="$2" end="$3"
  sed -n "${start},$((end - 1))p" "$file"
}

# trim <string> — strips leading/trailing whitespace.
trim() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# ─── Transcribed helpers (kept in sync with SKILL.md by the drift-guards below) ─

# pf_cr_append_finding <ledger-file> <round> <priority> <description> [state]
#
# Appends one row to a `CR-NNN` findings ledger (an append-only markdown
# table: `| ID | Round | Priority | Description | State |`). Never rewrites
# or removes any existing row (BR-8) — it only ever opens the file for
# appending. Prints the new row's ID on stdout. `state` defaults to `open`,
# the dictionary's initial value (TC-006).
pf_cr_append_finding() {
  local ledger="${1:?pf_cr_append_finding: ledger file required}"
  local round="${2:?pf_cr_append_finding: round required}"
  local priority="${3:?pf_cr_append_finding: priority required}"
  local description="${4:?pf_cr_append_finding: description required}"
  local state="${5:-open}"
  local last_num next_num next_id
  last_num="$(grep -oE 'CR-[0-9]+' "$ledger" | sed 's/CR-//' | sort -n | tail -1)"
  next_num=$((${last_num:-0} + 1))
  next_id="$(printf 'CR-%03d' "$next_num")"
  printf '| %s | %s | %s | %s | %s |\n' "$next_id" "$round" "$priority" "$description" "$state" >>"$ledger"
  printf '%s' "$next_id"
}

# pf_cr_valid_state <value>
#
# Accepts exactly the six-value dictionary this issue closes on: `open`
# (initial) plus five terminal resolutions (`fixed`, `accepted-risk`,
# `deferred`, `wont-fix`, `duplicate-of CR-NNN`). Anything else — including a
# plausible-sounding invented value — is rejected. Do not add a seventh value
# or rename a terminal one; that decision is closed
# (implementation_plan.md, Task 3's "Решение, которое не пересматривается").
pf_cr_valid_state() {
  local v="$1"
  case "$v" in
    open | fixed | accepted-risk | deferred | wont-fix) return 0 ;;
  esac
  [[ "$v" =~ ^duplicate-of\ CR-[0-9]{3,}$ ]] && return 0
  return 1
}

# pf_cr_validate_pass_ledger <ledger-file>
#
# Prints one `MISSING_STATE:<CR-NNN>` line per data row whose State cell is
# genuinely empty. An explicit `open` value is NOT a violation here — it is a
# real word from the six-value dictionary (TC-006), not a missing record;
# TC-011 (a different task, Task 5) is the separate rule that blocks `PASS`
# on an *open* P0 — this helper only ever checks for presence of a value.
# Exit status: 0 with no output if every row has a non-empty State, 1 if at
# least one row is missing one.
pf_cr_validate_pass_ledger() {
  local ledger="${1:?pf_cr_validate_pass_ledger: ledger file required}"
  local line f_id f_state id state found=0
  while IFS= read -r line; do
    case "$line" in
      '|'*) ;;
      *) continue ;;
    esac
    case "$line" in
      *'---'*) continue ;;
    esac
    IFS='|' read -r _ f_id _ _ _ f_state _ <<<"$line"
    id="$(trim "$f_id")"
    case "$id" in
      "" | ID) continue ;;
    esac
    state="$(trim "$f_state")"
    if [ -z "$state" ]; then
      printf 'MISSING_STATE:%s\n' "$id"
      found=1
    fi
  done <"$ledger"
  return "$found"
}

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-005: ledger append-only, stable CR-NNN, round number, state\n'
# ══════════════════════════════════════════════════════════════════════════════

LEDGER_ROUND1_FIXTURE="$FIXTURES_DIR/ledger-round1-3-entries.md"

if [ ! -f "$LEDGER_ROUND1_FIXTURE" ]; then
  pf_fail "TC-005: fixture missing: $LEDGER_ROUND1_FIXTURE"
else
  work_dir="$(pf_mktemp_d)"
  work_ledger="$work_dir/ledger.md"
  cp "$LEDGER_ROUND1_FIXTURE" "$work_ledger"
  before_content="$(cat "$work_ledger")"

  new_id="$(pf_cr_append_finding "$work_ledger" 2 P1 "Round 2 fix diff introduces an unchecked array index" open)"
  after_content="$(cat "$work_ledger")"

  # Step 1: append adds CR-004 at round 2.
  if [ "$new_id" = "CR-004" ] && grep -qE '^\| CR-004 \| 2 \|' "$work_ledger"; then
    pf_pass "TC-005 step 1: pf_cr_append_finding adds a new row CR-004 at round 2"
  else
    pf_fail "TC-005 step 1: expected new row CR-004/round 2, got id='$new_id'"
  fi

  # Step 2: CR-001..CR-003 rows byte-identical before/after the append.
  prior_before="$(printf '%s\n' "$before_content" | grep -E '^\| CR-00[1-3] ')"
  prior_after="$(printf '%s\n' "$after_content" | grep -E '^\| CR-00[1-3] ')"
  if [ -n "$prior_before" ] && [ "$prior_before" = "$prior_after" ]; then
    pf_pass "TC-005 step 2: CR-001..CR-003 rows are byte-identical before and after the append (append-only)"
  else
    pf_fail "TC-005 step 2: prior rows changed by the append — append-only violated"
  fi

  # Step 3: the new row carries all three fields, all non-empty.
  new_row="$(grep -E '^\| CR-004 ' "$work_ledger")"
  IFS='|' read -r _ f_id f_round _ _ f_state _ <<<"$new_row"
  id_val="$(trim "$f_id")"
  round_val="$(trim "$f_round")"
  state_val="$(trim "$f_state")"
  if [ -n "$id_val" ] && [ -n "$round_val" ] && [ -n "$state_val" ]; then
    pf_pass "TC-005 step 3: new row carries non-empty ID ('$id_val'), round ('$round_val') and state ('$state_val')"
  else
    pf_fail "TC-005 step 3: new row is missing a required field (id='$id_val' round='$round_val' state='$state_val')"
  fi
fi

# Step 4: drift-guard — CR-NNN format and the append-only rule documented
# NEAR the code_review.md findings description (test_plan.md: "рядом с
# описанием code_review.md"). Anchor-narrowed to Phase 3 ("Write
# code_review.md") — an unscoped whole-file grep would be equally happy if
# `CR-NNN` appeared in one unrelated place and "append-only" in another, which
# is exactly the "one grep, two unrelated matches" failure mode test_plan.md's
# Overview warns about.
if [ ! -f "$SKILL" ]; then
  pf_fail "TC-005 step 4: skills/pf-codereview/SKILL.md does not exist"
else
  p3_start="$(line_of "$SKILL" '^## Phase 3')"
  p4_start="$(line_of "$SKILL" '^## Phase 4')"
  if [ -z "$p3_start" ] || [ -z "$p4_start" ]; then
    pf_fail "TC-005 step 4: could not locate ## Phase 3 / ## Phase 4 anchors — infra issue, not a missing-rule finding"
  else
    p3_block="$(section "$SKILL" "$p3_start" "$p4_start")"
    if printf '%s' "$p3_block" | grep -qE 'CR-[0-9]{3}' &&
      printf '%s' "$p3_block" | grep -qiE 'append-only|only ever append|only appends|never rewrites? or deletes?'; then
      pf_pass "TC-005 step 4: CR-NNN format and the append-only rule are documented together in Phase 3"
    else
      pf_fail "TC-005 step 4: CR-NNN format / append-only rule not documented together in Phase 3 — rule not documented (Task 4 pending)"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-006: closed six-value finding-state dictionary\n'
# ══════════════════════════════════════════════════════════════════════════════

# Step 1: all six legal values accepted.
all_six_ok=1
for v in "open" "fixed" "accepted-risk" "deferred" "wont-fix" "duplicate-of CR-002"; do
  if ! pf_cr_valid_state "$v"; then
    all_six_ok=0
    pf_note "TC-006 step 1: '$v' was rejected but is one of the six legal dictionary values"
  fi
done
if [ "$all_six_ok" -eq 1 ]; then
  pf_pass "TC-006 step 1: all six legal states (open + five terminal) are accepted"
else
  pf_fail "TC-006 step 1: at least one of the six legal dictionary values was rejected"
fi

# Step 2: an invented value is rejected.
if pf_cr_valid_state "wontfix-later"; then
  pf_fail "TC-006 step 2: invented value 'wontfix-later' was wrongly accepted"
else
  pf_pass "TC-006 step 2: invented value 'wontfix-later' is rejected"
fi

# Step 3: drift-guard — the five terminal literals documented TOGETHER.
#
# Collects EVERY occurrence of each literal (not just the first) and finds
# the smallest line-range that contains at least one occurrence of all five
# (a standard sliding-window-over-groups scan). Anchoring on only the FIRST
# occurrence of a common word like "fixed" would false-RED once Task 2/Task 6
# add unrelated prose to this same file that happens to use "fixed" or
# "deferred" earlier in the document than the real dictionary block — the
# dictionary could then be correctly documented elsewhere and this guard
# would still fail, misreporting a real rule as undocumented.
if [ ! -f "$SKILL" ]; then
  pf_fail "TC-006 step 3: skills/pf-codereview/SKILL.md does not exist"
else
  terminal_words=(fixed accepted-risk deferred wont-fix duplicate-of)
  pairs=()
  missing_word=""
  for idx in "${!terminal_words[@]}"; do
    w="${terminal_words[$idx]}"
    # -w (word boundary) matters here: a bare -F substring match on "fixed"
    # would false-positive on "prefixed" elsewhere in SKILL.md's `both`-mode
    # aggregation prose — -w's boundary check applies only at the two ends of
    # the whole (possibly hyphenated) literal, so "wont-fix"/"accepted-risk"/
    # "duplicate-of" still match correctly as single tokens.
    mapfile -t occurrences < <(grep -n -w -F -- "$w" "$SKILL" | cut -d: -f1)
    if [ "${#occurrences[@]}" -eq 0 ]; then
      missing_word="$w"
      break
    fi
    for ln in "${occurrences[@]}"; do
      pairs+=("$ln:$idx")
    done
  done

  if [ -n "$missing_word" ]; then
    pf_fail "TC-006 step 3: terminal state literal '$missing_word' not found in SKILL.md — rule not documented (Task 4 pending)"
  else
    mapfile -t sorted_pairs < <(printf '%s\n' "${pairs[@]}" | sort -t: -k1,1n)
    declare -A window_count=()
    distinct=0
    left=0
    best_span=""
    n="${#sorted_pairs[@]}"
    for ((right = 0; right < n; right++)); do
      line_r="${sorted_pairs[$right]%%:*}"
      idx_r="${sorted_pairs[$right]#*:}"
      window_count[$idx_r]=$((${window_count[$idx_r]:-0} + 1))
      [ "${window_count[$idx_r]}" -eq 1 ] && distinct=$((distinct + 1))
      while [ "$distinct" -eq 5 ]; do
        line_l="${sorted_pairs[$left]%%:*}"
        idx_l="${sorted_pairs[$left]#*:}"
        span=$((line_r - line_l))
        if [ -z "$best_span" ] || [ "$span" -lt "$best_span" ]; then
          best_span=$span
        fi
        window_count[$idx_l]=$((window_count[$idx_l] - 1))
        [ "${window_count[$idx_l]}" -eq 0 ] && distinct=$((distinct - 1))
        left=$((left + 1))
      done
    done
    unset window_count

    if [ -n "$best_span" ] && [ "$best_span" -le 40 ]; then
      pf_pass "TC-006 step 3: all five terminal literals documented together (smallest window: $best_span lines)"
    else
      pf_fail "TC-006 step 3: five terminal literals found but no shared ~40-line window contains all five (smallest window: ${best_span:-none}) — not documented together (Task 4 pending)"
    fi
  fi
fi

# Step 4: drift-guard — 'open' documented SEPARATELY as the initial state
# (a distinct grep from step 3's, per test_plan.md — not collapsed into one).
if [ ! -f "$SKILL" ]; then
  pf_fail "TC-006 step 4: skills/pf-codereview/SKILL.md does not exist"
else
  initial_hits="$(grep -n -iE 'initial state|начальное состояние' "$SKILL")"
  if [ -z "$initial_hits" ]; then
    pf_fail "TC-006 step 4: 'open' as the initial state is not documented in SKILL.md — rule not documented (Task 4 pending)"
  else
    found_open_near=0
    while IFS=: read -r ln _rest; do
      [ -z "$ln" ] && continue
      lo=$((ln > 5 ? ln - 5 : 1))
      hi=$((ln + 5))
      if sed -n "${lo},${hi}p" "$SKILL" | grep -qw "open"; then
        found_open_near=1
        break
      fi
    done <<<"$initial_hits"
    if [ "$found_open_near" -eq 1 ]; then
      pf_pass "TC-006 step 4: 'open' is documented as the initial state, separately from the five terminal literals"
    else
      pf_fail "TC-006 step 4: 'initial state' phrase found but not paired with 'open' nearby — rule not documented (Task 4 pending)"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-007: round 2+ reviewer dispatch carries the prior-findings ledger and two independent "don'"'"'t repeat / look for new" signals\n'
# ══════════════════════════════════════════════════════════════════════════════

if [ ! -f "$SKILL" ]; then
  pf_fail "TC-007: skills/pf-codereview/SKILL.md does not exist"
else
  # Anchor-narrowed to Phase 2's own "### Claude review path" and
  # "### Codex path" sections — NOT Phase 4's generic "re-run Phase 2" loop
  # text. implementation_plan.md's Task 4 entry says explicitly that the
  # round 2+ reviewer-prompt addition lands INSIDE these two sections' own
  # briefs (Phase 2, Reviewer Selection), not as a rewrite of Phase 4's loop
  # paragraph — so that is where the round-2+-specific content must be
  # searched for, in each path independently, per test_plan.md's "both...and"
  # phrasing (not one shared, unscoped grep over the whole file).
  claude_start="$(line_of "$SKILL" '^### Claude review path')"
  codex_start="$(line_of "$SKILL" '^### Codex path')"
  codex_end="$(line_of "$SKILL" '^### Severity')"

  if [ -z "$claude_start" ] || [ -z "$codex_start" ] || [ -z "$codex_end" ]; then
    pf_fail "TC-007: could not locate ### Claude review path / ### Codex path / ### Severity anchors — infra issue, not a missing-rule finding"
  else
    claude_section="$(section "$SKILL" "$claude_start" "$codex_start")"
    codex_section="$(section "$SKILL" "$codex_start" "$codex_end")"

    # Step 1: EACH path's own brief has a round-2+-specific block (not just a
    # single generic, round-agnostic dispatch instruction that never mentions
    # round number at all — which is exactly what both sections say today).
    claude_has_round=0
    codex_has_round=0
    printf '%s' "$claude_section" | grep -qiE "round (2|two|N)|N *> *1|subsequent round|second (and later )?round|later round" && claude_has_round=1
    printf '%s' "$codex_section" | grep -qiE "round (2|two|N)|N *> *1|subsequent round|second (and later )?round|later round" && codex_has_round=1
    if [ "$claude_has_round" -eq 1 ] && [ "$codex_has_round" -eq 1 ]; then
      pf_pass "TC-007 step 1: both the Claude review path and the Codex path sections have a round 2+-specific block"
    else
      pf_fail "TC-007 step 1: no round 2+-specific block in one or both dispatch sections (Claude: $claude_has_round, Codex: $codex_has_round) — rule not documented in SKILL.md (Task 4 pending)"
    fi

    # Step 2: within those same two sections combined, the ledger of prior
    # findings is actually passed to the reviewer.
    combined="$claude_section
$codex_section"
    if printf '%s' "$combined" | grep -qiE "ledger|prior round.?s findings|previous round.?s findings"; then
      pf_pass "TC-007 step 2: the Claude/Codex dispatch briefs pass the prior-findings ledger to the reviewer"
    else
      pf_fail "TC-007 step 2: neither dispatch brief mentions passing the ledger/prior findings to the reviewer — rule not documented in SKILL.md (Task 4 pending)"
    fi

    # Step 3: "don't repeat" and "look for new" as two INDEPENDENT signals —
    # not one phrase happening to contain both words (test_plan.md TC-007
    # step 3).
    has_dont_repeat=0
    has_look_new=0
    printf '%s' "$combined" | grep -qiE "don.?t repeat|do not repeat|not repeat" && has_dont_repeat=1
    printf '%s' "$combined" | grep -qiE "look for new|find new|new (problems|issues) introduced" && has_look_new=1
    if [ "$has_dont_repeat" -eq 1 ] && [ "$has_look_new" -eq 1 ]; then
      pf_pass "TC-007 step 3: 'don't repeat' and 'look for new' are both present as two independent signals"
    else
      pf_fail "TC-007 step 3: not both independent signals present (don't-repeat: $has_dont_repeat, look-for-new: $has_look_new) — rule not documented in SKILL.md (Task 4 pending)"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-008: on PASS, every unresolved finding has an explicit state (empty cell only)\n'
# ══════════════════════════════════════════════════════════════════════════════

ALL_SET_FIXTURE="$FIXTURES_DIR/ledger-all-states-set.md"
MISSING_FIXTURE="$FIXTURES_DIR/ledger-missing-state.md"
OPEN_FIXTURE="$FIXTURES_DIR/ledger-state-open.md"

if [ ! -f "$ALL_SET_FIXTURE" ]; then
  pf_fail "TC-008 step 1: fixture missing: $ALL_SET_FIXTURE"
else
  out_all_set="$(pf_cr_validate_pass_ledger "$ALL_SET_FIXTURE")"
  rc_all_set=$?
  if [ "$rc_all_set" -eq 0 ] && [ -z "$out_all_set" ]; then
    pf_pass "TC-008 step 1: a fully-set ledger returns 0 violations"
  else
    pf_fail "TC-008 step 1: expected 0 violations on a fully-set ledger, got rc=$rc_all_set out='$out_all_set'"
  fi
fi

if [ ! -f "$MISSING_FIXTURE" ]; then
  pf_fail "TC-008 step 2: fixture missing: $MISSING_FIXTURE"
else
  out_missing="$(pf_cr_validate_pass_ledger "$MISSING_FIXTURE")"
  rc_missing=$?
  if [ "$rc_missing" -ne 0 ] && printf '%s' "$out_missing" | grep -q '^MISSING_STATE:CR-'; then
    pf_pass "TC-008 step 2: a ledger with one empty State cell is flagged, naming the specific CR-NNN ($out_missing)"
  else
    pf_fail "TC-008 step 2: expected >=1 violation naming a CR-NNN, got rc=$rc_missing out='$out_missing'"
  fi
fi

if [ ! -f "$OPEN_FIXTURE" ]; then
  pf_fail "TC-008 step 3: fixture missing: $OPEN_FIXTURE"
else
  out_open="$(pf_cr_validate_pass_ledger "$OPEN_FIXTURE")"
  rc_open=$?
  if [ "$rc_open" -eq 0 ] && [ -z "$out_open" ]; then
    pf_pass "TC-008 step 3: an explicit state 'open' is NOT flagged (negative control — empty cell != 'open')"
  else
    pf_fail "TC-008 step 3: explicit 'open' state was wrongly flagged, got rc=$rc_open out='$out_open'"
  fi
fi

# Step 4: drift-guard — the "no finding without an explicit state" rule,
# documented NEAR the PASS verdict condition (test_plan.md: "рядом с условием
# выдачи PASS"). Anchor-narrowed to Phase 3 ("Write code_review.md", which
# also holds the Verdict-section rules) rather than an unscoped whole-file
# grep — the same "рядом с" requirement TC-005 step 4 above enforces.
if [ ! -f "$SKILL" ]; then
  pf_fail "TC-008 step 4: skills/pf-codereview/SKILL.md does not exist"
else
  p3v_start="$(line_of "$SKILL" '^## Phase 3')"
  p3v_end="$(line_of "$SKILL" '^## Phase 4')"
  if [ -z "$p3v_start" ] || [ -z "$p3v_end" ]; then
    pf_fail "TC-008 step 4: could not locate ## Phase 3 / ## Phase 4 anchors — infra issue, not a missing-rule finding"
  else
    p3v_block="$(section "$SKILL" "$p3v_start" "$p3v_end")"
    if printf '%s' "$p3v_block" | grep -qiE "no (finding|record) without (an )?(explicit )?state|every (unresolved |open |unclosed )?finding (has|carries|must have) (an )?(explicit )?state"; then
      pf_pass "TC-008 step 4: 'no finding without an explicit state' rule is documented in Phase 3, near the PASS verdict condition"
    else
      pf_fail "TC-008 step 4: 'no finding without an explicit state' rule not documented near the PASS verdict in Phase 3 — rule not documented (Task 4 pending)"
    fi
  fi
fi

assert_repo_untouched
pf_summary
