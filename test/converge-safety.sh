#!/usr/bin/env bash
# test/converge-safety.sh — the SAFETY and COLLISION paths of convergence.
#
# TC-025, TC-026, TC-027, TC-028, TC-029, TC-051, TC-052, TC-053, TC-054, TC-055.
#
# These are the cases where convergence must refuse, warn, or stop — and the ones
# where getting it wrong destroys data rather than merely failing:
#
#   * the worktree gate      — do not eat uncommitted work (D-A)
#   * cancellation           — "could not ask" is NOT "the user agreed" (KI-6)
#   * --dry-run              — a preview that mutates nothing, anywhere
#   * the .v2.md sidecar     — keep both copies; the v3 one always wins
#   * file-vs-directory      — refuse, exit non-zero, and DO NOT delete (D-B)
#
# Every convergence run in this file goes through a wrapper from test/lib.sh —
# INCLUDING the interactive ones (TC-029) and the ones without --target. The
# script installs skills into ~/.claude/skills/ and rewrites ~/.claude/bin/pf; a
# direct call would destroy the developer's global install and every concurrent
# Claude Code session. A direct call is a defect in itself (S-1), audited by
# test/safety-audit.sh (TC-032), not by reviewers.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

FIXTURES="$PF_LIB_DIR/fixtures"

git_commit_all() {
  git -C "$1" add -A
  git -C "$1" -c user.name='PF Test' -c user.email='pf-test@example.invalid' \
    commit -q --allow-empty -m "${2:-test commit}"
}

count_backups() {
  find "$1" -maxdepth 1 -type d -name 'planning-backup-*' | wc -l
}

# Every *.v2.md (and *.v2) sidecar under docs/, path-relative, sorted.
list_sidecars() {
  (cd "$1" && find docs -name '*.v2.md' -o -name '*.v2' 2>/dev/null | LC_ALL=C sort)
}

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-025: the final report (phase 7) tells you what actually happened\n'
# ══════════════════════════════════════════════════════════════════════════════
#
# The whole point: "there was nothing to do" and "I looked in the wrong place"
# must be distinguishable FROM THE OUTPUT — which is exactly what today's
# migrate-v2-to-v3.sh makes impossible when it prints "(none found)" and
# "Migration Complete!" over an untouched planning/.

pf_setup_case collision-same-id >/dev/null

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 1: converge on collision-same-id"

# Step 2 — the detected state is named, and it is the right one (both layouts
# present ⇒ mixed).
if printf '%s' "$out" | grep -qE 'Detected state[[:space:]]*:.*mixed'; then
  pf_pass "step 2: the report names the detected state, and it is 'mixed'"
else
  pf_fail "step 2: the report does not name the detected state as 'mixed'"
fi

# Step 3 — every sidecar that was kept is listed BY NAME. Derived from the tree,
# never from a constant: a sidecar the report forgot is the failure mode here.
missing_from_report=""
while IFS= read -r side; do
  [ -n "$side" ] || continue
  printf '%s' "$out" | grep -qF -- "$side" || missing_from_report="$missing_from_report $side"
done < <(list_sidecars "$TMP_WORK")

n_sidecars="$(list_sidecars "$TMP_WORK" | grep -c . || true)"
if [ "$n_sidecars" -gt 0 ] && [ -z "$missing_from_report" ]; then
  pf_pass "step 3: all $n_sidecars kept .v2.md sidecar(s) are listed by name in the report"
else
  pf_fail "step 3: sidecars missing from the report:$missing_from_report (found $n_sidecars on disk)"
fi

# Step 4 — the backup path AND the command that removes it. A backup nobody is
# told about is a backup nobody deletes.
backup_path="$(find "$TMP_WORK" -maxdepth 1 -type d -name 'planning-backup-*' -printf '%f\n' | head -n 1)"
if [ -n "$backup_path" ] &&
  printf '%s' "$out" | grep -qF -- "$backup_path" &&
  printf '%s' "$out" | grep -qF -- 'rm -rf'; then
  pf_pass "step 4: the report gives the backup path ($backup_path) and the command to remove it"
else
  pf_fail "step 4: the report does not give both the backup path and its removal command"
fi

# Step 5 — "still to do by hand": the /pf-qa-setup hint (this fixture has no
# .qa-workflow.md) plus the open issues that still owe v3 documents, by name.
if printf '%s' "$out" | grep -qi 'still to do by hand' &&
  printf '%s' "$out" | grep -qF -- '/pf-qa-setup' &&
  printf '%s' "$out" | grep -qF -- '20250103-improve-gamma' &&
  printf '%s' "$out" | grep -qF -- 'test_plan.md'; then
  pf_pass "step 5: the report lists the /pf-qa-setup hint and the issues still missing v3 documents"
else
  pf_fail "step 5: the 'still to do by hand' block is incomplete"
