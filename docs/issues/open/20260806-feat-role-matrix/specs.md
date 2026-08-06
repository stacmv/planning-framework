# Technical Spec: Матрица ролей write/review по стадиям issue

## 0. Расширение охвата относительно BRD

По итогам уточняющих вопросов на этой стадии охват шире, чем в BRD:
`write:<actor>` для планировочных документов (`brd`/`specs`/`test_plan`/
`implementation_plan`) в этой issue **реализуется полностью**, а не только
декларируется как поле схемы. Реестр ключей `roles:` для планировочных
документов совпадает с сегодняшними ключами `reviewers:` —
`brd`, `specs`, `test_plan`, `implementation_plan`, `code` — новый короткий
alias `impl_plan` из черновика в `prompt.md` не используется.

## 1. Architecture overview

### 1.1 Где живут данные

```
docs/issues/open/<ISSUE-ID>/prompt.md   — roles: (per-issue, YAML frontmatter)
docs/planning/agents.yml                — реестр акторов (per-project)
docs/planning/role-profiles.yml         — именованные профили (per-project)
```

### 1.2 Кто резолвит роль и где

Каждый `pf-*` скилл, который сегодня читает `reviewers.<key>` (см.
`skills/pf-check/SKILL.md`, `skills/pf-codereview/SKILL.md`) и каждый
`pf-*` скилл, который сегодня безусловно пишет документ сам
(`pf-brd`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`), получает общий шаг
**"Resolve role"**, вынесенный текстом в новый файл
`skills/pf-roles/SKILL.md` (reference-скилл, как `pf-git`/`pf-size-tiers` —
не вызывается напрямую, другие скиллы на него ссылаются).

```
                      prompt.md: roles.<key>
                              │
                    есть ли запись для <key>?
                    ┌─────────┴─────────┐
                   нет                  да
                    │                    │
        fallback на профиль        читать write / review
        (см. 1.4) → запись             из записи
        как если бы была
                    │                    │
                    └─────────┬──────────┘
                               │
                    write = ровно один актор
                    review = [актор, …] + mode: parallel|sequential
                               │
                   резолвинг актора → agents.yml
                   (kind, invoke, model/command)
```

### 1.3 Инвариант независимости

Не реализуется (см. BRD, Non-Goals). Резолвер не сравнивает `write` и
элементы `review` между собой; любая комбинация, включая полное совпадение,
принимается без предупреждений.

### 1.4 Профили по умолчанию и fallback

- Если у issue нет блока `roles:` вообще (ни один ключ), но есть
  `profile:` рядом с `size_tier` — все ключи резолвятся через выбранный
  профиль из `docs/planning/role-profiles.yml`.
- Если нет ни `roles:`, ни `profile:` — поведение как до этой issue:
  `write: claude` для всех ключей, `review` резолвится из
  существующего `reviewers:` (см. §5, автомиграция) или, если и его нет,
  `review: [claude]`.
- Точечные ключи в `roles:` переопределяют профиль для конкретной стадии;
  остальные ключи продолжают резолвиться через профиль.

### 1.5 Новая раскладка пайплайна

```
... /pf-test → /pf-user-docs* → /pf-dev-docs* → /pf-qa → /pf-close
              (* — опциональные, могут быть roles.<key>: skip)
```

## 2. `prompt.md` frontmatter: новый блок `roles:`

Заменяет `reviewers:` для issue, созданных после этой issue (см. §5 —
автомиграция для старых). Пример для issue типа `feat`/`improve`:

```yaml
profile: claude-writes-codex-reviews   # опционально — имя профиля из role-profiles.yml
roles:
  brd:              { write: claude, review: [codex] }
  specs:             { write: claude, review: { mode: sequential, by: [haiku, codex] } }
  test_plan:         { write: claude, review: [codex] }
  implementation_plan: { write: claude, review: [codex] }
  code:              { write: codex,  review: [claude] }
  tests:             { write: codex,  review: [claude], run: claude }
  user_docs:         { write: codex,  review: [claude] }
  dev_docs:          skip
```

Поля записи для стадии:
- `write` — ровно один актор (обязателен для всех стадий кроме `skip`-стадии
  документации; для `code` `skip` запрещён на уровне `write` в принципе —
  стадии без записи `code` не существует).
- `review` — короткая форма `[codex]` эквивалентна
  `{ mode: parallel, by: [codex] }`. `parallel` — сегодняшняя `both`-логика
  (объединение находок с тегами источника, без дедупликации/арбитража).
  `sequential` — по порядку списка `by`: первый ревьюер находит проблемы,
  актор `write` этой стадии применяет фиксы автоматически (без запроса
  подтверждения у пользователя), затем исправленный артефакт уходит
  следующему ревьюеру в списке.
- `run` — только для `tests`; кто фактически запускает тестовый прогон.
- `skip` — стадия целиком пропущена (только `user_docs`/`dev_docs`;
  `code.review: skip` — не пропуск всей стадии, а отдельно допустимое
  значение только для `review`, см. ниже).

`code.review: skip` (пропуск только ревью кода, авторство остаётся
обязательным) — особый случай: разрешён, но:
1. в момент, когда пользователь задаёт эту роль (при создании issue или при
   ручной правке `prompt.md`, обнаруженной на следующем запуске `/pf`),
   `/pf` спрашивает подтверждение через `AskUserQuestion` ("Ревью кода для
   этой issue отключено — подтвердить?");
2. `qa_report.md` получает отдельную строку риска (см. §9).

## 3. `docs/planning/agents.yml` — реестр акторов

Per-project файл, создаётся этой issue с дефолтным содержимым при первом
использовании фичи (если файла ещё нет — любой `pf-*` скилл, которому
нужен резолвинг актора, создаёт его один раз со стандартным набором ниже,
без вопроса пользователю):

```yaml
actors:
  claude: { kind: llm, invoke: agent,  model: claude-sonnet-5 }
  haiku:  { kind: llm, invoke: agent,  model: claude-haiku-4-5-20251001 }
  codex:  { kind: llm, invoke: codex-companion }
  gemini: { kind: llm, invoke: cli,    command: "gemini -p {prompt}" }
```

`invoke` определяет, как скилл вызывает актора:
- `agent` — обычный субагент Claude (`Agent` tool), как сегодня для всех
  write-операций и для Claude-стороны ревью в `pf-check`/`pf-codereview`.
- `codex-companion` — тот же путь, что `skills/pf-check/SKILL.md`
  использует сегодня для ревью Codex (`codex-companion.mjs`), расширенный
  на write-операции:
  - для **ревью** — `node codex-companion.mjs review --wait --scope ...`
    (без изменений, см. §7);
  - для **write** — `node codex-companion.mjs task "<prompt>" --write`,
    тот же путь, которым `codex:codex-rescue` сегодня делегирует
    Codex запись в репозиторий (см.
    `codex-cli-runtime/SKILL.md`: `task ... --write`). Скилл-потребитель
    формирует `<prompt>` (см. §6.2) и передаёт его через тот же
    единственный `task`-вызов; не через `codex:codex-rescue` напрямую
    (тот субагент — чистый форвардер пользовательских rescue-запросов, не
    предназначен для программного вызова из другого скилла) — а тем же
    `codex-companion.mjs` скриптом, вызванным из Bash напрямую, аналогично
    тому, как `pf-check` уже вызывает его для `review`.
- `cli` — произвольная команда с плейсхолдером `{prompt}`, для будущих
  акторов вне Claude/Codex (в этой issue не реализуется ни для одного
  реального актора кроме заготовки `gemini` в дефолтном реестре — эта
  запись документирует форму, но не тестируется; см. §12 Out of scope).

Резолвер актора для `kind: human` не реализуется в этой issue (см. BRD,
Non-Goals), но формат реестра не должен требовать изменений, когда такая
запись появится (`human: { kind: human, inbox: project-explorer }`) —
резолвер обязан явно завершаться понятной ошибкой на `kind: human`
("actor '<name>' is kind: human — not supported until
20260806-improve-project-explorer-redesign"), а не падать необработанным
исключением.

## 4. `docs/planning/role-profiles.yml` — профили по умолчанию

```yaml
profiles:
  solo-claude:
    # backward-compat дефолт: всё делает Claude
    default: { write: claude, review: [claude] }
  claude-writes-codex-reviews:
    default: { write: claude, review: [codex] }
    code:    { write: claude, review: [codex] }
  codex-implements:
    default:  { write: claude, review: [codex] }
    code:     { write: codex, review: [claude] }
    tests:    { write: codex, review: [claude], run: claude }
    user_docs: { write: codex, review: [claude] }
```

`default` — роль, применяемая ко всем ключам стадий, для которых профиль не
задаёт точечное переопределение. Резолвер: для стадии `<key>` — если у
профиля есть запись `<key>`, использовать её; иначе — `default`.

Файл создаётся этой issue с этим содержимым как дефолт проекта, если его
ещё нет (тем же "создать при первом обращении" механизмом, что и
`agents.yml`).

### 4.1 Выбор профиля

- **Вопрос при создании issue** — `skills/pf/SKILL.md`, "Creating prompt.md":
  сразу после вопроса про `size_tier`, третий вопрос — "Какой профиль
  ролей использовать?" со списком имён профилей из
  `docs/planning/role-profiles.yml` (`solo-claude` рекомендован как
  сегодняшнее поведение). Ответ записывается как `profile:` в frontmatter,
  рядом с `size_tier`.
- Существующий отдельный **reviewer-assignment guard** (`pf`/`pf-brd`,
  вопрос "кто ревьюит каждый документ") **удаляется** для issue, у которых
  уже есть `profile:` — профиль покрывает и write, и review. Guard
  продолжает существовать только как автомиграционный путь для issue,
  созданных до этой фичи (см. §5).
- **Смена профиля/ролей посреди пайплайна** — ручная правка `roles:` /
  `profile:` в `prompt.md`; никакого отдельного скилла для этого не
  вводится (решение, зафиксированное в этой issue). `/pf` не кэширует
  резолвинг — каждый запуск любого `pf-*` скилла читает `prompt.md` заново,
  поэтому правка подхватывается со следующего запуска автоматически.
  Уже пройденные стадии не пересматриваются задним числом.

## 5. Обратная совместимость: автомиграция `reviewers:` → `roles:`

Место: общий шаг в `skills/pf/SKILL.md`, выполняется в начале — сразу после
Step 2 (сканирование `docs/issues/open/`), до Step 4, для **каждой**
открытой issue, у которой в `prompt.md` есть `reviewers:`, но нет `roles:`.

Правило конверсии (детерминированное, без вопросов пользователю):

```
для каждого key: actor в старом reviewers:
  roles[key] = { write: claude, review: [actor] }
```

- Если у `reviewers.<key>` было значение `both` — `review: [claude, codex]`.
- Ключи старого `reviewers:` (`brd`/`specs`/`test_plan`/
  `implementation_plan`/`code`/`notes`) переносятся как есть — те же имена,
  что и в новой схеме (см. §0).
- После конверсии `roles:` записывается в `prompt.md`, старый блок
  `reviewers:` **удаляется** (не оставляется рядом — иначе резолвер должен
  бы решать, какой блок приоритетнее, а это новый источник рассинхрона).
- Конверсия — mutating-операция над `prompt.md`, поэтому по тем же
  правилам, что и любая другая правка issue-файла, коммитится как часть
  той же git-операции, что и следующий шаг пайплайна (не отдельным
  коммитом ради самой миграции) — то есть попадает в staged-паths того
  `pf-*` шага, который следующим пишет в эту issue.

## 6. Изменения в `skills/pf-brd/SKILL.md`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`

Одинаковый паттерн для всех четырёх (BRD/specs/test-plan/impl-plan).

### 6.1 Когда write не claude

Каждый из этих скиллов сегодня безусловно пишет документ сам (в контексте
оркестрирующей сессии, без диспетчеризации субагента — см. текущий текст
`pf-brd`: "Write it directly — no sub-agent dispatch"). Новый шаг перед
записью файла:

1. Resolve role для `<key>` (см. §1.2/§1.4) → получить `write`.
2. Если `write == claude` — поведение не меняется (сегодняшний путь: сама
   сессия ведёт `AskUserQuestion`-цикл и пишет документ).
3. Если `write != claude` (в этой issue — только `codex`):
   - `AskUserQuestion`-цикл уточняющих вопросов **всё равно ведёт
     оркестрирующая сессия** (субагенты не умеют звать `AskUserQuestion` —
     см. `pf-autopilot/SKILL.md`). Сессия доводит уточнение требований до
     тех же ~95% уверенности, что и сегодня.
   - Вместо того чтобы писать документ самой, сессия формирует один текстовый
     промпт для actor'а (см. §6.2) и вызывает его инвокатор из `agents.yml`
     (для `codex` — `codex-companion.mjs task "<prompt>" --write`, см. §3).
   - Actor'у передаётся **путь целевого файла** (`docs/issues/open/<ID>/
     brd.md` и т.д.) — actor редактирует/создаёт файл сам (`--write`),
     скилл не парсит stdout как содержимое документа.
   - После возврата команды скилл читает получившийся файл с диска и
     продолжает свой сегодняшний post-processing без изменений (для
     `pf-brd` — tier reconfirmation; для `pf-spec` — split-at-1500-lines;
     и т.д.), как если бы файл появился обычным путём.

### 6.2 Форма промпта для write-делегирования

Единый шаблон (используется всеми четырьмя скиллами, с точечной заменой
"какой документ"):

```
Напиши <BRD|техническую спецификацию|тест-план|implementation plan>
для issue <ISSUE-ID> в файл <путь>.
Контекст: <содержимое prompt.md>
<содержимое предыдущих документов пайплайна, если есть — brd.md для specs,
 specs.md для test_plan, и т.д.>
Уточнённые в диалоге с пользователем требования: <сжатая выжимка ответов
 AskUserQuestion-цикла из этого прогона>
Язык документа: <doc_language>.
Структура и уровень детализации: <шаблон секций для этого документа и tier,
 как описано в текущем skills/<pf-brd|pf-spec|...>/SKILL.md и
 skills/pf-size-tiers/SKILL.md>.
```

### 6.3 Уточнение к `pf-spec`'s "1500-line split"

Split-логика (создание index-файла + 3 частей при превышении 1500 строк) не
меняется по сути, но при `write: codex` создание частей выполняет тот же
actor тем же вызовом (единый `task ... --write`, с инструкцией внутри
промпта разбить на части при превышении лимита) — не отдельным
пост-обработкой со стороны Claude.

## 7. Изменения в `skills/pf-check/SKILL.md`, `skills/pf-codereview/SKILL.md`

### 7.1 Источник роли — `roles.<key>.review`, не `reviewers.<key>`

Заменить резолвинг: было — `reviewers.<key>` (одно значение: `claude` /
`codex` / `both`); стало — `roles.<key>.review` (список + `mode`). Таблица
отображения старого поведения на новое:

| Старое `reviewers.<key>` | Новое `roles.<key>.review` |
|---|---|
| `claude` (или отсутствует) | `{ mode: parallel, by: [claude] }` |
| `codex` | `{ mode: parallel, by: [codex] }` |
| `both` | `{ mode: parallel, by: [claude, codex] }` |

`parallel`-режим с `by: [claude, codex]` — это сегодняшняя `both`-логика
(секция "`both`-mode aggregation" в `pf-check`) без изменений.

### 7.2 Новый `sequential`-режим

Ревьюеры из списка `by` идут по порядку. После каждого ревьюера, кроме
последнего:
1. Findings этого ревьюера передаются актору `write` этой стадии (см. §1.2)
   тем же путём, что и сегодняшний "Fix now" в `pf-check`/`pf-codereview`
   (диспетч на write-актора с P0/P1 findings, автоматическое применение,
   без промежуточного вопроса пользователю — решение, зафиксированное в
   BRD/эта issue).
2. Целевой документ перечитывается с диска.
3. Следующий ревьюер в `by` получает уже исправленную версию как TARGET.

Финальный отчёт (`code_review.md` / вывод `pf-check`) перечисляет находки
**каждого** ревьюера отдельным блоком с меткой `[<actor>, pass N]`, включая
находки, которые уже были исправлены до следующего прохода (помечаются
`(fixed before next reviewer)`), чтобы история прохода была видна, а не
только финальный срез.

### 7.3 `code.review: skip`

`pf-codereview` при `roles.code.review == skip`: не запускает ревью вообще,
записывает в `code_review.md` `verdict: SKIPPED (roles.code.review: skip,
confirmed <дата подтверждения>)` и не блокирует переход к `/pf-test`.

## 8. Новые скиллы: `skills/pf-user-docs/SKILL.md`, `skills/pf-dev-docs/SKILL.md`

Оба — тонкие обёртки вокруг того же паттерна §6 (resolve role → write
напрямую или делегирование actor'у → review по `roles.<key>.review`),
применённого к новым типам артефактов:

- `pf-user-docs` → `docs/issues/open/<ID>/user_docs.md` (или правки в
  README/CHANGELOG проекта — конкретную цель определяет содержимое issue,
  не эта спека) — README, CHANGELOG, руководство пользователя.
- `pf-dev-docs` → `docs/issues/open/<ID>/dev_docs.md` — архитектура, ADR,
  runbook, деплой.

Обе стадии — между `/pf-test` (TESTING) и `/pf-qa` (QA) в `skills/pf/
SKILL.md`'s feat/improve/bug таблицах (§9 ниже про сам `/pf` не трогаем
детально — только добавляем эти два шага в маршрутизацию между TESTING и
QA, с тем же принципом "первая незавершённая стадия").

- Если `roles.user_docs == skip` (или `roles.dev_docs == skip`) —
  `/pf` пропускает соответствующий шаг маршрутизации и в статусном блоке
  показывает его как `skipped (roles.user_docs: skip)` в списке
  Completed stages (не как выполненный и не как следующий шаг).
- Для issue с `size_tier: trivial`/`small`, у которых `roles.user_docs`/
  `roles.dev_docs` не заданы явно — резолвятся в `skip` по умолчанию (это
  правило добавляется в `role-profiles.yml`-резолвинг как последний
  fallback уровень, после профиля: явная запись в `roles:` > профиль >
  tier-дефолт `skip` для `trivial`/`small` > `write: claude, review:
  [claude]` для остальных тиров).

## 9. Изменения в `skills/pf-qa/SKILL.md`

- Prerequisite-проверка расширяется: помимо `manual_test_checklist.md`,
  для каждой из `user_docs`/`dev_docs`, которая **не** `skip`, требуется
  существующий и непустой `user_docs.md`/`dev_docs.md`; при отсутствии —
  то же поведение, что сегодня для отсутствующего `manual_test_checklist.md`
  ("<Stage> is not complete. Run /pf-user-docs first.").
- Новая строка риска в `qa_report.md`, добавляется безусловно, когда
  `roles.code.review == skip` для этой issue:
  ```
  ⚠ Risk: code review was skipped for this issue (roles.code.review: skip,
  confirmed <дата>). No independent review of the implementation exists.
  ```
  Эта строка не блокирует `PASS`-вердикт сама по себе — она информационная,
  как и остальные риск-строки в `qa_report.md`.

## 10. `skills/pf/SKILL.md` — сводка изменений

- Step 2 (сканирование): перед Step 4 добавляется автомиграция `reviewers:`
  → `roles:` для каждой открытой issue, у которой она применима (§5).
- "Creating prompt.md": третий вопрос — выбор профиля (§4.1), сразу после
  `size_tier`.
- Reviewer-assignment guard: остаётся только как автомиграционный путь; для
  issue с `profile:`/`roles:` уже заданными, не задаётся повторно.
- Step 5/Step 7 (completed stages, статусный блок): строки `user_docs`,
  `dev_docs` добавляются в таблицу Step 5 между TESTING и QA, с учётом
  `skip` (см. §8).
- Step 6 (feat/improve/bug таблицы): между строкой TESTING и строкой QA
  добавляются `user_docs`/`dev_docs`, с тем же принципом "первая
  незавершённая стадия governs", пропуская `skip`-стадии как уже
  завершённые.

## 11. Новый reference-скилл `skills/pf-roles/SKILL.md`

Не команда, а reference-документ (как `pf-git`/`pf-size-tiers`), на который
ссылаются `pf`, `pf-brd`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`,
`pf-check`, `pf-codereview`, `pf-execute`, `pf-user-docs`, `pf-dev-docs`,
`pf-qa`. Содержит единое определение:
- схемы `roles:`/`profile:` в `prompt.md` (§2),
- схемы `agents.yml`/`role-profiles.yml` (§3, §4),
- алгоритма резолвинга роли для стадии (§1.2, §1.4, включая порядок
  fallback: явная запись → профиль → tier-дефолт `skip` для доков → общий
  дефолт `write: claude, review: [claude]`),
- автомиграции (§5),
- механики sequential-режима (§7.2).

Это устраняет риск, отмеченный в исходном `prompt.md` ("Учесть при
реализации"): единая точка вызова/резолвинга акторов — единая точка
починки при поломке любого из них, аналогично тому, как `pf-git`
централизовал commit&push процедуру.

## 12. Out of scope (подтверждено в BRD/уточняющих вопросах)

- `human` как актор, очередь задач, режимы `blocking`/`non-blocking` —
  `20260806-improve-project-explorer-redesign`.
- Инвариант независимости write/review — не реализуется вовсе.
- Отдельный интерактивный скилл для смены ролей/профиля посреди
  пайплайна — правка `prompt.md` вручную.
- Реальная работоспособность `kind: cli`/`invoke: cli` (`gemini`) —
  формат задокументирован в дефолтном `agents.yml`, но не тестируется и не
  вызывается ни одним профилем по умолчанию в этой issue.
- Изменение логики самого `.qa-workflow.md`/runnable-команд в `pf-qa` —
  только добавление prerequisite-проверки и risk-строки (§9).
