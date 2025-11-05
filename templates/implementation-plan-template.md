# Implementation Plan - [Project Name]

**Status:** In Progress | Complete
**Started:** YYYY-MM-DD
**Last Updated:** YYYY-MM-DD

---

## Purpose

This document provides a detailed implementation roadmap. It maintains context across development sessions by specifying:
- Exact directory structure
- Component-by-component breakdown
- Implementation sequence with dependencies
- Interface contracts
- Progress tracking

**Use this document to:**
- Start each session: Review what's done, see what's next
- Maintain consistency: Follow established patterns
- Track progress: Check off completed items
- Make decisions: Reference architecture and interfaces

---

## Quick Status

**Current Phase:** [Phase Name]
**Current Task:** [Specific task in progress]
**Next Task:** [What to do next session]

**Progress Overview:**
- [ ] Phase 1: [Phase Name] (X/Y complete)
- [ ] Phase 2: [Phase Name] (X/Y complete)
- [ ] Phase 3: [Phase Name] (X/Y complete)
- [ ] Phase 4: [Phase Name] (X/Y complete)

**Recent Milestones:**
- YYYY-MM-DD: [Milestone description]
- YYYY-MM-DD: [Milestone description]

---

## Project Directory Structure

```
project-name/
├── docs/                           # Documentation
│   ├── prd.md                     # Product Requirements
│   ├── planning/                  # Planning documents
│   │   ├── implementation-plan.md # This file
│   │   ├── session-log.md         # Session tracking
│   │   └── decisions.md           # Architecture decisions
│   └── api/                       # API documentation
├── src/                           # Source code
│   ├── core/                      # Core business logic
│   ├── api/                       # API/interface layer
│   ├── utils/                     # Utilities
│   └── config/                    # Configuration
├── tests/                         # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── config/                        # Configuration files
├── scripts/                       # Build/deployment scripts
├── .github/                       # CI/CD workflows
├── package.json                   # Dependencies
└── README.md
```

---

## Implementation Phases

### Phase 1: [Phase Name] (Estimated: X-Y hours)

**Goal:** [What this phase achieves]

**Status:** ⏸️ Not Started | 🔄 In Progress | ✅ Complete

**Progress:** 0/5 tasks complete (0%)

---

#### 1.1 [Component Name]

**Status:** ⏸️ Not Started | 🔄 In Progress | ✅ Complete

**Files:**
- `src/path/to/file1.ext`
- `src/path/to/file2.ext`

**Tasks:**
- [ ] Task 1: [Description]
- [ ] Task 2: [Description]
- [ ] Task 3: [Description]
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update documentation

**Dependencies:** None | Depends on [Component X]

**Interface/Contract:**
```typescript
// Define expected interfaces, function signatures, or API contracts
interface ComponentName {
  method1(param: Type): ReturnType;
  method2(param: Type): ReturnType;
}
```

**Deliverable:** [What should work when this is done]

**Estimated Time:** X-Y hours

**Notes:**
- [Implementation note or consideration]
- [Link to relevant decision in decisions.md]

---

#### 1.2 [Next Component]

[Repeat structure above]

---

### Phase 2: [Phase Name] (Estimated: X-Y hours)

[Repeat phase structure]

---

## Component Specifications

### [Component Name]

**Purpose:** [What this component does]

**Location:** `src/path/to/component`

**Responsibilities:**
- Responsibility 1
- Responsibility 2
- Responsibility 3

**Dependencies:**
- External: [library name] - [why needed]
- Internal: [other component] - [why needed]

**Public API:**
```typescript
// Define public interface
class ComponentName {
  constructor(config: Config) {}

  publicMethod1(): void {}
  publicMethod2(param: Type): ReturnType {}
}
```

**Testing Requirements:**
- Unit tests: [What to test]
- Integration tests: [What to test]
- Test coverage target: X%

**Performance Considerations:**
- [Performance requirement or consideration]

---

## Implementation Guidelines

### Code Organization
- [Guideline about file structure]
- [Guideline about naming conventions]
- [Guideline about module boundaries]

### Testing Approach
- [Testing philosophy]
- [When to write tests]
- [Coverage expectations]

### Documentation Standards
- [What needs documentation]
- [Where documentation lives]
- [Format/style guide]

### Git Workflow
- Branch naming: [convention]
- Commit messages: [convention]
- PR requirements: [checklist]

---

## Dependencies & Blockers

### External Dependencies
| Dependency | Status | Impact | Notes |
|------------|--------|--------|-------|
| [Library/API] | ✅ Available | [Impact] | [Notes] |
| [Tool/Service] | ⏸️ Pending | [Impact] | [Notes] |

### Current Blockers
- [ ] **[Blocker description]** - Blocked by: [What], Impact: [High/Med/Low]
- [ ] **[Blocker description]** - Blocked by: [What], Impact: [High/Med/Low]

### Resolved Blockers
- [x] **[Blocker description]** - Resolved: YYYY-MM-DD, Solution: [How]

---

## Next Session Checklist

### Before Starting Next Session:
1. [ ] Read `docs/planning/session-log.md` - See what was done last time
2. [ ] Read this file - Review current phase and next task
3. [ ] Read `docs/planning/decisions.md` - Review architectural decisions
4. [ ] Check git status - See any uncommitted changes

### To Start Next Task:
1. [ ] Update session log with session start
2. [ ] Mark current task as "🔄 In Progress" in this file
3. [ ] Begin implementation
4. [ ] Commit frequently with clear messages
5. [ ] Update session log when done
6. [ ] Mark task as "✅ Complete" in this file
7. [ ] Update "Next Task" at top of this file

---

## Notes & Learnings

### Technical Discoveries
- [Date]: [Discovery or learning]
- [Date]: [Discovery or learning]

### Process Improvements
- [Date]: [Process change and why]
- [Date]: [Process change and why]

### Performance Insights
- [Date]: [Benchmark or performance finding]

---

## Revision History

- **v1.0** (YYYY-MM-DD) - Initial plan created
- **v1.1** (YYYY-MM-DD) - [Changes made]
