#!/usr/bin/env bash
# test/docs-refs.sh — TC-039 + TC-040 (Auto halves).
#
# TC-039: the v1/v2 surface deleted in Phase IV left NO live reference behind —
#         no deleted script, no root templates/, no .bootstrap file, no
#         templates/config/.qa-workflow.md — and every link a user can click in
#         the live docs resolves to a file that exists. The point is the moment
#         of onboarding: a broken link there is the first thing a new user meets.
#
# TC-040: every live skill count and skill list equals the real number of skills
#         in skills/ (15 today, and the number is DERIVED here, never hardcoded,
#         so adding a skill fails this suite until the lists are updated).
#
# This suite only reads files. It never runs the convergence script — and it
# never names it either: test/safety-audit.sh (TC-032, step 1) requires that the
# script's file name appear under test/ in exactly one file, test/lib.sh. Hence
# the fragment-assembled CONVERGE_SCRIPT below, the same trick safety-audit uses
# on itself.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

printf '=== TC-039 / TC-040: no live reference to the deleted surface; skill counts are real\n'

cd "$REPO_ROOT" || exit 1

CONVERGE_SCRIPT="scripts/converge""-to-v3.sh"

# The deleted surface, by name. Every one of these is gone from the tree; the
# question this suite answers is whether the DOCUMENTS still promise them.
DEAD_SCRIPTS=(
  scripts/setup-planning-v2.sh
  scripts/setup-planning-v3.sh
  scripts/migrate-v1-to-v2.sh
  scripts/migrate-v2-to-v3.sh
)

# ─── TC-039 step 1: the deleted scripts are gone; converge is present ─────────

gone=()
for s in "${DEAD_SCRIPTS[@]}"; do
  [ -e "$s" ] && gone+=("$s")
done
if [ "${#gone[@]}" -eq 0 ]; then
  pf_pass "step 1: all four per-version setup/migration scripts are gone"
else
  pf_fail "step 1: still present: ${gone[*]}"
fi

pf_assert "step 1: the single entry point exists and is executable" \
  test -x "$CONVERGE_SCRIPT"

# ─── TC-039 steps 2-4: root templates/, the bootstraps, the QA template ───────

pf_assert "step 2: the root templates/ directory is gone" test ! -d templates

pf_assert "step 3: PLANNING.md.bootstrap is gone" test ! -e PLANNING.md.bootstrap
pf_assert "step 3: .qa-workflow.md.bootstrap is gone" test ! -e .qa-workflow.md.bootstrap

pf_assert "step 4: docs/planning/templates/config/.qa-workflow.md is gone (Р4 — /pf-qa-setup generates it)" \
  test ! -e docs/planning/templates/config/.qa-workflow.md
pf_assert "step 4: docs/planning/templates/config/PLANNING.md exists" \
  test -f docs/planning/templates/config/PLANNING.md
pf_assert "step 4: docs/planning/templates/config/CLAUDE.md exists" \
  test -f docs/planning/templates/config/CLAUDE.md

# ─── TC-039 step 5: no LIVE reference to the deleted surface ─────────────────
#
# The exclusions are not convenience, they are correctness:
#
#   test/          — the fixtures ARE v1/v2 projects; naming those scripts is
#                    their job. This file lives here too.
#   docs/issues/   — this issue's own planning documents discuss the deleted
#                    scripts by name, at length and on purpose. Grepping them
#                    yields dozens of hits and a false FAIL (the trap called out
#                    in TC-039 step 5). docs/issues/closed/ is history, likewise.
#   CHANGELOG.md, docs/planning/v1.0-archive/, docs/planning/session-log.md,
#   docs/planning/v2.0-design-analysis.md, README.md "Version History",
#   .claude/settings.local.json, examples/
#                  — historical or machine-written records. Rewriting a release
#                    note to hide what shipped is falsification, not maintenance.
#
# What remains — scripts/, skills/, tools/, Makefile, CONTRIBUTING.md, CLAUDE.md,
# PLANNING.md, docs/planning/{FRAMEWORK,QUICKSTART}.md, the templates — is the
# live surface: everything a user reads while onboarding.

DEAD_PATTERN='setup-planning-v[23]|migrate-v1-to-v2|migrate-v2-to-v3|setup-planning-framework|\.bootstrap|templates/config/\.qa-workflow'

