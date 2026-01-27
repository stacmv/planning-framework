#!/usr/bin/env bash
# Planning Framework v2.0 - Issue Closure Helper
# Assists with closing issues following v2.0 workflow

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Planning Framework v2.0 - Close Issue${NC}"
echo ""

# Check if in git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# List open issues
OPEN_ISSUES=$(find docs/issues/open -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort)

if [ -z "$OPEN_ISSUES" ]; then
    echo -e "${YELLOW}No open issues found${NC}"
    exit 0
fi

echo -e "${YELLOW}Open issues:${NC}"
echo ""

# Show open issues as numbered list
i=1
declare -a ISSUE_ARRAY
while IFS= read -r issue; do
    ISSUE_ID=$(basename "$issue")
    ISSUE_ARRAY[$i]="$ISSUE_ID"
    echo "  $i) $ISSUE_ID"
    i=$((i + 1))
done <<< "$OPEN_ISSUES"

echo ""
read -p "Select issue to close [1-$((i-1))]: " SELECTION

if [ -z "$SELECTION" ] || [ "$SELECTION" -lt 1 ] || [ "$SELECTION" -ge "$i" ]; then
    echo -e "${RED}Invalid selection${NC}"
    exit 1
fi

ISSUE_ID="${ISSUE_ARRAY[$SELECTION]}"
ISSUE_DIR="docs/issues/open/$ISSUE_ID"

echo ""
echo -e "${BLUE}Closing issue: $ISSUE_ID${NC}"
echo ""

# ============================================================================
# Pre-closure Checks
# ============================================================================

echo -e "${YELLOW}Pre-closure checklist:${NC}"
echo ""

# Check if QA workflow exists
QA_PASSED=false
if [ -f ".qa-workflow.md" ]; then
    echo "1. Has QA workflow passed?"
    echo "   Run: Follow steps in .qa-workflow.md"
    read -p "   QA passed? [y/N] " QA_CHECK
    if [[ "$QA_CHECK" =~ ^[Yy] ]]; then
        QA_PASSED=true
    else
        echo -e "${RED}   ✗ QA must pass before closing issue${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}   ✓ QA workflow passed${NC}"

# Check user confirmation
echo ""
echo "2. Has user confirmed completion?"
read -p "   User confirmed? [y/N] " USER_CONFIRMED
if [[ ! "$USER_CONFIRMED" =~ ^[Yy] ]]; then
    echo -e "${RED}   ✗ Get user confirmation before closing${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ User confirmed${NC}"

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
EXPECTED_BRANCH="issue/$ISSUE_ID"

echo ""
echo "3. Checking git branch..."
if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
    echo -e "${YELLOW}   Warning: Current branch ($CURRENT_BRANCH) doesn't match issue ($EXPECTED_BRANCH)${NC}"
    read -p "   Continue anyway? [y/N] " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy] ]]; then
        exit 1
    fi
fi
echo -e "${GREEN}   ✓ On branch: $CURRENT_BRANCH${NC}"

# Check for uncommitted changes
echo ""
echo "4. Checking for uncommitted changes..."
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo -e "${YELLOW}   Warning: You have uncommitted changes${NC}"
    read -p "   Commit them now? [Y/n] " COMMIT_NOW
    if [[ ! "$COMMIT_NOW" =~ ^[Nn] ]]; then
        git status --short
        echo ""
        read -p "   Commit message: " COMMIT_MSG
        if [ -z "$COMMIT_MSG" ]; then
            COMMIT_MSG="Work on issue $ISSUE_ID"
        fi
        git add -A
        git commit -m "$COMMIT_MSG"
        echo -e "${GREEN}   ✓ Changes committed${NC}"
    fi
else
    echo -e "${GREEN}   ✓ No uncommitted changes${NC}"
fi

# ============================================================================
# Get Parent Branch
# ============================================================================

echo ""
read -p "5. Parent branch to merge into [develop]: " PARENT_BRANCH
if [ -z "$PARENT_BRANCH" ]; then
    PARENT_BRANCH="develop"
fi

# Check if parent branch exists
if ! git rev-parse --verify "$PARENT_BRANCH" >/dev/null 2>&1; then
    echo -e "${RED}   Error: Branch '$PARENT_BRANCH' does not exist${NC}"
    exit 1
fi

# ============================================================================
# Get Issue Summary
# ============================================================================

echo ""
read -p "6. Brief description of what was done: " SUMMARY
if [ -z "$SUMMARY" ]; then
    SUMMARY="Completed issue $ISSUE_ID"
fi

# ============================================================================
# Confirm Closure
# ============================================================================

