# QA Report

**Issue ID:** 20260713-bug-v2-to-v3-migration-defects
**Date:** 2026-07-13
**Agent:** Claude

---

## Automated Checks

> **Замечание о трактовке кодов возврата.** Гейты в `.qa-workflow.md` сформулированы как «`grep` возвращает **ноль совпадений**», а `grep` без совпадений выходит с кодом **1**. Наивное правило «exit 0 = PASS» дало бы здесь ровно обратный результат. Ниже проверки оценены **по смыслу гейта**, а не по коду возврата.

| Check | Command | Result | Output |
|-------|---------|--------|--------|
| Shellcheck | `shellcheck scripts/*.sh test/*.sh` | ✓ PASS | rc=0. **Впервые зелёный в истории репозитория** — все 13 прежних находок сидели в четырёх удалённых скриптах, а каждый прошлый `qa_report.md` фиксировал shellcheck как SKIPPED |
| No debug output | `git diff develop...HEAD -- . ':!tools/' ':!test/' \| grep -E "^\+.*(console\.log\|debugger;\|set -x)"` | ✓ PASS | 0 совпадений — **после правки гейта, см. блок ниже** |
| No unresolved TODOs | `git diff develop...HEAD -- . ':!docs/issues/' ':!test/' \| grep -E "^\+.*TODO" \| grep -v 'TODO: Run /pf-'` | ✓ PASS | 0 совпадений |
| Testing: все TC отмечены | `grep -c '\| \[ \] *\|' …/test_plan.md` | ✗ FAIL | **6** — шесть Manual-кейсов. См. блокер B-1 |
| No hardcoded secrets | `git diff develop...HEAD \| grep -iE "^\+.*(api[_-]?key\|secret\|password\|token)\s*=\s*['\"]"` | ✓ PASS | 0 совпадений |
| No unsafe remote-exec | `git diff develop...HEAD \| grep -E "^\+.*curl.*\|\s*(ba)?sh"` | ✓ PASS | 0 совпадений |
| Working tree clean | `git status --porcelain` | ✓ PASS | пусто |
| Branch up to date | `git merge-base --is-ancestor develop HEAD` | ✓ PASS | rc=0 |
| Project Scope Guard | `git diff --name-only develop...HEAD \| grep -vE '^(tools\|test)/' \| grep -E '\.(tsx?\|jsx?\|py\|rb\|go\|sql)$\|^\.github/workflows/'` | ✓ PASS | 0 совпадений |
| Test suite | `make test` | ✓ PASS | 726 bash + 30 node, 0 падений |

### Гейт отладочного вывода пришлось починить по ходу QA

Гейт `No leftover debug output` **падал с 20 совпадениями** — и все двадцать были ложными. Они пришли из `test/fixtures/`: восемнадцать — текст QA-чеклиста внутри шаблонов, которые фикстуры имитируют («Remove console.logs…»), два — `console.log('hello from a project that has never seen the Planning Framework')` в фикстуре, изображающей обычный проект. Двадцать один затронутый файл, все под `test/fixtures/`, вне `test/` — **ноль**.

Причина: правка Р6 (Task 1) исключила `test/` из TODO-гейта и из Project Scope Guard — по той самой причине, что фикстуры **по определению изображают чужие проекты**, — но забыла исключить его из гейта отладочного вывода. Гейт ловил декорации, а не код. Исключение добавлено, формулировка та же, что уже была написана для двух других гейтов.

---

## Manual QA Items

### Code Quality
- [x] **[AI check] No commented-out instruction blocks left in changed skill files** — проверены все девять изменённых `SKILL.md`; закомментированных инструкций нет.

### Testing
- [ ] **[Human check] Manual test checklist has been run** ← FAIL — не выполнено. См. блокер B-1.

### Documentation
- [x] **[AI check] Docs match the change** — `prompt.md` подразумевал правку пользовательской документации; `README.md`, `CLAUDE.md`, `QUICKSTART.md`, `FRAMEWORK.md` изменены, добавлен новый `MIGRATION-GUIDE-V3.md`. Механически подтверждено тестом `test/docs-refs.sh` (47 проверок).

### Bug Issues
- [ ] **[Human check] Bug no longer reproduces** ← FAIL — не проверялось на живом `llama-server`. См. блокер B-2.
- [x] **[AI check] Root cause addressed** — корневая причина по `analysis.md`: скилы считали стадию завершённой **по факту существования файла**. Диф меняет ровно этот путь: единое определение «стадия завершена» в `skills/pf-size-tiers/SKILL.md`, семь гейтов **ссылаются** на него, четыре таблицы маршрутизации ключуются на первой **незавершённой** стадии. Подтверждено негативно: против копии репозитория с откаченным `skills/` падают **43 из 50** статических проверок.

### Pre-Merge
- [x] **[AI check] Commit messages are descriptive** — восемь коммитов, каждый описывает суть изменения, ни одного «wip»/«fix»/«updates».
- [x] **[AI check] No unrelated changes** — сверка дифа со списками Create/Modify/Delete из `implementation_plan.md` (таблицы объявлены **нормативными**). Обнаружено **одно** несоответствие: `test/docs-refs.sh` отсутствовал в Create-таблице — исполнитель Task 11 придумал имя файла сам. По правилу самого гейта это «пробел в плане», и пробел закрыт: файл внесён в таблицу с пояснением. Прочие расхождения оказались артефактами грепа (план перечисляет файлы группами: `{prompt,analysis,test_plan,implementation_plan}.md`, `pf-spec` без префикса `skills/`, «весь корневой `templates/`»).

> Секция **Feature Issues (feat, improve)** к этому issue не применяется — тип `bug`.

---

## Blockers

**B-1. Ручное тестирование не выполнено.** `manual_test_checklist.md` создан (шесть сценариев), но человеком не пройден. Из-за этого шесть Manual-строк в Status Tracker остаются `[ ]`, и автоматический гейт `Testing` («все TC отмечены») закономерно падает.

Это **не дефект кода — это незавершённый этап**. Шесть сценариев требуют живой сессии Claude Code и настоящей пользовательской папки `~/.claude/`, поэтому машиной невыполнимы принципиально. Среди них — **TC-047**, самый опасный: пользователь мигрированного issue отвечает «trivial», короткая схема смотрит на наличие файлов напрямую, а на диске лежит заглушка. Мимо этой двери прошли пять редакций плана подряд; статические проверки её закрывают, но живой прогон её не подтверждал.

**B-2. Воспроизведение исходного бага на `llama-server` не проверено.** Гейт bug-issue требует пройти исходные шаги воспроизведения из `analysis.md` против исправленного кода. Не выполнялось.

Косвенное покрытие есть и оно сильное: фикстура `v2-with-stub` воспроизводит ровно тот сценарий, а 55 статических проверок ловят его регрессию (негативная проверка: 43 из 50 падают на старых скилах). Но это **не замена живому прогону** на проекте, где баг наблюдался.

---

## Verdict

**FAIL**
