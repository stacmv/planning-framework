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

## Codex text-REPL adapter (non-Claude `write`)

Applies whenever the resolved `write` actor for an affected interactive point
is `codex`, not `claude` (`~/.claude/skills/pf-roles/SKILL.md` §8/§10) — the
two mandatory human stops that survive the front-loaded design: the intake
batch and the final gate (decision session `pf-idea-verdict` Mode 2 for
`idea`; front-loaded `pf-close`'s Phase 1 for `spike`/feat/improve/bug — see
"One final human gate per issue" above). This section is the **contract**
those call sites reference by name — not a Codex-runtime implementation
(running the framework under Codex end-to-end is out of scope, BRD
Non-Goals), but concrete enough for a future Codex-runtime issue or a manual
Codex review (TC-029) to verify directly, without reopening the question
from scratch.

1. **Question format.** Instead of `AskUserQuestion`, the question is
   printed as plain text into the session, in the same field order as the
   structured variant: a short context summary (recommendation + reason, or
   the issue summary), then a numbered list of options (the same option
   vocabulary as the structured question), then an explicit instruction —
   "reply with the number or the exact option text".
2. **Pending-state — exact marker, where it lives.** Before printing the
   question, write a marker line into the document (not session memory):
   `<!-- pf-pending-interaction: <stage-key> | options: <opt1>|<opt2>|... |
   asked: <ISO-timestamp> -->`, inserted into `verdict.md` immediately
   before "## Decision" (decision session), or into `open_questions.md` as
   its own line (final gate at front-loaded `pf-close`'s Phase 1 — no
   "## Decision" analog exists there). At most one open marker per
   interactive point — a new question for the same point replaces it, never
   duplicates it.
3. **Answer parsing.** Normalize the reply (trim, lower-case, strip
   punctuation) and match it against (a) the option's number, (b) the
   option's exact text, (c) known synonyms of each option's first 1-2
   significant words (e.g. "подтвер"/"confirm" → Подтвердить). Unrecognized
   — re-ask the same question once, plain text: "Не понял ответ, выберите
   один из: …", without writing a new marker (`asked` is not updated).
4. **Safe resumption.** A new Codex session for the same issue, on
   re-reading the document, must check for an unresolved
   `pf-pending-interaction` marker **before** any other action; if one is
   found, re-show the same question (do not recompute the recommendation —
   it is already fixed in the surrounding document text), and do not
   restart the stage from scratch. A valid answer removes the marker (or
   marks it `resolved: <answer>` — the implementation records which of the
   two equivalent forms it uses), and then normal logic resumes (append
   "## Decision", etc.) exactly as on the Claude path.
5. The same protocol also covers the intake batch (pending-state lives in
   the not-yet-committed `prompt.md` draft at that point — same principle:
   state lives in the document, not session memory) — one mechanism for
   both remaining interactive points under Codex, not only the final gate.
