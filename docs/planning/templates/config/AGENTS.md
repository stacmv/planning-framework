<!-- pf4:begin -->
# Planning Framework v4

This repository uses Planning Framework v4. Read `PLANNING.md` first, then use
the local PF skills from `.agents/skills`.

## Runtime rules

- Codex may be the runtime/master agent for the PF workflow.
- The runtime/master agent owns file edits and workflow state.
- Reviewer agents are read-only: they produce findings for documents or code.
- If `reviewers.<artifact>` is `self`, review with the current runtime agent.
- If it is `peer`, review with the other installed supported agent.
- If it is `both`, run both reviews and aggregate findings without arbitration.
- In Codex, `<PF_SKILL_ROOT>` is `.agents/skills`; use `request_user_input` (or ask in the
  current conversation) for `AskUserQuestion`, and use the current Codex session for any
  `Agent`/`codex-companion` delegation. Do not call a Claude plugin path from Codex.
- If Codex task tools such as `TaskCreate`, `TaskGet`, or `TaskUpdate` are unavailable, keep
  the task ledger in the implementation plan and update it only after rereading the files.
- When Codex is runtime and Claude is selected as reviewer, call Claude through
  `claude -p` with a review-only prompt.
<!-- pf4:end -->