fi

# Step 6 — a dry run on a fresh copy prints the SAME report format, explicitly
# stamped as a dry run.
pf_setup_case collision-same-id >/dev/null
dry="$(pf_run_converge --dry-run 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 6: --dry-run on a fresh copy"
if printf '%s' "$dry" | grep -qi 'DRY-RUN' &&
  printf '%s' "$dry" | grep -qi 'no changes were made' &&
  printf '%s' "$dry" | grep -qE 'Detected state[[:space:]]*:' &&
  ! printf '%s' "$dry" | grep -q 'Converge complete'; then
  pf_pass "step 6b: the dry-run report keeps the format but is explicitly marked 'no changes were made'"
else
  pf_fail "step 6b: the dry-run report is not clearly marked as a dry run"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-026: --dry-run changes NOTHING — not in the project, not in the home dir\n'
# ══════════════════════════════════════════════════════════════════════════════
#
# Today the preview is fused into the real run (migrate-v2-to-v3.sh:34-98): you
# cannot look before you leap.

pf_setup_case v2-project >/dev/null

work_a="$(snapshot_tree "$TMP_WORK")" # step 1 — snapshots A
home_a="$(snapshot_tree "$TMP_HOME")"

out="$(pf_run_converge --dry-run 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 2: --dry-run on a v2 project"

# The plan must actually SAY what it would do — a silent exit 0 would pass a
# naive "nothing changed" check while being useless.
if printf '%s' "$out" | grep -qi 'would transfer' &&
  printf '%s' "$out" | grep -qi 'would delete' &&
  printf '%s' "$out" | grep -qi 'would top up'; then
  pf_pass "step 2b: the plan states what would be transferred, deleted and topped up"
else
  pf_fail "step 2b: the dry-run plan does not state transfer / delete / top-up"
fi

work_b="$(snapshot_tree "$TMP_WORK")" # step 3 — snapshots B
home_b="$(snapshot_tree "$TMP_HOME")"

if [ "$work_a" = "$work_b" ]; then # step 4
  pf_pass "step 4a: the project is byte-for-byte unchanged by --dry-run"
else
  pf_fail "step 4a: --dry-run modified the project"
  diff <(printf '%s\n' "$work_a") <(printf '%s\n' "$work_b") | head -20 >&2
fi
if [ "$home_a" = "$home_b" ]; then
  pf_pass "step 4b: \$HOME is byte-for-byte unchanged by --dry-run"
else
  pf_fail "step 4b: --dry-run modified \$HOME"
  diff <(printf '%s\n' "$home_a") <(printf '%s\n' "$home_b") | head -20 >&2
fi

if [ ! -d "$TMP_HOME/.claude/skills" ]; then # step 5
  pf_pass "step 5: no skills were installed (\$HOME/.claude/skills/ does not exist)"
else
  pf_fail "step 5: --dry-run installed skills into \$HOME/.claude/skills/"
fi

if [ "$(count_backups "$TMP_WORK")" -eq 0 ]; then # step 6
  pf_pass "step 6: no planning-backup-* was created"
else
  pf_fail "step 6: --dry-run created a backup"
fi

# Step 7 — the same on a from-scratch install: the plan describes the install and
# still touches nothing.
pf_setup_case no-pf-bare >/dev/null
work_a="$(snapshot_tree "$TMP_WORK")"
home_a="$(snapshot_tree "$TMP_HOME")"

out="$(pf_run_converge --dry-run 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 7: --dry-run on a project with no framework at all"

if [ "$work_a" = "$(snapshot_tree "$TMP_WORK")" ] &&
  [ "$home_a" = "$(snapshot_tree "$TMP_HOME")" ] &&
  printf '%s' "$out" | grep -qi 'would top up' &&
  printf '%s' "$out" | grep -qi 'would NOT create a backup'; then
  pf_pass "step 7b: the plan describes a clean install; nothing in the project or \$HOME changed"
else
  pf_fail "step 7b: --dry-run on no-pf-bare either changed something or printed no plan"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-027: the worktree gate — UNTRACKED files must NOT trip it (D-A)\n'
# ══════════════════════════════════════════════════════════════════════════════
#
# This is the heart of D-A. Convergence emits untracked files by the dozen
# (docs/issues/, .pf-version, PLANNING.md, planning-backup-*). A gate that
# treated untracked as dirty would make the SECOND run fail in every git
# project — i.e. kill the idempotency the script exists for.

pf_setup_case v2-project --git >/dev/null

printf 'scratch\n' >"$TMP_WORK/scratch.txt"
mkdir -p "$TMP_WORK/tmp-notes"
printf 'notes\n' >"$TMP_WORK/tmp-notes/todo.txt"
scratch_before="$(sha256sum <"$TMP_WORK/scratch.txt")"
notes_before="$(sha256sum <"$TMP_WORK/tmp-notes/todo.txt")"

