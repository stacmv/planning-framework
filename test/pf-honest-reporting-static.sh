#!/usr/bin/env bash
# test/pf-honest-reporting-static.sh — TC-018, TC-021, TC-022, TC-023
# (20260806-improve-codereview-convergence, US-5 "Honest stage reporting").
#
# Pure static text audits of skills/pf-codereview/SKILL.md,
# skills/pf-check/SKILL.md, skills/pf/SKILL.md, skills/pf-close/SKILL.md.
# Read-only: no fixtures, no git, no ~/.claude/skills involved — the same
# spirit as test/skills-role-matrix-static.sh, whose check_order technique
# (extract "## Phase N" line numbers, walk the ordered gaps between them) is
# reused directly for TC-022/TC-023 below.
#
# Expected status when this suite was written (implementation_plan.md Task 9,
# test-first — see that task's Implementation Notes for the full rationale):
#   TC-018 — RED, except the pf-codereview branch-guard baseline (step 1a)
#   TC-021 — RED (both reader and writer ends are undocumented today)
#   TC-022 — Phase 4.5 sub-check GREEN today (baseline); full coverage RED
#   TC-023 — Phase 4.5 sub-check GREEN today (baseline); full coverage RED
#
# A FAIL below means "the rule is not documented in SKILL.md yet" — that is
# the expected, intended shape of most of this run until Tasks 10/11/12 land.
# It is distinguishable from an infra defect (a SKILL.md file missing, or a
# malformed heading set) by message text: infra failures are always tagged
# "INFRA" so a red run here is never mistaken for a broken harness.
#
# TC-021 steps 10-11 added in code review round 2 (CR: the round-1 fix for
# CR-002 made "check passed" bimodal — PASSED/OPEN — but the reader still
# matched on "is a PASSED line present for TARGET anywhere", not on which
# marker for TARGET is last in the append-only session-log.md. A
# check-then-revise-then-recheck-and-skip cycle leaves an earlier PASSED line
# sitting above a later OPEN one, and the old reader wording counted the
# earlier PASSED — reproducing the exact defect the round-1 fix was meant to
# close. Steps 10-11 pin the last-marker-wins rule and its concrete
# PASSED-then-OPEN scenario so this cannot regress silently again.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

CODEREVIEW="$REPO_ROOT/skills/pf-codereview/SKILL.md"
CHECK="$REPO_ROOT/skills/pf-check/SKILL.md"
PF="$REPO_ROOT/skills/pf/SKILL.md"
CLOSE="$REPO_ROOT/skills/pf-close/SKILL.md"

# block_text <file> <start_line> <end_line> — inclusive line range, verbatim.
block_text() {
  sed -n "${2},${3}p" "$1"
}

# count_anchors <text> <pattern>... — prints how many of the given
# case-insensitive extended-regex patterns match somewhere in <text>. Each
# pattern is its own independent signal (test_plan.md's "2-3 independent
# anchors") — deliberately not one shared pattern (see TC-018 note below).
count_anchors() {
  local text="$1" n=0 pat
  shift
  for pat in "$@"; do
    if printf '%s' "$text" | grep -qiE "$pat"; then
      n=$((n + 1))
    fi
  done
  printf '%s' "$n"
}

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-018: Empty review target / off-branch target documented as exceptions, per-file (AC-5.1/AC-5.2)\n'
# ══════════════════════════════════════════════════════════════════════════════
# pf-codereview and pf-check have genuinely different diff-computation shapes
# (implementation_plan.md Task 9 note) — checked as two file-specific probes
# below, never one grep pattern reused verbatim across both files.

if [ ! -f "$CODEREVIEW" ]; then
  pf_fail "TC-018 INFRA: skills/pf-codereview/SKILL.md not found"
