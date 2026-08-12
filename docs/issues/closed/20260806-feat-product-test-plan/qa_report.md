# QA Report

**Issue ID:** 20260806-feat-product-test-plan
**Date:** 2026-08-12
**Agent:** Claude

---

## Automated Checks

**Замечание о чтении кодов возврата.** Семь из десяти команд `.qa-workflow.md` —
**отрицательные** grep'ы: они ищут то, чего быть не должно (отладочный вывод,
`TODO`, секреты, `curl | sh`, файлы вне объёма). Для них код возврата `1`
означает «совпадений нет», то есть успех. Правило `pf-qa` Phase 2 («exit 0 →
PASS, ненулевой → FAIL») применённое буквально объявило бы провалом отсутствие
секретов в диффе, поэтому результат ниже определён по смыслу проверки, а колонка
`Exit` приведена отдельно, чтобы расхождение было видно. Это дефект самого скилла,
а не этой issue — вынесен в конец отчёта.

| Check | Command | Exit | Result | Output |
|-------|---------|------|--------|--------|
| Shellcheck | `shellcheck scripts/*.sh test/*.sh` | 0 | ✓ PASS | — |
| No debug output | `git diff develop...HEAD … \| grep -E "^\+.*(console\.log\|debugger;\|set -x)"` | 1 | ✓ PASS | нет совпадений |
| No unresolved TODOs | `git diff develop...HEAD … \| grep -E "^\+.*TODO" \| grep -v 'TODO: Run /pf-'` | 1 | ✓ PASS | нет совпадений |
| All TCs done | `grep -c '\| \[ \] *\|' …/test_plan.md` | 1 | ✓ PASS | `0` — неотмеченных строк нет |
| No TC failed | `grep -c '\| ✗ *\|' …/test_plan.md` | 1 | ✓ PASS | `0` — провалившихся строк нет |
| No hardcoded secrets | `git diff develop...HEAD \| grep -iE "^\+.*(api[_-]?key\|secret\|password\|token)\s*=\s*['\"]"` | 1 | ✓ PASS | нет совпадений |
| No unsafe remote exec | `git diff develop...HEAD \| grep -E "^\+.*curl.*\\\|\s*(ba)?sh"` | 1 | ✓ PASS | нет совпадений |
| Working tree clean | `git status --porcelain` | 0 | ✓ PASS | пустой вывод |
| Branch up to date | `git merge-base --is-ancestor develop HEAD` | 0 | ✓ PASS | — |
| Scope guard | `git diff --name-only develop...HEAD \| grep -vE '^(tools\|test)/' \| grep -E '\.(tsx?\|jsx?\|py\|rb\|go\|sql)$\|^\.github/workflows/'` | 1 | ✓ PASS | нет совпадений — issue трогает только `.md` и `.sh` |

**Полный прогон сьюта** (`make test`, отдельно от таблицы выше): `pf-product-test-plan.sh`
— **82 passed, 0 failed**. Общий результат `make test` — FAILED из-за двух
предсуществующих средовых падений: `manual-test-ui.sh` (2 кейса) и `read-paths.test.js`
TC-011 (`EPERM` на `symlinkSync`/`rename` под Windows). Проверено прямым прогоном
`manual-test-ui.sh` на чистом `develop` в отдельном worktree: **16 passed, 2 failed**
— идентично. Ветка не трогает ни одного файла под `tools/`. К предмету issue не
относится, блокером не считается.

---

## Manual QA Items

### Code Quality

- [x] **[Automated] Shellcheck passes**
- [x] **[Automated] No leftover debug output introduced**
- [x] **[Automated] No unresolved TODOs introduced by this issue**
- [x] **[AI check] No commented-out instruction blocks left in changed skill files** — единственная добавленная строка на `#` в изменённых `SKILL.md` — markdown-заголовок `## Phase 4.5`, не отключённая инструкция.

### Testing

