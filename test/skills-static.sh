#!/usr/bin/env bash
# test/skills-static.sh — TC-042, TC-043, TC-044: defect 5, statically.
#
# Defect 5 (the most dangerous one in this issue): the skills used to decide a
# stage was complete purely by FILE EXISTENCE. A migrated v2 issue therefore
# reported `Completed: CREATE, TEST_PLAN, IMPL_PLAN` and /pf routed straight to
# /pf-execute — against a test_plan.md whose entire body was a stub marker.
#
# The live half of the fix (interactive prompts, a real $HOME, a Claude Code
# session interpreting the skill text) is covered by Manual TC-045…TC-048. This
# suite is therefore the ONLY automated cover defect 5 gets, and it is deliberately
# sharp: it greps the repository's skills/ directly (no ~/.claude/skills involved,
# so KI-4 does not apply here) and asserts the SHAPE of the fix, not its prose.
#
# Read-only. It runs no script, touches no $HOME, and mutates nothing.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

SKILLS="$REPO_ROOT/skills"
PF="$SKILLS/pf/SKILL.md"
TIERS="$SKILLS/pf-size-tiers/SKILL.md"

# The stub marker is assembled from fragments so that THIS auditor never becomes
# the extra occurrence it is hunting for (same trick as safety-audit.sh): the
# literal must live in exactly one file under skills/, and a grep of test/ for it
# must not muddy that count either.
STUB_MARKER="TODO: Run ""/pf-"
# The one home of the shared definition, as referenced by every gate.
DEF_REF="pf-size-tiers/SKILL.md"

# rows_of <sed-range> — prints one routing table's section of pf/SKILL.md.
section_of() { sed -n "$1" "$PF"; }

# grep_line <file> <anchor-regex> — the single physical line of a gate.
gate_line() { grep -m1 -E "$2" "$1" 2>/dev/null || true; }