else
  p1_start="$(grep -n '^## Phase 1:' "$CODEREVIEW" | head -1 | cut -d: -f1)"
  p1_end_heading="$(grep -n '^## Phase 1\.5:' "$CODEREVIEW" | head -1 | cut -d: -f1)"

  if [ -z "$p1_start" ] || [ -z "$p1_end_heading" ]; then
    pf_fail "TC-018 INFRA: could not locate Phase 1 / Phase 1.5 headings in pf-codereview/SKILL.md"
  else
    phase1_text="$(block_text "$CODEREVIEW" "$p1_start" "$((p1_end_heading - 1))")"

    # ─── Step 1a: pre-existing hard branch guard (baseline — must pass today) ──
    if printf '%s' "$phase1_text" | grep -qF 'stop: "Switch to the issue branch first'; then
      pf_pass "TC-018 step 1a: pf-codereview Phase 1 branch guard present (baseline)"
    else
      pf_fail "TC-018 step 1a: pf-codereview Phase 1 branch guard not found — rule not documented in SKILL.md"
    fi

    # ─── Step 1b: NEW — empty-diff-is-an-error anchors (2-3 independent) ───────
    a1='(empty|nothing to (review|diff)|no changes)[^.]{0,120}\berror\b'
    a2='(do not|never|must not|refuse)[^.]{0,120}(verdict:? *\*{0,2}PASS)'
    a3='(nothing to review)[^.]{0,150}(clean|reviewed)'
    found="$(count_anchors "$phase1_text" "$a1" "$a2" "$a3")"
    if [ "$found" -ge 2 ]; then
      pf_pass "TC-018 step 1b: pf-codereview Phase 1 empty-diff-is-an-error anchors found ($found/3)"
    else
      pf_fail "TC-018 step 1b: pf-codereview Phase 1 empty-diff-is-an-error anchors found only $found/3 (need >=2) — rule not documented in SKILL.md"
    fi
  fi
fi

if [ ! -f "$CHECK" ]; then
  pf_fail "TC-018 INFRA: skills/pf-check/SKILL.md not found"
else
  cc_start="$(grep -n '^### Codex invocation chain' "$CHECK" | head -1 | cut -d: -f1)"
  cc_end_heading="$(grep -n '^### Severity' "$CHECK" | head -1 | cut -d: -f1)"

  if [ -z "$cc_start" ] || [ -z "$cc_end_heading" ]; then
    pf_fail "TC-018 INFRA: could not locate 'Codex invocation chain' / 'Severity' headings in pf-check/SKILL.md"
  else
    chain_text="$(block_text "$CHECK" "$cc_start" "$((cc_end_heading - 1))")"

    # ─── Step 2: NEW — empty-diff-is-an-error anchors, scoped to the Codex
    # invocation chain specifically (the only place pf-check computes a diff
    # at all — its Claude review path never does, per implementation_plan.md
    # Task 9 note, and is correctly out of scope for this step). ────────────
    a1='(empty|nothing to (review|diff)|no changes)[^.]{0,120}\berror\b'
    a2='(do not|never|must not|refuse)[^.]{0,120}(verdict:? *\*{0,2}PASS)'
    a3='(nothing to review)[^.]{0,150}(clean|reviewed)'
    found="$(count_anchors "$chain_text" "$a1" "$a2" "$a3")"
    if [ "$found" -ge 2 ]; then
      pf_pass "TC-018 step 2: pf-check Codex-chain empty-diff-is-an-error anchors found ($found/3)"
    else
      pf_fail "TC-018 step 2: pf-check Codex-chain empty-diff-is-an-error anchors found only $found/3 (need >=2) — rule not documented in SKILL.md"
    fi
  fi

  # ─── Step 3: NEW — off-branch -> review-by-path anchors, anywhere in the
  # file (pf-check is the only one of the two stages with a legitimate "no
  # issue branch yet" case — pf-codereview hard-stops off-branch in Phase 1
  # before this scenario could ever arise, per implementation_plan.md Task 9
  # note, so pf-codereview is never checked for it). ─────────────────────────
  whole_text="$(cat "$CHECK")"
  b1='issue branch[^.]{0,80}(does not exist|not exist|missing|absent)'
  b2='(review|reviewing|switch(ing)? to)[^.]{0,40}\bby (its |the (document'"'"'s )?)?path\b'
  b3='(no|missing|absent)[^.]{0,40}issue branch[^.]{0,120}(report|state|note|reason)'
  found="$(count_anchors "$whole_text" "$b1" "$b2" "$b3")"
  if [ "$found" -ge 2 ]; then
    pf_pass "TC-018 step 3: pf-check off-branch -> review-by-path anchors found ($found/3)"
  else
    pf_fail "TC-018 step 3: pf-check off-branch -> review-by-path anchors found only $found/3 (need >=2) — rule not documented in SKILL.md"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf "=== TC-021: Explicit 'check passed' marker, not derived from next-document readiness (AC-5.3)\n"
