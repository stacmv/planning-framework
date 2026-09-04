---
name: pf-idea-spike
description: Write hypothesis.md (Mode 1) and findings.md (Mode 2) for the active spike issue — findings gated on evidence of a real run (AC-09c)
version: 3.0.0
---

Determine the active issue by scanning `docs/issues/open/` for a folder whose
`prompt.md` has `type: spike` (folder name pattern `<date>-spike-<slug>`, per
`~/.claude/skills/pf/SKILL.md` Step 4's detection). `<spike-id>` throughout
this skill means that folder's own name — the same string as `[ISSUE-ID]`.

**Front-loaded, no exceptions.** `idea`/`spike` issues are front-loaded
unconditionally (`~/.claude/skills/pf-interaction/SKILL.md`) — this skill
never calls `AskUserQuestion`. Every point below that would be a question in
an interactive stage instead follows the Front-loaded rule: take the
recommended/judged answer, log `[assumed] <question> → <answer> — <why>` to
`open_questions.md` when a real choice was made (not for mechanical
transcription, which has no question to log), and continue.

Read `prompt.md`'s frontmatter: `idea_tier`, `doc_language`, `roles`
(`hypothesis`/`findings` keys, §6.8-schema), `on_unavailable`, and the
optional `idea_ref`. `<slug>` for both documents' `# Hypothesis: <slug>` /
`# Findings: <slug>` titles is the issue folder's own slug (the segment after
`spike-`) — the same convention `idea.md`/`research.md`/`critique.md`/
`verdict.md` use for their own title.

## Which mode runs

Judge `hypothesis.md` and `findings.md` against the shared "Stage completion"
definition in `~/.claude/skills/pf-size-tiers/SKILL.md` — a mechanical check
(`ls`/`wc -c`/stub-marker grep), not a recall from earlier in this session.

- **`hypothesis.md` absent, or exists but not complete** → **Mode 1**.
- **`hypothesis.md` complete, `findings.md` absent or not complete** → **Mode 2**.
- **Both complete** → nothing to do. Report the spike stage is already
  complete; next step `/pf-close`. Do not overwrite either file.

## Mode 1 — write `hypothesis.md`

A **formatting step, not a research step**: transcribe `prompt.md`'s
`## Question` / `## Success Criterion` / `## Time-box` / `## Method` sections
(already gathered at intake) into `hypothesis.md`'s structure below,
verbatim in content — no new questions, no invented text.

```markdown
# Hypothesis: <slug>

## Question
<what exactly is being tested>

## Success Criterion
<what must be true for the hypothesis to be considered confirmed>

## Time-box
<how much time/effort is allotted>

## Method
<how exactly this will be tested — code/configuration/reading documentation/etc.>
```

**Budget:** `idea_tier` `personal` ≤50, `infra`/`content` ≤60, `product` ≤80
lines — the single source for this number is
`~/.claude/skills/pf-idea-lenses/SKILL.md` §4; do not hardcode a second copy
of it here beyond this one reference.

**Resolve role** for the `hypothesis` key per `~/.claude/skills/pf-roles/SKILL.md`
§4's fallback order (`prompt.md`'s `roles.hypothesis` entry resolves it at
level 1 for every spike issue created after this feature, per the §6.8
skeleton).

- `write == claude`, default tier — this session writes `hypothesis.md`
  directly. No sub-agent dispatch.
- `write == claude`, non-default tier — run the Availability check
  (`pf-roles` §11), then dispatch a sub-agent via the `Agent` tool with
  `model: <tier>` (§9), prompt built per §7's "Prompt shape for a
  from-scratch pipeline document" (target path, `prompt.md`'s content, the
  skeleton above, `doc_language`) — read `hypothesis.md` back from disk once
  it returns.
