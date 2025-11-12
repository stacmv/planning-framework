# Implementation Plan - BackupSystem v2.0
## (EXCERPT - Showing Framework Usage)

**Status:** In Progress
**Started:** 2025-11-01
**Last Updated:** 2025-11-05

> **Note:** This is an excerpt from the complete implementation plan. It demonstrates how to structure detailed task breakdowns with progress tracking.

---

## Purpose

This document provides a detailed implementation roadmap for building the BackupSystem in both PHP and Go. It maintains context across development sessions by specifying:
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

> **IMPORTANT:** This section is updated after every session. It provides instant context restoration.

**Current Phase:** Phase 1.5 - Project Scaffolding ✅ COMPLETE
**Current Task:** Phase 2.1 - Configuration Parser (PHP)
**Next Task:** Implement ConfigParser class with YAML support

**Progress Overview:**
- [x] Phase 1: Foundation Setup (5/5 complete, 100%)
  - [x] 1.1 Planning Infrastructure ✅
  - [x] 1.2 PRD ✅
  - [x] 1.3 Implementation Plan ✅
  - [x] 1.4 Session Log ✅
  - [x] 1.5 Project Scaffolding ✅
- [ ] Phase 2: Configuration System (0/4 complete, 0%)
  - [ ] 2.1 PHP Config Parser ⏸️ Next
  - [ ] 2.2 Go Config Parser ⏸️
  - [ ] 2.3 Config Validation ⏸️
  - [ ] 2.4 Credential Management ⏸️
- [ ] Phase 3: Backup Engine (0/5 complete)
- [ ] Phase 4: Platform Abstraction (0/4 complete)
- [ ] Phase 5: CLI & TUI (0/5 complete)
- [ ] Phase 6: Testing & Documentation (0/4 complete)

**Overall Progress:** 5/27 tasks complete (18.5%)

---

## Project Directory Structure

### Root Structure

```
BackupSystem/
├── docs/                           # Documentation
│   ├── prd.md                     # ✅ Product Requirements
│   ├── CLAUDE.md                  # ✅ Claude Code guidance
│   ├── planning/                  # ✅ Planning documents
│   │   ├── implementation-plan.md # ✅ This file
│   │   ├── session-log.md         # ✅ Session tracking
│   │   ├── decisions.md           # ✅ Architecture decisions
│   │   ├── FRAMEWORK.md           # ✅ Planning framework docs
│   │   ├── QUICK-REFERENCE.md     # ✅ Quick reference
│   │   └── templates/             # ✅ Reusable templates
│   └── learning-go/               # ✅ Go learning materials
│       ├── README.md              # ✅
│       ├── roadmap.md             # ⏸️ To do
│       ├── php-to-go-cheatsheet.md # ⏸️ To do
│       └── resources.md           # ⏸️ To do
├── php-implementation/            # PHP version
│   ├── src/                       # ✅ Source code structure
│   │   ├── Config/               # ⏸️ Next: ConfigParser
│   │   │   ├── ConfigParser.php
│   │   │   ├── Validator.php
│   │   │   └── CredentialManager.php
│   │   ├── Backup/
│   │   │   ├── ResticBackup.php
│   │   │   └── ProgressTracker.php
│   │   └── Platform/
│   │       ├── PlatformDetector.php
│   │       └── PathNormalizer.php
│   ├── tests/                     # ✅ Pest tests structure
│   │   ├── Unit/
│   │   ├── Integration/
│   │   └── Pest.php              # ✅ Test helpers
│   ├── config/                    # ✅ Runtime config (git-ignored)
│   ├── composer.json              # ✅
│   ├── phpstan.neon               # ✅
│   ├── .php-cs-fixer.php          # ✅
│   └── psalm.xml                  # ✅
├── go-implementation/             # Go version
│   ├── cmd/                       # ✅ Application entry points
│   │   └── backupsys/
│   │       └── main.go            # ✅
│   ├── pkg/                       # ✅ Public packages structure
│   │   ├── config/               # ⏸️ After PHP version
│   │   ├── backup/
│   │   ├── platform/
│   │   └── cli/
│   ├── internal/                  # ✅ Private packages
│   ├── tests/                     # ✅ Integration tests
│   ├── go.mod                     # ✅
│   └── .golangci.yml              # ✅
├── Makefile                       # ✅ Build automation
└── README.md                      # ⏸️ To write
```