# ══════════════════════════════════════════════════════════════════════════════
# Both ends of the same marker: the reader in pf/SKILL.md, the writer in
# pf-check/SKILL.md — and step 5 cross-checks the two literal formats agree.

if [ ! -f "$PF" ]; then
  pf_fail "TC-021 INFRA: skills/pf/SKILL.md not found"
else
  note_line="$(grep -n 'Note on .check passed.' "$PF" | head -1 | cut -d: -f1)"
  if [ -z "$note_line" ]; then
    pf_fail "TC-021 INFRA: 'Note on \"check passed\"' section not found in pf/SKILL.md"
  else
    pf_pass "TC-021 step 1: 'Note on \"check passed\"' section located in pf/SKILL.md"

    step7_line="$(grep -n '^## Step 7' "$PF" | head -1 | cut -d: -f1)"
    # Run to the line right before '## Step 7' — the section's real end, not a
    # fixed +N guess. A hardcoded offset window has zero margin against the
    # section growing (or shrinking) and can silently stop covering its own
    # content — the same "guard that can't go red" class of defect CR-004
    # named in round 1. Fall back to a small fixed window only in the
    # degenerate case the heading itself is missing.
    if [ -n "$step7_line" ]; then
      note_end=$((step7_line - 1))
    else
      note_end=$((note_line + 8))
    fi
    note_text="$(block_text "$PF" "$note_line" "$note_end")"

    # ─── Step 2: reader references an explicit written marker ─────────────
    reader_marker_re='(marker|explicit[^.]{0,40}(record|flag|line))[^.]{0,80}session-log\.md|session-log\.md[^.]{0,80}(marker|explicit[^.]{0,40}(record|flag|line))'
    if printf '%s' "$note_text" | grep -qiE "$reader_marker_re"; then
      pf_pass "TC-021 step 2: pf/SKILL.md 'check passed' reader references an explicit written marker"
      reader_has_marker=1
    else
      pf_fail "TC-021 step 2: pf/SKILL.md 'check passed' reader does not reference an explicit written marker — rule not documented in SKILL.md"
      reader_has_marker=0
    fi

    # ─── Step 3: circular "next document ready" definition is not the SOLE
    # criterion — satisfied exactly when step 2's independent marker exists
    # alongside it. ──────────────────────────────────────────────────────────
    if [ "$reader_has_marker" -eq 1 ]; then
      pf_pass "TC-021 step 3: circular 'next document complete' definition is not the sole criterion (an independent marker exists)"
    else
      pf_fail "TC-021 step 3: circular 'next document complete' definition remains the sole criterion — rule not documented in SKILL.md"
    fi
  fi
fi

if [ ! -f "$CHECK" ]; then
  pf_fail "TC-021 INFRA: skills/pf-check/SKILL.md not found"