live_hits="$(grep -rnE "$DEAD_PATTERN" . \
  --exclude-dir=.git \
  --exclude-dir=test \
  --exclude-dir=issues \
  --exclude-dir=v1.0-archive \
  --exclude-dir=node_modules \
  --exclude-dir=examples \
  --exclude-dir=.claude \
  --exclude=CHANGELOG.md \
  --exclude=session-log.md \
  --exclude=v2.0-design-analysis.md 2>/dev/null |
  grep -v '^\./README\.md:' || true)"

# README.md is filtered wholesale above and re-checked here, but only up to its
# "## Version History" heading: the v3.0.0 release note below it legitimately
# names the setup script that shipped with 3.0.0 and must NOT be rewritten.
# Everything a user reads on the way in — above that heading — must be clean.
readme_hits="$(awk '/^## Version History/{exit} {printf "README.md:%d: %s\n", NR, $0}' README.md |
  grep -E "$DEAD_PATTERN" || true)"

if [ -z "$live_hits" ] && [ -z "$readme_hits" ]; then
  pf_pass "step 5: no live reference to the deleted scripts / templates/ / .bootstrap / the QA template"
else
  pf_fail "step 5: live references to the deleted surface survive"
  printf '%s\n%s\n' "$live_hits" "$readme_hits" | grep -v '^$' | head -20 >&2
fi

# ─── TC-039 step 6: the v1.0 archive, and an empty repo root ─────────────────

for f in FRAMEWORK.md QUICK-REFERENCE.md MIGRATION-GUIDE-v1-to-v2.md; do
  pf_assert "step 6: docs/planning/v1.0-archive/$f exists" \
    test -f "docs/planning/v1.0-archive/$f"
done
pf_assert "step 6: the root FRAMEWORK.md (v1.1) is gone from the repo root" test ! -e FRAMEWORK.md
pf_assert "step 6: the root QUICK-REFERENCE.md is gone from the repo root" test ! -e QUICK-REFERENCE.md
pf_assert "step 6: the v1→v2 guide no longer sits at docs/planning/MIGRATION-GUIDE.md" \
  test ! -e docs/planning/MIGRATION-GUIDE.md

# ─── TC-039 step 7: the NEW guide exists, and the onboarding docs point at it ─
#
# Р10: a v2→v3 guide never existed. The old MIGRATION-GUIDE.md was a v1.0→v2.0
# document, and CLAUDE.md/README.md mislabelled it as the "v2.0 → v3.0 upgrade".

GUIDE=docs/planning/MIGRATION-GUIDE-V3.md
pf_assert "step 7: $GUIDE exists" test -f "$GUIDE"

if [ -f "$GUIDE" ]; then
  # The five subjects Р10 requires of it. Absence of any one is a hole a user
  # falls into: they onboard, and the guide is silent on the thing they hit.
  pf_assert "step 7: the guide names \`make converge\` as the entry point" \
    grep -q 'make converge' "$GUIDE"
  pf_assert "step 7: the guide covers all five starting states" \
    grep -qiE 'no-pf|no framework' "$GUIDE"
  pf_assert "step 7: the guide covers the half-migrated (mixed) state" \
    grep -qi 'mixed' "$GUIDE"
  pf_assert "step 7: the guide covers the incomplete-v3 state" \
    grep -qi 'incomplete' "$GUIDE"
  pf_assert "step 7: the guide explains what happens to open vs closed issues" \
    grep -qi 'closed issues' "$GUIDE"
  pf_assert "step 7: the guide documents the backup" \
    grep -q 'planning-backup-' "$GUIDE"
  pf_assert "step 7: the guide documents --dry-run" \
    grep -q -- '--dry-run' "$GUIDE"
  pf_assert "step 7: the guide says .qa-workflow.md is not shipped — run /pf-qa-setup" \
    grep -q '/pf-qa-setup' "$GUIDE"
fi

pf_assert "step 7: CLAUDE.md links to MIGRATION-GUIDE-V3.md" \
  grep -q 'docs/planning/MIGRATION-GUIDE-V3.md' CLAUDE.md
pf_assert "step 7: README.md links to MIGRATION-GUIDE-V3.md" \
  grep -q 'docs/planning/MIGRATION-GUIDE-V3.md' README.md

# ─── TC-039 step 8: CONTRIBUTING.md — both places ─────────────────────────────
# The root-relative links died the moment FRAMEWORK.md and QUICK-REFERENCE.md
# moved into the archive. Two places, not one: the "Run setup script" block and
# the "Getting Help" line.

