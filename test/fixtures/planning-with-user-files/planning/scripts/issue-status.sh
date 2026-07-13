#!/bin/bash
# Check status of issue from remote branch
# Usage: ./issue-status.sh [issue-id]
# Example: ./issue-status.sh 20240127-feat-implement-v2

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
ISSUE_ID="${1}"

if [[ -z "${ISSUE_ID}" ]]; then
    echo -e "${RED}Error: Issue ID required${NC}"
    echo "Usage: $0 <issue-id>"
    echo "Example: $0 20240127-feat-implement-v2"
    exit 1
fi

# Constants
ISSUE_BRANCH="issue/${ISSUE_ID}"
ISSUE_PATH="planning/issues/open/${ISSUE_ID}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Issue Status Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if issue folder exists locally
if [[ ! -d "${ISSUE_PATH}" ]]; then
    echo -e "${RED}✗ Issue not found locally: ${ISSUE_PATH}${NC}"
    echo ""
    echo "Checking remote branch..."
fi

# Fetch latest from remote
echo -e "${YELLOW}Fetching from remote...${NC}"
if git fetch origin 2>/dev/null; then
    echo -e "${GREEN}✓ Fetched${NC}"
else
    echo -e "${RED}✗ Failed to fetch${NC}"
    exit 1
fi
echo ""

# Check if branch exists remotely
if ! git rev-parse "origin/${ISSUE_BRANCH}" >/dev/null 2>&1; then
    echo -e "${RED}✗ Branch not found: origin/${ISSUE_BRANCH}${NC}"
    exit 1
fi

# Get branch info
CURRENT_BRANCH=$(git branch --show-current)
BRANCH_REMOTE_HASH=$(git rev-parse "origin/${ISSUE_BRANCH}" 2>/dev/null || echo "")
BRANCH_LOCAL_HASH=$(git rev-parse "${ISSUE_BRANCH}" 2>/dev/null || echo "")

echo -e "${CYAN}Issue:${NC} ${ISSUE_ID}"
echo -e "${CYAN}Branch:${NC} ${ISSUE_BRANCH}"
echo -e "${CYAN}Current Branch:${NC} ${CURRENT_BRANCH}"
echo ""

# Check if local branch exists and is in sync
if [[ -n "${BRANCH_LOCAL_HASH}" ]]; then
    if [[ "${BRANCH_LOCAL_HASH}" == "${BRANCH_REMOTE_HASH}" ]]; then
        echo -e "${GREEN}✓ Local branch in sync with remote${NC}"
    else
        BEHIND=$(git rev-list --count "${BRANCH_LOCAL_HASH}..${BRANCH_REMOTE_HASH}" 2>/dev/null || echo "?")
        AHEAD=$(git rev-list --count "${BRANCH_REMOTE_HASH}..${BRANCH_LOCAL_HASH}" 2>/dev/null || echo "?")
        echo -e "${YELLOW}⚠ Local branch out of sync${NC}"
        echo -e "  Behind: ${BEHIND} commits"
        echo -e "  Ahead: ${AHEAD} commits"
    fi
else
    echo -e "${YELLOW}⚠ No local branch (remote only)${NC}"
fi
echo ""

# Compare with parent branch (develop or main)
PARENT_BRANCH="develop"
if ! git rev-parse "${PARENT_BRANCH}" >/dev/null 2>&1; then
    PARENT_BRANCH="main"
fi

if git rev-parse "${PARENT_BRANCH}" >/dev/null 2>&1; then
    PARENT_HASH=$(git rev-parse "${PARENT_BRANCH}")
    AHEAD_OF_PARENT=$(git rev-list --count "${PARENT_HASH}..origin/${ISSUE_BRANCH}" 2>/dev/null || echo "?")

    echo -e "${CYAN}Progress vs ${PARENT_BRANCH}:${NC}"
    echo -e "  Commits ahead: ${GREEN}${AHEAD_OF_PARENT}${NC}"
    echo ""
fi

# Get last commit info
LAST_COMMIT_HASH=$(git rev-parse --short "origin/${ISSUE_BRANCH}" 2>/dev/null || echo "")
LAST_COMMIT_MSG=$(git log -1 --pretty=format:"%s" "origin/${ISSUE_BRANCH}" 2>/dev/null || echo "")
LAST_COMMIT_DATE=$(git log -1 --pretty=format:"%ci" "origin/${ISSUE_BRANCH}" 2>/dev/null || echo "")
LAST_COMMIT_AUTHOR=$(git log -1 --pretty=format:"%an" "origin/${ISSUE_BRANCH}" 2>/dev/null || echo "")

echo -e "${CYAN}Last Commit:${NC}"
echo -e "  ${LAST_COMMIT_HASH} - ${LAST_COMMIT_MSG}"
echo -e "  ${LAST_COMMIT_DATE} by ${LAST_COMMIT_AUTHOR}"
echo ""

# Try to extract progress from implementation plan on remote branch
echo -e "${YELLOW}Checking implementation plan...${NC}"
IMPL_PLAN_PATH="${ISSUE_PATH}/implementation-plan.md"

if git cat-file -e "origin/${ISSUE_BRANCH}:${IMPL_PLAN_PATH}" 2>/dev/null; then
    # Extract progress tracking section
    PROGRESS=$(git show "origin/${ISSUE_BRANCH}:${IMPL_PLAN_PATH}" 2>/dev/null | grep -A 20 "## Progress Tracking" | head -20)

    if [[ -n "${PROGRESS}" ]]; then
        echo -e "${GREEN}✓ Found progress tracking:${NC}"
        echo ""
        echo "${PROGRESS}" | while IFS= read -r line; do
            # Colorize progress lines
            if [[ "${line}" =~ "✅ Complete" ]]; then
                echo -e "  ${GREEN}${line}${NC}"
            elif [[ "${line}" =~ "🔄 IN PROGRESS" ]]; then
                echo -e "  ${YELLOW}${line}${NC}"
            elif [[ "${line}" =~ "⏸️ Not Started" ]]; then
                echo -e "  ${line}"
            elif [[ "${line}" =~ "Overall:" ]]; then
                echo -e "  ${CYAN}${line}${NC}"
            else
                echo "  ${line}"
            fi
        done
    else
        echo -e "${YELLOW}⚠ No progress tracking found${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Implementation plan not found on remote branch${NC}"
fi
echo ""

# Show recent commits
echo -e "${CYAN}Recent Commits (last 5):${NC}"
git log "origin/${ISSUE_BRANCH}" --oneline --decorate -5 --color=always | sed 's/^/  /'
echo ""

# Quick actions
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Quick Actions${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [[ "${CURRENT_BRANCH}" != "${ISSUE_BRANCH}" ]]; then
    echo "To switch to this issue:"
    echo -e "  ${CYAN}git checkout ${ISSUE_BRANCH}${NC}"
    echo ""
fi

echo "To view files from remote branch:"
echo -e "  ${CYAN}git show origin/${ISSUE_BRANCH}:${IMPL_PLAN_PATH}${NC}"
echo -e "  ${CYAN}git show origin/${ISSUE_BRANCH}:${ISSUE_PATH}/session-log.md${NC}"
echo ""

echo "To view all changes in this issue:"
echo -e "  ${CYAN}git diff ${PARENT_BRANCH}...origin/${ISSUE_BRANCH}${NC}"
echo ""

echo "To merge this issue (if ready):"
echo -e "  ${CYAN}./scripts/close-issue.sh ${ISSUE_ID}${NC}"
echo ""
