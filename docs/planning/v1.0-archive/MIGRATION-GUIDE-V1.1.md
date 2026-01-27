# Migration Guide: Planning Framework v1.0 → v1.1

**Target Audience:** AI Assistants (Claude, Copilot, etc.) helping with project migrations
**Change Summary:** Remove time estimations from planning documents
**Reason:** AI-assisted development has significantly different velocity than human-only development

---

## Overview

Planning Framework v1.1 removes all time estimations from templates and documentation. This migration guide helps AI assistants update existing project planning documents to match the new format.

### What's Changing

**Removed:**
- Session duration fields (e.g., "Duration: 2-3 hours")
- Task time estimates (e.g., "Estimated Time: X-Y hours")
- Phase time ranges (e.g., "Phase 1 (Estimated: X-Y hours)")
- Hour-based project size classifications (e.g., "Small Projects (8-40 hours)")
- Time statistics in session logs (Total Development Time, Average Session Length)
- Hour-based task granularity advice

**Kept:**
- All progress tracking (checkboxes, percentages)
- All structural elements (phases, tasks, components)
- All decision documentation
- Session count and completion status
- Technical time requirements (RTO/RPO in system specs)
- Performance metrics (system behavior, not dev time)

---

## Pre-Migration Checklist

### 1. Identify If Migration Is Needed

Check if your project uses Planning Framework v1.0 by searching for these patterns:

```bash
# Search for time estimation patterns
grep -r "Estimated Time:" docs/planning/
grep -r "Duration:.*hours" docs/planning/
grep -r "Estimated:.*hours" docs/planning/

# If you find matches, migration is needed
```

### 2. Identify Files to Migrate

Typical files that need updates:

```
docs/planning/
├── implementation-plan.md        # ⚠️ HIGH PRIORITY
├── session-log.md                # ⚠️ HIGH PRIORITY
├── FRAMEWORK.md                  # If copied locally
└── decisions.md                  # Check for time references

docs/
└── prd.md                        # Usually OK, but check

templates/ (if you copied framework templates)
├── implementation-plan-template.md
├── session-log-template.md
└── prd-template.md
```

### 3. Create Backup

```bash
# Optional but recommended
git checkout -b migrate-planning-framework-v1.1
git add .
git commit -m "Pre-migration snapshot"
```

---

## Migration Steps

### Step 1: Update Implementation Plan

**File:** `docs/planning/implementation-plan.md`

#### Pattern 1: Phase Headers
**Remove time estimates from phase headers:**

```markdown
# BEFORE
### Phase 1: Foundation (Estimated: X-Y hours)

# AFTER
### Phase 1: Foundation
```

#### Pattern 2: Component Time Estimates
**Remove Estimated Time fields:**

```markdown
# BEFORE
**Deliverable:** [What should work when this is done]

**Estimated Time:** X-Y hours

**Notes:**

# AFTER
**Deliverable:** [What should work when this is done]

**Notes:**
```

#### Pattern 3: Task Duration Fields
**Remove duration/estimated time from task sections:**

```markdown
# BEFORE
**Status:** ⏸️ Not Started
**Estimated Duration:** 4 hours
**Dependencies:** 1.5

# AFTER
**Status:** ⏸️ Not Started
**Dependencies:** 1.5
```

---

### Step 2: Update Session Log

**File:** `docs/planning/session-log.md`

#### Pattern 1: Session Headers
**Remove duration from session headers:**

```markdown
# BEFORE
### Session: 2025-11-06 (Duration: X hours)

# AFTER
### Session: 2025-11-06
```

#### Pattern 2: Next Session Estimates
**Remove estimated time from next session priorities:**

```markdown
# BEFORE
#### Next Session Priorities
1. [ ] Priority 1
2. [ ] Priority 2

**Estimated time needed:** X-Y hours

---

# AFTER
#### Next Session Priorities
1. [ ] Priority 1
2. [ ] Priority 2

---
```

#### Pattern 3: Session Statistics
**Remove time-based statistics:**

```markdown
# BEFORE
## Session Statistics

**Total Sessions:** X
**Total Development Time:** XX hours
**Average Session Length:** X.X hours
**Completion Status:** Phase X of Y (XX% complete)

# AFTER
## Session Statistics

**Total Sessions:** X
**Completion Status:** Phase X of Y (XX% complete)
```

#### Pattern 4: Session Templates
**Update all session templates at bottom of file:**

```markdown
# BEFORE
### Implementation Session Template
```markdown
### Session: YYYY-MM-DD (Duration: X hours)

# AFTER
### Implementation Session Template
```markdown
### Session: YYYY-MM-DD
```

---

### Step 3: Update Framework Documentation (If Copied Locally)

**Files:** `docs/planning/FRAMEWORK.md`, `README.md`

#### Pattern 1: Project Size Classifications
**Remove hour ranges:**

```markdown
# BEFORE
**Small Projects (8-40 hours):**
- Simplify PRD to 1-2 pages

**Medium Projects (40-200 hours):**
- Use all templates as-is

**Large Projects (>200 hours):**
- Split implementation plan by phase

# AFTER
**Small Projects:**
- Simplify PRD to 1-2 pages

**Medium Projects:**
- Use all templates as-is

**Large Projects:**
- Split implementation plan by phase
```

