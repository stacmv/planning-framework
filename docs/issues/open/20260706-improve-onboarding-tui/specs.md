---
issue: 20260706-improve-onboarding-tui
type: improve
size_tier: medium
---

# Specs: `make tui` — интерактивный мастер установки/обновления

## Обзор

Новая make-цель `make tui` запускает интерактивный терминальный мастер (чистый Node.js, `node:readline`, без npm-зависимостей — как `tools/manual-test-ui`), который:

1. Определяет состояние целевого проекта (нет фреймворка / v2.0 или старше / v3.0).
2. Показывает подходящее меню действий для этого состояния.
3. Для новых пользователей — предлагает короткий обучающий экран перед установкой и подробный интерактивный туториал по концепциям фреймворка.
4. Делегирует фактическую работу существующим скриптам (`setup-planning-v3.sh`, `migrate-v2-to-v3.sh`, `update-skills.sh`) — TUI не дублирует их бизнес-логику, а вызывает их как дочерние процессы.

Существующие make-цели (`setup-v3`, `update-skills`, `migrate-v1-to-v2`, `migrate-v2-to-v3`, `setup-v2`, `issue-status`) не изменяются.

## Расположение

```
tools/onboarding-tui/
  cli.js              # точка входа, вызывается из Makefile
  lib/detect.js        # определение версии фреймворка в целевом проекте
  lib/menu.js           # рендеринг меню/навигация (readline)
  lib/tutorial.js       # шаги интерактивного туториала
  lib/actions.js        # обёртки над scripts/*.sh (spawn)
```

## Makefile

Добавить цель `tui` (не заменяет существующие):

```
.PHONY: ... tui

tui:
	node tools/onboarding-tui/cli.js $(if $(TARGET),--target $(TARGET),)

help:
	...
	@echo "  make tui                           Launch the interactive onboarding/update wizard"
```

`TARGET` (опционально) — путь к проекту-потребителю; по умолчанию текущая директория, как в `setup-planning-v3.sh`.

## Определение состояния проекта (`lib/detect.js`)

Прямой вызов существующей detect-функции невозможен — ни в одном из `scripts/*.sh` нет выделенной функции определения версии (скрипты миграции предполагают, что пользователь уже знает исходную версию, и просто выполняют шаги). Поэтому `detect.js` реализует те же маркерные проверки, которые сегодня выполняет пользователь вручную перед выбором скрипта:

| Условие | Результат |
|---|---|
| Нет `docs/issues/` и нет `PLANNING.md`, и нет `CLAUDE.md` | `none` — фреймворк не установлен |
| Есть `PLANNING.md` с маркером версии 3.x (регэксп терпим к markdown-`**`, см. ниже), **ИЛИ** есть `docs/issues/open/` и `docs/issues/closed/` и `docs/planning/session-log.md` | `v3` |
| Есть `CLAUDE.md`, но нет `PLANNING.md` | `v2-or-older` |
| Есть `docs/issues/` без `PLANNING.md`/`CLAUDE.md` (нестандартный случай) | `unknown` — TUI показывает предупреждение и предлагает открыть меню вручную, не выбирая действие по умолчанию |

Примечание (P0-1): `setup-planning-v3.sh`/`migrate-v2-to-v3.sh` не создают корневой `PLANNING.md`/`CLAUDE.md` — сразу после установки v3 определялся бы как `unknown` без этого OR-условия; вторая ветка — надёжный отпечаток свежеустановленного v3.
Примечание (P0-2): регэксп версии — `/Framework Version:\**\s*3\.\d+/` (реальный `PLANNING.md` содержит `**Framework Version:** 3.0`, `**` перед числом).

## Ветвление меню (`lib/menu.js`)

```
┌─ make tui ─────────────────────────────────────────────┐
│ Planning Framework — Setup & Update Wizard              │
├──────────────────────────────────────────────────────────┤
│ Detected: <none | v2-or-older | v3 | unknown>            │
│                                                            │
│  state = none:                                            │
│    [1] What is Planning Framework? (tutorial)             │
│    [2] Install v3.0 into this project                     │
│                                                            │
│  state = v2-or-older:                                     │
│    [1] Migrate this project to v3.0                       │
│    [2] What changed in v3.0? (short overview)              │
│                                                            │
│  state = v3:                                               │
│    [1] Update skills to latest version                     │
│    [2] Show active issue status (/pf equivalent)           │
│                                                            │
│  state = unknown:                                          │
│    [1] Show detected files and let me choose manually       │
│                                                              │
│  [q] Quit                                                    │
└────────────────────────────────────────────────────────────┘
```

Выбор пункта делегируется в `lib/actions.js`, которое запускает соответствующий существующий скрипт через `child_process.spawn` с унаследованным stdio (пользователь видит тот же вывод/промпты, что и при прямом запуске `make setup-v3` и т.п.) — TUI не перехватывает и не переинтерпретирует их вывод.

## Обучающий экран для новых пользователей (state = `none`)