else
  # ─── Step 4 (writer): an UNCONDITIONAL session-log.md write, distinct from
  # the existing autopilot-only "[autopilot default]" line. Isolate the
  # autopilot paragraph and require the write to exist OUTSIDE it. ──────────
  auto_start="$(grep -n 'Autopilot mode' "$CHECK" | head -1 | cut -d: -f1)"
  auto_end="$(grep -n 'Present the returned findings to the user as-is' "$CHECK" | head -1 | cut -d: -f1)"
  writer_line=""
  if [ -n "$auto_start" ] && [ -n "$auto_end" ]; then
    before_text="$(block_text "$CHECK" 1 "$((auto_start - 1))")"
    after_start=$((auto_end))
    total_lines="$(wc -l <"$CHECK")"
    after_text="$(block_text "$CHECK" "$after_start" "$total_lines")"
    writer_marker_re='session-log\.md[^.]{0,120}(check passed|passed the check|check.s outcome)|(check passed|passed the check)[^.]{0,120}session-log\.md'
    if printf '%s\n%s' "$before_text" "$after_text" | grep -qiE "$writer_marker_re"; then
      writer_line="$(printf '%s\n%s' "$before_text" "$after_text" | grep -iE "$writer_marker_re" | head -1)"
    fi
  fi
  if [ -n "$writer_line" ]; then
    pf_pass "TC-021 step 4: pf-check writes an unconditional 'check passed' session-log.md marker (outside the autopilot-only branch)"
    writer_has_marker=1
  else
    pf_fail "TC-021 step 4: pf-check only writes the autopilot-only '[autopilot default]' session-log.md line — no unconditional writer found — rule not documented in SKILL.md"
    writer_has_marker=0
  fi

  # ─── Step 5: literal marker format agrees between reader and writer ───────
  if [ "${reader_has_marker:-0}" -eq 1 ] && [ "$writer_has_marker" -eq 1 ]; then
    reader_marker_line="$(printf '%s' "${note_text:-}" | grep -iE "$reader_marker_re" | head -1)"
    if [ -n "$reader_marker_line" ] && [ "$reader_marker_line" = "$writer_line" ]; then
      pf_pass "TC-021 step 5: literal marker format named by the reader matches the literal format the writer emits"
    else
      pf_fail "TC-021 step 5: reader and writer reference the word 'marker'/'session-log.md' but not the same literal format — rule not documented consistently in SKILL.md"
    fi
  else
    pf_fail "TC-021 step 5: cannot compare literal marker formats — at least one side (reader step 2 / writer step 4) does not define one yet"
  fi
fi

# ─── Step 6 (reader, CR-002): a SECOND marker outcome, distinct from PASSED,
# is documented for "I'll fix manually" / "Skip and continue" with P0/P1
# still open. This is the crux of CR-002: the marker's CONTENT must carry the
# gate's outcome, not just the fact that the stage ran — a suite that only
# ever looks for one marker tag (as TC-021 did before this step) cannot tell
# "PASSED written unconditionally" (the CR-002 regression) from "PASSED
# written only when it's true" (the fix), because both produce a PASSED line
# somewhere in the file. ─────────────────────────────────────────────────────
reader_tags=""
non_passed_tag=""
if [ -f "$PF" ] && [ -n "${note_text:-}" ]; then
  reader_tags="$(printf '%s' "$note_text" | grep -oE '\[pf-check [A-Z]+\]' | LC_ALL=C sort -u)"
  n_tags="$(printf '%s' "$reader_tags" | grep -c . || true)"
  non_passed_tag="$(printf '%s' "$reader_tags" | grep -vFx '[pf-check PASSED]' | head -1)"
  if [ "$n_tags" -ge 2 ] && [ -n "$non_passed_tag" ]; then
    pf_pass "TC-021 step 6: pf/SKILL.md reader documents a second marker outcome distinct from PASSED ($non_passed_tag)"
  else
    pf_fail "TC-021 step 6: pf/SKILL.md reader documents only the PASSED marker — CR-002: no distinct non-passed outcome documented, so /pf cannot tell a real pass from 'ran but did not pass'"
  fi
else
  pf_fail "TC-021 step 6: INFRA — pf/SKILL.md 'check passed' note text unavailable (step 1 above did not locate the section)"
fi

