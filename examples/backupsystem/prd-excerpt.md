# Product Requirements Document: Universal Backup System
## (EXCERPT - Showing Framework Usage)

**Version:** 2.0
**Date:** 2025-11-01
**Status:** Draft

> **Note:** This is an excerpt from the complete 1,811-line PRD. It demonstrates how to structure requirements for a complex, multi-phase project.

---

## Executive Summary

### Vision
Create a cross-platform, production-ready backup automation system that addresses the limitations of the current MVP while providing a flexible, extensible foundation for personal and public use.

### Key Objectives
- Resolve current restic performance issues (script execution, progress indication)
- Achieve true cross-platform support (Windows/Linux)
- Enable easy setup and management through automated installation and interactive configuration
- Support multiple backup strategies: file-level backups, mirrors/sync, disk imaging, and cloud storage
- Provide comprehensive CLI, TUI interfaces
- Make the system generic enough for GitHub publication and community use

### Implementation Strategy
Develop **two parallel implementations** (PHP and Go) to compare:
- **PHP version**: Leverages existing codebase knowledge, familiar development
- **Go version**: Compiled binary, better performance, restic ecosystem alignment

After comparing both implementations, select the superior approach for v2.1+.

---

## Current System Analysis

### MVP Strengths
- Functional restic-based daily backups
- Robocopy mirroring for critical directories
- Configuration-driven approach
- Windows Task Scheduler integration

### Critical Issues to Address

#### 1. Restic Performance Degradation
**Problem**: When executed from batch files or PHP scripts, restic backups take hours instead of 2-5 minutes. Manual execution works fine.

**Root Cause**: Likely PTY/terminal allocation issues:
- PHP's `proc_open()` may not allocate proper pseudo-terminal
- Restic progress rendering requires interactive terminal
- Windows batch execution doesn't provide proper terminal context

**Solution Requirements**:
- Implement proper PTY allocation (Linux: `script` command, Windows: `winpty` or ConPTY API)
- Ensure JSON progress parsing doesn't cause buffering issues
- Add fallback mode for environments without PTY support

#### 2. Progress Indication Failures
**Problem**: Errors from locked files break output and progress indication becomes useless.

**Solution Requirements**:
- Robust JSON parsing with error handling
- Separate error stream processing from progress stream
- Graceful degradation when progress data unavailable
- Clear visual distinction between warnings (locked files) and fatal errors

#### 3. Retention Policy Not Working
**Problem**: System has 25 snapshots instead of configured 7 daily backups.

**Root Causes to Investigate**:
- `forget` command may not be executing
- Tag filtering may be incorrect
- Multiple backup jobs creating untagged snapshots
- Prune operation not completing

**Solution Requirements**:
- Verify forget/prune execution with comprehensive logging
- Ensure consistent tagging strategy across all backups
- Add snapshot audit/cleanup commands
- Display retention policy status in management UI

---

## Core Requirements

### FR-1: Cross-Platform Support

#### FR-1.1: Supported Platforms
- **Primary**: Windows 10/11, Ubuntu/Debian Linux
- **Secondary**: macOS, Fedora/RHEL (future consideration)

#### FR-1.2: Platform Abstraction
- Detect OS automatically at runtime
- Use platform-appropriate tools and paths
- Handle platform-specific quirks (permissions, symlinks, locked files)

### FR-2: Automated Setup & Installation

#### FR-2.1: New System Setup
When executed on a fresh system, the setup script SHALL:

1. **Detect Environment**
   - Operating system and version
   - Available package managers
   - Existing backup tools

2. **Interactive Configuration Wizard**
   - Backup type selection (restic, mirrors, disk imaging, cloud)
   - Source directory/device selection
   - Destination configuration (local/external/network/cloud)
   - Retention policies (daily/weekly/monthly counts)
   - Schedule preferences (time, frequency, event triggers)
   - Cloud credentials (if applicable)

3. **Install Dependencies**
   - **Windows**: Install Scoop (if missing), then install tools via Scoop
   - **Linux**: Use native package manager (apt)
   - **Tools to install**: restic, rsync, rclone, PHP/Go runtime, ncurses

[... continues for FR-2.2 through FR-10 ...]

---

## Technical Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                   User Interfaces                   │
│  ┌──────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │     CLI      │  │     TUI     │  │   Scheduler ││
│  │  (Commands)  │  │ (Dashboard) │  │  (Cron/Task)││
│  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘│
└─────────┼──────────────────┼────────────────┼───────┘
          │                  │                │
          └──────────────────┼────────────────┘
                             │
