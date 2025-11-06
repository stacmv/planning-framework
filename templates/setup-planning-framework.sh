#!/bin/bash
# Setup Planning Framework
# Usage: ./setup-planning-framework.sh [project-path] [project-name]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROJECT_PATH="${1:-.}"
PROJECT_NAME="${2:-MyProject}"
CURRENT_DATE=$(date +%Y-%m-%d)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Planning Framework Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Project Path: ${GREEN}${PROJECT_PATH}${NC}"
echo -e "Project Name: ${GREEN}${PROJECT_NAME}${NC}"
echo -e "Date: ${GREEN}${CURRENT_DATE}${NC}"
echo ""

# Verify script is run from templates directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -f "${SCRIPT_DIR}/prd-template.md" ]]; then
    echo -e "${RED}Error: Script must be run from the templates directory${NC}"
    echo "Templates not found at: ${SCRIPT_DIR}"
    exit 1
fi

# Create target directory structure
echo -e "${YELLOW}Creating directory structure...${NC}"
mkdir -p "${PROJECT_PATH}/docs/planning"

# Check if files already exist
OVERWRITE=false
if [[ -f "${PROJECT_PATH}/docs/prd.md" ]]; then
    echo -e "${YELLOW}Warning: Files already exist in target directory${NC}"
    read -p "Overwrite existing files? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        OVERWRITE=true
    else
        echo -e "${RED}Aborted${NC}"
        exit 1
    fi
fi

# Copy and customize templates
echo -e "${YELLOW}Copying templates...${NC}"

# PRD
echo "  - docs/prd.md"
sed -e "s/\[Project Name\]/${PROJECT_NAME}/g" \
    -e "s/YYYY-MM-DD/${CURRENT_DATE}/g" \
    "${SCRIPT_DIR}/prd-template.md" > "${PROJECT_PATH}/docs/prd.md"

# Implementation Plan
echo "  - docs/planning/implementation-plan.md"
sed -e "s/\[Project Name\]/${PROJECT_NAME}/g" \
    -e "s/YYYY-MM-DD/${CURRENT_DATE}/g" \
    "${SCRIPT_DIR}/implementation-plan-template.md" > "${PROJECT_PATH}/docs/planning/implementation-plan.md"

# Session Log
echo "  - docs/planning/session-log.md"
sed -e "s/\[Project Name\]/${PROJECT_NAME}/g" \
    -e "s/YYYY-MM-DD/${CURRENT_DATE}/g" \
    "${SCRIPT_DIR}/session-log-template.md" > "${PROJECT_PATH}/docs/planning/session-log.md"

# Decisions
echo "  - docs/planning/decisions.md"
sed -e "s/\[Project Name\]/${PROJECT_NAME}/g" \
    -e "s/YYYY-MM-DD/${CURRENT_DATE}/g" \
    "${SCRIPT_DIR}/decisions-template.md" > "${PROJECT_PATH}/docs/planning/decisions.md"

# Framework documentation
echo "  - docs/planning/FRAMEWORK.md"
cp "${SCRIPT_DIR}/../FRAMEWORK.md" "${PROJECT_PATH}/docs/planning/FRAMEWORK.md"

# CLAUDE.md integration
echo ""
echo -e "${YELLOW}Setting up CLAUDE.md...${NC}"
if [[ -f "${PROJECT_PATH}/CLAUDE.md" ]]; then
    echo -e "${YELLOW}CLAUDE.md already exists${NC}"
    read -p "Append planning framework instructions? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "" >> "${PROJECT_PATH}/CLAUDE.md"
        echo "# ========================================" >> "${PROJECT_PATH}/CLAUDE.md"
        echo "# Planning Framework Integration" >> "${PROJECT_PATH}/CLAUDE.md"
        echo "# ========================================" >> "${PROJECT_PATH}/CLAUDE.md"
        echo "" >> "${PROJECT_PATH}/CLAUDE.md"
        cat "${SCRIPT_DIR}/claude-instructions.md" >> "${PROJECT_PATH}/CLAUDE.md"
        echo -e "${GREEN}✓ Appended to CLAUDE.md${NC}"
    fi
else
    echo "# CLAUDE.md" > "${PROJECT_PATH}/CLAUDE.md"
    echo "" >> "${PROJECT_PATH}/CLAUDE.md"
    echo "This file provides guidance to Claude Code when working with this repository." >> "${PROJECT_PATH}/CLAUDE.md"
    echo "" >> "${PROJECT_PATH}/CLAUDE.md"
    cat "${SCRIPT_DIR}/claude-instructions.md" >> "${PROJECT_PATH}/CLAUDE.md"
    echo -e "${GREEN}✓ Created CLAUDE.md${NC}"
fi

# Update .gitignore if it exists
if [[ -f "${PROJECT_PATH}/.gitignore" ]]; then
    if ! grep -q "# Planning Framework" "${PROJECT_PATH}/.gitignore"; then
        echo ""
        echo "# Planning Framework - Keep these files versioned" >> "${PROJECT_PATH}/.gitignore"
        echo "# docs/prd.md" >> "${PROJECT_PATH}/.gitignore"
        echo "# docs/planning/" >> "${PROJECT_PATH}/.gitignore"
        echo -e "${GREEN}✓ Updated .gitignore${NC}"
    fi
fi

# Create initial git commit if in git repo
if [[ -d "${PROJECT_PATH}/.git" ]]; then
    echo ""
    read -p "Create git commit for planning framework? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "${PROJECT_PATH}"
        git add docs/planning/ docs/prd.md CLAUDE.md 2>/dev/null || true
        git commit -m "Initialize planning framework

- Add PRD template
- Add implementation plan template
- Add session log template
- Add architecture decisions log template
- Integrate with CLAUDE.md

Planning framework version: 1.0
Date: ${CURRENT_DATE}" 2>/dev/null || echo -e "${YELLOW}Note: Some files may already be committed${NC}"
        echo -e "${GREEN}✓ Git commit created${NC}"
    fi
fi

# Print next steps
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Planning Framework Setup Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Customize the PRD:"
echo -e "   ${BLUE}edit ${PROJECT_PATH}/docs/prd.md${NC}"
echo ""
echo "2. Define your implementation plan:"
echo -e "   ${BLUE}edit ${PROJECT_PATH}/docs/planning/implementation-plan.md${NC}"
echo ""
echo "3. Start your first development session:"
echo -e "   ${BLUE}# Read the planning docs${NC}"
echo -e "   ${BLUE}tail -50 ${PROJECT_PATH}/docs/planning/session-log.md${NC}"
echo ""
echo "4. Let Claude Code know about your project:"
echo -e "   ${BLUE}# Claude will automatically read CLAUDE.md${NC}"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo -e "   See ${BLUE}${PROJECT_PATH}/docs/planning/FRAMEWORK.md${NC} for detailed guide"
echo ""
echo -e "${GREEN}Happy coding!${NC}"
