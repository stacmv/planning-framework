#!/usr/bin/env bash
# test/converge-normalize.sh — phase 4 (issue-document normalisation: Р1, Р5,
# Р12) and the overwrite asymmetry of phase 6 (KI-11).
#
# TC-010, TC-012, TC-020, TC-021, TC-023, TC-058.
#
# The two halves belong together. Phase 4 decides what convergence is allowed to
# WRITE into a project's own documents, and phase 6 decides what it is allowed to
# OVERWRITE. Both answers are asymmetric, and both asymmetries are load-bearing:
#
#   * framework artifacts (.pf-version, PLANNING.md, docs/planning/templates/)
#     are rewritten on every run — a stale v2-stamped PLANNING.md is what poisons
#     detection in the first place (defects 2 and 6), so it must not survive;
#   * user documents (docs/planning/{session-log,decisions,implementation-plan}.md,
#     .qa-workflow.md) are never touched once they exist;
#   * open issues get NO stub documents at all — an absent document is an
#     honestly unfinished stage (defect 5, measure 1);
#   * closed issues get a pointer brd.md and nothing else: their STRUCTURE is
#     normalised (the rename applies), their CONTENT is never edited (D-D).
#
# Every convergence run in this file goes through a wrapper from test/lib.sh.
# A direct call to the script is a defect in itself (S-1) — audited by
# test/safety-audit.sh (TC-032), not by reviewers.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

FIXTURES="$PF_LIB_DIR/fixtures"

V2_GAMMA="$FIXTURES/v2-project/planning/issues/closed/20241201-feat-gamma"
LATIN_ISSUES="$FIXTURES/v2-latin/planning/issues/open"

sha_of() { sha256sum <"$1" | cut -d' ' -f1; }

# frontmatter_value <file> <key> — the value of <key> inside a leading YAML block,
# or the empty string if there is no well-formed block or no such key.
frontmatter_value() {
  awk -v key="$2" '
    NR == 1 && $0 != "---" { exit }
    NR > 1 && $0 == "---"  { exit }
    NR > 1 && $0 ~ "^" key ":" { sub("^" key ": *", ""); print; exit }
  ' "$1"
}

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-010: framework artifacts are ALWAYS overwritten (T2, T3, T6)\n'
# ══════════════════════════════════════════════════════════════════════════════

# Every artifact below is planted STALE on purpose. A convergence that merely
# "installs what is missing" would leave all three in place and still pass T1–T11
# in a project that already looks like v3 — which is exactly how a v2-stamped
# PLANNING.md survives today and keeps poisoning the detector (Р11, defect 2/6).
pf_setup_case v2-project >/dev/null
printf '2.0.0\n' >"$TMP_WORK/.pf-version"
mkdir -p "$TMP_WORK/docs/planning"
cp -a "$REPO_ROOT/docs/planning/templates" "$TMP_WORK/docs/planning/templates"
printf 'GARBAGE — this file was tampered with before the run\n' \
  >"$TMP_WORK/docs/planning/templates/config/PLANNING.md"

if grep -qE '\*\*Framework Version:\*\* *2\.0' "$TMP_WORK/PLANNING.md"; then
  pf_pass "step 0: the fixture really does carry a v2-stamped PLANNING.md"
else
  pf_fail "step 0: the fixture's PLANNING.md is not v2-stamped — the case proves nothing"
fi

rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 1: converge over stale framework artifacts"

if [ "$(cat "$TMP_WORK/.pf-version")" = "3.0.0" ]; then
  pf_pass "step 2: .pf-version was overwritten 2.0.0 -> 3.0.0"
else
  pf_fail "step 2: .pf-version reads '$(cat "$TMP_WORK/.pf-version" 2>/dev/null)' (want 3.0.0)"
fi

if grep -qE '\*\*Framework Version:\*\* *3\.0' "$TMP_WORK/PLANNING.md" &&
  ! grep -qE '\*\*Framework Version:\*\* *2\.0' "$TMP_WORK/PLANNING.md"; then
  pf_pass "step 3: PLANNING.md now carries the 3.0 stamp and no 2.0 stamp anywhere"
