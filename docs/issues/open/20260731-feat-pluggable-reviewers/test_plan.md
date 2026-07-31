# Test Plan: Pluggable Reviewers (Claude / Codex) for Documents and Code

## Overview

Эта фича вводит поле `reviewers` во frontmatter `prompt.md` (выбор ревьюера —
`claude`/`codex`/`both` — отдельно для BRD, specs, test_plan,
implementation_plan и кода), гарду, которая один раз при создании issue
запрашивает этот выбор, единый механизм вызова Codex с цепочкой fallback на
Claude, расширение `pf-check` для ревью документов силами Codex/обоих
ревьюеров, и новый жёсткий гейт `pf-codereview` — стадию ревью кода между
`/pf-execute` и `/pf-test`.

Тест-план проверяет обе стороны реализации: (1) конфигурационную —
frontmatter, гарда назначения, дефолты и обратную совместимость; (2)
поведенческую — happy-path вызова Codex, агрегацию замечаний двух
ревьюеров, жёсткость гейта `pf-codereview` и новую проверку предусловия в
`/pf-test`. Ветки fallback-цепочки, требующие управляемой недоступности
Codex, из плана исключены (единственная доступная тестовая машина не
позволяет их безопасно воспроизвести) — реализация в `pf-check`/specs.md
§4 не затронута, покрытие тестами уже.

## Objectives

- Убедиться, что поле `reviewers` записывается гардой корректно и один раз, и
  что его отсутствие в существующих issue не ломает поведение (дефолт —
  `claude` для каждого ключа).
- Проверить happy-path вызова Codex (§4 specs.md) на доступной машине.
  Ветки цепочки, требующие управляемой недоступности Codex (fallback на
  Claude, прямой `codex exec`), в этот план не входят — единственная
  доступная машина не позволяет их безопасно воспроизвести.
- Проверить, что ревью с `both` агрегирует замечания обоих ревьюеров с
  подписями `[Claude]`/`[Codex]`, без попытки автоматически разрешить
  противоречия.
- Убедиться, что `pf-codereview` — настоящий жёсткий гейт: пока открыты
  P0/P1-замечания, «Skip and continue» недоступен, а `/pf-test` отказывается
  стартовать без `code_review.md` с `verdict: PASS`.

## Prerequisites

- Локальный чекаут `planning-framework` на ветке issue
  `20260731-feat-pluggable-reviewers`, с уже реализованными изменениями из
  `specs.md` (поле `reviewers`, гарда, `skills/pf-codereview/SKILL.md`,
  обновлённые `pf-check`/`pf-test`/`pf-size-tiers`).
- Тестовый проект под управлением Planning Framework v3 (или сам
  `planning-framework`, работающий над собственным тестовым issue), в котором
  можно создать/открыть issue и пройти пайплайн CREATE → ANALYZE → PLAN →
  IMPLEMENT → QA.
- Для TC-003/TC-006: Codex (CLI и плагин `codex:setup`/`codex:rescue`)
  установлен и авторизован на машине теста — единственная доступная машина
  уже удовлетворяет этому. Кейсы, требующие управляемого отключения Codex
  (недоступность/fallback), из этого плана исключены — см. Step 1 и Step 3.
- Права на выполнение интерактивных `AskUserQuestion`-диалогов внутри сессии
  Claude Code (все сценарии этого плана проходятся вручную, внутри реальной
  сессии).

---

## Step 1: Identify Test Scenarios

Исходя из brd.md и specs.md, для этой фичи актуальны следующие типы
сценариев (без UI/UX и accessibility — это CLI/skill-фича без графического
интерфейса):

- **Happy path**: гарда назначает ревьюеров при создании issue; документ
  проходит ревью назначенным ревьюером (claude / codex / both); код проходит
  `pf-codereview` и получает `verdict: PASS`; `/pf-test` стартует после
  этого.
- **Error/edge conditions**: поле `reviewers` отсутствует в `prompt.md`
  (обратная совместимость); открыты P0/P1-замечания на попытке выйти из
  `pf-codereview` через «Skip and continue»; `/pf-test` запускается без
  `code_review.md` или с `verdict: FAIL`. (Недоступность Codex — два
  оставшихся звена цепочки §4, TC-004/TC-005 в предыдущей версии этого
  плана — исключены из тест-плана: единственная доступная тестовая машина
  не позволяет управляемо переключать наличие CLI/плагина без разрушения
  реального рабочего окружения. Логика fallback реализована по specs.md §4
  и остаётся непроверенной автотестами/ручными кейсами до появления
  второй машины или контейнера для этой цели.)
