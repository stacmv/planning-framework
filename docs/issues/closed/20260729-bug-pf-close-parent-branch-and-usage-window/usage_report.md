# LLM Usage — 20260729-bug-pf-close-parent-branch-and-usage-window

| Source | Model | Input tok | Output tok | Cache write tok | Cache read tok | Approx cost | Notes |
|---|---|---|---|---|---|---|---|
| auto | claude-opus-4-8 | 4,649 | 139,635 | 285,839 | 22,462,904 | ~$16.53 | window: 2026-07-29T21:04:57+03:00 → close; 124 assistant msgs |

**Approx cost breakdown** (rates per Mtok via `claude-api` skill — input $5.00, output $25.00, cache-write 5m $6.25, cache-read $0.50):
- input: ~$0.02
- output: ~$3.49
- cache write: ~$1.79
- cache read: ~$11.23

**Total approx cost:** ~$16.53

_No non-Claude usage was logged (`usage.md` absent)._

_Auto figures cover **all** Claude Code activity in this project directory during the window, not solely this issue — treat as an upper bound. The window opened at this issue's first commit (2026-07-29 evening), so it also captures the autopilot skill-fix work and the pf-check/test-plan/impl-plan/execute sub-agent runs done in the same session._