else
  pf_fail "step 3: PLANNING.md still carries a 2.0 stamp, or lost the 3.0 one"
  grep -n 'Framework Version' "$TMP_WORK/PLANNING.md" >&2 || true
fi

# The v2 document did not merely get a new stamp — it is a different document.
# Its paths pointed at planning/issues/; v3 lives in docs/issues/.
if ! grep -q 'planning/issues' "$TMP_WORK/PLANNING.md"; then
  pf_pass "step 4: no planning/issues path survives in PLANNING.md — the v2 body is gone, not restamped"
else
  pf_fail "step 4: PLANNING.md still points at planning/issues/"
  grep -n 'planning/issues' "$TMP_WORK/PLANNING.md" | head -3 >&2
fi

if tdiff="$(diff -r "$TMP_WORK/docs/planning/templates" "$REPO_ROOT/docs/planning/templates" 2>&1)"; then
  pf_pass "step 5: the tampered template file was restored — templates/ mirrors the framework exactly (T6)"
else
  pf_fail "step 5: templates/ does not mirror the framework after the run"
  printf '%s\n' "$tdiff" | head -10 >&2
fi

if [ -z "$(grep -rn 'Version:\*\* *2\.0' "$TMP_WORK/docs/planning/templates/" || true)" ]; then
  pf_pass "step 6: no 2.0 stamp anywhere under docs/planning/templates/ (defect 4)"
else
  pf_fail "step 6: a 2.0-stamped template reached the project"
  grep -rn 'Version:\*\* *2\.0' "$TMP_WORK/docs/planning/templates/" | head -5 >&2
fi

# Step 7 — a NEGATIVE requirement, and a deliberate one. The trivial-tier notes.md
# template lives in exactly one place, skills/pf-size-tiers/SKILL.md, and pf-brd
# is told to read it from there. A second copy here would recreate the very split
# source of truth this issue exists to close (П1-10).
if [ ! -e "$TMP_WORK/docs/planning/templates/issue/notes.md" ]; then
  pf_pass "step 7: docs/planning/templates/issue/notes.md does NOT exist — no second home for the trivial template"
else
  pf_fail "step 7: a notes.md template was installed — the trivial template now has two sources of truth"
fi

if diff -r "$TMP_WORK/docs/planning/templates/issue" \
  "$REPO_ROOT/docs/planning/templates/issue" >/dev/null 2>&1; then
  pf_pass "step 8: templates/issue/ is untouched by this issue and mirrors the framework"
else
  pf_fail "step 8: templates/issue/ differs from the framework's"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-012: user documents are NEVER overwritten (T5) — the other side of TC-010\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v2-project >/dev/null
MARKER='PF-TEST-MARKER-do-not-lose-me'
printf '\n%s session-log\n' "$MARKER" >>"$TMP_WORK/planning/session-log.md"
printf '\n%s decisions\n' "$MARKER" >>"$TMP_WORK/planning/decisions.md"
qa_before="$(sha_of "$TMP_WORK/.qa-workflow.md")"

rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 1: converge on a v2 project whose global documents carry user edits"

if grep -qF "$MARKER" "$TMP_WORK/docs/planning/session-log.md"; then
  pf_pass "step 2: the marker survives in docs/planning/session-log.md — the document was MOVED, not replaced by a template"
else
  pf_fail "step 2: docs/planning/session-log.md lost the user's content (overwritten by the template?)"
fi

if grep -qF "$MARKER" "$TMP_WORK/docs/planning/decisions.md"; then
  pf_pass "step 3: the marker survives in docs/planning/decisions.md"
else
  pf_fail "step 3: docs/planning/decisions.md lost the user's content"
fi

rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
if [ "$rc" -eq 0 ] &&
  grep -qF "$MARKER" "$TMP_WORK/docs/planning/session-log.md" &&
  grep -qF "$MARKER" "$TMP_WORK/docs/planning/decisions.md"; then
  pf_pass "step 4: a second run still does not touch them — 'never overwritten' holds on every run, not just the first"
else
  pf_fail "step 4: the second run clobbered a user document (exit $rc)"
