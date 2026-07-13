## Planning Framework

**Project:** [Project Name]
**Framework Version:** 3.0

This project uses **Planning Framework v3.0**. All development work is tracked as issues under
`docs/issues/`, and every issue moves through a fixed pipeline of planning documents before any
code is written.

👉 **Read `PLANNING.md` in the repository root for the complete framework instructions.**

### Starting a session

Run **`/pf`** — it reads the active issue, shows which pipeline stages are already complete, and
tells you what to do next. There is no need to read the planning files by hand to orient yourself.

If you are new to the framework, run `/pf-help`.

### The pipeline

```
feat:     CREATE → BRD → SPEC → TEST_PLAN → IMPL_PLAN → EXECUTE → TESTING → QA → CLOSED
improve:  CREATE → BRD → TEST_PLAN → IMPL_PLAN → EXECUTE → TESTING → QA → CLOSED
bug:      CREATE → ANALYSIS → TEST_PLAN → IMPL_PLAN → EXECUTE → TESTING → QA → CLOSED
```

A stage may only start once every stage before it is complete. A document that does not exist, is
empty, or still carries a `TODO: Run /pf-…` marker does **not** count as complete — never work
against such a document, generate it first.

### Agent rules

- One issue per session
- One branch per issue (`issue/YYYYMMDD-type-slug`)
- Update the issue's `session-log.md` after every session
- Check off tasks in `implementation_plan.md` as you complete them
- Run QA (`/pf-qa`, driven by `.qa-workflow.md`) before closing
- Get the user's confirmation before closing an issue

### Key files

| Path | What it is |
|---|---|
| `PLANNING.md` | Framework instructions — **start here** |
| `.qa-workflow.md` | QA checks for this project (run `/pf-qa-setup` if it is missing) |
| `.pf-version` | Machine-readable framework version marker |
| `docs/issues/open/` | Active issues |
| `docs/issues/closed/` | Completed issues |
| `docs/planning/implementation-plan.md` | Roadmap |
| `docs/planning/session-log.md` | Timeline |
| `docs/planning/decisions.md` | Architectural decisions |

### Session end

- Update the issue's `session-log.md`
- Check off completed tasks in the issue's `implementation_plan.md`
- Note blockers and next priorities
- Commit your changes

When closing an issue, use `/pf-close`: it runs the closure checklist (QA, merge, archive the issue
folder, update the global session log and decisions).
