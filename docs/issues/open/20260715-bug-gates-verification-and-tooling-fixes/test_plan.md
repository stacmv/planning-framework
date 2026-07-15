# Test Plan: 20260715-bug-gates-verification-and-tooling-fixes

## Overview & Objectives

Этот тест-план покрывает четыре находки `analysis.md`: (1) верификация уже
сделанной починки входных гейтов `/pf-impl-plan` и `/pf-execute`
(«mechanical check, not memory»); (2) починка детекта родительской ветки в
`/pf-close` Phase 3 (upstream ≠ родитель); (3) два дефекта парсинга Manual
Test UI (`tools/manual-test-ui/lib/checklist.js`) — экранированный пайп `\|`
и потеря не-TC секций; (4) проброс `--yes` в `make converge`.

Цель — доказать все четыре пункта «Условия приёмки» из `analysis.md`:
статика для того, что можно проверить грепом/юнит-тестом, и минимум ручных
прогонов там, где нужна живая сессия Claude Code (Находка 1 — единственная,
где статика в принципе не может доказать, что модель *подчиняется*
инструкции, а не просто что инструкция записана).

## Prerequisites

- Рабочая копия `planning-framework` на ветке issue, чистое дерево.
- Bash-тесты запускаются из `test/*.sh` (harness — `test/lib.sh`); node-тесты
  UI — из `tools/manual-test-ui/test/*.test.js`. Единая точка входа —
  `make test` (гоняет `test/*.sh` + `node --test`); node-тесты Manual Test UI
  запускаются отдельно: `node --test tools/manual-test-ui/test/*.test.js`.
- Для Manual-кейсов (Находка 1): мигрированный issue-каталог с валидными
  `test_plan.md` и `implementation_plan.md` (например копия закрытого
  `20260713-bug-v2-to-v3-migration-defects` во временной ветке — не трогать
  реальный открытый issue) и рабочая сессия Claude Code с установленными
  скилами (`~/.claude/skills/pf-impl-plan`, `pf-execute`, `pf-autopilot`).

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
**Description:** `/pf-autopilot` гонит issue к `/pf-close` автономно, без человека у экрана — сценарий, где гейт «по памяти» опаснее всего (analysis.md, «Повышенная актуальность»). Нужно убедиться, что автопилотный рабочий цикл (`skills/pf-autopilot/SKILL.md`, Step 2) действительно вызывает `/pf-impl-plan`/`/pf-execute` как обычные скилы и наследует их отказ, а не обходит гейт.
**Preconditions:** То же, что в TC-002, плюс `/pf-autopilot` запущен на этом issue (Step 0-1 пройдены, safety-net расписание создано).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Удалить `test_plan.md` из issue-каталога, находящегося под управлением `/pf-autopilot`. | Файл отсутствует на диске. |
| 2 | Дать автопилоту продолжить рабочий цикл (Step 2) до стадии IMPL_PLAN. | Автопилот вызывает `/pf-impl-plan`, получает отказ («Test plan is required…») и не продолжает как будто план создан. |
| 3 | Проверить отчёт/session-log автопилота. | Отказ отражён (например, автопилот останавливается или откатывается к `/pf-test-plan`), никакого implementation_plan.md не создано по памяти. |
**Expected Outcome:** Автопилот не создаёт «дыру» в гейте — отказ `/pf-impl-plan`/`/pf-execute` действует так же под автопилотом, как и в ручной сессии.
**Priority:** High

### TC-004: Детект родителя по `merge-base --is-ancestor`, не по upstream (авто)
**Description:** Находка 2 — воспроизводит баг и проверяет исправленную Phase 3 `pf-close/SKILL.md`: ветка issue, запушенная с `-u` (upstream указывает сама на себя), не должна определяться как собственный родитель.
**Preconditions:** Bash-тест в `test/` (по образцу `test/lib.sh`: временный git-репозиторий, свежий `mktemp -d`, не трогает реальный `$HOME`/репозиторий фреймворка — `assert_repo_untouched` в конце).
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | В свежем `git init` создать `develop` с одним коммитом, затем `issue/test-parent` от неё с ещё одним коммитом. | Обе ветки существуют, `issue/test-parent` — потомок `develop`. |
| 2 | Смоделировать `-u`-пуш на себя: `git config branch.issue/test-parent.merge refs/heads/issue/test-parent` (тот же эффект, что даёт реальный `push -u` в fake-remote схеме, где upstream ветки issue — она же сама). | `git config branch.issue/test-parent.merge` возвращает `refs/heads/issue/test-parent` — старое (сломанное) поведение подтверждено как воспроизводимое. |
| 3 | Выполнить новую логику детекта: перебрать `develop`, `main` и найти первую, для которой `git merge-base --is-ancestor <cand> HEAD` возвращает 0 на ветке `issue/test-parent`. | Возвращает `develop`, а не `issue/test-parent`. |
**Expected Outcome:** Детект родителя, реализованный по `merge-base --is-ancestor`, находит `develop`/`main`, никогда саму ветку issue, даже когда upstream указывает на себя.
**Priority:** Critical

