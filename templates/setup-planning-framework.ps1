# Setup Planning Framework (PowerShell)
# Usage: .\setup-planning-framework.ps1 [-ProjectPath "."] [-ProjectName "MyProject"]

param(
    [string]$ProjectPath = ".",
    [string]$ProjectName = "MyProject"
)

$ErrorActionPreference = "Stop"

# Colors
$ColorBlue = "Blue"
$ColorGreen = "Green"
$ColorYellow = "Yellow"
$ColorRed = "Red"

$CurrentDate = Get-Date -Format "yyyy-MM-dd"

Write-Host "========================================" -ForegroundColor $ColorBlue
Write-Host "Planning Framework Setup" -ForegroundColor $ColorBlue
Write-Host "========================================" -ForegroundColor $ColorBlue
Write-Host ""
Write-Host "Project Path: " -NoNewline
Write-Host $ProjectPath -ForegroundColor $ColorGreen
Write-Host "Project Name: " -NoNewline
Write-Host $ProjectName -ForegroundColor $ColorGreen
Write-Host "Date: " -NoNewline
Write-Host $CurrentDate -ForegroundColor $ColorGreen
Write-Host ""

# Verify script is run from templates directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path "$ScriptDir\prd-template.md")) {
    Write-Host "Error: Script must be run from the templates directory" -ForegroundColor $ColorRed
    Write-Host "Templates not found at: $ScriptDir" -ForegroundColor $ColorRed
    exit 1
}

# Create target directory structure
Write-Host "Creating directory structure..." -ForegroundColor $ColorYellow
New-Item -Path "$ProjectPath\docs\planning" -ItemType Directory -Force | Out-Null

# Check if files already exist
if (Test-Path "$ProjectPath\docs\prd.md") {
    Write-Host "Warning: Files already exist in target directory" -ForegroundColor $ColorYellow
    $response = Read-Host "Overwrite existing files? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Aborted" -ForegroundColor $ColorRed
        exit 1
    }
}

# Function to copy and customize template
function Copy-CustomizedTemplate {
    param(
        [string]$SourceFile,
        [string]$TargetFile,
        [string]$ProjectName,
        [string]$CurrentDate
    )

    $content = Get-Content $SourceFile -Raw
    $content = $content -replace '\[Project Name\]', $ProjectName
    $content = $content -replace 'YYYY-MM-DD', $CurrentDate
    Set-Content -Path $TargetFile -Value $content
}

# Copy and customize templates
Write-Host "Copying templates..." -ForegroundColor $ColorYellow

# PRD
Write-Host "  - docs/prd.md"
Copy-CustomizedTemplate -SourceFile "$ScriptDir\prd-template.md" `
                        -TargetFile "$ProjectPath\docs\prd.md" `
                        -ProjectName $ProjectName `
                        -CurrentDate $CurrentDate

# Implementation Plan
Write-Host "  - docs/planning/implementation-plan.md"
Copy-CustomizedTemplate -SourceFile "$ScriptDir\implementation-plan-template.md" `
                        -TargetFile "$ProjectPath\docs\planning\implementation-plan.md" `
                        -ProjectName $ProjectName `
                        -CurrentDate $CurrentDate

# Session Log
Write-Host "  - docs/planning/session-log.md"
Copy-CustomizedTemplate -SourceFile "$ScriptDir\session-log-template.md" `
                        -TargetFile "$ProjectPath\docs\planning\session-log.md" `
                        -ProjectName $ProjectName `
                        -CurrentDate $CurrentDate

# Decisions
Write-Host "  - docs/planning/decisions.md"
Copy-CustomizedTemplate -SourceFile "$ScriptDir\decisions-template.md" `
                        -TargetFile "$ProjectPath\docs\planning\decisions.md" `
                        -ProjectName $ProjectName `
                        -CurrentDate $CurrentDate

# Framework documentation
Write-Host "  - docs/planning/FRAMEWORK.md"
Copy-Item "$ScriptDir\..\FRAMEWORK.md" "$ProjectPath\docs\planning\FRAMEWORK.md" -Force

