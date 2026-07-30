# Test Plan — 20260729-bug-pf-close-parent-branch-and-usage-window

## Обзор и цели

Проверяет фикс двух дефектов в `skills/pf-close/SKILL.md` (`analysis.md`):
**Дефект 1** (Phase 3) — self-tracking upstream (после `push -u` на саму
issue-ветку) ошибочно принимается за PARENT-BRANCH вместо `develop`, из-за
чего Phase 4 мержит ветку в себя же и Phase 8.5 пушит не туда. **Дефект 2**
(Phase 6) — `git log … -- docs/issues/closed/ISSUE-ID` в момент Phase 6 всегда
пуст (архивный путь ещё не закоммичен), START-TS не вычисляется, авто-подсчёт
LLM usage никогда не срабатывает.

Цель: доказать поведением, что после фикса (1) PARENT-BRANCH резолвится в
`develop`/`main`, а self-tracking upstream не маскируется под родителя;
(2) START-TS вычисляется непустым и корректным; (3) тест на дрейф хранит
хардкоженную ожидаемую форму git-команды и грепом проверяет, что она всё ещё
присутствует в `SKILL.md` (по образцу `test/qa-gates.sh` шаг 1b — это
текстовая проверка на дрейф, а НЕ извлечение инструкции из SKILL.md с
последующим выполнением); (4) реальный `/pf-close` подтверждает оба фикса
end-to-end.

**Допущение про вариант фикса.** TC-001/002/005 написаны в предположении, что
impl-plan выберет **вариант A или B** из `analysis.md` (не C — тот расширяет
область на `skills/pf-execute/SKILL.md`). TC-001/002 проверяют наблюдаемый
результат (PARENT-BRANCH резолвится в `develop`, self-tracking upstream не
маскируется под родителя) — верно для обоих вариантов, кейсы через результат,
а не реализацию. Текстовый якорь drift-check TC-005 для Phase 3 зависит от
выбранного варианта и уточняется на этапе impl-plan.

## Prerequisites

- Репозиторий выгружен, рабочее дерево чистое; `bash`/`git` в PATH.
- `test/lib.sh` источается тестами (`pf_setup_case`, `pf_git_init`, `pf_pass`/
  `pf_fail`, `assert_repo_untouched`).
- Фикс дефектов 1–2 внесён в `skills/pf-close/SKILL.md` (до фикса TC-001…
  TC-005 ожидаемо красные — в этом их смысл).
- Новая фикстура `test/fixtures/pf-close-basic/` (минимальный git-проект,
  `docs/issues/open/20260101-bug-close-fixture/prompt.md`), используется через
  `pf_setup_case pf-close-basic --git` — **не** `pf_repo_copy` (та копирует
  весь framework-репозиторий с `.git`, служит только guard'у S-5, не годится
  для синтетической issue-ветки с произвольным upstream). Каждый TC донастраивает
  ветки/конфиг/коммиты поверх базы через `git -C "$TMP_WORK" …`.
- TC-006: реальный Claude Code с установленными skills, issue с `qa_report.md`
  = PASS, доступ к `~/.claude/projects/<slug>/*.jsonl`.
- Новая фикстура ломает счёт/рамку `test/fixtures/README.md` («Eleven
  fixtures», таблица, framing «convergence script is run against» — сейчас
  все фикстуры только для converge-тестов). Impl-plan/execute должны
  обновить README.md: строка для `pf-close-basic/` в таблице, поправленный
  счёт и уточнённый framing (не про convergence, а про `/pf-close`).

## Дефект 1: определение родительской ветки (Phase 3)

### TC-001: Self-tracking upstream не подменяет собой родителя

**Description:** Issue-ветка, чей upstream указывает на неё саму (как после
`push -u` без предварительного трекинга `develop`), не должна резолвиться в
PARENT-BRANCH — им должен остаться `develop`.

**Preconditions:**
- `pf_setup_case pf-close-basic --git`, базовая ветка переименована в `develop`.
- Создана `issue/20260101-bug-close-fixture` от `develop`.
- `git config branch.issue/20260101-bug-close-fixture.remote origin` +
  `.merge refs/heads/issue/20260101-bug-close-fixture` (self-tracking, реальный remote не нужен).

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Выполнить исправленную логику Phase 3 (форма команды хардкожена в теле теста; соответствие тексту `SKILL.md` проверяет отдельный drift-check TC-005) в `$TMP_WORK` | Завершается без ошибки |
| 2 | Сравнить PARENT-BRANCH со значением `develop` и с `issue/20260101-bug-close-fixture` | Равно `develop`, НЕ равно issue-ветке |

**Test Data:** `test/fixtures/pf-close-basic/`

**Expected Outcome:** PARENT-BRANCH == `develop`, self-tracking upstream отфильтрован.

**Priority:** Critical

### TC-002: Легитимный трекинг `develop` продолжает работать

