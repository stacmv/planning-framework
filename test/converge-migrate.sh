#!/usr/bin/env bash
# test/converge-migrate.sh — the v2-TRANSFER paths: phase 2 (backup), phase 3
# (per-file transfer with the git-mv fallback) and phase 5 (whitelist deletion).
#
# TC-004, TC-006, TC-007, TC-008, TC-016, TC-017, TC-018, TC-019, TC-022,
# TC-056, TC-057.
#
# This is the first suite that drives convergence over a REAL v2 layout — the
# very case on which today's migrate-v2-to-v3.sh is a guaranteed no-op with a
# cheerful "Migration Complete!" (it scans docs/issues/open, while the v2
# installer puts issues in planning/issues/open).
#
# Every convergence run in this file goes through a wrapper from test/lib.sh.
# A direct call to the script is a defect in itself (S-1) — audited by
# test/safety-audit.sh (TC-032), not by reviewers.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

FIXTURES="$PF_LIB_DIR/fixtures"

# git_commit_all <dir> [message] — commit whatever is currently in the index +
# worktree of a TEMP copy. Never used on $REPO_ROOT (S-5).
git_commit_all() {
  git -C "$1" add -A
  git -C "$1" -c user.name='PF Test' -c user.email='pf-test@example.invalid' \
    commit -q --allow-empty -m "${2:-test commit}"
}

# git_commit_staged <dir> <message> — commit ONLY what the caller has staged.
git_commit_staged() {
  git -C "$1" -c user.name='PF Test' -c user.email='pf-test@example.invalid' \
    commit -q --allow-empty -m "$2"
}

count_backups() {
  find "$1" -maxdepth 1 -type d -name 'planning-backup-*' | wc -l
}

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-004: convergence from a REAL v2 project (root cause of defect 1)\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v2-project >/dev/null

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 1: converge on a v2 project"

if printf '%s' "$out" | grep -qE 'Detected state.*\bv2\b'; then
  pf_pass "step 2a: the starting state was recognised as v2"
else
  pf_fail "step 2a: the starting state was not reported as v2"
fi

# The point of defect 1: the old script printed "(none found)" because it looked
# in docs/issues/open while the data sat in planning/issues/open. The issues must
# be listed BY NAME.
if printf '%s' "$out" | grep -q '20250101-feat-alpha' &&
  printf '%s' "$out" | grep -q '20250102-bug-beta' &&
  printf '%s' "$out" | grep -q '20241201-feat-gamma' &&
  ! printf '%s' "$out" | grep -qi 'none found'; then
  pf_pass "step 2b: all three transferred issues are named in the report, and nothing says '(none found)'"
else
  pf_fail "step 2b: the report does not name the transferred issues"
fi

assert_target_state "$TMP_WORK" "$TMP_HOME" # step 3 — T1–T11

open_issues="$(cd "$TMP_WORK/docs/issues/open" && find . -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | LC_ALL=C sort | tr '\n' ' ')"
if [ "$open_issues" = "20250101-feat-alpha 20250102-bug-beta " ]; then
  pf_pass "step 4: docs/issues/open/ holds exactly the two open issues"
else
  pf_fail "step 4: docs/issues/open/ holds '$open_issues'"
fi

closed_issues="$(cd "$TMP_WORK/docs/issues/closed" && find . -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | LC_ALL=C sort | tr '\n' ' ')"
if [ "$closed_issues" = "20241201-feat-gamma " ]; then
  pf_pass "step 5: docs/issues/closed/ holds exactly the closed issue"
else
  pf_fail "step 5: docs/issues/closed/ holds '$closed_issues'"
fi

if cmp -s "$FIXTURES/v2-project/planning/issues/open/20250101-feat-alpha/analysis.md" \
  "$TMP_WORK/docs/issues/open/20250101-feat-alpha/analysis.md"; then
  pf_pass "step 6: the issue's analysis.md is byte-identical to the fixture — content is moved, never rewritten"
else
  pf_fail "step 6: analysis.md was modified during the transfer"
fi

globals_ok=1
for f in implementation-plan.md session-log.md decisions.md; do
  if ! cmp -s "$FIXTURES/v2-project/planning/$f" "$TMP_WORK/docs/planning/$f"; then
    globals_ok=0
    pf_note "docs/planning/$f differs from the v2 original"
  fi
