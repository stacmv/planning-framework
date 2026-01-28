#!/usr/bin/env bash
# Planning Framework v2.0 - Interactive Setup Script
# Creates folder structure and initializes framework for new projects

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory (where templates are located)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRAMEWORK_ROOT="$(dirname "$SCRIPT_DIR")"
TEMPLATE_DIR="$FRAMEWORK_ROOT/docs/planning/templates"
SCRIPTS_SOURCE="$SCRIPT_DIR"

# Check if templates exist
if [ ! -d "$TEMPLATE_DIR" ]; then
    echo -e "${RED}Error: Templates directory not found at $TEMPLATE_DIR${NC}"
    echo "Please run this script from the planning-framework repository."
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Planning Framework v2.0 - Interactive Setup           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# 1. Collect Configuration
# ============================================================================

echo -e "${YELLOW}Let's set up Planning Framework v2.0 for your project.${NC}"
echo ""

# Project name
read -p "Project name: " PROJECT_NAME
if [ -z "$PROJECT_NAME" ]; then
    PROJECT_NAME="MyProject"
    echo -e "${YELLOW}Using default: $PROJECT_NAME${NC}"
fi

# Issue types
echo ""
echo "Issue types (comma-separated):"
echo -e "${BLUE}Default: feat,bug,improve${NC}"
read -p "Issue types [Enter for default]: " ISSUE_TYPES
if [ -z "$ISSUE_TYPES" ]; then
    ISSUE_TYPES="feat,bug,improve"
fi

# QA requirements
echo ""
echo "Enable QA checks (select all that apply):"
echo "  1) Linting/formatting"
echo "  2) Unit tests"
echo "  3) Integration tests"
echo "  4) Documentation updates"
echo "  5) Security audit"
read -p "QA checks (e.g., 1,2,4) [Enter for all]: " QA_CHECKS
if [ -z "$QA_CHECKS" ]; then
    QA_CHECKS="1,2,3,4,5"
fi

# Agent preference
echo ""
echo "Primary AI agent(s):"
echo "  1) Claude Code"
echo "  2) Gemini CLI"
echo "  3) Qwen Code"
echo "  4) All / Multiple"
read -p "Agent [1-4, default 4]: " AGENT_CHOICE
if [ -z "$AGENT_CHOICE" ]; then
    AGENT_CHOICE="4"
fi

case $AGENT_CHOICE in
    1) AGENT_NAME="Claude Code" ;;
    2) AGENT_NAME="Gemini CLI" ;;
    3) AGENT_NAME="Qwen Code" ;;
    *) AGENT_NAME="All agents" ;;
esac

