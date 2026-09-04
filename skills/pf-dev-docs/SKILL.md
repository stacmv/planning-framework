---
name: pf-dev-docs
description: Write developer-facing documentation (architecture/ADRs/runbook/deployment notes) for the active issue, resolving write and review roles via pf-roles
version: 3.0.0
---

Determine the active issue by scanning `docs/issues/open/` for [ISSUE-ID].

## Resolve role — `dev_docs`

Resolve the role for the `dev_docs` key per `~/.claude/skills/pf-roles/SKILL.md` (§4's fallback order), reading `docs/issues/open/[ISSUE-ID]/prompt.md`'s frontmatter (`roles:`/`profile:`).

**If the resolved role is `skip`** — whether from an explicit `roles.dev_docs: skip`, a profile's point-specific entry for `dev_docs`, or the tier-default fallback for `size_tier: trivial`/`small` (`pf-roles` §4, level 3) — report that the dev-docs stage is declared skipped for this issue, naming which of the three reasons applied, and stop. Write nothing, dispatch nothing to any actor, run no review.

Otherwise the resolved role carries `write` (exactly one actor) and `review` (a list + `mode: parallel|sequential`, per `pf-roles` §1).

## Write `dev_docs.md`

Read `docs/issues/open/[ISSUE-ID]/prompt.md` and whichever of `brd.md`/`specs.md`/`implementation_plan.md`/`code_review.md` exist in the same folder, plus the issue's actual code diff, for context on what this issue actually changed.

I want you to help me write developer-facing documentation for issue [ISSUE-ID] — architecture notes, ADRs (decisions made and why), runbook entries, and deployment notes that need to change because of this issue. Do not include user-facing how-to content — that belongs to `user_docs.md`. Use the AskUserQuestion tool to ask clarifying questions until you are 95% confident you can complete this task successfully. For each question, add your recommendation (with reason why) below the options. Front-loaded check: if `prompt.md`'s `interaction` field resolves to `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule"), apply that rule instead of asking this question interactively. This entire loop is skipped and `dev_docs.md` is written from the available predecessor documents alone, gaps recorded as `[assumed]`.

**Documentation language:** read the `doc_language` field from `prompt.md`'s YAML frontmatter (default: English if absent). Write prose in that language; keep headings and structural labels in English.

Once confident:

- **If `write == claude` and the resolved tier is `claude`'s `default_tier`** — this session saves `docs/issues/open/[ISSUE-ID]/dev_docs.md` directly. Write it directly — no sub-agent dispatch.
- **If `write == claude` with a non-default tier** (e.g. `claude:opus`) — run the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11), then dispatch a sub-agent via the `Agent` tool with `model: <tier>` (§9) instead of saving inline, built per §7's "Prompt shape for a from-scratch pipeline document" (folding in this run's clarified answers), and read `dev_docs.md` back from disk once it returns.
- **If `write != claude`** (in this issue, only `codex`) — run the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11); this session still runs the clarifying-questions loop above itself (delegated actors cannot call `AskUserQuestion`), then delegates the actual write to the resolved actor's write-invocator per `~/.claude/skills/pf-roles/SKILL.md` §7, targeting `docs/issues/open/[ISSUE-ID]/dev_docs.md` with a single prompt built per §7's shape (the target path, `prompt.md`'s path, the requirements clarified in this run, `doc_language`, and the section guidance above) — a from-scratch pipeline document, so use §7's asynchronous case — and reads the resulting `dev_docs.md` back from disk once the call returns.

`dev_docs.md` must exist and be non-empty when this step finishes — `~/.claude/skills/pf-qa/SKILL.md`'s prerequisite check for this stage depends on it.

## Review `dev_docs.md`

The role resolved above already carries `roles.dev_docs.review` — `{ mode: parallel, by: [...] }` or `{ mode: sequential, by: [...] }`, per `~/.claude/skills/pf-roles/SKILL.md` §1. Treat `dev_docs.md` as TARGET, with `specs.md`/`implementation_plan.md`/`code_review.md` (whichever exist) as predecessor documents. Run the review exactly the way `~/.claude/skills/pf-check/SKILL.md` runs a review for any TARGET it checks — this section only routes to those mechanics, it does not restate them:

- **Claude review path** — `pf-check`'s "Claude review path" (dispatch a sub-agent with TARGET + predecessors). Skip `pf-check`'s tier-budget-check paragraph — there is no document-size budget defined for `dev_docs.md`.
- **Codex review** — `pf-check`'s "Codex invocation chain" (canonical) and "Severity → priority mapping" (canonical).
- **`{ mode: parallel, by: [claude, codex] }`** — `pf-check`'s "`both`-mode aggregation".
- **`{ mode: sequential, by: [...] }`** — mechanics defined in `~/.claude/skills/pf-roles/SKILL.md` §6; carried out the way `pf-check`'s "Sequential review mode" section describes for a consumer skill (findings from each reviewer dispatched to the resolved `write` actor for an automatic fix between passes, final report split into `[<actor>, pass N]` blocks).

After findings are produced, present them and run the same three-option gate `pf-check` runs ("Fix now" / "I'll fix manually" / "Skip and continue"), dispatching any fix to this stage's resolved `write` actor — a Claude sub-agent if `write == claude`, or the write-invocation form from `pf-roles` §7 with the "apply these findings to an existing file" prompt from `pf-roles` §6 otherwise — same as `pf-check`'s "If 'Fix now'" section. If this run was invoked with the argument `autopilot` (`pf-autopilot` passes it), apply `pf-check`'s autopilot auto-decision rule (any P0/P1 finding → Fix now; P2-only or none → Skip and continue) and log it in `session-log.md` the same way, marked `[autopilot default]`.

## Close the stage: commit & push

As the last action of this skill — after the review gate is settled — run the shared commit & push procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push"). Do not restate it here: it defines what to stage (`dev_docs.md`, plus any file the fix actor edited, plus `prompt.md` if the `reviewers:` → `roles:` automigration fired for this issue during this same invocation — see `pf-git`'s per-row qualifier), the commit message, the push guard, and the one-line report. A stage is not finished until its document is committed and pushed.
