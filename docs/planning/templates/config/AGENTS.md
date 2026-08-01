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
- When Codex is runtime and Claude is selected as reviewer, call Claude through
  `claude -p` with a review-only prompt.
<!-- pf4:end -->
