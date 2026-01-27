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
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")/docs/planning/templates"

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

echo -e "${BLUE}[1/6]${NC} Creating folder structure..."

mkdir -p docs/issues/open
mkdir -p docs/issues/closed
mkdir -p docs/planning

echo -e "${GREEN}✓${NC} Folders created"

# ============================================================================
# 3. Copy and Customize PLANNING.md
# ============================================================================

echo -e "${BLUE}[2/6]${NC} Creating PLANNING.md..."

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

# Update issue types section
ISSUE_TYPES_FORMATTED=$(echo "$ISSUE_TYPES" | sed 's/,/`, `/g')
sed -i "s/feat\`, \`bug\`, \`improve/feat\`, \`bug\`, \`improve/g" "$OUTPUT_FILE"

echo -e "${GREEN}✓${NC} PLANNING.md created"

# ============================================================================
# 4. Copy and Customize .qa-workflow.md
# ============================================================================

echo -e "${BLUE}[3/6]${NC} Creating .qa-workflow.md..."

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
# 5. Initialize Global Planning Files
# ============================================================================

echo -e "${BLUE}[4/6]${NC} Initializing global planning files..."

# implementation-plan.md
if [ ! -f "docs/planning/implementation-plan.md" ]; then
    cp "$TEMPLATE_DIR/global/implementation-plan.md" "docs/planning/implementation-plan.md"
    sed -i "s/\[Project Name\]/$PROJECT_NAME/g" "docs/planning/implementation-plan.md"
    sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" "docs/planning/implementation-plan.md"
    echo -e "${GREEN}✓${NC} implementation-plan.md created"
else
    echo -e "${YELLOW}⚠${NC} implementation-plan.md already exists, skipping"
fi

# session-log.md
if [ ! -f "docs/planning/session-log.md" ]; then
    cp "$TEMPLATE_DIR/global/session-log.md" "docs/planning/session-log.md"
    sed -i "s/\[Project Name\]/$PROJECT_NAME/g" "docs/planning/session-log.md"
    sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" "docs/planning/session-log.md"
    echo -e "${GREEN}✓${NC} session-log.md created"
else
    echo -e "${YELLOW}⚠${NC} session-log.md already exists, skipping"
fi

# decisions.md
if [ ! -f "docs/planning/decisions.md" ]; then
    cp "$TEMPLATE_DIR/global/decisions.md" "docs/planning/decisions.md"
    sed -i "s/\[Project Name\]/$PROJECT_NAME/g" "docs/planning/decisions.md"
    sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" "docs/planning/decisions.md"
    echo -e "${GREEN}✓${NC} decisions.md created"
else
    echo -e "${YELLOW}⚠${NC} decisions.md already exists, skipping"
fi

# ============================================================================
# 6. Create .gitignore entries (optional)
# ============================================================================

echo -e "${BLUE}[5/6]${NC} Checking .gitignore..."

if [ -f ".gitignore" ]; then
    if ! grep -q "# Planning Framework" .gitignore 2>/dev/null; then
        cat >> .gitignore << 'EOF'

# Planning Framework v2.0
# Uncomment if you want to keep planning files private:
# docs/issues/
# docs/planning/
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
# 7. Success Message
# ============================================================================

echo -e "${BLUE}[6/6]${NC} Setup complete!"
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Setup Successful! 🎉                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Files created:${NC}"
echo "  ✓ $OUTPUT_FILE"
echo "  ✓ $QA_OUTPUT_FILE"
echo "  ✓ docs/issues/open/"
echo "  ✓ docs/issues/closed/"
echo "  ✓ docs/planning/implementation-plan.md"
echo "  ✓ docs/planning/session-log.md"
echo "  ✓ docs/planning/decisions.md"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "  1. Review and customize:"
echo "     - $OUTPUT_FILE (framework config)"
echo "     - $QA_OUTPUT_FILE (QA requirements)"
echo "     - docs/planning/implementation-plan.md (roadmap)"
echo ""
echo "  2. Commit the framework files:"
echo "     git add ."
echo "     git commit -m \"Setup Planning Framework v2.0\""
echo ""
echo "  3. Create your first issue:"
echo "     Ask your AI agent to create an issue for your first task"
echo ""
echo "  4. Read the documentation:"
echo "     - PLANNING.md - Complete framework guide"
echo "     - docs/planning/templates/README.md - Template usage"
echo ""
echo -e "${BLUE}Happy coding with Planning Framework v2.0! 🚀${NC}"
echo ""
