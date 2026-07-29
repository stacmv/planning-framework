#!/usr/bin/env bash
# test/manual-test-ui.sh — the Manual Test UI suite: TC-001, TC-015, TC-016.
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
ui_out="$(cd "$REPO_ROOT" && node --test "$UI_GLOB" 2>&1)" || ui_rc=$?

if [ "$ui_rc" -eq 0 ] &&
  printf '%s\n' "$ui_out" | grep -qF -- 'checklist-ru.test.js' &&
  printf '%s\n' "$ui_out" | grep -qE '^# fail 0$'; then
  pf_pass "step 4: the manual-test-ui node suites run and exit 0"
else
  pf_fail "step 4: the manual-test-ui node suites did not run clean (exit $ui_rc)"
  printf '%s\n' "$ui_out" | tail -20 >&2
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
printf '{"projects":[{"name":"%s","path":"%s","defaultBranch":"develop"}]}\n' \
  "$TC015_PROJECT" "$tc015_repo" >"$tc015_config"

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

tc015_body=""
if [ "$tc015_up" -eq 1 ]; then
  tc015_body="$(curl -sS --max-time 10 "http://127.0.0.1:$tc015_port/api/projects" 2>&1)"
fi

kill "$tc015_pid" 2>/dev/null
wait "$tc015_pid" 2>/dev/null

if [ "$tc015_up" -eq 1 ] &&
  printf '%s' "$tc015_body" | grep -qF -- "\"name\":\"$TC015_PROJECT\"" &&
  printf '%s' "$tc015_body" | grep -qF -- '"issueCount":1'; then
  pf_pass "step 4: the server starts with zero installs and lists the configured projects"
else
  pf_fail "step 4: the server did not start or did not list the configured project"
  printf 'log:\n%s\nbody:\n%s\n' "$(cat "$tc015_log" 2>/dev/null)" "$tc015_body" >&2
fi

assert_repo_untouched

pf_summary
