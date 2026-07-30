# Analysis — 20260729-bug-pf-close-parent-branch-and-usage-window

Два тихих дефекта в `skills/pf-close/SKILL.md`. Оба воспроизводятся на любом
issue, закрываемом штатным путём: скилл не падает, а делает не то. Оба обойдены
вручную при закрытии `20260729-improve-manual-test-data-and-role-explorer`.

---

## Дефект 1 — Phase 3 принимает upstream-ветку за родительскую

### Где в коде

`skills/pf-close/SKILL.md`, Phase 3 «Detect Parent Branch», шаг 1 (строка 60):

> Run `git config branch.issue/ISSUE-ID.merge`. If this returns a value such as
> `refs/heads/develop`, extract the branch name (strip the `refs/heads/`
> prefix). Use that as PARENT-BRANCH.

### Root cause

`git config branch.<name>.merge` возвращает **upstream** ветки (её tracking-ref),
а не родителя, от которого она ответвлена. Это разные вещи: upstream настраивается
`git push -u` / `git branch --set-upstream-to` и обычно указывает на одноимённую
удалённую ветку.

Цепочка, которая гарантированно ломает Phase 3:

1. `/pf-execute` Phase 0 создаёт issue-ветку командой `git checkout -b
   issue/ISSUE-ID` — без `--track`. Значит `branch.issue/<ID>.merge` в штатном
   потоке фреймворка изначально не установлен и не может случайно указывать на
   `develop`: это не значение, которое «затирается задним числом», оно просто
   никогда не бывает корректным родительским указателем.
2. `/pf-git` («Stage commit & push», шаг 3) и `/pf-execute` (после каждой волны)
   пушат ветку с `-u`, если у неё ещё нет upstream.
3. `-u` записывает `branch.issue/<ID>.merge = refs/heads/issue/<ID>` — upstream
   указывает на **саму себя** на remote.

Буквальное следование инструкции → `PARENT-BRANCH = issue/<ID>`.

### Reproduction

```
$ git config branch.issue/20260729-improve-manual-test-data-and-role-explorer.merge
refs/heads/issue/20260729-improve-manual-test-data-and-role-explorer
```

Ожидалось `refs/heads/develop`, получено имя самой issue-ветки.

### Impact (blast radius)

С `PARENT-BRANCH = issue/<ID>`:

- Phase 4 делает `git checkout issue/<ID>` (уже на ней) и
  `git merge --no-ff issue/<ID>` — слияние ветки в саму себя, no-op. **Слияния в
  `develop` не происходит.**
- Phase 8.5 пушит `issue/<ID>` вместо родителя (гард на `main`/`master` не
  срабатывает, т.к. это не release-ветка) — засоряет remote, родитель не
  обновляется.

Итог: issue помечается закрытым, но его изменения **не попадают в `develop`**.
Тихо — ни ошибки, ни конфликта. На `20260729-improve-…` спасло только ручное
вмешательство (родитель взят по fallback `develop`).

### Направление исправления (решение — на этапе impl-plan)

Родителя нужно определять так, чтобы `-u` на issue-ветку не мог его подменить.
Кандидаты:

- **A.** Читать `branch.<name>.merge` только когда upstream ≠ сама ветка (т.е.
  игнорировать `refs/heads/issue/<ID>`), иначе идти в fallback.
- **B.** Отказаться от git-config: опираться на уже описанное fallback-правило
  «родитель = `develop` если существует, иначе `main`».
- **C.** Записывать родителя явно при создании ветки в `/pf-execute` Phase 0
  (например `git config branch.issue/<ID>.pfParent develop`) и читать его здесь.

Вариант B — самый простой и уже наполовину реализован как fallback; C — самый
надёжный, но затрагивает второй скилл. Выбор фиксируется в implementation_plan.

### Периферийные случаи (не ломаются фиксом)

- **«`develop` не существует»** — уже покрыто существующим fallback'ом Phase 3,
  шаг 2; фикс его не трогает.
- **detached HEAD** — на Phase 3 невозможен: `/pf-execute` Phase 0 требует
  `git branch --show-current == issue/ISSUE-ID`, то есть к моменту закрытия
  всегда есть именованная issue-ветка.
- **«ветка легитимно трекает `develop`»** — вариант A игнорирует upstream только
  когда он равен самой issue-ветке; легитимный трекинг `develop` под этот
  фильтр не попадает и продолжает читаться как раньше.

---

## Дефект 2 — Phase 6 ищет историю по пути, которого в ней нет

### Где в коде

`skills/pf-close/SKILL.md`, Phase 6 «Compute LLM Usage & Cost», шаг 1 (строка 88):

```
git log --reverse --format=%aI -- docs/issues/closed/ISSUE-ID | head -1
```

Результат — START-TS, начало окна для подсчёта расхода токенов/денег.

### Root cause

Порядок фаз:

- **Phase 5** (строка 78) делает `mv docs/issues/open/<ID> docs/issues/closed/<ID>`
  — перемещение живёт **только в рабочем дереве**.
