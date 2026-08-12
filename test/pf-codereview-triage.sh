#!/usr/bin/env bash
# test/pf-codereview-triage.sh — TC-010, TC-011, TC-012
# (20260806-improve-codereview-convergence, implementation_plan.md Task 5).
#
# Task 5 is infrastructure-only: it writes the harness (helpers + drift-guards)
# for the blocking-rubric/triage rules that Task 6 adds to
# skills/pf-codereview/SKILL.md. It does NOT modify SKILL.md itself. Per
# test_plan.md's own framing (Overview, point 3): a drift-guard that returns
# FAIL today because the rule genuinely isn't in SKILL.md yet is a correct,
# expected result — not a broken test. Distinguishing "rule not documented"
# from "test infrastructure is broken" (missing fixture, unreadable SKILL.md,
# a helper that errors out) is done explicitly in each guard's message below,
# per test_plan.md's Overview point 3 and this task's Implementation Notes.
#
# Expected state on THIS branch, before Task 6 runs:
#   TC-010            — RED  (pure static audit, no fixtures; reclassification
#                        step does not exist in SKILL.md yet)
#   TC-011            — GREEN (baseline/regression guard — Phase 3's existing
#                        "any open P0/P1 -> FAIL" rule is already unconditioned
#                        by round number; this must stay green through Task 2
#                        and Task 6)
#   TC-012 (helper)   — GREEN (pure bash, no dependency on SKILL.md text)
#   TC-012 (drift-guard) — RED (follow-up-issue path for P1 doesn't exist yet)
#
# Read-only: this suite never writes into $REPO_ROOT, never touches $HOME,
# never runs the convergence script, and issues no git commands. It only
# reads skills/pf-codereview/SKILL.md and the two ledger fixtures below.
#
# The convergence script is deliberately named here in words rather than by
# file name: S-1 (test/lib.sh) requires that grepping test/ for that file name
# return test/lib.sh and nothing else, so that the single gateway stays
# auditable by hand. test/safety-audit.sh enforces it, and an earlier draft of
# this very comment — written to reassure a reader that the suite is safe —
# broke the rule by spelling the name out.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

SKILL="$REPO_ROOT/skills/pf-codereview/SKILL.md"
FIXDIR="$REPO_ROOT/test/fixtures/pf-codereview-convergence"
LEDGER_ROUND1="$FIXDIR/ledger-open-p0-round1.md"
LEDGER_ROUND7="$FIXDIR/ledger-open-p0-round7.md"

# ══════════════════════════════════════════════════════════════════════════════
# Helpers — transcribed mechanical rules (test_plan.md TC-011, TC-012)
# ══════════════════════════════════════════════════════════════════════════════

# pf_cr_gate_verdict <ledger-file>
#
# Transcribes Phase 3's Verdict rule from skills/pf-codereview/SKILL.md:
# "If any P0 or P1 finding is open: write FAIL." "Open" here means literally
# `state: open` from TC-006's six-value dictionary (open + five terminal
# resolutions) — not an empty State cell (that is TC-008's separate rule) and
# not "any non-terminal value" in general, exactly the value `open` (test_plan
# TC-011 Description). A row whose Priority is P0/P1 but whose State is a
# terminal value (fixed, accepted-risk, deferred, wont-fix, duplicate-of ...)
# does not block. Prints FAIL or PASS on stdout; prints nothing and returns 1
# if the ledger file cannot be read (infra failure, distinct from a verdict).
#
# Ledger table shape expected (see the two fixtures next to this file):
#   | ID | Round | Priority | State | Description |
#   | CR-001 | 1 | P0 | open | ... |
pf_cr_gate_verdict() {
  local ledger="$1"
  if [ ! -f "$ledger" ]; then
    return 1
  fi
  awk -F'|' '
    /^\| *CR-[0-9]+/ {
      pr = $4; st = $5
      gsub(/^[ \t]+|[ \t]+$/, "", pr)
      gsub(/^[ \t]+|[ \t]+$/, "", st)
      if ((pr == "P0" || pr == "P1") && st == "open") { found = 1 }
    }
    END { print (found ? "FAIL" : "PASS") }
  ' "$ledger"
}

# pf_cr_followup_allowed <priority>
#
# Transcribes BR-5's "follow-up issue" gate-passing path: available for P1,
# never for P0, no matter what (test_plan.md TC-012, steps 1-2). Any input
# outside the closed {P0, P1} set is rejected rather than silently allowed —
# there is no third priority this helper is asked about, and defaulting an
# unknown value to "allowed" would be the unsafe direction for a gate helper.
pf_cr_followup_allowed() {
  case "$1" in
    P1) printf 'allowed' ;;
    *) printf 'rejected' ;;
  esac
}