- **State transitions**: жизненный цикл `pf-codereview` — от первого прогона
  через цикл «Fix now» → повторный прогон → до конечного `verdict: PASS`;
  переход `/pf-execute` → `pf-codereview` → `/pf-test` в общем роутинге
  `/pf`.
- **Aggregation/normalization behaviour**: `both`-режим (агрегация замечаний
  двух независимых ревью без арбитража) и нормализация severity
  Codex-ответа (`critical`/`high`/`medium`/`low` → `P0`/`P1`/`P2`).

---

## Step 2: Create Test Cases

### TC-001: Гарда назначения ревьюеров при создании issue

**Description:** Проверяет, что при создании issue (feat/improve — на этапе
`pf-brd`; bug — на этапе `/pf` перед `analysis.md`) гарда запрашивает выбор
ревьюера для каждого применимого ключа и один раз записывает его в
`prompt.md`.

**Preconditions:**
- Новый issue создан (папка `docs/issues/open/<ISSUE-ID>/` с `prompt.md`, без
  ключа `reviewers` во frontmatter).
- Issue имеет тип `feat` (пять ключей: `brd`, `specs`, `test_plan`,
  `implementation_plan`, `code`).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-brd` на новом `feat`-issue без поля `reviewers` | Перед написанием BRD появляется `AskUserQuestion` с выбором ревьюера (`claude`/`codex`/`both`) для каждого из пяти ключей, с рекомендацией `claude` везде |
| 2 | Выбрать `both` для `code`, оставить `claude` для остальных, подтвердить | Ответ записывается в frontmatter `prompt.md` как блок `reviewers:` с пятью ключами |
| 3 | Повторно открыть `prompt.md` | Поле `reviewers` присутствует ровно один раз, значения соответствуют выбору из шага 2 |
| 4 | Запустить `/pf-brd` повторно (или любой другой pf-* шаг, читающий `reviewers`) на этом же issue | Гарда не запрашивает выбор повторно — поле уже присутствует и не перезаписывается |

**Test Data:**
- `docs/issues/open/<test-issue-id>/prompt.md` (frontmatter без ключа `reviewers`, `size_tier: small`, тип `feat`)

**Expected Outcome:** `prompt.md` содержит блок `reviewers` с пятью ключами
(`brd`, `specs`, `test_plan`, `implementation_plan`, `code`), записанный один
раз и не редактируемый повторными запусками гарды.

**Priority:** Critical

---

### TC-002: Отсутствие поля `reviewers` — дефолт `claude` (обратная совместимость)

**Description:** Проверяет, что для issue, созданных до появления этой
фичи (без ключа `reviewers` в `prompt.md`), поведение ревью не меняется —
каждый артефакт трактуется так, будто на него назначен только `claude`.

**Preconditions:**
- Существующий (созданный «до фичи») issue, `prompt.md` которого не содержит
  ключа `reviewers` во frontmatter.
- Issue дошёл до стадии, на которой должен пройти ревью документа (например,
  только что написан `specs.md`).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-check` на этом issue | `pf-check` читает `prompt.md`, не находит ключ `reviewers.specs` |
| 2 | Наблюдать, какой ревьюер фактически выполняет анализ | Используется сегодняшний Claude-сабагент (Agent tool), без обращения к Codex и без `AskUserQuestion` про выбор ревьюера |
| 3 | Проверить итоговый вывод замечаний | Вывод не содержит подписей `[Claude]`/`[Codex]` и пометки о fallback — поведение неотличимо от `pf-check` до этой фичи |

**Test Data:**
- `docs/issues/open/<legacy-test-issue-id>/prompt.md` (frontmatter без ключа `reviewers`, смоделирован по образцу issue, созданных до 2026-07-31)
- `docs/issues/open/<legacy-test-issue-id>/specs.md` (готовый документ для ревью)

**Expected Outcome:** Ревью проходит так же, как до внедрения фичи; никакого
изменения поведения или ошибки из-за отсутствующего поля.

**Priority:** Critical

---

### TC-003: Цепочка вызова Codex — плагин доступен и CLI готов

**Description:** Проверяет основной («счастливый») путь цепочки §4: плагин
`codex` установлен, `codex:setup` подтверждает готовность CLI, ревью
выполняется через `codex-companion.mjs review --wait`.

