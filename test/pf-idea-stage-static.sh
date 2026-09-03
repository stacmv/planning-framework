#!/usr/bin/env bash
# shellcheck disable=SC2016  # backticks are literal markdown code-spans in grep patterns, not command substitution
# @pf-issue [20260902-feat-idea-stage]
# test/pf-idea-stage-static.sh — static, grep-based structural checks for the
# idea/spike pipeline (specs-part3.md §8.1; implementation_plan.md Task 17).
#
# Same style as test/skills-static.sh / test/skills-role-matrix-static.sh:
# read-only, no ~/.claude/skills involved, no real /pf run. Asserts the SHAPE
# of the seven new skills and the edits to shared skills, per test_plan.md's
# TC-001/002/004/005/006/007/008/009/010/011/013/015/016/017/018/019/021/
# 022/023/024/025/026/027.
#
# §8.1a's fixture-based/behavioral TCs, and the templates-mirror diff (§8.3),
# are a separate concern — see specs-part3.md §8's preamble and
# implementation_plan.md Task 18. This file is left extensible for that task
# to append to (new fixtures under test/fixtures/, new TC sections below).
#
# Read-only. It runs no script, touches no $HOME, and mutates nothing.

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

SKILLS="$REPO_ROOT/skills"
PF="$SKILLS/pf/SKILL.md"
CHECK="$SKILLS/pf-check/SKILL.md"
CLOSE="$SKILLS/pf-close/SKILL.md"
GIT="$SKILLS/pf-git/SKILL.md"
AUTOPILOT="$SKILLS/pf-autopilot/SKILL.md"
HELP="$SKILLS/pf-help/SKILL.md"
BRD="$SKILLS/pf-brd/SKILL.md"
UPDATE="$SKILLS/pf-update/SKILL.md"
TIERS="$SKILLS/pf-size-tiers/SKILL.md"
ROLES="$SKILLS/pf-roles/SKILL.md"
LENSES="$SKILLS/pf-idea-lenses/SKILL.md"
INTERACTION="$SKILLS/pf-interaction/SKILL.md"
IDEA="$SKILLS/pf-idea/SKILL.md"
RESEARCH="$SKILLS/pf-idea-research/SKILL.md"
CRITIQUE="$SKILLS/pf-idea-critique/SKILL.md"
VERDICT="$SKILLS/pf-idea-verdict/SKILL.md"
SPIKE="$SKILLS/pf-idea-spike/SKILL.md"
CONVERGE="$REPO_ROOT/scripts/converge-to-v3.sh"

# range_between <file> <start-literal> <end-literal>
#
# Prints the lines from (and including) the first line containing <start-literal>
# up to (but excluding) the next line containing <end-literal>. Both patterns are
# matched as literal substrings (awk index()), not regexes, so headings with
# markdown/regex metacharacters (backticks, parens, colons) need no escaping.
# Prints nothing if <start-literal> is never found.
# An empty <end-literal> means "to end of file" (awk's index($0,"") would
# otherwise match every line, including the one right after <start-literal>).
range_between() {
  local file="$1" s="$2" e="$3"
  awk -v s="$s" -v e="$e" '
    index($0,s) && !flag { flag=1; print; next }
    flag && e != "" && index($0,e) { exit }
    flag { print }
  ' "$file"
}

# nth_fenced_block <file> <n> — prints the body (no fence lines) of the Nth
# ```markdown ... ``` block in the file, 1-based. Used where a skeleton's own
# title line (e.g. "# Hypothesis: <slug>") is also mentioned inline in prose
# earlier in the file, so range_between's literal-substring anchor would grab
# the wrong start point.
nth_fenced_block() {
  local file="$1" n="$2"
  awk -v want="$n" '
    /^```markdown/ { c++; if (c==want) { infence=1; next } }
    infence && /^```/ { exit }
    infence { print }
  ' "$file"
}

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-001: seven new skill directories — valid frontmatter (specs-part3.md §8.1 п.1)\n'
# ══════════════════════════════════════════════════════════════════════════════
# Own cycle, not a reuse of test/skills-static.sh (finding #26 — that file has
# no general frontmatter validator over skills/*/).

for d in "$SKILLS/pf-idea" "$SKILLS/pf-idea-research" \
  "$SKILLS/pf-idea-critique" "$SKILLS/pf-idea-verdict" \
  "$SKILLS/pf-idea-spike" "$SKILLS/pf-idea-lenses" \
  "$SKILLS/pf-interaction"; do
  f="$d/SKILL.md"
  if [ ! -f "$f" ]; then
    pf_fail "TC-001: missing $f"
    continue
  fi
  if grep -q '^name:' "$f" && grep -q '^description:' "$f" && grep -q '^version:' "$f"; then
    pf_pass "TC-001: $(basename "$d")/SKILL.md has name/description/version"
  else
    pf_fail "TC-001: $(basename "$d")/SKILL.md missing required frontmatter field"
  fi
done

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-002: /pf Step 0 — idea/project fork, has_git guard\n'
# ══════════════════════════════════════════════════════════════════════════════

STEP0="$(range_between "$PF" '## Step 0: Detect folder state' '## Step 1: Read installed version')"

if [ -n "$STEP0" ]; then
  pf_pass "TC-002 step 1: Step 0 exists, before Step 1"
else
  pf_fail "TC-002 step 1: Step 0 not found before Step 1"
fi

if printf '%s' "$STEP0" | grep -q 'An idea' && printf '%s' "$STEP0" | grep -q 'project, right away'; then
  pf_pass "TC-002 step 2: both fork branches named (An idea / A project, right away)"
else
  pf_fail "TC-002 step 2: fork branches not both found in Step 0"
