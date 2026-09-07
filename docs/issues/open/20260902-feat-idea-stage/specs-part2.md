# Технический спек: Стадия идеи — часть 2/3 (§6-§7)

**Version:** 1.0
**Date:** 2026-09-02
**Часть:** 2 из 3 — продолжает `specs-part1.md`. См. индекс `specs.md`.

## 6. Frontmatter & document schemas

Прозаические поля (не заголовки/имена полей/код) пишутся на языке
`doc_language` соответствующего issue — ниже даны примеры на русском,
поскольку это язык самого issue `20260902-feat-idea-stage`; структура
одинакова для любого `doc_language`.

### 6.1 `prompt.md` — тип `idea`

```yaml
---
type: idea                        # избыточно с именем папки, сверяется — §5.1
doc_language: Russian
idea_tier: product                # personal | infra | product | content
interaction: front-loaded         # константа для idea/spike — не переключатель (§6.11)
profile: claude-writes-codex-reviews   # опционально — та же схема pf-roles §3
roles:                            # опционально — та же схема pf-roles §1, ключи: idea, research, critique, verdict
  idea:      { write: claude, review: [claude] }
  research:  { write: claude, review: [claude] }
  critique:  { write: claude, review: [claude] }
  verdict:   { write: claude, review: [claude] }
on_unavailable: degrade-tier      # опционально, та же семантика pf-roles §11
---

## Idea
<текст идеи, введённый пользователем или извлечённый из файла и подтверждённый — §3.1.3>

## Evidence of Pain
<свидетельства того, что боль реальна>

## Constraints
<ограничения — бюджет, время, технологии и т.д.>

## Out of Scope
<что заведомо не входит в рассмотрение>

## What Would Convince You: Project
<критерий пользователя — что должно быть верно, чтобы вердикт стал `project`>

## Decision Rights
<что ИИ может решать самостоятельно без уточнения — свободный текст>
```

Поле `idea_ref` (§6.1.1) присутствует, только когда issue создан из
вердикта другой идеи (никогда — при прямом создании).

#### 6.1.1 `idea_ref` (наследуемое поле — используется и `idea`, и `spike`, и первым `feat`)

```yaml
idea_ref: 20260815-idea-example    # ID уже ЗАКРЫТОГО idea-issue, из чьего вердикта родился этот issue
```

