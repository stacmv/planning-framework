---
name: pf-check
description: Review the most recently produced planning document in the active issue for potential problems, grouped by priority
version: 3.0.0
---

First, determine TYPE from the active issue's folder-name prefix (the same way `~/.claude/skills/pf/SKILL.md` Step 4 does). If TYPE is `idea` or `spike`, skip this entire `size_tier` paragraph — these issue types never carry `size_tier` and are never asked for it (`~/.claude/skills/pf-idea-lenses/SKILL.md`'s `idea_tier` instead, handled separately below). Only for any other TYPE does the rest of this paragraph apply, unchanged: before checking any other prerequisite, read `prompt.md`'s frontmatter. If it has no `size_tier` field, ask the user via `AskUserQuestion` — same 4 tier options and descriptions as in `~/.claude/skills/pf-size-tiers/SKILL.md`, recommending medium ("matches today's default behavior"). Front-loaded check: if `prompt.md`'s `interaction` field resolves to `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule"), apply that rule instead of asking this question interactively. Then write the answer into `prompt.md`'s frontmatter before proceeding with the rest of this skill.

Determine the active issue from `docs/issues/open/`.

**TARGET selection — explicit override, then default.** If this skill was invoked with an explicit document-name argument (e.g. `/pf-check idea.md`, `/pf-check research.md` — one of the twelve filenames in the list below), use that document as TARGET directly and skip the "most recently produced" computation entirely. This is the mechanism for re-checking and closing an open (not-yet-`PASSED`) check marker sitting on a document earlier than the pipeline's current tip — most notably after `~/.claude/skills/pf-idea-verdict/SKILL.md`'s Mode 2 override step marks `idea.md`/`research.md`/`critique.md` invalidated alongside `verdict.md` (CR-003): plain `/pf-check` with no argument only ever re-picks the single most-recently-produced document, so without this override an earlier such marker on, say, `idea.md` would have no way to ever become `PASSED` again, and the workflow would stall with no exit. If the given name is not one of the recognized documents below, stop and report the valid list for this issue's TYPE — do not guess a closest match. When no argument is given, TARGET is computed exactly as before this paragraph, unchanged for every issue TYPE (`feat`/`improve`/`bug`/`trivial` included): identify the most recently produced document.

