# QA Report

**Issue ID:** 20260904-improve-test-suite-runtime
**Date:** 2026-09-09
**Agent:** Claude

---

## Automated Checks

| Check | Command | Result | Output |
|-------|---------|--------|--------|
| Shellcheck | `shellcheck scripts/*.sh test/*.sh` | ✓ PASS | — |
| Нет отладочного вывода | `git diff develop...HEAD -- . ':!tools/' ':!test/' ':!docs/issues/' ':!.qa-workflow.md' ':!skills/pf/templates/' \| grep -E "^\+.*(console\.log\|debugger;\|set -x)"` | ✓ PASS | ноль совпадений |
| Нет незакрытых TODO | `git diff develop...HEAD -- . ':!docs/issues/' ':!test/' ':!.qa-workflow.md' ':!skills/pf/templates/' \| grep -E "^\+.*TODO" \| grep -v 'TODO: Run /pf-'` | ✓ PASS | ноль совпадений |
| Трекер: нет необработанных строк | `grep -c '\| \[ \] *\|' docs/issues/open/20260904-improve-test-suite-runtime/test_plan.md` | ✓ PASS | `0` |
| Трекер: нет провалившихся строк | `grep -c '\| ✗ *\|' docs/issues/open/20260904-improve-test-suite-runtime/test_plan.md` | ✓ PASS | `0` |
| Нет секретов в коде | `git diff develop...HEAD \| grep -iE "^\+.*(api[_-]?key\|secret\|password\|token)\s*=\s*['\"]"` | ✓ PASS | ноль совпадений |
| Нет `curl \| sh` | `git diff develop...HEAD \| grep -E "^\+.*curl.*\|\s*(ba)?sh"` | ✓ PASS | ноль совпадений |
| Рабочее дерево чистое | `git status --porcelain` | ✓ PASS | пусто |
| Ветка содержит develop | `git merge-base --is-ancestor develop HEAD` | ✓ PASS | exit 0 |
| Scope guard | `git diff --name-only develop...HEAD \| grep -vE '^(tools\|test)/' \| grep -E '\.(tsx?\|jsx?\|py\|rb\|go\|sql)$\|^\.github/workflows/'` | ✓ PASS | ноль совпадений |
| Полный набор тестов | `make test` | ✓ PASS | `make test: OK` — 27 сьютов, 1151 ассерт, 0 провалов, 10.02 с |
| Линтер | `make lint` | ✓ PASS | `make lint: OK` |
| Миграционный набор | `make test-migration` | ✓ PASS | `make test-migration: OK` — 193 ассерта |

---

## Manual QA Items

### Code Quality

- [x] **[AI check] Нет закомментированных блоков инструкций в изменённых файлах скиллов** — в диффе нет ни одного `skills/*/SKILL.md`; изменения затрагивают `Makefile`, `scripts/converge-to-v3.sh`, `test/*` и документы.

### Documentation

- [x] **[AI check] Документация соответствует изменению** — `make lint` появился как отдельная цель, поэтому в `CONTRIBUTING.md` (блок «Test your changes») добавлен его прогон: раньше инструкция звала только `make test`, и участник линтовал бы пустоту.

### Version Bump

- [x] **[AI check] CHANGELOG обновлён** — изменяется `scripts/converge-to-v3.sh` (скрипт, который запускают проекты-потребители), поэтому в `## [Unreleased] / Fixed` добавлены три пункта: ускорение прогона с разбором настоящей причины, потеря кода возврата в фазе 6 и гард `pf_repo_copy` против worktree. `PF_VERSION` намеренно не двигается — это отдельный акт выпуска.

### Feature Issues (improve)

- [x] **[AI check] Дифф покрывает все критерии приёмки** — незакрытых `- [ ]` в `implementation_plan.md` не осталось (проверено `grep`: 0).
- [x] **[AI check] Дифф соответствует заявленному скоупу** — все 14 изменённых файлов перечислены в разделе «Files touched» плана реализации.

### Pre-Merge

- [x] **[AI check] Сообщения коммитов описательные** — 11 коммитов, каждый называет, что именно изменено и почему; ни одного «wip»/«fix».
- [x] **[AI check] Нет посторонних изменений** — см. пункт о скоупе выше.

### Ручные тест-кейсы

Не являются гейтом в этом проекте (решение пользователя от 2026-09-09, зафиксировано в `.qa-workflow.md`, раздел Testing). `manual_test_checklist.md` сформирован и содержит два кейса: TC-008 (замер гипотезы Dev Drive/Defender, только Windows) и TC-010 (ветка эскалации, предусловие не наступило). Оба не отмечены пройденными и честно это поясняют.

---

## Risks

⚠ Гипотеза меры 6 (перенос `TMPDIR` на Dev Drive / исключения Defender) не проверена: работа шла на Ubuntu, где этих настроек нет. Практического значения для этой машины не имеет — прогон занимает 10-19 с при бюджете 420 с, — но на Windows-машине цифры будут другими, и TC-008 остаётся открытым для неё.

⚠ Прогон тестов из git-worktree невозможен: `pf_repo_copy` теперь падает явно, потому что копия worktree остаётся привязанной к настоящему репозиторию. Это ограничивает изоляцию параллельных агентов через worktree в этом репозитории. Записано в `docs/planning/tech-debt.md` вместе с наброском полноценного решения.

⚠ Замеренное время прогона зависит от загрузки машины: 10.0 с на спокойной системе, 14.9-22.0 с при load average около 8. Обе цифры — реальные прогоны и обе далеки от бюджета.

---

## Blockers

_None._

---

## Verdict

**PASS**