---

## Phase 1: Foundation ✅ COMPLETE

### 1.1 Planning Infrastructure ✅ Complete

**Status:** ✅ Complete (2025-11-01)
**Dependencies:** None

**Tasks:**
- [x] Create `/docs/planning/` directory
- [x] Create `implementation-plan.md` (this file)
- [x] Create `session-log.md` with session templates
- [x] Create `decisions.md` with ADR template

**Deliverables:**
- ✅ Comprehensive planning infrastructure
- ✅ Session tracking system
- ✅ Decision documentation framework

**Success Criteria:**
- ✅ Can track sessions with clear next steps
- ✅ Can document architectural decisions
- ✅ Zero context loss between sessions

---

### 1.5 Project Scaffolding ✅ Complete

**Status:** ✅ Complete (2025-11-01)
**Dependencies:** 1.1, 1.2, 1.3

**Tasks:**
- [x] Create PHP directory structure (src/, tests/, config/)
- [x] Create Go directory structure (cmd/, pkg/, internal/)
- [x] Create composer.json with dependencies
- [x] Create go.mod with dependencies
- [x] Configure linters (phpstan, psalm, golangci-lint)
- [x] Configure testing frameworks (Pest, gomega)
- [x] Create Makefile with common targets
- [x] Create example config files

**Deliverables:**
- ✅ Complete project structure for both implementations
- ✅ All build tools configured and ready
- ✅ Can run `make test`, `make lint` in both projects

**Success Criteria:**
- ✅ `composer install` succeeds (PHP)
- ✅ `go mod download` succeeds (Go)
- ✅ Linters run without errors on empty codebase
- ✅ Test framework executes (no tests yet, but framework works)

---

## Phase 2: Configuration System (0/4 complete)

### 2.1 PHP Configuration Parser ⏸️ NEXT SESSION

**Status:** ⏸️ Not Started
**Dependencies:** 1.5
**Assignee:** Claude (with user review)

**Context:**
The configuration parser is the foundation for all other components. It must handle YAML parsing, type validation, and provide clean access to configuration throughout the application.

**Tasks:**
- [ ] Create `ConfigParser.php` class
  - [ ] Implement YAML parsing using `symfony/yaml`
  - [ ] Define `BackupConfig` value object
  - [ ] Implement getter methods for config values
  - [ ] Handle missing files gracefully
- [ ] Write unit tests (Pest + Hamcrest)
  - [ ] Test valid YAML parsing
  - [ ] Test invalid YAML handling
  - [ ] Test missing file handling
  - [ ] Test type coercion
- [ ] Add PHPStan level 8 type annotations
- [ ] Document class with PHPDoc

**Interface Contract:**
```php
namespace BackupSystem\Config;

class ConfigParser {
    public function __construct(string $configPath) {}
    public function parse(): BackupConfig {}
    public function validate(): ValidationResult {}
}

class BackupConfig {
    public function getBackupSources(): array {}
    public function getResticRepository(): string {}
    public function getResticPassword(): string {}
    public function getExcludePatterns(): array {}
    public function getRetentionPolicy(): RetentionPolicy {}
    public function getMirrorLocations(): array {}
}
```

**Test Files:**
- `tests/Unit/Config/ConfigParserTest.php`
- `tests/fixtures/valid-config.yaml`
- `tests/fixtures/invalid-config.yaml`

**Deliverables:**
- Fully functional ConfigParser with 100% test coverage
- Passing phpstan level 8 checks
- Documentation in code

**Success Criteria:**
- Can parse sample YAML config
- All tests pass
- PHPStan reports zero errors
- Config object provides type-safe access to all values

**Next Steps After Completion:**
1. Update session log with progress
2. Mark task complete in this document
3. Move to 2.2 (Go Config Parser) or 2.3 (Validation)

---

### 2.2 Go Configuration Parser ⏸️ Pending

**Status:** ⏸️ Not Started
**Dependencies:** 2.1 (PHP version as reference)

**Context:**
This is a direct translation of the PHP ConfigParser to Go, with idiomatic Go patterns. User will read and understand the code as part of passive Go learning.

