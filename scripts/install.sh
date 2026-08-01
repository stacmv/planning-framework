#!/usr/bin/env sh
#
# Planning Framework v4.0 — one-command installer for Linux/macOS.
#
#   curl -fsSL https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/install.sh | sh
#
# Clones/updates the framework (release branch `main`) into
# ~/.claude/planning-framework, installs the global `pf` shim and all skills.
# Re-running the same command updates the existing install in place (idempotent,
# no prompts). Requires `git` and `node` on PATH; refuses otherwise.
#
# Written in POSIX sh (not bash) so it runs correctly under `curl | sh`,
# where the interpreter is whatever `sh` is on the host (dash on Debian, etc.).
# The shebang above is only honored when the file is executed directly.

set -e

REPO_URL="https://github.com/stacmv/planning-framework.git"
REPO_BRANCH="main"
INSTALL_DIR="$HOME/.claude/planning-framework"
GLOBAL_SKILLS_DIR="$HOME/.claude/skills"
GLOBAL_BIN_DIR="$HOME/.claude/bin"

# ─── 1. Dependency checks (before any filesystem change — TC-015) ─────────────

if ! command -v git >/dev/null 2>&1; then
  echo "Error: 'git' was not found on your PATH." >&2
  echo "       Install git: https://git-scm.com/downloads" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Error: 'node' was not found on your PATH." >&2
  echo "       Install Node.js: https://nodejs.org/" >&2
  exit 1
fi

echo "Planning Framework v4.0 — installer"
echo "===================================="
echo "  git : $(git --version 2>/dev/null || echo 'unknown')"
echo "  node: $(node --version 2>/dev/null || echo 'unknown')"
echo ""

# ─── 2. Clone or update the framework (release branch `main`) ─────────────────
# `develop` is the trunk for active development; `main` is the release branch
# (created from `develop`, releases land here via develop→main merges). The
# installer pins to `main` so `curl|sh` hands out a stable release, not a
# mid-merge trunk state. `reset --hard` (not `pull --ff-only`) keeps the
# update deterministic under `set -e`: it never aborts on local edits,
# upstream force-push/rebase, or detached HEAD (AC-8). The clone belongs to
# the installer, so force-aligning it to the upstream is safe.

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing install at: $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch origin "$REPO_BRANCH"
  git -C "$INSTALL_DIR" reset --hard "origin/$REPO_BRANCH"
else
  echo "Cloning Planning Framework (branch $REPO_BRANCH) into: $INSTALL_DIR"
  rm -rf "$INSTALL_DIR"
  git clone -b "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi
echo ""

# ─── 3. Install skills to ~/.claude/skills/ (dynamic discovery) ───────────────
# Mirrors scripts/update-skills.sh: every directory under skills/ that
# contains a SKILL.md is copied. No hardcoded skill list — so all current
# skills are installed and future ones are picked up automatically. This is
# the same discovery install.ps1 and converge scripts use, giving full skill
# parity across platforms.
#
# install.sh installs the framework ITSELF (clone + skills + `pf` shim); it
# writes nothing into a consumer project. Onboarding a project is a separate,
# explicit step: `pf` (the TUI) or `converge-to-v4.sh`.

echo "Installing skills to: $GLOBAL_SKILLS_DIR"
for src in "$INSTALL_DIR"/skills/*/; do
  [ -d "$src" ] || continue          # glob-no-match yields the literal pattern
  [ -f "${src}SKILL.md" ] || continue
  skill_name=$(basename "$src")
  dst="$GLOBAL_SKILLS_DIR/$skill_name"
  mkdir -p "$dst"
  cp -r "${src}." "$dst/"
  echo "  installed  $skill_name/"
done
echo ""

# ─── 4. Install global `pf` shim (AC-6) ───────────────────────────────────────
# Same template as update-skills.sh / converge scripts, with
# <FRAMEWORK_ROOT> = $INSTALL_DIR. Idempotent (wholesale rewrite, no backups).
# The shim does NOT inject --target "$(pwd)": cli.js defaults to process.cwd(),
# and a hardcoded --target would make `pf --target <dir>` silently ignored
# (P1-1: double --target, first-wins in parseTargetDir).

mkdir -p "$GLOBAL_BIN_DIR"
cat > "$GLOBAL_BIN_DIR/pf" <<EOF
#!/usr/bin/env sh
# Installed by Planning Framework — delegates to the onboarding TUI.
# Regenerated on every install/update; safe to remove.
exec node "$INSTALL_DIR/tools/onboarding-tui/cli.js" "\$@"
EOF
chmod +x "$GLOBAL_BIN_DIR/pf"
echo "Installed global command: pf  ->  $GLOBAL_BIN_DIR/pf"
echo ""

# ─── 5. PATH check + summary ──────────────────────────────────────────────────

echo "✓ Planning Framework v4.0 installed"
echo "  Location : $INSTALL_DIR  (branch $REPO_BRANCH)"
echo "  Skills   : $GLOBAL_SKILLS_DIR"
echo "  Command  : $GLOBAL_BIN_DIR/pf"
echo ""
case ":$PATH:" in
  *":$HOME/.claude/bin:"*)
    echo "Next: run 'pf' from any project directory, or '/pf' in Claude Code."
    ;;
  *)
    echo "$GLOBAL_BIN_DIR is not on your PATH. Add it, then run 'pf':"
    # shellcheck disable=SC2016  # literal text for the user to copy; must not expand
    echo '  export PATH="$HOME/.claude/bin:$PATH"'
    echo ""
    echo "(Add that line to your ~/.bashrc, ~/.zshrc, or equivalent to make it permanent.)"
    ;;
esac
echo ""
echo "Update later by re-running this same command."
echo ""
