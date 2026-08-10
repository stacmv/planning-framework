## Implementation Plan: Матрица ролей write/review по стадиям issue

### Overview

Фича вводит на уровне issue матрицу ролей `roles:` (кто пишет, кто ревьюит,
в каком режиме — параллельно или по цепочке), поверх расширяемого реестра
акторов `docs/planning/agents.yml` и именованных профилей
`docs/planning/role-profiles.yml`. Единая точка резолвинга и вся механика
(fallback-цепочка, автомиграция старого `reviewers:`, форма write-делегирования
Codex) документируется один раз в новом reference-скилле
`skills/pf-roles/SKILL.md`, на который ссылаются все потребители — по тому же
паттерну, что `skills/pf-git/SKILL.md` уже централизует commit&push, а
`skills/pf-size-tiers/SKILL.md` — определение «стадия завершена».

План разбит на семь задач в порядке зависимостей: сначала реестр/профили/
reference-скилл (всё остальное на них ссылается), затем автомиграция и
изменения оркестратора `/pf`, затем write-делегирование в четырёх
планировочных скиллах, затем review-логика `pf-check`/`pf-codereview`,
затем `pf-execute`, затем две новые опциональные стадии документации, и
последним — маршрутизация пайплайна в `pf/SKILL.md`, которая эти стадии
встраивает в путь issue.

Источник истины для скиллов — `D:/dev/planning-framework/skills/` в этом
репозитории (не `~/.claude/skills/`): установленные копии синхронизируются
командой `make update-skills` / `scripts/update-skills.sh` (проверено —
`diff -rq` между `skills/pf-git`, `skills/pf-check`, `skills/pf` в репозитории
и в `~/.claude/skills/` не показывает расхождений на момент написания этого
плана). Все пути ниже — репозиторные, относительно корня
`planning-framework`. После реализации `make update-skills` обязателен перед
прогоном Manual TC из `test_plan.md` — сами TC это явно требуют в
Prerequisites.

По ходу чтения текущего содержимого скиллов найдены два файла, не
перечисленных явно в `specs.md`, но требующих правки, потому что они уже
служат «единой точкой» для смежных механик и матрица ролей ломает их
содержимое, если оставить как есть:
- `skills/pf-git/SKILL.md` — таблицы Step 1/Step 2 перечисляют стадии
  пайплайна по имени; без строк для `/pf-user-docs`/`/pf-dev-docs` эти два
  новых скилла остаются без определения того, что и как коммитить.
- `skills/pf-size-tiers/SKILL.md` — таблица «Pipelines» и список документов
  в разделе «Scope» перечисляют стадии/документы каждого пайплайна; без
  `user_docs`/`dev_docs` рекурсивное определение «стадия завершена» (на
  котором держится вся логика «первая незавершённая стадия governs» в
  `pf/SKILL.md`) не будет знать об этих двух новых стадиях.

Также найдено: `skills/pf-check/SKILL.md` (строка про fix-сабагента) и
`skills/pf-codereview/SKILL.md` (две аналогичные строки) сегодня содержат
абсолютный запрет «fix-сабагент — всегда Claude, никогда Codex» — это прямо
противоречит §7.2/§6a этой фичи, где актор `write` стадии (который может
быть Codex) как раз и применяет фиксы. Эти строки требуют переписывания, а
не дополнения новым текстом рядом со старым — иначе скилл остаётся
противоречащим сам себе, и модель во время реального прогона следует более
категоричному старому запрету.

Наконец, `prompt.md` этой issue (пункт «Учесть при реализации») фиксирует,
что субагенты не имеют доступа к `TaskGet`/`TaskUpdate`, хотя
`skills/pf-execute/SKILL.md` сегодня предписывает это своим Claude-сабагентам
как первое/последнее действие. Новый канал вызова акторов (§6a) не должен
опираться на тот же нерабочий канал: задача 5 явно поручает поддержание
`TaskList`-статуса самой оркестрирующей сессии `pf-execute`, а не
делегированному актору.

### Files to Create/Modify

**New:**
- `docs/planning/agents.yml` — реестр акторов (`claude`, `haiku`, `codex`,
  `gemini`-заготовка)
- `docs/planning/role-profiles.yml` — именованные профили (`solo-claude`,
  `claude-writes-codex-reviews`, `codex-implements`)
- `skills/pf-roles/SKILL.md` — reference-скилл: схема `roles:`/`profile:`,
  алгоритм резолвинга с полным fallback-порядком, автомиграция, механика
  sequential-режима, форма write-инвокации акторов
- `skills/pf-user-docs/SKILL.md` — новая опциональная стадия «документация
  для пользователей»
- `skills/pf-dev-docs/SKILL.md` — новая опциональная стадия «документация
  для разработчиков»

**Modified:**
- `skills/pf/SKILL.md` — автомиграция (Step 2), вопрос выбора профиля и
  снятие reviewer-assignment guard для bug-типа (Creating prompt.md / guard),
  подтверждение `code.review: skip`, маршрутизация `user_docs`/`dev_docs`
  (Step 5/Step 6)
- `skills/pf-brd/SKILL.md` — снятие reviewer-assignment guard для feat/
  improve/trivial при наличии `profile:`, write-делегирование
