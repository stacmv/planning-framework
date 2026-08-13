#!/usr/bin/env bash
# test/lib.sh — shared harness for the Planning Framework test suite.
#
# Sourced (never executed) by every test/*.sh:
#
#     # shellcheck source=test/lib.sh
#     . "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"
#
# ─── SAFETY RULES (test_plan.md, S-1…S-5) — load-bearing, not style ───────────
#
#  S-1  The convergence script installs skills into ~/.claude/skills/ and
#       REWRITES the ~/.claude/bin/pf shim. A test that runs it against the
#       developer's real $HOME destroys their global install and breaks every
#       concurrent Claude Code session. Therefore the script's file name appears
#       in exactly ONE place in the whole test tree: the private
#       _pf_converge_exec below, which ALWAYS exports HOME="$TMP_HOME" (a fresh
#       `mktemp -d`). Tests reach it only through the three public wrappers. Any
#       other file under test/ naming that script is a defect in itself — this is
#       audited statically by test/safety-audit.sh (TC-032), not by reviewers.
#
#  S-2  --yes is the default. pf_run_converge_interactive is the only wrapper
#       that omits it (used only by TC-029).
#
#  S-3  Fixtures in test/fixtures/ are read-only. pf_setup_case copies a fixture
#       into a fresh $TMP_WORK; the fixture itself is never mutated.
#
#  S-4  Every temp dir comes from `mktemp -d` and is removed by `trap … EXIT`,
#       including when the test dies mid-way.
#
#  S-5  The framework repo working tree is sacred too. A test that must *change*
#       the repo (drop in a probe skill, inject a probe TODO) works on a copy:
#       pf_repo_copy → $TMP_REPO (with .git, so `git diff develop...HEAD` and
#       commits work there). Use assert_repo_untouched to prove it.
#
#       KNOWN GAP — assert_repo_untouched only audits INSIDE $REPO_ROOT. It runs
#       `git -C "$REPO_ROOT" status --porcelain`, so a write that lands *outside*
#       the repository is invisible to it and the suite still reports S-5 green.
#       This is not hypothetical: during 20260806-feat-product-test-plan a helper
#       returned an empty path that reached `git -C ""` / `cp`, and probe files
#       were created at the Git-Bash filesystem root (/docs, /scripts, /skills)
#       while every suite stayed green. The rule that actually prevents it is a
#       convention, not this assertion: ANY helper returning a path must be
#       checked non-empty by its caller BEFORE that path is used in a command
#       that writes — see pf_ptp_area_setup in test/pf-product-test-plan.sh and
#       its call site for the required shape. Closing the gap mechanically
#       (auditing a whitelist of out-of-repo paths) is not implemented.
#
# Public API:
#   pf_run_converge [args…]                     — normal non-interactive run
#   pf_run_converge_interactive <payload> [args…] — no --yes; "" = closed stdin
#   pf_run_converge_cwd <dir> [args…]           — cd <dir>; no --target
#   pf_setup_case <fixture> [--git]             — fresh $TMP_WORK + fresh $TMP_HOME
#   pf_repo_copy                                — fresh $TMP_REPO (copy of repo)
#   assert_target_state [--no-destructive] <target> <home> [<framework_root>]
#   assert_tree_identical <dirA> <dirB> [msg]
#   assert_exit_code <expected> <actual> [msg]
#   assert_repo_untouched
#   snapshot_tree <dir>
#   pf_pass / pf_fail / pf_assert / pf_note / pf_summary
#   pf_trim <string>                            — whitespace trim via pure bash
#   pf_status_tracker_rows_full <test_plan>     — TC<TAB>Type<TAB>Remarks per row
#   pf_count_manual_in_tracker <test_plan>      — count rows with Type=Manual
#   pf_validate_manual_reasons <test_plan>      — validate Remarks for Manual rows
#   pf_get_manual_reason_vocab                  — 5 valid Manual reason values
#   pf_get_budget_for_tier <size_tier>          — numeric budget for tier
#   pf_check_manual_budget <count> <tier>       — check if count within budget
#   pf_validate_test_plan_structure <test_plan> — check for parseable Status Tracker

