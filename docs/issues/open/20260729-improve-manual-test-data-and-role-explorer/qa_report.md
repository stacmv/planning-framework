# QA Report

**Issue ID:** 20260729-improve-manual-test-data-and-role-explorer
**Date:** 2026-07-29
**Agent:** Claude

---

## Automated Checks

| Check | Command | Result | Output |
|-------|---------|--------|--------|
| Shellcheck passes | `shellcheck scripts/*.sh test/*.sh` | ✓ PASS | exit 0 — после исправления двух находок SC2016 (см. Notes) |
| No leftover debug output | `git diff develop...HEAD -- . ':!tools/' ':!test/' \| grep -E "^\+.*(console\.log\|debugger;\|set -x)"` | ✓ PASS | 0 совпадений |
| No unresolved TODOs | `git diff develop...HEAD -- . ':!docs/issues/' ':!test/' ':!.qa-workflow.md' \| grep -E "^\+.*TODO" \| grep -v 'TODO: Run /pf-'` | ✓ PASS | 0 совпадений |
| Tracker: no unprocessed rows | `grep -c '\| \[ \] *\|' …/test_plan.md` | ✓ PASS | 0 |
| Tracker: no failed rows | `grep -c '\| ✗ *\|' …/test_plan.md` | ✓ PASS | 0 (20 строк ✓) |
| No hardcoded secrets | `git diff develop...HEAD \| grep -iE "^\+.*(api[_-]?key\|secret\|password\|token)\s*=\s*['\"]"` | ✓ PASS | 0 совпадений |
| No unsafe remote execution | `git diff develop...HEAD \| grep -E "^\+.*curl.*\\\|\s*(ba)?sh"` | ✓ PASS | 0 совпадений |
| Working tree clean | `git status --porcelain` | ✓ PASS | пусто |
| Branch up to date with parent | `git merge-base --is-ancestor develop HEAD` | ✓ PASS | exit 0 |
| Project Scope Guard | `git diff --name-only develop...HEAD \| grep -vE '^(tools\|test)/' \| grep -E '\.(tsx?\|jsx?\|py\|rb\|go\|sql)$\|^\.github/workflows/'` | ✓ PASS | 0 совпадений |

---

## Manual QA Items

### Code Quality

- [x] **[AI check] No commented-out instruction blocks left in changed skill files** — в трёх изменённых `SKILL.md` единственная строка с одиночным `#` — это `# Manual Test Checklist` внутри блока с шаблоном документа (`skills/pf-test/SKILL.md:119`), то есть заголовок примера, а не отключённая инструкция.

### Testing

- [x] **[Human check] Manual test checklist has been run** — подтверждено владельцем проекта в этой сессии. Оба ручных кейса пройдены, все 16 шагов заполнены, незаполненных нет. Шаг 7 TC-020 при первом прогоне провален и перепройден после исправления — история сохранена в `manual_test_checklist.md`.

### Documentation

- [x] **[AI check] Docs match the change** — issue затрагивает пользовательскую документацию инструмента, и она обновлена: `tools/manual-test-ui/README.md` переписан под текущую реализацию (роли, состояния документов, подготовка данных, все новые маршруты, переменные окружения), `skills/pf-manual-test/SKILL.md` обновлён.

### Feature Issues (feat, improve)

- [x] **[AI check] Diff satisfies every acceptance criterion** — все 23 строки `Acceptance Criteria` в `implementation_plan.md` отмечены `[x]`; каждая соответствует пройденному тест-кейсу (20 из 20 в Status Tracker).
- [x] **[AI check] Diff matches declared scope** — 53 изменённых файла. 41 назван в разделе «Files to Create/Modify» плана. Остальные 12 прослеживаются к объявленным задачам и не являются посторонними: документы самого issue, порождаемые стадиями пайплайна (`test_plan.md`, `manual_test_checklist.md`), фикстуры `test-data/` из Task 16 (план называл их обобщённо, поимённо они определены полями Test Data кейсов TC-019/TC-020) и фикстуры тестового харнесса под `tools/manual-test-ui/test/fixtures/` из задач 2, 3 и 4.

### Pre-Merge Checklist

- [x] **[AI check] Commit messages are descriptive** — 12 коммитов ветки; каждый называет, что именно изменилось и почему; сообщений вида «wip»/«fix»/«updates» нет.
- [x] **[AI check] No unrelated changes** — см. пункт про объём выше; файлов вне прослеживаемого списка нет.

---

## Blockers

_None._

---

## Notes

Три обстоятельства, которые стоит знать читателю отчёта.

**1. `shellcheck` пришлось доставить, и он нашёл две настоящие находки.** В системе инструмент отсутствовал, поэтому обязательная проверка не могла быть выполнена вовсе — в прошлых отчётах этого проекта она по той же причине записывалась как SKIPPED. По решению владельца проекта бинарник 0.10.0 загружен в каталог сессии (без изменений в системе и без прав root) и проверка выполнена по-настоящему. Найдено два предупреждения SC2016, оба исправлены:
- `test/manual-test-ui.sh:69` — новый файл этого issue;
- `test/skills-static.sh:590` — строка, добавленная в этой же сессии при доработке `/pf-autopilot`; disable-комментарий был расставлен на соседних строках и пропущен на этой.

Обе — обратные кавычки внутри одинарных, то есть markdown в тексте метки, а не подстановка команды. После исправления `shellcheck scripts/*.sh test/*.sh` завершается с кодом 0.

**2. `make test` возвращает ошибку, и это не дефект этого issue.** Падает единственный ассерт — `test/qa-gates.sh` step 6. Он берёт **первый по алфавиту** `test_plan.md` из `docs/issues/open/` (`test/qa-gates.sh:154`), а это `20260715-bug-gates-verification-and-tooling-fixes` — другой открытый issue, стоящий на стадии test_plan с десятью незаполненными строками трекера. Трекер настоящего issue он не читает; в нём 0 незаполненных и 0 проваленных строк. Все остальные наборы зелёные: 143 node-теста, `manual-test-ui.sh` 18/18, `skills-static.sh` 84/84.

**3. Дефект, найденный ручным тестированием, исправлен внутри issue.** TC-020 шаг 7 показал, что после перезагрузки страница открывалась на первом проекте и роли аналитика, теряя место читателя. Причина — клиент не сохранял выбор нигде. Исправлено коммитом `f0032e1`; проверено в headless-браузере на заведомо не-дефолтном выборе и перепройдено владельцем вручную. Это ровно тот класс дефектов, ради которого кейс и оставляли ручным: вся автоматика при нём была зелёной.

---

## Verdict

**PASS**