#### Pattern 2: Template Feature Lists
**Remove "Estimated time" from feature lists:**

```markdown
# BEFORE
**Key Features:**
- Quick Status section
- Phase breakdown with tasks
- Estimated time for each task
- Next Session Checklist

# AFTER
**Key Features:**
- Quick Status section
- Phase breakdown with tasks
- Next Session Checklist
```

#### Pattern 3: Task Granularity Advice
**Remove hour-based chunking advice:**

```markdown
# BEFORE
**Effective Implementation Plans:**
- Break tasks into 1-4 hour chunks
- Mark dependencies clearly

# AFTER
**Effective Implementation Plans:**
- Break tasks into manageable chunks
- Mark dependencies clearly
```

---

### Step 4: Update Quick Reference (If Present)

**File:** `QUICK-REFERENCE.md`

Remove duration from example session headers and time-based advice.

---

## Search & Replace Patterns

Use these patterns to find remaining time references:

### Grep Commands

```bash
# Find session durations
grep -rn "Duration:.*hours\?" docs/planning/

# Find estimated times
grep -rn "Estimated.*hours\?" docs/planning/

# Find time statistics
grep -rn "Total Development Time\|Average Session Length" docs/planning/

# Find hour-based project sizes
grep -rn "([0-9]\+-[0-9]\+ hours)" docs/

# General hour references (review manually)
grep -rn "hours\?" docs/planning/ | grep -v "^Binary"
```

### Regex Patterns (for find-replace in editors)

```regex
# Session duration in headers
\(Duration:\s*[0-9X-]+\s*hours?\)

# Estimated time fields
\*\*Estimated Time:\*\*\s*[0-9X-]+\s*hours?\s*\n\n

# Phase estimates
\(Estimated:\s*[0-9X-]+\s*hours?\)

# Duration fields
\*\*Duration:\*\*\s*[0-9X-]+\s*hours?\s*\n
```

---

## What NOT to Change

### ✅ Keep These Time References

These are **legitimate** time references that should **NOT** be removed:

#### 1. Technical Requirements (RTO/RPO)

```markdown
# KEEP THIS - System requirement, not dev time
- Recovery time: < 1 hour RTO, < 15 minutes RPO
```

#### 2. Performance Metrics

```markdown
# KEEP THIS - System performance problem, not dev estimate
**Problem**: Restic backups take hours instead of 2-5 minutes when
executed from batch files.
```

#### 3. Historical Decision Context in ADRs

```markdown
# KEEP THIS - Provides important decision context
**ADR-003: Passive Go Learning**

User has limited time (1-2 hours/week, not 6-8) for learning Go.
Passive learning approach: user reads code over 4 weeks (1-2 hours/week).
```

#### 4. Example Timelines in Narratives

```markdown
# KEEP THIS - Part of example narrative
Session 2025-11-01 (Setup & Planning)
  ↓
[Weeks pass]
  ↓
Session 2025-11-05 (Extract Framework)
```

---

## Verification Checklist

After migration, verify these items:

### Automated Checks

```bash
# Should return NO results or only legitimate references
grep -rn "Estimated Time:" docs/planning/
grep -rn "Duration:.*hours" docs/planning/
grep -rn "Total Development Time" docs/planning/
grep -rn "Average Session Length" docs/planning/

# Should show modified files (typically 5-10)
git status
```

### Manual Verification

- [ ] Implementation plan phases have no time estimates
- [ ] Session log entries have no duration fields
- [ ] Session statistics section has no time metrics
- [ ] All session templates updated (at bottom of session log)
- [ ] Project size categories have no hour ranges
- [ ] Task granularity advice mentions "manageable chunks" not "1-4 hours"
- [ ] RTO/RPO and performance metrics are still present (not accidentally removed)
- [ ] ADR decision context still makes sense

### File Count Check

Typical migration affects **5-10 files**:
- implementation-plan.md (required)
- session-log.md (required)
- FRAMEWORK.md (if copied locally)
- README.md (if copied locally)
- QUICK-REFERENCE.md (if copied locally)
- Templates (if copied locally): 3-5 files

---

## Example Migrations

### Example 1: Implementation Plan Component

**Before:**
```markdown
### 2.1 PHP Configuration Parser ⏸️ NEXT SESSION

**Status:** ⏸️ Not Started
**Estimated Duration:** 4 hours
**Dependencies:** 1.5
**Assignee:** Claude (with user review)

**Context:**
The configuration parser is the foundation...

**Deliverable:** Functional ConfigParser with 100% test coverage

**Estimated Time:** 4 hours

**Notes:**
- Implementation note
```

**After:**
```markdown
### 2.1 PHP Configuration Parser ⏸️ NEXT SESSION

**Status:** ⏸️ Not Started
**Dependencies:** 1.5
**Assignee:** Claude (with user review)

**Context:**
The configuration parser is the foundation...

**Deliverable:** Functional ConfigParser with 100% test coverage

**Notes:**
- Implementation note
```

