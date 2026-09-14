# LLM Usage — 20260818-improve-project-explorer-launcher-search-and-tc-scroll

**Issue window (first commit → close):** 2026-08-18T01:27:25+03:00 → 2026-09-14

## Auto-computed (Claude Code, this project directory, full issue window)

| Source | Model | Input tok | Output tok | Cache write tok | Cache read tok | Approx cost |
|---|---|---|---|---|---|---|
| auto | claude-sonnet-5 | 2,215 | 768,132 | 4,340,954 | 508,232,996 | ~$120.18 |
| auto | claude-opus-5 | 1,146 | 535,320 | 2,231,788 | 138,711,708 | ~$96.69 |
| auto | claude-fable-5-1 | 12,905 | 130,364 | 594,665 | 33,514,522 | ~$22.46 |
| auto | claude-haiku-4-5 | 17 | 455 | 17,611 | 45,423 | ~$0.03 |
| auto | glm-5.3 / glm-5.3-flash (non-Anthropic) | 327,302 | 86,603 | — | 8,586,048 | not priced here |

**Total approx cost (Claude models only):** ~$239.36

**⚠️ This figure is not a reliable estimate of this issue's actual cost — treat it as an unusable upper bound, not a report.** The issue's `docs/issues/open/` folder was created on 2026-08-18, but real work on it only happened on 2026-09-09 (BRD/test_plan) and 2026-09-14 (this autopilot run, code/review/test/QA/close). The ~4-week gap between those dates saw substantial unrelated work in this same project directory — at minimum `20260812-bug-flaky-manual-test-ui`, `20260902-feat-idea-stage`, and `20260904-improve-test-suite-runtime` were also worked and closed in that window, per `docs/planning/session-log.md`. The auto-computed window heuristic (Phase 6) sums *all* Claude Code activity in this directory since the issue's first commit, so the figure above is overwhelmingly other issues' work, not this one's.

## Auto-computed (this session's own transcript only — 2026-09-14 autopilot run)

A narrower, more representative figure: just today's `/pf-autopilot` session that actually drove this issue from `/pf-check` through `/pf-close`.

| Source | Model | Input tok | Output tok | Cache write tok | Cache read tok | Approx cost |
|---|---|---|---|---|---|---|
| auto (this session) | claude-sonnet-5 | 386 | 106,557 | 399,985 | 47,150,178 | ~$11.50 |

**This still undercounts real spend**: sub-agent (`Agent` tool) dispatches for individual tasks/fixes may log to separate transcript files not captured by this single-file scan, and the earlier 2026-09-09 session (BRD, test_plan authoring, first pf-check round) is excluded entirely. Treat ~$11.50 as a partial, session-scoped floor, not a total.

## Manual entries (non-Claude LLMs)

No `usage.md` was present in the issue folder — no manually-logged non-Claude usage to merge. The `glm-5.3`/`glm-5.3-flash` entries above are auto-detected from local transcripts (a different provider active in this same project directory during the window) and are not priced here since they fall outside this skill's Claude pricing lookup.

---

**Bottom line:** no reliable total cost figure exists for this issue specifically. The full-window figure (~$239) is dominated by unrelated concurrent work; the session-scoped figure (~$11.50) is a partial floor that misses sub-agent dispatches and the 2026-09-09 planning session. Both are reported for transparency rather than omitted, per this phase's "never fabricate, always show what's derivable" rule — neither should be quoted as "the cost of this issue."
