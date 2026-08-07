---
name: pf-roles
description: Reference data — the write/review actor-resolution matrix (roles:/profile: schema, agents.yml/role-profiles.yml, the fallback order, reviewers: automigration, sequential review mode, write-invocation form for delegated actors). Not normally invoked directly.
version: 3.0.0
---

This skill is reference data for other Planning Framework skills. It is not meant
to be run directly. If invoked directly, just print the tables and rules below.

## Why this exists

Before this skill, each `pf-*` stage that wrote a document did so unconditionally
as Claude, and each `pf-*` stage that reviewed one read a single flat
`reviewers.<key>: claude|codex|both` value straight out of `prompt.md`. Adding a
second write-capable actor (Codex) and a `sequential` review mode touches every
one of those stages identically — resolving *who writes* and *who reviews* a
given pipeline stage, and *how* a non-Claude actor is actually invoked. Centralizing
that here means one fix mends all consumers, the same principle that already
protects the commit procedure (`~/.claude/skills/pf-git/SKILL.md`) and the
stage-completion criterion (`~/.claude/skills/pf-size-tiers/SKILL.md`) from
independent drift.

**Referenced by** (do not restate any of the material below — reference this file
by name instead): `~/.claude/skills/pf/SKILL.md`, `pf-brd`, `pf-spec`,
`pf-test-plan`, `pf-impl-plan`, `pf-check`, `pf-codereview`, `pf-execute`,
`pf-user-docs`, `pf-dev-docs`, `pf-qa`.

---

## 1. `roles:` / `profile:` in `prompt.md`

An issue's `prompt.md` YAML frontmatter carries an optional `profile:` (a name
from `role-profiles.yml`, §3) and an optional `roles:` block (point-specific
overrides, per pipeline-stage key). Example, for a `feat`/`improve` issue:

```yaml
profile: claude-writes-codex-reviews   # optional — a profile name from role-profiles.yml
roles:
  brd:                  { write: claude, review: [codex] }
  specs:                { write: claude, review: { mode: sequential, by: [haiku, codex] } }
  test_plan:             { write: claude, review: [codex] }
  implementation_plan:   { write: claude, review: [codex] }
  code:                  { write: codex,  review: [claude] }
  tests:                 { write: codex,  review: [claude], run: claude }
  user_docs:             { write: codex,  review: [claude] }
  dev_docs:              skip
```

Known stage keys: `brd`, `specs`, `test_plan`, `implementation_plan`, `code`,
`tests`, `user_docs`, `dev_docs` — plus two keys that belong to alternate paths,
not the feat/improve pipeline shown above: `analysis` (bug-type issues,
`analysis.md`, non-trivial tier) and `notes` (`notes.md`, `size_tier: trivial`,
any issue type — replaces `brd`/`specs`/`implementation_plan`, and for bug-type
also `analysis`). Both `analysis` and `notes` resolve through the exact same
algorithm as every other key (§4) — they are not a special case.

