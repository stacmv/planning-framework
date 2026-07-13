# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project conventions

- Source lives in `src/`.
- Run `npm test` before every commit.

# ========================================
# Planning Framework Integration
# ========================================

This project uses the Planning Framework v1.0.

## Session Start

1. Read `docs/prd.md`
2. Read `docs/planning/implementation-plan.md`
3. Read `docs/planning/session-log.md` (last 20 lines)
4. Read `docs/planning/decisions.md`

## Session End

- Update `docs/planning/session-log.md`
- Check off tasks in `docs/planning/implementation-plan.md`
- Record architectural decisions in `docs/planning/decisions.md`

## USER TEXT AFTER THE V1 BANNER

USER-MARKER-AFTER-V1-BANNER — everything from here to EOF was written by the
user *after* the unmarked v1 section was appended. The v1 banner above carries
no HTML-comment delimiters, so converge cannot know where the framework section
ends and this text begins. Therefore converge must NOT delete the banner — it
prints a WARNING with the banner's line number and inserts its own delimited
section (TC-015).

(This file deliberately contains no delimiter literal anywhere: TC-014/TC-015
count the delimiters with grep and expect exactly one after converge.)

- Deploy on Fridays. Yes, really.
- Ping @ops before touching the queue worker.
