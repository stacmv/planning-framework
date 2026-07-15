#!/usr/bin/env bash
# test/converge-fresh.sh — the "clean" (non-v2-transfer) convergence paths.
#
# TC-001, TC-002, TC-003, TC-005, TC-009, TC-011, TC-013, TC-014, TC-015,
# TC-024, TC-030, TC-031.
#
# Every convergence run in this file goes through a wrapper from test/lib.sh.
# A direct call to the script is a defect in itself (S-1) — audited by
# test/safety-audit.sh (TC-032), not by reviewers.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-001: convergence from a bare project (no-pf-bare)\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case no-pf-bare --git >/dev/null

state="$(pf_detect_state "$TMP_WORK")"
if [ "$state" = "none" ]; then
  pf_pass "step 1: detectState() == 'none' before the run (D-C)"
else
  pf_fail "step 1: detectState() == '$state' before the run (want 'none')"
fi

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 2: converge on a bare project"

if printf '%s' "$out" | grep -qi 'Detected state.*no PF'; then
  pf_pass "step 3: converge's own detector reported 'no PF'"
else
  pf_fail "step 3: converge did not report 'no PF'"
fi

assert_target_state "$TMP_WORK" "$TMP_HOME" # step 4 — T1–T11

backups="$(find "$TMP_WORK" -maxdepth 1 -name 'planning-backup-*' | wc -l)"
if [ "$backups" -eq 0 ]; then
  pf_pass "step 5: no backup — there was nothing to transfer or delete"
else
  pf_fail "step 5: a backup was created on a clean install ($backups found)"
fi

if [ ! -e "$TMP_WORK/.qa-workflow.md" ]; then
  pf_pass "step 6a: .qa-workflow.md was NOT created (Р4/KI-12)"
else
  pf_fail "step 6a: converge created .qa-workflow.md — it must never do that"
fi
if printf '%s' "$out" | grep -q '/pf-qa-setup'; then
  pf_pass "step 6b: the /pf-qa-setup hint was printed"
else
  pf_fail "step 6b: no /pf-qa-setup hint in the output"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-002: convergence from a CLAUDE.md-only project (no-pf-claude) — two detectors (D-C)\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case no-pf-claude >/dev/null
claude_before="$(cat "$TMP_WORK/CLAUDE.md")"

state="$(pf_detect_state "$TMP_WORK")"
if [ "$state" = "v2-or-older" ]; then
  pf_pass "step 1: detectState() == 'v2-or-older' (detect.js:56-58, unchanged — D-C)"
else
  pf_fail "step 1: detectState() == '$state' (want 'v2-or-older')"
fi

# Step 2 (MENUS['v2-or-older'] carries the `converge` action token) cannot pass
# before Task 8 rewires the TUI — the token does not exist yet. Reported, not
# faked green.
menus_js="$REPO_ROOT/tools/onboarding-tui/lib/menu.js"
if grep -q "'converge'" "$menus_js" 2>/dev/null || grep -q '"converge"' "$menus_js" 2>/dev/null; then
  pf_pass "step 2: MENUS carries the 'converge' action token"
else
  pf_note "step 2: MENUS has no 'converge' token yet — lands in Task 8 (TUI rewiring), by design"
fi

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 3: converge on a CLAUDE.md-only project"
if printf '%s' "$out" | grep -qi 'Detected state.*no PF'; then
  pf_pass "step 3b: converge's own detector says 'no PF', not 'v2' — the two detectors disagree harmlessly"
else
  pf_fail "step 3b: converge's own detector did not say 'no PF'"
fi

assert_target_state "$TMP_WORK" "$TMP_HOME" # step 4 — same outcome as no-pf-bare

# Step 5 — the user's prose survives byte for byte, and exactly one marker pair
# was added.
if printf '%s\n' "$claude_before" | head -c -1 >/dev/null 2>&1; then :; fi
if [ "$(head -n "$(printf '%s\n' "$claude_before" | wc -l)" "$TMP_WORK/CLAUDE.md")" = "$claude_before" ]; then
  pf_pass "step 5: the pre-existing CLAUDE.md prose is preserved verbatim"
