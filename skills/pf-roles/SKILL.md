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
on_unavailable: degrade-tier           # optional — see §11; defaults to degrade-tier when absent
roles:
  brd:                  { write: claude:opus, review: [codex:sol] }
  specs:                { write: claude, review: { mode: sequential, by: [claude:haiku, codex] } }
  test_plan:             { write: claude, review: [codex] }
  implementation_plan:   { write: claude, review: [codex] }
  code:                  { write: codex,  review: [claude] }
  tests:                 { write: codex,  review: [claude], run: claude }
  user_docs:             { write: codex,  review: [claude] }
  dev_docs:              skip
```

### `actor[:tier]` grammar

Every place an actor name appears — `write`, each entry of a `review.by` list
(both the short-list shorthand and the long `{ mode, by }` form), and `run` —
accepts either a bare actor name (`claude`, `codex`, `haiku`, ...) or
`actor:tier` (`claude:opus`, `codex:sol`, `claude:haiku`). The actor names a
provider-level entry in `agents.yml`'s `actors:` map (§2); the tier, when
given, must be one of that actor's `tiers:` keys (§2) — an unrecognized tier
name for a known actor is an explicit resolution error (§2's "explicit-error
rule"), never a silent fallback to `default_tier`.

**Tier omitted → the actor's `default_tier`.** `write: claude` and
`write: claude:sonnet` resolve identically whenever `claude`'s
`default_tier` is `sonnet` (the shipped default, §2) — the bare form is not a
different code path, just the tier left unspecified. `review: [codex]` is
shorthand for `review: [codex:sol]` under the shipped default the same way.

**Backward compatibility.** Every `roles:`/`profile:` value written before
tiers existed — `write: claude`, `review: [codex]`, `review: { mode:
parallel, by: [claude, codex] }` — stays valid, completely unchanged, and
resolves to that actor's `default_tier`. Tiers are additive: nothing that
worked before this section existed stops working or changes behavior.

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
  claude:
    kind: llm
    invoke: agent
    tiers: { fable: claude-fable-5, opus: claude-opus-4-8, sonnet: claude-sonnet-5, haiku: claude-haiku-4-5-20251001 }
    default_tier: sonnet
    degrade: [fable, opus, sonnet, haiku]    # highest -> lowest; degrade-tier moves right
  codex:
    kind: llm
    invoke: codex-companion
    tiers: { sol: gpt-5.6-sol, terra: gpt-5.6-terra, luna: gpt-5.6-luna }
    default_tier: sol
    degrade: [sol, terra, luna]              # highest -> lowest; degrade-tier moves right
  haiku:  { kind: llm, invoke: agent, alias: "claude:haiku" }   # legacy alias, resolves to claude:haiku
  gemini: { kind: llm, invoke: cli, command: "gemini -p {prompt}" }
executors:   # aibudget executor name -> actor:tier; optional, used only when `aibudget` is on PATH
  fable: claude:fable
  opus: claude:opus
  sonnet: claude:sonnet
  haiku: claude:haiku
  codex-sol: codex:sol
  codex-terra: codex:terra
  codex-luna: codex:luna
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

### Tiers, `default_tier`, `degrade`, `alias`, legacy `model:`

- **`tiers:`** — a map of tier name → full model id for this actor. Tier names
  are chosen deliberately: for `claude` they equal the `Agent` tool's `model`
  parameter's own accepted aliases (`fable | opus | sonnet | haiku` — see §9),
  so the tier name itself is what gets passed for a Claude dispatch; the full
  ids in `tiers:` exist for other tooling/documentation, not because the
  dispatch needs to look them up. For `codex` there is no such tool-level
  alias constraint, so tier names are free (`sol`/`terra`/`luna`, ordered
  loosely by "size" the way the user names their own Codex tiers) and the
  full model id in `tiers:` is exactly what gets passed on the command line.
- **`default_tier:`** — which of `tiers:`'s keys a bare actor name (no `:tier`
  suffix) resolves to.
- **`degrade:`** — the actor's tiers ordered highest → lowest capability.
  `on_unavailable: degrade-tier` (§11) moves one step to the right in this
  list from whichever tier was assigned; there is no assumption that
  `default_tier` sits at either end of it (in the shipped default it sits in
  the middle, so `degrade-tier` never reaches `fable`/`opus` — this is
  intentional: degrading is a cost-down move, never a cost-up one).
- **`alias:`** — a whole actor entry that is nothing but a pointer to
  `other-actor:tier`. The shipped `haiku` entry is this: `write: haiku`
  resolves exactly as `write: claude:haiku` would, kept only so a `roles:`
  block written before this feature (`write: haiku`) does not break. An
  aliased entry carries no `tiers:`/`default_tier:`/`degrade:` of its own —
  those all come from the actor it points to.
- **Legacy `model:` (no `tiers:`) — single-tier actor.** An actor entry with a
  flat `model:` field and no `tiers:` at all (a hand-edited `agents.yml` that
  predates this feature, or a custom `gemini`-shaped entry) is a **single-tier
  actor**: its only tier is named `default`, its `default_tier` is implicitly
  `default`, and it has no `degrade:` list (a single-tier actor cannot
  degrade — `on_unavailable: degrade-tier` for it falls straight through to
  `wait`, per §11). `write: gemini` and `write: gemini:default` are
  equivalent for such an actor.

**Explicit-error rule.** An unknown actor name, an unknown tier suffix for a
known actor, or a tier suffix on an actor that has no matching `tiers:` key
(including a single-tier legacy actor given any suffix other than `default`)
is a resolution error the resolver stops on — never a silent fallback to
`default_tier`, and never an unhandled exception. Name the file and the exact
key that failed to resolve, e.g.:

```
roles.code.write: actor 'claude' has no tier 'ultra' — known tiers for 'claude' in docs/planning/agents.yml: fable, opus, sonnet, haiku
roles.brd.review[1]: actor 'gpt4' is not registered in docs/planning/agents.yml
```

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
```

