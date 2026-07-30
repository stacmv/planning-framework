## Implementation Plan: Fix pf-close parent-branch detection and usage-window start

### Overview

Два тихих дефекта в `skills/pf-close/SKILL.md`. **Дефект 1** (Phase 3): self-tracking
upstream (после `git push -u` на саму issue-ветку) читается как PARENT-BRANCH вместо
`develop` — Phase 4 мержит ветку в себя же, Phase 8.5 пушит не туда. **Дефект 2**
(Phase 6): команда для START-TS ищет историю по `docs/issues/closed/ISSUE-ID`, а этот
путь появляется в истории только в Phase 8 — окно всегда пустое, авто-подсчёт LLM
usage не срабатывает никогда.

**Выбор варианта фикса Дефекта 1: вариант A** (guard от self-tracking upstream,
`analysis.md`). Читаем `git config branch.issue/ISSUE-ID.merge` как раньше, но
добавляем условие: если результат пуст, команда падает, ИЛИ результат буквально равен
`refs/heads/issue/ISSUE-ID` (self-tracking, никогда не родитель) — игнорируем его и
падаем в существующий fallback develop/main (шаг 2). Причина выбора A, а не B: A —
минимальная точечная правка одного условия в шаге 1, сохраняющая изначальный смысл
шага (использовать git-config, когда он реально указывает на родителя, например при
легитимном ручном трекинге), тогда как B выбрасывает шаг 1 целиком. Вариант **C
исключён**: он пишет `branch.<name>.pfParent` в `/pf-execute` Phase 0, то есть
затрагивает второй файл (`skills/pf-execute/SKILL.md`), расширяя область за пределы
`small`-тира этого issue.

**Дефект 2: вариант A** (уже решено в `analysis.md`, не открыт). Меняем путь в
Phase 6 шаг 1 с `docs/issues/closed/ISSUE-ID` на `docs/issues/open/ISSUE-ID` — именно
по этому пути issue живёт в истории git всё время до Phase 8. Однострочная форма
команды сохраняется.

Оба фикса — правки внутри `skills/pf-close/SKILL.md`, без затрагивания
`skills/pf-execute/SKILL.md` и без изменения Phase 8.5.

### Files to Create/Modify

- `skills/pf-close/SKILL.md` — Phase 3 шаг 1 (self-tracking guard) и Phase 6 шаг 1
  (путь `open/` вместо `closed/`)
- `test/fixtures/pf-close-basic/docs/issues/open/20260101-bug-close-fixture/prompt.md`
  — новая минимальная фикстура (только этот файл, без `.git`)
- `test/fixtures/README.md` — таблица/счёт фикстур, framing
- `test/pf-close.sh` — новый suite: TC-001–TC-005

### Implementation Tasks

#### Task 1: Фикстура `pf-close-basic` и README

**Mapped Test Cases:** none (инфраструктурный prerequisite для TC-001–TC-005)
**Files:**
- `test/fixtures/pf-close-basic/docs/issues/open/20260101-bug-close-fixture/prompt.md` - создать, минимальное содержимое (frontmatter `doc_language: Russian`, `size_tier: small`, одна строка описания)
- `test/fixtures/README.md` - обновить счёт «Eleven fixtures» → «Twelve fixtures», добавить строку таблицы для `pf-close-basic/` («минимальный git-проект под `/pf-close`; ветки/upstream донастраиваются каждым TC поверх базы»), уточнить framing (не только про convergence)

**Implementation Notes:**
- Фикстура — ровно один файл, никакого `.git` внутри (правило фикстур). Ветка
  `develop`, upstream, доп. коммиты — donastраиваются каждым TC через
  `pf_setup_case pf-close-basic --git` + `git -C "$TMP_WORK" …`, не в самой фикстуре.

**Acceptance Criteria:**
- [ ] `find test/fixtures/pf-close-basic -name .git` — пусто
- [ ] `test/fixtures/README.md` содержит строку `pf-close-basic` и обновлённый счёт

#### Task 2: Фикс Дефекта 1 (Phase 3) + TC-001, TC-002, TC-003

**Mapped Test Cases:** TC-001, TC-002, TC-003
**Files:**
- `skills/pf-close/SKILL.md` - Phase 3 шаг 1: добавить self-tracking guard
- `test/pf-close.sh` - создать; TC-001–TC-003