### Example 2: Session Log Entry

**Before:**
```markdown
## Session 2025-11-01 (Setup & Planning)

**Duration:** ~3 hours
**Participants:** User + Claude

### Goals
- Create comprehensive PRD

### Next Session Priorities
1. [ ] Begin Phase 1, Task 1.1

**Estimated time needed:** 3-4 hours

**Preparation:**
- Review implementation plan
```

**After:**
```markdown
## Session 2025-11-01 (Setup & Planning)

**Participants:** User + Claude

### Goals
- Create comprehensive PRD

### Next Session Priorities
1. [ ] Begin Phase 1, Task 1.1

**Preparation:**
- Review implementation plan
```

### Example 3: Project Size Guidelines

**Before:**
```markdown
### Small Projects (8-40 hours)
- Simplify PRD to 1-2 pages
- Use single-phase implementation plan

### Large Projects (>200 hours)
- Split implementation plan by phase
- Add risks.md
```

**After:**
```markdown
### Small Projects
- Simplify PRD to 1-2 pages
- Use single-phase implementation plan

### Large Projects
- Split implementation plan by phase
- Add risks.md
```

---

## Troubleshooting

### Issue 1: "Not sure if time reference should be removed"

**Solution:** Ask these questions:

1. **Is it a system requirement?** (RTO/RPO, SLA) → Keep it
2. **Is it describing system performance?** (slow backup, fast query) → Keep it
3. **Is it a development estimate?** (estimated time, duration) → Remove it
4. **Is it historical context in an ADR?** (why decision was made) → Keep it

When in doubt, keep it. Better to leave a legitimate reference than break documentation.

### Issue 2: "Grep finds many matches"

**Solution:** Review each match:

```bash
# Get context around matches
grep -C 3 "hours" docs/planning/implementation-plan.md

# Check if they're in ADRs (likely legitimate)
grep -l "hours" docs/planning/decisions.md

# Check if they're technical requirements
grep "RTO\|RPO\|SLA" docs/prd.md
```

### Issue 3: "Session log has 50+ sessions"

**Solution:** Use sed or mass find-replace:

```bash
# Remove (Duration: X hours) from all session headers
sed -i 's/ (Duration: [0-9X~-]* hours\?)//g' docs/planning/session-log.md

# But review changes before committing!
git diff docs/planning/session-log.md
```

### Issue 4: "Content doesn't make sense after removal"

**Solution:** Some sentences may need rewording:

```markdown
# BEFORE (awkward after removing estimate)
**Next Session**
Start Task 2.1, estimated at 4 hours, focusing on...

# AFTER (needs rewrite)
**Next Session**
Start Task 2.1, focusing on...
```

---

## Post-Migration

### 1. Commit Changes

```bash
git add docs/planning/
git commit -m "Migrate planning framework to v1.1 (remove time estimations)

- Remove session durations from session log
- Remove estimated times from implementation plan
- Remove time statistics
- Update project size classifications
- Preserve technical requirements and ADR context

Reason: AI-assisted development has different velocity than time-based estimates suggest."
```

### 2. Update Framework Reference

If you copied framework files locally, note in your CLAUDE.md:

```markdown
## Planning Framework

**Version:** 1.1 (time estimations removed)
**Last Updated:** 2025-11-12
```

### 3. Communicate to Team

If working with a team, add a note to your project README or session log:

```markdown
**Note:** Planning documents migrated to Framework v1.1 on 2025-11-12.
Time estimations removed to better reflect AI-assisted development velocity.
Progress tracking remains unchanged.
```

---

## Quick Migration Checklist for AI Assistants

Use this checklist when helping users migrate:

- [ ] Identify files needing migration (grep for patterns)
- [ ] Create backup branch (optional)
- [ ] Update implementation-plan.md
  - [ ] Remove phase duration estimates
  - [ ] Remove component time estimates
  - [ ] Remove task duration fields
- [ ] Update session-log.md
  - [ ] Remove session durations from headers
  - [ ] Remove "Estimated time needed" from priorities
  - [ ] Remove time statistics section
  - [ ] Update all session templates at bottom
- [ ] Update framework docs (if present locally)
  - [ ] Remove hour ranges from project sizes
  - [ ] Remove "Estimated time" from feature lists
  - [ ] Update task granularity advice
- [ ] Verify no development estimates remain
- [ ] Verify technical requirements still present
- [ ] Verify ADR context still makes sense
- [ ] Commit with descriptive message
- [ ] Update project's framework version reference

---

## Getting Help

If you encounter edge cases not covered in this guide:

1. Check the [Planning Framework repository](https://github.com/yourusername/planning-framework) for updates
2. Review the CHANGELOG.md for v1.1 migration notes
3. Examine the examples/ directory for reference implementations
4. When in doubt, ask the user: "Should I keep this time reference?"

---

**Migration Guide Version:** 1.0
**Framework Version:** 1.1
**Last Updated:** 2025-11-12
**Maintainer:** Planning Framework Team
