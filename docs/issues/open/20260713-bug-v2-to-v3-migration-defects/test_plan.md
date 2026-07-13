# Test Plan: 20260713-bug-v2-to-v3-migration-defects

**Тип issue:** bug
**Size tier:** large
**Дата:** 2026-07-13 (2-я редакция)
**Источник требований:** `analysis.md` (3-я редакция) — решения Р0–Р12, целевое состояние T1–T11, «Условия приёмки», «Затронутые файлы», «Вне scope».

---

## Overview & Objectives

Issue перестал быть «починкой 5 дефектов миграции». Он стал пивотом: **поддержка v1/v2 удаляется, а вместо четырёх скриптов установки/миграции появляется один идемпотентный `scripts/converge-to-v3.sh`**, который приводит потребительский проект к целевому состоянию v3 (T1–T11) из **любого** исходного.

Тест-план проверяет ровно это.

**Objectives:**

1. **Сходимость.** Каждое из шести исходных состояний (пустой проект / проект с одним `CLAUDE.md` / v1 / v2 / полумигрированное-смешанное / неполный v3) после одного прогона converge удовлетворяет **всему** чеклисту T1–T11.
2. **Идемпотентность.** Второй прогон подряд не меняет ни байта и завершается кодом 0. Отсюда — правило D-E ниже: артефакты фреймворка не несут временных штампов.
3. **Восстанавливаемость.** Прогон, убитый в середине переноса, при повторном запуске доводится до конца и **не минтит** `.v2.md`-дубли уже перенесённых файлов.
4. **Безопасность деструктивных фаз.** Бэкап, гейт чистого worktree (**по отслеживаемым изменениям**, D-A), `--dry-run`, белый список удаления (не `rm -rf planning/`), пофайловый fallback `git mv` → `cp -a` + `rm`, разбор коллизий, **и правило «неудавшийся перенос ⇒ `planning/` не удаляется» (D-B)**.
5. **Честный CLI-контракт.** Отменённый прогон **не имеет права завершиться кодом 0** — сегодняшний `migrate-v2-to-v3.sh:94` (`read -p` + пустой `CONFIRM` → `exit 0`) — это ровно та ложно-зелёная ловушка, из-за которой автотесты проходили бы, не мигрировав ничего.
6. **Детектор видит реальность.** `detect.js` читает `.pf-version` первым; настоящий v2-проект и v1-проект попадают в `'v2-or-older'`; существующие тесты остаются зелёными.
7. **Дефект 5 закрыт со всех сторон.** Заглушка не создаётся (мера 1), уже лежащие на диске заглушки не засчитываются как пройденная стадия (мера 2), и ни одна стадия не перепрыгивается ни в одной из **четырёх** таблиц маршрутизации `skills/pf/SKILL.md` — **trivial (`:87-91`), feat (`:100-111`), improve (`:118-127`) и bug (`:134-143`)** (мера 3 / Р12).
8. **T6 — зеркалирование, а не наложение.** `docs/planning/templates/` в целевом проекте **совпадает** с фреймворковым: файлы, удалённые из фреймворка (`config/.qa-workflow.md`), исчезают и из проекта.
9. **Плейсхолдеры подставляются.** Пользователь не получает `PLANNING.md` с литералом `[Project Name]`.
10. **Удаления доведены до конца.** Ни одной живой ссылки на удалённые скрипты, шаблоны и bootstrap-файлы.
11. **Собственная QA фреймворка не блокирует этот issue** (Р6), и тестовый прогон **не портит рабочее дерево репозитория**.

**Explicitly out of scope** (по разделу «Вне scope» analysis.md): судьба шаблона `definition-of-done.md`; структурная переработка `docs/planning/FRAMEWORK.md`; исторические упоминания в `CHANGELOG.md`, `README.md:391-398`, `v1.0-archive/`, закрытых issue; `.claude/settings.local.json`.

---

## Решения, принятые в этой редакции тест-плана

Ниже — правила, которых не было в `analysis.md` и без которых часть кейсов недоопределена или самопротиворечива. Они обязательны для реализации.

### D-A — гейт чистого worktree смотрит только на ОТСЛЕЖИВАЕМЫЕ изменения

Гейт реализуется как `git status --porcelain --untracked-files=no` (эквивалентно `git diff --quiet HEAD`). **Неотслеживаемые файлы дерево грязным не делают.**

*Обоснование.* Собственные выходы converge (`docs/issues/`, `.pf-version`, `PLANNING.md`, `planning-backup-*`) в реальном репозитории после первого прогона **неотслеживаемы**. Гейт, чувствительный к untracked, сделал бы **второй** прогон converge падающим в любом git-репозитории — то есть сломал бы идемпотентность (Objective 2) и сделал бы неисполнимой фикстуру TC-017 (частичный коммит). Гейт защищает от потери **незакоммиченной правки отслеживаемого файла** — именно это и проверяется.

### D-B — неудавшийся перенос означает, что `planning/` НЕ удаляется

При коллизии «файл против каталога» (и при любом другом несостоявшемся переносе фазы 3) converge:
- завершается **ненулевым** кодом;
- **фаза 5 (удаление по белому списку) не выполняется вовсе**;
- каталог `planning/` остаётся **целым**;
- T1–T8 доливаются (они безопасны и неразрушительны), а **T9/T10/T11 явно НЕ достигнуты** — проект честно остаётся несошедшимся, `detectState()` продолжает возвращать `'v2-or-older'`.

*Обоснование.* Прямое следствие «Условий приёмки»: «никаких удалений (фаза 5), пока переносы (фаза 3) не завершены успешно». Тихо пропустить T9–T11 и при этом стереть исходники — худший из возможных исходов.

### D-C — фикстура «нет PF» распадается надвое; детекторов ДВА

Фикстура `no-pf` разделяется на `no-pf-bare` (действительно пустой проект) и `no-pf-claude` (есть только `CLAUDE.md`, никаких следов PF).

**В проекте два независимых детектора, и это нормально:**
- **собственный bash-детектор converge** (фаза 1) — различает «нет PF / v1 / v2 / смешанное / v3» по факту наличия каталогов; именно он выбирает фазы;
- **`detect.js`** — детектор TUI, у него всего 4 токена и другая задача: выбрать меню.

`detect.js` вернёт `'none'` для `no-pf-bare` и `'v2-or-older'` для `no-pf-claude` (правило `detect.js:56-58`, зафиксированное существующим тестом `detect.test.js:29-38` — «only CLAUDE.md present -> v2-or-older»). **Это поведение НЕ меняется.** Расхождение безвредно: `'v2-or-older'` маршрутизирует в пункт меню «Migrate», который после П1-4 и есть converge, а converge своим детектором опознаёт «нет PF» и делает чистую установку. Результат для обеих фикстур одинаков — полное T1–T11.

### D-D — `doc_language` в ЗАКРЫТЫЕ issue не пишется

Нормализация frontmatter (Р5) применяется **только к `docs/issues/open/`**. В `docs/issues/closed/` содержимое файлов не редактируется вовсе — это прямое следствие Р1 («архив не переписывается по содержанию»); единственное исключение — **добавление** нового файла `brd.md`-указателя.

### D-E — артефакты фреймворка не несут временных штампов

Артефакты T2/T3/T4/T6 (`.pf-version`, `PLANNING.md`, секция в `CLAUDE.md`, `docs/planning/templates/`) **перезаписываются на каждом прогоне**, поэтому любой штамп даты (`Last Updated:`, подставленный `YYYY-MM-DD`) сделал бы второй прогон отличным от первого и убил бы побайтовую идемпотентность (TC-007).

Правило: в новых шаблонах `templates/config/{PLANNING.md,CLAUDE.md}` **единственный** подставляемый плейсхолдер — `[Project Name]` (заменяется на basename целевого каталога). Строки с датой и плейсхолдер `YYYY-MM-DD` в них **отсутствуют**. (Временные штампы допустимы только там, где они не входят в целевое состояние: имя каталога `planning-backup-<YYYYMMDD-HHMMSS>/` и текст отчёта на stdout.)

### D-F — детерминированный тестовый хук `--fail-after`

Для воспроизводимого прерывания посреди фазы 3 converge принимает **скрытый** флаг `--fail-after=<N>`: аварийно завершиться с кодом 70 **сразу после N-го успешно перенесённого файла** фазы 3, не выполняя фаз 4–7. Флаг:
- **не печатается** в `--help` (поэтому не противоречит TC-030, шаг 7 — там перечисляются пользовательские флаги);
- действует только при `PF_CONVERGE_TEST_HOOKS=1` в окружении.

*Обоснование.* Альтернатива из 1-й редакции — «убить `SIGKILL` сразу после появления первого перенесённого файла» — это гонка без определённого механизма: тест недетерминирован, а точка убийства неизвестна.

### D-G — вырожденный `doc_language`: чего converge НЕ делает

