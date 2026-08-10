# QA Report

**Issue ID:** 20260806-feat-role-matrix
**Date:** 2026-08-10
**Agent:** Claude

---

## Automated Checks

| Check | Command | Result | Output |
|-------|---------|--------|--------|
| Shellcheck passes | `shellcheck scripts/*.sh test/*.sh` | ✓ PASS | exit 0 (shellcheck 0.9.0, `/usr/bin/shellcheck`) |
| No leftover debug output introduced | `git diff develop...HEAD -- . ':!tools/' ':!test/' \| grep -E "^\+.*(console\.log\|debugger;\|set -x)"` | ✓ PASS | — |
| No unresolved TODOs introduced | `git diff develop...HEAD -- . ':!docs/issues/' ':!test/' ':!.qa-workflow.md' \| grep -E "^\+.*TODO" \| grep -v 'TODO: Run /pf-'` | ✓ PASS | — |
| Every TC in Status Tracker marked done, none failed | `grep -c '\| \[ \] *\|' test_plan.md` / `grep -c '\| ✗ *\|' test_plan.md` | ✓ PASS | unprocessed rows: 0, failed rows: 0 |
| No hardcoded secrets introduced | `git diff develop...HEAD \| grep -iE "^\+.*(api[_-]?key\|secret\|password\|token)\s*=\s*['\"]"` | ✓ PASS | — |
| No unsafe remote-execution pattern introduced | `git diff develop...HEAD \| grep -E "^\+.*curl.*\|\s*(ba)?sh"` | ✓ PASS | — |
| Working tree clean | `git status --porcelain` | ✓ PASS | — |
| Branch is up to date with parent | `git merge-base --is-ancestor develop HEAD` | ✓ PASS | exit 0 |
| No application-code/CI files introduced (Project Scope Guard) | `git diff --name-only develop...HEAD \| grep -vE '^(tools\|test)/' \| grep -E '\.(tsx?\|jsx?\|py\|rb\|go\|sql)$\|^\.github/workflows/'` | ✓ PASS | — |
| Role-matrix static tests (TC-009, TC-014) | `bash test/skills-role-matrix-static.sh` | ✓ PASS | 8 passed, 0 failed |

**Изменение относительно прогона 2026-08-07:** тогда `shellcheck` был отмечен
`✓` на машине, где он установлен; на текущей машине его сначала не было.
Пользователь установил его по ходу этого прогона (0.9.0), и команда гейта
исполнена дословно, без суррогатов.

---

## Manual QA Items

### Code Quality
- [x] Shellcheck passes
- [x] No leftover debug output introduced
- [x] No unresolved TODOs introduced by this issue
- [x] No commented-out instruction blocks left in changed skill files ([AI check] — просканированы добавленные строки во всех 15 изменённых `skills/*/SKILL.md`; строк, начинающихся с одиночного `#` и читающихся как отключённая инструкция, нет)

### Testing
- [x] Every TC in this issue's test_plan.md Status Tracker is marked done AND none of them failed — 0 необработанных строк, 0 проваленных. TC-009/TC-014 (Auto) и TC-010 (Critical, прогнан вживую) отмечены `✓`; остальные 17 помечены `—` (descoped), что не является ни прохождением, ни провалом.
- [x] Manual test checklist has been run — **частично, по явному решению владельца проекта (2026-08-10).** Прогнан и задокументирован TC-010; остальные 17 сняты с формального ручного тестирования. Основания по группам — раздел «Scope decision» в `test_plan.md`. Это не «проверка пройдена», а зафиксированное сокращение охвата: три TC (TC-007/016/017) автономно недостижимы в принципе, остальные требуют полного прогона тяжёлых стадий на фикстурах. Прецедент — коммит `1783864` предыдущей issue.

### Documentation
- [x] Docs match the change ([AI check] — `prompt.md` упоминает README/CHANGELOG как иллюстрацию возможных целей `/pf-user-docs`, но технический авторитет — `specs.md` §8, который ограничивает собственный артефакт этой issue файлом `docs/issues/open/<ID>/user_docs.md`. Содержание issue не требовало правки корневого README/CHANGELOG; `user_docs.md` и `dev_docs.md` написаны и отревьюены на своих стадиях)

### Security
- [x] No hardcoded secrets introduced
- [x] No unsafe remote-execution pattern introduced

---

## Feature Issues (feat)

- [x] Diff satisfies every acceptance criterion ([AI check] — все 20 строк acceptance criteria в `implementation_plan.md` приведены в соответствие с фактическим покрытием: TC-009/TC-010/TC-014 отмечены как verified, остальные 17 — как реализованные и снятые с формального тестирования, со ссылкой на «Scope decision». Ни одна строка не осталась пустой галочкой, ничего не отмечено пройденным без прогона)
- [x] Diff matches declared scope ([AI check] — каждый файл из `git diff --name-only develop...HEAD` прослеживается до пофайловых списков `specs.md`/`implementation_plan.md`, с одним намеренным добавлением: `test/skills-role-matrix-static.sh`, написан на стадии `/pf-test`, чтобы закрыть реальный пробел — `test_plan.md` объявлял TC-009/TC-014 как `Type: Auto`, но ни одна задача плана не предусматривала кода под них. Задокументировано в `session-log.md` и в собственном коммите)

---

## Pre-Merge Checklist

- [x] Working tree clean
- [x] Branch is up to date with parent
- [x] Commit messages are descriptive (`git log --oneline develop..HEAD` — 24 коммита, ни одного вида «wip»/«fix»/«updates»; каждый называет изменение и ID issue)
- [x] No unrelated changes (та же проверка списка файлов и то же одно намеренное задокументированное добавление, что и в «Diff matches declared scope»)

---

## Project Scope Guard

- [x] No application-code or CI files introduced (outside internal tooling and tests)

---

## Risks

- ⚠ **Сокращённый охват ручного тестирования.** 17 из 20 TC не выполнялись (`—` в Status Tracker), включая три Critical/High-сценария подтверждения `code.review: skip` (TC-016, TC-017) и делегирование кода Codex-актору (TC-012). Реализация покрыта code review (PASS после 4 раундов, ревьюеры Claude + Codex) и тремя прогнанными TC, но независимой проверки поведения этих сценариев в реальном запуске не существует. Дефекты, найденные при дальнейшем использовании, заводятся отдельными issue.
- ⚠ **`manual_test_checklist.md` неисполним как есть на не-Windows машине** — 17 вхождений абсолютного пути `C:\Users\Stac\AppData\Local\Temp\...`, зашитых при генерации. Сам `test-data/setup.mjs` кроссплатформенный. Кандидат в отдельный issue (дефект генерации в `/pf-test`).
- ⚠ **Чек-лист отстал от реализации в одном месте** — шаг 2 TC-010 ожидает автомиграцию «как часть сканирования открытых issue», тогда как реализованный `/pf` мигрирует только выбранный issue (осознанное изменение с обоснованием в тексте скилла). На вердикт TC-010 не влияет: проверяемое утверждение выполняется.

`roles.code.review` для этой issue — `[claude, codex]`, не `skip`, поэтому
строка риска про пропуск ревью кода (Phase 3.5) неприменима.

---

## Blockers

_None._

---

## Verdict

**PASS**
