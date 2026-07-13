# Implementation Plan: Converge-to-v3

**Issue:** 20260713-bug-v2-to-v3-migration-defects
**Тип:** bug
**Size tier:** large
**Дата:** 2026-07-13 (3-я редакция — исправлены P0/P1/P2 из `/pf-check`)
**Основание:** `analysis.md` (4-я редакция: решения Р0–Р12, целевое состояние T1–T11, «Условия приёмки», «Затронутые файлы», «Вне scope») + `test_plan.md` (TC-001…TC-058, `TCD-01`…`TCD-11`, решения D-A…D-G, правила безопасности S-1…S-5, KI-1…KI-20)

---

## Overview

Issue перестал быть «починкой пяти дефектов миграции». Он стал **пивотом**: поддержка v1/v2 удаляется целиком, а вместо четырёх скриптов установки/миграции появляется **один идемпотентный `scripts/converge-to-v3.sh`**, который приводит потребительский проект к целевому состоянию v3 (чеклист T1–T11) из **любого** исходного — нет PF / v1 / v2 / смешанное-полумигрированное / неполный v3.

Реализуется **уже принятый** дизайн; альтернативы не переоткрываются:

- **Р2/Р3/П1-4.** `setup-planning-v3.sh`, `setup-planning-v2.sh`, `migrate-v1-to-v2.sh`, `migrate-v2-to-v3.sh` **удаляются**. `converge-to-v3.sh` — единственная точка входа: `make converge`, и оба действия TUI (`install`, `migrate`) схлопываются в один action-token `converge`.
- **Р7.** `.pf-version` становится единственным машинным **маркером версии**; `PLANNING.md` остаётся справочным документом и перестаёт отравлять детекцию (корень дефектов 2 и 6). При этом **структурный отпечаток незавершённой миграции (`planning/issues/`) проверяется раньше любого маркера** — см. Task 8 и Р7 в `analysis.md`.
- **Р11.** Сходимость — это **доливка до целевого состояния**, а не «no-op, если уже v3». Проект, поставленный сегодняшним `setup-planning-v3.sh`, детектится как `'v3'` (`detect.js:47-50`), но не имеет `.pf-version`, `PLANNING.md`, секции в `CLAUDE.md` и несёт 7 скилов из 15 — он обязан долиться.
- **Дефект 3.** Все **15** скилов ставятся динамическим перебором `skills/*/SKILL.md` — блок переносится из `install.sh:72-80`, четвёртая реализация не изобретается.
- **Р4.** `.qa-workflow.md` **не шаблонизируется**: converge печатает подсказку `/pf-qa-setup` (и WARNING на v2-штампе). Несущая починка — установка скила `pf-qa-setup`, которого сегодня в проекте просто нет.
- **Дефект 5.** Закрывается с трёх сторон: заглушки не создаются (мера 1); лежащие на диске заглушки не засчитываются как пройденная стадия (мера 2, единое определение в `skills/pf-size-tiers/SKILL.md`, на которое ссылаются **семь** гейтов); стадии не перепрыгиваются ни в одной из **ЧЕТЫРЁХ** таблиц маршрутизации `skills/pf/SKILL.md` — trivial (`:87-91`), feat (`:100-111`), improve (`:118-127`), bug (`:134-143`). Trivial-таблица ключуется **напрямую на существовании документов** (`:85` говорит это дословно) и является живым путём воскрешения дефекта.
- **Р6.** QA-гейты самого репозитория правятся, иначе issue не сможет пройти собственную QA (литерал `TODO: Run /pf-` обязан появиться в `skills/`).

**Ключевой принцип порядка работ:** тестовая обвязка и фикстуры существуют **до** converge; converge доказан **до** того, как на него переключается TUI; TUI переключён **до** того, как удалены скрипты, которые он сегодня запускает. Пользовательская команда `pf` (`~/.claude/bin/pf` → `tools/onboarding-tui/cli.js`) **ни на одном коммите не остаётся с висящей ссылкой на несуществующий файл**.

> **Что при этом честно ломается (и это принято).** Начиная с Task 3 перестают работать `make setup-v2` и деградирует `make migrate-v1-to-v2` — обе цели удаляются в Task 9. Подробности и обоснование — в Phase I. Рабочий путь установки при этом остаётся всегда: `make setup-v3` (и оба действия TUI) работают до Task 9, `make converge` — начиная с Task 4.

---

## Files to Create/Modify/Delete

> Эти три списка **исчерпывающи** и являются нормативными: гейт `.qa-workflow.md:84` («No unrelated changes») после правки Task 1 сверяет `git diff --name-only develop...HEAD` именно с ними. Файл, изменённый вне списка, — это либо ошибка, либо пропуск в плане.

### Create

| Путь | Что это |
|---|---|
| `scripts/converge-to-v3.sh` | Единственный скрипт установки/миграции; фазы 1-7 (Р3) |
| `test/lib.sh` | Общая библиотека тестов: `_pf_converge_exec` + три обёртки (S-1/S-2), `pf_setup_case`, `pf_repo_copy`, `assert_target_state`, `assert_tree_identical`, `assert_exit_code`, `snapshot_tree`, счётчики PASS/FAIL |
| `test/qa-gates.sh` | TC-041 |
| `test/safety-audit.sh` | TC-032 |
| `test/converge-fresh.sh` | TC-001…TC-003, TC-005, TC-009, TC-011, TC-013…TC-015, TC-024, TC-030, TC-031 |
| `test/converge-migrate.sh` | TC-004, TC-006…TC-008, TC-016…TC-019, TC-022, TC-056, TC-057 |
| `test/converge-normalize.sh` | TC-010, TC-012, TC-020, TC-021, TC-023, TC-058 |
| `test/converge-safety.sh` | TC-025…TC-029, TC-051…TC-055 |
| `test/skills-static.sh` | TC-042, TC-043, TC-044 |
| `test/fixtures/no-pf-bare/`, `no-pf-claude/`, `v1-project/`, `v2-project/`, `v2-with-stub/`, `v3-incomplete/`, `mixed-layout/`, `collision-same-id/`, `collision-file-dir/`, `v2-latin/`, `planning-with-user-files/` | 11 рукотворных замороженных фикстур, коммитятся, **без вложенного `.git`** (KI-8) |
| `test/fixtures/README.md` | По одной строке на фикстуру — что именно она моделирует (требование Task 2) |
| `docs/planning/templates/config/CLAUDE.md` | **Новый** шаблон (сегодня не существует нигде — проверено): тело размеченной секции `<!-- pf:begin/end -->` и файл «с нуля» (Р8) |
| `docs/planning/MIGRATION-GUIDE-V3.md` | Новый гайд по converge (Р10) |
| `tools/onboarding-tui/test/menu.test.js` | TC-036, TC-037 (`node --test`); файла сегодня нет — в `tools/onboarding-tui/test/` лежит только `detect.test.js` |
| `docs/planning/v1.0-archive/FRAMEWORK.md`, `QUICK-REFERENCE.md`, `MIGRATION-GUIDE-v1-to-v2.md` | Результат переноса корневых v1-реликтов (см. Delete/Move) |
| `docs/issues/open/20260713-bug-v2-to-v3-migration-defects/session-log.md` | Журнал сессий issue (требование `CLAUDE.md` → Session End) |
| `docs/issues/open/20260713-bug-v2-to-v3-migration-defects/manual_test_checklist.md` | Manual-кейсы TC-045…TC-050 (генерируется `/pf-test`) |
| `docs/issues/open/20260713-bug-v2-to-v3-migration-defects/qa_report.md` | Результат `/pf-qa` (TC-050) |

> **`docs/planning/templates/issue/notes.md` НЕ создаётся.** Утверждение предыдущей редакции («в `templates/issue/` нет `notes.md` — trivial-шаблона, которого ждёт `/pf-brd`») **ложно**. Проверено: (1) шаблон **уже существует** — `skills/pf-size-tiers/SKILL.md:58-76`, секция «`notes.md` template (trivial tier only, all issue types)»; (2) `pf-brd/SKILL.md:21` дословно велит брать его **из `~/.claude/skills/pf-size-tiers/SKILL.md`**; (3) `grep -rn 'templates/issue\|planning/templates' skills/` → **0 совпадений** — ни один скил вообще не читает `docs/planning/templates/`, этот каталог только целиком копируется в проект как справочный материал (T6). Создать `templates/issue/notes.md` значило бы завести **второй** экземпляр trivial-шаблона ровно в тот момент, когда Task 10 делает `pf-size-tiers` единственным домом общих правил, — то есть собственноручно посеять тот самый разъезд двух источников правды, ради устранения которого существует этот issue.

### Modify

| Путь | Что меняется |
|---|---|
| `Makefile` | Цель `converge` вместо `setup-v3` (`:45-46`) и `migrate-v2-to-v3` (`:39-40`); удалить `setup-v2` (`:42-43`) и `migrate-v1-to-v2` (`:36-37`); новая цель `test`; `.PHONY` (`:3`); help (`:14-17`) |
| `.qa-workflow.md` (репозитория) | Р6: shellcheck-гейт (`:26`, команда `:33`), TODO-гейт (`:28`, команда `:35`), Project Scope Guard (`:98`/`:102`), «No unrelated changes» (`:84`). Строку `:68` **не трогать** — она внутри `## Feature Issues (feat, improve)` (заголовок `:65`) |
| `docs/planning/templates/config/PLANNING.md` | Переписывается заново: generic-v3 с плейсхолдером `[Project Name]`, **без дат** (D-E) |
| `docs/planning/templates/global/session-log.md` (`:4`,`:137`), `implementation-plan.md` (`:4`,`:167`) | Штамп `**Version:** 3.0` |
| `docs/planning/templates/global/decisions.md` | **Добавить** строку версии — её нет вовсе |
| `docs/planning/templates/README.md` | `:188` (штамп); `:41`, `:60-61`, `:168`, `:169` (ссылки на удаляемое) |
| `scripts/install.sh` | Комментарии `:63-69`, `:84` (упоминают удаляемый `setup-planning-v3.sh`); блок `:72-80` — **источник** динамического перебора для converge |
| `scripts/install.ps1` | Текстовые упоминания; функционально не меняется |
| `skills/pf-size-tiers/SKILL.md` | **Единственное** место определения «стадия завершена» (дефект 5, меры 2 и 3). Секция «`notes.md` template» (`:58-76`) **остаётся единственным** домом trivial-шаблона |
| `skills/pf/SKILL.md` | Таблица Step 5 (`:57-67`) и «check passed» (`:145`) → ссылка на общее определение; маршрутизация по **первой незавершённой** стадии в четырёх таблицах (`:87-91`, `:100-111`, `:118-127`, `:134-143`); в bug-таблицу добавляется строка «IMPL_PLAN без TEST_PLAN» |
| `skills/pf-brd/SKILL.md` (`:11`), `pf-spec` (`:10`), `pf-test-plan` (`:14`), `pf-impl-plan` (`:10`) | Р9: stop → regenerate / keep / cancel |
| `skills/pf-impl-plan/SKILL.md` (`:9`), `pf-execute/SKILL.md` (`:20-22`) | Остаются stop'ами, но через общее определение |
| `skills/pf-update/SKILL.md` | Список «Managed Skills» (`:13-26`) — сегодня 14 из 15 (нет `pf-manual-test`); плюс сверка `.pf-version` проекта с версией фреймворка |
| `skills/pf-help/SKILL.md` | `:69` — вызов удаляемого `setup-planning-v3.sh`. **Правится в Task 9, вместе с удалением скрипта** |
| `tools/onboarding-tui/lib/detect.js` | Р7: новый порядок детекции (`:6`, `:36-45`, `:47-58`) |
| `tools/onboarding-tui/lib/menu.js` | Action-token `converge` в `MENUS.none` (`:29-32`), `MENUS['v2-or-older']` (`:33-36`), **`MENUS.v3`** (`:37-40`); `printDiagnostics` (`:67-83`, массив `checks` `:69-73`) печатает `.pf-version`. `MENUS.unknown` (`:41-43`) не меняется |
| `tools/onboarding-tui/lib/actions.js` | `runConverge(targetDir)` вместо `runSetupV3` (`:78-81`) и `runMigrateV2ToV3` (`:91-94`); удалить комментарий-компромисс P2-7 (`:63-77`); **шапка модуля `:7` и `:12`** (перечисляет оба удаляемых скрипта и цели `make setup-v3` / `make migrate-v2-to-v3` — без этой правки шаг 7 TC-036 «`grep -rn 'setup-planning-v3\|migrate-v2-to-v3' tools/` → 0» **не пройдёт**); экспорт (`:123-128`) |
| `tools/onboarding-tui/cli.js` | Диспетчер: `install` (`:90-93`) + `migrate` (`:95-98`) → `converge`; шапка `:11` |
| `tools/onboarding-tui/lib/tutorial.js` | `:48-57` — 10 скилов из 15 |
| `tools/onboarding-tui/test/detect.test.js` | Новые кейсы `TCD-01`…`TCD-11`; существующие `TC-001`…`TC-004b`, `P0-1` **не переименовывать и не править** (KI-20) |
| `CLAUDE.md` (репозитория) | `:16`, `:34` («7 skills»); `:19`, `:101-104` (ссылки на удаляемое и на v1→v2-гайд) |
| `README.md` | `:31` (ссылка на v1→v2-гайд + `migrate-v2-to-v3.sh`); `:92`, `:107`, `:239`, `:244`; новая секция «Skills» (15). `:391-398` (Version History) **не трогать** |
| `CONTRIBUTING.md` | `:108-117` — блок «Run setup script» через `cd templates && ./setup-planning-framework.sh`; **`:355`** — ссылки `[FRAMEWORK.md](FRAMEWORK.md)` и `[QUICK-REFERENCE.md](QUICK-REFERENCE.md)` на **корневые** файлы, которые Task 9 уносит в `docs/planning/v1.0-archive/` (иначе — две битые ссылки) |
| `docs/planning/FRAMEWORK.md` | `:88`, `:103`, **`:469-470`**, **`:602-603`** (удаляемые скрипты — они идут **парами**: `setup-planning-v3.sh` + `migrate-v2-to-v3.sh` в обоих местах); `:375` («Eleven … skills», + упоминание `setup-planning-v3.sh`); `:427-438` (устаревшая плоская раскладка `skills/`); `:598` (ссылка на переносимый гайд) |
| `docs/planning/QUICKSTART.md` | `:27`, `:424`, `:504`, `:505` (удаляемые скрипты); `:39` (11 скилов) |
| `docs/issues/open/20260713-bug-v2-to-v3-migration-defects/{prompt,analysis,test_plan,implementation_plan}.md` | Документы самого issue — правятся по ходу работы (эта редакция плана уже правит `analysis.md` и `test_plan.md`) |