# ─── anchor-narrowing helper (style: test/skills-role-matrix-static.sh) ───────
#
# pf_cr_section_range <start-heading-regex> <end-heading-regex> <file>
# Prints "startline:endline" (end exclusive) for the first heading matching
# start-heading-regex through the line before the first heading matching
# end-heading-regex found after it. Empty string if start heading not found.
pf_cr_section_range() {
  local start_re="$1" end_re="$2" file="$3"
  local start_line end_line
  start_line="$(grep -nE "$start_re" "$file" | head -1 | cut -d: -f1)"
  [ -z "$start_line" ] && return 1
  end_line="$(tail -n "+$((start_line + 1))" "$file" | grep -nE "$end_re" | head -1 | cut -d: -f1)"
  if [ -z "$end_line" ]; then
    printf '%s:%s' "$start_line" '$'
  else
    printf '%s:%s' "$start_line" "$((start_line + end_line - 1))"
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-011: Open P0 never yields PASS, independent of round number (regression guard)\n'
# ══════════════════════════════════════════════════════════════════════════════
# Baseline case (test_plan.md's ONLY baseline TC): expected GREEN today,
# before any task in this issue changes skills/pf-codereview/SKILL.md.

if [ ! -f "$SKILL" ]; then
  pf_fail "TC-011: skills/pf-codereview/SKILL.md does not exist (test infrastructure defect, not a rule failure)"
elif [ ! -f "$LEDGER_ROUND1" ]; then
  pf_fail "TC-011: fixture missing: $LEDGER_ROUND1 (test infrastructure defect)"
elif [ ! -f "$LEDGER_ROUND7" ]; then
  pf_fail "TC-011: fixture missing: $LEDGER_ROUND7 (test infrastructure defect)"
else
  # ─── Step 1: open P0, round 1 -> FAIL ───────────────────────────────────────
  verdict1="$(pf_cr_gate_verdict "$LEDGER_ROUND1")"
  if [ "$verdict1" = "FAIL" ]; then
    pf_pass "TC-011 step 1: pf_cr_gate_verdict(open P0, round 1) == FAIL"
  else
    pf_fail "TC-011 step 1: pf_cr_gate_verdict(open P0, round 1) == '$verdict1' (want FAIL)"
  fi

  # ─── Step 2: open P0, round 7 -> FAIL (round number does not matter) ───────
  verdict7="$(pf_cr_gate_verdict "$LEDGER_ROUND7")"
  if [ "$verdict7" = "FAIL" ]; then
    pf_pass "TC-011 step 2: pf_cr_gate_verdict(open P0, round 7) == FAIL — round number does not participate"
  else
    pf_fail "TC-011 step 2: pf_cr_gate_verdict(open P0, round 7) == '$verdict7' (want FAIL)"
  fi

  # ─── Step 3: drift-guard — Phase 3's FAIL condition, unconditioned by round ─
  range="$(pf_cr_section_range '^## Phase 3: Write' '^## Phase 4' "$SKILL")"
  if [ -z "$range" ]; then
    pf_fail "TC-011 step 3: could not locate '## Phase 3: Write ...' section in SKILL.md (test infrastructure defect — heading not found, not a rule failure)"
  else
    p3_start="${range%%:*}"
    p3_end="${range##*:}"
    if [ "$p3_end" = '$' ]; then
      phase3_block="$(tail -n "+$p3_start" "$SKILL")"
    else
      phase3_block="$(sed -n "${p3_start},${p3_end}p" "$SKILL")"
    fi

    if ! printf '%s\n' "$phase3_block" | grep -qiE 'P0 or P1 finding is open'; then
      pf_fail "TC-011 step 3: the FAIL condition ('any open P0/P1 finding') is not documented in Phase 3 of SKILL.md — rule not documented in SKILL.md"
    else
      # Flatten to one line so an exception phrased across a line break is
      # still caught, then look for an exception clause tying the FAIL rule
      # to a round/budget qualifier (e.g. "unless round == budget").
      blob="$(printf '%s' "$phase3_block" | tr '\n' ' ')"
      if printf '%s' "$blob" | grep -qiE '(unless|except|excluding)[^.]{0,120}(round|budget)'; then
        pf_fail "TC-011 step 3: REGRESSION — Phase 3's FAIL condition now carries a round/budget exception; an open P0/P1 must FAIL at any round number"
      else
        pf_pass "TC-011 step 3: Phase 3's FAIL condition ('any open P0/P1') carries no round/budget exception (baseline, matches SKILL.md today)"
      fi
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-010: Reclassification is an explicit, attributed, visible step\n'
# ══════════════════════════════════════════════════════════════════════════════
# Pure static audit, no fixtures (test_plan.md: "test-first, ожидаемо RED до
# реализации" — Task 6 makes this green). All three signals below must be
# found TOGETHER; today none of them exist because SKILL.md never uses the
# word "reclassif*" at all — "assign priorities" / generic P0/P1/P2 mentions
# elsewhere in the file must not accidentally satisfy this.

if [ ! -f "$SKILL" ]; then
  pf_fail "TC-010: skills/pf-codereview/SKILL.md does not exist (test infrastructure defect, not a rule failure)"
elif ! grep -qiE 'reclassif' "$SKILL"; then
  # Anchor token absent entirely: none of the three signals can be nearby it.
  # Each step is reported on its own label per the /pf-test TC-ID scan
  # contract, all pointing at the same root cause.
  pf_fail "TC-010 step 1: no explicitly named reclassification step found in SKILL.md (word 'reclassif*' absent) — rule not documented in SKILL.md"
  pf_fail "TC-010 step 2: cannot check per-finding reason retention — no reclassification step exists to attach it to — rule not documented in SKILL.md"
  pf_fail "TC-010 step 3: cannot check code_review.md visibility of reclassification — no reclassification step exists — rule not documented in SKILL.md"
else
  # Reclassification is mentioned somewhere — check each of the three signals
  # in its immediate context (a handful of lines around each occurrence),
  # so a stray unrelated use of the word elsewhere in the file is not enough.
  context="$(grep -inE -B3 -A3 'reclassif' "$SKILL")"

  if printf '%s' "$context" | grep -qiE '\bstep\b'; then
    pf_pass "TC-010 step 1: reclassification is named as its own step (word 'step' near 'reclassif*')"
  else
    pf_fail "TC-010 step 1: 'reclassif*' found, but not framed as its own named step (no 'step' nearby) — rule not documented in SKILL.md"
  fi

  if printf '%s' "$context" | grep -qiE '\breason\b'; then
    pf_pass "TC-010 step 2: a per-finding reason-retention requirement is documented near the reclassification step"
  else
    pf_fail "TC-010 step 2: no requirement to retain a reason per reclassified finding found near 'reclassif*' — rule not documented in SKILL.md"
  fi

  if printf '%s' "$context" | grep -qiE 'code_review\.md'; then
    pf_pass "TC-010 step 3: reclassification is required to be visible in code_review.md (not applied invisibly)"
  else
    pf_fail "TC-010 step 3: no requirement that the reclassification be visible in code_review.md found near 'reclassif*' — rule not documented in SKILL.md"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-012: Follow-up issue is a P1-only way to pass the gate, never P0\n'
# ══════════════════════════════════════════════════════════════════════════════

# ─── Steps 1-2: helper is pure bash, green from the start ──────────────────
allowed_p1="$(pf_cr_followup_allowed P1)"
if [ "$allowed_p1" = "allowed" ]; then
  pf_pass "TC-012 step 1: pf_cr_followup_allowed(P1) == allowed"
else
  pf_fail "TC-012 step 1: pf_cr_followup_allowed(P1) == '$allowed_p1' (want allowed)"
fi

allowed_p0="$(pf_cr_followup_allowed P0)"
if [ "$allowed_p0" = "rejected" ]; then
  pf_pass "TC-012 step 2: pf_cr_followup_allowed(P0) == rejected"
else
  pf_fail "TC-012 step 2: pf_cr_followup_allowed(P0) == '$allowed_p0' (want rejected)"
fi

# ─── Step 3: drift-guard — the two BR-5 mechanisms are documented as TWO
# distinct things, not merged into one:
#   (a) where PASS-time remnants (P2/deferred) go        -> docs/planning/tech-debt.md
#   (b) what is available as a way to PASS the gate       -> follow-up issue, P1 only
# test-first: RED until Task 6 — today SKILL.md has neither concept at all.
if [ ! -f "$SKILL" ]; then
  pf_fail "TC-012 step 3: skills/pf-codereview/SKILL.md does not exist (test infrastructure defect, not a rule failure)"
else
  has_tech_debt=0
  has_followup_p1=0

  grep -qiE 'tech-debt\.md' "$SKILL" && has_tech_debt=1

  # The "follow-up issue" mechanism must be tied to P1, and P0 must be
  # explicitly denied it (BR-1, AC-3.4).
  #
  # An earlier version of this check required simply that `P0` NOT appear
  # within +-2 lines of any `follow-up issue` mention. That was inverted on
  # the very invariant it exists to protect, in two ways at once:
  #
  #   1. It never required the P0 prohibition to be stated at all — text that
  #      merely never mentions P0 passed. The most safety-critical sentence in
  #      this section was therefore unchecked, and omitting it was rewarded.
  #   2. It could not tell "P0 may never use this path" from "P0 may use this
  #      path" — both put `P0` near the term — so writing the mandated
  #      prohibition in the obvious words turned this step RED for correct
  #      text, pushing an author toward wording that dodges the window
  #      instead of toward saying the thing plainly.
  #
  # It now checks both directions positively: the prohibition must be present,
  # and no granting phrasing may be. `pf_grants_p0` is deliberately the narrow
  # half — a window mentioning P0 counts as granting only when it carries no
  # negation, so a prohibition sentence is not mistaken for a grant.
  followup_context="$(grep -inE -B2 -A2 'follow-up[- ]issue' "$SKILL")"

  # Positive requirement: P0 is explicitly denied the follow-up route, and the
  # denial must live in the section that documents that route — not just
  # anywhere in the file. Scoping matters: a whole-file search is satisfied by
  # any unrelated "P0 ... never" sentence (Phase 3's unconditional FAIL rule
  # and Phase 3.5's bail-out text both contain one), so it would pass even
  # with this section's prohibition deleted outright. Measured: deleting the
  # prohibition left an unscoped version of this check green.
  #
  # The section is located by its own heading rather than by a hardcoded
  # number, so renumbering a phase does not silently disable the check.
  p0_denied=0
  followup_section_start="$(grep -nE '^## Phase [0-9.]+:.*[Ff]ollow-[Uu]p' "$SKILL" | head -1 | cut -d: -f1)"
  if [ -n "$followup_section_start" ]; then
    followup_section_end="$(awk -v s="$followup_section_start" \
      'NR > s && /^## / { print NR - 1; exit }' "$SKILL")"
    [ -z "$followup_section_end" ] && followup_section_end="$(wc -l < "$SKILL")"
    followup_section="$(sed -n "${followup_section_start},${followup_section_end}p" "$SKILL")"
    if printf '%s' "$followup_section" |
      grep -qiE '(not available|unavailable|never|no such path|not open|denied|cannot)[^.]{0,140}\bP0\b|\bP0\b[^.]{0,140}(never|not available|unavailable|no such path|cannot|denied)'; then
      p0_denied=1
    fi
  fi

  # Negative requirement: no passage may grant P0 the path. Scope this to
  # lines that themselves name the mechanism — NOT the +-2 line window used
  # above. Measured reason: the ledger's own priority-vocabulary bullet
  # ("**Priority** — P0 (blocker) / P1 ...") sits within two lines of the
  # Description bullet that mentions the follow-up-issue path, so a windowed
  # check flags a plain vocabulary enumeration as if it granted P0 a route.
  # A grant has to say both things in one breath, so one line is the right
  # unit: "a P0 finding may also be resolved via a follow-up issue" is caught,
  # an adjacent list of what P0/P1/P2 mean is not.
  p0_granted=0
  while IFS= read -r ctx_line; do
    case "$ctx_line" in
      *P0*)
        printf '%s' "$ctx_line" |
          grep -qiE 'never|not available|unavailable|no such path|cannot|not open|denied' ||
          p0_granted=1
        ;;
    esac
  done <<EOF