else
  pf_fail "step 5: the pre-existing CLAUDE.md prose was altered"
fi

backups="$(find "$TMP_WORK" -maxdepth 1 -name 'planning-backup-*' | wc -l)"
if [ "$backups" -eq 0 ]; then
  pf_pass "step 6: no backup — nothing to transfer or delete"
else
  pf_fail "step 6: a backup was created ($backups)"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-003: convergence from a v1 project\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v1-project >/dev/null
sl_before="$(sha256sum <"$TMP_WORK/docs/planning/session-log.md" | cut -d' ' -f1)"
prd_before="$(sha256sum <"$TMP_WORK/docs/prd.md" | cut -d' ' -f1)"

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 1: converge on a v1 project"

if printf '%s' "$out" | grep -qE 'Detected state.*\bv1\b'; then
  pf_pass "step 2: the starting state was recognised as v1 (converge tells v1 from v2 itself — П1-9)"
else
  pf_fail "step 2: the starting state was not reported as v1"
fi

assert_target_state "$TMP_WORK" "$TMP_HOME" # step 3

sl_after="$(sha256sum <"$TMP_WORK/docs/planning/session-log.md" | cut -d' ' -f1)"
if [ "$sl_before" = "$sl_after" ]; then
  pf_pass "step 4: docs/planning/session-log.md was NOT overwritten (T5 — a user document)"
else
  pf_fail "step 4: docs/planning/session-log.md was overwritten by the template"
fi

prd_after="$(sha256sum <"$TMP_WORK/docs/prd.md" 2>/dev/null | cut -d' ' -f1)"
if [ -f "$TMP_WORK/docs/prd.md" ] && [ "$prd_before" = "$prd_after" ]; then
  pf_pass "step 5: docs/prd.md survived untouched (the deletion whitelist is planning/… only)"
else
  pf_fail "step 5: docs/prd.md was deleted or modified"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-005: topping up an INCOMPLETE v3 install (the motivation for Р11)\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v3-incomplete >/dev/null

# Pre-seed exactly the seven skills setup-planning-v3.sh:68 knows about.
mkdir -p "$TMP_HOME/.claude/skills"
for s in pf pf-brd pf-spec pf-check pf-test-plan pf-impl-plan pf-execute; do
  cp -r "$REPO_ROOT/skills/$s" "$TMP_HOME/.claude/skills/$s"
done

state="$(pf_detect_state "$TMP_WORK")"
if [ "$state" = "v3" ]; then
  pf_pass "step 1: detectState() == 'v3' already — under the old 'v3 => no-op' rule this project would never converge"
else
  pf_fail "step 1: detectState() == '$state' (want 'v3')"
fi

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 2: converge tops up an incomplete v3"

assert_target_state "$TMP_WORK" "$TMP_HOME" # step 3

n_skills="$(find "$TMP_HOME/.claude/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l)"
n_repo="$(find "$REPO_ROOT/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l)"
if [ "$n_skills" -eq "$n_repo" ] && [ -f "$TMP_HOME/.claude/skills/pf-qa-setup/SKILL.md" ]; then
  pf_pass "step 4: $n_skills skills installed, including the previously missing pf-qa-setup"
else
  pf_fail "step 4: $n_skills skills installed (framework has $n_repo); pf-qa-setup present: $([ -f "$TMP_HOME/.claude/skills/pf-qa-setup/SKILL.md" ] && echo yes || echo no)"
fi

if [ -f "$TMP_WORK/.pf-version" ] && [ -f "$TMP_WORK/PLANNING.md" ] &&
  grep -q -- '<!-- pf:begin -->' "$TMP_WORK/CLAUDE.md"; then
  pf_pass "step 5: .pf-version, PLANNING.md and the CLAUDE.md section all appeared"
else
  pf_fail "step 5: the top-up did not deliver .pf-version / PLANNING.md / the CLAUDE.md section"
fi

