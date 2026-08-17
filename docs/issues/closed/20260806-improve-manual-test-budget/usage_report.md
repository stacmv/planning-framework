# LLM Usage — 20260806-improve-manual-test-budget

| Source | Model | Input tok | Output tok | Cache tok (write / read) | Approx cost | Notes |
|---|---|---|---|---|---|---|
| auto | claude-opus-5 | 18,249 | 263,158 | 2,522,265 / 130,233,298 | ~$87.55 | window: 2026-08-06T22:25:54+03:00 → close |
| auto | claude-sonnet-5 | 3,170 | 353,152 | 3,992,360 / 233,954,760 | ~$60.31 | intro pricing $2/$10 per Mtok (in effect through 2026-08-31) |
| auto | claude-haiku-4-5-20251001 | 19,450 | 1,946 | 1,078,869 / 17,988,896 | ~$3.18 | dispatched per explicit user cost directive for sub-agents |
| auto | \<synthetic\> | 0 | 0 | 0 / 0 | $0.00 | 2 non-billed synthetic entries, no usage |
| manual | — | — | — | — | — | no `usage.md` found — no non-Claude usage logged |

**Total approx cost:** ~$151.04

**Pricing basis:** Opus 5 $5/$25 per Mtok (input/output), Sonnet 5 $2/$10 per Mtok (introductory rate, in effect through 2026-08-31), Haiku 4.5 $1/$5 per Mtok — from the `claude-api` skill's cached pricing table. Cache tokens are priced using the standard 5-minute-TTL assumption (write ≈1.25× input rate, read ≈0.1× input rate) since per-message cache TTL isn't recorded in the transcripts — actual cost may differ slightly if any requests used the 1-hour TTL.

**Coverage caveat — this is a heuristic upper bound, not an isolated per-issue figure.** The window (`2026-08-06T22:25:54+03:00` → now, ~11 days) captures **all** Claude Code activity in the `planning-framework` project directory during that span, not solely this issue:
- Includes framework meta-work done earlier in the same overall session (the version-bump-on-close mechanism and the `codex-implements` role-profile fix — both unrelated to this issue).
- Includes ~30+ haiku sub-agent dispatches (109 nested `subagents/*.jsonl` transcripts) driven by this issue's `/pf-autopilot` run.
- Includes the tail end of this very close operation (Phase 6 computation, the weekly-plan edit, this report) — necessarily included since it's still running inside the same window.
- 120 `.jsonl` files were scanned in total (top-level session transcripts + nested `subagents/*.jsonl`), deduped by `(message.id, model)`.

Treat the total as a ceiling on what this issue could have cost, not a precise attribution.
