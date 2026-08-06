# Test Plan: 20260715-bug-gates-verification-and-tooling-fixes

## Overview & Objectives

Этот тест-план покрывает четыре находки `analysis.md`, но тест-кейсами
закрывает только три из них: (1) верификация уже сделанной починки входных гейтов
`/pf-impl-plan` и `/pf-execute` («mechanical check, not memory»); (3) два
дефекта парсинга Manual Test UI (`tools/manual-test-ui/lib/checklist.js`) —
экранированный пайп `\|` и потеря не-TC секций; (4) проброс `--yes` в
`make converge`. Находка 2 (детект родительской ветки в `/pf-close` Phase 3)
проверена на текущем `develop` и оказалась уже закрыта отдельным issue —
подробности и причина, по которой у неё нет тест-кейсов здесь, приведены в
примечании после TC-003.

Цель — доказать пункты «Условия приёмки» находок 1, 3 и 4 из `analysis.md`
(условие по находке 2 закрыто чужим issue и его собственным регресс-тестом,
см. примечание ниже): статика для того, что можно проверить
грепом/юнит-тестом, и минимум ручных прогонов там, где нужна живая сессия
Claude Code (Находка 1 — единственная, где статика в принципе не может
доказать, что модель *подчиняется* инструкции, а не просто что инструкция
записана).

## Prerequisites

- Рабочая копия `planning-framework` на ветке issue, чистое дерево.
- Bash-тесты запускаются из `test/*.sh` (harness — `test/lib.sh`); node-тесты
  UI — из `tools/manual-test-ui/test/*.test.js`. Единая точка входа —
  `make test` (гоняет `test/*.sh` + `node --test`); node-тесты Manual Test UI
  запускаются отдельно: `node --test tools/manual-test-ui/test/*.test.js`.
- Для Manual-кейсов (Находка 1): мигрированный issue-каталог — копия
  закрытого `20260713-bug-v2-to-v3-migration-defects` во временной
  ветке/worktree, не трогать реальный открытый issue — и рабочая сессия
  Claude Code с установленными скилами (`~/.claude/skills/pf-impl-plan`,
  `pf-execute`, `pf-autopilot`). Точное состояние копии (какие файлы должны
  быть на месте, какие удалены, `size_tier`) различается между TC-002 и
  TC-003 — см. Preconditions каждого кейса, не полагаться на это резюме.

## Test Cases

### TC-001: Статические гейты Находки 1 остаются на месте (регресс-стража)
**Description:** Находка 1 — верификация уже сделанной починки. Раздел
«MECHANICAL check, never a memory exercise» в `pf-size-tiers/SKILL.md` и
фраза «Run the check, do not recall it» + явный вызов
`ls -1 docs/issues/open/` в `pf-impl-plan/SKILL.md` и `pf-execute/SKILL.md`
не должны исчезнуть или ослабнуть — это единственное, что автотест способен
подтвердить про эту находку (сама живая обязательность гейта проверяется
только в TC-002/TC-003).
**Preconditions:** Репозиторий на текущем `develop`/issue-ветке.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `bash test/skills-static.sh`. | Скрипт завершается с exit 0 (все проверки, включая раздел «TC-048 (static): input gates mandate a mechanical check», зелёные). |
| 2 | `grep -qiE 'MECHANICAL check, never a memory exercise' skills/pf-size-tiers/SKILL.md`. | Совпадение найдено (exit 0). |
| 3 | Для `skills/pf-impl-plan/SKILL.md` и `skills/pf-execute/SKILL.md`: `grep -qiE 'Run the check, do not recall it'` и `grep -qF 'ls -1 docs/issues/open/'`. | Оба совпадения найдены в обоих файлах. |
**Expected Outcome:** Принуждение к механической проверке зафиксировано в коде и не потеряно последующими правками этого issue.
**Priority:** High

### TC-002: `/pf-impl-plan` и `/pf-execute` отказывают при удалённом предусловии (живой прогон)
**Description:** Реальная суть Находки 1 — гейт должен работать, а не просто существовать в прозе. Проверяется в живой сессии Claude Code: удалённый файл всё ещё может лежать в контексте модели, и только принудительный вызов `ls -1` на диске спасает от суждения «по памяти».
**Preconditions:** Мигрированный issue-каталог (копия, не рабочий open-issue) с полными `test_plan.md` и `implementation_plan.md`; сессия уже читала оба файла ранее (чтобы был риск суждения по памяти).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Удалить `test_plan.md` из issue-каталога (`rm`), не сообщая об этом модели явно. | Файл отсутствует на диске. |
| 2 | Вызвать `/pf-impl-plan` в этой же сессии. | Скил останавливается: «Test plan is required. Run /pf-test-plan first.» — не продолжает генерацию implementation_plan.md по памяти. |
| 3 | Восстановить `test_plan.md`, удалить `implementation_plan.md`. | Файл отсутствует на диске. |
| 4 | Вызвать `/pf-execute` в той же сессии. | Скил останавливается: «Implementation plan is required. Run /pf-impl-plan first.» — не приступает к исполнению. |
**Expected Outcome:** Оба гейта отказывают по факту отсутствия файла на диске, а не судят по копии в контексте модели.
**Priority:** Critical