# ─── Step 7 (reader, CR-002): the reader explicitly does NOT treat the
# non-PASSED marker as a passed check. CR-002's failure scenario is a reader
# that advances the pipeline on ANY marker's mere presence — this must not
# be true of the non-PASSED one. ─────────────────────────────────────────────
if [ -n "$non_passed_tag" ]; then
  reader_open_context="$(printf '%s' "$note_text" | grep -A4 -F "$non_passed_tag")"
  not_counted_a1='not[^.]{0,60}count(ed)?[^.]{0,50}(a |the )?passed'
  not_counted_a2='do not[^.]{0,60}(advance|proceed|treat[^.]{0,30}as if)'
  not_counted_a3='does[^.]{0,20}not[^.]{0,60}count[^.]{0,50}passed'
  nc_found="$(count_anchors "$reader_open_context" "$not_counted_a1" "$not_counted_a2" "$not_counted_a3")"
  if [ "$nc_found" -ge 1 ]; then
    pf_pass "TC-021 step 7: pf/SKILL.md reader explicitly states the non-PASSED marker does NOT count as a passed check ($nc_found/3 anchors)"
  else
    pf_fail "TC-021 step 7: pf/SKILL.md reader does not explicitly say the non-PASSED marker fails to count as passed — CR-002: /pf could still advance on its mere presence"
  fi
else
  pf_fail "TC-021 step 7: cannot check — no non-PASSED marker tag found (step 6)"
fi

# ─── Step 8 (writer, CR-002): the non-PASSED marker's write is actually
# CONDITIONED on open P0/P1 remaining after "I'll fix manually" / "Skip and
# continue" — not inert prose sitting next to an otherwise-still-unconditional
# PASSED write (the literal shape of the original CR-002 defect). ───────────
writer_open_tag=""
if [ -f "$CHECK" ] && [ -n "$non_passed_tag" ]; then
  tag_lineno="$(grep -nF "$non_passed_tag" "$CHECK" | head -1 | cut -d: -f1)"
  if [ -n "$tag_lineno" ]; then
    win_start=$((tag_lineno - 6))
    [ "$win_start" -lt 1 ] && win_start=1
    window="$(block_text "$CHECK" "$win_start" "$((tag_lineno + 2))")"
    cond_re='(Skip and continue|I.ll fix manually)[^.]{0,250}(P0|P1)|(P0|P1)[^.]{0,250}(Skip and continue|I.ll fix manually)'
    if printf '%s' "$window" | grep -qiE "$cond_re"; then
      pf_pass "TC-021 step 8: pf-check writer conditions the non-PASSED marker on open P0/P1 remaining after 'I'll fix manually'/'Skip and continue'"
      writer_open_tag="$non_passed_tag"
    else
      pf_fail "TC-021 step 8: pf-check writer's non-PASSED marker is not conditioned on open P0/P1 / the two non-fixing gate options — CR-002: still looks unconditional"
    fi
  else
    pf_fail "TC-021 step 8: pf-check writer does not contain the reader's non-PASSED marker tag ($non_passed_tag) anywhere — formats disagree"
  fi
else
  pf_fail "TC-021 step 8: cannot check — no non-PASSED marker tag available (step 6) or pf-check/SKILL.md missing"
fi

# ─── Step 9: literal non-PASSED marker line format agrees between reader and
# writer — the same cross-check step 5 already does for PASSED, repeated for
# the second outcome so a format drift between the two files is caught here
# too, not just for the marker that was already there before CR-002. ────────
if [ -n "$writer_open_tag" ]; then
  reader_open_line="$(printf '%s' "${note_text:-}" | grep -F "$writer_open_tag" | head -1)"
  writer_open_line="$(grep -F "$writer_open_tag" "$CHECK" | head -1)"
  if [ -n "$reader_open_line" ] && [ "$reader_open_line" = "$writer_open_line" ]; then
    pf_pass "TC-021 step 9: literal non-PASSED marker format named by the reader matches the literal format the writer emits"
  else
    pf_fail "TC-021 step 9: reader and writer's non-PASSED marker tag matches but the surrounding literal line format differs — rule not documented consistently in SKILL.md"
  fi