if [ -n "$(git -C "$TMP_WORK" status --porcelain)" ]; then # step 1
  pf_pass "step 1: git status --porcelain is non-empty (naively 'dirty')"
else
  pf_fail "step 1: the untracked junk did not show up in git status --porcelain"
fi

if [ -z "$(git -C "$TMP_WORK" status --porcelain --untracked-files=no)" ]; then # step 2
  pf_pass "step 2: git status --porcelain --untracked-files=no is EMPTY — no tracked changes"
else
  pf_fail "step 2: there are tracked changes where there should be none"
fi

rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 3: converge runs (the gate did not fire on untracked files)"

assert_target_state "$TMP_WORK" "$TMP_HOME" # step 4 — T1–T11

# Step 5 — THE point of D-A. The tree is now full of convergence's own untracked
# output; the second run must still be allowed to start.
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 5: the SECOND run is not blocked by convergence's own output (D-A)"

# Step 6 — the user's junk is still there, untouched.
if [ -f "$TMP_WORK/scratch.txt" ] && [ -f "$TMP_WORK/tmp-notes/todo.txt" ] &&
  [ "$(sha256sum <"$TMP_WORK/scratch.txt")" = "$scratch_before" ] &&
  [ "$(sha256sum <"$TMP_WORK/tmp-notes/todo.txt")" = "$notes_before" ]; then
  pf_pass "step 6: scratch.txt and tmp-notes/ survive untouched"
else
  pf_fail "step 6: convergence disturbed the untracked files"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-028: the worktree gate — a TRACKED edit DOES trip it; --force overrides (D-A)\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v2-project --git >/dev/null
printf '\nuncommitted work that must not be eaten\n' >>"$TMP_WORK/planning/session-log.md"

work_a="$(snapshot_tree "$TMP_WORK")" # step 1 — snapshots A
home_a="$(snapshot_tree "$TMP_HOME")"

out="$(pf_run_converge 2>&1)"
rc=$?
if [ "$rc" -ne 0 ]; then # step 2
  pf_pass "step 2a: an uncommitted TRACKED edit blocks the run (exit $rc, non-zero)"
else
  pf_fail "step 2a: the gate let a dirty tracked worktree through (exit 0)"
fi
assert_exit_code 3 "$rc" "step 2b: the documented gate exit code"

if printf '%s' "$out" | grep -qi 'uncommitted' && printf '%s' "$out" | grep -qF -- '--force'; then
  pf_pass "step 2c: the message names the problem and points at --force"
else
  pf_fail "step 2c: the message does not mention the dirty worktree and --force"
fi

# Step 3 — the stop happened BEFORE every phase, top-up included. If skills had
# landed in $HOME the gate would have fired too late to be worth anything.
if [ "$work_a" = "$(snapshot_tree "$TMP_WORK")" ]; then
  pf_pass "step 3a: the project is byte-for-byte unchanged by the refused run"
else
  pf_fail "step 3a: the refused run still modified the project"
fi
if [ "$home_a" = "$(snapshot_tree "$TMP_HOME")" ] && [ ! -d "$TMP_HOME/.claude/skills" ]; then
  pf_pass "step 3b: \$HOME is unchanged — no skills were installed before the gate fired"
else
  pf_fail "step 3b: the refused run wrote into \$HOME"
fi

rc=0
pf_run_converge --force >/dev/null 2>&1 || rc=$? # step 4
assert_exit_code 0 "$rc" "step 4: --force overrides the gate"
assert_target_state "$TMP_WORK" "$TMP_HOME"

# Step 5 — on a FRESH copy with a clean tree, no --force is needed. (It has to be
# a fresh copy: after step 4 this tree is no longer the one we started with.)
pf_setup_case v2-project --git >/dev/null
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 5: a clean tracked worktree needs no --force"

# Step 6 — no .git at all is not "dirty". It is a fact, reported as such.
pf_setup_case v2-project >/dev/null
out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 6a: a project outside git is not treated as 'dirty'"
if printf '%s' "$out" | grep -qi 'not a git repository'; then
  pf_pass "step 6b: the absence of git is reported as information, not as an error"
else
  pf_fail "step 6b: nothing was said about the project not being a git repository"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-029: a CANCELLED run never exits 0 — the false-green trap (KI-6)\n'
# ══════════════════════════════════════════════════════════════════════════════
#
# migrate-v2-to-v3.sh:94 answers an empty CONFIRM with "Migration cancelled" and
# `exit 0`. On that contract EVERY automated test is green while nothing at all
# has been migrated. This is the only TC that runs without --yes, and it goes
# exclusively through pf_run_converge_interactive (S-2) — which still redirects
# the home directory to $TMP_HOME (S-1), because step 4 is a full real run that
# installs every skill and rewrites the shim.

