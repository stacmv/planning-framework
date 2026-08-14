# Planning Framework v4.0 — one-command installer for Windows.
#
#   irm https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/install.ps1 | iex
#
# Clones/updates the framework (release branch `main`) into
# $HOME\.claude\planning-framework, installs the global `pf` shim (pf.cmd) and
# all skills. Re-running the same command updates the existing install in place
# (idempotent, no prompts). Requires `git` and `node` on PATH; refuses otherwise.
#
# PowerShell-native installer for the Node.js runtime (TC-016).

# Fail fast on cmdlet errors.
$ErrorActionPreference = 'Stop'

$RepoUrl    = 'https://github.com/stacmv/planning-framework.git'
$RepoBranch = 'develop-v4.0'
$InstallDir  = Join-Path $HOME '.claude\planning-framework'
$SkillsDir   = Join-Path $HOME '.claude\skills'
$BinDir      = Join-Path $HOME '.claude\bin'

# Helper: treat a non-zero git exit code as a terminating error.
function Invoke-Git {
    param([Parameter(Mandatory)][string[]]$GitArgs)
    & git @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
}

# ─── 1. Dependency checks (before any filesystem change — TC-016 step 5) ───────

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "'git' was not found on your PATH. Install it: https://git-scm.com/downloads"
    exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "'node' was not found on your PATH. Install it: https://nodejs.org/"
    exit 1
}

Write-Host 'Planning Framework v4.0 — installer'
Write-Host '===================================='
Write-Host "  git : $(& git --version)"
Write-Host "  node: $(& node --version)"
Write-Host ''

# ─── 2. Clone or update the framework (release branch `main`) ─────────────────
# `develop` is the trunk for active development; `main` is the release branch
# (created from `develop`; releases land here via develop->main merges). The
# installer pins to `main` so `irm | iex` hands out a stable release, not a
# mid-merge trunk state. `reset --hard` (not `pull --ff-only`) keeps the update
# deterministic: it never aborts on local edits, upstream force-push/rebase, or
# detached HEAD (AC-8). The clone belongs to the installer, so force-aligning
# it to the upstream is safe.

if (Test-Path (Join-Path $InstallDir '.git')) {
    Write-Host "Updating existing install at: $InstallDir"
    Invoke-Git -Args @('-C', $InstallDir, 'fetch', 'origin', $RepoBranch)
    Invoke-Git -Args @('-C', $InstallDir, 'reset', '--hard', "origin/$RepoBranch")
} else {
    Write-Host "Cloning Planning Framework (branch $RepoBranch) into: $InstallDir"
    if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
    Invoke-Git -Args @('clone', '-b', $RepoBranch, $RepoUrl, $InstallDir)
}
Write-Host ''

# ─── 3. Install skills to ~/.claude/skills/ (dynamic discovery) ───────────────
# Mirrors `node scripts/pf-cli.mjs update-skills`: every directory under skills\ that contains
# a SKILL.md is copied. No hardcoded skill list — full skill parity with the
# Linux/macOS installer (install.mjs).

Write-Host "Installing skills to: $SkillsDir"
Get-ChildItem -Path (Join-Path $InstallDir 'skills') -Directory | ForEach-Object {
    if (Test-Path (Join-Path $_.FullName 'SKILL.md')) {
        $dst = Join-Path $SkillsDir $_.Name
        New-Item -ItemType Directory -Force -Path $dst | Out-Null
        Copy-Item -Path (Join-Path $_.FullName '*') -Destination $dst -Recurse -Force
        Write-Host "  installed  $($_.Name)/"
    }
}
Write-Host ''

# ─── 4. Install global `pf` shim (pf.cmd) (AC-6) ──────────────────────────────
# Windows equivalent of the POSIX ~/.claude/bin/pf. Idempotent (wholesale
# rewrite via Set-Content, no backups). The shim does NOT inject
# --target "%CD%": cli.js defaults to process.cwd(), and a hardcoded --target
# would make `pf --target <dir>` silently ignored (P1-1: double --target,
# first-wins in parseTargetDir).

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$cliPath = Join-Path $InstallDir 'tools\onboarding-tui\cli.js'
$shimContent = "@node `"$cliPath`" %*"
Set-Content -Path (Join-Path $BinDir 'pf.cmd') -Value $shimContent -Encoding ascii
Write-Host "Installed global command: pf  ->  $(Join-Path $BinDir 'pf.cmd')"
Write-Host ''

# ─── 5. PATH check + summary ──────────────────────────────────────────────────

Write-Host 'Planning Framework v4.0 installed'
Write-Host "  Location : $InstallDir  (branch $RepoBranch)"
Write-Host "  Skills   : $SkillsDir"
Write-Host "  Command  : $(Join-Path $BinDir 'pf.cmd')"
Write-Host ''

$userPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
$pathDirs = if ($userPath) { $userPath -split ';' } else { @() }
$normalizedBin = $BinDir.TrimEnd('\')
$onPath = $false
foreach ($d in $pathDirs) {
    if ($d.TrimEnd('\') -ieq $normalizedBin) { $onPath = $true; break }
}

if ($onPath) {
    Write-Host "Next: run 'pf' from any project directory, or '/pf' in Claude Code."
} else {
    Write-Warning "$BinDir is not on your user PATH."
    Write-Host 'Add it via: System Properties > Environment Variables > Path > New,'
    Write-Host "  then add: $BinDir"
    Write-Host 'Open a new terminal afterwards, then run: pf'
}
Write-Host ''
Write-Host 'Update later by re-running this same command.'
Write-Host ''
