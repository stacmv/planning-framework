#!/usr/bin/env bash
#
# scripts/converge-to-v4.sh - PF4 top-up wrapper.
#
# PF4 keeps the mature v3 migration engine for legacy layout work, then adds the
# multi-agent runtime surfaces: v4 markers plus Codex repository skills.

set -uo pipefail

PF_VERSION="4.0.0"

SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd -P)"
FRAMEWORK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
SKILLS_SRC="$FRAMEWORK_ROOT/skills"

TARGET=""
AGENTS="auto"
PASS_ARGS=()

usage() {
  cat <<'USAGE'
Usage: converge-to-v4.sh [options]

Converges a project on Planning Framework v4 from no-PF, v1, v2, mixed,
incomplete v3, or complete v3.

Options:
  --target <dir>         Project to converge (default: current directory)
  --agents <mode>        auto, both, claude, or codex (default: auto)
  --yes                  Forwarded to the v3 convergence engine
  --dry-run              Forwarded; also prints the PF4 top-up plan
  --force                Forwarded
  --doc-language <lang>  Forwarded
  --help                 Show this help and exit
USAGE
}

cli_error() {
  printf 'ERROR: %s\n\n' "$1" >&2
  usage >&2
  exit 2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --target)
      [ $# -ge 2 ] || cli_error "--target requires a directory argument"
      TARGET="$2"
      PASS_ARGS+=("$1" "$2")
      shift 2
      ;;
    --target=*)
      TARGET="${1#--target=}"
      [ -n "$TARGET" ] || cli_error "--target requires a directory argument"
      PASS_ARGS+=("$1")
      shift
      ;;
    --agents)
      [ $# -ge 2 ] || cli_error "--agents requires one of: auto, both, claude, codex"
      AGENTS="$2"
      shift 2
      ;;
    --agents=*)
      AGENTS="${1#--agents=}"
      shift
      ;;
    --help | -h)
      usage
      exit 0
      ;;
    --yes | -y | --dry-run | --force | --doc-language | --doc-language=* | --fail-after=*)
      if [ "$1" = "--doc-language" ]; then
        [ $# -ge 2 ] || cli_error "--doc-language requires a value"
        PASS_ARGS+=("$1" "$2")
        shift 2
      else
        PASS_ARGS+=("$1")
        shift
      fi
      ;;
    *)
      cli_error "unknown option: $1"
      ;;
  esac
done

TARGET="${TARGET:-$(pwd)}"
if [ ! -d "$TARGET" ]; then
  printf 'ERROR: target directory does not exist: %s\n' "$TARGET" >&2
  exit 2
fi
TARGET="$(cd "$TARGET" && pwd -P)"

case "$AGENTS" in
  auto)
    if command -v claude >/dev/null 2>&1 && command -v codex >/dev/null 2>&1; then
      AGENTS="both"
    elif command -v codex >/dev/null 2>&1; then
      AGENTS="codex"
    else
      AGENTS="claude"
    fi
    ;;
  both | claude | codex) ;;
  *) cli_error "invalid --agents '$AGENTS' - valid values: auto, both, claude, codex" ;;
esac

want_claude=0
want_codex=0
case "$AGENTS" in
  both) want_claude=1; want_codex=1 ;;
  claude) want_claude=1 ;;
  codex) want_codex=1 ;;
esac

dry_run=0
for a in "${PASS_ARGS[@]}"; do
  [ "$a" = "--dry-run" ] && dry_run=1
done

printf '\nPlanning Framework - converge to v4\n'
printf '===================================\n\n'

if [ "$want_claude" -eq 1 ]; then
  bash "$FRAMEWORK_ROOT/scripts/converge-to-v3.sh" "${PASS_ARGS[@]}"
  rc=$?
else
  PF_CONVERGE_SKIP_CLAUDE=1 bash "$FRAMEWORK_ROOT/scripts/converge-to-v3.sh" "${PASS_ARGS[@]}"
  rc=$?
fi
[ "$rc" -eq 0 ] || exit "$rc"

if [ "$dry_run" -eq 1 ]; then
  printf '\nPF4 top-up plan (dry run - no changes were made by this wrapper):\n'
  printf '  Would write .pf-version = %s\n' "$PF_VERSION"
  printf '  Would stamp PLANNING.md as v4.0\n'
  [ "$want_codex" -eq 1 ] && printf '  Would install Codex skills into .agents/skills/\n'
  [ "$want_codex" -eq 1 ] && printf '  Would add/update the PF section in AGENTS.md\n'
  printf '  Agent adapters: %s\n' "$AGENTS"
  exit 0
fi

