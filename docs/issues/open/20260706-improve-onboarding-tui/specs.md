---
issue: 20260706-improve-onboarding-tui
type: improve
size_tier: small
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

## Соответствие требованиям BRD

| AC | Реализация |
|---|---|
| AC-1 | Обучающий экран + туториал перед установкой (state = `none`) |
| AC-2 | Единая команда `make tui` с внутренним выбором действия |
| AC-3 | `lib/detect.js` + ветвление меню по состоянию |
| AC-4 | Существующие make-цели не изменяются; `tui` — новая отдельная цель |
| AC-5 | `lib/tutorial.js` — пошаговый туториал по концепциям внутри TUI |