echo ""
echo -e "${YELLOW}Closure Plan:${NC}"
echo "  1. Merge $CURRENT_BRANCH → $PARENT_BRANCH"
echo "  2. Move $ISSUE_DIR → docs/issues/closed/"
echo "  3. Update docs/planning/session-log.md"
echo "  4. Update docs/planning/implementation-plan.md"
echo "  5. Commit: 'Close issue $ISSUE_ID: $SUMMARY'"
echo ""
read -p "Proceed? [Y/n] " FINAL_CONFIRM
if [[ "$FINAL_CONFIRM" =~ ^[Nn] ]]; then
    echo "Cancelled"
    exit 0
fi

# ============================================================================
# Execute Closure
# ============================================================================

echo ""
echo -e "${BLUE}Executing closure...${NC}"
echo ""

# Step 1: Merge to parent branch
echo -e "${BLUE}[1/5]${NC} Merging to $PARENT_BRANCH..."
git checkout "$PARENT_BRANCH"
git merge "$CURRENT_BRANCH" --no-edit
echo -e "${GREEN}✓${NC} Merged"

# Step 2: Move issue to closed
echo -e "${BLUE}[2/5]${NC} Moving issue to closed..."
git mv "$ISSUE_DIR" "docs/issues/closed/"
echo -e "${GREEN}✓${NC} Moved to docs/issues/closed/$ISSUE_ID"

# Step 3: Update session log
echo -e "${BLUE}[3/5]${NC} Updating session-log.md..."
CURRENT_DATE=$(date +%Y-%m-%d)
AGENT_NAME="[Claude Code]"  # Default - could be detected or prompted

# Check if session-log.md exists
if [ ! -f "docs/planning/session-log.md" ]; then
    echo -e "${YELLOW}   Warning: session-log.md not found, skipping${NC}"
else
    # Add entry to session log
    echo "" >> docs/planning/session-log.md
    echo "$AGENT_NAME ✓ [$ISSUE_ID](../issues/closed/$ISSUE_ID/) - $SUMMARY" >> docs/planning/session-log.md
    echo -e "${GREEN}✓${NC} Updated session-log.md"
fi

# Step 4: Prompt to update implementation plan
echo -e "${BLUE}[4/5]${NC} Update implementation-plan.md..."
if [ -f "docs/planning/implementation-plan.md" ]; then
    echo -e "${YELLOW}   Please manually update docs/planning/implementation-plan.md:${NC}"
    echo "   - Mark related milestone tasks complete"
    echo "   - Update progress percentage"
    echo "   - Remove from active issues list"
    read -p "   Open file now? [Y/n] " OPEN_FILE
    if [[ ! "$OPEN_FILE" =~ ^[Nn] ]]; then
        ${EDITOR:-vi} docs/planning/implementation-plan.md
    fi
    echo -e "${GREEN}✓${NC} implementation-plan.md ready for review"
else
    echo -e "${YELLOW}   ⚠ implementation-plan.md not found${NC}"
fi

# Check for decisions to promote
echo ""
echo -e "${BLUE}[5/5]${NC} Checking for decisions to promote..."
if [ -f "docs/issues/closed/$ISSUE_ID/decisions.md" ]; then
    echo -e "${YELLOW}   Issue has decisions.md${NC}"
    echo "   Review decisions and promote significant ones to docs/planning/decisions.md"
    read -p "   Open decisions now? [y/N] " OPEN_DECISIONS
    if [[ "$OPEN_DECISIONS" =~ ^[Yy] ]]; then
        ${EDITOR:-vi} "docs/issues/closed/$ISSUE_ID/decisions.md"
        echo ""
        read -p "   Promote any decisions to global? [y/N] " PROMOTE
        if [[ "$PROMOTE" =~ ^[Yy] ]]; then
            ${EDITOR:-vi} docs/planning/decisions.md
        fi
    fi
fi
echo -e "${GREEN}✓${NC} Decisions reviewed"

# ============================================================================
# Commit Closure
# ============================================================================

echo ""
echo -e "${BLUE}Committing closure...${NC}"

git add -A
git commit -m "Close issue $ISSUE_ID: $SUMMARY"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Issue Closed Successfully! 🎉                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "  ✓ Merged to: $PARENT_BRANCH"
echo "  ✓ Issue moved to: docs/issues/closed/$ISSUE_ID"
echo "  ✓ Session log updated"
echo "  ✓ Changes committed"
echo ""
echo -e "${YELLOW}Optional next steps:${NC}"
echo "  - Review closed issue: docs/issues/closed/$ISSUE_ID"
echo "  - Delete branch (manual): git branch -d issue/$ISSUE_ID"
echo "  - Push changes: git push origin $PARENT_BRANCH"
echo ""
echo -e "${BLUE}Great work! Ready for the next issue. 🚀${NC}"
echo ""
