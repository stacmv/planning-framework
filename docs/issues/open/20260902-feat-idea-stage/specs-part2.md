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
Отсутствует у issue, созданного вручную/напрямую. Значение — ID папки под
`docs/issues/closed/` (идея к этому моменту уже заархивирована — Phase 5.5
идёт после Phase 5, §4.4 в part1).

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

## Decision
<ДОПИСЫВАЕТСЯ ТОЛЬКО ПОСЛЕ сессии решения — отсутствие этой секции есть
признак "ещё не подтверждено", см. §3.5.3 part1>
```

`## Decision`, будучи дописанной, имеет фиксированную форму:

```markdown
## Decision

**Confirmed verdict:** <project | spike-first | defer | archive>
**Date:** <YYYY-MM-DD>
**Timestamp:** <UTC ISO-8601>
```

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

#### 7.3.1 Определение TYPE и три варианта Phase 0

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

**Новый пункт 4 (idea only) — `has_git`.** Вычислить `has_git` (§Phase 0
`pf/SKILL.md`). Если ложно (единственный достижимый случай — `idea`-issue,
созданный в изначально пустой не-git-папке, §3.1.1 part1's ветка "Идея",
и ни разу не превратившийся в проект) — установить флаг `NO-REPO` на весь
остаток прогона `pf-close` для этого issue. Этот флаг перекраивает
поведение сразу нескольких последующих Phase, перечисленных ниже по
отдельности (§7.3.2's Phase 3.5/4, §7.3.5) — фиксируется здесь один раз,
не пересчитывается на каждой Phase заново, поскольку git-репозиторий не
может появиться сам по себе между Phase 0 и Phase 5.5 (единственное место,
где он может быть создан этим же прогоном — Phase 5.5, п.2a, **после**
этой точки).

**`NO-REPO`-ветка (idea only) — Phase 2, 3, 3.5/4 пропускаются целиком.**
Если пункт 4 выше установил `NO-REPO` — Phase 2 ("Pre-Close Cleanup",
`git status --porcelain`), Phase 3 ("Detect Parent Branch", `git config`/
`git branch --list`) и Phase 4/3.5 (merge или spike-копирование, оба
требуют git) **не выполняются вообще** — переход сразу к Phase 5 (Archive
Issue Folder, обычный `mv`, не git-операция). Это единственный путь,
которым `pf-close` доходит до Phase 5 без единого git-вызова — обоснование
и последствия для Phase 6-8 см. §7.3.5.

#### 7.3.2 Spike — копирование документов без merge (AC-09d)

Новая **Phase 3.5 (spike only, требует git — `NO-REPO` для spike
недостижим, см. §7.3.1's таблицу типов)**, между "Phase 3: Detect Parent
Branch" и "Phase 4: Merge" — **заменяет** Phase 4 целиком для `TYPE:
spike` (Phase 4 "Merge" в её сегодняшнем виде выполняется только для
feat/improve/bug):

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
stays on issue/ISSUE-ID, never merged or deleted"). Для `TYPE: idea` резюме
не упоминает merge/branch вовсе (idea никогда не создаёт ветку).

#### 7.3.3 Phase 4.5 — пропускается для idea/spike

**"## Phase 4.5"** получает предваряющую строку: *"Skip this entire phase
for `TYPE: idea` or `TYPE: spike` — neither type ever produces a
`test_plan.md`; reading a non-existent Status Tracker would incorrectly
trigger the 'no Status Tracker table found at all' stop-and-surface rule
in step 2 below."* Это не косметика — без явного пропуска Phase 4.5
ошибочно блокирует каждое закрытие idea/spike-issue (см. gap, найденный
до написания этого спека).

#### 7.3.4 Phase 5.5 (новая) — вердикт `project`/`spike-first`

Между "Phase 5: Archive Issue Folder" и "Phase 6: Compute LLM Usage &
Cost", применяется только для `TYPE: idea`:

1. Прочитать подтверждённый вердикт из
   `docs/issues/closed/ISSUE-ID/verdict.md`'s "## Decision" (issue уже
   перемещён туда предыдущей Phase).
2. **`project`:**
   a. Если `has_pf`/`has_git` (§3.1.1 part1, вычислено заново для CWD)
      ложны — развернуть каркас + `git init`, тем же путём, что §3.1.1
      п.2-8 (ссылка на процедуру по имени, не копирование текста).
   b. Определить `<slug>` из `idea.md`'s заголовка/темы.
   c. Создать `docs/issues/open/<YYYYMMDD>-feat-<slug>/prompt.md`,
      предзаполненный: `doc_language`/`idea_tier`→нет прямого маппинга в
      `size_tier` (оставить `size_tier` неустановленным — обычный
      legacy-tier guard `/pf` спросит его при первом визите, как для
      любого нового feat-issue), `idea_ref: <closed-idea-id>`, тело —
      идея/MVP/ограничения, скомпонованные из `idea.md`+`verdict.md`+
      исходного intake текста `prompt.md` (тот, что уже в архиве).
   d. Отчёт Phase 9 дополняется строкой: *"Created follow-up issue:
      <feat-id> (idea_ref: <idea-id>). Next: /pf-brd."*
3. **`spike-first`:**
   a. Аналогично создать `docs/issues/open/<YYYYMMDD>-spike-<slug>/
      prompt.md`, `idea_ref: <closed-idea-id>`, поля `## Question`/
      `## Success Criterion`/`## Time-box`/`## Method` — best-effort
      выведены из `verdict.md`'s "## Reasoning" (в частности, из того,
      какой открытый технический вопрос стал причиной `spike-first`) и
      `critique.md`'s Summary Table (строки с диспозицией "Идея меняется"
      или неразрешённые технические возражения техлида/безопасника —
      естественный источник кандидата в "Question"). Ничего не
      спрашивается у пользователя — front-loaded правило применяется и
      здесь: неоднозначность резолвится рекомендацией, логируется как
      `[assumed]` в **новом** `open_questions.md` только что созданного
      spike-issue.
   b. Отчёт дополняется: *"Created follow-up issue: <spike-id> (idea_ref:
      <idea-id>). Next: /pf-idea-spike."*
