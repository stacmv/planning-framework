#!/usr/bin/env bash
# @pf-issue [20260902-feat-idea-stage]
# test/pf-idea-templates-mirror.sh — TC-026 step 1 (specs-part3.md §8.3;
# implementation_plan.md Task 18).
#
# decision (C) of specs-part1.md §1.1: docs/planning/templates/ is the single
# source of the project scaffold, and skills/pf/templates/project/ is a
# byte-for-byte copy of it — the copy an installed `pf` skill scaffolds a
# fresh project from when the framework repository itself is unavailable
# (CONTRIBUTING.md, "Any edit to docs/planning/templates/ must be mirrored
# byte-for-byte into skills/pf/templates/project/ (and vice versa)"). This is
# the ONE test that directly checks that decision: without it, the two trees
# could silently drift apart the next time either is edited.
#
# Same pattern as test/lib.sh's T6 (docs/planning/templates/ mirror check for
# a converged consumer project, ~line 637) applied to the framework-repo ->
# `pf`-skill pair instead of the framework-repo -> consumer-project pair.
#
# TC-026 step 2/3 (the "28"/skill-name doc counters, and the README.md
# historical release-note check) live in test/pf-idea-stage-static.sh per
# implementation_plan.md Task 18 — this file covers step 1 only.
#
# Read-only. It runs no script, touches no $HOME, and mutates nothing.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

printf '=== TC-026 step 1: docs/planning/templates/ mirrors skills/pf/templates/project/ byte-for-byte\n'

FRAMEWORK_TEMPLATES="$REPO_ROOT/docs/planning/templates"
SKILL_TEMPLATES="$REPO_ROOT/skills/pf/templates/project"

if [ ! -d "$FRAMEWORK_TEMPLATES" ]; then
  pf_fail "TC-026: $FRAMEWORK_TEMPLATES does not exist"
elif [ ! -d "$SKILL_TEMPLATES" ]; then
  pf_fail "TC-026: $SKILL_TEMPLATES does not exist"
elif mirror_diff="$(diff -r "$FRAMEWORK_TEMPLATES" "$SKILL_TEMPLATES" 2>&1)"; then
  pf_pass "TC-026: skills/pf/templates/project/ mirrors docs/planning/templates/ byte-for-byte"
else
  pf_fail "TC-026: skills/pf/templates/project/ is NOT a byte-for-byte mirror of docs/planning/templates/"
  printf '%s\n' "$mirror_diff" >&2
fi

pf_summary
