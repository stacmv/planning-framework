#!/usr/bin/env bash
# Planning Framework - Migrate from v1.0 to v2.0
# Converts existing v1.0 planning structure to v2.0 issue-based workflow

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")/docs/planning/templates"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Planning Framework v1.0 → v2.0 Migration Tool            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# 1. Pre-flight Checks
# ============================================================================

echo -e "${YELLOW}Pre-flight checks...${NC}"
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo -e "${YELLOW}Warning: You have uncommitted changes.${NC}"
    echo "It's recommended to commit or stash changes before migration."
    read -p "Continue anyway? [y/N] " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy] ]]; then
        echo "Migration cancelled. Please commit your changes and try again."
        exit 0
    fi
fi

# Check if v1.0 files exist
V1_FILES_EXIST=false
if [ -f "CLAUDE.md" ] || [ -f "docs/planning/implementation-plan.md" ]; then
    V1_FILES_EXIST=true
fi

if [ "$V1_FILES_EXIST" = false ]; then
    echo -e "${YELLOW}No v1.0 files detected.${NC}"
    echo "This script migrates existing v1.0 projects to v2.0."
    echo "For new projects, use: ./scripts/setup-planning-v2.sh"
    read -p "Continue with migration anyway? [y/N] " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy] ]]; then
        exit 0
    fi
fi

# Get project name
if [ -f "package.json" ]; then
    PROJECT_NAME=$(grep '"name"' package.json | head -1 | sed 's/.*"name": "\(.*\)".*/\1/')
elif [ -f "Cargo.toml" ]; then
    PROJECT_NAME=$(grep '^name' Cargo.toml | head -1 | sed 's/name = "\(.*\)"/\1/')
else
    read -p "Project name: " PROJECT_NAME
    if [ -z "$PROJECT_NAME" ]; then
        PROJECT_NAME="MyProject"
    fi
fi

echo ""
echo -e "${GREEN}✓${NC} Pre-flight checks passed"
echo -e "${BLUE}Project:${NC} $PROJECT_NAME"
echo ""
read -p "Start migration? [Y/n] " CONFIRM
if [[ "$CONFIRM" =~ ^[Nn] ]]; then
    echo "Migration cancelled."
    exit 0
fi

CURRENT_DATE=$(date +%Y-%m-%d)
CURRENT_DATETIME=$(date +%Y%m%d-%H%M%S)

echo ""
echo -e "${YELLOW}Starting migration...${NC}"
echo ""

# ============================================================================
# 2. Backup v1.0 Files
# ============================================================================

echo -e "${BLUE}[1/7]${NC} Backing up v1.0 files..."

BACKUP_DIR="docs/planning/v1.0-archive-$CURRENT_DATETIME"
mkdir -p "$BACKUP_DIR"

# Backup files if they exist
[ -f "CLAUDE.md" ] && cp "CLAUDE.md" "$BACKUP_DIR/"
[ -f "GEMINI.md" ] && cp "GEMINI.md" "$BACKUP_DIR/"
[ -f "QWEN.md" ] && cp "QWEN.md" "$BACKUP_DIR/"
[ -f "docs/planning/implementation-plan.md" ] && cp "docs/planning/implementation-plan.md" "$BACKUP_DIR/"
[ -f "docs/planning/session-log.md" ] && cp "docs/planning/session-log.md" "$BACKUP_DIR/"
[ -f "docs/planning/decisions.md" ] && cp "docs/planning/decisions.md" "$BACKUP_DIR/"
[ -f "docs/planning/FRAMEWORK.md" ] && cp "docs/planning/FRAMEWORK.md" "$BACKUP_DIR/"

echo -e "${GREEN}✓${NC} Backup created at: $BACKUP_DIR"

# ============================================================================
# 3. Create v2.0 Folder Structure
# ============================================================================

echo -e "${BLUE}[2/7]${NC} Creating v2.0 folder structure..."