### TC-003: Тот же живой гейт-тест под `/pf-autopilot`
**Description:** `/pf-autopilot` гонит issue к `/pf-close` автономно, без человека у экрана — сценарий, где гейт «по памяти» опаснее всего (analysis.md, «Повышенная актуальность»). Нужно убедиться, что при вызове `/pf-impl-plan`/`/pf-execute` из-под автопилотного рабочего цикла (`skills/pf-autopilot/SKILL.md`, Step 2.1) эти скилы **реально отказывают** по факту отсутствия файла на диске, а не просто что автопилот "случайно" никогда не попадает в ситуацию, где гейт мог бы сработать. Файл удаляется **после** того, как `/pf` уже назвал следующей стадией именно IMPL_PLAN/EXECUTE — то есть в узком окне, где маршрутизация уже "решила" вызвать нужный скил, и единственное, что может поймать отсутствующий файл — собственный `ls -1` этого скила, а не повторная оценка `/pf`. Если удалить файл раньше (до того как `/pf` определит следующую стадию), тест ничего не докажет: `/pf` просто перенаправит на предыдущую стадию, и `/pf-impl-plan`/`/pf-execute` не будут вызваны вовсе — этого недостаточно для проверки их собственного гейта.
**Preconditions:**
- Копия закрытого `20260713-bug-v2-to-v3-migration-defects` во временной ветке/worktree (**не** реальный открытый issue этого репозитория). Этот closed issue уже содержит `implementation_plan.md` (это была большая, `size_tier: large` задача) — перед началом теста **удалить** `implementation_plan.md` из копии, чтобы она стартовала в состоянии «TEST_PLAN готов, IMPL_PLAN ещё нет», как и в TC-002.
- В копии `prompt.md`'s frontmatter отредактирован на `size_tier: small` (единственная причина — держать реальный прогон `/pf-impl-plan` на шаге 5 дешёвым; на сам гейт тип тира не влияет).
- Нет активного cron-задания `pf-autopilot-<project-копии>` для этой копии (`CronList`; если есть — `CronDelete` перед началом).
- Сессия Claude Code с установленным `~/.claude/skills/pf-autopilot` и доступом к `CronList`/`CronDelete`; тестировщик у экрана в момент запуска (нужно успеть вмешаться между двумя сообщениями модели — см. шаги 2-3).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `/pf-autopilot <ISSUE-ID>` в этой копии. Дать выполниться Step 0 (пиннинг ID) и Step 1 (создание safety-net cron-расписания), затем — первому под-шагу Step 2.1: вызову `/pf`. | Ответ сессии называет следующей стадией IMPL_PLAN (`test_plan.md` полон, `implementation_plan.md` отсутствует) — это последнее сообщение перед тем, как сессия перейдёт к вызову `/pf-impl-plan`. |
| 2 | Сразу после этого сообщения, до того как модель продолжит и вызовет `/pf-impl-plan`, удалить `test_plan.md` из каталога копии (`rm docs/issues/open/<ISSUE-ID>/test_plan.md`). | Файл отсутствует на диске; `/pf` уже принял решение вызвать `/pf-impl-plan` и не переоценивает его заново. |
| 3 | Дать сессии продолжить — она вызывает `/pf-impl-plan`, как и определил `/pf` на шаге 1. | Скил останавливается с точным текстом `"Test plan is required. Run /pf-test-plan first."` (дословно из `skills/pf-impl-plan/SKILL.md`); `implementation_plan.md` не создаётся. |
| 4 | `ls -1 docs/issues/open/<ISSUE-ID>/`. | `implementation_plan.md` в выводе отсутствует. |
| 5 | Восстановить `test_plan.md` (`git checkout -- docs/issues/open/<ISSUE-ID>/test_plan.md` в ветке копии) и дать автопилоту обычным порядком (реальный прогон `/pf-impl-plan`) дойти до создания `implementation_plan.md`. | `implementation_plan.md` появляется на диске, стадия IMPL_PLAN завершена. |
| 6 | Дать сессии дойти до начала следующей итерации Step 2 — очередного вызова `/pf`. | Ответ называет следующей стадией EXECUTE (`implementation_plan.md` теперь полон) — снова последнее сообщение перед вызовом `/pf-execute`. |
| 7 | Сразу после этого сообщения, до вызова `/pf-execute`, удалить `implementation_plan.md` (`rm docs/issues/open/<ISSUE-ID>/implementation_plan.md`). | Файл отсутствует на диске; `/pf` уже принял решение вызвать `/pf-execute`. |
| 8 | Дать сессии продолжить — она вызывает `/pf-execute`. | Скил останавливается с точным текстом `"Implementation plan is required. Run /pf-impl-plan first."` (дословно из `skills/pf-execute/SKILL.md`); ветка `issue/<ISSUE-ID>` не создаётся, код не исполняется. |
| 9 | Дописать в `docs/issues/open/<ISSUE-ID>/session-log.md` (в копии) короткую запись с дословными текстами отказов из шагов 3 и 8. | Запись сделана — наблюдение остаётся проверяемым позже, а не только в транскрипте сессии. |
| 10 | Восстановить `implementation_plan.md` (`git checkout --`), удалить cron-расписание (`CronDelete pf-autopilot-<project-копии>`). | Копия и окружение возвращены в исходное состояние, cron-задание не осталось висеть. |
**Expected Outcome:** Когда `/pf-impl-plan`/`/pf-execute` вызываются автопилотом уже после того, как `/pf` определил их следующей стадией, оба скила всё равно отказывают по собственной свежей проверке диска (`ls -1`), а не доверяют устаревшему решению `/pf` — то есть автопилот не создаёт «дыру» в гейте, унаследованном от TC-002.
**Stop-критерий (pass/fail):** pass ⇔ на шагах 3 и 8 получены дословные отказы, `implementation_plan.md` отсутствовал после шага 4, код не исполнялся после шага 8, запись в `session-log.md` сделана; fail ⇔ `/pf-impl-plan` или `/pf-execute` всё же продолжили (создали план/начали исполнение) несмотря на удалённый файл. Если тестировщик не успел удалить файл до того, как модель уже вызвала следующий скил (упущено окно между шагами 1-2 или 6-7) — результат не засчитывается ни как pass, ни как fail, шаг повторяется.
**Priority:** High