- `skills/pf-spec/SKILL.md` — write-делегирование, включая split-логику
- `skills/pf-test-plan/SKILL.md` — write-делегирование
- `skills/pf-impl-plan/SKILL.md` — write-делегирование
- `skills/pf-check/SKILL.md` — источник роли `roles.<key>.review` вместо
  `reviewers.<key>`, sequential-режим, собственное предусловие автомиграции,
  снятие абсолютного запрета «fix-сабагент всегда Claude»
- `skills/pf-codereview/SKILL.md` — то же для `code`-ключа, плюс
  `code.review: skip` (подтверждение и `verdict: SKIPPED`), собственное
  предусловие автомиграции
- `skills/pf-execute/SKILL.md` — условное делегирование write-актору на
  уровне задачи (§6a), обход проблемы `TaskGet`/`TaskUpdate` для
  Codex-делегированных задач
- `skills/pf-qa/SKILL.md` — prerequisite-проверка `user_docs.md`/
  `dev_docs.md`, строка риска при `code.review: skip`
- `skills/pf-git/SKILL.md` — новые строки для `/pf-user-docs`/`/pf-dev-docs`
  в таблицах Step 1 (staging) и Step 2 (commit message)
- `skills/pf-size-tiers/SKILL.md` — `user_docs`/`dev_docs` в таблице
  «Pipelines» (между TESTING и QA) и в списке документов раздела «Scope»

### Implementation Tasks

#### Task 1: Реестр акторов, профили ролей и reference-скилл `pf-roles`

**Mapped Test Cases:** TC-006, TC-008, TC-009, TC-019, TC-020

**Files:**
- `docs/planning/agents.yml` — новый: реестр `actors:` с `claude`/`haiku`/
  `codex`/`gemini`, полями `kind`/`invoke`/`model`/`command`
- `docs/planning/role-profiles.yml` — новый: `profiles:` с `solo-claude`,
  `claude-writes-codex-reviews`, `codex-implements`, каждый — с `default` и
  точечными переопределениями
- `skills/pf-roles/SKILL.md` — новый reference-скилл

**Implementation Notes:**
- Оформить `pf-roles/SKILL.md` строго по образцу `pf-git`/`pf-size-tiers`:
  фронтматтер с `description: ... Not normally invoked directly.`, вступление
  «это reference-данные, не команда», единая точка определения — остальные
  скиллы ссылаются, не переопределяют.
