---
name: pf-check
description: Review the most recently produced planning document in the active issue for potential problems, grouped by priority
version: 3.0.0
---

Before checking any other prerequisite, read `prompt.md`'s frontmatter. If it has no `size_tier` field, ask the user via `AskUserQuestion` — same 4 tier options and descriptions as in `~/.claude/skills/pf-size-tiers/SKILL.md`, recommending medium ("matches today's default behavior") — then write the answer into `prompt.md`'s frontmatter before proceeding with the rest of this skill.

Determine the active issue from `docs/issues/open/`. Identify the most recently produced document (TARGET) and all its predecessor documents:
- If checking notes.md: no predecessors (it's the first document produced for a trivial-tier issue — there is no brd.md before it).
- If checking specs.md: predecessors are brd.md
- If checking test_plan.md: predecessors are brd.md (and specs.md if present). **Exception:** if `size_tier: trivial`, the predecessor is notes.md instead — the brd.md/specs.md predecessor relationship only applies when `size_tier` is small/medium/large.
- If checking implementation_plan.md: predecessors are brd.md, specs.md (if present), test_plan.md
- If checking analysis.md (bug pipeline): predecessors are none (it's the first document produced).

## Reviewer selection

Before dispatching any analysis, read the `reviewers` block from `docs/issues/open/[ISSUE-ID]/prompt.md`'s frontmatter (see `~/.claude/skills/pf-brd/SKILL.md`'s reviewer-assignment guard for how/when it's written). Map TARGET to its `reviewers.<key>`:

| TARGET | key |
|---|---|
| `notes.md` | `notes` |
| `brd.md` | `brd` |
| `specs.md` | `specs` |
| `test_plan.md` | `test_plan` |
| `implementation_plan.md` | `implementation_plan` |
| `analysis.md` | `analysis` |

If the `reviewers` block is absent, or the specific key is absent from it, treat it as `claude` — this is the backward-compatibility default (see BRD/specs: existing issues created before this field existed must behave exactly as they did before). In that case, do **not** ask the user anything about reviewer choice here (that question belongs only to the once-per-issue guard in `pf-brd`/`pf`) — just proceed with the Claude path below silently, with no mention of Codex anywhere in the output.

The resolved value drives which of the three paths below runs:
- **`claude`** — run the "Claude review" path only.
- **`codex`** — run the "Codex invocation chain" only.
- **`both`** — run both independently (each exactly as it would run alone), then aggregate per "`both`-mode aggregation" below.

### Claude review path

**Do not read these documents yourself.** Dispatch a single sub-agent (Agent tool, default/general-purpose type — no need for a fork, since its full context is not needed afterward) with a prompt along these lines:

> Read `docs/issues/open/[ISSUE-ID]/[TARGET]` and its predecessor documents: [list]. Analyze the codebase context and identify potential problems with [TARGET] from different angles, considering every edge case. Use ASCII diagrams to illustrate if helpful. Do not edit anything — analysis only.
>
> Also read `docs/issues/open/[ISSUE-ID]/prompt.md`'s `size_tier` field (default: medium if absent) and `~/.claude/skills/pf-size-tiers/SKILL.md`'s document-budgets table. Compare [TARGET]'s actual size against that tier's budget for [TARGET]'s document type:
> - `notes.md` (trivial) > ~50 lines
> - `specs.md`: small > ~300 lines; medium/large > 1500 lines without having been split into 3 parts
> - `implementation_plan.md`: small > ~150 lines
> - `analysis.md`: small > ~300 lines
> - `test_plan.md`: trivial > 4 cases, small > 10 cases, medium > 20 cases
>
> If [TARGET] exceeds its tier's budget, include a **P0** finding: "`<file>` is oversized for this issue's declared tier (`<tier>`): <actual> vs <budget>. Either trim the document, or re-classify the issue to a larger tier (edit `size_tier` in `prompt.md`)."
>
> Group findings by priority: P0 (blocker), P1 (important), P2 (minor).
>
> Read the `doc_language` field from `docs/issues/open/[ISSUE-ID]/prompt.md`'s YAML frontmatter (default: English if absent) and write your findings in that language.
>
> Your reply is the only thing the orchestrator will see — it will not have read these documents. Return ONLY the prioritized findings (as your final message), not full document contents or restated context.

### Codex invocation chain

**This section is canonical.** It is the single place that defines how this framework talks to Codex and how Codex's findings get folded into pf's P0/P1/P2 priorities. `~/.claude/skills/pf-codereview/SKILL.md` uses this exact same chain and mapping for code review — it references this section by name rather than restating or redefining it. Do not duplicate this chain elsewhere; change it here only.

Run this chain whenever the resolved reviewer for TARGET is `codex` (alone or as the Codex half of `both`). The brief given to Codex is the same TARGET + predecessor list + tier-budget check + "group by P0/P1/P2" brief as the Claude review path above, adapted to whichever invocation form below actually ends up running.

1. **Check plugin availability.** Determine whether the `codex` plugin is available in this Claude Code installation — its skills `codex:setup` and `codex:rescue` appear in this session's available-skills listing. If they don't, skip to step 3.
2. **Plugin available.**
   a. Invoke the `codex:setup` skill first (`Skill` tool, `skill: "codex:setup"`). It checks the CLI itself and, if the CLI isn't installed but `npm` is available, it already asks the user via `AskUserQuestion` whether to install it — do not ask that a second time here.
   b. Once `codex:setup` reports the CLI is ready (installed and authenticated), run the review with the same script `/codex:review` uses, in foreground/blocking mode (never `--background` — this skill needs the result before it can present the gate):
      ```
      node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" review --wait --scope branch --base <base-ref>
      ```
      - `--scope branch` (not the default `auto`/`working-tree`) so the diff is always against `<base-ref>`, never the ad-hoc working tree.
      - `<base-ref>` is the same parent-branch detection `pf-close` uses (`git config branch.issue/<ISSUE-ID>.merge`, falling back to `develop`/`main`). Because TARGET is a document authored fresh within the issue branch, the resulting branch diff against `<base-ref>` is, in practice, the whole document — this is what specs.md means by "scope = whole target document" for document review, as opposed to the code-review case in `pf-codereview` where the same `--base <base-ref>` diff spans the entire issue implementation instead of one file.
   c. Parse the command's JSON stdout against `review-output.schema.json` (`verdict`, `summary`, `findings[]` with `severity`/`title`/`body`/`file`/`line_start`/`line_end`/`recommendation`). Map each finding's `severity` to P0/P1/P2 per the mapping table below. Skip to "Present findings" below (do not also run the Claude sub-agent, unless this is the Codex half of `both`).
3. **Plugin not available.** Ask the user (`AskUserQuestion`) whether to install the `codex` plugin now. If they agree, tell them the exact two commands (do not paraphrase or guess at alternatives):
   ```
   /plugin marketplace add openai/codex-plugin-cc
   /plugin install codex@openai-codex
   ```
   and stop this review for now — re-run this skill once it's installed, which resumes at step 1. If they decline, continue to step 4.
4. **Raw CLI fallback.** Call the Codex CLI directly via `Bash`, bypassing the plugin wrapper entirely:
   ```
   codex exec "<review brief: TARGET path + predecessor list + the same 'identify problems from different angles, check tier budget, group by priority' instruction as the Claude path above>"
   ```
   Capture stdout as plain text. This response is **not** schema-shaped — it has no `severity` field — so it is **never** run through the P0/P1/P2 mapping below. Present it to the user verbatim, in its own block labeled **"Codex findings (unstructured)"**, separate from any P0/P1/P2 grouping.
5. **Codex genuinely unavailable.** If, after the above, Codex still cannot produce a result (CLI not installed/not authenticated even after being offered, plugin declined and `codex exec` itself errors or is not on `PATH`) — silently fall back to the Claude review path above for this artifact. Do not surface this as an error to the user. Append one line to the findings output: "Codex unavailable — review performed by Claude" (translate per `doc_language` if it is set to something other than English).

### Severity → priority mapping

**This mapping is canonical** — `pf-codereview` references it by name rather than redefining it. It applies only to structured Codex output (step 2c above, conforming to `review-output.schema.json`):

| Codex `severity` | Priority |
|---|---|
| `critical` | **P0** |
| `high` | **P0** |
| `medium` | **P1** |
| `low` | **P2** |

The raw, unstructured output of a direct `codex exec` call (step 4 above) is **never** passed through this mapping — it has no `severity` field to map. It is always shown as-is, in the separate "Codex findings (unstructured)" block described in step 4, never merged into the P0/P1/P2 grouping.

### `both`-mode aggregation

When the resolved reviewer is `both`, run the Claude review path and the Codex invocation chain independently — each exactly as described above, as if it were the only reviewer assigned. Wait for both to complete, then merge before presenting anything to the user:

- Combine both sets of findings into one list, still grouped by priority (P0/P1/P2) exactly as for a single reviewer.
- Prefix every individual finding with its source tag: `[Claude]` or `[Codex]`.
- **Exception — Codex fell back to Claude within a `both` run (chain step 5 above):** tag that portion `[Codex→Claude fallback]` instead of plain `[Codex]`, and keep the "Codex unavailable — review performed by Claude" note, so the user isn't misled into thinking two independent engines actually reviewed the document — it was Claude twice, once under each label.
- Do **not** deduplicate, rank, or arbitrate between the two sources, even when they comment on the exact same location and disagree — both findings are shown to the user as independent input. This is a deliberate BRD requirement (no automatic conflict resolution between reviewers); the author/user makes the final call.
- If Codex was invoked via the raw `codex exec` fallback (chain step 4), its unstructured block is still shown alongside the merged P0/P1/P2 list, labeled the same "Codex findings (unstructured)" as the `codex`-only case — it is not forced into the priority grouping just because Claude's half has one.

**Autopilot mode — no interactive gate.** This applies identically regardless of which reviewer path produced the findings (`claude`/`codex`/`both`, tags and all). If this skill was invoked with the argument `autopilot` (pf-autopilot passes it — see `~/.claude/skills/pf-autopilot/SKILL.md`), do **not** present the `AskUserQuestion` below. Still present the findings to the user first, for the record, then resolve the review gate automatically from the findings:
- **Any P0 or P1 finding** → take the **"Fix now"** path (dispatch the fix sub-agent described below). Keep it non-interactive: instruct that sub-agent **not** to call `AskUserQuestion` — it applies the specified fixes directly, and for any genuinely ambiguous point it picks the most reasonable option and records the assumption in its summary instead of asking.
- **Only P2 findings, or none** → take the **"Skip and continue"** path.
Append one line to the issue's `session-log.md` recording the auto-decision, marked `[autopilot default]` (e.g. `[autopilot default] pf-check auto-applied Fix now — N P0/P1 addressed`, or `[autopilot default] pf-check auto-continued — only P2/none`). Everything downstream (the fix sub-agent, the commit & push below) then runs exactly as it would for the chosen path.

Present the returned findings to the user as-is, then use AskUserQuestion to present these options:

**"How would you like to proceed?"**
- **Fix now** — I'll address all P0 and P1 issues and update the document. I'll ask you clarifying questions where needed.
- **I'll fix manually** — You'll edit the document yourself, then run /pf-check again to re-verify.
- **Skip and continue** — Proceed to the next pipeline stage despite the issues (not recommended for P0).

Note: these three options are unchanged from today, and the oversized-for-tier finding (above) flows through them exactly like any other P0/P1 finding — "Skip and continue" remains available for it too. pf-check itself does not implement any special blocking behavior for oversized documents; it stays advisory-only, same as for every other finding. The real enforcement happens downstream: each pipeline skill (pf-spec, pf-test-plan, pf-impl-plan, pf-execute) independently recomputes this same oversized-for-tier comparison against its own predecessor document(s) as a prerequisite-gate check before it starts producing its own document, and stops there if the predecessor is still oversized. This gate and its three options are identical for `claude`, `codex`, and `both` — the reviewer choice changes only who produces the findings above it, never the gate itself.

If "Fix now": dispatch a second sub-agent (Agent tool, default/general-purpose type) to apply the fix. **This fix sub-agent is always Claude, never Codex, regardless of which reviewer(s) produced the findings** — Codex (in any invocation form) only ever finds problems; it is never given write access to the repository (see specs.md §7). Give it: the target document path, the predecessor document paths, and the full P0/P1 findings list from the analysis step — for `both`, this is the merged, source-tagged (`[Claude]`/`[Codex]`) list from the aggregation above; the fix sub-agent should address all of it regardless of tag. Instruct it to read what it needs, use AskUserQuestion itself to ask clarifying questions until it is 95% confident (with a recommendation and reason below each option), edit the document directly (honoring the same `doc_language` field for any prose it writes, keeping structural labels in English), and return only a short summary of what changed. Relay that summary to the user.
If "I'll fix manually" or "Skip and continue": confirm the choice and state the next /pf-* command to run.

## Close the stage: commit & push

This applies to the **"Fix now"** path only — the other two options change no file, so there is nothing to commit and this skill must not create an empty commit.

After relaying the fix sub-agent's summary, run the shared commit & push procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push") as the last action of this skill. The orchestrator does this, never the fix sub-agent. Do not restate the procedure here: it defines what to stage (the document(s) the sub-agent actually edited), the commit message, the push guard, and the one-line report. Review corrections are work like any other — they are not finished until they are committed and pushed.
