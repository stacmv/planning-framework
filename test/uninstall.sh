#!/usr/bin/env bash
# PF3 global uninstaller: removal is isolated under a fresh temporary HOME.

set -euo pipefail

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

printf '=== PF3 uninstaller\n'

TMP_HOME="$(pf_mktemp_d)"
install_dir="$TMP_HOME/.claude/planning-framework"
skills_dir="$TMP_HOME/.claude/skills"
bin_dir="$TMP_HOME/.claude/bin"
mkdir -p "$install_dir" "$skills_dir" "$bin_dir"

cp -a "$REPO_ROOT/skills" "$install_dir/skills"
git -C "$install_dir" init -q
git -C "$install_dir" remote add origin https://github.com/stacmv/planning-framework.git

while IFS= read -r skill; do
  name="$(basename "$skill")"
  cp -a "$skill" "$skills_dir/$name"
done < <(find "$REPO_ROOT/skills" -mindepth 1 -maxdepth 1 -type d | LC_ALL=C sort)
mkdir -p "$skills_dir/personal"
printf '%s\n' 'personal skill' > "$skills_dir/personal/SKILL.md"
printf '%s\n' '#!/usr/bin/env sh' '# Installed by Planning Framework - delegates to the onboarding TUI.' "exec node \"$install_dir/tools/onboarding-tui/cli.js\" \"\$@\"" > "$bin_dir/pf"
printf '%s\n' 'unrelated command' > "$bin_dir/other"

pf_run_uninstall "$REPO_ROOT" --yes

pf_assert 'managed framework clone is removed' test ! -e "$install_dir"
pf_assert 'PF command shim is removed' test ! -e "$bin_dir/pf"
pf_assert 'unrelated command is preserved' test -f "$bin_dir/other"
pf_assert 'unrelated skill is preserved' test -f "$skills_dir/personal/SKILL.md"

leftover_skills=()
while IFS= read -r skill; do
  name="$(basename "$skill")"
  [ -e "$skills_dir/$name" ] && leftover_skills+=("$name")
done < <(find "$REPO_ROOT/skills" -mindepth 1 -maxdepth 1 -type d | LC_ALL=C sort)
if [ "${#leftover_skills[@]}" -eq 0 ]; then
  pf_pass 'all PF skill directories are removed'
else
  pf_fail "PF skill directories remain: ${leftover_skills[*]}"
fi

TMP_HOME="$(pf_mktemp_d)"
install_dir="$TMP_HOME/.claude/planning-framework"
skills_dir="$TMP_HOME/.claude/skills"
mkdir -p "$install_dir/skills/pf" "$skills_dir/pf"
printf '%s\n' 'foreign skill' > "$skills_dir/pf/SKILL.md"
printf '%s\n' '[remote "origin"]' '    url = https://example.com/not-pf.git' > "$install_dir/.git-config"
mkdir -p "$install_dir/.git"
mv "$install_dir/.git-config" "$install_dir/.git/config"

pf_run_uninstall "$REPO_ROOT" --yes

pf_assert 'foreign framework directory is preserved' test -d "$install_dir"
pf_assert 'skills are preserved when framework ownership is unknown' test -f "$skills_dir/pf/SKILL.md"

pf_summary
