# Planning Framework — One-command installer (Windows)
#
#   irm https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/install.ps1 | iex
#
# Clones (or updates) the framework itself into ~/.claude/planning-framework,
# then installs skills + the global `pf` shim. Mirrors install.sh's steps and
# uses the same dynamic skill-discovery approach (every directory under
# skills/ containing a SKILL.md) so both platforms end up with an identical
# skill set — no hardcoded list to keep in sync.

$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/stacmv/planning-framework.git"
$InstallDir = Join-Path $HOME ".claude\planning-framework"
$GlobalSkillsDir = Join-Path $HOME ".claude\skills"
$GlobalBinDir = Join-Path $HOME ".claude\bin"

Write-Host "Planning Framework - Installer"
Write-Host "==============================="
Write-Host ""

# --- 1. Check dependencies -------------------------------------------------

$missing = @()
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { $missing += "git" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "node" }

if ($missing.Count -gt 0) {
    Write-Error "Missing required dependency: $($missing -join ', ')"
    if ($missing -contains "git") { Write-Host "  git  - https://git-scm.com/downloads" }
    if ($missing -contains "node") { Write-Host "  node - https://nodejs.org/" }
    exit 1
}

# --- 2. Clone or update the framework itself -------------------------------

if (Test-Path (Join-Path $InstallDir ".git")) {
    Write-Host "Updating existing installation in $InstallDir ..."
    git -C $InstallDir pull --ff-only
} else {
    Write-Host "Cloning Planning Framework into $InstallDir ..."
    New-Item -ItemType Directory -Force -Path (Split-Path $InstallDir -Parent) | Out-Null
    git clone $RepoUrl $InstallDir
}

# --- 3. Install skills (dynamic discovery, mirrors update-skills.sh) ------

Write-Host ""
Write-Host "Updating skills in $GlobalSkillsDir ..."
Write-Host ""

New-Item -ItemType Directory -Force -Path $GlobalSkillsDir | Out-Null
$skillsSrc = Join-Path $InstallDir "skills"
$skillDirs = Get-ChildItem -Path $skillsSrc -Directory | Where-Object {
    Test-Path (Join-Path $_.FullName "SKILL.md")
}

foreach ($dir in $skillDirs) {
    $dst = Join-Path $GlobalSkillsDir $dir.Name
    Copy-Item -Path (Join-Path $dir.FullName "*") -Destination $dst -Recurse -Force -Container
    Write-Host "  installed  $($dir.Name)/"
}

# --- 4. Install global `pf` shim -------------------------------------------

New-Item -ItemType Directory -Force -Path $GlobalBinDir | Out-Null
$cliPath = Join-Path $InstallDir "tools\onboarding-tui\cli.js"
$shimPath = Join-Path $GlobalBinDir "pf.cmd"

Set-Content -Path $shimPath -Value "@echo off`r`nnode `"$cliPath`" --target `"%CD%`" %*" -NoNewline

Write-Host ""
Write-Host "installed $shimPath"

$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if (-not ($userPath -split ";" | Where-Object { $_ -eq $GlobalBinDir })) {
    Write-Host "NOTE: $GlobalBinDir is not on your PATH."
    Write-Host "      Add it via System Properties > Environment Variables, or run:"
    Write-Host "      [Environment]::SetEnvironmentVariable('PATH', `"`$env:PATH;$GlobalBinDir`", 'User')"
}

# --- 5. Success summary -----------------------------------------------------

Write-Host ""
Write-Host "Planning Framework installed"
Write-Host "  Framework : $InstallDir"
Write-Host ""
Write-Host "Next: run 'pf' in any project directory to get started."
