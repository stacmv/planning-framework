# QA Report

**Issue ID:** 20260731-feat-pluggable-reviewers
**Date:** 2026-07-31
**Agent:** Claude

---

## Automated Checks

| Check | Command | Result | Output |
|-------|---------|--------|--------|
| Shellcheck passes | `shellcheck scripts/*.sh test/*.sh` | ✓ PASS | exit 0 (v0.11.0, через кэш npx — системный `shellcheck` не установлен) |
| No leftover debug output | `git diff develop...HEAD -- . ':!tools/' ':!test/' \| grep -E "^\+.*(console\.log\|debugger;\|set -x)"` | ✓ PASS | — (0 совпадений) |
| No unresolved TODOs | `git diff develop...HEAD -- . ':!docs/issues/' ':!test/' ':!.qa-workflow.md' \| grep -E "^\+.*TODO" \| grep -v 'TODO: Run /pf-'` | ✓ PASS | — (0 совпадений) |
| No unprocessed TC rows | `grep -c '\| \[ \] *\|' …/test_plan.md` | ✓ PASS | 0 |
| No failed TC rows | `grep -c '\| ✗ *\|' …/test_plan.md` | ✓ PASS | 0 |
| No hardcoded secrets | `git diff develop...HEAD \| grep -iE "…(api_key\|secret\|password\|token)…"` | ✓ PASS | — (0 совпадений) |
| No unsafe remote-exec | `git diff develop...HEAD \| grep -E "…curl…\|(ba)?sh"` | ✓ PASS | — (0 совпадений) |
| Working tree clean | `git status --porcelain` | ✓ PASS | — (пусто) |
| Branch up to date with parent | `git merge-base --is-ancestor develop HEAD` | ✓ PASS | exit 0 |
| Scope guard (no app/CI code) | `git diff --name-only develop...HEAD \| grep -vE '^(tools\|test)/' \| grep -E '\.(tsx?\|…)$\|^\.github/workflows/'` | ✓ PASS | — (0 совпадений; изначально ловил тестовую фикстуру `.js`, переименована в `.js.txt` — см. Notes) |

---

## Manual QA Items

### Code Quality
- [x] **[AI check] No commented-out instruction blocks left in changed skill files** — проверены все строки, начинающиеся с `#`/`##`/`###`, во всех изменённых `SKILL.md`; все — обычные markdown-заголовки новых разделов, ни одной закомментированной старой инструкции.

### Testing
- [x] **[Human check] Manual test checklist has been run** — по явному решению владельца проекта (единственный пользователь framework) формальный ручной прогон сценариев назначения ревьюера/вызова Codex/гейта код-ревью не требуется перед закрытием — см. `test_plan.md`'s "Scope decision". `manual_test_checklist.md` документирует это решение явно; незаполненных чекбоксов не осталось, потому что ручных тест-кейсов в чеклисте больше нет.

### Documentation
- [x] **[AI check] Docs match the change** — `prompt.md`/`brd.md` подразумевают появление нового скилла и стадии в пайплайне; все пользовательские документы, перечисляющие скиллы (`README.md`, `docs/planning/FRAMEWORK.md`, `docs/planning/QUICKSTART.md`, `CLAUDE.md`, `tools/onboarding-tui/lib/tutorial.js`) обновлены в диффе.

### Feature Issues
- [x] **[AI check] Diff satisfies every acceptance criterion** — все строки Acceptance Criteria в `implementation_plan.md` отмечены `[x]` (часть — как «TC-001 passes», часть — как «реализовано и закоммичено, формальным тестом не покрыто» по решению владельца, см. Notes).
- [x] **[AI check] Diff matches declared scope** — каждый файл из `git diff --name-only develop...HEAD` учтён в `specs.md` (§9 — основной список; §0 — добавленный при `/pf-test` список файлов, потребовавшихся для согласованности документации), либо это собственные планировочные документы issue.

### Pre-Merge Checklist
- [x] **[Automated] Working tree clean**
- [x] **[Automated] Branch is up to date with parent**
- [x] **[AI check] Commit messages are descriptive** — все 9 коммитов ветки по Conventional Commits, каждый описывает суть изменения (`feat:`, `test:`, `fix:`, `chore:`, `docs:`) с привязкой к issue ID, ни одного «wip»/«updates».
- [x] **[AI check] No unrelated changes** — тот же список, что и выше в Feature Issues; лишних файлов нет.

---

## Blockers

_None._

---

## Notes

1. **`shellcheck` отсутствовал в системе, но нашёлся в кэше `npx`** (`@0.11.0`, реальный бинарник, не заглушка) — прогнан оттуда без установки чего-либо в систему.
2. **Scope guard изначально нашёл ложное срабатывание**: тестовая фикстура `docs/issues/open/20260731-feat-pluggable-reviewers/test-data/fixtures/case-008/bad-diff-example.js` (иллюстративный пример P0-проблемы для ручного теста) совпала с паттерном «код вне `tools/`/`test/`». Переименована в `.js.txt`; впоследствии вся папка `test-data/` удалена вместе со сведением тест-плана к одной статической проверке (см. ниже).
3. **Scope тестирования сокращён по решению владельца проекта** (единственный пользователь framework) — с исходных 10 запланированных test cases до одной статической проверки (severity-mapping consistency, реально верифицирована чтением `pf-check`/`pf-codereview`). Остальные сценарии (гарда назначения ревьюера, happy-path/both Codex, жёсткий гейт `pf-codereview`, предусловие `/pf-test`, обратная совместимость) реализованы и закоммичены, но не покрыты формальным тестом — при обнаружении дефектов в реальном использовании framework будут заведены отдельные issue на исправление.
4. **`specs.md` получил раздел §0**, документирующий 6 файлов (`CLAUDE.md`, `README.md`, `docs/planning/FRAMEWORK.md`, `docs/planning/QUICKSTART.md`, `tools/onboarding-tui/lib/tutorial.js`, `skills/pf-git/SKILL.md`), которые не были в исходном §9, но потребовались, когда `/pf-test`'s `make test` обнаружил регрессии согласованности документации (`docs-refs.sh`, `skills-static.sh`).

---

## Verdict

**PASS**
