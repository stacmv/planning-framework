# Planning Framework v2.0 — Reference

**Framework Version:** 2.0

This copy of the framework guide was installed into the project by
`setup-planning-v2.sh`, with all paths rewritten to the v2 layout.

## Layout

```
planning/
├── issues/open/      # active issues
├── issues/closed/    # archived issues
├── scripts/          # helper scripts (issue-status.sh)
├── templates/        # copies of the framework templates
├── implementation-plan.md
├── session-log.md
└── decisions.md
PLANNING.md           # framework config (v2)
.qa-workflow.md       # QA gates (v2)
```

## Issue lifecycle

```
CREATE → ANALYZE → PLAN → IMPLEMENT → QA → CLOSE
```

Each issue folder holds `prompt.md`, `analysis.md`, `implementation-plan.md`
and, optionally, `definition-of-done.md`.

See `PLANNING.md` for the full instructions.
