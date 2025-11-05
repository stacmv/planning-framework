# Architecture Decision Log

This document records significant architectural and implementation decisions made during development.

## Format

Each decision includes:
- **Date** - When decision was made
- **Context** - What problem are we solving?
- **Options Considered** - What alternatives did we evaluate?
- **Decision** - What did we choose?
- **Rationale** - Why did we choose this?
- **Consequences** - What are the implications?
- **Status** - Accepted / Superseded / Deprecated

---

## ADR-001: Dual Implementation (PHP + Go)

**Date:** 2025-11-01
**Status:** Accepted

### Context
Need to build cross-platform backup system. User knows PHP well but Go might be better suited for this type of tool.

### Options Considered
1. PHP only - Familiar, fast to develop
2. Go only - Better for CLI tools, but learning curve
3. Dual implementation - Build both, compare, choose best

### Decision
Build both PHP and Go versions in parallel.

### Rationale
- Leverage user's PHP expertise for rapid prototyping
- Learn Go through practical translation of working PHP code
- Compare performance and developer experience before committing
- PHP version serves as specification for Go version
- After Phase 6, choose one implementation to continue

### Consequences
- **Positive:**
  - Lower risk (have working version while learning)
  - Direct performance comparison
  - Learning opportunity without project risk
  - Can make informed decision after seeing both

- **Negative:**
  - Double development effort initially
  - Must maintain consistency between implementations
  - Will eventually abandon one implementation

---

## ADR-002: Pest + Hamcrest for PHP Testing

**Date:** 2025-11-01
**Status:** Accepted

### Context
Need robust testing framework for PHP implementation.

### Options Considered
1. **Raw PHPUnit** - Standard, well-known
2. **Codeception** - Full-stack testing with browser support
3. **Pest + Hamcrest** - Modern syntax with expressive matchers

### Decision
Use Pest with Hamcrest matchers, skip Codeception.

### Rationale
- Pest provides cleaner syntax than PHPUnit
- Hamcrest matchers improve test readability
- Codeception's browser testing not needed (no web UI in scope)
- Pest has excellent features: parallel execution, architecture testing, datasets
- Minimal complexity over PHPUnit (thin wrapper)
- Active development and community

### Consequences
- Team needs to learn Pest syntax (but simpler than PHPUnit)
- Better test readability and maintainability
- Faster test execution (parallel support)
- Can enforce architecture rules with Pest's arch() tests

---

## ADR-003: Passive Go Learning (4 weeks)

**Date:** 2025-11-01
**Status:** Accepted

### Context
User needs to understand Go code but has limited time for learning.

### Options Considered
1. **Active learning (12 weeks)** - User implements everything
2. **Passive learning (4 weeks)** - User reads code Claude writes
3. **No structured learning** - Just ask questions as needed

### Decision
Passive learning approach: Claude writes code with educational comments, user reads and completes comprehension exercises over 4 weeks (1-2 hours/week).

### Rationale
- User has limited time (1-2 hours/week, not 6-8)
- Primary goal: user can review and understand code, not write from scratch
- Claude (AI) will write the Go implementation with guidance
- Educational comments (📚 links, 💡 PHP comparisons) in code
- Exercises focus on comprehension, not implementation
- More realistic timeline (4-8 hours total vs 72-96)

### Consequences
- User learns to READ Go code confidently
- May not be comfortable WRITING Go from scratch initially
- Faster overall project progress
- User can make informed decisions and review changes
- Suitable for project where AI does implementation

---

## ADR-004: Pest (PHP) and gomega (Go) for Hamcrest-style Testing

**Date:** 2025-11-01
**Status:** Accepted

### Context
Want expressive, readable test assertions in both implementations.

### Options Considered
1. **Standard assertions** - PHPUnit assertEquals, Go testing Equal
2. **Hamcrest-style matchers** - More readable, composable

### Decision
- PHP: Use Pest with `hamcrest/hamcrest-php`
- Go: Use built-in `testing` with `gomega` (Hamcrest-style for Go)