$(grep -inE 'follow-up[- ]issue' "$SKILL")
EOF

  if [ -n "$followup_context" ] &&
    printf '%s' "$followup_context" | grep -qE '\bP1\b' &&
    [ "$p0_denied" -eq 1 ] &&
    [ "$p0_granted" -eq 0 ]; then
    has_followup_p1=1
  fi

  if [ "$has_tech_debt" -eq 1 ] && [ "$has_followup_p1" -eq 1 ]; then
    pf_pass "TC-012 step 3: PASS-time remnants (tech-debt.md) and the P1-only follow-up-issue gate path are documented as two distinct mechanisms, with P0 explicitly denied that path and nowhere granted it"
  else
    missing=()
    [ "$has_tech_debt" -eq 0 ] && missing+=("PASS-time remnants -> docs/planning/tech-debt.md not documented")
    if [ "$has_followup_p1" -eq 0 ]; then
      [ -z "$followup_context" ] && missing+=("no 'follow-up issue' mechanism documented at all")
      [ -n "$followup_context" ] && ! printf '%s' "$followup_context" | grep -qE '\bP1\b' &&
        missing+=("follow-up-issue path not scoped to P1")
      [ "$p0_denied" -eq 0 ] && missing+=("P0 is never explicitly denied the follow-up-issue path (BR-1/AC-3.4 prohibition absent)")
      [ "$p0_granted" -eq 1 ] && missing+=("a follow-up-issue passage mentions P0 without denying it the path — reads as granting P0 a gate-passing route")
    fi
    pf_fail "TC-012 step 3: BR-5's two mechanisms are not both documented distinctly — rule not documented in SKILL.md (${missing[*]})"
  fi
fi

pf_summary
