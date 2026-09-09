# Implementation Plan: Ускорение прогона `make test`

Задача: сократить полный прогон `make test` с ~23 мин до 5–7 мин на Windows 11 + Git Bash. Покрытие не уменьшается; `shellcheck` переносится в отдельную цель `make lint`.

## Files to Create/Modify

| File | Action |
|---|---|
| `test/lib.sh` | Modify `snapshot_tree` (measure 1), add `pf_repo_copy_reset` (measure 3) |
| `Makefile` | Add `lint` target (measure 2), parallel suite execution (measure 5) |
| `scripts/converge-to-v3.sh` | Fork diet in `t7_skills` and `t6_mirror_templates` (measure 4) |
| `test/docs-refs.sh` | Remove `shellcheck` invocation (measure 2) |
| `docs/issues/open/20260904-improve-test-suite-runtime/*.md` | Document environment hypothesis result (measure 6) |

---

## Task 1 — `snapshot_tree`: один конвейер вместо цикла с форками

**Task Type:** code
**Mapped Test Cases:** TC-006 (measure 1), TC-007 (existing invariants)
**Files:** `test/lib.sh`

**Implementation Notes:**
- Текущая реализация (`lib.sh:321-342`) запускает subshell + `sha256sum` + `cut` в цикле — ~3 форка на файл
- Замена: `find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum` — один конвейер, без subshell на каждый файл
- Для файлов с пробелами в именах используется `xargs -0 sha256sum <"$p"` (per-file, не парсинг вывода) — формат манифеста (префикс `f/d/l`, хеш) не меняется
- Других потребителей `snapshot_tree` нет

**Acceptance Criteria:**
- [x] `snapshot_tree` использует `xargs -0 sha256sum` для файлов, не запуская subshell на каждый файл
- [x] Формат манифеста (префикс `f/d/l`, хеш) не изменился
- [x] `make test` проходит, все `assert_tree_identical` зелёные

---

## Task 2 — `shellcheck` из `docs-refs.sh` в отдельную цель `make lint`

**Task Type:** code
**Mapped Test Cases:** TC-003, TC-004, TC-005, TC-006 (measure 2)
**Files:** `Makefile`, `test/docs-refs.sh`

**Implementation Notes:**
- В `Makefile` добавляется `.PHONY: lint` с вызовом `shellcheck scripts/*.sh test/*.sh`
- Если `shellcheck` недоступен — `make lint` завершается с ненулевым кодом (отличие от текущего `pf_note` в `docs-refs.sh`)
- `docs-refs.sh:220-231` удаляется; `shellcheck` из вызова убирается

**Acceptance Criteria:**
- [x] `make lint` существует и гоняет `shellcheck scripts/*.sh test/*.sh`
- [x] `make lint` завершается ошибкой, если `shellcheck` недоступен
- [x] `make test` больше не запускает `shellcheck`
- [x] `test/docs-refs.sh` не содержит вызова `shellcheck`

---

## Task 3 — Восстановление через `git checkout` вместо повторного `cp -a`

**Task Type:** code
**Mapped Test Cases:** TC-006 (measure 3), TC-007 (existing invariants)
**Files:** `test/lib.sh`, `test/pf-idea-semantic-mutations.sh`

**Implementation Notes:**
- В `test/lib.sh` добавляется `pf_repo_copy_reset`: `git -C "$copy" checkout -- . 2>/dev/null || true` + `git -C "$copy" clean -fdx -q 2>/dev/null || true` (~1-2 с vs 17 с полного `cp -a`)
- В `test/pf-idea-semantic-mutations.sh` первый вызов `pf_repo_copy` — полный `cp -a` (нужен свежий `.git`), последующие — `pf_repo_copy_reset`
- Проверяется `grep -rn 'pf_repo_copy' test/*.sh` на отсутствие других потребителей

**Acceptance Criteria:**
- [x] `pf_repo_copy_reset` создана в `test/lib.sh`
- [x] `test/pf-idea-semantic-mutations.sh` использует `pf_repo_copy` один раз, затем `pf_repo_copy_reset`
- [x] `make test` проходит, S-5 invariant не нарушен

---

## Task 4 — Форк-диета в `scripts/converge-to-v3.sh`

**Task Type:** code
**Mapped Test Cases:** TC-006 (measure 4), TC-007 (existing invariants)
**Files:** `scripts/converge-to-v3.sh`

**Implementation Notes:**
- `t7_skills`: вместо 21 пары `mkdir + cp -r` — один `cp -r "${SKILLS_SRC}"/*/ "$skills_dir/"`
- `t6_mirror_templates`: 18 файлов — батч `mkdir -p` + tar-pipe вместо per-file `mkdir`+`cp` (18 × 3 форка → 2 команды)
- Семантика `mirror-not-overlay` (stale-delete) не трогается; защита от коллизий файл/каталог сохранена

**Acceptance Criteria:**
- [x] `t7_skills` использует один `cp -r` вместо цикла с `mkdir`+`cp`
- [x] `t6_mirror_templates` использует батч-операции (tar-pipe или батч `mkdir`), не per-file форки
- [x] `make test` проходит — все T1–T11Invariant остаются зелёными

---

## Task 5 — Параллельный запуск сьютов в Makefile (`xargs -0 -P`)

**Task Type:** code
**Mapped Test Cases:** TC-006 (measure 5), TC-009 (parallel output integrity), TC-007
**Files:** `Makefile`, `test/lib.sh`