### Rationale
- Hamcrest matchers are more readable: `assertThat($x, is(greaterThan(5)))` vs `$this->assertTrue($x > 5)`
- Better error messages when tests fail
- Composable matchers for complex assertions
- gomega is well-established in Go community (used by Kubernetes, etc.)
- Consistent testing philosophy across both implementations

### Consequences
- Slightly steeper learning curve for standard assertions
- Better test readability and maintainability
- Easier to test complex backup/restore scenarios

---

## ADR-005: Implementation Plan in `/docs/planning/`

**Date:** 2025-11-01
**Status:** Accepted

### Context
Need to maintain context across multiple development sessions over weeks/months.

### Options Considered
1. **PRD only** - High-level requirements
2. **Add implementation plan** - Detailed task breakdown
3. **External project management tool** - Jira, Trello, etc.

### Decision
Create detailed implementation plan in `/docs/planning/` folder with session logs and decision tracking.

### Rationale
- PRD describes WHAT and WHY, but not HOW and WHEN
- Detailed plan prevents context loss between sessions
- Session logs track progress and next steps
- All documentation in repository (not external tool)
- Easy to review at session start

### Consequences
- **Positive:**
  - Clear roadmap for development
  - Easy to resume after breaks
  - Documents decisions for future reference
  - Tracks dependencies between components

- **Negative:**
  - Extra documentation to maintain
  - Must remember to update after each session

---

## ADR-006: Cobra (Go) and Symfony Console (PHP) for CLI

**Date:** 2025-11-01
**Status:** Accepted

### Context
Need CLI framework for both implementations.

### Options Considered
**PHP:**
1. Symfony Console - De facto standard
2. CLImate - Simpler, less features
3. Laravel Zero - Full framework, might be overkill

**Go:**
1. Cobra - Most popular, used by kubectl, restic
2. cli (urfave/cli) - Simpler
3. kong - Modern, different approach

### Decision
- PHP: Symfony Console
- Go: Cobra

### Rationale
- **Symfony Console:**
  - Industry standard for PHP CLI apps
  - Rich feature set (questions, tables, progress bars)
  - Excellent documentation
  - User likely familiar with it

- **Cobra:**
  - Used by restic (inspiration for this project)
  - Used by kubectl, Hugo, GitHub CLI (proven at scale)
  - Excellent subcommand support
  - Works well with Viper for config
  - Large community and examples

### Consequences
- Consistent command structure across implementations
- Can learn from restic's Cobra usage
- Well-documented patterns for both

---

## ADR-007: Bubbletea for Go TUI

**Date:** 2025-11-01
**Status:** Accepted

### Context
Need terminal UI framework for Go implementation.

### Options Considered
1. **Bubbletea** - Modern, Elm-architecture based
2. **tview** - Mature, widget-based
3. **termui** - Dashboard-focused

### Decision
Use Bubbletea for Go TUI.

### Rationale
- Modern architecture (Model-View-Update from Elm)
- Excellent composability with Bubbles (component library)
- Active development by Charm team
- Built-in support for VHS testing (record TUI interactions)
- Separation of business logic from rendering (very testable)
- Growing adoption in Go TUI apps

### Consequences
- User needs to understand Elm architecture pattern
- Very testable due to pure functions
- Beautiful rendering with Lipgloss styling
- Great for educational code comments (clear state transitions)

---

## Template for New Decision

```markdown
## ADR-XXX: Brief Title

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded | Deprecated

### Context
What problem are we solving? What constraints exist?

### Options Considered
1. Option A - Brief description
2. Option B - Brief description
3. Option C - Brief description

### Decision
What did we choose?

### Rationale
Why did we choose this option?
- Reason 1
- Reason 2

### Consequences
- **Positive:**
  - Benefit 1
  - Benefit 2

- **Negative:**
  - Trade-off 1
  - Trade-off 2
```

---

**Log Started:** 2025-11-01
**Last Updated:** 2025-11-01
