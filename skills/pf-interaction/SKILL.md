---
name: pf-interaction
description: Reference data — the front-loaded interaction rule, read by the idea/spike pipeline (where it is the only mode) and, optionally, by feat/improve/bug hook sites via `interaction: front-loaded`. Not normally invoked directly.
version: 3.0.0
---

This skill is reference data for other Planning Framework skills. It is not meant
to be run directly. If invoked directly, just print the rule below.

This is the single point of definition for front-loaded mode — read by both the
`idea`/`spike` pipeline (where it is the only mode, not switchable) and by
feat/improve/bug (where it is the optional `interaction: front-loaded` field in
`prompt.md`, default: today's interactive behavior). The full list of hook sites
that read this rule for feat/improve/bug lives in `specs.md` §7.13 for this
issue (a development-time record of which existing skills were edited — not
something read at runtime). The exact `open_questions.md` row format shared by
both applications is defined below, in this skill — the canonical copy an
installed project actually carries (`specs.md` is this issue's own spec and is
never shipped to user projects). Here — the rule itself, referenced by name
from every hook site.

## Front-loaded rule

> **Front-loaded rule.** Для стадии, вызванной внутри issue с
> `interaction: front-loaded` (явно в `prompt.md`, или неявно для
> `idea`/`spike` — эти типы front-loaded всегда, поле не читается как
> переключатель для них, см. §6.11 ниже): при вопросе, который в
> интерактивном режиме задаётся через `AskUserQuestion`, стадия **не
> вызывает `AskUserQuestion`**. Вместо этого:
> 1. Взять рекомендованный вариант ответа тем же способом, каким сегодня
>    вычисляется рекомендация для интерактивного вопроса (та же
>    Recommendation-процедура, если она есть у конкретного вопроса —
>    `pf-roles` §10 для ролевых вопросов; иначе — собственное суждение
>    стадии с обоснованием, как оно уже формулируется в
>    "add your recommendation (with reason why) below the options"
>    практически везде в текущих скиллах).
> 2. Записать строку в `open_questions.md`:
>    `[assumed] <вопрос> → <взятый ответ> — <почему>` (точная схема строки —
>    см. "`open_questions.md` row schema (canonical)" ниже; этот файл
>    появляется лениво, первым пишущим скиллом/стадией, которой есть что в
>    него записать — он не создаётся этой задачей заранее).
> 3. Продолжить стадию с этим ответом, не останавливаясь.

## `open_questions.md` row schema (canonical)

This is the canonical definition of the `open_questions.md` row format,
shared by every stage that writes `[assumed]`/`unverified-fact` rows (both
front-loaded applications above). It lives here — inside `skills/`, the only
tree copied into an installed project — not in `specs.md` §6.9, which is this
issue's own spec and is never shipped.

```markdown
# Open Questions — <ISSUE-ID>

| # | Raised by | Question | Assumed answer | Why | Used in | Status |
|---|---|---|---|---|---|---|
| 1 | pf-idea | Какой объём рынка у идеи? | Не оценивается численно — нет данных на intake | Оценка TAM без источника была бы выдумкой | idea.md §MVP | assumed |
| 2 | pf-idea-research | Есть ли лицензионные ограничения у аналога X? | (нет — не проверено, не допущение) | Официальный прайсинг не найден за разумное время поиска | research.md (Facts #4) | unverified-fact |
| 3 | pf-idea-critique | Как реагировать на возражение техлида про масштабирование? | Риск принят — MVP не требует масштабирования | critique.md's диспозиция не дала однозначного ответа без дополнительного контекста | verdict.md §Reasoning | assumed |
```

**Columns:**
- **Raised by** — the stage/skill that produced the row.
- **Question** — the question as phrased, the same way it would have been
  asked in interactive mode.
- **Assumed answer** — the taken answer; for `unverified-fact` rows —
  literally `(нет — не проверено, не допущение)`, since this is not an
  assumption but an explicitly unresolved fact (AC-03d distinguishes the two
  cases).
- **Why** — the reasoning behind the choice (for `assumed`) or the reason it
  could not be verified (for `unverified-fact`).
- **Used in** — document + section where the row is used — a mandatory
  field; point-fix regeneration on override is built on it. May list several
  `document §section` pairs, separated by `;`.
- **Status** — `assumed` \| `unverified-fact` \| `overridden` \| `resolved`.
  `overridden` rows are never deleted — the new answer is appended alongside
  the old one, in place (audit trail).

The file is **append-only for new rows**, but an existing row's
`Status`/`Assumed answer` may be updated in place on override — the one
field in the framework with this mixed append/edit mode (`session-log.md`,
by contrast, is purely append-only — never edits existing rows).

## One final human gate per issue — not two

> **Один финальный человеческий гейт на issue (G6/AC-03c/AC-12d) — не два.**
> Для `idea` этот гейт — сессия решения (`pf-idea-verdict` Режим 2).
> Для `spike` отдельной сессии решения нет (пайплайн spike не производит
> `verdict.md`), поэтому его единственный гейт — обычный `/pf-close`'s
> Phase 1, сохраняемый без изменений по смыслу (US-09e).
> Для front-loaded `feat`/`improve`/`bug` этот же гейт — расширенный
> `/pf-close`'s Phase 1 ("Final decision gate"), показывающий тот же
> ledger `[assumed]`/открытых вопросов, что и decision session, перед
> обычным подтверждением закрытия. Ни для одного из четырёх типов эти два
> гейта не удваиваются: `idea` **не** проходит затем ещё и через обычный
> `/pf-close` Phase 1 (Phase 1 для `TYPE: idea` пропускается целиком —
> подтверждённая "## Decision" уже и есть подтверждение закрытия); `spike`
> не получает decision session сверх своего Phase 1; front-loaded
> `feat`/`improve`/`bug` не получают отдельной "decision session" сверх
> расширенного Phase 1.

## Exceptions for idea/spike — exactly one case

> **Исключения для `idea`/`spike` — только сам финальный гейт, ничего
> mid-pipeline.** `code.review: skip` confirmation guard не применим
> вовсе (нет ключа `code`). Предложение установить Codex CLI/плагин **не
> встречается посреди пайплайна**, потому что готовность к Codex-ревью
> решается **на intake**, тем же батчем, что и остальные intake-вопросы
> (`profile: claude-writes-codex-reviews`): если Codex-ревью не выбрано на
> intake, Codex-цепочка не запускается вообще, и install-вопрос физически
> не возникает; если выбрано — install-вопрос обрабатывается как обычный
> front-loaded hook (допущение "да, установить" в `open_questions.md`), не
> как исключение. Единственный случай, остающийся безусловным — Codex
> выбран, но ни CLI, ни `npm` недоступны (нечего устанавливать): тогда это
> не вопрос "да/нет", а жёсткая остановка, которую `pf-roles` §11's
> Availability check и `on_unavailable` уже обрабатывают как обычно.

This is **exactly one** exception — not a list of four. Every other
front-loaded hook site behaves per the Front-loaded rule above, unmodified,
for `idea`/`spike` issues.

## `interaction: front-loaded` field

```yaml
interaction: front-loaded    # опционально; отсутствует по умолчанию → сегодняшнее интерактивное поведение
```

Опционально для `feat`/`improve`/`bug` — отсутствует по умолчанию →
сегодняшнее интерактивное поведение. Поле читается **каждым** hook-сайтом
(`specs.md` §7.13) индивидуально, не единожды где-то централизованно — та
же "resolve fresh every time" дисциплина, что `pf-roles` §8 уже применяет
к `roles:`/`profile:`. Отсутствие поля, `interaction: interactive` (явно)
или любое иное значение, кроме буквально `front-loaded` — сегодняшнее
поведение, без изменений.

Для `idea`/`spike` поле присутствует всегда, но **не читается как переключатель** — эти два типа front-loaded безусловно, само поле в их `prompt.md` — для единообразия grep'а/отображения, не активная логика ветвления (в отличие от feat/improve/bug, где поле — единственный переключатель этого поведения).

## Codex text-REPL adapter (non-Claude orchestrator)

Applies whenever **this session's own orchestrating runtime** is not Claude
Code — i.e. `orchestrator_provider` (defined next) resolves to something
other than `claude` — **not** by any resolved `write` actor. `write`
(`~/.claude/skills/pf-roles/SKILL.md` §4/§7) governs who *authors* a given
document's content, resolved per role/key; `orchestrator_provider` governs
whether *this session itself* has the `AskUserQuestion` tool available at
all, and is a single fact about the session, never resolved per role. The
two do not move together: a Claude session with `write: codex` still has
`AskUserQuestion` and never needs this adapter (content authorship is
delegated via §7's write-invocation form, called *by* this session, which
keeps asking structured questions itself); a session actually orchestrated
by a non-Claude runtime needs this adapter regardless of what any
individual role's `write` resolves to.

**`orchestrator_provider` — where it comes from, and the default.** A fact
about which runtime is currently interpreting/driving this `pf-*` skill
session — the same "this session" already referenced throughout these
skills (e.g. `pf-idea-verdict`'s Mode 2, `pf/SKILL.md`'s `analysis.md`
clarifying dialog) — one of `claude` | `codex`. It is **not** read from
`prompt.md`, **not** resolved via `pf-roles`' actor-resolution algorithm
(§4), and **not** auto-detected by probing the environment or the
available-tools list — the runtime driving the session already knows its
own identity, the same way this Claude Code session already knows it is
Claude Code. **Default when unspecified: `claude`** — today, only Claude
Code can run these skills at all (a Codex-native orchestrator is out of
scope of this issue, BRD Non-Goals), so an unset `orchestrator_provider`
preserves today's behavior exactly, unchanged, at every call site below.

This is the contract for the two mandatory human stops that survive the
front-loaded design: the intake sequence and the final gate (decision session
`pf-idea-verdict` Mode 2 for `idea`; front-loaded `pf-close`'s Phase 1 for
`spike`/feat/improve/bug — see "One final human gate per issue" above). This
section is the **contract** those call sites reference by name — not a
Codex-runtime implementation (running the framework under Codex end-to-end
is out of scope, BRD Non-Goals), but concrete enough for a future
Codex-runtime issue or a manual Codex review (TC-029) to verify directly,
without reopening the question from scratch.

1. **Question format.** Instead of `AskUserQuestion`, the question is
   printed as plain text into the session, in the same field order as the
   structured variant: a short context summary (recommendation + reason, or
   the issue summary), then a numbered list of options (the same option
   vocabulary as the structured question), then an explicit instruction —
   "reply with the number or the exact option text".
2. **Pending-state — exact marker, where it lives.** Before printing the
   question, write a marker line into the document (not session memory):
   `<!-- pf-pending-interaction: stage=<stage-key> step=<step> entry=
   <bare-folder|existing-project|-> options=<opt1>|<opt2>|...
   selected=<selected-object|-> asked=<ISO-timestamp>
   status=<open|resolved> answer=<base64|-> -->`. Placement:
   - `verdict.md` (decision session, `stage=decision-session`) — the marker
     is **not** placed "immediately before `## Decision`": Mode 2 runs
     exactly when that heading is absent — it is Mode 2's own eventual
     output, not a precondition (`pf-idea-verdict` Режим 2 — "## Decision
     is never written in this mode" applies equally to Mode 2 while a
     question is still pending). Append the open marker as `verdict.md`'s
     last line instead; once resolved (item 4 below), "## Decision" is
     appended after it in the normal way, and the marker line is rewritten
     in place, not moved.
   - `open_questions.md` (final gate at front-loaded `pf-close`'s Phase 1,
     `stage=final-gate`) — `pf-close`'s Phase 1 explicitly tolerates this
     file's absence (a spike issue, or any issue that never wrote an
     `[assumed]`/`unverified-fact` row, routinely reaches the final gate
     without one — "show an empty ledger, not an error"). If it does not
     exist yet when the final-gate question is about to be printed, create
     it first, atomically, with the canonical header and table from
     "`open_questions.md` row schema (canonical)" above — even with zero
     data rows — the same lazy-creation this file already follows for its
     first real row (item 2 of "Front-loaded rule" above); do **not**
     invent a separate pending-only file that doesn't carry that schema.
     Append the marker as the file's last line, after the table — the same
     trailing-line placement `verdict.md` uses above. The marker is an HTML
     comment past the table, not a table row, so it is never mistaken for
     one by the empty-ledger check ("show an empty ledger, not an error")
     `pf-close` Phase 1 already runs. If the file already exists, append or
     rewrite the marker as its last line exactly as before.

     **For `TYPE: spike` specifically, this file's branch is not fixed.**
     `pf-close`'s Phase 1 branch preflight (CR-021) may put this write on
     `issue/<spike-id>` or on PARENT-BRANCH depending on where the close
     started, and Phase 3.5's later `git checkout issue/<spike-id> --
     docs/issues/open/<spike-id>` can replace this whole file with a
     different branch's copy. Placement stays exactly as specified above —
     still the file's last line, after the table — this skill defines
     *where the line goes inside the file*, not *which branch's copy of the
     file survives close*; that guarantee (the marker line is carried
     forward across that checkout whenever it would otherwise be lost) is
     `pf-close`'s responsibility, not this skill's — see
     `~/.claude/skills/pf-close/SKILL.md` Phase 1 ("Branch preflight") and
     Phase 3.5 (CR-021).
   - the intake draft (`stage=intake`) — see item 5 below for where that
     document lives and when it is created; the marker lives inside it, not
     in the eventual `prompt.md`.

   At most one open marker per interactive point (`stage`+document pair) — a
   new question for the same point replaces it in place, never duplicates
   it.

   **Closed state schema — every field the marker must carry:**
   - `stage` — exactly one of `intake` | `decision-session` | `final-gate`
     (the three interactive points this contract's opening paragraph and
     "One final human gate per issue" above enumerate — no fourth value).
   - `step` — position within that stage, so a resumed session knows
     exactly where it stopped, not merely that something is pending:
     - `intake` → one of, in the fixed order below. This covers every
       `AskUserQuestion` call the intake sequence makes anywhere in
       `~/.claude/skills/pf/SKILL.md`'s Step 0, Step 3, and the Idea/Spike
       branches under "Creating prompt.md" — not only the two content
       batches:
       - `folder-mode` — Step 0's own fork ("An idea"/"a project, right
         away", exactly two options), asked only when `has_pf` was false at
         the start of this run. Never confused with `issue-type` below:
         the two ask genuinely different questions (two options deciding
         whether an intake pipeline runs at all, vs. four options deciding
         which pipeline) and never both fire in the same intake sequence —
         `folder-mode`'s "An idea" answer resolves `<type>` to `idea`
         directly, without ever reaching `issue-type`; its "A project,
         right away" answer resolves no `<type>` at all, it scaffolds and
         falls through to Step 3, whose own `issue-type` question is what
         actually resolves `<type>` for that path.
       - `issue-type` — Step 3's feat/bug/idea/spike four-option question,
         asked whenever Step 3 runs (a project where `has_pf` was already
         true, or one Step 0's "A project, right away" branch just
         scaffolded and fell through into Step 3).
       - `type-confirm` — the conditional spike-vs-feature disambiguation
         follow-up ("This sounds like a technical spike…"), exists only
         after `issue-type`, fires only when free text was ambiguous. Never
         follows `folder-mode` — Step 0's fork has no confirmation
         follow-up of its own. Absent from the sequence when it never
         fired — a resumed session that finds no marker at this step, with
         `issue-type` already resolved unambiguously, treats it as never
         asked, not as still pending.
       - `language` — the shared `doc_language` question ("What language
         should the planning documents…"), asked once regardless of type.
       - `<batch>.<question>` (e.g. `1.2` = batch 1, question 2) — the
         existing per-type content batches, unchanged. Batch/question
         counts and order are each issue TYPE's own fixed,
         statically-defined sequence in `~/.claude/skills/pf/SKILL.md`'s
         intake batches (e.g. idea's Batch 1 has 4 questions, Batch 2 has
         3; spike's Batch 1 has 4, Batch 2 up to 4 with some optional) —
         not restated here, looked up via `step` on resume.
       - `file-confirm` — Idea branch only, conditional: inserted
         immediately after whichever Batch 1 question asks for "the idea
         itself" resolves, only when that answer named a file to extract
         the idea from ("Idea from a file" — show the extracted text back
         for confirmation before it goes anywhere). Absent when the idea
         was typed directly, same absent-means-never-asked rule as
         `type-confirm`.
       - `roles.<n>` — role assignment ("Role assignment" in
         `~/.claude/skills/pf/SKILL.md`), `<n>` the 1-indexed ordinal of
         the actual question asked in this flow, in whichever order they
         concretely occur (the profile-or-individually choice, then one
         write+review question per group or, if "Set per stage…" was
         picked, per key). Unlike the content batches, this count is not
         statically fixed per TYPE — it depends on that in-flow choice —
         so a resumed session infers its position from how many
         `roles.<n>` steps this issue's history already resolved, not from
         a pre-registered total.
       - `on-unavailable` — the `on_unavailable` question, always the last
         intake question whenever role assignment runs at all.

       `roles.<n>` and `on-unavailable` never appear in the sequence for
       the Idea branch's Step 0 bare-folder entry ("Bare-folder carve-out
       (AC-01b)" in `~/.claude/skills/pf/SKILL.md`, which skips role
       assignment and `on_unavailable` outright); they are always present
       for the Spike branch and for the Idea branch's Step 3 entry.
     - `decision-session` / `final-gate` → one of `main` (the opening
       question — confirm/choose-other/override, or Proceed/Override/Stop)
       | `choose-other` (`decision-session` only — the second question
       listing the remaining verdict values) | `override-select` (pick an
       `open_questions.md` row with `Status: assumed`) | `override-answer`
       (free-text new answer for the row picked in `override-select`). Both
       stages share the same override sub-flow shape by design
       (`final-gate` reuses `decision-session`'s "2. Override" by
       reference, per `~/.claude/skills/pf-close/SKILL.md` Phase 1's
       front-loaded gate text).
   - `entry` — **`intake` only**; `-` for `decision-session`/`final-gate`
     (not applicable there) and while `stage=intake` is still at
     `step=folder-mode`/`issue-type`/`type-confirm` (`<type>` itself not
     yet known — see item 5 below). One of `bare-folder` |
     `existing-project` once set: which fork produced this intake
     sequence — Step 0's bare-folder `folder-mode` "An idea" answer, or
     Step 3's `issue-type` question (reached either because `has_pf` was
     already true, or because `folder-mode`'s "A project, right away"
     answer just scaffolded one and fell through into Step 3). Set exactly
     once, at the same moment `<type>` itself becomes known and the typed
     draft `.pf-intake-draft-<type>.md` is created (item 5 below), and
     never recomputed afterward — in particular, never re-derived from a
     fresh `has_pf` check on resume, since folder state can change between
     when intake started and when a later session resumes it. This is what
     `~/.claude/skills/pf/SKILL.md`'s Idea branch bare-folder carve-out
     ("Bare-folder carve-out (AC-01b)" vs. "Existing-project role
     assignment") resumes on: `entry=bare-folder` skips
     `roles.<n>`/`on-unavailable` outright (consistent with those steps
     never appearing in this draft's own `step` sequence, per the
     `roles.<n>`/`on-unavailable` paragraph above); `entry=existing-project`
     runs them normally. A resumed session reads this stored field to
     decide, never `has_pf` recomputed at resume time.
   - `options` — unchanged from before: the same option vocabulary as the
     structured question this line stands in for. Empty/omitted for
     `override-answer` (free text, not a menu).
   - `selected` — the object a multi-step sub-flow is already committed to,
     `-` when there is none yet: the `open_questions.md` row number once
     `step=override-select` resolves and `step=override-answer` becomes
     pending — so a resumed session knows which row's free-text answer it
     is still waiting for, without re-showing the row picker.
   - `asked` — unchanged (ISO-timestamp of the current `step`).
   - `status` — a closed two-value enum, `open` \| `resolved` — never the
     free-text answer itself; `open` while the current `step` is
     unanswered. See item 4 for its one closing transition.
   - `answer` — the free-text reply, standard base64 (RFC 4648, the
     `+`/`/` alphabet — never the URL-safe `-`/`_` variant, whose `-`
     could still combine with an adjacent literal `>`). `-` while
     `status=open` (there is no answer yet). Base64's fixed alphabet
     cannot itself contain a newline or the sequence `-->` regardless of
     what the reply text contains — the reason `status` and `answer` are
     two separate fields instead of one `status=resolved:<answer>` field:
     decode `answer` to recover the literal reply, never parse it out of
     `status`.

   Question text itself is never duplicated into the marker: for `intake`,
   the wording is the fixed, statically-defined text of the question named
   by `step` (a content-batch question, or one of the named pre-/post-batch
   questions above — `folder-mode`, `issue-type`, `type-confirm`,
   `language`, `file-confirm`, `roles.<n>`, `on-unavailable`); for
   `decision-session`/`final-gate`, it is already
   fixed in the surrounding document text (the recommended verdict and its
   reasoning, or the assumptions/open-questions ledger) exactly as item 4
   already required. `step` plus that surrounding text is sufficient
   context to reproduce the question verbatim without recomputing anything.
3. **Answer parsing.** Normalize the reply (trim, lower-case, strip
   punctuation) and match it against (a) the option's number, (b) the
   option's exact text, (c) known synonyms of each option's first 1-2
   significant words (e.g. "подтвер"/"confirm" → Подтвердить). Unrecognized
   — re-ask the same question once, plain text: "Не понял ответ, выберите
   один из: …", without writing a new marker (`asked` is not updated).
4. **Safe resumption.** A new Codex session for the same issue, on
   re-reading the document, must check for a `pf-pending-interaction`
   marker with `status=open` **before** any other action; if one is found,
   re-show the question at its recorded `step` (item 2's schema above — do
   not recompute the recommendation, do not restart the stage from
   scratch, do not re-ask a `step` already resolved). **Closing a marker —
   exactly one strategy:** a valid answer that resolves the current `step`
   never deletes the marker line; it base64-encodes the literal reply text
   into `answer` and rewrites `status=open` to `status=resolved` in place —
   the same in-place, audit-preserving *edit* `open_questions.md`'s
   `Status` column already uses on override
   (`~/.claude/skills/pf-idea-verdict/SKILL.md`'s "2. Override" step 5),
   reused here for the same reason: the record of what was asked and
   answered stays legible after the fact (decode `answer` to read it back —
   `open_questions.md`'s `Status` column, unlike this marker's `answer`
   field, stays a closed vocabulary and never itself carries free text).
   When the resolved `step` is not the stage's last one (e.g.
   `override-select` just resolved and `override-answer` is next), the
   same rewrite also advances `step` to the next one and sets
   `status=open`/`answer=-` again with `selected` filled in, rather than
   being removed — the marker line is retired only when its stage fully
   completes (item 5 covers two such retirements for `intake`, each also
   retiring the document holding it: the typed draft's marker, when the
   draft becomes `prompt.md`; and, as a **sanctioned exception to
   "exactly one strategy" above**, the type-agnostic pending file's
   marker, when `folder-mode`/`issue-type`/`type-confirm` resolves. That
   one answer is never rewritten to `status=resolved` in place, and its
   document is deleted rather than retained resolved: its "answer" isn't a
   base64 reply to preserve, it *is* `<type>` and `entry`, which the typed
   draft created in the same handoff already carries forward as its own
   `entry` field and its filename — recording it twice would duplicate,
   not preserve, the audit trail. CR-022's ordering — create the typed
   draft with its own open marker, verify it, only then delete the pending
   file — is what keeps this exception from ever producing a
   zero-open-marker gap; see item 5's "Handoff to the typed draft" for the
   exact steps and the transitional window they can leave open.). Once a
   marker reads `status=resolved` (with `answer` decoded) for a stage's
   last `step`, normal logic resumes exactly as on the Claude path (append
   "## Decision", etc.).
5. **Intake (`stage=intake`).** The same protocol also covers the whole
   intake sequence (item 2's `step` dictionary above, not only the two
   content batches) — pending-state lives in a draft document, not session
   memory, on the same principle as items 2-4 above. Two sub-cases, split
   by whether `<type>` is already known:
   - **`step=folder-mode`, `step=issue-type`, and `step=type-confirm`.**
     These are what determines `<type>` in the first place, so neither a
     `<type>`-named draft nor `docs/issues/open/<issue-id>/prompt.md` can
     exist yet when any of them is asked — for Step 0's bare-folder entry,
     `docs/issues/open/` itself may not exist yet either. Before printing
     whichever of these questions comes first on this run's path
     (`folder-mode` for Step 0, `issue-type` for Step 3), create (the
     parent directory too, if absent) a fixed, type-agnostic pending file,
     `docs/issues/open/.pf-intake-draft-pending.md`, and write the marker
     into it, `entry=-` — item 2's "at most one open marker per interactive
     point" rule applied with only one point instead of one-per-`<type>`,
     since no `<type>` exists yet to key separate points by (a single run
     only ever takes one of the two forks, never both, so this is still one
     point). Nothing else is written into this file: the
     `folder-mode`/`issue-type`/`type-confirm` answers are a routing
     decision, not `prompt.md` content.

     **Handoff to the typed draft — create-and-verify before delete, never
     the reverse (CR-022).** `folder-mode`'s "An idea" answer resolves
     `<type>` to `idea` directly (`entry=bare-folder`); `issue-type` (and
     `type-confirm`, if it fired) resolves `<type>` to whichever of
     `feat`/`improve`/`bug`/`idea`/`spike` was chosen (`entry=
     existing-project` — `folder-mode`'s "A project, right away" answer
     never resolves `<type>` itself, it scaffolds and falls through to
     Step 3's `issue-type` question instead, which is what actually
     resolves it, to `entry=existing-project`). Once `<type>`/`entry` are
     known, hand off in this order, never the reverse:
     1. Create the typed draft below (or, where the runtime's file
        operations support it, atomically rename
        `.pf-intake-draft-pending.md` to `.pf-intake-draft-<type>.md` and
        edit the renamed file's content in place — either way, the file
        that ends up at the typed-draft path already carries `entry` and a
        `pf-pending-interaction` marker advanced to `step=language`,
        `status=open` — the *next* pending question, not the
        just-resolved `folder-mode`/`issue-type`/`type-confirm` step).
     2. Read the typed-draft path back and confirm the marker line is
        actually there with `status=open` at `step=language` — the file on
        disk, not memory of having just written it.
     3. Only then remove `.pf-intake-draft-pending.md`, if it still exists
        as a separate path (a no-op when step 1 used rename).

     Deleting `.pf-intake-draft-pending.md` before the typed draft exists
     and is confirmed — the previous ordering — is exactly the bug this
     fixes: an interruption inside that gap left the system with **no**
     open marker anywhere, and the next `/pf` found "None found" at Step 0
     and restarted intake from scratch, discarding the already-resolved
     `<type>`/`entry` and every answer gathered so far — precisely what
     this whole mechanism exists to prevent. With the order above, a crash
     before step 1 completes leaves the pending file's `status=open`
     marker intact (resumes the `folder-mode`/`issue-type`/`type-confirm`
     question, unanswered from the file's own perspective — safe, if
     mildly redundant when the user had just answered it this session). A
     crash between step 1 and step 3 (only reachable via the two-file
     variant; rename collapses this window to nothing) briefly leaves
     *both* files present with open markers — safe under the same
     invariant, resolved by Step 0's existing "More than one found" rule
     the same way two concurrently mid-flight typed drafts already are
     (`~/.claude/skills/pf/SKILL.md` Step 0): pick the earliest `asked`
     first. That may re-show the already-resolved
     `folder-mode`/`issue-type`/`type-confirm` question once more instead
     of jumping straight to `language` — never the CR-022 failure mode of
     losing the marker altogether.
   - **`step=language` onward.** The eventual issue folder name is only
     decided once its slug is known, and the slug is itself derived from an
     answer gathered *later* in intake (`~/.claude/skills/pf/SKILL.md`'s
     Idea/Spike branches — "a short kebab-case slug from the idea's topic,
     decided when `prompt.md` is written"), so the draft still cannot start
     life at the final `docs/issues/open/<issue-id>/prompt.md` path even
     once `<type>` is known — that path does not exist yet when `language`
     is asked. `docs/issues/open/.pf-intake-draft-<type>.md` (`<type>` =
     `idea` | `spike` | `feat` | `improve` | `bug`; at most one draft per
     `<type>` open at a time, the same one-open-marker-per-point rule from
     item 2 applied here to a concurrently-running intake — this is what
     lets two different-`<type>` intakes run concurrently once each has
     separately completed the handoff above) is exactly the file the
     handoff above already created, `entry` already set and its marker
     already open at `step=language` — there is nothing further to create
     here, only to keep appending to. Each
     answered question from `language` onward is appended into this draft
     as it comes in, and the `pf-pending-interaction` marker (`stage=intake`)
     lives inside it, advanced per item 4 as each question resolves. Once
     the sequence's last `step` actually present resolves (`on-unavailable`
     normally; Batch 2's last question for the Idea branch's Step 0
     bare-folder entry, since `roles.<n>`/`on-unavailable` are skipped
     there per item 2's dictionary) and the slug is known, the draft's
     accumulated content (its answered-question body, not the
     now-resolved marker line) becomes the real `prompt.md` written to
     `docs/issues/open/<issue-id>/prompt.md` — the ordinary write,
     unchanged — and `.pf-intake-draft-<type>.md` is deleted: this is the
     one case where retiring a fully-resolved marker's document is
     expected (item 4), because the draft is a transient stand-in for
     `prompt.md`, not the pipeline's permanent record of the intake
     answers — `prompt.md` itself is that record from this point on.