Присутствует только когда issue создан автоматически из вердикта `project`
(в первом `feat`-issue) или `spike-first` (в `spike`-issue) — см. §7.3.1.
Отсутствует у issue, созданного вручную/напрямую. Значение — ID папки,
которая на момент записи (Phase 4.6, part1 §4.4) физически всё ещё лежит
под `docs/issues/open/` (Phase 4.6 идёт **до** Phase 5 — bootstrap-порядок
findings #2-5/#19 этого ревью), но к моменту, когда что-либо иное впервые
читает этот `prompt.md` (следующая сессия, следующий вызов `/pf-brd`),
`/pf-close`'s Phase 5 того же прогона уже переместила её под
`docs/issues/closed/` — значение поля трактуется как ID под `closed/`
везде за пределами самого Phase 4.6.

### 6.2 `idea.md`

#### 6.2.1 Секции (US-04a, дословно; порядок фиксирован)

```markdown
# Idea: <краткое имя>

## Pain & Evidence
## Analogs / Prior Art
## Differentiation / USP
## MVP
## Cost (Effort)
## Risks
## Lenses Applied
```

Каждая секция, где применение линзы (§3.7.2 part1) требует отдельного
инструмента (Lean Canvas, JTBD, SWOT, pre-mortem, TAM/SAM/SOM, Build vs.
Buy, Audience/Distribution Fit, 5 почему) — соответствующий артефакт
вкладывается **внутрь** секции "Lenses Applied" как подзаголовок
(`### Lean Canvas`, `### 5 Почему` и т.д.), не отдельными
верхнеуровневыми секциями — семь верхнеуровневых секций выше фиксированы
и не растут от `idea_tier`.

#### 6.2.2 Бюджет строк по `idea_tier`

| `idea_tier` | Бюджет `idea.md` |
|---|---|
| `personal` | ≤150 строк |
| `infra` | ≤200 строк |
| `content` | ≤200 строк |
| `product` | ≤300 строк |

Механическая проверка — `wc -l`, тот же паттерн, что и oversized-guard'ы
`pf-execute`/`pf-check` для `size_tier`-документов (счёт строк, не
семантическая оценка).

### 6.3 `research.md`

```markdown
# Research: <краткое имя>

## Facts

| # | Claim | Status | Source | Notes |
|---|---|---|---|---|
| 1 | <утверждение> | проверено | <URL или путь к файлу> | |
| 2 | <утверждение> | не проверено | — | <почему не удалось проверить> |

## Methodology
<что и как искалось — запросы, источники, что не проверялось и почему>

## Open Questions Raised
<указатель на open_questions.md — не дублирует содержимое, см. §6.9>
```

**Инвариант записи (AC-05b):** Status = `проверено` ⇒ Source непусто.
Скилл, порождающий этот документ, никогда не пишет обратную комбинацию —
см. §3.3 part1, п.3.

Бюджет: personal ≤80, infra ≤120, content ≤120, product ≤200 строк
(мягкий ориентир — количество строк таблицы Facts определяется числом
проверяемых утверждений в `idea.md`, не устанавливается искусственно).

### 6.4 `critique.md`

```markdown
# Critique: <краткое имя>

## <Персона 1 — например, "Скептик-инвестор">
- <возражение 1>
- <возражение 2>

## <Персона 2>
...

## Summary Table

| # | Objection | From | Response | Disposition | Reflected in |
|---|---|---|---|---|---|
| 1 | <возражение> | Скептик-инвестор | <ответ> | Отвечено \| Риск принят \| Идея меняется | verdict.md §Reasoning \| open_questions.md #N |
```

`Disposition` — закрытый словарь из трёх значений (§3.4 part1, п.5).
Каждая строка Summary Table обязана иметь непустой `Reflected in`
(AC-06c).

Бюджет: personal ≤200, infra ≤250 (5 персон), content ≤250 (5 персон),
product ≤300 (6 персон) строк.

### 6.5 `verdict.md`

**Режим 1 (запись) skeleton — намеренно не содержит заголовка `##
Decision` вовсе** (finding #13 — черновик показывал этот заголовок в
skeleton'е самого документа, притом что соседний текст и routing считают
именно отсутствие заголовка единственным признаком неподтверждённого
вердикта; реализация, буквально следующая skeleton'у ниже, никогда не
рискует принять placeholder-заголовок за подтверждение, потому что
заголовка в написанном Режимом 1 файле физически нет):

```markdown
# Verdict: <краткое имя>

## Recommended Verdict
<project | spike-first | defer | archive> — <однострочное обоснование>

## Reasoning
<полное обоснование, сверенное с пятью сигналами §3.5 part1 п.1>

## Return Conditions
<ТОЛЬКО для defer — свободный текст условий возврата, без дат>

## Assumptions Summary
<построчный пересказ каждой [assumed]-записи open_questions.md>

## Unverified Facts Summary
<построчный пересказ каждой unverified-fact-записи>
```

Файл, записанный Режимом 1, заканчивается на "## Unverified Facts
Summary" — ничего после неё. "## Decision" появляется **только** как
append-блок Режима 2 (§3.5.3 part1), никогда не как часть исходного
skeleton'а — это единственное место во всём файле, где заголовок
дописывается:

```markdown
## Decision

**Confirmed verdict:** <project | spike-first | defer | archive>
**Confirmed by:** <пользователь-инициатор сессии>
**Date:** <YYYY-MM-DD>
**Timestamp:** <UTC ISO-8601>
```

`Confirmed by` — поле, которое §3.5.3 part1's прозаическое описание уже
требует ("пользователь-инициатор"), но более ранняя редакция этой
фиксированной формы его не несла (finding #32) — добавлено для
соответствия собственному требованию аудируемости этого спека.

Бюджет: personal ≤60, остальные ≤100 строк (без секции `## Decision`,
которая добавляется поверх этого бюджета — сама секция короткая и не
подлежит проверке отдельно).

### 6.6 `hypothesis.md`

```markdown
# Hypothesis: <краткое имя>

## Question
<что именно проверяем>

## Success Criterion
<что должно быть истинным, чтобы считать гипотезу подтверждённой>

## Time-box
<сколько времени/усилий отведено>

## Method
<как именно будем проверять — код/конфигурация/чтение документации/др.>
```

Бюджет: personal ≤50, infra/content ≤60, product ≤80 строк.

### 6.7 `findings.md`

```markdown
# Findings: <краткое имя>

## Run Evidence
<конкретное свидетельство реального прогона — команда+вывод, путь к
артефакту, или прямая цитата с источником — НЕ пересказ ожидания>

## Result vs. Success Criterion
<met | not met | partial — со ссылкой на конкретный пункт Run Evidence>

## Conclusion
<ответ на Question из hypothesis.md>

## Follow-up
<что это значит дальше — "можно двигаться к project/feat", "по-прежнему
заблокировано на X", и т.д.>
```

**Гейт (AC-09c):** `## Conclusion` не пишется без непустой `## Run
Evidence` — та же дисциплина, что у `research.md`'s Source-требования
(§3.6 part1, п.4).

Бюджет: personal ≤80, infra/content ≤120, product ≤150 строк.

### 6.8 `prompt.md` — тип `spike`

```yaml
---
type: spike
doc_language: Russian
idea_tier: infra                  # тот же словарь §3.7.1 part1 — влияет только на бюджет hypothesis.md/findings.md, не на линзы/персоны (spike не производит idea.md/critique.md)
interaction: front-loaded
idea_ref: 20260815-idea-example   # опционально — присутствует для spike-first-исхода (§7.3.1); отсутствует для напрямую созданного spike
roles:
  hypothesis: { write: claude, review: [claude] }
  findings:   { write: claude, review: [claude] }
on_unavailable: degrade-tier
---

## Question
<что проверяем>

## Success Criterion
<критерий успеха, как его сформулировал пользователь на intake>

## Time-box
<сколько времени/усилий>

## Method
<как проверяем>

## Constraints
<опционально>

## Out of Scope
<опционально>

## Decision Rights
<что ИИ решает сам>
```

### 6.9 `open_questions.md` — сквозной журнал (не стадия, §5.6 part1)

```markdown
# Open Questions — <ISSUE-ID>

| # | Raised by | Question | Assumed answer | Why | Used in | Status |
|---|---|---|---|---|---|---|
| 1 | pf-idea | Какой объём рынка у идеи? | Не оценивается численно — нет данных на intake | Оценка TAM без источника была бы выдумкой | idea.md §MVP | assumed |
| 2 | pf-idea-research | Есть ли лицензионные ограничения у аналога X? | (нет — не проверено, не допущение) | Официальный прайсинг не найден за разумное время поиска | research.md (Facts #4) | unverified-fact |
| 3 | pf-idea-critique | Как реагировать на возражение техлида про масштабирование? | Риск принят — MVP не требует масштабирования | critique.md's диспозиция не дала однозначного ответа без дополнительного контекста | verdict.md §Reasoning | assumed |
```

**Столбцы:**
- **Raised by** — стадия/скилл, породивший запись.
- **Question** — сформулированный вопрос (тот, что был бы задан в
  интерактивном режиме).
- **Assumed answer** — взятый ответ; для `unverified-fact`-строк — `(нет
  — не проверено, не допущение)` буквально, поскольку это не допущение, а
  явно нерешённый факт (AC-03d различает эти два случая — см. §3.3 part1
  п.4).
- **Why** — обоснование выбора (для `assumed`) или причина непроверяемости
  (для `unverified-fact`).
- **Used in** — документ + секция, где запись использована — обязательное
  поле, на нём строится точечная регенерация при override (§3.5.2 part1).
  Может перечислять несколько пар `документ §секция`, через `;`.
- **Status** — `assumed` \| `unverified-fact` \| `overridden` \|
  `resolved`. `overridden`-строки не удаляются — рядом дописывается новый
  ответ пользователя (аудируемость, §3.5.2 п.4).

Файл **append-only для новых строк**, но `Status`/`Assumed answer`
конкретной существующей строки может обновляться на месте при override —
единственное поле фреймворка с этим смешанным режимом (`session-log.md`
для сравнения — чисто append-only, без правки существующих строк).

### 6.10 Сводная таблица бюджетов (справочная — единый источник §6.2.2/§6.3/§6.4/§6.5/§6.6/§6.7)

| Документ | personal | infra | content | product |
|---|---|---|---|---|
| `idea.md` | ≤150 | ≤200 | ≤200 | ≤300 |
| `research.md` | ≤80 | ≤120 | ≤120 | ≤200 |
| `critique.md` | ≤200 | ≤250 | ≤250 | ≤300 |
| `verdict.md` | ≤60 | ≤100 | ≤100 | ≤100 |
| `hypothesis.md` | ≤50 | ≤60 | ≤60 | ≤80 |
| `findings.md` | ≤80 | ≤120 | ≤120 | ≤150 |

Хранится буквально в `pf-idea-lenses/SKILL.md` (единственный источник) —
эта таблица здесь для целостности спека, не второй источник истины.

### 6.11 `interaction: front-loaded` — опциональное поле для `feat`/`improve`/`bug`

```yaml
interaction: front-loaded    # опционально; отсутствует по умолчанию → сегодняшнее интерактивное поведение
```

Поле читается **каждым** hook-сайтом §7.13 индивидуально (не единожды
где-то централизованно — та же "resolve fresh every time" дисциплина, что
`pf-roles` §8 уже применяет к `roles:`/`profile:`). Отсутствие поля,
`interaction: interactive` (явно) или любое иное значение, кроме буквально
`front-loaded` — сегодняшнее поведение, без изменений. Для `idea`/`spike`
поле присутствует всегда со значением `front-loaded`, но **не читается
как переключатель** — эти два типа front-loaded безусловно, само поле в
их `prompt.md` — для единообразия grep'а/отображения, не активная
логика ветвления (в отличие от feat/improve/bug, где поле — единственный
переключатель этого поведения).

## 7. Изменения в существующих скиллах

### 7.1 `skills/pf/SKILL.md`

Все поведенческие детали — §3.1 part1 (`/pf` — empty folder and три
несущих правки). Здесь — точная привязка к существующим заголовкам файла:

| Куда | Что вставить |
|---|---|
| Новый заголовок **"Step 0: Detect folder state"**, перед сегодняшним "## Step 1: Read installed version" | Логика `has_pf`/`has_git`, вопрос "идея/сразу проект", ветки — §3.1.1 |
| "## Step 2: Scan for open issues", перед п.1 ("Run `git remote`") | Not-a-repo guard — §3.1.2 |
| "## Step 3: Handle zero or multiple issues", ветка "No issue folders found" | Заменить свободнотекстовый призыв на трёхвариантный `AskUserQuestion` — §3.1.5 |
| "## Step 4: Single active issue — detect type" | Добавить два пункта (`idea-`/`spike-` префиксы) — §3.1.6 |
| "## Legacy-tier guard (before Step 5)" | Добавить условие "Skip entirely if TYPE is idea or spike" — §1.1(B) |
| "## Reviewer-assignment guard (before Step 5)" | То же условие — idea/spike не имеют ключа `code`, guard и так не сработает, но явная оговорка исключает двусмысленность |
| "## `code.review: skip` confirmation guard (before Step 5)" | То же — idea/spike не имеют ключа `code` вовсе |
| "## Step 5: Detect completed stages", таблица | Шесть новых строк — §3.1.7 |
| "## Step 6: Determine next step", перед "### trivial-tier workflow" | Новый абзац "idea/spike-пайплайн" — §3.1.8 |
| "## Step 7: Output" | Оговорка про `/pf-idea-verdict (decision session)` — §3.1.9 |
| "## Creating prompt.md" | Новые ветки "idea"/"spike" — §3.1.3, §6.1, §6.8 |

### 7.2 `skills/pf-check/SKILL.md`

**Опening `size_tier` guard (finding #1) — структурная правка, не
текстовая.** Сегодняшний первый абзац файла ("Before checking any other
prerequisite, read `prompt.md`'s frontmatter. If it has no `size_tier`
field, ask the user...") выполняется **до** определения TARGET/TYPE и
безусловно. В отличие от `pf-brd`/`pf-spec`/… (§1.1(B) part1 — их guard
физически недостижим для `idea`/`spike`, поскольку эти скиллы для таких
issue не вызываются вовсе), `pf-check` **вызывается** на документах
`idea`/`spike` (US-11d) — этот guard достигается и без правки задал бы
запрещённый вопрос посреди front-loaded пайплайна. Правка: этот абзац
получает предваряющее условие: *"First, determine TYPE from the active
issue's folder-name prefix (the same way `~/.claude/skills/pf/SKILL.md`
Step 4 does). If TYPE is `idea` or `spike`, skip this entire `size_tier`
paragraph — these issue types never carry `size_tier` and are never asked
for it (`~/.claude/skills/pf-idea-lenses/SKILL.md`'s `idea_tier` instead,
handled separately below). Only for any other TYPE does the rest of this
paragraph apply, unchanged."*

**"Determine the active issue..." (вводный абзац, предшественники по
TARGET)** — шесть новых строк:

| TARGET | Предшественники |
|---|---|
| `idea.md` | нет (первый документ пайплайна) |
| `research.md` | `idea.md` |
| `critique.md` | `idea.md`, `research.md` |
| `verdict.md` | `idea.md`, `research.md`, `critique.md` |
| `hypothesis.md` | нет |
| `findings.md` | `hypothesis.md` |

**Дополнительный context, не предшественник (finding #29).** Сразу после
этой таблицы — отдельное предложение, явно не смешиваемое со списком
предшественников (предшественники управляют conjunct 3 критерия
completeness; этот список — нет): *"For every `idea`/`spike` TARGET above,
also read `docs/issues/open/[ISSUE-ID]/prompt.md`'s intake body (not just
its `size_tier`/`idea_tier` frontmatter) as required context — the review
must be able to compare TARGET against what the user actually said at
intake, not only against TARGET's own predecessor documents. For
`critique.md`, `verdict.md`, and `findings.md` specifically, also read
`open_questions.md` if it exists — without it, the reviewer cannot verify
that every `[assumed]`/`unverified-fact` entry the document claims to
summarize is actually reflected (AC-05d/AC-06c/AC-07b depend on this
cross-check). `open_questions.md` is a side ledger, not a pipeline-stage
predecessor (§5.6 part1) — it does not gate completeness, it is read
purely as reviewer context."*

**"## Reviewer selection", таблица TARGET → key** — шесть новых строк:

| TARGET | key |
|---|---|
| `idea.md` | `idea` |
| `research.md` | `research` |
| `critique.md` | `critique` |
| `verdict.md` | `verdict` |
| `hypothesis.md` | `hypothesis` |
| `findings.md` | `findings` |

**"### Claude review path", брифинг-цитата (блок, начинающийся "Also read
`docs/issues/open/[ISSUE-ID]/prompt.md`'s `size_tier` field...")** —
добавить условную ветку **перед** этим блоком:

> Если TARGET — один из `idea.md`/`research.md`/`critique.md`/
> `verdict.md`/`hypothesis.md`/`findings.md`: вместо чтения `size_tier`
> прочитать `idea_tier` из того же `prompt.md` и сравнить объём TARGET
> с бюджетом из `~/.claude/skills/pf-idea-lenses/SKILL.md`'s сводной
> таблицы бюджетов (§6.10 этого спека) — **не** с таблицей
> `pf-size-tiers`. P0-формулировка при превышении — идентична сегодняшней,
> с заменой "size_tier" на "idea_tier" в тексте finding. Для любого
> другого TARGET (`brd.md`/`specs.md`/…) поведение этого блока не меняется.

Это же условие относится к "Codex invocation chain"'s document-form брифу
(§75 текущего файла) — он **ссылается** на тот же "the same TARGET +
predecessor list + tier-budget check... brief", так что правка одного
места (текстового шаблона брифа) покрывает обе ветки (Claude review path
и Codex document form) без дублирования.

### 7.3 `skills/pf-close/SKILL.md`

#### 7.3.1 Определение TYPE, Phase 0, и единственный человеческий гейт (finding #9)

В начало файла, сразу после "Read ISSUE-ID from the active folder name",
добавить: *"Extract TYPE from ISSUE-ID the same way `~/.claude/skills/pf/
SKILL.md` Step 4 does (folder-name prefix); TYPE ∈ {feat, improve, bug,
idea, spike}."*

**Phase 0: Prerequisite Checks** — оба существующих пункта (1: QA report
exists, 2: QA verdict PASS) получают оговорку **"— only when TYPE is feat,
improve, or bug; skipped entirely for idea/spike (neither type ever
produces qa_report.md)."** Пункт 3 ("On correct branch") заменяется
условной веткой:

| TYPE | Проверка |
|---|---|
| feat / improve / bug | Без изменений: `git branch --show-current` == `issue/ISSUE-ID` |
| idea | Не проверяется вообще — idea-пайплайн никогда не создаёт `issue/<id>`-ветку (нет кода). Проверяется вместо этого новое условие: **"## Decision" присутствует в `verdict.md`** — если нет, стоп: *"Verdict not confirmed. Run /pf-idea-verdict (decision session) first."* (AC-07e). |
| spike | Не требует нахождения именно на `issue/<id>` — допустимо быть на родительской ветке **или** на `issue/<spike-id>`, если она существует (§3.6 part1 — ветка создаётся, только если эксперимент требовал кода). |

**Новый пункт 4 (spike only) — Run Evidence gate (AC-09c, finding #6).**
Это единственное место во всём `pf-close`, где сам гейт закрытия — не
дисциплина генератора документа — механически проверяет содержимое:
1. `hypothesis.md` и `findings.md` оба завершены по общему критерию
   `pf-size-tiers` ("Stage completion") — если нет, стоп: *"Spike is not
   ready to close: <missing document>. Run /pf-idea-spike first."*
2. `findings.md`'s секция `## Run Evidence` непуста **и не является
   заглушкой** — тот же принцип, что стадия "не пишет `## Conclusion` без
   непустой `## Run Evidence`" (§3.6 part1, п.4) уже применяет к самой
   себе на запись; здесь та же проверка применяется **на чтение**, к тому,
   что реально оказалось на диске (ручное редактирование, сбой генерации
   или галлюцинация могли обойти дисциплину записи). Механическая
   проверка: секция существует, и после заголовка есть непустой текст,
   отличный от плейсхолдера `<конкретное свидетельство...>` из шаблона
   §6.7. Если пусто/отсутствует/осталась плейсхолдером — стоп: *"findings.md's
   Run Evidence is empty or a template placeholder — spike close requires
   evidence of an actual run. Fix findings.md (or re-run /pf-idea-spike
   Mode 2), then re-run /pf-close."*
3. `## Result vs. Success Criterion` ссылается на конкретный пункт из
   `## Run Evidence` (не пустая секция) — та же полнота-проверка, что и
   выше, применённая ко второй обязательной секции.

Это дополняет, не заменяет, дисциплину записи из §3.6 part1 п.4 — та
предотвращает запись невалидного `findings.md`, эта ловит уже записанный
невалидный файл (ручная правка, старая версия и т.п.) на входе в закрытие,
ровно там, где AC-09c требует, чтобы "гейт закрытия" (не только генератор)
это проверял.

**Новый пункт 5 — `has_git`.** Вычислить `has_git` (§Phase 0 `pf/SKILL.md`).
Если ложно (единственный достижимый случай — `idea`-issue, созданный в
изначально пустой не-git-папке, §3.1.1 part1's ветка "Идея", и ни разу не
превратившийся в проект до этого момента) — установить флаг `NO-REPO` на
весь остаток прогона `pf-close` для этого issue, **если только Phase 4.6
ниже не снимет его** (единственное место, где репозиторий может появиться
в рамках одного прогона).

**`NO-REPO`-ветка (idea only) — Phase 2, 3, 3.5/4 пропускаются целиком.**
Если пункт 5 выше установил `NO-REPO` — Phase 2 ("Pre-Close Cleanup",
`git status --porcelain`), Phase 3 ("Detect Parent Branch", `git config`/
`git branch --list`) и Phase 4/3.5 (merge или spike-копирование, оба
требуют git) **не выполняются вообще** — переход прямо к Phase 4.6 (§7.3.4
ниже), которая для этого случая либо создаёт репозиторий (`project`/
`spike-first`), либо остаётся no-op (`defer`/`archive`, и `NO-REPO`
доживает до конца прогона — §7.3.5).

**Checkout PARENT-BRANCH для `idea` без `NO-REPO` (finding #5).** Когда
`idea` закрывается в уже существующем PF-проекте (has_git истинно с
самого начала — обычный случай US-02, не bare-folder), Phase 4 ("Merge")
для `TYPE: idea` не выполняется (idea никогда не мерджится — §7.3.2 ниже),
но текущая ветка на момент Phase 5 (`mv`) и Phase 8 (archive commit)
обязана быть PARENT-BRANCH, а не произвольной веткой, на которой
случайно стоит сессия. Поэтому Phase 3 ("Detect Parent Branch") для
`TYPE: idea` получает один добавленный шаг сразу после определения
PARENT-BRANCH: **`git checkout PARENT-BRANCH`** — тот же чекаут, что Phase
4's шаг 1 делает для feat/improve/bug, без последующего `git merge`
(idea не мерджит ничего). Для `spike` чекаут на PARENT-BRANCH уже
выполняет Phase 3.5 (§7.3.2) как часть своей собственной процедуры —
дублирующего шага здесь не требуется.

**Phase 1 (Confirm with User) — единственный человеческий гейт, не
второй.** Для `TYPE: idea` Phase 1 **пропускается целиком** — подтверждённая
"## Decision" в `verdict.md` (только что проверенная Phase 0's п.3) уже и
есть подтверждение закрытия (AC-07e; §3.8 part1, "один финальный
человеческий гейт на issue"). Требовать здесь ещё одно "Proceed? (yes/no)"
означало бы два подтверждения за одну сессию решения. Для `TYPE: spike`
Phase 1 **сохраняется без изменений по смыслу** (текст резюме — §7.3.2
ниже) — у spike нет отдельной decision session, поэтому Phase 1 и есть
единственный финальный гейт "человек в конце" (US-09e). Для
feat/improve/bug Phase 1 не меняется здесь — front-loaded-расширение этого
же Phase 1 (показ ledger'а перед подтверждением) специфицировано отдельно,
§7.13.1 ниже ("Final decision gate"), не в этом разделе.

#### 7.3.2 Spike — копирование документов без merge (AC-09d)

Новая **Phase 3.5 (spike only, требует git — `NO-REPO` для spike
недостижим, см. §7.3.1's таблицу типов)**, между "Phase 3: Detect Parent
Branch" и "Phase 4: Merge" — **заменяет** Phase 4 целиком для `TYPE:
spike` (Phase 4 "Merge" в её сегодняшнем виде выполняется только для
feat/improve/bug; для `TYPE: idea` Phase 4 тоже не выполняется — см.
checkout-шаг, добавленный в §7.3.1 выше, который покрывает то немногое,
что idea всё же требует от текущей ветки, без самого `git merge`):

1. Если текущая ветка — `issue/<spike-id>`: переключиться на PARENT-BRANCH
   (Phase 3 уже определила её), **без** `git merge`.
2. Если ветка `issue/<spike-id>` существует (проверить `git branch --list`):
   `git checkout issue/<spike-id> -- docs/issues/open/<spike-id>` — копирует
   **только** содержимое папки issue из спайк-ветки на текущую (PARENT-
   BRANCH), не трогая ничего вне этой папки. Это staged-изменение, не
   коммит — коммитится обычным Phase 8.
3. Если ветки не существует (эксперимент не требовал кода, §3.6 part1
   п.3) — пропустить, документы уже на PARENT-BRANCH.
4. Ветка `issue/<spike-id>`, если она существует, **не мерджится и не
   удаляется** ни на этом, ни на любом последующем шаге — не только этой
   Phase, а `pf-close` целиком: нигде далее в файле не должно появляться
   `git merge issue/<spike-id>` или `git branch -d issue/<spike-id>`.

**Phase 1: Confirm with User** для `TYPE: spike` получает изменённый текст
резюме (не "Merge issue/ISSUE-ID into <parent-branch>", а "Copy
docs/issues/open/ISSUE-ID/ from issue/ISSUE-ID to <parent-branch> — code
stays on issue/ISSUE-ID, never merged or deleted"). Для `TYPE: idea` этот
пункт не наблюдаем — Phase 1 для idea не выполняется вовсе (§7.3.1).

#### 7.3.3 Phase 4.5 — пропускается для idea/spike

**"## Phase 4.5"** получает предваряющую строку: *"Skip this entire phase
for `TYPE: idea` or `TYPE: spike` — neither type ever produces a
`test_plan.md`; reading a non-existent Status Tracker would incorrectly
trigger the 'no Status Tracker table found at all' stop-and-surface rule
in step 2 below."* Это не косметика — без явного пропуска Phase 4.5
ошибочно блокирует каждое закрытие idea/spike-issue (см. gap, найденный
до написания этого спека).

#### 7.3.4 Phase 4.6 (новая) — bootstrap + follow-up ДО архивации (findings #2/#3/#4/#5/#19)

**Порядок исправлен относительно более ранней редакции этого спека.**
Черновик размещал этот шаг после Phase 5 ("Phase 5.5") и обуславливал
bootstrap непригодным для голой idea-папки условием (`has_pf`, уже
истинным из-за одного только `docs/issues/open/`), не разворачивал
scaffold для `spike-first`, не фиксировал initial-scaffold-commit
атомарно и не давал recovery path при частичном сбое — пять отдельных
находок ревью (#2/#3/#4/#5/#19), общая причина которых одна: шаг шёл
**после** необратимого `mv`. Исправление — тот же принцип, которым уже
обоснована сегодняшняя Phase 4.5 ("a failure here leaves the issue folder
in `docs/issues/open/`, so the issue is still discoverable and nothing is
lost", `pf-close/SKILL.md` текущий текст Phase 4.5): **Phase 4.6 идёт
между Phase 4.5 и Phase 5**, то есть **до** архивации, применяется только
для `TYPE: idea`.

1. Прочитать подтверждённый вердикт из **`docs/issues/open/ISSUE-ID/
   verdict.md`'s "## Decision"** — issue **ещё не перемещён** в `closed/`
   на этом шаге (в отличие от черновика, читавшего из `closed/`).
2. **`defer`/`archive`:** эта Phase — no-op. Не трогать `has_git`/`NO-REPO`,
   не создавать ничего. Перейти к Phase 5.
3. **`project`/`spike-first`** (обе ветки проходят один и тот же bootstrap
   — исправление finding #19: черновик разворачивал каркас+`git init`
   только для `project`, из-за чего `spike-first`, рождённый из голой
   idea-папки, создавал spike без репозитория, для которого `pf-idea-spike`
   Режим 2 не может выполнить `git checkout -b issue/<spike-id>`):
   a. Вычислить **раздельно** (finding #2 — не единым `has_pf`,
      допускающим bare-idea за полноценный scaffold):
      - `has_git` — как обычно (`git rev-parse --is-inside-work-tree`).
      - `has_full_scaffold := PLANNING.md` существует в CWD. **Не**
        `has_pf`'s дизъюнкция (`PLANNING.md` ИЛИ `docs/issues/` ИЛИ
        `.pf-version`) — эта дизъюнкция уже истинна для голой idea-папки
        просто потому, что `docs/issues/open/<idea-id>/` существует, хотя
        каркаса нет вовсе; `has_full_scaffold` требует именно
        `PLANNING.md`, который bare-idea никогда не создаёт (AC-01b).
   b. Если `!has_git` — `git init`.
   c. Если `!has_full_scaffold` — развернуть каркас: те же действия, что
      §3.1.1 part1 п.2, 4-7 (создать `docs/issues/{open,closed}` там, где
      их ещё нет — для in-project idea они уже есть; записать
      `.pf-version`; скопировать `PLANNING.md`/`CLAUDE.md`; скопировать
      `docs/planning/*.md`, не переписывая существующее; зеркалировать
      `docs/planning/templates/`) — ссылка на процедуру по имени, не
      копирование текста; шаг 1 (git init) и шаг 3 (`.pf-version`, часть
      той же процедуры) выполняются здесь как часть п.b/п.c, шаги 8-9
      (skip shim, "3-variant question") не применяются — эта Phase не
      ведёт в intake, она ведёт в follow-up issue creation ниже.
   d. **PARENT-BRANCH.** Если Phase 3 уже вычислила его в этом прогоне
      (случай "idea в существующем проекте", `NO-REPO` не было установлено
      на Phase 0) — используется то же значение, включая checkout,
      выполненный §7.3.1's добавленным шагом. Если Phase 3 была пропущена
      (bare-folder случай, `NO-REPO` было установлено) — PARENT-BRANCH :=
      ветка, на которой сессия оказалась сразу после `git init` в п.b
      (`git branch --show-current`) — без обращения к Phase 3's
      develop/main-fallback: сравнивать не с чем, ветка только что создана
      этим самым `git init` (finding #5 — устраняет "произвольную текущую
      ветку" для этого случая по построению: другой ветки physически не
      существует).
   e. **Атомарный initial scaffold commit (finding #3).** Только если п.b
      или п.c реально что-то сделали в этом прогоне (идемпотентность —
      повторный `/pf-close` после частичного сбоя не должен ни падать, ни
      создавать пустой коммит, если каркас/репозиторий уже на месте):
      `git add PLANNING.md CLAUDE.md .pf-version docs/planning` (scoped,
      **не** `-A`, и **не** `docs/issues/` — архивация issue-папки
      коммитится отдельно, обычной Phase 8) и
      `git commit -m "chore: bootstrap PF scaffold for ISSUE-ID (verdict: <verdict>)"`.
      Это отдельный коммит, до архивного коммита Phase 8 — без него
      сценарий "новый scaffold остаётся untracked до первого `pf-qa`
      follow-up issue" (finding #3) воспроизводится буквально.
   f. Снять `NO-REPO` (гарантированно ложно с этой точки для
      `project`/`spike-first` — используется §7.3.5's таблицей для
      `defer`/`archive`-случая, единственного, где флаг доживает дальше).
   g. Определить `<slug>` из `idea.md`'s заголовка/темы.
   h. **Идемпотентность follow-up (recovery после частичного сбоя).**
      Перед созданием новой папки issue — проверить, не существует ли уже
      под `docs/issues/open/` папка с `idea_ref: ISSUE-ID` в фронтматтере
      (свидетельство, что предыдущий, прерванный прогон этой самой Phase
      уже создал follow-up issue, но не дошёл до Phase 5). Если существует
      — переиспользовать её (не создавать вторую, не затирать), перейти
      сразу к соответствующему пункту отчёта (i/j ниже) и затем к Phase 5.
   i. **`project`:** создать `docs/issues/open/<YYYYMMDD>-feat-<slug>/
      prompt.md`, предзаполненный (finding #16 — выводить, не откладывать
      на legacy-tier guard, там где вывод возможен):
      - `doc_language` — унаследован от идеи напрямую.
      - `roles`/`profile`/`on_unavailable` — если присутствуют в idea's
        `prompt.md`, копируются как есть (те же значения годятся: ключи
        `idea`/`research`/`critique`/`verdict` резолвятся тем же
        алгоритмом `pf-roles` §4, что и `code`/`tests`/…, §7.12 — явных
        значений для `code`/`brd`/`specs`/… у идеи нет, поэтому копируется
        только то, что действительно присутствует; отсутствующее остаётся
        отсутствующим — обычный fallback §4 level 4/5 применится как для
        любого нового issue).
      - `size_tier` — выводится из `idea.md`'s "Cost (Effort)" + `idea_tier`
        по таблице ниже, **записывается сразу**, с обоснованием, залогированным
        как `[assumed]` в новом `open_questions.md` этого feat-issue (не
        оставляется пустым "на усмотрение guard'а"):

        | `idea_tier` | Сигнал из "Cost (Effort)" | Выведенный `size_tier` |
        |---|---|---|
        | `personal` | любой | `small` |
        | `infra` | "несколько часов/один день" или короче | `small` |
        | `infra` | "несколько дней" или дольше | `medium` |
        | `content` | любой | `small` |
        | `product` | "неделя" или короче | `medium` |
        | `product` | "несколько недель"/"месяц" или дольше | `large` |

        Если "Cost (Effort)" не содержит распознаваемого сигнала длительности
        (свободный текст без единиц времени) — `size_tier` **не** записывается,
        оставляется настоящей неоднозначностью: обычный legacy-tier guard
        `/pf-brd`/`pf-spec`/… спрашивает как для любого issue без tier (это
        единственный случай, когда финальное правило AC-08c — "спрашивается
        только если нельзя вывести" — действительно допускает вопрос).
      - `idea_ref: <idea-id>`; тело — идея/MVP/ограничения, скомпонованные
        из `idea.md`+`verdict.md`+исходного intake-текста `prompt.md` (issue,
        из которого он собирается, на этот момент всё ещё физически лежит
        в `open/` — п.1 выше). Отчёт Phase 9 дополняется строкой: *"Created
        follow-up issue: <feat-id> (idea_ref:
      <idea-id>). Next: /pf-brd."*
   j. **`spike-first`:** аналогично создать `docs/issues/open/<YYYYMMDD>-
      spike-<slug>/prompt.md`, `idea_ref: <idea-id>`, поля `## Question`/
      `## Success Criterion`/`## Time-box`/`## Method` — best-effort
      выведены из `verdict.md`'s "## Reasoning" и `critique.md`'s Summary
      Table (строки с диспозицией "Идея меняется" или неразрешённые
      технические возражения техлида/безопасника — естественный источник
      кандидата в "Question"). Ничего не спрашивается у пользователя —
      front-loaded правило применяется и здесь: неоднозначность
      резолвится рекомендацией, логируется как `[assumed]` в **новом**
      `open_questions.md` только что созданного spike-issue. Этот spike
      теперь **всегда** git-backed (п.a-f выше уже выполнились для обеих
      веток `project`/`spike-first` одинаково) — `pf-idea-spike`'s Режим 2
      может создать `issue/<spike-id>`, если эксперимент требует кода,
      без риска "нет репозитория" (finding #19). Отчёт дополняется:
      *"Created follow-up issue: <spike-id> (idea_ref: <idea-id>). Next:
      /pf-idea-spike."*

4. Перейти к Phase 5.

**Recovery — что делает повторный `/pf-close`, если Phase 4.6 упала
частично.** Прогон, прерванный внутри этой Phase, оставляет
`docs/issues/open/` с **двумя** папками: исходной идеей (ISSUE-ID,
неархивированной) и, если сбой произошёл после п.h/i/j, уже созданным
follow-up issue. `pf-close`'s определение активного issue ("Read ISSUE-ID
from the active folder name") в рамках одного непрерывного прогона не
задето этим вообще — ISSUE-ID зафиксирован переменной один раз в самом
начале файла и не пересканируется по ходу. Задето только **новое,
холодное** приглашение `/pf-close` (новая сессия, после сбоя): если
`docs/issues/open/` содержит больше одной папки, `pf-close` не может
молча выбрать первую — тот же принцип, что уже действует в `/pf` при
нескольких открытых issue (не новый механизм): предпочесть папку, чей
`verdict.md`/`findings.md` уже несёт подтверждающий маркер закрытия
(idea — "## Decision"; при нескольких подходящих кандидатах — остановиться
и спросить пользователя, какую закрывать). Follow-up-папка, только что
созданная этой же Phase, отличима по `idea_ref`, указывающему на
ISSUE-ID, чья собственная папка **всё ещё** в `open/` — это однозначный
признак "Phase 4.6 частично отработала, но Phase 5 ещё не переместила
идею", а не второй независимый активный issue.

#### 7.3.5 Не-git guard в закрытии — все затронутые Phase (AC-01d, продолжение §3.1.4 part1)

`NO-REPO` (§7.3.1), однажды установленный, **не перевычисляется** внутри
Phase 6-8 — единственное место, где он может смениться на "теперь есть
репозиторий" в рамках одного прогона `pf-close`, — это Phase 4.6, п.3.f
(`project`/`spike-first`-вердикт), которая по построению идёт **до** Phase
5 (а значит, и до Phase 6). Порядок Phase — Phase 4.5 → **Phase 4.6** →
Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 8.5 → Phase 9 — поэтому,
если Phase 4.6 выполнила `git init`, к Phase 5/6 репозиторий уже
существует, и всё, что ниже, относится **только** к исходу `defer`/
`archive` в изначально голой не-git-папке (единственный случай, где
`NO-REPO` доживает до Phase 5 и дальше):

| Phase | Правка при `NO-REPO`, дожившем до этой точки |
|---|---|
| Phase 5 ("Archive Issue Folder") | Без изменений — `mv`, не git-операция; выполняется независимо от `NO-REPO`. |
| Phase 6 ("Compute LLM Usage & Cost") | Без структурных изменений — п.1 ("Find the issue's start time", `git log`) уже штатно ловит пустой результат и переходит к шагу 3 с пометкой "window could not be determined"; при `NO-REPO` этот путь и так единственно достижим. Итог — `usage_report.md` пишется с пометкой отсутствия auto-computed данных, как и для любого issue без транзакций в момент старта. |
| Phase 7 ("Update Session Log") | Получает предваряющую оговорку: *"If `NO-REPO`: `docs/planning/session-log.md` does not exist (no PF scaffold was ever created for this issue) — skip this phase entirely, and note in Phase 9's report: 'session-log.md not updated — no PF scaffold exists in this folder.' Do not create `docs/planning/` just to hold one line."* |
| Phase 8 ("Archive Commit") | Получает предваряющую оговорку: *"If `NO-REPO`: skip both `git add` and `git commit` — there is no repository to commit to. Report 'not committed — no git repository' in Phase 9 instead of the usual commit-summary lines."* (Тот же принцип, что `pf-git`'s Step 0 guard — здесь неприменим напрямую, поскольку Phase 8 коммитит инлайново, не через `pf-git`, но текст и формулировка идентичны намеренно, единое сообщение по всему фреймворку.) |
| Phase 8.5 ("Push Parent Branch") | Как и было — пропускается тем же guard'ом ("no remote configured" уже покрывает случай отсутствия репозитория как частный случай отсутствия remote; уточнение: если `NO-REPO`, эта Phase не выполняется вообще, а не просто "remote не настроен" — сообщение то же самое по тексту, различие не наблюдаемо пользователем). |
| Phase 9 ("Report") | Отчёт для `NO-REPO`+`defer`/`archive` заменяет блок "Two commits added to PARENT-BRANCH… Remote push: …" одной строкой: *"Not committed — no git repository. Issue folder archived on disk only: docs/issues/closed/ISSUE-ID/."* |

Это исчерпывает все точки, где `pf-close` мог бы затронуть git или
`docs/planning/*` для issue, живущего целиком в не-git-папке. Единственный
исход, реально достигающий этой ветки целиком — `idea`-issue, созданный в
пустой не-git-папке (§3.1.1 part1) и закрытый с вердиктом `defer`/
`archive` (§5.9 part1) — `project`/`spike-first` всегда проходят через
Phase 4.6's `git init` раньше, чем эта ветка вообще проверяется, а `spike`
как тип не может быть создан в не-git-контексте вообще (AC-09b требует
"любой проект", т.е. уже существующий, а §3.1.5 part1's трёхвариантный
вопрос, единственный путь создать `spike` напрямую, сам достижим только
при `has_pf: true`).

#### 7.3.6 Phase 9 — autopilot schedule cleanup (idea/spike, finding #8)

**"## Phase 9: Report"** получает предваряющий пункт, выполняемый **до**
печати отчёта, только для `TYPE: idea`/`spike`: *"Check whether a
schedule named `pf-autopilot-<project>` exists (`CronList`). If it does,
delete it (`CronDelete pf-autopilot-<project>`) and add one line to this
Phase's report: 'Autopilot schedule removed.' If none exists, say nothing
extra — this is the common case for an issue that was never driven by
autopilot."* Обоснование — §3.5.4 part1: единственная гарантированная
точка, через которую проходит **любое** закрытие `idea`/`spike`-issue
(человеком напрямую или после `pf-autopilot`'s остановки перед финальным
гейтом), поэтому это естественное место снять schedule без зависимости от
того, дойдёт ли автопилот когда-либо до собственного Step 3 снова (finding
#8 — без этой правки schedule, оставленный автопилотом перед decision
session/`/pf-close`, не удаляется никогда, если человек завершает issue
вручную).

### 7.4 `skills/pf-git/SKILL.md`

**Новый раздел, перед "## Step 1: Stage the artifact"**, озаглавленный
**"## Step 0: No-repository guard"**:

> Перед любым действием ниже — проверить `has_git` (`git rev-parse
> --is-inside-work-tree`, тот же расчёт, что `/pf`'s Step 0). Если ложно
> — не выполнять ни Step 1 (stage), ни Step 2 (commit), ни Step 3 (push).
> Вместо обычной строки Step 4 напечатать: *"Git: not committed — no git
> repository"* (переведено по `doc_language`, если задан отличный от
> английского). Это единственное расширение этого файла — единая точка
> определения guard'а, на которую ссылаются все стадии, вызывающие эту
> процедуру, той же дисциплиной, что и остальной этот файл ("no skill
> restates the procedure in its own words").

**"## Step 1: Stage the artifact — scoped, never `-A`", таблица** —
**семь** новых строк (пять пишущих стадий, но `pf-idea-verdict` несёт две
строки — режим 1 и режим 2 у неё сохраняют разные пути, поэтому считаются
раздельно, как и в самой таблице ниже):

| Stage | Paths to `git add` |
|---|---|
| `/pf-idea` | `docs/issues/open/<ISSUE-ID>/idea.md` (+ `open_questions.md`, если создан/изменён этим прогоном) |
| `/pf-idea-research` | `docs/issues/open/<ISSUE-ID>/research.md` (+ `open_questions.md`) |
| `/pf-idea-critique` | `docs/issues/open/<ISSUE-ID>/critique.md` (+ `open_questions.md`) |
| `/pf-idea-verdict` [режим 1] | `docs/issues/open/<ISSUE-ID>/verdict.md` (+ `open_questions.md`) |
| `/pf-idea-verdict` [режим 2, сессия решения] | `docs/issues/open/<ISSUE-ID>/verdict.md`, `open_questions.md` (+ любые документы, чьи секции были регенерированы при override, §3.5.2 part1) |
| `/pf-idea-spike` [режим 1] | `docs/issues/open/<ISSUE-ID>/hypothesis.md` |
| `/pf-idea-spike` [режим 2] | `docs/issues/open/<ISSUE-ID>/findings.md` (+ код эксперимента, если ветка создавалась — `-A` на этой стадии по тому же обоснованию, что `/pf-execute`, поскольку эта стадия тоже "owns the code, not just the issue folder", когда код вообще есть) |

Каждая новая строка также несёт стандартную "(+ `prompt.md`, if
automigration ran this same invocation)" — automigration `pf-roles` §5
применима и к `idea`/`spike`-issue (эти типы тоже используют
`roles:`/`profile:`).

### 7.5 `skills/pf-autopilot/SKILL.md`

**"## Step 2. Work loop", п.1** — список скиллов ("`/pf-brd`, `/pf-spec`,
`/pf-check`, `/pf-test-plan`, `/pf-impl-plan`, `/pf-execute`, `/pf-test`,
`/pf-qa`, `/pf-close`") расширяется до включения `/pf-idea`,
`/pf-idea-research`, `/pf-idea-critique`, `/pf-idea-verdict`,
`/pf-idea-spike`.

**Новый пункт 7** в конце "## Step 2. Work loop": *"**Stop before the
final human gate, never apply the 3-attempts rule to it — for both new
types (finding #7).** When the pinned issue is `idea`-type and its next
step is `/pf-idea-verdict (decision session)`, OR the pinned issue is
`spike`-type and its next step is `/pf-close` (spike has no separate
decision session — `/pf-close`'s Phase 1 confirmation IS its one human
gate, §7.3.1 of this spec's part2, US-09e) — stop the work loop there
instead of invoking the next step. Print the final report (below)
immediately; do not delete the schedule here — deletion is `/pf-close`'s
job now (Phase 9, see below), not this step's, precisely so that a human
who completes the close by hand (without autopilot ever resuming again)
still gets the schedule cleaned up (finding #8). Until `/pf-close` runs,
the next scheduled resume finds the same state and stops again."*

**"## Step 3. Completion", финальный отчёт** — оговорка: для `idea`/
`spike`-issue, остановленного перед финальным гейтом, отчёт (не
"Completion", а промежуточный) дополнительно перечисляет полный список
`[assumed]`-строк и открытых вопросов из `open_questions.md` (US-10c,
дословно).

**"## Step 3. Completion", п.1 (`CronDelete`)** получает оговорку:
*"For `TYPE: idea`/`spike`, this deletion is normally already done by
`/pf-close`'s own Phase 9 (see `pf-close/SKILL.md` changes, this spec's
part2 §7.3) by the time this step would run for the closing invocation —
this step's own `CronDelete` call is therefore usually a no-op
(idempotent) for these two types, not a duplicate deletion attempt to
avoid. It remains the primary deletion path for feat/improve/bug, whose
`/pf-close` does not carry the Phase 9 addition below."*

### 7.6 `skills/pf-help/SKILL.md`

Новый абзац после "## Workflow by issue type" (перед "## Skills"), по
образцу существующих трёх (`feat`/`improve`/`bug`) блоков:

```markdown
**Idea** (`idea`) — for a project that may not happen yet:
> Intake → Idea → ✓ Check → Research → Critique → Verdict → ✓ Check → Decision session → Close

**Spike** (`spike`) — a time-boxed technical experiment:
> Intake → Hypothesis → Findings → Close

Don't know where to start? Just run `/pf` in an empty folder, or in a
project with no open issue — it will ask whether you're working on an
idea (which may never become a project) or building something you already
know you want.
```

Таблица "## Skills" — шесть новых строк (пять пишущих + `pf-idea-lenses`;
`pf-interaction` — справочный скилл того же класса, что `pf-size-tiers`/
`pf-git`/`pf-roles`, которые сегодня **не** перечислены в этой таблице —
`pf-idea-lenses`/`pf-interaction` следуют тому же прецеденту и тоже не
добавляются в эту пользовательскую таблицу, поскольку она документирует
только команды, которые пользователь может **вызвать**, — но
`assert_lists_every_skill` (TC-040, §8.4) требует, чтобы файл упоминал
**имя** каждого скилла хотя бы одной подстрокой где-то в файле, не
обязательно в этой таблице; см. §7.10 про то, где именно эти два имени
физически появляются в `pf-help/SKILL.md`, если появляются — уточнение
ниже).

**Уточнение по TC-040 применительно к `pf-help`.** `pf-help/SKILL.md` не
входит в список файлов, которые TC-040 проверяет на упоминание каждого
скилла (`assert_lists_every_skill` вызывается сегодня для `CLAUDE.md`,
`docs/planning/FRAMEWORK.md`, `docs/planning/QUICKSTART.md`,
`skills/pf-update/SKILL.md`, `tools/onboarding-tui/lib/tutorial.js`,
`README.md` — не для `pf-help/SKILL.md`, см. `test/docs-refs.sh`). Правки
`pf-help/SKILL.md` в этом разделе, следовательно, не обязаны перечислять
все 28 имён — только пять пишущих (`pf-idea`/`pf-idea-research`/
`pf-idea-critique`/`pf-idea-verdict`/`pf-idea-spike`) добавляются в
таблицу "## Skills" по аналогии с тем, что там уже нет `pf-size-tiers`/
`pf-git`/`pf-roles`. Таблица "## Issue folder contents" получает две новые
строки (`idea`, `spike`) с их документами.

### 7.7 `skills/pf-brd/SKILL.md` — `idea_ref` хук (AC-08b/c)

Новый абзац, сразу после существующего "Read `docs/issues/open/[ISSUE-ID]/
prompt.md` to understand the project description." и **перед**
"Output gate — `notes.md`/`brd.md` already present":

> **`idea_ref` hook.** If `prompt.md`'s frontmatter carries `idea_ref:
> <closed-idea-id>`, additionally read
> `docs/issues/closed/<closed-idea-id>/idea.md`,
> `docs/issues/closed/<closed-idea-id>/verdict.md`, and the original
> intake body of `docs/issues/closed/<closed-idea-id>/prompt.md`. Every
> field already answered there (pain, evidence, MVP, constraints,
> out-of-scope, differentiation) is **not** asked again in the clarifying-
> questions loop below — only genuine gaps (US-08b: "задаёт только
> вопросы, на которые там нет ответа"). `doc_language`/`size_tier`/
> `roles`/`profile`/`on_unavailable` are normally **already present** in
> this feat-issue's own `prompt.md` by the time `pf-brd` ever reads it —
> `pf-close`'s Phase 4.6 (this spec's part2 §7.3.4) derives and writes
> them at issue-creation time whenever the closed idea's material supports
> a confident derivation (finding #16: derive and record, don't merely
> recommend-and-reconfirm). If `size_tier` is nonetheless absent (Phase
> 4.6's derivation table found no recognizable duration signal in
> `idea.md`'s "Cost (Effort)" — a genuine ambiguity, not a shortcut this
> hook takes), the ordinary legacy-tier guard asks as it would for any
> other new issue — no special-casing needed here; this is the one case
> where AC-08c ("спрашиваются только если их нельзя вывести из intake
> идеи") actually permits the question.

Это единственная правка `pf-brd/SKILL.md`, не считая front-loaded hook'а
из §7.13 (независимая правка, другая причина).

### 7.8 `skills/pf-update/SKILL.md`

"## Managed Skills" список — семь новых пунктов, вставленных в
алфавитном/тематическом порядке существующего списка:

```
- `pf-idea` — write idea.md via guided intake already captured in prompt.md
- `pf-idea-research` — write research.md, verified/unverified facts with sources
- `pf-idea-critique` — write critique.md via independent multi-persona review
- `pf-idea-verdict` — write verdict.md and run the end-of-pipeline decision session
- `pf-idea-spike` — write hypothesis.md and findings.md for a technical spike
- `pf-idea-lenses` — reference data: idea_tier lenses/personas/budgets/stage tables (not directly invoked)
- `pf-interaction` — reference data: the front-loaded interaction rule (not directly invoked)
```

Вводное предложение "All 21 skills:" → "All 28 skills:" (единственное
текстовое место, требующее ручной правки счётчика в этом файле — сам
список обнаруживается `find skills -mindepth 1 -maxdepth 1 -type d`,
никакого другого хардкода нет).

### 7.9 `scripts/converge-to-v3.sh`

**`required_docs()`** — новая ветка `case`, до сегодняшней `*)`:

```sh
    idea) printf '%s\n' idea.md research.md critique.md verdict.md ;;
    spike) printf '%s\n' hypothesis.md findings.md ;;
    feat | improve) printf '%s\n' brd.md specs.md test_plan.md implementation_plan.md ;;
    *) printf '%s\n' test_plan.md implementation_plan.md ;;
```

Без этой правки конвергенция на проекте, в котором уже существует открытый
`idea`/`spike`-issue, ошибочно требует от него `test_plan.md`/
`implementation_plan.md` (реальный дефект, найденный при подготовке этого
спека — `type` не был предусмотрен в оригинальном `case`).

**`skill_for_doc()`** — новые ветки:

```sh
    idea.md) printf '/pf-idea' ;;
    research.md) printf '/pf-idea-research' ;;
    critique.md) printf '/pf-idea-critique' ;;
    verdict.md) printf '/pf-idea-verdict' ;;
    hypothesis.md) printf '/pf-idea-spike' ;;
    findings.md) printf '/pf-idea-spike' ;;
```

`TEMPLATES_SRC` (строка 46) — **без изменений** (§1.1.C: "mirror, not
move" — `docs/planning/templates/` остаётся канонической копией).

### 7.10 Документация фреймворка

| Файл | Правка |
|---|---|
| `CLAUDE.md` | `"21 Claude Code skills"` → `"28 Claude Code skills"` (обе строки, 16 и 36); список из 21 имени → список из 28 (добавить семь новых) |
| `README.md` | `"21 Claude Code skills"` (строка 21) → `"28 Claude Code skills"`; `## Skills`-таблица дополняется семью строками. Версионная запись "3.0.0 release — 7 Claude Code skills" (строка ~319, `test/docs-refs.sh` TC-040 step 6) **не трогается** — это исторический release-note, TC-040 явно проверяет, что она **осталась** нетронутой |
| `docs/planning/FRAMEWORK.md` | `"21 Claude Code skills"` (строка 380) → `"28 Claude Code skills"`; список имён дополняется |
| `docs/planning/QUICKSTART.md` | Список имён дополняется семью новыми (TC-040 step 2 требует `grep -q "$N_SKILLS skills"` — счётчик тоже обновляется по тому же шаблону, что и в остальных трёх файлах) |
| `skills/pf-update/SKILL.md` | См. §7.8 |
| `tools/onboarding-tui/lib/tutorial.js` | "Screen 3/4" список дополняется семью строками; `"That is all 21 of them."` → `"That is all 28 of them."` |
| `CONTRIBUTING.md` | Пункт 6 существующего чек-листа синхронизации версии дополняется: к списку файлов (`PLANNING.md`, `CLAUDE.md`, `docs/planning/FRAMEWORK.md`, `docs/planning/QUICKSTART.md`, `docs/planning/templates/config/{CLAUDE.md,PLANNING.md}`, `docs/planning/templates/README.md`) добавляется `skills/pf/SKILL.md`'s `version:` field (§5.2 part1 — второй источник `.pf-version` для проектов, развёрнутых `/pf` напрямую) **и** новое правило: *"Любая правка `docs/planning/templates/` обязана быть отражена побайтово в `skills/pf/templates/project/` (и наоборот) — проверяется `test/pf-idea-templates-mirror.sh`."* |
| `PLANNING.md` | **Без изменений** — файл не содержит ни счётчика скиллов, ни их поимённого списка (проверено грепом при подготовке этого спека); пайплайн-диаграммы feat/improve/bug там не меняются (G7), а диаграммы idea/spike туда сознательно не добавляются — decision (A), §1.1: справочные таблицы стадий живут в `pf-idea-lenses`, не дублируются в `PLANNING.md` |

### 7.11 `skills/pf-size-tiers/SKILL.md`

**"### Pipelines — what 'preceding stage' means", таблица** — две новые
строки, **ссылающиеся**, не копирующие (finding #30 — единственный
источник порядка стадий idea/spike это `pf-idea-lenses`, §5.7/§3.1.7
part1; `pf-size-tiers` дублировать список не должен):

| Pipeline | Stage order |
|---|---|
| `idea` (типа issue, не `size_tier` — см. оговорка ниже) | See `~/.claude/skills/pf-idea-lenses/SKILL.md`'s "Stage tables" (the `idea` table) — read live from there, not copied here. |
| `spike` | See the same file's "Stage tables" (the `spike` table). |

Предваряющая оговорка над этими двумя строками: *"These two pipelines are
keyed on issue TYPE (folder-name prefix `idea`-/`spike`-), not on any
`size_tier` value — `idea`/`spike` issues never carry `size_tier` at all
(see `pf-idea-lenses/SKILL.md`'s `idea_tier` instead). Unlike every other
row in this table, these two rows do not restate the stage order inline —
they point at `pf-idea-lenses/SKILL.md`, the single normative source
(part1 §1.1 decision (A), applied here to completeness as well as to
routing, not just routing). Conjunct 3 of 'Stage completion' below, when
evaluated for an `idea`/`spike` issue, reads the order from that file
directly at evaluation time."*

**"### Scope", первый пункт (список документов)** — дополняется:
`idea.md`, `research.md`, `critique.md`, `verdict.md`, `hypothesis.md`,
`findings.md`. Явная оговорка сразу после: *"`open_questions.md` is
deliberately excluded from this list — it is a side ledger, not a
pipeline-stage document; see `20260902-feat-idea-stage/specs.md` §5.6."*

### 7.12 `skills/pf-roles/SKILL.md`

**"Known stage keys" абзац** (в "## 1. `roles:`/`profile:` in
`prompt.md`") — дополняется: *"...plus six keys belonging to the
`idea`/`spike` issue types (never combined with the keys above on the
same issue): `idea`, `research`, `critique`, `verdict` (idea-type only),
`hypothesis`, `findings` (spike-type only). All six resolve through the
exact same algorithm as every other key (§4) — not a special case."*

Алгоритм §4/§10/§11 сам по себе не меняется структурно — общий
fallback-порядок, Recommendation-процедура и Availability-check уже
универсальны по ключу (не хардкодят список ключей нигде в тексте,
проверено при чтении файла целиком для этого спека). `role-profiles.yml`
не редактируется: `default:` каждого из трёх поставляемых профилей
покрывает шесть новых ключей автоматически (уровень 4 резолва, §4).

Две правки **структурного** уровня всё же требуются — обе обязательны, не
опциональны:

#### 7.12.1 Auto-creation carve-out для голой `idea`-папки (AC-01b)

**Проблема.** "## 2. `docs/planning/agents.yml`" и "## 3. `docs/planning/
role-profiles.yml`", разделы "### Auto-creation" каждого, гласят: "если
файл ещё не существует, **первый** `pf-*` скилл, которому нужно
резолвить любого актора, создаёт его... без вопроса пользователю". В
папке из §3.1.1(part1)'s ветки "Идея" (AC-01b: создаётся **только**
`docs/issues/open/.../prompt.md`, ни `docs/planning/*` не создаётся) уже
самый первый резолв роли — либо `/pf`'s Step 7 ("Roles for next stage"),
либо `pf-idea`'s собственный резолв ключа `idea` — безусловно создал бы
`docs/planning/agents.yml` и `docs/planning/role-profiles.yml`, нарушая
AC-01b буквально.

**Правка.** В оба раздела "### Auto-creation" добавляется одинаковая
оговорка: *"**Exception — bare `idea`/`spike` folder.** Skip auto-creation
entirely (do not write this file) when the resolving issue's TYPE is
`idea` or `spike` **and** the project has no PF scaffold at all — no
`PLANNING.md` and no `docs/planning/` directory. **Level 1 (an explicit
`roles.<key>`/`profile:` literally present in this issue's own `prompt.md`)
is still checked first, exactly as always** (finding #18 — a bare folder
never suppresses an explicit key the user hand-wrote after the fact,
§3.1.3 part1's own carve-out text already only withholds the role-assignment
*question* at intake, not the resolution algorithm itself). What this
exception actually skips is levels 2-4, which are the ones that need a
*resolved profile* to exist (`role-profiles.yml`) — **those alone**
require `docs/planning/`, which a bare folder by construction does not
have. So: level 1 checked normally; if it doesn't match, resolution falls
straight through to level 5 (`write: claude, review: [claude]`), skipping
2-4 only. The moment the project gains a PF scaffold (the idea's verdict
becomes `project`/`spike-first`, §7.3.4 part2 — Phase 4.6 creates
`docs/planning/` as part of scaffolding), normal auto-creation resumes on
that project's very next role resolution, same as any other project."*

**"## 4. Resolving a stage's role — the fallback order", level 5** получает
уточнение одной фразой: *"(For a bare `idea`/`spike` folder with no PF
scaffold, level 1 is still checked as usual; only levels 2-4 are
unreachable per the Auto-creation exception above, since they require a
resolved `role-profiles.yml` that cannot exist there — level 5 is reached
whenever level 1 does not match, not unconditionally.)"*

#### 7.12.2 Именование третьей формы диспетчеризации — критика-персона (не write, не review)

**Проблема.** `pf-idea-critique`'s диспетчеризация персон (part1 §3.4,
п.2) для `write != claude` вызывает `codex-companion.mjs task ... --json`
**без** `--write` — персона не пишет файл, она возвращает текст
возражений, которые сама `pf-idea-critique` собирает в `critique.md`. Это
структурно не то же самое, что "## 7. Write-invocation form for delegated
actors" (та форма — всегда `--write`, всегда с жёстким стопом при
недоступности актора, §7 п. "Availability check before writing" — стоп
корректен для **записи**, где подмена автора недопустима, но неверен
здесь: персона — не автор документа, а точка зрения, эквивалентная тому,
что `pf-check`'s Codex-цепочка уже делает для ревью).

**Правка.** `pf-idea-critique`'s дизайн (part1 §3.4, п.2) уточняется:
персона-диспетчеризация для `write != claude` использует **не** `pf-roles`
§7, а тот же document-form, что `pf-check`'s "Codex invocation chain"
(`task "<brief>" --json`, без `--write`) — канонический источник этой
формы уже `pf-check`, не дублируется здесь. В частности, это означает, что
"Codex genuinely unavailable" (chain шаг 5 — тихий откат на `claude` для
этой конкретной персоны, с пометкой в собранном `critique.md` "(Codex
unavailable — эта персона отработана Claude)") применяется к каждой
персоне независимо — не жёсткий стоп, в отличие от настоящей записи
документа. Никакой новой третьей формы в `pf-roles` не заводится — она и
не нужна: используется уже существующая (`pf-check`'s document-review
form), просто в новом контексте вызова (сборка нескольких независимых
ответов одной сессией вместо единого review-вывода). `pf-roles/SKILL.md`
не редактируется этим пунктом — правка целиком лежит в `pf-idea-critique`
(part1 §3.4), исправление здесь фиксирует **что именно** нужно поправить
там же, раз finding возник при вычитке.

### 7.13 Front-loaded — точные hook-сайты (feat/improve/bug, опционально)

**Канонический текст hook'а** (вставляется, где сказано "hook", дословно,
переводя по `doc_language` при необходимости):

> *Front-loaded check: if `prompt.md`'s `interaction` field resolves to
> `front-loaded` (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded
> rule"), apply that rule instead of asking this question interactively.*

| Скилл | Секция (заголовок/якорь) | Строка вопроса | Front-loaded резолюция |
|---|---|---|---|
| `pf-brd` | "Legacy-tier guard" | "How big is this task?" | hook — допущение (рекомендация: medium) |
| `pf-brd` | "Reviewer-assignment guard" | "Who should review `<key>`?" | hook — допущение (топ рекомендации §10 pf-roles) |
| `pf-brd` | "Output gate — `notes.md`/`brd.md` already present" | regenerate/keep/cancel | hook — допущение (уже рекомендуемое: regenerate если не завершён, keep если завершён — см. текст гейта) |
| `pf-brd` | "## If `size_tier: trivial`" | условённый Q&A-цикл | hook — цикл целиком пропускается, `notes.md` пишется из одного `prompt.md`, пробелы → `[assumed]` |
| `pf-brd` | "## If `size_tier` is small/medium/large" | условённый Q&A-цикл | hook — то же для `brd.md` |
| `pf-brd` | "Post-save tier reconfirmation" | подтвердить/переопределить tier | hook — допущение: согласиться с записанным tier без переспроса, если суждение расходится — записать `[assumed]`, а не менять `size_tier` молча |
| `pf-spec` | Legacy-tier guard (без заголовка, вводный абзац) | "How big is this task?" | hook |
| `pf-spec` | "Output gate — `specs.md` already present" | regenerate/keep/cancel | hook |
| `pf-spec` | Основной Q&A-цикл (после "Based on the BRD...") | условённый Q&A-цикл | hook — цикл пропускается |
| `pf-test-plan` | Legacy-tier guard | "How big is this task?" | hook |
| `pf-test-plan` | "Output gate — `test_plan.md` already present" | regenerate/keep/cancel | hook |
| `pf-test-plan` | Manual-budget-exceeded вопрос (после Step 4c) | "This test plan has more Manual cases..." | hook — допущение: взять первую из трёх опций (автоматизировать где возможно, иначе явно принять с пометкой) |
| `pf-impl-plan` | Legacy-tier guard | "How big is this task?" | hook |
| `pf-impl-plan` | "Output gate — `implementation_plan.md` already present" | regenerate/keep/cancel | hook |
| `pf-execute` | Legacy-tier guard (вводный абзац) | "How big is this task?" | hook |
| `pf-check` | Legacy-tier guard (вводный абзац) | "How big is this task?" | hook |
| `pf-check` | "### Codex invocation chain", шаг 1/2a (`codex:setup`'s собственный вопрос) | "install Codex CLI?" | **условно hook, finding #12** — см. "Codex readiness moved to intake" ниже: для issue, включившего front-loaded **на CREATE** (новый опциональный intake-вопрос), install-предпочтение уже собрано заранее и здесь применяется как допущение; для issue, включившего front-loaded **вручную после CREATE** (единственный путь, оставшийся из §6.11 для issue, созданных до этой правки, или для тех, кто предпочитает править `prompt.md` напрямую), вопрос остаётся безусловным исключением — intake для него уже прошёл без этого вопроса, спросить заранее было физически нечем |
| `pf-check` | "### Codex invocation chain", шаг 3 | "install the codex plugin now?" | тот же статус, что и строка выше |
| `pf-check` | "How would you like to proceed?" (review gate) | Fix now / I'll fix manually / Skip | **не новый hook** — front-loaded переиспользует уже существующий неинтерактивный путь этого файла, "Autopilot mode", вызывая его тем же способом, каким это делает `/pf-check autopilot`: front-loaded issue резолвит этот гейт как если бы был передан аргумент `autopilot`, помечая запись в `session-log.md` префиксом `[assumed]` вместо `[autopilot default]` |
| `pf-check` | "If 'Fix now'" — fix-сабагент's собственный `AskUserQuestion` | clarifying questions внутри фикса | hook — инструкция сабагенту не спрашивать, брать разумный вариант, фиксировать допущение в своей summary (той же формулировкой, что уже используется для `autopilot`-режима: "picks the most reasonable option and records the assumption") |
| `pf-user-docs` | Основной Q&A-цикл | условённый Q&A-цикл | hook |
| `pf-dev-docs` | Основной Q&A-цикл | условённый Q&A-цикл | hook |
| `pf-codereview` | `code.review: skip` confirmation (собственная копия) | "Code review is disabled — confirm?" | **исключение** — как и `/pf`'s копия, всегда спрашивается |
| `pf-codereview` | Review-gate (после Phase 3, `verdict: FAIL`) | "Apply fix / Stop" (два варианта) | **не новый hook** — front-loaded переиспользует существующий неинтерактивный путь этого скилла тем же способом, что `pf-check` выше (если у `pf-codereview` уже есть собственный autopilot-режим — используется он; иначе резолюция идентична тому, что описывает `pf-check`'s "Autopilot mode": авто-Fix при P0/P1) |
| `pf-codereview` | Fix-сабагент's собственный `AskUserQuestion` | clarifying questions | hook — та же инструкция, что у `pf-check` |
| `pf-qa` | "These items require human confirmation" (ручные QA-пункты, plain-text подтверждение, не литеральный `AskUserQuestion`) | "Respond with the item number and PASS or FAIL" | hook, расширенный на не-`AskUserQuestion` формы: front-loaded правило (§3.8 part1) обобщается на "любая точка, где стадия иначе ждала бы ответа человека" — не только вызовы инструмента `AskUserQuestion` буквально; резолюция — допущение PASS для пунктов без противопоказаний в собранных артефактах, с явным `[assumed]` на каждый такой пункт (пункт остаётся видимым в `qa_report.md` как assumed-PASS, не скрывается) |
| `pf-test` | "## Phase 1: Detect Test Runner", п.5 ("None of the above match → ask the user: 'No test runner detected...'") | "What command should I use to run the test suite?" | **hook (finding #11) — не "hook не требуется".** Черновик ошибочно считал, что в файле нет ни одной остановки, потому что искал только литеральный `AskUserQuestion`; этот plain-text вопрос — такая же остановка (то же обобщение, что уже применено к `pf-qa` выше). Резолюция: front-loaded issue пропускает вопрос и **пытается** самый частый в этом фреймворке паттерн, `make test` (тот же приоритет, что и Phase 1's собственный список — `npm test`/`make test`/`pytest`/`phpunit`, ни один не совпал по файлам-маркерам, поэтому используется наиболее общий кросс-языковый вариант), логируя `[assumed] No test runner auto-detected → assumed 'make test'` в `open_questions.md`. Если и эта команда падает с "command not found"/аналогичной ошибкой, а не с обычным тестовым провалом — это не более "допущаемый" вопрос: стадия останавливается с обычной ошибкой ("no usable test command found — even the front-loaded fallback failed"), а не продолжает гадать дальше |
| `pf-close` | "## Phase 1: Confirm with User" | "Proceed? (yes/no)" | **не исключение — расширенный финальный гейт (finding #10), см. §7.13.1 ниже.** Черновик оставлял этот вопрос безусловным "как есть", не давая front-loaded issue того самого единого финального гейта с полным ledger'ом, override'ом и повторной проверкой, который AC-12d требует буквально ("вопросы существующих стадий заменяются допущениями... с той же сессией решения перед закрытием"); голое "Proceed? (yes/no)" — не эта сессия. Правка — §7.13.1. |
| `pf` | "Reviewer-assignment guard (before Step 5)" (bug-type) | "Who should review `<key>`?" | hook |
| `pf` | "`code.review: skip` confirmation guard" | "Code review is disabled — confirm?" | **исключение** |
| `pf` | Bug workflow, "CREATE only" строка | clarifying dialog + tier reconfirmation | hook |

**"## Creating prompt.md" и "### Role assignment" — не hook-сайты сами по
себе, но получают один новый опциональный вопрос (finding #12).**
`interaction: front-loaded` само по себе — поле **внутри** `prompt.md`; на
момент, когда задаются вопросы "какой язык"/"какой tier"/распределение
ролей, этого поля в файле ещё нет для issue, который решает включить
front-loaded уже сейчас — резолвить hook самим этим вопросам нечем (то же
рассуждение, что и в черновике). Но "## Creating prompt.md" получает
**новый, необязательный** вопрос в конце обычной ветки feat/improve/bug
(после `on_unavailable`, если он задавался): *"Enable front-loaded
interaction for this issue (human only at intake and at the final decision
gate before close)? Default: No — today's interactive behavior."* Выбор
**Да** здесь — не просто пишет `interaction: front-loaded` в `prompt.md`
(AC-12c, без изменений), это **и есть** intake-момент для этого issue: тут
же, тем же батчем, задаётся "Do you want Codex to review this issue's
documents/code? If Codex needs installing later, may I install it
automatically without asking again?" — тот же вопрос, что иначе задал бы
`codex:setup`/"Codex invocation chain" посреди пайплайна. Ответ пишется в
`profile:`/`roles:` (обычная схема §1/§3 pf-roles) **и**, для install-
предпочтения, в `open_questions.md` как обычное `[assumed]` (finding #12's
разрешение конфликта с AC-03c/AC-12d — не менять BRD, а перенести
readiness/install-вопрос в intake, чтобы между двумя точками контакта
ничего внешнего/деструктивного больше не всплывало). **Ограничение,
называемое честно, не скрытое:** это закрывает вопрос только для issue,
включивших front-loaded **на этом самом CREATE-вызове**. Issue, который
вместо этого дописывает `interaction: front-loaded` в уже существующий
`prompt.md` вручную (единственный путь, который и раньше был единственным
— §6.11, всё ещё доступен), не проходит через этот intake-момент заново;
для такого issue Codex-install-вопрос остаётся безусловным исключением в
таблице выше — компромисс, который часть finding #12 явно допускает
("либо... либо"), выбранный здесь как более достижимый без правки BRD, чем
полный запрет ручного пути. За пределами этого одного нового вопроса
"## Creating prompt.md" и "### Role assignment" не попадают ни в эту
таблицу, ни в implementation plan как hook-сайты.

#### 7.13.1 Final decision gate — `pf-close` Phase 1 for front-loaded feat/improve/bug (AC-12d, finding #10)

`skills/pf-close/SKILL.md`'s "## Phase 1: Confirm with User" gets a
conditional block, checked before printing today's plain summary: *"If
`prompt.md`'s `interaction` resolves to `front-loaded`
(`~/.claude/skills/pf-interaction/SKILL.md`) for this feat/improve/bug
issue, this Phase is the issue's one final human gate (the same role the
decision session plays for `idea`/`spike`, §3.8 part1 of this issue's
specs) — extend today's summary instead of replacing it:*

> 1. *Show the full ledger: every `[assumed]` line and every
>    `unverified-fact`/note recorded in `open_questions.md` across every
>    stage this issue ran through, one batch, the same shape as
>    `pf-idea-verdict`'s decision session (§3.5.1 part1) — not merely
>    counted, each one legible.*
> 2. *Show today's ordinary summary (merge/archive/usage/session-log
>    bullets) after the ledger, not instead of it.*
> 3. *Offer three responses, not two: **Proceed** (close as-is, every
>    assumption stands); **Override an assumption** (pick one entry, give
>    a new answer — regenerates only the sections its `Used in` names,
>    same discipline as §3.5.2 part1's point 3-4, and re-runs `/pf-check`
>    on every document that regeneration touched before this gate can be
>    shown again — same invalidation rule as override for `idea`/`spike`,
>    §3.5.2's points 6-8, reused here by reference, not restated); **Stop**
>    (cancel close, same as today's "no").*
> 4. *A confirmed **Proceed** is this issue's recorded final confirmation
>    — proceed with Phase 2 onward exactly as today.*"

This is a **hook-table exception's replacement, not a new independent
gate**: it is the same "Proceed? (yes/no)" call site the table above
marks, extended rather than duplicated — a front-loaded feat/improve/bug
issue gets exactly one such gate, here, not this plus a second
decision-session-shaped skill. For an issue **without** `interaction:
front-loaded`, this Phase is entirely unchanged (today's plain summary and
yes/no).

**Why `open_questions.md` is read here even though feat/improve/bug never
had this file before this issue.** `pf-interaction`'s hook resolution
(§3.8 part1, "Front-loaded rule") already requires every hook site listed
in §7.13's table to write into `open_questions.md` on assumption — the
file is created the first time any front-loaded feat/improve/bug stage
needs it, the same lazy-creation rule that already governs it for
`idea`/`spike` (§5.6 part1, reused by reference: "the file is created by
whichever stage first has something to write into it," not a new rule
invented here for feat/improve/bug).
