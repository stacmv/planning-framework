# Planning Framework v3.0 uninstaller for Windows.
#
#   irm https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/uninstall.ps1 | iex
#
# Removes only the global artifacts installed by scripts/install.ps1. It never
# removes $HOME\.claude itself, unrelated skills, or a framework directory whose
# git origin is not the official Planning Framework repository.

[CmdletBinding()]
param(
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'

$RepoUrl = 'https://github.com/stacmv/planning-framework.git'
$InstallDir = Join-Path $HOME '.claude\planning-framework'
$SkillsDir = Join-Path $HOME '.claude\skills'
$BinDir = Join-Path $HOME '.claude\bin'

if (-not $Yes) {
    $answer = Read-Host "Remove Planning Framework v3 from $HOME? [y/N]"
    if ($answer -notmatch '^(?i:y|yes)$') {
        Write-Host 'No changes made.'
        exit 0
    }
}

$managedInstall = $false
$gitConfig = Join-Path $InstallDir '.git\config'
if ((Test-Path -LiteralPath $gitConfig) -and (Select-String -LiteralPath $gitConfig -SimpleMatch $RepoUrl -Quiet)) {
    $managedInstall = $true
}

$removedSkills = 0
if ($managedInstall -and (Test-Path -LiteralPath (Join-Path $InstallDir 'skills'))) {
    Get-ChildItem -LiteralPath (Join-Path $InstallDir 'skills') -Directory | ForEach-Object {
        if (Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md')) {
            $destination = Join-Path $SkillsDir $_.Name
            if (Test-Path -LiteralPath $destination) {
                Remove-Item -LiteralPath $destination -Recurse -Force
                $script:removedSkills++
                Write-Host "Removed skill: $($_.Name)/"
            }
        }
    }
} elseif (Test-Path -LiteralPath $InstallDir) {
    Write-Warning "Preserving $InstallDir because it is not a managed PF install."
    Write-Warning 'Preserving global skills because their ownership cannot be verified.'
}

$shim = Join-Path $BinDir 'pf.cmd'
if (Test-Path -LiteralPath $shim -PathType Leaf) {
    $shimContent = Get-Content -LiteralPath $shim -Raw
    if ($shimContent.Contains('@node') -and $shimContent.Contains('onboarding-tui\cli.js')) {
        Remove-Item -LiteralPath $shim -Force
        Write-Host "Removed command: $shim"
    } else {
        Write-Warning "Preserving $shim because it is not the PF-generated shim."
    }
}

if ($managedInstall) {
    Remove-Item -LiteralPath $InstallDir -Recurse -Force
    Write-Host "Removed framework: $InstallDir"
}

Write-Host "Planning Framework v3 uninstalled. Removed $removedSkills skill directory(s)."