**Profiles may carry tiers** (`review: [codex:sol]`, `write: claude:opus`) —
the grammar is identical to `roles:` (§1's "`actor[:tier]` grammar"). The
three shipped profiles above deliberately do not: every actor mention in them
is bare, so each resolves to that actor's `default_tier` — keeping the
shipped defaults tier-agnostic is a deliberate minimalism, not an oversight;
a project that wants a profile pinned to a specific tier defines its own
custom profile with `actor:tier` values.

**Deliberately no point-specific `user_docs`/`dev_docs` entry in any shipped profile.** A point-specific entry for either of these two keys wins at level 2 — *before* the tier-default `skip` at level 3 (see "Why level 3 must come before level 4" below) — so it would force that stage on every tier, including `trivial`/`small`, defeating the tier-budget philosophy `pf-size-tiers` sets out for exactly those tiers. An earlier revision of `codex-implements` did carry `user_docs: { write: codex, review: [claude] }` for this reason (Codex writes the code, so the profile wanted Codex to write the user docs too) — removed once this consequence was recognized. A project that genuinely wants a profile to force `user_docs`/`dev_docs` on every tier can still do so: add the point-specific entry to a **custom** profile in its own `role-profiles.yml`, with the tier trade-off understood, rather than have it baked into a shipped default.

`default` applies to every stage key the profile does not point-override.
Resolving *within* one profile, for stage `<key>`: if the profile has a
point-specific `<key>` entry, use it; otherwise use `default`. This is only one
step of the full five-level algorithm in §4 below — it does **not** by itself
account for the tier-default `skip` behavior for `user_docs`/`dev_docs`, which
sits *between* "point-specific profile entry" and "profile `default`" in the
full order.

**Choosing a profile** happens once, at issue creation, as one option among
several in `/pf`'s "Creating prompt.md" role-assignment step (§10, the
Recommendation procedure — applying a profile is one branch of it, not the
only path; the default path assigns per stage, individually, using
availability-based recommendations). Whichever path is taken, the result is
written as `profile:` and/or `roles:` in `prompt.md`'s frontmatter — see
`~/.claude/skills/pf/SKILL.md`'s "Creating prompt.md" for the exact flow.
There is no dedicated skill for changing the profile or `roles:`
mid-pipeline — a hand-edit to `prompt.md` is the only path (deliberate
decision, see `specs.md` §4.1/§12). Because resolution is never cached (§8),
the edit takes effect on the very next `pf-*` invocation, without touching
stages already completed.

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
`dev_docs` default to `skip`"). This ordering matters whenever a `profile:`
is in play — its `default` would always match ahead of any tier logic checked
afterward if levels 3/4 were not split. Only a profile's own **point-specific**
entry for `user_docs`/`dev_docs` (level 2) can override the tier-default
`skip`; the profile's generic `default` (level 4) cannot — because level 3 is
checked first. (Since §10's per-stage individual assignment became one of two
paths at issue creation, `profile:` is no longer mandatory — the individual
path writes each key's `roles.<key>` explicitly, including `skip` for
`user_docs`/`dev_docs` where the tier default applies, so level 1 resolves
those keys directly and level 3 is never reached for an issue created that
way. Level 3 remains load-bearing for any issue that does carry a `profile:`
without its own point-specific `user_docs`/`dev_docs` override — every
shipped profile, and most custom ones.)