Fields of a stage's role record:
- **`write`** — exactly one actor name (a key under `agents.yml`'s `actors:`).
  Required for every stage except a `skip`ped documentation stage. `code` has no
  `skip` form at the `write` level at all — there is no such thing as a `code`
  stage with no author (see "`code: skip` is invalid" below).
- **`review`** — either a short list `[codex]` (shorthand for
  `{ mode: parallel, by: [codex] }`), or the long form `{ mode: parallel|sequential,
  by: [...] }`. `parallel` is today's `both`-style aggregation: every reviewer in
  `by` runs independently, findings are merged and tagged by source, no
  deduplication or arbitration. `sequential` is the fix-and-forward chain — see
  §6.
- **`run`** — `tests` stage only: which actor actually executes the test run.
  **Reserved — not yet consumed.** Documented and present in the shipped
  `codex-implements` default profile (§3) so the schema doesn't need to change
  again once a consumer reads it, but no `pf-*` skill resolves or acts on it
  in this issue (the same reserved-field pattern as `implementation_plan.md`'s
  `Task Type: docs`, see `~/.claude/skills/pf-impl-plan/SKILL.md`). Wiring an
  actual consumer for it is out of scope here.
- **`skip`** — the whole stage is skipped. Only valid for `user_docs`/`dev_docs`.
  `code: skip` (skipping authorship of `code` itself) is invalid — the resolver
  must stop with an explicit error, never proceed silently and never crash with
  an unhandled exception:
  ```
  roles.code: skip is invalid — code authorship cannot be skipped; did you mean code.review: skip?
  ```
  `code.review: skip` (skip *review only*, authorship still required) is a
  different, valid, value — see "`code.review: skip`" below.

### `code.review: skip`

Allowed, but load-bearing: the moment a user sets this (issue creation, or a
hand-edit to `prompt.md` noticed on the next `/pf` run), `/pf` asks
`AskUserQuestion` ("Code review is disabled for this issue — confirm?") and, on
yes, records a `confirmed:` marker next to it:

```yaml
code: { write: claude, review: skip, confirmed: 2026-08-06 }
```

If `/pf-codereview` reaches this role and no `confirmed:` marker is present yet
(e.g. `skip` was hand-edited in, bypassing `/pf`), `pf-codereview` asks the same
question itself and writes the same marker before proceeding (mechanics belong to
`~/.claude/skills/pf-codereview/SKILL.md`, not restated here). `qa_report.md`
also carries a dedicated risk line when this is set (`~/.claude/skills/pf-qa/SKILL.md`).

---

## 2. `docs/planning/agents.yml` — the actor registry

Per-project file. Default content:

```yaml
actors:
  claude: { kind: llm, invoke: agent,  model: claude-sonnet-5 }
  haiku:  { kind: llm, invoke: agent,  model: claude-haiku-4-5-20251001 }
  codex:  { kind: llm, invoke: codex-companion }
  gemini: { kind: llm, invoke: cli,    command: "gemini -p {prompt}" }
```

`invoke` tells a consumer skill how to actually call the actor:
- **`agent`** — a normal Claude sub-agent (`Agent` tool) — today's path for every
  write operation and for the Claude side of review in `pf-check`/`pf-codereview`.
- **`codex-companion`** — the `codex-companion.mjs` script. For **review** this is
  unchanged and stays canonically defined in `pf-check`'s "Codex invocation chain"
  (see §7 below — this file does not copy or redefine it). For **write**, see §7.
- **`cli`** — an arbitrary command with a `{prompt}` placeholder, for future
  actors outside Claude/Codex. Not implemented or tested for any real actor in
  this issue — the `gemini` entry above documents the shape only (see
  `specs.md` §12, Out of scope).

### `kind: human` — not supported yet, and must fail explicitly

An actor registry entry may eventually carry `kind: human`, e.g.:

```yaml
human: { kind: human, inbox: project-explorer }
```

This kind is **not implemented** in this issue (see BRD, Non-Goals — routed to
`20260806-improve-project-explorer-redesign`). Any resolver that encounters
`kind: human` while resolving an actor **must stop with an explicit,
understandable error** — never an unhandled exception, never a silent
no-op/skip:

```
actor '<name>' is kind: human — not supported until 20260806-improve-project-explorer-redesign
```

### Auto-creation

If `docs/planning/agents.yml` does not exist yet, the **first** `pf-*` skill that
needs to resolve any actor creates it with exactly the default content above —
no question asked to the user. Same mechanism as `role-profiles.yml` below.

---

## 3. `docs/planning/role-profiles.yml` — named profiles

Per-project file. Default content:

```yaml
profiles:
  solo-claude:
    # backward-compat default: Claude does everything
    default: { write: claude, review: [claude] }
  claude-writes-codex-reviews:
    default: { write: claude, review: [codex] }
    code:    { write: claude, review: [codex] }
  codex-implements:
    default:   { write: claude, review: [codex] }
    code:      { write: codex, review: [claude] }
    tests:     { write: codex, review: [claude], run: claude }
    user_docs: { write: codex, review: [claude] }
```

`default` applies to every stage key the profile does not point-override.
Resolving *within* one profile, for stage `<key>`: if the profile has a
point-specific `<key>` entry, use it; otherwise use `default`. This is only one
step of the full five-level algorithm in §4 below — it does **not** by itself
account for the tier-default `skip` behavior for `user_docs`/`dev_docs`, which
sits *between* "point-specific profile entry" and "profile `default`" in the
full order.

**Choosing a profile** happens once, at issue creation: `/pf`'s "Creating
prompt.md" step asks a third question, right after `size_tier` — "Which role
profile?" — listing the names found in `role-profiles.yml`, recommending
`solo-claude` ("matches today's behavior"). The answer is written as `profile:`
in `prompt.md`'s frontmatter. There is no dedicated skill for changing the
profile or `roles:` mid-pipeline — a hand-edit to `prompt.md` is the only path
(deliberate decision, see `specs.md` §4.1/§12). Because resolution is never
cached (§8), the edit takes effect on the very next `pf-*` invocation, without
touching stages already completed.

### Auto-creation

Same rule as `agents.yml`: if `docs/planning/role-profiles.yml` does not exist
yet, the first `pf-*` skill that needs to resolve a profile creates it with
exactly the default content above — no question asked.

---

## 4. Resolving a stage's role — the fallback order

This is **the single algorithm**, applied identically everywhere it is invoked
(every consumer listed at the top), for resolving stage `<key>`'s role. The
order below is checked **strictly top to bottom — first match wins.** This is
the corrected, load-bearing order (do not swap levels 3 and 4):

1. **Explicit point-specific `roles.<key>` entry in `prompt.md`.** If present,
   use it as-is (`write`/`review`, or `skip`). Highest priority — always wins,
   regardless of profile.
2. **The selected profile's point-specific entry for `<key>`** in
   `role-profiles.yml` — i.e. the profile named by `prompt.md`'s `profile:` has
   its own non-`default` entry for exactly this key.
3. **Tier-default `skip` for `user_docs`/`dev_docs`.** Only for these two keys,
   and only when `size_tier` is `trivial` or `small` — resolves to `skip`. This
   level is checked **before** level 4 (the profile's generic `default`), not
   after.
4. **The selected profile's `default` entry** — only reached if levels 1–3 did
   not fire.
5. **The general default.** Evaluated **per key**, like every level above —
   this is a condition on *this specific key*, never a gate on the `roles:`
   block's presence as a whole. Reached for key `<key>` when **both**: (a)
   `prompt.md` has no explicit `roles.<key>` entry for this key (level 1 did
   not fire for it), and (b) the issue has no `profile:` field at all (so
   levels 2–4, which all depend on a selected profile, cannot fire for any
   key). Resolves to `write: claude`, and `review` resolved from the legacy
   `reviewers:` block's entry for this same key if present (§5, automigration)
   or else `review: [claude]`. This is today's pre-issue behavior, unchanged.

   **This must not be gated on whether `roles:` exists at all.** A `roles:`
   block is routinely **partial** — automigration (§5) only ever converts the
   keys that existed in the old `reviewers:` block (typically `brd`/`specs`/
   `test_plan`/`implementation_plan`/`code`, sometimes `analysis`/`notes` —
   never `tests`/`user_docs`/`dev_docs`, since nothing in the old schema
   covered them), and a hand-written `roles:` can just as easily cover only
   one key. An issue with `roles: { code: {...} }` and no `profile:` must
   still resolve `tests`/`user_docs`/`dev_docs`/every other uncovered key
   through level 5 normally — `roles:` existing for *other* keys never blocks
   level 5 for *this* key. Level 5 is unreachable for key `<key>` only when
   `<key>` itself already has an explicit entry (then level 1 already
   resolved it) or a `profile:` is set (then levels 2–4 take over for it).

### Why level 3 must come before level 4, not after

Every profile's `default` entry exists and matches *any* key with no exception
— it is the profile's catch-all. If the tier-default `skip` check ran only
after the whole "resolve through the profile" step (i.e. without splitting that
step into "point-specific profile entry" and "profile `default`"), it would
**never** fire for any of the three default profiles in §3: none of
`solo-claude`, `claude-writes-codex-reviews`, `codex-implements` has its own
point-specific `skip` entry for `user_docs`/`dev_docs` — only the generic
`default`, which for `trivial`/`small` would then win first and silently
violate the BRD's acceptance criterion ("for trivial/small tier, `user_docs`/
`dev_docs` default to `skip`"). Choosing a `profile:` is a mandatory question at
issue creation (§3), so every issue has one, and its `default` would always
match ahead of any tier logic checked afterward. Only a profile's own
**point-specific** entry for `user_docs`/`dev_docs` (level 2) can override the
tier-default `skip`; the profile's generic `default` (level 4) cannot — because
level 3 is checked first.

### `kind: human` and `code: skip` during resolution

Resolving a stage's role can surface two distinct hard-stop conditions, each
with its own explicit error (never an unhandled exception, never a silent
skip) — see §2 for `kind: human` and §1 for `code: skip`. These are different
failure conditions (an unsupported actor kind vs. an invalid role value) and
must not be collapsed into one message.

---

## 5. `reviewers:` → `roles:` automigration

Issues created before this feature carry a flat `reviewers:` block instead of
`roles:`. The conversion is deterministic and asks the user nothing:

```
for each key: actor in the old reviewers:
  roles[key] = { write: claude, review: [actor] }
```

- `reviewers.<key>: both` → `review: [claude, codex]`.
- The conversion covers **every key actually present** in a given issue's
  `reviewers:` block — it is not a fixed enumerated list. Today's known
  consumers of `reviewers:` use `brd`, `specs`, `test_plan`,
  `implementation_plan`, `code` (the planning-pipeline keys), plus two keys used
  outside that pipeline: `analysis` (bug-type issues — see
  `~/.claude/skills/pf/SKILL.md`'s bug-workflow reviewer-assignment guard) and
  `notes` (trivial-tier issues, any type — see
  `~/.claude/skills/pf-brd/SKILL.md`'s reviewer-assignment guard). All seven are
  migrated the same way, under the same key name they already have in
  `roles:`. This list documents what's known today for clarity — the rule
  itself does not check key names against it; it migrates exactly what is
  present in a given issue's `reviewers:`, whatever the key.
- After conversion, `roles:` is written into `prompt.md` and the old
  `reviewers:` block is **removed** — not left alongside (leaving both would
  force every resolver to decide which one wins, which is a new source of
  drift).
- The automigration mutates `prompt.md`, so it is committed as part of
  whichever `pf-*` stage runs next for that issue, not as its own commit — see
  `~/.claude/skills/pf-git/SKILL.md`'s staging table.
- **Where this runs:** as part of `/pf`'s Step 2 (scanning `docs/issues/open/`),
  scoped to the **selected** issue only — the sole issue folder if only one is
  open, or the one Step 3's picker resolves once the user answers which issue
  to work on. It does **not** run for every open issue in one pass: an issue
  the user did not select this invocation is left untouched, and migrates on
  its own first `/pf`/`pf-check`/`pf-codereview` touch instead — whichever of
  those it happens to hit next, whenever it is next actually worked on. This
  keeps every `prompt.md` automigration edit owned by the same `pf-*` stage
  invocation that commits it (`~/.claude/skills/pf-git/SKILL.md`'s staging
  table only ever qualifies the edit for the issue the next stage actually
  operates on); migrating every open issue in one `/pf` pass would leave every
  non-selected issue's edit unstaged and unowned, tripping `pf-qa`'s
  whole-tree `git status --porcelain` check later for a different issue than
  the one being worked on. `pf-check` and `pf-codereview` also run this same
  check themselves, as their own first step, before resolving any
  `roles.<key>` — they do not assume `/pf` already ran it, since they can be
  invoked directly on a legacy issue.

---

## 6. Sequential review mode

`review: { mode: sequential, by: [r1, r2, ...] }` — reviewers in `by` run in
order, each seeing the previous one's fixes already applied:

1. Reviewer `r1` produces findings for TARGET.
2. Findings are handed to the resolved `write` actor of this stage (§1), the
   same way today's interactive "Fix now" path in `pf-check`/`pf-codereview`
   dispatches a fix — applied automatically, no confirmation prompt (BRD
   decision).
3. TARGET is re-read from disk.
4. The next reviewer in `by` (`r2`, ...) reviews the now-fixed version.
5. Repeat until the last reviewer in `by`; its findings are not auto-fixed by
   this loop — they go through the stage's normal end-of-review handling.

**When the write actor isn't Claude,** step 2's dispatch cannot be an ordinary
Claude sub-agent dispatch — it uses the same write-invocation form as §7
below, but with a fix-application prompt instead of a from-scratch one:

```
Apply the following review findings to <path>:
<the reviewer's P0/P1 findings, as produced by the reviewer>
Do not rewrite the file from scratch — make targeted edits addressing exactly
the findings listed. Preserve everything else, including formatting, as-is.
```

The actor is given the file path and edits it itself (`--write`); the
consumer skill re-reads the file from disk afterward. This applies equally to
the interactive "Fix now" path (not only the inter-pass step of sequential
mode) — in both cases the dispatched fixer is the stage's resolved `write`
actor, which is not always Claude.

The final report (`code_review.md` / `pf-check`'s output) lists every
reviewer's findings as its own block, labeled `[<actor>, pass N]`, including
findings already fixed before the next reviewer ran (marked `(fixed before
next reviewer)`) — so the pass history stays visible, not just the final
snapshot.

---

## 7. Write-invocation form for delegated actors

**This is the single canonical definition of write-delegation.** Every consumer
(`pf-brd`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`, `pf-execute`, plus `/pf`'s
inline `analysis.md`/`notes.md` writing, and §6 above) references this section
by name instead of restating the invocation form.

For an actor with `invoke: codex-companion`, a **write** operation means:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task "<prompt>" --write
```

Same script, same `task ... --write` form that
`codex-cli-runtime/SKILL.md` (the `codex` plugin) documents for
`codex:codex-rescue` — but called directly via `Bash` from the consumer skill
itself, **not** through `codex:codex-rescue`. That subagent is a pure forwarder
for user-initiated rescue requests; it is not meant to be invoked
programmatically from another skill. The consumer skill builds `<prompt>`
itself (document content, task description, file path, context — shape depends
on the caller, see each consumer's own section) and calls the script the same
way `pf-check`'s "Codex invocation chain" already calls it for **review**.

### Availability check before writing

**This availability check is the write-side counterpart to `pf-check`'s
"Codex invocation chain" (review side).** Before issuing the `task ...
--write` call above, the calling skill checks Codex availability the same
way that chain does — see `~/.claude/skills/pf-check/SKILL.md`, steps 1-2:
plugin present (its `codex:setup`/`codex:rescue` skills appear in this
session's available-skills listing) → run the `codex:setup` skill if the CLI
itself isn't confirmed ready → proceed once `codex:setup` reports the CLI is
installed and authenticated. If the plugin isn't installed at all, offer to
install it via the same four commands `pf-check`'s chain step 3 documents —
reference that step rather than repeating the command list here. Do not
restate or fork this check; every consumer of this section reuses it as-is.

**Where it diverges from the review-side chain: the final fallback.**
`pf-check`'s chain step 5 lets Codex-unavailable silently fall back to Claude
reviewing instead — acceptable there because findings are findings regardless
of which engine produced them. Write delegation cannot do the same: if a
stage's resolved `write` actor is `codex` and Codex is genuinely unavailable
after the steps above (plugin install declined, or the CLI is not
installed/not authenticated even after `codex:setup` offered to fix it),
silently substituting Claude as author would silently violate the user's
configured authorship — there is no raw-CLI write fallback equivalent to
review's `codex exec` (write needs the plugin's `codex-companion.mjs`
script; there is no unstructured raw-CLI write path). So the correct
behavior here is a **stop, with a clear,
actionable error** — never a silent fallback to Claude, and never an
unhandled crash from a missing script path. The calling skill must surface
something equivalent to:

```
Configured write actor 'codex' is unavailable (Codex CLI not
installed/authenticated). Either complete Codex setup, or change this
stage's `write` to `claude` in `prompt.md`.
```

— and then stop that skill's current operation there: no document or code
gets written by a substitute actor. This applies identically to every
consumer of this section (`pf-brd`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`,
`pf-execute`, `pf-user-docs`, `pf-dev-docs`) — each inherits this check by
referencing this section rather than implementing its own copy.

### Prompt shape for a from-scratch pipeline document

When the consumer skill is generating a pipeline document from nothing (a BRD,
specs, user-docs, dev-docs, or any other document produced by a `pf-*` write
stage — not the fix-forward edit form, which is §6's shape instead), the
`<prompt>` built for the write-invocator has this common shape, regardless of
which document or which consumer skill is calling it:

- **Target file path** — where the actor must write the document, e.g.
  `docs/issues/open/[ISSUE-ID]/brd.md`.
- **`prompt.md`'s content** — the issue's original task description, so the
  actor has the same starting context a human/Claude author would have had.
- **Predecessor documents** — whichever prior-stage documents already exist in
  the issue folder (e.g. `brd.md`/`specs.md` when writing `implementation_plan.md`;
  `brd.md`/`specs.md`/`implementation_plan.md` when writing `user_docs.md` or
  `dev_docs.md`) — full content, not summarized, since these are the actor's
  primary source material.
- **A compressed summary of the requirements clarified in this run** — the
  consumer skill already ran its own `AskUserQuestion` clarifying-questions
  loop before delegating (delegated actors cannot call `AskUserQuestion`
  themselves), so the prompt must fold the answers from that loop into a
  compact summary rather than omitting them.
- **`doc_language`** — from `prompt.md`'s frontmatter, so the actor writes
  prose content in the right language (headings/structural labels stay
  English regardless — see each consumer's own "Documentation language" note).
- **Section structure for the tier** — whatever section list, line budget, or
  diagram/split rules the target document's own tier rules call for (e.g.
  `pf-spec`'s small-tier ≤300-line budget vs. medium/large's 1500-line split
  trigger) — folded into the same prompt, not left for a separate step.

Each consumer skill's own section (referenced from the four places above)
states which of its own documents this applies to and any document-specific
additions; this list is the shared shape they all build from, so a consumer
does not need to restate it — a plain reference to "`pf-roles/SKILL.md` §7"
is enough.

**Write vs. review stay separate.** Codex's **review** invocation form
(`codex-companion.mjs review --wait --scope ...`) is a different operation with
its own canonical definition, already marked canonical in
`~/.claude/skills/pf-check/SKILL.md`'s "Codex invocation chain" and already
referenced from `~/.claude/skills/pf-codereview/SKILL.md`. This file does not
copy or redefine that section — only references it by name. Do not merge the
two; they use different subcommands (`review` vs. `task`) and different flags.

### Synchronous vs. asynchronous write invocation

A synchronous `task ... --write` call risks hitting the Bash tool's timeout (2
minutes by default in this environment, up to 10 minutes if explicitly raised)
on a large generation. Choose based on expected output size:

- **Small/targeted edit** — fixing an existing file (§6's fix-forward step), a
  simple one-or-two-file implementation task — use the **synchronous** call as
  above: `task ... --write`, blocking.
- **Generating a document from scratch, or a non-trivial implementation task**
  (a full BRD/specs/test-plan/impl-plan written from nothing, or a task that
  creates several files) — use the **asynchronous** path instead:
  ```
  node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task "<prompt>" --write --background
  ```
  then poll for completion via the script's existing `status`/`result`
  subcommands (the same subcommands `codex-cli-runtime/SKILL.md` already lists
  as existing on `codex-companion.mjs`, even though it forbids calling them
  from inside `codex:codex-rescue` — here the consumer skill calls them
  directly, the same `Bash` path, not through `codex:codex-rescue`). Do not
  reinvent this polling mechanism — it already exists in the script.

This is a size-of-output judgment call, not a hard byte threshold: if the
expected generation is a full pipeline document from nothing, or an
implementation task creating multiple files from nothing, prefer the async
path.

---

## 8. No caching — resolve fresh every time

**Role resolution happens fresh on every invocation of every `pf-*` skill.** No
skill stores a resolution result between invocations — there is no cache to
invalidate, because none exists. This is what makes a mid-pipeline change to
`roles:`/`profile:` in `prompt.md` (a hand-edit, since there is no dedicated
skill for it — §3) take effect automatically on the very next `pf-*` run,
without any extra cache-invalidation code, and without disturbing stages that
already completed under the old role.

---

## Summary — the resolution pipeline

```
prompt.md: roles.<key> present?
   │
  yes ──────────────► use it as-is (write / review, or the skip / error cases in §1, §4)
   │
   no
   │
   ▼
resolve through role-profiles.yml (§3) with the tier-default skip
inserted between levels 2 and 4 of the full order (§4)
   │
   ▼
write = exactly one actor         review = [actor, ...] + mode: parallel|sequential (§6)
   │
   ▼
resolve the actor(s) against agents.yml (§2) → kind / invoke / model|command
   │
   ▼
invoke per §7 (agent = Agent tool; codex-companion = task ... --write,
sync or async per output size; cli = not implemented in this issue)
```