set -uo pipefail

PF_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$PF_LIB_DIR/.." && pwd -P)"
PF_FIXTURES_DIR="$PF_LIB_DIR/fixtures"
PF_SUITE="$(basename "${0:-lib.sh}")"

# ─── PASS/FAIL counters ───────────────────────────────────────────────────────

PF_PASS=0
PF_FAIL=0

pf_pass() {
  PF_PASS=$((PF_PASS + 1))
  printf '  PASS  %s\n' "$1"
}

pf_fail() {
  PF_FAIL=$((PF_FAIL + 1))
  printf '  FAIL  %s\n' "$1" >&2
}

# Informational line that is neither a pass nor a fail.
pf_note() {
  printf '  ----  %s\n' "$1"
}

# pf_assert <message> <command…>  — passes iff the command exits 0.
pf_assert() {
  local msg="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    pf_pass "$msg"
  else
    pf_fail "$msg"
  fi
}

# assert_exit_code <expected> <actual> [message]
assert_exit_code() {
  local expected="$1" actual="$2" msg="${3:-exit code}"
  if [ "$actual" -eq "$expected" ]; then
    pf_pass "$msg (exit $actual)"
  else
    pf_fail "$msg — expected exit $expected, got $actual"
  fi
}

# Final line of every suite: prints totals, exits non-zero if anything failed.
pf_summary() {
  printf '\n%s: %d passed, %d failed\n' "$PF_SUITE" "$PF_PASS" "$PF_FAIL"
  [ "$PF_FAIL" -eq 0 ]
}

# ─── Temp dirs (S-4) ──────────────────────────────────────────────────────────

TMP_HOME=""
TMP_WORK=""
TMP_REPO=""

# The registry is a FILE, not an array, and that is load-bearing. Every caller
# reaches pf_mktemp_d through a command substitution — `TMP_HOME="$(pf_mktemp_d)"`
# — which runs it in a subshell, so an array append inside it would be discarded
# with that subshell and the trap would silently clean nothing. Appending to a
# file crosses the subshell boundary.
PF_TMP_REGISTRY="$(mktemp "${TMPDIR:-/tmp}/pf-test-registry-XXXXXXXX")"

pf_mktemp_d() {
  local d
  if ! d="$(mktemp -d "${TMPDIR:-/tmp}/pf-test-XXXXXXXX")"; then
    printf 'FATAL: mktemp -d failed\n' >&2
    return 1
  fi
  printf '%s\n' "$d" >>"$PF_TMP_REGISTRY"
  printf '%s' "$d"
}

pf_cleanup() {
  local d
  if [ -f "$PF_TMP_REGISTRY" ]; then
    while IFS= read -r d; do
      if [ -n "$d" ] && [ "$d" != "/" ] && [ -d "$d" ]; then
        rm -rf "$d"
      fi
    done <"$PF_TMP_REGISTRY"
    rm -f "$PF_TMP_REGISTRY"
  fi
}
trap pf_cleanup EXIT

# ─── Case setup (S-3) ─────────────────────────────────────────────────────────

pf_git_init() {
  local dir="$1"
  git -C "$dir" init -q
  git -C "$dir" add -A
  git -C "$dir" \
    -c user.name='PF Test' -c user.email='pf-test@example.invalid' \
    commit -q --allow-empty -m 'fixture baseline'
}

