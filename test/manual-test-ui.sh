#!/usr/bin/env bash
# test/manual-test-ui.sh — the Manual Test UI suite: TC-001, TC-015, TC-016.
#
# 20260812-bug-flaky-manual-test-ui (TC-004): the TC-015 step-4 fixture wrote
# its Windows temp path into projects.json with a bare printf, which a native
# Windows node process then resolved against the wrong drive (Git Bash gives
# POSIX paths in argv, but never converts path text living inside a file it
# writes). Step 4 below is therefore now split into two pf_pass/pf_fail
# checkpoints labelled "TC-004 step 1" / "TC-004 step 2" — server start and
# project listing are now told apart — while staying physically inside the
# TC-015 section, since the fixture setup is shared.
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

# The two skills TC-001 inspects, in the working copy — not in ~/.claude/skills,
# which is a per-machine install of some earlier version (same reasoning as
# test/skills-static.sh).
PLAN_SKILL="$REPO_ROOT/skills/pf-test-plan/SKILL.md"
TEST_SKILL="$REPO_ROOT/skills/pf-test/SKILL.md"

# lines_with <file> <extended-regex>… — the physical lines of <file> matching
# EVERY regex. Non-zero and silent when there is none.
lines_with() {
  local file="$1"
  shift
  local out re
  out="$(grep -E -- "$1" "$file" 2>/dev/null)" || return 1
  shift
  for re in "$@"; do
    out="$(printf '%s\n' "$out" | grep -E -- "$re")" || return 1
  done
  printf '%s\n' "$out"
}