# assert_cancelled <label> <payload> — the payload is the answer typed at the
# prompt; "" means the stdin was closed outright.
assert_cancelled() {
  local label="$1" payload="$2" out rc

  pf_setup_case v2-project >/dev/null
  local work_a home_a
  work_a="$(snapshot_tree "$TMP_WORK")"
  home_a="$(snapshot_tree "$TMP_HOME")"

  out="$(pf_run_converge_interactive "$payload" 2>&1)"
  rc=$?

  if [ "$rc" -ne 0 ]; then
    pf_pass "$label: exit $rc — NOT 0"
  else
    pf_fail "$label: exit 0 — cancellation is indistinguishable from success (KI-6)"
  fi
  assert_exit_code 4 "$rc" "$label: the documented cancellation exit code"

  if [ "$work_a" = "$(snapshot_tree "$TMP_WORK")" ]; then
    pf_pass "$label: the project is byte-for-byte unchanged"
  else
    pf_fail "$label: a cancelled run still modified the project"
  fi
  if [ "$home_a" = "$(snapshot_tree "$TMP_HOME")" ] && [ ! -d "$TMP_HOME/.claude/skills" ]; then
    pf_pass "$label: no skills were installed"
  else
    pf_fail "$label: a cancelled run still wrote into \$HOME"
  fi

  # Step 6 — the wording. "Complete!" over a no-op is how defect 1 hid for so long.
  if printf '%s' "$out" | grep -qiE 'cancel|abort' &&
    ! printf '%s' "$out" | grep -qi 'converge complete'; then
    pf_pass "$label: the output says cancelled/aborted and never 'complete'"
  else
    pf_fail "$label: the output does not clearly say the run was cancelled"
  fi
}

# The payloads are $'…' literals, NOT "$(printf …)": command substitution strips
# trailing newlines, which would silently turn "the user pressed Enter" into "the
# stdin was closed" and collapse steps 1 and 5 into the same case.
assert_cancelled "step 1 (empty answer)" $'\n'
assert_cancelled "step 3 (answer 'n')" $'n\n'
# Step 5 — the subtle one: stdin is CLOSED and --yes was not given. "Could not
# ask" is not "the user agreed".
assert_cancelled "step 5 (closed stdin, no --yes)" ""

# Step 4 — and 'y' really does run: cancellation is not being faked by a script
# that refuses to do anything at all.
pf_setup_case v2-project >/dev/null
out="$(pf_run_converge_interactive $'y\n' 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 4: answering 'y' at the prompt runs the convergence"
assert_target_state "$TMP_WORK" "$TMP_HOME"

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-051: one ID, two statuses — BOTH directions; the v3 location wins\n'
# ══════════════════════════════════════════════════════════════════════════════
#
# There is no PATH collision here, which is what makes it dangerous: a naive
# transfer would leave the same ID sitting in open/ AND closed/ at once. /pf
# scans open/ only, so it would happily resurrect closed work.

pf_setup_case collision-same-id >/dev/null

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 1: converge on collision-same-id"

ID_A="20250101-feat-alpha"    # v2 open  vs v3 closed
ID_C="20250103-improve-gamma" # v2 closed vs v3 open

if [ ! -d "$TMP_WORK/docs/issues/open/$ID_A" ]; then # step 2
  pf_pass "step 2: docs/issues/open/$ID_A was NOT created — no second directory for the same ID"
else
  pf_fail "step 2: $ID_A now exists in BOTH statuses — closed work resurrected as open"
fi

if [ -f "$TMP_WORK/docs/issues/closed/$ID_A/analysis.v2.md" ] && # step 3
  [ -f "$TMP_WORK/docs/issues/closed/$ID_A/prompt.v2.md" ]; then
  pf_pass "step 3: the v2 copies of $ID_A merged into docs/issues/closed/ (the v3 location)"
else
  pf_fail "step 3: the v2 copies of $ID_A did not merge into docs/issues/closed/"
fi

if [ ! -d "$TMP_WORK/docs/issues/closed/$ID_C" ]; then # step 4
  pf_pass "step 4: docs/issues/closed/$ID_C was NOT created — the reverse direction holds too"
else
  pf_fail "step 4: $ID_C now exists in BOTH statuses"
fi

if [ -f "$TMP_WORK/docs/issues/open/$ID_C/analysis.v2.md" ] && # step 5
  [ -f "$TMP_WORK/docs/issues/open/$ID_C/prompt.v2.md" ]; then
  pf_pass "step 5: the v2 copies of $ID_C (v2-closed) merged into docs/issues/open/ — the v3 layout is authoritative in BOTH directions"
else
  pf_fail "step 5: the v2 copies of $ID_C did not merge into docs/issues/open/"
fi