- `prompt.md` в issue **отсутствует** → converge **не создаёт** его (Р1: никаких stub'ов в открытых issue), печатает WARNING и решение (`English`), идёт дальше.
- frontmatter в `prompt.md` **битый** (например, открывающий `---` без закрывающего) → converge **не редактирует файл**, печатает WARNING, идёт дальше. Попытка «починить» малформленный YAML риск потери данных.
- валидный frontmatter уже несёт `doc_language` → значение **не перезаписывается**.

---

## Prerequisites

### SAFETY RULES (обязательны, не обсуждаются)

> **S-1 — единственная точка вызова converge во всём `test/`.**
>
> Converge ставит скилы в `~/.claude/skills/` и перезаписывает shim `~/.claude/bin/pf`. Прогон с настоящим `$HOME` **уничтожает глобальную установку разработчика и ломает все параллельные сессии Claude Code**.
>
> Поэтому: **имя `converge-to-v3.sh` встречается в `test/` ровно в одном месте — во внутренней функции `_pf_converge_exec` в `test/lib.sh`.** Любой другой файл в `test/`, упоминающий скрипт напрямую (`bash scripts/converge-to-v3.sh …`, `"$REPO/scripts/converge-to-v3.sh" …`), — **сам по себе дефект**, независимо от того, что он проверяет и передаёт ли он `HOME`. Это проверяется автотестом (TC-032), а не глазами ревьюера.
>
> `_pf_converge_exec` **всегда** экспортирует `HOME=$TMP_HOME`, где `$TMP_HOME` — свежий `mktemp -d`.
>
> **Три публичные обёртки — и никаких других способов запустить converge:**
>
> | Обёртка | Что делает |
> |---|---|
> | `pf_run_converge [args…]` | `HOME=$TMP_HOME`; добавляет `--yes`; добавляет `--target "$TMP_WORK"`, если вызывающий не передал свой `--target`. Обычный неинтерактивный прогон |
> | `pf_run_converge_interactive <stdin-payload> [args…]` | `HOME=$TMP_HOME`; **`--yes` НЕ передаётся**; stdin подаётся из pipe (`printf '%s' "<payload>" \| …`). Для TC-029 (проверка отмены). Payload `""` = закрытый stdin (`< /dev/null`) |
> | `pf_run_converge_cwd <dir> [args…]` | `HOME=$TMP_HOME`; `cd <dir>`; **`--target` НЕ передаётся** — проверяется дефолт `$(pwd)`. Для TC-030, шаг 6 |
>
> **S-2 — `--yes` по умолчанию.** Единственная обёртка, не передающая `--yes`, — `pf_run_converge_interactive`, и она используется **только** в TC-029.
>
> **S-3 — работа только на копии фикстуры.** Фикстуры в `test/fixtures/` — read-only. `pf_setup_case <fixture>` копирует фикстуру в `$TMP_WORK` (`mktemp -d`), при необходимости делает там `git init` + первый коммит. Сама фикстура не изменяется никогда.
>
> **S-4 — уборка.** `$TMP_HOME`, `$TMP_WORK`, `$TMP_REPO` удаляются в `trap … EXIT`, в том числе при падении теста.
>
> **S-5 — репозиторий фреймворка тоже неприкосновенен.** Тест, которому нужно **изменить** репозиторий (добавить пробный скил, внести пробный `TODO:`), обязан работать на копии: `pf_repo_copy` делает `cp -a "$REPO_ROOT" "$TMP_REPO"` (вместе с `.git`, чтобы работали `git diff develop...HEAD` и коммиты) и возвращает путь. Мутировать `$REPO_ROOT` в тестах **запрещено**: падение теста на середине оставило бы рабочее дерево грязным и завалило бы гейт `Working tree clean` (`.qa-workflow.md:81`).
>
> Converge **обязан** определять корень фреймворка относительно пути **собственного файла** (`dirname "$0"/..`), а не относительно `$PWD` или зашитой константы: только тогда прогон `$TMP_REPO/scripts/converge-to-v3.sh` использует `skills/` и `docs/planning/templates/` **из копии**. Это проверяется в TC-009.

### Test infrastructure (Р6)

| Компонент | Путь | Назначение |
|---|---|---|
| Общая библиотека | `test/lib.sh` | `pf_setup_case`, `pf_repo_copy`, `_pf_converge_exec` + три обёртки (S-1/S-2), `assert_target_state` (T1–T11), `assert_tree_identical`, `assert_exit_code`, `snapshot_tree`, счётчики PASS/FAIL |
| Bash-тесты converge | `test/*.sh` | по одному файлу на группу TC |
| Юнит-тесты детектора | `tools/onboarding-tui/test/detect.test.js` | `node --test` |
| Юнит-тесты меню/CLI | `tools/onboarding-tui/test/menu.test.js` | `node --test` |
| Точка входа | `make test` | запускает `test/*.sh` + `node --test tools/onboarding-tui/test/`; `test` добавлен в `.PHONY` (`Makefile:3`) |

**Коллизия идентификаторов TC.** В `tools/onboarding-tui/test/detect.test.js` **уже** используются метки `TC-001`, `TC-002`, `TC-003`, `TC-004`, `TC-004b`, `P0-1` — они принадлежат **другому** issue. Новые кейсы этого issue, добавляемые в тот же файл, обязаны нести **отличный префикс**: `TCD-01`, `TCD-02`, … (`D` = detect). Существующие метки не переименовываются.

### Shared helper `assert_target_state <dir> <home>` — чеклист T1–T11

Целевое состояние проверяется **одной функцией**, а не переписывается в каждом TC. TC, у которых в графе Expected Result стоит «T1–T11 выполнены», ссылаются именно на неё.

| # | Проверка |
|---|---|
| T1 | существуют `docs/issues/open/`, `docs/issues/closed/`, `docs/planning/` |
| T2 | `.pf-version` существует и содержит `3.0.0` |
| T3 | `PLANNING.md` существует и несёт штамп `**Framework Version:** 3.0` |
| T4 | `CLAUDE.md` содержит **ровно одну** пару `<!-- pf:begin -->` / `<!-- pf:end -->` |
| T5 | существуют `docs/planning/{session-log,decisions,implementation-plan}.md` |
| T6 | `docs/planning/templates/` **зеркально совпадает** с `docs/planning/templates/` фреймворка (`diff -r` пуст в **обе** стороны — ни лишних, ни недостающих файлов) |
| T7 | в `$home/.claude/skills/` лежат **все 15** скилов (список берётся перебором `skills/*/SKILL.md` репозитория, не хардкодом) |
| T8 | существует и исполним shim `$home/.claude/bin/pf` |
| T9 | каталога `planning/issues/` нет; артефакты v1/v2 из белого списка удалены |
| T10 | ни в одном issue (`open/` **и** `closed/`) нет файла `implementation-plan.md` (дефисного) |
| T11 | `detectState(<dir>)` возвращает `'v3'` |

**Явно НЕ проверяется как часть T:** наличие `.qa-workflow.md` — это пользовательский документ (Р4), converge его не создаёт никогда.

**`assert_target_state` принимает флаг `--no-destructive`** (используется только TC-054, D-B): проверяются T1–T8, а T9/T10/T11 проверяются **инвертированно** — `planning/` обязан быть цел, `detectState()` обязан вернуть `'v2-or-older'`.

### Fixtures inventory (рукотворные, коммитятся, без вложенного `.git`)

| Фикстура | Состав | Используется в |
|---|---|---|
| `test/fixtures/no-pf-bare/` | обычный проект **без** `CLAUDE.md`: `README.md`, `src/main.js`. `detectState` → `'none'` (D-C) | TC-001, TC-009, TC-016, TC-024, TC-026 |
| `test/fixtures/no-pf-claude/` | то же + `CLAUDE.md` с пользовательским текстом и **без** каких-либо PF-секций. `detectState` → `'v2-or-older'` (`detect.js:56-58`) (D-C) | TC-002, TC-013, TC-014 |
| `test/fixtures/v1-project/` | `docs/prd.md`, `docs/planning/{implementation-plan,session-log,decisions,FRAMEWORK}.md`, `CLAUDE.md` с **неразмеченной** v1-секцией (баннер `# ====…` / `# Planning Framework Integration`) и пользовательским текстом **после** неё; каталога `docs/issues/` нет | TC-003, TC-015 |
| `test/fixtures/v2-project/` | `planning/issues/{open,closed}/`, `planning/scripts/issue-status.sh`, `planning/templates/`, `planning/FRAMEWORK.md`, `planning/{implementation-plan,session-log,decisions}.md`, корневой `PLANNING.md` (штамп `**Framework Version:** 2.0`, пути переписаны на `planning/`), корневой `.qa-workflow.md` (штамп `**Version:** 2.0`), **`CLAUDE.md` отсутствует**. Issues: `open/20250101-feat-alpha/` (`prompt.md` — русский, `analysis.md`, `implementation-plan.md`, `definition-of-done.md`), `open/20250102-bug-beta/` (`prompt.md`, `analysis.md`, `implementation-plan.md`), `closed/20241201-feat-gamma/` (`prompt.md`, `analysis.md`, `definition-of-done.md`, `implementation-plan.md`) | TC-004, TC-007, TC-008, TC-010, TC-012÷TC-014, TC-016÷TC-024, TC-026÷TC-031, TC-045, TC-049, TC-056, TC-057 |
| `test/fixtures/v2-with-stub/` | как `v2-project`, но в feat-issue уже лежит `test_plan.md`, всё содержимое которого — заголовок + `> TODO: Run /pf-test-plan to generate this file.` (снимок реальной порчи, которую мера 1 не убирает) | TC-046, TC-047 (Manual) |
| `test/fixtures/v3-incomplete/` | ровно то, что создаёт **сегодняшний** `setup-planning-v3.sh`: `docs/issues/{open,closed}/`, `docs/planning/{session-log,decisions,implementation-plan}.md`, `docs/planning/templates/` **в сегодняшнем виде — то есть включая `config/.qa-workflow.md` и v2-штампованный `config/PLANNING.md`** (`cp -r "$TEMPLATES_SRC/."`, `setup-planning-v3.sh:89`). **Нет** `.pf-version`, **нет** `PLANNING.md`, `CLAUDE.md` без pf-секции | TC-005, TC-011, TC-016 |
| `test/fixtures/mixed-layout/` | полумигрированное состояние: `planning/issues/open/20250101-feat-alpha/` и `docs/issues/open/20250101-feat-alpha/` существуют одновременно; `prompt.md` и `analysis.md` уже перенесены **побайтово идентично**, `implementation-plan.md` остался только в `planning/`; `planning/session-log.md` уже скопирован в `docs/planning/session-log.md` идентично | TC-006, TC-055 |
| `test/fixtures/collision-same-id/` | **три** issue-ID (П1-4 — один ID не может быть одновременно в одном и в разных статусах): **`<ID-A>` = `20250101-feat-alpha`** — `planning/issues/open/` + `docs/issues/closed/` (v2-open против v3-closed); **`<ID-B>` = `20250102-bug-beta`** — **один и тот же статус** (`open`) в обеих раскладках, причём `analysis.md` **различается**, `prompt.md` **побайтово идентичен**, и есть **и** `planning/…/implementation-plan.md`, **и** `docs/…/implementation_plan.md` (различаются); **`<ID-C>` = `20250103-improve-gamma`** — `planning/issues/closed/` + `docs/issues/open/` (обратный кросс-статусный случай) | TC-025, TC-051, TC-052, TC-053 |
| `test/fixtures/collision-file-dir/` | в `planning/issues/open/<ID>/` лежит **файл** `notes.md`, а в `docs/issues/open/<ID>/notes.md` — **каталог** (и симметричный обратный случай в другом issue). Плюс третий, бесконфликтный issue — чтобы было видно, что остальные переносы фазы 3 отработали | TC-054 |
| `test/fixtures/v2-latin/` | **семь** issue (П1-5): (1) латиница в `prompt.md`+`analysis.md`; (2) кириллица представлена **только** буквами `ё`/`Ё`, и их больше, чем латинских; (3) issue **без** `prompt.md` и без `analysis.md`; (4) `prompt.md` и `analysis.md` **пусты** (0 букв); (5) **поровну** кириллических и латинских букв; (6) `prompt.md` **уже несёт валидный** frontmatter `doc_language: Russian` (без `size_tier`); (7) `prompt.md` с **битым** frontmatter (открывающий `---` без закрывающего) | TC-023, TC-058 |
| `test/fixtures/planning-with-user-files/` | v2-раскладка + `planning/notes-of-mine.md` (файл, которого фреймворк никогда не создавал) | TC-018 |

Итого **11 фикстур**.

### Прочие предусловия

- `shellcheck` доступен в PATH (гейт `.qa-workflow.md:26`).
- Node.js ≥ 18 (`node --test`).
- Ветка issue отведена от `develop`; рабочее дерево репозитория чисто перед прогоном (`git status --porcelain` пуст) — иначе TC, сравнивающие деревья и дифы, дадут ложный сигнал. Обратное тоже обязано быть верно **после** прогона: ни один Auto-TC не оставляет репозиторий грязным (S-5).
- Для **Manual**-TC обязателен предварительный `bash scripts/update-skills.sh`: правки в `skills/` **не вступают в силу**, пока копии в `~/.claude/skills/` не обновлены. Именно поэтому эти TC и остаются ручными — они выполняются с **настоящим** `$HOME` в живой сессии Claude Code.

---

## Test Cases

### Functional

#### TC-001: Сходимость из пустого проекта (`no-pf-bare`)

**Description:** Чистый проект без каких-либо следов фреймворка и **без** `CLAUDE.md` после одного прогона converge полностью соответствует целевому состоянию T1–T11.
**Preconditions:** `pf_setup_case no-pf-bare`; `git init` + коммит; `$TMP_HOME` пуст.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `detectState("$TMP_WORK")` до прогона | `'none'` (D-C) |
| 2 | `pf_run_converge` | exit 0 |
| 3 | Прочитать stdout | Собственный детектор converge напечатал «Detected state: no PF» (или эквивалент) и итоговый отчёт |
| 4 | `assert_target_state "$TMP_WORK" "$TMP_HOME"` | T1–T11 выполнены; в том числе `CLAUDE.md` **создан** из шаблона `templates/config/CLAUDE.md` |
| 5 | Проверить наличие каталога `planning-backup-*` | Каталога нет — переносить и удалять было нечего (Р3, фаза 2) |
| 6 | Проверить `$TMP_WORK/.qa-workflow.md` | Файла нет; в stdout есть подсказка «Run `/pf-qa-setup`» |
**Test Data:** `test/fixtures/no-pf-bare/`
**Expected Outcome:** Проект приведён к v3 «с нуля»; бэкап не создан; `.qa-workflow.md` не создан, но подсказка напечатана.
**Priority:** Critical

#### TC-002: Сходимость из проекта с одним `CLAUDE.md` (`no-pf-claude`) — и два детектора (D-C)

**Description:** Проект без PF, но с `CLAUDE.md`, `detect.js` относит к `'v2-or-older'` (`detect.js:56-58`; поведение зафиксировано существующим тестом `detect.test.js:29-38` и **не меняется**). Собственный детектор converge при этом видит «нет PF». Оба маршрута обязаны сойтись к одному результату.
**Preconditions:** `pf_setup_case no-pf-claude`; `$TMP_HOME` пуст.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `detectState("$TMP_WORK")` до прогона | `'v2-or-older'` — расхождение с детектором converge **ожидаемо и безвредно** (D-C) |
| 2 | Прочитать `MENUS['v2-or-older']` | Содержит пункт с action-token `converge` (после П1-4) — то есть маршрут TUI ведёт в тот же скрипт |
| 3 | `pf_run_converge` | exit 0; собственный детектор converge печатает «нет PF», а не «v2» |
| 4 | `assert_target_state` | T1–T11 выполнены — результат тот же, что и у `no-pf-bare` |
| 5 | Проверить `CLAUDE.md` | Пользовательский текст сохранён побайтово; добавлена ровно одна пара `<!-- pf:begin -->`/`<!-- pf:end -->` |
| 6 | Проверить `planning-backup-*` | Каталога нет — переносить и удалять было нечего |
**Test Data:** `test/fixtures/no-pf-claude/`
**Expected Outcome:** Двухдетекторная схема не приводит к расхождению исходов; `detect.js` править не пришлось.
**Priority:** Critical

#### TC-003: Сходимость из v1-проекта

**Description:** v1-проект (`docs/planning/` без `docs/issues/`, неразмеченная секция в `CLAUDE.md`) сходится к T1–T11.
**Preconditions:** `pf_setup_case v1-project`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | Прочитать stdout | Исходное состояние опознано как v1 (различение v1/v2 делается внутри converge, а не `detect.js` — П1-9) |
| 3 | `assert_target_state` | T1–T11 выполнены |
| 4 | Сравнить `docs/planning/session-log.md` до и после | Файл **не перезаписан** (T5 — пользовательский документ) |
| 5 | Проверить `docs/prd.md` | На месте, не удалён и не изменён (в белый список удаления не входит) |
**Test Data:** `test/fixtures/v1-project/`
**Expected Outcome:** v1 доведён до v3; пользовательские документы сохранены.
**Priority:** Critical

#### TC-004: Сходимость из настоящего v2-проекта (корневой дефект 1)

**Description:** v2-проект с issues в `planning/issues/` — тот самый случай, на котором сегодняшний `migrate-v2-to-v3.sh` даёт гарантированный no-op с бодрым «Migration Complete!».
**Preconditions:** `pf_setup_case v2-project`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | Прочитать stdout | Опознан v2; перенесённые issue перечислены поимённо (а не «(none found)») |
| 3 | `assert_target_state` | T1–T11 выполнены |
| 4 | `ls docs/issues/open/` | `20250101-feat-alpha`, `20250102-bug-beta` |
| 5 | `ls docs/issues/closed/` | `20241201-feat-gamma` |
| 6 | Сравнить `docs/issues/open/20250101-feat-alpha/analysis.md` с фикстурой | Побайтово идентично — содержимое issue не редактируется |
| 7 | Проверить `docs/planning/{implementation-plan,session-log,decisions}.md` | Перенесены из `planning/`, содержимое сохранено |
| 8 | `test -d planning/issues` | Отсутствует (T9) |
**Test Data:** `test/fixtures/v2-project/`
**Expected Outcome:** Данные v2 действительно перенесены; «нечего мигрировать» больше невозможно перепутать с «посмотрел не туда».
**Priority:** Critical

#### TC-005: Доливка «неполного v3» (мотивация Р11)

**Description:** Проект, установленный **сегодняшним** `setup-planning-v3.sh`, детектится как `'v3'`, но не имеет `.pf-version`, `PLANNING.md`, секции в `CLAUDE.md` и несёт 7 скилов из 15. Converge обязан его **долить**, а не сделать no-op.
**Preconditions:** `pf_setup_case v3-incomplete`; `$TMP_HOME/.claude/skills/` предзаполнен ровно 7 скилами (`pf`, `pf-brd`, `pf-spec`, `pf-check`, `pf-test-plan`, `pf-impl-plan`, `pf-execute`) — ровно список `setup-planning-v3.sh:68`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | До прогона вызвать `detectState("$TMP_WORK")` | `'v3'` — то есть под старым правилом «v3 → no-op» проект не долился бы никогда |
| 2 | `pf_run_converge` | exit 0 |
| 3 | `assert_target_state` | T1–T11 выполнены |
| 4 | Пересчитать `$TMP_HOME/.claude/skills/*/SKILL.md` | 15, включая ранее отсутствовавший `pf-qa-setup` |
| 5 | Проверить `.pf-version`, `PLANNING.md`, маркеры в `CLAUDE.md` | Все появились |
| 6 | Проверить наличие `planning-backup-*` | Каталога нет — деструктивных фаз не было, это чистая доливка |
**Test Data:** `test/fixtures/v3-incomplete/`
**Expected Outcome:** Сходимость = доливка до целевого состояния, а не «no-op, если уже v3».
**Priority:** Critical

#### TC-006: Сходимость из смешанной / полумигрированной раскладки

**Description:** `planning/issues/` и `docs/issues/` существуют одновременно (падение предыдущего прогона в середине фазы 3). Повторный прогон обязан довести перенос до конца.
**Preconditions:** `pf_setup_case mixed-layout`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | Прочитать stdout | Опознано смешанное состояние (`planning/issues/` + `docs/issues/`) |
| 3 | `assert_target_state` | T1–T11 выполнены |
| 4 | `ls docs/issues/open/20250101-feat-alpha/` | `prompt.md`, `analysis.md`, `implementation_plan.md` — **и ни одного** `*.v2.md` (уже перенесённые файлы совпали побайтово) |
| 5 | `test -d planning/issues` | Отсутствует |
**Test Data:** `test/fixtures/mixed-layout/`
**Expected Outcome:** Полумиграция дочищается, дублей не возникает.
**Priority:** Critical

#### TC-007: Идемпотентность — второй прогон побайтово ничего не меняет (D-E)

**Description:** Два прогона converge подряд дают побитово тот же результат и exit 0. Это же — тест на правило D-E: артефакты фреймворка не несут временных штампов.
**Preconditions:** `pf_setup_case v2-project`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | `snapshot_tree "$TMP_WORK"`: sha256 всех файлов (исключив `.git/` и `planning-backup-*`), отсортировать | Слепок A |
| 3 | `pf_run_converge` (второй раз) | exit 0 |
| 4 | Снять слепок повторно тем же способом | Слепок B |
| 5 | `diff A B` | Пусто — ни одного созданного, изменённого или удалённого файла. **Без D-E этот шаг падал бы**: штамп `Last Updated: <сегодня>` в `PLANNING.md` не менял бы результат в пределах одних суток, но менял бы его назавтра — то есть тест был бы «зелёным по вторникам» |
| 6 | `grep -nE '[0-9]{4}-[0-9]{2}-[0-9]{2}' PLANNING.md .pf-version` и в секции между `pf:begin`/`pf:end` файла `CLAUDE.md` | Ноль совпадений — в артефактах T2/T3/T4 нет дат (D-E) |
| 7 | Посчитать каталоги `planning-backup-*` | Ровно 1 — второй прогон нового бэкапа не создаёт (переносить и удалять уже нечего) |
| 8 | Проверить `CLAUDE.md` | Ровно **одна** пара `<!-- pf:begin -->`/`<!-- pf:end -->` — секция заменена, а не продублирована (Р8) |
| 9 | Сравнить слепок `$TMP_HOME/.claude/` до и после второго прогона | Идентичен |
**Test Data:** `test/fixtures/v2-project/`
**Expected Outcome:** Идемпотентность подтверждена побайтово, а не «на глаз».
**Priority:** Critical

#### TC-008: Восстановление после прерванного прогона — без `.v2.md`-дублей (D-F)

**Description:** Прогон, аварийно оборванный в середине фазы 3, при повторном запуске завершает перенос и **не создаёт** `<name>.v2.md` для файлов, которые предыдущий прогон уже перенёс побайтово идентично. Точка обрыва **детерминирована** тестовым хуком `--fail-after=<N>` (D-F), а не гонкой с `SIGKILL`.
**Preconditions:** `pf_setup_case v2-project`; `PF_CONVERGE_TEST_HOOKS=1`. Отдельно, в **другом** `$TMP_WORK2`, готовится вторая копия той же фикстуры — для эталона.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge --fail-after=2` | Ненулевой код (70); в `docs/issues/` лежат ровно 2 перенесённых файла; `planning/issues/` цел; фаза 5 не выполнялась (D-B действует и здесь) |
| 2 | Убедиться, что проект в смешанном состоянии | `planning/issues/` **и** `docs/issues/` существуют одновременно |
| 3 | `pf_run_converge` (без хука) | exit 0 |
| 4 | `find docs/issues -name '*.v2.md'` | Пусто — сработало правило «целевой файл побайтово совпал → просто удалить источник» |
| 5 | `assert_target_state` | T1–T11 выполнены |
| 6 | В `$TMP_WORK2` (свежая копия) выполнить один чистый `pf_run_converge` и снять слепок | Эталонный слепок — **вычисляется внутри этого же TC**, а не заимствуется из TC-004 |
| 7 | Сравнить слепки `docs/**` из `$TMP_WORK` и `$TMP_WORK2` | Идентичны — маршрут «оборвали и перезапустили» даёт тот же результат, что и одиночный чистый прогон |
| 8 | Повторить шаги 1–5 с `--fail-after=1` и `--fail-after=5` | Тот же итог — точка обрыва не влияет на сходимость |
**Test Data:** `test/fixtures/v2-project/` + тестовый хук `--fail-after`
**Expected Outcome:** Прерывание не оставляет неустранимого мусора и не портит повторный прогон; тест детерминирован.
**Priority:** Critical

#### TC-009: Все 15 скилов ставятся динамическим перебором (дефект 3) — на КОПИИ репозитория (S-5)

**Description:** Converge ставит скилы перебором `skills/*/SKILL.md`, а не по хардкоженному списку из 7 (`setup-planning-v3.sh:68`). Проверка «перебор действительно динамический» требует **добавить** скил — и потому выполняется на копии репозитория, а не в рабочем дереве.
**Preconditions:** `pf_setup_case no-pf-bare`; `$TMP_HOME/.claude/skills/` **пуст** — иначе «ровно 15» пройдёт ложно, так как скрипт только добавляет и никогда не удаляет.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | Посчитать `$TMP_HOME/.claude/skills/*/` | 15 |
| 3 | Сверить множество установленных имён с `ls -d skills/*/` репозитория | Множества совпадают; присутствуют все 8 ранее пропускавшихся: `pf-close`, `pf-help`, `pf-manual-test`, `pf-qa`, `pf-qa-setup`, `pf-size-tiers`, `pf-test`, `pf-update` |
| 4 | `TMP_REPO=$(pf_repo_copy)`; создать в **копии** `$TMP_REPO/skills/pf-zz-probe/SKILL.md`; запустить `$TMP_REPO/scripts/converge-to-v3.sh` **через ту же обёртку** (`PF_FRAMEWORK_ROOT=$TMP_REPO pf_run_converge`) в новом пустом `$TMP_HOME` и на свежей копии фикстуры | Установлено **16** скилов, включая `pf-zz-probe` — перебор динамический, и converge берёт `skills/` **относительно собственного пути** (S-5), а не из зашитой константы |
| 5 | Прочитать финальную справку converge в stdout прогона из шага 4 | Список скилов в справке производный от фактически установленного набора (содержит `pf-zz-probe`), а не хардкод из 7 строк (`setup-planning-v3.sh:119-128`) |
| 6 | `cd "$REPO_ROOT" && git status --porcelain` | Пусто — рабочее дерево репозитория **не тронуто**: пробный скил жил только в `$TMP_REPO`, который снят `trap … EXIT` (S-5) |
**Test Data:** `skills/` копии репозитория + временный пробный скил
**Expected Outcome:** Дефект 3 закрыт так, что список повторно разъехаться не может; тест не оставляет репозиторий грязным.
**Priority:** Critical

#### TC-010: Артефакты фреймворка перезаписываются всегда (T2, T3, T6)

**Description:** `.pf-version`, `PLANNING.md` и `docs/planning/templates/` — артефакты фреймворка: протухшие экземпляры обязаны быть заменены. В частности, v2-штампованный `PLANNING.md` активно отравляет детекцию (дефекты 2 и 6) и обязан исчезнуть.
**Preconditions:** `pf_setup_case v2-project` (несёт `PLANNING.md` со штампом `2.0`); дополнительно записать в копию `.pf-version` = `2.0.0` и подменить один файл в `docs/planning/templates/` мусором.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | `cat .pf-version` | `3.0.0` — старое значение перезаписано |
| 3 | `grep 'Framework Version' PLANNING.md` | `**Framework Version:** 3.0`; строки со штампом `2.0` в файле нет |
| 4 | `grep 'planning/issues' PLANNING.md` | Ноль совпадений — v2-шные пути ушли вместе с файлом |
| 5 | `diff -r docs/planning/templates/ "$REPO_ROOT"/docs/planning/templates/` | Пусто — подменённый мусорный файл вычищен (T6) |
| 6 | `grep -rn 'Version:\*\* 2\.0' docs/planning/templates/` | Ноль совпадений (дефект 4: штампы `3.0` проставлены; у `global/decisions.md` строка версии добавлена) |
| 7 | Проверить `docs/planning/templates/issue/notes.md` | **Отсутствует — и обязан отсутствовать.** Trivial-шаблон `notes.md` живёт **единственным** экземпляром в `skills/pf-size-tiers/SKILL.md:58-76`, и `pf-brd/SKILL.md:21` дословно велит брать его **оттуда** (`from ~/.claude/skills/pf-size-tiers/SKILL.md`). Ни один скил не читает `docs/planning/templates/` вообще (`grep -rn 'templates/issue\|planning/templates' skills/` → **0**) — этот каталог только целиком зеркалируется в проект как справочный материал (T6). Заведя здесь вторую копию шаблона, мы создали бы ровно тот разъезд двух источников правды, который чинит мера 2 дефекта 5 (П1-10) |
| 8 | `diff -r docs/planning/templates/issue/ "$REPO_ROOT"/docs/planning/templates/issue/` | Пусто — каталог `issue/` этим issue **не изменяется вовсе** (11 файлов, как сегодня) |
**Test Data:** `test/fixtures/v2-project/` + искусственно протухшие артефакты
**Expected Outcome:** Протухшие артефакты фреймворка не переживают converge.
**Priority:** Critical

#### TC-011: T6 — ЗЕРКАЛИРОВАНИЕ, а не наложение (П1-1)

**Description:** Сегодняшний установщик копирует шаблоны через `cp -r "$TEMPLATES_SRC/." …` (`setup-planning-v3.sh:89`) — он **добавляет и перезаписывает, но никогда не удаляет**. Проект, ранее поставленный v3, несёт `docs/planning/templates/config/.qa-workflow.md` — файл, который Р2 удаляет из фреймворка **без замены**. Реализация на `cp -r` оставит его в проекте и при этом пройдёт все прочие TC. T6 обязан быть **зеркалированием**: чего нет во фреймворке — не должно остаться и в проекте.
**Preconditions:** `pf_setup_case v3-incomplete` — фикстура по определению несёт **сегодняшний** `docs/planning/templates/`, то есть в ней уже лежат `config/.qa-workflow.md` и v2-штампованный `config/PLANNING.md`. Дополнительно положить в копию `docs/planning/templates/config/stale.md` и `docs/planning/templates/global/stale.md` (произвольный мусор, которого во фреймворке нет).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | До прогона убедиться, что `docs/planning/templates/config/.qa-workflow.md` **существует** в копии | Существует — иначе TC ничего не проверяет |
| 2 | `pf_run_converge` | exit 0 |
| 3 | `test -e docs/planning/templates/config/.qa-workflow.md` | **Отсутствует** — файл удалён из проекта вслед за удалением из фреймворка (Р4) |
| 4 | `test -e docs/planning/templates/config/stale.md`, `test -e docs/planning/templates/global/stale.md` | Оба **отсутствуют** |
| 5 | `diff -r "$REPO_ROOT"/docs/planning/templates/ docs/planning/templates/` | Пусто **в обе стороны** — ни лишних, ни недостающих файлов |
| 6 | Проверить `docs/planning/templates/config/` | Содержит `PLANNING.md` (переписанный generic-v3) и **новый** `CLAUDE.md`; `.qa-workflow.md` не содержит |
| 7 | Прогнать converge второй раз, повторить шаг 5 | Пусто — зеркалирование идемпотентно |
**Test Data:** `test/fixtures/v3-incomplete/` + подсаженные `stale.md`
**Expected Outcome:** Реализация «`cp -r` и забыли» не проходит: T6 доказан как зеркало, а не как наложение.
**Priority:** Critical

#### TC-012: Пользовательские документы не перезаписываются (T5)

**Description:** `docs/planning/{session-log,decisions,implementation-plan}.md` создаются из шаблона **только если отсутствуют**; существующие не трогаются. Обратная сторона TC-010/TC-011.
**Preconditions:** `pf_setup_case v2-project`; в копию, в `planning/session-log.md` и `planning/decisions.md`, дописана уникальная строка-маркер.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | `grep '<маркер>' docs/planning/session-log.md` | Маркер на месте — файл перенесён, а не подменён шаблоном |
| 3 | `grep '<маркер>' docs/planning/decisions.md` | Маркер на месте |
| 4 | Прогнать converge второй раз, повторить проверки | Маркеры по-прежнему на месте |
| 5 | Удалить `docs/planning/decisions.md`, прогнать converge | Файл создан из `docs/planning/templates/global/decisions.md`, штамп `**Version:** 3.0` |
| 6 | Проверить `.qa-workflow.md` v2-проекта (штамп `**Version:** 2.0`) | Не тронут — тоже пользовательский документ (Р4, KI-12) |
**Test Data:** `test/fixtures/v2-project/`
**Expected Outcome:** Асимметрия «артефакты фреймворка перезаписываем, пользовательские документы — нет» соблюдена в обе стороны.
**Priority:** High

#### TC-013: Плейсхолдеры подставляются, литералов не остаётся (П1-7, D-E)

**Description:** Дефект 4 требует **переписать заново** `templates/config/PLANNING.md` как generic-v3-документ с плейсхолдером `[Project Name]`, а Р8 требует **новый** `templates/config/CLAUDE.md`. Ничто в 1-й редакции плана не проверяло, что converge их **подставляет**: реализация, копирующая шаблон дословно, прошла бы весь план и вручила бы пользователю `PLANNING.md` с литералом `[Project Name]`. Сегодняшний `setup-planning-v2.sh:176-180` подстановку **делал** (`sed -i "s/\[Project Name\]/$PROJECT_NAME/g"`) — то есть без этого TC мы получили бы регрессию.
**Preconditions:** `pf_setup_case no-pf-claude`, скопированная в каталог с известным именем (`$TMP_WORK` переименован в `…/My-Cool-Project`).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | `grep -rn '\[Project Name\]' PLANNING.md CLAUDE.md` | Ноль совпадений — плейсхолдер подставлен |
| 3 | `grep -n 'My-Cool-Project' PLANNING.md` | Совпадение есть — подставлено имя целевого каталога |
| 4 | `grep -rn 'YYYY-MM-DD' PLANNING.md CLAUDE.md` | Ноль совпадений |
| 5 | `grep -rn '\[Project Name\]\|YYYY-MM-DD' "$REPO_ROOT"/docs/planning/templates/config/CLAUDE.md` | Плейсхолдер `[Project Name]` в шаблоне **есть**, `YYYY-MM-DD` — **нет** (D-E: даты в артефактах T3/T4 запрещены) |
| 6 | Проверить содержимое секции между `<!-- pf:begin -->` и `<!-- pf:end -->` в `CLAUDE.md` | Тело секции — из `templates/config/CLAUDE.md`, плейсхолдеры в нём тоже подставлены; есть указатель на `PLANNING.md` |
| 7 | Прогнать converge на копии `v2-project` (где `CLAUDE.md` отсутствует) | `CLAUDE.md` создан из того же шаблона; плейсхолдеров в нём нет |
**Test Data:** `test/fixtures/no-pf-claude/`, `test/fixtures/v2-project/`
**Expected Outcome:** Пользователь не получает документ с незаполненными скобками; регрессии относительно v2-установщика нет.
**Priority:** High

#### TC-014: `CLAUDE.md` — размеченная секция вставляется идемпотентно (Р8)

**Description:** Если `CLAUDE.md` есть — вставляется/заменяется секция между `<!-- pf:begin -->` и `<!-- pf:end -->`; повторный прогон **заменяет** содержимое, а не дублирует секцию. Механика новая (прецедента v1 не существует, П1-6).
**Preconditions:** Две копии: (а) `no-pf-claude` (`CLAUDE.md` есть, с пользовательским текстом, без pf-секции); (б) `v2-project` (`CLAUDE.md` **отсутствует** — v2-установщик его никогда не создавал).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Прогнать converge на (а) | В `CLAUDE.md` появилась ровно одна пара маркеров; пользовательский текст сохранён целиком |
| 2 | Изменить содержимое **между** маркерами руками, прогнать converge на (а) второй раз | Содержимое между маркерами восстановлено из шаблона; пар маркеров по-прежнему ровно одна; текст вне маркеров не тронут |
| 3 | Дописать пользовательский текст **после** `<!-- pf:end -->`, прогнать третий раз | Дописанный текст сохранён |
| 4 | Прогнать converge на (б) | `CLAUDE.md` создан из шаблона; содержит пару маркеров; в теле есть указатель на `PLANNING.md` |
| 5 | `grep -c 'pf:begin' CLAUDE.md` в обоих проектах | `1` |
| 6 | Повредить файл: оставить `<!-- pf:begin -->` **без** `<!-- pf:end -->`, прогнать converge | Converge не портит файл молча: печатает WARNING про непарные маркеры и **не** вставляет вторую секцию; ненулевой код не обязателен, но событие обязано попасть в отчёт |
**Test Data:** `test/fixtures/no-pf-claude/`, `test/fixtures/v2-project/`
**Expected Outcome:** Двойной прогон секцию не дублирует; непарные маркеры не приводят к тихой порче.
**Priority:** Critical

#### TC-015: Старая неразмеченная v1-секция в `CLAUDE.md` — WARNING, а не удаление

**Description:** Найденный **вне** маркеров баннер `# Planning Framework Integration` не удаляется (за ним произвольный пользовательский текст до конца файла), но предъявляется пользователю WARNING'ом с номером строки. Размеченная секция вставляется всё равно.
**Preconditions:** `pf_setup_case v1-project`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | Прочитать stdout | Есть WARNING с литералом `Planning Framework Integration` и **номером строки** баннера |
| 3 | `grep -n 'Planning Framework Integration' CLAUDE.md` | Баннер **на месте** — не удалён |
| 4 | Проверить пользовательский текст, дописанный после баннера | Сохранён побайтово |
| 5 | `grep -c 'pf:begin' CLAUDE.md` | `1` — размеченная секция вставлена несмотря на присутствие старой |
| 6 | Прогнать converge второй раз | WARNING печатается снова; файл не меняется |
**Test Data:** `test/fixtures/v1-project/`
**Expected Outcome:** Безопасно и шумно: пользовательский контент цел, проблема явно предъявлена.
**Priority:** High

#### TC-016: Бэкап — имя, видимость для git, условия создания (KI-1)

**Description:** Бэкап называется `planning-backup-<YYYYMMDD-HHMMSS>/`, не удаляется после успеха, его путь печатается в отчёте, и создаётся он **только** если есть что переносить или удалять. Имя `planning.bak/` непригодно, потому что маска `*.bak` — **общеупотребительная строка в `.gitignore`** (она есть и в `.gitignore:16` самого фреймворка), и бэкап оказался бы невидим для git у любого потребителя с такой маской.
**Preconditions:** Копии `v2-project`, `v3-incomplete`, `no-pf-bare`; в копию `v2-project` **дописывается `.gitignore` со строкой `*.bak`** (иначе шаг 2 проходит тривиально на фикстуре, где `.gitignore` нет вовсе, и ничего не доказывает); `git init` + коммит.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Прогнать converge на копии `v2-project` | Создан каталог, имя которого матчится на `planning-backup-[0-9]{8}-[0-9]{6}`; каталогов `*.bak` нет |
| 2 | `git check-ignore -q planning.bak` (гипотетическое имя) **и** `git check-ignore -q planning-backup-<...>` (фактическое) | Первое → **код 0** (было бы проигнорировано, т.е. невидимо для git); второе → **ненулевой код** (не игнорируется). Ровно это и есть обоснование выбора имени |
| 3 | Сравнить содержимое бэкапа с исходной фикстурой | Бэкап содержит `planning/` целиком, включая то, что будет удалено (`planning/scripts/`, `planning/templates/`, `planning/FRAMEWORK.md`) |
| 4 | Прочитать финальный отчёт | Напечатан путь бэкапа и команда его удаления |
| 5 | Прогнать converge на копии `v3-incomplete` (чистая доливка) | Каталогов `planning-backup-*` **не создано** |
| 6 | Прогнать converge на копии `no-pf-bare` | Каталогов `planning-backup-*` **не создано** |
**Test Data:** `test/fixtures/v2-project/` (+ `.gitignore` с `*.bak`), `test/fixtures/v3-incomplete/`, `test/fixtures/no-pf-bare/`
**Expected Outcome:** Единственный артефакт отката существует, виден git и создаётся не «на всякий случай».
**Priority:** High

#### TC-017: `git mv` с пофайловым fallback (KI-2)

**Description:** На каждый файл — проба `git ls-files --error-unmatch`; отслеживается → `git mv` (история сохраняется); не отслеживается → `cp -a` + `rm`. Репозиторного ветвления «git есть / git нет» недостаточно.
**Preconditions:** `pf_setup_case v2-project`, `git init`; закоммичены **не все** файлы: `planning/issues/open/20250101-feat-alpha/` отслеживается целиком; `planning/issues/open/20250102-bug-beta/` — **полностью неотслеживаемый каталог**; внутри закоммиченного issue лежит **неотслеживаемый одиночный файл** `notes-draft.md`. **Эта фикстура исполнима только благодаря D-A**: под гейтом, чувствительным к untracked, converge отказался бы работать в таком дереве.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0; в stderr нет ни `fatal: source directory is empty`, ни `fatal: not under version control` |
| 2 | `git log --follow --oneline docs/issues/open/20250101-feat-alpha/analysis.md` | История прослеживается до исходного коммита — для отслеживаемых файлов использован `git mv` |
| 3 | Проверить `docs/issues/open/20250102-bug-beta/` | Перенесён целиком (fallback `cp -a` + `rm` на полностью неотслеживаемом каталоге) |
| 4 | Проверить `docs/issues/open/20250101-feat-alpha/notes-draft.md` | Перенесён (fallback на одиночном неотслеживаемом файле) |
| 5 | `git status --porcelain` | Перенос отражён; исходников в `planning/` нет |
**Test Data:** `test/fixtures/v2-project/` с частичным коммитом
**Expected Outcome:** Оба эмпирически подтверждённых отказа `git mv` обойдены; история отслеживаемых файлов не потеряна.
**Priority:** Critical

#### TC-018: Удаление v1/v2-артефактов — по БЕЛОМУ СПИСКУ, не `rm -rf planning/`

**Description:** Удаляются только `planning/{issues,scripts,templates,FRAMEWORK.md,implementation-plan.md,session-log.md,decisions.md}`. Затем `rmdir planning` — успешен только на пустом каталоге. Пользовательский файл в `planning/` обязан **выжить**.
**Preconditions:** `pf_setup_case planning-with-user-files`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | `cat planning/notes-of-mine.md` | Файл **на месте**, содержимое не изменено |
| 3 | `ls planning/` | Только `notes-of-mine.md` — всё из белого списка удалено |
| 4 | Прочитать stdout | WARNING со списком того, что осталось в `planning/` (`rmdir` не удался) |
| 5 | Прогнать converge второй раз | exit 0; остаточный `planning/` **не** провоцирует повторную «миграцию» (детект ключуется на `planning/issues/`, которого больше нет); `notes-of-mine.md` цел |
| 6 | Тот же прогон на копии `v2-project` (пользовательских файлов нет) | `planning/` удалён целиком (`rmdir` успешен), WARNING не печатается |
**Test Data:** `test/fixtures/planning-with-user-files/`, `test/fixtures/v2-project/`
**Expected Outcome:** Никакого `rm -rf` поверх пользовательских файлов; идемпотентность не ломается остаточным `planning/`.
**Priority:** Critical

#### TC-019: Артефакты v2-фреймворка не переносятся, а удаляются

**Description:** Область действия правила слияния — **только данные** (`planning/issues/**` + три глобальных документа). `planning/scripts/*.sh`, `planning/templates/**`, `planning/FRAMEWORK.md` — артефакты v2-фреймворка: они не переносятся и не сохраняются рядом, копия остаётся только в бэкапе.
**Preconditions:** `pf_setup_case v2-project` (содержит `planning/scripts/issue-status.sh`).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | `find docs/ -name 'issue-status.sh'` | Пусто — v2-скрипт **не** перенесён в `docs/` |
| 3 | `find docs/planning -maxdepth 1 -name 'FRAMEWORK.md'` | **Пусто.** Converge не устанавливает `docs/planning/FRAMEWORK.md` вовсе — этого файла нет ни в T1–T11, ни в фазе 6 (сегодняшний `setup-planning-v3.sh:99-110` кладёт только `session-log.md`, `decisions.md`, `implementation-plan.md`, а `templates/`-дерево `FRAMEWORK.md` не содержит). Значит и v2-копия из `planning/` не имеет права здесь появиться |
| 4 | Проверить `planning-backup-*/planning/scripts/issue-status.sh` | Копия в бэкапе присутствует |
| 5 | `diff -r docs/planning/templates/ "$REPO_ROOT"/docs/planning/templates/` | Пусто — v2-шный `planning/templates/` не примешался |
**Test Data:** `test/fixtures/v2-project/`
**Expected Outcome:** Артефакты v2-фреймворка не переживают converge и не загрязняют v3-раскладку.
**Priority:** High

#### TC-020: Заглушки в открытых issue не создаются вовсе (дефект 5, мера 1)

**Description:** Converge **не пишет** ни одной TODO-заглушки. Отсутствие обязательного v3-документа честно означает незавершённую стадию. Шаг 2 старого скрипта (`migrate-v2-to-v3.sh:128-141`) не переносится.
**Preconditions:** `pf_setup_case v2-project` (ни у одного открытого issue нет `test_plan.md`, `brd.md`, `specs.md`).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | `find docs/issues/open -name 'test_plan.md'` | Пусто |
| 3 | `find docs/issues/open \( -name 'brd.md' -o -name 'specs.md' -o -name 'notes.md' \)` | Пусто |
| 4 | `grep -rn 'TODO: Run /pf-' docs/issues/open/` | Ноль совпадений |
| 5 | Прочитать stdout | По каждому issue перечислено, каких v3-документов не хватает и какой скил их создаёт |
**Test Data:** `test/fixtures/v2-project/`
**Expected Outcome:** Корень дефекта 5 устранён: файла нет — значит стадия не пройдена.
**Priority:** Critical

#### TC-021: Заглушка-указатель `brd.md` в ЗАКРЫТЫХ issue (Р1) — и никакого `legacy:`-маркера

**Description:** В закрытом issue создаётся `brd.md`-указатель с **настоящими** ссылками на уцелевшие legacy-документы. Он **намеренно не содержит** маркер `TODO: Run /pf-`. Р1 столь же явно фиксирует, чего мы **не делаем**: маркера `legacy: true` и заглушки `specs.md` — это негативные требования, и они обязаны быть проверены.
**Preconditions:** `pf_setup_case v2-project` (`closed/20241201-feat-gamma/` содержит `prompt.md`, `analysis.md`, `definition-of-done.md`).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | Проверить `docs/issues/closed/20241201-feat-gamma/brd.md` | Файл создан |
| 3 | Проверить ссылки в нём | Ведут на `prompt.md`, `analysis.md`, `definition-of-done.md`, и все три файла **реально существуют** в этом каталоге |
| 4 | `grep 'TODO: Run /pf-' docs/issues/closed/20241201-feat-gamma/brd.md` | Ноль совпадений — указатель не должен ловиться правилом распознавания заглушек (мера 2) |
| 5 | Сравнить `prompt.md`, `analysis.md`, `definition-of-done.md` закрытого issue с фикстурой | Побайтово не изменены — «архив не переписывается» относится к содержимому. В частности, **frontmatter `doc_language` в закрытые issue не дописывается** (D-D) |
| 6 | `find docs/issues/closed -name 'specs.md'` | Пусто — заглушка `specs.md` намеренно не делается |
| 7 | `grep -rn '^legacy:\|legacy: true' docs/issues/` | **Ноль совпадений** — негативное требование Р1 («явно не делаем: маркер `legacy: true`») |
| 8 | Прогнать converge второй раз | `brd.md` не дублируется и не изменяется |
| 9 | Проверить открытые issue | `brd.md`-указателей в них **нет** — правило действует только для `closed/` |
**Test Data:** `test/fixtures/v2-project/`
**Expected Outcome:** Архив нормализован структурно, но не переписан по содержанию; отвергнутые варианты не просочились в реализацию.
**Priority:** High

#### TC-022: Переименование `implementation-plan.md` → `implementation_plan.md` во ВСЕХ issue (Р12, T10)

**Description:** Дефисное имя переименовывается и в открытых, и в закрытых issue: оставленный файл-сирота не читает ни один скил (`pf/SKILL.md:64`, `pf-impl-plan:10`, `pf-execute:22`, `.qa-workflow.md:67`).
**Preconditions:** `pf_setup_case v2-project`, `git init` + коммит.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | `find docs/issues -name 'implementation-plan.md'` | Пусто (T10) |
| 3 | Посчитать `find docs/issues -name 'implementation_plan.md'` | 3 — по одному на issue, включая закрытый |
| 4 | Сравнить содержимое переименованного плана с исходным | Побайтово идентично — переименование, а не перезапись |
| 5 | `git log --follow` по переименованному файлу | История прослеживается (переименование через `git mv`, TC-017) |
| 6 | Проверить `docs/planning/implementation-plan.md` (глобальный) | **Дефисное имя сохранено** — переименование касается только issue; глобальный документ в v3 так и называется (`setup-planning-v3.sh:99`) |
**Test Data:** `test/fixtures/v2-project/`
**Expected Outcome:** Все планы issue видимы скилам; глобальный документ не задет.
**Priority:** Critical

#### TC-023: `doc_language` детектится по содержимому (Р5, D-D)

**Description:** Считаются кириллические и латинские буквы в `prompt.md` + `analysis.md` issue; кириллица > латиницы → `Russian`, иначе `English`. В класс кириллицы включены `ё` и `Ё` (они лежат вне блока `а-я`/`А-Я`). Флаг `--doc-language` переопределяет. `size_tier` **не угадывается**. Frontmatter пишется **только в открытые** issue (D-D).
**Preconditions:** Копии `v2-project` (русский issue) и `v2-latin`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Прогнать converge на `v2-project` | В `docs/issues/open/20250101-feat-alpha/prompt.md` появился frontmatter `doc_language: Russian`; решение по этому issue напечатано в stdout |
| 2 | Прогнать converge на `v2-latin`, issue (1) | `doc_language: English` |
| 3 | `v2-latin`, issue (2) — кириллица только через `ё`/`Ё`, и её больше | `doc_language: Russian` — `ё`/`Ё` учтены |
| 4 | `pf_run_converge --doc-language English` на `v2-project` | `doc_language: English` — флаг переопределил детект во всех issue |
| 5 | `grep -rn 'size_tier' docs/issues/open/*/prompt.md` | Ноль совпадений — `size_tier` намеренно отсутствует, чтобы legacy-tier guard `/pf` (`skills/pf/SKILL.md:49-51`) спросил пользователя |
| 6 | `grep -rn 'doc_language' docs/issues/closed/*/prompt.md` | **Ноль совпадений** — в закрытые issue frontmatter не пишется (D-D); сам `prompt.md` побайтово не изменён |
| 7 | Прогнать converge второй раз | Frontmatter не дублируется, значение не меняется |
**Test Data:** `test/fixtures/v2-project/`, `test/fixtures/v2-latin/`
**Expected Outcome:** Русскоязычный проект не уезжает молча в английский конвейер; архив не редактируется.
**Priority:** High

#### TC-024: `.qa-workflow.md` — подсказка/WARNING, но НЕ создание (Р4)

**Description:** Converge никогда не создаёт `.qa-workflow.md`. Отсутствует → подсказка `/pf-qa-setup`; штамп `**Version:** 2.0` → WARNING; любой другой вид → не трогать. Несущая починка — установка всех 15 скилов, благодаря которой `/pf-qa-setup` вообще существует в проекте.
**Preconditions:** Три копии: (а) `no-pf-bare` (файла нет); (б) `v2-project` (файл со штампом `2.0`); (в) `v2-project` с `.qa-workflow.md`, отредактированным руками (штампа версии нет, есть уникальный маркер).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Прогнать converge на (а) | `.qa-workflow.md` **не создан**; в stdout — подсказка «Run `/pf-qa-setup` …» |
| 2 | Прогнать converge на (б) | Файл **не перезаписан**; в stdout — WARNING про штамп `2.0` с рекомендацией `/pf-qa-setup` |
| 3 | Прогнать converge на (в) | Файл побайтово не изменён; ни WARNING, ни подсказки о создании |
| 4 | `find "$REPO_ROOT"/docs/planning/templates -name '.qa-workflow.md'` | Пусто — шаблон удалён без замены (пересекается с TC-011, где проверяется, что он исчезает и из **уже установленного** проекта) |
| 5 | Проверить `$TMP_HOME/.claude/skills/pf-qa-setup/SKILL.md` | Установлен — именно это и есть несущая часть починки дефекта 2 |
**Test Data:** `test/fixtures/no-pf-bare/`, `test/fixtures/v2-project/` (+ вариант с ручной правкой)
**Expected Outcome:** QA-воркфлоу генерируется скилом, а не шаблоном; пользовательский файл неприкосновенен.
**Priority:** High

#### TC-025: Итоговый отчёт converge (фаза 7)

**Description:** Отчёт печатает исходное состояние, что сделано, что осталось сделать руками, путь бэкапа, подсказки (`/pf-qa-setup`), список сохранённых `.v2.md` и строки WARNING/ERROR.
**Preconditions:** `pf_setup_case collision-same-id` (даёт и `.v2.md`, и WARNING'и).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | Отчёт напечатан в конце вывода |
| 2 | Проверить блок «detected state» | Есть; значение соответствует фикстуре |
| 3 | Проверить перечисление `.v2.md` | Каждый сохранённый `.v2.md` перечислен поимённо |
| 4 | Проверить путь бэкапа и команду его удаления | Присутствуют |
| 5 | Проверить блок «что осталось сделать руками» | Содержит подсказку `/pf-qa-setup` и перечень issue, которым не хватает v3-документов |
| 6 | `pf_run_converge --dry-run` на свежей копии | Отчёт печатается тем же форматом, но с явной пометкой «dry-run — изменений не внесено» |
**Test Data:** `test/fixtures/collision-same-id/`
**Expected Outcome:** Отличить «нечего было делать» от «посмотрел не туда» можно **по выводу** — то, чего сегодня сделать нельзя.
**Priority:** Medium

### Validation

#### TC-026: `--dry-run` не меняет ничего

**Description:** `--dry-run` печатает план и не вносит ни одного изменения ни в проект, ни в `$HOME`. Сегодня превью совмещено с реальным прогоном (`migrate-v2-to-v3.sh:34-98`).
**Preconditions:** `pf_setup_case v2-project`; `$TMP_HOME` пуст.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Снять слепки `$TMP_WORK` и `$TMP_HOME` | Слепки A |
| 2 | `pf_run_converge --dry-run` | exit 0; напечатан план: что будет перенесено, что удалено, что долито |
| 3 | Снять слепки повторно | Слепки B |
| 4 | `diff A B` | Пусто — ни один файл не создан, не изменён, не удалён |
| 5 | Проверить `$TMP_HOME/.claude/skills/` | Пусто — скилы не поставлены |
| 6 | Проверить отсутствие `planning-backup-*` | Бэкап не создан |
| 7 | `pf_run_converge --dry-run` на копии `no-pf-bare` | exit 0; план описывает установку с нуля; изменений нет |
**Test Data:** `test/fixtures/v2-project/`, `test/fixtures/no-pf-bare/`
**Expected Outcome:** Превью полностью отделено от реального прогона.
**Priority:** Critical

#### TC-027: Гейт чистого worktree — НЕотслеживаемые файлы гейт НЕ роняют (D-A)

**Description:** Гейт реализуется как `git status --porcelain --untracked-files=no`. Untracked-файлы дерево грязным не делают. Без этого правила **второй** прогон converge падал бы в любом реальном git-репозитории: его собственные выходы (`docs/issues/`, `.pf-version`, `PLANNING.md`, `planning-backup-*`) неотслеживаемы.
**Preconditions:** `pf_setup_case v2-project`, `git init` + коммит **всех** файлов (дерево чистое); затем в копию добавлен неотслеживаемый мусор: `scratch.txt`, каталог `tmp-notes/`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `git status --porcelain` | Непусто (`?? scratch.txt` и т.п.) — «грязно» в наивном смысле |
| 2 | `git status --porcelain --untracked-files=no` | **Пусто** — отслеживаемых изменений нет |
| 3 | `pf_run_converge` (без `--force`) | exit 0 — гейт **не сработал** |
| 4 | `assert_target_state` | T1–T11 выполнены |
| 5 | `pf_run_converge` **второй раз** (теперь в дереве полно неотслеживаемых выходов converge) | exit 0 — идемпотентность не убита гейтом. Это главный смысл D-A |
| 6 | Проверить `scratch.txt` и `tmp-notes/` | На месте, не тронуты |
**Test Data:** `test/fixtures/v2-project/`
**Expected Outcome:** Гейт не блокирует ни первый, ни повторный прогон из-за собственных выходов converge.
**Priority:** Critical

#### TC-028: Гейт чистого worktree — ОТСЛЕЖИВАЕМАЯ правка гейт роняет; `--force` обходит (D-A)

**Description:** Незакоммиченная правка **отслеживаемого** файла — ровно тот случай, ради которого гейт существует. Converge обязан остановиться **до** деструктивных фаз, вернуть ненулевой код и ничего не изменить.
**Preconditions:** `pf_setup_case v2-project`, `git init` + коммит; затем изменён (не закоммичен) отслеживаемый файл `planning/session-log.md`. Для шага 5 берётся **свежая копия** фикстуры с чистым деревом.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Снять слепки `$TMP_WORK` и `$TMP_HOME` | Слепки A |
| 2 | `pf_run_converge` | **Ненулевой** exit code; сообщение о грязном worktree с подсказкой про `--force` |
| 3 | Снять слепки повторно | Идентичны A. Ни один файл проекта не тронут, **и в `$TMP_HOME` скилы не поставлены** — стоп произошёл до всех фаз, включая доливку |
| 4 | `pf_run_converge --force` | exit 0; converge отработал; `assert_target_state` → T1–T11 |
| 5 | На **свежей копии** с чистым деревом: `pf_run_converge` **без** `--force` | exit 0 — гейт не мешает нормальному сценарию (проверка на новой копии обязательна: после шага 4 дерево уже не то) |
| 6 | Прогнать на копии **без** `.git` вовсе | exit 0 — отсутствие git не считается «грязным worktree» (перекликается с TC-056) |
**Test Data:** `test/fixtures/v2-project/`
**Expected Outcome:** Пользователь не теряет незакоммиченную работу по неосторожности, но и не заперт.
**Priority:** Critical

#### TC-029: Отменённый прогон НЕ завершается кодом 0 (ловушка ложно-зелёного, KI-6)

**Description:** Сегодняшний `migrate-v2-to-v3.sh:94` — `read -p` + пустой `CONFIRM` → `exit 0`. Это делает **любой** автоматический тест зелёным при нулевом фактическом результате. Converge обязан на отмене возвращать **ненулевой** код.
**Preconditions:** `pf_setup_case v2-project`. **Все** шаги идут через `pf_run_converge_interactive` — единственную обёртку без `--yes` (S-2). `HOME=$TMP_HOME` действует и здесь (S-1): шаг 4 — это полноценный реальный прогон, ставящий 15 скилов и переписывающий shim, и без обёртки он снёс бы установку разработчика.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge_interactive $'\n'` (пустой ввод на подтверждение деструктивной фазы) | **Ненулевой** exit code — НЕ 0 |
| 2 | Снять слепки `$TMP_WORK` и `$TMP_HOME` | Ничего не изменено; скилы не поставлены |
| 3 | `pf_run_converge_interactive $'n\n'` на свежей копии | Ненулевой exit code; ничего не изменено |
| 4 | `pf_run_converge_interactive $'y\n'` на свежей копии | exit 0; `assert_target_state` → T1–T11 |
| 5 | `pf_run_converge_interactive ""` (payload пуст ⇒ stdin закрыт, `< /dev/null`, `--yes` не передан) | Ненулевой exit code; ничего не изменено — «не смог спросить» не равно «пользователь согласился» |
| 6 | Прочитать stdout отменённых прогонов | Явное «cancelled / aborted», а не «Complete!» |
**Test Data:** `test/fixtures/v2-project/`
**Expected Outcome:** Отмену невозможно спутать с успехом — ни человеку, ни тесту.
**Priority:** Critical

#### TC-030: CLI-контракт — флаги, порядок, неизвестный флаг

**Description:** `--target <dir>`, `--yes`, `--dry-run`, `--force`, `--doc-language <lang>` принимаются в **любом порядке**; неизвестный флаг → ненулевой код + usage; `--target` по умолчанию `$(pwd)`.
**Preconditions:** `pf_setup_case v2-project`. **Каждый** шаг идёт через обёртку: шаги 1–5, 7 — `pf_run_converge` (она пробрасывает переданные флаги как есть), шаг 6 — `pf_run_converge_cwd` (S-1). Прямой вызов `converge-to-v3.sh` в этом TC — дефект (TC-032).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge --dry-run --target "$TMP_WORK"` (обёртка добавит `--yes` первым) | exit 0 — флаги перед `--target` приняты |
| 2 | `pf_run_converge --target "$TMP_WORK" --dry-run --doc-language Russian --force` | exit 0 — все пять флагов вместе, произвольный порядок |
| 3 | `pf_run_converge --bogus-flag` | **Ненулевой** exit code; напечатан usage; проект не изменён |
| 4 | `pf_run_converge --target` без значения | Ненулевой exit code + внятная ошибка (обёртка не подставляет свой `--target`, если он уже передан) |
| 5 | `pf_run_converge --doc-language Klingon` | Ненулевой exit code + перечень допустимых значений |
| 6 | `pf_run_converge_cwd "$TMP_WORK"` (без `--target`) | Целью стал `$(pwd)` = `$TMP_WORK`; `assert_target_state` → T1–T11 |
| 7 | `pf_run_converge --help` | exit 0; перечислены **все пользовательские** флаги. Скрытый тестовый хук `--fail-after` (D-F) здесь **не перечисляется** и в списке отсутствовать обязан |
**Test Data:** `test/fixtures/v2-project/`
**Expected Outcome:** Опечатка во флаге не превращается в тихий прогон с дефолтами.
**Priority:** High

#### TC-031: Радиус поражения — только `$TARGET` и `$HOME/.claude`

**Description:** Converge пишет только в `$TARGET` и в `$HOME/.claude/{skills,bin}`. Это же — доказательство того, что правило S-1 действительно защищает разработчика.
**Preconditions:** `pf_setup_case v2-project`; `$TMP_HOME` пуст; рядом создан каталог-«сосед» `$TMP_NEIGHBOUR` с файлами; converge запускается из третьего каталога (`cd $TMP_ELSEWHERE`).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Снять слепки `$TMP_NEIGHBOUR` и `$TMP_ELSEWHERE` | Слепки A |
| 2 | `pf_run_converge` | exit 0 |
| 3 | Пересчитать слепки | Идентичны A — соседний каталог и cwd не тронуты |
| 4 | Перечислить всё, что появилось в `$TMP_HOME` | Только `.claude/skills/*` и `.claude/bin/pf` — ничего вне `.claude/` |
| 5 | Снять слепок `$REPO_ROOT` до и после прогона | Идентичен — converge не пишет в репозиторий фреймворка (он для него источник, а не цель) |
**Test Data:** `test/fixtures/v2-project/`
**Expected Outcome:** Радиус поражения converge ограничен и проверяем.
**Priority:** High

> **Примечание (П1-2).** Шаг «`grep -nE '(/home/[a-z]+\|~/)' scripts/converge-to-v3.sh` → нет захардкоженных домашних путей» из 1-й редакции **удалён**. Он был неисполним по двум причинам. Во-первых, в ERE `\|` — это **литеральный символ `|`**, а не альтернация: регулярка искала подстроку `/home/xxx|~/`, которая не встречается никогда, поэтому шаг был **всегда зелёным независимо от содержимого файла**. Во-вторых, он неверен по существу: converge законно упоминает `$HOME` и `~/.claude/skills` в тексте справки и echo-строк. Настоящую защиту дают шаги 1–5 выше — они проверяют **поведение**, а не текст.

#### TC-032: Аудит S-1 — ни один тест не вызывает converge напрямую

**Description:** Правило S-1 бессмысленно, если его можно обойти по невнимательности. Обход обнаруживается **автотестом**, а не ревью: сам факт того, что имя скрипта встретилось в `test/` вне `lib.sh`, — дефект.
**Preconditions:** Репозиторий (чтение, без мутаций).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `grep -rln 'converge-to-v3' test/` | Единственный файл — `test/lib.sh` |
| 2 | `grep -c 'converge-to-v3' test/lib.sh` | Ровно 1 — единственное вхождение внутри `_pf_converge_exec` |
| 3 | `grep -n 'HOME=' test/lib.sh` | `HOME="$TMP_HOME"` экспортируется в `_pf_converge_exec` — то есть **на пути каждой** из трёх обёрток |
| 4 | `grep -rn 'pf_run_converge\|pf_run_converge_interactive\|pf_run_converge_cwd' test/*.sh \| wc -l` | Больше нуля — тесты действительно ходят через обёртки |
| 5 | Проверить, что `_pf_converge_exec` не экспортируется как публичное имя и не вызывается из `test/*.sh` | `grep -rn '_pf_converge_exec' test/*.sh` → ноль совпадений |
| 6 | `grep -rn 'mktemp' test/lib.sh` и `grep -n 'trap' test/lib.sh` | `$TMP_HOME`/`$TMP_WORK`/`$TMP_REPO` создаются через `mktemp -d` и снимаются в `trap … EXIT` (S-4) |
**Test Data:** `test/`
**Expected Outcome:** Единственный шлюз к деструктивному скрипту доказан статически; шестая версия «мы забыли обёртку» не пройдёт code review молча.
**Priority:** Critical

### Integration

> Кейсы TC-033…TC-035 живут в `tools/onboarding-tui/test/detect.test.js`, где **уже** заняты метки `TC-001`…`TC-004b` и `P0-1` (они принадлежат другому issue). Новые кейсы обязаны нести префикс **`TCD-`** — `TCD-01`, `TCD-02`, … Ниже в скобках указано соответствие.

#### TC-033 (`TCD-01`…`TCD-06`): `detect.js` — `.pf-version` бьёт штамп `PLANNING.md` (Р7, шаг 2)

**Description:** `.pf-version` — единственный машинный **маркер версии** и читается раньше штампа `PLANNING.md`. Наивысший приоритет в порядке Р7 у него **не** абсолютный: раньше него (шаг 1) проверяется структурный отпечаток незавершённой миграции `planning/issues/` — см. TC-034 и TC-054, шаг 8. Ни в одном из кейсов `TCD-01`…`TCD-06` каталога `planning/issues/` нет, поэтому шаг 1 здесь не срабатывает и проверяется именно шаг 2.
**Preconditions:** `node --test`, синтетические tmp-каталоги; **ни в одном кейсе нет `planning/issues/`**.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `.pf-version` = `3.0.0` **+** `PLANNING.md` со штампом `2.0` | `detectState` → `'v3'` — `.pf-version` победил |
| 2 | `.pf-version` = `2.0.0` **+** `PLANNING.md` со штампом `3.0` | `'v2-or-older'` — `.pf-version` победил |
| 3 | `.pf-version` = `1.0.0` | `'v2-or-older'` |
| 4 | `.pf-version` = `4.0.0` | `'unknown'` |
| 5 | `.pf-version` с мусором (`hello`) | `'unknown'` |
| 6 | `.pf-version` = `3.1.0` | `'v3'` (правило `3.x`) |
**Test Data:** синтетические tmp-каталоги в `detect.test.js`
**Expected Outcome:** Роли «маркер версии» и «документация» разведены — это корень дефектов 2 и 6.
**Priority:** Critical

#### TC-034 (`TCD-07`…`TCD-11`): `detect.js` — настоящий v2, v1 и смешанная раскладка (дефект 6)

**Description:** Сегодня `detect.js:39-45` при `PLANNING.md` без v3-штампа короткозамыкается на `'unknown'`, и ветка `'v2-or-older'` на реальном v2-проекте **недостижима**. Новый порядок обязан это исправить, **не вводя** нового токена `'v1'` (KI-9).
**Preconditions:** `node --test`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Настоящий v2: `PLANNING.md` со штампом `**Framework Version:** 2.0` + `planning/issues/` | `'v2-or-older'` (**шаг 1** — структурный отпечаток v2 срабатывает раньше штампа `PLANNING.md`; тот дал бы тот же ответ шагом 3, но полагаться на него нельзя — см. TC-054, шаг 8) |
| 2 | `planning/issues/` **без** `PLANNING.md` | `'v2-or-older'` (**шаг 1** — структурный отпечаток v2) |
| 3 | v1-проект: `CLAUDE.md` + `docs/planning/session-log.md`, **нет** `PLANNING.md`, **нет** `docs/issues/` | `'v2-or-older'` (шаг 5) — нового токена не появилось |
| 4 | Смешанная раскладка: `planning/issues/` **и** `docs/issues/{open,closed}` + `docs/planning/session-log.md` | `'v2-or-older'` (**шаг 1**) — v2-отпечаток проверяется **до** `.pf-version`, штампа `PLANNING.md` и v3-отпечатка: смешанное/полумигрированное состояние получает более срочную ветку. **Это и есть причина, по которой шаг 1 стоит первым:** converge доливает `.pf-version` = `3.0.0` и `PLANNING.md` со штампом `3.0` даже тогда, когда перенос не удался (D-B), — при любом другом порядке такой проект отрапортовал бы `'v3'`, получил бы v3-меню и молча остался бы с непере­несёнными данными (совпадает с шагом 8 TC-054) |
| 5 | Штамп `4.0` в `PLANNING.md` + `CLAUDE.md` | `'unknown'` — предусловие шага 5 «нет `PLANNING.md`» сохранено, иначе будущая версия классифицировалась бы как v2 и ей предложили бы «миграцию» вниз |
| 6 | `assert.deepStrictEqual(Object.keys(MENUS).sort(), ['none','unknown','v2-or-older','v3'])` и проверка, что **каждый** токен, возвращаемый `detectState` во всех кейсах выше, входит в это множество | Все токены покрыты — `showMenu` (`menu.js:110-113`) не бросит `Error` (KI-9). **`showMenu` в тесте НЕ вызывается**: он открывает `readline` на `process.stdin` и крутится в цикле до валидного ввода (`menu.js:109-…`), то есть под `node --test` **повис бы**. Проверяется множество ключей `MENUS` (модуль его экспортирует). Если понадобится проверить и сам цикл — `showMenu` принимает `opts.rl` (`menu.js:115`), куда можно подать фейковый readline |
**Test Data:** синтетические tmp-каталоги
**Expected Outcome:** TUI на настоящем v2-проекте наконец видит v2; тест не висит.
**Priority:** Critical

#### TC-035: `detect.js` — регрессия существующих тестов

**Description:** `TC-001`, `TC-002` (`:40-53`), `TC-003` (`:29-38`), `TC-004` (`:55-67`), `TC-004b` (`:69-78`), `P0-1` (`:80-91`) и «partial/ambiguous» в `tools/onboarding-tui/test/detect.test.js` **остаются зелёными без правок** (Р7).
**Preconditions:** `node --test tools/onboarding-tui/test/detect.test.js`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Прогнать весь файл тестов | Все существующие кейсы PASS |
| 2 | Проверить `TC-004` (`**Framework Version:** 4.0.0` → `unknown`) | PASS: нет ни `planning/issues/`, ни v3-отпечатка, ни `CLAUDE.md` → шаги 3-5 не срабатывают, шаг 6 даёт `'unknown'` |
| 3 | Проверить `TC-004b` (`PLANNING.md` без строки версии) | PASS: `'unknown'` по той же логике |
| 4 | Проверить `TC-002` (v3-штамп + `CLAUDE.md`) | PASS: шаг 2 возвращает `'v3'` раньше |
| 5 | Проверить `TC-003` (`:29-38`, только `CLAUDE.md` → `'v2-or-older'`) | PASS — **и это намеренно**: именно оно даёт фикстуре `no-pf-claude` токен `'v2-or-older'` (D-C). Поведение `detect.js` для «`CLAUDE.md` без `PLANNING.md`» **не меняется** |
| 6 | Проверить `P0-1` (структурный v3-отпечаток без `PLANNING.md`) | PASS — на этот отпечаток опирается фикстура `v3-incomplete` (TC-005) |
| 7 | `git diff` по телам существующих кейсов | Не изменены |
**Test Data:** существующий `detect.test.js`
**Expected Outcome:** Порядок детекции переписан без регрессий.
**Priority:** Critical

#### TC-036: TUI — единый action-token `converge` во всех трёх состояниях

**Description:** П1-4 + Р11: `install`/`migrate` схлопываются в `converge`; пункт converge добавлен в `MENUS.v3`; `MENUS.unknown` не меняется.
**Preconditions:** `node --test` (`menu.test.js`); чтение модулей TUI.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Прочитать `MENUS.none` | Есть пункт с action `converge` (метка про установку); токена `install` больше нет |
| 2 | Прочитать `MENUS['v2-or-older']` | Есть пункт с action `converge` (метка про миграцию); токена `migrate` больше нет |
| 3 | Прочитать `MENUS.v3` | Есть пункт с action `converge` (метка про доливку) — сегодня `MENUS.v3` (`menu.js:37-40`) содержит только `update-skills` и `issue-status`, попасть в converge из v3 **нечем** |
| 4 | Прочитать `MENUS.unknown` | Ровно один пункт, action `diagnose` — converge из `unknown` не запускается (намеренная страховка, `menu.js:25-27`) |
| 5 | Проверить `actions.js` | Экспортируется `runConverge(targetDir)`; `runSetupV3`/`runMigrateV2ToV3` отсутствуют; комментарий-компромисс P2-7 (`:63-77`) удалён |
| 6 | Проверить `cli.js` | Диспетчер обрабатывает токен `converge`; веток `install`/`migrate` нет |
| 7 | `grep -rn 'setup-planning-v3\|migrate-v2-to-v3' tools/` | Ноль совпадений |
**Test Data:** `tools/onboarding-tui/lib/{menu,actions}.js`, `tools/onboarding-tui/cli.js`
**Expected Outcome:** Вторая точка входа (а с ней и дефекты 2/3/4) ликвидирована.
**Priority:** High

#### TC-037: `printDiagnostics` печатает `.pf-version`

**Description:** Диагностика — единственный выход пользователя из состояния `unknown`; она обязана показывать новый машинный маркер.
**Preconditions:** Синтетические tmp-каталоги; `menu.js` экспортирует `printDiagnostics`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Вызвать `printDiagnostics(dir)` на каталоге с `.pf-version` = `3.0.0` | В выводе есть строка про `.pf-version` со значением |
| 2 | Вызвать на каталоге **без** `.pf-version` | Строка присутствует со статусом «отсутствует», а не пропущена молча |
| 3 | Проверить остальные элементы массива `checks` (`menu.js:69-73`) | `docs/issues/`, `PLANNING.md`, `CLAUDE.md` печатаются как прежде |
**Test Data:** синтетические tmp-каталоги
**Expected Outcome:** Диагностика не отстаёт от детектора.
**Priority:** Medium

#### TC-038: `Makefile` — `make converge` и `make test`

**Description:** Цель `converge` заменяет обе цели `setup-v3` (`:45-46`) и `migrate-v2-to-v3` (`:39-40`); `setup-v2` (`:42-43`) и `migrate-v1-to-v2` (`:36-37`) удалены; добавлена цель `test`; `.PHONY` (`:3`) и help (`:14-17`) приведены в соответствие.
**Preconditions:** Репозиторий фреймворка (только чтение и `make -n`).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `make -n converge TARGET=/tmp/x` | Цель существует и разворачивается в `bash scripts/converge-to-v3.sh --target /tmp/x`. Проброс аргумента делается **по существующему прецеденту цели `tui` (`Makefile:49`)**: `$(if $(TARGET),--target $(TARGET),)`. Без `TARGET=` — `bash scripts/converge-to-v3.sh` без аргументов (цель по умолчанию — `$(pwd)`) |
| 2 | `make -n setup-v3`, `make -n setup-v2`, `make -n migrate-v1-to-v2`, `make -n migrate-v2-to-v3` | Каждая → «No rule to make target» |
| 3 | `make test` | Прогоняет `test/*.sh` и `node --test tools/onboarding-tui/test/`; при падении любого теста код ненулевой |
| 4 | `grep '.PHONY' Makefile` | Содержит `converge` и `test`; удалённых имён не содержит |
| 5 | `make help` | Перечисляет `converge` (в т.ч. форму `TARGET=<path>`) и `test`; строк про удалённые цели нет |
**Test Data:** `Makefile`
**Expected Outcome:** Единственная точка входа доступна пользователю; тесты запускаются одной командой.
**Priority:** High

#### TC-039: Удаления доведены до конца — ни одной живой ссылки (П1-3)

**Description:** После удаления скриптов, корневого `templates/`, `templates/config/*` и двух `.bootstrap`-файлов в репозитории не остаётся ни одной **живой** ссылки на них.
**Preconditions:** Ветка issue, полный диф относительно `develop`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Проверить `scripts/` | `setup-planning-v2.sh`, `setup-planning-v3.sh`, `migrate-v1-to-v2.sh`, `migrate-v2-to-v3.sh` отсутствуют; присутствует `converge-to-v3.sh` |
| 2 | `test -d templates` (корневой) | Каталога нет |
| 3 | Проверить `PLANNING.md.bootstrap` и `.qa-workflow.md.bootstrap` | Оба удалены (сегодня оба существуют и отслеживаются git) |
| 4 | Проверить `docs/planning/templates/config/` | `.qa-workflow.md` удалён без замены; `PLANNING.md` переписан заново (generic-v3 с плейсхолдером `[Project Name]`, без даты — D-E); появился новый `CLAUDE.md` |
| 5 | `grep -rn 'setup-planning-v[23]\|migrate-v1-to-v2\|migrate-v2-to-v3\|setup-planning-framework\|\.bootstrap\|templates/config/\.qa-workflow' . --exclude-dir=.git --exclude-dir=test --exclude-dir=issues` | Совпадения **только** в: `CHANGELOG.md`, `docs/planning/v1.0-archive/`, `docs/planning/session-log.md`, `docs/planning/v2.0-design-analysis.md`, `README.md:391-398` (Version History), `.claude/settings.local.json` — всё это исторические/машинные записи, вынесенные «Вне scope». В `scripts/`, `skills/`, `tools/`, `Makefile`, `CONTRIBUTING.md`, `CLAUDE.md`, `PLANNING.md`, `docs/planning/{FRAMEWORK,QUICKSTART}.md`, `docs/planning/templates/README.md` — **ноль**. **`--exclude-dir=issues` обязателен**: без него grep находит десятки совпадений в документах *этого самого issue* (`docs/issues/open/20260713-bug-v2-to-v3-migration-defects/*.md`, где эти имена обсуждаются по делу) и даёт ложный FAIL. Каталог `docs/issues/closed/` исключается тем же флагом — там тоже история |
| 6 | Проверить `docs/planning/v1.0-archive/` | Содержит перенесённые `FRAMEWORK.md` (v1.1), `QUICK-REFERENCE.md` и `MIGRATION-GUIDE-v1-to-v2.md`, каждый с пометкой «historical»; из корня репозитория `FRAMEWORK.md` и `QUICK-REFERENCE.md` исчезли |
| 7 | Проверить `docs/planning/MIGRATION-GUIDE-V3.md` | Существует, описывает converge; ссылки из `CLAUDE.md:19` и `README.md:31` ведут на него, а не на v1→v2-гайд |
| 8 | Проверить `CONTRIBUTING.md` — **два** места, а не одно | (а) `:108-117` — блок «Run setup script» переписан на `converge-to-v3.sh`; (б) **`:355`** («Getting Help») — ссылки `[FRAMEWORK.md](FRAMEWORK.md)` и `[QUICK-REFERENCE.md](QUICK-REFERENCE.md)` больше не ведут на **корневые** файлы: оба ушли в `docs/planning/v1.0-archive/`, и без правки это две битые ссылки. Проверка: `grep -nE '\]\((FRAMEWORK\|QUICK-REFERENCE)\.md\)' CONTRIBUTING.md` → ноль совпадений |
| 9 | `shellcheck scripts/*.sh` | exit 0, в том числе для нового `converge-to-v3.sh` |
**Test Data:** репозиторий целиком
**Expected Outcome:** Удалённая поверхность не оставила битых ссылок — иначе пользователь упрётся в них ровно в момент онбординга.
**Priority:** Critical

#### TC-040: Счётчики и списки скилов приведены к 15

**Description:** Живые списки и счётчики скилов согласованы с фактическим содержимым `skills/` (Р10).
**Preconditions:** Репозиторий; фактическое число каталогов в `skills/` = 15 (проверено).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `grep -n '7 Claude Code skills' CLAUDE.md` | Ноль совпадений (`:16`, `:34` исправлены) |
| 2 | Проверить счётчик скилов в `docs/planning/QUICKSTART.md:39` и `docs/planning/FRAMEWORK.md:375` | Оба равны 15 (не 11 / не «Eleven») |
| 3 | Пересчитать скилы, перечисленные в `skills/pf-update/SKILL.md:13-26` | 15, включая `pf-manual-test` |
| 4 | Пересчитать скилы в `tools/onboarding-tui/lib/tutorial.js:48-57` | 15 |
| 5 | Проверить `docs/planning/FRAMEWORK.md:427-438` | Раскладка `skills/` показана каталогами со `SKILL.md`, а не плоскими `.md`-файлами |
| 6 | Проверить `README.md` | Есть новая секция «Skills» с 15 скилами; `README.md:391-398` (Version History) **не изменён** |
| 7 | `grep -n 'setup-planning-v3' skills/pf-help/SKILL.md` | Ноль совпадений (`:69` исправлена) |
| 8 | Проверить `skills/pf-update/SKILL.md` | Скил сверяет `.pf-version` проекта с версией фреймворка и при расхождении/отсутствии рекомендует запустить converge |
**Test Data:** `skills/`, документация
**Expected Outcome:** Ни один документ не обещает пользователю неверное число скилов; тихий дрейф `.pf-version` замечается.
**Priority:** Medium

#### TC-041: Собственные QA-гейты фреймворка не блокируют этот issue (Р6) — на КОПИИ репозитория (S-5)

**Description:** Гейты «No unresolved TODOs» (`.qa-workflow.md:28`/`:35`), Project Scope Guard (`:98`/`:102`) и «No unrelated changes» (`:84`) правятся так, чтобы issue мог пройти собственную QA, **не теряя** ловящей силы. Шаг 2 требует **внести** пробный `TODO:` — и потому выполняется в `$TMP_REPO`, а не в рабочем дереве (иначе падение теста посреди прогона оставило бы репозиторий грязным и завалило бы гейт `Working tree clean`, `.qa-workflow.md:81`).
**Preconditions:** `TMP_REPO=$(pf_repo_copy)` — копия репозитория **вместе с `.git`**, чтобы работали `git diff develop...HEAD` и коммиты.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В `$TMP_REPO` выполнить исправленный TODO-гейт: `git diff develop...HEAD -- . ':!docs/issues/' ':!test/' \| grep -E "^\+.*TODO" \| grep -v 'TODO: Run /pf-'` | Ноль совпадений — литерал `TODO: Run /pf-` (правило распознавания заглушки, мера 2) больше не валит гейт |
| 2 | В `$TMP_REPO` дописать в `skills/pf-check/SKILL.md` посторонний `TODO: refactor later`, закоммитить, повторить шаг 1 | Гейт **ловит** его — исключён именно литерал, а не каталог `skills/` целиком |
| 3 | В `$TMP_REPO` выполнить Project Scope Guard с новым whitelist: `git diff --name-only develop...HEAD \| grep -vE '^(tools\|test)/' \| grep -E '\.(tsx?\|jsx?\|py\|rb\|go\|sql)$\|^\.github/workflows/'` | Ноль совпадений — `.js`-файлы фикстур и bash-тесты в `test/` не считаются продуктовым кодом |
| 4 | Прочитать гейт «No unrelated changes» (`.qa-workflow.md:84`) | Для bug-issue при tier ≠ trivial сверка ведётся со списком файлов из `implementation_plan.md`, а не из несуществующего `specs.md`/`notes.md` |
| 5 | Прочитать строку `.qa-workflow.md:68` | **Не изменена** — она внутри `## Feature Issues (feat, improve)` (заголовок `:65`) и к bug не применяется |
| 6 | Выполнить гейт Testing (`.qa-workflow.md:40`/`:45`) на этом test_plan: `grep -c '\| \[ \] \*\|' docs/issues/open/20260713-bug-v2-to-v3-migration-defects/test_plan.md` | Возвращает **число строк Status Tracker** (не ошибку и не 0 при незаполненном трекере) — то есть колонка `Status` действительно использует синтаксис `\| [ ] \|`, который гейт ищет (KI-10). Если бы трекер использовал `PASS`/`FAIL`, гейт вернул бы 0 и был бы **бессмысленно зелёным** с самого начала |
| 7 | `cd "$REPO_ROOT" && git status --porcelain` | Пусто — рабочее дерево репозитория не тронуто (S-5) |
**Test Data:** копия `.qa-workflow.md` и дифа ветки в `$TMP_REPO`
**Expected Outcome:** Issue физически может закрыться по собственным правилам фреймворка, а гейты не потеряли ловящую силу.
**Priority:** High

#### TC-042: [Static] Единое определение «стадия завершена» лежит в ОДНОМ месте (дефект 5, мера 2)

**Description:** Мера 2 — страховочная сетка для **уже мигрированных** проектов: заглушки лежат на диске прямо сейчас, и мера 1 их оттуда не уберёт. В 1-й редакции плана эта мера покрывалась **только** ручными TC-037/038/039 — то есть в этом прогоне не проверялась бы **вовсе**. Между тем бо́льшая её часть **статична** и тривиально проверяется grep'ом по `skills/`.
**Preconditions:** Репозиторий (только чтение). Реализуется как bash-тест `test/skills-static.sh`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Найти определение «стадия завершена» в `skills/pf-size-tiers/SKILL.md` | Присутствует, и в нём есть **все три** конъюнкта: файл существует **И** тело непустое помимо заголовка **И** файл не содержит литерал `TODO: Run /pf-` (искать по всему файлу) |
| 2 | Дополнить: определение включает и требование порядка | Стадия завершена, только если завершены **все предшествующие** стадии её конвейера (мера 3 — формулируется здесь же, чтобы у меры 3 тоже был один источник) |
| 3 | `grep -rln 'TODO: Run /pf-' skills/` | Совпадение **ровно в одном** файле — `skills/pf-size-tiers/SKILL.md`. Если литерал критерия появился где-то ещё, значит гейт переформулировал критерий у себя, а не сослался |
| 4 | Проверить, что **каждый** из семи гейтов **ссылается** на `pf-size-tiers`, а не формулирует свой критерий: `skills/pf/SKILL.md:145` («check passed»), `skills/pf/SKILL.md:57-67` (таблица Step 5), `skills/pf-test-plan/SKILL.md:14`, `skills/pf-impl-plan/SKILL.md:9`, `skills/pf-impl-plan/SKILL.md:10`, `skills/pf-execute/SKILL.md:20-22`, `skills/pf-brd/SKILL.md:11`, `skills/pf-spec/SKILL.md:10` | В каждом из этих мест есть ссылка на `~/.claude/skills/pf-size-tiers/SKILL.md` (прецедент ссылки уже есть: `pf/SKILL.md:170,190`, `pf-brd:9`, `pf-spec:7`, `pf-test-plan:7`, `pf-impl-plan:7`) |
| 5 | Проверить область применения в `pf/SKILL.md` Step 5 | Критерий применён ко **всем** строкам таблицы (`:57-67`), включая `notes.md`, `manual_test_checklist.md`, `qa_report.md` — не только к `test_plan.md` |
| 6 | Проверить, что `brd.md`-указатель из закрытых issue не ловится критерием | В `pf-size-tiers` явно сказано: критерий применяется к issue в `docs/issues/open/` (а указатель Р1 не несёт литерала `TODO: Run /pf-` — TC-021, шаг 4) |
**Test Data:** `skills/`
**Expected Outcome:** Мера 2 верифицирована автоматически, а не только человеком, которого может не быть.
**Priority:** Critical

#### TC-043: [Static] ЧЕТЫРЕ таблицы маршрутизации, а не три (дефект 5, мера 3 + Р12)

**Description:** **Исправление ложного утверждения 1-й редакции.** В `skills/pf/SKILL.md` таблиц маршрутизации **четыре**, а не три:

| Таблица | Строки | Чем ключуется |
|---|---|---|
| **trivial-tier** | `:87-91` | **напрямую тем, какие документы существуют** — `:85` говорит это дословно |
| feat | `:100-111` | последней завершённой стадией |
| improve | `:118-127` | последней завершённой стадией |
| bug | `:134-143` | последней завершённой стадией; сегодня в ней ровно **8** строк, и строки «IMPL_PLAN без TEST_PLAN» среди них нет |

Про trivial-таблицу забыли все предыдущие редакции — и это **дверь, через которую дефект 5 воскресает**. Цепочка: Р5 намеренно оставляет `size_tier` отсутствующим → legacy-tier guard `/pf` (`:49-51`) **спрашивает** пользователя → пользователь отвечает `trivial` → правило приоритета (`:73`) отправляет issue в trivial-таблицу **исключительно** → `/pf-brd` создаёт `notes.md` → на следующем `/pf` срабатывает строка `:91` («`notes.md` + `test_plan.md` оба существуют → `/pf-check`, затем `/pf-execute`») — а `test_plan.md` у мигрированного из v2 issue **лежит на диске заглушкой**. Реализация против заглушки, ровно как на `llama-server`.
**Preconditions:** Репозиторий (только чтение). Bash-тест `test/skills-static.sh`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Посчитать таблицы маршрутизации в `skills/pf/SKILL.md` | **4** — trivial, feat, improve, bug |
| 2 | Проверить bug-таблицу | Появилась строка «`implementation_plan.md` есть, `test_plan.md` нет (или он не завершён)» → next step `/pf-test-plan`. Сегодня такой строки нет, и мигрированный v2-bug-issue уходит прямо в `/pf-execute` против несуществующего тест-плана |
| 3 | Проверить feat- и improve-таблицы | Маршрутизация ключуется на **первой НЕзавершённой** стадии конвейера, а не на «последней завершённой»; строки для «IMPL_PLAN есть, но BRD/SPEC/TEST_PLAN отсутствуют» ведут назад, к первой дыре |
| 4 | **Проверить trivial-таблицу (`:87-91`)** | Колонка «documents present» переформулирована через **общее определение «стадия завершена»** (TC-042), а не через голое существование файла. То есть stub-`test_plan.md` в строке `:91` **не считается существующим**, и маршрут ведёт в `/pf-test-plan`, а не в `/pf-execute` |
| 5 | Проверить, что правило приоритета (`:73`) и оговорка «эта таблица ключуется на документах» (`:85`) сохранены | Сохранены — мы **не** ломаем механизм, из-за которого trivial-таблица вообще существует (`notes.md` в Step 5 схлопывает BRD/SPEC/IMPL_PLAN разом); мы лишь заменяем «файл есть» на «стадия завершена» |
| 6 | `grep -rniE 'all three (routing )?tables?' skills/` | Ноль совпадений — в скилах не осталось формулировки «три таблицы». **Область поиска намеренно ограничена `skills/`**: расширить её на `docs/issues/` нельзя — там (в этом самом test_plan и в analysis) фраза встречается по делу, при обсуждении ошибки, и grep дал бы ложный FAIL (та же ловушка, что в TC-039, шаг 5) |
| 7 | Проверить `/pf-spec` и `/pf-impl-plan` в trivial-маршруте | Правило `:93` («`/pf-spec` и `/pf-impl-plan` никогда не появляются как next step при `size_tier: trivial`») сохранено |
**Test Data:** `skills/pf/SKILL.md`
**Expected Outcome:** Дверь, через которую дефект 5 возвращался, закрыта — и закрытие проверено статически.
**Priority:** Critical

#### TC-044: [Static] Р9 — четыре «выходных» гейта дают выбор, два «входных» остаются stop'ами

**Description:** Гейты «выход уже существует» превращаются из жёсткого stop в вопрос regenerate / keep / cancel; гейты «вход должен существовать» остаются stop'ами и начинают опираться на общее определение «стадия завершена» (мера 2). Статическую половину этой проверки можно и нужно делать grep'ом — живой интерактив остаётся Manual (TC-048).
**Preconditions:** Репозиторий (только чтение). Bash-тест `test/skills-static.sh`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `skills/pf-brd/SKILL.md:11` («`notes.md` OR `brd.md` already exists … stop») | Формулировка «stop» заменена на выбор **regenerate / keep / cancel** |
| 2 | `skills/pf-spec/SKILL.md:10` («`specs.md` already exists … stop») | То же |
| 3 | `skills/pf-test-plan/SKILL.md:14` («`test_plan.md` already exists … stop») | То же. Именно этот гейт **блокировал перегенерацию заглушки** — тупик дефекта 5 |
| 4 | `skills/pf-impl-plan/SKILL.md:10` («`implementation_plan.md` already exists … stop») | То же. Именно здесь заперт владелец мигрированного issue: у него `implementation_plan.md` уже есть (переименован из v2-шного, Р12) |
| 5 | `skills/pf-impl-plan/SKILL.md:9` (предусловие «`test_plan.md` must exist») | **Остаётся stop'ом**, но формулируется через общее определение «стадия завершена» (заглушка входом не считается) |
| 6 | `skills/pf-execute/SKILL.md:20-22` (предусловия на `implementation_plan.md` / `notes.md`) | **Остаются stop'ами**, через то же общее определение |
| 7 | `grep -rn 'regenerate' skills/` | Совпадения **ровно в четырёх** файлах — `pf-brd`, `pf-spec`, `pf-test-plan`, `pf-impl-plan`. В `pf-execute` слова `regenerate` нет: у него только входные гейты |
**Test Data:** `skills/`
**Expected Outcome:** Тупик снят, но конвейер не ослаблен (снятие противоречия Р1/Р9) — и это видно из файлов, а не только из живой сессии.
**Priority:** High

### System (live-session, Manual)

> Здесь остаётся **только то, что физически нельзя автоматизировать**: живая интерпретация инструкций скила Claude Code, интерактивные промпты и настоящий `$HOME`. Статические половины этих проверок вынесены в TC-042/TC-043/TC-044 (Auto). Все TC этой секции обязаны начинаться с `bash scripts/update-skills.sh` — правки в `skills/` не вступают в силу, пока копии в `~/.claude/skills/` не обновлены (KI-4).

#### TC-045: `/pf` на мигрированном v2-**bug**-issue не ведёт в `/pf-execute` (Р12)

**Description:** Живая проверка строки bug-таблицы, добавленной в TC-043. У мигрированного bug-issue есть `analysis.md` и `implementation_plan.md`, но **нет** `test_plan.md`. Сегодня строка `pf/SKILL.md:141` отправила бы его прямо в `/pf-execute`.
**Preconditions:** Живая сессия Claude Code; `bash scripts/update-skills.sh` выполнен. Проект — результат converge на копии `test/fixtures/v2-project/` (issue `20250102-bug-beta`). На вопрос legacy-tier guard про `size_tier` ответить **`medium`**.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf` | Спрошен `size_tier` (Р5 намеренно его не проставил); активный issue — `20250102-bug-beta`, тип `bug` |
| 2 | Прочитать «Completed stages» | `CREATE`, `ANALYSIS`. **IMPL_PLAN не засчитан** — предшествующая стадия TEST_PLAN не завершена |
| 3 | Прочитать «Next step» | `/pf-test-plan` — маршрутизация ключуется на **первой незавершённой** стадии |
| 4 | Убедиться, что `/pf-execute` не предложен | Не предложен |
| 5 | Создать `test_plan.md` через `/pf-test-plan`, снова запустить `/pf` | Next step сместился дальше по конвейеру (`/pf-check` → `/pf-impl-plan`), стадии не перепрыгнуты |
**Test Data:** результат converge на `test/fixtures/v2-project/`
**Expected Outcome:** Строка «IMPL_PLAN без TEST_PLAN» в bug-таблице действительно добавлена и работает.
**Priority:** Critical

#### TC-046: `/pf` не засчитывает stub-`test_plan.md` (дефект 5, мера 2)

**Description:** Живая проверка меры 2 на не-trivial маршруте. Стадия завершена, только если файл непустой **и** не содержит `TODO: Run /pf-` **и** все предшествующие стадии завершены.
**Preconditions:** Живая сессия; `update-skills.sh` выполнен. Проект — результат converge на копии `test/fixtures/v2-with-stub/` (feat-issue со stub-`test_plan.md`). На вопрос про `size_tier` ответить **`medium`**.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf` | «Completed stages» **не** содержит `TEST_PLAN` — файл распознан как заглушка по маркеру `TODO: Run /pf-` |
| 2 | Проверить `IMPL_PLAN` | Тоже не засчитан — предшествующая стадия не завершена |
| 3 | Прочитать «Next step» для feat-issue без `brd.md`/`specs.md` | `/pf-brd` — первая незавершённая стадия конвейера feat, а не перепрыгнутая |
| 4 | Создать `qa_report.md` из одного заголовка, запустить `/pf` | Стадия QA не засчитана — критерий «непустое тело помимо заголовка» применён ко **всем** строкам таблицы Step 5 |
| 5 | Проверить `brd.md`-указатель в закрытом issue (TC-021) | На маршрутизацию не влияет: `/pf` сканирует только `docs/issues/open/` |
**Test Data:** `test/fixtures/v2-with-stub/`
**Expected Outcome:** Сценарий, наблюдавшийся на `llama-server` (`Completed: CREATE, TEST_PLAN, IMPL_PLAN` → `/pf-execute`), больше не воспроизводится.
**Priority:** Critical

#### TC-047: `/pf` при ответе `trivial` не ведёт в `/pf-execute` против заглушки (закрытая дверь TC-043)

**Description:** **Самый опасный из живых сценариев.** Р5 намеренно не проставляет `size_tier`; legacy-tier guard (`pf/SKILL.md:49-51`) спрашивает; пользователь мигрированного issue вполне может ответить `trivial`. После этого правило приоритета (`:73`) отдаёт issue **исключительно** trivial-таблице, а та (`:87-91`) ключуется **напрямую на существование документов** (`:85`). Строка `:91` — «`notes.md` + `test_plan.md` оба существуют → `/pf-check` → `/pf-execute`». Заглушка `test_plan.md` лежит на диске с миграции.
**Preconditions:** Живая сессия; `update-skills.sh` выполнен. Проект — результат converge на копии `test/fixtures/v2-with-stub/`. На вопрос legacy-tier guard ответить **`trivial`**.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf`, ответить `trivial` | В `prompt.md` записан `size_tier: trivial`; использована **trivial-таблица** |
| 2 | Прочитать «Next step» | `/pf-brd` — `notes.md` ещё нет (строка `:89`) |
| 3 | Выполнить `/pf-brd` | `notes.md` создан |
| 4 | Запустить `/pf` снова | **Next step — `/pf-test-plan`, а НЕ `/pf-check` → `/pf-execute`.** Строка `:91` не срабатывает, потому что `test_plan.md` — заглушка, а «documents present» теперь означает «стадия завершена» (TC-043, шаг 4) |
| 5 | Убедиться, что `/pf-execute` не предложен ни на одном шаге до создания настоящего `test_plan.md` | Не предложен |
| 6 | Выполнить `/pf-test-plan` (гейт `pf-test-plan:14` предложит regenerate — выбрать `regenerate`), затем `/pf` | Только теперь маршрут ведёт к `/pf-check` → `/pf-execute` |
**Test Data:** `test/fixtures/v2-with-stub/`
**Expected Outcome:** Дверь, которую не заметили пять предыдущих раз, закрыта на живом маршруте.
**Priority:** Critical

#### TC-048: Гейты «файл существует» дают regenerate / keep / cancel (Р9) — живой интерактив

**Description:** Живая половина TC-044: сам интерактивный промпт и три его ветки.
**Preconditions:** Живая сессия; `update-skills.sh` выполнен; issue, в котором уже есть `implementation_plan.md` (мигрированный из v2) и `test_plan.md`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-impl-plan` при существующем `implementation_plan.md` | Не жёсткий stop: предложен выбор regenerate / keep / cancel |
| 2 | Выбрать `keep` | Файл не изменён; скил завершился без ошибки |
| 3 | Запустить снова, выбрать `regenerate` | Файл перегенерирован |
| 4 | Запустить снова, выбрать `cancel` | Файл не изменён; напечатано сообщение об отмене |
| 5 | Повторить для `/pf-test-plan`, `/pf-brd`, `/pf-spec` | Во всех трёх — тот же выбор из трёх вариантов |
| 6 | Запустить `/pf-impl-plan` при **отсутствующем** `test_plan.md` | Гейт «вход должен существовать» остаётся **stop**'ом |
| 7 | Запустить `/pf-execute` при отсутствующем `implementation_plan.md` | stop |
**Test Data:** мигрированный issue из результата converge
**Expected Outcome:** Тупик снят, но конвейер не ослаблен.
**Priority:** High

#### TC-049: End-to-end через TUI на настоящем v2-проекте

**Description:** Проводка `detect.js` → `menu.js` → `actions.js` → `cli.js` → `converge-to-v3.sh` работает целиком, живьём, и глобальная установка после этого исправна.
**Preconditions:** Живая сессия; копия `test/fixtures/v2-project/` во временном каталоге; **обычный `$HOME`** (в этом и смысл ручной проверки). Заранее сделать резервную копию `~/.claude/skills/` и `~/.claude/bin/pf`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `make tui TARGET=<копия v2-проекта>` | Напечатано `Detected: v2-or-older` (а не `unknown`, как сегодня) |
| 2 | Прочитать меню | Есть пункт про миграцию/сходимость (action-token `converge`) |
| 3 | Выбрать его | Запускается `converge-to-v3.sh`; вывод фаз читаем и понятен |
| 4 | По завершении — `make tui TARGET=<тот же каталог>` | `Detected: v3`; в меню есть пункт converge (доливка) |
| 5 | Запустить `/pf-qa-setup` в этом проекте из Claude Code | Скил существует и создаёт `.qa-workflow.md` — несущая починка дефекта 2 подтверждена end-to-end |
| 6 | Проверить `~/.claude/skills/` | 15 скилов; глобальная установка не повреждена |
**Test Data:** `test/fixtures/v2-project/`
**Expected Outcome:** Пользовательский путь «поставил TUI → мигрировал → работаю» проходится без ручного вмешательства.
**Priority:** High

#### TC-050: `/pf-qa` проходит на этом issue целиком

**Description:** Прогон исправленного `.qa-workflow.md` целиком, живьём. Вынесен из TC-041 (Auto) отдельным Manual-кейсом: `/pf-qa` — это скил, ему нужна живая сессия Claude Code, и внутри Auto-теста он невыполним.
**Preconditions:** Живая сессия; ветка issue с полным дифом относительно `develop`; `update-skills.sh` выполнен.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-qa` | Скил читает исправленный `.qa-workflow.md` |
| 2 | Пройти все автоматические гейты | Ни один не падает по причине, не связанной с содержанием работы |
| 3 | Пройти AI-гейты «No unrelated changes» (`:84`) | Сверка ведётся с `implementation_plan.md` — и она **исполнима** (у bug-issue тира large нет `specs.md`/`notes.md`) |
| 4 | Проверить гейт Testing (`:40`) | `grep -c '\| \[ \] \*\|' … test_plan.md` → `0` после того, как все Auto-TC отмечены |
| 5 | Прочитать итоговый `qa_report.md` | Вердикт PASS/FAIL выставлен по существу |
**Test Data:** `.qa-workflow.md` репозитория, диф ветки
**Expected Outcome:** Issue физически может закрыться по собственным правилам фреймворка.
**Priority:** High

### Edge case

#### TC-051: Один и тот же ID в разных статусах — ОБА направления (П1-4)

**Description:** Path-коллизии нет, и наивный перенос создал бы **одновременно открытый и закрытый** issue — `/pf` «воскресил» бы закрытую работу. Правило: **местоположение v3-копии авторитетно**. Проверяются оба направления, и для этого нужны **два разных ID**: один ID не может лежать одновременно и «open в v2 / closed в v3», и наоборот.
**Preconditions:** `pf_setup_case collision-same-id`. `<ID-A>` = `20250101-feat-alpha` (`planning/issues/open/` + `docs/issues/closed/`); `<ID-C>` = `20250103-improve-gamma` (`planning/issues/closed/` + `docs/issues/open/`).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | `test -d docs/issues/open/<ID-A>` | Каталога **нет** — второй каталог для того же ID никогда не создаётся |
| 3 | `ls docs/issues/closed/<ID-A>/` | Файлы v2-копии слиты сюда (по правилу `.v2.md`) |
| 4 | `test -d docs/issues/closed/<ID-C>` | Каталога **нет** — обратное направление |
| 5 | `ls docs/issues/open/<ID-C>/` | Файлы v2-копии из `planning/issues/closed/<ID-C>/` слиты **сюда** — v3-раскладка авторитетна независимо от направления |
| 6 | Прочитать stdout | Оба события вынесены **отдельными** строками WARNING-отчёта, с указанием ID и обоих статусов |
| 7 | Просканировать `docs/issues/open/` (как это делает `/pf`) | `<ID-A>` (закрытый в v3) не «воскрес»; `<ID-C>` остался открытым |
**Test Data:** `test/fixtures/collision-same-id/`
**Expected Outcome:** Статус issue определяется v3-раскладкой, а не порядком обхода.
**Priority:** Critical

#### TC-052: Коллизия имён в одном issue — суффикс `.v2.md`

**Description:** Целевой файл есть и **отличается** → v2-копия кладётся рядом как `<name>.v2.md`, v3-копия не трогается. Целевой файл есть и **побайтово совпадает** → источник просто удаляется.
**Preconditions:** `pf_setup_case collision-same-id`. `<ID-B>` = `20250102-bug-beta` лежит **в одном и том же статусе** (`open`) в обеих раскладках: `analysis.md` **различается**, `prompt.md` **побайтово идентичен**.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | `ls docs/issues/open/<ID-B>/` | Есть `analysis.md` (v3-копия) **и** `analysis.v2.md` (v2-копия) |
| 3 | Сравнить `analysis.md` с v3-версией фикстуры | Идентично — v3-копия не тронута |
| 4 | Сравнить `analysis.v2.md` с `planning/`-версией фикстуры | Идентично |
| 5 | Проверить `prompt.md` (побайтово совпадал) | `prompt.v2.md` **не создан** — источник просто удалён |
| 6 | Прочитать stdout | Все сохранённые `.v2.md` перечислены в WARNING-отчёте |
| 7 | Сверить имена `.v2.md` с точными именами из таблицы Step 5 (`brd.md`, `specs.md`, `test_plan.md`, `implementation_plan.md`, `notes.md`, `manual_test_checklist.md`, `qa_report.md`, `analysis.md`) | Ни одно не совпадает → на маршрутизацию `/pf` они не влияют |
**Test Data:** `test/fixtures/collision-same-id/`
**Expected Outcome:** Данные не теряются и не затираются; лишних «пройденных стадий» не появляется.
**Priority:** Critical

#### TC-053: Порядок «переименование → детект коллизии»

**Description:** Переименование `implementation-plan.md` → `implementation_plan.md` выполняется **первым**; коллизия проверяется по **целевому** имени. Иначе наивный `mv` либо затрёт v3-план, либо оставит в папке два плана.
**Preconditions:** `pf_setup_case collision-same-id`. У `<ID-B>` есть **и** `planning/…/implementation-plan.md` (v2), **и** `docs/…/implementation_plan.md` (v3, отличается).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | `ls docs/issues/open/<ID-B>/` | Ровно два файла плана: `implementation_plan.md` (v3, не изменён) и `implementation_plan.v2.md` (v2) |
| 3 | Проверить отсутствие `implementation-plan.md` | Дефисного имени нет (T10) |
| 4 | Проверить отсутствие `implementation-plan.v2.md` | Суффикс навешен **после** нормализации имени |
| 5 | Сравнить `implementation_plan.md` с v3-эталоном | Идентично — v3-план не затёрт |
| 6 | Прочитать stdout | WARNING про сохранённый `.v2.md` |
**Test Data:** `test/fixtures/collision-same-id/`
**Expected Outcome:** Результат однозначен и не зависит от порядка обхода файлов.
**Priority:** Critical

#### TC-054: Коллизия «файл против каталога» — ERROR, ненулевой код, и `planning/` НЕ УДАЛЯЕТСЯ (D-B)

**Description:** Если по нормализованному целевому пути в `docs/` лежит каталог, а в `planning/` — файл (или наоборот), суффикс `.v2.md` неприменим, а `.v2/` породил бы фантомный issue-каталог, который `/pf` увидел бы как второй активный issue. Правило: **не переносить**, напечатать ERROR, **не падать**, вернуть ненулевой код — **и не выполнять фазу 5 вовсе** (D-B). «Никаких удалений, пока переносы не завершены успешно» («Условия приёмки»). Проект честно остаётся несошедшимся; тихо пропустить T9–T11 и при этом стереть `planning/` — худший из исходов.
**Preconditions:** `pf_setup_case collision-file-dir` (два конфликтных issue — прямой и обратный случай — и один бесконфликтный).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | **Ненулевой** exit code — но не аварийное падение посреди фазы (нет trace, нет «Complete!») |
| 2 | Прочитать вывод | ERROR-строка **на каждый** конфликт, с **обоими** путями и требованием ручного разбора |
| 3 | Проверить конфликтный путь в `docs/` | Не изменён — источник не перенесён |
| 4 | Проверить бесконфликтный issue той же фикстуры | Перенесён нормально — фаза 3 доведена до конца по всем непроблемным элементам |
| 5 | `assert_target_state --no-destructive` → **T1–T8** | Выполнены: доливка безопасна и делается (скилы, `.pf-version`, `PLANNING.md`, `CLAUDE.md`, шаблоны на месте) |
| 6 | **T9 — инвертированно:** `test -d planning/issues` | Каталог **СУЩЕСТВУЕТ**. Фаза 5 (удаление по белому списку) **не выполнялась вовсе**; `planning/` цел, включая конфликтный источник |
| 7 | **T10 — инвертированно:** `find planning/issues -name 'implementation-plan.md'` | Дефисные имена в `planning/` на месте — нормализация не «дочищала» источник, который не перенесён |
| 8 | **T11 — инвертированно:** `detectState("$TMP_WORK")` | `'v2-or-older'` — проект честно **не сошёлся** (`planning/issues/` на месте → **шаг 1** порядка Р7). Шаг 1 обязан стоять **раньше** `.pf-version` и штампа `PLANNING.md`: фаза 6 к этому моменту уже записала `.pf-version` = `3.0.0` и `PLANNING.md` со штампом `3.0` (шаг 5 этого же TC их требует), и при любом другом порядке детектор вернул бы `'v3'` |
| 9 | Проверить бэкап | Создан; источник сохранён в `planning-backup-*` |
| 10 | Проверить `docs/issues/open/` на каталоги с суффиксом `.v2` | Не появились — фантомный issue не создан |
| 11 | Разобрать конфликт руками (переименовать каталог в `docs/`), прогнать converge второй раз | exit 0; `assert_target_state` → полный T1–T11; `planning/` удалён |
**Test Data:** `test/fixtures/collision-file-dir/`
**Expected Outcome:** Единственный случай, где converge честно расписывается в невозможности, — и делает это громко, не удаляя данные и не притворяясь сошедшимся.
**Priority:** Critical

#### TC-055: Суффикс `.v2.md` не нарастает (`.v2.v2.md` невозможен)

**Description:** Повторный прогон по проекту, где уже лежат `.v2.md`-файлы, не создаёт `.v2.v2.md`: если `<name>.v2.md` уже существует и совпадает с источником — источник просто удаляется.
**Preconditions:** `pf_setup_case mixed-layout`, доведённая до состояния «`.v2.md` уже создан, но источник в `planning/` ещё лежит» (имитация обрыва между созданием сайдкара и удалением источника — воспроизводится хуком `--fail-after`, D-F).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | `find docs/ -name '*.v2.v2.md'` | Пусто |
| 3 | Посчитать `find docs/ -name '*.v2.md'` | Столько же, сколько было до прогона — новых сайдкаров не создано |
| 4 | `test -d planning/issues` | Отсутствует — источник удалён |
| 5 | Прогнать converge третий раз, снять слепок | Побайтово идентичен слепку после второго прогона |
**Test Data:** `test/fixtures/mixed-layout/` (модифицированная)
**Expected Outcome:** Многократное прерывание и перезапуск не порождают лавину сайдкаров.
**Priority:** High

#### TC-056: Проект вне git

**Description:** Converge работает в каталоге без `.git`: гейт чистого worktree не применяется, весь перенос идёт через `cp -a` + `rm`.
**Preconditions:** `pf_setup_case v2-project` **без** `git init`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0; ни один вызов `git` не завершился фатально |
| 2 | `assert_target_state` | T1–T11 выполнены |
| 3 | Прочитать stdout | Есть информационное сообщение «не git-репозиторий — проверка worktree пропущена» |
| 4 | Проверить бэкап | Создан; отказ `git check-ignore` обработан, а не уронил скрипт |
| 5 | Прогнать второй раз | exit 0; побайтово ничего не изменилось |
**Test Data:** `test/fixtures/v2-project/` без `.git`
**Expected Outcome:** Отсутствие git — не ошибка и не тихая порча.
**Priority:** Medium

#### TC-057: Потребительский `.gitignore` игнорирует путь бэкапа (KI-1)

**Description:** У потребителя может быть свой `.gitignore` (например, `planning-*` или `*-backup-*`). Перед созданием бэкапа прогоняется `git check-ignore -q <path>`, и при попадании печатается WARNING. Это — **настоящая** проверка обоснования KI-1; TC-016, шаг 2 проверяет выбор имени, а этот TC — реакцию на чужой `.gitignore`.
**Preconditions:** `pf_setup_case v2-project` с `.gitignore`, содержащим `planning-backup-*`; `git init` + коммит.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pf_run_converge` | exit 0 |
| 2 | Прочитать stdout | WARNING: путь бэкапа игнорируется git, потому не виден в `git status` и невосстановим через git |
| 3 | Проверить сам бэкап | Создан несмотря на WARNING — терять данные из-за `.gitignore` нельзя |
| 4 | Убрать строку из `.gitignore`, прогнать на свежей копии | WARNING не печатается |
**Test Data:** `test/fixtures/v2-project/` + модифицированный `.gitignore`
**Expected Outcome:** Единственный артефакт отката не становится невидимым молча.
**Priority:** Medium

#### TC-058: `doc_language` — вырожденные входы (D-G, П1-5)

**Description:** Отсутствие `prompt.md`/`analysis.md`, пустые файлы, равное число букв, уже существующий frontmatter, битый frontmatter — converge не падает и принимает **определённое** решение.
**Preconditions:** `pf_setup_case v2-latin` — фикстура несёт **семь** issue, покрывающих все случаи ниже.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Issue (3): нет ни `prompt.md`, ни `analysis.md` | converge **не падает**; печатает WARNING и решение `English` (правило «иначе English»); **`prompt.md` НЕ создаётся** — Р1 запрещает stub'ы в открытых issue (D-G) |
| 2 | Issue (4): `prompt.md` и `analysis.md` пусты (0 букв) | `doc_language: English`; счётчики 0/0 не приводят к ошибке; frontmatter дописан в пустой `prompt.md` |
| 3 | Issue (5): поровну кириллических и латинских букв | `doc_language: English` (условие «кириллица **строго** больше» не выполнено); решение напечатано |
| 4 | Issue (6): `prompt.md` **уже несёт валидный** frontmatter `doc_language: Russian` | Значение **не перезаписывается**; `size_tier` не добавляется; файл в остальном побайтово не изменён |
| 5 | Issue (7): `prompt.md` с **битым** frontmatter (открывающий `---` без закрывающего) | converge **не падает**; печатает WARNING; **файл не редактируется вовсе** (D-G) — побайтово идентичен исходному. Попытка «починить» малформленный YAML — риск потери данных |
| 6 | `pf_run_converge` второй раз | Ни одно из решений не изменилось; WARNING'и печатаются снова; слепок побайтово тот же |
| 7 | Проверить exit code всех прогонов | 0 — вырожденный вход не является ошибкой converge |
**Test Data:** `test/fixtures/v2-latin/` (семь issue)
**Expected Outcome:** Ни один краевой вход не роняет converge посреди деструктивной операции и не портит пользовательский файл.
**Priority:** Low

---

## Status Tracker

| TC | Test Case | Type | Priority | Status | Remarks |
|----|-----------|------|----------|--------|---------|
| TC-001 | Сходимость из пустого проекта (`no-pf-bare`) | Auto | Critical | [ ] | |
| TC-002 | Сходимость из проекта с одним `CLAUDE.md` — два детектора (D-C) | Auto | Critical | [ ] | |
| TC-003 | Сходимость из v1-проекта | Auto | Critical | [ ] | |
| TC-004 | Сходимость из настоящего v2-проекта (дефект 1) | Auto | Critical | [ ] | |
| TC-005 | Доливка «неполного v3» (мотивация Р11) | Auto | Critical | [ ] | |
| TC-006 | Сходимость из смешанной / полумигрированной раскладки | Auto | Critical | [ ] | |
| TC-007 | Идемпотентность — второй прогон побайтово ничего не меняет (D-E) | Auto | Critical | [ ] | |
| TC-008 | Восстановление после прерванного прогона (D-F) | Auto | Critical | [ ] | Использует хук `--fail-after` |
| TC-009 | Все 15 скилов ставятся динамическим перебором (дефект 3) | Auto | Critical | [ ] | Работает на копии репо (S-5) |
| TC-010 | Артефакты фреймворка перезаписываются всегда (T2, T3, T6) | Auto | Critical | [ ] | |
| TC-011 | T6 — ЗЕРКАЛИРОВАНИЕ, а не наложение (П1-1) | Auto | Critical | [ ] | |
| TC-012 | Пользовательские документы не перезаписываются (T5) | Auto | High | [ ] | |
| TC-013 | Плейсхолдеры подставляются, литералов не остаётся (П1-7) | Auto | High | [ ] | |
| TC-014 | `CLAUDE.md` — размеченная секция вставляется идемпотентно (Р8) | Auto | Critical | [ ] | |
| TC-015 | Старая неразмеченная v1-секция — WARNING, а не удаление | Auto | High | [ ] | |
| TC-016 | Бэкап — имя, видимость для git, условия создания (KI-1) | Auto | High | [ ] | |
| TC-017 | `git mv` с пофайловым fallback (KI-2) | Auto | Critical | [ ] | |
| TC-018 | Удаление v1/v2-артефактов по белому списку | Auto | Critical | [ ] | |
| TC-019 | Артефакты v2-фреймворка не переносятся, а удаляются | Auto | High | [ ] | |
| TC-020 | Заглушки в открытых issue не создаются вовсе (дефект 5, мера 1) | Auto | Critical | [ ] | |
| TC-021 | `brd.md`-указатель в закрытых issue; нет маркера `legacy:` (Р1) | Auto | High | [ ] | |
| TC-022 | Переименование `implementation-plan.md` во всех issue (Р12, T10) | Auto | Critical | [ ] | |
| TC-023 | `doc_language` детектится по содержимому (Р5, D-D) | Auto | High | [ ] | |
| TC-024 | `.qa-workflow.md` — подсказка/WARNING, но НЕ создание (Р4) | Auto | High | [ ] | |
| TC-025 | Итоговый отчёт converge (фаза 7) | Auto | Medium | [ ] | |
| TC-026 | `--dry-run` не меняет ничего | Auto | Critical | [ ] | |
| TC-027 | Гейт worktree: untracked НЕ роняет гейт (D-A) | Auto | Critical | [ ] | |
| TC-028 | Гейт worktree: tracked-правка роняет; `--force` обходит (D-A) | Auto | Critical | [ ] | |
| TC-029 | Отменённый прогон НЕ завершается кодом 0 (KI-6) | Auto | Critical | [ ] | Единственный TC без `--yes` |
| TC-030 | CLI-контракт — флаги, порядок, неизвестный флаг | Auto | High | [ ] | |
| TC-031 | Радиус поражения — только `$TARGET` и `$HOME/.claude` | Auto | High | [ ] | |
| TC-032 | Аудит S-1 — ни один тест не вызывает converge напрямую | Auto | Critical | [ ] | |
| TC-033 | `detect.js` — `.pf-version` бьёт штамп `PLANNING.md` (Р7, шаг 2) | Auto | Critical | [ ] | Метки `TCD-01`…`TCD-06` |
| TC-034 | `detect.js` — настоящий v2, v1 и смешанная раскладка (дефект 6) | Auto | Critical | [ ] | Метки `TCD-07`…`TCD-11` |
| TC-035 | `detect.js` — регрессия существующих тестов | Auto | Critical | [ ] | |
| TC-036 | TUI — единый action-token `converge` во всех трёх состояниях | Auto | High | [ ] | |
| TC-037 | `printDiagnostics` печатает `.pf-version` | Auto | Medium | [ ] | |
| TC-038 | `Makefile` — `make converge` и `make test` | Auto | High | [ ] | |
| TC-039 | Удаления доведены до конца — ни одной живой ссылки (П1-3) | Auto | Critical | [ ] | |
| TC-040 | Счётчики и списки скилов приведены к 15 | Auto | Medium | [ ] | |
| TC-041 | QA-гейты фреймворка не блокируют issue (Р6) | Auto | High | [ ] | Работает на копии репо (S-5) |
| TC-042 | [Static] Единое определение «стадия завершена» (мера 2) | Auto | Critical | [ ] | Auto-половина бывшего TC-038 |
| TC-043 | [Static] ЧЕТЫРЕ таблицы маршрутизации, а не три (мера 3, Р12) | Auto | Critical | [ ] | Auto-половина бывшего TC-037 |
| TC-044 | [Static] Р9 — 4 выходных гейта дают выбор, 2 входных — stop | Auto | High | [ ] | Auto-половина бывшего TC-039 |
| TC-045 | `/pf` на мигрированном v2-bug-issue не ведёт в `/pf-execute` (Р12) | Manual | Critical | [ ] | Живая сессия Claude Code |
| TC-046 | `/pf` не засчитывает stub-`test_plan.md` (мера 2) | Manual | Critical | [ ] | Живая сессия Claude Code |
| TC-047 | `/pf` при ответе `trivial` не ведёт в `/pf-execute` против заглушки | Manual | Critical | [ ] | Живая сессия; закрытая дверь TC-043 |
| TC-048 | Гейты «файл существует» дают regenerate / keep / cancel (Р9) | Manual | High | [ ] | Интерактивный промпт |
| TC-049 | End-to-end через TUI на настоящем v2-проекте | Manual | High | [ ] | Требует настоящего `$HOME`; сделать бэкап `~/.claude/` |
| TC-050 | `/pf-qa` проходит на этом issue целиком | Manual | High | [ ] | Живая сессия Claude Code |
| TC-051 | Один и тот же ID в разных статусах — оба направления (П1-4) | Auto | Critical | [ ] | |
| TC-052 | Коллизия имён в одном issue — суффикс `.v2.md` | Auto | Critical | [ ] | |
| TC-053 | Порядок «переименование → детект коллизии» | Auto | Critical | [ ] | |
| TC-054 | Коллизия «файл vs каталог» — ERROR, `planning/` НЕ удаляется (D-B) | Auto | Critical | [ ] | |
| TC-055 | Суффикс `.v2.md` не нарастает (`.v2.v2.md` невозможен) | Auto | High | [ ] | |
| TC-056 | Проект вне git | Auto | Medium | [ ] | |
| TC-057 | Потребительский `.gitignore` игнорирует путь бэкапа (KI-1) | Auto | Medium | [ ] | |
| TC-058 | `doc_language` — вырожденные входы (D-G) | Auto | Low | [ ] | |

**Итого:** 58 TC — **52 Auto**, **6 Manual** (TC-045…TC-050).

**По категориям:** Functional 25 (TC-001…TC-025), Validation 7 (TC-026…TC-032), Integration 12 (TC-033…TC-044), System / live-session 6 (TC-045…TC-050), Edge case 8 (TC-051…TC-058). **25 + 7 + 12 + 6 + 8 = 58.**

**По приоритетам:** Critical 34, High 18, Medium 5, Low 1. **34 + 18 + 5 + 1 = 58.**

**Про Manual.** В 1-й редакции Manual'ов было 4, и **вся** проверка меры 2, меры 3, Р9 и Р12 сидела внутри них — то есть самый опасный дефект issue не проверялся бы автоматически **вообще**. Здесь эти три TC расщеплены: статическая (и потому greppable) половина ушла в Auto (TC-042, TC-043, TC-044), а в Manual осталось только то, что требует живой интерпретации инструкций скила и интерактивного промпта. Добавлен TC-047 — живая проверка **trivial**-двери, которую не заметили пять предыдущих редакций. Manual-кейсы выносятся в `manual_test_checklist.md`.

---

## Known Issues

| Issue | Description | TC Affected | Severity |
|-------|-------------|-------------|----------|
| KI-1 | Маска `*.bak` — общеупотребительная строка в `.gitignore` (она есть и в `.gitignore:16` **самого фреймворка**), поэтому каталог `planning.bak/` был бы **невидим для git** у любого потребителя с такой маской: невосстановим и незаметен в `git status`. Имя бэкапа обязано быть `planning-backup-<YYYYMMDD-HHMMSS>/`. Отдельно проверяется реакция на **чужой** `.gitignore`, который может игнорировать и это имя | TC-016 (выбор имени — на копии с подсаженным `*.bak`), TC-057 (чужой `.gitignore`) | High |
| KI-2 | `git mv` **проверено эмпирически**: на полностью неотслеживаемом каталоге → `fatal: source directory is empty` (exit 128); на одиночном неотслеживаемом файле → `fatal: not under version control` (exit 128). Репозиторного ветвления «git есть / git нет» недостаточно — нужен **пофайловый** fallback: `git ls-files --error-unmatch` → `git mv`, иначе `cp -a` + `rm` | TC-017, TC-056 | Critical |
| KI-3 | Собственный TODO-гейт фреймворка (`.qa-workflow.md:28`, команда `:35`) не имеет pathspec: `git diff develop...HEAD \| grep -E "^\+.*TODO"`. Литерал `TODO: Run /pf-` **обязан** появиться в `skills/pf-size-tiers/SKILL.md` (правило распознавания заглушки), в документах этого issue и в фикстурах → issue не пройдёт собственную QA, пока гейт не исправлен (Р6) | TC-041 | High |
| KI-4 | Правка скила в репозитории **не вступает в силу**, пока не выполнен `scripts/update-skills.sh`: исполняются копии из `~/.claude/skills/`. Все Manual-TC обязаны начинать с этого шага. Auto-TC этой проблемы не имеют — TC-042/043/044 читают файлы в `skills/` **репозитория** напрямую | TC-045…TC-050 | High |
| KI-5 | Converge пишет в `~/.claude/skills/` и перезаписывает `~/.claude/bin/pf`. Автотест без `HOME=$TMP_HOME` **уничтожит глобальную установку разработчика** и сломает все параллельные сессии Claude Code. В 1-й редакции плана два TC (интерактивная отмена и «прогон из cwd без `--target`») **обходили обёртку** и были бы именно таким прогоном — поэтому обёрток теперь **три** (`pf_run_converge`, `pf_run_converge_interactive`, `pf_run_converge_cwd`), все три идут через единственный `_pf_converge_exec`, и это проверяется автотестом | все Auto-TC; шлюз — TC-032 | Critical |
| KI-6 | Сегодняшний `migrate-v2-to-v3.sh:94` (`read -p` + пустой `CONFIRM` → `exit 0`) — ловушка **ложно-зелёного**: автотест на таком контракте проходит, не мигрировав ничего. Converge обязан возвращать ненулевой код на любой отмене, включая закрытый stdin без `--yes` | TC-029 | Critical |
| KI-7 | Фикстуры **нельзя** снять прогоном `setup-planning-v2.sh`: `create-issue.sh` и `close-issue.sh` удалены в коммите `4a17bb7`, а `:126` копирует их под охраной `if [ -f … ]` → скрипт молча создаёт **неполный** v2-проект. Фикстуры собираются руками и коммитятся. При этом `issue-status.sh` копируется исправно и в фикстуре `v2-project` присутствовать обязан | все фикстурные TC | High |
| KI-8 | Фикстуры коммитятся как **обычные каталоги без вложенного `.git`** (вложенный репозиторий превратился бы в submodule). Тесты, которым нужен git, делают `git init` + первый коммит уже в `$TMP_WORK` | TC-016, TC-017, TC-022, TC-027, TC-028, TC-056, TC-057 | Medium |
| KI-9 | `menu.js::showMenu` (`:110-113`) **бросает `Error`** на неизвестном state, а `MENUS` имеет ровно 4 ключа → новый токен `'v1'` вводить нельзя; v1-проект обязан детектиться как `'v2-or-older'`. **Отдельно:** `showMenu` нельзя вызывать в `node --test` — он открывает `readline` на `process.stdin` и крутится в цикле до валидного ввода, то есть тест **повиснет**. Проверять `Object.keys(MENUS)` (модуль его экспортирует) или подавать фейковый `rl` через `opts.rl` (`menu.js:115`) | TC-034 (шаг 6), TC-036 | Medium |
| KI-10 | Гейт Testing (`.qa-workflow.md:40`, команда `:45`) считает незакрытые строки трекера как `grep -c '\| \[ \] \*\|'` → колонка `Status` в Status Tracker обязана использовать синтаксис `[ ]` / `[x]`. Любой другой формат (например, `PASS`/`FAIL`) сделает гейт **бессмысленно зелёным**. Трекер выше этому требованию соответствует; сама проверка соответствия — шаг 6 TC-041 (в 1-й редакции KI-10 был указан на TC-036, который этот гейт не проверял вовсе) | TC-041 (шаг 6); объект проверки — Status Tracker этого документа | Low |
| KI-11 | Установка поверх существующего v3 сегодня **асимметрична**: шаблоны перезаписываются (`setup-planning-v3.sh:89`), а глобальные документы пропускаются (`:99-110`). В converge правило зафиксировано явно (артефакты фреймворка перезаписывать, пользовательские документы не трогать) — и проверяется в обе стороны | TC-010, TC-011, TC-012 | Medium |
| KI-12 | `.qa-workflow.md` **не входит** в целевое состояние T1–T11 (Р4). Соблазн проверить его наличие в `assert_target_state` приведёт к ложному FAIL: converge этот файл не создаёт **никогда** | TC-024 | Medium |
| KI-13 | Фаза 3 (перенос) и фаза 5 (удаление) деструктивны, а `set -e` означает, что падение в середине оставит проект наполовину мигрированным без отката. Порядок фаз обязателен: **никаких удалений, пока переносы не завершены успешно** (D-B — при неудавшемся переносе фаза 5 **не выполняется вовсе**, `planning/` остаётся цел, T9–T11 явно не достигнуты); бэкап — единственный артефакт отката и не удаляется после успешного прогона | TC-008, TC-016, TC-054 | High |
| KI-14 | **Гейт чистого worktree обязан смотреть только на отслеживаемые изменения** (`git status --porcelain --untracked-files=no`). Собственные выходы converge (`docs/issues/`, `.pf-version`, `PLANNING.md`, `planning-backup-*`) в реальном репозитории неотслеживаемы — untracked-чувствительный гейт сделал бы **второй** прогон converge падающим в любом git-проекте, убив идемпотентность (D-A) | TC-027, TC-028, TC-017 | Critical |
| KI-15 | **Таблиц маршрутизации в `skills/pf/SKILL.md` ЧЕТЫРЕ, а не три:** trivial (`:87-91`), feat (`:100-111`), improve (`:118-127`), bug (`:134-143`). Trivial-таблица ключуется **напрямую на существование документов** (`:85` говорит это дословно), и её строка `:91` (`notes.md` + `test_plan.md` → `/pf-check` → `/pf-execute`) — **дверь, через которую дефект 5 воскресает**: Р5 не проставляет `size_tier`, legacy-tier guard (`:49-51`) спрашивает, пользователь отвечает `trivial`, и мигрированный issue с заглушкой `test_plan.md` на диске уезжает в реализацию. Меры 2 и 3 обязаны распространяться и на trivial-таблицу | TC-043, TC-047 | Critical |
| KI-16 | **Детекторов в проекте два, и это нормально:** собственный bash-детектор converge (фаза 1) и `detect.js` (детектор TUI, 4 токена). На фикстуре `no-pf-claude` они дают разные ответы (`'v2-or-older'` против «нет PF») — расхождение безвредно, потому что `'v2-or-older'` ведёт в пункт меню, который после П1-4 **и есть** converge. Поведение `detect.js` для «`CLAUDE.md` без `PLANNING.md`» (`detect.js:56-58`, зафиксировано `detect.test.js:29-38`) **не меняется** (D-C) | TC-002, TC-035 (шаг 5) | Medium |
| KI-17 | **T6 сегодня реализован как наложение, а не зеркало:** `setup-planning-v3.sh:89` — `cp -r "$TEMPLATES_SRC/." …`, он добавляет и перезаписывает, но **никогда не удаляет**. Проект, ранее поставленный v3, несёт `docs/planning/templates/config/.qa-workflow.md`, который Р2 удаляет из фреймворка без замены — реализация на `cp -r` оставит его в проекте и пройдёт все прочие TC незамеченной | TC-011 | High |
| KI-18 | **Артефакты фреймворка не имеют права нести временны́е штампы** (`Last Updated:`, подставленный `YYYY-MM-DD`). T2/T3/T4/T6 перезаписываются на каждом прогоне — любая дата убила бы побайтовую идемпотентность и сделала бы тест «зелёным по вторникам». Единственный подставляемый плейсхолдер — `[Project Name]` (D-E). Подстановка при этом **обязательна**: `setup-planning-v2.sh:176-180` её делал, и её пропажа была бы регрессией (потребитель получил бы `PLANNING.md` с литералом `[Project Name]`) | TC-007 (шаг 6), TC-013 | High |
| KI-19 | **Мутировать рабочее дерево репозитория в тестах запрещено** (S-5). Два TC требуют изменить `skills/` (пробный скил, пробный `TODO:`); падение такого теста на середине оставило бы репозиторий грязным и завалило бы гейт `Working tree clean` (`.qa-workflow.md:81`). Оба работают на копии (`pf_repo_copy` → `$TMP_REPO`). Следствие-требование к converge: он обязан находить корень фреймворка **относительно пути собственного файла**, иначе прогон копии использовал бы `skills/` оригинала | TC-009, TC-041 | High |
| KI-20 | Существующий `tools/onboarding-tui/test/detect.test.js` **уже использует метки `TC-001`…`TC-004b`** из **другого** issue. Новые кейсы детектора, добавляемые в тот же файл, обязаны нести отличный префикс (`TCD-`), иначе трекеры двух issue начнут ссылаться на одни и те же имена | TC-033, TC-034, TC-035 | Medium |