# assert_states <label> <file> <regex>… — pf_pass iff ONE line carries them all.
# One line and not "somewhere in the file" on purpose: a skill that names the
# label in one paragraph and the rule in an unrelated other has not connected
# them, and a sub-agent reading it will not either.
assert_states() {
  local label="$1" file="$2"
  shift 2
  if lines_with "$file" "$@" >/dev/null; then
    pf_pass "$label"
  else
    pf_fail "$label — no single line of ${file#"$REPO_ROOT"/} states it"
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
# shellcheck disable=SC2016  # backticks are markdown in a printed label, not command substitution
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
ui_out="$(cd "$REPO_ROOT" && node --test --test-reporter=tap "$UI_GLOB" 2>&1)" || ui_rc=$?

if [ "$ui_rc" -eq 0 ] &&
  printf '%s\n' "$ui_out" | grep -qF -- 'checklist-ru.test.js' &&
  printf '%s\n' "$ui_out" | grep -qE '^# fail 0$'; then
  pf_pass "step 4: the manual-test-ui node suites run and exit 0"
else
  pf_fail "step 4: the manual-test-ui node suites did not run clean (exit $ui_rc)"
  printf '%s\n' "$ui_out" | tail -20 >&2
fi

# ══════════════════════════════════════════════════════════════════════════════
# 20260812-bug-flaky-manual-test-ui — TC-001/TC-002: Cause 1 was `EPERM` on
# `fs.symlinkSync` inside `buildFixture()` taking down all nine TC-011
# subchecks instead of just the symlink-dependent one. TC-001 proves the
# other eight still pass; TC-002 proves the symlink subcheck itself is never
# silently swallowed (skipped-with-reason, executed, or a reported `missing`
# — never absent without a trace).
#
# Captured separately into $rp_out, deliberately NOT merged into $ui_out:
# $ui_out globs the whole tools/manual-test-ui/test/ directory, so "output is
# non-empty" stays true even if read-paths.test.js itself never ran — that
# vacuousness reason does not go away just because both captures are TAP now.
#
# NOTE for the next reader: there is a second, unrelated "=== TC-001" section
# further down this file (the pf-test-plan/pf-test skill-text checks, from a
# different issue). Its labels are bare "step N: …" with no "TC-001 " prefix,
# so there is no literal collision with the "TC-001 step N: …" labels below.
# Left untouched on purpose.
# ══════════════════════════════════════════════════════════════════════════════

rp_out="$(cd "$REPO_ROOT" && node --test --test-reporter=tap tools/manual-test-ui/test/read-paths.test.js 2>&1)"

# subcheck_state <output> <name> — echoes exactly one of: pass | failed | skip | missing
# for the named node --test subtest, decided by TAP line shape alone:
#   "not ok N - <name>"          -> failed
#   "ok N - <name> # SKIP …"     -> skip
#   "ok N - <name>" (no # SKIP)  -> pass
#   neither line found           -> missing
# Anchored at line start (^[[:space:]]*(not )?ok [0-9]+ - <name>) so a bare
# grep -F match against a "not ok" line can never be mistaken for a pass.
subcheck_state() {
  local out="$1" name="$2" ok_line notok_line
  notok_line="$(printf '%s\n' "$out" | grep -E -- "^[[:space:]]*not ok [0-9]+ - ${name}")"
  if [ -n "$notok_line" ]; then
    printf 'failed'
    return
  fi
  ok_line="$(printf '%s\n' "$out" | grep -E -- "^[[:space:]]*ok [0-9]+ - ${name}")"
  if [ -z "$ok_line" ]; then
    printf 'missing'
    return
  fi
  if printf '%s\n' "$ok_line" | grep -q -- '# SKIP'; then
    printf 'skip'
  else
    printf 'pass'
  fi
}

printf '\n=== TC-001: the eight non-symlink subchecks of TC-011 pass when symlinkSync is unavailable\n'

if [ -n "$rp_out" ]; then
  pf_pass "TC-001 step 1: read-paths.test.js run captured, no immediate whole-TC-011 crash"
else
  pf_fail "TC-001 step 1: read-paths.test.js run produced no capturable output"
fi

tc001_name_positive="positive control: a document of the project is readable"
tc001_name_step1="step 1: traversal out of the project is refused, however it is spelled"
tc001_name_step3a="step 3a: a sibling directory sharing the project's prefix is refused"
tc001_name_step3b="step 3b: a sibling of public/ is refused by the static route"
tc001_name_step4="step 4: the memory prefix is readable — the one allowed extension"
tc001_name_step5="step 5: normalisation happens before the prefix comparison"
tc001_name_step6="step 6: session transcripts are unreachable, by name and by listing"
tc001_name_browser="browser modules are served from an allowlist, never from the whole lib/"

tc001_state_positive="$(subcheck_state "$rp_out" "$tc001_name_positive")"
tc001_state_step1="$(subcheck_state "$rp_out" "$tc001_name_step1")"
tc001_state_step3a="$(subcheck_state "$rp_out" "$tc001_name_step3a")"
tc001_state_step3b="$(subcheck_state "$rp_out" "$tc001_name_step3b")"
tc001_state_step4="$(subcheck_state "$rp_out" "$tc001_name_step4")"
tc001_state_step5="$(subcheck_state "$rp_out" "$tc001_name_step5")"
tc001_state_step6="$(subcheck_state "$rp_out" "$tc001_name_step6")"
tc001_state_browser="$(subcheck_state "$rp_out" "$tc001_name_browser")"

tc001_found=0
[ "$tc001_state_positive" != "missing" ] && tc001_found=$((tc001_found + 1))
[ "$tc001_state_step1" != "missing" ] && tc001_found=$((tc001_found + 1))
[ "$tc001_state_step3a" != "missing" ] && tc001_found=$((tc001_found + 1))
[ "$tc001_state_step3b" != "missing" ] && tc001_found=$((tc001_found + 1))
[ "$tc001_state_step4" != "missing" ] && tc001_found=$((tc001_found + 1))
[ "$tc001_state_step5" != "missing" ] && tc001_found=$((tc001_found + 1))
[ "$tc001_state_step6" != "missing" ] && tc001_found=$((tc001_found + 1))
[ "$tc001_state_browser" != "missing" ] && tc001_found=$((tc001_found + 1))

if [ "$tc001_found" -eq 8 ]; then
  pf_pass "TC-001 step 2: eight non-symlink subchecks found in captured output"
else
  pf_fail "TC-001 step 2: fewer than eight non-symlink subchecks found in captured output"
fi

if [ "$tc001_state_positive" = "pass" ]; then
  pf_pass "TC-001 step 3a: positive control passed despite EPERM"
else
  pf_fail "TC-001 step 3a: positive control did not pass"
fi

if [ "$tc001_state_step1" = "pass" ]; then
  pf_pass "TC-001 step 3b: traversal-refusal (step 1) subcheck passed despite EPERM"
else
  pf_fail "TC-001 step 3b: traversal-refusal (step 1) subcheck did not pass"
fi

if [ "$tc001_state_step3a" = "pass" ]; then
  pf_pass "TC-001 step 3c: sibling-prefix (step 3a) subcheck passed despite EPERM"
else
  pf_fail "TC-001 step 3c: sibling-prefix (step 3a) subcheck did not pass"
fi

if [ "$tc001_state_step3b" = "pass" ]; then
  pf_pass "TC-001 step 3d: public-sibling (step 3b) subcheck passed despite EPERM"
else
  pf_fail "TC-001 step 3d: public-sibling (step 3b) subcheck did not pass"
fi

if [ "$tc001_state_step4" = "pass" ]; then
  pf_pass "TC-001 step 3e: memory-prefix (step 4) subcheck passed despite EPERM"
else
  pf_fail "TC-001 step 3e: memory-prefix (step 4) subcheck did not pass"
fi

if [ "$tc001_state_step5" = "pass" ]; then
  pf_pass "TC-001 step 3f: prefix-normalisation (step 5) subcheck passed despite EPERM"
else
  pf_fail "TC-001 step 3f: prefix-normalisation (step 5) subcheck did not pass"
fi

if [ "$tc001_state_step6" = "pass" ]; then
  pf_pass "TC-001 step 3g: transcript-isolation (step 6) subcheck passed despite EPERM"
else
  pf_fail "TC-001 step 3g: transcript-isolation (step 6) subcheck did not pass"
fi

if [ "$tc001_state_browser" = "pass" ]; then
  pf_pass "TC-001 step 3h: browser-module allowlist subcheck passed despite EPERM"
else
  pf_fail "TC-001 step 3h: browser-module allowlist subcheck did not pass"
fi

printf '\n=== TC-002: symlink subcheck (step 2) is skipped-with-reason, executed, or missing — never silently swallowed\n'

tc002_name_step2="step 2: a symlink pointing out of the project is refused"
tc002_state_step2="$(subcheck_state "$rp_out" "$tc002_name_step2")"

if [ "$tc002_state_step2" != "missing" ]; then
  pf_pass "TC-002 step 1: step 2 subcheck is present in output (skip or executed)"
else
  pf_fail "TC-002 step 1: step 2 subcheck is missing from output"
fi

# Applicable only when skip (test_plan.md TC-002 step 2): neither pass nor
# fail is printed for the executed or missing branches.
if [ "$tc002_state_step2" = "skip" ]; then
  if printf '%s\n' "$rp_out" | grep -qiE -- 'EPERM|Developer Mode|symlink'; then
    pf_pass "TC-002 step 2: symlink unavailable — step 2 skipped with a stated reason"
  else
    pf_fail "TC-002 step 2: step 2 skipped silently, no reason stated"
  fi
fi

# Applicable only when executed, i.e. pass or failed (test_plan.md TC-002
# step 3): neither pass nor fail is printed for the skip or missing branches.
if [ "$tc002_state_step2" = "pass" ] || [ "$tc002_state_step2" = "failed" ]; then
  if [ "$tc002_state_step2" = "pass" ]; then
    pf_pass "TC-002 step 3: symlink available — step 2 executed and passed"
  else
    pf_fail "TC-002 step 3: symlink available but step 2 did not run or failed"
  fi
fi

# Always applicable (test_plan.md TC-002 step 4), including when step 2 is
# "missing" — a missing step 2 must not also hide a skip elsewhere.
tc002_other_skipped=0
[ "$tc001_state_positive" = "skip" ] && tc002_other_skipped=1
[ "$tc001_state_step1" = "skip" ] && tc002_other_skipped=1
[ "$tc001_state_step3a" = "skip" ] && tc002_other_skipped=1
[ "$tc001_state_step3b" = "skip" ] && tc002_other_skipped=1
[ "$tc001_state_step4" = "skip" ] && tc002_other_skipped=1
[ "$tc001_state_step5" = "skip" ] && tc002_other_skipped=1
[ "$tc001_state_step6" = "skip" ] && tc002_other_skipped=1
[ "$tc001_state_browser" = "skip" ] && tc002_other_skipped=1

if [ "$tc002_other_skipped" -eq 0 ]; then
  pf_pass "TC-002 step 4: skip is confined to step 2 only"
else
  pf_fail "TC-002 step 4: a subcheck other than step 2 was also skipped"
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

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-001: the skills declare the data a case needs and carry it to the checklist\n'
# ══════════════════════════════════════════════════════════════════════════════
#
# Static by nature: the subject is the TEXT of two skills, which is the only
# form in which they exist — there is no code path to exercise. A Claude Code
# session interpreting that text is what actually produces the checklist, so
# what these seven steps guard is that the instruction is present, complete and
# stated in one place rather than implied across three.

# ─── Steps 1-2: /pf-test-plan makes the declaration happen at plan time ───────

assert_states \
  "step 1: pf-test-plan requires a non-empty Test Data field for every Manual TC" \
  "$PLAN_SKILL" 'Test Data' 'Manual' 'mandatory' 'non-empty'

# The boundary, and the reason it exists: "bring up service X" cannot be copied
# into a directory, so it is a precondition and never test data.
assert_states \
  "step 2: pf-test-plan keeps prose preconditions out of Test Data" \
  "$PLAN_SKILL" 'Test Data' '[Pp]reconditions' '[Pp]rose'

# ─── Steps 3-5: /pf-test carries it into the artifacts a tester receives ──────

assert_states \
  "step 3: pf-test copies the declared Test Data of each Manual TC into the checklist" \
  "$TEST_SKILL" 'Test Data' 'Manual' 'checklist' 'copied'

assert_states \
  "step 4: pf-test generates test-data/ with fixtures and setup.mjs" \
  "$TEST_SKILL" 'docs/issues/.*test-data/' 'fixtures' 'setup\.mjs'

# The path formula belongs in the checklist itself, so the document stays
# self-sufficient when read as a plain file with no tooling around it.
assert_states \
  "step 5: pf-test writes the prepared-data location into the checklist prerequisites" \
  "$TEST_SKILL" 'Prepared data' '[Pp]rerequisites' 'pf-test-data/'

# ─── Step 6: the stage that creates the artifact is the stage that commits it ─
# Otherwise the working tree stays modified after /pf-test reports success and
# the pre-close gate fails on a tree nobody dirtied by hand.

assert_states \
  "step 6: pf-test commits the generated test-data/ via the shared pf-git procedure" \
  "$TEST_SKILL" 'test-data/' 'pf-git' 'Stage commit'

# ─── Step 7: the jargon ban survived the edit, in full ────────────────────────
# The checklist goes to an external tester. Every one of the seven forbidden
# terms must still be named on the ban's own line — a ban that lost half its
# list is a ban that lets half the jargon through, and the new labels were made
# everyday words ("Test Data", "Prepared data") precisely to stay inside it.

assert_states \
  "step 7: the §5.3 jargon ban is still stated in full" \
  "$TEST_SKILL" 'Do not include' '"BRD"' '"specs\.md"' '"/pf"' '"SKILL\.md"' \
  '"issue branch"' '"Status Tracker"' '"implementation plan"'

# ══════════════════════════════════════════════════════════════════════════════
printf '\n=== TC-015: the tool needs no additional dependencies\n'
# ══════════════════════════════════════════════════════════════════════════════
#
# "Clone it and run it" is a property of the tool, and one that a single
# `require("express")` destroys silently: nothing breaks on the machine where
# the package happens to be installed. Hence the subject here is the *composition*
# of the repository — no manifest, no lockfile, no vendored modules, and no
# module specifier that names anything but a Node builtin or a file of the tool
# itself. Step 4 then proves the claim end to end: the server serves with
# nothing installed at all.

UI_DIR="$REPO_ROOT/tools/manual-test-ui"
SETUP_TEMPLATE="$REPO_ROOT/skills/pf-test/templates/setup.mjs"

# A quote of either kind, and anything that is not one. Built as variables
# because both regex and shell quoting want the same two characters, and
# spelling them inline four times is how one of the four ends up wrong.
SPEC_Q='["'"'"']'
SPEC_BODY='[^"'"'"']+'

# module_specifiers <file> — every module the file asks for, one per line.
#
# Four forms and deliberately no fifth: `require("x")`, a dynamic `import("x")`,
# `import … from "x"` / `export … from "x"`, and a bare `import "x"`. The two
# statement forms are anchored to the start of a line so that prose inside a
# comment — the word "from" followed by a quoted phrase, of which these files
# have several — is never mistaken for a dependency.
module_specifiers() {
  local file="$1"
  {
    grep -oE "require\([[:space:]]*${SPEC_Q}${SPEC_BODY}${SPEC_Q}" "$file"
    grep -oE "import\([[:space:]]*${SPEC_Q}${SPEC_BODY}${SPEC_Q}" "$file"
    grep -oE "^[[:space:]]*(import|export)[^;]*[[:space:]]from[[:space:]]*${SPEC_Q}${SPEC_BODY}${SPEC_Q}" "$file"
    grep -oE "^[[:space:]]*import[[:space:]]*${SPEC_Q}${SPEC_BODY}${SPEC_Q}" "$file"
  } 2>/dev/null | sed -E "s/.*${SPEC_Q}(${SPEC_BODY})${SPEC_Q}.*/\1/" | sort -u
}

# free_port — a port nobody is listening on, from Node itself (bind :0, read
# the number, release it). Hard-coding 4317 would collide with the developer's
# own `make test-ui` session, which is exactly the machine this suite runs on.
free_port() {
  node -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>process.stdout.write(String(p)));});'
}