# Step 6 — each merge is its own WARNING line, naming the ID and both statuses,
# and it says so ONCE per issue, not once per file.
#
# This is where the report used to lie. `warn` was raised inside map_destination,
# which is only ever reached through `$(map_destination …)` — a subshell — so the
# append to WARNINGS was discarded and the merge never appeared in the final
# WARNINGS block, only on stderr, once per file.
warn_a="$(printf '%s\n' "$out" | grep -c "issue $ID_A is 'open' under planning/ but 'closed' under docs/" || true)"
warn_c="$(printf '%s\n' "$out" | grep -c "issue $ID_C is 'closed' under planning/ but 'open' under docs/" || true)"
if [ "$warn_a" -ge 1 ] && [ "$warn_c" -ge 1 ]; then
  pf_pass "step 6a: both merges are reported as separate WARNING lines, naming the ID and both statuses"
else
  pf_fail "step 6a: the cross-status merges are not both in the WARNING report (A=$warn_a, C=$warn_c)"
fi

# The WARNINGS summary block at the end of the report — not just the stderr line.
summary="$(printf '%s\n' "$out" | sed -n '/^WARNINGS (/,$p')"
if printf '%s\n' "$summary" | grep -qF -- "issue $ID_A is 'open' under planning/" &&
  printf '%s\n' "$summary" | grep -qF -- "issue $ID_C is 'closed' under planning/"; then
  pf_pass "step 6b: both merges reach the final WARNINGS block of the report, not just stderr"
else
  pf_fail "step 6b: the cross-status merges never made it into the final WARNINGS block"
fi

# Step 7 — scan docs/issues/open/ the way /pf does.
open_now="$(cd "$TMP_WORK/docs/issues/open" && find . -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | LC_ALL=C sort | tr '\n' ' ')"
if [ "$open_now" = "20250102-bug-beta $ID_C " ]; then
  pf_pass "step 7: /pf would see exactly the open issues — $ID_A stayed closed, $ID_C stayed open"
else
  pf_fail "step 7: docs/issues/open/ holds '$open_now'"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-052: a name clash inside ONE issue — the .v2.md sidecar\n'
# ══════════════════════════════════════════════════════════════════════════════
#
# Destination exists and DIFFERS -> park the v2 copy as <name>.v2.md, leave the
# v3 copy alone. Destination exists and is BYTE-IDENTICAL -> just drop the
# source; a sidecar there would be pure noise.
#
# ID-B sits in the SAME status (open) in both layouts, which is what isolates the
# name clash from the cross-status merge of TC-051.

ID_B="20250102-bug-beta"
FX="$FIXTURES/collision-same-id"

if [ -f "$TMP_WORK/docs/issues/open/$ID_B/analysis.md" ] && # step 2
  [ -f "$TMP_WORK/docs/issues/open/$ID_B/analysis.v2.md" ]; then
  pf_pass "step 2: both analysis.md (v3) and analysis.v2.md (v2) are present"
else
  pf_fail "step 2: the differing analysis.md did not produce a sidecar"
fi

if cmp -s "$TMP_WORK/docs/issues/open/$ID_B/analysis.md" \
  "$FX/docs/issues/open/$ID_B/analysis.md"; then # step 3
  pf_pass "step 3: analysis.md is byte-identical to the v3 original — the v3 copy was NOT touched"
else
  pf_fail "step 3: the v3 analysis.md was overwritten by the v2 copy"
fi

if cmp -s "$TMP_WORK/docs/issues/open/$ID_B/analysis.v2.md" \
  "$FX/planning/issues/open/$ID_B/analysis.md"; then # step 4
  pf_pass "step 4: analysis.v2.md is byte-identical to the v2 original — nothing was lost"
else
  pf_fail "step 4: analysis.v2.md does not match the v2 original"
fi

if [ ! -e "$TMP_WORK/docs/issues/open/$ID_B/prompt.v2.md" ]; then # step 5
  pf_pass "step 5: prompt.md was byte-identical, so NO prompt.v2.md was minted — the source was just dropped"
else
  pf_fail "step 5: a pointless prompt.v2.md was created for a byte-identical file"
fi

if printf '%s' "$out" | grep -qF -- "docs/issues/open/$ID_B/analysis.v2.md"; then # step 6
  pf_pass "step 6: the kept sidecar is named in the WARNING report"
else
  pf_fail "step 6: the kept sidecar is not named in the report"
fi

# Step 7 — the sidecars must not collide with the exact document names /pf routes
# on (pf/SKILL.md:57-67), or convergence would invent "completed stages".
CANONICAL="brd.md specs.md test_plan.md implementation_plan.md notes.md manual_test_checklist.md qa_report.md analysis.md"
clash=""
while IFS= read -r side; do
  [ -n "$side" ] || continue
  base="$(basename "$side")"
  case " $CANONICAL " in
    *" $base "*) clash="$clash $base" ;;
  esac
