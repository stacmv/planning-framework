#!/usr/bin/env sh
# Planning Framework v3.0 uninstaller for Linux/macOS.
#
#   curl -fsSL https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/uninstall.sh | sh
#
# Removes only the global artifacts installed by scripts/install.sh. It never
# removes ~/.claude itself, unrelated skills, or a framework directory whose
# git origin is not the official Planning Framework repository.

set -e

REPO_URL="https://github.com/stacmv/planning-framework.git"
INSTALL_DIR="$HOME/.claude/planning-framework"
GLOBAL_SKILLS_DIR="$HOME/.claude/skills"
GLOBAL_BIN_DIR="$HOME/.claude/bin"
ASSUME_YES=0

usage() {
  cat <<'EOF'
Usage: uninstall.sh [--yes]

  --yes    Remove without an interactive confirmation prompt.
EOF
}

case "${1:-}" in
  "") ;;
  --yes) ASSUME_YES=1 ;;
  --help|-h) usage; exit 0 ;;
  *) echo "Error: unknown option: $1" >&2; usage >&2; exit 2 ;;
esac

if [ "$ASSUME_YES" -ne 1 ]; then
  printf 'Remove Planning Framework v3 from %s? [y/N] ' "$HOME"
  IFS= read -r answer || answer=""
  case "$answer" in
    y|Y|yes|YES) ;;
    *) echo "No changes made."; exit 0 ;;
  esac
fi

is_managed_install=0
if [ -f "$INSTALL_DIR/.git/config" ] && grep -Fq "$REPO_URL" "$INSTALL_DIR/.git/config"; then
  is_managed_install=1
fi

removed_skills=0
if [ "$is_managed_install" -eq 1 ] && [ -d "$INSTALL_DIR/skills" ]; then
  for src in "$INSTALL_DIR"/skills/*/; do
    [ -d "$src" ] || continue
    [ -f "${src}SKILL.md" ] || continue
    skill_name=$(basename "$src")
    dst="$GLOBAL_SKILLS_DIR/$skill_name"
    if [ -d "$dst" ]; then
      rm -rf "$dst"
      removed_skills=$((removed_skills + 1))
      echo "Removed skill: $skill_name/"
    fi
  done
elif [ -d "$INSTALL_DIR" ]; then
  echo "Warning: preserving $INSTALL_DIR because it is not a managed PF install." >&2
  echo "Warning: preserving global skills because their ownership cannot be verified." >&2
fi

shim="$GLOBAL_BIN_DIR/pf"
if [ -f "$shim" ]; then
  if grep -Fq 'Installed by Planning Framework' "$shim" && grep -Fq 'onboarding-tui/cli.js' "$shim"; then
    rm -f "$shim"
    echo "Removed command: $shim"
  else
    echo "Warning: preserving $shim because it is not the PF-generated shim." >&2
  fi
fi

if [ "$is_managed_install" -eq 1 ]; then
  rm -rf "$INSTALL_DIR"
  echo "Removed framework: $INSTALL_DIR"
fi

echo "Planning Framework v3 uninstalled. Removed $removed_skills skill directory(s)."