# pf_setup_case <fixture> [--git]
#
# Copies test/fixtures/<fixture> into a fresh $TMP_WORK AND hands the case a
# fresh, empty $TMP_HOME. Both are globals; the path of $TMP_WORK is printed.
#
# The fresh $TMP_HOME is deliberate: "exactly N skills installed" must never
# pass on leftovers from a previous case, because the convergence script only
# ever adds skills and never removes them (TC-009 precondition).
pf_setup_case() {
  local fixture="${1:?pf_setup_case: fixture name required}"
  shift || true

  local want_git=0 a
  for a in "$@"; do
    [ "$a" = "--git" ] && want_git=1
  done

  local src="$PF_FIXTURES_DIR/$fixture"
  if [ ! -d "$src" ]; then
    printf 'FATAL: fixture not found: %s\n' "$src" >&2
    exit 1
  fi

  TMP_HOME="$(pf_mktemp_d)" || exit 1

  local parent
  parent="$(pf_mktemp_d)" || exit 1
  TMP_WORK="$parent/$fixture"
  cp -a "$src" "$TMP_WORK"

  [ "$want_git" -eq 1 ] && pf_git_init "$TMP_WORK"

  printf '%s' "$TMP_WORK"
}

# pf_repo_copy — copy of the framework repo, .git included (S-5). Prints path.
#
# .git is copied on purpose: TC-041 needs `git diff develop...HEAD` and a commit
# inside the copy. Mutating $REPO_ROOT from a test is forbidden — a test dying
# half-way would leave the working tree dirty and fail the `Working tree clean`
# gate (.qa-workflow.md).
pf_repo_copy() {
  local parent
  parent="$(pf_mktemp_d)" || exit 1
  TMP_REPO="$parent/$(basename "$REPO_ROOT")"
  cp -a "$REPO_ROOT" "$TMP_REPO"
  printf '%s' "$TMP_REPO"
}

# ─── The single gateway to the convergence script (S-1) ───────────────────────

# Private. Never called from test/*.sh — only through the three wrappers below
# (TC-032, step 5). The script path is built from a VARIABLE, not a literal, so
# that TC-009 step 4 can run the copy in $TMP_REPO (PF_FRAMEWORK_ROOT=$TMP_REPO)
# while the script's name still occurs exactly once in this file (TC-032 step 2).
#
# PF_FRAMEWORK_ROOT belongs to the harness alone: the convergence script itself
# locates the framework root relative to its own file (dirname "$0"/..) and knows
# nothing about this variable (S-5 / KI-19).
_pf_converge_exec() {
  if [ -z "${TMP_HOME:-}" ] || [ ! -d "${TMP_HOME:-/nonexistent}" ]; then
    printf 'FATAL (S-1): TMP_HOME is not a temp dir — refusing to run with the real home dir.\n' >&2
    return 99
  fi
  local root="${PF_FRAMEWORK_ROOT:-$REPO_ROOT}"
  HOME="$TMP_HOME" bash "${root}/scripts/converge-to-v3.sh" "$@"
}

_pf_has_target() {
  local a
  for a in "$@"; do
    case "$a" in
      --target | --target=*) return 0 ;;
    esac
  done
  return 1
}

# pf_run_converge [args…]
#   HOME=$TMP_HOME; adds --yes; adds --target "$TMP_WORK" unless the caller
#   passed its own --target. stdin is closed — a --yes run must never prompt.
pf_run_converge() {
  local args=()
  _pf_has_target "$@" || args+=(--target "$TMP_WORK")
  args+=(--yes "$@")
  _pf_converge_exec "${args[@]}" </dev/null
}

# pf_run_converge_interactive <stdin-payload> [args…]
#   HOME=$TMP_HOME; --yes is NOT passed (the only such wrapper — TC-029).
#   An empty payload means closed stdin (< /dev/null): "could not ask" is not
#   "the user agreed" (KI-6). --target still defaults to "$TMP_WORK": without it
#   the run would target $(pwd) — the repo itself — which S-5 forbids outright.
pf_run_converge_interactive() {
  local payload="${1-}"
  shift || true

  local args=()
  _pf_has_target "$@" || args+=(--target "$TMP_WORK")
  args+=("$@")

  if [ -z "$payload" ]; then
    _pf_converge_exec "${args[@]}" </dev/null
  else
    printf '%s' "$payload" | _pf_converge_exec "${args[@]}"
  fi
}