# ─── Step 1: no manifest, no lockfile, no vendored modules ────────────────────
# Searched recursively rather than at the top level: a package.json one
# directory down is just as much a dependency as one at the root, and a
# node_modules/ under public/ would be served to the browser as well.

manifests="$(find "$UI_DIR" \
  \( -name package.json -o -name package-lock.json -o -name node_modules \) \
  -print 2>/dev/null)"

if [ -z "$manifests" ]; then
  pf_pass "step 1: manual-test-ui carries no package manifest and no node_modules"
else
  pf_fail "step 1: manual-test-ui carries a package manifest or node_modules"
  printf '%s\n' "$manifests" >&2
fi

# ─── Step 2: every specifier is a builtin or a file of the tool ───────────────

foreign_specs=""
spec_count=0
for js in "$UI_DIR"/server.js "$UI_DIR"/lib/*.js "$UI_DIR"/public/*.js; do
  [ -f "$js" ] || continue
  while IFS= read -r spec; do
    [ -n "$spec" ] || continue
    spec_count=$((spec_count + 1))
    case "$spec" in
      node:* | ./* | ../*) ;;
      *) foreign_specs="${foreign_specs}${js#"$REPO_ROOT"/}: $spec"$'\n' ;;
    esac
  done <<<"$(module_specifiers "$js")"
done

# The count is not decoration: an extractor that silently matches nothing would
# make this step pass on a tool that imports half of npm.
if [ -n "$foreign_specs" ]; then
  pf_fail "step 2: a module specifier names neither a node: builtin nor a file of the tool"
  printf '%s' "$foreign_specs" >&2
elif [ "$spec_count" -eq 0 ]; then
  pf_fail "step 2: no module specifier was found at all — the scan matched nothing"
else
  pf_pass "step 2: every import is a node: builtin or a relative path inside the tool"
fi

# ─── Step 3: the generated setup.mjs, and every instance of it ────────────────
# The template is what /pf-test copies into every issue, so a dependency added
# here is a dependency added to every issue that is prepared from then on. The
# instances already in the tree are checked with it: the template's promise is
# only worth what its copies keep. Builtins only — a setup script has no tool of
# its own to import from.

setup_scripts=("$SETUP_TEMPLATE")
while IFS= read -r found; do
  [ -n "$found" ] && setup_scripts+=("$found")
done <<<"$(find "$REPO_ROOT/docs/issues" -name setup.mjs -print 2>/dev/null)"

setup_foreign=""
setup_count=0
for mjs in "${setup_scripts[@]}"; do
  if [ ! -f "$mjs" ]; then
    setup_foreign="${setup_foreign}${mjs#"$REPO_ROOT"/}: no such file"$'\n'
    continue
  fi
  while IFS= read -r spec; do
    [ -n "$spec" ] || continue
    setup_count=$((setup_count + 1))
    case "$spec" in
      node:*) ;;
      *) setup_foreign="${setup_foreign}${mjs#"$REPO_ROOT"/}: $spec"$'\n' ;;
    esac
  done <<<"$(module_specifiers "$mjs")"
done

if [ -n "$setup_foreign" ]; then
  pf_fail "step 3: a setup.mjs imports something other than a node: builtin"
  printf '%s' "$setup_foreign" >&2
elif [ "$setup_count" -eq 0 ]; then
  pf_fail "step 3: no import was found in any setup.mjs — the scan matched nothing"
else
  pf_pass "step 3: setup.mjs imports node: builtins only"
fi

# ─── Step 4: it serves, with nothing installed ────────────────────────────────
# The whole claim, exercised rather than read: a throwaway projects.json, a
# fixture repository in a temp directory, `node server.js`, and an answer. No
# install step anywhere — if one were needed, this is where the tool would say
# "Cannot find module".
#
# The fixture repository carries a checklist so that the answer proves the
# server walked git (issueCount counts issues whose checklist exists), not
# merely echoed the configuration back.
#
# The two pf_pass/pf_fail checkpoints below this fixture setup are labelled
# "TC-004 step 1" / "TC-004 step 2", not "TC-015 step 4" — a deliberate switch
# of TC-ID (20260812-bug-flaky-manual-test-ui). The fixture setup above stays
# shared with the rest of the TC-015 section; only the two checkpoints moved.

TC015_ISSUE="20260101-improve-manual-test-ui-fixture"
TC015_PROJECT="pf-fixture-project"

tc015_root="$(pf_mktemp_d)" || exit 1
tc015_repo="$tc015_root/$TC015_PROJECT"
tc015_issue_dir="$tc015_repo/docs/issues/open/$TC015_ISSUE"
mkdir -p "$tc015_issue_dir"
printf '# Issue\n\n**Type:** improve\n**Size Tier:** small\n' >"$tc015_issue_dir/prompt.md"
printf '# Manual Test Checklist\n\n**Feature Name:** fixture\n' >"$tc015_issue_dir/manual_test_checklist.md"

git -C "$tc015_repo" init -q
# The default branch of `git init` is a per-machine setting; the tool resolves
# develop → main → master, so the fixture pins the first of them explicitly
# instead of inheriting whatever this machine calls its first branch.
git -C "$tc015_repo" symbolic-ref HEAD refs/heads/develop
pf_git_init "$tc015_repo"

tc015_config="$tc015_root/projects.json"

# Path conversion (TC-004): $tc015_repo is a POSIX path from pf_mktemp_d.
# Git Bash rewrites POSIX paths that appear as argv into native Windows paths
# for the child process it execs, but it never touches path text that lives
# inside a file's *content* — and node reads projects.json's content, not
# argv. Written as-is, a native Windows node resolves the leading slash
# against whatever the current drive happens to be, not against the repo's
# real location. cygpath -w is the conversion that closes that gap; on a
# platform without it (Linux/macOS) the POSIX path is already native.
if command -v cygpath >/dev/null 2>&1; then
  repo_path="$(cygpath -w "$tc015_repo")"
else
  repo_path="$tc015_repo"
fi

# The one value that never round-trips through a file: the next task compares
# against this, not against $tc015_repo or $repo_path re-derived later.
expected_path="$repo_path"

# Serialized via node, not printf: repo_path may contain backslashes (Windows)
# that need JSON escaping, and printf has no notion of that. Values are
# passed through process.argv rather than interpolated into the -e script text
# — interpolating a backslash-laden Windows path into shell-quoted JS source
# is exactly the kind of thing that breaks before JSON.stringify ever runs.
node -e '
  const fs = require("node:fs");
  const [, name, path, cfgPath] = process.argv;
  fs.writeFileSync(
    cfgPath,
    JSON.stringify({ projects: [{ name, path, defaultBranch: "develop" }] })
  );
' "$TC015_PROJECT" "$repo_path" "$tc015_config"

# Read back the same way, to prove what actually landed in the file (not what
# the shell thinks it wrote).
written_path="$(node -e '
  const fs = require("node:fs");
  const [, cfgPath] = process.argv;
  const data = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  process.stdout.write(data.projects[0].path);
' "$tc015_config")"

pf_note "TC-015: tc015_repo (raw, from pf_mktemp_d) = $tc015_repo"
pf_note "TC-015: projects.json path field = $written_path"

tc015_port="$(free_port)"
tc015_log="$tc015_root/server.log"

# PLANNING_TEST_UI_MEMORY_ROOT is pointed at the temp tree as well: nothing in
# this suite may read the developer's real ~/.claude.
PLANNING_TEST_UI_CONFIG="$tc015_config" \
  PLANNING_TEST_UI_MEMORY_ROOT="$tc015_root/memory" \
  node "$UI_DIR/server.js" --port "$tc015_port" >"$tc015_log" 2>&1 &
tc015_pid=$!

# Up to ~10s, and abandoned early if the process dies: a server that failed
# for want of a module exits immediately, and waiting out the full timeout for
# it would only slow the suite down.
tc015_up=0
tc015_waited=0
while [ "$tc015_waited" -lt 100 ]; do
  if grep -q "http://localhost:$tc015_port" "$tc015_log" 2>/dev/null; then
    tc015_up=1
    break
  fi
  kill -0 "$tc015_pid" 2>/dev/null || break
  sleep 0.1
  tc015_waited=$((tc015_waited + 1))
done

if [ "$tc015_up" -eq 1 ]; then
  pf_pass "TC-004 step 1: server started"
else
  pf_fail "TC-004 step 1: server did not start"
fi

tc015_body=""
if [ "$tc015_up" -eq 1 ]; then
  tc015_body="$(curl -sS --max-time 10 "http://127.0.0.1:$tc015_port/api/projects" 2>&1)"
fi

kill "$tc015_pid" 2>/dev/null
wait "$tc015_pid" 2>/dev/null

# Printed unconditionally, even when step 1 failed and $tc015_body is empty:
# an Auto-TC label that is silently skipped leaves TC-004 step 2 unmapped in
# /pf-test.
if [ "$tc015_up" -eq 1 ] &&
  printf '%s' "$tc015_body" | grep -qF -- "\"name\":\"$TC015_PROJECT\"" &&
  printf '%s' "$tc015_body" | grep -qF -- '"issueCount":1'; then
  pf_pass "TC-004 step 2: server listed the fixture project"
else
  pf_fail "TC-004 step 2: server did not list the fixture project"
  printf 'log:\n%s\nbody:\n%s\n' "$(cat "$tc015_log" 2>/dev/null)" "$tc015_body" >&2
fi

# ─── TC-005: projects.json stays valid JSON for a path that needs escaping ────
# (20260812-bug-flaky-manual-test-ui). On Windows the TC-015 fixture above
# already IS the JSON-breaking case — after cygpath -w its path is native and
# therefore full of backslashes — so no separate fixture is built: this branch
# reuses $tc015_config and $expected_path as recorded before that file was
# written. On POSIX (no cygpath, so backslashes never occur) a fresh fixture is
# built here, with a double quote embedded in a path component, the character
# that actually breaks a naive JSON serializer on this platform.
#
# tc005_expected_path is captured BEFORE the write, from the same value that
# feeds the write. tc005_written_path (step 2/3 below) is read back FROM THE
# FILE by a separate `node -e`. The two must never collapse into the same
# variable — comparing a value to itself would stay green under any corruption
# of the serializer, which is the exact defect this case exists to catch.

if command -v cygpath >/dev/null 2>&1; then
  tc005_config="$tc015_config"
  tc005_expected_path="$expected_path"
  tc005_project_name="$TC015_PROJECT"
  tc005_workdir="$tc015_root"
  tc005_setup_ok=1
  [ -f "$tc005_config" ] || tc005_setup_ok=0
else
  TC005_ISSUE="20260101-improve-manual-test-ui-fixture"
  TC005_PROJECT='pf-fixture-quote-project'

  tc005_setup_ok=1
  tc005_root="$(pf_mktemp_d)" || exit 1
  tc005_workdir="$tc005_root"
  tc005_repo="$tc005_root/pf-fixture-\"-project"
  mkdir "$tc005_repo" || tc005_setup_ok=0

  tc005_issue_dir="$tc005_repo/docs/issues/open/$TC005_ISSUE"
  mkdir -p "$tc005_issue_dir" || tc005_setup_ok=0
  printf '# Issue\n\n**Type:** improve\n**Size Tier:** small\n' >"$tc005_issue_dir/prompt.md" || tc005_setup_ok=0
  printf '# Manual Test Checklist\n\n**Feature Name:** fixture\n' >"$tc005_issue_dir/manual_test_checklist.md" || tc005_setup_ok=0

  git -C "$tc005_repo" init -q || tc005_setup_ok=0
  git -C "$tc005_repo" symbolic-ref HEAD refs/heads/develop || tc005_setup_ok=0
  pf_git_init "$tc005_repo"

  tc005_config="$tc005_root/projects.json"
  tc005_expected_path="$tc005_repo"
  tc005_project_name="$TC005_PROJECT"

  # Same serializer TC-015/TC-004 use above: values through process.argv, the
  # path never interpolated into the -e script text.
  node -e '
    const fs = require("node:fs");
    const [, name, path, cfgPath] = process.argv;
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({ projects: [{ name, path, defaultBranch: "develop" }] })
    );
  ' "$TC005_PROJECT" "$tc005_repo" "$tc005_config" || tc005_setup_ok=0

  [ -f "$tc005_config" ] || tc005_setup_ok=0
fi

if [ "$tc005_setup_ok" -eq 1 ]; then
  pf_pass "TC-005 step 1: fixture with a JSON-breaking path was created"
else
  pf_fail "TC-005 step 1: fixture setup failed before projects.json could be written"
fi

tc005_parse_err="$tc005_workdir/tc005-parse-err.log"
if tc005_written_path="$(node -e '
  const fs = require("node:fs");
  const [, cfgPath] = process.argv;
  const data = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  process.stdout.write(data.projects[0].path);
' "$tc005_config" 2>"$tc005_parse_err")"; then
  pf_pass "TC-005 step 2: projects.json is valid JSON for a path requiring escaping"
else
  pf_fail "TC-005 step 2: projects.json failed to parse for a path requiring escaping"
  cat "$tc005_parse_err" >&2 2>/dev/null
fi

# written_path came from the file (above); expected_path was fixed before the
# write (in the branch above). Comparing THESE two — not written_path against
# itself — is the point of this step.
if [ "${tc005_written_path-}" = "$tc005_expected_path" ]; then
  pf_pass "TC-005 step 3: parsed path is byte-identical to the expected path"
else
  pf_fail "TC-005 step 3: parsed path differs from the expected path"
  pf_note "TC-005: expected_path = $tc005_expected_path"
  pf_note "TC-005: written_path  = ${tc005_written_path-}"
fi

tc005_port="$(free_port)"
tc005_log="$tc005_workdir/tc005-server.log"

PLANNING_TEST_UI_CONFIG="$tc005_config" \
  PLANNING_TEST_UI_MEMORY_ROOT="$tc005_workdir/memory" \
  node "$UI_DIR/server.js" --port "$tc005_port" >"$tc005_log" 2>&1 &
tc005_pid=$!

tc005_up=0
tc005_waited=0
while [ "$tc005_waited" -lt 100 ]; do
  if grep -q "http://localhost:$tc005_port" "$tc005_log" 2>/dev/null; then
    tc005_up=1
    break
  fi
  kill -0 "$tc005_pid" 2>/dev/null || break
  sleep 0.1
  tc005_waited=$((tc005_waited + 1))
done

tc005_body=""
if [ "$tc005_up" -eq 1 ]; then
  tc005_body="$(curl -sS --max-time 10 "http://127.0.0.1:$tc005_port/api/projects" 2>&1)"
fi

# Always terminated here, whether or not it ever came up: a fixture process
# left running is exactly what S-4/S-5 forbid.
kill "$tc005_pid" 2>/dev/null
wait "$tc005_pid" 2>/dev/null

if [ "$tc005_up" -eq 1 ] &&
  printf '%s' "$tc005_body" | grep -qF -- "\"name\":\"$tc005_project_name\""; then
  pf_pass "TC-005 step 4: server lists the project from the escaped path"
else
  pf_fail "TC-005 step 4: server did not list the project from the escaped path"
  printf 'log:\n%s\nbody:\n%s\n' "$(cat "$tc005_log" 2>/dev/null)" "$tc005_body" >&2
fi

assert_repo_untouched

pf_summary
