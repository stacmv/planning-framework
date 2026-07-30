---
doc_language: Russian
size_tier: small
---

Два дефекта в `/pf-close`, обойдённые вручную при закрытии `20260729-improve-manual-test-data-and-role-explorer`. Оба воспроизводятся на любом issue, закрываемом штатным путём, и оба тихие: скилл не падает, а делает не то.

## Дефект 1 — Phase 3 принимает upstream-ветку за родительскую

**Что предписано.** Phase 3: «Run `git config branch.issue/ISSUE-ID.merge`. If this returns a value such as `refs/heads/develop`, extract the branch name … Use that as PARENT-BRANCH.»

**Что происходит на самом деле.** `branch.<name>.merge` — это **upstream** ветки, а не её родитель. `/pf-git` («Stage commit & push», шаг 3) предписывает пушить ветку с `-u`, если у неё нет upstream, и `/pf-execute` пушит issue-ветку после каждой волны. Поэтому к моменту закрытия там лежит одноимённая удалённая ветка:

```
$ git config branch.issue/20260729-improve-manual-test-data-and-role-explorer.merge
refs/heads/issue/20260729-improve-manual-test-data-and-role-explorer
```

Буквальное следование инструкции даёт `PARENT-BRANCH` = сама issue-ветка, то есть Phase 4 выполнит `git checkout` на неё же и `git merge --no-ff issue/<ID>` саму в себя. Слияние в `develop` не произойдёт, а Phase 8.5 запушит issue-ветку вместо родителя.

При закрытии `20260729-improve-manual-test-data-and-role-explorer` дефект был замечен и обойдён: родитель взят по fallback-правилу (`develop`). Без ручного вмешательства issue не был бы смержен.

**Направление исправления** (не предрешает решение): родителя следует определять так, чтобы `-u` на issue-ветку не мог его подменить. Кандидаты — читать `branch.<name>.merge` только когда upstream не совпадает с самой веткой; либо не использовать git-config вовсе и опираться на явное правило «родитель = `develop`, иначе `main`», которое уже описано как fallback; либо записывать родителя при создании ветки в `/pf-execute` Phase 0.

## Дефект 2 — Phase 6 ищет историю по пути, которого в ней нет

**Что предписано.** Phase 6, шаг 1: `git log --reverse --format=%aI -- docs/issues/closed/ISSUE-ID | head -1` для получения START-TS.

**Что происходит.** Phase 5 непосредственно перед этим делает `mv` (или `git mv`) из `open/` в `closed/`. Перемещение живёт только в рабочем дереве — прошлые коммиты по-прежнему содержат путь `docs/issues/open/<ID>/`, а коммит архивации ещё не создан (он в Phase 8). Команда возвращает пустую строку:

```
$ git log --reverse --format=%aI -- docs/issues/closed/20260729-improve-manual-test-data-and-role-explorer | head -1
(пусто)
```

Скилл сам предусматривает этот исход — «If it returns nothing, skip auto-computation (step 2)» — то есть **отчёт о расходе LLM не считается никогда**, при штатном порядке фаз. Дефект замаскирован собственным обработчиком: вместо ошибки получается пустой отчёт с пометкой «окно определить не удалось».

При закрытии `20260729-improve-manual-test-data-and-role-explorer` обойдено вручную — история взята по прежнему пути `docs/issues/open/<ID>`, окно получилось корректным.

**Направление исправления:** читать историю по пути `docs/issues/open/<ID>` (он и есть путь, по которому issue жил), либо использовать `git log --follow`, либо перенести вычисление окна до Phase 5.

## Что важно при исправлении

- **Проверить оба дефекта тестом, а не только текстом скилла.** В репозитории для этого есть подходящий уровень: `test/skills-static.sh` умеет утверждать форму инструкции, но здесь важнее поведение git — фикстурный репозиторий с issue-веткой, у которой выставлен upstream на саму себя, покажет дефект 1 нагляднее любого грепа. `test/lib.sh` предоставляет `pf_repo_copy`; каталог `tools/manual-test-ui/test/helpers/fixtures.js` показывает, как строятся временные git-репозитории с ветками.
- **Не трогать Phase 8.5.** Гард на `main`/`master` и на отсутствие remote работает корректно и переиспользован в `/pf-git`; менять его в рамках этого issue не требуется.
- Оба дефекта живут в одном файле `skills/pf-close/SKILL.md`.