else
  pf_fail "TC-021 step 9: cannot compare literal non-PASSED marker formats — writer side (step 8) not established"
fi

# ─── Step 10 (reader, round-2 regression): the reader must pick the LAST
# marker line for TARGET by its position in the file, never "a PASSED line is
# present for TARGET somewhere" — session-log.md is append-only and a
# document can be checked, revised, and checked again, leaving several marker
# lines for the same TARGET behind. Three independent anchors, same
# count_anchors technique as TC-018 above (need >=2 of 3): an explicit
# last/most-recent-by-position rule, and the append-only/history framing that
# motivates it. ───────────────────────────────────────────────────────────────
if [ -n "${note_text:-}" ]; then
  o1='(last|latest|most recent(ly)?)[^.]{0,60}marker[^.]{0,100}TARGET'
  o2='(position|order)[^.]{0,30}in the file'
  o3='append-only[^.]{0,250}(several|multiple)[^.]{0,100}marker'
  found="$(count_anchors "$note_text" "$o1" "$o2" "$o3")"
  if [ "$found" -ge 2 ]; then
    pf_pass "TC-021 step 10: pf/SKILL.md reader determines outcome by the LAST marker line for TARGET, by position in the file ($found/3 anchors)"
  else
    pf_fail "TC-021 step 10: pf/SKILL.md reader does not document picking the last-by-position marker for TARGET ($found/3 anchors, need >=2) — mere 'PASSED present somewhere' reading is still possible"
  fi
else
  pf_fail "TC-021 step 10: INFRA — pf/SKILL.md 'check passed' note text unavailable (step 1 above did not locate the section)"
fi

# ─── Step 11 (reader, round-2 regression — the exact failure scenario): an
# earlier PASSED line for TARGET must NOT override a later OPEN line for the
# same TARGET. This is the literal accumulation scenario both round-2
# reviewers named independently (check passes at 10:00 -> PASSED written;
# document revised; check reruns at 11:00, P0 skipped -> OPEN appended below
# the earlier PASSED) — step 10 alone would also pass on prose that mentions
# "last"/"position" in some unrelated sense, so this step pins down the one
# concrete case that must resolve to "not passed". ─────────────────────────
if [ -n "${note_text:-}" ]; then
  order_re='(earlier|previous)[^.]{0,60}PASSED[^.]{0,80}does[^.]{0,15}not[^.]{0,60}override[^.]{0,60}(later|OPEN)'
  if printf '%s' "$note_text" | grep -qiE "$order_re"; then
    pf_pass "TC-021 step 11: pf/SKILL.md reader explicitly states an earlier PASSED line does not override a later OPEN line for the same TARGET"
  else
    pf_fail "TC-021 step 11: pf/SKILL.md reader does not state that an earlier PASSED is overridden by a later OPEN — round-2 regression: check-then-revise-then-skip would still read as passed"
  fi
else
  pf_fail "TC-021 step 11: INFRA — pf/SKILL.md 'check passed' note text unavailable (step 1 above did not locate the section)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Shared prep for TC-022/TC-023: pf-close phase boundaries, check_order-style
# (test/skills-role-matrix-static.sh's check_order: extract "## Phase N" line
# numbers, walk the ordered gaps between them).
# ══════════════════════════════════════════════════════════════════════════════

CLOSE_OK=0
PHASE_COUNT=0
PHASE_LINE=()
PHASE_LABEL=()

