---
name: pf-qa-setup
description: Create or update .qa-workflow.md for the current project with appropriate QA commands and checklists
version: 4.0.0
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

**Also detect a version-tracking convention, independently of the project type above** — this project's *own* released version, never to be confused with any framework-install marker (e.g. `.pf-version`, which records which Planning Framework version this project *consumes*, not what this project itself ships). Look for a `CHANGELOG.md` at the project root **and** one of: `package.json`'s `version` field, `pyproject.toml`'s `[project] version`, `Cargo.toml`'s `version`, `composer.json`'s `version`, `manifest.json`+`versions.json` (Obsidian plugin convention), or any shell variable matching `[A-Z_]+VERSION="?\d+\.\d+\.\d+"?` in a script at the project root (covers a project that version-stamps itself the way this very framework's own `scripts/pf-cli.mjs` does with `PF_VERSION`). If both a CHANGELOG and a version marker are found, record the version-marker file's path for Phase 4's "Version Bump" section. If either is missing, there is no version-tracking convention to enforce — Phase 4 omits that section entirely rather than inventing one.

---

## Core Rule: Every Checklist Item Must Resolve to a Single Boolean Check

Every item this skill writes into `.qa-workflow.md` — in every phase below — must be one of exactly three kinds. There is no fourth kind ("use your judgment," "review generally," "seems fine") — if a natural checklist item doesn't fit one of these three, rephrase it until it does, or drop it.

1. **`[Automated]`** — a shell command with a clear pass/fail exit code (or a `grep`/count whose output is unambiguous — e.g. "zero matches" = pass). State the exact command inline in the item, not just in a separate commands block.
2. **`[AI check]`** — a single yes/no question a QA agent (running `/pf-qa`) answers by reading specific, named files or running a specific `git diff`/`git log` command — never "does this look right," always "does file X contain/satisfy Y — yes or no."
3. **`[Human check]`** — one concrete action for a person (open this exact file, run this exact command, follow these exact repro steps) plus one yes/no question tied to it. Never a vague instruction like "test the feature" or "verify quality" — always something a person can do in one step and answer Yes or No to.

