# QA Report

**Issue ID:** 20260806-bug-test-plan-tc-untracked
**Date:** 2026-08-11
**Agent:** Claude

---

## Automated Checks

| Check | Command | Result | Output |
|-------|---------|--------|--------|
| Shellcheck | `shellcheck scripts/*.sh test/*.sh` | ✓ PASS | rc=0, ноль замечаний |
| No leftover debug output | `git diff develop...HEAD -- . ':!tools/' ':!test/' \| grep -E "^\+.*(console\.log\|debugger;\|set -x)"` | ✓ PASS | 0 совпадений |
| No unresolved TODOs | `git diff develop...HEAD -- . ':!docs/issues/' ':!test/' ':!.qa-workflow.md' \| grep -E "^\+.*TODO" \| grep -v 'TODO: Run /pf-'` | ✓ PASS | 0 совпадений |
| Every TC processed | `grep -c '\| \[ \] *\|' docs/issues/open/<ID>/test_plan.md` | ✓ PASS | 0 |
| No TC failed | `grep -c '\| ✗ *\|' docs/issues/open/<ID>/test_plan.md` | ✓ PASS | 0 |
| No hardcoded secrets | `git diff develop...HEAD \| grep -iE "^\+.*(api[_-]?key\|secret\|password\|token)\s*=\s*['\"]"` | ✓ PASS | 0 совпадений |
| No unsafe remote execution | `git diff develop...HEAD \| grep -E "^\+.*curl.*\|\s*(ba)?sh"` | ✓ PASS | 0 совпадений |
| Working tree clean | `git status --porcelain` | ✓ PASS | пусто |
| Branch up to date with parent | `git merge-base --is-ancestor develop HEAD` | ✓ PASS | rc=0 |
| Project Scope Guard | `git diff --name-only develop...HEAD \| grep -vE '^(tools\|test)/' \| grep -E '\.(tsx?\|jsx?\|py\|rb\|go\|sql)$\|^\.github/workflows/'` | ✓ PASS | 0 совпадений |

---

## Manual QA Items

### Code Quality
- [x] **[AI check] No commented-out instruction blocks left in changed skill files** — добавленных строк, начинающихся с `#`, в диффе `skills/` нет вовсе.

### Testing
- [x] **[Human check] Manual test checklist has been run** — все 12 шагов TC-008 отмечены `[x]` с записанным фактическим результатом. **Подтверждение агентское, не человеческое** — решение владельца, зафиксировано в чек-листе и в session-log.

### Documentation
- [x] **[AI check] Docs match the change** — `prompt.md` не подразумевает правки пользовательской документации. `CHANGELOG.md` в этом репозитории при изменениях `skills/` не правят: проверены 5 последних коммитов по этому каталогу, ни один его не трогал.

### Bug Issues
- [x] **[Human check] Bug no longer reproduces** — засчитано по доказательствам прогона TC-008 round 2: `Auto`-TC, покрытый bash-конвенцией `pf_pass "TC-NNN ..."`, находится и получает статус. Оговорка ниже в Risks.
- [x] **[AI check] Root cause addressed** — `analysis.md` называет корневой причиной то, что Phase 3.2 `pf-test/SKILL.md` — инструкция на естественном языке, перечисляющая только три JS/Python-конвенции. Дифф меняет ровно этот раздел (плюс 3.1, 3.3, Phase 2 и ветку Phase 4 → Phase 5).

### Pre-Merge
- [x] **[AI check] Commit messages are descriptive** — 12 коммитов ветки, каждый называет предмет изменения; `wip`/`fix`/`updates` без пояснения нет.
- [x] **[AI check] No unrelated changes** — единственным необъяснённым файлом был `Makefile`. Устранено: `implementation_plan.md` дополнен записью в «Files to Create/Modify» и Task 7 с указанием происхождения правки (прямой запрос владельца по ходу сессии). Все остальные изменённые файлы — либо объявленные планом, либо документы самой issue.

---

## Risks

⚠ Предсуществующие падения вне области этой issue: `test/manual-test-ui.sh` даёт 2 провала (`TC-011` в `tools/manual-test-ui/test/read-paths.test.js` и «server did not start»). Проверено: ветка не трогает `tools/` вовсе, и те же тесты падают на чистом `develop`. На вердикт не влияют — QA-workflow этого репозитория не гоняет `make test`, — но заслуживают отдельной issue. Похоже на Windows-специфику: во втором случае фикстурный путь `D:\tmp\pf-test-*` не существует к моменту старта сервера.

⚠ Подтверждение единственного `Manual`-кейса (TC-008) выполнено агентом, а не человеком, и в той же сессии, что и исправление. Инструкцию интерпретировал тот же агент, который её правил. Независимая проверка человеком не заменяется этим прогоном.

⚠ Исправление находится в репозитории, но **не установлено** в `~/.claude/skills/` на машине, где велась работа. До `make converge` / `/pf-update` установленная копия `/pf-test` продолжает содержать старый текст. Это осознанное решение: заливать не прошедшую приёмку версию в глобальные скиллы было бы хуже.

⚠ Покрытие пути v2 → v3 переведено в режим «по требованию»: `converge-migrate.sh` исключён из `make test` (Task 7). Код миграции остаётся в `scripts/converge-to-v3.sh` и исполняется при каждом `converge`, но регресс по нему больше не ловится автоматически — только через `make test-migration`.

---

## Blockers

_None._

---

## Verdict

**PASS**