> **Находка 2 не имеет тест-кейсов в этом тест-плане.** Перепроверено на текущем `develop` дважды (независимо, включая ревью Codex): баг из Находки 2 уже исправлен закрытым issue `docs/issues/closed/20260729-bug-pf-close-parent-branch-and-usage-window/`. Принятый фикс — «Self-tracking upstream guard» в `skills/pf-close/SKILL.md` Phase 3 (`:58-63`): скил по-прежнему читает `git config branch.issue/ISSUE-ID.merge`, но игнорирует результат, если тот равен `refs/heads/issue/ISSUE-ID` (само-отслеживание после `push -u`), и тогда падает в фолбэк на `develop`/`main`. Это **не** подход через `git merge-base --is-ancestor`, который предполагали более ранние черновики этого тест-плана (бывшие TC-004/TC-005/TC-006 — удалены отсюда). Регресс-покрытие принятого фикса уже существует в `test/pf-close.sh:147-149` (проверяет, что Phase 3 документирует именно «Self-tracking upstream guard»); дублировать его здесь как ещё один тест-кейс чужого закрытого issue не нужно.

### TC-007: Экранированный `\|` в ячейке таблицы парсится как один литеральный пайп (авто)
**Description:** Находка 3a — `splitCells()` в `tools/manual-test-ui/lib/checklist.js` (`:39-47`) должна распознавать GFM-экранирование `\|` внутри ячейки и не разбивать её на две. Новый регресс-тест: `tools/manual-test-ui/test/checklist-escaped-pipe.test.js`, тот же плоский стиль (top-level `assert`, без `describe`/`it`), что и `checklist-ru.test.js`.
**Preconditions:** Node — версия, поддерживаемая проектом. Файл `tools/manual-test-ui/test/checklist-escaped-pipe.test.js` создан (это часть реализации фикса, не предусловие среды).
**Fixture (`ESCAPED_PIPE_FIXTURE`, содержимое `.md`, ровно как передаётся в `parseChecklist()`):**
```
## TC-001: Экранированный пайп в ячейке

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | `ls ~/.claude/skills/ \| wc -l` | Output is a number | [ ] |

**Notes:**
```
**Ожидаемое значение Action-ячейки после фикса (`EXPECTED_ACTION`, литерал, не пересчитывается из строки документа):**
```
const EXPECTED_ACTION = "`ls ~/.claude/skills/ | wc -l`";
```
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `node tools/manual-test-ui/test/checklist-escaped-pipe.test.js` (и/или `node --test tools/manual-test-ui/test/checklist-escaped-pipe.test.js`, тот же способ, каким `make test` гоняет весь каталог) над фикстурой выше через `parseChecklist(ESCAPED_PIPE_FIXTURE)`. | Скрипт завершается без исключения (exit 0). |
| 2 | `assert.strictEqual(parsed.tcs.length, 1)` и `assert.strictEqual(parsed.tcs[0].steps.length, 1)`. | Оба равенства выполняются — экранированный пайп из Action не породил лишнюю строку/колонку. |
| 3 | `assert.strictEqual(parsed.tcs[0].steps[0].action, EXPECTED_ACTION)` (литерал выше). | Совпадает. |
| 4 | `assert.strictEqual(parsed.tcs[0].steps[0].expected, "Output is a number")`. | Совпадает — колонка Expected Result не содержит хвоста от Action (сегодня, до фикса, здесь оказался бы обрывок команды после пайпа). |
| 5 | `assert.strictEqual(parsed.tcs[0].steps[0].checked, false)` (колонка Result — пустой чекбокс, а не съехавшее значение из Action/Expected). | Совпадает. |
| 6 | `assert.strictEqual(parsed.tcs[0].parseWarnings.length, 0)`. | Совпадает. |
**Expected Outcome:** `\|` внутри ячейки таблицы парсится как один литеральный пайп внутри одной ячейки; тест написан по правилу «сначала падающий тест» — до фикса `splitCells()` шаги 3-4 (и обычно 2) проваливаются, после фикса — все шесть проходят. Фикс обязан раскрывать `\|` в литеральный `|` уже на разборе (`EXPECTED_ACTION` — с раскрытым пайпом, не с оставленным экранированием) — это тот же литерал, что использует TC-010 для проверки обратной записи; выбор другой формы (оставить `\|` неразвёрнутым) провалит оба кейса не из-за бага, а из-за расхождения с зафиксированным здесь контрактом.
**Priority:** High