backups="$(find "$TMP_WORK" -maxdepth 1 -name 'planning-backup-*' | wc -l)"
if [ "$backups" -eq 0 ]; then
  pf_pass "step 6: no backup — a pure top-up runs no destructive phase (T6 mirror deletions do NOT trigger one)"
else
  pf_fail "step 6: a backup was created on a pure top-up ($backups)"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-009: all skills installed by DYNAMIC discovery (defect 3) — on a repo COPY (S-5)\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case no-pf-bare >/dev/null
out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 1: converge on a bare project"

installed="$(
  cd "$TMP_HOME/.claude/skills" 2>/dev/null || exit 0
  for p in */; do [ -d "$p" ] && printf '%s\n' "${p%/}"; done | LC_ALL=C sort
)"
expected="$(
  cd "$REPO_ROOT/skills" || exit 0
  for p in */SKILL.md; do [ -f "$p" ] && printf '%s\n' "${p%/SKILL.md}"; done | LC_ALL=C sort
)"
n_installed="$(printf '%s\n' "$installed" | grep -c .)"
n_expected="$(printf '%s\n' "$expected" | grep -c .)"   # derive from skills/, never hardcode
if [ "$n_installed" -eq "$n_expected" ]; then
  pf_pass "step 2: $n_installed skills installed (matches the repo's skills/ count)"
else
  pf_fail "step 2: $n_installed skills installed (want $n_expected — the repo's skill count)"
fi

if [ "$installed" = "$expected" ]; then
  pf_pass "step 3: the installed set equals skills/ of the repo — including the 8 the old installer skipped"
else
  pf_fail "step 3: the installed set differs from skills/"
  diff <(printf '%s\n' "$expected") <(printf '%s\n' "$installed") >&2 || true
fi
for s in pf-close pf-help pf-manual-test pf-qa pf-qa-setup pf-size-tiers pf-test pf-update; do
  if [ ! -d "$TMP_HOME/.claude/skills/$s" ]; then
    pf_fail "step 3: previously skipped skill missing: $s"
  fi
done

# Step 4 — a probe skill in a COPY of the repo. This is the step that proves the
# discovery is dynamic AND that converge resolves the framework root from its own
# file path (a hardcoded count of 15 would make this step unpassable).
TMP_REPO="$(pf_repo_copy)"
mkdir -p "$TMP_REPO/skills/pf-zz-probe"
printf -- '---\nname: pf-zz-probe\ndescription: probe skill for TC-009\n---\n\n# Probe\n' \
  >"$TMP_REPO/skills/pf-zz-probe/SKILL.md"

pf_setup_case no-pf-bare >/dev/null # fresh $TMP_WORK *and* a fresh, empty $TMP_HOME
PF_FRAMEWORK_ROOT="$TMP_REPO"
out="$(pf_run_converge 2>&1)"
rc=$?
unset PF_FRAMEWORK_ROOT
assert_exit_code 0 "$rc" "step 4: converge run out of the repo copy"

n_installed="$(find "$TMP_HOME/.claude/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l)"
# repo skill count + 1 for the pf-zz-probe we added to the copy — derived, not hardcoded
n_expected="$(( $(find "$REPO_ROOT/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l) + 1 ))"
if [ "$n_installed" -eq "$n_expected" ] && [ -f "$TMP_HOME/.claude/skills/pf-zz-probe/SKILL.md" ]; then
  pf_pass "step 4: $n_installed skills installed from the copy (repo + pf-zz-probe) — discovery is dynamic"
else
  pf_fail "step 4: $n_installed skills installed from the copy (want $n_expected, incl. pf-zz-probe)"
fi
assert_target_state "$TMP_WORK" "$TMP_HOME" "$TMP_REPO"

if printf '%s' "$out" | grep -q 'pf-zz-probe'; then
  pf_pass "step 5: the final summary lists the skills actually installed (probe included), not a hardcoded 7"
else
  pf_fail "step 5: the final summary does not mention pf-zz-probe — the skill list is hardcoded somewhere"
fi

