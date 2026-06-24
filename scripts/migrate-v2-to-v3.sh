#!/usr/bin/env bash
# Planning Framework - Migrate from v2.0 to v3.0
# Updates open issues and removes obsolete scripts in a consumer project

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# 1. Argument Handling
# ============================================================================

TARGET_DIR="${1:-.}"

# Resolve to absolute path
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Planning Framework v2.0 → v3.0 Migration Tool            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Target directory:${NC} $TARGET_DIR"
echo ""

# ============================================================================
# 2. Preview Changes
# ============================================================================

echo -e "${YELLOW}Planning to perform the following steps:${NC}"
echo ""

# Step 1: Collect implementation-plan.md files to rename
IMPL_PLANS=()
while IFS= read -r -d '' f; do
    IMPL_PLANS+=("$f")
done < <(find "$TARGET_DIR/docs/issues/open" -maxdepth 2 -name "implementation-plan.md" -print0 2>/dev/null || true)

echo -e "${BLUE}Step 1${NC} — Rename implementation-plan.md → implementation_plan.md in open issues:"
if [ "${#IMPL_PLANS[@]}" -eq 0 ]; then
    echo "  (none found)"
else
    for f in "${IMPL_PLANS[@]}"; do
        ISSUE_ID="$(basename "$(dirname "$f")")"
        echo "  docs/issues/open/$ISSUE_ID/implementation-plan.md → implementation_plan.md"
    done
fi
echo ""

# Step 2: Collect open issue folders missing test_plan.md
MISSING_TEST_PLAN=()
if [ -d "$TARGET_DIR/docs/issues/open" ]; then
    while IFS= read -r -d '' issue_dir; do
        if [ ! -f "$issue_dir/test_plan.md" ]; then
            MISSING_TEST_PLAN+=("$issue_dir")
        fi
    done < <(find "$TARGET_DIR/docs/issues/open" -maxdepth 1 -mindepth 1 -type d -print0 2>/dev/null || true)
fi

echo -e "${BLUE}Step 2${NC} — Add test_plan.md stubs to open issues missing one:"
if [ "${#MISSING_TEST_PLAN[@]}" -eq 0 ]; then
    echo "  (none needed)"
else
    for issue_dir in "${MISSING_TEST_PLAN[@]}"; do
        ISSUE_ID="$(basename "$issue_dir")"
        echo "  docs/issues/open/$ISSUE_ID/test_plan.md  [new stub]"
    done
fi
echo ""

# Step 3: Collect obsolete scripts to delete
OBSOLETE_SCRIPTS=()
[ -f "$TARGET_DIR/scripts/create-issue.sh" ] && OBSOLETE_SCRIPTS+=("scripts/create-issue.sh")
[ -f "$TARGET_DIR/scripts/close-issue.sh" ]  && OBSOLETE_SCRIPTS+=("scripts/close-issue.sh")

echo -e "${BLUE}Step 3${NC} — Remove obsolete scripts:"
if [ "${#OBSOLETE_SCRIPTS[@]}" -eq 0 ]; then
    echo "  (none found)"
else
    for s in "${OBSOLETE_SCRIPTS[@]}"; do
        echo "  $s  [will be deleted]"
    done
fi
echo ""

# ============================================================================
# 3. Confirmation
# ============================================================================

read -p "Proceed with migration? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy] ]]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}Starting migration...${NC}"
echo ""

# ============================================================================
# 4. Step 1 — Rename implementation-plan.md
# ============================================================================

echo -e "${BLUE}[Step 1]${NC} Renaming implementation-plan.md files..."

RENAMED_COUNT=0
for f in "${IMPL_PLANS[@]}"; do
    ISSUE_ID="$(basename "$(dirname "$f")")"
    DEST="$(dirname "$f")/implementation_plan.md"
    mv "$f" "$DEST"
    echo -e "  ${GREEN}[renamed]${NC} docs/issues/open/$ISSUE_ID/implementation-plan.md → implementation_plan.md"
    RENAMED_COUNT=$((RENAMED_COUNT + 1))
done

if [ "$RENAMED_COUNT" -eq 0 ]; then
    echo "  (nothing to rename)"
fi
echo ""

# ============================================================================
# 5. Step 2 — Add test_plan.md stubs
# ============================================================================

echo -e "${BLUE}[Step 2]${NC} Adding test_plan.md stubs..."

STUB_COUNT=0
for issue_dir in "${MISSING_TEST_PLAN[@]}"; do
    ISSUE_ID="$(basename "$issue_dir")"
    STUB_FILE="$issue_dir/test_plan.md"
    cat > "$STUB_FILE" << EOF
# Test Plan: $ISSUE_ID

> TODO: Run /pf-test-plan to generate this file.
EOF
    echo -e "  ${GREEN}[added stub]${NC} docs/issues/open/$ISSUE_ID/test_plan.md"
    STUB_COUNT=$((STUB_COUNT + 1))
done

if [ "$STUB_COUNT" -eq 0 ]; then
    echo "  (nothing to add)"
fi
echo ""

# ============================================================================
# 6. Step 3 — Remove obsolete scripts
# ============================================================================

echo -e "${BLUE}[Step 3]${NC} Removing obsolete scripts..."

DELETED_COUNT=0
for s in "${OBSOLETE_SCRIPTS[@]}"; do
    rm "$TARGET_DIR/$s"
    echo -e "  ${GREEN}[deleted]${NC} $s"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done

if [ "$DELETED_COUNT" -eq 0 ]; then
    echo "  (nothing to delete)"
fi
echo ""

# ============================================================================
# 7. Summary
# ============================================================================

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Migration Complete!                               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "  Files renamed (implementation-plan.md): $RENAMED_COUNT"
echo "  Stub test_plan.md files added:          $STUB_COUNT"
echo "  Obsolete scripts deleted:               $DELETED_COUNT"
echo ""
echo -e "${BLUE}Next step:${NC} commit the changes."
echo "  git add ."
echo "  git commit -m \"Migrate to Planning Framework v3.0\""
echo ""