# assert_gate <label> <file> <anchor-regex> — the gate REFERENCES the shared
# definition on its own line rather than restating a criterion of its own.
assert_gate() {
  local label="$1" file="$2" anchor="$3" line
  line="$(gate_line "$file" "$anchor")"
  if [ -z "$line" ]; then
    pf_fail "$label: gate not found (anchor: $anchor)"
  elif printf '%s' "$line" | grep -q -- "$DEF_REF"; then
    pf_pass "$label: references the shared definition"
  else
    pf_fail "$label: does NOT reference $DEF_REF — it restates its own criterion"
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-042: ONE shared definition of "stage complete", in ONE place\n'
# ══════════════════════════════════════════════════════════════════════════════

# ─── Steps 1-2: the definition exists, and carries all THREE conjuncts ────────
# exists  ∧  (non-empty body ∧ no stub marker)  ∧  every preceding stage complete.
# The third conjunct is measure 3 and lives here too, so that it also has exactly
# one source: a real (non-stub) v2 implementation_plan.md satisfies conjuncts 1-2
# and is still not a complete stage while test_plan.md is missing.

if grep -qE '^## Stage completion' "$TIERS"; then
  pf_pass 'step 1: pf-size-tiers holds a "Stage completion" section'
else
  pf_fail 'step 1: pf-size-tiers has no "Stage completion" section'
fi

if grep -qiE 'IF AND ONLY IF|iff' "$TIERS"; then
  pf_pass "step 1: the definition is stated as an IF AND ONLY IF"
else
  pf_fail "step 1: the definition is not stated as an IF AND ONLY IF"
fi

if grep -qiE '(file|document) (is present|exists)' "$TIERS"; then
  pf_pass "step 1: conjunct 1 — the document exists"
else
  pf_fail "step 1: conjunct 1 (document exists) missing"
fi

if grep -qiE 'non-empty body' "$TIERS"; then
  pf_pass "step 1: conjunct 2a — a non-empty body beyond the heading"
else
  pf_fail "step 1: conjunct 2a (non-empty body) missing"
fi

if grep -q -- "$STUB_MARKER" "$TIERS" && grep -qiE 'whole file' "$TIERS"; then
  pf_pass "step 1: conjunct 2b — the stub marker, searched over the whole file"
else
  pf_fail "step 1: conjunct 2b (stub marker / whole-file search) missing"
fi

if grep -qiE 'every preceding stage' "$TIERS"; then
  pf_pass "step 2: conjunct 3 — every preceding stage of the pipeline is complete"
else
  pf_fail "step 2: conjunct 3 (ordering) missing — measure 3 has no single source"
fi

if grep -qiE 'first incomplete stage' "$TIERS"; then
  pf_pass "step 2: routing keys on the FIRST INCOMPLETE stage"
else
  pf_fail "step 2: the first-incomplete-stage rule is not stated in pf-size-tiers"
fi

# ─── Step 3: the criterion's literal lives in exactly ONE file ────────────────
# If a gate had restated the criterion instead of referencing it, the literal
# would show up in that gate's file too. This is the drift detector.

marker_files="$(grep -rl -- "$STUB_MARKER" "$SKILLS" 2>/dev/null | LC_ALL=C sort)"
n_marker="$(printf '%s' "$marker_files" | grep -c . || true)"
if [ "$n_marker" -eq 1 ] && [ "$marker_files" = "$TIERS" ]; then
  pf_pass "step 3: the stub marker occurs in exactly one file under skills/ (pf-size-tiers)"
else
  pf_fail "step 3: the stub marker occurs in $n_marker file(s) under skills/ — the definition has been copied"
  printf '%s\n' "$marker_files" >&2
fi

def_home="$(grep -rlE '^## Stage completion' "$SKILLS" 2>/dev/null | LC_ALL=C sort)"
if [ "$def_home" = "$TIERS" ]; then
  pf_pass "step 3: exactly one skill DEFINES stage completion; the rest reference it"
else
  pf_fail "step 3: 'Stage completion' is defined in: ${def_home:-<nowhere>} (want only pf-size-tiers)"
fi

# ─── Step 4: all SEVEN gates reference the definition ─────────────────────────
# 1. pf         Step 5 table            2. pf         "check passed"
# 3. pf-brd     output gate             4. pf-spec    output gate
# 5. pf-test-plan output gate           6. pf-impl-plan input + output gates
# 7. pf-execute prerequisites

assert_gate "step 4 gate 1/7 (pf, Step 5 table)" "$PF" '^\| Document complete'
assert_gate "step 4 gate 2/7 (pf, check passed)" "$PF" '^\*\*Note on "check passed"'
assert_gate "step 4 gate 3/7 (pf-brd, notes/brd exists)" "$SKILLS/pf-brd/SKILL.md" '^\*\*Output gate'
assert_gate "step 4 gate 4/7 (pf-spec, specs exists)" "$SKILLS/pf-spec/SKILL.md" '^\*\*Output gate'
assert_gate "step 4 gate 5/7 (pf-test-plan, test_plan exists)" "$SKILLS/pf-test-plan/SKILL.md" '^\*\*Output gate'
assert_gate "step 4 gate 6/7a (pf-impl-plan, test_plan must exist)" "$SKILLS/pf-impl-plan/SKILL.md" '^\*\*Input gate'
assert_gate "step 4 gate 6/7b (pf-impl-plan, impl_plan exists)" "$SKILLS/pf-impl-plan/SKILL.md" '^\*\*Output gate'
assert_gate "step 4 gate 7/7 (pf-execute, prerequisites)" "$SKILLS/pf-execute/SKILL.md" 'Check prerequisites'

# ─── Step 5: scope — every row of Step 5's table, not test_plan.md alone ──────

step5="$(section_of '/^## Step 5:/,/^## Step 6:/p')"
if printf '%s' "$step5" | grep -qiE 'every row' &&
  printf '%s' "$step5" | grep -q 'notes\.md' &&
  printf '%s' "$step5" | grep -q 'manual_test_checklist\.md' &&
  printf '%s' "$step5" | grep -q 'qa_report\.md'; then
  pf_pass "step 5: the criterion covers every row of Step 5 (notes/manual_test_checklist/qa_report included)"
else
  pf_fail "step 5: Step 5's table does not apply the criterion to every row"
fi

# ─── Step 6: the closed-issue brd.md pointer is NOT caught by the criterion ───

if grep -q 'docs/issues/open/' "$TIERS" && grep -qE 'docs/issues/closed/' "$TIERS"; then
  pf_pass "step 6: scope is limited to open issues; the closed-issue pointer is exempted"
else
  pf_fail "step 6: pf-size-tiers does not scope the criterion to docs/issues/open/"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-043: FOUR routing tables, not three (measure 3 + Р12)\n'
# ══════════════════════════════════════════════════════════════════════════════

# ─── Step 1: there are four tables ────────────────────────────────────────────

n_tables="$(grep -cE '^### (trivial-tier|feat|improve|bug) workflow' "$PF" || true)"
if [ "$n_tables" -eq 4 ]; then
  pf_pass "step 1: four routing tables (trivial, feat, improve, bug)"
else
  pf_fail "step 1: $n_tables routing table heading(s) in pf/SKILL.md (want 4)"
fi

trivial="$(section_of '/^### trivial-tier workflow/,/^### feat workflow/p')"
feat="$(section_of '/^### feat workflow/,/^### improve workflow/p')"
improve="$(section_of '/^### improve workflow/,/^### bug workflow/p')"
bug="$(section_of '/^### bug workflow/,/^## Step 7:/p')"

for t in trivial feat improve bug; do
  body=""
  case "$t" in
    trivial) body="$trivial" ;;
    feat) body="$feat" ;;
    improve) body="$improve" ;;
    bug) body="$bug" ;;
  esac
  if printf '%s' "$body" | grep -q -- "$DEF_REF"; then
    pf_pass "step 1: the $t table keys on the shared definition, not on bare file existence"
  else
    pf_fail "step 1: the $t table does not reference $DEF_REF"
  fi