assert_repo_untouched # step 6

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-011: T6 is a MIRROR, not an overlay (KI-17)\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v3-incomplete >/dev/null
printf 'stale\n' >"$TMP_WORK/docs/planning/templates/config/stale.md"
printf 'stale\n' >"$TMP_WORK/docs/planning/templates/global/stale.md"

if [ -f "$TMP_WORK/docs/planning/templates/config/.qa-workflow.md" ]; then
  pf_pass "step 1: the fixture carries the template .qa-workflow.md — the case has something to prove"
else
  pf_fail "step 1: the fixture has no template .qa-workflow.md — TC-011 would check nothing"
fi

rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 2: converge on v3-incomplete"

if [ ! -e "$TMP_WORK/docs/planning/templates/config/.qa-workflow.md" ]; then
  pf_pass "step 3: config/.qa-workflow.md is GONE from the project — deleted from the framework, mirrored away here (a cp -r overlay would have left it)"
else
  pf_fail "step 3: config/.qa-workflow.md survived — T6 is an overlay, not a mirror"
fi

if [ ! -e "$TMP_WORK/docs/planning/templates/config/stale.md" ] &&
  [ ! -e "$TMP_WORK/docs/planning/templates/global/stale.md" ]; then
  pf_pass "step 4: both planted stale.md files were mirrored away"
else
  pf_fail "step 4: a planted stale.md survived the mirror"
fi

if diff -r "$REPO_ROOT/docs/planning/templates" "$TMP_WORK/docs/planning/templates" >/dev/null 2>&1; then
  pf_pass "step 5: diff -r is empty in BOTH directions"
else
  pf_fail "step 5: docs/planning/templates/ is not a mirror"
  diff -r "$REPO_ROOT/docs/planning/templates" "$TMP_WORK/docs/planning/templates" | head -10 >&2
fi

if [ -f "$TMP_WORK/docs/planning/templates/config/PLANNING.md" ] &&
  [ -f "$TMP_WORK/docs/planning/templates/config/CLAUDE.md" ] &&
  [ ! -e "$TMP_WORK/docs/planning/templates/config/.qa-workflow.md" ]; then
  pf_pass "step 6: config/ holds the rewritten PLANNING.md and the new CLAUDE.md, and no .qa-workflow.md"
else
  pf_fail "step 6: config/ does not hold exactly {PLANNING.md, CLAUDE.md}"
fi

rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
if [ "$rc" -eq 0 ] && diff -r "$REPO_ROOT/docs/planning/templates" "$TMP_WORK/docs/planning/templates" >/dev/null 2>&1; then
  pf_pass "step 7: the mirror is idempotent — a second run leaves it identical"
else
  pf_fail "step 7: the second run broke the mirror (exit $rc)"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-013: placeholders are substituted; no literals survive (KI-18, D-E)\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case no-pf-claude >/dev/null
parent="$(dirname "$TMP_WORK")"
mv "$TMP_WORK" "$parent/My-Cool-Project"
TMP_WORK="$parent/My-Cool-Project"

rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 1: converge into a directory named My-Cool-Project"

if ! grep -q '\[Project Name\]' "$TMP_WORK/PLANNING.md" "$TMP_WORK/CLAUDE.md"; then
  pf_pass "step 2: no [Project Name] literal left in PLANNING.md / CLAUDE.md"
else
  pf_fail "step 2: the [Project Name] placeholder was handed to the user unsubstituted"
fi

if grep -q 'My-Cool-Project' "$TMP_WORK/PLANNING.md"; then
  pf_pass "step 3: the basename of \$TARGET was substituted in"
else
  pf_fail "step 3: PLANNING.md does not carry the target's basename"
fi

if ! grep -q 'YYYY-MM-DD' "$TMP_WORK/PLANNING.md" "$TMP_WORK/CLAUDE.md"; then
  pf_pass "step 4: no YYYY-MM-DD placeholder in the delivered documents"
else
  pf_fail "step 4: a YYYY-MM-DD placeholder survived"
fi

