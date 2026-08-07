# Code Review Report

**Issue ID:** 20260806-feat-role-matrix
**Date:** 2026-08-07
**Reviewer(s):** Claude + Codex

---

## Findings

### Previous rounds — resolution status

Rounds 1-3 (12 findings total) all confirmed **RESOLVED** on re-review by both reviewers across multiple independent passes, no half-fixes or new contradictions found. Finding #11 (specs.md/implementation_plan.md drift, out of diff scope) remains an open pre-`/pf-close` cleanup item, not a code-review blocker.

### P1 (Important) — new this round

14. **[Codex] `pf-codereview` Phase 1.5 honors a *declined* `code.review: skip` confirmation as if it were confirmed.** When `roles.code.review: skip` has no `confirmed:` marker, the phase asks the user to confirm — but the text says "either way" (confirmed yes, or the question just having been asked) skip Phase 2/3's normal review and write `verdict: SKIPPED`. If the user answers **no**, review should not be silently skipped — the hard gate is being bypassed without actual confirmation. Needs an explicit "no" branch: do not write `confirmed:`, do not skip review — fall through to normal Phase 2 review instead (as if `code.review` were not `skip` at all, or at minimum stop with a message that the issue's `roles.code.review: skip` is unconfirmed and cannot proceed until either confirmed or changed).

### P2 (Minor) — new this round

15. **[Codex] `pf-impl-plan`'s template still frames `Task Type: docs` as a live third choice**, even though `pf-execute` unconditionally hard-stops on it. Reported twice by Codex across rounds 3-4 — strengthen beyond round 2's "reserved" note: the template should tell the drafting actor not to assign `docs` to any task in a plan meant for actual execution (since nothing currently dispatches it), not just document that it's reserved after the fact.
16. **[Codex] `pf-codereview`'s Phase -1 automigration can mutate `prompt.md` before Phase 0's prerequisite hard-stop**, leaving an unowned dirty `prompt.md` edit if Phase 0 then stops (e.g. incomplete `implementation_plan.md`) before Phase 5 ever commits. Reorder: Phase 0 (prerequisite check) doesn't need role resolution, so it can safely run *before* Phase -1's automigration — preventing any mutation when the skill is about to stop anyway.
17. **[Codex] `pf-check`'s sequential-review dispatch only defines Claude/Codex invocation paths, not a generic `invoke: agent` actor.** The example role matrix and `agents.yml` include `haiku` (`invoke: agent`, a different model) as a plausible reviewer — `by: [haiku, codex]` has no defined dispatch for the `haiku` pass. Sequential (and parallel) review dispatch should handle any `invoke: agent` actor generically (dispatch a sub-agent using that actor's configured `model` from `agents.yml`), not assume "agent" always means "Claude with the default model."

---

## Verdict

**FAIL**

(One open P1 — #14.)
