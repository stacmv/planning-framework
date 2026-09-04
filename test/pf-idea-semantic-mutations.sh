#!/usr/bin/env bash
# shellcheck disable=SC2016  # backticks in mutation strings are literal markdown code-spans, not command substitution
# @pf-issue [20260902-feat-idea-stage]
# test/pf-idea-semantic-mutations.sh — reproducible mutation runner for
# test/pf-idea-semantic-static.sh (Task 40, CR-027's reproducibility finding).
#
# The round-4 review of 20260902-feat-idea-stage flagged that "41 mutations
# checked" was a claim that existed only in an executor's own report — nothing
# in the repository let anyone else re-verify it. This script and its
# manifest (test/mutations/pf-idea-semantic.tsv) are the fix: every mutation
# is a data row, applied here mechanically, and the pass/fail verdict is
# printed by THIS run, not asserted in prose.
#
# What a "mutation" means here: take ONE specific literal substring inside a
# SKILL.md file the semantic suite reads, replace it with a plausible-looking
# regression (a flipped condition, a swapped table cell, a dropped field),
# and check that test/pf-idea-semantic-static.sh — run against that mutated
# copy — goes red on the SPECIFIC assert the manifest row names, not just
# "some assert or other". A row whose expected assert does NOT go red is a
# real finding: either the mutation didn't reach the code path it was meant
# to, or (more interesting) the suite has a live gap the manifest predicted
# incorrectly — either way this script reports it as FAILED, it does not
# paper over it.
#
# Mechanics:
#   - Each mutation runs against a FRESH pf_repo_copy() (test/lib.sh, S-5) —
#     a full throwaway copy of this repository, .git included. This script
#     never writes to $REPO_ROOT itself; the S-5 check at the bottom proves
#     it the same way every other suite in this tree does.
#   - The substitution is bash's own `${content/search/replace}` — replaces
#     the FIRST occurrence of the literal `search` text in the target file's
#     content, not a regex. Every row in the manifest was checked, while it
#     was written, for exactly where its "first occurrence" lands (either
#     the string is unique in the file, or it deliberately targets the
#     earliest of several near-identical occurrences — e.g. Step 0's
#     "Non-Claude orchestrator" paragraph genuinely IS the first one in
#     skills/pf/SKILL.md, so a first-occurrence replace of its condition text
#     lands exactly there and nowhere else).
#   - The mutated suite runs as a real subprocess (`bash
#     "$TMP_REPO/test/pf-idea-semantic-static.sh"`) so its own REPO_ROOT
#     (computed from its OWN location, per test/lib.sh) resolves inside the
#     copy — it reads the mutated SKILL.md, not this repo's.
#
# NOT wired into `make test`: measured at ~$(printf '%s' "TIME_PLACEHOLDER") for
# the manifest above (pf_repo_copy() does a full `cp -a` of the repository,
# .git included, once per row) — small today, but it grows linearly with the
# manifest and is pure overhead compared to the ~1s each other suite in this
# tree takes. Run it directly when touching skills/pf/SKILL.md,
# skills/pf-close/SKILL.md, or skills/pf-interaction/SKILL.md's
# pending-interaction/branch-preflight contracts, or the manifest itself:
#
#     bash test/pf-idea-semantic-mutations.sh
#
# Adding a mutation: append one tab-separated row to
# test/mutations/pf-idea-semantic.tsv (see that file's own header for the
# exact column format), then re-run this script — it picks up new rows
# automatically, nothing here needs editing.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

MANIFEST="$REPO_ROOT/test/mutations/pf-idea-semantic.tsv"
SUITE_REL="test/pf-idea-semantic-static.sh"

if [ ! -f "$MANIFEST" ]; then
  printf 'FATAL: manifest not found: %s\n' "$MANIFEST" >&2
  exit 1
fi

row_n=0
header_seen=0

while IFS=$'\t' read -r m_file m_search m_replace m_expected || [ -n "${m_file:-}" ]; do
  # Skip comments and blank lines.
  case "$m_file" in
    ''|'#'*) continue ;;
  esac
  # Skip the header row (its first field is literally "file").
  if [ "$header_seen" -eq 0 ]; then
    header_seen=1
    if [ "$m_file" = "file" ]; then
      continue
    fi
  fi

  row_n=$((row_n + 1))
  label="M$row_n: $m_file :: ${m_search:0:50}"

  if [ -z "$m_file" ] || [ -z "$m_search" ] || [ -z "$m_expected" ]; then
    pf_fail "$label — malformed manifest row (missing file/search/expected_fail_substring)"
    continue
  fi

  TMP_REPO=""
  target_repo="$(pf_repo_copy)" || {
    pf_fail "$label — pf_repo_copy failed"
    continue
  }

  target_file="$target_repo/$m_file"
  if [ ! -f "$target_file" ]; then
    pf_fail "$label — target file does not exist in the copy: $m_file"
    continue
  fi

  content="$(cat "$target_file")"
  case "$content" in
    *"$m_search"*) : ;;
    *)
      pf_fail "$label — search text not found in $m_file (manifest row is stale)"
      continue
      ;;
  esac
  mutated="${content/$m_search/$m_replace}"
  if [ "$mutated" = "$content" ]; then
    pf_fail "$label — mutation had no effect (search == replace?)"
    continue
  fi
  printf '%s\n' "$mutated" >"$target_file"

  suite_output=""
  suite_exit=0
  suite_output="$(bash "$target_repo/$SUITE_REL" 2>&1)" || suite_exit=$?

  if [ "$suite_exit" -eq 0 ]; then
    pf_fail "$label — suite stayed GREEN after this mutation (expected it to redden on: $m_expected)"
    continue
  fi

  if printf '%s\n' "$suite_output" | grep -qF -- "$m_expected"; then
    pf_pass "$label — reddened the expected assert"
  else
    pf_fail "$label — suite went red, but NOT on the expected assert ('$m_expected' not found in its output)"
  fi
done <"$MANIFEST"

if [ "$row_n" -eq 0 ]; then
  pf_fail "no mutation rows found in $MANIFEST"
fi

# ─── S-5 ──────────────────────────────────────────────────────────────────────
assert_repo_untouched

pf_summary