done
if [ "$globals_ok" -eq 1 ]; then
  pf_pass "step 7: the three global documents were carried over from planning/ with their content intact"
else
  pf_fail "step 7: a global document was lost or overwritten by a template"
fi

if [ ! -d "$TMP_WORK/planning/issues" ]; then
  pf_pass "step 8: planning/issues/ is gone (T9)"
else
  pf_fail "step 8: planning/issues/ survived"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-006: convergence from a mixed / half-migrated layout\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case mixed-layout >/dev/null

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 1: converge on a half-migrated project"

if printf '%s' "$out" | grep -qi 'Detected state.*mixed'; then
  pf_pass "step 2: the mixed state (planning/issues/ + docs/issues/) was recognised"
else
  pf_fail "step 2: the mixed state was not reported"
fi

assert_target_state "$TMP_WORK" "$TMP_HOME" # step 3

alpha="$TMP_WORK/docs/issues/open/20250101-feat-alpha"
files="$(cd "$alpha" && find . -type f -printf '%f\n' | LC_ALL=C sort | tr '\n' ' ')"
if [ "$files" = "analysis.md implementation_plan.md prompt.md " ]; then
  pf_pass "step 4a: the issue holds exactly prompt/analysis/implementation_plan"
else
  pf_fail "step 4a: the issue holds '$files'"
fi

sidecars="$(find "$TMP_WORK/docs" -name '*.v2.md' | wc -l)"
if [ "$sidecars" -eq 0 ]; then
  pf_pass "step 4b: no *.v2.md duplicates — the already-transferred files matched byte for byte, so the sources were simply dropped"
else
  pf_fail "step 4b: $sidecars *.v2.md file(s) appeared where the copies were identical"
fi

if [ ! -d "$TMP_WORK/planning/issues" ] && [ ! -d "$TMP_WORK/planning" ]; then
  pf_pass "step 5: planning/ is gone entirely"
else
  pf_fail "step 5: planning/ (or planning/issues/) survived"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-007: idempotency — the second run changes nothing, byte for byte (D-E)\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v2-project >/dev/null

rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 1: first run"

snap_a="$(snapshot_tree "$TMP_WORK")"        # step 2
home_a="$(snapshot_tree "$TMP_HOME/.claude")"

rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 3: second run"

snap_b="$(snapshot_tree "$TMP_WORK")"        # step 4
home_b="$(snapshot_tree "$TMP_HOME/.claude")"

if [ "$snap_a" = "$snap_b" ]; then
  pf_pass "step 5: the project tree is byte-identical after the second run (no date stamps anywhere — D-E)"
else
  pf_fail "step 5: the second run changed the tree"
  diff <(printf '%s\n' "$snap_a") <(printf '%s\n' "$snap_b") | head -20 >&2
fi

# Step 6 — the T2/T3/T4 artifacts carry no date-shaped string at all. A
# `Last Updated: <today>` stamp would not change the result within one day but
# would change it tomorrow: the test would be "green on Tuesdays".
section="$(awk '/<!-- pf:begin -->/,/<!-- pf:end -->/' "$TMP_WORK/CLAUDE.md")"
dates="$(grep -hnE '[0-9]{4}-[0-9]{2}-[0-9]{2}' "$TMP_WORK/PLANNING.md" "$TMP_WORK/.pf-version" || true)"
dates="$dates$(printf '%s' "$section" | grep -nE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)"
if [ -z "$dates" ]; then
  pf_pass "step 6: no date in PLANNING.md, .pf-version or the CLAUDE.md pf section (D-E)"
else
  pf_fail "step 6: a date-shaped string is baked into a framework artifact"
  printf '%s\n' "$dates" >&2
fi

n_backups="$(count_backups "$TMP_WORK")"
if [ "$n_backups" -eq 1 ]; then
  pf_pass "step 7: exactly one planning-backup-* directory — the second run had nothing to transfer or delete"
else
  pf_fail "step 7: $n_backups planning-backup-* directories after two runs (want 1)"
fi