- [x] **[Automated] Every TC in this issue's Status Tracker is marked done AND none failed** — 21 строка, неотмеченных `0`, провалившихся `0`.
- [x] **[Human check] Manual test checklist has been run** — зачтено решением владельца: оба ручных кейса (TC-014, TC-016) прогнаны агентом по протоколу изолированной копии и задокументированы в Status Tracker с пометкой `agent-performed`. Именно этот прогон нашёл блокирующий дефект формата номера (`| 1 |` вместо `| PTC-0001 |`), который автотесты пропустили по построению. `manual_test_checklist.md` остаётся чистым шаблоном для релизной проверки, а не протоколом этого прогона.

### Documentation

- [x] **[AI check] Docs match the change** — `user_docs.md` (126 строк) и `dev_docs.md` (251 строка) написаны и прошли ревью. `README`/`CHANGELOG` самого репозитория эта issue не требует править: изменение адресовано проектам-потребителям, и текст для их `CHANGELOG` подготовлен в `user_docs.md`.

### Security

- [x] **[Automated] No hardcoded secrets introduced**
- [x] **[Automated] No unsafe remote-execution pattern introduced**

### Feature Issues (feat, improve)

- [x] **[AI check] Diff satisfies every acceptance criterion** — 24 критерия отмечены `[x]`, ни одного открытого. Критерии Task 1 отмечены после фактической механической проверки каждого, а не по памяти.
- [x] **[AI check] Diff matches declared scope** — расхождение найдено и устранено: `test/lib.sh` и `test/pf-test-tc-mapping-static.sh` менялись, но отсутствовали в таблице «Files to Create/Modify». Таблица дополнена обоими с обоснованиями (решение владельца — оставить их в объёме этой issue).

### Pre-Merge Checklist

- [x] **[Automated] Working tree clean**
- [x] **[Automated] Branch is up to date with parent**
- [x] **[AI check] Commit messages are descriptive** — 26 коммитов, ни одного вида `wip`/`fix`/`updates`; каждый несёт тип, предмет правки и ID issue.
- [x] **[AI check] No unrelated changes** — см. пункт про объём выше.

### Project Scope Guard

- [x] **[Automated] No application-code or CI files introduced** — изменены только `.md` и `.sh`.

### Bug Issues

Не применимо — тип issue `feat`.

---

## Risks

`roles.code.review` для этой issue — `[claude, codex]`, не `skip`, поэтому риска
«ревью пропущено» нет. Ревью прошло пять проходов двумя независимыми ревьюерами,
вердикт `code_review.md` — `PASS`.

Ниже — не блокеры, а то, что стоит знать при работе с результатом:

- **Валидатор формата не доезжает до проектов-потребителей.** `pf_validate_test_plan_file`
  живёт в `test/pf-product-test-plan.sh`; `converge` зеркалит только
  `docs/planning/templates`, `update-skills` копирует только `skills/`. В стороннем
  проекте испорченная руками строка и коллизия номеров при параллельном закрытии
  обнаруживаются только глазами. Зафиксировано в `user_docs.md` как предупреждение и
  в `dev_docs.md` (ADR-4) как следствие решения.
- **Скилл требует доставки.** Реальные закрытия в проектах продолжат исполнять
  установленную версию `~/.claude/skills/pf-close/SKILL.md` без Phase 4.5, пока не
  выполнен `make update-skills` / `/pf-update` — вне объёма этой issue.
- **Восстановление после сбоя не бесшовно.** Phase 0 требует ручного
  `git checkout issue/<ID>`; приводить её и семантику уборки Phase 2 к автоматическому
  возобновлению значило бы менять существующее поведение `/pf-close` вне объёма issue.
  Процедура задокументирована в самой Phase 4.5 и в runbook.
- **`assert_repo_untouched` не покрывает запись за пределы репозитория.** В ходе этой
  issue это реализовалось: субагент создал файлы-пробники в корне Git Bash при зелёном
  сьюте. Действующая защита — конвенция (проверять путь на непустоту до использования),
  не автоматика. Задокументировано в `test/lib.sh` (S-5 KNOWN GAP).
- **Дефект скилла `pf-qa`.** Phase 2 предписывает «exit 0 → PASS, ненулевой → FAIL», что
  неверно для отрицательных grep-проверок, из которых состоит большая часть
  `.qa-workflow.md` этого проекта. Буквальное применение дало бы семь ложных провалов.
  Требует отдельной issue.

---

## Blockers

_None._

---

## Verdict

**PASS**
