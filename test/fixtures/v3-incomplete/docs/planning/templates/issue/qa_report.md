# QA Report

**Issue ID:** [e.g. 20260101-feat-my-feature]
**Date:** YYYY-MM-DD
**Agent:** [Claude / human tester name]

---

## Automated Checks

| Check | Command | Result | Output |
|-------|---------|--------|--------|
| Linting | `npm run lint` | [ ] Pass / [ ] Fail | |
| Formatting | `npm run format:check` | [ ] Pass / [ ] Fail | |
| Unit tests | `npm test` | [ ] Pass / [ ] Fail | |
| Test coverage | `npm run test:coverage` | [ ] Pass / [ ] Fail | |
| Integration tests | `npm run test:integration` | [ ] Pass / [ ] Fail | |
| Security audit | `npm audit` | [ ] Pass / [ ] Fail | |
| Build | `npm run build` | [ ] Pass / [ ] Fail | |

---

## Manual QA Items

Items drawn from the project QA workflow:

### Code Quality
- [ ] Linting passes — no errors or warnings
- [ ] Formatting consistent with project conventions
- [ ] No debug code (console.log, debugger, print statements)
- [ ] No commented-out code blocks
- [ ] No unresolved TODOs

### Testing
- [ ] All existing tests pass — no regressions
- [ ] New tests added for new functionality
- [ ] Tests are meaningful and validate real behavior
- [ ] Edge cases and error paths covered

### Documentation
- [ ] Code comments updated where logic is complex
- [ ] README updated if user-facing changes were made
- [ ] API docs updated if API changed
- [ ] Code examples still valid

### Security
- [ ] No SQL injection risks
- [ ] No XSS vulnerabilities
- [ ] No hardcoded secrets or credentials
- [ ] No known vulnerable dependencies

### Functionality (features and improvements)
- [ ] Feature works as described in the issue
- [ ] Complete user flow tested end-to-end
- [ ] Error handling is graceful and informative

### Pre-Merge
- [ ] All changes committed, no uncommitted work
- [ ] Commit messages are clear and descriptive
- [ ] No unrelated changes included
- [ ] Branch is up to date with parent branch

---

## Blockers

List any failing items that must be resolved before closure:

- [Item 1 — describe what failed and why]
- [Item 2 — describe what failed and why]

_If no blockers, write: None._

---

## Verdict

**PASS** — All required checks passed, no blockers.
**FAIL** — One or more blockers remain (see Blockers section).

**PASS** or **FAIL** (delete the line that does not apply):

**PASS**
