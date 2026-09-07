#!/usr/bin/env bash
# test/shell-options.sh — the suite runner's own shell options.
#
# Guards one specific defect: `set -o pipefail` in test/lib.sh made the whole
# suite flap between OK and FAILED on an unchanged tree.
#
# The mechanism, measured 2026-09-07 rather than reasoned about. Assertions here
# are overwhelmingly of the shape
#
#     printf '%s' "$text" | grep -qF 'needle'
#
# and `grep -q` exits the moment it matches, closing the read end of the pipe.
# The writer's remaining write() then fails with EPIPE and the kernel kills it
# with SIGPIPE (exit 141) — this happens whatever the input size, because EPIPE
# is about the reader being gone, not about the pipe buffer being full. With
# pipefail, that 141 becomes the exit status of the entire pipeline, so a
# pipeline that DID match reports failure. Whether it happens at all is a race
# between the writer finishing its write and the reader exiting.
#
# Measured against skills/pf-execute/SKILL.md (38 KB, match on line 64 of 247):
# 3 false failures in 500 calls (~0.6%), `PIPESTATUS=141 0` on the failing ones
# — the writer signalled, the reader perfectly happy. Across the ~236 pipelines
# in test/ that end in an early-exiting reader, that per-call rate made a full
# `make test` fail roughly one run in three. It also reaches pipelines that have
# no printf in them at all, such as `git log ... | head -1`, where `head` closes
# the pipe on git the same way.
#
# pipefail was buying very little here in exchange: these are assertions, and
# what they assert is the READER's verdict. A producer that genuinely failed
# would yield empty output, which fails the assertion on its own.
#
# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

printf '=== Suite shell options: pipefail must stay off (SIGPIPE false failures)\n'

cd "$REPO_ROOT" || exit 1

# ─── Step 1: the mechanism, demonstrated deterministically ────────────────────
#
# `yes` never ends, so `head -1` always closes the pipe under a writer that
# still has more to write: the SIGPIPE here is certain, not probabilistic. That
# makes this a real demonstration of the conversion rather than a re-run of the
# flaky race — if this step ever stops showing 141, the premise behind removing
# pipefail has changed and the decision deserves revisiting.

sigpipe_status="$(bash -c 'set +o pipefail; yes 2>/dev/null | head -1 >/dev/null; echo "${PIPESTATUS[0]}"')"
if [ "$sigpipe_status" = "141" ]; then
  pf_pass "step 1: an early-exiting reader really does SIGPIPE its writer (status 141)"
else
  pf_fail "step 1: expected the writer to die with 141, got '$sigpipe_status' — the premise for this suite no longer holds"
fi

with_pipefail="$(bash -c 'set -o pipefail; yes 2>/dev/null | head -1 >/dev/null; echo $?')"
if [ "$with_pipefail" = "141" ]; then
  pf_pass "step 2: with pipefail, that SIGPIPE becomes the whole pipeline's status — a matching pipeline reports failure"
else
  pf_fail "step 2: expected pipefail to surface 141 as the pipeline status, got '$with_pipefail'"
fi

without_pipefail="$(bash -c 'set +o pipefail; yes 2>/dev/null | head -1 >/dev/null; echo $?')"
if [ "$without_pipefail" = "0" ]; then
  pf_pass "step 3: without pipefail, the reader's verdict is the pipeline's status — the false failure is gone"
else
  pf_fail "step 3: expected 0 without pipefail, got '$without_pipefail'"
fi

# ─── Step 2: the guard itself ─────────────────────────────────────────────────
#
# Read as text rather than by probing the running shell's options: this suite
# sources lib.sh, so `set -o` here would answer for this process and say nothing
# about what a future edit put in the file. The point is to stop pipefail being
# re-added, which is a property of the source.

lib_text="$(cat test/lib.sh)"

if grep -qE '^[[:space:]]*set[[:space:]]+[-+][a-z]*o?[[:space:]]*pipefail|^[[:space:]]*set[[:space:]]+-[a-z]*o[[:space:]]+pipefail' <<< "$lib_text"; then
  pf_fail "step 4: test/lib.sh enables pipefail — every assertion whose reader exits early (grep -q, head, grep -m) can then report a false failure"
else
  pf_pass "step 4: test/lib.sh does not enable pipefail"
fi

# `set -u` is the half worth keeping, and removing pipefail must not quietly
# take it along: an unset variable in an assertion is a real defect in the test.
if grep -qE '^[[:space:]]*set[[:space:]]+-[a-z]*u' <<< "$lib_text"; then
  pf_pass "step 5: test/lib.sh still sets -u (unset variables stay an error)"
else
  pf_fail "step 5: test/lib.sh no longer sets -u — removing pipefail must not drop the nounset guard with it"
fi

# No suite may re-introduce it locally either; a single `set -o pipefail` in one
# file would bring the flake back for that file alone, which is harder to find
# than the original because only one suite would flap.
offenders=""
for suite in test/*.sh; do
  case "$suite" in */lib.sh) continue ;; esac
  case "$suite" in */shell-options.sh) continue ;; esac  # this file discusses it
  if grep -qE '^[[:space:]]*set[[:space:]]+[-][a-z]*o[[:space:]]+pipefail' "$suite"; then
    offenders="$offenders $suite"
  fi
done
if [ -z "$offenders" ]; then
  pf_pass "step 6: no individual suite turns pipefail back on for itself"
else
  pf_fail "step 6: pipefail re-enabled in:$offenders"
fi

pf_summary
