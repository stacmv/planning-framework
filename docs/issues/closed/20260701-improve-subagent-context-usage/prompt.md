# Prompt

Make `pf-check` — and possibly some other Planning Framework skills — use sub-agents with reduced context in order to consume fewer tokens in the main conversation.

## Context

Several pf-* skills (e.g. `pf-check`, `pf-test-plan`, `pf-impl-plan`, `pf-qa`) currently do their work inline in the main session: reading potentially large documents (BRD, specs, test plans, implementation plans, source files) directly into the orchestrating agent's context. This grows the main conversation's token usage even though the detailed reading/analysis work doesn't need to stay in the main context — only the resulting verdict/findings do.

The ask is to identify which skills would benefit from delegating their document-reading/analysis work to a sub-agent (via the `Agent` tool) that returns only a compact structured result (e.g. pass/fail + list of issues), instead of the orchestrator loading full documents itself.

## Candidates to evaluate

- `pf-check` (reads and cross-checks large planning docs — prime candidate)
- Possibly `pf-qa`, `pf-test-plan`, `pf-impl-plan` if they have a similar pattern of reading large docs just to produce a short verdict

## Goal

Reduce main-session token consumption for issue workflows without changing the user-facing behavior/output of these skills.
