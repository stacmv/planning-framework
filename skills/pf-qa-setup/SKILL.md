---
name: pf-qa-setup
description: Create or update .qa-workflow.md for the current project with appropriate QA commands and checklists
version: 3.0.0
---

Determine the project root (the directory containing `CLAUDE.md` or the current working directory). All file detection and writing happen there.

---

## Phase 1: Detect Project Type

Check which of the following files exist in the project root:

| File | Project type |
|------|-------------|
| `package.json` | Node.js |
| `pyproject.toml` | Python |
| `requirements.txt` | Python |
| `setup.py` | Python |
| `go.mod` | Go |
| `composer.json` | PHP |
| `Makefile` | Make-based (only if none of the above match) |

Rules:
- If exactly one type matches, proceed with it.
- If multiple types match (e.g. `package.json` + `pyproject.toml`), list them all and ask the user: "I found multiple project types: [list]. Which is the primary one for QA purposes?"
- If no files match, ask: "I couldn't detect the project type automatically. Please describe the project (language, build tool, test runner) so I can generate the right QA commands."

Wait for user input before proceeding if either question is needed.

---

## Phase 2: Determine QA Commands

Propose commands based on the detected project type. Read any relevant config files first to use actual script names.

### Node.js
Read `package.json`. Look at the `scripts` section and use the actual script names found there (not assumed defaults). Map them as follows:

- **Lint:** prefer `lint` or `lint:fix`; fall back to `eslint .`
- **Format:** prefer `format` or `format:check`; fall back to noting it may not exist
- **Test:** prefer `test`; check also for `test:unit`, `test:coverage`, `test:integration`, `test:e2e`
- **Type-check:** include if `type-check` or `tsc` script is present
- **Security:** use `npm audit`
- **Build:** prefer `build` or `build:prod`

If a script name in `package.json` differs from the example above, use the actual name.

### Python
- **Lint:** use `ruff check .` if `ruff` is listed in dev dependencies (pyproject.toml or requirements files); otherwise use `flake8`
- **Format:** use `ruff format --check .` or `black --check .` depending on what is configured
- **Test:** use `pytest`; add `pytest --cov` if `pytest-cov` is a dependency
- **Security:** use `pip-audit` if available, otherwise `safety check`

### Go
- **Lint:** `go vet ./...`
- **Format:** `gofmt -l .`
- **Test:** `go test ./...`; add `go test -race ./...` for race detection
- **Security:** `gosec ./...`

### PHP
- **Lint:** `./vendor/bin/phpcs`
- **Format:** `./vendor/bin/phpcbf`
- **Test:** `./vendor/bin/phpunit`
- **Security:** `composer audit`

### Make-based
Read the `Makefile`. List all targets defined (lines matching `^[a-zA-Z][^:]*:`). Use:
- `make lint` if a `lint` target exists
- `make test` if a `test` target exists
- `make build` if a `build` target exists
- `make format` if a `format` target exists
Only include commands for targets that actually exist in the Makefile.

---

## Phase 3: Check for Existing `.qa-workflow.md`

Check whether `.qa-workflow.md` exists in the project root.

**If absent:** Generate a fresh file (Phase 4), then proceed to Phase 5.

**If present:** Read the existing file. Show the user a summary of what would change:
- New commands being added or replacing placeholder examples
- Sections that will be updated
- Sections that will be left untouched

Then ask: "`.qa-workflow.md` already exists. Confirm to update it with the project-specific commands above, or cancel to keep the current file as-is."

Do NOT write anything until the user confirms. If the user cancels, stop here and report that the file was left unchanged.

---

## Phase 4: Generate `.qa-workflow.md` Content

Produce the full file content. Use the structure below, filling in the project-specific commands from Phase 2. The file must be immediately useful to a human reading it directly — use plain English section headers, not machine markers.

Use today's date for `Last Updated`. Use the project root directory name as `[Project Name]` unless a more descriptive name is evident from `package.json` `name` field, `pyproject.toml` `[project] name`, or similar.

---

### File structure to generate