n_begin="$(grep -c -- '<!-- pf:begin -->' "$TMP_WORK/CLAUDE.md")"
n_end="$(grep -c -- '<!-- pf:end -->' "$TMP_WORK/CLAUDE.md")"
if [ "$n_begin" -eq 1 ] && [ "$n_end" -eq 1 ]; then
  pf_pass "step 8: still exactly one pf:begin/pf:end pair — the section was replaced, not duplicated (Р8)"
else
  pf_fail "step 8: CLAUDE.md holds $n_begin/$n_end markers after two runs"
fi

if [ "$home_a" = "$home_b" ]; then
  pf_pass "step 9: \$HOME/.claude/ is byte-identical after the second run"
else
  pf_fail "step 9: the second run changed \$HOME/.claude/"
  diff <(printf '%s\n' "$home_a") <(printf '%s\n' "$home_b") | head -10 >&2
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-008: recovery from an interrupted run — no .v2.md duplicates (D-F)\n'
# ══════════════════════════════════════════════════════════════════════════════

# The reference tree is computed INSIDE this case (a single clean run on a fresh
# copy), never borrowed from TC-004: a test that compares against a constant
# someone else produced proves nothing about convergence.
pf_setup_case v2-project >/dev/null
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 6a: the reference — one clean run"
reference_docs="$(snapshot_tree "$TMP_WORK/docs")"

export PF_CONVERGE_TEST_HOOKS=1

for n in 2 1 5; do
  printf '  --- interruption point: --fail-after=%s\n' "$n"
  pf_setup_case v2-project >/dev/null

  out="$(pf_run_converge "--fail-after=$n" 2>&1)"
  rc=$?
  assert_exit_code 70 "$rc" "step 1 (--fail-after=$n): the hook aborted the run"

  moved="$(find "$TMP_WORK/docs/issues" -type f 2>/dev/null | wc -l)"
  if [ "$moved" -eq "$n" ]; then
    pf_pass "step 1b (--fail-after=$n): exactly $n file(s) had been transferred when it died"
  else
    pf_fail "step 1b (--fail-after=$n): $moved file(s) under docs/issues/ (want $n)"
  fi

  if [ -d "$TMP_WORK/planning/issues" ]; then
    pf_pass "step 1c (--fail-after=$n): planning/issues/ is intact — phase 5 never ran (D-B)"
  else
    pf_fail "step 1c (--fail-after=$n): planning/issues/ was deleted despite the abort"
  fi

  if [ -d "$TMP_WORK/planning/issues" ] && [ -d "$TMP_WORK/docs/issues" ]; then
    pf_pass "step 2 (--fail-after=$n): the project is now in the mixed state"
  else
    pf_fail "step 2 (--fail-after=$n): the project is not in the mixed state"
  fi

  rc=0
  pf_run_converge >/dev/null 2>&1 || rc=$?
  assert_exit_code 0 "$rc" "step 3 (--fail-after=$n): the re-run finishes the job"

  sidecars="$(find "$TMP_WORK/docs" -name '*.v2.md' | wc -l)"
  if [ "$sidecars" -eq 0 ]; then
    pf_pass "step 4 (--fail-after=$n): no *.v2.md — the already-transferred files matched, so the sources were just dropped"
  else
    pf_fail "step 4 (--fail-after=$n): $sidecars *.v2.md duplicate(s) created on the re-run"
  fi

  assert_target_state "$TMP_WORK" "$TMP_HOME" # step 5

  if [ "$(snapshot_tree "$TMP_WORK/docs")" = "$reference_docs" ]; then
    pf_pass "step 7 (--fail-after=$n): docs/ is identical to a single clean run — the interruption point does not affect convergence"
  else
    pf_fail "step 7 (--fail-after=$n): docs/ differs from the clean-run reference"
    diff <(printf '%s\n' "$reference_docs") <(snapshot_tree "$TMP_WORK/docs") | head -15 >&2
  fi
done

unset PF_CONVERGE_TEST_HOOKS

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-016: the backup — name, visibility to git, and when it is made (KI-1)\n'
# ══════════════════════════════════════════════════════════════════════════════

# The *.bak line is planted on purpose: without it the case would pass trivially
# on a fixture that has no .gitignore at all, and prove nothing.
pf_setup_case v2-project >/dev/null
printf '*.bak\n' >"$TMP_WORK/.gitignore"
pf_git_init "$TMP_WORK"