- Содержимое `pf-roles/SKILL.md`, один в один по `specs.md` §11:
  - схема `roles:`/`profile:` в `prompt.md` (specs.md §2, с примером);
  - схема `agents.yml`/`role-profiles.yml` (specs.md §3, §4, включая
    обработку `kind: human` — явная ошибка вида "actor '<name>' is kind:
    human — not supported until 20260806-improve-project-explorer-redesign",
    не необработанное исключение, см. §3);
  - полный порядок fallback резолвинга роли для стадии `<key>`, все пять
    уровней, от высшего приоритета к низшему (specs.md §1.4, §8):
    1. явная точечная запись `roles.<key>` в `prompt.md` — высший приоритет;
    2. точечная запись выбранного профиля для `<key>` в
       `role-profiles.yml`;
    3. tier-дефолт `skip` для `user_docs`/`dev_docs` при
       `size_tier: trivial`/`small` (только для этих двух ключей) —
       проверяется раньше `default`-записи профиля, а не после неё: иначе
       ни один из трёх дефолтных профилей никогда не отдаёт `skip` для
       этих ключей, потому что generic `default` каждого профиля матчит
       первым (см. specs.md §1.4 за полным обоснованием);
    4. `default`-запись выбранного профиля (только если уровни 1–3 не
       сработали);
    5. общий дефолт `write: claude, review: [claude]` — если у issue нет
       ни `roles:`, ни `profile:` вовсе.
  - автомиграция `reviewers:` → `roles:` (specs.md §5, детерминированное
    правило конверсии, таблица `both` → `[claude, codex]`) — конверсия
    покрывает **каждый ключ, реально присутствующий** в старом
    `reviewers:` данной issue, не фиксированный список из пяти-шести
    имён; в частности покрывает `analysis` (bug-type) и `notes`
    (trivial-tier) наравне с `brd`/`specs`/`test_plan`/
    `implementation_plan`/`code` — оба этих ключа уже используются
    сегодняшним `reviewers:` (см. `skills/pf/SKILL.md`'s
    reviewer-assignment guard для `analysis`, `skills/pf-brd/SKILL.md`'s
    — для `notes`), и без явного упоминания легко реализовать миграцию
    как перебор жёстко перечисленного подмножества ключей, молча теряя
    `reviewers.analysis`/`reviewers.notes` при удалении старого блока;
  - механика `sequential`-режима ревью (specs.md §7.2);
  - **форма write-инвокации акторов** — здесь, а не в `pf-check`: `invoke:
    codex-companion` для write-операций означает `node
    "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task "<prompt>"
    --write`, тот же скрипт и та же форма вызова (`task ... --write`), что
    `codex-cli-runtime/SKILL.md` документирует для
    `codex:codex-rescue` (проверено чтением этого файла в плагине
    `openai-codex`) — вызывается напрямую из `Bash`, не через
    `codex:codex-rescue` (тот субагент — чистый форвардер
    пользовательских rescue-запросов). **Разделение ответственности**: форма
    **review**-инвокации Codex (`codex-companion.mjs review --wait --scope
    ...`) остаётся канонической в `pf-check`'s «Codex invocation chain»
    (эта секция там уже помечена канонической и на неё уже ссылается
    `pf-codereview`) — `pf-roles` не копирует и не переопределяет её, только
    ссылается по имени. Форма **write**-инвокации — новая, и её единственное
    определение — здесь, в `pf-roles`; задачи 3/4/5 ссылаются на неё, не
    описывают повторно. Это тот же принцип, что уже защитил `pf-check`/
    `pf-codereview` от расхождения по severity-mapping — не позволить пяти
    потребителям (`pf-brd`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`,
    `pf-execute`) обрасти пятью независимыми копиями строки `task ... --write`.
  - **Синхронный vs асинхронный write-вызов (specs.md §3):** синхронный
    `task ... --write` рискует упереться в таймаут Bash-тула (2 минуты по
    умолчанию, до 10 при явном увеличении) на крупной генерации. Документ
    должен зафиксировать выбор по объёму: мелкая/точечная правка (fix
    существующего файла, простая 1-2-файловая задача) — синхронный вызов
    как сегодня; генерация документа с нуля или нетривиальная
    implementation-задача — асинхронный путь `task ... --write
    --background` + опрос через `codex-companion.mjs status`/`result`
    (существующие подкоманды скрипта, не переизобретаются заново).
  - **`code: skip` целиком — явная ошибка, не unhandled exception
    (specs.md §2):** резолвер обязан останавливаться понятным сообщением
    при попытке пропустить авторство кода целиком (не `code.review:
    skip`) — тем же принципом, что и `kind: human` ниже, но для другого
    условия ошибки.
  - создание `agents.yml`/`role-profiles.yml` при первом обращении без
    вопроса пользователю (specs.md §3, §4: «любой `pf-*` скилл, которому
    нужен резолвинг актора, создаёт его один раз со стандартным набором»).
  - **Инвариант «не кэшировать»**: явно зафиксировать текстом, что резолвинг
    роли выполняется заново при каждом обращении к `prompt.md` — ни один
    `pf-*` скилл не хранит результат резолвинга между вызовами. Это то, что
    делает TC-008 (смена профиля/ролей посреди пайплайна подхватывается со
    следующего запуска) корректным без отдельного кода для инвалидации кэша,
    т.к. кэша просто нет.
- Резолвер обязан явно завершаться понятной ошибкой на `kind: human`, а не
  падать необработанным исключением — сформулировать инструкцию так, чтобы
  это читалось как императив к любому скиллу, вызывающему резолвинг (TC-020).

**Acceptance Criteria:**
- [x] TC-006 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")
- [x] TC-008 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")
- [x] TC-009 — verified (see test_plan.md Status Tracker)
- [x] TC-019 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")
- [x] TC-020 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")

---

#### Task 2: Автомиграция, вопрос профиля и подтверждение `code.review: skip` в `/pf`

**Mapped Test Cases:** TC-007, TC-010, TC-016

**Files:**
- `skills/pf/SKILL.md` — модифицировать: Step 2 (автомиграция), «Creating
  prompt.md» (третий вопрос — профиль), reviewer-assignment guard (снятие
  для bug-issue с уже заданным `profile:`), подтверждение `code.review: skip`,
  write-делегирование для инлайновой записи `analysis.md` (bug workflow,
  "CREATE only" строка)
- `skills/pf-brd/SKILL.md` — модифицировать: тот же guard для feat/improve/
  trivial; ветка `size_tier: trivial` резолвит роль по ключу `notes`

**Implementation Notes:**
- **Автомиграция (specs.md §5)** — вставить как общий шаг в `pf/SKILL.md`
  Step 2, как часть самого сканирования `docs/issues/open/`, до Step 3
  (issue picker) и до Step 4, для каждой открытой issue с `reviewers:`, но
  без `roles:` — обходит все найденные issue, а не только ту, что в итоге
  выберет пользователь на Step 3. Конверсия детерминирована, без вопросов
  пользователю; покрывает каждый ключ, реально присутствующий в
  `reviewers:` (включая `analysis`/`notes`, не только пятёрку
  планировочных ключей — см. Task 1); старый блок `reviewers:` удаляется
  целиком (не остаётся рядом). Правка `prompt.md` — не отдельный коммит, а
  часть staged-путей следующего шага пайплайна, который пишет в эту issue
  (специально проговорить, что `pf/SKILL.md` сам по себе ничего не
  коммитит на этом шаге — коммит произойдёт там, где и раньше; см. Task 6
  для соответствующей правки таблицы Step 1 в `pf-git`).
- **`analysis.md` (bug-type) и `notes.md` (trivial-tier) — те же
  write-делегирование, что и planning-документы (specs.md §6b):**
  - `pf/SKILL.md`'s bug workflow строка "CREATE only (no complete
    analysis.md)" сегодня пишет `analysis.md` инлайн, без делегирования.
    Перед записью — тот же шаг "Resolve role" (Task 1), но для ключа
    `analysis`: если `write == claude`, без изменений; если нет — сессия
    сама доводит уточняющий диалог, затем делегирует запись файла
    write-инвокатору актора (Task 1), после возврата читает файл с диска и
    продолжает существующую реконфирмацию `size_tier`.
  - `pf-brd/SKILL.md`'s ветка "If `size_tier: trivial`" (пишет
    `notes.md`) резолвит роль по ключу `notes`, **не** `brd` — `notes.md`
    заменяет `brd`/`specs`/`implementation_plan` (и, для bug, `analysis`)
    целиком, поэтому у него отдельный ключ роли, независимый от
    `roles.brd`. Тот же паттерн write-делегирования Task 3 описывает для
    `pf-brd`'s non-trivial ветки, применённый здесь к ключу `notes`.
- **Вопрос профиля (specs.md §4.1)** — в «Creating prompt.md», сразу после
  вопроса про `size_tier`, третий вопрос через `AskUserQuestion`: «Какой
  профиль ролей использовать?», варианты — имена профилей из
  `docs/planning/role-profiles.yml` (созданного/прочитанного Task 1),
  `solo-claude` рекомендован как «сегодняшнее поведение». Ответ — в
  `profile:` рядом с `size_tier`.
- **Снятие reviewer-assignment guard** — этот guard существует в двух
  местах сегодня, оба нужно тронуть, иначе TC-007 упадёт именно на том
  пути, который он проверяет:
  - `pf/SKILL.md`, «Reviewer-assignment guard» (строки, покрывающие
    non-trivial bug-issue) — не задавать вопрос, если у issue уже есть
    `profile:`;
  - `pf-brd/SKILL.md`, «Reviewer-assignment guard» (покрывает feat/improve
    и все trivial-issue, включая bug при trivial) — тот же принцип: не
    задавать вопрос, если `profile:` уже есть.
  Guard продолжает существовать как единственный автомиграционный путь для
  issue, у которых нет ни `profile:`, ни `roles:` (совсем старые issue,
  созданные до этой фичи) — не удалять его текст, только оборачивать
  условием «если `profile:` уже задан — пропустить».
- **`code.review: skip` — подтверждение через `/pf` (specs.md §2, п.1)** —
  когда `/pf` обнаруживает `roles.code.review: skip` без `confirmed:` рядом
  (при создании issue или при следующем запуске `/pf` после ручной правки),
  задать через `AskUserQuestion`: «Ревью кода для этой issue отключено —
  подтвердить?». При «да» — записать `confirmed: <сегодняшняя дата>` рядом
  с `roles.code.review: skip` в frontmatter `prompt.md`, форма записи как в
  `specs.md` §2 (`code: { write: claude, review: skip, confirmed:
  <дата> }`). `pf-codereview` (Task 4) задаёт тот же вопрос самостоятельно,
  если этот шаг был обойдён (прямой вызов в обход `/pf`) — не дублировать
  текст между скиллами, `pf-roles`-документ (Task 1) уже описывает форму
  записи; здесь — только момент и место срабатывания вопроса.
- Все правки в `pf/SKILL.md`/`pf-brd/SKILL.md` ссылаются на алгоритм
  резолвинга и схему из `skills/pf-roles/SKILL.md` (Task 1), не переопределяют
  его текстом на месте.

**Acceptance Criteria:**
- [x] TC-007 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")
- [x] TC-010 — verified (see test_plan.md Status Tracker)
- [x] TC-016 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")

---

#### Task 3: Write-делегирование в `pf-brd`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`

**Mapped Test Cases:** TC-001, TC-002, TC-003

**Files:**
- `skills/pf-brd/SKILL.md` — модифицировать
- `skills/pf-spec/SKILL.md` — модифицировать (включая уточнение к
  1500-строчному split)
- `skills/pf-test-plan/SKILL.md` — модифицировать
- `skills/pf-impl-plan/SKILL.md` — модифицировать

**Implementation Notes:**
- Единый паттерн для всех четырёх скиллов (specs.md §6.1), вставляется как
  шаг перед записью документа:
  1. Resolve role для `<key>` (ссылка на `pf-roles/SKILL.md`, Task 1) →
     получить `write`.
  2. Если `write == claude` — поведение не меняется: сегодняшний путь
     (оркестрирующая сессия сама ведёт `AskUserQuestion`-цикл и пишет файл
     напрямую, без диспетчеризации сабагента).
  3. Если `write != claude` (в этой issue — только `codex`):
     `AskUserQuestion`-цикл уточняющих вопросов **всё равно ведёт
     оркестрирующая сессия** (субагенты не умеют звать `AskUserQuestion`).
     После достижения ~95% уверенности сессия формирует единый текстовый
     промпт (шаблон — specs.md §6.2: путь к документу + содержимое
     `prompt.md` + предыдущие документы пайплайна + сжатая выжимка
     уточнённых требований + `doc_language` + структура секций для этого
     документа и tier) и вызывает write-инвокатор актора, определённый в
     Task 1 (`pf-roles/SKILL.md`) — не переопределяет форму вызова на
     месте. Актору передаётся путь целевого файла; актор редактирует/создаёт
     файл сам, скилл не парсит stdout как содержимое документа. После
     возврата — скилл читает получившийся файл с диска и продолжает
     сегодняшний post-processing без изменений (для `pf-brd` — tier
     reconfirmation; для `pf-spec` — split-at-1500-lines и т.д.).
- **`pf-spec`'s 1500-строчный split (specs.md §6.3):** при `write: codex`
  разбиение на index + 3 части выполняет тот же actor тем же вызовом
  (инструкция про лимит — часть единого промпта), не отдельной
  пост-обработкой со стороны Claude.
- **`pf-impl-plan`'s шаблон задачи — новое поле `Task Type` (specs.md
  §6.4):** сразу после заголовка каждой задачи ("Step 2: Create Task
  Breakdown") добавить `**Task Type:** code | tests | docs`. `pf-execute`
  (Task 5) резолвит `roles.code` для задач `code` и `roles.tests` для
  задач `tests` именно по этому полю — без него разбиение по типу задачи
  остаётся интерпретацией модели, которую TC-012/TC-013 не могут
  проверить детерминированно. Сабагент, которому `pf-impl-plan`
  делегирует написание плана, обязан проставлять поле для каждой задачи.
- Ключи `roles:` для планировочных документов совпадают с сегодняшними
  ключами `reviewers:` (specs.md §0): `brd`, `specs`, `test_plan`,
  `implementation_plan`, `code` — короткий алиас `impl_plan` из черновика
  `prompt.md` не используется нигде в реализации.
- Резолвинг роли выполняется заново при каждом запуске скилла (без
  кэширования, см. Task 1) — сама по себе эта задача ничего не кэширует,
  просто читает `prompt.md` каждый раз, как и остальные шаги скилла.
- Не вводить проверку «write отличается от review» — любая комбинация,
  включая полное совпадение, принимается без предупреждений (BRD
  Non-Goals; TC-001 напрямую проверяет это на `{write: codex, review:
  [codex]}`).

**Acceptance Criteria:**
- [x] TC-001 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")
- [x] TC-002 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")
- [x] TC-003 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")

---

#### Task 4: `pf-check`/`pf-codereview` — источник роли, sequential-режим, автомиграция как предусловие, `code.review: skip`

**Mapped Test Cases:** TC-004, TC-005, TC-011, TC-017

**Files:**
- `skills/pf-check/SKILL.md` — модифицировать
- `skills/pf-codereview/SKILL.md` — модифицировать
- `skills/pf-test/SKILL.md` — модифицировать (prerequisite-проверка
  принимает `verdict: SKIPPED` наравне с `verdict: PASS`)

**Implementation Notes:**
- **Источник роли (specs.md §7.1):** заменить резолвинг «Reviewer
  selection» в `pf-check` (и «Phase 2: Reviewer Selection» в `pf-codereview`)
  с `reviewers.<key>` (одно значение `claude`/`codex`/`both`) на
  `roles.<key>.review` (список + `mode`). Таблица отображения старого на
  новое поведение — дословно из specs.md §7.1: `claude`/отсутствие →
  `{mode: parallel, by: [claude]}`; `codex` → `{mode: parallel, by:
  [codex]}`; `both` → `{mode: parallel, by: [claude, codex]}`.
  `parallel`-режим с `by: [claude, codex]` — сегодняшняя `both`-агрегация
  без изменений (TC-004).
- **Sequential-режим (specs.md §7.2):** ревьюеры из `by` идут по порядку.
  После каждого ревьюера, кроме последнего: (1) findings передаются актору
  `write` этой стадии (Resolve role через `pf-roles`) тем же путём, что
  сегодняшний «Fix now» — диспетч на write-актора с P0/P1 findings,
  **автоматическое применение, без промежуточного вопроса пользователю**;
  (2) целевой документ перечитывается с диска; (3) следующий ревьюер в
  `by` получает уже исправленную версию как TARGET. Финальный отчёт
  перечисляет находки каждого ревьюера отдельным блоком с меткой
  `[<actor>, pass N]`, включая уже исправленные находки с пометкой `(fixed
  before next reviewer)` (TC-005).
- **Снятие абсолютного запрета «fix-сабагент — всегда Claude»:** и в
  `pf-check` («If "Fix now": dispatch a second sub-agent... This fix
  sub-agent is always Claude, never Codex...»), и в `pf-codereview` (то же
  в Phase 4 и в Important Notes) — переписать: fix-диспетч (и интерактивный
  «Fix now», и автоматический межпроходный шаг sequential-режима) идёт на
  **резолвленного write-актора этой стадии** через `pf-roles` — Claude,
  если `write: claude` (диспетч Claude-сабагента, как сегодня), либо
  write-инвокатор актора из `agents.yml`/`pf-roles` (Task 1), если
  `write` — другой актор. Это осознанное изменение поведения по BRD
  Non-Goals (инвариант независимости write/review не вводится) — старый
  текст был правильным до этой issue и должен быть заменён, а не дополнен
  рядом с новым, иначе скилл во время реального прогона следует более
  категоричной старой формулировке.
- **Собственное предусловие автомиграции (specs.md §7.0):** оба скилла не
  полагаются на то, что `/pf` уже мигрировал issue. Каждый сам выполняет ту
  же автомиграционную проверку (Task 2 / `pf-roles`, Task 1) как первый шаг
  — до резолвинга `roles.<key>` — на случай прямого вызова в обход `/pf`
  (включая из `/pf-autopilot`) (TC-011).
- **`code.review: skip` (specs.md §7.3, только `pf-codereview`):** перед
  запуском ревью проверить наличие `confirmed:` рядом с
  `roles.code.review == skip`. Если есть — ревью не запускается, сразу
  вердикт. Если нет (skip попал в `prompt.md` в обход `/pf`) —
  `pf-codereview` сам задаёт тот же вопрос через `AskUserQuestion`, что
  иначе задал бы `/pf` (Task 2), и при «да» сам записывает `confirmed:
  <дата>`. В обоих случаях — не запускать ревью, записать в
  `code_review.md` `verdict: SKIPPED (roles.code.review: skip, confirmed
  <дата>)`, не блокировать переход к `/pf-test` (TC-017).
- **`pf-test`'s предусловие (specs.md §7.3, последний абзац):** сегодня
  `skills/pf-test/SKILL.md` требует `code_review.md`'s `verdict:`
  буквально `PASS`, что блокирует `/pf-test` даже при `verdict: SKIPPED`
  — то есть `code.review: skip`, задуманный как не блокирующий переход,
  на практике всё равно блокировал бы его на следующем шаге. Правка:
  предусловие принимает `PASS` **или** `SKIPPED`; сообщение об остановке
  для `FAIL`/отсутствующего файла не меняется (TC-017, косвенно).
- Fix-диспетч на non-Claude write-актора (и «Fix now», и межпроходный шаг
  sequential-режима) использует форму промпта «примени находки к
  существующему файлу», зафиксированную в specs.md §7.2 — не
  «напиши документ с нуля» (specs.md §6.2).
- Severity→priority mapping и Codex review-инвокация (не write!) остаются
  каноническими в `pf-check`, `pf-codereview` продолжает на них ссылаться —
  не трогать эти секции, кроме смены источника роли выше.

**Acceptance Criteria:**
- [x] TC-004 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")
- [x] TC-005 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")
- [x] TC-011 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")
- [x] TC-017 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")

---

#### Task 5: `pf-execute` — делегирование задачи write-актору на уровне отдельной задачи

**Mapped Test Cases:** TC-012, TC-013

**Files:**
- `skills/pf-execute/SKILL.md` — модифицировать

**Implementation Notes:**
- Тем же паттерном «resolve role», что Task 3 описывает для планировочных
  документов, но на уровне отдельной задачи implementation plan, а не
  документа целиком (specs.md §6a). Перед выполнением каждой задачи:
  1. Resolve role для `code` (а для задач с `Task Type: tests`, см. Task 3
     — для `tests`) → получить `write` для этой конкретной задачи.
  2. Если `write == claude` — без изменений: сегодняшний диспетч
     Claude-сабагента через `Agent` tool (TC-013 — регрессии нет).
  3. Если `write != claude` (в этой issue — только `codex`) — вызвать
     write-инвокатор актора из Task 1/`pf-roles` (`codex-companion.mjs task
     "<prompt>" --write`). Промпт формируется из описания задачи,
     релевантного среза implementation plan (эта задача + её ближайший
     контекст) и контекста репозитория — нацелен на тот же файл/область,
     что получил бы Claude-сабагент для этой же задачи (TC-012).
- **Обход проблемы `TaskGet`/`TaskUpdate` (см. `prompt.md`, «Учесть при
  реализации», и `20260806-improve-codereview-convergence` п.7):** сегодня
  Phase 2 «For Each Task» предписывает Claude-сабагенту самому вызывать
  `TaskGet` первым действием и `TaskUpdate` последним. Delegated-актор
  (Codex через `codex-companion.mjs`) — не Claude-сабагент и не имеет
  доступа к этим тулам framework'а вовсе, а не только «недоступны из
  контекста субагента». Поэтому для write != claude веток задачи:
  оркестрирующая сессия `pf-execute` сама читает описание задачи (через
  `TaskGet`, доступный ей как оркестратору) **до** вызова актора и сама
  помечает задачу выполненной (`TaskUpdate`) **после** возврата вызова,
  разбирая факт записи по результату команды/самому файлу — не полагаясь
  на то, что делегированный актор сообщит о завершении через
  `TaskUpdate`. Явно зафиксировать текстом, что это не тот же канал,
  который сегодня ломается для Claude-сабагентов — эта issue не чинит
  существующий путь `write: claude`, только не наследует его поломку в
  новом.
- **Конкурентность внутри волны (specs.md §6a):** сегодня Claude-сабагенты
  волны запускаются параллельно через `Agent` tool и сами не коммитят — во
  избежание гонки за рабочее дерево коммитит только оркестратор на границе
  волны. Codex-делегированные (`--write`) задачи идут другим,
  синхронным каналом (`Bash`), чья совместная безопасность с параллельными
  `Agent`-вызовами не проверена. Упрощение на время этой issue:
  Codex-делегированные задачи волны выполняются **последовательно, после**
  завершения всех Claude-сабагентов этой волны, и **до** коммита
  оркестратора на границе волны — не одновременно с ними. Зафиксировать
  текстом как временное упрощение, не постоянное ограничение.
- **Волновая/коммитная структура не меняется** (specs.md §6a, последний
  абзац): `git add -A` на границе волны (см. `pf-git`) коммитит фактически
  записанное актором, независимо от того, кто им был — не отдельный коммит
  на факт делегирования.
- Не вводить проверку независимости write/review здесь — код,
  реализованный Codex, может ревьюиться в том числе Codex, если так
  сконфигурировано (см. Task 4, BRD Non-Goals).

**Acceptance Criteria:**
- [x] TC-012 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")
- [x] TC-013 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")

---

#### Task 6: Новые опциональные стадии `pf-user-docs`/`pf-dev-docs` и изменения `pf-qa`

**Mapped Test Cases:** TC-015, TC-018

**Files:**
- `skills/pf-user-docs/SKILL.md` — новый
- `skills/pf-dev-docs/SKILL.md` — новый
- `skills/pf-qa/SKILL.md` — модифицировать
- `skills/pf-git/SKILL.md` — модифицировать (новые строки в таблицах Step
  1/Step 2)

**Implementation Notes:**
- Оба новых скилла — тонкие обёртки вокруг паттерна Task 3 (resolve role →
  write напрямую или делегирование актору → review по
  `roles.<key>.review`, включая sequential-режим из Task 4), применённого
  к новым типам артефактов (specs.md §8):
  - `pf-user-docs` → `docs/issues/open/<ID>/user_docs.md` (или правки в
    README/CHANGELOG проекта — конкретную цель определяет содержимое
    issue);
  - `pf-dev-docs` → `docs/issues/open/<ID>/dev_docs.md` (архитектура, ADR,
    runbook, деплой).
  Ключи `roles:` — `user_docs`, `dev_docs`. Если резолвленная роль — `skip`
  (явно, через профиль, или через tier-дефолт из Task 1 для
  `trivial`/`small`) — скилл, вызванный напрямую, сообщает, что стадия
  объявлена пропущенной, и ничего не пишет.
- **`pf-qa` prerequisite (specs.md §9, п.1):** расширить проверку —
  помимо `manual_test_checklist.md`, для каждой из `user_docs`/`dev_docs`,
  которая **не** `skip` (резолвинг через `pf-roles`), требуется
  существующий и непустой `user_docs.md`/`dev_docs.md`; при отсутствии —
  то же поведение, что сегодня для отсутствующего
  `manual_test_checklist.md` ("<Stage> is not complete. Run
  /pf-user-docs first.", аналогично для dev-docs) (TC-015).
- **`pf-qa` строка риска (specs.md §9, п.2):** безусловно добавлять в
  `qa_report.md`, когда `roles.code.review == skip` для issue:
  ```
  ⚠ Risk: code review was skipped for this issue (roles.code.review: skip,
  confirmed <дата>). No independent review of the implementation exists.
  ```
  Строка не блокирует `PASS`-вердикт сама по себе — информационная, как и
  остальные риск-строки (TC-018).
- **`pf-git` новые строки:** в таблице Step 1 (staging) добавить `/pf-user-
  docs` → `docs/issues/open/<ISSUE-ID>/user_docs.md`, `/pf-dev-docs` →
  `docs/issues/open/<ISSUE-ID>/dev_docs.md`; в таблице Step 2 (commit
  message) — `docs: user_docs.md for <ISSUE-ID>` / `docs: dev_docs.md for
  <ISSUE-ID>`, по образцу существующих строк для `/pf-brd`/`/pf-spec`. Без
  этих строк оба новых скилла ссылаются на процедуру, в которой нет записи
  для них.
- **`pf-git` Step 1 — owning the automigration `prompt.md` edit
  (specs.md §5, последний абзац):** автомиграция `reviewers:` → `roles:`
  (Task 2) не коммитится отдельно — её правка `prompt.md` должна попасть в
  staged-пути той стадии, что первой пишет в issue после автомиграции.
  Сегодняшняя таблица Step 1 несёт условие «+ `prompt.md`, если
  `size_tier` изменился» только у строк `/pf-brd`/`/pf-test-plan` — этого
  недостаточно: если следующая после автомиграции стадия не меняет
  `size_tier`, правка `prompt.md` остаётся незастейдженной и никем не
  заявленной, всплывая много позже как dirty-tree failure на `/pf-qa`, вне
  связи с реальной причиной. Добавить **у каждой** строки таблицы Step 1
  квалификатор «(+ `prompt.md`, если автомиграция сработала в этом же
  прогоне)», рядом с существующими `size_tier`-квалификаторами, а не
  вместо них — какая бы стадия ни оказалась первой после автомиграции,
  именно она стейджит эту правку вместе со своим артефактом.
- Каждый из двух скиллов заканчивается тем же «Close the stage: commit &
  push» — ссылкой на `pf-git/SKILL.md`, не переопределением процедуры на
  месте (тот же принцип, что у всех остальных `pf-*` скиллов).

**Acceptance Criteria:**
- [x] TC-015 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")
- [x] TC-018 — implemented; descoped from formal manual testing by owner decision (see test_plan.md "Scope decision")

---

#### Task 7: Маршрутизация пайплайна — `pf/SKILL.md` и `pf-size-tiers`

**Mapped Test Cases:** TC-014

**Files:**
- `skills/pf/SKILL.md` — модифицировать (Step 5, Step 6 — feat/improve/bug
  таблицы)
- `skills/pf-size-tiers/SKILL.md` — модифицировать (таблица «Pipelines»,
  список документов в «Scope»)

**Implementation Notes:**
- Эта задача логически продолжает Task 6 и должна выполняться сразу следом
  в той же сессии/волне — маршрутизация на скилл, которого ещё нет,
  бессмысленна, а новый скилл без маршрутизации к нему недостижим через
  обычный путь `/pf`.
- **`pf-size-tiers` — таблица «Pipelines — what preceding stage means»**
  (specs.md §1.5): вставить `user_docs`/`dev_docs` между TESTING и QA во
  всех применимых пайплайнах (feat/improve/bug — не в
  `size_tier: trivial`, где документация по умолчанию пропущена, но запись
  всё равно должна присутствовать как формально пропускаемая, а не
  отсутствующая стадия). Обновить список документов раздела «Scope»,
  добавив `user_docs.md`/`dev_docs.md` к перечню `prompt.md`, `notes.md`,
  `brd.md` и т.д. — без этого рекурсивное определение «стадия завершена»
  (на котором держится вся логика «первая незавершённая стадия governs» в
  `pf/SKILL.md`) не будет знать об этих двух стадиях, и они не попадут в
  расчёт «первой незавершённой стадии».
- **`pf/SKILL.md` Step 5 (детект завершённых стадий):** добавить строки
  `user_docs`/`dev_docs` в таблицу соответствия «документ → стадия», между
  TESTING и QA.
- **`pf/SKILL.md` Step 6 (feat/improve/bug таблицы):** между строкой
  TESTING и строкой QA добавить `user_docs`/`dev_docs`, с тем же принципом
  «первая незавершённая стадия governs». Пропущенные (`skip`) стадии
  считаются завершёнными для целей маршрутизации — переход идёт сразу к
  следующей незавершённой стадии, не останавливаясь на пропущенной.
- **Отображение пропуска (specs.md §8):** в статусном блоке Step 7 (список
  Completed stages) пропущенная стадия показывается как `skipped
  (roles.user_docs: skip)` (или `roles.dev_docs: skip`) — не как
  выполненная и не как следующий шаг (TC-014 проверяет это дословным
  grep-паттерном на `skipped.*roles\.(user_docs|dev_docs)`).
- Это последняя задача плана: после неё вся матрица ролей end-to-end
  подключена к обычному пути `/pf` для issue любого типа/tier.

**Acceptance Criteria:**
- [x] TC-014 — verified (see test_plan.md Status Tracker)

### Dependencies

Порядок задач — не произвольная нумерация, а цепочка реальных зависимостей:

- **Task 1 блокирует всё остальное.** Каждая из задач 2–7 формулируется как
  «Resolve role через `pf-roles`» — не переопределяет алгоритм резолвинга
  или форму write-инвокации на месте. Пока `pf-roles/SKILL.md`,
  `agents.yml` и `role-profiles.yml` не существуют, ни одна ссылка на них
  не имеет смысла.
- **Task 2 логически предшествует Task 4** (обе стороны автомиграции
  должны появиться до того, как имеет смысл проверять её «собственное
  предусловие» в `pf-check`/`pf-codereview`, TC-011), но не является для
  Task 4 жёстким техническим блокером — `pf-check`/`pf-codereview` несут
  собственную копию автомиграционной проверки именно на случай, если
  `/pf` её не выполнил. Порядок 2 → 4 в этом плане — для тестируемости
  TC-010 и TC-011 по отдельности, не потому что одна не скомпилируется без
  другой.
- **Task 3 и Task 5 обе строятся на форме write-инвокации из Task 1** —
  независимы друг от друга (планировочные документы vs. код), могут
  выполняться в любом относительном порядке после Task 1, но обе — после
  Task 1.
- **Task 4 логически следует за Task 3**, потому что sequential-режим
  (specs.md §7.2) передаёт findings write-актору стадии — тому же
  делегированию, что Task 3 вводит для планировочных документов.
- **Task 6 и Task 7 — единый прирост функциональности**, разделённый на
  две задачи только по типу файлов (новые скиллы + `pf-qa`/`pf-git` в
  Task 6; маршрутизация в `pf/SKILL.md`/`pf-size-tiers` в Task 7). Их
  следует выполнять подряд, в одной сессии — маршрут на несуществующий
  скилл и скилл без маршрута к нему — оба states бессмысленны по
  отдельности, хотя формально не блокируют компиляцию друг друга.

**Внешние зависимости:**
- Плагин `codex` (`openai-codex`) — проверено в рамках подготовки этого
  плана: `codex-companion.mjs` присутствует и по адресу
  `~/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/
  codex-companion.mjs`, и в marketplace-копии; `codex-cli-runtime/SKILL.md`
  подтверждает форму `task "<prompt>" --write`, которую Task 1 фиксирует
  как write-инвокацию. Доступность плагина не гарантирована на каждой
  машине — TC-005, TC-012, TC-017 (тест-план) уже помечены как
  требующие Codex CLI и помечаются blocked, если его нет, а не
  пройденными/непройденными.
- `make update-skills` (или `/pf-update`) должен быть прогнан после
  выполнения всех семи задач и до прогона Manual TC — тест-план требует
  синхронизированные установленные копии в своих Prerequisites.

### Complexity Estimate

**Complex (6+ tasks).** Семь задач, каждая — цельная единица работы одной
сессии: новый реестр+профили+reference-скилл (1), правки оркестратора (1),
единый паттерн, применённый к четырём скиллам разом (1), парная правка двух
review-скиллов с общей логикой (1), одна точечная правка исполнения (1),
два новых скилла плюс их подключение к QA/git (1), финальная маршрутизация
(1). Оценка отражает фактический охват specs.md — 12 секций плюс §6a и
§7.0, одиннадцать скиллов, ссылающихся на новый `pf-roles`, два ранее не
упомянутых в specs.md файла (`pf-git`, `pf-size-tiers`), найденных при
чтении текущего состояния репозитория — а не искусственно раздута ради
числа задач.