### Resolution output: `(actor, tier, model)`

Levels 1-5 above resolve a stage's `write` to one `actor[:tier]` token (and
each `review.by` entry to the same). Once that token is in hand, filling in
the **tier** — and from it, the model/id actually passed to the dispatch — is
a separate, final step, always in this order: **(a)** an explicit `:tier`
suffix on the token itself, wherever level 1-5 found it; **(b)** if the token
was bare (no suffix) and came from a profile's `actor:tier`-carrying entry,
that profile's tier; **(c)** otherwise the actor's `default_tier` (§2). The
result is the triple `(actor, tier, model)` — `model` being `tiers[tier]`
from `agents.yml` (or, for a legacy single-tier actor, its flat `model:`
value). §9 defines how this triple is actually passed to the actor's
`invoke` mechanism.

**Alias resolution happens first, before any `write == claude`-style
comparison.** If the resolved actor name is itself an `alias:` entry (§2 —
`haiku` in the shipped default), resolve it to the actor:tier it points to
(`claude:haiku`) *before* anything downstream compares the actor against a
literal name. Consequences: `write: haiku` is `write == claude` (true) with
tier `haiku` — not a separate non-Claude actor — so every consumer's
`write == claude` / `write != claude` branching (§7, and each consumer's own
"If `write == claude` ... If `write != claude`" text) evaluates against the
**post-alias** actor. A stage assigned `write: haiku` therefore takes the
`write == claude` path (in-session or `Agent`-tool dispatch, per §9), not the
delegated-actor path — this is a genuine behavior change from the flat
`agents.yml` this issue replaces, where `haiku` was its own actor with
`invoke: agent` and no delegation distinction existed for it either way, so
no consumer's routing actually changes as a result; only the internal
reasoning for *why* it routes that way does. Source-tagging in `pf-check`'s
"`both`-mode aggregation" (`[Claude]`/`[Codex]`) uses the pre-alias name when
it differs from the resolved tier's default (e.g. `[Claude:haiku]`) so the
user can tell which tier actually ran — this is a labeling detail only, not a
routing one.

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
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task "<prompt>" --write --model <resolved model>
```

`<resolved model>` is the resolved tier's model id per §9 (`tiers[tier]` from
`agents.yml`, resolved per §4's "Resolution output" step) — not restated here,
just always present on this and every other `codex-companion.mjs` call this
section and §6 document. Same script, same `task ... --write` form that
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
  node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task "<prompt>" --write --background --model <resolved model>
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

## 9. Tiers & dispatch mapping

**This is the single canonical definition of how a resolved `(actor, tier,
model)` triple (§4's "Resolution output") is actually passed to that actor's
`invoke` mechanism.** Every consumer that dispatches a write or a review
references this section by name (`with the resolved model per §9`) instead of
restating which flag or parameter carries it — this is what keeps `pf-check`'s
"Claude review path"/"Codex invocation chain", `pf-codereview`'s reviewer
paths, `pf-execute`'s per-task dispatch, and §6/§7 above from drifting apart
on this one mechanical detail.

| `invoke` | How the tier's model reaches the actor |
|---|---|
| `agent` | Pass the **tier name itself** (not the full model id) as the `Agent` tool's `model` parameter. The tool accepts only `sonnet \| opus \| haiku \| fable` — which is exactly why `claude`'s `tiers:` keys in `agents.yml` (§2) are named to match. A dispatch with no `model` override at all is equivalent to `model: sonnet` (the shipped `default_tier`). For a legacy single-tier actor (§2) with a custom tier name that doesn't match one of those four aliases, the dispatch mechanism cannot accept it — surface this as an actor-registry configuration mismatch (the same error class `pf-check`'s "Claude review path" already names), never a silent fallback to the tool's own default. |
| `codex-companion` | Pass the **full model id** (`tiers[tier]` from `agents.yml`) as `--model <id>` on the `codex-companion.mjs` command line — both subcommands: `task ... --write --model <id>` (§7, sync and async) and `review --wait --scope branch --base <base-ref> --model <id>` (`pf-check`'s "Codex invocation chain", code-diff form). The document-review form (`task "<brief>" --json`, no `--write`) takes the same `--model <id>` flag. |
| `cli` | Not implemented for any real actor in this issue (§2) — no dispatch mapping defined. |

**Legacy single-tier actor (no `tiers:`, flat `model:`).** Its one tier
(`default`) resolves to that `model:` value directly — for `invoke: agent`
this only works if the value happens to be one of the four `Agent`-tool
aliases (rare — the shipped `claude`/`haiku` entries are not single-tier); for
`invoke: codex-companion` or `cli` the flat value is passed exactly as
before this issue (`--model` for the former, or folded into `command:`'s
`{prompt}` shape for the latter).

---

## 10. Recommendation procedure

**Canonical — referenced by `/pf`'s "Creating prompt.md" role-assignment step
and by the reviewer-assignment guards in `pf`/`pf-brd`.** Given a stage key
and an operation (`write` or `review`), produces a small ordered list of
recommended `actor:tier` options plus the recommended one, for
`AskUserQuestion` to present.

1. **Map stage key + operation → `aibudget` kind:**
   - Any **write** of a planning/documentation stage (`brd`, `specs`,
     `test_plan`, `implementation_plan`, `notes`, `analysis`, `user_docs`,
     `dev_docs`) → kind `planning`.
   - Write of `code`/`tests` → kind `code`.
   - Any **review** (any key) → kind `review`.
2. **If `aibudget` is on `PATH`** (`command -v aibudget` succeeds): run
   `aibudget rank --kind <kind> --top 3 --json`. Map each result's
   `executor` field through `agents.yml`'s `executors:` table (§2) to an
   `actor:tier` — skip any result whose `executor` has no entry in
   `executors:` (an aibudget-known executor this project's `agents.yml`
   doesn't map to any configured actor). The **top mapped result** is the
   recommended `actor:tier` for the `AskUserQuestion` option; its `why` and
   `weekly_level`/`five_level` go into that option's one-line description
   (e.g. "sonnet — недельное окно ok, без потолка"). The 2nd and 3rd mapped
   results become the next options, in order. If `aibudget rank` exits 10
   (nobody available): fall back to the static default below and additionally
   surface the `wait_until`/`retry_after_s` it reports, in one line.
3. **If `aibudget` is not on `PATH`, or every ranked result was unmapped:**
   recommend the stage's currently-configured actor's `default_tier` (or, if
   nothing is configured yet for this stage, `claude`'s `default_tier`) —
   the same static default this framework used before `aibudget` support
   existed. The question text carries exactly one extra line, verbatim
   (translated per `doc_language` when it is set to something other than
   English): "aibudget unavailable — no availability data."
4. **Always include profile options.** Regardless of steps 2-3's outcome, add
   one `AskUserQuestion` option per profile name in `role-profiles.yml`
   ("apply profile `<name>` to all stages"), up to the tool's 4-option limit
   combined with the per-actor options above. With the three shipped profiles
   and no aibudget-derived options this already fills all 4 slots for a
   from-scratch project; when a project's `role-profiles.yml` carries more
   profiles than fit alongside at least one recommended actor option, offer a
   single **"a profile…"** option instead of enumerating them all, which then
   opens a second `AskUserQuestion` listing every profile name. Free-text
   `actor:tier` entry (any actor/tier not offered as a button) relies on
   `AskUserQuestion`'s built-in "Other" — this procedure does not add a
   redundant explicit option for it.
5. **Two-reviewer combo, review only.** When resolving a **review** operation
   and step 2 ran successfully (aibudget available) and both `anthropic` and
   `openai` providers report `weekly` and `5h` level `ok` (`aibudget status
   --json`, §11's status shape), one additional option may offer the
   parallel two-reviewer combo of the top-ranked actor from each provider
   (`[<claude-side>, <codex-side>]`, `mode: parallel`) — a caller may omit
   this option if it would not fit within the 4-option limit alongside the
   single-actor and profile options.

This procedure never calls `AskUserQuestion` itself — it only produces the
options and recommendation; the calling skill (`/pf`, or a reviewer-assignment
guard) is the one that actually asks.

---

## 11. Availability check & on_unavailable

**Canonical — referenced by every dispatching skill immediately before it
dispatches a write or a review** (`pf-brd`, `pf-spec`, `pf-test-plan`,
`pf-impl-plan`, `pf-execute`, `pf-user-docs`, `pf-dev-docs`, `pf-check`,
`pf-codereview`). Runs once per dispatch, right before the actual `Agent`
tool call or `codex-companion.mjs` invocation — after role resolution (§4),
after tier fill-in (§4's "Resolution output"), immediately before §9's
dispatch step.

**This is additive to `pf-check`'s Codex invocation chain step 5** ("Codex
genuinely unavailable" — CLI not installed/not authenticated). The two checks
answer different questions and both run: step 5 asks "does the Codex CLI
exist and work at all on this machine"; this section asks "is the assigned
actor's *provider* currently rate/quota-limited, right now, per `aibudget`."
A machine with a perfectly working Codex CLI can still fail this section's
check (OpenAI's weekly window is low); a machine that fails chain step 5 has
already failed before this section would even run for a `codex` actor (no
CLI to check quota through). Run chain step 5 (or the `write`-side
equivalent, §7's "Availability check before writing") first; run this
section's check only once that has already established the actor is
reachable at all.

1. **If `aibudget` is not on `PATH`:** skip this pre-check entirely — no
   availability data exists to check against. If the dispatch itself then
   fails with a rate-limit/quota error from the provider, apply the policy
   below exactly once for that failure, then stop (do not retry in a loop).
2. **If `aibudget` is on `PATH`:** run `aibudget status --json`. Look up the
   assigned actor's provider (`claude` → `anthropic`, `codex` → `openai`) in
   `providers.<provider>.windows.{5h,weekly}`. The actor is **unavailable
   now** if either window's `level` is `low`, or the `5h` window's
   `used_pct` is `>= 95`.
3. **If unavailable, apply `prompt.md`'s `on_unavailable`** (§1's frontmatter
   field; **default `degrade-tier` when the field is absent** — this is the
   default for every issue created before this field existed, and it is
   never asked mid-pipeline: `on_unavailable` is a once-per-issue,
   creation-time question, §10/`/pf`'s "Creating prompt.md", precisely so
   autopilot can apply it unattended at every later stage without stopping to
   ask):
   - **`degrade-tier`** — move one step to the right in the actor's
     `degrade:` list (§2) from the currently assigned tier. If the assigned
     tier is already the last entry in `degrade:` (or the actor has no
     `degrade:` at all — a legacy single-tier actor), fall through to `wait`
     below instead.
   - **`switch-provider`** — run `aibudget rank --kind <kind> --top 3 --json`
     (same kind mapping as §10 step 1, derived from this stage's key and
     operation) and take the first result whose mapped `actor:tier` (via
     `executors:`, §2) belongs to a **different** actor than the one
     currently assigned. Use it for this one dispatch — same `mode`,
     replacing only the unavailable actor's entry in `review.by` (or `write`
     itself), not the rest of the role record.
   - **`wait`** (or `degrade-tier`/`switch-provider` falling through with no
     alternative) — stop this stage's dispatch here, with a clear message
     naming the actor, the provider/window that's low, and
     `reset_in_s`/`wait_until` from the status/rank output. In `pf-autopilot`
     runs, this is not a hard failure of the run: the existing self-resume
     schedule (`~/.claude/skills/pf-autopilot/SKILL.md` Step 1) already
     retries the whole pipeline later, so a `wait` stop here simply leaves
     this stage undone until the next scheduled resume finds the window
     recovered — `pf-autopilot`'s own text says so.
4. **Record every substitution.** Whenever step 3 actually changes what gets
   dispatched (`degrade-tier` or `switch-provider` fired — not `wait`, which
   dispatches nothing), append one line to the issue's `session-log.md`:

   `[availability] <key> <write|review>: <assigned> → <used> (<provider> <window> <level>; on_unavailable: <policy>)`
   — marker: `session-log.md` — records an availability-driven substitution
   at dispatch time, written by whichever `pf-*` stage dispatched, read by
   nothing downstream (informational only).

   e.g. `[availability] code write: claude:opus → claude:sonnet (anthropic 5h low; on_unavailable: degrade-tier)`.

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
write = exactly one actor[:tier]  review = [actor[:tier], ...] + mode: parallel|sequential (§1, §6)
   │
   ▼
resolve the actor(s) against agents.yml (§2) → kind / invoke / tiers / default_tier / degrade
   │
   ▼
fill in tier -> (actor, tier, model) triple (§4 "Resolution output")
   │
   ▼
availability check against aibudget status, apply on_unavailable if low (§11)
   │
   ▼
invoke per §7/§9 (agent = Agent tool, model: <tier name>; codex-companion =
task ... --write --model <id>, sync or async per output size; cli = not
implemented in this issue)
```
