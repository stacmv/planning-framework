# Test Plan: Planning Framework v3.0

**Date:** 2026-06-22
**Satisfies:** BRD AC-01a through AC-07c

---

## Overview

Verifies that the v3.0 Planning Framework installs correctly into a consumer project,
that all skill commands activate and produce the right documents, that consistency
checks work, that the migration script handles v2.0 projects correctly, and that
PLANNING.md remains useful for non-Claude agents.

## Prerequisites

- Planning Framework v3.0 repo checked out at `/home/stac/dev/planning-framework`
- A blank test project directory available (e.g. `/tmp/pf-test-project`)
- A v2.0 consumer project available for migration testing (e.g. `/tmp/pf-v2-project`)
- Claude Code CLI available

---

## Test Cases

### TC-001: Setup script creates correct structure

**Description:** Verifies `setup-planning-v3.sh` installs all required folders and skill files.

**Preconditions:**
- `/tmp/pf-test-project` is empty

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `scripts/setup-planning-v3.sh` targeting `/tmp/pf-test-project` | Script runs without error |
| 2 | Check `docs/issues/open/` exists | Directory present |
| 3 | Check `docs/issues/closed/` exists | Directory present |
| 4 | Check `.claude/skills/` exists | Directory present |
| 5 | List `.claude/skills/` | Contains: pf.md, pf-brd.md, pf-spec.md, pf-check.md, pf-test-plan.md, pf-impl-plan.md, pf-execute.md |
| 6 | Check `docs/planning/session-log.md` | File exists with correct template |

**Priority:** Critical

---

### TC-002: /pf orchestrator — no active issue

**Description:** `/pf` correctly reports when there are no active issues.

**Preconditions:** TC-001 passed; no folders in `docs/issues/open/`

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `/pf` in Claude Code | Skill activates |
| 2 | Read skill output | Shows installed version number |
| 3 | Read skill output | States "no active issue" and explains how to create one |

**Priority:** High

---

### TC-003: /pf orchestrator — detects active feat issue and stage

**Description:** `/pf` detects issue type and which stage documents are present.

**Preconditions:** TC-001 passed; `docs/issues/open/20260622-feat-test/` exists with only `prompt.md` inside

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `/pf` | Outputs: "Active issue: 20260622-feat-test (type: feat)" |
| 2 | Read output | Completed stages: CREATE |
| 3 | Read output | Next step: `/pf-brd` |

**Priority:** High

---

### TC-004: /pf-brd creates brd.md for feat issue

**Description:** BRD skill runs the correct prompt and saves output to the right path.

**Preconditions:** TC-003 passed; `docs/issues/open/20260622-feat-test/prompt.md` contains a feature description

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `/pf-brd` | Skill activates |
| 2 | Skill asks clarifying questions | AskUserQuestion tool is used at least once |
| 3 | Answer questions | Skill proceeds to write BRD |
| 4 | Check file | `docs/issues/open/20260622-feat-test/brd.md` exists |
| 5 | Open brd.md | Contains User Stories section |
| 6 | Open brd.md | Contains Acceptance Criteria |
| 7 | Open brd.md | Contains NO technical implementation details |

**Priority:** Critical

---

### TC-005: /pf-spec creates specs.md and requires brd.md

**Description:** Spec skill reads BRD and produces a technical spec.

**Preconditions:** TC-004 passed

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `/pf-spec` | Skill reads brd.md |
| 2 | Skill asks clarifying questions | AskUserQuestion used |
| 3 | Check file | `docs/issues/open/20260622-feat-test/specs.md` exists |
| 4 | Open specs.md | References BRD user stories |
| 5 | Open specs.md | Contains technical architecture or file structure |

**Priority:** Critical

---

### TC-006: /pf-check detects inconsistency between spec and BRD

**Description:** Check skill flags a deliberate inconsistency.

**Preconditions:** TC-005 passed; manually edit specs.md to add a feature not in BRD

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `/pf-check` | Skill reads brd.md and specs.md |
| 2 | Read output | Lists at least one P0 or P1 inconsistency (the deliberately added feature) |
| 3 | Read output | No files modified |
| 4 | Read output | Asks whether to address issues before proceeding |

**Priority:** Critical

---

### TC-007: /pf-test-plan creates test_plan.md

**Description:** Test plan skill produces a file with TC-NNN formatted cases and a status tracker.

**Preconditions:** TC-005 passed; `brd.md` and `specs.md` exist

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `/pf-test-plan` | Skill reads brd.md and specs.md |
| 2 | Check file | `docs/issues/open/20260622-feat-test/test_plan.md` exists |
| 3 | Open file | Contains at least 3 test cases in TC-NNN format |
| 4 | Open file | Status Tracker table present |
| 5 | Open file | Known Issues section present |

**Priority:** Critical

---

### TC-008: /pf-check after test plan catches BRD gap

**Description:** Second check stage flags test cases that don't cover a BRD acceptance criterion.

**Preconditions:** TC-007 passed; manually remove one acceptance criterion from test_plan.md

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `/pf-check` | Skill reads brd.md and test_plan.md |
| 2 | Read output | Flags the missing acceptance criterion coverage |

**Priority:** High

---

### TC-009: /pf-impl-plan creates implementation_plan.md

**Description:** Implementation plan maps tasks to TC-NNN codes.

**Preconditions:** TC-007 passed

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `/pf-impl-plan` | Skill reads brd.md, specs.md, test_plan.md |
| 2 | Check file | `docs/issues/open/20260622-feat-test/implementation_plan.md` exists (underscore, not hyphen) |
| 3 | Open file | Each task lists mapped TC codes |
| 4 | Open file | Dependency/wave order described |
| 5 | Open file | Complexity estimate present |

