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
#
# NOTE — the exclusion of `.qa-workflow.md` itself is load-bearing, and was
# learned the hard way: that file is prose ABOUT the gates, so its text
# necessarily contains the very literals the gates hunt for. Without this
# pathspec, every edit to a gate's own wording trips that gate, and the QA of
# the commit that fixes a gate can never go green. It turned `make test` red once.
TODO_GATE_PATHSPECS=(':!docs/issues/' ':!test/' ':!.qa-workflow.md')

todo_gate() {
  git -C "$TMP_REPO" diff develop...HEAD -- . "${TODO_GATE_PATHSPECS[@]}" |
    grep -E "^\+.*TODO" |
    grep -v 'TODO: Run /pf-' || true
}

# ─── Are we even on an issue branch? ─────────────────────────────────────────
# The whole gate is defined over `git diff develop...HEAD` — the changes THIS
# ISSUE introduces. On `develop` itself (i.e. after the issue is merged and
# closed) that diff is empty by construction: there is no issue diff to gate.
# Steps 1-2 then become meaningless — step 2 in particular plants a probe TODO
# and asserts the gate catches it, which it cannot, because the probe is not in
# an empty diff. Without this guard the suite goes red on the trunk forever
# after the first close. Skip them honestly rather than assert something false.

ON_ISSUE_BRANCH=1
if [ -z "$(git -C "$TMP_REPO" diff develop...HEAD --name-only 2>/dev/null)" ]; then
  ON_ISSUE_BRANCH=0
fi

# ─── Step 1: the amended TODO gate is clean on this branch ────────────────────
# The literal `TODO: Run /pf-` is the stub-recognition rule (defect 5, measure 2)
# and legitimately appears in skills/, in this issue's planning documents and in
# the v2-with-stub fixture. The gate excludes the literal (not skills/ wholesale)
# plus the docs/issues/, test/ and .qa-workflow.md pathspecs.

if [ "$ON_ISSUE_BRANCH" -eq 0 ]; then
  pf_note "steps 1-2: no issue diff against develop — not on an issue branch, nothing to gate"
fi

matches="$(todo_gate)"
if [ -z "$matches" ]; then
  pf_pass "step 1: amended TODO gate is clean on this branch"
else
  pf_fail "step 1: amended TODO gate still fires"
  printf '%s\n' "$matches" | head -10 >&2
fi

# ─── Step 1b: this test's copy of the gate has not drifted from the real one ──
# The test above DUPLICATES the gate command instead of referencing it — the same
# two-sources-of-truth drift this whole issue exists to remove, one level up. We
# cannot eval markdown, so the next best thing is to fail loudly the moment the
# two copies disagree: every pathspec the test uses must appear on the gate's own
# line in .qa-workflow.md, and vice versa.

gate_line="$(grep -F 'No unresolved TODOs' "$QA_FILE" || true)"
drift=""
for ps in "${TODO_GATE_PATHSPECS[@]}"; do
  case "$gate_line" in
    *"$ps"*) ;;
    *) drift="$drift $ps" ;;
  esac
done
if [ -z "$gate_line" ]; then
  pf_fail "step 1b: could not find the TODO gate's line in .qa-workflow.md"
elif [ -n "$drift" ]; then
  pf_fail "step 1b: this test's pathspecs have drifted from the gate in .qa-workflow.md —${drift}"
else
  pf_pass "step 1b: the test's copy of the TODO gate matches .qa-workflow.md (no drift)"
fi

# ─── Step 2: the gate still catches a genuine stray TODO ──────────────────────
# Proves the exclusion is the literal, not the skills/ directory as a whole.

probe_skill="$TMP_REPO/skills/pf-check/SKILL.md"
if [ "$ON_ISSUE_BRANCH" -eq 0 ]; then
  # On develop, HEAD *is* develop — so committing the probe moves `develop` along
  # with `HEAD`, and `develop...HEAD` is empty again. The probe is undetectable
  # not because the gate is blind but because there is no branch to diff against.
  # Asserting anything here would be asserting a property of git, not of the gate.
  :
elif [ -f "$probe_skill" ]; then
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

# What this step must NOT do is assert that some live issue is fully tested.
# It used to: it took the first `docs/issues/open/*/test_plan.md` by sort order
# and failed when that tracker still had `[ ]` rows. But an issue sitting at the
# test-plan stage is a normal, healthy state, so the suite went red because work
# was in progress — a false positive by construction, and one that also punished
# having more than one issue open at a time. Worse, which issue it judged
# depended on alphabetical order, so the verdict moved as issues came and went.
#
# The property that must hold for all time belongs to the GATE, not to any
# issue: the Testing gate counts BOTH `| [ ] |` and `| ✗ |`. That is asserted
# below against `.qa-workflow.md` itself, and the two patterns are then proven
# to work against synthetic trackers — deterministic, and independent of
# whatever happens to be open.

testing_gate="$(sed -n '/^### Testing/,/^### /p' "$QA_FILE")"

if printf '%s' "$testing_gate" | grep -qF "grep -c '| \\[ \\] *|'"; then
  pf_pass "step 6: the Testing gate counts unprocessed rows"
else
  pf_fail "step 6: the Testing gate no longer counts unprocessed rows"
fi

if printf '%s' "$testing_gate" | grep -qF "grep -c '| ✗ *|'"; then
  pf_pass "step 6: the Testing gate counts FAILED rows too — it cannot go green on a plan full of ✗"
else
  pf_fail "step 6: the Testing gate counts only [ ] — it would pass a test plan full of failures"
fi