done

# ─── Step 2: the bug table gained its missing row ─────────────────────────────
# Today's bug table had exactly 8 rows and NO "IMPL_PLAN without TEST_PLAN" row:
# a migrated v2 bug issue (analysis.md + a renamed implementation_plan.md, no
# test_plan.md) landed on `IMPL_PLAN → /pf-execute` — implementation against a
# test plan that does not exist.

bug_row="$(printf '%s\n' "$bug" |
  grep -E '^\|.*implementation_plan\.md.*test_plan\.md.*(missing|not complete)' || true)"
if [ -n "$bug_row" ]; then
  pf_pass "step 2: the bug table has an 'IMPL_PLAN without TEST_PLAN' row"
  if printf '%s' "$bug_row" | grep -q '/pf-test-plan' &&
    printf '%s' "$bug_row" | grep -qiE 'never .?/pf-execute'; then
    pf_pass "step 2: that row routes to /pf-test-plan and forbids /pf-execute"
  else
    pf_fail "step 2: the row exists but does not route to /pf-test-plan / forbid /pf-execute"
  fi
else
  pf_fail "step 2: the bug table still has no 'IMPL_PLAN without TEST_PLAN' row — defect 5 is open for bug issues"
fi

# ─── Step 3: feat and improve route BACK to the first hole ────────────────────

for t in feat improve; do
  body=""
  case "$t" in
    feat) body="$feat" ;;
    improve) body="$improve" ;;
  esac
  back="$(printf '%s\n' "$body" |
    grep -E '^\|.*implementation_plan\.md.*not complete' || true)"
  if [ -n "$back" ] && printf '%s' "$back" | grep -qiE 'first incomplete stage'; then
    pf_pass "step 3: the $t table routes an IMPL_PLAN-without-predecessors issue back to the first incomplete stage"
  else
    pf_fail "step 3: the $t table has no back-to-the-first-hole row"
  fi
  if printf '%s\n' "$body" | grep -qiE 'first incomplete stage governs'; then
    pf_pass "step 3: the $t table is keyed on the first INCOMPLETE stage, not the last completed one"
  else
    pf_fail "step 3: the $t table still keys on 'last completed stage'"
  fi
done

# ─── Step 4: the trivial table — the door five drafts missed ──────────────────
# It is keyed DIRECTLY on which documents are present, so a stub test_plan.md on
# disk plus an answer of `trivial` to the legacy-tier guard used to route straight
# to /pf-execute. Its rows must speak of "complete", never of bare existence.

# shellcheck disable=SC2016  # backticks are markdown in a grep pattern, not command substitution
if printf '%s\n' "$trivial" | grep -qE '^\| `notes\.md` \+ `test_plan\.md` both complete'; then
  pf_pass "step 4: the trivial table's last row demands both documents COMPLETE"
else
  pf_fail "step 4: the trivial table's last row still triggers on mere existence"