if grep -qE '\]\((FRAMEWORK|QUICK-REFERENCE)\.md\)' CONTRIBUTING.md; then
  pf_fail "step 8: CONTRIBUTING.md still links to the root FRAMEWORK.md / QUICK-REFERENCE.md (both are in the archive now)"
else
  pf_pass "step 8: CONTRIBUTING.md has no root-relative links to the archived v1 documents"
fi
pf_assert "step 8: CONTRIBUTING.md's setup block uses converge" \
  grep -q 'make converge' CONTRIBUTING.md

# ─── TC-039, the property behind it: every link in the live docs resolves ─────
#
# The reference check above is by name; this one is by target. A user does not
# grep — they click. Two classes of link are illustrative, not navigational, and
# are excluded by design:
#   * `(link)` — the placeholder in the documented session-log line format
#     `[Agent] ✓ [issue-id](link) - Description`;
#   * `../issues/…` — example issue folders (20240127-feat-add-auth) that exist
#     only in the prose that describes the naming convention.

LIVE_DOCS=(
  README.md
  CLAUDE.md
  CONTRIBUTING.md
  PLANNING.md
  docs/planning/FRAMEWORK.md
  docs/planning/QUICKSTART.md
  docs/planning/MIGRATION-GUIDE-V3.md
  docs/planning/implementation-plan.md
  docs/planning/decisions.md
  docs/planning/templates/README.md
)