### Delete / Move

| Путь | Действие |
|---|---|
| `scripts/setup-planning-v3.sh` | **Delete** (П1-4). Источник для переноса в converge: `:50-61` (каталоги), `:68` (хардкод 7 скилов — заменяется переборoм), `:87-90` (шаблоны), `:99-110` (глобальные документы), `:138-153` (shim) |
| `scripts/migrate-v2-to-v3.sh` | **Delete** (Р2, Р3). Шаг 2 (`:128-141`, heredoc stub-`test_plan.md`) **не переносится** — это корень дефекта 5 |
| `scripts/setup-planning-v2.sh`, `scripts/migrate-v1-to-v2.sh` | **Delete** (Р2) |
| `templates/` (корневой каталог целиком: `setup-planning-framework.sh`, `.ps1`, `claude-instructions.md`, `prd-template.md`, `*-template.md`, `README.md`) | **Delete** (Р2, реликты v1) |
| `docs/planning/templates/config/.qa-workflow.md` | **Delete без замены** (Р4) |
| `PLANNING.md.bootstrap`, `.qa-workflow.md.bootstrap` | **Delete** (Р2). Оба существуют и отслеживаются git; живого потребителя нет |
| `FRAMEWORK.md` (корневой, v1.1), `QUICK-REFERENCE.md` (корневой) | **Move** → `docs/planning/v1.0-archive/` с пометкой «historical» |
| `docs/planning/MIGRATION-GUIDE.md` (это гайд **v1.0 → v2.0**) | **Move** → `docs/planning/v1.0-archive/MIGRATION-GUIDE-v1-to-v2.md` |

---

## Implementation Tasks

> **Порядок обязателен.** Ни одна задача не тестирует то, чего ещё нет. Там, где отдельный шаг TC физически не может позеленеть до более поздней задачи, это сказано в Acceptance Criteria **явно** — вместо того чтобы делать вид, что он проходит.

---

### Task 1: Test harness + `make test` + QA-gate amendments (Р6)

**Mapped Test Cases:** TC-041

**Files:**
- `test/lib.sh` - **новый.** `_pf_converge_exec` (единственное во всём `test/` место, где упоминается имя `converge-to-v3.sh`); три публичные обёртки `pf_run_converge`, `pf_run_converge_interactive`, `pf_run_converge_cwd`; `pf_setup_case <fixture>`, `pf_repo_copy`, `assert_target_state [--no-destructive] <target> <home> [<framework_root>]`, `assert_tree_identical`, `assert_exit_code`, `snapshot_tree`, счётчики PASS/FAIL, `trap … EXIT`
- `test/qa-gates.sh` - **новый.** TC-041, работает на `$TMP_REPO` (S-5)
- `Makefile` - цель `test` (`test/*.sh` + `node --test tools/onboarding-tui/test/`), `test` в `.PHONY` (`:3`). **Только добавление** — удаление старых целей отложено до Task 9
- `.qa-workflow.md` - Р6: четыре гейта

**Implementation Notes:**

**S-1 — не подлежит обсуждению.** Converge ставит скилы в `~/.claude/skills/` и **перезаписывает** shim `~/.claude/bin/pf`. Тест, запустивший converge с настоящим `$HOME`, уничтожает глобальную установку разработчика и ломает все параллельные сессии Claude Code. Поэтому `_pf_converge_exec` **всегда** экспортирует `HOME=$TMP_HOME`, где `$TMP_HOME` — свежий `mktemp -d`, и никакой другой файл в `test/` имени скрипта не упоминает. `pf_run_converge` дополнительно передаёт `--yes` и подставляет `--target "$TMP_WORK"`, если вызывающий не передал свой `--target`. `pf_run_converge_interactive` — единственная обёртка **без** `--yes` (только для TC-029); пустой payload означает закрытый stdin (`< /dev/null`). `pf_run_converge_cwd` делает `cd <dir>` и `--target` **не** передаёт (проверка дефолта `$(pwd)`).

**Контракт `_pf_converge_exec` — ЯВНО (иначе шаг 4 TC-009 неисполним).** Запускаемый путь строится **из переменной**, а не литералом:

```bash
_pf_converge_exec() {          # приватная; из test/*.sh не вызывается (TC-032, шаг 5)
  local root="${PF_FRAMEWORK_ROOT:-$REPO_ROOT}"
  HOME="$TMP_HOME" bash "${root}/scripts/converge-to-v3.sh" "$@"
}
```

Это одновременно закрывает два требования, которые иначе противоречат друг другу: TC-009 шаг 4 обязан запустить скрипт **из копии репозитория** (`PF_FRAMEWORK_ROOT=$TMP_REPO pf_run_converge`), а TC-032 шаг 2 требует, чтобы литерал `converge-to-v3` встречался в `test/lib.sh` **ровно один раз**. Без переменной пришлось бы писать имя скрипта дважды. `PF_FRAMEWORK_ROOT` — переменная **только тестовой обвязки**; сам converge корень фреймворка ищет относительно пути собственного файла (`dirname "$0"/..`, S-5/KI-19) и об этой переменной ничего не знает.

**S-3/S-4/S-5.** Фикстуры read-only: `pf_setup_case` копирует фикстуру в свежий `$TMP_WORK` и при необходимости делает там `git init` + первый коммит. `$TMP_HOME`/`$TMP_WORK`/`$TMP_REPO` снимаются в `trap … EXIT`, в том числе при падении. Мутировать `$REPO_ROOT` в тестах **запрещено**: `pf_repo_copy` делает `cp -a "$REPO_ROOT" "$TMP_REPO"` **вместе с `.git`** (иначе не заработают `git diff develop...HEAD` и коммиты).

**`assert_target_state` — сигнатура и границы.** Реализует чеклист T1–T11 одной функцией (см. таблицу в `test_plan.md`). Три обязательных уточнения:

1. **Третий позиционный аргумент — корень фреймворка**, по умолчанию `$REPO_ROOT`. T7 берёт список скилов **перебором `<framework_root>/skills/*/SKILL.md`**, а не хардкодом числа. Именно поэтому TC-009 шаг 4 (запуск из `$TMP_REPO`, куда подсажен пробный скил `pf-zz-probe`) ожидает **16**, а все остальные TC — **15**: число не зашивается нигде, оно вычисляется из того самого дерева, из которого прогонялся converge. Хардкод «15» сделал бы шаг 4 TC-009 непроходимым.
2. **`.qa-workflow.md` в неё НЕ входит (KI-12)** — converge этот файл не создаёт никогда, и проверка его наличия дала бы ложный FAIL.
3. **T9 проверяет ТОЛЬКО белый список `planning/`** (P2-4). Белый список фазы 5 состоит целиком из путей `planning/…`, поэтому на v1-проекте не удаляется **ничего** — и это правильно (TC-003 шаг 5: `docs/prd.md` обязан выжить). Следствие: `docs/planning/FRAMEWORK.md` на v1-пути **переживает** converge (он там был до converge, и converge его не трогает), тогда как TC-019 шаг 3 требует его **отсутствия** на v2-пути (там он никогда не появляется, потому что v2-копия `planning/FRAMEWORK.md` не переносится). Это не противоречие, а разные утверждения. `assert_target_state`, в которую наивно вписали бы `! -e docs/planning/FRAMEWORK.md` из TC-019, **завалила бы TC-003**. Проверка «`docs/planning/FRAMEWORK.md` не появился» — локальный шаг TC-019, а **не** часть T9.

Флаг `--no-destructive` (только для TC-054) проверяет T1–T8 прямо, а T9/T10/T11 — **инвертированно**.

**Р6 — четыре правки `.qa-workflow.md`:**
1. **Shellcheck-гейт (`:26`, команда `:33`).** Сегодня он покрывает только `scripts/*.sh`, а этот issue добавляет каталог `test/` с шестью bash-файлами, которые остались бы вне гейта. Расширить: `shellcheck scripts/*.sh test/*.sh`.
2. **TODO-гейт (`:28`, команда `:35`).** Сегодня `git diff develop...HEAD | grep -E "^\+.*TODO"` — **без pathspec**. Литерал `TODO: Run /pf-` обязан появиться в `skills/pf-size-tiers/SKILL.md` (правило распознавания заглушки), в документах этого issue и в фикстуре `v2-with-stub`. **Не** исключать `skills/` целиком — исключить сам литерал плюс дать pathspec:
   `git diff develop...HEAD -- . ':!docs/issues/' ':!test/' | grep -E "^\+.*TODO" | grep -v 'TODO: Run /pf-'`
   Форма с pathspec уже прецедентна в соседнем гейте (`:34` — `-- . ':!tools/'`).
3. **Project Scope Guard (`:98`, команда `:102`):** `grep -v '^tools/'` → `grep -vE '^(tools|test)/'` (фикстуры и bash-тесты — не продуктовый код).
4. **«No unrelated changes» (`:84`):** для bug-issue при tier ≠ trivial сверять диф со списком файлов из **`implementation_plan.md`**, а не из `specs.md`/`notes.md`, которых у bug-issue тиров small/medium/large не бывает никогда. Строку **`:68` не трогать** — она внутри `## Feature Issues (feat, improve)` (заголовок `:65`) и к bug не применяется.
   > Следствие, обязательное к соблюдению: списки Create/Modify/Delete этого плана становятся **нормативными**. Любой файл, который задача трогает, обязан быть в них перечислен.

**KI-10.** Гейт Testing (`:40`, команда `:45`) считает незакрытые строки как `grep -c '| \[ \] *|'` — колонка `Status` в Status Tracker обязана оставаться в синтаксисе `[ ]`/`[x]`, иначе гейт станет бессмысленно зелёным.

На этом коммите `make test` зелёный: bash-тест один (`qa-gates.sh`), `node --test` гоняет существующий `detect.test.js`.

**Acceptance Criteria:**
- [ ] TC-041 passes (на `$TMP_REPO`; `git status --porcelain` в `$REPO_ROOT` после прогона пуст)
- [ ] `make test` завершается кодом 0 и падает ненулевым кодом при падении любого теста
- [ ] `grep -c 'converge-to-v3' test/lib.sh` = 1; в остальных файлах `test/` — 0 (дисциплина S-1 заложена до того, как её можно нарушить; автоаудит — TC-032 в Task 4)
- [ ] `_pf_converge_exec` строит путь как `"${PF_FRAMEWORK_ROOT:-$REPO_ROOT}/scripts/converge-to-v3.sh"`; `assert_target_state` принимает корень фреймворка третьим аргументом
- [ ] `shellcheck scripts/*.sh test/*.sh` exit 0 (гейт `.qa-workflow.md:26` уже расширен)

---

### Task 2: 11 рукотворных фикстур

**Mapped Test Cases:** — (задача-предпосылка; фикстуры — вход для TC-001…TC-031 и TC-051…TC-058)

**Files:**
- `test/fixtures/no-pf-bare/` - `README.md`, `src/main.js`; **без** `CLAUDE.md` → `detectState` = `'none'`
- `test/fixtures/no-pf-claude/` - то же + `CLAUDE.md` с пользовательским текстом без PF-секций → `detectState` = `'v2-or-older'` (D-C)
- `test/fixtures/v1-project/` - `docs/prd.md`, `docs/planning/{implementation-plan,session-log,decisions,FRAMEWORK}.md`, `CLAUDE.md` с **неразмеченной** v1-секцией (баннер `# ====…` / `# Planning Framework Integration`) и пользовательским текстом **после** неё; каталога `docs/issues/` нет
- `test/fixtures/v2-project/` - `planning/issues/{open,closed}/`, `planning/scripts/issue-status.sh`, `planning/templates/`, `planning/FRAMEWORK.md`, `planning/{implementation-plan,session-log,decisions}.md`, корневой `PLANNING.md` (`**Framework Version:** 2.0`, пути на `planning/`), корневой `.qa-workflow.md` (`**Version:** 2.0`); **`CLAUDE.md` отсутствует.** Issues: `open/20250101-feat-alpha/` (русский `prompt.md`, `analysis.md`, `implementation-plan.md`, `definition-of-done.md`), `open/20250102-bug-beta/`, `closed/20241201-feat-gamma/`
- `test/fixtures/v2-with-stub/` - как `v2-project` + stub-`test_plan.md` в feat-issue (`# Test Plan: …` + `> TODO: Run /pf-test-plan to generate this file.`)
- `test/fixtures/v3-incomplete/` - ровно то, что создаёт **сегодняшний** `setup-planning-v3.sh`
- `test/fixtures/mixed-layout/`, `collision-same-id/`, `collision-file-dir/`, `v2-latin/` (семь issue), `planning-with-user-files/` - состав по таблице «Fixtures inventory» `test_plan.md`
- `test/fixtures/README.md` - **новый.** По одной строке на фикстуру

**Implementation Notes:**

**KI-7 — снапшот прогоном `setup-planning-v2.sh` невозможен, и это уже проверено.** `scripts/create-issue.sh` и `close-issue.sh` удалены в коммите `4a17bb7`, а `setup-planning-v2.sh:125-133` копирует их **под охраной `if [ -f … ]`** (`:126`) — сегодня они молча пропускаются, и скрипт создаёт **неполный** v2-проект. Фикстуры собираются **руками** и коммитятся. При этом `scripts/issue-status.sh` в репозитории **существует** и копируется исправно — поэтому `planning/scripts/issue-status.sh` в фикстуре `v2-project` присутствовать **обязан**.

**KI-8.** Ни одна фикстура не несёт вложенного `.git` (иначе git превратит её в submodule). Тесты, которым нужен git, делают `git init` + первый коммит уже в `$TMP_WORK`.

**Task 2 обязана быть завершена ДО Task 3 — это не «можно параллельно».** Фикстура `v3-incomplete` обязана нести `docs/planning/templates/` **в сегодняшнем виде** — то есть включая `config/.qa-workflow.md` и v2-штампованный `config/PLANNING.md` (`setup-planning-v3.sh:89` копирует `cp -r "$TEMPLATES_SRC/."` целиком). Ровно эти два файла Task 3 уничтожает: `config/.qa-workflow.md` удаляет, `config/PLANNING.md` переписывает в generic-v3. Снять фикстуру после Task 3 будет уже не с чего, а без неё TC-011 (зеркалирование) не проверяет ничего.

