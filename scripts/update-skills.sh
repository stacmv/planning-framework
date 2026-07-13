#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRAMEWORK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="${SCRIPT_DIR}/../skills"
TARGET_DIR="$HOME/.claude/skills"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --source)
            SOURCE_DIR="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1" >&2
            echo "Usage: $(basename "$0") [--source <path>]" >&2
            exit 1
            ;;
    esac
done

# Validate source directory
if [[ ! -d "$SOURCE_DIR" ]]; then
    echo "Error: source directory not found: $SOURCE_DIR" >&2
    exit 1
fi

# Check that source contains skill subdirectories
skill_dirs=()
while IFS= read -r -d '' d; do
    [[ -f "$d/SKILL.md" ]] && skill_dirs+=("$d")
done < <(find "$SOURCE_DIR" -mindepth 1 -maxdepth 1 -type d -print0)

if [[ ${#skill_dirs[@]} -eq 0 ]]; then
    echo "Error: no skill directories (containing SKILL.md) found in: $SOURCE_DIR" >&2
    exit 1
fi

# Counters
count_updated=0
count_new=0
count_unchanged=0

echo "Updating skills in $TARGET_DIR ..."
echo ""

for src_dir in "${skill_dirs[@]}"; do
    skill_name="$(basename "$src_dir")"
    dst_dir="$TARGET_DIR/$skill_name"

    if [[ ! -d "$dst_dir" ]]; then
        mkdir -p "$dst_dir"
        cp -r "$src_dir/." "$dst_dir/"
        printf "[new]       %s/\n" "$skill_name"
        (( count_new++ )) || true
    elif diff -rq "$src_dir" "$dst_dir" > /dev/null 2>&1; then
        printf "[unchanged] %s/\n" "$skill_name"
        (( count_unchanged++ )) || true
    else
        cp -r "$src_dir/." "$dst_dir/"
        printf "[updated]   %s/\n" "$skill_name"
        (( count_updated++ )) || true
    fi
done

echo ""
echo "${count_updated} updated, ${count_new} new, ${count_unchanged} unchanged"

# ─── Install global `pf` shim (AC-6) ──────────────────────────────────────────
# Idempotent: rewrites ~/.claude/bin/pf wholesale on every run (TC-012); no
# .bak/.old, no overwrite prompt. The shim always points at FRAMEWORK_DIR
# (where this script lives), independent of --source/consumer target. It
# intentionally does NOT inject --target "$(pwd)": cli.js defaults to
# process.cwd(), and a hardcoded --target would make `pf --target <dir>`
# silently ignored (P1-1: double --target, first-wins in parseTargetDir).
GLOBAL_BIN_DIR="$HOME/.claude/bin"
mkdir -p "$GLOBAL_BIN_DIR"
cat > "$GLOBAL_BIN_DIR/pf" <<EOF
#!/usr/bin/env sh
# Installed by Planning Framework — delegates to the onboarding TUI.
# Regenerated on every setup/update; safe to remove.
exec node "$FRAMEWORK_DIR/tools/onboarding-tui/cli.js" "\$@"
EOF
chmod +x "$GLOBAL_BIN_DIR/pf"
echo ""
echo "Installed global command: pf  ->  $GLOBAL_BIN_DIR/pf"
case ":$PATH:" in
  *":$HOME/.claude/bin:"*) ;;
  *)
    # shellcheck disable=SC2016  # literal text for the user to copy; must not expand
    echo 'warning: add to PATH: export PATH="$HOME/.claude/bin:$PATH"'
    ;;
esac