rc=0
out="$(pf_run_converge 2>&1)" || rc=$?
assert_exit_code 0 "$rc" "step 1a: converge on a v2 project carrying a *.bak .gitignore rule"

backup_name="$(cd "$TMP_WORK" && find . -maxdepth 1 -type d -name 'planning-backup-*' -printf '%f\n')"
if printf '%s' "$backup_name" | grep -qE '^planning-backup-[0-9]{8}-[0-9]{6}$'; then
  pf_pass "step 1b: the backup is named $backup_name"
else
  pf_fail "step 1b: the backup directory name is '$backup_name' (want planning-backup-YYYYMMDD-HHMMSS)"
fi
if [ -z "$(find "$TMP_WORK" -maxdepth 1 -name '*.bak')" ]; then
  pf_pass "step 1c: no *.bak path was created"
else
  pf_fail "step 1c: a *.bak path was created — it would be invisible to git"
fi

# Step 2 — the whole justification of KI-1, in two git invocations.
if git -C "$TMP_WORK" check-ignore -q planning.bak; then
  pf_pass "step 2a: the REJECTED name planning.bak WOULD be ignored by this project's .gitignore (exit 0)"
else
  pf_fail "step 2a: planning.bak is not ignored here — the case proves nothing; check the planted *.bak rule"
fi
if ! git -C "$TMP_WORK" check-ignore -q "$backup_name"; then
  pf_pass "step 2b: the CHOSEN name $backup_name is NOT ignored — the backup is visible to git"
else
  pf_fail "step 2b: $backup_name is ignored by git — the rollback artifact would be invisible"
fi

miss=""
for p in planning/scripts/issue-status.sh planning/FRAMEWORK.md planning/templates/README.md \
  planning/issues/open/20250101-feat-alpha/prompt.md planning/session-log.md; do
  [ -e "$TMP_WORK/$backup_name/$p" ] || miss="$miss $p"
done
if [ -z "$miss" ] &&
  cmp -s "$FIXTURES/v2-project/planning/FRAMEWORK.md" "$TMP_WORK/$backup_name/planning/FRAMEWORK.md"; then
  pf_pass "step 3: the backup holds all of planning/, including everything phase 5 deleted"
else
  pf_fail "step 3: the backup is incomplete —$miss"
fi

if printf '%s' "$out" | grep -qF "$backup_name" && printf '%s' "$out" | grep -q 'rm -rf'; then
  pf_pass "step 4: the report prints the backup path and the command to remove it"
else
  pf_fail "step 4: the report does not name the backup or how to delete it"
fi

# Step 5 — a pure top-up. Phase 6's T6 mirror DELETES template files here, and a
# literal reading of "backup if anything is deleted" would demand one. It must
# not: the backup guards USER data that phases 3 and 5 carry off or erase.
pf_setup_case v3-incomplete >/dev/null
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
n_backups="$(count_backups "$TMP_WORK")"
if [ "$rc" -eq 0 ] && [ "$n_backups" -eq 0 ]; then
  pf_pass "step 5: no backup on a pure top-up (the T6 mirror's deletions do not trigger one)"
else
  pf_fail "step 5: $n_backups backup(s) created on a pure top-up (exit $rc)"
fi

pf_setup_case no-pf-bare >/dev/null
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
n_backups="$(count_backups "$TMP_WORK")"
if [ "$rc" -eq 0 ] && [ "$n_backups" -eq 0 ]; then
  pf_pass "step 6: no backup on a clean install"
else
  pf_fail "step 6: $n_backups backup(s) created on a clean install (exit $rc)"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-017: git mv with a PER-FILE fallback (KI-2)\n'
# ══════════════════════════════════════════════════════════════════════════════

