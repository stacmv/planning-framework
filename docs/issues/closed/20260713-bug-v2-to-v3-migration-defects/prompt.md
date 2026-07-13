---
doc_language: Russian
size_tier: large
---

Исправить 5 дефектов миграции и установки v2→v3, обнаруженных при переводе проекта `llama-server` (реальный v2.0-проект) на v3.0 13.07.2026.

Все 5 подтверждены на живом проекте: ни один шаг миграции не отработал корректно, весь перевод пришлось делать руками.

## Дефект 1 (корневой) — `migrate-v2-to-v3.sh` не находит issues и молча ничего не делает

`scripts/migrate-v2-to-v3.sh` (строки 41 и 56) сканирует `$TARGET_DIR/docs/issues/open`:

```bash
done < <(find "$TARGET_DIR/docs/issues/open" -maxdepth 2 -name "implementation-plan.md" -print0 2>/dev/null || true)
if [ -d "$TARGET_DIR/docs/issues/open" ]; then
```

Но `scripts/setup-planning-v2.sh` (строки 111-112) кладёт issues в `planning/issues/open`, и дополнительно sed-заменяет `docs/issues/` → `planning/issues/` ещё в 7 местах (строки 139, 143, 148, 182, 219, 230, 251).

**Итог:** на любом настоящем v2-проекте `migrate-v2-to-v3.sh` — гарантированный no-op. Он печатает «(none found)», «(none needed)», «Migration Complete!» и завершается с успехом, не сделав ничего. Ошибки не возникает, поэтому дефект незаметен.

**Что нужно:** скрипт должен обнаруживать v2-раскладку (`planning/`), переносить `planning/issues/` → `docs/issues/` и `planning/{implementation-plan,session-log,decisions}.md` → `docs/planning/`, и только потом выполнять шаги 1-3. Если найдена v2-раскладка — переносить; если уже `docs/` — работать как сейчас.

## Дефект 2 — `setup-planning-v3.sh` не ставит `PLANNING.md` и `.qa-workflow.md`

Скрипт создаёт каталоги, ставит скилы, копирует шаблоны и глобальные документы, ставит `pf`-шим — но никогда не пишет в проект `PLANNING.md` (точку входа фреймворка) и `.qa-workflow.md`.

**Итог:** после чистой установки v3 в проекте нет `PLANNING.md`. При переходе с v2 там остаётся старый v2-файл с заголовком `**Framework Version:** 2.0` и ссылками на `planning/`. Пришлось копировать `PLANNING.md` из репозитория фреймворка вручную.

**Что нужно:** копировать `PLANNING.md` в целевой проект (перезаписывая v2-версию), и создавать `.qa-workflow.md` — либо из шаблона, либо подсказывать запуск `/pf-qa-setup`.

## Дефект 3 — `setup-planning-v3.sh` ставит только 7 скилов из 15

Строка 68:

```bash
SKILLS=(pf pf-brd pf-spec pf-check pf-test-plan pf-impl-plan pf-execute)
```

В `skills/` фактически лежит 15 скилов. Не устанавливаются 8: `pf-close`, `pf-help`, `pf-manual-test`, `pf-qa`, `pf-qa-setup`, `pf-size-tiers`, `pf-test`, `pf-update`.

**Важно:** `pf-size-tiers` — reference-данные, которые читают остальные скилы (`pf/SKILL.md` ссылается на `~/.claude/skills/pf-size-tiers/SKILL.md`). Без него ломается вопрос про size_tier при создании issue. `pf-update` тоже отсутствует — то есть после чистой установки нечем обновляться.

**Что нужно:** перечислять скилы динамически (перебором каталогов в `skills/`), а не хардкодить список, чтобы он не расходился при добавлении новых скилов.

## Дефект 4 — v3-шаблоны помечены версией 2.0

`docs/planning/templates/global/session-log.md` и `docs/planning/templates/global/implementation-plan.md` содержат `**Version:** 2.0`.

**Итог:** свежий v3-проект получает глобальные документы, помеченные как v2.

**Что нужно:** проставить 3.0 (и проверить остальные шаблоны в `docs/planning/templates/` на тот же признак).

## Дефект 5 (самый опасный) — stub `test_plan.md` засчитывается как пройденный этап

`migrate-v2-to-v3.sh` (шаг 2) создаёт заглушку для каждого issue без тест-плана:

```markdown
# Test Plan: <ISSUE-ID>

> TODO: Run /pf-test-plan to generate this file.
```

Но `skills/pf/SKILL.md` (Step 5) определяет пройденные этапы **по факту существования файла**: `test_plan.md` present → стадия TEST_PLAN завершена. То же самое с `implementation_plan.md`.

**Итог, наблюдавшийся вживую на llama-server:** `/pf` показал `Completed stages: CREATE, TEST_PLAN, IMPL_PLAN` и предложил `Next step: /pf-check` → `/pf-execute` — то есть повёл выполнять реализацию против тест-плана, всё содержимое которого — строчка `TODO`. При этом `brd.md` и `specs.md` вообще отсутствовали (в v2 таких стадий не было). Если бы я пошёл по подсказке `/pf`, `/pf-execute` запустился бы против пустого плана.

**Что нужно (варианты):**
1. Не создавать stub вообще — пусть отсутствие файла честно означает незавершённую стадию (проще и надёжнее всего).
2. Либо: `/pf` должен считать стадию завершённой только если файл непустой / не содержит маркера `TODO: Run /pf-`.
3. Плюс: `/pf` должен замечать, что для типа `feat` отсутствуют `brd.md`/`specs.md`, и не проскакивать эти стадии, даже если более поздние файлы существуют.

## Дополнительно (не дефект, но связано)

Стадия миграции никак не обрабатывает legacy-документы v2, которым нет места в наборе документов v3 — например, `definition-of-done.md` (в llama-server такой файл на 76 строк остался в папке issue без роли). Стоит решить: переносить его содержимое в `brd.md`, архивировать или удалять.

## Как воспроизвести

1. Установить v2 в тестовый проект через `scripts/setup-planning-v2.sh` (создаст `planning/issues/open/`).
2. Создать в нём issue с `implementation-plan.md`.
3. Запустить `scripts/migrate-v2-to-v3.sh <project>` — увидеть «Migration Complete!» при нулевом фактическом результате (дефект 1).
4. Запустить `scripts/setup-planning-v3.sh` — увидеть отсутствие `PLANNING.md` и 8 скилов (дефекты 2, 3).
5. Запустить `/pf` — увидеть, что stub-`test_plan.md` засчитан как пройденная стадия (дефект 5).