┌────────────────────────────┼─────────────────────────┐
│                    Core Engine                       │
│  ┌─────────────────────────▼──────────────────────┐ │
│  │           Configuration Manager                 │ │
│  │  (YAML parsing, validation, credential store)   │ │
│  └─────────────────────┬───────────────────────────┘ │
│                        │                             │
│  ┌────────────────────┴────────────────────┐        │
│  │      Backup Job Orchestrator            │        │
│  │  (Queue, Priority, Concurrency Control) │        │
│  └────────┬────────────────────────┬───────┘        │
│           │                        │                 │
│  ┌────────▼────────┐      ┌───────▼────────┐       │
│  │  Backup Engines │      │ Platform Layer │       │
│  │  (Restic,Sync,  │      │ (OS-specific   │       │
│  │  Imaging)       │      │  adapters)     │       │
│  └─────────────────┘      └────────────────┘       │
└──────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Configuration System
**Responsibilities:**
- Parse and validate YAML configuration files
- Manage credentials securely
- Provide access to configuration throughout the application

**Files:**
- PHP: `src/Config/ConfigParser.php`, `src/Config/Validator.php`
- Go: `pkg/config/parser.go`, `pkg/config/validator.go`

[... continues with more components ...]

---

## Development Strategy

### Phase-Based Implementation

#### Phase 1: Foundation (Week 1)
**Goal**: Establish core infrastructure and tooling

**Deliverables:**
- Project scaffolding (PHP and Go)
- Configuration parser (YAML support)
- Platform detection module
- Testing framework setup (Pest for PHP, testing+gomega for Go)
- CI/CD pipeline (GitHub Actions)

**Success Criteria:**
- Can parse sample YAML config
- Can detect OS platform
- All tests pass
- Linters pass (phpstan level 8, golangci-lint)

[... continues with Phases 2-6 ...]

---

## Testing Strategy

### Testing Levels

#### Unit Tests
**Framework:**
- PHP: Pest with Hamcrest matchers
- Go: `testing` package with gomega

**Coverage Target:** 80%+ for core components

**Example Test Structure (PHP):**
```php
// tests/Unit/Config/ConfigParserTest.php
use function Pest\Laravel\{it, expect};
use Hamcrest as m;

it('parses valid YAML config', function() {
    $parser = new ConfigParser();
    $config = $parser->parse('tests/fixtures/valid-config.yaml');

    expect($config->getBackupSources())->toHaveCount(m::greaterThan(0));
    expect($config->getResticRepository())->toBe(m::startsWith('/path/to'));
});
```

[... continues with integration tests, E2E tests, etc. ...]

---

## Success Criteria

### MVP Success (v2.0)

✅ **Functional Requirements:**
- Cross-platform execution (Windows + Linux)
- Automated setup completes in < 5 minutes
- Restic backups complete in comparable time to manual execution
- Progress indication works reliably
- Retention policies execute correctly
- Mirror operations work on both platforms

✅ **Non-Functional Requirements:**
- Test coverage > 80%
- Zero critical bugs
- Documentation complete (README, usage guide, contribution guide)
- Performance matches native restic execution

✅ **User Experience:**
- First-time user can configure backup in < 10 minutes
- CLI provides helpful error messages
- TUI shows real-time backup progress
- Configuration errors caught before backup starts

[... continues ...]

---

## Open Questions

1. **Go Learning Timeline**
   - Is 4 weeks realistic for passive learning approach?
   - Should we extend to 8 weeks to reduce pressure?
   - **Decision**: ADR-003 documents passive learning approach (4 weeks, 1-2 hrs/week)

2. **Testing Framework Choice**
   - PHPUnit vs Pest for PHP?
   - **Decision**: ADR-002 documents choice of Pest + Hamcrest

3. **Dual Implementation Long-term**
   - Maintain both or choose one after Phase 6?
   - **Decision**: ADR-001 documents dual implementation for comparison, then select one

---

## Appendix

### Glossary

- **Restic**: Fast, secure backup program (https://restic.net)
- **Robocopy**: Windows robust file copy utility
- **rsync**: Unix/Linux file synchronization tool
- **PTY**: Pseudo-Terminal (virtual terminal interface)
- **ADR**: Architecture Decision Record

### References

- Restic Documentation: https://restic.readthedocs.io/
- Pest PHP Documentation: https://pestphp.com/
- Gomega Matcher Library: https://onsi.github.io/gomega/

---

**End of Excerpt**

**What this demonstrates:**
- Structured requirement definitions (FR-1, FR-2, etc.)
- Problem analysis with root causes and solutions
- Technical architecture documentation
- Clear success criteria
- Phase-based implementation strategy
- Testing strategy with examples
- Open questions with ADR references

**Full PRD:** 1,811 lines covering all 10 functional requirements, complete architecture, detailed testing strategy, and comprehensive appendices.
