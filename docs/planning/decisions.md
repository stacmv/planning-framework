# Architecture Decision Log

**Project:** MyProject
**Started:** 2025-11-06
**Last Updated:** 2026-08-25

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
| [ADR-004](#adr-004-document-review-is-path-based--no-issue-branch-required-branch-only-for-code-review) | Document review is path-based — no issue branch required; branch only for code review | Accepted | 2026-08-25 |
| [ADR-005](#adr-005-per-stage-actortier-roles-individual-assignment-at-issue-creation-on_unavailable-policy-aibudget-backed-recommendations) | Per-stage `actor:tier` roles, individual assignment, `on_unavailable`, aibudget recommendations | Accepted | 2026-08-25 |
| [ADR-006](#adr-006-tests-declare-their-issue-with-pf-issue-markers) | Tests declare their issue with `@pf-issue` markers | Accepted | 2026-08-25 |

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

### ADR-004: Document review is path-based — no issue branch required; branch only for code review

**Date:** 2026-08-25
**Status:** Accepted (direct skill edit, no pipeline issue)

#### Context
`pf-check`'s Codex invocation chain reviewed documents through the plugin's diff-based reviewer (`codex-companion.mjs review --scope branch --base <base-ref>`). Planning documents (`brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md`) are written on the parent branch *before* `/pf-execute` creates `issue/<ID>`, so that diff was always empty. The "Off-branch TARGET (AC-5.2)" rule handled this by silently switching the reviewer to `claude`. Net effect: a configured `codex` reviewer never reviewed a single planning document, and agents in consumer projects reported the framework as "cannot send documents to Codex before the branch exists".

#### Options Considered
1. **Path-based Codex invocation for documents** — `codex-companion.mjs task "<brief>" --json` (read-only sandbox, Codex reads the named files), asking Codex for a `review-output.schema.json`-shaped JSON reply; unstructured fallback if it doesn't parse. Small change confined to `pf-check`; reviewer choice is honored. Con: structure depends on Codex following the output instruction.
2. **Create the issue branch at issue creation** so the diff-based reviewer works for documents. Con: changes the branch model across `pf`, `pf-brd`, `pf-execute`, `pf-close`, docs and every open issue.
3. **Leave as is**, document the fallback. Con: `review: [codex]` on document stages stays a no-op.

#### Decision
Option 1. A review target that is a *document* is reviewed by its path on disk, with no branch check and no diff — for every reviewer (`invoke: agent` actors already worked this way). A branch and a diff are required only where the target genuinely *is* a set of changes: `pf-codereview`. The Codex invocation chain in `pf-check` now has two invocation forms — document (`task`, path-based) and code-diff (`review --scope branch`) — and `pf-codereview` references the code-diff form explicitly.

#### Rationale
- The reviewer the user configured must be the reviewer that runs; the branch state may change *how* Codex is called, never *who* reviews.
- Documents have no "changes" to review before the branch exists — reviewing their content is the whole point of `/pf-check`.
- Keeps the branch model untouched.

#### Consequences
**Positive:**
- `review: [codex]` / `claude-writes-codex-reviews` become effective for BRD/spec/test-plan/impl-plan stages.
- One chain, two forms; empty-diff guard stays exactly where it is meaningful (code review).

**Negative:**
- Document-form structure is best-effort: a non-JSON Codex reply is shown unstructured (no P0/P1/P2 mapping), same as the existing raw `codex exec` fallback.
- AC-5.2's "off-branch → Claude" behavior is retired; issues relying on it get a Codex review instead.

---

### ADR-005: Per-stage `actor:tier` roles, individual assignment at issue creation, `on_unavailable` policy, aibudget-backed recommendations

**Date:** 2026-08-25
**Status:** Accepted (direct skill edit, no pipeline issue)

#### Context
Agents in consumer projects (a) forgot to assign reviewers or defaulted to Claude — `/pf`'s only role question was "Which role profile?" recommending `solo-claude` — and (b) had no way to say *which model tier* (fable/opus/sonnet/haiku, or a Codex model) runs a given stage. Separately, `D:/dev/toolbox/aibudget` now knows provider limits (`aibudget status`/`rank`), and the user wants that to drive the recommendation: when Claude or Codex is near its limit, prefer the other. Autopilot runs stages unattended, so anything needing a human answer must be asked at creation.

#### Options Considered
1. **Actor = aibudget executor** (`fable`, `opus`, `codex-sol`… as separate `agents.yml` actors). One namespace with aibudget, but 7+ actors, the `both`/profile/automigration logic (built on one `invoke: agent` + one `codex-companion` actor) would be rewritten, and `codex-sol/terra/luna` are local `models.json` aliases meaningless to other PF users.
2. **`claude`/`codex` + per-stage `write_model`/`review_model` fields.** Minimal migration but two namespaces, 16 extra fields across the role keys, and model ids that the `Agent` tool cannot take as given.
3. **Hybrid `actor:tier`** — actor stays provider-level (`claude`/`codex`), tier is an optional suffix (`claude:opus`, `codex:sol`); `tiers`/`default_tier`/`degrade` live on the actor in `agents.yml`; an optional `executors:` table maps aibudget names. Provider switch and tier degradation become two orthogonal operations; old `roles:` stay valid; aibudget and Codex tiers are optional layers.

#### Decision
Option 3, plus: `/pf` asks role assignment **individually per stage group** (planning docs / code & tests / documentation) with "apply profile X" as one option among the recommendations; recommendations come from `aibudget rank` when `aibudget` is on PATH (static `default_tier` plus an explicit "aibudget unavailable" line otherwise); one per-issue field `on_unavailable: degrade-tier | switch-provider | wait` in `prompt.md`; every dispatching skill runs an availability check (pf-roles, canonical) right before a write/review and records substitutions in the issue `session-log.md`.

#### Rationale
- Backward compatible for free: a bare actor name means `default_tier`.
- Other PF users need only Anthropic tiers; `aibudget`, `models.json`, Codex tiers are opt-in.
- Tier names for `claude` equal the `Agent` tool's model aliases, closing a latent gap where `agents.yml` stored full model ids the tool cannot accept.
- Asking at creation keeps `/pf-autopilot` unattended; the policy field tells it what to do when a model is out of budget.

#### Consequences
**Positive:** explicit per-stage models; Codex actually gets assigned; budget-aware routing; no migration of open issues.
**Negative:** `actor[:tier]` parsing in pf-roles §4 is one more thing consumers must not restate; `aibudget` kinds (`planning` is a placeholder) make document-write recommendations coarser than review/code ones; the availability check adds one `aibudget status` call per dispatch.

---

### ADR-006: Tests declare their issue with `@pf-issue` markers

**Date:** 2026-08-25
**Status:** Accepted (direct skill edit, no pipeline issue)

#### Context
TC numbers restart in every issue (`TC-001`…), so a test's label alone does not identify its issue. `pf-test` attributed a test file to the active issue by heuristic — ISSUE-ID in path/file, or the file being in `git diff develop...HEAD` — which misattributes any test file merely touched on the branch and cannot express a file holding tests from several issues.

#### Options Considered
1. **Per-test `@pf-issue <ID> <TCs>` comment + file-level `@pf-issue <ID>` header as default.** Explicit, handles mixed files, readable by grep.
2. **File header only.** One line per file; cannot express mixed files.
3. **Issue id inside the test name** (`it('TC-001 [id]: …')`). No comments needed, but noisy runner output.

#### Decision
Option 1. `pf-execute` requires the markers on every test the actor writes for the issue and gates on them in Phase 3.5 (Check 4); `pf-test` resolves a test's issue marker-first (own marker → file header) and uses the legacy heuristic only for files with no marker at all, printing `legacy mapping (no @pf-issue marker): <path>` when it does.

#### Rationale
- The marker is written by the same actor that writes the test, at the moment it knows the issue and TCs.
- Legacy files keep working, but the fallback is visible rather than silent.

#### Consequences
**Positive:** unambiguous test → issue → TC attribution; mixed files supported. **Negative:** one comment line per test; existing tests are not back-filled.

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
**Last Updated:** 2026-08-25
