#!/usr/bin/env bash
# test/qa-gates.sh — TC-041: the framework's own QA gates do not block this
# issue (Р6), and have not lost their catching power in the process.
#
# Runs on a COPY of the repository ($TMP_REPO, S-5): step 2 must *introduce* a
# stray TODO and commit it, and a test dying half-way must never leave the real
# working tree dirty (which would fail the `Working tree clean` gate).

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

printf '=== TC-041: framework QA gates do not block this issue (Р6)\n'

QA_FILE="$REPO_ROOT/.qa-workflow.md"
TMP_REPO="$(pf_repo_copy)"

# The amended TODO gate, verbatim, executed inside the repo copy.
todo_gate() {
  git -C "$TMP_REPO" diff develop...HEAD -- . ':!docs/issues/' ':!test/' |
    grep -E "^\+.*TODO" |
    grep -v 'TODO: Run /pf-' || true
}

# ─── Step 1: the amended TODO gate is clean on this branch ────────────────────
# The literal `TODO: Run /pf-` is the stub-recognition rule (defect 5, measure 2)
# and legitimately appears in skills/, in this issue's planning documents and in
# the v2-with-stub fixture. The gate excludes the literal (not skills/ wholesale)
# plus the docs/issues/ and test/ pathspecs.

matches="$(todo_gate)"
if [ -z "$matches" ]; then
  pf_pass "step 1: amended TODO gate is clean on this branch"
else
  pf_fail "step 1: amended TODO gate still fires"
  printf '%s\n' "$matches" | head -10 >&2
fi

# ─── Step 2: the gate still catches a genuine stray TODO ──────────────────────
# Proves the exclusion is the literal, not the skills/ directory as a whole.

probe_skill="$TMP_REPO/skills/pf-check/SKILL.md"
if [ -f "$probe_skill" ]; then
  printf '\nTODO: refactor later\n' >>"$probe_skill"
  git -C "$TMP_REPO" add skills/pf-check/SKILL.md
  git -C "$TMP_REPO" \
    -c user.name='PF Test' -c user.email='pf-test@example.invalid' \
    commit -q -m 'test(TC-041): inject a stray marker into a skill' || true

  matches="$(todo_gate)"
  if [ -n "$matches" ]; then
    pf_pass "step 2: the gate still catches a stray TODO inside skills/"
  else
    pf_fail "step 2: the gate is blind — skills/ appears to be excluded wholesale"
  fi
else
  pf_fail "step 2: skills/pf-check/SKILL.md not found in the repo copy"
fi

# ─── Step 3: Project Scope Guard with the widened whitelist ───────────────────
# Fixture .js files and bash tests under test/ are not product code.

scope="$(
  git -C "$TMP_REPO" diff --name-only develop...HEAD |
    grep -vE '^(tools|test)/' |
    grep -E '\.(tsx?|jsx?|py|rb|go|sql)$|^\.github/workflows/' || true
)"
if [ -z "$scope" ]; then
  pf_pass "step 3: Project Scope Guard is clean with the '^(tools|test)/' whitelist"
else
  pf_fail "step 3: Project Scope Guard fires on: $(printf '%s' "$scope" | tr '\n' ' ')"
fi

# ─── Step 4: 'No unrelated changes' names implementation_plan.md for bugs ─────
# A bug issue above trivial tier has no specs.md and no notes.md — ever. The
# pre-amendment gate compared the diff against files that cannot exist.

if grep -q 'No unrelated changes' "$QA_FILE" &&
  grep -qE 'No unrelated changes.*implementation_plan\.md' "$QA_FILE"; then
  pf_pass "step 4: 'No unrelated changes' points bug issues at implementation_plan.md"
else
  pf_fail "step 4: 'No unrelated changes' does not name implementation_plan.md"
fi

# ─── Step 5: the Feature-Issues scope line is untouched ───────────────────────
# It lives under '## Feature Issues (feat, improve)' and does not apply to bugs.

if grep -qE 'Diff matches declared scope.*specs\.md' "$QA_FILE"; then
  pf_pass "step 5: the Feature Issues 'Diff matches declared scope' line is unchanged"
else
  pf_fail "step 5: the Feature Issues 'Diff matches declared scope' line was altered"
fi

# ─── Step 6: the Testing gate's pattern matches the Status Tracker (KI-10) ────
# The gate counts `| [ ] |` rows. If the tracker used PASS/FAIL, the gate would
# return 0 from day one and be meaninglessly green. What must hold for all time
# is the *syntax*: the Status column uses `[ ]`/`[x]`. Counting only unchecked
# rows would, by construction, go red once the tracker is fully filled in.

test_plan="$(find "$REPO_ROOT/docs/issues/open" -mindepth 2 -maxdepth 2 \
  -name test_plan.md 2>/dev/null | LC_ALL=C sort | head -1)"
if [ -n "$test_plan" ]; then
  rows="$(grep -cE '\| \[[ x]\] *\|' "$test_plan" || true)"
  open_rows="$(grep -c '| \[ \] *|' "$test_plan" || true)"
  if [ "${rows:-0}" -gt 0 ]; then
    pf_pass "step 6: Status Tracker uses the [ ]/[x] syntax the Testing gate greps for (${rows} rows, ${open_rows} still open)"
  else
    pf_fail "step 6: Status Tracker does not use [ ]/[x] — the Testing gate would be meaninglessly green"
  fi
else
  pf_note "step 6: no docs/issues/open/*/test_plan.md — nothing to check"
fi

# ─── Step 7: the real working tree was never touched (S-5) ────────────────────

assert_repo_untouched

pf_summary