Фикстуры `v2-project` и `v2-with-stub` содержат литерал `TODO: Run /pf-` — он попадает в диф ветки; гейт Р6 (Task 1) уже исключает `test/` через pathspec, так что собственная QA не падает.

Фикстура `v2-latin` — семь issue: (1) латиница; (2) кириллица **только** через `ё`/`Ё` и её больше латиницы; (3) нет ни `prompt.md`, ни `analysis.md`; (4) оба файла пусты; (5) поровну букв; (6) валидный frontmatter `doc_language: Russian` без `size_tier`; (7) **битый** frontmatter (открывающий `---` без закрывающего).

`test/fixtures/README.md` — по одной строке на фикстуру: что именно она моделирует. Без него следующая редакция снова начнёт гадать.

**Acceptance Criteria:**
- [ ] Все 11 фикстур существуют, закоммичены, ни в одной нет каталога `.git`
- [ ] `test/fixtures/README.md` описывает каждую из 11
- [ ] `test/fixtures/v2-project/planning/scripts/issue-status.sh` присутствует; `create-issue.sh`/`close-issue.sh` — отсутствуют (KI-7)
- [ ] `test/fixtures/v3-incomplete/docs/planning/templates/config/.qa-workflow.md` присутствует **и** `config/PLANNING.md` несёт штамп `2.0` (иначе TC-011 пустой)
- [ ] `pf_setup_case <fixture>` из Task 1 отрабатывает на каждой из 11 фикстур; исходная фикстура после прогона побайтово не изменена (S-3)

---

### Task 3: v3-шаблоны — новый, переписанный, проштампованные

**Mapped Test Cases:** — (задача-предпосылка; проверяется через TC-010 шаги 5-6, TC-011, TC-013, TC-024 шаг 4)

**Files:**
- `docs/planning/templates/config/PLANNING.md` - **переписывается заново**: generic-v3-документ с плейсхолдером `[Project Name]`, описывающий раскладку `docs/issues/` и конвейер `/pf-*`. Источник — корневой `PLANNING.md` этого репозитория (`**Framework Version:** 3.0`), обобщённый до плейсхолдеров
- `docs/planning/templates/config/CLAUDE.md` - **новый**: тело размеченной секции и файл «с нуля» (Р8)
- `docs/planning/templates/config/.qa-workflow.md` - **удаляется без замены** (Р4)
- `docs/planning/templates/global/{session-log,implementation-plan}.md` - штамп `**Version:** 3.0` (`:4` и `:137`/`:167`)
- `docs/planning/templates/global/decisions.md` - строки версии нет вовсе — **добавить**
- `docs/planning/templates/README.md` - `:188` (штамп); `:41`, `:60-61`, `:168`, `:169` (ссылки на удаляемое)

**Implementation Notes:**

**`templates/issue/` НЕ ТРОГАЕТСЯ ВОВСЕ.** Trivial-шаблон `notes.md` сюда **не добавляется** — он уже существует единственным экземпляром в `skills/pf-size-tiers/SKILL.md:58-76`, и `pf-brd/SKILL.md:21` берёт его именно оттуда. Ни один скил не читает `docs/planning/templates/` (`grep -rn 'templates/issue\|planning/templates' skills/` → 0). См. врезку под таблицей Create.

**D-E — в этих шаблонах не должно быть ни одной даты.** Артефакты T2/T3/T4/T6 перезаписываются на **каждом** прогоне converge; любой штамп даты (`Last Updated:`, подставленный `YYYY-MM-DD`) сделал бы второй прогон отличным от первого и убил бы побайтовую идемпотентность (TC-007). Тест был бы «зелёным по вторникам». Единственный подставляемый плейсхолдер в `templates/config/{PLANNING.md,CLAUDE.md}` — **`[Project Name]`**.

Подстановка при этом **обязательна** (KI-18): `setup-planning-v2.sh:176-180` её делал (`sed -i "s/\[Project Name\]/$PROJECT_NAME/g"`), и её пропажа была бы регрессией — потребитель получил бы `PLANNING.md` с литералом `[Project Name]`. **Механика подстановки реализуется в Task 4** (фаза 6), где она и живёт; здесь — только сами плейсхолдеры в шаблонах.

Старые `templates/config/*` — по существу **v2-документы** (конвейер `prompt → analysis → implementation-plan → session-log` без BRD/spec/test_plan; дефисный `implementation-plan.md`; слово «skill» не встречается ни разу). Проставить им `3.0` значило бы объявить v2-документ v3-документом, ничего не изменив по существу.

**Задача содержит удаление файла.** Требуется чистое рабочее дерево и ветка issue.