**Priority:** Critical

---

### TC-010: /pf-execute creates and runs tasks

**Description:** Execute skill creates TaskCreate entries and processes them via sub-agents.

**Preconditions:** TC-009 passed; implementation_plan.md has at least 2 tasks

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `/pf-execute` | Skill reads implementation_plan.md and test_plan.md |
| 2 | Observe Phase 1 | Tasks created via TaskCreate with correct dependencies |
| 3 | Observe Phase 2 | Tasks processed in dependency-wave order |
| 4 | Observe Phase 3 | Summary lists files created/modified |

**Priority:** High

---

### TC-011: Bug issue — correct document set, no specs.md

**Description:** Bug issues get analysis.md not brd.md, and never get specs.md.

**Preconditions:** TC-001 passed; `docs/issues/open/20260622-bug-test/prompt.md` exists

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `/pf` | Shows "type: bug", next step is root cause analysis (not /pf-brd) |
| 2 | After analysis.md created, invoke `/pf-test-plan` | Creates test_plan.md |
| 3 | Check directory | specs.md is NOT present |
| 4 | After test_plan.md, invoke `/pf-impl-plan` | Creates implementation_plan.md |

**Priority:** High

---

### TC-012: Improve issue — correct document set, no specs.md

**Description:** Improve issues get BRD but not specs.md.

**Preconditions:** TC-001 passed; `docs/issues/open/20260622-improve-test/prompt.md` exists

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `/pf` | Shows "type: improve", next step: `/pf-brd` |
| 2 | After brd.md, invoke `/pf-test-plan` | Creates test_plan.md (skips spec) |
| 3 | Check directory | specs.md is NOT present |

**Priority:** High

---

### TC-013: update-skills.sh updates changed skill file

**Description:** `update-skills.sh` copies skill files and correctly reports status.

**Preconditions:** TC-001 passed; `.claude/skills/pf.md` exists in test project

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Modify `skills/pf.md` in the framework repo (add one word) | File changed |
| 2 | Run `update-skills.sh` from test project | Script runs without error |
| 3 | Read output | Reports `[updated] pf.md` |
| 4 | Read output | Other files reported as `[unchanged]` |
| 5 | Check `.claude/skills/pf.md` in test project | Contains the new word |

**Priority:** High

---

### TC-014: migrate-v2-to-v3.sh renames implementation-plan.md

**Description:** Migration renames hyphenated file to underscored file.

**Preconditions:** v2.0 consumer project at `/tmp/pf-v2-project` with an open issue containing `implementation-plan.md`

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `migrate-v2-to-v3.sh` on `/tmp/pf-v2-project` | Runs without error |
| 2 | Check issue folder | `implementation_plan.md` exists |
| 3 | Check issue folder | `implementation-plan.md` does NOT exist |
| 4 | Check issue folder | `test_plan.md` stub exists |
| 5 | Check scripts/ | `create-issue.sh` removed |
| 6 | Check scripts/ | `close-issue.sh` removed |
| 7 | Read migration report | Lists all changes made |

**Priority:** High

---

### TC-015: PLANNING.md is ~200 lines and multi-agent usable

**Description:** Confirms PLANNING.md was slimmed and retains essential multi-agent content.

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `wc -l PLANNING.md` | Line count ≤ 220 |
| 2 | Search for `/pf` reference | Present — one-line note for Claude Code users |
| 3 | Search for `[Gemini CLI]` | Present — multi-agent tracking format described |
| 4 | Search for issue naming convention | `YYYYMMDD-{type}-{slug}` documented |
| 5 | Verify no Claude-specific workflow steps remain | No "read PLANNING.md, read session-log.md" ritual steps |

**Priority:** High

---

### TC-016: Skill version is visible in /pf output

**Description:** Installed skill version is displayed by the orchestrator.

**Preconditions:** TC-001 passed

**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke `/pf` | Output contains "v3.x.x" version string |

**Priority:** Medium

---

## Status Tracker

| TC | Test Case | Priority | Status | Remarks |
|----|-----------|----------|--------|---------|
| TC-001 | Setup script creates correct structure | Critical | [ ] | |
| TC-002 | /pf — no active issue | High | [ ] | |
| TC-003 | /pf — detects active feat issue | High | [ ] | |
| TC-004 | /pf-brd creates brd.md | Critical | [ ] | |
| TC-005 | /pf-spec creates specs.md | Critical | [ ] | |
| TC-006 | /pf-check detects spec vs BRD inconsistency | Critical | [ ] | |
| TC-007 | /pf-test-plan creates test_plan.md | Critical | [ ] | |
| TC-008 | /pf-check after test plan catches BRD gap | High | [ ] | |
| TC-009 | /pf-impl-plan creates implementation_plan.md | Critical | [ ] | |
| TC-010 | /pf-execute creates and runs tasks | High | [ ] | |
| TC-011 | Bug issue — correct document set | High | [ ] | |
| TC-012 | Improve issue — correct document set | High | [ ] | |
| TC-013 | update-skills.sh updates changed skill file | High | [ ] | |
| TC-014 | migrate-v2-to-v3.sh renames and cleans up | High | [ ] | |
| TC-015 | PLANNING.md slimmed and multi-agent usable | High | [ ] | |
| TC-016 | Skill version visible in /pf output | Medium | [ ] | |

---

## Known Issues

| Issue | Description | TC Affected | Severity |
|-------|-------------|-------------|----------|
| — | None at this time | — | — |
