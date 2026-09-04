# Test Plan: Стадия идеи (idea/spike issue types)

**Date:** 2026-09-02
**Size tier:** large
**Satisfies:** brd.md US-01 — US-13, specs.md / specs-part1.md / specs-part2.md / specs-part3.md

## Overview

Эта фича не имеет собственного UI — весь новый функционал (два новых типа
issue, семь новых скиллов, дополнительные ветки в семи существующих) живёт
как текст `SKILL.md`-файлов и скриптов, интерпретируемый LLM-агентом во
время реального прогона `/pf`/`/pf-check`/`/pf-close`/`/pf-autopilot` и т.д.
"UI" в широком смысле — это формулировки вопросов `AskUserQuestion` и
структура генерируемых markdown-документов; отдельного раздела UI/UX в этом
плане нет, соответствующие проверки — часть Functional/Validation ниже.

Как и у структурно близкого `20260806-feat-role-matrix`, у плана два рода
проверок:

- **Auto** — детерминированные grep/sed-проверки формы и порядка инструкций
  внутри skill-файлов (drift guards, тот же стиль, что уже применяет
  `test/skills-static.sh`), и **поведенческие/fixture-based** тесты
  (throwaway git-репозиторий, транскрипция проверяемой логики в bash, assert
  на реальный результат в файловой системе/git-истории — тот же паттерн, что
  `test/pf-close.sh`/`test/converge-fresh.sh`). Оба вида воспроизводимы
  прогоном автоматического набора без участия LLM.
- **Manual** — реальный прогон соответствующего `pf-idea-*` скилла живой
  Claude Code сессией (в одном случае — с реальным вызовом Codex через
  `codex-companion.mjs`), где предметом проверки является поведение самой
  LLM-сессии (структурированный вопрос, независимость параллельных
  саб-агентов, суждение живого ревьюера) — то, что механическая
  grep-проверка структурно не может подтвердить.