**Задача ломает `make setup-v2` — осознанно** (см. Phase I). `setup-planning-v2.sh:5` несёт `set -e`, а `:200` копирует `"$TEMPLATE_DIR/config/.qa-workflow.md"` **без охраны `if [ -f ]`** → с этого коммита цель падает с ненулевым кодом и остаётся сломанной до Task 9, где удаляется вместе со скриптом. `make setup-v3` при этом **не задет**: `setup-planning-v3.sh` копирует каталог шаблонов целиком (`:89`, `cp -r "$TEMPLATES_SRC/."`) и на конкретные файлы `config/` не ссылается (проверено grep'ом).

**Acceptance Criteria:**
- [ ] `grep -rn 'Version:\*\* 2\.0' docs/planning/templates/` → ноль совпадений
- [ ] `grep -rn 'YYYY-MM-DD\|Last Updated' docs/planning/templates/config/` → ноль совпадений (D-E)
- [ ] `grep -l '\[Project Name\]' docs/planning/templates/config/{PLANNING.md,CLAUDE.md}` → оба файла
- [ ] `docs/planning/templates/config/.qa-workflow.md` отсутствует
- [ ] `docs/planning/templates/issue/` не изменён (`git diff --name-only develop...HEAD -- docs/planning/templates/issue/` → пусто); `notes.md` в нём **не появился**
- [ ] Формально проверяется в Task 4 (TC-011, TC-013, TC-024 шаг 4) и Task 6 (TC-010 шаги 5-6) — собственных TC у задачи нет

---

### Task 4: `scripts/converge-to-v3.sh` — полная реализация (фазы 1-7) + тесты «чистых» путей

**Mapped Test Cases:** TC-001, TC-002, TC-003, TC-005, TC-009, TC-011, TC-013, TC-014, TC-015, TC-024, TC-030, TC-031, TC-032

**Files:**
- `scripts/converge-to-v3.sh` - **новый.** Фазы: (1) детект исходного состояния + печать; (2) бэкап; (3) перенос v2-раскладки; (4) нормализация документов issue; (5) удаление артефактов v1/v2 по белому списку; (6) доливка до целевого состояния T1-T8; (7) итоговый отчёт
- `test/converge-fresh.sh` - **новый.** TC-001…TC-003, TC-005, TC-009, TC-011, TC-013…TC-015, TC-024, TC-030, TC-031
- `test/safety-audit.sh` - **новый.** TC-032

**Implementation Notes:**

Скрипт пишется **целиком** в этой задаче (фазы 3-5 в том числе), потому что почти все фикстуры проходят через несколько фаз сразу и разрезать их по задачам нельзя. Здесь же — тесты «чистых» (не-v2) путей; тесты переноса, нормализации и коллизий разнесены по Task 5-7, где они и чинят то, что вскроют.

**CLI-контракт — ПОЛНОСТЬЮ ОПРЕДЕЛЁН (P2-3).**

*Флаги:* `--target <dir>` (по умолчанию `$(pwd)`), `--dry-run`, `--force` (обход гейта чистого worktree), `--yes` (подавление подтверждений), `--doc-language <lang>`, `--help`. Принимаются в **любом** порядке.

*Допустимые значения `--doc-language`:* **`Russian` | `English`**, сравнение регистронезависимое. Множество закрыто намеренно: классификатор Р5 бинарен (кириллица vs латиница), а converge только **проставляет** поле легаси-issue задним числом. Любое другое значение (TC-030, шаг 5: `Klingon`) → ненулевой код **2** + строка `valid values: Russian, English`.
> **Допущение (зафиксировать).** Само поле `doc_language` в конвейере `/pf` остаётся **свободным** (`skills/pf/SKILL.md:188` — «use the exact language name the user gave»). Закрытым становится только домен **флага converge**. Пользователю, которому нужен третий язык, converge не мешает: он правит frontmatter руками или отвечает на вопрос `/pf`. Converge не назначается привратником домена этого поля.

*Коды возврата (ровно эти, других нет):*

| Код | Когда |
|---|---|
| **0** | Целевое состояние достигнуто (или `--dry-run` отработал) |
| **1** | Converge отработал, но целевое состояние **не** достигнуто: коллизия «файл против каталога» (D-B, TC-054). Фаза 5 не выполнялась; `planning/` цел |
| **2** | Ошибка CLI: неизвестный флаг, флаг без обязательного значения (TC-030 шаг 4 — `--target` без аргумента), недопустимое значение `--doc-language`. Печатается usage |
| **3** | Гейт не пройден: грязный worktree по **отслеживаемым** изменениям и без `--force` (TC-028) |
| **4** | Отмена: пустой ввод, `n`, **или закрытый stdin без `--yes`** (TC-029). «Не смог спросить» ≠ «пользователь согласился» |
| **70** | Скрытый тестовый хук `--fail-after=<N>` (D-F) |

Все TC требуют лишь «ненулевой код», так что эта разметка их не нарушает и делает поведение диагностируемым.

*Скрытый хук* `--fail-after=<N>` (D-F): аварийный выход с кодом 70 сразу после N-го успешно перенесённого файла фазы 3; действует **только** при `PF_CONVERGE_TEST_HOOKS=1`; в `--help` **не печатается** (TC-030, шаг 7).

**Отмена — ЛОЖНО-ЗЕЛЁНАЯ ЛОВУШКА (KI-6).** Сегодня `migrate-v2-to-v3.sh:94` делает `read -p "Proceed with migration? [y/N] "` и при пустом `CONFIRM` печатает «Migration cancelled» и **`exit 0`**. На таком контракте **любой** автотест зелёный при нулевом фактическом результате. Converge обязан возвращать код **4** на любой отмене.

**Подстановка `[Project Name]` — механика (P2-3, KI-18).** Имя проекта = **basename целевого каталога**: `PROJECT_NAME="$(basename "$(cd "$TARGET" && pwd -P)")"`. Подставляется в **два** артефакта фазы 6: `PLANNING.md` (T3) и тело размеченной секции / файл `CLAUDE.md` (T4), оба — из `docs/planning/templates/config/`. Замена: `sed "s/\[Project Name\]/${PROJECT_NAME//\//\\/}/g"` (имя каталога слэшей не содержит, но экранирование оставляем как страховку). Никакие другие плейсхолдеры не подставляются — дат в шаблонах нет вовсе (D-E). Проверяется TC-013 (`My-Cool-Project`).

**S-5 / KI-19 — корень фреймворка ищется относительно пути собственного файла** (`dirname "$0"/..`), а не относительно `$PWD` и не зашитой константой. Иначе прогон `$TMP_REPO/scripts/converge-to-v3.sh` (TC-009 шаг 4, TC-041) использовал бы `skills/` **оригинала**, и тест «динамический перебор» ничего бы не доказывал. Переменная `PF_FRAMEWORK_ROOT` — принадлежность **тестовой обвязки** (Task 1); converge её не читает.

**Гейт чистого worktree — только ОТСЛЕЖИВАЕМЫЕ изменения (D-A, KI-14):** `git status --porcelain --untracked-files=no`. Собственные выходы converge (`docs/issues/`, `.pf-version`, `PLANNING.md`, `planning-backup-*`) в реальном репозитории **неотслеживаемы** — гейт, чувствительный к untracked, сделал бы **второй** прогон падающим в любом git-проекте, то есть убил бы идемпотентность. Отсутствие `.git` вовсе — не «грязный worktree», а информационное сообщение.

**`git mv` — нужен ПОФАЙЛОВЫЙ fallback (KI-2, проверено эмпирически):** на полностью неотслеживаемом каталоге → `fatal: source directory is empty` (exit 128); на одиночном неотслеживаемом файле → `fatal: not under version control` (exit 128). Репозиторного ветвления «git есть / git нет» **недостаточно**. Правило: **на каждый файл** — проба `git ls-files --error-unmatch <file>`; отслеживается → `git mv` (сохраняет историю), иначе → `cp -a` + `rm`.

**Фаза 3 — поэлементный перенос.** Наивный `mv planning/issues docs/issues` даёт `docs/issues/issues/`, потому что converge (как и `setup-planning-v3.sh:50-61` сегодня) сам создаёт `docs/issues/{open,closed}`. Область действия правила слияния — **только данные**: `planning/issues/**` и три глобальных документа `planning/{implementation-plan,session-log,decisions}.md`. Всё остальное (`planning/scripts/*.sh`, `planning/templates/**`, `planning/FRAMEWORK.md`) — артефакты v2-фреймворка: не переносятся, копия остаётся только в бэкапе.

**Фаза 6 — доливка (T1-T8).** Скилы ставятся **динамическим перебором** — блок переносится из `install.sh:72-80` (`for src in "$INSTALL_DIR"/skills/*/; do … [ -f "${src}SKILL.md" ] || continue`), четвёртая реализация не изобретается (перебор уже есть в `install.sh`, `install.ps1:73-77`, `update-skills.sh:31-34`). Хардкод `SKILLS=(pf pf-brd … pf-execute)` (`setup-planning-v3.sh:68`) и хардкод финальной справки из 7 строк (`:119-128`) **не переносятся**: справка становится производной от фактически установленного набора.

**T6 — ЗЕРКАЛИРОВАНИЕ, а не наложение (KI-17).** `cp -r "$TEMPLATES_SRC/." …` (`setup-planning-v3.sh:89`) добавляет и перезаписывает, но **никогда не удаляет**. Проект, ранее поставленный v3, несёт `docs/planning/templates/config/.qa-workflow.md`, который Task 3 удалил из фреймворка **без замены**, — реализация на `cp -r` оставила бы его в проекте и прошла бы все прочие TC незамеченной. Нужно зеркало (`rsync --delete`, если доступен, иначе явное «удалить то, чего нет в источнике» — зависимость от rsync лучше не вносить, репозиторий на неё нигде не опирается).

**Асимметрия перезаписи (KI-11).** Артефакты фреймворка (`.pf-version`, `PLANNING.md`, секция в `CLAUDE.md`, `docs/planning/templates/`, скилы, shim) — **перезаписывать всегда**. Пользовательские документы (`docs/planning/{session-log,decisions,implementation-plan}.md`, `.qa-workflow.md`) — **не трогать**.

**Р8 — размеченная секция в `CLAUDE.md`; прецедента v1 НЕ существует (П1-6).** `templates/setup-planning-framework.sh:88-108` делает безусловный `>>`-append без маркеров и без идемпотентности (повторный прогон **дублирует** секцию). Механика «маркеры `<!-- pf:begin -->` / `<!-- pf:end -->` + идемпотентная замена» — **новая работа**: шаблон + парсер маркеров + тест на двойной прогон. Старая неразмеченная v1-секция (баннер `# Planning Framework Integration` вне маркеров) **не удаляется** — за ней произвольный пользовательский текст до конца файла; печатается WARNING с номером строки. Непарные маркеры (`begin` без `end`) → WARNING и **никакой** второй секции.

**Р4 — `.qa-workflow.md`:** отсутствует → подсказка «Run `/pf-qa-setup`»; несёт штамп `**Version:** 2.0` → WARNING; в любом другом виде → **не трогать** (в реальном проекте это осмысленный, отредактированный руками файл). Converge не создаёт его **никогда**, и в `assert_target_state` он не входит (KI-12).

**Бэкап (KI-1) — имя и УСЛОВИЕ СРАБАТЫВАНИЯ.** Имя `planning.bak/` непригодно: `.gitignore:16` этого репозитория содержит `*.bak` — маска общеупотребительная, бэкап был бы **невидим для git** у любого потребителя с такой строкой. Имя — `planning-backup-<YYYYMMDD-HHMMSS>/`; перед созданием — `git check-ignore -q <path>`, при попадании — WARNING (но бэкап всё равно создаётся: терять данные из-за чужого `.gitignore` нельзя); после успеха **не удаляется** — это единственный артефакт отката.

> **Условие создания — дословно:** **бэкап создаётся тогда и только тогда, когда непусто множество операций фаз 3 и 5; удаления зеркалирования T6 (фаза 6) бэкап НЕ триггерят.**
>
> Без этой оговорки правило «бэкап создаётся, только если есть что переносить или удалять» **самопротиворечиво**, и TC-005 с TC-016 не могут быть зелёными одновременно. На фикстуре `v3-incomplete` фаза 6 **удаляет** `docs/planning/templates/config/.qa-workflow.md` и подсаженные `stale.md` (TC-011, шаги 3-4) — при буквальном чтении это «удаление», значит бэкап обязан появиться. Но TC-005 шаг 6 и TC-016 шаг 5 требуют, чтобы на той же фикстуре каталога `planning-backup-*` **не было**: это чистая доливка. Разрешение: бэкап защищает **пользовательские данные**, которые converge **уносит или стирает** (фазы 3 и 5). Шаблоны фреймворка (T6) — не пользовательские данные, их источник — сам репозиторий фреймворка, восстановить их можно повторным прогоном; они бэкап не триггерят.

**TC-032 (`test/safety-audit.sh`)** — статический аудит правила S-1: имя `converge-to-v3` встречается в `test/` ровно в одном файле (`lib.sh`) и ровно один раз; `HOME=` экспортируется в `_pf_converge_exec`; `_pf_converge_exec` не вызывается из `test/*.sh`; `mktemp -d` и `trap … EXIT` присутствуют. Аудит появляется здесь, вместе с первым файлом, который мог бы правило нарушить.

**Acceptance Criteria:**
- [ ] TC-001 passes (`no-pf-bare` → T1-T11, бэкапа нет, подсказка `/pf-qa-setup` напечатана)
- [ ] TC-002 passes — **кроме шага 2** (`MENUS['v2-or-older']` содержит action-token `converge`): токен появляется только в Task 8; остальные шаги зелёные здесь
- [ ] TC-003 passes (v1 → T1-T11; `docs/prd.md` и `docs/planning/session-log.md` не тронуты)
- [ ] TC-005 passes (`v3-incomplete` **доливается**, а не no-op; 15 скилов, включая `pf-qa-setup`; бэкапа нет)
- [ ] TC-009 passes (15 скилов перебором; на копии репо — 16 с пробным скилом, через `PF_FRAMEWORK_ROOT=$TMP_REPO`; `$REPO_ROOT` чист)
- [ ] TC-011 passes (T6 — зеркало: `config/.qa-workflow.md` и подсаженные `stale.md` **исчезают** из проекта; бэкап при этом **не** создаётся)
- [ ] TC-013 passes (плейсхолдеров `[Project Name]`/`YYYY-MM-DD` в выданных документах не остаётся; подставлен basename `$TARGET`)
- [ ] TC-014 passes (ровно одна пара маркеров после трёх прогонов; непарный маркер → WARNING, а не тихая порча)
- [ ] TC-015 passes (v1-баннер не удалён, WARNING с номером строки)
- [ ] TC-024 passes (`.qa-workflow.md` не создаётся никогда; подсказка/WARNING/молчание по трём веткам)
- [ ] TC-030 passes (флаги в любом порядке; `--bogus-flag` → код 2 + usage; `--target` без значения → код 2; `--doc-language Klingon` → код 2 + перечень допустимых; `--fail-after` в `--help` отсутствует)
- [ ] TC-031 passes (радиус поражения — только `$TARGET` и `$HOME/.claude/{skills,bin}`)
- [ ] TC-032 passes (аудит S-1 зелёный, включая шаг 4 — обёртки реально используются в `test/converge-fresh.sh`)
- [ ] `shellcheck scripts/converge-to-v3.sh` exit 0
- [ ] Ни один тест этой задачи не вызывает `converge-to-v3.sh` иначе как через обёртки `test/lib.sh`

---

### Task 5: Перенос v2-раскладки, бэкап, `git mv`-fallback, удаление по белому списку — тесты

**Mapped Test Cases:** TC-004, TC-006, TC-007, TC-008, TC-016, TC-017, TC-018, TC-019, TC-022, TC-056, TC-057

**Files:**
- `test/converge-migrate.sh` - **новый**
- `scripts/converge-to-v3.sh` - правки по итогам вскрытых дефектов фаз 2/3/5

**Implementation Notes:**

Это первая задача, которая гоняет converge по **настоящей** v2-раскладке — тому самому случаю, на котором сегодняшний `migrate-v2-to-v3.sh` даёт гарантированный no-op с бодрым «Migration Complete!» (`:41` и `:56` сканируют `docs/issues/open`, а v2-установщик кладёт issues в `planning/issues/open` — `setup-planning-v2.sh:111-114`).

**Идемпотентность (TC-007) проверяется побайтово:** два прогона подряд → `snapshot_tree` совпадают, второй бэкап не создаётся, пара маркеров в `CLAUDE.md` по-прежнему одна, `$TMP_HOME/.claude/` идентичен. Здесь же ловится нарушение D-E: любая дата в `PLANNING.md`/`.pf-version`/секции `CLAUDE.md` роняет тест.

**Восстановление после обрыва (TC-008, D-F).** Точка обрыва **детерминирована** хуком `--fail-after=<N>`, а не гонкой с `SIGKILL`. Правило восстановления — check-then-act на **каждый** файл: (1) целевого файла нет → перенести; (2) целевой файл есть и **побайтово совпадает** → источник удалить, `.v2.md` **не создавать**; (3) целевой файл есть и отличается → `<name>.v2.md`, но если `<name>.v2.md` уже существует и совпадает с источником — источник просто удалить. Суффикс не может нарастать: источники берутся только из `planning/`, а там файлов `*.v2.md` не бывает.

**Белый список удаления — не `rm -rf planning/` (TC-018).** Удаляются **только** `planning/{issues,scripts,templates,FRAMEWORK.md,implementation-plan.md,session-log.md,decisions.md}`, затем `rmdir planning` — он успешен только на пустом каталоге. Пользовательский файл в `planning/` обязан **выжить**; при непустом каталоге печатается WARNING со списком остатков. Следствие для идемпотентности: детект v2 ключуется на **`planning/issues/`**, а не на `planning/`, поэтому остаточный `planning/` повторную «миграцию» не спровоцирует.

**Белый список целиком состоит из путей `planning/…` (P2-4).** Значит на **v1**-проекте фаза 5 не удаляет **ничего** — и это правильно (TC-003 шаг 5: `docs/prd.md` обязан выжить). Побочный, но важный вывод: `docs/planning/FRAMEWORK.md`, лежащий в v1-проекте, **переживает** converge. Требование TC-019 шаг 3 («`docs/planning/FRAMEWORK.md` не появился») относится **только к v2-пути** и означает «v2-копия из `planning/FRAMEWORK.md` не переносится», а не «этого файла не бывает в целевом состоянии». В `assert_target_state` эта проверка **не входит** (иначе TC-003 упал бы).

**Порядок фаз обязателен (KI-13, D-B):** никаких удалений (фаза 5), пока переносы (фаза 3) не завершены **успешно**.

**`migrate-v2-to-v3.sh:77-78` тоже смотрит не туда** — ищет `scripts/create-issue.sh`/`close-issue.sh` в **корне** проекта, тогда как v2 кладёт их в `planning/scripts/`. Удалять надо `planning/scripts/*.sh`.

**TC-019, шаг 3 — тонкость:** converge **не устанавливает** `docs/planning/FRAMEWORK.md` вовсе (его нет ни в T1-T11, ни в фазе 6: `setup-planning-v3.sh:99-110` кладёт только `session-log.md`, `decisions.md`, `implementation-plan.md`), значит и v2-копия из `planning/FRAMEWORK.md` не имеет права там появиться.

**TC-022, шаг 6:** переименование `implementation-plan.md` → `implementation_plan.md` касается **только issue**. Глобальный `docs/planning/implementation-plan.md` в v3 так и называется (`setup-planning-v3.sh:99`) — дефисное имя сохраняется.

**Acceptance Criteria:**
- [ ] TC-004 passes (issues перечислены поимённо, а не «(none found)»; `planning/issues/` исчез)
- [ ] TC-006 passes (полумигрированная раскладка дочищается; `*.v2.md`-дублей не возникает)
- [ ] TC-007 passes (второй прогон — побайтово ноль изменений; дат в T2/T3/T4 нет; бэкап ровно один)
- [ ] TC-008 passes (обрыв на `--fail-after=1/2/5` → повторный прогон сходится к тому же дереву, что и одиночный чистый; код обрыва — 70)
- [ ] TC-016 passes (имя `planning-backup-*`; `git check-ignore` на `planning.bak` даёт 0, на фактическом имени — ненулевой; на чистой доливке бэкап не создаётся)
- [ ] TC-017 passes (в stderr нет ни `fatal: source directory is empty`, ни `fatal: not under version control`; `git log --follow` по отслеживаемому файлу прослеживается)
- [ ] TC-018 passes (`planning/notes-of-mine.md` выжил; WARNING напечатан; второй прогон не «мигрирует» повторно)
- [ ] TC-019 passes (`issue-status.sh` не перенесён в `docs/`; `docs/planning/FRAMEWORK.md` не появился; копия — в бэкапе)
- [ ] TC-022 passes (дефисных `implementation-plan.md` в `docs/issues/` нет; глобальный документ не задет)
- [ ] TC-056 passes (проект вне git; `cp -a` + `rm`; второй прогон побайтово идентичен)
- [ ] TC-057 passes (чужой `.gitignore` → WARNING, но бэкап создаётся)

---

### Task 6: Нормализация документов issue (Р1, Р5, Р12) + асимметрия перезаписи — тесты

**Mapped Test Cases:** TC-010, TC-012, TC-020, TC-021, TC-023, TC-058

**Files:**
- `test/converge-normalize.sh` - **новый**
- `scripts/converge-to-v3.sh` - правки фазы 4 и фазы 6 по итогам тестов

**Implementation Notes:**

**Мера 1 дефекта 5 — заглушки НЕ создаются вовсе.** Шаг 2 старого скрипта (`migrate-v2-to-v3.sh:128-141`, heredoc `# Test Plan: $ISSUE_ID` + `> TODO: Run /pf-test-plan to generate this file.`) **не переносится**. Отсутствие обязательного v3-документа честно означает незавершённую стадию; документ пишется штатным конвейером. В отчёте converge по каждому issue перечисляется, каких документов не хватает и какой скил их создаёт.

**Р1 — `brd.md`-указатель только в ЗАКРЫТЫХ issue**, с **настоящими** ссылками на уцелевшие legacy-документы (`prompt.md`, `analysis.md`, `definition-of-done.md`). Указатель **намеренно не содержит** маркера `TODO: Run /pf-` — он не «недописанный документ», и правило распознавания заглушек (мера 2) на него срабатывать не должно. Явно **не делаем**: маркер `legacy: true`, заглушку `specs.md` — это негативные требования, они проверяются (TC-021, шаги 6-7).

**D-D — в закрытые issue frontmatter не пишется.** Нормализация `doc_language` применяется **только** к `docs/issues/open/`. В `closed/` содержимое файлов не редактируется вовсе; единственное исключение — **добавление** файла-указателя.

**Р5 — `doc_language` по содержимому.** Считать кириллические и латинские буквы в `prompt.md` + `analysis.md`; кириллица **строго** больше → `Russian`, иначе `English`. В класс кириллицы **включить `ё` (`\xd1\x91`) и `Ё` (`\xd0\x81`)** — в UTF-8 они лежат **вне** блока `а-я`/`А-Я`, и наивная классовая скобка их потеряет. Решение печатается по каждому issue; флаг `--doc-language` переопределяет (допустимые значения — `Russian`/`English`, см. CLI-контракт в Task 4). **`size_tier` не угадывается** — оставляется отсутствующим, чтобы legacy-tier guard `/pf` (`skills/pf/SKILL.md:49-51`) спросил пользователя.

**D-G — вырожденные входы:** нет `prompt.md` → **не создавать** его (Р1 запрещает stub'ы в открытых issue), WARNING + решение `English`; битый frontmatter (открывающий `---` без закрывающего) → **файл не редактируется вовсе**, WARNING (попытка «починить» малформленный YAML — риск потери данных); валидный `doc_language` уже есть → **не перезаписывать**. Ни один вырожденный вход не роняет converge и не даёт ненулевого кода.

**Асимметрия (KI-11):** TC-010 проверяет, что артефакты фреймворка перезаписываются (v2-штампованный `PLANNING.md`, протухший `.pf-version`, мусор в `templates/`), TC-012 — что пользовательские документы не трогаются (маркеры в `session-log.md`/`decisions.md` на месте; `.qa-workflow.md` со штампом `2.0` не перезаписан).

**Acceptance Criteria:**
- [ ] TC-010 passes (`.pf-version` = `3.0.0`; `PLANNING.md` со штампом `3.0` и без путей `planning/issues`; `diff -r` шаблонов пуст; штампов `2.0` в шаблонах нет; `docs/planning/templates/issue/notes.md` **отсутствует** — второй копии trivial-шаблона не заводим)
- [ ] TC-012 passes (маркеры в пользовательских документах живы после двух прогонов; удалённый `decisions.md` восстановлен из шаблона со штампом `3.0`)
- [ ] TC-020 passes (`grep -rn 'TODO: Run /pf-' docs/issues/open/` → ноль совпадений; ни одного `test_plan.md`/`brd.md`/`specs.md`/`notes.md` не создано)
- [ ] TC-021 passes (указатель в закрытом issue создан, ссылки ведут на реально существующие файлы, маркера `TODO: Run /pf-` в нём нет, `legacy:` нигде нет, `specs.md`-заглушки нет, архив побайтово не изменён)
- [ ] TC-023 passes (`ё`/`Ё` учтены; `--doc-language` переопределяет; `size_tier` не проставлен; в `closed/` frontmatter не появился)
- [ ] TC-058 passes (все семь вырожденных входов; exit 0; повторный прогон побайтово тот же)

---

### Task 7: Безопасность и коллизии — гейты, отмена, dry-run, `.v2.md`, «файл против каталога»

**Mapped Test Cases:** TC-025, TC-026, TC-027, TC-028, TC-029, TC-051, TC-052, TC-053, TC-054, TC-055

**Files:**
- `test/converge-safety.sh` - **новый**
- `scripts/converge-to-v3.sh` - правки по итогам вскрытых дефектов (разбор коллизий, коды возврата, отчёт)

**Implementation Notes:**

**TC-029 — единственный TC без `--yes`.** Идёт **только** через `pf_run_converge_interactive` (S-2). `HOME=$TMP_HOME` действует и здесь (S-1): шаг 4 — это полноценный реальный прогон, ставящий 15 скилов и переписывающий shim; без обёртки он снёс бы установку разработчика. Проверяются четыре ветки: пустой ввод → код 4; `n` → код 4; `y` → exit 0 + T1-T11; **закрытый stdin без `--yes`** → код 4. В выводе отменённых прогонов — явное «cancelled/aborted», а не «Complete!».

**Порядок «переименование vs детект коллизии» (TC-053).** Переименование `implementation-plan.md` → `implementation_plan.md` выполняется **первым**; коллизия проверяется по **целевому** имени. Иначе наивный `mv` либо затирает v3-план (NAME-коллизии по дефисному имени нет), либо оставляет в папке два плана. Правильный результат: `implementation_plan.md` (v3, не тронут) + `implementation_plan.v2.md` (v2) + WARNING. Суффикс навешивается **после** нормализации имени — `implementation-plan.v2.md` появиться не должен.

**Один ID в разных статусах (TC-051).** Path-коллизии нет, и наивный перенос создал бы **одновременно открытый и закрытый** issue — `/pf` сканирует только `open/` и «воскресил» бы закрытую работу. Правило: **местоположение v3-копии авторитетно**; второй каталог для того же ID **никогда** не создаётся; событие попадает в WARNING-отчёт отдельной строкой. Проверяются **оба** направления (для этого в фикстуре два разных ID).

**`.v2.md` безопасны для `/pf`:** Step 5 (`pf/SKILL.md:57-67`) сверяется с точными именами (`brd.md`, `test_plan.md`, `implementation_plan.md`, …), и `implementation_plan.v2.md` ни одному из них не равен — лишних «пройденных стадий» не появляется.

**TC-054 — D-B, самый важный из этой группы.** Коллизия «файл против каталога»: суффикс `.v2.md` неприменим, а `.v2/` породил бы фантомный issue-каталог, который `/pf` увидел бы как второй активный issue. Правило: **не переносить**; ERROR-строка на каждый конфликт с **обоими** путями; converge **не падает** (остальные непроблемные элементы фазы 3 доводятся до конца), но возвращает код **1**; **фаза 5 не выполняется вовсе** — `planning/` остаётся цел. T1-T8 доливаются (они безопасны), T9/T10/T11 честно **не достигнуты**. Тихо пропустить T9-T11 и при этом стереть исходники — худший из возможных исходов.

> **Зависимость шага 8 TC-054 от Task 8 — и вытекающее уточнение Р7.** Шаг 8 требует, чтобы после неудавшегося переноса `detectState()` возвращал `'v2-or-older'`. Но фаза 6 к этому моменту **уже записала** `.pf-version` = `3.0.0` и `PLANNING.md` со штампом `3.0` (шаг 5 того же TC требует их наличия). Сегодняшний `detect.js` увидит штамп `3.0` и вернёт `'v3'`; порядок, в котором `.pf-version` читается первым, вернёт `'v3'` тем более. **Значит структурный отпечаток v2 (`planning/issues/`) обязан проверяться ПЕРЕД `.pf-version` и штампом `PLANNING.md`** — незавершённая миграция важнее любого маркера версии. Это прямое продолжение собственной логики Р7 («смешанная раскладка получает более срочную ветку») и единственная реализация, при которой одновременно зелены TC-054 (шаг 8), TC-005, TC-033 (`TCD-01`…`TCD-06` — ни в одном нет `planning/issues/`) и TC-034. Порядок уже зафиксирован в `analysis.md` (Р7, шаг 1) и реализуется в **Task 8**; поэтому **шаг 8 TC-054 зеленеет только после Task 8** — шаги 1-7 и 9-11 зелёные здесь.

**Acceptance Criteria:**
- [ ] TC-025 passes (отчёт: detected state, `.v2.md` поимённо, путь бэкапа + команда удаления, «что осталось руками», `--dry-run` помечен явно)
- [ ] TC-026 passes (`--dry-run` не меняет ни одного файла ни в `$TMP_WORK`, ни в `$TMP_HOME`; скилы не поставлены; бэкап не создан)
- [ ] TC-027 passes (untracked-файлы гейт **не** роняют; второй прогон зелёный — главный смысл D-A)
- [ ] TC-028 passes (правка отслеживаемого файла → код 3, **ни одного** изменения, в том числе в `$TMP_HOME`; `--force` обходит; отсутствие `.git` — не «грязно»)
- [ ] TC-029 passes (все четыре ветки отмены дают код 4; ни одна не даёт exit 0)
- [ ] TC-051 passes (оба направления кросс-статусной коллизии; второго каталога для того же ID нет)
- [ ] TC-052 passes (`analysis.v2.md` создан, `prompt.v2.md` — нет, v3-копия не тронута)
- [ ] TC-053 passes (`implementation_plan.v2.md`, а не `implementation-plan.v2.md`)
- [ ] TC-054 passes **кроме шага 8** (инвертированный T11 → `'v2-or-older'`): шаг зеленеет только после Task 8 — см. врезку выше. Шаги 1-7, 9-11 зелёные здесь; код возврата — 1
- [ ] TC-055 passes (`*.v2.v2.md` невозможен; третий прогон побайтово идентичен второму)

---

### Task 8: TUI — `detect.js` (Р7), `menu.js`/`actions.js`/`cli.js` (П1-4, Р11), тесты детектора и меню

**Mapped Test Cases:** TC-033 (`TCD-01`…`TCD-06`), TC-034 (`TCD-07`…`TCD-11`), TC-035, TC-036, TC-037, TC-049

> **ЭТА ЗАДАЧА ОБЯЗАНА ИДТИ ПЕРЕД УДАЛЕНИЯМИ (Task 9). ЭТО НЕ ВКУСОВЩИНА.**
> Сегодня `actions.js:79` и `:92` порождают процессы `scripts/setup-planning-v3.sh` и `scripts/migrate-v2-to-v3.sh`; `cli.js:90-98` диспетчеризует токены `install`/`migrate`; `menu.js:29-36` — это **единственные** пункты меню для состояний `none` и `v2-or-older`. Если бы Task 9 удалил оба скрипта раньше, то на **каждом** коммите между удалением и переключением TUI любой выбор пользователя в состоянии `none` или `v2-or-older` запускал бы **несуществующий файл** — а `~/.claude/bin/pf` — это рекламируемая точка входа фреймворка (`install.sh`, `README.md`). Порядок «сначала перепаять проводку, потом резать провода» обязателен.

**Files:**
- `tools/onboarding-tui/lib/detect.js` - новый порядок детекции (`:6`, `:36-45`, `:47-58`)
- `tools/onboarding-tui/lib/menu.js` - action-token `converge` в `MENUS.none`/`MENUS['v2-or-older']`/**`MENUS.v3`**; `.pf-version` в `printDiagnostics`
- `tools/onboarding-tui/lib/actions.js` - `runConverge(targetDir)`; удалить `runSetupV3`, `runMigrateV2ToV3` и комментарий P2-7 (`:63-77`); **переписать шапку модуля `:7` и `:12`** — она поимённо перечисляет оба удаляемых скрипта и цели `make setup-v3` / `make migrate-v2-to-v3`
- `tools/onboarding-tui/cli.js` - диспетчер `converge` вместо `install`/`migrate`; шапка `:11`
- `tools/onboarding-tui/test/detect.test.js` - новые кейсы `TCD-01`…`TCD-11`
- `tools/onboarding-tui/test/menu.test.js` - **новый** (`node --test`)

**Implementation Notes:**

**Корень дефекта 6.** `detect.js:39-45`: если `PLANNING.md` существует и не совпал с `V3_VERSION_RE` (`:6`), возвращается **`'unknown'` немедленно**, до всех прочих проверок. Настоящий v2-проект **всегда** несёт `PLANNING.md` со штампом `2.0` (`setup-planning-v2.sh:174` + sed) → всегда попадает в `'unknown'`. А ветка `'v2-or-older'` (`:52-58`) требует `CLAUDE.md` **при отсутствии** `PLANNING.md` — но v2-установщик `CLAUDE.md` не создаёт **никогда** → ветка на реальном v2-проекте **недостижима**. Проводка при этом целая: `menu.js:33-36` (пункт «Migrate»), `actions.js:91-94`, `cli.js:95-97`. Сломано ровно одно звено.

**Порядок детекции (Р7 — как он записан в `analysis.md` после этой редакции):**
1. **`planning/issues/` есть → `'v2-or-older'`** (структурный отпечаток v2). Проверяется **первым**, раньше `.pf-version` и штампа `PLANNING.md`. Обоснование — врезка в Task 7: converge доливает `.pf-version`/`PLANNING.md` даже когда перенос не удался (D-B), и без этого приоритета полумигрированный проект отрапортовал бы `'v3'`, получил бы v3-меню и молча остался бы с нетронутым `planning/`. **Незавершённая миграция важнее любого маркера версии.**
2. `.pf-version` есть → `3.x` → `'v3'`; `2.x`/`1.x` → `'v2-or-older'`; иное (`4.0.0`, мусор) → `'unknown'`.
3. `PLANNING.md` есть → штамп `3.x` → `'v3'`; штамп `2.x` → `'v2-or-older'`; **любой другой штамп или его отсутствие → провалиться дальше** (сегодня — немедленный `return 'unknown'`, `:44`).
4. Структурный отпечаток v3 (`docs/issues/{open,closed}` + `docs/planning/session-log.md`, `:47-50`) → `'v3'`.
5. `CLAUDE.md` есть **и `PLANNING.md` отсутствует** → `'v2-or-older'` (сегодняшнее `:56-58`; предусловие «нет `PLANNING.md`» **сохраняется**, иначе проект с будущим штампом `4.x` и `CLAUDE.md` классифицировался бы как v2 и ему предложили бы «миграцию» вниз).
6. Ничего нет → `'none'`; иначе → `'unknown'`.

**Безопасность нового шага 1 — проверено.** Ни один существующий кейс `detect.test.js` (`:19-27`, `:29-38`, `:40-53`, `:55-67`, `:69-78`, `:80-92`, `:94-103`) и ни один новый `TCD-*` не создаёт каталога `planning/issues/`, поэтому правило #1 для них **никогда не срабатывает**, и все они остаются зелёными (TC-035).

**П1-9 — токена `'v1'` НЕ вводить (KI-9).** `menu.js::MENUS` имеет ровно 4 ключа, а `showMenu` (`:110-113`) **бросает `Error`** на неизвестном state. v1-проект → `'v2-or-older'` (он и сегодня туда попадает через `:56-58`). Различение v1/v2 делается **внутри converge**, не в детекторе.

**KI-9, вторая половина: `showMenu` нельзя вызывать в `node --test`** — он открывает `readline` на `process.stdin` и крутится в цикле до валидного ввода (`:109-…`), то есть тест **повиснет**. Проверять `Object.keys(MENUS)` (модуль его экспортирует) либо подавать фейковый `rl` через `opts.rl` (`:115`).

**KI-20 — коллизия меток.** В `detect.test.js` **уже** заняты `TC-001`, `TC-002`, `TC-003`, `TC-004`, `TC-004b`, `P0-1` — они принадлежат **другому** issue. Новые кейсы несут префикс **`TCD-`**. Существующие тела **не переименовываются и не правятся** (TC-035, шаг 7 — `git diff` по ним пуст).

**Р11 — `MENUS.v3` трогается.** Сегодня в нём только `update-skills` и `issue-status` (`:37-40`) — попасть в converge из v3-состояния **нечем**, и потому «неполный v3» не долился бы никогда. Пункт converge присутствует в `MENUS.none`, `MENUS['v2-or-older']` и `MENUS.v3` с **разными метками** и **одним** action-token'ом `converge`. `MENUS.unknown` (`:41-43`) не меняется — единственный пункт `diagnose` — это намеренная страховка (комментарий `menu.js:25-27`).

**П1-4.** `actions.js::runConverge(targetDir)` вызывает `scripts/converge-to-v3.sh --target <targetDir>` — ограничение «поведение без аргументов менять нельзя, потому что `actions.js:79-80` зовёт скрипт без аргументов с `cwd: targetDir`» снято **вместе со скриптом**. Комментарий-компромисс P2-7 (`:63-77`) удаляется. **Шапка модуля (`:3-16`, ключевые строки `:7` и `:12`) переписывается обязательно**: без этого шаг 7 TC-036 (`grep -rn 'setup-planning-v3\|migrate-v2-to-v3' tools/` → ноль) не пройдёт, потому что оба имени живут прямо в комментарии.

**TC-049 (Manual) идёт с настоящим `$HOME`** — в этом и смысл. **Перед прогоном сделать резервную копию `~/.claude/skills/` и `~/.claude/bin/pf`** (converge их перезаписывает).

**Acceptance Criteria:**
- [ ] TC-033 passes (`TCD-01`…`TCD-06`: `.pf-version` бьёт штамп `PLANNING.md` в обе стороны; `4.0.0` и мусор → `'unknown'`; `3.1.0` → `'v3'`)
- [ ] TC-034 passes (`TCD-07`…`TCD-11`: настоящий v2 — по структурному отпечатку, раньше штампа; v1 → `'v2-or-older'`; смешанная раскладка → `'v2-or-older'`; штамп `4.0` + `CLAUDE.md` → `'unknown'`; множество токенов ⊆ `Object.keys(MENUS)`)
- [ ] TC-035 passes (все существующие кейсы `detect.test.js` зелёные **без правок их тел**)
- [ ] TC-036 passes (единый action-token `converge` в трёх меню; `MENUS.unknown` не тронут; `grep -rn 'setup-planning-v3\|migrate-v2-to-v3' tools/` → ноль **включая шапки `actions.js` и `cli.js`**)
- [ ] TC-037 passes (`printDiagnostics` печатает `.pf-version` — и когда он есть, и когда его нет)
- [ ] TC-049 passes (Manual) — E2E через TUI: `Detected: v2-or-older` (а не `unknown`), пункт converge, прогон, затем `Detected: v3` и пункт доливки; `/pf-qa-setup` создаёт `.qa-workflow.md`; `~/.claude/skills/` цел (15 скилов). **Перед прогоном сделан бэкап `~/.claude/`**
- [ ] **Шаг 8 TC-054** (Task 7, инвертированный T11 → `'v2-or-older'`) зеленеет здесь — переносится в статус PASS после этой задачи
- [ ] **Шаг 2 TC-002** (Task 4, `MENUS['v2-or-older']` содержит токен `converge`) зеленеет здесь
- [ ] Ни один тест не вызывает `showMenu` (KI-9) — иначе `node --test` повиснет
- [ ] `pf` (TUI) на всех четырёх состояниях запускает **существующий** скрипт: до этой задачи — старые, после неё — `converge-to-v3.sh`. Висящих ссылок нет ни на одном коммите

---

### Task 9: Удаление v1/v2-поверхности + `Makefile` + перенос v1-реликтов в архив

**Mapped Test Cases:** TC-038

**Files:**
- `scripts/setup-planning-v3.sh`, `setup-planning-v2.sh`, `migrate-v1-to-v2.sh`, `migrate-v2-to-v3.sh` - **удаляются**
- `templates/` (корневой каталог целиком) - **удаляется**
- `PLANNING.md.bootstrap`, `.qa-workflow.md.bootstrap` - **удаляются**
- `FRAMEWORK.md` (корневой, v1.1), `QUICK-REFERENCE.md` (корневой) - **переносятся** в `docs/planning/v1.0-archive/` с пометкой «historical»
- `docs/planning/MIGRATION-GUIDE.md` - **переносится** в `docs/planning/v1.0-archive/MIGRATION-GUIDE-v1-to-v2.md`
- `Makefile` - цель `converge`; удалить `setup-v2`, `setup-v3`, `migrate-v1-to-v2`, `migrate-v2-to-v3`; `.PHONY` и help
- `scripts/install.sh` - комментарии `:63-69`, `:84`
- `scripts/install.ps1` - текстовые упоминания
- `skills/pf-help/SKILL.md` - **`:69`** — блок «Installing in a new project» зовёт `bash ~/dev/planning-framework/scripts/setup-planning-v3.sh`. **Правится здесь, в одном коммите с удалением скрипта** — иначе скил рекламирует несуществующий файл (проверяется позже, TC-040 шаг 7)
- `CONTRIBUTING.md` - **`:108-117`** (блок «Run setup script» через `cd templates && ./setup-planning-framework.sh`) **и `:355`** (ссылки `[FRAMEWORK.md](FRAMEWORK.md)` / `[QUICK-REFERENCE.md](QUICK-REFERENCE.md)` — оба файла уезжают в архив этой же задачей, иначе две битые ссылки)

**Implementation Notes:**

> **ЭТО САМАЯ ДЕСТРУКТИВНАЯ ЗАДАЧА ПЛАНА.** Она удаляет четыре скрипта, каталог и два файла и **перемещает** три документа. Обязательны: чистое рабочее дерево (`git status --porcelain` пуст) **до** начала и отдельная ветка issue. Удаления выполняются `git rm`, переносы — `git mv` (здесь все файлы отслеживаются, так что пофайлового fallback не требуется — он нужен converge, который работает в **чужих** проектах). `git push` в этой задаче (и во всём плане) **не выполняется**.

Задача не имеет права начаться, пока **Task 4-7 не зелёные** (converge доказан) **и Task 8 не завершена** (TUI больше не зовёт удаляемые скрипты). Первое — чтобы не остаться без рабочей процедуры; второе — чтобы не остаться с `pf`, запускающим несуществующий файл. Это порядок, а не вкусовщина.

**`Makefile`:** цель `converge` заменяет **обе** — `setup-v3` (`:45-46`) и `migrate-v2-to-v3` (`:39-40`). Проброс аргумента — по **существующему прецеденту цели `tui` (`:48-49`)**: `bash scripts/converge-to-v3.sh $(if $(TARGET),--target $(TARGET),)`. Без `TARGET=` скрипт зовётся без аргументов, и целью становится `$(pwd)`.

**`install.sh` не делегирует в converge и не должен.** Он клонирует репозиторий в `~/.claude/planning-framework`, копирует скилы в `~/.claude/skills/` и пишет shim — в потребительский проект он не пишет **ничего**. Правятся только его комментарии `:63-69` и `:84`, которые ссылаются на удаляемый `setup-planning-v3.sh` («which only knows a fixed 7-skill list»).

**Про bootstrap-файлы.** Оба существуют и отслеживаются git (`PLANNING.md.bootstrap` — `**Version:** 2.0.0-bootstrap`; `.qa-workflow.md.bootstrap` — v2-шный generic-чеклист). Живого потребителя нет: `grep -rn "bootstrap"` по `scripts/`, `skills/`, `tools/`, `Makefile`, `CLAUDE.md`, `PLANNING.md`, `README.md`, `.qa-workflow.md`, `docs/planning/` даёт **0 совпадений**. Это реликты самозагрузки репозитория, у которого сегодня уже есть настоящие `PLANNING.md` (v3.0) и `.qa-workflow.md` (v3.0).

**Почему корневые `FRAMEWORK.md` и `QUICK-REFERENCE.md` переносятся, а не правятся.** Корневой `FRAMEWORK.md` — `**Version:** 1.1`, реликт v1: ссылается на `templates/prd-template.md` (`:104`), `templates/implementation-plan-template.md` (`:118`), `templates/session-log-template.md` (`:131`), `templates/decisions-template.md` (`:147`), `cp templates/…` (`:284-287`), `./setup-planning-framework.sh` (`:302`). `QUICK-REFERENCE.md` ссылается туда же (`:151`, `:155`). Утверждение «корневой `templates/` ссылается только сам на себя» — **ложное**, оно уже стоило одной редакции.

**Ссылки на них из `CONTRIBUTING.md` — ДВЕ, а не одна.** Помимо известного блока `:108-117`, строка **`:355`** («Getting Help») содержит `[FRAMEWORK.md](FRAMEWORK.md)` и `[QUICK-REFERENCE.md](QUICK-REFERENCE.md)` — обе ссылки корне-относительные и после переноса ведут в пустоту. Правятся здесь же: либо на `docs/planning/FRAMEWORK.md` (актуальный v3-гайд, что и имелось в виду), либо на архивные копии — по смыслу подходит первый вариант.

**Что временно остаётся битым (и это принято).** Текстовые упоминания удалённых скриптов в `README.md`, `CLAUDE.md`, `docs/planning/{FRAMEWORK,QUICKSTART}.md` доживут до Task 11 (там их чинит TC-039). Это **ссылки в документации**, а не исполняемые пути: ни одна команда и ни один скил после этого коммита не зовёт несуществующий файл (`Makefile`, `install.sh`, `install.ps1`, `pf-help`, `CONTRIBUTING.md`, весь `tools/` — уже исправлены). `docs/planning/templates/README.md` исправлен ещё в Task 3.

**`.claude/settings.local.json:7`** (permission-запись `Bash(bash scripts/setup-planning-v3.sh)`) — машинный конфиг, «Вне scope», не трогать.

**Acceptance Criteria:**
- [ ] TC-038 passes (`make -n converge` разворачивается в `bash scripts/converge-to-v3.sh --target …`; `make -n setup-v3|setup-v2|migrate-v1-to-v2|migrate-v2-to-v3` → «No rule to make target»; `make test` работает; `.PHONY` и `make help` согласованы)
- [ ] Четыре скрипта, корневой `templates/` и два `.bootstrap`-файла удалены; `scripts/converge-to-v3.sh` на месте
- [ ] `docs/planning/v1.0-archive/` содержит перенесённые `FRAMEWORK.md`, `QUICK-REFERENCE.md`, `MIGRATION-GUIDE-v1-to-v2.md`, каждый с пометкой «historical»
- [ ] `grep -rn 'setup-planning-v[23]\|migrate-v[12]-to-v[23]\|setup-planning-framework' Makefile scripts/ skills/ tools/ CONTRIBUTING.md` → ноль совпадений (исполняемая поверхность чиста уже на этом коммите)
- [ ] `CONTRIBUTING.md:355` не ссылается на корневые `FRAMEWORK.md` / `QUICK-REFERENCE.md`
- [ ] `make test` (Task 1-8) остаётся зелёным после удалений — ни один тест не опирался на удалённые скрипты
- [ ] Полная проверка «ни одной живой ссылки» — TC-039 — выполняется в Task 11, после того как появится `MIGRATION-GUIDE-V3.md`

---

### Task 10: Скилы — дефект 5 (меры 2 и 3), Р9, Р12

**Mapped Test Cases:** TC-042, TC-043, TC-044, TC-045, TC-046, TC-047, TC-048

**Files:**
- `skills/pf-size-tiers/SKILL.md` - **единственное** место определения «стадия завершена» (меры 2 и 3). Существующая секция «`notes.md` template» (`:58-76`) остаётся на месте и остаётся единственным домом trivial-шаблона
- `skills/pf/SKILL.md` - таблица Step 5 (`:57-67`), «check passed» (`:145`), **четыре** таблицы маршрутизации (`:87-91`, `:100-111`, `:118-127`, `:134-143`)
- `skills/pf-brd/SKILL.md` (`:11`), `pf-spec/SKILL.md` (`:10`), `pf-test-plan/SKILL.md` (`:14`), `pf-impl-plan/SKILL.md` (`:9`, `:10`), `pf-execute/SKILL.md` (`:20-22`) - Р9
- `test/skills-static.sh` - **новый.** TC-042, TC-043, TC-044
- `docs/issues/open/20260713-bug-v2-to-v3-migration-defects/manual_test_checklist.md` - Manual-кейсы TC-045…TC-050 (генерируется `/pf-test`)

**Implementation Notes:**

**Мера 2 — единое определение, в ОДНОМ месте.** Документ считается присутствующим, если файл существует **И** содержит непустое тело помимо заголовка **И** не содержит маркер-заглушку `TODO: Run /pf-` (искать **по всему файлу**, не по первым N строкам). Дом определения — `skills/pf-size-tiers/SKILL.md`: это существующий reference-скил, который остальные уже читают по ссылке (`pf/SKILL.md:170,190`, `pf-brd:9`, `pf-spec:7`, `pf-test-plan:7`, `pf-impl-plan:7`) и который не вызывается напрямую. Все **семь** гейтов на него **ссылаются**, а не формулируют собственный критерий — это проверяется grep'ом (TC-042, шаги 3-4: литерал `TODO: Run /pf-` встречается в `skills/` **ровно в одном файле**).

> **Почему `pf-size-tiers` — правильный дом, и почему второй копии шаблона там быть не должно.** Этот скил **уже** является единственным домом trivial-шаблона `notes.md` (`:58-76`), и `pf-brd/SKILL.md:21` берёт его именно оттуда, по абсолютному пути `~/.claude/skills/pf-size-tiers/SKILL.md`. Эта задача добавляет к нему второе общее правило («стадия завершена») по той же схеме. Ровно поэтому в Task 3 мы **не** заводим `docs/planning/templates/issue/notes.md`: это был бы второй источник правды для того же шаблона — тот самый разъезд, который данный issue и лечит.

Область применения — **все** строки таблицы Step 5 (`:57-67`), включая `notes.md`, `manual_test_checklist.md`, `qa_report.md`, а не только `test_plan.md`.

**Мера 2 — это страховочная сетка для ПРОШЛОГО.** Мера 1 (Task 6) не создаёт новых заглушек, но в уже мигрированных проектах (`llama-server`) они **лежат на диске прямо сейчас**, и мера 1 их оттуда не уберёт.

**Мера 3 / Р12 — ЧЕТЫРЕ таблицы, а не три.** Стадия считается завершённой, только если завершены **все предшествующие** стадии её конвейера; маршрутизация ключуется на **первой НЕзавершённой** стадии.
- **trivial (`:87-91`) — самая опасная и пропущенная тремя предыдущими редакциями.** Она ключуется **напрямую на существовании документов** — `:85` говорит это дословно. Путь атаки: Р5 намеренно не проставляет `size_tier` → legacy-tier guard (`:49-51`) спрашивает → пользователь отвечает `trivial` → правило приоритета (`:73`) отдаёт issue trivial-таблице **исключительно** → `/pf-brd` создаёт `notes.md` → строка `:91` («`notes.md` + `test_plan.md` both exist → `/pf-check` → `/pf-execute`») ведёт в реализацию против **заглушки**. Починка: колонка «documents present» переформулируется через **общее определение «стадия завершена»**, а не через голое существование файла. Механизм, ради которого trivial-таблица существует (правило приоритета `:73` и оговорка `:85`), **сохраняется** — мы меняем «файл есть» на «стадия завершена», и только.
- **bug (`:134-143`): сегодня в таблице ровно 8 строк, и строки «IMPL_PLAN без TEST_PLAN» среди них НЕТ** (проверено: `CREATE only` / `ANALYSIS present` / `ANALYSIS + check passed` / `TEST_PLAN` / `TEST_PLAN + check passed` / `IMPL_PLAN → /pf-execute` / `TESTING` / `QA`). Мигрированный v2-bug-issue (`analysis.md` + переименованный `implementation_plan.md`, `test_plan.md` нет) попадает **прямо** в строку `:141` → `/pf-execute` против несуществующего тест-плана. Строку добавить.
- **feat (`:100-111`) и improve (`:118-127`):** строки «IMPL_PLAN есть, но BRD/SPEC/TEST_PLAN отсутствуют» ведут **назад, к первой дыре**.
- **«check passed» (`:145`)**: сегодня проверка считается пройденной, если следующий по порядку документ уже существует → stub **автоматически «проходит»** `/pf-check`. Правило переформулируется через общее определение.

**Р9 — четыре «выходных» гейта дают выбор, два «входных» остаются stop'ами.** `pf-brd:11`, `pf-spec:10`, `pf-test-plan:14`, `pf-impl-plan:10` → **regenerate / keep / cancel**. `pf-impl-plan:9` («`test_plan.md` must exist») и `pf-execute:20-22` **остаются stop'ами**, но опираются на общее определение (заглушка входом не считается). Проверка (TC-044, шаг 7): слово `regenerate` встречается **ровно в четырёх** файлах — в `pf-execute` его нет.

**Снятие противоречия Р1/Р9.** «Послаблений в гейтах нет» относится к **порядку конвейера** (это обеспечивает мера 3). Р9 меняет другое — «файл уже существует → stop» превращается в вопрос: сегодня владелец мигрированного issue **заперт снаружи собственного плана** (у него `implementation_plan.md` уже есть — переименован из v2-шного). Оба правила совместимы и оба обязательны.

**KI-4 — Manual-TC начинаются с `bash scripts/update-skills.sh`.** Правка скила в репозитории **не вступает в силу**, пока не обновлены копии в `~/.claude/skills/` — исполняются именно они. Auto-TC (TC-042/043/044) этой проблемы не имеют: они читают `skills/` репозитория напрямую.

**Правило безопасности для ВСЕХ Manual-TC этой задачи (P2-6).** TC-045, TC-046, TC-047 и TC-048 идут в живой сессии с **настоящим `$HOME`**, вне обёрток S-1, и каждый из них требует **реального прогона converge** (их проекты — это «результат converge на копии фикстуры»); `update-skills.sh` вдобавок сам пишет в `~/.claude/skills/`. **Перед каждым таким прогоном обязательна резервная копия `~/.claude/skills/` и `~/.claude/bin/pf`** — то же требование, что и у TC-049 (Task 8). Инструкция «сделать бэкап `~/.claude/`» переносится в `manual_test_checklist.md` как предусловие **каждого** Manual-TC, запускающего converge (TC-045…TC-049), а не одного лишь TC-049.

**Task 10 не зависит от Task 9** (файлы не пересекаются: Task 9 правит `pf-help`, Task 10 — остальные скилы) и формально может идти параллельно. На практике сериализуется: Task 9 деструктивна и требует чистого рабочего дерева.

**Acceptance Criteria:**
- [ ] TC-042 passes (определение в `pf-size-tiers` содержит все три конъюнкта; литерал `TODO: Run /pf-` в `skills/` — ровно в одном файле; все семь гейтов **ссылаются**, а не дублируют)
- [ ] TC-043 passes (таблиц четыре; в bug добавлена строка «IMPL_PLAN без TEST_PLAN»; trivial-таблица переформулирована через «стадия завершена»; правила `:73` и `:85` сохранены; формулировки «три таблицы» в `skills/` не осталось)
- [ ] TC-044 passes (четыре выходных гейта дают regenerate/keep/cancel; два входных остаются stop'ами)
- [ ] TC-045 passes (Manual) — `/pf` на мигрированном v2-**bug**-issue не ведёт в `/pf-execute`
- [ ] TC-046 passes (Manual) — stub-`test_plan.md` не засчитывается; `/pf` ведёт к первой незавершённой стадии
- [ ] TC-047 passes (Manual) — ответ `trivial` больше не открывает дверь в `/pf-execute` против заглушки
- [ ] TC-048 passes (Manual) — живой интерактив regenerate/keep/cancel во всех четырёх скилах
- [ ] Секция «`notes.md` template» в `pf-size-tiers/SKILL.md` осталась единственной копией шаблона; в `docs/planning/templates/issue/` его нет
- [ ] Все Manual-прогоны начаты с `bash scripts/update-skills.sh` (KI-4) **и с резервной копии `~/.claude/skills/` + `~/.claude/bin/pf`** (P2-6)

---

### Task 11: Документация, счётчики скилов, финальная проверка удалений

**Mapped Test Cases:** TC-039, TC-040, TC-050

**Files:**
- `docs/planning/MIGRATION-GUIDE-V3.md` - **новый** гайд по converge
- `CLAUDE.md` (репозитория) - `:16`, `:34` («7 skills»); `:19`, `:101-104`
- `README.md` - `:31`, `:92`, `:107`, `:239`, `:244`; новая секция «Skills» (15). `:391-398` — **не трогать**
- `docs/planning/FRAMEWORK.md` - `:88`, `:103`, `:375`, `:427-438`, **`:469-470`**, `:598`, **`:602-603`**
- `docs/planning/QUICKSTART.md` - `:27`, `:39`, `:424`, `:504`, `:505`
- `skills/pf-update/SKILL.md` - список «Managed Skills» (`:13-26`) + сверка `.pf-version`
- `tools/onboarding-tui/lib/tutorial.js` - `:48-57`
- `docs/issues/open/20260713-bug-v2-to-v3-migration-defects/qa_report.md` - результат `/pf-qa`
- `docs/issues/open/20260713-bug-v2-to-v3-migration-defects/session-log.md` - финальная запись

**Implementation Notes:**

**Живые счётчики скилов, которые надо привести к 15** (проверено, каждый — по факту): `CLAUDE.md:16,34` — «7 Claude Code skills»; `docs/planning/QUICKSTART.md:39` — 11 перечисленных; `docs/planning/FRAMEWORK.md:375` — «Eleven Claude Code skills» (и там же — упоминание `setup-planning-v3.sh`); `skills/pf-update/SKILL.md:13-26` — 14 из 15 (нет **`pf-manual-test`**); `tools/onboarding-tui/lib/tutorial.js:48-57` — 10 из 15.

**`skills/pf-help/SKILL.md:69` здесь НЕ правится** — он уже исправлен в Task 9, в одном коммите с удалением скрипта, который зовёт. TC-040 шаг 7 лишь **проверяет** результат.

**`docs/planning/FRAMEWORK.md` — удаляемые скрипты идут ПАРАМИ (P2-1).** Не `:469` и `:602`, а **`:469`+`:470`** (`setup-planning-v3.sh` / `migrate-v2-to-v3.sh` в дереве каталогов) и **`:602`+`:603`** (те же два в списке «Scripts»). Правка только нечётной строки из каждой пары оставила бы битую ссылку — предыдущая редакция плана называла ровно по одной строке.

**`docs/planning/FRAMEWORK.md:427-438` — устаревшая плоская раскладка** (`skills/pf-execute.md` и т.п. вместо каталогов со `SKILL.md`). Блок начинается на **`:427`** (`├── skills/`), а не на `:430`.

**`README.md:391-398` (Version History) НЕ трогать** — переписывание фальсифицирует историю релизов. Строка про «7 Claude Code skills» в релизе 3.0.0 была верна **на момент релиза**. Актуальный список даётся **отдельной** секцией «Skills».

**Два разных `FRAMEWORK.md` — их надо перестать путать.** Корневой (v1.1) уже уехал в архив в Task 9; правится **`docs/planning/FRAMEWORK.md`** (v3.0.0, актуальный гайд). Ссылку `:598` на перенесённый v1→v2-гайд поправить на `v1.0-archive/MIGRATION-GUIDE-v1-to-v2.md`.

**`CLAUDE.md:19` и `README.md:31` сегодня ошибочно подписывают гайд v1.0 → v2.0 как путь «upgrade v2.0 → v3.0»** — переадресовать на новый `MIGRATION-GUIDE-V3.md`.

**`pf-update` — P2:** скил обновляет скилы, но **никогда не трогает `.pf-version` проекта** → тихий дрейф. Добавить: сверить `.pf-version` проекта с версией фреймворка и при расхождении или отсутствии напечатать рекомендацию запустить converge.

**TC-039, шаг 5 — ловушка grep'а.** Флаг `--exclude-dir=issues` **обязателен**: без него grep находит десятки совпадений в документах *этого самого issue* (где удаляемые имена обсуждаются по делу) и даёт ложный FAIL. Допустимые остатки — только `CHANGELOG.md`, `docs/planning/v1.0-archive/`, `docs/planning/session-log.md`, `docs/planning/v2.0-design-analysis.md`, `README.md:391-398`, `.claude/settings.local.json`: всё это исторические/машинные записи, вынесенные «Вне scope».

**TC-039, шаг 8 — теперь ДВА места в `CONTRIBUTING.md`.** Проверяются и блок `:108-117`, и строка `:355`: ни `[FRAMEWORK.md](FRAMEWORK.md)`, ни `[QUICK-REFERENCE.md](QUICK-REFERENCE.md)` (корне-относительные ссылки на уехавшие в архив файлы) остаться не должны. Правку делает Task 9; TC-039 её проверяет.

**TC-050** — прогон `/pf-qa` целиком, живьём, на исправленном `.qa-workflow.md` (Task 1). Гейт «No unrelated changes» (`:84`) сверяется со списком файлов из **`implementation_plan.md`** — и он **исполним**: у bug-issue тира large нет ни `specs.md`, ни `notes.md`. Именно поэтому списки Create/Modify/Delete этого плана обязаны быть исчерпывающими. Гейт Testing (`:40`) требует `grep -c '| \[ \] *|' … test_plan.md` → `0`, то есть все 58 строк Status Tracker должны быть отмечены к этому моменту. Гейт shellcheck (`:26`) после правки Task 1 покрывает `scripts/*.sh test/*.sh`.

**Acceptance Criteria:**
- [ ] TC-039 passes (ни одной живой ссылки на удалённые скрипты, корневой `templates/`, bootstrap-файлы и `templates/config/.qa-workflow.md`; `CONTRIBUTING.md:108-117` и `:355` исправлены; `MIGRATION-GUIDE-V3.md` существует и на него ведут `CLAUDE.md`/`README.md`; `shellcheck scripts/*.sh test/*.sh` exit 0)
- [ ] TC-040 passes (все счётчики = 15; `pf-update` перечисляет `pf-manual-test`; `pf-help:69` не зовёт удалённый скрипт — правка сделана в Task 9; раскладка `skills/` в `FRAMEWORK.md` — каталогами; `README.md:391-398` не изменён)
- [ ] TC-050 passes (Manual) — `/pf-qa` проходит целиком, `qa_report.md` с вердиктом
- [ ] Status Tracker `test_plan.md` заполнен полностью: 58 строк, ни одной `[ ]`
- [ ] `session-log.md` issue содержит записи по всем 11 задачам

---

## Dependencies

**Жёсткие ограничения (нарушение любого = переделка):**

1. **Task 1 → всё остальное.** Ни один тест не имеет права запускать converge иначе как через обёртки `test/lib.sh`. Обёртки должны существовать раньше, чем появится первый файл, способный их обойти.
2. **Task 2 → Task 3 (СТРОГО последовательно, не параллельно) → Task 4.** Фикстура `v3-incomplete` обязана нести `docs/planning/templates/` **в сегодняшнем виде** — с `config/.qa-workflow.md` и v2-штампованным `config/PLANNING.md`. Ровно эти два файла Task 3 уничтожает (первый удаляет, второй переписывает в generic-v3). Снять фикстуру **после** Task 3 будет не с чего, а без неё TC-011 (зеркалирование) не проверяет ничего. Фикстуры при этом **рукотворные**: снять их прогоном `setup-planning-v2.sh` невозможно (KI-7).
3. **Task 4 → Task 5, 6, 7.** Скрипт пишется целиком в Task 4; последующие задачи гоняют его по своим группам фикстур и чинят вскрытое. Обратный порядок невозможен: тест, зависящий от ещё не написанного скрипта, — это ровно та ошибка, которой страдал предыдущий (до-пивотный) план.
4. **Task 4 → Task 8.** `actions.js::runConverge` спаунит `scripts/converge-to-v3.sh`; переключать TUI **до** появления скрипта — та же болезнь висящей ссылки, только зеркально. Task 8 ставится **после** Task 7, чтобы TUI переключался на **доказанный** converge.
5. **Task 8 → Task 9 (КРИТИЧНО, P0).** `menu.js:29-36` — единственные пункты меню для состояний `none` и `v2-or-older`; они ведут через `cli.js:90-98` в `actions.js:79,92`, которые спаунят `setup-planning-v3.sh` и `migrate-v2-to-v3.sh`. Удалить эти скрипты **до** перепайки TUI значит оставить `~/.claude/bin/pf` — рекламируемую точку входа — запускающим несуществующий файл на каждом промежуточном коммите.
6. **Task 4-7 (зелёные) → Task 9.** Удаление четырёх скриптов **до** того, как converge доказан, оставило бы репозиторий без единственной работающей процедуры. Это не стилистика, это состояние `HEAD` на промежуточном коммите.
7. **Task 7 → Task 8 (два отложенных шага).** Шаг 8 TC-054 (после неудавшегося переноса `detectState()` = `'v2-or-older'`) требует нового порядка детекции: `planning/issues/` проверяется **раньше** `.pf-version`. Шаг явно помечен как отложенный в Task 7 и зеленеет в Task 8. Симметрично: шаг 2 TC-002 (Task 4) зеленеет в Task 8. Оба отложенных шага закрываются **до** деструктивной Task 9.
8. **Task 9 → Task 11.** TC-039 («ни одной живой ссылки») проверяет результат удалений Task 9 **плюс** новый `MIGRATION-GUIDE-V3.md` из Task 11 — поэтому он и живёт в Task 11.
9. **Task 10 → Manual-прогоны.** Ни один Manual-TC не имеет смысла до `bash scripts/update-skills.sh`: исполняются копии из `~/.claude/skills/`, а не файлы репозитория (KI-4). Task 10 формально независима от Task 9, но сериализуется после неё (Task 9 деструктивна и требует чистого дерева).

**Граф (стрелка = «обязан быть завершён до»):**

```
Task 1 (harness) ──► Task 2 (fixtures) ──► Task 3 (templates) ──┐
                                                                ▼
                                                Task 4 (converge + fresh tests)
                                                                │
                        ┌───────────────────────┬───────────────┴───────────────┐
                        ▼                       ▼                               ▼
                  Task 5 (migrate)      Task 6 (normalize)               Task 7 (safety)
                        └───────────────────────┴───────────────────────────────┘
                                                │
                                                ▼
                            Task 8 (TUI: detect.js + menu/actions/cli)
                            закрывает TC-002 шаг 2 и TC-054 шаг 8;
                            ОБЯЗАНА предшествовать удалениям (P0)
                                                │
                                                ▼
                            Task 9 (deletions + Makefile + архив)  ◄── ДЕСТРУКТИВНАЯ
                                                │
                                                ▼
                            Task 10 (skills: меры 2/3, Р9, Р12)
                                                │
                                                ▼
                            Task 11 (docs + счётчики + /pf-qa)
```

**Безопасность — сквозные правила, действующие во ВСЕХ задачах:**

- **Каждый** автоматический вызов converge идёт через `test/lib.sh` (`HOME=$TMP_HOME` из `mktemp -d`, `--yes`). Прямой вызов — **дефект сам по себе**, независимо от того, что тест проверяет (S-1, проверяется TC-032).
- **Каждый Manual-прогон, запускающий converge или `update-skills.sh` (TC-045…TC-049), начинается с резервной копии `~/.claude/skills/` и `~/.claude/bin/pf`.** В живой сессии `$HOME` настоящий, и обёртки S-1 не действуют.
- Деструктивные задачи (**Task 3** — удаление шаблона; **Task 9** — удаление четырёх скриптов, каталога `templates/`, двух bootstrap-файлов и перенос трёх документов) выполняются **только** на чистом рабочем дереве и **только** в ветке issue.
- **`git push` не выполняется ни в одной задаче плана.**
- Рабочее дерево репозитория в тестах не мутируется никогда: нужна правка — `pf_repo_copy` → `$TMP_REPO` (S-5, KI-19).

---

## Complexity Estimate

| Task | Что | Сложность | Оценка (сессий) |
|---|---|---|---|
| 1 | Test harness + `make test` + Р6 (четыре гейта) | Medium | 1 |
| 2 | 11 фикстур + `README.md` | Medium (объёмно, но механически) | 1 |
| 3 | v3-шаблоны (1 новый, 1 переписан, 4 проштампованы, 1 удалён) | Medium | 1 |
| 4 | `converge-to-v3.sh` (7 фаз, ~600-800 строк bash) + 13 TC | **High** | 1-2 |
| 5 | Тесты переноса/бэкапа/`git mv`/белого списка + правки | High | 1 |
| 6 | Тесты нормализации issue + правки | Medium | 1 |
| 7 | Тесты безопасности и коллизий + правки | High | 1 |
| 8 | TUI: `detect.js`, `menu.js`, `actions.js`, `cli.js` + тесты | Medium | 1 |
| 9 | Удаления + `Makefile` + архив + `pf-help` + `CONTRIBUTING` | Medium (но **деструктивно**) | 1 |
| 10 | Скилы: меры 2/3, Р9, Р12 + статические тесты + 4 Manual | High (текст-инструкции; цена ошибки — воскресший дефект 5) | 1 |
| 11 | Документация, счётчики, TC-039/040, `/pf-qa` | Medium | 1 |

**Итого:** 11 задач, **11-12 сессий**. Общая сложность — **High**.

**Где сосредоточен риск:**
1. **Task 4** — единственная задача, где пишется весь скрипт. Ловушки перечислены в её Implementation Notes и все проверены эмпирически или чтением кода: пофайловый fallback `git mv`, `cp -r` как наложение вместо зеркала, гейт worktree по untracked, отмена с кодом 0, даты в артефактах, условие срабатывания бэкапа.
2. **Task 10** — правится не код, а инструкции, которые интерпретирует модель. Статические тесты (TC-042/043/044) ловят структуру, но не смысл; поэтому за ними обязательны живые TC-045…TC-048.
3. **Task 9** — необратимость. Две защиты: converge к этому моменту зелёный на всех пяти исходных состояниях (Task 4-7), и TUI уже не зовёт удаляемое (Task 8).

---

## Phased Rollout

Фазы упорядочены так, чтобы **деструктивная работа шла только по доказанному пути**, а исполняемые точки входа ни на одном коммите не указывали в пустоту. Каждая фаза заканчивается коммитом с зелёным `make test`.

### Phase I — Обвязка и предпосылки (Task 1, 2, 3)

**Цель:** сделать возможными автотесты, не тронув ни одного **живого** пути установки.
Появляются `test/lib.sh` с тремя обёртками, 11 фикстур, v3-шаблоны и исправленные QA-гейты (четыре штуки). Ни один скрипт не удалён; **`make setup-v3` и `make migrate-v2-to-v3` продолжают работать**, и оба действия TUI продолжают запускать существующие файлы.

> **Честно: Phase I ломает `make setup-v2` и деградирует `make migrate-v1-to-v2`. Это принято.**
> Task 3 удаляет `docs/planning/templates/config/.qa-workflow.md` (Р4) и переписывает `config/PLANNING.md` в generic-**v3**-документ. Последствия, проверенные по коду:
> - `scripts/setup-planning-v2.sh` несёт `set -e` (`:5`) и копирует шаблон `.qa-workflow.md` **без охраны `if [ -f ]`** (`:200`, `cp "$TEMPLATE_DIR/config/.qa-workflow.md" "$QA_OUTPUT_FILE"`) → начиная с этого коммита **`make setup-v2` завершается ненулевым кодом** и остаётся сломанным до Task 9;
> - `scripts/migrate-v1-to-v2.sh` ту же копию **охраняет** (`:212`, `if [ -f "$TEMPLATE_DIR/config/.qa-workflow.md" ]`) → не падает, но молча перестаёт создавать `.qa-workflow.md`;
> - оба копируют `config/PLANNING.md` (`setup-planning-v2.sh:174`, `migrate-v1-to-v2.sh:172-178`) и потому начинают выдавать v2-проекту документ со штампом **v3**.
>
> Эти две цели **не защищаются и не чинятся**: они удаляются в Task 9 вместе со скриптами (Р2). Выдавать их за рабочие было бы ложным утверждением. Рабочий путь установки на Phases I–III — `make setup-v3` (он копирует каталог шаблонов целиком, `:89`, и на конкретные файлы `config/` не ссылается — проверено), а с Task 4 — ещё и `make converge`.

**Выход фазы:** `make test` зелёный; `make setup-v3`, `make migrate-v2-to-v3` и TUI работают.

### Phase II — Converge построен и зелёный (Task 4, 5, 6, 7)

**Цель:** доказать сходимость **до** того, как на неё что-то переключено и что-то удалено.
`converge-to-v3.sh` существует **параллельно** со старыми скриптами. Пользователь на любом коммите этой фазы имеет и старый путь (`make setup-v3`), и новый (`make converge`). Все Auto-TC, относящиеся к converge, зелёные — кроме двух явно отложенных шагов (шаг 2 TC-002 и шаг 8 TC-054), которые закрываются в Phase III.

**Выход фазы:** converge доказан на всех **пяти** исходных состояниях (нет PF / v1 / v2 / смешанное / неполный v3), идемпотентен побайтово, восстанавливается после обрыва, не роняет данные при коллизиях и не возвращает 0 при отмене.

**Гейт перед Phase III:**
- [ ] `make test` зелёный
- [ ] TC-001…TC-032 (кроме двух отложенных шагов), TC-051…TC-058 отмечены PASS
- [ ] `shellcheck scripts/*.sh test/*.sh` exit 0

### Phase III — TUI переключён на converge (Task 8) — **НЕ деструктивна**

**Цель:** перепаять проводку **до** того, как резать провода.
`detect.js` получает новый порядок (структурный отпечаток v2 → `.pf-version` → штамп `PLANNING.md` → отпечаток v3 → `CLAUDE.md`); `menu.js`/`actions.js`/`cli.js` схлопывают `install`/`migrate` в единый `converge`, пункт converge появляется и в `MENUS.v3`. Здесь же зеленеют оба отложенных шага Phase II.

На выходе этой фазы `tools/` **не содержит ни одного упоминания** удаляемых скриптов (TC-036 шаг 7) — включая шапки `actions.js` (`:7`, `:12`) и `cli.js` (`:11`). Старые скрипты всё ещё лежат на диске и всё ещё доступны через `make setup-v3` / `make migrate-v2-to-v3`, так что откат дешёв.

**Гейт перед Phase IV (не проходить без выполнения):**
- [ ] `grep -rn 'setup-planning-v3\|migrate-v2-to-v3' tools/` → ноль
- [ ] `pf` (TUI) на состояниях `none`, `v2-or-older`, `v3` запускает `converge-to-v3.sh`
- [ ] TC-002 (все шаги) и TC-054 (все шаги) отмечены PASS

### Phase IV — Удаления (Task 9) — **ТОЧКА НЕВОЗВРАТА**

**Цель:** снять вторую точку входа вместе со всей v1/v2-поверхностью.
Удаляются четыре скрипта, корневой `templates/`, два bootstrap-файла; `Makefile` переводится на `converge`; корневые v1-реликты уезжают в `docs/planning/v1.0-archive/`. В том же коммите правятся **все** исполняемые/скиловые ссылки на удаляемое: `install.sh`, `install.ps1`, `skills/pf-help/SKILL.md:69`, `CONTRIBUTING.md:108-117` и `:355`.

Это **единственная фаза, откуда нет дешёвого отката**. Она разрешена только после гейтов Phase II и Phase III. Рабочее дерево обязано быть чистым; вся работа — в ветке issue; `git push` не выполняется.

**Выход фазы:** `make converge` — единственный путь установки; `make test` по-прежнему зелёный; ни одна команда, ни один скил и ни один файл `tools/` не зовёт несуществующий скрипт. Битыми временно остаются только **текстовые ссылки в `README.md` / `CLAUDE.md` / `docs/planning/{FRAMEWORK,QUICKSTART}.md`** — их чинит Phase VI (TC-039).

### Phase V — Скилы (Task 10)

**Цель:** закрыть дефект 5 со всех сторон.
Мера 2 (единое определение «стадия завершена» — один дом, `pf-size-tiers`), мера 3 / Р12 (четыре таблицы маршрутизации), Р9 (regenerate/keep/cancel). Статические тесты TC-042/043/044 плюс четыре живых Manual-кейса (TC-045…TC-048), каждый — после `update-skills.sh` и после резервной копии `~/.claude/`.

**Выход фазы:** сценарий `llama-server` (`Completed: CREATE, TEST_PLAN, IMPL_PLAN` → `/pf-execute` против строки `TODO`) не воспроизводится **ни на одном** из четырёх маршрутов — включая trivial, который пропустили пять предыдущих редакций.

### Phase VI — Документация и закрытие (Task 11)

**Цель:** не оставить пользователю ни одной битой ссылки ровно в тот момент, когда он делает онбординг.
Новый `MIGRATION-GUIDE-V3.md`; счётчики скилов приведены к 15; TC-039 доказывает, что удалённая поверхность не оставила живых ссылок (включая `CONTRIBUTING.md:355` и обе пары строк `FRAMEWORK.md`); `/pf-qa` (TC-050) прогоняется целиком по исправленному `.qa-workflow.md`, чей гейт «No unrelated changes» сверяется со списками Create/Modify/Delete **этого документа**.

**Выход фазы:** issue физически может закрыться по собственным правилам фреймворка.

---

## TC Mapping — полнота (перепроверено после перенумерации)

| Task | Mapped TCs | Кол-во |
|---|---|---|
| 1 — Harness + QA-гейты | TC-041 | 1 |
| 2 — Фикстуры | — (предпосылка) | 0 |
| 3 — Шаблоны | — (предпосылка) | 0 |
| 4 — Converge + «чистые» пути | TC-001, 002, 003, 005, 009, 011, 013, 014, 015, 024, 030, 031, 032 | 13 |
| 5 — Перенос / бэкап / белый список | TC-004, 006, 007, 008, 016, 017, 018, 019, 022, 056, 057 | 11 |
| 6 — Нормализация issue | TC-010, 012, 020, 021, 023, 058 | 6 |
| 7 — Безопасность и коллизии | TC-025, 026, 027, 028, 029, 051, 052, 053, 054, 055 | 10 |
| 8 — TUI | TC-033, 034, 035, 036, 037, 049 | 6 |
| 9 — Удаления | TC-038 | 1 |
| 10 — Скилы | TC-042, 043, 044, 045, 046, 047, 048 | 7 |
| 11 — Документация | TC-039, 040, 050 | 3 |
| **Итого** | **TC-001…TC-058** | **58** |

**Проверка:** 1 + 0 + 0 + 13 + 11 + 6 + 10 + 6 + 1 + 7 + 3 = **58**. Каждый TC отображён **ровно на одну** задачу; ни один не отображён дважды; ни один не потерян. Совпадает с итогом `test_plan.md` (58 TC: 52 Auto + 6 Manual).

**Два шага отложены явно** (это шаги, а не TC — на распределение TC они не влияют):
- **TC-002, шаг 2** — назначен Task 4, зеленеет в Task 8.
- **TC-054, шаг 8** — назначен Task 7, зеленеет в Task 8.

Оба закрываются **до** деструктивной Task 9.