done < <(list_sidecars "$TMP_WORK")
if [ -z "$clash" ]; then
  pf_pass "step 7: no sidecar name equals a document /pf routes on — no phantom 'completed stages'"
else
  pf_fail "step 7: sidecar name(s) collide with pipeline documents:$clash"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-053: rename FIRST, detect the collision against the TARGET name\n'
# ══════════════════════════════════════════════════════════════════════════════
#
# ID-B carries planning/…/implementation-plan.md (v2) AND a DIFFERENT
# docs/…/implementation_plan.md (v3). Under the hyphenated name there is no
# clash at all, so a naive mv lands a second plan in the folder — or, worse,
# renames over the v3 one. The suffix must be hung on AFTER normalisation.

d="$TMP_WORK/docs/issues/open/$ID_B"

plans="$(cd "$d" && find . -maxdepth 1 -name '*plan*' -printf '%f\n' | LC_ALL=C sort | tr '\n' ' ')"
if [ "$plans" = "implementation_plan.md implementation_plan.v2.md " ]; then # step 2
  pf_pass "step 2: exactly two plan files — implementation_plan.md (v3) and implementation_plan.v2.md (v2)"
else
  pf_fail "step 2: the plan files are '$plans'"
fi

if [ ! -e "$d/implementation-plan.md" ]; then # step 3
  pf_pass "step 3: no hyphenated implementation-plan.md survives (T10)"
else
  pf_fail "step 3: a hyphenated implementation-plan.md is still there"
fi

if [ ! -e "$d/implementation-plan.v2.md" ]; then # step 4
  pf_pass "step 4: no implementation-plan.v2.md — the suffix went on AFTER the rename, not before"
else
  pf_fail "step 4: implementation-plan.v2.md exists — the collision was detected against the SOURCE name"
fi

if cmp -s "$d/implementation_plan.md" "$FX/docs/issues/open/$ID_B/implementation_plan.md"; then # step 5
  pf_pass "step 5: the v3 plan is byte-identical to the original — it was not overwritten"
else
  pf_fail "step 5: the v3 implementation_plan.md was overwritten"
fi

if cmp -s "$d/implementation_plan.v2.md" "$FX/planning/issues/open/$ID_B/implementation-plan.md"; then
  pf_pass "step 5b: implementation_plan.v2.md carries the v2 plan verbatim"
else
  pf_fail "step 5b: implementation_plan.v2.md does not match the v2 plan"
fi

if printf '%s' "$out" | grep -qF -- "docs/issues/open/$ID_B/implementation_plan.v2.md"; then # step 6
  pf_pass "step 6: the kept v2 plan is reported as a WARNING"
else
  pf_fail "step 6: the kept v2 plan is not in the WARNING report"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-054: file-vs-directory — ERROR, non-zero exit, and planning/ SURVIVES (D-B)\n'
# ══════════════════════════════════════════════════════════════════════════════
#
# The one case where convergence must admit it cannot finish. A .v2.md suffix
# cannot resolve a file-vs-directory clash, and a .v2/ DIRECTORY would show up in
# /pf as a second active issue. So: do not transfer, ERROR on every conflict with
# both paths, do not crash, exit non-zero — and above all DO NOT RUN PHASE 5.
# Silently skipping T9–T11 while erasing the sources is the worst outcome there
# is; an honestly un-converged project is a recoverable one.

pf_setup_case collision-file-dir >/dev/null

# A test-local variation of the copy (S-3 / fixtures README, ground rule 3): a
# hyphenated v2 plan whose NORMALISED destination is a directory. Two things need
# it. (1) T10-inverted (step 7) asserts that a source which was never transferred
# keeps its hyphenated name in planning/ — but every hyphenated plan that CAN be
# transferred is renamed on the way, so only a BLOCKED one can be found there.
# (2) It puts the TC-053 rule (normalise, then detect) on the file-vs-dir path:
# the clash exists solely under the target name.
plant="$TMP_WORK/planning/issues/open/20250101-feat-alpha"
printf '# v2 plan for alpha\n' >"$plant/implementation-plan.md"
mkdir -p "$TMP_WORK/docs/issues/open/20250101-feat-alpha/implementation_plan.md"
printf 'a directory, not a plan\n' >"$TMP_WORK/docs/issues/open/20250101-feat-alpha/implementation_plan.md/inner.md"

out="$(pf_run_converge 2>&1)"
rc=$?

if [ "$rc" -ne 0 ]; then # step 1
  pf_pass "step 1a: a file-vs-directory collision gives a non-zero exit ($rc)"
else
  pf_fail "step 1a: convergence reported success over an unresolved collision"
fi
assert_exit_code 1 "$rc" "step 1b: the documented 'ran, but did not converge' exit code"