fi

if printf '%s' "$STEP0" | grep -q 'has_git'; then
  pf_pass "TC-002 step 3: has_git mentioned in Step 0"
else
  pf_fail "TC-002 step 3: has_git not mentioned in Step 0"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-004: not-a-repo guard, "not committed" text, seven pf-git Step 1 rows\n'
# ══════════════════════════════════════════════════════════════════════════════

STEP2_PF="$(range_between "$PF" '## Step 2: Scan for open issues' '## Step 3: Handle zero or multiple issues')"
if printf '%s' "$STEP2_PF" | grep -q 'Not-a-repo guard'; then
  pf_pass "TC-004 step 1: /pf's Step 2 carries a not-a-repo guard"
else
  pf_fail "TC-004 step 1: /pf's Step 2 has no not-a-repo guard"
fi

GIT_STEP0="$(range_between "$GIT" '## Step 0: No-repository guard' '## Step 1: Stage the artifact')"
if [ -n "$GIT_STEP0" ] && printf '%s' "$GIT_STEP0" | grep -qF 'not committed — no git repository'; then
  pf_pass "TC-004 step 2: pf-git's Step 0 (No-repository guard) carries the literal text"
else
  pf_fail "TC-004 step 2: pf-git's Step 0 missing, or missing the literal text"
fi

TERMINAL_GIT_LINE="$(range_between "$PF" '### Terminal git-status line' '')"
if printf '%s' "$TERMINAL_GIT_LINE" | grep -qF 'not committed — no git repository'; then
  pf_pass "TC-004 step 3: /pf's Terminal git-status line (both branches) prints the same literal line inline"
else
  pf_fail "TC-004 step 3: /pf's Terminal git-status line does not print the literal line"
fi

GIT_STEP1="$(range_between "$GIT" '## Step 1: Stage the artifact' '## Step 2: Commit')"
n_idea_rows="$(printf '%s\n' "$GIT_STEP1" | grep -c -- '`/pf-idea' || true)"
if [ "${n_idea_rows:-0}" -eq 7 ]; then
  pf_pass "TC-004 step 4: pf-git's Step 1 table carries exactly seven idea/spike rows"
else
  pf_fail "TC-004 step 4: pf-git's Step 1 table carries ${n_idea_rows:-0} idea/spike rows, want 7"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-005: existing project, no open issues — four-option question + spike confirm\n'
# ══════════════════════════════════════════════════════════════════════════════

STEP3="$(range_between "$PF" '## Step 3: Handle zero or multiple issues' '## Step 4: Single active issue')"
missing=()
for opt in 'Build a feature' 'Fix a bug' 'Describe an idea' 'Run a technical spike'; do
  printf '%s' "$STEP3" | grep -qF "$opt" || missing+=("$opt")