**Tasks:**
- [ ] Create `pkg/config/parser.go`
  - [ ] Implement YAML parsing using `viper`
  - [ ] Define `BackupConfig` struct
  - [ ] Implement getter methods
  - [ ] Handle errors idiomatically
- [ ] Write tests using `testing` + `gomega`
  - [ ] Test valid YAML parsing
  - [ ] Test invalid YAML handling
  - [ ] Test missing file handling
- [ ] Add educational comments
  - [ ] 📚 Links to Go documentation
  - [ ] 💡 PHP comparison notes
  - [ ] ⚠️ Go-specific gotchas

**Interface Contract:**
```go
package config

type Parser struct {
    configPath string
}

func NewParser(configPath string) *Parser {}
func (p *Parser) Parse() (*BackupConfig, error) {}
func (p *Parser) Validate() (*ValidationResult, error) {}

type BackupConfig struct {
    BackupSources    []string
    ResticRepository string
    ResticPassword   string
    ExcludePatterns  []string
    RetentionPolicy  RetentionPolicy
    MirrorLocations  []MirrorPair
}
```

**Learning Goals for User:**
- Understand struct vs class
- Error handling patterns (`error` return values)
- Pointer receivers vs value receivers
- Go's approach to encapsulation (exported vs unexported)

**Deliverables:**
- Functional Go ConfigParser matching PHP behavior
- Complete test coverage
- Educational comments throughout

**Success Criteria:**
- All tests pass
- golangci-lint reports zero errors
- User can explain how it differs from PHP version

---

## Phase 3: Backup Engine (0/5 complete)

[... continues with Phase 3 tasks ...]

---

## Next Session Checklist

Before starting the next session:

1. **Read Context** (2 minutes)
   ```bash
   tail -50 docs/planning/session-log.md
   head -40 docs/planning/implementation-plan.md  # This Quick Status section
   cat docs/planning/decisions.md
   ```

2. **Verify Environment** (1 minute)
   ```bash
   cd php-implementation && composer install
   cd go-implementation && go mod download
   make test  # Should pass (or have no tests yet)
   make lint  # Should pass
   ```

3. **Start Task 2.1**
   - Create `src/Config/ConfigParser.php`
   - Write tests first (TDD approach)
   - Implement parsing logic
   - Add type annotations
   - Run phpstan, fix issues
   - Update session log when done

4. **Session End** (5 minutes)
   - Update session-log.md with completed tasks
   - Mark [x] completed tasks in this document
   - Update Quick Status section above
   - Commit work: `git commit -m "Session YYYY-MM-DD: Brief summary"`

---

## Component Interface Reference

### ConfigParser Interface

**Purpose:** Parse and validate YAML configuration files

**Dependencies:** `symfony/yaml` (PHP), `viper` (Go)

**Methods:**
- `parse()`: Load and parse config file
- `validate()`: Check config validity
- `getConfig()`: Return parsed config object

**Error Handling:**
- File not found → ConfigFileNotFoundException
- Invalid YAML → InvalidConfigException
- Missing required fields → ValidationException

---

## Testing Strategy

### Unit Test Organization

**PHP:**
```
tests/
├── Unit/
│   ├── Config/
│   │   ├── ConfigParserTest.php
│   │   └── ValidatorTest.php
│   └── Backup/
│       └── ResticBackupTest.php
├── Integration/
│   └── BackupFlowTest.php
└── fixtures/
    ├── valid-config.yaml
    └── invalid-config.yaml
```

**Go:**
```
tests/
├── unit/
│   ├── config_test.go
│   └── backup_test.go
├── integration/
│   └── backup_flow_test.go
└── fixtures/
    ├── valid-config.yaml
    └── invalid-config.yaml
```

---

## Progress Tracking Legend

- ✅ Complete - Task finished and verified
- 🔄 In Progress - Currently being worked on
- ⏸️ Not Started - Waiting to begin
- ⚠️ Blocked - Waiting on dependency or external factor
- ❌ Cancelled - No longer needed

---

**End of Excerpt**

**What this demonstrates:**
- Quick Status section for instant context
- Detailed task breakdown with dependencies
- Interface contracts specified upfront
- Success criteria for each task
- Next session checklist
- Progress tracking with checkboxes
- Component specifications

**Full Implementation Plan:** Covers all 6 phases with 27 major tasks, detailed component specs, testing strategy, and complete directory structure.