**Description:** Ветка с upstream, реально указывающим на `develop` (не на
саму себя), должна по-прежнему резолвиться в `develop` — фикс не переусердствовал.

**Preconditions:** Как TC-001, но `.merge refs/heads/develop`, `.remote origin`.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Выполнить логику Phase 3 в `$TMP_WORK` | Завершается без ошибки |
| 2 | Сравнить PARENT-BRANCH со значением `develop` | Равно `develop` |

**Test Data:** `test/fixtures/pf-close-basic/`

**Expected Outcome:** Легитимный трекинг `develop` читается как раньше — регресса нет.

**Priority:** High

**Примечание (покрытие):** сценарий «upstream не задан (не self-tracking) и
`develop` существует» отдельным кейсом не выделяется — он транзитивно
покрыт TC-001 (тот же fallback на `develop`, что и когда self-tracking
upstream отфильтрован; путь резолюции идентичен).

### TC-003: `develop` отсутствует → fallback на `main`

**Description:** Без ветки `develop` в репозитории PARENT-BRANCH должен упасть
в `main` — существующий fallback (Phase 3 шаг 2), не задетый фиксом. Шаг 2
присваивает PARENT-BRANCH буквальную строку `main` при отсутствии `develop`,
независимо от реального имени базовой ветки фикстуры (`main`/`master`, зависит
от `init.defaultBranch`) — переименовывать базовую ветку не требуется.

**Preconditions:** `pf_setup_case pf-close-basic --git` (базовая ветка — как
даст `git init`, без переименования; важно лишь отсутствие ветки `develop`);
`issue/20260101-bug-close-fixture` без upstream.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Выполнить логику Phase 3 в `$TMP_WORK`; проверить `git branch --list develop` | Завершается без ошибки; список пуст |
| 2 | Сравнить PARENT-BRANCH с буквальной строкой `main` | Равно `main` (буквально — не имени реальной базовой ветки фикстуры, которая может оказаться `master`) |

**Test Data:** `test/fixtures/pf-close-basic/`

**Expected Outcome:** Fallback «develop, иначе main» не сломан фиксом дефекта 1.

**Priority:** High

## Дефект 2: окно расчёта LLM usage (Phase 6)

### TC-004: START-TS вычисляется по пути `open/`, а не `closed/`

**Description:** На момент Phase 6 путь `docs/issues/closed/ISSUE-ID` в
истории git не существует (коммит архивации — только в Phase 8); исправленная
команда должна читать историю по `docs/issues/open/ISSUE-ID` и вернуть
непустой корректный START-TS.

**Preconditions:**
- `pf_setup_case pf-close-basic --git` — базовый коммит (TS1, сделан
  `pf_git_init` с инлайновой identity `-c user.name=… -c user.email=…` только
  для этого одного коммита) содержит
  `docs/issues/open/20260101-bug-close-fixture/prompt.md`.
- Второй коммит меняет `.../notes.md` (TS2 > TS1) — делается самим тестом и
  ОБЯЗАН передать свою identity явно, например `git -C "$TMP_WORK" -c
  user.name=pf-test -c user.email=pf@test commit -m …` (или предварительный
  `git config user.name/user.email` в копии фикстуры): `pf_git_init` задаёт
  identity только через `-c` для своего единственного коммита и нигде её не
  сохраняет — иначе второй коммит теста упадёт с «Please tell me who you are»
  на чистом CI.
- Папка перенесена в рабочем дереве без коммита, как в Phase 5:
  `mv docs/issues/open/… docs/issues/closed/…` — это только рабочее дерево, в
  git-историю не попадает (коммит архивации — Phase 8, вне сферы теста).

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Выполнить исправленную команду Phase 6 (форма хардкожена в теле теста; соответствие тексту `SKILL.md` проверяет отдельный drift-check TC-005) в `$TMP_WORK` | Вывод непустой |
| 2 | Сравнить START-TS с `%aI` первого коммита (TS1); отдельно выполнить `git log --reverse --format=%aI -- docs/issues/closed/ISSUE-ID` (старый путь) | START-TS равен TS1; `git log` по старому пути `closed/…` возвращает пустой вывод — это проверка **вывода `git log`, а не `ls`/`test -d`**: после `mv` из Phase 5 каталог `closed/…` физически непуст на диске, пуста именно история git по этому пути (подтверждает причину дефекта) |

**Test Data:** `test/fixtures/pf-close-basic/`

**Expected Outcome:** START-TS непустой и равен первому коммиту по `open/`-пути; `git log --reverse -- docs/issues/closed/ISSUE-ID` по старому пути пуст (проверка на git-историю, не на файловую систему); авто-подсчёт usage больше не пропускается по умолчанию.

**Priority:** Critical

## Защита от дрейфа тестов

### TC-005: Drift-check — SKILL.md по-прежнему содержит исправленную форму команд