Either way, once TARGET is settled, identify all its predecessor documents:
- If checking notes.md: no predecessors (it's the first document produced for a trivial-tier issue — there is no brd.md before it).
- If checking specs.md: predecessors are brd.md
- If checking test_plan.md: predecessors are brd.md (and specs.md if present). **Exception:** if `size_tier: trivial`, the predecessor is notes.md instead — the brd.md/specs.md predecessor relationship only applies when `size_tier` is small/medium/large.
- If checking implementation_plan.md: predecessors are brd.md, specs.md (if present), test_plan.md
- If checking analysis.md (bug pipeline): predecessors are none (it's the first document produced).
- If checking idea.md: no predecessors (it's the first document produced for the idea pipeline).
- If checking research.md: predecessors are idea.md
- If checking critique.md: predecessors are idea.md, research.md
- If checking verdict.md: predecessors are idea.md, research.md, critique.md
- If checking hypothesis.md: no predecessors (it's the first document produced for the spike pipeline).
- If checking findings.md: predecessors are hypothesis.md

**Additional context, not a predecessor.** For every `idea`/`spike` TARGET above (`idea.md`, `research.md`, `critique.md`, `verdict.md`, `hypothesis.md`, `findings.md`), also read `docs/issues/open/[ISSUE-ID]/prompt.md`'s intake body (not just its `size_tier`/`idea_tier` frontmatter) as required context — the review must be able to compare TARGET against what the user actually said at intake, not only against TARGET's own predecessor documents. For `critique.md`, `verdict.md`, and `findings.md` specifically, also read `open_questions.md` if it exists — without it, the reviewer cannot verify that every `[assumed]`/`unverified-fact` entry the document claims to summarize is actually reflected (AC-05d/AC-06c/AC-07b depend on this cross-check). `open_questions.md` is a side ledger, not a pipeline-stage predecessor (`~/.claude/skills/pf-idea-lenses/SKILL.md`) — it does not gate completeness, it is read purely as reviewer context.

## Automigration — this skill's own prerequisite

Before doing anything else in this skill — before resolving any `roles.<key>` below — check the active issue's `prompt.md` frontmatter: if it has a `reviewers:` block but no `roles:` block, run the same automigration `/pf`'s Step 2 runs, following the conversion rule and fallback-order algorithm defined in `~/.claude/skills/pf-roles/SKILL.md` (§5, §4) — do not restate that rule here. This skill does not assume `/pf` already did this: it can be invoked directly on a legacy issue, including from `/pf-autopilot`, bypassing `/pf` entirely. As with `/pf`'s own copy of this step, this is read/write on `prompt.md` only — the edit rides along with whichever commit this invocation makes at the end (see "Close the stage: commit & push" below).

## Reviewer selection

Before dispatching any analysis, resolve the role for TARGET's key per `~/.claude/skills/pf-roles/SKILL.md` (§4's fallback order), reading `docs/issues/open/[ISSUE-ID]/prompt.md`'s frontmatter (`roles:`/`profile:`, post-automigration). Map TARGET to its role key:

| TARGET | key |
|---|---|
| `notes.md` | `notes` |
| `brd.md` | `brd` |
| `specs.md` | `specs` |
| `test_plan.md` | `test_plan` |
| `implementation_plan.md` | `implementation_plan` |
| `analysis.md` | `analysis` |
| `idea.md` | `idea` |
| `research.md` | `research` |
| `critique.md` | `critique` |
| `verdict.md` | `verdict` |
| `hypothesis.md` | `hypothesis` |
| `findings.md` | `findings` |

The resolved role's `review` field (a list + `mode`, per `pf-roles` §1) drives which path runs below. Which path a given actor uses is decided by that actor's `agents.yml` entry (`~/.claude/skills/pf-roles/SKILL.md` §2), not by its name: any actor with `invoke: agent` (`claude`, `haiku`, or any other actor registered that way) dispatches via the **"Claude review path"** below — the heading name is legacy, the path itself is generic, see that section's opening note; any actor with `invoke: codex-companion` (`codex`, today's only such actor) dispatches via the **"Codex invocation chain"**. `claude` is simply today's default/most common `invoke: agent` actor — it is not a hardcoded special case, and neither is `codex` for `invoke: codex-companion`. Backward-compat equivalence, dictated by `~/.claude/skills/pf-roles/SKILL.md` §5's automigration rule:

| Resolved `review` | Path below |
|---|---|
| `{ mode: parallel, by: [X] }` where `X`'s `agents.yml` entry has `invoke: agent` (`claude` is the general-default case; `review` absent entirely also resolves to `[claude]` — same path) | "Claude review path" below, dispatched with `X`'s resolved tier's model (`pf-roles` §9) |
| `{ mode: parallel, by: [X] }` where `X`'s `agents.yml` entry has `invoke: codex-companion` (in this framework, `codex`) | "Codex invocation chain" only |
| `{ mode: parallel, by: [X, Y] }` — one `invoke: agent` actor and one `invoke: codex-companion` actor (in this framework, `claude` + `codex`; `both` in the old two-reviewer schema) | both, independently, then "`both`-mode aggregation" below |
| `{ mode: sequential, by: [...] }` | "Sequential review mode" below — any mix of `invoke: agent` and `invoke: codex-companion` actors, in any order |

If role resolution yields no `roles:`/`profile:` at all for this issue (§4's level 5 general default), the resolved review is `[claude]` — this is the same backward-compatibility behavior as before this issue (existing issues created before any of this existed review exactly as `claude`-only would have). In that case, do **not** ask the user anything about reviewer choice here (that question belongs only to the once-per-issue guard in `pf-brd`/`pf`) — just proceed with the Claude review path below silently, using `claude`'s `default_tier` model, with no mention of Codex anywhere in the output.

### Claude review path

**Despite the name, this path is not Claude-specific** — it runs for **any** actor `X` whose `agents.yml` entry has `invoke: agent` (Haiku, or any other actor registered that way, not only `claude`). The heading keeps the name "Claude review path" unchanged for other skills that reference this section by name (`pf-dev-docs`/`pf-user-docs`). Resolve `X`'s tier per `~/.claude/skills/pf-roles/SKILL.md` §4's "Resolution output" and run the Availability check (§11 there) before dispatching. Pass the resolved tier per §9's dispatch mapping — the tier name itself (`sonnet`/`opus`/`haiku`/`fable`) as the `Agent` tool's `model` parameter — so the sub-agent actually runs as the configured actor/tier rather than always defaulting to Claude's own model. (An unqualified `Agent` dispatch already runs as `sonnet`, so passing `X`'s tier is a no-op when `X` is `claude` at its `default_tier`; it only changes behavior for a genuinely different actor/tier like `haiku` or `claude:opus`.) If the dispatch mechanism cannot accept the resolved tier as given (§9's legacy single-tier-actor caveat), surface that as an actor-registry configuration mismatch to the user rather than silently falling back to the default actor.

**Do not read these documents yourself.** Dispatch a single sub-agent (Agent tool, default/general-purpose type — no need for a fork, since its full context is not needed afterward), with the resolved actor's `model` set as above, and a prompt along these lines:

> Read `docs/issues/open/[ISSUE-ID]/[TARGET]` and its predecessor documents: [list]. Analyze the codebase context and identify potential problems with [TARGET] from different angles, considering every edge case. Use ASCII diagrams to illustrate if helpful. Do not edit anything — analysis only.
>
> If TARGET is one of `idea.md`/`research.md`/`critique.md`/`verdict.md`/`hypothesis.md`/`findings.md`: instead of the `size_tier` budget check below, read `idea_tier` from the same `prompt.md` and compare [TARGET]'s actual size against `~/.claude/skills/pf-idea-lenses/SKILL.md`'s document-budgets table (§4 there) — [TARGET]'s row, the issue's `idea_tier` column — never against `pf-size-tiers`'s table. If [TARGET] exceeds its `idea_tier`'s budget, include the same **P0** finding as below, with "size_tier" replaced by "idea_tier" in the finding text. Skip the rest of this paragraph and the next (the `size_tier` budget list and its P0 finding) for these six TARGETs — that list applies only to `brd.md`/`specs.md`/`notes.md`/`implementation_plan.md`/`analysis.md`/`test_plan.md`.
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
> Additionally, if [TARGET] is `test_plan.md`: count how many rows in its Status Tracker have `Type: Manual`, and compare against the tier's Manual budget in `~/.claude/skills/pf-size-tiers/SKILL.md`'s "Manual test-case budget by tier" table (trivial 0-1, small ≤2, medium ≤3, large ≤5, hard cap 5 unconditional). If the count exceeds the tier's budget, include a **P1** finding stating the actual count, the tier's budget, and the hard cap. Separately, check every `Manual`-type row's `Remarks` column: it must begin with `Manual reason: <value>` where `<value>` is one of the 5 words in that same section's closed vocabulary (`human-judgment`, `external-system`, `interactive-agent`, `cost`, `environment`). For every `Manual` row missing this prefix, or using a value outside the vocabulary, include a **P1** finding naming the offending TC-ID and what's wrong, and listing the 5 valid values.
>
> Group findings by priority: P0 (blocker), P1 (important), P2 (minor).
>
> Read the `doc_language` field from `docs/issues/open/[ISSUE-ID]/prompt.md`'s YAML frontmatter (default: English if absent) and write your findings in that language.
>
> Your reply is the only thing the orchestrator will see — it will not have read these documents. Return ONLY the prioritized findings (as your final message), not full document contents or restated context.

### Codex invocation chain

**This section is canonical.** It is the single place that defines how this framework talks to Codex and how Codex's findings get folded into pf's P0/P1/P2 priorities. `~/.claude/skills/pf-codereview/SKILL.md` uses this exact same chain and mapping for code review — it references this section by name rather than restating or redefining it. Do not duplicate this chain elsewhere; change it here only.

Run this chain whenever the resolved reviewer for TARGET is an actor whose `agents.yml` entry has `invoke: codex-companion` (in this framework, `codex` — alone or as one side of a two-actor `by` list). The brief given to Codex is the same TARGET + predecessor list + tier-budget check + "group by P0/P1/P2" brief as the Claude review path above, adapted to whichever invocation form below actually ends up running.

**The review target is the document on disk — no issue branch required (ADR-004).** Document review reviews TARGET by its path, exactly as the Claude review path above does: content on disk, not a diff. Do **not** check whether the issue branch `issue/[ISSUE-ID]` exists, and do not compute any diff for a document. The planning documents (`brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md`, `analysis.md`, `notes.md`) are written on the parent branch before `/pf-execute` creates the issue branch, so a branch-diff scope for them is always empty — and the earlier "off-branch → fall back to `claude`" rule this paragraph replaces meant a configured `codex` reviewer never actually reviewed a single planning document. The reviewer the user configured is the reviewer that runs; the branch only changes *which invocation form* Codex is called with, never *who* reviews. A branch is required only for **code** review, where the target genuinely *is* a set of changes — that is `pf-codereview`'s concern (its Phase 1 branch guard) and the code-diff form in step 2b below. The one precondition here is that TARGET exists and is non-empty on disk; a missing or empty TARGET is a stage error ("nothing to review"), never a clean pass (AC-5.1, BR-6).

1. **Check plugin availability.** Determine whether the `codex` plugin is available in this Claude Code installation — its skills `codex:setup` and `codex:rescue` appear in this session's available-skills listing. If they don't, skip to step 3.
2. **Plugin available.**
   a. Invoke the `codex:setup` skill first (`Skill` tool, `skill: "codex:setup"`). It checks the CLI itself and, if the CLI isn't installed but `npm` is available, it already asks the user via `AskUserQuestion` whether to install it — do not ask that a second time here. **Front-loaded, conditional:** for an issue that enabled `interaction: front-loaded` at CREATE-time intake, this install preference was already collected there (see `~/.claude/skills/pf/SKILL.md`'s "Creating prompt.md") and applies here as an assumption, without asking again; for an issue that instead added `interaction: front-loaded` to `prompt.md` manually after CREATE, no intake ever collected this preference, so this question remains unconditional here — not a hook site.
   b. Once `codex:setup` reports the CLI is ready (installed and authenticated), run the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11) for the resolved actor, then run Codex through the plugin's `codex-companion.mjs` script in foreground/blocking mode (never `--background` — the calling skill needs the result before it can present the gate), passing `--model <resolved tier's model id>` per `pf-roles` §9, in the **form matching the review target**:
      - **Document target — this skill (`pf-check`), and the document stages of `pf-dev-docs`/`pf-user-docs`.** Path-based, no diff, no branch:
        ```
        node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task "<review brief>" --json --model <resolved model>
        ```
        `task` **without** `--write` runs Codex in a read-only sandbox with access to the repository, so the brief names the files and Codex reads them itself (this is the same subcommand `pf-roles` §7 uses for delegated writes, minus `--write`). The brief is the document-review brief above — TARGET path, predecessor paths, the tier-budget check, "identify problems from different angles, considering every edge case; analysis only, do not edit anything" — followed by this output instruction, verbatim: *"Reply with a single JSON object and nothing else, shaped like `review-output.schema.json`: `verdict` (`approve` | `needs-attention`), `summary`, `findings[]` (each with `severity` in `critical` | `high` | `medium` | `low`, `title`, `body`, `file`, `line_start`, `line_end`, `confidence`, `recommendation`), `next_steps`."* The command's JSON stdout carries Codex's reply as the `rawOutput` string.
      - **Code-diff target — `pf-codereview` only.** Diff-based, the script's native reviewer:
        ```
        node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" review --wait --scope branch --base <base-ref> --model <resolved model>
        ```
        `--scope branch` (not the default `auto`/`working-tree`) so the diff is always against `<base-ref>`, never the ad-hoc working tree; `<base-ref>` is PARENT-BRANCH as `pf-codereview` Phase 1 detects it (the same detection `pf-close` uses: `git config branch.issue/<ISSUE-ID>.merge`, falling back to `develop`/`main`). **Empty diff is a stage error, not a clean result (AC-5.1, BR-6):** before parsing this command's JSON output in step c, check whether the branch diff against `<base-ref>` is empty; if it is, do not report `verdict: PASS` and do not proceed to step c — state plainly that there was nothing to review, phrased so it cannot be mistaken for a genuine reviewed-and-clean result. This form is never used for documents: `review`/`adversarial-review` accept only working-tree or branch-diff targets, and a planning document authored on the parent branch has neither.
   c. Parse the structured result. For the **code-diff form**, the command's JSON stdout is already schema-shaped (`review-output.schema.json`: `verdict`, `summary`, `findings[]` with `severity`/`title`/`body`/`file`/`line_start`/`line_end`/`recommendation`). For the **document form**, take `rawOutput` from the command's JSON stdout, strip any surrounding code fence, and parse it as JSON against the same schema; if it does not parse, or its `findings[]` lack `severity`, treat the reply as unstructured — present it verbatim in the "Codex findings (unstructured)" block described in step 4, never through the mapping — and say so in one line ("Codex reply was not schema-shaped — shown unstructured"). Map each structured finding's `severity` to P0/P1/P2 per the mapping table below. Skip to "Present findings" below (do not also run the `invoke: agent` sub-agent, unless this is the Codex half of a two-actor `by` list).
3. **Plugin not available.** Ask the user (`AskUserQuestion`) whether to install the `codex` plugin now. **Front-loaded, conditional — same status as step 2a above:** for an issue that enabled `interaction: front-loaded` at CREATE-time intake, this install preference was already collected there and applies here as an assumption; for an issue that added `interaction: front-loaded` to `prompt.md` manually after CREATE, this question remains unconditional here — not a hook site. If they agree, tell them the exact four commands, in order (do not paraphrase or guess at alternatives — source: [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) README):
   ```
   /plugin marketplace add openai/codex-plugin-cc
   /plugin install codex@openai-codex
   /reload-plugins
   /codex:setup
   ```
   `/reload-plugins` is required — a freshly installed plugin's skills/commands do not become available in the current session until plugins are reloaded. `/codex:setup` then checks the Codex CLI itself and offers to install/authenticate it if needed. After this, stop this review for now — re-run this skill once setup is done, which resumes at step 1. If they decline the install, continue to step 4.
4. **Raw CLI fallback.** Call the Codex CLI directly via `Bash`, bypassing the plugin wrapper entirely:
   ```
   codex exec "<review brief: TARGET path + predecessor list + the same 'identify problems from different angles, check tier budget, group by priority' instruction as the invoke: agent path above>"
   ```
   This form is path-based already (Codex reads the named files itself), so it needs no branch for documents either; for `pf-codereview` the brief instead tells Codex to run `git diff <base-ref>...HEAD` and review that. Capture stdout as plain text. This response is **not** schema-shaped — it has no `severity` field — so it is **never** run through the P0/P1/P2 mapping below. Present it to the user verbatim, in its own block labeled **"Codex findings (unstructured)"**, separate from any P0/P1/P2 grouping.
5. **Codex genuinely unavailable.** If, after the above, Codex still cannot produce a result (CLI not installed/not authenticated even after being offered, plugin declined and `codex exec` itself errors or is not on `PATH`) — silently fall back to the Claude review path above, running as `claude` specifically (not whichever other `invoke: agent` actor, if any, is also configured for this stage), for this artifact. Do not surface this as an error to the user. Append one line to the findings output: "Codex unavailable — review performed by Claude" (translate per `doc_language` if it is set to something other than English).

### Severity → priority mapping

**This mapping is canonical** — `pf-codereview` references it by name rather than redefining it. It applies only to structured Codex output (step 2c above, conforming to `review-output.schema.json`):

| Codex `severity` | Priority |
|---|---|
| `critical` | **P0** |
| `high` | **P0** |
| `medium` | **P1** |
| `low` | **P2** |

The raw, unstructured output of a direct `codex exec` call (step 4 above) — or a document-form `task` reply that did not parse as schema-shaped JSON (step 2c) — is **never** passed through this mapping — it has no `severity` field to map. It is always shown as-is, in the separate "Codex findings (unstructured)" block described in step 4, never merged into the P0/P1/P2 grouping.

### `both`-mode aggregation

When the resolved `review` is `{ mode: parallel, by: [X, codex] }` — `X` an `invoke: agent` actor (`claude` + `codex` is today's common case, but any `invoke: agent` actor paired with `codex` works the same way) — run the Claude review path (as `X`, with `X`'s resolved tier's model, `pf-roles` §9) and the Codex invocation chain independently — each exactly as described above, as if it were the only reviewer assigned. Wait for both to complete, then merge before presenting anything to the user:

- Combine both sets of findings into one list, still grouped by priority (P0/P1/P2) exactly as for a single reviewer.
- Prefix every individual finding with its source tag: `[<X>]` (e.g. `[Claude]`, `[Haiku]` — capitalized actor name) or `[Codex]`.
- **Exception — Codex fell back to Claude within a `both`-shaped run (chain step 5 above):** the fallback always runs as `claude` specifically (chain step 5 above), regardless of which `invoke: agent` actor `X` was configured as the other half — tag that portion `[Codex→Claude fallback]` instead of plain `[Codex]`, and keep the "Codex unavailable — review performed by Claude" note, so the user isn't misled into thinking two independent engines actually reviewed the document.
- Do **not** deduplicate, rank, or arbitrate between the two sources, even when they comment on the exact same location and disagree — both findings are shown to the user as independent input. This is a deliberate BRD requirement (no automatic conflict resolution between reviewers); the author/user makes the final call.
- If Codex was invoked via the raw `codex exec` fallback (chain step 4), its unstructured block is still shown alongside the merged P0/P1/P2 list, labeled the same "Codex findings (unstructured)" as the `codex`-only case — it is not forced into the priority grouping just because the `invoke: agent` half has one.

### Sequential review mode

When the resolved `review` is `{ mode: sequential, by: [r1, r2, ...] }`, run the reviewers in `by` in order, each seeing the previous one's fixes already applied — the mechanics are fully defined in `~/.claude/skills/pf-roles/SKILL.md` §6; this section only fixes how `pf-check` carries it out. Each `r_n` can be **any** actor registered in `agents.yml` — `by: [haiku, codex]` and `by: [claude, haiku, codex]` are both valid, not just two-actor `claude`/`codex` lists:

1. `r1` runs its review path — the Claude review path above (using `r1`'s resolved tier's model, `pf-roles` §9) if `r1`'s `agents.yml` entry has `invoke: agent`, or the Codex invocation chain if it has `invoke: codex-companion` — against TARGET as it stands now, producing findings.
2. Those findings are dispatched to this stage's resolved `write` actor (§4's fallback order, same resolution as everywhere else) — the same mechanism as the interactive "Fix now" path below, but automatic: no `AskUserQuestion`, no confirmation prompt. If `write` is Claude, this is the same fix-sub-agent dispatch described under "If 'Fix now'" below, just triggered without a user choice. If `write` is not Claude, it uses the write-invocation form from `~/.claude/skills/pf-roles/SKILL.md` §7, with the "apply these findings to an existing file" prompt from §6 there (not the "write a document from scratch" prompt) — findings are P0/P1 only, same as any other fix dispatch.
3. TARGET is re-read from disk.
4. The next reviewer in `by` runs its review path against the now-fixed TARGET.
5. Repeat through the last reviewer in `by`; its findings are **not** auto-fixed by this loop — they flow into the normal end-of-review gate below (the `AskUserQuestion`/autopilot handling), same as a single-reviewer run's findings would.

**Final report.** Instead of one merged list, present each reviewer's findings as its own block, labeled `[<actor>, pass N]` (`N` = 1-based position in `by`) — including findings from passes before the last one, which were already auto-fixed in step 2 above; mark each such finding `(fixed before next reviewer)` so the pass history stays visible rather than only the final snapshot. The last reviewer's block feeds the gate below exactly as any single reviewer's findings would.

**Autopilot mode — no interactive gate.** This applies identically regardless of which reviewer path produced the findings (`claude`/`codex`/`both`/sequential, tags and all — for sequential mode this is the last reviewer's findings, per "Final report" above). If this skill was invoked with the argument `autopilot` (pf-autopilot passes it — see `~/.claude/skills/pf-autopilot/SKILL.md`), do **not** present the `AskUserQuestion` below. Still present the findings to the user first, for the record, then resolve the review gate automatically from the findings:
- **Any P0 or P1 finding** → take the **"Fix now"** path (dispatch the fix sub-agent described below). Keep it non-interactive: instruct that sub-agent **not** to call `AskUserQuestion` — it applies the specified fixes directly, and for any genuinely ambiguous point it picks the most reasonable option and records the assumption in its summary instead of asking.
- **Only P2 findings, or none** → take the **"Skip and continue"** path.
Append one line to the issue's `session-log.md` recording the auto-decision, marked `[autopilot default]` (e.g. `[autopilot default] pf-check auto-applied Fix now — N P0/P1 addressed`, or `[autopilot default] pf-check auto-continued — only P2/none`). Everything downstream (the fix sub-agent, the commit & push below) then runs exactly as it would for the chosen path.

**Front-loaded reuse — not a new hook.** A front-loaded issue (`prompt.md`'s `interaction` field resolves to `front-loaded`, per `~/.claude/skills/pf-interaction/SKILL.md`) resolves the "How would you like to proceed?" review gate below exactly as if this run had been invoked with the `autopilot` argument — the Autopilot mode branch above runs — except the `session-log.md` line is marked `[assumed]` instead of `[autopilot default]`.

Present the returned findings to the user as-is, then use AskUserQuestion to present these options:

**"How would you like to proceed?"**
- **Fix now** — I'll address all P0 and P1 issues and update the document. I'll ask you clarifying questions where needed.
- **I'll fix manually** — You'll edit the document yourself, then run /pf-check again to re-verify.
- **Skip and continue** — Proceed to the next pipeline stage despite the issues (not recommended for P0).

Note: these three options are unchanged from today, and the oversized-for-tier finding (above) flows through them exactly like any other P0/P1 finding — "Skip and continue" remains available for it too. pf-check itself does not implement any special blocking behavior for oversized documents; it stays advisory-only, same as for every other finding. The real enforcement happens downstream: each pipeline skill (pf-spec, pf-test-plan, pf-impl-plan, pf-execute) independently recomputes this same oversized-for-tier comparison against its own predecessor document(s) as a prerequisite-gate check before it starts producing its own document, and stops there if the predecessor is still oversized. This gate and its three options are identical for `claude`, `codex`, and `both` — the reviewer choice changes only who produces the findings above it, never the gate itself.

If "Fix now": dispatch the fix to this stage's resolved `write` actor (`~/.claude/skills/pf-roles/SKILL.md` §4's fallback order — the same resolution already done for review selection above, re-read fresh, never cached). **The fixer is not always Claude** — it is whichever actor `write` resolves to for this stage, regardless of which reviewer(s) produced the findings; Codex (in any review invocation form) still only ever finds problems, it never reviews and fixes in the same role, but a stage whose `write` is `codex` gets its fixes from `codex`, not from Claude. This is a deliberate behavior change from before this issue (BRD Non-Goals — no write/review independence invariant is introduced).
- **If `write == claude`:** run the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11), then dispatch a second sub-agent (Agent tool, default/general-purpose type, `model: <resolved tier>` per `pf-roles` §9) to apply the fix — same as before. Give it: the target document path, the predecessor document paths, and the full P0/P1 findings list from the analysis step — for `both`, this is the merged, source-tagged (`[Claude]`/`[Codex]`) list from the aggregation above; for sequential mode, the last reviewer's findings. The fix sub-agent should address all of it regardless of tag. Instruct it to read what it needs, use AskUserQuestion itself to ask clarifying questions until it is 95% confident (with a recommendation and reason below each option), edit the document directly (honoring the same `doc_language` field for any prose it writes, keeping structural labels in English), and return only a short summary of what changed. Relay that summary to the user. Front-loaded check: if `prompt.md`'s `interaction` field resolves to `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule"), apply that rule instead of asking this question interactively. Instruct the fix sub-agent not to call `AskUserQuestion`, pick the most reasonable option, and record the assumption in its own summary instead.
- **If `write != claude`** (in this issue, only `codex`): run the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11), then use the write-invocation form from `~/.claude/skills/pf-roles/SKILL.md` §7, with the "apply these findings to an existing file" prompt form from §6 there (not the "write a document from scratch" form) — the same form the automatic inter-pass step of sequential mode uses above. The actor is given the target document path and edits it itself (`--write`); this skill re-reads the file from disk afterward and reports a short summary to the user (there is no clarifying-question loop here — a delegated actor cannot call `AskUserQuestion`, so the findings themselves must carry enough detail to act on, same as the sequential inter-pass step).
If "I'll fix manually" or "Skip and continue": confirm the choice and state the next /pf-* command to run.