if grep -q '\[Project Name\]' "$REPO_ROOT/docs/planning/templates/config/CLAUDE.md" &&
  ! grep -q 'YYYY-MM-DD' "$REPO_ROOT/docs/planning/templates/config/CLAUDE.md"; then
  pf_pass "step 5: the CLAUDE.md template carries [Project Name] and no date placeholder (D-E)"
else
  pf_fail "step 5: the CLAUDE.md template has the wrong placeholder set"
fi

section="$(awk '/<!-- pf:begin -->/,/<!-- pf:end -->/' "$TMP_WORK/CLAUDE.md")"
if printf '%s' "$section" | grep -q 'PLANNING.md' &&
  ! printf '%s' "$section" | grep -q '\[Project Name\]'; then
  pf_pass "step 6: the marked-up section comes from the template, is substituted, and points at PLANNING.md"
else
  pf_fail "step 6: the marked-up section is wrong (no PLANNING.md pointer, or an unsubstituted placeholder)"
fi

pf_setup_case v2-project >/dev/null # v2 never created a CLAUDE.md
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
if [ "$rc" -eq 0 ] && [ -f "$TMP_WORK/CLAUDE.md" ] &&
  ! grep -q '\[Project Name\]' "$TMP_WORK/CLAUDE.md"; then
  pf_pass "step 7: CLAUDE.md was created from the template where none existed, with no placeholders left"
else
  pf_fail "step 7: CLAUDE.md was not created cleanly on a project without one"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-014: the CLAUDE.md section is inserted IDEMPOTENTLY (Р8)\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case no-pf-claude >/dev/null
user_line="$(head -n 1 "$TMP_WORK/CLAUDE.md")"

rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
n_begin="$(grep -c -- '<!-- pf:begin -->' "$TMP_WORK/CLAUDE.md")"
if [ "$rc" -eq 0 ] && [ "$n_begin" -eq 1 ] && grep -qF -- "$user_line" "$TMP_WORK/CLAUDE.md"; then
  pf_pass "step 1: exactly one marker pair added; the user's text is intact"
else
  pf_fail "step 1: after the first run there are $n_begin pf:begin markers (want 1)"
fi

# Step 2 — hand-edit INSIDE the markers; converge must restore the body.
sed -i 's|^## Planning Framework$|## Planning Framework (hand-mangled)|' "$TMP_WORK/CLAUDE.md"
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
n_begin="$(grep -c -- '<!-- pf:begin -->' "$TMP_WORK/CLAUDE.md")"
if [ "$rc" -eq 0 ] && [ "$n_begin" -eq 1 ] && ! grep -q 'hand-mangled' "$TMP_WORK/CLAUDE.md"; then
  pf_pass "step 2: the body between the markers was restored from the template; still one pair"
else
  pf_fail "step 2: the marked region was not replaced (markers: $n_begin, mangled text still present?)"
fi

# Step 3 — user prose AFTER pf:end survives.
printf '\n## My own notes after the section\n\nkeep me.\n' >>"$TMP_WORK/CLAUDE.md"
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
n_begin="$(grep -c -- '<!-- pf:begin -->' "$TMP_WORK/CLAUDE.md")"
if [ "$rc" -eq 0 ] && grep -q 'keep me.' "$TMP_WORK/CLAUDE.md" && [ "$n_begin" -eq 1 ]; then
  pf_pass "step 3: text written after <!-- pf:end --> survives the third run"
else
  pf_fail "step 3: text after the closing marker was lost (markers: $n_begin)"
fi

if [ "$(grep -c -- '<!-- pf:begin -->' "$TMP_WORK/CLAUDE.md")" -eq 1 ]; then
  pf_pass "step 5a: exactly one pf:begin after three runs (project a)"
else
  pf_fail "step 5a: the section was duplicated across runs"
fi

