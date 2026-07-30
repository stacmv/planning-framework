#!/usr/bin/env bash
# test/pf-close.sh — TC-001..TC-005 for issue
# 20260729-bug-pf-close-parent-branch-and-usage-window.
#
# Two silent defects in skills/pf-close/SKILL.md:
#   Defect 1 (Phase 3): a self-tracking upstream (branch.issue/<ID>.merge ==
#     refs/heads/issue/<ID>, left behind by `git push -u` on the issue branch)
#     was read as PARENT-BRANCH, so the close merged the branch into itself and
#     pushed the wrong branch, never touching develop.
#   Defect 2 (Phase 6): START-TS was read from `-- docs/issues/closed/ISSUE-ID`,
#     a path that only enters git history at the Phase 8 archive commit — so at
#     Phase 6 the command was always empty and the usage window never computed.
#
# TC-001..004 are BEHAVIOURAL: they build a throwaway git repo from the
# pf-close-basic fixture (via pf_setup_case … --git, never pf_repo_copy) and
# exercise the corrected logic, hardcoded here in bash. TC-005 is the DRIFT
# GUARD: it greps skills/pf-close/SKILL.md so this hardcoded copy cannot silently
# diverge from the skill text (same pattern as test/qa-gates.sh step 1b /
# test/skills-static.sh). Read-only w.r.t. the framework tree (S-5).

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

FIXTURE="pf-close-basic"
ID="20260101-bug-close-fixture"
SKILL="$REPO_ROOT/skills/pf-close/SKILL.md"