## Close the stage: commit & push

The **"Fix now"** path always has something to commit (the document the fix actor edited). The other two options ("I'll fix manually" / "Skip and continue") change no file on their own — **except** when the automigration step above fired for this issue during this same invocation, in which case `prompt.md` changed even though the review gate itself changed nothing; stage and commit that edit too. Only skip this whole section (no commit at all) when neither the fix actor nor automigration touched anything this run.

**Check-outcome marker (AC-5.3) — always written, but its content carries the gate's outcome, not merely the fact that the stage ran.** Regardless of which of the three gate options above was chosen, and regardless of autopilot, append exactly one of the two lines below to the issue's session log, filling in `<TARGET>` and `<UTC-ISO-8601-timestamp>`. This write always happens — it is independent of the autopilot-only `[autopilot default]` line above, which only fires inside that branch and does not cover the ordinary interactive path. Which line to write is decided by whether the findings that fed the gate above contained any P0/P1, and — if so — whether this run's own "Fix now" actually resolved them.

**No P0/P1 left open** (either the analysis step's findings contained no P0/P1 at all — P2-only, or a clean review — or "Fix now" was chosen and the fix sub-agent has already applied its fix to TARGET) — write:

`[pf-check PASSED] <TARGET> @ <UTC-ISO-8601-timestamp>` — marker: `session-log.md` — check passed for `<TARGET>`, written by `/pf-check`, read by `/pf`.

**P0/P1 left open** ("I'll fix manually" or "Skip and continue" was chosen while the findings included at least one P0 or P1) — write instead:

`[pf-check OPEN] <TARGET> @ <UTC-ISO-8601-timestamp> — <reason>` — marker: `session-log.md` — check ran but did NOT pass for `<TARGET>` (open P0/P1 remain), written by `/pf-check`, read by `/pf` (not counted as a passed check — see `/pf`'s "Note on 'check passed'").

Fill `<reason>` with `manual fix pending` for "I'll fix manually", or `skipped with open P0/P1` for "Skip and continue".

These two lines are mutually exclusive for a single run — write exactly one, never both, and never the `PASSED` line just because a stage always writes something when its findings still have open P0/P1. That was exactly the CR-002 defect this convention exists to prevent: a stage reporting success regardless of what it actually did (the same class of defect this issue already fixed once, elsewhere, for `code_review.md`).

Stage `session-log.md` alongside whatever else this run touched, so the marker travels with the same commit.

After relaying the fix summary (if any), run the shared commit & push procedure in `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push") as the last action of this skill. The orchestrator does this, never a delegated fix actor. Do not restate the procedure here: it defines the commit message, the push guard, and the one-line report. Stage the document(s) actually edited (the review's TARGET, for "Fix now"), plus `prompt.md` if automigration wrote to it this run, plus `session-log.md` for the check-outcome marker written above. Review corrections are work like any other — they are not finished until they are committed and pushed.