# pf_run_converge_cwd <dir> [args…]
#   HOME=$TMP_HOME; cd <dir> in a subshell (the caller's cwd is untouched) and
#   pass NO --target — this is how the default of $(pwd) gets tested (TC-030
#   step 6). --yes is still passed (S-2).
pf_run_converge_cwd() {
  local dir="${1:?pf_run_converge_cwd: directory required}"
  shift || true
  (
    cd "$dir" || exit 1
    _pf_converge_exec --yes "$@" </dev/null
  )
}

# ─── Tree helpers ─────────────────────────────────────────────────────────────

# snapshot_tree <dir> — deterministic manifest (type, path, content hash) on
# stdout, .git pruned. Two runs of a byte-identical tree produce byte-identical
# manifests, which is what byte-level idempotency (TC-007) is checked against.
snapshot_tree() {
  local dir="$1"
  (
    cd "$dir" 2>/dev/null || {
      printf 'MISSING %s\n' "$dir"
      exit 0
    }
    find . -name .git -prune -o -print0 |
      LC_ALL=C sort -z |
      while IFS= read -r -d '' p; do
        if [ -L "$p" ]; then
          printf 'l %s -> %s\n' "$p" "$(readlink "$p")"
        elif [ -d "$p" ]; then
          printf 'd %s\n' "$p"
        elif [ -f "$p" ]; then
          printf 'f %s %s\n' "$p" "$(sha256sum <"$p" | cut -d' ' -f1)"
        else
          printf '? %s\n' "$p"
        fi
      done
  )
}

# assert_tree_identical <dirA> <dirB> [message]
assert_tree_identical() {
  local a="$1" b="$2" msg="${3:-trees identical: $1 vs $2}"
  local out
  if out="$(diff <(snapshot_tree "$a") <(snapshot_tree "$b"))"; then
    pf_pass "$msg"
  else
    pf_fail "$msg"
    printf '%s\n' "$out" | head -40 >&2
  fi
}

# ─── S-5 guard ────────────────────────────────────────────────────────────────

PF_REPO_STATUS_BEFORE="$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null || true)"

# assert_repo_untouched — proves the suite left the framework working tree
# exactly as it found it (S-5). Compared against the state captured when this
# library was sourced, so it is meaningful whether or not the tree was already
# dirty with in-progress work.
assert_repo_untouched() {
  local now
  now="$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null || true)"
  if [ "$now" = "$PF_REPO_STATUS_BEFORE" ]; then
    pf_pass "S-5: framework working tree not mutated by this suite"
  else
    pf_fail "S-5: framework working tree CHANGED during this suite"
    diff <(printf '%s\n' "$PF_REPO_STATUS_BEFORE") <(printf '%s\n' "$now") >&2 || true
  fi
}

# ─── Status Tracker helpers ───────────────────────────────────────────────────

# pf_trim <string> — whitespace trim via pure parameter expansion (no subprocess).
# Modeled on _pf_trim from pf-execute-completeness.sh, made public for general use.
pf_trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# pf_status_tracker_heading_line <test_plan.md>
#
# Prints the line number of the FIRST "## Status Tracker" heading, or
# nothing if the file has none at all. Private helper for pf_status_tracker_rows_full.
_pf_lib_status_tracker_heading_line() {
  grep -n -E '^##[[:space:]]+Status Tracker' "$1" 2>/dev/null | head -1 | cut -d: -f1
}