### TC-005: `pf-close/SKILL.md` Phase 3 переписана на `merge-base`, не на `branch.*.merge` (авто/статика)
**Description:** Статическая проверка формы фикса Находки 2 — сам факт, что скил больше не предписывает читать `git config branch.<name>.merge` как способ найти родителя, а предписывает `git merge-base --is-ancestor`.
**Preconditions:** Репозиторий на ветке issue.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ограничить проверку разделом Phase 3 (чтобы остаться чисто булевой, без ручной развилки): `awk '/^## Phase 3/{f=1;next} /^## Phase 4/{f=0} f' skills/pf-close/SKILL.md` и в его выводе `grep -c 'branch.*\.merge'`. | `0` — Phase 3 больше не читает upstream (`branch.<name>.merge`) как источник родителя. |
| 2 | `grep -n 'merge-base --is-ancestor' skills/pf-close/SKILL.md`. | Найдена строка в разделе «Phase 3: Detect Parent Branch», перебирающая `develop`/`main` через `--is-ancestor`. |
**Expected Outcome:** Phase 3 в `pf-close/SKILL.md` детектит родителя через `merge-base --is-ancestor`, не через `branch.<name>.merge`.
**Priority:** Critical

### TC-006: `/pf-autopilot` не дублирует и не наследует сломанный детект родителя (авто/статика)
**Description:** analysis.md подтверждает грепом, что `/pf-autopilot` не содержит собственной логики детекта родителя — вызывает `/pf-close` как стадию пайплайна. Нужно убедиться, что фикс Находки 2 не потребовал (и не получил) дублирующей копии в `pf-autopilot/SKILL.md`, и что там не осталась старая формулировка.
**Preconditions:** Репозиторий на ветке issue.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Три ОТДЕЛЬНЫЕ проверки (без ERE-альтернации `\|` — это ровно тот `\|`, что чинит Находка 3, и в ERE он значит литеральный «пайп», а не «или»): `grep -c 'branch.*\.merge' skills/pf-autopilot/SKILL.md`, `grep -c 'merge-base' …`, `grep -c 'pf-parent' …`. | Все три возвращают `0` — в `pf-autopilot/SKILL.md` нет ни одной формы логики детекта родителя. |
| 2 | `grep -n '/pf-close' skills/pf-autopilot/SKILL.md`. | `/pf-close` упомянут как обычная стадия пайплайна (Step 2, «Work loop»), без встроенной альтернативной логики детекта. |
**Expected Outcome:** Единственный носитель логики детекта родителя — `pf-close/SKILL.md`; `/pf-autopilot` наследует фикс через вызов `/pf-close`, не копирует его.
**Priority:** Medium