fi

# Step 5 — the asymmetry is "do not OVERWRITE", not "do not create". A document
# that is genuinely absent is still installed from the template.
rm -f "$TMP_WORK/docs/planning/decisions.md"
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
if [ "$rc" -eq 0 ] && [ -f "$TMP_WORK/docs/planning/decisions.md" ] &&
  grep -qE '\*\*Version:\*\* *3\.0' "$TMP_WORK/docs/planning/decisions.md" &&
  ! grep -qF "$MARKER" "$TMP_WORK/docs/planning/decisions.md"; then
  pf_pass "step 5: a DELETED decisions.md is recreated from the template, stamped 3.0"
else
  pf_fail "step 5: the missing decisions.md was not restored from a 3.0-stamped template (exit $rc)"
fi

if [ "$(sha_of "$TMP_WORK/.qa-workflow.md")" = "$qa_before" ]; then
  pf_pass "step 6: the v2-stamped .qa-workflow.md is byte-identical — it is a user document too (Р4, KI-12)"
else
  pf_fail "step 6: .qa-workflow.md was rewritten"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-020: NO stub documents are created in open issues (defect 5, measure 1)\n'
# ══════════════════════════════════════════════════════════════════════════════

# The old migration wrote a heredoc test_plan.md whose entire body was a heading
# plus `TODO: Run /pf-test-plan to generate this file.` — and /pf then read the
# file's mere existence as a completed stage and routed straight past it. The fix
# is not a better stub. It is no stub.
pf_setup_case v2-project >/dev/null

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 1: converge on a v2 project"

if [ -z "$(find "$TMP_WORK/docs/issues/open" -name 'test_plan.md')" ]; then
  pf_pass "step 2: not one test_plan.md was minted in an open issue"
else
  pf_fail "step 2: a test_plan.md was created — the stub is back"
  find "$TMP_WORK/docs/issues/open" -name 'test_plan.md' >&2
fi

created="$(find "$TMP_WORK/docs/issues/open" \
  \( -name 'brd.md' -o -name 'specs.md' -o -name 'notes.md' \) -printf '%P\n' | LC_ALL=C sort | tr '\n' ' ')"
if [ -z "$created" ]; then
  pf_pass "step 3: no brd.md, specs.md or notes.md was created in any open issue either (Р1)"
else
  pf_fail "step 3: converge created stub documents in open issues: $created"
fi

if [ -z "$(grep -rl -F -- 'TODO: Run /pf-' "$TMP_WORK/docs/issues/open/" 2>/dev/null || true)" ]; then
  pf_pass "step 4: the stub marker 'TODO: Run /pf-' occurs nowhere under docs/issues/open/"
else
  pf_fail "step 4: the stub marker was written into an open issue"
  grep -rn -F -- 'TODO: Run /pf-' "$TMP_WORK/docs/issues/open/" | head -5 >&2
fi

# Step 5 — the report has to carry the weight the stub used to. For each open
# issue it must name the documents still owed AND the skill that writes each one;
# "silence plus a missing file" would leave the user with no idea what to run.
# 20250101-feat-alpha is a feat issue: brd.md, specs.md and test_plan.md are all
# still owed (its implementation_plan.md came across from v2).
# 20250102-bug-beta is a bug: no BRD, no spec — only test_plan.md is owed.
alpha_line="$(printf '%s\n' "$out" | grep -F '20250101-feat-alpha:' || true)"
beta_line="$(printf '%s\n' "$out" | grep -F '20250102-bug-beta:' || true)"

if printf '%s' "$alpha_line" | grep -q 'brd\.md' &&
  printf '%s' "$alpha_line" | grep -q 'specs\.md' &&
  printf '%s' "$alpha_line" | grep -q 'test_plan\.md'; then
  pf_pass "step 5a: the report names every v3 document the feat issue still owes (brd, specs, test_plan)"
else
  pf_fail "step 5a: the report does not list the feat issue's missing documents: '$alpha_line'"
fi

