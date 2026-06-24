#!/usr/bin/env bash
set -e

# Planning Framework v3.0 — Setup Script
# Installs the framework into a consumer project.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRAMEWORK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_SRC="$FRAMEWORK_DIR/skills"
TEMPLATES_SRC="$FRAMEWORK_DIR/docs/planning/templates"
GLOBAL_SKILLS_DIR="$HOME/.claude/skills"

# ─── 1. Prompt for target directory ───────────────────────────────────────────

DEFAULT_TARGET="$(pwd)"
echo ""
echo "Planning Framework v3.0 — Setup"
echo "================================"
echo ""
read -rp "Target project directory [${DEFAULT_TARGET}]: " TARGET_INPUT
TARGET="${TARGET_INPUT:-$DEFAULT_TARGET}"

# Resolve to absolute path
TARGET="$(cd "$TARGET" 2>/dev/null && pwd)" || {
  echo "Error: directory '$TARGET_INPUT' does not exist."
  exit 1
}

# ─── 2. Confirm before proceeding ─────────────────────────────────────────────

echo ""
echo "Will install Planning Framework v3.0 into:"
echo "  Project : $TARGET"
echo "  Skills  : $GLOBAL_SKILLS_DIR (global, available in all projects)"
echo ""
read -rp "Proceed? [Y/n]: " CONFIRM
CONFIRM="${CONFIRM:-Y}"
case "$CONFIRM" in
  [Yy]*) ;;
  *)
    echo "Aborted."
    exit 0
    ;;
esac

echo ""

# ─── 3. Create project directory structure ────────────────────────────────────

for dir in \
  "$TARGET/docs/issues/open" \
  "$TARGET/docs/issues/closed" \
  "$TARGET/docs/planning"
do
  if [ ! -d "$dir" ]; then
    mkdir -p "$dir"
    echo "  created  $dir"
  else
    echo "  exists   $dir"
  fi
done

# ─── 4. Install skills to ~/.claude/skills/ ───────────────────────────────────

echo ""
echo "Installing skills to $GLOBAL_SKILLS_DIR ..."

SKILLS=(pf pf-brd pf-spec pf-check pf-test-plan pf-impl-plan pf-execute)

for skill in "${SKILLS[@]}"; do
  src="$SKILLS_SRC/$skill"
  dst="$GLOBAL_SKILLS_DIR/$skill"
  if [ ! -d "$src" ]; then
    echo "  WARNING: source skill not found: $src"
    continue
  fi
  mkdir -p "$dst"
  cp -r "$src/." "$dst/"
  echo "  installed  $skill/"
done

# ─── 5. Copy planning templates ───────────────────────────────────────────────

echo ""
echo "Copying templates..."

TEMPLATES_DST="$TARGET/docs/planning/templates"
mkdir -p "$TEMPLATES_DST"
cp -r "$TEMPLATES_SRC/." "$TEMPLATES_DST/"
echo "  copied   docs/planning/templates/"

# ─── 6. Initialize global planning docs (skip if already present) ─────────────

echo ""
echo "Initializing global planning docs..."

GLOBAL_TMPL="$TEMPLATES_SRC/global"

for filename in "session-log.md" "decisions.md" "implementation-plan.md"; do
  dst="$TARGET/docs/planning/$filename"
  src="$GLOBAL_TMPL/$filename"
  if [ -f "$dst" ]; then
    echo "  exists   docs/planning/$filename  (skipped)"
  elif [ -f "$src" ]; then
    cp "$src" "$dst"
    echo "  created  docs/planning/$filename"
  else
    echo "  WARNING: template not found: $src"
  fi
done

# ─── 7. Success summary ───────────────────────────────────────────────────────

echo ""
echo "✓ Planning Framework v3.0 installed"
echo "  Project : $TARGET"
echo "  Skills  : $GLOBAL_SKILLS_DIR"
echo ""
echo "Available skills (global, all projects):"
echo "  /pf           — show current issue status and next step"
echo "  /pf-brd       — create Business Requirements Document"
echo "  /pf-spec      — create technical specification"
echo "  /pf-check     — review document for issues"
echo "  /pf-test-plan — create test plan"
echo "  /pf-impl-plan — create implementation plan"
echo "  /pf-execute   — execute implementation plan"
echo ""
echo "Next: Open Claude Code in your project and run /pf"
echo ""