### TC-007: Экранированный `\|` в ячейке таблицы парсится как один литеральный пайп (авто)
**Description:** Находка 3a — `splitCells()` в `tools/manual-test-ui/lib/checklist.js` должна распознавать GFM-экранирование `\|` внутри ячейки и не разбивать её на две. Регресс-тест расширяет `checklist-ru.test.js`.
**Preconditions:** Node ≥ версии, поддерживаемой проектом; тестовый файл в `tools/manual-test-ui/test/`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Собрать фикстуру с шагом таблицы, где Action содержит `` ls ~/.claude/skills/ \| wc -l `` (буквальный пайп, экранированный `\|`), и вызвать `parseChecklist()`. | Парсинг не падает и не создаёт лишних колонок. |
| 2 | Проверить `steps[i].action` этого шага. | Значение — `` ls ~/.claude/skills/ \| wc -l `` (либо с раскрытым `|`, но одной строкой, без разрыва на `\` и `wc -l` в разных ячейках) — колонка «Expected Result» не съезжает в «Result». |
| 3 | Проверить, что соседняя колонка «Expected Result»/«Ожидаемый результат» осталась на своём месте (`steps[i].expected` не содержит хвост от Action). | `expected` — именно ожидаемый результат, не обрывок команды. |
**Expected Outcome:** `\|` внутри ячейки таблицы больше не разваливает строку на лишние колонки.
**Priority:** High

### TC-008: Не-TC секция между двумя TC-блоками не теряется молча (авто)
**Description:** Находка 3b (уточнение после `/pf-check`) — сейчас контент не-`## TC-NNN` секции между двумя TC-блоками теряется из разбора целиком: не попадает ни в `meta`, ни в `prerequisites`/`notes` предыдущего TC, `parseWarnings` при этом пуст. Регресс-тест должен утверждать именно полную потерю сегодня (или её устранение после фикса) — не «попал в предыдущий TC».
**Preconditions:** Node-тест в `tools/manual-test-ui/test/`.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Собрать фикстуру: `## TC-001: ...` (полный блок), затем секция `## Общая подготовка` с уникальным маркерным текстом, затем `## TC-002: ...` (полный блок). Вызвать `parseChecklist()`. | Возвращает `{ meta, tcs, ... }` без исключений. |
| 2 | Убедиться, что `tcs.length === 2` (только TC-001 и TC-002 распознаны как TC). | Ровно 2 TC. |
| 3 | Проверить, что маркерный текст секции «Общая подготовка» присутствует где-то в результате разбора (например в новом поле для не-TC секций, либо в `parseWarnings`/`notes` TC-001) — то есть контент **не потерян полностью**. | Маркерный текст найден в возвращаемой структуре; тест фейлится, если он отсутствует и там, и там (сегодняшнее поведение — полная потеря — до фикса). |
**Expected Outcome:** После фикса не-TC секция либо сохраняется отдельно, либо хотя бы не пропадает бесследно — тест ловит регресс к сегодняшнему «тихому и полному» исчезновению.
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

### TC-010: `make help` документирует форму `YES=` (авто)
**Description:** По итогам `/pf-check` (analysis.md, Находка 4) — блок `help:` должен приобрести строку про `make converge TARGET=<path> YES=1`, по прецеденту парных строк `make tui`/`make tui TARGET=<path>`.
**Preconditions:** Репозиторий на ветке issue.
**Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Захватить вывод в переменную (без пайпа в ячейке — это и есть урок Находки 3): `out=$(make help)`; проверить, что `$out` содержит подстроку `YES=`. | В выводе `make help` есть строка, документирующая `make converge TARGET=<path> YES=1` (неинтерактивный запуск). |
| 2 | В том же `$out` — что есть строки про `make converge` (базовая и форма с `TARGET=`/`YES=1`). | Присутствуют обе строки, по аналогии с существующей парой строк `make tui`. |
**Expected Outcome:** `make help` перестаёт умалчивать про единственный способ запустить `converge` неинтерактивно.
**Priority:** Low

## Status Tracker

| TC     | Test Case                                                                 | Type   | Priority | Status | Remarks |
|--------|----------------------------------------------------------------------------|--------|----------|--------|---------|
| TC-001 | Статические гейты Находки 1 остаются на месте (регресс-стража)             | Auto   | High     | [ ]    |         |
| TC-002 | `/pf-impl-plan`/`/pf-execute` отказывают при удалённом предусловии          | Manual | Critical | [ ]    |         |
| TC-003 | Тот же живой гейт-тест под `/pf-autopilot`                                  | Manual | High     | [ ]    |         |
| TC-004 | Детект родителя по `merge-base --is-ancestor`, не по upstream               | Auto   | Critical | [ ]    |         |
| TC-005 | `pf-close/SKILL.md` Phase 3 переписана на `merge-base`                      | Auto   | Critical | [ ]    |         |
| TC-006 | `/pf-autopilot` не дублирует/не наследует сломанный детект родителя         | Auto   | Medium   | [ ]    |         |
| TC-007 | Экранированный `\|` в ячейке таблицы парсится как один литеральный пайп     | Auto   | High     | [ ]    |         |
| TC-008 | Не-TC секция между двумя TC-блоками не теряется молча                      | Auto   | Medium   | [ ]    |         |
| TC-009 | `make converge ... YES=1` пробрасывает `--yes`, без `YES` — нет             | Auto   | High     | [ ]    |         |
| TC-010 | `make help` документирует форму `YES=`                                      | Auto   | Low      | [ ]    |         |