# resolve_parent_branch <repo> <issue-id> — the CORRECTED Phase 3 step 1-2,
# transcribed to bash. TC-005 guards it against the skill text.
resolve_parent_branch() {
  local dir="$1" id="$2" merge
  merge="$(git -C "$dir" config "branch.issue/$id.merge" 2>/dev/null || true)"
  # Self-tracking upstream guard: empty / failed / == the issue branch itself.
  if [ -z "$merge" ] || [ "$merge" = "refs/heads/issue/$id" ]; then
    if git -C "$dir" branch --list develop | grep -q .; then
      printf 'develop'
    else
      printf 'main'
    fi
  else
    printf '%s' "${merge#refs/heads/}"
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-001: a self-tracking upstream must not masquerade as PARENT-BRANCH\n'
# ══════════════════════════════════════════════════════════════════════════════
# The exact regression: branch.issue/<ID>.merge points at the issue branch
# itself. The old code returned issue/<ID>; the fix must fall through to develop.
d="$(pf_setup_case "$FIXTURE" --git)"
git -C "$d" branch develop
git -C "$d" branch "issue/$ID"
git -C "$d" config "branch.issue/$ID.merge" "refs/heads/issue/$ID"
got="$(resolve_parent_branch "$d" "$ID")"
if [ "$got" = "develop" ]; then
  pf_pass "TC-001: self-tracking upstream ignored, PARENT-BRANCH = develop"
else
  pf_fail "TC-001: PARENT-BRANCH = '$got' (want develop) — self-tracking upstream leaked through"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-002: a legitimate develop-tracking upstream still resolves\n'
# ══════════════════════════════════════════════════════════════════════════════
# The guard must only fire on self-tracking; a real parent pointer is honoured.
d="$(pf_setup_case "$FIXTURE" --git)"
git -C "$d" branch develop
git -C "$d" branch "issue/$ID"
git -C "$d" config "branch.issue/$ID.merge" "refs/heads/develop"
got="$(resolve_parent_branch "$d" "$ID")"
if [ "$got" = "develop" ]; then
  pf_pass "TC-002: legitimate develop-tracking honoured, PARENT-BRANCH = develop"
else
  pf_fail "TC-002: PARENT-BRANCH = '$got' (want develop) — the guard over-fired"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-003: no upstream and no develop -> literal main fallback\n'
# ══════════════════════════════════════════════════════════════════════════════
# Phase 3 step 2 assigns the LITERAL string "main" when develop is absent — it
# does not consult the fixture's real default branch name (main vs master).
d="$(pf_setup_case "$FIXTURE" --git)"
git -C "$d" branch "issue/$ID"
# no develop branch created, no branch.merge config set
got="$(resolve_parent_branch "$d" "$ID")"
if [ "$got" = "main" ]; then
  pf_pass "TC-003: fallback to literal main when develop is absent"
else
  pf_fail "TC-003: PARENT-BRANCH = '$got' (want the literal main)"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-004: usage-window START-TS reads the open/ path, not closed/\n'
# ══════════════════════════════════════════════════════════════════════════════
# Reproduce the real Phase 5/6 ordering: the issue lived under docs/issues/open/
# for its whole history, Phase 5 moved it to closed/ in the WORKING TREE only
# (uncommitted), and the archive commit (Phase 8) has not happened yet.
d="$(pf_setup_case "$FIXTURE" --git)"
# TS1 = the root (baseline) commit pf_git_init made, which already contains
# docs/issues/open/<ID>/prompt.md — the first commit on the open/ path.
ts1="$(git -C "$d" log --max-parents=0 --format=%aI | head -1)"
# A second commit on the open/ path. pf_git_init sets identity only for its own
# commit, so this one MUST carry its own identity or it fails on a clean CI.
printf '\nsecond edit\n' >>"$d/docs/issues/open/$ID/prompt.md"
git -C "$d" -c user.name='pf-test' -c user.email='pf-test@example.invalid' \
  commit -q -a -m 'second edit on open path'
# Phase 5: move open/ -> closed/ in the working tree only (NOT committed).
mkdir -p "$d/docs/issues/closed"
mv "$d/docs/issues/open/$ID" "$d/docs/issues/closed/$ID"

# The CORRECTED Phase 6 command (open/), and the OLD buggy one (closed/).
fixed="$(git -C "$d" log --reverse --format=%aI -- "docs/issues/open/$ID" | head -1)"
old="$(git -C "$d" log --reverse --format=%aI -- "docs/issues/closed/$ID" | head -1)"

# "empty" here means: empty `git log` OUTPUT (no archive commit in history yet).
# It is NOT a claim about the filesystem — after the mv, closed/<ID>/ physically
# holds the files.
if [ -n "$fixed" ] && [ "$fixed" = "$ts1" ]; then
  pf_pass "TC-004: corrected command returns the first open/-path commit ($fixed)"
else
  pf_fail "TC-004: corrected command returned '$fixed' (want first-commit TS '$ts1')"
fi
if [ -z "$old" ]; then
  pf_pass "TC-004: the old closed/-path command yields empty git-log output (the bug)"
else
  pf_fail "TC-004: old closed/-path command returned '$old' — expected empty git-log output"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-005: drift guard — the hardcoded commands still match SKILL.md\n'
# ══════════════════════════════════════════════════════════════════════════════
# TC-001..004 hardcode the corrected git commands. If a future edit changes
# Phase 3/Phase 6 in the skill without updating this suite, these greps catch it.

# Defect 2: the corrected START-TS command reads the open/ path...
if grep -qF -- '--format=%aI -- docs/issues/open/ISSUE-ID' "$SKILL"; then
  pf_pass "TC-005: Phase 6 documents the corrected open/-path START-TS command"
else
  pf_fail "TC-005: Phase 6 no longer documents '--format=%aI -- docs/issues/open/ISSUE-ID' — drift"
fi
# ...and the old closed/-path form is gone (anchored on the whole command, since
# the bare path docs/issues/closed/ISSUE-ID legitimately appears elsewhere).
if grep -qF -- '--format=%aI -- docs/issues/closed/ISSUE-ID' "$SKILL"; then
  pf_fail "TC-005: the buggy '--format=%aI -- docs/issues/closed/ISSUE-ID' command is still present"
else
  pf_pass "TC-005: the buggy closed/-path START-TS command is gone"
fi
# Defect 1: the self-tracking-upstream guard is documented in Phase 3.
if grep -qF -- 'Self-tracking upstream guard' "$SKILL"; then
  pf_pass "TC-005: Phase 3 documents the Self-tracking upstream guard"
else
  pf_fail "TC-005: Phase 3 no longer documents the 'Self-tracking upstream guard' anchor — drift"
fi

# ─── S-5 ──────────────────────────────────────────────────────────────────────
assert_repo_untouched

pf_summary