# The patterns are load-bearing, so prove them rather than trusting them. Three
# synthetic trackers, one per outcome, in a temp dir outside the repository.
tracker_dir="$(mktemp -d)"
printf '| TC-001 | a | Auto | High | [ ]    | |\n' >"$tracker_dir/unprocessed.md"
printf '| TC-001 | a | Auto | High | ✗      | |\n' >"$tracker_dir/failed.md"
printf '| TC-001 | a | Auto | High | ✓      | |\n' >"$tracker_dir/passed.md"

open_probe="$(grep -c '| \[ \] *|' "$tracker_dir/unprocessed.md" || true)"
failed_probe="$(grep -c '| ✗ *|' "$tracker_dir/failed.md" || true)"
clean_open="$(grep -c '| \[ \] *|' "$tracker_dir/passed.md" || true)"
clean_failed="$(grep -c '| ✗ *|' "$tracker_dir/passed.md" || true)"
rm -rf "$tracker_dir"

if [ "${open_probe:-0}" -eq 1 ] && [ "${failed_probe:-0}" -eq 1 ]; then
  pf_pass "step 6: both patterns match the row they are meant to catch"
else
  pf_fail "step 6: a gate pattern does not match its own row (unprocessed=$open_probe, failed=$failed_probe)"
fi

if [ "${clean_open:-0}" -eq 0 ] && [ "${clean_failed:-0}" -eq 0 ]; then
  pf_pass "step 6: neither pattern fires on a fully passing tracker"
else
  pf_fail "step 6: a pattern fires on a passing row — the gate would never let an issue close"
fi

# ─── Step 6b: the same gate, read against whatever is actually open ───────────
# Informational only. A tracker with open rows means an issue is mid-flight, not
# that the framework is broken, so this reports and never fails.

test_plan="$(find "$REPO_ROOT/docs/issues/open" -mindepth 2 -maxdepth 2 \
  -name test_plan.md 2>/dev/null | LC_ALL=C sort | head -1)"
if [ -n "$test_plan" ]; then
  # The Testing gate must be able to see BOTH failure modes, and this assertion
  # is what proves it can. `/pf-test` rewrites a processed row's Status from
  # `[ ]` to `✓` OR `✗` — so once it has run, zero `[ ]` remain *whatever the
  # outcome*. A gate that only counts `[ ]` therefore goes green on a test plan
  # full of failures: meaninglessly green, passing because the tests were RUN,
  # not because they PASSED. The gate counts both, so this asserts both.
  #
  # (An earlier version of this step demanded the tracker still use `[ ]`/`[x]`
  # syntax. That contradicted /pf-test's own documented behaviour and turned red
  # the moment the tracker was legitimately filled in — the assertion was wrong,
  # not the tracker.)
  open_rows="$(grep -c '| \[ \] *|' "$test_plan" || true)"
  failed_rows="$(grep -c '| ✗ *|' "$test_plan" || true)"
  done_rows="$(grep -c '| ✓ *|' "$test_plan" || true)"

  issue_name="$(basename "$(dirname "$test_plan")")"
  pf_note "step 6b: $issue_name — ${done_rows} passed, ${failed_rows} failed, ${open_rows} unprocessed"
  if [ "${open_rows:-0}" -gt 0 ]; then
    pf_note "step 6b: that issue is mid-pipeline; /pf-qa is what blocks ITS closure, not this suite"
  fi
else
  pf_note "step 6b: no docs/issues/open/*/test_plan.md — nothing to report"
fi

# ─── Step 7: the real working tree was never touched (S-5) ────────────────────

assert_repo_untouched

# ─── TC-038: the Makefile exposes converge and nothing else ───────────────────
# Added at /pf-test time: TC-038 is typed Auto in the Status Tracker but Task 9
# verified it by hand and left no test behind. An Auto row with no automation is
# the same silent hole this whole issue exists to close, so it gets one.

echo ""
echo "=== TC-038: Makefile targets"

mk_dryrun="$(make -C "$REPO_ROOT" -n converge TARGET=/tmp/pf-tc038 2>/dev/null || true)"
case "$mk_dryrun" in
  *--target\ /tmp/pf-tc038*) pf_pass "step 1: make converge TARGET=<dir> forwards --target" ;;
  *)                         pf_fail "step 1: make converge TARGET=<dir> did not forward --target (got: ${mk_dryrun})" ;;
esac

mk_bare="$(make -C "$REPO_ROOT" -n converge 2>/dev/null || true)"
case "$mk_bare" in
  *--target*) pf_fail "step 2: bare 'make converge' must not invent a --target (got: ${mk_bare})" ;;
  *converge*) pf_pass "step 2: bare 'make converge' runs the script with no --target" ;;
  *)          pf_fail "step 2: bare 'make converge' does not run the convergence script" ;;
esac

for dead in setup-v2 setup-v3 migrate-v1-to-v2 migrate-v2-to-v3; do
  if make -C "$REPO_ROOT" -n "$dead" >/dev/null 2>&1; then
    pf_fail "step 3: target '${dead}' still exists — it was deleted in Phase IV"
  else
    pf_pass "step 3: target '${dead}' is gone"
  fi
done

if grep -qE '^\.PHONY:.*\bconverge\b' "$REPO_ROOT/Makefile"; then
  pf_pass "step 4: converge is declared .PHONY"
else
  pf_fail "step 4: converge is missing from .PHONY"
fi

# NB: capture first, then match. lib.sh runs with `set -o pipefail`, and
# `make … | grep -q` fails with rc 141 precisely WHEN it matches: grep -q closes
# the pipe on the first hit, make takes SIGPIPE, and pipefail surfaces make's
# 141 instead of grep's 0. The harder the assertion bites, the redder it goes.
mk_help="$(make -C "$REPO_ROOT" help 2>/dev/null || true)"
case "$mk_help" in
  *converge*) pf_pass "step 5: make help advertises converge" ;;
  *)          pf_fail "step 5: make help does not mention converge" ;;
esac

pf_summary