if printf '%s' "$alpha_line" | grep -q '/pf-brd' &&
  printf '%s' "$alpha_line" | grep -q '/pf-spec' &&
  printf '%s' "$alpha_line" | grep -q '/pf-test-plan'; then
  pf_pass "step 5b: each missing document is reported next to the skill that creates it"
else
  pf_fail "step 5b: the report does not say which skill writes each missing document: '$alpha_line'"
fi

if printf '%s' "$beta_line" | grep -q 'test_plan\.md' &&
  ! printf '%s' "$beta_line" | grep -q 'brd\.md'; then
  pf_pass "step 5c: the bug issue is asked for a test_plan.md and NOT for a BRD — the pipeline differs by issue type"
else
  pf_fail "step 5c: the bug issue's missing-document list is wrong: '$beta_line'"
fi

if ! printf '%s' "$out" | grep -qi 'none found'; then
  pf_pass "step 5d: nothing in the report says '(none found)' — the issues were seen"
else
  pf_fail "step 5d: the report claims no issues were found"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-021: a pointer brd.md in CLOSED issues only — and no legacy: marker (Р1)\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v2-project >/dev/null
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 1: converge on a v2 project"

GAMMA="$TMP_WORK/docs/issues/closed/20241201-feat-gamma"

if [ -f "$GAMMA/brd.md" ]; then
  pf_pass "step 2: the closed issue got a brd.md pointer"
else
  pf_fail "step 2: no brd.md in the closed issue"
fi

# Step 3 — the links must RESOLVE. A pointer to documents that are not there is
# worse than no pointer: it reads as a BRD and delivers nothing.
links="$(grep -oE '\]\([^)]+\)' "$GAMMA/brd.md" 2>/dev/null | tr -d '](' | tr -d ')' | LC_ALL=C sort | tr '\n' ' ')"
dangling=""
for l in $links; do
  [ -f "$GAMMA/$l" ] || dangling="$dangling $l"
done
if [ "$links" = "analysis.md definition-of-done.md prompt.md " ] && [ -z "$dangling" ]; then
  pf_pass "step 3: the pointer links to prompt.md, analysis.md and definition-of-done.md, and all three really exist"
else
  pf_fail "step 3: links are '$links'; dangling:$dangling"
fi

# Step 4 — the pointer is a real document, not an unfinished one. If it carried
# the stub marker, measure 2's stub-recognition rule would fire on it and /pf
# would treat the closed archive as unfinished work.
if ! grep -q -F -- 'TODO: Run /pf-' "$GAMMA/brd.md"; then
  pf_pass "step 4: the pointer carries NO 'TODO: Run /pf-' marker — the stub rule must not fire on it"
else
  pf_fail "step 4: the pointer carries the stub marker"
fi

# Step 5 — "the archive is not rewritten" is about CONTENT. In particular no
# doc_language frontmatter is back-filled into a closed issue (D-D).
archive_ok=1
for f in prompt.md analysis.md definition-of-done.md; do
  if ! cmp -s "$V2_GAMMA/$f" "$GAMMA/$f"; then
    archive_ok=0
    pf_note "closed/$f differs from the fixture"
  fi
done
if [ "$archive_ok" -eq 1 ]; then
  pf_pass "step 5: prompt.md, analysis.md and definition-of-done.md of the closed issue are byte-identical to the fixture"
else
  pf_fail "step 5: the closed issue's content was edited"
fi

if [ -z "$(find "$TMP_WORK/docs/issues/closed" -name 'specs.md')" ]; then
  pf_pass "step 6: no specs.md stub in the archive — an explicitly rejected variant (Р1)"
else
  pf_fail "step 6: a specs.md stub was created in a closed issue"
fi

if [ -z "$(grep -rlE '^legacy:|legacy: true' "$TMP_WORK/docs/issues/" 2>/dev/null || true)" ]; then
  pf_pass "step 7: no 'legacy:' marker anywhere under docs/issues/ — the other rejected variant (Р1)"
else
  pf_fail "step 7: a legacy: marker was written"
  grep -rnE '^legacy:|legacy: true' "$TMP_WORK/docs/issues/" | head -5 >&2
fi