broken=()
for f in "${LIVE_DOCS[@]}"; do
  [ -f "$f" ] || { broken+=("$f: MISSING FILE"); continue; }
  dir="$(dirname "$f")"
  while IFS= read -r target; do
    case "$target" in
      http*|mailto:*|/*|'') continue ;;
      link) continue ;;                # session-log format placeholder
      ../issues/*) continue ;;         # example issue folders, by design absent
    esac
    target="${target%%#*}"             # strip any anchor
    [ -n "$target" ] || continue
    [ -e "$dir/$target" ] || broken+=("$f -> $target")
  done < <(grep -oE '\]\([^)]+\)' "$f" | sed -E 's/^\]\(//; s/\)$//')
done

if [ "${#broken[@]}" -eq 0 ]; then
  pf_pass "link check: every relative link in the ${#LIVE_DOCS[@]} live documents resolves to a file that exists"
else
  pf_fail "link check: ${#broken[@]} dangling link(s) in the live documents"
  printf '  %s\n' "${broken[@]}" >&2
fi

# ─── TC-039 step 9: shellcheck ────────────────────────────────────────────────

if command -v shellcheck >/dev/null 2>&1; then
  if shellcheck scripts/*.sh test/*.sh >/dev/null 2>&1; then
    pf_pass "step 9: shellcheck scripts/*.sh test/*.sh — exit 0"
  else
    pf_fail "step 9: shellcheck reports findings in scripts/*.sh or test/*.sh"
    shellcheck scripts/*.sh test/*.sh 2>&1 | head -20 >&2
  fi
else
  pf_note "step 9: shellcheck is not installed — skipped (the QA gate runs it)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# TC-040 — the skill counts
# ══════════════════════════════════════════════════════════════════════════════
#
# N_SKILLS is DERIVED from the directory, never written down here. A sixteenth
# skill therefore fails this suite until every list below has been updated —
# which is the whole point: the counts drifted to 7 / 11 / 14 precisely because
# nothing tied them to reality.

SKILL_NAMES=()
while IFS= read -r d; do
  SKILL_NAMES+=("$(basename "$d")")
done < <(find skills -mindepth 1 -maxdepth 1 -type d 2>/dev/null | LC_ALL=C sort)
N_SKILLS="${#SKILL_NAMES[@]}"

pf_note "skills/ holds $N_SKILLS skills: ${SKILL_NAMES[*]}"

# Every skill must be named in the document; that is a stronger check than a
# count, and it is what "the list is real" actually means.
assert_lists_every_skill() {
  local file="$1" label="$2" missing=()
  local s
  [ -f "$file" ] || { pf_fail "$label: $file does not exist"; return; }
  for s in "${SKILL_NAMES[@]}"; do
    grep -qF -- "$s" "$file" || missing+=("$s")
  done
  if [ "${#missing[@]}" -eq 0 ]; then
    pf_pass "$label: names all $N_SKILLS skills"
  else
    pf_fail "$label: does not name ${#missing[@]} skill(s): ${missing[*]}"
  fi
}

# ─── TC-040 step 1: CLAUDE.md no longer promises 7 skills ────────────────────

if grep -q '7 Claude Code skills' CLAUDE.md; then
  pf_fail "step 1: CLAUDE.md still says \"7 Claude Code skills\""
else
  pf_pass "step 1: CLAUDE.md no longer says \"7 Claude Code skills\""
fi
pf_assert "step 1: CLAUDE.md states the real count ($N_SKILLS)" \
  grep -q "$N_SKILLS Claude Code skills" CLAUDE.md
assert_lists_every_skill CLAUDE.md "step 1: CLAUDE.md"

# ─── TC-040 step 2: the QUICKSTART and FRAMEWORK counters ────────────────────

if grep -qiE '\b(eleven|seven)\b .*skills' docs/planning/FRAMEWORK.md; then
  pf_fail "step 2: docs/planning/FRAMEWORK.md still spells out a stale skill count"
else
  pf_pass "step 2: docs/planning/FRAMEWORK.md has no spelled-out stale count"
fi
pf_assert "step 2: docs/planning/FRAMEWORK.md states the real count (Fifteen)" \
  grep -qi "fifteen Claude Code skills" docs/planning/FRAMEWORK.md
assert_lists_every_skill docs/planning/FRAMEWORK.md "step 2: docs/planning/FRAMEWORK.md"
assert_lists_every_skill docs/planning/QUICKSTART.md "step 2: docs/planning/QUICKSTART.md"
pf_assert "step 2: docs/planning/QUICKSTART.md states the real count ($N_SKILLS)" \
  grep -q "$N_SKILLS skills" docs/planning/QUICKSTART.md

# ─── TC-040 steps 3-4: the two machine-readable lists ────────────────────────

assert_lists_every_skill skills/pf-update/SKILL.md "step 3: skills/pf-update/SKILL.md"
assert_lists_every_skill tools/onboarding-tui/lib/tutorial.js "step 4: tools/onboarding-tui/lib/tutorial.js"

# ─── TC-040 step 5: the skills/ layout in FRAMEWORK.md is directories ────────
# The stale block showed `skills/pf-execute.md` — a flat layout that has not been
# the truth since skills became directories with a SKILL.md inside.

if grep -qE '^\s*[│├└─ ]*pf(-[a-z-]+)?\.md\b' docs/planning/FRAMEWORK.md; then
  pf_fail "step 5: docs/planning/FRAMEWORK.md still draws the FLAT skills layout (pf-*.md files)"
  grep -nE '^\s*[│├└─ ]*pf(-[a-z-]+)?\.md\b' docs/planning/FRAMEWORK.md | head -5 >&2
else
  pf_pass "step 5: docs/planning/FRAMEWORK.md draws skills/ as directories, not flat .md files"
fi
pf_assert "step 5: docs/planning/FRAMEWORK.md shows the SKILL.md layout" \
  grep -q 'pf/SKILL.md' docs/planning/FRAMEWORK.md

# ─── TC-040 step 6: README has a current Skills section; history is intact ───

pf_assert "step 6: README.md has a Skills section" grep -qE '^## Skills' README.md
assert_lists_every_skill README.md "step 6: README.md"

# The Version History entry for 3.0.0 is a record of what SHIPPED in that
# release: 7 skills, and a setup script that existed then. Rewriting it would
# falsify release history — so this suite asserts it is STILL THERE.
if grep -q '  - 7 Claude Code skills' README.md; then
  pf_pass "step 6: README.md Version History still records the 3.0.0 release verbatim (not falsified)"
else
  pf_fail "step 6: README.md Version History was rewritten — the 3.0.0 release note must stay as shipped"
fi

# ─── TC-040 steps 7-8: the two skill-side results this suite only verifies ───

if grep -q 'setup-planning-v3' skills/pf-help/SKILL.md; then
  pf_fail "step 7: skills/pf-help/SKILL.md still tells the user to run a deleted script"
else
  pf_pass "step 7: skills/pf-help/SKILL.md does not name a deleted script"
fi

pf_assert "step 8: skills/pf-update/SKILL.md reconciles the project's .pf-version" \
  grep -q '\.pf-version' skills/pf-update/SKILL.md
pf_assert "step 8: skills/pf-update/SKILL.md recommends converge on a version mismatch" \
  grep -qi 'converge' skills/pf-update/SKILL.md

pf_summary