**Implementation Notes:**
- Точная новая формулировка шага 1 (греппабельный якорь для TC-005 —
  фраза `Self-tracking upstream guard`):

  > 1. Run `git config branch.issue/ISSUE-ID.merge`. **Self-tracking upstream
  > guard:** if the result is empty, the command fails, or the result equals
  > `refs/heads/issue/ISSUE-ID` itself (a self-tracking upstream set by `git push
  > -u` on the issue branch, never a parent), ignore it and fall through to step 2.
  > Otherwise extract the branch name (strip the `refs/heads/` prefix) and use
  > that as PARENT-BRANCH.
  > 2. Fallback: run `git branch --list develop`. If `develop` is listed, set
  > PARENT-BRANCH to `develop`. Otherwise set PARENT-BRANCH to `main`.

- TC-001–TC-003 в `test/pf-close.sh` реализуют эту логику **напрямую в bash**
  (хардкод, как предписывает `test_plan.md`), не извлекая инструкцию из
  `SKILL.md` — соответствие тексту скилла проверяет отдельно TC-005 (Task 4).
- TC-001: `.merge` = `refs/heads/issue/<ID>` (self-tracking) → PARENT-BRANCH =
  `develop`. TC-002: `.merge` = `refs/heads/develop` (легитимный трекинг) →
  PARENT-BRANCH = `develop`. TC-003: ветка `develop` отсутствует, upstream не
  задан → PARENT-BRANCH = буквально `main` (не имя реальной базовой ветки).

**Acceptance Criteria:**
- [ ] TC-001 passes
- [ ] TC-002 passes
- [ ] TC-003 passes

#### Task 3: Фикс Дефекта 2 (Phase 6) + TC-004

**Mapped Test Cases:** TC-004
**Files:**
- `skills/pf-close/SKILL.md` - Phase 6 шаг 1: путь `open/` вместо `closed/`
- `test/pf-close.sh` - расширить; TC-004

**Implementation Notes:**
- Новая команда (однострочная, якорь для TC-005):
  `git log --reverse --format=%aI -- docs/issues/open/ISSUE-ID | head -1`
- TC-004: `pf_git_init` создаёт первый коммит (TS1) с `docs/issues/open/…/prompt.md`
  через инлайновую identity `-c user.name=… -c user.email=…`; второй коммит (TS2 >
  TS1) делает сам тест с явной identity (`git -C "$TMP_WORK" -c user.name=pf-test -c
  user.email=pf@test commit …`) — `pf_git_init` identity нигде не сохраняет. Затем
  `mv docs/issues/open/… docs/issues/closed/…` только в рабочем дереве (как Phase 5,
  без коммита). Исправленная команда выполняется хардкодом в теле теста (не
  извлекается из SKILL.md) и должна вернуть TS1; отдельно проверяется, что команда по
  старому пути `closed/…` возвращает пустой вывод.

**Acceptance Criteria:**
- [ ] TC-004 passes

#### Task 4: Drift-check TC-005

**Mapped Test Cases:** TC-005
**Files:**
- `test/pf-close.sh` - расширить; TC-005 (grep, без git-фикстур)

**Implementation Notes:**
- Grep 1 (Phase 6): `skills/pf-close/SKILL.md` содержит
  `--format=%aI -- docs/issues/open/ISSUE-ID`; в этой же команде отсутствует старая
  форма `--format=%aI -- docs/issues/closed/ISSUE-ID` (не общий grep по `closed/
  ISSUE-ID` — этот путь легитимно встречается в других местах SKILL.md).
- Grep 2 (Phase 3): `skills/pf-close/SKILL.md` содержит якорь
  `Self-tracking upstream guard`.
- По образцу `test/qa-gates.sh` (шаг 1b) / `test/skills-static.sh` — статический
  grep, без запуска git-логики.

**Acceptance Criteria:**
- [ ] TC-005 passes

#### Task 5: TC-006 — ручная проверка, без кода

**Mapped Test Cases:** TC-006
**Files:** none — правки кода не требуются

**Implementation Notes:**
- TC-006 — Manual, одноразовый и самореференциальный: подтверждается реальным
  `/pf-close` при закрытии именно этого issue (Phase 4 реально мержит в `develop`,
  `usage_report.md` получает непустое окно). Отдельного bash-suite не требуется;
  задача этого task — только убедиться, что после Task 2–3 текст `SKILL.md`
  инструктивно достаточен для ручного прогона (без дополнительных правок).

**Acceptance Criteria:**
- [ ] TC-006 confirmed manually when this issue is closed via /pf-close