Цель прогона — подтвердить все 50 Acceptance Criteria `brd.md` (US-01…
US-13): вход через пустую папку с развилкой «идея / сразу проект»;
front-loaded-режим с ровно двумя точками участия человека на idea/spike-issue
(intake и сессия решения / `pf-close`'s Phase 1 для spike); фиксированные
секции и линзы `idea.md` по `idea_tier`; дисциплину «проверено ⇒ есть
источник» в `research.md`; независимую многоперсонную критику; закрытый
словарь вердиктов и единственный человеческий гейт закрытия; корректный
порядок bootstrap+git init+follow-up issue **до** архивации idea; спайк с
гейтом «findings подтверждены реальным прогоном» и веткой, которая никогда
не мерджится и не удаляется; отсутствие изменений в поведении
feat/improve/bug; и требование к ревью — отдельное измерение «совместимость
с Codex».

## Prerequisites

- Реализация по `specs.md`/`specs-part1.md`/`specs-part2.md`/`specs-part3.md`
  завершена: семь новых директорий `skills/pf-idea*`/`skills/pf-interaction`
  существуют; правки в `skills/pf`, `skills/pf-check`, `skills/pf-close`,
  `skills/pf-git`, `skills/pf-autopilot`, `skills/pf-help`, `skills/pf-brd`,
  `skills/pf-update`, `skills/pf-size-tiers`, `skills/pf-roles`,
  `scripts/converge-to-v3.sh` применены; `skills/pf/templates/project/`
  существует; `CLAUDE.md`/`README.md`/`docs/planning/FRAMEWORK.md`/
  `docs/planning/QUICKSTART.md`/`tools/onboarding-tui/lib/tutorial.js`
  обновлены до 28 скиллов.
- Три новых тестовых файла существуют и подключены к `make test` (Makefile
  подхватывает их автоматически, правок Makefile не требуется —
  specs-part3.md §8.4): `test/pf-idea-stage-static.sh`,
  `test/pf-idea-front-loaded-static.sh`, `test/pf-idea-templates-mirror.sh`.
- Новые fixture-каталоги под `test/fixtures/` существуют для
  поведенческих TC (созданы при реализации, по образцу `no-pf-bare`/
  `pf-close-basic`): `test/fixtures/no-pf-bare` (переиспользуется как есть),
  и новые `idea-verdict-project-bare`, `idea-verdict-project-existing`,
  `spike-close-branch`, `spike-close-no-evidence`, `idea-no-size-tier`.
- Рабочее дерево `/home/stac/dev/planning-framework` чистое; тестировщик
  может запускать `/pf`, `/pf-idea*`, `/pf-check`, `/pf-close`,
  `/pf-autopilot` в реальной Claude Code сессии, включая внутри пустой
  временной директории и внутри временной копии существующего PF-проекта.
- Codex CLI и `codex-companion.mjs` доступны и настроены (нужны для
  TC-029) — без них этот один TC не воспроизводим и должен быть помечен
  blocked, а не пройден/провален.
- `git` доступен на `PATH` тестовой машины (нужен и для Auto
  fixture-based TC, и для Manual TC).

### Marker-конвенция для Auto TC (`/pf-test` Phase 3.2/3.3)

Каждый из трёх новых test-файлов несёт файловый заголовок-маркер
`# @pf-issue 20260902-feat-idea-stage` в первых ~10 строках — применяется ко
всем тестам файла, у которых нет собственного построчного маркера. Внутри
каждого файла каждая проверка печатает `pf_pass "TC-0NN: <краткое имя>"` /
`pf_fail "TC-0NN: ..."` — этот литерал и есть label, по которому `/pf-test`
находит TC-ID (тот же паттерн, что уже использует `test/pf-close.sh`).
Ниже, в каждом Auto TC, поле **Test file** называет, в каком из трёх файлов
эта проверка будет жить.

## Test Cases

### Functional: Точки входа и маршрутизация

### TC-001: Семь новых директорий скиллов существуют с валидным фронтматтером
**Description:** Каждая из `skills/pf-idea`, `pf-idea-research`, `pf-idea-critique`, `pf-idea-verdict`, `pf-idea-spike`, `pf-idea-lenses`, `pf-interaction` содержит `SKILL.md` с полями `name:`/`description:`/`version:` — собственный цикл, не переиспользующий `test/skills-static.sh` (тот файл проверяет конкретные stage-completion-гейты, а не структуру произвольного скилла).
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** Репозиторий фреймворка в текущем состоянии реализации.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Для каждой из семи директорий проверить наличие `SKILL.md`. | Файл существует. |
| 2 | Для каждого файла проверить `grep -q '^name:'`, `'^description:'`, `'^version:'`. | Все три поля присутствуют. |

**Test Data:** пути `skills/pf-idea*/SKILL.md`, `skills/pf-interaction/SKILL.md` (репозиторий фреймворка, не фикстура).
**Expected Outcome:** 7/7 директорий проходят проверку; отсутствующий файл/поле — явный `pf_fail` с именем директории.
**Priority:** High

### TC-002: `/pf` — вопрос «идея или сразу проект» в пустой папке
**Description:** `skills/pf/SKILL.md` содержит новый "Step 0: Detect folder state" с вычислением `has_pf`/`has_git`, текстом вопроса «идея / сразу проект» и упоминанием guard'а `has_git` перед git-синком.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Найти заголовок "Step 0" в `skills/pf/SKILL.md`, до "Step 1: Read installed version". | Заголовок присутствует в правильном порядке. |
| 2 | Внутри Step 0 найти подстроки «идея» и «сразу проект» (или их согласованный английский эквивалент, если реализация выберет английский текст вопроса — принять оба). | Обе ветки развилки названы. |
| 3 | Найти упоминание `has_git` рядом с этим Step. | Присутствует. |

**Test Data:** `skills/pf/SKILL.md`.
**Expected Outcome:** Все три assert проходят.
**Priority:** High

### TC-003: Живая сессия `/pf` — пустая папка и существующий проект
**Description:** Реальный прогон `/pf` в по-настоящему пустой директории подтверждает обе ветки развилки на практике (не только текст скилла), а в уже существующем PF-проекте — что созданный этим путём idea-issue распознаётся и маршрутизируется `/pf` наравне с feat/improve/bug при следующем запуске.
**Type:** Manual
**Preconditions:** Свежая пустая директория без `.git`; отдельно — временная копия работающего PF-проекта без открытых issue.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `mkdir proj && cd proj && claude`, выполнить `/pf`. | Вопрос «над чем работаем: идея или сразу проект» задан первым действием, без падения на git-командах. |
| 2 | Ответить «Идея», пройти intake. | На диске появляется только `docs/issues/open/<id>-idea-<slug>/` с `prompt.md`; ни `PLANNING.md`, ни `docs/planning/`, ни `.git` не созданы. |
| 3 | В новой пустой директории повторить `/pf`, ответить «Сразу проект». | `git init` выполнен, каркас PF развёрнут из `~/.claude/skills/pf/templates/project/`, сценарий продолжается как «tell me what you want to build or fix» (теперь — 3/4-вариантный вопрос). |
| 4 | В существующем PF-проекте без открытых issue выполнить `/pf`, выбрать «Describe an idea», пройти intake. | idea-issue создан. |
| 5 | Запустить `/pf` повторно в том же проекте. | Идея-issue распознан в списке открытых issue, показан статус-блок той же формы, что для feat/improve/bug, с корректным Next step. |

**Требуемые данные:** не требуются — сессия работает с реальным `/pf`, без подготовленных файлов.
**Expected Outcome:** Оба сценария проходят end-to-end без ошибок и без нарушения AC-01b (ничего лишнего в bare-папке).
**Priority:** Critical

### TC-004: Not-a-repo guard, «не закоммичено» на каждой стадии без git, семь строк `pf-git`'s Step 1
**Description:** `/pf`'s Step 2 пропускает git-синк целиком, когда `has_git` ложно (вместо каскада `fatal: not a git repository`), и каждая стадия idea/spike-пайплайна (включая CREATE) печатает «Git: not committed — no git repository» вместо обычной git-строки в этом случае — единая точка определения текста в `pf-git`; таблица `pf-git`'s "Step 1: Stage the artifact" несёт семь новых строк (пять пишущих idea/spike-скиллов, но `pf-idea-verdict` считается дважды — режим 1 и режим 2 несут разные пути).
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `skills/pf/SKILL.md`, Step 2, найти предваряющую оговорку про пропуск git-синка при `has_git` ложном. | Присутствует, до п.1 существующего Step 2. |
| 2 | В `skills/pf-git/SKILL.md` найти новый раздел "Step 0: No-repository guard", до "Step 1: Stage the artifact". | Присутствует, содержит литерал `not committed — no git repository`. |
| 3 | В `skills/pf/SKILL.md`, в ветке "Creating prompt.md — idea", найти ту же строку, печатаемую инлайново для CREATE. | Присутствует. |
| 4 | В `skills/pf-git/SKILL.md`, таблице "Step 1: Stage the artifact", посчитать строки для `/pf-idea`, `/pf-idea-research`, `/pf-idea-critique`, `/pf-idea-verdict` [режим 1], `/pf-idea-verdict` [режим 2], `/pf-idea-spike` [режим 1], `/pf-idea-spike` [режим 2]. | Ровно семь строк присутствуют (не шесть) — `pf-idea-verdict` и `pf-idea-spike` дают по две строки каждый. |

**Test Data:** `skills/pf/SKILL.md`, `skills/pf-git/SKILL.md`.
**Expected Outcome:** Все четыре assert проходят; единая формулировка используется во всех местах; таблица Step 1 несёт полный набор из семи строк.
**Priority:** Critical

### TC-005: Существующий проект без открытых issue — четыре варианта
**Description:** Step 3's «No issue folders found» заменён на явный `AskUserQuestion` с четырьмя вариантами (build/fix/idea/spike), и свободный текст, распознанный как технический эксперимент, подтверждается дополнительным вопросом перед созданием `spike` вместо `feat`.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `skills/pf/SKILL.md`, Step 3, найти четыре варианта: build a feature / fix a bug / describe an idea / run a technical spike (или их согласованный русский эквивалент). | Все четыре присутствуют. |
| 2 | Найти текст подтверждающего вопроса «похоже на технический спайк — создать spike-issue вместо фичи?» рядом с обработкой свободного текста ("Other"). | Присутствует. |

**Test Data:** `skills/pf/SKILL.md`.
**Expected Outcome:** Оба assert проходят.
**Priority:** High

### TC-006: Таблица завершённых стадий, маршрутизация Step 6, статус-блок и `pf-help`
**Description:** Step 5's таблица завершённых стадий несёт шесть новых строк документ→стадия (и явно не включает `open_questions.md`); новый абзац Step 6 маршрутизирует idea/spike исключительно на таблицу стадий `pf-idea-lenses/SKILL.md` (решение (A) — таблицы стадий не дублируются в `/pf`) и явно называет исключение "verdict.md content read" (различение VERDICT vs. VERDICT+"## Decision" требует прочитать тело документа, не только его существование/маркер); Step 7's статус-блок использует ту же форму, что у feat/improve/bug, и показывает `/pf-idea-verdict (decision session)` вместо обычной команды в задокументированном состоянии; `pf-help/SKILL.md` описывает оба новых воркфлоу одним абзацем каждый и добавляет две строки в «Issue folder contents» — без требования знать внутренние скиллы заранее.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `skills/pf/SKILL.md`, Step 5, найти шесть строк `idea.md`→IDEA, `research.md`→RESEARCH, …, `findings.md`→FINDINGS. | Все шесть присутствуют; `open_questions.md` не встречается в этой таблице. |
| 2 | В `skills/pf/SKILL.md`, Step 6, перед существующими таблицами найти абзац «idea/spike-пайплайн», ссылающийся на `pf-idea-lenses` по имени («Stage tables»), и явно исключающий feat/improve/bug/trivial-таблицы этого файла для `idea`/`spike`. | Присутствует, синтаксически предшествует остальным таблицам Step 6. |
| 3 | В том же абзаце найти оговорку о том, что различение `VERDICT` vs. `VERDICT` с непустой `## Decision` требует прочитать содержимое `verdict.md`, а не только факт существования файла/маркер `[pf-check ...]`. | Присутствует. |
| 4 | В Step 7 найти литерал `/pf-idea-verdict (decision session)`. | Присутствует. |
| 5 | В `skills/pf-help/SKILL.md` найти блоки `Idea`/`Spike` workflow-диаграмм после "## Workflow by issue type". | Присутствуют, по одному абзацу на тип. |
| 6 | В той же таблице «Issue folder contents» найти две новые строки (`idea`, `spike`). | Присутствуют. |

**Test Data:** `skills/pf/SKILL.md`, `skills/pf-help/SKILL.md`.
**Expected Outcome:** Все шесть assert проходят.
**Priority:** Medium

### TC-007: Intake-батч — переиспользование `doc_language`, лимит вопросов, carve-out для голой папки
**Description:** Intake-путь для `idea`/`spike` переиспользует существующий вопрос `doc_language`, задаёт не более двух `AskUserQuestion`-вызовов по ≤4 вопроса каждый, и в ветке «голая папка без каркаса PF» не задаёт вопросы role assignment/`on_unavailable` (не пишет `roles:`/`profile:`/`on_unavailable:` в `prompt.md`).
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `skills/pf/SKILL.md`, "Creating prompt.md", ветка "idea" найти упоминание переиспользования `doc_language`. | Присутствует. |
| 2 | Найти carve-out «bare folder — role assignment и `on_unavailable` не задаются» рядом с той же веткой. | Присутствует. |
| 3 | Повторить п.1-2 для ветки "spike". | Присутствуют. |

**Test Data:** `skills/pf/SKILL.md`.
**Expected Outcome:** Все assert проходят для обеих веток.
**Priority:** High

### TC-008: `pf-interaction` — правило front-loaded и единственный финальный гейт
**Description:** `skills/pf-interaction/SKILL.md` формулирует правило: взять рекомендацию → записать `[assumed]` в `open_questions.md` → продолжить без паузы; ровно один финальный человеческий гейт на issue (сессия решения для idea, `pf-close`'s Phase 1 для spike); список исключений для idea/spike ограничен одним случаем — установка Codex.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Найти формулировку "Front-loaded rule" в `skills/pf-interaction/SKILL.md`. | Присутствует, содержит шаги «взять рекомендацию» / «записать `[assumed]`» / «продолжить». |
| 2 | Найти утверждение «один финальный человеческий гейт... не два», называющее decision session (idea) и `pf-close`'s Phase 1 (spike). | Присутствует. |
| 3 | Найти раздел про исключения для idea/spike, содержащий ровно один случай (Codex install при полной недоступности CLI/npm), без «списка из четырёх». | Раздел называет ровно этот один случай. |

**Test Data:** `skills/pf-interaction/SKILL.md`.
**Expected Outcome:** Все три assert проходят.
**Priority:** Critical

### TC-009: `idea.md` — фиксированные секции
**Description:** Скелет `idea.md` (в `pf-idea/SKILL.md` или `pf-idea-lenses/SKILL.md`, где бы он ни хранился) несёт ровно семь верхнеуровневых секций в фиксированном порядке; артефакты линз (Lean Canvas, JTBD, SWOT, pre-mortem, TAM/SAM/SOM, Build vs. Buy, Audience/Distribution Fit, 5 почему) вкладываются как подзаголовки внутрь «Lenses Applied», не становятся новыми верхнеуровневыми секциями.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Извлечь список `## `-заголовков из документированного скелета `idea.md`. | Ровно семь: Pain & Evidence, Analogs / Prior Art, Differentiation / USP, MVP, Cost (Effort), Risks, Lenses Applied — в этом порядке. |
| 2 | Проверить, что упоминания конкретных линз-инструментов находятся под уровнем `###`, внутри секции "Lenses Applied", а не как `##`. | Подтверждено. |

**Test Data:** `skills/pf-idea/SKILL.md` и/или `skills/pf-idea-lenses/SKILL.md`.
**Expected Outcome:** Оба assert проходят.
**Priority:** High

### TC-010: `research.md` — дисциплина источников и непроверенные факты в `open_questions.md`
**Description:** Скелет `research.md` несёт колонки `Status`/`Source`; текст `pf-idea-research/SKILL.md` формулирует жёсткий инвариант записи «`проверено` ⇒ `Source` непусто» (скилл никогда не пишет обратную комбинацию); каждая `не проверено`-строка дополнительно копируется в `open_questions.md` как запись со `Status: unverified-fact`, отличная от `assumed`.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В скелете `research.md` найти таблицу `Facts` с колонками `Status`, `Source`. | Присутствуют. |
| 2 | В `skills/pf-idea-research/SKILL.md` найти формулировку инварианта («проверено» ⇒ Source непусто, скилл никогда не пишет обратное). | Присутствует. |
| 3 | В том же файле найти инструкцию копировать каждую непроверенную строку в `open_questions.md` со `Status: unverified-fact`. | Присутствует, статус отличается от `assumed`. |

**Test Data:** `skills/pf-idea-research/SKILL.md`.
**Expected Outcome:** Все три assert проходят.
**Priority:** Critical

### TC-011: `critique.md` — персоны, единый резолв актора, закрытый словарь `Disposition`
**Description:** `pf-idea-critique` диспетчеризует минимум четыре базовые персоны (скептик-инвестор, целевой пользователь, техлид, безопасник) плюс tier-специфичное расширение, все — под одним резолвнутым актором для ключа `critique` (не по одному резолву на персону); Summary Table несёт закрытый трёхзначный словарь `Disposition` (Отвечено / Риск принят / Идея меняется) с обязательным непустым `Reflected in` в каждой строке.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `skills/pf-idea-critique/SKILL.md` найти список из минимум четырёх базовых персон плюс упоминание tier-специфичного расширения через `pf-idea-lenses`. | Присутствуют. |
| 2 | Найти формулировку «актор резолвится один раз для ключа `critique`, персона — не сама точка резолва». | Присутствует. |
| 3 | В скелете `critique.md` найти колонку `Disposition` со значениями `Отвечено`/`Риск принят`/`Идея меняется` и колонку `Reflected in`. | Присутствуют; ровно три значения словаря. |

**Test Data:** `skills/pf-idea-critique/SKILL.md`.
**Expected Outcome:** Все три assert проходят.
**Priority:** High

### TC-012: Живой прогон `pf-idea-critique` — независимость персон
**Description:** Реальный вызов `pf-idea-critique` диспетчеризует каждую требуемую персону как независимый саб-агентный вызов одним сообщением (не последовательно с общим контекстом) и производит действительно различающиеся возражения по персонам, корректно свёрнутые в Summary Table.
**Type:** Manual
**Preconditions:** Завершённые `idea.md`/`research.md` фикстур-issue (`idea_tier: product`, чтобы задействовать полный набор из 6 персон).
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-idea-critique` на фикстур-issue. | Скилл диспетчеризует персоны как независимые `Agent`-вызовы в одном сообщении (наблюдаемо по логу инструментов сессии). |
| 2 | Прочитать записанный `critique.md`. | Каждая персона несёт собственный, содержательно различающийся список возражений (не перефразированные копии друг друга); Summary Table сводит их с диспозициями. |

**Test Data:** `docs/issues/open/zz-fixture-idea-critique/` (`idea.md`, `research.md`, `prompt.md` с `idea_tier: product`, подготовленные заранее).
**Expected Outcome:** Независимость и различимость персон подтверждены визуальным осмотром результата.
**Priority:** High

### TC-013: `verdict.md` — закрытый словарь и содержимое сессии решения
**Description:** Словарь вердиктов — ровно четыре значения (`project`/`spike-first`/`defer`/`archive`), без `incubate-until`; скелет, записанный Режимом 1, не содержит заголовка `## Decision` вовсе (он появляется только как append-блок Режима 2); батч сессии решения показывает рекомендованный вердикт, полный список допущений, полный список открытых вопросов и непроверенных фактов, и предлагает ровно три варианта (подтвердить / выбрать другой / переопределить допущение).
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `skills/pf-idea-lenses/SKILL.md` найти словарь вердиктов. | Ровно `project`, `spike-first`, `defer`, `archive`; строка `incubate-until` отсутствует. |
| 2 | В скелете `verdict.md` (Режим 1) убедиться, что заголовок `## Decision` отсутствует, документ заканчивается на "## Unverified Facts Summary". | Подтверждено. |
| 3 | В `skills/pf-idea-verdict/SKILL.md`, Режим 2, найти формулировку батча с тремя вариантами (подтвердить / другой вердикт / переопределить допущение). | Присутствует, ровно три варианта. |
| 4 | В том же батче найти три отдельные фразы «полный список» — допущений, открытых вопросов, непроверенных фактов (рядом с обоснованием рекомендованного вердикта). | Все три «полный список ...»-упоминания присутствуют, отдельно от простого перечисления вариантов ответа. |

**Test Data:** `skills/pf-idea-lenses/SKILL.md`, `skills/pf-idea-verdict/SKILL.md`.
**Expected Outcome:** Все четыре assert проходят.
**Priority:** Critical

### TC-014: Живой прогон — переопределение допущения в сессии решения
**Description:** Реальное переопределение одной `[assumed]`-записи регенерирует только секции, названные её полем `Used in` (плюс документированный «хвост» пайплайна, если применимо), помечает затронутые документы `[pf-check OPEN]` в `session-log.md`, и повторно показывает сессию решения только после того, как все они снова получили `PASSED`.
**Type:** Manual
**Preconditions:** Полностью пройденная фикстур-idea с записанным `verdict.md`, `/pf-check`'d `PASSED`, и хотя бы одной записью `[assumed]` в `open_questions.md`, чьё `Used in` называет секцию `idea.md`.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-idea-verdict` (Режим 2), выбрать «Переопределить допущение», дать новый ответ. | Регенерируются только названные секции `idea.md` (и последующих документов пайплайна, не раньше самого раннего изменённого) — остальной текст файлов не тронут. |
| 2 | Прочитать `session-log.md`. | Появилась строка `[pf-check OPEN] <файл> — invalidated by override of open_questions.md #<N>` для каждого затронутого документа. |
| 3 | Запустить `/pf-idea-verdict` снова сразу, не прогоняя `/pf-check`. | Сессия решения НЕ показывается повторно; следующий шаг — `/pf-check`. |
| 4 | Прогнать `/pf-check` на все `OPEN`-документы до `PASSED`, затем снова `/pf-idea-verdict`. | Сессия решения показывается заново, с обновлённым вердиктом/списками. |

**Test Data:** `docs/issues/open/zz-fixture-idea-override/` (полный набор документов idea-пайплайна + `open_questions.md` с одной `[assumed]`-записью).
**Expected Outcome:** Точечная регенерация, инвалидация маркеров и повторный показ сессии решения работают по контракту §3.5.2.
**Priority:** Critical

### Validation: закрытые словари, бюджеты, опциональность полей

### TC-015: `idea_tier` — словарь и таблица линз
**Description:** `idea_tier` — закрытый словарь из четырёх значений (`personal`/`infra`/`content`/`product`); таблица линз (4 tiers × 8 lenses) хранится один раз в `pf-idea-lenses/SKILL.md`; «5 почему» обязательна для всех четырёх; `personal` не получает ни SWOT, ни рыночных линз; `idea.md`/`pf-check` ссылаются на эту таблицу, а не копируют её.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `skills/pf-idea-lenses/SKILL.md` найти таблицу `idea_tier` (4 строки) и таблицу линз (8 строк × 4 колонки). | Обе присутствуют. |
| 2 | Проверить, что строка «5 почему» отмечена `✓` во всех четырёх колонках. | Подтверждено. |
| 3 | Проверить, что строки SWOT/TAM-SAM-SOM/Lean Canvas/JTBD/Pre-mortem не отмечены для `personal`. | Подтверждено. |
| 4 | Убедиться, что ни `skills/pf-idea/SKILL.md`, ни `skills/pf-check/SKILL.md` не содержат копии этой таблицы (только ссылку по имени `pf-idea-lenses`). | Подтверждено. |

**Test Data:** `skills/pf-idea-lenses/SKILL.md`, `skills/pf-idea/SKILL.md`, `skills/pf-check/SKILL.md`.
**Expected Outcome:** Все четыре assert проходят.
**Priority:** High

### TC-016: Единый источник бюджетов документов; `pf-check` сверяет `idea_tier`, не `size_tier`
**Description:** Сводная таблица бюджетов строк (шесть документов × четыре tier'а) хранится один раз в `pf-idea-lenses/SKILL.md`; для TARGET из набора `idea.md`/`research.md`/`critique.md`/`verdict.md`/`hypothesis.md`/`findings.md` `pf-check` читает `idea_tier` и сравнивает объём с этой таблицей, не с таблицей `pf-size-tiers`.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `skills/pf-idea-lenses/SKILL.md` найти таблицу бюджетов (6 строк × 4 колонки). | Присутствует. |
| 2 | В `skills/pf-check/SKILL.md`, "### Claude review path", найти условную ветку «для этих шести TARGET читать `idea_tier`, сравнивать с таблицей `pf-idea-lenses`, не `pf-size-tiers`». | Присутствует. |

**Test Data:** `skills/pf-idea-lenses/SKILL.md`, `skills/pf-check/SKILL.md`.
**Expected Outcome:** Оба assert проходят.
**Priority:** Medium

### TC-017: `pf-close` — прерогатив idea = подтверждённый `## Decision`, Phase 1 пропущена, Phase 4.5 пропущена, `size_tier`-таблица, Phase 9 schedule cleanup
**Description:** Для `TYPE: idea` prerequisite-проверка «на правильной ветке» заменена проверкой присутствия `## Decision` в `verdict.md`; Phase 1 («Confirm with User») пропускается целиком для idea — подтверждённая `## Decision` уже и есть подтверждение закрытия, не второй гейт; Phase 4.5 несёт явную оговорку о полном пропуске для `TYPE: idea`/`spike` (без неё Phase 4.5 ошибочно блокирует каждое такое закрытие, отсутствующим `test_plan.md`); Phase 4.6 п.3.i несёт таблицу вывода `size_tier` (`idea_tier` × сигнал длительности); Phase 9 несёт предваряющий пункт `CronList`/`CronDelete`-очистки schedule `pf-autopilot-<project>` для `TYPE: idea`/`spike`.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `skills/pf-close/SKILL.md`, Phase 0, найти таблицу типов с строкой `idea` → «"## Decision" присутствует в verdict.md». | Присутствует. |
| 2 | Найти оговорку «Phase 1 пропускается целиком для TYPE: idea» рядом с "## Phase 1: Confirm with User". | Присутствует. |
| 3 | Рядом с "## Phase 4.5" найти предваряющую оговорку «Skip this entire phase for TYPE: idea or TYPE: spike» (или согласованный русский эквивалент). | Присутствует, до п.1 существующего Phase 4.5. |
| 4 | В Phase 4.6 найти таблицу вывода `size_tier` (`idea_tier` × сигнал длительности из "Cost (Effort)" → выведенный `size_tier`, 6 строк). | Присутствует. |
| 5 | Рядом с "## Phase 9: Report" найти предваряющий пункт: проверка `CronList` на существование schedule `pf-autopilot-<project>`, и, если существует, `CronDelete` + строка отчёта «Autopilot schedule removed» — только для `TYPE: idea`/`spike`. | Присутствует, синтаксически предшествует остальному телу Phase 9. |

**Test Data:** `skills/pf-close/SKILL.md`.
**Expected Outcome:** Все пять assert проходят.
**Priority:** Medium

### TC-018: `hypothesis.md`/`findings.md` — скелеты и гейт записи
**Description:** Скелеты несут фиксированные секции (Question/Success Criterion/Time-box/Method и Run Evidence/Result vs. Success Criterion/Conclusion/Follow-up соответственно); `pf-idea-spike` документирует правило «не писать непустой `## Conclusion` без непустой `## Run Evidence`».
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В скелете `hypothesis.md` найти четыре секции в порядке Question/Success Criterion/Time-box/Method. | Присутствуют. |
| 2 | В скелете `findings.md` найти четыре секции в порядке Run Evidence/Result vs. Success Criterion/Conclusion/Follow-up. | Присутствуют. |
| 3 | В `skills/pf-idea-spike/SKILL.md` найти формулировку гейта записи. | Присутствует. |

**Test Data:** `skills/pf-idea-spike/SKILL.md`.
**Expected Outcome:** Все три assert проходят.
**Priority:** High

### TC-019: `interaction: front-loaded` — опционально и выключено по умолчанию для feat/improve/bug
**Description:** Для `feat`/`improve`/`bug` поле `interaction: front-loaded` опционально, отсутствие поля означает сегодняшнее интерактивное поведение без изменений; для `idea`/`spike` поле присутствует всегда, но не читается как переключатель (эти типы front-loaded безусловно).
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `skills/pf-interaction/SKILL.md`, §6.11-эквивалент, найти формулировку «опционально; отсутствует по умолчанию → сегодняшнее интерактивное поведение». | Присутствует. |
| 2 | Найти формулировку «для idea/spike поле присутствует всегда, но не читается как переключатель». | Присутствует. |

**Test Data:** `skills/pf-interaction/SKILL.md`.
**Expected Outcome:** Оба assert проходят.
**Priority:** Medium

### TC-020: Front-loaded hook-сайты — 13 скиллов, кроме двух именованных исключений
**Description:** Для каждой (скилл, секция) из таблицы hook-сайтов specs-part2.md §7.13 — диапазон текста между этим заголовком и следующим того же/более высокого уровня содержит и подстроку `pf-interaction`, и подстроку `front-loaded`; для двух строк-исключений (`code.review: skip` confirmation в `pf-codereview` и в `pf`) — диапазон **не** содержит такой ссылки; для codex-install-подсказок `pf-check` — диапазон может не содержать hook, но обязан упоминать оба пути текстом («intake» и «unconditional»); для `pf-close`'s Phase 1 — диапазон содержит **и** упоминание `front-loaded`, **и** текст о том, что поведение без этого поля не меняется; для `pf-test`'s "No test runner detected" — диапазон вокруг этого текста (не только отсутствие литерального `AskUserQuestion`) содержит `pf-interaction`/`front-loaded`.
**Type:** Auto (**Test file:** `test/pf-idea-front-loaded-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Для каждой обычной строки таблицы — извлечь диапазон между заголовком/якорем и следующим заголовком; проверить наличие `pf-interaction` и `front-loaded` в диапазоне. | Присутствуют в каждом обычном hook-сайте. |
| 2 | Для строк-исключений (`code.review: skip` в `pf-codereview` и в `pf`) — тот же диапазон проверить на **отсутствие** этой ссылки. | Ссылка отсутствует. |
| 3 | Для codex-install-подсказок `pf-check` (шаг 1/2a/3) — проверить, что диапазон содержит слова «intake» и «unconditional» (условный assert, не требующий присутствия/отсутствия hook). | Оба слова присутствуют. |
| 4 | Для `pf-close`'s Phase 1 — проверить положительное присутствие `front-loaded` **и** текста о неизменности поведения без поля. | Оба присутствуют. |
| 5 | Для `pf-test`'s "No test runner detected" — проверить присутствие `pf-interaction`/`front-loaded` в диапазоне вокруг этого текста. | Присутствует. |

**Test Data:** `skills/pf-brd/SKILL.md`, `skills/pf-spec/SKILL.md`, `skills/pf-test-plan/SKILL.md`, `skills/pf-impl-plan/SKILL.md`, `skills/pf-check/SKILL.md`, `skills/pf-user-docs/SKILL.md`, `skills/pf-dev-docs/SKILL.md`, `skills/pf-codereview/SKILL.md`, `skills/pf-qa/SKILL.md`, `skills/pf-test/SKILL.md`, `skills/pf-close/SKILL.md`, `skills/pf/SKILL.md`.
**Expected Outcome:** Все пять групп assert проходят по всей таблице §7.13.
**Priority:** High

### Integration: связка со смежными скиллами и инструментами

### TC-021: `pf-check` — TYPE до `size_tier`, шесть новых TARGET-строк, `open_questions.md` как контекст
**Description:** Открывающий `size_tier`-guard `pf-check` сначала определяет TYPE по имени папки и полностью пропускает свой `size_tier`-абзац для `idea`/`spike`; таблицы TARGET→предшественники и TARGET→key несут все шесть новых строк; отдельное предложение фиксирует, что `open_questions.md` читается как дополнительный контекст, а не как предшественник (не участвует в conjunct 3 критерия завершённости).
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В начале `skills/pf-check/SKILL.md` найти условие «First, determine TYPE... If TYPE is idea or spike, skip this entire size_tier paragraph». | Присутствует, синтаксически предшествует остальному абзацу. |
| 2 | Найти шесть строк TARGET→предшественники (`idea.md`→нет, …, `findings.md`→`hypothesis.md`). | Присутствуют. |
| 3 | Найти шесть строк "## Reviewer selection" TARGET→key (`idea.md`→`idea`, …). | Присутствуют. |
| 4 | Найти отдельное предложение про `open_questions.md` как «context, not predecessor». | Присутствует, синтаксически отделено от списка предшественников. |

**Test Data:** `skills/pf-check/SKILL.md`.
**Expected Outcome:** Все четыре assert проходят.
**Priority:** Critical

### TC-022: `pf-brd` — hook `idea_ref`
**Description:** `pf-brd/SKILL.md` документирует: при `idea_ref` в фронтматтере читать `idea.md`/`verdict.md`/оригинальный intake закрытой идеи; не переспрашивать уже отвеченные поля; таблица вывода `size_tier` по `idea_tier` × сигналу длительности из "Cost (Effort)" присутствует; вопрос задаётся только если вывод недостижим.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `skills/pf-brd/SKILL.md` найти абзац "`idea_ref` hook" сразу после чтения `prompt.md` и перед output-гейтом. | Присутствует. |
| 2 | Найти формулировку «не переспрашивать уже отвеченные поля — только genuine gaps». | Присутствует. |
| 3 | Найти упоминание, что `roles`/`profile`/`on_unavailable` обычно уже присутствуют благодаря `pf-close`'s Phase 4.6, не запрашиваются заново. | Присутствует. |

**Test Data:** `skills/pf-brd/SKILL.md`.
**Expected Outcome:** Все три assert проходят.
**Priority:** High

### TC-023: `pf-autopilot` — пять новых скиллов, остановка перед единственным гейтом, отчёт с допущениями
**Description:** Step 2's список скиллов работы включает пять новых пишущих скиллов; новый п.7 останавливает работу перед `/pf-idea-verdict (decision session)` для idea и перед `/pf-close` для spike, никогда не применяя правило «3 попытки, затем дефолт» к этому шагу; финальный отчёт при такой остановке перечисляет каждую `[assumed]`-строку и открытый вопрос.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `skills/pf-autopilot/SKILL.md`, "## Step 2. Work loop", п.1, найти пять новых команд (`/pf-idea`, `/pf-idea-research`, `/pf-idea-critique`, `/pf-idea-verdict`, `/pf-idea-spike`). | Присутствуют. |
| 2 | Найти новый п.7, упоминающий остановку **и** перед decision session для idea, **и** перед `/pf-close` для spike (не только idea). | Оба случая названы. |
| 3 | Найти оговорку "## Step 3. Completion" о перечислении `[assumed]`-строк и открытых вопросов. | Присутствует. |

**Test Data:** `skills/pf-autopilot/SKILL.md`.
**Expected Outcome:** Все три assert проходят.
**Priority:** Critical

### TC-024: `pf-roles` — шесть новых ключей и carve-out для голой папки
**Description:** «Known stage keys» дополнен шестью новыми ключами (`idea`/`research`/`critique`/`verdict`/`hypothesis`/`findings`), резолвящимися по тому же алгоритму §4; carve-out для bare `idea`/`spike`-папки без каркаса PF пропускает auto-creation `agents.yml`/`role-profiles.yml` (levels 2-4), но level 1 (явный `roles.<key>` в самом `prompt.md`) по-прежнему проверяется первым и выигрывает как обычно.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `skills/pf-roles/SKILL.md`, "Known stage keys", найти шесть новых имён. | Присутствуют. |
| 2 | В обоих разделах "### Auto-creation" найти оговорку "Exception — bare idea/spike folder". | Присутствует в обоих. |
| 3 | Внутри той же оговорки найти явное упоминание «level 1... is still checked first» (не только «level 5 unreachable»). | Присутствует — тест ищет именно «level 1» рядом с carve-out'ом. |

**Test Data:** `skills/pf-roles/SKILL.md`.
**Expected Outcome:** Все три assert проходят.
**Priority:** High

### TC-025: `converge-to-v3.sh` — ветки `idea`/`spike`
**Description:** `required_docs()` и `skill_for_doc()` содержат ветки `idea)`/`spike)` — без них конвергенция на проекте с открытым idea/spike-issue ошибочно требует `test_plan.md`/`implementation_plan.md` (реальный дефект, найденный при подготовке спека).
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `scripts/converge-to-v3.sh`, `required_docs()`, найти case-ветку `idea)`, возвращающую `idea.md research.md critique.md verdict.md`. | Присутствует. |
| 2 | В той же функции найти `spike)`, возвращающую `hypothesis.md findings.md`. | Присутствует. |
| 3 | В `skill_for_doc()` найти шесть новых веток документ→скилл. | Присутствуют. |

**Test Data:** `scripts/converge-to-v3.sh`.
**Expected Outcome:** Все три assert проходят.
**Priority:** Medium

### TC-026: Зеркало каркаса и счётчик скиллов в документации
**Description:** `skills/pf/templates/project/` побайтово идентичен `docs/planning/templates/`; `CLAUDE.md`/`README.md`/`docs/planning/FRAMEWORK.md`/`docs/planning/QUICKSTART.md`/`skills/pf-update/SKILL.md`/`tools/onboarding-tui/lib/tutorial.js` сообщают «28» и называют все семь новых скиллов (кроме случая, где старая historical release-note «7 skills» намеренно не трогается — README.md строка 437).
**Type:** Auto (**Test file:** `test/pf-idea-templates-mirror.sh` для зеркала; `test/pf-idea-stage-static.sh` для счётчиков)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `diff -r docs/planning/templates skills/pf/templates/project`. | Пустой diff. |
| 2 | В каждом из шести документационных файлов найти "28" (или "28 skills"/"28 Claude Code skills", в зависимости от файла) и хотя бы одно из семи новых имён. | Присутствуют в каждом файле. |
| 3 | В `README.md` убедиться, что historical release-note «3.0.0 release — 7 Claude Code skills» (строка 437) осталась нетронутой. | Строка присутствует без изменений. |

**Test Data:** `docs/planning/templates/`, `skills/pf/templates/project/`, шесть документационных файлов.
**Expected Outcome:** Все три группы assert проходят.
**Priority:** Medium

### TC-027: Неизменность feat/improve/bug и единственный источник порядка стадий
**Description:** Каждая новая ветка в изменённых общих скиллах (`/pf`, `pf-check`, `pf-close`, `pf-git`, `pf-autopilot`, `pf-roles`) текстуально обусловлена TYPE issue или конкретным полем, никогда не заменяя безусловную ветку рядом (G7/AC-12a); две новые строки `pf-size-tiers`'s «Pipelines» ссылаются на `pf-idea-lenses` по имени (проверяется наличие подстроки `pf-idea-lenses` в каждой строке), не копируют список документов.
**Type:** Auto (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** —
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Для каждого из шести изменённых файлов — найти хотя бы одну оговорку вида «TYPE is idea/spike» или «for TYPE: idea» рядом с каждой новой веткой из specs-part2.md §7. | Присутствуют, обусловленность подтверждена. |
| 2 | Убедиться, что ни один существующий безусловный текст feat/improve/bug (например, оригинальный Step 3 "No issue folders found") не удалён, а сохранён как одна из веток развилки. | Подтверждено (текст присутствует внутри новой структуры). |
| 3 | В `skills/pf-size-tiers/SKILL.md`, "Pipelines", найти две новые строки (`idea`, `spike`), обе содержащие подстроку `pf-idea-lenses`, ни одна не содержит списка из шести документов дословно. | Подтверждено. |

**Test Data:** `skills/pf/SKILL.md`, `skills/pf-check/SKILL.md`, `skills/pf-close/SKILL.md`, `skills/pf-git/SKILL.md`, `skills/pf-autopilot/SKILL.md`, `skills/pf-roles/SKILL.md`, `skills/pf-size-tiers/SKILL.md`.
**Expected Outcome:** Все три assert проходят.
**Priority:** Critical

### TC-028: Живой прогон — спайк, требующий кода
**Description:** Реальный `pf-idea-spike` (Режим 2) для гипотезы, чей метод требует кода, создаёт/checkout'ит ветку `issue/<spike-id>` тем же Branch Setup, что `pf-execute`'s Phase 0, выполняет реальный эксперимент, записывает его настоящий вывод в `## Run Evidence`, и последующий `/pf-close` завершает закрытие по контракту TC-032 на подлинной (не собранной вручную) истории.
**Type:** Manual
**Preconditions:** git-репозиторий с завершённым `hypothesis.md`, чей `## Method` явно описывает код/скрипт/конфигурацию.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-idea-spike` (Режим 2). | Ветка `issue/<spike-id>` создана тем же механизмом, что `pf-execute`'s Phase 0; эксперимент выполнен; `git add -A && git commit` на этой ветке. |
| 2 | Прочитать `findings.md`. | `## Run Evidence` содержит реальный вывод команды/путь к артефакту — не пересказ ожидания. |
| 3 | Запустить `/pf-close`. | Документы скопированы на родительскую ветку; `issue/<spike-id>` не смерджена и не удалена; код эксперимента остаётся на ней. |