fi

if printf '%s\n' "$trivial" | grep -qE '^\|.*both exist'; then
  pf_fail "step 4: a trivial-table row still routes on 'both exist' — the stub door is open"
else
  pf_pass "step 4: no trivial-table row routes on bare existence"
fi

# shellcheck disable=SC2016  # backticks are markdown in a grep pattern, not command substitution
if printf '%s' "$trivial" | grep -qiE 'stub `test_plan\.md`.*not.*complete|not.*complete.*stub'; then
  pf_pass "step 4: the trivial table says outright that a stub test_plan.md is not complete"
else
  pf_fail "step 4: the trivial table does not exclude a stub test_plan.md"
fi

# ─── Step 5: the mechanisms the trivial table exists FOR are preserved ────────
# The precedence rule (trivial table applies exclusively) and the "this table is
# keyed on documents" caveat are why the table exists at all. We swapped "the file
# exists" for "the stage is complete" — and nothing else.

if grep -qE 'trivial-tier routing table applies \*\*exclusively\*\*' "$PF"; then
  pf_pass "step 5: the precedence rule (trivial table applies exclusively) is preserved"
else
  pf_fail "step 5: the precedence rule was lost"
fi

if printf '%s' "$trivial" | grep -qiE 'this table is keyed on'; then
  pf_pass "step 5: the 'keyed on the documents, not on last completed stage' caveat is preserved"
else
  pf_fail "step 5: the trivial table's keying caveat was lost"
fi

# ─── Step 6: no skill still speaks of "three tables" ──────────────────────────
# Scope is deliberately skills/ only: in docs/issues/ the phrase occurs on purpose,
# discussing the very mistake, and would give a false FAIL (the TC-039 trap).

three="$(grep -rniE 'all three (routing )?tables?' "$SKILLS" 2>/dev/null || true)"
if [ -z "$three" ]; then
  pf_pass 'step 6: no "three tables" wording left in skills/'
else
  pf_fail 'step 6: skills/ still says "three tables"'
  printf '%s\n' "$three" >&2
fi

# ─── Step 7: /pf-spec and /pf-impl-plan never appear in the trivial route ─────

# shellcheck disable=SC2016  # backticks are markdown in a grep pattern, not command substitution
if grep -qE '`/pf-spec` and `/pf-impl-plan` must never appear as a next step' "$PF"; then
  pf_pass "step 7: the rule '/pf-spec and /pf-impl-plan never next at trivial tier' is preserved"
else
  pf_fail "step 7: the trivial-tier /pf-spec + /pf-impl-plan prohibition was lost"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-044: Р9 — four OUTPUT gates offer a choice, two INPUT gates stop\n'
# ══════════════════════════════════════════════════════════════════════════════

# ─── Steps 1-4: the four output gates ─────────────────────────────────────────
# "The output already exists → stop" was a dead end: a migrated issue arrives with
# implementation_plan.md already in place (renamed from the v2 file), and its owner
# was locked out of their own plan for good.

check_output_gate() {
  local label="$1" file="$2" line
  line="$(gate_line "$file" '^\*\*Output gate')"
  if [ -z "$line" ]; then
    pf_fail "$label: no output gate found"
    return
  fi
  local missing=""
  for word in regenerate keep cancel; do
    printf '%s' "$line" | grep -q -- "\*\*$word\*\*" ||
      grep -qE "^- \*\*$word\*\*" "$file" || missing="$missing $word"
  done
  if [ -z "$missing" ]; then
    pf_pass "$label: offers regenerate / keep / cancel"
  else
    pf_fail "$label: missing option(s):$missing"
  fi
  if printf '%s' "$line" | grep -qiE 'do \*\*not\*\* stop outright|regenerate / keep / cancel'; then
    pf_pass "$label: is no longer a hard stop"
  else
    pf_fail "$label: still reads as a hard stop"
  fi
}

check_output_gate "step 1 (pf-brd: notes.md/brd.md exists)" "$SKILLS/pf-brd/SKILL.md"
check_output_gate "step 2 (pf-spec: specs.md exists)" "$SKILLS/pf-spec/SKILL.md"
check_output_gate "step 3 (pf-test-plan: test_plan.md exists)" "$SKILLS/pf-test-plan/SKILL.md"
check_output_gate "step 4 (pf-impl-plan: implementation_plan.md exists)" "$SKILLS/pf-impl-plan/SKILL.md"