**Description:** По образцу `test/qa-gates.sh` (шаг 1b): тест хранит
хардкоженную ожидаемую форму Phase-3/Phase-6 команд и грепом проверяет, что
`skills/pf-close/SKILL.md` всё ещё её содержит. Это **текстовая проверка на
дрейф**, а не извлечение команды из SKILL.md с последующим выполнением (это
делают сами TC-001/TC-004, каждый со своей хардкоженной формой) и не сверка с
копией, «вшитой» в TC-001/TC-004. Разойдись будущая правка Phase 3/6 с этим
хардкодом — TC-005 падает первым, до того как TC-001/TC-004 молча начнут
проверять устаревшее поведение SKILL.md.

**Preconditions:** Фикс внесён в `skills/pf-close/SKILL.md`. Impl-plan должен
формулировать Phase 6 команду (и, где возможно, Phase 3 фикс) в греппабельной,
желательно однострочной форме — стабильный якорь для drift-check. Команда
Phase 6 уже однострочная (`git log --reverse --format=%aI -- docs/issues/closed/ISSUE-ID | head -1`,
строка 88 SKILL.md), меняется только путь `closed/` → `open/`. Phase 3 —
прозаический пункт (строка 60), не голая команда; текстовый якорь для guard'а
self-tracking upstream фиксируется на этапе impl-plan и зависит от варианта
A/B (см. Overview).

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | grep-ом проверить, что Phase 6 в `skills/pf-close/SKILL.md` содержит исправленную форму `--format=%aI -- docs/issues/open/ISSUE-ID`; отдельно проверить отсутствие старой формы `--format=%aI -- docs/issues/closed/ISSUE-ID` **в этой же команде** (не общий grep по `closed/ISSUE-ID` — этот путь легитимно встречается в SKILL.md как место назначения архива, например в тексте про `usage_report.md`, и наивный grep ловил бы это вечно) | Новая форма найдена; старая форма именно с `--format=%aI --` перед ней — не найдена |
| 2 | grep-ом проверить, что Phase 3 в `skills/pf-close/SKILL.md` содержит текстовый якорь, финализированный на impl-plan для выбранного варианта: для A — guard от self-tracking upstream; для B — формулировку fallback-правила develop/main вместо чтения git-config | Найдено |

**Требуемые данные:** не требуются (статический grep по `skills/pf-close/SKILL.md`)

**Expected Outcome:** `SKILL.md` не разошёлся с ожидаемой (хардкоженной в
тесте) формой команд Phase 3/6 — будущий дрейф ловит этот тест, а не молчаливо
проходящие TC-001/TC-004.

**Priority:** Medium

## Сквозное ручное тестирование

### TC-006: `/pf-close` end-to-end — реальный merge и реальное окно usage

**Description:** Прогнать `/pf-close` на реальном issue, прошедшем QA, и
убедиться, что оба дефекта устранены в штатном рабочем процессе, не только на
синтетической фикстуре. Кейс одноразовый и самореференциальный (закрывает
именно ЭТОТ issue), повторно так не прогнать. Регрессия в будущем: прогнать
`/pf-close` на любом тестовом issue с self-tracking upstream и проверить
(i) реальный merge в `develop`, (ii) непустое usage window.

**Preconditions:** Issue в `docs/issues/open/` с `qa_report.md` = **PASS**, на
`issue/ISSUE-ID` с self-tracking upstream (как после штатного `push -u` из
`/pf-git`); Claude Code со skills; доступ к `~/.claude/projects/<slug>/*.jsonl`.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Запустить `/pf-close`, подтвердить закрытие | Все фазы проходят без ошибок |
| 2 | `git log --oneline --graph develop \| head -5` | Виден merge-коммит `merge: close ISSUE-ID`, изменения issue-ветки реально попали в `develop` (не no-op) |
| 3 | Открыть `docs/issues/closed/ISSUE-ID/usage_report.md`; сверить START-TS с первым коммитом по `docs/issues/open/ISSUE-ID` | Окно непустое и корректное, а не «не удалось определить» |

**Требуемые данные:** не требуются (используется реальный закрываемый issue текущей сессии)

**Expected Outcome:** Issue корректно смержен в `develop`, `usage_report.md` содержит реально вычисленное непустое окно.

**Priority:** Critical

## Status Tracker

| TC     | Test Case | Type | Priority | Status | Remarks |
| ------ | --------- | ---- | -------- | ------ | ------- |
| TC-001 | Self-tracking upstream не подменяет собой родителя | Auto | Critical | [ ] | |
| TC-002 | Легитимный трекинг `develop` продолжает работать | Auto | High | [ ] | |
| TC-003 | `develop` отсутствует → fallback на `main` | Auto | High | [ ] | |
| TC-004 | START-TS вычисляется по пути `open/`, а не `closed/` | Auto | Critical | [ ] | |
| TC-005 | Drift-check: SKILL.md по-прежнему содержит исправленную форму команд | Auto | Medium | [ ] | |
| TC-006 | `/pf-close` end-to-end — реальный merge и реальное окно usage | Manual | Critical | [ ] | |