# Step 4 + 5b — a project with no CLAUDE.md at all.
pf_setup_case v2-project >/dev/null
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
if [ "$rc" -eq 0 ] && [ "$(grep -c -- '<!-- pf:begin -->' "$TMP_WORK/CLAUDE.md")" -eq 1 ] &&
  grep -q 'PLANNING.md' "$TMP_WORK/CLAUDE.md"; then
  pf_pass "step 4/5b: CLAUDE.md created with one marker pair and a pointer to PLANNING.md"
else
  pf_fail "step 4/5b: CLAUDE.md was not created correctly on a project without one"
fi

# Step 6 — an unpaired marker must not be silently mangled.
pf_setup_case no-pf-claude >/dev/null
printf '\n<!-- pf:begin -->\nhalf a section, no closing marker\n' >>"$TMP_WORK/CLAUDE.md"
out="$(pf_run_converge 2>&1)"
rc=$?
n_begin="$(grep -c -- '<!-- pf:begin -->' "$TMP_WORK/CLAUDE.md")"
n_end="$(grep -c -- '<!-- pf:end -->' "$TMP_WORK/CLAUDE.md" || true)"
if [ "$n_begin" -eq 1 ] && [ "${n_end:-0}" -eq 0 ] &&
  printf '%s' "$out" | grep -qi 'WARNING.*marker'; then
  pf_pass "step 6: unbalanced markers => WARNING, no second section written, no silent corruption (exit $rc)"
else
  pf_fail "step 6: unbalanced markers were handled wrongly (begin=$n_begin end=${n_end:-0}, warning printed?)"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-015: the old UNMARKED v1 section — a WARNING, never a deletion\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v1-project >/dev/null
tail_before="$(grep -c . "$TMP_WORK/CLAUDE.md")"
user_after_banner="$(tail -n 1 "$TMP_WORK/CLAUDE.md")"

out="$(pf_run_converge 2>&1)"
rc=$?
assert_exit_code 0 "$rc" "step 1: converge on a v1 project with an unmarked section"

banner_line="$(grep -n 'Planning Framework Integration' "$TMP_WORK/CLAUDE.md" | head -n 1 | cut -d: -f1)"
if printf '%s' "$out" | grep -q 'Planning Framework Integration' &&
  printf '%s' "$out" | grep -qE "CLAUDE\.md:[0-9]+"; then
  pf_pass "step 2: a WARNING naming the banner and its line number was printed"
else
  pf_fail "step 2: no WARNING with the banner literal and a line number"
fi

if [ -n "$banner_line" ]; then
  pf_pass "step 3: the v1 banner is still in the file (line $banner_line) — not deleted"
else
  pf_fail "step 3: converge DELETED the old v1 banner (and possibly the prose under it)"
fi

if grep -qF -- "$user_after_banner" "$TMP_WORK/CLAUDE.md" &&
  [ "$(grep -c . "$TMP_WORK/CLAUDE.md")" -gt "$tail_before" ]; then
  pf_pass "step 4: the user's prose after the banner survived"
else
  pf_fail "step 4: the user's prose after the banner was lost"
fi

if [ "$(grep -c -- '<!-- pf:begin -->' "$TMP_WORK/CLAUDE.md")" -eq 1 ]; then
  pf_pass "step 5: the marked-up section was inserted anyway"
else
  pf_fail "step 5: no marked-up section was inserted"
fi

before="$(sha256sum <"$TMP_WORK/CLAUDE.md" | cut -d' ' -f1)"
out="$(pf_run_converge 2>&1)"
after="$(sha256sum <"$TMP_WORK/CLAUDE.md" | cut -d' ' -f1)"
if printf '%s' "$out" | grep -q 'Planning Framework Integration' && [ "$before" = "$after" ]; then
  pf_pass "step 6: the second run warns again and changes nothing"
else
  pf_fail "step 6: the second run either stopped warning or modified CLAUDE.md"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-024: .qa-workflow.md — hint / WARNING, but NEVER created (Р4)\n'
# ══════════════════════════════════════════════════════════════════════════════