4. **`defer`/`archive`:** ничего не создаётся — переход к Phase 6 как
   обычно.

#### 7.3.5 Не-git guard в закрытии — все затронутые Phase (AC-01d, продолжение §3.1.4 part1)

`NO-REPO` (§7.3.1, пункт 4), однажды установленный, **не перевычисляется**
внутри Phase 6-8 — единственное место, где он может смениться на "теперь
есть репозиторий" в рамках одного прогона `pf-close` — это Phase 5.5, п.2a
(`project`-вердикт), которая по построению идёт **до** Phase 6. Порядок
Phase остаётся Phase 5 → Phase 5.5 → Phase 6 → Phase 7 → Phase 8 → Phase
8.5 → Phase 9 (не меняется этим issue) — поэтому, если Phase 5.5 выполнила
`git init`, к Phase 6 репозиторий уже существует, и всё, что ниже,
относится **только** к исходу `defer`/`archive` в изначально голой
не-git-папке (единственный случай, где `NO-REPO` доживает до Phase 6 и
дальше):

| Phase | Правка при `NO-REPO`, дожившем до этой точки |
|---|---|
| Phase 5.5, конец (после п.4 "`defer`/`archive`: ничего не создаётся") | Явно **перепроверить** `has_git`: для `project`/`spike-first` — истинно (только что создан п.2a); для `defer`/`archive` — по-прежнему ложно. Значение фиксируется как окончательное `NO-REPO` для Phase 6-9. |
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
Phase 5.5's `git init` раньше, чем эта ветка вообще проверяется, а `spike`
как тип не может быть создан в не-git-контексте вообще (AC-09b требует
"любой проект", т.е. уже существующий, а §3.1.5 part1's трёхвариантный
вопрос, единственный путь создать `spike` напрямую, сам достижим только
при `has_pf: true`).

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
шесть новых строк:

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
decision session, never apply the 3-attempts rule to it.** When the pinned
issue is `idea`-type and its next step is `/pf-idea-verdict (decision
session)` (§3.5.4/§7.1 of specs.md, `20260902-feat-idea-stage`) — stop the
work loop there instead of invoking it. Print the final report (below)
immediately; do not delete the schedule (Step 3 still requires the issue
to actually be closed) — the next scheduled resume will find the same
state and stop again, until a human runs the decision session by hand."*