if [ -f "$CLOSE" ]; then
  while IFS=: read -r lineno rest; do
    PHASE_LINE+=("$lineno")
    PHASE_LABEL+=("${rest#\#\# }")
  done < <(grep -n '^## Phase' "$CLOSE")
  PHASE_COUNT=${#PHASE_LINE[@]}
  [ "$PHASE_COUNT" -ge 2 ] && CLOSE_OK=1
fi

# The literal continuation phrase Task 12 adds ("Proceed to Phase N.") as one
# alternation with the three pre-existing stop constructs this file documents
# today — written this way so this guard and Task 12's edit cannot drift
# apart on what counts as a signal (implementation_plan.md Task 9 note).
CONTINUE_OR_STOP_RE='Proceed to Phase [0-9]+(\.[0-9]+)?\.|stop:|Merge conflict detected|Stop and surface'
STOP_ONLY_RE='stop:|Merge conflict detected|Stop and surface'

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-022: /pf-close — no phase ends without an explicit continuation or stop (AC-5.4)\n'
# ══════════════════════════════════════════════════════════════════════════════

if [ ! -f "$CLOSE" ]; then
  pf_fail "TC-022 INFRA: skills/pf-close/SKILL.md not found"
elif [ "$CLOSE_OK" -ne 1 ]; then
  pf_fail "TC-022 INFRA: fewer than 2 '## Phase N' headings found in pf-close/SKILL.md (found $PHASE_COUNT)"
else
  pf_pass "TC-022 step 1: found $PHASE_COUNT '## Phase N' headings in pf-close/SKILL.md, in order"

  last_idx=$((PHASE_COUNT - 1)) # Phase 9 ("Report") — excluded, it is the last phase
  all_pass=1
  p45_pass=-1
  i=0
  while [ "$i" -lt "$last_idx" ]; do
    start="${PHASE_LINE[$i]}"
    end=$(( ${PHASE_LINE[$((i + 1))]} - 1 ))
    label="${PHASE_LABEL[$i]}"
    block="$(block_text "$CLOSE" "$start" "$end")"
    if printf '%s' "$block" | grep -qE "$CONTINUE_OR_STOP_RE"; then
      pf_pass "TC-022 step 2: $label — continuation-or-stop signal present"
      case "$label" in
        "Phase 4.5"*) p45_pass=1 ;;
      esac
    else
      pf_fail "TC-022 step 2: $label — no continuation-or-stop signal found ('Proceed to Phase N.' / stop: / Merge conflict detected / Stop and surface) — rule not documented in SKILL.md"
      all_pass=0
      case "$label" in
        "Phase 4.5"*) p45_pass=0 ;;
      esac
    fi
    i=$((i + 1))
  done

  case "$p45_pass" in
    1) pf_pass "TC-022 step 3: Phase 4.5 sub-check GREEN (baseline)" ;;
    0) pf_fail "TC-022 step 3: Phase 4.5 sub-check FAILED — baseline regressed, investigate before Task 12" ;;
    *) pf_fail "TC-022 INFRA: Phase 4.5 heading not found among the extracted phases" ;;
  esac

  if [ "$all_pass" -eq 1 ]; then
    pf_pass "TC-022 step 3: full coverage — every phase (except Phase 9) has a continuation-or-stop signal"
  else
    pf_fail "TC-022 step 3: full coverage — RED pending Task 12 (see per-phase failures above) — rule not documented in SKILL.md"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-023: A partial stop leaves the issue resumable via a described path (AC-5.5)\n'
# ══════════════════════════════════════════════════════════════════════════════

if [ ! -f "$CLOSE" ]; then
  pf_fail "TC-023 INFRA: skills/pf-close/SKILL.md not found"
elif [ "$CLOSE_OK" -ne 1 ]; then
  pf_fail "TC-023 INFRA: fewer than 2 '## Phase N' headings found in pf-close/SKILL.md (found $PHASE_COUNT)"