**Implementation Notes:**
- Каждый сьют пишет в собственный лог-файл (`/tmp/pf-suite-NAME.log`); агрегация — стабильная конкатенация логов в алфавитном порядке
- `make test 2>&1 | grep ...` не используется для проверки: TC-009 подтверждает корректность чтением лог-файлов после завершения `make test`
- Node-тесты (`test/pf-test.js`, `test/pf-skill.js`) запускаются после завершения всех bash-съютов — последовательно, не параллельно
- `-P 4` — начальное значение; корректируется по результатам замера (AC-01) на `-P 6`, `-P 8`
- **Важно:** реализация не должна reintroduceровать отвергнутые подходы (hardlink, sourcing, `clone --local`, shared `TMP_HOME`) из brd.md

**Acceptance Criteria:**
- [x] `make test` запускает сьюты параллельно (`grep -c 'xargs -P' Makefile`)
- [x] Каждый сьют пишет в отдельный лог-файл
- [x] Финальный вывод — стабильная конкатенация логов, не смешанные потоки
- [x] TC-009 подтверждает корректность: чтение лог-файлов (не grep stdout)
- [x] `/pf-test` skill разрешает TC-ID корректно

---

## Task 6 — Замер и документирование гипотезы об окружении

**Task Type:** measurement + documentation
**Mapped Test Cases:** TC-008, TC-010

**Implementation Notes:**
- Гипотеза: `$TMPDIR` на Windows 11 Dev Drive (ReFS) или с исключением Defender уменьшает sys-время (сигнатура «sys >> user» в профиле)
- Замер: один контролируемый прогон `time make test` с `TMPDIR=/path/to/dev-drive` vs стандартный `TMPDIR`
- Результат (подтверждена/не подтверждена) записывается в issue
- Автоматизация применения настроек ОС — вне скоупа

**Acceptance Criteria:**
- [ ] Выполнен один контролируемый замер (with/without Dev Drive или исключение Defender)
      — НЕ выполнен: гипотеза относится к Windows 11, на Ubuntu непроверяема.
      Не гейт этой issue (см. BRD, AC-07).
- [x] Результат записан в issue: hypothesis confirmed / not confirmed
- [x] Если подтверждена — рекомендуемая настройка указана
- [x] Никаких изменений ОС или автоматизации их применения

---

## Task 7 (добавлена 2026-09-09): литеральная замена в мутационном сьюте

**Статус:** сделана.

**Проблема:** `test/pf-idea-semantic-mutations.sh` заменял текст через
`mutated="${content/$m_search/$m_replace}"`. Это глоб-подстановка, а не
литеральная: строки манифеста с markdown-жирным (`**`) уводили bash в
backtracking по 68 КБ содержимого. Замер: 57.9 с на одну строку манифеста,
137 с из 145 с сьюта, 84% всего wall-clock `make test`.

**Решение:** замена через `awk index()`; search/replace передаются в awk через
`ENVIRON`, а не через `-v` (иначе awk обработал бы escape-последовательности).
Семантика не изменилась: первое вхождение, один файл, те же 16 строк.

**Файлы:** `test/pf-idea-semantic-mutations.sh`, `test/safety-audit.sh` (step 8).

**Acceptance Criteria:**
- [x] Сьют даёт те же 16 passed, 0 failed
- [x] Время сьюта 144.7 с → 3.75 с
- [x] `safety-audit.sh` step 8 падает при возврате старой формы и проходит на новой
- [x] Полный `make test` зелёный: 28 сьютов, 1151 ассерт, 10.7 с

---

## Task 8 (добавлена 2026-09-09): гард `pf_repo_copy` против git-worktree

**Статус:** сделана.

**Проблема:** `cp -a "$REPO_ROOT"` в linked worktree копирует `.git` как
файл-указатель, поэтому git-команды «внутри копии» пишут в настоящий
репозиторий, а `assert_repo_untouched` остаётся зелёным. Наблюдалось: два
коммита `test(TC-041): inject a stray marker into a skill` попали в реальную
issue-ветку, `skills/pf-check/SKILL.md` остался изменённым.

**Решение:** явная ошибка вместо порчи репозитория (самодостаточную копию
дёшево не сделать — ветка занята другим worktree, потребовалось бы переписывать
common git dir). Ассертируется `safety-audit.sh` step 7, написанным до фикса и
наблюдавшимся красным.

**Известное ограничение:** тесты теперь нельзя гонять из git-worktree — записано
в `docs/planning/tech-debt.md`.

**Файлы:** `test/lib.sh`, `test/safety-audit.sh`.

---

## итог

**Task count:** 8 задач (6 исходных + 2 добавленные 2026-09-09)
**Complexity estimate:** medium (мера 4 требует аккуратности в зонах mirror/stale-delete; мера 5 — надёжная изоляция логов)

**Files touched:**
- `test/lib.sh` — Tasks 1, 3
- `Makefile` — Tasks 2, 5
- `scripts/converge-to-v3.sh` — Task 4
- `test/docs-refs.sh` — Task 2
- `test/pf-idea-semantic-mutations.sh` — Task 7
- `test/safety-audit.sh` — Tasks 7, 8

**Замечание по мерам 1-6:** меры 4 и 5 в редакции 08.09 были нерабочими и
переписаны 09.09 (см. `code_review.md`, CR-007..CR-010). Мера 4 в текущем виде
даёт на converge-сьютах 25.4 с → 17.4 с; `make test-migration` зелёный
(193 passed, 5.9 с).