**Preconditions:**
- Плагин `codex` (скиллы `codex:setup`/`codex:rescue`) присутствует в списке
  доступных скиллов сессии.
- CLI `codex` установлен и авторизован на машине.
- В `prompt.md` тестового issue для одного из документов (например,
  `reviewers.specs: codex`).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-check` для документа с `reviewers.<doc>: codex` | `pf-check` определяет, что плагин `codex` доступен |
| 2 | Наблюдать вызов `codex:setup` | `codex:setup` подтверждает готовность CLI без повторного запроса на установку |
| 3 | Наблюдать фактическое ревью | Выполняется `codex-companion.mjs review` в режиме `--wait`, без интерактивных пауз, с областью — весь целевой документ |
| 4 | Проверить вывод замечаний | Замечания сгруппированы по P0/P1/P2 согласно сопоставлению severity (critical/high → P0, medium → P1, low → P2) |

**Test Data:**
- `docs/issues/open/<test-issue-id>/prompt.md` (`reviewers.specs: codex`)
- `docs/issues/open/<test-issue-id>/specs.md` (готовый документ для ревью)

**Expected Outcome:** Ревью документа выполнено Codex через штатный
`codex-companion.mjs review --wait`, замечания корректно нормализованы в
P0/P1/P2, без обращения к Claude-сабагенту.

**Priority:** High

---

### TC-006: `both` — агрегация замечаний Claude и Codex без арбитража

**Description:** Проверяет сценарий из BRD §5/specs.md §5: если на артефакт
назначены оба ревьюера, оба проходят независимо, их замечания объединяются в
один список с подписями `[Claude]`/`[Codex]`, группировка по P0/P1/P2
сохраняется, framework не пытается разрешить противоречия между вердиктами.

**Preconditions:**
- Codex (CLI и/или плагин) доступен на тестовой машине.
- `prompt.md` тестового issue назначает `reviewers.<doc>: both` для
  проверяемого документа (или `reviewers.code: both` для кода).
- Целевой документ/diff кода содержит как минимум одну проблему, которую
  реалистично поймает и Claude, и Codex (например, явно оставленный
  `TODO`/несогласованность между документами), чтобы проверить сосуществование
  двух подписанных замечаний по одному и тому же поводу.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить ревью артефакта с `reviewers.<ключ>: both` | Framework выполняет оба ревью независимо — Claude-сабагент и цепочку §4 для Codex |
| 2 | Дождаться завершения обоих ревью | Оба набора замечаний получены без ошибок |
| 3 | Проверить итоговый агрегированный список | Замечания объединены в один список, каждое подписано источником (`[Claude]` или `[Codex]`), группировка по P0/P1/P2 сохранена |
| 4 | Найти случай расхождения оценки (если оба ревьюера прокомментировали одно и то же место по-разному) | Оба замечания присутствуют в списке как есть; framework не выбирает «победителя» и не удаляет ни одно из них |
| 5 | Пройти диалог гейта (Fix now / I'll fix manually / Skip and continue) | Все три опции доступны как обычно (для документов) вне зависимости от того, что ревьюеров два |

**Test Data:**
- `docs/issues/open/<test-issue-id>/prompt.md` (`reviewers.specs: both`)
- `docs/issues/open/<test-issue-id>/specs.md` (документ с намеренно оставленной проблемой, ловимой обоими ревьюерами)

**Expected Outcome:** Пользователь получает единый список замечаний с
источником у каждого пункта, без автоматического разрешения противоречий
между Claude и Codex.

**Priority:** High

---

### TC-007: Нормализация severity Codex → приоритеты P0/P1/P2

**Description:** Статическая проверка того, что соответствие severity
Codex-ответа (`critical`/`high` → P0, `medium` → P1, `low` → P2) 
документировано согласованно в `pf-check` и `pf-codereview`, и что оба
скилла ссылаются на одно и то же сопоставление, а не переопределяют его
независимо.

**Preconditions:**
- Репозиторий содержит обновлённые `skills/pf-check/SKILL.md` и
  `skills/pf-codereview/SKILL.md`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Найти в `skills/pf-check/SKILL.md` описание сопоставления severity → приоритет | Присутствуют все три соответствия: critical/high → P0, medium → P1, low → P2 |
| 2 | Найти аналогичное описание в `skills/pf-codereview/SKILL.md` | Сопоставление то же самое (те же три пары), не переопределено иначе |
| 3 | Проверить упоминание, что сырой (неструктурированный) ответ `codex exec` не подвергается этому сопоставлению | Явно указано, что несхемный ответ показывается как есть, отдельным блоком, без приписывания P0/P1/P2 |

**Test Data:**
- `skills/pf-check/SKILL.md`
- `skills/pf-codereview/SKILL.md`

**Expected Outcome:** Оба скилла согласованно документируют одно и то же
сопоставление severity → приоритет, без расхождений между документом и
кодом.

**Priority:** Medium

---

### TC-008: `pf-codereview` — жёсткий гейт без «Skip and continue» при открытых P0/P1

**Description:** Проверяет ключевое отличие `pf-codereview` от `pf-check`
(BRD §Business Rules «Новый шаг ревью кода», specs.md §6): пока остаётся хотя
бы одно открытое P0/P1-замечание, опция «Skip and continue» недоступна —
только «Fix now» и «I'll fix manually, then re-run /pf-codereview».

**Preconditions:**
- Issue дошёл до стадии IMPLEMENT, `implementation_plan.md` complete
  (все задачи отмечены выполненными).
- Diff issue-ветки относительно родительской ветки содержит как минимум одну
  проблему уровня P0 или P1, которую поймает назначенный ревьюер.
- `reviewers.code` в `prompt.md` установлен (например, `claude`).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-codereview` | Скилл проверяет, что `implementation_plan.md` complete; вычисляет `git diff <parent>...HEAD` тем же способом, что `/pf-close` |
| 2 | Дождаться результатов ревью с намеренно оставленным P0/P1-замечанием | `code_review.md` создан с `verdict: FAIL`, замечание сгруппировано по приоритету |
| 3 | Открыть диалог выбора действия | Доступны только «Fix now» и «I'll fix manually, then re-run /pf-codereview» — «Skip and continue» отсутствует как опция |
| 4 | Выбрать «Fix now» | Диспетчеризуется Claude fix-сабагент, правит diff, ревью перезапускается автоматически |
| 5 | Убедиться, что после исправления не остаётся P0/P1 | `code_review.md` обновляется до `verdict: PASS`, цикл завершается |