- `write != claude` (`codex`) — run the Availability check (§7's "Availability
  check before writing"), then delegate the write to the resolved actor's
  write-invocator per §7, same prompt shape as above. This is §7's small/
  targeted-edit case (pure transcription of already-known content) — the
  **synchronous** `task ... --write` form applies, not the async path.

## Close Mode 1: commit & push

Run the shared procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage
commit & push") for `hypothesis.md`, on whichever branch this session is
currently on (Mode 1 never creates a branch). Next step:
`/pf-idea-spike` (Mode 2).

## Mode 2 — write `findings.md`

1. **Determine whether the experiment needs code.** Read `hypothesis.md`'s
   `## Method`. If it describes code, configuration, or a script — yes. If
   it describes something like "read documentation X and compare against
   Y" — no. This is this session's own judgment call, not a question.

2. **If yes — same Branch Setup as `~/.claude/skills/pf-execute/SKILL.md`'s
   Phase 0**, referenced by name (not restated here), with `<spike-id>` in
   place of `ISSUE-ID` throughout: create/checkout `issue/<spike-id>`. Run
   the experiment on that branch. This requires the orchestrating session to
   have a shell-command-execution capability (Claude Code: `Bash`) — commit
   the experiment's code with a plain `git add -A && git commit` through
   that capability — **do not push yet**; the push happens once, at the end
   of this stage, via "Close Mode 2" below, on this same branch.
   `findings.md` is written on this branch too, not on the parent branch —
   this is the copy `/pf-close`'s spike path later reads back onto the
   parent (specs-part1.md §3.6, п.2 / §7.3.2).

3. **If no — run the experiment directly in this session**, using whatever
   network-access capability the orchestrating session has (Claude Code:
   `WebFetch`/`WebSearch`) against real, live documentation/an API, no
   branch created. `findings.md` is written wherever this session already
   is (usually the parent branch, if this spike never created a branch).

4. **Write gate (AC-09c) — the same discipline `research.md` applies to its
   Source requirement (specs-part1.md §3.3, п.3).** `pf-idea-spike` does
   **not** write a non-empty `## Conclusion` without a non-empty `## Run
   Evidence` first. `## Run Evidence` must hold concrete evidence of an
   actual run — a command and its output, a path to an artifact (log file,
   screenshot), or a direct quote from a source actually read, together with
   its URL/path — never a restatement of an expectation ("this should
   work"). If step 2/3 has not actually produced such evidence by the time
   this step runs, **stop here**: report that `findings.md` cannot be
   completed without a real run yet, and do not write `## Conclusion`,
   `## Result vs. Success Criterion`, or `## Follow-up` as if it had.

`findings.md`'s skeleton:

```markdown
# Findings: <slug>

## Run Evidence
<concrete evidence of an actual run — command+output, path to an
artifact, or a direct quote with its source — NOT a restatement of
expectation>

## Result vs. Success Criterion
<met | not met | partial — referencing a specific point in Run Evidence>

## Conclusion
<answer to the Question from hypothesis.md>

## Follow-up
<what this means going forward — "can move to project/feat", "still
blocked on X", etc.>
```

5. **`## Result vs. Success Criterion`** — `met` / `not met` / `partial`,
   cross-checked against `hypothesis.md`'s `## Success Criterion`.

6. **Budget:** `idea_tier` `personal` ≤80, `infra`/`content` ≤120, `product`
   ≤150 lines — same single source, `pf-idea-lenses/SKILL.md` §4.

Steps 1-3 (the code-need judgment, branch mechanics, and running the
experiment itself) always happen in this session, regardless of the
resolved `findings` write actor — the write-invocation form (`pf-roles` §7,
`task ... --write`) has no shell-command-execution or network-access
capability (Claude Code: `Bash`/`WebFetch`), the same reason
`pf-brd`/`pf-spec`'s clarifying-question loops always run in session even
when the document's write is delegated. Once `## Run Evidence`
exists, **resolve role** for the `findings` key per `pf-roles` §4 and write
the document itself the same three ways as Mode 1 above (direct / non-default
tier via `Agent` dispatch / delegated write per §7) — for a delegated write,
fold the already-gathered Run Evidence, the Method/Success Criterion from
`hypothesis.md`, and the skeleton above into the prompt (§7's synchronous
case: this is a short, already-evidenced write, not a from-scratch research
task).

## Close Mode 2: commit & push

Run the shared procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage
commit & push") for `findings.md`, on whichever branch this session is
currently on (step 2's `issue/<spike-id>`, or the parent branch per step 3)
— this is the push that finally sends the experiment's commit(s) from step 2
to the remote too; it is not a merge, and `issue/<spike-id>` is never merged
or deleted by this skill. Next step: `/pf-close`.