brd_before="$(sha_of "$GAMMA/brd.md")"
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
n_brd="$(find "$TMP_WORK/docs/issues/closed" -name 'brd*.md' | wc -l)"
if [ "$rc" -eq 0 ] && [ "$n_brd" -eq 1 ] && [ "$(sha_of "$GAMMA/brd.md")" = "$brd_before" ]; then
  pf_pass "step 8: a second run neither duplicates nor rewrites the pointer"
else
  pf_fail "step 8: the second run produced $n_brd brd file(s) or changed the pointer (exit $rc)"
fi

if [ -z "$(find "$TMP_WORK/docs/issues/open" -name 'brd.md')" ]; then
  pf_pass "step 9: no pointer was placed in an open issue — the rule is closed/-only (an open issue must run /pf-brd for real)"
else
  pf_fail "step 9: a pointer brd.md turned up in an open issue"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-023: doc_language is detected from the CONTENT (Р5, D-D)\n'
# ══════════════════════════════════════════════════════════════════════════════

# Without this, every v2 issue silently enters the English pipeline: a v2 prompt.md
# has no frontmatter at all, and /pf falls back to English by default. On a Russian
# project that is quiet corruption, not a default.
pf_setup_case v2-project >/dev/null
out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 1a: converge on a v2 project with a Russian issue"

lang="$(frontmatter_value "$TMP_WORK/docs/issues/open/20250101-feat-alpha/prompt.md" doc_language)"
if [ "$lang" = "Russian" ]; then
  pf_pass "step 1b: the Cyrillic issue was classified Russian"
else
  pf_fail "step 1b: doc_language of the Cyrillic issue is '$lang' (want Russian)"
fi

if printf '%s' "$out" | grep -q '20250101-feat-alpha' &&
  printf '%s' "$out" | grep -qE 'doc_language.*20250101-feat-alpha.*Russian'; then
  pf_pass "step 1c: the decision is printed per issue, not made in silence"
else
  pf_fail "step 1c: no per-issue doc_language decision in the output"
fi

# The same run also proves the negative: an English-language issue in the same
# project is NOT dragged along with it.
lang="$(frontmatter_value "$TMP_WORK/docs/issues/open/20250102-bug-beta/prompt.md" doc_language)"
if [ "$lang" = "English" ]; then
  pf_pass "step 1d: the Latin issue in the same project stayed English — the decision is per issue, not per project"
else
  pf_fail "step 1d: doc_language of the Latin issue is '$lang' (want English)"
fi

# Step 5 (checked on this same tree) — size_tier is deliberately NOT guessed, so
# that /pf's legacy-tier guard asks the user instead of trusting a machine.
if [ -z "$(grep -rln 'size_tier' "$TMP_WORK"/docs/issues/open/*/prompt.md 2>/dev/null || true)" ]; then
  pf_pass "step 5: no size_tier was written into any prompt.md — /pf must ask the user"
else
  pf_fail "step 5: converge guessed a size_tier"
fi

# Step 6 — D-D: the archive's CONTENT is off limits. Its STRUCTURE is not (the
# rename does apply there — TC-022), and confusing the two is the whole point.
#
# The assertion is on the frontmatter KEY, not on the word: this fixture's closed
# prompt.md says in prose that converge must not add a `doc_language` block, so a
# bare word-grep would flag the fixture's own instructions. Byte-identity is the
# real check and subsumes it.
closed_prompt="$TMP_WORK/docs/issues/closed/20241201-feat-gamma/prompt.md"
if [ "$(grep -c '^doc_language:' "$closed_prompt")" -eq 0 ] &&
  [ -z "$(frontmatter_value "$closed_prompt" doc_language)" ] &&
  cmp -s "$V2_GAMMA/prompt.md" "$closed_prompt"; then
  pf_pass "step 6: no doc_language frontmatter in a closed issue, and its prompt.md is byte-identical (D-D)"
else
  pf_fail "step 6: frontmatter was written into the archive"
fi

