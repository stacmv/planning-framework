# Architecture Decision Log

**Project:** MyProject
**Started:** 2025-11-06
**Last Updated:** 2026-07-10

---

## Purpose

This document records significant architectural and implementation decisions made during development. Each decision includes context, alternatives considered, rationale, and consequences.

**Why document decisions?**
- Prevents revisiting settled questions
- Explains "why" to future developers (including future you)
- Provides historical context for architecture
- Helps onboard new team members
- Supports AI assistants in maintaining consistency

---

## Format

Each decision includes:
- **Date** - When decision was made
- **Status** - Current state of the decision
- **Context** - What problem are we solving?
- **Options Considered** - What alternatives did we evaluate?
- **Decision** - What did we choose?
- **Rationale** - Why did we choose this?
- **Consequences** - What are the implications?

---

## Decision Index

Quick reference to all decisions:

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](#adr-001-decision-title) | [Decision Title] | Accepted | 2025-11-06 |
| [ADR-002](#adr-002-release-branch-model--develop-trunk--main-release-installed-via-main) | Release branch model — `develop` (trunk) + `main` (release), installed via `main` | Accepted | 2026-07-10 |
| [ADR-003](#adr-003-decision-title) | [Decision Title] | Superseded | 2025-11-06 |

---

## Decisions

### ADR-001: [Decision Title]

**Date:** 2025-11-06
**Status:** Proposed | Accepted | Superseded | Deprecated

#### Context

[What problem are we solving? What constraints exist? What triggered this decision?]

**Background:**
- Current situation: [Description]
- Problem: [What's not working or needs to be decided]
- Constraints: [Technical, time, budget, or other limitations]

#### Options Considered

**Option 1: [Option Name]**
- Description: [How this would work]
- Pros:
  - [Advantage 1]
  - [Advantage 2]
- Cons:
  - [Disadvantage 1]
  - [Disadvantage 2]

**Option 2: [Option Name]**
- Description: [How this would work]
- Pros:
  - [Advantage 1]
  - [Advantage 2]
- Cons:
  - [Disadvantage 1]
  - [Disadvantage 2]

**Option 3: [Option Name]**
- Description: [How this would work]
- Pros: [...]
- Cons: [...]

#### Decision

**We chose: [Option Name]**

[1-2 sentence summary of the decision]

#### Rationale

[Explain WHY this option was chosen. This is the most important section.]

**Key factors:**
- Factor 1: [Explanation]
- Factor 2: [Explanation]
- Factor 3: [Explanation]

**Trade-offs accepted:**
- [What we're giving up by choosing this option]
- [Why the trade-off is acceptable]

#### Consequences

**Positive:**
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

**Negative:**
- [Trade-off or limitation 1]
- [Trade-off or limitation 2]
- [Mitigation strategy, if any]

**Neutral (implications to be aware of):**
- [Implication 1]
- [Implication 2]

#### Implementation Notes

[Optional: Specific guidance for implementing this decision]

- [Note 1]
- [Note 2]

#### Related Decisions

- Relates to [ADR-XXX]
- Supersedes [ADR-XXX]
- Superseded by [ADR-XXX]

---

### ADR-002: [Next Decision]

[Repeat structure above]

---

---

### ADR-002: Release branch model — `develop` (trunk) + `main` (release), installed via `main`

**Date:** 2026-07-10
**Status:** Accepted (created in issue [20260706-improve-onboarding-tui](../issues/closed/20260706-improve-onboarding-tui/))

#### Context

Until 2026-07-10 the repository had a single branch `develop` (CLAUDE.md: "Trunk branch: `develop`"). When the one-command installer (`curl -fsSL https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/install.sh | sh`) was designed, it had to choose which branch to clone from. Two models are common for projects that ship a `curl|sh` installer:

1. The installer clones the trunk (`develop` in our case) — every `curl|sh` always gets the absolute latest commit, including in-progress merges.
2. The installer clones a dedicated release branch (e.g. `main`) that only receives merges from the trunk, so `curl|sh` always gets a stable, post-merge snapshot.

The same question applied to the `update` step (`git fetch && git reset --hard origin/<branch>`) and to the README snippets (`raw.githubusercontent.com/.../<branch>/scripts/install.sh`).

`develop` is currently GitHub's default branch and PRs target it (per the project's workflow: feature branches merge to `develop`).

#### Options Considered

**Option 1 (recommended):** Keep `develop` as trunk (PRs, day-to-day development), create a dedicated `main` branch as the release branch. Installer URLs, `git clone -b`, `fetch origin`/`reset --hard origin` all target `main`. Releases are performed by merging `develop` → `main`. `develop` remains the GitHub default branch so PRs keep targeting it.
- Pros: Stable `curl|sh` payload (mid-merge trunk states never leak to installer users); minimal change to existing workflow (no PR-routing change); `git clone` (no `-b`) still gets the active development copy.
- Cons: Requires an explicit `release` step (merge `develop` → `main`) when shipping — adds one manual action per release.

**Option 2:** Installer targets `develop` directly.
- Pros: Zero release overhead; users always get the freshest code.
- Cons: A `curl|sh` running during a merge into `develop` may pull a half-merged state; the very motivation for `curl|sh` (zero-friction install) is undermined by an unstable payload.

**Option 3:** Make `main` the GitHub default branch; use `develop` as a long-lived feature branch.
- Pros: Symmetric with GitHub-flow conventions.
- Cons: PRs would target `main` by default in the GitHub UI, contradicting the existing trunk model where feature branches merge to `develop`. Larger disruption.

#### Decision

**We chose Option 1.** `develop` remains the trunk (feature branches are created from and merged back into `develop`; PRs target `develop`). A new branch `main` was created on 2026-07-10 pointing at the same commit as `develop` at creation time (`027d310`). The installer, README snippets, and `git fetch origin main && git reset --hard origin/main` all pin to `main`. Releases are performed by merging `develop` → `main`.

The branch model is documented in `README.md` ("One-Command Install" section) and in the implementation plan / spec for the issue.

#### Rationale

The `curl|sh` payload is the project's most visible artifact to a first-time user. Stability of that artifact matters more than release overhead. Keeping `develop` as the default branch preserves the established workflow with no PR-targeting change.

#### Consequences

**Positive:**
- Stable installer: `curl|sh` always resolves to a known release commit.
- No PR-routing change; existing `feature-branch → develop` workflow unchanged.
- `reset --hard origin/main` (instead of `pull --ff-only`) gives idempotent, error-free updates under `set -e`, even if the local clone has drifted (AC-8 of the issue).

**Negative:**
- Releases require an explicit `git checkout main && git merge develop && git push origin main` step.
- The `main` branch must be kept in sync — if a feature ships to `develop` but `develop` is not merged to `main`, the installer ships the previous release.

**Mitigation:** Issue / checklist for releases should include "merge `develop` → `main` and push" as the last step.

#### Related Decisions

- Relates to issue [20260706-improve-onboarding-tui](../issues/closed/20260706-improve-onboarding-tui/) (Tasks 6–9: installer + shim + README).
- Conflicts with a hypothetical "Option 3" future where `main` becomes the default branch — explicitly rejected above.

---

## Common Decision Categories

Use these examples as templates for different types of decisions:

### Technology Choice Template

```markdown
### ADR-XXX: [Technology Name] for [Purpose]

**Date:** 2025-11-06
**Status:** Accepted

#### Context
Need to choose [type of technology] for [purpose/use case].

Requirements:
- [Requirement 1]
- [Requirement 2]

#### Options Considered
1. **[Tech 1]:** [Pros/Cons]
2. **[Tech 2]:** [Pros/Cons]
3. **[Tech 3]:** [Pros/Cons]

#### Decision
Chose [Technology] because [primary reason].

#### Consequences
- Team needs to learn [new skills]
- [Integration consideration]
- [Performance impact]
```

### Architecture Pattern Template

```markdown
### ADR-XXX: [Pattern Name] Pattern

**Date:** 2025-11-06
**Status:** Accepted

#### Context
System needs to [handle some concern]. Current approach is [description of problem].

#### Options Considered
1. **[Pattern 1]:** [How it works, pros/cons]
2. **[Pattern 2]:** [How it works, pros/cons]

#### Decision
Implement [Pattern Name] pattern because [scalability/maintainability/etc.].

#### Consequences
- Code structure: [How code will be organized]
- Testing: [How this affects testing]
- Performance: [Impact on performance]
```

### Data Model Template

```markdown
### ADR-XXX: [Data Model Decision]

**Date:** 2025-11-06
**Status:** Accepted

#### Context
Need to decide how to [store/structure/relate] data for [feature].

#### Options Considered
1. **[Approach 1]:** [Schema/structure, pros/cons]
2. **[Approach 2]:** [Schema/structure, pros/cons]

#### Decision
Use [approach] because [data access patterns/query needs/etc.].

#### Consequences
- Migration: [How to migrate existing data]
- Performance: [Query performance implications]
- Flexibility: [Future schema changes]
```

---

## Status Definitions

- **Proposed:** Decision is being considered but not yet accepted
- **Accepted:** Decision is approved and being implemented
- **Superseded:** Decision has been replaced by a newer decision (reference the ADR that supersedes it)
- **Deprecated:** Decision is no longer valid but kept for historical context

---

## Best Practices

### When to Create an ADR

Create an ADR when deciding:
- ✅ Technology choices (framework, database, library)
- ✅ Architecture patterns (MVC, microservices, event-driven)
- ✅ Data models and schemas
- ✅ API design approaches
- ✅ Testing strategies
- ✅ Deployment and infrastructure
- ✅ Security approaches
- ✅ Third-party integrations

**Don't create ADRs for:**
- ❌ Trivial implementation details
- ❌ Obvious choices with no alternatives
- ❌ Temporary workarounds
- ❌ Bug fixes (unless they reveal architectural issues)

### Writing Good ADRs

**Good ADR characteristics:**
- ✅ Focuses on "why" not "how"
- ✅ Lists concrete alternatives considered
- ✅ Explains trade-offs explicitly
- ✅ Written at the time of decision (not retroactively)
- ✅ Concise but complete (1-2 pages max)

**Poor ADR characteristics:**
- ❌ Only documents the chosen option
- ❌ Lacks rationale ("because it's better")
- ❌ Too detailed about implementation
- ❌ Written long after decision was made

### Updating ADRs

- **Never edit past decisions** - They represent a point in time
- **Mark as superseded** if decision changes, then create new ADR
- **Link related ADRs** to show decision evolution
- **Add clarifications** in "Implementation Notes" if needed

---

## Template for Quick Copy-Paste

```markdown
## ADR-XXX: [Brief Title]

**Date:** 2025-11-06
**Status:** Proposed | Accepted | Superseded | Deprecated

### Context
[What problem are we solving? What constraints exist?]

### Options Considered
1. **[Option A]:** [Description, pros/cons]
2. **[Option B]:** [Description, pros/cons]
3. **[Option C]:** [Description, pros/cons]

### Decision
[What did we choose? 1-2 sentences]

### Rationale
[Why did we choose this option?]
- Reason 1
- Reason 2

### Consequences
**Positive:**
- [Benefit 1]
- [Benefit 2]

**Negative:**
- [Trade-off 1]
- [Trade-off 2]
```

---

**Log Started:** 2025-11-06
**Last Updated:** 2026-07-10
