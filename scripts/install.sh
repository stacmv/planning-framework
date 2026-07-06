#!/usr/bin/env bash
set -e

# Planning Framework — One-command installer (Linux/macOS)
#
#   curl -fsSL https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/install.sh | sh
#
# Clones (or updates) the framework itself into ~/.claude/planning-framework,
# then delegates skill/shim installation to the framework's own
# update-skills.sh (which already installs both the skills and the global
# `pf` shim as of this change) — no logic is duplicated here.

REPO_URL="https://github.com/stacmv/planning-framework.git"
INSTALL_DIR="$HOME/.claude/planning-framework"

# ─── 1. Check dependencies ─────────────────────────────────────────────────

missing=""
command -v git >/dev/null 2>&1 || missing="${missing}git "
command -v node >/dev/null 2>&1 || missing="${missing}node "

if [ -n "$missing" ]; then
  echo "Error: missing required dependency: $missing" >&2
  echo "" >&2
  echo "Install the missing tool(s) first:" >&2
  case "$missing" in
    *git*) echo "  git  - https://git-scm.com/downloads" >&2 ;;
  esac
  case "$missing" in
    *node*) echo "  node - https://nodejs.org/" >&2 ;;
  esac
  exit 1
fi

# ─── 2. Clone or update the framework itself ───────────────────────────────

echo "Planning Framework — Installer"
echo "==============================="
echo ""

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing installation in $INSTALL_DIR ..."
  git -C "$INSTALL_DIR" pull --ff-only
else
  echo "Cloning Planning Framework into $INSTALL_DIR ..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

# ─── 3. Install skills + global `pf` shim ──────────────────────────────────

echo ""
bash "$INSTALL_DIR/scripts/update-skills.sh"

# ─── 4. Success summary ────────────────────────────────────────────────────

echo ""
echo "✓ Planning Framework installed"
echo "  Framework : $INSTALL_DIR"
echo ""
echo "Next: run 'pf' in any project directory to get started."