# (a) file absent
pf_setup_case no-pf-bare >/dev/null
out="$(pf_run_converge 2>&1)"
if [ ! -e "$TMP_WORK/.qa-workflow.md" ] && printf '%s' "$out" | grep -q '/pf-qa-setup'; then
  pf_pass "step 1: absent => not created, and the /pf-qa-setup hint is printed"
else
  pf_fail "step 1: converge created .qa-workflow.md, or printed no hint"
fi

# (b) v2-stamped file
pf_setup_case v2-project >/dev/null
qa_before="$(sha256sum <"$TMP_WORK/.qa-workflow.md" | cut -d' ' -f1)"
out="$(pf_run_converge 2>&1)"
qa_after="$(sha256sum <"$TMP_WORK/.qa-workflow.md" | cut -d' ' -f1)"
if [ "$qa_before" = "$qa_after" ] &&
  printf '%s' "$out" | grep -qi 'WARNING.*qa-workflow'; then
  pf_pass "step 2: the v2-stamped file is left alone and a WARNING recommends /pf-qa-setup"
else
  pf_fail "step 2: the v2-stamped .qa-workflow.md was overwritten, or no WARNING was printed"
fi

# (c) hand-edited file, no version stamp
pf_setup_case v2-project >/dev/null
printf '# QA workflow\n\nUNIQUE-MARKER-9f3a\n\n- [ ] run the tests\n' >"$TMP_WORK/.qa-workflow.md"
qa_before="$(sha256sum <"$TMP_WORK/.qa-workflow.md" | cut -d' ' -f1)"
out="$(pf_run_converge 2>&1)"
qa_after="$(sha256sum <"$TMP_WORK/.qa-workflow.md" | cut -d' ' -f1)"
# shellcheck disable=SC2016  # the backticks are part of the literal being grepped for
if [ "$qa_before" = "$qa_after" ] &&
  ! printf '%s' "$out" | grep -qi 'WARNING.*qa-workflow' &&
  ! printf '%s' "$out" | grep -q 'Run `/pf-qa-setup` in Claude Code to create'; then
  pf_pass "step 3: a hand-edited .qa-workflow.md is left byte-identical, with no WARNING and no create-hint"
else
  pf_fail "step 3: converge warned about, or touched, a legitimate hand-edited .qa-workflow.md"
fi

if [ -z "$(find "$REPO_ROOT/docs/planning/templates" -name '.qa-workflow.md')" ]; then
  pf_pass "step 4: no .qa-workflow.md template in the framework — deleted without replacement (Р4)"
else
  pf_fail "step 4: a .qa-workflow.md template still exists in the framework"
fi

if [ -f "$TMP_HOME/.claude/skills/pf-qa-setup/SKILL.md" ]; then
  pf_pass "step 5: pf-qa-setup is installed — THIS is the load-bearing half of the defect-2 fix"
else
  pf_fail "step 5: pf-qa-setup was not installed"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-030: the CLI contract — flags, order, unknown flags\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v2-project >/dev/null
rc=0
pf_run_converge --dry-run --target "$TMP_WORK" >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 1: flags accepted before --target"

rc=0
pf_run_converge --target "$TMP_WORK" --dry-run --doc-language Russian --force >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 2: five flags together, in an arbitrary order"

snap_before="$(snapshot_tree "$TMP_WORK")"
out="$(pf_run_converge --bogus-flag 2>&1)"
rc=$?
snap_after="$(snapshot_tree "$TMP_WORK")"
if [ "$rc" -eq 2 ] && printf '%s' "$out" | grep -q 'Usage:' && [ "$snap_before" = "$snap_after" ]; then
  pf_pass "step 3: --bogus-flag => exit 2 + usage; the project is untouched"
else
  pf_fail "step 3: --bogus-flag gave exit $rc (want 2), usage printed? project untouched?"
fi

out="$(pf_run_converge --target 2>&1)"
rc=$?
if [ "$rc" -eq 2 ] && printf '%s' "$out" | grep -qi 'requires a directory'; then
  pf_pass "step 4: --target with no value => exit 2 and a clear message"
else
  pf_fail "step 4: --target with no value gave exit $rc (want 2)"