**Test Data:**
- `docs/issues/open/<test-issue-id>/implementation_plan.md` (все задачи отмечены выполненными)
- diff issue-ветки, намеренно содержащий P0/P1-проблему (например, небезопасную обработку ошибок в изменённом файле реализации)

**Expected Outcome:** `pf-codereview` не позволяет пропустить открытые
P0/P1-замечания без исправления; цикл «Fix now» → повторное ревью повторяется
до `verdict: PASS`.

**Priority:** Critical

---

### TC-009: `/pf-test` блокируется без `code_review.md` с `verdict: PASS`

**Description:** Проверяет новое предусловие `/pf-test` (specs.md §6,
по аналогии с уже существующей проверкой `test_plan.md`): скилл должен
отказаться стартовать, если `code_review.md` отсутствует или имеет
`verdict: FAIL`.

**Preconditions:**
- Issue дошёл до стадии TESTING по document-пайплайну (test_plan.md готов),
  но `pf-codereview` ещё не запускался — либо запускался и оставил
  `verdict: FAIL`.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Убедиться, что `docs/issues/open/<ISSUE-ID>/code_review.md` отсутствует | Файл действительно отсутствует |
| 2 | Запустить `/pf-test` | Скилл останавливается с сообщением «code_review.md (PASS) is required. Run /pf-codereview first.» (или эквивалент на `doc_language` issue) |
| 3 | Создать `code_review.md` с `verdict: FAIL` (сымитировать незавершённый цикл `pf-codereview`) | — |
| 4 | Запустить `/pf-test` повторно | Скилл снова останавливается с тем же (или эквивалентным) сообщением — `verdict: FAIL` не считается выполненным предусловием |
| 5 | Заменить `code_review.md` на версию с `verdict: PASS` | — |
| 6 | Запустить `/pf-test` ещё раз | Скилл проходит проверку предусловия и продолжает штатный запуск тестов |

**Test Data:**
- `docs/issues/open/<test-issue-id>/test_plan.md` (готовый документ со Status Tracker)
- `docs/issues/open/<test-issue-id>/code_review.md` — вариант A: `verdict: FAIL`
- `docs/issues/open/<test-issue-id>/code_review.md` — вариант B: `verdict: PASS`