# Step 7 — running again must not stack a second frontmatter block on top of the
# first, nor re-decide the language.
before="$(sha_of "$TMP_WORK/docs/issues/open/20250101-feat-alpha/prompt.md")"
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
n_fm="$(grep -c '^doc_language:' "$TMP_WORK/docs/issues/open/20250101-feat-alpha/prompt.md")"
if [ "$rc" -eq 0 ] && [ "$n_fm" -eq 1 ] &&
  [ "$(sha_of "$TMP_WORK/docs/issues/open/20250101-feat-alpha/prompt.md")" = "$before" ]; then
  pf_pass "step 7: the second run leaves the frontmatter alone (one doc_language key, same bytes)"
else
  pf_fail "step 7: the second run duplicated or changed the frontmatter ($n_fm doc_language keys, exit $rc)"
fi

# Steps 2-3 — the classifier itself, on the fixture built for it.
pf_setup_case v2-latin >/dev/null
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 2a: converge on the v2-latin fixture"

lang="$(frontmatter_value "$TMP_WORK/docs/issues/open/20250201-feat-latin/prompt.md" doc_language)"
if [ "$lang" = "English" ]; then
  pf_pass "step 2b: an issue written wholly in Latin script is English"
else
  pf_fail "step 2b: the Latin issue got doc_language '$lang'"
fi

# Step 3 — the case that a naive [а-яА-Я] bracket gets WRONG. In UTF-8, ё (D1 91)
# and Ё (D0 81) sit OUTSIDE the а-я / А-Я block, so a bracket-based classifier
# counts zero Cyrillic here and files a Russian issue as English.
lang="$(frontmatter_value "$TMP_WORK/docs/issues/open/20250202-feat-yo/prompt.md" doc_language)"
if [ "$lang" = "Russian" ]; then
  pf_pass "step 3: an issue whose ONLY Cyrillic is ё/Ё is Russian — the letters outside the а-я block are counted"
else
  pf_fail "step 3: the ё/Ё issue got doc_language '$lang' (want Russian) — ё and Ё are not being counted"
fi

# Step 4 — the flag overrides the classifier in EVERY issue, Cyrillic ones
# included. A fresh copy: the flag has to beat detection, not an existing value.
pf_setup_case v2-project >/dev/null
rc=0
pf_run_converge --doc-language English >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 4a: converge --doc-language English"

lang="$(frontmatter_value "$TMP_WORK/docs/issues/open/20250101-feat-alpha/prompt.md" doc_language)"
if [ "$lang" = "English" ]; then
  pf_pass "step 4b: --doc-language English overrode the Cyrillic content of the Russian issue"
else
  pf_fail "step 4b: the flag did not override detection (doc_language = '$lang')"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-058: doc_language — the degenerate inputs (D-G)\n'
# ══════════════════════════════════════════════════════════════════════════════

# Not one of these may abort the run: phase 4 sits BETWEEN the transfer (phase 3)
# and the deletion (phase 5). A crash here would leave a project half-migrated
# with its planning/ still full — the worst state of all.
pf_setup_case v2-latin >/dev/null

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 7a: a degenerate input is not an error — exit 0"

OPEN="$TMP_WORK/docs/issues/open"

# Step 1 — an issue with neither prompt.md nor analysis.md. Р1 forbids stubs in
# open issues, and that includes an "empty prompt.md so we have somewhere to put
# the frontmatter". No file, a WARNING, and the fallback decision, stated.
nodocs_files="$(cd "$OPEN/20250203-feat-nodocs" && find . -mindepth 1 -printf '%P\n' | LC_ALL=C sort | tr '\n' ' ')"
if [ "$nodocs_files" = "implementation_plan.md " ]; then
  pf_pass "step 1a: the issue with no prompt.md/analysis.md got NO prompt.md created for it (Р1)"
else
  pf_fail "step 1a: the issue holds '$nodocs_files' — a file was minted for it"
fi
if printf '%s' "$out" | grep -q 'WARNING.*20250203-feat-nodocs' &&
  printf '%s' "$out" | grep -qE '20250203-feat-nodocs.*English'; then
  pf_pass "step 1b: a WARNING names the issue and states the fallback decision (English)"
else
  pf_fail "step 1b: no WARNING naming the issue and its decision"
fi

