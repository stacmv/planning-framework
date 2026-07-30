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
(2) START-TS вычисляется непустым и корректным; (3) тест не дублирует
git-команду из SKILL.md руками, а извлекает её оттуда (drift-guard, по
образцу `test/qa-gates.sh` шаг 1b); (4) реальный `/pf-close` подтверждает оба
фикса end-to-end.

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
| 1 | Выполнить исправленную логику Phase 3 (команда извлечена из SKILL.md — см. TC-005) в `$TMP_WORK` | Завершается без ошибки |
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

### TC-003: `develop` отсутствует → fallback на `main`

**Description:** Без ветки `develop` в репозитории PARENT-BRANCH должен упасть
в `main` — существующий fallback (Phase 3 шаг 2), не задетый фиксом.

**Preconditions:** `pf_setup_case pf-close-basic --git`, базовая ветка = `main`
(`develop` не создаётся); `issue/20260101-bug-close-fixture` без upstream.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Выполнить логику Phase 3 в `$TMP_WORK`; проверить `git branch --list develop` | Завершается без ошибки; список пуст |
| 2 | Сравнить PARENT-BRANCH со значением `main` | Равно `main` |

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
- `pf_setup_case pf-close-basic --git` — базовый коммит (TS1) содержит
  `docs/issues/open/20260101-bug-close-fixture/prompt.md`.
- Второй коммит меняет `.../notes.md` (TS2 > TS1).
- Папка перенесена в рабочем дереве без коммита, как в Phase 5:
  `mv docs/issues/open/… docs/issues/closed/…`.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Выполнить исправленную команду Phase 6 (извлечена из SKILL.md — см. TC-005) в `$TMP_WORK` | Вывод непустой |
| 2 | Сравнить START-TS с `%aI` первого коммита (TS1); проверить, что старый путь `closed/…` по-прежнему пуст | Равны TS1; старый путь пуст (подтверждает причину дефекта) |

**Test Data:** `test/fixtures/pf-close-basic/`

**Expected Outcome:** START-TS непустой и равен первому коммиту по `open/`-пути; авто-подсчёт usage больше не пропускается по умолчанию.

**Priority:** Critical

## Защита от дрейфа тестов

### TC-005: Тесты вытягивают git-команду из SKILL.md, а не дублируют её руками

**Description:** По образцу `test/qa-gates.sh` (шаг 1b) и `test/skills-static.sh`:
TC-001/TC-004 не хранят свою копию Phase-3/Phase-6 команд, а извлекают
буквальный текст команды из `skills/pf-close/SKILL.md` и выполняют именно его
— иначе будущая правка Phase 3/6 незаметно разойдётся с тестом, который
продолжит зелено проходить, проверяя устаревшую копию.

**Preconditions:** Фикс внесён в `skills/pf-close/SKILL.md`; TC-001, TC-004 реализованы.

**Steps:**

| Step | Action | Expected Result |
|---|---|---|
| 1 | grep-ом извлечь команду Phase 3 «Detect Parent Branch» из SKILL.md, сверить с телом TC-001 | Совпадает буквально (не хардкод) |
| 2 | grep-ом извлечь команду Phase 6 шага 1 из SKILL.md, сверить с телом TC-004 | Совпадает буквально (не хардкод) |

**Требуемые данные:** не требуются (статический grep по `skills/pf-close/SKILL.md`)

**Expected Outcome:** Ни один литерал команды Phase 3/6 не продублирован вручную — обе извлекаются из SKILL.md на лету.

**Priority:** Medium

## Сквозное ручное тестирование

### TC-006: `/pf-close` end-to-end — реальный merge и реальное окно usage

**Description:** Прогнать `/pf-close` на реальном issue, прошедшем QA, и
убедиться, что оба дефекта устранены в штатном рабочем процессе, не только на
синтетической фикстуре.

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
| TC-005 | Тесты вытягивают git-команду из SKILL.md, а не дублируют её | Auto | Medium | [ ] | |
| TC-006 | `/pf-close` end-to-end — реальный merge и реальное окно usage | Manual | Critical | [ ] | |