**"## Step 3. Completion", финальный отчёт** — оговорка: для `idea`-issue,
остановленного перед сессией решения, отчёт (не "Completion", а
промежуточный) дополнительно перечисляет полный список `[assumed]`-строк
и открытых вопросов из `open_questions.md` (US-10c, дословно).

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
> вопросы, на которые там нет ответа"). If `doc_language`/`size_tier`/
> `roles`/`profile` are absent from this feat-issue's own `prompt.md` but
> can be inferred from the closed idea (`doc_language` — carried over
> directly; `size_tier` — inferred from `idea.md`'s "Cost (Effort)" and
> `idea_tier`, with the AI's own judgement recommended and confirmed via
> the ordinary legacy-tier guard rather than silently assumed, since
> `size_tier` confirmation is not one of front-loaded's exemptions and
> this issue is not itself `interaction: front-loaded` unless its own
> `prompt.md` says so), leave the legacy-tier guard's existing question to
> handle it (AC-08c: "спрашиваются только если их нельзя вывести из
> intake идеи" — a recommendation the guard already offers, not a new
> mechanism).

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
строки (нужны для конъюнкта 3 критерия completeness, §3.1.7 part1):

| Pipeline | Stage order |
|---|---|
| `idea` (типа issue, не `size_tier` — см. оговорка ниже) | CREATE (`prompt.md`) → IDEA (`idea.md`) → RESEARCH (`research.md`) → CRITIQUE (`critique.md`) → VERDICT (`verdict.md`) |
| `spike` | CREATE (`prompt.md`) → HYPOTHESIS (`hypothesis.md`) → FINDINGS (`findings.md`) |

