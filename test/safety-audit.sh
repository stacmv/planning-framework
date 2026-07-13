#!/usr/bin/env bash
# test/safety-audit.sh — TC-032: nothing under test/ invokes the convergence
# script directly.
#
# Rule S-1 is worthless if it can be broken by inattention. The convergence
# script installs skills into ~/.claude/skills/ and REWRITES ~/.claude/bin/pf —
# a single test that runs it against the developer's real $HOME destroys their
# global install and every concurrent Claude Code session. So the breach is
# caught by a TEST, not by a reviewer: the mere fact that the script's name shows
# up in test/ outside lib.sh is itself the defect.
#
# This suite reads files. It never runs the convergence script.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

printf '=== TC-032: S-1 audit — the single gateway to the convergence script\n'

TEST_DIR="$PF_LIB_DIR"

# Every needle below is assembled from fragments, so that this auditor never
# becomes the extra occurrence it is hunting for: a reviewer who greps test/ for
# the script's file name by hand must get test/lib.sh and nothing else — this
# file included.
SCRIPT_NAME="converge""-to-v3"
EXEC_NAME="_pf""_converge_exec"
WRAPPER_NAME="pf""_run_converge"

# ─── Step 1: exactly one file under test/ names the script ────────────────────

files="$(grep -rl -- "$SCRIPT_NAME" "$TEST_DIR" 2>/dev/null | LC_ALL=C sort)"
n_files="$(printf '%s' "$files" | grep -c . || true)"

if [ "$n_files" -eq 1 ] && [ "$files" = "$TEST_DIR/lib.sh" ]; then
  pf_pass "step 1: only test/lib.sh names the convergence script"
else
  pf_fail "step 1: $n_files file(s) under test/ name the convergence script (want exactly test/lib.sh)"
  printf '%s\n' "$files" >&2
fi

# ─── Step 2: it occurs exactly once inside lib.sh ─────────────────────────────
# Once, inside the private exec function, built from a variable so that
# PF_FRAMEWORK_ROOT can point the run at a repo copy (TC-009 step 4) without a
# second literal appearing.

n_occ="$(grep -c -- "$SCRIPT_NAME" "$TEST_DIR/lib.sh" || true)"
if [ "$n_occ" -eq 1 ]; then
  pf_pass "step 2: exactly one occurrence of the name inside test/lib.sh"
else
  pf_fail "step 2: $n_occ occurrences inside test/lib.sh (want exactly 1)"
fi

# ─── Step 3: HOME is overridden on the path of every wrapper ──────────────────

# shellcheck disable=SC2016  # this is a grep pattern, not a string to expand
if grep -qE 'HOME="\$TMP_HOME"[[:space:]]+bash' "$TEST_DIR/lib.sh"; then
  pf_pass "step 3: the private exec function exports HOME=\$TMP_HOME on the single call path"
else
  pf_fail "step 3: the one call site does not set HOME=\$TMP_HOME — the real \$HOME is reachable"
fi

if awk -v fn="^${EXEC_NAME}\\\\(\\\\)" '$0 ~ fn, /^}/' "$TEST_DIR/lib.sh" | grep -q 'TMP_HOME'; then
  pf_pass "step 3b: the HOME override lives inside the private exec function itself"
else
  pf_fail "step 3b: the HOME override is not inside the private exec function"
fi

# ─── Step 4: the suites really do go through the wrappers ─────────────────────

n_calls="$(grep -rE "${WRAPPER_NAME}(_interactive|_cwd)?\b" "$TEST_DIR"/*.sh 2>/dev/null |
  grep -v '^[^:]*/lib\.sh:' |
  grep -cv '^[^:]*:[[:space:]]*#' || true)"
if [ "$n_calls" -gt 0 ]; then
  pf_pass "step 4: the wrappers are actually used by the suites ($n_calls call sites)"
else
  pf_fail "step 4: no suite calls the wrappers — the gateway is decorative"
fi

# ─── Step 5: the private exec is never called from a suite ────────────────────

leaks="$(grep -rn -- "$EXEC_NAME" "$TEST_DIR"/*.sh 2>/dev/null |
  grep -v '^[^:]*/lib\.sh:' || true)"
if [ -z "$leaks" ]; then
  pf_pass "step 5: the private exec function is never called from test/*.sh"
else
  pf_fail "step 5: the private exec function is called outside lib.sh"
  printf '%s\n' "$leaks" >&2
fi

# ─── Step 6: temp dirs come from mktemp -d and are removed by a trap (S-4) ────

if grep -q 'mktemp -d' "$TEST_DIR/lib.sh" && grep -qE '^trap .* EXIT' "$TEST_DIR/lib.sh"; then
  pf_pass "step 6: temp dirs are mktemp -d and cleaned up by trap … EXIT"
else
  pf_fail "step 6: lib.sh lacks mktemp -d and/or trap … EXIT"
fi

# ─── Extra: only lib.sh is allowed to bind HOME ───────────────────────────────
# The hazard is a suite that *sets* HOME (or forgets to, and inherits the real
# one). Binding it is lib.sh's job alone; a suite doing it by hand is how the
# override drifts out of the single call path. Grepping for the string "$HOME"
# instead would fire on prose in a heading, so the check is on assignments.

rogue="$(grep -rnE '(^|[[:space:];&|(])(export[[:space:]]+)?HOME=' "$TEST_DIR"/*.sh 2>/dev/null |
  grep -v '^[^:]*/lib\.sh:' |
  grep -v '^[^:]*/safety-audit\.sh:' || true)"
if [ -z "$rogue" ]; then
  pf_pass "extra: no suite binds HOME by hand — only lib.sh does"
else
  pf_fail "extra: a suite binds HOME itself, off the single call path"
  printf '%s\n' "$rogue" >&2
fi

pf_summary