printf '\nPhase 8 - PF4 multi-agent top-up\n'

printf '%s\n' "$PF_VERSION" >"$TARGET/.pf-version"
printf '  wrote .pf-version = %s\n' "$PF_VERSION"

stamp_planning_md() {
  local file="$1"
  [ -f "$file" ] || return 0
  sed -i \
    -e 's/Planning Framework v3\.0/Planning Framework v4.0/g' \
    -e 's/Planning Framework v3/Planning Framework v4/g' \
    -e 's/Framework Version:\*\* *3\.0/Framework Version:** 4.0/g' \
    -e 's/Framework Version:\*\* *3\.0\.0/Framework Version:** 4.0.0/g' \
    "$file"
  if ! grep -q 'PF4 multi-agent runtime' "$file"; then
    cat >>"$file" <<'EOF'

---

## PF4 multi-agent runtime

PF4 supports Claude Code and Codex as runtime/master agents. The runtime agent
owns workflow state and file edits. A peer reviewer may inspect documents or
code, but fixes are applied by the runtime agent.

Reviewer values in issue frontmatter may be `self`, `peer`, `both`, `claude`,
or `codex`. `self` means the current runtime agent; `peer` means the other
supported agent when it is available.
EOF
  fi
}

stamp_claude_md() {
  local file="$1"
  [ -f "$file" ] || return 0
  sed -i \
    -e 's/Framework Version:\*\* *3\.0/Framework Version:** 4.0/g' \
    -e 's/Planning Framework v3\.0/Planning Framework v4.0/g' \
    "$file"
  if ! grep -q 'PF4 can also install a Codex adapter' "$file"; then
    cat >>"$file" <<'EOF'

PF4 can also install a Codex adapter into `.agents/skills`. When both agents are available, the
runtime/master agent owns edits and may ask the peer agent for read-only review.
EOF
  fi
}

stamp_planning_md "$TARGET/PLANNING.md"
stamp_planning_md "$TARGET/docs/planning/templates/config/PLANNING.md"
stamp_claude_md "$TARGET/CLAUDE.md"
stamp_claude_md "$TARGET/docs/planning/templates/config/CLAUDE.md"
if [ -f "$TARGET/PLANNING.md" ]; then
  printf '  stamped PLANNING.md for v4\n'
fi

if [ "$want_codex" -eq 1 ]; then
  codex_skills="$TARGET/.agents/skills"
  mkdir -p "$codex_skills"
  for src in "$SKILLS_SRC"/*/; do
    [ -d "$src" ] || continue
    [ -f "${src}SKILL.md" ] || continue
    name="$(basename "$src")"
    mkdir -p "$codex_skills/$name"
    cp -r "${src}." "$codex_skills/$name/"
  done
  printf '  installed Codex skills -> .agents/skills/\n'

  agents_file="$TARGET/AGENTS.md"
  begin='<!-- pf4:begin -->'
  end='<!-- pf4:end -->'
  tmp="$(mktemp)"
  section="$(mktemp)"
  cat >"$section" <<'EOF'
<!-- pf4:begin -->
# Planning Framework v4

This repository uses Planning Framework v4. Read `PLANNING.md` first, then use
the local PF skills from `.agents/skills`.

## Runtime rules

- Codex may be the runtime/master agent for the PF workflow.
- The runtime/master agent owns file edits and workflow state.
- Reviewer agents are read-only: they produce findings for documents or code.
- If `reviewers.<artifact>` is `self`, review with the current runtime agent.
- If it is `peer`, review with the other installed supported agent.
- If it is `both`, run both reviews and aggregate findings without arbitration.
- When Codex is runtime and Claude is selected as reviewer, call Claude through
  `claude -p` with a review-only prompt.
<!-- pf4:end -->
EOF

  if [ -f "$agents_file" ] && grep -q "$begin" "$agents_file" && grep -q "$end" "$agents_file"; then
    sed "/$begin/,/$end/{ /$begin/r $section
      /$end/!d
      /$end/d
    }" "$agents_file" >"$tmp"
    mv "$tmp" "$agents_file"
  elif [ -f "$agents_file" ]; then
    cat "$agents_file" >"$tmp"
    printf '\n\n' >>"$tmp"
    cat "$section" >>"$tmp"
    mv "$tmp" "$agents_file"
  else
    mv "$section" "$agents_file"
    section=""
  fi
  [ -n "$section" ] && rm -f "$section"
  rm -f "$tmp"
  printf '  added/updated AGENTS.md PF4 section\n'
fi

printf '\nPF4 converge complete\n'
printf 'Project        : %s\n' "$TARGET"
printf 'Agent adapters : %s\n' "$AGENTS"
