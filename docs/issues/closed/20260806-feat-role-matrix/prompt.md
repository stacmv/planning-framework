---
doc_language: Russian
size_tier: medium
roles:
  brd: { write: claude, review: [codex] }
  specs: { write: claude, review: [codex] }
  test_plan: { write: claude, review: [codex] }
  implementation_plan: { write: claude, review: [claude, codex] }
  code: { write: claude, review: [claude, codex] }
---

Ввести матрицу ролей: кто пишет и кто ревьюит каждый артефакт, с гранулярностью
до операции, с расширяемым реестром акторов и с опциональными стадиями
документации.

## Зачем

Claude работает заметно медленнее Codex. Сегодня делегировать Codex можно только
ревью: в `skills/pf-codereview/SKILL.md` и `skills/pf-check/SKILL.md` жёстко
записано, что Codex в любой форме вызова только находит проблемы и никогда не
получает доступ на запись. Чтобы ускорить работу, нужно уметь отдавать ему часть
авторства — код, автотесты, документацию — не теряя при этом независимость
ревью.

Существующий блок `reviewers` в `prompt.md` — половина решения: он описывает
только ревью и только per-document.

## Что нужно сделать

### 1. Матрица ролей в `prompt.md`: ключ — стадия, значение — операции

```yaml
roles:
  brd:         { write: claude, review: [codex] }
  specs:       { write: claude, review: { mode: sequential, by: [haiku, codex] } }
  test_plan:   { write: claude, review: [codex] }
  impl_plan:   { write: claude, review: [codex] }
  code:        { write: codex,  review: [claude] }
  tests:       { write: codex,  review: [claude], run: claude }
  user_docs:   { write: codex,  review: [claude] }
  dev_docs:    skip
```

- `write` — ровно один актор: у документа один автор.
- `review` — список. Короткая форма `[codex]` эквивалентна
  `{mode: parallel, by: [codex]}`.
  - `parallel` — все ревьюят один артефакт, findings сливаются с тегами
    источника; это сегодняшняя `both`-агрегация;
  - `sequential` — первый находит, фиксы применяются, второй ревьюит уже
    исправленное. Схема «дешёвый триаж → дорогой глубокий разбор».
- `run` — только там, где осмысленно (`tests`).
- `skip` — стадия объявлена пропущенной: предусловия ниже по потоку её
  пропускают, `/pf` показывает `skipped`, причина записывается. `code.write`
  пропускать нельзя; `code.review: skip` требует явного подтверждения и попадает
  в `qa_report.md` отдельной строкой риска.

### 2. Реестр акторов `docs/planning/agents.yml`

```yaml
actors:
  claude: { kind: llm, invoke: agent,  model: claude-sonnet-5 }
  haiku:  { kind: llm, invoke: agent,  model: claude-haiku-4-5-20251001 }
  codex:  { kind: llm, invoke: codex-companion }
  gemini: { kind: llm, invoke: cli,    command: "gemini -p {prompt}" }
```

Скиллы резолвят имя актора через реестр вместо `if claude / elif codex`.
Добавление нового агента — строка в реестре, скиллы не трогаются.

### 3. Инвариант независимости

В `review.by` должен быть хотя бы один актор, отличный от `write`.
`{write: claude, review: [codex, claude]}` законно — второй проход Claude идёт
свежим субагентом с чистым контекстом и ловит другое.
`{write: codex, review: [codex]}` запрещено.

Обоснование не теоретическое: десятираундовый прогон в `codereview-tool` был
Claude, ревьюящим код Claude (см. `20260806-improve-codereview-convergence`).

### 4. Профили дефолтов вместо двадцати вопросов

`docs/planning/role-profiles.yml`. При создании issue задаётся **один** вопрос —
какой профиль; отдельные ключи потом переопределяются точечно.

| Профиль | Смысл |
|---|---|
| `solo-claude` | всё Claude — backward-compat дефолт для issue без блока `roles` |
| `claude-writes-codex-reviews` | сегодняшний рекомендованный режим |
| `codex-implements` | доки Claude, код и тесты Codex, ревью Claude — максимум скорости |

Для trivial/small `user_docs`/`dev_docs` автоматически `skip`.

### 5. Новые опциональные стадии

`/pf-user-docs` — README, CHANGELOG, руководство пользователя.
`/pf-dev-docs` — архитектура, ADR, runbook, деплой.

Обе между `/pf-test` и `/pf-qa`. `pf-qa` проверяет их наличие, если они
объявлены не как `skip`.

## Учесть при реализации

Субагентам недоступны `TaskGet`/`TaskUpdate`, хотя `skills/pf-execute/SKILL.md`
предписывает субагенту вызывать их первым и последним действием. Проверено
2026-08-06: оба субагента сообщили, что искали через ToolSearch и не нашли.
Механизм вызова акторов, который эта issue вводит, не должен опираться на тот же
несуществующий канал. Подробности — в
`20260806-improve-codereview-convergence`, пункт 7.

## Явно вне охвата

`human` как актор — делегирование операций человеку, очередь задач, режимы
`blocking`/`non-blocking`, проверка выполнения по хешу артефакта и
переназначение задачи агенту — реализуется в
`20260806-improve-project-explorer-redesign`, потому что вся его поверхность
взаимодействия живёт в этом интерфейсе. Здесь — только llm-акторы.

Реестр акторов при этом обязан быть спроектирован так, чтобы `human` добавлялся
в него позже строкой `human: { kind: human, inbox: project-explorer }`, без
переделки резолвера.

## Приёмка

Issue с `roles.code.write: codex` реализуется Codex, ревьюится Claude, и попытка
задать `{write: codex, review: [codex]}` отклоняется с внятным сообщением.