# Three regimes in one worktree, which is the whole point — a repo-level
# "is this git?" branch cannot serve all three:
#   * a fully TRACKED issue directory            -> git mv (history preserved)
#   * a fully UNTRACKED directory                -> git mv dies with
#     `fatal: source directory is empty` (128)   -> cp -a + rm
#   * a single UNTRACKED file inside a tracked dir -> git mv dies with
#     `fatal: not under version control` (128)   -> cp -a + rm
#
# The fixture is only executable BECAUSE of D-A: a gate that tripped on untracked
# files would refuse to run in a worktree like this one.
pf_setup_case v2-project >/dev/null
git -C "$TMP_WORK" init -q
git -C "$TMP_WORK" add \
  planning/issues/open/20250101-feat-alpha \
  planning/issues/closed \
  planning/implementation-plan.md planning/session-log.md planning/decisions.md \
  planning/FRAMEWORK.md planning/scripts planning/templates \
  PLANNING.md .qa-workflow.md
git_commit_staged "$TMP_WORK" 'v2 baseline (partial: bug-beta left untracked)'
printf 'draft notes, never committed\n' >"$TMP_WORK/planning/issues/open/20250101-feat-alpha/notes-draft.md"

if ! git -C "$TMP_WORK" ls-files --error-unmatch planning/issues/open/20250102-bug-beta/prompt.md >/dev/null 2>&1 &&
  git -C "$TMP_WORK" ls-files --error-unmatch planning/issues/open/20250101-feat-alpha/analysis.md >/dev/null 2>&1; then
  pf_pass "step 0: the fixture really is partially committed (alpha tracked, bug-beta untracked)"
else
  pf_fail "step 0: the partial-commit precondition did not take"
fi

err_out="$(pf_run_converge 2>&1 >/dev/null)"
rc=$?
assert_exit_code 0 "$rc" "step 1a: converge on a partially committed worktree"
if ! printf '%s' "$err_out" | grep -q 'fatal: source directory is empty' &&
  ! printf '%s' "$err_out" | grep -q 'fatal: not under version control'; then
  pf_pass "step 1b: neither empirically confirmed git mv failure reached stderr"
else
  pf_fail "step 1b: a raw git mv fatal leaked to stderr"
  printf '%s\n' "$err_out" >&2
fi

# Step 2 — the tracked file went through `git mv`, so its history survives. The
# rename is STAGED by git mv (`R  old -> new`); --follow only walks commits, so
# the case commits converge's own staged change set first — which is exactly what
# a user does after a run.
renames="$(git -C "$TMP_WORK" status --porcelain | grep -c '^R')"
git_commit_all "$TMP_WORK" 'converge'
history="$(git -C "$TMP_WORK" log --follow --oneline -- docs/issues/open/20250101-feat-alpha/analysis.md | wc -l)"
if [ "$renames" -gt 0 ] && [ "$history" -ge 2 ]; then
  pf_pass "step 2: git mv was used for tracked files ($renames staged renames) and git log --follow reaches the original commit ($history commits)"
else
  pf_fail "step 2: history is not followable (staged renames: $renames, commits on --follow: $history)"
fi

beta="$TMP_WORK/docs/issues/open/20250102-bug-beta"
beta_files="$(cd "$beta" 2>/dev/null && find . -type f -printf '%f\n' | LC_ALL=C sort | tr '\n' ' ')"
if [ "$beta_files" = "analysis.md implementation_plan.md prompt.md " ]; then
  pf_pass "step 3: the wholly untracked issue directory was transferred in full (cp -a + rm fallback)"
else
  pf_fail "step 3: the untracked issue directory holds '$beta_files'"
fi

if [ -f "$TMP_WORK/docs/issues/open/20250101-feat-alpha/notes-draft.md" ] &&
  ! [ -e "$TMP_WORK/planning/issues/open/20250101-feat-alpha/notes-draft.md" ]; then
  pf_pass "step 4: the single untracked file inside a tracked directory was transferred (per-file fallback)"
else
  pf_fail "step 4: the untracked single file was lost or left behind"
fi

if [ ! -d "$TMP_WORK/planning" ]; then
  pf_pass "step 5: no sources left in planning/ — the transfer is reflected in git"
else
  pf_fail "step 5: planning/ still exists after the transfer"
fi

assert_target_state "$TMP_WORK" "$TMP_HOME"

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-018: deletion is by WHITELIST, never rm -rf planning/\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case planning-with-user-files >/dev/null
notes_before="$(sha256sum <"$TMP_WORK/planning/notes-of-mine.md" | cut -d' ' -f1)"

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 1: converge on a planning/ that holds a user file"