### TC-008: Не-TC секция между двумя TC-блоками не теряется молча (авто)
**Description:** Находка 3b (уточнение после `/pf-check`) — сейчас контент не-`## TC-NNN` секции между двумя TC-блоками теряется из разбора целиком (`parseChecklist()`, цикл `for (; i < lines.length && !TC_HEADING_RE.test(...); i++)` и разбор тела TC в `:63-184`): не попадает ни в `meta`, ни в `prerequisites`/`notes` предыдущего TC, `parseWarnings` при этом пуст. Регресс-тест расширяет `tools/manual-test-ui/test/checklist-ru.test.js` (уже проверяет русские секции) новым блоком фикстуры/утверждений в конце того же файла.
**Preconditions:** Node — версия, поддерживаемая проектом.
**Fixture (`LOST_SECTION_FIXTURE`, добавляется в `checklist-ru.test.js`):**
```
## TC-001: Первый кейс

**Notes:**

## Общая подготовка

Маркер: SECTION-MARKER-3b7f2c

## TC-002: Второй кейс

**Notes:**
```
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `node tools/manual-test-ui/test/checklist-ru.test.js` (и/или `node --test tools/manual-test-ui/test/checklist-ru.test.js`) над фикстурой выше через `const parsed = parseChecklist(LOST_SECTION_FIXTURE)`. | Скрипт завершается без исключения. |
| 2 | `assert.strictEqual(parsed.tcs.length, 2)` — распознаны только TC-001 и TC-002. | Совпадает. |
| 3 | `assert.ok(JSON.stringify(parsed).includes("SECTION-MARKER-3b7f2c"), "маркер секции «Общая подготовка» потерян при разборе")`. | Маркер найден где-то в возвращённой структуре (новое поле для не-TC секций, либо `parseWarnings`/`notesText` TC-001 — реализация выбирает форму, тест проверяет только факт непотери). |
**Expected Outcome:** Тест написан по правилу «сначала падающий тест» — до фикса шаг 3 проваливается (маркер отсутствует и в `tcs`, и в `parseWarnings`, что и есть сегодняшняя полная потеря); после фикса — проходит, независимо от того, получила ли не-TC секция собственное поле или хотя бы попала в `parseWarnings`/`notesText` соседнего TC.
**Priority:** Medium