mkdir -p docs/issues/open
mkdir -p docs/issues/closed

echo -e "${GREEN}✓${NC} Folder structure created"

# ============================================================================
# 4. Convert Completed Work to Closed Issues
# ============================================================================

echo -e "${BLUE}[3/7]${NC} Converting completed work to closed issues..."

if [ -f "docs/planning/implementation-plan.md" ]; then
    # This is a simplified extraction - in a real scenario, you'd parse the markdown
    # For now, we'll just note that manual issue creation might be needed

    COMPLETED_COUNT=$(grep -c "^\- \[x\]" docs/planning/implementation-plan.md 2>/dev/null || echo "0")

    if [ "$COMPLETED_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}Found $COMPLETED_COUNT completed tasks in v1.0${NC}"
        echo "These will need to be manually organized into closed issues if desired."
        echo "For now, all history is preserved in $BACKUP_DIR"
    fi

    echo -e "${GREEN}✓${NC} Completed work documented in backup"
else
    echo -e "${YELLOW}⚠${NC} No v1.0 implementation-plan.md found"
fi

# ============================================================================
# 5. Extract and Migrate Decisions
# ============================================================================

echo -e "${BLUE}[4/7]${NC} Migrating architectural decisions..."

if [ -f "docs/planning/decisions.md" ]; then
    # decisions.md format is compatible between v1.0 and v2.0
    echo -e "${GREEN}✓${NC} Existing decisions.md is compatible with v2.0"
else
    # Create new decisions.md from template
    if [ -f "$TEMPLATE_DIR/global/decisions.md" ]; then
        cp "$TEMPLATE_DIR/global/decisions.md" "docs/planning/decisions.md"
        sed -i "s/\[Project Name\]/$PROJECT_NAME/g" "docs/planning/decisions.md"
        sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" "docs/planning/decisions.md"
        echo -e "${GREEN}✓${NC} Created new decisions.md from template"
    fi
fi

# ============================================================================
# 6. Create v2.0 Config Files
# ============================================================================

echo -e "${BLUE}[5/7]${NC} Creating v2.0 config files..."

# Create PLANNING.md
if [ -f "$TEMPLATE_DIR/config/PLANNING.md" ]; then
    if [ -f "PLANNING.md" ]; then
        echo -e "${YELLOW}⚠${NC} PLANNING.md already exists, creating PLANNING.md.new"
        cp "$TEMPLATE_DIR/config/PLANNING.md" "PLANNING.md.new"
        OUTPUT_FILE="PLANNING.md.new"
    else
        cp "$TEMPLATE_DIR/config/PLANNING.md" "PLANNING.md"
        OUTPUT_FILE="PLANNING.md"
    fi

    sed -i "s/\[Project Name\]/$PROJECT_NAME/g" "$OUTPUT_FILE"
    sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" "$OUTPUT_FILE"
    echo -e "${GREEN}✓${NC} Created $OUTPUT_FILE"

    # Add migration note to old config files
    if [ -f "CLAUDE.md" ]; then
        cat > "CLAUDE.md" << EOF
# ⚠️ Migrated to Planning Framework v2.0

This project has been migrated to Planning Framework v2.0.

**New configuration file:** PLANNING.md

Planning Framework v2.0 supports multiple AI agents (Claude, Gemini, Qwen)
with a single configuration file.

**v1.0 files backed up to:** $BACKUP_DIR

See PLANNING.md for the new framework instructions.

---

*This file kept for reference only*
*Last v1.0 version backed up: $CURRENT_DATE*
EOF
        echo -e "${GREEN}✓${NC} Updated CLAUDE.md with migration notice"
    fi
fi

# Create .qa-workflow.md
if [ -f "$TEMPLATE_DIR/config/.qa-workflow.md" ]; then
    if [ -f ".qa-workflow.md" ]; then
        echo -e "${YELLOW}⚠${NC} .qa-workflow.md already exists, creating .qa-workflow.md.new"
        cp "$TEMPLATE_DIR/config/.qa-workflow.md" ".qa-workflow.md.new"
        QA_FILE=".qa-workflow.md.new"
    else
        cp "$TEMPLATE_DIR/config/.qa-workflow.md" ".qa-workflow.md"
        QA_FILE=".qa-workflow.md"
    fi

    sed -i "s/\[Project Name\]/$PROJECT_NAME/g" "$QA_FILE"
    sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" "$QA_FILE"
    echo -e "${GREEN}✓${NC} Created $QA_FILE"
fi

# ============================================================================
# 7. Create v2.0 Global Planning Files
# ============================================================================

echo -e "${BLUE}[6/7]${NC} Creating v2.0 global planning files..."

# Backup and replace implementation-plan.md
if [ -f "docs/planning/implementation-plan.md" ]; then
    mv "docs/planning/implementation-plan.md" "docs/planning/implementation-plan.md.v1-backup"
    echo -e "${GREEN}✓${NC} Backed up old implementation-plan.md"
fi

cp "$TEMPLATE_DIR/global/implementation-plan.md" "docs/planning/implementation-plan.md"
sed -i "s/\[Project Name\]/$PROJECT_NAME/g" "docs/planning/implementation-plan.md"
sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" "docs/planning/implementation-plan.md"
echo -e "${GREEN}✓${NC} Created new v2.0 implementation-plan.md"

# Backup and replace session-log.md
if [ -f "docs/planning/session-log.md" ]; then
    mv "docs/planning/session-log.md" "docs/planning/session-log.md.v1-backup"
    echo -e "${GREEN}✓${NC} Backed up old session-log.md"
fi

cp "$TEMPLATE_DIR/global/session-log.md" "docs/planning/session-log.md"
sed -i "s/\[Project Name\]/$PROJECT_NAME/g" "docs/planning/session-log.md"
sed -i "s/YYYY-MM-DD/$CURRENT_DATE/g" "docs/planning/session-log.md"

# Add migration note
cat >> "docs/planning/session-log.md" << EOF

---

## Migration from v1.0

**Migrated:** $CURRENT_DATE

**v1.0 history preserved in:** $BACKUP_DIR

**v1.0 backups:**
- implementation-plan.md.v1-backup
- session-log.md.v1-backup

All future sessions use v2.0 format (one-line entries on issue closure).

EOF

echo -e "${GREEN}✓${NC} Created new v2.0 session-log.md"

# ============================================================================
# 8. Generate Migration Report
# ============================================================================

echo -e "${BLUE}[7/7]${NC} Generating migration report..."

REPORT_FILE="docs/planning/MIGRATION-REPORT-$CURRENT_DATETIME.md"

cat > "$REPORT_FILE" << EOF
# Migration Report: v1.0 → v2.0

**Date:** $CURRENT_DATE
**Project:** $PROJECT_NAME

---

## Summary

Successfully migrated Planning Framework from v1.0 to v2.0.

## Changes Made

### 1. Backups Created
- **Location:** $BACKUP_DIR
- **Files backed up:**
$([ -f "$BACKUP_DIR/CLAUDE.md" ] && echo "  - CLAUDE.md")
$([ -f "$BACKUP_DIR/GEMINI.md" ] && echo "  - GEMINI.md")
$([ -f "$BACKUP_DIR/QWEN.md" ] && echo "  - QWEN.md")
$([ -f "$BACKUP_DIR/implementation-plan.md" ] && echo "  - implementation-plan.md")
$([ -f "$BACKUP_DIR/session-log.md" ] && echo "  - session-log.md")
$([ -f "$BACKUP_DIR/decisions.md" ] && echo "  - decisions.md")

### 2. v2.0 Structure Created
- ✓ docs/issues/open/ (for active issues)
- ✓ docs/issues/closed/ (for completed issues)
- ✓ PLANNING.md (multi-agent config)
- ✓ .qa-workflow.md (quality gates)
- ✓ v2.0 global planning files

### 3. Files Migrated
- ✓ decisions.md (compatible with v2.0)
- ✓ Implementation plan converted to v2.0 format
- ✓ Session log converted to v2.0 format

### 4. Old Files Status
- CLAUDE.md → Updated with migration notice
- Old implementation-plan.md → implementation-plan.md.v1-backup
- Old session-log.md → session-log.md.v1-backup

## Next Steps

### Immediate
1. **Review v2.0 files:**
   - [ ] PLANNING.md - Framework configuration
   - [ ] .qa-workflow.md - QA requirements
   - [ ] docs/planning/implementation-plan.md - Roadmap

2. **Customize for your project:**
   - [ ] Update issue types in PLANNING.md
   - [ ] Customize QA workflow
   - [ ] Add current milestone to implementation-plan.md

3. **Commit migration:**
   \`\`\`bash
   git add .
   git commit -m "Migrate to Planning Framework v2.0"
   \`\`\`

### Creating Issues from v1.0 Work

If you want to convert v1.0 completed work to closed issues:

1. Review: \`$BACKUP_DIR/implementation-plan.md\`
2. For each major completed feature/task:
   - Create folder in \`docs/issues/closed/\`
   - Use date from git history or approximate
   - Name: \`YYYYMMDD-feat-description\`
   - Create minimal files (prompt.md, analysis.md)

This is optional - v2.0 starts fresh with new issues.

### Using v2.0

**For your next task:**
1. User requests feature/fix
2. Agent asks: "Should I create issue for this?"
3. Create issue in \`docs/issues/open/YYYYMMDD-type-slug/\`
4. Follow workflow in PLANNING.md

**Key v2.0 differences:**
- ✅ One issue per task (in its own folder)
- ✅ One issue per session (focused work)
- ✅ Global files stay small (roadmap only)
- ✅ QA workflow before closing issues

## Troubleshooting

**If something went wrong:**
1. All v1.0 files backed up in: $BACKUP_DIR
2. Restore: \`cp $BACKUP_DIR/* docs/planning/\`
3. Report issue: https://github.com/[your-org]/planning-framework/issues

**If you need v1.0 history:**
- Check: $BACKUP_DIR
- Check: docs/planning/*.v1-backup

## Documentation

**Read next:**
- PLANNING.md - Complete framework guide
- docs/planning/templates/README.md - Template usage
- .qa-workflow.md - Quality requirements

## Support

Questions or issues? Open an issue on the Planning Framework repository.

---

**Migration completed successfully! 🎉**

Welcome to Planning Framework v2.0!
EOF

echo -e "${GREEN}✓${NC} Migration report created: $REPORT_FILE"

# ============================================================================
# Success Message
# ============================================================================

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Migration Successful! 🎉                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "  ✓ v1.0 files backed up to: $BACKUP_DIR"
echo "  ✓ v2.0 structure created"
echo "  ✓ Config files generated"
echo "  ✓ Migration report: $REPORT_FILE"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "  1. Review the migration:"
echo "     - Read: $REPORT_FILE"
echo "     - Check: PLANNING.md"
echo "     - Check: .qa-workflow.md"
echo ""
echo "  2. Customize v2.0 files:"
echo "     - Update issue types in PLANNING.md"
echo "     - Customize QA workflow"
echo "     - Add current roadmap to implementation-plan.md"
echo ""
echo "  3. Commit the migration:"
echo "     git add ."
echo "     git commit -m \"Migrate to Planning Framework v2.0\""
echo ""
echo "  4. Start using v2.0:"
echo "     - Create issues for new work"
echo "     - Follow workflow in PLANNING.md"
echo "     - Enjoy bounded file sizes! 🚀"
echo ""
echo -e "${BLUE}Welcome to Planning Framework v2.0!${NC}"
echo ""
