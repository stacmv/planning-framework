#!/usr/bin/env bash
# test/zz-fixture-tc-link-check.sh — TC-001, TC-002 (zz-fixture-tc-link).
#
# Fixture suite. Each case is shaped to discriminate one way the matching rule
# can be got wrong:
#
#   TC-001 — two labels, both pass. The second check's if/else branches carry
#            DIFFERENT text, so the failure-form string exists in the source
#            but is never printed. A rule demanding that every collected
#            label appear would wrongly leave this case unmatched.
#   TC-002 — one label passes, one fails unconditionally. A rule that records
#            only a single label per case would see the passing one and
#            wrongly report success.
#   TC-003 — deliberately absent here. Declared Auto in the plan, no label
#            printed by anything in this file.
#
# The banner printf under each heading is deliberate too: it names the case
# but is printed unconditionally, carrying no verdict.
#
# Read-only. It runs no script, touches no $HOME, and mutates nothing.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

FIXTURE_PLAN="$REPO_ROOT/docs/issues/open/zz-fixture-tc-link/test_plan.md"

printf '=== TC-001: every label of a case passes\n'

if [ -f "$FIXTURE_PLAN" ]; then
  pf_pass "TC-001 step 1: the fixture plan is present"
else
  pf_fail "TC-001 step 1: the fixture plan is present"
fi

# Deliberately DIFFERENT text in the two branches: the failure form below is a
# string the source carries but the run never prints, because this branch does
# not execute.
if grep -q 'Status Tracker' "$FIXTURE_PLAN" 2>/dev/null; then
  pf_pass "TC-001 step 2: the fixture plan carries a Status Tracker"
else
  pf_fail "TC-001 step 2: the fixture plan has no Status Tracker section"
fi

printf '=== TC-002: one label fails while another passes\n'

if [ -f "$FIXTURE_PLAN" ]; then
  pf_pass "TC-002 step 1: precondition holds, the fixture plan is readable"
else
  pf_fail "TC-002 step 1: precondition holds, the fixture plan is readable"
fi

# Deliberate, unconditional failure. Remove this line for run B.
pf_fail "TC-002 step 4: deliberate failure - one label of this case reports failure"

pf_summary