# Confirm
echo ""
echo -e "${GREEN}Configuration Summary:${NC}"
echo "  Project: $PROJECT_NAME"
echo "  Issue types: $ISSUE_TYPES"
echo "  QA checks: $QA_CHECKS"
echo "  Agent: $AGENT_NAME"
echo ""
read -p "Proceed with setup? [Y/n] " CONFIRM
if [[ "$CONFIRM" =~ ^[Nn] ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}Setting up Planning Framework v2.0...${NC}"
echo ""

# ============================================================================
# 2. Create Folder Structure
# ============================================================================

echo -e "${BLUE}[1/7]${NC} Creating folder structure..."

mkdir -p planning/issues/open
mkdir -p planning/issues/closed
mkdir -p planning/scripts
mkdir -p planning/templates

echo -e "${GREEN}✓${NC} Folders created"

# ============================================================================
# 3. Copy Scripts
# ============================================================================

echo -e "${BLUE}[2/7]${NC} Copying helper scripts..."

# Copy helper scripts to project
for script in create-issue.sh close-issue.sh issue-status.sh; do
    if [ -f "$SCRIPTS_SOURCE/$script" ]; then
        cp "$SCRIPTS_SOURCE/$script" "planning/scripts/$script"
        chmod +x "planning/scripts/$script"
        echo -e "${GREEN}✓${NC} $script copied"
    else
        echo -e "${YELLOW}⚠${NC} $script not found, skipping"
    fi
done

# Update script paths to work from new location
# Scripts now expect templates at ../templates/ (relative to planning/scripts/)
if [ -f "planning/scripts/create-issue.sh" ]; then
    sed -i 's|TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")/docs/planning/templates"|TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")/templates"|g' "planning/scripts/create-issue.sh"
    sed -i 's|docs/issues/|planning/issues/|g' "planning/scripts/create-issue.sh"
fi

if [ -f "planning/scripts/close-issue.sh" ]; then
    sed -i 's|docs/issues/|planning/issues/|g' "planning/scripts/close-issue.sh"
    sed -i 's|docs/planning/|planning/|g' "planning/scripts/close-issue.sh"
fi

if [ -f "planning/scripts/issue-status.sh" ]; then
    sed -i 's|docs/issues/|planning/issues/|g' "planning/scripts/issue-status.sh"
fi

# ============================================================================
# 4. Copy Templates
# ============================================================================

echo -e "${BLUE}[3/7]${NC} Copying templates..."

# Copy all templates to project for reference
cp -r "$TEMPLATE_DIR"/* "planning/templates/"
echo -e "${GREEN}✓${NC} Templates copied"

# ============================================================================
# 5. Copy and Customize PLANNING.md
# ============================================================================

echo -e "${BLUE}[4/7]${NC} Creating PLANNING.md..."

if [ -f "PLANNING.md" ]; then
    echo -e "${YELLOW}Warning: PLANNING.md already exists. Creating PLANNING.md.new${NC}"
    OUTPUT_FILE="PLANNING.md.new"
else
    OUTPUT_FILE="PLANNING.md"
fi

cp "$TEMPLATE_DIR/config/PLANNING.md" "$OUTPUT_FILE"

# Replace placeholders
CURRENT_DATE=$(date +%Y-%m-%d)
sed -i "s/\[Project Name\]/$PROJECT_NAME/g" "$OUTPUT_FILE"
sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" "$OUTPUT_FILE"

# Update paths in PLANNING.md to new structure
sed -i 's|docs/issues/|planning/issues/|g' "$OUTPUT_FILE"
sed -i 's|docs/planning/|planning/|g' "$OUTPUT_FILE"

echo -e "${GREEN}✓${NC} PLANNING.md created"

# ============================================================================
# 6. Copy and Customize .qa-workflow.md
# ============================================================================

echo -e "${BLUE}[5/7]${NC} Creating .qa-workflow.md..."

if [ -f ".qa-workflow.md" ]; then
    echo -e "${YELLOW}Warning: .qa-workflow.md already exists. Creating .qa-workflow.md.new${NC}"
    QA_OUTPUT_FILE=".qa-workflow.md.new"
else
    QA_OUTPUT_FILE=".qa-workflow.md"
fi

cp "$TEMPLATE_DIR/config/.qa-workflow.md" "$QA_OUTPUT_FILE"

# Replace placeholders
sed -i "s/\[Project Name\]/$PROJECT_NAME/g" "$QA_OUTPUT_FILE"
sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" "$QA_OUTPUT_FILE"

echo -e "${GREEN}✓${NC} .qa-workflow.md created"

# ============================================================================
# 7. Initialize Global Planning Files
# ============================================================================

echo -e "${BLUE}[6/7]${NC} Initializing global planning files..."

# implementation-plan.md
if [ ! -f "planning/implementation-plan.md" ]; then
    cp "$TEMPLATE_DIR/global/implementation-plan.md" "planning/implementation-plan.md"
    sed -i "s/\[Project Name\]/$PROJECT_NAME/g" "planning/implementation-plan.md"
    sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" "planning/implementation-plan.md"
    sed -i 's|docs/issues/|planning/issues/|g' "planning/implementation-plan.md"
    echo -e "${GREEN}✓${NC} implementation-plan.md created"
else
    echo -e "${YELLOW}⚠${NC} implementation-plan.md already exists, skipping"
fi

# session-log.md
if [ ! -f "planning/session-log.md" ]; then
    cp "$TEMPLATE_DIR/global/session-log.md" "planning/session-log.md"
    sed -i "s/\[Project Name\]/$PROJECT_NAME/g" "planning/session-log.md"
    sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" "planning/session-log.md"
    sed -i 's|docs/issues/|planning/issues/|g' "planning/session-log.md"
    echo -e "${GREEN}✓${NC} session-log.md created"
else
    echo -e "${YELLOW}⚠${NC} session-log.md already exists, skipping"
fi

# decisions.md
if [ ! -f "planning/decisions.md" ]; then
    cp "$TEMPLATE_DIR/global/decisions.md" "planning/decisions.md"
    sed -i "s/\[Project Name\]/$PROJECT_NAME/g" "planning/decisions.md"
    sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" "planning/decisions.md"
    echo -e "${GREEN}✓${NC} decisions.md created"
else
    echo -e "${YELLOW}⚠${NC} decisions.md already exists, skipping"
fi

# Copy FRAMEWORK.md guide
if [ ! -f "planning/FRAMEWORK.md" ]; then
    if [ -f "$FRAMEWORK_ROOT/docs/planning/FRAMEWORK.md" ]; then
        cp "$FRAMEWORK_ROOT/docs/planning/FRAMEWORK.md" "planning/FRAMEWORK.md"
        # Update paths in FRAMEWORK.md
        sed -i 's|docs/issues/|planning/issues/|g' "planning/FRAMEWORK.md"
        sed -i 's|docs/planning/|planning/|g' "planning/FRAMEWORK.md"
        echo -e "${GREEN}✓${NC} FRAMEWORK.md copied"
    else
        echo -e "${YELLOW}⚠${NC} FRAMEWORK.md not found in source, skipping"
    fi
else
    echo -e "${YELLOW}⚠${NC} FRAMEWORK.md already exists, skipping"
fi

# ============================================================================
# 8. Create .gitignore entries (optional)
# ============================================================================

echo -e "${BLUE}[7/7]${NC} Checking .gitignore..."

if [ -f ".gitignore" ]; then
    if ! grep -q "# Planning Framework" .gitignore 2>/dev/null; then
        cat >> .gitignore << 'EOF'

# Planning Framework v2.0
# Uncomment if you want to keep planning files private:
# planning/
# PLANNING.md
# .qa-workflow.md
EOF
        echo -e "${GREEN}✓${NC} Added Planning Framework section to .gitignore"
    else
        echo -e "${GREEN}✓${NC} .gitignore already configured"
    fi
else
    echo -e "${YELLOW}⚠${NC} No .gitignore found, skipping"
fi

# ============================================================================
# 9. Success Message
# ============================================================================

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Setup Successful! 🎉                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Files created:${NC}"
echo "  ✓ $OUTPUT_FILE"
echo "  ✓ $QA_OUTPUT_FILE"
echo "  ✓ planning/issues/open/"
echo "  ✓ planning/issues/closed/"
echo "  ✓ planning/scripts/ (create-issue, close-issue, issue-status)"
echo "  ✓ planning/templates/ (all templates)"
echo "  ✓ planning/implementation-plan.md"
echo "  ✓ planning/session-log.md"
echo "  ✓ planning/decisions.md"
echo "  ✓ planning/FRAMEWORK.md"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "  1. Review and customize:"
echo "     - $OUTPUT_FILE (framework config)"
echo "     - $QA_OUTPUT_FILE (QA requirements)"
echo "     - planning/implementation-plan.md (roadmap)"
echo ""
echo "  2. Commit the framework files:"
echo "     git add ."
echo "     git commit -m \"Setup Planning Framework v2.0\""
echo ""
echo "  3. Create your first issue:"
echo "     planning/scripts/create-issue.sh"
echo "     # Or ask your AI agent to create an issue"
echo ""
echo "  4. Read the documentation:"
echo "     - PLANNING.md - Complete framework guide"
echo "     - planning/FRAMEWORK.md - Detailed reference"
echo "     - planning/templates/README.md - Template usage"
echo ""
echo -e "${BLUE}Happy coding with Planning Framework v2.0! 🚀${NC}"
echo ""
