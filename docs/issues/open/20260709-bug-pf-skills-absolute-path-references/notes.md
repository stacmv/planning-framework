# Notes: Заменить относительные пути к pf-size-tiers на абсолютные

## What & Why

Семь файлов скиллов фреймворка (шесть `pf-*` и сам `pf/SKILL.md`) ссылаются на `skills/pf-size-tiers/SKILL.md` относительным путём, тогда как сами скиллы установлены в `~/.claude/skills/`. Агент-исполнитель не различает эти два случая и при попытке прочитать файл уходит в `find /`, что порождает висящие процессы на минуты. Замена на абсолютный путь `~/.claude/skills/pf-size-tiers/SKILL.md` (как уже сделано в `pf/SKILL.md` Step 1 для собственной версии) убирает неоднозначность. Аналогичная правка нужна в `pf/SKILL.md` для `docs/issues/open/` (Steps 2 и 5) — сейчас агент, не зная активного проекта, ищет `find / -type d -name 20260709-feat-dockerize`. В обоих случаях фикс один: явный абсолютный путь в тексте инструкции.

## Acceptance Criteria

- [ ] Во всех 7 файлах скиллов (`pf-impl-plan`, `pf-spec`, `pf-test-plan`, `pf-check`, `pf-execute`, `pf-brd`, плюс `pf/SKILL.md` — итого **10 вхождений**) относительный `skills/pf-size-tiers/SKILL.md` заменён на `~/.claude/skills/pf-size-tiers/SKILL.md` везде.
- [ ] `pf/SKILL.md` Steps 2 и 5: формулировка `docs/issues/open/` заменена на «the `docs/issues/open/` directory of the active project (relative to /pf's CWD)», чтобы агент не искал issue-папку по всему `/`.
- [ ] Установленная копия в `~/.claude/skills/` синхронизирована с исходниками через `/pf-update` или `bash scripts/update-skills.sh` (не ручной `cp`).

## Root Cause / Context

`pf/SKILL.md` Step 1 уже использует абсолютный путь `~/.claude/skills/pf/SKILL.md` для собственной версии. Однако остальные шесть `pf-*`-скиллов и сам `pf/SKILL.md` в разделах «Creating prompt.md» (строки 170 и 190) ссылаются на `skills/pf-size-tiers/SKILL.md` тем же относительным путём, каким они ссылают на локальные файлы проекта (`prompt.md`, `brd.md`, `specs.md`, ...). Агент, читающий, например, `pf-check/SKILL.md`, не имеет контекста, что под `skills/` имеется в виду глобальная директория установленных скиллов, а не `<CWD>/skills/`. В Windows + Git Bash `find /` под MSYS сканирует все смонтированные диски (`/c`, `/d`, `/o`, ...) и легко занимает минуты — за это время успевают накопиться сироты от завершившихся bash-оболочек claude-агента (наблюдалось 11+ процессов одновременно, ~150 MB RSS).

Для `pf/SKILL.md` симптом тот же: Steps 2 и 5 используют CWD-relative `docs/issues/open/`. У пользователя несколько проектов с `docs/issues/open/` в `D:/dev/`, агент не знает активного — и ищет по всему корню. Фикс — сделать CWD-привязку явной в тексте инструкции. Замечание на будущее: более робастным решением был бы промежуточный шаг, определяющий project root (например, по маркеру `docs/issues/` или `pf-brd`-маркеру), но это вне скопа тривиального фикса.

## Tasks

- [ ] pf-impl-plan/SKILL.md:7 — заменить `skills/pf-size-tiers/SKILL.md` → `~/.claude/skills/pf-size-tiers/SKILL.md`.
- [ ] pf-spec/SKILL.md:7 — то же.
- [ ] pf-test-plan/SKILL.md:7 — то же.
- [ ] pf-check/SKILL.md:7, 19 — два вхождения, обе → `~/.claude/skills/pf-size-tiers/SKILL.md`.
- [ ] pf-execute/SKILL.md:9 — то же.
- [ ] pf-brd/SKILL.md:9, 21 — два вхождения, обе → `~/.claude/skills/pf-size-tiers/SKILL.md`.
- [ ] pf/SKILL.md:170, 190 — применить тот же absolute-path стиль, что уже использован в Step 1 для `~/.claude/skills/pf/SKILL.md`; после правки перечитать строки на корректность английской грамматики.
- [ ] pf/SKILL.md Step 2 (строка 15) и Step 5 (строка 55): `docs/issues/open/` → «the `docs/issues/open/` directory of the active project (relative to /pf's CWD)»; после правки перечитать обе строки на осмысленность.
- [ ] Синхронизировать установленные копии: запустить `/pf-update` либо `bash scripts/update-skills.sh` (НЕ ручной `cp`).
- [ ] Контроль: `grep -rn 'skills/pf-size-tiers' D:/dev/planning-framework/skills/ | grep -v '~/.claude/skills/pf-size-tiers'` возвращает пусто; `grep -n 'docs/issues/open' D:/dev/planning-framework/skills/pf/SKILL.md` показывает только формулировки с явной CWD-привязкой. Расширенный аудит: `grep -rn 'skills/pf-size-tiers' D:/dev/planning-framework/ --exclude-dir=.git --exclude-dir=closed` тоже должен вернуть только абсолютный путь (закрытый issue 20260703-improve-scale-doc-complexity содержит архивные упоминания — runtime-нерелевантны, но для консистентности тоже должны быть absolute-форматированы).