else
  # ─── Step 1: carry over TC-022's stop-message enumeration. test_plan.md's
  # TC-023 step 1 is that enumeration itself ("для каждого сообщения об
  # остановке, найденного в TC-022"), so it gets its own reported step rather
  # than being folded silently into steps 2 and 3 — an unreported step is a
  # step whose regression nobody would see. ─────────────────────────────────
  stop_phase_count=0
  j=0
  while [ "$j" -lt $((PHASE_COUNT - 1)) ]; do
    s="${PHASE_LINE[$j]}"
    e=$(( ${PHASE_LINE[$((j + 1))]} - 1 ))
    if sed -n "${s},${e}p" "$CLOSE" | grep -qE "$STOP_ONLY_RE"; then
      stop_phase_count=$((stop_phase_count + 1))
    fi
    j=$((j + 1))
  done
  if [ "$stop_phase_count" -ge 1 ]; then
    pf_pass "TC-023 step 1: stop-message enumeration carried over from TC-022 — $stop_phase_count phase(s) carry a stop message, each checked for a recovery path in step 3"
  else
    pf_fail "TC-023 INFRA: stop-message enumeration is empty — TC-022 step 2 found no stop message to carry over, so step 3 would check nothing"
  fi

  # ─── Step 2: baseline exemplar — Phase 4.5's own "Recovering from a
  # failure inside this phase", numbered steps 1-3 with concrete commands. ───
  # shellcheck disable=SC2016 # backticks are literal markdown code-span
  # delimiters being searched for, not shell expansions.
  if grep -qF 'Recovering from a failure inside this phase' "$CLOSE" \
    && grep -qF '`git checkout --' "$CLOSE" \
    && grep -qF '`rm ' "$CLOSE" \
    && grep -qF '`git checkout issue/ISSUE-ID`' "$CLOSE"; then
    pf_pass "TC-023 step 2: Phase 4.5 'Recovering from a failure inside this phase' exemplar present (baseline) — numbered steps with concrete git checkout --/rm/git checkout issue/ISSUE-ID commands"
  else
    pf_fail "TC-023 step 2: Phase 4.5 recovery exemplar not found — rule not documented in SKILL.md"
  fi

  # ─── Step 1/3: for every stop message found in TC-022 step 2, a concrete
  # recovery path (a backtick command, or >=2 numbered steps) must appear
  # within the next few lines. Bare "resolve ... manually" prose with neither
  # is the known gap this case exists to catch (Phase 4). ────────────────────
  last_idx=$((PHASE_COUNT - 1))
  any_gap=0
  checked_any=0
  i=0
  while [ "$i" -lt "$last_idx" ]; do
    start="${PHASE_LINE[$i]}"
    end=$(( ${PHASE_LINE[$((i + 1))]} - 1 ))
    label="${PHASE_LABEL[$i]}"
    rel_stop_line="$(sed -n "${start},${end}p" "$CLOSE" | grep -nE "$STOP_ONLY_RE" | head -1 | cut -d: -f1)"
    if [ -n "$rel_stop_line" ]; then
      checked_any=1
      abs_stop_line=$((start + rel_stop_line - 1))
      window_end=$((abs_stop_line + 8))
      [ "$window_end" -gt "$end" ] && window_end="$end"
      window="$(block_text "$CLOSE" "$abs_stop_line" "$window_end")"
      numbered_count="$(printf '%s\n' "$window" | grep -cE '^[[:space:]]*[0-9]+\.[[:space:]]')"
      has_command=0
      # shellcheck disable=SC2016 # literal backtick code-span match, not expansion.
      printf '%s' "$window" | grep -qE '`[^`]*[[:space:]][^`]*`' && has_command=1
      if [ "$has_command" -eq 1 ] || [ "$numbered_count" -ge 2 ]; then
        pf_pass "TC-023 step 3: $label — stop message has a concrete recovery path nearby"
      else
        pf_fail "TC-023 step 3: $label — stop message has no concrete recovery path nearby (bare 'resolve ... manually'-style prose) — rule not documented in SKILL.md"
        any_gap=1
      fi
    fi
    i=$((i + 1))
  done

  if [ "$checked_any" -eq 0 ]; then
    pf_fail "TC-023 INFRA: no stop messages found to check (expected at least one, per TC-022 step 2)"
  elif [ "$any_gap" -eq 0 ]; then
    pf_pass "TC-023 step 3: full coverage — every stop message has a concrete recovery path"
  else
    pf_fail "TC-023 step 3: full coverage — RED pending Task 12 (known gap: Phase 4's bare 'Resolve conflicts manually on PARENT-BRANCH' — see per-phase failures above)"
  fi
fi

pf_summary