# CLAUDE.md integration
Write-Host ""
Write-Host "Setting up CLAUDE.md..." -ForegroundColor $ColorYellow
if (Test-Path "$ProjectPath\CLAUDE.md") {
    Write-Host "CLAUDE.md already exists" -ForegroundColor $ColorYellow
    $response = Read-Host "Append planning framework instructions? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        $claudeInstructions = Get-Content "$ScriptDir\claude-instructions.md" -Raw
        Add-Content -Path "$ProjectPath\CLAUDE.md" -Value "`n`n# ========================================`n# Planning Framework Integration`n# ========================================`n`n$claudeInstructions"
        Write-Host "✓ Appended to CLAUDE.md" -ForegroundColor $ColorGreen
    }
} else {
    $claudeInstructions = Get-Content "$ScriptDir\claude-instructions.md" -Raw
    Set-Content -Path "$ProjectPath\CLAUDE.md" -Value "# CLAUDE.md`n`nThis file provides guidance to Claude Code when working with this repository.`n`n$claudeInstructions"
    Write-Host "✓ Created CLAUDE.md" -ForegroundColor $ColorGreen
}

# Update .gitignore if it exists
if (Test-Path "$ProjectPath\.gitignore") {
    $gitignoreContent = Get-Content "$ProjectPath\.gitignore" -Raw
    if ($gitignoreContent -notlike "*# Planning Framework*") {
        Add-Content -Path "$ProjectPath\.gitignore" -Value "`n# Planning Framework - Keep these files versioned`n# docs/prd.md`n# docs/planning/"
        Write-Host "✓ Updated .gitignore" -ForegroundColor $ColorGreen
    }
}

# Create initial git commit if in git repo
if (Test-Path "$ProjectPath\.git") {
    Write-Host ""
    $response = Read-Host "Create git commit for planning framework? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        Push-Location $ProjectPath
        try {
            git add docs/planning/ docs/prd.md CLAUDE.md 2>$null
            git commit -m "Initialize planning framework

- Add PRD template
- Add implementation plan template
- Add session log template
- Add architecture decisions log template
- Integrate with CLAUDE.md

Planning framework version: 1.0
Date: $CurrentDate" 2>$null
            Write-Host "✓ Git commit created" -ForegroundColor $ColorGreen
        } catch {
            Write-Host "Note: Some files may already be committed" -ForegroundColor $ColorYellow
        }
        Pop-Location
    }
}

# Print next steps
Write-Host ""
Write-Host "========================================" -ForegroundColor $ColorBlue
Write-Host "✓ Planning Framework Setup Complete" -ForegroundColor $ColorGreen
Write-Host "========================================" -ForegroundColor $ColorBlue
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor $ColorYellow
Write-Host ""
Write-Host "1. Customize the PRD:"
Write-Host "   edit $ProjectPath\docs\prd.md" -ForegroundColor $ColorBlue
Write-Host ""
Write-Host "2. Define your implementation plan:"
Write-Host "   edit $ProjectPath\docs\planning\implementation-plan.md" -ForegroundColor $ColorBlue
Write-Host ""
Write-Host "3. Start your first development session:"
Write-Host "   # Read the planning docs" -ForegroundColor $ColorBlue
Write-Host "   Get-Content $ProjectPath\docs\planning\session-log.md -Tail 50" -ForegroundColor $ColorBlue
Write-Host ""
Write-Host "4. Let Claude Code know about your project:"
Write-Host "   # Claude will automatically read CLAUDE.md" -ForegroundColor $ColorBlue
Write-Host ""
Write-Host "Documentation:" -ForegroundColor $ColorYellow
Write-Host "   See $ProjectPath\docs\planning\FRAMEWORK.md for detailed guide" -ForegroundColor $ColorBlue
Write-Host ""
Write-Host "Happy coding!" -ForegroundColor $ColorGreen