**Test Data:** `docs/issues/open/zz-fixture-spike-live/` (`prompt.md`+`hypothesis.md` с методом, требующим кода).
**Expected Outcome:** Полный живой цикл спайка с кодом проходит без нарушения AC-09b/c/d.
**Priority:** High

### TC-029: Реальное ревью в Codex — измерение «совместимость с Codex»
**Description:** Реальный вызов Codex-ревью документов/скиллов этого issue явно запрашивает и получает отдельное измерение «совместимость с Codex» (AC-13a), и каждая конструкция, перечисленная в specs-part3.md §9, отражена в ответе ревьюера либо переносимой альтернативой, либо явной пометкой «принято как ограничение» (AC-13b) — не пропущена молчанием.
**Type:** Manual
**Preconditions:** Codex CLI и `codex-companion.mjs` настроены и доступны; ветка issue с текущей реализацией готова к ревью.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Отправить документы/скиллы issue на Codex-ревью с явным дополнительным запросом «совместимость с Codex». | Запрос содержит это измерение отдельно от обычного P0/P1-ревью. |
| 2 | Сверить ответ Codex с таблицей §9 specs-part3.md (7 строк: `AskUserQuestion`, `Agent` tool, абсолютные пути скиллов, `WebSearch`/`WebFetch`, `CronCreate`/`CronList`/`CronDelete`, `Skill` tool/slash-команды, session-log-атрибуция). | Каждая строка отражена ответом ревьюера — переносимая альтернатива или «принято как ограничение», ни одна не пропущена. |