notes_after="$(sha256sum <"$TMP_WORK/planning/notes-of-mine.md" 2>/dev/null | cut -d' ' -f1)"
if [ -f "$TMP_WORK/planning/notes-of-mine.md" ] && [ "$notes_before" = "$notes_after" ]; then
  pf_pass "step 2: planning/notes-of-mine.md — a file the framework never created — survived, byte for byte"
else
  pf_fail "step 2: planning/notes-of-mine.md was deleted or modified (rm -rf planning/ ?)"
fi

planning_left="$(cd "$TMP_WORK/planning" && find . -mindepth 1 -printf '%P\n' | LC_ALL=C sort | tr '\n' ' ')"
if [ "$planning_left" = "notes-of-mine.md " ]; then
  pf_pass "step 3: planning/ holds ONLY the user file — every whitelisted path is gone"
else
  pf_fail "step 3: planning/ holds '$planning_left'"
fi

if printf '%s' "$out" | grep -qi 'WARNING.*planning/ is not empty' &&
  printf '%s' "$out" | grep -q 'notes-of-mine.md'; then
  pf_pass "step 4: a WARNING lists what is still in planning/ (the rmdir failed on purpose)"
else
  pf_fail "step 4: no WARNING naming the leftovers"
fi

# Step 4b (regression) — this fixture keeps its empty planning/issues/closed/
# alive with a .gitkeep, which is how EVERY v2 project does it. Such a file is
# not an issue: if the transfer takes its name for an issue ID it lands as a
# DIRECTORY named .gitkeep holding a file named .gitkeep — a phantom issue that
# /pf would list as real work, and that the report would name as "transferred".
if [ -f "$TMP_WORK/docs/issues/closed/.gitkeep" ] &&
  [ ! -d "$TMP_WORK/docs/issues/closed/.gitkeep" ]; then
  pf_pass "step 4b: the .gitkeep landed as a FILE in docs/issues/closed/ — no phantom issue directory"
else
  pf_fail "step 4b: docs/issues/closed/.gitkeep is not a plain file (a phantom issue directory?)"
  find "$TMP_WORK/docs/issues" >&2
fi
if ! printf '%s' "$out" | grep -qE '^ *- \.gitkeep$'; then
  pf_pass "step 4c: the report does not list .gitkeep among the transferred issues"
else
  pf_fail "step 4c: .gitkeep is reported as a transferred issue"
fi

snap_before="$(snapshot_tree "$TMP_WORK")"
out="$(pf_run_converge 2>&1)"
rc=$?
snap_after="$(snapshot_tree "$TMP_WORK")"
if [ "$rc" -eq 0 ] && [ "$snap_before" = "$snap_after" ] &&
  [ "$(count_backups "$TMP_WORK")" -eq 1 ] &&
  ! printf '%s' "$out" | grep -qE 'Detected state.*\bv2\b'; then
  pf_pass "step 5: the leftover planning/ does NOT provoke a second 'migration' (detection keys on planning/issues/, which is gone)"
else
  pf_fail "step 5: the second run re-migrated, re-backed-up, or changed the tree (exit $rc)"
  diff <(printf '%s\n' "$snap_before") <(printf '%s\n' "$snap_after") | head -10 >&2
fi

# Step 6 — the same run on a project with no user files: rmdir succeeds, silence.
pf_setup_case v2-project >/dev/null
out="$(pf_run_converge 2>&1)"
rc=$?
if [ "$rc" -eq 0 ] && [ ! -e "$TMP_WORK/planning" ] &&
  ! printf '%s' "$out" | grep -qi 'planning/ is not empty'; then
  pf_pass "step 6: with no user files, planning/ is removed whole and no WARNING is printed"
else
  pf_fail "step 6: planning/ survived, or a spurious leftovers WARNING was printed (exit $rc)"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-019: v2 FRAMEWORK artifacts are deleted, not transferred\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v2-project >/dev/null
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 1: converge on a v2 project"

if [ -z "$(find "$TMP_WORK/docs" -name 'issue-status.sh')" ]; then
  pf_pass "step 2: planning/scripts/issue-status.sh was NOT carried into docs/ — it is a v2 framework artifact, not data"