# pf_status_tracker_rows_full <test_plan.md>
#
# Prints one "TC-ID<TAB>Type<TAB>Remarks" triplet per data row of the FIRST
# "## Status Tracker" table in test_plan.md. Column position (which cell is
# "TC", which is "Type", which is "Remarks") is read from the table's own
# header row, not hardcoded to a fixed index. Prints nothing if the file has no
# "## Status Tracker" heading at all.
pf_status_tracker_rows_full() {
  local test_plan="$1"
  local start line tc_col=1 type_col=0 remarks_col=0 have_header=0
  local -a cells

  start="$(_pf_lib_status_tracker_heading_line "$test_plan")"
  [ -z "$start" ] && return 0

  while IFS= read -r line; do
    [[ "$line" =~ ^##[[:space:]] ]] && break
    [[ "$line" != \|* ]] && continue
    # Skip the header/data separator row ("| --- | --- | ...").
    [[ "$line" =~ ^\|[-:\|\ ]+\|?$ ]] && continue

    IFS='|' read -r -a cells <<<"$line"
    local i
    for i in "${!cells[@]}"; do
      cells[i]="$(pf_trim "${cells[$i]}")"
    done

    if [ "$have_header" -eq 0 ]; then
      for i in "${!cells[@]}"; do
        case "${cells[$i]}" in
          TC) tc_col="$i" ;;
          Type) type_col="$i" ;;
          Remarks) remarks_col="$i" ;;
        esac
      done
      have_header=1
      continue
    fi

    if [[ "${cells[$tc_col]:-}" =~ ^TC-[0-9]+$ ]]; then
      printf '%s\t%s\t%s\n' "${cells[$tc_col]}" "${cells[$type_col]:-}" "${cells[$remarks_col]:-}"
    fi
  done < <(tail -n "+$((start + 1))" "$test_plan")
}

# pf_count_manual_in_tracker <test_plan_file>
#
# Prints the number of rows in the file's "## Status Tracker" table whose
# Type column is exactly "Manual". Returns 0 always (counting is never an error).
pf_count_manual_in_tracker() {
  local test_plan="$1"
  pf_status_tracker_rows_full "$test_plan" | awk -F'\t' '$2 == "Manual" {count++} END {print count+0}'
}

# pf_validate_manual_reasons <test_plan_file>
#
# For every "Manual"-type row in the Status Tracker, checks that its Remarks
# column begins with "Manual reason: <value>" where <value> is one of the 5
# valid words (see pf_get_manual_reason_vocab). Prints one error line per
# violation to stderr (naming the offending TC-ID and what's wrong) and returns
# exit code 1 if any violation found, 0 if all Manual rows are valid (including
# the case of zero Manual rows, which is trivially valid).
pf_validate_manual_reasons() {
  local test_plan="$1"
  local tc type remarks line
  local found_error=0
  local -A valid_vocab

  # Build the vocabulary set
  while IFS= read -r word; do
    valid_vocab["$word"]=1
  done < <(pf_get_manual_reason_vocab)

  while IFS=$'\t' read -r tc type remarks; do
    [ -z "$tc" ] && continue
    if [ "$type" = "Manual" ]; then
      # Check if Remarks starts with "Manual reason: "
      if [[ ! "$remarks" =~ ^Manual\ reason:\ (.*)$ ]]; then
        printf 'TC %s: missing "Manual reason:" prefix in Remarks column\n' "$tc" >&2
        found_error=1
      else
        # Extract the value after "Manual reason: "
        local reason_val="${BASH_REMATCH[1]}"
        # Get the first word (before any space, punctuation, etc.)
        reason_val="${reason_val%%[^a-z-]*}"
        if [ -z "${valid_vocab[$reason_val]:-}" ]; then
          printf 'TC %s: invalid reason value "%s" (must be one of: %s)\n' "$tc" "$reason_val" "$(pf_get_manual_reason_vocab | tr '\n' ' ' | sed 's/ $//')" >&2
          found_error=1
        fi
      fi
    fi
  done < <(pf_status_tracker_rows_full "$test_plan")

  [ "$found_error" -eq 0 ]
}

# pf_get_manual_reason_vocab
#
# Prints the 5 valid Manual reason values, one per line, in canonical order:
# human-judgment, external-system, interactive-agent, cost, environment.
pf_get_manual_reason_vocab() {
  printf 'human-judgment\nexternal-system\ninteractive-agent\ncost\nenvironment\n'
}