# ─── Step 5: pf-impl-plan's INPUT gate stays a hard stop ──────────────────────

impl_in="$(gate_line "$SKILLS/pf-impl-plan/SKILL.md" '^\*\*Input gate')"
if printf '%s' "$impl_in" | grep -qiE 'hard stop' &&
  printf '%s' "$impl_in" | grep -q 'Run /pf-test-plan first'; then
  pf_pass "step 5: pf-impl-plan's 'test_plan.md must exist' stays a hard stop"
else
  pf_fail "step 5: pf-impl-plan's input gate is no longer a stop"
fi
if printf '%s' "$impl_in" | grep -qiE 'stub is not an input|not complete'; then
  pf_pass "step 5: and a stub does not satisfy it"
else
  pf_fail "step 5: a stub would still satisfy pf-impl-plan's input gate"
fi

# ─── Step 6: pf-execute's prerequisites stay hard stops ───────────────────────

exec_gate="$(gate_line "$SKILLS/pf-execute/SKILL.md" 'Check prerequisites')"
if printf '%s' "$exec_gate" | grep -qiE 'hard stops'; then
  pf_pass "step 6: pf-execute's prerequisites are declared hard stops"
else
  pf_fail "step 6: pf-execute's prerequisites no longer declare themselves stops"
fi
if grep -qiE 'Never execute against a stub' "$SKILLS/pf-execute/SKILL.md"; then
  pf_pass "step 6: pf-execute refuses to run against a stub or a missing test plan"
else
  pf_fail "step 6: pf-execute does not refuse a stub"
fi

# ─── Step 7: 'regenerate' appears in exactly four skills — never in pf-execute ─

regen_files="$(grep -rl 'regenerate' "$SKILLS" 2>/dev/null | LC_ALL=C sort)"
expected_regen="$(
  printf '%s\n' \
    "$SKILLS/pf-brd/SKILL.md" \
    "$SKILLS/pf-impl-plan/SKILL.md" \
    "$SKILLS/pf-spec/SKILL.md" \
    "$SKILLS/pf-test-plan/SKILL.md" | LC_ALL=C sort
)"
if [ "$regen_files" = "$expected_regen" ]; then
  pf_pass "step 7: 'regenerate' occurs in exactly the four output-gate skills"
else
  pf_fail "step 7: 'regenerate' occurs in the wrong set of skills"
  diff <(printf '%s\n' "$expected_regen") <(printf '%s\n' "$regen_files") >&2 || true
fi

if grep -q 'regenerate' "$SKILLS/pf-execute/SKILL.md"; then
  pf_fail "step 7: pf-execute offers to regenerate — it has input gates only"
else
  pf_pass "step 7: pf-execute never offers a choice — input gates only"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== Extra: pf-update names all 15 skills and reconciles .pf-version\n'
# ══════════════════════════════════════════════════════════════════════════════

UPD="$SKILLS/pf-update/SKILL.md"

n_installed="$(find "$SKILLS" -mindepth 2 -maxdepth 2 -name SKILL.md | grep -c . || true)"
# shellcheck disable=SC2016  # backticks are markdown in a grep pattern, not command substitution
n_listed="$(grep -cE '^- `pf(-[a-z-]+)?` —' "$UPD" || true)"
if [ "$n_listed" -eq "$n_installed" ]; then
  pf_pass "pf-update lists every skill that exists ($n_listed of $n_installed)"
else
  pf_fail "pf-update lists $n_listed skill(s), but skills/ holds $n_installed"
fi

# shellcheck disable=SC2016  # backticks are markdown in a grep pattern, not command substitution
if grep -q '`pf-manual-test`' "$UPD"; then
  pf_pass "pf-update names pf-manual-test (the one it used to omit)"
else
  pf_fail "pf-update still omits pf-manual-test"
fi

if grep -q '\.pf-version' "$UPD" && grep -qiE 'converge' "$UPD"; then
  pf_pass "pf-update reconciles the project's .pf-version and points at convergence on drift"
else
  pf_fail "pf-update still updates skills while leaving .pf-version to drift"
fi

# ─── S-5 ──────────────────────────────────────────────────────────────────────

assert_repo_untouched

pf_summary