**Требуемые данные:** не требуются — реальный прогон Codex-ревью на текущем состоянии ветки issue.
**Expected Outcome:** Оба AC (13a/13b) подтверждены на живом ревью, не только текстом спека.
**Priority:** Medium

### Edge cases: опасные сценарии закрытия и голой папки

### TC-030: Bare-folder idea создаёт только папку issue — и ничего больше
**Description:** Fixture — пустая директория (`test/fixtures/no-pf-bare`, переиспользуется). Транскрипция §3.1.1's ветки «Идея»: создать `docs/issues/open/<id>-idea-x/prompt.md` и ничего больше. Assert: `find . -mindepth 1` после выполнения даёт ровно ожидаемый набор путей — ни `PLANNING.md`, ни `docs/planning/`, ни `.git` не появились.
**Type:** Auto — fixture-based (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** `test/fixtures/no-pf-bare` существует.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_setup_case no-pf-bare` (без `--git`). | Свежая копия фикстуры в `$TMP_WORK`. |
| 2 | Транскрибировать ветку «Идея»: создать `docs/issues/open/<id>-idea-x/prompt.md` с минимальным валидным фронтматтером. | Файл создан. |
| 3 | `find . -mindepth 1` внутри `$TMP_WORK`. | Список путей содержит ровно исходные файлы фикстуры плюс новый `docs/issues/open/.../prompt.md` — без `PLANNING.md`, `docs/planning/`, `.git`, `.pf-version`. |

**Test Data:** `test/fixtures/no-pf-bare`.
**Expected Outcome:** `pf_pass`, если множество путей точно совпадает с ожидаемым; иначе `pf_fail` с diff.
**Priority:** Critical

### TC-031: `project`/`spike-first`-вердикт — bootstrap + git init + follow-up в правильном порядке, до архивации; вывод `size_tier`; PARENT-BRANCH для idea в существующем проекте
**Description:** Fixture — bare-folder idea-issue с `verdict.md`'s "## Decision" = `project` (и отдельно — `spike-first`) уже на месте. Транскрипция Phase 4.6: `git init`, копирование каркаса, initial scaffold commit, создание follow-up-папки, **затем** Phase 5's `mv` идеи в `closed/`. Assert, в этом порядке: репозиторий существует после Phase 4.6 и до Phase 5; initial scaffold commit существует и **не** содержит `docs/issues/`-путей (scoped `git add`); follow-up-папка существует под `open/` **до** архивации idea; выведенный `size_tier` follow-up `prompt.md` соответствует таблице Phase 4.6 п.3.i; после полного прогона `git status --porcelain` пуст. Обе ветки вердикта (`project`, `spike-first`) проходят один и тот же bootstrap. Отдельная фикстура (`idea-verdict-project-existing`) проверяет второй путь вычисления PARENT-BRANCH — «idea в уже существующем PF-проекте» (п.3.d): используется значение, уже вычисленное Phase 3 (включая checkout §7.3.1), bootstrap-шаги п.b/c — no-op, поскольку `has_full_scaffold` уже истинно.
**Type:** Auto — fixture-based (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** Новые фикстуры `test/fixtures/idea-verdict-project-bare` (создаётся при реализации, `verdict.md` с `## Decision: project`; `idea.md` несёт `idea_tier: product` и "Cost (Effort)" с сигналом «около недели» — однозначно выводит `size_tier: medium` по таблице) и её вариант с `## Decision: spike-first`; отдельная фикстура `test/fixtures/idea-verdict-project-existing` — idea-issue внутри уже развёрнутого PF-проекта (`PLANNING.md` уже существует, `has_full_scaffold: true`), с PARENT-BRANCH, уже вычисленным и checkout-нутым на Phase 3 этого же прогона.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_setup_case idea-verdict-project-bare` (без `--git`). | Bare-папка с idea-issue, чей `verdict.md` несёт `## Decision: project`. |
| 2 | Транскрибировать Phase 4.6: `git init`, развернуть каркас, `git add PLANNING.md CLAUDE.md .pf-version docs/planning && git commit`, создать `docs/issues/open/<...>-feat-<slug>/prompt.md` с `idea_ref`. | Каждый шаг выполнен в этом порядке. |
| 3 | Проверить: репозиторий существует; commit не содержит `docs/issues/`-путей (`git show --stat`); follow-up-папка существует под `open/`. | Все три assert проходят, ДО следующего шага. |
| 4 | Проверить выведенное значение `size_tier` в follow-up `prompt.md` и обосновывающую запись в его `open_questions.md`. | `size_tier: medium` (по таблице п.3.i для `idea_tier: product` + сигнал «неделя или короче»); `open_questions.md` несёт `[assumed]`-запись с этим обоснованием. |
| 5 | Транскрибировать Phase 5: `mv docs/issues/open/<idea-id> docs/issues/closed/<idea-id>`, коммит архивации. | Idea перемещена. |
| 6 | `git status --porcelain`. | Пусто. |
| 7 | Повторить п.1-6 для `## Decision: spike-first`. | Follow-up — git-backed `spike`-папка с `idea_ref`, тот же bootstrap отработал. |
| 8 | `pf_setup_case idea-verdict-project-existing` (`--git`). Транскрибировать Phase 4.6 п.3.a-d: вычислить `has_git`/`has_full_scaffold` раздельно (оба истинны), убедиться, что п.b (`git init`) и п.c (развернуть каркас) — no-op, и что PARENT-BRANCH берётся из значения, уже вычисленного Phase 3 (не из `git branch --show-current` после нового `git init`, которого в этом прогоне не было). | П.b/c ничего не делают; follow-up issue создаётся на той же ветке, что Phase 3; initial scaffold commit (п.e) не создаётся (идемпотентность — п.b/c ничего не сделали в этом прогоне). |

**Test Data:** `test/fixtures/idea-verdict-project-bare` (и её `spike-first`-вариант), `test/fixtures/idea-verdict-project-existing`.
**Expected Outcome:** Порядок и содержимое каждого шага совпадают с ожиданиями для обеих веток вердикта и для обоих путей вычисления PARENT-BRANCH.
**Priority:** Critical

### TC-032: Spike close — гейт пустого Run Evidence и ветка без merge
**Description:** Fixture 1 — git-репозиторий с завершённым `hypothesis.md`, но `findings.md`'s "## Run Evidence" пуста/плейсхолдер. Транскрипция Phase 0's п.4: попытка закрытия останавливается с сообщением, называющим `Run Evidence`, и не производит ни `mv`, ни коммит. Fixture 2 — `pf-close-basic`-подобный репозиторий с веткой `issue/<spike-id>`, кодом и заполненным `findings.md` на ней. Транскрипция Phase 3.5: `issue/<spike-id>` всё ещё существует после закрытия, `git log --merges` не содержит коммита, мерджащего эту ветку, `docs/issues/closed/<spike-id>/` содержит скопированные документы на PARENT-BRANCH.
**Type:** Auto — fixture-based (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** Новые фикстуры `test/fixtures/spike-close-no-evidence`, `test/fixtures/spike-close-branch`.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_setup_case spike-close-no-evidence --git`. | Репозиторий с `hypothesis.md` завершён, `findings.md`'s Run Evidence — плейсхолдер `<конкретное свидетельство...>`. |
| 2 | Транскрибировать Phase 0 п.4: проверить, что `## Run Evidence` непусто и не равно плейсхолдеру. | Проверка проваливается. |
| 3 | Убедиться, что скрипт останавливается с сообщением, называющим `Run Evidence`, и что `git log` до/после идентичен (никакого `mv`/commit). | Подтверждено. |
| 4 | `pf_setup_case spike-close-branch --git`; создать ветку `issue/<spike-id>` с кодом и заполненным `findings.md`. | Фикстура готова. |
| 5 | Транскрибировать Phase 3.5: checkout на PARENT-BRANCH, `git checkout issue/<spike-id> -- docs/issues/open/<spike-id>`. | Документы скопированы, staged. |
| 6 | `git branch --list`, `git log --merges`. | `issue/<spike-id>` существует; ни одного merge-коммита этой ветки. |
| 7 | Завершить транскрипцию до архивации; проверить `docs/issues/closed/<spike-id>/` на PARENT-BRANCH. | Документы присутствуют там. |

**Test Data:** `test/fixtures/spike-close-no-evidence`, `test/fixtures/spike-close-branch`.
**Expected Outcome:** Гейт блокирует закрытие в Fixture 1; закрытие в Fixture 2 сохраняет ветку нетронутой и копирует только документы.
**Priority:** Critical

### TC-033: `pf-check` никогда не спрашивает `size_tier` для idea/spike
**Description:** Fixture — открытый `idea`-issue с `idea_tier` в `prompt.md`, без `size_tier`. Транскрипция нового opening guard'а: TYPE определяется первым, `size_tier`-ветка не достигается для этого TYPE. Assert (на уровне транскрипции — тест не запускает реальную AI-сессию): условие «TYPE is idea or spike → skip» синтаксически предшествует условию «no size_tier → ask» в собственной bash-модели теста, тем же способом, что TC-005 `test/pf-close.sh` держит транскрипцию в синхроне со skill-текстом (drift-guard TC-021 этого плана).
**Type:** Auto — fixture-based (**Test file:** `test/pf-idea-stage-static.sh`)
**Preconditions:** Новая фикстура `test/fixtures/idea-no-size-tier` (idea-issue с `idea_tier: infra`, без `size_tier` в `prompt.md`).
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_setup_case idea-no-size-tier --git`. | Фикстура готова: `prompt.md` несёт `idea_tier`, не несёт `size_tier`. |
| 2 | Транскрибировать opening guard в bash-функции с двумя условиями в фиксированном порядке: (a) определить TYPE по имени папки; (b) если TYPE ∈ {idea, spike} — вернуться (skip), не доходя до (c); (c) если нет `size_tier` — «спросить». | Функция вызвана на фикстуре. |
| 3 | Проверить, что для этой фикстуры выполнение остановилось на (b), не достигнув (c). | Подтверждено — «no size_tier → ask» не срабатывает. |
| 4 | Сверить исходный текст `skills/pf-check/SKILL.md` (drift guard): условие TYPE физически предшествует абзацу про `size_tier` в файле. | Порядок совпадает с транскрипцией. |

**Test Data:** `test/fixtures/idea-no-size-tier`, `skills/pf-check/SKILL.md` (для drift guard).
**Expected Outcome:** Оба уровня проверки (транскрипция + drift guard) проходят — регрессия именно этого дефекта (BRD's «повторяющийся запрещённый вопрос посреди front-loaded пайплайна») воспроизводима, если её случайно вернуть.
**Priority:** Critical

## AC Traceability (для `/pf-check`)

| AC | TC |
|---|---|
| AC-01a | TC-002, TC-003, TC-004 |
| AC-01b | TC-003, TC-024, TC-030 |
| AC-01c | TC-003, TC-026 |
| AC-01d | TC-004 |
| AC-02a | TC-005 |
| AC-02b | TC-003, TC-025 |
| AC-02c | TC-031 |
| AC-03a | TC-007 |
| AC-03b | TC-006 |
| AC-03c | TC-008, TC-020 |
| AC-03d | TC-010 |
| AC-04a | TC-009 |
| AC-04b | TC-015 |
| AC-04c | TC-015 |
| AC-04d | TC-016 |
| AC-05a | TC-010 |
| AC-05b | TC-010 |
| AC-05c | TC-010 |
| AC-05d | TC-013 |
| AC-06a | TC-011, TC-012 |
| AC-06b | TC-011, TC-012 |
| AC-06c | TC-011 |
| AC-06d | TC-011 |
| AC-07a | TC-013 |
| AC-07b | TC-013 |
| AC-07c | TC-013 |
| AC-07d | TC-014 |
| AC-07e | TC-017 |
| AC-08a | TC-031, TC-017 |
| AC-08b | TC-022 |
| AC-08c | TC-022, TC-031, TC-017 |
| AC-08d | TC-031 |
| AC-09a | TC-018 |
| AC-09b | TC-005, TC-028 |
| AC-09c | TC-018, TC-028, TC-032 |
| AC-09d | TC-028, TC-032 |
| AC-09e | TC-023 |
| AC-10a | TC-023 |
| AC-10b | TC-023, TC-017 |
| AC-10c | TC-023 |
| AC-11a | TC-006 |
| AC-11b | TC-003, TC-006 |
| AC-11c | TC-006 |
| AC-11d | TC-021, TC-033 |
| AC-12a | TC-027 |
| AC-12b | TC-027 |
| AC-12c | TC-019 |
| AC-12d | TC-008, TC-020 |
| AC-13a | TC-029 |
| AC-13b | TC-029 |

Все 50 AC BRD покрыты хотя бы одним TC.

## Status Tracker

| TC     | Test Case | Type   | Priority | Status | Remarks |
| ------ | --------- | ------ | -------- | ------ | ------- |
| TC-001 | Семь новых директорий скиллов существуют с валидным фронтматтером | Auto | High | ✓ | |
| TC-002 | `/pf` — вопрос «идея или сразу проект» в пустой папке | Auto | High | ✓ | |
| TC-003 | Живая сессия `/pf` — пустая папка и существующий проект | Manual | Critical | [ ] | Manual reason: interactive-agent |
| TC-004 | Not-a-repo guard и «не закоммичено» на каждой стадии без git | Auto | Critical | ✓ | |
| TC-005 | Существующий проект без открытых issue — четыре варианта | Auto | High | ✓ | |
| TC-006 | Таблица завершённых стадий, статус-блок и `pf-help` | Auto | Medium | ✓ | |
| TC-007 | Intake-батч — переиспользование `doc_language`, лимит вопросов, carve-out | Auto | High | ✓ | |
| TC-008 | `pf-interaction` — правило front-loaded и единственный финальный гейт | Auto | Critical | ✓ | |
| TC-009 | `idea.md` — фиксированные секции | Auto | High | ✓ | |
| TC-010 | `research.md` — дисциплина источников и непроверенные факты | Auto | Critical | ✓ | |
| TC-011 | `critique.md` — персоны, единый резолв актора, закрытый словарь `Disposition` | Auto | High | ✓ | |
| TC-012 | Живой прогон `pf-idea-critique` — независимость персон | Manual | High | [ ] | Manual reason: interactive-agent |
| TC-013 | `verdict.md` — закрытый словарь и содержимое сессии решения | Auto | Critical | ✓ | |
| TC-014 | Живой прогон — переопределение допущения в сессии решения | Manual | Critical | [ ] | Manual reason: interactive-agent |
| TC-015 | `idea_tier` — словарь и таблица линз | Auto | High | ✓ | |
| TC-016 | Единый источник бюджетов документов; `pf-check` сверяет `idea_tier` | Auto | Medium | ✓ | |
| TC-017 | `pf-close` — прерогатив idea = подтверждённый `## Decision`, Phase 1 пропущена | Auto | Medium | ✓ | |
| TC-018 | `hypothesis.md`/`findings.md` — скелеты и гейт записи | Auto | High | ✓ | |
| TC-019 | `interaction: front-loaded` — опционально и выключено по умолчанию | Auto | Medium | ✓ | |
| TC-020 | Front-loaded hook-сайты — 13 скиллов, кроме двух исключений | Auto | High | ✓ | |
| TC-021 | `pf-check` — TYPE до `size_tier`, шесть TARGET-строк, `open_questions.md` как контекст | Auto | Critical | ✓ | |
| TC-022 | `pf-brd` — hook `idea_ref` | Auto | High | ✓ | |
| TC-023 | `pf-autopilot` — пять скиллов, остановка перед единственным гейтом, отчёт с допущениями | Auto | Critical | ✓ | |
| TC-024 | `pf-roles` — шесть новых ключей и carve-out для голой папки | Auto | High | ✓ | |
| TC-025 | `converge-to-v3.sh` — ветки `idea`/`spike` | Auto | Medium | ✓ | |
| TC-026 | Зеркало каркаса и счётчик скиллов в документации | Auto | Medium | ✓ | |
| TC-027 | Неизменность feat/improve/bug и единственный источник порядка стадий | Auto | Critical | ✓ | |
| TC-028 | Живой прогон — спайк, требующий кода | Manual | High | [ ] | Manual reason: interactive-agent — требуется живая агентная сессия, принимающая решения по ветке/эксперименту, а не просто окружение, недоступное в CI |
| TC-029 | Реальное ревью в Codex — измерение «совместимость с Codex» | Manual | Medium | [ ] | Manual reason: external-system |
| TC-030 | Bare-folder idea создаёт только папку issue — и ничего больше | Auto | Critical | ✓ | |
| TC-031 | `project`/`spike-first`-вердикт — bootstrap + git init + follow-up до архивации | Auto | Critical | ✓ | |
| TC-032 | Spike close — гейт пустого Run Evidence и ветка без merge | Auto | Critical | ✓ | |
| TC-033 | `pf-check` никогда не спрашивает `size_tier` для idea/spike | Auto | Critical | ✓ | |

**Manual budget:** 5/5 (large tier: ≤5, hard cap 5) — TC-003, TC-012, TC-014, TC-028, TC-029.

## Known Issues

| Issue | Description | TC Affected | Steps to Reproduce | Severity |
| ----- | ----------- | ----------- | ------------------- | -------- |
| | | | | |