Перед пунктом "Install v3.0 into this project" TUI показывает пункт "What is Planning Framework?" (US-1, AC-1, AC-5). При выборе — интерактивный туториал (`lib/tutorial.js`), состоящий из последовательных экранов (Enter — следующий, `b` — назад, `q` — выход в меню):

1. Что такое issue и зачем нужен `docs/issues/`.
2. Жизненный цикл: `CREATE → BRD/ANALYSIS → SPEC → TEST_PLAN → IMPL_PLAN → EXECUTE → TEST → QA → CLOSE`.
3. Роль `/pf`-команд в Claude Code (`/pf`, `/pf-brd`, `/pf-check`, `/pf-execute`, `/pf-qa`, `/pf-close` и т.д.) — одна строка на команду.
4. Где смотреть детали при необходимости (ссылки на `PLANNING.md`, `docs/planning/FRAMEWORK.md`) — без обязанности их открывать, чтобы продолжить.

Туториал не блокирует переход к установке — пользователь может выйти (`q`) и сразу выбрать "Install v3.0" в любой момент.

## Ограничения и нефункциональные требования

- Zero npm dependencies — только `node:readline`, `node:child_process`, `node:fs`, `node:path` (соответствует конвенции `tools/manual-test-ui`).
- Не требует сети сверх того, что уже требуют вызываемые скрипты.
- Не изменяет и не оборачивает бизнес-логику `setup-planning-v3.sh` / `migrate-v2-to-v3.sh` / `update-skills.sh` — только вызывает их.
- Существующие make-цели остаются рабочими без изменений (AC-4).
- `unknown`-состояние никогда не выбирает действие автоматически — только показывает диагностику и ручной выбор, чтобы не сломать нестандартный проект.

## Глобальный шим `pf` (AC-6)

Устанавливается `setup-planning-v3.sh` и `update-skills.sh` **самого фреймворка** (не консьюмер-скриптами для проекта-потребителя — те продолжают работать как раньше и шим не ставят). Этот шаг относится только к сценарию «установить фреймворк в проект-потребитель» (обычный вызов `setup-planning-v3.sh`/`update-skills.sh`) — он не связан с новым `install.sh`/`install.ps1` (см. ниже), который устанавливает шим/скиллы самостоятельно, не вызывая `setup-planning-v3.sh`.

- Директория установки: `~/.claude/bin` (создаётся при отсутствии). Это отдельная директория от `~/.claude/skills`, но по тому же принципу — глобальное состояние фреймворка, не привязанное к конкретному проекту-потребителю.
- Файл `~/.claude/bin/pf` — исполняемый POSIX shell-скрипт:
  ```sh
  #!/usr/bin/env sh
  exec node "<FRAMEWORK_ROOT>/tools/onboarding-tui/cli.js" --target "$(pwd)" "$@"
  ```
  `<FRAMEWORK_ROOT>` подставляется во время установки как абсолютный путь к папке фреймворка (там, где лежит `setup-planning-v3.sh`), не вычисляется динамически из `$0` — упрощает скрипт и не ломается при симлинках.
- Устанавливающий шаг: `chmod +x` после записи файла; если `~/.claude/bin` не входит в `PATH` пользователя, скрипт установки печатает предупреждение с точной строкой для добавления (`export PATH="$HOME/.claude/bin:$PATH"`) — не пытается автоматически редактировать `.bashrc`/`.zshrc`.
- Идемпотентность: повторный запуск установки/обновления перезаписывает `~/.claude/bin/pf` (обновляя `<FRAMEWORK_ROOT>`, если фреймворк переустановлен в другое место) — без запроса подтверждения.
- `pf` без аргументов эквивалентен `make tui TARGET=$(pwd)`, запущенному из директории фреймворка; дополнительные аргументы (`--target <path>`) проходят через как есть, переопределяя `$(pwd)`.

## Однокомандный установщик фреймворка (AC-7, AC-8)

Устанавливает/обновляет **сам фреймворк** (клонирует репозиторий в `~/.claude/planning-framework`), а не проект-потребителя — отдельная задача от `setup-planning-v3.sh`, которая устанавливает фреймворк *в* проект-потребитель, предполагая, что сам фреймворк уже склонирован где-то локально.

### `scripts/install.sh` (Linux/macOS)

Публикуется в README как:
```sh
curl -fsSL https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/install.sh | sh
```

