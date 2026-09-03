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
issue; the exact `open_questions.md` row format shared by both applications lives
in `specs.md` §6.9. Here — the rule itself, referenced by name from every hook
site.

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
>    `[assumed] <вопрос> → <взятый ответ> — <почему>` (точный формат
>    `specs.md` §6.9; этот файл появляется лениво, первым пишущим
>    скиллом/стадией, которой есть что в него записать — он не создаётся
>    этой задачей заранее).
> 3. Продолжить стадию с этим ответом, не останавливаясь.

## One final human gate per issue — not two

> **Один финальный человеческий гейт на issue (G6/AC-03c/AC-12d) — не два.**
> Для `idea`/`spike` этот гейт — сессия решения (`pf-idea-verdict` Режим 2).
> Для front-loaded `feat`/`improve`/`bug` этот же гейт — расширенный
> `/pf-close`'s Phase 1 ("Final decision gate"), показывающий тот же
> ledger `[assumed]`/открытых вопросов, что и decision session, перед
> обычным подтверждением закрытия. Ни для одного из четырёх типов эти два
> гейта не удваиваются: `idea`/`spike` **не** проходят затем ещё и через
> обычный `/pf-close` Phase 1 (Phase 1 для `TYPE: idea`/`spike`
> пропускается целиком — подтверждённая "## Decision" уже и есть
> подтверждение закрытия); front-loaded `feat`/`improve`/`bug` не получают
> отдельной "decision session" сверх расширенного Phase 1.

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