```
# QA Workflow

**Project:** <project name>
**Version:** 2.0
**Last Updated:** <today's date YYYY-MM-DD>

---

## Purpose

Quality assurance checklist that **must pass** before closing any issue.

This workflow ensures:
- Code quality and consistency
- Test coverage
- Documentation completeness
- No regressions
- Security considerations

**Rule:** If QA fails, fix and retry. Don't close issue until all checks pass.

---

## All Issues (Required)

These checks apply to **every** issue regardless of type:

### Code Quality
- [ ] **Linting passes** - Run linter, fix all errors/warnings
- [ ] **Formatting consistent** - Code style matches project conventions
- [ ] **No debug code** - Remove console.logs, debugger statements, print statements
- [ ] **No commented code** - Remove commented-out code blocks
- [ ] **No TODOs** - All TODOs resolved or documented as new issues

**Commands:**
```bash
<lint command>
<format command, if applicable>
```

### Testing
- [ ] **All existing tests pass** - No regressions introduced
- [ ] **New tests added** - New functionality has test coverage
- [ ] **Tests are meaningful** - Tests actually validate behavior
- [ ] **Edge cases covered** - Test error paths and edge cases

**Commands:**
```bash
<test command>
<coverage command, if applicable>
```

### Documentation
- [ ] **Code comments updated** - Complex logic explained
- [ ] **README updated** - If user-facing changes
- [ ] **API docs updated** - If API changes
- [ ] **Examples work** - Code examples still valid

### Security
- [ ] **No security vulnerabilities** - Check for common issues:
  - SQL injection risks
  - XSS vulnerabilities
  - Command injection
  - Path traversal
  - Authentication/authorization bypasses
  - Secrets/credentials hardcoded
- [ ] **Dependencies safe** - No known vulnerable dependencies

**Commands:**
```bash
<security command>
```

---

## Feature Issues (feat, improve)

Additional checks for features and improvements:

### Functionality
- [ ] **Feature works as described** - Matches requirements in prompt.md
- [ ] **User flow tested** - Complete user journey works
- [ ] **Error handling** - Graceful error messages

### Integration
- [ ] **Integration tests pass** - If applicable
- [ ] **Works with existing features** - No conflicts
- [ ] **Performance acceptable** - No major slowdowns

**Commands:**
```bash
<integration/e2e test commands, if applicable>
```

### Documentation
- [ ] **User documentation updated** - How to use the feature
- [ ] **Screenshots/demos** - If UI changes
- [ ] **Migration guide** - If breaking changes

---

## Bug Issues (bug)

Additional checks specific to bug fixes:

### Bug Resolution
- [ ] **Failing test created** - Test that reproduces the bug
- [ ] **Test now passes** - After bug fix
- [ ] **Regression test added** - Prevent bug from returning
- [ ] **Root cause understood** - Document in session-log.md

### Verification
- [ ] **Bug no longer reproduces** - Manual verification
- [ ] **Related areas checked** - No similar bugs elsewhere
- [ ] **User confirmed** - Reporter confirms fix

### Documentation
- [ ] **Bug documented** - Root cause in session-log or decisions.md
- [ ] **Prevention notes** - How to avoid similar bugs

---

## Pre-Merge Checklist

Before merging issue branch to parent:

### Git
- [ ] **All changes committed** - No uncommitted work
- [ ] **Commit messages clear** - Descriptive commit messages
- [ ] **No unrelated changes** - Only issue-related changes included
- [ ] **Branch up to date** - Rebased/merged with parent branch

### Integration
- [ ] **Merge conflicts resolved** - If any
- [ ] **Tests pass on parent branch** - After merge
- [ ] **No breaking changes** - Or properly documented

---

## Post-Merge Verification

After merging to parent branch:

- [ ] **CI/CD passes** - All automated checks pass
- [ ] **Deployment successful** - If auto-deploy enabled
- [ ] **Smoke tests pass** - Basic functionality works
- [ ] **Monitoring normal** - No errors/alerts

---

## Project-Specific Checks

[Customize for your project]

### Performance
- [ ] Load time acceptable
- [ ] API response time <Xms
- [ ] Database queries optimized
- [ ] No N+1 queries introduced

### Accessibility (if applicable)
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast sufficient
- [ ] ARIA labels added

### Browser/Platform Compatibility (if applicable)
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works on mobile

### Database (if applicable)
- [ ] Migrations tested
- [ ] Rollback tested
- [ ] Indexes added where needed
- [ ] No destructive changes

---

## Exemptions & Special Cases

**When to skip certain checks:**
- Documentation-only changes: Skip testing if no code changes
- Hotfixes: May fast-track some checks (document reason)
- Experimental branches: Different QA standards (mark clearly)

**Document any exemptions:**
[If skipping QA checks, document why in issue session-log.md]

---

## QA Commands Reference

```bash
# Linting
<lint command>

# Testing
<test command>
<coverage command, if applicable>

# Security
<security command>

# Build
<build command, if applicable>
```

---

## Automation

**Automated QA (if available):**
- [ ] Pre-commit hooks run linting
- [ ] CI/CD runs tests automatically
- [ ] Automated security scanning
- [ ] Automated dependency updates

**Setup instructions:**
[How to set up automated QA for this project]

---

## QA Failure Handling

**If QA fails:**
1. **Don't close the issue** - Keep working until all checks pass
2. **Fix the failure** - Address the specific failing check
3. **Retry QA workflow** - Run checks again
4. **Document in session-log** - Note what failed and how it was fixed
5. **Mark blocker** - If blocked on external issue

**If repeatedly failing:**
- Consider if requirements need clarification
- Discuss with team/user
- May need to split into multiple issues

---

## Notes

[Add project-specific QA notes here]

**Quality Standards:**
- Code coverage target: X%
- Performance budget: [metrics]
- Supported browsers: [list]
- Accessibility level: WCAG [level]

---

**Version:** 2.0
**Project:** <project name>
**Last Updated:** <today's date YYYY-MM-DD>
```

Replace every `<...>` placeholder with the actual commands from Phase 2. If a command category does not apply (e.g. no build step in a Python CLI tool), omit that line rather than leaving a placeholder.

---

## Phase 5: Confirm and Save

Display the full generated file content to the user. Ask: "Ready to write this as `.qa-workflow.md` in the project root. Confirm?"

Do NOT write the file until the user confirms.

Once confirmed, write the content to `<project-root>/.qa-workflow.md`.

Report: "`.qa-workflow.md` written. Run `/pf-qa` during QA phase to execute these checks against your active issue."