Шаги:
1. Проверить наличие `git` и `node` в `PATH` (`command -v git`, `command -v node`); если что-то отсутствует — вывести на stderr понятное сообщение с названием отсутствующей программы и ссылкой на её установку, завершиться с ненулевым кодом. Не пытаться ставить их автоматически через apt/brew/etc (вне рамок, см. BRD).
2. `INSTALL_DIR="$HOME/.claude/planning-framework"`.
3. Если `$INSTALL_DIR/.git` существует — `git -C "$INSTALL_DIR" pull --ff-only` (обновление); иначе — `git clone https://github.com/stacmv/planning-framework.git "$INSTALL_DIR"` (первая установка). Оба случая — один и тот же путь кода, без интерактивного вопроса «уже установлено, переустановить?» (US-6, AC-8).
4. Установить шим и скиллы **для самого фреймворка** самостоятельно, внутри `install.sh`, без вызова `setup-planning-v3.sh` (см. P0-обоснование ниже):
   - Скиллы: динамически найти все директории, содержащие `SKILL.md`, в `$INSTALL_DIR/skills/` (тем же способом, что и `update-skills.sh` — `find "$INSTALL_DIR/skills" -mindepth 1 -maxdepth 1 -type d`, отфильтровав по наличию `SKILL.md`), и скопировать каждую в `~/.claude/skills/<имя>/` (`mkdir -p` + `cp -r "$src/." "$dst/"`). Так `install.sh` всегда ставит полный и актуальный набор скиллов, без хардкода списка в третьем месте.
   - Шим: записать `~/.claude/bin/pf` по тому же шаблону, что и в разделе "Глобальный шим `pf`" выше (`<FRAMEWORK_ROOT>` = `$INSTALL_DIR`), `chmod +x`, проверить `PATH` тем же способом (предупреждение с `export PATH="$HOME/.claude/bin:$PATH"`, без автоправки `.bashrc`/`.zshrc`).
   - Примечание (P0): `setup-planning-v3.sh --self` не рассматривается — `setup-planning-v3.sh` копирует шаблоны командой `cp -r "$TEMPLATES_SRC/." "$TEMPLATES_DST/"`, и при `TARGET == FRAMEWORK_DIR` источник и назначение совпадают, `cp` завершается ошибкой «are the same file», а `set -e` прерывает скрипт до шага установки шима. Отдельный инлайн-шаг в `install.sh` (без запуска `setup-planning-v3.sh`) не копирует шаблоны в `docs/planning/templates` вовсе и не имеет этой проблемы.
5. Напечатать итоговое сообщение с путём установки и напоминанием про `PATH`, если `~/.claude/bin` там не найден.

### `scripts/install.ps1` (Windows)

Публикуется в README как:
```powershell
irm https://raw.githubusercontent.com/stacmv/planning-framework/main/scripts/install.ps1 | iex
```

Та же последовательность шагов, что и `install.sh`, средствами PowerShell:
1. `Get-Command git`/`Get-Command node` — при отсутствии, понятная ошибка через `Write-Error` и `exit 1`.
2. `$InstallDir = "$HOME\.claude\planning-framework"`.
3. `git -C $InstallDir pull --ff-only`, если `$InstallDir\.git` существует, иначе `git clone ... $InstallDir`.
4. Установка скиллов и шима — тем же способом динамического обнаружения, что и `install.sh` (шаг 4 выше): найти все директории с `SKILL.md` в `$InstallDir\skills\` (`Get-ChildItem -Directory` + фильтр по наличию `SKILL.md`) и скопировать каждую в `~\.claude\skills\<имя>` через `Copy-Item -Recurse -Force`. Оба установщика (`install.sh` и `install.ps1`) ставят один и тот же полный набор скиллов одним и тем же способом обнаружения — без хардкод-списка и без расхождения между платформами. Шим: на Windows `~/.claude/bin/pf` не может быть POSIX shell-скриптом — устанавливается `~/.claude/bin/pf.cmd` (или `.ps1`), делающий эквивалент `node "<FRAMEWORK_ROOT>\tools\onboarding-tui\cli.js" --target "%CD%" %*`. `PATH` на Windows проверяется через переменную окружения пользователя (`[Environment]::GetEnvironmentVariable('PATH','User')`), с тем же предупреждением-подсказкой при отсутствии `~/.claude/bin` в нём.
5. Итоговое сообщение аналогично `install.sh`.

### Общие ограничения установщика

- Оба скрипта идемпотентны: второй запуск — это `git pull` + переустановка шима, без дополнительных вопросов (US-6, AC-8).
- Ни один скрипт не устанавливает `git`/`node` сам — только проверяет и сообщает (вне рамок, см. BRD «Вне рамок»).
- README получает два блока кода (один для Linux/macOS, один для Windows) рядом друг с другом, с одной строкой пояснения к каждому.

## Соответствие требованиям BRD

| AC | Реализация |
|---|---|
| AC-1 | Обучающий экран + туториал перед установкой (state = `none`) |
| AC-2 | Единая команда `make tui` с внутренним выбором действия |
| AC-3 | `lib/detect.js` + ветвление меню по состоянию |
| AC-4 | Существующие make-цели не изменяются; `tui` — новая отдельная цель |
| AC-5 | `lib/tutorial.js` — пошаговый туториал по концепциям внутри TUI |
| AC-6 | Глобальный шим `~/.claude/bin/pf`, устанавливаемый setup/update-скриптами фреймворка |
| AC-7 | `scripts/install.sh` + `scripts/install.ps1` — однокомандная кросс-платформенная установка |
| AC-8 | `git pull --ff-only` + переустановка шима при повторном запуске install-скриптов |