if ! printf '%s' "$out" | grep -qi 'converge complete' &&
  ! printf '%s' "$out" | grep -qiE 'line [0-9]+:|Traceback'; then
  pf_pass "step 1c: it did not crash mid-phase and it did not claim to be complete"
else
  pf_fail "step 1c: either a crash trace or a bogus 'complete' in the output"
fi

# Step 2 — one ERROR per conflict, each naming BOTH paths and asking for a human.
n_err=0
for id in 20250101-feat-alpha 20250102-bug-beta; do
  if printf '%s\n' "$out" | grep -i 'ERROR' | grep -q "$id"; then
    n_err=$((n_err + 1))
  fi
done
if [ "$n_err" -eq 2 ] &&
  printf '%s' "$out" | grep -qi 'file-vs-directory' &&
  printf '%s' "$out" | grep -qi 'by hand'; then
  pf_pass "step 2a: an ERROR line for each conflicting issue, naming both paths and asking for a manual fix"
else
  pf_fail "step 2a: expected an ERROR per conflict; matched $n_err"
fi
# Both directions: destination-is-a-directory, and an ancestor-is-a-file.
if printf '%s' "$out" | grep -q 'is a file but destination' &&
  printf '%s' "$out" | grep -q 'which is a file, not a directory'; then
  pf_pass "step 2b: both directions of the clash are diagnosed (dest is a dir; a path component is a file)"
else
  pf_fail "step 2b: only one direction of the file-vs-directory clash is diagnosed"
fi

# Step 3 — the conflicting destinations in docs/ are untouched.
if [ -d "$TMP_WORK/docs/issues/open/20250101-feat-alpha/notes.md" ] &&
  [ -f "$TMP_WORK/docs/issues/open/20250101-feat-alpha/notes.md/inner.md" ] &&
  [ -f "$TMP_WORK/docs/issues/open/20250102-bug-beta/notes.md" ] &&
  [ ! -d "$TMP_WORK/docs/issues/open/20250102-bug-beta/notes.md" ]; then
  pf_pass "step 3: the conflicting paths under docs/ are exactly as they were — nothing was forced over them"
else
  pf_fail "step 3: a conflicting destination under docs/ was modified"
fi

# Step 4 — phase 3 still finished the job on every NON-conflicting element.
if [ -f "$TMP_WORK/docs/issues/open/20250103-improve-gamma/prompt.md" ] &&
  [ -f "$TMP_WORK/docs/issues/open/20250103-improve-gamma/analysis.md" ] &&
  [ -f "$TMP_WORK/docs/issues/open/20250101-feat-alpha/prompt.md" ]; then
  pf_pass "step 4: the conflict-free issue transferred in full — one bad element does not abort the phase"
else
  pf_fail "step 4: non-conflicting files were left behind"
fi

# Steps 5–8 — T1–T8 hold (the top-up is safe and happens); T9/T10/T11 inverted.
# Step 8 (T11-inv) is DEFERRED to Task 8 and reported as such by the harness.
assert_target_state --no-destructive "$TMP_WORK" "$TMP_HOME"

if [ -d "$TMP_WORK/planning/issues" ] && # step 6, explicitly
  [ -f "$TMP_WORK/planning/issues/open/20250101-feat-alpha/notes.md" ] &&
  [ -f "$TMP_WORK/planning/issues/open/20250102-bug-beta/notes.md/inner.md" ]; then
  pf_pass "step 6: phase 5 never ran — planning/ is intact, conflicting sources included"
else
  pf_fail "step 6: planning/ or a conflicting source was deleted despite the failed transfer (D-B violated)"
fi

if printf '%s' "$out" | grep -qi 'Phase 5.*SKIPPED'; then
  pf_pass "step 6b: the output says out loud that phase 5 was skipped"
else
  pf_fail "step 6b: nothing in the output says phase 5 was skipped"
fi

# Step 7 — the blocked source keeps its hyphenated name: normalisation did not
# tidy away a file that was never carried across.
if [ -f "$plant/implementation-plan.md" ]; then
  pf_pass "step 7: the blocked implementation-plan.md still sits in planning/, hyphen and all"
else
  pf_fail "step 7: the blocked source was normalised or removed anyway"
fi

if [ "$(count_backups "$TMP_WORK")" -ge 1 ]; then # step 9
  pf_pass "step 9: a backup was taken — the conflicting sources are recoverable from it"
else
  pf_fail "step 9: no backup was created"
fi

# Step 10 — no phantom issue directory. A `.v2/` directory under docs/issues/open/
# would read to /pf as a second active issue.
phantom="$(find "$TMP_WORK/docs/issues" -type d -name '*.v2' 2>/dev/null)"
if [ -z "$phantom" ]; then
  pf_pass "step 10: no .v2 DIRECTORY was invented — no phantom issue for /pf to pick up"