- **Phase 6** запускает `git log … -- docs/issues/closed/<ID>` — но во **всей
  прошлой истории** путь был `docs/issues/open/<ID>/`. Коммит архивации, который
  впервые внесёт путь `closed/`, создаётся только в **Phase 8**.

Значит на момент Phase 6 путь `docs/issues/closed/<ID>` в истории коммитов
отсутствует → `git log` возвращает пустую строку.

### Reproduction

```
$ git log --reverse --format=%aI -- docs/issues/closed/20260729-improve-manual-test-data-and-role-explorer | head -1
(пусто)
```

### Impact

Скилл сам обрабатывает пустой результат (шаг 1: «If it returns nothing, skip
auto-computation … with a note that the window could not be determined»). Поэтому
дефект **замаскирован собственным обработчиком**: вместо ошибки — пустой
usage_report.md с пометкой «окно определить не удалось». При штатном порядке фаз
**авто-подсчёт расхода LLM не выполняется никогда**. Функциональность Phase 6
мертва по умолчанию.

На `20260729-improve-…` обойдено вручную — история взята по прежнему пути
`docs/issues/open/<ID>`, окно получилось корректным.

### Направление исправления

- **A.** Читать историю по пути `docs/issues/open/<ID>` — он и есть путь, по
  которому issue реально жил всю историю.
- **B.** `git log --follow` (следовать за переименованием) — но на момент Phase 6
  переименование ещё не закоммичено, так что `--follow` не поможет без A.
- **C.** Перенести вычисление START-TS до Phase 5 (пока путь ещё `open/`).

Вариант A — минимальная и точная правка. Фиксируется в implementation_plan.

---

## Границы задачи

- **Один файл — при выборе варианта A или B.** Оба варианта фикса дефекта 1
  (A: игнорировать self-upstream; B: полагаться на fallback) правят только
  `skills/pf-close/SKILL.md`, как и единственный вариант фикса дефекта 2. Если
  на этапе impl-plan будет выбран **вариант C** (запись родителя в
  `/pf-execute` Phase 0), область расширяется на второй файл —
  `skills/pf-execute/SKILL.md` — и тогда оценку размера нужно пересмотреть
  заново. Рекомендация — A или B, чтобы область осталась в одном файле; сам
  выбор делается на этапе impl-plan, не здесь.
- **Phase 8.5 не трогать** — гард на `main`/`master` и на отсутствие remote
  корректен и переиспользован в `/pf-git`.
- **Проверять тестом, а не грепом текста.** Дефект 1 — про поведение git;
  фикстурный репозиторий с issue-веткой, у которой upstream выставлен на саму
  себя, показывает его нагляднее любого утверждения о форме инструкции.
  Инфраструктура: `test/lib.sh` — `pf_setup_case <fixture> --git` +
  `pf_git_init` (лёгкая git-инициализация поверх `test/fixtures/*`), а не
  `pf_repo_copy`: последняя копирует **весь** репозиторий planning-framework
  вместе с `.git` и служит guard'ам «репозиторий не тронут» (S-5 /
  `assert_repo_untouched`), а не построению синтетического fixture-проекта с
  произвольной веткой/upstream-конфигурацией. Аналог на JS-стороне —
  `tools/manual-test-ui/test/helpers/fixtures.js` (`makeTempRepo`), который
  решает ту же задачу тем же способом.
- **Тесту не нужны реальные remote/push.** Self-tracking upstream
  моделируется чисто через git-конфиг: `git config branch.issue/<ID>.merge
  refs/heads/issue/<ID>` (+ `branch.issue/<ID>.remote origin`) — Phase 3 только
  читает конфиг и не сверяет его с реальным remote, так что `origin` может не
  существовать физически.
- **Тест должен вытягивать git-команду из самого `SKILL.md`, а не дублировать
  её руками.** Как это уже делают `test/qa-gates.sh` (шаг 1b) и
  `test/skills-static.sh` — через grep/drift-check по тексту скилла. Иначе
  будущая правка Phase 3 или Phase 6 может незаметно разойтись с тестом, а
  тест продолжит зелено проходить, проверяя устаревшую копию команды. Это
  урок, уже задокументированный в кодовой базе (см. drift-guard в
  `test/qa-gates.sh`), и его нужно повторить здесь.

## Оценка размера

`size_tier: small` подтверждается **для вариантов фикса A или B** (дефект 1) —
единственная затронутая единица: один файл скилла (`skills/pf-close/SKILL.md`),
две чётко ограниченные правки, blast radius локализован процессом закрытия
issue. Если на impl-plan будет выбран вариант C, тир нужно пересчитать заново
с учётом второго затронутого файла (`skills/pf-execute/SKILL.md`). Требуется
поведенческий тест на git-фикстуре — это добавляет объёма, но не выводит за
рамки small (не мульти-подсистемный, не 7+ user stories).
