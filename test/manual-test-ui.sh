#!/usr/bin/env bash
# test/manual-test-ui.sh — the Manual Test UI suite: TC-001, TC-015, TC-016.
#
# TC-016 comes first and is load-bearing for the whole automated half of this
# issue. /pf-test runs exactly ONE runner — `make test` — and until now that
# target's node half globbed `tools/onboarding-tui/test/*.test.js` alone. The
# suites under tools/manual-test-ui/test/ therefore never executed: the existing
# checklist-ru.test.js had never run once, no Auto case could reach the Status
# Tracker, and the `.qa-workflow.md` gate had nothing to read.
#
# The recipe is inspected through `make -n test` (print, do not execute) rather
# than by running it: a recursive `make test` from inside its own run would
# re-enter this very suite.
#
# Read-only. It runs no installer, touches no $HOME, and mutates nothing.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

MAKEFILE="$REPO_ROOT/Makefile"
UI_GLOB='tools/manual-test-ui/test/*.test.js'
TUI_GLOB='tools/onboarding-tui/test/*.test.js'
# The section header /pf-test keys on when it splits `make test` output into
# runners. Without it the manual-test-ui results are indistinguishable from the
# onboarding-tui ones in a single flat log.
UI_HEADER='=== node --test tools/manual-test-ui/test/'

# test_target — the body of the `test:` target exactly as written in the
# Makefile (the target ends at the first empty line, before `test-ui:`).
test_target() { sed -n '/^test:/,/^$/p' "$MAKEFILE"; }

# make_recipe — what make WOULD run for `test`, printed and never executed.
make_recipe() { make -C "$REPO_ROOT" -n test 2>&1; }

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-016: `make test` runs the Manual Test UI node suites\n'
# ══════════════════════════════════════════════════════════════════════════════

# ─── Step 1: the glob is in the `test` target, not merely somewhere in the file ─

if test_target | grep -qF -- "$UI_GLOB"; then
  pf_pass "step 1: the test target globs tools/manual-test-ui/test/*.test.js"
else
  pf_fail "step 1: the test target does not glob $UI_GLOB"
fi

# ─── Steps 2, 3, 6: the printed recipe ────────────────────────────────────────

recipe="$(make_recipe)"

# The invocation line, and only it: the section header printed just above it
# also mentions `node --test` and the directory, so the printf line is excluded.
ui_line="$(printf '%s\n' "$recipe" |
  grep -E 'node --test[[:space:]]+"?tools/manual-test-ui/test/\*\.test\.js"?' |
  grep -v 'printf' || true)"

if [ -n "$ui_line" ]; then
  pf_pass "step 2: make -n test prints the node --test invocation for manual-test-ui"
else
  pf_fail "step 2: make -n test prints no node --test invocation for $UI_GLOB"
fi

if printf '%s\n' "$recipe" | grep -qF -- "$UI_HEADER"; then
  pf_pass "step 3: the recipe prints a === node --test tools/manual-test-ui/test/ header"
else
  pf_fail "step 3: the recipe prints no '$UI_HEADER' header — /pf-test cannot tell the section apart"
fi

# ─── Step 4: the suites actually run, and they pass ───────────────────────────
# The same command the recipe carries, run directly. The glob is quoted: node
# expands it itself, so an empty directory is node's error and not a bash one.

ui_rc=0
ui_out="$(cd "$REPO_ROOT" && node --test "$UI_GLOB" 2>&1)" || ui_rc=$?

if [ "$ui_rc" -eq 0 ] &&
  printf '%s\n' "$ui_out" | grep -qF -- 'checklist-ru.test.js' &&
  printf '%s\n' "$ui_out" | grep -qE '^# fail 0$'; then
  pf_pass "step 4: the manual-test-ui node suites run and exit 0"
else
  pf_fail "step 4: the manual-test-ui node suites did not run clean (exit $ui_rc)"
  printf '%s\n' "$ui_out" | tail -20 >&2
fi

# ─── Step 5: the onboarding-tui branch is untouched ───────────────────────────

if printf '%s\n' "$recipe" | grep -qF -- "$TUI_GLOB"; then
  pf_pass "step 5: the onboarding-tui suites are still in the recipe"
else
  pf_fail "step 5: the recipe lost $TUI_GLOB"
fi

# ─── Step 6: a failing suite propagates ───────────────────────────────────────
# `|| rc=1` and not `;`: a red manual-test-ui suite must make the whole
# `make test` red, otherwise the gate reads a green run over a broken tool.

if printf '%s\n' "$ui_line" | grep -qF -- '|| rc=1'; then
  pf_pass "step 6: a failing manual-test-ui suite makes make test fail"
else
  pf_fail "step 6: the manual-test-ui invocation does not feed its exit code into rc"
fi

assert_repo_untouched

pf_summary