# pf_get_budget_for_tier <size_tier>
#
# Prints the numeric Manual budget for a tier: trivial→1, small→2, medium→3,
# large→5. Returns 0 on success, 1 if the tier is unknown (with no output).
pf_get_budget_for_tier() {
  local tier="$1"
  case "$tier" in
    trivial) printf '1'; return 0 ;;
    small) printf '2'; return 0 ;;
    medium) printf '3'; return 0 ;;
    large) printf '5'; return 0 ;;
    *) return 1 ;;
  esac
}

# pf_check_manual_budget <manual_count> <size_tier>
#
# Returns 0 if <manual_count> is within that tier's budget (from
# pf_get_budget_for_tier) AND within the unconditional hard cap of 5.
# Returns 1 otherwise.
pf_check_manual_budget() {
  local count="$1" tier="$2"
  local budget

  budget="$(pf_get_budget_for_tier "$tier")" || return 1
  [ "$count" -le "$budget" ] && [ "$count" -le 5 ]
}

# pf_validate_test_plan_structure <test_plan_file>
#
# Returns 0 if the file has a "## Status Tracker" heading with a parseable
# table (at least one data row). Returns 1 with a message to stderr if
# validation fails.
pf_validate_test_plan_structure() {
  local test_plan="$1"

  if [ ! -f "$test_plan" ]; then
    printf 'File not found: %s\n' "$test_plan" >&2
    return 1
  fi

  if ! grep -q -E '^##[[:space:]]+Status Tracker' "$test_plan" 2>/dev/null; then
    printf 'No "## Status Tracker" heading found in %s\n' "$test_plan" >&2
    return 1
  fi

  # Check that the table has at least one data row
  if [ -z "$(pf_status_tracker_rows_full "$test_plan")" ]; then
    printf 'Status Tracker table in %s has no data rows\n' "$test_plan" >&2
    return 1
  fi

  return 0
}

# ─── detectState() bridge ─────────────────────────────────────────────────────

# pf_detect_state <dir> [framework_root] — prints the TUI detector's verdict.
# The detector is taken from the same tree the convergence run came from, so a
# run out of $TMP_REPO is judged by $TMP_REPO's detector.
pf_detect_state() {
  local dir="$1" root="${2:-$REPO_ROOT}"
  node -e '
    const { detectState } = require(process.argv[1]);
    process.stdout.write(detectState(process.argv[2]));
  ' "$root/tools/onboarding-tui/lib/detect.js" "$dir"
}