Предваряющая оговорка над этими двумя строками: *"These two pipelines are
keyed on issue TYPE (folder-name prefix `idea`-/`spike`-), not on any
`size_tier` value — `idea`/`spike` issues never carry `size_tier` at all
(see `pf-idea-lenses/SKILL.md`'s `idea_tier` instead). They exist here
purely so conjunct 3 of 'Stage completion' below has a defined pipeline
order for these two types; the reader-facing routing table with concrete
next-step commands lives in `pf-idea-lenses/SKILL.md`, not here — see that
file's 'Stage tables'."*

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
`PLANNING.md` and no `docs/planning/` directory. In that case, resolution
for every key falls straight through to §4 level 5 (`write: claude,
review: [claude]`) without ever reaching levels 1-4 (there is no
`prompt.md.roles`/`profile:` to check beyond level 1, and levels 2-4 all
require a resolved profile, which cannot exist without
`role-profiles.yml`) — this degrades gracefully to the same static default
the whole framework used before per-stage roles existed. The moment the
project gains a PF scaffold (the idea's verdict becomes `project`, §7.3.4
part2 — Phase 5.5 creates `docs/planning/` as part of scaffolding), normal
auto-creation resumes on that project's very next role resolution, same as
any other project."*

**"## 4. Resolving a stage's role — the fallback order", level 5** получает
уточнение одной фразой: *"(For a bare `idea`/`spike` folder with no PF
scaffold, level 5 is reached unconditionally per the Auto-creation
exception above — never levels 1-4.)"*

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
| `pf-check` | "### Codex invocation chain", шаг 1/2a (`codex:setup`'s собственный вопрос) | "install Codex CLI?" | **исключение** — устанавливает ПО, всегда спрашивается |
| `pf-check` | "### Codex invocation chain", шаг 3 | "install the codex plugin now?" | **исключение** — устанавливает ПО |
| `pf-check` | "How would you like to proceed?" (review gate) | Fix now / I'll fix manually / Skip | **не новый hook** — front-loaded переиспользует уже существующий неинтерактивный путь этого файла, "Autopilot mode", вызывая его тем же способом, каким это делает `/pf-check autopilot`: front-loaded issue резолвит этот гейт как если бы был передан аргумент `autopilot`, помечая запись в `session-log.md` префиксом `[assumed]` вместо `[autopilot default]` |
| `pf-check` | "If 'Fix now'" — fix-сабагент's собственный `AskUserQuestion` | clarifying questions внутри фикса | hook — инструкция сабагенту не спрашивать, брать разумный вариант, фиксировать допущение в своей summary (той же формулировкой, что уже используется для `autopilot`-режима: "picks the most reasonable option and records the assumption") |
| `pf-user-docs` | Основной Q&A-цикл | условённый Q&A-цикл | hook |
| `pf-dev-docs` | Основной Q&A-цикл | условённый Q&A-цикл | hook |
| `pf-codereview` | `code.review: skip` confirmation (собственная копия) | "Code review is disabled — confirm?" | **исключение** — как и `/pf`'s копия, всегда спрашивается |
| `pf-codereview` | Review-gate (после Phase 3, `verdict: FAIL`) | "Apply fix / Stop" (два варианта) | **не новый hook** — front-loaded переиспользует существующий неинтерактивный путь этого скилла тем же способом, что `pf-check` выше (если у `pf-codereview` уже есть собственный autopilot-режим — используется он; иначе резолюция идентична тому, что описывает `pf-check`'s "Autopilot mode": авто-Fix при P0/P1) |
| `pf-codereview` | Fix-сабагент's собственный `AskUserQuestion` | clarifying questions | hook — та же инструкция, что у `pf-check` |
| `pf-qa` | "These items require human confirmation" (ручные QA-пункты, plain-text подтверждение, не литеральный `AskUserQuestion`) | "Respond with the item number and PASS or FAIL" | hook, расширенный на не-`AskUserQuestion` формы: front-loaded правило (§3.8 part1) обобщается на "любая точка, где стадия иначе ждала бы ответа человека" — не только вызовы инструмента `AskUserQuestion` буквально; резолюция — допущение PASS для пунктов без противопоказаний в собранных артефактах, с явным `[assumed]` на каждый такой пункт (пункт остаётся видимым в `qa_report.md` как assumed-PASS, не скрывается) |
| `pf-test` | — | (в файле не найдено ни одного вызова `AskUserQuestion`) | hook не требуется — перечислен для полноты по decision 10 |
| `pf-close` | "## Phase 1: Confirm with User" | "Proceed? (yes/no)" | **исключение** — финальное подтверждение закрытия всегда задаётся (AC-07e/decision 9 — единственная оставшаяся точка человека "в конце" для front-loaded feat/improve/bug тоже) |
| `pf` | "Reviewer-assignment guard (before Step 5)" (bug-type) | "Who should review `<key>`?" | hook |
| `pf` | "`code.review: skip` confirmation guard" | "Code review is disabled — confirm?" | **исключение** |
| `pf` | Bug workflow, "CREATE only" строка | clarifying dialog + tier reconfirmation | hook |

**"## Creating prompt.md" и "### Role assignment" — сознательно не
hook-сайты.** `interaction: front-loaded` само по себе — поле **внутри**
`prompt.md`; на момент, когда задаются вопросы "какой язык"/"какой
tier"/распределение ролей, этого поля в файле ещё нет (он как раз
создаётся этим самым шагом) — резолвить hook нечем. Это отличает
feat/improve/bug от `idea`/`spike`, где сам intake **есть** тот момент,
где поле устанавливается, и front-loaded действует по определению типа, не
по чтению уже существующего файла (§6.11). Единственный способ включить
front-loaded для feat/improve/bug — дописать поле в уже созданный
`prompt.md` вручную **после** CREATE; оно начинает действовать со
следующего вызова любой стадии. Поэтому "## Creating prompt.md" и
"### Role assignment" не попадают ни в эту таблицу, ни в implementation
plan как hook-сайты.
