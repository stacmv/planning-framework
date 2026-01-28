#!/usr/bin/env bash
# Planning Framework v2.0 - Manual Issue Creation Helper
# Creates issue folder and files from templates

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")/docs/planning/templates"

echo -e "${BLUE}Planning Framework v2.0 - Create Issue${NC}"
echo ""

# Check templates
if [ ! -d "$TEMPLATE_DIR/issue" ]; then
    echo -e "${RED}Error: Templates not found at $TEMPLATE_DIR/issue${NC}"
    exit 1
fi

# Get issue type
echo "Issue type:"
echo "  1) feat - New feature"
echo "  2) bug - Fix bug"
echo "  3) improve - Improve existing feature"
echo "  4) other - Custom type"
read -p "Select [1-4]: " TYPE_CHOICE

case $TYPE_CHOICE in
    1) ISSUE_TYPE="feat" ;;
    2) ISSUE_TYPE="bug" ;;
    3) ISSUE_TYPE="improve" ;;
    4)
        read -p "Custom type: " ISSUE_TYPE
        if [ -z "$ISSUE_TYPE" ]; then
            echo -e "${RED}Error: Type cannot be empty${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Get issue slug
echo ""
read -p "Issue slug (e.g., add-authentication): " SLUG
if [ -z "$SLUG" ]; then
    echo -e "${RED}Error: Slug cannot be empty${NC}"
    exit 1
fi

# Sanitize slug (replace spaces with dashes, lowercase)
SLUG=$(echo "$SLUG" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g')

# Generate issue ID
CURRENT_DATE=$(date +%Y%m%d)
ISSUE_ID="$CURRENT_DATE-$ISSUE_TYPE-$SLUG"

ISSUE_DIR="docs/issues/open/$ISSUE_ID"

# Check if issue already exists
if [ -d "$ISSUE_DIR" ]; then
    echo -e "${RED}Error: Issue already exists: $ISSUE_ID${NC}"
    echo "Try a different slug or check existing issues"
    exit 1
fi

# Confirm
echo ""
echo -e "${YELLOW}Issue ID:${NC} $ISSUE_ID"
echo -e "${YELLOW}Location:${NC} $ISSUE_DIR"
echo ""
read -p "Create issue? [Y/n] " CONFIRM
if [[ "$CONFIRM" =~ ^[Nn] ]]; then
    echo "Cancelled"
    exit 0
fi

# Create issue folder
echo ""
echo -e "${BLUE}Creating issue folder...${NC}"
mkdir -p "$ISSUE_DIR"

# Copy templates
echo -e "${BLUE}Copying templates...${NC}"

# Required files
cp "$TEMPLATE_DIR/issue/prompt.md" "$ISSUE_DIR/"
cp "$TEMPLATE_DIR/issue/analysis.md" "$ISSUE_DIR/"
cp "$TEMPLATE_DIR/issue/implementation-plan.md" "$ISSUE_DIR/"
cp "$TEMPLATE_DIR/issue/session-log.md" "$ISSUE_DIR/"

# Optional files (ask)
read -p "Include definition-of-done.md? [y/N] " INCLUDE_DOD
if [[ "$INCLUDE_DOD" =~ ^[Yy] ]]; then
    cp "$TEMPLATE_DIR/issue/definition-of-done.md" "$ISSUE_DIR/"
fi

read -p "Include decisions.md? [y/N] " INCLUDE_DECISIONS
if [[ "$INCLUDE_DECISIONS" =~ ^[Yy] ]]; then
    cp "$TEMPLATE_DIR/issue/decisions.md" "$ISSUE_DIR/"
fi

# Update templates with issue info
CURRENT_DATE_FORMATTED=$(date +%Y-%m-%d)
find "$ISSUE_DIR" -type f -name "*.md" -exec sed -i "s/YYYY-MM-DD/$CURRENT_DATE_FORMATTED/g" {} \;
find "$ISSUE_DIR" -type f -name "*.md" -exec sed -i "s/YYYYMMDD-type-slug/$ISSUE_ID/g" {} \;

# Update analysis.md frontmatter
sed -i "s/type: feat | bug | improve/type: $ISSUE_TYPE/g" "$ISSUE_DIR/analysis.md"
sed -i "s|branch: issue/YYYYMMDD-type-slug|branch: issue/$ISSUE_ID|g" "$ISSUE_DIR/analysis.md"

echo ""
echo -e "${GREEN}✓ Issue created: $ISSUE_ID${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "  1. Fill out the issue files:"
echo "     - prompt.md - Paste user request"
echo "     - analysis.md - Analyze problem and approach"
echo "     - implementation-plan.md - Break down into tasks"
echo ""
echo "  2. Create issue branch:"
echo "     git checkout -b issue/$ISSUE_ID"
echo ""
echo "  3. Start working!"
echo "     - Follow implementation-plan.md"
echo "     - Update session-log.md after each session"
echo ""
echo -e "${BLUE}Issue location: $ISSUE_DIR${NC}"
echo ""