fi

out="$(pf_run_converge --doc-language Klingon 2>&1)"
rc=$?
if [ "$rc" -eq 2 ] && printf '%s' "$out" | grep -q 'Russian, English'; then
  pf_pass "step 5: --doc-language Klingon => exit 2 + the list of valid values"
else
  pf_fail "step 5: --doc-language Klingon gave exit $rc (want 2 + 'Russian, English')"
fi

pf_setup_case v2-project >/dev/null
rc=0
pf_run_converge_cwd "$TMP_WORK" >/dev/null 2>&1 || rc=$?
assert_exit_code 0 "$rc" "step 6: no --target => the target defaults to \$(pwd)"
assert_target_state "$TMP_WORK" "$TMP_HOME"

out="$(pf_run_converge --help 2>&1)"
rc=$?
if [ "$rc" -eq 0 ] &&
  printf '%s' "$out" | grep -q -- '--target' &&
  printf '%s' "$out" | grep -q -- '--dry-run' &&
  printf '%s' "$out" | grep -q -- '--force' &&
  printf '%s' "$out" | grep -q -- '--yes' &&
  printf '%s' "$out" | grep -q -- '--doc-language' &&
  ! printf '%s' "$out" | grep -q -- '--fail-after'; then
  pf_pass "step 7: --help lists every user flag and hides the --fail-after test hook (D-F)"
else
  pf_fail "step 7: --help is wrong (exit $rc), or it leaks --fail-after"
fi

# ══════════════════════════════════════════════════════════════════════════════
# shellcheck disable=SC2016  # $TARGET / $HOME are prose here, not expansions
printf '\n=== TC-031: blast radius — only $TARGET and $HOME/.claude\n'
# ══════════════════════════════════════════════════════════════════════════════

pf_setup_case v2-project >/dev/null
TMP_NEIGHBOUR="$(pf_mktemp_d)"
TMP_ELSEWHERE="$(pf_mktemp_d)"
printf 'neighbour data\n' >"$TMP_NEIGHBOUR/data.txt"
mkdir -p "$TMP_NEIGHBOUR/sub" && printf 'more\n' >"$TMP_NEIGHBOUR/sub/more.txt"
printf 'cwd data\n' >"$TMP_ELSEWHERE/cwd.txt"

snap_neighbour="$(snapshot_tree "$TMP_NEIGHBOUR")"
snap_elsewhere="$(snapshot_tree "$TMP_ELSEWHERE")"

# Run from a third directory — the wrapper still supplies --target (S-1).
cd "$TMP_ELSEWHERE" || exit 1
rc=0
pf_run_converge >/dev/null 2>&1 || rc=$?
cd "$REPO_ROOT" || exit 1
assert_exit_code 0 "$rc" "step 2: converge, launched from an unrelated cwd"

if [ "$snap_neighbour" = "$(snapshot_tree "$TMP_NEIGHBOUR")" ]; then
  pf_pass "step 3a: the neighbouring directory is untouched"
else
  pf_fail "step 3a: the neighbouring directory was modified"
fi
if [ "$snap_elsewhere" = "$(snapshot_tree "$TMP_ELSEWHERE")" ]; then
  pf_pass "step 3b: the cwd converge was launched from is untouched"
else
  pf_fail "step 3b: converge wrote into the cwd it was launched from"
fi

top="$(cd "$TMP_HOME" && find . -mindepth 1 -maxdepth 1 | LC_ALL=C sort | tr '\n' ' ')"
inside="$(cd "$TMP_HOME/.claude" && find . -mindepth 1 -maxdepth 1 | LC_ALL=C sort | tr '\n' ' ')"
if [ "$top" = "./.claude " ] && [ "$inside" = "./bin ./skills " ]; then
  pf_pass "step 4: \$HOME gained only .claude/{skills,bin} — nothing outside .claude/"
else
  pf_fail "step 4: \$HOME gained more than .claude/{skills,bin}: top='$top' inside='$inside'"
fi

assert_repo_untouched # step 5

pf_summary