**Expected Outcome:** `/pf-test` стартует тестирование только тогда, когда
`code_review.md` существует и содержит `verdict: PASS`; во всех остальных
случаях — явная остановка с понятным сообщением.

**Priority:** Critical

---

### TC-010: Обратная совместимость — стадия код-ревью не ломает существующие issue и все тиры

**Description:** Проверяет, что добавление стадии `pf-codereview` в таблицу
пайплайнов (specs.md §8) не ломает уже открытые «старые» issue (созданные до
фичи, без `reviewers` и без концепции `code_review.md`) и применяется
одинаково ко всем тирам, включая `trivial`, где документный пайплайн
свёрнут в `notes.md`.

**Preconditions:**
- Существующий issue без `reviewers` в `prompt.md`, дошедший до конца
  IMPLEMENT (implementation_plan.md complete) ещё до появления этой фичи.
- Отдельный тестовый issue с `size_tier: trivial`, дошедший до конца
  IMPLEMENT (в `notes.md` отмечены выполненными все задачи).

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf` на «старом» issue без `reviewers`, сразу после завершения IMPLEMENT | `/pf` показывает следующим шагом `/pf-codereview` (а не сразу `/pf-test`), несмотря на отсутствие поля `reviewers` — используется дефолт `claude` |
| 2 | Пройти `pf-codereview` до `verdict: PASS` | Стадия проходит так же, как для issue с явно заданным `reviewers.code: claude` |
| 3 | Запустить `/pf` на `trivial`-issue сразу после завершения задач в `notes.md` | Следующим шагом также предложен `/pf-codereview`, несмотря на то что документный пайплайн у trivial свёрнут в `notes.md` |
| 4 | Пройти `pf-codereview` до `verdict: PASS` на trivial-issue | Стадия проходит независимо от тира документов — код-ревью не сокращается под бюджет tier |

**Test Data:**
- `docs/issues/open/<legacy-test-issue-id>/prompt.md` (без ключа `reviewers`, `implementation_plan.md` complete)
- `docs/issues/open/<trivial-test-issue-id>/prompt.md` (`size_tier: trivial`, `notes.md` complete)

**Expected Outcome:** Стадия `pf-codereview` появляется в роутинге `/pf` для
любого issue, независимо от наличия `reviewers` и от тира, и не нарушает
работу уже существующих issue.

**Priority:** High

---

## Step 3: Organize by Category

### Configuration/Frontmatter
- TC-001: Гарда назначения ревьюеров при создании issue

### Backward Compatibility
- TC-002: Отсутствие поля `reviewers` — дефолт `claude`
- TC-010: Стадия код-ревью не ломает существующие issue и все тиры

### Codex Invocation & Fallback
- TC-003: Плагин доступен и CLI готов — happy path

(TC-004/TC-005 из предыдущей версии плана — недоступность Codex и
fallback на прямой `codex exec` — удалены: единственная доступная машина
не позволяет управляемо создавать состояние «Codex недоступен» без порчи
реального рабочего окружения. Логика реализована по specs.md §4, но не
покрыта тест-планом.)

### Document Review (pf-check)
- TC-006: `both` — агрегация замечаний без арбитража
- TC-007: Нормализация severity Codex → P0/P1/P2

### Code Review Gate (pf-codereview)
- TC-008: Жёсткий гейт без «Skip and continue» при открытых P0/P1
- TC-009: `/pf-test` блокируется без `code_review.md` с `verdict: PASS`

---

## Step 4: Create Status Tracker

## Status Tracker

| TC     | Test Case | Type   | Priority | Status | Remarks |
| ------ | --------- | ------ | -------- | ------ | ------- |
| TC-001 | Гарда назначения ревьюеров при создании issue | Manual | Critical | [ ] | |
| TC-002 | Отсутствие поля `reviewers` — дефолт `claude` | Manual | Critical | [ ] | |
| TC-003 | Плагин доступен и CLI готов — happy path | Manual | High | [ ] | |
| TC-006 | `both` — агрегация замечаний без арбитража | Manual | High | [ ] | |
| TC-007 | Нормализация severity Codex → P0/P1/P2 | Auto | Medium | [ ] | |
| TC-008 | Жёсткий гейт без «Skip and continue» при открытых P0/P1 | Manual | Critical | [ ] | |
| TC-009 | `/pf-test` блокируется без `code_review.md` с `verdict: PASS` | Manual | Critical | [ ] | |
| TC-010 | Стадия код-ревью не ломает существующие issue и все тиры | Manual | High | [ ] | |