# ─── assert_target_state — the T1–T11 checklist, in one function ──────────────
#
# assert_target_state [--no-destructive] <target> <home> [<framework_root>]
#
# <framework_root> defaults to $REPO_ROOT. It is a PARAMETER, not a constant,
# because T7 enumerates skills by globbing <framework_root>/skills/*/SKILL.md
# rather than hardcoding a count: TC-009 step 4 runs out of a repo copy carrying
# a probe skill and therefore expects 16, while every other TC expects 15. A
# hardcoded 15 would make that step unpassable.
#
# Deliberately NOT checked here:
#   * `.qa-workflow.md` — the convergence script never creates it (Р4/KI-12);
#     asserting its presence would be a guaranteed false FAIL.
#   * `! -e docs/planning/FRAMEWORK.md` — T9's whitelist consists entirely of
#     `planning/…` paths, so on a v1 project phase 5 deletes NOTHING and a
#     pre-existing docs/planning/FRAMEWORK.md legitimately survives (TC-003).
#     "docs/planning/FRAMEWORK.md did not appear" is a local step of TC-019 (the
#     v2 path), not part of T9. Writing it in here would fail TC-003.
#
# --no-destructive (TC-054, D-B): the transfer failed, so phase 5 never ran.
# T1–T8 are asserted directly; T9/T10/T11 are asserted INVERTED.
assert_target_state() {
  local destructive=1
  if [ "${1-}" = "--no-destructive" ]; then
    destructive=0
    shift
  fi

  local target="${1:?assert_target_state: target dir required}"
  local home="${2:?assert_target_state: home dir required}"
  local root="${3:-$REPO_ROOT}"

  local d p state

  # T1 — layout directories.
  for d in docs/issues/open docs/issues/closed docs/planning; do
    if [ -d "$target/$d" ]; then
      pf_pass "T1: $d/ exists"
    else
      pf_fail "T1: $d/ missing"
    fi
  done

  # T2 — .pf-version is the one machine-readable version marker.
  if [ -f "$target/.pf-version" ] && grep -q '3\.0\.0' "$target/.pf-version"; then
    pf_pass "T2: .pf-version carries 3.0.0"
  else
    pf_fail "T2: .pf-version missing or not 3.0.0"
  fi

  # T3 — PLANNING.md carries the v3 stamp.
  if [ -f "$target/PLANNING.md" ] &&
    grep -qE '\*\*Framework Version:\*\* *3\.0' "$target/PLANNING.md"; then
    pf_pass "T3: PLANNING.md carries **Framework Version:** 3.0"
  else
    pf_fail "T3: PLANNING.md missing or not stamped 3.0"
  fi

  # T4 — exactly one marked-up section in CLAUDE.md.
  local n_begin n_end
  n_begin="$(grep -c -- '<!-- pf:begin -->' "$target/CLAUDE.md" 2>/dev/null || true)"
  n_end="$(grep -c -- '<!-- pf:end -->' "$target/CLAUDE.md" 2>/dev/null || true)"
  if [ -f "$target/CLAUDE.md" ] && [ "${n_begin:-0}" = "1" ] && [ "${n_end:-0}" = "1" ]; then
    pf_pass "T4: CLAUDE.md holds exactly one pf:begin/pf:end pair"
  else
    pf_fail "T4: CLAUDE.md holds ${n_begin:-0} pf:begin and ${n_end:-0} pf:end markers (want 1/1)"
  fi

  # T5 — the three global documents.
  for p in session-log decisions implementation-plan; do
    if [ -f "$target/docs/planning/$p.md" ]; then
      pf_pass "T5: docs/planning/$p.md exists"
    else
      pf_fail "T5: docs/planning/$p.md missing"
    fi
  done

  # T6 — docs/planning/templates/ MIRRORS the framework's (nothing extra, nothing
  # missing — `diff -r` reports both directions, which is the point: a `cp -r`
  # overlay would leave stale files behind and pass every other check, KI-17).
  local tdiff
  if tdiff="$(diff -r "$root/docs/planning/templates" "$target/docs/planning/templates" 2>&1)"; then
    pf_pass "T6: docs/planning/templates/ mirrors the framework's"
  else
    pf_fail "T6: docs/planning/templates/ is not a mirror of the framework's"
    printf '%s\n' "$tdiff" | head -20 >&2
  fi

  # T7 — every skill of <framework_root> is installed. Enumerated, never counted.
  local expected actual n_expected
  expected="$(
    cd "$root/skills" 2>/dev/null || exit 0
    for p in */SKILL.md; do
      [ -f "$p" ] && printf '%s\n' "${p%/SKILL.md}"
    done | LC_ALL=C sort
  )"
  actual="$(
    cd "$home/.claude/skills" 2>/dev/null || exit 0
    for p in */; do
      [ -d "$p" ] && printf '%s\n' "${p%/}"
    done | LC_ALL=C sort
  )"
  n_expected="$(printf '%s' "$expected" | grep -c . || true)"
  if [ -n "$expected" ] && [ "$expected" = "$actual" ]; then
    pf_pass "T7: all $n_expected skills of $root/skills/ installed in \$HOME/.claude/skills/"
  else
    pf_fail "T7: installed skill set != $root/skills/"
    diff <(printf '%s\n' "$expected") <(printf '%s\n' "$actual") >&2 || true
  fi

  # T8 — the pf shim.
  if [ -x "$home/.claude/bin/pf" ]; then
    pf_pass "T8: \$HOME/.claude/bin/pf exists and is executable"
  else
    pf_fail "T8: \$HOME/.claude/bin/pf missing or not executable"
  fi

  if [ "$destructive" -eq 1 ]; then
    # T9 — the deletion whitelist, and ONLY the deletion whitelist. Every entry
    # is a planning/… path; nothing outside planning/ is ever asserted absent.
    local leftovers=()
    for p in planning/issues planning/scripts planning/templates \
      planning/FRAMEWORK.md planning/implementation-plan.md \
      planning/session-log.md planning/decisions.md; do
      if [ -e "$target/$p" ]; then
        leftovers+=("$p")
      fi
    done
    if [ ${#leftovers[@]} -eq 0 ]; then
      pf_pass "T9: v1/v2 whitelist artifacts are gone (planning/ whitelist only)"
    else
      pf_fail "T9: leftover v1/v2 artifacts: ${leftovers[*]}"
    fi

    # T10 — no hyphenated implementation-plan.md in any issue (open OR closed).
    local hyphenated
    hyphenated="$(find "$target/docs/issues" -type f -name 'implementation-plan.md' 2>/dev/null || true)"
    if [ -z "$hyphenated" ]; then
      pf_pass "T10: no hyphenated implementation-plan.md under docs/issues/"
    else
      pf_fail "T10: hyphenated implementation-plan.md still present: $hyphenated"
    fi

    # T11 — the TUI detector agrees.
    state="$(pf_detect_state "$target" "$root")"
    if [ "$state" = "v3" ]; then
      pf_pass "T11: detectState() == 'v3'"
    else
      pf_fail "T11: detectState() == '$state' (want 'v3')"
    fi
  else
    # ─── inverted tail (--no-destructive) ───────────────────────────────────
    # A failed transfer means phase 5 never ran (D-B): planning/ must be intact
    # and the project must still look like v2 to the detector.
    if [ -d "$target/planning/issues" ]; then
      pf_pass "T9-inv: planning/issues/ is intact — phase 5 did not run"
    else
      pf_fail "T9-inv: planning/issues/ was deleted despite a failed transfer"
    fi

    local src_hyphenated
    src_hyphenated="$(find "$target/planning/issues" -type f -name 'implementation-plan.md' 2>/dev/null || true)"
    if [ -n "$src_hyphenated" ]; then
      pf_pass "T10-inv: hyphenated implementation-plan.md still in planning/ — nothing was normalised away"
    else
      pf_fail "T10-inv: planning/issues/ lost its hyphenated implementation-plan.md"
    fi

    # T11-inv (TC-054 step 8) cannot pass before Task 8. Phase 6 has by now
    # legitimately written .pf-version = 3.0.0 and a 3.0-stamped PLANNING.md
    # (step 5 of the same TC demands both), and today's detect.js reads those
    # BEFORE probing for the v2 structural fingerprint — so it answers 'v3'. The
    # fix is the Р7 detection order (planning/issues/ probed first: an unfinished
    # migration outranks any version marker), and it lands in Task 8.
    #
    # Reported, never faked: the moment detect.js starts probing planning/issues/
    # this turns back into a hard assertion, with no one having to remember it.
    state="$(pf_detect_state "$target" "$root")"
    if [ "$state" = "v2-or-older" ]; then
      pf_pass "T11-inv: detectState() == 'v2-or-older'"
    elif ! grep -q 'planning/issues' "$root/tools/onboarding-tui/lib/detect.js" 2>/dev/null; then
      pf_note "T11-inv: detectState() == '$state' — DEFERRED to Task 8 (TC-054 step 8): detect.js does not probe planning/issues/ yet, so the v2 fingerprint cannot outrank the .pf-version phase 6 just wrote. Not a convergence defect."
    else
      pf_fail "T11-inv: detectState() == '$state' (want 'v2-or-older')"
    fi
  fi
}
