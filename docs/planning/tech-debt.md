# Tech Debt

Findings that reached a `PASS` verdict without being fixed. Each line carries
the finding's stable ID, its priority, the issue it came from, and its final
state, so a remnant can always be traced back to the review that produced it.

- `CR-006` (P2, 20260902-feat-idea-stage) — `pf-idea-critique` checks predecessors by existence only, so a non-empty stub left by an interrupted `research.md` write satisfies it; the shared stage-completion criterion should apply here as it already does in `pf-idea-research`. The analogous check in `pf-idea-verdict` is loose the same way — state: `open`
- `CR-007` (P2, 20260902-feat-idea-stage) — for git-backed idea/spike closures `NO-REPO` is false, so the unchanged Phase 9 report still claims two commits were added and one was a `--no-ff` merge; both new paths skip Phase 4 and normally create only the archive commit, making every successful close report misleading — state: `open`
- `CR-012` (P2, 20260902-feat-idea-stage) — `pf-idea-critique` justifies its sequential Codex persona path by asserting Codex has no orchestrating primitive equivalent to the `Agent` tool; current documentation describes parallel subagents with concurrency control, so the sequential path is a defensible conservative fallback but not a consequence of a missing capability — state: `open`
- `CR-013` (P2, 20260902-feat-idea-stage) — `specs-part3.md` §9 points a future `SKILLS_ROOT` resolver only at `~/.codex/skills`; current documentation names a repo-level `.agents/skills`, a user-level `$HOME/.agents/skills` and plugin discovery. The "accepted as limitation" status stands, but the resolver target description is out of date — state: `open`