else
  pf_fail "step 2: the v2 script was transferred into docs/"
fi

# Converge never installs docs/planning/FRAMEWORK.md at all (it is in neither
# T1–T11 nor phase 6), so the v2 copy has no business appearing there either.
# NB: this is a LOCAL step of the v2 path, not part of T9 — on a v1 project a
# pre-existing docs/planning/FRAMEWORK.md legitimately survives (TC-003).
if [ -z "$(find "$TMP_WORK/docs/planning" -maxdepth 1 -name 'FRAMEWORK.md')" ]; then
  pf_pass "step 3: docs/planning/FRAMEWORK.md did not appear — the v2 copy was not transferred"
else
  pf_fail "step 3: a FRAMEWORK.md turned up in docs/planning/"
fi

backup_name="$(cd "$TMP_WORK" && find . -maxdepth 1 -type d -name 'planning-backup-*' -printf '%f\n')"
if [ -f "$TMP_WORK/$backup_name/planning/scripts/issue-status.sh" ] &&
  [ -f "$TMP_WORK/$backup_name/planning/FRAMEWORK.md" ] &&
  [ -d "$TMP_WORK/$backup_name/planning/templates" ]; then
  pf_pass "step 4: the only surviving copies of the v2 framework artifacts are in the backup"
else
  pf_fail "step 4: the backup does not hold the deleted v2 framework artifacts"
fi

if diff -r "$REPO_ROOT/docs/planning/templates" "$TMP_WORK/docs/planning/templates" >/dev/null 2>&1; then
  pf_pass "step 5: docs/planning/templates/ is the framework's mirror — the v2 planning/templates/ did not bleed into it"
else
  pf_fail "step 5: the v2 templates contaminated docs/planning/templates/"
  diff -r "$REPO_ROOT/docs/planning/templates" "$TMP_WORK/docs/planning/templates" | head -10 >&2
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-022: implementation-plan.md -> implementation_plan.md in EVERY issue (Р12, T10)\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v2-project --git >/dev/null
plan_before="$(sha256sum <"$FIXTURES/v2-project/planning/issues/open/20250101-feat-alpha/implementation-plan.md" | cut -d' ' -f1)"
global_before="$(sha256sum <"$FIXTURES/v2-project/planning/implementation-plan.md" | cut -d' ' -f1)"

rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 1: converge on a v2 project"

hyphenated="$(find "$TMP_WORK/docs/issues" -name 'implementation-plan.md' | wc -l)"
if [ "$hyphenated" -eq 0 ]; then
  pf_pass "step 2: no hyphenated implementation-plan.md left anywhere under docs/issues/ (T10)"
else
  pf_fail "step 2: $hyphenated hyphenated plan(s) survived — no skill reads those"
fi

underscored="$(find "$TMP_WORK/docs/issues" -name 'implementation_plan.md' | wc -l)"
if [ "$underscored" -eq 3 ]; then
  pf_pass "step 3: three implementation_plan.md — one per issue, the closed one included"
else
  pf_fail "step 3: $underscored implementation_plan.md found (want 3: alpha, bug-beta, gamma)"
fi

plan_after="$(sha256sum <"$TMP_WORK/docs/issues/open/20250101-feat-alpha/implementation_plan.md" | cut -d' ' -f1)"
if [ "$plan_before" = "$plan_after" ]; then
  pf_pass "step 4: the renamed plan is byte-identical to the v2 original — a rename, not a rewrite"
else
  pf_fail "step 4: the plan's content changed during the rename"
fi

git_commit_all "$TMP_WORK" 'converge'
history="$(git -C "$TMP_WORK" log --follow --oneline -- docs/issues/open/20250101-feat-alpha/implementation_plan.md | wc -l)"
if [ "$history" -ge 2 ]; then
  pf_pass "step 5: git log --follow traces the renamed plan back to the baseline commit ($history commits)"
else
  pf_fail "step 5: the rename lost the file's history ($history commits on --follow)"
fi

