# QA Report

**Issue ID:** 20260812-bug-flaky-manual-test-ui
**Date:** 2026-08-13
**Agent:** Claude

---

## Automated Checks

| Check | Command | Result | Output |
|-------|---------|--------|--------|
| Shellcheck | `shellcheck scripts/*.sh test/*.sh` | ✓ PASS | — |
| No debug output introduced | `git diff develop...HEAD -- . ':!tools/' ':!test/' \| grep -E "^\+.*(console\.log\|debugger;\|set -x)"` | ✓ PASS | нет совпадений (негативная проверка: пустой вывод = успех) |
| No unresolved TODOs introduced | `git diff develop...HEAD -- . ':!docs/issues/' ':!test/' ':!.qa-workflow.md' \| grep -E "^\+.*TODO" \| grep -v 'TODO: Run /pf-'` | ✓ PASS | нет совпадений |
| No hardcoded secrets | `git diff develop...HEAD \| grep -iE "^\+.*(api[_-]?key\|secret\|password\|token)\s*=\s*['\"]"` | ✓ PASS | нет совпадений |
| No unsafe remote execution | `git diff develop...HEAD \| grep -E "^\+.*curl.*\|\s*(ba)?sh"` | ✓ PASS | нет совпадений |
| No app-code/CI files outside tools/ и test/ | `git diff --name-only develop...HEAD \| grep -vE '^(tools\|test)/' \| grep -E '\.(tsx?\|jsx?\|py\|rb\|go\|sql)$\|^\.github/workflows/'` | ✓ PASS | нет совпадений (см. Примечание 1) |
| Every TC processed | `grep -c '\| \[ \] *\|' …/test_plan.md` | ✓ PASS | `0` |
| No TC failed | `grep -c '\| ✗ *\|' …/test_plan.md` | ✓ PASS | `0` |
| Working tree clean | `git status --porcelain` | ✓ PASS | пусто |
| Branch up to date with parent | `git merge-base --is-ancestor develop HEAD` | ✓ PASS | exit 0 |
| Full test suite | `make test` | ✓ PASS | `make test: OK`, exit 0 — 816 проверок в 18 сьютах, 0 падений; `manual-test-ui.sh: 36 passed, 0 failed` |

**Примечание 1.** Эта проверка была красной на первом проходе: `/pf-test` Phase 5.2.1
предписала сгенерировать `test-data/fixtures/…/read-paths.test.js`, и файл с расширением
`.js` под `docs/` не покрывается исключением `^(tools|test)/`. Копия удалена — не ради
прохождения гейта, а по существу: в ней `require("./helpers/fixtures")` и
`require("../lib/paths")`, автономно она неработоспособна. Гейт указал на реальный дефект
артефакта.

---

## Manual QA Items

### Code Quality

- [x] **[AI check] Нет закомментированных блоков инструкций в изменённых файлах скиллов** — файлы скиллов в этом диффе не менялись вовсе (`skills/` отсутствует в `git diff --name-only develop...HEAD`), проверять нечего.

### Testing

- [x] **[Human check] Ручной чек-лист прогнан** — все 17 шагов четырёх ручных кейсов выполнены, ни одного пустого поля результата; по каждому кейсу записаны заметки с фактическими данными. TC-003 и TC-006 выполнены в WSL Ubuntu, TC-007 и TC-008 — на Windows, включая отдельную рабочую копию на диске `C:`.

### Documentation

- [x] **[AI check] Документация соответствует изменению** — `prompt.md` не подразумевает обновления пользовательской документации: issue правит тестовый код и не меняет пользовательской поверхности. `user_docs`/`dev_docs` разрешаются в `skip` по tier-default для `size_tier: small`.

### Bug Issues

- [x] **[Human check] Баг больше не воспроизводится** — доказано процедурой TC-008: на чистом `develop` оба прогона дали идентичные `16 passed, 2 failed` с теми самыми двумя падениями из `prompt.md`; на ветке оба прогона — `36 passed, 0 failed`.
- [x] **[AI check] Корневая причина устранена** — дифф меняет ровно те места, которые названы причинами: `fs.symlinkSync` вынесен из `buildFixture()` в собственный шаг (`read-paths.test.js`), запись `projects.json` переведена с `printf` на сериализатор с конвертацией пути (`manual-test-ui.sh`). См. Примечание 2 о четвёртой причине.

### Pre-Merge

- [x] **[AI check] Сообщения коммитов содержательны** — семь коммитов, каждый описывает существо изменения; заглушек вида «wip»/«fix» нет.
- [x] **[AI check] Нет посторонних изменений** — продуктовых файлов изменено два, оба перечислены в `implementation_plan.md`: `test/manual-test-ui.sh` и `tools/manual-test-ui/test/read-paths.test.js`. Остальные изменённые пути — служебные артефакты самого пайплайна (документы issue и `docs/planning/tech-debt.md`, который предписан процедурой стадии code review). Ни один план файлов их не перечисляет и перечислять не должен: это бухгалтерия процесса, а не изменение продукта.

---

## Risks

⚠ Известный предсуществующий дефект, **вне объёма этой issue**: набор `tools/manual-test-ui`
перемежающеся падает на Windows под параллельным исполнением файлов — `fs.renameSync` в
`skills/pf-test/templates/setup.mjs` даёт `EPERM`, пока в дереве открыт хендл. Замеры:
`--test-concurrency=1` — 6 зелёных из 6; на Linux не воспроизводится; файлы `prepare*.test.js`
побайтно совпадают с `develop`. Зарегистрирован в `docs/planning/tech-debt.md` как кандидат в
отдельную issue. На вердикт не влияет: это не находка ревью и не регрессия этой правки —
процедура атрибуции TC-008 явно относит его к предсуществующим.

---

## Blockers

_None._

---

## Verdict

**PASS**