Applying this rule changes how you fill in every phase below:
- Where the original per-language guidance (Phase 2) or the template (Phase 4) shows a vague item like "Formatting consistent" or "Feature works as described," rewrite it as one of the three kinds above using the project's actual detected tools/files — e.g. `[Automated] <format command> --check exits 0` or `[AI check] read <issue's spec file> and the diff — does the diff implement every acceptance criterion? (Yes/No)`.
- For `Project-Specific Checks` subsections that don't apply to the detected project type (e.g. Accessibility/Browser/Database for a project with no UI or database), do not leave "not applicable" placeholders or unactionable checkboxes. Instead, replace that whole subsection with a single `[Automated]` **scope guard**: a command that asserts the absence of that domain's files (e.g. `git diff --name-only develop...HEAD | grep -E '\.(tsx?|jsx?)$'` returns zero matches for a project with no frontend). If it ever starts failing, that's the signal the project's scope has grown and the full section should be restored.
- For `Post-Merge Verification`/`Automation` sections, only include items if CI/CD or automation actually exists (detected via e.g. `.github/workflows/`, `.gitlab-ci.yml`, existing pre-commit config) — phrase what's found as `[Automated]` checks. If none exists, omit these sections entirely rather than listing unrunnable aspirational items.

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
**Version:** 3.0
**Last Updated:** <today's date YYYY-MM-DD>

---

## Purpose

Quality assurance checklist that **must pass** before closing any issue.

Every item below is one of three kinds:
- **[Automated]** — a shell command with a clear pass/fail exit code.
- **[AI check]** — a single yes/no question answered by reading specific named files.
- **[Human check]** — one concrete action plus one yes/no question.

**Rule:** If QA fails, fix and retry. Don't close issue until all checks pass.

---

## All Issues (Required)

### Code Quality
- [ ] **[Automated] Linting passes** — `<lint command>` exits 0.
- [ ] **[Automated] Formatting consistent** — `<format-check command>` exits 0. (Omit this item entirely if the project has no formatter.)
- [ ] **[Automated] No debug code introduced** — `git diff develop...HEAD | grep -E "^\+.*(console\.log|debugger;|<language-specific print-debug pattern>)"` returns zero matches.
- [ ] **[AI check] No commented-out code left in the diff** — read `git diff develop...HEAD` — is there any added line that reads as disabled/old code rather than an explanatory comment? (Yes/No)
- [ ] **[Automated] No unresolved TODOs introduced by this issue** — `git diff develop...HEAD | grep -E "^\+.*TODO"` returns zero matches.

**Commands:**
```bash
<lint command>
<format-check command, if applicable>
git diff develop...HEAD | grep -E "^\+.*(console\.log|debugger;|TODO)"
```

### Testing
- [ ] **[Automated] Test suite passes** — `<test command>` exits 0.
- [ ] **[Automated] Coverage tool runs clean** — `<coverage command>` exits 0. (Omit if no coverage tool exists.)
- [ ] **[Automated] Every TC in this issue's test_plan.md is marked done** — `grep -c '| \[ \] *|' docs/issues/open/<ISSUE-ID>/test_plan.md` returns `0`.
- [ ] **[Human check] Manual test checklist has been run** — open `docs/issues/open/<ISSUE-ID>/manual_test_checklist.md` — is every checkbox marked and every Result filled in (none left blank)? (Yes/No)

**Commands:**
```bash
<test command>
<coverage command, if applicable>
grep -c '| \[ \] *|' docs/issues/open/<ISSUE-ID>/test_plan.md
```

### Documentation
- [ ] **[AI check] Docs match the change** — read this issue's `prompt.md`/`brd.md` and `git diff --name-only develop...HEAD` — if a user-facing doc (e.g. README, API docs) is implied as needing an update, was it actually touched? (Yes/No — pass automatically if no doc update was implied)

### Security
- [ ] **[Automated] Dependency/security scanner passes** — `<security command>` exits 0.
- [ ] **[Automated] No hardcoded secrets introduced** — `git diff develop...HEAD | grep -iE "^\+.*(api[_-]?key|secret|password|token)\s*=\s*['\"]"` returns zero matches.

**Commands:**
```bash
<security command>
git diff develop...HEAD | grep -iE "^\+.*(api[_-]?key|secret|password|token)\s*=\s*['\"]"
```

### Version Bump

Only include this section if Phase 1 detected a version-tracking convention (a `CHANGELOG.md` plus a version marker file). If not detected, omit this section entirely — same "no aspirational items" rule as the Project-Specific Checks section below.

- [ ] **[AI check] Version bumped or CHANGELOG updated if this change is release-worthy** — read `git diff develop...HEAD` — does it change this project's own shipped behavior (not internal tooling, tests, or docs-only)? If yes, does `<version marker file>` show a version bump, or does `CHANGELOG.md`'s `## [Unreleased]`-equivalent section contain an entry describing this change (whichever this project's own convention uses — a per-change bump, or an accumulating Unreleased section moved to a version heading at explicit release time)? (Yes/No — pass automatically if the change is internal-only/docs-only/test-only)

**Commands:**
```bash
git diff develop...HEAD -- <version marker file> CHANGELOG.md
```

---

## Feature Issues (feat, improve)

- [ ] **[AI check] Diff satisfies every acceptance criterion** — read this issue's `implementation_plan.md` (or `notes.md` for trivial-tier issues) — is every listed acceptance criterion actually satisfied by the diff? (Yes/No)
- [ ] **[Automated] Integration/e2e suite passes** — `<integration/e2e command>` exits 0. (Omit if none exists.)
- [ ] **[AI check] Diff matches declared scope** — compare `git diff --name-only develop...HEAD` against the "Files to Create/Modify" list in `specs.md`/`notes.md` — is every changed file accounted for there? (Yes/No)
- [ ] **[AI check] User documentation updated if this is a user-facing change** — same check as the Documentation item above, restated for feature-specific docs (e.g. a changelog entry, a migration note for breaking changes).

---

## Bug Issues (bug)