# Step 2 — 0 Cyrillic and 0 Latin letters. The counters must not trip on 0/0, and
# the file, though empty, exists: the frontmatter goes in.
lang="$(frontmatter_value "$OPEN/20250204-feat-empty/prompt.md" doc_language)"
if [ "$lang" = "English" ]; then
  pf_pass "step 2: two empty documents (0 letters of either script) decide English, and 0/0 does not error"
else
  pf_fail "step 2: the empty issue got doc_language '$lang'"
fi

# Step 3 — the tie. The rule is "Cyrillic STRICTLY greater", so a tie is English.
lang="$(frontmatter_value "$OPEN/20250205-feat-tie/prompt.md" doc_language)"
if [ "$lang" = "English" ] &&
  printf '%s' "$out" | grep -qE 'doc_language.*20250205-feat-tie.*English'; then
  pf_pass "step 3: an exact tie decides English (the rule is 'Cyrillic strictly greater'), and the decision is printed"
else
  pf_fail "step 3: the tie issue got doc_language '$lang', or its decision was not printed"
fi

# Step 4 — a valid, pre-existing declaration wins over detection. (The prose in
# this issue is Latin-heavy on purpose: a detector that ignored the declaration
# would flip it to English, which is exactly the corruption being prevented.)
lang="$(frontmatter_value "$OPEN/20250206-feat-fm/prompt.md" doc_language)"
if [ "$lang" = "Russian" ] &&
  cmp -s "$LATIN_ISSUES/20250206-feat-fm/prompt.md" "$OPEN/20250206-feat-fm/prompt.md"; then
  pf_pass "step 4a: an existing valid doc_language is not overwritten, and the file is byte-identical"
else
  pf_fail "step 4a: the pre-declared doc_language was overwritten (now '$lang') or the file was rewritten"
fi
if ! grep -q 'size_tier' "$OPEN/20250206-feat-fm/prompt.md"; then
  pf_pass "step 4b: no size_tier key was added alongside it"
else
  pf_fail "step 4b: a size_tier key was added"
fi

# Step 5 — malformed frontmatter: an opening --- with no closing ---. Converge
# does not repair it. "Fixing" broken YAML means guessing where the block ends,
# and guessing wrong destroys the user's text.
if cmp -s "$LATIN_ISSUES/20250207-feat-broken/prompt.md" "$OPEN/20250207-feat-broken/prompt.md"; then
  pf_pass "step 5a: the file with malformed frontmatter is byte-identical — converge did not try to repair it"
else
  pf_fail "step 5a: the malformed file was edited"
  diff "$LATIN_ISSUES/20250207-feat-broken/prompt.md" "$OPEN/20250207-feat-broken/prompt.md" | head -10 >&2
fi
if printf '%s' "$out" | grep -q 'WARNING.*20250207-feat-broken'; then
  pf_pass "step 5b: a WARNING names the issue with the malformed frontmatter"
else
  pf_fail "step 5b: the malformed frontmatter passed in silence"
fi

# Step 6 — every decision is stable, and the warnings are printed again rather
# than "already handled" and swallowed.
snap_before="$(snapshot_tree "$TMP_WORK")"
out2="$(pf_run_converge 2>&1)"
rc=$?
snap_after="$(snapshot_tree "$TMP_WORK")"
assert_exit_code 0 "$rc" "step 7b: the second run over the same degenerate inputs also exits 0"

if [ "$snap_before" = "$snap_after" ]; then
  pf_pass "step 6a: the second run is byte-identical — no decision drifted"
else
  pf_fail "step 6a: the second run changed the tree"
  diff <(printf '%s\n' "$snap_before") <(printf '%s\n' "$snap_after") | head -10 >&2
fi

if printf '%s' "$out2" | grep -q 'WARNING.*20250203-feat-nodocs' &&
  printf '%s' "$out2" | grep -q 'WARNING.*20250207-feat-broken'; then
  pf_pass "step 6b: the warnings are printed again on the second run — a standing problem stays visible"
else
  pf_fail "step 6b: the second run went quiet about the degenerate issues"
fi

assert_repo_untouched

pf_summary