### TC-009: `make converge ... YES=1` пробрасывает `--yes`, без `YES` — нет (авто)
**Description:** Находка 4 — цель `converge` в `Makefile` должна пробрасывать `--yes` в `scripts/converge-to-v3.sh`, когда задан `YES=1`, и не добавлять флаг без него (иначе `make converge` без `YES` перестанет быть интерактивным по умолчанию).
**Preconditions:** Репозиторий на ветке issue; `make -n` (dry-run) не выполняет скрипт по-настоящему.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `make -n converge TARGET=/tmp/x YES=1`. | Печатаемая команда содержит `bash scripts/converge-to-v3.sh --target /tmp/x --yes` (или эквивалентный порядок флагов, но `--yes` присутствует). |
| 2 | `make -n converge TARGET=/tmp/x`. | Печатаемая команда НЕ содержит `--yes`. |
**Expected Outcome:** `--yes` пробрасывается ровно тогда, когда задан `YES=1`/`YES=<непустое>`; поведение по умолчанию (интерактивный запрос) не сломано.
**Priority:** High

### TC-010: Патч результата шага не портит экранированный пайп при перезаписи (авто)
**Description:** Побочный риск фикса Находки 3a — если `\|` при парсинге раскрывается в литеральный `|`, а `patchStepResult()` (`checklist.js:209-225`) перезаписывает строку через `cells.join(" | ")` без обратного экранирования, первая же отметка чекбокса тестировщиком в UI перезапишет ячейку с сырым нескрытым `|` — и следующий разбор того же файла снова словит баг Находки 3a на уже, казалось бы, исправленном файле. TC-007 это не ловит, так как не патчит и не перечитывает.
**Preconditions:** Тот же файл `checklist-escaped-pipe.test.js` (или `checklist-patch.test.js`, где уже есть тесты `patchStepResult()` — оба варианта приемлемы, тест-план не предписывает который).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Взять `ESCAPED_PIPE_FIXTURE` из TC-007. Вызвать `const patched = patchStepResult(ESCAPED_PIPE_FIXTURE, "TC-001", 1, { checked: true, note: "" })`. | Вызов не бросает исключение. |
| 2 | Заново разобрать результат: `const reparsed = parseChecklist(patched)`. | Разбор не падает. |
| 3 | `assert.strictEqual(reparsed.tcs[0].steps.length, 1)`. | Строка после патча всё ещё разбирается как один шаг — не расползлась на лишние ячейки. |
| 4 | `assert.strictEqual(reparsed.tcs[0].steps[0].action, EXPECTED_ACTION)` (тот же литерал, что в TC-007). | Совпадает — Action-ячейка не искажена перезаписью Result-ячейки. |
| 5 | `assert.strictEqual(reparsed.tcs[0].steps[0].checked, true)`. | Патч применился к нужному шагу. |
**Expected Outcome:** Круговой цикл «разобрать → пропатчить один шаг → разобрать снова» не портит соседнюю ячейку с экранированным пайпом.
**Priority:** Medium

> **`make help` (документация `YES=`) намеренно не покрыта отдельным тест-кейсом.** Это регресс-покрытие для `Makefile`'s `help:` (документация формы `make converge TARGET=<path> YES=1`), вторично по отношению к TC-009, которая уже закрывает условие приёмки Находки 4 (сам проброс `--yes`). Бюджет `size_tier: small` — не более 10 кейсов; кейс на строку в `help:` вытеснен как второстепенный.

## Status Tracker

| TC     | Test Case                                                                 | Type   | Priority | Status | Remarks |
|--------|----------------------------------------------------------------------------|--------|----------|--------|---------|
| TC-001 | Статические гейты Находки 1 остаются на месте (регресс-стража)             | Auto   | High     | [ ]    |         |
| TC-002 | `/pf-impl-plan`/`/pf-execute` отказывают при удалённом предусловии          | Manual | Critical | [ ]    |         |
| TC-003 | Тот же живой гейт-тест под `/pf-autopilot`                                  | Manual | High     | [ ]    |         |
| TC-007 | Экранированный `\|` в ячейке таблицы парсится как один литеральный пайп     | Auto   | High     | [ ]    |         |
| TC-008 | Не-TC секция между двумя TC-блоками не теряется молча                      | Auto   | Medium   | [ ]    |         |
| TC-009 | `make converge ... YES=1` пробрасывает `--yes`, без `YES` — нет             | Auto   | High     | [ ]    |         |
| TC-010 | Патч результата шага не портит экранированный пайп при перезаписи          | Auto   | Medium   | [ ]    |         |