done
if [ ${#missing[@]} -eq 0 ]; then
  pf_pass "TC-005 step 1: all four options present in Step 3"
else
  pf_fail "TC-005 step 1: missing options: ${missing[*]}"
fi

if printf '%s' "$STEP3" | grep -qi 'technical spike' && printf '%s' "$STEP3" | grep -qi 'instead of a feature'; then
  pf_pass "TC-005 step 2: spike-confirmation question present"
else
  pf_fail "TC-005 step 2: spike-confirmation question not found"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-006: Step 5 six rows, Step 6 idea/spike paragraph, Step 7 literal, pf-help\n'
# ══════════════════════════════════════════════════════════════════════════════

STEP5="$(range_between "$PF" '## Step 5: Detect completed stages' '## Step 6: Determine next step')"
STEP5_TABLE_ROWS="$(printf '%s\n' "$STEP5" | grep -E '^\| `[a-z_]+\.md`')"
missing=()
for row in 'idea.md' 'research.md' 'critique.md' 'verdict.md' 'hypothesis.md' 'findings.md'; do
  printf '%s' "$STEP5_TABLE_ROWS" | grep -qF "$row" || missing+=("$row")
done
if [ ${#missing[@]} -eq 0 ] && ! printf '%s' "$STEP5_TABLE_ROWS" | grep -qF 'open_questions.md'; then
  pf_pass "TC-006 step 1: Step 5's table carries all six idea/spike rows, no open_questions.md row"
else
  pf_fail "TC-006 step 1: missing rows (${missing[*]:-none}) or open_questions.md wrongly present as a table row"
fi

IDEA_PARA="$(range_between "$PF" 'idea/spike pipeline' '### trivial-tier workflow')"
if printf '%s' "$IDEA_PARA" | grep -qF 'pf-idea-lenses'; then
  pf_pass "TC-006 step 2: Step 6's idea/spike paragraph references pf-idea-lenses, precedes trivial-tier table"
else
  pf_fail "TC-006 step 2: idea/spike paragraph missing or does not reference pf-idea-lenses"
fi

if printf '%s' "$IDEA_PARA" | grep -qF "opening \`verdict.md\`" || printf '%s' "$IDEA_PARA" | grep -qi 'read a document'"'"'s body'; then
  pf_pass "TC-006 step 3: idea/spike paragraph notes VERDICT vs. VERDICT+Decision needs reading the body"
else
  pf_fail "TC-006 step 3: no mention of needing to read verdict.md's body"
fi

STEP7="$(range_between "$PF" '## Step 7: Output' '## Creating prompt.md')"
if printf '%s' "$STEP7" | grep -qF '/pf-idea-verdict (decision session)'; then
  pf_pass "TC-006 step 4: literal /pf-idea-verdict (decision session) present in Step 7"
else
  pf_fail "TC-006 step 4: literal /pf-idea-verdict (decision session) missing from Step 7"
fi

HELP_WORKFLOW="$(range_between "$HELP" '## Workflow by issue type' '## Skills')"
if printf '%s' "$HELP_WORKFLOW" | grep -qi '\*\*Idea\*\*' && printf '%s' "$HELP_WORKFLOW" | grep -qi '\*\*Spike\*\*'; then
  pf_pass "TC-006 step 5: pf-help carries Idea/Spike workflow blocks"
else
  pf_fail "TC-006 step 5: pf-help missing Idea/Spike workflow blocks"
fi

HELP_FOLDER="$(range_between "$HELP" '## Issue folder contents' '## Installing in a new project')"
if printf '%s' "$HELP_FOLDER" | grep -qE '^\| idea ' && printf '%s' "$HELP_FOLDER" | grep -qE '^\| spike '; then
  pf_pass "TC-006 step 6: pf-help's Issue folder contents table carries idea/spike rows"
else
  pf_fail "TC-006 step 6: pf-help's Issue folder contents table missing idea/spike rows"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-007: intake batch — doc_language reuse, bare-folder carve-out\n'
# ══════════════════════════════════════════════════════════════════════════════

IDEA_BR="$(range_between "$PF" '### Idea branch' '### Spike branch')"
SPIKE_BR="$(range_between "$PF" '### Spike branch' "### \`type:\` vs. folder name")"

if printf '%s' "$IDEA_BR" | grep -qF 'Reuse the `doc_language` question'; then
  pf_pass "TC-007 step 1: Idea branch reuses doc_language"
else
  pf_fail "TC-007 step 1: Idea branch does not mention reusing doc_language"
fi

if printf '%s' "$IDEA_BR" | grep -qF 'skip role assignment and the `on_unavailable` question entirely'; then
  pf_pass "TC-007 step 2: Idea branch's bare-folder carve-out skips role assignment/on_unavailable"
else
  pf_fail "TC-007 step 2: Idea branch's bare-folder carve-out not found"
fi

if printf '%s' "$SPIKE_BR" | grep -qF 'Reuse the `doc_language` question'; then
  pf_pass "TC-007 step 3a: Spike branch reuses doc_language"
else
  pf_fail "TC-007 step 3a: Spike branch does not mention reusing doc_language"
fi

# Spike has NO bare-folder carve-out (a bare-folder spike cannot exist) — the
# branch instead carries an explicit paragraph saying role assignment/
# on_unavailable are ALWAYS asked. Both are "carve-out" text per specs-part3.md
# §8.1 п.7 — assert presence of the carve-out discussion, not a specific verdict.
if printf '%s' "$SPIKE_BR" | grep -qi 'carve-out' && printf '%s' "$SPIKE_BR" | grep -qF 'on_unavailable'; then
  pf_pass "TC-007 step 3b: Spike branch explicitly addresses the bare-folder carve-out (always asked)"
else
  pf_fail "TC-007 step 3b: Spike branch does not address the bare-folder carve-out"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-008: pf-interaction — front-loaded rule, one final gate, one exception\n'
# ══════════════════════════════════════════════════════════════════════════════

FL_RULE="$(range_between "$INTERACTION" '## Front-loaded rule' '## One final human gate')"
if printf '%s' "$FL_RULE" | grep -qi 'рекомендованн' && printf '%s' "$FL_RULE" | grep -qF '[assumed]' && printf '%s' "$FL_RULE" | grep -qi 'Продолжить'; then
  pf_pass "TC-008 step 1: Front-loaded rule states take-recommendation / [assumed] / continue"
else
  pf_fail "TC-008 step 1: Front-loaded rule missing one of its three steps"
fi

GATE="$(range_between "$INTERACTION" '## One final human gate' '## Exceptions for idea/spike')"
if printf '%s' "$GATE" | grep -qi 'не два' && printf '%s' "$GATE" | grep -qi 'сессия решения' && printf '%s' "$GATE" | grep -qF 'Phase 1'; then
  pf_pass "TC-008 step 2: one final human gate — not two, names decision session (idea) and Phase 1 (spike)"
else
  pf_fail "TC-008 step 2: 'one gate, not two' statement missing decision-session/Phase-1 detail"
fi

EXC="$(range_between "$INTERACTION" '## Exceptions for idea/spike' '## `interaction: front-loaded` field')"
if printf '%s' "$EXC" | grep -qF 'exactly one' && printf '%s' "$EXC" | grep -qi 'Codex'; then
  pf_pass "TC-008 step 3: exceptions section names exactly one case, involving Codex"
else
  pf_fail "TC-008 step 3: exceptions section does not name exactly one Codex-related case"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-009: idea.md — seven fixed top-level sections, lenses nested under ###\n'
# ══════════════════════════════════════════════════════════════════════════════

IDEA_SKELETON="$(range_between "$IDEA" '```markdown' '```' | sed '1d')"
headings="$(printf '%s\n' "$IDEA_SKELETON" | grep -E '^## ' | sed 's/^## //')"
expected=$'Pain & Evidence\nAnalogs / Prior Art\nDifferentiation / USP\nMVP\nCost (Effort)\nRisks\nLenses Applied'
if [ "$headings" = "$expected" ]; then
  pf_pass "TC-009 step 1: idea.md skeleton carries exactly the seven sections, in order"
else
  pf_fail "TC-009 step 1: idea.md skeleton headings differ from spec"
  diff <(printf '%s\n' "$expected") <(printf '%s\n' "$headings") >&2 || true
fi

LENSES_SECTION="$(printf '%s\n' "$IDEA_SKELETON" | sed -n '/^## Lenses Applied/,$p')"
if printf '%s\n' "$LENSES_SECTION" | grep -q '^### '; then
  pf_pass "TC-009 step 2: lens artifacts are nested as ### subheadings under Lenses Applied"
else
  pf_fail "TC-009 step 2: no ### subheadings found under Lenses Applied"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-010: research.md — Status/Source discipline, unverified facts logging\n'
# ══════════════════════════════════════════════════════════════════════════════

RESEARCH_SKELETON="$(range_between "$RESEARCH" '```markdown' '```' | sed '1d')"
if printf '%s' "$RESEARCH_SKELETON" | grep -qE '^\| # \| Claim \| Status \| Source \| Notes \|'; then
  pf_pass "TC-010 step 1: research.md skeleton's Facts table has Status/Source columns"
else
  pf_fail "TC-010 step 1: research.md skeleton's Facts table missing Status/Source columns"
fi

if grep -qi 'проверено.*Source.*пуст\|invalid combination' "$RESEARCH"; then
  pf_pass "TC-010 step 2: pf-idea-research states the проверено⇒Source invariant"
else
  pf_fail "TC-010 step 2: pf-idea-research does not state the invariant"
fi

if grep -qF 'unverified-fact' "$RESEARCH" && grep -qF 'open_questions.md' "$RESEARCH"; then
  pf_pass "TC-010 step 3: pf-idea-research copies не проверено rows to open_questions.md as unverified-fact"
else
  pf_fail "TC-010 step 3: pf-idea-research does not document the unverified-fact copy"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-011: critique.md — personas, single actor resolve, Disposition dictionary\n'
# ══════════════════════════════════════════════════════════════════════════════

PERSONAS_1="$(range_between "$CRITIQUE" '## 1. Persona set' '## 2. Resolve the actor once')"
missing=()
for p in 'Скептик-инвестор' 'Целевой' 'Техлид' 'Безопасник'; do
  printf '%s' "$PERSONAS_1" | grep -qF "$p" || missing+=("$p")
done
if [ ${#missing[@]} -eq 0 ] && printf '%s' "$PERSONAS_1" | grep -qi 'tier-specific extension'; then
  pf_pass "TC-011 step 1: pf-idea-critique lists the four base personas plus tier-specific extension"
else
  pf_fail "TC-011 step 1: missing base personas (${missing[*]:-none}) or tier-extension mention"
fi

if grep -qi 'actor.*resolves exactly once\|resolves exactly once for the whole document' "$CRITIQUE"; then
  pf_pass "TC-011 step 2: actor resolves once for the key, not per persona"
else
  pf_fail "TC-011 step 2: single-resolve statement not found"
fi

CRITIQUE_SKELETON="$(range_between "$CRITIQUE" '```markdown' '```' | sed '1d')"
if printf '%s' "$CRITIQUE_SKELETON" | grep -qF 'Disposition' && printf '%s' "$CRITIQUE_SKELETON" | grep -qF 'Reflected in' \
  && printf '%s' "$CRITIQUE_SKELETON" | grep -qF 'Отвечено' && printf '%s' "$CRITIQUE_SKELETON" | grep -qF 'Риск принят' \
  && printf '%s' "$CRITIQUE_SKELETON" | grep -qF 'Идея меняется'; then
  pf_pass "TC-011 step 3: critique.md skeleton's Summary Table has Disposition (3 values) and Reflected in"
else
  pf_fail "TC-011 step 3: critique.md skeleton missing Disposition/Reflected in columns or values"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-013: verdict.md — closed dictionary, Mode 1 skeleton, Mode 2 batch\n'
# ══════════════════════════════════════════════════════════════════════════════

VERDICT_DICT="$(range_between "$LENSES" '## 6. Verdict dictionary' '')"
# The dictionary's own list line (not the whole section — the section also
# legitimately DISCUSSES `incubate-until` by name, to say it is excluded).
DICT_LIST_LINE="$(printf '%s\n' "$VERDICT_DICT" | grep -F '`project`' | head -1)"
if printf '%s' "$DICT_LIST_LINE" | grep -qF '`project`' && printf '%s' "$DICT_LIST_LINE" | grep -qF '`spike-first`' \
  && printf '%s' "$DICT_LIST_LINE" | grep -qF '`defer`' && printf '%s' "$DICT_LIST_LINE" | grep -qF '`archive`' \
  && ! printf '%s' "$DICT_LIST_LINE" | grep -qF '`incubate-until`' \
  && printf '%s' "$VERDICT_DICT" | grep -qi 'this dictionary'; then
  pf_pass "TC-013 step 1: verdict dictionary's list is exactly project/spike-first/defer/archive; incubate-until explicitly excluded"
else
  pf_fail "TC-013 step 1: verdict dictionary does not match spec"
fi

MODE1_SKELETON="$(range_between "$VERDICT" '# Verdict: <slug>' '```' )"
if printf '%s' "$MODE1_SKELETON" | grep -qF '## Unverified Facts Summary' && ! printf '%s' "$MODE1_SKELETON" | grep -qF '## Decision'; then
  pf_pass "TC-013 step 2: Mode 1 skeleton ends at Unverified Facts Summary, no ## Decision"
else
  pf_fail "TC-013 step 2: Mode 1 skeleton carries ## Decision, or does not end where expected"
fi

BATCH="$(range_between "$VERDICT" '### 1. One batch' '### 2. Override')"
if printf '%s' "$BATCH" | grep -qF 'Подтвердить' && printf '%s' "$BATCH" | grep -qF 'Выбрать другой вердикт' \
  && printf '%s' "$BATCH" | grep -qF 'Переопределить допущение'; then
  pf_pass "TC-013 step 3: Mode 2 batch offers exactly the three options"
else
  pf_fail "TC-013 step 3: Mode 2 batch's three options not found"
fi

n_full_lists="$(printf '%s\n' "$BATCH" | grep -ci 'Полный список' || true)"
if [ "${n_full_lists:-0}" -ge 3 ]; then
  pf_pass "TC-013 step 4: Mode 2 batch carries three 'Полный список' mentions (assumptions/open questions/unverified facts)"
else
  pf_fail "TC-013 step 4: Mode 2 batch carries only ${n_full_lists:-0} 'Полный список' mentions, want >= 3"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-015: idea_tier dictionary, lens table, no copies elsewhere\n'
# ══════════════════════════════════════════════════════════════════════════════

IDEA_TIER_TABLE="$(range_between "$LENSES" '## 1. `idea_tier`' '## 2. Lens sets')"
n_tier_rows="$(printf '%s\n' "$IDEA_TIER_TABLE" | grep -cE '^\| `(personal|infra|content|product)`' || true)"
LENS_TABLE="$(range_between "$LENSES" '## 2. Lens sets' '## 3. Critique-persona sets')"
if [ "${n_tier_rows:-0}" -eq 4 ] && printf '%s' "$LENS_TABLE" | grep -qF '5 почему'; then
  pf_pass "TC-015 step 1: idea_tier table (4 rows) and lens table present"
else
  pf_fail "TC-015 step 1: idea_tier table row count is ${n_tier_rows:-0} (want 4), or lens table missing"
fi

FIVE_WHY_ROW="$(printf '%s\n' "$LENS_TABLE" | grep '5 почему')"
n_checks="$(printf '%s' "$FIVE_WHY_ROW" | grep -o '✓' | wc -l)"
if [ "${n_checks:-0}" -eq 4 ]; then
  pf_pass "TC-015 step 2: '5 почему' is marked ✓ in all four columns"
else
  pf_fail "TC-015 step 2: '5 почему' marked ✓ in ${n_checks:-0} columns, want 4"
fi

PERSONAL_COL_UNMARKED=1
for lens in 'SWOT' 'TAM/SAM/SOM' 'Lean Canvas' 'JTBD' 'Pre-mortem'; do
  row="$(printf '%s\n' "$LENS_TABLE" | grep -F "$lens")"
  # personal is the FIRST of the four ✓/— columns after the lens name column.
  first_mark="$(printf '%s' "$row" | awk -F'|' '{print $3}' | tr -d ' ')"
  [ "$first_mark" = "✓" ] && PERSONAL_COL_UNMARKED=0
done
if [ "$PERSONAL_COL_UNMARKED" -eq 1 ]; then
  pf_pass "TC-015 step 3: personal gets none of SWOT/TAM-SAM-SOM/Lean Canvas/JTBD/Pre-mortem"
else
  pf_fail "TC-015 step 3: personal is marked for at least one business lens"
fi

# A copy of the table would reproduce its distinctive personal/infra/content/
# product tier-column header row — a bare mention of a lens name in prose
# (e.g. pf-idea's own list of lens-artifact names) is not a copy.
if ! grep -qE 'personal \| infra \| content \| product' "$IDEA" && ! grep -qE 'personal \| infra \| content \| product' "$CHECK"; then
  pf_pass "TC-015 step 4: neither pf-idea nor pf-check carries a copy of the lens table's header row"
else
  pf_fail "TC-015 step 4: a copy of the lens table's tier-column header row found outside pf-idea-lenses"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-016: single document-budget source; pf-check compares idea_tier, not size_tier\n'
# ══════════════════════════════════════════════════════════════════════════════

BUDGET_TABLE="$(range_between "$LENSES" '## 4. Document budgets' '## 5. Stage tables')"
n_budget_rows="$(printf '%s\n' "$BUDGET_TABLE" | grep -cE '^\| `[a-z]+\.md`' || true)"
if [ "${n_budget_rows:-0}" -eq 6 ]; then
  pf_pass "TC-016 step 1: pf-idea-lenses document-budget table has six rows"
else
  pf_fail "TC-016 step 1: document-budget table has ${n_budget_rows:-0} rows, want 6"
fi

CLAUDE_PATH="$(range_between "$CHECK" '### Claude review path' '### Codex invocation chain')"
if printf '%s' "$CLAUDE_PATH" | grep -qF 'idea_tier' && printf '%s' "$CLAUDE_PATH" | grep -qF 'pf-idea-lenses' \
  && printf '%s' "$CLAUDE_PATH" | grep -qi 'never against.*pf-size-tiers\|never against `pf-size-tiers'; then
  pf_pass "TC-016 step 2: Claude review path reads idea_tier against pf-idea-lenses, never pf-size-tiers, for the six TARGETs"
else
  pf_fail "TC-016 step 2: idea_tier branch not found (or does not exclude pf-size-tiers) in Claude review path"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-017: pf-close — idea prerequisite, Phase 1/4.5 skip, size_tier table, Phase 9 cleanup\n'
# ══════════════════════════════════════════════════════════════════════════════

PHASE0="$(range_between "$CLOSE" '## Phase 0: Prerequisite Checks' '## Phase 1: Confirm with User')"
if printf '%s' "$PHASE0" | grep -qF '## Decision' && printf '%s' "$PHASE0" | grep -qi 'verdict.md'; then
  pf_pass "TC-017 step 1: Phase 0's type table checks for ## Decision in verdict.md for idea"
else
  pf_fail "TC-017 step 1: Phase 0's idea row does not check for ## Decision"
fi

PHASE1="$(range_between "$CLOSE" '## Phase 1: Confirm with User' '## Phase 2: Pre-Close Cleanup')"
if printf '%s' "$PHASE1" | grep -qF 'Skip this entire phase for `TYPE: idea`'; then
  pf_pass "TC-017 step 2: Phase 1 is skipped entirely for TYPE: idea"
else
  pf_fail "TC-017 step 2: Phase 1 skip-for-idea statement not found"
fi

PHASE45_INTRO="$(range_between "$CLOSE" '## Phase 4.5' '## Phase 4.6')"
first_line="$(printf '%s\n' "$PHASE45_INTRO" | sed '1d' | grep -m1 '.')"
if printf '%s' "$first_line" | grep -qi 'Skip this entire phase for `TYPE: idea` or `TYPE: spike`'; then
  pf_pass "TC-017 step 3: Phase 4.5 opens with skip-for-idea/spike, before its body"
else
  pf_fail "TC-017 step 3: Phase 4.5's opening line does not carry the idea/spike skip"
fi

PHASE46="$(range_between "$CLOSE" '## Phase 4.6' '## Phase 5: Archive Issue Folder')"
n_tier_table_rows="$(printf '%s\n' "$PHASE46" | grep -cE '^ *\| `(personal|infra|content|product)`' || true)"
if [ "${n_tier_table_rows:-0}" -eq 6 ]; then
  pf_pass "TC-017 step 4: Phase 4.6 carries the six-row size_tier derivation table"
else
  pf_fail "TC-017 step 4: Phase 4.6's size_tier table has ${n_tier_table_rows:-0} rows, want 6"
fi

PHASE9="$(range_between "$CLOSE" '## Phase 9: Report' '## Important Notes')"
first_para="$(printf '%s\n' "$PHASE9" | sed '1d' | grep -m1 '.')"
if printf '%s' "$first_para" | grep -qF 'CronList' && printf '%s' "$first_para" | grep -qi 'idea'; then
  pf_pass "TC-017 step 5: Phase 9 opens with the CronList/CronDelete cleanup for idea/spike"
else
  pf_fail "TC-017 step 5: Phase 9's cleanup paragraph not found preceding the rest of the phase"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-018: hypothesis.md/findings.md skeletons, write gate\n'
# ══════════════════════════════════════════════════════════════════════════════

HYP_SKELETON="$(nth_fenced_block "$SPIKE" 1)"
hyp_headings="$(printf '%s\n' "$HYP_SKELETON" | grep -E '^## ' | sed 's/^## //')"
expected_hyp=$'Question\nSuccess Criterion\nTime-box\nMethod'
if [ "$hyp_headings" = "$expected_hyp" ]; then
  pf_pass "TC-018 step 1: hypothesis.md skeleton has Question/Success Criterion/Time-box/Method, in order"
else
  pf_fail "TC-018 step 1: hypothesis.md skeleton headings differ from spec"
fi

FIND_SKELETON="$(nth_fenced_block "$SPIKE" 2)"
find_headings="$(printf '%s\n' "$FIND_SKELETON" | grep -E '^## ' | sed 's/^## //')"
expected_find=$'Run Evidence\nResult vs. Success Criterion\nConclusion\nFollow-up'
if [ "$find_headings" = "$expected_find" ]; then
  pf_pass "TC-018 step 2: findings.md skeleton has Run Evidence/Result vs. Success Criterion/Conclusion/Follow-up, in order"
else
  pf_fail "TC-018 step 2: findings.md skeleton headings differ from spec"
fi

if grep -qF 'Write gate (AC-09c)' "$SPIKE" && grep -qi 'without a non-empty' "$SPIKE"; then
  pf_pass "TC-018 step 3: pf-idea-spike states the Conclusion-without-Run-Evidence gate"
else
  pf_fail "TC-018 step 3: write-gate statement not found"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-019: interaction: front-loaded — optional for feat/improve/bug, always-on for idea/spike\n'
# ══════════════════════════════════════════════════════════════════════════════

FIELD_SECTION="$(range_between "$INTERACTION" '## `interaction: front-loaded` field' '')"
if printf '%s' "$FIELD_SECTION" | grep -qi 'опционально' && printf '%s' "$FIELD_SECTION" | grep -qi 'сегодняшнее интерактивное поведение'; then
  pf_pass "TC-019 step 1: field is optional, absence == today's interactive behavior"
else
  pf_fail "TC-019 step 1: optionality statement not found"
fi

if printf '%s' "$FIELD_SECTION" | grep -qi 'присутствует всегда' && printf '%s' "$FIELD_SECTION" | grep -qi 'не читается как переключатель'; then
  pf_pass "TC-019 step 2: for idea/spike the field is always present but not read as a switch"
else
  pf_fail "TC-019 step 2: idea/spike always-present-not-a-switch statement not found"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-021: pf-check — TYPE before size_tier, six+six rows, open_questions.md as context\n'
# ══════════════════════════════════════════════════════════════════════════════

OPENING="$(head -n 25 "$CHECK")"
if printf '%s' "$OPENING" | grep -qF 'First, determine TYPE' && printf '%s' "$OPENING" | grep -qF 'skip this entire `size_tier` paragraph'; then
  pf_pass "TC-021 step 1: pf-check determines TYPE first, skips size_tier paragraph for idea/spike"
else
  pf_fail "TC-021 step 1: TYPE-first / size_tier-skip statement not found at the top of pf-check"
fi

PREDECESSORS="$(head -n 25 "$CHECK")"
missing=()
for row in 'idea.md' 'research.md' 'critique.md' 'verdict.md' 'hypothesis.md' 'findings.md'; do
  printf '%s' "$PREDECESSORS" | grep -qF "checking $row" || missing+=("$row")
done
if [ ${#missing[@]} -eq 0 ]; then
  pf_pass "TC-021 step 2: all six TARGET->predecessor rows present"
else
  pf_fail "TC-021 step 2: missing predecessor rows for: ${missing[*]}"
fi

REVIEWER_TABLE="$(range_between "$CHECK" '## Reviewer selection' 'The resolved role')"
missing=()
for key in idea research critique verdict hypothesis findings; do
  printf '%s' "$REVIEWER_TABLE" | grep -qE "\`$key\.md\` \| \`$key\`" || missing+=("$key")
done
if [ ${#missing[@]} -eq 0 ]; then
  pf_pass "TC-021 step 3: Reviewer selection table carries all six TARGET->key rows"
else
  pf_fail "TC-021 step 3: missing TARGET->key rows for: ${missing[*]}"
fi

if grep -qi 'not a predecessor' "$CHECK" && grep -qi 'reviewer context' "$CHECK"; then
  pf_pass "TC-021 step 4: open_questions.md documented as context, not a predecessor"
else
  pf_fail "TC-021 step 4: open_questions.md context-not-predecessor statement not found"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-022: pf-brd — idea_ref hook\n'
# ══════════════════════════════════════════════════════════════════════════════

HOOK="$(range_between "$BRD" '`idea_ref` hook' '## Close the stage')"
if [ -n "$HOOK" ]; then
  pf_pass "TC-022 step 1: idea_ref hook paragraph present"
else
  pf_fail "TC-022 step 1: idea_ref hook paragraph not found"
fi

if printf '%s' "$HOOK" | grep -qi 'not.*asked again\|genuine gaps'; then
  pf_pass "TC-022 step 2: hook states already-answered fields are not re-asked"
else
  pf_fail "TC-022 step 2: 'not re-asked, only genuine gaps' statement not found"
fi

if printf '%s' "$HOOK" | grep -qF 'Phase 4.6' && printf '%s' "$HOOK" | grep -qi 'already'; then
  pf_pass "TC-022 step 3: hook mentions roles/profile/on_unavailable usually already present via Phase 4.6"
else
  pf_fail "TC-022 step 3: Phase 4.6 already-present statement not found"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-023: pf-autopilot — five new skills, stop before final gate, assumed report\n'
# ══════════════════════════════════════════════════════════════════════════════

WORKLOOP="$(range_between "$AUTOPILOT" '## Step 2. Work loop' '## Step 3. Completion')"
missing=()
for cmd in '/pf-idea`' '/pf-idea-research`' '/pf-idea-critique`' '/pf-idea-verdict`' '/pf-idea-spike`'; do
  printf '%s' "$WORKLOOP" | grep -qF "$cmd" || missing+=("$cmd")
done
if [ ${#missing[@]} -eq 0 ]; then
  pf_pass "TC-023 step 1: Step 2's work loop lists all five new writing skills"
else
  pf_fail "TC-023 step 1: missing commands in Step 2's work loop: ${missing[*]}"
fi

if printf '%s' "$WORKLOOP" | grep -qF '/pf-idea-verdict (decision session)' && printf '%s' "$WORKLOOP" | grep -qi '`spike`-type' && printf '%s' "$WORKLOOP" | grep -qF 'next step is `/pf-close`'; then
  pf_pass "TC-023 step 2: item 7 stops before decision session (idea) AND /pf-close (spike)"
else
  pf_fail "TC-023 step 2: item 7 does not name both idea decision session and spike /pf-close"
fi

COMPLETION="$(range_between "$AUTOPILOT" '## Step 3. Completion' '## Limits')"
if printf '%s' "$COMPLETION" | grep -qi '\[assumed\]' && printf '%s' "$COMPLETION" | grep -qi 'open question'; then
  pf_pass "TC-023 step 3: Step 3 lists [assumed] lines and open questions on the interim report"
else
  pf_fail "TC-023 step 3: [assumed]/open-questions enumeration not found in Step 3"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-024: pf-roles — six new keys, bare-folder carve-out (level 1 still checked)\n'
# ══════════════════════════════════════════════════════════════════════════════

missing=()
for key in idea research critique verdict hypothesis findings; do
  grep -qF "\`$key\`" "$ROLES" || missing+=("$key")
done
if [ ${#missing[@]} -eq 0 ]; then
  pf_pass "TC-024 step 1: pf-roles names all six new stage keys"
else
  pf_fail "TC-024 step 1: missing stage keys: ${missing[*]}"
fi

n_exceptions="$(grep -c 'Exception — bare `idea`/`spike` folder' "$ROLES" || true)"
if [ "${n_exceptions:-0}" -ge 2 ]; then
  pf_pass "TC-024 step 2: bare idea/spike folder exception present in both Auto-creation sections"
else
  pf_fail "TC-024 step 2: bare idea/spike folder exception found ${n_exceptions:-0} times, want >= 2"
fi

n_level1="$(grep -c 'level 1.*is still checked first\|is still checked first' "$ROLES" || true)"
if [ "${n_level1:-0}" -ge 1 ]; then
  pf_pass "TC-024 step 3: carve-out explicitly says level 1 is still checked first"
else
  pf_fail "TC-024 step 3: 'level 1 ... still checked first' statement not found"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-025: converge-to-v3.sh — idea/spike branches in required_docs()/skill_for_doc()\n'
# ══════════════════════════════════════════════════════════════════════════════

REQ_DOCS="$(range_between "$CONVERGE" 'required_docs() {' '^}')"
if printf '%s' "$REQ_DOCS" | grep -qF 'idea) printf' && printf '%s' "$REQ_DOCS" | grep -qF 'idea.md research.md critique.md verdict.md'; then
  pf_pass "TC-025 step 1: required_docs() has an idea) branch returning the four idea docs"
else
  pf_fail "TC-025 step 1: required_docs()'s idea) branch not found or wrong"
fi

if printf '%s' "$REQ_DOCS" | grep -qF 'spike) printf' && printf '%s' "$REQ_DOCS" | grep -qF 'hypothesis.md findings.md'; then
  pf_pass "TC-025 step 2: required_docs() has a spike) branch returning the two spike docs"
else
  pf_fail "TC-025 step 2: required_docs()'s spike) branch not found or wrong"
fi

SKILL_FOR_DOC="$(range_between "$CONVERGE" 'skill_for_doc() {' '^}')"
missing=()
for doc in 'idea.md) printf' 'research.md) printf' 'critique.md) printf' 'verdict.md) printf' 'hypothesis.md | findings.md) printf'; do
  printf '%s' "$SKILL_FOR_DOC" | grep -qF "$doc" || missing+=("$doc")
done
if [ ${#missing[@]} -eq 0 ]; then
  pf_pass "TC-025 step 3: skill_for_doc() carries all six new document->skill branches"
else
  pf_fail "TC-025 step 3: skill_for_doc() missing branches: ${missing[*]}"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-026 (counters half — mirror diff is test/pf-idea-templates-mirror.sh, Task 18)\n'
# ══════════════════════════════════════════════════════════════════════════════

NEW_SKILL_NAMES=(pf-idea pf-idea-research pf-idea-critique pf-idea-verdict pf-idea-spike pf-idea-lenses pf-interaction)
for f in "$REPO_ROOT/CLAUDE.md" "$REPO_ROOT/README.md" "$REPO_ROOT/docs/planning/FRAMEWORK.md" \
  "$REPO_ROOT/docs/planning/QUICKSTART.md" "$UPDATE" "$REPO_ROOT/tools/onboarding-tui/lib/tutorial.js"; do
  label="${f#"$REPO_ROOT"/}"
  has28=0
  grep -q '28' "$f" && has28=1
  hasname=0
  for n in "${NEW_SKILL_NAMES[@]}"; do
    grep -qF "$n" "$f" && { hasname=1; break; }
  done
  if [ "$has28" -eq 1 ] && [ "$hasname" -eq 1 ]; then
    pf_pass "TC-026: $label mentions 28 and at least one new skill name"
  else
    pf_fail "TC-026: $label missing '28' mention (has28=$has28) or a new skill name (hasname=$hasname)"
  fi
done

if grep -qF '7 Claude Code skills (`/pf`, `/pf-brd`, `/pf-spec`, `/pf-check`, `/pf-test-plan`, `/pf-impl-plan`, `/pf-execute`)' "$REPO_ROOT/README.md"; then
  pf_pass "TC-026: README.md's historical '7 Claude Code skills' release note is untouched"
else
  pf_fail "TC-026: README.md's historical '7 Claude Code skills' release note not found verbatim"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-027: feat/improve/bug unchanged; single source of stage order\n'
# ══════════════════════════════════════════════════════════════════════════════

# Step 1 — each of the six changed shared skills conditions its new idea/spike
# branches on TYPE (or, where the file has no bare TYPE literal, an equivalent
# type-scoped qualifier actually present in that file's own prose).
declare -A TYPE_PATTERNS=(
  ["$PF"]='TYPE is `idea` or `spike`'
  ["$CHECK"]='TYPE is `idea` or `spike`'
  ["$CLOSE"]='TYPE: idea'
  ["$GIT"]='idea branch'
  ["$AUTOPILOT"]='idea`-type'
  ["$ROLES"]='TYPE is `idea` or `spike`'
)
all_ok=1
for f in "${!TYPE_PATTERNS[@]}"; do
  if ! grep -qF "${TYPE_PATTERNS[$f]}" "$f"; then
    pf_fail "TC-027 step 1: ${f#"$REPO_ROOT"/} has no occurrence of '${TYPE_PATTERNS[$f]}'"
    all_ok=0
  fi
done
[ "$all_ok" -eq 1 ] && pf_pass "TC-027 step 1: all six changed shared skills carry a TYPE-scoped qualifier for their new idea/spike branches"

# Step 2 — original unconditional feat/improve/bug text survives (example given
# by the test plan: /pf's original Step 3 "No issue folders found").
if grep -qF 'No issue folders found' "$PF"; then
  pf_pass "TC-027 step 2: original unconditional 'No issue folders found' text preserved in /pf"
else
  pf_fail "TC-027 step 2: 'No issue folders found' text missing from /pf"
fi

# Step 3 — pf-size-tiers' two new Pipelines rows both reference pf-idea-lenses
# by name (not a copy of the six-document list).
PIPELINES="$(range_between "$TIERS" '### Pipelines' '### Scope')"
idea_row="$(printf '%s\n' "$PIPELINES" | grep -E '^\| `idea`')"
spike_row="$(printf '%s\n' "$PIPELINES" | grep -E '^\| `spike`')"
idea_ok=0; spike_ok=0
printf '%s' "$idea_row" | grep -qF 'pf-idea-lenses' && idea_ok=1
printf '%s' "$spike_row" | grep -qF 'pf-idea-lenses' && spike_ok=1
if [ "$idea_ok" -eq 1 ] && [ "$spike_ok" -eq 1 ]; then
  pf_pass "TC-027 step 3: both new Pipelines rows (idea, spike) reference pf-idea-lenses by name"
else
  pf_fail "TC-027 step 3: Pipelines row(s) do not reference pf-idea-lenses by name — idea_ok=$idea_ok spike_ok=$spike_ok (found defect: see summary)"
fi

pf_summary