else
  pf_fail "step 10: phantom .v2 directory created: $phantom"
fi

# Step 11 — resolve the three clashes by hand, run again: it converges fully and
# planning/ finally goes.
mv "$TMP_WORK/docs/issues/open/20250101-feat-alpha/notes.md" \
  "$TMP_WORK/docs/issues/open/20250101-feat-alpha/notes-v3-dir"
mv "$TMP_WORK/docs/issues/open/20250101-feat-alpha/implementation_plan.md" \
  "$TMP_WORK/docs/issues/open/20250101-feat-alpha/plan-v3-dir"
mv "$TMP_WORK/docs/issues/open/20250102-bug-beta/notes.md" \
  "$TMP_WORK/docs/issues/open/20250102-bug-beta/notes-v3.md"

rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 11a: once the clashes are resolved by hand, convergence completes"
assert_target_state "$TMP_WORK" "$TMP_HOME" # full T1–T11 this time
if [ ! -e "$TMP_WORK/planning" ]; then
  pf_pass "step 11b: planning/ is gone — phase 5 ran on the second, successful pass"
else
  pf_fail "step 11b: planning/ survived a successful convergence"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-055: the .v2.md suffix never grows a second .v2 (no .v2.v2.md)\n'
# ══════════════════════════════════════════════════════════════════════════════
#
# The state to reach is "the sidecar is already written, but the source is still
# in planning/" — a crash between parking the copy and dropping the source. It is
# built deterministically with the --fail-after hook (D-F) plus a restore of the
# source out of the backup convergence itself just took, rather than by racing a
# SIGKILL.

export PF_CONVERGE_TEST_HOOKS=1

pf_setup_case mixed-layout >/dev/null

# mixed-layout's analysis.md is byte-identical in both layouts, which produces no
# sidecar at all. Make the v2 copy differ, so parking one is the correct move.
printf '\na line only the v2 copy has\n' >>"$TMP_WORK/planning/issues/open/20250101-feat-alpha/analysis.md"

rc=0
pf_run_converge --fail-after=1 >/dev/null 2>&1 || rc=$?
assert_exit_code 70 "$rc" "setup: the run was interrupted right after the first file (D-F)"

side="$TMP_WORK/docs/issues/open/20250101-feat-alpha/analysis.v2.md"
if [ -f "$side" ]; then
  pf_pass "setup: the sidecar analysis.v2.md was parked before the interruption"
else
  pf_fail "setup: no sidecar was parked — the rest of this TC would prove nothing"
fi

# The crash we are simulating happened BETWEEN parking the copy and dropping the
# source, so put the source back exactly as the backup has it.
bak="$(find "$TMP_WORK" -maxdepth 1 -type d -name 'planning-backup-*' | head -n 1)"
cp -a "$bak/planning/issues/open/20250101-feat-alpha/analysis.md" \
  "$TMP_WORK/planning/issues/open/20250101-feat-alpha/analysis.md"

sidecars_before="$(list_sidecars "$TMP_WORK" | grep -c . || true)"

rc=0
pf_run_converge >/dev/null 2>&1 || rc=$? # step 1
assert_exit_code 0 "$rc" "step 1: the recovery run finishes the job"

grown="$(find "$TMP_WORK/docs" -name '*.v2.v2.md' -o -name '*.v2.v2' 2>/dev/null)" # step 2
if [ -z "$grown" ]; then
  pf_pass "step 2: no *.v2.v2.md — the suffix did not grow"
else
  pf_fail "step 2: the suffix grew: $grown"
fi

sidecars_after="$(list_sidecars "$TMP_WORK" | grep -c . || true)" # step 3
if [ "$sidecars_after" -eq "$sidecars_before" ]; then
  pf_pass "step 3: still $sidecars_after sidecar(s) — the already-parked copy was recognised, not duplicated"
else
  pf_fail "step 3: sidecar count went from $sidecars_before to $sidecars_after"
fi

if [ ! -e "$TMP_WORK/planning/issues" ]; then # step 4
  pf_pass "step 4: planning/issues/ is gone — the restored source was dropped, not parked again"
else
  pf_fail "step 4: planning/issues/ survived the recovery run"
fi

after_second="$(snapshot_tree "$TMP_WORK")" # step 5
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 5a: a third run still exits 0"
if [ "$after_second" = "$(snapshot_tree "$TMP_WORK")" ]; then
  pf_pass "step 5b: the third run is byte-for-byte identical to the second — repeated crashes cannot avalanche sidecars"
else
  pf_fail "step 5b: the third run changed the tree"
  diff <(printf '%s\n' "$after_second") <(snapshot_tree "$TMP_WORK") | head -20 >&2
fi

unset PF_CONVERGE_TEST_HOOKS

# ══════════════════════════════════════════════════════════════════════════════
assert_repo_untouched
pf_summary
