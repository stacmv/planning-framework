---
name: pf-spec
description: Write the technical spec (specs.md) for the active issue, based on its BRD
version: 4.0.0
---

Before checking any other prerequisite, read `prompt.md`'s frontmatter. If it has no `size_tier` field, ask the user via `AskUserQuestion` — options **trivial** / **small** / **medium** / **large**, same descriptions as in `<PF_SKILL_ROOT>/pf-size-tiers/SKILL.md` — recommending medium ("matches today's default behavior") — then write the answer into `prompt.md`'s frontmatter before proceeding with the rest of this skill.

Check that `docs/issues/open/[ISSUE-ID]/brd.md` is **complete** per the shared definition of "stage complete" in `<PF_SKILL_ROOT>/pf-size-tiers/SKILL.md` ("Stage completion"). If it does not exist, or exists but is not complete (empty, or carrying the stub marker), stop and tell the user: "BRD is required before writing the spec. Run /pf-brd first."

**Output gate — `specs.md` already present (regenerate / keep / cancel).** If `specs.md` already exists, do **not** stop outright. Judge it against the same shared definition in `<PF_SKILL_ROOT>/pf-size-tiers/SKILL.md`, then ask the user via `AskUserQuestion`, stating whether it is complete or an incomplete stub:
- **regenerate** — overwrite it with a freshly written spec (recommend this when it is not complete);
- **keep** — leave it untouched and stop, reporting that the SPEC stage is already complete (recommend this when it is complete);
- **cancel** — stop and change nothing.

Read `size_tier` from `prompt.md`'s frontmatter.

**If `size_tier: trivial`:** stop immediately and tell the user exactly: "This is a trivial-tier issue — spec is already covered by `notes.md`. Next step: `/pf-test-plan`." Do not create `specs.md`.

**Oversized-predecessor guard (small/medium/large only):** before writing `specs.md`, recompute the oversized-for-tier check against `brd.md` using a lightweight mechanical line count (e.g. `wc -l` on `brd.md`) rather than a full semantic read. Budget: for `size_tier: small`, `brd.md` must be ≤300 lines (this budget is an implementation-level decision adopted here — specs.md itself never defines a `brd.md` budget; it mirrors `analysis.md`'s small-tier budget of ≤300 lines). For `size_tier: medium` or `large`, there is no explicit cap (unchanged from today). If `brd.md` exceeds the ≤300-line budget for a small-tier issue, stop before writing `specs.md` and tell the user: "`brd.md` is oversized for this issue's declared tier (`small`): <actual line count> vs ≤300 budgeted lines. Run /pf-check to review, then either trim brd.md or re-classify the issue's size_tier to a larger tier in prompt.md."

**Documentation language:** read the `doc_language` field from `docs/issues/open/[ISSUE-ID]/prompt.md`'s YAML frontmatter (default: English if absent). Write `specs.md`'s prose content in that language. Keep headings and structural labels in English so downstream tooling keeps working.

Based on the BRD, produce the specs at `docs/issues/open/[ISSUE-ID]/specs.md` (place next to BRD file) — who actually writes it is resolved below. Use the AskUserQuestion tool to ask me clarifying questions until you are 95% confident you can complete this task successfully. For each question, add your recommendation (with reason why) below the options. This would help me in making a better decision.

**If `size_tier: small`:** omit ASCII diagrams unless the issue involves UI/UX. Target ≤300 lines total instead of applying the 1500-line split trigger below.

**If `size_tier` is medium or large (or absent):** use ASCII diagrams where necessary to illustrate the UI/UX. If this specs file will be too big (more than 1500 lines), please split it into 3 parts. Keep the original file as the index file that links to the 3 parts.

Once confident, **resolve role** for the `specs` key per `<PF_SKILL_ROOT>/pf-roles/SKILL.md` (§4's fallback order).

- If `write == claude` — unchanged: this session writes `specs.md` directly (and, if oversized, its index + 3 parts), following the tier rules above — no sub-agent dispatch.
- If `write != claude` (in this issue, only `codex`) — the clarifying-questions loop above still runs in this session (delegated actors cannot call `AskUserQuestion`); once confident, delegate the actual write to the resolved actor's write-invocator per `<PF_SKILL_ROOT>/pf-roles/SKILL.md` §7, targeting `docs/issues/open/[ISSUE-ID]/specs.md` with a single prompt built per §7's shape (the target path, `prompt.md`'s path, `brd.md`'s path, the requirements clarified in this run, `doc_language`, the tier-appropriate section structure/diagram/line-budget rules above — and, folded into the same prompt rather than a separate step, the 1500-line split instruction: if the generated spec exceeds 1500 lines, split it into an index file plus 3 parts, exactly as described above). A from-scratch pipeline document is §7's asynchronous case. The same actor performs both the drafting and, if triggered, the split, in this one call — not a separate Claude post-processing pass. Once it returns, read the resulting file(s) back from disk (the index `specs.md` and any part files, if a split occurred) and continue this skill's existing post-processing unchanged.

Where [ISSUE-ID] means: scan docs/issues/open/ and use the active issue folder name.

## Close the stage: commit & push

As the last action of this skill — after `specs.md` (and any split parts) is saved — run the shared commit & push procedure in `<PF_SKILL_ROOT>/pf-git/SKILL.md` ("Stage commit & push"). Do not restate it here: it defines what to stage, the commit message, the push guard, and the one-line report. A stage is not finished until its document is committed and pushed.