global_after="$(sha256sum <"$TMP_WORK/docs/planning/implementation-plan.md" 2>/dev/null | cut -d' ' -f1)"
if [ -f "$TMP_WORK/docs/planning/implementation-plan.md" ] &&
  [ ! -e "$TMP_WORK/docs/planning/implementation_plan.md" ] &&
  [ "$global_before" = "$global_after" ]; then
  pf_pass "step 6: the GLOBAL docs/planning/implementation-plan.md keeps its hyphen and its content — the rename is an issue-level rule"
else
  pf_fail "step 6: the global implementation-plan.md was renamed or rewritten"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-056: a project outside git\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v2-project >/dev/null # deliberately NO git init
if [ ! -d "$TMP_WORK/.git" ]; then
  pf_pass "step 0: the project really is outside git"
else
  pf_fail "step 0: the case set up a git repo by mistake"
fi

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 1a: converge outside git"
if ! printf '%s' "$out" | grep -qi 'fatal:' && ! printf '%s' "$out" | grep -qi 'not a git repository (or any'; then
  pf_pass "step 1b: no git invocation blew up in the output"
else
  pf_fail "step 1b: a raw git error surfaced"
  printf '%s\n' "$out" | grep -i 'fatal\|not a git repo' | head -5 >&2
fi

assert_target_state "$TMP_WORK" "$TMP_HOME" # step 2

if printf '%s' "$out" | grep -qi 'not a git repository.*gate skipped'; then
  pf_pass "step 3: the worktree gate says it was skipped — no git is not 'dirty'"
else
  pf_fail "step 3: no informational message about the missing git repository"
fi

backup_name="$(cd "$TMP_WORK" && find . -maxdepth 1 -type d -name 'planning-backup-*' -printf '%f\n')"
if [ -d "$TMP_WORK/$backup_name/planning" ] &&
  [ -f "$TMP_WORK/$backup_name/planning/issues/open/20250101-feat-alpha/prompt.md" ]; then
  pf_pass "step 4: the backup was made anyway — the failing git check-ignore was handled, not fatal"
else
  pf_fail "step 4: no usable backup outside git"
fi

snap_before="$(snapshot_tree "$TMP_WORK")"
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
snap_after="$(snapshot_tree "$TMP_WORK")"
if [ "$rc" -eq 0 ] && [ "$snap_before" = "$snap_after" ]; then
  pf_pass "step 5: the second run outside git is byte-identical"
else
  pf_fail "step 5: the second run outside git changed the tree (exit $rc)"
  diff <(printf '%s\n' "$snap_before") <(printf '%s\n' "$snap_after") | head -10 >&2
fi

# ══════════════════════════════════════════════════════════════════════════════
printf "\n=== TC-057: the consumer's .gitignore hides the backup path (KI-1)\n"
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v2-project >/dev/null
printf 'planning-backup-*\n' >"$TMP_WORK/.gitignore"
pf_git_init "$TMP_WORK"

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 1: converge with a .gitignore that hides the backup"

if printf '%s' "$out" | grep -qi 'WARNING.*ignored by' && printf '%s' "$out" | grep -qi 'gitignore'; then
  pf_pass "step 2: a WARNING says the backup path is ignored by git and will not show in git status"
else
  pf_fail "step 2: no WARNING about the ignored backup path"
fi

backup_name="$(cd "$TMP_WORK" && find . -maxdepth 1 -type d -name 'planning-backup-*' -printf '%f\n')"
if [ -n "$backup_name" ] && [ -d "$TMP_WORK/$backup_name/planning" ] &&
  git -C "$TMP_WORK" check-ignore -q "$backup_name"; then
  pf_pass "step 3: the backup was created regardless — data is never lost to someone else's .gitignore"
else
  pf_fail "step 3: the backup was skipped because git ignores the path (or the path is not actually ignored)"
fi

pf_setup_case v2-project >/dev/null
printf 'node_modules/\n' >"$TMP_WORK/.gitignore"
pf_git_init "$TMP_WORK"
out="$(pf_run_converge 2>&1)"
rc=$?
if [ "$rc" -eq 0 ] && ! printf '%s' "$out" | grep -qi 'WARNING.*ignored by'; then
  pf_pass "step 4: with the rule removed, no such WARNING is printed"
else
  pf_fail "step 4: the WARNING fires even when the backup path is not ignored (exit $rc)"
fi

assert_repo_untouched

pf_summary