- [ ] **[Human check] Bug no longer reproduces** — follow the original repro steps recorded in `analysis.md`/`notes.md` against the fixed code — does the bug still occur? (Yes = fail, No = pass)
- [ ] **[AI check] Root cause addressed** — read `analysis.md`'s stated root cause and the diff — does the diff change the code path identified as the root cause? (Yes/No)
- [ ] **[Automated] Regression test added and passes** — a new test targeting this bug exists and `<test command>` (scoped to it if possible) exits 0. (Omit if the project has no test framework — fall back to the Human check above only.)

---

## Pre-Merge Checklist

- [ ] **[Automated] Working tree clean** — `git status --porcelain` returns empty output.
- [ ] **[Automated] Branch is up to date with parent** — `git merge-base --is-ancestor <parent-branch> HEAD` exits 0.
- [ ] **[AI check] Commit messages are descriptive** — read `git log --oneline <parent-branch>..HEAD` — does every commit message describe what changed (not "wip"/"fix"/"updates")? (Yes/No)
- [ ] **[AI check] No unrelated changes** — same file-list-vs-scope check as the Feature Issues item above, repeated here as the merge gate.

**Commands:**
```bash
git status --porcelain
git merge-base --is-ancestor <parent-branch> HEAD
```

---

## Project-Specific Checks

For each of Performance / Accessibility / Browser-Platform / Database: if the detected project type genuinely involves that domain (a UI, a database, a browser-facing surface), replace this placeholder with real `[Automated]`/`[AI check]`/`[Human check]` items specific to it (e.g. a Lighthouse budget command, an axe-core accessibility scan, a migration-dry-run command). If it does NOT involve that domain, do not list unactionable "not applicable" items — instead write a single scope guard:

- [ ] **[Automated] No <domain> files introduced** — `git diff --name-only develop...HEAD | grep -E '<extension/path pattern for that domain>'` returns zero matches. If this ever fails, the project's scope has grown into that domain — expand this section with real domain-specific checks at that point.

---

## Post-Merge / Automation

Only include this section if CI/CD or pre-commit automation actually exists in the project (detected via `.github/workflows/`, `.gitlab-ci.yml`, `.pre-commit-config.yaml`, or similar). If found, phrase what exists as `[Automated]` items (e.g. "[Automated] CI workflow file is present and includes a test job — `grep -l 'test' .github/workflows/*.yml` returns at least one match"). If nothing exists, omit this section entirely rather than listing aspirational unrunnable items.

---

## Exemptions & Special Cases

**When to skip certain checks:**
- Documentation-only changes: the Testing section's `[Automated]`/`[Human check]` items above already degrade gracefully (they only fail if a test/checklist genuinely exists and is incomplete) — no separate skip logic is needed.
- Hotfixes/experimental branches: document any deliberately-skipped item in the issue's `session-log.md`, naming the item and the reason.

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

[Add project-specific QA notes here — e.g. required local tools like linters/scanners that must be installed for the Automated commands above to run.]

---

**Version:** 3.0
**Project:** <project name>
**Last Updated:** <today's date YYYY-MM-DD>
```

Replace every `<...>` placeholder with the actual commands/paths from Phase 2 (and `<ISSUE-ID>`/`<parent-branch>` with the values `/pf-qa` resolves at run time — leave these two as literal placeholders in the saved file, since they're filled in per-run, not per-project-setup). `<version marker file>` is filled in from the version-tracking convention detected alongside Phase 1 (e.g. `package.json`, `pyproject.toml`); if none was detected, omit the entire "Version Bump" section rather than leaving the placeholder unfilled. If a command category does not apply (e.g. no build step in a Python CLI tool, no coverage tool, no integration suite), omit that entire item/line rather than leaving a placeholder — per the Core Rule above, never leave a vague or unrunnable item in the file.

---

## Phase 5: Confirm and Save

Display the full generated file content to the user. Ask: "Ready to write this as `.qa-workflow.md` in the project root. Confirm?"

Do NOT write the file until the user confirms.

Once confirmed, write the content to `<project-root>/.qa-workflow.md`.

Report: "`.qa-workflow.md` written. Run `/pf-qa` during QA phase to execute these checks against your active issue."
